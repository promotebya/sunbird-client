// components/QuickTile.tsx
import React from 'react';
import {
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import sharedStyles from './sharedStyles';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

export type QuickTileProps = {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;     // optional icon/avatar
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const QuickTile: React.FC<QuickTileProps> = ({
  title,
  subtitle,
  left,
  onPress,
  style,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        sharedStyles.card,
        styles.tile,
        pressed && styles.pressed,
        style,
      ]}
    >
      {!!left && <View style={styles.left}>{left}</View>}
      <View style={styles.texts}>
        <ThemedText variant="label">{title}</ThemedText>
        {!!subtitle && (
          <ThemedText variant="caption" color="textDim" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md, // was `s` import – now explicit
    paddingVertical: tokens.spacing.s,
  },
  pressed: { opacity: 0.9 },
  left: { marginRight: tokens.spacing.md },
  texts: { flex: 1 },
  subtitle: { marginTop: tokens.spacing.xs },
});

export default QuickTile;
