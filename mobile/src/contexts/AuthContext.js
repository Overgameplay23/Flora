import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { fetchUserStats } from "../services/dailyLoop";
import { clearPetStore } from "../services/petStore";
import { clearAuthFetchIssue, getAuthFetchIssue, subscribeAuthFetchIssue } from "../utils/net";
import { diagLog } from "../utils/diagLog";

const RETRYABLE_AUTH_STATUSES = new Set([502, 503, 504, 521]);
// Remembered per user so an offline launch can still tell "has a pet" from "never set one up" (R-04).
const PET_READY_KEY_PREFIX = "floura:pet-ready:";

async function readCachedHasPet(userId) {
  try {
    const raw = await AsyncStorage.getItem(PET_READY_KEY_PREFIX + userId);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch (_error) {}
  return null;
}

async function writeCachedHasPet(userId, hasPet) {
  try {
    await AsyncStorage.setItem(PET_READY_KEY_PREFIX + userId, hasPet ? "1" : "0");
  } catch (_error) {}
}

const AuthContext = createContext({
  user: null,
  profile: null,
  userStats: null,
  petEmotionState: null,
  session: null,
  initializing: true,
  loading: true,
  /** "idle" | "loading" | "ready" | "error": whether the profile row could be loaded for this user */
  profileStatus: "idle",
  /** last remembered answer to "does this user have a pet" (true / false / null = unknown) */
  cachedHasPet: null,
  retryHydrate: async () => {},
  authServiceMessage: null,
  setProfile: (_next) => {},
  setUserStats: (_next) => {},
  setPetEmotionState: (_next) => {},
  clearAuthServiceMessage: () => {},
  signOut: async () => {},
});

function isNoRowsError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST116" || message.includes("no rows found");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [petEmotionState, setPetEmotionState] = useState(null);
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [profileStatus, setProfileStatus] = useState("idle");
  const [cachedHasPet, setCachedHasPet] = useState(null);
  const [authServiceMessage, setAuthServiceMessage] = useState(null);

  const mountedRef = useRef(true);
  const sessionRef = useRef(null);
  const authIssueRef = useRef(getAuthFetchIssue());
  const hydrateCounterRef = useRef(0);
  const explicitSignOutRef = useRef(false);

  const setProfileAndRemember = useCallback((next) => {
    setProfile((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const uid = sessionRef.current?.user?.id;
      if (uid && value && typeof value === "object") {
        const hasPet = !!value.pet_photo_url;
        setCachedHasPet(hasPet);
        void writeCachedHasPet(uid, hasPet);
        setProfileStatus("ready");
      }
      return value;
    });
  }, []);

  const setSessionState = useCallback((nextSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const clearDerivedState = useCallback(() => {
    setProfile(null);
    setUserStats(null);
    setPetEmotionState(null);
    setProfileStatus("idle");
    setCachedHasPet(null);
    clearPetStore();
  }, []);

  const hydrateUserState = useCallback(
    async (nextUser) => {
      if (!nextUser?.id) return;
      const requestId = ++hydrateCounterRef.current;
      if (mountedRef.current) setProfileStatus("loading");
      const remembered = await readCachedHasPet(nextUser.id);
      if (mountedRef.current && requestId === hydrateCounterRef.current) setCachedHasPet(remembered);

      let hydrateFailed = false;
      try {
        let profileData = null;
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", nextUser.id)
          .single();

        if (error && !isNoRowsError(error)) {
          console.error("AUTH_PROFILE_FETCH_ERROR", error);
          hydrateFailed = true;
        }

        profileData = data || null;

        if (!profileData) {
          const { error: upsertError } = await supabase.from("profiles").upsert({
            user_id: nextUser.id,
            email: nextUser.email ?? null,
            streak_count: 0,
            xp: 0,
            garden_level: 1,
            last_checkin_date: null,
          });

          if (upsertError) {
            console.error("AUTH_PROFILE_UPSERT_ERROR", upsertError);
            hydrateFailed = true;
          } else {
            hydrateFailed = false;
            const { data: refreshedProfile, error: refreshedError } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", nextUser.id)
              .single();
            if (refreshedError && !isNoRowsError(refreshedError)) {
              console.error("AUTH_PROFILE_REFETCH_ERROR", refreshedError);
            }
            profileData = refreshedProfile || null;
          }
        }

        if (mountedRef.current && requestId === hydrateCounterRef.current) {
          setProfile(profileData);
          if (profileData) {
            const hasPet = !!profileData.pet_photo_url;
            setProfileStatus("ready");
            setCachedHasPet(hasPet);
            void writeCachedHasPet(nextUser.id, hasPet);
          } else {
            setProfileStatus("error");
          }
        }
      } catch (error) {
        console.error("AUTH_PROFILE_HYDRATE_ERROR", error);
        hydrateFailed = true;
        if (mountedRef.current && requestId === hydrateCounterRef.current) setProfileStatus("error");
      }
      if (hydrateFailed && __DEV__) {
        console.warn("AUTH_PROFILE_UNAVAILABLE", { userId: nextUser.id, remembered });
      }

      try {
        const stats = await fetchUserStats(nextUser.id);
        if (mountedRef.current && requestId === hydrateCounterRef.current) {
          setUserStats(stats ?? null);
        }
      } catch (error) {
        console.error("AUTH_STATS_FETCH_ERROR", error);
      }
    },
    []
  );

  const clearAuthServiceMessage = useCallback(() => {
    setAuthServiceMessage(null);
  }, []);

  const retryHydrate = useCallback(async () => {
    const current = sessionRef.current?.user;
    if (current) await hydrateUserState(current);
  }, [hydrateUserState]);

  const signOut = useCallback(async () => {
    explicitSignOutRef.current = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      explicitSignOutRef.current = false;
      throw error;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const unsubscribeAuthIssue = subscribeAuthFetchIssue((issue) => {
      authIssueRef.current = issue;
      if (!issue) {
        setAuthServiceMessage(null);
        return;
      }
      if (issue.type === "retryable" && RETRYABLE_AUTH_STATUSES.has(Number(issue.status))) {
        setAuthServiceMessage("Service temporarily unavailable");
      } else {
        setAuthServiceMessage(null);
      }
    });

    const bootstrapSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("AUTH_GET_SESSION_ERROR", error);
          if (RETRYABLE_AUTH_STATUSES.has(Number(error?.status))) {
            setAuthServiceMessage("Service temporarily unavailable");
          }
        }

        const currentSession = data?.session ?? null;
        setSessionState(currentSession);
        console.log("AUTH_STATE", { event: "BOOTSTRAP", userId: currentSession?.user?.id ?? null });
        diagLog("AUTH_STATE", { event: "BOOTSTRAP", userId: currentSession?.user?.id ?? null });

        if (currentSession?.user) {
          await hydrateUserState(currentSession.user);
        } else {
          clearDerivedState();
        }
      } catch (error) {
        console.error("AUTH_BOOTSTRAP_ERROR", error);
      } finally {
        if (mountedRef.current) {
          setInitializing(false);
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      console.log("AUTH_STATE", { event, userId: nextSession?.user?.id ?? null });
      if (["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
        diagLog("AUTH_STATE", { event, userId: nextSession?.user?.id ?? null });
      }
      const previousSession = sessionRef.current;
      const isRetryableRefreshFailure =
        event === "SIGNED_OUT" &&
        authIssueRef.current?.type === "retryable" &&
        RETRYABLE_AUTH_STATUSES.has(Number(authIssueRef.current?.status));

      if (isRetryableRefreshFailure && previousSession?.user && !explicitSignOutRef.current) {
        setAuthServiceMessage("Service temporarily unavailable");
        setSessionState(previousSession);
        return;
      }

      setSessionState(nextSession ?? null);

      if (event === "SIGNED_OUT") {
        explicitSignOutRef.current = false;
        clearAuthFetchIssue();
        clearDerivedState();
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        clearAuthFetchIssue();
        setAuthServiceMessage(null);
        return;
      }

      if (nextSession?.user) {
        // Never await Supabase calls inside onAuthStateChange: supabase-js holds its auth lock while
        // callbacks run, so a query issued here waits on that lock forever. It hangs on web, where
        // navigator.locks is a real lock, and leaves the app on the splash screen. Defer to the next tick.
        const nextUser = nextSession.user;
        setTimeout(() => {
          if (mountedRef.current) {
            void hydrateUserState(nextUser);
          }
        }, 0);
      } else {
        clearDerivedState();
      }
    });

    bootstrapSession();

    return () => {
      mountedRef.current = false;
      unsubscribeAuthIssue();
      authListener?.subscription?.unsubscribe();
    };
  }, [clearDerivedState, hydrateUserState, setSessionState]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        userStats,
        petEmotionState,
        session,
        initializing,
        loading: initializing,
        profileStatus,
        cachedHasPet,
        retryHydrate,
        authServiceMessage,
        setProfile: setProfileAndRemember,
        setUserStats,
        setPetEmotionState,
        clearAuthServiceMessage,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
