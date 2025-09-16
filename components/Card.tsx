// components/Card.tsx
import React, { PropsWithChildren } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import sharedStyles from './sharedStyles';

export type CardProps = PropsWithChildren<{
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

const Card: React.FC<CardProps> = ({ onPress, style, children }) => {
  if (onPress) {
    return (
      <Pressable style={[sharedStyles.card]} onPress={onPress}>
        <View style={style}>{children}</View>
      </Pressable>
    );
  }

  return <View style={[sharedStyles.card, style]}>{children}</View>;
};

export default Card;
