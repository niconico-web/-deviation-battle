const socket = io();

// �ڑ�
socket.on("connect", () => {
    console.log("�ڑ�:", socket.id);
});

// ------------------
// ���[���쐬
// ------------------
document.getElementById("createRoom").onclick = () => {

    const player = JSON.parse(localStorage.getItem("player"));

    if (!player) {
        alert("��ɃL�����N�^�[���쐬���Ă��������B");
        return;
    }

    socket.emit("playerJoin", player);
    socket.emit("createRoom", player);
};

// ------------------
// ���[���Q��
// ------------------
document.getElementById("joinRoom").onclick = () => {

    const player = JSON.parse(localStorage.getItem("player"));

    if (!player) {
        alert("��ɃL�����N�^�[���쐬���Ă��������B");
        return;
    }

    const roomId = document
        .getElementById("roomInput")
        .value
        .trim()
        .toUpperCase();

    if(roomId === ""){
        alert("���[���R�[�h����͂��Ă��������B");
        return;
    }

    socket.emit("playerJoin", player);
    socket.emit("joinRoom", { roomId, player });
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

    location.href = "battle.html";

});