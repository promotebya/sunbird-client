// components/Input.tsx
import { forwardRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  errorText?: string;
};

const Input = forwardRef<TextInput, InputProps>(
  ({ label, containerStyle, inputStyle, errorText, onFocus, onBlur, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <ThemedText variant="label" style={styles.label}>
            {label}
          </ThemedText>
        ) : null}

        <View
          style={[
            styles.field,
            focused && styles.fieldFocused,
            !!errorText && styles.fieldError,
          ]}
        >
          <TextInput
            ref={ref}
            placeholderTextColor="#A1A1AA"
            style={[styles.input, inputStyle]}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
        </View>

        {!!errorText && (
          <ThemedText variant="caption" color="#EF4444" style={{ marginTop: 4 }}>
            {errorText}
          </ThemedText>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { marginBottom: tokens.spacing.xs },
  field: {
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
  },
  fieldFocused: { borderColor: tokens.colors.primary },
  fieldError: { borderColor: '#EF4444' },
  input: {
    fontSize: 16,
    color: tokens.colors.text,
  },
});

export default Input;
