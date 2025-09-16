import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';

export default function OnbWelcome() {
  const nav = useNavigation<any>();
  return (
    <View style={{ flex:1, justifyContent:'center', padding: tokens.spacing.md }}>
      <ThemedText variant="display">Welcome!</ThemedText>
      <ThemedText variant="subtitle">
        Build little acts of love into your week. Earn points, unlock cute challenges, and keep memories.
      </ThemedText>
      <Card style={{ marginTop: tokens.spacing.lg }}>
        <Button label="Get started" onPress={() => nav.navigate('OnbGoals')} />
      </Card>
    </View>
  );
}
