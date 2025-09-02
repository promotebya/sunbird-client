import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, FlatList, Platform, Text, View } from "react-native";
import useAuthListener from "../hooks/useAuthListener";
import { Memory, MemoryKind, create, listByOwner, listByPair, remove } from "../utils/memories";
import { getPairId } from "../utils/partner";

import Button from "../components/Button";
import Card from "../components/Card";
import ConfettiTiny from "../components/ConfettiTiny";
import Input from "../components/Input";
import PressableScale from "../components/PressableScale";
import Toast from "../components/Toast";
import Chip from "../components/ui/Chip"; // ← your existing Chip

import { shared } from "../components/sharedStyles";
import { colors, r, s, type } from "../components/tokens";

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const [items, setItems] = useState<Memory[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<MemoryKind | "photo" | "text" | "milestone">(MemoryKind.Text);

  const [toast, setToast] = useState<{ visible: boolean; msg: string; variant?: "success" | "danger" }>({
    visible: false,
    msg: "",
  });
  const [seed, setSeed] = useState(0);

  const refresh = async () => {
    if (!user) return;
    const pairId = await getPairId(user.uid);
    const data = pairId ? await listByPair(pairId) : await listByOwner(user.uid);
    setItems(data);
  };

  useEffect(() => {
    refresh();
  }, [user]);

  const onAdd = async () => {
    if (!user) return;
    if (!title.trim()) {
      setToast({ visible: true, msg: "Please enter a title", variant: "danger" });
      return;
    }
    const pairId = await getPairId(user.uid);
    await create({
      ownerId: user.uid,
      pairId: pairId ?? null,
      title: title.trim(),
      note: note.trim() || undefined,
      kind,
    });
    setTitle("");
    setNote("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast({ visible: true, msg: "Memory added!", variant: "success" });
    setSeed(Math.random());
    refresh();
  };

  const onLongPressCard = (id?: string) => {
    if (!id) return;
    Haptics.selectionAsync();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Delete"], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        async (i) => {
          if (i === 1) {
            await remove(id);
            refresh();
          }
        }
      );
    } else {
      Alert.alert("Memory", "Delete this memory?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => { await remove(id); refresh(); } },
      ]);
    }
  };

  const kindLabel = useMemo(() => (typeof kind === "string" ? kind : String(kind)), [kind]);

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Memories ({kindLabel})</Text>

      <View style={[shared.row, { marginBottom: s.md }]}>
        <Chip label="Photo" selected={kind === MemoryKind.Photo} onPress={() => setKind(MemoryKind.Photo)} />
        <Chip label="Text" selected={kind === MemoryKind.Text} onPress={() => setKind(MemoryKind.Text)} />
        <Chip label="Milestone" selected={kind === MemoryKind.Milestone} onPress={() => setKind(MemoryKind.Milestone)} />
      </View>

      <Card>
        <Input placeholder="Title" value={title} onChangeText={setTitle} style={{ marginBottom: s.sm }} />
        <Input placeholder="Note" value={note} onChangeText={setNote} style={{ marginBottom: s.md }} multiline />
        <Button title="Add" onPress={onAdd} />
      </Card>

      <View style={{ height: s.md }} />

      <FlatList
        data={items}
        keyExtractor={(m) => m.id!}
        ItemSeparatorComponent={() => <View style={{ height: s.sm }} />}
        renderItem={({ item }) => (
          <PressableScale onLongPress={() => onLongPressCard(item.id)}>
            <View style={[shared.card, { padding: s.md }]}>
              <View style={shared.spaceBetween}>
                <Text style={{ fontWeight: "700", fontSize: 16 }}>{item.title}</Text>
                <View
                  style={{
                    backgroundColor: colors.ghost,
                    borderRadius: r.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>{String(item.kind ?? "text")}</Text>
                </View>
              </View>
              {!!item.note && <Text style={{ ...type.dim, marginTop: 6 }}>{item.note}</Text>}
            </View>
          </PressableScale>
        )}
      />

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
