// hooks/useColorScheme.ts
import { useColorScheme as useRNColorScheme } from 'react-native';

export default function useColorScheme() {
  return useRNColorScheme() ?? 'light';
}

