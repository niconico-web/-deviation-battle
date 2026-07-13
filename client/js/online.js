const socket = io();

// 接続
socket.on("connect", () => {
    console.log("接続:", socket.id);
});

// ------------------
// ルーム作成
// ------------------
document.getElementById("createRoom").onclick = () => {

    const player = JSON.parse(localStorage.getItem("player"));

    if (!player) {
        alert("先にキャラクターを作成してください。");
        return;
    }

    socket.emit("playerJoin", player);
    socket.emit("createRoom", player);
};

// ------------------
// ルーム参加
// ------------------
document.getElementById("joinRoom").onclick = () => {

    const player = JSON.parse(localStorage.getItem("player"));

    if (!player) {
        alert("先にキャラクターを作成してください。");
        return;
    }

    const roomId = document
        .getElementById("roomInput")
        .value
        .trim()
        .toUpperCase();

    if(roomId === ""){
        alert("ルームコードを入力してください。");
        return;
    }

    socket.emit("playerJoin", player);
    socket.emit("joinRoom", { roomId, player });
};

// ------------------
// 菴懈?仙ｮ御ｺ?
// ------------------
socket.on("roomCreated",(roomId)=>{

    alert("繝ｫ繝ｼ繝?繧ｳ繝ｼ繝噂n\n"+roomId);

});

// ------------------
// 蜿ょ刈螟ｱ謨?
// ------------------
socket.on("joinFailed",()=>{

    alert("繝ｫ繝ｼ繝?縺悟ｭ伜惠縺励∪縺帙ｓ縲?");

});

// ------------------
// 繝槭ャ繝∵?千ｫ?
// ------------------
socket.on("roomReady",(data)=>{

    console.log("roomReady蜿嶺ｿ｡!",data);

    localStorage.setItem(
        "roomId",
        data.roomId
    );

    localStorage.setItem(
        "battlePlayer",
        JSON.stringify(data.me)
    );

    localStorage.setItem(
        "enemy",
        JSON.stringify(data.enemy)
    );

    localStorage.setItem(
        "myTurn",
        String(data.myTurn)
    );

    location.href = "battle.html";

});