import React, { useRef, useState } from "react";
import { View, TextInput, Button, StyleSheet, Text } from "react-native";
import { supabase } from "../lib/supabase";
import { signinErrorOutcome } from "../utils/authMessages";
import { describeEmailForLog, redactForLog } from "../utils/logRedact";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [errIsNotice, setErrIsNotice] = useState(false);
  const [emailHasError, setEmailHasError] = useState(false);
  const [busy, setBusy] = useState(false);
  // A ref as well as state: a quick double tap fires twice before the disabled button re-renders.
  const inFlight = useRef(false);

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
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>
      <TextInput
        style={[styles.input, emailHasError && styles.inputError]}
        placeholder="Email"
        autoCapitalize="none"
        onChangeText={handleEmailChange}
        value={email}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPwd}
        value={pwd}
      />
      {err ? <Text style={errIsNotice ? styles.notice : styles.err}>{err}</Text> : null}
      <Button title={busy ? "Signing in…" : "Sign In"} onPress={handleLogin} disabled={busy} />
      <Text onPress={() => navigation.navigate("Signup")} style={styles.link}>
        New here? Create account
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 32, marginBottom: 20, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  inputError: {
    borderColor: "red",
  },
  err: { color: "red", marginBottom: 8 },
  notice: { color: "#2f6b4f", marginBottom: 8, lineHeight: 20 },
  link: { marginTop: 16, color: "#0a84ff", textAlign: "center" },
});
