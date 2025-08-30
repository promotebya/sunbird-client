// screens/MemoriesScreen.tsx
import { useNavigation } from '@react-navigation/native';
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
import { Memory, MemoryKind } from '../types';
import {
  addMemory,
  deleteMemory,
  listByKind,
  updateMemory,
} from '../utils/memories';

const KINDS: MemoryKind[] = ['note', 'link', 'idea', 'gift'];

export default function MemoriesScreen() {
  const nav = useNavigation();
  const { user } = useAuthListener();
  const uid = user?.uid ?? '';

  const [kind, setKind] = useState<MemoryKind>('note');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Memory[]>([]);

  // form state
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  const isLink = useMemo(() => kind === 'link', [kind]);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      try {
        const data = await listByKind(uid, kind);
        setItems(data);
      } catch (e: any) {
        console.error('Load memories error:', e?.message);
        Alert.alert('Error', e?.message ?? 'Could not load memories.');
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, kind]);

  const resetForm = () => {
    setLabel('');
    setValue('');
    setNotes('');
  };

  const onAdd = async () => {
    if (!uid) return;
    if (!label.trim()) {
      Alert.alert('Add memory', 'Please enter a title/label.');
      return;
    }
    try {
      setLoading(true);
      await addMemory(uid, {
        kind,
        label: label.trim(),
        value: value.trim(),
        notes: notes.trim(),
      });
      resetForm();
      const data = await listByKind(uid, kind);
      setItems(data);
    } catch (e: any) {
      console.error('Add memory error:', e?.message);
      Alert.alert('Error', e?.message ?? 'Could not add the memory.');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = (id: string) => {
    Alert.alert('Delete', 'Delete this memory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await deleteMemory(uid, id);
            const data = await listByKind(uid, kind);
            setItems(data);
          } catch (e: any) {
            console.error('Delete memory error:', e?.message);
            Alert.alert('Error', e?.message ?? 'Could not delete memory.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const onInlineEdit = async (id: string, field: 'label' | 'notes', newVal: string) => {
    try {
      await updateMemory(uid, id, { [field]: newVal });
      // Optimistic update in UI
      setItems((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [field]: newVal } as Memory : m)),
      );
    } catch (e: any) {
      console.error('Update memory error:', e?.message);
      Alert.alert('Error', e?.message ?? 'Could not save your change.');
    }
  };

  const renderItem = ({ item }: { item: Memory }) => {
    return (
      <View style={styles.card}>
        <TextInput
          style={styles.title}
          value={item.label}
          placeholder="Title…"
          onChangeText={(t) => onInlineEdit(item.id, 'label', t)}
        />

        {!!item.value && (
          <Text style={styles.value} numberOfLines={2}>
            {item.value}
          </Text>
        )}

        <TextInput
          style={styles.notes}
          value={item.notes ?? ''}
          placeholder="Notes…"
          multiline
          onChangeText={(t) => onInlineEdit(item.id, 'notes', t)}
        />

        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Kind Tabs */}
      <View style={styles.tabs}>
        {KINDS.map((k) => {
          const active = k === kind;
          return (
            <TouchableOpacity
              key={k}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {k.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Add Form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={label}
          placeholder={`Add a ${kind} title…`}
          onChangeText={setLabel}
        />
        <TextInput
          style={styles.input}
          value={value}
          placeholder={isLink ? 'Paste a link…' : 'Extra value (optional)…'}
          onChangeText={setValue}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          placeholder="Notes (optional)…"
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          disabled={loading}
          style={[styles.addBtn, loading && { opacity: 0.7 }]}
          onPress={onAdd}
        >
          <Text style={styles.addBtnText}>{loading ? 'Saving…' : 'Add memory'}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          Tip: use “LINK” for URLs; “IDEA” for date ideas or gifts you might buy later.
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Loading…' : 'No memories yet.'}</Text>
        }
        renderItem={renderItem}
      />
    </KeyboardAvoidingView>
  );
}

const PURPLE = '#5B58FF';
const RED = '#E44';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#E7E7FF',
  },
  tabActive: { backgroundColor: PURPLE },
  tabText: { color: '#333', fontWeight: '700' },
  tabTextActive: { color: '#fff' },

  form: { padding: 16, gap: 8 },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E3FF',
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  addBtn: {
    marginTop: 4,
    backgroundColor: PURPLE,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800' },
  hint: { marginTop: 6, color: '#6B7280', fontSize: 12 },

  empty: { textAlign: 'center', color: '#777', marginTop: 24 },

  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E6E9FF',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  value: { color: '#333', marginBottom: 6 },
  notes: {
    minHeight: 40,
    textAlignVertical: 'top',
    color: '#444',
    marginBottom: 8,
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FCE7E7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteText: { color: RED, fontWeight: '700' },
});
