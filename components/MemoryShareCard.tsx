// components/MemoryShareCard.tsx
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useRef } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

import Card from './Card';
import ThemedText from './ThemedText';
import { useTokens, type ThemeTokens } from './ThemeProvider';

type Props = {
  title?: string;
  note?: string;
  photoURL?: string | null;
};

const MemoryShareCard: React.FC<Props> = ({ title, note, photoURL }) => {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const viewRef = useRef<View>(null);

  async function onShare() {
    try {
      if (!viewRef.current) return;

      // Snapshot the card
      const uri = await captureRef(viewRef, { format: 'png', quality: 1 });

      // Some platforms require a file path
      const dest = `${FileSystem.cacheDirectory}memory-card-${Date.now()}.png`;
      await FileSystem.copyAsync({ from: uri, to: dest });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(
          'Sharing not available',
          Platform.OS === 'web'
            ? 'Sharing is not supported in the web preview.'
            : 'Your device does not support the native share dialog.'
        );
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
        <Card style={{ padding: t.spacing.md }}>
          {photoURL ? <Image source={{ uri: photoURL }} style={s.photo} /> : null}
          {title ? (
            <ThemedText variant="title" style={{ marginTop: t.spacing.s }}>
              {title}
            </ThemedText>
          ) : null}
          {note ? (
            <ThemedText variant="body" style={{ marginTop: t.spacing.xs }}>
              {note}
            </ThemedText>
          ) : null}
          <ThemedText
            variant="caption"
            color={t.colors.textDim}
            style={{ marginTop: t.spacing.s }}
          >
            LovePoints • {new Date().toLocaleDateString()}
          </ThemedText>
        </Card>
      </ViewShot>

      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Share memory"
        android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
        style={[s.shareBtn, { backgroundColor: t.colors.primary }]}
      >
        <ThemedText variant="button" color="#fff">
          Share
        </ThemedText>
      </Pressable>
    </View>
  );
};

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    photo: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      resizeMode: 'cover',
    },
    shareBtn: {
      marginTop: t.spacing.s,
      alignSelf: 'flex-end',
      paddingHorizontal: t.spacing.md,
      paddingVertical: 8,
      borderRadius: 12,
      // subtle shadow
      shadowColor: 'rgba(16,24,40,0.08)',
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  });

export default MemoryShareCard;