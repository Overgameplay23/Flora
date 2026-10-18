// The privacy policy has one source (src/legal/privacy.json): the app shows it on the Privacy screen and
// scripts/export-privacy.js turns it into the hostable page. These guard the page against drifting from the app,
// and the policy against promising something the code no longer keeps.
import fs from "fs";
import policy from "../legal/privacy.json";

const { renderPrivacyHtml, TARGET } = require("../../scripts/export-privacy.js");

describe("privacy policy", () => {
  it("has a date and no empty section", () => {
    expect(policy.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const section of policy.sections) {
      const lines = [...((section as any).paragraphs ?? []), ...((section as any).bullets ?? [])];
      expect(lines.length).toBeGreaterThan(0);
    }
  });

  it("matches the exported page (run `node scripts/export-privacy.js` after editing the JSON)", () => {
    // line endings may be CRLF after a Windows checkout
    expect(fs.readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n")).toBe(renderPrivacyHtml(policy));
  });

  it("escapes what it prints", () => {
    const html = renderPrivacyHtml({ ...policy, intro: "<b>& more</b>", sections: [] });
    expect(html).toContain("&lt;b&gt;&amp; more&lt;/b&gt;");
  });

  it("keeps the promises the app makes elsewhere", () => {
    const text = JSON.stringify(policy).toLowerCase();
    expect(text).toContain("cycle tracking stays on your phone");
    // honest about the phone's own backups, and about the paid Gemini API the owner must use (docs/LAUNCH.md)
    expect(text).toContain("icloud or google");
    expect(text).toContain("paid api");
    expect(text).toContain("delete account");
    expect(text).not.toMatch(/fertility predictions? (are|is) available/);
  });
});

describe("help & support", () => {
  const support = require("../legal/support.json");
  const { renderSupportHtml, SUPPORT_TARGET } = require("../../scripts/export-privacy.js");
  const source = (rel: string) => fs.readFileSync(require("path").join(__dirname, "..", "..", rel), "utf8");

  it("matches the exported page, with the policy's contact email", () => {
    expect(fs.readFileSync(SUPPORT_TARGET, "utf8").replace(/\r\n/g, "\n")).toBe(renderSupportHtml(support, policy.contactEmail));
  });

  it("answers every question it asks", () => {
    expect(support.questions.length).toBeGreaterThanOrEqual(6);
    for (const item of support.questions) {
      expect(item.q.trim().length).toBeGreaterThan(5);
      expect(item.a.trim().length).toBeGreaterThan(30);
    }
  });

  it("names buttons that exist in the app", () => {
    const text = JSON.stringify(support);
    expect(text).toContain("Forgot your password?");
    expect(source("src/screens/LoginScreen.js")).toContain("Forgot your password?");
    expect(text).toContain("Delete account");
    expect(source("app/screens/ProfileScreen.js")).toContain('label="Delete account"');
    expect(text).toContain("Change pet photo");
    expect(source("app/screens/ProfileScreen.js")).toContain('label="Change pet photo"');
    expect(text).not.toMatch(/Floura/);
  });
});
