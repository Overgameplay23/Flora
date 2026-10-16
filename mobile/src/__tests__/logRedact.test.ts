import { describeEmailForLog, redactForLog, shortId } from "../utils/logRedact";

const UID = "3f2b9c1e-7a4d-4e8f-9b21-0c5d6e7f8a9b";

describe("redactForLog", () => {
  it("shortens user ids inside URLs", () => {
    const url = `https://x.supabase.co/rest/v1/pet?select=*&user_id=eq.${UID}`;
    expect(redactForLog(url)).toBe("https://x.supabase.co/rest/v1/pet?select=*&user_id=eq.3f2b9c1e…");
    expect(redactForLog(url)).not.toContain(UID);
  });

  it("drops email addresses, plain or URL-encoded", () => {
    expect(redactForLog("signup for someone.name+tag@example.co.uk failed")).toBe("signup for [email] failed");
    expect(redactForLog("/auth/v1/otp?email=a.b%40example.com")).toBe("/auth/v1/otp?email=[email]");
  });

  it("leaves other text alone and tolerates non-strings", () => {
    expect(redactForLog("https://x.supabase.co/auth/v1/token?grant_type=password")).toBe(
      "https://x.supabase.co/auth/v1/token?grant_type=password"
    );
    expect(redactForLog(undefined)).toBe("");
    expect(redactForLog(42)).toBe("42");
  });
});

describe("shortId", () => {
  it("keeps the first 8 characters", () => {
    expect(shortId(UID)).toBe("3f2b9c1e…");
    expect(shortId("abc")).toBe("abc");
    expect(shortId(null)).toBeNull();
    expect(shortId("")).toBeNull();
  });
});

describe("describeEmailForLog", () => {
  it("reports presence and length only", () => {
    const described = describeEmailForLog("  person@example.com ");
    expect(described).toEqual({ emailPresent: true, emailLength: 18 });
    expect(JSON.stringify(described)).not.toContain("@");
    expect(describeEmailForLog("")).toEqual({ emailPresent: false, emailLength: 0 });
    expect(describeEmailForLog(undefined)).toEqual({ emailPresent: false, emailLength: 0 });
  });
});
