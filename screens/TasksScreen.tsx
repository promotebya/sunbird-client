import useAuthListener from "@/hooks/useAuthListener";
import { getPairId } from "@/utils/partner";
import { Task, create as createTask, listPersonal, listShared, remove, setDone } from "@/utils/tasks";
import { useEffect, useState } from "react";
import { Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Tab = "Personal" | "Shared";

export default function TasksScreen() {
  const { user } = useAuthListener();
  const [tab, setTab] = useState<Tab>("Personal");
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<Task[]>([]);

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

  useEffect(() => { refresh(); }, [user, tab]);

  const onAdd = async () => {
    if (!user || !title.trim()) return;
    const pairId = tab === "Shared" ? await getPairId(user.uid) : null;
    await createTask({ title: title.trim(), ownerId: user.uid, pairId: pairId ?? null });
    setTitle("");
    refresh();
  };

  const onToggle = async (id?: string, done?: boolean) => {
    if (!id || typeof done === "undefined") return;
    await setDone(id, !done);
    refresh();
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    await remove(id);
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Tasks</Text>

      <View style={styles.row}>
        <Button title="Personal" onPress={() => setTab("Personal")} />
        <Button title="Shared" onPress={() => setTab("Shared")} />
      </View>

      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} value={title} onChangeText={setTitle} placeholder="New task…" />
        <Button title="Add" onPress={onAdd} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id!}
        renderItem={({ item }) => (
          <Pressable onPress={() => onToggle(item.id, item.done)} onLongPress={() => onDelete(item.id)} style={styles.task}>
            <Text style={[styles.taskTitle, item.done && styles.done]}>{item.title}</Text>
            <Text style={styles.doneTag}>{item.done ? "✓" : " "}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  h1: { fontSize: 22, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  task: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, backgroundColor: "#fff" },
  taskTitle: { fontSize: 16 },
  done: { textDecorationLine: "line-through", opacity: 0.6 },
  doneTag: { fontWeight: "700" },
});
