import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import useAuthListener from '../hooks/useAuthListener';
import { create as createNote, listByKind, Note, NoteKind, remove as removeNote } from '../utils/notes';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NOTE_KINDS: NoteKind[] = [
  'loveNote',
  'favoriteFood',
  'habit',
  'place',
  'appreciation',
  'insideJoke',
  'gratitude',
  'memorySnippet',
];

// quick romantic chips (tap to insert)
const PROMPTS: string[] = [
  'You made my day 💗',
  '3 things I love about you…',
  'Coffee & cuddles soon?',
  'A tiny love note for my favorite person ✨',
  'Thank you for being you.',
];

export default function LoveNotesScreen() {
  const { user } = useAuthListener();
  const ownerId = user?.uid ?? '';
  const [kind, setKind] = useState<NoteKind>('loveNote');
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const canAdd = text.trim().length >= 3;

  const load = useCallback(async () => {
    if (!ownerId) return;
    const rows = await listByKind(ownerId, kind);
    setNotes(rows);
  }, [ownerId, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const onAdd = useCallback(async () => {
    if (!ownerId) return;
    if (!canAdd) {
      setError('Write at least 3 characters 😊');
      return;
    }
    try {
      setIsAdding(true);
      setError(null);

      await createNote(ownerId, {
        kind,
        text: text.trim(),
        context: null,
        templateId: null,
      });

      // subtle list animation
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setText('');
      inputRef.current?.clear();
      await load();
    } catch (e) {
      console.error(e);
      Alert.alert('Could not save your note', 'Please try again in a moment.');
    } finally {
      setIsAdding(false);
    }
  }, [ownerId, canAdd, kind, text, load]);

  const onInsertPrompt = useCallback((p: string) => {
    setText(t => (t ? `${t} ${p}` : p));
    setError(null);
    inputRef.current?.focus();
  }, []);

  const onLongPressRow = useCallback((item: Note) => {
    Alert.alert(
      'Delete note?',
      'This note will be removed for you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeNote(item.id);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setNotes(prev => prev.filter(n => n.id !== item.id));
            } catch (e) {
              console.error(e);
              Alert.alert('Delete failed', 'Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, []);

  const header = useMemo(
    () => (
      <View>
        {/* Kind chips */}
        <FlatList
          data={NOTE_KINDS}
          keyExtractor={(k) => k}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}
          renderItem={({ item }) => {
            const active = item === kind;
            return (
              <TouchableOpacity
                onPress={() => setKind(item)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {prettyKind(item)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* Input + Add */}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Write something sweet…"
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (error && v.trim().length >= 3) setError(null);
            }}
            returnKeyType="done"
            onSubmitEditing={onAdd}
          />
          <TouchableOpacity
            onPress={onAdd}
            disabled={!canAdd || isAdding}
            style={[styles.addBtn, (!canAdd || isAdding) && styles.addBtnDisabled]}
          >
            <Text style={styles.addBtnText}>{isAdding ? '…' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}

        {/* Prompt chips */}
        <FlatList
          data={PROMPTS}
          keyExtractor={(p, i) => `${i}-${p.slice(0, 8)}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => onInsertPrompt(item)} style={styles.promptChip}>
              <Text style={styles.promptText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    ),
    [kind, text, canAdd, isAdding, error, onAdd, onInsertPrompt]
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0D0F12' }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No love notes yet. Start with a quick prompt above 💌
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={() => onLongPressRow(item)}
            style={styles.card}
          >
            <Text style={styles.cardText}>{item.text}</Text>
            {/* timestamp (optional) */}
            {item.createdAt ? (
              <Text style={styles.cardMeta}>{formatWhen(item.createdAt)}</Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </KeyboardAvoidingView>
  );
}

function prettyKind(k: NoteKind) {
  switch (k) {
    case 'loveNote':
      return 'Love';
    case 'favoriteFood':
      return 'Fav Food';
    case 'habit':
      return 'Habit';
    case 'place':
      return 'Place';
    case 'appreciation':
      return 'Thanks';
    case 'insideJoke':
      return 'Joke';
    case 'gratitude':
      return 'Gratitude';
    case 'memorySnippet':
      return 'Snippet';
    default:
      return k;
  }
}

function formatWhen(ts: any) {
  try {
    // Firestore Timestamp or Date
    const d =
      typeof ts?.toDate === 'function'
        ? (ts.toDate() as Date)
        : ts instanceof Date
        ? ts
        : new Date();
    return d.toLocaleString();
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1F2430',
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2F3644',
  },
  chipActive: {
    backgroundColor: '#E14C7B',
    borderColor: '#E14C7B',
  },
  chipText: {
    color: '#C9D1D9',
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  input: {
    flex: 1,
    backgroundColor: '#12161C',
    borderWidth: 1,
    borderColor: '#2B3240',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
  },
  addBtn: {
    marginLeft: 10,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addBtnDisabled: {
    backgroundColor: '#4C4F5A',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  error: {
    color: '#FCA5A5',
    paddingHorizontal: 16,
    marginTop: 6,
    fontSize: 12,
  },
  promptChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#16202A',
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#243040',
  },
  promptText: {
    color: '#9CC5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    color: '#A1A7B3',
    textAlign: 'center',
    marginTop: 32,
  },
  card: {
    backgroundColor: '#10151C',
    borderColor: '#1E2532',
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
  },
  cardText: {
    color: '#E6E7EB',
    fontSize: 15,
    lineHeight: 20,
  },
  cardMeta: {
    marginTop: 6,
    color: '#8B97A8',
    fontSize: 12,
  },
});
