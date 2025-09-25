// components/Card.tsx
import React, { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTokens, type ThemeTokens } from './ThemeProvider';

export type CardProps = PropsWithChildren<{
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

const Card: React.FC<CardProps> = ({ onPress, style, children }) => {
  const t = useTokens();
  const s = styles(t);

  if (onPress) {
    return (
      <Pressable style={[s.card, style]} onPress={onPress}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
};

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.card,
      borderColor: t.colors.border,
      borderWidth: 1,
      borderRadius: t.radius.lg,
      padding: t.spacing.md,
      // slightly stronger, still soft
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
  });

export default Card;