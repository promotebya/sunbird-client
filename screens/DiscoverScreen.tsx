// screens/DiscoverScreen.tsx
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import { Prefs, generateDateIdeas, generateGiftIdeas } from '../utils/generator';
import { addReward } from '../utils/rewards';

export default function DiscoverScreen() {
  const { user } = useAuthListener();
  const [indoors, setIndoors] = useState(true);
  const [budget, setBudget] = useState<'low'|'medium'|'high'>('low');
  const [timeBlock, setTimeBlock] = useState<'short'|'evening'|'fullDay'>('evening');
  const [vibes, setVibes] = useState<string[]>(['cozy']);
  const [loves, setLoves] = useState<string>('');

  const prefs: Prefs = useMemo(
    () => ({ indoors, budget, timeBlock, vibes, loves: loves.split(',').map(s=>s.trim()).filter(Boolean) }),
    [indoors, budget, timeBlock, vibes, loves]
  );

  const [dates, setDates] = useState<string[]>([]);
  const [gifts, setGifts] = useState<string[]>([]);

  function onGenerate() {
    setDates(generateDateIdeas(prefs));
    setGifts(generateGiftIdeas(prefs));
  }

  async function saveAsTask(title: string) {
    if (!user) return;
    await addDoc(collection(db, 'tasks'), {
      title,
      ownerId: user.uid,
      pairId: null,
      done: false,
      points: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  async function saveAsReward(title: string) {
    if (!user) return;
    await addReward(user.uid, null, title, 5);
  }

  const Chip = ({ label, active, onPress }: { label:string; active:boolean; onPress:()=>void }) => (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <ThemedText variant="label" color={active ? '#fff' : tokens.colors.text}>{label}</ThemedText>
    </Pressable>
  );

  return (
    <FlatList
      ListHeaderComponent={
        <View style={{ padding: tokens.spacing.md }}>
          <ThemedText variant="display">Discover</ThemedText>
          <ThemedText variant="subtitle" color={tokens.colors.textDim}>
            Generate date ideas & little gifts tailored for you two.
          </ThemedText>

          <Card style={{ marginTop: tokens.spacing.md }}>
            <ThemedText variant="title">Your vibe</ThemedText>

            <View style={styles.row}>
              <ThemedText variant="body">Indoors</ThemedText>
              <Switch value={indoors} onValueChange={setIndoors} />
            </View>

            <ThemedText variant="body" style={{ marginTop: tokens.spacing.s }}>Budget</ThemedText>
            <View style={styles.rowWrap}>
              {(['low','medium','high'] as const).map(b => (
                <Chip key={b} label={b} active={budget===b} onPress={()=>setBudget(b)} />
              ))}
            </View>

            <ThemedText variant="body" style={{ marginTop: tokens.spacing.s }}>Time</ThemedText>
            <View style={styles.rowWrap}>
              {(['short','evening','fullDay'] as const).map(t => (
                <Chip key={t} label={t} active={timeBlock===t} onPress={()=>setTimeBlock(t)} />
              ))}
            </View>

            <ThemedText variant="body" style={{ marginTop: tokens.spacing.s }}>Vibes</ThemedText>
            <View style={styles.rowWrap}>
              {['cozy','adventure','creative','foodie','chill'].map(v => (
                <Chip
                  key={v}
                  label={v}
                  active={vibes.includes(v)}
                  onPress={() => setVibes((vs)=> vs.includes(v) ? vs.filter(x=>x!==v) : [...vs,v])}
                />
              ))}
            </View>

            <TextInput
              value={loves}
              onChangeText={setLoves}
              placeholder="Things they love (comma separated)…"
              placeholderTextColor={tokens.colors.textDim}
              style={styles.input}
            />

            <Button label="Generate ideas" onPress={onGenerate} style={{ marginTop: tokens.spacing.s }} />
          </Card>

          {(dates.length + gifts.length) > 0 ? (
            <ThemedText variant="title" style={{ marginTop: tokens.spacing.lg }}>
              Suggestions
            </ThemedText>
          ) : null}
        </View>
      }
      data={[...dates.map(d => ({ kind:'date', text:d })), ...gifts.map(g => ({ kind:'gift', text:g }))]}
      keyExtractor={(i, idx) => i.kind + idx}
      renderItem={({ item }) => (
        <Card style={{ marginHorizontal: tokens.spacing.md, marginBottom: tokens.spacing.s }}>
          <ThemedText variant="body">{item.text}</ThemedText>
          <View style={styles.row}>
            <Pressable onPress={() => saveAsTask(item.text)} style={styles.smallBtn}>
              <ThemedText variant="label" color="#fff">Save as Task</ThemedText>
            </Pressable>
            <Pressable onPress={() => saveAsReward(item.text)} style={[styles.smallBtn, { backgroundColor:'#F59E0B' }]}>
              <ThemedText variant="label" color="#fff">Save as Reward</ThemedText>
            </Pressable>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: tokens.spacing.s },
  rowWrap: { flexDirection:'row', flexWrap:'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F4F6' },
  chipOn: { backgroundColor: tokens.colors.primary },
  input: {
    marginTop: tokens.spacing.s,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.s,
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: tokens.colors.text,
  },
  smallBtn: {
    marginTop: 10,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
