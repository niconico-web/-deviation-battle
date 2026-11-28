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

// SB_DATA_DIR is intentionally only a test hook. Production always uses
// server/data, while tests can verify restore behavior without real save files.
const DATA_DIR = process.env.SB_DATA_DIR || path.join(__dirname, "..", "data");
const URL_BASE = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLE = process.env.SUPABASE_KV_TABLE || "kv_store";
const ENABLED = !!(URL_BASE && KEY);
// null=未実行 / true=起動時の復元に成功 / false=失敗。
// false のときは Supabase への送信をすべて止める。復元できていないのに送ると、
// Supabase 上の本番データ（市場・ランキング等）を空っぽのローカルファイルで上書きしてしまうため。
let restoreOk = null;
// 問題・ボスなどの「素材ファイル」はコードと一緒に配られるので、保存対象にしない。
// quests.json は名前に反して GuildManager が更新するギルドクエストの実データ。
const STATIC = new Set(["bosses.json", "questions.json", "boss_rewards.json", "boss_questions.json"]);
// 市場の預かり品、プレイヤー（ランキングの元データ）、ギルド／クエストは早く同期する。
const FAST = new Set(["bans.json", "market.json", "players.json", "guilds.json", "quests.json", "survival.json", "nations.json", "artifacts.json"]);
const NAME_OK = /^[A-Za-z0-9_.-]+\.json$/;
const FAST_MS = 3000, SLOW_MS = 15000;

const isMirrored = (name) => NAME_OK.test(name) && !STATIC.has(name);
function headers(extra) { return Object.assign({ apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, extra || {}); }
async function rest(method, query, body, extraHeaders, timeoutMs) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
    try {
        const res = await fetch(URL_BASE + "/rest/v1/" + TABLE + query, { method: method, headers: headers(extraHeaders), body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
        if (!res.ok) throw new Error(method + " " + res.status + " " + (await res.text()).slice(0, 200));
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } finally { clearTimeout(timer); }
}
const listRemote = () => rest("GET", "?select=key,content");
// 起動時の復元は「キー一覧（軽い）」→「1ファイルずつ取得」にする。全ファイルの中身を1回で取ると、重いときやSupabaseが遅いときに
// 20秒で打ち切られて復元に失敗し、そのあいだ保存まで止まってしまっていた。
const listKeys = () => rest("GET", "?select=key", null, null, 20000);
async function getContent(key) {
    const rows = await rest("GET", "?select=content&key=eq." + encodeURIComponent(key), null, null, 25000);
    return rows && rows[0] ? rows[0].content : null;
}
async function withRetry(fn, times) {
    let last;
    for (let i = 0; i < times; i++) { try { return await fn(); } catch (e) { last = e; } }
    throw last;
}
const upsert = (rows) => rest("POST", "?on_conflict=key", rows, { Prefer: "resolution=merge-duplicates,return=minimal" });
function localFiles() { try { return fs.readdirSync(DATA_DIR).filter(isMirrored); } catch (e) { return []; } }
function readLocal(name) { try { const t = fs.readFileSync(path.join(DATA_DIR, name), "utf-8"); JSON.parse(t); return t; } catch (e) { return null; } }   // 壊れている／書き込み途中のものは送らない

// ---------- ① 起動時の復元 ----------
// 復元に失敗したファイル名の一覧を、親プロセスへ渡すための一時ファイル
const FAILED_FILE = path.join(DATA_DIR, ".restore-failed.tmp");
async function restore() {
    const keys = ((await listKeys()) || []).map(r => r && r.key).filter(k => k && isMirrored(k));      // ここが失敗したら、全体を失敗として扱う
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    let n = 0; const failed = [];
    for (const key of keys) {
        try {
            const content = await withRetry(() => getContent(key), 2);
            if (content == null) continue;
            try { JSON.parse(content); } catch (e) { console.warn("[Supabase] skip broken row: " + key); failed.push(key); continue; }      // 壊れた行は、上書きして消さないよう保存対象から外す
            const file = path.join(DATA_DIR, key);
            fs.writeFileSync(file + ".tmp", content, "utf-8"); fs.renameSync(file + ".tmp", file); n++;
        } catch (e) { console.warn("[Supabase] restore failed for " + key + ": " + (e.message || e)); failed.push(key); }
    }
    try { fs.writeFileSync(FAILED_FILE, JSON.stringify(failed), "utf-8"); } catch (e) { /* 渡せなくても、親は全体を失敗扱いにしない */ }
    console.log("[Supabase] restored " + n + "/" + keys.length + " file(s) from " + TABLE + (failed.length ? " (失敗: " + failed.join(", ") + ")" : ""));
}
async function pushAll() {
    // --push は別プロセスで動くため、親から環境変数で復元結果を受け取る
    const restoreFailed = restoreOk === false || process.env.SB_SUPABASE_RESTORE_OK === "false";
    if (ENABLED && restoreFailed) { console.warn("[Supabase] 復元失敗のため最終保存をスキップ（本番データ保護）"); return; }
    const skip = new Set(String(process.env.SB_SUPABASE_FAILED_KEYS || "").split(",").filter(Boolean));      // 復元できなかったファイルは、本番データを空で上書きしないよう送らない
    const rows = localFiles().filter(name => !skip.has(name)).map(name => ({ key: name, content: readLocal(name) })).filter(r => r.content != null);
    if (rows.length) await upsert(rows);
    console.log("[Supabase] pushed " + rows.length + " file(s)");
}

// server.js の最初に呼ぶ。別プロセスで復元して結果を待つ（以降の require がファイルを読むより前に終わらせるため）
let failedKeys = new Set();      // 起動時に復元できなかったファイル（このあいだは、そのファイルだけ Supabase へ送らない）
function restoreOnBootSync() {
    if (!ENABLED) { console.log("[Supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY 未設定：ファイル保存のみで動きます"); return false; }
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            try { fs.unlinkSync(FAILED_FILE); } catch (e) { /* 無ければ無視 */ }
            execFileSync(process.execPath, [__filename, "--restore"], { stdio: "inherit", timeout: 60000, env: process.env });
            try { failedKeys = new Set(JSON.parse(fs.readFileSync(FAILED_FILE, "utf-8"))); fs.unlinkSync(FAILED_FILE); } catch (e) { failedKeys = new Set(); }
            if (failedKeys.size) console.warn("[Supabase] 一部のファイルを復元できませんでした（そのファイルだけ保存を止めます）: " + Array.from(failedKeys).join(", "));
            restoreOk = true; return true;
        }
        catch (e) { console.warn("[Supabase] 起動時の復元に失敗（" + attempt + "回目）: " + (e.message || e).toString().slice(0, 160)); }
    }
    restoreOk = false;
    console.warn("[Supabase] 復元に失敗したため、Supabaseへの保存を停止しました。次回起動時に再試行します。（Supabaseのプロジェクトが一時停止していないか、URL/キーが正しいかを確認してください）");
    return false;
}

// ---------- ② 実行中の同期 ／ ③ 停止時の最終保存 ----------
const sig = new Map(), lastSent = new Map();
let busy = false, started = false, lastWarn = 0;
const sigOf = (name) => { try { const s = fs.statSync(path.join(DATA_DIR, name)); return s.mtimeMs + ":" + s.size; } catch (e) { return null; } };
async function syncOnce(force) {
    if (busy || (ENABLED && restoreOk === false)) return; busy = true;
    try {
        const now = Date.now(), rows = [], names = [];
        for (const name of localFiles()) {
            if (failedKeys.has(name)) continue;      // 復元できなかったファイルは送らない
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
    process.on("exit", () => { try { execFileSync(process.execPath, [__filename, "--push"], { stdio: "inherit", timeout: 15000, env: Object.assign({}, process.env, { SB_SUPABASE_RESTORE_OK: String(restoreOk), SB_SUPABASE_FAILED_KEYS: Array.from(failedKeys).join(",") }) }); } catch (e) { /* 終了中なので無視 */ } });
    // いまのファイルを基準にする。Supabase に無いファイル（初回）は、最初にまとめて送る
    try {
        const remote = new Set(((await listKeys()) || []).map(r => r.key));
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
module.exports = {
    enabled: ENABLED, restoreOnBootSync, start, syncOnce, pushAll, restore,
    // Regression-test metadata. Runtime callers should use the methods above.
    _test: { isMirrored, isFast: (name) => FAST.has(name), dataDir: DATA_DIR, table: TABLE }
};
