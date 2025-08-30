// screens/MemoriesScreen.tsx
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

import useAuthListener from '../hooks/useAuthListener'; // default export returning { user, loading }
import type { Memory, MemoryKind } from '../types';
import { addMemory, deleteMemory, listenMemories } from '../utils/memories';

type TabKey = MemoryKind | 'all';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'favorite', label: 'Favorites' },
  { key: 'size', label: 'Sizes' },
  { key: 'allergy', label: 'Allergies' },
  { key: 'date', label: 'Dates' },
  { key: 'gift', label: 'Gifts' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'note', label: 'Notes' },
];

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const ownerId = user?.uid ?? '';
  const [tab, setTab] = useState<TabKey>('all');
  const [items, setItems] = useState<Memory[]>([]);

  // form state
  const [kind, setKind] = useState<MemoryKind>('favorite');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [dateText, setDateText] = useState('');
  const [remindText, setRemindText] = useState('');

  const unsubRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!ownerId) return;
    unsubRef.current?.();
    unsubRef.current = listenMemories(ownerId, { kind: tab }, setItems);
    return () => unsubRef.current?.();
  }, [ownerId, tab]);

  const canSubmit = useMemo(() => !!ownerId && !!label.trim(), [ownerId, label]);

  const parseDate = (s: string): Date | null => {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  };

  const onAdd = async () => {
    try {
      if (!canSubmit) return;

      const date = parseDate(dateText) ?? undefined;
      const remindOn = parseDate(remindText) ?? undefined;

      const id = await addMemory(ownerId, {
        kind,
        label: label.trim(),
        value: value.trim(),
        notes: notes.trim(),
        link: link.trim(),
        date,
        remindOn,
      });

      // Expo SDK 52+ trigger types:
      if (remindOn) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Remember 💜', body: label.trim(), sound: true },
          trigger: { type: 'date', date: remindOn },
        });
      }

      setLabel('');
      setValue('');
      setNotes('');
      setLink('');
      setDateText('');
      setRemindText('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    }
  };

  const onQuickRemind = async (m: Memory) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Quick reminder 💌', body: m.label, sound: true },
        trigger: { type: 'timeInterval', seconds: 24 * 60 * 60, repeats: false },
      });
      Alert.alert('Scheduled', 'We’ll remind you in ~24 hours.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    }
  };

  const onDelete = (m: Memory) => {
    Alert.alert('Delete memory', `Delete “${m.label}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMemory(m.id);
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? String(e));
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Memory }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{item.label}</Text>
        {!!item.value && <Text style={styles.cardMeta}>{item.value}</Text>}
        {!!item.notes && <Text style={styles.cardMeta}>{item.notes}</Text>}
        {!!item.link && <Text style={styles.cardMeta}>{item.link}</Text>}
        {!!item.date && (
          <Text style={styles.cardMeta}>Date: {item.date.toISOString().slice(0, 10)}</Text>
        )}
        {!!item.remindOn && (
          <Text style={styles.cardMeta}>
            Reminder: {item.remindOn.toISOString().slice(0, 10)}
          </Text>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.smallBtn, styles.remindBtn]}
          onPress={() => onQuickRemind(item)}
        >
          <Text style={styles.smallBtnText}>Remind</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallBtn, styles.deleteBtn]}
          onPress={() => onDelete(item)}
        >
          <Text style={styles.smallBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <Text style={styles.h1}>Memories</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add form */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add new</Text>

          <View style={styles.kindsRow}>
            {TABS.filter((t) => t.key !== 'all')
              .slice(0, 6)
              .map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.kindPill, kind === t.key && styles.kindPillActive]}
                  onPress={() => setKind(t.key as MemoryKind)}
                >
                  <Text style={[styles.kindText, kind === t.key && styles.kindTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Label (e.g., Favorite sushi, Ring size, Allergic to...)"
            value={label}
            onChangeText={setLabel}
          />
          <TextInput
            style={styles.input}
            placeholder="Value (e.g., salmon nigiri, EU 54, peanuts)"
            value={value}
            onChangeText={setValue}
          />
          <TextInput
            style={styles.input}
            placeholder="Link (optional)"
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
          />

          <TextInput
            style={styles.input}
            placeholder="Date YYYY-MM-DD (optional)"
            value={dateText}
            onChangeText={setDateText}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Reminder YYYY-MM-DD (optional)"
            value={remindText}
            onChangeText={setRemindText}
            autoCapitalize="none"
          />

          <TouchableOpacity
            disabled={!canSubmit}
            onPress={onAdd}
            style={[styles.addBtn, !canSubmit && { opacity: 0.5 }]}
          >
            <Text style={styles.addBtnText}>Save memory</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>No memories yet — add your first one!</Text>
        ) : (
          <FlatList
            style={{ marginTop: 12 }}
            data={items}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  h1: { fontSize: 28, fontWeight: '800', marginBottom: 8 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F1EFFF',
    padding: 4,
    borderRadius: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 6, marginTop: 6 },
  tabActive: { backgroundColor: '#5B58FF' },
  tabText: { fontWeight: '700', color: '#444' },
  tabTextActive: { color: '#fff' },

  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  kindsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  kindPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#EFEFFF' },
  kindPillActive: { backgroundColor: '#DAD7FF' },
  kindText: { fontSize: 12, fontWeight: '700', color: '#444' },
  kindTextActive: { color: '#222' },

  input: {
    borderWidth: 1,
    borderColor: '#CFCFEA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },

  addBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '800' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EEE',
    flexDirection: 'row',
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardMeta: { color: '#666', marginTop: 2, fontSize: 13 },
  cardActions: { justifyContent: 'center', alignItems: 'flex-end', gap: 8 },

  smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  remindBtn: { backgroundColor: '#4E9C5F' },
  deleteBtn: { backgroundColor: '#E65050' },

  empty: { textAlign: 'center', marginTop: 24, color: '#777' },
});
