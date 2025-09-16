import { useNavigation } from '@react-navigation/native';
import { doc, setDoc } from 'firebase/firestore';
import { View } from 'react-native';
import Button from '../components/Button';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';

export default function OnbDone() {
  const nav = useNavigation<any>();
  const { user } = useAuthListener();

  async function finish() {
    if (user) await setDoc(doc(db,'users',user.uid), { onboarded: true }, { merge:true });
    nav.reset({ index:0, routes:[{ name:'Tabs' }] });
  }

  return (
    <View style={{ flex:1, justifyContent:'center', padding: tokens.spacing.md }}>
      <ThemedText variant="display">You’re all set ✨</ThemedText>
      <ThemedText variant="subtitle">Earn points, unlock challenges, and spread kindness.</ThemedText>
      <Button label="Let’s go" onPress={finish} style={{ marginTop: tokens.spacing.md }} />
    </View>
  );
}
