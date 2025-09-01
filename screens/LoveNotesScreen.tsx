// screens/LoveNotesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import useAuthListener from '../hooks/useAuthListener';
import { listByKind } from '../utils/memories';
import { addNote, deleteNote, listenNotes, Note, NoteKind, updateNote } from '../utils/notes';
// If you store partner uid somewhere, import your helper here:
// import { getPartnerUid } from '../utils/partner';

const PINK = '#E14C7B';
const PINK_SOFT = '#FFE5EF';
const BORDER = '#E7E9ED';
const TEXT = '#111';
const MUTED = '#8A8F98';
const BG = '#FAFAFC';

type Template = { key: string; text: string };

const TEMPLATES: Template[] = [
  { key: 'gratitude', text: 'Grateful for you because…' },
  { key: 'today', text: 'Today made me think of you when…' },
  { key: 'cheer', text: 'You’ve got this because…' },
  { key: 'memory', text: 'Favorite little memory with you: …' },
  { key: 'plan', text: 'Let’s plan a tiny date: …' },
];

export default function LoveNotesScreen() {
  const { user } = useAuthListener();

  const [pairId, setPairId] = useState<string | null>(null); // wire from your partner utils if available
  const [notes, setNotes] = useState<Note[]>([]);
  const [kind, setKind] = useState<NoteKind>('private');
  const [createForBoth, setCreateForBoth] = useState(false);
  const [sendPush, setSendPush] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const [quick, setQuick] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  // Listen to notes
  useEffect(() => {
    if (!user) return;
    const unsub = listenNotes(user.uid, pairId, setNotes);
    return unsub;
  }, [user?.uid, pairId]);

  // Quick prompts from Memory Vault
  useEffect(() => {
    (async () => {
      if (!user) return;

      const foods = await listByKind(user.uid, 'favoriteFood').catch(() => []);
      const places = await listByKind(user.uid, 'place').catch(() => []);
      const ideas = await listByKind(user.uid, 'idea').catch(() => []);
      const habits = await listByKind(user.uid, 'habit').catch(() => []);

      const f = foods?.[0]?.label;
      const p = places?.[0]?.label;
      const i = ideas?.[0]?.label;
      const h = habits?.[0]?.label;

      const hour = new Date().getHours();
      const timeWord = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

      const prompts = [
        f ? `Snack surprise: ${f} waiting when you get home.` : null,
        p ? `Walk together at ${p} this ${timeWord}?` : null,
        i ? `Tiny surprise tonight: ${i}?` : null,
        h ? `Proud of your ${h} streak—keep going!` : null,
        'One thing I adore about you today is…',
        'Thanks for the little things you do. Like…',
      ].filter(Boolean) as string[];

      setQuick(prompts.slice(0, 6));
    })();
  }, [user?.uid]);

  const canSend = useMemo(() => text.trim().length > 0 && !!user, [text, user]);

  async function handleSend(templateKey?: string) {
    if (!user || !canSend) return;
    setBusy(true);
    try {
      // create the primary note
      await addNote({
        ownerId: user.uid,
        pairId: kind === 'shared' ? pairId ?? null : null,
        kind,
        text: text.trim(),
        templateKey: templateKey ?? null,
      });

      // optional duplicate to partner as private
      if (createForBoth && kind === 'private' && pairId) {
        await addNote({
          ownerId: pairId, // partner receives same note privately
          pairId: null,
          kind: 'private',
          text: text.trim(),
          templateKey: templateKey ?? null,
        });
      }

      // optional local push
      if (sendPush) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Love Note 💌',
            body: text.trim(),
            sound: 'default',
          },
          trigger: null, // fire immediately
        });
      }

      setText('');
      inputRef.current?.clear();
      Alert.alert('Sent 💌', kind === 'shared' ? 'Shared note posted.' : 'Saved to your private notes.');
    } catch (e: any) {
      Alert.alert('Oops', e?.message ?? 'Could not send note');
    } finally {
      setBusy(false);
    }
  }

  // Animated card item
  const Card = ({ item, index }: { item: Note; index: number }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        delay: index * 35,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, [anim, index]);

    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
    const opacity = anim;

    const onLongPress = () => {
      Alert.alert('Note', 'What would you like to do?', [
        {
          text: 'Edit (add ❤️)',
          onPress: () => updateNote(item.id, { text: item.text + ' ❤️ (edited)' }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNote(item.id),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    };

    return (
      <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
        <Pressable onLongPress={onLongPress}>
          <Text style={styles.cardText}>{item.text}</Text>
          <View style={styles.row}>
            <Text style={styles.pill}>{item.kind === 'shared' ? 'Shared' : 'Private'}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => updateNote(item.id, { text: item.text + ' ❤️' })}>
              <Ionicons name="heart-outline" size={20} color={PINK} />
            </TouchableOpacity>
            <View style={{ width: 12 }} />
            <TouchableOpacity onPress={() => deleteNote(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Love Notes</Text>
        <View style={styles.kindRow}>
          <Chip selected={kind === 'private'} label="Private" onPress={() => setKind('private')} />
          <Chip selected={kind === 'shared'} label="Shared" onPress={() => setKind('shared')} />
          <View style={{ width: 8 }} />
          <Toggle value={createForBoth} onChange={setCreateForBoth} label="Create for both" hint="Duplicate to partner" />
          <View style={{ width: 8 }} />
          <Toggle value={sendPush} onChange={setSendPush} label="Send as push" hint="Local notification" />
        </View>
      </View>

      {/* Templates */}
      <FlatList
        data={TEMPLATES}
        keyExtractor={t => t.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        style={{ maxHeight: 48, marginBottom: 8 }}
        renderItem={({ item }) => (
          <Chip
            label={item.text}
            onPress={() => {
              setText(item.text + ' ');
              inputRef.current?.focus();
            }}
          />
        )}
      />

      {/* Quick romantic prompts */}
      {quick.length > 0 && (
        <FlatList
          data={quick}
          keyExtractor={(t, i) => String(i)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          style={{ maxHeight: 44, marginBottom: 8 }}
          renderItem={({ item }) => (
            <Chip
              label={item}
              onPress={() => {
                setText(item + ' ');
                inputRef.current?.focus();
              }}
              ghost
            />
          )}
        />
      )}

      {/* Composer */}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Write a sweet note…"
          placeholderTextColor="#9BA1A6"
          value={text}
          onChangeText={setText}
          multiline
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: canSend ? PINK : '#C7CAD0' }]}
          disabled={!canSend || busy}
          onPress={() => handleSend()}
        >
          <Text style={styles.btnText}>{kind === 'shared' ? 'Post' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {/* Feed */}
      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}
        renderItem={({ item, index }) => <Card item={item} index={index} />}
        ListEmptyComponent={<Text style={styles.empty}>No notes yet. Try a template or a quick prompt 🌸</Text>}
      />
    </KeyboardAvoidingView>
  );
}

/* Tiny UI bits */

function Chip({
  label, onPress, selected, ghost,
}: { label: string; onPress?: () => void; selected?: boolean; ghost?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          marginRight: 8,
          borderWidth: 1,
          borderColor: ghost ? '#EAD7E0' : selected ? PINK : '#E0E2E6',
          backgroundColor: selected ? PINK_SOFT : ghost ? 'transparent' : '#FFF',
        },
      ]}
    >
      <Text style={{ color: selected ? PINK : TEXT }} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <TouchableOpacity onPress={() => onChange(!value)} style={styles.toggle}>
      <View style={[styles.switch, value ? styles.switchOn : styles.switchOff]} />
      <View>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: TEXT },
  kindRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

  inputRow: { paddingHorizontal: 16, paddingTop: 8 },
  input: {
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT,
  },

  actions: { paddingHorizontal: 16, paddingTop: 8 },
  btn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontWeight: '700' },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  cardText: { fontSize: 16, color: '#222', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F4F5F8',
    color: '#555',
    fontSize: 12,
  } as any,
  empty: { textAlign: 'center', color: MUTED, marginTop: 24 },

  toggle: { flexDirection: 'row', alignItems: 'center' },
  switch: { width: 36, height: 22, borderRadius: 999, marginRight: 8 },
  switchOn: { backgroundColor: PINK },
  switchOff: { backgroundColor: '#D2D6DB' },
  toggleLabel: { fontWeight: '700', color: TEXT },
  toggleHint: { color: MUTED, fontSize: 12 },
});
