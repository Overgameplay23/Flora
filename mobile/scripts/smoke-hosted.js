#!/usr/bin/env node
// Explicit, disposable hosted test. Uses the logged-in Supabase CLI; secrets stay in memory.
// Only touches accounts created by this invocation; never uses an existing user's credentials/data.
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { resolveBackend } = require('../app.config');
const REF = 'jhrsfogxxexmzauhtjif';
if (!process.argv.includes('--create-disposable-users')) {
  console.error('Run with --create-disposable-users to create two temporary Bloom accounts and delete them after testing.');
  process.exit(2);
}
const { backend } = resolveBackend({ ...process.env, APP_ENV: 'staging' });
if (new URL(backend.supabaseUrl).hostname !== `${REF}.supabase.co`) throw new Error('Refusing an unexpected project.');
const keyResult = JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase', ['projects', 'api-keys', '--project-ref', REF, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const keys = Array.isArray(keyResult) ? keyResult : keyResult.api_keys;
const serviceKey = keys?.find((key) => key.name === 'service_role')?.api_key;
if (!serviceKey) throw new Error('No service key available through the authenticated CLI.');
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) } };
const admin = createClient(backend.supabaseUrl, serviceKey, options);
const fixtures = [];
let assertions = 0;
function assert(condition, label) { if (!condition) throw new Error(label); assertions++; console.log(`PASS ${label}`); }
async function must(label, operation) { const result = await operation; if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || ''} ${result.error.message}`); return result.data; }
async function fixture() {
  const email = `luna-launch-${randomUUID()}@example.com`;
  const password = `Luna!${randomBytes(24).toString('hex')}`;
  const { user } = await must('create disposable fixture', admin.auth.admin.createUser({ email, password, email_confirm: true }));
  const client = createClient(backend.supabaseUrl, backend.supabaseAnonKey, options);
  const item = { id: user.id, client, paths: [], deleted: false };
  fixtures.push(item);
  await must('sign in', client.auth.signInWithPassword({ email, password }));
  await must('profile', client.from('profiles').upsert({ user_id: user.id, email }));
  return item;
}
async function main() {
  try {
    const a = await fixture(); const b = await fixture();
    assert(!!a.id && !!b.id, 'two users sign in using the release publishable key');
    const today = new Date().toISOString().slice(0, 10);
    await must('pet', a.client.from('pet').upsert({ user_id: a.id, pet_name: 'Launch probe', species: 'dog', photo_url: 'look://chosen' }));
    await must('check-in', a.client.from('checkins').insert({ user_id: a.id, checkin_date: today, date: today, mood_score: 3 }));
    const journalRow = { id: randomUUID(), user_id: a.id, entry_date: today, entry_text: 'Disposable launch probe' };
    await must('journal', a.client.from('journal_entries').upsert(journalRow, { onConflict: 'id' }));
    await must('journal retry', a.client.from('journal_entries').upsert(journalRow, { onConflict: 'id' }));
    assert((await must('journal retry read', a.client.from('journal_entries').select('id').eq('id', journalRow.id))).length === 1, 'journal outbox replay is idempotent');
    const foreignJournal = await b.client.from('journal_entries').upsert({ ...journalRow, entry_text: 'forbidden' }, { onConflict: 'id' });
    assert(!!foreignJournal.error, 'other user cannot overwrite a journal entry');
    const tasks = await must('seeded tasks', a.client.from('tasks').select('id').eq('user_id', a.id));
    assert(tasks.length >= 3, 'new profile receives default tasks');
    await must('task completion', a.client.rpc('complete_task', { task_id: String(tasks[0].id), completed_at: new Date().toISOString(), local_date: today }));
    await must('task completion retry', a.client.rpc('complete_task', { task_id: String(tasks[0].id), completed_at: new Date().toISOString(), local_date: today }));
    const points = await must('balance', a.client.rpc('get_garden_points'));
    assert(points.earnedPoints === 2, 'task retry does not double-award Sprouts');
    await must('rollup', a.client.rpc('log_event_and_rollup', { p_event_type: 'checkin_submitted', p_occurred_at: new Date().toISOString(), p_meta: {}, p_local_day: today }));
    await must('pet state', a.client.rpc('recompute_pet_state', { p_today: today }));
    assert((await must('catalog', a.client.from('plant_catalog').select('id'))).length === 10, 'plant catalog available through REST');
    for (const table of ['profiles', 'pet', 'checkins', 'journal_entries', 'task_completions']) {
      assert((await must(`owner read ${table}`, a.client.from(table).select('user_id').eq('user_id', a.id))).length > 0, `owner can read ${table}`);
      assert((await must(`cross-user read ${table}`, b.client.from(table).select('user_id').eq('user_id', a.id))).length === 0, `other user cannot read ${table}`);
    }
    const forge = await a.client.from('task_completions').insert({ user_id: a.id, task_id: tasks[0].id, completion_date: today, completed_date: today, points: 9999 });
    assert(!!forge.error, 'direct point forging denied');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=', 'base64');
    const objectPath = `${a.id}/launch-probe.png`;
    a.paths.push(objectPath);
    await must('upload', a.client.storage.from('pets').upload(objectPath, png, { contentType: 'image/png' }));
    const signed = await must('sign own photo', a.client.storage.from('pets').createSignedUrl(objectPath, 60));
    assert((await fetch(signed.signedUrl)).ok, 'owner signed photo downloads');
    const foreignSign = await b.client.storage.from('pets').createSignedUrl(objectPath, 60);
    assert(!!foreignSign.error, 'other user cannot sign private photo');
    assert(!(await fetch(`${backend.supabaseUrl}/storage/v1/object/public/pets/${objectPath}`)).ok, 'photo is not publicly downloadable');
    await must('refresh session', a.client.auth.refreshSession());
    assert(!!(await must('refreshed identity', a.client.auth.getUser())).user, 'session refresh works');
    const { data: sessionData } = await a.client.auth.getSession();
    const health = await fetch(`${backend.supabaseUrl}/functions/v1/pet-stylize`, { headers: { apikey: backend.supabaseAnonKey, Authorization: `Bearer ${sessionData.session.access_token}` } });
    console.log(`INFO painting function health HTTP ${health.status}`);
    assert(health.ok, 'painting function accepts an authenticated session');
    const noAuth = await fetch(`${backend.supabaseUrl}/functions/v1/pet-stylize`, { method: 'POST', headers: { apikey: backend.supabaseAnonKey, 'Content-Type': 'application/json' }, body: '{}' });
    assert(noAuth.status === 401, 'painting function rejects requests without a user session');
    for (const item of fixtures) {
      if (item.paths.length) await must('remove fixture photos', item.client.storage.from('pets').remove(item.paths));
      item.paths = [];
      await must('delete own account RPC', item.client.rpc('delete_my_account'));
      item.deleted = true;
      const lookup = await admin.auth.admin.getUserById(item.id);
      assert(!lookup.data?.user, 'account deletion removes the auth user');
      for (const table of ['profiles', 'pet', 'checkins', 'journal_entries', 'tasks', 'task_completions', 'pet_state']) {
        assert((await must(`verify deletion ${table}`, admin.from(table).select('user_id').eq('user_id', item.id))).length === 0, `deletion cascades to ${table}`);
      }
    }
    console.log(`SUCCESS ${assertions} hosted assertions. No email sent; no AI request made.`);
  } finally {
    let cleanupFailed = false;
    for (const item of fixtures) {
      try {
        if (item.paths.length) await must('cleanup storage', admin.storage.from('pets').remove(item.paths));
        if (!item.deleted) await must('cleanup auth', admin.auth.admin.deleteUser(item.id));
      } catch { cleanupFailed = true; console.error(`CLEANUP REQUIRED: disposable user ${item.id}`); }
    }
    if (cleanupFailed) process.exitCode = 1;
  }
}
main().catch((error) => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
