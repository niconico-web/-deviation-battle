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
// ATB（アクティブ型）行動ゲージシステム（オンライン対戦のPvP用）
// クライアント側のローカル戦（bot戦・ボス戦）と同じ考え方：
// 正解のたびに小さな追撃ダメージ（0.5倍）を与えつつ行動ゲージが進み、
// 満タンになったらコマンド（攻撃/特殊/防御/必殺技）を選べる。
// 素早さで必要正解数が変わるが、変化はごくわずかにしてある。
// -----------------------------

/**
 * 行動ゲージを満タンにするために必要な「正解数」を素早さから求める。
 * クライアント側（battle.js）のgetRequiredCorrectCount()と同じ式。
 */
function getRequiredCorrectCount(speed) {
    const baseSpeed = 50;
    const baseCount = 7;
    const minCount = 3;
    const s = Math.max(1, speed || 1);
    const ratio = Math.pow(s / baseSpeed, 0.08);
    const count = baseCount / ratio;
    return Math.max(minCount, Math.min(baseCount, Math.round(count)));
}

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

    // Check if this is a boss battle (レイドで3人以上いる場合を含む)
    if (battle.isBossBattle) {
        // グレードは、生存している人間プレイヤー（ボス以外）の中から代表して1人分を使う
        const humanPlayer = playerIds
            .map(id => battle.players[id])
            .find(p => !p.isBoss) || battle.players[playerIds[0]];

        console.log(`[BattleEngine] generateQuestion (boss/raid): grade=${humanPlayer.grade}, playerCount=${playerIds.length}`);
        console.log('[BattleEngine] Using boss question system');
        // For boss battles, use boss questions with player's grade
        const subjects = ['math', 'jp', 'eng', 'sci', 'soc'];
        const subject = subjects[Math.floor(Math.random() * subjects.length)];
        const playerGrade = humanPlayer.grade || 1;
        const bossQuestion = QuestionManager.getBossBattleQuestion(subject, playerGrade);

        console.log(`[BattleEngine] Boss question result:`, bossQuestion);

        if (bossQuestion) {
            const options = QuestionManager.generateOptions(bossQuestion.answer);
            const question = {
                ...bossQuestion,
                options,
                subject,
                subjectDisplayName: QuestionManager.getSubjectDisplayName(subject),
                startTime: Date.now()
            };

            console.log(`[BattleEngine] Generated boss question:`, question);

            // プレイヤーの回答時間をリセット（新しい問題の前にリセット）
            playerIds.forEach(id => {
                battle.players[id].answerTime = null;
            });

            battle.currentQuestion = question;
            return question;
        } else {
            console.error(`[BattleEngine] Failed to generate boss question for subject=${subject}, grade=${playerGrade}`);
        }
    }

    const player1 = battle.players[playerIds[0]];
    const player2 = battle.players[playerIds[1]];

    console.log(`[BattleEngine] generateQuestion: player1Grade=${player1.grade}, player2Grade=${player2.grade}, isBossBattle=${battle.isBossBattle}`);

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

/**
 * PvP戦（ボス・レイド戦以外）専用：プレイヤー1人だけに紐づく、独立した問題を生成する。
 * 通常のgenerateQuestion()と違い、battle全体で共有される問題ではなく
 * player.currentQuestionに保存する。教科はボス戦と同じ5教科のデータ
 * （boss_questions.json）を使い、その人自身の学年に応じて出題する。
 */
function generatePlayerQuestion(battle, playerId) {
    const player = battle.players[playerId];
    const subjects = ['math', 'jp', 'eng', 'sci', 'soc'];
    let subject = subjects[Math.floor(Math.random() * subjects.length)];
    let bossQuestion = QuestionManager.getBossBattleQuestion(subject, player.grade || 1);

    if (!bossQuestion) {
        for (const nextSubject of subjects.filter(s => s !== subject)) {
            bossQuestion = QuestionManager.getBossBattleQuestion(nextSubject, player.grade || 1);
            if (bossQuestion) {
                subject = nextSubject;
                break;
            }
        }
    }

    if (!bossQuestion) {
        // 保険：問題が一切見つからない場合でも出題が止まらないようにする
        console.error(`[BattleEngine] generatePlayerQuestion: 問題が見つかりません grade=${player.grade}`);
        bossQuestion = { question: "3 + 4 = ?", answer: "7" };
        subject = 'math';
    }

    const options = QuestionManager.generateOptions(bossQuestion.answer);
    const question = {
        ...bossQuestion,
        options,
        subject,
        subjectDisplayName: QuestionManager.getSubjectDisplayName(subject),
        startTime: Date.now()
    };

    player.currentQuestion = question;
    player.answerTime = null;
    return question;
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
        const maxSpeed = 750000;
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

    // クリティカル判定：常時5%の確率で発生する。
    // 「必殺」の固有能力を武器に持っている場合は、クリティカル率が30%まで上がる。
    const critChance = hasUniqueAbility(attacker, "critical_damage") ? 0.30 : 0.05;
    if (Math.random() < critChance) {
        finalDamage = Math.floor(finalDamage * 1.5);
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
 * ボススキル効果を適用する
 * @param {number} damage - 元のダメージ
 * @param {object} attacker - 攻撃者 (ボス)
 * @param {object} defender - 防御者 (プレイヤー)
 * @param {object} skill - 使用するスキル
 * @param {object} result - 結果を格納するオブジェクト
 * @returns {number} - 変更後のダメージ
 */
function applyBossSkillEffect(damage, attacker, defender, skill, result) {
    if (!skill || !skill.effect) return damage;

    let modifiedDamage = damage;
    const effect = skill.effect;

    result.skillUsed = skill; // 使用したスキルを記録

    // ダメージ倍率
    if (effect.damageMultiplier) {
        modifiedDamage = Math.floor(modifiedDamage * effect.damageMultiplier);
    }
    // ライフスティール
    if (effect.lifeSteal) {
        const healAmount = Math.floor(modifiedDamage * effect.lifeSteal);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
        result.bossHealed = healAmount;
    }
    // 防御無視
    if (effect.ignoreDef) {
        result.bossIgnoreDef = true;
    }
    // 必中
    if (effect.sureHit) {
        result.bossSureHit = true;
    }
    // プレイヤーへのデバフ
    if (effect.debuff) {
        if (!defender.debuffs) defender.debuffs = [];
        defender.debuffs.push({
            stat: effect.debuff.type,
            reduction: effect.debuff.reduction,
            isFlat: false,
            remainingTurns: effect.debuff.turns || 3
        });
        result.playerDebuffed = effect.debuff;
    }
    // 自己バフ
    if (effect.selfBuff) {
        if (!attacker.buffs) attacker.buffs = [];
        attacker.buffs.push({
            stat: effect.selfBuff.type,
            amount: effect.selfBuff.amount,
            turns: effect.selfBuff.turns || 2
        });
        result.bossBuffed = effect.selfBuff;
    }
    // 全体強化（ソロ/パーティ問わず、ボス自身の強化として扱う）
    if (effect.partyBuff) {
        if (!attacker.buffs) attacker.buffs = [];
        attacker.buffs.push({
            stat: effect.partyBuff.type,
            amount: effect.partyBuff.amount,
            turns: 3
        });
        result.bossBuffed = effect.partyBuff;
    }
    // 防御貫通（一部無視）：ダメージを上乗せして近似する
    if (effect.pierceDef) {
        modifiedDamage = Math.floor(modifiedDamage * (1 + effect.pierceDef));
        result.bossPierceDef = effect.pierceDef;
    }
    // 多段攻撃
    if (effect.multiHit && effect.multiHit > 1) {
        modifiedDamage = Math.max(1, Math.floor(modifiedDamage * 0.6)) * effect.multiHit;
        result.bossMultiHit = effect.multiHit;
    }
    // 回避率上昇（次に受けるダメージの軽減として近似する）
    if (effect.evasionBoost) {
        attacker.pendingDamageReduction = Math.max(attacker.pendingDamageReduction || 0, effect.evasionBoost);
        result.bossEvasionBoost = effect.evasionBoost;
    }
    // ダメージ軽減バリア（次に受けるプレイヤーの攻撃を軽減）
    if (effect.damageReduction) {
        attacker.pendingDamageReduction = Math.max(attacker.pendingDamageReduction || 0, effect.damageReduction);
        result.bossDamageReduction = effect.damageReduction;
    }
    // 毒（プレイヤーに付与）
    if (effect.poison) {
        defender.poisonTurns = effect.poison.turns || 3;
        result.playerPoisoned = true;
    }
    // 火傷（プレイヤーに付与）
    if (effect.burn) {
        defender.burnTurns = effect.burn.turns || 3;
        result.playerBurned = true;
    }

    return modifiedDamage;
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
        // 同じステータスへのデバフが既にある場合は積み重ねず上書きする。
        // 以前は毎回push()するだけだったため、同じスキルを連発すると
        // 防御・速さなどが多重にかかり続け、無限に近い形で弱体化してしまう
        // （オンライン対戦で一方が実質何もできなくなる）不具合の原因になっていた。
        player.debuffs = player.debuffs.filter(d => d.stat !== 'def');
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
        // 同上の理由により、既存の速さデバフを上書きしてから追加する
        enemy.debuffs = enemy.debuffs.filter(d => d.stat !== 'speed');
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
 * 毒の継続ダメージを処理する
 */
function tickPoison(player, result, key) {
    if (!player.poisonTurns || player.poisonTurns <= 0) return;
    const poisonDamage = Math.max(1, Math.floor(player.maxHp * 0.03));
    player.hp = Math.max(0, player.hp - poisonDamage);
    player.poisonTurns--;
    result[key] = { damage: poisonDamage, remaining: player.poisonTurns, hp: player.hp };
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
 * バフのターンを減らす
 */
function tickBuffs(player) {
    if (!player.buffs || player.buffs.length === 0) return;
    player.buffs.forEach(b => b.turns--);
    player.buffs = player.buffs.filter(b => b.turns > 0);
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

/**
 * バフを考慮したステータスを取得
 */
function getStatWithBuffs(player, statName) {
    let value = player[statName] || 0;
    if (player.buffs) {
        player.buffs.forEach(buff => {
            if (buff.stat === statName) {
                value = value * buff.amount;
            }
        });
    }
    return Math.floor(value);
}
// -----------------------------
// レイドボス戦の回答処理（3人以上のパーティ対応）
// -----------------------------

/**
 * レイドボス戦（パーティ対ボス）用の回答処理。
 * 1対1のprocessAnswerとは異なり、正解した各プレイヤーがそれぞれボスにダメージを与え、
 * 不正解の場合はボスがそのプレイヤー個人に反撃する。
 * その周（ラウンド）で生存している全員が回答し終えたら次の問題に進む。
 * @param {object} battle
 * @param {string} playerId
 * @param {string} answer
 * @param {object} usedSkill
 * @returns {object} result
 */
// 回答のみを処理し、コマンド選択を待つ関数
function processAnswerOnly(battle, playerId, answer, usedSkill) {
    const player = battle.players[playerId];
    const enemyId = battle.isBossBattle
        ? Object.keys(battle.players).find(id => battle.players[id].isBoss)
        : Object.keys(battle.players).find(id => id !== playerId);
    const enemy = battle.players[enemyId];

    if (!battle.currentQuestion) {
        return { error: "No active question" };
    }

    // 既に誰か（自分を含む）がこの問題に正解し、コマンド選択待ちになっている場合は
    // それ以上の回答を受け付けない。以前はこのチェックが無く、片方が正解して
    // コマンド選択中でも、もう片方（や既に正解した本人）が問題に回答し続けられてしまっていた。
    if (battle.currentQuestion.lockedBy) {
        return { error: "この問題は既に正解されました。コマンド選択が終わるまでお待ちください", locked: true };
    }

    const answerTime = Date.now() - battle.currentQuestion.startTime;
    player.answerTime = answerTime;

    const isCorrect = QuestionManager.checkAnswer(battle.currentQuestion, answer);

    let result = {
        playerId,
        playerName: player.name,
        isCorrect,
        answerTime,
        question: battle.currentQuestion.question,
        skillUsed: null,
    };

    // スキルの発動判定と、攻撃を伴わない効果の即時適用
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
        // 正解の場合：必殺技ゲージを増加するが、ダメージは与えない
        player.correctAnswers++;

        if (!player.ultimateGauge) {
            player.ultimateGauge = { current: 0, max: ULTIMATE_GAUGE_MAX };
        }
        player.ultimateGauge.current = Math.min(player.ultimateGauge.max, player.ultimateGauge.current + ULTIMATE_GAUGE_PER_CORRECT);
        result.ultimateGauge = player.ultimateGauge.current;
        result.ultimateReady = player.ultimateGauge.current >= player.ultimateGauge.max;
        result.showCommandMenu = true; // クライアントにコマンドメニューを表示させるフラグ

        // この問題をロックし、他のプレイヤーがこれ以上回答できないようにする
        battle.currentQuestion.lockedBy = playerId;
        result.lockedBy = playerId;
    } else {
        // 不正解の場合：反撃ダメージを受ける
        const attacker = enemy;
        const defender = player;

        let attackerAtk = attacker.atk;
        if (attacker.hp === 1 && hasUniqueAbility(attacker, 'guts')) {
            attackerAtk = Math.floor(attackerAtk * 3);
            result.gutsAtkBoost = true;
            result.gutsAtkBoostPlayerName = attacker.name;
        }

        const isEnemySureHit = hasUniqueAbility(attacker, "ignore_evasion");

        const damageResult = calculateDamage(attacker, defender, 0, {
            isSureHit: isEnemySureHit,
            attackerAtk: attackerAtk,
            defenderDef: getStatWithDebuffs(defender, 'def')
        });
        let damage = damageResult.damage;
        const dodgeChance = damageResult.dodgeChance;

        damage = applyUniqueAbilityDamageBonus(damage, attacker);

        const dodgeRoll = Math.random() * 100;
        if (dodgeRoll < dodgeChance) {
            result.damage = 0;
            result.dodged = true;
            result.dodgeChance = dodgeChance;
        } else {
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
            result.wrongAnswer = true;

            const healAmount = applyLifeDrain(attacker, finalDamage);
            if (healAmount > 0) {
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                result.enemyLifedrainHealed = healAmount;
            }
        }

        if (defender.hp <= 0) {
            battle.finished = true;
            result.winner = enemyId;
        }
    }

    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

/**
 * PvP戦（ボス・レイド戦以外）専用の回答処理。
 * processAnswerOnly() と違い、問題は battle.currentQuestion で共有せず
 * player.currentQuestion で1人ずつ独立して持つ。
 * ・正解のたびに自分の攻撃力の0.5倍の追撃ダメージを与え、行動ゲージ（正解数）を1進める。
 * ・行動ゲージが満タンになったらコマンド選択待ちにする（それまでは待ち時間なしで次の問題）。
 * ・不正解の場合はダメージなし・ゲージ増加なしで、待ち時間なしで次の問題へ
 *   （相手からの反撃は発生しない。相手の行動ゲージは相手自身の正解数で独立して進むため）。
 */
function processPlayerAnswer(battle, playerId, answer, usedSkill) {
    const player = battle.players[playerId];
    const enemyId = Object.keys(battle.players).find(id => id !== playerId);
    const enemy = battle.players[enemyId];

    if (!player || !enemy) {
        return { error: "Invalid battle state" };
    }

    if (!player.currentQuestion) {
        return { error: "No active question for this player" };
    }

    const isCorrect = QuestionManager.checkAnswer(player.currentQuestion, answer);
    const answerTime = Date.now() - player.currentQuestion.startTime;

    let result = {
        playerId,
        playerName: player.name,
        isCorrect,
        answerTime,
        question: player.currentQuestion.question,
        skillUsed: null,
        gaugeRequired: player.gaugeRequired
    };

    // スキルの発動判定と、攻撃を伴わない効果の即時適用（processAnswerOnly()と同じ考え方）
    if (usedSkill && usedSkill.effect) {
        const eff = usedSkill.effect;
        let canApply = true;
        if (eff.condition && eff.condition.type === 'hp_below') {
            if (player.maxHp > 0 && player.hp / player.maxHp > eff.condition.value) {
                canApply = false;
            }
        }
        if (canApply) {
            result.skillUsed = usedSkill;
            applyInstantSkillEffects(player, enemy, eff, result);
        } else {
            result.skillFailed = usedSkill.name;
        }
    }

    player.currentQuestion = null;

    if (isCorrect) {
        player.correctAnswers = (player.correctAnswers || 0) + 1;

        // 正解のたびに自分の攻撃力の0.5倍の追撃ダメージ
        const defReduction = Math.floor(getStatWithDebuffs(enemy, 'def') * 0.1);
        let chipDamage = Math.max(1, Math.floor(player.atk * 0.5) - defReduction);
        chipDamage = applyUniqueAbilityDamageBonus(chipDamage, player);
        chipDamage = applyUniqueAbilityDefense(chipDamage, enemy);
        enemy.hp = Math.max(0, enemy.hp - chipDamage);
        result.chipDamage = chipDamage;
        result.enemyHp = enemy.hp;

        if (!player.ultimateGauge) {
            player.ultimateGauge = { current: 0, max: ULTIMATE_GAUGE_MAX };
        }
        player.ultimateGauge.current = Math.min(player.ultimateGauge.max, player.ultimateGauge.current + 10);
        result.ultimateGauge = player.ultimateGauge.current;
        result.ultimateReady = player.ultimateGauge.current >= player.ultimateGauge.max;

        if (enemy.hp <= 0) {
            battle.finished = true;
            result.winner = playerId;
            return {
                ...result,
                battleState: { players: battle.players, finished: battle.finished }
            };
        }

        player.gaugeCount = (player.gaugeCount || 0) + 1;
        result.gaugeCount = player.gaugeCount;

        if (player.gaugeCount >= player.gaugeRequired) {
            // 行動ゲージ満タン！コマンドを選べる（この間は次の問題を出さない）
            player.readyForCommand = true;
            player.pendingSkillEffect = usedSkill && usedSkill.effect ? usedSkill.effect : null;
            player.pendingUsedSkill = usedSkill || null;
            result.showCommandMenu = true;
            result.gaugeFull = true;
        } else {
            result.nextQuestion = generatePlayerQuestion(battle, playerId);
        }
    } else {
        result.gaugeCount = player.gaugeCount || 0;
        result.nextQuestion = generatePlayerQuestion(battle, playerId);
    }

    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

function processRaidAnswer(battle, playerId, answer, usedSkill, command = 'attack') {
    const player = battle.players[playerId];
    const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);
    const boss = battle.players[bossId];

    if (!player || !boss) {
        return { error: "Invalid raid battle state" };
    }
    if (!battle.currentQuestion) {
        return { error: "No active question" };
    }
    if (player.hp <= 0) {
        return { error: "既に戦闘不能です" };
    }
    if (player.answerTime !== null) {
        return { error: "この問題には既に回答済みです" };
    }

    const answerTime = Date.now() - battle.currentQuestion.startTime;
    player.answerTime = answerTime;

    const isCorrect = QuestionManager.checkAnswer(battle.currentQuestion, answer);

    let result = {
        playerId,
        playerName: player.name,
        isCorrect,
        answerTime,
        question: battle.currentQuestion.question,
        skillUsed: null,
        raid: true
    };

    // スキルの発動判定と、攻撃を伴わない効果の即時適用
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
            activeSkillEffect = eff;
            result.skillUsed = usedSkill;
            applyInstantSkillEffects(player, boss, eff, result);
        } else {
            result.skillFailed = usedSkill.name;
        }
    }

    if (isCorrect) {
        player.correctAnswers++;

        if (!player.ultimateGauge) {
            player.ultimateGauge = { current: 0, max: ULTIMATE_GAUGE_MAX };
        }
        player.ultimateGauge.current = Math.min(player.ultimateGauge.max, player.ultimateGauge.current + ULTIMATE_GAUGE_PER_CORRECT);
        result.ultimateGauge = player.ultimateGauge.current;
        result.ultimateReady = player.ultimateGauge.current >= player.ultimateGauge.max;

        const skillIsActive = !!activeSkillEffect;
        let isAttackerIgnoreDef = hasUniqueAbility(player, "ignore_def_half");
        if (skillIsActive && activeSkillEffect.ignoreDef) isAttackerIgnoreDef = true;

        // コマンド選択制バトルシステム：攻撃/特殊/防御/必殺技
        // ゲージが満タンでないのに「必殺技」が指定された場合は通常攻撃として扱う
        const ultimateReady = player.ultimateGauge.current >= player.ultimateGauge.max;
        const effectiveCommand = (command === 'ultimate' && !ultimateReady) ? 'attack' : command;
        result.command = effectiveCommand;

        if (effectiveCommand === 'defend') {
            // 防御コマンド：この行動では攻撃せず、次に受けるダメージを軽減する
            player.pendingDamageReduction = Math.max(player.pendingDamageReduction || 0, 0.5);
            result.defended = true;
            result.damage = 0;
        } else {
            // 「特殊」コマンドの場合は特殊ステータスを攻撃力の代わりに使う
            let attackerAtk = (effectiveCommand === 'special') ? (player.special || player.atk) : player.atk;
            if (player.hp === 1 && hasUniqueAbility(player, 'guts')) {
                attackerAtk = Math.floor(attackerAtk * 3);
                result.gutsAtkBoost = true;
                result.gutsAtkBoostPlayerName = player.name;
            }

            // レイドボスは基本的に回避しない（多人数を相手取る巨大な敵という前提の簡略化）
            let damageResult = calculateDamage(player, boss, answerTime, {
                isSureHit: true,
                attackerAtk,
                ignoreDef: isAttackerIgnoreDef,
                defenderDef: boss.def
            });
            let damage = damageResult.damage;

            if (skillIsActive) {
                if (activeSkillEffect.damageMultiplier) damage = Math.floor(damage * activeSkillEffect.damageMultiplier);
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

            if (player.skipTurn) {
                player.skipTurn = false;
                damage = 0;
                result.skippedTurn = true;
            }

            // 必殺技発動判定（「必殺技」コマンドを選び、ゲージが満タンの場合のみ）
            if (effectiveCommand === 'ultimate' && damage > 0) {
                damage = Math.floor(damage * ULTIMATE_DAMAGE_MULTIPLIER);
                result.ultimateActivated = true;
                result.ultimateDamage = damage;
                player.ultimateGauge.current = 0;
                result.ultimateGauge = 0;
                result.ultimateReady = false;
            }

            damage = applyUniqueAbilityDamageBonus(damage, player);

            // ボスがスキルで得た「次のダメージ軽減」バリアを消費する
            if (damage > 0 && boss.pendingDamageReduction > 0) {
                damage = applyPendingDamageReduction(boss, damage, result);
            }

            if (damage > 0) {
                boss.hp = Math.max(0, boss.hp - damage);
                result.damage = damage;
                result.enemyHp = boss.hp;

                if (skillIsActive && activeSkillEffect.lifeSteal) {
                    const stolen = Math.floor(damage * activeSkillEffect.lifeSteal);
                    if (stolen > 0) {
                        player.hp = Math.min(player.maxHp, player.hp + stolen);
                        result.skillLifeSteal = stolen;
                    }
                }
                const healAmount = applyLifeDrain(player, damage);
                if (healAmount > 0) {
                    player.hp = Math.min(player.maxHp, player.hp + healAmount);
                    result.lifedrainHealed = healAmount;
                }
            } else {
                result.damage = 0;
            }
        }

        if (boss.hp <= 0) {
            battle.finished = true;
            result.winner = 'party';
            result.raidVictory = true;
        }
    } else {
        // 不正解: ボスがそのプレイヤー個人に反撃する
        const bossAtkWithBuffs = getStatWithBuffs(boss, 'atk');
        const damageResult = calculateDamage(boss, player, 0, {
            attackerAtk: bossAtkWithBuffs,
            defenderDef: getStatWithDebuffs(player, 'def')
        });
        let damage = damageResult.damage;

        // ボススキル使用ロジック
        let bossUsedSkill = null;
        if (boss.skills && boss.skills.length > 0) {
            if (Math.random() < 0.5) { // 50%の確率でスキル使用
                bossUsedSkill = boss.skills[Math.floor(Math.random() * boss.skills.length)];
                damage = applyBossSkillEffect(damage, boss, player, bossUsedSkill, result);
            }
        }

        const dodgeChance = damageResult.dodgeChance;
        const dodgeRoll = Math.random() * 100;

        if (dodgeRoll < dodgeChance) {
            result.damage = 0;
            result.dodged = true;
            result.dodgeChance = dodgeChance;
        } else {
            let finalDamage = applyUniqueAbilityDefense(damage, player);
            if (player.hp - finalDamage <= 0 && player.hp > 1 && hasUniqueAbility(player, 'guts')) {
                player.hp = 1;
                result.gutsSurvive = true;
                result.gutsSurvivePlayerName = player.name;
            } else {
                player.hp = Math.max(0, player.hp - finalDamage);
            }
            result.damage = finalDamage;
            result.playerHp = player.hp;
            result.wrongAnswer = true;
        }

        if (player.hp <= 0) {
            result.playerDown = true;
            const anyoneAlive = Object.values(battle.players).some(p => !p.isBoss && p.hp > 0);
            if (!anyoneAlive) {
                battle.finished = true;
                result.winner = bossId;
                result.raidDefeat = true;
            }
        }
    }

    // このラウンドで、生存しているプレイヤー全員が回答し終えたら次の問題へ
    const alivePlayers = Object.values(battle.players).filter(p => !p.isBoss && p.hp > 0);
    const allAnswered = alivePlayers.length > 0 && alivePlayers.every(p => p.answerTime !== null);

    if (!battle.finished && allAnswered) {
        generateQuestion(battle);
        alivePlayers.forEach(p => {
            tickDebuffs(p);
            tickBuffs(p);
            tickBurn(p, result, 'playerBurnTick_' + p.id);
            tickPoison(p, result, 'playerPoisonTick_' + p.id);
        });
        tickBurn(boss, result, 'bossBurnTick');
        tickBuffs(boss);

        // 毒・火傷のダメージでプレイヤーが倒れていないか確認する
        const stillAlive = Object.values(battle.players).some(p => !p.isBoss && p.hp > 0);
        if (!stillAlive) {
            battle.finished = true;
            result.winner = boss.id;
            result.raidDefeat = true;
        }

        result.nextQuestion = battle.currentQuestion;
        result.roundComplete = true;
    }

    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

// -----------------------------
// 回答を処理
// -----------------------------

function processAnswer(battle, playerId, answer, usedSkill, command = 'attack') {
    const player = battle.players[playerId];
    // ボス戦（レイドで3人以上いる場合を含む）では、常にisBoss:trueのプレイヤーを敵として扱う。
    // 通常のPvP（1対1）では、自分以外の唯一のプレイヤーが敵になる。
    // ※以前は「自分以外の最初のプレイヤー」を機械的に敵にしていたため、
    //   3人以上のレイドバトルでは味方が誤って敵として扱われてしまっていた。
    const enemyId = battle.isBossBattle
        ? Object.keys(battle.players).find(id => battle.players[id].isBoss)
        : Object.keys(battle.players).find(id => id !== playerId);
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

            // コマンド選択制バトルシステム：攻撃/特殊/防御/必殺技
            // ゲージが満タンでないのに「必殺技」が指定された場合は通常攻撃として扱う
            const ultimateReady = attacker.ultimateGauge.current >= attacker.ultimateGauge.max;
            const effectiveCommand = (command === 'ultimate' && !ultimateReady) ? 'attack' : command;
            result.command = effectiveCommand;

            if (effectiveCommand === 'defend') {
                // 防御コマンド：この行動では攻撃せず、次に受けるダメージを軽減する
                attacker.pendingDamageReduction = Math.max(attacker.pendingDamageReduction || 0, 0.5);
                result.defended = true;
                result.damage = 0;
                result.firstCorrect = true;
            } else {

            // 「特殊」コマンドの場合は特殊ステータスを攻撃力の代わりに使う
            let attackerAtk = (effectiveCommand === 'special') ? (attacker.special || attacker.atk) : attacker.atk;
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
            } // effectiveCommand === 'defend' の else 終わり
            
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
    // 不正解の場合でも、相手が回答済みであれば次の問題へ進む（バトルが停滞するのを防ぐ）
    if ((isCorrect || bothAnswered) && !battle.finished) {
        generateQuestion(battle);
        // デバフのターンを経過させる
        tickDebuffs(player);
        tickDebuffs(enemy);

        result.nextQuestion = battle.currentQuestion;
    } else if (!isCorrect && !bothAnswered && !battle.finished) {
        // 不正解で相手がまだ回答していない場合、相手の回答を待つ状態を明示
        result.waitingForOpponent = true;
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

    // ボス・レイド戦、通常のPvP戦のいずれも、プレイヤーごとに独立した
    // 行動ゲージ・問題を用意する（ボス自身の攻撃は、リアルタイムに進行する
    // 別のゲージ・タイマーで socket/battle.js 側が管理する）。
    const playerIds = Object.keys(battle.players).filter(id => !battle.players[id].isBoss);
    const initialQuestions = {};
    playerIds.forEach(id => {
        const p = battle.players[id];
        p.gaugeCount = 0;
        p.gaugeRequired = getRequiredCorrectCount(p.speed);
        p.readyForCommand = false;
        p.pendingSkillEffect = null;
        p.pendingUsedSkill = null;
        initialQuestions[id] = generatePlayerQuestion(battle, id);
    });

    return {
        battle,
        initialQuestions // プレイヤーIDごとの最初の問題
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

// コマンド選択後の処理
function processCommand(battle, playerId, command) {
    const player = battle.players[playerId];
    // パーティでのボス戦（プレイヤーが3人以上）では、単純に「自分以外」を敵として扱うと
    // 味方を誤って攻撃対象にしてしまう。ボス戦では必ずボスを敵として扱う。
    const enemyId = battle.isBossBattle
        ? Object.keys(battle.players).find(id => battle.players[id].isBoss)
        : Object.keys(battle.players).find(id => id !== playerId);
    const enemy = battle.players[enemyId];

    if (!player || !enemy) {
        return { error: "Invalid battle state" };
    }

    // 正解していること確認
    if (!player.answerTime) {
        return { error: "No answer submitted" };
    }

    let result = {
        playerId,
        playerName: player.name,
        command,
    };

    const attacker = player;
    const defender = enemy;

    // コマンド選択制バトルシステム
    const ultimateReady = attacker.ultimateGauge && attacker.ultimateGauge.current >= attacker.ultimateGauge.max;
    const effectiveCommand = (command === 'ultimate' && !ultimateReady) ? 'attack' : command;
    result.command = effectiveCommand;

    if (effectiveCommand === 'defend') {
        // 防御コマンド
        attacker.pendingDamageReduction = Math.max(attacker.pendingDamageReduction || 0, 0.5);
        result.defended = true;
        result.damage = 0;
    } else {
        // 攻撃・特殊・必殺技
        let attackerAtk = (effectiveCommand === 'special') ? (attacker.special || attacker.atk) : attacker.atk;

        if (attacker.hp === 1 && hasUniqueAbility(attacker, 'guts')) {
            attackerAtk = Math.floor(attackerAtk * 3);
            result.gutsAtkBoost = true;
            result.gutsAtkBoostPlayerName = attacker.name;
        }

        let isAttackerSureHit = hasUniqueAbility(attacker, "ignore_evasion");
        let isAttackerIgnoreDef = hasUniqueAbility(attacker, "ignore_def_half");

        const defenderEffectiveDef = getStatWithDebuffs(defender, 'def');
        let damageResult = calculateDamage(attacker, defender, 0, {
            isSureHit: isAttackerSureHit,
            attackerAtk: attackerAtk,
            ignoreDef: isAttackerIgnoreDef,
            defenderDef: defenderEffectiveDef
        });
        let damage = damageResult.damage;

        // 必殺技発動判定
        let ultimateActivated = false;
        if (effectiveCommand === 'ultimate' && ultimateReady) {
            damage = Math.floor(damage * ULTIMATE_DAMAGE_MULTIPLIER);
            ultimateActivated = true;
            result.ultimateActivated = true;
            result.ultimateDamage = damage;
            attacker.ultimateGauge.current = 0;
            result.ultimateGauge = 0;
        }

        damage = applyUniqueAbilityDamageBonus(damage, attacker);

        const dodgeChance = damageResult.dodgeChance;

        const dodgeRoll = Math.random() * 100;
        if (dodgeRoll < dodgeChance) {
            result.damage = 0;
            result.dodged = true;
            result.dodgeChance = dodgeChance;
        } else {
            let finalDamage = applyUniqueAbilityDefense(damage, defender);

            if (defender.hp - finalDamage <= 0 && defender.hp > 1 && hasUniqueAbility(defender, 'guts')) {
                defender.hp = 1;
                result.gutsSurvive = true;
                result.gutsSurvivePlayerName = defender.name;
            } else {
                defender.hp = Math.max(0, defender.hp - finalDamage);
            }
            result.damage = finalDamage;
            result.enemyHp = defender.hp;

            const healAmount = applyLifeDrain(attacker, finalDamage);
            if (healAmount > 0) {
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                result.lifedrainHealed = healAmount;
            }
        }

        if (defender.hp <= 0) {
            battle.finished = true;
            result.winner = playerId;
        }
    }

    // コマンド選択は「この問題に正解した1人」が行うものなので、
    // コマンドが解決した時点でこのラウンドは終了。次の問題を生成して
    // 全員の回答をロック解除する。
    // （以前は「両方のプレイヤーが回答済みか」を次の問題への条件にしていたが、
    //   正解した1人以外は回答できないよう修正したことで、この条件が
    //   永遠に満たされなくなり、次の問題が配信されなくなってしまう）
    if (!battle.finished) {
        generateQuestion(battle);
        tickDebuffs(player);
        tickDebuffs(enemy);
        result.nextQuestion = battle.currentQuestion;
    }

    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

/**
 * PvP戦（ボス・レイド戦以外）専用のコマンド処理。processCommand() をベースに、
 * 「この問題に正解した1人だけがコマンドを選べる」共有問題方式ではなく、
 * 「行動ゲージが満タンになった本人だけがコマンドを選べる」方式に変えてある。
 * コマンド確定後は、そのプレイヤーの行動ゲージだけをリセットして
 * 待ち時間なしで次の問題を生成する（相手側の独立したゲージには影響しない）。
 */
function processPvpCommand(battle, playerId, command) {
    const player = battle.players[playerId];
    const enemyId = Object.keys(battle.players).find(id => id !== playerId);
    const enemy = battle.players[enemyId];

    if (!player || !enemy) {
        return { error: "Invalid battle state" };
    }

    if (!player.readyForCommand) {
        return { error: "行動ゲージがまだ満タンではありません" };
    }

    let result = {
        playerId,
        playerName: player.name,
        command,
    };

    const attacker = player;
    const defender = enemy;

    const ultimateReady = attacker.ultimateGauge && attacker.ultimateGauge.current >= attacker.ultimateGauge.max;
    const effectiveCommand = (command === 'ultimate' && !ultimateReady) ? 'attack' : command;
    result.command = effectiveCommand;

    if (effectiveCommand === 'defend') {
        attacker.pendingDamageReduction = Math.max(attacker.pendingDamageReduction || 0, 0.5);
        result.defended = true;
        result.damage = 0;
    } else {
        let attackerAtk = (effectiveCommand === 'special') ? (attacker.special || attacker.atk) : attacker.atk;

        if (attacker.hp === 1 && hasUniqueAbility(attacker, 'guts')) {
            attackerAtk = Math.floor(attackerAtk * 3);
            result.gutsAtkBoost = true;
            result.gutsAtkBoostPlayerName = attacker.name;
        }

        let isAttackerSureHit = hasUniqueAbility(attacker, "ignore_evasion");
        let isAttackerIgnoreDef = hasUniqueAbility(attacker, "ignore_def_half");

        const defenderEffectiveDef = getStatWithDebuffs(defender, 'def');
        let damageResult = calculateDamage(attacker, defender, 0, {
            isSureHit: isAttackerSureHit,
            attackerAtk: attackerAtk,
            ignoreDef: isAttackerIgnoreDef,
            defenderDef: defenderEffectiveDef
        });
        let damage = damageResult.damage;

        let ultimateActivated = false;
        if (effectiveCommand === 'ultimate' && ultimateReady) {
            damage = Math.floor(damage * ULTIMATE_DAMAGE_MULTIPLIER);
            ultimateActivated = true;
            result.ultimateActivated = true;
            result.ultimateDamage = damage;
            attacker.ultimateGauge.current = 0;
            result.ultimateGauge = 0;
        }

        damage = applyUniqueAbilityDamageBonus(damage, attacker);

        const dodgeChance = damageResult.dodgeChance;
        const dodgeRoll = Math.random() * 100;
        if (dodgeRoll < dodgeChance) {
            result.damage = 0;
            result.dodged = true;
            result.dodgeChance = dodgeChance;
        } else {
            let finalDamage = applyUniqueAbilityDefense(damage, defender);

            if (defender.hp - finalDamage <= 0 && defender.hp > 1 && hasUniqueAbility(defender, 'guts')) {
                defender.hp = 1;
                result.gutsSurvive = true;
                result.gutsSurvivePlayerName = defender.name;
            } else {
                defender.hp = Math.max(0, defender.hp - finalDamage);
            }
            result.damage = finalDamage;
            result.enemyHp = defender.hp;

            const healAmount = applyLifeDrain(attacker, finalDamage);
            if (healAmount > 0) {
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                result.lifedrainHealed = healAmount;
            }
        }

        if (defender.hp <= 0) {
            battle.finished = true;
            result.winner = playerId;
        }
    }

    // このプレイヤーの行動ゲージだけをリセットし、待ち時間なしで次の問題を生成する
    // （相手側の独立したゲージ・出題サイクルには影響しない）
    if (!battle.finished) {
        player.gaugeCount = 0;
        player.readyForCommand = false;
        player.pendingSkillEffect = null;
        player.pendingUsedSkill = null;
        tickDebuffs(player);
        tickDebuffs(enemy);
        result.nextQuestion = generatePlayerQuestion(battle, playerId);
    }

    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

/**
 * 素早さから「行動ゲージの進みやすさ係数」を求める（ボスのリアルタイムゲージ用）。
 * クライアント側（battle.js）のgetATBGainPerTick()と同じ考え方で、
 * 極端な素早さの差でも0.5倍〜2.0倍の範囲に収まるようにする。
 */
function getATBSpeedFactor(selfSpeed, opponentSpeed) {
    const s = Math.max(1, selfSpeed || 1);
    const o = Math.max(1, opponentSpeed || 1);
    const rawRatio = Math.sqrt(s / o);
    return Math.min(2.0, Math.max(0.5, rawRatio));
}

/**
 * オンラインのレイド（パーティ vs ボス）戦専用の回答処理。
 * PvP用のprocessPlayerAnswer()と同じ考え方：プレイヤーごとに独立した問題・行動ゲージを持つ。
 * ボス自身の攻撃は行動ゲージ（正解数）ではなく、別途サーバー側でリアルタイムに
 * 進行するタイマー（socket/battle.js側）で管理する。
 */
function processRaidPlayerAnswer(battle, playerId, answer, usedSkill) {
    const player = battle.players[playerId];
    const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);
    const boss = battle.players[bossId];

    if (!player || !boss) {
        return { error: "Invalid battle state" };
    }
    if (!player.currentQuestion) {
        return { error: "No active question for this player" };
    }

    const isCorrect = QuestionManager.checkAnswer(player.currentQuestion, answer);
    const answerTime = Date.now() - player.currentQuestion.startTime;

    let result = {
        playerId,
        playerName: player.name,
        isCorrect,
        answerTime,
        question: player.currentQuestion.question,
        skillUsed: null,
        gaugeRequired: player.gaugeRequired
    };

    if (usedSkill && usedSkill.effect) {
        const eff = usedSkill.effect;
        let canApply = true;
        if (eff.condition && eff.condition.type === 'hp_below') {
            if (player.maxHp > 0 && player.hp / player.maxHp > eff.condition.value) {
                canApply = false;
            }
        }
        if (canApply) {
            result.skillUsed = usedSkill;
            applyInstantSkillEffects(player, boss, eff, result);
        } else {
            result.skillFailed = usedSkill.name;
        }
    }

    player.currentQuestion = null;

    if (isCorrect) {
        player.correctAnswers = (player.correctAnswers || 0) + 1;

        const defReduction = Math.floor(getStatWithDebuffs(boss, 'def') * 0.1);
        let chipDamage = Math.max(1, Math.floor(player.atk * 0.5) - defReduction);
        chipDamage = applyUniqueAbilityDamageBonus(chipDamage, player);
        chipDamage = applyUniqueAbilityDefense(chipDamage, boss);
        boss.hp = Math.max(0, boss.hp - chipDamage);
        result.chipDamage = chipDamage;
        result.bossHp = boss.hp;

        if (!player.ultimateGauge) {
            player.ultimateGauge = { current: 0, max: ULTIMATE_GAUGE_MAX };
        }
        player.ultimateGauge.current = Math.min(player.ultimateGauge.max, player.ultimateGauge.current + 10);
        result.ultimateGauge = player.ultimateGauge.current;
        result.ultimateReady = player.ultimateGauge.current >= player.ultimateGauge.max;

        if (boss.hp <= 0) {
            battle.finished = true;
            result.winner = 'party';
            result.raidVictory = true;
            return {
                ...result,
                battleState: { players: battle.players, finished: battle.finished }
            };
        }

        player.gaugeCount = (player.gaugeCount || 0) + 1;
        result.gaugeCount = player.gaugeCount;

        if (player.gaugeCount >= player.gaugeRequired) {
            player.readyForCommand = true;
            player.pendingSkillEffect = usedSkill && usedSkill.effect ? usedSkill.effect : null;
            player.pendingUsedSkill = usedSkill || null;
            result.showCommandMenu = true;
            result.gaugeFull = true;
        } else {
            result.nextQuestion = generatePlayerQuestion(battle, playerId);
        }
    } else {
        result.gaugeCount = player.gaugeCount || 0;
        result.nextQuestion = generatePlayerQuestion(battle, playerId);
    }

    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

/**
 * オンラインのレイド戦専用のコマンド処理（対象は常にボス）。processPvpCommand()と同じ考え方。
 */
function processRaidPlayerCommand(battle, playerId, command) {
    const player = battle.players[playerId];
    const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);
    const boss = battle.players[bossId];

    if (!player || !boss) {
        return { error: "Invalid battle state" };
    }
    if (!player.readyForCommand) {
        return { error: "行動ゲージがまだ満タンではありません" };
    }

    let result = { playerId, playerName: player.name, command };

    const attacker = player;
    const defender = boss;

    const ultimateReady = attacker.ultimateGauge && attacker.ultimateGauge.current >= attacker.ultimateGauge.max;
    const effectiveCommand = (command === 'ultimate' && !ultimateReady) ? 'attack' : command;
    result.command = effectiveCommand;

    if (effectiveCommand === 'defend') {
        attacker.pendingDamageReduction = Math.max(attacker.pendingDamageReduction || 0, 0.5);
        result.defended = true;
        result.damage = 0;
    } else {
        let attackerAtk = (effectiveCommand === 'special') ? (attacker.special || attacker.atk) : attacker.atk;

        if (attacker.hp === 1 && hasUniqueAbility(attacker, 'guts')) {
            attackerAtk = Math.floor(attackerAtk * 3);
            result.gutsAtkBoost = true;
            result.gutsAtkBoostPlayerName = attacker.name;
        }

        let isAttackerSureHit = hasUniqueAbility(attacker, "ignore_evasion");
        let isAttackerIgnoreDef = hasUniqueAbility(attacker, "ignore_def_half");

        const defenderEffectiveDef = getStatWithDebuffs(defender, 'def');
        let damageResult = calculateDamage(attacker, defender, 0, {
            isSureHit: isAttackerSureHit,
            attackerAtk: attackerAtk,
            ignoreDef: isAttackerIgnoreDef,
            defenderDef: defenderEffectiveDef
        });
        let damage = damageResult.damage;

        if (effectiveCommand === 'ultimate' && ultimateReady) {
            damage = Math.floor(damage * ULTIMATE_DAMAGE_MULTIPLIER);
            result.ultimateActivated = true;
            result.ultimateDamage = damage;
            attacker.ultimateGauge.current = 0;
            result.ultimateGauge = 0;
        }

        damage = applyUniqueAbilityDamageBonus(damage, attacker);
        const dodgeChance = damageResult.dodgeChance;
        const dodgeRoll = Math.random() * 100;
        if (dodgeRoll < dodgeChance) {
            result.damage = 0;
            result.dodged = true;
            result.dodgeChance = dodgeChance;
        } else {
            let finalDamage = applyUniqueAbilityDefense(damage, defender);
            defender.hp = Math.max(0, defender.hp - finalDamage);
            result.damage = finalDamage;
            result.bossHp = defender.hp;

            const healAmount = applyLifeDrain(attacker, finalDamage);
            if (healAmount > 0) {
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                result.lifedrainHealed = healAmount;
            }
        }

        if (defender.hp <= 0) {
            battle.finished = true;
            result.winner = 'party';
            result.raidVictory = true;
        }
    }

    if (!battle.finished) {
        player.gaugeCount = 0;
        player.readyForCommand = false;
        player.pendingSkillEffect = null;
        player.pendingUsedSkill = null;
        tickDebuffs(player);
        result.nextQuestion = generatePlayerQuestion(battle, playerId);
    }

    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

/**
 * レイド戦のボスが、自身のリアルタイムゲージが満タンになった時に実行する攻撃。
 * クライアントのローカル戦にあるresolveBossAttack()と同じ考え方：
 * ボススキルを一定確率で使用し、ガード成功時はダメージ80%カット。
 * 対象（targetPlayerId）と、ガードが間に合ったか（guardActivated）は
 * 呼び出し側（socket/battle.js のタイマー処理）が決める。
 */
function resolveRaidBossAttack(battle, targetPlayerId, guardActivated) {
    const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);
    const boss = battle.players[bossId];
    const player = battle.players[targetPlayerId];

    if (!boss || !player) {
        return { error: "Invalid battle state" };
    }

    let result = { targetPlayerId, playerName: player.name };

    const bossAtkWithBuffs = getStatWithBuffs(boss, 'atk');
    const damageResult = calculateDamage(boss, player, 0, {
        attackerAtk: bossAtkWithBuffs,
        defenderDef: getStatWithDebuffs(player, 'def')
    });
    let damage = damageResult.damage;

    let bossUsedSkill = null;
    if (boss.skills && boss.skills.length > 0 && Math.random() < 0.5) {
        bossUsedSkill = boss.skills[Math.floor(Math.random() * boss.skills.length)];
        damage = applyBossSkillEffect(damage, boss, player, bossUsedSkill, result);
    }

    if (guardActivated) {
        damage = Math.floor(damage * 0.2);
        result.guarded = true;
    }

    let finalDamage = applyUniqueAbilityDefense(damage, player);
    if (player.hp - finalDamage <= 0 && player.hp > 1 && hasUniqueAbility(player, 'guts')) {
        player.hp = 1;
        result.gutsSurvive = true;
        result.gutsSurvivePlayerName = player.name;
    } else {
        player.hp = Math.max(0, player.hp - finalDamage);
    }
    result.damage = finalDamage;
    result.playerHp = player.hp;

    if (player.hp <= 0) {
        result.playerDown = true;
        const anyoneAlive = Object.values(battle.players).some(p => !p.isBoss && p.hp > 0);
        if (!anyoneAlive) {
            battle.finished = true;
            result.winner = bossId;
            result.raidDefeat = true;
        }
    }

    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

module.exports = {
    generateQuestion,
    generatePlayerQuestion,
    getRequiredCorrectCount,
    getATBSpeedFactor,
    calculateDamage,
    processAnswer,
    processRaidAnswer,
    processRaidPlayerAnswer,
    processRaidPlayerCommand,
    resolveRaidBossAttack,
    processAnswerOnly,
    processPlayerAnswer,
    processCommand,
    processPvpCommand,
    initializeBattle,
    finalizeBattle
};
