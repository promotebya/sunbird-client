// screens/LoveNotesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
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

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import { getPairId } from '../utils/partner';

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

  useEffect(() => {
    (async () => {
      if (!user) return;
      setPairId(await getPairId(user.uid));
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
      await addDoc(collection(db, 'notes'), {
        ownerId: user.uid,
        pairId,
        text: tText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
        <Button label="Link now" onPress={() => nav.navigate('Settings')} />
        <Button label="Send via Messages…" variant="outline" onPress={shareViaMessages} />
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
            <Input
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder="Write something for both of you…"
              returnKeyType="send"
              onSubmitEditing={sendNote}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: t.spacing.md }}>
              <Button label="Send" onPress={sendNote} disabled={!text.trim()} />
              <Button label="Send via Messages…" variant="outline" onPress={shareViaMessages} />
            </View>
          </Card>
        )}

        {/* Suggestions */}
        <Card style={{ marginTop: t.spacing.md }}>
          <ThemedText variant="title">Need a spark?</ThemedText>
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>
            Tap to {pairId ? 'fill your note' : 'copy to clipboard'}.
          </ThemedText>
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
        </Card>

        {/* Spacer list to respect bottom inset */}
        <FlatList
          data={[]}
          renderItem={null as any}
          ListHeaderComponent={<View />}
          contentContainerStyle={{ paddingBottom: insets.bottom + t.spacing.xl }}
        />
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
      backgroundColor: withAlpha(t.colors.primary, 0.08), // theme-aware tint (matches Home)
      alignItems: 'center',
      justifyContent: 'center',
    },

    suggestWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.s as number,
      marginTop: t.spacing.md,
    },

    // ✅ theme-safe neutral chip (replaces hard-coded pink/gray)
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