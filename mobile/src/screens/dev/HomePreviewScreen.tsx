import React, { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeView, { type HomeTask } from "../../components/home/HomeView";
import FocusPickerSheet from "../../components/home/FocusPickerSheet";
import { DEFAULT_LOOK } from "../../domain/petLook";
import { dayPhase, phaseGreeting } from "../../domain/timeOfDay";
import { homePetLine, careDoneLine } from "../../domain/homeDialogue";
import { FOCUS_AREAS } from "../../domain/plan/focusAreas";
import type { Energy, FocusArea } from "../../domain/plan/types";
import type { PetReaction } from "../../components/pet/PetPortrait";
import { energyOption } from "../../domain/energy";

// Dev-only design preview of Home with fixture data, so the layout can be checked in a browser without
// signing in (web: append ?preview=home, optionally &hour=21 or &theme=nook). Never shipped: RootNavigator
// only routes here under __DEV__ on web.

const FIXTURE_TASKS: HomeTask[] = [
  { key: "hydrate", title: "Drink water", category: "nourish", icon: "water-outline", minutes: 1, reason: "A quick win", done: false, saving: false, notice: null, opens: false },
  { key: "breathe", title: "Breathe with Biscuit for one minute", category: "calm", icon: "leaf-outline", minutes: 1, reason: "For your calm", done: false, saving: false, notice: null, opens: true },
  { key: "outside", title: "Go outside / get sunlight", category: "body", icon: "sunny-outline", minutes: 5, reason: "For your body", done: true, saving: false, notice: null, opens: false },
  { key: "play", title: "Play with Biscuit", category: "play", icon: "tennisball-outline", minutes: 2, reason: "Biscuit asked", done: false, saving: false, notice: null, opens: true },
];

function weekFixture() {
  const out: Array<{ day: string; activity_count: number }> = [];
  const counts = [2, 0, 3, 1, 4, 0, 2];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(2026, 9, 15 - i));
    out.push({ day: date.toISOString().slice(0, 10), activity_count: counts[6 - i] });
  }
  return out;
}

function queryParam(name: string): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch (_error) {
    return null;
  }
}

export default function HomePreviewScreen() {
  const insets = useSafeAreaInsets();
  const hourParam = Number(queryParam("hour"));
  const hour = Number.isFinite(hourParam) && queryParam("hour") !== null ? hourParam : new Date().getHours();
  const theme = queryParam("theme") === "nook" ? "nook" : "garden";
  const phase = dayPhase(hour);
  const [tasks, setTasks] = useState(FIXTURE_TASKS);
  const [energy, setEnergy] = useState<Energy | null>(queryParam("energy") as Energy | null);
  const [focus, setFocus] = useState<FocusArea[]>(queryParam("focus") === "none" ? [] : ["calm_mind", "sleep"]);
  const [focusOpen, setFocusOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const done = tasks.filter((task) => task.done).length;
  const focusAreas = focus.map((id) => FOCUS_AREAS.find((area) => area.id === id)).filter(Boolean) as typeof FOCUS_AREAS;
  const look = useMemo(() => (theme === "nook" ? DEFAULT_LOOK.cat : DEFAULT_LOOK.dog), [theme]);

  return (
    <>
      <HomeView
        topInset={insets.top}
        phase={phase}
        hour={hour}
        greeting={phaseGreeting(phase)}
        subline="Thursday, October 15"
        petLine={homePetLine({ petName: "Biscuit", phase, energy, done, total: tasks.length, returning: false, place: theme === "nook" ? "window nook" : "garden", focus: focusAreas[0]?.short ?? null, seed: "2026-10-15" })}
        daysTogether={14}
        sprouts={38}
        theme={theme}
        petName="Biscuit"
        petLook={look}
        petSources={null}
        plants={[{ id: "1", level: 2, maxLevel: 5 }, { id: "2", level: 5, maxLevel: 5 }]}
        petMood={energyOption(energy)?.petMood ?? "calm"}
        petReaction={reaction}
        onPetReactionEnd={() => setReaction(null)}
        onPetPress={() => setReaction("love")}
        memorial={null}
        energy={energy}
        onEnergy={setEnergy}
        focusChosen={focus.length > 0}
        focusLabel={focusAreas.length ? focusAreas.map((area) => area.short).join(" · ") : null}
        focusCategory={focusAreas[0]?.category ?? null}
        onOpenFocus={() => setFocusOpen(true)}
        tasks={tasks}
        loadingTasks={false}
        tasksError={null}
        onRetryTasks={() => {}}
        onCompleteTask={(key) => {
          setTasks((prev) => prev.map((task) => (task.key === key ? { ...task, done: true } : task)));
          setReaction("cheer");
          setToast({ id: Date.now(), text: careDoneLine("Biscuit", 2, done) });
        }}
        onOpenTask={(key) => setToast({ id: Date.now(), text: `Would open ${key}` })}
        more={[
          { key: "play", title: "Play fetch", subtitle: "Biscuit has the ball ready", icon: "tennisball-outline", category: "play", onPress: () => {} },
          { key: "breathe", title: "Breathe together", subtitle: "One slow minute", icon: "leaf-outline", category: "calm", onPress: () => {} },
          { key: "journal", title: "Write to Biscuit", subtitle: "Today's question is waiting", icon: "book-outline", category: "connection", onPress: () => {} },
          { key: "checkin", title: "Check in", subtitle: "How did today feel?", icon: "sunny-outline", category: "energy", onPress: () => {} },
          { key: "cycle", title: "Rhythm", subtitle: "Private, on this phone", icon: "flower-outline", category: "cycle", onPress: () => {} },
        ]}
        week={weekFixture()}
        loadingWeek={false}
        onOpenWeek={() => {}}
        footerLinks={[{ label: "All tasks", onPress: () => {} }, { label: "Habits", onPress: () => {} }]}
        toast={toast}
        refreshing={false}
        onRefresh={() => {}}
      />
      <FocusPickerSheet
        visible={focusOpen}
        initial={focus}
        petName="Biscuit"
        onClose={() => setFocusOpen(false)}
        onSave={(areas) => {
          setFocus(areas);
          setFocusOpen(false);
        }}
      />
    </>
  );
}
