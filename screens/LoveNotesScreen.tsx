import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import Button from "../components/Button";
import ConfettiTiny from "../components/ConfettiTiny";
import Input from "../components/Input";
import PressableScale from "../components/PressableScale";
import { shared } from "../components/sharedStyles";
import Toast from "../components/Toast";
import { s } from "../components/tokens";
import useAuthListener from "../hooks/useAuthListener";
import { Note, create, listByOwner, listByPair, remove } from "../utils/notes";
import { getPairId } from "../utils/partner";

export default function LoveNotesScreen() {
  const { user } = useAuthListener();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [toast, setToast] = useState<{visible:boolean; msg:string; variant?:'success'|'danger'}>({visible:false,msg:''});
  const [seed, setSeed] = useState(0);

  const refresh = async () => {
    if (!user) return;
    const pairId = await getPairId(user.uid);
    const data = pairId ? await listByPair(pairId) : await listByOwner(user.uid);
    setNotes(data);
  };

  useEffect(() => { refresh(); }, [user]);

  const onAdd = async () => {
    if (!user || !text.trim()) { setToast({visible:true,msg:'Write a note first',variant:'danger'}); return; }
    const pairId = await getPairId(user.uid);
    await create({ ownerId: user.uid, pairId: pairId ?? null, text: text.trim() });
    setText("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast({visible:true,msg:'Note sent',variant:'success'});
    setSeed(Math.random());
    refresh();
  };

  const onDelete = async (id?: string) => { if (!id) return; await remove(id); refresh(); };

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Love Notes</Text>

      <View style={[shared.row, { gap: s.sm, marginBottom: s.md }]}>
        <Input style={{ flex: 1 }} value={text} onChangeText={setText} placeholder="Write a sweet note…" />
        <Button title="Send" variant="link" onPress={onAdd} />
      </View>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id!}
        ItemSeparatorComponent={() => <View style={{ height: s.sm }} />}
        renderItem={({ item }) => (
          <PressableScale onLongPress={() => onDelete(item.id)}>
            <View style={[shared.card, { padding: s.md }]}>
              <Text style={{ fontSize: 16 }}>{item.text}</Text>
            </View>
          </PressableScale>
        )}
      />

      <ConfettiTiny seed={seed} />
      <Toast visible={toast.visible} message={toast.msg} variant={toast.variant} onHide={()=>setToast(v=>({...v,visible:false}))} />
    </View>
  );
}
