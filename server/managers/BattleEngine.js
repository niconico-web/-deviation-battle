// ============================================
// School Battle
// BattleEngine.js
// 早解き問題対戦型バトルシステム
// ============================================

const QuestionManager = require("./QuestionManager");

// -----------------------------
// 定数
// -----------------------------

const BASE_DAMAGE = 10;
const SPEED_BONUS_MULTIPLIER = 0.5; // 速さによるダメージボーナス
const TIME_PENALTY_PER_SECOND = 2; // 1秒あたりのダメージペナルティ

// 必殺技システム
const ULTIMATE_GAUGE_MAX = 100; // 必殺技ゲージ最大値
const ULTIMATE_GAUGE_PER_CORRECT = 20; // 正解ごとのゲージ増加量
const ULTIMATE_DAMAGE_MULTIPLIER = 1.5; // 必殺技発動時のダメージ倍率

// -----------------------------
// ランダム
// -----------------------------

function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===================================
// ユニーク能力関連ヘルパー関数
// ===================================

/**
 * プレイヤーが特定のユニーク能力を持っているかチェック
 */
function hasUniqueAbility(player, effectKey) {
    if (!player.equippedWeapon || !player.equippedWeapon.uniqueAbilities) {
        return false;
    }
    return player.equippedWeapon.uniqueAbilities.some(ability => ability.effect === effectKey);
}

/**
 * ステータスにオーブの固有能力（リ・ミゼラブル）を適用
 */
function applyOrbDebuffs(stats, player) {
    if (!player) return stats;
    
    const result = { ...stats };
    
    // リ・ミゼラブル: 相手の全ステータスを0.8倍
    if (hasUniqueAbility(player, "enemy_stat_debuff")) {
        result.atk = Math.floor(result.atk * 0.8);
        result.def = Math.floor(result.def * 0.8);
        result.speed = Math.floor(result.speed * 0.8);
        result.maxHp = Math.floor(result.maxHp * 0.8);
    }
    
    // 貫通: 防御を50%減らす
    if (hasUniqueAbility(player, "ignore_def_half")) {
        result.def = Math.floor(result.def * 0.5);
    }
    
    return result;
}

// -----------------------------
// 新しい問題を生成
// -----------------------------

function generateQuestion(battle) {
    const playerIds = Object.keys(battle.players);
    const player1 = battle.players[playerIds[0]];
    const player2 = battle.players[playerIds[1]];

    console.log(`[BattleEngine] generateQuestion: player1Grade=${player1.grade}, player2Grade=${player2.grade}, isBossBattle=${battle.isBossBattle}`);

    // Check if this is a boss battle
    if (battle.isBossBattle) {
        console.log('[BattleEngine] Using boss question system');
        // For boss battles, use boss questions with player's grade
        const subjects = ['math', 'jp', 'eng', 'sci', 'soc'];
        const subject = subjects[Math.floor(Math.random() * subjects.length)];
        const playerGrade = player1.grade || 1;
        const bossQuestion = QuestionManager.getBossBattleQuestion(subject, playerGrade);
        
        if (bossQuestion) {
            const options = QuestionManager.generateOptions(bossQuestion.answer);
            const question = {
                ...bossQuestion,
                options,
                subject,
                subjectDisplayName: QuestionManager.getSubjectDisplayName(subject),
                startTime: Date.now()
            };
            
            // プレイヤーの回答時間をリセット（新しい問題の前にリセット）
            playerIds.forEach(id => {
                battle.players[id].answerTime = null;
            });
            
            battle.currentQuestion = question;
            return question;
        }
    }

    // 教科をランダムに選択
    let subject = ['math', 'jp', 'english'][Math.floor(Math.random() * 3)];
    console.log(`[BattleEngine] Selected subject: ${subject}`);

    // 二人のプレイヤーの学年に基づいて問題を取得（選択肢付き）
    let question = QuestionManager.getBattleQuestionWithOptions(player1.grade, player2.grade, subject);

    // もし最初の教科で問題が見つからなかった場合、他の教科を試す
    if (!question) {
        console.warn(`[BattleEngine] No question found for subject ${subject}. Trying other subjects.`);
        const otherSubjects = ['math', 'jp', 'english'].filter(s => s !== subject);
        for (const nextSubject of otherSubjects) {
            question = QuestionManager.getBattleQuestionWithOptions(player1.grade, player2.grade, nextSubject);
            if (question) {
                subject = nextSubject; // Update subject to the one that had a question
                console.log(`[BattleEngine] Found question in fallback subject: ${subject}`);
                break;
            }
        }
    }

    console.log(`[BattleEngine] Question result:`, question);

    // プレイヤーの回答時間をリセット（新しい問題の前にリセット）
    playerIds.forEach(id => {
        battle.players[id].answerTime = null;
    });

    if (!question) {
        // 問題が見つからない場合の最終フォールバック
        console.error(`[BattleEngine] ULTIMATE FALLBACK: No questions found in any subject for grades ${player1.grade}-${player2.grade}.`);
        // デフォルトの問題を返す
        battle.currentQuestion = {
            question: "1 + 1 = ?",
            answer: "2",
            subject: 'math', // Default to math
            subjectDisplayName: QuestionManager.getSubjectDisplayName('math'),
            startTime: Date.now()
        };
        // generate options for the fallback
        battle.currentQuestion.options = QuestionManager.generateOptions(battle.currentQuestion.answer);

        return battle.currentQuestion;
    }

    // バトルに問題情報を追加
    battle.currentQuestion = {
        ...question,
        subject: subject,
        subjectDisplayName: QuestionManager.getSubjectDisplayName(subject),
        startTime: Date.now()
    };

    console.log(`[BattleEngine] Generated question:`, battle.currentQuestion);

    return battle.currentQuestion;
}

// -----------------------------
// ダメージ計算
// -----------------------------

function calculateDamage(attacker, defender, answerTimeMs, options = {}) {
    // attackerAtkが渡されなかった場合は、元のステータスを使用
    const baseAtk = (options.attackerAtk !== null && options.attackerAtk !== undefined)
        ? options.attackerAtk
        : (attacker.atk || 0);
    // 基本ダメージ
    let damage = BASE_DAMAGE + Math.floor(baseAtk * 0.5); // ダメージ計算式を少し強化

    // 回答時間によるペナルティ（1秒あたりTIME_PENALTY_PER_SECOND）
    const answerTimeSeconds = answerTimeMs / 1000;
    const timePenalty = Math.floor(answerTimeSeconds * TIME_PENALTY_PER_SECOND);
    damage = Math.max(1, damage - timePenalty);

    // 素早さが90を超える場合、超過分を攻撃ボーナスに変換
    const speed = attacker.speed || 0;
    if (speed > 90) {
        const excessSpeed = speed - 90;
        const attackBonus = Math.floor(excessSpeed * 0.1); // 超過分の10%を攻撃ボーナス
        damage += attackBonus;
    }

    // ランダム要素（±5）
    damage += randomRange(-5, 5);

    // 防御によるダメージ軽減
    let defenderDef = options.defenderDef !== undefined ? options.defenderDef : (defender.def || 0);
    if (options.ignoreDef) {
        defenderDef = 0;
    }
    damage -= Math.floor(defenderDef * 0.2); // 防御の効果を少し上げる

    // 最小ダメージ保証
    damage = Math.max(1, damage);

    // 回避率の計算
    let dodgeChance = 0;
    if (!options.isSureHit && defender) {
        const defenderSpeed = defender.speed || 0;
        // 素早さ7500で最大回避率45%に到達する、二次関数的な上昇カーブ
        const maxSpeed = 7500;
        const maxDodge = 45; // 45%
        if (defenderSpeed > 0) {
            const calculatedDodge = maxDodge * Math.pow(defenderSpeed / maxSpeed, 2);
            dodgeChance = Math.min(calculatedDodge, maxDodge); // 上限を45%に設定
        }
    }

    return {
        damage,
        dodgeChance
    };
}

// ===================================
// 必殺技とダメージボーナス計算
// ===================================

/**
 * ユニーク能力によるダメージボーナスを適用
 */
function applyUniqueAbilityDamageBonus(damage, attacker) {
    let finalDamage = damage;
    
    // 必殺: 20%の確率でダメージ1.5倍
    if (hasUniqueAbility(attacker, "critical_damage")) {
        if (Math.random() < 0.20) {
            finalDamage = Math.floor(finalDamage * 1.5);
        }
    }
    
    return finalDamage;
}

/**
 * ユニーク能力によるダメージ軽減を適用
 */
function applyUniqueAbilityDefense(damage, defender) {
    let finalDamage = damage;
    
    // 鉄壁: ダメージ50%カット
    if (hasUniqueAbility(defender, "damage_cut_half")) {
        finalDamage = Math.floor(finalDamage * 0.5);
    }
    
    return finalDamage;
}

/**
 * ライフドレイン: 与えたダメージの20%をHP回復
 */
function applyLifeDrain(attacker, damageDealt) {
    if (!hasUniqueAbility(attacker, "life_drain")) {
        return 0;
    }
    const healAmount = Math.floor(damageDealt * 0.2);
    return healAmount;
}

/**
 * 攻撃を伴わないスキル効果を即時適用する
 */
function applyInstantSkillEffects(player, enemy, effect, result) {
    if (!effect) return;

    if (effect.damageReduction) {
        player.pendingDamageReduction = Math.min(0.9, effect.damageReduction);
        result.damageReductionActive = player.pendingDamageReduction;
    }
    if (effect.skipNextTurn) {
        player.skipTurn = true;
    }
    if (effect.selfDefDebuff) {
        if (!player.debuffs) player.debuffs = [];
        player.debuffs.push({
            stat: 'def',
            reduction: effect.selfDefDebuff,
            isFlat: true,
            remainingTurns: 2 // このターンと次の相手のターンまで持続
        });
    }
    if (effect.heal) {
        const healAmount = Math.floor(player.maxHp * effect.heal);
        player.hp = Math.min(player.maxHp, player.hp + healAmount);
        result.skillHealed = healAmount;
    }
    if (effect.selfDamage) {
        const selfDmg = Math.floor(player.maxHp * effect.selfDamage);
        player.hp = Math.max(1, player.hp - selfDmg);
        result.skillSelfDamage = selfDmg;
    }
    if (effect.speedDebuff && enemy) {
        if (!enemy.debuffs) enemy.debuffs = [];
        enemy.debuffs.push({
            stat: 'speed',
            reduction: effect.speedDebuff,
            isFlat: false,
            remainingTurns: 3
        });
        result.enemySpeedDebuff = effect.speedDebuff;
    }
    if (effect.burn && enemy) {
        enemy.burnTurns = 3;
        result.enemyBurned = true;
    }
}

/**
 * 受けるダメージにスキルの軽減効果を適用する
 */
function applyPendingDamageReduction(defender, damage, result) {
    if (defender.pendingDamageReduction > 0) {
        const reduced = Math.max(1, Math.floor(damage * (1 - defender.pendingDamageReduction)));
        result.skillDamageReduced = { from: damage, to: reduced };
        defender.pendingDamageReduction = 0;
        return reduced;
    }
    return damage;
}

/**
 * 火傷の継続ダメージを処理する
 */
function tickBurn(player, result, key) {
    if (!player.burnTurns || player.burnTurns <= 0) return;
    const burnDamage = Math.max(1, Math.floor(player.maxHp * 0.05));
    player.hp = Math.max(0, player.hp - burnDamage);
    player.burnTurns--;
    result[key] = { damage: burnDamage, remaining: player.burnTurns, hp: player.hp };
}

/**
 * ターン終了時にデバフのターンを減らす
 */
function tickDebuffs(player) {
    if (!player.debuffs || player.debuffs.length === 0) return;
    player.debuffs.forEach(d => d.remainingTurns--);
    player.debuffs = player.debuffs.filter(d => d.remainingTurns > 0);
}

/**
 * デバフを考慮したステータスを取得
 */
function getStatWithDebuffs(player, statName) {
    let value = player[statName] || 0;
    if (player.debuffs) {
        player.debuffs.forEach(debuff => {
            if (debuff.stat === statName) {
                value = debuff.isFlat ? value - debuff.reduction : value * (1 - debuff.reduction);
            }
        });
    }
    return Math.max(0, value);
}
// -----------------------------
// 回答を処理
// -----------------------------

function processAnswer(battle, playerId, answer, usedSkill) {
    const player = battle.players[playerId];
    const enemyId = Object.keys(battle.players).find(id => id !== playerId);
    const enemy = battle.players[enemyId];
    
    if (!battle.currentQuestion) {
        return { error: "No active question" };
    }
    
    // 回答時間を記録
    const answerTime = Date.now() - battle.currentQuestion.startTime;
    player.answerTime = answerTime;
    
    // 正解チェック
    const isCorrect = QuestionManager.checkAnswer(battle.currentQuestion, answer);
    
    let result = {
        playerId,
        playerName: player.name,
        isCorrect,
        answerTime,
        question: battle.currentQuestion.question,
        skillUsed: null,
    };
    
    // 両方のプレイヤーが回答したかチェック
    const bothAnswered = player.answerTime !== null && enemy.answerTime !== null;
    
    // スキルの発動判定と、攻撃を伴わない効果の即時適用
    // （正解・不正解にかかわらず発動させることで防御系スキルも機能させる）
    let activeSkillEffect = null;
    if (usedSkill && usedSkill.effect) {
        const eff = usedSkill.effect;
        let canApply = true;
        if (eff.condition && eff.condition.type === 'hp_below') {
            if (player.maxHp > 0 && player.hp / player.maxHp > eff.condition.value) {
                canApply = false;
            }
        }
        if (canApply) {
            console.log(`[BattleEngine] Applying skill "${usedSkill.name}" for player ${player.name}`);
            activeSkillEffect = eff;
            result.skillUsed = usedSkill;
            applyInstantSkillEffects(player, enemy, eff, result);
        } else {
            result.skillFailed = usedSkill.name;
        }
    }
    
    if (isCorrect) {
        // 正解の場合
        const attacker = player;
        const defender = enemy;
        player.correctAnswers++;
        
        // 必殺技ゲージを初期化（存在しない場合）
        if (!attacker.ultimateGauge) {
            attacker.ultimateGauge = { current: 0, max: ULTIMATE_GAUGE_MAX };
        }
        
        // 必殺技ゲージを増加
        attacker.ultimateGauge.current = Math.min(attacker.ultimateGauge.max, attacker.ultimateGauge.current + ULTIMATE_GAUGE_PER_CORRECT);
        result.ultimateGauge = attacker.ultimateGauge.current;
        result.ultimateReady = attacker.ultimateGauge.current >= attacker.ultimateGauge.max;
        
        // 先に正解した場合のみダメージを与える
        if (!defender.answerTime) {
            const skillIsActive = !!activeSkillEffect;
            let isAttackerSureHit = hasUniqueAbility(attacker, "ignore_evasion"); // 必中能力
            let isAttackerIgnoreDef = hasUniqueAbility(attacker, "ignore_def_half"); // 貫通能力

            if (skillIsActive) {
                if (activeSkillEffect.ignoreDef) isAttackerIgnoreDef = true;
                if (activeSkillEffect.sureHit) isAttackerSureHit = true;
            }

            // 「根性」の攻撃力アップ効果
            let attackerAtk = attacker.atk;
            if (attacker.hp === 1 && hasUniqueAbility(attacker, 'guts')) {
                attackerAtk = Math.floor(attackerAtk * 3);
                result.gutsAtkBoost = true;
                result.gutsAtkBoostPlayerName = attacker.name;
            }

            const defenderEffectiveDef = getStatWithDebuffs(defender, 'def');
            let damageResult = calculateDamage(attacker, defender, answerTime, {
                isSureHit: isAttackerSureHit,
                attackerAtk: attackerAtk,
                ignoreDef: isAttackerIgnoreDef,
                defenderDef: defenderEffectiveDef
            });
            let damage = damageResult.damage;
            
            // スキルによるダメージ倍率・追加効果を適用
            if (skillIsActive) {
                if (activeSkillEffect.damageMultiplier) {
                    damage = Math.floor(damage * activeSkillEffect.damageMultiplier);
                }
                if (activeSkillEffect.nextAttackCrit) {
                    damage = Math.floor(damage * 1.5);
                    result.skillCrit = true;
                }
                const strikeCount = Math.max(1, Math.min(5, activeSkillEffect.multiStrike || 1));
                if (strikeCount > 1) {
                    const perHitRate = activeSkillEffect.multiStrikeMultiplier || 0.6;
                    damage = Math.max(1, Math.floor(damage * perHitRate)) * strikeCount;
                    result.multiStrike = strikeCount;
                }
            }
            
            // 「行動できない」デメリット
            if (attacker.skipTurn) {
                attacker.skipTurn = false;
                damage = 0;
                result.skippedTurn = true;
            }
            const dodgeChance = damageResult.dodgeChance;
            
            // 必殺技発動判定（ゲージが満タンの場合）
            let ultimateActivated = false;
            if (attacker.ultimateGauge.current >= attacker.ultimateGauge.max) {
                damage = Math.floor(damage * ULTIMATE_DAMAGE_MULTIPLIER);
                ultimateActivated = true;
                result.ultimateActivated = true;
                result.ultimateDamage = damage;
                // 必殺技発動後、ゲージをリセット
                attacker.ultimateGauge.current = 0;
                result.ultimateGauge = 0;
                result.ultimateReady = false;
            }
            
            // ユニーク能力によるダメージボーナスを適用
            damage = applyUniqueAbilityDamageBonus(damage, attacker);
            
            // 回避判定
            const dodgeRoll = Math.random() * 100;
            if (damage <= 0) {
                result.damage = 0;
            } else if (dodgeRoll < dodgeChance) {
                result.damage = 0;
                result.dodged = true;
                result.dodgeChance = dodgeChance;
            } else {
                // ユニーク能力によるダメージ軽減を適用（防御側）
                let finalDamage = applyUniqueAbilityDefense(damage, defender);
                // 防御側のスキルによるダメージ軽減
                finalDamage = applyPendingDamageReduction(defender, finalDamage, result);

                if (defender.hp - finalDamage <= 0 && defender.hp > 1 && hasUniqueAbility(defender, 'guts')) {
                    defender.hp = 1;
                    result.gutsSurvive = true;
                    result.gutsSurvivePlayerName = defender.name;
                } else {
                    defender.hp = Math.max(0, defender.hp - finalDamage);
                }
                result.damage = finalDamage;
                result.enemyHp = defender.hp;
                result.firstCorrect = true;
                
                // スキルによるHP吸収
                if (skillIsActive && activeSkillEffect.lifeSteal) {
                    const stolen = Math.floor(finalDamage * activeSkillEffect.lifeSteal);
                    if (stolen > 0) {
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + stolen);
                        result.skillLifeSteal = stolen;
                    }
                }
                
                // ライフドレイン: ダメージの20%をHP回復
                const healAmount = applyLifeDrain(attacker, finalDamage);
                if (healAmount > 0) {
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                    result.lifedrainHealed = healAmount;
                }
            }
            
            // 勝利判定
            if (defender.hp <= 0) {
                battle.finished = true;
                result.winner = playerId;
            }
        } else {
            // 相手が既に回答している場合、ダメージなし
            result.firstCorrect = false;
        }
    } else {
        // 不正解の場合 - 間違えた方がダメージを受ける
        const attacker = enemy;
        const defender = player;
        // 「根性」の攻撃力アップ効果
        let attackerAtk = attacker.atk;
        if (attacker.hp === 1 && hasUniqueAbility(attacker, 'guts')) {
            attackerAtk = Math.floor(attackerAtk * 3);
            result.gutsAtkBoost = true;
            result.gutsAtkBoostPlayerName = attacker.name;
        }

        // 敵が必中能力を持っているかチェック
        const isEnemySureHit = hasUniqueAbility(attacker, "ignore_evasion");
        
        const damageResult = calculateDamage(attacker, defender, 0, {
            isSureHit: isEnemySureHit,
            attackerAtk: attackerAtk,
            defenderDef: getStatWithDebuffs(defender, 'def')
        });
        let damage = damageResult.damage;
        const dodgeChance = damageResult.dodgeChance;
        
        // ユニーク能力によるダメージボーナスを適用
        damage = applyUniqueAbilityDamageBonus(damage, attacker);
        
        // 回避判定
        const dodgeRoll = Math.random() * 100;
        if (dodgeRoll < dodgeChance) {
            result.damage = 0;
            result.dodged = true;
            result.dodgeChance = dodgeChance;
        } else {
            // ユニーク能力によるダメージ軽減を適用（防御側）
            let finalDamage = applyUniqueAbilityDefense(damage, defender);

            if (defender.hp - finalDamage <= 0 && defender.hp > 1 && hasUniqueAbility(defender, 'guts')) {
                defender.hp = 1;
                result.gutsSurvive = true;
                result.gutsSurvivePlayerName = defender.name;
            } else {
                defender.hp = Math.max(0, defender.hp - finalDamage);
            }
            result.damage = finalDamage;
            result.playerHp = defender.hp;
            result.firstCorrect = false;
            result.wrongAnswer = true;
            
            // ライフドレイン: ダメージの20%をHP回復
            const healAmount = applyLifeDrain(attacker, finalDamage);
            if (healAmount > 0) {
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                result.enemyLifedrainHealed = healAmount;
            }
        }
        
        // 勝利判定
        if (defender.hp <= 0) {
            battle.finished = true;
            result.winner = enemyId;
            console.log(`[BattleEngine] Player ${playerId} HP reached 0, winner: ${enemyId}`);
        }
    }
    
    // 一方が正解した場合、または両方のプレイヤーが回答した場合、次の問題へ
    if ((isCorrect || bothAnswered) && !battle.finished) {
        generateQuestion(battle);
        // デバフのターンを経過させる
        tickDebuffs(player);
        tickDebuffs(enemy);

        result.nextQuestion = battle.currentQuestion;
    }
    
    // バトルが終了した場合、winnerをresultに含める
    if (battle.finished && result.winner) {
        console.log(`[BattleEngine] Battle finished, winner: ${result.winner}`);
    }
    
    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

// ===================================
// バトル初期化時の処理
// ===================================

/**
 * バトル開始時のステータス調整
 * リ・ミゼラブルなどの能力を適用
 */
function applyBattleStartEffects(battle) {
    const playerIds = Object.keys(battle.players);
    
    for (const playerId of playerIds) {
        const player = battle.players[playerId];
        
        // リ・ミゼラブル: 相手のステータスを0.8倍にする処理
        // (各プレイヤーのステータスは既に武器補正が適用されているため、
        //  敵のステータスを直接変更する必要がある)
        if (hasUniqueAbility(player, "enemy_stat_debuff")) {
            const enemyId = playerIds.find(id => id !== playerId);
            if (enemyId) {
                const enemy = battle.players[enemyId];
                console.log(`[BattleEngine] Applying リ・ミゼラブル debuff to ${enemy.name}`);
                enemy.atk = Math.floor(enemy.atk * 0.8);
                enemy.def = Math.floor(enemy.def * 0.8);
                enemy.speed = Math.floor(enemy.speed * 0.8);
                enemy.maxHp = Math.floor(enemy.maxHp * 0.8);
                
                // 現在のHPも比率を保って調整
                enemy.hp = Math.floor(enemy.hp * 0.8);
            }
        }
    }
}

// -----------------------------
// バトル開始時の初期化
// -----------------------------

function initializeBattle(battle) {
    // バトル開始時のエフェクトを適用（リ・ミゼラブルなど）
    applyBattleStartEffects(battle);
    
    // 最初の問題を生成
    generateQuestion(battle);
    
    return {
        battle,
        initialQuestion: battle.currentQuestion
    };
}

// -----------------------------
// バトル終了時の処理
// -----------------------------

function finalizeBattle(battle) {
    const playerIds = Object.keys(battle.players);
    const player1 = battle.players[playerIds[0]];
    const player2 = battle.players[playerIds[1]];
    
    let winner, loser;
    
    if (player1.hp > 0) {
        winner = player1;
        loser = player2;
    } else if (player2.hp > 0) {
        winner = player2;
        loser = player1;
    } else {
        // 引き分け
        return {
            draw: true,
            players: battle.players
        };
    }
    
    return {
        winner: winner.id,
        loser: loser.id,
        players: battle.players
    };
}

module.exports = {
    generateQuestion,
    calculateDamage,
    processAnswer,
    initializeBattle,
    finalizeBattle
};
