import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import IconTile from "../components/common/IconTile";
import Button from "../components/common/Button";
import { Lead, ScreenTitle, SectionTitle } from "../components/common/Headings";
import JourneyCard from "../components/home/JourneyCard";
import CareToast from "../components/home/CareToast";
import PetMascot from "../components/pet/PetMascot";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import { useJourney } from "../hooks/useJourney";
import { JOURNEY_DAYS, chapterFor, journeyById, journeyLine, lastFinished, partOneOf, sequelFor } from "../domain/journeys";
import { catalogById, renderTitle } from "../domain/plan/catalog";
import { careDoneLine } from "../domain/homeDialogue";
import { completeJourneyTask } from "../services/journeyActions";
import { confirmAsync, notify } from "../utils/confirm";
import { getLocalDateKey } from "../utils/dateKeys";
import { playDing } from "../utils/sfx";
import * as haptics from "../utils/haptics";
import { useTheme } from "../theme/theme";
import { brand, ink, type } from "../theme/tokens";

function humanDate(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(y, m - 1, d));
  } catch {
    return dateKey;
  }
}

/** One journey: its seven days, today's step when it is the active one, and the buttons to start or leave it. */
export default function JourneyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const journey = journeyById(route?.params?.journeyId);
  const { user } = useAuth();
  const pet = usePet();
  const petName = pet.displayName;
  const memorial = !!pet.memorial;
  const theme = useTheme();
  const { surface, night } = theme;
  const today = getLocalDateKey();
  const { state, journey: active, step, start, completeToday, leave } = useJourney(user?.id ?? null, today);
  const isActive = !!journey && active?.id === journey.id;
  const finished = journey ? state.completed.filter((entry) => entry.journeyId === journey.id) : [];
  const latest = journey ? lastFinished(state.completed, journey.id) : null;
  const chapter = journey && latest && !isActive ? chapterFor(journey, latest, petName) : null;
  const sequel = journey ? sequelFor(journey.id) : undefined;
  const partOne = partOneOf(journey);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "queued"; message: string } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const handleStart = useCallback(async () => {
    if (!journey || !user?.id || starting) return;
    if (active && active.id !== journey.id) {
      const ok = await confirmAsync({
        title: `Switch to ${journey.title}?`,
        message: `You're part-way through ${active.title}. Switching sets it aside; you can come back to it from the start any time.`,
        confirmText: "Switch",
        cancelText: "Stay",
      });
      if (!ok) return;
    }
    setStarting(true);
    try {
      await start(journey.id);
      if (memorial) haptics.tapSoft();
      else haptics.success();
      setToast({ id: Date.now(), text: memorial ? "Day one is waiting below." : `${petName} is ready. Day one is waiting below.` });
    } finally {
      setStarting(false);
    }
  }, [active, journey, memorial, petName, start, starting, user?.id]);

  const handleLeave = useCallback(async () => {
    if (!journey) return;
    const ok = await confirmAsync({
      title: "Leave this journey?",
      message: "Nothing is lost: what you did stays done, and you can start it again any time.",
      confirmText: "Leave",
      cancelText: "Keep going",
    });
    if (ok) await leave();
  }, [journey, leave]);

  const handleComplete = useCallback(async () => {
    if (!journey || !step || step.done || !user?.id || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const outcome = await completeJourneyTask(user.id, step.day.taskId, petName, pet.status === "ready" && !!petName && petName !== "Your pet");
      if (outcome.state === "no_row") {
        setNotice({ type: "error", message: "Couldn't save that. Tap to try again." });
        haptics.warning();
        return;
      }
      await completeToday();
      if (!memorial) playDing();
      haptics.tapSoft();
      const points = outcome.state === "success" ? outcome.points : 0;
      const lastDay = step.index + 1 >= JOURNEY_DAYS;
      // memorial never cheers: a quiet acknowledgement instead of the pet's delight
      const text = memorial
        ? lastDay
          ? `${journey.title}: walked all the way through, with ${petName} remembered.`
          : "Done for today. That's enough."
        : lastDay
          ? `${journey.title}: done. ${petName} is so proud of you.`
          : careDoneLine(petName, points, Date.now() / 1000);
      setToast({ id: Date.now(), text });
      if (outcome.state === "queued") setNotice({ type: "queued", message: "Saved on this phone. It syncs when you're back online." });
    } catch (error) {
      console.error("JOURNEY_STEP_ERROR", error);
      haptics.warning();
      setNotice({ type: "error", message: "Couldn't save that. Tap to try again." });
    } finally {
      setSaving(false);
    }
  }, [completeToday, journey, memorial, pet.status, petName, saving, step, user?.id]);

  if (!journey) {
    return (
      <Screen centered>
        <Text style={[type.callout, { color: surface.textSecondary }]}>That journey isn't here any more.</Text>
        <Button label="Back" variant="quiet" size="md" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const tone = theme.tone(journey.category);
  const doneDays = isActive && state.active ? state.active.doneDays : {};
  const task = step ? catalogById(step.day.taskId) : null;

  return (
    <View style={styles.fill}>
      <Screen bottomPad={120}>
        <View style={styles.header}>
          <IconTile icon={journey.icon} category={journey.category} size={60} />
          <View style={styles.headerText}>
            {partOne ? <Text style={[type.micro, { color: tone.accent }]}>PART TWO OF {partOne.title.toUpperCase()}</Text> : null}
            <ScreenTitle>{journey.title}</ScreenTitle>
            <Lead>{journey.blurb}</Lead>
          </View>
        </View>

        {isActive && step ? (
          <View style={styles.today}>
            <JourneyCard
              journeyTitle={journey.title}
              dayIndex={step.index}
              total={step.total}
              dayTitle={step.day.title}
              petLine={journeyLine(step.day.petLine, petName)}
              task={task ? { title: renderTitle(task, petName), category: task.category, icon: task.icon, minutes: task.minutes } : null}
              done={step.done}
              nextTitle={step.next?.title ?? null}
              saving={saving}
              notice={notice}
              onOpen={() => {}}
              onComplete={() => void handleComplete()}
              onRetry={() => void handleComplete()}
              surface={surface}
            />
            {step.day.prompt && !step.done ? (
              <Card tone="connection" onPress={() => navigation.navigate("Journal")} accessibilityLabel="Open the journal for today's question" style={styles.promptCard}>
                <Text style={[type.micro, { color: theme.tone("connection").accent }]}>TODAY'S QUESTION</Text>
                <Text style={[type.body, { color: surface.text }]}>{step.day.prompt}</Text>
                <Text style={[type.meta, { color: surface.textSecondary }]}>Write a line in the journal, if you like.</Text>
              </Card>
            ) : null}
          </View>
        ) : chapter && latest ? (
          // the chapter this journey left behind: when it was walked, the seven lines with their dates
          <Card tone={journey.category} style={styles.doneCard}>
            <View style={styles.doneRow}>
              <PetMascot size={64} mood="happy" showShadow={false} night={night} />
              <View style={styles.doneText}>
                <Text style={[type.micro, { color: tone.accent }]}>A CHAPTER IN YOUR KEEPSAKES</Text>
                <Text style={[type.bodyStrong, { color: surface.text }]}>{chapter.title}</Text>
                <Text style={[type.meta, { color: surface.textSecondary }]}>
                  {humanDate(latest.startedOn)} to {humanDate(latest.finishedOn)}. {chapter.walked}
                </Text>
              </View>
            </View>
            <View style={styles.chapterLines}>
              {chapter.lines.map((line) => (
                <View key={line.index} style={styles.chapterLine}>
                  <Text style={[type.micro, styles.chapterDay, { color: tone.accent }]}>{line.doneOn ? humanDate(line.doneOn).toUpperCase() : `DAY ${line.index + 1}`}</Text>
                  <View style={styles.chapterBody}>
                    <Text style={[type.bodyStrong, { color: surface.text }]}>{line.title}</Text>
                    <Text style={[type.petVoice, { color: surface.textSecondary }]}>{line.petLine}</Text>
                  </View>
                </View>
              ))}
            </View>
            {sequel && active?.id !== sequel.id ? (
              <Button label={`Walk part two: ${sequel.title}`} size="md" onPress={() => navigation.navigate("Journey", { journeyId: sequel.id })} containerStyle={styles.sequelButton} />
            ) : null}
          </Card>
        ) : null}

        <SectionTitle>The seven days</SectionTitle>
        {journey.days.map((day, index) => {
          const doneOn = doneDays[String(index)];
          const isToday = isActive && step && step.index === index && !step.done;
          const locked = isActive ? !doneOn && !isToday : index > 0;
          return (
            <View key={day.title} style={[styles.dayRow, { borderColor: surface.hairline }]} accessible accessibilityLabel={`Day ${index + 1}: ${day.title}${doneOn ? ", done" : isToday ? ", today" : ""}`}>
              <View style={[styles.dayDot, { borderColor: doneOn || isToday ? tone.accent : surface.track, backgroundColor: doneOn ? tone.accent : "transparent" }]}>
                {doneOn ? <Ionicons name="checkmark" size={14} color={night ? ink.primary : brand.cream} /> : <Text style={[type.micro, { color: isToday ? tone.accent : surface.textTertiary }]}>{index + 1}</Text>}
              </View>
              <View style={styles.dayBody}>
                <Text style={[type.bodyStrong, { color: locked && !doneOn ? surface.textSecondary : surface.text }]}>{day.title}</Text>
                <Text style={[type.meta, { color: surface.textTertiary }]} numberOfLines={2}>
                  {doneOn ? `Done ${humanDate(doneOn)}` : isToday ? "Today" : journeyLine(day.petLine, petName)}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={styles.actions}>
          {isActive ? (
            <Button label="Leave this journey" variant="quiet" size="md" onPress={() => void handleLeave()} />
          ) : (
            <Button
              label={finished.length > 0 ? "Walk it again" : active ? `Switch to this journey` : "Start this journey"}
              // when part two is offered above, that is the primary step; walking part one again is the alternative
              variant={sequel && chapter && active?.id !== sequel.id ? "secondary" : "primary"}
              onPress={() => void handleStart()}
              loading={starting}
            />
          )}
        </View>
      </Screen>
      <CareToast toast={toast} bottom={24} petSources={pet.sources} petLook={pet.look} night={night} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  headerText: {
    flex: 1,
  },
  today: {
    marginTop: 18,
  },
  promptCard: {
    gap: 4,
  },
  doneCard: {
    marginTop: 18,
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  doneText: {
    flex: 1,
    gap: 2,
  },
  chapterLines: {
    marginTop: 14,
    gap: 10,
  },
  chapterLine: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  chapterDay: {
    width: 64,
    marginTop: 4,
  },
  chapterBody: {
    flex: 1,
    gap: 1,
  },
  sequelButton: {
    marginTop: 14,
    alignSelf: "flex-start",
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBody: {
    flex: 1,
    marginLeft: 12,
  },
  actions: {
    marginTop: 22,
    alignItems: "center",
  },
});
