import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { getRawPublicEnv, getValidatedPublicEnv } from "../utils/env";
import { netFetch } from "../utils/net";
import { useAuth } from "../contexts/AuthContext";

type TestStatus = "idle" | "running" | "success" | "error";

type TestResult = {
  status: TestStatus;
  url?: string;
  message?: string;
  detail?: string;
};

const supabaseUrlRaw = getRawPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
const supabaseUrl = getValidatedPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = getValidatedPublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
const apiUrlRaw = getRawPublicEnv("EXPO_PUBLIC_API_URL");
const apiUrlDisplay = apiUrlRaw || "(not set)";

function buildSupabaseUrl(path: string) {
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function statusLabel(status: TestStatus) {
  if (status === "running") return "Running";
  if (status === "success") return "Success";
  if (status === "error") return "Failed";
  return "Idle";
}

function formatErrorDetail(error: any) {
  if (!error) return "";
  const details = [];
  if (error?.message) details.push(`message: ${error.message}`);
  if (error?.cause?.message) details.push(`cause: ${error.cause.message}`);
  if (error?.nativeStackAndroid) details.push(`nativeStackAndroid: ${error.nativeStackAndroid}`);
  if (error?.nativeStackIOS) details.push(`nativeStackIOS: ${error.nativeStackIOS}`);
  if (error?.stack) details.push(`stack: ${error.stack}`);
  return details.join("\n");
}

export default function NetworkDebugScreen() {
  const { signOut } = useAuth();
  const [restResult, setRestResult] = useState<TestResult>({ status: "idle" });
  const [authResult, setAuthResult] = useState<TestResult>({ status: "idle" });
  const [edgeResult, setEdgeResult] = useState<TestResult>({ status: "idle" });
  const [openUrlResult, setOpenUrlResult] = useState<TestResult>({ status: "idle" });
  const [refreshResult, setRefreshResult] = useState<TestResult>({ status: "idle" });
  const [resetResult, setResetResult] = useState<TestResult>({ status: "idle" });

  const runRestTest = async () => {
    const url = buildSupabaseUrl("rest/v1/");
    setRestResult({ status: "running", url: url || "(not configured)" });
    if (!url) {
      setRestResult({
        status: "error",
        url: "(not configured)",
        message: "SUPABASE URL not configured",
      });
      return;
    }
    try {
      const resp = await netFetch(url, {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey || "",
          Authorization: `Bearer ${supabaseAnonKey || ""}`,
        },
      });
      const detail = await resp.text();
      setRestResult({
        status: resp.ok ? "success" : "error",
        url,
        message: `HTTP ${resp.status}`,
        detail: detail ? detail.slice(0, 200) : "",
      });
    } catch (error: any) {
      setRestResult({
        status: "error",
        url,
        message: error?.message || "Request failed",
        detail: error?.errorCode || formatErrorDetail(error),
      });
    }
  };

  const runAuthTest = async () => {
    const url = "supabase.auth.getSession()";
    setAuthResult({ status: "running", url });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setAuthResult({
        status: "success",
        url,
        message: data?.session ? "Session found" : "No session",
      });
    } catch (error: any) {
      setAuthResult({
        status: "error",
        url,
        message: error?.message || "Auth check failed",
        detail: formatErrorDetail(error),
      });
    }
  };

  const runEdgeTest = async () => {
    const url = buildSupabaseUrl("functions/v1/pet-stylize");
    setEdgeResult({ status: "running", url: url || "(not configured)" });
    if (!url) {
      setEdgeResult({
        status: "error",
        url: "(not configured)",
        message: "SUPABASE URL not configured",
      });
      return;
    }
    try {
      const resp = await netFetch(url, {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey || "",
          Authorization: `Bearer ${supabaseAnonKey || ""}`,
        },
      });
      const detail = await resp.text();
      setEdgeResult({
        status: resp.ok ? "success" : "error",
        url,
        message: `HTTP ${resp.status}`,
        detail: detail ? detail.slice(0, 200) : "",
      });
    } catch (error: any) {
      setEdgeResult({
        status: "error",
        url,
        message: error?.message || "Request failed",
        detail: error?.errorCode || formatErrorDetail(error),
      });
    }
  };

  const handleOpenSupabaseUrl = async () => {
    const url = supabaseUrl || "";
    setOpenUrlResult({ status: "running", url: url || "(not configured)" });
    if (!url) {
      setOpenUrlResult({
        status: "error",
        url: "(not configured)",
        message: "SUPABASE URL not configured",
      });
      return;
    }
    try {
      await Linking.openURL(url);
      setOpenUrlResult({ status: "success", url, message: "Opened in browser" });
    } catch (error: any) {
      setOpenUrlResult({
        status: "error",
        url,
        message: error?.message || "Failed to open URL",
        detail: formatErrorDetail(error),
      });
    }
  };

  const runRefreshTest = async () => {
    const url = buildSupabaseUrl("auth/v1/token?grant_type=refresh_token");
    setRefreshResult({ status: "running", url: url || "(not configured)" });
    if (!url) {
      setRefreshResult({
        status: "error",
        url: "(not configured)",
        message: "SUPABASE URL not configured",
      });
      return;
    }
    try {
      const resp = await netFetch(url, {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey || "",
          Authorization: `Bearer ${supabaseAnonKey || ""}`,
        },
      });
      const detail = await resp.text();
      setRefreshResult({
        status: resp.ok ? "success" : "error",
        url,
        message: `HTTP ${resp.status}`,
        detail: detail ? detail.slice(0, 200) : "",
      });
    } catch (error: any) {
      setRefreshResult({
        status: "error",
        url,
        message: error?.message || "Request failed",
        detail: error?.errorCode || formatErrorDetail(error),
      });
    }
  };

  const runResetAuth = async () => {
    setResetResult({ status: "running", url: "supabase.auth.signOut()" });
    try {
      await signOut();
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter((key) => /supabase|sb-/i.test(key));
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
      setResetResult({
        status: "success",
        url: "supabase.auth.signOut()",
        message: `Cleared ${keysToRemove.length} AsyncStorage keys. Restart the app.`,
      });
    } catch (error: any) {
      setResetResult({
        status: "error",
        url: "supabase.auth.signOut()",
        message: error?.message || "Failed to reset auth",
        detail: formatErrorDetail(error),
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Network Debug</Text>

      <View style={styles.section}>
        <Text style={styles.label}>EXPO_PUBLIC_SUPABASE_URL</Text>
        <Text style={styles.value}>{supabaseUrlRaw || "(not set)"}</Text>
        <Text style={styles.label}>EXPO_PUBLIC_SUPABASE_ANON_KEY set</Text>
        <Text style={styles.value}>{String(!!supabaseAnonKey)}</Text>
        <Text style={styles.label}>EXPO_PUBLIC_API_URL</Text>
        <Text style={styles.value}>{apiUrlDisplay}</Text>
      </View>

      <View style={styles.section}>
        <Pressable style={styles.button} onPress={handleOpenSupabaseUrl}>
          <Text style={styles.buttonText}>Open Supabase URL in browser</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={runRestTest}>
          <Text style={styles.buttonText}>Test Supabase REST</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={runAuthTest}>
          <Text style={styles.buttonText}>Test Supabase Auth</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={runRefreshTest}>
          <Text style={styles.buttonText}>Test Auth Refresh Endpoint</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={runEdgeTest}>
          <Text style={styles.buttonText}>Test Edge Function Ping</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={runResetAuth}>
          <Text style={styles.dangerButtonText}>Reset Auth (dev only)</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.resultTitle}>OPEN URL</Text>
        <Text style={styles.resultStatus}>{statusLabel(openUrlResult.status)}</Text>
        {openUrlResult.url ? <Text style={styles.resultUrl}>{openUrlResult.url}</Text> : null}
        {openUrlResult.message ? <Text style={styles.resultMessage}>{openUrlResult.message}</Text> : null}
        {openUrlResult.detail ? <Text style={styles.resultDetail}>{openUrlResult.detail}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.resultTitle}>REST</Text>
        <Text style={styles.resultStatus}>{statusLabel(restResult.status)}</Text>
        {restResult.url ? <Text style={styles.resultUrl}>{restResult.url}</Text> : null}
        {restResult.message ? <Text style={styles.resultMessage}>{restResult.message}</Text> : null}
        {restResult.detail ? <Text style={styles.resultDetail}>{restResult.detail}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.resultTitle}>AUTH</Text>
        <Text style={styles.resultStatus}>{statusLabel(authResult.status)}</Text>
        {authResult.url ? <Text style={styles.resultUrl}>{authResult.url}</Text> : null}
        {authResult.message ? <Text style={styles.resultMessage}>{authResult.message}</Text> : null}
        {authResult.detail ? <Text style={styles.resultDetail}>{authResult.detail}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.resultTitle}>REFRESH</Text>
        <Text style={styles.resultStatus}>{statusLabel(refreshResult.status)}</Text>
        {refreshResult.url ? <Text style={styles.resultUrl}>{refreshResult.url}</Text> : null}
        {refreshResult.message ? <Text style={styles.resultMessage}>{refreshResult.message}</Text> : null}
        {refreshResult.detail ? <Text style={styles.resultDetail}>{refreshResult.detail}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.resultTitle}>EDGE</Text>
        <Text style={styles.resultStatus}>{statusLabel(edgeResult.status)}</Text>
        {edgeResult.url ? <Text style={styles.resultUrl}>{edgeResult.url}</Text> : null}
        {edgeResult.message ? <Text style={styles.resultMessage}>{edgeResult.message}</Text> : null}
        {edgeResult.detail ? <Text style={styles.resultDetail}>{edgeResult.detail}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.resultTitle}>RESET AUTH</Text>
        <Text style={styles.resultStatus}>{statusLabel(resetResult.status)}</Text>
        {resetResult.url ? <Text style={styles.resultUrl}>{resetResult.url}</Text> : null}
        {resetResult.message ? <Text style={styles.resultMessage}>{resetResult.message}</Text> : null}
        {resetResult.detail ? <Text style={styles.resultDetail}>{resetResult.detail}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: "#0f172a",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#e2e8f0",
    marginBottom: 12,
  },
  section: {
    backgroundColor: "rgba(15,23,42,0.7)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    color: "rgba(148,163,184,0.85)",
    marginTop: 6,
  },
  value: {
    fontSize: 13,
    color: "#e2e8f0",
    marginTop: 4,
  },
  button: {
    backgroundColor: "#38bdf8",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  dangerButton: {
    backgroundColor: "#f87171",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 4,
  },
  buttonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  dangerButtonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 6,
  },
  resultStatus: {
    fontSize: 12,
    color: "rgba(148,163,184,0.95)",
    marginBottom: 6,
  },
  resultUrl: {
    fontSize: 12,
    color: "#bae6fd",
    marginBottom: 4,
  },
  resultMessage: {
    fontSize: 12,
    color: "#e2e8f0",
    marginBottom: 4,
  },
  resultDetail: {
    fontSize: 11,
    color: "rgba(148,163,184,0.85)",
  },
});
