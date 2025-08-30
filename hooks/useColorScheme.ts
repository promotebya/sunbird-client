// hooks/useColorScheme.ts
import { useColorScheme as useRNColorScheme } from 'react-native';

export default function useColorScheme(): 'light' | 'dark' {
  return (useRNColorScheme() ?? 'light') as 'light' | 'dark';
}

