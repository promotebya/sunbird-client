import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';

export default function OnbReminders() {
  const nav = useNavigation<any>();
  const { user } = useAuthListener();
  const [hour, setHour] = useState(20);

  async function enable() {
    await Notifications.requestPermissionsAsync();
    if (user) await setDoc(doc(db,'users',user.uid), { reminderHour: hour }, { merge:true });
    nav.navigate('OnbWeekly');
  }

  return (
    <View style={{ flex:1, padding: tokens.spacing.md }}>
      <ThemedText variant="display">Gentle reminders</ThemedText>
      <ThemedText variant="subtitle" color="#6B7280">We’ll nudge you at your preferred time.</ThemedText>
      <Card style={{ marginTop: tokens.spacing.md }}>
        <ThemedText variant="body">Default time: {hour}:00</ThemedText>
        <View style={{ height: tokens.spacing.s }} />
        <Button label="Allow notifications" onPress={enable} />
      </Card>
    </View>
  );
}
