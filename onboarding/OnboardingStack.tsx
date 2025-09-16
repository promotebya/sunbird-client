// onboarding/OnboardingStack.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnbDone from './OnbDone';
import OnbGoals from './OnbGoals';
import OnbReminders from './OnbReminders';
import OnbWeekly from './OnbWeekly';
import OnbWelcome from './OnbWelcome';

const S = createNativeStackNavigator();

export default function OnboardingStack() {
  return (
    <S.Navigator screenOptions={{ headerShown: false }}>
      <S.Screen name="OnbWelcome" component={OnbWelcome} />
      <S.Screen name="OnbGoals" component={OnbGoals} />
      <S.Screen name="OnbReminders" component={OnbReminders} />
      <S.Screen name="OnbWeekly" component={OnbWeekly} />
      <S.Screen name="OnbDone" component={OnbDone} />
    </S.Navigator>
  );
}
