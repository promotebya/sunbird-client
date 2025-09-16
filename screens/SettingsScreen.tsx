// screens/SettingsScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import PairingQR from '../components/PairingQR';
import sharedStyles from '../components/sharedStyles';
import ThemedText from '../components/ThemedText';
import tokens from '../components/tokens';

import useAuthListener from '../hooks/useAuthListener';
import usePartnerUid from '../hooks/usePartnerUid';

import { generatePairCode, redeemPairCode, type PairCodeInfo } from '../utils/pairing';
import { getPairId } from '../utils/partner';
import { showOpenSettingsAlert } from '../utils/permissions';

import { useNavigation } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

/** Local alias to avoid TS namespace issues */
type SimplePermissionStatus = 'granted' | 'denied' | 'undetermined' | 'checking';

const Row = ({
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
}) => (
  <Pressable onPress={onPress} style={styles.row}>
    <View style={styles.rowLeft}>
      {icon ? <Ionicons name={icon} size={22} color={tokens.colors.textDim} style={{ marginRight: 10 }} /> : null}
      <View style={{ flex: 1 }}>
        <ThemedText variant="title">{title}</ThemedText>
        {subtitle ? <ThemedText variant="caption" color={tokens.colors.textDim}>{subtitle}</ThemedText> : null}
      </View>
    </View>
    <View style={{ marginLeft: 10 }}>{right}</View>
  </Pressable>
);

const Badge = ({ label, color, bg }: { label: string; color?: string; bg?: string }) => (
  <View style={[styles.badge, { backgroundColor: bg ?? '#EEF2FF' }]}>
    <ThemedText variant="label" color={color ?? '#3730A3'}>{label}</ThemedText>
  </View>
);

/** Small text-style button to mimic a "link" */
const LinkButton = ({ title, onPress }: { title: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.linkBtn}>
    <ThemedText variant="button" color={tokens.colors.primary}>{title}</ThemedText>
  </Pressable>
);

const SettingsScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const { user } = useAuthListener();
  const partnerUid = usePartnerUid(user?.uid ?? null);
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

  useEffect(() => {
    (async () => {
      if (!user) return;
      setPairId(await getPairId(user.uid));
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      const n = await Notifications.getPermissionsAsync();
      setNotifStatus(n.status as SimplePermissionStatus);

      const l = await ImagePicker.getMediaLibraryPermissionsAsync();
      setLibStatus(l.status as SimplePermissionStatus);
    })();
  }, []);

  const permDot = (status: SimplePermissionStatus) => {
    const m: Record<SimplePermissionStatus, { c: string; t: string }> = {
      granted: { c: '#10B981', t: 'Granted' },
      denied: { c: '#EF4444', t: 'Denied' },
      undetermined: { c: '#F59E0B', t: 'Ask' },
      checking: { c: '#9CA3AF', t: 'Checking' },
    };
    const s = m[status] ?? m.undetermined;
    return <Badge label={s.t} color="#fff" bg={s.c} />;
  };

  async function onGenerateCode() {
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
  }

  async function onShareCode() {
    if (!pairInfo) return;
    await Share.share({
      message:
        `Join me on LovePoints 💞\n\n` +
        `Open the app → Settings → "Enter code" and paste:\n\n` +
        `${pairInfo.code}\n\n` +
        `This code links our accounts (expires in ~30 minutes).`,
    });
  }

  async function onRedeemPrompt() {
    if (!user) return;
    // iOS only; Android fallback could be a small Input modal/screen
    // @ts-ignore - Alert.prompt is iOS only
    Alert.prompt?.(
      'Enter pairing code',
      'Paste the code you received to link accounts.',
      async (code: string) => {
        if (!code) return;
        try {
          await redeemPairCode(user.uid, code.trim());
          Alert.alert('Linked', 'You are now linked 💞');
        } catch (e: any) {
          Alert.alert('Could not link', e?.message ?? 'Try again.');
        }
      }
    );
  }

  async function requestNotifications() {
    const res = await Notifications.requestPermissionsAsync();
    setNotifStatus(res.status as SimplePermissionStatus);
    if (res.status !== 'granted') {
      showOpenSettingsAlert('Notifications permission', 'Enable notifications in Settings for reminders and love notes.');
    }
  }

  async function requestLibrary() {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setLibStatus(res.status as SimplePermissionStatus);
    if (res.status !== 'granted') {
      showOpenSettingsAlert('Photos permission', 'Enable photo access to attach and share memories.');
    }
  }

  async function requestCamera() {
    const res = await requestCamPermission();
    if (!res.granted) {
      showOpenSettingsAlert('Camera permission', 'Enable camera access to scan pairing QR codes.');
    }
  }

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

  function onConfirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (e: any) {
            Alert.alert('Sign out failed', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }

  const showNotifOpenSettings = notifStatus === 'denied';
  const showLibOpenSettings = libStatus === 'denied';
  const showCamOpenSettings = camStatus === 'denied';

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.spacing.md }} style={sharedStyles.screen}>
      <ThemedText variant="display" style={{ marginBottom: tokens.spacing.md }}>Settings</ThemedText>

      {/* Partner linking */}
      <Card>
        <View style={styles.sectionHeader}>
          <ThemedText variant="h2">Partner linking</ThemedText>
          {linked ? <Badge label="Linked" bg="#ECFDF5" color="#065F46" /> : <Badge label="Not linked" bg="#FEF2F2" color="#991B1B" />}
        </View>

        <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginBottom: tokens.spacing.s }}>
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
              <ThemedText variant="display" center>{pairInfo.code}</ThemedText>
            </View>

            <PairingQR code={pairInfo.code} />

            <View style={styles.rowBtns}>
              <Button label="Share" onPress={onShareCode} />
              <LinkButton title="Enter code" onPress={onRedeemPrompt} />
              <LinkButton title="Scan code" onPress={() => nav.navigate('PairingScan')} />
            </View>
          </>
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
            <LinkButton title="Open Settings" onPress={() => showOpenSettingsAlert('Notifications', 'Open system settings to enable notifications.')} />
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
            <LinkButton title="Open Settings" onPress={() => showOpenSettingsAlert('Photos', 'Open system settings to allow photo access.')} />
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
            <LinkButton title="Open Settings" onPress={() => showOpenSettingsAlert('Camera', 'Open system settings to allow camera access.')} />
          </View>
        ) : null}
      </Card>

      {/* Account */}
      <Card style={{ marginTop: tokens.spacing.md }}>
        <ThemedText variant="h2" style={{ marginBottom: tokens.spacing.s }}>Account</ThemedText>
        <Row
          icon="log-out"
          title="Sign out"
          subtitle="Log out of this device"
          right={<Ionicons name="exit-outline" size={22} color={tokens.colors.textDim} />}
          onPress={onConfirmSignOut}
        />
      </Card>

      {/* About */}
      <Card style={{ marginTop: tokens.spacing.md }}>
        <ThemedText variant="h2">About</ThemedText>
        <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: tokens.spacing.xs }}>
          LovePoints helps couples celebrate everyday kindness with points, memories, notes, and gentle reminders.
        </ThemedText>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: tokens.spacing.s,
  },
  row: {
    paddingVertical: tokens.spacing.s,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
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
});

export default SettingsScreen;
