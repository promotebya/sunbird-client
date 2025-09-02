import { auth } from "@/firebaseConfig";
import { ensureUser } from "@/utils/user";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const res = await signInWithEmailAndPassword(auth, email.trim(), pass);
      await ensureUser(res.user);
      Alert.alert("Login", "Login successful.");
    } catch (e: any) {
      Alert.alert("Login failed", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Welcome back</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={pass}
        onChangeText={setPass}
        style={styles.input}
      />
      <Button title={loading ? "Please wait…" : "Login"} onPress={onLogin} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 12 },
  h1: { fontSize: 24, fontWeight: "600", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
  },
});
