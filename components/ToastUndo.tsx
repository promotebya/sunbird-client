// components/ToastUndo.tsx
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type Props = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onHide?: () => void;
  durationMs?: number;
};

const ToastUndo: React.FC<Props> = ({
  visible,
  message,
  actionLabel = 'Undo',
  onAction,
  onHide,
  durationMs = 3000,
}) => {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onHide?.(), durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, onHide]);

  if (!visible) return null;

  return (
    <View style={styles.toast}>
      <ThemedText variant="button" color="#fff" style={{ flex: 1 }}>
        {message}
      </ThemedText>
      {onAction ? (
        <Pressable onPress={onAction} style={styles.action}>
          <ThemedText variant="button" color="#fff">
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    bottom: tokens.spacing.xl,
    backgroundColor: '#111827',
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  action: { marginLeft: tokens.spacing.md, padding: 6 },
});

export default ToastUndo;
