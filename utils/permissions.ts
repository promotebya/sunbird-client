// utils/permissions.ts
import { Alert, Linking, Platform } from 'react-native';

export function showOpenSettingsAlert(title: string, message: string) {
  Alert.alert(
    title,
    message,
    Platform.OS === 'ios'
      ? [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      : [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ]
  );
}
