// components/ThemedText.tsx
import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { useTokens, type ThemeTokens } from './ThemeProvider';

type Variant = 'display' | 'title' | 'h2' | 'subtitle' | 'body' | 'label' | 'button' | 'caption';

type Props = TextProps & {
  variant?: Variant;
  /** You can pass a raw color (e.g. '#fff') OR a theme color key (e.g. 'textDim') */
  color?: keyof ThemeTokens['colors'] | string;
  /** When true, applies textAlign: 'center' */
  center?: boolean;
};

const ThemedText: React.FC<Props> = ({ variant = 'body', style, color, center, ...rest }) => {
  const t = useTokens();

  // Allow either a literal color or a theme color key
  const resolvedColor =
    typeof color === 'string' && color in (t.colors as any)
      ? (t.colors as any)[color as keyof ThemeTokens['colors']]
      : color || t.colors.text;

  return (
    <Text
      {...rest}
      style={[
        styles[variant],
        { color: resolvedColor },
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