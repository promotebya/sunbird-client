// screens/MemoriesScreen.tsx
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useThemeColor } from '../hooks/useThemeColor';

import {
  createMemory,
  deleteMemory,
  listenMine,
  updateMemory,
  type CreateMemoryInput,
  type Memory,
} from '../utils/memories';

import { type MemoryKind } from '../types'; // assuming this exists in your project

const DEFAULT_KIND: MemoryKind = 'idea'; // pick one to show by default

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const colors = useThemeColor();

  // --- UI state (always strings for TextInput) ---
  const [kind, setKind] = useState<MemoryKind>(DEFAULT_KIND);
  const [label, setLabel] = useState<string>(''); // was possibly string|null before
  const [notes, setNotes] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- data ---
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // friendly ephemeral toast
  const [toast, setToast] = useState<string>('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // confetti ping on add
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // subscribe to my memories
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = listenMine(user.uid, (rows) => {
      setItems(rows);
      setLoading(false);
    }, { kind }); // if your listenMine supports filter object; otherwise remove
    return () => unsub && unsub();
  }, [user?.uid, kind]);

  // cleanup timers
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  const canSubmit = useMemo(() => label.trim().length > 0, [label]);

  function flashToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1600);
  }

  function pingConfetti() {
    setShowConfetti(true);
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setShowConfetti(false), 800);
  }

  function resetForm() {
    setLabel('');
    setNotes('');
    setUrl('');
    setEditingId(null);
  }

  async function handleCreate() {
    if (!user?.uid) return;
    const clean = label.trim();
    if (!clean) {
      flashToast('Please enter something 💡');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      const payload: CreateMemoryInput = {
        ownerId: user.uid,
        kind,
        label: clean,
        notes: notes.trim() ? notes.trim() : null,
        url: url.trim() ? url.trim() : null,
        // pairId: null // include if you have one available
      };
      await createMemory(payload);
      resetForm();
      pingConfetti();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      flashToast('Saved ✨');
      Keyboard.dismiss();
    } catch (err) {
      console.error(err);
      flashToast('Could not save');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    const clean = label.trim();
    if (!clean) {
      flashToast('Please enter something 💡');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      await updateMemory(editingId, {
        label: clean,
        notes: notes.trim() ? notes.trim() : null,
        url: url.trim() ? url.trim() : null,
        kind,
      });
      resetForm();
      flashToast('Updated ✓');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Keyboard.dismiss();
    } catch (err) {
      console.error(err);
      flashToast('Could not update');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Delete memory?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMemory(id);
            flashToast('Deleted');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (err) {
            console.error(err);
            flashToast('Could not delete');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
      },
    ]);
  }

  function startEdit(m: Memory) {
    // Use label first, fallback to value (for backward compat)
    setLabel(m.label ?? (m as any).value ?? '');
    setNotes(m.notes ?? '');
    setUrl(m.url ?? '');
    setKind(m.kind);
    setEditingId(m.id);
  }

  const renderItem = ({ item }: { item: Memory }) => {
    const title = item.label ?? (item as any).value ?? '';
    return (
      <TouchableOpacity
        style={styles.card}
        onLongPress={() => startEdit(item)}
        delayLongPress={180}
      >
        <Text style={styles.cardTitle}>{title}</Text>
        {!!item.notes && <Text style={styles.cardText}>{item.notes}</Text>}
        {!!item.url && (
          <Text style={[styles.cardText, { textDecorationLine: 'underline' }]}>
            {item.url}
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#EEE' }]} onPress={() => startEdit(item)}>
            <Text style={[styles.smallBtnText, { color: '#333' }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#E65B50' }]} onPress={() => confirmDelete(item.id)}>
            <Text style={[styles.smallBtnText, { color: '#fff' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={styles.header}>Memories</Text>

      {/* quick kind chips */}
      <View style={styles.kindsRow}>
        {(['idea', 'link', 'gift', 'note'] as MemoryKind[]).map((k) => {
          const active = k === kind;
          return (
            <TouchableOpacity
              key={k}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{k}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* input card */}
      <View style={styles.inputCard}>
        <TextInput
          style={styles.input}
          placeholder={`Add a ${kind}…`}
          placeholderTextColor="#999"
          value={label}                     // <- always string
          onChangeText={setLabel}
          returnKeyType="done"
        />

        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Notes (optional)…"
          placeholderTextColor="#999"
          value={notes}                     // <- always string
          onChangeText={setNotes}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder={kind === 'link' ? 'https://…' : 'Related link (optional)…'}
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={url}                       // <- always string
          onChangeText={setUrl}
        />

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          {editingId ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#5B85FF' }]}
                onPress={handleUpdate}
                disabled={!canSubmit}
              >
                <Text style={styles.actionText}>Update</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#ccc' }]}
                onPress={resetForm}
              >
                <Text style={[styles.actionText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: canSubmit ? '#5B85FF' : '#AAB7FF' }]}
              onPress={handleCreate}
              disabled={!canSubmit}
            >
              <Text style={styles.actionText}>Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* list */}
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No memories yet — add your first ✨</Text> : null
        }
      />

      {/* tiny toast */}
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* tiny confetti glyph */}
      {showConfetti ? (
        <View style={styles.confettiWrap}>
          <Text style={styles.confetti}>🎉</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  header: { fontSize: 24, fontWeight: '800', marginBottom: 12, color: '#222' },

  kindsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: '#5B85FF', borderColor: '#5B85FF' },
  chipText: { color: '#333', fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F7F7F8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#222',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontWeight: '800' },

  empty: { textAlign: 'center', color: '#888', marginTop: 24 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 12,
  },
  cardTitle: { fontWeight: '800', marginBottom: 6, color: '#333' },
  cardText: { color: '#555' },

  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 10,
    zIndex: 20,
  },
  toastText: { color: '#fff', fontWeight: '700', textAlign: 'center' },

  confettiWrap: { position: 'absolute', top: 56, right: 16, zIndex: 19 },
  confetti: { fontSize: 24 },
});
