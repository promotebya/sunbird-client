// components/RedeemModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Button from './Button';
import Card from './Card';
import Input from './Input';
import ThemedText from './ThemedText';
import { useTokens, type ThemeTokens } from './ThemeProvider';

export type RewardScope = 'shared' | 'personal';

type Props = {
  visible: boolean;
  onClose: () => void;

  /** Legacy creator without scope (kept for backward compatibility). */
  onCreate: (title: string, cost: number) => void | Promise<void>;

  /** New creator that also receives the chosen scope (Shared/Personal). */
  onCreateWithScope?: (title: string, cost: number, scope: RewardScope) => void | Promise<void>;

  /** Which scope tab should be preselected when the modal opens. */
  initialScope?: RewardScope;

  /** If true, show the scope tabs inside the modal. */
  showScopeTabs?: boolean;
};

const RedeemModal: React.FC<Props> = ({
  visible,
  onClose,
  onCreate,
  onCreateWithScope,
  initialScope = 'shared',
  showScopeTabs = false,
}) => {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('10');
  const [scope, setScope] = useState<RewardScope>(initialScope);
  const [error, setError] = useState<string | undefined>(undefined);

  // Reset fields whenever the modal opens and sync the initial scope.
  useEffect(() => {
    if (visible) {
      setTitle('');
      setCost('10');
      setError(undefined);
      setScope(initialScope);
    }
  }, [visible, initialScope]);

  async function submit() {
    const trimmed = title.trim();
    const c = parseInt(cost, 10);
    if (!trimmed) {
      setError('Please enter a title.');
      return;
    }
    if (!Number.isFinite(c) || c <= 0) {
      setError('Please enter a positive cost.');
      return;
    }

    try {
      if (onCreateWithScope) {
        await onCreateWithScope(trimmed, c, scope);
      } else {
        await onCreate(trimmed, c);
      }
      setTitle('');
      setCost('10');
      onClose();
    } catch {
      // parent shows any error alerts
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={s.backdrop}
      >
        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <Card style={s.sheet}>
          <ThemedText variant="title">Add a reward</ThemedText>

          {showScopeTabs && (
            <View style={s.tabsRow}>
              <Pressable
                onPress={() => setScope('shared')}
                style={[s.tab, scope === 'shared' && s.tabActive]}
                accessibilityRole="button"
              >
                <ThemedText variant="label" color={scope === 'shared' ? '#fff' : t.colors.text}>
                  Shared
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setScope('personal')}
                style={[s.tab, scope === 'personal' && s.tabActive]}
                accessibilityRole="button"
              >
                <ThemedText variant="label" color={scope === 'personal' ? '#fff' : t.colors.text}>
                  Personal
                </ThemedText>
              </Pressable>
            </View>
          )}

          <Input
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (error) setError(undefined);
            }}
            placeholder="e.g., Movie night 🎬"
            containerStyle={{ marginTop: t.spacing.s }}
          />
          <Input
            value={cost}
            onChangeText={(v) => {
              setCost(v.replace(/[^0-9]/g, ''));
              if (error) setError(undefined);
            }}
            placeholder="Cost in points"
            keyboardType="number-pad"
            containerStyle={{ marginTop: t.spacing.s }}
          />

          {!!error && (
            <ThemedText variant="caption" color={t.colors.danger} style={{ marginTop: 6 }}>
              {error}
            </ThemedText>
          )}

          <View style={s.row}>
            <Button label="Cancel" onPress={onClose} />
            <Button label="Create" onPress={submit} />
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.spacing.md,
    },
    sheet: { width: '100%' },
    tabsRow: {
      flexDirection: 'row',
      gap: t.spacing.s as number,
      marginTop: t.spacing.s,
    },
    tab: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    tabActive: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
    row: {
      marginTop: t.spacing.md,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: t.spacing.s as number,
    },
  });

export default RedeemModal;