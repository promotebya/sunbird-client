// screens/MemoriesScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import useAuthListener from '../hooks/useAuthListener';
import type { Memory, MemoryKind } from '../types';
import { addMemory, deleteMemory, listByKind, listByOwner, updateMemory } from '../utils/memories';

const KINDS: MemoryKind[] = ['note', 'link', 'idea', 'gift', 'photo'];

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const uid = user?.uid ?? '';

  const [items, setItems] = useState<Memory[]>([]);
  const [kind, setKind] = useState<MemoryKind>('note');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  const canSubmit = useMemo(
    () => !!uid && !!label.trim() && !!value.trim(),
    [uid, label, value],
  );

  // Load initial: all memories for owner
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const data = await listByOwner(uid);
      setItems(data);
    })();
  }, [uid]);

  async function reloadByKind(nextKind?: MemoryKind) {
    if (!uid) return;
    if (nextKind) {
      const data = await listByKind(uid, nextKind);
      setItems(data);
    } else {
      const data = await listByOwner(uid);
      setItems(data);
    }
  }

  async function onAdd() {
    if (!canSubmit) return;
    try {
      await addMemory(uid, { kind, label: label.trim(), value: value.trim(), notes: notes.trim() });
      setLabel('');
      setValue('');
      setNotes('');
      await reloadByKind(kind);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add memory');
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMemory(id);
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to delete memory');
    }
  }

  async function onQuickRename(m: Memory) {
    try {
      await updateMemory(m.id, { label: m.label + ' ✨' });
      setItems((prev) => prev.map((it) => (it.id === m.id ? { ...it, label: it.label + ' ✨' } : it)));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update memory');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <Text style={styles.title}>Memory Vault</Text>

      {/* Kind Selector */}
      <View style={styles.kindsRow}>
        {KINDS.map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.kindBtn, kind === k && styles.kindBtnActive]}
            onPress={async () => {
              setKind(k);
              await reloadByKind(k);
            }}
          >
            <Text style={[styles.kindText, kind === k && styles.kindTextActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          placeholder="Title / label"
          placeholderTextColor="#999"
          value={label}
          onChangeText={setLabel}
          style={styles.input}
        />
        <TextInput
          placeholder={kind === 'link' ? 'https://example.com' : 'Value / details'}
          placeholderTextColor="#999"
          value={value}
          onChangeText={setValue}
          style={styles.input}
        />
        <TextInput
          placeholder="Notes (optional)"
          placeholderTextColor="#999"
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, { height: 72 }]}
          multiline
        />

        <TouchableOpacity
          disabled={!canSubmit}
          onPress={onAdd}
          style={[styles.addBtn, !canSubmit && { opacity: 0.5 }]}
        >
          <Text style={styles.addText}>Add memory</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(m) => m.id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={styles.empty}>No memories yet — add your first one!</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardMeta}>{item.kind} • {item.value}</Text>
              {!!item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.smallBtn} onPress={() => onQuickRename(item)}>
                <Text style={styles.smallBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#E65050' }]} onPress={() => onDelete(item.id)}>
                <Text style={styles.smallBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12, color: '#333' },

  kindsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  kindBtn: { borderWidth: 1, borderColor: '#C7C5FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  kindBtnActive: { backgroundColor: '#5B58FF', borderColor: '#5B58FF' },
  kindText: { color: '#5B58FF', fontWeight: '700' },
  kindTextActive: { color: '#fff' },

  composer: { gap: 8, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#E2E2F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#333',
  },
  addBtn: { backgroundColor: '#5B58FF', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  addText: { color: '#fff', fontWeight: '800' },

  empty: { textAlign: 'center', color: '#777', marginTop: 24 },

  card: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#FAFAFF',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#333' },
  cardMeta: { marginTop: 4, color: '#666' },
  cardNotes: { marginTop: 6, color: '#444' },
  cardActions: { justifyContent: 'center', gap: 6, marginLeft: 8 },
  smallBtn: { backgroundColor: '#5B58FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
});
