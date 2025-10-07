import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import tokens from '../components/tokens';
import useAuthListener from '../hooks/useAuthListener';
import { redeemPairCode } from '../utils/partner';

type BarCode = { data: string; type: string };

export default function PairingScanScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuthListener();

  const [permission, requestPermission] = useCameraPermissions();
  const [enabled, setEnabled] = useState(true);
  const [last, setLast] = useState<BarCode | null>(null);
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Accept plain "233812" or JSON {"kind":"pairCode","code":"233812"}
  const parsePossiblePairCode = (raw: string) => {
    try {
      const parsed = JSON.parse(String(raw));
      if (parsed && typeof parsed === 'object' && parsed.code) {
        return String(parsed.code).trim();
      }
    } catch {
      // not JSON -> fall through
    }
    return String(raw).trim();
  };

  const onBarcodeScanned = useCallback(
    async (code: BarCode) => {
      if (!enabled || handlingRef.current) return;

      if (!user?.uid) {
        Alert.alert('Sign in required', 'Please sign in before pairing.');
        return;
      }

      handlingRef.current = true;
      setEnabled(false);
      try {
        setLast(code);

        const value = parsePossiblePairCode(code.data);
        if (!/^\d{4,8}$/.test(value)) {
          throw new Error('That QR code is not a valid pairing code.');
        }

        await redeemPairCode(value, user.uid);

        Alert.alert('Paired!', 'You are now connected with your partner.', [
          { text: 'OK', onPress: () => nav.goBack() },
        ]);
      } catch (e: any) {
        Alert.alert('Scan failed', e?.message ?? 'Please try again.');
      } finally {
        handlingRef.current = false;
        setTimeout(() => setEnabled(true), 1000);
      }
    },
    [enabled, user, nav]
  );

  const needsPermission = useMemo(() => !permission || !permission.granted, [permission]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <ThemedText variant="display">Scan Pair Code</ThemedText>
        <ThemedText variant="subtitle" color={tokens.colors.textDim}>
          Point your camera at the QR code.
        </ThemedText>
      </View>

      <View style={{ flex: 1, marginHorizontal: tokens.spacing.md, marginBottom: tokens.spacing.md }}>
        <Card style={{ flex: 1, overflow: 'hidden' }}>
          {needsPermission ? (
            <View style={styles.center}>
              <ThemedText variant="body" style={{ textAlign: 'center' }}>
                We need camera access to scan the QR code.
              </ThemedText>
              <View style={{ height: 12 }} />
              <Button
                label="Grant permission"
                onPress={async () => {
                  const res = await requestPermission();
                  if (!res.granted) {
                    Alert.alert(
                      'Permission needed',
                      'Please enable camera permission in Settings.',
                      Platform.select({
                        ios: [{ text: 'Open Settings', onPress: () => Linking.openSettings() }],
                        android: [{ text: 'OK' }],
                      })
                    );
                  }
                }}
              />
            </View>
          ) : (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data, type }) => onBarcodeScanned({ data, type })}
            />
          )}
        </Card>
      </View>

      {last && (
        <View style={{ paddingHorizontal: tokens.spacing.md, paddingBottom: tokens.spacing.md }}>
          <Pressable onPress={() => setLast(null)} style={styles.lastChip}>
            <ThemedText variant="caption" color="#92400E">
              Last: {last.type} — {String(last.data).slice(0, 40)}
              {String(last.data).length > 40 ? '…' : ''}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.s },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.md },
  lastChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
  },
});