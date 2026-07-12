console.log("Socket ID:", socket.id);

socket.on("connect", () => {
    console.log("接続後 Socket ID:", socket.id);
});
socket.on("roomReady", (data) => {

    console.log("roomReady受信!", data);

    // ルームID保存
    localStorage.setItem(
        "roomId",
        data.roomId
    );

    // 自分
    localStorage.setItem(
        "player",
        JSON.stringify(data.me)
    );

    // 相手
    localStorage.setItem(
        "enemy",
        JSON.stringify(data.enemy)
    );

    // 最初のターン
    localStorage.setItem(
        "myTurn",
        String(data.myTurn)
    );

    location.href = "battle.html";

});