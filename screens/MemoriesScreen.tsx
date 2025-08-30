// screens/MemoriesScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  listenMemories,
  scheduleDaily
} from '../utils/memories';

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const uid = user?.uid ?? '';

  const [items, setItems] = useState<Memory[]>([]);
  const [kind, setKind] = useState<MemoryKind>('note');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');

  // Reminder fields
  const [remHour, setRemHour] = useState('9');
  const [remMinute, setRemMinute] = useState('0');
  const [inSeconds, setInSeconds] = useState('30');
  const [dateStr, setDateStr] = useState(''); // yyyy-mm-ddThh:mm (iOS/Android text input)

  useEffect(() => {
    if (!uid) return;
    return listenMemories(uid, setItems);
  }, [uid]);

  const canAdd = useMemo(() => !!uid && label.trim().length > 0, [uid, label]);

  const onAdd = async () => {
    if (!canAdd) return;
    try {
      const payload = {
        ownerId: uid,
        kind,
        label: label.trim(),
        value: notes.trim() || undefined,
        notes: notes.trim() || undefined,
        link: link.trim() || undefined,
      };
      const id = await addMemory(payload);

      // Optional: schedule when kind is reminder
      if (kind === 'reminder') {
        // three demo modes: (pick the one you want in UI later)
        // 1) daily at hour:minute
        const h = Number(remHour) || 9;
        const m = Number(remMinute) || 0;
        await scheduleDaily(h, m, 'Daily Memory Reminder', label.trim());

        // 2) or in X seconds
        // const s = Math.max(1, Number(inSeconds) || 30);
        // await scheduleInSeconds(s, 'Memory Reminder', label.trim());

        // 3) or one-off date (dateStr like 2025-08-30T21:00)
        // if (dateStr) await scheduleOneOff(new Date(dateStr), 'Memory Reminder', label.trim());
      }

      setLabel('');
      setNotes('');
      setLink('');
      Alert.alert('Saved', 'Memory added successfully.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Failed to add memory.');
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteMemory(id);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Delete failed.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Memory Vault</Text>

        {/* Kind selector */}
        <View style={styles.segment}>
          {(['note', 'reminder', 'surprise'] as MemoryKind[]).map((k) => (
            <TouchableOpacity
              key={k}
              style={[styles.segBtn, kind === k && styles.segBtnActive]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.segText, kind === k && styles.segTextActive]}>
                {k.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g., Our first date idea"
            placeholderTextColor="#8C8FA8"
            style={styles.input}
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add some details…"
            placeholderTextColor="#8C8FA8"
            style={[styles.input, styles.area]}
            multiline
          />

          <Text style={styles.label}>Link (optional)</Text>
          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder="https://"
            placeholderTextColor="#8C8FA8"
            autoCapitalize="none"
            style={styles.input}
          />

          {kind === 'reminder' && (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>
                Daily time (HH:MM)
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TextInput
                  value={remHour}
                  onChangeText={setRemHour}
                  keyboardType="number-pad"
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Hour"
                  placeholderTextColor="#8C8FA8"
                />
                <TextInput
                  value={remMinute}
                  onChangeText={setRemMinute}
                  keyboardType="number-pad"
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Minute"
                  placeholderTextColor="#8C8FA8"
                />
              </View>

              <Text style={[styles.hint, { marginTop: 6 }]}>
                (We’ll schedule a daily local notification.)
              </Text>

              {/* Optional alternative inputs you can enable later */}
              {/* <TextInput value={inSeconds} onChangeText={setInSeconds} keyboardType="number-pad" /> */}
              {/* <TextInput value={dateStr} onChangeText={setDateStr} placeholder="2025-12-24T20:00" /> */}
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, !canAdd && { opacity: 0.5 }]}
            disabled={!canAdd}
            onPress={onAdd}
          >
            <Text style={styles.primaryText}>Add memory</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { marginTop: 24 }]}>Your memories</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>No memories yet — add your first one!</Text>
        ) : (
          items.map((m) => (
            <View key={m.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{m.label}</Text>
                <Text style={styles.itemMeta}>
                  {m.kind} • {new Date(m.createdAt ?? Date.now()).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onDelete(m.id)} style={styles.deleteBtn}>
                <Text style={styles.smallBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
  segment: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ECEEFF',
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: '#5B58FF' },
  segText: { fontWeight: '700', color: '#333' },
  segTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#C7C5FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 8 }),
    fontSize: 16,
    color: '#111',
    marginBottom: 12,
  },
  area: { minHeight: 90, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#6B7280' },

  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#5B58FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  empty: { textAlign: 'center', color: '#777', marginTop: 12 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemMeta: { color: '#888', marginTop: 2 },

  deleteBtn: {
    backgroundColor: '#E65050',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 12,
  },
  smallBtnText: { color: '#fff', fontWeight: '700' },
});
