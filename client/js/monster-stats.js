// client/js/monster-stats.js
//
// モンスターごとの「固定の合計ステータス」を一か所にまとめた表。
// ボットバトル（online.js）と、サモンズロッドの配下モンスター（summons.js）の
// 両方がこの表を参照する（index.html・battle.htmlの両方で読み込む）。
//
// 【仕様】
// ・ボットとして戦うときは、この合計ステータスは「プレイヤーのステータスに関係なく」
//   常に一定。合計（HP+攻撃+防御+速さ+特殊）だけが固定で、5つのステータスへの
//   振り分けは戦うたびにランダムに決まる（online.jsのgenerateFixedBotStats）。
// ・契約（配下）にしたときは、この値が「モンスターの強さ」になり、追加攻撃力が
//   プレイヤーの攻撃力の何割か（1割〜5割）を決める（summons.jsのgetSummonAtkRatio）。
// ・数値を変えたいときは、この表の数字を書き換えるだけでよい。
//   例：スライム=250、原初の巨人=1000000。
// ・BOT_MONSTERS（online.js）に新しいモンスターを追加した場合は、ここにも1行足すこと。
//   足し忘れても動くが、statMultiplierから自動推定した値になる（下のestimate...参照）。

const MONSTER_TOTAL_STATS = {
    goblin:                     1100,   // ゴブリン
    goblin_scout:                870,   // ゴブリンの偵察兵
    slime:                       250,   // スライム
    wolf:                       1100,   // 狼
    bat:                         200,   // コウモリ
    rat:                         170,   // ネズミ
    snake:                       460,   // 蛇
    spider:                      260,   // 蜘蛛
    boar:                       1100,   // 猪
    skeleton:                    500,   // スケルトン
    ghost:                       560,   // ゴースト
    mushroom:                    140,   // 毒キノコ
    herb_gatherer:               290,   // 薬草採取者
    rock_golem:                 1900,   // ロックゴーレム
    slime_king:                 2100,   // スライムキング
    orc:                        2400,   // オーク
    orc_warrior:               10000,   // オーク戦士
    harpy:                      4100,   // ハーピー
    minotaur:                  17000,   // ミノタウロス
    ogre:                      13000,   // オーガ
    dark_sorcerer:              3400,   // ダークソーサラー
    fire_elemental:             4500,   // ファイアエレメンタル
    ice_elemental:              4800,   // アイスエレメンタル
    lightning_elemental:        7500,   // ライトニングエレメンタル
    poison_spider:              1400,   // 毒蜘蛛
    iron_golem:                16000,   // アイアンゴーレム
    silver_wolf:               11000,   // 銀狼
    mage:                       3700,   // 魔法使い
    ancient_scholar:            5300,   // 古代の学者
    baby_dragon:                2600,   // ベビードラゴン
    wild_wyvern:               19000,   // 野生のワイバーン
    dragon_knight:             22000,   // ドラゴンナイト
    phoenix:                   20000,   // フェニックス
    unicorn:                   25000,   // ユニコーン
    griffin:                   32000,   // グリフォン
    chimera:                   55000,   // キメラ
    hydra:                     43000,   // ヒドラ
    titan:                    140000,   // タイタン
    elemental_lord:            47000,   // エレメンタルロード
    gold_golem:                35000,   // ゴールドゴーレム
    mithril_golem:             96000,   // ミスリルゴーレム
    star_guardian:             61000,   // スターガーディアン
    moon_beast:                67000,   // ムーンビースト
    sun_guardian:             110000,   // サンガーディアン
    ancient_dragon:           350000,   // 古代ドラゴン
    divine_beast:             290000,   // 神獣
    abyss_lord:               370000,   // アビスロード
    world_tree_guardian:      450000,   // 世界樹の守護者
    time_mage:                220000,   // タイムメイジ
    void_walker:              230000,   // ヴォイドウォーカー
    chaos_beast:              580000,   // カオスビースト
    eternal_flame_guardian:   320000,   // 永遠の炎の守護者
    void_dragon:             1000000,   // ヴォイドドラゴン
    frog:                        150,   // カエル
    crow:                        230,   // カラス
    hornet:                      320,   // スズメバチ
    centipede:                   250,   // ムカデ
    crab:                        410,   // カニ
    turtle:                      610,   // カメ
    weasel:                      350,   // イタチ
    firefly:                     120,   // ホタル
    mole:                        130,   // モグラ
    scorpion:                    650,   // サソリ
    jackal:                      710,   // ジャッカル
    vulture:                     390,   // ハゲワシ
    goblin_shaman:               190,   // ゴブリンシャーマン
    sand_lizard:                2800,   // サンドリザード
    cave_troll:                 6400,   // 洞窟トロル
    swamp_hag:                  1500,   // 沼の魔女
    bandit:                     1700,   // 野盗
    mercenary:                  7100,   // 傭兵
    cursed_doll:                1200,   // 呪いの人形
    gargoyle:                  14000,   // ガーゴイル
    kappa:                      3000,   // 河童
    tengu:                     12000,   // 天狗
    oni_child:                  8300,   // 鬼の子
    ice_wolf:                   9100,   // 氷狼
    bog_witch:                  1800,   // 沼沢の魔女
    wraith:                     5800,   // レイス
    basilisk:                  30000,   // バジリスク
    manticore:                 74000,   // マンティコア
    banshee:                   27000,   // バンシー
    lich:                      39000,   // リッチ
    werebear:                  82000,   // ワーベア
    sphinx:                    52000,   // スフィンクス
    cerberus:                 120000,   // ケルベロス
    storm_eagle:               86000,   // ストームイーグル
    coral_dragon:             150000,   // コーラルドラゴン
    sand_wyrm:                170000,   // サンドワーム
    shadow_panther:           200000,   // シャドウパンサー
    crystal_golem:            130000,   // クリスタルゴーレム
    sea_serpent:              180000,   // シーサーペント
    frost_titan:              500000,   // フロストタイタン
    magma_behemoth:           860000,   // マグマベヒモス
    star_dragon:              700000,   // スタードラゴン
    death_reaper:             410000,   // デスリーパー
    nether_king:              640000,   // ネザーキング
    celestial_phoenix:        780000,   // セレスティアルフェニックス
    world_serpent:           1000000,   // ワールドサーペント
    dream_eater:              260000,   // ドリームイーター
    gravity_lord:             550000,   // グラビティロード
    blight_dragon:            950000,   // ブライトドラゴン
    primeval_giant:          1000000,   // 原初の巨人
};

// 表に載っていないモンスター用の推定：スライム(statMultiplier=0.5)=250と
// 原初の巨人(statMultiplier=2.16)=1000000を結ぶ対数（指数）補間。
// 250〜1000000という4000倍もの開きがあるため、線形補間ではなく対数補間を使う。
const MONSTER_TOTAL_STAT_ESTIMATE_LOW = { multiplier: 0.5, total: 250 };
const MONSTER_TOTAL_STAT_ESTIMATE_HIGH = { multiplier: 2.16, total: 1000000 };
const MONSTER_TOTAL_STAT_CAP = 1000000;
const MONSTER_TOTAL_STAT_FLOOR = 100;

function estimateMonsterTotalStatFromMultiplier(statMultiplier) {
    const lo = MONSTER_TOTAL_STAT_ESTIMATE_LOW;
    const hi = MONSTER_TOTAL_STAT_ESTIMATE_HIGH;
    const m = (statMultiplier != null && isFinite(statMultiplier)) ? statMultiplier : 1.0;
    const ratio = (m - lo.multiplier) / (hi.multiplier - lo.multiplier);
    const estimated = lo.total * Math.pow(hi.total / lo.total, ratio);
    return Math.round(Math.min(MONSTER_TOTAL_STAT_CAP, Math.max(MONSTER_TOTAL_STAT_FLOOR, estimated)));
}

/**
 * モンスターIDから固定の合計ステータスを返す。表に無ければnull。
 * @param {string} monsterId
 * @returns {number|null}
 */
function getMonsterTotalStatById(monsterId) {
    if (monsterId != null && Object.prototype.hasOwnProperty.call(MONSTER_TOTAL_STATS, monsterId)) {
        return MONSTER_TOTAL_STATS[monsterId];
    }
    return null;
}

/**
 * モンスター（BOT_MONSTERSの要素）の固定の合計ステータスを返す。
 * 表に無い場合はstatMultiplierから推定する。
 * @param {object} monster
 * @returns {number}
 */
function getMonsterTotalStat(monster) {
    if (!monster) return MONSTER_TOTAL_STAT_ESTIMATE_LOW.total;
    const fixed = getMonsterTotalStatById(monster.id);
    if (fixed != null) return fixed;
    return estimateMonsterTotalStatFromMultiplier(monster.statMultiplier);
}
