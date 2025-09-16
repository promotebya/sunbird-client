import { useNavigation } from '@react-navigation/native';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';

const OPTIONS = ['Feel closer','Celebrate small wins','Plan real dates','Remember milestones','Less screen time'];

export default function OnbGoals() {
  const { user } = useAuthListener();
  const nav = useNavigation<any>();
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (x:string) => setSel(s => s.includes(x) ? s.filter(a=>a!==x) : (s.length<3 ? [...s, x] : s));

  async function next() {
    if (user) await setDoc(doc(db,'users',user.uid), { goals: sel }, { merge:true });
    nav.navigate('OnbReminders');
  }

  return (
    <View style={{ flex:1, padding: tokens.spacing.md }}>
      <ThemedText variant="display">What brings you here?</ThemedText>
      <ThemedText variant="subtitle" color="#6B7280">Pick up to 3</ThemedText>

      <Card style={{ marginTop: tokens.spacing.md }}>
        {OPTIONS.map(o => (
          <Pressable key={o} onPress={()=>toggle(o)} style={{ paddingVertical: 12 }}>
            <ThemedText variant="body">{sel.includes(o) ? '💗 ' : '🤍 '}{o}</ThemedText>
          </Pressable>
        ))}
        <Button label="Next" onPress={next} style={{ marginTop: tokens.spacing.s }} />
      </Card>
    </View>
  );
}
