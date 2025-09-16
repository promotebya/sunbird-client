// components/RedeemModal.tsx
import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Button from './Button';
import Card from './Card';
import Input from './Input';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (title: string, cost: number) => void;
};

const RedeemModal: React.FC<Props> = ({ visible, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('10');

  function submit() {
    const c = parseInt(cost, 10);
    if (!title.trim() || !Number.isFinite(c) || c <= 0) return;
    onCreate(title.trim(), c);
    setTitle('');
    setCost('10');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={styles.sheet}>
          <ThemedText variant="title">Add a reward</ThemedText>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Movie night 🎬"
            containerStyle={{ marginTop: tokens.spacing.s }}
          />
          <Input
            value={cost}
            onChangeText={setCost}
            placeholder="Cost in points"
            keyboardType="number-pad"
            containerStyle={{ marginTop: tokens.spacing.s }}
          />
          <View style={styles.row}>
            <Button label="Cancel" onPress={onClose} />
            <Button label="Create" onPress={submit} />
          </View>
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.md,
  },
  sheet: { width: '100%' },
  row: {
    marginTop: tokens.spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.s as unknown as number,
  },
});

export default RedeemModal;
