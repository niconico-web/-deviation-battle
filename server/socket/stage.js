// server/socket/stage.js
// ============================================
// ステージ（ダンジョン1つ＋ボス1体）の協力プレイ用ルーム管理。
// 町(ロビー)で部屋の一覧を見る／stage.html で部屋を作る・入る。
// 敵の動きはホスト(1人)のブラウザが計算し、サーバーは中継だけ行う。
//
// イベント（クライアント → サーバー）
//   stage:list   { stageId? }                    -> stage:rooms
//   stage:create { player:{id,name,wname,rar}, stageId }
//   stage:join   { roomId, player }
//   stage:quick  { player, stageId }             空いている部屋に参加、無ければ作る
//   stage:start                                  ホストだけ。出発
//   stage:relay  { t, d }                        同じ部屋の他のメンバーへ中継
//   stage:leave
// （サーバー → クライアント）
//   stage:room    ルーム状態（メンバー・ホスト）
//   stage:started 出発
//   stage:msg     { from, t, d }
//   stage:rooms   募集中の部屋一覧
//   stage:error   { message }
// ============================================

const MAX_MEMBERS = 4;
const MAX_RELAY_BYTES = 30000;
const rooms = new Map();          // roomId -> room
const socketRoom = new Map();     // socket.id -> roomId

function cleanName(v, max) {
    return String(v == null ? "" : v).replace(/[<>]/g, "").slice(0, max || 20);
}
function cleanDiff(v) {
    const n = parseInt(v, 10);
    return n >= 0 && n <= 2 ? n : 0;
}
function newRoomId() {
    let id;
    do { id = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(id));
    return id;
}
function publicRoom(r) {
    return {
        id: r.id, stageId: r.stageId, diff: r.diff || 0, hostId: r.hostId, state: r.state, max: MAX_MEMBERS,
        members: r.members.map(m => ({ id: m.id, name: m.name, wname: m.wname, rar: m.rar }))
    };
}

module.exports = function (io) {
    function emitRoom(r) { io.to("stage:" + r.id).emit("stage:room", publicRoom(r)); }

    function leave(socket) {
        const rid = socketRoom.get(socket.id);
        if (!rid) return;
        socketRoom.delete(socket.id);
        const r = rooms.get(rid);
        socket.leave("stage:" + rid);
        if (!r) return;
        const i = r.members.findIndex(m => m.sid === socket.id);
        if (i >= 0) r.members.splice(i, 1);
        if (r.members.length === 0) { rooms.delete(rid); return; }
        if (!r.members.some(m => m.id === r.hostId)) r.hostId = r.members[0].id; // ホストの引き継ぎ
        emitRoom(r);
    }

    function addMember(socket, r, player) {
        leave(socket);
        const id = cleanName(player && player.id, 60);
        if (!id) { socket.emit("stage:error", { message: "プレイヤー情報が不正です" }); return false; }
        if (r.members.length >= MAX_MEMBERS) { socket.emit("stage:error", { message: "この部屋は満員です" }); return false; }
        if (r.state !== "lobby") { socket.emit("stage:error", { message: "すでに出発しています" }); return false; }
        r.members = r.members.filter(m => m.id !== id); // 同一プレイヤーの二重参加を防ぐ
        r.members.push({ sid: socket.id, id: id, name: cleanName(player.name, 16) || "名無し", wname: cleanName(player.wname, 30), rar: cleanName(player.rar, 12) });
        socket.join("stage:" + r.id);
        socketRoom.set(socket.id, r.id);
        emitRoom(r);
        return true;
    }

    io.on("connection", (socket) => {
        socket.on("stage:list", (data) => {
            const sid = data && data.stageId ? String(data.stageId) : null;
            const list = [];
            rooms.forEach(r => {
                if (r.state !== "lobby" || r.members.length >= MAX_MEMBERS) return;
                if (sid && r.stageId !== sid) return;
                list.push(publicRoom(r));
            });
            socket.emit("stage:rooms", list.slice(0, 50));
        });

        socket.on("stage:create", (data) => {
            if (!data || !data.stageId) return;
            const r = { id: newRoomId(), stageId: String(data.stageId).slice(0, 40), diff: cleanDiff(data.diff), hostId: null, state: "lobby", members: [] };
            r.hostId = cleanName(data.player && data.player.id, 60);
            rooms.set(r.id, r);
            if (!addMember(socket, r, data.player)) rooms.delete(r.id);
        });

        socket.on("stage:join", (data) => {
            const r = rooms.get(String(data && data.roomId || "").toUpperCase());
            if (!r) { socket.emit("stage:error", { message: "部屋が見つかりません" }); return; }
            addMember(socket, r, data.player);
        });

        socket.on("stage:quick", (data) => {
            if (!data || !data.stageId) return;
            const sid = String(data.stageId).slice(0, 40);
            let target = null;
            rooms.forEach(r => { if (!target && r.stageId === sid && (r.diff || 0) === cleanDiff(data.diff) && r.state === "lobby" && r.members.length < MAX_MEMBERS) target = r; });
            if (!target) {
                target = { id: newRoomId(), stageId: sid, diff: cleanDiff(data.diff), hostId: cleanName(data.player && data.player.id, 60), state: "lobby", members: [] };
                rooms.set(target.id, target);
                if (!addMember(socket, target, data.player)) rooms.delete(target.id);
                return;
            }
            addMember(socket, target, data.player);
        });

        socket.on("stage:start", () => {
            const r = rooms.get(socketRoom.get(socket.id));
            if (!r || r.state !== "lobby") return;
            const me = r.members.find(m => m.sid === socket.id);
            if (!me || me.id !== r.hostId) return;
            r.state = "playing";
            emitRoom(r);
            io.to("stage:" + r.id).emit("stage:started", { roomId: r.id });
        });

        socket.on("stage:relay", (msg) => {
            const r = rooms.get(socketRoom.get(socket.id));
            if (!r || !msg || typeof msg.t !== "string" || msg.t.length > 12) return;
            let size = 0;
            try { size = JSON.stringify(msg.d || {}).length; } catch (e) { return; }
            if (size > MAX_RELAY_BYTES) return;
            const me = r.members.find(m => m.sid === socket.id);
            if (!me) return;
            socket.to("stage:" + r.id).emit("stage:msg", { from: me.id, t: msg.t, d: msg.d });
        });

        socket.on("stage:leave", () => leave(socket));
        socket.on("disconnect", () => leave(socket));
    });
};
