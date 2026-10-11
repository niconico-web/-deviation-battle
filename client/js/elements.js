// ============================================================
// 属性システム (elements.js)  ※モンハン風
//  ・基本の5属性：炎・水・風・土・雷。そこから派生する10属性（2つの基本属性の組み合わせ）
//  ・勉強すると、教科に応じた基本属性のポイントがたまる
//      国語→炎 ／ 数学→水 ／ 理科→風 ／ 社会→土 ／ 英語→雷
//    派生属性の強さは、元になった2つの基本属性の強さ（幾何平均）で決まる（片方だけ高くても伸びない）
//  ・武器とオリジナルスキルに属性が付く（まれに2つ）。属性ダメージ ＝ 命中ダメージ × 属性倍率
//      属性倍率 ＝ ( 0.10 ＋ 0.55 × 適性 ) × ( 1 ＋ 特殊ステータス効果 )   ※適性＝ポイント/(ポイント＋3000)
//  ・敵にはそれぞれ「弱点」と「耐性」の属性がある（弱点×1.6 ／ 耐性×0.5）
//  ・属性ごとに「バトルスタイル」（命中時の追加効果と、装備中のパッシブ）が違う
//  データは HW(sbHack) の elemPts に保存する（HW は hw-weapons.js）
// ============================================================
(function () {
    'use strict';

    const BASE = ['fire', 'water', 'wind', 'earth', 'thunder'];
    // style : 装備している武器に属性が付いているときのパッシブ（agg.stats に足される）
    // hit   : 命中時の追加効果の説明（実際の処理は stage.js の elemStyle）
    const ELEMS = {
        fire:    { name: '炎',   icon: '🔥', color: '#ff6a3a', base: true, subject: 'jp',   style: { atkPct: 0.08 },                 hit: '35%で燃焼（継続ダメージ）', styleName: '猛火型',   styleText: '攻撃力+8%。命中すると燃えて継続ダメージ' },
        water:   { name: '水',   icon: '💧', color: '#4aa8ff', base: true, subject: 'math', style: { regen: 0.008 },                 hit: '50%で減速',               styleName: '潤水型',   styleText: 'HPが毎秒0.8%回復。命中すると敵が減速' },
        wind:    { name: '風',   icon: '🌪️', color: '#7be0b0', base: true, subject: 'sci',  style: { aspd: 0.10 },                   hit: '命中で押し返す／20%で加速', styleName: '疾風型',   styleText: '攻撃速度+10%。命中で敵を押し返し、ときどき加速' },
        earth:   { name: '土',   icon: '⛰️', color: '#c8a060', base: true, subject: 'soc',  style: { dr: 0.10 },                     hit: '10%でスタン（ボス以外）', styleName: '堅牢型',   styleText: '被ダメージ-10%。命中するとときどき敵をスタン' },
        thunder: { name: '雷',   icon: '⚡', color: '#ffe84a', base: true, subject: 'eng',  style: { critRate: 0.06 },               hit: '30%で近くの敵2体へ連鎖',   styleName: '雷撃型',   styleText: 'クリティカル率+6%。命中すると近くの敵へ雷が連鎖' },
        steam:   { name: '蒸気', icon: '♨️', color: '#d8e8f0', parents: ['fire', 'water'],    style: { dr: 0.05 },                     hit: '35%で敵を弱体化（攻撃力ダウン）', styleName: '蒸気型', styleText: '被ダメージ-5%。命中すると敵の攻撃力が下がる' },
        blast:   { name: '爆炎', icon: '💥', color: '#ff9a4a', parents: ['fire', 'wind'],     style: { atkPct: 0.05, aspd: 0.05 },     hit: '25%で小爆発（範囲ダメージ）', styleName: '爆裂型', styleText: '攻撃力+5%・攻撃速度+5%。命中すると小爆発' },
        lava:    { name: '溶岩', icon: '🌋', color: '#e0552a', parents: ['fire', 'earth'],    style: { atkPct: 0.06, dr: 0.04 },       hit: '30%で燃焼＋呪い（被ダメージ増）', styleName: '溶岩型', styleText: '攻撃力+6%・被ダメージ-4%。敵を燃やし、被ダメージを増やす' },
        plasma:  { name: 'プラズマ', icon: '🔆', color: '#ff7aff', parents: ['fire', 'thunder'], style: { critRate: 0.10 },             hit: '20%で追加ダメージ',        styleName: '閃光型',   styleText: 'クリティカル率+10%。ときどき強烈な追加ダメージ' },
        ice:     { name: '氷',   icon: '❄️', color: '#aee8ff', parents: ['water', 'wind'],    style: { dr: 0.05 },                     hit: '50%で減速／12%で凍結（スタン）', styleName: '氷結型', styleText: '被ダメージ-5%。敵を凍らせて動きを止める' },
        venom:   { name: '毒',   icon: '☠️', color: '#9aff6a', parents: ['water', 'earth'],   style: { atkPct: 0.06 },                 hit: '50%で毒（継続ダメージ）',   styleName: '猛毒型',   styleText: '攻撃力+6%。命中すると毒で継続ダメージ' },
        sand:    { name: '砂',   icon: '🏜️', color: '#e8d090', parents: ['wind', 'earth'],    style: { dodge: 0.06 },                  hit: '40%で盲目（攻撃が弱まる）', styleName: '砂塵型',   styleText: '回避率+6%。命中すると敵が盲目になり攻撃が弱まる' },
        storm:   { name: '嵐',   icon: '🌩️', color: '#9ab8ff', parents: ['wind', 'thunder'],  style: { aspd: 0.06, critRate: 0.04 },   hit: '25%で連鎖＋自分が加速',     styleName: '暴風型',   styleText: '攻撃速度+6%・クリ率+4%。連鎖しつつ自分も加速' },
        discharge: { name: '放電', icon: '🔋', color: '#6af0ff', parents: ['water', 'thunder'], style: { critRate: 0.05 },           hit: '25%で周囲へ放電（範囲ダメージ）', styleName: '放電型', styleText: 'クリ率+5%。命中すると周囲へ電撃が走る' },
        magnet:  { name: '磁',   icon: '🧲', color: '#c0a0ff', parents: ['earth', 'thunder'], style: { dr: 0.05, atkPct: 0.03 },       hit: '35%で敵を引き寄せ＋連鎖',   styleName: '磁力型',   styleText: '被ダメージ-5%・攻撃力+3%。敵を引き寄せて雷を連鎖させる' }
    };
    const DERIVED = Object.keys(ELEMS).filter(k => !ELEMS[k].base);
    const ORDER = BASE.concat(DERIVED);
    const SUBJECT_ELEM = { jp: 'fire', math: 'water', sci: 'wind', soc: 'earth', eng: 'thunder' };
    const K_PTS = 3000;       // 適性が半分になるポイント
    const K_SPECIAL = 3000;   // 特殊ステータスの効きが半分になる値

    function hw() { return window.HW || null; }
    function getPts(d) {
        d = d || (hw() ? hw().load() : null);
        const p = (d && d.elemPts) || {};
        const o = {}; BASE.forEach(k => { o[k] = Math.max(0, Number(p[k]) || 0); });
        return o;
    }
    // 勉強で得たステータス上昇ぶんを、その教科の属性ポイントにする
    function addStudy(subject, gain) {
        const id = SUBJECT_ELEM[subject]; const H = hw();
        if (!id || !H || !(gain > 0)) return;
        const d = H.load(); d.elemPts = d.elemPts || {};
        d.elemPts[id] = (Number(d.elemPts[id]) || 0) + Math.round(gain);
        H.save(d);
    }
    // その属性の強さ（基本属性＝ポイントそのもの／派生属性＝元の2つの幾何平均）
    function power(id, pts) {
        const m = ELEMS[id]; if (!m) return 0;
        pts = pts || getPts();
        if (m.base) return pts[id] || 0;
        return Math.round(Math.sqrt((pts[m.parents[0]] || 0) * (pts[m.parents[1]] || 0)));
    }
    function attune(id, pts) { const p = power(id, pts); return p / (p + K_PTS); }
    // 命中ダメージに対する「属性ダメージ」の割合
    function ratio(id, pts, special) {
        const sp = Math.max(0, special || 0);
        return (0.10 + 0.55 * attune(id, pts)) * (1 + sp / (sp + K_SPECIAL));
    }
    // 装備している武器に属性が付いているときのパッシブ（合計）
    function styleStats(elems) {
        const out = {};
        (elems || []).forEach(id => { const m = ELEMS[id]; if (!m) return; Object.keys(m.style).forEach(k => { out[k] = (out[k] || 0) + m.style[k] / Math.max(1, (elems || []).length > 1 ? 1.5 : 1); }); });
        return out;
    }
    // 武器に付ける属性を抽選する（半分は無属性。付く場合は基本属性が多く、派生は少なめ。まれに2属性）
    function rollElems() {
        const r = Math.random();
        if (r < 0.45) return [];
        const pickOne = () => (Math.random() < 0.8 ? BASE[Math.floor(Math.random() * BASE.length)] : DERIVED[Math.floor(Math.random() * DERIVED.length)]);
        const a = pickOne();
        if (Math.random() < 0.06) { let b = pickOne(), t = 0; while (b === a && t++ < 8) b = pickOne(); if (b !== a) return [a, b]; }
        return [a];
    }
    function rollSkillElem() { return null; }
    // 敵の弱点・耐性（名前から決まる固定値。基本属性が多め）
    function hashStr(s) { let h = 2166136261; s = String(s || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function weakOf(name) {
        const h = hashStr(name);
        const sel = (v, hh) => (hh % 10 < 7 ? BASE[v % BASE.length] : DERIVED[v % DERIVED.length]);
        const weak = sel(h >>> 3, h);
        let resist = sel(h >>> 9, h >>> 6);
        if (resist === weak) resist = ORDER[(ORDER.indexOf(weak) + 7) % ORDER.length];
        return { weak: weak, resist: resist };
    }
    function label(id) { const m = ELEMS[id]; return m ? m.icon + m.name : ''; }
    function labels(ids) { return (ids || []).map(label).join('・'); }
    function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // 勉強画面などに出す「属性ステータス」の一覧
    function panelHtml(special) {
        const pts = getPts();
        const row = id => {
            const m = ELEMS[id], p = power(id, pts), r = ratio(id, pts, special);
            return '<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px solid #2a3350"><span style="color:' + m.color + '">' + m.icon + m.name + (m.base ? '' : '<small style="color:#8a97b8">（' + m.parents.map(x => ELEMS[x].name).join('＋') + '）</small>') + '</span>' +
                '<span>強さ <b>' + p + '</b>　属性ダメージ <b>+' + Math.round(r * 100) + '%</b></span></div>';
        };
        return '<div style="font-size:.78rem;line-height:1.5">' +
            '<div style="color:#9fb3d9;margin-bottom:4px">勉強すると教科の属性が強くなります。国語→🔥炎／数学→💧水／理科→🌪️風／社会→⛰️土／英語→⚡雷。派生属性は元の2属性が両方高いほど強くなります。特殊ステータスが高いほど、属性ダメージがさらに伸びます。</div>' +
            '<div style="font-weight:bold;margin:4px 0 2px">基本属性</div>' + BASE.map(row).join('') +
            '<div style="font-weight:bold;margin:6px 0 2px">派生属性</div>' + DERIVED.map(row).join('') + '</div>';
    }
    function styleHtml(ids) {
        return (ids || []).map(id => { const m = ELEMS[id]; return m ? '<div style="color:' + m.color + '">' + m.icon + ' ' + m.styleName + '：' + esc(m.styleText) + '</div>' : ''; }).join('');
    }

    window.SBElem = { ELEMS: ELEMS, BASE: BASE, DERIVED: DERIVED, ORDER: ORDER, SUBJECT_ELEM: SUBJECT_ELEM, getPts: getPts, addStudy: addStudy, power: power, attune: attune, ratio: ratio,
        styleStats: styleStats, rollElems: rollElems, weakOf: weakOf, label: label, labels: labels, panelHtml: panelHtml, styleHtml: styleHtml };
})();
