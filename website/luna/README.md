# Luna support-site draft

Build with `node website/luna/build.cjs` from the repository root. Preview `dist/` with a local static server.
The site has no tracking, external fonts, sign-in or form backend. Support uses TestFlight feedback while the
public inbox is undecided. No website or mailbox has been registered and nothing is publicly hosted.

Before public hosting:

1. Create a support inbox and set `mobile/src/legal/privacy.json` → `contactEmail`.
2. Review the app's privacy wording, especially provider retention, device backups and the stated backup expiry.
3. Run `node mobile/scripts/export-privacy.js` and rebuild this site.
4. Publish `dist/` to the chosen host. Use `/` for the Support URL and `/privacy.html` for the Privacy Policy URL
   in App Store Connect. Verify both work without signing in.

The policy is shared with the app. This draft does not establish a verified legal/privacy compliance review.
