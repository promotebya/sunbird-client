// utils/reminders.ts
import * as Notifications from 'expo-notifications';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebaseConfig';

/** Ask for permissions if needed. Returns true if granted. */
export async function ensureNotificationPermission(): Promise<boolean> {
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    status = res.status;
  }
  return status === 'granted';
}

/** Ensure Android channel exists (no-op on iOS). */
async function getReminderChannelId(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
  return 'reminders';
}

/** One-off reminder N minutes from now. */
export async function scheduleLocalReminder(title: string, minutes: number) {
  const ok = await ensureNotificationPermission();
  if (!ok) throw new Error('Notifications are not allowed. Enable them in Settings.');

  const seconds = Math.max(60, Math.round(minutes * 60));
  const dueAt = new Date(Date.now() + seconds * 1000);
  const channelId = await getReminderChannelId();

  const trigger: Notifications.TimeIntervalTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    repeats: false,
  };

  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'Reminder ⏰', body: title, sound: 'default' },
    trigger: channelId ? ({ ...trigger, channelId } as Notifications.NotificationTriggerInput) : trigger,
  });

  return { id, dueAt };
}

/** Next upcoming date for a (month, day, hour, minute) in local time. */
function nextOccurrence(month: number, day: number, hour: number, minute: number) {
  const now = new Date();
  const year = now.getFullYear();
  const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    return new Date(year + 1, month - 1, day, hour, minute, 0, 0);
  }
  return candidate;
}

/** Yearly calendar reminder (Anniversary-style). */
export async function scheduleYearlyNotification(params: {
  title: string;
  body?: string;
  month: number; // 1..12
  day: number;   // 1..31
  hour: number;  // 0..23
  minute: number;// 0..59
}) {
  const ok = await ensureNotificationPermission();
  if (!ok) throw new Error('Notifications are not allowed. Enable them in Settings.');

  const { title, body, month, day, hour, minute } = params;
  const dueAt = nextOccurrence(month, day, hour, minute);
  const channelId = await getReminderChannelId();

  const base: Notifications.CalendarTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    repeats: true,
    month,
    day,
    hour,
    minute,
    second: 0,
  };

  const trigger = (channelId
    ? ({ ...base, channelId } as Notifications.NotificationTriggerInput)
    : (base as Notifications.NotificationTriggerInput));

  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body: body ?? title, sound: 'default' },
    trigger,
  });

  return { id, dueAt };
}

/** List everything the OS has scheduled for this app. */
export async function listScheduledLocal(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/** Create a partner reminder doc (their device will schedule it locally). */
export async function createPartnerReminderDoc(params: {
  forUid: string;
  ownerId: string;
  pairId?: string | null;
  title: string;
  dueAt: Date;
}) {
  const { forUid, ownerId, pairId = null, title, dueAt } = params;
  await addDoc(collection(db, 'reminders'), {
    forUid,
    ownerId,
    pairId,
    title,
    dueAt: dueAt.toISOString(), // store ISO
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Nicely format a time; accepts Date or ISO string. */
export function formatLocalTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Live count of pending partner reminders (tab badge). */
export function subscribePendingRemindersCount(uid: string, cb: (count: number) => void): Unsubscribe {
  const q = query(
    collection(db, 'reminders'),
    where('forUid', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => cb(snap.size));
}

/* ---------- Inbox helpers (Firestore) ---------- */

export type ReminderDoc = {
  id: string;
  forUid: string;
  ownerId: string;
  pairId?: string | null;
  title: string;
  dueAt?: string; // ISO (optional)
  status: 'pending' | 'scheduled' | 'sent' | 'dismissed';
  localNotificationId?: string | null;
  createdAt?: any;
  updatedAt?: any;
  scheduledAt?: any;
};

/**
 * Subscribe to reminders for a user, split into two buckets:
 *  - pending
 *  - scheduled/handled (scheduled + dismissed + sent)
 *
 * Uses only equality filters (no orderBy / in), so it does NOT require
 * any composite Firestore indexes.
 */
export function subscribeRemindersForUid(
  uid: string,
  cb: (pending: ReminderDoc[], scheduledOrHandled: ReminderDoc[]) => void
): Unsubscribe {
  const col = collection(db, 'reminders');

  const sortByDueAt = (list: ReminderDoc[]) =>
    [...list].sort((a, b) => {
      const ta = a.dueAt ? new Date(a.dueAt).getTime() : 0;
      const tb = b.dueAt ? new Date(b.dueAt).getTime() : 0;
      return ta - tb;
    });

  let pending: ReminderDoc[] = [];
  let scheduled: ReminderDoc[] = [];
  let dismissed: ReminderDoc[] = [];
  let sent: ReminderDoc[] = [];

  const flush = () => {
    cb(sortByDueAt(pending), sortByDueAt([...scheduled, ...dismissed, ...sent]));
  };

  const u1 = onSnapshot(
    query(col, where('forUid', '==', uid), where('status', '==', 'pending')),
    (snap) => { pending = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })); flush(); },
    (err) => console.warn('inbox/pending listener', err)
  );

  const u2 = onSnapshot(
    query(col, where('forUid', '==', uid), where('status', '==', 'scheduled')),
    (snap) => { scheduled = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })); flush(); },
    (err) => console.warn('inbox/scheduled listener', err)
  );

  const u3 = onSnapshot(
    query(col, where('forUid', '==', uid), where('status', '==', 'dismissed')),
    (snap) => { dismissed = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })); flush(); },
    (err) => console.warn('inbox/dismissed listener', err)
  );

  const u4 = onSnapshot(
    query(col, where('forUid', '==', uid), where('status', '==', 'sent')),
    (snap) => { sent = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })); flush(); },
    (err) => console.warn('inbox/sent listener', err)
  );

  return () => { u1(); u2(); u3(); u4(); };
}

export async function updateReminderStatus(id: string, status: ReminderDoc['status']) {
  await updateDoc(doc(db, 'reminders', id), { status, updatedAt: serverTimestamp() });
}

export async function removeReminder(id: string) {
  await deleteDoc(doc(db, 'reminders', id));
}