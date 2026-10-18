import {
  AUTH_TEXT,
  isResetCodeComplete,
  normalizeResetCode,
  resetRequestOutcome,
  resetVerifyOutcome,
  signinErrorOutcome,
  signupConfirmOutcome,
  signupOutcome,
} from "../utils/authMessages";

const newUser = { id: "u1", identities: [{ id: "i1", provider: "email" }] };

describe("signupOutcome", () => {
  it("asks a new person to check their email (spam too) when confirmation is on", () => {
    const outcome = signupOutcome({ data: { user: newUser, session: null }, error: null });
    expect(outcome.kind).toBe("check_email");
    expect(outcome.tone).toBe("notice");
    expect(outcome.message).toBe(AUTH_TEXT.checkEmail);
    expect(outcome.message).toMatch(/spam/);
  });

  it("spots the silent repeated sign-up (empty identities) and points to log in", () => {
    const outcome = signupOutcome({ data: { user: { id: "u1", identities: [] }, session: null }, error: null });
    expect(outcome.kind).toBe("already_registered");
    expect(outcome.message).toMatch(/logging in/);
    expect(outcome.tone).toBe("notice");
    expect(outcome.emailField).toBeUndefined();
  });

  it("treats a returned session as signed in (confirmation off)", () => {
    expect(signupOutcome({ data: { user: newUser, session: { access_token: "x" } }, error: null }).kind).toBe("signed_in");
  });

  it("does not claim 'already registered' when identities are missing altogether", () => {
    expect(signupOutcome({ data: { user: { id: "u1" }, session: null }, error: null }).kind).toBe("check_email");
  });

  it("explains the email rate limit (429 over_email_send_rate_limit) in plain words", () => {
    const outcome = signupOutcome({
      data: null,
      error: { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
    });
    expect(outcome.kind).toBe("rate_limited");
    expect(outcome.message).toBe(AUTH_TEXT.emailRateLimited);
  });

  it("recognises the email rate limit by message when the code is missing", () => {
    expect(signupOutcome({ error: { status: 429, message: "Email rate limit exceeded" } }).message).toBe(
      AUTH_TEXT.emailRateLimited
    );
  });

  it("uses the general wait message for other 429s", () => {
    expect(signupOutcome({ error: { status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" } }).message).toBe(
      AUTH_TEXT.requestRateLimited
    );
  });

  it("maps user_already_exists (confirmation off) to the log-in hint", () => {
    expect(signupOutcome({ error: { status: 422, code: "user_already_exists", message: "User already registered" } }).kind).toBe(
      "already_registered"
    );
  });

  it("keeps the existing service-unavailable and invalid-email messages", () => {
    expect(signupOutcome({ error: { status: 503, message: "x" } }).message).toBe(AUTH_TEXT.serviceUnavailable);
    expect(signupOutcome({ error: { isNonJsonResponse: true, message: "x" } }).kind).toBe("service_unavailable");
    const invalid = signupOutcome({ error: { status: 400, message: "Missing email or phone" } });
    expect(invalid.message).toBe(AUTH_TEXT.invalidEmail);
    expect(invalid.emailField).toBe(true);
    expect(signupOutcome({ error: { status: 400, code: "email_address_invalid", message: "bad" } }).kind).toBe("invalid_email");
  });

  it("passes on the server's password rule for weak passwords", () => {
    const outcome = signupOutcome({ error: { status: 422, code: "weak_password", message: "Password should be at least 6 characters." } });
    expect(outcome.kind).toBe("weak_password");
    expect(outcome.message).toContain("at least 6 characters");
  });

  it("falls back to the generic message", () => {
    expect(signupOutcome({ error: { status: 500, message: "boom" } }).message).toBe(AUTH_TEXT.signupFailed);
  });
});

describe("signinErrorOutcome", () => {
  it("tells an unconfirmed person to open the link instead of 'check your details'", () => {
    const outcome = signinErrorOutcome({ status: 400, code: "email_not_confirmed", message: "Email not confirmed" });
    expect(outcome.kind).toBe("email_not_confirmed");
    expect(outcome.message).toMatch(/spam/);
  });

  it("keeps the generic message for wrong credentials", () => {
    expect(signinErrorOutcome({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" }).message).toBe(
      AUTH_TEXT.signinFailed
    );
  });

  it("shares the rate-limit and service messages", () => {
    expect(signinErrorOutcome({ status: 429, message: "Too many requests" }).kind).toBe("rate_limited");
    expect(signinErrorOutcome({ status: 502, message: "x" }).kind).toBe("service_unavailable");
  });
});

describe("password reset", () => {
  it("never says whether an email has an account", () => {
    expect(resetRequestOutcome(null)).toMatchObject({ kind: "sent", tone: "notice", message: AUTH_TEXT.resetCodeSent });
    // an unknown address and a known one read the same
    expect(resetRequestOutcome({ status: 400, code: "user_not_found", message: "User not found" }).kind).toBe("sent");
  });

  it("still reports the problems the person can do something about", () => {
    expect(resetRequestOutcome({ status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" }).message).toBe(AUTH_TEXT.emailRateLimited);
    expect(resetRequestOutcome({ status: 400, code: "email_address_invalid", message: "invalid" })).toMatchObject({ kind: "invalid_email", emailField: true });
    expect(resetRequestOutcome({ status: 503, message: "down" }).kind).toBe("service_unavailable");
  });

  it("keeps codes to digits and knows when one is complete", () => {
    expect(normalizeResetCode(" 724 779 ")).toBe("724779");
    expect(normalizeResetCode("72-47-79")).toBe("724779");
    expect(normalizeResetCode("12345678901234")).toBe("1234567890");
    expect(normalizeResetCode(undefined)).toBe("");
    expect(isResetCodeComplete("12345")).toBe(false);
    expect(isResetCodeComplete("123456")).toBe(true);
    expect(isResetCodeComplete("1234567890")).toBe(true);
  });

  it("explains a wrong or old code, a reused password and a weak one", () => {
    expect(resetVerifyOutcome({ status: 403, code: "otp_expired", message: "Token has expired or is invalid" }).kind).toBe("code_invalid");
    expect(resetVerifyOutcome({ status: 422, code: "same_password", message: "New password should be different from the old password." }).kind).toBe("same_password");
    const weak = resetVerifyOutcome({ status: 422, code: "weak_password", message: "Password should be at least 8 characters." });
    expect(weak.kind).toBe("weak_password");
    expect(weak.message).toMatch(/at least 8/);
    expect(resetVerifyOutcome({ status: 500, message: "boom" }).message).toBe(AUTH_TEXT.resetFailed);
  });
});

describe("sign-up confirmation by code", () => {
  it("explains a wrong or old code and the usual network trouble", () => {
    expect(signupConfirmOutcome({ status: 403, code: "otp_expired", message: "Token has expired or is invalid" }).kind).toBe("code_invalid");
    expect(signupConfirmOutcome({ status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" }).message).toBe(AUTH_TEXT.emailRateLimited);
    expect(signupConfirmOutcome({ status: 503, message: "down" }).kind).toBe("service_unavailable");
    expect(signupConfirmOutcome({ status: 500, message: "boom" }).message).toBe(AUTH_TEXT.confirmFailed);
  });

  it("points people at the code, the link and the spam folder", () => {
    expect(AUTH_TEXT.checkEmail).toMatch(/code/);
    expect(AUTH_TEXT.emailNotConfirmed).toMatch(/code/);
    expect(AUTH_TEXT.emailNotConfirmed).toMatch(/link/);
    expect(AUTH_TEXT.emailNotConfirmed).toMatch(/spam/);
  });
});
