import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import ConfettiTiny from '../components/ConfettiTiny';
import MemoryShareCard from '../components/MemoryShareCard';
import sharedStyles from '../components/sharedStyles';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';

import useAuthListener from '../hooks/useAuthListener';
import { timeAgo } from '../utils/date';
import { createMemory, subscribeMemories, type MemoryDoc, type MemoryKind } from '../utils/memories';
import { getPairId } from '../utils/partner';
import { generateFilename, uploadFileToStorage } from '../utils/storage';

type Tab = 'photo' | 'text' | 'milestone';
type OptMem = MemoryDoc & { optimistic?: true };

const PROMPTS = [
  'What made you smile today?',
  'A tiny win we had',
  'Something new we tried',
  'A cozy moment we shared',
  'An inside joke from today',
  'A proud moment',
];

const QUICK_TAGS = ['Walk', 'Coffee', 'Cozy night', 'Movie', 'Homemade meal', 'Sunset'];

function randid() {
  return `opt_${Math.random().toString(36).slice(2, 9)}`;
}

const MemoriesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthListener();
  const [tab, setTab] = useState<Tab>('text');

  const [pairId, setPairId] = useState<string | null>(null);
  const [serverItems, setServerItems] = useState<MemoryDoc[]>([]);
  const [optimistic, setOptimistic] = useState<OptMem[]>([]);

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [burstKey, setBurstKey] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const GOAL = 3;

  useEffect(() => {
    (async () => {
      if (!user) return setPairId(null);
      const pid = await getPairId(user.uid);
      setPairId(pid ?? null);
    })();
  }, [user]);

  // Subscribe to shared (pairId) memories
  useEffect(() => {
    if (!user) return;
    if (!pairId) {
      setServerItems([]);
      return;
    }
    const unsub = subscribeMemories(user.uid, { pairId }, (list) => {
      setServerItems(list);
      setOptimistic((prev) =>
        prev.filter((o) => !list.some((s) => s.clientTag && s.clientTag === o.clientTag))
      );
    });
    return () => unsub && unsub();
  }, [user, pairId]);

  // First real memory confetti (per pair)
  useEffect(() => {
    if (!pairId) return;
    const KEY = `lp:first-memory-pair:${pairId}`;
    (async () => {
      if (serverItems.length > 0) {
        const seen = await AsyncStorage.getItem(KEY);
        if (!seen) {
          setBurstKey(Date.now());
          await AsyncStorage.setItem(KEY, '1');
        }
      }
    })();
  }, [serverItems.length, pairId]);

  const items: MemoryDoc[] = [...optimistic, ...serverItems];

  // Weekly progress
  const weekCount = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = (now.getDay() + 6) % 7; // Mon=0
    monday.setDate(now.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    return items.filter((m) => {
      const d: Date = (m.createdAt as any)?.toDate?.() ?? (m.createdAt as any);
      return d && d >= monday;
    }).length;
  }, [items]);

  const progressPct = Math.min(100, (weekCount / GOAL) * 100);
  const canAdd = !!user && !!pairId; // shared-only

  async function requestLibrary() {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please allow photo access to pick a memory photo.',
        canAskAgain
          ? [{ text: 'OK' }]
          : [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
      );
      return false;
    }
    return true;
  }

  async function requestCamera() {
    const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please allow camera access to capture a memory.',
        canAskAgain
          ? [{ text: 'OK' }]
          : [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
      );
      return false;
    }
    return true;
  }

  async function pickImage() {
    const ok = await requestLibrary();
    if (!ok) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets?.length) setImageUri(res.assets[0].uri);
  }

  async function captureImage() {
    const ok = await requestCamera();
    if (!ok) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: false });
    if (!res.canceled && res.assets?.length) setImageUri(res.assets[0].uri);
  }

  async function onAdd() {
    if (!user || !pairId) {
      Alert.alert('Link with partner', 'Please link with your partner to add shared memories.');
      return;
    }
    setSaving(true);
    try {
      const clientTag = randid();
      if (tab === 'text' || tab === 'milestone') {
        const kind: MemoryKind = tab;
        const t = title.trim();
        const n = note.trim();
        if (!t && !n) {
          Alert.alert('Oops', 'Please add a title or note first.');
        } else {
          const opt: OptMem = {
            id: clientTag,
            clientTag,
            ownerId: user.uid,
            pairId,
            kind,
            title: t,
            note: n,
            photoURL: null,
            createdAt: new Date(),
            optimistic: true,
          };
          setOptimistic((prev) => [opt, ...prev]);
          await createMemory({ ownerId: user.uid, pairId, kind, title: t, note: n, clientTag });
          setTitle('');
          setNote('');
        }
      } else if (tab === 'photo') {
        if (!imageUri) {
          Alert.alert('Pick or capture a photo', 'Choose or capture a photo to upload.');
        } else {
          const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
          const filename = generateFilename(ext);
          const path = `images/${user.uid}/memories/${filename}`;
          const url = await uploadFileToStorage(imageUri, path, setUploadProgress);

          const opt: OptMem = {
            id: clientTag,
            clientTag,
            ownerId: user.uid,
            pairId,
            kind: 'photo',
            title: title.trim(),
            note: note.trim(),
            photoURL: url,
            createdAt: new Date(),
            optimistic: true,
          };
          setOptimistic((prev) => [opt, ...prev]);
          await createMemory({
            ownerId: user.uid,
            pairId,
            kind: 'photo',
            title: title.trim(),
            note: note.trim(),
            photoURL: url,
            clientTag,
          });
          setTitle('');
          setNote('');
          setImageUri(null);
          setUploadProgress(0);
        }
      }
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const renderItem = ({ item }: { item: MemoryDoc }) => (
    <>
      <View style={styles.itemHeader}>
        <View
          style={[
            styles.kindPill,
            item.kind === 'photo' && styles.kindPhoto,
            item.kind === 'milestone' && styles.kindMilestone,
          ]}
        >
          <ThemedText variant="label" color={tokens.colors.buttonTextPrimary}>
            {item.kind}
          </ThemedText>
        </View>
        <ThemedText variant="caption" color={tokens.colors.textDim}>
          {timeAgo(item.createdAt)}
        </ThemedText>
      </View>

      <Card>
        <MemoryShareCard
          title={item.title ?? undefined}
          note={item.note ?? undefined}
          photoURL={item.photoURL ?? undefined}
        />
      </Card>
    </>
  );

  return (
    <SafeAreaView style={[sharedStyles.screen, { paddingTop: tokens.spacing.md }]} edges={['top', 'left', 'right']}>
      {burstKey ? <ConfettiTiny key={burstKey} /> : null}

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        {/* Header & tabs */}
        <View style={styles.header}>
          <ThemedText variant="display">Memories</ThemedText>
          <View style={styles.tabs}>
            {(['photo', 'text', 'milestone'] as Tab[]).map((t) => {
              const active = tab === t;
              return (
                <Pressable key={t} onPress={() => setTab(t)} style={[styles.chip, active && styles.chipActive]}>
                  <ThemedText
                    variant="label"
                    color={active ? tokens.colors.buttonTextPrimary : tokens.colors.textDim}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Prompt + quick tags + weekly goal */}
        <Card style={{ marginBottom: tokens.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText variant="h2">Today’s prompt</ThemedText>
            <Pressable onPress={() => setPromptIdx((i) => (i + 1) % PROMPTS.length)} style={styles.dice}>
              <ThemedText variant="label">🎲</ThemedText>
            </Pressable>
          </View>
          <ThemedText variant="body" color={tokens.colors.textDim} style={{ marginTop: 6 }}>
            {PROMPTS[promptIdx]}
          </ThemedText>

          <View style={styles.tagWrap}>
            {QUICK_TAGS.map((t) => (
              <Pressable key={t} onPress={() => setTitle((prev) => (prev ? `${prev} · ${t}` : t))} style={styles.tag}>
                <ThemedText variant="label">{t}</ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={{ marginTop: tokens.spacing.md }}>
            <ThemedText variant="label" color={tokens.colors.textDim}>
              Weekly goal · {weekCount}/{GOAL}
            </ThemedText>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, progressPct)}%` }]} />
            </View>
          </View>
        </Card>

        {/* Add memory */}
        <Card>
          {!pairId ? (
            <>
              <ThemedText variant="title">Share memories together</ThemedText>
              <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 6 }}>
                Link with your partner to create a shared timeline.
              </ThemedText>
              <Pressable
                onPress={() => Alert.alert('Link', 'Go to the pairing screen in settings to link.')}
                style={styles.addBtn}
              >
                <ThemedText variant="button" color="#fff">Link now</ThemedText>
              </Pressable>
            </>
          ) : tab === 'photo' ? (
            <>
              {imageUri ? (
                <Image source={{ uri: imageUri as string }} style={styles.preview} />
              ) : (
                <View style={styles.photoPickRow}>
                  <Pressable onPress={pickImage} style={styles.photoStub}>
                    <ThemedText variant="subtitle" color={tokens.colors.textDim}>
                      Pick from library
                    </ThemedText>
                  </Pressable>
                  <Pressable onPress={captureImage} style={styles.photoStub}>
                    <ThemedText variant="subtitle" color={tokens.colors.textDim}>
                      Use camera
                    </ThemedText>
                  </Pressable>
                </View>
              )}
              {uploadProgress > 0 && uploadProgress < 1 && (
                <View style={styles.progressRow}>
                  <ActivityIndicator />
                  <ThemedText variant="caption" style={{ marginLeft: tokens.spacing.xs }}>
                    Uploading… {Math.round(uploadProgress * 100)}%
                  </ThemedText>
                </View>
              )}
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title (optional)"
                placeholderTextColor={tokens.colors.textDim}
                style={[styles.input, { marginTop: tokens.spacing.s }]}
              />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Note (optional)"
                placeholderTextColor={tokens.colors.textDim}
                style={[styles.input, { marginTop: tokens.spacing.s }]}
              />
              <Button label={saving ? 'Saving…' : 'Add'} onPress={onAdd} style={{ marginTop: tokens.spacing.md }} disabled={!canAdd || saving} />
            </>
          ) : (
            <>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={tab === 'text' ? 'Title' : 'Milestone title'}
                placeholderTextColor={tokens.colors.textDim}
                style={styles.input}
                editable={!!pairId}
              />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={tokens.colors.textDim}
                style={[styles.input, { marginTop: tokens.spacing.s }]}
                multiline
                editable={!!pairId}
              />
              <Button label={saving ? 'Saving…' : 'Add'} onPress={onAdd} style={{ marginTop: tokens.spacing.md }} disabled={!canAdd || saving} />
            </>
          )}
        </Card>

        {/* Timeline */}
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingVertical: tokens.spacing.md, paddingBottom: insets.bottom + tokens.spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.s }} />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText variant="title">No memories yet</ThemedText>
              <ThemedText variant="subtitle" style={{ marginTop: tokens.spacing.xs }}>
                Capture something small from today.
              </ThemedText>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.md, paddingBottom: tokens.spacing.s },
  tabs: { flexDirection: 'row', gap: tokens.spacing.s as number, marginTop: tokens.spacing.s },
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: tokens.colors.card,
  },
  chipActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  input: {
    minHeight: 44,
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: tokens.colors.text,
  },
  photoPickRow: { flexDirection: 'row', gap: tokens.spacing.s as number },
  photoStub: {
    flex: 1,
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: tokens.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: tokens.spacing.s },
  empty: { paddingVertical: tokens.spacing.lg, alignItems: 'center' },

  itemHeader: {
    paddingHorizontal: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
  },
  kindPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6' },
  kindPhoto: { backgroundColor: '#DBEAFE' },
  kindMilestone: { backgroundColor: '#FEF3C7' },

  // fun bits
  dice: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F3F4F6' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: tokens.spacing.s },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#ECEFF3' },
  track: { height: 10, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden', marginTop: 8 },
  fill: { height: 10, borderRadius: 999, backgroundColor: tokens.colors.primary },

  // ✅ missing before
  addBtn: {
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
  },
});

export default MemoriesScreen;
