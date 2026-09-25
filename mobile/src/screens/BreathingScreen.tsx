import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

const TOTAL_DURATION_MS = 60000;
const PHASE_DURATION_MS = 4000;
const TICK_MS = 250;

type BreathPhase = {
  key: string;
  label: "Inhale" | "Hold" | "Exhale";
  mode: "expand" | "hold_high" | "contract" | "hold_low";
};

const PHASES: BreathPhase[] = [
  { key: "inhale", label: "Inhale", mode: "expand" },
  { key: "hold-high", label: "Hold", mode: "hold_high" },
  { key: "exhale", label: "Exhale", mode: "contract" },
  { key: "hold-low", label: "Hold", mode: "hold_low" },
];

function formatSeconds(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

function getCircleScale(mode: BreathPhase["mode"], progress: number) {
  if (mode === "expand") return 0.8 + progress * 0.45;
  if (mode === "contract") return 1.25 - progress * 0.45;
  if (mode === "hold_high") return 1.25;
  return 0.8;
}

export default function BreathingScreen() {
  const navigation = useNavigation();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseElapsedMs, setPhaseElapsedMs] = useState(0);

  React.useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setElapsedMs((currentElapsed) => {
        if (currentElapsed >= TOTAL_DURATION_MS) {
          setIsRunning(false);
          return currentElapsed;
        }

        const nextElapsed = Math.min(TOTAL_DURATION_MS, currentElapsed + TICK_MS);
        setPhaseElapsedMs((currentPhaseElapsed) => {
          const nextPhaseElapsed = currentPhaseElapsed + TICK_MS;
          if (nextPhaseElapsed >= PHASE_DURATION_MS) {
            setPhaseIndex((currentPhaseIndex) => (currentPhaseIndex + 1) % PHASES.length);
            return nextPhaseElapsed - PHASE_DURATION_MS;
          }
          return nextPhaseElapsed;
        });

        if (nextElapsed >= TOTAL_DURATION_MS) {
          setIsRunning(false);
        }
        return nextElapsed;
      });
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [isRunning]);

  const phase = PHASES[phaseIndex];
  const phaseProgress = Math.max(0, Math.min(1, phaseElapsedMs / PHASE_DURATION_MS));
  const scale = getCircleScale(phase.mode, phaseProgress);
  const remainingMs = Math.max(0, TOTAL_DURATION_MS - elapsedMs);
  const isComplete = elapsedMs >= TOTAL_DURATION_MS;

  const circleSize = useMemo(() => Math.round(140 * scale), [scale]);

  const handleToggle = () => {
    if (isComplete && !isRunning) {
      setElapsedMs(0);
      setPhaseElapsedMs(0);
      setPhaseIndex(0);
      setIsRunning(true);
      return;
    }
    setIsRunning((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>1-minute breathing</Text>
      <Text style={styles.subtitle}>Box breathing: 4s inhale, 4s hold, 4s exhale, 4s hold.</Text>

      <View style={styles.visualWrap}>
        <View style={[styles.circle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}>
          <Text style={styles.phaseLabel}>{phase.label}</Text>
        </View>
      </View>

      <Text style={styles.timerText}>{isComplete ? "Complete" : `${formatSeconds(remainingMs)} remaining`}</Text>

      <View style={styles.controls}>
        <Pressable style={styles.primaryButton} onPress={handleToggle}>
          <Text style={styles.primaryButtonText}>
            {isComplete && !isRunning ? "Restart" : isRunning ? "Pause" : "Start"}
          </Text>
        </Pressable>

        <Pressable style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>

      {isComplete ? <Text style={styles.doneHint}>You showed up. That is enough.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingHorizontal: 20,
    paddingTop: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: "rgba(148,163,184,0.95)",
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 19,
  },
  visualWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  circle: {
    backgroundColor: "rgba(52,211,153,0.2)",
    borderWidth: 2,
    borderColor: "rgba(52,211,153,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  phaseLabel: {
    color: "#d1fae5",
    fontSize: 24,
    fontWeight: "700",
  },
  timerText: {
    color: "#cbd5e1",
    fontSize: 14,
    marginBottom: 16,
  },
  controls: {
    width: "100%",
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: "#34d399",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  doneButton: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 13,
  },
  doneButtonText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 15,
  },
  doneHint: {
    color: "#a7f3d0",
    marginBottom: 20,
    fontSize: 12,
  },
});
