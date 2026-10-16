import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/auth/AuthLayout";
import TextField from "../components/common/TextField";
import Button from "../components/common/Button";
import { useTheme } from "../theme/theme";
import { fonts, type } from "../theme/tokens";

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
  const [busy, setBusy] = useState(false);
  const theme = useTheme();

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

    setBusy(true);
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
    } finally {
      setBusy(false);
    }

    // Profile row is created by a database trigger after signup.
    // The navigation will be handled by the AuthProvider
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
      />
      {err ? <Text style={[type.meta, { color: theme.alert }]} accessibilityLiveRegion="polite">{err}</Text> : null}
      <Button label="Create account" onPress={handleSignup} loading={busy} containerStyle={styles.cta} />
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
