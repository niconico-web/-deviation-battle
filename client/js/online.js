socket.on("roomReady", (data) => {

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
        data.myTurn
    );

    location.href = "battle.html";

});