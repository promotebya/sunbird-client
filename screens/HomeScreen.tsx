import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import useAuthListener from '../hooks/useAuthListener';
import useColorScheme from '../hooks/useColorScheme';
import useNotificationsSetup from '../hooks/useNotificationsSetup';

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuthListener();

  // ensure permissions + Android channel upfront
  useNotificationsSetup();

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#0b0b0d' }]}>
      <Text style={[styles.title, isDark && { color: '#fff' }]}>
        Hey {user?.email?.split('@')[0] ?? 'there'} 👋
      </Text>
      <Text style={[styles.subtitle, isDark && { color: '#c7c7cc' }]}>
        Tiny actions. Big love.
      </Text>

      <View style={styles.grid}>
        <Shortcut
          title="Tasks"
          note="Personal & shared"
          onPress={() => nav.navigate('Tasks')}
          color="#5B58FF"
        />
        <Shortcut
          title="Points"
          note="Earn & celebrate"
          onPress={() => nav.navigate('Points')}
          color="#10B981"
        />
        <Shortcut
          title="Memories"
          note="Your little vault"
          onPress={() => nav.navigate('Memories')}
          color="#F59E0B"
        />
        <Shortcut
          title="Reminders"
          note="Nudges & routines"
          onPress={() => nav.navigate('Reminders')}
          color="#EC4899"
        />
      </View>
    </View>
  );
}

function Shortcut({
  title,
  note,
  onPress,
  color,
}: {
  title: string;
  note: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={[styles.badge, { backgroundColor: color }]} />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardNote}>{note}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 22, backgroundColor: '#fbfbff' },
  title: { fontSize: 28, fontWeight: '800', color: '#121212' },
  subtitle: { marginTop: 4, color: '#6b7280' },
  grid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    width: '47%',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  badge: { width: 24, height: 24, borderRadius: 999, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  cardNote: { marginTop: 4, color: '#6b7280' },
});
