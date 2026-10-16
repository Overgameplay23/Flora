import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { confirmAsync, notify } from "../utils/confirm";
import { usePet } from "../hooks/usePet";
import { useCycle } from "../hooks/useCycle";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Chip from "../components/common/Chip";
import IconTile from "../components/common/IconTile";
import PressableScale from "../components/common/PressableScale";
import StatStrip from "../components/common/StatStrip";
import TextField from "../components/common/TextField";
import { Eyebrow, Lead, ScreenTitle, SectionTitle } from "../components/common/Headings";
import PetMascot from "../components/pet/PetMascot";
import SpeechBubble from "../components/pet/SpeechBubble";
import { PetLoading, useHasPet } from "../components/pet/PetMoments";
import { useTheme } from "../theme/theme";
import { brand, fonts, ink, radius, space, type } from "../theme/tokens";
import { selection, tapSoft, warning } from "../utils/haptics";
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

/** "mood swings" -> "Mood swings" (chip labels; the stored value stays as it is) */
function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** A token hex at a given opacity (predicted days on night paper, where the tint would glare). */
function withAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Optional cycle tracker. Everything stays on the device; the pet keeps the tone gentle. Turning it on
 * is an explicit choice on this screen, and deleting the data is one tap. Colour: gentle-care pink
 * (period days strong, expected days tint, today ringed in ink).
 */
export default function CycleScreen() {
  const { userId, enabled, data, status, loading, today } = useCycle();
  const { displayName } = usePet();
  const theme = useTheme();
  const { surface, night } = theme;
  const tone = theme.tone("cycle");
  const hasPet = useHasPet();
  const { width } = useWindowDimensions();
  const todayDate = parseDateKey(today) || new Date();
  const [view, setView] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState<DayLog>({ date: today, flow: null, symptoms: [], note: "" });
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const existing = dayLogFor(data, selected);
    setDraft({ date: selected, flow: existing?.flow ?? null, symptoms: existing?.symptoms ?? [], note: existing?.note ?? "" });
    setSavedNote(null);
    setSaveFailed(false);
  }, [data, selected]);

  const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
  const predicted = useMemo(() => predictedPeriodDays(data, today), [data, today]);
  const selectedIsPeriod = isPeriodDay(data, selected);
  const selectedInFuture = selected > today;

  // calendar colours on this paper
  const periodFill = night ? tone.mid : tone.strong;
  const periodText = night ? ink.primary : brand.cream;
  const predictedFill = night ? withAlpha(tone.mid, 0.22) : tone.tint;

  const persist = async (next: typeof data) => {
    if (!userId) return false;
    setSaving(true);
    setSaveFailed(false);
    try {
      await saveCycleData(userId, next);
      return true;
    } catch (error) {
      console.warn("CYCLE_SAVE_FAILED", (error as any)?.message || String(error));
      warning();
      setSaveFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const togglePeriodDay = async () => {
    if (selectedInFuture) {
      notify("That day hasn't happened yet", "Log period days as they come; predictions handle the future.");
      return;
    }
    const marking = !selectedIsPeriod;
    const ok = await persist(marking ? logPeriodDay(data, selected) : unlogPeriodDay(data, selected));
    if (ok && marking) tapSoft();
  };

  const saveDay = async () => {
    const ok = await persist(upsertDayLog(data, { ...draft, note: draft.note?.trim() || null }));
    if (ok) {
      tapSoft();
      setSavedNote("Saved on this device.");
    }
  };

  const toggleSymptom = (symptom: string) => {
    setDraft((prev) => ({
      ...prev,
      symptoms: prev.symptoms?.includes(symptom) ? prev.symptoms.filter((s) => s !== symptom) : [...(prev.symptoms || []), symptom],
    }));
  };

  const pickDay = (date: string) => {
    if (date !== selected) selection();
    setSelected(date);
  };

  const turnOn = () => userId && setCycleEnabled(userId, true);
  const turnOff = () => userId && setCycleEnabled(userId, false);
  const deleteAll = async () => {
    if (!userId) return;
    const ok = await confirmAsync({ title: "Delete all cycle data?", message: "This removes every logged day from this device. It cannot be undone.", confirmText: "Delete", destructive: true });
    if (ok) await clearCycleData(userId);
  };

  if (loading) {
    return (
      <Screen scroll={false} centered>
        <PetLoading />
      </Screen>
    );
  }

  // ---- off: what it is, and the promise that it stays here ------------------------------------------
  if (!enabled) {
    return (
      <Screen>
        <View style={styles.hero}>
          <PetMascot size={110} mood="calm" night={night} />
          <ScreenTitle center style={styles.heroTitle}>
            Track your cycle with {displayName}
          </ScreenTitle>
          <Lead center style={styles.heroBody}>
            Log period days and a few symptoms; {displayName} keeps track of where you are in your cycle and when the next one is likely.
          </Lead>
        </View>
        <Card tone="cycle" style={styles.block}>
          <PromiseRow icon="phone-portrait-outline" text="Stays on this device. It is never uploaded or shared." />
          <PromiseRow icon="trash-outline" text="Delete everything in one tap, any time." />
          <PromiseRow icon="information-circle-outline" text="Estimates only, based on your own dates. Not medical advice, and no fertility predictions." />
        </Card>
        <Button label="Turn on cycle tracking" onPress={turnOn} containerStyle={styles.primaryButton} />
      </Screen>
    );
  }

  // ---- on ----------------------------------------------------------------------------------------------
  const line = phaseLine(status, displayName);
  const bubbleWidth = Math.max(160, Math.min(280, width - space.gutter * 2 - 118));

  return (
    <Screen keyboard>
      {hasPet ? (
        <View style={styles.petRow}>
          <PetMascot size={96} mood={status.phase === "period" ? "calm" : "happy"} night={night} />
          <SpeechBubble text={line} tail="left" night={night} maxWidth={bubbleWidth} style={styles.petBubble} />
        </View>
      ) : null}

      <Card tone="cycle" style={hasPet ? styles.statusAfterPet : null}>
        <View style={styles.statusRow}>
          <IconTile icon="flower-outline" category="cycle" on="fill" size={44} />
          <View style={styles.statusBody}>
            <Text style={[type.h2, { color: surface.text }]} accessibilityRole="header">
              {phaseLabel(status.phase)}
            </Text>
            {status.cycleDay != null ? (
              <Text style={[type.meta, styles.statusMeta, { color: surface.textSecondary }]}>
                Cycle day {status.cycleDay} of about {status.cycleLength}
              </Text>
            ) : null}
            {status.nextPeriodStart ? (
              <Text style={[type.meta, styles.statusMeta, { color: surface.textSecondary }]}>
                Next period around {shortDate(status.nextPeriodStart)}
                {status.daysUntilNextPeriod != null && status.daysUntilNextPeriod >= 0 ? ` · in ${status.daysUntilNextPeriod} ${status.daysUntilNextPeriod === 1 ? "day" : "days"}` : ""}
              </Text>
            ) : null}
          </View>
        </View>
        {/* without a pet to say it, the line sits in the card */}
        {!hasPet ? <Text style={[type.petVoice, styles.lineInCard, { color: surface.text }]}>{line}</Text> : null}
      </Card>

      {/* ---- the month ---- */}
      <Card style={styles.block}>
        <View style={styles.monthRow}>
          <PressableScale
            onPress={() => setView((v) => shiftMonth(v.year, v.month, -1))}
            hitSlop={10}
            pressedScale={0.9}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={[styles.monthButton, { backgroundColor: surface.sunken }]}
          >
            <Ionicons name="chevron-back" size={18} color={surface.text} />
          </PressableScale>
          <Text style={[type.h3, { color: surface.text }]}>{monthTitle(view.year, view.month)}</Text>
          <PressableScale
            onPress={() => setView((v) => shiftMonth(v.year, v.month, 1))}
            hitSlop={10}
            pressedScale={0.9}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={[styles.monthButton, { backgroundColor: surface.sunken }]}
          >
            <Ionicons name="chevron-forward" size={18} color={surface.text} />
          </PressableScale>
        </View>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={[type.micro, styles.weekday, { color: surface.textTertiary }]}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week, index) => (
          <View key={index} style={styles.weekRow}>
            {week.map((cell) => {
              const period = isPeriodDay(data, cell.date);
              const isPredicted = !period && predicted.has(cell.date);
              const isToday = cell.date === today;
              const isSelected = cell.date === selected;
              const logged = !!dayLogFor(data, cell.date);
              const textColor = period ? periodText : cell.inMonth ? surface.text : surface.textTertiary;
              return (
                <PressableScale
                  key={cell.date}
                  onPress={() => pickDay(cell.date)}
                  pressedScale={0.9}
                  containerStyle={styles.cellSlot}
                  style={[styles.cellRing, { borderColor: isSelected ? tone.accent : "transparent" }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${humanDate(cell.date)}${period ? ", period day" : isPredicted ? ", period expected" : ""}${isToday ? ", today" : ""}`}
                >
                  <View
                    style={[
                      styles.cell,
                      {
                        backgroundColor: period ? periodFill : isPredicted ? predictedFill : "transparent",
                        borderColor: isToday ? surface.text : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        { color: textColor, fontFamily: period || isToday ? fonts.bodyHeavy : fonts.bodySemibold },
                        !cell.inMonth && !period && styles.cellTextMuted,
                      ]}
                    >
                      {cell.day}
                    </Text>
                    {logged ? <View style={[styles.loggedDot, { backgroundColor: period ? periodText : tone.accent }]} /> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))}
        <View style={styles.legend}>
          <Legend label="Period">
            <View style={[styles.legendSwatch, { backgroundColor: periodFill }]} />
          </Legend>
          <Legend label="Expected">
            <View style={[styles.legendSwatch, { backgroundColor: predictedFill }]} />
          </Legend>
          <Legend label="Notes">
            <View style={[styles.legendDot, { backgroundColor: tone.accent }]} />
          </Legend>
          <Legend label="Today">
            <View style={[styles.legendSwatch, styles.legendRing, { borderColor: surface.text }]} />
          </Legend>
        </View>
      </Card>

      {/* ---- the selected day ---- */}
      <Card style={styles.block}>
        <Text style={[type.h3, { color: surface.text }]}>{humanDate(selected)}</Text>
        <PressableScale
          onPress={togglePeriodDay}
          disabled={saving}
          pressedScale={0.95}
          accessibilityRole="switch"
          accessibilityState={{ checked: selectedIsPeriod, disabled: saving }}
          containerStyle={styles.toggleSlot}
          style={[styles.periodToggle, { backgroundColor: selectedIsPeriod ? periodFill : night ? surface.sunken : tone.tint }]}
        >
          <Ionicons name={selectedIsPeriod ? "checkmark-circle" : "ellipse-outline"} size={20} color={selectedIsPeriod ? periodText : tone.accent} />
          <Text style={[styles.periodToggleText, { color: selectedIsPeriod ? periodText : surface.text }]}>{selectedIsPeriod ? "Period day" : "Mark as a period day"}</Text>
        </PressableScale>

        {selectedIsPeriod ? (
          <>
            <Eyebrow style={styles.fieldLabel}>Flow</Eyebrow>
            <View style={styles.chipRow}>
              {FLOWS.map((flow) => (
                <Chip
                  key={flow}
                  label={capitalize(flow)}
                  category="cycle"
                  selected={draft.flow === flow}
                  onPress={() => setDraft((p) => ({ ...p, flow: p.flow === flow ? null : flow }))}
                />
              ))}
            </View>
          </>
        ) : null}

        <Eyebrow style={styles.fieldLabel}>Symptoms</Eyebrow>
        <View style={styles.chipRow}>
          {SYMPTOMS.map((symptom) => (
            <Chip key={symptom} label={capitalize(symptom)} category="cycle" selected={!!draft.symptoms?.includes(symptom)} onPress={() => toggleSymptom(symptom)} />
          ))}
        </View>

        <TextField
          label="Note (optional)"
          value={draft.note || ""}
          onChangeText={(note) => setDraft((p) => ({ ...p, note }))}
          placeholder="Anything worth remembering"
          multiline
          maxLength={280}
          containerStyle={styles.noteField}
          style={styles.noteInput}
        />
        {savedNote ? (
          <View style={styles.savedRow}>
            <Ionicons name="checkmark-circle" size={16} color={tone.accent} />
            <Text style={[type.meta, { color: tone.accent }]}>{savedNote}</Text>
          </View>
        ) : null}
        {saveFailed ? <Text style={[type.meta, styles.savedRow, { color: theme.alert }]}>Couldn't save that just now. Try again in a moment.</Text> : null}
        <Button label="Save day" onPress={saveDay} loading={saving} containerStyle={styles.primaryButton} />
      </Card>

      {/* ---- averages ---- */}
      <SectionTitle>Your averages</SectionTitle>
      <StatStrip
        items={[
          { value: status.cycleLength, label: "day cycle (about)", icon: "repeat-outline", category: "cycle" },
          { value: status.periodLength, label: "day period (about)", icon: "water-outline", category: "cycle" },
        ]}
      />
      <Text style={[type.meta, styles.averagesNote, { color: surface.textSecondary }]}>
        {status.sample > 0
          ? `Averaged from ${status.sample} logged ${status.sample === 1 ? "cycle" : "cycles"}.`
          : "Defaults until two cycles are logged."}
      </Text>
      <Card variant="sunken" style={styles.disclaimer}>
        <View style={styles.disclaimerRow}>
          <Ionicons name="lock-closed-outline" size={16} color={surface.textSecondary} />
          <Text style={[type.meta, styles.disclaimerText, { color: surface.textSecondary }]}>
            Estimates come only from the dates you log here and can be off by several days. They are not medical advice, and Luna makes no fertility predictions. Everything stays on this device.
          </Text>
        </View>
      </Card>

      <View style={styles.footerRow}>
        <Button label="Turn off tracking" onPress={turnOff} variant="quiet" size="sm" />
        <Button label="Delete all cycle data" onPress={deleteAll} variant="danger" size="sm" />
      </View>
    </Screen>
  );
}

function PromiseRow({ icon, text }: { icon: string; text: string }) {
  const { surface } = useTheme();
  return (
    <View style={styles.promiseRow}>
      <IconTile icon={icon} category="cycle" on="fill" size={36} />
      <Text style={[type.callout, styles.promiseText, { color: surface.text }]}>{text}</Text>
    </View>
  );
}

function Legend({ label, children }: { label: string; children: React.ReactNode }) {
  const { surface } = useTheme();
  return (
    <View style={styles.legendItem}>
      {children}
      <Text style={[type.meta, { color: surface.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 4, paddingBottom: 8 },
  heroTitle: { marginTop: 12 },
  heroBody: { marginTop: 8, paddingHorizontal: 4 },
  block: { marginTop: 14 },
  primaryButton: { marginTop: 18 },
  promiseRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 6 },
  promiseText: { flex: 1 },
  petRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  petBubble: { marginTop: 10, flexShrink: 1 },
  statusAfterPet: { marginTop: 6 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  statusBody: { flex: 1 },
  statusMeta: { marginTop: 2 },
  lineInCard: { marginTop: 12 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  monthButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", paddingVertical: 4 },
  cellSlot: { flex: 1 },
  cellRing: { aspectRatio: 1, margin: 1, padding: 2, borderRadius: radius.tile, borderCurve: "continuous", borderWidth: 2 },
  cell: { flex: 1, borderRadius: 12, borderCurve: "continuous", borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  cellText: { fontSize: 14 },
  cellTextMuted: { opacity: 0.6 },
  loggedDot: { position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 5 },
  legendRing: { borderWidth: 1.5 },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  toggleSlot: { alignSelf: "flex-start", marginTop: 12 },
  periodToggle: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill },
  periodToggleText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  fieldLabel: { marginTop: 18, marginBottom: 8, marginLeft: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  noteField: { marginTop: 18 },
  noteInput: { minHeight: 80 },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, marginLeft: 4 },
  averagesNote: { marginTop: 10, marginHorizontal: 6 },
  disclaimer: { marginTop: 12 },
  disclaimerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  disclaimerText: { flex: 1 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22 },
});
