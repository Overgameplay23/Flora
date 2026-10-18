import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import IconTile from "../components/common/IconTile";
import Button from "../components/common/Button";
import { Lead, ScreenTitle, SectionTitle } from "../components/common/Headings";
import PetMascot from "../components/pet/PetMascot";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import { useCycle } from "../hooks/useCycle";
import { useJourney } from "../hooks/useJourney";
import { JOURNEY_DAYS, type Journey, expectedFinish, journeyDoneCount, journeysFor } from "../domain/journeys";
import { loadPlanSettings } from "../services/planStore";
import type { FocusArea } from "../domain/plan/types";
import { getLocalDateKey } from "../utils/dateKeys";
import { useTheme } from "../theme/theme";
import { type } from "../theme/tokens";

function humanDate(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(y, m - 1, d));
  } catch {
    return dateKey;
  }
}

/** All the journeys, the person's own areas first; the active one on top with its progress. */
export default function JourneysScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { displayName, memorial } = usePet();
  const cycle = useCycle();
  const theme = useTheme();
  const { surface, night } = theme;
  const today = getLocalDateKey();
  const { state, journey: active, step, loading } = useJourney(user?.id ?? null, today);
  const [areas, setAreas] = useState<FocusArea[]>([]);

  useEffect(() => {
    let alive = true;
    loadPlanSettings(user?.id ?? "").then((settings) => alive && setAreas(settings.focusAreas));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // sequels appear only once their part one has been walked (journeysFor hides them until then)
  const list = useMemo(() => journeysFor(areas, { cycleVisible: cycle.enabled, completed: state.completed }), [areas, cycle.enabled, state.completed]);
  const completedById = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of state.completed) map.set(entry.journeyId, entry.finishedOn);
    return map;
  }, [state.completed]);

  const open = (journey: Journey) => navigation.navigate("Journey", { journeyId: journey.id });

  return (
    <Screen>
      <ScreenTitle>Journeys</ScreenTitle>
      <Lead>{memorial ? "Seven-day arcs, one small step a day. Miss a day and it simply waits for you." : `Seven-day arcs with ${displayName}: one small step a day. Miss a day and it simply waits for you.`}</Lead>

      {active && state.active ? (
        <Card tone={active.category} onPress={() => open(active)} accessibilityLabel={`Continue ${active.title}`} style={styles.activeCard}>
          <View style={styles.activeRow}>
            <View style={styles.activeText}>
              <Text style={[type.micro, { color: theme.tone(active.category).accent }]}>ON A JOURNEY</Text>
              <Text style={[type.h3, { color: surface.text }]}>{active.title}</Text>
              <Text style={[type.meta, { color: surface.textSecondary }]}>
                {step
                  ? step.done
                    ? `Day ${step.index + 1} of ${JOURNEY_DAYS} done. Tomorrow: ${step.next?.title ?? "the last day"}.`
                    : `Day ${step.index + 1} of ${JOURNEY_DAYS}: ${step.day.title}`
                  : "All done."}
              </Text>
              <Text style={[type.meta, { color: surface.textTertiary }]}>
                {journeyDoneCount(state.active)} of {JOURNEY_DAYS} days · about {humanDate(expectedFinish(state.active, today))}, a step a day
              </Text>
            </View>
            <PetMascot size={72} mood="happy" showShadow={false} night={night} />
          </View>
          <Button label={step && !step.done ? "Today's step" : "Open journey"} size="md" onPress={() => open(active)} containerStyle={styles.activeButton} />
        </Card>
      ) : loading ? null : (
        <Card style={styles.introCard}>
          <View style={styles.activeRow}>
            <View style={styles.activeText}>
              <Text style={[type.bodyStrong, { color: surface.text }]}>Pick one to begin</Text>
              <Text style={[type.meta, { color: surface.textSecondary }]}>
                Each journey is seven small steps around one thing you asked for help with. One at a time{memorial ? "." : `; ${displayName} walks it with you.`}
              </Text>
            </View>
            <PetMascot size={72} mood="calm" showShadow={false} night={night} />
          </View>
        </Card>
      )}

      <SectionTitle>{active ? "Other journeys" : "Journeys"}</SectionTitle>
      {list
        .filter((journey) => journey.id !== active?.id)
        .map((journey) => {
          const finishedOn = completedById.get(journey.id);
          const own = areas.includes(journey.area);
          return (
            <Card key={journey.id} onPress={() => open(journey)} accessibilityLabel={`${journey.title}. ${journey.blurb}`} style={styles.journeyCard}>
              <View style={styles.journeyRow}>
                <IconTile icon={journey.icon} category={journey.category} size={48} />
                <View style={styles.journeyBody}>
                  <View style={styles.titleRow}>
                    <Text style={[type.bodyStrong, styles.journeyTitle, { color: surface.text }]} numberOfLines={2}>
                      {journey.title}
                    </Text>
                    {finishedOn ? (
                      <View style={[styles.badge, { backgroundColor: theme.tone("body").fill }]}>
                        <Ionicons name="checkmark" size={12} color={theme.tone("body").accent} />
                        <Text style={[type.micro, { color: theme.tone("body").accent }]}>DONE {humanDate(finishedOn).toUpperCase()}</Text>
                      </View>
                    ) : journey.sequelOf ? (
                      <View style={[styles.badge, { backgroundColor: theme.tone(journey.category).fill }]}>
                        <Text style={[type.micro, { color: theme.tone(journey.category).accent }]}>PART TWO</Text>
                      </View>
                    ) : own ? (
                      <View style={[styles.badge, { backgroundColor: theme.tone(journey.category).fill }]}>
                        <Text style={[type.micro, { color: theme.tone(journey.category).accent }]}>FOR YOU</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[type.meta, { color: surface.textSecondary }]} numberOfLines={2}>
                    {journey.blurb}
                  </Text>
                  <Text style={[type.micro, styles.days, { color: surface.textTertiary }]}>{JOURNEY_DAYS} DAYS</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={surface.textTertiary} />
              </View>
            </Card>
          );
        })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    marginTop: 18,
  },
  introCard: {
    marginTop: 18,
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeText: {
    flex: 1,
    paddingRight: 10,
    gap: 2,
  },
  activeButton: {
    marginTop: 12,
    alignSelf: "flex-start",
  },
  journeyCard: {
    marginBottom: 10,
  },
  journeyRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  journeyBody: {
    flex: 1,
    marginHorizontal: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  journeyTitle: {
    flexShrink: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  days: {
    marginTop: 4,
  },
});
