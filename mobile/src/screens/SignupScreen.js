import React, { useRef, useState } from "react";
import { View, TextInput, Button, StyleSheet, Text } from "react-native";
import { supabase } from "../lib/supabase";
import { signupOutcome } from "../utils/authMessages";
import { confirmAsync } from "../utils/confirm";
import { describeEmailForLog, redactForLog } from "../utils/logRedact";

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
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
        confirmText: "Go to log in",
        cancelText: "Stay here",
      });
      if (goToLogin) navigation.navigate("Login");
    }
    // "signed_in": the AuthProvider takes over navigation. The profile row is created on first hydrate.
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
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
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Button title={busy ? "Creating account…" : "Create Account"} onPress={handleSignup} disabled={busy} />
              <Text onPress={() => navigation.goBack()} style={styles.link}>
                {"<- Back to login"}      </Text>
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
