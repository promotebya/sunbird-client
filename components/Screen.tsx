// components/Screen.tsx
import { PropsWithChildren } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleProp,
    View,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from './tokens';

type ScreenProps = PropsWithChildren<{
  /** Enable keyboard avoidance for forms */
  keyboard?: boolean;
  /** Use ScrollView (default) or a simple View when false */
  scroll?: boolean;
  /** Style for the outer container (ScrollView or View) */
  style?: StyleProp<ViewStyle>;
  /** Style for the inner content area (contentContainerStyle when scroll=true) */
  contentStyle?: StyleProp<ViewStyle>;
}>;

export default function Screen({
  keyboard = false,
  scroll = true,
  style,
  contentStyle,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: insets.top + tokens.spacing.md,
    paddingBottom: insets.bottom + tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
  };

  const containerBase = [{ flex: 1, backgroundColor: tokens.colors.bg }, style];

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={containerBase}
      contentContainerStyle={[padding, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[...containerBase, padding, contentStyle]}>{children}</View>
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
