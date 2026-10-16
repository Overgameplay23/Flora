import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet, Text } from "react-native";
import { supabase } from "../lib/supabase";

function getAuthErrorDetails(error) {
  const status = typeof error?.status === "number" ? error.status : undefined;
  const message = String(error?.message || "").toLowerCase();
  const nonJsonResponse = Boolean(error?.isNonJsonResponse) || message.includes("non-json error response");
  const serviceUnavailable =
    nonJsonResponse || status === 521 || status === 502 || status === 503 || status === 504;
  const missingEmailOrPhone = status === 400 && message.includes("missing email or phone");

  return { serviceUnavailable, missingEmailOrPhone };
}

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [emailHasError, setEmailHasError] = useState(false);

  function handleEmailChange(nextEmail) {
    setEmail(nextEmail);
    if (emailHasError) {
      setEmailHasError(false);
    }
  }

  async function handleSignup() {
    setErr("");
    setEmailHasError(false);

    const normalizedEmail = typeof email === "string" ? email.trim() : "";
    const normalizedPassword = typeof pwd === "string" ? pwd : "";

    console.log("AUTH_INPUT", {
      email: normalizedEmail,
      emailType: typeof normalizedEmail,
      passwordLen: normalizedPassword?.length,
    });

    if (!normalizedEmail) {
      setEmailHasError(true);
      setErr("Please enter your email.");
      return;
    }

    if (!normalizedPassword) {
      setErr("Please enter your password.");
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      const { serviceUnavailable, missingEmailOrPhone } = getAuthErrorDetails(error);
      console.error("AUTH_SIGNUP_ERROR", error);
      if (serviceUnavailable) {
        setErr("Auth service temporarily unavailable. Try again.");
      } else if (missingEmailOrPhone) {
        setEmailHasError(true);
        setErr("Please enter a valid email.");
      } else {
        setErr("Unable to create account. Please try again.");
      }
      return;
    }

    // Profile row is created by a database trigger after signup.
    // The navigation will be handled by the AuthProvider
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
      <Button title="Create Account" onPress={handleSignup} />
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
  link: { marginTop: 16, color: "#0a84ff", textAlign: "center" },
});
