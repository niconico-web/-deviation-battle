// ------------------
// ルーム作成
// ------------------
function setupOnlineEventHandlers() {
    document.getElementById("createRoom").onclick = () => {
        const player = JSON.parse(localStorage.getItem("player"));
        if (!player) {
            alert("まずはキャラクターを作成してください。");
            return;
        }
        window.socket.emit("playerJoin", player);
        window.socket.emit("createRoom", player);
    };

    // ------------------
    // ルーム参加
    // ------------------
    document.getElementById("joinRoom").onclick = () => {
        const player = JSON.parse(localStorage.getItem("player"));
        if (!player) {
            alert("まずはキャラクターを作成してください。");
            return;
        }
        const roomId = document.getElementById("roomInput").value.trim().toUpperCase();
        if(roomId === ""){
            alert("ルームコードを入力してください。");
            return;
        }
        window.socket.emit("playerJoin", player);
        window.socket.emit("joinRoom", { roomId, player });
    };

    // ------------------
    // 作成完了
    // ------------------
    window.socket.on("roomCreated",(roomId)=>{
        alert("ルームコード\n\n"+roomId);
    });

    // ------------------
    // 参加失敗
    // ------------------
    window.socket.on("joinFailed",()=>{
        alert("ルームが存在しません。");
    });

    // ------------------
    // マッチ完了
    // ------------------
    window.socket.on("roomReady",(data)=>{
        console.log("roomReady受信!",data);
        localStorage.setItem("roomId", data.roomId);
        localStorage.setItem("battlePlayer", JSON.stringify(data.me));
        localStorage.setItem("enemy", JSON.stringify(data.enemy));
        location.href = "battle.html";
    });
}

// Setup online handlers when DOM is ready
document.addEventListener("DOMContentLoaded", setupOnlineEventHandlers);