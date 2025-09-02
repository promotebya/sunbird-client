// screens/TasksScreen.tsx
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../firebase/firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import makeCoupleId from '../utils/makeCoupleId';
import { getPartnerUid } from '../utils/partner';

type Task = {
  id: string;
  text: string;
  points: number;
  ownerId?: string;
  pairId?: string | null;
  createdAt?: any;
  done?: boolean;
};

type TabKey = 'personal' | 'shared';

export default function TasksScreen() {
  const user = useAuthListener();
  const [tab, setTab] = useState<TabKey>('personal');

  const [input, setInput] = useState('');
  const [points, setPoints] = useState<string>('10');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const tasksCol = useMemo(() => collection(db, 'tasks'), []);

  // subscribe to personal or shared tasks depending on tab
  useEffect(() => {
    if (!user?.uid) return;

    let unsub: (() => void) | undefined;

    (async () => {
      setLoading(true);
      try {
        if (tab === 'personal') {
          const q = query(
            tasksCol,
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          unsub = onSnapshot(
            q,
            (snap) => {
              const list: Task[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
              setTasks(list);
              setLoading(false);
            },
            (err) => {
              setLoading(false);
              console.error('Personal tasks listener error:', err);
              Alert.alert('Error', err.message.includes('index')
                ? 'The query requires an index. Please run the provided index link or deploy indexes.'
                : err.message);
            }
          );
        } else {
          // shared tab: use the couple id
          const partnerUid = await getPartnerUid(user.uid);
          const pairId = partnerUid ? makeCoupleId(user.uid, partnerUid) : null;

          if (!pairId) {
            setTasks([]);
            setLoading(false);
            return;
          }

          const q = query(
            tasksCol,
            where('pairId', '==', pairId),
            orderBy('createdAt', 'desc')
          );
          unsub = onSnapshot(
            q,
            (snap) => {
              const list: Task[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
              setTasks(list);
              setLoading(false);
            },
            (err) => {
              setLoading(false);
              console.error('Shared tasks listener error:', err);
              Alert.alert('Error', err.message.includes('index')
                ? 'The query requires an index. Please run the provided index link or deploy indexes.'
                : err.message);
            }
          );
        }
      } catch (e: any) {
        setLoading(false);
        console.error(e);
        Alert.alert('Error', e?.message ?? 'Something went wrong');
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [tab, user?.uid, tasksCol]);

  const onAdd = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }
    const text = input.trim();
    if (!text) {
      Alert.alert('Please add a task', 'Task description cannot be empty.');
      return;
    }
    const pts = Number(points);
    if (Number.isNaN(pts) || pts < 0) {
      Alert.alert('Invalid points', 'Enter a valid non-negative number.');
      return;
    }

    try {
      setLoading(true);

      if (tab === 'personal') {
        await addDoc(tasksCol, {
          text,
          points: pts,
          ownerId: user.uid,
          pairId: null,
          createdAt: serverTimestamp(),
          done: false,
        });
      } else {
        const partnerUid = await getPartnerUid(user.uid);
        const pairId = partnerUid ? makeCoupleId(user.uid, partnerUid) : null;
        if (!pairId) {
          Alert.alert('No couple set', 'You need a partner to add shared tasks.');
          setLoading(false);
          return;
        }
        await addDoc(tasksCol, {
          text,
          points: pts,
          ownerId: user.uid,
          pairId,
          createdAt: serverTimestamp(),
          done: false,
        });
      }

      setInput('');
      Keyboard.dismiss();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Failed to add task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('personal')} style={[styles.tab, tab === 'personal' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'personal' && styles.tabTextActive]}>Personal</Text>
        </Pressable>
        <Pressable onPress={() => setTab('shared')} style={[styles.tab, tab === 'shared' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'shared' && styles.tabTextActive]}>Shared</Text>
        </Pressable>
      </View>

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={tab === 'personal' ? 'Add a personal task…' : 'Add a shared task…'}
          value={input}
          onChangeText={setInput}
        />
        <TextInput
          style={styles.points}
          keyboardType="number-pad"
          value={points}
          onChangeText={setPoints}
        />
        <Pressable onPress={onAdd} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.addBtnText}>{loading ? 'Adding…' : 'Add task'}</Text>
        </Pressable>
      </View>

      {/* List or empty state */}
      <View style={{ flex: 1 }}>
        {tasks.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading tasks…' : 'No tasks yet — add your first one!'}
            </Text>
          </View>
        ) : (
          tasks.map((t) => (
            <View key={t.id} style={styles.item}>
              <Text style={styles.itemText}>{t.text}</Text>
              <Text style={styles.itemPts}>+{t.points}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  tab: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#6A5AE0' },
  tabText: { fontWeight: '700', color: '#222' },
  tabTextActive: { color: '#fff' },

  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  input: { flex: 1, height: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3e3e7' },
  points: { width: 64, height: 44, textAlign: 'center', borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3e3e7' },
  addBtn: { height: 44, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#6A5AE0', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#777' },

  item: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
  itemText: { color: '#222', fontWeight: '600', flexShrink: 1, paddingRight: 8 },
  itemPts: { color: '#6A5AE0', fontWeight: '800' },
});
