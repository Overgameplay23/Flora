import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/auth/AuthLayout";
import TextField from "../components/common/TextField";
import Button from "../components/common/Button";
import { useTheme } from "../theme/theme";
import { fonts, type } from "../theme/tokens";
import { signupOutcome } from "../utils/authMessages";
import { confirmAsync } from "../utils/confirm";
import { describeEmailForLog, redactForLog } from "../utils/logRedact";

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  // good news or a next step (check your email), as opposed to an attempt that did not work
  const [notice, setNotice] = useState("");
  const [emailHasError, setEmailHasError] = useState(false);
  const [busy, setBusy] = useState(false);
  // A ref as well as state: a quick double tap fires twice before the disabled button re-renders.
  const inFlight = useRef(false);
  const theme = useTheme();

  function handleEmailChange(nextEmail) {
    setEmail(nextEmail);
    if (emailHasError) {
      setEmailHasError(false);
    }
  }

  async function handleSignup() {
    if (inFlight.current) return;

    setErr("");
    setNotice("");
    setEmailHasError(false);

    const normalizedEmail = typeof email === "string" ? email.trim() : "";
    const normalizedPassword = typeof pwd === "string" ? pwd : "";

    if (__DEV__) {
      console.log("AUTH_INPUT", {
        ...describeEmailForLog(normalizedEmail),
        passwordLen: normalizedPassword?.length,
      });
    }

    if (!normalizedEmail) {
      setEmailHasError(true);
      setErr("Please enter your email.");
      return;
    }

    if (!normalizedPassword) {
      setErr("Please enter your password.");
      return;
    }

    inFlight.current = true;
    setBusy(true);
    let result;
    try {
      result = await supabase.auth.signUp({
        email: normalizedEmail,
        password: normalizedPassword,
      });
    } catch (error) {
      result = { data: null, error };
    } finally {
      inFlight.current = false;
      setBusy(false);
    }

    // Supabase answers "success" to a repeated sign-up and sends nothing; signupOutcome tells the cases apart.
    const outcome = signupOutcome(result);
    if (result?.error) {
      console.error("AUTH_SIGNUP_ERROR", {
        status: result.error?.status,
        code: result.error?.code,
        message: redactForLog(result.error?.message),
      });
    } else if (__DEV__) {
      console.log("AUTH_SIGNUP_RESULT", { outcome: outcome.kind });
    }

    if (outcome.emailField) setEmailHasError(true);
    if (outcome.tone === "error") {
      setErr(outcome.message);
      return;
    }
    setNotice(outcome.message);

    if (outcome.kind === "already_registered") {
      const goToLogin = await confirmAsync({
        title: "You already have an account",
        message: outcome.message,
        confirmText: "Go to sign in",
        cancelText: "Stay here",
      });
      if (goToLogin) navigation.navigate("Login");
    }
    // "signed_in": the AuthProvider takes over navigation. The profile row is created on first hydrate.
  }

  return (
    <AuthLayout title="Make a home for your pet" subtitle="Your real dog or cat, painted into a garden that grows with you.">
      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onChangeText={handleEmailChange}
        value={email}
        error={emailHasError}
        editable={!busy}
      />
      <TextField
        label="Password"
        placeholder="Choose a password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onChangeText={setPwd}
        value={pwd}
        returnKeyType="go"
        onSubmitEditing={handleSignup}
        editable={!busy}
      />
      {err ? (
        <Text style={[type.meta, { color: theme.alert }]} accessibilityLiveRegion="polite">
          {err}
        </Text>
      ) : null}
      {notice ? (
        <Text style={[type.callout, { color: theme.surface.text }]} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      <Button label={busy ? "Creating account…" : "Create account"} onPress={handleSignup} loading={busy} disabled={busy} containerStyle={styles.cta} />
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="link" style={styles.link}>
        <Text style={[type.callout, { color: theme.surface.textSecondary }]}>
          Already have an account? <Text style={{ color: theme.link, fontFamily: fonts.bodyBold }}>Sign in</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: 6 },
  link: { alignSelf: "center", marginTop: 8, paddingVertical: 6 },
});
