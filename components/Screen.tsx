// components/Screen.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from './ThemeProvider';

// Fallback so we never show the "UnimplementedView" banner if the native module isn't ready
const LG: any =
  (LinearGradient as any)?.displayName === 'UnimplementedView' ? View : LinearGradient;

// Props
export type ScreenProps = PropsWithChildren<{
  keyboard?: boolean;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

// Pick background palette based on theme (Porcelain / Mist variants)
function getCanvas(themeName: string, resolved: 'light' | 'dark') {
  if (resolved === 'dark') {
    // Charcoal paper variant for dark mode
    return {
      base: '#131315',
      top: '#1A1B1E',
      bottom: '#131315',
      fog: 'rgba(255,255,255,0.02)',
    } as const;
  }

  // Light variants
  const PORCELAIN_BASE = '#FCFAFD'; // warm, neutral – works best with Rose/Forest
  const MIST_BASE = '#F7F7FA'; // cool, neutral – works best with Ocean/Mono

  switch (themeName) {
    case 'ocean':
    case 'mono':
      return {
        base: MIST_BASE,
        top: '#F4F6FA',
        bottom: MIST_BASE,
        fog: 'rgba(240,244,255,0.05)',
      } as const;
    case 'forest':
      return {
        base: PORCELAIN_BASE,
        top: '#F3F8F2',
        bottom: PORCELAIN_BASE,
        fog: 'rgba(220,239,230,0.04)',
      } as const;
    case 'high-contrast':
      return {
        base: '#FFFFFF',
        top: '#FFFFFF',
        bottom: '#FFFFFF',
        fog: 'transparent',
      } as const;
    case 'light-rose':
    default:
      // Porcelain Blush (romantic, not loud)
      return {
        base: PORCELAIN_BASE,
        top: '#FFF5FA',
        bottom: PORCELAIN_BASE,
        fog: 'rgba(255,221,235,0.05)',
      } as const;
  }
}

export default function Screen({
  keyboard = false,
  scroll = true,
  style,
  contentStyle,
  children,
}: ScreenProps) {
  const { themeName, resolved } = useThemeContext();
  const s = styles();
  const insets = useSafeAreaInsets();
  const canvas = getCanvas(themeName, resolved);

  const padding = {
    paddingTop: insets.top + 16,
    paddingBottom: insets.bottom + 20,
    paddingHorizontal: 16,
  } as const;

  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={s.fill}
      contentContainerStyle={[padding, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.fill, padding, contentStyle]}>{children}</View>
  );

  const body = (
    <View style={[s.root, { backgroundColor: canvas.base }, style]}>
      {/* Subtle vertical wash */}
      <LG
        pointerEvents="none"
        colors={[canvas.top, canvas.bottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Very faint corner fog to add depth without saturation */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: 'absolute',
            right: -120,
            top: -80,
            width: 260,
            height: 260,
            borderRadius: 260,
            backgroundColor: canvas.fog,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: -120,
            bottom: -80,
            width: 260,
            height: 260,
            borderRadius: 260,
            backgroundColor: canvas.fog,
          }}
        />
      </View>

      {content}
    </View>
  );

  if (!keyboard) return body;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = () =>
  StyleSheet.create({
    root: { flex: 1 },
    fill: { flex: 1 },
  });