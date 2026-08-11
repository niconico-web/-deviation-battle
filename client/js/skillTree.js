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
            { id: "gs_cleave", name: "クリーブ", description: "次の攻撃のダメージ1.4倍、ただし自身の防御-10", cost: 4, x: -9, y: -4, requires: "gs_power_1", type: "active", effect: { type: "active", damageMultiplier: 1.4, selfDefDebuff: 10 } },
            { id: "atk_mastery", name: "攻撃の極意", description: "常時攻撃+10%", cost: 5, x: -7, y: -5, requires: "gs_power_1", type: "passive", effect: { atkPercent: 0.1 } },
            { id: "atk_path_3", name: "速さ+", description: "速さ+5", cost: 1, x: -4, y: 0, requires: "atk_path_1", type: "stat", effect: { speed: 5 } },

            // --- 右上: 防御・盾ルート ---
            { id: "def_path_1", name: "防御II", description: "防御+10", cost: 2, x: 3, y: -1, requires: "core_def_1", type: "stat", effect: { def: 10 } },
            { id: "def_path_2", name: "防御III", description: "防御+15", cost: 2, x: 5, y: -2, requires: "def_path_1", type: "stat", effect: { def: 15 } },
            { id: "ss_tough_1", name: "不屈", description: "防御+10, HP+10", cost: 3, x: 7, y: -3, requires: "def_path_2", type: "stat", effect: { def: 10, maxHp: 10 } },
            { id: "ss_guard_stance", name: "ガードスタンス", description: "次に受けるダメージを30%軽減", cost: 4, x: 9, y: -4, requires: "ss_tough_1", type: "active", effect: { type: "active", damageReduction: 0.3 } },
            { id: "def_mastery", name: "防御の極意", description: "常時防御+10%", cost: 5, x: 7, y: -5, requires: "ss_tough_1", type: "passive", effect: { defPercent: 0.1 } },
            { id: "def_path_3", name: "HP+", description: "HP+10", cost: 1, x: 4, y: 0, requires: "def_path_1", type: "stat", effect: { maxHp: 10 } },

            // --- 左下: 速さ・双剣ルート ---
            { id: "speed_path_1", name: "速さII", description: "速さ+10", cost: 2, x: -3, y: 2, requires: "core_speed_1", type: "stat", effect: { speed: 10 } },
            { id: "speed_path_2", name: "速さIII", description: "速さ+15", cost: 2, x: -5, y: 3, requires: "speed_path_1", type: "stat", effect: { speed: 15 } },
            { id: "ds_agile_1", name: "俊敏", description: "速さ+10, 攻撃+5", cost: 3, x: -7, y: 4, requires: "speed_path_2", type: "stat", effect: { speed: 10, atk: 5 } },
            { id: "ds_twin_strike", name: "ツインスラッシュ", description: "次の攻撃が2回攻撃になる(1回のダメージは0.6倍)", cost: 4, x: -9, y: 5, requires: "ds_agile_1", type: "active", effect: { type: "active", multiStrike: 2, multiStrikeMultiplier: 0.6 } },
            { id: "speed_mastery", name: "速さの極意", description: "常時速さ+10%", cost: 5, x: -7, y: 6, requires: "ds_agile_1", type: "passive", effect: { speedPercent: 0.1 } },
            { id: "speed_path_3", name: "攻撃+", description: "攻撃+5", cost: 1, x: -4, y: 1, requires: "speed_path_1", type: "stat", effect: { atk: 5 } },

            // --- 右下: HP・鎌ルート ---
            { id: "hp_path_1", name: "体力II", description: "HP+15", cost: 2, x: 3, y: 2, requires: "core_hp_1", type: "stat", effect: { maxHp: 15 } },
            { id: "hp_path_2", name: "体力III", description: "HP+20", cost: 2, x: 5, y: 3, requires: "hp_path_1", type: "stat", effect: { maxHp: 20 } },
            { id: "sc_vitality_1", name: "生命力", description: "HP+20, 防御+5", cost: 3, x: 7, y: 4, requires: "hp_path_2", type: "stat", effect: { maxHp: 20, def: 5 } },
            { id: "sc_life_hunt", name: "ライフハント", description: "次の攻撃で与えたダメージの30%を吸収する", cost: 4, x: 9, y: 5, requires: "sc_vitality_1", type: "active", effect: { type: "active", lifeSteal: 0.3 } },
            { id: "hp_mastery", name: "体力の極意", description: "常時HP+10%", cost: 5, x: 7, y: 6, requires: "sc_vitality_1", type: "passive", effect: { maxHpPercent: 0.1 } },
            { id: "hp_path_3", name: "防御+", description: "防御+5", cost: 1, x: 4, y: 1, requires: "hp_path_1", type: "stat", effect: { def: 5 } },

            // --- 遠距離・魔法ルート (上部) ---
            { id: "magic_path_1", name: "魔力", description: "攻撃+5, 速さ+5", cost: 2, x: 0, y: -3, requires: "core_hp_1", type: "stat", effect: { atk: 5, speed: 5 } },
            { id: "magic_path_2", name: "魔力II", description: "攻撃+10", cost: 2, x: 0, y: -5, requires: "magic_path_1", type: "stat", effect: { atk: 10 } },
            { id: "mw_fireball", name: "ファイアボール", description: "次の攻撃のダメージ1.2倍、敵に火傷付与", cost: 3, x: 2, y: -6, requires: "magic_path_2", type: "active", effect: { type: "active", damageMultiplier: 1.2, burn: true } },
            { id: "mw_ice_lance", name: "アイスランス", description: "次の攻撃のダメージ1.1倍、敵の速さを低下", cost: 3, x: -2, y: -6, requires: "magic_path_2", type: "active", effect: { type: "active", damageMultiplier: 1.1, speedDebuff: 0.2 } },
            { id: "magic_mastery", name: "魔力の極意", description: "常時 攻撃+5%, 速さ+5%", cost: 5, x: 0, y: -8, requires: ["mw_fireball", "mw_ice_lance"], type: "passive", effect: { atkPercent: 0.05, speedPercent: 0.05 } },

            // --- 特殊・クリティカルルート (左側) ---
            { id: "crit_path_1", name: "精密", description: "クリティカル率+2%", cost: 2, x: -8, y: 0, requires: "atk_path_1", type: "passive", effect: { critChance: 0.02 } },
            { id: "crit_path_2", name: "痛撃", description: "クリティカルダメージ+10%", cost: 2, x: -10, y: 0, requires: "crit_path_1", type: "passive", effect: { critMultiplier: 0.1 } },
            { id: "crit_mastery", name: "殺意", description: "クリティカル率+5%, クリティカルダメージ+20%", cost: 5, x: -12, y: 0, requires: "crit_path_2", type: "passive", effect: { critChance: 0.05, critMultiplier: 0.2 } },
            { id: "active_crit", name: "狙い澄まし", description: "次の攻撃は必ずクリティカルになる", cost: 4, x: -14, y: 0, requires: "crit_mastery", type: "active", effect: { type: "active", nextAttackCrit: true } },

            // --- タンク・防御ルート (右側) ---
            { id: "tank_path_1", name: "頑健", description: "HP+20", cost: 2, x: 8, y: 0, requires: "def_path_1", type: "stat", effect: { maxHp: 20 } },
            { id: "tank_path_2", name: "鉄壁", description: "防御+15", cost: 2, x: 10, y: 0, requires: "tank_path_1", type: "stat", effect: { def: 15 } },
            { id: "tank_mastery", name: "不落の要塞", description: "常時 HP+5%, 防御+5%", cost: 5, x: 12, y: 0, requires: "tank_path_2", type: "passive", effect: { maxHpPercent: 0.05, defPercent: 0.05 } },
            { id: "active_unbreakable", name: "不動", description: "次のターン、受けるダメージを80%軽減するが、行動できない", cost: 4, x: 14, y: 0, requires: "tank_mastery", type: "active", effect: { type: "active", damageReduction: 0.8, skipNextTurn: true } },

            // --- 下部中央: ユーティリティ ---
            { id: "util_path_1", name: "熟練", description: "スキルコスト-1", cost: 3, x: 0, y: 4, requires: "core_speed_1", type: "passive", effect: { skillCostReduction: 1 } },
            { id: "util_path_2", name: "資源管理", description: "スキルポイントを3獲得", cost: 4, x: 0, y: 6, requires: "util_path_1", type: "passive", effect: { grantSkillPoints: 3 } },
            { id: "active_reset", name: "リセット", description: "使用済みのスキルを1つだけ再度使用可能にする", cost: 5, x: 0, y: 8, requires: "util_path_2", type: "active", effect: { type: "active", resetUsedSkill: 1 } },
            
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
    // 禁止される効果（ゲームバランスを崩壊させるもの - 緩和）
    bannedEffects: [
        "infiniteDamage", // 無限ダメージ
        "deleteEnemy", // 敵削除
        "multiplyStatsByLargeAmount", // ステータス大幅増加
        "all", // 全て
        "every", // 全ての
        "unlimited", // 無制限
    ],
    
    // 効果の強度に基づく必要ステータス合計値（緩和された設定）
    statRequirements: {
        tier1: { totalStats: 100, maxMultiplier: 1.05, description: "微弱" },
        tier2: { totalStats: 200, maxMultiplier: 1.1, description: "弱い" },
        tier3: { totalStats: 350, maxMultiplier: 1.15, description: "やや弱い" },
        tier4: { totalStats: 500, maxMultiplier: 1.2, description: "普通" },
        tier5: { totalStats: 800, maxMultiplier: 1.25, description: "やや強い" },
        tier6: { totalStats: 1200, maxMultiplier: 1.3, description: "強い" },
        tier7: { totalStats: 1800, maxMultiplier: 1.4, description: "かなり強い" },
        tier8: { totalStats: 2500, maxMultiplier: 1.5, description: "非常に強い" },
        tier9: { totalStats: 3500, maxMultiplier: 1.6, description: "極めて強い" },
        tier10: { totalStats: 5000, maxMultiplier: 1.7, description: "超強力" },
        tier11: { totalStats: 7000, maxMultiplier: 1.8, description: "伝説級" },
        tier12: { totalStats: 10000, maxMultiplier: 1.9, description: "神話級" },
        tier13: { totalStats: 15000, maxMultiplier: 2.0, description: "神級" },
        tier14: { totalStats: 20000, maxMultiplier: 2.2, description: "超越" },
        tier15: { totalStats: 30000, maxMultiplier: 2.5, description: "宇宙崩壊レベル" }
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
    
    // レガシーカスタムスキルのマイグレーション（IDがない場合）
    if (player.customSkills && Array.isArray(player.customSkills)) {
        player.customSkills = player.customSkills.map(skill => {
            if (!skill.id) {
                // IDがない場合は生成
                skill.id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            }
            if (!skill.type) {
                // typeがない場合はactiveに設定
                skill.type = "active";
            }
            if (!skill.effect) {
                // effectがない場合はデフォルト効果を設定
                skill.effect = { type: "active", damageMultiplier: 1.2 };
            }
            if (!skill.createdAt) {
                // createdAtがない場合は現在時刻を設定
                skill.createdAt = Date.now();
            }
            if (!skill.strength) {
                // strengthがない場合はデフォルト値を設定
                skill.strength = "tier4";
            }
            return skill;
        });
    }
    
    return player;
}

// レベルアップ時のスキルポイント付与
function addSkillPointsOnLevelUp(player, oldLevel, newLevel) {
    player = initializeSkillData(player);
    
    // 既にポイントを付与したレベルを追跡
    if (!player.skillTree.lastLevelGranted) {
        player.skillTree.lastLevelGranted = oldLevel;
    }
    
    // 既にこのレベルでポイントを付与済みの場合はスキップ
    if (player.skillTree.lastLevelGranted >= newLevel) {
        return player;
    }
    
    const levelsGained = newLevel - player.skillTree.lastLevelGranted;
    const pointsGained = levelsGained * SKILL_POINTS_PER_LEVEL;
    
    player.skillTree.availablePoints += pointsGained;
    player.skillTree.lastLevelGranted = newLevel;
    
    return player;
}

// スキルノードの解放
function unlockSkillNode(player, nodeId) {
    player = initializeSkillData(player);
    
    const skillTree = SKILL_TREE;
    if (!skillTree) return { success: false, error: 'スキルツリーが見つかりません' };
    
    const node = skillTree.nodes.find(n => n.id === nodeId);
    if (!node) return { success: false, error: 'スキルノードが見つかりません' };
    
    const playerTreeData = player.skillTree;
    if (!playerTreeData) return { success: false, error: 'スキルツリーデータが見つかりません' };
    
    // 既に解放済み
    if (playerTreeData.unlockedNodes.includes(nodeId)) {
        return { success: false, error: 'このスキルは既に解放されています' };
    }
    
    // スキルポイント不足
    if (playerTreeData.availablePoints < node.cost) {
        return { success: false, error: 'スキルポイントが不足しています' };
    }
    
    // 前提条件チェック
    if (node.requires) {
        const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
        for (const reqId of requirements) {
            if (!playerTreeData.unlockedNodes.includes(reqId)) {
                return { success: false, error: '前提条件のスキルを解放してください' };
            }
        }
    }
    
    // スキルを解放
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
                effect: node.effect,
                type: "active" // 明示的に型を追加
            });
        }
    }
    // カスタムスキルもアクティブスキルとして含める（重複チェック付き）
    if (player.customSkills && Array.isArray(player.customSkills)) {
        player.customSkills.forEach(customSkill => {
            // レガシースキルのプロパティチェック
            if (!customSkill.id) {
                customSkill.id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            }
            if (!customSkill.type) {
                customSkill.type = "active";
            }
            if (!customSkill.effect) {
                customSkill.effect = { type: "active", damageMultiplier: 1.2 };
            }
            
            // 重複チェック
            if (!effects.active.some(skill => skill.id === customSkill.id)) {
                effects.active.push(customSkill);
            }
        });
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

// カスタムスキルのバリデーション（厳しめのAI判定）
function validateCustomSkill(skillDescription, playerStats) {
    const totalStats = playerStats.maxHp + playerStats.atk + playerStats.def + playerStats.speed;
    const desc = skillDescription.toLowerCase();
    
    // 禁止効果チェック（より厳格）
    for (const banned of CUSTOM_SKILL_VALIDATION.bannedEffects) {
        if (desc.includes(banned.toLowerCase())) {
            return { 
                valid: false, 
                reason: `この効果はゲームバランスを崩壊させるため許可されていません: "${banned}"` 
            };
        }
    }
    
    // 効果の強度を推定（より詳細なAI判定）
    let estimatedStrength = "tier1";
    let estimatedMultiplier = 1.0;
    
    // ダメージ倍率の抽出（より広範なパターン）
    const multiplierMatches = desc.match(/(\d+\.?\d*)\s*倍|(\d+\.?\d*)\s*%|(\d+\.?\d*)x|(\d+\.?\d*)\s*times/i);
    if (multiplierMatches) {
        const num = parseFloat(multiplierMatches[1] || multiplierMatches[2] || multiplierMatches[3] || multiplierMatches[4]);
        if (!isNaN(num)) {
            if (desc.includes('%')) {
                estimatedMultiplier = 1 + (num / 100);
            } else {
                estimatedMultiplier = num;
            }
        }
    }
    
    // キーワードベースの強度判定（緩和された判定 - より広範な解釈）
    if (estimatedMultiplier >= 3.0 || desc.includes('3倍') || desc.includes('3.0') || desc.includes('3x') || desc.includes('triple')) {
        estimatedStrength = "tier15";
    } else if (estimatedMultiplier >= 2.5 || desc.includes('2.5') || desc.includes('2.5x')) {
        estimatedStrength = "tier14";
    } else if (estimatedMultiplier >= 2.0 || desc.includes('2.0') || desc.includes('double') || desc.includes('2x') || desc.includes('二倍')) {
        estimatedStrength = "tier13";
    } else if (estimatedMultiplier >= 1.8 || desc.includes('1.8x') || desc.includes('1.9x')) {
        estimatedStrength = "tier12";
    } else if (estimatedMultiplier >= 1.6 || desc.includes('1.6x') || desc.includes('1.7x')) {
        estimatedStrength = "tier11";
    } else if (estimatedMultiplier >= 1.5 || desc.includes('1.5x') || desc.includes('50%up') || desc.includes('半分')) {
        estimatedStrength = "tier10";
    } else if (estimatedMultiplier >= 1.4 || desc.includes('1.4x')) {
        estimatedStrength = "tier9";
    } else if (estimatedMultiplier >= 1.3 || desc.includes('1.3x') || desc.includes('30%up')) {
        estimatedStrength = "tier8";
    } else if (estimatedMultiplier >= 1.25 || desc.includes('1.25x')) {
        estimatedStrength = "tier7";
    } else if (estimatedMultiplier >= 1.2 || desc.includes('25%') || desc.includes('30%') || desc.includes('少し') || desc.includes('1.2x') || desc.includes('20%up')) {
        estimatedStrength = "tier6";
    } else if (estimatedMultiplier >= 1.15 || desc.includes('1.15x')) {
        estimatedStrength = "tier5";
    } else if (estimatedMultiplier >= 1.1 || desc.includes('10%') || desc.includes('15%') || desc.includes('わずか') || desc.includes('1.1x') || desc.includes('10%up')) {
        estimatedStrength = "tier4";
    } else if (estimatedMultiplier >= 1.05 || desc.includes('5%') || desc.includes('1.05x')) {
        estimatedStrength = "tier3";
    } else if (estimatedMultiplier > 1.0) {
        estimatedStrength = "tier2";
    }
    
    // 特殊効果の補正（緩和された判定 - より広範な解釈）
    if (desc.includes('リスポーン') || desc.includes('復活') || desc.includes('respawn') || desc.includes('revive') || desc.includes('resurrect')) {
        estimatedStrength = "tier13";
    } else if (desc.includes('即死') || desc.includes('一撃') || desc.includes('instant') || desc.includes('onehit') || desc.includes('kill')) {
        estimatedStrength = "tier14";
    } else if (desc.includes('インビジブル') || desc.includes('透明') || desc.includes('invisible') || desc.includes('stealth') || desc.includes('hide')) {
        estimatedStrength = "tier11";
    } else if (desc.includes('リフレクト') || desc.includes('反射') || desc.includes('reflect') || desc.includes('mirror')) {
        estimatedStrength = "tier11";
    } else if (desc.includes('範囲') || desc.includes('全体') || desc.includes('aoe') || desc.includes('area') || desc.includes('splash')) {
        estimatedStrength = "tier10";
    } else if (desc.includes('スタン') || desc.includes('気絶') || desc.includes('stun') || desc.includes('paralyze') || desc.includes('freeze')) {
        estimatedStrength = "tier9";
    } else if (desc.includes('バーサーク') || desc.includes('狂化') || desc.includes('berserk') || desc.includes('rage') || desc.includes('frenzy')) {
        estimatedStrength = "tier10";
    } else if (desc.includes('エクスキュート') || desc.includes('処刑') || desc.includes('execute') || desc.includes('finish') || desc.includes('finisher')) {
        estimatedStrength = "tier12";
    } else if (desc.includes('回復') && (desc.includes('50%') || desc.includes('半分') || desc.includes('大幅') || desc.includes('full') || desc.includes('完全'))) {
        estimatedStrength = "tier10";
    } else if (desc.includes('無効') || desc.includes('パリー') || desc.includes('完全防御') || desc.includes('無傷') || desc.includes('nullify') || desc.includes('negate') || desc.includes('block')) {
        estimatedStrength = "tier11";
    } else if (desc.includes('回避') && (desc.includes('50%') || desc.includes('半分') || desc.includes('確実') || desc.includes('完全'))) {
        estimatedStrength = "tier10";
    } else if (desc.includes('貫通') && (desc.includes('完全') || desc.includes('100%') || desc.includes('true'))) {
        estimatedStrength = "tier10";
    } else if (desc.includes('回復') && (desc.includes('30%') || desc.includes('1/3') || desc.includes('中程度'))) {
        estimatedStrength = "tier8";
    } else if (desc.includes('回避') || desc.includes('dodge') || desc.includes('evade') || desc.includes('miss')) {
        estimatedStrength = "tier8";
    } else if (desc.includes('貫通') || desc.includes('pierce') || desc.includes('penetrate') || desc.includes('ignore')) {
        estimatedStrength = "tier8";
    } else if (desc.includes('吸収') || desc.includes('ライフスティール') || desc.includes('vampiric') || desc.includes('lifesteal') || desc.includes('drain')) {
        estimatedStrength = "tier8";
    } else if (desc.includes('カウンター') || desc.includes('反撃') || desc.includes('counter') || desc.includes('retaliate') || desc.includes('revenge')) {
        estimatedStrength = "tier9";
    } else if (desc.includes('シールド') || desc.includes('バリア') || desc.includes('shield') || desc.includes('barrier') || desc.includes('protect')) {
        estimatedStrength = "tier7";
    } else if (desc.includes('クリティカル') || desc.includes('会心') || desc.includes('critical') || desc.includes('crit') || desc.includes('致命')) {
        estimatedStrength = "tier7";
    } else if (desc.includes('連続') || desc.includes('複数') || desc.includes('multi') || desc.includes('combo') || desc.includes('chain')) {
        estimatedStrength = "tier8";
    } else if (desc.includes('テレポート') || desc.includes('瞬間移動') || desc.includes('teleport') || desc.includes('blink') || desc.includes('dash')) {
        estimatedStrength = "tier8";
    } else if (desc.includes('呪い') || desc.includes('カース') || desc.includes('デバフ') || desc.includes('弱体化') || desc.includes('curse') || desc.includes('debuff') || desc.includes('weaken')) {
        estimatedStrength = "tier6";
    } else if (desc.includes('毒') || desc.includes('poison') || desc.includes('burn') || desc.includes('burning') || desc.includes('bleed')) {
        estimatedStrength = "tier5";
    } else if (desc.includes('リジェネ') || desc.includes('再生') || desc.includes('regen') || desc.includes('regeneration') || desc.includes('restore')) {
        estimatedStrength = "tier5";
    } else if (desc.includes('バフ') || desc.includes('強化') || desc.includes('buff') || desc.includes('enhance') || desc.includes('boost')) {
        estimatedStrength = "tier4";
    } else if (desc.includes('スロー') || desc.includes('遅延') || desc.includes('slow') || desc.includes('delay') || desc.includes('hindrance')) {
        estimatedStrength = "tier4";
    } else if (desc.includes('回復') || desc.includes('heal') || desc.includes('cure') || desc.includes('recover')) {
        estimatedStrength = "tier3";
    }
    
    // パースされたeffectオブジェクトに基づいて効果数をカウント
    const parsedEffect = parseEffectFromDescription(description);
    let effectCount = 0;
    
    if (parsedEffect) {
        if (parsedEffect.damageMultiplier) effectCount++;
        if (parsedEffect.damageReduction) effectCount++;
        if (parsedEffect.lifeSteal) effectCount++;
        if (parsedEffect.heal) effectCount++;
        if (parsedEffect.healPercent) effectCount++;
        if (parsedEffect.sureHit) effectCount++;
        if (parsedEffect.ignoreDef) effectCount++;
        if (parsedEffect.nextAttackCrit) effectCount++;
        if (parsedEffect.critChance) effectCount++;
        if (parsedEffect.burn) effectCount++;
        if (parsedEffect.poison) effectCount++;
        if (parsedEffect.speedDebuff) effectCount++;
        if (parsedEffect.shield) effectCount++;
        if (parsedEffect.dodgeChance) effectCount++;
        if (parsedEffect.counter) effectCount++;
        if (parsedEffect.multiHit) effectCount++;
        if (parsedEffect.skipNextTurn) effectCount++;
        if (parsedEffect.defDebuff) effectCount++;
    }
    
    // 複合効果によるランクアップ（ティアシステム対応）
    const strengthLevels = ["tier1", "tier2", "tier3", "tier4", "tier5", "tier6", "tier7", "tier8", "tier9", "tier10", "tier11", "tier12", "tier13", "tier14", "tier15"];
    const currentIndex = strengthLevels.indexOf(estimatedStrength);
    
    if (effectCount >= 4) {
        // 4つ以上の効果で3ティア昇格
        if (currentIndex < strengthLevels.length - 3) {
            estimatedStrength = strengthLevels[currentIndex + 3];
        } else {
            estimatedStrength = strengthLevels[strengthLevels.length - 1];
        }
    } else if (effectCount >= 3) {
        // 3つの効果で2ティア昇格
        if (currentIndex < strengthLevels.length - 2) {
            estimatedStrength = strengthLevels[currentIndex + 2];
        } else {
            estimatedStrength = strengthLevels[strengthLevels.length - 1];
        }
    } else if (effectCount >= 2) {
        // 2つの効果で1ティア昇格
        if (currentIndex < strengthLevels.length - 1) {
            estimatedStrength = strengthLevels[currentIndex + 1];
        } else {
            estimatedStrength = strengthLevels[strengthLevels.length - 1];
        }
    }
    
    const requirement = CUSTOM_SKILL_VALIDATION.statRequirements[estimatedStrength];
    
    // ティア15（宇宙崩壊レベル）は許可（緩和）
    // 即死や無限ダメージなどの極端な効果はbannedEffectsでフィルタリング済み
    
    if (totalStats < requirement.totalStats) {
        return { 
            valid: false, 
            reason: `ステータスが不足しています。効果強度: ${requirement.description}、必要ステータス: 合計${requirement.totalStats}、現在: 合計${totalStats}` 
        };
    }
    
    return { valid: true, strength: estimatedStrength, requiredStats: requirement.totalStats, description: requirement.description };
}

// スキル説明文からeffectオブジェクトを簡易的に生成
function parseEffectFromDescription(description) {
    const finalEffect = { type: "active" }; // 必ず active タイプを付与
    const desc = description.toLowerCase();
    let effectFound = false;

    // --- 効果のパース（拡張版 - 複数効果対応） ---
    
    // 複数回攻撃 (例: "3段攻撃", "3回攻撃", "triple attack", "3-hit attack")
    const multiHitMatch = desc.match(/(\d+)[\s]*(?:段|回)[\s]*攻撃/i);
    if (multiHitMatch) { finalEffect.multiHit = parseInt(multiHitMatch[1]); effectFound = true; }
    
    // 英語版複数回攻撃 (例: "3-hit attack", "triple attack")
    const multiHitEnglishMatch = desc.match(/(\d+)[\s]*-[\s]*hit[\s]*attack|triple[\s]*attack|double[\s]*attack/i);
    if (multiHitEnglishMatch) {
        if (multiHitEnglishMatch[0].includes('triple')) {
            finalEffect.multiHit = 3;
        } else if (multiHitEnglishMatch[0].includes('double')) {
            finalEffect.multiHit = 2;
        } else if (multiHitEnglishMatch[1]) {
            finalEffect.multiHit = parseInt(multiHitEnglishMatch[1]);
        }
        effectFound = true;
    }
    
    // 連続攻撃キーワード (例: "連続攻撃", "combo attack")
    if (desc.includes("連続攻撃") || desc.includes("combo attack") || desc.includes("連続")) {
        if (!finalEffect.multiHit) {
            finalEffect.multiHit = 2; // デフォルトで2回
        }
        effectFound = true;
    }
    
    // ダメージ倍率 (例: "ダメージ1.2倍", "攻撃が1.5倍", "damage 1.5x", "1.5倍ダメージ")
    const damageMultiplierMatch = desc.match(/(?:ダメージ|攻撃|damage|attack)[をが]?[\s]*([\d.]+)[\s]*(?:倍|x|times)/i);
    if (damageMultiplierMatch) { finalEffect.damageMultiplier = parseFloat(damageMultiplierMatch[1]); effectFound = true; }
    
    // 単独の倍率パターン (例: "0.5倍", "1.2x") - 複数回攻撃と競合しないように
    const simpleMultiplierMatch = desc.match(/([\d.]+)[\s]*(?:倍|x)(?!.*段)(?!.*回攻撃)/i);
    if (simpleMultiplierMatch && !damageMultiplierMatch) {
        const num = parseFloat(simpleMultiplierMatch[1]);
        finalEffect.damageMultiplier = num;
        effectFound = true;
    }
    
    // パーセンテージ倍率 (例: "150%ダメージ", "50%up")
    const percentMultiplierMatch = desc.match(/([\d.]+)%[\s]*(?:ダメージ|damage|up|増加)/i);
    if (percentMultiplierMatch) {
        finalEffect.damageMultiplier = 1 + (parseFloat(percentMultiplierMatch[1]) / 100);
        effectFound = true;
    }

    // ダメージ軽減 (例: "ダメージを30%軽減", "30% damage reduction")
    const damageReductionMatch = desc.match(/(?:ダメージ|damage)[をが]?[\s]*([\d.]+)%[\s]*(?:軽減|reduction)/i);
    if (damageReductionMatch) { finalEffect.damageReduction = parseFloat(damageReductionMatch[1]) / 100.0; effectFound = true; }

    // ライフスティール (例: "与えたダメージの30%を吸収", "30% lifesteal", "30% life steal")
    const lifeStealMatch = desc.match(/(?:与えたダメージの|lifesteal|life steal)[\s]*([\d.]+)%/i);
    if (lifeStealMatch) { finalEffect.lifeSteal = parseFloat(lifeStealMatch[1]) / 100.0; effectFound = true; }

    // 回復 (例: "HPを30回復", "heal 30", "recover 30 hp")
    const healMatch = desc.match(/(?:hp|health)[\s]*(?:を|to)?[\s]*([\d.]+)[\s]*(?:回復|heal|recover)/i);
    if (healMatch) { finalEffect.heal = parseFloat(healMatch[1]); effectFound = true; }
    
    // 回復率 (例: "HPの30%回復", "30% heal")
    const healPercentMatch = desc.match(/(?:hp|health)[\s]*(?:の|of)?[\s]*([\d.]+)%[\s]*(?:回復|heal)/i);
    if (healPercentMatch) { finalEffect.healPercent = parseFloat(healPercentMatch[1]) / 100.0; effectFound = true; }

    // 必中 (例: "攻撃を必中にする", "sure hit", "always hit")
    if (desc.includes("必中") || desc.includes("sure hit") || desc.includes("always hit")) { finalEffect.sureHit = true; effectFound = true; }

    // 防御無視 (例: "敵の防御を無視", "ignore defense", "pierce defense")
    if (desc.includes("防御無視") || desc.includes("ignore defense") || desc.includes("pierce defense") || desc.includes("貫通")) { finalEffect.ignoreDef = true; effectFound = true; }

    // クリティカル確定 (例: "次の攻撃は必ずクリティカル", "guaranteed crit", "always critical")
    if (desc.includes("必ずクリティカル") || desc.includes("guaranteed crit") || desc.includes("always critical")) { finalEffect.nextAttackCrit = true; effectFound = true; }

    // クリティカル率アップ (例: "クリティカル率30%アップ", "30% crit chance")
    const critChanceMatch = desc.match(/(?:クリティカル|crit)[\s]*(?:率|chance)?[\s]*([\d.]+)%/i);
    if (critChanceMatch) { finalEffect.critChance = parseFloat(critChanceMatch[1]) / 100.0; effectFound = true; }

    // 火傷付与 (例: "敵に火傷付与", "burn enemy", "apply burn")
    if (desc.includes("火傷") || desc.includes("burn")) { finalEffect.burn = true; effectFound = true; }
    
    // 毒付与 (例: "敵に毒付与", "poison enemy", "apply poison")
    if (desc.includes("毒") || desc.includes("poison")) { finalEffect.poison = true; effectFound = true; }

    // 速度低下 (例: "敵の速さを20%低下", "reduce speed by 20%", "slow 20%")
    const speedDebuffMatch = desc.match(/(?:速さ|speed)[\s]*(?:を|by)?[\s]*([\d.]+)%[\s]*(?:低下|reduce|slow)/i);
    if (speedDebuffMatch) { finalEffect.speedDebuff = parseFloat(speedDebuffMatch[1]) / 100.0; effectFound = true; }

    // シールド (例: "シールド30", "shield 30", "barrier 30")
    const shieldMatch = desc.match(/(?:シールド|shield|barrier)[\s]*([\d.]+)/i);
    if (shieldMatch) { finalEffect.shield = parseFloat(shieldMatch[1]); effectFound = true; }

    // 回避率アップ (例: "回避率30%アップ", "30% dodge chance", "30% evade")
    const dodgeMatch = desc.match(/(?:回避|dodge|evade)[\s]*(?:率|chance)?[\s]*([\d.]+)%/i);
    if (dodgeMatch) { finalEffect.dodgeChance = parseFloat(dodgeMatch[1]) / 100.0; effectFound = true; }

    // 反撃 (例: "反撃する", "counter attack", "retaliate")
    if (desc.includes("反撃") || desc.includes("counter") || desc.includes("retaliate")) { finalEffect.counter = true; effectFound = true; }

    // --- デメリット/コストのパース ---
    // 自身の防御デバフ (例: "自身の防御-10", "self defense -10")
    const selfDefDebuffMatch = desc.match(/(?:自身|self)[\s]*(?:の|)?[\s]*(?:防御|defense)[\s]*-([\d.]+)/i);
    if (selfDefDebuffMatch) { finalEffect.selfDefDebuff = parseFloat(selfDefDebuffMatch[1]); effectFound = true; }

    // 次のターンスキップ (例: "次のターン行動できない", "skip next turn")
    if (desc.includes("行動できない") || desc.includes("skip") || desc.includes("skip turn")) { finalEffect.skipNextTurn = true; effectFound = true; }

    // --- 条件のパース ---
    // HP条件 (例: "hpが50%以下の時", "when hp below 50%", "hp < 50%")
    const hpConditionMatch = desc.match(/(?:hp|health)[\s]*(?:が|is|below|<)[\s]*([\d.]+)%/i);
    if (hpConditionMatch) {
        finalEffect.condition = { type: 'hp_below', value: parseFloat(hpConditionMatch[1]) / 100 };
        effectFound = true;
    }

    // 何かしらの効果がパースできた場合のみ effect オブジェクトを返す
    return effectFound ? finalEffect : null;
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
    // CSSはstyle.cssに直接追加したため、この関数は何もしない
    return;
}

function renderSkillTreeUI() {
    const container = document.getElementById('skillTreeContainer');
    if (!container) {
        console.log('renderSkillTreeUI: skillTreeContainer not found');
        return;
    }

    const player = getPlayerData();
    if (!player) {
        container.innerHTML = '<p>プレイヤーデータが見つかりません。</p>';
        return;
    }

    // index.htmlの静的UIを使用するため、動的生成は行わない
    // スキルポイント表示のみ更新
    const totalSkillPointsDisplay = document.getElementById('totalSkillPointsDisplay');
    if (totalSkillPointsDisplay) {
        totalSkillPointsDisplay.textContent = `総スキルポイント: ${player.skillTree?.availablePoints || 0}`;
    }

    // 初期表示
    renderTree();

    renderSkillSlots(player);
    renderAvailableSkills(player);
    renderCustomSkillList(player);
    
    // スキル説明表示エリアを作成
    if (!document.getElementById('skillDescriptionArea')) {
        const descArea = document.createElement('div');
        descArea.id = 'skillDescriptionArea';
        descArea.style.marginTop = '16px';
        descArea.style.padding = '12px';
        descArea.style.backgroundColor = '#f8f9fa';
        descArea.style.border = '1px solid #dee2e6';
        descArea.style.borderRadius = '8px';
        descArea.style.display = 'none';
        descArea.innerHTML = '<p>スキルを選択してください</p>';
        container.appendChild(descArea);
    }

    // イベントリスナー（index.htmlの静的UIのボタンに対応）
    const createCustomSkillBtn = document.getElementById('createCustomSkillBtn');
    if (createCustomSkillBtn) {
        createCustomSkillBtn.onclick = () => {
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
                // 入力をクリア
                document.getElementById('customSkillName').value = '';
                document.getElementById('customSkillDescription').value = '';
                renderSkillTreeUI(); // UI全体を再描画
                if (typeof updateStatus === 'function') updateStatus(result.player);
            } else {
                alert(`作成に失敗しました:\n${result.error}`);
            }
        };
    }
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
    const content = document.getElementById('skillTreeCanvas');
    const pointsDisplay = document.getElementById('totalSkillPointsDisplay');
    if (!content || !pointsDisplay) {
        console.log('renderTree: content or pointsDisplay not found');
        return;
    }

    const player = getPlayerData();
    if (!player) {
        console.log('renderTree: player not found');
        return;
    }
    
    const treeData = SKILL_TREE;
    const playerData = player.skillTree;

    pointsDisplay.textContent = `総スキルポイント: ${playerData.availablePoints || 0}`;
    content.innerHTML = ''; // コンテンツをクリア

    // 1. Find bounds of the tree
    const allX = treeData.nodes.map(n => n.x);
    const allY = treeData.nodes.map(n => n.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);

    // 2. Calculate offsets and total size with padding
    const PADDING = 80;
    const NODE_H_SPACING = 80;
    const NODE_V_SPACING = 70;
    const NODE_WIDTH = 60;
    const NODE_HEIGHT = 40;

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
    
    console.log('renderTree: created inner content and SVG');

    // 最初に接続線を描画
    console.log('renderTree: drawing connections');
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
    console.log('renderTree: drawing nodes');
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

        // クリックイベント（説明表示）
        nodeEl.onclick = (e) => {
            e.stopPropagation();
            showSkillDescription(node, isUnlocked, isUnlockable);
        };
        
        // ダブルクリックイベント（習得）
        nodeEl.ondblclick = (e) => {
            e.stopPropagation();
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
            } else if (isUnlocked) {
                alert('このスキルは既に習得済みです。');
            } else {
                alert('このスキルはまだ習得できません。前提スキルを解放してください。');
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
        setTimeout(() => { // Give a slight delay for rendering
            content.scrollTop = nodeY - (content.clientHeight / 2) + (NODE_HEIGHT / 2);
            content.scrollLeft = nodeX - (content.clientWidth / 2) + (NODE_WIDTH / 2);
        }, 50);
    }
    
    console.log('renderTree: rendering complete');
}

function showSkillDescription(node, isUnlocked, isUnlockable) {
    const descArea = document.getElementById('skillDescriptionArea');
    if (!descArea) return;
    
    let statusText = '';
    if (isUnlocked) {
        statusText = '<span style="color: #28a745;">習得済み</span>';
    } else if (isUnlockable) {
        statusText = '<span style="color: #ffc107;">習得可能（ダブルクリックで習得）</span>';
    } else {
        statusText = '<span style="color: #6c757d;">未解放</span>';
    }
    
    descArea.style.display = 'block';
    descArea.innerHTML = `
        <h3 style="margin-top: 0; color: var(--primary-color);">${node.name}</h3>
        <p><strong>タイプ:</strong> ${node.type}</p>
        <p><strong>説明:</strong> ${node.description}</p>
        <p><strong>コスト:</strong> ${node.cost} スキルポイント</p>
        <p><strong>状態:</strong> ${statusText}</p>
        ${node.requires ? `<p><strong>前提スキル:</strong> ${Array.isArray(node.requires) ? node.requires.join(', ') : node.requires}</p>` : ''}
    `;
}

function renderSkillSlots(player) {
    const slotsContainer = document.getElementById('skillSlotsContainer');
    if (!slotsContainer) {
        console.log('renderSkillSlots: skillSlotsContainer not found');
        return;
    }

    console.log('renderSkillSlots: player.skillSlots =', player.skillSlots);
    
    slotsContainer.innerHTML = '';
    
    // 空のスロットを確実に表示
    if (!player.skillSlots || player.skillSlots.length === 0) {
        player.skillSlots = [null, null, null];
    }
    
    player.skillSlots.forEach((skill, index) => {
        const slotEl = document.createElement('div');
        slotEl.className = 'skill-slot';
        slotEl.dataset.slotIndex = index;
        
        // ドロップゾーンとして設定
        slotEl.ondragover = (e) => {
            e.preventDefault();
            slotEl.classList.add('drag-over');
        };
        
        slotEl.ondragleave = () => {
            slotEl.classList.remove('drag-over');
        };
        
        slotEl.ondrop = (e) => {
            e.preventDefault();
            slotEl.classList.remove('drag-over');
            const skillId = e.dataTransfer.getData('skillId');
            const skillName = e.dataTransfer.getData('skillName');
            
            if (skillId) {
                const result = equipSkillToSlot(getPlayerData(), skillId, index);
                if (result.success) {
                    localStorage.setItem("player", JSON.stringify(result.player));
                    renderSkillTreeUI();
                } else {
                    alert(result.error);
                }
            }
        };
        
        if (skill) {
            slotEl.classList.add('filled');
            // レガシースキルのプロパティチェック
            const skillName = skill.name || "名前なし";
            const skillId = skill.id || `legacy_${index}`;
            const skillDescription = skill.description || "説明なし";
            
            slotEl.innerHTML = `<span>${skillName}</span><button class="unequip-skill-btn" data-skill-id="${skillId}">X</button>`;
            slotEl.title = skillDescription;
        } else {
            slotEl.textContent = `スロット ${index + 1}`;
            slotEl.classList.add('empty');
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
    customSkills.forEach((skill, index) => {
        // レガシースキルのプロパティチェック
        if (!skill.id) {
            skill.id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }
        if (!skill.name) {
            skill.name = "名前なし";
        }
        if (!skill.description) {
            skill.description = "説明なし";
        }
        
        const li = document.createElement('li');
        li.className = 'custom-skill-item';
        li.innerHTML = `
            <div class="skill-info">
                <strong>${skill.name}</strong>: ${skill.description}
            </div>
            <button class="delete-skill-btn" data-skill-index="${index}" data-skill-id="${skill.id}">削除</button>
        `;
        ul.appendChild(li);
    });
    listContainer.appendChild(ul);
    
    // 削除ボタンのイベントリスナー
    listContainer.querySelectorAll('.delete-skill-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const skillIndex = parseInt(btn.dataset.skillIndex);
            const skillId = btn.dataset.skillId;
            
            if (confirm(`このスキルを削除しますか？削除したスキルは復元できません。`)) {
                const player = getPlayerData();
                if (player.customSkills && player.customSkills[skillIndex]) {
                    // スキルスロットからも削除
                    player.skillSlots = player.skillSlots.map(slot => {
                        if (slot && slot.id === skillId) {
                            return null;
                        }
                        return slot;
                    });
                    
                    // カスタムスキルを削除
                    player.customSkills.splice(skillIndex, 1);
                    
                    localStorage.setItem("player", JSON.stringify(player));
                    renderSkillTreeUI();
                }
            }
        };
    });
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
        li.textContent = skill.name || "名前なし";
        li.title = skill.description || "説明なし";
        li.draggable = true;
        li.dataset.skillId = skill.id;
        
        // ドラッグ開始
        li.ondragstart = (e) => {
            e.dataTransfer.setData('skillId', skill.id);
            e.dataTransfer.setData('skillName', skill.name || "名前なし");
        };
        
        // クリックで装備（従来の方法も残す）
        li.onclick = () => {
            // 最初の空スロットを自動的に選択
            const emptySlotIndex = player.skillSlots.findIndex(s => s === null);
            if (emptySlotIndex === -1) {
                alert("空いているスロットがありません。まずスキルを外してください。");
                return;
            }
            
            const result = equipSkillToSlot(getPlayerData(), skill.id, emptySlotIndex);
            if (result.success) {
                localStorage.setItem("player", JSON.stringify(result.player));
                renderSkillTreeUI();
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