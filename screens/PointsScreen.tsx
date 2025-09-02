// screens/PointsScreen.tsx
import { auth } from "@/firebaseConfig";
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getPointsTotal, listenPoints, Point } from '../utils/points';

type Tab = 'personal' | 'shared';

export default function PointsScreen() {
  const [uid, setUid] = useState<string>('');
  const [pairId, setPairId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('personal');
  const [rows, setRows] = useState<Point[]>([]);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u?.uid) {
        setUid(u.uid);
        // if you store partner uid, compute pairId; otherwise leave as null
        // setPairId(makeCoupleId(u.uid, partnerUid) ?? null);
      }
    });
    return unsub;
  }, []);

  // Live list
  useEffect(() => {
    if (!uid) return;
    const isShared = tab === 'shared';
    const unsub = listenPoints(
      { ownerId: uid, pairId: isShared ? pairId ?? '__NO_PAIR__' : null },
      setRows
    );
    return unsub;
  }, [uid, pairId, tab]);

  // One-shot total (per tab)
  useEffect(() => {
    (async () => {
      if (!uid) return;
      const isShared = tab === 'shared';
      const sum = await getPointsTotal(uid, { pairId: isShared ? pairId ?? null : null });
      setTotal(sum);
    })().catch((e) => console.log('getPointsTotal error', e));
  }, [uid, pairId, tab]);

  const header = useMemo(
    () => (
      <View>
        <Text style={styles.h1}>Points</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'personal' && styles.tabActive]}
            onPress={() => setTab('personal')}
          >
            <Text style={[styles.tabText, tab === 'personal' && styles.tabTextActive]}>Personal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'shared' && styles.tabActive]}
            onPress={() => setTab('shared')}
          >
            <Text style={[styles.tabText, tab === 'shared' && styles.tabTextActive]}>Shared</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total}</Text>
        </View>

        {tab === 'shared' && !pairId && (
          <Text style={styles.hint}>
            Link a partner on Home to accumulate shared points together.
          </Text>
        )}
      </View>
    ),
    [tab, total, pairId]
  );

  const renderItem = ({ item }: { item: Point }) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>+{item.amount} pts</Text>
        <Text style={styles.meta}>
          {item.source}{item.note ? ` · ${item.note}` : ''}{item.taskId ? ` · task` : ''}
        </Text>
      </View>
      <Text style={styles.when}>
        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : ''}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No points yet — go earn some!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6FA' },
  h1: { fontSize: 32, fontWeight: '800', marginBottom: 12, color: '#111' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ECECFF',
    padding: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#6B5BFF' },
  tabText: { fontWeight: '700', color: '#6B5BFF' },
  tabTextActive: { color: '#fff' },
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  totalLabel: { color: '#666', fontWeight: '600' },
  totalValue: { fontSize: 28, fontWeight: '900', color: '#111', marginTop: 4 },
  hint: { color: '#777', marginBottom: 12 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111' },
  meta: { color: '#777', marginTop: 3 },
  when: { color: '#888', marginLeft: 10 },
  empty: { textAlign: 'center', color: '#999', marginTop: 24 },
});
