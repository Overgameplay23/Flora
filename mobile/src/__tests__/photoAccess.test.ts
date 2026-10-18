const mockConfirm = jest.fn();
jest.mock("../utils/confirm", () => ({ confirmAsync: (...args: any[]) => mockConfirm(...args), notify: jest.fn() }));

import fs from "fs";
import path from "path";
import { Linking, Platform } from "react-native";
import { explainPhotoAccessDenied, photoAccessCopy } from "../utils/photoAccess";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", "..", rel), "utf8");

describe("photo access, after someone said no", () => {
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined as any);

  beforeEach(() => {
    mockConfirm.mockReset();
    openSettings.mockClear();
  });

  it("offers to open Settings, since iOS will not ask again", async () => {
    expect(Platform.OS).not.toBe("web");
    mockConfirm.mockResolvedValue(true);
    await explainPhotoAccessDenied("library");
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Luna can't see your photos", confirmText: "Open Settings", cancelText: "Not now" }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it("leaves Settings closed on Not now", async () => {
    mockConfirm.mockResolvedValue(false);
    await explainPhotoAccessDenied("camera");
    expect(mockConfirm.mock.calls[0][0].title).toBe("Luna can't use the camera");
    expect(openSettings).not.toHaveBeenCalled();
  });

  it("says what to turn on, in Luna's words", () => {
    expect(photoAccessCopy("camera").message).toMatch(/allow Camera access for Luna in Settings/);
    expect(photoAccessCopy("library").message).toMatch(/allow Photos access for Luna in Settings/);
  });

  it("is what onboarding and pet setup use, instead of the old dead-end alert", () => {
    for (const file of ["src/screens/onboarding/OnboardingScreen.tsx", "src/screens/PetSetupScreen.tsx"]) {
      const source = read(file);
      expect(source).toMatch(/explainPhotoAccessDenied\(/);
      expect(source).not.toMatch(/Permission needed/);
    }
  });
});
