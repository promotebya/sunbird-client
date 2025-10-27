// screens/SettingsScreen.tsx

import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import PairingQR from '../components/PairingQR';
import ThemedText from '../components/ThemedText';
import { useThemeContext, useTokens } from '../components/ThemeProvider';
import tokens from '../components/tokens';

import useAuthListener from '../hooks/useAuthListener';
import usePartnerUid from '../hooks/usePartnerUid';

import {
  generatePairCode,
  getPairId,
  redeemPairCode,
  unlinkPair,
  type PairCodeInfo,
} from '../utils/pairing';
import { showOpenSettingsAlert } from '../utils/permissions';

import { useNavigation } from '@react-navigation/native';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signOut,
  updateEmail,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import ToastUndo from '../components/ToastUndo';
import { auth } from '../firebaseConfig';

type SimplePermissionStatus = 'granted' | 'denied' | 'undetermined' | 'checking';

/* ──────────────────────────────────────────────────────────── */
/* Small UI primitives                                          */
/* ──────────────────────────────────────────────────────────── */

const Row = memo(({
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) => {
  const t = useTokens();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowLeft}>
        {icon ? (
          <Ionicons name={icon} size={22} color={t.colors.textDim} style={{ marginRight: 10 }} />
        ) : null}
        <View style={{ flex: 1 }}>
          <ThemedText variant="title">{title}</ThemedText>
          {subtitle ? (
            <ThemedText variant="caption" color={t.colors.textDim}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={{ marginLeft: 10 }}>{right}</View>
    </Pressable>
  );
});

const Badge = memo(({ label, color, bg }: { label: string; color?: string; bg?: string }) => (
  <View style={[styles.badge, { backgroundColor: bg ?? '#EEF2FF' }]}>
    <ThemedText variant="label" color={color ?? '#3730A3'}>
      {label}
    </ThemedText>
  </View>
));

const LinkButton = memo(({ title, onPress }: { title: string; onPress: () => void }) => {
  const t = useTokens();
  return (
    <Pressable onPress={onPress} style={styles.linkBtn}>
      <ThemedText variant="button" color={t.colors.primary}>
        {title}
      </ThemedText>
    </Pressable>
  );
});

type AllowedTheme = 'light-rose' | 'ocean' | 'forest' | 'mono';

const ThemeRow = memo(({ label, value }: { label: string; value: AllowedTheme }) => {
  const t = useTokens();
  const { pref, setPref } = useThemeContext();
  const selected = pref === value;
  return (
    <Row
      icon={selected ? 'color-palette' : undefined}
      title={label}
      subtitle={selected ? 'Selected' : undefined}
      right={selected ? <Ionicons name="checkmark" size={18} color={t.colors.primary} /> : null}
      onPress={() => setPref(value)}
    />
  );
});

/* ──────────────────────────────────────────────────────────── */

const PERM_BADGE: Record<SimplePermissionStatus, { c: string; t: string }> = {
  granted: { c: '#10B981', t: 'Granted' },
  denied: { c: '#EF4444', t: 'Denied' },
  undetermined: { c: '#F59E0B', t: 'Ask' },
  checking: { c: '#9CA3AF', t: 'Checking' },
};

const permDot = (status: SimplePermissionStatus) => {
  const s = PERM_BADGE[status] ?? PERM_BADGE.undetermined;
  return <Badge label={s.t} color="#fff" bg={s.c} />;
};

const SettingsScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const t = useTokens();

  const { user } = useAuthListener();
  const isDemo = !!user && user.isAnonymous === true;

  // When unlinking, pause any partner-related hooks
  const [unlinking, setUnlinking] = useState(false);
  const partnerUid = usePartnerUid(!unlinking && user ? user.uid : null);

  const [pairId, setPairId] = useState<string | null>(null);

  // Pairing
  const [loadingPair, setLoadingPair] = useState(false);
  const [pairInfo, setPairInfo] = useState<PairCodeInfo | null>(null);
  const linked = !!partnerUid;

  // Permissions status
  const [notifStatus, setNotifStatus] = useState<SimplePermissionStatus>('checking');
  const [libStatus, setLibStatus] = useState<SimplePermissionStatus>('checking');

  // Camera permission via expo-camera
  const [camPerm, requestCamPermission] = useCameraPermissions();
  const camStatus: SimplePermissionStatus = camPerm?.status ?? 'checking';

  // Upgrade modal state
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [lastVerificationSentAt, setLastVerificationSentAt] = useState<number | null>(null);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; msg: string; undo?: () => Promise<void> | void }>(
    { visible: false, msg: '' }
  );
  const showToast = (message: string) => setToast({ visible: true, msg: message });

  useEffect(() => {
    // Localize Firebase emails (verification/reset) to device language where supported
    // @ts-ignore
    auth.useDeviceLanguage?.();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const id = await getPairId(user.uid);
      if (!cancelled) setPairId(id);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [n, l] = await Promise.all([
        Notifications.getPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
      ]);
      if (cancelled) return;
      setNotifStatus(n.status as SimplePermissionStatus);
      setLibStatus(l.status as SimplePermissionStatus);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setPendingVerifyEmail(null);
  }, [upgradeEmail]);

  const onGenerateCode = useCallback(async () => {
    if (!user) return;
    setLoadingPair(true);
    try {
      const info = await generatePairCode(user.uid);
      setPairInfo(info);
    } catch (e: any) {
      Alert.alert('Could not generate', e?.message ?? 'Please try again.');
    } finally {
      setLoadingPair(false);
    }
  }, [user]);

  const onShareCode = useCallback(async () => {
    if (!pairInfo) return;
    await Share.share({
      message:
        `Join me on LovePoints 💞\n\n` +
        `Open the app → Settings → "Enter code" and paste:\n\n` +
        `${pairInfo.code}\n\n` +
        `This code links our accounts (expires in ~30 minutes).`,
    });
  }, [pairInfo]);

  async function onRedeemPrompt() {
    if (!user) return;
    // iOS prompt (Android: navigate to your input screen if desired)
    // @ts-ignore
    Alert.prompt?.('Enter pairing code', 'Paste the code you received to link accounts.', async (code: string) => {
      if (!code) return;
      try {
        await redeemPairCode(user.uid, code.trim());
        Alert.alert('Linked', 'You are now linked 💞');
        setPairInfo(null);
        setPairId(await getPairId(user.uid));
      } catch (e: any) {
        Alert.alert('Could not link', e?.message ?? 'Try again.');
      }
    });
  }

  const requestNotifications = useCallback(async () => {
    const res = await Notifications.requestPermissionsAsync();
    setNotifStatus(res.status as SimplePermissionStatus);
    if (res.status !== 'granted') {
      showOpenSettingsAlert(
        'Notifications permission',
        'Enable notifications in Settings for reminders and love notes.'
      );
    }
  }, []);

  const requestLibrary = useCallback(async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setLibStatus(res.status as SimplePermissionStatus);
    if (res.status !== 'granted') {
      showOpenSettingsAlert('Photos permission', 'Enable photo access to attach and share memories.');
    }
  }, []);

  const requestCamera = useCallback(async () => {
    const res = await requestCamPermission();
    if (!res?.granted) {
      showOpenSettingsAlert('Camera permission', 'Enable camera access to scan pairing QR codes.');
    }
  }, [requestCamPermission]);

  const pairSubtitle = useMemo(() => {
    if (linked) return `Linked to your partner • pair ${pairId ?? '–'}`;
    if (pairInfo?.expiresAtISO) {
      const when = new Date(pairInfo.expiresAtISO);
      if (!isNaN(when.getTime())) {
        return `Code expires at ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
    return 'Not linked yet';
  }, [linked, pairId, pairInfo]);

  // Unlink partner flow (referenced by the "Unlink partner" row)
  const onUnlink = useCallback(() => {
    if (!user?.uid) return;
    Alert.alert(
      'Unlink partner?',
      'You will stop sharing points, rewards, and Premium immediately. You can re-link any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              setUnlinking(true); // pause partner-related hooks
              await unlinkPair(user.uid);
              setPairId(null);
              setPairInfo(null);
              Alert.alert('Unlinked', 'Pairing removed.');
            } catch (e: any) {
              Alert.alert('Could not unlink', e?.message ?? 'Please try again.');
            } finally {
              setUnlinking(false);
            }
          },
        },
      ],
    );
  }, [user?.uid]);

  function openManageSubscription() {
    if (Platform.OS === 'ios') {
      const iosDeepLink = 'itms-apps://apps.apple.com/account/subscriptions';
      Linking.openURL(iosDeepLink).catch(() =>
        Linking.openURL('https://apps.apple.com/account/subscriptions')
      );
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  }

  /** Helpers */

  async function linkPassword(email: string, password: string) {
    const current = auth.currentUser!;
    const cred = EmailAuthProvider.credential(email, password);
    await linkWithCredential(current, cred);
    try { await current.reload(); await current.getIdToken(true); } catch {}
  }

  async function sendVerifyEmail(email: string) {
    const current = auth.currentUser;
    if (!current) throw new Error('No current user.');
    try { await current.reload(); } catch {}
    try {
      await verifyBeforeUpdateEmail(current, email);
    } catch {
      try {
        if (!current.email || current.email.toLowerCase() !== email.toLowerCase()) {
          await updateEmail(current, email);
        }
        await sendEmailVerification(current);
      } catch {
        await verifyBeforeUpdateEmail(current, email);
      }
    }
    setPendingVerifyEmail(email);
    setLastVerificationSentAt(Date.now());
  }

  /** Server-side fallback via callable function */
  async function serverUpgrade(email: string, password: string) {
    try {
      // lazy import to avoid bundling if functions aren’t configured
      // @ts-ignore
      const { functions } = await import('../firebaseConfig');
      // @ts-ignore
      const { httpsCallable } = await import('firebase/functions');
      if (!functions || !httpsCallable) throw new Error('Functions not available.');
      const fn = httpsCallable(functions, 'upgradeAnonToPassword');
      const res: any = await fn({ email, password });
      if (res?.data?.ok) {
        try { await auth.currentUser?.reload(); } catch {}
        return true;
      }
      throw new Error(res?.data?.error || 'Unknown error');
    } catch (e: any) {
      throw e;
    }
  }

  /** Instant upgrade: anonymous → password (client first, server fallback) */
  async function onUpgradeAccountInstant() {
    const current = auth.currentUser;
    const email = upgradeEmail.trim().toLowerCase();
    const password = upgradePassword;

    if (!current) return Alert.alert('Not signed in', 'No current user. Please try again.');
    if (!current.isAnonymous) return Alert.alert('Already upgraded', 'You are already on a real account.');
    if (!email) return Alert.alert('Enter your email', 'Type your email to continue.');
    if (!password || password.length < 6) return Alert.alert('Weak password', 'Password should be at least 6 characters.');

    setUpgradeLoading(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);

      if (methods.length === 0) {
        // New email → try client link first
        try {
          await linkPassword(email, password);
          setShowUpgrade(false);
          setPendingVerifyEmail(null);
          showToast('Account created! Your demo is now saved ✨');
          Alert.alert('Success', 'You’re now on a real account. You can verify your email later in Settings.');
          return;
        } catch (err: any) {
          // If client provider is disabled, try the server route
          if (err?.code === 'auth/operation-not-allowed') {
            try {
              await serverUpgrade(email, password);
              setShowUpgrade(false);
              setPendingVerifyEmail(null);
              showToast('Account created on server! ✨');
              Alert.alert('Success', 'Upgraded via server. You can verify your email later in Settings.');
              return;
            } catch (srvErr: any) {
              Alert.alert(
                'Password sign-in disabled',
                `Client & server upgrades failed.\n\nProject: ${(auth.app?.options as any)?.projectId ?? 'unknown'}\nError: ${srvErr?.message ?? srvErr}`
              );
              return;
            }
          }
          throw err;
        }
      }

      // Email exists already
      if (methods.includes('password')) {
        Alert.alert('Email already in use', 'Use Login with that email and password.');
        return;
      }
      const provLabel = methods.map((m) => (m === 'google.com' ? 'Google' : m === 'apple.com' ? 'Apple' : m)).join(', ');
      Alert.alert('Use existing sign-in', `This email uses ${provLabel}. Use that provider on the Login screen.`);
    } catch (e: any) {
      Alert.alert('Upgrade failed', `${e?.message ?? 'Please try again.'}\n\n(${e?.code ?? 'unknown'})`);
    } finally {
      setUpgradeLoading(false);
    }
  }

  /** Email-first flow (kept) */
  async function onUpgradeAccount() {
    const current = auth.currentUser;
    const email = upgradeEmail.trim().toLowerCase();
    const password = upgradePassword;

    if (!current) return Alert.alert('Not signed in', 'No current user. Please try again.');
    if (!email) return Alert.alert('Enter your email', 'Type your email so we can send you a link.');

    setUpgradeLoading(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);

      if (methods.length > 0) {
        if (methods.includes('password')) {
          await sendPasswordResetEmail(auth, email);
          setPendingVerifyEmail(email);
          setLastVerificationSentAt(Date.now());
          Alert.alert('Check your inbox', 'We sent you a password reset email.');
          return;
        } else {
          const provLabel = methods.map((m) => (m === 'google.com' ? 'Google' : m === 'apple.com' ? 'Apple' : m)).join(', ');
          Alert.alert('Use your existing sign-in', `This email is registered with: ${provLabel}.`);
          return;
        }
      }

      // New email path
      if (!current.isAnonymous) {
        await sendVerifyEmail(email);
        Alert.alert('Verify your new email', `We sent a verification link to ${email}.`);
        return;
      }

      if (password && password.length >= 6) {
        try {
          await linkPassword(email, password);
          try { await sendEmailVerification(auth.currentUser!); } catch { await sendVerifyEmail(email); }
          setPendingVerifyEmail(email);
          setLastVerificationSentAt(Date.now());
          showToast('Account created! Your demo is now saved ✨');
          Alert.alert('Verify your email', `We sent a verification link to ${email}.`);
        } catch (err: any) {
          if (err?.code === 'auth/operation-not-allowed') {
            // attempt server route here too
            try {
              await serverUpgrade(email, password);
              setShowUpgrade(false);
              setPendingVerifyEmail(null);
              showToast('Account created on server! ✨');
              Alert.alert('Success', 'Upgraded via server. You can verify your email later in Settings.');
              return;
            } catch (srvErr: any) {
              Alert.alert('Password sign-in disabled', `Project: ${(auth.app?.options as any)?.projectId ?? 'unknown'}`);
            }
          } else {
            throw err;
          }
        }
      } else {
        await sendVerifyEmail(email);
        Alert.alert('Verify your email', `We sent a verification link to ${email}.`);
      }
    } catch (e: any) {
      let msg = 'Please try again.';
      switch (e?.code) {
        case 'auth/invalid-email': msg = 'Please enter a valid email address.'; break;
        case 'auth/weak-password': msg = 'Password should be at least 6 characters.'; break;
        case 'auth/email-already-in-use': msg = 'That email already exists. Use Login or a password reset.'; break;
        case 'auth/account-exists-with-different-credential': msg = 'This email is linked to a different provider (Google/Apple). Use that to sign in.'; break;
        case 'auth/operation-not-allowed': msg = 'Email/Password sign-in may be restricted on this project.'; break;
        case 'auth/network-request-failed': msg = 'Network error. Check your connection and try again.'; break;
        default: msg = `${msg}\n\n(${e?.code ?? 'unknown'})`;
      }
      Alert.alert('Create account failed', msg);
    } finally {
      setUpgradeLoading(false);
    }
  }

  // Dev sanity check (unchanged)
  async function onAuthSanityTest() {
    try {
      const email = `devtest+${Date.now()}@example.com`;
      const password = 'test123456';
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try { await deleteUser(cred.user); } catch {}
      try { await signInAnonymously(auth); } catch {}
      Alert.alert('Auth sanity test: success', `Created & deleted a throwaway user\nEmail: ${email}`);
    } catch (e: any) {
      Alert.alert('Auth sanity test: failed', `${e?.code ?? 'unknown'}\n${e?.message ?? e}`);
    }
  }

  const showNotifOpenSettings = notifStatus === 'denied';
  const showLibOpenSettings = libStatus === 'denied';
  const showCamOpenSettings = camStatus === 'denied';

  const canResend =
    !upgradeLoading &&
    (!!lastVerificationSentAt ? Date.now() - lastVerificationSentAt > 15000 : true) &&
    !!pendingVerifyEmail;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.colors.bg }}
        contentContainerStyle={{ padding: tokens.spacing.md }}
      >
        <ThemedText variant="display" style={{ marginBottom: tokens.spacing.md }}>
          Settings
        </ThemedText>

        {/* 🔧 Dev-only email debug helpers */}
        {__DEV__ && (
          <Card style={{ marginBottom: tokens.spacing.md }}>
            <ThemedText variant="title">Email debug</ThemedText>
            <ThemedText variant="caption" color={t.colors.textDim}>
              Current: {user?.email ?? '(anonymous)'} • verified: {String(!!user?.emailVerified)}
            </ThemedText>
            <ThemedText variant="caption" color={t.colors.textDim}>
              Project: {(auth.app?.options as any)?.projectId ?? 'unknown'} • API key: {(auth.app?.options as any)?.apiKey ?? 'unknown'}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 8 as any, marginTop: 8 }}>
              <Button
                label="Send verify"
                variant="outline"
                onPress={async () => {
                  try {
                    if (!user?.email) {
                      if (!upgradeEmail) {
                        Alert.alert('Enter email above', 'Fill the email field in the modal first.');
                        return;
                      }
                      await sendVerifyEmail(upgradeEmail.trim().toLowerCase());
                    } else {
                      await sendEmailVerification(auth.currentUser!);
                    }
                    Alert.alert('Sent', 'Verification email sent.');
                  } catch (e: any) {
                    Alert.alert('Verify failed', e?.message ?? 'Please try again.');
                  }
                }}
              />
              <Button
                label="Send reset"
                variant="outline"
                onPress={async () => {
                  try {
                    const target = (user?.email ?? upgradeEmail).trim().toLowerCase();
                    if (!target) {
                      Alert.alert('Enter email', 'Provide an email in the modal first.');
                      return;
                    }
                    await sendPasswordResetEmail(auth, target);
                    Alert.alert('Sent', 'Password reset email sent.');
                  } catch (e: any) {
                    try {
                      await sendPasswordResetEmail(auth, (user?.email ?? upgradeEmail).trim().toLowerCase());
                      Alert.alert('Sent', 'Password reset email sent.');
                    } catch (e2: any) {
                      Alert.alert('Reset failed', e2?.message ?? 'Please try again.');
                    }
                  }
                }}
              />
            </View>
          </Card>
        )}

        {/* Partner linking */}
        <Card>
          <View style={styles.sectionHeader}>
            <ThemedText variant="h2">Partner linking</ThemedText>
            {linked ? (
              <Badge label="Linked" bg="#ECFDF5" color="#065F46" />
            ) : (
              <Badge label="Not linked" bg="#FEF2F2" color="#991B1B" />
            )}
          </View>

          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginBottom: tokens.spacing.s }}>
            Link with your partner to share points, tasks, memories, and notes.
          </ThemedText>

          <Row
            icon="link"
            title={linked ? 'Accounts linked' : 'Generate invite code'}
            subtitle={pairSubtitle}
            right={
              loadingPair ? (
                <ActivityIndicator />
              ) : linked ? (
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              ) : (
                <Button label="Create code" onPress={onGenerateCode} />
              )
            }
          />

          {!linked && pairInfo?.code ? (
            <>
              <View style={styles.codeBox}>
                <ThemedText variant="display" center>
                  {pairInfo.code}
                </ThemedText>
              </View>

              <PairingQR code={pairInfo.code} />

              <View style={styles.rowBtns}>
                <Button label="Share" onPress={onShareCode} />
                <LinkButton title="Enter code" onPress={onRedeemPrompt} />
                <LinkButton title="Scan code" onPress={() => nav.navigate('PairingScan')} />
              </View>
            </>
          ) : null}

          {linked ? (
            <View style={[styles.rowBtns, { justifyContent: 'flex-start' }]}>
              <Button label="Unlink partner" variant="outline" onPress={onUnlink} />
            </View>
          ) : null}
        </Card>

        {/* Permissions */}
        <Card style={{ marginTop: tokens.spacing.md }}>
          <View style={styles.sectionHeader}>
            <ThemedText variant="h2">Permissions</ThemedText>
          </View>

          <Row
            icon="notifications"
            title="Notifications"
            subtitle="For reminders & pushes"
            right={<>{permDot(notifStatus)}</>}
            onPress={requestNotifications}
          />
          {showNotifOpenSettings ? (
            <View style={styles.quickRow}>
              <LinkButton
                title="Open Settings"
                onPress={() =>
                  showOpenSettingsAlert('Notifications', 'Open system settings to enable notifications.')
                }
              />
            </View>
          ) : null}

          <Row
            icon="images"
            title="Photos"
            subtitle="Pick & save memories"
            right={<>{permDot(libStatus)}</>}
            onPress={requestLibrary}
          />
          {showLibOpenSettings ? (
            <View style={styles.quickRow}>
              <LinkButton
                title="Open Settings"
                onPress={() => showOpenSettingsAlert('Photos', 'Open system settings to allow photo access.')}
              />
            </View>
          ) : null}

          <Row
            icon="camera"
            title="Camera"
            subtitle="Scan pairing QR codes"
            right={<>{permDot(camStatus)}</>}
            onPress={requestCamera}
          />
          {showCamOpenSettings ? (
            <View style={styles.quickRow}>
              <LinkButton
                title="Open Settings"
                onPress={() => showOpenSettingsAlert('Camera', 'Open system settings to allow camera access.')}
              />
            </View>
          ) : null}
        </Card>

        {/* Appearance */}
        <Card style={{ marginTop: tokens.spacing.md }}>
          <View style={styles.sectionHeader}>
            <ThemedText variant="h2">Appearance</ThemedText>
            <Badge label="Live" bg="#EEF2FF" color="#3730A3" />
          </View>

          <ThemeRow label="Light (Rose)" value="light-rose" />
          <ThemeRow label="Ocean" value="ocean" />
          <ThemeRow label="Forest" value="forest" />
          <ThemeRow label="Minimal (Mono)" value="mono" />
        </Card>

        {/* Account */}
        <Card style={{ marginTop: tokens.spacing.md }}>
          <View style={styles.sectionHeader}>
            <ThemedText variant="h2">Account</ThemedText>
            {isDemo ? <Badge label="Demo" bg="#FEF3C7" color="#92400E" /> : null}
          </View>

          {isDemo ? (
            <>
              <ThemedText variant="caption" color={t.colors.textDim} style={{ marginBottom: tokens.spacing.s }}>
                You’re using a demo account. Create a real account to save your data across devices.
              </ThemedText>
              <Row
                icon="person-add-outline"
                title="Create real account"
                subtitle={
                  pendingVerifyEmail
                    ? `We’ve sent an email to ${pendingVerifyEmail}.`
                    : 'Create instantly with email & password.'
                }
                right={<Button label="Create" onPress={() => setShowUpgrade(true)} />}
              />
            </>
          ) : null}

          {/* Dev-only helpers */}
          {__DEV__ && (
            <>
              <Row
                icon="bug-outline"
                title="Run auth sanity test"
                subtitle="Creates & deletes a throwaway password user"
                right={<Button label="Run" onPress={onAuthSanityTest} />}
              />
              {!isDemo && (
                <Row
                  icon="refresh"
                  title="Switch to demo"
                  subtitle="Sign out and sign in anonymously (dev)"
                  right={
                    <Button
                      label="Switch"
                      onPress={async () => {
                        try {
                          await signOut(auth);
                          await signInAnonymously(auth);
                          showToast('Switched to a demo session ✅');
                        } catch (e: any) {
                          Alert.alert('Could not switch', e?.message ?? 'Please try again.');
                        }
                      }}
                    />
                  }
                />
              )}
            </>
          )}

          <Row
            icon="card-outline"
            title="Manage subscription"
            subtitle={Platform.select({ ios: 'Opens App Store', android: 'Opens Google Play' })}
            right={<Ionicons name="open-outline" size={22} color={t.colors.textDim} />}
            onPress={openManageSubscription}
          />

          <Row
            icon="log-out"
            title="Sign out"
            subtitle={isDemo ? 'Warning: demo data will be lost' : 'Log out of this device'}
            right={<Ionicons name="exit-outline" size={22} color={t.colors.textDim} />}
            onPress={() => {
              if (isDemo) {
                Alert.alert(
                  'Sign out of demo?',
                  "You're using a demo account. If you sign out now, your current data won't be saved to any real account.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Create account', onPress: () => setShowUpgrade(true) },
                    {
                      text: 'Sign out anyway',
                      style: 'destructive',
                      onPress: async () => {
                        try { await signOut(auth); } catch (e: any) {
                          Alert.alert('Sign out failed', e?.message ?? 'Please try again.');
                        }
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: async () => {
                      try { await signOut(auth); } catch (e: any) {
                        Alert.alert('Sign out failed', e?.message ?? 'Please try again.');
                      }
                    },
                  },
                ]);
              }
            }}
          />

          <Row
            icon="trash-outline"
            title="Delete account"
            subtitle="Permanently remove data"
            right={<Ionicons name="trash-outline" size={22} color="#EF4444" />}
            onPress={async () => {
              if (!user?.uid) return;
              Alert.alert(
                'Delete account?',
                'This will permanently remove your account, points, memories, notes and pairing. It cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        try { await unlinkPair(user.uid); } catch {}
                        try {
                          // @ts-ignore
                          const { functions } = await import('../firebaseConfig');
                          // @ts-ignore
                          const { httpsCallable } = await import('firebase/functions');
                          // @ts-ignore
                          if (functions && httpsCallable) {
                            // @ts-ignore
                            const wipe = httpsCallable(functions, 'deleteUserData');
                            await wipe({});
                          }
                        } catch {}
                        if (auth.currentUser) {
                          await deleteUser(auth.currentUser);
                        }
                        Alert.alert('Deleted', 'Your account has been removed.');
                      } catch (e: any) {
                        if (e?.code === 'auth/requires-recent-login') {
                          Alert.alert('Please re-authenticate', 'For security, please sign in again and then delete your account.');
                        } else {
                          Alert.alert('Delete failed', `${e?.message ?? 'Please try again.'}\n\n(${e?.code ?? 'unknown'})`);
                        }
                      }
                    },
                  },
                ]
              );
            }}
          />
        </Card>

        {/* About */}
        <Card style={{ marginTop: tokens.spacing.md }}>
          <ThemedText variant="h2">About</ThemedText>
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: tokens.spacing.xs }}>
            LovePoints helps couples celebrate everyday kindness with points, memories, notes, and gentle reminders.
          </ThemedText>
        </Card>
      </ScrollView>

      {/* Upgrade modal */}
      <Modal visible={showUpgrade} transparent animationType="fade" onRequestClose={() => setShowUpgrade(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ThemedText variant="h2" style={{ marginBottom: tokens.spacing.s }}>Create real account</ThemedText>
            <ThemedText variant="caption" color="#6B7280" style={{ marginBottom: tokens.spacing.s }}>
              Create a password account instantly. You can verify later in Settings.
            </ThemedText>

            <ThemedText variant="label">Email</ThemedText>
            <TextInput
              style={styles.input}
              value={upgradeEmail}
              onChangeText={setUpgradeEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <ThemedText variant="label" style={{ marginTop: tokens.spacing.s }}>
              Password (min 6 characters)
            </ThemedText>
            <TextInput
              style={styles.input}
              value={upgradePassword}
              onChangeText={setUpgradePassword}
              placeholder="Minimum 6 characters"
              secureTextEntry
              textContentType="newPassword"
            />

            <View style={styles.modalBtnRow}>
              <Button label="Cancel" variant="outline" onPress={() => setShowUpgrade(false)} />
              {pendingVerifyEmail ? (
                <Button
                  variant="outline"
                  label={upgradeLoading ? 'Resending…' : 'Resend email'}
                  onPress={async () => {
                    if (!canResend) return;
                    try {
                      setUpgradeLoading(true);
                      const em = upgradeEmail.trim().toLowerCase();
                      const methods = await fetchSignInMethodsForEmail(auth, em);
                      if (methods.includes('password')) {
                        await sendPasswordResetEmail(auth, em);
                        Alert.alert('Sent', 'We resent the password reset email.');
                      } else {
                        await sendVerifyEmail(em);
                        Alert.alert('Sent', 'We resent the verification email.');
                      }
                      setLastVerificationSentAt(Date.now());
                    } catch (e: any) {
                      try {
                        const em2 = upgradeEmail.trim().toLowerCase();
                        const methods2 = await fetchSignInMethodsForEmail(auth, em2);
                        if (methods2.includes('password')) {
                          await sendPasswordResetEmail(auth, em2);
                          Alert.alert('Sent', 'We resent the password reset email.');
                        } else {
                          await sendEmailVerification(auth.currentUser!);
                          Alert.alert('Sent', 'We resent the verification email.');
                        }
                        setLastVerificationSentAt(Date.now());
                      } catch (e2: any) {
                        Alert.alert('Resend failed', e2?.message ?? 'Please try again.');
                      }
                    } finally {
                      setUpgradeLoading(false);
                    }
                  }}
                  disabled={!canResend}
                />
              ) : null}
              <Button
                label={upgradeLoading ? 'Creating…' : 'Create instantly'}
                onPress={onUpgradeAccountInstant}
                disabled={upgradeLoading}
              />
              <Button
                variant="outline"
                label="Email me a link"
                onPress={onUpgradeAccount}
                disabled={upgradeLoading}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      <ToastUndo
        visible={toast.visible}
        message={toast.msg}
        onAction={toast.undo}
        onHide={() => setToast({ visible: false, msg: '' })}
      />
    </>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.s,
  },
  row: {
    paddingVertical: tokens.spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  codeBox: {
    marginTop: tokens.spacing.s,
    marginBottom: tokens.spacing.s,
    padding: tokens.spacing.md,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  rowBtns: {
    marginTop: tokens.spacing.s,
    flexDirection: 'row',
    gap: tokens.spacing.s as unknown as number,
    justifyContent: 'flex-end',
  },
  quickRow: {
    paddingLeft: 32,
    paddingBottom: tokens.spacing.xs,
  },
  linkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 16,
    padding: tokens.spacing.md,
    backgroundColor: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: tokens.spacing.xs,
  },
  modalBtnRow: {
    marginTop: tokens.spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.s as unknown as number,
  },
});

export default SettingsScreen;