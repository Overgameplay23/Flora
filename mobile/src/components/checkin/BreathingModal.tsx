import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type BreathingPhase = "inhale" | "hold1" | "exhale" | "hold2" | "done";

type BreathingModalProps = {
  visible: boolean;
  onClose: () => void;
};

const PHASE_SECONDS = 4;
const MAX_CYCLES = 4;
const MAX_TOTAL_SECONDS = 60;

const sequence: Array<Exclude<BreathingPhase, "done">> = ["inhale", "hold1", "exhale", "hold2"];

export default function BreathingModal({ visible, onClose }: BreathingModalProps) {
  const [phase, setPhase] = useState<BreathingPhase>("inhale");
  const [secondsLeftInPhase, setSecondsLeftInPhase] = useState<number>(PHASE_SECONDS);
  const [cyclesCompleted, setCyclesCompleted] = useState<number>(0);

  const elapsedRef = useRef(0);
  const phaseRef = useRef<BreathingPhase>("inhale");
  const cyclesRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phaseLabel = useMemo(() => {
    if (phase === "inhale") return "Inhale";
    if (phase === "hold1") return "Hold";
    if (phase === "exhale") return "Exhale";
    if (phase === "hold2") return "Hold";
    return "Complete";
  }, [phase]);

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible) {
      elapsedRef.current = 0;
      phaseRef.current = "inhale";
      cyclesRef.current = 0;
      setPhase("inhale");
      setSecondsLeftInPhase(PHASE_SECONDS);
      setCyclesCompleted(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    elapsedRef.current = 0;
    phaseRef.current = "inhale";
    cyclesRef.current = 0;
    setPhase("inhale");
    setSecondsLeftInPhase(PHASE_SECONDS);
    setCyclesCompleted(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeftInPhase((prev) => {
        if (phaseRef.current === "done") return prev;

        elapsedRef.current += 1;
        if (prev > 1) return prev - 1;

        const currentPhase = phaseRef.current;
        const currentIndex = sequence.findIndex((item) => item === currentPhase);
        const nextIndex = (currentIndex + 1) % sequence.length;
        const nextPhase = sequence[nextIndex];

        if (currentPhase === "hold2") {
          const nextCycles = cyclesRef.current + 1;
          cyclesRef.current = nextCycles;
          setCyclesCompleted(nextCycles);
          if (nextCycles >= MAX_CYCLES || elapsedRef.current >= MAX_TOTAL_SECONDS) {
            phaseRef.current = "done";
            setPhase("done");
            stopTimer();
            return 0;
          }
        }

        if (elapsedRef.current >= MAX_TOTAL_SECONDS) {
          phaseRef.current = "done";
          setPhase("done");
          stopTimer();
          return 0;
        }

        phaseRef.current = nextPhase;
        setPhase(nextPhase);
        return PHASE_SECONDS;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible]);

  const done = phase === "done";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {done ? (
            <>
              <Text style={styles.doneTitle}>Nice. Want to keep it simple today?</Text>
              <Text style={styles.doneMeta}>You completed a breathing reset.</Text>
            </>
          ) : (
            <>
              <Text style={styles.phaseLabel}>{phaseLabel}</Text>
              <Text style={styles.countdown}>{secondsLeftInPhase}</Text>
              <Text style={styles.meta}>Cycle {cyclesCompleted + 1} of {MAX_CYCLES}</Text>
            </>
          )}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  phaseLabel: {
    fontSize: 30,
    fontWeight: "700",
    color: "#e2e8f0",
    letterSpacing: 0.4,
  },
  countdown: {
    marginTop: 8,
    fontSize: 58,
    fontWeight: "700",
    color: "#a7f3d0",
  },
  meta: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(203,213,225,0.85)",
  },
  doneTitle: {
    fontSize: 23,
    lineHeight: 30,
    color: "#e2e8f0",
    textAlign: "center",
    fontWeight: "700",
  },
  doneMeta: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(203,213,225,0.85)",
    textAlign: "center",
  },
  closeButton: {
    marginTop: 20,
    minWidth: 110,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(52,211,153,0.2)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.55)",
  },
  closeButtonText: {
    color: "#a7f3d0",
    fontWeight: "700",
    fontSize: 15,
  },
});
