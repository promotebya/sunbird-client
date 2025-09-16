// components/KeyboardAvoider.tsx
import React from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from 'react-native';

type Props = {
  children: React.ReactNode;
  /** Add a ScrollView around your content (recommended for forms). Default: true */
  withScroll?: boolean;
  /** Extra offset so content doesn’t hide under headers/tab bars. Default: 80 */
  keyboardOffset?: number;
  /** Style for the outer container */
  style?: ViewStyle;
  /** Style for the ScrollView content container (when withScroll === true) */
  contentContainerStyle?: ViewStyle;
};

/**
 * KeyboardAvoider
 * - iOS: behavior="padding"
 * - Android: behavior="height"
 * - Taps outside inputs dismiss the keyboard
 */
const KeyboardAvoider: React.FC<Props> = ({
  children,
  withScroll = true,
  keyboardOffset = 80,
  style,
  contentContainerStyle,
}) => {
  const content = withScroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.contentContainer, contentContainerStyle]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardOffset}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.flex}>{content}</View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  contentContainer: { paddingBottom: 16 }, // small bottom pad under the CTA
});

export default KeyboardAvoider;
