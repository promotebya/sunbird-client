import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { FlatList, LayoutAnimation, Text, View } from "react-native";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import Toast from "../components/Toast";
import { shared } from "../components/sharedStyles";
import { spacing, type } from "../components/tokens";
import useAuthListener from "../hooks/useAuthListener";
import { getPairId } from "../utils/partner";
import * as pointsApi from "../utils/points";

type RecentItem = { id?: string; amount: number; reason?: string; createdAt?: any };

export default function PointsScreen() {
  const { user } = useAuthListener();
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [toast, setToast] = useState<{ visible: boolean; msg: string; variant?: "success" | "danger" }>({ visible: false, msg: "" });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const pairId = await getPairId(user.uid).catch(() => null);
      const api: any = pointsApi as any;

      if (api.listenRecent) {
        return api.listenRecent({ ownerId: user.uid, pairId, limit: 5 }, setRecent);
      }
      if (api.listRecent) {
        const list = await api.listRecent({ ownerId: user.uid, pairId, limit: 5 }).catch(() => []);
        setRecent(list ?? []);
      }
    })();
  }, [user?.uid]);

  const onAdd = async () => {
    const n = Number(amount);
    if (!user || !n || Number.isNaN(n)) {
      setToast({ visible: true, msg: "Couldn't add points. Try again.", variant: "danger" });
      return;
    }
    try {
      const pairId = await getPairId(user.uid).catch(() => null);
      const api: any = pointsApi as any;
      const fn = api.add || api.create || api.addPoints; // tolerate different util names
      await fn({ ownerId: user.uid, pairId, amount: n, reason: reason.trim() || undefined });
      setAmount("1"); setReason("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast({ visible: true, msg: `+${n} point${n > 1 ? "s" : ""} added 🎉`, variant: "success" });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {
      setToast({ visible: true, msg: "Couldn't add points. Try again.", variant: "danger" });
    }
  };

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Points</Text>

      <Card>
        <Input
          placeholder="Points (e.g., 1)"
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
          style={{ marginBottom: spacing.sm }}
        />
        <Input placeholder="Reason" value={reason} onChangeText={setReason} style={{ marginBottom: spacing.md }} />
        <Button title="Add" onPress={onAdd} />
      </Card>

      {recent.length > 0 && (
        <>
          <View style={{ height: spacing.lg }} />
          <Text style={{ ...type.h2, marginBottom: spacing.sm }}>Recent</Text>
          <FlatList
            data={recent}
            keyExtractor={(i) => i.id ?? Math.random().toString(36)}
            renderItem={({ item }) => (
              <View style={[shared.card, { padding: spacing.md, marginBottom: spacing.sm }]}>
                <Text style={{ fontWeight: "700" }}>+{item.amount} point{item.amount > 1 ? "s" : ""}</Text>
                {!!item.reason && <Text style={{ ...type.caption, marginTop: 4 }}>{item.reason}</Text>}
              </View>
            )}
          />
        </>
      )}

      <Toast visible={toast.visible} message={toast.msg} variant={toast.variant} onHide={() => setToast((v) => ({ ...v, visible: false }))} />
    </View>
  );
}
