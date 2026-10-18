// The App Store privacy label (src/legal/appPrivacy.json, exported to docs/store/app-privacy.md) has to match what
// the app really keeps: Apple rejects, and people lose trust, when a label leaves something out. These read the code
// for every table, database function, server function and storage bucket it touches, and fail when one is missing
// from the label, when the label declares something nothing holds, or when an SDK that collects data is added.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const mockRpc = jest.fn(async (..._args: any[]) => ({ error: null }));
jest.mock("../lib/supabase", () => ({ supabase: { rpc: (...args: any[]) => mockRpc(...args) } }));

import fs from "fs";
import path from "path";
import label from "../legal/appPrivacy.json";
import policy from "../legal/privacy.json";
import { logCheckinSubmitted } from "../services/retention";

const { renderAppPrivacyMarkdown, LABEL_TARGET } = require("../../scripts/export-privacy.js");

const ROOT = path.join(__dirname, "..", "..");

// Apple's App Privacy vocabulary (App Store Connect > App Privacy)
const APPLE_TYPES: Record<string, string[]> = {
  "Contact Info": ["Name", "Email Address", "Phone Number", "Physical Address", "Other User Contact Info"],
  "Health & Fitness": ["Health", "Fitness"],
  "Financial Info": ["Payment Info", "Credit Info", "Other Financial Info"],
  Location: ["Precise Location", "Coarse Location"],
  "Sensitive Info": ["Sensitive Info"],
  Contacts: ["Contacts"],
  "User Content": ["Emails or Text Messages", "Photos or Videos", "Audio Data", "Gameplay Content", "Customer Support", "Other User Content"],
  "Browsing History": ["Browsing History"],
  "Search History": ["Search History"],
  Identifiers: ["User ID", "Device ID"],
  Purchases: ["Purchase History"],
  "Usage Data": ["Product Interaction", "Advertising Data", "Other Usage Data"],
  Diagnostics: ["Crash Data", "Performance Data", "Other Diagnostic Data"],
  Surroundings: ["Environment Scanning"],
  Body: ["Hands", "Head"],
  "Other Data": ["Other Data Types"],
};
const APPLE_PURPOSES = ["Third-Party Advertising", "Developer's Advertising or Marketing", "Analytics", "Product Personalization", "App Functionality", "Other Purposes"];

/** The app's own code: what ships, without tests and the dev-only design previews. */
function appSources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || full === path.join(ROOT, "src", "screens", "dev")) continue;
        walk(full);
      } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        out.push({ file: path.relative(ROOT, full), text: fs.readFileSync(full, "utf8") });
      }
    }
  };
  walk(path.join(ROOT, "src"));
  walk(path.join(ROOT, "app"));
  out.push({ file: "App.js", text: fs.readFileSync(path.join(ROOT, "App.js"), "utf8") });
  return out;
}

function backendSurfaces() {
  const tables = new Set<string>();
  const buckets = new Set<string>();
  const rpcs = new Set<string>();
  const functions = new Set<string>();
  const sources = appSources();
  const functionNames = fs
    .readdirSync(path.join(ROOT, "supabase", "functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name);
  for (const { text } of sources) {
    for (const match of text.matchAll(/\.from\(\s*(["'])([a-z_]+)\1/g)) {
      // supabase.storage.from("pets") is a bucket, supabase.from("pets") a table
      const before = text.slice(Math.max(0, (match.index ?? 0) - 40), match.index);
      (/storage\s*$/.test(before) ? buckets : tables).add(match[2]);
    }
    // storage.from(PET_PHOTO_BUCKET): the bucket is named where the constant is defined
    for (const match of text.matchAll(/[A-Z_]*BUCKET\s*=\s*(["'])([a-z0-9_-]+)\1/g)) buckets.add(match[2]);
    for (const match of text.matchAll(/\.rpc\(\s*(["'])([a-z_]+)\1/g)) rpcs.add(match[2]);
    for (const name of functionNames) {
      if (new RegExp(`["'\`/]${name}["'\`]`).test(text)) functions.add(name);
    }
  }
  return { tables, buckets, rpcs, functions };
}

const sorted = (values: Iterable<string>) => [...values].sort();
const declaredTypes = new Set(label.collected.map((item) => item.type));

describe("App Store privacy label", () => {
  it("speaks Apple's vocabulary: real categories, types and purposes, and no tracking", () => {
    expect(label.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(label.collectsData).toBe(true);
    expect(label.tracking).toBe(false);
    for (const item of label.collected) {
      expect(APPLE_TYPES[item.category]).toContain(item.type);
      expect(item.purposes.length).toBeGreaterThan(0);
      for (const purpose of item.purposes) expect(APPLE_PURPOSES).toContain(purpose);
      expect(item.tracking).toBe(false);
      expect(typeof item.linked).toBe("boolean");
      expect(item.what.length).toBeGreaterThan(30);
    }
    // nothing is used for advertising of any kind
    const purposes = label.collected.flatMap((item) => item.purposes);
    expect(purposes).not.toContain("Third-Party Advertising");
    expect(purposes).not.toContain("Developer's Advertising or Marketing");
  });

  it("lists every table, database function, server function and bucket the app touches, and nothing it does not", () => {
    const found = backendSurfaces();
    // a failure here means the app started (or stopped) keeping something: say what it holds in appPrivacy.json
    expect(sorted(found.tables)).toEqual(sorted(Object.keys(label.sources.tables)));
    expect(sorted(found.rpcs)).toEqual(sorted(Object.keys(label.sources.rpcs)));
    expect(sorted(found.functions)).toEqual(sorted(Object.keys(label.sources.functions)));
    expect(sorted(found.buckets)).toEqual(sorted(Object.keys(label.sources.buckets)));
  });

  it("declares every kind of data those places hold, and nothing they don't", () => {
    const held = new Set<string>(label.sources.auth.types);
    for (const group of [label.sources.tables, label.sources.rpcs, label.sources.functions, label.sources.buckets]) {
      for (const entry of Object.values(group) as { types: string[]; note: string }[]) {
        expect(entry.note.length).toBeGreaterThan(5);
        entry.types.forEach((type) => held.add(type));
      }
    }
    expect(sorted(held)).toEqual(sorted(declaredTypes));
  });

  it("is ticked for no type it also explains away", () => {
    const notCollected = label.notCollected.flatMap((item) => item.type.split(/,\s*/));
    for (const type of notCollected) {
      expect(Object.values(APPLE_TYPES).flat()).toContain(type);
      expect(declaredTypes.has(type)).toBe(false);
    }
    // between the two lists, every type Apple asks about is answered
    expect(sorted(new Set([...notCollected, ...declaredTypes]))).toEqual(sorted(Object.values(APPLE_TYPES).flat()));
  });

  it("would change if an SDK that tracks, advertises, measures or reports crashes were added", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies });
    const collecting =
      /firebase|sentry|bugsnag|crashlytics|datadog|amplitude|mixpanel|segment|posthog|appsflyer|adjust|branch|fbsdk|facebook|onesignal|google-mobile-ads|admob|tracking-transparency|expo-insights|revenuecat|purchases/i;
    // adding one is fine: update appPrivacy.json (its "updateWhen" says how), then this list
    expect(deps.filter((name) => collecting.test(name))).toEqual([]);
  });

  it("talks to no host but its own backend when it starts in a release build", () => {
    const hosts = new Set<string>();
    for (const { text } of appSources()) {
      for (const match of text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) hosts.add(match[1]);
    }
    // the placeholder for a missing config, and the dev-only "is the internet up" probe
    expect(sorted(hosts)).toEqual(["invalid.supabase.co", "www.google.com"]);
    const net = fs.readFileSync(path.join(ROOT, "src", "utils", "net.ts"), "utf8");
    expect(net).toMatch(/__DEV__ \? \["https:\/\/www\.google\.com\/generate_204"\] : \[\]/);
  });

  it("keeps the check-in's words in the check-in: the event log only says a note was written", async () => {
    mockRpc.mockClear();
    await logCheckinSubmitted({ mood: 4, winText: "Walked to the park with my sister" });
    const payload: any = mockRpc.mock.calls[0][1];
    expect(payload.p_event_type).toBe("checkin_submitted");
    expect(payload.p_meta).toEqual({ mood: 4, wrote_note: true });
    expect(JSON.stringify(payload)).not.toContain("park");
    await logCheckinSubmitted({ mood: 2, winText: "  " });
    expect(mockRpc.mock.calls[1][1].p_meta).toEqual({ mood: 2, wrote_note: false });
  });

  it("agrees with the privacy policy", () => {
    const text = JSON.stringify(policy).toLowerCase();
    expect(text).toContain("cycle tracking stays on your phone");
    expect(text).toContain("photos you choose");
    expect(text).toContain("check-ins");
    expect(text).toContain("journal entries");
    expect(text).toContain("never the words you write");
    // Analytics is a declared purpose, so the policy says the events are counted across everyone
    expect(text).toContain("add them up across everyone");
    expect(text).toContain("don't sell your data, show ads, or track you");
    expect(JSON.stringify(label.notCollected)).toContain("Sensitive Info");
  });

  it("matches the exported answer sheet (run `node scripts/export-privacy.js` after editing the JSON)", () => {
    expect(fs.readFileSync(LABEL_TARGET, "utf8").replace(/\r\n/g, "\n")).toBe(renderAppPrivacyMarkdown(label));
  });
});
