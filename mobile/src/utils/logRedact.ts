// Keeps personal data out of console logs (the Metro console, device logs, crash reports).
// Emails are dropped; user ids keep their first 8 characters so log lines can still be matched up.

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+(?:@|%40)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const UUID_PATTERN = /\b([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

export function shortId(id: unknown): string | null {
  if (typeof id !== "string" || !id) return null;
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

// For URLs, response snippets and other free text headed for a log line.
export function redactForLog(text: unknown): string {
  if (typeof text !== "string") return text == null ? "" : String(text);
  return text.replace(EMAIL_PATTERN, "[email]").replace(UUID_PATTERN, "$1…");
}

// What the sign-in and sign-up screens may say about the typed email: that there is one, and its length.
export function describeEmailForLog(email: unknown) {
  const value = typeof email === "string" ? email.trim() : "";
  return { emailPresent: value.length > 0, emailLength: value.length };
}
