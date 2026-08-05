// ============================================
// School Battle
// BattleManager.js
// Commit #011
// Part 1 / 6
// ============================================

const battles = {};

// 切断通知のタイマー管理
const disconnectTimers = {};

// -----------------------------
// 武器によるステータス補正を適用
// -----------------------------

function applyWeaponStats(player) {
    if (!player.equippedWeapon) {
        return {
            maxHp: player.maxHp,
            atk: player.atk,
            def: player.def,
            speed: player.speed
        };
    }

    const weapon = player.equippedWeapon;
    const baseStats = {
        maxHp: player.maxHp,
        atk: player.atk,
        def: player.def,
        speed: player.speed
    };

    // 武器の倍率を取得
    let multiplier = 1.0;
    if (weapon.multiplier) {
        multiplier = weapon.multiplier;
    } else if (weapon.tier) {
        const tierMults = { tier1: 1.02, tier2: 1.05, tier3: 1.08, tier4: 1.12 };
        multiplier = tierMults[weapon.tier] || 1.0;
    }

    // 武器種の設定を取得
    const weaponTypes = {
        sword_shield: { primary: ["def", "atk"], secondary: [], debuff: {} },
        spear: { primary: ["atk", "speed"], secondary: [], debuff: {}, debugBonus: { bonusMult: 2.0, primary: ["atk", "speed", "def", "maxHp"] } },
        greatsword: { primary: ["atk", "maxHp"], secondary: ["speed"], debuff: { speed: 0.85 } },
        dual_swords: { primary: ["atk", "speed"], secondary: ["def"], debuff: { def: 0.85 } },
        scythe: { primary: ["atk", "speed"], secondary: ["maxHp"], debuff: { maxHp: 0.85 } },
        pistol: { primary: ["def", "maxHp"], secondary: ["atk"], debuff: { atk: 0.85 } },
        katana: { primary: ["atk", "speed"], secondary: ["def"], debuff: { def: 0.85 } }
    };

    const typeConf = weaponTypes[weapon.type];
    
    // カスタム補正を考慮した倍率計算
    const statMultipliers = { atk: multiplier, def: multiplier, speed: multiplier, maxHp: multiplier };
    
    // カスタム補正を倍率に反映
    if (weapon.statBonuses) {
        for (const [stat, bonus] of Object.entries(weapon.statBonuses)) {
            if (statMultipliers[stat] !== undefined) {
                statMultipliers[stat] = statMultipliers[stat] * (1 + bonus);
            }
        }
    }

    // 武器種の設定を適用
    if (typeConf) {
        // デバッグ武器のボーナス
        if (weapon.isDebugWeapon && typeConf.debugBonus) {
            const debugBonus = typeConf.debugBonus;
            const debugMult = debugBonus.bonusMult || 2.0;
            for (const stat of debugBonus.primary) {
                if (baseStats[stat] !== undefined) {
                    baseStats[stat] = Math.floor(baseStats[stat] * debugMult);
                }
            }
        }

        // プライマリステータスに倍率適用
        for (const stat of typeConf.primary) {
            if (baseStats[stat] !== undefined) {
                baseStats[stat] = Math.floor(baseStats[stat] * statMultipliers[stat]);
            }
        }
        
        // セカンダリステータスに倍率適用（0.85倍）
        for (const stat of typeConf.secondary) {
            if (baseStats[stat] !== undefined) {
                baseStats[stat] = Math.floor(baseStats[stat] * (statMultipliers[stat] * 0.85));
            }
        }
        
        // デバフ適用
        if (typeConf.debuff) {
            for (const [stat, debuffMult] of Object.entries(typeConf.debuff)) {
                if (baseStats[stat] !== undefined) {
                    baseStats[stat] = Math.floor(baseStats[stat] * debuffMult);
                }
            }
        }
    } else {
        // 武器種がない場合は全ステータスに基本倍率適用
        for (const stat of ['atk', 'def', 'speed', 'maxHp']) {
            if (baseStats[stat] !== undefined) {
                baseStats[stat] = Math.floor(baseStats[stat] * statMultipliers[stat]);
            }
        }
    }

    return baseStats;
}

// -----------------------------
// バトル作成
// -----------------------------

function createBattle(roomId, host, guest){

    if(!host?.id || !guest?.id){
        return null;
    }

    console.log(`[BattleManager] createBattle: host.grade=${host.grade}, guest.grade=${host.grade}`);

    // クライアント側で既に武器補正が適用されているステータスを使用
    // battleStatsがある場合はそれを使用し、ない場合はベースステータスを使用
    const hostStats = host.battleStats || host;
    const guestStats = guest.battleStats || guest;

    // 武器情報は保持
    const hostWeapon = host.equippedWeapon || null;
    const guestWeapon = guest.equippedWeapon || null;

    battles[roomId] = {

        roomId,

        players:{

            [host.id]:{

                id: host.id,
                socketId: host.socketId,
                name: host.name,

                hp: hostStats.maxHp,
                maxHp: hostStats.maxHp,

                atk: hostStats.atk,
                def: hostStats.def,
                speed: hostStats.speed,
                grade: host.grade || 1,

                equippedWeapon: hostWeapon,

                answerTime: null,
                correctAnswers: 0

            },

            [guest.id]:{

                id: guest.id,
                socketId: guest.socketId,
                name: guest.name,

                hp: guestStats.maxHp,
                maxHp: guestStats.maxHp,

                atk: guestStats.atk,
                def: guestStats.def,
                speed: guestStats.speed,
                grade: guest.grade || 1,

                equippedWeapon: guestWeapon,

                answerTime: null,
                correctAnswers: 0

            }

        },

        turn: null,

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
// ソケ�?�?IDの付け替え（�?��?�ジ遷移後�?�再接続用?�?
// -----------------------------

function findPlayerIdBySocket(battle, socketId) {
    return Object.keys(battle.players).find(
        id => battle.players[id].socketId === socketId
    );
}

function remapPlayerSocket(roomId, oldPlayerId, newSocketId){

    const battle = battles[roomId];

    if(!battle || !battle.players[oldPlayerId]) return false;

    battle.players[oldPlayerId].socketId = newSocketId;

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

    findPlayerIdBySocket,

    remapPlayerSocket,

    disconnectTimers

};