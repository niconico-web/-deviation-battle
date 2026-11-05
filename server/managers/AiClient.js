// ============================================================
//  AiClient — AI（文章生成）を呼ぶ共通の窓口
// ------------------------------------------------------------
//  使うAIは、環境変数で決まる（上にあるものほど優先）：
//   1. GEMINI_API_KEY（または GOOGLE_API_KEY）… Google AI Studio のキー → Gemini を使う
//   2. ANTHROPIC_API_KEY                       … Claude を使う
//   どちらも無ければ null を返す（呼び出し側が「簡易版」で作る）
//   AI_PROVIDER=gemini / claude を指定すると、両方のキーがあるときにどちらを使うか選べる
//
//  モデル（環境変数で変えられる）：
//   Gemini ：GEMINI_MODEL（既定 gemini-2.5-flash）。AIスキル生成だけ別にしたいときは GEMINI_SKILL_MODEL
//   Claude ：呼び出し側が渡す（SKILL_AI_MODEL）
// ============================================================
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function geminiKey() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""; }
function claudeKey() { return process.env.ANTHROPIC_API_KEY || ""; }
function provider() {
    const want = String(process.env.AI_PROVIDER || "").toLowerCase();
    if (want === "claude" && claudeKey()) return "claude";
    if (want === "gemini" && geminiKey()) return "gemini";
    if (geminiKey()) return "gemini";
    if (claudeKey()) return "claude";
    return null;
}

async function callGemini(o, signal) {
    const model = (o.geminiModelEnv && process.env[o.geminiModelEnv]) || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const url = GEMINI_BASE + encodeURIComponent(model) + ":generateContent";
    const build = (withThinkingOff) => ({
        systemInstruction: { parts: [{ text: o.system }] },
        contents: [{ role: "user", parts: [{ text: o.user }] }],
        generationConfig: Object.assign({
            // 考えるためのトークンも出力の枠に入るので、余裕を持たせる
            maxOutputTokens: o.maxTokens + 4000, temperature: 0.9, responseMimeType: "application/json"
        }, withThinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {})
    });
    const post = (body) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": geminiKey() }, body: JSON.stringify(body), signal: signal });
    // flash系は、考える時間を切って速くする。そのモデルが対応していない（400）ときは、設定なしでもう一度送る
    let res = await post(build(!/pro/i.test(model)));
    if (res.status === 400) res = await post(build(false));
    if (!res.ok) { console.error("[" + o.tag + "] Gemini API error", res.status, model); return null; }
    const j = await res.json();
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.filter(p => !p.thought).map(p => p.text || "").join("");
    if (!text) { console.error("[" + o.tag + "] Gemini returned no text", (j.promptFeedback && j.promptFeedback.blockReason) || ((j.candidates || [])[0] || {}).finishReason || ""); return null; }
    return text;
}
async function callClaudeApi(o, signal) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": claudeKey(), "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: o.claudeModel, max_tokens: o.maxTokens, system: o.system, messages: [{ role: "user", content: o.user }] }),
        signal: signal
    });
    if (!res.ok) { console.error("[" + o.tag + "] Claude API error", res.status); return null; }
    const j = await res.json();
    return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
}

// o = { system, user, maxTokens, timeoutMs, claudeModel, geminiModelEnv, tag } → 文章（失敗・キー無しなら null）
async function callText(o) {
    const p = provider();
    if (!p) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs || 60000);
    try { return p === "gemini" ? await callGemini(o, ctrl.signal) : await callClaudeApi(o, ctrl.signal); }
    catch (e) { console.error("[" + o.tag + "] request failed:", e.message); return null; }
    finally { clearTimeout(timer); }
}

// 起動時に、どのAIを使うかを1回だけ表示する（キーが読み込めているかの確認用。キーの中身は表示しない）
console.log("[AI] 使うAI: " + ({ gemini: "Gemini（Google AI Studio）", claude: "Claude" }[provider()] || "なし（キーが見つからないため、簡易版で動きます）"));

module.exports = { callText, provider, geminiKey, claudeKey };
