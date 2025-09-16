// screens/LoveNotesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import ThemedText from '../components/ThemedText';
import sharedStyles from '../components/sharedStyles';
import { tokens } from '../components/tokens';

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

const LoveNotesScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
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
    const t = text.trim();
    if (!t) {
      Alert.alert('Write something sweet…');
      return;
    }
    try {
      await addDoc(collection(db, 'notes'), {
        ownerId: user.uid,
        pairId,
        text: t,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setText('');
      Keyboard.dismiss();
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? 'Please try again.');
    }
  }

  /** Suggestions are visible always. Behavior:
   *  - If linked: set input text and focus it
   *  - If not linked: copy to clipboard and nudge to link
   */
  async function onPickSuggestion(s: string) {
    if (pairId) {
      setText(s);
      // focus the input so user can hit Send
      requestAnimationFrame(() => inputRef.current?.focus?.());
      return;
    }
    await Clipboard.setStringAsync(s);
    Alert.alert('Copied ✨', 'Note copied to clipboard. Link accounts to send love notes inside the app.');
  }

  const NotLinkedCard = () => (
    <Card>
      <View style={styles.linkRow}>
        <View style={styles.linkIcon}>
          <Ionicons name="link" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <ThemedText variant="title">Share notes together</ThemedText>
          <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 2 }}>
            Link with your partner to send and receive love notes.
          </ThemedText>
        </View>
      </View>
      <Button
        label="Link now"
        onPress={() => nav.navigate('Settings')}
        style={{ marginTop: tokens.spacing.md }}
      />
    </Card>
  );

  return (
    <SafeAreaView style={[sharedStyles.screen, { paddingTop: tokens.spacing.md }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="display">Love notes</ThemedText>
          <ThemedText variant="subtitle" color={tokens.colors.textDim}>
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
            <Button label="Send" onPress={sendNote} style={{ marginTop: tokens.spacing.md }} />
          </Card>
        )}

        {/* Suggestions (always visible) */}
        <Card style={{ marginTop: tokens.spacing.md }}>
          <ThemedText variant="title">Need a spark?</ThemedText>
          <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 4 }}>
            Tap to {pairId ? 'fill your note' : 'copy to clipboard'}.
          </ThemedText>
          <View style={styles.suggestWrap}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => onPickSuggestion(s)} style={styles.suggestChip}>
                <ThemedText variant="label">{s}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Spacer list to respect bottom inset */}
        <FlatList
          data={[]}
          renderItem={null as any}
          ListHeaderComponent={<View />}
          contentContainerStyle={{ paddingBottom: insets.bottom + tokens.spacing.xl }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.md, paddingBottom: tokens.spacing.s },

  linkRow: { flexDirection: 'row', alignItems: 'center' },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  suggestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.s as number,
    marginTop: tokens.spacing.md,
  },
  suggestChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ECEFF3',
  },
});

export default LoveNotesScreen;
