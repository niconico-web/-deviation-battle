// ============================================
// School Battle
// BattleEngine.js
// Commit #012
// Part 1 / 5
// ============================================

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
// 特殊攻撃
// -----------------------------

function calculateSpecial(
    attacker,
    target
){

    return calculateDamage(

        attacker,

        target,

        Math.floor(attacker.sp*1.3)

    );

}

// -----------------------------
// 防御
// -----------------------------

function guard(player){

    player.guard = true;

}

// -----------------------------

module.exports={

    calculateAttack,

    calculateSpecial,

    calculateUltimate,

    guard

};