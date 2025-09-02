import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import useAuthListener from "../hooks/useAuthListener";
import { getPairId } from "../utils/partner";
import { Task, create as createTask, listPersonal, listShared, remove, setDone } from "../utils/tasks";

import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Input from "../components/Input";
import PressableScale from "../components/PressableScale";
import Toast from "../components/Toast";
import Chip from "../components/ui/Chip"; // ← your existing Chip

import { shared } from "../components/sharedStyles";
import { colors, s } from "../components/tokens";

type Tab = "Personal" | "Shared";

export default function TasksScreen() {
  const { user } = useAuthListener();
  const [tab, setTab] = useState<Tab>("Personal");
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<Task[]>([]);
  const [toast, setToast] = useState<{ visible: boolean; msg: string; variant?: "success" | "danger" }>({
    visible: false,
    msg: "",
  });

  const refresh = async () => {
    if (!user) return;
    if (tab === "Shared") {
      const pairId = await getPairId(user.uid);
      if (!pairId) return setItems([]);
      setItems(await listShared(pairId));
    } else {
      setItems(await listPersonal(user.uid));
    }
  };

  useEffect(() => {
    refresh();
  }, [user, tab]);

  const onAdd = async () => {
    if (!user || !title.trim()) {
      setToast({ visible: true, msg: "Enter a task title", variant: "danger" });
      return;
    }
    const pairId = tab === "Shared" ? await getPairId(user.uid) : null;
    await createTask({ title: title.trim(), ownerId: user.uid, pairId: pairId ?? null });
    setTitle("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast({ visible: true, msg: "Task added!", variant: "success" });
    refresh();
  };

  const onToggle = async (id?: string, done?: boolean) => {
    if (!id || typeof done === "undefined") return;
    await setDone(id, !done);
    Haptics.selectionAsync();
    refresh();
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    await remove(id);
    refresh();
  };

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Tasks</Text>

      <View style={[shared.row, { marginBottom: s.md }]}>
        <Chip label="Personal" selected={tab === "Personal"} onPress={() => setTab("Personal")} />
        <Chip label="Shared" selected={tab === "Shared"} onPress={() => setTab("Shared")} />
      </View>

      <View style={[shared.row, { gap: s.sm, marginBottom: s.md }]}>
        <Input style={{ flex: 1 }} value={title} onChangeText={setTitle} placeholder="New task…" />
        <Button title="Add" small onPress={onAdd} />
      </View>

      {items.length === 0 ? (
        <EmptyState
          emoji="📝"
          title="No tasks yet"
          tip="Try adding ‘Plan a surprise’ 😉"
          cta="Add a task"
          onPress={onAdd}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id!}
          ItemSeparatorComponent={() => <View style={{ height: s.sm }} />}
          renderItem={({ item }) => (
            <PressableScale onPress={() => onToggle(item.id, item.done)} onLongPress={() => onDelete(item.id)}>
              <View
                style={[
                  shared.card,
                  { padding: s.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 16,
                    textDecorationLine: item.done ? "line-through" : "none",
                    opacity: item.done ? 0.6 : 1,
                  }}
                >
                  {item.title}
                </Text>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    borderWidth: 2,
                    borderColor: colors.primary,
                    backgroundColor: item.done ? colors.primary : "transparent",
                  }}
                />
              </View>
            </PressableScale>
          )}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.msg}
        variant={toast.variant}
        onHide={() => setToast((v) => ({ ...v, visible: false }))}
      />
    </View>
  );
}
