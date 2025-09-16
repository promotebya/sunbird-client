// components/PairingQR.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Card from './Card';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type Props = { code: string };

const PairingQR: React.FC<Props> = ({ code }) => {
  return (
    <Card>
      <ThemedText variant="title">Scan to link 💞</ThemedText>
      <View style={styles.box}>
        <QRCode value={JSON.stringify({ kind: 'pairCode', code })} size={180} />
      </View>
      <ThemedText variant="caption" color={tokens.colors.textDim}>
        On your partner’s phone: Settings → “Scan code”
      </ThemedText>
    </Card>
  );
};

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.md },
});

export default PairingQR;
