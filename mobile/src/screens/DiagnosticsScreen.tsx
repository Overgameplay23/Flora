import React, { useCallback, useState } from "react";
import { FlatList, Pressable, SafeAreaView, Share, StyleSheet, Text, View } from "react-native";
import { notify } from "../utils/confirm";
import { useFocusEffect } from "@react-navigation/native";
import { clearDiagLogs, getDiagLogs, type DiagEntry } from "../utils/diagLog";

async function copyText(text: string) {
  try {
    const moduleName: string = "expo-clipboard";
    const module = await import(moduleName);
    if (module?.setStringAsync) {
      await module.setStringAsync(text);
      return true;
    }
  } catch (_error) {
    // fallback below
  }

  try {
    const maybeNavigator = (globalThis as any)?.navigator;
    if (maybeNavigator?.clipboard?.writeText) {
      await maybeNavigator.clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    // fallback below
  }

  try {
    await Share.share({ message: text });
    return true;
  } catch (_error) {
    return false;
  }
}

export default function DiagnosticsScreen() {
  const [logs, setLogs] = useState<DiagEntry[]>([]);

  const refresh = useCallback(() => {
    const nextLogs = getDiagLogs().slice().reverse();
    setLogs(nextLogs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleCopy = useCallback(async () => {
    const text = JSON.stringify(getDiagLogs(), null, 2);
    const ok = await copyText(text);
    if (ok) {
      notify("Copied", "Diagnostics logs copied.");
    } else {
      notify("Unavailable", "Could not copy logs on this device.");
    }
  }, []);

  const handleClear = useCallback(() => {
    clearDiagLogs();
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.button} onPress={handleCopy}>
          <Text style={styles.buttonText}>Copy logs</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleClear}>
          <Text style={styles.buttonText}>Clear</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={refresh}>
          <Text style={styles.buttonText}>Refresh</Text>
        </Pressable>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item, index) => `${item.timestamp}:${item.event}:${index}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No diagnostics logs yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.logRow}>
            <Text style={styles.event}>{item.event}</Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            <Text style={styles.payload}>{JSON.stringify(item.payload ?? {}, null, 2)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 12,
  },
  headerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "rgba(56,189,248,0.2)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.6)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  buttonText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 12,
  },
  list: {
    paddingBottom: 24,
  },
  empty: {
    color: "rgba(148,163,184,0.85)",
  },
  logRow: {
    backgroundColor: "rgba(15,23,42,0.65)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  event: {
    color: "#bae6fd",
    fontWeight: "700",
    marginBottom: 4,
  },
  timestamp: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 11,
    marginBottom: 6,
  },
  payload: {
    color: "#e2e8f0",
    fontSize: 11,
  },
});
