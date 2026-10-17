import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import IconTile from "../components/common/IconTile";
import { Lead, ScreenTitle, SectionTitle } from "../components/common/Headings";
import PetMascot from "../components/pet/PetMascot";
import { PetEmptyState } from "../components/pet/PetMoments";
import { useTheme } from "../theme/theme";
import { fonts, type } from "../theme/tokens";
import { tapSoft, warning } from "../utils/haptics";
import { createPlayTask, findPlayTask, loadPlayStats, type PlayStats } from "../games/playStats";

const GAMES = [
  { id: "fetch" as const, route: "PlayFetch", title: "Fetch", blurb: "Flick the ball across the lawn. Eight throws, sixty seconds.", icon: "tennisball-outline" },
  { id: "bubbles" as const, route: "PlayBubbles", title: "Bubbles", blurb: "Tap them before they float away. Thirty seconds.", icon: "ellipse-outline" },
  { id: "petting" as const, route: "PlayPetting", title: "Pet the pet", blurb: "Slow strokes, floating hearts, a very content pet. One calm minute.", icon: "heart-outline" },
  { id: "treats" as const, route: "PlayTreats", title: "Treat Catch", blurb: "Slide your pet under the falling treats. Golden ones count triple. Forty-five seconds.", icon: "nutrition-outline" },
  { id: "memory" as const, route: "PlayMemory", title: "Memory Match", blurb: "Turn the cards two at a time and find the pairs. Three boards, no clock.", icon: "grid-outline" },
];

/** The play hub: the games, best scores, and the option to make playtime a daily task. Colour: play gold. */
export default function PlayScreen({ navigation }: any) {
  const { user } = useAuth();
  const { displayName, memorial } = usePet();
  const theme = useTheme();
  const { surface, night } = theme;
  const tone = theme.tone("play");
  const [stats, setStats] = useState<PlayStats | null>(null);
  const [hasTask, setHasTask] = useState<boolean | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [addFailed, setAddFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadPlayStats(user?.id).then((value) => alive && setStats(value));
      if (user?.id) {
        findPlayTask(user.id)
          .then((task) => alive && setHasTask(!!task))
          .catch(() => alive && setHasTask(null));
      }
      return () => {
        alive = false;
      };
    }, [user?.id])
  );

  const addTask = async () => {
    if (!user?.id || addingTask) return;
    setAddingTask(true);
    setAddFailed(false);
    try {
      await createPlayTask(user.id, displayName);
      setHasTask(true);
      tapSoft();
    } catch (error) {
      console.warn("PLAY_TASK_CREATE_FAILED", (error as any)?.message || String(error));
      warning();
      setAddFailed(true);
    } finally {
      setAddingTask(false);
    }
  };

  if (memorial) {
    return (
      <Screen scroll={false} centered>
        <PetEmptyState
          title={`${displayName} is resting`}
          body="The games are paused while the garden is a memorial. Memories and a quiet minute are on the Pet tab."
          size={120}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <PetMascot size={110} mood="excited" night={night} />
        <ScreenTitle center style={styles.title}>
          Play with {displayName}
        </ScreenTitle>
        <Lead center style={styles.subtitle}>
          {stats?.sessionsToday
            ? `${stats.sessionsToday} ${stats.sessionsToday === 1 ? "game" : "games"} today. ${displayName} is thrilled.`
            : `A few minutes of play is good for both of you.`}
        </Lead>
      </View>

      {GAMES.map((game) => (
        <Card key={game.id} tone="play" onPress={() => navigation.navigate(game.route)} accessibilityLabel={`Play ${game.title}`} style={styles.gameCard}>
          <View style={styles.gameRow}>
            <IconTile icon={game.icon} category="play" on="fill" size={52} />
            <View style={styles.gameBody}>
              <Text style={[type.h3, { color: surface.text }]}>{game.title}</Text>
              <Text style={[type.meta, styles.gameBlurb, { color: surface.textSecondary }]}>{game.blurb}</Text>
              <Text style={[type.meta, styles.gameBest, { color: tone.accent }]}>{stats?.best[game.id] ? `Best ${stats.best[game.id]}` : "Not played yet"}</Text>
            </View>
            <View style={[styles.playBadge, { backgroundColor: tone.tileOnFill }]}>
              <Ionicons name="play" size={16} color={tone.accent} style={styles.playGlyph} />
            </View>
          </View>
        </Card>
      ))}

      <SectionTitle>Playtime and the garden</SectionTitle>
      <Card>
        <View style={styles.taskRow}>
          <IconTile icon="flower-outline" category="play" size={40} />
          <View style={styles.taskBody}>
            {hasTask === null && user?.id ? (
              <ActivityIndicator color={tone.accent} style={styles.taskLoading} />
            ) : hasTask ? (
              <Text style={[type.callout, { color: surface.text }]}>"Play with {displayName}" is one of your daily tasks. The first game each day completes it and earns Sprouts for the garden.</Text>
            ) : (
              <View>
                <Text style={[type.callout, { color: surface.text }]}>Your first game each day earns Sprouts for the garden, the same as any care task; "Play with {displayName}" joins your list the first time you play. Add it now if you like.</Text>
                <Button
                  label={addingTask ? "Adding…" : `Add "Play with ${displayName}"`}
                  icon="add-circle-outline"
                  variant="secondary"
                  size="sm"
                  onPress={addTask}
                  disabled={addingTask}
                  containerStyle={styles.taskButton}
                />
                {addFailed ? <Text style={[type.meta, styles.taskError, { color: theme.alert }]}>Couldn't add the task right now.</Text> : null}
              </View>
            )}
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 4, paddingBottom: 6 },
  title: { marginTop: 10 },
  subtitle: { marginTop: 6, paddingHorizontal: 12 },
  gameCard: { marginTop: 12 },
  gameRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  gameBody: { flex: 1 },
  gameBlurb: { marginTop: 2 },
  gameBest: { marginTop: 6, fontFamily: fonts.bodyBold },
  playBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  playGlyph: { marginLeft: 2 },
  taskRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  taskBody: { flex: 1 },
  taskLoading: { alignSelf: "flex-start", marginTop: 10 },
  taskButton: { marginTop: 12 },
  taskError: { marginTop: 8 },
});
