// ============================================
// School Battle
// BattleEngine.js
// Commit #012
// Part 1 / 5
// ============================================

// Import PassiveSkillManager
const PassiveSkillManager = require("./PassiveSkillManager");

// -----------------------------
// 定数
// -----------------------------

const HIT_RATE = 95;
const DODGE_RATE = 5;

const CRITICAL_RATE = 0.20;
const CRITICAL_POWER = 1.5;

const RANDOM_DAMAGE_MIN = -5;
const RANDOM_DAMAGE_MAX = 5;

const GUARD_RATE = 0.5;

// -----------------------------
// デバフ呪文
// -----------------------------

const DEBUFF_SPELLS = {
    atkDown: {
        name: "攻撃力低下",
        stat: "atk",
        reduction: 0.3, // 30%減少
        damageMultiplier: 0.6 // 威力は物理攻撃の60%
    },
    spDown: {
        name: "特殊攻撃力低下",
        stat: "sp",
        reduction: 0.3,
        damageMultiplier: 0.6
    },
    defDown: {
        name: "防御力低下",
        stat: "def",
        reduction: 0.3,
        damageMultiplier: 0.6
    },
    speedDown: {
        name: "速さ低下",
        stat: "speed",
        reduction: 0.3,
        damageMultiplier: 0.6
    },
    hpDown: {
        name: "HP低下",
        stat: "maxHp",
        reduction: 0.15, // 15%減少
        damageMultiplier: 0.6
    }
};

// -----------------------------
// ランダム
// -----------------------------

function randomRange(min,max){

    return Math.floor(
        Math.random() *
        (max-min+1)
    ) + min;

}

// -----------------------------
// ダメージ計算
// -----------------------------

function calculateDamage(
    attacker,
    target,
    power
){

    // 命中
    if(Math.random()*100 > HIT_RATE){

        return{

            damage:0,

            miss:true,

            critical:false

        };

    }

    // 回避
    if(Math.random()*100 < DODGE_RATE){

        return{

            damage:0,

            miss:true,

            critical:false

        };

    }

    let damage =

        power

        - target.def*0.5

        + randomRange(
            RANDOM_DAMAGE_MIN,
            RANDOM_DAMAGE_MAX
        );

    let critical = false;

    if(Math.random() < CRITICAL_RATE){

        critical = true;

        damage *= CRITICAL_POWER;

    }

    if(target.guard){

        damage *= GUARD_RATE;

    }

    damage = Math.floor(damage);

    if(damage<1){

        damage=1;

    }

    target.hp -= damage;

    if(target.hp<0){

        target.hp=0;

    }

    target.guard=false;

    return{

        damage,

        miss:false,

        critical,

        hp:target.hp

    };

}

// -----------------------------
// 必殺技
// -----------------------------

function calculateUltimate(
    attacker,
    target
){

    return calculateDamage(

        attacker,

        target,

        Math.floor(attacker.sp*2.5)

    );

}

// -----------------------------
// 通常攻撃
// -----------------------------

function calculateAttack(
    attacker,
    target
){

    return calculateDamage(

        attacker,

        target,

        attacker.atk

    );

}

// -----------------------------
// 特殊攻撃（デバフ呪文）
// -----------------------------

function calculateSpecial(
    attacker,
    target
){
    // ランダムにデバフ呪文を選択
    const spellKeys = Object.keys(DEBUFF_SPELLS);
    const randomSpell = spellKeys[Math.floor(Math.random() * spellKeys.length)];
    const spell = DEBUFF_SPELLS[randomSpell];

    // デバフを適用
    const originalStat = target[spell.stat];
    const reduction = Math.floor(originalStat * spell.reduction);
    target[spell.stat] = Math.max(1, originalStat - reduction);

    // ダメージ計算（物理攻撃より低い威力）
    const damage = calculateDamage(
        attacker,
        target,
        Math.floor(attacker.atk * spell.damageMultiplier)
    );

    return {
        ...damage,
        debuff: {
            stat: spell.stat,
            reduction: reduction,
            spellName: spell.name
        }
    };
}

// -----------------------------
// 防御
// -----------------------------

function guard(player){

    player.guard = true;

}

// -----------------------------
// 経験値獲得なし - バトルでは経験値を獲得しない
// レベルアップはゲーム内の他のシステムで管理
// -----------------------------

// 必殺ゲージ（必殺使用時は消費済みのため加算しない）

// ターン交代

// 勝敗

// バトル終了時の処理
function finalizeBattle(winner, loser) {

    // バトルでは経験値獲得なし
    // 勝者と敗者の情報をそのまま返す
    
    return {
        winner: winner,
        loser: loser,
        message: "バトル終了"
    };

}

// 行動実行
function executeAction(
    battle,
    attackerId,
    action
){

    const attacker =
        battle.players[attackerId];

    const defenderId =
        Object.keys(battle.players)
        .find(id => id !== attackerId);

    const defender =
        battle.players[defenderId];

    let result;

    switch(action){

        case "attack":

            result =
                calculateAttack(
                    attacker,
                    defender
                );

            break;

        case "special":

            if(attacker.ultimate < 20){

                return null;

            }

            attacker.ultimate -= 20;

            result =
                calculateSpecial(
                    attacker,
                    defender
                );

            break;

        case "guard":

            guard(attacker);

            result = {

                damage:0,
                guard:true

            };

            break;

        case "ultimate":

            if(attacker.ultimate < 100){

                return null;

            }

            attacker.ultimate = 0;

            result =
                calculateUltimate(
                    attacker,
                    defender
                );

            break;

        default:

            return null;

    }

    // 必殺ゲージ（必殺使用時は消費済みのため加算しない）

    if(action !== "ultimate" && action !== "special"){

        attacker.ultimate += 20;

        if(attacker.ultimate>100){

            attacker.ultimate=100;

        }

    }

    // ターン交代

    battle.turn = defenderId;

    // 勝敗

    if(defender.hp<=0){

        battle.finished = true;
    }

    return{

        attacker,

        defender,

        action,

        result,

        turn:battle.turn,

        winner:

            battle.finished

            ? attacker.id

            : null

    };

}

module.exports={

    calculateAttack,

    calculateSpecial,

    calculateUltimate,

    guard,

    executeAction,

    finalizeBattle

};
