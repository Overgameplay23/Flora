import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchUserStats } from "../services/dailyLoop";
import { clearAuthFetchIssue, getAuthFetchIssue, subscribeAuthFetchIssue } from "../utils/net";
import { diagLog } from "../utils/diagLog";

const RETRYABLE_AUTH_STATUSES = new Set([502, 503, 504, 521]);

const AuthContext = createContext({
  user: null,
  profile: null,
  userStats: null,
  petEmotionState: null,
  session: null,
  initializing: true,
  loading: true,
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
  const [authServiceMessage, setAuthServiceMessage] = useState(null);

  const mountedRef = useRef(true);
  const sessionRef = useRef(null);
  const authIssueRef = useRef(getAuthFetchIssue());
  const hydrateCounterRef = useRef(0);
  const explicitSignOutRef = useRef(false);

  const setSessionState = useCallback((nextSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const clearDerivedState = useCallback(() => {
    setProfile(null);
    setUserStats(null);
    setPetEmotionState(null);
  }, []);

  const hydrateUserState = useCallback(
    async (nextUser) => {
      if (!nextUser?.id) return;
      const requestId = ++hydrateCounterRef.current;

      try {
        let profileData = null;
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", nextUser.id)
          .single();

        if (error && !isNoRowsError(error)) {
          console.error("AUTH_PROFILE_FETCH_ERROR", error);
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
          } else {
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
        }
      } catch (error) {
        console.error("AUTH_PROFILE_HYDRATE_ERROR", error);
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
        await hydrateUserState(nextSession.user);
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
        authServiceMessage,
        setProfile,
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
