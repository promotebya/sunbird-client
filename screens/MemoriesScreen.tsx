// MemoriesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import ConfettiTiny from '../components/ConfettiTiny';
import MemoryShareCard from '../components/MemoryShareCard';
import ProgressBar from '../components/ProgressBar';
import Screen from '../components/Screen';
import { SpotlightAutoStarter, SpotlightTarget, type SpotlightStep } from '../components/spotlight';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import useAuthListener from '../hooks/useAuthListener';
import { timeAgo } from '../utils/date';
import { createMemory, subscribeMemories, type MemoryDoc, type MemoryKind } from '../utils/memories';
import { getPairId } from '../utils/partner';
import { generateFilename, uploadFileToStorage } from '../utils/storage';

type Tab = 'photo' | 'milestone';              // ❌ removed 'text'
type Filter = 'all' | 'photo' | 'milestone';   // ❌ removed 'text'
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
const GOAL = 3;

const HAIRLINE = '#F0E6EF';
const CHIP_BG = '#F3EEF6';

function randid() {
  return `opt_${Math.random().toString(36).slice(2, 9)}`;
}

const MemoriesScreen: React.FC = () => {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);
  const nav = useNavigation<any>();
  const { user } = useAuthListener();
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [tab, setTab] = useState<Tab>('photo');    // 👉 default to 'photo'
  const [filter, setFilter] = useState<Filter>('all');
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

  const memUnsubRef = useRef<(() => void) | null>(null);

  const pairPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshPairId = useCallback(async () => {
    if (!user) {
      setPairId(null);
      return;
    }
    try {
      const pid = await getPairId(user.uid);
      setPairId(pid ?? null);
    } catch {}
  }, [user?.uid]);

  const attachMemListener = useCallback(() => {
    // Clean up any previous listener
    memUnsubRef.current?.();
    memUnsubRef.current = null;

    if (!user || !pairId) {
      setServerItems([]);
      return;
    }

    memUnsubRef.current = subscribeMemories(user.uid, { pairId }, (list) => {
      setServerItems(list);
      setOptimistic((prev) =>
        prev.filter((o) => !list.some((s) => s.clientTag && s.clientTag === o.clientTag))
      );
    });
  }, [user?.uid, pairId]);

  useEffect(() => {
    refreshPairId();
  }, [refreshPairId]);

  // (Re)attach listener on mount/pair change
  useEffect(() => {
    attachMemListener();
    return () => {
      memUnsubRef.current?.();
    };
  }, [attachMemListener]);

  // Re-attach whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      refreshPairId();     // ensure the latest link state
      attachMemListener(); // then (re)attach listener
      return () => {};
    }, [refreshPairId, attachMemListener])
  );

  // Re-attach when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        refreshPairId();
        attachMemListener();
      }
    });
    return () => sub.remove();
  }, [refreshPairId, attachMemListener]);

  useEffect(() => {
    if (!user) return;

    // Already linked? ensure any poll is cleared.
    if (pairId) {
      if (pairPollRef.current) {
        clearInterval(pairPollRef.current);
        pairPollRef.current = null;
      }
      return;
    }

    // Not linked yet → poll a bit so partner flips to linked without reopening
    if (pairPollRef.current) return; // already polling

    let tries = 0;
    pairPollRef.current = setInterval(async () => {
      tries++;
      try {
        const pid = await getPairId(user.uid);
        if (pid) {
          setPairId(pid);
          attachMemListener();
          if (pairPollRef.current) {
            clearInterval(pairPollRef.current);
            pairPollRef.current = null;
          }
          return;
        }
      } catch {}
      if (tries >= 30) { // ~120s at 4s interval
        if (pairPollRef.current) {
          clearInterval(pairPollRef.current);
          pairPollRef.current = null;
        }
      }
    }, 4000);

    return () => {
      if (pairPollRef.current) {
        clearInterval(pairPollRef.current);
        pairPollRef.current = null;
      }
    };
  }, [user?.uid, pairId, attachMemListener]);

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

  const weekCount = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    return items.filter((m) => {
      const d: Date = (m.createdAt as any)?.toDate?.() ?? (m.createdAt as any);
      return d && d >= monday;
    }).length;
  }, [items]);

  // apply timeline filter
  const filteredItems = useMemo(
    () => (filter === 'all' ? items : items.filter((m) => m.kind === filter)),
    [items, filter]
  );

  const canAdd = !!user && !!pairId;

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
    const usesNew = (ImagePicker as any).MediaType != null;
    const media = usesNew ? (ImagePicker as any).MediaType.Images : (ImagePicker as any).MediaTypeOptions.Images;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: media as any,
      quality: 0.9,
      allowsEditing: false,
    } as any);

    if (!res.canceled && (res as any).assets?.length) setImageUri((res as any).assets[0].uri);
  }
  async function captureImage() {
    const ok = await requestCamera();
    if (!ok) return;
    const usesNew = (ImagePicker as any).MediaType != null;
    const media = usesNew ? (ImagePicker as any).MediaType.Images : (ImagePicker as any).MediaTypeOptions.Images;

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: media as any,
      quality: 0.9,
      allowsEditing: false,
    } as any);

    if (!res.canceled && (res as any).assets?.length) setImageUri((res as any).assets[0].uri);
  }

  async function onAdd() {
    if (!user || !pairId) {
      Alert.alert('Link with partner', 'Please link with your partner to add shared memories.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const clientTag = randid();

      if (tab === 'milestone') {
        // ➕ Milestone only
        const tTitle = title.trim();
        const tNote = note.trim();
        if (!tTitle && !tNote) {
          Alert.alert('Oops', 'Please add a title or note first.');
        } else {
          const opt: OptMem = {
            id: clientTag,
            clientTag,
            ownerId: user.uid,
            pairId,
            kind: 'milestone',
            title: tTitle,
            note: tNote,
            photoURL: null,
            createdAt: new Date(),
            optimistic: true,
          };
          setOptimistic((prev) => [opt, ...prev]);
          await createMemory({ ownerId: user.uid, pairId, kind: 'milestone', title: tTitle, note: tNote, clientTag });
          attachMemListener();
          setTitle('');
          setNote('');
        }
      } else {
        // ➕ Photo (optional title/note)
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
          attachMemListener();
          setTitle('');
          setNote('');
          setImageUri(null);
          setUploadProgress(0);
        }
      }
    } catch (e: any) {
      const code = e?.code ?? '';
      const server = e?.serverResponse ?? '';
      const msg =
        code && String(code).startsWith('storage/')
          ? `Storage error (${code}). ${e?.message ?? ''}`
          : e?.message ?? 'Please try again.';
      console.log('Upload/Create error', { code, message: e?.message, server });
      Alert.alert('Could not save', msg.trim());
    } finally {
      setSaving(false);
    }
  }

  // ---------- badges/meta ----------
  const KIND_META: Record<
    MemoryKind,
    { label: string; icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }
  > = {
    photo:     { label: 'Photo',     icon: 'image-outline',               tint: t.colors.primary, bg: withAlpha(t.colors.primary, 0.12) },
    text:      { label: 'Note',      icon: 'chatbubble-ellipses-outline', tint: '#8B5CF6',       bg: withAlpha('#8B5CF6', 0.12) }, // keep for existing items
    milestone: { label: 'Milestone', icon: 'trophy-outline',              tint: '#F59E0B',       bg: withAlpha('#F59E0B', 0.16) },
  };

  const FILTER_META: Record<Filter, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    all:       { label: 'All',       icon: 'apps-outline' },
    photo:     { label: 'Photo',     icon: 'image-outline' },
    milestone: { label: 'Milestone', icon: 'trophy-outline' },
  };

  const ADD_META: Record<Tab, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    photo:     { label: 'Photo',     icon: 'image-outline' },
    milestone: { label: 'Milestone', icon: 'trophy-outline' },
  };

  const renderItem = ({ item, index }: { item: MemoryDoc; index: number }) => {
    const km = KIND_META[item.kind];
    const cacheKey =
      (item as any)?.updatedAt?.seconds ??
      (item as any)?.createdAt?.seconds ??
      Math.floor(Date.now() / 1000);
    const photoURL =
      item.photoURL
        ? item.photoURL.includes('?')
          ? `${item.photoURL}&v=${cacheKey}`
          : `${item.photoURL}?v=${cacheKey}`
        : undefined;
    return (
      <>
        <View style={s.itemHeader}>
          <View style={[s.kindBadge]}>
            <View style={[s.kindIconWrap, { backgroundColor: km.bg }]}>
              <Ionicons name={km.icon} size={14} color={km.tint} />
            </View>
            <ThemedText variant="label" style={{ marginLeft: 6 }}>{km.label}</ThemedText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="time-outline" size={14} color={t.colors.textDim} />
            <ThemedText variant="caption" color={t.colors.textDim} style={{ marginLeft: 4 }}>
              {timeAgo(item.createdAt)}
            </ThemedText>
          </View>
        </View>

        {index === 0 ? (
          <SpotlightTarget id="mem-first-card">
            <Card style={s.timelineCard}>
              <MemoryShareCard
                title={item.title ?? undefined}
                note={item.note ?? undefined}
                photoURL={photoURL}
                {...({ accentColor: t.colors.primary } as any)}
              />
            </Card>
          </SpotlightTarget>
        ) : (
          <Card style={s.timelineCard}>
            <MemoryShareCard
              title={item.title ?? undefined}
              note={item.note ?? undefined}
              photoURL={photoURL}
              {...({ accentColor: t.colors.primary } as any)}
            />
          </Card>
        )}
      </>
    );
  };

  // Tutorial (copy tweaked: photo or milestone)
  const tourSteps = useMemo<SpotlightStep[]>(
    () => [
      { id: 'mem-welcome', targetId: null, title: 'Memories 📸', text: 'Save sweet moments as photos or milestones. Quick 20-second tour?', placement: 'bottom', allowBackdropTapToNext: true },
      { id: 'mem-prompt', targetId: 'mem-prompt-card', title: 'Today’s prompt', text: 'Use these ideas to quickly capture a moment.', placement: 'top', padding: 10 },
      { id: 'mem-shuffle-step', targetId: 'mem-shuffle', title: 'Shuffle', text: 'Tap to get a different idea.', placement: 'top', padding: 10 },
      { id: 'mem-add', targetId: 'mem-add-section', title: 'Add memory', text: 'Create a new memory with a photo or milestone.', placement: 'top', padding: 12 },
    ],
    []
  );

  const goalDone = weekCount >= GOAL;

  return (
    <Screen scroll={false} style={{ paddingBottom: 0 }}>
      {burstKey ? <ConfettiTiny key={burstKey} /> : null}

      <FlatList
        data={filteredItems}
        keyExtractor={(it) => it.id}
        ItemSeparatorComponent={() => <View style={{ height: t.spacing.s }} />}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, marginBottom: -insets.bottom }}
        contentInsetAdjustmentBehavior="never"
        scrollIndicatorInsets={{ top: 0, bottom: tabBarHeight }}
        contentInset={{ bottom: tabBarHeight }}
        contentContainerStyle={{ paddingTop: t.spacing.md, paddingBottom: 0 }}
        ListFooterComponent={<View style={{ height: 0 }} />}
        ListHeaderComponent={
          <>
            <View style={s.headerRow}>
              <ThemedText variant="display">Memories</ThemedText>
              <Button label="Settings" variant="outline" onPress={() => nav.navigate('Settings')} />
            </View>

            {/* Add-type selector (photo | milestone) */}
            <View style={s.segmented}>
              {(['photo', 'milestone'] as const).map((key) => {
                const active = tab === key;
                const meta = ADD_META[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    accessibilityRole="button"
                    style={[s.segment, active && s.segmentActive]}
                  >
                    <View style={s.segInner}>
                      <Ionicons name={meta.icon} size={16} color={active ? t.colors.text : t.colors.textDim} />
                      <ThemedText
                        variant="label"
                        color={active ? t.colors.text : t.colors.textDim}
                        style={{ marginLeft: 6 }}
                        numberOfLines={1}
                      >
                        {meta.label}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <SpotlightTarget id="mem-prompt-card">
              <Card style={{ marginBottom: t.spacing.md }}>
                <View style={s.rowBetween}>
                  <ThemedText variant="subtitle">Today’s prompt</ThemedText>
                  <SpotlightTarget id="mem-shuffle">
                    <Pressable
                      onPress={() => setPromptIdx((i) => (i + 1) % PROMPTS.length)}
                      onLongPress={() => Alert.alert('Shuffle prompts', 'Tap “Shuffle” to get a different idea.')}
                      accessibilityRole="button"
                      accessibilityLabel="Shuffle prompt"
                      accessibilityHint="Tap to get another prompt"
                      style={s.shufflePill}
                    >
                      <ThemedText variant="label" style={{ marginRight: 6 }}>🎲</ThemedText>
                      <ThemedText variant="label" color={t.colors.textDim}>Shuffle</ThemedText>
                    </Pressable>
                  </SpotlightTarget>
                </View>

                <ThemedText variant="title" style={{ marginTop: 6 }}>
                  {PROMPTS[promptIdx]}
                </ThemedText>

                <View style={s.tagWrap}>
                  {QUICK_TAGS.map((tag) => (
                    <Pressable key={tag} onPress={() => setTitle((prev) => (prev ? `${prev} · ${tag}` : tag))} style={s.tag}>
                      <ThemedText variant="label">{tag}</ThemedText>
                    </Pressable>
                  ))}
                </View>

                {/* Weekly goal */}
                <View style={{ marginTop: 12 }}>
                  {goalDone ? (
                    <View style={s.goalDoneBox}>
                      <ThemedText variant="title" style={{ textAlign: 'center' }}>
                        You hit your weekly goal 🎉
                      </ThemedText>
                      <ThemedText variant="caption" color={t.colors.textDim} style={{ textAlign: 'center', marginTop: 4 }}>
                        Keep it going!
                      </ThemedText>
                    </View>
                  ) : (
                    <>
                      <View style={s.rowBetween}>
                        <ThemedText variant="caption" color={t.colors.textDim}>Weekly goal</ThemedText>
                        <ThemedText variant="caption" color={t.colors.textDim}>
                          {weekCount} / {GOAL} · {Math.max(0, GOAL - weekCount)} to go
                        </ThemedText>
                      </View>
                      <ProgressBar value={weekCount} max={GOAL} height={8} trackColor="#EDEAF1" />
                    </>
                  )}
                </View>
              </Card>
            </SpotlightTarget>

            {/* Add section */}
            <SpotlightTarget id="mem-add-section">
              <Card>
                {!pairId ? (
                  <>
                    <ThemedText variant="title">Share memories together</ThemedText>
                    <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 6 }}>
                      Link with your partner to create a shared timeline.
                    </ThemedText>
                    <View style={{ marginTop: 10 }}>
                      <Button label="Link now" onPress={() => nav.navigate('Pairing')} />
                    </View>
                  </>
                ) : tab === 'photo' ? (
                  <>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={s.preview} />
                    ) : (
                      <View style={s.photoPickRow}>
                        <Button label="Pick from library" variant="outline" onPress={pickImage} />
                        <Button label="Use camera" variant="outline" onPress={captureImage} />
                      </View>
                    )}

                    {uploadProgress > 0 && uploadProgress < 1 && (
                      <View style={s.progressRow}>
                        <ActivityIndicator />
                        <ThemedText variant="caption" style={{ marginLeft: t.spacing.xs }}>
                          Uploading… {Math.round(uploadProgress * 100)}%
                        </ThemedText>
                      </View>
                    )}

                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Title (optional)"
                      placeholderTextColor={t.colors.textDim}
                      style={[s.input, { marginTop: t.spacing.s }]}
                    />
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Note (optional)"
                      placeholderTextColor={t.colors.textDim}
                      style={[s.input, { marginTop: t.spacing.s }]}
                    />
                    <Button
                      label={saving ? 'Saving…' : 'Add'}
                      onPress={onAdd}
                      style={{ marginTop: t.spacing.md }}
                      disabled={!canAdd || saving}
                    />
                  </>
                ) : (
                  <>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Milestone title"
                      placeholderTextColor={t.colors.textDim}
                      style={s.input}
                      editable={!!pairId}
                    />
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Add a note (optional)"
                      placeholderTextColor={t.colors.textDim}
                      style={[s.input, { marginTop: t.spacing.s }]}
                      multiline
                      editable={!!pairId}
                    />
                    <Button
                      label={saving ? 'Saving…' : 'Add'}
                      onPress={onAdd}
                      style={{ marginTop: t.spacing.md }}
                      disabled={!canAdd || saving}
                    />
                  </>
                )}
              </Card>
            </SpotlightTarget>

            {/* Timeline filter (all | photo | milestone) */}
            <Card style={{ marginTop: t.spacing.md }}>
              <ThemedText variant="subtitle" style={{ marginBottom: 8 }}>Show</ThemedText>
              <View style={s.segmented}>
                {(['all', 'photo', 'milestone'] as const).map((key) => {
                  const active = filter === key;
                  const meta = FILTER_META[key];
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setFilter(key)}
                      accessibilityRole="button"
                      style={[s.segment, active && s.segmentActive]}
                    >
                      <View style={s.segInner}>
                        <Ionicons name={meta.icon} size={16} color={active ? t.colors.text : t.colors.textDim} />
                        <ThemedText
                          variant="label"
                          color={active ? t.colors.text : t.colors.textDim}
                          style={{ marginLeft: 6 }}
                          numberOfLines={1}
                        >
                          {meta.label}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </>
        }
        ListEmptyComponent={
          <SpotlightTarget id="mem-empty">
            <View style={s.empty}>
              <ThemedText variant="title">No memories yet</ThemedText>
              <ThemedText variant="subtitle" style={{ marginTop: t.spacing.xs }}>
                Capture something small from today.
              </ThemedText>
            </View>
          </SpotlightTarget>
        }
      />
      <SpotlightAutoStarter uid={user?.uid ?? null} steps={tourSteps} persistKey="memories-first-run" />
    </Screen>
  );
};

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },

    // Segmented controls (chips)
    segmented: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    segment: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: CHIP_BG,
      borderWidth: 1,
      borderColor: HAIRLINE,
      minWidth: 0,
    },
    segmentActive: {
      backgroundColor: '#FFFFFF',
      borderColor: HAIRLINE,
      shadowColor: 'rgba(16,24,40,0.08)',
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    segInner: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },

    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

    shufflePill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: HAIRLINE,
      shadowColor: 'rgba(16,24,40,0.06)',
      shadowOpacity: 1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: t.spacing.s },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: CHIP_BG,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },

    input: {
      minHeight: 44,
      paddingVertical: t.spacing.s,
      paddingHorizontal: t.spacing.md,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: HAIRLINE,
      color: t.colors.text,
    },
    photoPickRow: { flexDirection: 'row', gap: 8 },
    preview: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover' },
    progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: t.spacing.s },

    // Timeline item chrome
    itemHeader: {
      paddingHorizontal: t.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: t.spacing.xs,
    },
    kindBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    kindIconWrap: {
      width: 20,
      height: 20,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timelineCard: {
      overflow: 'hidden',
      shadowColor: 'rgba(16,24,40,0.06)',
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    empty: { paddingVertical: t.spacing.lg, alignItems: 'center' },
    goalDoneBox: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: HAIRLINE,
      shadowColor: 'rgba(16,24,40,0.06)',
      shadowOpacity: 1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
  });

export default MemoriesScreen;