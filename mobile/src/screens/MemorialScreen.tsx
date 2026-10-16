import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { confirmAsync } from "../utils/confirm";
import { sanctuaryCopy, sanctuaryFor } from "../domain/sanctuary";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import { supabase } from "../lib/supabase";
import GardenStage from "../components/garden/GardenStage";
import PetRig from "../components/pet/vector/PetRig";
import BreathingModal from "../components/checkin/BreathingModal";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import IconTile from "../components/common/IconTile";
import PressableScale from "../components/common/PressableScale";
import TextField from "../components/common/TextField";
import { ListGroup } from "../components/common/ListGroup";
import { Lead, ScreenTitle, SectionTitle } from "../components/common/Headings";
import PetMascot from "../components/pet/PetMascot";
import { PetLoading } from "../components/pet/PetMoments";
import { useTheme, useThemeHour } from "../theme/theme";
import { fonts, radius, space, type } from "../theme/tokens";
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
 * memorial is kept on this device. Colour: calm lavender, with plum for the one deliberate action.
 */
export default function MemorialScreen({ navigation, route }: any) {
  const { user, profile } = useAuth();
  const { sources, look, name, displayName, memorial, refresh } = usePet();
  const theme = useTheme();
  const { surface, sky, night } = theme;
  const hour = useThemeHour();
  const place = sanctuaryCopy(sanctuaryFor(look?.species)).place;
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
      title: `Bring the ${place} back?`,
      message: `${displayName} will be awake in the ${place} again and daily tasks will resume. Your memories stay on this device.`,
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
        <Screen scroll={false} centered>
          <PetLoading />
        </Screen>
      );
    }
    return (
      <Screen>
        <Card tone="calm" style={styles.restingCard}>
          {entry.look ? <PetRig look={entry.look} size={140} resting /> : <IconTile icon="heart-outline" category="calm" on="fill" size={56} round />}
          <ScreenTitle center style={styles.restingTitle}>
            Remembering {entry.petName}
          </ScreenTitle>
          <Text style={[type.meta, styles.restingMeta, { color: surface.textSecondary }]}>Since {humanDate(entry.memorial.since)}</Text>
          {entry.memorial.note ? <Text style={[type.body, styles.quote, { color: surface.text }]}>"{entry.memorial.note}"</Text> : null}
        </Card>
        <SectionTitle>Memories</SectionTitle>
        {entry.memories.length === 0 ? <Lead>No memories were written.</Lead> : null}
        {entry.memories.map((m) => (
          <MemoryCard key={m.id} memory={m} />
        ))}
      </Screen>
    );
  }

  // ---- before the memorial: explain, then confirm ------------------------------------------------------
  if (!memorial) {
    return (
      <Screen keyboard>
        <View style={styles.introHero}>
          <PetMascot size={96} mood="calm" night={night} />
          <ScreenTitle center style={styles.introTitle}>
            If {displayName} has passed away
          </ScreenTitle>
          <Lead center style={styles.introBody}>
            We're so sorry. Luna can turn the {place} into a quiet place to remember them.
          </Lead>
        </View>
        <Card tone="calm" style={styles.block}>
          <CalmRow icon="moon-outline" text={`${displayName} rests in the ${place}. Cheering, prompts and daily tasks pause.`} />
          <CalmRow icon="book-outline" text="You keep their name and look, and can write memories here whenever you like." />
          <CalmRow icon="arrow-undo-outline" text="You can undo this any time, and later welcome a new companion while keeping the memorial." />
        </Card>
        <TextField
          label="When did they pass? (optional)"
          value={dateDraft}
          onChangeText={setDateDraft}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          accessibilityLabel="Date"
          containerStyle={styles.field}
        />
        <TextField
          label="A line for them (optional)"
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder={`Something about ${displayName}`}
          multiline
          maxLength={MEMORIAL_NOTE_MAX}
          accessibilityLabel="A line for them"
          containerStyle={styles.field}
          style={styles.multiline}
        />
        <Button label={`Remember ${displayName}`} variant="plum" onPress={confirmMemorial} loading={saving} containerStyle={styles.plumButton} />
        <Button label="Not now" variant="quiet" size="md" onPress={() => navigation.goBack()} containerStyle={styles.notNow} />
        {archive.length > 0 ? (
          <View>
            <SectionTitle>Remembered</SectionTitle>
            <ListGroup>
              {archive.map((entry, index) => (
                <PressableScale
                  key={`${entry.petName}-${index}`}
                  onPress={() => navigation.push("Memorial", { archiveIndex: index })}
                  pressedScale={0.98}
                  accessibilityRole="button"
                  accessibilityLabel={`Remembering ${entry.petName}`}
                  style={styles.archiveRow}
                >
                  {entry.look ? <PetRig look={entry.look} size={44} resting reducedMotion /> : <IconTile icon="heart-outline" category="calm" size={36} />}
                  <Text style={[type.callout, styles.archiveText, { color: surface.text }]}>Remembering {entry.petName}</Text>
                  <Ionicons name="chevron-forward" size={18} color={surface.textTertiary} />
                </PressableScale>
              ))}
            </ListGroup>
          </View>
        ) : null}
      </Screen>
    );
  }

  // ---- the memorial ----------------------------------------------------------------------------------
  const greeting = memorialGreeting(displayName);
  return (
    <Screen padded={false} keyboard bottomPad={60}>
      <View style={styles.sceneWrap}>
        {/* the painted portrait when there is one (as on the Pet tab), resting; the rig stands in otherwise */}
        <GardenStage
          height={sceneHeight}
          variant="pet"
          hour={hour}
          petImageSources={sources}
          petLook={look}
          petResting
          petScale={1.05}
          accessibilityLabel={`${displayName} resting in a quiet garden`}
        >
          {/* a soft veil from the top, in the sky's own colour, keeps the title readable (as on Home) */}
          <LinearGradient pointerEvents="none" colors={sky.veil} style={styles.veil} />
          <View style={styles.sceneText} pointerEvents="none">
            <Text style={[type.title, { color: sky.text }]} accessibilityRole="header">
              {greeting.title}
            </Text>
            <Text style={[type.meta, styles.sceneSub, { color: sky.textSecondary }]}>Since {humanDate(memorial.since)}</Text>
          </View>
        </GardenStage>
      </View>
      <View style={styles.contentInner}>
        <Text style={[type.body, styles.reflection, { color: surface.text }]}>{memorialReflection(today)}</Text>
        {memorial.note ? <Text style={[type.body, styles.quote, { color: surface.textSecondary }]}>"{memorial.note}"</Text> : null}

        <Card tone="calm" onPress={() => setBreathingOpen(true)} accessibilityLabel="Sit quietly for a minute" style={styles.quietCard}>
          <View style={styles.quietRow}>
            <IconTile icon="leaf-outline" category="calm" on="fill" size={40} />
            <Text style={[type.bodyStrong, styles.quietText, { color: surface.text }]}>Sit quietly for a minute</Text>
            <Ionicons name="chevron-forward" size={18} color={surface.textTertiary} />
          </View>
        </Card>

        <SectionTitle>Write a memory</SectionTitle>
        <TextField
          value={memoryDraft}
          onChangeText={setMemoryDraft}
          placeholder={`Something you don't want to forget about ${displayName}`}
          multiline
          maxLength={MEMORY_MAX}
          accessibilityLabel="Write a memory"
          style={styles.multiline}
        />
        <Button
          label={writing ? "Saving…" : "Keep this memory"}
          variant="plum"
          onPress={saveMemory}
          disabled={!memoryDraft.trim() || writing}
          containerStyle={styles.keepButton}
        />

        {memories.length > 0 ? <SectionTitle>Memories</SectionTitle> : null}
        {memories.map((m) => (
          <MemoryCard key={m.id} memory={m} onLongPress={() => removeOne(m)} />
        ))}

        {milestoneLines.length > 0 ? (
          <View>
            <SectionTitle>Together</SectionTitle>
            <Card tone="calm">
              {milestoneLines.map((line) => (
                <CalmRow key={line} icon="sunny-outline" text={line} />
              ))}
            </Card>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button label="Welcome a new companion" variant="quiet" size="sm" onPress={newCompanion} />
          <Button label="This was a mistake" variant="quiet" size="sm" onPress={undoMemorial} />
        </View>
      </View>
      <BreathingModal visible={breathingOpen} onClose={() => setBreathingOpen(false)} />
    </Screen>
  );
}

/** An icon in a soft lavender tile and a line beside it (the promises before, the milestones after). */
function CalmRow({ icon, text }: { icon: string; text: string }) {
  const { surface } = useTheme();
  return (
    <View style={styles.row}>
      <IconTile icon={icon} category="calm" on="fill" size={36} />
      <Text style={[type.callout, styles.rowText, { color: surface.text }]}>{text}</Text>
    </View>
  );
}

/** One written memory on paper; long press removes it where that is allowed. */
function MemoryCard({ memory, onLongPress }: { memory: Memory; onLongPress?: () => void }) {
  const { surface } = useTheme();
  return (
    <Card
      onLongPress={onLongPress}
      accessibilityRole={onLongPress ? "text" : undefined}
      accessibilityHint={onLongPress ? "Long press to remove" : undefined}
      style={styles.memoryCard}
    >
      <Text style={[type.body, { color: surface.text }]}>{memory.text}</Text>
      <Text style={[type.meta, styles.memoryDate, { color: surface.textTertiary }]}>{humanDate(memory.date)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 16 },
  // archived
  restingCard: { alignItems: "center", paddingVertical: 20 },
  restingTitle: { marginTop: 10 },
  restingMeta: { marginTop: 4 },
  quote: { marginTop: 12, marginHorizontal: 6, textAlign: "center", fontFamily: fonts.bodyMedium },
  // before
  introHero: { alignItems: "center", paddingTop: 4 },
  introTitle: { marginTop: 12 },
  introBody: { marginTop: 8, paddingHorizontal: 4 },
  field: { marginTop: 18 },
  multiline: { minHeight: 96 },
  plumButton: { marginTop: 22 },
  notNow: { alignSelf: "center", marginTop: 6 },
  archiveRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60 },
  archiveText: { flex: 1, fontFamily: fonts.bodyBold },
  // the memorial
  sceneWrap: { overflow: "hidden", borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero, borderCurve: "continuous" },
  veil: { position: "absolute", left: 0, right: 0, top: 0, height: 140 },
  sceneText: { position: "absolute", top: 16, left: space.gutter, right: space.gutter },
  sceneSub: { marginTop: 2 },
  contentInner: { paddingHorizontal: space.gutter, paddingTop: 18 },
  reflection: { textAlign: "center" },
  quietCard: { marginTop: 18 },
  quietRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  quietText: { flex: 1 },
  keepButton: { marginTop: 14 },
  memoryCard: { marginTop: 10 },
  memoryDate: { marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 6 },
  rowText: { flex: 1 },
  footer: { marginTop: 28, flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
});
