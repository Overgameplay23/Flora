// Reminders in the pet's voice: opt-in, a morning hello, an evening check-in nudge, a Sunday recap.
// Local notifications only; rebuilt for the next week every time the app opens, so they run out
// on their own if the person stops opening the app (no nagging, no backlog).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import PetPortrait from "../components/pet/PetPortrait";
import {
  DEFAULT_REMINDERS,
  EVENING_TIMES,
  MORNING_TIMES,
  ReminderSettings,
  ReminderTime,
  buildReminderPlan,
  formatTime,
} from "../domain/reminders";
import {
  PermissionState,
  getReminderPermission,
  loadReminderSettings,
  remindersSupported,
  requestReminderPermission,
  saveReminderSettings,
  syncReminders,
} from "../services/reminders";
import { getLocalDateKey } from "../utils/dateKeys";

function sameTime(a: ReminderTime, b: ReminderTime) {
  return a.hour === b.hour && a.minute === b.minute;
}

export default function RemindersScreen() {
  const { user, profile } = useAuth();
  const { sources, look, displayName, species, memorial } = usePet();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [permission, setPermission] = useState<PermissionState>(remindersSupported ? "undetermined" : "unsupported");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [saved, perm] = await Promise.all([loadReminderSettings(user?.id), getReminderPermission()]);
    setSettings(saved);
    setPermission(perm);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const checkedInToday = profile?.last_checkin_date === getLocalDateKey();

  const persist = useCallback(
    async (next: ReminderSettings) => {
      if (!user?.id) return;
      setSettings(next);
      setSaving(true);
      try {
        await saveReminderSettings(user.id, next);
        await syncReminders(user.id, { petName: displayName, species, memorial: !!memorial, checkedInToday }, { force: true });
      } finally {
        setSaving(false);
      }
    },
    [checkedInToday, displayName, memorial, species, user?.id]
  );

  const turnOn = async () => {
    let perm = permission;
    if (perm !== "granted") {
      perm = await requestReminderPermission();
      setPermission(perm);
    }
    if (perm === "granted") await persist({ ...settings, enabled: true });
  };

  const preview = useMemo(() => {
    const plan = buildReminderPlan({ ...settings, enabled: true }, { petName: displayName, species, memorial: !!memorial, checkedInToday, days: 2 });
    return plan.slice(0, 2);
  }, [checkedInToday, displayName, memorial, settings, species]);

  useEffect(() => {
    // nothing else to do here; kept so the linter sees the preview dependency chain
  }, [preview]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#35d07f" />
      </View>
    );
  }

  const on = settings.enabled && permission === "granted";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <PetPortrait sources={sources} look={look} size={72} mood={on ? "happy" : "calm"} resting={!!memorial} allowOriginal emptyLabel="Pet" style={styles.heroPet} />
        <View style={styles.heroBody}>
          <Text style={styles.heroTitle}>{displayName} can say good morning</Text>
          <Text style={styles.heroLine}>A hello in the morning, a gentle nudge at night, a look back on Sundays. Nothing counts down, nothing scolds.</Text>
        </View>
      </View>

      {!remindersSupported ? (
        <View style={styles.note}>
          <Feather name="smartphone" size={16} color="#86efac" />
          <Text style={styles.noteText}>Reminders arrive on your phone. Open Luna there to set them up.</Text>
        </View>
      ) : memorial ? (
        <View style={styles.note}>
          <Feather name="moon" size={16} color="#c4b5fd" />
          <Text style={styles.noteText}>Reminders are paused while you remember {displayName}. Your settings are kept.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Reminders</Text>
            <Text style={styles.rowHint}>{on ? "On" : permission === "denied" ? "Off · allowed in your phone's settings" : "Off"}</Text>
          </View>
          <Switch
            value={on}
            disabled={!remindersSupported || saving}
            onValueChange={(value) => (value ? turnOn() : persist({ ...settings, enabled: false }))}
            trackColor={{ false: "rgba(148,163,184,0.3)", true: "#35d07f" }}
            thumbColor="#f8fafc"
            accessibilityLabel="Reminders"
          />
        </View>
        {permission === "denied" && remindersSupported ? (
          <Pressable style={styles.linkButton} onPress={() => Linking.openSettings().catch(() => {})} accessibilityRole="button">
            <Text style={styles.linkText}>Open phone settings</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.card, !on && styles.cardMuted]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Morning hello</Text>
            <Text style={styles.rowHint}>{displayName} says good morning</Text>
          </View>
          <Switch
            value={settings.morning.enabled}
            disabled={!on || saving}
            onValueChange={(value) => persist({ ...settings, morning: { ...settings.morning, enabled: value } })}
            trackColor={{ false: "rgba(148,163,184,0.3)", true: "#35d07f" }}
            thumbColor="#f8fafc"
            accessibilityLabel="Morning hello"
          />
        </View>
        <View style={styles.chips}>
          {MORNING_TIMES.map((t) => {
            const active = sameTime(t, settings.morning.time);
            return (
              <Pressable
                key={formatTime(t)}
                style={[styles.chip, active && styles.chipActive]}
                disabled={!on || !settings.morning.enabled || saving}
                onPress={() => persist({ ...settings, morning: { ...settings.morning, time: t } })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Morning at ${formatTime(t)}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatTime(t)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, !on && styles.cardMuted]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Evening check-in</Text>
            <Text style={styles.rowHint}>Only on days you haven't checked in yet</Text>
          </View>
          <Switch
            value={settings.evening.enabled}
            disabled={!on || saving}
            onValueChange={(value) => persist({ ...settings, evening: { ...settings.evening, enabled: value } })}
            trackColor={{ false: "rgba(148,163,184,0.3)", true: "#35d07f" }}
            thumbColor="#f8fafc"
            accessibilityLabel="Evening check-in"
          />
        </View>
        <View style={styles.chips}>
          {EVENING_TIMES.map((t) => {
            const active = sameTime(t, settings.evening.time);
            return (
              <Pressable
                key={formatTime(t)}
                style={[styles.chip, active && styles.chipActive]}
                disabled={!on || !settings.evening.enabled || saving}
                onPress={() => persist({ ...settings, evening: { ...settings.evening, time: t } })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Evening at ${formatTime(t)}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatTime(t)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, !on && styles.cardMuted]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Sunday recap</Text>
            <Text style={styles.rowHint}>"{displayName} put together your week", at {formatTime(settings.weekly.time)}</Text>
          </View>
          <Switch
            value={settings.weekly.enabled}
            disabled={!on || saving}
            onValueChange={(value) => persist({ ...settings, weekly: { ...settings.weekly, enabled: value } })}
            trackColor={{ false: "rgba(148,163,184,0.3)", true: "#35d07f" }}
            thumbColor="#f8fafc"
            accessibilityLabel="Sunday recap"
          />
        </View>
      </View>

      {preview.length > 0 ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Next up{on ? "" : ", once reminders are on"}</Text>
          {preview.map((item) => (
            <View key={item.id} style={styles.previewRow}>
              <Text style={styles.previewWhen}>
                {item.fireAt.toLocaleDateString(undefined, { weekday: "short" })} {formatTime({ hour: item.fireAt.getHours(), minute: item.fireAt.getMinutes() })}
              </Text>
              <View style={styles.bubble}>
                <Text style={styles.bubbleFrom}>{item.title}</Text>
                <Text style={styles.bubbleText}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.foot}>
        Reminders are set on this {Platform.OS === "web" ? "device" : "phone"} for the week ahead and refreshed each time you open Luna. If you stop opening the app, they stop too.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1420" },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(53,208,127,0.10)",
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.28)",
    marginBottom: 12,
  },
  heroPet: { marginRight: 12 },
  heroBody: { flex: 1 },
  heroTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "800" },
  heroLine: { marginTop: 4, color: "rgba(226,232,240,0.9)", fontSize: 13, lineHeight: 19 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    marginBottom: 12,
  },
  noteText: { flex: 1, color: "rgba(226,232,240,0.9)", fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    padding: 14,
    marginBottom: 12,
  },
  cardMuted: { opacity: 0.55 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowText: { flex: 1 },
  rowLabel: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  rowHint: { marginTop: 2, color: "rgba(148,163,184,0.9)", fontSize: 12, lineHeight: 16 },
  linkButton: { marginTop: 10, alignSelf: "flex-start" },
  linkText: { color: "#86efac", fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(148,163,184,0.3)", backgroundColor: "rgba(148,163,184,0.08)" },
  chipActive: { borderColor: "#35d07f", backgroundColor: "rgba(53,208,127,0.18)" },
  chipText: { color: "rgba(226,232,240,0.9)", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#a7f3d0" },
  previewCard: { marginTop: 4, marginBottom: 12 },
  previewTitle: { color: "rgba(148,163,184,0.9)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  previewRow: { marginBottom: 10 },
  previewWhen: { color: "rgba(148,163,184,0.8)", fontSize: 11, marginBottom: 4, marginLeft: 6 },
  bubble: { alignSelf: "flex-start", maxWidth: "92%", borderRadius: 16, borderTopLeftRadius: 6, padding: 12, backgroundColor: "rgba(53,208,127,0.12)", borderWidth: 1, borderColor: "rgba(53,208,127,0.25)" },
  bubbleFrom: { color: "#86efac", fontSize: 12, fontWeight: "700", marginBottom: 2 },
  bubbleText: { color: "#f8fafc", fontSize: 14, lineHeight: 20 },
  foot: { color: "rgba(148,163,184,0.75)", fontSize: 12, lineHeight: 17, textAlign: "center", paddingHorizontal: 8 },
});
