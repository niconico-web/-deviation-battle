const rooms = {};

function createRoom(roomId, hostSocketId, hostData = null) {

    rooms[roomId] = {

        host: hostSocketId,

        guest: null,

        hostData,

        guestData: null

    };

}

function joinRoom(roomId, guestSocketId, guestData = null) {

    console.log("現在のルーム一覧:", rooms);
    console.log("参加するルーム:", roomId);

    if (!rooms[roomId]) {
        console.log("ルームが存在しません");
        return false;
    }

    if (rooms[roomId].guest !== null) {
        console.log("すでに満員です");
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

function deleteRoom(roomId) {

    delete rooms[roomId];

}

module.exports = {

    createRoom,

    joinRoom,

    getRoom,

    deleteRoom

};
function resetRoom(roomId){

    if(!rooms[roomId]) return;

    // 今後HP�?状態を初期化する�?�合�?�ここに追�?
}

module.exports = {

    createRoom,

    joinRoom,

    getRoom,

    deleteRoom,

    resetRoom

};