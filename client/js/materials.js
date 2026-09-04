// client/js/materials.js

const MATERIAL_DATA = {
    // レア度1 - 低級�?�?
    goblin_fang: { id: 'goblin_fang', name: 'ゴブリンの�?', description: 'ゴブリンから採れる鋭�?牙。武器の�?材として使われる�?', rarity: 1 },
    goblin_hide: { id: 'goblin_hide', name: 'ゴブリンの皮', description: 'ゴブリンの丈夫な皮。防具の�?材として使われる�?', rarity: 1 },
    slime_jelly: { id: 'slime_jelly', name: 'スライ�?ゼリー', description: 'スライ�?から採れるゼリー。低ティアオーブ�?��?材になる�?', rarity: 1 },
    wolf_fang: { id: 'wolf_fang', name: '狼の�?', description: '狼の鋭�?牙。�?飾品�?��?材になる�?', rarity: 1 },
    wolf_pelt: { id: 'wolf_pelt', name: '狼の毛皮', description: '狼の暖か�?毛皮。防具の�?材になる�?', rarity: 1 },
    bat_wing: { id: 'bat_wing', name: 'コウモリの翼', description: 'コウモリの�?�?翼。軽量な�?材になる�?', rarity: 1 },
    rat_tail: { id: 'rat_tail', name: 'ネズミ�?�尾', description: 'ネズミ�?�しな�?かな尾。細工品�?��?材になる�?', rarity: 1 },
    snake_scale: { id: 'snake_scale', name: '�?の�?', description: '�?の滑らかな鱗。小さな�?飾に使われる�?', rarity: 1 },
    spider_silk: { id: 'spider_silk', name: '蜘蛛の糸', description: '蜘蛛の丈夫な糸。織物の�?材になる�?', rarity: 1 },
    boar_tusk: { id: 'boar_tusk', name: '猪の�?', description: '猪の太�?牙。突き物の�?材になる�?', rarity: 1 },
    skeleton_bone: { id: 'skeleton_bone', name: 'スケルトンの骨', description: 'スケルトンの骨。硬�?�?材になる�?', rarity: 1 },
    ghost_essence: { id: 'ghost_essence', name: 'ゴースト�?�エ�?センス', description: 'ゴースト�?�魂�?��?�?。不思議な�?材になる�?', rarity: 1 },
    mushroom_cap: { id: 'mushroom_cap', name: 'キノコの�?', description: '毒キノコの傘。薬の�?材になる�?', rarity: 1 },
    herb_leaf: { id: 'herb_leaf', name: '薬草�?��?', description: '回復薬の原料になる薬草�?', rarity: 1 },
    rock_fragment: { id: 'rock_fragment', name: '岩石の�?�?', description: '砕けた岩石。建築�?材になる�?', rarity: 1 },

    // レア度2 - 中級�?�?
    slime_core: { id: 'slime_core', name: 'スライ�?コア', description: 'スライ�?の核。オーブ�?��?材になる�?', rarity: 2 },
    orc_horn: { id: 'orc_horn', name: 'オークの�?', description: 'オークの強固な角。武器の�?材になる�?', rarity: 2 },
    orc_armor: { id: 'orc_armor', name: 'オークの鎧', description: 'オークの粗雑な鎧。防具の�?材になる�?', rarity: 2 },
    harpy_feather: { id: 'harpy_feather', name: 'ハ�?�ピ�?�の羽', description: 'ハ�?�ピ�?�の美し�?羽。魔法�?��?材になる�?', rarity: 2 },
    minotaur_horn: { id: 'minotaur_horn', name: 'ミノタウロスの�?', description: 'ミノタウロスの巨大な角。強力な武器の�?材になる�?', rarity: 2 },
    ogre_fist: { id: 'ogre_fist', name: 'オーガの拳', description: 'オーガの硬�?拳。打�?武器の�?材になる�?', rarity: 2 },
    dark_essence: { id: 'dark_essence', name: 'ダークエ�?センス', description: '�?の力を宿すエ�?センス。闇属性の�?材になる�?', rarity: 2 },
    fire_crystal: { id: 'fire_crystal', name: 'ファイアクリスタル', description: '炎�?�力が込められた結晶。火属性の�?材になる�?', rarity: 2 },
    ice_shard: { id: 'ice_shard', name: 'アイスシャー�?', description: '冷気を放つ氷の破�?。氷属性の�?材になる�?', rarity: 2 },
    lightning_gem: { id: 'lightning_gem', name: 'ライトニングジェ�?', description: '雷を纏う宝石。雷属性の�?材になる�?', rarity: 2 },
    poison_fang: { id: 'poison_fang', name: '毒牙', description: '猛毒を含む牙。毒属性の�?材になる�?', rarity: 2 },
    iron_ore: { id: 'iron_ore', name: '�?鉱石', description: '�?を含む鉱石。鍛�?の基本�?材になる�?', rarity: 2 },
    silver_ore: { id: 'silver_ore', name: '銀鉱石', description: '銀を含む鉱石。聖なる武器の�?材になる�?', rarity: 2 },
    magic_powder: { id: 'magic_powder', name: '魔法�?��?', description: '魔力を含む粉。魔法�?�触媒になる�?', rarity: 2 },
    ancient_scroll: { id: 'ancient_scroll', name: '古代の巻物', description: '古代の知識が記された巻物。魔法�?��?材になる�?', rarity: 2 },

    // レア度3 - 上級�?�?
    dragon_scale: { id: 'dragon_scale', name: 'ドラゴンの�?', description: 'フレイ�?ドラゴンの硬�?鱗。高い防御力を持つ�?材�?', rarity: 3 },
    dragon_bone: { id: 'dragon_bone', name: 'ドラゴンの骨', description: 'ドラゴンの強固な骨。武器の�?材になる�?', rarity: 3 },
    phoenix_feather: { id: 'phoenix_feather', name: 'フェニックスの羽', description: '不死鳥の羽。復活の魔法�?��?材になる�?', rarity: 3 },
 unicorn_horn: { id: 'unicorn_horn', name: 'ユニコーンの�?', description: 'ユニコーンの聖なる角。回復魔法�?��?材になる�?', rarity: 3 },
    griffin_claw: { id: 'griffin_claw', name: 'グリフォンの爪', description: 'グリフォンの鋭�?爪。�??り裂く武器の�?材になる�?', rarity: 3 },
    chimera_eye: { id: 'chimera_eye', name: 'キメラの目', description: 'キメラの怪しい目。予知の魔法�?��?材になる�?', rarity: 3 },
    hydra_venom: { id: 'hydra_venom', name: 'ヒドラの�?', description: 'ヒドラの猛毒。強力な毒�?��?材になる�?', rarity: 3 },
    titan_stone: { id: 'titan_stone', name: 'タイタンの石', description: 'タイタンの力が宿る石。巨大な武器の�?材になる�?', rarity: 3 },
    elemental_core: { id: 'elemental_core', name: 'エレメンタルの核', description: 'エレメンタルの核。�??�?魔法�?��?材になる�?', rarity: 3 },
    gold_ore: { id: 'gold_ore', name: '金鉱石', description: '金を含む鉱石。高級�?飾の�?材になる�?', rarity: 3 },
    mithril_ore: { id: 'mithril_ore', name: 'ミスリル鉱石', description: '軽くて丈夫なミスリル。最強の防具の�?材になる�?', rarity: 3 },
    star_fragment: { id: 'star_fragment', name: '星�?��?�?', description: '星から落ちた�?�?。�?宙�?�力を宿す�?', rarity: 3 },
    moon_stone: { id: 'moon_stone', name: '�?ーンスト�?�ン', description: '月�?�光を宿す石。精神魔法�?��?材になる�?', rarity: 3 },
    sun_crystal: { id: 'sun_crystal', name: 'サンクリスタル', description: '太陽の光を宿す結晶。�?�属性の�?材になる�?', rarity: 3 },

    // レア度4 - 最高級�?�?
    dragon_heart: { id: 'dragon_heart', name: 'ドラゴンの�?�?', description: 'フレイ�?ドラゴンの�?臓。高ティアオーブ�?��?材になる�?', rarity: 4 },
    dragon_soul: { id: 'dragon_soul', name: 'ドラゴンの�?', description: '古代ドラゴンの魂。伝説の武器の�?材になる�?', rarity: 4 },
    divine_crystal: { id: 'divine_crystal', name: '神聖クリスタル', description: '神�?の力が宿る結晶。神聖武器の�?材になる�?', rarity: 4 },
    abyss_gem: { id: 'abyss_gem', name: 'アビスジェ�?', description: '深淵の力が宿る宝石。闇魔法�?�最強�?材になる�?', rarity: 4 },
    world_tree_leaf: { id: 'world_tree_leaf', name: '世界樹の�?', description: '世界樹の葉。創�?の魔法�?��?材になる�?', rarity: 4 },
    time_sand: { id: 'time_sand', name: '時�?��?', description: '時間を操る�?�。時魔法�?��?材になる�?', rarity: 4 },
    void_essence: { id: 'void_essence', name: '虚空のエ�?センス', description: '虚空の力を宿すエ�?センス。空間魔法�?��?材になる�?', rarity: 4 },
    chaos_orb: { id: 'chaos_orb', name: 'カオスオー�?', description: '混沌�?�力が宿る球体。無属性の最強�?材になる�?', rarity: 4 },
    eternal_flame: { id: 'eternal_flame', name: '永�?の�?', description: '消えることのな�?炎。創�?の源になる�?', rarity: 4 },
    void_stone: { id: 'void_stone', name: 'ヴォイドスト�?�ン', description: '虚空を�??り裂く石。次�?の最強�?材になる�?', rarity: 4 },


    // レア度1�?4 追�?�?材（大�?増量?�?
    frog_leg: { id: 'frog_leg', name: 'カエルの�?', description: '�?早�?脚。跳躍系スキルの�?材になる�?', rarity: 1 },
    crow_feather: { id: 'crow_feather', name: 'カラスの羽', description: '�?黒�?�羽根。呪術�?��?材になる�?', rarity: 1 },
    hornet_stinger: { id: 'hornet_stinger', name: 'スズメバチの�?', description: '鋭�?毒�?�。毒武器の�?材になる�?', rarity: 1 },
    centipede_shell: { id: 'centipede_shell', name: '�?カ�?の殻', description: '硬�?殻。軽量な防具の�?材になる�?', rarity: 1 },
    crab_shell: { id: 'crab_shell', name: 'カニ�?�甲�?', description: '頑丈な甲�?。盾の�?材になる�?', rarity: 1 },
    turtle_shell: { id: 'turtle_shell', name: 'カメの甲�?', description: '非常に硬�?甲�?。防具の�?材になる�?', rarity: 1 },
    weasel_fur: { id: 'weasel_fur', name: 'イタチ�?�毛皮', description: '滑らかな毛皮。�?飾品�?��?材になる�?', rarity: 1 },
    firefly_light: { id: 'firefly_light', name: 'ホタルの�?', description: 'ほのかに光る粉。�?�り�?�魔法�?��?材になる�?', rarity: 1 },
    mole_claw: { id: 'mole_claw', name: 'モグラの爪', description: '土を掘る爪。採掘道具の�?材になる�?', rarity: 1 },
    scorpion_tail: { id: 'scorpion_tail', name: 'サソリの尾', description: '猛毒を持つ尾。毒武器の�?材になる�?', rarity: 1 },
    jackal_fang: { id: 'jackal_fang', name: 'ジャ�?カルの�?', description: '鋭�?牙。小型武器の�?材になる�?', rarity: 1 },
    vulture_feather: { id: 'vulture_feather', name: 'ハゲワシの羽', description: '大きな羽根。矢羽根の�?材になる�?', rarity: 1 },
    shaman_totem: { id: 'shaman_totem', name: 'シャーマンの護符', description: '呪術�?�護符。魔法�?��?材になる�?', rarity: 1 },
    lizard_scale: { id: 'lizard_scale', name: 'リザード�?��?', description: '砂�?に耐える鱗。防具の�?材になる�?', rarity: 2 },
    troll_hide: { id: 'troll_hide', name: 'トロルの皮', description: '再生力を持つ皮。回復薬の�?材になる�?', rarity: 2 },
    hag_eye: { id: 'hag_eye', name: '魔女の目', description: '呪�?の目玉。呪術�?��?材になる�?', rarity: 2 },
    bandit_dagger_shard: { id: 'bandit_dagger_shard', name: '野盗の短剣の�?�?', description: '折れた短剣。鍛�?の�?材になる�?', rarity: 2 },
    mercenary_badge: { id: 'mercenary_badge', name: '傭兵の徽�?', description: '戦歴を示す徽�?。�?飾品�?��?材になる�?', rarity: 2 },
    cursed_thread: { id: 'cursed_thread', name: '呪�?の糸', description: '人形を縛る糸。呪術�?��?材になる�?', rarity: 2 },
    gargoyle_wing: { id: 'gargoyle_wing', name: 'ガーゴイルの翼', description: '石の翼。防具の�?材になる�?', rarity: 2 },
    kappa_plate: { id: 'kappa_plate', name: '河童の皿', description: '頭の皿。水の魔法�?��?材になる�?', rarity: 2 },
    tengu_fan: { id: 'tengu_fan', name: '天狗�?�羽団�?', description: '風を操る団�?。風魔法�?��?材になる�?', rarity: 2 },
    oni_horn_fragment: { id: 'oni_horn_fragment', name: '鬼の角�?��?�?', description: '小さな角。武器の�?材になる�?', rarity: 2 },
    ice_wolf_fang: { id: 'ice_wolf_fang', name: '氷狼の�?', description: '冷気を帯びた牙。氷属性の�?材になる�?', rarity: 2 },
    bog_herb: { id: 'bog_herb', name: '沼地の秘薬�?', description: '毒と薬を併せ持つ草。調合�?��?材になる�?', rarity: 2 },
    wraith_shroud: { id: 'wraith_shroud', name: 'レイスの死�?�?', description: '冷たい�?。闇属性の�?材になる�?', rarity: 2 },
    basilisk_eye: { id: 'basilisk_eye', name: 'バジリスクの目', description: '石化�?�力を宿す目。呪術�?�最強�?材になる�?', rarity: 3 },
    manticore_stinger: { id: 'manticore_stinger', name: 'マン�?ィコアの毒�??', description: '強力な毒�?�。毒武器の�?材になる�?', rarity: 3 },
    banshee_wail: { id: 'banshee_wail', name: 'バンシーの絶叫石', description: '悲鳴を宿す石。恐怖魔法�?��?材になる�?', rarity: 3 },
    lich_phylactery: { id: 'lich_phylactery', name: 'リ�?チ�?�魂器', description: '魂を宿す器。死霊術�?��?材になる�?', rarity: 3 },
    werebear_claw: { id: 'werebear_claw', name: 'ワーベアの爪', description: '巨大な爪。打�?武器の�?材になる�?', rarity: 3 },
    sphinx_riddle_stone: { id: 'sphinx_riddle_stone', name: 'スフィンクスの謎石', description: '知恵を宿す石。学問�?�魔法�?��?材になる�?', rarity: 3 },
    cerberus_fang: { id: 'cerberus_fang', name: 'ケルベロスの�?', description: '三つ首�?�牙。�?�府�?��?材になる�?', rarity: 3 },
    storm_feather: { id: 'storm_feather', name: '嵐�?�羽根', description: '雷を纏う羽根。風雷魔法�?��?材になる�?', rarity: 3 },
    coral_scale: { id: 'coral_scale', name: '珊瑚の�?', description: '海の力を宿す鱗。水属性の最強�?材になる�?', rarity: 3 },
    sandworm_hide: { id: 'sandworm_hide', name: 'サンドワー�?の皮', description: '砂を纏う皮。防具の�?材になる�?', rarity: 3 },
    shadow_pelt: { id: 'shadow_pelt', name: '影の毛皮', description: '�?に溶ける毛皮。隠�?の�?材になる�?', rarity: 3 },
    crystal_shard: { id: 'crystal_shard', name: 'クリスタルの�?�?', description: '光を屈折させる�?�?。魔法増�?の�?材になる�?', rarity: 3 },
    serpent_scale: { id: 'serpent_scale', name: 'シーサーペント�?��?', description: '波を操る鱗。水魔法�?��?材になる�?', rarity: 3 },
    frost_core: { id: 'frost_core', name: '氷結�?�核', description: '絶対零度の核。氷属性の最強�?材になる�?', rarity: 4 },
    magma_core: { id: 'magma_core', name: 'マグマ�?�核', description: '灼熱の核。火属性の最強�?材になる�?', rarity: 4 },
    star_dragon_scale: { id: 'star_dragon_scale', name: '星龍�?��?', description: '星屑を纏う鱗。�?宙魔法�?��?材になる�?', rarity: 4 },
    reaper_scythe_shard: { id: 'reaper_scythe_shard', name: '死神�?�鎌�?��?�?', description: '魂を刈る鎌�?��?�?。死の魔法�?��?材になる�?', rarity: 4 },
    nether_crown_shard: { id: 'nether_crown_shard', name: '冥王�?��?の�?�?', description: '�?の王�?�証。最強の�?�?材になる�?', rarity: 4 },
    celestial_ash: { id: 'celestial_ash', name: '天界�?�灰', description: '不�?の灰。復活魔法�?�最強�?材になる�?', rarity: 4 },
    world_serpent_fang: { id: 'world_serpent_fang', name: '世界�?の�?', description: '世界を巻く蛇の牙。伝説の�?材になる�?', rarity: 4 },
    dream_dust: { id: 'dream_dust', name: '夢の�?', description: '夢を喰らう砂。精神魔法�?�最強�?材になる�?', rarity: 4 },
    gravity_orb: { id: 'gravity_orb', name: '重力の�?', description: '空間を歪める�?。重力魔法�?��?材になる�?', rarity: 4 },
    blight_scale: { id: 'blight_scale', name: '疫龍�?��?', description: '疫�?を纏う鱗。呪毒�?�最強�?材になる�?', rarity: 4 },
    primeval_core: { id: 'primeval_core', name: '原�?��?�核', description: '世界創�?の核。�?�属性の最強�?材になる�?', rarity: 4 },
};

/**
 * プレイヤーの�?材インベントリを取得する�?
 * @returns {object} �?材IDをキー、所持数を値とするオブジェクト�?
 */
function getPlayerMaterials() {
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    return player ? (player.materials || {}) : {};
}

/**
 * プレイヤーの�?材インベントリに�?材を追�?する�?
 * @param {string} materialId - 追�?する�?材�?�ID�?
 * @param {number} count - 追�?する数�?
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
 * プレイヤーの�?材インベントリから�?材を消費する�?
 * @param {string} materialId - 消費する�?材�?�ID�?
 * @param {number} count - 消費する数�?
 * @returns {boolean} 消費に成功したかど�?か�?
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
 * �?材インベントリのUI?��一覧?��をレンダリングする�?
 * 通常のモンスター�?材�?MATERIAL_DATAに定義されて�?るもの?��と�?
 * ボスの限界突�?��?材�?"{bossId}_limit_break_material" と�?�?IDで保存されるも�?�?���?�
 * 両方をまとめて表示する�?
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
        container.innerHTML = '<p>�?材を所持して�?ません�?</p>';
        return;
    }

    for (const materialId in materials) {
        const count = materials[materialId];
        if (!count || count <= 0) continue;

        // ボスの限界突�?��?材�?"{bossId}_limit_break_material"?��かど�?かを判定す�?
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
                <p class="material-description">${boss ? `�u${boss.name}�v�̕�������E�˔j���邽�߂̑f�ށB` : '�{�X����̌��E�˔j�Ɏg�p����f�ށB'}</p>
`;
            container.appendChild(materialEl);
            continue;
        }

        // 通常のモンスター�?�?
        const materialInfo = MATERIAL_DATA[materialId];
        if (materialInfo) {
            const materialEl = document.createElement('div');
            materialEl.className = 'material-item';
            materialEl.innerHTML = `
                <div class="material-header">
                    <span class="material-name">${materialInfo.name}</span>
                    <span class="material-count">x ${count}</span>
                </div>
                <p class="material-description">${materialInfo.description}?��レア度: ${materialInfo.rarity}?�?</p>
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
                <p class="material-description">詳細不�?��?��?材です�?</p>
            `;
            container.appendChild(materialEl);
        }
    }
}

/**
 * �?材シス�?�?を�?�期化する�?
 */
function initMaterials() {
    console.log("Initializing materials system.");
    renderMaterialsInventory();
    
    // �?材管�?モーダルのイベント設�?
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
    
    // オーブ作�?��?�タン
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
}

/**
 * 選択された�?材からオーブ�?�レア度を計算する�?
 * @param {Array<string>} materialIds - �?材IDの配�?�（最大5つ?�?
 * @returns {string} オーブ�?��?ィア?�?tier1, tier2, tier3, tier4?��また�?�null
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

    // 平�?レア度を計�?
    const avgRarity = totalRarity / materialIds.length;

    // 平�?レア度に基づ�?て�?ィアを決�?
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

// 武器�?材として使用できる�?材ID?��説明�?に「武器の�?材」とあるも�?�?�?
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

// 武器�?材�?��?�ナス定義?��レア度による基本倍率?�?
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
 * �?材から武器ボ�?�ナスを計算す�?
 * @param {Array<string>} materialIds - �?材IDの配�?�（最大3つ?�?
 * @returns {object} ボ�?�ナスオブジェク�?
 */
function calculateWeaponMaterialBonus(materialIds) {
    if (!materialIds || materialIds.length === 0) return {};
    
    const totalBonus = { atk: 0, def: 0, speed: 0, maxHp: 0, special: 0 };
    
    for (const materialId of materialIds) {
        const bonus = WEAPON_MATERIAL_BONUSES[materialId];
        if (bonus) {
            const rarity = bonus.rarity || 1;
            const multiplier = RARITY_MULTIPLIERS[rarity] || 1.0;
            
            // レア度以外�?�ス�?ータスボ�?�ナスを取�?
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
 * �?材からオーブを作�?�する�?
 * @param {Array<string>} materialIds - �?材IDの配�?�（最大5つ?�?
 * @returns {object|null} 作�?�されたオーブ、また�?�失敗時はnull
 */
function craftOrbFromMaterials(materialIds) {
    if (!materialIds || materialIds.length === 0) return null;

    // プレイヤーの�?材を確�?
    const playerMaterials = getPlayerMaterials();
    for (const materialId of materialIds) {
        if (!playerMaterials[materialId] || playerMaterials[materialId] < 1) {
            console.warn(`Not enough material: ${materialId}`);
            return null;
        }
    }

    // �?材を消費
    for (const materialId of materialIds) {
        if (!removeMaterialFromPlayer(materialId, 1)) {
            console.warn(`Failed to remove material: ${materialId}`);
            return null;
        }
    }

    // オーブ�?��?ィアを計�?
    const tier = calculateOrbRarity(materialIds);
    if (!tier) {
        console.warn("Failed to calculate orb rarity");
        return null;
    }

    // オーブを作�?��?weapons.jsのcreateOrb関数を使用?�?
    if (typeof createOrb === 'function') {
        const orb = createOrb(tier);
        return orb;
    } else {
        console.error("createOrb function not available");
        return null;
    }
}

/**
 * getOrbDisplayName関数の定義?�?weapons.jsから呼び出し可能にするため?�?
 */
function getOrbDisplayName(orb) {
    if (!orb) return "不�?�なオー�?";
    const tierNames = { tier1: '�?ィア1', tier2: '�?ィア2', tier3: '�?ィア3', tier4: '�?ィア4' };
    const statLabels = { atk: '攻�?', def: '防御', speed: '速さ', special: '特�?', maxHp: 'HP' };
    const tierName = tierNames[orb.tier] || orb.tier;
    const statLabel = statLabels[orb.statType] || orb.statType;
    const bonusPercent = Math.round(orb.bonus * 100);

    let name = `${tierName}オー�? (${statLabel}+${bonusPercent}%)`;

    if (orb.uniqueAbility) {
        name += ` [${orb.uniqueAbility.name}]`;
    }

    return name;
}

/**
 * �?材選択UIを表示する�?
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
        <h3>オーブ作�??</h3>
        <p>�?材を選択してオーブを作�?�（最大5つ?�?</p>
        <div id="selectedMaterials" class="selected-materials"></div>
        <div id="materialSelection" class="material-selection"></div>
        <button id="craftOrbBtn" class="btn-primary" disabled>オーブを作�??</button>
        <button id="clearSelectionBtn" class="btn-secondary">選択をクリア</button>
    `;

    // �?材選択エリアをレンダリング
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

    // ボタンイベン�?
    document.getElementById('craftOrbBtn').onclick = () => {
        if (selectedMaterials.length > 0) {
            const orb = craftOrbFromMaterials(selectedMaterials);
            if (orb) {
                // オーブをプレイヤーに追�?
                let player = getPlayerData();
                if (player) {
                    player.orbs = player.orbs || [];
                    player.orbs.push(orb);
                    localStorage.setItem("player", JSON.stringify(player));
                    alert(`オーブを作�?�しました?��\n${getOrbDisplayName(orb)}`);
                    selectedMaterials.length = 0;
                    showMaterialCraftingUI(); // UIを�?�描画
                }
            } else {
                alert("オーブ�?�作�?�に失敗しました�?");
            }
        }
    };

    document.getElementById('clearSelectionBtn').onclick = () => {
        selectedMaterials.length = 0;
        updateSelectedMaterialsDisplay(selectedMaterials);
    };
}

/**
 * �?材を選択する�?
 */
function selectMaterial(materialId, materials, selectedMaterials) {
    if (selectedMaterials.length >= 5) {
        alert("最大5つまでしか選択できません�?");
        return;
    }

    if (materials[materialId] > selectedMaterials.filter(id => id === materialId).length) {
        selectedMaterials.push(materialId);
        updateSelectedMaterialsDisplay(selectedMaterials);
    } else {
        alert("こ�?��?材�?�選択上限に達しました�?");
    }
}

/**
 * 選択された�?材�?�表示を更新する�?
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

    // 作�?��?�タンの有効/無効を�??り替�?
    const craftBtn = document.getElementById('craftOrbBtn');
    if (craftBtn) {
        craftBtn.disabled = selectedMaterials.length === 0;
    }
}
