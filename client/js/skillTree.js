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
            { id: "ss_hp_1", name: "体力強化", description: "HP+5", effect: { maxHp: 5 }, cost: 1, x: 0, y: 0, type: "stat" },
            { id: "ss_hp_0", name: "生命の源", description: "HP+10", effect: { maxHp: 10 }, cost: 0, x: 0, y: -1, type: "stat" }, // 開始ノード例
            { id: "ss_hp_2", name: "体力強化II", description: "HP+10", effect: { maxHp: 10 }, cost: 2, x: 0, y: 1, requires: "ss_hp_1", type: "stat" },
            { id: "ss_hp_3", name: "体力強化III", description: "HP+15", effect: { maxHp: 15 }, cost: 3, x: 0, y: 2, requires: "ss_hp_2", type: "stat" },
            
            { id: "ss_def_1", name: "防御強化", description: "防御+5", effect: { def: 5 }, cost: 1, x: 1, y: 0, type: "stat" },
            { id: "ss_def_2", name: "防御強化II", description: "防御+10", effect: { def: 10 }, cost: 2, x: 1, y: 1, requires: "ss_def_1", type: "stat" },
            { id: "ss_def_3", name: "防御強化III", description: "防御+15", effect: { def: 15 }, cost: 3, x: 1, y: 2, requires: "ss_def_2", type: "stat" },
            
            { id: "ss_atk_1", name: "攻撃強化", description: "攻撃+5", effect: { atk: 5 }, cost: 1, x: -1, y: 0, type: "stat" },
            { id: "ss_atk_2", name: "攻撃強化II", description: "攻撃+10", effect: { atk: 10 }, cost: 2, x: -1, y: 1, requires: "ss_atk_1", type: "stat" },
            { id: "ss_atk_3", name: "攻撃強化III", description: "攻撃+15", effect: { atk: 15 }, cost: 3, x: -1, y: 2, requires: "ss_atk_2", type: "stat" },
            
            // アクティブスキルノード
            { id: "ss_shield_bash", name: "シールドバッシュ", description: "次の攻撃のダメージ1.2倍", effect: { type: "active", damageMultiplier: 1.2 }, cost: 3, x: 2, y: 1, requires: "ss_def_2", type: "active" },
            { id: "ss_guard_stance", name: "ガードスタンス", description: "次に受けるダメージを30%軽減", effect: { type: "active", damageReduction: 0.3 }, cost: 3, x: 2, y: 2, requires: "ss_shield_bash", type: "active" },
            { id: "ss_counter", name: "カウンター", description: "攻撃を受けた後、次の攻撃のダメージ1.5倍", effect: { type: "active", counterAttack: 1.5 }, cost: 4, x: 3, y: 2, requires: "ss_guard_stance", type: "active" },
            
            { id: "ss_heavy_strike", name: "ヘヴィストライク", description: "次の攻撃のダメージ1.3倍", effect: { type: "active", damageMultiplier: 1.3 }, cost: 3, x: -2, y: 1, requires: "ss_atk_2", type: "active" },
            { id: "ss_berserk", name: "バーサーク", description: "HPが50%以下の時、次の攻撃のダメージ2倍", effect: { type: "active", berserk: 2.0 }, cost: 4, x: -2, y: 2, requires: "ss_heavy_strike", type: "active" },
            
            // パッシブスキルノード
            { id: "ss_iron_skin", name: "アイアンスキン", description: "常時防御+10", effect: { type: "passive", def: 10 }, cost: 4, x: 0, y: 3, requires: ["ss_hp_3", "ss_def_3"], type: "passive" },
            { id: "ss_weapon_mastery", name: "ウェポンマスタリー", description: "常時攻撃+10", effect: { type: "passive", atk: 10 }, cost: 4, x: -1, y: 3, requires: "ss_atk_3", type: "passive" },
            { id: "ss_fortress", name: "要塞", description: "常時HP+20、防御+5", effect: { type: "passive", maxHp: 20, def: 5 }, cost: 5, x: 1, y: 3, requires: "ss_iron_skin", type: "passive" }, // ss_iron_skinから分岐

            // 長槍系ノードの例 (x座標をずらして配置)
            { id: "sp_speed_1", name: "俊敏", description: "速さ+5", effect: { speed: 5 }, cost: 1, x: -2, y: 0, requires: "ss_atk_1", type: "stat" },
            { id: "sp_speed_2", name: "俊敏II", description: "速さ+10", effect: { speed: 10 }, cost: 2, x: -3, y: 0, requires: "sp_speed_1", type: "stat" },
            { id: "sp_pierce", name: "ピアース", description: "次の攻撃のダメージ1.1倍、敵防御無視", effect: { type: "active", damageMultiplier: 1.1, ignoreDef: true }, cost: 3, x: -4, y: 0, requires: "sp_speed_2", type: "active" },

            // 大剣系ノードの例
            { id: "gs_power_1", name: "剛力", description: "攻撃+10", effect: { atk: 10 }, cost: 1, x: -2, y: -1, requires: "ss_atk_1", type: "stat" },
            { id: "gs_power_2", name: "剛力II", description: "攻撃+15", effect: { atk: 15 }, cost: 2, x: -3, y: -1, requires: "gs_power_1", type: "stat" },
            { id: "gs_cleave", name: "クリーブ", description: "次の攻撃のダメージ1.4倍、ただし自身の防御-10", effect: { type: "active", damageMultiplier: 1.4, selfDefDebuff: 10 }, cost: 4, x: -4, y: -1, requires: "gs_power_2", type: "active" },

            // 魔法の杖系ノードの例
            { id: "mw_mana_1", name: "魔力", description: "スキルコスト-1", effect: { skillCostReduction: 1 }, cost: 1, x: 2, y: -1, requires: "ss_def_1", type: "stat" },
            { id: "mw_mana_2", name: "魔力II", description: "スキルコスト-2", effect: { skillCostReduction: 2 }, cost: 2, x: 3, y: -1, requires: "mw_mana_1", type: "stat" },
            { id: "mw_fireball", name: "ファイアボール", description: "次の攻撃のダメージ1.2倍、敵に火傷付与", effect: { type: "active", damageMultiplier: 1.2, burn: true }, cost: 3, x: 4, y: -1, requires: "mw_mana_2", type: "active" },

            // ここにさらにノードを追加して、ツリーを広げてください！
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
    
    return { success: true, player };
}

// スキルノードの効果を取得
function getSkillNodeEffects(player) {
    player = initializeSkillData(player);
    
    const effects = {
        passive: { maxHp: 0, atk: 0, def: 0, speed: 0 },
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
            for (const stat in node.effect) {
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
}

.skill-slot-wrapper h3, .custom-skill-wrapper h3 {
    margin-top: 0;
    color: #333;
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

    // SVGコンテナを作成して線を描画
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    content.appendChild(svg);

    // 最初に接続線を描画
    treeData.nodes.forEach(node => {
        if (node.requires) {
            const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
            requirements.forEach(reqId => {
                const requiredNode = treeData.nodes.find(n => n.id === reqId);
                if (requiredNode) {
                    const nodeX = node.x * 80 + 400;
                    const nodeY = node.y * 80 + 50;
                    const reqNodeX = requiredNode.x * 80 + 400;
                    const reqNodeY = requiredNode.y * 80 + 50;
                    // ノードの中心に線を引く
                    drawConnection(svg, reqNodeX + 40, reqNodeY + 30, nodeX + 40, nodeY + 30, playerData.unlockedNodes.includes(node.id));
                }
            });
        }
    });

    // 次にノードを描画（線の上に表示するため）
    treeData.nodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = `skill-node ${node.type}`;
        const nodeX = node.x * 80 + 400;
        const nodeY = node.y * 80 + 50;
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

        content.appendChild(nodeEl);
    });
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