// What to tell the person after a sign-up or sign-in call. Pure, so it can be tested without Supabase.
//
// Supabase hides whether an address is registered: signing up again with a confirmed address returns
// success, sends no email (`user_repeated_signup` in the auth log) and hands back a user whose
// `identities` array is empty. Without this check the screen stayed silent and people kept tapping.

export type SignupOutcomeKind =
  | "check_email"
  | "signed_in"
  | "already_registered"
  | "rate_limited"
  | "service_unavailable"
  | "invalid_email"
  | "weak_password"
  | "error";

export type AuthOutcome = {
  kind: SignupOutcomeKind | "email_not_confirmed" | "wrong_details";
  // "notice" is good news or a next step; "error" means the attempt did not work.
  tone: "notice" | "error";
  message: string;
  // Highlight the email field.
  emailField?: boolean;
};

type MaybeAuthError = { status?: unknown; code?: unknown; message?: unknown; isNonJsonResponse?: unknown } | null | undefined;

export const AUTH_TEXT = {
  checkEmail:
    "Almost there! We sent a confirmation link to your email. Open it to finish signing up. If it isn't in your inbox, take a peek in your spam folder.",
  alreadyRegistered:
    "This email already has an account. Try logging in instead. If you haven't confirmed it yet, the link is in your inbox (or spam folder).",
  emailRateLimited:
    "We've just sent an email to this address. Please wait a minute or two before trying again, and check your inbox and spam folder meanwhile.",
  requestRateLimited: "That was a lot of tries in a short time. Please wait a moment, then try again.",
  serviceUnavailable: "Auth service temporarily unavailable. Try again.",
  invalidEmail: "Please enter a valid email.",
  weakPassword: "Please choose a stronger password.",
  signupFailed: "Unable to create account. Please try again.",
  emailNotConfirmed:
    "Your email isn't confirmed yet. Open the link we sent you (check your spam folder too), then log in.",
  signinFailed: "Unable to sign in. Please check your details.",
} as const;

function readError(error: MaybeAuthError) {
  const status = typeof error?.status === "number" ? error.status : undefined;
  const code = typeof error?.code === "string" ? error.code : "";
  const rawMessage = typeof error?.message === "string" ? error.message : "";
  return { status, code, rawMessage, message: rawMessage.toLowerCase() };
}

export function isServiceUnavailable(error: MaybeAuthError): boolean {
  const { status, message } = readError(error);
  const nonJsonResponse = Boolean(error?.isNonJsonResponse) || message.includes("non-json error response");
  return nonJsonResponse || status === 521 || status === 502 || status === 503 || status === 504;
}

// Shared by sign-up and sign-in; returns null when the error is not one of the common cases.
function commonErrorOutcome(error: MaybeAuthError): AuthOutcome | null {
  const { status, code, message } = readError(error);
  if (isServiceUnavailable(error)) {
    return { kind: "service_unavailable", tone: "error", message: AUTH_TEXT.serviceUnavailable };
  }
  if (code === "over_email_send_rate_limit" || message.includes("email rate limit")) {
    return { kind: "rate_limited", tone: "error", message: AUTH_TEXT.emailRateLimited };
  }
  if (status === 429 || code === "over_request_rate_limit") {
    return { kind: "rate_limited", tone: "error", message: AUTH_TEXT.requestRateLimited };
  }
  if (
    code === "email_address_invalid" ||
    code === "validation_failed" ||
    (status === 400 && message.includes("missing email or phone")) ||
    message.includes("invalid format")
  ) {
    return { kind: "invalid_email", tone: "error", message: AUTH_TEXT.invalidEmail, emailField: true };
  }
  return null;
}

export function signupOutcome(result: { data?: { user?: any; session?: any } | null; error?: MaybeAuthError }): AuthOutcome {
  const error = result?.error;
  if (error) {
    const common = commonErrorOutcome(error);
    if (common) return common;
    const { code, rawMessage, message } = readError(error);
    // Returned instead of the silent success when email confirmation is turned off.
    if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered")) {
      return { kind: "already_registered", tone: "notice", message: AUTH_TEXT.alreadyRegistered };
    }
    if (code === "weak_password") {
      return {
        kind: "weak_password",
        tone: "error",
        message: rawMessage ? `${AUTH_TEXT.weakPassword} ${rawMessage}` : AUTH_TEXT.weakPassword,
      };
    }
    return { kind: "error", tone: "error", message: AUTH_TEXT.signupFailed };
  }

  const user = result?.data?.user;
  if (result?.data?.session) {
    return { kind: "signed_in", tone: "notice", message: "" };
  }
  if (user && Array.isArray(user.identities) && user.identities.length === 0) {
    return { kind: "already_registered", tone: "notice", message: AUTH_TEXT.alreadyRegistered };
  }
  return { kind: "check_email", tone: "notice", message: AUTH_TEXT.checkEmail };
}

export function signinErrorOutcome(error: MaybeAuthError): AuthOutcome {
  const common = commonErrorOutcome(error);
  if (common) return common;
  const { code, message } = readError(error);
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return { kind: "email_not_confirmed", tone: "notice", message: AUTH_TEXT.emailNotConfirmed };
  }
  return { kind: "wrong_details", tone: "error", message: AUTH_TEXT.signinFailed };
}
