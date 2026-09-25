import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { confirmAsync } from "../utils/confirm";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import { supabase } from "../lib/supabase";
import GardenStage from "../components/garden/GardenStage";
import PetRig from "../components/pet/vector/PetRig";
import BreathingModal from "../components/checkin/BreathingModal";
import { clearPetMemorial, savePetMemorial } from "../services/petStore";
import { archiveMemorial, deleteMemory, loadArchive, loadMemories, subscribeMemories, writeMemory, type MemorialArchiveEntry } from "../services/memoryStore";
import { loadPlayStats } from "../games/playStats";
import { MEMORIAL_NOTE_MAX, MEMORY_MAX, Memory, makeMemorial, memorialGreeting, memorialReflection, milestones } from "../domain/memorial";
import { getLocalDateKey } from "../utils/dateKeys";
import { humanDate } from "../domain/calendar";

/**
 * Rainbow Bridge memorial mode. Before it is on: a careful explanation and a confirmation. While it is
 * on: the pet rests in a quiet garden, the daily loop is paused elsewhere in the app, and this screen
 * keeps memories and milestones. It can be undone, and a new companion can move in later while the
 * memorial is kept on this device.
 */
export default function MemorialScreen({ navigation, route }: any) {
  const { user, profile } = useAuth();
  const { look, name, displayName, memorial, refresh } = usePet();
  const { height } = useWindowDimensions();
  const archiveIndex: number | null = typeof route?.params?.archiveIndex === "number" ? route.params.archiveIndex : null;

  const [dateDraft, setDateDraft] = useState(getLocalDateKey());
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [writing, setWriting] = useState(false);
  const [stats, setStats] = useState<{ tasks: number; checkins: number; plants: number; games: number } | null>(null);
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [archive, setArchive] = useState<MemorialArchiveEntry[]>([]);
  const sceneHeight = Math.round(Math.min(320, Math.max(220, height * 0.34)));
  const today = getLocalDateKey();

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const [list, entries] = await Promise.all([loadMemories(user.id), loadArchive(user.id)]);
    setMemories(list);
    setArchive(entries);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return subscribeMemories(() => void reload());
    }, [reload])
  );

  // milestones come from what the app already knows; failures just leave lines out
  useEffect(() => {
    if (!user?.id || !memorial) return;
    let alive = true;
    (async () => {
      try {
        const [tasks, checkins, plants, play] = await Promise.all([
          supabase.from("task_completions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("checkins").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("user_plants").select("plant_id", { count: "exact", head: true }).eq("user_id", user.id),
          loadPlayStats(user.id),
        ]);
        if (!alive) return;
        setStats({ tasks: tasks.count ?? 0, checkins: checkins.count ?? 0, plants: plants.count ?? 0, games: play.sessions });
      } catch {
        if (alive) setStats({ tasks: 0, checkins: 0, plants: 0, games: 0 });
      }
    })();
    return () => {
      alive = false;
    };
  }, [memorial, user?.id]);

  const confirmMemorial = async () => {
    if (!user?.id) return;
    const ok = await confirmAsync({
      title: `Remember ${displayName}?`,
      message: "The garden becomes a quiet memorial and daily tasks pause. You can undo this any time.",
      confirmText: `Remember ${displayName}`,
      cancelText: "Not now",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await savePetMemorial(user.id, makeMemorial(dateDraft, noteDraft, today));
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const undoMemorial = async () => {
    if (!user?.id) return;
    const ok = await confirmAsync({
      title: "Bring the garden back?",
      message: `${displayName} will be awake in the garden again and daily tasks will resume. Your memories stay on this device.`,
      confirmText: "Bring it back",
      cancelText: "Keep the memorial",
    });
    if (!ok) return;
    await clearPetMemorial(user.id);
    await refresh();
  };

  const newCompanion = async () => {
    if (!user?.id || !memorial) return;
    const ok = await confirmAsync({
      title: "A new companion?",
      message: `${displayName}'s memorial and memories are kept on this device under "Remembering ${displayName}". The garden will welcome a new companion.`,
      confirmText: "Continue",
      cancelText: "Not yet",
    });
    if (!ok) return;
    await archiveMemorial(user.id, { petName: name || displayName, look, memorial, memories });
    await clearPetMemorial(user.id);
    await refresh();
    navigation.navigate("Onboarding", { mode: "look" });
  };

  const saveMemory = async () => {
    if (!user?.id || writing || !memoryDraft.trim()) return;
    setWriting(true);
    try {
      setMemories(await writeMemory(user.id, memoryDraft));
      setMemoryDraft("");
    } finally {
      setWriting(false);
    }
  };

  const removeOne = async (memory: Memory) => {
    if (!user?.id) return;
    const ok = await confirmAsync({ title: "Remove this memory?", message: "It will be gone from this device.", confirmText: "Remove", cancelText: "Keep", destructive: true });
    if (ok) setMemories(await deleteMemory(user.id, memory.id));
  };

  const milestoneLines = useMemo(
    () =>
      memorial
        ? milestones({
            petName: displayName,
            togetherSince: profile?.created_at ?? null,
            memorialSince: memorial.since,
            plantsGrown: stats?.plants ?? 0,
            gamesPlayed: stats?.games ?? 0,
            checkins: stats?.checkins ?? 0,
            tasksCompleted: stats?.tasks ?? 0,
          })
        : [],
    [displayName, memorial, profile?.created_at, stats]
  );

  // ---- an archived memorial (a previous companion) ---------------------------------------------------
  if (archiveIndex != null) {
    const entry = archive[archiveIndex];
    if (!entry) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color="#35d07f" />
        </View>
      );
    }
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.restingCard}>
          {entry.look ? <PetRig look={entry.look} size={140} resting /> : null}
          <Text style={styles.title}>Remembering {entry.petName}</Text>
          <Text style={styles.meta}>Since {humanDate(entry.memorial.since)}</Text>
          {entry.memorial.note ? <Text style={styles.note}>"{entry.memorial.note}"</Text> : null}
        </View>
        <Text style={styles.sectionTitle}>Memories</Text>
        {entry.memories.length === 0 ? <Text style={styles.empty}>No memories were written.</Text> : null}
        {entry.memories.map((m) => (
          <View key={m.id} style={styles.memoryCard}>
            <Text style={styles.memoryText}>{m.text}</Text>
            <Text style={styles.memoryDate}>{humanDate(m.date)}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  // ---- before the memorial: explain, then confirm ------------------------------------------------------
  if (!memorial) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>If {displayName} has passed away</Text>
        <Text style={styles.body}>We're so sorry. Luna can turn the garden into a quiet place to remember them.</Text>
        <View style={styles.card}>
          <Row icon="moon" text={`${displayName} rests in the garden. Cheering, prompts and daily tasks pause.`} />
          <Row icon="book-open" text="You keep their name and look, and can write memories here whenever you like." />
          <Row icon="rotate-ccw" text="You can undo this any time, and later welcome a new companion while keeping the memorial." />
        </View>
        <Text style={styles.fieldLabel}>When did they pass? (optional)</Text>
        <TextInput
          value={dateDraft}
          onChangeText={setDateDraft}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="rgba(148,163,184,0.7)"
          style={styles.input}
          autoCapitalize="none"
          accessibilityLabel="Date"
        />
        <Text style={styles.fieldLabel}>A line for them (optional)</Text>
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder={`Something about ${displayName}`}
          placeholderTextColor="rgba(148,163,184,0.7)"
          style={[styles.input, styles.inputMulti]}
          multiline
          maxLength={MEMORIAL_NOTE_MAX}
          accessibilityLabel="A line for them"
        />
        <Pressable style={[styles.primary, saving && styles.disabled]} onPress={confirmMemorial} disabled={saving} accessibilityRole="button">
          {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryText}>Remember {displayName}</Text>}
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.secondaryText}>Not now</Text>
        </Pressable>
        {archive.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Remembered</Text>
            {archive.map((entry, index) => (
              <Pressable key={`${entry.petName}-${index}`} style={styles.archiveRow} onPress={() => navigation.push("Memorial", { archiveIndex: index })} accessibilityRole="button">
                {entry.look ? <PetRig look={entry.look} size={44} resting reducedMotion /> : <Feather name="heart" size={18} color="#fbcfe8" />}
                <Text style={styles.archiveText}>Remembering {entry.petName}</Text>
                <Feather name="chevron-right" size={16} color="rgba(148,163,184,0.8)" />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    );
  }

  // ---- the memorial ----------------------------------------------------------------------------------
  const greeting = memorialGreeting(displayName);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.contentFlush} keyboardShouldPersistTaps="handled">
      <View style={styles.sceneWrap}>
        <GardenStage height={sceneHeight} variant="pet" petLook={look} petResting petScale={1.05} accessibilityLabel={`${displayName} resting in a quiet garden`}>
          <View style={styles.sceneText} pointerEvents="none">
            <Text style={styles.sceneTitle}>{greeting.title}</Text>
            <Text style={styles.sceneSub}>Since {humanDate(memorial.since)}</Text>
          </View>
        </GardenStage>
      </View>
      <View style={styles.contentInner}>
        <Text style={styles.reflection}>{memorialReflection(today)}</Text>
        {memorial.note ? <Text style={styles.note}>"{memorial.note}"</Text> : null}

        <View style={styles.actionsRow}>
          <Pressable style={styles.action} onPress={() => setBreathingOpen(true)} accessibilityRole="button">
            <Feather name="wind" size={16} color="#a7f3d0" />
            <Text style={styles.actionText}>Sit quietly for a minute</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Write a memory</Text>
        <TextInput
          value={memoryDraft}
          onChangeText={setMemoryDraft}
          placeholder={`Something you don't want to forget about ${displayName}`}
          placeholderTextColor="rgba(148,163,184,0.7)"
          style={[styles.input, styles.inputMulti]}
          multiline
          maxLength={MEMORY_MAX}
          accessibilityLabel="Write a memory"
        />
        <Pressable style={[styles.primary, (!memoryDraft.trim() || writing) && styles.disabled]} onPress={saveMemory} disabled={!memoryDraft.trim() || writing} accessibilityRole="button">
          <Text style={styles.primaryText}>{writing ? "Saving…" : "Keep this memory"}</Text>
        </Pressable>

        {memories.length > 0 ? <Text style={styles.sectionTitle}>Memories</Text> : null}
        {memories.map((m) => (
          <Pressable key={m.id} style={styles.memoryCard} onLongPress={() => removeOne(m)} accessibilityRole="text" accessibilityHint="Long press to remove">
            <Text style={styles.memoryText}>{m.text}</Text>
            <Text style={styles.memoryDate}>{humanDate(m.date)}</Text>
          </Pressable>
        ))}

        {milestoneLines.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Together</Text>
            <View style={styles.card}>
              {milestoneLines.map((line) => (
                <Row key={line} icon="sun" text={line} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable style={styles.linkButton} onPress={newCompanion} accessibilityRole="button">
            <Text style={styles.linkText}>Welcome a new companion</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={undoMemorial} accessibilityRole="button">
            <Text style={styles.linkText}>This was a mistake</Text>
          </Pressable>
        </View>
      </View>
      <BreathingModal visible={breathingOpen} onClose={() => setBreathingOpen(false)} />
    </ScrollView>
  );
}

function Row({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={16} color="#fbcfe8" />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1420" },
  content: { padding: 20, paddingBottom: 60 },
  contentFlush: { paddingBottom: 60 },
  contentInner: { paddingHorizontal: 20, paddingTop: 14 },
  sceneWrap: { overflow: "hidden", borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  sceneText: { position: "absolute", top: 16, left: 16, right: 16 },
  sceneTitle: { color: "#ffffff", fontSize: 26, fontWeight: "800", textShadowColor: "rgba(15,23,42,0.65)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  sceneSub: { marginTop: 4, color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600", textShadowColor: "rgba(15,23,42,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  restingCard: { alignItems: "center", paddingVertical: 16, borderRadius: 22, backgroundColor: "rgba(18,24,38,0.95)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "800", textAlign: "center" },
  body: { marginTop: 10, color: "rgba(203,213,225,0.92)", fontSize: 15, lineHeight: 22, textAlign: "center" },
  meta: { marginTop: 6, color: "rgba(148,163,184,0.9)", fontSize: 12 },
  note: { marginTop: 10, marginHorizontal: 6, color: "#fbcfe8", fontSize: 14, fontStyle: "italic", textAlign: "center", lineHeight: 20 },
  reflection: { color: "rgba(226,232,240,0.95)", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 4 },
  card: { marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: "rgba(18,24,38,0.95)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" },
  row: { flexDirection: "row", alignItems: "flex-start", marginVertical: 6 },
  rowText: { flex: 1, marginLeft: 10, color: "rgba(226,232,240,0.92)", fontSize: 13, lineHeight: 19 },
  fieldLabel: { marginTop: 16, color: "rgba(148,163,184,0.95)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { marginTop: 8, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "rgba(148,163,184,0.4)", backgroundColor: "rgba(15,23,42,0.6)", color: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  inputMulti: { minHeight: 76 },
  primary: { marginTop: 18, minHeight: 50, borderRadius: 999, backgroundColor: "#35d07f", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  secondary: { marginTop: 10, minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "rgba(203,213,225,0.95)", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  actionsRow: { marginTop: 14 },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: "rgba(52,211,153,0.5)", backgroundColor: "rgba(16,185,129,0.12)" },
  actionText: { marginLeft: 8, color: "#a7f3d0", fontSize: 14, fontWeight: "700" },
  sectionTitle: { marginTop: 22, marginBottom: 6, color: "rgba(148,163,184,0.95)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  empty: { color: "rgba(148,163,184,0.85)", fontSize: 13 },
  memoryCard: { marginTop: 8, padding: 14, borderRadius: 16, backgroundColor: "rgba(18,24,38,0.95)", borderWidth: 1, borderColor: "rgba(244,114,182,0.25)" },
  memoryText: { color: "#f8fafc", fontSize: 14, lineHeight: 20 },
  memoryDate: { marginTop: 6, color: "rgba(148,163,184,0.85)", fontSize: 11 },
  archiveRow: { flexDirection: "row", alignItems: "center", marginTop: 8, padding: 12, borderRadius: 16, backgroundColor: "rgba(18,24,38,0.95)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" },
  archiveText: { flex: 1, marginLeft: 12, color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
  footer: { marginTop: 26, flexDirection: "row", justifyContent: "space-between" },
  linkButton: { paddingVertical: 8 },
  linkText: { color: "rgba(203,213,225,0.9)", fontSize: 13, fontWeight: "700" },
});
