// components/RedeemModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Button from './Button';
import Card from './Card';
import Input from './Input';
import ThemedText from './ThemedText';
import { useTokens, type ThemeTokens } from './ThemeProvider';

export type RewardScope = 'shared' | 'personal';

type RewardSuggestion = { title: string; cost: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (title: string, cost: number) => void | Promise<void>;
  onCreateWithScope?: (title: string, cost: number, scope: RewardScope) => void | Promise<void>;
  initialScope?: RewardScope;
  showScopeTabs?: boolean;

  // suggestions (optional)
  suggestionsShared?: RewardSuggestion[];
  suggestionsPersonal?: RewardSuggestion[];
  suggestionsTitle?: string;
  suggestionsNote?: string;
};

const RedeemModal: React.FC<Props> = ({
  visible,
  onClose,
  onCreate,
  onCreateWithScope,
  initialScope = 'shared',
  showScopeTabs = false,
  suggestionsShared = [],
  suggestionsPersonal = [],
  suggestionsTitle = 'Try one of these',
  suggestionsNote = 'Tap a suggestion to autofill title and cost.',
}) => {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('10');
  const [scope, setScope] = useState<RewardScope>(initialScope);
  const [error, setError] = useState<string | undefined>(undefined);

  // cap the sheet height so content can scroll
  const SHEET_MAX_HEIGHT = Math.min(Dimensions.get('window').height * 0.82, 640);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setCost('10');
      setError(undefined);
      setScope(initialScope);
    }
  }, [visible, initialScope]);

  const currentSuggestions: RewardSuggestion[] = useMemo(
    () => (scope === 'shared' ? suggestionsShared : suggestionsPersonal),
    [scope, suggestionsShared, suggestionsPersonal]
  );

  function applySuggestion(sug: RewardSuggestion) {
    setTitle(sug.title);
    setCost(String(sug.cost));
    setError(undefined);
  }

  async function submit() {
    const trimmed = title.trim();
    const c = parseInt(cost, 10);
    if (!trimmed) return setError('Please enter a title.');
    if (!Number.isFinite(c) || c <= 0) return setError('Please enter a positive cost.');
    try {
      if (onCreateWithScope) await onCreateWithScope(trimmed, c, scope);
      else await onCreate(trimmed, c);
      setTitle('');
      setCost('10');
      onClose();
    } catch {}
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={s.backdrop}
      >
        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <Card style={[s.sheet, { maxHeight: SHEET_MAX_HEIGHT }]}>
          {/* Scrollable body */}
          <ScrollView
            style={s.body}
            contentContainerStyle={s.bodyContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator
          >
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
              placeholder={scope === 'shared' ? 'e.g., Coffee date together' : 'e.g., Sleep-in pass'}
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

            {(suggestionsShared.length > 0 || suggestionsPersonal.length > 0) && (
              <View style={{ marginTop: t.spacing.md }}>
                <ThemedText variant="label">{suggestionsTitle}</ThemedText>
                <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 2 }}>
                  {suggestionsNote}
                </ThemedText>

                <View style={s.chipsWrap}>
                  {currentSuggestions.map((sug) => (
                    <Pressable
                      key={`${scope}-${sug.title}-${sug.cost}`}
                      onPress={() => applySuggestion(sug)}
                      style={s.chip}
                      accessibilityRole="button"
                    >
                      <ThemedText variant="label">{sug.title}</ThemedText>
                      <ThemedText variant="caption" color={t.colors.textDim}>
                        • {sug.cost} pts
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sticky footer actions */}
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
    sheet: {
      width: '100%',
      // make footer stick by letting body scroll instead
      paddingBottom: 0,
    },
    body: { flexGrow: 0 },
    bodyContent: {
      paddingBottom: t.spacing.md, // space above sticky footer
    },
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
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.s as number,
      marginTop: t.spacing.s,
    },
    chip: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    row: {
      paddingTop: t.spacing.s,
      paddingBottom: t.spacing.s,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: t.spacing.s as number,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
  });

export default RedeemModal;