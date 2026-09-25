import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { diagLog } from "../utils/diagLog";
import { useAuth } from "../contexts/AuthContext";
import {
  invokePetChat,
  PetChatError,
  type PetChatMessageInput,
  type PetChatMode,
} from "../services/petChat";
import { recomputePetState } from "../services/retention";
import PetAvatar from "../components/PetAvatar";
import { usePet } from "../hooks/usePet";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PendingRequest = {
  payload: PetChatMessageInput[];
  mode: PetChatMode;
};

const MAX_CONTEXT_MESSAGES = 10;

function asPetChatError(error: unknown) {
  if (error instanceof PetChatError) return error;
  const generic = new PetChatError((error as Error)?.message || "Chat request failed.");
  return generic;
}

function buildPayload(messages: ChatMessage[]): PetChatMessageInput[] {
  return messages.slice(-MAX_CONTEXT_MESSAGES).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

function makeMessageId(prefix: "u" | "a") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toMoodLabel(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function PetChatScreen() {
  const { user } = useAuth();
  const { sources: petSources, name: petName, refresh: refreshPet } = usePet();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<PetChatMode>("coach");
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [rateLimitResetAt, setRateLimitResetAt] = useState<string | null>(null);
  const [headerMood, setHeaderMood] = useState<string>("-");
  const [headerStreak, setHeaderStreak] = useState<number>(0);

  useEffect(() => {
    diagLog("CHAT_OPEN");
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadPetState = async () => {
        if (!user?.id) {
          setHeaderMood("-");
          setHeaderStreak(0);
          return;
        }
        try {
          const [state] = await Promise.all([recomputePetState(), refreshPet()]);
          if (cancelled) return;
          if (state) {
            setHeaderMood(toMoodLabel(state.mood));
            setHeaderStreak(
              Number.isFinite(Number(state.streak_days)) ? Math.max(0, Math.floor(Number(state.streak_days))) : 0
            );
          }
        } catch {
          if (cancelled) return;
        }
      };

      void loadPetState();

      return () => {
        cancelled = true;
      };
    }, [user?.id, refreshPet])
  );

  const displayName = useMemo(() => {
    const trimmed = String(petName || "").trim();
    return trimmed || "Your pet";
  }, [petName]);

  const avatarUri = useMemo(
    () => petSources.stylized || petSources.original || petSources.cutout || petSources.photo || null,
    [petSources]
  );

  const canSend = useMemo(() => {
    return !isSending && input.trim().length > 0;
  }, [input, isSending]);

  const runRequest = useCallback(async (request: PendingRequest, messageLen?: number) => {
    const startedAt = Date.now();
    setIsSending(true);
    setErrorBanner(null);
    setRateLimitResetAt(null);
    if (typeof messageLen === "number") {
      diagLog("CHAT_SEND", { messageLen, mode: request.mode });
    }

    try {
      const response = await invokePetChat(request.payload, { mode: request.mode });
      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId("a"),
          role: "assistant",
          content: response.reply,
        },
      ]);
      if (response.context?.mood) {
        setHeaderMood(toMoodLabel(response.context.mood));
      }
      if (Number.isFinite(Number(response.context?.streakDays))) {
        setHeaderStreak(Math.max(0, Math.floor(Number(response.context?.streakDays))));
      }
      setPendingRequest(null);
      diagLog("CHAT_OK", {
        durationMs: Date.now() - startedAt,
        providerUsed: response.providerUsed || null,
        mode: response.mode,
      });
    } catch (error) {
      const chatError = asPetChatError(error);
      if (chatError.code === "rate_limited" || chatError.status === 429) {
        const resetAt = chatError.resetAt || null;
        setRateLimitResetAt(resetAt);
        setErrorBanner("Daily chat limit reached. Please try again later.");
        diagLog("CHAT_RATE_LIMIT", { resetAt });
      } else {
        const requestIdNote = chatError.requestId ? ` (req ${chatError.requestId.slice(0, 8)})` : "";
        setErrorBanner(`Couldn't send message. Tap retry.${requestIdNote}`);
        diagLog("CHAT_FAIL", { status: chatError.status ?? null, requestId: chatError.requestId ?? null });
      }
    } finally {
      setIsSending(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: makeMessageId("u"),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    const payload = buildPayload(nextMessages);
    const request: PendingRequest = { payload, mode };

    setMessages(nextMessages);
    setInput("");
    setPendingRequest(request);
    await runRequest(request, text.length);
  }, [input, isSending, messages, mode, runRequest]);

  const handleRetry = useCallback(async () => {
    if (!pendingRequest || isSending) return;
    await runRequest(pendingRequest);
  }, [isSending, pendingRequest, runRequest]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubbleRow, isUser ? styles.userRow : styles.assistantRow]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.bubbleText, isUser ? styles.userText : styles.assistantText]}>{item.content}</Text>
        </View>
      </View>
    );
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 86, android: 0 })}
    >
      <View style={styles.headerWrap}>
        <View style={styles.headerTopRow}>
          <PetAvatar uri={avatarUri} size={52} label={displayName} />
          <View style={styles.headerIdentity}>
            <Text style={styles.headerTitle}>{displayName}</Text>
            <Text style={styles.headerMeta}>Mood {headerMood} - Streak {headerStreak}d</Text>
            <Text style={styles.headerModeText}>{mode === "coach" ? "Coach mode" : "Chat mode"}</Text>
          </View>
        </View>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, mode === "coach" ? styles.modeButtonActive : null]}
            onPress={() => setMode("coach")}
            disabled={isSending}
          >
            <Text style={[styles.modeButtonText, mode === "coach" ? styles.modeButtonTextActive : null]}>Coach</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === "chat" ? styles.modeButtonActive : null]}
            onPress={() => setMode("chat")}
            disabled={isSending}
          >
            <Text style={[styles.modeButtonText, mode === "chat" ? styles.modeButtonTextActive : null]}>Chat</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {mode === "coach"
              ? "Ask for a next step. Your pet coach uses your recent streak and patterns."
              : "Talk to your pet for a friendly check-in."}
          </Text>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {isSending ? (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.typingText}>Pet is typing...</Text>
        </View>
      ) : null}

      {errorBanner ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorBanner}</Text>
          {rateLimitResetAt ? (
            <Text style={styles.errorSubText}>Reset: {new Date(rateLimitResetAt).toLocaleString()}</Text>
          ) : null}
          {pendingRequest && !rateLimitResetAt ? (
            <Pressable style={styles.retryButton} onPress={handleRetry} disabled={isSending}>
              <Text style={styles.retryText}>{isSending ? "Retrying..." : "Retry"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={mode === "coach" ? "Tell your pet what happened today..." : "Talk to your pet..."}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          editable={!isSending}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendButton, canSend ? styles.sendButtonEnabled : styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Text style={styles.sendButtonText}>{isSending ? "..." : "Send"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.3)",
    backgroundColor: "#ffffff",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIdentity: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
  },
  headerMeta: {
    marginTop: 2,
    color: "#475569",
    fontSize: 12,
  },
  headerModeText: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  modeRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    backgroundColor: "#ffffff",
  },
  modeButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "rgba(37,99,235,0.1)",
  },
  modeButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: "#1d4ed8",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    flexGrow: 1,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  bubbleRow: {
    marginBottom: 8,
    flexDirection: "row",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  assistantRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  userBubble: {
    backgroundColor: "#2563eb",
  },
  assistantBubble: {
    backgroundColor: "#e2e8f0",
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  userText: {
    color: "#ffffff",
  },
  assistantText: {
    color: "#0f172a",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  typingText: {
    color: "#334155",
    fontSize: 12,
  },
  errorBanner: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
  },
  errorSubText: {
    color: "#7f1d1d",
    fontSize: 11,
    marginTop: 4,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ef4444",
  },
  retryText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.35)",
    backgroundColor: "#ffffff",
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  sendButton: {
    height: 42,
    minWidth: 60,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  sendButtonEnabled: {
    backgroundColor: "#16a34a",
  },
  sendButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});

