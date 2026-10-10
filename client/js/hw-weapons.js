// ============================================================
// ハクスラ武器システム (hw-weapons.js)
//  ・「○○＋鉄の剣」形式の名前（○○はレア度で決まる）
//  ・ステージの敵／ボスごとにドロップする武器ベースが決まっている
//  ・特殊効果（stat型＝常時ステータス／proc型＝命中・撃破・被弾時に発動）
//  ・PoE風：武器に穴(ソケット)があり、既存のオーブをはめ込んで強化する
//  ・データは localStorage "sbHack" に保存（プレイヤーデータ本体とは独立）
// ============================================================
(function () {
    'use strict';

    // ---------- レア度 ----------
    const RARITIES = {
        normal:    { label: 'ノーマル',   color: '#c9c9c9', mult: 1.00, pctMul: 1.00, orig: 0.08, forge: 100,    sockets: [0, 1], fx: [0, 1], weight: 52,
                     prefixes: ['弱小な', 'ボロい', 'ふつうの', '錆びた', '古びた', '粗末な'] },
        magic:     { label: 'マジック',   color: '#6fa8ff', mult: 1.18, pctMul: 1.12, orig: 0.13, forge: 1000,   sockets: [1, 2], fx: [1, 2], weight: 28,
                     prefixes: ['するどい', '頑丈な', '素早い', '軽やかな', '澄んだ', '堅牢な'] },
        rare:      { label: 'レア',       color: '#ffd84a', mult: 1.42, pctMul: 1.30, orig: 0.20, forge: 5000,   sockets: [2, 3], fx: [2, 3], weight: 13,
                     prefixes: ['猛き', '疾き', '烈火の', '氷雪の', '雷鳴の', '血濡れの', '凶悪な'] },
        epic:      { label: 'エピック',   color: '#c077ff', mult: 1.75, pctMul: 1.55, orig: 0.30, forge: 25000,  sockets: [3, 4], fx: [3, 4], weight: 1.6,
                     prefixes: ['英雄の', '竜殺しの', '破砕の', '深淵の', '星屑の', '覇者の'] },
        legendary: { label: 'レジェンド', color: '#ff8a2a', mult: 2.20, pctMul: 2.00, orig: 0.42, forge: 100000, sockets: [4, 6], fx: [4, 5], weight: 0.012,
                     prefixes: ['神々の', '終焉の', '星砕きの', '世界喰らいの', '永劫の', '天啓の'] }
    };
    const RARITY_ORDER = ['normal', 'magic', 'rare', 'epic', 'legendary'];

    // ---------- 武器の攻撃力は「％」で伸びる ----------
    //  ・武器そのものの攻撃力は固定値ではなく「プレイヤーの攻撃力に対する＋○％」。
    //  ・弱い武器で＋3％前後、最終ボスのレジェンドでも＋50％（PCT_CAP。以前は30％だったが、武器が弱く敵が強すぎたため引き上げ）。強さの主役はステータス合計。
    //  ・w.dmg は戦闘計算用（HIT_BASE × (1＋pct)）。stage.js は今までどおり w.dmg を使うので手を入れなくてよい。
    const HIT_BASE = 11;
    const PCT_CAP = 0.50;
    const LEGENDARY_MIN_ILVL = 24;     // レジェンドは、第三世界以降（ステージLv24以上）からしか出ない
    function dmgFromPct(pct) { return Math.round(HIT_BASE * (1 + pct) * 100) / 100; }

    // ---------- 武器種（攻撃パターン）----------
    // kind: cone(近接扇) / line(突き) / proj(弾) / ring(全周) / smash(叩きつけ範囲) / chain(鞭)
    const TYPES = {
        sword:      { label: '剣',         kind: 'cone',  range: 78,  arc: 1.7, cd: 0.42, mult: 1.0,  knock: 70 },
        greatsword: { label: '大剣',       kind: 'cone',  range: 116, arc: 2.5, cd: 0.95, mult: 2.4,  knock: 200 },
        dagger:     { label: '短剣',       kind: 'cone',  range: 52,  arc: 1.4, cd: 0.17, mult: 0.45, knock: 10, crit: 0.12 },
        katana:     { label: '刀',         kind: 'cone',  range: 92,  arc: 1.2, cd: 0.38, mult: 1.2,  knock: 40, lunge: 46, crit: 0.2 },
        spear:      { label: '槍',         kind: 'line',  range: 160, width: 28, cd: 0.55, mult: 1.35, knock: 70 },
        halberd:    { label: '薙刀',       kind: 'cone',  range: 124, arc: 2.2, cd: 0.7,  mult: 1.55, knock: 90 },
        scythe:     { label: '大鎌',       kind: 'cone',  range: 100, arc: 3.4, cd: 0.62, mult: 1.1,  knock: 50, lifesteal: 0.05 },
        axe:        { label: '斧',         kind: 'cone',  range: 84,  arc: 2.0, cd: 0.7,  mult: 1.7,  knock: 130 },
        hammer:     { label: '槌',         kind: 'smash', radius: 92, cd: 1.0,  mult: 2.3,  knock: 240, reach: 66 },
        whip:       { label: '鞭',         kind: 'line',  range: 210, width: 20, cd: 0.5,  mult: 0.95, knock: 20 },
        fist:       { label: '拳',         kind: 'cone',  range: 54,  arc: 1.3, cd: 0.16, mult: 0.55, knock: 15 },
        boots:      { label: '脚',         kind: 'cone',  range: 70,  arc: 2.6, cd: 0.3,  mult: 0.85, knock: 90, lunge: 30 },
        pistol:     { label: '拳銃',       kind: 'proj',  speed: 780, radius: 6,  cd: 0.21, mult: 0.55, range: 720 },
        bow:        { label: '弓',         kind: 'proj',  speed: 680, radius: 8,  cd: 0.48, mult: 1.0,  range: 800, pierce: 1 },
        crossbow:   { label: 'クロスボウ', kind: 'proj',  speed: 900, radius: 8,  cd: 0.8,  mult: 1.9,  range: 880, pierce: 2 },
        wand:       { label: '魔法の杖',   kind: 'proj',  speed: 320, radius: 12, cd: 0.58, mult: 1.1,  range: 640, homing: true },
        shotgun:    { label: '散弾銃',     kind: 'proj',  speed: 700, radius: 6,  cd: 0.85, mult: 0.5,  range: 420, spread: 5 },
        esper:      { label: '念動',       kind: 'ring',  radius: 100, cd: 0.65, mult: 0.95, knock: 110 },
        // ---- 第二世界「次元の裏側」で手に入る武器種（world:2）----
        //  multi: 1振りで連続ヒットする回数 / aoe: 弾が当たった場所で起きる爆発の半径 / pierce: 弾の貫通数
        twinblade:  { label: '双刃',       kind: 'cone',  range: 64,  arc: 1.8, cd: 0.30, mult: 0.62, knock: 20, multi: 2, crit: 0.08, world: 2 },
        chakram:    { label: '円月輪',     kind: 'proj',  speed: 560, radius: 14, cd: 0.55, mult: 0.95, range: 560, pierce: 4, world: 2 },
        cannon:     { label: '魔導砲',     kind: 'proj',  speed: 430, radius: 20, cd: 1.5,  mult: 3.0,  range: 760, aoe: 95, world: 2 },
        tome:       { label: '魔導書',     kind: 'proj',  speed: 340, radius: 10, cd: 0.75, mult: 0.6,  range: 600, homing: true, spread: 3, world: 2 },
        kusarigama: { label: '鎖鎌',       kind: 'line',  range: 250, width: 40, cd: 0.62, mult: 1.3,  knock: 40, world: 2 },
        // ---- 第三世界「神域」で手に入る武器種（world:3）----
        rapier:     { label: '細剣',       kind: 'line',  range: 150, width: 22, cd: 0.26, mult: 0.85, knock: 15, crit: 0.15, world: 3 },
        scepter:    { label: '神杖',       kind: 'ring',  radius: 135, cd: 0.85, mult: 1.7,  knock: 170, world: 3 },
        gunblade:   { label: '銃剣',       kind: 'cone',  range: 82,  arc: 1.5, cd: 0.45, mult: 1.0, knock: 50, multi: 2, lunge: 30, world: 3 },
        // 浮遊砲：誘導3発×0.34（以前は4発×0.5＋貫通）。1回の斉射の合計は以前の約半分、貫通は無し
        bit:        { label: '浮遊砲',     kind: 'proj',  speed: 380, radius: 8,  cd: 0.62, mult: 0.34, range: 600, homing: true, spread: 3, world: 3 },
        // ---- 第四世界「機神の都」で手に入る武器種（world:4）----
        railgun:    { label: '電磁砲',     kind: 'proj',  speed: 1100, radius: 7,  cd: 1.05, mult: 2.6, range: 1000, pierce: 5, world: 4 },
        gearblade:  { label: '歯車刃',     kind: 'cone',  range: 88,  arc: 2.2, cd: 0.28, mult: 0.62, knock: 30, multi: 3, world: 4 },
        // ---- 第五世界「虚空の彼方」で手に入る武器種（world:5）----
        orbital:    { label: '衛星砲',     kind: 'proj',  speed: 300, radius: 16, cd: 1.0,  mult: 0.8,  range: 680, homing: true, spread: 3, aoe: 60, world: 5 },
        singularity:{ label: '特異点',     kind: 'ring',  radius: 170, cd: 0.8,  mult: 1.9,  knock: 140, world: 5 },
        // ---- 追加の武器種（各世界で3種ずつ）----
        //  第一世界
        rod:        { label: '棍',         kind: 'line',  range: 132, width: 36, cd: 0.40, mult: 0.9,  knock: 95 },
        sling:      { label: '投石器',     kind: 'proj',  speed: 520, radius: 9,  cd: 0.65, mult: 1.05, range: 600, aoe: 42 },
        claws:      { label: '爪',         kind: 'cone',  range: 58,  arc: 1.6, cd: 0.22, mult: 0.5,  knock: 12, multi: 2, crit: 0.1 },
        //  第二世界
        flail:      { label: 'フレイル',   kind: 'smash', radius: 82,  cd: 0.75, mult: 1.6,  knock: 150, reach: 80, world: 2 },
        fan:        { label: '鉄扇',       kind: 'cone',  range: 74,  arc: 3.0, cd: 0.35, mult: 0.7,  knock: 110, world: 2 },
        boomerang:  { label: 'ブーメラン', kind: 'proj',  speed: 520, radius: 16, cd: 0.7,  mult: 0.9,  range: 520, pierce: 3, world: 2 },
        //  第三世界
        trident:    { label: '三叉槍',     kind: 'line',  range: 178, width: 48, cd: 0.6,  mult: 1.5,  knock: 80, world: 3 },
        chime:      { label: '鈴杖',       kind: 'ring',  radius: 118, cd: 0.45, mult: 0.8,  knock: 60, world: 3 },
        lance:      { label: 'ランス',     kind: 'line',  range: 205, width: 30, cd: 0.9,  mult: 2.2,  knock: 160, world: 3 },
        //  第四世界
        chainsaw:   { label: 'チェーンソー', kind: 'cone', range: 60, arc: 1.4, cd: 0.12, mult: 0.32, knock: 5, world: 4 },
        flamethrower:{ label: '火炎放射器', kind: 'proj', speed: 520, radius: 20, cd: 0.14, mult: 0.22, range: 260, pierce: 3, world: 4 },
        mortar:     { label: '迫撃砲',     kind: 'proj',  speed: 360, radius: 14, cd: 1.3,  mult: 2.4,  range: 780, aoe: 110, world: 4 },
        //  第五世界
        prism:      { label: '稜鏡',       kind: 'line',  range: 262, width: 52, cd: 0.5,  mult: 1.1,  knock: 30, world: 5 },
        comet:      { label: '彗星弓',     kind: 'proj',  speed: 760, radius: 10, cd: 0.5,  mult: 1.3,  range: 900, pierce: 4, world: 5 },
        voidblade:  { label: '虚空刃',     kind: 'cone',  range: 130, arc: 3.6, cd: 0.9,  mult: 2.6,  knock: 180, world: 5 },
        //  支援武器（味方や自分の回復・バフ、敵へのデバフ。攻撃力は低め）。sup: heal=回復 / buff=鼓舞 / debuff=弱体
        healstaff:  { label: '癒しの杖',   kind: 'ring',  radius: 150, cd: 0.9, mult: 0.35, knock: 0,  sup: 'heal',   support: true },
        banner:     { label: '鼓舞の旗',   kind: 'ring',  radius: 190, cd: 1.1, mult: 0.5,  knock: 30, sup: 'buff',   support: true },
        hexstaff:   { label: '呪詛の杖',   kind: 'cone',  range: 300,  arc: 0.8, cd: 0.6, mult: 0.8,  knock: 0,  sup: 'debuff', support: true },
        // 第三世界を作るときは、ここに world: 3 の武器種を足して、第三世界のステージの drops に対応する武器ベースを入れるだけでよい
    };
    // 世界ごとの武器種の一覧（武器庫・図鑑などで「どの世界で解禁される武器種か」を出すのに使う）
    function typesOfWorld(w) { return Object.keys(TYPES).filter(k => (TYPES[k].world || 1) === w); }

    // ---------- 武器ベース（ステージごとのドロップ元になる）----------
    // tier: 出現の目安レベル帯。dmg: 基礎攻撃力
    const BASES = [
        // 剣
        { id: 'iron_sword',    name: '鉄の剣',         type: 'sword',  dmg: 10, tier: 1 },
        { id: 'steel_sword',   name: '鋼の剣',         type: 'sword',  dmg: 16, tier: 3 },
        { id: 'rune_sword',    name: 'ルーンブレード', type: 'sword',  dmg: 24, tier: 6 },
        { id: 'holy_sword',    name: '聖剣',           type: 'sword',  dmg: 34, tier: 9 },
        { id: 'void_sword',    name: '虚空の剣',       type: 'sword',  dmg: 46, tier: 12 },
        // 大剣
        { id: 'big_blade',     name: '鉄塊の大剣',     type: 'greatsword', dmg: 14, tier: 1 },
        { id: 'zweihander',    name: 'ツヴァイハンダー', type: 'greatsword', dmg: 24, tier: 4 },
        { id: 'dragon_slayer', name: 'ドラゴンスレイヤー', type: 'greatsword', dmg: 38, tier: 8 },
        { id: 'world_edge',    name: '世界断ちの大剣', type: 'greatsword', dmg: 54, tier: 12 },
        // 短剣
        { id: 'knife',         name: '小刀',           type: 'dagger', dmg: 6,  tier: 1 },
        { id: 'stiletto',      name: 'スティレット',   type: 'dagger', dmg: 12, tier: 4 },
        { id: 'assassin_fang', name: '暗殺者の牙',     type: 'dagger', dmg: 20, tier: 8 },
        { id: 'moon_dagger',   name: '月影の短剣',     type: 'dagger', dmg: 28, tier: 12 },
        // 刀
        { id: 'bamboo_katana', name: '竹光の刀',       type: 'katana', dmg: 9,  tier: 1 },
        { id: 'wakizashi',     name: '業物の脇差',     type: 'katana', dmg: 18, tier: 5 },
        { id: 'muramasa',      name: '妖刀',           type: 'katana', dmg: 30, tier: 9 },
        { id: 'kusanagi',      name: '天叢雲剣',       type: 'katana', dmg: 44, tier: 13 },
        // 槍・薙刀
        { id: 'wood_spear',    name: '木の槍',         type: 'spear',  dmg: 9,  tier: 1 },
        { id: 'iron_lance',    name: '鉄の長槍',       type: 'spear',  dmg: 17, tier: 4 },
        { id: 'trident',       name: '三叉槍',         type: 'spear',  dmg: 27, tier: 8 },
        { id: 'gungnir',       name: '神槍グングニル', type: 'spear',  dmg: 42, tier: 13 },
        { id: 'naginata',      name: '薙刀',           type: 'halberd', dmg: 15, tier: 3 },
        { id: 'glaive',        name: 'グレイヴ',       type: 'halberd', dmg: 28, tier: 7 },
        { id: 'bardiche',      name: '戦場の大薙刀',   type: 'halberd', dmg: 40, tier: 11 },
        // 鎌・斧・槌
        { id: 'sickle',        name: '草刈り鎌',       type: 'scythe', dmg: 10, tier: 2 },
        { id: 'reaper',        name: '死神の大鎌',     type: 'scythe', dmg: 26, tier: 7 },
        { id: 'soul_scythe',   name: '魂喰らいの鎌',   type: 'scythe', dmg: 40, tier: 12 },
        { id: 'hand_axe',      name: '手斧',           type: 'axe',    dmg: 12, tier: 1 },
        { id: 'battle_axe',    name: '戦斧',           type: 'axe',    dmg: 22, tier: 5 },
        { id: 'berserk_axe',   name: '狂戦士の斧',     type: 'axe',    dmg: 36, tier: 10 },
        { id: 'wood_mallet',   name: '木槌',           type: 'hammer', dmg: 14, tier: 2 },
        { id: 'war_hammer',    name: 'ウォーハンマー', type: 'hammer', dmg: 26, tier: 6 },
        { id: 'mjolnir',       name: '雷神の槌',       type: 'hammer', dmg: 44, tier: 12 },
        // 鞭・拳・脚
        { id: 'leather_whip',  name: '革の鞭',         type: 'whip',   dmg: 8,  tier: 1 },
        { id: 'chain_whip',    name: '鎖鞭',           type: 'whip',   dmg: 18, tier: 5 },
        { id: 'dragon_whip',   name: '竜髭の鞭',       type: 'whip',   dmg: 32, tier: 10 },
        { id: 'cloth_glove',   name: '布のグローブ',   type: 'fist',   dmg: 6,  tier: 1 },
        { id: 'knuckle',       name: '鉄のナックル',   type: 'fist',   dmg: 15, tier: 4 },
        { id: 'asura_fist',    name: '修羅の拳',       type: 'fist',   dmg: 30, tier: 9 },
        { id: 'sneaker',       name: '安全靴',         type: 'boots',  dmg: 8,  tier: 1 },
        { id: 'spike_boots',   name: 'スパイクブーツ', type: 'boots',  dmg: 17, tier: 5 },
        { id: 'wind_greaves',  name: '疾風の具足',     type: 'boots',  dmg: 29, tier: 10 },
        // 遠距離
        { id: 'old_pistol',    name: '古い拳銃',       type: 'pistol', dmg: 7,  tier: 1 },
        { id: 'revolver',      name: 'リボルバー',     type: 'pistol', dmg: 14, tier: 4 },
        { id: 'magnum',        name: 'マグナム',       type: 'pistol', dmg: 24, tier: 8 },
        { id: 'rail_pistol',   name: 'レールピストル', type: 'pistol', dmg: 36, tier: 12 },
        { id: 'short_bow',     name: '短弓',           type: 'bow',    dmg: 10, tier: 1 },
        { id: 'long_bow',      name: '長弓',           type: 'bow',    dmg: 19, tier: 4 },
        { id: 'elven_bow',     name: 'エルフの弓',     type: 'bow',    dmg: 30, tier: 8 },
        { id: 'sky_bow',       name: '天穹の大弓',     type: 'bow',    dmg: 44, tier: 13 },
        { id: 'hand_xbow',     name: '手持ち弩',       type: 'crossbow', dmg: 18, tier: 3 },
        { id: 'heavy_xbow',    name: '重弩',           type: 'crossbow', dmg: 32, tier: 8 },
        { id: 'siege_xbow',    name: '攻城弩',         type: 'crossbow', dmg: 48, tier: 13 },
        { id: 'twig_wand',     name: '木の杖',         type: 'wand',   dmg: 9,  tier: 1 },
        { id: 'crystal_wand',  name: '水晶の杖',       type: 'wand',   dmg: 18, tier: 4 },
        { id: 'arch_staff',    name: '大魔導の杖',     type: 'wand',   dmg: 30, tier: 9 },
        { id: 'star_staff',    name: '星界の杖',       type: 'wand',   dmg: 42, tier: 13 },
        { id: 'hunting_gun',   name: '猟銃',           type: 'shotgun', dmg: 8, tier: 3 },
        { id: 'sawed_off',     name: '二連散弾銃',     type: 'shotgun', dmg: 14, tier: 7 },
        { id: 'dragon_breath', name: 'ドラゴンブレス砲', type: 'shotgun', dmg: 22, tier: 12 },
        { id: 'psy_ring',      name: '念動のリング',   type: 'esper',  dmg: 12, tier: 3 },
        { id: 'psy_crown',     name: '超能の冠',       type: 'esper',  dmg: 28, tier: 9 },
        // ---- 第二世界（次元の裏側）専用 ----
        { id: 'fenrir_fang',   name: '次元狼の双牙',   type: 'dagger', dmg: 38, tier: 15 },
        { id: 'world_tree_bow', name: '世界樹の大弓',  type: 'bow',    dmg: 56, tier: 16 },
        { id: 'mirage_blade',  name: '蜃気楼の太刀',   type: 'katana', dmg: 56, tier: 16 },
        { id: 'chrono_scythe', name: '刻喰らいの大鎌', type: 'scythe', dmg: 54, tier: 17 },
        { id: 'star_crusher',  name: '星砕きの大鎚',   type: 'hammer', dmg: 60, tier: 18 },
        { id: 'nova_roar',     name: '次元竜の咆哮砲', type: 'shotgun', dmg: 34, tier: 19 },
        { id: 'rift_twins',    name: '次元の双刃',     type: 'twinblade', dmg: 30, tier: 15 },
        { id: 'chrono_twins',  name: '時空の双刃',     type: 'twinblade', dmg: 44, tier: 19 },
        { id: 'moon_chakram',  name: '月輪',           type: 'chakram', dmg: 32, tier: 15 },
        { id: 'star_chakram',  name: '星環の円月輪',   type: 'chakram', dmg: 48, tier: 20 },
        { id: 'rift_cannon',   name: '次元砲',         type: 'cannon',  dmg: 40, tier: 16 },
        { id: 'nova_cannon',   name: '超新星砲',       type: 'cannon',  dmg: 62, tier: 21 },
        { id: 'rift_tome',     name: '次元の魔導書',   type: 'tome',    dmg: 34, tier: 16 },
        { id: 'akashic_tome',  name: 'アカシックレコード', type: 'tome', dmg: 52, tier: 20 },
        { id: 'rift_chain',    name: '次元鎖鎌',       type: 'kusarigama', dmg: 36, tier: 16 },
        { id: 'chrono_chain',  name: '刻の鎖鎌',       type: 'kusarigama', dmg: 50, tier: 20 },
        // ---- ゲートキーパーの専用ドロップ ----
        { id: 'gate_greatsword', name: '開門の大剣',   type: 'greatsword', dmg: 58, tier: 15 },
        { id: 'gate_scepter',    name: '天門の神杖',   type: 'scepter',    dmg: 68, tier: 23 },
        // ---- 第三世界 ----
        { id: 'sky_rapier',      name: '天空の細剣',   type: 'rapier',   dmg: 56, tier: 24 },
        { id: 'divine_rapier',   name: '神断ちの細剣', type: 'rapier',   dmg: 84, tier: 29 },
        { id: 'creation_scepter', name: '創世の神杖',  type: 'scepter',  dmg: 92, tier: 30 },
        { id: 'ether_gunblade',  name: 'エーテル銃剣', type: 'gunblade', dmg: 62, tier: 25 },
        { id: 'genesis_gunblade', name: '創世の銃剣',  type: 'gunblade', dmg: 98, tier: 30 },
        { id: 'angel_bit',       name: '天使の浮遊砲', type: 'bit',      dmg: 52, tier: 26 },
        { id: 'aeon_bit',        name: '永劫の浮遊砲', type: 'bit',      dmg: 78, tier: 29 },
        { id: 'god_edge',        name: '神剣',         type: 'sword',    dmg: 82, tier: 27 },
        { id: 'titan_bow',       name: '巨神の大弓',   type: 'bow',      dmg: 76, tier: 26 },
        { id: 'chaos_axe',       name: '混沌の戦斧',   type: 'axe',      dmg: 80, tier: 27 },
        { id: 'seraph_wand',     name: '熾天使の杖',   type: 'wand',     dmg: 72, tier: 28 },
        // ---- 第四世界「機神の都」 ----
        { id: 'gate_gearblade', name: '機構の歯車刃',   type: 'gearblade', dmg: 100, tier: 31 },
        { id: 'rail_mk1',       name: '試作電磁砲',     type: 'railgun',   dmg: 100, tier: 32 },
        { id: 'gear_saw',       name: '歯車の鋸刃',     type: 'gearblade', dmg: 100, tier: 32 },
        { id: 'clock_blade',    name: '時計仕掛けの剣', type: 'sword',     dmg: 100, tier: 33 },
        { id: 'steam_pistol',   name: '蒸気拳銃',       type: 'pistol',    dmg: 100, tier: 33 },
        { id: 'mech_halberd',   name: '機甲薙刀',       type: 'halberd',   dmg: 100, tier: 34 },
        { id: 'rail_mk2',       name: '重電磁砲',       type: 'railgun',   dmg: 100, tier: 35 },
        { id: 'gear_twin',      name: '連結歯車刃',     type: 'gearblade', dmg: 100, tier: 35 },
        { id: 'tesla_whip',     name: 'テスラの鞭',     type: 'whip',      dmg: 100, tier: 36 },
        { id: 'rail_zero',      name: '零式電磁砲',     type: 'railgun',   dmg: 100, tier: 38 },
        { id: 'gear_omega',     name: '機神の歯車刃',   type: 'gearblade', dmg: 100, tier: 38 },
        { id: 'mech_blade_god', name: '機神の大剣',     type: 'greatsword', dmg: 100, tier: 38 },
        // ---- 第五世界「虚空の彼方」 ----
        { id: 'gate_voidblade', name: '虚空門の特異点', type: 'singularity', dmg: 100, tier: 39 },
        { id: 'orb_sat',        name: '小型衛星砲',     type: 'orbital',   dmg: 100, tier: 40 },
        { id: 'sing_core',      name: '特異点コア',     type: 'singularity', dmg: 100, tier: 40 },
        { id: 'void_katana',    name: '虚空の刀',       type: 'katana',    dmg: 100, tier: 41 },
        { id: 'nova_greatsword', name: '新星の大剣',    type: 'greatsword', dmg: 100, tier: 42 },
        { id: 'orb_array',      name: '衛星砲陣',       type: 'orbital',   dmg: 100, tier: 43 },
        { id: 'sing_maw',       name: '重力の顎',       type: 'singularity', dmg: 100, tier: 43 },
        { id: 'eclipse_dagger', name: '蝕の短剣',       type: 'dagger',    dmg: 100, tier: 44 },
        { id: 'star_bow',       name: '星弓',           type: 'bow',       dmg: 100, tier: 45 },
        { id: 'orb_omega',      name: '終焉の衛星砲',   type: 'orbital',   dmg: 100, tier: 46 },
        { id: 'sing_omega',     name: '虚空の特異点',   type: 'singularity', dmg: 100, tier: 46 },
        { id: 'void_king_blade', name: '虚空王の剣',    type: 'sword',     dmg: 100, tier: 46 },
        // ---- 支援武器（回復・バフ・デバフ）----
        { id: 'healstaff_1', name: '癒しの小杖',   type: 'healstaff', dmg: 100, tier: 5 },
        { id: 'healstaff_2', name: '聖女の杖',     type: 'healstaff', dmg: 100, tier: 15 },
        { id: 'healstaff_3', name: '慈愛の杖',     type: 'healstaff', dmg: 100, tier: 26 },
        { id: 'healstaff_4', name: '生命樹の杖',   type: 'healstaff', dmg: 100, tier: 36 },
        { id: 'healstaff_5', name: '星の癒し杖',   type: 'healstaff', dmg: 100, tier: 44 },
        { id: 'banner_1',    name: '兵士の旗',     type: 'banner',    dmg: 100, tier: 6 },
        { id: 'banner_2',    name: '騎士団の軍旗', type: 'banner',    dmg: 100, tier: 16 },
        { id: 'banner_3',    name: '英雄の戦旗',   type: 'banner',    dmg: 100, tier: 27 },
        { id: 'banner_4',    name: '機神の軍旗',   type: 'banner',    dmg: 100, tier: 37 },
        { id: 'banner_5',    name: '覇王の大旗',   type: 'banner',    dmg: 100, tier: 45 },
        { id: 'hexstaff_1',  name: '呪いの枝',     type: 'hexstaff',  dmg: 100, tier: 8 },
        { id: 'hexstaff_2',  name: '呪詛の杖',     type: 'hexstaff',  dmg: 100, tier: 18 },
        { id: 'hexstaff_3',  name: '怨嗟の杖',     type: 'hexstaff',  dmg: 100, tier: 28 },
        { id: 'hexstaff_4',  name: '終末の呪杖',   type: 'hexstaff',  dmg: 100, tier: 38 },
        { id: 'hexstaff_5',  name: '虚無の呪杖',   type: 'hexstaff',  dmg: 100, tier: 46 },
        // ---- ギミックボスの固有ドロップ ----
        { id: 'steam_howitzer', name: '蒸気榴弾砲',     type: 'mortar',    dmg: 100, tier: 35 },   // 大圧力炉のボス
        { id: 'reaper_scythe',  name: '死神の大鎌',     type: 'scythe',    dmg: 100, tier: 36 },   // 死神グリム・リーパー
        { id: 'napoleon',       name: 'ナポレオン',     type: 'greatsword', dmg: 100, tier: 45 },  // ゼウス＆プロメテウス（固有ドロップ）
        { id: 'dimension_edge', name: '次元断ちの刃',   type: 'katana',    dmg: 100, tier: 46 },   // ディメンション・キーパー
        // ---- 追加の武器種のベース ----
        { id: 'rod_1', name: '樫の棍', type: 'rod', dmg: 100, tier: 3 },
        { id: 'rod_2', name: '鋼鉄の棍', type: 'rod', dmg: 100, tier: 7 },
        { id: 'rod_3', name: '竜骨の棍', type: 'rod', dmg: 100, tier: 11 },
        { id: 'sling_1', name: '革の投石器', type: 'sling', dmg: 100, tier: 3 },
        { id: 'sling_2', name: '鉛玉の投石器', type: 'sling', dmg: 100, tier: 7 },
        { id: 'sling_3', name: '魔石の投石器', type: 'sling', dmg: 100, tier: 11 },
        { id: 'claws_1', name: '獣の爪', type: 'claws', dmg: 100, tier: 4 },
        { id: 'claws_2', name: '鋼の鉤爪', type: 'claws', dmg: 100, tier: 8 },
        { id: 'claws_3', name: '竜爪', type: 'claws', dmg: 100, tier: 12 },
        { id: 'flail_1', name: '鉄球フレイル', type: 'flail', dmg: 100, tier: 17 },
        { id: 'flail_2', name: '星球フレイル', type: 'flail', dmg: 100, tier: 20 },
        { id: 'flail_3', name: '破城フレイル', type: 'flail', dmg: 100, tier: 23 },
        { id: 'fan_1', name: '紙の扇', type: 'fan', dmg: 100, tier: 17 },
        { id: 'fan_2', name: '鉄扇', type: 'fan', dmg: 100, tier: 20 },
        { id: 'fan_3', name: '風神の扇', type: 'fan', dmg: 100, tier: 23 },
        { id: 'boomerang_1', name: '木のブーメラン', type: 'boomerang', dmg: 100, tier: 17 },
        { id: 'boomerang_2', name: '刃のブーメラン', type: 'boomerang', dmg: 100, tier: 20 },
        { id: 'boomerang_3', name: '次元ブーメラン', type: 'boomerang', dmg: 100, tier: 23 },
        { id: 'trident_1', name: '漁師の三叉槍', type: 'trident', dmg: 100, tier: 24 },
        { id: 'trident_2', name: '海神の三叉槍', type: 'trident', dmg: 100, tier: 27 },
        { id: 'trident_3', name: '雷神の三叉槍', type: 'trident', dmg: 100, tier: 30 },
        { id: 'chime_1', name: '銅の鈴杖', type: 'chime', dmg: 100, tier: 24 },
        { id: 'chime_2', name: '銀の鈴杖', type: 'chime', dmg: 100, tier: 27 },
        { id: 'chime_3', name: '天界の鈴杖', type: 'chime', dmg: 100, tier: 30 },
        { id: 'lance_1', name: '騎士のランス', type: 'lance', dmg: 100, tier: 25 },
        { id: 'lance_2', name: '聖騎士のランス', type: 'lance', dmg: 100, tier: 28 },
        { id: 'lance_3', name: '神槍ランス', type: 'lance', dmg: 100, tier: 30 },
        { id: 'chainsaw_1', name: '工事用チェーンソー', type: 'chainsaw', dmg: 100, tier: 32 },
        { id: 'chainsaw_2', name: '高出力チェーンソー', type: 'chainsaw', dmg: 100, tier: 35 },
        { id: 'chainsaw_3', name: '機神の電鋸', type: 'chainsaw', dmg: 100, tier: 38 },
        { id: 'flamethrower_1', name: '火炎放射器', type: 'flamethrower', dmg: 100, tier: 32 },
        { id: 'flamethrower_2', name: '高圧火炎放射器', type: 'flamethrower', dmg: 100, tier: 35 },
        { id: 'flamethrower_3', name: '業火炉', type: 'flamethrower', dmg: 100, tier: 38 },
        { id: 'mortar_1', name: '迫撃砲', type: 'mortar', dmg: 100, tier: 33 },
        { id: 'mortar_2', name: '重迫撃砲', type: 'mortar', dmg: 100, tier: 36 },
        { id: 'mortar_3', name: '終末の臼砲', type: 'mortar', dmg: 100, tier: 38 },
        { id: 'prism_1', name: '光の稜鏡', type: 'prism', dmg: 100, tier: 40 },
        { id: 'prism_2', name: '七色の稜鏡', type: 'prism', dmg: 100, tier: 43 },
        { id: 'prism_3', name: '虚空の稜鏡', type: 'prism', dmg: 100, tier: 46 },
        { id: 'comet_1', name: '流星弓', type: 'comet', dmg: 100, tier: 40 },
        { id: 'comet_2', name: '彗星弓', type: 'comet', dmg: 100, tier: 43 },
        { id: 'comet_3', name: '超新星弓', type: 'comet', dmg: 100, tier: 46 },
        { id: 'voidblade_1', name: '虚の刃', type: 'voidblade', dmg: 100, tier: 41 },
        { id: 'voidblade_2', name: '虚空の大刃', type: 'voidblade', dmg: 100, tier: 44 },
        { id: 'voidblade_3', name: '無の刃', type: 'voidblade', dmg: 100, tier: 46 },
    ];
    const BASE_BY_ID = {};
    BASES.forEach(b => { BASE_BY_ID[b.id] = b; });

    // ---------- 特殊効果 ----------
    // kind:'stat' → 集計(agg)へ加算 / kind:'proc' → 発動条件つき効果（stage.js が処理）
    // range は ilvl=1・レア度ノーマル時の値の目安。実際は ilvl とレア度で伸びる。
    const pct = v => Math.round(v * 100) + '%';
    const EFFECTS = [
        // --- 攻撃系 stat ---
        { id: 'atk_up',     kind: 'stat', key: 'atkPct',    name: '剛力',        range: [0.06, 0.12], desc: v => `攻撃力 +${pct(v)}` },
        { id: 'crit_rate',  kind: 'stat', key: 'critRate',  name: '会心',        range: [0.04, 0.09], desc: v => `クリティカル率 +${pct(v)}` },
        { id: 'crit_dmg',   kind: 'stat', key: 'critDmg',   name: '致命',        range: [0.15, 0.30], desc: v => `クリティカルダメージ +${pct(v)}` },
        { id: 'aspd',       kind: 'stat', key: 'aspd',      name: '迅速',        range: [0.05, 0.11], desc: v => `攻撃速度 +${pct(v)}` },
        { id: 'range_up',   kind: 'stat', key: 'rangePct',  name: '長柄',        range: [0.06, 0.14], desc: v => `攻撃範囲 +${pct(v)}` },
        { id: 'pierce',     kind: 'stat', key: 'pierce',    name: '貫通',        range: [1, 1],       desc: v => `弾が敵を貫通 +${Math.round(v)}`, int: true },
        { id: 'proj_extra', kind: 'stat', key: 'projExtra', name: '分裂弾',      range: [1, 1],       desc: v => `弾が +${Math.round(v)} 本増える`, int: true },
        { id: 'knock_up',   kind: 'stat', key: 'knock',     name: '剛撃',        range: [0.15, 0.35], desc: v => `ノックバック +${pct(v)}` },
        { id: 'dmg_boss',   kind: 'stat', key: 'dmgBoss',   name: '巨人殺し',    range: [0.10, 0.22], desc: v => `ボスへのダメージ +${pct(v)}` },
        { id: 'dmg_low',    kind: 'stat', key: 'dmgLow',    name: '処刑人',      range: [0.15, 0.35], desc: v => `HP30%以下の敵へのダメージ +${pct(v)}` },
        { id: 'dmg_full',   kind: 'stat', key: 'dmgFull',   name: '先制',        range: [0.15, 0.35], desc: v => `HP満タンの敵へのダメージ +${pct(v)}` },
        { id: 'dmg_swarm',  kind: 'stat', key: 'dmgMob',    name: '雑魚狩り',    range: [0.10, 0.22], desc: v => `ボス以外の敵へのダメージ +${pct(v)}` },
        { id: 'aoe_up',     kind: 'stat', key: 'aoePct',    name: '爆風',        range: [0.10, 0.25], desc: v => `爆発・範囲効果 +${pct(v)}` },
        { id: 'lowhp_atk',  kind: 'stat', key: 'rageAtk',   name: '背水',        range: [0.15, 0.35], desc: v => `HP50%以下で攻撃力 +${pct(v)}` },
        // --- 防御・生存系 stat ---
        { id: 'hp_up',      kind: 'stat', key: 'hpPct',     name: '生命',        range: [0.06, 0.14], desc: v => `最大HP +${pct(v)}` },
        { id: 'def_up',     kind: 'stat', key: 'defPct',    name: '堅守',        range: [0.06, 0.14], desc: v => `防御力 +${pct(v)}` },
        { id: 'dr',         kind: 'stat', key: 'dr',        name: '鉄壁',        range: [0.04, 0.09], desc: v => `被ダメージ -${pct(v)}` },
        { id: 'regen',      kind: 'stat', key: 'regen',     name: '再生',        range: [0.004, 0.009], desc: v => `毎秒 最大HPの${(v * 100).toFixed(1)}%回復` },
        { id: 'lifesteal',  kind: 'stat', key: 'lifesteal', name: '吸血',        range: [0.02, 0.05], desc: v => `与ダメージの${pct(v)}をHP回復` },
        { id: 'thorns',     kind: 'stat', key: 'thorns',    name: '棘',          range: [0.15, 0.35], desc: v => `被弾時に攻撃力の${pct(v)}を反射` },
        { id: 'dodge',      kind: 'stat', key: 'dodge',     name: '見切り',      range: [0.03, 0.07], desc: v => `回避率 +${pct(v)}` },
        { id: 'iframe',     kind: 'stat', key: 'iframe',    name: '残心',        range: [0.10, 0.25], desc: v => `被弾後の無敵時間 +${v.toFixed(2)}秒` },
        // --- 移動・ユーティリティ stat ---
        { id: 'move_up',    kind: 'stat', key: 'moveSpd',   name: '韋駄天',      range: [0.05, 0.12], desc: v => `移動速度 +${pct(v)}` },
        { id: 'dash_cdr',   kind: 'stat', key: 'dashCdr',   name: '縮地',        range: [0.08, 0.18], desc: v => `ダッシュ待機時間 -${pct(v)}` },
        { id: 'energy_up',  kind: 'stat', key: 'energyUp',  name: '博識',        range: [0.10, 0.25], desc: v => `クイズ正解で得るエネルギー +${pct(v)}` },
        { id: 'gold_up',    kind: 'stat', key: 'goldPct',   name: '黄金',        range: [0.10, 0.25], desc: v => `コイン獲得 +${pct(v)}` },
        { id: 'exp_up',     kind: 'stat', key: 'expPct',    name: '叡智',        range: [0.08, 0.20], desc: v => `経験値 +${pct(v)}` },
        { id: 'drop_up',    kind: 'stat', key: 'dropPct',   name: '強運',        range: [0.08, 0.20], desc: v => `装備ドロップ率 +${pct(v)}` },
        { id: 'rare_up',    kind: 'stat', key: 'rarePct',   name: '審美眼',      range: [0.06, 0.15], desc: v => `高レア度が出やすくなる +${pct(v)}` },
        { id: 'orb_up',     kind: 'stat', key: 'orbPct',    name: '宝珠の導き',  range: [0.05, 0.14], desc: v => `オーブのドロップ率 +${pct(v)}` },
        // --- 発動(proc)系 ---
        { id: 'burn',       kind: 'proc', on: 'hit',   key: 'burn',    name: '業火',     range: [0.12, 0.24], desc: v => `命中時${pct(v)}で敵を燃やす（継続ダメージ）` },
        { id: 'poison',     kind: 'proc', on: 'hit',   key: 'poison',  name: '猛毒',     range: [0.12, 0.24], desc: v => `命中時${pct(v)}で敵を毒にする` },
        { id: 'freeze',     kind: 'proc', on: 'hit',   key: 'freeze',  name: '氷結',     range: [0.10, 0.20], desc: v => `命中時${pct(v)}で敵を凍結（移動・攻撃が鈍る）` },
        { id: 'shock',      kind: 'proc', on: 'hit',   key: 'shock',   name: '連鎖雷',   range: [0.10, 0.20], desc: v => `命中時${pct(v)}で近くの敵へ雷が連鎖` },
        { id: 'bleed',      kind: 'proc', on: 'hit',   key: 'bleed',   name: '裂傷',     range: [0.12, 0.24], desc: v => `命中時${pct(v)}で出血（動くほどダメージ）` },
        { id: 'stun',       kind: 'proc', on: 'hit',   key: 'stun',    name: '昏倒',     range: [0.05, 0.12], desc: v => `命中時${pct(v)}で敵を気絶させる` },
        { id: 'doublehit',  kind: 'proc', on: 'hit',   key: 'double',  name: '二重撃',   range: [0.06, 0.14], desc: v => `攻撃が${pct(v)}で2回命中する` },
        { id: 'curse',      kind: 'proc', on: 'hit',   key: 'curse',   name: '呪縛',     range: [0.08, 0.18], desc: v => `命中時${pct(v)}で敵が受けるダメージ+20%（6秒）` },
        { id: 'meteor',     kind: 'proc', on: 'hit',   key: 'meteor',  name: '流星',     range: [0.04, 0.09], desc: v => `命中時${pct(v)}で頭上から隕石が降る` },
        { id: 'critnova',   kind: 'proc', on: 'crit',  key: 'critnova', name: '会心爆発', range: [0.20, 0.45], desc: v => `クリティカル時${pct(v)}で周囲に爆発` },
        { id: 'kill_heal',  kind: 'proc', on: 'kill',  key: 'killHeal', name: '凱歌',     range: [0.02, 0.05], desc: v => `敵撃破時 最大HPの${pct(v)}回復` },
        { id: 'kill_boom',  kind: 'proc', on: 'kill',  key: 'killBoom', name: '連鎖爆散', range: [0.20, 0.40], desc: v => `敵撃破時${pct(v)}で爆発する` },
        { id: 'kill_haste', kind: 'proc', on: 'kill',  key: 'killHaste', name: '血の昂り', range: [0.15, 0.30], desc: v => `敵撃破時${pct(v)}で移動・攻撃が3秒加速` },
        { id: 'kill_energy',kind: 'proc', on: 'kill',  key: 'killEnergy', name: '知の収穫', range: [0.15, 0.30], desc: v => `敵撃破時${pct(v)}でエネルギー+8` },
        { id: 'hurt_shield',kind: 'proc', on: 'hurt',  key: 'hurtShield', name: '護りの光', range: [0.15, 0.30], desc: v => `被弾時${pct(v)}でバリア（次の被ダメージ無効）` },
        { id: 'hurt_nova',  kind: 'proc', on: 'hurt',  key: 'hurtNova', name: '報復波',   range: [0.20, 0.40], desc: v => `被弾時${pct(v)}で周囲を吹き飛ばす` },
        { id: 'dash_blast', kind: 'proc', on: 'dash',  key: 'dashBlast', name: '衝撃脚',  range: [0.50, 1.00], desc: v => `ダッシュ終点で衝撃波（攻撃力の${pct(v)}）` }
    ];
    const EFFECT_BY_ID = {};
    EFFECTS.forEach(e => { EFFECT_BY_ID[e.id] = e; });

    // ---------- 乱数ユーティリティ ----------
    const rnd = (a, b) => a + Math.random() * (b - a);
    const rint = (a, b) => Math.floor(rnd(a, b + 1));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const uid = () => 'hw_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

    function pickRarity(luckBonus, minRarity, ilvl) {
        const minIdx = Math.max(0, RARITY_ORDER.indexOf(minRarity || 'normal'));
        const lb = 1 + (luckBonus || 0);
        let total = 0;
        const ws = RARITY_ORDER.map((k, i) => {
            if (i < minIdx) return 0;
            if (k === 'legendary' && (ilvl || 1) < LEGENDARY_MIN_ILVL) return 0;   // 序盤のステージではレジェンドは出ない
            // luckBonus はレア側の重みだけを伸ばす
            const w = RARITIES[k].weight * (i >= 2 ? (k === 'legendary' ? Math.sqrt(lb) : lb) : 1);   // レジェンドは運の補正も半分だけ
            total += w; return w;
        });
        let r = Math.random() * total;
        for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return RARITY_ORDER[i]; }
        return RARITY_ORDER[minIdx];
    }

    // 武器ベースの階級(tier)から、％の基礎値（3〜25％）を決める。レア度の倍率をかけると最大50％になる
    const MAX_TIER = BASES.reduce((m, b) => Math.max(m, b.tier || 1), 1);
    function basePct(base) {
        const t = Math.max(0, Math.min(1, ((base.tier || 1) - 1) / Math.max(1, MAX_TIER - 1)));
        return 0.03 + 0.22 * t;
    }
    function pctFor(base, rarityKey) {
        return Math.min(PCT_CAP, basePct(base) * RARITIES[rarityKey].pctMul);
    }

    // ---------- 武器生成 ----------
    // opts: { ilvl, baseIds:[...], luck, minRarity, forceRarity }
    function roll(opts) {
        opts = opts || {};
        const ilvl = Math.max(1, opts.ilvl || 1);
        const pool = (opts.baseIds && opts.baseIds.length ? opts.baseIds.map(id => BASE_BY_ID[id]).filter(Boolean) : BASES);
        const base = pick(pool);
        const rarityKey = opts.forceRarity || pickRarity(opts.luck, opts.minRarity, ilvl);
        const rar = RARITIES[rarityKey];
        const pct = Math.round(Math.min(PCT_CAP, pctFor(base, rarityKey) * rnd(0.95, 1.05)) * 10000) / 10000;
        const dmg = dmgFromPct(pct);
        const sockets = rint(rar.sockets[0], rar.sockets[1]);
        const nFx = rint(rar.fx[0], rar.fx[1]);

        const fxPool = EFFECTS.slice();
        const effects = [];
        for (let i = 0; i < nFx && fxPool.length; i++) {
            const e = fxPool.splice(Math.floor(Math.random() * fxPool.length), 1)[0];
            effects.push(rollEffect(e, ilvl, rarityKey));
        }
        const w = {
            id: uid(),
            baseId: base.id,
            type: base.type,
            rarity: rarityKey,
            prefix: pick(rar.prefixes),
            baseName: base.name,
            ilvl: ilvl,
            pct: pct,
            dmg: dmg,
            effects: effects,
            sockets: sockets,
            orbs: new Array(sockets).fill(null),
            source: opts.source || null,
            createdAt: Date.now()
        };
        if (window.SBElem) { const el = SBElem.rollElems(); if (el.length) w.elems = el; }   // 属性（半分は無属性。まれに2属性）
        w.name = displayName(w);
        return w;
    }

    function rollEffect(e, ilvl, rarityKey) {
        const idx = RARITY_ORDER.indexOf(rarityKey);
        const scale = (1 + idx * 0.22) * (1 + Math.min(ilvl, 20) * 0.025);
        let v = rnd(e.range[0], e.range[1]) * scale;
        if (e.int) v = Math.max(1, Math.round(rnd(e.range[0], e.range[1]) * (idx >= 3 ? 2 : 1)));
        else v = Math.round(v * 1000) / 1000;
        if (e.kind === 'proc' || e.key === 'critRate' || e.key === 'dodge') v = Math.min(v, e.kind === 'proc' ? 0.85 : 0.5);
        return { id: e.id, v: v };
    }

    function displayName(w) {
        return w.prefix + '＋' + w.baseName;
    }

    function describeEffect(fx) {
        const e = EFFECT_BY_ID[fx.id];
        return e ? e.desc(fx.v) : fx.id;
    }

    // ---------- オーブ → 武器効果への変換 ----------
    // オーブは既存システム（weapons.js）の {tier, statType, bonus, affixes, uniqueAbility}
    const ORB_STAT_MAP = {
        atk:    { key: 'atkPct',  label: '攻撃力' },
        def:    { key: 'defPct',  label: '防御力' },
        speed:  { key: 'moveSpd', label: '移動速度' },
        maxHp:  { key: 'hpPct',   label: '最大HP' },
        special:{ key: 'aoePct',  label: '範囲効果' }
    };
    // ユニーク能力（Tier4）→ アクション戦闘での効果。説明文どおりの挙動になるよう、1つずつ実装してある
    //  stat : 数値ステータスとして加算 / proc : 命中時の発動効果 / flag : stage.js が直接見て特別な処理をする能力
    //  （flag の中身は stage.js の AB('...') を探すと見つかる）
    const ORB_ABILITY_MAP = {
        life_drain:      { stat: 'lifesteal', v: 0.20 },                 // 与えたダメージの20%を回復（1回の命中で最大HPの6%まで）
        overwhelming_growth: { flag: true },                              // 勉強タイマーのステータス上昇が2倍（stats.js）
        re_miserable:    { flag: true },                                  // 敵の全ステータス0.8倍（与ダメ×1.25・被ダメ×0.8）
        penetration:     { stat: 'pierce', v: 1, flag: true },            // 防御を半分無視（ボス・精鋭に+15%）＋弾が貫通
        iron_wall:       { stat: 'dr', v: 0.50 },                         // 受けるダメージ50%カット
        sure_hit:        { stat: 'rangePct', v: 0.15 },                   // 必中：攻撃の範囲・当たり判定が広がる
        critical_hit:    { stat: 'critRate', v: 0.25 },                   // クリティカル率が30%に（通常5%）
        guts:            { flag: true },                                  // 根性：致死ダメージをHP1で耐える(45秒に1回)・HP1で攻撃力3倍
        dual_weapon:     { flag: true },                                  // 3回に1回、もう一つの武器で追撃（攻撃力70%）
        berserker_state: { stat: 'rageAtk', v: 0.30 },                    // 大器晩成：HP50%以下で攻撃力1.3倍
        focus_strike:    { stat: 'critDmg', v: 0.70 },                    // クリティカル倍率 2.2倍（通常1.5倍）
        swift_wind:      { stat: 'moveSpd', v: 0.25 },                    // 疾風：素早さ1.25倍
        thorn_armor:     { flag: true },                                  // 受けたダメージの15%を近くの敵へ反射
        venomous_strike: { proc: 'poison', v: 1.0 },                      // 命中時、必ず毒
        blazing_strike:  { proc: 'burn',   v: 1.0 },                      // 命中時、必ず火傷
        afterimage:      { stat: 'dodge', v: 0.15 },                      // 回避率+15%
        awakening:       { stat: 'skillPct', v: 0.33 },                   // 覚醒：スキル（必殺技）のダメージ1.5→2.0倍
        first_strike:    { flag: true },                                  // 会心の初撃：戦闘の最初の攻撃は必ずクリティカル
        natural_healing: { stat: 'regen', v: 0.01 },                      // 自然治癒：毎秒、最大HPの1%（3秒で約3%）
        iron_will:       { flag: true },                                  // 不動の心：スタンなどの状態異常を50%無効化
        // ティア5
        god_slayer:      { stat: 'dmgBoss',   v: 0.40 },
        absolute_barrier:{ proc: 'hurtShield', v: 0.45 },
        overlord_presence:{ stat: 'dmgMob',   v: 0.35 },
        phoenix_blessing:{ proc: 'killHeal',  v: 0.08 },
        apex_wisdom:     { stat: 'energyUp',  v: 0.50 }
    };

    function orbToEffects(orb) {
        const out = { stats: {}, procs: [], lines: [], flags: {} };
        if (!orb) return out;
        const add = (key, v) => { out.stats[key] = (out.stats[key] || 0) + v; };
        const m = ORB_STAT_MAP[orb.statType];
        if (m) { add(m.key, orb.bonus); out.lines.push(`${m.label} +${Math.round(orb.bonus * 100)}%`); }
        (orb.affixes || []).forEach(a => {
            const am = a && ORB_STAT_MAP[a.statType];
            if (am) { add(am.key, a.bonus); out.lines.push(`${am.label} +${Math.round(a.bonus * 100)}%`); }
        });
        const ua = orb.uniqueAbility;
        if (ua) {
            const am = ORB_ABILITY_MAP[ua.key];
            if (am) {
                if (am.stat) add(am.stat, am.v);
                if (am.proc) out.procs.push({ key: am.proc, v: am.v });
                if (am.flag) out.flags[ua.key] = true;
            } else add('atkPct', orb.tier === 'tier5' ? 0.2 : 0.1);   // 想定外の能力（将来の追加分）は汎用ボーナス
            out.lines.push('★ ' + (ua.name || ua.key));
        }
        return out;
    }

    // ---------- 集計（戦闘用ステータス）----------
    // 武器本体のdmg・武器種・特殊効果・ソケットのオーブを全部まとめる
    function aggregate(w) {
        const agg = { stats: {}, procs: [], flags: {} };
        if (!w) return agg;
        const addStat = (k, v) => { agg.stats[k] = (agg.stats[k] || 0) + v; };
        if (w.elems && w.elems.length && window.SBElem) { const ss = SBElem.styleStats(w.elems); Object.keys(ss).forEach(k => addStat(k, ss[k])); agg.elems = w.elems.slice(); }   // 属性ごとのバトルスタイル
        (w.effects || []).forEach(fx => {
            const e = EFFECT_BY_ID[fx.id];
            if (!e) return;
            if (e.kind === 'stat') addStat(e.key, fx.v);
            else agg.procs.push({ key: e.key, on: e.on, v: fx.v });
        });
        (w.orbs || []).forEach(orb => {
            if (!orb) return;
            const oe = orbToEffects(orb);
            Object.keys(oe.flags).forEach(k => { agg.flags[k] = true; });
            Object.keys(oe.stats).forEach(k => addStat(k, oe.stats[k]));
            oe.procs.forEach(p => {
                const e = EFFECTS.find(x => x.key === p.key);
                agg.procs.push({ key: p.key, on: e ? e.on : 'hit', v: p.v });
            });
        });
        return agg;
    }

    function rarityOf(w) { return RARITIES[(w && w.rarity) || 'normal'] || RARITIES.normal; }

    // ---------- 保存 / 読み込み（localStorage "sbHack"）----------
    const KEY = 'sbHack';
    function load() {
        let d = null;
        try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
        if (!d || typeof d !== 'object') d = {};
        // 別のキャラクター（キャラ削除→再作成など）に前のキャラの武器が残らないよう、持ち主IDを確認する
        const pid = currentPlayerId();
        if (d.owner && pid && String(d.owner) !== pid) d = {};
        if (pid && !d.owner) { d.owner = pid; }
        if (!Array.isArray(d.weapons)) d.weapons = [];
        if (!('equipped' in d)) d.equipped = null;
        if (!d.cleared) d.cleared = {};
        migratePct(d);
        // 門の条件が「ナイトメア攻略」から「クリア（どの難易度でも）」に変わった。すでに最終ステージをクリア済みの人は、門を自動で出す
        try {
            const WS = (window.STAGE_DATA && window.STAGE_DATA.WORLDS) || [];
            WS.forEach(w => { const u = w.unlock; if (u && u.stageId && u.gateFlag && d.cleared && d.cleared[u.stageId] && !d[u.gateFlag] && !d[u.flag]) d[u.gateFlag] = true; });
        } catch (e) { /* stage-data が無いページでは何もしない */ }
        if (!d.starter) {
            let w;
            if (isSeasonChar()) {
                // シーズンキャラはレベル1・素手スタート（武器はステージで集める）
                w = { id: uid(), baseId: 'bare_hands', type: 'fist', rarity: 'normal', prefix: '', baseName: '素手', name: '素手', ilvl: 1,
                    pct: 0, dmg: dmgFromPct(0), effects: [], sockets: 0, orbs: [], source: 'starter', createdAt: Date.now() };
            } else {
                // 初回だけ町の人から「ふつうの＋鉄の剣」を貰う
                w = roll({ ilvl: 1, baseIds: ['iron_sword'], forceRarity: 'normal', source: 'starter' });
                w.prefix = 'ふつうの'; w.name = displayName(w); w.effects = []; w.sockets = 1; w.orbs = [null];
            }
            d.weapons.push(w); d.equipped = w.id; d.starter = true;
            save(d);
        }
        return d;
    }
    // 旧データ（攻撃力が固定値だった頃の武器）を「％」方式へ変換する。1度だけ実行される
    function migratePct(d) {
        let changed = false;
        d.weapons.forEach(w => {
            if (typeof w.pct === 'number') return;
            const base = BASE_BY_ID[w.baseId];
            const rk = RARITIES[w.rarity] ? w.rarity : 'normal';
            let pct = base ? pctFor(base, rk) : Math.min(PCT_CAP, 0.03 * RARITIES[rk].pctMul);
            w.pct = Math.round(pct * 10000) / 10000;
            w.dmg = dmgFromPct(w.pct);
            changed = true;
        });
        // 上限30％→50％の引き上げに合わせて、すでに持っている武器の％も5/3倍に底上げする（1回だけ）
        if (!d.pctScaleV2) {
            d.weapons.forEach(w => {
                if (typeof w.pct !== 'number') return;
                w.pct = Math.round(Math.min(PCT_CAP, w.pct * (5 / 3)) * 10000) / 10000;
                w.dmg = dmgFromPct(w.pct);
            });
            d.pctScaleV2 = true; changed = true;
        }
        if (changed) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
    }
    // いま操作しているのがシーズンキャラか（season.js の保存データを直接見る。読み込み順に依存しない）
    function isSeasonChar() { try { const s = JSON.parse(localStorage.getItem('sbSeason') || 'null'); return !!(s && s.active === 'season'); } catch (e) { return false; } }
    // 装備中の武器に「圧倒的成長性」のオーブがはまっていると、勉強タイマーのステータス上昇が2倍になる（stats.js から呼ばれる）
    function studyGrowthMult() {
        try {
            const d = load(), w = d.weapons.find(x => x.id === d.equipped);
            return (w && (w.orbs || []).some(o => o && o.uniqueAbility && o.uniqueAbility.key === 'overwhelming_growth')) ? 2 : 1;
        } catch (e) { return 1; }
    }
    function pctLabel(w) { return '＋' + Math.round((w && w.pct || 0) * 1000) / 10 + '%'; }
    function save(d) {
        try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { console.warn('[HW] save failed', e); }
        try { syncLegacy(d); } catch (e) { console.warn('[HW] legacy sync failed', e); }
    }
    function currentPlayerId() { const p = playerRead(); return p && p.id != null ? String(p.id) : null; }

    // ---------- 旧バトル（オンライン対戦・ボス戦など）との橋渡し ----------
    // 武器庫で装備した武器を、旧システムの「装備中の武器」にも反映する。
    // これで旧インベントリと武器庫の装備が食い違わず、旧バトルでも同じ武器・同じオーブが使われる。
    const LEGACY_TYPE = { sword: 'sword_shield', greatsword: 'greatsword', dagger: 'dual_swords', katana: 'katana', spear: 'spear', halberd: 'spear',
        scythe: 'scythe', axe: 'greatsword', hammer: 'greatsword', whip: 'spear', fist: 'gloves', boots: 'shoes', pistol: 'pistol', bow: 'bow',
        crossbow: 'bow', wand: 'magic_wand', shotgun: 'pistol', esper: 'esper',
        twinblade: 'dual_swords', chakram: 'bow', cannon: 'pistol', tome: 'magic_wand', kusarigama: 'scythe',
        rapier: 'spear', scepter: 'esper', gunblade: 'sword_shield', bit: 'magic_wand',
        railgun: 'bow', gearblade: 'dual_swords', orbital: 'magic_wand', singularity: 'esper',
        rod: 'spear', sling: 'bow', claws: 'dual_swords', flail: 'hammer', fan: 'dual_swords', boomerang: 'bow', trident: 'spear', chime: 'esper', lance: 'spear',
        chainsaw: 'dual_swords', flamethrower: 'magic_wand', mortar: 'magic_wand', prism: 'esper', comet: 'bow', voidblade: 'sword_shield' };
    function toLegacy(w) {
        let lw = { id: 'hw_' + w.id, name: w.name, type: LEGACY_TYPE[w.type] || 'sword_shield', isOriginal: true, isHW: true,
            multiplier: (typeof ORIGINAL_WEAPON_BASE_MULTIPLIER === 'number') ? ORIGINAL_WEAPON_BASE_MULTIPLIER : 1,
            statBonuses: {}, materialBonuses: {}, bonusMaterials: [], upgradeCount: 0, ultimateName: null };
        const orbs = (w.orbs || []).filter(Boolean);
        if (orbs.length && typeof applyOrbToWeapon === 'function') lw = applyOrbToWeapon(lw, orbs);
        // レア度とレベルによる底上げ
        lw.multiplier = lw.multiplier * (1 + RARITY_ORDER.indexOf(w.rarity) * 0.04 + Math.min(w.ilvl || 1, 15) * 0.01);
        return lw;
    }
    function syncLegacy(d, force) {
        if (typeof WEAPON_TYPES === 'undefined') return false;     // 旧システム(weapons.js)が読み込まれていないページ
        const w = getEquipped(d); const p = playerRead();
        if (!w || !p) return false;
        const sig = w.id + ':' + (w.orbs || []).map(o => o ? o.id : '-').join(',');
        if (!force && d.legacySig === sig && p.equippedWeapon && p.equippedWeapon.id === 'hw_' + w.id) return false;
        p.equippedWeapon = toLegacy(w);
        playerWrite(p);
        d.legacySig = sig;
        try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
        return true;
    }
    function getEquipped(d) { d = d || load(); return d.weapons.find(w => w.id === d.equipped) || d.weapons[0] || null; }

    // 倉庫の上限（超えたら自動で一番弱いものを売却するのではなく、警告のみ）
    const STORAGE_LIMIT = 120;

    function sellValue(w) {
        if (w.forgeCost) return Math.max(1, Math.round(w.forgeCost * 0.2));    // オリジナル武器は作成コストの2割
        const idx = RARITY_ORDER.indexOf(w.rarity);
        return Math.max(1, Math.round((3 + w.ilvl * 1.5) * (1 + idx * 1.4)));
    }

    // 一括売却：レア度で対象を選ぶ。装備中・ロック中は売らない。オリジナル武器・オーブをはめた武器は、明示的に許可したときだけ対象にする
    //  opts: { rarities:['normal','magic',...], includeSocketed:false, includeCustom:false }
    function bulkTargets(d, opts) {
        opts = opts || {};
        const set = {}; (opts.rarities || []).forEach(r => { set[r] = true; });
        return d.weapons.filter(w => w.id !== d.equipped && !w.locked && set[w.rarity] &&
            (opts.includeCustom || !w.custom) && (opts.includeSocketed || !(w.orbs || []).some(Boolean)));
    }
    function bulkSell(d, opts) {
        const targets = bulkTargets(d, opts);
        let coins = 0;
        targets.forEach(w => { coins += sellWeapon(d, w.id); });
        return { count: targets.length, coins: coins };
    }

    // ---------- オリジナル武器（コイン鍛冶）----------
    //  ・コインを多く使うほどレア度が上がる。レジェンドはコイン100000が必要。名前は自分で決められる。
    //  ・％は作るレア度で決まる（レジェンドで42％。ボスのレジェンド最大50％の少し下）。特殊効果とソケットはランダム。
    const FORGE_NAME_MAX = 14;
    function forgeCost(rarityKey) { return (RARITIES[rarityKey] || RARITIES.normal).forge; }
    function forgeRarityForCoins(coins) {
        let best = null;
        RARITY_ORDER.forEach(k => { if (coins >= RARITIES[k].forge) best = k; });
        return best;    // 100コイン未満なら null（作れない）
    }
    function cleanName(raw) { return String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, FORGE_NAME_MAX); }
    // 解放済みの世界の武器種だけを選べる（第二世界・第三世界の武器種は、その世界を解放してから）
    function availableTypes(d) {
        d = d || load();
        const maxWorld = d.world5 ? 5 : (d.world4 ? 4 : (d.world3 ? 3 : (d.world2 ? 2 : 1)));
        return Object.keys(TYPES).filter(k => (TYPES[k].world || 1) <= maxWorld);
    }
    function forgeIlvl(d) {
        let best = 1;
        const L = (window.STAGE_DATA && window.STAGE_DATA.STAGES) || [];
        L.forEach(st => { if (d.cleared && d.cleared[st.id] && !st.standardOnly) best = Math.max(best, st.ilvl); });
        return best;
    }
    // 作成。コインの引き落としは呼び出し側（UI）でやる。戻り値：武器 / null
    function forgeOriginal(d, o) {
        const rk = o && RARITIES[o.rarity] ? o.rarity : null;
        if (!rk || availableTypes(d).indexOf(o.type) < 0) return null;
        const type = o.type, ilvl = forgeIlvl(d), rar = RARITIES[rk];
        const name = cleanName(o.name) || ('オリジナル' + TYPES[type].label);
        const pct = Math.round(Math.min(PCT_CAP, rar.orig * rnd(0.94, 1.06)) * 10000) / 10000;
        const sockets = rint(rar.sockets[0], rar.sockets[1]);
        const nFx = rint(rar.fx[0], rar.fx[1]);
        const fxPool = EFFECTS.slice(), effects = [];
        for (let i = 0; i < nFx && fxPool.length; i++) effects.push(rollEffect(fxPool.splice(Math.floor(Math.random() * fxPool.length), 1)[0], ilvl, rk));
        return { id: uid(), baseId: 'orig_' + type, type: type, rarity: rk, prefix: '', baseName: name, name: name, ilvl: ilvl,
            pct: pct, dmg: dmgFromPct(pct), effects: effects, sockets: sockets, orbs: new Array(sockets).fill(null),
            source: 'forge', custom: true, forgeCost: rar.forge, createdAt: Date.now() };
    }

    // 売却 / ソケット操作
    function sellWeapon(d, id) {
        const i = d.weapons.findIndex(w => w.id === id);
        if (i < 0 || d.weapons[i].id === d.equipped) return 0;
        const w = d.weapons[i];
        const v = sellValue(w);
        // はめ込んであったオーブはプレイヤーのオーブ倉庫へ戻す
        returnOrbs(w);
        d.weapons.splice(i, 1);
        return v;
    }
    function playerRead() { try { return typeof getPlayerData === 'function' ? getPlayerData() : JSON.parse(localStorage.getItem('player') || 'null'); } catch (e) { return null; } }
    function playerWrite(p) { try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {} }
    function returnOrbs(w) {
        const p = playerRead();
        if (!p) return;
        if (!Array.isArray(p.orbs)) p.orbs = [];
        (w.orbs || []).forEach((o, i) => { if (o) { p.orbs.push(o); w.orbs[i] = null; } });
        playerWrite(p);
    }
    // 所持オーブをソケットへはめる（PoE風：はめ込み済みは取り外すと戻る）
    function socketOrb(w, slot, orbId) {
        const p = playerRead();
        if (!p || !Array.isArray(p.orbs)) return false;
        if (slot < 0 || slot >= w.sockets) return false;
        const oi = p.orbs.findIndex(o => o && o.id === orbId);
        if (oi < 0) return false;
        const orb = p.orbs.splice(oi, 1)[0];
        if (w.orbs[slot]) p.orbs.push(w.orbs[slot]);
        w.orbs[slot] = orb;
        playerWrite(p);
        return true;
    }
    function unsocketOrb(w, slot) {
        const p = playerRead();
        if (!p || !w.orbs[slot]) return false;
        if (!Array.isArray(p.orbs)) p.orbs = [];
        p.orbs.push(w.orbs[slot]);
        w.orbs[slot] = null;
        playerWrite(p);
        return true;
    }

    window.HW = {
        RARITIES, RARITY_ORDER, TYPES, BASES, BASE_BY_ID, EFFECTS, EFFECT_BY_ID,
        roll, pickRarity, displayName, describeEffect, orbToEffects, aggregate, rarityOf,
        load, save, syncLegacy, getEquipped, sellValue, sellWeapon, socketOrb, unsocketOrb, returnOrbs,
        STORAGE_LIMIT, typesOfWorld,
        HIT_BASE, PCT_CAP, pctLabel, studyGrowthMult, bulkTargets, bulkSell,
        FORGE_NAME_MAX, forgeCost, forgeRarityForCoins, cleanName, availableTypes, forgeOriginal
    };
})();
