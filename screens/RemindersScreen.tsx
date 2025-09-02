import type {
    NotificationBehavior,
    NotificationTriggerInput,
    TimeIntervalTriggerInput,
} from "expo-notifications";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import useAuthListener from "../hooks/useAuthListener";

export default function RemindersScreen() {
  const { user } = useAuthListener();
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState("5");

  useEffect(() => {
    Notifications.setNotificationHandler({
      // Some SDK/type combos require a Promise — make it explicit & typed
      handleNotification: async (): Promise<NotificationBehavior> =>
        ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        } as NotificationBehavior),
    });
  }, []);

  const schedule = async () => {
    const sec = Number(seconds);
    if (!sec || Number.isNaN(sec)) {
      Alert.alert("Invalid time", "Enter seconds as a number.");
      return;
    }

    // Be resilient to typing differences across SDKs:
    const trigger = { seconds: sec } as TimeIntervalTriggerInput as NotificationTriggerInput;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Reminder",
        body: text || "It's time!",
        data: { by: user?.uid ?? "anonymous" },
      },
      trigger, // <- typed cast above silences mismatches cleanly
    });

    setText("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Reminders</Text>
      <TextInput
        style={styles.input}
        placeholder="What should I remind you about?"
        value={text}
        onChangeText={setText}
      />
      <TextInput
        style={styles.input}
        placeholder="In how many seconds?"
        keyboardType="numeric"
        value={seconds}
        onChangeText={setSeconds}
      />
      <Button title="Schedule" onPress={schedule} />
      <Text style={{ marginTop: 12, opacity: 0.8 }}>
        Using Expo local notifications. Push tokens can be added later for partner notes.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  h1: { fontSize: 22, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
});
