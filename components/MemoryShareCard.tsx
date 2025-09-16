// components/MemoryShareCard.tsx
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useRef } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Card from './Card';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type Props = {
  title?: string;
  note?: string;
  photoURL?: string | null;
};

const MemoryShareCard: React.FC<Props> = ({ title, note, photoURL }) => {
  const viewRef = useRef<View>(null);

  async function onShare() {
    try {
      if (!viewRef.current) return;

      // Take a snapshot of the card
      const uri = await captureRef(viewRef, { format: 'png', quality: 1 });

      // Copy to a persistent temp location (some platforms require a file path)
      const dest = `${FileSystem.cacheDirectory}memory-card-${Date.now()}.png`;
      await FileSystem.copyAsync({ from: uri, to: dest });

      // Guard: Sharing isn’t available on some platforms (e.g., web)
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        if (Platform.OS === 'web') {
          Alert.alert('Sharing not available', 'Sharing is not supported in the web preview.');
        } else {
          Alert.alert('Sharing not available', 'Your device does not support the native share dialog.');
        }
        return;
      }

      await Sharing.shareAsync(dest, { dialogTitle: 'Share memory 💞' });
    } catch (e: any) {
      Alert.alert('Could not share', e?.message ?? 'Please try again.');
    }
  }

  return (
    <View>
      <ViewShot ref={viewRef} style={{ borderRadius: 16, overflow: 'hidden' }}>
        <Card style={{ padding: tokens.spacing.md }}>
          {photoURL ? <Image source={{ uri: photoURL }} style={styles.photo} /> : null}
          {title ? <ThemedText variant="title" style={{ marginTop: tokens.spacing.s }}>{title}</ThemedText> : null}
          {note ? <ThemedText variant="body" style={{ marginTop: tokens.spacing.xs }}>{note}</ThemedText> : null}
          <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: tokens.spacing.s }}>
            LovePoints • {new Date().toLocaleDateString()}
          </ThemedText>
        </Card>
      </ViewShot>

      <Pressable onPress={onShare} style={styles.shareBtn}>
        <ThemedText variant="button" color="#fff">Share</ThemedText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  photo: { width: '100%', height: 220, borderRadius: 12, resizeMode: 'cover' },
  shareBtn: {
    marginTop: tokens.spacing.s,
    alignSelf: 'flex-end',
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: 12,
  },
});

export default MemoryShareCard;
