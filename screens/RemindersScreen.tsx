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
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      })
    });
  }, []);

  const schedule = async () => {
    const sec = Number(seconds);
    if (!sec || Number.isNaN(sec)) return Alert.alert("Invalid time", "Enter seconds as a number.");
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Reminder",
        body: text || "It's time!",
        data: { by: user?.uid ?? "anonymous" }
      },
      trigger: { type: "timeInterval", seconds: sec }
    });
    setText("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Reminders</Text>
      <TextInput style={styles.input} placeholder="What should I remind you about?" value={text} onChangeText={setText} />
      <TextInput style={styles.input} placeholder="In how many seconds?" keyboardType="numeric" value={seconds} onChangeText={setSeconds} />
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
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }
});
