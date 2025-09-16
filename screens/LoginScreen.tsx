// screens/LoginScreen.tsx
import {
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import ThemedText from '../components/ThemedText';
import sharedStyles from '../components/sharedStyles';
import { tokens } from '../components/tokens'; // named import like the rest of the app

import { auth, db } from '../firebaseConfig';

type Mode = 'login' | 'signup';

async function ensureUserDoc(
  uid: string,
  data: Partial<{ email: string | null; displayName: string | null }>
) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      email: data.email ?? null,
      displayName: data.displayName ?? null,
      pairId: null,
    });
  }
}

const LoginScreen: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function onPrimary() {
    if (!email.trim() || !pass) {
      Alert.alert('Missing info', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
        try {
          const name = email.trim().split('@')[0];
          await updateProfile(cred.user, { displayName: name });
        } catch {}
        await ensureUserDoc(cred.user.uid, {
          email: cred.user.email ?? null,
          displayName: cred.user.displayName ?? null,
        });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
        await ensureUserDoc(cred.user.uid, {
          email: cred.user.email ?? null,
          displayName: cred.user.displayName ?? null,
        });
      }
    } catch (e: any) {
      Alert.alert('Authentication failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onDemo() {
    setDemoLoading(true);
    try {
      const cred = await signInAnonymously(auth);
      await ensureUserDoc(cred.user.uid, { email: null, displayName: 'Guest' });
    } catch (e: any) {
      Alert.alert('Demo sign-in failed', e?.message ?? 'Please try again.');
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={sharedStyles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.center}>
        <ThemedText variant="display" style={{ marginBottom: tokens.spacing.s }}>
          {mode === 'login' ? 'Login' : 'Create account'}
        </ThemedText>
        <ThemedText variant="subtitle" color={tokens.colors.textDim} center>
          Welcome to LovePoints 💞
        </ThemedText>

        <Card style={{ marginTop: tokens.spacing.lg, width: '100%' }}>
          <Input
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Email"
            containerStyle={{ marginBottom: tokens.spacing.s }}
            returnKeyType="next"
          />
          <Input
            value={pass}
            onChangeText={setPass}
            placeholder="Password"
            secureTextEntry
            containerStyle={{ marginBottom: tokens.spacing.s }}
            returnKeyType="done"
            onSubmitEditing={onPrimary}
          />
          <Button
            label={
              loading ? (mode === 'login' ? 'Signing in…' : 'Creating…') : mode === 'login' ? 'Sign in' : 'Create account'
            }
            onPress={onPrimary}
            disabled={loading}
          />
        </Card>

        <Pressable onPress={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))} style={{ marginTop: tokens.spacing.md }}>
          <ThemedText variant="button" color={tokens.colors.primary}>
            {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </ThemedText>
        </Pressable>

        <View style={{ height: tokens.spacing.lg }} />

        <Button
          variant="secondary"
          label={demoLoading ? 'Starting demo…' : 'Continue with Demo'}
          onPress={onDemo}
          disabled={demoLoading}
        />
        <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: tokens.spacing.xs }} center>
          Demo uses an anonymous account. You can pair later in Settings.
        </ThemedText>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    width: '100%',
    padding: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LoginScreen;
