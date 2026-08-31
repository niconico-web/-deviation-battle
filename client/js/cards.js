// ============================================
// カードシステム
// ============================================
// SchoolBattleのカードゲーム化：
// - 基本カード（攻撃・特殊・防御・必殺技）は既存のコマンドをそのままカードとして扱う
// - スキルカードは、スキルツリーで解放したアクティブスキル／オリジナルスキルをカード化したもの
// - 素材カードは、所持している素材1つにつき1種類のカードとして直接デッキに入れられる
//   （デッキに入れるために素材が消費されることはない。武器強化やオーブ作成にも引き続き使える）

const MAX_DECK_SIZE = 30;
const STARTING_HAND_SIZE = 5;
const MAX_HAND_SIZE = 8;

// 基本カード（コマンド操作の代わり）。コストは常に0で、デッキ枚数にも含まれない。
const BASIC_CARDS = [
    { id: 'basic_attack', name: '攻撃', icon: '⚔️', command: 'attack', description: '通常攻撃を行う', cost: 0 },
    { id: 'basic_special', name: '特殊', icon: '✨', command: 'special', description: '特殊ステータスを使って攻撃する', cost: 0 },
    { id: 'basic_defend', name: '防御', icon: '🛡️', command: 'defend', description: '次に受けるダメージを軽減する', cost: 0 },
    { id: 'basic_ultimate', name: '必殺技', icon: '💥', command: 'ultimate', description: '必殺技ゲージが満タンの時だけ使える強力な一撃', cost: 0 }
];

// 素材ID → カード効果のベース値（レア度による倍率をかける前の値）
// レア度は materials.js の MATERIAL_DATA / RARITY_MULTIPLIERS を利用する。
const MATERIAL_CARD_EFFECT_BASE = {
    // ダメージ倍率系
    harpy_feather:      { damageMultiplierBonus: 0.10 },
    magic_powder:       { damageMultiplierBonus: 0.08 },
    ancient_scroll:     { damageMultiplierBonus: 0.12 },
    elemental_core:     { damageMultiplierBonus: 0.14 },
    sun_crystal:        { damageMultiplierBonus: 0.16 },
    void_essence:       { damageMultiplierBonus: 0.18 },
    firefly_light:      { damageMultiplierBonus: 0.06 },
    shaman_totem:       { damageMultiplierBonus: 0.08 },
    tengu_fan:          { damageMultiplierBonus: 0.10 },
    storm_feather:      { damageMultiplierBonus: 0.12 },
    crystal_shard:      { damageMultiplierBonus: 0.06 },
    star_dragon_scale:  { damageMultiplierBonus: 0.18 },
    sphinx_riddle_stone:{ damageMultiplierBonus: 0.14 },

    // 回復系
    unicorn_horn:       { healPercent: 0.15 },
    world_tree_leaf:    { healPercent: 0.20 },
    // 復活・完全回復系の素材は、カードには「復活」の仕組みが無いため、
    // 代わりに強力な回復効果として再現する
    phoenix_feather:    { healPercent: 0.25 },
    celestial_ash:      { healPercent: 0.30 },
    lich_phylactery:    { healPercent: 0.35 },

    // 吸収系
    wraith_shroud:      { lifeSteal: 0.15 },

    // 会心系
    reaper_scythe_shard:{ critChance: 0.15, damageMultiplierBonus: 0.05 },

    // 敵の攻撃力低下
    serpent_scale:      { enemyAtkDebuff: 0.15 },
    crow_feather:       { enemyAtkDebuff: 0.10 },

    // 敵の防御力低下
    kappa_plate:        { enemyDefDebuff: 0.15 },
    hag_eye:            { enemyDefDebuff: 0.10 },

    // 敵の速さ低下（睡眠・石化・ターンスキップ系も近似的にここへ）
    moon_stone:         { speedDebuff: 0.15 },
    cursed_thread:      { speedDebuff: 0.10 },
    gravity_orb:        { speedDebuff: 0.20 },
    dream_dust:         { speedDebuff: 0.15 },
    time_sand:          { speedDebuff: 0.20 },
    basilisk_eye:       { speedDebuff: 0.15, enemyDefDebuff: 0.08 },

    // 敵の命中率低下
    banshee_wail:       { enemyAccuracyDebuff: 0.15 },

    // 敵の全ステータス低下（少しずつ複数に）
    abyss_gem:          { enemyAtkDebuff: 0.08, enemyDefDebuff: 0.08, speedDebuff: 0.08 },
    chimera_eye:        { enemyAtkDebuff: 0.06, enemyDefDebuff: 0.06, speedDebuff: 0.06 },

    // 状態異常
    blight_scale:       { poison: true }
};

/**
 * その素材がカード化できるかどうかを判定する。
 */
function isCardMaterial(materialId) {
    return !!MATERIAL_CARD_EFFECT_BASE[materialId];
}

/**
 * 素材1つから、カード効果を生成する（レア度による倍率込み）。
 */
function getMaterialCardEffect(materialId) {
    const base = MATERIAL_CARD_EFFECT_BASE[materialId];
    if (!base) return null;

    const materialInfo = (typeof MATERIAL_DATA !== 'undefined') ? MATERIAL_DATA[materialId] : null;
    const rarity = materialInfo ? materialInfo.rarity : 1;
    const multiplier = (typeof RARITY_MULTIPLIERS !== 'undefined' ? RARITY_MULTIPLIERS[rarity] : null) || 1.0;

    const effect = { type: 'active' };
    if (base.poison) {
        effect.poison = true;
    }
    if (base.damageMultiplierBonus) {
        effect.damageMultiplier = Math.round((1 + base.damageMultiplierBonus * multiplier) * 100) / 100;
    }
    if (base.healPercent) {
        effect.healPercent = Math.min(1.0, base.healPercent * multiplier);
    }
    if (base.lifeSteal) {
        effect.lifeSteal = Math.min(0.6, base.lifeSteal * multiplier);
    }
    if (base.critChance) {
        effect.critChance = Math.min(0.6, base.critChance * multiplier);
    }
    if (base.enemyAtkDebuff) {
        effect.enemyAtkDebuff = Math.min(0.6, base.enemyAtkDebuff * multiplier);
    }
    if (base.enemyDefDebuff) {
        effect.enemyDefDebuff = Math.min(0.6, base.enemyDefDebuff * multiplier);
    }
    if (base.speedDebuff) {
        effect.speedDebuff = Math.min(0.6, base.speedDebuff * multiplier);
    }
    if (base.enemyAccuracyDebuff) {
        effect.enemyAccuracyDebuff = Math.min(0.6, base.enemyAccuracyDebuff * multiplier);
    }
    return effect;
}

/**
 * カードの効果の強さから、エナジーコストを見積もる（1〜6の範囲）。
 */
function estimateCardCost(effect) {
    if (!effect) return 1;
    let score = 0;
    if (effect.damageMultiplier) score += (effect.damageMultiplier - 1) * 10;
    if (effect.healPercent) score += effect.healPercent * 8;
    if (effect.healAmount) score += effect.healAmount / 10;
    if (effect.lifeSteal) score += effect.lifeSteal * 8;
    if (effect.critChance) score += effect.critChance * 6;
    if (effect.shield) score += effect.shield * 6;
    if (effect.sureHit) score += 1;
    if (effect.pierceDef || effect.ignoreDef) score += 2;
    if (effect.nextAttackCrit) score += 2;
    if (effect.enemyAtkDebuff) score += effect.enemyAtkDebuff * 6;
    if (effect.enemyDefDebuff) score += effect.enemyDefDebuff * 6;
    if (effect.speedDebuff || effect.enemySpeedDebuff) score += (effect.speedDebuff || effect.enemySpeedDebuff) * 6;
    if (effect.enemyAccuracyDebuff) score += effect.enemyAccuracyDebuff * 6;
    if (effect.burn || effect.poison) score += 1.5;
    if (effect.multiHit) score += (effect.multiHit - 1) * 1.5;

    return Math.max(1, Math.min(6, Math.round(score)));
}

/**
 * 所持している素材1つを、デッキに入れられるカードに変換する。
 */
function materialToCard(materialId) {
    const effect = getMaterialCardEffect(materialId);
    if (!effect) return null;
    const materialInfo = (typeof MATERIAL_DATA !== 'undefined') ? MATERIAL_DATA[materialId] : null;
    return {
        id: `material_${materialId}`,
        name: materialInfo ? materialInfo.name : materialId,
        description: materialInfo ? materialInfo.description : '',
        rarity: materialInfo ? materialInfo.rarity : 1,
        type: 'material',
        materialId,
        effect,
        cost: estimateCardCost(effect)
    };
}

/**
 * スキル（スキルツリーのアクティブノード or オリジナルスキル）をカードに変換する。
 */
function skillToCard(skill) {
    return {
        id: `skill_${skill.id}`,
        name: skill.name,
        description: skill.description || '',
        type: 'skill',
        skillId: skill.id,
        effect: skill.effect || {},
        cost: estimateCardCost(skill.effect)
    };
}

/**
 * プレイヤーが所持していて、デッキに入れられるカードの一覧を返す。
 * @returns {{ skillCards: object[], materialCards: object[] }}
 */
function getAllOwnedCards(player) {
    const skillCards = [];
    if (typeof getSkillNodeEffects === 'function') {
        const effects = getSkillNodeEffects(player);
        (effects.active || []).forEach(skill => {
            skillCards.push(skillToCard(skill));
        });
    }

    const materialCards = [];
    const materials = (player && player.materials) || {};
    Object.keys(materials).forEach(materialId => {
        if (materials[materialId] > 0 && isCardMaterial(materialId)) {
            const card = materialToCard(materialId);
            if (card) materialCards.push(card);
        }
    });

    return { skillCards, materialCards };
}

/**
 * カードIDから、実際のカードオブジェクトを解決する。
 */
function resolveCardById(player, cardId) {
    const { skillCards, materialCards } = getAllOwnedCards(player);
    return [...skillCards, ...materialCards].find(c => c.id === cardId) || null;
}

/**
 * プレイヤーのデッキ（カードID配列）を取得する。所持していないカードは除外する。
 */
function getPlayerDeck(player) {
    if (!player || !Array.isArray(player.deck)) return [];
    const { skillCards, materialCards } = getAllOwnedCards(player);
    const ownedIds = new Set([...skillCards, ...materialCards].map(c => c.id));
    return player.deck.filter(id => ownedIds.has(id));
}

/**
 * プレイヤーのデッキを保存する（最大30枚、所持しているカードのみ）。
 */
function setPlayerDeck(player, cardIds) {
    const { skillCards, materialCards } = getAllOwnedCards(player);
    const ownedIds = new Set([...skillCards, ...materialCards].map(c => c.id));
    const filtered = cardIds.filter(id => ownedIds.has(id)).slice(0, MAX_DECK_SIZE);
    player.deck = filtered;
    return player;
}

// ============================================
// カードパック（コインで引くガチャ）
// ============================================

const PACK_TYPES = [
    {
        id: 'bronze_pack',
        name: 'ブロンズパック',
        cost: 100,
        cardCount: 3,
        rarityWeights: { 1: 60, 2: 30, 3: 9, 4: 1 }
    },
    {
        id: 'silver_pack',
        name: 'シルバーパック',
        cost: 300,
        cardCount: 3,
        rarityWeights: { 1: 35, 2: 40, 3: 20, 4: 5 }
    },
    {
        id: 'gold_pack',
        name: 'ゴールドパック',
        cost: 700,
        cardCount: 3,
        rarityWeights: { 1: 15, 2: 30, 3: 35, 4: 20 }
    },
    {
        id: 'legendary_pack',
        name: 'レジェンドパック',
        cost: 1500,
        cardCount: 3,
        rarityWeights: { 1: 0, 2: 10, 3: 40, 4: 50 }
    }
];

function getPackType(packId) {
    return PACK_TYPES.find(p => p.id === packId) || null;
}

/**
 * レア度の重み付けに従って、カード化できる素材を1つ抽選する。
 */
function rollMaterialByRarity(rarityWeights) {
    const candidatesByRarity = {};
    Object.keys(MATERIAL_CARD_EFFECT_BASE).forEach(materialId => {
        const materialInfo = (typeof MATERIAL_DATA !== 'undefined') ? MATERIAL_DATA[materialId] : null;
        const rarity = materialInfo ? materialInfo.rarity : 1;
        if (!candidatesByRarity[rarity]) candidatesByRarity[rarity] = [];
        candidatesByRarity[rarity].push(materialId);
    });

    const rarities = Object.keys(rarityWeights).filter(r => rarityWeights[r] > 0 && candidatesByRarity[r] && candidatesByRarity[r].length > 0);
    const totalWeight = rarities.reduce((sum, r) => sum + rarityWeights[r], 0);
    if (totalWeight <= 0) return null;

    let roll = Math.random() * totalWeight;
    let chosenRarity = rarities[0];
    for (const r of rarities) {
        roll -= rarityWeights[r];
        if (roll <= 0) {
            chosenRarity = r;
            break;
        }
    }

    const pool = candidatesByRarity[chosenRarity];
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * カードパックを開封する。コインを消費し、素材（カード）を入手する。
 * @returns {{ success: boolean, error?: string, materials?: string[], player?: object }}
 */
function openPack(player, packId) {
    const pack = getPackType(packId);
    if (!pack) return { success: false, error: '不明なパックです。' };
    if ((player.coins || 0) < pack.cost) {
        return { success: false, error: `コインが不足しています（必要: ${pack.cost}）` };
    }

    player.coins -= pack.cost;
    return grantPackContents(player, pack);
}

/**
 * コインを消費せずに、パックの中身だけを付与する（ボス撃破報酬などに使用）。
 * @returns {{ success: boolean, materials?: string[], player?: object }}
 */
function grantFreePack(player, packId) {
    const pack = getPackType(packId);
    if (!pack) return { success: false, error: '不明なパックです。' };
    return grantPackContents(player, pack);
}

function grantPackContents(player, pack) {
    if (!player.materials) player.materials = {};

    const obtained = [];
    for (let i = 0; i < pack.cardCount; i++) {
        const materialId = rollMaterialByRarity(pack.rarityWeights);
        if (!materialId) continue;
        player.materials[materialId] = (player.materials[materialId] || 0) + 1;
        obtained.push(materialId);
    }

    return { success: true, materials: obtained, player };
}

// ============================================
// デッキ編成UI
// ============================================

function renderDeckBuilderUI() {
    const skillContainer = document.getElementById('deckSkillCardList');
    const materialContainer = document.getElementById('deckMaterialCardList');
    if (!skillContainer || !materialContainer) return;

    const player = getPlayerData();
    const { skillCards, materialCards } = getAllOwnedCards(player);
    const currentDeck = new Set(getPlayerDeck(player));

    const updateSizeLabel = () => {
        const sizeLabel = document.getElementById('deckCurrentSizeLabel');
        const checkedCount = document.querySelectorAll('.card-select-list input[type="checkbox"]:checked').length;
        if (sizeLabel) sizeLabel.textContent = checkedCount;
    };

    const updateLimitState = () => {
        const checked = document.querySelectorAll('.card-select-list input[type="checkbox"]:checked');
        const atLimit = checked.length >= MAX_DECK_SIZE;
        document.querySelectorAll('.card-select-list input[type="checkbox"]').forEach(cb => {
            if (!cb.checked) cb.disabled = atLimit;
        });
        updateSizeLabel();
    };

    const renderCardRow = (card) => {
        const row = document.createElement('div');
        row.className = 'card-select-item';
        const isChecked = currentDeck.has(card.id);
        row.innerHTML = `
            <label>
                <input type="checkbox" value="${card.id}" ${isChecked ? 'checked' : ''}>
                <span class="card-cost">⚡${card.cost}</span>
                <span class="card-name">${card.name}</span>
                <span class="card-desc">${card.description || ''}</span>
            </label>
        `;
        row.querySelector('input').addEventListener('change', updateLimitState);
        return row;
    };

    skillContainer.innerHTML = '';
    if (skillCards.length === 0) {
        skillContainer.innerHTML = '<p>使えるスキルカードがありません。スキルツリーやオリジナルスキル作成でアクティブスキルを解放しよう。</p>';
    } else {
        skillCards.forEach(card => skillContainer.appendChild(renderCardRow(card)));
    }

    materialContainer.innerHTML = '';
    if (materialCards.length === 0) {
        materialContainer.innerHTML = '<p>カードにできる素材を所持していません。モンスターを倒すかカードパックを開封しよう。</p>';
    } else {
        materialCards.forEach(card => materialContainer.appendChild(renderCardRow(card)));
    }

    updateLimitState();

    const saveBtn = document.getElementById('saveDeckBtn');
    if (saveBtn) {
        saveBtn.onclick = () => {
            const selected = [];
            document.querySelectorAll('.card-select-list input[type="checkbox"]:checked').forEach(cb => {
                selected.push(cb.value);
            });
            const updatedPlayer = setPlayerDeck(getPlayerData(), selected);
            localStorage.setItem("player", JSON.stringify(updatedPlayer));
            alert(`デッキを保存しました！（${updatedPlayer.deck.length}枚）`);
        };
    }
}

// ============================================
// カードパックショップUI
// ============================================

function renderCardPackShop() {
    const container = document.getElementById('cardPackList');
    if (!container) return;

    const player = getPlayerData();
    container.innerHTML = '';

    PACK_TYPES.forEach(pack => {
        const rarityLabel = Object.entries(pack.rarityWeights)
            .filter(([, weight]) => weight > 0)
            .map(([rarity, weight]) => `★${rarity}:${weight}%`)
            .join(' ');

        const card = document.createElement('div');
        card.className = 'card-pack-item';
        card.innerHTML = `
            <h4>${pack.name}</h4>
            <p class="pack-cost">${pack.cost}コイン</p>
            <p class="pack-odds">${pack.cardCount}枚封入 / ${rarityLabel}</p>
            <button class="btn btn-primary open-pack-btn" data-pack-id="${pack.id}">開封する</button>
        `;
        const btn = card.querySelector('.open-pack-btn');
        btn.disabled = (player.coins || 0) < pack.cost;
        btn.onclick = () => handleOpenPackClick(pack.id);
        container.appendChild(card);
    });
}

function handleOpenPackClick(packId) {
    const player = getPlayerData();
    const result = openPack(player, packId);

    if (!result.success) {
        alert(result.error);
        return;
    }

    localStorage.setItem("player", JSON.stringify(result.player));

    const names = result.materials.map(id => {
        const info = (typeof MATERIAL_DATA !== 'undefined') ? MATERIAL_DATA[id] : null;
        return info ? info.name : id;
    });

    alert(`カードパックを開封しました！\n入手: ${names.join('、')}`);

    renderCardPackShop();
    if (typeof updateStatus === 'function') updateStatus(result.player);
}

// グローバル関数としてエクスポート
if (typeof window !== 'undefined') {
    window.MAX_DECK_SIZE = MAX_DECK_SIZE;
    window.STARTING_HAND_SIZE = STARTING_HAND_SIZE;
    window.MAX_HAND_SIZE = MAX_HAND_SIZE;
    window.BASIC_CARDS = BASIC_CARDS;
    window.PACK_TYPES = PACK_TYPES;
    window.isCardMaterial = isCardMaterial;
    window.getMaterialCardEffect = getMaterialCardEffect;
    window.materialToCard = materialToCard;
    window.skillToCard = skillToCard;
    window.estimateCardCost = estimateCardCost;
    window.getAllOwnedCards = getAllOwnedCards;
    window.resolveCardById = resolveCardById;
    window.getPlayerDeck = getPlayerDeck;
    window.setPlayerDeck = setPlayerDeck;
    window.getPackType = getPackType;
    window.openPack = openPack;
    window.grantFreePack = grantFreePack;
    window.renderDeckBuilderUI = renderDeckBuilderUI;
    window.renderCardPackShop = renderCardPackShop;
    window.handleOpenPackClick = handleOpenPackClick;
}
