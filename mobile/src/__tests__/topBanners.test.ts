// The app-wide banners (offline, auth trouble, the dev env warning) are drawn over every screen. On a phone with a
// notch or Dynamic Island they used to sit at a fixed top (0, 42) and slid under the status bar, where "Retry" could
// not be read or tapped (TestFlight audit, 2026-10-18). RootNavigator now stacks them in one column below the window's
// top inset and the native header (so Back stays tappable); these keep it that way.
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", "..", rel), "utf8");

describe("app-wide banners", () => {
  it("are stacked by RootNavigator below the notch", () => {
    const root = read("app/navigation/RootNavigator.js");
    expect(root).toMatch(/const BANNER_TOP = \(initialWindowMetrics\?\.insets\?\.top \?\? 0\) \+ NATIVE_HEADER_HEIGHT;/);
    expect(root).toMatch(/const NATIVE_HEADER_HEIGHT = 44;/);
    expect(root).toMatch(/<View pointerEvents="box-none" style=\{\[styles\.banners, \{ top: BANNER_TOP \}\]\}>\s*<EnvWarningBanner \/>\s*<NetworkBlockBanner \/>\s*<AuthStatusBanner/);
  });

  it("don't place themselves: no fixed top that ignores the notch", () => {
    for (const file of ["src/components/NetworkBlockBanner.tsx", "src/components/AuthStatusBanner.tsx", "src/components/EnvWarningBanner.tsx"]) {
      const source = read(file);
      expect(source).not.toMatch(/position:\s*"absolute"/);
      expect(source).not.toMatch(/\btop:\s*\d/);
    }
  });
});
