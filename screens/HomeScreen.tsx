import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Button from "../components/Button";
import Card from "../components/Card";
import { shared } from "../components/sharedStyles";
import { colors, s, type } from "../components/tokens";
import { auth } from "../firebaseConfig";
import useAuthListener from "../hooks/useAuthListener";
import { getPairId } from "../utils/partner";
import { getPointsTotal } from "../utils/points";

export default function HomeScreen() {
  const { user } = useAuthListener();
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) return;
      const pairId = await getPairId(user.uid);
      const sum = await getPointsTotal(pairId ? { pairId } : { uid: user.uid });
      if (!cancelled) setTotal(sum);
    };
    run();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Hi {user?.displayName || "there"} 👋</Text>

      <Card>
        <View style={shared.spaceBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="trophy" size={24} color={colors.primary} />
            <Text style={type.h2}>Total Points</Text>
          </View>
          <Text style={{ ...type.title, color: colors.primary }}>{total}</Text>
        </View>
      </Card>

      <View style={{ height: s.lg }} />

      <Button
        variant="link"
        title="Sign out"
        onPress={async () => { await signOut(auth); Haptics.selectionAsync(); }}
        leftIcon="log-out-outline"
        textStyle={{ color: '#2563EB' }}
        style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
      />
    </View>
  );
}
