import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/auth/AuthLayout";
import TextField from "../components/common/TextField";
import Button from "../components/common/Button";
import { useTheme } from "../theme/theme";
import { fonts, type } from "../theme/tokens";
import { signinErrorOutcome } from "../utils/authMessages";
import { describeEmailForLog, redactForLog } from "../utils/logRedact";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  // "notice" is a next step (open the confirmation link); "error" means the attempt did not work
  const [errIsNotice, setErrIsNotice] = useState(false);
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

  async function handleLogin() {
    if (inFlight.current) return;

    setErr("");
    setErrIsNotice(false);
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
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      const outcome = signinErrorOutcome(error);
      console.error("AUTH_SIGNIN_ERROR", {
        status: error?.status,
        code: error?.code,
        message: redactForLog(error?.message),
      });
      if (outcome.emailField) setEmailHasError(true);
      setErrIsNotice(outcome.tone === "notice");
      setErr(outcome.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    // The navigation will be handled by the AuthProvider
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Your pet's garden is waiting for you.">
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
        placeholder="Your password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onChangeText={setPwd}
        value={pwd}
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        editable={!busy}
      />
      {err ? (
        <Text
          style={errIsNotice ? [type.callout, { color: theme.surface.text }] : [type.meta, { color: theme.alert }]}
          accessibilityLiveRegion="polite"
        >
          {err}
        </Text>
      ) : null}
      <Button label={busy ? "Signing in…" : "Sign in"} onPress={handleLogin} loading={busy} disabled={busy} containerStyle={styles.cta} />
      <Pressable
        onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })}
        hitSlop={8}
        accessibilityRole="link"
        style={styles.linkTight}
      >
        <Text style={[type.callout, { color: theme.link, fontFamily: fonts.bodyBold }]}>Forgot your password?</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Signup")} hitSlop={8} accessibilityRole="link" style={styles.link}>
        <Text style={[type.callout, { color: theme.surface.textSecondary }]}>
          New here? <Text style={{ color: theme.link, fontFamily: fonts.bodyBold }}>Create an account</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: 6 },
  link: { alignSelf: "center", marginTop: 8, paddingVertical: 6 },
  linkTight: { alignSelf: "center", marginTop: 4, paddingVertical: 6 },
});
