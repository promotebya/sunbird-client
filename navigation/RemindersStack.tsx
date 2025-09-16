// navigation/RemindersStack.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RemindersInboxScreen from '../screens/RemindersInboxScreen';
import RemindersScreen from '../screens/RemindersScreen';

const Stack = createNativeStackNavigator();

export default function RemindersStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="RemindersHome" component={RemindersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RemindersInbox" component={RemindersInboxScreen} options={{ title: 'Inbox' }} />
    </Stack.Navigator>
  );
}
