import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { notify } from "../../src/utils/confirm";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { useCycle } from "../../src/hooks/useCycle";
import PetPortrait from "../../src/components/pet/PetPortrait";
import { PetLoading } from "../../src/components/pet/PetMoments";
import Screen from "../../src/components/common/Screen";
import StatStrip from "../../src/components/common/StatStrip";
import { ListGroup, ListRow } from "../../src/components/common/ListGroup";
import { Eyebrow } from "../../src/components/common/Headings";
import { useTheme } from "../../src/theme/theme";
import { type } from "../../src/theme/tokens";
import { isAdopted } from "../../src/domain/shelter";
import { remindersSummary } from "../../src/domain/reminders";
import { loadReminderSettings, remindersSupported } from "../../src/services/reminders";
import { petTalkAvailable } from "../../src/services/petTalk";
import { getISOWeekKey, getLocalDateKey } from "../../src/utils/dateKeys";
import { useCozyRun } from "../../src/hooks/useCozyRun";
import { cozyCover } from "../../src/domain/cozyRun";
import { recomputePetState } from "../../src/services/retention";
import { loadScrapbook } from "../../src/services/scrapbookStore";
import { loadCarePrefs } from "../../src/services/carePrefs";
import { isPageNew } from "../../src/domain/scrapbook";

export default function ProfileScreen({ navigation }) {
  const { user, profile: authProfile, signOut } = useAuth();
  const theme = useTheme();
  const { surface } = theme;
  const { sources: petSources, look: petLook, displayName, memorial } = usePet();
  const adopted = isAdopted(petLook);
  const [reminderHint, setReminderHint] = useState(remindersSupported ? "Off" : "On your phone");
  const [talkOn, setTalkOn] = useState(false);
  useEffect(() => {
    let alive = true;
    petTalkAvailable().then((value) => alive && setTalkOn(value));
    return () => {
      alive = false;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!remindersSupported) return undefined;
      loadReminderSettings(user?.id).then((settings) => {
        if (alive) setReminderHint(`${remindersSummary(settings)} · in ${displayName}'s voice`);
      });
      return () => {
        alive = false;
      };
    }, [displayName, user?.id])
  );
  // the Sunday scrapbook page says New until it is opened (device-side, src/domain/scrapbook.ts)
  const [scrapbookNew, setScrapbookNew] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!user?.id) return undefined;
      Promise.all([loadScrapbook(user.id), loadCarePrefs(user.id)])
        .then(([book, prefs]) => {
          if (alive) setScrapbookNew(isPageNew(book, getLocalDateKey(), prefs.completedAt ? prefs.completedAt.slice(0, 10) : null));
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [user?.id])
  );
  const { enabled: cycleEnabled } = useCycle();
  const [profile, setLocalProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [versionTapCount, setVersionTapCount] = useState(0);
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
      // keeps the server's pet_state fresh for Talk; the run shown here is the Cozy Run
      recomputePetState().catch(() => {});
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

  // the Cozy Run (src/domain/cozyRun.ts): days of care in a row, with naps, blankets and pauses keeping it safe
  const { state: cozy } = useCozyRun();
  const cozyHint = !cozy
    ? "Days of care in a row, kindly counted"
    : cozy.status === "resting"
      ? "Resting · a few days of care mend it"
      : cozy.status === "none"
        ? "Your first day of care starts one"
        : cozy.pause
          ? "Paused · quiet days are covered"
          : cozyCover(cozy);
  const currentWeekKey = getISOWeekKey(new Date());
  const showReflectionBadge = (profile?.last_reflection_viewed_week ?? null) !== currentWeekKey;

  if (loading && !profile) {
    return (
      <Screen scroll={false} centered topInset>
        <PetLoading />
      </Screen>
    );
  }

  return (
    <Screen topInset bottomPad={110}>
      <View style={[styles.hero, { backgroundColor: theme.tone("connection").fill, boxShadow: surface.shadow }]}>
        <PetPortrait sources={petSources} look={petLook} size={112} mood={memorial ? "calm" : "happy"} allowOriginal emptyLabel="Add pet" resting={!!memorial} />
        <Text style={[type.title, styles.heroTitle, { color: surface.text }]} accessibilityRole="header">
          You and {displayName}
        </Text>
        <Text style={[type.meta, { color: surface.textSecondary }]} numberOfLines={1}>
          {user?.email || "Signed in"}
        </Text>
      </View>
      <StatStrip
        style={styles.stats}
        items={[
          { value: cozy ? cozy.days : "–", label: cozy?.days === 1 ? "day in your cozy run" : "days in your cozy run", icon: "moon-outline", category: "rest" },
          { value: cozy ? cozy.best : "–", label: "longest run", icon: "ribbon-outline", category: "play" },
        ]}
      />

      <Eyebrow style={styles.sectionTitle}>Reflect</Eyebrow>
      <ListGroup>
        <ListRow icon="book-outline" category="connection" label="Our week" hint={`What ${displayName} noticed`} badge={showReflectionBadge ? "New" : null} onPress={() => navigation.navigate("WeeklyReflection")} />
        <ListRow icon="images-outline" category="connection" label="Scrapbook" hint={`A page a week from ${displayName}`} badge={scrapbookNew ? "New" : null} onPress={() => navigation.navigate("Scrapbook")} />
        <ListRow icon="calendar-outline" category="calm" label="This month" hint={`Patterns ${displayName} noticed`} onPress={() => navigation.navigate("Insights")} />
        <ListRow icon="moon-outline" category="rest" label="Cozy Run" hint={cozyHint} onPress={() => navigation.navigate("CozyRun")} />
        <ListRow icon="map-outline" category="focus" label="Journeys" hint="Seven-day arcs, one small step a day" onPress={() => navigation.navigate("Journeys")} />
        <ListRow icon="ribbon-outline" category="play" label="Keepsakes" hint={`The moments ${displayName} keeps for you`} onPress={() => navigation.navigate("Keepsakes")} />
        <ListRow icon="sunny-outline" category="energy" label="Log a check-in" hint="How today is going" onPress={() => navigation.navigate("CheckIn")} />
        <ListRow icon="create-outline" category="focus" label="Journal" hint="A few lines for yourself" onPress={() => navigation.navigate("Journal")} />
        <ListRow icon="flower-outline" category="cycle" label="Cycle tracking" hint={cycleEnabled ? "On · stays on this device" : "Off · optional, on-device only"} onPress={() => navigation.navigate("Cycle")} />
        <ListRow icon="notifications-outline" category="rest" label="Reminders" hint={reminderHint} onPress={() => navigation.navigate("Reminders")} />
      </ListGroup>

      <Eyebrow style={styles.sectionTitle}>Your pet</Eyebrow>
      <ListGroup>
        {talkOn ? <ListRow icon="chatbubble-ellipses-outline" category="calm" label={`Talk to ${displayName}`} hint="A few words, in their voice" onPress={() => navigation.navigate("PetTalk")} /> : null}
        {adopted ? (
          <ListRow icon="heart-outline" category="connection" label={`${displayName} is an adopted companion`} hint="Change their look or name from the Pet tab" onPress={() => navigation.navigate("Onboarding", { mode: "look" })} />
        ) : (
          <ListRow icon="camera-outline" category="play" label="Change pet photo" hint={`${displayName} gets painted again`} onPress={() => navigation.navigate("Onboarding", { mode: "replace" })} />
        )}
        {!adopted || memorial ? (
          <ListRow
            icon="moon-outline"
            category="calm"
            label={memorial ? `Remembering ${displayName}` : `If ${displayName} has passed away`}
            hint={memorial ? "Memories, and the way back if this was a mistake" : "A quiet memorial garden, no pressure"}
            onPress={() => navigation.navigate("Memorial")}
          />
        ) : null}
      </ListGroup>

      <Eyebrow style={styles.sectionTitle}>Account</Eyebrow>
      <ListGroup>
        <ListRow
          icon="shield-checkmark-outline"
          category="calm"
          label="Privacy"
          hint="What we keep, and what stays on this phone"
          onPress={() => navigation.navigate("Privacy")}
        />
        <ListRow
          icon="log-out-outline"
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
        <ListRow
          icon="trash-outline"
          label="Delete account"
          hint="Removes your account and everything in it"
          tone="danger"
          onPress={() => navigation.navigate("DeleteAccount")}
        />
      </ListGroup>

      <Pressable style={styles.version} onPress={handleVersionTap} accessibilityLabel={`Version ${appVersion}`}>
        <Text style={[type.meta, { color: surface.textTertiary }]}>Luna {appVersion}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderRadius: 28,
    borderCurve: "continuous",
  },
  heroTitle: { marginTop: 10, textAlign: "center" },
  stats: { marginTop: 12 },
  sectionTitle: { marginTop: 24, marginBottom: 8, marginLeft: 6 },
  version: { alignSelf: "center", marginTop: 22, padding: 8 },
});
