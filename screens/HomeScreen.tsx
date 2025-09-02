import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
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
    <View style={styles.container}>
      <Text style={styles.h1}>Hi {user?.displayName || "there"} 👋</Text>
      <Text style={styles.p}>Your total points: {total}</Text>
      <Button title="Sign out" onPress={() => signOut(auth)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  h1: { fontSize: 24, fontWeight: "600", marginTop: 8 },
  p: { fontSize: 16 }
});
