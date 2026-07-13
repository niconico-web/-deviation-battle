const socket = io();
alert("online.js 読み込み成功");
// 接�?
socket.on("connect", () => {
    console.log("接�?:", socket.id);
});

// ------------------
// ルー�?作�??
// ------------------
document.getElementById("createRoom").onclick = () => {

    const player = JSON.parse(localStorage.getItem("player"));

    if (!player) {
        alert("先にキャラクターを作�?�してください�?");
        return;
    }

    socket.emit("playerJoin", player);
    socket.emit("createRoom");
};

// ------------------
// ルー�?参加
// ------------------
document.getElementById("joinRoom").onclick = () => {

    const player = JSON.parse(localStorage.getItem("player"));

    if (!player) {
        alert("先にキャラクターを作�?�してください�?");
        return;
    }

    const roomId = document
        .getElementById("roomInput")
        .value
        .trim()
        .toUpperCase();

    if(roomId === ""){
        alert("ルー�?コードを入力してください�?");
        return;
    }

    socket.emit("playerJoin", player);
    socket.emit("joinRoom", roomId);
};

// ------------------
// 作�?�完�?
// ------------------
socket.on("roomCreated",(roomId)=>{

    alert("ルー�?コード\n\n"+roomId);

});

// ------------------
// 参加失�?
// ------------------
socket.on("joinFailed",()=>{

    alert("ルー�?が存在しません�?");

});

// ------------------
// マッチ�?��?
// ------------------
socket.on("roomReady",(data)=>{

    console.log("roomReady受信!",data);

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