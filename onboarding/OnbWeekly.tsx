import { useNavigation } from '@react-navigation/native';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';

export default function OnbWeekly() {
  const nav = useNavigation<any>();
  const { user } = useAuthListener();
  const [goal, setGoal] = useState(50);

  async function next() {
    if (user) await setDoc(doc(db, 'users', user.uid), { weeklyGoal: goal }, { merge: true });
    nav.navigate('OnbDone');
  }

  return (
    <View style={{ flex:1, padding: tokens.spacing.md }}>
      <ThemedText variant="display">Weekly goal</ThemedText>
      <ThemedText variant="subtitle" color="#6B7280">How many points feel motivating?</ThemedText>
      <Card style={{ marginTop: tokens.spacing.md }}>
        <ThemedText variant="title">{goal} points</ThemedText>
        <Button label="Looks good" onPress={next} style={{ marginTop: tokens.spacing.s }} />
      </Card>
    </View>
  );
}
