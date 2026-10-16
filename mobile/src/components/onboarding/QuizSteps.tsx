import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ChoiceCard from "./ChoiceCard";
import { StepHeading } from "./OnboardingFrame";
import PetMascot from "../pet/PetMascot";
import SpeechBubble from "../pet/SpeechBubble";
import { FOCUS_AREAS } from "../../domain/plan/focusAreas";
import type { Energy, FocusArea } from "../../domain/plan/types";
import { BATTERY_OPTIONS, HARD_DAY_OPTIONS, VOICE_OPTIONS, type HardDayMinutes, type Voice } from "../../domain/onboarding";
import { useTheme } from "../../theme/theme";
import { type } from "../../theme/tokens";

// The quiz half of the first run: content only; the screen owns the answers and the footer buttons.

export const MAX_FOCUS_PICKS = 3;

type AreasStepProps = {
  picked: FocusArea[];
  onToggle: (area: FocusArea) => void;
  hint?: string | null;
  petName: string;
};

export function AreasStep({ picked, onToggle, hint, petName }: AreasStepProps) {
  const theme = useTheme();
  return (
    <View>
      <StepHeading title="What's felt heaviest lately?" lead={`Pick up to three. ${petName} will build your days around them, starting with the first.`} />
      {FOCUS_AREAS.map((area) => {
        const rank = picked.indexOf(area.id);
        return (
          <ChoiceCard
            key={area.id}
            label={area.label}
            blurb={area.blurb}
            icon={area.icon}
            category={area.category}
            selected={rank >= 0}
            rank={rank >= 0 ? rank + 1 : 0}
            onPress={() => onToggle(area.id)}
          />
        );
      })}
      {hint ? <Text style={[type.meta, styles.hint, { color: theme.alert }]}>{hint}</Text> : null}
    </View>
  );
}

export function BatteryStep({ value, onPick }: { value: Energy | null; onPick: (energy: Energy) => void }) {
  return (
    <View>
      <StepHeading title="How's your battery, most days?" lead="Not today, just most days. It sets how big a day starts out; you can always say otherwise on Home." />
      {BATTERY_OPTIONS.map((option) => (
        <ChoiceCard key={option.id} label={option.label} blurb={option.blurb} icon={option.icon} category={option.category} selected={value === option.id} onPress={() => onPick(option.id)} />
      ))}
    </View>
  );
}

export function HardDayStep({ value, onPick }: { value: HardDayMinutes | null; onPick: (minutes: HardDayMinutes) => void }) {
  return (
    <View>
      <StepHeading title="On a hard day, how much can you give?" lead="Honest answers make better days. Hard days get exactly this much, never more." />
      {HARD_DAY_OPTIONS.map((option) => (
        <ChoiceCard key={option.id} label={option.label} blurb={option.blurb} icon={option.icon} category="rest" selected={value === option.id} onPress={() => onPick(option.id)} />
      ))}
    </View>
  );
}

export function VoiceStep({ value, onPick, petName }: { value: Voice | null; onPick: (voice: Voice) => void; petName: string }) {
  const { night } = useTheme();
  return (
    <View>
      <StepHeading title={`How should ${petName} talk to you?`} lead="They never scold and never count what was missed. This is just the tone." />
      {VOICE_OPTIONS.map((option) => (
        <ChoiceCard key={option.id} label={option.label} blurb={option.blurb} icon={option.icon} category="connection" selected={value === option.id} onPress={() => onPick(option.id)}>
          <SpeechBubble text={option.sample(petName)} tail="left" night={night} />
        </ChoiceCard>
      ))}
    </View>
  );
}

/** Asked only when the rhythm area was picked: the tracker is private and off until the person says yes. */
export function CycleStep({ petName }: { petName: string }) {
  const { surface, night } = useTheme();
  return (
    <View>
      <View style={styles.mascot}>
        <PetMascot size={110} mood="calm" say="This part stays between us." night={night} />
      </View>
      <StepHeading title="Keep your rhythm private on this phone?" center />
      <Text style={[type.body, styles.para, { color: surface.textSecondary }]}>
        {petName} can go easier on the days your body asks for it. Your cycle is logged on this phone only: it never goes to a server, there are no fertility or ovulation predictions, and you can erase it in one tap.
      </Text>
      <Text style={[type.meta, styles.para, { color: surface.textTertiary }]}>Nothing here is medical advice. You can turn this on or off any time under Profile.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    textAlign: "center",
    marginTop: 4,
  },
  mascot: {
    alignItems: "center",
    marginTop: 8,
  },
  para: {
    textAlign: "center",
    marginBottom: 12,
  },
});
