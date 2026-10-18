import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Reads a message aloud with VoiceOver or TalkBack. Android also honours `accessibilityLiveRegion`; iOS only speaks a
 * message that appears on screen (an error under a form, a toast) when it is announced like this.
 */
export function announce(message: string | null | undefined) {
  const text = String(message ?? "").trim();
  if (!text || Platform.OS === "web") return;
  AccessibilityInfo.announceForAccessibility(text);
}

/** Announces a message each time it changes to a new, non-empty value. */
export function useAnnounce(message: string | null | undefined) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const text = String(message ?? "").trim();
    if (text && text !== last.current) announce(text);
    last.current = text || null;
  }, [message]);
}

/**
 * How far system text sizes may grow in tight spots that sit on a painting or in a row of equal pills (the hero
 * chips, a two-week strip). Everything else scales freely with Larger Text.
 */
export const TIGHT_TEXT_SCALE = 1.3;
