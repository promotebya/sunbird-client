import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import useAuthListener from "../hooks/useAuthListener";
import { create as createNote } from "../utils/notes";
import { getPartnerUid } from "../utils/partner";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

import Button from "../components/Button";
import Card from "../components/Card";
import Chip from "../components/Chip";
import ConfettiTiny from "../components/ConfettiTiny";
import Input from "../components/Input";
import PressableScale from "../components/PressableScale";
import { shared } from "../components/sharedStyles";
import Toast from "../components/Toast";
import { spacing, type } from "../components/tokens";

type QuickTemplate = { id: string; text: string; placeholders?: string[] };

const TEMPLATES: QuickTemplate[] = [
  { id: "thinking", text: "Thinking of you 💭" },
  { id: "grateful", text: "Grateful for you 🙏" },
  { id: "favorite", text: "You’re my favorite person ❤️" },
  { id: "date", text: "Date night?" },
  { id: "proud", text: "Proud of you ⭐️" },
  { id: "coffee", text: "Coffee date at {place} after work? ☕️", placeholders: ["place"] },
  { id: "movie", text: "Movie night at {time}? I’ll bring snacks 🎬", placeholders: ["time"] },
  { id: "picnic", text: "Mini picnic at {place} this {time}? 🧺", placeholders: ["place", "time"] },
  { id: "thank", text: "Thank you for {thing} — it meant a lot 🙏", placeholders: ["thing"] },
];

async function trySendExpoPush(to?: string | null, title?: string, body?: string) {
  if (!to || typeof to !== "string" || !to.startsWith("ExponentPushToken")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ to, title, body }),
    });
  } catch {
    // ignore network failures
  }
}

export default function LoveNotesScreen() {
  const { user } = useAuthListener();
  const [text, setText] = useState("");
  const [toast, setToast] = useState<{ visible: boolean; msg: string; variant?: "success" | "danger" }>({
    visible: false,
    msg: "",
  });
  const [confettiSeed, setConfettiSeed] = useState(0);
  const [firstSent, setFirstSent] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const onPick = (tpl: QuickTemplate) => {
    let t = tpl.text
      .replace("{place}", "somewhere cozy")
      .replace("{time}", "tonight")
      .replace("{thing}", "that moment yesterday");
    setText(t);
    inputRef.current?.focus();
  };

  const onSend = async () => {
    if (!user || !text.trim()) {
      setToast({ visible: true, msg: "Type something sweet first 😊", variant: "danger" });
      return;
    }
    const noteText = text.trim();

    // save note
    const partnerUid = await getPartnerUid(user.uid).catch(() => null);
    const pairId = partnerUid ? [user.uid, partnerUid].sort().join("_") : null;
    await createNote({ ownerId: user.uid, pairId: pairId ?? null, text: noteText });

    // push to partner (if token saved on their user doc)
    if (partnerUid) {
      try {
        const snap = await getDoc(doc(db, "users", partnerUid));
        const token = snap.exists() ? (snap.data() as any)?.expoPushToken : undefined;
        await trySendExpoPush(token, "Love Note 💌", noteText.slice(0, 80));
      } catch {
        // ignore
      }
    }

    setText("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast({ visible: true, msg: "Sent with love 💌", variant: "success" });

    if (!firstSent) {
      setFirstSent(true);
      setConfettiSeed(Math.random()); // tiny confetti on first send
    }
  };

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Love Notes</Text>

      <Card>
        <Input
          ref={inputRef}
          placeholder="Write a sweet note…"
          value={text}
          onChangeText={setText}
          multiline
          style={{ marginBottom: spacing.md }}
        />
        <Button title="Send" onPress={onSend} />
      </Card>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: spacing.lg }}
        contentContainerStyle={{ paddingRight: spacing.lg }}
      >
        {TEMPLATES.map((t) => (
          <PressableScale key={t.id} onPress={() => onPick(t)} style={{ marginRight: spacing.sm }}>
            <Chip label={t.text} />
          </PressableScale>
        ))}
      </ScrollView>

      <Text style={{ ...type.caption, marginTop: spacing.md }}>
        Quick ideas — tap to prefill, then make it yours.
      </Text>

      <ConfettiTiny seed={confettiSeed} />

      <Toast
        visible={toast.visible}
        message={toast.msg}
        variant={toast.variant}
        onHide={() => setToast((v) => ({ ...v, visible: false }))}
      />
    </View>
  );
}
