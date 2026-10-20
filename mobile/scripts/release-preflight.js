#!/usr/bin/env node
// Read-only hosted checks. The integration smoke test is separate and explicitly creates fixtures.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = require('../app.json').expo;
const { resolveBackend } = require('../app.config');
const { backend } = resolveBackend({ ...process.env, APP_ENV: 'staging' }, root);
function requireCheck(condition, label) { if (!condition) throw new Error(label); console.log(`PASS ${label}`); }
async function main() {
  requireCheck(backend.supabaseUrl === 'https://jhrsfogxxexmzauhtjif.supabase.co', 'release backend is Bloom');
  requireCheck(app.ios.bundleIdentifier === 'com.lunapet.app', 'Luna bundle identifier');
  requireCheck(app.extra?.eas?.projectId === 'dc343898-1e42-484b-9e43-a30a4d3938f4', 'Luna EAS project linked');
  const headers = { apikey: backend.supabaseAnonKey };
  const settingsResponse = await fetch(`${backend.supabaseUrl}/auth/v1/settings`, { headers, signal: AbortSignal.timeout(15000) });
  requireCheck(settingsResponse.ok, 'hosted Auth responds to the public key');
  const settings = await settingsResponse.json();
  requireCheck(settings.external?.email && !settings.disable_signup, 'email signup enabled');
  console.log(`INFO email confirmation ${settings.mailer_autoconfirm ? 'off' : 'on'}; delivery and recovery template require a real email test`);
  const functionResponse = await fetch(`${backend.supabaseUrl}/functions/v1/pet-stylize`, { headers, signal: AbortSignal.timeout(15000) });
  requireCheck(functionResponse.ok, 'painting function deployed');
  const functionBody = await functionResponse.json();
  console.log(functionBody.ready === true ? 'PASS painting secret configured (generation still needs a real-image test)' : 'ACTION set GEMINI_API_KEY in Bloom and test a painting');
  const privacy = JSON.parse(fs.readFileSync(path.join(root, 'src/legal/privacy.json'), 'utf8'));
  if (!privacy.contactEmail) console.log('ACTION choose support/privacy inbox and host the policy/support pages');
  console.log('ACTION verify Apple signing, TestFlight installation, email delivery, recovery, reminders and full device flow');
}
main().catch((error) => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
