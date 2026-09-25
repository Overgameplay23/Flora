import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { notify } from "../../src/utils/confirm";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { useCycle } from "../../src/hooks/useCycle";
import PetPortrait from "../../src/components/pet/PetPortrait";
import { getISOWeekKey } from "../../src/utils/dateKeys";
import { unifiedStreak } from "../../src/domain/streaks";
import { recomputePetState } from "../../src/services/retention";

function Row({ icon, label, hint, onPress, badge, tone = "default" }) {
  return (
    <Pressable style={[styles.row, tone === "danger" && styles.rowDanger]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={16} color={tone === "danger" ? "#fca5a5" : "#e2e8f0"} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, tone === "danger" && styles.rowLabelDanger]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={16} color="rgba(148,163,184,0.7)" />
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, profile: authProfile, signOut } = useAuth();
  const { sources: petSources, look: petLook, displayName, memorial } = usePet();
  const { enabled: cycleEnabled } = useCycle();
  const [profile, setLocalProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [versionTapCount, setVersionTapCount] = useState(0);
  const [serverStreak, setServerStreak] = useState(null);
  const versionTapResetRef = useRef(null);
  const appVersion = Constants?.expoConfig?.version || "dev";

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLocalProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (error && error.code !== "PGRST116") {
      console.error("PROFILE_FETCH_ERROR", error?.message);
    }
    setLocalProfile(data ?? authProfile ?? null);
    setLoading(false);
  }, [authProfile, user?.id]);

  useEffect(() => {
    if (authProfile) setLocalProfile(authProfile);
  }, [authProfile]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      recomputePetState()
        .then((state) => setServerStreak(state?.streak_days ?? null))
        .catch(() => {});
    }, [fetchProfile])
  );

  useEffect(() => {
    return () => {
      if (versionTapResetRef.current) clearTimeout(versionTapResetRef.current);
    };
  }, []);

  const handleVersionTap = useCallback(() => {
    if (versionTapResetRef.current) clearTimeout(versionTapResetRef.current);
    const nextCount = versionTapCount + 1;
    if (nextCount >= 5) {
      setVersionTapCount(0);
      navigation.navigate("Diagnostics");
      return;
    }
    setVersionTapCount(nextCount);
    versionTapResetRef.current = setTimeout(() => setVersionTapCount(0), 1500);
  }, [navigation, versionTapCount]);

  const streak = unifiedStreak(serverStreak, profile?.current_streak ?? profile?.streak_count ?? 0);
  const bestStreak = Math.max(Number(profile?.best_streak) || 0, streak);
  const currentWeekKey = getISOWeekKey(new Date());
  const showReflectionBadge = (profile?.last_reflection_viewed_week ?? null) !== currentWeekKey;

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#35d07f" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <PetPortrait sources={petSources} look={petLook} size={96} mood="calm" allowOriginal emptyLabel="Add pet" resting={!!memorial} />
        <Text style={styles.heroTitle}>You and {displayName}</Text>
        <Text style={styles.heroEmail} numberOfLines={1}>
          {user?.email || "Signed in"}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>days in a row</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{bestStreak}</Text>
            <Text style={styles.statLabel}>best run</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Reflect</Text>
      <View style={styles.group}>
        <Row icon="book-open" label="Our week" hint={`What ${displayName} noticed`} badge={showReflectionBadge ? "New" : null} onPress={() => navigation.navigate("WeeklyReflection")} />
        <Row icon="sun" label="Log a check-in" hint="How today is going" onPress={() => navigation.navigate("CheckIn")} />
        <Row icon="edit-3" label="Journal" hint="A few lines for yourself" onPress={() => navigation.navigate("Journal")} />
        <Row icon="calendar" label="Cycle tracking" hint={cycleEnabled ? "On · stays on this device" : "Off · optional, on-device only"} onPress={() => navigation.navigate("Cycle")} />
      </View>

      <Text style={styles.sectionTitle}>Your pet</Text>
      <View style={styles.group}>
        <Row icon="camera" label="Change pet photo" hint={`${displayName} gets painted again`} onPress={() => navigation.navigate("Onboarding", { mode: "replace" })} />
        <Row
          icon="moon"
          label={memorial ? `Remembering ${displayName}` : `If ${displayName} has passed away`}
          hint={memorial ? "Memories, and the way back if this was a mistake" : "A quiet memorial garden, no pressure"}
          onPress={() => navigation.navigate("Memorial")}
        />
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.group}>
        <Row
          icon="log-out"
          label="Sign out"
          tone="danger"
          onPress={async () => {
            try {
              await signOut();
            } catch (error) {
              console.error("PROFILE_SIGNOUT_ERROR", error);
              notify("Error", "Could not sign out. Please try again.");
            }
          }}
        />
      </View>

      <Pressable style={styles.version} onPress={handleVersionTap}>
        <Text style={styles.versionText}>Luna {appVersion}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1420" },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 110 },
  hero: {
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  heroTitle: { marginTop: 8, color: "#e2e8f0", fontSize: 20, fontWeight: "800" },
  heroEmail: { marginTop: 2, color: "rgba(148,163,184,0.9)", fontSize: 12 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  stat: { alignItems: "center", paddingHorizontal: 22 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(148,163,184,0.3)" },
  statValue: { color: "#e2e8f0", fontSize: 20, fontWeight: "800" },
  statLabel: { marginTop: 2, color: "rgba(148,163,184,0.9)", fontSize: 11, fontWeight: "600" },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
    color: "rgba(148,163,184,0.95)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  group: {
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    minHeight: 56,
  },
  rowDanger: { borderBottomWidth: 0 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.16)",
    marginRight: 12,
  },
  rowBody: { flex: 1 },
  rowLabel: { color: "#e2e8f0", fontSize: 15, fontWeight: "600" },
  rowLabelDanger: { color: "#fca5a5" },
  rowHint: { marginTop: 2, color: "rgba(148,163,184,0.85)", fontSize: 12 },
  badge: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#35d07f",
  },
  badgeText: { color: "#0f172a", fontSize: 11, fontWeight: "800" },
  version: { alignSelf: "center", marginTop: 22, padding: 8 },
  versionText: { color: "rgba(148,163,184,0.7)", fontSize: 12 },
});
