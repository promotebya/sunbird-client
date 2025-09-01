import * as Notifications from 'expo-notifications';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { db } from '../firebase/firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import useNotificationsSetup from '../hooks/useNotificationsSetup';

// If your util exposes a different name, adjust here.
// e.g. you might have: export async function getPartnerUid(uid: string): Promise<string|null>
import { getPartnerUid } from '../utils/partner';

const QUICK = [
  'Drink water 💧',
  'Text your partner 💬',
  'Stand up + stretch 🧘',
  'Smile together 😊',
];

export default function RemindersScreen() {
  // Ensure channels / permissions on mount
  useNotificationsSetup();

  const { user } = useAuthListener();
  const uid = user?.uid ?? null;

  // form
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('60'); // time interval in minutes
  const [repeats, setRepeats] = useState(true);
  const [createBoth, setCreateBoth] = useState(false);

  // ui
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const minutesNum = useMemo(() => {
    const n = Number(minutes);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 60) : 0; // cap at 24h
  }, [minutes]);

  const valid = useMemo(() => {
    return title.trim().length > 0 && minutesNum > 0;
  }, [title, minutesNum]);

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }

  function burst() {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 900);
  }

  async function createOne(ownerId: string) {
    // 1) schedule local notification for THIS device only if it's the current user.
    if (ownerId === uid) {
      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutesNum * 60,
        repeats,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: title.trim(),
          body: repeats
            ? `Every ~${minutesNum} min`
            : `In ~${minutesNum} min`,
          sound: 'default',
        },
        trigger,
      });
    }

    // 2) persist to Firestore (your partner’s device will read & schedule via its own app)
    await addDoc(collection(db, 'reminders'), {
      ownerId,
      title: title.trim(),
      triggerType: 'timeInterval',
      minutes: minutesNum,
      repeats,
      createdAt: serverTimestamp(),
      platform: Platform.OS,
    });
  }

  async function onSave() {
    setTouched(true);
    if (!uid) {
      flashToast('Please sign in first.');
      return;
    }
    if (!valid) {
      flashToast('Please fill the required fields.');
      return;
    }

    try {
      setSaving(true);

      // always create for me
      await createOne(uid);

      // optionally create for partner
      if (createBoth) {
        try {
          const partnerUid = await getPartnerUid(uid);
          if (partnerUid) {
            await createOne(partnerUid);
          } else {
            flashToast("Couldn't find your partner – saved only for you.");
          }
        } catch {
          flashToast("Couldn't reach partner – saved only for you.");
        }
      }

      // success ✨
      burst();
      flashToast('Reminder saved ✅');

      // reset light
      setTitle('');
      setTouched(false);
    } catch (e) {
      console.error('Save reminder failed', e);
      flashToast('Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {/* Confetti emoji burst */}
      {showConfetti && (
        <View style={styles.confettiWrap}>
          <Text style={styles.confetti}>🎉✨🎊</Text>
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create a reminder</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Send a sweet note 💌"
          style={styles.input}
          onBlur={() => setTouched(true)}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
        {touched && title.trim().length === 0 && (
          <Text style={styles.hint}>Please enter something sweet 😊</Text>
        )}

        {/* Quick chips */}
        <Text style={[styles.label, { marginTop: 16 }]}>Quick ideas</Text>
        <View style={styles.chips}>
          {QUICK.map((q) => (
            <Pressable key={q} onPress={() => setTitle(q)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.85 }]}>
              <Text style={styles.chipText}>{q}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>Every N minutes</Text>
            <TextInput
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              placeholder="60"
              style={styles.input}
            />
          </View>
          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text style={styles.label}>Repeats</Text>
            <Switch value={repeats} onValueChange={setRepeats} />
          </View>
        </View>

        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Create for both</Text>
            <Text style={styles.small}>
              Duplicates this reminder for your partner too (their device will schedule it).
            </Text>
          </View>
          <Switch value={createBoth} onValueChange={setCreateBoth} />
        </View>

        <Pressable
          onPress={onSave}
          disabled={!valid || saving}
          style={({ pressed }) => [
            styles.actionBtn,
            (!valid || saving) && { opacity: 0.5 },
            pressed && valid && !saving && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.actionText}>{saving ? 'Saving…' : 'Save reminder'}</Text>
        </Pressable>

        {/* Empty state helper (optional) */}
        <Text style={styles.empty}>
          Tip: try a quick idea above or set your own — tiny habits, big smiles 💖
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 6 },
  small: { fontSize: 12, color: '#6B7280' },

  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FDECF2',
    borderColor: '#F7B7CC',
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { color: '#B84772', fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },

  actionBtn: {
    marginTop: 18,
    backgroundColor: '#5B85FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontWeight: '800', letterSpacing: 0.3 },

  hint: { color: '#E65B50', marginTop: 6 },
  empty: { textAlign: 'center', color: '#888', marginTop: 24 },

  toast: {
    position: 'absolute',
    top: 56,
    right: 16,
    left: 16,
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    zIndex: 20,
  },
  toastText: { color: '#fff', fontWeight: '700', textAlign: 'center' },

  confettiWrap: { position: 'absolute', top: 56, right: 16, zIndex: 19 },
  confetti: { fontSize: 24 },
});
