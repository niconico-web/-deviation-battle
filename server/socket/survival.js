// サバイバルエリアのソケット窓口（計算はすべて SurvivalManager／NationManager＝サーバー側）
const Survival = require("../managers/SurvivalManager");
const Nations = require("../managers/NationManager");

// 国の操作（建国・税・外交・護衛・建築・店）。サバイバルエリアに入っている人だけが使える
const NATION_ACTIONS = [
    "create", "join", "leave", "travel", "kick", "transfer", "setPolicy", "donate",
    "propose", "respond", "breakAlly", "declareWar", "cancelTrade", "setTradeVol",
    "hire", "build", "demolish", "shopView", "shopStock", "shopSetPrice", "shopSetShop", "shopUnstock", "shopBuy"
];

module.exports = function (io) {
    Survival.init(io);
    io.on("connection", (socket) => {
        let lastInput = 0, lastNation = 0;
        socket.on("survival:join", (data, cb) => { if (typeof cb !== "function") cb = () => {}; try { cb(Survival.join(socket, data)); } catch (e) { console.error("[Survival] join failed:", e); cb({ ok: false, reason: "server_error" }); } });
        socket.on("survival:leave", (_d, cb) => { if (typeof cb !== "function") cb = () => {}; try { cb(Survival.leave(socket, !!(_d && _d.force))); } catch (e) { cb({ ok: false, reason: "server_error" }); } });
        socket.on("survival:input", (m) => {
            const t = Date.now(); if (t - lastInput < 25) return;      // 送りすぎは無視（20回/秒が基本）
            lastInput = t; Survival.input(socket, m);
        });

        // ---------- 国 ----------
        const guard = (fn) => (d, cb) => {
            if (typeof cb !== "function") cb = () => {};
            const t = Date.now();
            if (t - lastNation < 120) { cb({ ok: false, reason: "rate_limit" }); return; }
            lastNation = t;
            const P = Survival.playerOf(socket);
            if (!P) { cb({ ok: false, reason: "not_in_area" }); return; }
            try { cb(fn(P, d && typeof d === "object" ? d : {})); }
            catch (e) { console.error("[Nation] failed:", e); cb({ ok: false, reason: "server_error" }); }
        };
        socket.on("nation:state", guard((P) => Nations.state(P)));
        NATION_ACTIONS.forEach((a) => socket.on("nation:" + a, guard((P, d) => Nations[a](P, d))));

        socket.on("disconnect", () => Survival.disconnect(socket));
    });
};
