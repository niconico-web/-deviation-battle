module.exports = function(io, socket){

    // プレイヤーの行動
    socket.on("playerAction", (data) => {

        socket.to(data.roomId).emit("playerAction", data);

    });

    // バトル終了
    socket.on("battleFinished", (data) => {

        socket.to(data.roomId).emit("battleFinished", data);

    });

    // 再戦リクエスト
    socket.on("requestRematch", (roomId) => {

        socket.to(roomId).emit("rematchReady");

    });

    // 再戦開始リクエスト
    socket.on("startRematch", (roomId) => {

        socket.to(roomId).emit("rematchConfirmed");
        socket.emit("rematchConfirmed");

    });

};