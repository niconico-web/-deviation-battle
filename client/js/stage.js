// ============================================================
// ステージ・エンジン (stage.js)
//  ・町(ロビー)から飛んできて「ダンジョン1つ＋ボス1体」を約5分で攻略する
//  ・敵に触れても画面遷移はしない。フィールド上でそのまま攻撃して戦う
//  ・最大4人の協力プレイ（ホストが敵を動かし、他の人は同期された状態を見る）
//  ・装備は hw-weapons.js のハクスラ武器（オーブをはめ込んで強化）
//  ・クイズに正解するとエネルギーが溜まり、Qキーでバースト（全周囲攻撃＋回復）
// ============================================================
(function () {
    'use strict';

    // 画面の向き：スマホは横画面で遊ぶ（縦のときは「横にしてね」案内を出して一時停止する）
    if (window.SBOrientation) SBOrientation.guard();

    // ---------- 起動パラメータ ----------
    let launch = null;
    try { launch = JSON.parse(localStorage.getItem('sbStageLaunch') || 'null'); } catch (e) { launch = null; }
    const stage = launch && window.getStageById ? window.getStageById(launch.stageId) : null;
    try { localStorage.removeItem('studyTimerState'); } catch (e) {}   // ステージに入ったら勉強タイマーは0に戻る（保険）
    const pdata = (typeof getPlayerData === 'function') ? getPlayerData() : null;
    if (!stage || !pdata) {
        alert('ステージ情報かキャラクターデータが見つかりません。町に戻ります。');
        location.href = 'index.html';
        return;
    }
    const hack = HW.load();
    const weapon = HW.getEquipped(hack);
    const agg = HW.aggregate(weapon);
    try { if (window.SBArmor) SBArmor.merge(agg, hack); } catch (e) { /* 防具が読めなくても戦える */ }
    const A = k => agg.stats[k] || 0;
    const AB = k => !!(agg.flags && agg.flags[k]);     // Tier4オーブの固有能力のうち、特別な処理が要るもの（hw-weapons.js の ORB_ABILITY_MAP）
    const T = HW.TYPES[weapon.type] || HW.TYPES.sword;

    // ---------- 定数 ----------
    const PVP = !!stage.pvp;                                  // オンラインマッチ（アクション対戦）
    const DBG = (launch && launch.debug && typeof launch.debug === 'object') ? launch.debug : null;   // デバッグ戦闘（debug.js）：報酬・クリア記録なし。god=無敵 / energy=エネルギー無限 / hp=ボスHP倍率 / cores=核の数
    const RUSH_ON = !!stage.rush;                              // ボスラッシュ（フェーズ制のボス連戦）
    const CORR_ON = !!stage.corridor;                          // 無限回廊（迷路のダンジョン）
    const TEAM = stage.pvpTeam || 0;                          // チーム戦（2v2 / 3v3）なら1チームの人数。0＝乱戦
    let teamMap = {};                                         // 選手ID → チーム(0=青 / 1=赤)。出発の瞬間に、部屋の参加順で交互に決める
    const sameTeam = (id) => !!TEAM && teamMap[id] !== undefined && teamMap[id] === teamMap[myId];
    let WORLD_W = PVP ? 1500 : (RUSH_ON ? 1700 : 2400), WORLD_H = PVP ? 1000 : (RUSH_ON ? 1100 : 1600);   // ボスラッシュは弾幕が避けやすい広さに。無限回廊は階層ごとに変わる
    const MAX_PARTY = 4;
    const TIME_LIMIT = PVP ? 180 : (CORR_ON ? Infinity : (RUSH_ON ? 99 * 60 : (stage.standardOnly ? 25 * 60 : 9 * 60)));   // ボスラッシュは全体ではなく「1フェーズごと」の制限時間（難易度で決まる）。無限回廊は無制限   // 時間切れ（スタンダードワールドは長丁場）
    const KILLS_BASE = 75;               // ボス出現に必要な討伐数（1人）。敵が弱く数が多いぶん、以前（45）より多め
    const ENEMY_CAP_BASE = 50;           // 同時に出る敵の数の上限（以前は30）
    const MOB_HP_MUL = 0.6, MOB_DMG_MUL = 0.85, MOB_GROUP_MUL = 1.5;   // 雑魚の体力・攻撃は下げ、1グループの数を増やす（爽快感のため。精鋭とボスは変えない）
    // 通常攻撃もエネルギーを使う：1秒ぶん連打したときの消費量（武器の攻撃間隔に比例。重い武器ほど1振りが高い）
    const ATK_ENERGY_PER_SEC = 4;
    // 溜め（詠唱）：この形のスキルは、ボタンを押してから発動までこの秒数のあいだ動けない（攻撃・ダッシュ・ほかのスキルもできない）。スタンされると中断
    const CHARGE_SEC = { laser: 0.8, barrage: 1.2, domain: 1.5, summon: 1.2 };
    const CHARGE_NAME = { laser: 'レーザー', barrage: '包囲弾幕', domain: '結界（領域）', summon: 'ミニオン召喚' };
    // 守りの溜め：ボタンを押し続けて GUARD_CHARGE 秒溜めると、GUARD_SEC 秒のあいだ相手の攻撃を完全に防ぐバリアが張れる（そのあいだ動ける）。使ったあとは GUARD_CD 秒使えない
    const GUARD_CHARGE = 3, GUARD_SEC = 3, GUARD_CD = 15;
    const START_ENERGY = 40;       // 開始時のエネルギー（0だと最初の攻撃ができないため）
    let ENERGY_MAX = 100;          // 特殊ステータスで上限が増える（下の P を作った直後に決める）
    const SNAP_HZ = 16;
    // ボスの技（boss-moves.js）とスタン
    const BM = window.BOSS_MOVES || null;
    const STUN_SEC = (BM && BM.STUN_SECONDS) || 3.0;     // スタンの長さ（動けない・攻撃も回避もできない）
    const STUN_IMM = (BM && BM.STUN_IMMUNE) || 3.5;      // スタンから復帰したあとの耐性時間（連続スタン防止）
    const PVP_STUN_MAX = 0.6;                            // 対人戦：プレイヤーへのスタンの長さの上限（秒）。ステージ（ボス戦）では STUN_SEC のまま
    const PVP_STUN_IMM = 1.2;                            // 対人戦：スタンから復帰したあとの耐性時間（秒）
    let PW = stage.power || { hp: 1, dmg: 1, spd: 1 };  // 第二世界など、ステージごとの敵の強化倍率

    // ---------- 乱数・ユーティリティ ----------
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
    function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

    // ---------- 難易度 ----------
    const CORR_DIFF = { name: '無限回廊', hp: 1.0, dmg: 1.0, spd: 1.0, elite: 0.22, luck: 0.9, healRed: 0 };
    const DIFFS = RUSH_ON ? window.STAGE_DATA.RUSH_DIFFS : (CORR_ON ? [CORR_DIFF] : window.STAGE_DATA.DIFFS);
    let DIFF = DIFFS[Math.max(0, Math.min(DIFFS.length - 1, parseInt(launch.diff, 10) || 0))];

    // ---------- プレイヤーの戦闘ステータス ----------
    let base = { maxHp: 50, atk: 70, def: 50, speed: 30, special: 50 };
    try { const s = getStatsFromPlayer(pdata, true); if (s) base = Object.assign(base, s); } catch (e) { /* 既定値のまま */ }
    const P = {
        maxHp: Math.max(10, Math.round((100 + base.maxHp * 2) * Math.max(0.2, 1 + A('hpPct')) * (A('hpHalf') > 0 ? 0.5 : 1))),      // 脆き砲台：最大HPの上限が50%で固定
        atkMul: (0.6 + base.atk / 150) * Math.max(0.2, 1 + A('atkPct')),
        def: base.def * (1 + A('defPct')),
        move: 235 * (1 + Math.min(base.speed, 300) / 700) * Math.max(0.35, 1 + A('moveSpd')),
        special: base.special,
        cd: T.cd / Math.max(0.3, 1 + A('aspd')),
        range: (T.range || 0) * (1 + A('rangePct')),
        radius: (T.radius || 0) * (1 + A('rangePct')),
        crit: 0.05 + A('critRate') + (T.crit || 0),
        critMul: 1.5 + A('critDmg'),
        dashCd: 1.6 * (1 - Math.min(0.6, A('dashCdr'))),
        energyMul: Math.max(0.2, 1 + A('energyUp'))
    };
    // 状況で変わる攻撃力の倍率：狂戦士（HPが半分を超えると-25%／以下で+）・孤高（仲間がいると-30%／ソロで+）
    function atkDyn() {
        let m = 1; const b = A('berserk'), lw = A('loneWolf');
        if (b > 0) m *= (me.hp / me.maxHp <= 0.5 ? 1 + b : 0.75);
        if (lw > 0) m *= (partyCount() > 1 ? 0.7 : 1 + lw);
        return m;
    }
    // 特殊ステータスが高いほど、エネルギーの上限が増える（特殊50で100、倍になるごとに+30）。上限が大きいぶん溜まる量も少し増やす
    ENERGY_MAX = Math.round(100 + 30 * Math.log2(Math.max(1, base.special / 50)));
    P.energyMul *= Math.sqrt(ENERGY_MAX / 100);

    // ---------- 属性（elements.js）----------
    //  命中ダメージ × 属性倍率 が「属性ダメージ」として上乗せされる。弱点×1.6／耐性×0.5。属性ごとに命中時の効果（バトルスタイル）が違う
    const SE = window.SBElem || null;
    const WEL = SE ? (weapon.elems || []).filter(id => SE.ELEMS[id]) : [];     // 装備中の武器の属性
    const ELPTS = SE ? SE.getPts(hack) : {};
    function elemStyle(e, dmg, id, o) {
        const st = o.st || (o.st = {}), a = Math.atan2(e.y - me.y, e.x - me.x), ch = p => Math.random() < p;
        const chain = (n, mul, rad) => { let c = 0; enemies.forEach(x => { if (x !== e && x.hp > 0 && !x.pvp && c < n && dist(x.x, x.y, e.x, e.y) < rad) { c++; fx.push({ k: 'line', x: e.x, y: e.y, x2: x.x, y2: x.y, t: 0.2, life: 0.2, c: SE.ELEMS[id].color }); dealHit(x, dmg * mul, { el: [] }); } }); };
        const splash = (mul, rad) => { fx.push({ k: 'ring', x: e.x, y: e.y, r: 0, max: rad, t: 0.3, life: 0.3, c: SE.ELEMS[id].color, fill: true }); enemies.forEach(x => { if (x !== e && x.hp > 0 && !x.pvp && dist(x.x, x.y, e.x, e.y) < rad) dealHit(x, dmg * mul, { el: [] }); }); };
        const push = k => { o.kx = (o.kx || 0) + Math.cos(a) * k; o.ky = (o.ky || 0) + Math.sin(a) * k; };
        switch (id) {
            case 'fire': if (ch(0.35)) st.burn = Math.max(st.burn || 0, dmg * 0.3); break;
            case 'water': if (ch(0.5)) st.slow = 1; break;
            case 'wind': push(90); if (ch(0.2)) me.haste = Math.max(me.haste || 0, 1.2); break;
            case 'earth': if (ch(0.1)) st.stun = 1; break;
            case 'thunder': if (ch(0.3)) chain(2, 0.5, 190); break;
            case 'steam': if (ch(0.35)) st.weaken = 1; break;
            case 'blast': if (ch(0.25)) splash(0.4, 100); break;
            case 'lava': if (ch(0.3)) { st.burn = Math.max(st.burn || 0, dmg * 0.3); st.curse = 1; } break;
            case 'plasma': if (ch(0.2)) { o.add = (o.add || 0) + dmg * 0.6; fx.push({ k: 'ring', x: e.x, y: e.y, r: 0, max: 40, t: 0.25, life: 0.25, c: '#ff7aff', fill: true }); } break;
            case 'ice': if (ch(0.5)) st.slow = 1; if (ch(0.12)) st.stun = 1; break;
            case 'venom': if (ch(0.5)) st.poison = Math.max(st.poison || 0, dmg * 0.22); break;
            case 'sand': if (ch(0.4)) st.blind = 1; push(60); break;
            case 'storm': if (ch(0.25)) { chain(1, 0.5, 190); me.haste = Math.max(me.haste || 0, 1.2); } break;
            case 'discharge': if (ch(0.25)) splash(0.35, 150); break;
            case 'magnet': if (ch(0.35)) { push(-130); chain(1, 0.4, 190); } break;
        }
    }
    // 属性ダメージ（追加分）を返す。副作用として、命中時の効果を o に足す
    function elemHit(e, dmg, els, o) {
        const wk = SE.weakOf(e.def && e.def.name);
        let extra = 0, col = null;
        els.forEach(id => {
            const m = SE.ELEMS[id]; if (!m) return;
            const r = SE.ratio(id, ELPTS, P.special) * (1 + (A('elAtk:' + id) || 0) + (A('elAtkAll') || 0));
            const mul = wk.weak === id ? 1.6 : (wk.resist === id ? 0.5 : 1);
            extra += dmg * r * mul / els.length;
            col = col || m.color;
            elemStyle(e, dmg, id, o);
        });
        o.elc = col;
        return extra + (o.add || 0);
    }
    // 敵の強さの基準は「ステージのレベルだけ」で決まる固定値。プレイヤーの今のステータス・装備には合わせない。
    //  ・FIX_HP  : 敵の攻撃力の基準にする体力（敵のダメージ = 攻撃割合 × この値。防御・軽減は従来どおりプレイヤー側で効く）
    //  ・FIX_DPS : 敵のHPの基準にする火力（ステージの想定火力ぶんの秒数でHPが決まる）
    // 数字を変えたいときはこの2行だけ触ればよい。
    //  ステージごとの「推奨ステータス合計」(stage.req) に合わせて敵が強くなる（stage-data.js の STAT_REQ）。
    //  G_DMG: 敵HPの倍率（その合計の人の火力に合わせる） / G_HP: 敵の攻撃力の基準HPの倍率（その合計の人のHPに合わせる）
    //  最初のステージは従来どおり（倍率1）。最終ステージは推奨ステータス合計10万。武器は＋％なので、強さの主役はステータス合計。
    let G_DMG = stage.gDmg || 1, G_HP = stage.gHp || 1, G_MOB = stage.gMob || G_DMG;
    let FIX_HP = (250 + 40) * G_HP;
    let FIX_DPS = 28 * 1.18 * G_DMG;
    let REF_HP = FIX_HP;
    // ボスラッシュ（フェーズごと）・無限回廊（階層ごと／自分のステータスに合わせる）では、ステージの途中で敵の強さの基準が変わる。
    //  req : 推奨ステータス合計（敵の強さの基準）／ ilvl : 敵の足の速さなどに効くレベル／ pw : HP・攻撃・速さの倍率
    const SC = { ilvl: stage.ilvl, hpMul: stage.hpMul || 1, dmgMul: 1 };
    function applyScale(req, ilvl, pw) {
        const sc = window.STAGE_DATA.scaleOf(Math.max(250, req));
        G_DMG = sc.gDmg; G_HP = sc.gHp; G_MOB = sc.gMob;
        FIX_HP = (250 + 40) * G_HP; FIX_DPS = 28 * 1.18 * G_DMG; REF_HP = FIX_HP;
        SC.ilvl = ilvl; PW = pw || { hp: 1, dmg: 1, spd: 1 };
    }
    const RUSHD = window.STAGE_DATA.RUSH, CD = window.STAGE_DATA.CORRIDOR, RUSHD_EXTREME = window.STAGE_DATA.RUSH_DIFFS.length - 1;
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const RS = { ph: 0, st: 0, t: 0, limit: 0, inter: 0 };      // ボスラッシュの進行：ph=フェーズ(1〜6)、st=0待機/1戦闘中/2幕間、t=フェーズ開始からの秒、limit=制限秒、inter=幕間の残り秒
    const TILE = 22, CELL_T = 14;                                  // 無限回廊：1タイルの大きさ(px)／1区画の幅（タイル数。区画の中に部屋を1つ作り、区画どうしを通路でつなぐ＝トルネコの大冒険のような構造）
    const CF = { on: false, inBoss: false, floor: 1, seed: 0, cols: 0, rows: 0, tw: 0, th: 0, solid: null, open: null, rects: [], props: [], start: null, seen: null, flow: null, flowFor: -1, flows: null, gateT: 0, reqT: 0, rc: null, bend: null, big: null, mini: null, miniCtx: null, saved: null, exit: null, fade: 0, st: { chests: 0, mimics: 0, bosses: 0 } };
    // 戦利品の文脈：ボスラッシュ・無限回廊では、倒した敵ごとに「どのレベル・どの表から」ドロップを引くかが変わる（null ならステージ本来のもの）
    let LT = null;
    const L = () => LT || stage;
    // 撃破の報酬は、武器庫のデータを毎回読み書きすると重い（全武器の読み込み＋保存＋旧システムへの同期）。
    // 1回の撃破で10回近く保存していたのがボスラッシュのフリーズの原因だったので、撃破イベントの間はメモリ上の1つを使い回し、最後に1回だけ保存する
    let TX = null;
    const hwLoad = () => TX || HW.load();
    const hwSave = d => { if (!TX) HW.save(d); };
    // 無限回廊の「袋」：手に入れた武器・防具・素材・オーブ・特殊アイテムは、脱出ゲートから脱出するまで保存されない（死んだら全部失う）
    const BAG = { weapons: [], armors: [], accs: [], items: {}, mats: {}, orbs: [] };
    const myId = String(pdata.id || ('p' + Math.random().toString(36).slice(2, 8)));
    const myName = pdata.name || 'あなた';

    // ---------- キャンバス ----------
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let VW = 960, VH = 540, DPR = 1;
    function fit() {
        DPR = Math.min(2, window.devicePixelRatio || 1);
        VW = window.innerWidth; VH = window.innerHeight;
        canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
        canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
    }
    window.addEventListener('resize', fit); fit();

    // ---------- フィールド（障害物の岩）----------
    const rocks = [];
    (function genRocks() {
        if (RUSH_ON || CORR_ON) return;      // ボスラッシュは広い平地、無限回廊は迷路の壁だけ
        const r = seeded(hashStr(stage.id));
        for (let i = 0; i < 18; i++) {
            const x = 150 + r() * (WORLD_W - 300), y = 150 + r() * (WORLD_H - 300);
            if (dist(x, y, WORLD_W / 2, WORLD_H / 2) < 260 || dist(x, y, 220, WORLD_H / 2) < 200) continue;
            rocks.push({ x: x, y: y, r: 26 + r() * 38 });
        }
    })();
    // 移動を小さな歩幅（6px以下）に刻んで、1歩ごとに壁・岩から押し出す。
    // 1フレームで大きく動いたとき（ダッシュ・ノックバック・処理落ち）に、薄い壁の向こうへ一気に抜けてしまうのを防ぐ
    function moveSolid(o, dx, dy, rad) {
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6)), sx = dx / n, sy = dy / n;
        for (let i = 0; i < n; i++) { o.x += sx; o.y += sy; pushOutOfRocks(o, rad); }
    }
    function pushOutOfRocks(o, rad) {
        for (const k of rocks) {
            const d = dist(o.x, o.y, k.x, k.y), m = k.r + rad;
            if (d < m && d > 0.01) { o.x = k.x + (o.x - k.x) / d * m; o.y = k.y + (o.y - k.y) / d * m; }
        }
        if (CORR_ON) corrPushOut(o, rad);
        o.x = clamp(o.x, rad, WORLD_W - rad); o.y = clamp(o.y, rad, WORLD_H - rad);
    }

    // ---------- 状態 ----------
    const me = { id: myId, name: myName, x: 220 + rnd(-30, 30), y: WORLD_H / 2 + rnd(-60, 60), r: 15, hp: P.maxHp, maxHp: P.maxHp,
        ang: 0, atkCd: 0, dashCd: 0, dashT: 0, dashVX: 0, dashVY: 0, inv: 0, cast: null, gch: 0, ult: 0, ultT: 0, guardT: 0, guardCd: 0, gMsgT: 0, energy: START_ENERGY, shield: false, haste: 0, dead: false, reviveT: 0, lungeT: 0, combo: 0, stunT: 0, stunImm: 0, invHard: 0 };
    const allies = {};           // id -> {id,name,x,y,tx,ty,hp,maxHp,dead,ang,rar}
    let enemies = [];            // ホスト: 実体 / クライアント: スナップショットの描画用
    let eBullets = [];
    let telegraphs = [];
    let myShots = [];            // 自分の弾（命中判定は自分側でやる）
    let ghostShots = [];         // 他のプレイヤーが撃った弾（見た目だけ。命中判定は撃った本人の画面でやる）
    let fx = [];                 // 見た目の演出
    let minions = [];            // スキル「ミニオン召喚」の自分のミニオン。{ id, x, y, r, t, max, sid, idx, atkT, cc, base, hasDmg, eff, fx, c, ... }
    let remoteMinions = {};      // 他のプレイヤーのミニオン（見た目だけ）。{ プレイヤーID: { l: [[x,y,r,残り秒]...], c, at } }
    let minionSendT = 0, hadMinions = false, auraT = 0, minionSeq = 0;
    // ---------- 対人戦のサドンデス ----------
    //  開始から SD.start 秒までは通常。そのあと SD.full 秒にかけて、攻撃力は 1→(1+SD.atk)倍まで上がり続け（時間切れまで止まらない）、
    //  防御力（ダメージ軽減）と回復系の効果は 0 に向かって下がっていく。時間切れは「総合ダメージ量」が多い方の勝ち
    const SD = { start: 40, full: 160, atk: 0.03 /* 1秒ごとの攻撃力の上昇 */, healMin: 0.1 /* 回復の効きの下限（サドンデス最終盤でも1割は残る） */ };
    function sdOn() { return PVP && run.phase === 'run'; }
    function sdProg() { return sdOn() ? clamp((run.time - SD.start) / (SD.full - SD.start), 0, 1) : 0; }       // 0〜1（防御・回復の低下の進み具合）
    function sdAtkMul() { return sdOn() ? 1 + SD.atk * Math.max(0, run.time - SD.start) : 1; }                  // 攻撃力の倍率（上限なし）
    function sdDefMul() { return 1 - sdProg(); }                                                                // 防御力（ダメージ軽減）の効き目
    // 回復系の効果の倍率：難易度（ナイトメア50%・エクストリーム75%低下）と、対人戦のサドンデスの両方がかかる
    function healMul() { if (A('noHeal') > 0) return 0; return Math.max(0, 1 - (DIFF.healRed || 0) - A('healDown')) * (sdOn() ? Math.max(SD.healMin, 1 - sdProg()) : 1); }      // 渇望：回復不可／血鎧：回復-50%
    function addHp(v) { v = v * healMul(); if (v <= 0 || me.dead) return 0; const before = me.hp; me.hp = Math.min(me.maxHp, me.hp + v); return me.hp - before; }
    let domains = [];            // スキル「領域」。{ id, x, y, r, t, max, own, fx(味方に効く自己強化), ... }
    let popups = [];
    let nextId = 1;
    const run = { phase: 'wait', time: 0, kills: 0, need: KILLS_BASE, bossSpawned: false, bossDead: false, ended: false,
        stats: { kills: 0, dmg: 0, loot: [], coins: 0, orbs: 0, mats: {} } };
    let isHost = true, room = null, socket = null;
    let spawnT = 1.5, snapT = 0, posT = 0, posSeq = 0, snapSeq = 0, lastSnapQ = -1, lastSnapAt = 0, snapAge = 0;
    let lastHt = null;      // 直前のスナップショットのホスト側の時刻（ms）
    let snapBytes = 0, netPing = -1, netPingT = 0, netPingBusy = false;      // 直近のスナップショットの大きさ／通信の遅れ（ms）
    const posLast = { x: 0, y: 0, t: performance.now() };

    // ---------- ネットワーク ----------
    function netSend(t, d) { if (socket && room) socket.emit('stage:relay', { t: t, d: d }); }
    function partyCount() { return 1 + Object.keys(allies).length; }
    function partyScale() { return 1 + 0.65 * (partyCount() - 1); }

    function setupNet() {
        if (typeof io !== 'function') return false;
        socket = io({ transports: ['websocket', 'polling'], reconnectionDelay: 500, reconnectionDelayMax: 3000 });      // 最初から WebSocket で接続する（既定の polling 始まりだと、回線によっては切り替わらず重いままになる）
        socket.on('connect', () => {
            netPingT = 0;
            const payload = { player: { id: myId, name: myName, wname: weapon.name, rar: weapon.rarity }, stageId: stage.id, diff: parseInt(launch.diff, 10) || 0 };
            if (launch.mode === 'create') socket.emit('stage:create', payload);
            else if (launch.mode === 'join') socket.emit('stage:join', Object.assign({ roomId: launch.roomId }, payload));
            else socket.emit('stage:quick', payload);
        });
        socket.on('stage:room', onRoom);
        socket.on('stage:error', (m) => { showWaitMsg((m && m.message) || 'ルームに入れませんでした'); setTimeout(() => { location.href = 'index.html'; }, 1800); });
        socket.on('stage:started', () => { if (run.phase === 'wait') beginRun(); });
        socket.on('stage:msg', onMsg);
        return true;
    }

    // ホストが抜けたとき：最後に受け取った敵の状態を引き継いで、自分が敵を動かす側になる
    function adoptEnemies() {
        enemies = enemies.map(e => {
            const def = e.boss ? { name: stage.boss.name, icon: stage.boss.icon, color: stage.boss.color, arch: 'chaser' }
                : (CORR_ON ? (CD.mobs.find(d => d.name === e.def.name) || (e.def.name === CD.mimic.name ? CD.mimic : CD.mobs[0])) : (stage.enemies.find(d => d.name === e.def.name) || stage.enemies[0]));
            const st = enemyStats(def, e.boss, e.elite);
            return { id: e.id, def: def, arch: def.arch, boss: e.boss, elite: !!e.elite, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, dmg: st.dmg, spd: st.spd, r: e.r,
                t: 0, state: 0, st: { burn: 0, burnT: 0, poison: 0, poisonT: 0, slowT: 0, stunT: 0, bleed: 0, bleedT: 0, curseT: 0, weakenT: 0, blindT: 0 }, kx: 0, ky: 0, aim: 0, fuse: 0, patIdx: 0, enraged: e.hp / e.maxHp < 0.5, air: 0, mv: null };
        });
        telegraphs = [];   // 受け取った予告範囲は威力を持たないので、ホスト交代時は破棄する
        eBullets.forEach(b => { b.vx = 0; b.vy = 0; b.life = 0; });
        nextId = 100000 + Math.floor(Math.random() * 100000);
        announce('ホストが交代しました', 1600);
    }

    function onRoom(r) {
        room = r;
        DIFF = DIFFS[Math.max(0, Math.min(DIFFS.length - 1, r.diff | 0))];
        el('stageName').textContent = stage.icon + ' ' + stage.name + ' [' + DIFF.name + ']';
        const wasHost = isHost;
        isHost = r.hostId === myId;
        if (!wasHost && isHost && run.phase === 'run') adoptEnemies();
        const ids = r.members.map(m => m.id);
        r.members.forEach(m => { if (m.id !== myId && !allies[m.id]) allies[m.id] = { id: m.id, name: m.name, x: 220, y: WORLD_H / 2, tx: 220, ty: WORLD_H / 2, hp: 100, maxHp: 100, dead: false, ang: 0, rar: m.rar || 'normal', r: 15 }; });
        Object.keys(allies).forEach(id => { if (ids.indexOf(id) < 0) delete allies[id]; });
        if (run.phase === 'wait') renderWait();
        if (r.state === 'playing' && run.phase === 'wait') beginRun();
    }

    function onMsg(m) {
        if (!m || !m.t) return;
        const d = m.d || {};
        const a = allies[m.from];
        switch (m.t) {
            case 'pos':
                if (a && !(d.q < a.pq)) { a.pq = d.q; a.vx = clamp(+d.vx || 0, -900, 900); a.vy = clamp(+d.vy || 0, -900, 900); a.pt = performance.now(); if (d.tp) { a.x = d.x; a.y = d.y; a.vx = 0; a.vy = 0; } }
                if (a) { a.tx = d.x; a.ty = d.y; a.ang = d.a; a.hp = d.hp; a.maxHp = d.mh; a.dead = !!d.dead || !!a.esc; a.stun = !!d.st; a.g = !!d.g; if (d.tt > 0) a.tt = d.tt; if (typeof d.wt === 'string' && window.SBPix && SBPix.hasWeapon(d.wt)) a.wt = d.wt;
        if (typeof d.av === 'string' && d.av.length < 80 && window.SBPix && SBPix.cleanAvatar) a.av = SBPix.cleanAvatar(d.av);
        if (d.ti !== undefined) a.ti = (window.SBAch && SBAch.isTitleText(d.ti)) ? d.ti : ''; }
                break;
            case 'esc':     // 無限回廊：仲間が脱出した（倒れた扱いにして、敵に狙われないようにする）
                if (a) { a.esc = true; a.dead = true; popups.push({ x: a.x, y: a.y - 30, t: 1.6, text: '脱出！', c: '#9fe8ff', big: true }); }
                break;
            case 'creq':    // 無限回廊：クライアントからの「階段に着いた／ボス部屋の入口に入った／出口に着いた」
                if (CORR_ON && isHost && run.phase === 'run' && d) corrAsk(String(d.k), d.i | 0);
                break;
            case 'cuse':    // 無限回廊：仲間が回復の泉を使った
                if (CORR_ON && d) { const q = corrProp(d.i | 0); if (q && q.k === 'spring') q.k = 'spring_done'; }
                break;
            case 'cho':     // 無限回廊：仲間が宝箱を開けた（中身は開けた人のもの）
                if (CORR_ON && d) { const q = corrProp(d.i | 0); if (q && q.k === 'chest') { q.k = 'open'; fx.push({ k: 'ring', x: q.x, y: q.y, r: 0, max: 60, t: 0.4, life: 0.4, c: '#ffd84a' }); } }
                break;
            case 'cmim':    // 無限回廊：宝箱がミミックだった（ホストが敵として出す）
                if (CORR_ON && d) { const q = corrProp(d.i | 0); if (q) { CF.props = CF.props.filter(x => x !== q); popups.push({ x: q.x, y: q.y - 30, t: 1.4, text: 'ミミックだ！', c: '#ff6a5a', big: true }); } }
                break;
            case 'atk':
                if (a) { spawnAtkFx(d); a.swingAt = performance.now(); a.swingDir = d.dir || 1; a.swingFin = d.fin; a.swingKind = d.k === 'line' ? 'line' : (d.k === 'proj' ? 'proj' : ((d.k === 'smash' || d.k === 'ring') ? 'smash' : 'cone')); }
                break;
            case 'shot':   // 他のプレイヤーの弾：見た目だけを出す（ダメージは撃った人の画面で計算される）
                if (a && d && Array.isArray(d.s)) d.s.slice(0, 12).forEach(q => {
                    const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
                    ghostShots.push({ x: num(q.x), y: num(q.y), vx: clamp(num(q.vx), -1500, 1500), vy: clamp(num(q.vy), -1500, 1500), r: clamp(num(q.r) || 8, 2, 40),
                        life: clamp(num(q.life) || 0.8, 0.05, 3), c: typeof q.c === 'string' && q.c.length <= 9 ? q.c : '#ffffff', pierce: clamp(Math.round(num(q.pierce)), 0, 9), aoe: clamp(num(q.aoe), 0, 200) });
                });
                break;
            case 'hit':
                if (isHost) applyHit(d);
                break;
            case 'bhit':
                if (isHost) eBullets = eBullets.filter(b => b.id !== d.id);
                break;
            case 'mn':      // 他のプレイヤーのミニオン（位置・向き・攻撃の動作）。対人戦では、相手チームのものは赤く表示する
                if (a && d && Array.isArray(d.l)) {
                    const nowMs = performance.now(), prev = remoteMinions[m.from], list = d.l.slice(0, 12);
                    if (prev && d.q != null && prev.q != null && d.q <= prev.q && d.q > prev.q - 50) break;      // 古い・順番が入れ替わった更新は捨てる
                    const dtM = prev ? clamp((nowMs - prev.at) / 1000, 0.03, 0.5) : 0.1;
                    remoteMinions[m.from] = {
                        q: d.q, at: nowMs, c: String(d.c || '#9df0ff').slice(0, 9),
                        l: list.map((q, k) => {
                            const tx = clamp(Number(q[0]) || 0, 0, WORLD_W), ty = clamp(Number(q[1]) || 0, 0, WORLD_H), o = prev && prev.l[k];      // 番号 k が同じものを同じミニオンとみなす
                            let vx = 0, vy = 0, x = tx, y = ty;
                            if (o) { x = o.x; y = o.y; vx = clamp((tx - o.tx) / dtM, -700, 700); vy = clamp((ty - o.ty) / dtM, -700, 700); if (Math.hypot(tx - o.tx, ty - o.ty) > 260) { x = tx; y = ty; vx = vy = 0; } }
                            return { x: x, y: y, tx: tx, ty: ty, vx: vx, vy: vy, r: clamp(Number(q[2]) || 14, 6, 40), t: Number(q[3]) || 0, face: Number(q[4]) || 0, lunge: Number(q[5]) ? 0.15 : (o ? Math.max(0, o.lunge - dtM) : 0) };
                        })
                    };
                }
                break;
            case 'dom':     // 他のプレイヤーのスキル「領域」：自分の画面にも領域を描く。味方のものは中にいる間だけ回復・バフが効く（対人戦の相手チームのものは、赤い見た目だけ）
                if (d && d.from !== myId && domains.length < 16) {
                    const foe = !!(PVP && run.pvpMode && !sameTeam(d.from));
                    const dr = clamp(Number(d.r) || 0, 0, 900), dt0 = clamp(Number(d.t) || 6, 0, 20);
                    const o = { id: String(d.id), x: Number(d.x) || 0, y: Number(d.y) || 0, r: dr, t: dt0, max: dt0, own: false, foe: foe, fx: foe ? [] : (Array.isArray(d.fx) ? d.fx : []).filter(k => SELF_FX.indexOf(k) >= 0), c: foe ? '#ff5a5a' : String(d.c || '#7aff9a').slice(0, 9) };
                    domains = domains.filter(x => x.id !== o.id);     // 同じ領域の重複を防ぐ
                    spawnDomain(o);
                }
                break;
            case 'sup':     // 味方の支援武器（回復・鼓舞）：範囲内にいる自分に効く
                if (d && d.from !== myId && (!(PVP && run.pvpMode) || sameTeam(d.from)) && dist(me.x, me.y, Number(d.x) || 0, Number(d.y) || 0) <= clamp(Number(d.r) || 0, 0, 320)) applySupport(d, false);   // 対人戦では、味方チームの回復・鼓舞だけが効く
                break;
            case 'refl':    // 他の人がスキルを発動：その人の周りの放射弾を跳ね返す（ホストが処理）
                if (isHost && GMK === 'dimension') hostReflect(Number(d.x) || 0, Number(d.y) || 0);
                break;
            case 'gm':
                if (!isHost) onGm(d);
                break;
            case 'snap':
                if (!isHost && !PVP) applySnap(d);
                break;
            case 'pvph':
                if (PVP && d.to === myId) hurtPvp(d.f, d.kx, d.ky, d.st, m.from);
                break;
            case 'pvpd':   // 誰かが誰かに与えた実ダメージ（最大HPに対する%）：時間切れの勝敗に使う
                if (PVP && d && d.by) tallyDmg(String(d.by).slice(0, 60), clamp(Number(d.p) || 0, 0, 100000));
                break;
            case 'kill':
                if (!isHost) onKillEvent(d);
                break;
            case 'boom':
                if (!isHost) onBoom(d);
                break;
            case 'announce':
                if (!isHost) announce(d.text, d.ms);
                break;
            case 'end':
                if (!isHost) finish(TEAM && d.winnerTeam !== undefined ? (d.winnerTeam >= 0 && d.winnerTeam === teamMap[myId]) : (PVP && d.winner !== undefined ? d.winner === myId : d.win), d);
                break;
            case 'sk':
                if (a) skillFx(d, a);
                break;
        }
    }

    // ---------- 入力 ----------
    const keys = {};
    const input = { mx: 0, my: 0, aimX: 0, aimY: 0, aimOn: false, mouseDown: false, touchAim: null, stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, aimStick: { id: null, ox: 0, oy: 0, x: 0, y: 0 } };
    const isTouch = matchMedia('(pointer: coarse)').matches;
    window.addEventListener('keydown', (e) => {
        if (e.repeat && ['Space'].indexOf(e.code) >= 0) return;
        keys[e.code] = true;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') doDash();
        const sk = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3 }[e.code]; if (sk !== undefined) castSkill(sk);
        if (e.code === 'Tab') { e.preventDefault(); toggleQuiz(); }
        if (e.code === 'KeyB' && !e.repeat) startGuard();
        if (e.code === 'KeyR' && !e.repeat) castUlt();
        if (e.code === 'KeyP' && !e.repeat && window.SBPix) { SBPix.setOn(!SBPix.on()); announce(SBPix.on() ? '🎨 ドット絵表示 ON' : '🎨 ドット絵表示 OFF（従来の表示）', 1400); }
        if (e.code === 'KeyG') { autoAim = !autoAim; try { localStorage.setItem('sbAutoAim', autoAim ? '1' : '0'); } catch (er) {} announce(autoAim ? '🎯 オートエイム ON（近くの敵を自動で狙う）' : '🎯 オートエイム OFF（マウスで狙う）', 1500); }
        if (/^Digit[1-4]$/.test(e.code)) quizPick(parseInt(e.code.slice(5), 10) - 1);
        if (e.code.indexOf('Arrow') === 0 || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyB') cancelGuard(); });
    canvas.addEventListener('mousemove', (e) => { input.aimX = e.clientX; input.aimY = e.clientY; input.aimOn = true; });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 2) { doDash(); return; } input.mouseDown = true; input.aimX = e.clientX; input.aimY = e.clientY; input.aimOn = true; });
    window.addEventListener('mouseup', () => { input.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // タッチ：左半分=移動スティック / 右半分=エイム＆攻撃スティック
    canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const left = e.clientX < VW / 2;
        const st = left ? input.stick : input.aimStick;
        if (st.id !== null) return;
        st.id = e.pointerId; st.ox = e.clientX; st.oy = e.clientY; st.x = 0; st.y = 0;
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
        [input.stick, input.aimStick].forEach(st => {
            if (st.id !== e.pointerId) return;
            let dx = e.clientX - st.ox, dy = e.clientY - st.oy;
            const l = Math.hypot(dx, dy), m = 56;
            if (l > m) { dx = dx / l * m; dy = dy / l * m; }
            st.x = dx / m; st.y = dy / m;
        });
    });
    const endPtr = (e) => { [input.stick, input.aimStick].forEach(st => { if (st.id === e.pointerId) { st.id = null; st.x = 0; st.y = 0; } }); };
    canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
    document.getElementById('btnDash').addEventListener('pointerdown', (e) => { e.preventDefault(); doDash(); });
    const btnU = document.getElementById('btnUlt');
    if (btnU) btnU.addEventListener('pointerdown', (e) => { e.preventDefault(); castUlt(); });
    const btnG = document.getElementById('btnGuard');
    if (btnG) { btnG.addEventListener('pointerdown', (e) => { e.preventDefault(); startGuard(); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btnG.addEventListener(ev, cancelGuard)); }

    // ---------- 敵生成（ホスト）----------
    // 敵の攻撃力は「基準HPに対する割合」で持つ（各プレイヤーが自分のHPに換算して受けるので、協力でも公平）
    function ed(e) { return (e.dmg || 0) * (e.dmgMul || 1) * (e.rage || 1); }
    function foeDmg(arch, isBoss, elite, noArch) {
        const a = noArch ? { atk: 1 } : (window.STAGE_DATA.ARCH[arch] || window.STAGE_DATA.ARCH.chaser);
        return Math.min(0.22, 0.075 + 0.0045 * SC.ilvl) * DIFF.dmg * a.atk * (isBoss ? 0.9 : 1) * (elite ? 1.4 : 1) * PW.dmg;
    }
    // S が渡されたとき（無限回廊）：この敵の「合計ステータス」S から、体力・攻撃を求める（S の割り当ては spawnEnemy が乱数で決める）。
    //  S が渡されないとき：従来どおり、ステージ全体の基準（G_*）から決める
    function enemyStats(def, isBoss, elite, S) {
        const ilvl = SC.ilvl;
        const a = window.STAGE_DATA.ARCH[def.arch] || window.STAGE_DATA.ARCH.chaser;
        const ps = partyScale();
        const sc = S ? window.STAGE_DATA.scaleOf(Math.max(250, S)) : null;
        const gMob = sc ? sc.gMob : G_MOB, gDmg = sc ? sc.gDmg : G_DMG, fixDps = sc ? 28 * 1.18 * sc.gDmg : FIX_DPS;
        const stageHp = 70 * 1.7 * gDmg, mobHp = 70 * 1.7 * gMob;
        let hp;
        if (isBoss) hp = Math.max(stageHp * 24, fixDps * 45) * SC.hpMul * DIFF.hp * ps * PW.hp;                 // 想定火力で最低45秒ぶん（固定）
        else hp = Math.max(mobHp, 28 * 1.18 * gMob * 1.8) * DIFF.hp * (sc ? 1 : a.hp) * ps * (elite ? 4.5 : (CORR_ON ? 1 : MOB_HP_MUL)) * PW.hp * (PW.mobHp || 1); // 雑魚も最低約2秒ぶん（固定）
        const refRatio = sc ? sc.gHp / G_HP : 1;      // 攻撃力は「基準HPに対する割合」なので、この敵の合計ステータスぶんの基準HPに換算する
        return {
            maxHp: Math.round(hp),
            dmg: foeDmg(def.arch, isBoss, elite, !!sc) * (isBoss || elite || CORR_ON ? 1 : MOB_DMG_MUL) * (isBoss ? SC.dmgMul : 1) * refRatio,
            spd: 118 * (sc ? 1 : a.spd) * (1 + ilvl * 0.015) * DIFF.spd * (elite ? 1.05 : 1) * PW.spd,
            r: (isBoss ? 46 : a.r) * (elite ? 1.3 : 1)
        };
    }
    // 無限回廊：敵の合計ステータス＝プレイヤー（パーティ平均）の合計 × 階層の倍率 × 敵の種類の倍率。それを5つのステータス（体力・攻撃・防御・速さ・特殊）にランダムに割り振る
    const CTYPE_MUL = { chaser: 1.25, swarm: 0.9, tank: 1.7, ranged: 1.1, bomber: 1.0, charger: 1.4 };      // 敵の種類ごとの倍率
    function corrTypeMul(def, isBoss, elite) { return isBoss ? 1 : (CTYPE_MUL[def.arch] || 1.2) * (elite ? 1.25 : 1); }
    function corrEnemyTotal(def, isBoss, elite, bossMul) { return corrPartyTotal() * corrMul(CF.floor) * corrTypeMul(def, isBoss, elite) * (bossMul || 1); }
    function corrShares() {      // 合計を5つに分けたときの、平均を1とした割合：[体力, 攻撃, 防御, 速さ, 特殊]
        const w = [0, 1, 2, 3, 4].map(() => 0.35 + Math.random() * 1.3), sum = w.reduce((x, y) => x + y, 0);
        return w.map(x => x / sum * 5);
    }
    function applyShares(e, sh) {
        e.sh = sh.map(v => Math.round(v * 100) / 100);
        const c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        e.maxHp = e.hp = Math.max(1, Math.round(e.maxHp * c(sh[0], 0.35, 2.2)));          // 体力
        e.dmg *= c(sh[1], 0.4, 2.0);                                                       // 攻撃（接触・弾・技の基本の強さ）
        e.takeMul = 1 / (0.55 + 0.45 * c(sh[2], 0.2, 2.6));                                // 防御：高いほど受けるダメージが減る
        e.spd *= 0.8 + 0.2 * c(sh[3], 0.2, 2.5);                                           // 速さ
        e.dmgMul = 0.75 + 0.25 * c(sh[4], 0.2, 2.5);                                       // 特殊（遠距離の弾・ボスの技の強さ）
    }

    function spawnEnemy(def, x, y, isBoss, elite, S) {
        const st = enemyStats(def, isBoss, elite, S);
        const e = { id: nextId++, def: def, arch: def.arch, boss: !!isBoss, elite: !!elite, x: x, y: y, hp: st.maxHp, maxHp: st.maxHp, dmg: st.dmg, spd: st.spd, r: st.r,
            t: rnd(0, 2), state: 0, st: { burn: 0, burnT: 0, poison: 0, poisonT: 0, slowT: 0, stunT: 0, bleed: 0, bleedT: 0, curseT: 0, weakenT: 0, blindT: 0 },
            kx: 0, ky: 0, aim: 0, fuse: 0, patIdx: 0, enraged: false, air: 0, mv: null };
        if (S) applyShares(e, corrShares());
        enemies.push(e);
        return e;
    }

    function spawnGroup() {
        const alive = alivePlayersPos();
        const c = alive[Math.floor(Math.random() * alive.length)] || { x: WORLD_W / 2, y: WORLD_H / 2 };
        const def = stage.enemies[Math.floor(Math.random() * stage.enemies.length)];
        const eliteAlive = enemies.filter(e => e.elite && e.hp > 0).length;
        const elite = def.arch !== 'swarm' && eliteAlive < 3 && Math.random() < DIFF.elite;
        const n = elite ? 1 : Math.round((def.arch === 'swarm' ? Math.floor(rnd(5, 9)) : (def.arch === 'tank' ? Math.floor(rnd(1, 3)) : Math.floor(rnd(3, 6)))) * MOB_GROUP_MUL);
        const ang = rnd(0, Math.PI * 2), d = rnd(480, 660);
        if (elite) announce('⚔ 精鋭が出現！', 1100);
        for (let i = 0; i < n; i++) {
            const x = clamp(c.x + Math.cos(ang) * d + rnd(-60, 60), 40, WORLD_W - 40), y = clamp(c.y + Math.sin(ang) * d + rnd(-60, 60), 40, WORLD_H - 40);
            const e = spawnEnemy(def, x, y, false, elite);
            pushOutOfRocks(e, e.r);
        }
    }

    function alivePlayersPos() {
        const out = [];
        if (!me.dead) out.push({ x: me.x, y: me.y, id: me.id });
        Object.keys(allies).forEach(id => { const a = allies[id]; if (!a.dead) out.push({ x: a.x, y: a.y, id: id }); });
        return out;
    }
    function nearestPlayer(x, y) {
        let best = null, bd = 1e9;
        alivePlayersPos().forEach(p => { const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } });
        return best;
    }

    function bullet(x, y, ang, spd, dmg, r, life, color, kd) {   // kd: 1 = 剣（ゲートキーパーの射出物）
        if (eBullets.length > 420) eBullets.splice(0, 60);      // 弾が増えすぎると処理が重くなり、画面が固まって見える。古い弾から消す
        eBullets.push({ id: nextId++, x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg: dmg, r: r || 7, life: life || 3.2, c: color || '#ff6a5a', kd: kd || 0 });
    }
    // 予告範囲。o で形を指定できる：{ sh:'cone'|'line'|'donut', a:向き, arc:角度, ri:内半径, w:幅, stun:スタン付き, rep/gap:持続ヒット }
    function telegraph(x, y, r, t, dmg, c, o) {
        const tg = { id: nextId++, x: x, y: y, r: r, t: t, max: t, dmg: dmg, c: c || '#ff5a5a' };
        if (o) Object.keys(o).forEach(k => { if (o[k] != null && o[k] !== false) tg[k] = o[k]; });
        telegraphs.push(tg);
    }

    // ---------- 敵AI（ホストだけが動かす）----------
    function updateEnemies(dt) {
        for (const e of enemies) {
            const s = e.st;
            if (CORR_ON && CF.on && !e.boss && !e.act && !corrWake(e)) continue;      // 無限回廊：近づくまで眠っている敵
            // 状態異常
            let dot = 0;
            if (s.burnT > 0) { s.burnT -= dt; dot += s.burn; }
            if (s.poisonT > 0) { s.poisonT -= dt; dot += s.poison; }
            if (s.bleedT > 0) { s.bleedT -= dt; dot += s.bleed; }
            if (s.curseT > 0) s.curseT -= dt;
            if (s.weakenT > 0) s.weakenT -= dt;
            if (s.blindT > 0) s.blindT -= dt;
            e.dmgMul = s.blindT > 0 ? 0.5 : (s.weakenT > 0 ? 0.65 : 1);
            if (dot > 0 && !e.inv) { e.hp -= dot * dt; if (e.hp <= 0) { killEnemy(e, null); continue; } }
            if (s.stunT > 0) { s.stunT -= dt; continue; }
            const slow = s.slowT > 0 ? 0.45 : 1; if (s.slowT > 0) s.slowT -= dt;
            e.t += dt;
            // ノックバック
            if (Math.abs(e.kx) + Math.abs(e.ky) > 1) { e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt); }
            const tgt = nearestPlayer(e.x, e.y);
            if (!tgt) continue;
            const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
            const sp = e.spd * slow;
            let mvx = dx / d, mvy = dy / d, los = true;
            if (CORR_ON && CF.on && !e.boss) { const w = corrWaypoint(e, tgt), wd = Math.hypot(w.x - e.x, w.y - e.y) || 1; mvx = (w.x - e.x) / wd; mvy = (w.y - e.y) / wd; los = corrLOS(e.x, e.y, tgt.x, tgt.y); }
            if (e.boss) { updateBoss(e, dt, tgt, d, ang, slow); }
            else if (e.arch === 'chaser' || e.arch === 'swarm' || e.arch === 'tank') { e.x += mvx * sp * dt; e.y += mvy * sp * dt; }
            else if (e.arch === 'ranged') {
                const want = (d > 320 || !los) ? 1 : (d < 200 ? -0.8 : 0);
                e.x += mvx * sp * dt * want;
                e.y += mvy * sp * dt * want;
                if (e.t > 1.5 && d < 640 && los) { e.t = rnd(0, 0.4); bullet(e.x, e.y, ang, 300, ed(e), 7, 3.4, e.def.color); if (e.elite) { bullet(e.x, e.y, ang + 0.22, 300, ed(e), 7, 3.4, e.def.color); bullet(e.x, e.y, ang - 0.22, 300, ed(e), 7, 3.4, e.def.color); } }
            } else if (e.arch === 'charger') {
                if (e.state === 0) { e.x += mvx * sp * dt; e.y += mvy * sp * dt; if (d < 340 && e.t > 1.4 && los) { e.state = 1; e.t = 0; e.aim = ang; } }
                else if (e.state === 1) { if (e.t > 0.7) { e.state = 2; e.t = 0; } }
                else { e.x += Math.cos(e.aim) * 540 * slow * dt; e.y += Math.sin(e.aim) * 540 * slow * dt; if (e.t > 0.55) { e.state = 0; e.t = -0.6; } }
            } else if (e.arch === 'bomber') {
                if (e.fuse > 0) { e.fuse -= dt; if (e.fuse <= 0) { boomAt(e.x, e.y, 85, ed(e) * 1.3, e.def.color); e.hp = 0; removeDead(e); } }
                else { e.x += mvx * sp * dt; e.y += mvy * sp * dt; if (d < 60 && los) e.fuse = 0.6; }
            }
            pushOutOfRocks(e, e.r);
        }
        enemies = enemies.filter(e => e.hp > 0);
    }
    function removeDead(e) { /* enemies配列のhp<=0は次のfilterで消える */ }

    // ボス：パターンを順番に使う
    function updateBoss(e, dt, tgt, d, ang, slow) {
        const hpR = e.hp / e.maxHp;
        if (!e.enraged && hpR < 0.5) { e.enraged = true; netAnnounce('ボスが激昂した！', 1800); }
        const pats = bdef(e).patterns, SET = setOf(e);
        // 歩行
        if (e.state === 0 && !bdef(e).stand) { const sp = e.spd * slow * (e.enraged ? 1.3 : 0.8); if (d > 150) { e.x += Math.cos(ang) * sp * dt; e.y += Math.sin(ang) * sp * dt; } }
        // 技セット(boss-moves.js)があるボスは技の合間を短めにして、技そのものの見せ場を増やす
        const cdMax = (SET ? (e.enraged ? 0.7 : 1.2) : (e.enraged ? 1.1 : 1.9)) / (DIFF.dmg > 1.5 ? 1.15 : 1);
        if (e.state === 0 && e.t > cdMax) {
            if (SET) { const md = pickMove(e); if (md) { startMove(e, md, ang); return; } }
            const pat = pats[e.patIdx % pats.length]; e.patIdx++; e.t = 0;
            const k = ed(e) * (e.enraged ? 1.15 : 1);
            if (pat === 'radial') { const n = e.enraged ? 26 : 18, off = rnd(0, 6.28); for (let i = 0; i < n; i++) bullet(e.x, e.y, off + i * Math.PI * 2 / n, 250, k, 8, 4, bdef(e).color); }
            else if (pat === 'volley') { const n = e.enraged ? 11 : 7; for (let i = 0; i < n; i++) bullet(e.x, e.y, ang + (i - (n - 1) / 2) * 0.17, 360, k, 8, 3.2, bdef(e).color); }
            else if (pat === 'slam') { const alive = alivePlayersPos(); alive.forEach(p => telegraph(p.x, p.y, 120, 1.2, k * 1.6, bdef(e).color)); telegraph(e.x, e.y, 150, 1.2, k * 1.4, bdef(e).color); }
            else if (pat === 'charge') { e.state = 1; e.aim = ang; e.t = 0; }
            else if (pat === 'summon') { const def = stage.enemies[0]; for (let i = 0; i < (e.enraged ? 6 : 4); i++) { const m = spawnEnemy(def, e.x + rnd(-120, 120), e.y + rnd(-120, 120), false); m.hp = m.maxHp = Math.round(m.maxHp * 0.7); } }
            else if (pat === 'spiral') { e.state = 3; e.t = 0; e.spin = 0; }
        } else if (e.state >= 10 && e.mv) { // 技の実行中
            runMove(e, dt);
        } else if (e.state === 1) { // 突進（予告0.6秒→突進0.7秒）
            if (e.t < 0.6) { /* 予告中：その場で構える */ } else if (e.t < 1.3) { e.x += Math.cos(e.aim) * 620 * dt; e.y += Math.sin(e.aim) * 620 * dt; } else { e.state = 0; e.t = 0; }
        } else if (e.state === 3) { // 渦巻き弾
            e.spin += dt * 9; if (Math.floor(e.t * 14) !== Math.floor((e.t - dt) * 14)) { bullet(e.x, e.y, e.spin, 240, ed(e) * 0.8, 7, 4, bdef(e).color); bullet(e.x, e.y, e.spin + Math.PI, 240, ed(e) * 0.8, 7, 4, bdef(e).color); }
            if (e.t > 2.2) { e.state = 0; e.t = 0; }
        }
    }

    // ---------- ボスの技エンジン（技の中身は boss-moves.js）----------
    // 技は「時刻つきステップ」の並び。ホストだけが実行し、範囲攻撃は予告(telegraph)→着弾(boom)で全員に伝わる。
    const BOSS_SET = (BM && BM.SETS && BM.SETS[stage.id]) || null;

    // ---------- ギミックボス（stage.boss.gimmick）----------
    //  stigma    : 死神。10秒ごとに全員へスティグマ。13個で死亡（HP75/50/25%を切るたびに4個浄化）
    //  pressure  : 炉心の巨人。25秒ごとに圧力が溜まり、安全弁を全部壊さないと大爆発
    //  gravity   : 重力喰らい。技「pull」で全員を中心へ引き寄せる
    //  twin      : ゼウス＆プロメテウス。片方を倒すと、15秒後に残った方が蘇らせる
    //  dimension : ディメンション・キーパー。6つの核（放射弾をスキルで跳ね返して破壊）→ 強化ゲートキーパー（歴代ラスボス召喚）
    const GMK = (stage.boss && stage.boss.gimmick) || null;
    let G = {};                      // ギミックの共有状態。ホストが管理し、スナップショットで全員へ配る
    let pullFx = null;               // 引き寄せ中 { x, y, t, f }
    let stgLastS = 0, stgLastC = 0;
    const STIGMA_MAX = 13, STIGMA_EVERY = 10, REFL_R = 210;
    const DK_ECHO = [['abyssal_rift', 0.80], ['rift_throne', 0.62], ['god_throne', 0.45], ['mech_throne', 0.30], ['void_throne', 0.15]];   // 歴代ラスボス（HPがこの割合を切るたびに1体ずつ）
    function bdef(e) { return (e && e.bd) || stage.boss; }
    function setOf(e) { return (e && e.bset) || BOSS_SET; }
    function pickMove(e) {
        const BOSS_SET = setOf(e);
        e.mvCount = (e.mvCount || 0) + 1;
        const every = e.enraged ? 3 : 4;                        // 4回に1回（激昂中は3回に1回）はスタン技
        // 大技：HPが ultAt の割合を切るたびに1回ずつ。激昂中は7回に1回も出す
        const ult = BOSS_SET.ult && BM.MOVES[BOSS_SET.ult];
        if (ult) {
            e.ultN = e.ultN || 0;
            if (e.ultN < BOSS_SET.ultAt.length && e.hp / e.maxHp < BOSS_SET.ultAt[e.ultN]) { e.ultN++; return ult; }
            if (e.enraged && e.mvCount % 7 === 0) return ult;
        }
        if (e.mvCount % every === 0 && BM.MOVES[BOSS_SET.stun]) return BM.MOVES[BOSS_SET.stun];
        const list = BOSS_SET.moves; e.mvIdx = e.mvIdx || 0;
        const m = BM.MOVES[list[e.mvIdx % list.length]]; e.mvIdx++;
        return m || null;
    }
    function startMove(e, def, ang) {
        e.state = 10; e.t = 0;
        e.mv = { def: def, t: 0, i: 0, ang: ang, act: null, wAng: null };
        if (def.ult) netAnnounce('💥 大技「' + def.name + '」', 2600);
        else netAnnounce((def.stun ? '⚡ ' : '⚔ ') + def.name + (def.stun ? '！　当たるとスタン' : ''), def.stun ? 1500 : 1000);
    }
    function endMove(e) {
        const rec = e.mv ? e.mv.def.rec : 0.5;
        e.mv = null; e.state = 0; e.air = 0; e.t = -rec;
    }
    function runMove(e, dt) {
        const m = e.mv;
        m.t += dt;
        const a = m.act;
        if (a) {
            a.el += dt;
            if (a.k === 'dash') {
                e.state = 11;
                e.x += Math.cos(a.ang) * a.spd * dt; e.y += Math.sin(a.ang) * a.spd * dt;
                e.x = clamp(e.x, 50, WORLD_W - 50); e.y = clamp(e.y, 50, WORLD_H - 50);
                if (a.el >= a.dur) { m.act = null; e.state = 10; }
            } else if (a.k === 'leap') {
                e.state = 12;
                const p = Math.min(1, a.el / a.dur);
                e.x = a.sx + (a.tx - a.sx) * p; e.y = a.sy + (a.ty - a.sy) * p;
                e.air = Math.sin(p * Math.PI) * 130;
                if (p >= 1) { m.act = null; e.air = 0; e.state = 10; }
            } else if (a.k === 'spiral') {
                a.spin += dt * 9; a.acc += dt;
                while (a.acc >= 1 / 14) {
                    a.acc -= 1 / 14;
                    for (let i = 0; i < a.arms; i++) bullet(e.x, e.y, a.spin + i * Math.PI * 2 / a.arms, a.spd, a.dmg, 7, 4, bdef(e).color);
                }
                if (a.el >= a.dur) m.act = null;
            }
        }
        const steps = m.def.steps;
        while (m.i < steps.length && steps[m.i].t <= m.t) { execStep(e, m, steps[m.i]); m.i++; }
        if (m.i >= steps.length && !m.act && m.t >= m.def.dur) endMove(e);
    }
    function execStep(e, m, s) {
        const en = e.enraged;
        const k = ed(e) * (en ? 1.15 : 1);
        const dmg = k * (s.dm || 0);
        const tm = en ? 0.85 : 1;                                   // 激昂中は予告が少し短い
        const c = s.stun ? '#ffd84a' : bdef(e).color;
        const aimNow = () => { const p = nearestPlayer(e.x, e.y); return p ? Math.atan2(p.y - e.y, p.x - e.x) : m.ang; };
        const ang = (s.aim === 'l' ? m.ang : aimNow()) + (s.off || 0) * Math.PI / 180;
        const shape = { stun: s.stun, rep: s.rep, gap: s.gap };
        switch (s.k) {
            case 'beamfan': {   // ボスから扇状に、細いビームを何本も撃つ
                const n = Math.max(1, s.n | 0);
                for (let i = 0; i < n; i++) telegraph(e.x, e.y, s.r, s.tele * tm, dmg, c, Object.assign({ sh: 'line', a: ang + (n > 1 ? (i - (n - 1) / 2) * (s.sp || 0) / (n - 1) : 0), w: s.w }, shape));
                break;
            }
            case 'beamAt': {    // アリーナ上の決まった位置（割合 fx,fy）から撃つビーム。track なら撃つ向きを標的に合わせる
                const x = s.fx * WORLD_W, y = s.fy * WORLD_H; let a = s.a;
                if (s.track) { const p = nearestPlayer(x, y); if (p) a = Math.atan2(p.y - y, p.x - x); }
                telegraph(x, y, s.r, s.tele * tm, dmg, c, Object.assign({ sh: 'line', a: a, w: s.w }, shape));
                break;
            }
            case 'blast': {     // 標的の周りに砲口を並べ、標的へ向けて撃つ（ガスターブラスター風）
                const al = alivePlayersPos(); if (!al.length) break;
                const tg = al[Math.floor(Math.random() * al.length)], n = Math.round(s.n * (en ? 1.15 : 1)), R = s.R || 440, off = rnd(0, 6.28);
                for (let i = 0; i < n; i++) {
                    const a0 = off + i * Math.PI * 2 / n, x = clamp(tg.x + Math.cos(a0) * R, 40, WORLD_W - 40), y = clamp(tg.y + Math.sin(a0) * R, 40, WORLD_H - 40);
                    telegraph(x, y, 40, s.tele * tm, 0, '#ffd36a', { sh: 'portal' });
                    telegraph(x, y, s.r, s.tele * tm, dmg, c, Object.assign({ sh: 'line', a: Math.atan2(tg.y - y, tg.x - x), w: s.w }, shape));
                }
                break;
            }
            case 'wall': {      // 画面を横切る弾の壁。隙間が1か所だけある
                const al = alivePlayersPos(); const tg = al.length ? al[Math.floor(Math.random() * al.length)] : { x: WORLD_W / 2, y: WORLD_H / 2 };
                const horiz = s.dir === 'h' || (s.dir === 'rand' && Math.random() < 0.5), gapW = (s.gapW || 190) * (en ? 0.92 : 1), sp = s.spd || 320, step = 30;
                if (horiz) {
                    const gx = clamp(tg.x + rnd(-260, 260), gapW, WORLD_W - gapW), fromTop = Math.random() < 0.5;
                    for (let x = 14; x < WORLD_W; x += step) if (Math.abs(x - gx) > gapW / 2) bullet(x, fromTop ? -10 : WORLD_H + 10, fromTop ? Math.PI / 2 : -Math.PI / 2, sp, dmg, 10, WORLD_H / sp + 0.8, c);
                } else {
                    const gy = clamp(tg.y + rnd(-200, 200), gapW, WORLD_H - gapW), fromLeft = Math.random() < 0.5;
                    for (let y = 14; y < WORLD_H; y += step) if (Math.abs(y - gy) > gapW / 2) bullet(fromLeft ? -10 : WORLD_W + 10, y, fromLeft ? 0 : Math.PI, sp, dmg, 10, WORLD_W / sp + 0.8, c);
                }
                break;
            }
            case 'cone': telegraph(e.x, e.y, s.r, s.tele * tm, dmg, c, Object.assign({ sh: 'cone', a: ang, arc: s.arc }, shape)); break;
            case 'line': telegraph(e.x, e.y, s.r, s.tele * tm, dmg, c, Object.assign({ sh: 'line', a: ang, w: s.w }, shape)); break;
            case 'warn': m.wAng = ang; telegraph(e.x, e.y, s.r, s.tele * tm, 0, '#ff9a5a', { sh: 'line', a: ang, w: s.w }); break;
            case 'ring': telegraph(e.x, e.y, s.r, s.tele * tm, dmg, c, shape); break;
            case 'donut': telegraph(e.x, e.y, s.r, s.tele * tm, dmg, c, Object.assign({ sh: 'donut', ri: s.ri }, shape)); break;
            case 'at': {
                const al = alivePlayersPos(); if (!al.length) break;
                const list = s.who === 'rand' ? [al[Math.floor(Math.random() * al.length)]] : al;
                list.forEach(p => telegraph(p.x, p.y, s.r, s.tele * tm, dmg, c, shape));
                break;
            }
            case 'rain': {
                const al = alivePlayersPos(); if (!al.length) break;
                const n = Math.round(s.n * (en ? 1.25 : 1));
                for (let i = 0; i < n; i++) {
                    const b = al[Math.floor(Math.random() * al.length)];
                    const x = i === 0 ? b.x : clamp(b.x + rnd(-380, 380), 40, WORLD_W - 40), y = i === 0 ? b.y : clamp(b.y + rnd(-300, 300), 40, WORLD_H - 40);
                    telegraph(x, y, s.r, s.tele * tm + i * (s.gap || 0.15), dmg, c, shape);
                }
                break;
            }
            case 'dash': {
                const da = (s.aim === 'l' ? m.ang : (m.wAng != null ? m.wAng : aimNow())) + (s.off || 0) * Math.PI / 180;
                m.act = { k: 'dash', el: 0, dur: s.dur, spd: s.spd, ang: da };
                break;
            }
            case 'leap': {
                const p = nearestPlayer(e.x, e.y); const tx = clamp(p ? p.x : e.x, 60, WORLD_W - 60), ty = clamp(p ? p.y : e.y, 60, WORLD_H - 60);
                telegraph(tx, ty, s.r, s.dur, dmg, c, shape);                 // 着地点を予告（着地の瞬間に爆発）
                m.act = { k: 'leap', el: 0, dur: s.dur, sx: e.x, sy: e.y, tx: tx, ty: ty };
                break;
            }
            case 'pull': {    // 全員を、ボスの足元へ引き寄せる（重力）
                gmPullStart(e.x, e.y, s.dur, s.force);
                netSend('gm', { k: 'pull', x: Math.round(e.x), y: Math.round(e.y), dur: s.dur, f: s.force });
                break;
            }
            case 'ports': {   // ゲートキーパー：標的の周りに「門」を開く
                const al = alivePlayersPos(); if (!al.length) break;
                const tg = al[Math.floor(Math.random() * al.length)];
                const n = Math.round(s.n * (en ? 1.2 : 1)), R = s.R || 420, list = [];
                const cl = (v, hi) => clamp(v, 40, hi - 40);
                if (s.mode === 'around') { const off = rnd(0, 6.28); for (let i = 0; i < n; i++) { const a0 = off + i * Math.PI * 2 / n, x = cl(tg.x + Math.cos(a0) * R, WORLD_W), y = cl(tg.y + Math.sin(a0) * R, WORLD_H); list.push({ x: x, y: y, a: Math.atan2(tg.y - y, tg.x - x) }); } }
                else if (s.mode === 'sky') { for (let i = 0; i < n; i++) list.push({ x: cl(tg.x + (i - (n - 1) / 2) * (s.gapX || 140) + rnd(-20, 20), WORLD_W), y: cl(tg.y - R, WORLD_H), a: Math.PI / 2 }); }
                else if (s.mode === 'side') { for (let i = 0; i < n; i++) { const left = i % 2 === 0; list.push({ x: cl(tg.x + (left ? -R : R), WORLD_W), y: cl(tg.y + (i - (n - 1) / 2) * (s.gapY || 170), WORLD_H), a: left ? 0 : Math.PI }); } }
                else if (s.mode === 'diag') { for (let i = 0; i < n; i++) { const a0 = (45 + 90 * i) * Math.PI / 180, x = cl(tg.x + Math.cos(a0) * R, WORLD_W), y = cl(tg.y + Math.sin(a0) * R, WORLD_H); list.push({ x: x, y: y, a: Math.atan2(tg.y - y, tg.x - x) }); } }
                list.forEach(p => telegraph(p.x, p.y, 46, s.life, 0, '#ffd36a', { sh: 'portal' }));
                m.ports = list;
                break;
            }
            case 'swords': {  // 開いている門から剣を撃つ
                const list = m.ports || [], al = alivePlayersPos();
                list.forEach(p => {
                    if (s.frac < 1 && Math.random() > s.frac) return;
                    let a = p.a;
                    if (s.track && al.length) { let best = al[0], bd = 1e9; al.forEach(q => { const dd = dist(p.x, p.y, q.x, q.y); if (dd < bd) { bd = dd; best = q; } }); a = Math.atan2(best.y - p.y, best.x - p.x); }
                    const per = s.per || 1;
                    for (let k = 0; k < per; k++) bullet(p.x, p.y, a + (per > 1 ? (k - (per - 1) / 2) * (s.sp || 0.12) : 0) + rnd(-0.03, 0.03), s.spd, dmg, 10, 3.8, '#ffe9a0', 1);
                });
                break;
            }
            case 'beams': {   // 開いている門からビームを撃つ（予告線→発射）
                const list = m.ports || [], al = alivePlayersPos();
                list.forEach(p => {
                    if (s.frac < 1 && Math.random() > s.frac) return;
                    let a = p.a;
                    if (s.track && al.length) { let best = al[0], bd = 1e9; al.forEach(q => { const dd = dist(p.x, p.y, q.x, q.y); if (dd < bd) { bd = dd; best = q; } }); a = Math.atan2(best.y - p.y, best.x - p.x); }
                    telegraph(p.x, p.y, s.r, s.tele * tm, dmg, '#fff2a0', Object.assign({ sh: 'line', a: a, w: s.w }, shape));
                });
                break;
            }
            case 'fan': { const n = Math.round(s.n * (en ? 1.3 : 1)); for (let i = 0; i < n; i++) bullet(e.x, e.y, ang + (i - (n - 1) / 2) * s.sp, s.spd, dmg, 8, 3.4, bdef(e).color); break; }
            case 'rad': { const n = Math.round(s.n * (en ? 1.3 : 1)), off = rnd(0, 6.28); for (let i = 0; i < n; i++) bullet(e.x, e.y, off + i * Math.PI * 2 / n, s.spd, dmg, 8, 4, bdef(e).color); break; }
            case 'spiral': m.act = { k: 'spiral', el: 0, dur: s.dur, spd: s.spd, arms: s.arms || 2, acc: 0, spin: rnd(0, 6.28), dmg: dmg }; break;
            case 'summon': {
                const def = stage.enemies[0], n = Math.round(s.n * (en ? 1.4 : 1));
                for (let i = 0; i < n; i++) { const mm = spawnEnemy(def, e.x + rnd(-120, 120), e.y + rnd(-120, 120), false); mm.hp = mm.maxHp = Math.round(mm.maxHp * 0.7); }
                break;
            }
        }
    }

    function boomAt(x, y, r, dmg, c, o) {
        const d = { x: x, y: y, r: r, dmg: dmg, c: c };
        if (o) Object.keys(o).forEach(k => { if (o[k] != null && o[k] !== false) d[k] = o[k]; });
        onBoom(d);
        if (isHost) netSend('boom', d);
    }
    // 範囲攻撃の当たり判定（円／扇／直線／ドーナツ）
    function inShape(d, px, py, pr) {
        const dd = dist(px, py, d.x, d.y);
        if (d.sh === 'cone') {
            if (dd > d.r + pr) return false;
            if (dd < pr + 22) return true;
            let da = Math.atan2(py - d.y, px - d.x) - d.a; da = Math.atan2(Math.sin(da), Math.cos(da));
            return Math.abs(da) <= d.arc / 2;
        }
        if (d.sh === 'line') return distSeg(px, py, d.x, d.y, d.x + Math.cos(d.a) * d.r, d.y + Math.sin(d.a) * d.r) < (d.w || 60) / 2 + pr;
        if (d.sh === 'donut') return dd < d.r + pr && dd > (d.ri || 0) - pr;
        return dd < d.r + pr;
    }
    function onBoom(d) {
        if (d.sh === 'portal') return;   // 門は見た目だけ（ダメージ・爆発演出なし）
        const col = d.c || '#ff9a3a';
        if (d.sh === 'cone') fx.push({ k: 'arc', x: d.x, y: d.y, a: d.a, rng: d.r, arc: d.arc, t: 0.28, life: 0.28, c: col });
        else if (d.sh === 'line') fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x + Math.cos(d.a) * d.r, y2: d.y + Math.sin(d.a) * d.r, t: 0.25, life: 0.25, c: col, w: d.w || 60 });
        else fx.push({ k: 'ring', x: d.x, y: d.y, r: 0, max: d.r, t: 0.35, life: 0.35, c: col, fill: true });
        if (!me.dead && d.dmg > 0 && inShape(d, me.x, me.y, me.r)) hurtMe(d.dmg, { stun: !!d.stun });
    }

    function netAnnounce(text, ms) { announce(text, ms); if (isHost) netSend('announce', { text: text, ms: ms }); }

    // ---------- ダメージ処理 ----------
    // 自分の攻撃が敵に当たったとき：ホストなら直接、そうでなければホストへ送る
    // ---------- オンラインマッチ（アクション対戦）----------
    //  ・相手は自分の画面では「敵」として扱う（pvp ダミー）ので、武器・スキル・特殊効果は今までの攻撃がそのまま使える
    //  ・ダメージはステータスに関係なく「相手の最大HPの割合」。基準の一撃（自分の素のステータスでの武器1振り）= 4.5%
    //    → 武器の％・種類・クリティカル・スキル・特殊効果の勝負になる（ステータス差で圧倒されない）
    const PVP_BASE = 0.045, PVP_REF = HW.HIT_BASE * (0.6 + base.atk / 150);
    const pvpDummies = {};
    function syncPvpDummies() {
        const list = [];
        Object.keys(allies).forEach(id => {
            const a = allies[id]; if (a.dead) return;
            if (sameTeam(id)) return;      // チーム戦：味方には攻撃が当たらない
            let d = pvpDummies[id];
            if (!d) d = pvpDummies[id] = { id: 'pv:' + id, pvp: true, pid: id, def: { name: a.name, icon: '🧑', color: '#fff' }, arch: 'chaser', boss: false, elite: false, r: 16, maxHp: 100, hp: 100, flash: 0, kx: 0, ky: 0, state: 0, air: 0,
                st: { burn: 0, burnT: 0, poison: 0, poisonT: 0, slowT: 0, stunT: 0, bleed: 0, bleedT: 0, curseT: 0, weakenT: 0, blindT: 0 } };
            d.x = a.x; d.y = a.y; d.hp = Math.max(1, (a.maxHp ? a.hp / a.maxHp : 1) * 100);
            list.push(d);
        });
        enemies = list;
    }
    function dealPvp(e, dmg, o) {
        // 1発のダメージ（相手の最大HPに対する割合）。上限はなし（通信の異常値だけ弾く）。サドンデスで時間とともに攻撃力が上がる
        let f = PVP_BASE * dmg / PVP_REF * sdAtkMul(); if (!isFinite(f) || f < 0) f = 0; f = Math.min(f, 100);
        popups.push({ x: e.x + rnd(-8, 8), y: e.y - e.r - 6, t: 0.7, text: (f * 100).toFixed(1) + '%', c: o.crit ? '#ffd84a' : '#fff', big: !!o.crit });
        run.stats.dmg += f * 100; e.flash = 0.1;
        const st = o.st && o.st.stun ? { stun: Math.min(PVP_STUN_MAX, typeof o.st.stun === 'number' ? o.st.stun : 1) } : null;
        netSend('pvph', { to: e.pid, f: +f.toFixed(4), kx: Math.round(o.kx || 0), ky: Math.round(o.ky || 0), st: st });
    }
    // 相手の攻撃を受けたとき（ダメージは自分の最大HPの割合）
    function hurtPvp(f, kx, ky, st, by) {
        if (me.dead || me.invHard > 0 || run.phase !== 'run' || me.inv > 0) return;
        if (me.guardT > 0) { guardBlock(); return; }
        if (Math.random() < Math.min(0.5, A('dodge'))) { popups.push({ x: me.x, y: me.y - 24, t: 0.6, text: 'MISS', c: '#9fe0ff' }); me.inv = 0.1; return; }
        if (me.shield) { me.shield = false; popups.push({ x: me.x, y: me.y - 24, t: 0.7, text: 'BARRIER', c: '#9fe0ff' }); me.inv = 0.4; return; }
        let dmg = Math.max(1, Math.round(f * me.maxHp * (1 - Math.min(0.75, Math.max(-0.5, A('dr'))) * sdDefMul()) * (1 + A('dmgTaken')) * (me.stunT > 0 ? 1 - 0.4 * sdDefMul() : 1)));   // サドンデスで、ダメージ軽減（防御）の効き目が下がっていく
        if (me.barrierHp > 0) { const ab = Math.min(dmg, me.barrierHp); me.barrierHp -= ab; dmg -= ab; popups.push({ x: me.x, y: me.y - 30, t: 0.7, text: 'BARRIER-' + Math.round(ab), c: '#7fc8ff' }); if (dmg <= 0) { me.inv = 0.1; return; } }
        const lost = Math.min(me.hp, dmg);
        me.hp -= dmg; me.inv = 0.06; me.flash = 0.2;
        popups.push({ x: me.x, y: me.y - 24, t: 0.8, text: '-' + dmg, c: '#ff7b7b', big: true });
        if (by) { const pct = +(lost / me.maxHp * 100).toFixed(2); tallyDmg(by, pct); netSend('pvpd', { by: by, p: pct }); }   // 実際に減った分を「与ダメージ」として、全員の画面で記録する
        if (kx || ky) { moveSolid(me, clamp(kx, -400, 400) * 0.05, clamp(ky, -400, 400) * 0.05, me.r); }
        if (me.hp <= 0 && AB('guts') && !(me.gutsT > 0)) { me.hp = 1; me.gutsT = 45; me.inv = Math.max(me.inv, 1.0); popups.push({ x: me.x, y: me.y - 40, t: 1.3, text: '根性！ HP1で耐えた', c: '#ffd84a', big: true }); }
        if (me.hp <= 0) { me.hp = 0; me.dead = true; me.stunT = 0; me.orb = null; announce('倒れた…　決着を見届けよう', 2400); }
        else if (st && st.stun) stunMe(st.stun);
    }
    // 総合ダメージ量（相手の最大HPに対する%の合計）。time-up のときに多い方が勝つ
    function tallyDmg(id, pct) { run.pvpDmg = run.pvpDmg || {}; run.pvpDmg[id] = (run.pvpDmg[id] || 0) + pct; }
    function dmgOf(id) { return (run.pvpDmg && run.pvpDmg[id]) || 0; }
    function pvpHostCheck() {
        if (run.ended || run.phase !== 'run') return;
        if (TEAM) {           // チーム戦：片方のチームが全滅したら決着。時間切れは、チームの残りHP割合の合計で判定
            const sum = [0, 0], cnt = [0, 0];
            const add = (id, f) => { const t = teamMap[id]; if (t === 0 || t === 1) { sum[t] += f; cnt[t]++; } };
            if (!me.dead) add(myId, me.hp / me.maxHp);
            Object.keys(allies).forEach(id => { const a = allies[id]; if (!a.dead) add(id, a.maxHp ? a.hp / a.maxHp : 1); });
            if (run.time > 4 && (cnt[0] === 0 || cnt[1] === 0)) endPvpTeam(cnt[0] > 0 ? 0 : (cnt[1] > 0 ? 1 : -1), 'last');
            else if (run.time > TIME_LIMIT) {     // 時間切れ：チーム全員の総合ダメージ量が多い方の勝ち（同じなら引き分け）
                const dsum = [0, 0]; const addD = id => { const t = teamMap[id]; if (t === 0 || t === 1) dsum[t] += dmgOf(id); };
                addD(myId); Object.keys(allies).forEach(addD);
                endPvpTeam(dsum[0] > dsum[1] ? 0 : (dsum[1] > dsum[0] ? 1 : -1), 'time');
            }
            return;
        }
        const alive = [];
        if (!me.dead) alive.push({ id: myId, f: me.hp / me.maxHp });
        Object.keys(allies).forEach(id => { const a = allies[id]; if (!a.dead) alive.push({ id: id, f: a.maxHp ? a.hp / a.maxHp : 1 }); });
        if (run.time > 4 && alive.length <= 1) endPvp(alive[0] ? alive[0].id : null, 'last');
        else if (run.time > TIME_LIMIT) {      // 時間切れ：生き残っている人のうち、総合ダメージ量がいちばん多い人の勝ち（同じなら残りHPが多い方）
            alive.sort((x, y) => (dmgOf(y.id) - dmgOf(x.id)) || (y.f - x.f));
            endPvp(alive[0] ? alive[0].id : null, 'time');
        }
    }
    function endPvpTeam(team, reason) {      // team: 0/1＝勝ったチーム、-1＝引き分け
        if (run.ended) return;
        run.ended = true;
        const d = { winnerTeam: team, reason: reason, dmg: run.pvpDmg || {} };
        netSend('end', d);
        finish(team >= 0 && team === teamMap[myId], d);
    }
    function endPvp(winnerId, reason) {
        if (run.ended) return;
        run.ended = true;
        const d = { winner: winnerId, reason: reason, dmg: run.pvpDmg || {} };
        netSend('end', d);
        finish(winnerId === myId, d);
    }

    function dealHit(e, dmg, o) {
        o = o || {};
        if (e.pvp) { dealPvp(e, dmg, o); return; }
        if (e.inv) {   // ギミックで守られている間はダメージが通らない
            if ((e.invAt || 0) < Date.now() - 700) { e.invAt = Date.now(); popups.push({ x: e.x, y: e.y - e.r - 8, t: 0.8, text: 'ガード中', c: '#7fffd4' }); }
            e.flash = 0.05; return;
        }
        const els = SE ? (o.el !== undefined ? o.el : WEL) : [];
        if (els && els.length && dmg > 0) dmg += elemHit(e, dmg, els, o);
        const d = { eid: e.id, dmg: dmg, st: o.st || null, kx: o.kx || 0, ky: o.ky || 0, by: myId, crit: !!o.crit };
        if (dmg > 0) {
            run.stats.dmg += dmg;
            popups.push({ x: e.x + rnd(-8, 8), y: e.y - e.r - 6, t: 0.7, text: String(Math.round(dmg)), c: o.crit ? '#ffd84a' : (o.elc || '#fff'), big: !!o.crit });
        }
        e.flash = 0.1;
        if (isHost) applyHit(d); else { netSend('hit', d); e.hp = Math.max(0, e.hp - dmg * (e.takeMul || 1)); }
        if (dmg > 0 && !accBusy) accEvent('hit');
    }
    function applyHit(d) {
        const e = enemies.find(x => x.id === d.eid);
        if (!e || e.hp <= 0 || e.inv) return;
        const amp = (e.st.curseT > 0 ? 1.2 : 1) * (e.vuln > 0 ? 1.3 : 1);
        e.hp -= d.dmg * amp * (e.takeMul || 1);      // 防御（無限回廊の敵）
        e.kx += d.kx; e.ky += d.ky;
        const s = d.st;
        if (s) {
            if (s.burn) { e.st.burn = Math.max(e.st.burn, s.burn); e.st.burnT = 3; }
            if (s.poison) { e.st.poison = Math.max(e.st.poison, s.poison); e.st.poisonT = 5; }
            if (s.bleed) { e.st.bleed = Math.max(e.st.bleed, s.bleed); e.st.bleedT = 4; }
            if (s.slow) e.st.slowT = 2.5;
            if (s.stun && !e.boss) e.st.stunT = Math.max(e.st.stunT, typeof s.stun === 'number' ? s.stun : 1);
            if (s.weaken) e.st.weakenT = 3;
            if (s.blind) e.st.blindT = 2.5;
            if (s.curse) e.st.curseT = 6;
        }
        if (e.hp <= 0) killEnemy(e, d.by);
    }

    function killEnemy(e, by) {
        if (e.dead) return;
        e.dead = true; e.hp = 0;
        run.kills++;
        const main = e.boss && !e.echo;                                                    // 召喚された歴代ボス(echo)は本体ではない
        const others = main && enemies.some(o => o !== e && o.boss && !o.echo && !o.dead && o.hp > 0);
        const last = main && !others;                                                      // 最後の1体を倒したときだけクリア＆ボスドロップ
        const ev = { id: e.id, x: e.x, y: e.y, boss: last, part: (main && !last && !RUSH_ON) || !!e.noLoot, echo: !!e.echo, elite: !!e.elite, by: by, ilvl: SC.ilvl, ico: e.def.icon, col: e.def.color || '#fff', r: e.r };
        if (RUSH_ON && main) {      // ボスラッシュ：1体ごとに報酬（rb=1）、フェーズの最後の1体は豪華（rb=2）
            const pd = RUSHD.phases[Math.max(0, RS.ph - 1)] || RUSHD.phases[0];
            ev.rb = last ? 2 : 1; ev.ph = RS.ph; ev.fin = !!pd.final; ev.lw = pd.lootWorld; ev.ilvl = pd.ilvl; ev.src = e.rushSrc || '';
        }
        if (CORR_ON) { ev.fl = CF.floor; ev.cm = e.mimic ? 1 : 0; ev.cb = e.cboss || 0; if (e.affix === 'explosive') telegraph(e.x, e.y, 150, 0.9, e.dmg * 1.2, '#ff7a3a'); }
        onKillEvent(ev);
        netSend('kill', ev);
        if (main && others && GMK === 'twin') twinOnDeath(e);
        if (last) {
            if (RUSH_ON && !ev.fin) rushPhaseClear();
            else if (CORR_ON) corrBossDown();
            else run.bossDead = true;
            G.rv = null; enemies.forEach(o => { if (o !== e && (o.echo || o.valve)) { o.hp = 0; o.dead = true; } });
        }
    }

    // 全員が受け取る撃破イベント：各自が自分用のドロップを抽選する（ハクスラ式の個人ドロップ）
    // 第一世界の最終ステージ「深淵の裂け目」を攻略（どの難易度でもよい）すると、第二世界への道が開く
    // 世界をまたぐ流れ：①前の世界の最終ステージを攻略（ノーマルでもよい） → ②「門」が現れる → ③ゲートキーパーを倒す → ④次の世界が解放
    function worldOpenedByThisStage() {      // このステージの攻略で「門」が現れる世界（gateFlag）
        return (window.STAGE_DATA.WORLDS || []).find(w => w.unlock && stage.id === w.unlock.stageId && DIFFS.indexOf(DIFF) >= ((window.SeasonSys && w.unlock.diff != null) ? window.SeasonSys.gateDiffReq(w.unlock.diff) : w.unlock.diff)) || null;
    }
    function worldOpenedByGate() {           // このステージ（ゲート）のゲートキーパーを倒すと解放される世界（flag）
        return (window.STAGE_DATA.WORLDS || []).find(w => w.unlock && stage.id === w.unlock.gateId) || null;
    }
    // ---------- 撃破の演出（爽快感）----------
    //  光の輪・飛び散る火花・コンボ表示・画面の揺れ。精鋭とボスはさらに派手に。多くの敵を一度に倒しても重くならないよう、演出の数に上限をかける
    let shakeT = 0, shakeA = 0, comboN = 0, comboT = 0;
    function addShake(a, t) { if (a > shakeA || shakeT <= 0) { shakeA = a; } shakeT = Math.max(shakeT, t); }
    function killFx(ev) {
        const col = ev.col || '#fff', big = ev.boss ? 3 : (ev.elite ? 2 : 1), r0 = ev.r || 14;
        fx.push({ k: 'puff', x: ev.x, y: ev.y, t: 0.35, life: 0.35, c: '#fff' });
        fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 0, max: 34 + r0 * 1.4 * big, t: 0.38, life: 0.38, c: col });
        if (fx.length > 420) return;
        const n = ev.boss ? 46 : (ev.elite ? 26 : 11);
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (120 + Math.random() * 360) * (0.8 + big * 0.25); fx.push({ k: 'spark', x: ev.x, y: ev.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, sz: 2.5 + Math.random() * 3.5 * (big > 1 ? 1.4 : 1), t: 0.35 + Math.random() * 0.3, life: 0.65, c: Math.random() < 0.4 ? '#fff' : col }); }
        if (big >= 2) { fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 0, max: 120 + 30 * big, t: 0.5, life: 0.5, c: '#fff' }); addShake(big === 3 ? 9 : 4, big === 3 ? 0.5 : 0.22); }
        if (ev.by === myId) {      // 自分が倒したときだけコンボを数える
            comboT = 2.4; comboN++;
            if (comboN >= 5 && comboN % 5 === 0) {
                const hype = comboN >= 100 ? '殲滅！' : (comboN >= 50 ? '無双！' : (comboN >= 25 ? '圧倒！' : (comboN >= 10 ? '連鎖！' : '')));
                popups.push({ x: me.x, y: me.y - 64, t: 1.1, text: (hype ? hype + ' ' : '') + comboN + ' COMBO', c: comboN >= 50 ? '#ff7bd5' : (comboN >= 25 ? '#ffb347' : '#ffe08a'), big: true });
                if (comboN % 25 === 0) { fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: 220, t: 0.5, life: 0.5, c: '#ffe08a', fill: true }); addShake(3, 0.2); }
            }
        }
    }
    // 戦利品の文脈：ボスラッシュは「そのフェーズの世界」の表、無限回廊は「その階層のレベル」の表から引く
    function lootCtx(ev) {
        if (RUSH_ON && ev.lw) {
            const lp = RUSHD.lootPool(ev.lw), src = ev.src && window.getStageById(ev.src), dk = window.getStageById('dimension_end');
            return { ilvl: ev.ilvl || stage.ilvl, id: 'boss_rush', mats: (src && src.mats) || (dk && dk.mats) || { mob: [], elite: [], boss: [] }, drops: lp.drops, bossDrops: lp.bossDrops };
        }
        if (CORR_ON) { const pool = corrPool(ev.ilvl || 10); return { ilvl: ev.ilvl || 10, id: 'infinite_corridor', mats: stage.mats, drops: pool, bossDrops: pool }; }
        return null;
    }
    function onKillEvent(ev) {
        LT = lootCtx(ev);
        const own = !TX && !CORR_ON; if (own) TX = HW.load();
        try { onKillEvent0(ev); } finally { LT = null; if (own) { const d = TX; TX = null; HW.save(d); } }
    }
    function onKillEvent0(ev) {
        killFx(ev);
        if (stage.pvp || DBG) return;   // アリーナのボットとデバッグ戦闘は戦利品なし
        if (ev.part || ev.echo) {   // 双子の片方・召喚されたボス・安全弁：コインだけ
            run.stats.kills++; run.stats.coins += Math.round((1 + (ev.ilvl || stage.ilvl) * 0.8) * (ev.echo ? 6 : 3) * (1 + A('goldPct')));
            return;
        }
        if (ev.boss) {
            const wo = worldOpenedByThisStage(), wg = worldOpenedByGate(), hh = HW.load();
            if (wo && !hh[wo.unlock.gateFlag]) setTimeout(() => announce(wo.unlock.openText, 5200), 700);
            if (wg) setTimeout(() => announce(wg.unlock.clearText, 5200), 700);
        }
        run.stats.kills++;
        try { if (window.SBAch && !DBG) SBAch.report('kill', ev.boss ? 1 : 0); } catch (e) { /* 実績の記録に失敗してもゲームは続ける */ }
        if (ev.rb) { rushKillReward(ev); return; }          // ボスラッシュ：専用の報酬
        { const al = A('rarePct') + DIFF.luck;      // アクセサリー：ボス・精鋭・雑魚の順に出にくい
          if (ev.boss && Math.random() < 0.45 + 0.1 * al) rollAcc(al, 'magic', ev.x + 14, ev.y); else if (ev.elite && Math.random() < 0.05 * (1 + al)) rollAcc(al, 'normal', ev.x, ev.y); else if (!ev.part && !ev.boss && Math.random() < 0.004 * (1 + al)) rollAcc(al, 'normal', ev.x, ev.y); }
        if (CORR_ON) { corrKillReward(ev); return; }        // 無限回廊：専用の報酬
        const coin = Math.round((1 + stage.ilvl * 0.8) * (ev.boss ? 25 : 1) * (1 + A('goldPct')));
        run.stats.coins += coin;
        const luck = A('dropPct');
        const rareBonus = A('rarePct') + DIFF.luck + (ev.boss ? 0.8 : 0) + (ev.elite ? 0.5 : 0);
        rollMats(ev.boss ? 'boss' : (ev.elite ? 'elite' : 'mob'), ev.x, ev.y);
        if (ev.boss) {
            // ボス専用ドロップ：レア以上確定を2本＋通常ドロップ1本
            rollLoot(stage.bossDrops, rareBonus, 'rare', ev.x, ev.y, 'boss');
            rollLoot(stage.bossDrops, rareBonus, 'rare', ev.x + 22, ev.y, 'boss');
            rollLoot(stage.drops, rareBonus, 'magic', ev.x - 22, ev.y, 'boss');
            rollArmor(rareBonus, 'rare', ev.x, ev.y - 20, 'boss'); if (Math.random() < 0.5) rollArmor(rareBonus, 'magic', ev.x + 18, ev.y - 24, 'boss');
            if (Math.random() < 0.8) giveOrb(true);
        } else if (ev.elite) {
            // 精鋭：高確率で武器（マジック以上）、オーブも出やすい
            if (Math.random() < 0.55 * (1 + luck)) rollLoot(stage.drops, rareBonus, 'magic', ev.x, ev.y, 'elite');
            if (Math.random() < 0.22 * (1 + luck)) rollArmor(rareBonus, 'magic', ev.x, ev.y - 16, 'elite');
            if (Math.random() < 0.22 * (1 + A('orbPct'))) giveOrb(false);
        } else {
            if (Math.random() < 0.07 * (1 + luck)) rollLoot(stage.drops, rareBonus, 'normal', ev.x, ev.y, 'mob');
            if (Math.random() < 0.025 * (1 + luck)) rollArmor(rareBonus, 'normal', ev.x, ev.y - 12, 'mob');
            if (Math.random() < 0.035 * (1 + A('orbPct'))) giveOrb(false);
        }
        if (ev.by === myId) {
            onMyKill();
            // 回復の宝珠：倒した本人が拾う（被弾が増えたぶんの救済）
            if (!me.dead && Math.random() < (ev.elite || ev.boss ? 0.5 : 0.09)) {
                addHp(me.maxHp * (ev.elite ? 0.2 : 0.1));
                popups.push({ x: me.x, y: me.y - 34, t: 0.9, text: '+HP', c: '#7aff9a' });
            }
        }
    }

    function rollArmor(luck, minR, x, y, src) {
        if (!window.SBArmor) return;
        const a = SBArmor.roll({ ilvl: L().ilvl, luck: luck, minRarity: minR, source: L().id + ':' + src });
        if (CORR_ON) BAG.armors.push(a); else { const d = hwLoad(); SBArmor.add(d, a); hwSave(d); }
        run.stats.loot.push(a);
        popups.push({ x: x, y: y - 14, t: 1.6, text: '🛡 ' + a.name, c: HW.rarityOf(a).color, big: true });
        fx.push({ k: 'ring', x: x, y: y, r: 0, max: 50, t: 0.5, life: 0.5, c: HW.rarityOf(a).color });
        refreshLootLog();
    }
    function rollLoot(pool, luck, minR, x, y, src) {
        const w = HW.roll({ ilvl: L().ilvl, baseIds: pool, luck: luck, minRarity: minR, source: L().id + ':' + src });
        if (CORR_ON) BAG.weapons.push(w); else { const d = hwLoad(); d.weapons.push(w); hwSave(d); }
        run.stats.loot.push(w);
        popups.push({ x: x, y: y - 14, t: 1.6, text: '✦ ' + w.name, c: HW.rarityOf(w).color, big: true });
        fx.push({ k: 'ring', x: x, y: y, r: 0, max: 50, t: 0.5, life: 0.5, c: HW.rarityOf(w).color });
        refreshLootLog();
    }
    // ---------- モンスター素材（グリフ工房の材料）----------
    // 抽選表は stage-data.js の MATS。雑魚は控えめ、精鋭はそのまま、ボスの確定枠は2〜3個。
    function matName(id) { return (typeof MATERIAL_DATA !== 'undefined' && MATERIAL_DATA[id]) ? MATERIAL_DATA[id].name : id; }
    function rollMats(kind, x, y) {
        const list = L().mats && L().mats[kind];
        if (!list || !list.length) return;
        const kindMul = kind === 'mob' ? 0.6 : 1;
        const luck = (1 + A('dropPct') * 0.5) * (1 + DIFF.luck * 0.25);
        const got = {};
        list.forEach(row => {
            const id = row[0], ch = row[1];
            if (Math.random() < Math.min(1, ch * kindMul * luck)) got[id] = (got[id] || 0) + ((kind === 'boss' && ch >= 1) ? 2 + Math.floor(Math.random() * 2) : 1);
        });
        giveMaterials(got, x, y);
    }
    function giveMaterials(got, x, y) {
        const ids = Object.keys(got);
        if (!ids.length) return;
        const p = CORR_ON ? {} : getPlayerData(); if (!p) return;
        if (!p.materials || Array.isArray(p.materials)) p.materials = {};
        ids.forEach((id, i) => {
            if (CORR_ON) BAG.mats[id] = (BAG.mats[id] || 0) + got[id]; else p.materials[id] = (p.materials[id] || 0) + got[id];
            run.stats.mats[id] = (run.stats.mats[id] || 0) + got[id];
            popups.push({ x: x + (i - (ids.length - 1) / 2) * 6, y: y - 10 - i * 14, t: 1.1, text: '🧪 ' + matName(id) + (got[id] > 1 ? '×' + got[id] : ''), c: '#c8f7a0' });
        });
        if (!CORR_ON) { try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {} }
    }
    function giveOrb(isBoss) {
        if (typeof createOrb !== 'function') return;
        const il = L().ilvl;
        let tier = 'tier1';
        const r = Math.random();
        if (il >= 12 && r < (isBoss ? 0.15 : 0.03)) tier = 'tier4';
        else if (il >= 7 && r < (isBoss ? 0.45 : 0.18)) tier = 'tier3';
        else if (il >= 3 && r < (isBoss ? 0.7 : 0.4)) tier = 'tier2';
        const orb = createOrb(tier);
        if (!orb) return;
        if (CORR_ON) BAG.orbs.push(orb);
        else {
            const p = getPlayerData(); if (!p) return;
            if (!Array.isArray(p.orbs)) p.orbs = [];
            p.orbs.push(orb);
            try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {}
        }
        run.stats.orbs++;
        popups.push({ x: me.x, y: me.y - 40, t: 1.4, text: '💎 オーブ入手 (' + (orb.tier || tier) + ')', c: '#9fe0ff', big: true });
    }

    // 自分が倒したとき（撃破時効果）
    function onMyKill() {
        accEvent('kills');
        agg.procs.filter(p => p.on === 'kill').forEach(p => {
            if (Math.random() >= p.v && p.key !== 'killHeal') return;
            if (p.key === 'killHeal') addHp(me.maxHp * Math.min(0.2, p.v));
            else if (p.key === 'killBoom') boomMine(me.x, me.y, 110);
            else if (p.key === 'killHaste') me.haste = 3;
            else if (p.key === 'killEnergy') addEnergy(8);
        });
    }

    // 自分が敵に与える範囲爆発（味方には当たらない）
    function boomMine(x, y, r) {
        r *= (1 + A('aoePct'));
        fx.push({ k: 'ring', x: x, y: y, r: 0, max: r, t: 0.3, life: 0.3, c: '#ffb04a', fill: true });
        netSend('sk', { f: 'nova', x: Math.round(x), y: Math.round(y), r: Math.round(r) });
        const dm = weapon.dmg * P.atkMul * 0.9;
        enemies.forEach(e => { if (e.hp > 0 && dist(e.x, e.y, x, y) < r + e.r) dealHit(e, dm, {}); });
    }

    // ---------- 守りの溜め（バリア）----------
    function startGuard() {
        if (me.dead || me.stunT > 0 || run.phase !== 'run' || me.cast || me.gch > 0 || me.ultT > 0 || me.guardT > 0) return;
        if (me.guardCd > 0) { popups.push({ x: me.x, y: me.y - 30, t: 0.8, text: 'バリアはあと' + Math.ceil(me.guardCd) + '秒', c: '#ff9a9a' }); return; }
        me.gch = 0.001; me.dashT = 0;
    }
    function cancelGuard() { if (me.gch > 0) { me.gch = 0; popups.push({ x: me.x, y: me.y - 30, t: 0.7, text: '溜め中断', c: '#ff9a9a' }); } }
    // 溜め・バリアの時間を進める（updateMe の頭で毎フレーム呼ぶ）
    function tickCharge(dt) {
        if (me.gMsgT > 0) me.gMsgT -= dt;
        if (me.guardCd > 0) me.guardCd -= dt;
        if (me.dead || run.phase !== 'run') { me.cast = null; me.gch = 0; me.guardT = 0; me.ultT = 0; return; }
        if (me.guardT > 0) me.guardT -= dt;
        if (me.ultT > 0) me.ultT -= dt;
        if (ultFlashT > 0) ultFlashT -= dt;
        if (me.stunT > 0) {
            if (me.cast) { const sl = skillSlots[me.cast.slot]; if (sl) { me.energy = Math.min(ENERGY_MAX, me.energy + sl.cost); updateEnergyUI(); } me.cast = null; popups.push({ x: me.x, y: me.y - 30, t: 0.9, text: '溜め中断！', c: '#ff9a9a' }); }
            me.gch = 0; return;
        }
        if (me.cast) {
            me.cast.t -= dt;
            if (me.cast.t <= 0) { const sl = me.cast.slot; me.cast = null; castSkill(sl, true); }
        }
        if (me.gch > 0) {
            me.gch += dt;
            if (me.gch >= GUARD_CHARGE) {
                me.gch = 0; me.guardT = GUARD_SEC; me.guardCd = GUARD_CD;
                popups.push({ x: me.x, y: me.y - 40, t: 1.1, text: '🛡 バリア展開！', c: '#8fe8ff', big: true });
                fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: 90, t: 0.4, life: 0.4, c: '#8fe8ff' });
            }
        }
    }
    function guardBlock() {      // バリア中は攻撃を完全に防ぐ（連続で当たるときは、表示を出しすぎない）
        if (me.gMsgT <= 0) { me.gMsgT = 0.35; popups.push({ x: me.x, y: me.y - 28, t: 0.6, text: 'BLOCK', c: '#8fe8ff' }); fx.push({ k: 'ring', x: me.x, y: me.y, r: 20, max: 44, t: 0.2, life: 0.2, c: '#8fe8ff' }); }
    }

    // ---------- 被ダメージ ----------
    function hurtMe(raw, opt) {
        if (me.dead || me.invHard > 0 || run.phase !== 'run') return;
        if (me.guardT > 0) { guardBlock(); return; }
        if (me.inv > 0 && !(opt && opt.stun)) return;   // 被弾直後の無敵はスタン攻撃には効かない（小弾に隠されて不発になるのを防ぐ）
        if (Math.random() < Math.min(0.5, A('dodge'))) { popups.push({ x: me.x, y: me.y - 24, t: 0.6, text: 'MISS', c: '#9fe0ff' }); me.inv = 0.25; return; }
        if (me.shield) { me.shield = false; popups.push({ x: me.x, y: me.y - 24, t: 0.7, text: 'BARRIER', c: '#9fe0ff' }); me.inv = 0.5; return; }
        if (me.stunT > 0) raw *= 0.6;   // スタン中は被ダメージを少し軽減（スタンロックで一方的に倒されないように）
        // raw は「基準HPに対する割合」。防御は最大55%まで軽減
        const defNow = P.def * (me.fortifyT > 0 ? 1.4 : 1);
        const red = Math.min(0.55, defNow / (defNow + 250));
        let dmg = raw * REF_HP * (1 - red) * (1 - Math.min(0.75, Math.max(-0.5, A('dr') + (me.hp / me.maxHp <= 0.3 ? A('lowHpDr') : 0)))) * (1 + A('dmgTaken'));
        if (AB('re_miserable')) dmg *= 0.8;                                    // リ・ミゼラブル：敵の攻撃0.8倍
        dmg = Math.max(1, Math.round(dmg));
        if (me.barrierHp > 0) { const ab = Math.min(dmg, me.barrierHp); me.barrierHp -= ab; dmg -= ab; popups.push({ x: me.x, y: me.y - 30, t: 0.7, text: 'BARRIER-' + Math.round(ab), c: '#7fc8ff' }); me.inv = 0.3; if (dmg <= 0) return; }
        me.hp -= dmg; me.inv = 0.6 + A('iframe'); me.flash = 0.2;
        accEvent('hurt');
        popups.push({ x: me.x, y: me.y - 24, t: 0.8, text: '-' + dmg, c: '#ff7b7b', big: true });
        // 被弾時効果
        if (A('thorns') > 0) { const n = nearestEnemy(me.x, me.y, 140); if (n) dealHit(n, weapon.dmg * P.atkMul * A('thorns'), {}); }
        if (AB('thorn_armor')) { const n = nearestEnemy(me.x, me.y, 170); if (n) dealHit(n, weapon.dmg * P.atkMul * Math.min(6, 0.15 * 40 * (dmg / me.maxHp)), {}); }   // 棘の鎧：受けたダメージの15%ぶんを反射
        if (me.hp <= 0 && AB('guts') && !(me.gutsT > 0)) {                       // 根性：致死ダメージをHP1で耐える（45秒に1回）
            me.hp = 1; me.gutsT = 45; me.inv = Math.max(me.inv, 1.0);
            popups.push({ x: me.x, y: me.y - 40, t: 1.3, text: '根性！ HP1で耐えた', c: '#ffd84a', big: true });
        }
        agg.procs.filter(p => p.on === 'hurt').forEach(p => {
            if (Math.random() >= p.v) return;
            if (p.key === 'hurtShield') me.shield = true;
            if (p.key === 'hurtNova') { fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: 160, t: 0.35, life: 0.35, c: '#ffe08a' }); enemies.forEach(e => { if (dist(e.x, e.y, me.x, me.y) < 170) { const a = Math.atan2(e.y - me.y, e.x - me.x); dealHit(e, weapon.dmg * P.atkMul * 0.8, { kx: Math.cos(a) * 300, ky: Math.sin(a) * 300 }); } }); }
        });
        if (me.hp <= 0) { me.hp = 0; me.dead = true; me.reviveT = 0; me.stunT = 0; me.orb = null; announce('倒れた！ 仲間が近くに来れば復活できます', 2200); if (CORR_ON) { try { if (window.SBAch) SBAch.report('corrDeath'); } catch (e) { /* 記録に失敗してもゲームは続ける */ } } }
        else if (opt && opt.stun) stunMe(STUN_SEC);
    }
    // スタン：約3秒、移動・攻撃・ダッシュ・スキルがすべて使えない（クイズの回答だけは可能）
    function stunMe(sec) {
        if (me.dead || me.stunT > 0 || me.stunImm > 0) return;
        if (me.guardT > 0) { guardBlock(); return; }
        if (AB('iron_will') && Math.random() < 0.5) { popups.push({ x: me.x, y: me.y - 40, t: 1.0, text: '耐性！', c: '#9fe0ff', big: true }); return; }   // 不動の心：状態異常を50%無効化
        if (PVP) sec = Math.min(sec, PVP_STUN_MAX);      // 対人戦のスタンは短く
        me.stunT = sec; me.dashT = 0; me.dashBlast = 0;
        popups.push({ x: me.x, y: me.y - 40, t: 1.3, text: '💫 スタン！', c: '#ffe14a', big: true });
        fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: 60, t: 0.4, life: 0.4, c: '#ffe14a' });
    }

    function nearestEnemy(x, y, maxD) {
        let best = null, bd = maxD || 1e9;
        enemies.forEach(e => { if (e.hp <= 0) return; const d = dist(x, y, e.x, e.y) - e.r; if (d < bd) { bd = d; best = e; } });
        return best;
    }

    // ---------- 攻撃 ----------
    // オートエイム：スマホと同じく、いちばん近い敵へ自動で狙いを合わせる（PCはGキーでオン/オフ）
    let autoAim = true; try { autoAim = localStorage.getItem('sbAutoAim') !== '0'; } catch (e) {}
    function aimAngle() {
        if (input.aimStick.id !== null && Math.hypot(input.aimStick.x, input.aimStick.y) > 0.2) return Math.atan2(input.aimStick.y, input.aimStick.x);
        if (isTouch || autoAim) { const n = nearestEnemy(me.x, me.y, 520); if (n) return Math.atan2(n.y - me.y, n.x - me.x); }
        return me.ang;   // マウス操作時は updateMe が毎フレーム me.ang を更新している
    }
    function wantsAttack() {
        if (keys['Space'] || input.mouseDown) return true;
        if (input.aimStick.id !== null) return true;
        return false;
    }

    function calcHit(e, mult) {
        let dmg = weapon.dmg * (T.mult || 1) * P.atkMul * atkDyn() * (mult || 1) * rnd(0.93, 1.07);
        if (e.pvp) { /* 対人戦ではボス・雑魚用の補正は無し */ } else if (e.boss) dmg *= 1 + A('dmgBoss'); else dmg *= 1 + A('dmgMob');
        if (e.hp / e.maxHp < 0.3) dmg *= 1 + A('dmgLow');
        if (e.hp >= e.maxHp) dmg *= 1 + A('dmgFull');
        if (me.hp / me.maxHp < 0.5) dmg *= 1 + A('rageAtk');
        if (me.empowerT > 0) dmg *= 1.35;
        if (!e.pvp) {
            if (AB('re_miserable')) dmg *= 1.25;                              // リ・ミゼラブル：敵のHP0.8倍と同じ
            if (AB('penetration') && (e.boss || e.elite)) dmg *= 1.15;        // 貫通：防御を半分無視
        }
        if (AB('guts') && me.hp <= 1.5) dmg *= 3;                             // 根性：HP1の間は攻撃力3倍
        let crit = Math.random() < P.crit;
        if (AB('first_strike') && !run.firstStrike && run.phase === 'run') { crit = true; run.firstStrike = true; }   // 会心の初撃
        if (crit) dmg *= P.critMul; else if (A('nonCritDown') > 0) dmg *= 1 - Math.min(0.9, A('nonCritDown'));      // 諸刃：クリティカルでないとダメージが減る
        return { dmg: dmg, crit: crit };
    }

    // 命中時の効果（状態異常・連鎖雷・隕石など）
    function onHitProcs(e, h) {
        const st = {};
        let extra = false;
        const base = weapon.dmg * P.atkMul;
        agg.procs.forEach(p => {
            if (p.on === 'crit') { if (h.crit && Math.random() < p.v) boomMine(e.x, e.y, 100); return; }
            if (p.on !== 'hit') return;
            if (Math.random() >= p.v) return;
            switch (p.key) {
                case 'burn': st.burn = base * 0.35; break;
                case 'poison': st.poison = base * 0.22; break;
                case 'bleed': st.bleed = base * 0.3; break;
                case 'freeze': st.slow = 1; break;
                case 'stun': st.stun = 1; break;
                case 'curse': st.curse = 1; break;
                case 'double': extra = true; break;
                case 'shock': {
                    let c = 0; fx.push({ k: 'bolt', x: e.x, y: e.y, t: 0.25, life: 0.25, pts: [] });
                    enemies.forEach(o => { if (o !== e && o.hp > 0 && c < 3 && dist(o.x, o.y, e.x, e.y) < 190) { c++; fx.push({ k: 'line', x: e.x, y: e.y, x2: o.x, y2: o.y, t: 0.2, life: 0.2, c: '#ffe84a' }); dealHit(o, base * 0.6, {}); } });
                    break;
                }
                case 'meteor': {
                    const mx = e.x, my = e.y;
                    fx.push({ k: 'warn', x: mx, y: my, r: 70, t: 0.6, life: 0.6, c: '#ff8a3a' });
                    setTimeout(() => { if (!run.ended) boomMine(mx, my, 90); }, 600);
                    break;
                }
            }
        });
        if (A('lifesteal') > 0) addHp(Math.min(h.dmg * A('lifesteal'), me.maxHp * 0.06));   // 1回の命中で回復するのは最大HPの6%まで
        return { st: Object.keys(st).length ? st : null, extra: extra };
    }

    // 支援武器：自分と近くの味方を回復／鼓舞する（回復量は最大HPの割合。特殊ステータスが高いほど増える）
    function supportPulse(Tt) {
        const r = P.radius || Tt.radius || 150;
        const sp = Math.min(1, P.special / 3000);
        if (Tt.sup === 'heal' || Tt.sup === 'all') {
            const v = (Tt.sup === 'all' ? 0.03 : 0.04) + 0.05 * sp;
            applySupport({ k: 'heal', v: v, t: 2 }, true);
            netSend('sup', { k: 'heal', x: Math.round(me.x), y: Math.round(me.y), r: Math.round(r), v: +v.toFixed(3), t: 2, from: myId });
        }
        if (Tt.sup === 'buff' || Tt.sup === 'all') {
            applySupport({ k: 'buff', t: 4 + 3 * sp }, true);
            netSend('sup', { k: 'buff', x: Math.round(me.x), y: Math.round(me.y), r: Math.round(r), t: +(4 + 3 * sp).toFixed(1), from: myId });
        }
        fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: r, t: 0.4, life: 0.4, c: Tt.sup === 'buff' ? '#ffd84a' : '#7aff9a' });
    }
    function applySupport(d, self) {
        if (me.dead) return;
        if (d.k === 'heal') {
            addHp(me.maxHp * clamp(Number(d.v) || 0, 0, 0.12)); me.regenT = Math.max(me.regenT || 0, clamp(Number(d.t) || 0, 0, 3));
            popups.push({ x: me.x, y: me.y - 30, t: 0.8, text: '+HP', c: '#7aff9a' });
        } else if (d.k === 'buff') {
            const t = clamp(Number(d.t) || 0, 0, 8);
            me.empowerT = Math.max(me.empowerT || 0, t); me.fortifyT = Math.max(me.fortifyT || 0, t);
            popups.push({ x: me.x, y: me.y - 30, t: 0.8, text: '鼓舞！', c: '#ffd84a' });
        }
    }


    // ================= 必殺技（ゲージ制）=================
    //  攻撃を当てるとゲージが溜まり、満タンで R キー（スマホは ⚡ ボタン）で、持っている武器に合った必殺技が出る。
    //  ゲージが溜まる量は「1振りにつき1回」（大勢に当てても増えすぎない）。フィニッシャーは多く溜まる。対人戦では使えない。
    const ULT_MAX = 100;
    const ULT_TYPES = {      // st: slash=連続斬り / quake=衝撃波 / lance=突進して貫く / volley=矢や弾の雨 / storm=雷の雨 / nova=魔法陣の大爆発
        sword:      { name: '剣聖の連斬', st: 'slash', n: 7, gap: 90, mult: 1.15, range: 1.35, arc: 1.9 },
        katana:     { name: '居合・千本桜', st: 'slash', n: 9, gap: 75, mult: 1.0, range: 1.3, arc: 1.3, blink: 70 },
        dagger:     { name: '影縫い乱舞', st: 'slash', n: 15, gap: 55, mult: 0.55, range: 1.0, arc: 2.2, blink: 40 },
        fist:       { name: '百裂拳', st: 'slash', n: 18, gap: 50, mult: 0.5, range: 0.95, arc: 1.8 },
        boots:      { name: '流星蹴り', st: 'slash', n: 10, gap: 80, mult: 0.75, range: 1.2, arc: 2.6, blink: 60 },
        twinblade:  { name: '双舞・嵐刃', st: 'slash', n: 12, gap: 65, mult: 0.65, range: 1.3, arc: 2.2 },
        scythe:     { name: '死神の刈り取り', st: 'slash', n: 4, gap: 160, mult: 1.7, range: 1.5, arc: 4.2 },
        halberd:    { name: '龍尾・大薙ぎ', st: 'slash', n: 3, gap: 180, mult: 2.0, range: 1.5, arc: 4.4 },
        greatsword: { name: '断罪の大地割り', st: 'quake', waves: 3, gap: 170, radius: 170, mult: 2.8, kn: 380 },
        axe:        { name: '狂戦士の旋風', st: 'quake', waves: 6, gap: 110, radius: 125, mult: 1.3, kn: 160 },
        hammer:     { name: '天槌・大震撃', st: 'quake', waves: 2, gap: 260, radius: 240, mult: 3.8, kn: 460 },
        spear:      { name: '貫穿の一閃', st: 'lance', len: 380, width: 56, fan: 1, rep: 3, gap: 130, mult: 2.4 },
        whip:       { name: '千条の鞭', st: 'lance', len: 340, width: 40, fan: 5, rep: 2, gap: 220, mult: 1.2 },
        kusarigama: { name: '鎖の嵐', st: 'lance', len: 320, width: 46, fan: 3, rep: 3, gap: 170, mult: 1.3 },
        bow:        { name: '星降りの矢雨', st: 'volley', n: 18, gap: 70, mult: 0.95, sky: true },
        crossbow:   { name: '破城の連弩', st: 'volley', n: 10, gap: 110, mult: 1.7, sky: false },
        pistol:     { name: '早撃ち乱射', st: 'volley', n: 26, gap: 45, mult: 0.55, sky: false },
        shotgun:    { name: '散弾の嵐', st: 'volley', n: 12, gap: 90, mult: 1.1, sky: false },
        chakram:    { name: '円月・千輪', st: 'volley', n: 9, gap: 100, mult: 1.2, sky: true },
        cannon:     { name: '魔導砲・全力射', st: 'nova', radius: 250, mult: 6.5, waves: 1, wind: 600 },
        wand:       { name: '天雷の魔法陣', st: 'storm', n: 8, gap: 130, mult: 2.2, wind: 500 },
        tome:       { name: '禁書・大解放', st: 'nova', radius: 215, mult: 3.6, waves: 2, wind: 500 },
        esper:      { name: '念動の大崩壊', st: 'nova', radius: 300, mult: 3.4, waves: 2, wind: 400 }
    };
    function ultDef() {
        const u = ULT_TYPES[weapon.type]; if (u) return u;
        const k = T.kind;
        if (k === 'line') return { name: '貫穿の一閃', st: 'lance', len: 360, width: 52, fan: 1, rep: 3, gap: 130, mult: 2.2 };
        if (k === 'smash') return { name: '大震撃', st: 'quake', waves: 3, gap: 180, radius: 200, mult: 2.8, kn: 320 };
        if (k === 'proj') return { name: '一斉掃射', st: 'volley', n: 16, gap: 70, mult: 0.9, sky: false };
        if (k === 'ring') return { name: '大崩壊', st: 'nova', radius: 280, mult: 3.2, waves: 2, wind: 450 };
        return { name: '連斬', st: 'slash', n: 7, gap: 90, mult: 1.1, range: 1.3, arc: 1.9 };
    }
    let ultFlashT = 0;
    function ultGain(n) { if (me.ultT > 0 || PVP) return; const was = me.ult || 0; me.ult = Math.min(ULT_MAX, was + n); if (was < ULT_MAX && me.ult >= ULT_MAX) { popups.push({ x: me.x, y: me.y - 46, t: 1.4, text: '⚡ 必殺技 準備完了！', c: '#ffd84a', big: true }); fx.push({ k: 'pring', x: me.x, y: me.y, r: 0, max: 70, t: 0.35, life: 0.35, c: '#ffd84a' }); } }
    function ultTargets(maxD) { return enemies.filter(e => e.hp > 0 && e.act !== false && dist(me.x, me.y, e.x, e.y) - e.r < maxD); }
    function ultLater(ms, fn) { setTimeout(() => { if (run.phase !== 'run' || me.dead) return; fn(); }, ms); }
    function ultFx(d) { spawnAtkFx(d); netSend('atk', d); mySwing(d); }
    function mySwing(d) { me.swingAt = performance.now(); me.swingDir = d.dir || 1; me.swingFin = d.fin; me.swingKind = d.k === 'line' ? 'line' : (d.k === 'proj' ? 'proj' : ((d.k === 'smash' || d.k === 'ring') ? 'smash' : 'cone')); }      // 見た目は仲間にも送る
    function ultHit(e, mult, kb, fin) { const h = strike(e, mult, kb || 0); hitFeel(e, { fin: !!fin, i: 1, ult: true }, h); return h; }
    function castUlt() {
        if (PVP || me.dead || me.stunT > 0 || me.cast || me.gch > 0 || me.ultT > 0 || run.phase !== 'run') return;
        if ((me.ult || 0) < ULT_MAX) { popups.push({ x: me.x, y: me.y - 34, t: 0.8, text: '必殺ゲージ ' + Math.floor(me.ult || 0) + '%', c: '#ffe08a' }); return; }
        const U = ultDef(), col = HW.rarityOf(weapon).color; me.ult = 0;
        const dur = U.st === 'slash' ? U.n * U.gap / 1000 + 0.3 : U.st === 'quake' ? U.waves * U.gap / 1000 + 0.4 : U.st === 'lance' ? U.rep * U.gap / 1000 + 0.4 : U.st === 'volley' ? U.n * U.gap / 1000 + 0.3 : (U.wind || 400) / 1000 + (U.n ? U.n * U.gap / 1000 : U.waves * 0.25) + 0.3;
        me.ultT = dur; me.invHard = Math.max(me.invHard || 0, dur); me.inv = Math.max(me.inv, dur); me.dashT = 0; me.ang = aimAngle();
        ultFlashT = 0.3; addShake(4, 0.25); announce('⚡ ' + U.name, 1500);
        fx.push({ k: 'pring', x: me.x, y: me.y, r: 0, max: 110, t: 0.4, life: 0.4, c: col, fill: true }); netSend('atk', { k: 'ring', x: me.x, y: me.y, a: me.ang, rad: 110, c: col, fin: 1 });
        const ang0 = me.ang;
        if (U.st === 'slash') {
            const range = (P.range || 80) * U.range;
            for (let i = 0; i < U.n; i++) ultLater(i * U.gap, () => {
                const last = i === U.n - 1, tg = nearestEnemy(me.x, me.y, 340);
                const ang = tg ? Math.atan2(tg.y - me.y, tg.x - me.x) : ang0 + (Math.random() - 0.5) * 1.2;
                if (tg && U.blink) { const L = blinkLimit(me.x, me.y, ang, Math.min(U.blink, Math.max(0, dist(me.x, me.y, tg.x, tg.y) - tg.r - 20)), me.r); me.x += Math.cos(ang) * L; me.y += Math.sin(ang) * L; pushOutOfRocks(me, me.r); }
                me.ang = ang; const arc = U.arc * (last ? 1.3 : 1), rg = range * (last ? 1.35 : 1);
                ultFx({ k: 'cone', x: me.x, y: me.y, a: ang, rng: rg, arc: arc, dir: i % 2 ? -1 : 1, fin: last ? 1 : 0, c: col });
                enemies.forEach(e => { if (e.hp <= 0 || e.act === false) return; const dd = dist(me.x, me.y, e.x, e.y); if (dd > rg + e.r) return; let da = Math.atan2(e.y - me.y, e.x - me.x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) <= arc / 2 || dd < e.r + 18) ultHit(e, U.mult * (last ? 2.4 : 1), last ? 260 : 30, last); });
                if (last) { addShake(5, 0.2); hitStop(0.08); }
            });
        } else if (U.st === 'quake') {
            for (let k = 0; k < U.waves; k++) ultLater(k * U.gap, () => {
                const r = U.radius * (1 + 0.3 * k), last = k === U.waves - 1, cx = me.x + Math.cos(ang0) * 40 * (U.waves > 2 ? 0 : 1), cy = me.y + Math.sin(ang0) * 40 * (U.waves > 2 ? 0 : 1);
                fx.push({ k: 'pring', x: cx, y: cy, r: 0, max: r, t: 0.35, life: 0.35, c: col, fill: true }); netSend('atk', { k: 'ring', x: cx, y: cy, a: 0, rad: r, c: col, fin: 1 });
                enemies.forEach(e => { if (e.hp > 0 && e.act !== false && dist(cx, cy, e.x, e.y) < r + e.r) { const a2 = Math.atan2(e.y - cy, e.x - cx); const h = strike(e, U.mult * (last ? 1.5 : 1), U.kn); hitFeel(e, { fin: last, i: 1, ult: true }, h); } });
                addShake(3 + k, 0.18); if (k === 0) hitStop(0.06);
            });
        } else if (U.st === 'lance') {
            for (let r = 0; r < U.rep; r++) ultLater(r * U.gap, () => {
                const tg = nearestEnemy(me.x, me.y, 420), base = tg ? Math.atan2(tg.y - me.y, tg.x - me.x) : ang0, last = r === U.rep - 1, ox = me.x, oy = me.y;
                me.ang = base;
                const sp = U.fan > 1 ? 1.5 / (U.fan - 1) : 0;
                for (let f = 0; f < U.fan; f++) {
                    const a = base + (U.fan > 1 ? (f - (U.fan - 1) / 2) * sp : 0), len = U.len * (last ? 1.2 : 1), x2 = ox + Math.cos(a) * len, y2 = oy + Math.sin(a) * len;
                    ultFx({ k: 'line', x: ox, y: oy, a: a, rng: len, w: U.width * (last ? 1.5 : 1), fin: last ? 1 : 0, c: col });
                    enemies.forEach(e => { if (e.hp > 0 && e.act !== false && distSeg(e.x, e.y, ox, oy, x2, y2) < U.width / 2 + e.r) ultHit(e, U.mult * (last ? 1.8 : 1) / Math.sqrt(U.fan), 120, last); });
                }
                if (U.fan === 1) { me.dashVX = Math.cos(base) * 900; me.dashVY = Math.sin(base) * 900; me.dashT = 0.12; }
                if (last) { addShake(4, 0.18); hitStop(0.07); }
            });
        } else if (U.st === 'volley') {
            for (let i = 0; i < U.n; i++) ultLater(i * U.gap, () => {
                const ts = ultTargets(560), e = ts.length ? ts[Math.floor(Math.random() * ts.length)] : null, last = i === U.n - 1;
                if (!e) { const a = ang0 + (Math.random() - 0.5) * 0.8; ultFx({ k: 'line', x: me.x, y: me.y, a: a, rng: 260, w: 10, fin: 0, c: col }); return; }
                if (U.sky) ultFx({ k: 'line', x: e.x, y: e.y - 240, a: Math.PI / 2, rng: 240, w: 12, fin: last ? 1 : 0, c: col });
                else { const a = Math.atan2(e.y - me.y, e.x - me.x); me.ang = a; ultFx({ k: 'line', x: me.x, y: me.y, a: a, rng: dist(me.x, me.y, e.x, e.y), w: 12, fin: last ? 1 : 0, c: col }); }
                ultHit(e, U.mult * (last ? 2 : 1), 40, last); if (last) { addShake(3, 0.15); hitStop(0.05); }
            });
        } else if (U.st === 'storm') {
            fx.push({ k: 'pring', x: me.x, y: me.y, r: 0, max: 150, t: (U.wind || 400) / 1000, life: (U.wind || 400) / 1000, c: col }); netSend('atk', { k: 'ring', x: me.x, y: me.y, a: 0, rad: 150, c: col, fin: 0 });
            for (let i = 0; i < U.n; i++) ultLater((U.wind || 400) + i * U.gap, () => {
                const ts = ultTargets(620), e = ts.length ? ts[Math.floor(Math.random() * ts.length)] : null, last = i === U.n - 1; if (!e) return;
                ultFx({ k: 'line', x: e.x, y: e.y - 280, a: Math.PI / 2, rng: 280, w: 22, fin: 1, c: '#fff6a8' });
                fx.push({ k: 'pring', x: e.x, y: e.y, r: 0, max: 70, t: 0.22, life: 0.22, c: col });
                enemies.forEach(q => { if (q.hp > 0 && q.act !== false && dist(e.x, e.y, q.x, q.y) < 70 + q.r) ultHit(q, U.mult * (last ? 1.8 : 1), 60, last); });
                addShake(1.5, 0.08);
            });
        } else {      // nova：魔法陣を広げて、そのあと大爆発
            const tg = nearestEnemy(me.x, me.y, 700), cx = tg ? tg.x : me.x + Math.cos(ang0) * 240, cy = tg ? tg.y : me.y + Math.sin(ang0) * 240;
            const wind = U.wind || 450;
            fx.push({ k: 'pring', x: cx, y: cy, r: 0, max: U.radius, t: wind / 1000, life: wind / 1000, c: col }); netSend('atk', { k: 'ring', x: cx, y: cy, a: 0, rad: U.radius, c: col, fin: 0 });
            for (let k = 0; k < U.waves; k++) ultLater(wind + k * 260, () => {
                const r = U.radius * (1 + 0.25 * k), last = k === U.waves - 1;
                fx.push({ k: 'pring', x: cx, y: cy, r: 0, max: r, t: 0.4, life: 0.4, c: '#ffffff', fill: true }); netSend('atk', { k: 'ring', x: cx, y: cy, a: 0, rad: r, c: col, fin: 1 });
                enemies.forEach(e => { if (e.hp > 0 && e.act !== false && dist(cx, cy, e.x, e.y) < r + e.r) ultHit(e, U.mult * (last ? 1.4 : 1), 220, last); });
                addShake(5, 0.25); hitStop(0.07);
            });
        }
    }

    // ================= 通常攻撃コンボ =================
    //  連続で攻撃すると、段が進んで動きが変わる。最後の段（フィニッシャー）は大きく振り、強くふっ飛ばす。
    //  m=ダメージ倍率 / r=範囲 / a=角度 / w=幅 / cd=次の攻撃までの間 / kn=ノックバック / lunge=前に踏み込む量(px) / dir=振る向き(1か-1) / fin=フィニッシャー
    const COMBO_STYLES = {
        blade: [{ m: 1.0, dir: 1 }, { m: 1.05, r: 1.05, dir: -1, lunge: 14 }, { m: 1.9, r: 1.25, a: 1.35, cd: 1.5, kn: 1.8, lunge: 30, dir: 1, fin: true }],
        fast:  [{ m: 0.9, dir: 1 }, { m: 0.9, dir: -1 }, { m: 1.0, r: 1.05, dir: 1, lunge: 10 }, { m: 2.2, r: 1.3, a: 1.3, cd: 2.2, kn: 3, lunge: 26, dir: -1, fin: true }],
        heavy: [{ m: 1.0, dir: 1 }, { m: 1.8, r: 1.2, a: 1.1, cd: 1.3, kn: 2, dir: -1, fin: true }],
        pole:  [{ m: 1.0 }, { m: 1.05, r: 1.05, lunge: 12 }, { m: 1.9, r: 1.2, w: 1.6, cd: 1.5, kn: 2, lunge: 24, fin: true }],
        ranged: [{ m: 1.0 }, { m: 1.0 }, { m: 1.6, cd: 1.4, fin: true }]
    };
    const COMBO_BY_TYPE = { dagger: 'fast', fist: 'fast', boots: 'fast', twinblade: 'fast', greatsword: 'heavy', axe: 'heavy', hammer: 'heavy', spear: 'pole', halberd: 'pole', whip: 'pole', kusarigama: 'pole' };
    function comboStyle() { return COMBO_BY_TYPE[weapon.type] || ((T.kind === 'proj') ? 'ranged' : (T.kind === 'line' ? 'pole' : (T.kind === 'smash' ? 'heavy' : 'blade'))); }
    function nextComboStep() {
        const steps = COMBO_STYLES[comboStyle()], t = performance.now() / 1000;
        if (t - (me.comboAt || 0) > (me.comboWin || 0.8)) me.comboI = 0;
        const i = (me.comboI | 0) % steps.length, st = Object.assign({}, steps[i], { i: i, n: steps.length });
        me.comboI = i + 1 >= steps.length ? 0 : i + 1; me.comboAt = t; me.comboWin = P.cd * (st.cd || 1) + 0.55;
        return st;
    }
    let hitStopT = 0;
    function hitStop(sec) { if (partyCount() === 1 && !PVP) hitStopT = Math.max(hitStopT, sec); }      // 当たった一瞬、動きを止める（ひとりで遊ぶときだけ。マルチでは全員の動きを止めてしまうので使わない）
    const SHADE_CACHE = {};
    function shade(hex, f) {      // f>0 で白に近づける／f<0 で黒に近づける
        const key = hex + f; if (SHADE_CACHE[key]) return SHADE_CACHE[key];
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex || '#fff';
        const n = parseInt(m[1], 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
        const t = f > 0 ? 255 : 0, k = Math.abs(f); r = Math.round(r + (t - r) * k); g = Math.round(g + (t - g) * k); b = Math.round(b + (t - b) * k);
        return (SHADE_CACHE[key] = 'rgb(' + r + ',' + g + ',' + b + ')');
    }
    function hitFeel(e, cs, h) {      // 当たった手応え：ドットの火花・画面の揺れ・ヒットストップ
        if (!cs.ult && me.comboAt !== me.ultGainAt) { me.ultGainAt = me.comboAt; ultGain(cs.fin ? 8 : 2.5); }      // 必殺ゲージ：1振りにつき1回だけ溜まる
        const base = Math.atan2(e.y - me.y, e.x - me.x), col = (h && h.crit) ? '#ffd84a' : HW.rarityOf(weapon).color, n = cs.fin ? 14 : 6;
        if (fx.length < 400) for (let i = 0; i < n; i++) { const a = base + (Math.random() - 0.5) * (cs.fin ? 2.4 : 1.6), v = 160 + Math.random() * (cs.fin ? 420 : 260); fx.push({ k: 'pspark', x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, sz: Math.random() < 0.3 ? 8 : 4, t: 0.25 + Math.random() * 0.2, life: 0.45, c: Math.random() < 0.35 ? '#fff' : col }); }
        if (cs.fin) { addShake(3.2, 0.12); hitStop(0.06); fx.push({ k: 'pring', x: e.x, y: e.y, r: 0, max: 46, t: 0.22, life: 0.22, c: col }); }
        else { addShake(0.9, 0.05); if (cs.i >= 1) hitStop(0.025); }
    }

    function strike(e, mult, kb) {
        const h = calcHit(e, mult);
        const pr = onHitProcs(e, h);
        const a = Math.atan2(e.y - me.y, e.x - me.x);
        const k = (kb || 0) * (1 + A('knock'));
        if (T.sup === 'debuff' || T.sup === 'all') pr.st = Object.assign(pr.st || {}, { weaken: 1, slow: 1, curse: 1 });     // 呪詛の杖：弱体・減速・被ダメージ増
        dealHit(e, h.dmg, { crit: h.crit, st: pr.st, kx: Math.cos(a) * k, ky: Math.sin(a) * k });
        if (pr.extra) setTimeout(() => { if (e.hp > 0) dealHit(e, h.dmg * 0.6, { crit: false }); }, 90);
        return h;
    }

    function doAttack() {
        const atkCost = Math.max(1, Math.round(P.cd * ATK_ENERGY_PER_SEC * 10) / 10);
        if (me.energy < atkCost) { me.atkCd = 0.2; flashEnergy(); return; }   // エネルギー切れ：クイズに正解して回復
        me.energy -= atkCost; updateEnergyUI();
        const ang = aimAngle(); me.ang = ang;
        const cdv = P.cd / (me.haste > 0 ? 1.4 : 1);
        const cs = nextComboStep(); me.atkCd = cdv * (cs.cd || 1);
        const hit = (e, base) => { const h = strike(e, (base || 1) * cs.m, (T.knock || 0) * (cs.kn || 1)); hitFeel(e, cs, h); return h; };
        const d = { k: T.kind, x: me.x, y: me.y, a: ang, rng: P.range * (cs.r || 1), arc: (T.arc || 0) * (cs.a || 1), rad: (P.radius || T.radius) * (cs.r || 1), w: (T.width || 0) * (cs.w || 1), c: HW.rarityOf(weapon).color, cs: cs.i, dir: cs.dir || 1, fin: cs.fin ? 1 : 0 };
        spawnAtkFx(d); netSend('atk', d); mySwing(d);
        if (T.sup === 'heal' || T.sup === 'buff' || T.sup === 'all') supportPulse(T);
        // デュアルウェポン：3回に1回、もう一つの武器で追撃（攻撃力70%）
        if (AB('dual_weapon') && ((me.atkN = (me.atkN || 0) + 1) % 3) === 0) {
            setTimeout(() => {
                if (run.phase !== 'run' || me.dead || me.stunT > 0) return;
                const n = nearestEnemy(me.x, me.y, Math.max(160, P.range || 0) + 80);
                if (n) { fx.push({ k: 'line', x: me.x, y: me.y, x2: n.x, y2: n.y, t: 0.2, life: 0.2, c: '#ffd0ff' }); strike(n, 0.7, 40); }
            }, 120);
        }
        const lg = cs.lunge != null ? cs.lunge : (T.lunge || 0);
        if (lg) { const L = blinkLimit(me.x, me.y, ang, lg, me.r); me.x += Math.cos(ang) * L; me.y += Math.sin(ang) * L; pushOutOfRocks(me, me.r); }

        if (T.kind === 'cone') {
            const range = d.rng, arc = d.arc;
            const swing = () => enemies.forEach(e => {
                if (e.hp <= 0) return;
                const dd = dist(me.x, me.y, e.x, e.y);
                if (dd > range + e.r) return;
                let da = Math.atan2(e.y - me.y, e.x - me.x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
                if (Math.abs(da) <= arc / 2 || dd < e.r + 18) hit(e, 1);
            });
            swing();
            // 連続ヒットする武器（双刃など）：1振りで T.multi 回当たる
            for (let i = 1; i < (T.multi || 1); i++) setTimeout(() => { if (run.phase === 'run' && !me.dead && !(me.stunT > 0)) { spawnAtkFx(d); swing(); } }, i * 85);
        } else if (T.kind === 'line') {
            const x2 = me.x + Math.cos(ang) * d.rng, y2 = me.y + Math.sin(ang) * d.rng;
            enemies.forEach(e => { if (e.hp > 0 && distSeg(e.x, e.y, me.x, me.y, x2, y2) < (T.width || 24) * (cs.w || 1) / 2 + e.r) hit(e, 1); });
        } else if (T.kind === 'ring') {
            enemies.forEach(e => { if (e.hp > 0 && dist(me.x, me.y, e.x, e.y) < d.rad + e.r) hit(e, 1); });
        } else if (T.kind === 'smash') {
            const cx = me.x + Math.cos(ang) * (T.reach || 60), cy = me.y + Math.sin(ang) * (T.reach || 60);
            fx.push({ k: 'pring', x: cx, y: cy, r: 0, max: d.rad, t: 0.3, life: 0.3, c: '#ffcf8a', fill: true });
            enemies.forEach(e => { if (e.hp > 0 && dist(cx, cy, e.x, e.y) < d.rad + e.r) hit(e, 1); });
        } else if (T.kind === 'proj') {
            const n = (T.spread || 1) + Math.round(A('projExtra')) + (cs.fin && !T.spread ? 2 : 0);      // フィニッシャーは弾が増える
            const spread = T.spread ? 0.16 : 0.12;
            const sentShots = [];
            setTimeout(() => { if (sentShots.length) netSend('shot', { s: sentShots }); }, 0);   // 全部の弾が出来てからまとめて送る
            for (let i = 0; i < n; i++) {
                const a = ang + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
                sentShots.push({ x: Math.round(me.x), y: Math.round(me.y), vx: Math.round(Math.cos(a) * T.speed), vy: Math.round(Math.sin(a) * T.speed), r: T.radius, life: +(T.range / T.speed).toFixed(2), pierce: (T.pierce || 0) + Math.round(A('pierce')), aoe: T.aoe || 0, c: HW.rarityOf(weapon).color });
                myShots.push({ x: me.x, y: me.y, vx: Math.cos(a) * T.speed, vy: Math.sin(a) * T.speed, r: T.radius, life: T.range / T.speed, pierce: (T.pierce || 0) + Math.round(A('pierce')), hit: {}, homing: !!T.homing, aoe: T.aoe || 0, c: HW.rarityOf(weapon).color, m: cs.m, fin: cs.fin ? 1 : 0, cs: cs.i, vol: me.comboAt, ar: (weapon.type === 'bow' || weapon.type === 'crossbow') ? 1 : 0 });
            }
        }
    }
    function distSeg(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
        let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; t = clamp(t, 0, 1);
        return dist(px, py, x1 + dx * t, y1 + dy * t);
    }
    function spawnAtkFx(d) {
        const L = d.fin ? 0.3 : 0.2;
        if (d.k === 'cone') fx.push({ k: 'pslash', x: d.x, y: d.y, a: d.a, rng: d.rng, arc: d.arc, dir: d.dir || 1, fin: !!d.fin, t: L, life: L, c: d.c });
        else if (d.k === 'line') fx.push({ k: 'pthrust', x: d.x, y: d.y, a: d.a, rng: d.rng, w: d.w || 14, fin: !!d.fin, t: L, life: L, c: d.c });
        else if (d.k === 'ring') fx.push({ k: 'pring', x: d.x, y: d.y, r: 0, max: d.rad || 100, t: 0.25, life: 0.25, c: d.c });
        else if (d.k === 'smash') fx.push({ k: 'pring', x: d.x + Math.cos(d.a) * 60, y: d.y + Math.sin(d.a) * 60, r: 0, max: d.rad || 90, t: 0.25, life: 0.25, c: d.c, fill: !!d.fin });
    }

    function doDash() {
        if (me.dead || me.stunT > 0 || me.cast || me.gch > 0 || me.ultT > 0 || me.dashCd > 0 || run.phase !== 'run') return;
        if (A('noDash') > 0) { if (me.noDashMsg !== true) { popups.push({ x: me.x, y: me.y - 30, t: 0.8, text: 'ダッシュ不可', c: '#ff9a9a' }); me.noDashMsg = true; setTimeout(() => { me.noDashMsg = false; }, 1500); } return; }
        let mx = input.mx, my = input.my;
        if (!mx && !my) { mx = Math.cos(me.ang); my = Math.sin(me.ang); }
        const l = Math.hypot(mx, my) || 1;
        me.dashVX = mx / l * 640; me.dashVY = my / l * 640; me.dashT = 0.18; me.dashCd = P.dashCd; me.inv = Math.max(me.inv, 0.22); me.invHard = 0.22;
        fx.push({ k: 'puff', x: me.x, y: me.y, t: 0.25, life: 0.25, c: '#bfe6ff' });
        agg.procs.filter(p => p.on === 'dash').forEach(p => { me.dashBlast = p.v; });
        accEvent('dash');
    }

    // ---------- アクティブスキル（従来のモジュール式スキル：投射／レーザー／斬撃／衝撃波）----------
    // 形・効果・強化は action-skills.js のものをそのまま使う。Z X C V で発動。エネルギーを消費し、
    // エネルギーはクイズ正解で溜まる。威力は「装備武器の攻撃力 × スキル倍率」で決まる。
    const skillSlots = (window.ActionSkills ? ActionSkills.loadLoadout() : []).map(sk => (sk && ActionSkills.isFormUnlocked(sk.form)) ? Object.assign(ActionSkills.compute(sk), { cdLeft: 0 }) : null);   // 討伐で解放していない形のスキルは使えない
    while (skillSlots.length < 4) skillSlots.push(null);
    const SELF_FX = ['fortify', 'haste', 'regenerate', 'empower', 'barrier'];

    function skillFx(d, who) {
        const c = d.c || '#9df0ff';
        if (d.f === 'meteor') {   // 着弾予告（点線の輪）→ 着弾の爆発
            fx.push({ k: 'warn', x: d.x, y: d.y, r: d.r, t: d.dl, life: d.dl, c: '#ffb070' });
            setTimeout(() => { fx.push({ k: 'ring', x: d.x, y: d.y, r: 0, max: d.r, t: 0.4, life: 0.4, c: '#ffd9a0', fill: true }); }, d.dl * 1000);
            return;
        }
        if (d.f === 'orbit') { if (who && who !== me) who.orb = { t: d.dur, r: d.r, n: d.n }; return; }
        if (d.f === 'thrust') {   // 突き：細く鋭い白い線
            fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x + Math.cos(d.a) * d.len, y2: d.y + Math.sin(d.a) * d.len, t: 0.22, life: 0.22, c: '#9df0ff', w: d.w || 30 });
            fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x + Math.cos(d.a) * d.len, y2: d.y + Math.sin(d.a) * d.len, t: 0.22, life: 0.22, c: '#ffffff', w: Math.max(4, (d.w || 30) * 0.4) });
            return;
        }
        if (d.f === 'flash') {    // 一閃：出発点と到着点に輪、その間を光が走る
            fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x2, y2: d.y2, t: 0.4, life: 0.4, c: '#fff3b0', w: d.w || 56 });
            fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x2, y2: d.y2, t: 0.4, life: 0.4, c: '#ffffff', w: 8 });
            fx.push({ k: 'ring', x: d.x, y: d.y, r: 0, max: 40, t: 0.3, life: 0.3, c: '#fff3b0', fill: true });
            fx.push({ k: 'ring', x: d.x2, y: d.y2, r: 0, max: 50, t: 0.35, life: 0.35, c: '#ffffff', fill: true });
            return;
        }
        if (d.f === 'laser') fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x + Math.cos(d.a) * d.len, y2: d.y + Math.sin(d.a) * d.len, t: 0.3, life: 0.3, c: '#9df0ff', w: d.w || 24 });
        else if (d.f === 'slash') fx.push({ k: 'arc', x: d.x, y: d.y, a: d.a, rng: d.r, arc: d.arc, t: 0.26, life: 0.26, c: '#c6f0ff' });
        else if (d.f === 'nova') fx.push({ k: 'ring', x: d.x, y: d.y, r: 0, max: d.r, t: 0.35, life: 0.35, c: '#ffe6a0', fill: true });
        else fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x + Math.cos(d.a) * 40, y2: d.y + Math.sin(d.a) * 40, t: 0.15, life: 0.15, c: c, w: 6 });
    }

    // 命中した敵1体への処理（ダメージ＋効果）
    function skillHit(e, base, hasDmg, eff, ang) {
        let dmg = hasDmg ? base * rnd(0.95, 1.05) : 0;
        dmg *= e.pvp ? 1 : (e.boss ? 1 + A('dmgBoss') : 1 + A('dmgMob'));
        if (eff.indexOf('shatter') >= 0) dmg *= 1.3;
        if (eff.indexOf('explosion') >= 0) dmg += Math.max(2, dmg * 0.4);
        dmg = Math.round(dmg);
        const st = {};
        const has = k => eff.indexOf(k) >= 0;
        if (has('burn')) st.burn = Math.max(1, dmg * 0.6 / 3);
        if (has('soulburn')) st.burn = Math.max(st.burn || 0, Math.max(2, dmg * 1.1 / 3));
        if (has('poison')) st.poison = Math.max(1, dmg * 0.45 / 4);
        if (has('frostbite')) { st.slow = 1; st.poison = Math.max(st.poison || 0, Math.max(1, dmg * 0.3 / 3)); }
        if (has('freeze')) st.slow = 1;
        if (has('weaken')) st.weaken = 1;
        if (has('blind')) st.blind = 1;
        if (has('stun')) st.stun = Math.max(st.stun || 0, 1.0);
        if (has('petrify')) st.stun = Math.max(st.stun || 0, 1.6);
        if (has('chronowarp')) st.stun = Math.max(st.stun || 0, 2.6);
        let knock = 40;
        if (has('knockback')) knock += 300;
        if (has('gravity')) knock -= 260 + 40;     // 負の値＝自分の方へ引き寄せる
        const a = Math.atan2(e.y - me.y, e.x - me.x), res = e.boss ? 0.4 : 1;
        if (hasDmg && dmg > 0) {
            if (has('drain')) healMe(dmg * 0.3);
            if (has('voidrend')) healMe(dmg * 0.6);
        }
        dealHit(e, dmg, { st: Object.keys(st).length ? st : null, kx: Math.cos(a) * knock * res, ky: Math.sin(a) * knock * res, el: eff.filter(k => k.indexOf('el:') === 0).map(k => k.slice(3)) });
    }
    function healMe(v) {
        v = Math.round(v); if (v <= 0 || me.dead) return;
        const got = Math.round(addHp(v)); if (got <= 0) return;      // 回復の効きは addHp が、難易度やサドンデスに応じて弱める
        popups.push({ x: me.x, y: me.y - 30, t: 0.7, text: '+' + got, c: '#7CFC9A' });
    }
    function applySelfFx(key) {
        const tag = (t, c) => popups.push({ x: me.x, y: me.y - 46, t: 0.9, text: t, c: c });
        if (key === 'fortify') { me.fortifyT = 3; tag('防御UP', '#9df0ff'); }
        else if (key === 'haste') { me.haste = Math.max(me.haste, 3); tag('速度UP', '#9df0ff'); }
        else if (key === 'empower') { me.empowerT = 3; tag('攻撃UP', '#ffb347'); }
        else if (key === 'regenerate') { me.regenT = 4; tag('再生', '#7CFC9A'); }
        else if (key === 'barrier') { me.barrierHp = (me.barrierHp || 0) + Math.max(10, Math.round(me.maxHp * 0.25)); tag('バリア', '#7fc8ff'); }
    }

    function castSkill(slot, charged) {      // charged=true は、溜めが終わって実際に発動するとき
        const s = skillSlots[slot];
        if (!s || me.dead || me.stunT > 0 || me.ultT > 0 || run.phase !== 'run') return;
        if (!charged) {
            if (s.cdLeft > 0 || me.cast || me.gch > 0) return;
            if (me.energy < s.cost) { flashEnergy(); return; }
            me.energy -= s.cost; s.cdLeft = s.cooldown * (1 + A('skillCdUp')); updateEnergyUI();
            const cs = CHARGE_SEC[s.params.form] || 0;
            if (cs > 0) {      // 溜め開始：エネルギーとクールタイムは先に使う。発動の向きと狙いは、溜め終わりの瞬間に決まる
                me.cast = { slot: slot, t: cs, max: cs, form: s.params.form }; me.dashT = 0; me.ang = aimAngle();
                popups.push({ x: me.x, y: me.y - 34, t: 0.9, text: '溜め…' + (CHARGE_NAME[s.params.form] || ''), c: '#ffe08a' });
                return;
            }
        }
        accEvent('skill');
        if (GMK === 'dimension' && G.dp === 1) { if (isHost) hostReflect(me.x, me.y); else netSend('refl', { x: Math.round(me.x), y: Math.round(me.y) }); }   // スキルのタイミングで放射弾を跳ね返す
        const p = s.params, ang = aimAngle(); me.ang = ang;
        popups.push({ x: me.x, y: me.y - 34, t: 0.9, text: s.skill.name, c: '#9df0ff' });
        if (p.form !== 'domain' && p.form !== 'summon') p.effects.forEach(k => { if (SELF_FX.indexOf(k) >= 0) applySelfFx(k); });   // 領域は中にいる間だけ、ミニオン召喚はミニオンがいる間だけ効く
        const eff = p.effects.filter(k => k !== 'damage' && SELF_FX.indexOf(k) < 0);
        if (p.element) eff.push('el:' + p.element);       // スキルの属性（skillHit が読む）
        const hasDmg = p.effects.indexOf('damage') >= 0;
        const base = weapon.dmg * P.atkMul * atkDyn() * p.baseMult * p.dmgMult * (1 + P.special / 300) * (me.empowerT > 0 ? 1.35 : 1) * (1 + A('skillPct')) * (AB('guts') && me.hp <= 1.5 ? 3 : 1);
        const later = (sec, fn) => setTimeout(() => { if (run.phase === 'run' && !me.dead && !(me.stunT > 0)) fn(); }, sec * 1000);

        if (p.pieces) { castPieces(p, base, hasDmg, eff, ang, later, s.skill.id); return; }   // 自由配置のスキル、突き、一閃

        if (p.form === 'projectile') {
            for (let i = 0; i < p.count; i++) {
                const a = ang + (i - (p.count - 1) / 2) * p.spread;
                myShots.push({ x: me.x, y: me.y, vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed, r: p.radius, life: p.range / p.speed, pierce: p.pierce, hit: {}, homing: false, c: '#8fd3ff', skill: { base: base, hasDmg: hasDmg, eff: eff } });
            }
            const d = { f: 'projectile', x: me.x, y: me.y, a: ang }; skillFx(d); netSend('sk', d);
            const sk = []; for (let i = 0; i < p.count; i++) { const a = ang + (i - (p.count - 1) / 2) * p.spread; sk.push({ x: Math.round(me.x), y: Math.round(me.y), vx: Math.round(Math.cos(a) * p.speed), vy: Math.round(Math.sin(a) * p.speed), r: p.radius, life: +(p.range / p.speed).toFixed(2), pierce: p.pierce, c: '#8fd3ff' }); }
            netSend('shot', { s: sk });
        } else if (p.form === 'laser') {
            for (let i = 0; i < p.count; i++) {
                const a = ang + (i - (p.count - 1) / 2) * p.spread;
                const d = { f: 'laser', x: me.x, y: me.y, a: a, len: p.length, w: p.width }; skillFx(d); netSend('sk', d);
                const x2 = me.x + Math.cos(a) * p.length, y2 = me.y + Math.sin(a) * p.length;
                enemies.forEach(e => { if (e.hp > 0 && distSeg(e.x, e.y, me.x, me.y, x2, y2) <= p.width / 2 + e.r) skillHit(e, base, hasDmg, eff, a); });
            }
        } else if (p.form === 'slash') {
            for (let i = 0; i < p.count; i++) {
                later(i * p.delay, () => {
                    const a = aimAngle() + (i % 2 ? 0.12 : -0.12); me.ang = a;
                    const d = { f: 'slash', x: me.x, y: me.y, a: a, r: p.radius, arc: p.arc }; skillFx(d); netSend('sk', d);
                    enemies.forEach(e => {
                        if (e.hp <= 0) return;
                        const dd = dist(me.x, me.y, e.x, e.y); if (dd > p.radius + e.r) return;
                        let da = Math.atan2(e.y - me.y, e.x - me.x) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
                        if (Math.abs(da) <= p.arc / 2 || dd < e.r + 18) skillHit(e, base, hasDmg, eff, a);
                    });
                });
            }
        } else if (p.form === 'nova') {
            for (let i = 0; i < p.count; i++) {
                later(i * p.delay, () => {
                    const d = { f: 'nova', x: me.x, y: me.y, r: p.radius }; skillFx(d); netSend('sk', d);
                    enemies.forEach(e => { if (e.hp > 0 && dist(me.x, me.y, e.x, e.y) <= p.radius + e.r) skillHit(e, base, hasDmg, eff, 0); });
                });
            }
        } else if (p.form === 'meteor') {
            // 狙った方向にいちばん近い敵（いなければ狙った地点）に隕石を落とす。着弾までの間に動かれると外れる
            const ax = clamp(me.x + Math.cos(ang) * 260, 30, WORLD_W - 30), ay = clamp(me.y + Math.sin(ang) * 260, 30, WORLD_H - 30);
            const tg = nearestEnemy(ax, ay, 320);
            const bx = tg ? tg.x : ax, by = tg ? tg.y : ay;
            for (let i = 0; i < p.count; i++) {
                const tx = clamp(bx + (i === 0 ? 0 : rnd(-1, 1) * p.radius * 1.1), 30, WORLD_W - 30), ty = clamp(by + (i === 0 ? 0 : rnd(-1, 1) * p.radius * 1.1), 30, WORLD_H - 30);
                const fall = p.delay + i * p.stagger;
                const d = { f: 'meteor', x: tx, y: ty, r: p.radius, dl: fall }; skillFx(d); netSend('sk', d);
                setTimeout(() => {
                    if (run.phase !== 'run') return;
                    enemies.forEach(e => { if (e.hp > 0 && dist(tx, ty, e.x, e.y) <= p.radius + e.r) skillHit(e, base, hasDmg, eff, Math.atan2(e.y - ty, e.x - tx)); });
                }, fall * 1000);
            }
        } else if (p.form === 'orbit') {
            me.orb = { t: p.duration, n: p.orbs, r: p.orbitR, tick: {}, spin: p.spin, base: base, hasDmg: hasDmg, eff: eff, ptick: p.tick };
            const d = { f: 'orbit', dur: p.duration, r: p.orbitR, n: p.orbs }; skillFx(d, me); netSend('sk', d);
        }
    }

    // 自由配置（layout）のスキルと、突き・一閃の発動。
    //   配置1つ = 出る場所（前後・左右）、向き、大きさ。位置と向きは、撃った瞬間の自分と狙った向きが基準
    function castPieces(p, base, hasDmg, eff, ang, later, skillId) {
        const rad = d => d * Math.PI / 180, c0 = Math.cos(ang), s0 = Math.sin(ang);
        const pieces = p.pieces.map(pc => ({
            x: clamp(me.x + pc.fw * c0 - pc.sd * s0, 20, WORLD_W - 20), y: clamp(me.y + pc.fw * s0 + pc.sd * c0, 20, WORLD_H - 20),
            a: ang + rad(pc.a), s: pc.s, k: 0.8 + 0.2 * pc.s     // k：大きいほど少しだけ威力も上がる
        }));
        const hitAll = (fn, k, a) => enemies.forEach(e => { if (e.hp > 0 && fn(e)) skillHit(e, base * k, hasDmg, eff, a); });
        const live = !p.custom;     // 標準配置の突き・一閃は、撃った後も狙った向きに追従する

        if (p.form === 'projectile') {
            const sk = [];
            pieces.forEach(q => {
                const vx = Math.cos(q.a) * p.speed, vy = Math.sin(q.a) * p.speed, r = p.radius * q.s, life = p.range / p.speed;
                myShots.push({ x: q.x, y: q.y, vx: vx, vy: vy, r: r, life: life, pierce: p.pierce, hit: {}, homing: false, c: '#8fd3ff', skill: { base: base * q.k, hasDmg: hasDmg, eff: eff } });
                const d = { f: 'projectile', x: q.x, y: q.y, a: q.a }; skillFx(d); netSend('sk', d);
                sk.push({ x: Math.round(q.x), y: Math.round(q.y), vx: Math.round(vx), vy: Math.round(vy), r: r, life: +life.toFixed(2), pierce: p.pierce, c: '#8fd3ff' });
            });
            netSend('shot', { s: sk });
        } else if (p.form === 'laser') {
            pieces.forEach(q => {
                const len = Math.min(900, p.length * q.s), w = p.width * Math.pow(q.s, 0.7);
                const d = { f: 'laser', x: q.x, y: q.y, a: q.a, len: len, w: w }; skillFx(d); netSend('sk', d);
                const x2 = q.x + Math.cos(q.a) * len, y2 = q.y + Math.sin(q.a) * len;
                hitAll(e => distSeg(e.x, e.y, q.x, q.y, x2, y2) <= w / 2 + e.r, q.k, q.a);
            });
        } else if (p.form === 'slash') {
            pieces.forEach((q, i) => later(i * 0.08, () => {
                const rr = p.radius * q.s;
                const d = { f: 'slash', x: q.x, y: q.y, a: q.a, r: rr, arc: p.arc }; skillFx(d); netSend('sk', d);
                hitAll(e => {
                    const dd = dist(q.x, q.y, e.x, e.y); if (dd > rr + e.r) return false;
                    let da = Math.atan2(e.y - q.y, e.x - q.x) - q.a; da = Math.atan2(Math.sin(da), Math.cos(da));
                    return Math.abs(da) <= p.arc / 2 || dd < e.r + 18;
                }, q.k, q.a);
            }));
        } else if (p.form === 'nova') {
            pieces.forEach((q, i) => later(i * 0.1, () => {
                const rr = p.radius * q.s;
                const d = { f: 'nova', x: q.x, y: q.y, r: rr }; skillFx(d); netSend('sk', d);
                hitAll(e => dist(q.x, q.y, e.x, e.y) <= rr + e.r, q.k, 0);
            }));
        } else if (p.form === 'meteor') {
            pieces.forEach((q, i) => {
                const rr = p.radius * q.s, fall = p.delay + i * 0.12;
                const d = { f: 'meteor', x: q.x, y: q.y, r: rr, dl: fall }; skillFx(d); netSend('sk', d);
                setTimeout(() => {
                    if (run.phase !== 'run') return;
                    hitAll(e => dist(q.x, q.y, e.x, e.y) <= rr + e.r, q.k, 0);
                }, fall * 1000);
            });
        } else if (p.form === 'barrage') {
            // 包囲弾幕：狙った敵（いなければ照準の先）の周りの円周に、弾を数回に分けて出し、中心へまっすぐ飛ばす（追尾なし）
            const tgt = nearestEnemy(me.x, me.y, p.range), cx = tgt ? tgt.x : clamp(me.x + Math.cos(ang) * 380, 30, WORLD_W - 30), cy = tgt ? tgt.y : clamp(me.y + Math.sin(ang) * 380, 30, WORLD_H - 30);
            const col = p.element && window.SBElem && SBElem.ELEMS[p.element] ? SBElem.ELEMS[p.element].color : '#c8a0ff';
            p.pieces.forEach((pc, i) => {
                const px = cx + pc.fw * c0 - pc.sd * s0, py = cy + pc.fw * s0 + pc.sd * c0, R = p.ringR * pc.s, per = Math.max(1, Math.round(p.bullets / p.waves)), k = 0.8 + 0.2 * pc.s;
                fx.push({ k: 'ring', x: px, y: py, r: R * 0.4, max: R, t: 0.45, life: 0.45, c: col });
                for (let w = 0; w < p.waves; w++) later(i * 0.15 + w * p.waveGap, () => {
                    const sk = [], live = tgt && tgt.hp > 0 ? { x: tgt.x + (px - cx), y: tgt.y + (py - cy) } : { x: px, y: py };
                    for (let j = 0; j < per; j++) {
                        const a = (j + w * 0.5 + i * 0.25) * Math.PI * 2 / per, bx = clamp(live.x + Math.cos(a) * R, 5, WORLD_W - 5), by = clamp(live.y + Math.sin(a) * R, 5, WORLD_H - 5);
                        const ta = Math.atan2(live.y - by, live.x - bx), vx = Math.cos(ta) * p.speed, vy = Math.sin(ta) * p.speed, r = p.bulletR * (0.8 + 0.2 * pc.s), life = (R + 120) / p.speed + 0.5;
                        myShots.push({ x: bx, y: by, vx: vx, vy: vy, r: r, life: life, pierce: 0, hit: {}, homing: false, c: col, skill: { base: base * k, hasDmg: hasDmg, eff: eff } });
                        sk.push({ x: Math.round(bx), y: Math.round(by), vx: Math.round(vx), vy: Math.round(vy), r: r, life: +life.toFixed(2), pierce: 0, c: col });
                    }
                    netSend('shot', { s: sk });
                });
            });
        } else if (p.form === 'summon') {
            // ミニオン召喚：配置ごとに1体。同じスキルをもう一度使ったら、前のミニオンは消える
            const selfFx = p.effects.filter(k => SELF_FX.indexOf(k) >= 0), col = domColor(p, selfFx);
            minions = minions.filter(m => m.sid !== skillId);
            pieces.forEach((q, i) => {
                if (minions.length >= 12) return;
                minions.push({ id: myId + '_m' + Date.now().toString(36) + i, sid: skillId, idx: i, x: q.x, y: q.y, r: 13 + 6 * q.s, t: p.duration, max: p.duration, atkT: 0.4 + i * 0.12, cc: 0, spd: p.speed, atkCd: p.atkCd,
                    base: base * q.k, hasDmg: hasDmg, eff: eff, fx: selfFx, c: col, face: 0, lunge: 0 });
                fx.push({ k: 'ring', x: q.x, y: q.y, r: 0, max: 46, t: 0.4, life: 0.4, c: col, fill: true });
            });
        } else if (p.form === 'domain') {
            // 領域：配置ごとに広い領域を展開。中の敵全員にデバフ（ダメージ）、中の味方に回復・バフ
            const selfFx = p.effects.filter(k => SELF_FX.indexOf(k) >= 0);
            pieces.forEach((q, i) => {
                const o = { id: myId + '_' + Date.now().toString(36) + i, sid: skillId + '#' + i, x: q.x, y: q.y, r: p.radius * q.s, t: p.duration, max: p.duration, own: true, tick: p.tick, tk: 0.15 + i * 0.05, cc: 0,
                    base: base * q.k, hasDmg: hasDmg, eff: eff, fx: selfFx, c: domColor(p, selfFx) };
                spawnDomain(o);
                netSend('dom', { id: o.id, x: Math.round(o.x), y: Math.round(o.y), r: Math.round(o.r), t: o.t, fx: selfFx, c: o.c, from: myId });
            });
        } else if (p.form === 'orbit') {
            const avg = pieces.reduce((a, q) => a + q.s, 0) / pieces.length, r = p.orbitR * avg;
            me.orb = { t: p.duration, n: pieces.length, r: r, tick: {}, spin: p.spin, base: base * (0.8 + 0.2 * avg), hasDmg: hasDmg, eff: eff, ptick: p.tick };
            const d = { f: 'orbit', dur: p.duration, r: r, n: pieces.length }; skillFx(d, me); netSend('sk', d);
        } else if (p.form === 'thrust') {
            pieces.forEach((q, i) => later(0.08 + i * p.delay, () => {
                const a = live ? aimAngle() : q.a, x0 = live ? me.x : q.x, y0 = live ? me.y : q.y;
                const len = p.length * q.s, w = p.width * Math.pow(q.s, 0.5);
                const x2 = x0 + Math.cos(a) * len, y2 = y0 + Math.sin(a) * len;
                const d = { f: 'thrust', x: x0, y: y0, a: a, len: len, w: w }; skillFx(d); netSend('sk', d);
                hitAll(e => distSeg(e.x, e.y, x0, y0, x2, y2) <= w / 2 + e.r, q.k, a);
                if (live) { me.ang = a; const L = blinkLimit(me.x, me.y, a, p.lunge, me.r); me.x = clamp(me.x + Math.cos(a) * L, 20, WORLD_W - 20); me.y = clamp(me.y + Math.sin(a) * L, 20, WORLD_H - 20); pushOutOfRocks(me, me.r); }
            }));
        } else if (p.form === 'flash') {
            // 一閃：その場から dist ぶん瞬間移動し、通り道の敵を斬る。複数なら連続で別の向きへ移動する（移動中は無敵）
            pieces.forEach((q, i) => later(i * p.delay, () => {
                const a = q.a, sx = me.x, sy = me.y, dd = p.dist * q.s;
                const stop = blinkLimit(sx, sy, a, dd, me.r);       // 通り道に壁・岩があれば、その手前までしか進めない
                me.x = clamp(sx + Math.cos(a) * stop, 20, WORLD_W - 20); me.y = clamp(sy + Math.sin(a) * stop, 20, WORLD_H - 20);
                pushOutOfRocks(me, me.r); me.ang = a; me.inv = Math.max(me.inv, 0.45);
                const ex = me.x, ey = me.y, w = p.width * Math.pow(q.s, 0.5);
                const d = { f: 'flash', x: sx, y: sy, x2: ex, y2: ey, w: w }; skillFx(d); netSend('sk', d);
                hitAll(e => distSeg(e.x, e.y, sx, sy, ex, ey) <= w / 2 + e.r, q.k, a);
            }));
        }
    }

    // 瞬間移動（一閃）で進める距離：出発点から角度 a の方向へ、壁タイル・岩にぶつかる手前まで（r はプレイヤーの半径）
    function blinkLimit(x, y, a, maxD, r) {
        const step = 8, n = Math.ceil(maxD / step), cx = Math.cos(a), cy = Math.sin(a);
        let ok = 0;
        for (let i = 1; i <= n; i++) {
            const d = Math.min(maxD, i * step), px = x + cx * d, py = y + cy * d;
            let hit = false;
            if (CORR_ON && CF.on) {      // 壁は、体の幅ぶん（左右・前）も見る
                if (corrSolid(px, py) || corrSolid(px + cy * r * 0.7, py - cx * r * 0.7) || corrSolid(px - cy * r * 0.7, py + cx * r * 0.7) || corrSolid(px + cx * r, py + cy * r)) hit = true;
            }
            if (!hit) for (const k of rocks) if (dist(px, py, k.x, k.y) < k.r + r * 0.6) { hit = true; break; }
            if (px < 20 || py < 20 || px > WORLD_W - 20 || py > WORLD_H - 20) hit = true;
            if (hit) break;
            ok = d;
        }
        return ok;
    }

    // ---------- スキル「領域」----------
    //  tick ごとに、中の敵へ skillHit（ダメージ＋デバフ。ただし麻痺・石化・時間凍結は2.5秒に1回だけ）。
    //  中にいる味方（自分を含む）へは、回復・バフ（自己強化系の効果）を、各自の画面で短い時間かけ続ける
    const HARD_CC = ['stun', 'petrify', 'chronowarp'];
    function domColor(p, selfFx) {
        if (p.element && window.SBElem && SBElem.ELEMS[p.element]) return SBElem.ELEMS[p.element].color;
        const debuff = p.effects.some(k => k !== 'damage' && SELF_FX.indexOf(k) < 0);
        return selfFx.length && !debuff ? '#7aff9a' : (selfFx.length ? '#ffd86a' : (debuff ? '#c070ff' : '#9df0ff'));
    }
    function spawnDomain(o) {
        if (o.own && o.sid) domains = domains.filter(d => !(d.own && d.sid === o.sid));   // 同じスキルをもう一度使ったら、前の領域は消えて置き換わる（重ねがけで二重にヒットしない）
        domains.push(o);
        fx.push({ k: 'ring', x: o.x, y: o.y, r: 0, max: o.r * 1.1, t: 0.6, life: 0.6, c: o.foe ? '#ff9a9a' : '#ffe9a0' });                 // 門が開く：金色の輪が広がる（相手の領域は赤）
        fx.push({ k: 'ring', x: o.x, y: o.y, r: 0, max: o.r * 0.6, t: 0.45, life: 0.45, c: o.foe ? '#ffd0d0' : '#fff6d0', fill: true });
    }
    function updateDomains(dt) {
        if (!domains.length) return;
        domains.forEach(d => {
            d.t -= dt;
            // 中にいる自分へ、味方の領域（自分の領域も）の回復・バフ
            if (!d.foe && d.fx && d.fx.length && !me.dead && dist(me.x, me.y, d.x, d.y) <= d.r) {
                d.bt = (d.bt || 0) - dt;
                if (d.bt <= 0) {
                    d.bt = 0.4;
                    d.fx.forEach(k => {
                        if (k === 'fortify') me.fortifyT = Math.max(me.fortifyT || 0, 1.0);
                        else if (k === 'haste') me.haste = Math.max(me.haste || 0, 1.0);
                        else if (k === 'empower') me.empowerT = Math.max(me.empowerT || 0, 1.0);
                        else if (k === 'regenerate') me.regenT = Math.max(me.regenT || 0, 1.0);
                        else if (k === 'barrier' && (me.barrierHp || 0) < me.maxHp * 0.12) me.barrierHp = Math.max(10, Math.round(me.maxHp * 0.2));
                    });
                }
            }
            // 領域の持ち主だけが、中の敵へダメージとデバフ
            if (d.own && d.t > 0) {
                d.tk -= dt;
                if (d.tk <= 0) {
                    d.tk += d.tick; d.cc -= d.tick;
                    const full = d.cc <= 0; if (full) d.cc = 2.5;
                    const eff = full ? d.eff : d.eff.filter(k => HARD_CC.indexOf(k) < 0);
                    enemies.forEach(e => { if (e.hp > 0 && !e.pvp && dist(e.x, e.y, d.x, d.y) <= d.r + e.r) skillHit(e, d.base, d.hasDmg, eff, Math.atan2(e.y - d.y, e.x - d.x)); });
                }
            }
        });
        domains = domains.filter(d => d.t > 0);
    }
    // 領域の見た目：ゲートキーパーの「門」と同じ、金色の魔法陣。開くときに広がり、閉じる直前に点滅する
    //  （外側の輪と光の粒＝門の縁／中の輪と放射線が逆回転／いちばん内側に、領域の種類の色＝属性・回復・デバフ）
    // ---------- スキル「ミニオン召喚」----------
    //  ミニオンは自分の画面で動かす。敵に近づいて、atkCd ごとに skillHit（ダメージ＋デバフ）。敵がいなければ自分の周りを回る。
    //  召喚者には、生きている間バフ・回復（自己強化系の効果）が効き続ける。他のプレイヤーには、位置だけを送って表示する
    function applyAuraFx(list) {
        list.forEach(k => {
            if (k === 'fortify') me.fortifyT = Math.max(me.fortifyT || 0, 1.0);
            else if (k === 'haste') me.haste = Math.max(me.haste || 0, 1.0);
            else if (k === 'empower') me.empowerT = Math.max(me.empowerT || 0, 1.0);
            else if (k === 'regenerate') me.regenT = Math.max(me.regenT || 0, 1.0);
            else if (k === 'barrier' && (me.barrierHp || 0) < me.maxHp * 0.12) me.barrierHp = Math.max(10, Math.round(me.maxHp * 0.2));
        });
    }
    function updateMinions(dt) {
        if (me.dead) minions = [];
        if (minions.length) {
            hadMinions = true;
            const tn = performance.now() / 1000;
            auraT -= dt;
            if (auraT <= 0) { auraT = 0.4; const auraFx = minions[0].fx; if (auraFx && auraFx.length) applyAuraFx(auraFx); }
            minions.forEach(m => {
                m.t -= dt; m.lunge = Math.max(0, m.lunge - dt);
                let tgt = null, bd = 650;
                enemies.forEach(e => { if (e.hp > 0) { const d = dist(m.x, m.y, e.x, e.y) - e.r; if (d < bd) { bd = d; tgt = e; } } });
                let tx, ty, stop;
                if (tgt) { tx = tgt.x; ty = tgt.y; stop = m.r + tgt.r * 0.6; }
                else { const n = Math.max(1, minions.length), an = tn * 0.9 + m.idx * Math.PI * 2 / n; tx = me.x + Math.cos(an) * 90; ty = me.y + Math.sin(an) * 90; stop = 4; }
                const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
                if (d > stop) { const step = Math.min(d - stop, m.spd * dt * (d > 400 && !tgt ? 2 : 1)); m.x += dx / d * step; m.y += dy / d * step; }
                m.x = clamp(m.x, 10, WORLD_W - 10); m.y = clamp(m.y, 10, WORLD_H - 10);
                m.face = Math.atan2(dy, dx);
                m.atkT -= dt;
                if (tgt && m.atkT <= 0 && dist(m.x, m.y, tgt.x, tgt.y) <= m.r + tgt.r + 26) {
                    m.atkT = m.atkCd; m.cc -= m.atkCd; m.lunge = 0.15;
                    const full = m.cc <= 0; if (full) m.cc = 2.5;     // 麻痺・石化・時間凍結は同じ敵に2.5秒に1回
                    skillHit(tgt, m.base, m.hasDmg, full ? m.eff : m.eff.filter(k => HARD_CC.indexOf(k) < 0), Math.atan2(tgt.y - m.y, tgt.x - m.x));
                    fx.push({ k: 'ring', x: tgt.x, y: tgt.y, r: 0, max: 34, t: 0.2, life: 0.2, c: m.c });
                }
            });
            minions = minions.filter(m => m.t > 0);
        }
        // 他のプレイヤーへ、位置だけを送る（0.2秒ごと。いなくなったら空を1回送る）
        minionSendT -= dt;
        if (minionSendT <= 0 && (minions.length || hadMinions)) {
            minionSendT = 1 / 15; minionSeq++;
            netSend('mn', { q: minionSeq, l: minions.slice(0, 12).map(m => [Math.round(m.x), Math.round(m.y), Math.round(m.r), Math.round(m.t * 10) / 10, +(m.face || 0).toFixed(2), m.lunge > 0 ? 1 : 0]), c: minions[0] ? minions[0].c : '#9df0ff' });
            if (!minions.length) hadMinions = false;
        }
        // 他のプレイヤーのミニオン：届いた位置へ、速度を使って先読みしながら滑らかに近づく。更新が1秒途絶えたら消す
        const nowR = performance.now(), kR = 1 - Math.exp(-dt * 18);
        Object.keys(remoteMinions).forEach(id => {
            const rm = remoteMinions[id]; if (nowR - rm.at > 1000) { delete remoteMinions[id]; return; }
            const age = Math.min(0.25, (nowR - rm.at) / 1000);
            rm.l.forEach(q => { const px = q.tx + q.vx * age, py = q.ty + q.vy * age; q.x += (px - q.x) * kR; q.y += (py - q.y) * kR; if (q.lunge > 0) q.lunge -= dt; });
        });
    }
    function drawMinionBody(x, y, r, c, face, frac, hostile, lunge) {
        const tn = performance.now() / 1000, bob = Math.sin(tn * 6 + x * 0.05) * 2;
        const ox = Math.cos(face) * (lunge ? 8 : 0), oy = Math.sin(face) * (lunge ? 8 : 0);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r * 0.9, r * 0.35, 0, 0, 7); ctx.fill();
        const col = hostile ? '#ff6a6a' : c;
        if (window.SBPix && SBPix.on() && SBPix.drawEnemy) {      // ドット絵のミニオン（召喚した相棒）
            SBPix.drawEnemy(ctx, x + ox, y + oy, r, 'chaser', col, { left: Math.cos(face) < 0, seed: x * 0.1, now: performance.now() });
            if (frac < 1) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; const n = Math.max(1, Math.round(16 * Math.max(0, frac))); for (let i = 0; i < n; i++) { const an = -Math.PI / 2 + i / 16 * Math.PI * 2; ctx.fillRect(Math.round((x + ox + Math.cos(an) * (r + 6)) / 2) * 2 - 1, Math.round((y + oy + Math.sin(an) * (r + 6)) / 2) * 2 - 1, 3, 3); } }
            return;
        }
        ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + ox, y + oy + bob, r, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + ox + Math.cos(face) * r * 0.3 - r * 0.3, y + oy + bob - r * 0.15, r * 0.2, 0, 7); ctx.arc(x + ox + Math.cos(face) * r * 0.3 + r * 0.3, y + oy + bob - r * 0.15, r * 0.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#10131b'; ctx.beginPath(); ctx.arc(x + ox + Math.cos(face) * r * 0.45 - r * 0.3, y + oy + bob - r * 0.15, r * 0.09, 0, 7); ctx.arc(x + ox + Math.cos(face) * r * 0.45 + r * 0.3, y + oy + bob - r * 0.15, r * 0.09, 0, 7); ctx.fill();
        if (frac < 1) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + ox, y + oy + bob, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, frac)); ctx.stroke(); }   // 残り時間
    }
    function drawMinions() {
        minions.forEach(m => drawMinionBody(m.x, m.y, m.r, m.c, m.face, m.t / m.max, false, m.lunge > 0));
        Object.keys(remoteMinions).forEach(id => {
            const rm = remoteMinions[id], hostile = PVP && run.pvpMode && !sameTeam(id);
            rm.l.forEach(q => drawMinionBody(q.x, q.y, q.r, rm.c, q.face, q.t > 0 && q.t < 99 ? 1 : 1, hostile, q.lunge > 0));
        });
    }
    const DOM_GOLD = { g0: 'rgba(255,230,140,0.0)', g1: 'rgba(255,210,100,0.26)', g2: 'rgba(255,190,60,0)', s1: 'rgba(255,226,140,0.95)', dot: '#ffe9a0', s2: '#ffd36a', s3: 'rgba(255,233,160,0.85)' };
    const DOM_FOE  = { g0: 'rgba(255,120,120,0.0)', g1: 'rgba(255,70,70,0.26)',   g2: 'rgba(255,40,40,0)',  s1: 'rgba(255,110,110,0.95)', dot: '#ff9a9a', s2: '#ff6a6a', s3: 'rgba(255,150,150,0.85)' };
    function drawDomains() {
        if (!domains.length) return;
        const now = performance.now() / 1000;
        domains.forEach(d => {
            const open = clamp((d.max - d.t) / 0.7, 0, 1), eo = 1 - Math.pow(1 - open, 3);
            let a = eo * clamp(d.t / 0.6, 0, 1);
            if (d.t < 1.4) a *= 0.7 + 0.3 * Math.sin(d.t * 30);          // 閉じる直前は点滅
            if (a <= 0.01) return;
            const R = d.r * (0.55 + 0.45 * eo), K = d.foe ? DOM_FOE : DOM_GOLD;
            ctx.save(); ctx.translate(d.x, d.y); ctx.globalAlpha = a;
            if (window.SBPix && SBPix.on()) {      // ドット絵の領域：粒の輪が回り、内側に回る星と、領域の色の輪
                const z = 4, rowFill = (rr, al) => { ctx.globalAlpha = a * al; for (let y = -rr; y <= rr; y += z) { const hw = Math.round(Math.sqrt(Math.max(0, rr * rr - y * y)) / z) * z; ctx.fillRect(-hw, Math.round(y / z) * z, hw * 2, z); } };
                ctx.fillStyle = K.s2; rowFill(R, 0.1);
                const ringDots = (rr, n, col, rot, sz, every) => { for (let i = 0; i < n; i++) { const an = i / n * Math.PI * 2 + rot; ctx.fillStyle = (every && i % every === 0) ? '#ffffff' : col; ctx.fillRect(Math.round(Math.cos(an) * rr / 2) * 2 - sz / 2, Math.round(Math.sin(an) * rr / 2) * 2 - sz / 2, sz, sz); } };
                ctx.globalAlpha = a; ringDots(R, Math.max(24, Math.floor(R * 0.45)), K.s2, 0, 4, 6);
                ctx.globalAlpha = a; ringDots(R, 24, K.dot, now * 0.5, 8, 0);
                ctx.globalAlpha = a * 0.9; ringDots(R * 0.78, Math.max(18, Math.floor(R * 0.34)), K.s2, -now * 0.9, 4, 0);
                for (let k2 = 0; k2 < 2; k2++) for (let i = 0; i < 3; i++) { const a1 = i * Math.PI * 2 / 3 + k2 * Math.PI / 3 + now * 0.7, a2 = (i + 1) * Math.PI * 2 / 3 + k2 * Math.PI / 3 + now * 0.7, x1 = Math.cos(a1) * R * 0.52, y1 = Math.sin(a1) * R * 0.52, x2 = Math.cos(a2) * R * 0.52, y2 = Math.sin(a2) * R * 0.52, n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6)); ctx.globalAlpha = a * 0.85; ctx.fillStyle = K.dot; for (let j = 0; j <= n; j++) ctx.fillRect(Math.round((x1 + (x2 - x1) * j / n) / 2) * 2 - 2, Math.round((y1 + (y2 - y1) * j / n) / 2) * 2 - 2, 4, 4); }
                ctx.globalAlpha = a * (0.45 + 0.2 * Math.sin(now * 3)); ringDots(R * 0.9, Math.max(20, Math.floor(R * 0.4)), d.c || '#c070ff', 0, 6, 0);
                ctx.restore(); return;
            }
            // 門の光（縁に向かって金色が濃くなる）
            const g = ctx.createRadialGradient(0, 0, R * 0.35, 0, 0, R * 1.12);
            g.addColorStop(0, K.g0); g.addColorStop(0.72, K.g1); g.addColorStop(1, K.g2);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.12, 0, 7); ctx.fill();
            // 外側の輪と、周回する光の粒
            ctx.strokeStyle = K.s1; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
            ctx.save(); ctx.rotate(now * 0.5); ctx.fillStyle = K.dot;
            for (let i = 0; i < 24; i++) { ctx.rotate(Math.PI / 12); ctx.beginPath(); ctx.arc(R, 0, 5, 0, 7); ctx.fill(); }
            ctx.restore();
            // 中の輪（逆回転）と放射線
            ctx.save(); ctx.rotate(-now * 0.9); ctx.strokeStyle = K.s2; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, 7); ctx.stroke();
            for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(R * 0.78, 0); ctx.lineTo(R * 0.94, 0); ctx.stroke(); }
            ctx.restore();
            // さらに内側：星形（二重の三角）が回る
            ctx.save(); ctx.rotate(now * 0.7); ctx.strokeStyle = K.s3; ctx.lineWidth = 2;
            for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const an = i * Math.PI * 2 / 3 + k * Math.PI / 3; const x = Math.cos(an) * R * 0.52, y = Math.sin(an) * R * 0.52; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
            ctx.beginPath(); ctx.arc(0, 0, R * 0.52, 0, 7); ctx.stroke();
            ctx.restore();
            // 領域の種類の色（属性・回復・デバフ）：内側の細い輪
            ctx.globalAlpha = a * (0.45 + 0.2 * Math.sin(now * 3)); ctx.strokeStyle = d.c || '#c070ff'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); ctx.stroke();
            ctx.restore();
        });
    }

    // 旋回：自分の周りを回る光球。同じ敵には ptick 秒に1回ずつヒットする
    function updateOrbit(dt) {
        const o = me.orb; if (!o) return;
        o.t -= dt;
        if (o.t <= 0 || me.dead) { me.orb = null; return; }
        Object.keys(o.tick).forEach(id => { o.tick[id] -= dt; if (o.tick[id] <= 0) delete o.tick[id]; });
        const base = performance.now() / 1000 * o.spin;
        for (let i = 0; i < o.n; i++) {
            const a = base + i * Math.PI * 2 / o.n, ox = me.x + Math.cos(a) * o.r, oy = me.y + Math.sin(a) * o.r;
            enemies.forEach(e => {
                if (e.hp <= 0 || o.tick[e.id] > 0 || dist(ox, oy, e.x, e.y) > e.r + 16) return;
                o.tick[e.id] = o.ptick; skillHit(e, o.base, o.hasDmg, o.eff, a);
            });
        }
    }
    function flashEnergy() { const b = el('enBar'); if (!b) return; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 300); }

    function buildSkillBar() {
        const box = el('skillBar'); box.innerHTML = '';
        const KEYS = ['Z', 'X', 'C', 'V'];
        skillSlots.forEach((s, i) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'skill-btn';
            if (s) b.innerHTML = '<span class="sk-key">' + KEYS[i] + '</span><span class="sk-icon">' + ActionSkills.FORMS[s.skill.form].icon + '</span><span class="sk-name">' + escapeHtml(s.skill.name) + '</span><span class="sk-cost">' + s.cost + '</span><span class="sk-cd"></span>';
            else { b.classList.add('empty'); b.innerHTML = '<span class="sk-key">' + KEYS[i] + '</span><span class="sk-name">未設定</span>'; }
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); castSkill(i); });
            box.appendChild(b);
        });
    }
    function updateSkillBar() {
        Array.from(el('skillBar').children).forEach((b, i) => {
            const s = skillSlots[i]; if (!s) return;
            const cd = b.querySelector('.sk-cd'); const t = s.cdLeft > 0 ? s.cdLeft.toFixed(1) : '';
            if (cd && cd.textContent !== t) cd.textContent = t;
            b.classList.toggle('ready', me.energy >= s.cost && s.cdLeft <= 0);
            b.classList.toggle('short', me.energy < s.cost);
        });
    }
    function addEnergy(v) { me.energy = Math.min(ENERGY_MAX, me.energy + v); updateEnergyUI(); }

    // ---------- 更新 ----------
    function updateMe(dt) {
        accTick(dt);
        tickCharge(dt);
        if (A('selfBleed') > 0 && !me.dead && run.phase === 'run') me.hp = Math.max(1, me.hp - me.maxHp * A('selfBleed') * dt);      // 血の契約（HP1で止まる）
        me.atkCd -= dt; me.dashCd -= dt; me.inv -= dt; if (me.invHard > 0) me.invHard -= dt; if (me.haste > 0) me.haste -= dt; if (me.flash > 0) me.flash -= dt;
        if (me.dead) {
            // 仲間が近くにいると復活する
            const near = !PVP && !me.escaped && Object.keys(allies).some(id => { const a = allies[id]; return !a.dead && dist(a.x, a.y, me.x, me.y) < 90; });
            if (near) { me.reviveT += dt; if (me.reviveT > 2.5) { me.dead = false; me.stg = 0; me.hp = Math.round(me.maxHp * 0.4); me.inv = 1.5; me.invHard = 1.5; announce('復活！', 900); } } else me.reviveT = Math.max(0, me.reviveT - dt);
            return;
        }
        // スタン（動けない・攻撃も回避もできない）。復帰後は少しのあいだスタンしない
        if (me.stunT > 0) {
            me.stunT -= dt; me.dashT = 0;
            if (me.stunT <= 0) { me.stunT = 0; me.stunImm = PVP ? PVP_STUN_IMM : STUN_IMM; popups.push({ x: me.x, y: me.y - 34, t: 0.9, text: '復帰！', c: '#9df0ff' }); }
        } else if (me.stunImm > 0) me.stunImm -= dt;
        const stunned = me.stunT > 0 || !!me.cast || me.gch > 0 || me.ultT > 0;      // 動けない（スタン・スキルの溜め・守りの溜め）
        // 移動
        let mx = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) + input.stick.x;
        let my = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) + input.stick.y;
        const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
        input.mx = mx; input.my = my;
        const sp = P.move * (me.haste > 0 ? 1.3 : 1);
        if (me.dashT > 0) {
            me.dashT -= dt; moveSolid(me, me.dashVX * dt, me.dashVY * dt, me.r);
            if (me.dashT <= 0 && me.dashBlast) { const v = me.dashBlast; me.dashBlast = 0; fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: 130, t: 0.3, life: 0.3, c: '#cfe8ff' }); enemies.forEach(e => { if (e.hp > 0 && dist(e.x, e.y, me.x, me.y) < 140 + e.r) dealHit(e, weapon.dmg * P.atkMul * v, { kx: (e.x - me.x) * 3, ky: (e.y - me.y) * 3 }); }); }
        } else if (!stunned) { moveSolid(me, mx * sp * dt, my * sp * dt, me.r); }
        pushOutOfRocks(me, me.r);
        if (input.aimOn && !isTouch) me.ang = Math.atan2(input.aimY - (VH / 2 + (me.y - cam.y)), input.aimX - (VW / 2 + (me.x - cam.x)));
        if (!stunned && wantsAttack() && me.atkCd <= 0 && run.phase === 'run') doAttack();
        if (me.orb) updateOrbit(dt);
        // 持続回復
        if (A('regen') > 0) addHp(me.maxHp * A('regen') * dt);
        if (me.gutsT > 0) me.gutsT -= dt;
        if (me.regenT > 0) { me.regenT -= dt; addHp(me.maxHp * 0.03 * dt); }
        if (me.fortifyT > 0) me.fortifyT -= dt;
        if (me.empowerT > 0) me.empowerT -= dt;
        // 接触ダメージ
        for (const e of enemies) {
            if (e.pvp || e.hp <= 0 || e.st.stunT > 0 || e.air > 20 || e.noContact) continue;
            if (dist(e.x, e.y, me.x, me.y) < e.r + me.r - 2) { if (e.arch === 'bomber') continue; hurtMe(ed(e) * (e.arch === 'charger' && e.state === 2 ? 1.3 : (e.boss && e.state === 11 ? 1.7 : 1.0))); }
        }
        // 敵弾
        for (let i = eBullets.length - 1; i >= 0; i--) {
            const b = eBullets[i];
            if (b.refl === 2) continue;   // 跳ね返した弾は味方に当たらない
            if (dist(b.x, b.y, me.x, me.y) < b.r + me.r) { hurtMe(b.dmg); eBullets.splice(i, 1); if (!isHost) netSend('bhit', { id: b.id }); }
        }
    }

    // 他のプレイヤーの弾：動かして、岩・自分・敵に当たったら消すだけ（ダメージ判定はしない）
    function updateGhostShots(dt) {
        for (let i = ghostShots.length - 1; i >= 0; i--) {
            const g = ghostShots[i];
            g.x += g.vx * dt; g.y += g.vy * dt; g.life -= dt;
            let dead = g.life <= 0 || g.x < 0 || g.y < 0 || g.x > WORLD_W || g.y > WORLD_H;
            if (!dead) for (const k of rocks) if (dist(g.x, g.y, k.x, k.y) < k.r) { dead = true; break; }
            if (!dead && PVP && !me.dead && dist(g.x, g.y, me.x, me.y) < g.r + me.r) dead = true;     // 対人戦：自分に当たった弾は消える
            if (!dead && !PVP) for (const e of enemies) { if (e.hp > 0 && !g.hit && dist(g.x, g.y, e.x, e.y) < g.r + e.r) { if (g.pierce-- <= 0) { dead = true; break; } } }
            if (dead) {
                if (g.aoe && g.life > 0) fx.push({ k: 'ring', x: g.x, y: g.y, r: 0, max: g.aoe, t: 0.3, life: 0.3, c: '#ffb04a', fill: true });
                ghostShots.splice(i, 1);
            }
        }
        if (ghostShots.length > 300) ghostShots.splice(0, ghostShots.length - 300);
    }
    function updateShots(dt) {
        updateGhostShots(dt);
        for (let i = myShots.length - 1; i >= 0; i--) {
            const s = myShots[i];
            if (s.homing) { const n = nearestEnemy(s.x, s.y, 360); if (n) { const sp = Math.hypot(s.vx, s.vy); const a = Math.atan2(s.vy, s.vx), ta = Math.atan2(n.y - s.y, n.x - s.x); let da = ta - a; da = Math.atan2(Math.sin(da), Math.cos(da)); const na = a + clamp(da, -4 * dt, 4 * dt); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp; } }
            s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
            let dead = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > WORLD_W || s.y > WORLD_H;
            if (!dead) for (const k of rocks) if (dist(s.x, s.y, k.x, k.y) < k.r) { dead = true; break; }
            if (!dead && CORR_ON && corrSolid(s.x, s.y)) dead = true;
            if (!dead) {
                for (const e of enemies) {
                    if (e.hp <= 0 || s.hit[e.id]) continue;
                    if (dist(s.x, s.y, e.x, e.y) < s.r + e.r) {
                        s.hit[e.id] = 1;
                        if (s.skill) skillHit(e, s.skill.base, s.skill.hasDmg, s.skill.eff, Math.atan2(s.vy, s.vx));
                        else {      // 通常攻撃の弾：当たった手応えと、必殺ゲージ（1回の射撃につき1回だけ溜まる。散弾でも増えすぎない）
                            const hh = strike(e, s.m || 1, 30); hitFeel(e, { fin: !!s.fin, i: s.cs | 0, ult: true }, hh);
                            if (s.vol && s.vol !== me.ultGainShot) { me.ultGainShot = s.vol; ultGain(s.fin ? 8 : 2.5); }
                        }
                        if (s.aoe) { boomMine(s.x, s.y, s.aoe); s.aoe = 0; }     // 魔導砲：着弾点で爆発（周囲の敵にも当たる）
                        if (s.pierce-- <= 0) { dead = true; break; }
                    }
                }
            }
            if (dead) myShots.splice(i, 1);
        }
    }

    function updateHost(dt) {
        updateEnemies(dt);
        gmUpdate(dt);
        // 敵弾
        for (let i = eBullets.length - 1; i >= 0; i--) {
            const b = eBullets[i];
            if (b.refl === 2) {   // 跳ね返された弾：ボスへ飛んでいく。最初の1発が核を砕く
                const bo = enemies.find(o => o.boss && !o.echo && o.hp > 0);
                if (bo) {
                    const a = Math.atan2(bo.y - b.y, bo.x - b.x); b.vx = Math.cos(a) * 640; b.vy = Math.sin(a) * 640; b.life = 6;
                    if (dist(b.x, b.y, bo.x, bo.y) < bo.r + 50) { if (b.core) dimCoreBreak(bo); eBullets.splice(i, 1); continue; }
                }
            }
            b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
            let dead = b.life <= 0 || b.x < -50 || b.y < -50 || b.x > WORLD_W + 50 || b.y > WORLD_H + 50;
            if (!dead) for (const k of rocks) if (dist(b.x, b.y, k.x, k.y) < k.r) { dead = true; break; }
            if (!dead && CORR_ON && b.kd !== 9 && corrSolid(b.x, b.y)) dead = true;
            if (dead) eBullets.splice(i, 1);
        }
        // 予告範囲
        for (let i = telegraphs.length - 1; i >= 0; i--) {
            const t = telegraphs[i]; t.t -= dt;
            if (t.t <= 0) {
                boomAt(t.x, t.y, t.r, t.dmg, t.c, { sh: t.sh, a: t.a, arc: t.arc, ri: t.ri, w: t.w, stun: t.stun });
                if (t.rep > 0) { t.rep--; t.t = t.max = t.gap || 0.3; t.live = true; } else telegraphs.splice(i, 1);
            }
        }
        // 湧き
        if (RUSH_ON) { if (run.phase === 'run') rushHost(dt); }
        else if (CORR_ON) { /* 無限回廊の敵は階層を作るときに配置する */ }
        else if (run.phase === 'run' && !run.bossSpawned && stage.bossOnly) startBoss();   // ゲートは雑魚なしで最初からボス戦
        else if (run.phase === 'run' && !run.bossSpawned) {
            spawnT -= dt;
            const cap = ENEMY_CAP_BASE + 8 * (partyCount() - 1);
            if (spawnT <= 0 && enemies.length < cap) { spawnGroup(); spawnT = clamp(1.5 - run.kills / 110, 0.55, 1.5) / (1 + 0.25 * (partyCount() - 1)); }
            const need = Math.round(KILLS_BASE * (1 + 0.35 * (partyCount() - 1)));
            run.need = need;
            if (run.kills >= need) startBoss();
        }
        if (run.bossSpawned && run.bossDead && !run.ended) { run.ended = true; setTimeout(() => finishHost(true), 2600); }
        if (run.phase === 'run' && !run.ended) {
            const everyoneDown = me.dead && Object.keys(allies).every(id => allies[id].dead || allies[id].esc);
            if (everyoneDown) { run.ended = true; setTimeout(() => finishHost(false, 'down'), 1200); }
            else if (run.time > TIME_LIMIT) { run.ended = true; finishHost(false, 'time'); }
        }
    }

    // ================= ギミックボス本体 =================
    function gmBoss() { return enemies.find(e => e.boss && !e.echo && e.hp > 0) || null; }
    function gmUpdate(dt) {          // ホストだけ
        if (!GMK || !run.bossSpawned || run.phase !== 'run' || run.ended) return;
        if (GMK === 'stigma') stigmaHost(dt); else if (GMK === 'pressure') pressureHost(dt); else if (GMK === 'twin') twinHost(dt); else if (GMK === 'dimension') dimensionHost(dt);
    }
    // --- 死神：スティグマ ---
    function stigmaHost(dt) {
        const b = gmBoss(); if (!b) return;
        if (G.sT == null) { G.sT = STIGMA_EVERY; G.sE = 0; G.cE = 0; G.cl = 0; }
        G.sT -= dt;
        if (G.sT <= 0) { G.sT += STIGMA_EVERY; G.sE++; netAnnounce('☠ スティグマが刻まれた…', 900); }
        // スティグマを減らす方法はない：10秒ごとに必ず増え、13個（約130秒）で死亡する。それまでに倒す
    }
    // --- 炉心の巨人：圧力と安全弁 ---
    function pressureHost(dt) {
        const b = gmBoss(); if (!b) return;
        if (G.pT == null) { G.pT = 14; G.cT = 0; G.vl = 0; }
        if (b.vuln > 0) b.vuln -= dt;
        if (G.cT > 0) {
            G.cT -= dt; G.vl = enemies.filter(e => e.valve && e.hp > 0).length;
            if (G.vl === 0) {   // 安全弁を全部壊した：爆発を阻止。ボスは動けず、受けるダメージ+30%
                telegraphs = telegraphs.filter(t => t.id !== G.tid);
                G.cT = 0; G.pT = 24; b.st.stunT = Math.max(b.st.stunT, 5); b.vuln = 6; b.mv = null; b.state = 0;
                netAnnounce('🔧 安全弁を破壊！　圧力が抜けてボスが動けない！（被ダメージ+30%）', 3000);
            } else if (G.cT <= 0) { G.pT = 24; enemies.forEach(e => { if (e.valve) e.hp = 0; }); }   // 間に合わなかった：予告範囲が炸裂する
        } else { G.pT -= dt; if (G.pT <= 0) pressureStart(b); }
    }
    function pressureStart(b) {
        G.cT = 7; const n = Math.min(4, 2 + partyCount());
        for (let i = 0; i < n; i++) {
            const a = i * Math.PI * 2 / n + rnd(0, 0.6);
            const v = spawnEnemy({ name: '安全弁', icon: '🔧', arch: 'tank', color: '#9ac0ff' }, clamp(b.x + Math.cos(a) * 340, 60, WORLD_W - 60), clamp(b.y + Math.sin(a) * 340, 60, WORLD_H - 60), false);
            v.valve = true; v.noLoot = true; v.noContact = true; v.spd = 0; v.maxHp = v.hp = Math.max(1, Math.round(b.maxHp * 0.018));
        }
        telegraph(b.x, b.y, 800, G.cT, ed(b) * 2.6, '#ff6a2a'); G.tid = telegraphs[telegraphs.length - 1].id;
        netAnnounce('♨ 圧力が限界に！　安全弁を全部壊せ！', 2800);
    }
    // --- ゼウス＆プロメテウス：片方が倒れたら15秒で蘇生 ---
    function twinOnDeath(dead) {
        const o = enemies.find(x => x.boss && !x.echo && x !== dead && x.hp > 0); if (!o) return;
        o.rage = 1.3; o.enraged = true;
        G.used = G.used || {};
        if (!G.used[dead.pairIdx]) { G.used[dead.pairIdx] = 1; G.rv = { i: dead.pairIdx, t: 15, x: dead.x, y: dead.y, n: dead.def.name }; netAnnounce('⚠ ' + o.def.name + ' が ' + dead.def.name + ' を蘇らせようとしている！　15秒以内に倒せ！', 3200); }
        else netAnnounce('💢 ' + o.def.name + ' が怒り狂った！', 2000);
    }
    function twinHost(dt) {
        if (!G.rv) return;
        G.rv.t -= dt; if (G.rv.t > 0) return;
        const r = G.rv; G.rv = null; const bd = stage.bosses[r.i];
        const b = spawnEnemy({ name: bd.name, icon: bd.icon, arch: 'chaser', color: bd.color }, r.x, r.y, true);
        b.spd = 78 * (1 + SC.ilvl * 0.012) * PW.spd; b.bd = bd; b.pairIdx = r.i; b.bset = (BM && BM.SETS && BM.SETS[bd.set]) || null;
        b.maxHp = Math.round(b.maxHp * (bd.hp || 1)); b.hp = Math.round(b.maxHp * 0.4); b.rage = 1.15; b.enraged = true;
        fx.push({ k: 'ring', x: r.x, y: r.y, r: 0, max: 200, t: 0.6, life: 0.6, c: '#ffe9a0', fill: true });
        netAnnounce('🔥 ' + bd.name + ' が蘇った！', 2400);
    }
    // --- ディメンション・キーパー ---
    function spawnEcho(stageId, x, y) {
        const st = window.getStageById(stageId); if (!st) return null;
        const bd = st.boss, b = spawnEnemy({ name: bd.name, icon: bd.icon, arch: 'chaser', color: bd.color }, clamp(x, 80, WORLD_W - 80), clamp(y, 80, WORLD_H - 80), true);
        b.echo = true; b.bd = bd; b.bset = (BM && BM.SETS && BM.SETS[stageId]) || null;
        b.maxHp = b.hp = Math.max(1, Math.round(b.maxHp * 0.14 * ((DBG && DBG.hp > 0) ? DBG.hp : 1))); b.spd = 78 * (1 + SC.ilvl * 0.012) * PW.spd;
        fx.push({ k: 'ring', x: b.x, y: b.y, r: 0, max: 220, t: 0.7, life: 0.7, c: '#ffe9a0', fill: true });
        return b;
    }
    function dimensionHost(dt) {
        const b = gmBoss(); if (!b) return;
        if (G.dp == null) { G.dp = 1; G.dc = (DBG && DBG.cores != null) ? clamp(DBG.cores | 0, 0, 6) : 6; G.wt = 5; G.wd = 0; G.de = 0; G.dw = 0; b.bset = (BM && BM.SETS && BM.SETS.dim_keeper1) || null; b.inv = true; }
        if (G.dp === 1) {
            b.inv = G.dc > 0;
            if (G.wd > 0) { G.wd -= dt; if (G.wd <= 0) dimFire(b); }
            else { G.wt -= dt; if (G.wt <= 0) { G.wt = 8; G.wd = 1.0; telegraph(b.x, b.y, 170, 1.0, 0, '#ff7aff', { sh: 'portal' }); netAnnounce('💠 次元放射！　引きつけて「スキル」を発動し、跳ね返せ！', 1700); } }
            if (G.dc <= 0) dimPhase2(b);
        } else {
            const echoAlive = enemies.some(e => e.echo && e.hp > 0);
            if (G.dw && !echoAlive) { G.dw = 0; G.de++; b.inv = false; netAnnounce('🚪 門が閉じた…　ゲートキーパーが再び動き出す！', 2200); }
            if (!G.dw && G.de < DK_ECHO.length && b.hp / b.maxHp < DK_ECHO[G.de][1]) {
                const st = window.getStageById(DK_ECHO[G.de][0]);
                spawnEcho(DK_ECHO[G.de][0], b.x + rnd(-260, 260), b.y + rnd(160, 320));
                G.dw = 1; b.inv = true;
                netAnnounce('🚪 ゲートから「' + (st ? st.boss.name : '') + '」が現れた！　倒すまでキーパーは無敵！', 3000);
            }
        }
    }
    function dimFire(b) {            // 反射できる全方位弾（白い輪が付いた弾）
        const n = 20, off = rnd(0, 6.28), k = ed(b) * 1.2;
        for (let i = 0; i < n; i++) { bullet(b.x, b.y, off + i * Math.PI * 2 / n, 215, k, 11, 4.6, '#ff7aff'); eBullets[eBullets.length - 1].refl = 1; }
    }
    function hostReflect(px, py) {   // ホスト：スキルを発動した人の周りの放射弾を跳ね返す。1回で核1つ
        if (GMK !== 'dimension' || G.dp !== 1) return;
        let first = true, n = 0;
        eBullets.forEach(b => { if (b.refl === 1 && dist(b.x, b.y, px, py) <= REFL_R) { b.refl = 2; b.c = '#7fffd4'; b.life = 6; if (first) { b.core = true; first = false; } n++; } });
        if (n) { fx.push({ k: 'ring', x: px, y: py, r: 0, max: REFL_R, t: 0.4, life: 0.4, c: '#7fffd4' }); netSend('gm', { k: 'refl', x: Math.round(px), y: Math.round(py) }); }
    }
    function dimCoreBreak(b) {
        G.dc = Math.max(0, (G.dc == null ? 6 : G.dc) - 1);
        fx.push({ k: 'ring', x: b.x, y: b.y, r: 0, max: 200, t: 0.5, life: 0.5, c: '#ff7aff', fill: true });
        netSend('gm', { k: 'core', x: Math.round(b.x), y: Math.round(b.y) });
        netAnnounce('💠 核が砕けた！　残り ' + G.dc + ' / 6', 1800);
    }
    function dimPhase2(b) {
        G.dp = 2; G.de = 0; G.dw = 0;
        b.inv = false; b.hp = b.maxHp; b.enraged = false; b.bset = (BM && BM.SETS && BM.SETS.dim_keeper2) || null; b.mv = null; b.state = 0; b.t = -2; b.ultN = 0; b.mvIdx = 0; b.mvCount = 0;
        eBullets = eBullets.filter(x => !x.refl);
        netAnnounce('⛩ 核がすべて砕けた！　ゲートキーパーの真の姿が現れる…', 3600);
    }
    // --- 全員が自分の画面で行う処理 ---
    function gmPullStart(x, y, dur, f) { pullFx = { x: x, y: y, t: dur, f: f }; fx.push({ k: 'ring', x: x, y: y, r: 0, max: 320, t: 0.8, life: 0.8, c: '#9a8aff' }); }
    function onGm(d) {               // ホストからの通知（クライアント側）
        if (d.k === 'pull') gmPullStart(Number(d.x) || 0, Number(d.y) || 0, Math.min(4, Number(d.dur) || 1), Math.min(600, Number(d.f) || 200));
        else if (d.k === 'refl') fx.push({ k: 'ring', x: Number(d.x) || 0, y: Number(d.y) || 0, r: 0, max: REFL_R, t: 0.4, life: 0.4, c: '#7fffd4' });
        else if (d.k === 'core') fx.push({ k: 'ring', x: Number(d.x) || 0, y: Number(d.y) || 0, r: 0, max: 200, t: 0.5, life: 0.5, c: '#ff7aff', fill: true });
    }
    function gmApplySnap(g) { G = (g && typeof g === 'object') ? g : {}; }
    function gmLocal(dt) {
        if (!GMK || !run.bossSpawned || run.phase !== 'run') return;
        if (pullFx && pullFx.t > 0) {
            pullFx.t -= dt;
            if (!me.dead) { const dx = pullFx.x - me.x, dy = pullFx.y - me.y, d = Math.hypot(dx, dy); if (d > 80) { moveSolid(me, dx / d * pullFx.f * dt, dy / d * pullFx.f * dt, me.r); } }
        }
        if (GMK === 'stigma') {
            if (me.stg == null) me.stg = 0;
            const sE = G.sE || 0, cE = G.cE || 0;
            if (sE > stgLastS) { if (!me.dead) { me.stg += sE - stgLastS; popups.push({ x: me.x, y: me.y - 40, t: 0.9, text: '☠ スティグマ ' + me.stg, c: '#c9a0ff', big: true }); } stgLastS = sE; }
            if (cE > stgLastC) { me.stg = Math.max(0, me.stg - 4 * (cE - stgLastC)); stgLastC = cE; }
            if (me.stg >= STIGMA_MAX && !me.dead) { me.stg = 0; me.hp = 0; me.dead = true; me.reviveT = 0; me.stunT = 0; me.orb = null; announce('☠ スティグマが13個…　死神に魂を刈り取られた', 2600); }
        }
    }
    function gmHudText() {
        if (!run.bossSpawned) return '';
        if (GMK === 'stigma') return '☠ スティグマ ' + (me.stg || 0) + ' / ' + STIGMA_MAX + '　次の刻印まで ' + Math.max(0, Math.ceil(G.sT == null ? STIGMA_EVERY : G.sT)) + '秒';
        if (GMK === 'pressure' && G.cT > 0) return '♨ 圧力爆発まで ' + Math.ceil(G.cT) + '秒　安全弁 あと ' + (G.vl || 0);
        if (GMK === 'twin' && G.rv) return '⚠ ' + G.rv.n + ' が蘇るまで ' + Math.ceil(G.rv.t) + '秒　先に倒せ！';
        if (GMK === 'dimension') return G.dp === 2 ? (G.dw ? '🚪 ゲートの主が出現中：倒さないとキーパーは無敵' : '🚪 歴代ラスボスの召喚 ' + (G.de || 0) + ' / ' + DK_ECHO.length) : '💠 核 ' + (G.dc == null ? 6 : G.dc) + ' / 6　（放射弾をスキルで跳ね返すと砕ける）';
        return '';
    }

    function startBoss() {
        run.bossSpawned = true; G = {};
        enemies.forEach(e => { if (!e.boss) { e.hp = 0; fx.push({ k: 'puff', x: e.x, y: e.y, t: 0.3, life: 0.3, c: '#aaa' }); } });
        enemies = enemies.filter(e => e.hp > 0);
        const defs = stage.bosses || [stage.boss];
        defs.forEach((bd, i) => {
            const b = spawnEnemy({ name: bd.name, icon: bd.icon, arch: 'chaser', color: bd.color }, WORLD_W / 2 + (bd.dx || 0), WORLD_H / 2 - 200, true);
            b.spd = 78 * (1 + SC.ilvl * 0.012) * PW.spd;
            b.bd = bd; b.pairIdx = i;
            if (bd.set) b.bset = (BM && BM.SETS && BM.SETS[bd.set]) || null;
            if (bd.hp) b.maxHp = b.hp = Math.round(b.maxHp * bd.hp);       // ニコイチのボスは1体ぶんのHPを少なめにする
            if (DBG && DBG.hp > 0) b.maxHp = b.hp = Math.max(1, Math.round(b.maxHp * DBG.hp));
        });
        netAnnounce('⚠ ' + defs.map(d => d.name).join(' と ') + ' が現れた！', 2600);
        if (GMK === 'stigma') setTimeout(() => netAnnounce('☠ 10秒ごとに「スティグマ」が刻まれる…13個たまると死ぬ！', 3200), 2700);
    }

    function finishHost(win, reason) {
        const d = { win: win, reason: reason || '' };
        netSend('end', d);
        finish(win, d);
    }

    // ---------- スナップショット ----------
    // 近い順に n 個だけ残す（弾・予告が多すぎて、サーバーの中継の大きさの上限を超えると、仲間の画面が止まって見えるため）
    function nearestN(arr, n, xi, yi) {
        if (arr.length <= n) return arr;
        const ps = alivePlayersPos(); if (!ps.length) return arr.slice(0, n);
        const key = a => { let m = 1e12; for (const q of ps) { const d = (a[xi] - q.x) * (a[xi] - q.x) + (a[yi] - q.y) * (a[yi] - q.y); if (d < m) m = d; } return m; };
        return arr.map(a => [key(a), a]).sort((p, q) => p[0] - q[0]).slice(0, n).map(p => p[1]);
    }
    function makeSnap() {
        const m = makeSnap0();
        let nb = 150, nt = 50, len = JSON.stringify(m).length;
        while (len > 16000 && nb > 20) {      // 大きすぎるときは、遠くの弾・予告から切り捨てる
            nb = Math.floor(nb * 0.7); nt = Math.max(16, Math.floor(nt * 0.8));
            m.b = nearestN(m.b, nb, 1, 2); m.t = nearestN(m.t, nt, 1, 2); len = JSON.stringify(m).length;
        }
        if (m.b.length > nb) m.b = nearestN(m.b, nb, 1, 2);
        m.q = ++snapSeq; m.ht = Math.round(performance.now()); snapBytes = len;      // ht：ホスト側で作った時刻（受け取る側が、届く間隔のばらつきに惑わされず速度を出せるように）
        return m;
    }
    function makeSnap0() {
        return {
            e: enemies.map(e => [e.id, e.def.icon, e.def.color, Math.round(e.x), Math.round(e.y), Math.round(e.hp), e.maxHp, e.r, e.boss ? 1 : 0, e.state, e.def.name, e.arch, e.elite ? 1 : 0, e.dmgMul || 1, Math.round(e.air || 0), (e.inv ? 1 : 0) | (e.echo ? 2 : 0) | (e.boss && !e.echo && bdef(e).gate ? 4 : 0) | (e.valve ? 8 : 0)]),
            b: eBullets.map(b => [b.id, Math.round(b.x), Math.round(b.y), b.r, b.c, b.kd || 0, b.kd ? +Math.atan2(b.vy, b.vx).toFixed(2) : 0, b.refl || 0]),
            t: telegraphs.map(t => [t.id, t.x, t.y, t.r, +t.t.toFixed(2), t.max, t.c, t.sh || '', t.a != null ? +t.a.toFixed(2) : 0, t.arc != null ? +t.arc.toFixed(2) : 0, t.ri || 0, t.w || 0, t.stun ? 1 : 0, t.live ? 1 : 0]),
            k: run.kills, n: run.need, tm: Math.round(run.time), bs: run.bossSpawned ? 1 : 0, g: G,
            rs: RUSH_ON ? [RS.ph, RS.st, Math.round(RS.limit - RS.t), Math.round(RS.inter)] : 0,
            cf: CORR_ON && CF.rc ? [CF.floor, CF.seed, CF.inBoss ? 1 : 0, CF.portalIdx, CF.exit ? 1 : 0] : 0
        };
    }
    function applySnap(s) {
        if (s.q != null) { if (s.q <= lastSnapQ && s.q > lastSnapQ - 50) return; lastSnapQ = s.q; }      // 古い・順番が入れ替わったスナップショットは捨てる
        const nowS = performance.now(), dtS = clamp((nowS - (lastSnapAt || nowS - 80)) / 1000, 0.03, 0.4); lastSnapAt = nowS; snapAge = 0;
        const dtH = (s.ht != null && lastHt != null) ? clamp((s.ht - lastHt) / 1000, 0.03, 0.4) : dtS; if (s.ht != null) lastHt = s.ht;      // 速度は、ホストが作った間隔で割る
        run.kills = s.k; run.need = s.n; run.time = s.tm; if (s.bs && !run.bossSpawned) run.bossSpawned = true;
        if (RUSH_ON && s.rs) {      // ボスラッシュ：フェーズが進んだら、敵の強さの基準を合わせ、幕間に入ったら回復する
            const prevSt = RS.st, prevPh = RS.ph;
            RS.ph = s.rs[0]; RS.st = s.rs[1]; RS.t = RS.limit - s.rs[2]; RS.inter = s.rs[3];
            if (RS.ph !== prevPh && RS.ph > 0) { const pd = rushPd(RS.ph); applyScale(pd.req, pd.ilvl, pd.pw); SC.dmgMul = pd.final ? 1 : RUSHD.perBossDmg; if (prevPh > 0) { me.inv = Math.max(me.inv, 3); me.invHard = Math.max(me.invHard || 0, 3); } RS.limit = (DIFF.phaseMin || 10) * 60; RS.t = RS.limit - s.rs[2]; }
            if (RS.st === 2 && prevSt !== 2) rushLocalInter();
        }
        if (CORR_ON && s.cf) corrSync(s.cf);
        gmApplySnap(s.g);
        const old = {}; enemies.forEach(e => { old[e.id] = e; });
        enemies = s.e.map(a => {
            const o = old[a[0]] || { x: a[3], y: a[4], flash: 0 };
            let evx = 0, evy = 0; if (o.sx != null) { evx = clamp((a[3] - o.sx) / dtH, -1400, 1400); evy = clamp((a[4] - o.sy) / dtH, -1400, 1400); if (o.vx != null) { evx = o.vx * 0.4 + evx * 0.6; evy = o.vy * 0.4 + evy * 0.6; } if (Math.hypot(a[3] - o.sx, a[4] - o.sy) > 380) { evx = evy = 0; o.x = a[3]; o.y = a[4]; } }      // 前の位置との差から速度を求めて、次が届くまで先読みする。瞬間移動は補間しない
            return { id: a[0], def: { icon: a[1], color: a[2], name: a[10] }, x: o.x, y: o.y, tx: a[3], ty: a[4], sx: a[3], sy: a[4], vx: evx, vy: evy, hp: a[5], maxHp: a[6], r: a[7], boss: !!a[8], state: a[9], flash: o.flash || 0, st: { stunT: 0 }, arch: a[11] || 'chaser', elite: !!a[12], dmg: foeDmg(a[11] || 'chaser', !!a[8], !!a[12]), dmgMul: a[13] || 1, air: a[14] || 0, inv: !!((a[15] || 0) & 1), echo: !!((a[15] || 0) & 2), gate: !!((a[15] || 0) & 4), valve: !!((a[15] || 0) & 8), noContact: !!((a[15] || 0) & 8) };
        });
        const oldB = {}; eBullets.forEach(x => { oldB[x.id] = x; });
        eBullets = s.b.map(a => { const o = oldB[a[0]]; const bvx = o && o.sx != null ? clamp((a[1] - o.sx) / dtH, -1800, 1800) : 0, bvy = o && o.sx != null ? clamp((a[2] - o.sy) / dtH, -1800, 1800) : 0; return { id: a[0], x: o ? o.x : a[1], y: o ? o.y : a[2], tx: a[1], ty: a[2], sx: a[1], sy: a[2], vx: bvx, vy: bvy, r: a[3], c: a[4], kd: a[5] || 0, ang: a[6] || 0, refl: a[7] || 0, dmg: 0, dm: 0 }; });
        // クライアント側の弾はダメージ値を持たないので、ホストが送った値で最小限の被弾を行う（体当たり相当）
        telegraphs = s.t.map(a => ({ id: a[0], x: a[1], y: a[2], r: a[3], t: a[4], max: a[5], c: a[6], sh: a[7] || null, a: a[8], arc: a[9], ri: a[10], w: a[11], stun: !!a[12], live: !!a[13] }));
        eBullets.forEach(b => { b.dmg = foeDmg('ranged', false, false); });
    }
    function lerpRemote(dt) {
        // 次のスナップショットが届くまで（最大0.25秒）、前回の速度で目標位置を先に進めて、滑らかに追いかける
        snapAge += dt; const ext = snapAge < 0.25, k = 1 - Math.exp(-dt * 24);
        enemies.forEach(e => { if (e.tx != null) { if (ext && e.vx) { e.tx += e.vx * dt; e.ty += e.vy * dt; } e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; } });
        eBullets.forEach(b => { if (b.tx != null) { if (ext && b.vx) { b.tx += b.vx * dt; b.ty += b.vy * dt; } b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k; } });
    }



    // ================= アクセサリー =================
    //  装備しているアクセサリーのスキルが、条件を満たすたびに自動で発動する（範囲攻撃が中心）。対人戦では使わない。
    //  データと発動条件は accessories.js、ここは「効果の中身」と「いつ呼ぶか」
    const accSlots = (!PVP && window.SBAcc) ? SBAcc.equippedList(hack).filter(Boolean).map(a => ({ a: a, b: SBAcc.baseOf(a), cd: 1.2 + Math.random() * 1.5, kills: 0 })).filter(x => x.b) : [];
    let accBusy = false;
    function accDmg(mult) { return weapon.dmg * P.atkMul * atkDyn() * mult * (1 + P.special / 300) * (me.empowerT > 0 ? 1.35 : 1) * (1 + A('skillPct')) * (AB('guts') && me.hp <= 1.5 ? 3 : 1); }
    function accNear(r) { for (const e of enemies) if (e.hp > 0 && e.act !== false && dist(me.x, me.y, e.x, e.y) < r + e.r) return true; return false; }
    function accHitAll(x, y, r, base, eff) { enemies.forEach(e => { if (e.hp > 0 && dist(x, y, e.x, e.y) <= r + e.r) skillHit(e, base, true, eff, 0); }); }
    function accLater(sec, fn) { setTimeout(() => { if (run.phase !== 'run' || me.dead) return; const was = accBusy; accBusy = true; try { fn(); } finally { accBusy = was; } }, sec * 1000); }
    function accBurstFx(x, y, r, col, fill) {
        fx.push({ k: 'ring', x: x, y: y, r: 0, max: r, t: 0.4, life: 0.4, c: col, fill: !!fill });
        if (fx.length < 420) for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, v = 100 + Math.random() * 300; fx.push({ k: 'spark', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, sz: 2.5 + Math.random() * 3, t: 0.35 + Math.random() * 0.25, life: 0.6, c: Math.random() < 0.4 ? '#fff' : col }); }
    }
    function accBolt(x1, y1, x2, y2, col, w) {      // 稲妻（ぎざぎざの線）
        const pts = [[x1, y1]], n = Math.max(3, Math.round(dist(x1, y1, x2, y2) / 34)), nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
        for (let i = 1; i < n; i++) { const t = i / n, j = (Math.random() - 0.5) * 34; pts.push([x1 + (x2 - x1) * t + nx / nl * j, y1 + (y2 - y1) * t + ny / nl * j]); }
        pts.push([x2, y2]); fx.push({ k: 'bolt', pts: pts, c: col, w: w || 4, t: 0.18, life: 0.18 });
    }
    function accTargets(range) {      // 近い順の敵
        return enemies.filter(e => e.hp > 0 && e.act !== false && dist(me.x, me.y, e.x, e.y) < range).sort((a, b) => dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y));
    }
    function accFire(s) {
        const a = s.a, f = s.b.fx, pw = a.pw || 1, base = accDmg(f.mult * pw), eff = (f.eff || []).slice(), col = f.col || '#fff';
        popups.push({ x: me.x, y: me.y - 52, t: 0.9, text: s.b.icon + ' ' + s.b.name, c: col });
        const was = accBusy; accBusy = true;
        try {
            if (f.kind === 'nova') {
                accBurstFx(me.x, me.y, f.r, col, true); accHitAll(me.x, me.y, f.r, base, eff); addShake(2.5, 0.12);
            } else if (f.kind === 'chain') {
                const hit = {}; let from = { x: me.x, y: me.y }, list = accTargets(f.range + 200);
                for (let i = 0; i < f.n; i++) {
                    const e = list.filter(x => !hit[x.id]).sort((p, q) => dist(from.x, from.y, p.x, p.y) - dist(from.x, from.y, q.x, q.y))[0];
                    if (!e || dist(from.x, from.y, e.x, e.y) > f.range) break;
                    hit[e.id] = 1; accBolt(from.x, from.y, e.x, e.y, col, 4); fx.push({ k: 'ring', x: e.x, y: e.y, r: 0, max: 46, t: 0.25, life: 0.25, c: col });
                    skillHit(e, base * (1 - i * 0.05), true, eff, 0); from = { x: e.x, y: e.y };
                }
            } else if (f.kind === 'meteor') {
                const ts = accTargets(760); const pts = [];
                for (let i = 0; i < f.n; i++) { const e = ts.length ? ts[Math.floor(Math.random() * Math.min(ts.length, 12))] : null; pts.push(e ? { x: e.x + (Math.random() - 0.5) * 50, y: e.y + (Math.random() - 0.5) * 50 } : { x: me.x + (Math.random() - 0.5) * 520, y: me.y + (Math.random() - 0.5) * 520 }); }
                pts.forEach((q, i) => {
                    fx.push({ k: 'ring', x: q.x, y: q.y, r: f.r * 0.4, max: f.r, t: 0.45 + i * 0.1, life: 0.45 + i * 0.1, c: col });
                    accLater(0.45 + i * 0.1, () => { accBolt(q.x - 90, q.y - 520, q.x, q.y, col, 7); accBurstFx(q.x, q.y, f.r, col, true); accHitAll(q.x, q.y, f.r, base, eff); addShake(2, 0.1); });
                });
            } else if (f.kind === 'spin') {
                for (let i = 0; i < f.ticks; i++) accLater(i * f.gap, () => { accBurstFx(me.x, me.y, f.r, col, false); accHitAll(me.x, me.y, f.r, base, eff); });
            } else if (f.kind === 'quake') {
                for (let i = 0; i < f.rings; i++) accLater(i * 0.28, () => { const r = f.r * (0.55 + 0.45 * (i + 1) / f.rings); accBurstFx(me.x, me.y, r, col, true); accHitAll(me.x, me.y, r, base, eff); addShake(4, 0.18); });
            } else if (f.kind === 'radial') {
                const off = Math.random() * 6.28;
                for (let i = 0; i < f.n; i++) { const ang = off + i * Math.PI * 2 / f.n; myShots.push({ x: me.x, y: me.y, vx: Math.cos(ang) * f.speed, vy: Math.sin(ang) * f.speed, r: 8, life: 0.9, pierce: f.pierce || 0, hit: {}, homing: false, c: col, skill: { base: base, hasDmg: true, eff: eff } }); }
                fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: 90, t: 0.25, life: 0.25, c: col });
            } else if (f.kind === 'blackhole') {
                const ts = accTargets(520), c = ts.length ? { x: ts[0].x, y: ts[0].y } : { x: me.x + Math.cos(me.ang) * 200, y: me.y + Math.sin(me.ang) * 200 }, ticks = Math.round(f.dur / 0.25);
                for (let i = 0; i < ticks; i++) accLater(i * 0.25, () => {
                    fx.push({ k: 'ring', x: c.x, y: c.y, r: f.r, max: 20, t: 0.25, life: 0.25, c: col });
                    enemies.forEach(e => { if (e.hp > 0 && dist(c.x, c.y, e.x, e.y) <= f.r + e.r) { const an = Math.atan2(c.y - e.y, c.x - e.x); dealHit(e, Math.round(base), { kx: Math.cos(an) * 300 * (e.boss ? 0.3 : 1), ky: Math.sin(an) * 300 * (e.boss ? 0.3 : 1) }); } });
                });
            } else if (f.kind === 'heal') {
                healMe(me.maxHp * f.pct); accBurstFx(me.x, me.y, f.r, col, true); accHitAll(me.x, me.y, f.r, base, eff); addShake(3, 0.15);
            } else if (f.kind === 'rain') {
                for (let i = 0; i < f.n; i++) { const q = { x: me.x + (Math.random() - 0.5) * f.spread * 2, y: me.y + (Math.random() - 0.5) * f.spread * 2 }, dl = Math.random() * 0.9; fx.push({ k: 'ring', x: q.x, y: q.y, r: 40, max: 8, t: 0.3 + dl, life: 0.3 + dl, c: col }); accLater(0.3 + dl, () => { accBolt(q.x + 30, q.y - 380, q.x, q.y, col, 3); accBurstFx(q.x, q.y, 64, col, true); accHitAll(q.x, q.y, 64, base, eff); }); }
            } else if (f.kind === 'beam') {
                const off = Math.random() * 6.28;
                for (let i = 0; i < f.n; i++) {
                    const an = off + i * Math.PI * 2 / f.n, x2 = me.x + Math.cos(an) * f.len, y2 = me.y + Math.sin(an) * f.len;
                    const d = { f: 'laser', x: me.x, y: me.y, a: an, len: f.len, w: f.w }; skillFx(d); netSend('sk', d);
                    enemies.forEach(e => { if (e.hp > 0 && distSeg(e.x, e.y, me.x, me.y, x2, y2) <= f.w / 2 + e.r) skillHit(e, base, true, eff, an); });
                }
            } else if (f.kind === 'shield') {
                me.barrierHp = (me.barrierHp || 0) + Math.max(10, Math.round(me.maxHp * f.pct)); popups.push({ x: me.x, y: me.y - 46, t: 0.9, text: 'バリア', c: '#7fc8ff' });
                accBurstFx(me.x, me.y, f.r, col, true); accHitAll(me.x, me.y, f.r, base, eff); addShake(3, 0.15);
                if (f.spinR) for (let i = 1; i <= 6; i++) accLater(i * 0.25, () => { accBurstFx(me.x, me.y, f.spinR, col, false); accHitAll(me.x, me.y, f.spinR, base * 0.6, eff); });
            }
        } finally { accBusy = was; }
    }
    function accTick(dt) {
        if (!accSlots.length || me.dead || run.phase !== 'run' || me.stunT > 0) return;
        for (const s of accSlots) {
            if (s.cd > 0) { s.cd -= dt; continue; }
            const t = s.b.trig;
            if (t.t === 'timer') { if (accNear(720)) { accFire(s); s.cd = SBAcc.cdOf(s.a); } }
            else if (t.t === 'lowhp') { if (me.hp > 0 && me.hp / me.maxHp < t.hp) { accFire(s); s.cd = SBAcc.cdOf(s.a); } }
        }
    }
    function accEvent(type) {
        if (!accSlots.length || accBusy || me.dead || run.phase !== 'run') return;
        for (const s of accSlots) {
            const t = s.b.trig; if (t.t !== type) continue;
            if (type === 'kills') { s.kills++; if (s.kills >= t.n) { s.kills = 0; accFire(s); } continue; }
            if (s.cd > 0) continue;
            if (t.chance && Math.random() > t.chance) continue;
            accFire(s); s.cd = SBAcc.cdOf(s.a);
        }
    }
    // アクセサリーのドロップ（手に入れたものは、無限回廊では袋に入る）
    function rollAcc(luck, minR, x, y) {
        if (!window.SBAcc || PVP) return;
        const a = SBAcc.roll({ ilvl: L().ilvl, luck: luck, minRarity: minR, source: L().id });
        if (CORR_ON) BAG.accs.push(a); else { const d = hwLoad(); SBAcc.ensure(d); d.accs.push(a); hwSave(d); }
        run.stats.accs = run.stats.accs || []; run.stats.accs.push(a);
        const R = HW.rarityOf(a);
        popups.push({ x: x, y: y - 20, t: 1.6, text: '✨ ' + a.name, c: R.color, big: true });
        fx.push({ k: 'ring', x: x, y: y, r: 0, max: 70, t: 0.5, life: 0.5, c: R.color });
    }

    // ================= ボスラッシュ =================
    //  フェーズ1〜5＝第N世界のボスから4体が選ばれて同時に出る（第四世界のボス並に強化。進むごとにさらに強く）。Final＝強化ディメンション・キーパー。
    //  フェーズごとに制限時間があり、ボスを全員倒すと幕間（回復）のあと次のフェーズへ。ホストだけが進行を動かし、クライアントはスナップショットで追いかける。
    function rushPd(n) { return RUSHD.phases[Math.max(1, Math.min(RUSHD.phases.length, n)) - 1]; }
    function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function rushStartPhase(n) {
        const pd = rushPd(n);
        RS.ph = n; RS.st = 1; RS.t = 0; RS.limit = (DIFF.phaseMin || 10) * 60; RS.inter = 0;
        applyScale(pd.req, pd.ilvl, pd.pw); SC.hpMul = pd.final ? 2.4 : RUSHD.perBossHp; SC.dmgMul = pd.final ? 1 : RUSHD.perBossDmg;
        me.inv = Math.max(me.inv, 3); me.invHard = Math.max(me.invHard || 0, 3);      // フェーズの最初の3秒は無敵（登場の瞬間に倒されないように）
        enemies = []; eBullets = []; telegraphs = []; G = {}; myShots = []; ghostShots = [];
        run.bossSpawned = true; run.bossDead = false;
        if (pd.final) {
            const fb = RUSHD.finalBoss;
            const b = spawnEnemy({ name: fb.name, icon: fb.icon, arch: 'chaser', color: fb.color }, WORLD_W / 2, WORLD_H * 0.3, true);
            b.bd = fb; b.bset = (BM && BM.SETS && BM.SETS[fb.set]) || null; b.rushSrc = 'dimension_end'; b.spd = 70 * (1 + SC.ilvl * 0.012) * PW.spd; b.t = -2.5;
            netAnnounce('🌀 Final　強化されたディメンション・キーパーが現れた！', 3200);
        } else {
            let pool = RUSHD.pool(pd.world); if (!pool.length) pool = RUSHD.pool(1);
            const pick = shuffled(pool).slice(0, RUSHD.bossCount);
            while (pick.length < RUSHD.bossCount) pick.push(pool[pick.length % pool.length]);
            pick.forEach((st, i) => {
                const bd = st.boss, x = WORLD_W * (0.2 + 0.2 * i), y = WORLD_H * (0.22 + (i % 2) * 0.1);
                const b = spawnEnemy({ name: bd.name, icon: bd.icon, arch: 'chaser', color: bd.color }, x, y, true);
                b.bd = bd; b.bset = (BM && BM.SETS && BM.SETS[st.id]) || null; b.rushSrc = st.id; b.spd = 70 * (1 + SC.ilvl * 0.012) * PW.spd; b.pairIdx = i; b.t = -1.6 - i * 1.0;      // 4体が同時に撃ち始めないよう、登場から攻撃までの間をずらす
                if (DBG && DBG.hp > 0) b.maxHp = b.hp = Math.max(1, Math.round(b.maxHp * DBG.hp));
            });
            netAnnounce('🏆 ' + pd.label + '　第' + pd.world + '世界のボス' + RUSHD.bossCount + '体が同時に現れた！', 3200);
        }
        netSend('rsp', { ph: n });
    }
    function rushPhaseClear() {
        RS.st = 2; RS.inter = RUSHD.intermission; eBullets = []; telegraphs = []; G = {};
        netAnnounce('🏆 ' + rushPd(RS.ph).label + ' クリア！　次のフェーズへ…', 2800);
        rushLocalInter();
    }
    // 幕間：倒れていたら復活し、HPを6割まで戻す（ルール上の回復なので、難易度の回復低下は受けない）
    function rushLocalInter() {
        if (me.dead) { me.dead = false; me.stg = 0; me.reviveT = 0; }
        me.hp = Math.max(me.hp, Math.round(me.maxHp * 0.6)); me.inv = 2; me.invHard = 2; me.stunT = 0; me.energy = Math.max(me.energy, ENERGY_MAX * 0.6);
        myShots = []; ghostShots = [];
        popups.push({ x: me.x, y: me.y - 34, t: 1.2, text: 'HP回復', c: '#7aff9a', big: true });
    }
    function rushHost(dt) {
        if (RS.ph === 0) { rushStartPhase(1); return; }
        if (RS.st === 1) { RS.t += dt; if (RS.t > RS.limit && !run.ended) { run.ended = true; finishHost(false, 'time'); } }
        else if (RS.st === 2) { RS.inter -= dt; if (RS.inter <= 0 && !run.ended) rushStartPhase(RS.ph + 1); }
    }
    // ボスラッシュの撃破報酬：1体ごとに武器（マジック以上）、フェーズの最後の1体はレア以上を複数。Final は伝説も狙える
    function rushKillReward(ev) {
        const last = ev.rb === 2, rareBonus = A('rarePct') + DIFF.luck + (last ? 1.0 : 0.4) + (ev.fin ? 1.5 : 0) + (ev.ph || 1) * 0.12;
        const coin = Math.round((1 + ev.ilvl * 0.8) * (last ? 40 : 14) * (1 + DIFF.luck * 0.3) * (1 + A('goldPct')));
        run.stats.coins += coin;
        rollMats('boss', ev.x, ev.y);
        if (!last) {
            if (Math.random() < 0.3) rollAcc(rareBonus, 'magic', ev.x + 12, ev.y);
            rollLoot(L().bossDrops, rareBonus, 'magic', ev.x, ev.y, 'rush');
            if (Math.random() < 0.45) rollArmor(rareBonus, 'magic', ev.x, ev.y - 18, 'rush');
            if (Math.random() < 0.4) giveOrb(true);
        } else {
            rollLoot(L().bossDrops, rareBonus, 'rare', ev.x, ev.y, 'rush'); rollLoot(L().bossDrops, rareBonus, 'rare', ev.x + 22, ev.y, 'rush'); rollLoot(L().drops, rareBonus, 'magic', ev.x - 22, ev.y, 'rush');
            rollArmor(rareBonus, 'rare', ev.x, ev.y - 20, 'rush'); if (Math.random() < 0.6) rollArmor(rareBonus, 'rare', ev.x + 18, ev.y - 24, 'rush');
            giveOrb(true); if ((ev.ph || 1) >= 4) giveOrb(true);
            rollAcc(rareBonus, (ev.ph || 1) >= 3 ? 'rare' : 'magic', ev.x - 14, ev.y);      // フェーズの最後のボスは、アクセサリーを必ず落とす
            if (ev.fin) { rollAcc(rareBonus + 1.5, 'epic', ev.x + 26, ev.y); rollAcc(rareBonus + 1.5, 'epic', ev.x - 26, ev.y); rollLoot(L().bossDrops, rareBonus + 1.5, 'epic', ev.x, ev.y + 20, 'rush'); rollLoot(L().bossDrops, rareBonus + 1.5, 'epic', ev.x + 24, ev.y + 20, 'rush'); giveOrb(true); giveOrb(true); }
        }
        if (ev.by === myId) onMyKill();
    }

    // ================= 無限回廊 =================
    //  迷路の階層（ランダム生成）を下へ下へ。敵の強さ＝「自分のステータス合計」×「階層で上がる倍率」。
    //  宝箱（ミミックの罠あり）／ボス部屋の入口（行かなくてもよい）／下への階段。ソロ専用。
    function corrTotal() { return Math.max(250, (base.maxHp || 0) + (base.atk || 0) + (base.def || 0) + (base.speed || 0) + (base.special || 0)); }
    // 敵の強さの基準：マルチのときは、パーティ全員のステータス合計の平均（各自の合計は pos で配られる）
    function corrPartyTotal() {
        const arr = [corrTotal()]; Object.keys(allies).forEach(id => { if (allies[id].tt > 0) arr.push(allies[id].tt); });
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    function corrMul(f) { return 0.85 * Math.pow(1.095, f - 1); }                   // 階層ごとの倍率（敵の合計ステータス ＝ プレイヤーの合計 × この倍率 × 敵の種類の倍率）。1階は0.85倍、約5階で1.2倍、10階で1.9倍、20階で4.7倍、40階で48倍（深いほど急に自分より強くなる）
    function corrIlvl(f) { return Math.min(46, 6 + f * 0.85); }                      // 階層ごとのドロップ・敵のレベル
    function corrScaleFloor(f) { applyScale(corrPartyTotal(), corrIlvl(f), { hp: 1, dmg: 1, spd: Math.min(1.3, 1 + f * 0.005) }); SC.hpMul = 1; }      // 基準はプレイヤーの合計ステータス。敵ごとの強さは spawnEnemy が「合計ステータス」から決める
    function corrPool(il) {      // この階層で出る武器の表（レベルが近い武器）
        const B = (HW.BASES || []).filter(b => b.tier >= il - 10 && b.tier <= il + 3);
        return (B.length ? B : (HW.BASES || []).slice(-12)).map(b => b.id);
    }
    function corrSolid(x, y) {
        if (!CF.on) return false;
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        if (tx < 0 || ty < 0 || tx >= CF.tw || ty >= CF.th) return true;
        return CF.solid[ty * CF.tw + tx] === 1;
    }
    function corrLOS(x1, y1, x2, y2) {
        if (!CF.on) return true;
        const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 14);
        for (let i = 1; i < n; i++) { const t = i / n; if (corrSolid(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false; }
        return true;
    }
    // 円と壁タイルの押し出し（2回まわして、角でも埋まらないようにする）
    function corrPushOut(o, rad) {
        if (!CF.on) return;
        for (let pass = 0; pass < 2; pass++) {
            const tx0 = Math.floor((o.x - rad) / TILE), tx1 = Math.floor((o.x + rad) / TILE), ty0 = Math.floor((o.y - rad) / TILE), ty1 = Math.floor((o.y + rad) / TILE);
            for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
                if (tx < 0 || ty < 0 || tx >= CF.tw || ty >= CF.th || !CF.solid[ty * CF.tw + tx]) continue;
                const rx = tx * TILE, ry = ty * TILE, cx = clamp(o.x, rx, rx + TILE), cy = clamp(o.y, ry, ry + TILE);
                const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
                if (d >= rad) continue;
                if (d > 0.001) { o.x = cx + dx / d * rad; o.y = cy + dy / d * rad; }
                else {
                    const l = o.x - rx, r2 = rx + TILE - o.x, t = o.y - ry, b = ry + TILE - o.y, m = Math.min(l, r2, t, b);
                    if (m === l) o.x = rx - rad; else if (m === r2) o.x = rx + TILE + rad; else if (m === t) o.y = ry - rad; else o.y = ry + TILE + rad;
                }
            }
        }
    }
    // 深さごとの景色（5階ごとに変わる）と、階層ごとの特性（毎回同じ階層にならないように）
    const CPALS = [      // 床は明るめ、壁はとても暗め（明るさの差を大きくして、同系色でも境目が見えるようにする）。edge は壁のふちの線の色
        { n: '石の回廊', wall: '#0e0a18', hi: 'rgba(190,170,255,0.30)', floor: '#4b4468', edge: 'rgba(210,195,255,0.75)' },
        { n: '凍てつく洞窟', wall: '#0a1622', hi: 'rgba(170,230,255,0.34)', floor: '#46647f', edge: 'rgba(190,240,255,0.8)' },
        { n: '溶岩の洞窟', wall: '#1c0b06', hi: 'rgba(255,170,90,0.36)', floor: '#6a4332', edge: 'rgba(255,190,120,0.8)' },
        { n: '古代遺跡', wall: '#1a1608', hi: 'rgba(255,230,140,0.34)', floor: '#6b6140', edge: 'rgba(255,238,160,0.8)' },
        { n: '深き森', wall: '#07160c', hi: 'rgba(150,255,170,0.32)', floor: '#3f6a4a', edge: 'rgba(170,255,190,0.78)' },
        { n: '虚無の回廊', wall: '#07040f', hi: 'rgba(255,120,230,0.34)', floor: '#3c2c5c', edge: 'rgba(255,150,235,0.8)' }
    ];
    const CTHEMES = [
        { id: 'normal', w: 5, n: '' },
        { id: 'horde', w: 2, n: '大群の階', d: '敵がとても多い。数は多いが、1体ずつは弱い' },
        { id: 'elite', w: 2, n: '精鋭の階', d: '強敵が多い。そのぶん報酬も良い' },
        { id: 'treasure', w: 2, n: '宝物庫の階', d: '宝箱がたくさん。ミミックに注意' },
        { id: 'dark', w: 2, n: '暗闇の階', d: '視界が狭い。仲間と離れすぎないこと' },
        { id: 'swift', w: 2, n: '疾風の階', d: '敵の足がとても速い。止まると囲まれる' },
        { id: 'quiet', w: 1, n: '静寂の階', d: '敵は少なめ。回復の泉が必ずある' }
    ];
    const CAFFIX = [{ id: 'swift', n: '俊足の', i: '💨' }, { id: 'giant', n: '巨躯の', i: '🛡️' }, { id: 'explosive', n: '爆ぜる', i: '💥' }];
    const CDIR = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];        // [dx, dy, 出口のビット, 向こう側の入口のビット]
    function corrCellOf(x, y) {
        const cx = clamp(Math.floor((x / TILE - 1) / CELL_T), 0, CF.cols - 1), cy = clamp(Math.floor((y / TILE - 1) / CELL_T), 0, CF.rows - 1);
        return cy * CF.cols + cx;
    }
    function corrCenter(c) { return CF.rc[c]; }          // 区画の部屋の中心（px）
    function corrBfs(from) {      // マスごとの、from からの歩数
        const f = new Int16Array(CF.cols * CF.rows).fill(-1), q = [from]; f[from] = 0;
        for (let h = 0; h < q.length; h++) {
            const c = q[h], cx = c % CF.cols, cy = Math.floor(c / CF.cols);
            CDIR.forEach(d => { if (!(CF.open[c] & d[2])) return; const nx = cx + d[0], ny = cy + d[1]; if (nx < 0 || ny < 0 || nx >= CF.cols || ny >= CF.rows) return; const n = ny * CF.cols + nx; if (f[n] < 0) { f[n] = f[c] + 1; q.push(n); } });
        }
        return f;
    }
    function corrWaypoint(e, tgt) {      // 壁ごしにプレイヤーが見えないときは、部屋と通路の道なりに進む
        if (!CF.on || corrLOS(e.x, e.y, tgt.x, tgt.y)) return tgt;
        const ec = corrCellOf(e.x, e.y), tc = corrCellOf(tgt.x, tgt.y);
        if (ec === tc) return corrCenter(ec);
        CF.flows = CF.flows || new Map();
        let f = CF.flows.get(tc); if (!f) { if (CF.flows.size > 6) CF.flows.clear(); f = corrBfs(tc); CF.flows.set(tc, f); }
        const cx = ec % CF.cols, cy = Math.floor(ec / CF.cols); let best = -1, bd = f[ec] < 0 ? 1e9 : f[ec];
        CDIR.forEach(d => { if (!(CF.open[ec] & d[2])) return; const nx = cx + d[0], ny = cy + d[1]; if (nx < 0 || ny < 0 || nx >= CF.cols || ny >= CF.rows) return; const n = ny * CF.cols + nx; if (f[n] >= 0 && f[n] < bd) { bd = f[n]; best = n; } });
        if (best < 0) return tgt;
        const nc = corrCenter(best), bend = CF.bend[Math.min(ec, best) * 4096 + Math.max(ec, best)], own = corrCenter(ec);
        if (corrLOS(e.x, e.y, nc.x, nc.y)) return nc;
        if (bend && corrLOS(e.x, e.y, bend.x, bend.y)) return dist(e.x, e.y, bend.x, bend.y) < 26 ? nc : bend;
        return own;
    }
    function corrWake(e) {       // 眠っている敵が起きる条件：誰かが近い／見える／攻撃を受けた
        if (e.flash > 0) { e.act = true; return true; }
        const ps = alivePlayersPos();
        for (const q of ps) { const d = dist(e.x, e.y, q.x, q.y); if (d < 260 || (d < 640 && corrLOS(e.x, e.y, q.x, q.y))) { e.act = true; return true; } }
        return false;
    }
    // 階層を作る（シードが同じなら同じ迷路になる）
    function corrGen(f, spawn) {
        const rng = seeded((CF.seed + f * 7919) >>> 0), RI = n => Math.floor(rng() * n);
        const cols = Math.min(15, 9 + Math.floor(f / 5)), rows = Math.min(10, 6 + Math.floor(f / 7));
        CF.pal = CPALS[Math.min(CPALS.length - 1, Math.floor((f - 1) / 5))];
        { let tw0 = 0; CTHEMES.forEach(t => { tw0 += t.w; }); let r0 = rng() * tw0, th0 = CTHEMES[0]; for (const t of CTHEMES) { if ((r0 -= t.w) <= 0) { th0 = t; break; } } CF.theme = f < 2 ? CTHEMES[0] : th0; }
        const open = new Uint8Array(cols * rows), vis = new Uint8Array(cols * rows), st = [], idx = (cx, cy) => cy * cols + cx;
        const sy = RI(rows); vis[idx(0, sy)] = 1; st.push([0, sy]);
        while (st.length) {      // 穴掘り法（行き止まりの多い、迷路らしい形になる）
            const cur = st[st.length - 1], nb = CDIR.filter(d => { const nx = cur[0] + d[0], ny = cur[1] + d[1]; return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !vis[idx(nx, ny)]; });
            if (!nb.length) { st.pop(); continue; }
            const d = nb[RI(nb.length)], nx = cur[0] + d[0], ny = cur[1] + d[1];
            open[idx(cur[0], cur[1])] |= d[2]; open[idx(nx, ny)] |= d[3]; vis[idx(nx, ny)] = 1; st.push([nx, ny]);
        }
        for (let i = 0, n = Math.floor(cols * rows * 0.1); i < n; i++) {      // 近道：壁を少し抜く
            const cx = RI(cols), cy = RI(rows), d = CDIR[RI(4)], nx = cx + d[0], ny = cy + d[1];
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            open[idx(cx, cy)] |= d[2]; open[idx(nx, ny)] |= d[3];
        }
        CF.cols = cols; CF.rows = rows; CF.open = open;
        // 壁タイル：区画ごとに部屋（5〜12タイル四方）を1つ作り、つながっている区画どうしを幅4タイルの通路（L字）で結ぶ
        const tw = cols * CELL_T + 2, th = rows * CELL_T + 2, solid = new Uint8Array(tw * th).fill(1);
        const carve = (x0, y0, x1, y1) => { for (let y = Math.max(1, y0); y < Math.min(th - 1, y1); y++) for (let x = Math.max(1, x0); x < Math.min(tw - 1, x1); x++) solid[y * tw + x] = 0; };
        const rc = new Array(cols * rows), big = new Uint8Array(cols * rows), roomR = new Array(cols * rows);
        for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
            const ox = 1 + cx * CELL_T, oy = 1 + cy * CELL_T, rw = 5 + RI(8), rh = 5 + RI(8);       // 区画の内側は 12 タイル四方（周りに壁の余白）
            const rx = ox + 1 + RI(12 - rw + 1), ry = oy + 1 + RI(12 - rh + 1);
            carve(rx, ry, rx + rw, ry + rh);
            rc[idx(cx, cy)] = { x: (rx + rw / 2) * TILE, y: (ry + rh / 2) * TILE }; roomR[idx(cx, cy)] = { x: rx, y: ry, w: rw, h: rh }; big[idx(cx, cy)] = 1;
        }
        const bend = {};
        for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
            const a = idx(cx, cy), o = open[a];
            [[2, cx + 1, cy], [4, cx, cy + 1]].forEach(t => {
                if (!(o & t[0])) return; const b = idx(t[1], t[2]);
                const ax = Math.round(rc[a].x / TILE), ay = Math.round(rc[a].y / TILE), bx = Math.round(rc[b].x / TILE), by = Math.round(rc[b].y / TILE);
                carve(Math.min(ax, bx) - 2, ay - 2, Math.max(ax, bx) + 2, ay + 2);       // 横
                carve(bx - 2, Math.min(ay, by) - 2, bx + 2, Math.max(ay, by) + 2);       // 縦
                bend[Math.min(a, b) * 4096 + Math.max(a, b)] = { x: bx * TILE, y: ay * TILE };
            });
        }
        CF.tw = tw; CF.th = th; CF.solid = solid; CF.rc = rc; CF.bend = bend; CF.big = big;
        // 描画用の矩形（横につなげて、縦にも同じ幅のものをつなげる）
        const rects = []; let prev = {};
        for (let ty = 0; ty < th; ty++) {
            const cur = {}; let tx = 0;
            while (tx < tw) {
                if (!solid[ty * tw + tx]) { tx++; continue; }
                let x2 = tx; while (x2 < tw && solid[ty * tw + x2]) x2++;
                const key = tx + ':' + (x2 - tx);
                if (prev[key]) { prev[key][3] += TILE; cur[key] = prev[key]; } else { const r = [tx * TILE, ty * TILE, (x2 - tx) * TILE, TILE]; rects.push(r); cur[key] = r; }
                tx = x2;
            }
            prev = cur;
        }
        CF.rects = rects;
        WORLD_W = tw * TILE; WORLD_H = th * TILE;
        // スタートは左端のマス、階段はそこから最も遠いマス
        const startC = idx(0, sy), dist0 = corrBfs(startC);
        let far = startC; for (let c = 0; c < cols * rows; c++) if (dist0[c] > dist0[far]) far = c;
        const bits = n => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1);
        const dead = []; for (let c = 0; c < cols * rows; c++) if (c !== startC && c !== far && bits(open[c]) === 1 && dist0[c] >= 3) dead.push(c);
        const free = []; for (let c = 0; c < cols * rows; c++) if (c !== startC && c !== far && dist0[c] >= 3) free.push(c);
        const takeCell = () => { const src = dead.length ? dead : free; if (!src.length) return startC; return src.splice(RI(src.length), 1)[0]; };
        const props = [];
        const sc = corrCenter(startC), fc = corrCenter(far);
        const inRoom = c => { const r = roomR[c]; return { x: (r.x + 1 + rng() * (r.w - 2)) * TILE, y: (r.y + 1 + rng() * (r.h - 2)) * TILE }; };
        CF.start = sc; props.push({ k: 'stairs', x: fc.x, y: fc.y, r: 34, c: far });
        { const c = takeCell(), p = inRoom(c); props.push({ k: 'gate', x: p.x, y: p.y, r: 30, c: c }); }       // 脱出ゲート：各階層に1つ。どこかの部屋にある
        const thm = CF.theme.id, nChest = 1 + (rng() < 0.5 ? 1 : 0) + (f % 5 === 0 ? 1 : 0) + (thm === 'treasure' ? 3 : 0) + (thm === 'quiet' ? 1 : 0);
        for (let i = 0; i < nChest; i++) { const c = takeCell(), p = inRoom(c); props.push({ k: 'chest', x: p.x, y: p.y, r: 20, c: c, mimic: f >= 2 && rng() < (thm === 'treasure' ? 0.3 : 0.16) }); }
        // 回復の泉（使い切り）：たまにある。静寂の階では必ずある
        if (f >= 2 && (thm === 'quiet' || rng() < 0.4)) { const c = takeCell(), p = inRoom(c); props.push({ k: 'spring', x: p.x, y: p.y, r: 28, c: c }); }
        // 棘の罠：部屋の中にある。見えている間は、周期的に飛び出す
        { const nTrap = Math.min(14, 3 + Math.floor(f / 2)); for (let i = 0; i < nTrap; i++) { const c = free.length ? free[RI(free.length)] : far, p = inRoom(c); props.push({ k: 'trap', x: p.x, y: p.y, r: 26, c: c, ph: rng() * 3.2 }); } }
        if (f >= 2 && rng() < 0.42) { const c = takeCell(), p = inRoom(c); props.push({ k: 'portal', x: p.x, y: p.y, r: 30, c: c }); }
        CF.props = props; CF.seen = new Uint8Array(cols * rows); CF.flow = null; CF.flowFor = -1;
        CF.mini = document.createElement('canvas'); CF.mini.width = tw; CF.mini.height = th; CF.miniCtx = CF.mini.getContext('2d'); CF.miniDone = new Uint8Array(cols * rows);
        // 敵（グループごとに、スタートから離れたマスへ）。乱数の使い方は全員同じにして（同じ迷路・同じ宝箱になる）、敵を実際に出すのはホストだけ
        const avail = CD.mobs.filter(m => m.from <= f), recent = avail.filter(m => m.from > f - 10);
        const dens = thm === 'horde' ? 1.6 : (thm === 'quiet' ? 0.55 : 1), eliteP = thm === 'elite' ? Math.max(0.45, DIFF.elite * 3) : DIFF.elite;
        const groups = Math.min(34, Math.round((6 + Math.floor(f * 0.5)) * 1.4 * dens)); let planned = 0;
        const put = (def, q, elite) => {
            const ai = Math.floor(rng() * CAFFIX.length), af = elite ? CAFFIX[ai] : null;      // 精鋭には、特性（俊足・巨躯・爆ぜる）がつく。乱数は全員同じように使う
            if (!spawn) return;
            const d2 = af ? Object.assign({}, def, { name: af.n + def.name }) : def, e = spawnEnemy(d2, q.x, q.y, false, elite, corrEnemyTotal(d2, false, elite));
            e.act = false; if (thm === 'swift') e.spd *= 1.25;
            if (af) { e.affix = af.id; if (af.id === 'swift') e.spd *= 1.5; else if (af.id === 'giant') { e.hp = e.maxHp = Math.round(e.maxHp * 1.5); e.r *= 1.25; e.dmg *= 1.15; } }
            pushOutOfRocks(e, e.r);
        };
        for (let g = 0; g < groups && planned < 70; g++) {
            const cands = free.length ? free : [far]; const c = cands[RI(cands.length)];
            const useRecent = recent.length && rng() < 0.6, pool = useRecent ? recent : avail;
            const def = pool[RI(pool.length)] || avail[0];
            const elite = def.arch !== 'swarm' && rng() < eliteP;
            const n = elite ? 1 : Math.round((def.arch === 'swarm' ? 4 + RI(3) : (def.arch === 'tank' ? 1 + RI(2) : (def.arch === 'ranged' ? 2 + RI(2) : 2 + RI(3)))) * 1.4);
            for (let i = 0; i < n; i++) { put(def, inRoom(c), elite); planned++; }
        }
        // モンスターハウス：たまに、部屋ひとつぶんの敵が詰まった部屋と、その奥の宝箱
        if (f >= 4 && rng() < 0.25 && free.length) {
            const c = free[RI(free.length)], def = avail[RI(avail.length)];
            for (let i = 0; i < 14; i++) put(def, inRoom(c), false);
            const p = inRoom(c); props.push({ k: 'chest', x: p.x, y: p.y, r: 20, c: c, mimic: false });
        }
        props.forEach((q, i) => { q.i = i; });      // 添字（宝箱やミミックを、他のプレイヤーに伝えるときの番号）
    }

    function corrPlaceMe() {      // 参加者を、スタート地点の周りに等間隔で並べる（全員が同じ並びで計算する）
        const ids = [myId].concat(Object.keys(allies)).sort(), i = ids.indexOf(myId), a = i / Math.max(1, ids.length) * Math.PI * 2, n = ids.length > 1 ? 34 : 0;
        me.x = CF.start.x + Math.cos(a) * n; me.y = CF.start.y + Math.sin(a) * n; me.dashT = 0; me.inv = Math.max(me.inv, 1.0); pushOutOfRocks(me, me.r);
    }
    function corrNewFloor(f, spawn) {      // spawn=true はホスト（敵を出す）。クライアントは同じ迷路だけ作り、敵はスナップショットで受け取る
        CF.floor = f; CF.on = true; CF.inBoss = false; CF.exit = null; CF.saved = null; CF.gateT = 0; CF.flows = new Map(); CF.portalIdx = -1;
        enemies = []; eBullets = []; telegraphs = []; myShots = []; ghostShots = []; minions = []; domains = []; fx = []; G = {};
        run.bossSpawned = false;
        corrScaleFloor(f);
        corrGen(f, spawn !== false);
        corrPlaceMe();
        try { if (window.SBAch && !DBG) SBAch.report('corrFloor', f); } catch (e) { /* 実績の記録に失敗してもゲームは続ける */ }
        if (me.dead && !me.escaped) { me.dead = false; me.stg = 0; me.reviveT = 0; me.hp = Math.round(me.maxHp * 0.4); }      // 倒れていた仲間も、次の階層へは連れていける
        if (f > 1 && !me.escaped) { run.stats.floors = f - 1; run.stats.coins += Math.round((1 + corrIlvl(f - 1) * 0.6) * 6 * (1 + A('goldPct'))); addHp(me.maxHp * 0.15); announce('🌀 地下' + f + '階　' + CF.pal.n + (CF.theme.n ? '「' + CF.theme.n + '」' : ''), 2000); if (CF.theme.d) setTimeout(() => { if (CF.floor === f) announce(CF.theme.d, 2600); }, 2100); }
        CF.fade = 0.6;
    }
    function corrDescend() {       // ホスト（ソロ含む）だけが呼ぶ。クライアントは「階段に着いた」とお願いして、スナップショットで追いかける
        if (CF.fade > 0 || !CF.on) return;
        corrNewFloor(CF.floor + 1, true);
    }
    // ホストから届いた階層の状態（スナップショット）に、クライアントが合わせる
    function corrSync(c) {
        if (isHost || run.phase !== 'run') return;
        const f = c[0], seed = c[1], inB = !!c[2], ex = !!c[4];
        if (!inB) {
            if (CF.inBoss) corrLeaveBossLocal();
            if (f !== CF.floor || seed !== CF.seed || !CF.rc) { CF.seed = seed; corrNewFloor(f, false); }
        } else {
            if (!CF.inBoss && CF.rc) corrEnterBossLocal(c[3]);
            CF.exit = ex ? { x: WORLD_W / 2, y: WORLD_H / 2, r: 34 } : null;
        }
    }
    function corrEnterBossLocal(pi) {
        CF.saved = { enemies: enemies, W: WORLD_W, H: WORLD_H, px: 0, py: 0, portal: corrProp(pi) };
        const pr = CF.saved.portal; if (pr) { CF.saved.px = pr.x; CF.saved.py = pr.y; }
        enemies = []; eBullets = []; telegraphs = []; myShots = []; ghostShots = []; minions = []; domains = []; fx = []; G = {};
        CF.on = false; CF.inBoss = true; CF.exit = null; WORLD_W = 1700; WORLD_H = 1100;
        const ids = [myId].concat(Object.keys(allies)).sort(), i = ids.indexOf(myId);
        me.x = 240; me.y = WORLD_H / 2 + (i - (ids.length - 1) / 2) * 70; me.dashT = 0; me.inv = Math.max(me.inv, 1.2);
        if (me.dead && !me.escaped) { me.dead = false; me.stg = 0; me.reviveT = 0; me.hp = Math.round(me.maxHp * 0.4); }
        run.bossSpawned = true; CF.fade = 0.4;
    }
    function corrLeaveBossLocal() {
        const sv = CF.saved; WORLD_W = sv ? sv.W : WORLD_W; WORLD_H = sv ? sv.H : WORLD_H;
        enemies = sv && isHost ? sv.enemies : []; eBullets = []; telegraphs = []; myShots = []; ghostShots = []; minions = []; domains = []; fx = []; G = {};
        CF.on = true; CF.inBoss = false; CF.exit = null;
        if (sv && sv.portal) sv.portal.k = 'portal_done';
        CF.saved = null; if (sv) { me.x = sv.px; me.y = sv.py + 48; } me.dashT = 0; me.inv = Math.max(me.inv, 1.0); pushOutOfRocks(me, me.r);
        corrScaleFloor(CF.floor); CF.fade = 0.4; run.bossSpawned = false;
    }
    // 宝箱：武器・防具・特殊アイテムのどれかが出る
    function corrGiveItem(kind, x, y, n) {
        n = n || 1; BAG.items[kind] = (BAG.items[kind] || 0) + n;      // 袋に入れる（脱出するまで保存されない）
        run.stats.items = run.stats.items || {}; run.stats.items[kind] = (run.stats.items[kind] || 0) + n;
        const it = HW.SPECIAL_ITEMS[kind];
        popups.push({ x: x, y: y - 14, t: 1.8, text: it.icon + ' ' + it.name + (n > 1 ? '×' + n : ''), c: it.color, big: true });
        fx.push({ k: 'ring', x: x, y: y, r: 0, max: 56, t: 0.5, life: 0.5, c: it.color });
        refreshLootLog();
    }
    function corrPickItem() { const r = Math.random() * 100; return r < 38 ? 'slot' : (r < 55 ? 'rarity' : 'reroll'); }      // 昇華の結晶がいちばん出にくい
    function corrChestReward(x, y) {
        const f = CF.floor, il = corrIlvl(f), pool = corrPool(il), rb = A('rarePct') + DIFF.luck + Math.min(2, f * 0.03);
        LT = { ilvl: il, id: 'infinite_corridor', mats: stage.mats, drops: pool, bossDrops: pool };
        try {
            const r = Math.random();
            if (r < 0.50) rollLoot(pool, rb, 'magic', x, y, 'chest');
            else if (r < 0.64) rollAcc(rb, 'normal', x, y);              // アクセサリー 14%
            else if (r < 0.80) corrGiveItem(corrPickItem(), x, y, 1);      // 特殊アイテム 16%（以前は36%）
            else rollArmor(rb, 'magic', x, y, 'chest');
            run.stats.coins += Math.round((1 + il * 0.6) * 8 * (1 + A('goldPct')));
        } finally { LT = null; }
    }
    function corrOpenChest(p) {
        p.k = 'open'; CF.st.chests++; netSend('cho', { i: p.i });
        try { if (window.SBAch) SBAch.report('chest', 0); } catch (e) { /* 実績の記録に失敗してもゲームは続ける */ }
        fx.push({ k: 'ring', x: p.x, y: p.y, r: 0, max: 70, t: 0.5, life: 0.5, c: '#ffd84a' });
        corrChestReward(p.x, p.y);
    }
    function corrWakeMimic(p) {
        CF.props = CF.props.filter(q => q !== p); CF.st.mimics++; netSend('cmim', { i: p.i });
        try { if (window.SBAch) SBAch.report('chest', 1); } catch (e) { /* 実績の記録に失敗してもゲームは続ける */ }
        const e = spawnEnemy(CD.mimic, p.x, p.y, false, true, corrEnemyTotal(CD.mimic, false, true, 1.4)); e.mimic = true; e.act = true; e.hp = e.maxHp = Math.round(e.maxHp * 0.9); e.spd *= 1.2;
        pushOutOfRocks(e, e.r);
        popups.push({ x: p.x, y: p.y - 30, t: 1.4, text: 'ミミックだ！', c: '#ff6a5a', big: true });
        fx.push({ k: 'ring', x: p.x, y: p.y, r: 0, max: 90, t: 0.4, life: 0.4, c: '#ff6a5a' });
    }
    // 敵を倒したときの報酬（無限回廊）
    function corrKillReward(ev) {
        const il = ev.ilvl || corrIlvl(CF.floor), rb = A('rarePct') + DIFF.luck + (ev.elite ? 0.5 : 0) + (ev.cm ? 0.6 : 0) + (ev.cb ? 0.8 + ev.cb * 0.08 : 0), luck = A('dropPct');
        run.stats.coins += Math.round((1 + il * 0.6) * (ev.cb ? 30 + ev.cb * 8 : (ev.cm ? 12 : (ev.elite ? 6 : 1))) * (1 + A('goldPct')));
        rollMats(ev.cb ? 'boss' : (ev.elite ? 'elite' : 'mob'), ev.x, ev.y);
        if (ev.cb) {
            const t = ev.cb;      // ボス部屋のボス：特別な報酬（強いボスほど豪華）
            rollLoot(L().bossDrops, rb + 0.8, 'rare', ev.x, ev.y, 'cboss'); rollLoot(L().bossDrops, rb + 1.2, 'epic', ev.x + 24, ev.y, 'cboss');
            if (t >= 6) rollLoot(L().bossDrops, rb + 1.6, 'epic', ev.x - 24, ev.y, 'cboss');
            rollArmor(rb + 0.8, 'rare', ev.x, ev.y - 22, 'cboss');
            rollAcc(rb + 1.0, t >= 6 ? 'epic' : 'rare', ev.x, ev.y + 34); if (t >= 8) rollAcc(rb + 1.4, 'epic', ev.x - 36, ev.y + 34);      // ボスは、アクセサリーを必ず落とす
            corrGiveItem('slot', ev.x - 30, ev.y + 20, t >= 8 ? 2 : 1); if (t >= 4 || Math.random() < 0.5) corrGiveItem('rarity', ev.x, ev.y + 26, t >= 9 ? 2 : 1); corrGiveItem('reroll', ev.x + 30, ev.y + 20, 1);      // ボスの特殊アイテムも控えめに
            giveOrb(true);
        } else if (ev.cm) {
            rollLoot(L().drops, rb, 'rare', ev.x, ev.y, 'mimic'); if (Math.random() < 0.4) rollAcc(rb, 'magic', ev.x - 14, ev.y); if (Math.random() < 0.3) corrGiveItem(corrPickItem(), ev.x + 20, ev.y + 10, 1); if (Math.random() < 0.4) rollArmor(rb, 'magic', ev.x, ev.y - 16, 'mimic');
        } else if (ev.elite) {
            if (Math.random() < 0.55 * (1 + luck)) rollLoot(L().drops, rb, 'magic', ev.x, ev.y, 'elite');
            if (Math.random() < 0.22 * (1 + luck)) rollArmor(rb, 'magic', ev.x, ev.y - 16, 'elite');
            if (Math.random() < 0.06 * (1 + luck)) rollAcc(rb, 'normal', ev.x + 12, ev.y);
            if (Math.random() < 0.04) corrGiveItem(corrPickItem(), ev.x + 16, ev.y + 8, 1);
            if (Math.random() < 0.22 * (1 + A('orbPct'))) giveOrb(false);
        } else {
            if (Math.random() < 0.07 * (1 + luck)) rollLoot(L().drops, rb, 'normal', ev.x, ev.y, 'mob');
            if (Math.random() < 0.025 * (1 + luck)) rollArmor(rb, 'normal', ev.x, ev.y - 12, 'mob');
            if (Math.random() < 0.006 * (1 + luck)) rollAcc(rb, 'normal', ev.x + 10, ev.y);
            if (Math.random() < 0.035 * (1 + A('orbPct'))) giveOrb(false);
        }
        if (ev.by === myId) {
            onMyKill();
            if (!me.dead && Math.random() < (ev.elite || ev.cb || ev.cm ? 0.5 : 0.09)) { addHp(me.maxHp * (ev.elite || ev.cb || ev.cm ? 0.2 : 0.1)); popups.push({ x: me.x, y: me.y - 34, t: 0.9, text: '+HP', c: '#7aff9a' }); }
        }
    }
    // ボス部屋：入口に入ると、壁のない広間でボスと戦う。倒すと出口が現れ、迷路の元の場所に戻れる
    function corrEnterBoss(p) {      // ホストだけが呼ぶ
        if (!CF.on) return;
        corrEnterBossLocal(p.i);
        CF.saved.enemies = CF.saved.enemies; CF.portalIdx = p.i;
        const tier = (DBG && DBG.corrBoss) ? clamp(DBG.corrBoss | 0, 1, 10) : clamp(Math.round(1 + CF.floor / 4.5 + rnd(-1.2, 1.2)), 1, 10), bd = CD.bosses[tier - 1];      // デバッグ戦闘では、ボスを指定できる
        applyScale(corrPartyTotal(), corrIlvl(CF.floor) + 4, { hp: 1, dmg: 1, spd: 1.05 }); SC.hpMul = 1.2 + tier * 0.1;
        const b = spawnEnemy({ name: bd.name, icon: bd.icon, arch: 'chaser', color: bd.color }, WORLD_W - 420, WORLD_H / 2, true, false, corrPartyTotal() * corrMul(CF.floor) * bd.mul * 1.35);
        b.bd = { name: bd.name, icon: bd.icon, color: bd.color, stand: true, patterns: ['radial'], set: bd.set }; b.bset = (BM && BM.SETS && BM.SETS[bd.set]) || null; b.cboss = tier; b.spd = 60 * PW.spd; b.t = -1.5;
        if (DBG && DBG.hp > 0 && DBG.hp !== 1) b.maxHp = b.hp = Math.max(1, Math.round(b.maxHp * DBG.hp));
        run.bossSpawned = true; run.bossDead = false;
        netAnnounce('⚠ ' + bd.name + ' が現れた！', 2800);
    }
    function corrBossDown() {      // ボス部屋のボスを倒した
        CF.st.bosses++; run.bossSpawned = false;
        CF.exit = { x: WORLD_W / 2, y: WORLD_H / 2, r: 34 };
        netAnnounce('🏆 ボスを討伐！　出口から回廊へ戻れる', 3000);
    }
    function corrLeaveBoss() { if (CF.inBoss) corrLeaveBossLocal(); }
    // 毎フレーム：階段・宝箱・入口・出口との接触
    function corrUpdate(dt) {
        if (!CORR_ON || run.phase !== 'run' || !CF.rc) return;
        if (CF.fade > 0) CF.fade -= dt; if (CF.reqT > 0) CF.reqT -= dt;
        if (isHost && CF.on) {      // ミミックは、誰かが近づいたらホストが起こす（ホストが倒れていても、仲間が近づけば動く）
            const ps = alivePlayersPos();
            for (const p of CF.props.slice()) if (p.k === 'chest' && p.mimic && ps.some(q => dist(q.x, q.y, p.x, p.y) < 74)) corrWakeMimic(p);
        }
        if (me.dead || me.escaped) { CF.gateT = 0; return; }
        if (CF.on) {
            const c = corrCellOf(me.x, me.y); CF.seen[c] = 1;
            const cx = c % CF.cols, cy = Math.floor(c / CF.cols);
            CDIR.forEach(d => { if (CF.open[c] & d[2]) { const nx = cx + d[0], ny = cy + d[1]; if (nx >= 0 && ny >= 0 && nx < CF.cols && ny < CF.rows) { const n = corrCenter(ny * CF.cols + nx); if (dist(me.x, me.y, n.x, n.y) < 330) CF.seen[ny * CF.cols + nx] = 1; } } });
            CF.clock = (CF.clock || 0) + dt;
            let onGate = false;
            for (const p of CF.props.slice()) {
                const d = dist(me.x, me.y, p.x, p.y);
                if (p.k === 'trap') { const ph = (CF.clock + p.ph) % 3.2; p.on = ph > 2.5 ? 2 : (ph > 2.0 ? 1 : 0); if (p.on === 2 && d < p.r + 6) hurtMe(foeDmg('chaser', false, false) * 0.9); continue; }
                if (p.k === 'spring' && d < p.r + 10) { p.k = 'spring_done'; netSend('cuse', { i: p.i }); addHp(me.maxHp * 0.5); me.energy = Math.min(ENERGY_MAX, me.energy + ENERGY_MAX * 0.5); popups.push({ x: p.x, y: p.y - 28, t: 1.2, text: '泉：HP回復', c: '#7aff9a', big: true }); fx.push({ k: 'ring', x: p.x, y: p.y, r: 0, max: 110, t: 0.6, life: 0.6, c: '#7aff9a' }); continue; }
                if (p.k === 'stairs' && d < p.r + 6) { corrAsk('stairs'); return; }
                else if (p.k === 'chest' && !p.mimic && d < p.r + 18) corrOpenChest(p);
                else if (p.k === 'portal' && d < p.r + 6) { corrAsk('portal', p.i); return; }
                else if (p.k === 'gate' && d < p.r) onGate = true;
            }
            if (onGate) { CF.gateT += dt; if (CF.gateT >= 1.2) { CF.gateT = 0; corrEscape(); } }
            else CF.gateT = Math.max(0, CF.gateT - dt * 2);
        } else if (CF.inBoss && CF.exit && dist(me.x, me.y, CF.exit.x, CF.exit.y) < CF.exit.r + 6) corrAsk('exit');
    }
    // 袋の中身を、持ち物に反映する（脱出に成功したときだけ呼ばれる）
    function corrCommit() {
        const d = HW.load();
        BAG.weapons.forEach(w => d.weapons.push(w));
        if (window.SBArmor) BAG.armors.forEach(a => SBArmor.add(d, a));
        if (window.SBAcc) { SBAcc.ensure(d); BAG.accs.forEach(a => d.accs.push(a)); }
        Object.keys(BAG.items).forEach(k => HW.addItem(d, k, BAG.items[k]));
        HW.save(d);
        const p = getPlayerData();
        if (p) {
            if (!p.materials || Array.isArray(p.materials)) p.materials = {};
            Object.keys(BAG.mats).forEach(id => { p.materials[id] = (p.materials[id] || 0) + BAG.mats[id]; });
            if (!Array.isArray(p.orbs)) p.orbs = [];
            BAG.orbs.forEach(o => p.orbs.push(o));
            try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {}
        }
        BAG.weapons = []; BAG.armors = []; BAG.accs = []; BAG.items = {}; BAG.mats = {}; BAG.orbs = [];
    }
    // 脱出ゲートの上で少し立ち止まると脱出できる。脱出すると、ここまでの報酬を持ち帰って、この冒険は終わる
    function corrEscape() {
        if (run.escaped || me.dead || run.phase !== 'run') return;
        run.escaped = true; me.escaped = true;
        try { if (window.SBAch) SBAch.report('escape', CF.floor); } catch (e) { /* 実績の記録に失敗してもゲームは続ける */ }
        netSend('esc', {});
        const others = Object.keys(allies).some(id => !allies[id].dead && !allies[id].esc);
        if (isHost && others) {          // ホストが先に脱出：仲間が続けられるよう、裏でゲームを動かし続ける（自分は倒れた扱いで敵に狙われない）
            me.dead = true; me.hp = 0; me.stunT = 0; me.orb = null;
            finish(true, { reason: 'escape', ghost: true });
        } else if (isHost) finishHost(true, 'escape');
        else finish(true, { reason: 'escape' });
    }
    function corrGiveUp() { if (run.ended || run.phase !== 'run' || run.settled) return; if (isHost && Object.keys(allies).some(id => !allies[id].dead && !allies[id].esc)) { alert('仲間が冒険を続けているので、ホストはあきらめられません。脱出ゲートから脱出してください。'); return; } if (isHost) { run.ended = true; finishHost(false, 'giveup'); } else { netSend('esc', {}); finish(false, { reason: 'giveup' }); } }
    function corrAsk(k, i) {        // 階段・ボス部屋の入口・出口に触れた：ホストなら実行、クライアントならホストにお願いする
        if (isHost) { if (k === 'stairs') corrDescend(); else if (k === 'portal') { const p = corrProp(i); if (p && p.k === 'portal') corrEnterBoss(p); } else if (k === 'exit') corrLeaveBoss(); }
        else if (CF.reqT <= 0) { CF.reqT = 1.2; netSend('creq', { k: k, i: i }); }
    }
    function corrProp(i) { return CF.props.find(p => p.i === i) || null; }

    // ---------- 開始・終了 ----------
    function beginRun() {
        if (run.phase !== 'wait') return;
        run.phase = 'run'; run.time = 0;
        run.pvpMode = PVP && partyCount() > 1;
        document.getElementById('waitRoom').style.display = 'none';
        if (run.pvpMode && TEAM && room) {
            // チーム戦：部屋の参加順に、青(0)・赤(1)へ交互に振り分ける（全員が同じ順番を持っているので一致する）。青は左、赤は右に並ぶ
            teamMap = {}; room.members.forEach((m, i) => { teamMap[m.id] = i % 2; });
            const mine = room.members.filter(m => teamMap[m.id] === teamMap[myId]), k = Math.max(0, mine.findIndex(m => m.id === myId));
            me.x = teamMap[myId] === 0 ? 300 : WORLD_W - 300; me.y = WORLD_H / 2 + (k - (mine.length - 1) / 2) * 170; pushOutOfRocks(me, me.r);
            me.ang = teamMap[myId] === 0 ? 0 : Math.PI;
            announce('⚔ ' + (teamMap[myId] === 0 ? '🔵青' : '🔴赤') + 'チーム！　相手チームを全員倒そう（制限時間 ' + Math.round(TIME_LIMIT / 60) + '分）', 2800);
        } else if (run.pvpMode) {
            // 参加者を円周上に等間隔で配置（全員が同じ並びで計算するので一致する）
            const ids = [myId].concat(Object.keys(allies)).sort(), i = ids.indexOf(myId), a = i / ids.length * Math.PI * 2;
            me.x = WORLD_W / 2 + Math.cos(a) * 380; me.y = WORLD_H / 2 + Math.sin(a) * 300; pushOutOfRocks(me, me.r);
            announce('⚔ 最後まで立っていた人の勝ち！（制限時間 ' + Math.round(TIME_LIMIT / 60) + '分）', 2600);
        } else if (RUSH_ON) announce('🏆 ボスラッシュ（' + DIFF.name + '）　フェーズ1〜5とFinal！', 2600);
        else if (CORR_ON) {
            corrMakeRetreatBtn();
            if (isHost) {      // 迷路はホストが決める（シード）。仲間にはスナップショットで伝わり、同じ迷路が作られる
                CF.seed = (Math.random() * 4294967295) >>> 0;
                const go = () => { if (run.phase === 'run' && !CF.rc && DBG && DBG.corrBoss) { const tb = clamp(DBG.corrBoss | 0, 1, 10); corrNewFloor(DBG.floor > 0 ? DBG.floor | 0 : Math.max(1, Math.round((tb - 1) * 4.5 + 1)), true); const pt = CF.props.find(q => q.k === 'portal'); corrEnterBoss({ i: pt ? pt.i : 0 }); return; }      // デバッグ戦闘：その階層を作ってすぐボス部屋へ
                    if (run.phase === 'run' && !CF.rc) corrNewFloor(Math.max(1, Math.min(launch.startFloor | 0 || 1, Math.max(1, hack.corridorBest | 0 || 1))), true); };      // 行ったことのある階層（最深まで）から始められる
                if (partyCount() > 1) setTimeout(go, 700); else go();      // マルチのときは、仲間のステータス（敵の強さの基準）が届くのを少し待つ
            }
            announce('🌀 無限回廊　階段を探して下へ！　持ち帰るには「脱出ゲート」から脱出', 3400);
        }
        else announce(stage.icon + ' ' + stage.name + (PVP ? '　スパーリングボットを倒せ！' : '　敵を倒してボスを呼び出せ！'), 2600);
        if (DBG) announce('🛠 デバッグ戦闘（報酬・クリア記録なし）' + (DBG.god ? '　無敵' : '') + (DBG.hp && DBG.hp !== 1 ? '　ボスHP×' + DBG.hp : ''), 3200);
        refreshLootLog();
    }

    function finish(win, d) {
        if (run.phase === 'end') return;
        if (run.settled) {      // 無限回廊：ホストが先に脱出して精算を済ませている。ほんとうに終わるときは、ゲームを止めるだけ
            run.phase = 'end'; run.ended = true; return;
        }
        if (!(d && d.ghost)) { run.phase = 'end'; run.ended = true; }
        else run.settled = true;
        if (DBG) { run.stats.coins = 0; showResult(win, d || {}); return; }   // デバッグ戦闘：コインもクリア記録も反映しない
        // 報酬の反映
        if (CORR_ON) {      // 無限回廊：脱出に成功したときだけ、袋の中身とコインを持ち帰れる。倒れたら（あきらめても）ぜんぶ失う
            if (run.escaped) corrCommit();
            else { run.lost = { coins: run.stats.coins, n: run.stats.loot.length, orbs: run.stats.orbs, mats: Object.keys(run.stats.mats).reduce((a, k) => a + run.stats.mats[k], 0), items: Object.assign({}, run.stats.items || {}) }; run.stats.coins = 0; }
        }
        const p = getPlayerData();
        if (PVP && run.pvpMode) run.stats.coins += win ? 400 : 120;      // 対人戦：勝てば400、負けても120
        if (PVP && run.pvpMode && window.SBPvpEvent) run.evGain = SBPvpEvent.award(win);   // シーズン最終週のPvPイベント：イベントポイント
        if (p) {
            p.coins = (p.coins || 0) + run.stats.coins;
            if (PVP && run.pvpMode && win) p.pvpWins = (p.pvpWins || 0) + 1;
            try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {}
        }
        const h = HW.load();
        if (PVP) h.pvpPlayed = true;      // ビギナーミッション「オンラインマッチに参加しよう」用
        if (!h.clearedDiff) h.clearedDiff = {};
        const diffIdx = DIFFS.indexOf(DIFF);
        if (CORR_ON) { h.corridorBest = Math.max(h.corridorBest | 0, CF.floor); }
        if (RUSH_ON) { const reached = win ? RUSHD.phases.length : Math.max(0, RS.ph - (RS.st === 2 ? 0 : 1)); h.rushBest = h.rushBest || {}; h.rushBest[diffIdx] = Math.max(h.rushBest[diffIdx] | 0, reached); run.rushReached = reached; }
        if (win && !PVP && !CORR_ON) { const cd = h.clearedDiff[stage.id] = h.clearedDiff[stage.id] || {}; cd[diffIdx] = (cd[diffIdx] | 0) + 1; }     // どの難易度でクリアしたか（ボスラッシュのエクストリーム解放などに使う）
        if (win && RUSH_ON && !h.corridorOpen) { h.corridorOpen = true; h.worldNotice = { t: '無限回廊が解放された！', s: '果てしない迷宮が、町のステージゲートに現れた' }; run.worldBanner = { t: '🌀 無限回廊が解放された！', s: 'ステージゲートの「無限回廊」へ。階段を探して、どこまでも下へ' }; }
        if (win) {
            h.cleared[stage.id] = (h.cleared[stage.id] || 0) + 1;
            const wo = worldOpenedByThisStage(), wg = worldOpenedByGate();
            if (wo && !h[wo.unlock.gateFlag]) { h[wo.unlock.gateFlag] = true; h.worldNotice = { t: wo.unlock.openText, s: wo.unlock.openSub }; run.worldBanner = { t: '🚪 ' + wo.unlock.openText, s: wo.unlock.openSub }; }
            if (stage.id === 'gate_world4' && h.cleared[stage.id] === 1) run.formUnlock = '新しいスキルの形「🌌包囲弾幕」を解放！（オリジナルスキルの「①形」から選べます）';   // 初めて機神の門のゲートキーパーを倒した
            if (wg && !h[wg.unlock.flag]) { h[wg.unlock.flag] = true; h.worldNotice = { t: wg.unlock.clearText, s: wg.unlock.clearSub }; run.worldBanner = { t: '🌌 ' + wg.unlock.clearText, s: wg.unlock.clearSub }; }
            HW.save(h);
        }
        HW.save(h);
        try { if (window.SBAch) { if (PVP) SBAch.report('pvp', win ? 1 : 0); if (win && !PVP && !CORR_ON) SBAch.report('clear', stage.id); SBAch.evaluate(); } } catch (e) { /* 実績の記録に失敗してもゲームは続ける */ }
        showResult(win, d || {});
    }

    // ---------- 描画 ----------
    const cam = { x: 0, y: 0 };
    function render() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = stage.bg2; ctx.fillRect(0, 0, VW, VH);
        cam.x = clamp(me.x, VW / 2, Math.max(VW / 2, WORLD_W - VW / 2)); cam.y = clamp(me.y, VH / 2, Math.max(VH / 2, WORLD_H - VH / 2));
        if (WORLD_W < VW) cam.x = WORLD_W / 2; if (WORLD_H < VH) cam.y = WORLD_H / 2;
        const ox = VW / 2 - cam.x, oy = VH / 2 - cam.y;
        ctx.save(); ctx.translate(ox, oy);
        // 床
        const floorCol = (CORR_ON && CF.on && CF.pal && CF.pal.floor) || stage.bg, pxOn = !!(window.SBPix && SBPix.on() && SBPix.pattern);
        if (pxOn) {      // ドット絵の床：色から地面の種類（草・土・石・砂・雪・溶岩・虚空）を決めて、タイルを敷き詰める
            const fk = (CORR_ON && CF.on) ? 'stone' : (stage._fk || (stage._fk = SBPix.kindOfColor(stage.bg)));
            ctx.imageSmoothingEnabled = false; ctx.fillStyle = SBPix.pattern(ctx, fk, floorCol); ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            if (!(CORR_ON && CF.on)) SBPix.drawScatter(ctx, fk, floorCol, cam.x - VW / 2 - 20, cam.y - VH / 2 - 20, cam.x + VW / 2 + 20, cam.y + VH / 2 + 20, WORLD_W, WORLD_H, stage.id ? stage.id.length * 977 : 7, (x, y) => rocks.some(k => dist(x, y, k.x, k.y) < k.r + 14));
        } else {
        ctx.fillStyle = floorCol; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); for (let x = 0; x <= WORLD_W; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); } for (let y = 0; y <= WORLD_H; y += 100) { ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); } ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 6; ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
        if (CORR_ON) corrDrawWorld();
        // 岩
        rocks.forEach(k => { if (pxOn) { SBPix.drawRock(ctx, k.x, k.y, k.r); return; } ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(k.x + 4, k.y + 6, k.r, 0, 7); ctx.fill(); ctx.fillStyle = '#6b6f78'; ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, 7); ctx.fill(); ctx.fillStyle = '#868b95'; ctx.beginPath(); ctx.arc(k.x - k.r * 0.25, k.y - k.r * 0.3, k.r * 0.55, 0, 7); ctx.fill(); });
        // 予告範囲
        telegraphs.forEach(t => drawTele(t));
        // 敵
        drawDomains();
        enemies.forEach(e => drawEnemy(e));
        drawMinions();
        // 敵弾
        eBullets.forEach(b => { if (b.kd === 1) { drawSword(b); return; } if (b.refl === 1) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, 7); ctx.stroke(); } if (pxOn && SBPix.drawBullet) { SBPix.drawBullet(ctx, b.x, b.y, b.r, b.c || '#ff6a5a', { vx: b.vx, vy: b.vy }); return; } ctx.fillStyle = b.c || '#ff6a5a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, 7); ctx.fill(); });
        // 自分の弾
        if (pxOn && SBPix.drawBullet) { myShots.forEach(s => SBPix.drawBullet(ctx, s.x, s.y, s.r, s.c, { vx: s.vx, vy: s.vy, arrow: !!s.ar })); ghostShots.forEach(s => SBPix.drawBullet(ctx, s.x, s.y, s.r, s.c, { vx: s.vx || 0, vy: s.vy || 0 })); }
        else {
        myShots.forEach(s => { ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); });
        ghostShots.forEach(s => { ctx.fillStyle = s.c; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
        }
        // 味方
        Object.keys(allies).forEach(id => drawPlayer(allies[id], false));
        drawPlayer(me, true);
        // 演出
        fx.forEach(f => drawFx(f));
        popups.forEach(p => { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.font = (p.big ? 'bold 18px' : 'bold 14px') + ' sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(p.text, p.x, p.y - (0.7 - Math.min(0.7, p.t)) * 30); ctx.fillStyle = p.c; ctx.fillText(p.text, p.x, p.y - (0.7 - Math.min(0.7, p.t)) * 30); ctx.globalAlpha = 1; });
        ctx.restore();
        if (CORR_ON && CF.on && CF.theme && CF.theme.id === 'dark' && !me.dead && !(window.SBAcc && SBAcc.hasSpecial(hack, 'antidark'))) {      // 暗闇の階：自分の周りだけが見える
            const sx = me.x - cam.x + VW / 2, sy = me.y - cam.y + VH / 2, g = ctx.createRadialGradient(sx, sy, 90, sx, sy, 330);
            g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,10,0.93)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        }
        drawHUD();
    }

        // 無限回廊の壁・階段・宝箱・入口の描画
    function corrDrawWorld() {
        const x0 = cam.x - VW / 2 - 60, x1 = cam.x + VW / 2 + 60, y0 = cam.y - VH / 2 - 60, y1 = cam.y + VH / 2 + 60;
        if (CF.on) {
            const pal = CF.pal || CPALS[0];
            ctx.fillStyle = (window.SBPix && SBPix.on() && SBPix.pattern) ? SBPix.pattern(ctx, 'brick', SBPix.shade(pal.wall, 0.2)) : pal.wall;
            for (const r of CF.rects) { if (r[0] > x1 || r[1] > y1 || r[0] + r[2] < x0 || r[1] + r[3] < y0) continue; ctx.fillRect(r[0], r[1], r[2], r[3]); }
            ctx.fillStyle = pal.hi;
            for (const r of CF.rects) { if (r[0] > x1 || r[1] > y1 || r[0] + r[2] < x0 || r[1] + r[3] < y0) continue; ctx.fillRect(r[0], r[1], r[2], 4); }
            // 壁のふち取り：床に接している辺だけに明るい線を引く（床との境目をはっきりさせる）
            ctx.fillStyle = pal.edge || 'rgba(255,255,255,0.6)';
            const tx0 = Math.max(0, Math.floor(x0 / TILE)), tx1 = Math.min(CF.tw - 1, Math.floor(x1 / TILE)), ty0 = Math.max(0, Math.floor(y0 / TILE)), ty1 = Math.min(CF.th - 1, Math.floor(y1 / TILE));
            const sol = (tx, ty) => tx < 0 || ty < 0 || tx >= CF.tw || ty >= CF.th || CF.solid[ty * CF.tw + tx] === 1;
            for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
                if (CF.solid[ty * CF.tw + tx] !== 1) continue;
                const px = tx * TILE, py = ty * TILE;
                if (!sol(tx, ty - 1)) ctx.fillRect(px, py, TILE, 3);
                if (!sol(tx, ty + 1)) ctx.fillRect(px, py + TILE - 3, TILE, 3);
                if (!sol(tx - 1, ty)) ctx.fillRect(px, py, 3, TILE);
                if (!sol(tx + 1, ty)) ctx.fillRect(px + TILE - 3, py, 3, TILE);
            }
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const now = performance.now() / 1000;
        if (CF.on) CF.props.forEach(p => {
            if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return;
            if (p.k === 'stairs') { ctx.strokeStyle = 'rgba(255,216,74,' + (0.55 + 0.3 * Math.sin(now * 3)) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(30,20,60,0.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, 7); ctx.fill(); ctx.font = '28px sans-serif'; ctx.fillText('🪜', p.x, p.y + 1); }
            else if (p.k === 'gate') {      // 脱出ゲート：立ち止まると脱出できる
                const pr = Math.min(1, CF.gateT / 1.2), near = dist(me.x, me.y, p.x, p.y) < p.r + 70;
                ctx.strokeStyle = 'rgba(120,255,220,' + (0.55 + 0.3 * Math.sin(now * 3.4)) + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, 32, 0, 7); ctx.stroke();
                ctx.fillStyle = 'rgba(0,50,50,0.75)'; ctx.beginPath(); ctx.arc(p.x, p.y, 27, 0, 7); ctx.fill(); ctx.font = '28px sans-serif'; ctx.fillText('🌀', p.x, p.y + 1);
                if (pr > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, 38, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); ctx.stroke(); }
                if (near) { ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#c8fff0'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; ctx.strokeText(pr > 0 ? '脱出中…' : '脱出ゲート（乗ると脱出）', p.x, p.y - 50); ctx.fillText(pr > 0 ? '脱出中…' : '脱出ゲート（乗ると脱出）', p.x, p.y - 50); }
            }
            else if (p.k === 'spring') { ctx.fillStyle = 'rgba(80,220,160,' + (0.25 + 0.12 * Math.sin(now * 2.5)) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, 7); ctx.fill(); ctx.font = '28px sans-serif'; ctx.fillText('⛲', p.x, p.y); }
            else if (p.k === 'spring_done') { ctx.globalAlpha = 0.4; ctx.font = '26px sans-serif'; ctx.fillText('⛲', p.x, p.y); ctx.globalAlpha = 1; }
            else if (p.k === 'trap') { const on = p.on | 0; ctx.fillStyle = on === 2 ? 'rgba(255,80,80,0.9)' : (on === 1 ? 'rgba(255,200,80,0.55)' : 'rgba(255,255,255,0.12)'); ctx.beginPath(); ctx.arc(p.x, p.y, on === 2 ? 26 : 22, 0, 7); ctx.fill(); if (on === 2) { ctx.font = '22px sans-serif'; ctx.fillText('▲▲', p.x, p.y); } }
            else if (p.k === 'chest') { ctx.font = '30px sans-serif'; ctx.fillText('📦', p.x, p.y); }
            else if (p.k === 'open') { ctx.globalAlpha = 0.45; ctx.font = '26px sans-serif'; ctx.fillText('📭', p.x, p.y); ctx.globalAlpha = 1; }
            else if (p.k === 'portal') { ctx.strokeStyle = 'rgba(255,70,90,' + (0.6 + 0.3 * Math.sin(now * 4)) + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(60,0,20,0.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, 7); ctx.fill(); ctx.font = '26px sans-serif'; ctx.fillText('👹', p.x, p.y + 1); }
            else if (p.k === 'portal_done') { ctx.globalAlpha = 0.4; ctx.font = '24px sans-serif'; ctx.fillText('🕳️', p.x, p.y); ctx.globalAlpha = 1; }
        });
        if (CF.on && !CF.inBoss && window.SBAcc && SBAcc.hasSpecial(hack, 'compass') && !me.dead) {      // 記念の羅針盤：脱出ゲートの方向を示す矢印
            const g = CF.props.find(q => q.k === 'gate');
            if (g && dist(me.x, me.y, g.x, g.y) > 140) {
                const an = Math.atan2(g.y - me.y, g.x - me.x), ax = me.x + Math.cos(an) * 74, ay = me.y + Math.sin(an) * 74;
                ctx.save(); ctx.translate(ax, ay); ctx.rotate(an); ctx.globalAlpha = 0.55 + 0.3 * Math.sin(now * 4);
                ctx.fillStyle = '#6dffe0'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.stroke(); ctx.fill();
                ctx.restore(); ctx.globalAlpha = 1;
            }
        }
        if (CF.inBoss && CF.exit) { const p = CF.exit; ctx.strokeStyle = 'rgba(120,230,255,' + (0.6 + 0.3 * Math.sin(now * 4)) + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, 32, 0, 7); ctx.stroke(); ctx.font = '26px sans-serif'; ctx.fillText('🚪', p.x, p.y + 1); }
        ctx.textBaseline = 'alphabetic';
    }
    function corrDrawMini(mx, my, sx, sy) {      // ミニマップ：行ったことのあるマスと、見つけた階段・宝箱・入口
        if (!CF.on || !CF.seen) return;
        ctx.fillStyle = 'rgba(170,160,220,0.38)';
        for (let c = 0; c < CF.seen.length; c++) { if (!CF.seen[c]) continue; const cx = c % CF.cols, cy = Math.floor(c / CF.cols); ctx.fillRect(mx + (1 + cx * CELL_T) * TILE * sx, my + (1 + cy * CELL_T) * TILE * sy, CELL_T * TILE * sx, CELL_T * TILE * sy); }
        CF.props.forEach(p => { if (!CF.seen[p.c]) return; ctx.fillStyle = p.k === 'stairs' ? '#ffd84a' : (p.k === 'portal' ? '#ff5a5a' : (p.k === 'gate' ? '#6dffe0' : (p.k === 'chest' ? '#ffb347' : ''))); if (ctx.fillStyle && (p.k === 'stairs' || p.k === 'portal' || p.k === 'chest' || p.k === 'gate')) ctx.fillRect(mx + p.x * sx - 2, my + p.y * sy - 2, 4, 4); });
    }
    function corrMakeRetreatBtn() {
        if (document.getElementById('btnRetreat')) return;
        const b = document.createElement('button'); b.id = 'btnRetreat'; b.type = 'button'; b.textContent = '🏳 あきらめる';
        b.style.cssText = 'position:fixed;left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom));z-index:7;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.4);background:rgba(20,15,40,.75);color:#fff;font-size:.8rem;cursor:pointer';
        b.addEventListener('click', () => { if (confirm('あきらめますか？\n持ち帰れるのは「脱出ゲート」から脱出したときだけです。このまま終わると、ここまでの報酬はすべて失われます。')) corrGiveUp(); });
        document.body.appendChild(b);
    }

    // 予告範囲の描画（円／扇／直線／ドーナツ）。黄色＋⚡はスタン攻撃、橙は持続中の攻撃
    function drawTele(t) {
        const f = t.live ? 1 : clamp(1 - t.t / t.max, 0, 1);
        const rgb = t.stun ? '255,216,74' : (t.live ? '255,130,40' : '255,60,60');
        const edge = t.stun ? 'rgba(255,236,130,0.95)' : 'rgba(255,90,90,0.85)';
        const sh = t.sh || 'circle';
        if (sh === 'portal') { drawPortal(t); return; }
        ctx.lineWidth = t.stun ? 3 : 2; ctx.strokeStyle = edge;
        ctx.fillStyle = 'rgba(' + rgb + ',' + (t.live ? 0.4 : 0.12 + f * 0.22) + ')';
        const inner = 'rgba(' + rgb + ',' + (t.stun ? 0.5 : 0.35) + ')';
        if (sh === 'cone') {
            ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, t.r, t.a - t.arc / 2, t.a + t.arc / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
            if (!t.live) { ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, t.r * f, t.a - t.arc / 2, t.a + t.arc / 2); ctx.closePath(); ctx.fill(); }
        } else if (sh === 'line') {
            ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a);
            ctx.beginPath(); ctx.rect(0, -t.w / 2, t.r, t.w); ctx.fill(); ctx.stroke();
            if (!t.live) { ctx.fillStyle = inner; ctx.fillRect(0, -t.w / 2, t.r * f, t.w); }
            ctx.restore();
        } else if (sh === 'donut') {
            ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.moveTo(t.x + t.ri, t.y); ctx.arc(t.x, t.y, t.ri, 0, 7, true); ctx.fill('evenodd');
            ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(t.x, t.y, t.ri, 0, 7); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill(); ctx.stroke();
            if (!t.live) { ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * f, 0, 7); ctx.fill(); }
        }
        if (t.stun) { ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; const cx = sh === 'cone' ? t.x + Math.cos(t.a) * t.r * 0.55 : (sh === 'line' ? t.x + Math.cos(t.a) * t.r * 0.5 : t.x), cy = sh === 'cone' ? t.y + Math.sin(t.a) * t.r * 0.55 : (sh === 'line' ? t.y + Math.sin(t.a) * t.r * 0.5 : t.y); ctx.fillText('⚡', cx, cy); ctx.textBaseline = 'alphabetic'; }
    }

    // 門：金色の魔法陣が回りながら開く。閉じる直前に点滅する
    function drawPortal(t) {
        const now = performance.now() / 1000, open = clamp((t.max - t.t) / 0.5, 0, 1), fade = clamp(t.t / 0.4, 0, 1), a = open * fade;
        const r = t.r * (0.6 + 0.4 * open);
        ctx.save(); ctx.translate(t.x, t.y); ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.5);
        g.addColorStop(0, 'rgba(255,250,210,0.95)'); g.addColorStop(0.45, 'rgba(255,210,100,0.55)'); g.addColorStop(1, 'rgba(255,170,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
        ctx.rotate(now * 1.6); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd36a';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(r * 0.72, 0); ctx.lineTo(r * 1.0, 0); ctx.stroke(); }
        ctx.restore();
    }
    // 剣：進行方向を向いた金色の刃
    function drawSword(b) {
        const ang = b.ang != null && b.vx == null ? b.ang : Math.atan2(b.vy, b.vx);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(255,220,120,0.28)'; ctx.beginPath(); ctx.ellipse(-6, 0, 26, 8, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff6d0'; ctx.strokeStyle = '#d8a83a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(4, -5); ctx.lineTo(-12, -4); ctx.lineTo(-12, 4); ctx.lineTo(4, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d8a83a'; ctx.fillRect(-16, -8, 4, 16);
        ctx.restore();
    }
    // ゲートキーパー本体：背後で回る金色の輪（「門」の存在感）
    function drawGateRing(e) {
        const now = performance.now() / 1000, R = e.r * 1.9;
        ctx.save(); ctx.translate(e.x, e.y);
        const g = ctx.createRadialGradient(0, 0, e.r * 0.6, 0, 0, R * 1.25);
        g.addColorStop(0, 'rgba(255,230,140,0.0)'); g.addColorStop(0.7, 'rgba(255,210,100,0.28)'); g.addColorStop(1, 'rgba(255,190,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.25, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,226,140,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
        ctx.rotate(now * 0.6); ctx.fillStyle = '#ffe9a0';
        for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.arc(R, 0, 5, 0, 7); ctx.fill(); }
        ctx.restore();
    }
    function drawEnemy(e) {
        if (e.pvp) return;   // 対人戦の相手は drawPlayer で描く
        const fl = e.flash > 0;
        if (e.boss && !e.echo && (e.gate != null ? e.gate : bdef(e).gate)) drawGateRing(e);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * 0.9, e.r * 0.4, 0, 0, 7); ctx.fill();
        ctx.save(); if (e.air > 0) ctx.translate(0, -e.air);   // 跳躍中は影を残して本体だけ浮く
        if (e.arch === 'charger' && e.state === 1 && e.aim != null) { ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.aim) * 340, e.y + Math.sin(e.aim) * 340); ctx.stroke(); }
        if (e.boss && e.state === 1 && e.aim != null) { ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.aim) * 600, e.y + Math.sin(e.aim) * 600); ctx.stroke(); }
        const pxE = !!(window.SBPix && SBPix.on() && !e.boss && SBPix.hasEnemy(e.arch));      // ドット絵で描く敵
        const pxB = !!(window.SBPix && SBPix.on() && SBPix.drawBoss && e.boss);      // ドット絵で描くボス
        ctx.fillStyle = fl ? '#fff' : (e.def.color || '#a44'); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); if (!pxE && !pxB) ctx.fill(); ctx.globalAlpha = 1;
        if (pxB) SBPix.drawBoss(ctx, e.x, e.y, e.r, e.def.name, e.def.icon, e.def.color, { flash: fl, left: me.x < e.x });
        if (pxE) SBPix.drawEnemy(ctx, e.x, e.y, e.r, e.arch, e.def.color || '#a44', { flash: fl, left: me.x < e.x, seed: (e.id | 0) * 1.7, now: performance.now() });
        if (e.boss) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3; ctx.stroke(); }
        if (e.inv) { ctx.strokeStyle = 'rgba(127,255,212,0.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 9, 0, 7); ctx.stroke(); }
        if (GMK === 'dimension' && e.boss && !e.echo && G.dp === 1 && G.dc > 0) {      // 6つの核（周回）
            const tn = performance.now() / 1000;
            for (let i = 0; i < G.dc; i++) { const a = tn * 0.9 + i * Math.PI * 2 / 6, cx = e.x + Math.cos(a) * (e.r + 58), cy = e.y + Math.sin(a) * (e.r + 58);
                ctx.fillStyle = '#ff7aff'; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 4, 0, 7); ctx.fill(); }
        }
        else if (e.elite) { ctx.strokeStyle = '#ff9a2a'; ctx.lineWidth = 4; ctx.stroke(); ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, 7); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.font = Math.round(e.r * 1.25) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
        if (!pxE && !pxB) ctx.fillText(e.def.icon, e.x, e.y + 1);
        if (e.st && (e.st.burnT > 0)) ctx.fillText('🔥', e.x + e.r * 0.6, e.y - e.r * 0.8);
        if (e.st && (e.st.poisonT > 0)) ctx.fillText('☠', e.x - e.r * 0.6, e.y - e.r * 0.8);
        if (e.st && (e.st.slowT > 0)) ctx.fillText('❄', e.x, e.y - e.r * 1.1);
        if (e.st && (e.st.stunT > 0)) ctx.fillText('💫', e.x, e.y - e.r * 1.2);
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
        if (SE && (e.boss || e.elite) && !e.pvp) {   // 弱点（×1.6）と耐性（×0.5）の属性
            const wk = SE.weakOf(e.def && e.def.name);
            ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
            ctx.fillText('弱' + SE.ELEMS[wk.weak].icon + ' 耐' + SE.ELEMS[wk.resist].icon, e.x, e.y - e.r - 14); ctx.textAlign = 'start';
        }
        if ((!e.boss && e.hp < e.maxHp) || e.elite) { const w = e.r * 2; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w, 4); ctx.fillStyle = '#e44'; ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w * Math.max(0, e.hp / e.maxHp), 4); }
    }

    // ---------- ドット絵のキャラ・武器 ----------
    let MY_AV = null; try { const pl = JSON.parse(localStorage.getItem('player') || 'null'); MY_AV = pl && pl.avatar ? pl.avatar : null; } catch (e) { MY_AV = null; }      // 自分のアバター設定（アバターカスタマイズの内容）
    function drawPlayerPixel(p, isMe, teamCol, rarC) {
        const now = performance.now(), a = p.ang || 0, ca = Math.cos(a), sa = Math.sin(a);
        const moved = Math.hypot(p.x - (p._px != null ? p._px : p.x), p.y - (p._py != null ? p._py : p.y)) > 0.35; p._px = p.x; p._py = p.y; if (moved) p._mvT = now;
        const moving = now - (p._mvT || 0) < 140;
        // 足もとのチームの輪（味方・敵の見分け）
        ctx.strokeStyle = teamCol; ctx.lineWidth = 2; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(p.x, p.y + 13, 15, 6, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = (p.dead ? 0.35 : (isMe && me.inv > 0 && Math.floor(me.inv * 20) % 2 ? 0.45 : 1));
        const wt = isMe ? weapon.type : (p.wt || 'sword'), rar = isMe ? weapon.rarity : p.rar;
        const swAt = isMe ? me.swingAt : p.swingAt, life = (isMe ? me.swingFin : p.swingFin) ? 320 : 220;
        const k = swAt ? (now - swAt) / life : -1, swinging = k >= 0 && k <= 1;
        const wo = { scale: 2, swing: swinging ? k : null, dir: (isMe ? me.swingDir : p.swingDir) || 1, fin: !!(isMe ? me.swingFin : p.swingFin), kind: swinging ? ((isMe ? me.swingKind : p.swingKind) || 'cone') : 'cone', glint: rar === 'legendary' || rar === 'mythic', alpha: p.dead ? 0.35 : null, now: now };
        const hx = p.x + ca * 7, hy = p.y + 3 + sa * 5, behind = sa < -0.35;
        if (!p.dead && behind) SBPix.drawWeapon(ctx, hx, hy, a, wt, rarC, wo);
        const av = isMe ? MY_AV : p.av;
        SBPix.drawPerson(ctx, p.x, p.y + 10, { avatar: av || null, cloth: teamCol, hair: SBPix.hairOf(p.name), moving: moving, left: ca < 0, alpha: p.dead ? 0.35 : null, flash: isMe && me.flash > 0 && Math.floor(me.flash * 30) % 2 === 0, now: now });
        if (!p.dead && !behind) SBPix.drawWeapon(ctx, hx, hy, a, wt, rarC, wo);
    }

    function drawPlayer(p, isMe) {
        const rarC = isMe ? HW.rarityOf(weapon).color : (HW.RARITIES[p.rar] || HW.RARITIES.normal).color;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 14, 6, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = p.dead ? 0.35 : (isMe && me.inv > 0 && Math.floor(me.inv * 20) % 2 ? 0.45 : 1);
        const teamCol = isMe ? '#4a9eff' : ((TEAM && run.pvpMode && !sameTeam(p.id)) ? '#ff6a6a' : '#4adb9a');
        if (window.SBPix && SBPix.on()) drawPlayerPixel(p, isMe, teamCol, rarC);
        else {
            ctx.fillStyle = teamCol; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 7); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = rarC; ctx.stroke();
        const a = p.ang || 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; const ttl = isMe ? ((window.SBAch && SBAch.titleText()) || '') : (p.ti || ''); if (ttl) { ctx.font = 'bold 10px sans-serif'; ctx.strokeText(ttl, p.x, p.y - 41); ctx.fillStyle = '#ffd86a'; ctx.fillText(ttl, p.x, p.y - 41); ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fff'; }
        ctx.strokeText(p.name, p.x, p.y - 28); ctx.fillStyle = '#fff'; ctx.fillText(p.name, p.x, p.y - 28);
        const hp = isMe ? me.hp / me.maxHp : (p.hp / Math.max(1, p.maxHp));
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - 18, p.y - 24, 36, 5); ctx.fillStyle = hp > 0.3 ? '#4adb6a' : '#ff5a5a'; ctx.fillRect(p.x - 18, p.y - 24, 36 * clamp(hp, 0, 1), 5);
        if (isMe && me.shield) { ctx.strokeStyle = '#9fe0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, 7); ctx.stroke(); }
        if (p.dead) { ctx.font = '16px sans-serif'; ctx.fillText('💀', p.x, p.y + 5); }
        const orb = isMe ? me.orb : p.orb;
        if (orb && !p.dead) {
            const base = performance.now() / 1000 * (orb.spin || 4.2);
            for (let i = 0; i < orb.n; i++) {
                const a = base + i * Math.PI * 2 / orb.n, ox = p.x + Math.cos(a) * orb.r, oy = p.y + Math.sin(a) * orb.r;
                ctx.fillStyle = 'rgba(157,240,255,0.35)'; ctx.beginPath(); ctx.arc(ox, oy, 17, 0, 7); ctx.fill();
                ctx.fillStyle = '#9df0ff'; ctx.beginPath(); ctx.arc(ox, oy, 9, 0, 7); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy, 4, 0, 7); ctx.fill();
            }
        }
        if (!p.dead && (isMe ? me.stunT > 0 : p.stun)) { ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💫', p.x + Math.cos(performance.now() / 120) * 8, p.y - 40); }
    }

    // ---------- ドット絵風のエフェクト（4px の粒だけで描く）----------
    const PXS = 4;
    function pxDot(x, y) { ctx.fillRect(Math.round(x / PXS) * PXS - PXS / 2, Math.round(y / PXS) * PXS - PXS / 2, PXS, PXS); }
    function drawPSlash(f, k) {      // 三日月型の斬撃。振り始めから振り終わりへ、弧が描かれていく
        const head = Math.min(1, k * 2.4), fade = Math.max(0, 1 - Math.max(0, k - 0.5) * 2), sa = f.a - f.dir * f.arc / 2;
        const cols = [shade(f.c, -0.5), f.c, shade(f.c, 0.5), '#ffffff'];
        const passes = f.fin ? [1, 0.7] : [1];
        passes.forEach((sc, pi) => {
            const R = f.rng * sc, n = Math.max(10, Math.round(f.arc * R / PXS / 1.3));
            for (let i = 0; i <= n; i++) {
                const u = i / n; if (u > head) break;
                const age = head - u; if (age > 0.6) continue;
                ctx.globalAlpha = fade * (pi ? 0.65 : 1) * (1 - Math.max(0, age - 0.2) / 0.5);
                const an = sa + f.dir * f.arc * u, cx = Math.cos(an), cy = Math.sin(an);
                const th = R * (f.fin ? 0.5 : 0.36) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.04)), 0.7), outer = R * (0.88 + 0.12 * Math.sin(Math.PI * u)), inner = outer - th;
                for (let r = inner; r <= outer; r += PXS) {
                    const band = (r - inner) / Math.max(1, th);
                    ctx.fillStyle = band > 0.82 ? cols[3] : (band > 0.55 ? cols[2] : (band > 0.2 ? cols[1] : cols[0]));
                    pxDot(f.x + cx * r, f.y + cy * r);
                }
            }
        });
        ctx.globalAlpha = 1;
    }
    function drawPThrust(f, k) {      // 突きの衝撃：先端が伸びていく細長い光
        const head = Math.min(1, k * 3.2), fade = Math.max(0, 1 - Math.max(0, k - 0.45) * 1.9), cx = Math.cos(f.a), cy = Math.sin(f.a), px = -cy, py = cx;
        const cols = [shade(f.c, -0.4), f.c, shade(f.c, 0.55), '#ffffff'];
        for (let sd = 0; sd <= f.rng * head; sd += PXS) {
            const u = sd / f.rng, hw = Math.max(1, Math.round((f.w * 0.32) * (1 - 0.7 * u) / PXS));
            ctx.globalAlpha = fade * (1 - Math.max(0, head - u - 0.25) * 1.2);
            for (let o = -hw; o <= hw; o++) {
                const q = Math.abs(o) / Math.max(1, hw);
                ctx.fillStyle = q > 0.75 ? cols[0] : (q > 0.4 ? cols[1] : (q > 0.1 ? cols[2] : cols[3]));
                pxDot(f.x + cx * sd + px * o * PXS, f.y + cy * sd + py * o * PXS);
            }
        }
        ctx.globalAlpha = 1;
    }
    function drawPRing(f, k) {      // 衝撃波：粒で描いた輪が広がる
        const r = f.max * Math.min(1, k * 1.4), n = Math.max(12, Math.round(Math.PI * 2 * r / PXS / 1.2)), fade = Math.max(0, 1 - k);
        ctx.globalAlpha = fade * (f.fill ? 0.28 : 0); if (f.fill) { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill(); }
        ctx.globalAlpha = fade;
        for (let i = 0; i < n; i++) {
            const an = i / n * Math.PI * 2; ctx.fillStyle = (i % 3 === 0) ? '#ffffff' : f.c;
            pxDot(f.x + Math.cos(an) * r, f.y + Math.sin(an) * r); if (r > 16) { ctx.fillStyle = shade(f.c, -0.4); pxDot(f.x + Math.cos(an) * (r - PXS), f.y + Math.sin(an) * (r - PXS)); }
        }
        ctx.globalAlpha = 1;
    }

    // スキルなどの効果を、ドット絵の見た目で描く（描いたら true）
    function drawFxPixel(f, k) {
        const q = PXS;
        if (f.k === 'arc') { drawPSlash({ x: f.x, y: f.y, a: f.a, rng: f.rng, arc: f.arc, dir: 1, fin: false, c: f.c }, Math.min(1, k * 1.15)); return true; }
        if (f.k === 'line') { const L = Math.hypot(f.x2 - f.x, f.y2 - f.y); drawPThrust({ x: f.x, y: f.y, a: Math.atan2(f.y2 - f.y, f.x2 - f.x), rng: L, w: Math.max(16, (f.w || 4) * 2), fin: false, c: f.c }, k); return true; }
        if (f.k === 'ring') { drawPRing(f, k); return true; }
        if (f.k === 'puff') { ctx.fillStyle = f.c; for (let i = 0; i < 6; i++) { const an = i * 1.047 + f.x * 0.01, rr = 6 + k * 22, z = Math.max(4, Math.round(10 * (1 - k * 0.7) / 2) * 2); ctx.fillRect(Math.round((f.x + Math.cos(an) * rr) / 2) * 2 - z / 2, Math.round((f.y + Math.sin(an) * rr) / 2) * 2 - z / 2, z, z); } return true; }
        if (f.k === 'bolt') {
            const w = Math.max(4, Math.round(f.w * (1.2 - k * 0.7) / 2) * 2);
            for (let pass = 0; pass < 2; pass++) {
                ctx.fillStyle = pass ? '#ffffff' : f.c; const z = pass ? Math.max(2, Math.round(w * 0.4 / 2) * 2) : w;
                for (let i = 1; i < f.pts.length; i++) { const a = f.pts[i - 1], b = f.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / q)); for (let j = 0; j <= n; j++) ctx.fillRect(Math.round((a[0] + (b[0] - a[0]) * j / n) / 2) * 2 - z / 2, Math.round((a[1] + (b[1] - a[1]) * j / n) / 2) * 2 - z / 2, z, z); }
            }
            ctx.globalAlpha = 1; return true;
        }
        if (f.k === 'spark') { ctx.fillStyle = f.c; const z = Math.max(2, Math.round(f.sz * (1 - k * 0.7) * 1.6 / 2) * 2); ctx.fillRect(Math.round(f.x / 2) * 2 - z / 2, Math.round(f.y / 2) * 2 - z / 2, z, z); return true; }
        if (f.k === 'warn') { ctx.fillStyle = f.c; const n = Math.max(8, Math.floor(Math.PI * 2 * f.r / 10)); for (let i = 0; i < n; i += 2) { const an = i / n * Math.PI * 2; ctx.fillRect(Math.round((f.x + Math.cos(an) * f.r) / 2) * 2 - 2, Math.round((f.y + Math.sin(an) * f.r) / 2) * 2 - 2, 4, 4); } return true; }
        return false;
    }
    function drawFx(f) {
        const k = 1 - f.t / f.life;
        ctx.globalAlpha = Math.max(0, 1 - k);
        if (window.SBPix && SBPix.on() && drawFxPixel(f, k)) { ctx.globalAlpha = 1; return; }
        if (f.k === 'arc') { ctx.fillStyle = f.c; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.rng, f.a - f.arc / 2, f.a + f.arc / 2); ctx.closePath(); ctx.globalAlpha *= 0.45; ctx.fill(); }
        else if (f.k === 'line') { ctx.strokeStyle = f.c; ctx.lineWidth = f.w || 4; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); }
        else if (f.k === 'ring') { const r = f.max * Math.min(1, k * 1.4); ctx.strokeStyle = f.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); if (f.fill) { ctx.globalAlpha *= 0.3; ctx.fillStyle = f.c; ctx.fill(); ctx.globalAlpha = Math.max(0, 1 - k); } ctx.stroke(); }
        else if (f.k === 'pslash') drawPSlash(f, k);
        else if (f.k === 'pthrust') drawPThrust(f, k);
        else if (f.k === 'pring') drawPRing(f, k);
        else if (f.k === 'pspark') { ctx.fillStyle = f.c; const z = f.sz * (1 - k * 0.5); ctx.fillRect(Math.round(f.x / 4) * 4 - z / 2, Math.round(f.y / 4) * 4 - z / 2, z, z); }
        else if (f.k === 'puff') { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, 8 + k * 22, 0, 7); ctx.globalAlpha *= 0.4; ctx.fill(); }
        else if (f.k === 'bolt') { ctx.strokeStyle = f.c; ctx.lineWidth = f.w * (1.2 - k * 0.7); ctx.beginPath(); f.pts.forEach((q, i) => { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, f.w * 0.35); ctx.stroke(); ctx.globalAlpha = 1; }
        else if (f.k === 'spark') { ctx.fillStyle = f.c; const z = f.sz * (1 - k * 0.7); ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0.5, z), 0, 7); ctx.fill(); }
        else if (f.k === 'warn') { ctx.strokeStyle = f.c; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
        ctx.globalAlpha = 1;
    }

    // ---------- HUD ----------
    const el = id => document.getElementById(id);
    function drawHUD() {
        // 溜め・バリアの表示（自分の頭上のゲージ／足もとの輪）と、仲間のバリア
        {
            const msx = VW / 2 + (me.x - cam.x), msy = VH / 2 + (me.y - cam.y), tt = performance.now() / 1000;
            const gauge = (frac, col, label) => {
                const w = 64, x0 = msx - w / 2, y0 = msy - 58;
                ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, 9); ctx.fillStyle = col; ctx.fillRect(x0, y0, w * Math.max(0, Math.min(1, frac)), 5);
                ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(label, msx, y0 - 5); ctx.fillStyle = '#fff'; ctx.fillText(label, msx, y0 - 5);
            };
            const ring = (r, col, alpha, lw) => { ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(msx, msy, r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; };
            if (!PVP && !me.dead) {      // 必殺ゲージ（足もとの小さなバー）
                const uf = (me.ult || 0) / ULT_MAX, w = 48, x0 = msx - w / 2, y0 = msy + 26, full = uf >= 1;
                ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, 8);
                ctx.fillStyle = full ? (Math.floor(tt * 6) % 2 ? '#fff2a8' : '#ffd84a') : '#c9a227'; ctx.fillRect(x0, y0, w * uf, 4);
                if (full) { ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText('R 必殺技！', msx, y0 + 18); ctx.fillStyle = '#ffd84a'; ctx.fillText('R 必殺技！', msx, y0 + 18); }
                const bu = document.getElementById('btnUlt'); if (bu) { const txt = full ? '⚡必殺' : '⚡' + Math.floor(uf * 100) + '%'; if (bu.textContent !== txt) bu.textContent = txt; bu.style.opacity = full ? '1' : '0.55'; }
            }
            if (ultFlashT > 0) { ctx.globalAlpha = Math.min(0.5, ultFlashT * 1.6); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
            if (me.cast && !me.dead) {
                const f = 1 - me.cast.t / me.cast.max;
                ring(60 - 40 * f, '#ffe08a', 0.35 + 0.5 * f, 3); ring(20 + 14 * Math.sin(tt * 18), '#fff2b8', 0.5, 2);
                gauge(f, '#ffe08a', '溜め ' + (CHARGE_NAME[me.cast.form] || ''));
            }
            if (me.gch > 0 && !me.dead) {
                const f = me.gch / GUARD_CHARGE;
                ring(70 - 45 * f, '#8fe8ff', 0.3 + 0.5 * f, 3);
                gauge(f, '#8fe8ff', '🛡 バリアを溜めている… ' + Math.max(0, GUARD_CHARGE - me.gch).toFixed(1));
            }
            if (me.guardT > 0 && !me.dead) {
                const f = me.guardT / GUARD_SEC;
                ctx.fillStyle = 'rgba(143,232,255,0.16)'; ctx.beginPath(); ctx.arc(msx, msy, 38, 0, Math.PI * 2); ctx.fill();
                ring(38 + 2 * Math.sin(tt * 10), '#8fe8ff', 0.85, 3);
                ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(msx, msy, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke(); ctx.globalAlpha = 1;
            }
            Object.keys(allies).forEach(id => {
                const a = allies[id]; if (!a.g || a.dead) return;
                const ax = VW / 2 + (a.x - cam.x), ay = VH / 2 + (a.y - cam.y);
                ctx.fillStyle = 'rgba(143,232,255,0.14)'; ctx.beginPath(); ctx.arc(ax, ay, 36, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 0.8; ctx.strokeStyle = '#8fe8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax, ay, 36 + 2 * Math.sin(tt * 10), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
            });
        }
        // 通信の状態（Ping と接続方式）：マルチのカクつきの原因を見分けるため、右上に小さく出す
        if (socket && room) {
            const nowP = performance.now();
            if (!netPingBusy && nowP - netPingT > 3000 && socket.connected) {
                netPingBusy = true; netPingT = nowP; const t0 = nowP;
                try { socket.timeout(4000).emit('stage:ping', t0, (err) => { netPingBusy = false; netPing = err ? -1 : Math.round(performance.now() - t0); }); } catch (e) { netPingBusy = false; }
            }
            let tr = ''; try { tr = socket.io && socket.io.engine && socket.io.engine.transport ? (socket.io.engine.transport.name === 'websocket' ? 'WS' : 'poll') : ''; } catch (e) { tr = ''; }
            ctx.font = '10px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = netPing < 0 ? '#ff8a8a' : (netPing < 80 ? '#8affb0' : (netPing < 160 ? '#ffe08a' : '#ff8a8a'));
            ctx.fillText((netPing < 0 ? 'Ping --' : 'Ping ' + netPing + 'ms') + (tr ? ' ' + tr : ''), VW - 10, VH < 520 ? 28 : 48);
        }
        // ミニマップ
        const mw = VH < 520 ? 92 : 140, mh = Math.round(mw * WORLD_H / WORLD_W), mx = VW - mw - 10, my = VH < 520 ? 34 : 56;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(mx, my, mw, mh);
        const sx = mw / WORLD_W, sy = mh / WORLD_H;
        if (CORR_ON) corrDrawMini(mx, my, sx, sy);
        enemies.forEach(e => { if (e.pvp) return; ctx.fillStyle = e.boss ? '#ffd84a' : '#ff6a5a'; ctx.fillRect(mx + e.x * sx - 1, my + e.y * sy - 1, e.boss ? 5 : 2, e.boss ? 5 : 2); });
        Object.keys(allies).forEach(id => { ctx.fillStyle = (TEAM && run.pvpMode && !sameTeam(id)) ? '#ff6a6a' : '#4adb9a'; ctx.fillRect(mx + allies[id].x * sx - 2, my + allies[id].y * sy - 2, 4, 4); });
        ctx.fillStyle = '#4a9eff'; ctx.fillRect(mx + me.x * sx - 2, my + me.y * sy - 2, 4, 4);
        // タッチスティック
        [input.stick, input.aimStick].forEach(st => { if (st.id === null) return; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(st.ox, st.oy, 56, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(st.ox + st.x * 56, st.oy + st.y * 56, 24, 0, 7); ctx.fill(); });
        // スタン表示（動けない時間と、復帰後のスタン耐性）
        if (me.stunT > 0 && !me.dead) {
            ctx.fillStyle = 'rgba(255,225,80,0.12)'; ctx.fillRect(0, 0, VW, VH);
            const big = VH < 520 ? 24 : 34, txt = '💫 スタン中… ' + me.stunT.toFixed(1) + '秒';
            ctx.textAlign = 'center'; ctx.font = 'bold ' + big + 'px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.strokeText(txt, VW / 2, VH * 0.3); ctx.fillStyle = '#ffe14a'; ctx.fillText(txt, VW / 2, VH * 0.3);
            ctx.font = 'bold ' + Math.round(big * 0.45) + 'px sans-serif'; ctx.lineWidth = 3;
            ctx.strokeText('動けない・攻撃も回避もできない（クイズは解けます）', VW / 2, VH * 0.3 + big * 0.9); ctx.fillStyle = '#fff'; ctx.fillText('動けない・攻撃も回避もできない（クイズは解けます）', VW / 2, VH * 0.3 + big * 0.9);
        } else if (me.stunImm > 0 && !me.dead) {
            ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            const t2 = '⚡ スタン耐性 ' + me.stunImm.toFixed(1); ctx.strokeText(t2, VW / 2, VH - 150); ctx.fillStyle = '#ffe14a'; ctx.fillText(t2, VW / 2, VH - 150);
        }
        // 対人戦：サドンデスの表示（時間とともに攻撃力が上がり、防御・回復が下がる）と、自分の総合ダメージ量
        if (PVP && run.pvpMode && run.phase === 'run') {
            const prog = sdProg(), am = sdAtkMul(), left = Math.max(0, TIME_LIMIT - run.time);
            const t1 = run.time < SD.start ? ('サドンデスまで ' + Math.ceil(SD.start - run.time) + '秒') : ('⚠ サドンデス　攻撃 ×' + am.toFixed(1) + ' / 防御 -' + Math.round(prog * 100) + '% / 回復 -' + Math.round((1 - Math.max(SD.healMin, 1 - prog)) * 100) + '%');
            const t2 = '与ダメージ合計 ' + Math.round(dmgOf(myId)) + '%　　残り ' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
            ctx.save(); ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.font = 'bold 15px sans-serif';
            ctx.strokeText(t1, VW / 2, 92); ctx.fillStyle = run.time < SD.start ? '#cfe6ff' : (prog > 0.6 ? '#ff6a6a' : '#ffb347'); ctx.fillText(t1, VW / 2, 92);
            ctx.font = 'bold 13px sans-serif'; ctx.strokeText(t2, VW / 2, 112); ctx.fillStyle = '#fff'; ctx.fillText(t2, VW / 2, 112);
            ctx.restore();
        }
        // ボスラッシュ：幕間の表示／無限回廊：階の切り替わりの暗転
        if (RUSH_ON && run.phase === 'run' && RS.st === 2) {
            ctx.save(); ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            const t1 = '🏆 ' + rushPd(RS.ph).label + ' クリア！', t2 = RS.ph < RUSHD.phases.length ? ('次：' + rushPd(RS.ph + 1).label + (rushPd(RS.ph + 1).final ? '（強化ディメンション・キーパー）' : '（第' + rushPd(RS.ph + 1).world + '世界のボス）') + '　' + Math.max(0, Math.ceil(RS.inter)) + '秒') : '';
            ctx.font = 'bold 30px sans-serif'; ctx.strokeText(t1, VW / 2, VH * 0.3); ctx.fillStyle = '#ffe08a'; ctx.fillText(t1, VW / 2, VH * 0.3);
            ctx.font = 'bold 16px sans-serif'; ctx.strokeText(t2, VW / 2, VH * 0.3 + 30); ctx.fillStyle = '#fff'; ctx.fillText(t2, VW / 2, VH * 0.3 + 30); ctx.restore();
        }
        if (CORR_ON && CF.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, CF.fade * 1.6) + ')'; ctx.fillRect(0, 0, VW, VH); }
        // 復活ゲージ
        if (me.dead) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('倒れています…仲間の復活を待っています', VW / 2, VH / 2); }
        // 上部情報
        const hpR = clamp(me.hp / me.maxHp, 0, 1);
        el('hpFill').style.width = (hpR * 100) + '%'; el('hpText').textContent = Math.ceil(me.hp) + ' / ' + me.maxHp;
        const mm = Math.floor(run.time / 60), ss = String(Math.floor(run.time % 60)).padStart(2, '0');
        el('timer').textContent = '⏱ ' + mm + ':' + ss;
        if (RUSH_ON && RS.st === 1) { const rl = Math.max(0, RS.limit - RS.t); el('timer').textContent = '⏱ ' + Math.floor(rl / 60) + ':' + String(Math.floor(rl % 60)).padStart(2, '0'); }
        if (CORR_ON && !run.bossSpawned) {
            let seen = 0; if (CF.seen) for (let i = 0; i < CF.seen.length; i++) seen += CF.seen[i];
            const gt = CF.props.find(q => q.k === 'gate'), gOk = gt && CF.seen && CF.seen[gt.c]; el('prog').textContent = '🌀 地下' + CF.floor + '階　探索 ' + seen + '/' + (CF.cols * CF.rows) + '　脱出ゲート：' + (gOk ? '発見！' : '未発見'); el('progFill').style.width = (CF.seen ? seen / (CF.cols * CF.rows) * 100 : 0) + '%'; el('bossBar').style.display = 'none';
        } else if (!run.bossSpawned) { el('prog').textContent = '討伐 ' + Math.min(run.kills, run.need) + ' / ' + run.need; el('progFill').style.width = (Math.min(1, run.kills / run.need) * 100) + '%'; el('bossBar').style.display = 'none'; }
        else {
            el('prog').textContent = 'ボス戦'; el('progFill').style.width = '100%';
            if (RUSH_ON) { const bs0 = enemies.filter(x => x.boss && !x.echo); let hp0 = 0, mh0 = 0; bs0.forEach(x => { hp0 += Math.max(0, x.hp); mh0 += x.maxHp; }); el('prog').textContent = '🏆 ' + rushPd(Math.max(1, RS.ph)).label + '　' + DIFF.name; el('progFill').style.width = (mh0 ? hp0 / mh0 * 100 : 0) + '%'; }
            else if (CORR_ON) el('prog').textContent = '👹 ボス部屋　地下' + CF.floor + '階';
            const bs = enemies.filter(e => e.boss), b = bs.find(x => !x.echo) || bs[0];
            if (b) {
                el('bossBar').style.display = 'block'; el('bossName').textContent = (b.def.name || stage.boss.name) + (SE ? '　弱点' + SE.ELEMS[SE.weakOf(b.def.name).weak].icon + ' 耐性' + SE.ELEMS[SE.weakOf(b.def.name).resist].icon : ''); el('bossFill').style.width = (clamp(b.hp / b.maxHp, 0, 1) * 100) + '%';
                const ex = bs.filter(x => x !== b).map(x => '<div style="font-size:.7rem;margin-top:3px;text-shadow:0 0 4px #000">' + (x.echo ? '🚪 ' : '') + x.def.name + '<div style="height:5px;background:rgba(0,0,0,.6);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + Math.round(clamp(x.hp / x.maxHp, 0, 1) * 100) + '%;background:' + (x.echo ? '#7fffd4' : '#ff5a8a') + '"></div></div></div>').join('');
                let bx = document.getElementById('bossExtra'); if (!bx) { bx = document.createElement('div'); bx.id = 'bossExtra'; el('bossBar').appendChild(bx); }
                if (bx.dataset.sig !== ex) { bx.dataset.sig = ex; bx.innerHTML = ex; }
            } else el('bossBar').style.display = 'none';
            const gt = gmHudText(); let gh = document.getElementById('gmHud');
            if (!gh) { gh = document.createElement('div'); gh.id = 'gmHud'; gh.style.cssText = 'position:fixed;top:calc(max(8px,env(safe-area-inset-top)) + 52px);left:50%;transform:translateX(-50%);z-index:6;pointer-events:none;font-weight:bold;font-size:.82rem;color:#fff;background:rgba(20,10,30,.72);border:1px solid #c090ff;border-radius:8px;padding:4px 10px;text-shadow:0 0 4px #000;white-space:nowrap;display:none'; document.body.appendChild(gh); }
            gh.style.display = gt ? 'block' : 'none'; if (gt && gh.textContent !== gt) gh.textContent = gt;
        }
    }
    function updateEnergyUI() { el('enFill').style.width = (me.energy / ENERGY_MAX * 100) + '%'; el('enText').textContent = 'ENERGY ' + Math.round(me.energy) + ' / ' + ENERGY_MAX; if (skillSlots.length) updateSkillBar(); }
    let annTimer = 0;
    function announce(text, ms) { const a = el('announce'); a.textContent = text; a.classList.add('show'); clearTimeout(annTimer); annTimer = setTimeout(() => a.classList.remove('show'), ms || 2000); }
    function refreshLootLog() {
        const box = el('lootLog');
        box.innerHTML = run.stats.loot.slice(-5).map(w => '<div style="color:' + HW.rarityOf(w).color + '">' + (w.kind === 'armor' ? '🛡 ' : '✦ ') + escapeHtml(w.name) + '</div>').join('');
    }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // ---------- 待機室 ----------
    function showWaitMsg(t) { const m = el('waitMsg'); if (m) m.textContent = t; }
    function renderWait() {
        const w = el('waitRoom'); w.style.display = 'flex';
        el('waitTitle').textContent = stage.icon + ' ' + stage.name + ' [' + DIFF.name + ']';
        el('waitCode').textContent = room ? ('ルームID: ' + room.id) : '';
        el('waitMembers').innerHTML = room ? room.members.map((m, i) => '<div class="mem">' + (TEAM ? (i % 2 === 0 ? '🔵 ' : '🔴 ') : '') + (m.id === room.hostId ? '👑 ' : '') + escapeHtml(m.name) + '<small> ' + escapeHtml(m.wname || '') + '</small></div>').join('') : '';
        const startBtn = el('waitStart');
        startBtn.style.display = isHost ? 'inline-block' : 'none';
        showWaitMsg(isHost ? (TEAM ? ('チーム戦 ' + TEAM + 'v' + TEAM + '：参加した順に 青・赤・青・赤… と振り分けられます。人数が足りなくても出発できます。1人で「出発」するとボット練習になります（途中参加はできません）') : PVP ? '2〜4人の乱戦です。1人で「出発」するとボット練習になります（途中参加はできません）' : '準備ができたら「出発」を押してください（途中参加はできません）') : 'ホストの出発を待っています…');
    }

    // ---------- 結果 ----------
    function showResult(win, d) {
        const o = el('result'); o.style.display = 'flex';
        const loot = run.stats.loot.slice().sort((a, b) => HW.RARITY_ORDER.indexOf(b.rarity) - HW.RARITY_ORDER.indexOf(a.rarity));
        el('resTitle').textContent = (PVP && run.pvpMode) ? (win ? '🏆 勝利！最後の1人' : (d.reason === 'time' ? '⌛ 時間切れ…（総合ダメージ量で判定）' : '💀 敗北…')) : (win ? '🏆 ステージクリア！' : (d.reason === 'time' ? '⌛ 時間切れ…' : '💀 全滅…'));
        if (TEAM && run.pvpMode) el('resTitle').textContent = win ? '🏆 勝利！相手チームを倒した' : (d.winnerTeam === -1 ? '🤝 引き分け' : (d.reason === 'time' ? '⌛ 時間切れ…（チームの総合ダメージ量で判定）' : '💀 敗北…相手チームに倒された'));
        if (run.evGain) el('resTitle').textContent += '　⚔PvPイベント +' + run.evGain + 'EP';
        if (RUSH_ON) { const rr = run.rushReached | 0; el('resTitle').textContent = win ? '🏆 ボスラッシュ制覇！（' + DIFF.name + '）' : ((d.reason === 'time' ? '⌛ 時間切れ…' : '💀 敗北…') + '　' + (rr > 0 ? rushPd(rr).label + 'までクリア' : 'フェーズ1で敗退') + '（' + DIFF.name + '）'); }
        if (CORR_ON) el('resTitle').textContent = run.escaped ? ('🌀 脱出成功！　地下' + CF.floor + '階（報酬を持ち帰った）') : ((d.reason === 'giveup' ? '🏳 あきらめた' : '💀 力尽きた') + '…　地下' + CF.floor + '階（報酬はすべて失われた）');
        el('resTitle').style.color = win ? '#ffe08a' : '#ff8a8a';
        el('resBody').innerHTML =
            (run.formUnlock ? '<div style="margin:0 0 10px;padding:10px;border:2px solid #c8a0ff;border-radius:10px;background:rgba(90,50,160,.3);color:#f0e0ff;font-weight:bold;text-align:center">🔓 ' + run.formUnlock + '</div>' : '') +
            (run.worldBanner ? '<div style="margin:0 0 10px;padding:10px;border:2px solid #ffc84a;border-radius:10px;background:rgba(120,80,220,.28);color:#fff0c8;font-weight:bold;text-align:center">' + run.worldBanner.t + '<br><span style="font-size:.85em;font-weight:normal">' + run.worldBanner.s + '</span></div>' : '') +
            (CORR_ON && !run.escaped ? '<div style="margin:0 0 10px;padding:10px;border:2px solid #ff8a8a;border-radius:10px;background:rgba(120,30,40,.35);color:#ffd0d0;font-weight:bold;text-align:center">持ち帰れなかったもの（下の一覧）<br><span style="font-size:.85em;font-weight:normal">各階層の「脱出ゲート」から脱出しないと、報酬は持ち帰れません。コイン ' + ((run.lost && run.lost.coins) | 0) + ' も失われました</span></div>' : '') +
            (CORR_ON && run.escaped && d.ghost ? '<div style="margin:0 0 10px;padding:8px;border:2px solid #9fe8ff;border-radius:10px;color:#d8f4ff;text-align:center">仲間はまだ冒険中です。ここで町に戻ると、仲間の冒険も終わります（ホストのため）</div>' : '') +
            '<div>討伐数：' + run.stats.kills + '　与ダメージ：' + Math.round(run.stats.dmg) + '</div>' +
            '<div>コイン +' + (CORR_ON && !run.escaped ? 0 : run.stats.coins) + '　オーブ +' + (CORR_ON && !run.escaped ? 0 : run.stats.orbs) + '</div>' +
            (CORR_ON ? '<div>宝箱 ' + CF.st.chests + '個　ミミック ' + CF.st.mimics + '体　ボス討伐 ' + CF.st.bosses + '体</div>' : '') +
            (run.stats.items ? '<div style="margin:6px 0;color:#ffd9a0">特殊アイテム：' + Object.keys(run.stats.items).map(k => (HW.SPECIAL_ITEMS[k] ? HW.SPECIAL_ITEMS[k].icon + HW.SPECIAL_ITEMS[k].name : k) + '×' + run.stats.items[k]).join('　') + '</div>' : '') +
            '<h4>' + (CORR_ON && !run.escaped ? '失った' : '獲得した') + '素材（' + Object.keys(run.stats.mats).reduce((n, k) => n + run.stats.mats[k], 0) + '）</h4>' +
            (Object.keys(run.stats.mats).length ? '<div style="font-size:.85rem;color:#c8f7a0">' + Object.keys(run.stats.mats).map(id => escapeHtml(matName(id)) + '×' + run.stats.mats[id]).join('　') + '</div>' : '<div style="opacity:.7">なし</div>') +
            (run.stats.accs && run.stats.accs.length ? '<h4>' + (CORR_ON && !run.escaped ? '失った' : '獲得した') + 'アクセサリー（' + run.stats.accs.length + '）</h4>' + run.stats.accs.map(a => '<div style="color:' + HW.rarityOf(a).color + '">✨ ' + esc(a.name) + '</div>').join('') : '') +
            '<h4>' + (CORR_ON && !run.escaped ? '失った' : '獲得した') + '武器（' + loot.length + '）</h4>' +
            (loot.length ? loot.map(w => '<div class="lw" style="color:' + HW.rarityOf(w).color + '">' + escapeHtml(w.name) + ' <small>[' + HW.rarityOf(w).label + ' / 攻撃' + HW.pctLabel(w) + ' / 穴' + w.sockets + ']</small></div>').join('') : '<div style="opacity:.7">なし</div>');
    }

    // ---------- クイズ（正解でエネルギー）----------
    let quizOn = true, quizPool = null, curQ = null, quizLock = false, streak = 0;
    function grade() { const g = clamp(parseInt(pdata.grade, 10) || 1, 1, 12); return g <= 6 ? { l: 'elementary', g: g } : (g <= 9 ? { l: 'junior_high', g: g - 6 } : { l: 'high_school', g: g - 9 }); }
    function buildPool() {
        const pool = {}; if (typeof QUESTIONS_DATA === 'undefined') return pool;
        const gi = grade(), lv = QUESTIONS_DATA[gi.l], gd = lv && lv[String(gi.g)]; if (!gd) return pool;
        ['math', 'jp', 'eng'].forEach(s => { if (gd[s] && gd[s].length) pool[s] = gd[s]; });
        return pool;
    }
    const shuf = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; };
    function opts(q, qs) {
        if (q.options && q.options.length === 4) return shuf(q.options.map(String));
        const ans = String(q.answer), out = [ans], set = new Set(out);
        if (ans.trim() !== '' && !isNaN(ans)) { const n = parseFloat(ans), isInt = Number.isInteger(n); for (const c of shuf([1, -1, 2, -2, 10, -10, 3, -3, 5, 4])) { if (out.length >= 4) break; const v = isInt ? String(n + c) : String(Math.round((n + c * 0.1) * 100) / 100); if (!set.has(v)) { set.add(v); out.push(v); } } }
        else { for (const o of shuf(qs.map(x => String(x.answer)))) { if (out.length >= 4) break; if (!set.has(o)) { set.add(o); out.push(o); } } }
        let k = 1; while (out.length < 4) out.push(ans + '・' + k++);
        return shuf(out);
    }
    function nextQuiz() {
        if (!quizPool) quizPool = buildPool();
        const subs = Object.keys(quizPool);
        if (!subs.length) curQ = { q: '3 + 4 = ?', a: '7', o: ['7', '6', '8', '12'] };
        else { const s = subs[Math.floor(Math.random() * subs.length)], qs = quizPool[s], q = qs[Math.floor(Math.random() * qs.length)]; curQ = { q: q.question, a: String(q.answer), o: opts(q, qs) }; }
        quizLock = false;
        el('quizQ').textContent = curQ.q;
        const box = el('quizC'); box.innerHTML = '';
        curQ.o.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + '. ' + o; b.dataset.v = o; b.addEventListener('click', () => answer(o, b)); box.appendChild(b); });
    }
    function answer(o, b) {
        if (quizLock || !curQ || run.phase === 'end') return; quizLock = true;
        if (o === curQ.a) { streak++; b.classList.add('ok'); addEnergy((25 + (streak >= 3 ? 10 : 0)) * P.energyMul); popups.push({ x: me.x, y: me.y - 40, t: 0.8, text: '+ENERGY', c: '#7fe3ff' }); setTimeout(nextQuiz, 300); }
        else { streak = 0; b.classList.add('ng'); Array.from(el('quizC').children).forEach(x => { if (x.dataset.v === curQ.a) x.classList.add('ok'); }); setTimeout(nextQuiz, 1300); }
    }
    function quizPick(i) { const b = el('quizC').children[i]; if (b) b.click(); }
    function toggleQuiz() { quizOn = !quizOn; el('quiz').style.display = quizOn ? 'block' : 'none'; }

    // ---------- ループ ----------
    let last = performance.now(), skillT = 0;
    function loop(now) {
        let dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (hitStopT > 0) { hitStopT -= dt; dt *= 0.06; }      // ヒットストップ：当たった一瞬だけ、ほぼ止める
        if (window.SBOrientation && SBOrientation.blocking() && partyCount() === 1) { render(); requestAnimationFrame(loop); return; }
        if (run.phase === 'run') {
            run.time += dt;
            skillSlots.forEach(sk => { if (sk && sk.cdLeft > 0) sk.cdLeft = Math.max(0, sk.cdLeft - dt); });
            if ((skillT -= dt) <= 0) { skillT = 0.1; updateSkillBar(); }
            updateMe(dt); updateShots(dt); gmLocal(dt); updateDomains(dt); updateMinions(dt); corrUpdate(dt);
            if (DBG) { if (DBG.god) { me.invHard = 99; if (me.dead) { me.dead = false; me.hp = me.maxHp; } } if (DBG.energy !== false) me.energy = ENERGY_MAX; }   // デバッグ：無敵・エネルギー無限
            if (PVP && run.pvpMode) { syncPvpDummies(); if (isHost) pvpHostCheck(); }
            else if (isHost) { updateHost(dt); } else lerpRemote(dt);
            // 位置の送信
            posT -= dt; if (posT <= 0) {
                posT = 1 / 20;
                // 速度を一緒に送る（受け取った側が、次の位置が届くまでの間を先読みして動かせる）。一瞬で大きく動いたとき（一閃・階層移動など）は tp=1 で「補間せず、そこへ移動」と伝える
                const nowMs = performance.now(), el0 = Math.max(0.016, (nowMs - posLast.t) / 1000), dx0 = me.x - posLast.x, dy0 = me.y - posLast.y, jump = Math.hypot(dx0, dy0) > 300;
                const vx0 = jump ? 0 : clamp(dx0 / el0, -900, 900), vy0 = jump ? 0 : clamp(dy0 / el0, -900, 900);
                posLast.x = me.x; posLast.y = me.y; posLast.t = nowMs; posSeq++;
                netSend('pos', { g: me.guardT > 0 ? 1 : 0, ti: (posSeq % 20 === 0) ? ((window.SBAch && SBAch.titleText()) || '') : undefined, wt: (posSeq % 20 === 0) ? weapon.type : undefined, av: (posSeq % 20 === 0 && MY_AV && window.SBPix && SBPix.avatarString) ? SBPix.avatarString(MY_AV) : undefined, x: Math.round(me.x), y: Math.round(me.y), vx: Math.round(vx0), vy: Math.round(vy0), tp: jump ? 1 : 0, q: posSeq, a: +me.ang.toFixed(2), hp: Math.round(me.hp), mh: me.maxHp, dead: me.dead, st: me.stunT > 0 ? 1 : 0, tt: CORR_ON ? Math.round(corrTotal()) : 0 });
            }
            snapT -= dt; if (isHost && room && !(PVP && run.pvpMode) && snapT <= 0) { const sn = makeSnap(); snapT = 1 / (snapBytes > 11000 ? 10 : SNAP_HZ); netSend('snap', sn); }      // 大きいスナップショットのときは送る回数を減らす（回線が細い人が詰まらないように）
        } else if (run.phase === 'end') { updateShots(dt); }
        Object.keys(allies).forEach(id => { const a = allies[id];
            // 仲間の位置：最後に届いた位置＋速度×経過時間（最大0.25秒ぶん）を目標にして、フレームレートに左右されない補間で近づく。離れすぎたらそこへ移動
            const age = Math.min(0.25, Math.max(0, (performance.now() - (a.pt || 0)) / 1000)), px = a.tx + (a.vx || 0) * age, py = a.ty + (a.vy || 0) * age, kk = 1 - Math.exp(-dt * 18);
            if (Math.hypot(px - a.x, py - a.y) > 320) { a.x = px; a.y = py; } else { a.x += (px - a.x) * kk; a.y += (py - a.y) * kk; } if (a.orb) { a.orb.t -= dt; if (a.orb.t <= 0) a.orb = null; } });
        fx.forEach(f => { f.t -= dt; if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; const dmp = Math.pow(0.06, dt); f.vx *= dmp; f.vy *= dmp; } }); fx = fx.filter(f => f.t > 0);
        if (comboT > 0) { comboT -= dt; if (comboT <= 0) comboN = 0; }
        if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeA = 0; }
        popups.forEach(p => { p.t -= dt; }); popups = popups.filter(p => p.t > 0);
        enemies.forEach(e => { if (e.flash > 0) e.flash -= dt; });
        render();
        requestAnimationFrame(loop);
    }

    // ---------- 起動 ----------
    el('waitStart').addEventListener('click', () => { if (socket && room) socket.emit('stage:start'); else beginRun(); });
    el('waitLeave').addEventListener('click', () => { if (socket) socket.emit('stage:leave'); location.href = 'index.html'; });
    el('resBack').addEventListener('click', () => { if (socket) socket.emit('stage:leave'); location.href = 'index.html'; });
    el('quizToggle').addEventListener('click', toggleQuiz);
    window.addEventListener('beforeunload', () => { if (socket) socket.emit('stage:leave'); });
    if (isTouch) {
        document.documentElement.classList.add('touch');
        // 最初のタッチ（ユーザー操作）で全画面にして横向きに固定する。対応していない端末では何も起きない
        window.addEventListener('pointerdown', function once() { window.removeEventListener('pointerdown', once); if (window.SBOrientation) SBOrientation.enterFullscreenLandscape(); }, { once: true });
    }

    el('wpnName').textContent = weapon.name; el('wpnName').style.color = HW.rarityOf(weapon).color;
    el('stageName').textContent = stage.icon + ' ' + stage.name + ' [' + DIFF.name + ']';
    buildSkillBar(); updateEnergyUI(); nextQuiz();

    if (launch.mode === 'solo') {
        isHost = true; room = null;
        el('waitRoom').style.display = 'none';
        beginRun();
    } else {
        renderWait();
        if (!setupNet()) { showWaitMsg('通信できないため、ソロで開始します'); setTimeout(beginRun, 1200); }
    }
    // 自動テスト用の窓口（テストページが window.__SB_TEST を用意したときだけ公開する。通常のプレイでは何も起きない）
    if (window.__SB_TEST) window.__SB_TEST.api = { run: run, me: me, RS: RS, CF: CF, get enemies() { return enemies; }, get eBullets() { return eBullets; }, get telegraphs() { return telegraphs; }, get world() { return [WORLD_W, WORLD_H]; }, get domains() { return domains; },
        killEnemy: killEnemy, onKillEvent: onKillEvent, corrDescend: corrDescend, corrEnterBoss: corrEnterBoss, corrLeaveBoss: corrLeaveBoss, corrOpenChest: corrOpenChest, corrWakeMimic: corrWakeMimic, corrTotal: corrTotal, corrMul: corrMul,
        hurtPvp: hurtPvp, dealPvp: dealPvp, rushStartPhase: rushStartPhase, rushPd: rushPd, REF: () => REF_HP, hurtMe: hurtMe, healMe: healMe, addHp: addHp, healMul: healMul, sdAtkMul: sdAtkMul, sdDefMul: sdDefMul, stunMe: stunMe, spawnEnemy: spawnEnemy, DIFF: () => DIFF, SC: SC, tally: tallyDmg, dmgOf: dmgOf, pvpHostCheck: pvpHostCheck, spawnDomain: spawnDomain, accSlots: accSlots, accFire: accFire, accEvent: accEvent, rollAcc: rollAcc, BAG: BAG, corrAsk: corrAsk, corrEscape: corrEscape, corrGiveUp: corrGiveUp, corrProp: corrProp, corrGiveItem: corrGiveItem, get allies() { return allies; }, get isHost() { return isHost; }, get minions() { return minions; }, get remoteMinions() { return remoteMinions; }, step: (dt) => { run.time += 0; } };
    requestAnimationFrame(loop);
})();
