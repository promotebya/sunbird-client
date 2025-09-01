import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import useAuthListener from '../hooks/useAuthListener';
import {
  Memory,
  MemoryKind,
  create as createMemory,
  remove as deleteMemory,
  listByOwner
} from '../utils/memories';

const KINDS: MemoryKind[] = ['idea', 'link', 'gift', 'note'];

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Memory[]>([]);
  const [filterKind, setFilterKind] = useState<MemoryKind | 'all'>('all');

  // form state
  const [kind, setKind] = useState<MemoryKind>('idea');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  // tiny toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  }, []);

  const ownerId = user?.uid ?? '';

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const data = await listByOwner(ownerId);
      setItems(data);
    } catch (e: any) {
      console.error('memories load error', e);
      showToast('Could not load memories');
    } finally {
      setLoading(false);
    }
  }, [ownerId, showToast]);

  useEffect(() => {
    load();
  }, [load]); // ✅ only 1 dependency array (no third arg)

  const filtered = useMemo(() => {
    if (filterKind === 'all') return items;
    return items.filter(m => m.kind === filterKind);
  }, [items, filterKind]);

  const canSubmit = useMemo(() => label.trim().length > 0, [label]);

  const resetForm = () => {
    setKind('idea');
    setLabel('');
    setValue('');
    setNotes('');
  };

  const onCreate = async () => {
    if (!ownerId) return;
    if (!canSubmit) {
      showToast('Add a short title first');
      return;
    }
    try {
      setLoading(true);
      await createMemory(ownerId, {
        kind,
        label: label.trim(),
        value: value.trim() || null,
        notes: notes.trim() || null,
      });
      resetForm();
      Keyboard.dismiss();
      showToast('Saved ✨');
      await load();
    } catch (e: any) {
      console.error('create memory error', e);
      showToast('Save failed');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (m: Memory) => {
    Alert.alert('Delete memory', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMemory(m.id);
            showToast('Deleted');
            await load();
          } catch (e) {
            console.error(e);
            showToast('Delete failed');
          }
        },
      },
    ]);
  };

  const renderKindChip = (k: MemoryKind | 'all') => {
    const active = filterKind === k;
    return (
      <TouchableOpacity
        key={k}
        onPress={() => setFilterKind(k)}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {k === 'all' ? 'all' : k}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <View style={styles.row}>
        {(['all', ...KINDS] as (MemoryKind | 'all')[]).map(renderKindChip)}
      </View>

      {/* Create form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add a memory</Text>

        <View style={styles.row}>
          {KINDS.map(k => {
            const active = kind === k;
            return (
              <TouchableOpacity
                key={k}
                style={[styles.smallBtn, active && styles.smallBtnActive]}
                onPress={() => setKind(k)}
              >
                <Text style={[styles.smallBtnText, active && styles.smallBtnTextActive]}>
                  {k}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          placeholder="Short title (required)"
          value={label}
          onChangeText={setLabel}
          style={styles.input}
        />

        {/* Optional fields vary a bit by kind */}
        {kind === 'link' ? (
          <TextInput
            placeholder="URL (optional)"
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            keyboardType="url"
            style={styles.input}
          />
        ) : null}

        {kind === 'gift' ? (
          <TextInput
            placeholder="Link or store (optional)"
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            style={styles.input}
          />
        ) : null}

        {(kind === 'idea' || kind === 'note') ? (
          <TextInput
            placeholder="Details / notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[styles.input, { height: 88 }]}
          />
        ) : null}

        <TouchableOpacity
          style={[styles.btn, !canSubmit && styles.btnDisabled]}
          onPress={onCreate}
          disabled={!canSubmit || loading}
        >
          <Text style={styles.btnText}>{loading ? 'Saving…' : 'Save memory'}</Text>
        </TouchableOpacity>

        {!canSubmit && <Text style={styles.hint}>Title is required</Text>}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingBottom: 48 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No memories yet. Add your first above 💡
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.label}</Text>
              <Text style={styles.itemMeta}>
                {item.kind}
                {item.value ? ` · ${item.value}` : ''}
              </Text>
              {!!item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
            </View>

            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <TouchableOpacity
                style={[styles.smallBtn, styles.danger]}
                onPress={() => onDelete(item)}
              >
                <Text style={styles.smallBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eee',
  },
  chipActive: { backgroundColor: '#FF92B7' },
  chipText: { color: '#555', fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  cardTitle: { fontWeight: '800', marginBottom: 8, color: '#333' },

  input: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 8,
  },

  btn: {
    backgroundColor: '#E14C7B',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '800' },

  // small action pill (fixes the missing style keys)
  smallBtn: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eee',
  },
  smallBtnActive: { backgroundColor: '#FFD3E1' },
  smallBtnText: { color: '#333', fontWeight: '700', fontSize: 12 },
  smallBtnTextActive: { color: '#111' },

  danger: { backgroundColor: '#E65858' },

  item: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemTitle: { fontWeight: '800', color: '#111' },
  itemMeta: { color: '#777', marginTop: 2 },
  itemNotes: { color: '#444', marginTop: 4 },

  empty: { textAlign: 'center', color: '#888', marginTop: 24 },

  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 20,
  },
  toastText: { color: '#fff', fontWeight: '700' },
});
