// utils/gentleNudges.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ScheduledNudge = {
  id: string;
  fireAtMs: number;      // our own timestamp used for dedupe/UI
  title: string;
  body: string;
};

const STORAGE_SEED_KEY = 'lp:nudgeSeed';
const CHANNEL_ID = 'gentle-nudges';
const MAX_UPCOMING = 12;           // never keep more than this many scheduled
const WEEKS_AHEAD = 4;             // how far we try to fill the buffer

// --- utils ---
const nowMs = () => Date.now();
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
// Tiny seeded RNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

async function ensurePermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: s2 } = await Notifications.requestPermissionsAsync();
  return s2 === 'granted';
}

async function ensureChannelAndroid() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Gentle nudges',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: undefined,
  });
}

// Build 3–4 random day/time slots inside 09:00–21:00 for a given week
function slotsForWeek(weekStart: Date, rng: () => number) {
  const perWeek = 3 + (rng() > 0.5 ? 1 : 0); // 3 or 4
  // pick distinct days [0..6]
  const days = [...Array(7).keys()].sort(() => rng() - 0.5).slice(0, perWeek);
  return days.map((d) => {
    const hour = 9 + Math.floor(rng() * 12);   // 9..20
    const minute = Math.floor(rng() * 60);     // 0..59
    const dt = new Date(weekStart);
    dt.setDate(dt.getDate() + d);
    dt.setHours(hour, minute, 0, 0);
    return dt.getTime();
  });
}

// Start of the local week (Mon 00:00)
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Generate a rolling set of candidate times
async function generateCandidateTimes(userId?: string | null, weeks = WEEKS_AHEAD): Promise<number[]> {
  // stable per user seed (and persisted so it won't reshuffle each fresh install)
  let seedStr = (await AsyncStorage.getItem(STORAGE_SEED_KEY)) || '';
  if (!seedStr) {
    seedStr = String(hashStr((userId || 'anonymous') + ':' + nowMs()));
    await AsyncStorage.setItem(STORAGE_SEED_KEY, seedStr);
  }
  const rng = mulberry32(hashStr(seedStr));

  const start = startOfWeek();
  const times: number[] = [];
  for (let w = 0; w < weeks; w++) {
    const wk = new Date(start);
    wk.setDate(start.getDate() + w * 7);
    times.push(...slotsForWeek(wk, rng));
  }
  // future only + sort
  const soon = nowMs() + 60_000; // 1 min guard
  return times.filter((t) => t > soon).sort((a, b) => a - b);
}

function toNudge(item: Notifications.NotificationRequest): ScheduledNudge | null {
  const data = (item.content?.data || {}) as any;
  if (data?.kind !== 'lp:nudge' || typeof data.fireAtMs !== 'number') return null;
  return {
    id: item.identifier,
    fireAtMs: data.fireAtMs,
    title: item.content.title ?? 'Make their day 💖',
    body: item.content.body ?? 'Send a quick note or do a tiny thing.',
  };
}

function isScheduledNudge(n: ScheduledNudge | null | undefined): n is ScheduledNudge {
  return !!n;
}

// --- public API ---

/** Reconcile: keep at most MAX_UPCOMING & fill missing slots */
export async function reconcileGentleNudges(userId?: string | null): Promise<ScheduledNudge[]> {
  const granted = await ensurePermissions();
  if (!granted) return [];

  await ensureChannelAndroid();

  // Read existing
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const ours = all.map(toNudge).filter(isScheduledNudge);

  // Drop past or duplicates (by fireAtMs)
  const seen = new Set<number>();
  const future = ours
    .filter((n) => n.fireAtMs > nowMs())
    .filter((n) => {
      if (seen.has(n.fireAtMs)) {
        Notifications.cancelScheduledNotificationAsync(n.id).catch(() => {});
        return false;
      }
      seen.add(n.fireAtMs);
      return true;
    })
    .sort((a, b) => a.fireAtMs - b.fireAtMs);

  let upcoming = future.slice(0, MAX_UPCOMING);

  // Cancel anything beyond the cap to avoid huge tails
  for (let i = MAX_UPCOMING; i < future.length; i++) {
    Notifications.cancelScheduledNotificationAsync(future[i].id).catch(() => {});
  }

  const need = clamp(MAX_UPCOMING - upcoming.length, 0, MAX_UPCOMING);
  if (need > 0) {
    const candidates = await generateCandidateTimes(userId, WEEKS_AHEAD);
    const have = new Set(upcoming.map((n) => n.fireAtMs));
    const toCreate = candidates.filter((t) => !have.has(t)).slice(0, need);

    for (const fireAtMs of toCreate) {
      // Use a typed Date trigger to satisfy TS across Expo SDK versions
      const trigger: Notifications.DateTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAtMs),
        channelId: CHANNEL_ID,
      };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Make their day 💖',
          body: 'Send a quick note or do a tiny thing.',
          data: { kind: 'lp:nudge', fireAtMs },
        },
        trigger,
      });

      upcoming.push({ id, fireAtMs, title: 'Make their day 💖', body: 'Send a quick note or do a tiny thing.' });
    }

    // keep sorted
    upcoming = upcoming.sort((a, b) => a.fireAtMs - b.fireAtMs);
  }

  return upcoming;
}

export async function listGentleNudges(): Promise<ScheduledNudge[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const ours = all.map(toNudge).filter(isScheduledNudge);
  return ours.sort((a, b) => a.fireAtMs - b.fireAtMs);
}

export async function cancelGentleNudge(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllGentleNudges() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}