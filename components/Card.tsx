import { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { shared } from './sharedStyles';
import { type } from './tokens';

export default function Card({ children, title, caption }: PropsWithChildren<{ title?: string; caption?: string; }>) {
  return (
    <View style={shared.card}>
      {!!title && <Text style={[type.h2, { marginBottom: 6 }]}>{title}</Text>}
      {!!caption && <Text style={type.dim}>{caption}</Text>}
      {children}
    </View>
  );
}
