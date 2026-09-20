const STAT_KEYS = ["maxHp", "atk", "def", "speed", "special"];
const STAT_LABELS = {
    maxHp: "HP", atk: I18N.atk, def: I18N.def, speed: I18N.speed, special: "特殊"
};
const TOTAL_STAT_POINTS = 250;
const MIN_STAT = 10;
const DEFAULT_STATS = { maxHp: 50, atk: 70, def: 50, speed: 30, special: 50 };

/**
 * 学年の数値（1〜12。1〜6=小学、7〜9=中学、10〜12=高校）を「中学3年」等の
 * わかりやすい表示ラベルに変換する。学年入力欄が単なる1〜12の数値だったため、
 * 「中学3年のつもりで3と入力して小学3年の問題になってしまう」といった
 * 混乱が起きていたことがある（入力欄自体はプルダウン化して解消済みだが、
 * 既存キャラクターの表示やログでも分かりやすくするためのヘルパー）。
 * @param {number} grade - 1〜12の学年値
 * @returns {string} 例: "中学3年"
 */
function getGradeLabel(grade) {
    const g = Math.max(1, Math.min(12, Math.floor(Number(grade) || 1)));
    if (g <= 6) return `小学${g}年`;
    if (g <= 9) return `中学${g - 6}年`;
    return `高校${g - 9}年`;
}

// 【転生機能は廃止】
// 過去の転生で得た永続ボーナス（player.prestigeBonusPercent）と転生回数（player.prestigeCount）は、
// 既存プレイヤーの強さが下がらないよう、そのまま有効にしている（新たに増やす手段は無い）。
// 累積ボーナス％の上限（基礎値への加算量の計算に使う）。
const PRESTIGE_BONUS_PERCENT_CAP = 300;

function getSubjectDisplayName(subject) {
    const subjectNames = {
        'math': '算数・数学',
        'jp': '国語',
        'english': '英語',
        'eng': '英語',
        'science': '理科',
        'sci': '理科',
        'social': '社会',
        'soc': '社会'
    };
    return subjectNames[subject] || subject;
}

function sumStats(stats) {
    return STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
}

function validateStatAllocation(stats) {
    for (const key of STAT_KEYS) {
        const value = stats[key];
        if (!Number.isFinite(value) || value !== Math.floor(value) || value < MIN_STAT) {
            return { ok: false, message: I18N.statMinError.replace("{min}", MIN_STAT) };
        }
    }
    const total = sumStats(stats);
    if (total !== TOTAL_STAT_POINTS) {
        return { ok: false, message: I18N.statTotalError.replace("{total}", TOTAL_STAT_POINTS).replace("{current}", total) };
    }
    return { ok: true };
}

function generatePlayerId() {
    // 6桁の英大文字と数字で構成されるIDを生成
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function isValidPlayerId(id) {
    // IDが6文字の英大文字と数字で構成されているかチェック
    if (!id || typeof id !== 'string' || id.length !== 6) {
        return false;
    }
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (const char of id) {
        if (!validChars.includes(char)) {
            return false;
        }
    }
    return true;
}

function migratePlayer(player) {
    if (!player) return null;

    // プレイヤーID機能追加前に作られたデータなどはidが無い/不正な場合がある。
    // その場合だけ新規IDを発行する（既存の有効なIDは絶対に上書きしない）。
    const needsNewId = !(player.id && isValidPlayerId(player.id));

    // Create a mutable copy and ensure all essential properties are present with defaults
    const migratedPlayer = {
        ...player, // Start with existing player data
        id: needsNewId ? generatePlayerId() : player.id, // Validate or regenerate ID
        name: player.name || "無名",
        xp: player.xp || 0,
        level: player.level || calcLevel(player.xp || 0), // Recalculate level based on XP if missing
        coins: player.coins == null ? 0 : player.coins,
        weapons: player.weapons || [],
        equippedWeapon: player.equippedWeapon || null,
        weaponWins: player.weaponWins || {},
        orbs: player.orbs || [],
        skillTree: player.skillTree || { unlockedNodes: [], availablePoints: 0 },
        skillSlots: player.skillSlots || [null, null, null],
        customSkills: player.customSkills || [],
        bossDefeats: player.bossDefeats || {},
        dungeonClears: player.dungeonClears || {},
        materials: player.materials || {}, // Will be handled below for array migration
        pvpWins: player.pvpWins || 0,
        bossRunCount: player.bossRunCount || 0,
        totalStudySeconds: player.totalStudySeconds || 0,
        grade: player.grade || 1,
        prestigeCount: player.prestigeCount || 0, // 転生（旧プレステージ）実行回数
        // 転生による永続ボーナス％の累積値。旧・固定5%方式で保存されていたデータ
        // （prestigeBonusPercentが無い）は、回数×5%として引き継ぐ。
        prestigeBonusPercent: player.prestigeBonusPercent != null
            ? player.prestigeBonusPercent
            : (player.prestigeCount || 0) * 5,
        lastLoginDate: player.lastLoginDate || null, // ログインボーナス：最後にボーナスを受け取った日付
        loginStreak: player.loginStreak || 0, // ログインボーナス：連続ログイン日数
        // プレイヤーが作成した問題リスト（模擬戦闘で使用）。
        questionLists: player.questionLists || [],
        // オーブ工房の結晶（混沌/神聖/刻印）。古いデータには無いので0で初期化する。
        craftCurrency: player.craftCurrency || { chaos: 0, divine: 0, imprint: 0 },
        // Core stats (maxHp, atk, def, speed) will be set below
        maxHp: player.maxHp, // Keep existing if present, otherwise default below
        atk: player.atk,
        def: player.def,
        speed: player.speed,
        hp: player.hp // Current HP, will be clamped by maxHp later
    };

    // Apply skill data initialization if function exists
    if (typeof initializeSkillData === 'function') {
        Object.assign(migratedPlayer, initializeSkillData(migratedPlayer));
    }

    // 限界突破素材は { materialId: 個数 } の辞書形式で管理する。
    // 過去バージョンで配列形式 [{id, name, count}, ...] として保存されたデータがあれば辞書形式に変換する。
    (migratedPlayer.weapons || []).forEach(w => {
        if (w.isOriginal && !w.sourceBossId) {
            if (w.originalLimitBreakLevel == null) {
                w.originalLimitBreakLevel = 0;
            }
            // weapons.jsで定義した定数を参照できないため、直接値を記述
            w.maxOriginalLimitBreak = 16;
            // Ensure baseMultiplier is set for original weapons if missing
            if (w.baseMultiplier == null) w.baseMultiplier = ORIGINAL_WEAPON_BASE_MULTIPLIER;
        }
    });

    // Handle old material array format
    if (Array.isArray(migratedPlayer.materials)) {
        const materialsDict = {};
        migratedPlayer.materials.forEach(m => {
            if (m && m.id) {
                materialsDict[m.id] = (materialsDict[m.id] || 0) + (m.count || 0);
            }
        });
        migratedPlayer.materials = materialsDict;
    } else if (!migratedPlayer.materials) {
        migratedPlayer.materials = {};
    }

    // Determine core stats (maxHp, atk, def, speed)
    if (migratedPlayer.subjects && typeof calcStatsFromSubjects === "function") {
        const derived = calcStatsFromSubjects(migratedPlayer.subjects);
        migratedPlayer.maxHp = derived.maxHp;
        migratedPlayer.atk = derived.atk;
        migratedPlayer.def = derived.def;
        migratedPlayer.speed = derived.speed; // Corrected from 'sp'
    } else {
        // If no subjects, ensure core stats have defaults
        migratedPlayer.maxHp = migratedPlayer.maxHp != null ? migratedPlayer.maxHp : DEFAULT_STATS.maxHp;
        migratedPlayer.atk = migratedPlayer.atk != null ? migratedPlayer.atk : DEFAULT_STATS.atk;
        migratedPlayer.def = migratedPlayer.def != null ? migratedPlayer.def : DEFAULT_STATS.def;
        migratedPlayer.speed = migratedPlayer.speed != null ? migratedPlayer.speed : DEFAULT_STATS.speed;
    }
    
    // Ensure current HP is not greater than max HP
    migratedPlayer.hp = migratedPlayer.hp != null ? Math.min(migratedPlayer.hp, migratedPlayer.maxHp) : migratedPlayer.maxHp;

    // 新しくIDを発行した場合は、その場でlocalStorageに保存して確定させる。
    // こうしないと、migratePlayerが呼ばれるたびに毎回別のランダムIDが
    // 生成されてしまい（＝IDがコロコロ変わってしまい）、
    // サーバー保存や引き継ぎのIDが一致しなくなるバグの原因になる。
    if (needsNewId && typeof localStorage !== "undefined") {
        try {
            localStorage.setItem("player", JSON.stringify(migratedPlayer));
        } catch (e) {
            console.error("[Stats] Failed to persist newly generated player ID:", e);
        }
    }

    return migratedPlayer;
}

function calcStatsFromSubjects(s) {
    const { jp, math, eng, sci, soc } = s;
    return {
        maxHp: Math.max(50, Math.floor(100 + (jp - 50) * 4 + (soc - 50) * 2)),
        atk: Math.max(20, Math.floor(50 + (math - 50) * 5 + (sci - 50) * 2)),
        def: Math.max(20, Math.floor(50 + (soc - 50) * 5 + (jp - 50) * 2)),
        speed: Math.max(20, Math.floor(50 + (eng - 50) * 3 + (math - 50) * 2))
    };
}

function xpToNextLevel(l) { return Math.max(40, l * 50); }
function calcLevel(xp) {
    // 元の反復計算は、非常に大きなXP値に対して遅くなる可能性があり、UIがフリーズする原因となっていました。
    // レベルアップの公式から導出した閉形式解に置き換えます。
    // レベルLに到達するための合計XPは 25 * L * (L - 1) です。
    // これを L について解きます: 25L^2 - 25L - xp = 0
    // 二次方程式の解の公式を使用: L = (-b + sqrt(b^2 - 4ac)) / 2a
    // a=25, b=-25, c=-xp
    const level = Math.floor((25 + Math.sqrt(625 + 100 * xp)) / 50);

    // xpが0の場合、levelは1になります。xpが49の場合、levelは1です。xpが50の場合、levelは2になります。
    // 浮動小数点数の問題で負の値にならないように、最低でも1を返すようにします。
    return Math.max(1, level);
}
// 転生ボーナス％を「基礎値への一律加算量」に変換する。
// 基準は初期振り分け（250点を5ステータスで割った50）を単位とし、
// ボーナス100%ごとに各ステータス+50する緩やかな加算とする。
// 乗算ではないため、武器・スキル・勉強でどれだけ基礎値を伸ばしても
// 転生ボーナス自体の重みが相対的に薄れも膨れもしない。
function getPrestigeBonusFlatAmount(player) {
    const bonusPercent = Math.min(PRESTIGE_BONUS_PERCENT_CAP, (player && player.prestigeBonusPercent) || 0);
    if (bonusPercent <= 0) return 0;
    return Math.floor((bonusPercent / 100) * (TOTAL_STAT_POINTS / STAT_KEYS.length));
}

function calcStudyXp(s) { return Math.floor(s / 4); }

// 勉強で得られるステータス成長量。
// 以前は時間だけで決まる固定値だったため、転生ボーナス（永続・乗算）や
// 武器強化で基礎値がどんどん伸びていく後半になるほど、勉強で増える分の
// 「相対的な価値」が薄れてしまっていた。
// レベルと転生回数（＝今の強さ）に応じて成長量自体を緩やかに引き上げることで、
// 育成が進んでも勉強し続ける意味が残るようにする。
function calcStatGain(s, player) {
    const base = Math.max(1, Math.floor(s / 60));
    if (!player) return base;
    const level = player.level || calcLevel(player.xp || 0);
    const prestigeCount = player.prestigeCount || 0;
    const growthMultiplier = 1 + Math.floor(level / 10) * 0.1 + prestigeCount * 0.15;
    return Math.max(base, Math.floor(base * growthMultiplier));
}
function calcBattleXp(won, turns, damage) { const base = won ? 40 : 15; return base + Math.floor(turns * 3) + Math.floor(damage / 10); }

function applyBattleRewards(won, turns, damage, options = {}) {
    // 報酬が既に適用されているかチェック
    if (localStorage.getItem("rewardsApplied") === "true") {
        console.log(`[Stats] Rewards already applied, skipping`);
        const raw = localStorage.getItem("player");
        return raw ? JSON.parse(raw) : null;
    }

    const raw = localStorage.getItem("player");
    if (!raw) {
        console.error("[Stats] applyBattleRewards failed: 'player' not found in localStorage.");
        return null;
    }
    // 新しい報酬データを保存するためのオブジェクトを初期化
    localStorage.setItem('battleResultData', JSON.stringify({}));

    let player = migratePlayer(JSON.parse(raw));
    const stats = getStatsFromPlayer(player);
    const gainedXp = calcBattleXp(won, turns, damage);
    let gainedCoins = 0;
    const isBossBattle = localStorage.getItem("isBossBattle") === "true";
    const isBotBattle = localStorage.getItem("isBotBattle") === "true";

    // ボス戦は勝敗にかかわらず「周回」としてカウントする
    if (isBossBattle) {
        player.bossRunCount = (player.bossRunCount || 0) + 1;
    }
    // 対人戦（ボット戦・ボス戦以外）に勝利した場合はランキング用の勝利数を加算する
    if (won && !isBossBattle && !isBotBattle) {
        player.pvpWins = (player.pvpWins || 0) + 1;
    }

    console.log(`[Stats] applyBattleRewards START: won=${won}, equippedWeapon=${player.equippedWeapon?.name}, weaponWins=${JSON.stringify(player.weaponWins)}`);

    let droppedOrb = null;

    if (won) {
        // Boss battle rewards are handled separately
        if (isBossBattle && options.enemy) {
            // Ensure difficulty is present on the enemy object for reward logic
            if (!options.enemy.difficulty) {
                const savedDifficulty = localStorage.getItem("battleDifficulty");
                if (savedDifficulty) options.enemy.difficulty = savedDifficulty;
                console.log(`[Stats] Restored difficulty '${savedDifficulty}' for boss rewards.`);
            }
            if (typeof applyBossRewards === 'function') {
                player = applyBossRewards(player, options.enemy);
            }
        }
        
        // デイリーミッションの進捗を更新
        if (typeof updateMissionProgress === 'function') {
            console.log(`[Stats] Updating mission progress: isBossBattle=${isBossBattle}, isBotBattle=${isBotBattle}, won=${won}`);
            if (isBossBattle && options.enemy) {
                console.log(`[Stats] Calling updateMissionProgress for defeat_boss with bossId=${options.enemy.id}, difficulty=${options.enemy.difficulty}`);
                updateMissionProgress('defeat_boss', { bossId: options.enemy.id, difficulty: options.enemy.difficulty });
            } else if (isBotBattle) {
                console.log(`[Stats] Calling updateMissionProgress for win_bot`);
                updateMissionProgress('win_bot');
            } else {
                console.log(`[Stats] Calling updateMissionProgress for win_online`);
                updateMissionProgress('win_online');
            }
        }

        gainedCoins += COIN_BATTLE_WIN;
        console.log(`[Stats] Calling incrementWeaponWin for weapon: ${player.equippedWeapon?.name} (type: ${player.equippedWeapon?.type})`);
        player = incrementWeaponWin(player);
        console.log(`[Stats] After incrementWeaponWin: weaponWins=${JSON.stringify(player.weaponWins)}`);
        if (options.stolenWeapon) {
            player = addWeaponToPlayer(player, options.stolenWeapon);
        }
        
        // オーブドロップ判定（戦闘勝利時）
        if (typeof rollOrbDrop === "function") {
            droppedOrb = rollOrbDrop();
        }
        
        // 素材ドロップ判定（モンスター戦勝利時）
        const droppedMaterial = localStorage.getItem("droppedMaterial");
        if (droppedMaterial) {
            player.materials = player.materials || {};
            player.materials[droppedMaterial] = (player.materials[droppedMaterial] || 0) + 1;
            // ミッション進捗更新（素材収集ミッション）
            if (typeof updateMissionProgress === 'function') {
                updateMissionProgress('collect_material', { materialId: droppedMaterial, count: 1 });
            }
            console.log(`[Stats] Material dropped: ${droppedMaterial}, total: ${player.materials[droppedMaterial]}`);
            localStorage.removeItem("droppedMaterial");
        }
    }
    if (options.lostWeapon) {
        player = removeWeaponFromPlayer(player, options.lostWeapon.id);
    }

    const oldLevel = player.level || calcLevel(player.xp || 0);
    const newXp = (player.xp || 0) + gainedXp;
    const newLevel = calcLevel(newXp);

    if (newLevel > oldLevel && typeof addSkillPointsOnLevelUp === 'function') {
        player = addSkillPointsOnLevelUp(player, oldLevel, newLevel);
        if (typeof updateMissionProgress === 'function') {
            updateMissionProgress('level_up', newLevel - oldLevel);
        }
        alert(`レベルアップ！ Lv${newLevel}\nスキルポイントを ${ (newLevel - oldLevel) * SKILL_POINTS_PER_LEVEL } 獲得しました！`);
    }

    // updateMissionProgress()はここより前の時点でlocalStorageへ直接read-modify-writeを
    // 行っている（player.dailyMissionsの進捗更新）。しかしこの関数はその前に読み込んだ
    // 古いplayerオブジェクトを保持し続けているため、そのままdailyMissionsを使って
    // 最後に保存すると、たった今保存された進捗更新を上書きして消してしまう。
    // そのため保存直前に最新のdailyMissions・dungeonItems・dungeonCheckpointだけを
    // 読み直す（dungeonItems/dungeonCheckpointも同様に、buildPlayer()の呼び出しに
    // 渡し忘れていたため、バトル終了のたびにチケット類とチェックポイントが
    // 消えてしまう不具合があった）。
    const latestRaw = localStorage.getItem("player");
    const latestSnapshot = latestRaw ? JSON.parse(latestRaw) : null;
    const latestDailyMissions = latestSnapshot ? latestSnapshot.dailyMissions : player.dailyMissions;
    const latestDungeonItems = latestSnapshot ? latestSnapshot.dungeonItems : player.dungeonItems;
    const latestDungeonCheckpoint = latestSnapshot ? latestSnapshot.dungeonCheckpoint : player.dungeonCheckpoint;
    const latestQuestionLists = latestSnapshot ? latestSnapshot.questionLists : player.questionLists;

    const updated = buildPlayer(player.name, stats, newXp, {
        hp: player.hp,
        totalStudySeconds: player.totalStudySeconds || 0,
        id: player.id,
        coins: (player.coins || 0) + gainedCoins,
        weapons: player.weapons,
        equippedWeapon: player.equippedWeapon,
        weaponWins: player.weaponWins,
        orbs: player.orbs || [],
        grade: player.grade,
        skillTree: player.skillTree,
        skillSlots: player.skillSlots,
        customSkills: player.customSkills,
        bossDefeats: player.bossDefeats || {},
        dungeonClears: player.dungeonClears || {},
        materials: player.materials || {},
        dungeonItems: latestDungeonItems || [],
        dungeonCheckpoint: latestDungeonCheckpoint || 0,
        pvpWins: player.pvpWins || 0,
        bossRunCount: player.bossRunCount || 0,
        dailyMissions: latestDailyMissions,
        special: player.special,
        prestigeCount: player.prestigeCount,
        prestigeBonusPercent: player.prestigeBonusPercent,
        lastLoginDate: player.lastLoginDate,
        loginStreak: player.loginStreak,
        questionLists: latestQuestionLists || [],
        craftCurrency: player.craftCurrency
    });

    // オーブを追加
    if (droppedOrb) {
        if (!updated.orbs) updated.orbs = [];
        updated.orbs.push(droppedOrb);
    }

    localStorage.setItem("player", JSON.stringify(updated));
    localStorage.setItem("battleXpGain", String(gainedXp));
    localStorage.setItem("battleCoinGain", String(gainedCoins));
    localStorage.setItem("rewardsApplied", "true"); // 報酬適用フラグを設定
    
    if (droppedOrb) {
        localStorage.setItem("droppedOrb", JSON.stringify(droppedOrb));
    } else {
        localStorage.removeItem("droppedOrb");
    }
    
    console.log(`[Stats] applyBattleRewards END: Player saved with weaponWins:`, updated.weaponWins);
    console.log(`[Stats] Saved player data:`, JSON.stringify(updated));
    return updated;
}

function getStatsFromPlayer(player, withPassives = false) {
    const p = player || {};
    let result;

    // Apply passives only if requested, the function exists, and the player object has a skill tree.
    if (withPassives && typeof getSkillNodeEffects === 'function' && p.skillTree) {
        const baseStats = {
            maxHp: Number(p.maxHp) || DEFAULT_STATS.maxHp,
            atk: Number(p.atk) || DEFAULT_STATS.atk,
            def: Number(p.def) || DEFAULT_STATS.def,
            speed: Number(p.speed) || DEFAULT_STATS.speed,
            special: Number(p.special) || DEFAULT_STATS.special,
            grade: Number(p.grade) || 1
        };

        const skillEffects = getSkillNodeEffects(p);
        const passive = skillEffects.passive;

        // Apply flat bonuses first, then percentage bonuses
        baseStats.maxHp = Math.floor((baseStats.maxHp + (passive.maxHp || 0)) * (1 + (passive.maxHpPercent || 0)));
        baseStats.atk = Math.floor((baseStats.atk + (passive.atk || 0)) * (1 + (passive.atkPercent || 0)));
        baseStats.def = Math.floor((baseStats.def + (passive.def || 0)) * (1 + (passive.defPercent || 0)));
        baseStats.speed = Math.floor((baseStats.speed + (passive.speed || 0)) * (1 + (passive.speedPercent || 0)));
        baseStats.special = Math.floor((baseStats.special + (passive.special || 0)) * (1 + (passive.specialPercent || 0)));
        // クリティカル関連のスキルツリー効果（クリティカルルート）を引き継ぐ
        baseStats.critChance = passive.critChance || 0;
        baseStats.critMultiplier = passive.critMultiplier || 0;

        // プレステージ（転生）による永続ボーナス（コアステータス一律倍率）を適用する。
        // 重要: この倍率は withPassives=true（＝バトルや画面表示用の「実効ステータス」を
        // 求めている）の場合にのみ適用し、生の値（result）自体を書き換えない。
        // 以前はwithPassivesの真偽に関係なく常にここで倍率をかけていたため、
        // 「素のステータスを取り出して微増させ、そのままplayer.atk等として保存し直す」
        // 系の呼び出し（バトル後・勉強タイマー後のステータス反映処理）でも
        // 倍率適用後の値がそのまま新しい「素の」ステータスとして保存されてしまい、
        // 次にステータスを取得する際にまた同じ倍率がかかる……という具合に、
        // バトルや勉強、あるいはページ再読み込み後の再計算のたびに転生ボーナスが
        // 二重・三重に重ねがけされていく不具合の原因になっていた。
        const prestigeFlatBonus = getPrestigeBonusFlatAmount(p);
        if (prestigeFlatBonus > 0) {
            baseStats.maxHp += prestigeFlatBonus;
            baseStats.atk += prestigeFlatBonus;
            baseStats.def += prestigeFlatBonus;
            baseStats.speed += prestigeFlatBonus;
            baseStats.special += prestigeFlatBonus;
        }

        result = baseStats;
    } else {
        // Raw stats without passives（保存用の「素の」ステータス。転生ボーナスは含めない）
        result = {
            maxHp: Number(p.maxHp) || DEFAULT_STATS.maxHp,
            atk: Number(p.atk) || DEFAULT_STATS.atk,
            def: Number(p.def) || DEFAULT_STATS.def,
            speed: Number(p.speed) || DEFAULT_STATS.speed,
            special: Number(p.special) || DEFAULT_STATS.special,
            grade: Number(p.grade) || 1,
            critChance: 0,
            critMultiplier: 0
        };
    }

    return result;
}

function getEffectiveStats(player) {
    // Get base stats with passive skills applied
    const statsWithSkills = getStatsFromPlayer(player, true);
    // Apply weapon bonuses
    return applyWeaponStats(statsWithSkills, player.equippedWeapon);
}

function getBattleStats(player) {
    return getEffectiveStats(player);
}

function buildPlayer(name, stats, xp, options = {}) {
    const lv = calcLevel(xp || 0);
    const maxHp = stats.maxHp;
    const hp = options.hp != null ? Math.min(options.hp, maxHp) : maxHp;
    return {
        id: options.id || generatePlayerId(),
        name,
        xp: xp || 0,
        level: lv,
        maxHp,
        hp,
        atk: stats.atk,
        def: stats.def,
        speed: stats.speed,
        special: stats.special != null ? stats.special : (options.special != null ? options.special : Math.floor(stats.atk * 0.6)),
        grade: options.grade || stats.grade || 1,
        totalStudySeconds: options.totalStudySeconds || 0,
        coins: options.coins != null ? options.coins : 0,
        weapons: options.weapons || [],
        equippedWeapon: options.equippedWeapon || null,
        weaponWins: options.weaponWins || {},
        orbs: options.orbs || [],
        skillTree: options.skillTree || { unlockedNodes: [], availablePoints: 0 },
        skillSlots: options.skillSlots || [null, null, null],
        customSkills: options.customSkills || [],
        bossDefeats: options.bossDefeats || {},
        dungeonClears: options.dungeonClears || {},
        materials: options.materials || {},
        // 以前はここに無く、キャラ作成・転生（createCharacter経由）のたびに
        // ダンジョン報酬チケット（オーブスロット拡張・ステータス再分配・武器合成等）が
        // 静かに失われていた。dailyMissionsと同様にここで明示的に引き継ぐ。
        dungeonItems: options.dungeonItems || [],
        // ダンジョンのチェックポイント（到達済みの最深部）も、上と同じ理由で
        // ここに無いと勉強終了・バトル終了のたびに0にリセットされてしまっていた。
        dungeonCheckpoint: options.dungeonCheckpoint || 0,
        pvpWins: options.pvpWins || 0,
        bossRunCount: options.bossRunCount || 0,
        // 以前はここに無く、対戦・勉強・キャラ編集のたびにこのフィールドが
        // 静かに失われていた（デイリーミッションが毎回リセットされる不具合の原因）。
        dailyMissions: options.dailyMissions !== undefined ? options.dailyMissions : null,
        prestigeCount: options.prestigeCount || 0,
        prestigeBonusPercent: options.prestigeBonusPercent || 0,
        lastLoginDate: options.lastLoginDate !== undefined ? options.lastLoginDate : null,
        loginStreak: options.loginStreak || 0,
        // プレイヤーが作成した問題リスト（模擬戦闘で使用）。他のダンジョンアイテム類と
        // 同様、options経由で明示的に渡さないと呼び出しのたびに消えてしまうため注意。
        questionLists: options.questionLists || [],
        // オーブ工房の結晶（勉強時間で貯まる）。他のフィールドと同様、options経由で
        // 明示的に渡さないと呼び出しのたびに0へ戻ってしまうため注意（全呼び出し箇所で引き継ぐこと）。
        craftCurrency: options.craftCurrency || { chaos: 0, divine: 0, imprint: 0 }
    };
}

function formatTime(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":"); }

function getPlayerData() {
    const raw = localStorage.getItem("player");
    if (!raw) return null;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        console.error("[Stats] プレイヤーデータのJSON解析に失敗しました:", e);
        return null;
    }
    // migratePlayer()が例外を投げても、保存データ自体は壊れていないので
    // nullを返して「データが消えた」ように見せない（script.js側のgetPlayerData()と同じ方針）。
    try {
        return migratePlayer(parsed);
    } catch (e) {
        console.error("[Stats] migratePlayer()の実行中にエラーが発生しました。変換前のデータをそのまま返します:", e);
        return parsed;
    }
}
