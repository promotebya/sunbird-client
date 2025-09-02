import {
    addDoc,
    collection,
    DocumentData,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import { getPartnerUid } from '../utils/partner';

type Task = {
  id: string;
  title: string;
  points: number;
  ownerId: string;   // creator
  pairId?: string | null; // couple key (for shared list)
  createdAt?: Timestamp | null;
};

type Segment = 'personal' | 'shared';

export default function TasksScreen() {
  const { user } = useAuthListener();
  const uid = user?.uid ?? '';
  const [pairId, setPairId] = useState<string | null>(null);

  const [segment, setSegment] = useState<Segment>('personal');
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState<string>('10');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const rulesWarnedRef = useRef(false);

  // Fetch partner once (used for "shared" queries & when creating tasks)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!uid) {
        setPairId(null);
        return;
      }
      const p = await getPartnerUid(uid);
      if (isMounted) setPairId(p);
    })();
    return () => {
      isMounted = false;
    };
  }, [uid]);

  // Query changes when auth/segment/pairId changes
  useEffect(() => {
    if (!uid) {
      setTasks([]);
      setLoading(false);
      return;
    }

    // Build Firestore query
    const col = collection(db, 'tasks');

    const q =
      segment === 'personal'
        ? query(
            col,
            where('ownerId', '==', uid),
            orderBy('createdAt', 'desc') // Needs composite index: ownerId asc, createdAt desc
          )
        : pairId
        ? query(
            col,
            where('pairId', '==', pairId),
            orderBy('createdAt', 'desc') // Needs composite index: pairId asc, createdAt desc
          )
        : null;

    if (!q) {
      // Shared tab but no pair connected
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Task[] = snap.docs.map((d) => {
          const data = d.data() as DocumentData;
          return {
            id: d.id,
            title: (data.title ?? data.name ?? '').toString(),
            points: Number(data.points ?? 0),
            ownerId: data.ownerId ?? '',
            pairId: data.pairId ?? null,
            createdAt: (data.createdAt as Timestamp) ?? null,
          };
        });
        setTasks(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);

        // permissions / index errors are common here
        if (!rulesWarnedRef.current) {
          rulesWarnedRef.current = true;
          if (err.code === 'permission-denied') {
            Alert.alert('Error', 'Missing or insufficient permissions.');
          } else if (err.message?.includes('requires an index')) {
            // Show a helpful hint
            Alert.alert(
              'Error',
              'This query needs a Firestore composite index. Open your terminal for the auto-generated URL, or create an index for tasks by (ownerId asc, createdAt desc) and (pairId asc, createdAt desc).'
            );
          } else {
            Alert.alert('Error', err.message);
          }
        }
        console.error('Tasks listener error:', err);
      }
    );

    return () => unsub();
  }, [uid, segment, pairId]);

  const canSubmit = useMemo(() => {
    const p = Number(points);
    return !!uid && title.trim().length > 0 && Number.isFinite(p);
  }, [uid, title, points]);

  const addTask = useCallback(async () => {
    if (!canSubmit) return;
    try {
      const p = Math.max(0, Math.min(9999, Number(points) || 0));
      const payload = {
        title: title.trim(),
        points: p,
        ownerId: uid,
        pairId: pairId ?? null,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'tasks'), payload);
      setTitle('');
      setPoints('10');
      Keyboard.dismiss();
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        Alert.alert('Error', 'Missing or insufficient permissions.');
      } else {
        Alert.alert('Error', e?.message ?? 'Could not add task.');
      }
      console.error('addTask error', e);
    }
  }, [canSubmit, title, points, uid, pairId]);

  const renderItem = useCallback(({ item }: { item: Task }) => {
    const when =
      item.createdAt?.toDate
        ? item.createdAt.toDate().toLocaleString()
        : '–';
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardMeta}>+{item.points} pts</Text>
          <Text style={styles.cardMeta}>{when}</Text>
        </View>
      </View>
    );
  }, []);

  const keyExtractor = useCallback((t: Task) => t.id, []);

  return (
    <View style={styles.container}>
      {/* Segmented control */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, segment === 'personal' && styles.tabActive]}
          onPress={() => setSegment('personal')}
        >
          <Text style={[styles.tabText, segment === 'personal' && styles.tabTextActive]}>
            Personal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, segment === 'shared' && styles.tabActive]}
          onPress={() => setSegment('shared')}
          disabled={!pairId}
        >
          <Text
            style={[
              styles.tabText,
              segment === 'shared' && styles.tabTextActive,
              !pairId && styles.tabTextDisabled,
            ]}
          >
            Shared
          </Text>
        </TouchableOpacity>
      </View>

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={segment === 'personal' ? 'Add a personal task…' : 'Add a shared task…'}
          placeholderTextColor="#9aa0a6"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={addTask}
        />
        <View style={styles.row}>
          <TextInput
            value={points}
            onChangeText={(t) => setPoints(t.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            style={styles.points}
            placeholder="10"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
            onPress={addTask}
            disabled={!canSubmit}
          >
            <Text style={styles.primaryText}>Add task</Text>
          </TouchableOpacity>
        </View>
        {!uid && <Text style={styles.hint}>Please sign in to add tasks.</Text>}
        {segment === 'shared' && !pairId && (
          <Text style={styles.hint}>Connect with your partner to use the shared list.</Text>
        )}
      </View>

      {/* List / Empty */}
      <FlatList
        data={tasks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading…' : 'No tasks yet — add your first one!'}
            </Text>
          </View>
        }
        contentContainerStyle={tasks.length === 0 ? styles.emptyPad : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },

  tabs: {
    flexDirection: 'row',
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#ECEEF4',
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#5B5CE2',
  },
  tabText: { fontWeight: '700', color: '#5F6368' },
  tabTextActive: { color: '#fff' },
  tabTextDisabled: { opacity: 0.4 },

  composer: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  input: {
    backgroundColor: '#F2F3F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    color: '#1f2328',
  },
  row: { flexDirection: 'row', marginTop: 10, columnGap: 10 },
  points: {
    width: 72,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F2F3F7',
    paddingHorizontal: 12,
    color: '#1f2328',
  },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#5B5CE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },

  hint: { marginTop: 8, color: '#8E93A4' },

  emptyPad: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#8E93A4' },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontWeight: '700', color: '#1f2328' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardMeta: { color: '#8E93A4', fontSize: 12 },
});
