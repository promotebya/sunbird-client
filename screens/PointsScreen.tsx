import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, Button, StyleSheet, Alert } from "react-native";
import useAuthListener from "@/hooks/useAuthListener";
import { PointEvent, add as addPoint, listenPoints } from "@/utils/points";
import { getPairId } from "@/utils/partner";

export default function PointsScreen() {
  const { user } = useAuthListener();
  const [events, setEvents] = useState<PointEvent[]>([]);
  const [delta, setDelta] = useState<string>("1");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const run = async () => {
      if (!user) return;
      const pairId = await getPairId(user.uid);
      unsub = listenPoints(
        pairId ? { pairId } : { uid: user.uid },
        (evts) => setEvents(evts)
      );
    };
    run();
    return () => { if (unsub) unsub(); };
  }, [user]);

  const onAdd = async () => {
    if (!user) return;
    const pairId = await getPairId(user.uid);
    const val = Number(delta);
    if (Number.isNaN(val)) return Alert.alert("Invalid number", "Delta must be a number.");
    await addPoint({ uid: user.uid, pairId: pairId ?? null, delta: val, reason: reason || undefined });
    setReason("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Points</Text>

      <View style={styles.row}>
        <TextInput
          style={[styles.input, { width: 80 }]}
          keyboardType="numeric"
          value={delta}
          onChangeText={setDelta}
          placeholder="Δ"
        />
        <TextInput style={[styles.input, { flex: 1 }]} value={reason} onChangeText={setReason} placeholder="Reason" />
        <Button title="Add" onPress={onAdd} />
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id!}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <Text style={styles.delta}>{item.delta > 0 ? `+${item.delta}` : item.delta}</Text>
            <Text style={styles.reason}>{ite
