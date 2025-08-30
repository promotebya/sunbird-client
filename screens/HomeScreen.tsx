// screens/HomeScreen.tsx
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { createInviteCode, joinWithCode } from '../utils/partner';
import { getPointsTotal } from '../utils/points';
import { checkInDaily, ensureUser, UserProfile, userRef } from '../utils/user';

const yyyymmddUtc = (d = new Date()) =>
  d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [uid, setUid] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [pointsTotal, setPointsTotal] = useState<number>(0);

  // Partner linking
  const [partnerCode, setPartnerCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Derived
  const streak = profile?.streak ?? 0;
  const lastDay = profile?.lastCheckInDay ?? 0;
  const today = yyyymmddUtc();
  const gap = today - lastDay; // >1 means we missed at least a day
  const missed = gap > 1;
  const hasSaver = (profile?.streakSavers ?? 0) > 0;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u?.uid) {
        setUid(u.uid);
        setEmail(u.email ?? '');
        await ensureUser(u.uid, { email: u.email ?? undefined });
        // live user profile
        return onSnapshot(userRef(u.uid), (snap) => {
          setProfile(snap.data() as UserProfile);
        });
      }
      setUid('');
      setProfile(null);
    });
    return () => unsub();
  }, []);

  // Pull total points (personal only here)
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const total = await getPointsTotal(uid, { pairId: null });
      setPointsTotal(total);
    })().catch((e) => console.log('getPointsTotal error', e));
  }, [uid, lastDay]); // re-run after check-ins

  const saveName = async () => {
    try {
      if (!uid) return;
      await setDoc(
        doc(db, 'users', uid),
        { name: nameDraft.trim(), updatedAt: serverTimestamp() },
        { merge: true }
      );
      setNameDraft('');
      Alert.alert('Saved', 'Name updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save name.');
    }
  };

  const handleDailyCheckIn = async (useSaver: boolean) => {
    try {
      const res = await checkInDaily(uid, { points: 10, useStreakSaver: useSaver });
      if (!res.awarded) {
        Alert.alert('Already checked in', 'You have already checked in today ✨');
        return;
      }
      if (res.saverUsed) {
        Alert.alert('Streak saved! 🔥', `+10 points • Streak: ${res.streak}`);
      } else {
        Alert.alert('Check-in complete', `+10 points • Streak: ${res.streak}`);
      }
    } catch (e: any) {
      Alert.alert('Check-in failed', e?.message ?? 'Please try again.');
    }
  };

  const onCreateCode = async () => {
    try {
      const code = await createInviteCode(uid);
      setGeneratedCode(code);
      await Share.share({ message: `Join me on Sunbird ❤️\nMy partner code: ${code}` });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create code.');
    }
  };

  const onJoinWithCode = async () => {
    try {
      if (!partnerCode.trim()) {
        Alert.alert('Enter a code', 'Please paste your partner’s code.');
        return;
      }
      await joinWithCode(uid, partnerCode.trim());
      setPartnerCode('');
      Alert.alert('Linked', 'Partner linked successfully!');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not join with that code.');
    }
  };

  // Prefill name draft
  useEffect(() => {
    if (profile?.name && !nameDraft) setNameDraft(profile.name);
  }, [profile?.name]);

  const partnerSectionHint = useMemo(() => {
    if (generatedCode) return `Your code: ${generatedCode}`;
    return 'Not linked yet';
  }, [generatedCode]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.h1}>Welcome!</Text>

        {/* Profile card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            placeholder="Enter your name"
            value={nameDraft}
            onChangeText={setNameDraft}
            style={styles.input}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={saveName}>
            <Text style={styles.primaryBtnText}>Save name</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 14 }]}>Email</Text>
          <Text style={styles.value}>{email}</Text>
        </View>

        {/* Points + Check-in */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Love Points</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kvLabel}>Total</Text>
              <Text style={styles.kvValue}>{pointsTotal}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kvLabel}>Streak</Text>
              <Text style={styles.kvValue}>
                {streak} <Text style={{ fontSize: 18 }}>🔥</Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 8 }]}
            onPress={() => handleDailyCheckIn(false)}
          >
            <Text style={styles.primaryBtnText}>Daily check-in (+10)</Text>
          </TouchableOpacity>

          {missed && (
            <TouchableOpacity
              disabled={!hasSaver}
              style={[
                styles.secondaryBtn,
                { marginTop: 8, opacity: hasSaver ? 1 : 0.5 },
              ]}
              onPress={() => handleDailyCheckIn(true)}
            >
              <Text style={styles.secondaryBtnText}>
                {hasSaver ? `Use Streak Saver (${profile?.streakSavers})` : 'No Streak Savers left'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Partner linking */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Partner</Text>
          <Text style={styles.hint}>{partnerSectionHint}</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={onCreateCode}>
            <Text style={styles.primaryBtnText}>Create code to share</Text>
          </TouchableOpacity>

          <TextInput
            placeholder="Enter partner code"
            value={partnerCode}
            onChangeText={setPartnerCode}
            style={[styles.input, { marginTop: 12 }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.secondaryBtn} onPress={onJoinWithCode}>
            <Text style={styles.secondaryBtnText}>Join with code</Text>
          </TouchableOpacity>
        </View>

        {/* Nav */}
        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 8 }]}
          onPress={() => navigation.navigate('Tasks')}
        >
          <Text style={styles.primaryBtnText}>Go to Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { marginTop: 8 }]}
          onPress={() => navigation.navigate('Points')}
        >
          <Text style={styles.secondaryBtnText}>Open Points</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutBtn, { marginTop: 16 }]}
          onPress={() => auth.signOut()}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 36, fontWeight: '900', marginBottom: 12, color: '#111' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#111' },
  label: { color: '#666', marginBottom: 6, fontWeight: '600' },
  value: { color: '#111', fontWeight: '700' },
  hint: { color: '#777', marginBottom: 8 },

  input: {
    backgroundColor: '#F2F2FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  primaryBtn: {
    backgroundColor: '#6B5BFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

  secondaryBtn: {
    backgroundColor: '#ECECFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#6B5BFF', fontWeight: '800' },

  logoutBtn: { alignItems: 'center' },
  logoutText: { color: '#6B5BFF', fontWeight: '800' },

  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  kvLabel: { color: '#666', fontWeight: '600' },
  kvValue: { fontSize: 28, fontWeight: '900', color: '#111', marginTop: 2 },
});
