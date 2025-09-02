import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import Toast from "../components/Toast";
import { shared } from "../components/sharedStyles";
import { colors, s, type } from "../components/tokens";
import useAuthListener from "../hooks/useAuthListener";
import { getPairId } from "../utils/partner";
import { PointEvent, add as addPoint, listenPoints } from "../utils/points";

export default function PointsScreen() {
  const { user } = useAuthListener();
  const [events, setEvents] = useState<PointEvent[]>([]);
  const [delta, setDelta] = useState<string>("1");
  const [reason, setReason] = useState<string>("");
  const [toast, setToast] = useState<{visible:boolean; msg:string; variant?:'success'|'danger'}>({visible:false,msg:''});

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const run = async () => {
      if (!user) return;
      const pairId = await getPairId(user.uid);
      unsub = listenPoints(pairId ? { pairId } : { uid: user.uid }, (evts) => setEvents(evts));
    };
    run();
    return () => { if (unsub) unsub(); };
  }, [user]);

  const onAdd = async () => {
    if (!user) return;
    const val = Number(delta);
    if (Number.isNaN(val)) { setToast({visible:true,msg:'Delta must be a number',variant:'danger'}); return; }
    const pairId = await getPairId(user.uid);
    await addPoint({ uid: user.uid, pairId: pairId ?? null, delta: val, reason: reason || undefined });
    setReason("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast({visible:true,msg:'Points added!',variant:'success'});
  };

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Points</Text>

      <Card>
        <View style={[shared.row, { gap: s.sm }]}>
          <Input style={{ flex: 0.35 }} keyboardType="numeric" value={delta} onChangeText={setDelta} placeholder="Δ" />
          <Input style={{ flex: 1 }} value={reason} onChangeText={setReason} placeholder="Reason" />
          <Button title="Add" onPress={onAdd} />
        </View>
      </Card>

      <View style={{ height: s.md }} />

      <FlatList
        data={events}
        keyExtractor={(item) => item.id!}
        ItemSeparatorComponent={() => <View style={{ height: s.sm }} />}
        renderItem={({ item }) => (
          <View style={[shared.card, { padding: s.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="trophy-outline" size={20} color={colors.primary} />
              <Text style={{ fontWeight: '700' }}>
                {item.delta > 0 ? `+${item.delta}` : item.delta}
              </Text>
            </View>
            <Text style={type.dim} numberOfLines={1}>{item.reason || "—"}</Text>
          </View>
        )}
      />

      <Toast visible={toast.visible} message={toast.msg} variant={toast.variant} onHide={()=>setToast(v=>({...v,visible:false}))} />
    </View>
  );
}
