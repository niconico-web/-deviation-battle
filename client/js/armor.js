// ============================================================
// 防具システム (armor.js)  ※武器（hw-weapons.js）と同じ作り
//  ・部位は「頭・胴・脚」。ステージの敵・ボスがドロップする（レア度・特殊効果つき）
//  ・防具ごとの基本性能（体力・軽減・移動など）は部位とレア度で決まり、特殊効果（攻撃・属性ダメージなど）が付く
//  ・データは HW(sbHack) の armors（所持品）と armorEq（装備中）に保存する
//  ・戦闘では SBArmor.merge(agg, hack) で武器の集計(agg.stats)に足される（stage.js）
// ============================================================
(function () {
    'use strict';

    const SLOTS = {
        head: { label: '頭', icon: '🪖', base: { hpPct: 0.03, dr: 0.015 } },
        body: { label: '胴', icon: '🥋', base: { hpPct: 0.06, dr: 0.03, defPct: 0.06 } },
        legs: { label: '脚', icon: '👢', base: { hpPct: 0.03, dr: 0.015, moveSpd: 0.03 } }
    };
    const SLOT_ORDER = ['head', 'body', 'legs'];

    // 防具のベース：[名前, 階級(tier＝ステージのLvの目安)]
    const NAMES = {
        head: [['革の帽子', 1], ['鉄の兜', 4], ['鋼の兜', 7], ['ルーンの兜', 10], ['竜骨の兜', 14], ['魔導の冠', 18], ['次元の兜', 22], ['神域の冠', 27], ['機神の兜', 33], ['虚空の冠', 40], ['終焉の冠', 46]],
        body: [['布の服', 1], ['革の鎧', 4], ['鎖帷子', 7], ['ルーンの鎧', 10], ['竜鱗の鎧', 14], ['魔導の法衣', 18], ['次元の鎧', 22], ['神域の鎧', 27], ['機神の装甲', 33], ['虚空の鎧', 40], ['終焉の鎧', 46]],
        legs: [['布の靴', 1], ['革のブーツ', 4], ['鋼のグリーブ', 7], ['ルーンの脚甲', 10], ['竜鱗の脚甲', 14], ['魔導の靴', 18], ['次元の脚甲', 22], ['神域の脚甲', 27], ['機神の脚部', 33], ['虚空の靴', 40], ['終焉の靴', 46]]
    };
    const BASES = [];
    SLOT_ORDER.forEach(slot => NAMES[slot].forEach((n, i) => BASES.push({ id: slot + '_' + (i + 1), slot: slot, name: n[0], tier: n[1] })));

    const pct = v => Math.round(v * 1000) / 10 + '%';
    const BASE_EL = ['fire', 'water', 'wind', 'earth', 'thunder'];
    const ELN = { fire: '炎', water: '水', wind: '風', earth: '土', thunder: '雷' };
    // 特殊効果（key は stage.js の A(key) で読まれる名前に合わせてある）
    const EFFECTS = [
        { id: 'ar_hp',    key: 'hpPct',    name: '頑強',   range: [0.04, 0.09],  desc: v => `最大HP +${pct(v)}` },
        { id: 'ar_dr',    key: 'dr',       name: '堅守',   range: [0.015, 0.035], desc: v => `被ダメージ -${pct(v)}` },
        { id: 'ar_def',   key: 'defPct',   name: '鉄壁',   range: [0.05, 0.12],  desc: v => `防御 +${pct(v)}` },
        { id: 'ar_atk',   key: 'atkPct',   name: '剛力',   range: [0.03, 0.07],  desc: v => `攻撃力 +${pct(v)}` },
        { id: 'ar_crit',  key: 'critRate', name: '会心',   range: [0.02, 0.05],  desc: v => `クリティカル率 +${pct(v)}` },
        { id: 'ar_aspd',  key: 'aspd',     name: '迅速',   range: [0.03, 0.07],  desc: v => `攻撃速度 +${pct(v)}` },
        { id: 'ar_dodge', key: 'dodge',    name: '軽業',   range: [0.02, 0.05],  desc: v => `回避率 +${pct(v)}` },
        { id: 'ar_regen', key: 'regen',    name: '再生',   range: [0.002, 0.006], desc: v => `HPが毎秒 ${pct(v)} 回復` },
        { id: 'ar_move',  key: 'moveSpd',  name: '俊足',   range: [0.03, 0.07],  desc: v => `移動速度 +${pct(v)}` },
        { id: 'ar_skill', key: 'skillPct', name: '術理',   range: [0.05, 0.12],  desc: v => `スキルの威力 +${pct(v)}` },
        { id: 'ar_energy', key: 'energyUp', name: '充填',  range: [0.05, 0.12],  desc: v => `エネルギーの溜まりやすさ +${pct(v)}` },
        { id: 'ar_gold',  key: 'goldPct',  name: '商才',   range: [0.05, 0.15],  desc: v => `獲得コイン +${pct(v)}` },
        { id: 'ar_drop',  key: 'dropPct',  name: '強運',   range: [0.04, 0.10],  desc: v => `ドロップ率 +${pct(v)}` },
        { id: 'ar_elall', key: 'elAtkAll', name: '属性解放', range: [0.06, 0.13], desc: v => `すべての属性ダメージ +${pct(v)}` }
    ].concat(BASE_EL.map(e => ({ id: 'ar_el_' + e, key: 'elAtk:' + e, name: ELN[e] + '属性強化', range: [0.10, 0.22], desc: v => `${ELN[e]}属性ダメージ +${pct(v)}` })))
    // --- リスキー・尖った効果（強い代わりに、はっきりした代償がある）---
    .concat([
        { id: 'ar_rk_mad',    risk: true, key: 'rk', name: '狂乱の鎧',   range: [0.80, 1.50], mods: v => ({ dmgTaken: 0.3, thorns: v }),    desc: v => `⚠ 被ダメージ +30%／被弾時に攻撃力の${pct(v)}を反射` },
        { id: 'ar_rk_bulwark',risk: true, key: 'rk', name: '要塞',       range: [0.18, 0.30], mods: v => ({ dr: v, moveSpd: -0.25 }),        desc: v => `⚠ 移動速度 -25%／被ダメージ -${pct(v)}` },
        { id: 'ar_rk_glass',  risk: true, key: 'rk', name: '硝子の鎧',   range: [0.40, 0.80], mods: v => ({ hpPct: -0.4, iframe: v }),       desc: v => `⚠ 最大HP -40%／被弾後の無敵時間 +${v.toFixed(2)}秒` },
        { id: 'ar_rk_blood',  risk: true, key: 'rk', name: '血鎧',       range: [0.12, 0.22], mods: v => ({ healDown: 0.5, dr: v }),         desc: v => `⚠ 回復効果 -50%／被ダメージ -${pct(v)}` },
        { id: 'ar_rk_greed',  risk: true, key: 'rk', name: '強欲',       range: [0.60, 1.20], mods: v => ({ goldPct: v, hpPct: -0.2 }),      desc: v => `⚠ 最大HP -20%／獲得コイン +${pct(v)}` },
        { id: 'ar_rk_scholar',risk: true, key: 'rk', name: '学者の代償', range: [0.50, 1.00], mods: v => ({ energyUp: v, defPct: -0.3 }),    desc: v => `⚠ 防御力 -30%／エネルギーの溜まりやすさ +${pct(v)}` },
        { id: 'ar_rk_adren',  risk: true, key: 'rk', name: '背水の護り', range: [0.20, 0.40], mods: v => ({ lowHpDr: v, hpPct: -0.1 }),      desc: v => `⚠ 最大HP -10%／HP30%以下のあいだ被ダメージ -${pct(v)}` },
        { id: 'ar_rk_mirror', risk: true, key: 'rk', name: '鏡の肌',     range: [0.10, 0.20], mods: v => ({ dmgTaken: 0.2, dodge: v }),      desc: v => `⚠ 被ダメージ +20%／回避率 +${pct(v)}` },
        { id: 'ar_rk_swift',  risk: true, key: 'rk', name: '軽装の代償', range: [0.15, 0.30], mods: v => ({ moveSpd: v, defPct: -0.25 }),    desc: v => `⚠ 防御力 -25%／移動速度 +${pct(v)}` },
        { id: 'ar_rk_will',   risk: true, key: 'rk', name: '不屈',       range: [0.30, 0.60], mods: v => ({ regen: 0.006, atkPct: -v * 0.4 }), desc: v => `⚠ 攻撃力 -${pct(v * 0.4)}／毎秒 最大HPの0.6%回復` }
    ]);
    const EFFECT_BY_ID = {}; EFFECTS.forEach(e => { EFFECT_BY_ID[e.id] = e; });

    const rnd = (a, b) => a + Math.random() * (b - a);
    const rint = (a, b) => Math.floor(rnd(a, b + 1));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const uid = () => 'ar_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const H = () => window.HW;
    const STORAGE_LIMIT = 100;

    function ensure(d) {
        if (!Array.isArray(d.armors)) d.armors = [];
        if (!d.armorEq || typeof d.armorEq !== 'object') d.armorEq = {};
        return d;
    }
    function baseStats(slot, rarityKey, tier) {
        const idx = H().RARITY_ORDER.indexOf(rarityKey);
        const sc = (1 + idx * 0.35) * (1 + tier * 0.012);
        const out = {}; Object.keys(SLOTS[slot].base).forEach(k => { out[k] = Math.round(SLOTS[slot].base[k] * sc * 1000) / 1000; });
        return out;
    }
    // 防具を1つ抽選する。opts: { ilvl, luck, minRarity, slot, source }
    function roll(opts) {
        opts = opts || {};
        const ilvl = Math.max(1, opts.ilvl || 1);
        const slot = opts.slot || pick(SLOT_ORDER);
        const all = BASES.filter(b => b.slot === slot);
        let pool = all.filter(b => Math.abs(b.tier - ilvl) <= 6);
        if (!pool.length) pool = [all.reduce((a, b) => (Math.abs(b.tier - ilvl) < Math.abs(a.tier - ilvl) ? b : a))];
        const base = pick(pool);
        const rarityKey = opts.forceRarity || H().pickRarity(opts.luck, opts.minRarity, ilvl);
        const rar = H().RARITIES[rarityKey], idx = H().RARITY_ORDER.indexOf(rarityKey);
        const nFx = rint(rar.fx[0], rar.fx[1]);
        const fxPool = EFFECTS.filter(e => !(slot !== 'legs' && e.key === 'moveSpd')).slice();   // 移動速度は脚だけ
        const effects = [];
        for (let i = 0; i < nFx && fxPool.length; i++) effects.push(rollFx(takeFx(fxPool), idx, ilvl));
        const a = { id: uid(), kind: 'armor', slot: slot, baseId: base.id, baseName: base.name, tier: base.tier, rarity: rarityKey, prefix: pick(rar.prefixes), ilvl: ilvl,
            stats: baseStats(slot, rarityKey, base.tier), effects: effects, source: opts.source || null, createdAt: Date.now() };
        a.name = a.prefix + '＋' + a.baseName;
        return a;
    }
    // 追加効果の振り直し：idxs（効果の番号の配列。いくつでも選べる）の効果だけを引き直す。省略すると全部。特殊アイテム「混沌の宝珠」用
    function rerollEffects(a, idxs) {
        if (!a || !Array.isArray(a.effects)) return false;
        const idx = H().RARITY_ORDER.indexOf(a.rarity), ilvl = Math.max(1, a.ilvl || 1);
        const sel = Array.isArray(idxs) ? idxs.filter(i => i >= 0 && i < a.effects.length) : a.effects.map((_, i) => i);
        if (!sel.length) return false;
        const keep = a.effects.filter((_, i) => sel.indexOf(i) < 0).map(f => f.id);
        const pool = EFFECTS.filter(e => keep.indexOf(e.id) < 0 && !(a.slot !== 'legs' && e.key === 'moveSpd')).slice();
        sel.forEach(i => { if (pool.length) a.effects[i] = rollFx(takeFx(pool), idx, ilvl); });
        return true;
    }
    function add(d, a) { ensure(d); d.armors.push(a); return a; }
    function describeEffect(fx) { const e = EFFECT_BY_ID[fx.id]; return e ? e.desc(fx.v) : fx.id; }
    function statLines(a) {
        const names = { hpPct: v => `最大HP +${pct(v)}`, dr: v => `被ダメージ -${pct(v)}`, defPct: v => `防御 +${pct(v)}`, moveSpd: v => `移動速度 +${pct(v)}` };
        return Object.keys(a.stats || {}).map(k => names[k] ? names[k](a.stats[k]) : '');
    }
    function rarityOf(a) { return H().rarityOf(a); }
    function sellValue(a) { const idx = H().RARITY_ORDER.indexOf(a.rarity); return Math.max(1, Math.round((3 + a.ilvl * 1.4) * (1 + idx * 1.3))); }
    function equipped(d) { ensure(d); const o = {}; SLOT_ORDER.forEach(s => { o[s] = d.armors.find(x => x.id === d.armorEq[s]) || null; }); return o; }
    function equip(d, id) { ensure(d); const a = d.armors.find(x => x.id === id); if (!a) return false; d.armorEq[a.slot] = a.id; return true; }
    function unequip(d, slot) { ensure(d); delete d.armorEq[slot]; }
    function sell(d, id) {
        ensure(d); const a = d.armors.find(x => x.id === id); if (!a || a.locked || d.armorEq[a.slot] === a.id) return 0;
        d.armors = d.armors.filter(x => x.id !== id); return sellValue(a);
    }
    // 一括売却：選んだレア度・部位のうち、装備中でもロック中でもないもの
    function bulkTargets(d, o) {
        ensure(d); o = o || {};
        const rs = o.rarities || [], sl = o.slots || SLOT_ORDER;
        return d.armors.filter(a => rs.indexOf(a.rarity) >= 0 && sl.indexOf(a.slot) >= 0 && !a.locked && d.armorEq[a.slot] !== a.id);
    }
    // 効果1つぶんの値を決める（レア度・レベルで伸びる。リスキーな効果は伸びすぎないよう上限あり）
    function rollFx(e, idx, ilvl) {
        const v = rnd(e.range[0], e.range[1]) * (1 + Math.max(0, idx) * 0.22) * (1 + Math.min(ilvl, 20) * 0.02);
        const cap = e.risk ? e.range[1] * 1.8 : (e.key === 'dr' ? 0.08 : (e.key === 'critRate' || e.key === 'dodge' ? 0.15 : 9));
        return { id: e.id, v: Math.round(Math.min(v, cap) * 1000) / 1000 };
    }
    // 候補から1つ選ぶ（リスキーな効果は約12%）
    function takeFx(pool) {
        const risky = pool.filter(e => e.risk), safe = pool.filter(e => !e.risk);
        const useRisk = risky.length && (!safe.length || Math.random() < 0.12), src = useRisk ? risky : safe, e = src[Math.floor(Math.random() * src.length)];
        pool.splice(pool.indexOf(e), 1); return e;
    }
    function bulkSell(d, o) {
        const ts = bulkTargets(d, o); const ids = {}; let coins = 0;
        ts.forEach(a => { ids[a.id] = true; coins += sellValue(a); });
        d.armors = d.armors.filter(a => !ids[a.id]);
        return { count: ts.length, coins: coins };
    }
    // 装備中の防具の効果を合計する
    function totals(d) {
        const st = {}; const add = (k, v) => { st[k] = (st[k] || 0) + v; };
        const eq = equipped(d);
        SLOT_ORDER.forEach(s => { const a = eq[s]; if (!a) return;
            Object.keys(a.stats || {}).forEach(k => add(k, a.stats[k]));
            (a.effects || []).forEach(fx => { const e = EFFECT_BY_ID[fx.id]; if (!e) return; if (e.mods) { const m = e.mods(fx.v); Object.keys(m).forEach(k => add(k, m[k])); } else add(e.key, fx.v); });
        });
        return st;
    }
    function merge(agg, d) {
        const t = totals(d || H().load());
        Object.keys(t).forEach(k => { agg.stats[k] = (agg.stats[k] || 0) + t[k]; });
        return agg;
    }
    function summaryLines(d) {
        const t = totals(d), lines = [];
        const nm = { hpPct: '最大HP', dr: '被ダメージ軽減', defPct: '防御', moveSpd: '移動速度', atkPct: '攻撃力', critRate: 'クリ率', aspd: '攻撃速度', dodge: '回避率', regen: '自然回復', skillPct: 'スキル威力', energyUp: 'エネルギー', goldPct: 'コイン', dropPct: 'ドロップ率', elAtkAll: '全属性ダメージ' };
        Object.keys(t).forEach(k => { if (nm[k]) lines.push(nm[k] + ' +' + pct(t[k])); else if (k.indexOf('elAtk:') === 0) lines.push(ELN[k.slice(6)] + '属性ダメージ +' + pct(t[k])); });
        return lines;
    }

    window.SBArmor = { SLOTS: SLOTS, SLOT_ORDER: SLOT_ORDER, BASES: BASES, EFFECTS: EFFECTS, STORAGE_LIMIT: STORAGE_LIMIT,
        ensure: ensure, roll: roll, rerollEffects: rerollEffects, add: add, describeEffect: describeEffect, statLines: statLines, rarityOf: rarityOf, sellValue: sellValue,
        equipped: equipped, equip: equip, unequip: unequip, sell: sell, bulkTargets: bulkTargets, bulkSell: bulkSell, totals: totals, merge: merge, summaryLines: summaryLines };
})();
