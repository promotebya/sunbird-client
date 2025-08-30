// screens/TasksScreen.tsx
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
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
import { auth, db } from '../firebase/firebaseConfig';
import { completeTask, Task } from '../utils/tasks';

type Tab = 'personal' | 'shared';

export default function TasksScreen() {
  const uid = auth.currentUser?.uid ?? '';
  const [tab, setTab] = useState<Tab>('personal');
  const [pairId, setPairId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('10');
  const [personal, setPersonal] = useState<Task[]>([]);
  const [shared, setShared] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);

  // Load my pairId once (from users/{uid})
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      setPairId((snap.data() as any)?.pairId ?? null);
    });
    return unsub;
  }, [uid]);

  // Listen personal tasks (owned by me, not completed)
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'tasks'),
      where('ownerId', '==', uid),
      where('completed', '!=', true),
      orderBy('completed'), // required when using '!='
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Task[];
        setPersonal(list);
      },
      (err) => {
        console.error('Personal tasks listener error:', err);
        Alert.alert('Error', err.message);
      }
    );
  }, [uid]);

  // Listen shared tasks (pairId matches, not completed)
  useEffect(() => {
    if (!pairId) {
      setShared([]);
      return;
    }
    const q = query(
      collection(db, 'tasks'),
      where('pairId', '==', pairId),
      where('completed', '!=', true),
      orderBy('completed'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Task[];
        setShared(list);
      },
      (err) => {
        console.error('Shared tasks listener error:', err);
        Alert.alert('Error', err.message);
      }
    );
  }, [pairId]);

  const currentList = useMemo(() => (tab === 'personal' ? personal : shared), [tab, personal, shared]);

  const addTask = async () => {
    try {
      if (!uid) return;
      if (!title.trim()) {
        Alert.alert('Add task', 'Please enter a task title.');
        return;
      }
      const pts = Math.max(1, Number(points || 0));
      const payload: any = {
        title: title.trim(),
        points: pts,
        ownerId: uid,
        createdAt: serverTimestamp(),
        completed: false,
      };
      if (tab === 'shared') {
        if (!pairId) {
          Alert.alert('Shared tasks', 'Link a partner on Home first.');
          return;
        }
        payload.pairId = pairId;
      }
      await addDoc(collection(db, 'tasks'), payload);
      setTitle('');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Add task failed', e.message);
    }
  };

  const handleComplete = async (task: Task) => {
    if (busy) return;
    try {
      setBusy(true);
      const actor = auth.currentUser?.uid!;
      await completeTask(task, actor);
      // Optionally: Alert.alert('Nice!', `+${task.points} points awarded.`);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Complete failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (task: Task) => {
    Alert.alert('Delete task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'tasks', task.id));
          } catch (e: any) {
            Alert.alert('Delete failed', e.message);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Task }) => (
    <View style={styles.taskItem}>
      <Text style={styles.taskTitle}>{item.title}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <TouchableOpacity
          disabled={busy}
          onPress={() => handleComplete(item)}
          style={[styles.actionBtn, busy && { opacity: 0.7 }]}
        >
          <Text style={styles.actionText}>Complete +{item.points}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, styles.deleteBtn]}>
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.taskMeta}>
        {item.pairId ? 'shared' : 'personal'} • {item.points} pts
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setTab('personal')}
            style={[styles.tab, tab === 'personal' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'personal' && styles.tabTextActive]}>Personal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('shared')}
            style={[styles.tab, tab === 'shared' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'shared' && styles.tabTextActive]}>Shared</Text>
          </TouchableOpacity>
        </View>

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={tab === 'personal' ? 'Add a personal task…' : 'Add a shared task…'}
            value={title}
            onChangeText={setTitle}
          />
          <View style={styles.row}>
            <TextInput
              style={styles.pointsInput}
              value={points}
              onChangeText={setPoints}
              placeholder="10"
              keyboardType="number-pad"
            />
            <TouchableOpacity onPress={addTask} style={styles.addBtn}>
              <Text style={styles.addBtnText}>Add task</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* List */}
        <FlatList
          data={currentList}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>No tasks yet — add your first one!</Text>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  tabs: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#eee',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#5B5BFF' },
  tabText: { fontWeight: '700', color: '#333' },
  tabTextActive: { color: '#fff' },

  composer: { backgroundColor: '#f7f7fb', borderRadius: 12, padding: 12, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  pointsInput: {
    width: 80, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, backgroundColor: '#fff',
  },
  addBtn: {
    flex: 1, backgroundColor: '#7A6CFF', borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700' },

  taskItem: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#eee',
  },
  taskTitle: { fontSize: 16, fontWeight: '600' },
  taskMeta: { marginTop: 6, color: '#888' },
  actionBtn: {
    backgroundColor: '#5B5BFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  deleteBtn: { backgroundColor: '#E44' },
  actionText: { color: '#fff', fontWeight: '700' },

  empty: { textAlign: 'center', color: '#777', marginTop: 32 },
});
