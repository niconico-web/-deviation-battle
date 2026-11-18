// ============================================
// School Battle
// ghost.js（ゴースト戦：他プレイヤーの「分身」の保存と抽選）
// ============================================
// オンラインマッチに相手がいないときに戦う「ゴースト」の材料を預かる。
// 預かるのは、名前・武器の種類・武器名・レア度・神話武器id・称号だけ（ステータスは対人戦では関係しない）。
// 数値や中身はクライアント権威なので、ここでは文字の長さと使える文字を絞って、保存と抽選だけを担当する。

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../data/ghosts.json");
const MAX_GHOSTS = 500;
const SAVE_INTERVAL_MS = 5000;     // 同じ接続からの保存は5秒に1回まで
const SLUG = /^[a-zA-Z0-9_]{1,40}$/;

let ghosts = {};
try { ghosts = JSON.parse(fs.readFileSync(FILE, "utf8")) || {}; } catch (e) { ghosts = {}; }

let dirty = false, timer = null;
function flushLater() {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
        timer = null;
        if (!dirty) return;
        dirty = false;
        const tmp = FILE + ".tmp";
        try { fs.writeFileSync(tmp, JSON.stringify(ghosts)); fs.renameSync(tmp, FILE); } catch (e) { console.error("[ghost] 保存に失敗:", e.message); }
    }, 3000);
}

const text = (v, n) => String(v == null ? "" : v).replace(/[<>&"'`]/g, "").trim().slice(0, n);

function sanitize(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.wtype !== "string" || !SLUG.test(raw.wtype)) return null;
    return {
        name: text(raw.name, 12) || "名もなき戦士",
        wtype: raw.wtype,
        wname: text(raw.wname, 40),
        rar: SLUG.test(String(raw.rar || "")) ? String(raw.rar) : "normal",
        mythicId: SLUG.test(String(raw.mythicId || "")) ? String(raw.mythicId) : "",
        title: text(raw.title, 30)
    };
}

module.exports = function (io) {
    io.on("connection", (socket) => {
        let lastSave = 0;

        // 自分の分身（いまの装備）を預ける
        socket.on("ghost:save", (data) => {
            const now = Date.now();
            if (now - lastSave < SAVE_INTERVAL_MS) return;
            const id = text(data && data.id, 64);
            const g = sanitize(data && data.ghost);
            if (!id || !g) return;
            lastSave = now;
            g.at = now;
            ghosts[id] = g;
            const ids = Object.keys(ghosts);
            if (ids.length > MAX_GHOSTS) {      // 古いものから捨てる
                ids.sort((a, b) => (ghosts[a].at || 0) - (ghosts[b].at || 0)).slice(0, ids.length - MAX_GHOSTS).forEach(k => { delete ghosts[k]; });
            }
            flushLater();
        });

        // 自分以外の分身をランダムに1体もらう（いなければ null → クライアントが練習用のゴーストを出す）
        socket.on("ghost:get", (data, ack) => {
            if (typeof ack !== "function") return;
            const me = text(data && data.id, 64);
            const ids = Object.keys(ghosts).filter(k => k !== me);
            if (!ids.length) { ack(null); return; }
            const g = ghosts[ids[Math.floor(Math.random() * ids.length)]];
            ack({ name: g.name, wtype: g.wtype, wname: g.wname, rar: g.rar, mythicId: g.mythicId, title: g.title });
        });
    });
};
