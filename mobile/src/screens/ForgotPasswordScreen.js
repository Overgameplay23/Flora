import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/auth/AuthLayout";
import TextField from "../components/common/TextField";
import Button from "../components/common/Button";
import { useTheme } from "../theme/theme";
import { fonts, type } from "../theme/tokens";
import { notify } from "../utils/confirm";
import { isResetCodeComplete, normalizeResetCode, resetRequestOutcome, resetVerifyOutcome } from "../utils/authMessages";
import { redactForLog } from "../utils/logRedact";

/**
 * Forgot password, with a one-time code instead of a link: a link needs a deep link back into the app, which
 * Expo Go and the web preview cannot do, while a code works everywhere. Two steps: the email gets a code; the
 * code and a new password reset it. A correct code signs the person in (that is how Supabase's recovery works),
 * so the new password is set right after, and the app moves on to Home by itself.
 * The hosted project's "Reset password" email must show {{ .Token }} (docs/LAUNCH.md item 9).
 */
export default function ForgotPasswordScreen({ navigation, route }) {
  const theme = useTheme();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(typeof route?.params?.email === "string" ? route.params.email : "");
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");
  const [message, setMessage] = useState("");
  const [isNotice, setIsNotice] = useState(false);
  const [emailHasError, setEmailHasError] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const say = (text, notice = false) => {
    setMessage(text);
    setIsNotice(notice);
  };

  async function sendCode({ resend = false } = {}) {
    if (inFlight.current) return;
    const normalizedEmail = email.trim();
    setEmailHasError(false);
    if (!normalizedEmail) {
      setEmailHasError(true);
      say("Please enter your email.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
      if (error) console.error("AUTH_RESET_REQUEST_ERROR", { status: error?.status, code: error?.code, message: redactForLog(error?.message) });
      const outcome = resetRequestOutcome(error);
      if (outcome.emailField) setEmailHasError(true);
      if (outcome.kind === "sent") {
        // the code step's subtitle says it, so the screen doesn't repeat itself unless the person asked again
        say(resend ? "A new code is on its way. Only the newest one works." : "", true);
        setStep("code");
      } else {
        say(outcome.message, outcome.tone === "notice");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (inFlight.current) return;
    const token = normalizeResetCode(code);
    if (!isResetCodeComplete(token)) {
      say("Enter the code from the email.");
      return;
    }
    if (pwd.length < 6) {
      say("Choose a password with at least 6 characters.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "recovery" });
      if (verifyError) {
        console.error("AUTH_RESET_VERIFY_ERROR", { status: verifyError?.status, code: verifyError?.code, message: redactForLog(verifyError?.message) });
        say(resetVerifyOutcome(verifyError).message);
        return;
      }
      // Signed in from here on: the navigator may already be swapping this screen for Home, so the outcome of
      // the password change is told with a dialog rather than on this screen.
      const { error: updateError } = await supabase.auth.updateUser({ password: pwd });
      if (updateError) {
        console.error("AUTH_RESET_UPDATE_ERROR", { status: updateError?.status, code: updateError?.code, message: redactForLog(updateError?.message) });
        const outcome = resetVerifyOutcome(updateError);
        if (outcome.kind === "same_password") {
          notify("You're signed in", "That was already your password, so nothing changed.");
        } else {
          notify("You're signed in, but the password didn't change", `${outcome.message} You can reset it again from the sign-in screen.`);
        }
        return;
      }
      notify("Password changed", "You're signed in. Use the new password next time.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const tone = isNotice ? [type.callout, { color: theme.surface.text }] : [type.meta, { color: theme.alert }];

  if (step === "email") {
    return (
      <AuthLayout title="Forgot your password?" subtitle="We'll email you a code to set a new one.">
        <TextField
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          onChangeText={(next) => {
            setEmail(next);
            if (emailHasError) setEmailHasError(false);
          }}
          value={email}
          error={emailHasError}
          returnKeyType="send"
          onSubmitEditing={() => sendCode()}
          editable={!busy}
        />
        {message ? (
          <Text style={tone} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
        <Button label={busy ? "Sending…" : "Send me a code"} onPress={() => sendCode()} loading={busy} disabled={busy} containerStyle={styles.cta} />
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="link" style={styles.link}>
          <Text style={[type.callout, { color: theme.link, fontFamily: fonts.bodyBold }]}>Back to sign in</Text>
        </Pressable>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Check your email" subtitle={`If ${email.trim()} has an account, a code is on its way (spam folder too). Enter it and choose a new password.`}>
      <TextField
        label="Code"
        placeholder="123456"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={10}
        onChangeText={(next) => setCode(normalizeResetCode(next))}
        value={code}
        editable={!busy}
      />
      <TextField
        label="New password"
        placeholder="At least 6 characters"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onChangeText={setPwd}
        value={pwd}
        returnKeyType="go"
        onSubmitEditing={resetPassword}
        editable={!busy}
      />
      {message ? (
        <Text style={tone} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <Button label={busy ? "Saving…" : "Set new password"} onPress={resetPassword} loading={busy} disabled={busy} containerStyle={styles.cta} />
      <Pressable
        onPress={() => {
          setCode("");
          void sendCode({ resend: true });
        }}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        style={styles.link}
      >
        <Text style={[type.callout, { color: theme.surface.textSecondary }]}>
          No email? <Text style={{ color: theme.link, fontFamily: fonts.bodyBold }}>Send a new code</Text>
        </Text>
      </Pressable>
      <Pressable onPress={() => setStep("email")} disabled={busy} hitSlop={8} accessibilityRole="button" style={styles.linkTight}>
        <Text style={[type.callout, { color: theme.surface.textSecondary }]}>Use a different email</Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: 6 },
  link: { alignSelf: "center", marginTop: 8, paddingVertical: 6 },
  linkTight: { alignSelf: "center", paddingVertical: 6 },
});
