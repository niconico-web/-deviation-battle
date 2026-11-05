// 固有能力のソケット窓口
//   innate:create { playerId, text }                   → { ok, ability, notes, left }   原理＋基本能力1＋応用能力3（コード付き）
//   innate:extend { playerId, text, ability }           → { ok, fits, reason, skill }    後から応用能力を足せるか判定して作る
const Innate = require("../managers/InnateCodeManager");

module.exports = function (io) {
    io.on("connection", (socket) => {
        const wrap = (fn, tag) => async (payload, cb) => {
            if (typeof cb !== "function") cb = () => {};
            try { cb(await fn(payload && typeof payload === "object" ? payload : {})); }
            catch (e) { console.error("[Innate] " + tag + " handler failed:", e); cb({ ok: false, reason: "server_error" }); }
        };
        socket.on("innate:create", wrap(Innate.create, "create"));
        socket.on("innate:extend", wrap(Innate.extend, "extend"));
    });
};
