import { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, r, s } from './tokens';

type Props = TextInputProps & { error?: string };

export default function Input({ error, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ width: '100%' }}>
      <TextInput
        {...rest}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          {
            backgroundColor: colors.bg,
            borderWidth: 1,
            borderColor: focused ? colors.primary : colors.border,
            borderRadius: r.md,
            paddingHorizontal: s.lg,
            paddingVertical: 12,
            color: colors.text,
          },
          style as any,
        ]}
        placeholderTextColor={colors.textDim}
      />
      {!!error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{error}</Text>}
    </View>
  );
}
