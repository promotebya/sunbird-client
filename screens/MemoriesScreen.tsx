// screens/MemoriesScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import useAuthListener from '../hooks/useAuthListener';
import type { Memory, MemoryKind, MemoryReminder, NewMemory, ReminderKind } from '../types';
import { addMemory, deleteMemory, listByKind, toggleFavorite } from '../utils/memories';

const KINDS: MemoryKind[] = ['win', 'gratitude', 'appreciation', 'idea'];

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const uid = user?.uid ?? '';

  const [kind, setKind] = useState<MemoryKind>('win');

  // form
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [remType, setRemType] = useState<ReminderKind>('none');
  const [remDate, setRemDate] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000)); // +1h
  const [remSeconds, setRemSeconds] = useState('3600'); // string input
  const [remHour, setRemHour] = useState('20');
  const [remMinute, setRemMinute] = useState('0');

  // list
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const data = await listByKind(uid, kind); // ✅ ownerId first, then kind
        if (mounted) setItems(data);
      } catch (e: any) {
        console.error(e);
        Alert.alert('Error', e?.message ?? 'Failed to load memories');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [uid, kind]);

  const reminder: MemoryReminder | undefined = useMemo(() => {
    if (remType === 'none') return undefined;
    if (remType === 'date') {
      return { type: 'date', date: remDate.getTime() };
    }
    if (remType === 'interval') {
      const secs = Number(remSeconds) || 0;
      if (secs <= 0) return { type: 'none' };
      return { type: 'interval', seconds: secs, repeats: true };
    }
    // daily
    return {
      type: 'daily',
      hour: Math.max(0, Math.min(23, Number(remHour) || 0)),
      minute: Math.max(0, Math.min(59, Number(remMinute) || 0)),
    };
  }, [remType, remDate, remSeconds, remHour, remMinute]);

  async function onAdd() {
    if (!uid) return;
    if (!label.trim() && !value.trim()) {
      Alert.alert('Add something', 'Type at least a label or a value.');
      return;
    }
    const payload: NewMemory = {
      kind,
      label: label.trim(),
      value: value.trim(),
      notes: notes.trim() || undefined,
      link: link.trim() || undefined,
      favorite: false,
      reminder,
    };
    try {
      const created = await addMemory(uid, payload); // ✅ ownerId is set in util
      setItems(prev => [created, ...prev]);
      setLabel('');
      setValue('');
      setNotes('');
      setLink('');
      setRemType('none');
      Alert.alert('Saved', 'Memory added');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not save memory');
    }
  }

  async function onDelete(m: Memory) {
    try {
      await deleteMemory(m.id, m.reminder);
      setItems(prev => prev.filter(x => x.id !== m.id));
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not delete memory');
    }
  }

  async function onToggleFav(m: Memory) {
    try {
      await toggleFavorite(m.id, !m.favorite);
      setItems(prev => prev.map(x => (x.id === m.id ? { ...x, favorite: !x.favorite } : x)));
    } catch (e: any) {
      console.error(e);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <Text style={styles.h1}>Memories</Text>

      {/* Kind tabs */}
      <View style={styles.tabs}>
        {KINDS.map(k => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            style={[styles.tab, kind === k && styles.tabActive]}
          >
            <Text style={[styles.tabText, kind === k && styles.tabTextActive]}>
              {k}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Form */}
      <View style={styles.card}>
        <TextInput
          placeholder="Label (e.g. 'Sweet message')"
          value={label}
          onChangeText={setLabel}
          style={styles.input}
        />
        <TextInput
          placeholder="Value / detail"
          value={value}
          onChangeText={setValue}
          style={styles.input}
        />
        <TextInput
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          style={styles.input}
        />
        <TextInput
          placeholder="Link (optional)"
          value={link}
          onChangeText={setLink}
          style={styles.input}
          autoCapitalize="none"
        />

        {/* Reminder quick selector */}
        <View style={styles.remRow}>
          {(['none', 'date', 'interval', 'daily'] as ReminderKind[]).map(r => (
            <Pressable
              key={r}
              onPress={() => setRemType(r)}
              style={[styles.smallBtn, remType === r && styles.smallBtnActive]}
            >
              <Text style={styles.smallBtnText}>{r}</Text>
            </Pressable>
          ))}
        </View>

        {/* Minimal inputs for each reminder type (no extra libs) */}
        {remType === 'date' && (
          <Text style={styles.hint}>
            Will remind on: {remDate.toLocaleString()}
          </Text>
        )}
        {remType === 'interval' && (
          <View>
            <TextInput
              placeholder="Every N seconds (e.g. 3600)"
              value={remSeconds}
              onChangeText={setRemSeconds}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        )}
        {remType === 'daily' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="Hour (0-23)"
              value={remHour}
              onChangeText={setRemHour}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              placeholder="Minute (0-59)"
              value={remMinute}
              onChangeText={setRemMinute}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
        )}

        <Pressable onPress={onAdd} style={[styles.btn, styles.addBtn]}>
          <Text style={styles.btnText}>Save memory</Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={m => m.id}
        refreshing={loading}
        onRefresh={() => {
          if (uid) listByKind(uid, kind).then(setItems).catch(() => {});
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No memories yet — add your first one!</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.title}>
              {item.label || '(no label)'}
              {item.favorite ? ' ★' : ''}
            </Text>
            {!!item.value && <Text style={styles.meta}>{item.value}</Text>}
            {!!item.notes && <Text style={styles.meta}>{item.notes}</Text>}
            {!!item.link && <Text style={styles.meta}>{item.link}</Text>}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => onToggleFav(item)} style={[styles.smallBtn, styles.editBtn]}>
                <Text style={styles.smallBtnText}>{item.favorite ? 'Unfavorite' : 'Favorite'}</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(item)} style={[styles.smallBtn, styles.deleteBtn]}>
                <Text style={styles.smallBtnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  h1: { fontSize: 28, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7C5FF',
  },
  tabActive: { backgroundColor: '#5B58FF' },
  tabText: { fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E4E4F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  remRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtn: { backgroundColor: '#5B58FF' },
  btnText: { color: '#fff', fontWeight: '700' },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  smallBtnActive: { backgroundColor: '#EEE' },
  editBtn: { backgroundColor: '#5B85FF' },
  deleteBtn: { backgroundColor: '#E65050' },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#777', marginTop: 24 },
  item: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { color: '#666', marginTop: 2 },
});
