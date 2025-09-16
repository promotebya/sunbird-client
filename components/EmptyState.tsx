// components/EmptyState.tsx
import { ReactNode } from 'react';
import { View } from 'react-native';
import Card from './Card';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type Props = {
  title: string;
  body?: string;
  /** Optional custom CTA node (e.g., a Button). */
  cta?: ReactNode;
};

export default function EmptyState({ title, body, cta }: Props) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
      <ThemedText variant="title">{title}</ThemedText>
      {body ? (
        <ThemedText
          variant="caption"
          color="#6B7280"
          style={{ marginTop: tokens.spacing.s, textAlign: 'center' }}
        >
          {body}
        </ThemedText>
      ) : null}
      {cta ? <View style={{ marginTop: tokens.spacing.md }}>{cta}</View> : null}
    </Card>
  );
}
