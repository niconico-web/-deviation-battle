// client/js/materials.js

const MATERIAL_DATA = {
    // レア度1 - 低級素材
    goblin_fang: { id: 'goblin_fang', name: 'ゴブリンの牙', description: 'ゴブリンから採れる鋭い牙。武器の素材として使われる。', rarity: 1 },
    goblin_hide: { id: 'goblin_hide', name: 'ゴブリンの皮', description: 'ゴブリンの丈夫な皮。防具の素材として使われる。', rarity: 1 },
    slime_jelly: { id: 'slime_jelly', name: 'スライムゼリー', description: 'スライムから採れるゼリー。低ティアオーブの素材になる。', rarity: 1 },
    wolf_fang: { id: 'wolf_fang', name: '狼の牙', description: '狼の鋭い牙。装飾品の素材になる。', rarity: 1 },
    wolf_pelt: { id: 'wolf_pelt', name: '狼の毛皮', description: '狼の暖かい毛皮。防具の素材になる。', rarity: 1 },
    bat_wing: { id: 'bat_wing', name: 'コウモリの翼', description: 'コウモリの薄い翼。軽量な素材になる。', rarity: 1 },
    rat_tail: { id: 'rat_tail', name: 'ネズミの尾', description: 'ネズミのしなやかな尾。細工品の素材になる。', rarity: 1 },
    snake_scale: { id: 'snake_scale', name: '蛇の鱗', description: '蛇の滑らかな鱗。小さな装飾に使われる。', rarity: 1 },
    spider_silk: { id: 'spider_silk', name: '蜘蛛の糸', description: '蜘蛛の丈夫な糸。織物の素材になる。', rarity: 1 },
    boar_tusk: { id: 'boar_tusk', name: '猪の牙', description: '猪の太い牙。突き物の素材になる。', rarity: 1 },
    skeleton_bone: { id: 'skeleton_bone', name: 'スケルトンの骨', description: 'スケルトンの骨。硬い素材になる。', rarity: 1 },
    ghost_essence: { id: 'ghost_essence', name: 'ゴーストのエッセンス', description: 'ゴーストの魂の欠片。不思議な素材になる。', rarity: 1 },
    mushroom_cap: { id: 'mushroom_cap', name: 'キノコの傘', description: '毒キノコの傘。薬の素材になる。', rarity: 1 },
    herb_leaf: { id: 'herb_leaf', name: '薬草の葉', description: '回復薬の原料になる薬草。', rarity: 1 },
    rock_fragment: { id: 'rock_fragment', name: '岩石の欠片', description: '砕けた岩石。建築素材になる。', rarity: 1 },

    // レア度2 - 中級素材
    slime_core: { id: 'slime_core', name: 'スライムコア', description: 'スライムの核。オーブの素材になる。', rarity: 2 },
    orc_horn: { id: 'orc_horn', name: 'オークの角', description: 'オークの強固な角。武器の素材になる。', rarity: 2 },
    orc_armor: { id: 'orc_armor', name: 'オークの鎧', description: 'オークの粗雑な鎧。防具の素材になる。', rarity: 2 },
    harpy_feather: { id: 'harpy_feather', name: 'ハーピーの羽', description: 'ハーピーの美しい羽。魔法の素材になる。', rarity: 2 },
    minotaur_horn: { id: 'minotaur_horn', name: 'ミノタウロスの角', description: 'ミノタウロスの巨大な角。強力な武器の素材になる。', rarity: 2 },
    ogre_fist: { id: 'ogre_fist', name: 'オーガの拳', description: 'オーガの硬い拳。打撃武器の素材になる。', rarity: 2 },
    dark_essence: { id: 'dark_essence', name: 'ダークエッセンス', description: '闇の力を宿すエッセンス。闇属性の素材になる。', rarity: 2 },
    fire_crystal: { id: 'fire_crystal', name: 'ファイアクリスタル', description: '炎の力が込められた結晶。火属性の素材になる。', rarity: 2 },
    ice_shard: { id: 'ice_shard', name: 'アイスシャード', description: '冷気を放つ氷の破片。氷属性の素材になる。', rarity: 2 },
    lightning_gem: { id: 'lightning_gem', name: 'ライトニングジェム', description: '雷を纏う宝石。雷属性の素材になる。', rarity: 2 },
    poison_fang: { id: 'poison_fang', name: '毒牙', description: '猛毒を含む牙。毒属性の素材になる。', rarity: 2 },
    iron_ore: { id: 'iron_ore', name: '鉄鉱石', description: '鉄を含む鉱石。鍛造の基本素材になる。', rarity: 2 },
    silver_ore: { id: 'silver_ore', name: '銀鉱石', description: '銀を含む鉱石。聖なる武器の素材になる。', rarity: 2 },
    magic_powder: { id: 'magic_powder', name: '魔法の粉', description: '魔力を含む粉。魔法の触媒になる。', rarity: 2 },
    ancient_scroll: { id: 'ancient_scroll', name: '古代の巻物', description: '古代の知識が記された巻物。魔法の素材になる。', rarity: 2 },

    // レア度3 - 上級素材
    dragon_scale: { id: 'dragon_scale', name: 'ドラゴンの鱗', description: 'フレイムドラゴンの硬い鱗。高い防御力を持つ素材。', rarity: 3 },
    dragon_bone: { id: 'dragon_bone', name: 'ドラゴンの骨', description: 'ドラゴンの強固な骨。武器の素材になる。', rarity: 3 },
    phoenix_feather: { id: 'phoenix_feather', name: 'フェニックスの羽', description: '不死鳥の羽。復活の魔法の素材になる。', rarity: 3 },
 unicorn_horn: { id: 'unicorn_horn', name: 'ユニコーンの角', description: 'ユニコーンの聖なる角。回復魔法の素材になる。', rarity: 3 },
    griffin_claw: { id: 'griffin_claw', name: 'グリフォンの爪', description: 'グリフォンの鋭い爪。切り裂く武器の素材になる。', rarity: 3 },
    chimera_eye: { id: 'chimera_eye', name: 'キメラの目', description: 'キメラの怪しい目。予知の魔法の素材になる。', rarity: 3 },
    hydra_venom: { id: 'hydra_venom', name: 'ヒドラの毒', description: 'ヒドラの猛毒。強力な毒の素材になる。', rarity: 3 },
    titan_stone: { id: 'titan_stone', name: 'タイタンの石', description: 'タイタンの力が宿る石。巨大な武器の素材になる。', rarity: 3 },
    elemental_core: { id: 'elemental_core', name: 'エレメンタルの核', description: 'エレメンタルの核。元素魔法の素材になる。', rarity: 3 },
    gold_ore: { id: 'gold_ore', name: '金鉱石', description: '金を含む鉱石。高級装飾の素材になる。', rarity: 3 },
    mithril_ore: { id: 'mithril_ore', name: 'ミスリル鉱石', description: '軽くて丈夫なミスリル。最強の防具の素材になる。', rarity: 3 },
    star_fragment: { id: 'star_fragment', name: '星の欠片', description: '星から落ちた欠片。宇宙の力を宿す。', rarity: 3 },
    moon_stone: { id: 'moon_stone', name: 'ムーンストーン', description: '月の光を宿す石。精神魔法の素材になる。', rarity: 3 },
    sun_crystal: { id: 'sun_crystal', name: 'サンクリスタル', description: '太陽の光を宿す結晶。光属性の素材になる。', rarity: 3 },

    // レア度4 - 最高級素材
    dragon_heart: { id: 'dragon_heart', name: 'ドラゴンの心臓', description: 'フレイムドラゴンの心臓。高ティアオーブの素材になる。', rarity: 4 },
    dragon_soul: { id: 'dragon_soul', name: 'ドラゴンの魂', description: '古代ドラゴンの魂。伝説の武器の素材になる。', rarity: 4 },
    divine_crystal: { id: 'divine_crystal', name: '神聖クリスタル', description: '神々の力が宿る結晶。神聖武器の素材になる。', rarity: 4 },
    abyss_gem: { id: 'abyss_gem', name: 'アビスジェム', description: '深淵の力が宿る宝石。闇魔法の最強素材になる。', rarity: 4 },
    world_tree_leaf: { id: 'world_tree_leaf', name: '世界樹の葉', description: '世界樹の葉。創造の魔法の素材になる。', rarity: 4 },
    time_sand: { id: 'time_sand', name: '時の砂', description: '時間を操る砂。時魔法の素材になる。', rarity: 4 },
    void_essence: { id: 'void_essence', name: '虚空のエッセンス', description: '虚空の力を宿すエッセンス。空間魔法の素材になる。', rarity: 4 },
    chaos_orb: { id: 'chaos_orb', name: 'カオスオーブ', description: '混沌の力が宿る球体。無属性の最強素材になる。', rarity: 4 },
    eternal_flame: { id: 'eternal_flame', name: '永遠の炎', description: '消えることのない炎。創造の源になる。', rarity: 4 },
    void_stone: { id: 'void_stone', name: 'ヴォイドストーン', description: '虚空を切り裂く石。次元の最強素材になる。', rarity: 4 },


    // レア度1〜4 追加素材（大幅増量）
    frog_leg: { id: 'frog_leg', name: 'カエルの脚', description: '素早い脚。跳躍系スキルの素材になる。', rarity: 1 },
    crow_feather: { id: 'crow_feather', name: 'カラスの羽', description: '漆黒の羽根。呪術の素材になる。', rarity: 1 },
    hornet_stinger: { id: 'hornet_stinger', name: 'スズメバチの針', description: '鋭い毒針。毒武器の素材になる。', rarity: 1 },
    centipede_shell: { id: 'centipede_shell', name: 'ムカデの殻', description: '硬い殻。軽量な防具の素材になる。', rarity: 1 },
    crab_shell: { id: 'crab_shell', name: 'カニの甲羅', description: '頑丈な甲羅。盾の素材になる。', rarity: 1 },
    turtle_shell: { id: 'turtle_shell', name: 'カメの甲羅', description: '非常に硬い甲羅。防具の素材になる。', rarity: 1 },
    weasel_fur: { id: 'weasel_fur', name: 'イタチの毛皮', description: '滑らかな毛皮。装飾品の素材になる。', rarity: 1 },
    firefly_light: { id: 'firefly_light', name: 'ホタルの光', description: 'ほのかに光る粉。灯りの魔法の素材になる。', rarity: 1 },
    mole_claw: { id: 'mole_claw', name: 'モグラの爪', description: '土を掘る爪。採掘道具の素材になる。', rarity: 1 },
    scorpion_tail: { id: 'scorpion_tail', name: 'サソリの尾', description: '猛毒を持つ尾。毒武器の素材になる。', rarity: 1 },
    jackal_fang: { id: 'jackal_fang', name: 'ジャッカルの牙', description: '鋭い牙。小型武器の素材になる。', rarity: 1 },
    vulture_feather: { id: 'vulture_feather', name: 'ハゲワシの羽', description: '大きな羽根。矢羽根の素材になる。', rarity: 1 },
    shaman_totem: { id: 'shaman_totem', name: 'シャーマンの護符', description: '呪術の護符。魔法の素材になる。', rarity: 1 },
    lizard_scale: { id: 'lizard_scale', name: 'リザードの鱗', description: '砂漠に耐える鱗。防具の素材になる。', rarity: 2 },
    troll_hide: { id: 'troll_hide', name: 'トロルの皮', description: '再生力を持つ皮。回復薬の素材になる。', rarity: 2 },
    hag_eye: { id: 'hag_eye', name: '魔女の目', description: '呪いの目玉。呪術の素材になる。', rarity: 2 },
    bandit_dagger_shard: { id: 'bandit_dagger_shard', name: '野盗の短剣の欠片', description: '折れた短剣。鍛造の素材になる。', rarity: 2 },
    mercenary_badge: { id: 'mercenary_badge', name: '傭兵の徽章', description: '戦歴を示す徽章。装飾品の素材になる。', rarity: 2 },
    cursed_thread: { id: 'cursed_thread', name: '呪いの糸', description: '人形を縛る糸。呪術の素材になる。', rarity: 2 },
    gargoyle_wing: { id: 'gargoyle_wing', name: 'ガーゴイルの翼', description: '石の翼。防具の素材になる。', rarity: 2 },
    kappa_plate: { id: 'kappa_plate', name: '河童の皿', description: '頭の皿。水の魔法の素材になる。', rarity: 2 },
    tengu_fan: { id: 'tengu_fan', name: '天狗の羽団扇', description: '風を操る団扇。風魔法の素材になる。', rarity: 2 },
    oni_horn_fragment: { id: 'oni_horn_fragment', name: '鬼の角の欠片', description: '小さな角。武器の素材になる。', rarity: 2 },
    ice_wolf_fang: { id: 'ice_wolf_fang', name: '氷狼の牙', description: '冷気を帯びた牙。氷属性の素材になる。', rarity: 2 },
    bog_herb: { id: 'bog_herb', name: '沼地の秘薬草', description: '毒と薬を併せ持つ草。調合の素材になる。', rarity: 2 },
    wraith_shroud: { id: 'wraith_shroud', name: 'レイスの死装束', description: '冷たい布。闇属性の素材になる。', rarity: 2 },
    basilisk_eye: { id: 'basilisk_eye', name: 'バジリスクの目', description: '石化の力を宿す目。呪術の最強素材になる。', rarity: 3 },
    manticore_stinger: { id: 'manticore_stinger', name: 'マンティコアの毒針', description: '強力な毒針。毒武器の素材になる。', rarity: 3 },
    banshee_wail: { id: 'banshee_wail', name: 'バンシーの絶叫石', description: '悲鳴を宿す石。恐怖魔法の素材になる。', rarity: 3 },
    lich_phylactery: { id: 'lich_phylactery', name: 'リッチの魂器', description: '魂を宿す器。死霊術の素材になる。', rarity: 3 },
    werebear_claw: { id: 'werebear_claw', name: 'ワーベアの爪', description: '巨大な爪。打撃武器の素材になる。', rarity: 3 },
    sphinx_riddle_stone: { id: 'sphinx_riddle_stone', name: 'スフィンクスの謎石', description: '知恵を宿す石。学問の魔法の素材になる。', rarity: 3 },
    cerberus_fang: { id: 'cerberus_fang', name: 'ケルベロスの牙', description: '三つ首の牙。冥府の素材になる。', rarity: 3 },
    storm_feather: { id: 'storm_feather', name: '嵐の羽根', description: '雷を纏う羽根。風雷魔法の素材になる。', rarity: 3 },
    coral_scale: { id: 'coral_scale', name: '珊瑚の鱗', description: '海の力を宿す鱗。水属性の最強素材になる。', rarity: 3 },
    sandworm_hide: { id: 'sandworm_hide', name: 'サンドワームの皮', description: '砂を纏う皮。防具の素材になる。', rarity: 3 },
    shadow_pelt: { id: 'shadow_pelt', name: '影の毛皮', description: '闇に溶ける毛皮。隠密の素材になる。', rarity: 3 },
    crystal_shard: { id: 'crystal_shard', name: 'クリスタルの欠片', description: '光を屈折させる欠片。魔法増幅の素材になる。', rarity: 3 },
    serpent_scale: { id: 'serpent_scale', name: 'シーサーペントの鱗', description: '波を操る鱗。水魔法の素材になる。', rarity: 3 },
    frost_core: { id: 'frost_core', name: '氷結の核', description: '絶対零度の核。氷属性の最強素材になる。', rarity: 4 },
    magma_core: { id: 'magma_core', name: 'マグマの核', description: '灼熱の核。火属性の最強素材になる。', rarity: 4 },
    star_dragon_scale: { id: 'star_dragon_scale', name: '星龍の鱗', description: '星屑を纏う鱗。宇宙魔法の素材になる。', rarity: 4 },
    reaper_scythe_shard: { id: 'reaper_scythe_shard', name: '死神の鎌の欠片', description: '魂を刈る鎌の欠片。死の魔法の素材になる。', rarity: 4 },
    nether_crown_shard: { id: 'nether_crown_shard', name: '冥王の冠の欠片', description: '闇の王の証。最強の闇素材になる。', rarity: 4 },
    celestial_ash: { id: 'celestial_ash', name: '天界の灰', description: '不滅の灰。復活魔法の最強素材になる。', rarity: 4 },
    world_serpent_fang: { id: 'world_serpent_fang', name: '世界蛇の牙', description: '世界を巻く蛇の牙。伝説の素材になる。', rarity: 4 },
    dream_dust: { id: 'dream_dust', name: '夢の砂', description: '夢を喰らう砂。精神魔法の最強素材になる。', rarity: 4 },
    gravity_orb: { id: 'gravity_orb', name: '重力の球', description: '空間を歪める球。重力魔法の素材になる。', rarity: 4 },
    blight_scale: { id: 'blight_scale', name: '疫龍の鱗', description: '疫病を纏う鱗。呪毒の最強素材になる。', rarity: 4 },
    primeval_core: { id: 'primeval_core', name: '原初の核', description: '世界創造の核。全属性の最強素材になる。', rarity: 4 },
};

/**
 * プレイヤーの素材インベントリを取得する。
 * @returns {object} 素材IDをキー、所持数を値とするオブジェクト。
 */
function getPlayerMaterials() {
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    return player ? (player.materials || {}) : {};
}

/**
 * プレイヤーの素材インベントリに素材を追加する。
 * @param {string} materialId - 追加する素材のID。
 * @param {number} count - 追加する数。
 */
function addMaterialToPlayer(materialId, count = 1) {
    let player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    if (!player) return;

    player.materials = player.materials || {};
    player.materials[materialId] = (player.materials[materialId] || 0) + count;
    localStorage.setItem("player", JSON.stringify(player));
    console.log(`Added ${count} of ${materialId}. Current: ${player.materials[materialId]}`);
    renderMaterialsInventory();
}

/**
 * プレイヤーの素材インベントリから素材を消費する。
 * @param {string} materialId - 消費する素材のID。
 * @param {number} count - 消費する数。
 * @returns {boolean} 消費に成功したかどうか。
 */
function removeMaterialFromPlayer(materialId, count = 1) {
    let player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    if (!player || !player.materials || (player.materials[materialId] || 0) < count) {
        console.warn(`Not enough ${materialId} to remove.`);
        return false;
    }

    player.materials[materialId] -= count;
    if (player.materials[materialId] <= 0) {
        delete player.materials[materialId];
    }
    localStorage.setItem("player", JSON.stringify(player));
    console.log(`Removed ${count} of ${materialId}. Current: ${player.materials[materialId] || 0}`);
    renderMaterialsInventory();
    return true;
}

/**
 * 素材インベントリのUI（一覧）をレンダリングする。
 * 通常のモンスター素材（MATERIAL_DATAに定義されているもの）と、
 * ボスの限界突破素材（"{bossId}_limit_break_material" というIDで保存されるもの）の
 * 両方をまとめて表示する。
 */
function renderMaterialsInventory() {
    const container = document.getElementById('materialsInventoryList');
    if (!container) {
        console.error("materialsInventoryList container not found");
        return;
    }

    const materials = getPlayerMaterials();
    console.log("Rendering materials inventory:", materials);
    container.innerHTML = '';

    if (Object.keys(materials).length === 0) {
        container.innerHTML = '<p>素材を所持していません。</p>';
        return;
    }

    for (const materialId in materials) {
        const count = materials[materialId];
        if (!count || count <= 0) continue;

        // ボスの限界突破素材（"{bossId}_limit_break_material"）かどうかを判定する
        if (materialId.endsWith('_limit_break_material')) {
            const bossId = materialId.replace('_limit_break_material', '');
            const bosses = window.bosses || [];
            const boss = bosses.find(b => b.id === bossId);
            const materialName = (boss && typeof getBossLimitBreakMaterialName === 'function')
                ? getBossLimitBreakMaterialName(boss.name)
                : materialId;

            const materialEl = document.createElement('div');
            materialEl.className = 'material-item';
            materialEl.innerHTML = `
                <div class="material-header">
                    <span class="material-name">${materialName}</span>
                    <span class="material-count">x ${count}</span>
                </div>
                <p class="material-description">${boss ? `「${boss.name}」の武器を限界突破するための素材。` : 'ボス武器の限界突破に使用する素材。'}</p>
            `;
            container.appendChild(materialEl);
            continue;
        }

        // 通常のモンスター素材
        const materialInfo = MATERIAL_DATA[materialId];
        if (materialInfo) {
            const materialEl = document.createElement('div');
            materialEl.className = 'material-item';
            materialEl.innerHTML = `
                <div class="material-header">
                    <span class="material-name">${materialInfo.name}</span>
                    <span class="material-count">x ${count}</span>
                </div>
                <p class="material-description">${materialInfo.description}（レア度: ${materialInfo.rarity}）</p>
            `;
            container.appendChild(materialEl);
        } else {
            console.warn("Material info not found for:", materialId);
            const materialEl = document.createElement('div');
            materialEl.className = 'material-item';
            materialEl.innerHTML = `
                <div class="material-header">
                    <span class="material-name">${materialId}</span>
                    <span class="material-count">x ${count}</span>
                </div>
                <p class="material-description">詳細不明の素材です。</p>
            `;
            container.appendChild(materialEl);
        }
    }
}

/**
 * 素材システムを初期化する。
 */
function initMaterials() {
    console.log("Initializing materials system.");
    renderMaterialsInventory();
    
    // 素材管理モーダルのイベント設定
    const openMaterialManagementBtn = document.getElementById('openMaterialManagementBtn');
    const materialManagementModal = document.getElementById('materialManagementModal');
    const closeMaterialManagementBtn = materialManagementModal?.querySelector('.close');
    
    if (openMaterialManagementBtn) {
        openMaterialManagementBtn.onclick = () => {
            renderMaterialsInventory();
            materialManagementModal.style.display = 'flex';
        };
    }
    
    if (closeMaterialManagementBtn) {
        closeMaterialManagementBtn.onclick = () => {
            materialManagementModal.style.display = 'none';
        };
    }
    
    // オーブ作成ボタン
    const openOrbCraftingBtn = document.getElementById('openOrbCraftingBtn');
    const orbCraftingModal = document.getElementById('orbCraftingModal');
    const closeOrbCraftingBtn = orbCraftingModal?.querySelector('.close');
    
    if (openOrbCraftingBtn) {
        openOrbCraftingBtn.onclick = () => {
            showMaterialCraftingUI();
            materialManagementModal.style.display = 'none';
            orbCraftingModal.style.display = 'flex';
        };
    }
    
    if (closeOrbCraftingBtn) {
        closeOrbCraftingBtn.onclick = () => {
            orbCraftingModal.style.display = 'none';
        };
    }
    
    // 魔術使用ボタン
    const openMagicCraftingBtn = document.getElementById('openMagicCraftingBtn');
    if (openMagicCraftingBtn) {
        openMagicCraftingBtn.onclick = () => {
            materialManagementModal.style.display = 'none';
            // 魔術セクションに移動
            const magicSection = document.getElementById('section-magic');
            const magicMenuBtn = document.querySelector('.menu-btn[data-section="magic"]');
            if (magicSection && magicMenuBtn) {
                // 全てのセクションを非表示
                document.querySelectorAll('.content-section').forEach(section => {
                    section.classList.remove('active');
                });
                // 全てのメニューボタンのactiveクラスを削除
                document.querySelectorAll('.menu-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                // 魔術セクションを表示
                magicSection.classList.add('active');
                magicMenuBtn.classList.add('active');
                // 魔術メニューを表示
                if (typeof showMagicMenu === 'function') {
                    showMagicMenu();
                }
            }
        };
    }
}

/**
 * 選択された素材からオーブのレア度を計算する。
 * @param {Array<string>} materialIds - 素材IDの配列（最大5つ）
 * @returns {string} オーブのティア（tier1, tier2, tier3, tier4）またはnull
 */
function calculateOrbRarity(materialIds) {
    if (!materialIds || materialIds.length === 0) return null;

    let totalRarity = 0;
    let maxRarity = 0;

    for (const materialId of materialIds) {
        const material = MATERIAL_DATA[materialId];
        if (material) {
            totalRarity += material.rarity;
            maxRarity = Math.max(maxRarity, material.rarity);
        }
    }

    // 平均レア度を計算
    const avgRarity = totalRarity / materialIds.length;

    // 平均レア度に基づいてティアを決定
    // avgRarity >= 3.5: tier4
    // avgRarity >= 2.5: tier3
    // avgRarity >= 1.5: tier2
    // avgRarity < 1.5: tier1
    if (avgRarity >= 3.5) {
        return 'tier4';
    } else if (avgRarity >= 2.5) {
        return 'tier3';
    } else if (avgRarity >= 1.5) {
        return 'tier2';
    } else {
        return 'tier1';
    }
}

// 武器素材として使用できる素材ID（説明欄に「武器の素材」とあるもの）
const WEAPON_MATERIALS = [
    'goblin_fang',
    'orc_horn',
    'minotaur_horn',
    'ogre_fist',
    'silver_ore',
    'dragon_bone',
    'griffin_claw',
    'titan_stone',
    'dragon_soul',
    'divine_crystal',
    'hornet_stinger',
    'scorpion_tail',
    'jackal_fang',
    'oni_horn_fragment',
    'manticore_stinger',
    'werebear_claw',
    'world_serpent_fang',
    'boar_tusk',
    'iron_ore'
];

// 武器素材ボーナス定義（レア度による基本倍率）
const WEAPON_MATERIAL_BONUSES = {
    goblin_fang: { rarity: 1, atk: 0.05 },
    orc_horn: { rarity: 2, atk: 0.08 },
    minotaur_horn: { rarity: 2, atk: 0.10 },
    ogre_fist: { rarity: 2, atk: 0.07, def: 0.05 },
    silver_ore: { rarity: 2, atk: 0.05, special: 0.08 },
    dragon_bone: { rarity: 3, atk: 0.12, def: 0.08 },
    griffin_claw: { rarity: 3, atk: 0.10, speed: 0.10 },
    titan_stone: { rarity: 3, atk: 0.12, def: 0.10, maxHp: 0.08 },
    dragon_soul: { rarity: 4, atk: 0.20, def: 0.15, speed: 0.15, special: 0.15 },
    divine_crystal: { rarity: 4, atk: 0.15, def: 0.15, special: 0.20 },
    hornet_stinger: { rarity: 1, atk: 0.04 },
    scorpion_tail: { rarity: 1, atk: 0.04 },
    jackal_fang: { rarity: 1, atk: 0.03, speed: 0.05 },
    oni_horn_fragment: { rarity: 2, atk: 0.06 },
    manticore_stinger: { rarity: 3, atk: 0.08 },
    werebear_claw: { rarity: 3, atk: 0.10, def: 0.08 },
    world_serpent_fang: { rarity: 4, atk: 0.18, def: 0.12, speed: 0.12 },
    boar_tusk: { rarity: 1, atk: 0.03 },
    iron_ore: { rarity: 2, atk: 0.05, def: 0.03 }
};

// レア度による倍率
const RARITY_MULTIPLIERS = {
    1: 1.0,
    2: 2.0,
    3: 3.0,
    4: 4.0
};

/**
 * 素材から武器ボーナスを計算する
 * @param {Array<string>} materialIds - 素材IDの配列（最大3つ）
 * @returns {object} ボーナスオブジェクト
 */
function calculateWeaponMaterialBonus(materialIds) {
    if (!materialIds || materialIds.length === 0) return {};
    
    const totalBonus = { atk: 0, def: 0, speed: 0, maxHp: 0, special: 0 };
    
    for (const materialId of materialIds) {
        const bonus = WEAPON_MATERIAL_BONUSES[materialId];
        if (bonus) {
            const rarity = bonus.rarity || 1;
            const multiplier = RARITY_MULTIPLIERS[rarity] || 1.0;
            
            // レア度以外のステータスボーナスを取得
            for (const [stat, value] of Object.entries(bonus)) {
                if (stat !== 'rarity') {
                    totalBonus[stat] = (totalBonus[stat] || 0) + (value * multiplier);
                }
            }
        }
    }
    
    return totalBonus;
}

/**
 * 素材からオーブを作成する。
 * @param {Array<string>} materialIds - 素材IDの配列（最大5つ）
 * @returns {object|null} 作成されたオーブ、または失敗時はnull
 */
function craftOrbFromMaterials(materialIds) {
    if (!materialIds || materialIds.length === 0) return null;

    // プレイヤーの素材を確認
    const playerMaterials = getPlayerMaterials();
    for (const materialId of materialIds) {
        if (!playerMaterials[materialId] || playerMaterials[materialId] < 1) {
            console.warn(`Not enough material: ${materialId}`);
            return null;
        }
    }

    // 素材を消費
    for (const materialId of materialIds) {
        if (!removeMaterialFromPlayer(materialId, 1)) {
            console.warn(`Failed to remove material: ${materialId}`);
            return null;
        }
    }

    // オーブのティアを計算
    const tier = calculateOrbRarity(materialIds);
    if (!tier) {
        console.warn("Failed to calculate orb rarity");
        return null;
    }

    // オーブを作成（weapons.jsのcreateOrb関数を使用）
    if (typeof createOrb === 'function') {
        const orb = createOrb(tier);
        return orb;
    } else {
        console.error("createOrb function not available");
        return null;
    }
}

/**
 * getOrbDisplayName関数の定義（weapons.jsから呼び出し可能にするため）
 */
function getOrbDisplayName(orb) {
    if (!orb) return "不明なオーブ";
    const tierNames = { tier1: 'ティア1', tier2: 'ティア2', tier3: 'ティア3', tier4: 'ティア4' };
    const statLabels = { atk: '攻撃', def: '防御', speed: '速さ', special: '特殊', maxHp: 'HP' };
    const tierName = tierNames[orb.tier] || orb.tier;
    const statLabel = statLabels[orb.statType] || orb.statType;
    const bonusPercent = Math.round(orb.bonus * 100);

    let name = `${tierName}オーブ (${statLabel}+${bonusPercent}%)`;

    if (orb.uniqueAbility) {
        name += ` [${orb.uniqueAbility.name}]`;
    }

    return name;
}

/**
 * 素材選択UIを表示する。
 */
function showMaterialCraftingUI() {
    const container = document.getElementById('materialCraftingContainer');
    if (!container) {
        console.warn("Material crafting container not found");
        return;
    }

    const materials = getPlayerMaterials();
    const selectedMaterials = [];

    container.innerHTML = `
        <h3>オーブ作成</h3>
        <p>素材を選択してオーブを作成（最大5つ）</p>
        <div id="selectedMaterials" class="selected-materials"></div>
        <div id="materialSelection" class="material-selection"></div>
        <button id="craftOrbBtn" class="btn-primary" disabled>オーブを作成</button>
        <button id="clearSelectionBtn" class="btn-secondary">選択をクリア</button>
    `;

    // 素材選択エリアをレンダリング
    const selectionContainer = document.getElementById('materialSelection');
    for (const materialId in materials) {
        if (materials[materialId] > 0) {
            const material = MATERIAL_DATA[materialId];
            const materialEl = document.createElement('div');
            materialEl.className = 'material-select-item';
            materialEl.innerHTML = `
                <span class="material-name">${material.name}</span>
                <span class="material-count">x ${materials[materialId]}</span>
                <span class="material-rarity">レア度: ${material.rarity}</span>
            `;
            materialEl.onclick = () => selectMaterial(materialId, materials, selectedMaterials);
            selectionContainer.appendChild(materialEl);
        }
    }

    // ボタンイベント
    document.getElementById('craftOrbBtn').onclick = () => {
        if (selectedMaterials.length > 0) {
            const orb = craftOrbFromMaterials(selectedMaterials);
            if (orb) {
                // オーブをプレイヤーに追加
                let player = getPlayerData();
                if (player) {
                    player.orbs = player.orbs || [];
                    player.orbs.push(orb);
                    localStorage.setItem("player", JSON.stringify(player));
                    alert(`オーブを作成しました！\n${getOrbDisplayName(orb)}`);
                    selectedMaterials.length = 0;
                    showMaterialCraftingUI(); // UIを再描画
                }
            } else {
                alert("オーブの作成に失敗しました。");
            }
        }
    };

    document.getElementById('clearSelectionBtn').onclick = () => {
        selectedMaterials.length = 0;
        updateSelectedMaterialsDisplay(selectedMaterials);
    };
}

/**
 * 素材を選択する。
 */
function selectMaterial(materialId, materials, selectedMaterials) {
    if (selectedMaterials.length >= 5) {
        alert("最大5つまでしか選択できません。");
        return;
    }

    if (materials[materialId] > selectedMaterials.filter(id => id === materialId).length) {
        selectedMaterials.push(materialId);
        updateSelectedMaterialsDisplay(selectedMaterials);
    } else {
        alert("この素材は選択上限に達しました。");
    }
}

/**
 * 選択された素材の表示を更新する。
 */
function updateSelectedMaterialsDisplay(selectedMaterials) {
    const container = document.getElementById('selectedMaterials');
    if (!container) return;

    container.innerHTML = '';
    for (const materialId of selectedMaterials) {
        const material = MATERIAL_DATA[materialId];
        const materialEl = document.createElement('div');
        materialEl.className = 'selected-material-item';
        materialEl.innerHTML = `
            <span class="material-name">${material.name}</span>
            <span class="material-rarity">レア度: ${material.rarity}</span>
        `;
        container.appendChild(materialEl);
    }

    // 作成ボタンの有効/無効を切り替え
    const craftBtn = document.getElementById('craftOrbBtn');
    if (craftBtn) {
        craftBtn.disabled = selectedMaterials.length === 0;
    }
}
