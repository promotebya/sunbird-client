// hooks/useColorScheme.ts
import { useThemeContext } from '../components/ThemeProvider';

export type ColorScheme = 'light' | 'dark';
export default function useColorScheme(): ColorScheme {
  const { resolved } = useThemeContext();
  return resolved;
}
