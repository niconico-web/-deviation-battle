const rooms = {};

function createRoom(roomId, hostSocketId, hostData = null) {

    rooms[roomId] = {

        host: hostSocketId,

        guest: null,

        hostData,

        guestData: null,

        createdAt: Date.now(),

        expiresAt: Date.now() + 10 * 60 * 1000 // 10分後に期限切れ

    };

    console.log("Room created:", roomId, "expires at:", new Date(rooms[roomId].expiresAt));

}

function joinRoom(roomId, guestSocketId, guestData = null) {

    console.log("現在のルーム一覧:", Object.keys(rooms));
    console.log("参加するルーム:", roomId);

    // 期限切れのルームをクリーンアップ
    cleanupExpiredRooms();

    if (!rooms[roomId]) {
        console.log("ルームが存在しません");
        return false;
    }

    if (rooms[roomId].guest !== null) {
        console.log("すでに満員です");
        return false;
    }

    // 期限切れチェック
    if (Date.now() > rooms[roomId].expiresAt) {
        console.log("ルームの期限が切れています");
        deleteRoom(roomId);
        return false;
    }

    rooms[roomId].guest = guestSocketId;
    rooms[roomId].guestData = guestData;

    console.log("参加成功");

    return true;
}

function getRoom(roomId) {

    return rooms[roomId];

}

function getRooms() {

    return rooms;

}

function deleteRoom(roomId) {

    delete rooms[roomId];

}

function cleanupExpiredRooms() {

    const now = Date.now();
    for (const roomId in rooms) {
        if (rooms[roomId].expiresAt && now > rooms[roomId].expiresAt) {
            console.log("Cleaning up expired room:", roomId);
            delete rooms[roomId];
        }
    }

}

function resetRoom(roomId){

    if(!rooms[roomId]) return;

    // 今後HPや状態を初期化する場合はここに追加
}

module.exports = {

    createRoom,

    joinRoom,

    getRoom,

    getRooms,

    deleteRoom,

    resetRoom,

    cleanupExpiredRooms

};