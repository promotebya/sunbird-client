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
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import { getPairId, getPartnerUid } from '../utils/partner';

// 👇 Spotlight imports
import {
  SpotlightAutoStarter,
  SpotlightTarget,
  type SpotlightStep,
} from '../components/spotlight';

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

/* ---------------------- Push helpers (Expo) ---------------------- */

/** Ask for notif permission, get Expo push token, and store in Firestore. */
async function registerAndStorePushToken(userId: string): Promise<string | null> {
  try {
    // Permissions (Android 13+ also needs POST_NOTIFICATIONS)
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    // Get Expo token (works in EAS builds with projectId)
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      undefined;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResp.data;

    if (!token) return null;

    // Save on users/{uid}
    const uref = doc(db, 'users', userId);
    const snap = await getDoc(uref);

    if (!snap.exists()) {
      await setDoc(uref, { expoPushToken: token, pushTokens: [token], pushUpdatedAt: serverTimestamp() }, { merge: true });
    } else {
      const cur = snap.data() || {};
      const list: string[] = Array.isArray(cur.pushTokens) ? cur.pushTokens : [];
      if (!list.includes(token)) list.push(token);
      await updateDoc(uref, { expoPushToken: token, pushTokens: list, pushUpdatedAt: serverTimestamp() });
    }
    return token;
  } catch {
    return null;
  }
}

/** Read a user's saved push token(s). Supports `expoPushToken` and/or `pushTokens` array. */
async function getUserPushTokens(uid: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return [];
    const data = snap.data() || {};
    const one = typeof data.expoPushToken === 'string' ? [data.expoPushToken] : [];
    const many = Array.isArray(data.pushTokens) ? data.pushTokens.filter((x: any) => typeof x === 'string') : [];
    const uniq = Array.from(new Set([...one, ...many]));
    // Expo tokens start with "ExponentPushToken[" — filter if needed
    return uniq.filter(t => typeof t === 'string' && t.length > 20);
  } catch {
    return [];
  }
}

/** Send a push via Expo's API. (Client-side for simplicity.) */
async function sendExpoPush(toTokens: string[], title: string, body: string, data?: any) {
  if (!toTokens.length) return;
  // Send in small batches (Expo allows arrays but we keep it simple/robust)
  const messages = toTokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
  }));
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(messages),
  }).catch(() => {});
}

/* ---------------------------------------------------------------- */

const LoveNotesScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const { user } = useAuthListener();
  const [pairId, setPairId] = useState<string | null>(null);
  const [partnerUid, setPartnerUidState] = useState<string | null>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<any>(null);

  // Link state + partner uid
  useEffect(() => {
    (async () => {
      if (!user) return;
      const pid = await getPairId(user.uid);
      setPairId(pid ?? null);
      if (pid) {
        const puid = await getPartnerUid(user.uid);
        setPartnerUidState(puid ?? null);
      } else {
        setPartnerUidState(null);
      }
    })();
  }, [user]);

  // Ensure *this* device has a stored push token
  useEffect(() => {
    (async () => {
      if (!user) return;
      await registerAndStorePushToken(user.uid);
    })();
  }, [user]);

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
      // Save in Firestore
      await addDoc(collection(db, 'notes'), {
        ownerId: user.uid,
        pairId,
        text: tText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Fire a push to partner (if we have their token)
      if (partnerUid) {
        const tokens = await getUserPushTokens(partnerUid);
        const preview = tText.length > 120 ? `${tText.slice(0, 117)}…` : tText;
        await sendExpoPush(tokens, 'Love note 💌', preview, {
          kind: 'love_note',
          fromUid: user.uid,
          pairId,
        });
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