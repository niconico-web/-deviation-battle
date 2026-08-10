// ============================================
// スキルツリーシステム
// Path of Exile style extensive skill trees
// ============================================

// スキルポイント獲得量（レベルアップごと）
const SKILL_POINTS_PER_LEVEL = 2;

// 武器種別ごとのスキルツリー定義
const SKILL_TREES = {
    sword_shield: {
        name: "片手剣＋盾",
        description: "防御と攻撃のバランスを重視したスキルツリー",
        nodes: [
            // 基礎ステータスノード
            { id: "ss_hp_1", name: "体力強化", description: "HP+5", effect: { maxHp: 5 }, cost: 1, x: 0, y: 0, type: "stat" },
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
            { id: "ss_fortress", name: "要塞", description: "常時HP+20、防御+5", effect: { type: "passive", maxHp: 20, def: 5 }, cost: 5, x: 1, y: 3, requires: "ss_iron_skin", type: "passive" },
        ]
    },
    
    spear: {
        name: "長槍",
        description: "攻撃と速さを重視したスキルツリー",
        nodes: [
            // ... more nodes
        ]
    },
    
    greatsword: {
        name: "大剣",
        description: "攻撃力特化のスキルツリー",
        nodes: [
            // ... more nodes
        ]
    },
    
    dual_swords: {
        name: "双剣",
        description: "速さと連続攻撃を重視したスキルツリー",
        nodes: [
            // ... more nodes
        ]
    },
    
    scythe: {
        name: "鎌",
        description: "全ステータスバランス型のスキルツリー",
        nodes: [
            // ... more nodes
        ]
    },
    
    pistol: {
        name: "ピストル",
        description: "速さとHPを重視したスキルツリー",
        nodes: [
            // ... more nodes
        ]
    },
    
    katana: {
        name: "刀",
        description: "防御と速さを重視したスキルツリー",
        nodes: [
            // ... more nodes
        ]
    },
    
    magic_wand: {
        name: "魔法の杖",
        description: "攻撃とHPを重視したスキルツリー",
        nodes: [
            // ... more nodes
        ]
    }
};

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
    if (!player.skillTrees) {
        player.skillTrees = {};
    }
    
    // 全武器種のスキルツリーを初期化
    for (const weaponType in SKILL_TREES) {
        if (!player.skillTrees[weaponType]) {
            player.skillTrees[weaponType] = {
                unlockedNodes: [], // アンロックしたノードIDのリスト
                availablePoints: 0 // その武器種で使用可能なスキルポイント
            };
        }
    }
    
    // 総スキルポイントを初期化
    if (player.totalSkillPoints == null) {
        player.totalSkillPoints = 0;
    }
    
    return player;
}

// レベルアップ時のスキルポイント付与
function addSkillPointsOnLevelUp(player, oldLevel, newLevel) {
    const levelsGained = newLevel - oldLevel;
    const pointsGained = levelsGained * SKILL_POINTS_PER_LEVEL;
    
    player.totalSkillPoints = (player.totalSkillPoints || 0) + pointsGained;
    
    // 全武器種の使用可能ポイントを増加
    player = initializeSkillData(player);
    for (const weaponType in player.skillTrees) {
        player.skillTrees[weaponType].availablePoints += pointsGained;
    }
    
    return player;
}

// スキルノードのアンロック
function unlockSkillNode(player, weaponType, nodeId) {
    player = initializeSkillData(player);
    
    const skillTree = SKILL_TREES[weaponType];
    if (!skillTree) {
        return { success: false, error: "不明な武器種です" };
    }
    
    const node = skillTree.nodes.find(n => n.id === nodeId);
    if (!node) {
        return { success: false, error: "不明なスキルノードです" };
    }
    
    const playerTreeData = player.skillTrees[weaponType];
    
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
function getSkillNodeEffects(player, weaponType) {
    player = initializeSkillData(player);
    
    const effects = {
        passive: { maxHp: 0, atk: 0, def: 0, speed: 0 },
        active: []
    };
    
    const playerTreeData = player.skillTrees[weaponType];
    if (!playerTreeData) return effects;
    
    const skillTree = SKILL_TREES[weaponType];
    if (!skillTree) return effects;
    
    for (const nodeId of playerTreeData.unlockedNodes) {
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
    
    return effects;
}

// スキル効果をステータスに適用
function applySkillEffectsToStats(baseStats, player, weaponType) {
    const effects = getSkillNodeEffects(player, weaponType);
    
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
    const effect = { type: "active" };
    const desc = description.toLowerCase();

    // 例: "次の攻撃のダメージ1.2倍" -> { damageMultiplier: 1.2 }
    const damageMultiplierMatch = desc.match(/(?:ダメージ|攻撃)[をが]?([\d.]+)倍/);
    if (damageMultiplierMatch && damageMultiplierMatch[1]) {
        effect.damageMultiplier = parseFloat(damageMultiplierMatch[1]);
        return effect;
    }

    // 例: "受けるダメージを30%軽減" -> { damageReduction: 0.3 }
    const damageReductionMatch = desc.match(/ダメージ(?:を|が)([\d.]+)%軽減/);
    if (damageReductionMatch && damageReductionMatch[1]) {
        effect.damageReduction = parseFloat(damageReductionMatch[1]) / 100.0;
        return effect;
    }

    return null; // 解釈できなかった
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

function renderSkillTreeUI() {
    const container = document.getElementById('skillTreeContainer');
    if (!container) return;

    const player = getPlayerData();
    if (!player) {
        container.innerHTML = '<p>プレイヤーデータが見つかりません。</p>';
        return;
    }

    container.innerHTML = `
        <div class="skill-tree-ui">
            <div class="skill-tree-tabs"></div>
            <div class="skill-tree-content-wrapper">
                <div class="skill-points-display"></div>
                <div class="skill-tree-content"></div>
            </div>
        </div>
        <div class="custom-skill-section">
            <h3>オリジナルスキル作成</h3>
            <p>AIにスキルの名前と内容を伝えると、あなた専用のスキルが作成されます。<br>（例：次の攻撃のダメージを1.5倍にする）</p>
            <p>作成には ${CUSTOM_SKILL_COST} コインが必要です。</p>
            <div class="custom-skill-form">
                <input type="text" id="customSkillName" placeholder="スキル名">
                <textarea id="customSkillDescription" placeholder="スキルの内容"></textarea>
                <button id="createCustomSkillBtn">作成する</button>
            </div>
            <h4>作成済みオリジナルスキル</h4>
            <div id="customSkillList"></div>
        </div>
    `;

    const tabsContainer = container.querySelector('.skill-tree-tabs');
    Object.keys(SKILL_TREES).forEach((type, index) => {
        const tab = document.createElement('button');
        tab.className = 'skill-tree-tab';
        tab.textContent = SKILL_TREES[type].name;
        tab.dataset.type = type;
        if (index === 0) {
            tab.classList.add('active');
        }
        tab.onclick = () => {
            if (tabsContainer.querySelector('.active')) {
                tabsContainer.querySelector('.active').classList.remove('active');
            }
            tab.classList.add('active');
            renderTree(type);
        };
        tabsContainer.appendChild(tab);
    });

    // 初期表示
    renderTree(Object.keys(SKILL_TREES)[0]);
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

function renderTree(weaponType) {
    const content = document.querySelector('.skill-tree-content');
    const pointsDisplay = document.querySelector('.skill-points-display');
    if (!content || !pointsDisplay) return;

    const player = getPlayerData();
    const treeData = SKILL_TREES[weaponType];
    const playerData = player.skillTrees[weaponType];

    pointsDisplay.textContent = `利用可能スキルポイント: ${playerData.availablePoints}`;
    content.innerHTML = '';

    treeData.nodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = `skill-node ${node.type}`;
        nodeEl.style.left = `${node.x * 80 + 400}px`;
        nodeEl.style.top = `${node.y * 80 + 50}px`;
        nodeEl.title = `${node.name}\n${node.description}\nコスト: ${node.cost}`;

        const isUnlocked = playerData.unlockedNodes.includes(node.id);
        let isUnlockable = !isUnlocked && playerData.availablePoints >= node.cost;
        if (node.requires) {
            const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
            if (!requirements.every(reqId => playerData.unlockedNodes.includes(reqId))) {
                isUnlockable = false;
            }
        } else if (treeData.nodes.filter(n => !n.requires).length > 1) {
             // 複数の開始ノードがある場合、一つもアンロックしてなければアンロック可能
             if (playerData.unlockedNodes.length === 0) isUnlockable = true;
        }

        if (isUnlocked) nodeEl.classList.add('unlocked');
        else if (isUnlockable) nodeEl.classList.add('unlockable');
        else nodeEl.classList.add('locked');

        nodeEl.onclick = () => {
            if (isUnlockable) {
                if (confirm(`${node.name} を習得しますか？ (コスト: ${node.cost})`)) {
                    const result = unlockSkillNode(getPlayerData(), weaponType, node.id);
                    if (result.success) {
                        localStorage.setItem("player", JSON.stringify(result.player));
                        renderTree(weaponType); // ツリーを再描画
                    } else {
                        alert(result.error);
                    }
                }
            }
        };

        content.appendChild(nodeEl);
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

// グローバル関数としてエクスポート
if (typeof window !== 'undefined') {
    window.SKILL_TREES = SKILL_TREES;
    window.SKILL_POINTS_PER_LEVEL = SKILL_POINTS_PER_LEVEL;
    window.CUSTOM_SKILL_COST = CUSTOM_SKILL_COST;
    window.initializeSkillData = initializeSkillData;
    window.addSkillPointsOnLevelUp = addSkillPointsOnLevelUp;
    window.unlockSkillNode = unlockSkillNode;
    window.getSkillNodeEffects = getSkillNodeEffects;
    window.applySkillEffectsToStats = applySkillEffectsToStats;
    window.validateCustomSkill = validateCustomSkill;
    window.createCustomSkill = createCustomSkill;
    window.renderSkillTreeUI = renderSkillTreeUI;
}