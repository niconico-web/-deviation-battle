// AIスキル生成のソケット窓口：{ playerId, text, allowForms, allowEffects, special } → 設計図(JSON)
const SkillAI = require("../managers/SkillAIManager");

module.exports = function (io) {
    io.on("connection", (socket) => {
        socket.on("skillai:generate", async (payload, cb) => {
            if (typeof cb !== "function") cb = () => {};
            try { cb(await SkillAI.generate(payload && typeof payload === "object" ? payload : {})); }
            catch (e) { console.error("[SkillAI] handler failed:", e); cb({ ok: false, reason: "server_error" }); }
        });
    });
};
