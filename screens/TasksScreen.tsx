import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
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
import { getPairId } from "../utils/partner";
import {
  Task,
  create as createTask,
  listPersonal,
  listShared,
  remove,
  setDone,
} from "../utils/tasks";

import Button from "../components/Button";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import Input from "../components/Input";
import PressableScale from "../components/PressableScale";
import SegmentedControl from "../components/SegmentedControl";
import { shared } from "../components/sharedStyles";
import Toast from "../components/Toast";
import { colors, spacing } from "../components/tokens";

import * as pointsApi from "../utils/points";

type Tab = "Personal" | "Shared";

export default function TasksScreen() {
  const { user } = useAuthListener();
  const [tab, setTab] = useState<Tab>("Personal");
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<Task[]>([]);
  const [toast, setToast] = useState<{
    visible: boolean;
    msg: string;
    variant?: "success" | "danger";
  }>({ visible: false, msg: "" });

  const refresh = async () => {
    if (!user) return;
    let data: Task[] = [];
    if (tab === "Shared") {
      const pairId = await getPairId(user.uid);
      data = pairId ? await listShared(pairId) : [];
    } else {
      data = await listPersonal(user.uid);
    }
    // list enter animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems(data);
  };

  useEffect(() => {
    refresh();
  }, [user, tab]);

  const onAdd = async () => {
    if (!user || !title.trim()) {
      setToast({ visible: true, msg: "Oops — please fill this first.", variant: "danger" });
      return;
    }
    const pairId = tab === "Shared" ? await getPairId(user.uid) : null;
    await createTask({ title: title.trim(), ownerId: user.uid, pairId: pairId ?? null });
    setTitle("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast({ visible: true, msg: "Nice! Added to your list.", variant: "success" });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    refresh();
  };

  const onToggle = async (id?: string, done?: boolean, label?: string) => {
    if (!user || !id || typeof done === "undefined") return;
    const newVal = !done;
    await setDone(id, newVal);
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (newVal === true) {
      try {
        const pairId = tab === "Shared" ? await getPairId(user.uid).catch(() => null) : null;
        const api: any = pointsApi as any;
        const addPoints = api.add || api.create || api.addPoints;
        await addPoints({
          ownerId: user.uid,
          pairId: pairId ?? null,
          amount: 1,
          reason: label ? `Completed: ${label}` : "Task completed",
        });
        setToast({ visible: true, msg: "+1 point added 🎉", variant: "success" });
      } catch {
        // ignore
      }
    }

    refresh();
  };

  const onDelete = (id?: string) => {
    if (!id) return;
    Haptics.selectionAsync();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Delete"], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        async (i) => {
          if (i === 1) {
            await remove(id);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            refresh();
          }
        }
      );
    } else {
      Alert.alert("Delete task?", "", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await remove(id);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            refresh();
          },
        },
      ]);
    }
  };

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Tasks</Text>

      <SegmentedControl
        items={[
          { label: "Personal", value: "Personal" },
          { label: "Shared", value: "Shared" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      <Card style={{ flexDirection: "row", gap: 12 }}>
        <Input style={{ flex: 1 }} value={title} onChangeText={setTitle} placeholder="New task…" />
        <Button title="Add" small onPress={onAdd} />
      </Card>

      {items.length === 0 ? (
        <EmptyState
          emoji="📝"
          title="No tasks yet"
          hint="Try adding ‘Plan a surprise’ 😉"
          cta="Add a task"
          onPress={onAdd}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id!}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => onToggle(item.id, item.done, item.title)}
              onLongPress={() => onDelete(item.id)}
            >
              <View
                style={[
                  shared.card,
                  {
                    padding: spacing.md,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
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
