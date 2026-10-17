import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Chip from "../components/common/Chip";
import Button from "../components/common/Button";
import { Lead, ScreenTitle, SectionTitle } from "../components/common/Headings";
import PetMascot from "../components/pet/PetMascot";
import { PetLoading } from "../components/pet/PetMoments";
import { usePet } from "../hooks/usePet";
import { useCozyRun } from "../hooks/useCozyRun";
import { useTheme } from "../theme/theme";
import { space, type } from "../theme/tokens";
import { MAX_BLANKETS, PAUSE_MAX_DAYS, blanketLine, chapterLine, cozyCover, cozyHeadline, type CozyDayKind } from "../domain/cozyRun";
import { parseDateKey } from "../utils/dateKeys";

const PAUSE_CHOICES = [1, 3, 7, 14, PAUSE_MAX_DAYS];

// how each day looks in the strip: what kept the run going, never what was missing
const DAY_LOOK: Record<CozyDayKind, { icon: string | null; category: string; label: string }> = {
  care: { icon: "leaf", category: "body", label: "a day of care" },
  nap: { icon: "moon-outline", category: "rest", label: "a Nap Day" },
  blanket: { icon: "bed-outline", category: "energy", label: "a Warm Blanket" },
  cycle: { icon: "flower-outline", category: "cycle", label: "a period day, covered" },
  pause: { icon: "pause-outline", category: "calm", label: "paused" },
  mended: { icon: "heart-outline", category: "connection", label: "mended" },
  resting: { icon: "ellipsis-horizontal", category: "calm", label: "resting" },
  today: { icon: null, category: "body", label: "today" },
  quiet: { icon: null, category: "body", label: "a quiet day" },
};

const RULES: { icon: string; category: string; text: string }[] = [
  { icon: "leaf-outline", category: "body", text: "Any care counts: a small thing, a check-in, a journey step or a game. A day ends at 3 a.m." },
  { icon: "moon-outline", category: "rest", text: "Two Nap Days a week cover quiet days on their own." },
  { icon: "bed-outline", category: "energy", text: `Every 7 days of care earn a Warm Blanket (up to ${MAX_BLANKETS}). They are never sold.` },
  { icon: "flower-outline", category: "cycle", text: "Period days you log in Cycle tracking are always covered." },
  { icon: "pause-outline", category: "calm", text: `Need a break? Pause for 1 to ${PAUSE_MAX_DAYS} days.` },
  { icon: "heart-outline", category: "connection", text: "If a run rests, three days of care within five mend it. If not, it is kept as a chapter. A run never breaks." },
];

function weekdayInitial(day: string): string {
  const date = parseDateKey(day);
  return date ? date.toLocaleDateString("en-GB", { weekday: "narrow" }) : "";
}

/**
 * The Cozy Run (src/domain/cozyRun.ts): how many days of care in a row, what is keeping it safe, the last two weeks
 * as small marks, a pause, and the runs kept as chapters. Days Together stays the headline elsewhere.
 */
export default function CozyRunScreen() {
  const { displayName, memorial } = usePet();
  const theme = useTheme();
  const { surface } = theme;
  const { state, loading, stale, chapters, startPause, endPause } = useCozyRun();
  const [pausing, setPausing] = useState(false);

  if (loading || !state) {
    return (
      <Screen>
        <PetLoading label="Counting the cozy days" />
      </Screen>
    );
  }

  const choosePause = async (days: number) => {
    setPausing(true);
    try {
      await startPause(days);
    } finally {
      setPausing(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <PetMascot size={92} mood={state.status === "resting" ? "calm" : "happy"} />
        <View style={styles.heroText}>
          <Text style={[type.display, { color: surface.text }]} accessibilityLabel={`${state.days} days in your cozy run`}>
            {state.days}
          </Text>
          <Text style={[type.meta, { color: surface.textSecondary }]}>{state.days === 1 ? "day in your cozy run" : "days in your cozy run"}</Text>
        </View>
      </View>
      <ScreenTitle style={styles.title}>{cozyHeadline(state, displayName)}</ScreenTitle>
      {state.status !== "none" ? <Lead style={styles.lead}>{cozyCover(state)}</Lead> : null}
      {stale ? <Text style={[type.meta, styles.note, { color: surface.textTertiary }]}>Showing what this phone remembers; it updates when you're back online.</Text> : null}

      <Card style={styles.block}>
        <Text style={[type.bodyStrong, { color: surface.text }]}>The last two weeks</Text>
        <View style={styles.strip}>
          {state.recent.map(({ day, kind }) => {
            const look = DAY_LOOK[kind];
            const tone = theme.tone(look.category);
            const filled = kind === "care";
            const ringed = kind === "today";
            return (
              <View key={day} style={styles.dayCell} accessible accessibilityLabel={`${weekdayInitial(day)}: ${look.label}`}>
                <View
                  style={[
                    styles.dayDot,
                    { backgroundColor: filled ? tone.accent : look.icon ? tone.fill : surface.sunken },
                    ringed && { borderWidth: 2, borderColor: theme.bloom, backgroundColor: "transparent" },
                  ]}
                >
                  {look.icon ? <Ionicons name={look.icon as any} size={12} color={filled ? surface.paper : tone.accent} /> : null}
                </View>
                <Text style={[type.micro, { color: surface.textTertiary }]}>{weekdayInitial(day)}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {state.status !== "none" ? (
        <Card style={styles.block}>
          <View style={styles.blankets}>
            {Array.from({ length: MAX_BLANKETS }, (_, i) => (
              <Ionicons key={i} name={i < state.blankets ? "bed" : "bed-outline"} size={22} color={theme.tone("energy").accent} style={styles.blanketIcon} />
            ))}
          </View>
          <Text style={[type.body, { color: surface.textSecondary }]}>{blanketLine(state)}</Text>
        </Card>
      ) : null}

      {!memorial ? (
        <Card tone="calm" style={styles.block}>
          {state.pause ? (
            <>
              <Text style={[type.bodyStrong, { color: surface.text }]}>Paused</Text>
              <Text style={[type.body, styles.cardLine, { color: surface.textSecondary }]}>Quiet days are covered while the pause lasts. Care still counts.</Text>
              <Button label="End the pause" variant="secondary" size="md" onPress={() => void endPause()} containerStyle={styles.cardButton} />
            </>
          ) : (
            <>
              <Text style={[type.bodyStrong, { color: surface.text }]}>Need a break?</Text>
              <Text style={[type.body, styles.cardLine, { color: surface.textSecondary }]}>
                Pause the run and every quiet day is covered, starting today. {displayName} will be here.
              </Text>
              <View style={styles.chips}>
                {PAUSE_CHOICES.map((days) => (
                  <Chip key={days} label={days === 1 ? "1 day" : `${days} days`} category="calm" disabled={pausing} onPress={() => void choosePause(days)} accessibilityLabel={`Pause for ${days} ${days === 1 ? "day" : "days"}`} />
                ))}
              </View>
            </>
          )}
        </Card>
      ) : null}

      <SectionTitle style={styles.section}>How it works</SectionTitle>
      {RULES.map((rule) => (
        <View key={rule.text} style={styles.rule}>
          <Ionicons name={rule.icon as any} size={18} color={theme.tone(rule.category).accent} style={styles.ruleIcon} />
          <Text style={[type.body, styles.ruleText, { color: surface.textSecondary }]}>{rule.text}</Text>
        </View>
      ))}

      {chapters.length > 0 ? (
        <>
          <SectionTitle style={styles.section}>Earlier runs, kept</SectionTitle>
          {chapters.map((chapter) => (
            <View key={chapter.start} style={styles.rule}>
              <Ionicons name="bookmark-outline" size={18} color={theme.tone("rest").accent} style={styles.ruleIcon} />
              <Text style={[type.body, styles.ruleText, { color: surface.textSecondary }]}>{chapterLine(chapter)}</Text>
            </View>
          ))}
          {state.best > 0 ? <Text style={[type.meta, styles.note, { color: surface.textTertiary }]}>Your longest: {state.best === 1 ? "1 day" : `${state.best} days`}.</Text> : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  heroText: { marginLeft: 16 },
  title: { marginTop: space.rowGap * 1.5 },
  lead: { marginTop: 6 },
  note: { marginTop: 8 },
  block: { marginTop: space.rowGap * 2 },
  strip: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  dayCell: { alignItems: "center", width: 20 },
  dayDot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  blankets: { flexDirection: "row", marginBottom: 8 },
  blanketIcon: { marginRight: 10 },
  cardLine: { marginTop: 4 },
  cardButton: { marginTop: 12, alignSelf: "flex-start" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  section: { marginTop: space.sectionGap },
  rule: { flexDirection: "row", alignItems: "flex-start", marginTop: 10 },
  ruleIcon: { marginTop: 2, marginRight: 10 },
  ruleText: { flex: 1 },
});
