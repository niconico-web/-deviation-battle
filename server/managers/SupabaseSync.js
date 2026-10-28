// ============================================================
// SupabaseSync.js ― サーバーの保存データ（server/data/*.json）を Supabase に保存・復元する
//
//  【なぜ】Renderの無料プランは、再起動のたびに server/data/ が消える。市場の出品・サバイバルの預かり装備・
//          プレイヤーデータなどが一緒に消えるのを防ぐ。
//  【どう動く】各機能は今までどおりJSONファイルに読み書きする（コードはそのまま）。この部品が、
//    ① 起動時に、Supabase の kv_store から server/data/ へファイルを復元する（最初の1回だけ、ここで同期的に待つ）
//    ② 起動後、ファイルが変わったら Supabase へ送る（市場・サバイバルは3秒ごと、ほかは15秒ごと）
//    ③ サーバーが止まるとき（再起動・停止）に、最後の保存を送る
//  【設定】環境変数 SUPABASE_URL と SUPABASE_SERVICE_KEY（service_role キー。ブラウザには絶対に出さない）。
//          未設定のときは何もしない（今までどおりファイルだけで動く）。
// ============================================================
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DATA_DIR = path.join(__dirname, "..", "data");
const URL_BASE = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLE = process.env.SUPABASE_KV_TABLE || "kv_store";
const ENABLED = !!(URL_BASE && KEY);
// 問題・ボスなどの「素材ファイル」はコードと一緒に配られるので、保存対象にしない
const STATIC = new Set(["bosses.json", "questions.json", "quests.json", "boss_rewards.json", "boss_questions.json"]);
const FAST = new Set(["market.json", "survival.json", "nations.json"]);      // 預かり中のアイテムを含むので、短い間隔で送る
const NAME_OK = /^[A-Za-z0-9_.-]+\.json$/;
const FAST_MS = 3000, SLOW_MS = 15000;

const isMirrored = (name) => NAME_OK.test(name) && !STATIC.has(name);
function headers(extra) { return Object.assign({ apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, extra || {}); }
async function rest(method, query, body, extraHeaders) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 20000);
    try {
        const res = await fetch(URL_BASE + "/rest/v1/" + TABLE + query, { method: method, headers: headers(extraHeaders), body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
        if (!res.ok) throw new Error(method + " " + res.status + " " + (await res.text()).slice(0, 200));
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } finally { clearTimeout(timer); }
}
const listRemote = () => rest("GET", "?select=key,content");
const upsert = (rows) => rest("POST", "?on_conflict=key", rows, { Prefer: "resolution=merge-duplicates,return=minimal" });
function localFiles() { try { return fs.readdirSync(DATA_DIR).filter(isMirrored); } catch (e) { return []; } }
function readLocal(name) { try { const t = fs.readFileSync(path.join(DATA_DIR, name), "utf-8"); JSON.parse(t); return t; } catch (e) { return null; } }   // 壊れている／書き込み途中のものは送らない

// ---------- ① 起動時の復元 ----------
async function restore() {
    const rows = await listRemote(); let n = 0;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    for (const r of rows || []) {
        if (!r || !isMirrored(r.key)) continue;
        try { JSON.parse(r.content); } catch (e) { console.warn("[Supabase] skip broken row: " + r.key); continue; }
        const file = path.join(DATA_DIR, r.key);
        fs.writeFileSync(file + ".tmp", r.content, "utf-8"); fs.renameSync(file + ".tmp", file); n++;
    }
    console.log("[Supabase] restored " + n + " file(s) from " + TABLE);
}
async function pushAll() {
    const rows = localFiles().map(name => ({ key: name, content: readLocal(name) })).filter(r => r.content != null);
    if (rows.length) await upsert(rows);
    console.log("[Supabase] pushed " + rows.length + " file(s)");
}

// server.js の最初に呼ぶ。別プロセスで復元して結果を待つ（以降の require がファイルを読むより前に終わらせるため）
function restoreOnBootSync() {
    if (!ENABLED) { console.log("[Supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY 未設定：ファイル保存のみで動きます"); return false; }
    try { execFileSync(process.execPath, [__filename, "--restore"], { stdio: "inherit", timeout: 30000, env: process.env }); return true; }
    catch (e) { console.warn("[Supabase] 起動時の復元に失敗しました（ローカルのファイルで続行）: " + (e.message || e).toString().slice(0, 160)); return false; }
}

// ---------- ② 実行中の同期 ／ ③ 停止時の最終保存 ----------
const sig = new Map(), lastSent = new Map();
let busy = false, started = false, lastWarn = 0;
const sigOf = (name) => { try { const s = fs.statSync(path.join(DATA_DIR, name)); return s.mtimeMs + ":" + s.size; } catch (e) { return null; } };
async function syncOnce(force) {
    if (busy) return; busy = true;
    try {
        const now = Date.now(), rows = [], names = [];
        for (const name of localFiles()) {
            const s = sigOf(name); if (s == null || (!force && sig.get(name) === s)) continue;
            if (!force && now - (lastSent.get(name) || 0) < (FAST.has(name) ? FAST_MS : SLOW_MS)) continue;
            const content = readLocal(name); if (content == null) continue;
            rows.push({ key: name, content: content }); names.push([name, s]);
        }
        if (rows.length) { await upsert(rows); names.forEach(([n, s]) => { sig.set(n, s); lastSent.set(n, now); }); }
    } catch (e) {
        if (Date.now() - lastWarn > 60000) { lastWarn = Date.now(); console.warn("[Supabase] 同期に失敗（あとで再試行）: " + String(e.message || e).slice(0, 160)); }
    } finally { busy = false; }
}
async function start() {
    if (!ENABLED || started) return; started = true;
    // 停止時：同期的に最後の保存を送る（process.exit の直前でも、確実に終わらせるため別プロセスで）。
    // 各機能が 'exit' で自分のファイルを書き終えたあとに走るよう、start() は全機能を読み込んだあとに呼ぶ
    process.on("exit", () => { try { execFileSync(process.execPath, [__filename, "--push"], { stdio: "inherit", timeout: 15000, env: process.env }); } catch (e) { /* 終了中なので無視 */ } });
    // いまのファイルを基準にする。Supabase に無いファイル（初回）は、最初にまとめて送る
    try {
        const remote = new Set(((await listRemote()) || []).map(r => r.key));
        for (const name of localFiles()) { const s = sigOf(name); if (remote.has(name)) sig.set(name, s); }
        await syncOnce(false);
    } catch (e) { console.warn("[Supabase] 初期同期に失敗（あとで再試行）: " + String(e.message || e).slice(0, 160)); }
    setInterval(() => { syncOnce(false); }, 1500).unref();
}

if (require.main === module) {
    const mode = process.argv[2];
    if (!ENABLED) process.exit(0);
    (mode === "--push" ? pushAll() : restore()).then(() => process.exit(0), (e) => { console.warn("[Supabase] " + mode + " failed: " + e.message); process.exit(1); });
}
module.exports = { enabled: ENABLED, restoreOnBootSync, start, syncOnce, pushAll, restore };
