const rooms = {};

function createRoom(roomId, hostSocketId) {

    rooms[roomId] = {

        host: hostSocketId,

        guest: null

    };

}

function joinRoom(roomId, guestSocketId) {

    if (!rooms[roomId]) {

        return false;

    }

    if (rooms[roomId].guest !== null) {

        return false;

    }

    rooms[roomId].guest = guestSocketId;

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

    // 今後HPや状態を初期化する場合はここに追加
}

module.exports = {

    createRoom,

    joinRoom,

    getRoom,

    deleteRoom,

    resetRoom

};