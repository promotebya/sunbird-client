// components/FirstRunTipsCard.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Card from './Card';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type Props = {
  onDismiss?: () => void;
  onLink?: () => void;
  onAddTask?: () => void;
  onSendNote?: () => void;
};

const FirstRunTipsCard: React.FC<Props> = ({ onDismiss, onLink, onAddTask, onSendNote }) => {
  return (
    <Card>
      <ThemedText variant="title">Welcome 💞</ThemedText>
      <ThemedText variant="body" color={tokens.colors.textDim} style={{ marginTop: tokens.spacing.xs }}>
        Three quick wins to start:
      </ThemedText>

      <View style={styles.row}>
        <ThemedText variant="label">1</ThemedText>
        <ThemedText variant="body">Link with your partner</ThemedText>
        <Pressable onPress={onLink} style={styles.cta}><ThemedText variant="button" color="#fff">Link</ThemedText></Pressable>
      </View>

      <View style={styles.row}>
        <ThemedText variant="label">2</ThemedText>
        <ThemedText variant="body">Add your first task</ThemedText>
        <Pressable onPress={onAddTask} style={styles.cta}><ThemedText variant="button" color="#fff">Add</ThemedText></Pressable>
      </View>

      <View style={styles.row}>
        <ThemedText variant="label">3</ThemedText>
        <ThemedText variant="body">Send a love note</ThemedText>
        <Pressable onPress={onSendNote} style={styles.cta}><ThemedText variant="button" color="#fff">Send</ThemedText></Pressable>
      </View>

      <Pressable onPress={onDismiss} style={styles.dismiss}>
        <ThemedText variant="label" color={tokens.colors.textDim}>Dismiss</ThemedText>
      </Pressable>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: {
    marginTop: tokens.spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s as unknown as number,
  },
  cta: {
    marginLeft: 'auto',
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: 12,
  },
  dismiss: { marginTop: tokens.spacing.md, alignSelf: 'flex-end' },
});

export default FirstRunTipsCard;
