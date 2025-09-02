import type { NotificationBehavior, NotificationTriggerInput, TimeIntervalTriggerInput } from "expo-notifications";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import Toast from "../components/Toast";
import { shared } from "../components/sharedStyles";
import { type } from "../components/tokens";
import useAuthListener from "../hooks/useAuthListener";

export default function RemindersScreen() {
  const { user } = useAuthListener();
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState("5");
  const [toast, setToast] = useState<{visible:boolean; msg:string; variant?:'success'|'danger'}>({visible:false,msg:''});

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (): Promise<NotificationBehavior> => ({
        shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false
      }),
    });
  }, []);

  const schedule = async () => {
    const sec = Number(seconds);
    if (!sec || Number.isNaN(sec)) { setToast({visible:true,msg:'Enter seconds as a number',variant:'danger'}); return; }

    const trigger = { seconds: sec } as TimeIntervalTriggerInput as NotificationTriggerInput;

    await Notifications.scheduleNotificationAsync({
      content: { title: "Reminder", body: text || "It's time!", data: { by: user?.uid ?? "anonymous" } },
      trigger,
    });
    setText("");
    setToast({visible:true,msg:'Reminder scheduled',variant:'success'});
  };

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Reminders</Text>

      <Card>
        <Input placeholder="What should I remind you about?" value={text} onChangeText={setText} style={{ marginBottom: 12 }} />
        <Input placeholder="In how many seconds?" keyboardType="numeric" value={seconds} onChangeText={setSeconds} style={{ marginBottom: 12 }} />
        <Button title="Schedule" onPress={schedule} />
        <Text style={{ ...type.dim, marginTop: 12 }}>
          Using Expo local notifications. Push tokens can be added later for partner notes.
        </Text>
      </Card>

      <Toast visible={toast.visible} message={toast.msg} variant={toast.variant} onHide={()=>setToast(v=>({...v,visible:false}))} />
    </View>
  );
}
