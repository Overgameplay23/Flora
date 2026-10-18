// Reminders in the pet's voice: opt-in, a morning hello, an evening check-in nudge, a Sunday recap.
// Local notifications only; rebuilt for the next week every time the app opens, so they run out
// on their own if the person stops opening the app (no nagging, no backlog). Colour: rest blue.
import React, { useCallback, useMemo, useState } from "react";
import { Linking, Platform, StyleProp, StyleSheet, Switch, Text, View, ViewStyle } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Chip from "../components/common/Chip";
import IconTile from "../components/common/IconTile";
import { ListGroup, ListRow } from "../components/common/ListGroup";
import { Eyebrow } from "../components/common/Headings";
import PetMascot from "../components/pet/PetMascot";
import { PetLoading } from "../components/pet/PetMoments";
import { useTheme } from "../theme/theme";
import { brand, fonts, type } from "../theme/tokens";
import { selection } from "../utils/haptics";
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

/** React Native's Switch in the screen's rest blue on warm paper. */
function RestSwitch({ value, disabled, onValueChange, accessibilityLabel }: { value: boolean; disabled?: boolean; onValueChange: (value: boolean) => void; accessibilityLabel: string }) {
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone("rest");
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        selection();
        onValueChange(next);
      }}
      trackColor={{ false: surface.track, true: tone.accent }}
      thumbColor={brand.cream}
      ios_backgroundColor={surface.track}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

/** One kind of reminder: an icon, what it is, its switch, and (optionally) the times to pick from. */
function ScheduleCard({
  icon,
  label,
  hint,
  muted,
  children,
  control,
  style,
}: {
  icon: string;
  label: string;
  hint: string;
  muted: boolean;
  control: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { surface } = useTheme();
  return (
    <Card style={[styles.block, muted && styles.cardMuted, style]}>
      <View style={styles.rowBetween}>
        <IconTile icon={icon} category="rest" size={36} />
        <View style={styles.rowText}>
          <Text style={[type.callout, { color: surface.text, fontFamily: fonts.bodyBold }]}>{label}</Text>
          <Text style={[type.meta, styles.rowHint, { color: surface.textSecondary }]}>{hint}</Text>
        </View>
        {control}
      </View>
      {children}
    </Card>
  );
}

export default function RemindersScreen() {
  const { user, profile } = useAuth();
  const { displayName, species, memorial } = usePet();
  const theme = useTheme();
  const { surface, night } = theme;
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

  if (loading) {
    return (
      <Screen scroll={false} centered>
        <PetLoading />
      </Screen>
    );
  }

  const on = settings.enabled && permission === "granted";

  return (
    <Screen>
      <Card tone="rest" style={styles.hero}>
        <PetMascot size={72} mood={on ? "happy" : "calm"} night={night} showShadow={false} />
        <View style={styles.heroBody}>
          <Text style={[type.h3, { color: surface.text }]} accessibilityRole="header">
            {displayName} can say good morning
          </Text>
          <Text style={[type.meta, styles.heroLine, { color: surface.textSecondary }]}>
            A hello in the morning, a gentle nudge at night, a look back on Sundays. Nothing counts down, nothing scolds.
          </Text>
        </View>
      </Card>

      {!remindersSupported ? (
        <Card variant="sunken" style={styles.block}>
          <View style={styles.noteRow}>
            <IconTile icon="phone-portrait-outline" category="rest" size={32} />
            <Text style={[type.callout, styles.noteText, { color: surface.text }]}>Reminders arrive on your phone. Open Luna there to set them up.</Text>
          </View>
        </Card>
      ) : memorial ? (
        <Card variant="sunken" style={styles.block}>
          <View style={styles.noteRow}>
            <IconTile icon="moon-outline" category="calm" size={32} />
            <Text style={[type.callout, styles.noteText, { color: surface.text }]}>Reminders are paused while you remember {displayName}. Your settings are kept.</Text>
          </View>
        </Card>
      ) : null}

      <ListGroup style={styles.block}>
        <ListRow
          icon="notifications-outline"
          category="rest"
          label="Reminders"
          hint={on ? "On" : permission === "denied" ? "Off · allowed in your phone's settings" : "Off"}
          right={
            <RestSwitch
              value={on}
              disabled={!remindersSupported || saving}
              onValueChange={(value) => (value ? turnOn() : persist({ ...settings, enabled: false }))}
              accessibilityLabel="Reminders"
            />
          }
        />
        {permission === "denied" && remindersSupported ? (
          <ListRow icon="settings-outline" category="rest" label="Open phone settings" onPress={() => Linking.openSettings().catch(() => {})} />
        ) : null}
      </ListGroup>

      <Eyebrow style={styles.eyebrow}>When</Eyebrow>
      <ScheduleCard
        icon="sunny-outline"
        label="Morning hello"
        hint={`${displayName} says good morning`}
        muted={!on}
        style={styles.firstSchedule}
        control={
          <RestSwitch
            value={settings.morning.enabled}
            disabled={!on || saving}
            onValueChange={(value) => persist({ ...settings, morning: { ...settings.morning, enabled: value } })}
            accessibilityLabel="Morning hello"
          />
        }
      >
        <View style={styles.chips}>
          {MORNING_TIMES.map((t) => (
            <Chip
              key={formatTime(t)}
              label={formatTime(t)}
              category="rest"
              role="radio"
              selected={sameTime(t, settings.morning.time)}
              disabled={!on || !settings.morning.enabled || saving}
              onPress={() => persist({ ...settings, morning: { ...settings.morning, time: t } })}
              accessibilityLabel={`Morning at ${formatTime(t)}`}
            />
          ))}
        </View>
      </ScheduleCard>

      <ScheduleCard
        icon="cloudy-night-outline"
        label="Evening check-in"
        hint="Only on days you haven't checked in yet"
        muted={!on}
        control={
          <RestSwitch
            value={settings.evening.enabled}
            disabled={!on || saving}
            onValueChange={(value) => persist({ ...settings, evening: { ...settings.evening, enabled: value } })}
            accessibilityLabel="Evening check-in"
          />
        }
      >
        <View style={styles.chips}>
          {EVENING_TIMES.map((t) => (
            <Chip
              key={formatTime(t)}
              label={formatTime(t)}
              category="rest"
              role="radio"
              selected={sameTime(t, settings.evening.time)}
              disabled={!on || !settings.evening.enabled || saving}
              onPress={() => persist({ ...settings, evening: { ...settings.evening, time: t } })}
              accessibilityLabel={`Evening at ${formatTime(t)}`}
            />
          ))}
        </View>
      </ScheduleCard>

      <ScheduleCard
        icon="calendar-outline"
        label="Sunday recap"
        hint={`"${displayName} put together your week", at ${formatTime(settings.weekly.time)}`}
        muted={!on}
        control={
          <RestSwitch
            value={settings.weekly.enabled}
            disabled={!on || saving}
            onValueChange={(value) => persist({ ...settings, weekly: { ...settings.weekly, enabled: value } })}
            accessibilityLabel="Sunday recap"
          />
        }
      />

      {preview.length > 0 ? (
        <View>
          <Eyebrow style={styles.eyebrow}>Next up{on ? "" : ", once reminders are on"}</Eyebrow>
          {preview.map((item, index) => (
            <Card key={item.id} style={[styles.previewCard, index > 0 && styles.previewGap]}>
              <View style={styles.previewRow}>
                <IconTile icon="notifications-outline" category="rest" size={32} />
                <View style={styles.previewBody}>
                  <View style={styles.previewHead}>
                    <Text style={[type.callout, styles.previewTitle, { color: surface.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[type.meta, { color: surface.textTertiary }]}>
                      {item.fireAt.toLocaleDateString(undefined, { weekday: "short" })} {formatTime({ hour: item.fireAt.getHours(), minute: item.fireAt.getMinutes() })}
                    </Text>
                  </View>
                  <Text style={[type.callout, styles.previewText, { color: surface.textSecondary }]}>{item.body}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <Text style={[type.meta, styles.foot, { color: surface.textTertiary }]}>
        Reminders are set on this {Platform.OS === "web" ? "device" : "phone"} for the week ahead and refreshed each time you open Luna. If you stop opening the app, they stop too.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroBody: { flex: 1 },
  heroLine: { marginTop: 4 },
  block: { marginTop: 12 },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  noteText: { flex: 1 },
  eyebrow: { marginTop: 24, marginBottom: 8, marginLeft: 6 },
  firstSchedule: { marginTop: 0 },
  cardMuted: { opacity: 0.55 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1 },
  rowHint: { marginTop: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  previewCard: { paddingVertical: 12 },
  previewGap: { marginTop: 10 },
  previewRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  previewBody: { flex: 1 },
  previewHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  previewTitle: { flex: 1, fontFamily: fonts.bodyBold },
  previewText: { marginTop: 2 },
  foot: { marginTop: 22, textAlign: "center", paddingHorizontal: 8 },
});
