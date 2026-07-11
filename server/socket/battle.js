module.exports = function(io, socket){

    // プレイヤーの行動
    socket.on("playerAction", (data) => {

        socket.to(data.roomId).emit("playerAction", data);

    });

    // バトル終了
    socket.on("battleFinished", (data) => {

        socket.to(data.roomId).emit("battleFinished", data);

    });

    // 再戦
    socket.on("requestRematch", (roomId) => {

        socket.to(roomId).emit("rematchReady");

    });

};