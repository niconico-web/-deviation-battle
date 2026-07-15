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
    socket.on("requestRematch", (data) => {

        const { roomId, playerId } = data;
        socket.to(roomId).emit("rematchRequested", { playerId });

    });

    // 再戦受諾
    socket.on("acceptRematch", (data) => {

        const { roomId } = data;
        // Create new room for rematch
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Notify both players to join new room
        io.to(roomId).emit("rematchConfirmed", { newRoomId });

    });

};