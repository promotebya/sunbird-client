// screens/LoginScreen.tsx
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import sharedStyles from '../components/sharedStyles';
import ThemedText from '../components/ThemedText';
import { useTokens } from '../components/ThemeProvider'; // ✅ use theme (instead of raw tokens)

import { auth, db } from '../firebaseConfig';

type Mode = 'login' | 'signup';

async function ensureUserDoc(
  uid: string,
  data: Partial<{ email: string | null; displayName: string | null }>
) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Defaults that guarantee FREE plan for brand-new users
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      email: data.email ?? null,
      displayName: data.displayName ?? null,
      pairId: null,
      // ↓ add whatever your paywall hook reads — these values are safe no-premium defaults
      isPremium: false,
      premiumUntil: null,
      planTier: 'free',
    });
  }
}

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

const LoginScreen: React.FC = () => {
  const t = useTokens();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  function prettyAuthError(code?: string) {
    switch (code) {
      case 'auth/invalid-login-credentials':
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Email or password is incorrect.';
      case 'auth/user-not-found':
        return 'No account found with that email.';
      case 'auth/email-already-in-use':
        return 'That email is already registered. Try signing in instead.';
      case 'auth/weak-password':
        return 'Please choose a stronger password (at least 6 characters).';
      default:
        return 'Please try again.';
    }
  }

  async function onPrimary() {
    const em = normalizeEmail(email);
    if (!em || !pass) {
      Alert.alert('Missing info', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, em, pass);
        try {
          const name = em.split('@')[0];
          await updateProfile(cred.user, { displayName: name });
        } catch {}
        await ensureUserDoc(cred.user.uid, {
          email: cred.user.email ?? null,
          displayName: cred.user.displayName ?? null,
        });
      } else {
        const cred = await signInWithEmailAndPassword(auth, em, pass);
        await ensureUserDoc(cred.user.uid, {
          email: cred.user.email ?? null,
          displayName: cred.user.displayName ?? null,
        });
      }
    } catch (e: any) {
      const msg = prettyAuthError(e?.code);
      Alert.alert('Authentication failed', msg);
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword() {
    const em = normalizeEmail(email);
    if (!em) {
      Alert.alert('Enter your email', 'Type your email above and try again.');
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, em);
      Alert.alert('Check your email', 'We sent a password reset link.');
    } catch (e: any) {
      Alert.alert('Couldn’t send reset email', prettyAuthError(e?.code));
    } finally {
      setSendingReset(false);
    }
  }

  async function onDemo() {
    setDemoLoading(true);
    try {
      const cred = await signInAnonymously(auth);
      await ensureUserDoc(cred.user.uid, { email: null, displayName: 'Guest' });
    } catch (e: any) {
      Alert.alert('Demo sign-in failed', 'Please try again.');
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[sharedStyles.screen, { backgroundColor: t.colors.bg }]}  // ✅ themed background
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.center, { padding: t.spacing.md }]}>
        <ThemedText variant="display" style={{ marginBottom: t.spacing.s }}>
          {mode === 'login' ? 'Login' : 'Create account'}
        </ThemedText>
        <ThemedText variant="subtitle" color={t.colors.textDim} center>
          Welcome to LovePoints 💞
        </ThemedText>

        <Card style={{ marginTop: t.spacing.lg, width: '100%' }}>
          <Input
            value={email}
            onChangeText={(v) => setEmail(v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Email"
            containerStyle={{ marginBottom: t.spacing.s }}
            returnKeyType="next"
          />
          <Input
            value={pass}
            onChangeText={setPass}
            placeholder="Password"
            secureTextEntry
            containerStyle={{ marginBottom: t.spacing.s }}
            returnKeyType="done"
            onSubmitEditing={onPrimary}
          />

          <Button
            label={
              loading
                ? mode === 'login'
                  ? 'Signing in…'
                  : 'Creating…'
                : mode === 'login'
                ? 'Sign in'
                : 'Create account'
            }
            onPress={onPrimary}
            disabled={loading}
          />

          <Pressable
            onPress={onForgotPassword}
            style={{ alignSelf: 'center', marginTop: t.spacing.s }}
          >
            <ThemedText variant="button" color={t.colors.primary}>
              {sendingReset ? 'Sending reset…' : 'Forgot password?'}
            </ThemedText>
          </Pressable>
        </Card>

        <Pressable
          onPress={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}
          style={{ marginTop: t.spacing.md }}
        >
          <ThemedText variant="button" color={t.colors.primary}>
            {mode === 'login'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </ThemedText>
        </Pressable>

        <View style={{ height: t.spacing.lg }} />

        {/* was `secondary` -> invalid; use `outline` to match your Button variants */}
        <Button
          variant="outline"
          label={demoLoading ? 'Starting demo…' : 'Continue with Demo'}
          onPress={onDemo}
          disabled={demoLoading}
        />
        <ThemedText
          variant="caption"
          color={t.colors.textDim}
          style={{ marginTop: t.spacing.xs }}
          center
        >
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LoginScreen;