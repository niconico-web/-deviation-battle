'use strict';

// Persists the existing file-based runtime stores to Supabase without changing
// the synchronous manager APIs used throughout SchoolBattle.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TABLE = 'schoolbattle_storage';
// Only mutable runtime stores belong here. Static question/boss data stays in Git.
const STORE_FILES = [
  'players.json',
  'unique_claims.json',
  'social.json',
  'market.json',
  'guilds.json',
  'quests.json',
  'survival.json',
  'nations.json',
  'bundles.json',
  'pvp_event.json'
];

const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const enabled = Boolean(supabaseUrl && serviceKey);
let watcher = null;
const timers = new Map();
const inFlight = new Map();

function localFile(key) {
  if (!STORE_FILES.includes(key)) throw new Error(`Unsupported storage key: ${key}`);
  return path.join(DATA_DIR, key);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 1000);
    throw new Error(`Supabase request failed (${response.status}): ${body}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function readLocal(key) {
  const file = localFile(key);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    console.error(`[SupabaseSync] Skipping invalid JSON ${key}:`, error.message);
    return null;
  }
}

function writeLocal(key, value) {
  const file = localFile(key);
  const tmp = `${file}.supabase-tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value), 'utf8');
  fs.renameSync(tmp, file);
}

async function upsert(key, value) {
  await request(`${TABLE}?on_conflict=key`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  });
}

async function syncFile(key) {
  if (inFlight.has(key)) {
    await inFlight.get(key);
    return syncFile(key);
  }
  const task = (async () => {
    const value = readLocal(key);
    if (value === null) return;
    await upsert(key, value);
    console.log(`[SupabaseSync] Saved ${key}`);
  })();
  inFlight.set(key, task);
  try { await task; }
  finally { inFlight.delete(key); }
}

function scheduleFile(key) {
  if (!STORE_FILES.includes(key)) return;
  const old = timers.get(key);
  if (old) clearTimeout(old);
  const timer = setTimeout(() => {
    timers.delete(key);
    syncFile(key).catch(error => console.error(`[SupabaseSync] Could not save ${key}:`, error.message));
  }, 1200);
  if (timer.unref) timer.unref();
  timers.set(key, timer);
}

async function initialize() {
  if (!enabled) {
    console.log('[SupabaseSync] Disabled; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set.');
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const rows = await request(`${TABLE}?select=key,value`);
  const stored = new Map((Array.isArray(rows) ? rows : []).map(row => [row.key, row.value]));

  // If the table is empty, seed it from the existing deployment files. Otherwise
  // Supabase wins for known keys, while any newly introduced local store is seeded.
  for (const key of STORE_FILES) {
    if (stored.has(key)) {
      writeLocal(key, stored.get(key));
    } else {
      const local = readLocal(key);
      if (local !== null) await upsert(key, local);
    }
  }

  watcher = fs.watch(DATA_DIR, (_event, filename) => {
    if (!filename) return;
    const key = String(filename);
    if (STORE_FILES.includes(key)) scheduleFile(key);
  });
  watcher.on('error', error => console.error('[SupabaseSync] File watcher error:', error.message));
  console.log(`[SupabaseSync] Connected. ${stored.size} stored data file(s) checked.`);
}

async function shutdown() {
  if (watcher) watcher.close();
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  await Promise.allSettled([...inFlight.values()]);
}

module.exports = { initialize, shutdown, enabled };
