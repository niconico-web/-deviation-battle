// ============================================================
// 実績・称号 (achievements.js)
//  ・実績を達成すると、称号や特殊アイテムがもらえる。達成条件が「？？？」で隠されている実績もある
//  ・称号は1つ選んで装備すると、名前の上に表示される（パーティの仲間にも見える）
//  ・データは localStorage "sbAch"（武器庫の sbHack とは別。ステージ中に武器庫を書き換えて、古いデータで上書きされる事故を避けるため）
//      c       … 数えているもの（撃破数・勉強時間・ログイン日数など）
//      done    … 達成した実績 { id: 達成時刻 }
//      pending … まだ武器庫に渡していない報酬（町に戻ったときに渡す）
//      title   … 装備中の称号の実績id
//  ・報酬の中身（アイテム・神話の武器・特別なアクセサリー）は、町（index）で武器庫に渡す。ステージ中は渡さない
//  ・SBAch.report(種類, 値) で数を進め、SBAch.evaluate() で武器庫などから数えられるものを判定する
// ============================================================
(function () {
    'use strict';
    const KEY = 'sbAch';
    const IN_STAGE = /stage\.html/.test(location.pathname);

    // ---------- 実績の一覧 ----------
    //  ck/n   … 数えているもの c[ck] が n 以上で達成。 chk(X) … 武器庫などから判定（X = { c, h }）。 prog(X) … [いま, 目標]
    //  reward … { title:'称号', items:{slot,rarity,reroll}, mythic:true, acc:'アクセサリーid' }。 hidden … 達成するまで条件を「？？？」にする
    const ACH = [];
    function add(id, cat, name, desc, o) { ACH.push(Object.assign({ id: id, cat: cat, name: name, desc: desc }, o || {})); }
    const it = (slot, rarity, reroll) => ({ slot: slot | 0, rarity: rarity | 0, reroll: reroll | 0 });

    // --- 特別な実績（この3つ＋隠し実績）---
    add('eternal_serenity', '無限回廊', '永久の安寧を保つもの', '無限回廊の地下100階に到達する', { ck: 'floorMax', n: 100, hidden: true, special: true,
        reward: { title: '永久の安寧を保つもの', mythic: true }, rewardText: '神話の武器「永久の＋安寧の剣」／称号「永久の安寧を保つもの」（この実績でしか手に入らない）' });
    add('half_anniversary', '特別', 'Half Anniversary', '無限回廊の地下50階に到達する', { ck: 'floorMax', n: 50, special: true,
        reward: { title: 'Half Anniversary', acc: 'ac_half_compass', items: it(0, 2, 0) }, rewardText: '称号「Half Anniversary」／アクセサリー「記念の羅針盤」／昇華の結晶×2' });
    add('still_awake', '特別', 'まだおきてるの？', '夜中の0:00ちょうど（日本時間）にログインする', { ck: 'midnight', n: 1, special: true,
        reward: { title: '夜更かしさん', acc: 'ac_insomnia_lamp' }, rewardText: '称号「夜更かしさん」／アクセサリー「不眠の灯火」（暗闇の階でも視界が狭くならない）' });

    // --- 数を数えるもの（段階ごとに称号）---
    function tiers(ck, cat, base, list, fmt) {
        list.forEach((t, i) => {
            const n = t[0];
            add(base + '_' + n, cat, t[1], fmt(n), { ck: ck, n: n, hidden: !!t[3], reward: Object.assign({ title: t[2] || t[1] }, t[4] ? { items: t[4] } : {}) });
        });
    }
    tiers('kills', '戦闘', 'kills', [
        [100, '駆け出しの剣士', '駆け出しの剣士'], [500, '百戦の戦士', '百戦の戦士', 0, it(1, 0, 0)], [2000, '殲滅者', '殲滅者'], [5000, '血染めの英雄', '血染めの英雄', 0, it(0, 1, 0)],
        [20000, '万の屍を越えて', '万の屍を越えし者'], [50000, '戦場の覇者', '戦場の覇者', 0, it(0, 0, 1)], [200000, '終わらぬ殺戮', '終わらぬ殺戮'], [1000000, '百万の屍の上に立つ者', '百万の屍の上に立つ者', 1]
    ], n => '敵を合計 ' + n.toLocaleString() + ' 体倒す');
    tiers('bossKills', '戦闘', 'boss', [
        [1, 'はじめてのボス', 'ボスハンター見習い'], [10, 'ボスハンター', 'ボスハンター', 0, it(1, 0, 0)], [30, '巨人殺し', '巨人殺し'], [100, '討伐隊の英雄', '討伐隊の英雄', 0, it(0, 1, 0)],
        [300, '神殺し', '神殺し'], [1000, '終焉をもたらすもの', '終焉をもたらすもの', 1]
    ], n => 'ボスを合計 ' + n.toLocaleString() + ' 体倒す');
    tiers('studyMin', '勉強', 'study', [
        [30, 'はじめの一歩', '見習い学徒'], [120, 'コツコツ勉強家', 'コツコツ勉強家', 0, it(1, 0, 0)], [600, '10時間の努力', '努力の人'], [1500, '勉強の鬼', '勉強の鬼', 0, it(0, 1, 0)],
        [3000, '50時間の求道者', '求道者'], [6000, '100時間の賢者', '賢者', 0, it(0, 0, 1)], [15000, '250時間の大賢者', '大賢者'], [30000, '知の探究者', '知の探究者', 1]
    ], n => '勉強タイマーで合計 ' + (n >= 60 ? (n / 60) + ' 時間' : n + ' 分') + ' 勉強する');
    tiers('loginDays', '継続', 'login', [
        [1, '入学式', '新入生'], [3, '三日坊主は卒業', '三日坊主卒業'], [7, '1週間の皆勤', '皆勤賞', 0, it(1, 0, 0)], [14, '2週間の習慣', '習慣の人'], [30, '1か月の継続', '継続は力なり', 0, it(0, 1, 0)],
        [60, '2か月の常連', '常連'], [100, '100日の古参', '古参兵', 1], [200, '200日の重鎮', '学園の重鎮']
    ], n => '合計 ' + n + ' 日ログインする（日本時間の日付で数える）');
    tiers('floorMax', '無限回廊', 'floor', [
        [3, '迷宮の入口', '迷宮の旅人'], [5, '地下5階', '地下の探索者'], [10, '地下10階', '深層の探索者', 0, it(1, 0, 0)], [20, '地下20階', '回廊の踏破者', 0, it(0, 1, 0)],
        [30, '地下30階', '深淵に挑むもの'], [40, '地下40階', '深淵を歩むもの', 0, it(0, 0, 1)], [75, '地下75階', '果てなき迷宮の住人', 0, it(1, 1, 1)], [150, '地下150階', '回廊の主', 1, it(2, 2, 2)]
    ], n => '無限回廊の地下 ' + n + ' 階に到達する');
    tiers('pvpWins', '対人戦', 'pvpw', [
        [1, '初勝利', '初陣の勝者'], [5, '5勝', '連勝街道'], [25, '25勝', '対人戦の強者', 0, it(0, 1, 0)], [100, '100勝', '闘技場の覇者'], [300, '300勝', '無敗の伝説', 1]
    ], n => 'オンラインマッチで合計 ' + n + ' 回勝つ');
    tiers('pvpPlays', '対人戦', 'pvpp', [
        [1, 'はじめての対戦', '対戦デビュー'], [10, '10戦', '腕試し'], [50, '50戦', '歴戦の闘士'], [200, '200戦', '闘技場の住人']
    ], n => 'オンラインマッチに合計 ' + n + ' 回参加する');

    // --- 武器庫などから判定するもの ---
    const hcount = (h, f) => (h && Array.isArray(h.weapons) ? h.weapons.filter(f).length : 0);
    function add2(id, cat, name, desc, title, chk, prog, extra) { add(id, cat, name, desc, Object.assign({ chk: chk, prog: prog, reward: { title: title } }, extra || {})); }
    add2('stage_clear_1', 'ステージ', 'はじめてのクリア', 'ステージを1つクリアする', 'ステージ踏破者', X => X.clears >= 1, X => [X.clears, 1]);
    add2('stage_clear_5', 'ステージ', '5ステージ制覇', 'ちがうステージを5つクリアする', '冒険家', X => X.clears >= 5, X => [X.clears, 5], { reward: { title: '冒険家', items: it(1, 0, 0) } });
    add2('stage_clear_10', 'ステージ', '10ステージ制覇', 'ちがうステージを10つクリアする', '世界の旅人', X => X.clears >= 10, X => [X.clears, 10]);
    add2('stage_clear_20', 'ステージ', '20ステージ制覇', 'ちがうステージを20つクリアする', '世界を巡るもの', X => X.clears >= 20, X => [X.clears, 20], { reward: { title: '世界を巡るもの', items: it(0, 1, 0) } });
    add2('stage_clear_40', 'ステージ', '40ステージ制覇', 'ちがうステージを40つクリアする', '全ステージの覇者', X => X.clears >= 40, X => [X.clears, 40], { reward: { title: '全ステージの覇者', items: it(1, 1, 1) } });
    add2('rush_p1', 'ボスラッシュ', 'ラッシュの入口', 'ボスラッシュで、どの難易度でもフェーズ1をクリアする', 'ラッシュ挑戦者', X => X.rush >= 1, X => [X.rush, 1]);
    add2('rush_p3', 'ボスラッシュ', 'ラッシュの半ば', 'ボスラッシュで、どの難易度でもフェーズ3をクリアする', 'ラッシュの猛者', X => X.rush >= 3, X => [X.rush, 3], { reward: { title: 'ラッシュの猛者', items: it(0, 1, 0) } });
    add2('rush_clear', 'ボスラッシュ', 'ラッシュ完全制覇', 'ボスラッシュを、どの難易度でもクリアする', 'ラッシュの覇者', X => X.rush >= 6, X => [X.rush, 6], { reward: { title: 'ラッシュの覇者', items: it(1, 1, 1) } });
    add2('rush_extreme', 'ボスラッシュ', 'エクストリームの頂へ', 'ボスラッシュを、エクストリームでクリアする', '極限を超えしもの', X => X.rushEx >= 6, X => [X.rushEx, 6], { hidden: true, reward: { title: '極限を超えしもの', items: it(2, 2, 2) } });
    add2('weapon_rare', '武器', 'レア武器を手にした', 'レア以上の武器を手に入れる', '武器目利き', X => X.rarMax >= 2, X => [Math.min(X.rarMax, 2), 2]);
    add2('weapon_epic', '武器', 'エピック武器を手にした', 'エピック以上の武器を手に入れる', '武器収集家', X => X.rarMax >= 3, X => [Math.min(X.rarMax, 3), 3], { reward: { title: '武器収集家', items: it(1, 0, 0) } });
    add2('weapon_legend', '武器', 'レジェンド武器を手にした', 'レジェンドの武器を手に入れる', '伝説の担い手', X => X.rarMax >= 4, X => [Math.min(X.rarMax, 4), 4], { reward: { title: '伝説の担い手', items: it(0, 1, 0) } });
    add2('weapon_10', '武器', '武器庫の主', '武器を10本持つ', '武器庫の主', X => X.nW >= 10, X => [X.nW, 10]);
    add2('weapon_50', '武器', '武器コレクター', '武器を50本持つ', '武器コレクター', X => X.nW >= 50, X => [X.nW, 50]);
    add2('weapon_socket6', '武器', '6つの穴', 'オーブスロットが6つある武器を持つ', '宝珠の担い手', X => X.maxSock >= 6, X => [X.maxSock, 6]);
    add2('weapon_plus', '武器', '昇華の道', '武器を「＋1」以上にアップグレードする', '昇華する者', X => X.maxPlus >= 1, X => [X.maxPlus, 1]);
    add2('weapon_plus_20', '武器', '昇華の道（＋20）', '武器を「＋20」にアップグレードする', '昇華の探求者', X => X.maxPlus >= 20, X => [X.maxPlus, 20], { reward: { title: '昇華の探求者', items: it(0, 2, 0) } });
    add2('acc_1', 'アクセサリー', 'はじめてのアクセサリー', 'アクセサリーを1つ手に入れる', '飾り好き', X => X.nAcc >= 1, X => [X.nAcc, 1]);
    add2('acc_10', 'アクセサリー', 'アクセサリー収集家', 'アクセサリーを10個持つ', 'アクセサリー収集家', X => X.nAcc >= 10, X => [X.nAcc, 10], { reward: { title: 'アクセサリー収集家', items: it(0, 0, 1) } });
    add2('acc_legend', 'アクセサリー', '伝説の装飾', 'レジェンドのアクセサリーを手に入れる', '装飾の王', X => X.accLegend, X => [X.accLegend ? 1 : 0, 1]);
    add2('armor_1', '防具', 'はじめての防具', '防具を1つ手に入れる', '守りの心得', X => X.nArm >= 1, X => [X.nArm, 1]);
    add2('armor_set', '防具', '一式そろえた', '頭・胴・足の防具を全部装備する', 'フル装備', X => X.armSet, X => [X.armEq, 3]);
    add2('element_1', '属性', '属性のめざめ', '属性を1つ強化する（勉強で属性ポイントがたまる）', '属性使い', X => X.elemTotal >= 1, X => [Math.min(X.elemTotal, 1), 1]);
    add2('element_50', '属性', '属性の達人', '属性ポイントを合計50ためる', '属性の達人', X => X.elemTotal >= 50, X => [Math.min(X.elemTotal, 50), 50]);

    // --- 隠し実績（条件は達成するまで「？？？」）---
    add('hid_flawless', '隠し', '不屈', '無限回廊の地下10階以降から、脱出ゲートで生きて帰る', { hidden: true, ck: 'escFloorMax', n: 10, reward: { title: '生還者', items: it(1, 1, 0) } });
    add('hid_escape_10', '隠し', '脱出の達人', '無限回廊で、脱出ゲートから10回脱出する', { hidden: true, ck: 'escapes', n: 10, reward: { title: '脱出の達人', items: it(0, 1, 1) } });
    add('hid_night_owl', '隠し', '夜ふかしの常連', '夜中の0:00ちょうどのログインを、合計3回する', { hidden: true, ck: 'midnightDays', n: 3, reward: { title: '夜の住人', items: it(1, 0, 1) } });
    add('hid_all', '隠し', '実績コンプリート', 'ほかの実績をすべて達成する', { hidden: true, chk: X => X.allOthers, prog: X => [X.doneCount, X.totalCount], reward: { title: '全てを成し遂げしもの', items: it(5, 5, 5) } });

    // --- 称号だけがもらえる、ちょっとした実績 ---
    const fun = [
        ['fun_first_study', '勉強', 'はじめての勉強', '勉強タイマーで1分以上勉強する', 'studyMin', 1, '勉強はじめました'],
        ['fun_study_60', '勉強', '1時間の集中', '勉強タイマーで合計60分勉強する', 'studyMin', 60, '集中力の持ち主'],
        ['fun_study_300', '勉強', '5時間の積み重ね', '勉強タイマーで合計300分勉強する', 'studyMin', 300, '積み重ねの人'],
        ['fun_kills_10', '戦闘', '最初の十体', '敵を合計10体倒す', 'kills', 10, '新米戦士'],
        ['fun_kills_1000', '戦闘', '千体斬り', '敵を合計1,000体倒す', 'kills', 1000, '千人斬り'],
        ['fun_kills_10000', '戦闘', '一万体斬り', '敵を合計10,000体倒す', 'kills', 10000, '一騎当千'],
        ['fun_kills_100000', '戦闘', '十万体斬り', '敵を合計100,000体倒す', 'kills', 100000, '一騎当万'],
        ['fun_boss_5', '戦闘', 'ボス5体', 'ボスを合計5体倒す', 'bossKills', 5, 'ボス狩り'],
        ['fun_boss_50', '戦闘', 'ボス50体', 'ボスを合計50体倒す', 'bossKills', 50, 'ボスの天敵'],
        ['fun_boss_500', '戦闘', 'ボス500体', 'ボスを合計500体倒す', 'bossKills', 500, 'ボスの悪夢'],
        ['fun_login_5', '継続', '5日ログイン', '合計5日ログインする', 'loginDays', 5, '通い詰め'],
        ['fun_login_21', '継続', '21日ログイン', '合計21日ログインする', 'loginDays', 21, '習慣の力'],
        ['fun_login_45', '継続', '45日ログイン', '合計45日ログインする', 'loginDays', 45, '半年の入口'],
        ['fun_login_150', '継続', '150日ログイン', '合計150日ログインする', 'loginDays', 150, '学園の長老'],
        ['fun_floor_7', '無限回廊', '地下7階', '無限回廊の地下7階に到達する', 'floorMax', 7, '迷子の探検家'],
        ['fun_floor_15', '無限回廊', '地下15階', '無限回廊の地下15階に到達する', 'floorMax', 15, '迷宮慣れ'],
        ['fun_floor_25', '無限回廊', '地下25階', '無限回廊の地下25階に到達する', 'floorMax', 25, '迷宮の常連'],
        ['fun_floor_35', '無限回廊', '地下35階', '無限回廊の地下35階に到達する', 'floorMax', 35, '深層の住人'],
        ['fun_floor_60', '無限回廊', '地下60階', '無限回廊の地下60階に到達する', 'floorMax', 60, '底なしの探究者'],
        ['fun_floor_90', '無限回廊', '地下90階', '無限回廊の地下90階に到達する', 'floorMax', 90, '終わりを望むもの'],
        ['fun_pvp_3', '対人戦', '3勝', 'オンラインマッチで合計3回勝つ', 'pvpWins', 3, '勝ち星三つ'],
        ['fun_pvp_10', '対人戦', '10勝', 'オンラインマッチで合計10回勝つ', 'pvpWins', 10, '闘技場の新星'],
        ['fun_pvp_50', '対人戦', '50勝', 'オンラインマッチで合計50回勝つ', 'pvpWins', 50, '常勝の闘士'],
        ['fun_pvp_20p', '対人戦', '20戦', 'オンラインマッチに合計20回参加する', 'pvpPlays', 20, '対戦好き'],
        ['fun_pvp_100p', '対人戦', '100戦', 'オンラインマッチに合計100回参加する', 'pvpPlays', 100, '対戦の鬼'],
        ['fun_esc_3', '無限回廊', '脱出3回', '無限回廊で、脱出ゲートから3回脱出する', 'escapes', 3, '無事に帰る人'],
        ['fun_esc_30', '無限回廊', '脱出30回', '無限回廊で、脱出ゲートから30回脱出する', 'escapes', 30, '生還のプロ'],
        ['fun_dead_1', '無限回廊', 'はじめての敗北', '無限回廊で倒れる', 'corrDeaths', 1, '転んでも立つ人'],
        ['fun_dead_10', '無限回廊', '10回倒れた', '無限回廊で10回倒れる', 'corrDeaths', 10, '七転び八起き'],
        ['fun_chest_10', '無限回廊', '宝箱10個', '無限回廊で宝箱を10個開ける', 'chests', 10, '宝箱ハンター'],
        ['fun_chest_50', '無限回廊', '宝箱50個', '無限回廊で宝箱を50個開ける', 'chests', 50, '宝の探し人'],
        ['fun_mimic_1', '無限回廊', 'ミミック', '宝箱がミミックだった目に遭う', 'mimics', 1, 'ミミックの友達']
    ];
    fun.forEach(f => add(f[0], f[1], f[2], f[3], { ck: f[4], n: f[5], reward: { title: f[6] } }));

    // 称号の表（同じ文字列でも、別の実績で重なっていてよい）
    const TITLE_SET = {}; ACH.forEach(a => { if (a.reward && a.reward.title) TITLE_SET[a.reward.title] = true; });
    const BY_ID = {}; ACH.forEach(a => { BY_ID[a.id] = a; });

    // ---------- 保存 ----------
    let S = null, dirty = false, saveT = 0;
    function def() { return { v: 1, c: {}, done: {}, pending: [], title: null, loginDay: '' }; }
    function load() {
        if (S) return S;
        try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
        if (!S || typeof S !== 'object') S = def();
        if (!S.c || typeof S.c !== 'object') S.c = {};
        if (!S.done || typeof S.done !== 'object') S.done = {};
        if (!Array.isArray(S.pending)) S.pending = [];
        return S;
    }
    function flush() { if (!S) return; try { localStorage.setItem(KEY, JSON.stringify(S)); dirty = false; } catch (e) { /* 保存できなくてもゲームは続ける */ } }
    function later() { dirty = true; if (!saveT) saveT = setTimeout(() => { saveT = 0; flush(); }, 2000); }
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    // 他のタブ・画面が書き換えたときに、古い内容で上書きしないよう読み直す
    window.addEventListener('storage', e => { if (e.key === KEY) { S = null; } });

    // ---------- 達成の処理 ----------
    function toast(a) {
        try {
            const d = document.createElement('div');
            d.style.cssText = 'position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);z-index:100000;background:linear-gradient(135deg,#3a2a6a,#1d1440);border:2px solid #ffd86a;color:#fff;border-radius:14px;padding:10px 18px;font-size:.9rem;box-shadow:0 6px 24px rgba(0,0,0,.5);text-align:center;max-width:88vw;pointer-events:none;transition:opacity .5s,transform .5s';
            d.innerHTML = '<div style="font-size:.72rem;color:#ffd86a;letter-spacing:.1em">🏆 実績達成！</div><div style="font-weight:bold;font-size:1rem;margin:2px 0">' + esc(a.name) + '</div>' +
                (a.reward && a.reward.title ? '<div style="font-size:.78rem;color:#ffe9a8">称号「' + esc(a.reward.title) + '」を獲得</div>' : '') +
                (hasItems(a) ? '<div style="font-size:.72rem;color:#bfe3ff">' + (IN_STAGE ? '報酬は町に戻ると受け取れます' : '報酬を受け取りました') + '</div>' : '');
            (document.body || document.documentElement).appendChild(d);
            setTimeout(() => { d.style.opacity = '0'; d.style.transform = 'translateX(-50%) translateY(-12px)'; }, 3600);
            setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 4300);
        } catch (e) { /* 表示できなくてもよい */ }
    }
    const hasItems = a => !!(a.reward && (a.reward.mythic || a.reward.acc || (a.reward.items && (a.reward.items.slot || a.reward.items.rarity || a.reward.items.reroll))));
    function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function unlock(a) {
        const s = load(); if (s.done[a.id]) return false;
        s.done[a.id] = Date.now();
        if (hasItems(a) && s.pending.indexOf(a.id) < 0) s.pending.push(a.id);
        if (!s.title && a.reward && a.reward.title) s.title = a.id;       // 最初の称号は自動で装備
        flush(); toast(a);
        try { window.dispatchEvent(new CustomEvent('sbAchUnlocked', { detail: { id: a.id } })); } catch (e) { /* なくてもよい */ }
        if (!IN_STAGE) setTimeout(claim, 300);
        return true;
    }
    // 数えるもの（ck）の判定：数が進むたびに、そのckの実績だけを調べる
    const BY_CK = {}; ACH.forEach(a => { if (a.ck) (BY_CK[a.ck] = BY_CK[a.ck] || []).push(a); });
    function quick(ck) {
        const s = load(), v = s.c[ck] | 0; let any = false;
        (BY_CK[ck] || []).forEach(a => { if (!s.done[a.id] && v >= a.n) { unlock(a); any = true; } });
        return any;
    }
    // report：kill(ボスなら1) / corrFloor(階) / study(秒) / pvp(勝ちなら1) / clear(ステージid) / escape / corrDeath / chest(ミミックなら1) / midnight / login
    function report(kind, v) {
        const s = load(), c = s.c;
        switch (kind) {
            case 'kill': c.kills = (c.kills | 0) + 1; quick('kills'); if (v) { c.bossKills = (c.bossKills | 0) + 1; quick('bossKills'); } break;
            case 'corrFloor': if ((v | 0) > (c.floorMax | 0)) { c.floorMax = v | 0; quick('floorMax'); } break;
            case 'study': c.studySec = (c.studySec | 0) + Math.max(0, v | 0); c.studyMin = Math.floor(c.studySec / 60); quick('studyMin'); break;
            case 'pvp': c.pvpPlays = (c.pvpPlays | 0) + 1; quick('pvpPlays'); if (v) { c.pvpWins = (c.pvpWins | 0) + 1; quick('pvpWins'); } break;
            case 'escape': c.escapes = (c.escapes | 0) + 1; quick('escapes'); if ((v | 0) > (c.escFloorMax | 0)) { c.escFloorMax = v | 0; quick('escFloorMax'); } break;
            case 'corrDeath': c.corrDeaths = (c.corrDeaths | 0) + 1; quick('corrDeaths'); break;
            case 'chest': c.chests = (c.chests | 0) + 1; quick('chests'); if (v) { c.mimics = (c.mimics | 0) + 1; quick('mimics'); } break;
            case 'midnight': c.midnight = 1; c.midnightDays = (c.midnightDays | 0) + 1; quick('midnight'); quick('midnightDays'); break;
            case 'login': c.loginDays = (c.loginDays | 0) + 1; quick('loginDays'); break;
            default: break;
        }
        later();
    }

    // ---------- 武器庫などから数えるもの ----------
    function gather() {
        const s = load(); let h = null;
        try { h = window.HW ? HW.load() : null; } catch (e) { h = null; }
        const X = { c: s.c, h: h, clears: 0, rush: 0, rushEx: 0, rarMax: 0, nW: 0, maxSock: 0, maxPlus: 0, nAcc: 0, accLegend: false, nArm: 0, armEq: 0, armSet: false, elemTotal: 0, doneCount: 0, totalCount: 0, allOthers: false };
        if (h) {
            X.clears = Object.keys(h.cleared || {}).filter(k => (h.cleared[k] | 0) > 0).length;
            const rb = h.rushBest || {}; X.rush = Math.max.apply(null, [0].concat(Object.keys(rb).map(k => rb[k] | 0))); X.rushEx = rb[3] | 0;
            const W = Array.isArray(h.weapons) ? h.weapons : []; X.nW = W.length;
            W.forEach(w => { X.rarMax = Math.max(X.rarMax, window.HW ? HW.rIdx(w.rarity) : 0); X.maxSock = Math.max(X.maxSock, w.sockets | 0); X.maxPlus = Math.max(X.maxPlus, w.plus | 0); });
            const A = Array.isArray(h.accs) ? h.accs : []; X.nAcc = A.length;
            X.accLegend = A.some(a => a.rarity === 'legendary' && a.source !== 'achievement');
            const R = Array.isArray(h.armors) ? h.armors : []; X.nArm = R.length;
            const eq = Array.isArray(h.armorEq) ? h.armorEq : (h.armorEq && typeof h.armorEq === 'object' ? Object.keys(h.armorEq).map(k => h.armorEq[k]) : []);
            X.armEq = eq.filter(Boolean).length; X.armSet = X.armEq >= 3;
            const ep = h.elemPts || {}; X.elemTotal = Object.keys(ep).reduce((t, k) => t + (ep[k] | 0), 0);
        }
        // 持っていた最大値は、売ったあとも残しておく
        const hi = s.c.hi || (s.c.hi = {});
        ['clears', 'rush', 'rushEx', 'rarMax', 'nW', 'maxSock', 'maxPlus', 'nAcc', 'nArm', 'armEq', 'elemTotal'].forEach(k => { if (X[k] > (hi[k] | 0)) hi[k] = X[k]; X[k] = hi[k] | 0; });
        if (X.accLegend) hi.accLegend = 1; X.accLegend = !!hi.accLegend; X.armSet = (hi.armEq | 0) >= 3;
        return X;
    }
    function evaluate() {
        try {
            const s = load(), X = gather(); let n = 0;
            ACH.forEach(a => {
                if (s.done[a.id]) return;
                if (a.id === 'hid_all') return;
                if (a.chk && a.chk(X)) { unlock(a); n++; } else if (a.ck && (s.c[a.ck] | 0) >= a.n) { unlock(a); n++; }
            });
            const others = ACH.filter(a => a.id !== 'hid_all'); X.doneCount = others.filter(a => s.done[a.id]).length; X.totalCount = others.length; X.allOthers = X.doneCount >= X.totalCount;
            if (!s.done.hid_all && X.allOthers) unlock(BY_ID.hid_all);
            later(); return n;
        } catch (e) { return 0; }
    }

    // ---------- 報酬を武器庫へ渡す（町でだけ。ステージ中は古い武器庫データで上書きされる恐れがあるので渡さない）----------
    function claim() {
        if (IN_STAGE || !window.HW) return 0;
        const s = load(); if (!s.pending.length) return 0;
        let n = 0;
        try {
            const h = HW.load(), got = [];
            s.pending.slice().forEach(id => {
                const a = BY_ID[id]; if (!a || !a.reward) { s.pending = s.pending.filter(x => x !== id); return; }
                const r = a.reward;
                if (r.items) { ['slot', 'rarity', 'reroll'].forEach(k => { if (r.items[k] > 0) HW.addItem(h, k, r.items[k]); }); }
                if (r.mythic && HW.giveMythic) HW.giveMythic(h);
                if (r.acc && window.SBAcc) SBAcc.giveSpecial(h, r.acc);
                s.pending = s.pending.filter(x => x !== id); got.push(a.name); n++;
            });
            HW.save(h); flush();
            if (got.length) setTimeout(() => notice('🎁 実績の報酬を受け取りました：' + got.join('、') + '\n（インベントリ／武器庫を確認してください）'), 500);
        } catch (e) { /* 失敗したら次の機会にもう一度 */ }
        return n;
    }
    function notice(t) {
        try {
            const d = document.createElement('div');
            d.style.cssText = 'position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:100000;background:rgba(20,15,40,.92);border:1px solid #ffd86a;color:#fff;border-radius:12px;padding:10px 16px;font-size:.82rem;max-width:90vw;white-space:pre-line;text-align:center;pointer-events:none;transition:opacity .6s';
            d.textContent = t; document.body.appendChild(d);
            setTimeout(() => { d.style.opacity = '0'; }, 5200); setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 5900);
        } catch (e) { /* 表示できなくてもよい */ }
    }

    // ---------- 称号 ----------
    function earnedTitles() { const s = load(); return ACH.filter(a => s.done[a.id] && a.reward && a.reward.title); }
    function titleText() { const s = load(), a = s.title && BY_ID[s.title]; return (a && s.done[a.id] && a.reward && a.reward.title) || ''; }
    function isTitleText(t) { return typeof t === 'string' && t.length <= 30 && !!TITLE_SET[t]; }
    function setTitle(id) { const s = load(); if (id === null || (s.done[id] && BY_ID[id] && BY_ID[id].reward && BY_ID[id].reward.title)) { s.title = id; flush(); return true; } return false; }

    // ---------- 画面 ----------
    function progOf(a, X) {
        const s = load();
        if (a.prog) { try { return a.prog(X); } catch (e) { return null; } }
        if (a.ck) return [Math.min(s.c[a.ck] | 0, a.n), a.n];
        return null;
    }
    function ensureStyle() {
        if (document.getElementById('sbAchStyle')) return;
        const st = document.createElement('style'); st.id = 'sbAchStyle';
        st.textContent = '#sbAchBack{position:fixed;inset:0;z-index:99990;background:rgba(5,3,15,.72);display:flex;align-items:center;justify-content:center;padding:10px}' +
            '#sbAchBox{background:#171230;color:#fff;border:1px solid #5a4a9a;border-radius:14px;width:min(640px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;font-size:.88rem}' +
            '#sbAchBox .hd{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #3a2f6a;font-weight:bold;font-size:1rem}' +
            '#sbAchBox .hd button{background:none;border:0;color:#fff;font-size:1.3rem;cursor:pointer}' +
            '#sbAchBox .tabs{display:flex;gap:6px;padding:8px 12px;flex-wrap:wrap;border-bottom:1px solid #3a2f6a}' +
            '#sbAchBox .tabs button{background:#2a2250;border:1px solid #4a3f8a;color:#fff;border-radius:999px;padding:4px 10px;font-size:.78rem;cursor:pointer}' +
            '#sbAchBox .tabs button.on{background:#6a4fd0;border-color:#ffd86a}' +
            '#sbAchBox .list{overflow:auto;padding:8px 12px;flex:1}' +
            '#sbAchBox .row{border:1px solid #3a2f6a;border-radius:10px;padding:8px 10px;margin:6px 0;background:#1f1840}' +
            '#sbAchBox .row.done{border-color:#ffd86a;background:#2a2150}' +
            '#sbAchBox .row .nm{font-weight:bold}' +
            '#sbAchBox .row .ds{font-size:.78rem;color:#b9b0e6;margin-top:2px}' +
            '#sbAchBox .row .rw{font-size:.74rem;color:#ffe08a;margin-top:3px}' +
            '#sbAchBox .bar{height:6px;border-radius:4px;background:#3a2f6a;margin-top:5px;overflow:hidden}' +
            '#sbAchBox .bar i{display:block;height:100%;background:linear-gradient(90deg,#6dffe0,#ffd86a)}' +
            '#sbAchBox .eq{margin-top:5px;background:#3a2f8a;border:1px solid #7a6adf;color:#fff;border-radius:8px;padding:3px 10px;font-size:.76rem;cursor:pointer}' +
            '#sbAchBox .eq.on{background:#b8860b;border-color:#ffd86a}' +
            '#sbAchBox .ft{padding:8px 14px;border-top:1px solid #3a2f6a;font-size:.78rem;color:#b9b0e6}';
        document.head.appendChild(st);
    }
    let curCat = 'すべて';
    function openPanel() {
        ensureStyle(); if (!IN_STAGE) claim(); evaluate();
        let back = document.getElementById('sbAchBack'); if (back) back.remove();
        back = document.createElement('div'); back.id = 'sbAchBack';
        back.innerHTML = '<div id="sbAchBox"><div class="hd"><span>🎖️ 実績・称号</span><button type="button" aria-label="閉じる">✕</button></div><div class="tabs"></div><div class="list"></div><div class="ft"></div></div>';
        document.body.appendChild(back);
        back.addEventListener('click', e => { if (e.target === back) back.remove(); });
        back.querySelector('.hd button').addEventListener('click', () => back.remove());
        render();
    }
    function render() {
        const back = document.getElementById('sbAchBack'); if (!back) return;
        const s = load(), X = gather(), cats = ['すべて', '達成済み'].concat(ACH.map(a => a.cat).filter((c, i, arr) => arr.indexOf(c) === i));
        back.querySelector('.tabs').innerHTML = cats.map(c => '<button type="button" data-c="' + esc(c) + '" class="' + (c === curCat ? 'on' : '') + '">' + esc(c) + '</button>').join('');
        back.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { curCat = b.getAttribute('data-c'); render(); }));
        let arr = ACH.filter(a => curCat === 'すべて' || (curCat === '達成済み' ? !!s.done[a.id] : a.cat === curCat));
        arr = arr.slice().sort((a, b) => (!!s.done[b.id] - !!s.done[a.id]) || 0);
        const cur = s.title;
        back.querySelector('.list').innerHTML = arr.map(a => {
            const d = !!s.done[a.id], hide = a.hidden && !d, p = progOf(a, X);
            const desc = hide ? '？？？（条件は達成するまで伏せられています）' : a.desc;
            const rw = hide ? '' : (a.rewardText || ((a.reward && a.reward.title ? '称号「' + a.reward.title + '」' : '') + (a.reward && a.reward.items ? itemText(a.reward.items) : '')));
            const bar = (!d && !hide && p && p[1] > 0) ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, p[0] / p[1] * 100)) + '%"></i></div><div class="ds">' + Math.min(p[0], p[1]).toLocaleString() + ' / ' + p[1].toLocaleString() + '</div>' : '';
            const eq = (d && a.reward && a.reward.title) ? '<button type="button" class="eq' + (cur === a.id ? ' on' : '') + '" data-id="' + a.id + '">' + (cur === a.id ? '✔ 装備中の称号' : '称号を装備') + '</button>' : '';
            return '<div class="row' + (d ? ' done' : '') + '"><div class="nm">' + (d ? '🏆 ' : '🔒 ') + esc(hide ? '？？？' : a.name) + '</div><div class="ds">' + esc(desc) + '</div>' + (rw ? '<div class="rw">報酬：' + esc(rw) + '</div>' : '') + bar + eq + '</div>';
        }).join('') || '<div class="ds">まだありません</div>';
        back.querySelectorAll('.list .eq').forEach(b => b.addEventListener('click', () => { const id = b.getAttribute('data-id'); setTitle(s.title === id ? null : id); render(); }));
        const dn = ACH.filter(a => s.done[a.id]).length;
        back.querySelector('.ft').textContent = '達成 ' + dn + ' / ' + ACH.length + '　装備中の称号：' + (titleText() || 'なし') + (s.pending.length && IN_STAGE ? '　（報酬は町で受け取れます）' : '');
    }
    function itemText(it) { const t = []; if (it.slot) t.push('宝珠の拡張石×' + it.slot); if (it.rarity) t.push('昇華の結晶×' + it.rarity); if (it.reroll) t.push('混沌の宝珠×' + it.reroll); return t.length ? '／' + t.join('・') : ''; }

    // ---------- ログイン日数と、0:00ちょうどの判定（サーバーの時刻を使う。端末の時計を変えてもごまかせない）----------
    function checkLogin() {
        fetch('/api/time', { cache: 'no-store' }).then(r => r.json()).then(j => {
            const jst = new Date((j.now | 0) + 9 * 3600 * 1000), day = jst.getUTCFullYear() + '-' + (jst.getUTCMonth() + 1) + '-' + jst.getUTCDate();
            const s = load();
            if (s.loginDay !== day) { s.loginDay = day; report('login'); }
            if (jst.getUTCHours() === 0 && jst.getUTCMinutes() === 0) {
                if (s.midnightDay !== day) { s.midnightDay = day; report('midnight'); }
            }
            flush(); evaluate();
        }).catch(() => { /* 時刻が取れないときは判定しない */ });
    }

    function mount() {
        ensureStyle();
        const btn = document.getElementById('achBtn');
        if (btn) btn.addEventListener('click', openPanel);
        else if (!IN_STAGE && document.getElementById('seasonBtn') == null) {
            const b = document.createElement('button'); b.id = 'achBtn'; b.type = 'button'; b.textContent = '🎖️'; b.setAttribute('aria-label', '実績・称号');
            b.style.cssText = 'position:fixed;right:10px;top:64px;z-index:60;width:40px;height:40px;border-radius:50%;border:1px solid #ffd86a;background:rgba(20,15,40,.85);color:#fff;font-size:1.2rem;cursor:pointer';
            b.addEventListener('click', openPanel); document.body.appendChild(b);
        }
        if (!IN_STAGE) setTimeout(() => { claim(); }, 1200);
        setTimeout(() => { checkLogin(); evaluate(); }, IN_STAGE ? 1500 : 800);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

    window.SBAch = { ACH: ACH, report: report, evaluate: evaluate, claim: claim, open: openPanel, titleText: titleText, isTitleText: isTitleText, setTitle: setTitle, earnedTitles: earnedTitles, TITLE_SET: TITLE_SET, count: () => ACH.length };
})();
