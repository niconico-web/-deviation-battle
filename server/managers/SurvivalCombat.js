// ============================================================
// SurvivalCombat.js ― サバイバルエリアの戦闘拡張
//   ・クイズに正解 → 精神力（エネルギー）がたまる（stage.html と同じ考え方）
//   ・精神力を使って、モジュール式スキル（ActionSkills）を Z X C V で撃てる
//   ・敵に与えたダメージで必殺技ゲージがたまり、満タンで武器ごとの必殺技
//   ・集中（ガード）：精神力を使って、短い間ダメージを防ぐ
//   ・スキルの効果（燃焼・凍結・麻痺・吸収など）を敵にかける
//
//  計算はすべてサーバー。端末が送るスキルの数値は、ここで必ず範囲内に直す（cleanSkill）
//  SurvivalManager とは env（players / monsters / projs / emit / damageMonster ...）でつながる
// ============================================================
"use strict";

const FORMS = ["projectile", "laser", "slash", "nova", "meteor", "orbit", "thrust", "barrage", "summon", "domain", "flash"];
const FORM_NAME = { projectile: "投射", laser: "レーザー", slash: "斬撃", nova: "衝撃波", meteor: "流星", orbit: "旋回", thrust: "突き", barrage: "包囲弾幕", summon: "ミニオン", domain: "領域", flash: "一閃" };
const EFFECTS = ["damage", "burn", "freeze", "knockback", "drain", "stun", "poison", "weaken", "shatter", "blind", "petrify", "explosion", "frostbite", "soulburn", "voidrend", "chronowarp", "gravity", "fortify", "haste", "regenerate", "empower", "barrier"];

const CFG = {
    EN_REGEN: 1.2,            // 精神力は、クイズに答えなくても少しずつ回復する（毎秒）
    QUIZ_GAIN: 25, QUIZ_STREAK_BONUS: 10, QUIZ_MIN_GAP: 0.55,
    UG_MAX: 100, UG_PER_UNIT: 2.4, UG_PER_HIT_CAP: 12, UG_MYTHIC: 1.6,
    GUARD_COST: 15, GUARD_S: 2.2, GUARD_CD: 6,
    SKILL_PVP_MUL: 0.3,       // スキルが人に当たるときのダメージ（通常の対人ダメージ換算に対する倍率）
    SKILL_POWER_CAP: 1800,    // 特殊ステータスによるスキル火力の上限（特殊1800で×7）
    MAX_ACTS: 400
};

const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function energyMaxFor(special) { return Math.round(100 + 30 * Math.log2(Math.max(1, special / 50))); }
function skillPowerFor(special) { return 1 + Math.min(special, CFG.SKILL_POWER_CAP) / 300; }

// ---------- 端末から届いたスキルを、安全な数値に直す ----------
function cleanPiece(pc) {
    pc = pc || {};
    return { fw: clamp(num(pc.fw, 0), -150, 450), sd: clamp(num(pc.sd, 0), -300, 300), a: clamp(num(pc.a, 0), -180, 180), s: clamp(num(pc.s, 1), 0.5, 2.5) };
}
function cleanSkill(s) {
    if (!s || typeof s !== "object") return null;
    const form = String(s.form || "");
    if (FORMS.indexOf(form) < 0) return null;
    const p = s.params && typeof s.params === "object" ? s.params : {};
    const sp = {
        form: form,
        name: String(s.name || FORM_NAME[form]).replace(/[<>&"]/g, "").slice(0, 14),
        cost: clamp(Math.round(num(s.cost, 30)), 5, 400),
        cd: clamp(num(s.cooldown != null ? s.cooldown : s.cd, 2), 0.6, 30),
        count: clamp(Math.floor(num(p.count, 1)), 1, 8),
        dm: clamp(num(p.dmgMult, 1), 0.5, 4),
        base: clamp(num(p.baseMult, 2), 0.02, 5),
        effects: (Array.isArray(s.effects) ? s.effects : (Array.isArray(p.effects) ? p.effects : [])).filter(e => EFFECTS.indexOf(e) >= 0).slice(0, 6),
        radius: clamp(num(p.radius, 120), 15, 420), length: clamp(num(p.length, 300), 40, 800), width: clamp(num(p.width, 30), 8, 160),
        arc: clamp(num(p.arc, 2), 0.3, 6.3), speed: clamp(num(p.speed, 420), 150, 900), range: clamp(num(p.range, 500), 60, 800),
        pierce: clamp(Math.floor(num(p.pierce, 0)), 0, 9), spread: clamp(num(p.spread, 0.2), 0, 1),
        delay: clamp(num(p.delay, 0.2), 0, 1.2), stagger: clamp(num(p.stagger, 0.25), 0.05, 0.6),
        orbs: clamp(Math.floor(num(p.orbs, 2)), 1, 8), orbitR: clamp(num(p.orbitR, 95), 40, 260),
        dur: clamp(num(p.duration, 3), 0.5, 12), tick: clamp(num(p.tick, 0.4), 0.15, 1.2),
        dist: clamp(num(p.dist, 340), 80, 700), lunge: clamp(num(p.lunge, 0), 0, 120),
        bullets: clamp(Math.floor(num(p.bullets, 20)), 1, 24), waves: clamp(Math.floor(num(p.waves, 3)), 1, 4), ringR: clamp(num(p.ringR, 170), 60, 320),
        atkCd: clamp(num(p.atkCd, 1.1), 0.4, 3),
        pieces: Array.isArray(p.pieces) ? p.pieces.slice(0, 8).map(cleanPiece) : null,
        custom: !!p.custom
    };
    return sp;
}
function cleanSlots(list) {
    const out = [];
    if (Array.isArray(list)) list.slice(0, 4).forEach(s => { const c = cleanSkill(s); out.push(c ? Object.assign(c, { cdUntil: 0 }) : null); });
    while (out.length < 4) out.push(null);
    return out;
}

// ---------- 必殺技（武器の攻撃タイプごと。数値は stage.html の通常の必殺技と同じ考え方） ----------
const ULT = {
    lance: { name: "貫穿の一閃", rep: 3, gap: 0.13, len: 360, width: 52, mult: 2.2 },
    quake: { name: "大震撃", rep: 3, gap: 0.18, radius: 200, mult: 2.8, kn: 220 },
    volley: { name: "一斉掃射", n: 16, gap: 0.07, mult: 0.9 },
    nova: { name: "大崩壊", rep: 2, gap: 0.3, radius: 280, mult: 3.2, kn: 260 },
    slash: { name: "連斬", n: 7, gap: 0.09, radius: 175, arc: 1.9, mult: 1.1 }
};
function ultKindOf(T) { const k = T && T.kind; return k === "line" ? "lance" : k === "smash" ? "quake" : k === "proj" ? "volley" : k === "ring" ? "nova" : "slash"; }

module.exports = function create(env) {
    const { players, monsters, projs, emit, SW, Nations, C, dist, now, damageMonster, damagePlayer, pvpDamage, unitPower, getTypes, killMonster } = env;
    const acts = [];            // 予約された処理（遅れて当たる攻撃・継続する効果）
    const dots = new Map();     // 敵にかかっている状態（燃焼など）

    const later = (t, owner, fn) => { if (acts.length < CFG.MAX_ACTS) acts.push({ t: t, o: owner, fn: fn }); };
    const alive = (P) => P && !P.dead && !P.ghost && players.has(P.sid);

    // ---------- 参加時 ----------
    function initPlayer(P, data) {
        P.special = clamp(num(data && data.special, 0), 0, 1e8);
        P.enMax = energyMaxFor(P.special);
        P.enMul = Math.sqrt(P.enMax / 100);
        P.en = Math.round(P.enMax * 0.5);
        P.ug = 0; P.streak = 0; P.qAt = 0;
        P.guardUntil = 0; P.guardCd = 0; P.barHp = 0; P.barUntil = 0;
        P.buf = { haste: 0, empower: 0, fortify: 0, regen: 0 };
        P.slots = cleanSlots(data && data.skills);
    }

    // ---------- クイズ（正解で精神力） ----------
    function quiz(P, ok) {
        const t = now();
        if (!alive(P)) return { ok: false };
        if (t - P.qAt < CFG.QUIZ_MIN_GAP) return { ok: false, reason: "fast" };      // 連打での不正取得を防ぐ
        P.qAt = t;
        if (ok) {
            P.streak++;
            P.en = Math.min(P.enMax, P.en + (CFG.QUIZ_GAIN + (P.streak >= 3 ? CFG.QUIZ_STREAK_BONUS : 0)) * P.enMul);
        } else P.streak = 0;
        return { ok: true, en: Math.round(P.en), streak: P.streak };
    }

    // ---------- 必殺技ゲージ（与えたダメージでたまる） ----------
    function onDealt(P, units) {
        if (!P || P.ultActive || P.ug >= CFG.UG_MAX) return;
        const g = Math.min(CFG.UG_PER_HIT_CAP, units * CFG.UG_PER_UNIT) * (P.wmythic ? CFG.UG_MYTHIC : 1);
        P.ug = Math.min(CFG.UG_MAX, P.ug + g);
    }

    // ---------- 当たり判定の共通部品 ----------
    function foesOf(P, t) {
        const out = [];
        monsters.forEach(M => {
            if (M.dead) return;
            if (M.nid && (Nations.friendlyUnit(P, M.nid) || (M.kind === "guard" && !M.escort && !Nations.hostileTo(M.nid, P, t)))) return;
            out.push({ m: M, x: M.x, y: M.y, r: M.r });
        });
        if (!SW.inSafe(P.x, P.y)) {
            players.forEach(O => {
                if (O === P || O.dead || O.ghost || SW.inSafe(O.x, O.y) || Nations.friendly(P, O)) return;
                out.push({ p: O, x: O.x, y: O.y, r: C.PLAYER_R });
            });
        }
        return out;
    }
    function skillUnits(P, sp, mul) {
        const buf = P.buf.empower > now() ? 1.3 : 1;
        return unitPower(P) * sp.base * sp.dm * skillPowerFor(P.special) * buf * (mul || 1);
    }
    function hurt(P, f, units, sp, from) {
        if (f.m) {
            if (f.m.dead) return;
            const dealt = units * (sp && sp.effects.indexOf("shatter") >= 0 ? 1.25 : 1);
            damageMonster(f.m, dealt, P);
            if (sp) applyEffects(P, f.m, sp, units, from);
        } else if (f.p && !f.p.dead) {
            damagePlayer(f.p, pvpDamage(f.p, units * CFG.SKILL_PVP_MUL), P, null);
            onDealt(P, units * CFG.SKILL_PVP_MUL);
        }
    }
    // 円
    function hitCircle(P, x, y, rad, units, sp, t) {
        let n = 0;
        foesOf(P, t).forEach(f => { if (Math.hypot(f.x - x, f.y - y) - f.r < rad) { hurt(P, f, units, sp, { x: x, y: y }); n++; } });
        return n;
    }
    // 扇
    function hitSector(P, x, y, a, rad, arc, units, sp, t) {
        let n = 0;
        foesOf(P, t).forEach(f => {
            const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
            if (d - f.r > rad) return;
            let da = Math.atan2(dy, dx) - a; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
            if (d < f.r + 20 || Math.abs(da) <= arc / 2 + Math.atan2(f.r, Math.max(d, 1))) { hurt(P, f, units, sp, { x: x, y: y }); n++; }
        });
        return n;
    }
    // 線（長さ len、幅 width）
    function hitLine(P, x, y, a, len, width, units, sp, t) {
        const c = Math.cos(a), s = Math.sin(a); let n = 0;
        foesOf(P, t).forEach(f => {
            const dx = f.x - x, dy = f.y - y, fw = dx * c + dy * s, sd = Math.abs(-dx * s + dy * c);
            if (fw > -f.r && fw < len + f.r && sd < width / 2 + f.r) { hurt(P, f, units, sp, { x: x, y: y }); n++; }
        });
        return n;
    }

    // ---------- スキルの効果（燃焼・凍結・麻痺…） ----------
    function status(M) { return M.s || (M.s = { so: null }); }
    function applyEffects(P, M, sp, units, from) {
        const t = now(), has = (e) => sp.effects.indexOf(e) >= 0;
        if (M.dead) return;
        const S = status(M); S.so = P;
        const dot = (key, dps, secs) => { S[key] = { until: t + secs, dps: Math.max(S[key] ? S[key].dps : 0, dps) }; dots.set(M.id, M); };
        if (has("burn")) dot("burn", units * 0.22, 3);
        if (has("poison")) dot("poison", units * 0.18, 4);
        if (has("soulburn")) dot("burn", units * 0.55, 3);
        if (has("frostbite")) { dot("poison", units * 0.2, 3); S.slowUntil = Math.max(S.slowUntil || 0, t + 3); }
        if (has("freeze")) S.slowUntil = Math.max(S.slowUntil || 0, t + 2);
        if (has("stun")) S.stunUntil = Math.max(S.stunUntil || 0, t + 1);
        if (has("petrify")) S.stunUntil = Math.max(S.stunUntil || 0, t + 1.6);
        if (has("chronowarp")) S.stunUntil = Math.max(S.stunUntil || 0, t + 2.6);
        if (has("weaken") || has("blind")) S.weakUntil = Math.max(S.weakUntil || 0, t + 3);
        if (M.boss) { S.stunUntil = Math.min(S.stunUntil || 0, t + 0.6); }           // ボスは長く止められない
        if (has("knockback") && from && !M.boss) push(M, from, 150);
        if (has("gravity") && from && !M.boss) push(M, from, -130);
        if (has("explosion")) damageMonster(M, units * 0.35, P);
        if ((has("drain") || has("voidrend")) && alive(P)) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * (has("voidrend") ? 0.05 : 0.02));
    }
    function push(M, from, amount) {
        const dx = M.x - from.x, dy = M.y - from.y, d = Math.hypot(dx, dy) || 1;
        const r = SW.resolve(M.x + dx / d * amount, M.y + dy / d * amount, M.r);
        M.x = r.x; M.y = r.y;
    }
    function selfEffects(P, sp) {
        const t = now();
        sp.effects.forEach(e => {
            if (e === "fortify") P.buf.fortify = t + 3;
            if (e === "haste") P.buf.haste = t + 3;
            if (e === "regenerate") P.buf.regen = t + 4;
            if (e === "empower") P.buf.empower = t + 3;
            if (e === "barrier") { P.barHp = P.maxHp * 0.25; P.barUntil = t + 6; }
        });
    }

    // ---------- スキルを撃つ ----------
    function pieceAt(P, a, pc) {
        const c = Math.cos(a), s = Math.sin(a);
        return { x: P.x + c * pc.fw - s * pc.sd, y: P.y + s * pc.fw + c * pc.sd, a: a + pc.a * Math.PI / 180, s: pc.s };
    }
    function fanPieces(sp, n) {
        const out = [];
        for (let i = 0; i < n; i++) out.push({ fw: 0, sd: 0, a: n > 1 ? (i - (n - 1) / 2) * (sp.spread * 57.3 * (sp.form === "laser" ? 0.8 : 1)) : 0, s: 1 });
        return out;
    }
    function cast(P, idx, aim) {
        const t = now();
        if (!alive(P)) return { ok: false, reason: "dead" };
        const sp = P.slots[idx | 0];
        if (!sp) return { ok: false, reason: "empty" };
        if (t < sp.cdUntil) return { ok: false, reason: "cd" };
        if (P.en < sp.cost) return { ok: false, reason: "energy" };
        if (P.casting && t < P.casting) return { ok: false, reason: "busy" };
        P.en -= sp.cost; sp.cdUntil = t + sp.cd;
        const A = Number.isFinite(Number(aim)) ? Number(aim) : P.aim;
        P.aim = A; P.dir = A; P.lastCombat = t;
        selfEffects(P, sp);
        run(P, sp, A, t);
        return { ok: true };
    }
    function run(P, sp, A, t) {
        const u = skillUnits(P, sp);
        const pcs = sp.pieces && sp.pieces.length ? sp.pieces : null;
        switch (sp.form) {
            case "projectile": {
                const list = pcs || fanPieces(sp, sp.count);
                list.forEach(pc => {
                    const q = pieceAt(P, A, pc);
                    projs.push({ x: q.x + Math.cos(q.a) * 20, y: q.y + Math.sin(q.a) * 20, vx: Math.cos(q.a) * sp.speed, vy: Math.sin(q.a) * sp.speed, r: sp.radius * (pcs ? q.s : 1), life: sp.range / sp.speed, own: "p", oid: P.eid, units: u, pierce: sp.pierce, hit: new Set(), sk: sp.effects.length ? sp : null, skOwner: P });
                });
                emit(["k", "p", Math.round(P.x), Math.round(P.y), Math.round(A * 100), list.length, 0, 0]);
                break;
            }
            case "laser": {
                const list = pcs || fanPieces(sp, sp.count);
                list.forEach((pc, i) => {
                    const q = pieceAt(P, A, pc), len = sp.length * (pcs ? q.s : 1), w = sp.width * (pcs ? q.s : 1);
                    emit(["k", "l", Math.round(q.x), Math.round(q.y), Math.round(q.a * 100), Math.round(len), Math.round(w), 0]);
                    later(t + 0.12 + i * 0.03, P, () => hitLine(P, q.x, q.y, q.a, len, w, u, sp, now()));
                });
                break;
            }
            case "slash": case "thrust": case "nova": {
                const reps = pcs ? 1 : (sp.form === "nova" ? 1 : Math.min(sp.count, 5));
                const list = pcs || [{ fw: 0, sd: 0, a: 0, s: 1 }];
                for (let r = 0; r < reps; r++) {
                    const at = t + sp.delay + r * 0.2;
                    list.forEach(pc => {
                        const q = pieceAt(P, A, pc), sz = pcs ? q.s : 1;
                        if (r === 0 && sp.form === "thrust" && sp.lunge) { const rr = SW.resolve(P.x + Math.cos(A) * sp.lunge, P.y + Math.sin(A) * sp.lunge, C.PLAYER_R); P.x = rr.x; P.y = rr.y; }
                        const flip = (r % 2) ? -0.35 : 0.35;
                        emit(["k", sp.form === "nova" ? "n" : sp.form === "thrust" ? "t" : "s", Math.round(q.x), Math.round(q.y), Math.round((q.a + (sp.form === "slash" ? flip : 0)) * 100), Math.round((sp.form === "thrust" ? sp.length : sp.radius) * sz), Math.round(sp.form === "slash" ? sp.arc * 100 : sp.width * sz), Math.round(sp.delay * 100)]);
                        later(at, P, () => {
                            const tt = now();
                            if (sp.form === "nova") hitCircle(P, q.x, q.y, sp.radius * sz, u, sp, tt);
                            else if (sp.form === "thrust") hitLine(P, q.x, q.y, q.a, sp.length * sz, sp.width * sz, u, sp, tt);
                            else hitSector(P, q.x, q.y, q.a, sp.radius * sz, sp.arc, u, sp, tt);
                        });
                    });
                }
                break;
            }
            case "meteor": {
                const n = pcs ? pcs.length : sp.count;
                let tx = P.x + Math.cos(A) * 260, ty = P.y + Math.sin(A) * 260;
                if (!pcs) { let best = null, bd = 560; foesOf(P, t).forEach(f => { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd && Math.abs(Math.atan2(f.y - P.y, f.x - P.x) - A) < 1.2) { bd = d; best = f; } }); if (best) { tx = best.x; ty = best.y; } }
                for (let i = 0; i < n; i++) {
                    let x, y, sz = 1;
                    if (pcs) { const q = pieceAt(P, A, pcs[i]); x = q.x; y = q.y; sz = q.s; }
                    else { const an = i * 2.4, rr = i === 0 ? 0 : 70 + i * 22; x = tx + Math.cos(an) * rr; y = ty + Math.sin(an) * rr; }
                    const at = t + sp.delay + i * sp.stagger;
                    emit(["k", "m", Math.round(x), Math.round(y), 0, Math.round(sp.radius * sz), Math.round((sp.delay + i * sp.stagger) * 100), 0]);
                    later(at, P, () => hitCircle(P, x, y, sp.radius * sz, u, sp, now()));
                }
                break;
            }
            case "orbit": case "summon": {
                const orbs = sp.form === "summon" ? clamp(sp.count, 1, 6) : sp.orbs, dur = sp.dur;
                const per = sp.form === "summon" ? u * 0.9 : u * 0.5, every = sp.form === "summon" ? sp.atkCd : sp.tick;
                emit(["k", sp.form === "summon" ? "u" : "o", Math.round(P.x), Math.round(P.y), 0, Math.round(sp.orbitR), Math.round(dur * 100), orbs]);
                P.orbitUntil = t + dur;
                for (let k = 1; k * every <= dur; k++) {
                    later(t + k * every, P, () => {
                        if (!alive(P)) return;
                        const tt = now();
                        if (sp.form === "orbit") hitCircle(P, P.x, P.y, sp.orbitR + 22, per * (orbs / 2), sp, tt);
                        else {                                              // ミニオン：近くの敵を1体ずつ殴る
                            const foes = foesOf(P, tt).filter(f => Math.hypot(f.x - P.x, f.y - P.y) < 380).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y));
                            for (let j = 0; j < orbs && j < foes.length; j++) hurt(P, foes[j], per, sp, P);
                        }
                    });
                }
                break;
            }
            case "flash": {
                const list = pcs || [{ fw: 0, sd: 0, a: 0, s: 1 }];
                const reps = pcs ? list.length : sp.count;
                P.invuln = Math.max(P.invuln || 0, t + 0.45 + reps * 0.15);
                for (let i = 0; i < reps; i++) {
                    const pc = list[i % list.length], at = t + sp.delay * 0.4 + i * 0.16;
                    later(at, P, () => {
                        if (!alive(P)) return;
                        const a = A + pc.a * Math.PI / 180, d = sp.dist * (pcs ? pc.s : 1);
                        const sx = P.x, sy = P.y, r = SW.resolve(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, C.PLAYER_R);
                        const ex = r.x, ey = r.y, len = Math.hypot(ex - sx, ey - sy);
                        P.x = ex; P.y = ey;
                        emit(["k", "f", Math.round(sx), Math.round(sy), Math.round(Math.atan2(ey - sy, ex - sx) * 100), Math.round(len), Math.round(sp.width), 0]);
                        hitLine(P, sx, sy, Math.atan2(ey - sy, ex - sx), len, sp.width, u, sp, now());
                    });
                }
                break;
            }
            case "barrage": {
                let tg = null, bd = 760;
                foesOf(P, t).forEach(f => { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd) { bd = d; tg = f; } });
                const cx = tg ? tg.x : P.x + Math.cos(A) * 300, cy = tg ? tg.y : P.y + Math.sin(A) * 300;
                const n = clamp(sp.bullets, 1, 24), waves = sp.waves;
                emit(["k", "b", Math.round(cx), Math.round(cy), 0, Math.round(sp.ringR), waves, 0]);
                for (let w = 0; w < waves; w++) {
                    later(t + 0.2 + w * 0.15, P, () => {
                        for (let i = 0; i < n; i++) {
                            const an = i / n * 6.2832 + w * 0.3, bx = cx + Math.cos(an) * sp.ringR, by = cy + Math.sin(an) * sp.ringR, da = an + Math.PI;
                            projs.push({ x: bx, y: by, vx: Math.cos(da) * 540, vy: Math.sin(da) * 540, r: 9, life: sp.ringR / 540 + 0.35, own: "p", oid: P.eid, units: u, pierce: 0, hit: new Set(), sk: null });
                        }
                    });
                }
                break;
            }
            case "domain": {
                const list = pcs || [{ fw: 0, sd: 0, a: 0, s: 1 }];
                list.slice(0, 3).forEach(pc => {
                    const q = pieceAt(P, A, pc), rad = sp.radius * (pcs ? q.s : 1);
                    emit(["k", "d", Math.round(q.x), Math.round(q.y), 0, Math.round(rad), Math.round(sp.dur * 100), 0]);
                    for (let k = 1; k * sp.tick <= sp.dur; k++) {
                        later(t + k * sp.tick, P, () => {
                            const tt = now();
                            hitCircle(P, q.x, q.y, rad, u, sp, tt);
                            if (alive(P) && Math.hypot(P.x - q.x, P.y - q.y) < rad) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.015);
                        });
                    }
                });
                break;
            }
            default: break;
        }
    }

    // ---------- 必殺技 ----------
    function canUlt(P) { return alive(P) && P.ug >= CFG.UG_MAX && !P.ultActive; }
    function ultName(P) { const T = getTypes()[P.wtype]; return P.wmythic ? "神話の必殺技" : ULT[ultKindOf(T)].name; }
    // 神話「不壊」以外の必殺技（不壊は SurvivalManager 側の既存処理）
    function castUlt(P, t) {
        if (!canUlt(P)) return false;
        const T = getTypes()[P.wtype] || getTypes().sword, kind = ultKindOf(T), d = ULT[kind];
        const m = P.wmythic ? 1.5 : 1, u0 = unitPower(P) * (1 + P.wpct) * (T.mult || 1) * m;
        P.ug = 0; P.ultActive = true; P.lastCombat = t; P.ultUntil = t + 3;
        P.invuln = Math.max(P.invuln || 0, t + 0.6);
        const A = P.aim, done = (delay) => later(t + delay, P, () => { P.ultActive = false; });
        const U = (mul) => u0 * mul * skillPowerFor(P.special) * 0.6;
        let last = 0;
        if (kind === "lance") {
            for (let i = 0; i < d.rep; i++) { const at = t + 0.15 + i * d.gap; last = at - t; later(at, P, () => { if (!alive(P)) return; const a = P.aim; emit(["k", "l", Math.round(P.x), Math.round(P.y), Math.round(a * 100), d.len, d.width, 0]); hitLine(P, P.x, P.y, a, d.len, d.width, U(d.mult), null, now()); }); }
        } else if (kind === "quake" || kind === "nova") {
            for (let i = 0; i < d.rep; i++) { const at = t + 0.2 + i * d.gap; last = at - t; const rr = d.radius * (1 + i * 0.12); later(at, P, () => { if (!alive(P)) return; emit(["k", "n", Math.round(P.x), Math.round(P.y), 0, Math.round(rr), 0, 0]); hitCircle(P, P.x, P.y, rr, U(d.mult), null, now()); }); }
        } else if (kind === "volley") {
            for (let i = 0; i < d.n; i++) {
                const at = t + 0.1 + i * d.gap; last = at - t;
                later(at, P, () => { if (!alive(P)) return; const a = P.aim + (Math.random() - 0.5) * 0.5; projs.push({ x: P.x + Math.cos(a) * 20, y: P.y + Math.sin(a) * 20, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: 9, life: 1.1, own: "p", oid: P.eid, units: U(d.mult), pierce: 2, hit: new Set(), sk: null }); });
            }
        } else {
            for (let i = 0; i < d.n; i++) {
                const at = t + 0.1 + i * d.gap; last = at - t; const fl = i % 2 ? -0.5 : 0.5;
                later(at, P, () => { if (!alive(P)) return; const a = P.aim; emit(["k", "s", Math.round(P.x), Math.round(P.y), Math.round((a + fl) * 100), d.radius, Math.round(d.arc * 100), 0]); hitSector(P, P.x, P.y, a, d.radius, d.arc, U(d.mult), null, now()); });
            }
        }
        done(last + 0.35);
        return true;
    }

    // ---------- 神器（R キー）：サバイバルエリアでだけ使える、7つの強力な技 ----------
    function artUnits(P) { return unitPower(P) * 55 * (1 + Math.min(P.special || 0, 3000) / 600); }
    function nearestFoe(P, rng, t) {
        let best = null, bd = rng;
        foesOf(P, t).forEach(f => { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd) { bd = d; best = f; } });
        return best;
    }
    function castArtifact(P, id, defn) {
        const t = now();
        if (!alive(P)) return { ok: false, reason: "dead" };
        if (SW.inSafe(P.x, P.y)) return { ok: false, reason: "safe" };
        if (t < (P.artCd || 0)) return { ok: false, reason: "cd", sec: Math.ceil(P.artCd - t) };
        P.artCd = t + defn.cd; P.lastCombat = t;
        const A = P.aim, u = artUnits(P), E = (arr) => ({ effects: arr, base: 1, dm: 1 });
        const fire = E(["burn", "explosion"]), bolt = E(["stun"]), ice = E(["freeze", "frostbite"]), quake = E(["knockback", "stun"]), voidE = E(["gravity"]);
        if (id === "phoenix") {
            // 超特大の火球：まっすぐ飛び、最初に当たった敵（または最大射程）で大爆発
            const maxLen = 950, c = Math.cos(A), s2 = Math.sin(A); let len = maxLen;
            foesOf(P, t).forEach(f => { const dx = f.x - P.x, dy = f.y - P.y, fw = dx * c + dy * s2, sd = Math.abs(-dx * s2 + dy * c); if (fw > 0 && fw < len && sd < 70 + f.r) len = Math.max(120, fw - 20); });
            const ex = P.x + c * len, ey = P.y + s2 * len, dur = len / 420;
            emit(["k", "fb", Math.round(P.x), Math.round(P.y), Math.round(A * 100), Math.round(len), 60, Math.round(dur * 100)]);
            later(t + dur, P, () => {
                emit(["k", "n", Math.round(ex), Math.round(ey), 0, 430, 1, 0]);
                hitCircle(P, ex, ey, 430, u * 3.6, fire, now());
            });
        } else if (id === "thunder") {
            const f0 = nearestFoe(P, 700, t), cx = f0 ? f0.x : P.x + Math.cos(A) * 380, cy = f0 ? f0.y : P.y + Math.sin(A) * 380;
            for (let i = 0; i < 14; i++) {
                const an = i * 2.4, rr = i === 0 ? 0 : 60 + (i * 29) % 330, x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr;
                emit(["k", "m", Math.round(x), Math.round(y), 1, 120, 20 + i * 8, 0]);
                later(t + 0.2 + i * 0.09, P, () => hitCircle(P, x, y, 120, u * 1.15, bolt, now()));
            }
        } else if (id === "frost") {
            [0, 1].forEach(w => later(t + 0.25 + w * 0.5, P, () => {
                if (!alive(P)) return;
                const rr = 640 + w * 60; emit(["k", "n", Math.round(P.x), Math.round(P.y), 2, rr, 1, 0]);
                hitCircle(P, P.x, P.y, rr, u * 1.7, ice, now());
            }));
        } else if (id === "earth") {
            for (let i = 0; i < 4; i++) later(t + 0.2 + i * 0.32, P, () => {
                if (!alive(P)) return;
                const a = P.aim; emit(["k", "l", Math.round(P.x), Math.round(P.y), Math.round(a * 100), 950, 190, 1]);
                hitLine(P, P.x, P.y, a, 950, 190, u * 1.35, quake, now());
            });
        } else if (id === "void") {
            const f0 = nearestFoe(P, 700, t), cx = f0 ? f0.x : P.x + Math.cos(A) * 520, cy = f0 ? f0.y : P.y + Math.sin(A) * 520;
            emit(["k", "d", Math.round(cx), Math.round(cy), 1, 480, 240, 0]);
            for (let i = 1; i <= 11; i++) later(t + i * 0.2, P, () => {
                foesOf(P, now()).forEach(f => {
                    const d = Math.hypot(f.x - cx, f.y - cy); if (d > 540 || d < 30) return;
                    if (f.m && !f.m.boss) { const k = Math.min(110, d - 20); f.m.x += (cx - f.x) / d * k; f.m.y += (cy - f.y) / d * k; }
                    hurt(P, f, u * 0.28, null, null);
                });
            });
            later(t + 2.5, P, () => { emit(["k", "n", Math.round(cx), Math.round(cy), 3, 400, 1, 0]); hitCircle(P, cx, cy, 400, u * 3.2, voidE, now()); });
        } else if (id === "grail") {
            emit(["k", "n", Math.round(P.x), Math.round(P.y), 4, 800, 1, 0]);
            players.forEach(O => {
                if (O.dead || O.ghost || (O !== P && !Nations.friendly(P, O))) return;
                if (Math.hypot(O.x - P.x, O.y - P.y) > 800) return;
                O.hp = Math.min(O.maxHp, O.hp + O.maxHp * 0.6);
                O.buf.regen = Math.max(O.buf.regen, t + 6); O.barHp = O.maxHp * 0.5; O.barUntil = t + 8;
            });
        } else if (id === "hourglass") {
            emit(["k", "n", Math.round(P.x), Math.round(P.y), 5, 800, 1, 0]);
            foesOf(P, t).forEach(f => {
                if (Math.hypot(f.x - P.x, f.y - P.y) > 800) return;
                if (f.m) { const S = status(f.m); S.stunUntil = Math.max(S.stunUntil || 0, t + (f.m.boss ? 1.5 : 4)); dots.set(f.m.id, f.m); }
            });
            P.buf.haste = t + 6; P.buf.empower = t + 6; P.invuln = Math.max(P.invuln || 0, t + 1);
        }
        return { ok: true };
    }

    // ---------- 集中（ガード） ----------
    function guard(P) {
        const t = now();
        if (!alive(P)) return { ok: false };
        if (t < P.guardCd) return { ok: false, reason: "cd" };
        if (P.en < CFG.GUARD_COST) return { ok: false, reason: "energy" };
        P.en -= CFG.GUARD_COST; P.guardUntil = t + CFG.GUARD_S; P.guardCd = t + CFG.GUARD_S + CFG.GUARD_CD;
        emit(["k", "g", Math.round(P.x), Math.round(P.y), 0, 60, Math.round(CFG.GUARD_S * 100), 0]);
        return { ok: true };
    }
    // 被ダメージの調整：集中中は無効、バリアは肩代わり、鉄壁は軽減。戻り値は通すダメージ
    function absorb(O, dmg, t) {
        if (t < O.guardUntil) return 0;
        if (O.barHp > 0 && t < O.barUntil) { const a = Math.min(O.barHp, dmg); O.barHp -= a; dmg -= a; }
        if (O.buf && O.buf.fortify > t) dmg *= 0.7;
        return dmg;
    }

    // ---------- 毎tick ----------
    function tick(t, dt) {
        for (let i = acts.length - 1; i >= 0; i--) {
            const a = acts[i];
            if (a.t > t) continue;
            acts.splice(i, 1);
            try { if (!a.o || players.has(a.o.sid)) a.fn(); } catch (e) { /* 1つの失敗で全体を止めない */ }
        }
        players.forEach(P => {
            if (P.dead || P.ghost) return;
            P.en = Math.min(P.enMax, P.en + CFG.EN_REGEN * dt);
            if (P.buf && P.buf.regen > t) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.03 * dt);
            if (P.ultActive && t > P.ultUntil) P.ultActive = false;
        });
        // 敵の状態（継続ダメージ）
        dots.forEach((M, id) => {
            const S = M.s;
            if (!S || M.dead || !monsters.has(id)) { dots.delete(id); return; }
            if (t < (S.nextDot || 0)) return;
            S.nextDot = t + 0.5;
            let any = false;
            ["burn", "poison"].forEach(k => {
                const d = S[k]; if (!d) return;
                if (t > d.until) { S[k] = null; return; }
                any = true;
                if (S.so) { damageMonster(M, d.dps * 0.5, S.so); }
            });
            if (!any && t > (S.slowUntil || 0) && t > (S.stunUntil || 0) && t > (S.weakUntil || 0)) dots.delete(id);
        });
    }
    // 敵のAIを動かす：麻痺で止まり、凍結で遅くなり、弱体で攻撃が弱くなる
    function runAI(M, dt, t, ai) {
        const S = M.s;
        if (!S) { ai(M, dt, t); return; }
        if (t < (S.stunUntil || 0)) return;
        const sp = M.spd, dm = M.dmg;
        if (t < (S.slowUntil || 0)) M.spd = sp * 0.5;
        if (t < (S.weakUntil || 0)) M.dmg = dm * 0.7;
        ai(M, dt, t);
        M.spd = sp; M.dmg = dm;
    }
    // 弾が当たったとき：スキルの効果をかける
    function onProjHit(P, M, b) { if (b.sk && M && !M.dead) applyEffects(P, M, b.sk, b.units, { x: b.x - b.vx * 0.05, y: b.y - b.vy * 0.05 }); }

    // 画面に出す情報
    function meView(P, t) {
        return {
            en: Math.round(P.en), em: P.enMax, ug: Math.round(P.ug), st: P.streak,
            gd: Math.max(0, +(P.guardUntil - t).toFixed(1)), gc: Math.max(0, +(P.guardCd - t).toFixed(1)),
            bar: P.barHp > 0 && t < P.barUntil ? Math.round(P.barHp / P.maxHp * 100) : 0,
            sk: P.slots.map(s => s ? Math.max(0, +(s.cdUntil - t).toFixed(1)) : -1),
            ult: P.ug >= CFG.UG_MAX
        };
    }
    function slotsView(P) { return P.slots.map(s => s ? { n: s.name, f: s.form, c: s.cost, cd: s.cd } : null); }

    return { castArtifact, CFG, initPlayer, quiz, cast, castUlt, canUlt, ultName, guard, absorb, tick, runAI, onProjHit, onDealt, meView, slotsView, cleanSkill, ULT, FORMS };
};
module.exports.cleanSkill = cleanSkill;
module.exports.energyMaxFor = energyMaxFor;
module.exports.skillPowerFor = skillPowerFor;
