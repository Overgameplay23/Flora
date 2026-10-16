import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GardenStage from "../garden/GardenStage";
import Chip from "../common/Chip";
import PressableScale from "../common/PressableScale";
import PetMascot from "../pet/PetMascot";
import { SceneCard, StepHeading } from "./OnboardingFrame";
import type { PetImageSources } from "../garden/usePetCandidates";
import type { PetReaction } from "../pet/PetPortrait";
import type { PetLook } from "../../domain/petLook";
import type { SanctuaryTheme } from "../../domain/sanctuary";
import { type ReminderTime, formatTime } from "../../domain/reminders";
import { useTheme } from "../../theme/theme";
import { brand, ink, radius, type } from "../../theme/tokens";

// The last three steps of the first run: the reveal (the pet and the plan it made), the reminder, and one
// small thing to do right now. Content only; the screen owns the state and the footer buttons.

export type PlanPreviewRow = { id: string; title: string; category: string; icon: string; minutes: number; reason: string };

type RevealStepProps = {
  sceneHeight: number;
  petSources: PetImageSources | null;
  look: PetLook | null;
  petName: string;
  theme: SanctuaryTheme;
  place: string;
  reasons: string[];
  plan: PlanPreviewRow[];
  /** while the portrait is still being painted in the background */
  paintingNote?: string | null;
  reaction: PetReaction | null;
  onReactionEnd: () => void;
  onPetPress: () => void;
};

export function RevealStep({ sceneHeight, petSources, look, petName, theme: sanctuary, place, reasons, plan, paintingNote, reaction, onReactionEnd, onPetPress }: RevealStepProps) {
  const appTheme = useTheme();
  const { surface } = appTheme;
  return (
    <View>
      <SceneCard>
        <GardenStage
          height={sceneHeight}
          variant="home"
          theme={sanctuary}
          petImageSources={petSources}
          petLook={look}
          allowOriginal
          petMood="happy"
          petReaction={reaction}
          onPetReactionEnd={onReactionEnd}
          onPetPress={onPetPress}
          accessibilityLabel={`${petName} in the ${place}`}
        />
      </SceneCard>
      <StepHeading title={`${petName} made you a plan`} lead={`Tap ${petName} to say hello. Here's how tomorrow looks; every day adapts to how you're doing.`} />
      {paintingNote ? (
        <View style={[styles.note, { backgroundColor: appTheme.tone("calm").fill }]}>
          <ActivityIndicator size="small" color={appTheme.tone("calm").accent} />
          <Text style={[type.meta, styles.noteText, { color: surface.text }]}>{paintingNote}</Text>
        </View>
      ) : null}
      {reasons.length > 0 ? (
        <View style={styles.because}>
          <Text style={[type.micro, { color: surface.textTertiary }]}>BECAUSE YOU SAID</Text>
          <View style={styles.chips}>
            {reasons.map((reason) => (
              <Chip key={reason} label={reason} selected={false} category="body" />
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.planList}>
        {plan.map((row) => {
          const tone = appTheme.tone(row.category);
          return (
            <View key={row.id} style={[styles.planRow, { backgroundColor: tone.fill, boxShadow: surface.shadow }]} accessible accessibilityLabel={`${row.title}. ${row.reason}`}>
              <View style={[styles.planTile, { backgroundColor: tone.tileOnFill }]}>
                <Ionicons name={row.icon as any} size={22} color={tone.accent} />
              </View>
              <View style={styles.planBody}>
                <Text style={[type.meta, { color: tone.accent }]} numberOfLines={1}>
                  {tone.label}
                  {row.minutes > 0 ? ` · ${row.minutes} min` : ""}
                </Text>
                <Text style={[type.bodyStrong, { color: surface.text }]} numberOfLines={2}>
                  {row.title}
                </Text>
                <Text style={[type.meta, { color: surface.textSecondary }]} numberOfLines={1}>
                  {row.reason}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type ReminderStepProps = {
  petName: string;
  times: ReminderTime[];
  time: ReminderTime;
  onPickTime: (time: ReminderTime) => void;
  /** "denied": the system said no; the step explains instead of asking again */
  denied: boolean;
};

export function ReminderStep({ petName, times, time, onPickTime, denied }: ReminderStepProps) {
  const { surface, night } = useTheme();
  return (
    <View>
      <View style={styles.mascot}>
        <PetMascot size={110} mood="happy" say={denied ? "No worries. I'll be here whenever you open the app." : "Want me to say good morning?"} night={night} />
      </View>
      <StepHeading
        title={denied ? `Notifications are off for ${petName}` : `${petName} can greet you in the morning`}
        lead={denied ? "You can allow them later in your phone's settings, under Profile › Reminders." : "One gentle hello a day, in their voice. Nothing to catch up on if you miss one, ever."}
        center
      />
      {denied ? null : (
        <View style={styles.times}>
          {times.map((option) => {
            const on = option.hour === time.hour && option.minute === time.minute;
            return <Chip key={formatTime(option)} label={formatTime(option)} selected={on} onPress={() => onPickTime(option)} category="energy" />;
          })}
        </View>
      )}
      <Text style={[type.meta, styles.footnote, { color: surface.textTertiary }]}>Change the time or turn it off any time under Profile › Reminders.</Text>
    </View>
  );
}

export type FirstThingRow = PlanPreviewRow & { act?: string | null };

type FirstThingStepProps = {
  petName: string;
  place: string;
  tasks: FirstThingRow[];
  doneId: string | null;
  busyId: string | null;
  onPick: (task: FirstThingRow) => void;
  celebration: string | null;
  reaction: PetReaction | null;
  onReactionEnd: () => void;
};

export function FirstThingStep({ petName, place, tasks, doneId, busyId, onPick, celebration, reaction, onReactionEnd }: FirstThingStepProps) {
  const appTheme = useTheme();
  const { surface, night } = appTheme;
  const locked = !!doneId || !!busyId;
  return (
    <View>
      <View style={styles.mascot}>
        <PetMascot size={110} mood={doneId ? "excited" : "happy"} say={celebration ?? `Pick one. I'll notice.`} reaction={reaction} onReactionEnd={onReactionEnd} night={night} />
      </View>
      <StepHeading title="One small thing for today" lead={`Something you can do in the next few minutes. Then it's into the ${place}.`} center />
      <View style={styles.planList}>
        {tasks.map((row) => {
          const tone = appTheme.tone(row.category);
          const done = doneId === row.id;
          const busy = busyId === row.id;
          return (
            <PressableScale
              key={row.id}
              onPress={() => onPick(row)}
              disabled={locked}
              pressedScale={0.97}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done, disabled: locked }}
              accessibilityLabel={row.title}
              style={[styles.planRow, { backgroundColor: tone.fill, boxShadow: surface.shadow, opacity: locked && !done ? 0.55 : 1 }]}
            >
              <View style={[styles.planTile, { backgroundColor: tone.tileOnFill }]}>
                <Ionicons name={row.icon as any} size={22} color={tone.accent} />
              </View>
              <View style={styles.planBody}>
                <Text style={[type.meta, { color: tone.accent }]} numberOfLines={1}>
                  {tone.label}
                  {row.minutes > 0 ? ` · ${row.minutes} min` : ""}
                </Text>
                <Text style={[type.bodyStrong, { color: surface.text }, done && styles.done]} numberOfLines={2}>
                  {row.title}
                </Text>
              </View>
              <View style={[styles.check, { borderColor: tone.accent, backgroundColor: done ? tone.accent : "transparent" }]}>
                {busy ? <ActivityIndicator size="small" color={tone.accent} /> : done ? <Ionicons name="checkmark" size={18} color={night ? ink.primary : brand.cream} /> : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mascot: {
    alignItems: "center",
    marginTop: 8,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.row,
    borderCurve: "continuous",
    marginBottom: 14,
  },
  noteText: {
    flex: 1,
  },
  because: {
    marginBottom: 14,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  planList: {
    gap: 10,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.row,
    borderCurve: "continuous",
  },
  planTile: {
    width: 44,
    height: 44,
    borderRadius: radius.tile - 2,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  planBody: {
    flex: 1,
    marginHorizontal: 12,
  },
  check: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  done: {
    textDecorationLine: "line-through",
  },
  times: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  footnote: {
    textAlign: "center",
    marginTop: 16,
  },
});
