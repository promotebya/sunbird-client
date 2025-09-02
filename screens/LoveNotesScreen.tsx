import { useEffect, useState } from "react";
import { Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import useAuthListener from "../hooks/useAuthListener";
import { Note, create, listByOwner, listByPair, remove } from "../utils/notes";
import { getPairId } from "../utils/partner";

export default function LoveNotesScreen() {
  const { user } = useAuthListener();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");

  const refresh = async () => {
    if (!user) return;
    const pairId = await getPairId(user.uid);
    const data = pairId ? await listByPair(pairId) : await listByOwner(user.uid);
    setNotes(data);
  };

  useEffect(() => { refresh(); }, [user]);

  const onAdd = async () => {
    if (!user || !text.trim()) return;
    const pairId = await getPairId(user.uid);
    await create({ ownerId: user.uid, pairId: pairId ?? null, text: text.trim() });
    setText("");
    refresh();
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    await remove(id);
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Love Notes</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={text}
          onChangeText={setText}
          placeholder="Write a sweet note…"
        />
        <Button title="Send" onPress={onAdd} />
      </View>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id!}
        renderItem={({ item }) => (
          <Pressable onLongPress={() => onDelete(item.id)} style={styles.card}>
            <Text style={styles.text}>{item.text}</Text>
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
  text: { fontSize: 16 }
});
