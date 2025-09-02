import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  Text,
  View,
} from "react-native";
import useAuthListener from "../hooks/useAuthListener";
import {
  type Memory,
  type MemoryKind, // numeric enum/type from utils
  create,
  listByOwner,
  listByPair,
  remove,
} from "../utils/memories";
import { getPairId } from "../utils/partner";

import Button from "../components/Button";
import Card from "../components/Card";
import ConfettiTiny from "../components/ConfettiTiny";
import EmptyState from "../components/EmptyState";
import Input from "../components/Input";
import PressableScale from "../components/PressableScale";
import SegmentedControl from "../components/SegmentedControl";
import { shared } from "../components/sharedStyles";
import Toast from "../components/Toast";
import { radius, spacing, type } from "../components/tokens";

/** UI Kind (strings for chips) */
const UI_KINDS = ["photo", "text", "milestone"] as const;
type UIKind = (typeof UI_KINDS)[number];

/** Map UI strings <-> numeric MemoryKind used by utils */
const toNumKind = (k: UIKind): number =>
  k === "photo" ? 0 : k === "milestone" ? 2 : 1;

const fromNumKind = (n: number): UIKind =>
  n === 0 ? "photo" : n === 2 ? "milestone" : "text";

const emojiFor = (k: UIKind) => (k === "photo" ? "📸" : k === "milestone" ? "🎯" : "📝");

export default function MemoriesScreen() {
  const { user } = useAuthListener();

  const [items, setItems] = useState<Memory[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  // Use UI strings in state; convert to number only at the util boundary
  const [uiKind, setUiKind] = useState<UIKind>("text");

  const [toast, setToast] = useState<{
    visible: boolean;
    msg: string;
    variant?: "success" | "danger";
  }>({ visible: false, msg: "" });

  const [seed, setSeed] = useState(0);

  const refresh = async () => {
    if (!user) return;
    const pairId = await getPairId(user.uid);
    const data = pairId ? await listByPair(pairId) : await listByOwner(user.uid);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); // list enter animation
    setItems(data);
  };

  useEffect(() => {
    refresh();
  }, [user]);

  const onAdd = async () => {
    if (!user) return;
    if (!title.trim()) {
      setToast({ visible: true, msg: "Oops — please fill this first.", variant: "danger" });
      return;
    }

    const pairId = await getPairId(user.uid);

    // Convert UI string -> numeric MemoryKind expected by utils
    const numericKind = toNumKind(uiKind) as unknown as MemoryKind;

    await create({
      ownerId: user.uid,
      pairId: pairId ?? null,
      title: title.trim(),
      note: note.trim() || undefined,
      kind: numericKind,
    });

    setTitle("");
    setNote("");

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast({ visible: true, msg: "All set 🎉", variant: "success" });
    setSeed(Math.random()); // tiny confetti pop
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    refresh();
  };

  const onLongPressCard = (id?: string) => {
    if (!id) return;
    Haptics.selectionAsync();

    const doRemove = async () => {
      await remove(id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      refresh();
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Delete"], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (i) => i === 1 && void doRemove()
      );
    } else {
      Alert.alert("Memory", "Delete this memory?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doRemove },
      ]);
    }
  };

  const kindLabel = useMemo(() => uiKind, [uiKind]);

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Memories ({kindLabel})</Text>

      <SegmentedControl
        items={[
          { label: "Photo", value: "photo" },
          { label: "Text", value: "text" },
          { label: "Milestone", value: "milestone" },
        ]}
        value={uiKind}
        onChange={(v) => {
          // Defensive: restrict to known UI strings
          if ((UI_KINDS as readonly string[]).includes(v)) {
            setUiKind(v as UIKind);
          } else {
            setUiKind("text");
          }
        }}
      />

      <Card>
        <Input
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
          style={{ marginBottom: spacing.sm }}
        />
        <Input
          placeholder="Note"
          value={note}
          onChangeText={setNote}
          style={{ marginBottom: spacing.md }}
          multiline
        />
        <Button title="Add" onPress={onAdd} />
      </Card>

      <View style={{ height: spacing.md }} />

      {items.length === 0 ? (
        <EmptyState
          emoji={emojiFor(uiKind)}
          title="No memories yet"
          hint="Capture something small from today."
          cta="Add a memory"
          onPress={onAdd}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id!}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => {
            // Convert numeric stored kind back to UI string for display
            const k = fromNumKind(Number(item.kind));

            return (
              <PressableScale onLongPress={() => onLongPressCard(item.id)}>
                <View style={[shared.card, { padding: spacing.md }]}>
                  <View style={shared.between}>
                    <Text style={{ fontWeight: "700", fontSize: 16 }}>{item.title}</Text>
                    <View
                      style={{
                        backgroundColor: "#F1F2F6",
                        borderRadius: radius.pill,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>{k}</Text>
                    </View>
                  </View>
                  {!!item.note && (
                    <Text style={{ ...type.caption, marginTop: 6 }}>{item.note}</Text>
                  )}
                </View>
              </PressableScale>
            );
          }}
        />
      )}

      <ConfettiTiny seed={seed} />

      <Toast
        visible={toast.visible}
        message={toast.msg}
        variant={toast.variant}
        onHide={() => setToast((v) => ({ ...v, visible: false }))}
      />
    </View>
  );
}
