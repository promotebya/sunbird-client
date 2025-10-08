// screens/LoveNotesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import { getPairId, getPartnerUid } from '../utils/partner';
import { ensureNotificationPermission } from '../utils/reminders';

// 👇 Spotlight imports
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
  const [pairId, setPairId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<any>(null);

  // --- Push setup (one-time per device) ---
  useEffect(() => {
    // Banner/list handler (replaces deprecated shouldShowAlert)
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }) as any,
    });
  }, []);

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

  // Register device for push and store token on user's doc
  useEffect(() => {
    (async () => {
      if (!user) return;
      const granted = await ensureNotificationPermission();
      if (!granted) return;

      const projectId =
        (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
        (Constants as any)?.easConfig?.projectId;

      // Get Expo push token (requires EAS projectId in app.json)
      const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResp.data;

      // Save token (array so users can have multiple devices)
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        { expoPushTokens: arrayUnion(token) },
        { merge: true }
      );
    })().catch(() => {});
  }, [user]);

  // ---- Pairing / state ----
  useEffect(() => {
    (async () => {
      if (!user) return;
      setPairId(await getPairId(user.uid));
    })();
  }, [user]);

  // Send Expo push to partner (client-side call to Expo push API)
  async function sendPushToPartner(partnerUid: string, bodyText: string, noteId?: string) {
    try {
      const partnerRef = doc(db, 'users', partnerUid);
      const snap = await getDoc(partnerRef);
      const tokens: string[] = (snap.exists() && Array.isArray(snap.data()?.expoPushTokens))
        ? snap.data()?.expoPushTokens
        : [];

      if (!tokens.length) return; // partner not registered for push yet

      const messages = tokens.map((to) => ({
        to,
        sound: 'default',
        title: 'New love note 💌',
        body: bodyText,
        data: { kind: 'lp:loveNote', noteId, fromUid: user?.uid ?? null, pairId },
        channelId: ANDROID_CHANNEL_ID,
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    } catch {
      // swallow; push delivery best-effort
    }
  }

  async function sendNote() {
    if (!user) return;
    if (!pairId) {
      Alert.alert('Link accounts first', 'Open Settings to link with your partner.');
      return;
    }
    const tText = text.trim();
    if (!tText) {
      Alert.alert('Write something sweet…');
      return;
    }
    try {
      // Create the note
      const ref = await addDoc(collection(db, 'notes'), {
        ownerId: user.uid,
        pairId,
        text: tText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Look up partner and push
      const partnerUid = await getPartnerUid(user.uid);
      if (partnerUid) {
        await sendPushToPartner(partnerUid, tText, ref.id);
      }

      setText('');
      Keyboard.dismiss();
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? 'Please try again.');
    }
  }

  async function onPickSuggestion(sug: string) {
    if (pairId) {
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

  // ---- Spotlight steps (depend on link state) ----
  const STEPS: SpotlightStep[] = useMemo(() => {
    if (!pairId) {
      // Not linked
      return [
        {
          id: 'ln-welcome',
          targetId: null,
          title: 'Love Notes 💌',
          text: 'Send quick notes; we’ll nudge your partner.',
          placement: 'bottom',
          allowBackdropTapToNext: true,
        },
        {
          id: 'ln-link',
          targetId: 'ln-link',
          title: 'Link with your partner',
          text: 'Connect accounts to send and receive notes in-app.',
        },
        {
          id: 'ln-suggestions',
          targetId: 'ln-suggestions',
          title: 'Need a spark?',
          text: 'Tap a suggestion to copy the text.',
        },
        {
          id: 'ln-share',
          targetId: 'ln-share',
          title: 'Send via Messages',
          text: 'Prefer SMS? Share it from here.',
          placement: 'top',
        },
      ];
    }
    // Linked
    return [
      {
        id: 'ln-welcome',
        targetId: null,
        title: 'Love Notes 💌',
        text: 'Send quick notes; we’ll nudge your partner.',
        placement: 'bottom',
        allowBackdropTapToNext: true,
      },
      {
        id: 'ln-input',
        targetId: 'ln-input',
        title: 'Write here',
        text: 'Type a short note for your partner.',
      },
      {
        id: 'ln-send',
        targetId: 'ln-send',
        title: 'Send',
        text: 'Deliver instantly and notify your partner.',
        placement: 'top',
      },
      {
        id: 'ln-suggestions',
        targetId: 'ln-suggestions',
        title: 'Need a spark?',
        text: 'Tap to prefill your note.',
      },
      {
        id: 'ln-share',
        targetId: 'ln-share',
        title: 'Send via Messages',
        text: 'Prefer SMS? Share it from here.',
        placement: 'top',
      },
    ];
  }, [pairId]);

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

        {/* If not linked yet, show CTA card; if linked, show composer */}
        {!pairId ? (
          <NotLinkedCard />
        ) : (
          <Card>
            <SpotlightTarget id="ln-input">
              <Input
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder="Write something for both of you…"
                returnKeyType="send"
                onSubmitEditing={sendNote}
              />
            </SpotlightTarget>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: t.spacing.md }}>
              <SpotlightTarget id="ln-send">
                <Button label="Send" onPress={sendNote} disabled={!text.trim()} />
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
            Tap to {pairId ? 'fill your note' : 'copy to clipboard'}.
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

        {/* Auto-start the tutorial (once per user & screen) */}
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

    // theme-safe neutral chip
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