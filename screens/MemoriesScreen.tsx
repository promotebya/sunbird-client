// screens/MemoriesScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import useAuthListener from '../hooks/useAuthListener';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  createMemory,
  deleteMemory,
  listByOwner,
  Memory,
  MemoryKind,
  updateMemory,
} from '../utils/memories';

const KINDS: { key: MemoryKind; label: string; emoji: string }[] = [
  { key: 'idea', label: 'Ideas', emoji: '💡' },
  { key: 'link', label: 'Links', emoji: '🔗' },
  { key: 'gift', label: 'Gifts', emoji: '🎁' },
  { key: 'note', label: 'Notes', emoji: '📝' },
];

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const tint = useThemeColor({}, 'tint');
  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Memory[]>([]);
  const [filter, setFilter] = useState<MemoryKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<{ id?: string; kind: MemoryKind; label: string; value: string; notes?: string }>({
    kind: 'note',
    label: '',
    value: '',
    notes: '',
  });

  // Load
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      if (!user?.uid) return;
      setLoading(true);
      // simple one-shot load (swap to realtime if you prefer)
      const rows = await listByOwner(user.uid);
      setItems(rows);
      setLoading(false);
    })();
    return () => unsub?.();
  }, [user?.uid]);

  const filtered = useMemo(() => {
    const f = filter === 'all' ? items : items.filter(i => i.kind === filter);
    if (!query.trim()) return f;
    const q = query.trim().toLowerCase();
    return f.filter(i =>
      [i.label, i.value, i.notes || ''].some(s => s?.toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  function openNew(kind?: MemoryKind) {
    setDraft({ id: undefined, kind: kind ?? 'note', label: '', value: '', notes: '' });
    setModalOpen(true);
  }

  function openEdit(m: Memory) {
    setDraft({ id: m.id, kind: m.kind, label: m.label, value: m.value, notes: m.notes ?? '' });
    setModalOpen(true);
  }

  async function saveDraft() {
    if (!user?.uid) return;
    const payload = {
      ownerId: user.uid,
      kind: draft.kind,
      label: draft.label.trim(),
      value: draft.value.trim(),
      notes: (draft.notes ?? '').trim(),
    };
    if (!payload.label || !payload.value) {
      Alert.alert('Missing info', 'Please fill in label and value.');
      return;
    }
    try {
      if (draft.id) {
        await updateMemory(draft.id, payload);
        setItems(prev => prev.map(i => (i.id === draft.id ? { ...i, ...payload } as Memory : i)));
      } else {
        const id = await createMemory(payload);
        setItems(prev => [{ id, createdAt: Date.now(), ...payload } as Memory, ...prev]);
      }
      setModalOpen(false);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    }
  }

  async function confirmDelete(id: string) {
    Alert.alert('Delete memory?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMemory(id);
            setItems(prev => prev.filter(i => i.id !== id));
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message ?? 'Unknown error');
          }
        },
      },
    ]);
  }

  const renderItem = ({ item }: { item: Memory }) => (
    <View style={[styles.card, { backgroundColor: '#ffffffcc' }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.kind, { color: textColor }]}>
          {KINDS.find(k => k.key === item.kind)?.emoji} {item.label}
        </Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => openEdit(item)} style={[styles.smallBtn, { backgroundColor: tint }]}>
            <Text style={styles.smallBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(item.id)} style={[styles.smallBtn, { backgroundColor: '#e65b50' }]}>
            <Text style={styles.smallBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={[styles.value]} numberOfLines={3}>
        {item.value}
      </Text>
      {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      {/* rose-ish soft background */}
      <View style={styles.roseBg} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Memory Vault</Text>
        </View>

        <View style={styles.controls}>
          <View style={styles.filters}>
            <Chip
              label="All"
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            {KINDS.map(k => (
              <Chip
                key={k.key}
                label={`${k.emoji} ${k.label}`}
                active={filter === k.key}
                onPress={() => setFilter(k.key)}
              />
            ))}
          </View>

          <TextInput
            placeholder="Search memories…"
            placeholderTextColor="#8b8b8b"
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />

          <View style={styles.quickRow}>
            {KINDS.map(k => (
              <TouchableOpacity
                key={k.key}
                style={[styles.quickAddBtn]}
                onPress={() => openNew(k.key)}
              >
                <Text style={styles.quickAddText}>{k.emoji} Add {k.label.slice(0, -1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {loading ? 'Loading…' : 'Nothing here yet — add your first memory!'}
            </Text>
          }
        />
      </KeyboardAvoidingView>

      {/* Add/Edit Modal */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalWrap} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{draft.id ? 'Edit memory' : 'New memory'}</Text>

            <View style={styles.rowWrap}>
              {KINDS.map(k => (
                <Chip
                  key={k.key}
                  label={k.emoji + ' ' + k.label}
                  active={draft.kind === k.key}
                  onPress={() => setDraft((d) => ({ ...d, kind: k.key }))}
                />
              ))}
            </View>

            <TextInput
              placeholder="Label (e.g., Restaurant, Idea title)"
              value={draft.label}
              onChangeText={(label) => setDraft((d) => ({ ...d, label }))}
              style={styles.input}
            />
            <TextInput
              placeholder={draft.kind === 'link' ? 'URL' : 'Main content'}
              value={draft.value}
              onChangeText={(value) => setDraft((d) => ({ ...d, value }))}
              style={[styles.input, { height: 48 }]}
              autoCapitalize="none"
            />
            <TextInput
              placeholder="Notes (optional)"
              value={draft.notes}
              onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
              style={[styles.input, { height: 80 }]}
              multiline
            />

            <View style={styles.row}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e65b50' }]} onPress={() => setModalOpen(false)}>
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tint }]} onPress={saveDraft}>
                <Text style={styles.actionText}>{draft.id ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/** Small pill chip */
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? '#f8d7e2' : '#f1f1f1', borderColor: active ? '#e56a8a' : '#d0d0d0' },
      ]}
    >
      <Text style={{ color: active ? '#b03c5c' : '#444' }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  roseBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffeaf1',
  },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: '800' },
  controls: { paddingHorizontal: 16, paddingBottom: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAddBtn: {
    backgroundColor: '#ffd3e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  quickAddText: { fontWeight: '600', color: '#8a2a4b' },

  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  kind: { fontWeight: '800', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  value: { fontSize: 15, color: '#333' },
  notes: { marginTop: 6, color: '#666' },

  empty: { textAlign: 'center', color: '#777', marginTop: 28 },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    height: 44,
  },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '800' },
});
