// components/Input.tsx
import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, TextInputProps, ViewStyle } from "react-native";
import { colors, radius } from "./tokens";

type Props = Omit<TextInputProps, "placeholderTextColor" | "style"> & {
  style?: ViewStyle | ViewStyle[];
};

const Input = forwardRef<TextInput, Props>(
  ({ value, onChangeText, placeholder, multiline, keyboardType, style, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.base,
          focused && styles.focused,
          multiline && { height: 100, textAlignVertical: "top" },
          style,
        ]}
        {...rest}
      />
    );
  }
);

Input.displayName = "Input";
export default Input;

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    color: colors.textDark,
  },
  focused: { borderColor: colors.primary },
});
