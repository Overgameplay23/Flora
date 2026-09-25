import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";
import Card from "../../src/components/ui/Card";
import SectionTitle from "../../src/components/ui/SectionTitle";
import StatPill from "../../src/components/ui/StatPill";
import { getISOWeekKey } from "../../src/utils/dateKeys";

export default function ProfileScreen({ navigation }) {
  const { user, profile: authProfile, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [profile, setLocalProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [versionTapCount, setVersionTapCount] = useState(0);
  const versionTapResetRef = useRef(null);
  const appVersion = Constants?.expoConfig?.version || "dev";

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setEmail("");
      setLocalProfile(null);
      setLoading(false);
      return;
    }

    setEmail(user.email || "");
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (error && error.code !== "PGRST116") {
      console.error("PROFILE_FETCH_ERROR", error?.message);
    }
    const nextProfile = data ?? authProfile ?? null;
    setLocalProfile(nextProfile);
    setLoading(false);
  }, [authProfile, user?.email, user?.id]);

  useEffect(() => {
    if (authProfile) {
      setLocalProfile(authProfile);
    }
  }, [authProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  useEffect(() => {
    return () => {
      if (versionTapResetRef.current) {
        clearTimeout(versionTapResetRef.current);
      }
    };
  }, []);

  const handleVersionTap = useCallback(() => {
    if (versionTapResetRef.current) {
      clearTimeout(versionTapResetRef.current);
    }
    const nextCount = versionTapCount + 1;
    if (nextCount >= 5) {
      setVersionTapCount(0);
      navigation.navigate("Diagnostics");
      return;
    }
    setVersionTapCount(nextCount);
    versionTapResetRef.current = setTimeout(() => {
      setVersionTapCount(0);
    }, 1500);
  }, [navigation, versionTapCount]);

  const streak = profile?.current_streak ?? profile?.streak_count ?? 0;
  const bestStreak = profile?.best_streak ?? streak;
  const xp = profile?.xp ?? 0;
  const garden = profile?.garden_level ?? 0;
  const currentWeekKey = getISOWeekKey(new Date());
  const showReflectionBadge = (profile?.last_reflection_viewed_week ?? null) !== currentWeekKey;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 px-4 pt-4">
      <SectionTitle className="mb-4">Profile</SectionTitle>

      <Card className="mb-4">
        <Text className="text-sm text-slate-500">Email</Text>
        <Text className="text-base font-semibold text-slate-900">{email || "Unknown"}</Text>
      </Card>

      <Card className="mb-4">
        <SectionTitle className="mb-3">Stats</SectionTitle>
        <View className="flex-row justify-between">
          <StatPill label="Streak" value={`${streak} days`} />
          <StatPill label="Best" value={`${bestStreak}`} />
          <StatPill label="XP" value={`${xp}`} />
        </View>
        <View className="mt-3">
          <StatPill label="Garden" value={`${garden}`} />
        </View>
      </Card>

      <View className="gap-3">
        <Pressable
          className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          onPress={() => navigation.navigate("WeeklyReflection")}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-slate-900 font-semibold">Reflect on my week</Text>
            {showReflectionBadge ? (
              <View className="rounded-full bg-emerald-500 px-2 py-1">
                <Text className="text-[11px] font-semibold text-white">New</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          className="rounded-xl bg-emerald-500 px-4 py-3 items-center"
          onPress={() => navigation.navigate("CheckIn")}
        >
          <Text className="text-white font-semibold">Log a Check-In</Text>
        </Pressable>
        <Pressable
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 items-center"
          onPress={() => navigation.navigate("PetSetup")}
        >
          <Text className="text-emerald-800 font-semibold">Change Pet</Text>
        </Pressable>
        <Pressable
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 items-center"
          onPress={async () => {
            try {
              await signOut();
            } catch (error) {
              console.error("PROFILE_SIGNOUT_ERROR", error);
              Alert.alert("Error", "Could not sign out. Please try again.");
            }
          }}
        >
          <Text className="text-slate-600 font-semibold">Sign Out</Text>
        </Pressable>
      </View>

      <Pressable className="mt-6 items-center" onPress={handleVersionTap}>
        <Text className="text-xs text-slate-400">Version {appVersion}</Text>
      </Pressable>
    </View>
  );
}
