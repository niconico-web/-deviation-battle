// 市場（MarketManager）のソケット窓口。どの操作も「リクエスト → コールバックで返事」の形
const Market = require("../managers/MarketManager");

module.exports = function (io) {
    io.on("connection", (socket) => {
        // 連打・荒らし対策：10秒に40回まで
        let bucket = 40, last = Date.now();
        const allowed = () => {
            const t = Date.now();
            bucket = Math.min(40, bucket + (t - last) / 250);
            last = t;
            if (bucket < 1) return false;
            bucket -= 1;
            return true;
        };

        const route = (event, fn) => {
            socket.on(event, (payload, cb) => {
                if (typeof cb !== "function") cb = () => {};
                if (!allowed()) { cb({ ok: false, reason: "rate_limit" }); return; }
                try { cb(fn(payload && typeof payload === "object" ? payload : {})); }
                catch (e) { console.error("[Market] " + event + " failed:", e); cb({ ok: false, reason: "server_error" }); }
            });
        };

        route("market:info", () => Object.assign({ ok: true }, Market.info()));
        route("market:browse", Market.browse);
        route("market:mine", Market.mine);
        route("market:list", Market.list);
        route("market:cancel", Market.cancel);
        route("market:reserve", Market.reserve);
        route("market:ack", Market.ack);
        route("market:release", Market.release);
        route("market:pending", Market.pendingFor);
        route("market:mail", Market.mailbox);
        route("market:mailDone", Market.mailDone);
    });
};
