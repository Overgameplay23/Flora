import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import IconTile from "../components/common/IconTile";
import { Lead, ScreenTitle } from "../components/common/Headings";
import { PetEmptyState, PetLoading } from "../components/pet/PetMoments";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import { type Keepsake, buildKeepsakes, humanDay, milestoneTitle, nextMilestone } from "../domain/milestones";
import { loadMilestones } from "../services/milestoneStore";
import { loadJourneyState } from "../services/journeyStore";
import { loadCarePrefs } from "../services/carePrefs";
import { fetchDaysTogether } from "../services/homeStats";
import { useTheme } from "../theme/theme";
import { brand, type } from "../theme/tokens";

/** The moments the pet keeps: Days Together milestones, journeys walked, the day it moved in. */
export default function KeepsakesScreen() {
  const { user } = useAuth();
  const { displayName } = usePet();
  const theme = useTheme();
  const { surface } = theme;
  const [keepsakes, setKeepsakes] = useState<Keepsake[] | null>(null);
  const [daysTogether, setDaysTogether] = useState<number | null>(null);

  const load = useCallback(async () => {
    const userId = user?.id ?? null;
    const [milestones, journeys, prefs, days] = await Promise.all([
      loadMilestones(userId),
      loadJourneyState(userId),
      loadCarePrefs(userId),
      userId ? fetchDaysTogether(userId) : Promise.resolve(null),
    ]);
    setKeepsakes(buildKeepsakes({ milestones, journeys: journeys.completed, firstDay: prefs.completedAt ? prefs.completedAt.slice(0, 10) : null, petName: displayName }));
    setDaysTogether(days);
  }, [displayName, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const ahead = daysTogether != null ? nextMilestone(daysTogether) : null;

  return (
    <Screen>
      <ScreenTitle>Keepsakes</ScreenTitle>
      <Lead>The moments {displayName} keeps for you. Nothing here ever goes away.</Lead>

      {daysTogether != null ? (
        <Card tone="play" style={styles.ahead}>
          <Text style={[type.micro, { color: theme.tone("play").accent }]}>DAYS TOGETHER</Text>
          <Text style={[type.h2, { color: surface.text }]}>
            {daysTogether} {daysTogether === 1 ? "day" : "days"}
          </Text>
          <Text style={[type.meta, { color: surface.textSecondary }]}>
            {ahead ? `Next keepsake: ${milestoneTitle(ahead.days).toLowerCase()}, ${ahead.left} more ${ahead.left === 1 ? "day" : "days"} of care.` : "Every milestone there is. You and your pet wrote the book."}
          </Text>
        </Card>
      ) : null}

      {keepsakes === null ? (
        <PetLoading label="Looking through the box…" style={styles.loading} />
      ) : keepsakes.length === 0 ? (
        <PetEmptyState title="Nothing in the box yet" body={`Your first day of care together is the first keepsake. ${displayName} is ready when you are.`} mood="calm" style={styles.empty} />
      ) : (
        <View style={styles.list}>
          {keepsakes.map((item) => (
            <Card key={item.id} style={styles.row} accessibilityLabel={`${item.title}. ${item.line}`}>
              <View style={styles.rowInner}>
                <IconTile icon={item.icon} category={item.category} size={48} />
                <View style={styles.body}>
                  <Text style={[type.bodyStrong, { color: surface.text }]}>{item.title}</Text>
                  <Text style={[type.meta, { color: surface.textSecondary }]}>{item.line}</Text>
                  <Text style={[type.micro, styles.date, { color: item.date ? brand.goldStrong : surface.textTertiary }]}>{item.date ? humanDay(item.date).toUpperCase() : "BEFORE KEEPSAKES EXISTED"}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ahead: {
    marginTop: 18,
    gap: 2,
  },
  loading: {
    marginTop: 40,
  },
  empty: {
    marginTop: 30,
  },
  list: {
    marginTop: 18,
    gap: 10,
  },
  row: {},
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  date: {
    marginTop: 2,
  },
});
