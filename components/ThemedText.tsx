// components/ThemedText.tsx
import { PropsWithChildren } from 'react';
import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { useTokens, type ThemeTokens } from './ThemeProvider';

type Variant =
  | 'display'
  | 'title'
  | 'h2'
  | 'subtitle'
  | 'body'
  | 'label'
  | 'button'
  | 'caption';

type Props = PropsWithChildren<
  TextProps & {
    variant?: Variant;
    /** You can pass a raw color (e.g. '#fff') OR a theme color key (e.g. 'textDim') */
    color?: keyof ThemeTokens['colors'] | string;
    /** When true, applies textAlign: 'center' */
    center?: boolean;
  }
>;

export default function ThemedText({
  variant = 'body',
  style,
  color,
  center,
  children,
  ...rest
}: Props) {
  const t = useTokens();

  // Allow either a literal color or a theme color key
  const resolvedColor =
    typeof color === 'string' && color in (t.colors as any)
      ? (t.colors as any)[color as keyof ThemeTokens['colors']]
      : color || t.colors.text;

  const base =
    variant === 'display' ? styles.display :
    variant === 'title'   ? styles.title   :
    variant === 'h2'      ? styles.h2      :
    variant === 'subtitle'? styles.subtitle:
    variant === 'label'   ? styles.label   :
    variant === 'button'  ? styles.button  :
    variant === 'caption' ? styles.caption :
    styles.body;

  return (
    <RNText
      {...rest} // forwards numberOfLines, onTextLayout, etc. (needed by Clamp)
      style={[base, { color: resolvedColor }, center ? styles.center : null, style]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  display:  { fontSize: 30, fontWeight: '800', lineHeight: 36 },
  title:    { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  h2:       { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  subtitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  body:     { fontSize: 16, lineHeight: 22 },
  label:    { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  button:   { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  caption:  { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  center:   { textAlign: 'center' },
});