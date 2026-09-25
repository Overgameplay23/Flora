import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePet } from "../hooks/usePet";
import { useCycle } from "../hooks/useCycle";
import PetPortrait from "../components/pet/PetPortrait";
import {
  DayLog,
  Flow,
  SYMPTOMS,
  dayLogFor,
  isPeriodDay,
  logPeriodDay,
  phaseLabel,
  phaseLine,
  predictedPeriodDays,
  unlogPeriodDay,
  upsertDayLog,
} from "../domain/cycle";
import { humanDate, monthGrid, monthTitle, shiftMonth, shortDate } from "../domain/calendar";
import { clearCycleData, saveCycleData, setCycleEnabled } from "../services/cycleStore";
import { parseDateKey } from "../utils/dateKeys";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const FLOWS: Flow[] = ["light", "medium", "heavy"];

/**
 * Optional cycle tracker. Everything stays on the device; the pet keeps the tone gentle. Turning it on
 * is an explicit choice on this screen, and deleting the data is one tap.
 */
export default function CycleScreen() {
  const { userId, enabled, data, status, loading, today } = useCycle();
  const { sources, displayName } = usePet();
  const todayDate = parseDateKey(today) || new Date();
  const [view, setView] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState<DayLog>({ date: today, flow: null, symptoms: [], note: "" });
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    const existing = dayLogFor(data, selected);
    setDraft({ date: selected, flow: existing?.flow ?? null, symptoms: existing?.symptoms ?? [], note: existing?.note ?? "" });
    setSavedNote(null);
  }, [data, selected]);

  const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
  const predicted = useMemo(() => predictedPeriodDays(data, today), [data, today]);
  const selectedIsPeriod = isPeriodDay(data, selected);
  const selectedInFuture = selected > today;

  const persist = async (next: typeof data) => {
    if (!userId) return;
    setSaving(true);
    try {
      await saveCycleData(userId, next);
    } finally {
      setSaving(false);
    }
  };

  const togglePeriodDay = () => {
    if (selectedInFuture) {
      Alert.alert("That day hasn't happened yet", "Log period days as they come; predictions handle the future.");
      return;
    }
    void persist(selectedIsPeriod ? unlogPeriodDay(data, selected) : logPeriodDay(data, selected));
  };

  const saveDay = async () => {
    await persist(upsertDayLog(data, { ...draft, note: draft.note?.trim() || null }));
    setSavedNote("Saved on this device.");
  };

  const toggleSymptom = (symptom: string) => {
    setDraft((prev) => ({
      ...prev,
      symptoms: prev.symptoms?.includes(symptom) ? prev.symptoms.filter((s) => s !== symptom) : [...(prev.symptoms || []), symptom],
    }));
  };

  const turnOn = () => userId && setCycleEnabled(userId, true);
  const turnOff = () => userId && setCycleEnabled(userId, false);
  const deleteAll = () => {
    if (!userId) return;
    Alert.alert("Delete all cycle data?", "This removes every logged day from this device. It cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void clearCycleData(userId) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#35d07f" />
      </View>
    );
  }

  if (!enabled) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <PetPortrait sources={sources} size={110} mood="calm" allowOriginal />
          <Text style={styles.title}>Track your cycle with {displayName}</Text>
          <Text style={styles.body}>
            Log period days and a few symptoms; {displayName} keeps track of where you are in your cycle and when the next one is likely.
          </Text>
        </View>
        <View style={styles.card}>
          <Row icon="smartphone" text="Stays on this device. It is never uploaded or shared." />
          <Row icon="trash-2" text="Delete everything in one tap, any time." />
          <Row icon="info" text="Estimates only, based on your own dates. Not medical advice, and not for contraception." />
        </View>
        <Pressable style={styles.primary} onPress={turnOn} accessibilityRole="button">
          <Text style={styles.primaryText}>Turn on cycle tracking</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.statusCard}>
        <PetPortrait sources={sources} size={84} mood={status.phase === "period" ? "calm" : "happy"} allowOriginal />
        <View style={styles.statusBody}>
          <Text style={styles.statusPhase}>{phaseLabel(status.phase)}</Text>
          {status.cycleDay != null ? <Text style={styles.statusMeta}>Cycle day {status.cycleDay} of about {status.cycleLength}</Text> : null}
          {status.nextPeriodStart ? (
            <Text style={styles.statusMeta}>
              Next period around {shortDate(status.nextPeriodStart)}
              {status.daysUntilNextPeriod != null && status.daysUntilNextPeriod >= 0 ? ` · in ${status.daysUntilNextPeriod} ${status.daysUntilNextPeriod === 1 ? "day" : "days"}` : ""}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.petLine}>{phaseLine(status, displayName)}</Text>

      <View style={styles.card}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => setView((v) => shiftMonth(v.year, v.month, -1))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month">
            <Feather name="chevron-left" size={20} color="#e2e8f0" />
          </Pressable>
          <Text style={styles.monthTitle}>{monthTitle(view.year, view.month)}</Text>
          <Pressable onPress={() => setView((v) => shiftMonth(v.year, v.month, 1))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next month">
            <Feather name="chevron-right" size={20} color="#e2e8f0" />
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week, index) => (
          <View key={index} style={styles.weekRow}>
            {week.map((cell) => {
              const period = isPeriodDay(data, cell.date);
              const isPredicted = !period && predicted.has(cell.date);
              const fertile = !period && status.fertileWindow && cell.date >= status.fertileWindow.start && cell.date <= status.fertileWindow.end;
              const isToday = cell.date === today;
              const isSelected = cell.date === selected;
              const logged = !!dayLogFor(data, cell.date);
              return (
                <Pressable
                  key={cell.date}
                  onPress={() => setSelected(cell.date)}
                  style={[styles.cell, period && styles.cellPeriod, isPredicted && styles.cellPredicted, isSelected && styles.cellSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`${humanDate(cell.date)}${period ? ", period day" : isPredicted ? ", period expected" : ""}${isToday ? ", today" : ""}`}
                >
                  <Text style={[styles.cellText, !cell.inMonth && styles.cellTextMuted, period && styles.cellTextPeriod, isToday && styles.cellTextToday]}>{cell.day}</Text>
                  {fertile ? <View style={styles.fertileDot} /> : logged ? <View style={styles.loggedDot} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={styles.legend}>
          <Legend swatch={styles.legendPeriod} label="Period" />
          <Legend swatch={styles.legendPredicted} label="Expected" />
          <Legend swatch={styles.legendFertile} label="Fertile estimate" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.dayTitle}>{humanDate(selected)}</Text>
        <Pressable
          style={[styles.periodToggle, selectedIsPeriod && styles.periodToggleOn]}
          onPress={togglePeriodDay}
          disabled={saving}
          accessibilityRole="switch"
          accessibilityState={{ checked: selectedIsPeriod }}
        >
          <Feather name={selectedIsPeriod ? "check-circle" : "circle"} size={18} color={selectedIsPeriod ? "#0f172a" : "#fbcfe8"} />
          <Text style={[styles.periodToggleText, selectedIsPeriod && styles.periodToggleTextOn]}>{selectedIsPeriod ? "Period day" : "Mark as a period day"}</Text>
        </Pressable>

        {selectedIsPeriod ? (
          <View style={styles.chipRow}>
            {FLOWS.map((flow) => (
              <Chip key={flow} label={flow} active={draft.flow === flow} onPress={() => setDraft((p) => ({ ...p, flow: p.flow === flow ? null : flow }))} />
            ))}
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>Symptoms</Text>
        <View style={styles.chipRow}>
          {SYMPTOMS.map((symptom) => (
            <Chip key={symptom} label={symptom} active={!!draft.symptoms?.includes(symptom)} onPress={() => toggleSymptom(symptom)} />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Note (optional)</Text>
        <TextInput
          value={draft.note || ""}
          onChangeText={(note) => setDraft((p) => ({ ...p, note }))}
          placeholder="Anything worth remembering"
          placeholderTextColor="rgba(148,163,184,0.7)"
          style={styles.input}
          multiline
          maxLength={280}
        />
        {savedNote ? <Text style={styles.saved}>{savedNote}</Text> : null}
        <Pressable style={[styles.primary, saving && styles.disabled]} onPress={saveDay} disabled={saving} accessibilityRole="button">
          <Text style={styles.primaryText}>{saving ? "Saving…" : "Save day"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.dayTitle}>Your averages</Text>
        <Text style={styles.averages}>
          Cycle about {status.cycleLength} days{status.sample > 0 ? ` (from ${status.sample} ${status.sample === 1 ? "cycle" : "cycles"})` : " (default until two cycles are logged)"} · period about {status.periodLength} days
        </Text>
        <Text style={styles.disclaimer}>
          Estimates come only from the dates you log here and can be off by several days. They are not medical advice and the fertile estimate must not be relied on for contraception. Everything stays on this device.
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Pressable style={styles.linkButton} onPress={turnOff} accessibilityRole="button">
          <Text style={styles.linkText}>Turn off tracking</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={deleteAll} accessibilityRole="button">
          <Text style={[styles.linkText, styles.linkDanger]}>Delete all cycle data</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Row({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={16} color="#a7f3d0" />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Legend({ swatch, label }: { swatch: any; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, swatch]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1420" },
  content: { padding: 16, paddingBottom: 60 },
  hero: { alignItems: "center", paddingVertical: 12 },
  title: { marginTop: 8, color: "#f8fafc", fontSize: 22, fontWeight: "800", textAlign: "center" },
  body: { marginTop: 8, color: "rgba(203,213,225,0.92)", fontSize: 14, lineHeight: 20, textAlign: "center" },
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  row: { flexDirection: "row", alignItems: "flex-start", marginVertical: 6 },
  rowText: { flex: 1, marginLeft: 10, color: "rgba(226,232,240,0.92)", fontSize: 13, lineHeight: 19 },
  primary: { marginTop: 14, minHeight: 48, borderRadius: 999, backgroundColor: "#35d07f", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  statusBody: { flex: 1, marginLeft: 12 },
  statusPhase: { color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  statusMeta: { marginTop: 3, color: "rgba(203,213,225,0.9)", fontSize: 13 },
  petLine: { marginTop: 10, marginHorizontal: 4, color: "#fbcfe8", fontSize: 13, lineHeight: 19, fontStyle: "italic" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", color: "rgba(148,163,184,0.85)", fontSize: 11, fontWeight: "700", paddingVertical: 4 },
  cell: { flex: 1, aspectRatio: 1, margin: 2, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  cellPeriod: { backgroundColor: "#f472b6" },
  cellPredicted: { borderColor: "rgba(244,114,182,0.7)", borderStyle: "dashed" },
  cellSelected: { borderColor: "#35d07f", borderWidth: 2 },
  cellText: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },
  cellTextMuted: { color: "rgba(148,163,184,0.45)" },
  cellTextPeriod: { color: "#0f172a", fontWeight: "800" },
  cellTextToday: { textDecorationLine: "underline" },
  fertileDot: { position: "absolute", bottom: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: "#5eead4" },
  loggedDot: { position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(226,232,240,0.7)" },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 14, marginTop: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, marginRight: 6 },
  legendPeriod: { backgroundColor: "#f472b6" },
  legendPredicted: { borderWidth: 1, borderColor: "rgba(244,114,182,0.8)", borderStyle: "dashed" },
  legendFertile: { backgroundColor: "#5eead4", borderRadius: 6 },
  legendText: { color: "rgba(203,213,225,0.9)", fontSize: 11 },
  dayTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  periodToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.6)",
    alignSelf: "flex-start",
  },
  periodToggleOn: { backgroundColor: "#f472b6", borderColor: "#f472b6" },
  periodToggleText: { marginLeft: 8, color: "#fbcfe8", fontSize: 14, fontWeight: "700" },
  periodToggleTextOn: { color: "#0f172a" },
  fieldLabel: { marginTop: 14, color: "rgba(148,163,184,0.95)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(148,163,184,0.35)", marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: "rgba(53,208,127,0.2)", borderColor: "#35d07f" },
  chipText: { color: "#e2e8f0", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  chipTextActive: { color: "#a7f3d0" },
  input: {
    marginTop: 8,
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    backgroundColor: "rgba(15,23,42,0.6)",
    color: "#e2e8f0",
    padding: 12,
  },
  saved: { marginTop: 8, color: "#a7f3d0", fontSize: 12, fontWeight: "600" },
  averages: { marginTop: 6, color: "rgba(226,232,240,0.92)", fontSize: 13, lineHeight: 19 },
  disclaimer: { marginTop: 10, color: "rgba(148,163,184,0.85)", fontSize: 12, lineHeight: 17 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, paddingHorizontal: 6 },
  linkButton: { paddingVertical: 8 },
  linkText: { color: "rgba(203,213,225,0.95)", fontSize: 13, fontWeight: "700" },
  linkDanger: { color: "#fca5a5" },
});
