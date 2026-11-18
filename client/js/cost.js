// ============================================
// School Battle
// cost.js（コスト制度）
// ============================================
// 装備とスキルには「コスト」があり、全ての戦い（ステージ・対人戦・大討伐戦…）で、勉強で伸びる「ステータス合計」で決まる「コスト上限」までしか、力を引き出せない。
//   ・コストを払うのは、武器（レア度 × 装備のレベル）・防具3か所・セットしたスキル4つ（消費エネルギー ÷ 12。職業の専用の形・グリフは割増）。装備とスキルは、同じひとつの上限を分け合う
//   ・コストが上限を超える装備・スキルは「装備できない」。コストを増やさない変更（コストの低い装備に替える、外す）は、上限を超えていてもできる
//   ・上限を超えた状態では、ステージ・対人戦・大討伐戦に出撃できない（装備・スキルを替えるか、勉強で上限を上げる）
//   ・安全装置：なんらかの理由で超過のまま戦闘が始まった場合は、装備の効果とスキルの威力を、まとめて弱める（効果 = 上限 ÷ いまのコスト）
//   ・ステータス合計が増えるほど上限が上がる＝勉強すれば、強い装備とスキルを使いこなせる。装備やスキルだけ強くても、勉強しないと本来の力は出ない
//   ・アクセサリーは、効果が「特別なスキル」なので、コストの対象外（対人戦では元から使えない）
//   ・数字を変えたいときは、このファイルの上の定数だけ触ればよい
(function (global) {
    'use strict';
    // ---- 調整用の数字 ----
    const WEAPON_COST = { normal: 1, magic: 2, rare: 4, epic: 7, legendary: 11, mythic: 16 };   // 武器：レア度ごとのコスト
    const ARMOR_RATE = 0.8;            // 防具（頭・胴・足）：武器コストにこの倍率をかけたもの（3か所あるので少し安い）
    const PLUS_COST = 0.1;             // 武器の「＋N」1つにつき、増えるコスト（＋100で+10）
    const ILVL_BASE = 0.4, ILVL_DIV = 40;      // 装備のレベル（ilvl）が高いほどコストも高い：× (ILVL_BASE + ilvl ÷ ILVL_DIV)（ilvl1 で×0.43、ilvl46 で×1.55）
    const SKILL_COST_DIV = 12;         // スキル：消費エネルギー ÷ この数 がコスト（エネルギー60のスキルで、コスト5）
    const CLASS_FORM_MUL = 1.5, CLASS_GLYPH_MUL = 1.15;    // 職業の専用の「形」を使うと×1.5、専用の「グリフ」を使うと×1.15（職業スキルが強いので、重くしてある）
    const CAP_BASE = 14, CAP_PER_DOUBLE = 9;    // 上限 = CAP_BASE + CAP_PER_DOUBLE × log2(ステータス合計 ÷ 250)（合計が2倍になるごとに +9。合計100万まで、勉強するほど上がり続ける）
    const MIN_RATIO = 0.25;            // 効果の下限（どんなにコスト超過でも、効果は最低でもこの割合は残る）

    const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
    function totalOf(p) {      // ステータス合計（体力・攻撃・防御・速さ・特殊）。practice.js の corrTotal と同じ
        try { const b = global.getStatsFromPlayer(p); return Math.max(250, num(b.maxHp) + num(b.atk) + num(b.def) + num(b.speed) + num(b.special)); } catch (e) { return 250; }
    }
    function capOf(total) { return Math.round(CAP_BASE + CAP_PER_DOUBLE * Math.log2(Math.max(250, total) / 250)); }
    const lvMul = it => ILVL_BASE + Math.min(60, Math.max(1, it.ilvl | 0 || 1)) / ILVL_DIV;
    const rarBase = it => WEAPON_COST[it.rarity] != null ? WEAPON_COST[it.rarity] : WEAPON_COST.rare;
    function costOfWeapon(w) { return !w ? 0 : rarBase(w) * lvMul(w) + (w.plus | 0) * PLUS_COST; }
    function costOfArmor(a) { return !a ? 0 : rarBase(a) * lvMul(a) * ARMOR_RATE; }
    // スキル1つのコスト：消費エネルギー ÷ 12。職業の専用の形・グリフは割増
    function costOfSkill(sk) {
        try {
            const AS = global.ActionSkills, c = AS && sk ? AS.compute(sk) : null; if (!c) return 0;
            let v = num(c.cost) / SKILL_COST_DIV; const F = AS.FORMS[sk.form];
            if (F && F.cls) v *= CLASS_FORM_MUL;
            if ((sk.effects || []).some(e => AS.EFFECTS[e] && AS.EFFECTS[e].cls)) v *= CLASS_GLYPH_MUL;
            return v;
        } catch (e) { return 0; }
    }
    function equippedSkills() { try { return (global.ActionSkills ? ActionSkills.loadLoadout() : []).filter(Boolean).filter(sk => ActionSkills.isFormUnlocked(sk.form)); } catch (e) { return []; } }
    // いまの装備とスキルのコストの内訳と、上限・効果の割合
    function breakdown(hack, total, opt) {
        opt = opt || {};
        const items = [], w = global.HW && HW.getEquipped(hack);
        if (w) items.push({ label: '武器 ' + (w.name || ''), cost: costOfWeapon(w) });
        try {
            const eq = global.SBArmor ? SBArmor.equipped(hack) : {}, names = { head: '頭', body: '胴', legs: '足' };
            Object.keys(names).forEach(k => { if (eq[k]) items.push({ label: names[k] + ' ' + (eq[k].name || ''), cost: costOfArmor(eq[k]) }); });
        } catch (e) { /* 防具が読めなくても計算は続ける */ }
        (opt.skills || equippedSkills()).forEach(sk => items.push({ label: 'スキル ' + (sk.name || ''), cost: costOfSkill(sk), skill: true }));
        const cost = Math.round(items.reduce((a, b) => a + b.cost, 0) * 10) / 10, cap = capOf(total);
        const ratio = cost <= cap ? 1 : Math.max(MIN_RATIO, cap / cost);
        return { items: items, cost: cost, cap: cap, total: total, ratio: ratio, over: cost > cap };
    }
    // 効果の数字（agg.stats）を、ratio 倍に弱める
    function scaleAgg(agg, ratio) {
        if (!agg || !agg.stats || ratio >= 1) return;
        Object.keys(agg.stats).forEach(k => { if (typeof agg.stats[k] === 'number') agg.stats[k] *= ratio; });
    }
    function summaryText(b) {
        return '⚖ コスト ' + b.cost + ' / 上限 ' + b.cap + (b.over ? '　⚠ 超過しています（出撃できません）' : '　（出撃できます）');
    }
    // ---- 装備できるかの判定 ----
    // change: { weapon: 武器 } | { armor: 防具 } | { unequipArmor: 'head'|'body'|'legs' } | { skills: [スキル…] } | { weaponCost: 変更後の武器 }
    // 上限を超える変更はできない。ただし、コストが増えない変更は、超過していてもできる（直すための変更を、止めない）
    function snapshot(hack) { return Object.assign({}, hack, { armorEq: Object.assign({}, hack.armorEq || {}) }); }
    function canEquip(hack, change, total) {
        total = total || totalOf(player());
        const before = breakdown(hack, total, change && change.skills ? { skills: change.beforeSkills || equippedSkills() } : null);
        const tmp = snapshot(hack); let opt = null;
        if (change.weapon) tmp.equipped = change.weapon.id;
        if (change.armor) { tmp.armorEq[change.armor.slot] = change.armor.id; if (!(tmp.armors || []).some(a => a.id === change.armor.id)) tmp.armors = (tmp.armors || []).concat([change.armor]); }
        if (change.unequipArmor) delete tmp.armorEq[change.unequipArmor];
        if (change.skills) opt = { skills: change.skills };
        if (change.patchWeapon) { tmp.weapons = (hack.weapons || []).map(w => w.id === change.patchWeapon.id ? Object.assign({}, w, change.patch) : w); }
        const after = breakdown(tmp, total, opt), ok = !after.over || after.cost <= before.cost + 1e-9;
        return { ok: ok, before: before, after: after, msg: ok ? '' : 'コストが上限を超えるため、変更できません（変更後 ' + after.cost + ' / 上限 ' + after.cap + '）。\n勉強でステータス合計を上げて上限を増やすか、ほかの装備・スキルを外してください。' };
    }
    function player() { try { return global.getPlayerData ? global.getPlayerData() : JSON.parse(localStorage.getItem('player') || 'null'); } catch (e) { return null; } }
    // 上限内に収まるまで、コストの高い防具・スキルから外す。それでも超えるなら、武器を、いちばんコストの低いものに替える
    function autoFit() {
        const hack = global.HW.load(), total = totalOf(player()), removed = [];
        const names = { head: '頭', body: '胴', legs: '足' };
        let guardN = 0;
        while (breakdown(hack, total).over && guardN++ < 12) {
            const eq = global.SBArmor ? SBArmor.equipped(hack) : {}, cand = [];
            Object.keys(names).forEach(k => { if (eq[k]) cand.push({ kind: 'armor', slot: k, cost: costOfArmor(eq[k]), label: names[k] + ' ' + (eq[k].name || '') }); });
            const sk = equippedSkills(); sk.forEach(x => cand.push({ kind: 'skill', id: x.id, cost: costOfSkill(x), label: 'スキル ' + (x.name || '') }));
            if (!cand.length) break;
            cand.sort((a, b) => b.cost - a.cost); const t = cand[0];
            if (t.kind === 'armor') { delete hack.armorEq[t.slot]; }
            else { try { const ids = ActionSkills.loadLoadout().map(x => (x && x.id !== t.id) ? x.id : ''); ActionSkills.saveLoadout(ids); } catch (e) { break; } }
            removed.push(t.label);
        }
        if (breakdown(hack, total).over) {      // それでも超えるなら、武器をいちばん安いものに
            const ok = w => { try { return !global.ClassSys || ClassSys.canUseWeaponType(w.type); } catch (e) { return true; } };
            const cheap = (hack.weapons || []).filter(ok).sort((a, b) => costOfWeapon(a) - costOfWeapon(b))[0];
            if (cheap && cheap.id !== hack.equipped) { hack.equipped = cheap.id; removed.push('武器を ' + cheap.name + ' に変更'); }
        }
        global.HW.save(hack);
        return { removed: removed, after: breakdown(hack, total) };
    }
    // いまの装備とスキルが、上限内か。出撃の前に呼ぶ。超過なら、理由を知らせて false（自動調整をすすめる）
    function guard() {
        try {
            const b = breakdown(global.HW.load(), totalOf(player()));
            if (!b.over) return true;
            const top = b.items.slice().sort((x, y) => y.cost - x.cost).slice(0, 3).map(x => x.label + '（' + (Math.round(x.cost * 10) / 10) + '）').join('、');
            const msg = '⚖ コストが上限を超えているため、出撃できません。\n\nコスト ' + b.cost + ' ／ 上限 ' + b.cap + '\nコストの大きいもの：' + top + '\n（勉強でステータス合計が増えると、上限が上がります）';
            if (global.confirm && global.confirm(msg + '\n\n自動で、コストの高い防具・スキルから外して調整しますか？')) {
                const r = autoFit(); alert('調整しました。\n外したもの：' + (r.removed.join('、') || 'なし') + '\nコスト ' + r.after.cost + ' ／ 上限 ' + r.after.cap + '\n\nもう一度、出撃してください。');
            }
            return false;
        } catch (e) { return true; }      // 判定そのものに失敗したときは、遊べなくならないように通す
    }
    global.SBCost = { autoFit: autoFit, canEquip: canEquip, guard: guard, player: player, breakdown: breakdown, totalOf: totalOf, capOf: capOf, scaleAgg: scaleAgg, costOfSkill: costOfSkill, summaryText: summaryText, costOfWeapon: costOfWeapon, costOfArmor: costOfArmor, WEAPON_COST: WEAPON_COST };
})(window);
