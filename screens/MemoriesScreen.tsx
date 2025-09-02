import { useEffect, useMemo, useState } from "react";
import { Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import useAuthListener from "../hooks/useAuthListener";
import { Memory, MemoryKind, create, listByOwner, listByPair, remove } from "../utils/memories";
import { getPairId } from "../utils/partner";

export default function MemoriesScreen() {
  const { user } = useAuthListener();
  const [items, setItems] = useState<Memory[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<MemoryKind | "photo" | "text" | "milestone">(MemoryKind.Text);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) return;
      const pairId = await getPairId(user.uid);
      const data = pairId ? await listByPair(pairId) : await listByOwner(user.uid);
      if (!cancelled) setItems(data);
    };
    run();
    return () => { cancelled = true; };
  }, [user]);

  const onAdd = async () => {
    if (!user) return;
    const pairId = await getPairId(user.uid);
    await create({
      ownerId: user.uid,
      pairId: pairId ?? null,
      title: title || "Untitled",
      note: note || undefined,
      kind
    });
    const data = pairId ? await listByPair(pairId) : await listByOwner(user.uid);
    setItems(data);
    setTitle("");
    setNote("");
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    await remove(id);
    if (!user) return;
    const pairId = await getPairId(user.uid);
    const data = pairId ? await listByPair(pairId) : await listByOwner(user.uid);
    setItems(data);
  };

  const kindLabel = useMemo(() => (typeof kind === "string" ? kind : String(kind)), [kind]);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Memories ({kindLabel})</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} value={title} onChangeText={setTitle} placeholder="Title" />
      </View>
      <TextInput style={[styles.input, { minHeight: 44 }]} value={note} onChangeText={setNote} placeholder="Note" multiline />
      <View style={styles.row}>
        <Button title="Photo" onPress={() => setKind(MemoryKind.Photo)} />
        <Button title="Text" onPress={() => setKind(MemoryKind.Text)} />
        <Button title="Milestone" onPress={() => setKind(MemoryKind.Milestone)} />
        <Button title="Add" onPress={onAdd} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(m) => m.id!}
        renderItem={({ item }) => (
          <Pressable onLongPress={() => onDelete(item.id)} style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            {!!item.note && <Text style={styles.note}>{item.note}</Text>}
            {!!item.kind && <Text style={styles.tag}>{String(item.kind)}</Text>}
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
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, backgroundColor: "#fff" },
  title: { fontWeight: "700", marginBottom: 4 },
  note: { opacity: 0.9 },
  tag: { marginTop: 6, fontSize: 12, opacity: 0.7 }
});
