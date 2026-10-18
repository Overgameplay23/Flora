import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/auth/AuthLayout";
import TextField from "../components/common/TextField";
import Button from "../components/common/Button";
import { useTheme } from "../theme/theme";
import { fonts, type } from "../theme/tokens";
import { AUTH_TEXT, isResetCodeComplete, normalizeResetCode, resetRequestOutcome, signupConfirmOutcome } from "../utils/authMessages";
import { redactForLog } from "../utils/logRedact";

/**
 * "Check your email" after signing up, when the project asks people to confirm their address. The email carries a
 * 6-digit code (local-backend/supabase/templates/confirmation.html, to paste into Bloom's "Confirm signup") and the
 * usual link. The code is what works inside the app: the link needs a web page or a deep link to land on, and on a
 * phone it otherwise opens a dead page (the account is confirmed all the same, so "sign in" works after it too).
 * A correct code signs the person in and the app moves on to onboarding by itself.
 */
export default function ConfirmEmailScreen({ navigation, route }) {
  const theme = useTheme();
  const email = typeof route?.params?.email === "string" ? route.params.email.trim() : "";
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isNotice, setIsNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const say = (text, notice = false) => {
    setMessage(text);
    setIsNotice(notice);
  };

  async function confirm() {
    if (inFlight.current) return;
    const token = normalizeResetCode(code);
    if (!isResetCodeComplete(token)) {
      say("Enter the code from the email.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      if (error) {
        console.error("AUTH_CONFIRM_ERROR", { status: error?.status, code: error?.code, message: redactForLog(error?.message) });
        say(signupConfirmOutcome(error).message);
      }
      // success: the session arrives and the navigator swaps this screen for onboarding
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    if (inFlight.current || !email) return;
    inFlight.current = true;
    setBusy(true);
    try {
      setCode("");
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) console.error("AUTH_CONFIRM_RESEND_ERROR", { status: error?.status, code: error?.code, message: redactForLog(error?.message) });
      const outcome = resetRequestOutcome(error);
      say(outcome.kind === "sent" ? AUTH_TEXT.confirmCodeSent : outcome.message, outcome.kind === "sent");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const tone = isNotice ? [type.callout, { color: theme.surface.text }] : [type.meta, { color: theme.alert }];

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`We sent a code to ${email || "your email"} (spam folder too). Enter it to finish making your account.`}
    >
      <TextField
        label="Code"
        placeholder="123456"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={10}
        onChangeText={(next) => setCode(normalizeResetCode(next))}
        value={code}
        returnKeyType="go"
        onSubmitEditing={confirm}
        editable={!busy}
      />
      {message ? (
        <Text style={tone} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <Button label={busy ? "Checking…" : "Confirm"} onPress={confirm} loading={busy} disabled={busy} containerStyle={styles.cta} />
      <Text style={[type.meta, styles.hint, { color: theme.surface.textSecondary }]}>
        Tapped the link in the email instead? Then you're confirmed: go back and sign in.
      </Text>
      <Pressable onPress={resend} disabled={busy || !email} hitSlop={8} accessibilityRole="button" style={styles.link}>
        <Text style={[type.callout, { color: theme.surface.textSecondary }]}>
          No email? <Text style={{ color: theme.link, fontFamily: fonts.bodyBold }}>Send a new code</Text>
        </Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Login")} disabled={busy} hitSlop={8} accessibilityRole="link" style={styles.linkTight}>
        <Text style={[type.callout, { color: theme.link, fontFamily: fonts.bodyBold }]}>Back to sign in</Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: 6 },
  hint: { textAlign: "center", marginTop: 4 },
  link: { alignSelf: "center", marginTop: 8, paddingVertical: 6 },
  linkTight: { alignSelf: "center", paddingVertical: 6 },
});
