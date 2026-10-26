// サバイバルエリアのソケット窓口（計算はすべて SurvivalManager＝サーバー側）
const Survival = require("../managers/SurvivalManager");

module.exports = function (io) {
    Survival.init(io);
    io.on("connection", (socket) => {
        let lastInput = 0;
        socket.on("survival:join", (data, cb) => { if (typeof cb !== "function") cb = () => {}; try { cb(Survival.join(socket, data)); } catch (e) { console.error("[Survival] join failed:", e); cb({ ok: false, reason: "server_error" }); } });
        socket.on("survival:leave", (_d, cb) => { if (typeof cb !== "function") cb = () => {}; try { cb(Survival.leave(socket, !!(_d && _d.force))); } catch (e) { cb({ ok: false, reason: "server_error" }); } });
        socket.on("survival:input", (m) => {
            const t = Date.now(); if (t - lastInput < 25) return;      // 送りすぎは無視（20回/秒が基本）
            lastInput = t; Survival.input(socket, m);
        });
        socket.on("disconnect", () => Survival.disconnect(socket));
    });
};
