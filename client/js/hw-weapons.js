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
        normal:    { label: 'ノーマル',   color: '#c9c9c9', mult: 1.00, sockets: [0, 1], fx: [0, 1], weight: 52,
                     prefixes: ['弱小な', 'ボロい', 'ふつうの', '錆びた', '古びた', '粗末な'] },
        magic:     { label: 'マジック',   color: '#6fa8ff', mult: 1.18, sockets: [1, 2], fx: [1, 2], weight: 28,
                     prefixes: ['するどい', '頑丈な', '素早い', '軽やかな', '澄んだ', '堅牢な'] },
        rare:      { label: 'レア',       color: '#ffd84a', mult: 1.42, sockets: [2, 3], fx: [2, 3], weight: 13,
                     prefixes: ['猛き', '疾き', '烈火の', '氷雪の', '雷鳴の', '血濡れの', '凶悪な'] },
        epic:      { label: 'エピック',   color: '#c077ff', mult: 1.75, sockets: [3, 4], fx: [3, 4], weight: 5.5,
                     prefixes: ['英雄の', '竜殺しの', '破砕の', '深淵の', '星屑の', '覇者の'] },
        legendary: { label: 'レジェンド', color: '#ff8a2a', mult: 2.20, sockets: [4, 6], fx: [4, 5], weight: 1.5,
                     prefixes: ['神々の', '終焉の', '星砕きの', '世界喰らいの', '永劫の', '天啓の'] }
    };
    const RARITY_ORDER = ['normal', 'magic', 'rare', 'epic', 'legendary'];

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
        esper:      { label: '念動',       kind: 'ring',  radius: 100, cd: 0.65, mult: 0.95, knock: 110 }
    };

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
        { id: 'psy_crown',     name: '超能の冠',       type: 'esper',  dmg: 28, tier: 9 }
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

    function pickRarity(luckBonus, minRarity) {
        const minIdx = Math.max(0, RARITY_ORDER.indexOf(minRarity || 'normal'));
        const lb = 1 + (luckBonus || 0);
        let total = 0;
        const ws = RARITY_ORDER.map((k, i) => {
            if (i < minIdx) return 0;
            // luckBonus はレア側の重みだけを伸ばす
            const w = RARITIES[k].weight * (i >= 2 ? lb : 1);
            total += w; return w;
        });
        let r = Math.random() * total;
        for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return RARITY_ORDER[i]; }
        return RARITY_ORDER[minIdx];
    }

    // ---------- 武器生成 ----------
    // opts: { ilvl, baseIds:[...], luck, minRarity, forceRarity }
    function roll(opts) {
        opts = opts || {};
        const ilvl = Math.max(1, opts.ilvl || 1);
        const pool = (opts.baseIds && opts.baseIds.length ? opts.baseIds.map(id => BASE_BY_ID[id]).filter(Boolean) : BASES);
        const base = pick(pool);
        const rarityKey = opts.forceRarity || pickRarity(opts.luck, opts.minRarity);
        const rar = RARITIES[rarityKey];
        const dmg = Math.round(base.dmg * (1 + ilvl * 0.07) * rar.mult * rnd(0.92, 1.08) * 10) / 10;
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
            dmg: dmg,
            effects: effects,
            sockets: sockets,
            orbs: new Array(sockets).fill(null),
            source: opts.source || null,
            createdAt: Date.now()
        };
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
    // ユニーク能力 → HWの効果。マップに無い能力は汎用ボーナスにフォールバック
    const ORB_ABILITY_MAP = {
        life_drain:      { stat: 'lifesteal', v: 0.04 },
        critical_hit:    { stat: 'critRate',  v: 0.10 },
        iron_wall:       { stat: 'dr',        v: 0.10 },
        swift_wind:      { stat: 'moveSpd',   v: 0.12 },
        thorn_armor:     { stat: 'thorns',    v: 0.30 },
        natural_healing: { stat: 'regen',     v: 0.008 },
        venomous_strike: { proc: 'poison',    v: 0.30 },
        blazing_strike:  { proc: 'burn',      v: 0.30 },
        afterimage:      { stat: 'dodge',     v: 0.08 },
        first_strike:    { stat: 'dmgFull',   v: 0.30 },
        focus_strike:    { stat: 'critDmg',   v: 0.30 },
        berserker_state: { stat: 'rageAtk',   v: 0.30 },
        penetration:     { stat: 'pierce',    v: 1 },
        sure_hit:        { stat: 'critRate',  v: 0.06 },
        guts:            { stat: 'dr',        v: 0.07 },
        iron_will:       { stat: 'defPct',    v: 0.12 },
        awakening:       { stat: 'atkPct',    v: 0.15 },
        dual_weapon:     { stat: 'aspd',      v: 0.10 },
        // ティア5
        god_slayer:      { stat: 'dmgBoss',   v: 0.40 },
        absolute_barrier:{ proc: 'hurtShield', v: 0.45 },
        overlord_presence:{ stat: 'dmgMob',   v: 0.35 },
        phoenix_blessing:{ proc: 'killHeal',  v: 0.08 },
        apex_wisdom:     { stat: 'energyUp',  v: 0.50 }
    };

    function orbToEffects(orb) {
        const out = { stats: {}, procs: [], lines: [] };
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
            if (am && am.stat) add(am.stat, am.v);
            else if (am && am.proc) out.procs.push({ key: am.proc, v: am.v });
            else add('atkPct', orb.tier === 'tier5' ? 0.2 : 0.1);
            out.lines.push('★ ' + (ua.name || ua.key));
        }
        return out;
    }

    // ---------- 集計（戦闘用ステータス）----------
    // 武器本体のdmg・武器種・特殊効果・ソケットのオーブを全部まとめる
    function aggregate(w) {
        const agg = { stats: {}, procs: [] };
        if (!w) return agg;
        const addStat = (k, v) => { agg.stats[k] = (agg.stats[k] || 0) + v; };
        (w.effects || []).forEach(fx => {
            const e = EFFECT_BY_ID[fx.id];
            if (!e) return;
            if (e.kind === 'stat') addStat(e.key, fx.v);
            else agg.procs.push({ key: e.key, on: e.on, v: fx.v });
        });
        (w.orbs || []).forEach(orb => {
            if (!orb) return;
            const oe = orbToEffects(orb);
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
        if (!d.starter) {
            // 初回だけ町の人から「ふつうの＋鉄の剣」を貰う
            const w = roll({ ilvl: 1, baseIds: ['iron_sword'], forceRarity: 'normal', source: 'starter' });
            w.prefix = 'ふつうの'; w.name = displayName(w); w.effects = []; w.sockets = 1; w.orbs = [null];
            d.weapons.push(w); d.equipped = w.id; d.starter = true;
            save(d);
        }
        return d;
    }
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
        crossbow: 'bow', wand: 'magic_wand', shotgun: 'pistol', esper: 'esper' };
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
        const idx = RARITY_ORDER.indexOf(w.rarity);
        return Math.max(1, Math.round((3 + w.ilvl * 1.5) * (1 + idx * 1.4)));
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
        roll, displayName, describeEffect, orbToEffects, aggregate, rarityOf,
        load, save, syncLegacy, getEquipped, sellValue, sellWeapon, socketOrb, unsocketOrb, returnOrbs,
        STORAGE_LIMIT
    };
})();
