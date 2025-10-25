// screens/LoveNotesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import { getPairId, getPartnerUid } from '../utils/partner';

// Push helpers (global handler is set in utils/push via index.js import)
import { ensurePushSetup, getUserExpoTokens, sendToTokens } from '../utils/push';

// Spotlight
import {
  SpotlightAutoStarter,
  SpotlightTarget,
  type SpotlightStep,
} from '../components/spotlight';

const ANDROID_CHANNEL_ID = 'messages';

const SUGGESTIONS = [
  'Thanks for today 💞',
  'Proud of you!',
  'You make me smile',
  'Coffee on me tomorrow?',
  'Can’t wait to see you',
  'You’re my favorite notification.',
  'Small note: you’re amazing.',
];

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}

const LoveNotesScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const { user } = useAuthListener();

  // Pair/link state
  const [pairId, setPairId] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null); // null = loading

  const [text, setText] = useState('');
  const [sendingLock, setSendingLock] = useState(false); // short lock to avoid double taps
  const inputRef = useRef<any>(null);

  // ⚠️ Do NOT set a per-screen notification handler — the app-wide handler is registered in utils/push.
  // Setting another handler here could override it on iOS and block alerts.

  // Android channel for push/local
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    }).catch(() => {});
  }, []);

  // Register device token & store to users/{uid}/public/push
  useEffect(() => {
    (async () => {
      if (!user) return;
      await ensurePushSetup(user.uid);
    })().catch((e) => console.warn('[push] setup failed', e));
  }, [user]);

  // ---- Link state resolution (uses pairId OR partnerUid) ----
  const refreshLinkState = useCallback(async () => {
    if (!user) {
      setPairId(null);
      setLinked(false);
      return;
    }
    setLinked(null); // loading
    try {
      const [pid, pUid] = await Promise.all([getPairId(user.uid), getPartnerUid(user.uid)]);
      setPairId(pid ?? null);
      setLinked(Boolean(pid || pUid));
    } catch {
      setPairId(null);
      setLinked(false);
    }
  }, [user]);

  useEffect(() => { refreshLinkState(); }, [refreshLinkState]);
  useFocusEffect(useCallback(() => { refreshLinkState(); }, [refreshLinkState]));

  // Resolve partner uid robustly (hook -> pair doc -> user doc)
  const resolvePartnerUid = useCallback(
    async (candidate: string | null): Promise<string | null> => {
      if (!user?.uid) return null;
      let toUid: string | null = candidate ?? null;

      // 1) pair doc members
      if (!toUid && pairId) {
        try {
          const psnap = await getDoc(doc(db, 'pairs', pairId));
          if (psnap.exists()) {
            const members = (psnap.data() as any)?.members ?? [];
            if (Array.isArray(members)) {
              toUid = members.find((u: string) => u && u !== user.uid) ?? null;
            }
          }
        } catch (e) {
          console.warn('[loveNotes] resolve via pair failed', e);
        }
      }

      // 2) users/{uid}.partnerUid
      if (!toUid) {
        try {
          const usnap = await getDoc(doc(db, 'users', user.uid));
          const d = usnap.exists() ? (usnap.data() as any) : null;
          if (d?.partnerUid && typeof d.partnerUid === 'string') toUid = d.partnerUid;
        } catch (e) {
          console.warn('[loveNotes] resolve via user failed', e);
        }
      }

      return toUid && toUid !== user.uid ? toUid : null;
    },
    [user?.uid, pairId]
  );

  // Send Expo pushes to all partner devices (reads users/{partnerUid}/public/push) + outbox fallback
  async function sendPushToPartner(partnerUid: string | null, bodyText: string, noteId?: string) {
    try {
      if (!user?.uid) return;

      const toUid = await resolvePartnerUid(partnerUid);
      if (!toUid) {
        console.warn('[loveNotes] skip send — no partner uid resolved or partner == self');
        return;
      }

      const title = 'New love note 💌';
      const body  = bodyText;
      const data  = { kind: 'lp:loveNote', noteId, fromUid: user.uid, pairId };

      // Immediate push
      try {
        const tokens = await getUserExpoTokens(toUid);
        console.log('[loveNotes] resolved tokens for partner:', tokens?.length || 0);
        if (tokens?.length) {
          await sendToTokens(tokens, {
            title,
            body,
            data,
            channelId: ANDROID_CHANNEL_ID, // no iOS-only fields!
          });
        } else {
          console.warn('[loveNotes] partner has no tokens yet');
        }
      } catch (e) {
        console.warn('[loveNotes] sendToTokens failed', e);
      }

      // Outbox fallback for backend worker/logging
      try {
        await addDoc(collection(db, 'pushOutbox'), {
          type: 'love_note',
          toUid,
          pairId: pairId ?? null,
          actorUid: user.uid,
          title,
          body,
          data,
          channelId: ANDROID_CHANNEL_ID,
          createdAt: serverTimestamp(),
          status: 'pending',
        });
      } catch (e) {
        console.warn('[loveNotes] enqueue outbox failed', e);
      }
    } catch (e) {
      console.warn('[loveNotes] send error', e);
    }
  }

  // 🚀 Optimistic/instant send
  const sendNote = useCallback(() => {
    if (!user) return;
    if (!linked) {
      Alert.alert('Link accounts first', 'Open Settings to link with your partner.');
      return;
    }
    const tText = text.trim();
    if (!tText) {
      Alert.alert('Write something sweet…');
      return;
    }
    if (sendingLock) return; // prevent double-tap

    setSendingLock(true);
    setTimeout(() => setSendingLock(false), 400); // short lock

    // Clear input & close keyboard immediately so it feels instant
    const previous = text;
    setText('');
    Keyboard.dismiss();

    // Prepare doc ref + payload up front
    const noteRef = doc(collection(db, 'notes'));
    const payload = {
      ownerId: user.uid,
      pairId,
      text: tText,
      // Keep server clock as source of truth, but add a client time to help ordering if you render locally
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      clientAt: Date.now(),
    };

    // Defer heavy work until after the UI has updated
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => {
        const writePromise = setDoc(noteRef, payload).catch((e) => {
          console.warn('[loveNotes] write failed', e);
          // Restore input and surface error
          setText(previous);
          Alert.alert('Could not send', e?.message ?? 'Please try again.');
        });

        const pushPromise = getPartnerUid(user.uid)
          .then((pUid) => sendPushToPartner(pUid ?? null, tText, noteRef.id))
          .catch((e) => console.warn('[loveNotes] partner resolve/send failed', e));

        // Fire and forget — do not block UI
        void writePromise;
        void pushPromise;
      });
    });
  }, [user, linked, text, pairId, sendingLock]);

  async function onPickSuggestion(sug: string) {
    if (linked) {
      setText(sug);
      requestAnimationFrame(() => inputRef.current?.focus?.());
      return;
    }
    await Clipboard.setStringAsync(sug);
    Alert.alert('Copied ✨', 'Note copied to clipboard. Link accounts to send love notes inside the app.');
  }

  async function shareViaMessages() {
    try {
      const msg = text.trim() || 'Thinking of you 💖';
      await Share.share({ message: msg });
    } catch {}
  }

  // Spotlight steps
  const STEPS: SpotlightStep[] = useMemo(() => {
    if (!linked) {
      return [
        { id: 'ln-welcome', targetId: null, title: 'Love Notes 💌', text: 'Send quick notes; we’ll nudge your partner.', placement: 'bottom', allowBackdropTapToNext: true },
        { id: 'ln-link', targetId: 'ln-link', title: 'Link with your partner', text: 'Connect accounts to send and receive notes in-app.' },
        { id: 'ln-suggestions', targetId: 'ln-suggestions', title: 'Need a spark?', text: 'Tap a suggestion to copy the text.' },
        { id: 'ln-share', targetId: 'ln-share', title: 'Send via Messages', text: 'Prefer SMS? Share it from here.', placement: 'top' },
      ];
    }
    return [
      { id: 'ln-welcome', targetId: null, title: 'Love Notes 💌', text: 'Send quick notes; we’ll nudge your partner.', placement: 'bottom', allowBackdropTapToNext: true },
      { id: 'ln-input', targetId: 'ln-input', title: 'Write here', text: 'Type a short note for your partner.' },
      { id: 'ln-send', targetId: 'ln-send', title: 'Send', text: 'Deliver instantly and notify your partner.', placement: 'top' },
      { id: 'ln-suggestions', targetId: 'ln-suggestions', title: 'Need a spark?', text: 'Tap to prefill your note.' },
      { id: 'ln-share', targetId: 'ln-share', title: 'Send via Messages', text: 'Prefer SMS? Share it from here.', placement: 'top' },
    ];
  }, [linked]);

  const NotLinkedCard = () => (
    <Card>
      <View style={s.linkRow}>
        <View style={s.linkIcon}>
          <Ionicons name="link" size={18} color={t.colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <ThemedText variant="title">Share notes together</ThemedText>
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 2 }}>
            Link with your partner to send and receive love notes.
          </ThemedText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <SpotlightTarget id="ln-link">
          <Button label="Link now" onPress={() => nav.navigate('Settings')} />
        </SpotlightTarget>
        <SpotlightTarget id="ln-share">
          <Button label="Send via Messages…" variant="outline" onPress={shareViaMessages} />
        </SpotlightTarget>
      </View>
    </Card>
  );

  const LoadingCard = () => (
    <Card>
      <ThemedText variant="title">Checking link…</ThemedText>
      <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>
        One moment.
      </ThemedText>
    </Card>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: t.spacing.md }}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <ThemedText variant="display">Love notes</ThemedText>
          <ThemedText variant="subtitle" color={t.colors.textDim}>
            Drop a little kindness ✨
          </ThemedText>
        </View>

        {/* Composer / CTA */}
        {linked === null ? (
          <LoadingCard />
        ) : !linked ? (
          <NotLinkedCard />
        ) : (
          <Card>
            <SpotlightTarget id="ln-input">
              <Input
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder="Write something nice for your partner…"
                returnKeyType="send"
                onSubmitEditing={sendNote}
              />
            </SpotlightTarget>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: t.spacing.md }}>
              <SpotlightTarget id="ln-send">
                <Button label="Send" onPress={sendNote} disabled={!text.trim() || sendingLock} />
              </SpotlightTarget>
              <SpotlightTarget id="ln-share">
                <Button label="Send via Messages…" variant="outline" onPress={shareViaMessages} />
              </SpotlightTarget>
            </View>
          </Card>
        )}

        {/* Suggestions */}
        <Card style={{ marginTop: t.spacing.md }}>
          <ThemedText variant="title">Need a spark?</ThemedText>
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>
            Tap to {linked ? 'fill your note' : 'copy to clipboard'}.
          </ThemedText>

          <SpotlightTarget id="ln-suggestions">
            <View style={s.suggestWrap}>
              {SUGGESTIONS.map((sug) => (
                <Pressable
                  key={sug}
                  onPress={() => onPickSuggestion(sug)}
                  style={s.suggestChip}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggestion: ${sug}`}
                >
                  <ThemedText variant="label">{sug}</ThemedText>
                </Pressable>
              ))}
            </View>
          </SpotlightTarget>
        </Card>

        {/* Spacer list to respect bottom inset */}
        <FlatList
          data={[]}
          renderItem={null as any}
          ListHeaderComponent={<View />}
          contentContainerStyle={{ paddingBottom: insets.bottom + t.spacing.xl }}
        />

        {/* Tutorial */}
        <SpotlightAutoStarter uid={user?.uid ?? null} steps={STEPS} persistKey="tour-love-notes" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    header: { paddingHorizontal: t.spacing.md, paddingTop: t.spacing.md, paddingBottom: t.spacing.s },

    linkRow: { flexDirection: 'row', alignItems: 'center' },
    linkIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: withAlpha(t.colors.primary, 0.08),
      alignItems: 'center',
      justifyContent: 'center',
    },

    suggestWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.s as number,
      marginTop: t.spacing.md,
    },

    suggestChip: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
  });

export default LoveNotesScreen;