// components/ThemedText.tsx
import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import Colors from '../constants/Colors';
import useColorScheme from '../hooks/useColorScheme';

type Variant = 'display' | 'title' | 'h2' | 'subtitle' | 'body' | 'label' | 'button' | 'caption';

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  /** When true, applies textAlign: 'center' */
  center?: boolean;
};

const ThemedText: React.FC<Props> = ({ variant = 'body', style, color, center, ...rest }) => {
  const scheme = useColorScheme();
  const baseColor = color ?? (scheme === 'dark' ? Colors.dark.text : Colors.light.text);
  return (
    <Text
      {...rest}
      style={[
        styles[variant],
        { color: baseColor },
        center ? styles.center : null,
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  display: { fontSize: 30, fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '700' },
  h2: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 14, fontWeight: '600' },
  body: { fontSize: 16 },
  label: { fontSize: 13, fontWeight: '700' },
  button: { fontSize: 16, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '600' },
  center: { textAlign: 'center' },
});

export default ThemedText;
