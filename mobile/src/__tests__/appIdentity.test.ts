// The app's store identity (owner's decision 2026-10-17: Luna) and the App Review details that are easy to lose
// when a plugin is added or a default changes. docs/LAUNCH.md item 4.
import fs from "fs";
import path from "path";

const MOBILE = path.resolve(__dirname, "..", "..");
const app = JSON.parse(fs.readFileSync(path.join(MOBILE, "app.json"), "utf8")).expo;
const eas = JSON.parse(fs.readFileSync(path.join(MOBILE, "eas.json"), "utf8"));

const pluginOptions = (name: string) => {
  const entry = app.plugins.find((p: unknown) => (Array.isArray(p) ? p[0] : p) === name);
  return Array.isArray(entry) ? entry[1] : {};
};

describe("app identity", () => {
  it("is Luna on both stores, with one id", () => {
    expect(app.name).toBe("Luna");
    expect(app.slug).toBe("luna");
    expect(app.scheme).toBe("luna");
    expect(app.ios.bundleIdentifier).toBe(app.android.package);
    expect(app.ios.bundleIdentifier).not.toMatch(/anonymous|example|mobile$/);
  });

  it("asks only for the permissions the app uses, in its own words", () => {
    const picker = pluginOptions("expo-image-picker");
    expect(picker.photosPermission).toMatch(/Luna/);
    expect(picker.cameraPermission).toMatch(/Luna/);
    // nothing records sound: no microphone prompt, no background audio (Guideline 2.5.4)
    expect(picker.microphonePermission).toBe(false);
    const audio = pluginOptions("expo-audio");
    expect(audio.microphonePermission).toBe(false);
    expect(audio.recordAudioAndroid).toBe(false);
    expect(audio.enableBackgroundPlayback).toBe(false);
    // the session token sits in SecureStore without biometrics, so no Face ID prompt string either
    expect(pluginOptions("expo-secure-store").faceIDPermission).toBe(false);
  });

  it("answers export compliance and ships real icons", () => {
    expect(app.ios.config.usesNonExemptEncryption).toBe(false);
    for (const file of [app.icon, app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.backgroundImage, app.web.favicon]) {
      expect(fs.existsSync(path.join(MOBILE, file))).toBe(true);
    }
    // the Expo template icon (a grey grid) is about 22 KB; App Review rejects placeholder icons
    expect(fs.statSync(path.join(MOBILE, app.icon)).size).toBeGreaterThan(40_000);
  });

  it("builds store binaries against the hosted backend", () => {
    expect(eas.build.production.extends).toBe("hosted");
    expect(eas.build.hosted.env.APP_ENV).toBe("staging");
  });
});
