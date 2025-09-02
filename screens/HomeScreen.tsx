import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { signOut } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

import Button from "../components/Button";
import Card from "../components/Card";
import ConfettiTiny from "../components/ConfettiTiny";
import PressableScale from "../components/PressableScale";
import { shared } from "../components/sharedStyles";
import { colors, spacing, type } from "../components/tokens";
import { auth } from "../firebaseConfig";
import useAuthListener from "../hooks/useAuthListener";

import { getPairId } from "../utils/partner";
import * as pointsApi from "../utils/points";

export default function HomeScreen() {
  const { user } = useAuthListener();
  const [total, setTotal] = useState<number>(0);
  const [seed, setSeed] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let unsub: undefined | (() => void);
    (async () => {
      if (!user) return;
      const pairId = await getPairId(user.uid).catch(() => null);

      // Prefer a real listener if your utils expose one
      const api: any = pointsApi as any;
      if (api.listenTotal) {
        unsub = api.listenTotal({ ownerId: user.uid, pairId }, (t: number) => {
          setTotal((prev) => {
            if (t > prev) {
              burst();
            }
            return t ?? 0;
          });
        });
      } else if (api.getTotal) {
        const t = await api.getTotal({ ownerId: user.uid, pairId }).catch(() => 0);
        setTotal(t ?? 0);
      }
    })();

    return () => {
      if (unsub) unsub();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const burst = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSeed(Math.random());
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  };

  const onSignOut = () => signOut(auth);

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Hi there 👋</Text>

      <Card style={{ flexDirection: "row", alignItems: "center", height: 72 }}>
        <Ionicons name="trophy" size={24} color={colors.primary} style={{ marginRight: spacing.md }} />
        <Text style={{ ...type.h2, flex: 1 }}>Total Points</Text>
        <PressableScale>
          <Animated.Text
            style={{ transform: [{ scale }], fontSize: 28, fontWeight: "800", color: colors.primary }}
          >
            {total}
          </Animated.Text>
        </PressableScale>
      </Card>

      <Button
        title="Sign out"
        variant="link"
        onPress={onSignOut}
        style={{ alignSelf: "flex-start", marginTop: spacing.sm }}
      />

      {/* Tiny confetti when points increase */}
      <ConfettiTiny seed={seed} />
    </View>
  );
}
