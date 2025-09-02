import type { NotificationBehavior, NotificationTriggerInput, TimeIntervalTriggerInput } from "expo-notifications";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import useAuthListener from "../hooks/useAuthListener";
import { getPairId } from "../utils/partner";

import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import Toast from "../components/Toast";
import { shared } from "../components/sharedStyles";
import { type } from "../components/tokens";

export default function RemindersScreen() {
  const { user } = useAuthListener();
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState("60");
  const [both, setBoth] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; msg: string; variant?: "success" | "danger" }>({ visible: false, msg: "" });

  useEffect(() => {
    const behavior = {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    } as unknown as NotificationBehavior;

    Notifications.setNotificationHandler({
      handleNotification: async (): Promise<NotificationBehavior> => behavior,
    });
  }, []);

  const schedule = async () => {
    const sec = Number(seconds);
    if (!sec || Number.isNaN(sec)) {
      setToast({ visible: true, msg: "Oops — please fill this first.", variant: "danger" });
      return;
    }

    const trigger = { seconds: sec } as TimeIntervalTriggerInput as NotificationTriggerInput;

    await Notifications.scheduleNotificationAsync({
      content: { title: "Reminder", body: text || "It's time!" },
      trigger,
    });

    if (both && user) {
      // Optional: store partner-facing reminder record (push will be wired later)
      const pairId = await getPairId(user.uid).catch(() => null);
      // (If you already have a util to persist these, call it here.)
      // e.g., await remindersApi.createForPartner({ ownerId: user.uid, pairId, text, fireAt: Date.now() + sec*1000 })
    }

    setText("");
    const fireAt = new Date(Date.now() + sec * 1000);
    const timePretty = fireAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setToast({ visible: true, msg: `Reminder set for ${timePretty} ⏰`, variant: "success" });
  };

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Reminders</Text>

      <Card>
        <Input placeholder="What should I remind you about?" value={text} onChangeText={setText} style={{ marginBottom: 12 }} />
        <Input placeholder="In how many seconds?" keyboardType="numeric" value={seconds} onChangeText={setSeconds} style={{ marginBottom: 12 }} />
        <Button title="Schedule" onPress={schedule} />
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
          <Switch value={both} onValueChange={setBoth} />
          <Text style={{ marginLeft: 8, ...type.body }}>Create for both</Text>
        </View>
        <Text style={{ ...type.caption, marginTop: 12 }}>
          Using Expo local notifications. Push tokens can be added later for partner notes.
        </Text>
      </Card>

      <Toast visible={toast.visible} message={toast.msg} variant={toast.variant} onHide={() => setToast((v) => ({ ...v, visible: false }))} />
    </View>
  );
}
