// ============================================
// School Battle
// BattleManager.js
// Commit #011
// Part 1 / 6
// ============================================

const battles = {};

// -----------------------------
// ?????
// -----------------------------

function createBattle(roomId, host, guest){

    battles[roomId] = {

        roomId,

        players:{

            [host.socketId]:{

                id: host.socketId,
                name: host.name,

                hp: host.maxHp,
                maxHp: host.maxHp,

                atk: host.atk,
                sp: host.sp,
                def: host.def,
                speed: host.speed,

                guard: false,
                ultimate: 0

            },

            [guest.socketId]:{

                id: guest.socketId,
                name: guest.name,

                hp: guest.maxHp,
                maxHp: guest.maxHp,

                atk: guest.atk,
                sp: guest.sp,
                def: guest.def,
                speed: guest.speed,

                guard: false,
                ultimate: 0

            }

        },

        turn:

            host.speed >= guest.speed

            ? host.socketId

            : guest.socketId,

        finished: false

    };

    return battles[roomId];

}

// -----------------------------
// ?????
// -----------------------------

function getBattle(roomId){

    return battles[roomId];

}

// -----------------------------
// ???????
// -----------------------------

function getPlayer(roomId,id){

    const battle = battles[roomId];

    if(!battle) return null;

    return battle.players[id];

}

// -----------------------------
// ????
// -----------------------------

function getEnemy(roomId,id){

    const battle = battles[roomId];

    if(!battle) return null;

    const ids = Object.keys(battle.players);

    const enemyId = ids.find(
        playerId => playerId !== id
    );

    return battle.players[enemyId];

}

// -----------------------------
// ?????
// -----------------------------

function nextTurn(roomId){

    const battle = battles[roomId];

    if(!battle) return;

    const ids = Object.keys(battle.players);

    battle.turn = ids.find(
        id => id !== battle.turn
    );

}

// -----------------------------
// ?????
// -----------------------------

function finishBattle(roomId){

    if(!battles[roomId]) return;

    battles[roomId].finished = true;

}

// -----------------------------
// ソケットIDの付け替え（ページ遷移後の再接続用）
// -----------------------------

function remapPlayerSocket(roomId, oldSocketId, newSocketId){

    const battle = battles[roomId];

    if(!battle || !battle.players[oldSocketId]) return false;

    const player = {
        ...battle.players[oldSocketId],
        id: newSocketId
    };

    delete battle.players[oldSocketId];
    battle.players[newSocketId] = player;

    if(battle.turn === oldSocketId){
        battle.turn = newSocketId;
    }

    return true;

}

// -----------------------------
// ?????
// -----------------------------

function deleteBattle(roomId){

    delete battles[roomId];

}

module.exports = {

    createBattle,

    getBattle,

    getPlayer,

    getEnemy,

    nextTurn,

    finishBattle,

    deleteBattle,

    remapPlayerSocket

};