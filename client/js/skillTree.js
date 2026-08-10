// ============================================
// スキルツリーシステム
// Path of Exile style extensive skill trees
// ============================================

// スキルポイント獲得量（レベルアップごと）
const SKILL_POINTS_PER_LEVEL = 2;

// 統合された単一のスキルツリー定義
const SKILL_TREE = {
        name: "総合スキルツリー",
        description: "防御と攻撃のバランスを重視したスキルツリー",
        nodes: [
            // 基礎ステータスノード
            // --- 中央エリア (開始地点) ---
            { id: "start_node", name: "始まりの力", description: "全ての基礎ステータス+5", cost: 0, x: 0, y: 0, type: "stat", effect: { maxHp: 5, atk: 5, def: 5, speed: 5 } },
            { id: "core_atk_1", name: "攻撃+", description: "攻撃+5", cost: 1, x: -1, y: 0, requires: "start_node", type: "stat", effect: { atk: 5 } },
            { id: "core_def_1", name: "防御+", description: "防御+5", cost: 1, x: 1, y: 0, requires: "start_node", type: "stat", effect: { def: 5 } },
            { id: "core_hp_1", name: "体力+", description: "HP+10", cost: 1, x: 0, y: -1, requires: "start_node", type: "stat", effect: { maxHp: 10 } },
            { id: "core_speed_1", name: "速さ+", description: "速さ+5", cost: 1, x: 0, y: 1, requires: "start_node", type: "stat", effect: { speed: 5 } },

            // --- 左上: 攻撃・大剣ルート ---
            { id: "atk_path_1", name: "攻撃II", description: "攻撃+10", cost: 2, x: -3, y: -1, requires: "core_atk_1", type: "stat", effect: { atk: 10 } },
            { id: "atk_path_2", name: "攻撃III", description: "攻撃+15", cost: 2, x: -5, y: -2, requires: "atk_path_1", type: "stat", effect: { atk: 15 } },
            { id: "gs_power_1", name: "剛力", description: "攻撃+10, HP+5", cost: 3, x: -7, y: -3, requires: "atk_path_2", type: "stat", effect: { atk: 10, maxHp: 5 } },
            { id: "gs_cleave", name: "クリーブ", description: "次の攻撃のダメージ1.4倍、ただし自身の防御-10", cost: 4, x: -9, y: -4, requires: "gs_power_1", type: "active", effect: { damageMultiplier: 1.4, selfDefDebuff: 10 } },
            { id: "atk_mastery", name: "攻撃の極意", description: "常時攻撃+10%", cost: 5, x: -7, y: -5, requires: "gs_power_1", type: "passive", effect: { atkPercent: 0.1 } },
            { id: "atk_path_3", name: "速さ+", description: "速さ+5", cost: 1, x: -4, y: 0, requires: "atk_path_1", type: "stat", effect: { speed: 5 } },

            // --- 右上: 防御・盾ルート ---
            { id: "def_path_1", name: "防御II", description: "防御+10", cost: 2, x: 3, y: -1, requires: "core_def_1", type: "stat", effect: { def: 10 } },
            { id: "def_path_2", name: "防御III", description: "防御+15", cost: 2, x: 5, y: -2, requires: "def_path_1", type: "stat", effect: { def: 15 } },
            { id: "ss_tough_1", name: "不屈", description: "防御+10, HP+10", cost: 3, x: 7, y: -3, requires: "def_path_2", type: "stat", effect: { def: 10, maxHp: 10 } },
            { id: "ss_guard_stance", name: "ガードスタンス", description: "次に受けるダメージを30%軽減", cost: 4, x: 9, y: -4, requires: "ss_tough_1", type: "active", effect: { damageReduction: 0.3 } },
            { id: "def_mastery", name: "防御の極意", description: "常時防御+10%", cost: 5, x: 7, y: -5, requires: "ss_tough_1", type: "passive", effect: { defPercent: 0.1 } },
            { id: "def_path_3", name: "HP+", description: "HP+10", cost: 1, x: 4, y: 0, requires: "def_path_1", type: "stat", effect: { maxHp: 10 } },

            // --- 左下: 速さ・双剣ルート ---
            { id: "speed_path_1", name: "速さII", description: "速さ+10", cost: 2, x: -3, y: 2, requires: "core_speed_1", type: "stat", effect: { speed: 10 } },
            { id: "speed_path_2", name: "速さIII", description: "速さ+15", cost: 2, x: -5, y: 3, requires: "speed_path_1", type: "stat", effect: { speed: 15 } },
            { id: "ds_agile_1", name: "俊敏", description: "速さ+10, 攻撃+5", cost: 3, x: -7, y: 4, requires: "speed_path_2", type: "stat", effect: { speed: 10, atk: 5 } },
            { id: "ds_twin_strike", name: "ツインスラッシュ", description: "次の攻撃が2回攻撃になる(1回のダメージは0.6倍)", cost: 4, x: -9, y: 5, requires: "ds_agile_1", type: "active", effect: { multiStrike: 2, multiStrikeMultiplier: 0.6 } },
            { id: "speed_mastery", name: "速さの極意", description: "常時速さ+10%", cost: 5, x: -7, y: 6, requires: "ds_agile_1", type: "passive", effect: { speedPercent: 0.1 } },
            { id: "speed_path_3", name: "攻撃+", description: "攻撃+5", cost: 1, x: -4, y: 1, requires: "speed_path_1", type: "stat", effect: { atk: 5 } },

            // --- 右下: HP・鎌ルート ---
            { id: "hp_path_1", name: "体力II", description: "HP+15", cost: 2, x: 3, y: 2, requires: "core_hp_1", type: "stat", effect: { maxHp: 15 } },
            { id: "hp_path_2", name: "体力III", description: "HP+20", cost: 2, x: 5, y: 3, requires: "hp_path_1", type: "stat", effect: { maxHp: 20 } },
            { id: "sc_vitality_1", name: "生命力", description: "HP+20, 防御+5", cost: 3, x: 7, y: 4, requires: "hp_path_2", type: "stat", effect: { maxHp: 20, def: 5 } },
            { id: "sc_life_hunt", name: "ライフハント", description: "次の攻撃で与えたダメージの30%を吸収する", cost: 4, x: 9, y: 5, requires: "sc_vitality_1", type: "active", effect: { lifeSteal: 0.3 } },
            { id: "hp_mastery", name: "体力の極意", description: "常時HP+10%", cost: 5, x: 7, y: 6, requires: "sc_vitality_1", type: "passive", effect: { maxHpPercent: 0.1 } },
            { id: "hp_path_3", name: "防御+", description: "防御+5", cost: 1, x: 4, y: 1, requires: "hp_path_1", type: "stat", effect: { def: 5 } },

            // --- 遠距離・魔法ルート (上部) ---
            { id: "magic_path_1", name: "魔力", description: "攻撃+5, 速さ+5", cost: 2, x: 0, y: -3, requires: "core_hp_1", type: "stat", effect: { atk: 5, speed: 5 } },
            { id: "magic_path_2", name: "魔力II", description: "攻撃+10", cost: 2, x: 0, y: -5, requires: "magic_path_1", type: "stat", effect: { atk: 10 } },
            { id: "mw_fireball", name: "ファイアボール", description: "次の攻撃のダメージ1.2倍、敵に火傷付与", cost: 3, x: 2, y: -6, requires: "magic_path_2", type: "active", effect: { damageMultiplier: 1.2, burn: true } },
            { id: "mw_ice_lance", name: "アイスランス", description: "次の攻撃のダメージ1.1倍、敵の速さを低下", cost: 3, x: -2, y: -6, requires: "magic_path_2", type: "active", effect: { damageMultiplier: 1.1, speedDebuff: 0.2 } },
            { id: "magic_mastery", name: "魔力の極意", description: "常時 攻撃+5%, 速さ+5%", cost: 5, x: 0, y: -8, requires: ["mw_fireball", "mw_ice_lance"], type: "passive", effect: { atkPercent: 0.05, speedPercent: 0.05 } },

            // --- 特殊・クリティカルルート (左側) ---
            { id: "crit_path_1", name: "精密", description: "クリティカル率+2%", cost: 2, x: -8, y: 0, requires: "atk_path_1", type: "passive", effect: { critChance: 0.02 } },
            { id: "crit_path_2", name: "痛撃", description: "クリティカルダメージ+10%", cost: 2, x: -10, y: 0, requires: "crit_path_1", type: "passive", effect: { critMultiplier: 0.1 } },
            { id: "crit_mastery", name: "殺意", description: "クリティカル率+5%, クリティカルダメージ+20%", cost: 5, x: -12, y: 0, requires: "crit_path_2", type: "passive", effect: { critChance: 0.05, critMultiplier: 0.2 } },
            { id: "active_crit", name: "狙い澄まし", description: "次の攻撃は必ずクリティカルになる", cost: 4, x: -14, y: 0, requires: "crit_mastery", type: "active", effect: { nextAttackCrit: true } },

            // --- タンク・防御ルート (右側) ---
            { id: "tank_path_1", name: "頑健", description: "HP+20", cost: 2, x: 8, y: 0, requires: "def_path_1", type: "stat", effect: { maxHp: 20 } },
            { id: "tank_path_2", name: "鉄壁", description: "防御+15", cost: 2, x: 10, y: 0, requires: "tank_path_1", type: "stat", effect: { def: 15 } },
            { id: "tank_mastery", name: "不落の要塞", description: "常時 HP+5%, 防御+5%", cost: 5, x: 12, y: 0, requires: "tank_path_2", type: "passive", effect: { maxHpPercent: 0.05, defPercent: 0.05 } },
            { id: "active_unbreakable", name: "不動", description: "次のターン、受けるダメージを80%軽減するが、行動できない", cost: 4, x: 14, y: 0, requires: "tank_mastery", type: "active", effect: { damageReduction: 0.8, skipNextTurn: true } },

            // --- 下部中央: ユーティリティ ---
            { id: "util_path_1", name: "熟練", description: "スキルコスト-1", cost: 3, x: 0, y: 4, requires: "core_speed_1", type: "passive", effect: { skillCostReduction: 1 } },
            { id: "util_path_2", name: "資源管理", description: "スキルポイントを3獲得", cost: 4, x: 0, y: 6, requires: "util_path_1", type: "passive", effect: { grantSkillPoints: 3 } },
            { id: "active_reset", name: "リセット", description: "使用済みのスキルを1つだけ再度使用可能にする", cost: 5, x: 0, y: 8, requires: "util_path_2", type: "active", effect: { resetUsedSkill: 1 } },
            
            // --- 接続ノード ---
            { id: "connector_1", name: "道", cost: 1, x: -6, y: 1, requires: ["speed_path_2", "atk_path_3"], type: "stat", effect: {} },
            { id: "connector_2", name: "道", cost: 1, x: 6, y: -1, requires: ["def_path_2", "def_path_3"], type: "stat", effect: {} },
            { id: "connector_3", name: "道", cost: 1, x: -1, y: -3, requires: ["magic_path_1", "atk_path_1"], type: "stat", effect: {} },
            { id: "connector_4", name: "道", cost: 1, x: 1, y: 3, requires: ["hp_path_1", "core_speed_1"], type: "stat", effect: {} },
        ]
    }

// カスタムスキル作成コスト
const CUSTOM_SKILL_COST = 100;

// カスタムスキルのバリデーションルール
const CUSTOM_SKILL_VALIDATION = {
    // 禁止される効果（ゲームバランスを崩壊させるもの）
    bannedEffects: [
        "instantDeath", // 即死
        "fullHeal", // 完全回復
        "infiniteDamage", // 無限ダメージ
        "invincible", // 無敵
        "stealWeapon", // 武器奪取
        "deleteEnemy", // 敵削除
        "setEnemyStatsToZero", // 敵ステータス0化
        "multiplyStatsByLargeAmount", // ステータス大幅増加
    ],
    
    // 効果の強度に基づく必要ステータス合計値
    statRequirements: {
        weak: { totalStats: 200, maxMultiplier: 1.1 },
        medium: { totalStats: 400, maxMultiplier: 1.3 },
        strong: { totalStats: 600, maxMultiplier: 1.5 },
        veryStrong: { totalStats: 800, maxMultiplier: 1.8 },
        extreme: { totalStats: 1000, maxMultiplier: 2.0 }
    }
};

// プレイヤーのスキルデータ初期化
function initializeSkillData(player) {
    if (!player.skillTree) {
        player.skillTree = {
            unlockedNodes: [],
            availablePoints: 0
        };
    }
    
    if (player.skillTree.availablePoints == null) {
        player.skillTree.availablePoints = 0;
    }

    // スキルスロットを初期化
    if (!player.skillSlots || !Array.isArray(player.skillSlots) || player.skillSlots.length !== 3) {
        player.skillSlots = [null, null, null]; // 3つのスキルスロット
    }
    
    return player;
}

// レベルアップ時のスキルポイント付与
function addSkillPointsOnLevelUp(player, oldLevel, newLevel) {
    const levelsGained = newLevel - oldLevel;
    const pointsGained = levelsGained * SKILL_POINTS_PER_LEVEL;
    
    player = initializeSkillData(player);
    player.skillTree.availablePoints += pointsGained;
    
    return player;
}

// スキルノードのアンロック
function unlockSkillNode(player, nodeId) {
    player = initializeSkillData(player);
    
    const skillTree = SKILL_TREE;
    if (!skillTree || !skillTree.nodes) {
        return { success: false, error: "不明な武器種です" };
    }
    
    const node = skillTree.nodes.find(n => n.id === nodeId);
    if (!node) {
        return { success: false, error: "不明なスキルノードです" };
    }
    
    const playerTreeData = player.skillTree;
    
    // 既にアンロック済み
    if (playerTreeData.unlockedNodes.includes(nodeId)) {
        return { success: false, error: "既にアンロック済みです" };
    }
    
    // スキルポイント不足
    if (playerTreeData.availablePoints < node.cost) {
        return { success: false, error: `スキルポイントが不足しています（必要: ${node.cost}、所持: ${playerTreeData.availablePoints}）` };
    }
    
    // 前提条件チェック
    if (node.requires) {
        const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
        for (const reqId of requirements) {
            if (!playerTreeData.unlockedNodes.includes(reqId)) {
                return { success: false, error: "前提条件を満たしていません" };
            }
        }
    }
    
    // アンロック処理
    playerTreeData.unlockedNodes.push(nodeId);
    playerTreeData.availablePoints -= node.cost;

    // ポイントを付与するスキルの場合
    if (node.effect && node.effect.grantSkillPoints) {
        playerTreeData.availablePoints += node.effect.grantSkillPoints;
    }
    
    return { success: true, player };
}

// スキルノードの効果を取得
function getSkillNodeEffects(player) {
    player = initializeSkillData(player);
    
    const effects = {
        passive: {
            maxHp: 0, atk: 0, def: 0, speed: 0,
            maxHpPercent: 0, atkPercent: 0, defPercent: 0, speedPercent: 0,
            critChance: 0, critMultiplier: 0, skillCostReduction: 0
        },
        active: []
    };

    const playerTreeData = player.skillTree;
    if (!playerTreeData) return effects;
    
    const skillTree = SKILL_TREE;
    if (!skillTree) return effects;
    
    for (const nodeId of playerTreeData.unlockedNodes || []) {
        const node = skillTree.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        if (node.type === "stat" || node.type === "passive") {
            // パッシブ効果を適用
            const effect = node.effect || {};
            if (effect.grantSkillPoints) {
                // この効果はアンロック時に一度だけ適用されるべき
                // ここでは何もしない
            }

            for (const stat in effect) {
                if (stat !== "type" && effects.passive[stat] !== undefined) {
                    effects.passive[stat] += node.effect[stat];
                }
            }
        } else if (node.type === "active") {
            // アクティブスキルをリストに追加
            effects.active.push({
                id: node.id,
                name: node.name,
                description: node.description,
                effect: node.effect
            });
        }
    }
    // カスタムスキルもアクティブスキルとして含める
    if (player.customSkills && Array.isArray(player.customSkills)) {
        effects.active = effects.active.concat(player.customSkills);
    }

    // 重複を削除（カスタムスキルとツリースキルでIDが被ることはないが念のため）
    if (effects.active.length > 1) {
        effects.active = effects.active.filter((skill, index, self) =>
            index === self.findIndex((s) => (
                s.id === skill.id
            ))
        );
    }
    
    return effects;
}

// スキル効果をステータスに適用
function applySkillEffectsToStats(baseStats, player, weaponType) {
    const effects = getSkillNodeEffects(player);
    
    const stats = { ...baseStats };
    stats.maxHp += effects.passive.maxHp;
    stats.atk += effects.passive.atk;
    stats.def += effects.passive.def;
    stats.speed += effects.passive.speed;
    
    return stats;
}

// カスタムスキルのバリデーション
function validateCustomSkill(skillDescription, playerStats) {
    const totalStats = playerStats.maxHp + playerStats.atk + playerStats.def + playerStats.speed;
    
    // 禁止効果チェック
    for (const banned of CUSTOM_SKILL_VALIDATION.bannedEffects) {
        if (skillDescription.toLowerCase().includes(banned.toLowerCase())) {
            return { 
                valid: false, 
                reason: `この効果はゲームバランスを崩壊させるため許可されていません: ${banned}` 
            };
        }
    }
    
    // 効果の強度を推定（簡易的なキーワードベース）
    let estimatedStrength = "weak";
    const desc = skillDescription.toLowerCase();
    
    if (desc.includes("2倍") || desc.includes("2.0") || desc.includes("double")) {
        estimatedStrength = "strong";
    } else if (desc.includes("1.5") || desc.includes("1.5倍") || desc.includes("50%")) {
        estimatedStrength = "medium";
    } else if (desc.includes("1.8") || desc.includes("1.8倍")) {
        estimatedStrength = "veryStrong";
    } else if (desc.includes("2.2") || desc.includes("2.2倍") || desc.includes("2.5")) {
        estimatedStrength = "extreme";
    }
    
    const requirement = CUSTOM_SKILL_VALIDATION.statRequirements[estimatedStrength];
    
    if (totalStats < requirement.totalStats) {
        return { 
            valid: false, 
            reason: `ステータスが不足しています。必要: 合計${requirement.totalStats}、現在: 合計${totalStats}` 
        };
    }
    
    return { valid: true, strength: estimatedStrength };
}

// スキル説明文からeffectオブジェクトを簡易的に生成
function parseEffectFromDescription(description) {
    const finalEffect = { type: "active" };
    const desc = description.toLowerCase();

    // 条件のパース (例: "hpが50%以下の時")
    const hpConditionMatch = desc.match(/hpが([\d.]+)%以下/);
    if (hpConditionMatch) {
        finalEffect.condition = { type: 'hp_below', value: parseFloat(hpConditionMatch[1]) / 100 };
    }

    // 例: "次の攻撃のダメージ1.2倍" -> { damageMultiplier: 1.2 }
    const damageMultiplierMatch = desc.match(/(?:ダメージ|攻撃)[をが]?([\d.]+)倍/);
    if (damageMultiplierMatch && damageMultiplierMatch[1]) {
        finalEffect.damageMultiplier = parseFloat(damageMultiplierMatch[1]);
    }

    // 例: "自身の防御-10"
    const selfDefDebuffMatch = desc.match(/自身の防御-([\d.]+)/);
    if (selfDefDebuffMatch && selfDefDebuffMatch[1]) {
        finalEffect.selfDefDebuff = parseFloat(selfDefDebuffMatch[1]);
    }

    // 例: "敵防御無視"
    const ignoreDefMatch = desc.match(/敵防御無視/);
    if (ignoreDefMatch) {
        finalEffect.ignoreDef = true;
    }

    // 例: "受けるダメージを30%軽減" -> { damageReduction: 0.3 }
    const damageReductionMatch = desc.match(/ダメージ(?:を|が)([\d.]+)%軽減/);
    if (damageReductionMatch && damageReductionMatch[1]) {
        finalEffect.damageReduction = parseFloat(damageReductionMatch[1]) / 100.0;
    }

    // 例: "敵に火傷付与"
    const burnMatch = desc.match(/火傷付与/);
    if (burnMatch) {
        finalEffect.burn = true;
    }

    // 例: "次の攻撃を必中にする" -> { sureHit: true }
    const sureHitMatch = desc.match(/必中/);
    if (sureHitMatch) {
        finalEffect.sureHit = true;
    }

    // 何かしらの効果がパースできたかチェック (新しい効果も追加)
    const hasAction = finalEffect.damageMultiplier || finalEffect.damageReduction || finalEffect.sureHit || finalEffect.selfDefDebuff || finalEffect.ignoreDef || finalEffect.burn;
    if (!hasAction) {
        return null; // 解釈できる効果がなかった
    }

    return finalEffect;
}

// カスタムスキルの作成
function createCustomSkill(player, skillName, skillDescription) {
    // コインチェック
    if ((player.coins || 0) < CUSTOM_SKILL_COST) {
        return { success: false, error: `コインが不足しています（必要: ${CUSTOM_SKILL_COST}）` };
    }
    
    // ステータスチェック
    const stats = getStatsFromPlayer(player);

    // effectをパース
    const effect = parseEffectFromDescription(skillDescription);
    if (!effect) {
        return { success: false, error: "スキルの効果を解釈できませんでした。指定された形式で入力してください。（例：次の攻撃のダメージ1.2倍）" };
    }
    const validation = validateCustomSkill(skillDescription, stats);
    
    if (!validation.valid) {
        return { success: false, error: validation.reason };
    }
    
    // カスタムスキルを追加
    if (!player.customSkills) {
        player.customSkills = [];
    }
    
    const customSkill = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: skillName,
        description: skillDescription,
        effect: effect,
        strength: validation.strength,
        createdAt: Date.now()
    };
    
    player.customSkills.push(customSkill);
    player.coins -= CUSTOM_SKILL_COST;
    
    return { success: true, player, skill: customSkill };
}

// ============================================
// UI描画関連
// ============================================

function injectSkillTreeCSS() {
    // スタイルが既に存在する場合は注入しない
    if (document.getElementById('skill-tree-styles')) return;

    const css = `
/* --- スキルツリー --- */
.skill-tree-ui {
    display: flex;
    flex-direction: column;
    height: 600px; /* 高さを少し増やす */
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
    background-color: #222; /* 背景を暗くしてノードを目立たせる */
    color: #eee;
}

.skill-tree-header {
    padding: 10px 15px;
    font-size: 1.4em; /* ヘッダーを大きく */
    font-weight: bold;
    text-align: center;
    background-color: #333; /* ヘッダーも暗く */
    border-bottom: 1px solid #555;
    flex-shrink: 0;
    color: #fff;
}

.skill-tree-content-wrapper {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
}

.skill-points-display {
    padding: 10px;
    background-color: #444; /* ポイント表示部分も暗く */
    border-bottom: 1px solid #555;
    text-align: center;
    font-weight: bold;
    color: #fff;
}

.skill-tree-content {
    position: relative;
    flex-grow: 1;
    overflow: auto;
    background-color: #2a2a2a; /* 背景をさらに暗く */
    background-image: radial-gradient(#444 1px, transparent 1px); /* グリッド線を少し濃く */
    background-size: 20px 20px;
}

.skill-tree-content svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none; /* Allow touch events to pass through to the container for scrolling */
}

.skill-node {
    position: absolute;
    width: 80px; /* ノードの幅を広げる */
    height: 60px; /* ノードの高さを広げる */
    border-radius: 8px; /* 角を丸くする */
    border: 2px solid #777; /* 枠線を少し明るく */
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75em; /* テキストサイズを調整 */
    color: #eee; /* テキスト色を明るく */
    background-color: #555; /* デフォルトの背景色 */
    box-sizing: border-box;
    padding: 5px; /* パディングを追加 */
    text-align: center; /* テキストを中央揃え */
    line-height: 1.2; /* 行の高さを調整 */
    overflow: hidden; /* はみ出るテキストを隠す */
    white-space: normal; /* テキストを折り返す */
    text-overflow: ellipsis; /* はみ出たテキストを省略 */
    box-shadow: 0 2px 5px rgba(0,0,0,0.5); /* 影を追加 */
    z-index: 1; /* 線の上に表示 */
}

.skill-node span {
    display: block; /* spanをブロック要素にしてwidth/heightを適用しやすく */
    max-width: 100%; /* 親要素の幅に合わせる */
    white-space: normal; /* 折り返しを許可 */
    overflow: hidden;
    text-overflow: ellipsis;
}

.skill-node.stat { background-color: #3a6b8a; border-color: #5a9bd3; } /* 青系 */
.skill-node.active { background-color: #8a3a3a; border-color: #d35a5a; } /* 赤系 */
.skill-node.passive { background-color: #3a8a6b; border-color: #5ad39b; } /* 緑系 */

.skill-node.unlocked {
    border-color: #28a745;
    box-shadow: 0 0 10px rgba(40, 167, 69, 0.7);
    background-color: #3a9a5a; /* アンロック済みの背景色 */
}

.skill-node.unlockable {
    border-color: #ffc107;
    cursor: pointer;
    background-color: #a78a3a; /* アンロック可能な背景色 */
}
.skill-node.unlockable:hover {
    transform: scale(1.05); /* ホバーで少し拡大 */
    box-shadow: 0 0 15px rgba(255, 193, 7, 0.9);
}

.skill-node.locked {
    border-color: #666;
    cursor: not-allowed;
    opacity: 0.4; /* ロック済みは暗く */
    background-color: #444;
}

/* スキルノード間の接続線 */
.skill-tree-content line {
    stroke-linecap: round; /* 線の端を丸く */
    transition: stroke 0.2s; /* 色の変化を滑らかに */
}

/* --- スキル管理セクション --- */
.skill-management-section {
    display: flex;
    flex-wrap: wrap;
    gap: 30px;
    margin-top: 20px;
    padding: 20px; /* パディングを追加 */
    border-top: 1px solid #ccc;
    background-color: #f8f8f8; /* 背景色を少し明るく */
    border-radius: 0 0 8px 8px; /* 下部の角を丸く */
}
@media (max-width: 768px) {
    .skill-management-section {
        flex-direction: column;
        padding: 10px;
        gap: 15px;
    }
}

.skill-slot-wrapper, .custom-skill-wrapper {
    flex: 1;
    min-width: 300px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 15px; /* パディングを追加 */
    border: 1px solid #ddd; /* 枠線を追加 */
    border-radius: 8px; /* 角を丸く */
    background-color: #fff; /* 背景色を白に */
    box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* 影を追加 */
    color: #333; /* テキスト色を明示的に指定 */
}

.skill-slot-wrapper h3, .custom-skill-wrapper h3 {
    margin-top: 0;
    color: #333;
    border-bottom: 2px solid #007bff;
    padding-bottom: 5px;
}

/* --- スキルスロット --- */
.skill-slots-container { display: flex; justify-content: center; gap: 15px; margin: 10px 0; padding: 15px; border: 2px dashed #007bff; border-radius: 8px; background-color: #e7f3ff; }
.skill-slot { width: 100px; height: 60px; border: 2px solid #007bff; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 0.9em; color: #007bff; background-color: #fff; position: relative; overflow: hidden; text-align: center; padding: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.skill-slot.filled { background-color: #007bff; color: #fff; font-weight: bold; cursor: pointer; }
.skill-slot.filled .unequip-skill-btn { position: absolute; top: 2px; right: 2px; background: rgba(255, 255, 255, 0.3); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7em; display: flex; align-items: center; justify-content: center; cursor: pointer; line-height: 1; }
.skill-slot.filled .unequip-skill-btn:hover { background: rgba(255, 255, 255, 0.5); }
.available-skills-list { margin-top: 15px; max-height: 250px; overflow-y: auto; border: 1px solid #eee; padding: 10px; background-color: #fdfdfd; border-radius: 5px; }
.available-skill-item { padding: 8px; margin-bottom: 5px; background-color: #f0f8ff; border: 1px solid #d0e9ff; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
.available-skill-item:hover { background-color: #cce5ff; }

/* --- オリジナルスキル作成 --- */
.custom-skill-form { display: flex; flex-direction: column; gap: 10px; max-width: 100%; margin-bottom: 20px; }
.custom-skill-form input, .custom-skill-form textarea { padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
.custom-skill-form textarea { height: 60px; resize: vertical; }
    `;
    const style = document.createElement('style');
    style.id = 'skill-tree-styles';
    style.textContent = css;
    document.head.appendChild(style);
}

function renderSkillTreeUI() {
    injectSkillTreeCSS(); // CSSを注入

    const container = document.getElementById('skillTreeContainer');
    if (!container) return;

    const player = getPlayerData();
    if (!player) {
        container.innerHTML = '<p>プレイヤーデータが見つかりません。</p>';
        return;
    }

    container.innerHTML = `
        <div class="skill-tree-ui">
            <div class="skill-tree-header">${SKILL_TREE.name}</div>
            <div class="skill-tree-content-wrapper">
                <div class="skill-points-display"></div>
                <div class="skill-tree-content"></div>
            </div>
        </div>
        <div class="skill-management-section">
            <div class="skill-slot-wrapper">
                <h3>スキルスロット</h3>
                <p>バトルで使用するスキルを3つまでセットできます。</p>
                <div id="skillSlotsContainer" class="skill-slots-container">
                    <!-- スロットはJSで生成 -->
                </div>
                <h4>利用可能なアクティブスキル</h4>
                <div id="availableSkillsList" class="available-skills-list"></div>
            </div>
            <div class="custom-skill-wrapper">
                <h3>オリジナルスキル作成</h3>
                <p>AIにスキルの名前と内容を伝えると、あなた専用のスキルが作成されます。<br>（例：次の攻撃のダメージを1.5倍にする）</p>
                <p>作成には ${CUSTOM_SKILL_COST} コインが必要です。</p>
                <div class="custom-skill-form">
                    <input type="text" id="customSkillName" placeholder="スキル名">
                    <textarea id="customSkillDescription" placeholder="スキルの内容">次の攻撃のダメージを1.2倍にする</textarea>
                    <button id="createCustomSkillBtn">作成する</button>
                </div>
                <h4>作成済みオリジナルスキル</h4>
                <div id="customSkillList"></div>
            </div>
        </div>
    `;

    // 初期表示
    renderTree();

    renderSkillSlots(player);
    renderAvailableSkills(player);
    renderCustomSkillList(player);

    // イベントリスナー
    document.getElementById('createCustomSkillBtn').onclick = () => {
        const player = getPlayerData();
        const skillName = document.getElementById('customSkillName').value.trim();
        const skillDescription = document.getElementById('customSkillDescription').value.trim();

        if (!skillName || !skillDescription) {
            alert('スキル名と内容を入力してください。');
            return;
        }

        const result = createCustomSkill(player, skillName, skillDescription);

        if (result.success) {
            localStorage.setItem("player", JSON.stringify(result.player));
            alert(`オリジナルスキル「${result.skill.name}」を作成しました！`);
            renderSkillTreeUI(); // UI全体を再描画
            if (typeof updateStatus === 'function') updateStatus(result.player);
        } else {
            alert(`作成に失敗しました:\n${result.error}`);
        }
    };
}

// ノード間の接続線を描画するためのヘルパー関数
function drawConnection(svg, x1, y1, x2, y2, isUnlocked) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', isUnlocked ? '#28a745' : '#ccc');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);
}

function renderTree() {
    const content = document.querySelector('.skill-tree-content');
    const pointsDisplay = document.querySelector('.skill-points-display');
    if (!content || !pointsDisplay) return;

    const player = getPlayerData();
    const treeData = SKILL_TREE;
    const playerData = player.skillTree;

    pointsDisplay.textContent = `利用可能スキルポイント: ${playerData.availablePoints || 0}`;
    content.innerHTML = ''; // コンテンツをクリア

    // 1. Find bounds of the tree
    const allX = treeData.nodes.map(n => n.x);
    const allY = treeData.nodes.map(n => n.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);

    // 2. Calculate offsets and total size with padding
    const PADDING = 200; // Add more padding for better scrolling experience
    const NODE_H_SPACING = 100; // Increase spacing
    const NODE_V_SPACING = 100; // Increase spacing
    const NODE_WIDTH = 80;
    const NODE_HEIGHT = 60;

    const offsetX = -minX * NODE_H_SPACING + PADDING;
    const offsetY = -minY * NODE_V_SPACING + PADDING;

    const totalWidth = (maxX - minX) * NODE_H_SPACING + NODE_WIDTH + PADDING * 2;
    const totalHeight = (maxY - minY) * NODE_V_SPACING + NODE_HEIGHT + PADDING * 2;

    // Create an inner container that will be the actual scrollable content
    const innerContent = document.createElement('div');
    innerContent.style.position = 'relative';
    innerContent.style.width = `${totalWidth}px`;
    innerContent.style.height = `${totalHeight}px`;
    content.appendChild(innerContent);

    // Create SVG container for connection lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none'; // Crucial for touch scrolling
    innerContent.appendChild(svg);

    // 最初に接続線を描画
    treeData.nodes.forEach(node => {
        if (node.requires) {
            const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
            requirements.forEach(reqId => {
                const requiredNode = treeData.nodes.find(n => n.id === reqId);
                if (requiredNode) {
                    // 3. Apply offsets to coordinates
                    const nodeX = node.x * NODE_H_SPACING + offsetX;
                    const nodeY = node.y * NODE_V_SPACING + offsetY;
                    const reqNodeX = requiredNode.x * NODE_H_SPACING + offsetX;
                    const reqNodeY = requiredNode.y * NODE_V_SPACING + offsetY;
                    // ノードの中心に線を引く
                    drawConnection(svg, reqNodeX + NODE_WIDTH / 2, reqNodeY + NODE_HEIGHT / 2, nodeX + NODE_WIDTH / 2, nodeY + NODE_HEIGHT / 2, playerData.unlockedNodes.includes(node.id));
                }
            });
        }
    });

    // 次にノードを描画（線の上に表示するため）
    treeData.nodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = `skill-node ${node.type}`;
        // 3. Apply offsets to coordinates
        const nodeX = node.x * NODE_H_SPACING + offsetX;
        const nodeY = node.y * NODE_V_SPACING + offsetY;
        nodeEl.style.left = `${nodeX}px`;
        nodeEl.style.top = `${nodeY}px`;
        nodeEl.title = `${node.name}\n${node.description}\nコスト: ${node.cost}`;

        const isUnlocked = playerData.unlockedNodes.includes(node.id);
        
        const nodeText = document.createElement('span');
        nodeText.textContent = node.name; // フルネームを表示
        nodeEl.appendChild(nodeText);

        let isUnlockable = false;
        if (!isUnlocked && playerData.availablePoints >= node.cost) {
            if (!node.requires) {
                isUnlockable = true;
            } else {
                const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
                if (requirements.every(reqId => playerData.unlockedNodes.includes(reqId))) {
                    isUnlockable = true;
                }
            }
        }

        if (isUnlocked) nodeEl.classList.add('unlocked');
        else if (isUnlockable) nodeEl.classList.add('unlockable');
        else nodeEl.classList.add('locked');

        nodeEl.onclick = () => {
            if (isUnlockable) {
                if (confirm(`${node.name} を習得しますか？ (コスト: ${node.cost})`)) {
                    const result = unlockSkillNode(getPlayerData(), node.id);
                    if (result.success) {
                        localStorage.setItem("player", JSON.stringify(result.player));
                        renderTree(); // ツリーを再描画
                        renderAvailableSkills(result.player); // 利用可能スキルリストも更新
                    } else {
                        alert(result.error);
                    }
                }
            }
        };

        innerContent.appendChild(nodeEl);
    });

    // 5. Set initial scroll position to the start node
    const startNode = treeData.nodes.find(n => n.id === 'start_node');
    if (startNode) {
        const nodeX = startNode.x * NODE_H_SPACING + offsetX;
        const nodeY = startNode.y * NODE_V_SPACING + offsetY;
        // Use setTimeout to ensure the browser has rendered the content before scrolling
        setTimeout(() => {
            content.scrollTop = nodeY - (content.clientHeight / 2) + (NODE_HEIGHT / 2);
            content.scrollLeft = nodeX - (content.clientWidth / 2) + (NODE_WIDTH / 2);
        }, 0);
    }
}

function renderSkillSlots(player) {
    const slotsContainer = document.getElementById('skillSlotsContainer');
    if (!slotsContainer) return;

    slotsContainer.innerHTML = '';
    player.skillSlots.forEach((skill, index) => {
        const slotEl = document.createElement('div');
        slotEl.className = 'skill-slot';
        slotEl.dataset.slotIndex = index;
        if (skill) {
            slotEl.classList.add('filled');
            slotEl.innerHTML = `<span>${skill.name}</span><button class="unequip-skill-btn" data-skill-id="${skill.id}">X</button>`;
            slotEl.title = skill.description;
        } else {
            slotEl.textContent = `スロット ${index + 1}`;
        }
        slotsContainer.appendChild(slotEl);
    });

    slotsContainer.querySelectorAll('.unequip-skill-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation(); // 親要素のクリックイベントが発火しないように
            const slotIndex = parseInt(btn.closest('.skill-slot').dataset.slotIndex);
            const result = unequipSkillFromSlot(getPlayerData(), slotIndex);
            if (result.success) { localStorage.setItem("player", JSON.stringify(result.player)); renderSkillTreeUI(); } else { alert(result.error); }
        };
    });
}

function renderCustomSkillList(player) {
    const listContainer = document.getElementById('customSkillList');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const customSkills = player.customSkills || [];

    if (customSkills.length === 0) {
        listContainer.innerHTML = '<p>まだありません。</p>';
        return;
    }

    const ul = document.createElement('ul');
    customSkills.forEach(skill => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${skill.name}</strong>: ${skill.description}`;
        ul.appendChild(li);
    });
    listContainer.appendChild(ul);
}

function renderAvailableSkills(player) {
    const availableSkillsList = document.getElementById('availableSkillsList');
    if (!availableSkillsList) return;

    availableSkillsList.innerHTML = '';
    const effects = getSkillNodeEffects(player);
    let allAvailableSkills = effects.active;
    // 重複を削除
    allAvailableSkills = allAvailableSkills.filter((skill, index, self) =>
        index === self.findIndex((s) => s.id === skill.id)
    );


    if (allAvailableSkills.length === 0) {
        availableSkillsList.innerHTML = '<p>利用可能なアクティブスキルがありません。</p>';
        return;
    }

    const ul = document.createElement('ul');
    allAvailableSkills.forEach(skill => {
        // 既にスキルスロットに装備されているスキルは表示しない
        if (player.skillSlots.some(s => s && s.id === skill.id)) {
            return;
        }

        const li = document.createElement('li');
        li.className = 'available-skill-item';
        li.textContent = skill.name;
        li.title = skill.description;
        li.onclick = () => {
            const slotIndex = prompt(`「${skill.name}」をどのスロットに装備しますか？ (1, 2, 3)`, "1");
            if (slotIndex === null) return;
            const index = parseInt(slotIndex) - 1;
            if (isNaN(index) || index < 0 || index >= 3) {
                alert("無効なスロット番号です。1, 2, 3のいずれかを入力してください。");
                return;
            }
            const result = equipSkillToSlot(getPlayerData(), skill.id, index);
            if (result.success) {
                localStorage.setItem("player", JSON.stringify(result.player));
                renderSkillTreeUI(); // UI全体を再描画
            } else {
                alert(result.error);
            }
        };
        ul.appendChild(li);
    });
    availableSkillsList.appendChild(ul);
}

function equipSkillToSlot(player, skillId, slotIndex) {
    const effects = getSkillNodeEffects(player);
    let allAvailableSkills = effects.active;

    allAvailableSkills = allAvailableSkills.filter((skill, index, self) =>
        index === self.findIndex((s) => s.id === skill.id)
    );

    const skillToEquip = allAvailableSkills.find(s => s.id === skillId);
    if (!skillToEquip) return { success: false, error: "不明なスキルです。" };
    if (player.skillSlots.includes(skillToEquip)) return { success: false, error: "そのスキルは既に装備されています。" };
    player.skillSlots[slotIndex] = skillToEquip;
    return { success: true, player };
}

function unequipSkillFromSlot(player, slotIndex) {
    player.skillSlots[slotIndex] = null;
    return { success: true, player };
}

// グローバル関数としてエクスポート
if (typeof window !== 'undefined') {
    window.SKILL_TREE = SKILL_TREE;
    window.SKILL_POINTS_PER_LEVEL = SKILL_POINTS_PER_LEVEL;
    window.CUSTOM_SKILL_COST = CUSTOM_SKILL_COST;
    window.initializeSkillData = initializeSkillData;
    window.addSkillPointsOnLevelUp = addSkillPointsOnLevelUp;
    window.unlockSkillNode = unlockSkillNode;
    window.getSkillNodeEffects = getSkillNodeEffects;
    window.applySkillEffectsToStats = applySkillEffectsToStats;
    window.validateCustomSkill = validateCustomSkill;
    window.createCustomSkill = createCustomSkill;
    window.equipSkillToSlot = equipSkillToSlot;
    window.unequipSkillFromSlot = unequipSkillFromSlot;
    window.renderSkillTreeUI = renderSkillTreeUI;
}