// ============================================================
// アクションバトル エンジン
//  ・WASD/矢印で移動、マウス（またはタッチ）で狙って通常攻撃
//  ・通常攻撃は装備している武器種ごとに違う（斬る／突く／撃つ／溜める…）
//  ・スキルは action-skills.js のモジュール式スキル（投射/レーザー/斬撃/衝撃波）
//  ・スキルはエネルギー消費。エネルギーは画面下のクイズに正解すると溜まる
//  ・敵（ボス含む）も同じスキル定義・同じ実行処理でスキルを使う
//  ・終了時は既存のバトルと同じlocalStorageキーを書いて result.html へ
// ============================================================
(function () {
    'use strict';

    // ---------- バランス調整用の定数 ----------
    const W = 960, H = 540;
    const PLAYER_DMG_SCALE = 0.6;     // プレイヤーの与ダメージ倍率
    const ENEMY_DMG_SCALE = 0.85;     // 敵の与ダメージ倍率
    const ENERGY_MAX = 100;
    const ENERGY_PER_CORRECT = 25;
    const ENERGY_STREAK_BONUS = 10;   // 3問連続正解以降のボーナス
    const WRONG_LOCK_MS = 1500;
    const QUIZ_SUBJECTS = ['math', 'jp', 'eng'];

    // ---------- 武器種ごとの通常攻撃 ----------
    // kind: cone(近接扇形) / line(突き) / proj(弾) / ring(全周)
    const WEAPON_ATTACKS = {
        sword_shield: { label: '斬り',     kind: 'cone', range: 78,  arc: 1.6, mult: 1.0, cd: 0.45, knock: 70 },
        greatsword:   { label: '大振り',   kind: 'cone', range: 112, arc: 2.4, mult: 2.4, cd: 0.95, knock: 200 },
        dual_swords:  { label: '二連斬',   kind: 'cone', range: 64,  arc: 1.5, mult: 0.55, cd: 0.22, knock: 20, double: true },
        katana:       { label: '居合',     kind: 'cone', range: 90,  arc: 1.2, mult: 1.25, cd: 0.42, knock: 40, lunge: 46, crit: 0.25 },
        spear:        { label: '突き',     kind: 'line', range: 158, width: 28, mult: 1.35, cd: 0.55, knock: 70 },
        scythe:       { label: '薙ぎ払い', kind: 'cone', range: 98,  arc: 3.4, mult: 1.1, cd: 0.62, knock: 50, lifesteal: 0.08 },
        pistol:       { label: '射撃',     kind: 'proj', speed: 760, radius: 6,  mult: 0.6, cd: 0.22, range: 720 },
        bow:          { label: '矢',       kind: 'proj', speed: 660, radius: 8,  mult: 1.0, cd: 0.5, range: 780, pierce: 1, charge: true },
        magic_wand:   { label: '魔弾',     kind: 'proj', speed: 300, radius: 12, mult: 1.15, cd: 0.6, range: 620, homing: true, useSpecial: true },
        gloves:       { label: '連打',     kind: 'cone', range: 54,  arc: 1.3, mult: 0.62, cd: 0.17, knock: 15, combo: 3 },
        shoes:        { label: '回し蹴り', kind: 'cone', range: 68,  arc: 2.6, mult: 0.85, cd: 0.3, knock: 90, lunge: 30 },
        esper:        { label: '念動波',   kind: 'ring', radius: 98, mult: 0.95, cd: 0.65, knock: 110, useSpecial: true }
    };
    const DEFAULT_ATTACK = { label: '攻撃', kind: 'cone', range: 56, arc: 1.4, mult: 0.75, cd: 0.36, knock: 30 };

    // ---------- 入力データの読み込み ----------
    function readJSON(key) {
        try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
    }
    const me = readJSON('battlePlayer');
    const enemyRaw = readJSON('enemy');
    if (!me || !enemyRaw) {
        alert('戦闘データが見つかりません。フィールドに戻ります。');
        location.href = 'index.html';
        return;
    }
    const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
    const monsterData = enemyRaw.monsterData || {};

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;
    // 描画の「見える範囲」。通常(full)は戦闘フィールド全体(960x540)をそのまま表示する。
    // スマホ縦向き(cam)では画面が小さくなりすぎるため、拡大して自キャラ付近を追従表示する。
    const view = { mode: 'full', z: 1, dpr: 1, cssW: W, cssH: H, lw: W, lh: H, camX: 0, camY: 0, camInit: false };

    // ---------- ユニット ----------
    const weapon = me.equippedWeapon || null;
    const atkDef = WEAPON_ATTACKS[weapon && weapon.type] || DEFAULT_ATTACK;

    const player = {
        team: 'player', name: me.name || 'あなた',
        x: 170, y: H / 2, r: 16, vx: 0, vy: 0, facing: 0,
        maxHp: Math.max(1, num(me.maxHp, num(me.hp, 100))),
        hp: 0, atk: num(me.atk, 20), def: num(me.def, 10), speed: num(me.speed, 10), special: num(me.special, num(me.atk, 20)),
        status: {}, inv: 0, atkCd: 0, combo: 0, dodgeT: 0, dodgeCd: 0, dodgeDir: 0,
        energy: 0, flash: 0,
        maxStamina: 0, stamina: 0, staminaRegenDelay: 0, guarding: false
    };
    player.hp = Math.min(player.maxHp, num(me.hp, player.maxHp));
    // スタミナは防御力・速さから算出する（ステータスとの連携）。
    // ガード・回避で消費し、使わずにいると自動で回復する。
    player.maxStamina = Math.round(60 + player.def * 1.5 + player.speed * 1.0);
    player.stamina = player.maxStamina;
    const STAMINA_DODGE_COST = 28;
    const STAMINA_GUARD_DRAIN = 22;   // 1秒あたり
    const STAMINA_REGEN = 16;         // 1秒あたり
    const STAMINA_REGEN_DELAY = 0.5;  // 使用直後は少し待ってから回復開始
    const GUARD_DAMAGE_CUT = 0.75;    // ガード中はダメージを75%カット

    const tier = monsterData.isFieldBoss ? 'boss' : (monsterData.isEliteField ? 'elite' : 'normal');
    const enemy = {
        team: 'enemy', name: enemyRaw.name || 'モンスター', icon: monsterData.icon || '👾', tier: tier,
        x: W - 170, y: H / 2, r: Math.max(20, Math.min(48, num(monsterData.size, 30) * 0.9)),
        vx: 0, vy: 0, facing: Math.PI,
        maxHp: Math.max(1, num(enemyRaw.maxHp, num(enemyRaw.hp, 100))), hp: 0,
        atk: num(enemyRaw.atk, 20), def: num(enemyRaw.def, 10), speed: num(enemyRaw.speed, 10), special: num(enemyRaw.special, num(enemyRaw.atk, 20)),
        status: {}, atkCd: 1.0, skillCd: 2.5, state: 'chase', stateT: 0, plan: null, flash: 0
    };
    enemy.hp = Math.min(enemy.maxHp, num(enemyRaw.hp, enemy.maxHp));
    enemy.skills = ActionSkills.enemySkillsFor(monsterData.id || enemyRaw.id || enemyRaw.name, tier).map(s => ActionSkills.compute(s));

    const playerBaseSpeed = 150 + Math.min(70, Math.sqrt(Math.max(0, player.speed)) * 7);
    const enemyRatio = Math.max(0.4, Math.min(tier === 'boss' ? 0.8 : 0.9, 0.55 * Math.sqrt(Math.max(1, enemy.speed) / Math.max(1, player.speed))));
    const enemyBaseSpeed = playerBaseSpeed * (tier === 'boss' ? Math.max(enemyRatio, 0.6) : enemyRatio);

    // ---------- ゲーム状態 ----------
    const entities = [];   // 弾・ビーム・斬撃などの表示/判定
    const popups = [];
    const sparks = [];
    const timers = [];
    let ended = false, shake = 0, time = 0, totalDamage = 0, answered = 0, correctCount = 0, streak = 0;
    let chargeT = 0, charging = false;

    const skillSlots = ActionSkills.loadLoadout().map(s => s ? Object.assign(ActionSkills.compute(s), { cdLeft: 0 }) : null);
    while (skillSlots.length < 4) skillSlots.push(null);

    function after(sec, fn) { timers.push({ t: sec, fn: fn }); }

    // ---------- ユーティリティ ----------
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    function angDiff(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return Math.abs(d);
    }
    function inCone(cx, cy, angle, range, arc, t) {
        const d = Math.hypot(t.x - cx, t.y - cy);
        if (d > range + t.r) return false;
        if (d <= t.r) return true;
        const margin = Math.asin(Math.min(1, t.r / d));
        return angDiff(Math.atan2(t.y - cy, t.x - cx), angle) <= arc / 2 + margin;
    }
    function distToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const l2 = dx * dx + dy * dy;
        let u = l2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / l2;
        u = clamp(u, 0, 1);
        return Math.hypot(px - (x1 + u * dx), py - (y1 + u * dy));
    }
    function foeOf(team) { return team === 'player' ? enemy : player; }

    // ---------- ダメージ処理 ----------
    function calcDamage(att, defTarget, raw) {
        const scale = att.team === 'player' ? PLAYER_DMG_SCALE : ENEMY_DMG_SCALE;
        let def = typeof defTarget === 'number' ? defTarget : defTarget.def;
        if (typeof defTarget === 'object' && defTarget.status && defTarget.status.fortify) def *= (1 + defTarget.status.fortify.amount);
        let atkMult = 1;
        if (att.status) {
            if (att.status.empower) atkMult *= (1 + att.status.empower.amount);
            if (att.status.weaken > 0) atkMult *= 0.65;
        }
        return Math.max(1, Math.round((raw * atkMult * 0.5 - def * 0.1) * scale));
    }
    function skillRaw(att, p) { return (att.special * 0.6 + att.atk * 0.4) * p.baseMult * p.dmgMult; }

    function popup(x, y, text, color, big) {
        popups.push({ x: x, y: y, text: text, color: color || '#fff', life: 0.9, big: !!big });
    }
    function burst(x, y, color, n) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 200;
            sparks.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.3, color: color });
        }
    }

    // target に命中させる。opts: {dmg, knock, effects[], from, lifesteal, crit}
    function applyHit(target, opts) {
        if (ended || target.hp <= 0) return;
        if (target.team === 'player' && (target.inv > 0 || target.dodgeT > 0)) return;

        let dmg = opts.dmg || 0;
        const from = opts.from;
        const effects = opts.effects || [];
        if (effects.indexOf('shatter') !== -1 && dmg > 0) dmg = Math.round(dmg * 1.3); // 防御破砕：防御を無視した分、威力を上乗せ
        if (effects.indexOf('explosion') !== -1 && dmg > 0) dmg += Math.max(2, Math.round(dmg * 0.4)); // 爆発：追加ダメージ
        if (target.team === 'player' && weapon && weapon.type === 'sword_shield') dmg = Math.round(dmg * 0.75);
        if (target.team === 'player' && target.guarding && target.stamina > 0) {
            dmg = Math.max(0, Math.round(dmg * (1 - GUARD_DAMAGE_CUT)));
            popup(target.x, target.y - target.r - 20, 'GUARD', '#9df0ff');
        }
        if (target.team === 'player' && target.status.barrier > 0 && dmg > 0) {
            const absorbed = Math.min(dmg, target.status.barrier);
            target.status.barrier -= absorbed; dmg -= absorbed;
            popup(target.x, target.y - target.r - 28, 'BARRIER-' + absorbed, '#7fc8ff');
            if (target.status.barrier <= 0) delete target.status.barrier;
        }
        const ang = from ? Math.atan2(target.y - from.y, target.x - from.x) : 0;

        if (dmg > 0) {
            target.hp = Math.max(0, target.hp - dmg);
            target.flash = 0.12;
            if (target.team === 'enemy') totalDamage += dmg;
            popup(target.x, target.y - target.r - 6, String(dmg), target.team === 'enemy' ? (opts.crit ? '#ffd54a' : '#fff') : '#ff6b6b', opts.crit);
            burst(target.x, target.y, target.team === 'enemy' ? '#ffe08a' : '#ff8a8a', 6);
            if (target.team === 'player') { shake = 0.25; target.inv = 0.3; }
            else shake = Math.max(shake, 0.08);
        }
        // ノックバック・重力（引き寄せ）
        let knock = opts.knock || 0;
        if (effects.indexOf('knockback') !== -1) knock += 300;
        if (effects.indexOf('gravity') !== -1) knock -= 260; // 重力：負の値＝発動者側へ引き寄せる
        if (knock !== 0) {
            const resist = target.tier === 'boss' ? 0.4 : 1;
            target.vx += Math.cos(ang) * knock * resist;
            target.vy += Math.sin(ang) * knock * resist;
        }
        // 状態異常
        const resistStatus = target.tier === 'boss' ? 0.4 : 1;
        if (effects.indexOf('burn') !== -1) target.status.burn = { t: 3, tick: 0, dps: Math.max(1, dmg * 0.6 / 3) };
        if (effects.indexOf('soulburn') !== -1) target.status.burn = { t: 4, tick: 0, dps: Math.max(2, dmg * 1.1 / 4) };
        if (effects.indexOf('poison') !== -1) target.status.poison = { t: 4, tick: 0, dps: Math.max(1, dmg * 0.45 / 4) };
        if (effects.indexOf('frostbite') !== -1) { target.status.freeze = Math.max(target.status.freeze || 0, 2.2 * resistStatus); target.status.poison = { t: 3, tick: 0, dps: Math.max(1, dmg * 0.3 / 3) }; }
        if (effects.indexOf('freeze') !== -1) target.status.freeze = 2 * resistStatus;
        if (effects.indexOf('weaken') !== -1) target.status.weaken = 3 * resistStatus;
        if (effects.indexOf('blind') !== -1) target.status.blind = 2.5 * resistStatus;
        if (effects.indexOf('stun') !== -1) target.status.stun = (target.team === 'player' ? 0.6 : 1.0) * resistStatus;
        if (effects.indexOf('petrify') !== -1) target.status.stun = Math.max(target.status.stun || 0, (target.team === 'player' ? 0.9 : 1.6) * resistStatus);
        if (effects.indexOf('chronowarp') !== -1) target.status.stun = Math.max(target.status.stun || 0, (target.team === 'player' ? 1.2 : 2.6) * resistStatus);
        if (effects.indexOf('drain') !== -1 && from && dmg > 0) healUnit(from, Math.round(dmg * 0.3));
        if (effects.indexOf('voidrend') !== -1 && from && dmg > 0) healUnit(from, Math.round(dmg * 0.6));
        if (opts.lifesteal && from && dmg > 0) healUnit(from, Math.max(1, Math.round(dmg * opts.lifesteal)));

        if (target.hp <= 0) checkEnd();
    }
    function healUnit(u, amount) {
        if (amount <= 0 || u.hp <= 0) return;
        u.hp = Math.min(u.maxHp, u.hp + amount);
        popup(u.x, u.y - u.r - 6, '+' + amount, '#7CFC9A');
    }
    // 自己強化グリフ（fortify/haste/regenerate/empower/barrier）を発動者自身に適用する
    function applySelfEffect(caster, effectKey) {
        if (effectKey === 'fortify') { caster.status.fortify = { t: 3, amount: 0.4 }; popup(caster.x, caster.y - caster.r - 20, '防御UP', '#9df0ff'); }
        else if (effectKey === 'haste') { caster.status.haste = { t: 3, amount: 0.45 }; popup(caster.x, caster.y - caster.r - 20, '速度UP', '#9df0ff'); }
        else if (effectKey === 'empower') { caster.status.empower = { t: 3, amount: 0.35 }; popup(caster.x, caster.y - caster.r - 20, '攻撃UP', '#ffb347'); }
        else if (effectKey === 'regenerate') { caster.status.regen = { t: 4, tick: 0, amount: Math.max(2, Math.round(caster.maxHp * 0.03)) }; popup(caster.x, caster.y - caster.r - 20, '再生', '#7CFC9A'); }
        else if (effectKey === 'barrier') { caster.status.barrier = (caster.status.barrier || 0) + Math.max(10, Math.round(caster.maxHp * 0.25)); popup(caster.x, caster.y - caster.r - 20, 'バリア', '#7fc8ff'); }
    }

    // ---------- 通常攻撃（武器種別） ----------
    let aimAngle = 0;
    let touchAimActive = false, touchAimAngle = 0; // ブロスタ風ドラッグ照準中の表示用
    function attackMult(a) {
        // 攻撃力（魔法系は特殊）に武器種の倍率を掛ける
        const stat = a.useSpecial ? player.special : player.atk;
        return stat * a.mult;
    }
    function normalHit(target, a, mult, extra) {
        let raw = attackMult(a) * (mult || 1);
        let crit = false;
        const critChance = (a.crit || 0) + 0.06;
        if (Math.random() < critChance) { raw *= 1.5; crit = true; }
        applyHit(target, Object.assign({ dmg: calcDamage(player, target, raw), knock: a.knock, from: player, crit: crit, lifesteal: a.lifesteal }, extra || {}));
    }
    function spawnArcVisual(x, y, angle, range, arc, color, life) {
        entities.push({ type: 'arc', x: x, y: y, angle: angle, range: range, arc: arc, color: color || '#bfe9ff', life: life || 0.18, max: life || 0.18 });
    }

    function doNormalAttack(chargeRatio) {
        if (ended || player.atkCd > 0 || player.status.stun > 0) return;
        const a = atkDef;
        player.atkCd = a.cd;
        const ang = aimAngle;
        player.facing = ang;
        let mult = 1;

        if (a.kind === 'cone') {
            let range = a.range, arc = a.arc;
            if (a.combo) {
                player.combo = (player.combo + 1) % a.combo;
                if (player.combo === 0) { mult = 2.2; range += 18; arc += 0.4; popup(player.x, player.y - 30, 'フィニッシュ!', '#ffd54a'); }
            }
            if (a.lunge) {
                player.x = clamp(player.x + Math.cos(ang) * a.lunge, player.r, W - player.r);
                player.y = clamp(player.y + Math.sin(ang) * a.lunge, player.r, H - player.r);
            }
            const swing = (angle, m) => {
                spawnArcVisual(player.x, player.y, angle, range, arc, '#bfe9ff', 0.18);
                if (inCone(player.x, player.y, angle, range, arc, enemy)) normalHit(enemy, a, m);
            };
            swing(ang, mult);
            if (a.double) after(0.09, () => swing(ang + (Math.random() - 0.5) * 0.3, mult));
        } else if (a.kind === 'line') {
            const x2 = player.x + Math.cos(ang) * a.range, y2 = player.y + Math.sin(ang) * a.range;
            entities.push({ type: 'beam', x: player.x, y: player.y, angle: ang, length: a.range, width: a.width * 0.5, color: '#e6f3ff', life: 0.14, max: 0.14 });
            if (distToSegment(enemy.x, enemy.y, player.x, player.y, x2, y2) <= a.width / 2 + enemy.r) normalHit(enemy, a, mult);
        } else if (a.kind === 'ring') {
            entities.push({ type: 'ring', x: player.x, y: player.y, radius: a.radius, color: '#d9b3ff', life: 0.25, max: 0.25 });
            if (dist(player, enemy) <= a.radius + enemy.r) normalHit(enemy, a, mult);
        } else if (a.kind === 'proj') {
            const ch = chargeRatio || 0;
            const m = a.charge ? 1 + ch * 1.8 : 1;
            const speed = a.speed * (a.charge ? 1 + ch * 0.4 : 1);
            entities.push({
                type: 'proj', team: 'player', x: player.x, y: player.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
                r: a.radius * (a.charge ? 1 + ch * 0.6 : 1), pierce: (a.pierce || 0) + (ch > 0.9 ? 1 : 0), hit: {}, left: a.range,
                color: a.charge ? '#fff2b3' : (a.homing ? '#c9a6ff' : '#ffe08a'), homing: !!a.homing,
                onHit: (t) => normalHit(t, a, m)
            });
        }
    }

    // ---------- スキル発動（プレイヤー・敵 共通） ----------
    // caster: 発動者, comp: ActionSkills.compute() の結果, angle: 狙う向き
    function castSkill(caster, comp, angle) {
        const p = comp.params;
        const foe = foeOf(caster.team);
        const raw = skillRaw(caster, p);
        const hasDamage = p.effects.indexOf('damage') !== -1;
        // 自己強化グリフ（fortify/haste/empower/regenerate/barrier）は発動者自身に即適用し、
        // 残りの対象向け効果だけを命中時の処理（statusEffects）に回す
        p.effects.forEach(e => {
            if (e !== 'damage' && ActionSkills.EFFECTS[e] && ActionSkills.EFFECTS[e].self) applySelfEffect(caster, e);
        });
        const statusEffects = p.effects.filter(e => e !== 'damage' && !(ActionSkills.EFFECTS[e] && ActionSkills.EFFECTS[e].self));
        const hitOn = (t) => {
            const dmg = hasDamage ? calcDamage(caster, t, raw) : 0;
            applyHit(t, { dmg: dmg, effects: statusEffects, from: caster, knock: 40 });
        };
        const currentAngle = (base) => (caster.team === 'player' ? aimAngle : base);

        if (p.form === 'projectile') {
            for (let i = 0; i < p.count; i++) {
                const a = angle + (i - (p.count - 1) / 2) * p.spread;
                entities.push({
                    type: 'proj', team: caster.team, x: caster.x, y: caster.y, vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed,
                    r: p.radius, pierce: p.pierce, hit: {}, left: p.range,
                    color: caster.team === 'player' ? '#8fd3ff' : '#ff7b7b', homing: false, onHit: hitOn
                });
            }
        } else if (p.form === 'laser') {
            for (let i = 0; i < p.count; i++) {
                const a = angle + (i - (p.count - 1) / 2) * p.spread;
                entities.push({ type: 'beam', x: caster.x, y: caster.y, angle: a, length: p.length, width: p.width, color: caster.team === 'player' ? '#9df0ff' : '#ff8fa3', life: p.duration, max: p.duration });
                const x2 = caster.x + Math.cos(a) * p.length, y2 = caster.y + Math.sin(a) * p.length;
                if (distToSegment(foe.x, foe.y, caster.x, caster.y, x2, y2) <= p.width / 2 + foe.r) hitOn(foe);
            }
            shake = Math.max(shake, 0.15);
        } else if (p.form === 'slash') {
            for (let i = 0; i < p.count; i++) {
                after(i * p.delay, () => {
                    if (ended) return;
                    const a = currentAngle(angle) + (i % 2 ? 0.12 : -0.12);
                    entities.push({ type: 'arc', x: caster.x, y: caster.y, angle: a, range: p.radius, arc: p.arc, color: caster.team === 'player' ? '#c6f0ff' : '#ffb0b0', life: 0.26, max: 0.26, glow: true });
                    if (inCone(caster.x, caster.y, a, p.radius, p.arc, foe)) hitOn(foe);
                    shake = Math.max(shake, 0.12);
                });
            }
        } else if (p.form === 'nova') {
            for (let i = 0; i < p.count; i++) {
                after(i * p.delay, () => {
                    if (ended) return;
                    entities.push({ type: 'ring', x: caster.x, y: caster.y, radius: p.radius, color: caster.team === 'player' ? '#ffe6a0' : '#ff9d7a', life: 0.35, max: 0.35 });
                    if (dist(caster, foe) <= p.radius + foe.r) hitOn(foe);
                    shake = Math.max(shake, 0.18);
                });
            }
        } else if (p.form === 'meteor') {
            // 発動した瞬間の相手の位置を狙う。落ちてくるまでに動けば避けられる（敵が使ったときも同じ）
            for (let i = 0; i < p.count; i++) {
                const tx = clamp(foe.x + (i === 0 ? 0 : (Math.random() - 0.5) * p.radius * 1.6), 20, W - 20);
                const ty = clamp(foe.y + (i === 0 ? 0 : (Math.random() - 0.5) * p.radius * 1.6), 20, H - 20);
                const fall = p.delay + i * p.stagger;
                entities.push({ type: 'ring', x: tx, y: ty, radius: p.radius, color: '#ffb070', life: fall, max: fall });   // 着弾予告
                after(fall, () => {
                    if (ended) return;
                    entities.push({ type: 'ring', x: tx, y: ty, radius: p.radius, color: caster.team === 'player' ? '#ffe6a0' : '#ff9d7a', life: 0.35, max: 0.35 });
                    shake = Math.max(shake, 0.2);
                    if (Math.hypot(foe.x - tx, foe.y - ty) <= p.radius + foe.r) hitOn(foe);
                });
            }
        } else if (p.form === 'orbit') {
            entities.push({ type: 'orbit', caster: caster, n: p.orbs, r: p.orbitR, spin: p.spin, ang: 0, tick: 0, tickMax: p.tick,
                color: caster.team === 'player' ? '#9df0ff' : '#ff9d9d', life: p.duration, max: p.duration, onHit: hitOn });
        }
    }

    function trySkill(slot) {
        if (ended || player.status.stun > 0) return;
        const s = skillSlots[slot];
        if (!s || s.cdLeft > 0) return;
        if (player.energy < s.cost) { flashEnergyShort(); return; }
        player.energy -= s.cost;
        s.cdLeft = s.cooldown;
        const ang = aimAngle;
        player.facing = ang;
        popup(player.x, player.y - 34, s.skill.name, '#9df0ff');
        castSkill(player, s, ang);
        updateSkillBar();
        updateEnergyUI();
    }

    // ---------- 敵AI ----------
    function enemyTelegraph(comp, angle) {
        const p = comp.params;
        return { comp: comp, angle: angle, form: p.form };
    }

    function updateEnemy(dt) {
        const e = enemy;
        if (e.hp <= 0) return;
        e.atkCd -= dt; e.skillCd -= dt; e.flash = Math.max(0, e.flash - dt);
        if (e.status.stun > 0) return;

        const slow = e.status.freeze > 0 ? 0.5 : 1;
        const d = dist(e, player);
        const angleToPlayer = angTo(e, player);
        const enraged = e.hp < e.maxHp * 0.5;

        if (e.state === 'chase') {
            e.facing = angleToPlayer;
            const stop = e.r + player.r + 22;
            if (d > stop) {
                e.x += Math.cos(angleToPlayer) * enemyBaseSpeed * slow * dt;
                e.y += Math.sin(angleToPlayer) * enemyBaseSpeed * slow * dt;
            }
            // スキル
            if (e.skills.length && e.skillCd <= 0) {
                const comp = e.skills[Math.floor(Math.random() * e.skills.length)];
                e.state = 'cast';
                e.stateT = (tier === 'boss' ? 0.75 : 0.95) * (enraged ? 0.8 : 1);
                e.plan = enemyTelegraph(comp, angleToPlayer);
                e.plan.total = e.stateT;
            } else if (d <= e.r + player.r + 44 && e.atkCd <= 0) {
                e.state = 'windup';
                e.stateT = 0.45;
                e.plan = { angle: angleToPlayer, total: 0.45 };
            }
        } else if (e.state === 'windup') {
            e.stateT -= dt;
            e.plan.angle = angleToPlayer;
            if (e.stateT <= 0) {
                const reach = e.r + player.r + 64;
                spawnArcVisual(e.x, e.y, e.plan.angle, reach, 1.5, '#ffb0b0', 0.2);
                const blindMiss = e.status.blind > 0 && Math.random() < 0.5;
                if (blindMiss) popup(e.x, e.y - e.r - 16, 'MISS', '#9df0ff');
                if (!blindMiss && dist(e, player) <= reach) {
                    applyHit(player, { dmg: calcDamage(e, player, e.atk * 1.0), knock: 160, from: e });
                }
                e.atkCd = (tier === 'boss' ? 1.0 : 1.3) * (enraged ? 0.8 : 1);
                e.state = 'chase'; e.plan = null;
            }
        } else if (e.state === 'cast') {
            e.stateT -= dt;
            // 弾と衝撃波は最後まで狙い直す。斬撃・レーザーは途中で向きを固定（避けられる）
            if (e.plan.form === 'projectile') e.plan.angle = angleToPlayer;
            else if (e.stateT > e.plan.total * 0.5) e.plan.angle = angleToPlayer;
            e.facing = e.plan.angle;
            if (e.stateT <= 0) {
                castSkill(e, e.plan.comp, e.plan.angle);
                const base = tier === 'boss' ? 2.4 + Math.random() * 1.6 : 3.6 + Math.random() * 2.4;
                e.skillCd = base * (enraged ? 0.75 : 1);
                e.atkCd = Math.max(e.atkCd, 0.6);
                e.state = 'chase'; e.plan = null;
            }
        }
    }

    // ---------- プレイヤー更新 ----------
    const input = { up: false, down: false, left: false, right: false, atk: false, stickX: 0, stickY: 0, mouseX: 0, mouseY: 0, mouseActive: false, mouseAt: 0 };

    function updateAim() {
        if (input.mouseActive && time - input.mouseAt < 4) {
            aimAngle = Math.atan2(input.mouseY - player.y, input.mouseX - player.x);
        } else if (enemy.hp > 0) {
            aimAngle = angTo(player, enemy);
        }
    }

    function updatePlayer(dt) {
        const p = player;
        p.atkCd -= dt; p.inv -= dt; p.dodgeCd -= dt; p.flash = Math.max(0, p.flash - dt);
        if (p.dodgeT > 0) p.dodgeT -= dt;
        updateAim();

        // ガード中はスタミナを消費し続ける。尽きたらガード解除（ガードブレイク）
        if (p.guarding) {
            p.stamina = Math.max(0, p.stamina - STAMINA_GUARD_DRAIN * dt);
            if (p.stamina <= 0) { p.guarding = false; p.staminaRegenDelay = STAMINA_REGEN_DELAY; popup(p.x, p.y - p.r - 20, 'ガード崩壊', '#ff7b7b'); }
        } else if (p.staminaRegenDelay > 0) {
            p.staminaRegenDelay -= dt;
        } else if (p.stamina < p.maxStamina) {
            p.stamina = Math.min(p.maxStamina, p.stamina + STAMINA_REGEN * dt);
        }
        updateStaminaUI();

        let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.stickX;
        let my = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.stickY;
        const ml = Math.hypot(mx, my);
        if (ml > 1) { mx /= ml; my /= ml; }

        if (p.status.stun > 0) { mx = 0; my = 0; }
        const slow = p.status.freeze > 0 ? 0.5 : 1;
        const hasteMult = p.status.haste ? (1 + p.status.haste.amount) : 1;
        let spd = playerBaseSpeed * slow * hasteMult * (charging ? 0.6 : 1) * (p.guarding ? 0.35 : 1);
        if (p.dodgeT > 0) {
            p.x += Math.cos(p.dodgeDir) * 520 * dt;
            p.y += Math.sin(p.dodgeDir) * 520 * dt;
        } else {
            p.x += mx * spd * dt; p.y += my * spd * dt;
        }

        // 攻撃入力（ガード中は攻撃できない）
        if (p.guarding) { /* ガード中は攻撃無効 */ }
        else if (input.atk && atkDef.charge) {
            charging = true; chargeT = Math.min(0.9, chargeT + dt);
            if (chargeT >= 0.9 && p.atkCd <= 0) {   // 溜め切ったら自動で発射
                charging = false; chargeT = 0;
                doNormalAttack(1);
            }
        } else if (atkDef.charge && charging) {
            const ratio = chargeT / 0.9;
            charging = false; chargeT = 0;
            doNormalAttack(ratio);
        } else if (input.atk) {
            doNormalAttack(0);
        }
    }

    // 共通の物理・状態異常更新
    function updateUnit(u, dt) {
        u.x += u.vx * dt; u.y += u.vy * dt;
        const f = Math.exp(-8 * dt);
        u.vx *= f; u.vy *= f;
        u.x = clamp(u.x, u.r, W - u.r); u.y = clamp(u.y, u.r, H - u.r);
        const s = u.status;
        if (s.freeze > 0) s.freeze -= dt;
        if (s.stun > 0) s.stun -= dt;
        if (s.weaken > 0) s.weaken -= dt;
        if (s.blind > 0) s.blind -= dt;
        if (s.fortify) { s.fortify.t -= dt; if (s.fortify.t <= 0) delete s.fortify; }
        if (s.haste) { s.haste.t -= dt; if (s.haste.t <= 0) delete s.haste; }
        if (s.empower) { s.empower.t -= dt; if (s.empower.t <= 0) delete s.empower; }
        const dot = (key, color) => {
            if (!s[key]) return;
            s[key].t -= dt; s[key].tick += dt;
            if (s[key].tick >= 0.5) {
                s[key].tick = 0;
                const d = Math.max(1, Math.round(s[key].dps * 0.5));
                u.hp = Math.max(0, u.hp - d);
                if (u.team === 'enemy') totalDamage += d;
                popup(u.x, u.y - u.r - 4, String(d), color);
                if (u.hp <= 0) checkEnd();
            }
            if (s[key] && s[key].t <= 0) delete s[key];
        };
        dot('burn', '#ff9a3c');
        dot('poison', '#9fd84a');
        if (s.regen) {
            s.regen.t -= dt; s.regen.tick += dt;
            if (s.regen.tick >= 0.5) {
                s.regen.tick = 0;
                healUnit(u, Math.max(1, Math.round(s.regen.amount * 0.5)));
            }
            if (s.regen.t <= 0) delete s.regen;
        }
    }

    // ---------- 弾・演出の更新 ----------
    function updateEntities(dt) {
        for (let i = entities.length - 1; i >= 0; i--) {
            const en = entities[i];
            if (en.type === 'proj') {
                if (en.homing && enemy.hp > 0 && en.team === 'player') {
                    const want = Math.atan2(enemy.y - en.y, enemy.x - en.x);
                    const sp = Math.hypot(en.vx, en.vy);
                    const cur = Math.atan2(en.vy, en.vx);
                    let diff = want - cur;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    const na = cur + clamp(diff, -3.2 * dt, 3.2 * dt);
                    en.vx = Math.cos(na) * sp; en.vy = Math.sin(na) * sp;
                }
                const stepX = en.vx * dt, stepY = en.vy * dt;
                en.x += stepX; en.y += stepY;
                en.left -= Math.hypot(stepX, stepY);
                const target = foeOf(en.team);
                if (!en.hitDone && target.hp > 0 && Math.hypot(target.x - en.x, target.y - en.y) <= target.r + en.r) {
                    en.hitDone = true;            // 同じ弾は同じ相手に1回だけ当たる
                    en.onHit(target);
                    if (!(en.pierce > 0)) en.dead = true;   // 貫通なら通過して飛び続ける
                }
                if (en.left <= 0 || en.x < -30 || en.x > W + 30 || en.y < -30 || en.y > H + 30 || en.dead) entities.splice(i, 1);
            } else if (en.type === 'orbit') {   // 旋回：光球が発動者の周りを回り、触れた相手に tickMax 秒に1回ヒット
                en.life -= dt; en.ang += en.spin * dt; en.tick -= dt;
                const tg = foeOf(en.caster.team);
                if (en.tick <= 0 && tg.hp > 0) {
                    for (let k = 0; k < en.n; k++) {
                        const a = en.ang + k * Math.PI * 2 / en.n;
                        if (Math.hypot(tg.x - (en.caster.x + Math.cos(a) * en.r), tg.y - (en.caster.y + Math.sin(a) * en.r)) <= tg.r + 16) { en.onHit(tg); en.tick = en.tickMax; break; }
                    }
                }
                if (en.life <= 0 || ended) entities.splice(i, 1);
            } else {
                en.life -= dt;
                if (en.life <= 0) entities.splice(i, 1);
            }
        }
        for (let i = popups.length - 1; i >= 0; i--) {
            popups[i].life -= dt; popups[i].y -= 34 * dt;
            if (popups[i].life <= 0) popups.splice(i, 1);
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
            if (s.life <= 0) sparks.splice(i, 1);
        }
        for (let i = timers.length - 1; i >= 0; i--) {
            timers[i].t -= dt;
            if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
        }
    }

    // ---------- 描画 ----------
    function drawGround() {
        ctx.fillStyle = '#1b2233';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y <= H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, W - 4, H - 4);
    }

    function drawTelegraph() {
        const e = enemy;
        if (!e.plan || e.hp <= 0) return;
        const prog = 1 - clamp(e.stateT / (e.plan.total || 1), 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.32 * prog;
        ctx.fillStyle = '#ff3b3b';
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        if (e.state === 'windup') {
            const reach = e.r + player.r + 64;
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, reach, e.plan.angle - 0.75, e.plan.angle + 0.75); ctx.closePath(); ctx.fill();
        } else if (e.state === 'cast') {
            const p = e.plan.comp.params;
            if (p.form === 'slash') {
                ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, p.radius, e.plan.angle - p.arc / 2, e.plan.angle + p.arc / 2); ctx.closePath(); ctx.fill();
            } else if (p.form === 'nova') {
                ctx.beginPath(); ctx.arc(e.x, e.y, p.radius, 0, Math.PI * 2); ctx.fill();
            } else if (p.form === 'laser') {
                for (let i = 0; i < p.count; i++) {
                    const a = e.plan.angle + (i - (p.count - 1) / 2) * p.spread;
                    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
                    ctx.fillRect(0, -p.width / 2, p.length, p.width);
                    ctx.restore();
                }
            } else if (p.form === 'projectile') {
                for (let i = 0; i < p.count; i++) {
                    const a = e.plan.angle + (i - (p.count - 1) / 2) * p.spread;
                    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * 320, e.y + Math.sin(a) * 320); ctx.stroke();
                }
            }
        }
        ctx.restore();
        // スキル名
        if (e.state === 'cast') {
            ctx.fillStyle = '#ffd0d0'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('【' + e.plan.comp.skill.name + '】', e.x, e.y - e.r - 16);
        }
    }

    function drawEntities() {
        entities.forEach(en => {
            const k = clamp(en.life / (en.max || 1), 0, 1);
            ctx.save();
            if (en.type === 'arc') {
                ctx.globalAlpha = 0.75 * k;
                ctx.fillStyle = en.color;
                ctx.beginPath(); ctx.moveTo(en.x, en.y); ctx.arc(en.x, en.y, en.range, en.angle - en.arc / 2, en.angle + en.arc / 2); ctx.closePath(); ctx.fill();
                ctx.globalAlpha = k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(en.x, en.y, en.range, en.angle - en.arc / 2, en.angle + en.arc / 2); ctx.stroke();
            } else if (en.type === 'ring') {
                const rr = en.radius * (1 - k * 0.6);
                ctx.globalAlpha = 0.6 * k + 0.1; ctx.strokeStyle = en.color; ctx.lineWidth = 8 * k + 2;
                ctx.beginPath(); ctx.arc(en.x, en.y, rr, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 0.25 * k; ctx.fillStyle = en.color;
                ctx.beginPath(); ctx.arc(en.x, en.y, rr, 0, Math.PI * 2); ctx.fill();
            } else if (en.type === 'orbit') {
                ctx.globalAlpha = 1;
                for (let n = 0; n < en.n; n++) {
                    const a = en.ang + n * Math.PI * 2 / en.n, ox = en.caster.x + Math.cos(a) * en.r, oy = en.caster.y + Math.sin(a) * en.r;
                    ctx.fillStyle = en.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(ox, oy, 17, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();
                }
            } else if (en.type === 'beam') {
                ctx.translate(en.x, en.y); ctx.rotate(en.angle);
                ctx.globalAlpha = 0.85 * k + 0.1; ctx.fillStyle = en.color;
                ctx.fillRect(0, -en.width / 2, en.length, en.width);
                ctx.globalAlpha = k; ctx.fillStyle = '#fff';
                ctx.fillRect(0, -en.width / 6, en.length, en.width / 3);
            } else if (en.type === 'proj') {
                ctx.fillStyle = en.color; ctx.shadowColor = en.color; ctx.shadowBlur = 14;
                ctx.beginPath(); ctx.arc(en.x, en.y, en.r, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        });
    }

    function drawUnit(u, isPlayer) {
        ctx.save();
        // 影
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(u.x, u.y + u.r * 0.8, u.r, u.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        if (isPlayer && u.dodgeT > 0) ctx.globalAlpha = 0.45;
        if (isPlayer && u.inv > 0 && Math.floor(time * 20) % 2 === 0) ctx.globalAlpha = 0.5;
        ctx.fillStyle = u.flash > 0 ? '#ffffff' : (isPlayer ? '#3d8bff' : (u.tier === 'boss' ? '#8e2a2a' : (u.tier === 'elite' ? '#8a6d1a' : '#3d6b3d')));
        ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = u.status.burn ? '#ff9a3c' : (u.status.freeze > 0 ? '#9fe3ff' : (u.status.stun > 0 ? '#ffe14d' : 'rgba(255,255,255,0.7)'));
        ctx.stroke();
        // 向き
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + Math.cos(u.facing) * u.r * 1.25, u.y + Math.sin(u.facing) * u.r * 1.25); ctx.stroke();
        if (!isPlayer) {
            ctx.font = Math.round(u.r * 1.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff'; ctx.fillText(u.icon, u.x, u.y + 1);
        }
        ctx.restore();
    }

    function bar(x, y, w, h, ratio, color, back) {
        ctx.fillStyle = back || 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    }

    function drawHUD() {
        ctx.save();
        const cam = view.mode === 'cam';
        if (cam) ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        const hw = cam ? view.cssW : W;                 // HUDを描く幅
        const barW = cam ? Math.min(150, hw * 0.4) : 260;
        const rm = cam ? 58 : 14;                         // 右端の余白（⚙️ボタンを避ける）
        const ex = cam ? hw - rm - barW : W / 2 + 20;    // 敵HPバーの左端
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (cam ? 12 : 13) + 'px sans-serif';
        ctx.fillText(player.name + '  HP ' + Math.ceil(player.hp) + '/' + player.maxHp, 14, 10);
        bar(14, 28, barW, 14, player.hp / player.maxHp, '#4cd964');
        ctx.fillStyle = '#9df0ff'; ctx.fillText('ENERGY ' + Math.floor(player.energy) + '/' + ENERGY_MAX, 14, 48);
        bar(14, 65, barW, 9, player.energy / ENERGY_MAX, '#39b7ff');
        if (!cam) {
            ctx.fillStyle = '#ddd'; ctx.font = '12px sans-serif';
            ctx.fillText('武器: ' + (weapon ? (weapon.name || '') : '素手') + '（' + atkDef.label + '）', 14, 80);
        }

        ctx.textAlign = cam ? 'right' : 'center';
        ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (cam ? 12 : 14) + 'px sans-serif';
        const badge = enemy.tier === 'boss' ? '⚠️ BOSS ' : (enemy.tier === 'elite' ? '✨ ' : '');
        ctx.fillText(badge + enemy.name + '  HP ' + Math.ceil(enemy.hp) + '/' + enemy.maxHp, cam ? hw - rm : W / 2 + 150, 10);
        bar(ex, 30, barW, 14, enemy.hp / enemy.maxHp, enemy.tier === 'boss' ? '#e0483e' : '#ff7a59');

        if (cam) {
            // 敵が画面の外にいるときは、方向を示す矢印を画面の端に出す
            const sx = (enemy.x - view.camX) * view.z, sy = (enemy.y - view.camY) * view.z;
            const m = 18;
            if (sx < 0 || sx > view.cssW || sy < 0 || sy > view.cssH) {
                const cx = view.cssW / 2, cy = view.cssH / 2;
                const ang = Math.atan2(sy - cy, sx - cx);
                const k = Math.min((view.cssW / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(ang))), (view.cssH / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(ang))));
                ctx.translate(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k);
                ctx.rotate(ang);
                ctx.fillStyle = 'rgba(255,90,90,0.9)';
                ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
                ctx.rotate(-ang);
                ctx.translate(-(cx + Math.cos(ang) * k), -(cy + Math.sin(ang) * k));
            }
            const sc = view.dpr * view.z;
            ctx.setTransform(sc, 0, 0, sc, -view.camX * sc, -view.camY * sc);
        }
        if (charging) {
            ctx.fillStyle = '#ffe08a'; ctx.fillRect(player.x - 20, player.y + player.r + 8, 40 * (chargeT / 0.9), 5);
        }
        ctx.restore();
    }

    function drawPopups() {
        popups.forEach(p => {
            ctx.save();
            ctx.globalAlpha = clamp(p.life / 0.5, 0, 1);
            ctx.font = (p.big ? 'bold 24px' : 'bold 16px') + ' sans-serif';
            ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        });
        sparks.forEach(s => {
            ctx.globalAlpha = clamp(s.life * 3, 0, 1); ctx.fillStyle = s.color;
            ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
        });
        ctx.globalAlpha = 1;
    }

    function updateCamera() {
        if (view.mode !== 'cam') return;
        // 自キャラを中心にしつつ、敵が見えるように敵の方向へ少し寄せる
        const bx = clamp(enemy.x - player.x, -0.4 * view.lw, 0.4 * view.lw);
        const by = clamp(enemy.y - player.y, -0.3 * view.lh, 0.3 * view.lh);
        let tx = view.lw >= W ? (W - view.lw) / 2 : clamp(player.x + bx - view.lw / 2, 0, W - view.lw);
        let ty = view.lh >= H ? (H - view.lh) / 2 : clamp(player.y + by - view.lh / 2, 0, H - view.lh);
        if (!view.camInit) { view.camX = tx; view.camY = ty; view.camInit = true; return; }
        view.camX += (tx - view.camX) * 0.2;
        view.camY += (ty - view.camY) * 0.2;
    }

    function render() {
        updateCamera();
        if (view.mode === 'cam') {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#0b0e14';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.save();
        if (view.mode === 'cam') {
            const sc = view.dpr * view.z;
            ctx.setTransform(sc, 0, 0, sc, -view.camX * sc, -view.camY * sc);
        }
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 30, (Math.random() - 0.5) * shake * 30);
        drawGround();
        drawTelegraph();
        drawUnit(enemy, false);
        drawUnit(player, true);
        drawEntities();
        drawPopups();
        if (touchAimActive) drawAimLine();
        ctx.restore();
        drawHUD();
    }

    function drawAimLine() {
        ctx.save();
        const len = 150;
        const ex = player.x + Math.cos(touchAimAngle) * len, ey = player.y + Math.sin(touchAimAngle) * len;
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ---------- メインループ ----------
    let last = performance.now();
    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!ended) {
            time += dt;
            shake = Math.max(0, shake - dt);
            updatePlayer(dt);
            updateEnemy(dt);
            updateUnit(player, dt);
            updateUnit(enemy, dt);
            updateEntities(dt);
            for (let i = 0; i < skillSlots.length; i++) {
                const s = skillSlots[i];
                if (s && s.cdLeft > 0) s.cdLeft = Math.max(0, s.cdLeft - dt);
            }
            updateSkillBarCooldowns();
        } else {
            updateEntities(dt);
        }
        render();
        requestAnimationFrame(loop);
    }

    // ---------- クイズ（正解でエネルギー獲得） ----------
    const quizEls = {
        subject: document.getElementById('quizSubject'),
        question: document.getElementById('quizQuestion'),
        choices: document.getElementById('quizChoices'),
        streak: document.getElementById('quizStreak')
    };
    let quizPool = null;
    let currentQuiz = null;
    let quizLocked = false;

    function gradeInfo() {
        const g = clamp(parseInt(me.grade, 10) || 1, 1, 12);
        if (g <= 6) return { level: 'elementary', grade: g };
        if (g <= 9) return { level: 'junior_high', grade: g - 6 };
        return { level: 'high_school', grade: g - 9 };
    }
    function buildQuizPool() {
        const pool = {};
        if (typeof QUESTIONS_DATA === 'undefined') return pool;
        const gi = gradeInfo();
        const lv = QUESTIONS_DATA[gi.level];
        const gd = lv && lv[String(gi.grade)];
        if (!gd) return pool;
        QUIZ_SUBJECTS.forEach(s => { if (gd[s] && gd[s].length) pool[s] = gd[s]; });
        return pool;
    }
    const SUBJECT_NAMES = { math: '算数・数学', jp: '国語', eng: '英語' };

    function shuffle(a) {
        const r = a.slice();
        for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
        return r;
    }
    function makeOptions(q, subjectQs) {
        if (q.options && q.options.length === 4) return shuffle(q.options.map(String));
        const ans = String(q.answer);
        const set = new Set([ans]);
        const out = [ans];
        if (ans.trim() !== '' && !isNaN(ans)) {
            const n = parseFloat(ans);
            const isInt = Number.isInteger(n);
            const cand = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 4, 6, 7];
            for (const c of shuffle(cand)) {
                if (out.length >= 4) break;
                const v = isInt ? String(n + c) : String(Math.round((n + c * 0.1) * 100) / 100);
                if (!set.has(v) && !(parseFloat(v) < 0 && n >= 0)) { set.add(v); out.push(v); }
            }
        } else {
            const others = shuffle(subjectQs.map(x => String(x.answer)).filter(x => x !== ans && x.length <= ans.length + 6 && x.length >= Math.max(1, ans.length - 6)));
            for (const o of others) { if (out.length >= 4) break; if (!set.has(o)) { set.add(o); out.push(o); } }
            const anyOthers = shuffle(subjectQs.map(x => String(x.answer)));
            for (const o of anyOthers) { if (out.length >= 4) break; if (!set.has(o)) { set.add(o); out.push(o); } }
        }
        let k = 1;
        while (out.length < 4) { const v = ans + '・' + k++; out.push(v); }
        return shuffle(out);
    }

    function nextQuiz() {
        if (ended) return;
        if (!quizPool) quizPool = buildQuizPool();
        const subjects = Object.keys(quizPool);
        if (!subjects.length) {
            currentQuiz = { question: '3 + 4 = ?', answer: '7', subject: 'math', options: ['7', '6', '8', '12'] };
        } else {
            const subject = subjects[Math.floor(Math.random() * subjects.length)];
            const qs = quizPool[subject];
            const q = qs[Math.floor(Math.random() * qs.length)];
            currentQuiz = { question: q.question, answer: String(q.answer), subject: subject, options: makeOptions(q, qs) };
        }
        quizLocked = false;
        quizEls.subject.textContent = SUBJECT_NAMES[currentQuiz.subject] || '';
        quizEls.question.textContent = currentQuiz.question;
        quizEls.choices.innerHTML = '';
        currentQuiz.options.forEach((opt, i) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'quiz-choice'; b.dataset.value = opt;
            b.textContent = (i + 1) + '. ' + opt;
            // タッチは指を置いた瞬間に回答（スティックを押しながら別の指で素早く答えられる）。clickとの二重実行は防ぐ
            let handledAt = 0;
            b.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse') return;
                e.preventDefault();
                handledAt = performance.now();
                answerQuiz(opt, b);
            });
            b.addEventListener('click', () => { if (performance.now() - handledAt < 700) return; answerQuiz(opt, b); });
            quizEls.choices.appendChild(b);
        });
        quizEls.streak.textContent = streak >= 2 ? streak + '連続正解！' : '';
    }

    function answerQuiz(opt, btn) {
        if (ended || quizLocked || !currentQuiz) return;
        quizLocked = true;
        answered++;
        const buttons = Array.from(quizEls.choices.querySelectorAll('button'));
        if (opt === currentQuiz.answer) {
            correctCount++; streak++;
            btn.classList.add('correct');
            let gain = ENERGY_PER_CORRECT + (streak >= 3 ? ENERGY_STREAK_BONUS : 0);
            const before = player.energy;
            player.energy = Math.min(ENERGY_MAX, player.energy + gain);
            popup(player.x, player.y - 46, '+' + Math.round(player.energy - before) + ' ENERGY', '#7fe3ff');
            updateEnergyUI(); updateSkillBar();
            setTimeout(nextQuiz, 350);
        } else {
            streak = 0;
            btn.classList.add('wrong');
            buttons.forEach(b => { if (b.dataset.value === currentQuiz.answer) b.classList.add('correct'); });
            setTimeout(nextQuiz, WRONG_LOCK_MS);
        }
    }

    // ---------- スキルバー / UI ----------
    const skillBarEl = document.getElementById('skillBar');
    const energyFill = document.getElementById('energyFill');
    const energyText = document.getElementById('energyText');
    const staminaFill = document.getElementById('staminaFill');
    const staminaText = document.getElementById('staminaText');
    const KEYS = ['Z', 'X', 'C', 'V'];

    function buildSkillBar() {
        skillBarEl.innerHTML = '';
        skillSlots.forEach((s, i) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'skill-btn'; b.dataset.slot = String(i);
            if (s) {
                b.innerHTML = '<span class="sk-key">' + KEYS[i] + '</span><span class="sk-icon">' + ActionSkills.FORMS[s.skill.form].icon + '</span>' +
                    '<span class="sk-name">' + s.skill.name + '</span><span class="sk-cost">' + s.cost + '</span><span class="sk-cd"></span>';
                // クリック/タップ発動はbindAimPad（bindInput内）が担当する（ドラッグで狙いを付けられるように）
            } else {
                b.classList.add('empty');
                b.innerHTML = '<span class="sk-key">' + KEYS[i] + '</span><span class="sk-name">未設定</span>';
            }
            skillBarEl.appendChild(b);
        });
        updateSkillBar();
    }
    function updateSkillBar() {
        Array.from(skillBarEl.children).forEach((b, i) => {
            const s = skillSlots[i];
            if (!s) return;
            b.classList.toggle('ready', player.energy >= s.cost && s.cdLeft <= 0);
            b.classList.toggle('short', player.energy < s.cost);
        });
    }
    function updateSkillBarCooldowns() {
        Array.from(skillBarEl.children).forEach((b, i) => {
            const s = skillSlots[i];
            if (!s) return;
            const cd = b.querySelector('.sk-cd');
            if (cd) cd.textContent = s.cdLeft > 0 ? s.cdLeft.toFixed(1) : '';
            const ready = player.energy >= s.cost && s.cdLeft <= 0;
            if (b.classList.contains('ready') !== ready) b.classList.toggle('ready', ready);
        });
    }
    function updateEnergyUI() {
        if (energyFill) energyFill.style.width = (player.energy / ENERGY_MAX * 100) + '%';
        if (energyText) energyText.textContent = Math.floor(player.energy) + ' / ' + ENERGY_MAX;
    }
    function flashEnergyShort() {
        if (!energyFill) return;
        energyFill.parentElement.classList.add('flash');
        setTimeout(() => energyFill.parentElement.classList.remove('flash'), 300);
    }
    function updateStaminaUI() {
        if (staminaFill) staminaFill.style.width = (player.stamina / player.maxStamina * 100) + '%';
        if (staminaText) staminaText.textContent = Math.floor(player.stamina) + ' / ' + player.maxStamina;
        if (staminaFill) staminaFill.parentElement.classList.toggle('guarding', !!player.guarding);
    }
    function flashStaminaShort() {
        if (!staminaFill) return;
        staminaFill.parentElement.classList.add('flash');
        setTimeout(() => staminaFill.parentElement.classList.remove('flash'), 300);
    }

    // ---------- 入力 ----------
    function keyDown(e) {
        const k = e.key;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(k) !== -1) e.preventDefault();
        if (k === 'w' || k === 'W' || k === 'ArrowUp') input.up = true;
        else if (k === 's' || k === 'S' || k === 'ArrowDown') input.down = true;
        else if (k === 'a' || k === 'A' || k === 'ArrowLeft') input.left = true;
        else if (k === 'd' || k === 'D' || k === 'ArrowRight') input.right = true;
        else if (k === ' ') input.atk = true;
        else if (k === 'z' || k === 'Z') trySkill(0);
        else if (k === 'x' || k === 'X') trySkill(1);
        else if (k === 'c' || k === 'C') trySkill(2);
        else if (k === 'v' || k === 'V') trySkill(3);
        else if (k === 'Shift') doDodge();
        else if (k === 'Control') setGuard(true);
        else if (k >= '1' && k <= '4') {
            const btn = quizEls.choices.children[parseInt(k, 10) - 1];
            if (btn) btn.click();
        }
    }
    function keyUp(e) {
        const k = e.key;
        if (k === 'Control') setGuard(false);
        if (k === 'w' || k === 'W' || k === 'ArrowUp') input.up = false;
        else if (k === 's' || k === 'S' || k === 'ArrowDown') input.down = false;
        else if (k === 'a' || k === 'A' || k === 'ArrowLeft') input.left = false;
        else if (k === 'd' || k === 'D' || k === 'ArrowRight') input.right = false;
        else if (k === ' ') input.atk = false;
    }
    function doDodge() {
        if (ended || player.dodgeCd > 0 || player.status.stun > 0 || player.guarding) return;
        if (player.stamina < STAMINA_DODGE_COST) { flashStaminaShort(); return; }
        player.stamina -= STAMINA_DODGE_COST;
        player.staminaRegenDelay = STAMINA_REGEN_DELAY;
        updateStaminaUI();
        let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.stickX;
        let my = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.stickY;
        player.dodgeDir = (mx || my) ? Math.atan2(my, mx) : aimAngle + Math.PI;
        player.dodgeT = 0.2; player.dodgeCd = 0.9;
    }
    function setGuard(on) {
        if (ended) return;
        if (on && (player.status.stun > 0 || player.dodgeT > 0 || player.stamina <= 0)) return;
        player.guarding = on;
        if (!on) player.staminaRegenDelay = Math.max(player.staminaRegenDelay, 0.25);
    }
    // ブロスタ風の「長押し→ドラッグで狙う→離すと発動」操作をボタンに付与する。
    // isChargeFn()がtrueを返す間（弓など）は、離した時にfire(angle, heldMs)の
    // heldMsで溜め時間を渡す。ドラッグ量が一定以上なら自動照準を上書きする。
    function bindAimPad(el, fire, isChargeFn) {
        let pid = null, sx = 0, sy = 0, dragging = false, curAngle = 0, downAt = 0;
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            pid = e.pointerId; sx = e.clientX; sy = e.clientY; dragging = false;
            downAt = time; curAngle = aimAngle; input.mouseActive = false;
            touchAimActive = true; touchAimAngle = curAngle;
            try { el.setPointerCapture(pid); } catch (err) { /* noop */ }
            if (isChargeFn && isChargeFn()) { input.atk = true; charging = true; }
        });
        el.addEventListener('pointermove', (e) => {
            if (e.pointerId !== pid) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.hypot(dx, dy) > 14) {
                dragging = true;
                curAngle = Math.atan2(dy, dx);
                touchAimAngle = curAngle;
            }
        });
        const end = (e) => {
            if (e.pointerId !== pid) return;
            pid = null; touchAimActive = false;
            const heldMs = (time - downAt) * 1000;
            if (isChargeFn && isChargeFn()) { input.atk = false; charging = false; chargeT = 0; }
            fire(dragging ? curAngle : null, heldMs);
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
    }

    function canvasPos(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (view.lw / r.width) + view.camX, y: (e.clientY - r.top) * (view.lh / r.height) + view.camY };
    }

    function bindInput() {
        window.addEventListener('keydown', keyDown);
        window.addEventListener('keyup', keyUp);
        window.addEventListener('blur', () => { input.up = input.down = input.left = input.right = input.atk = false; });

        canvas.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') {
                const p = canvasPos(e);
                input.mouseX = p.x; input.mouseY = p.y; input.mouseActive = true; input.mouseAt = time;
            }
        });
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') {
                const p = canvasPos(e);
                input.mouseX = p.x; input.mouseY = p.y; input.mouseActive = true; input.mouseAt = time;
                input.atk = true;
            }
        });
        window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') input.atk = false; });
        canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); doDodge(); });

        const atkBtn = document.getElementById('attackBtn');
        const dodgeBtn = document.getElementById('dodgeBtn');
        const guardBtn = document.getElementById('guardBtn');
        const press = (el, down, up) => {
            if (!el) return;
            el.addEventListener('pointerdown', (e) => { e.preventDefault(); input.mouseActive = false; down(); });
            ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, up));
        };
        press(dodgeBtn, doDodge, () => {});
        press(guardBtn, () => setGuard(true), () => setGuard(false));

        // ブロスタ風の「ドラッグして狙う」攻撃ボタン：
        // 押したままドラッグするとその方向に照準が出て、離すとその方向に発動。
        // ドラッグせずタップだけした場合は自動照準（一番近い敵）で発動する。
        bindAimPad(atkBtn, (angle, heldMs) => {
            if (angle != null) aimAngle = angle;
            if (atkDef.charge) {
                const ratio = Math.min(1, heldMs / 900);
                doNormalAttack(ratio);
            } else {
                doNormalAttack(0);
            }
        }, () => atkDef.charge);

        // スキルボタン（Z/X/C/V相当）も同様にドラッグで狙いを付けて発動する
        Array.from(skillBarEl.children).forEach((b, i) => {
            bindAimPad(b, (angle) => {
                if (angle != null) aimAngle = angle;
                trySkill(i);
            }, () => false);
        });

        // 仮想ジョイスティック（タッチ用・共通部品）。画面左側を触った所に出る（設定で固定位置にも変更可）
        if (window.Joystick) {
            Joystick.mount({
                // 縦向きはクイズの下（画面の下半分）だけをスティックの反応エリアにして、クイズのタップと干渉しないようにする
                region: () => (window.innerHeight > window.innerWidth) ? { left: 0, top: 0.62, width: 0.5, height: 0.38 } : { left: 0, top: 0.2, width: 0.45, height: 0.8 },
                onChange: (x, y, mag) => {
                    input.stickX = x; input.stickY = y;
                    if (mag > 0) input.mouseActive = false;
                }
            });
        }
    }

    // ---------- 画面フィット＆UI設定 ----------
    // 戦闘フィールド(canvas)は16:9のまま、画面に収まる最大サイズで表示する
    function fitCanvas() {
        const st = canvas.parentElement;
        const sw = st.clientWidth, sh = st.clientHeight;
        if (sw < 10) return;
        const portraitTouch = document.documentElement.classList.contains('touch-ui') && window.innerHeight > window.innerWidth;
        if (portraitTouch) {
            // スマホ縦向き：16:9で全体を映すと小さすぎるので、拡大して自キャラ付近を追従表示する
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const user = (window.UISettings && Number(UISettings.getGlobal('abZoom'))) || 1.3;
            const z = Math.max(sw / W, (sw / 680) * user);       // 少なくともフィールド幅が収まる倍率より大きく
            const cssW = Math.floor(sw);
            // 下の操作エリア(172px)とクイズ欄を引いた残りが、戦闘画面に使える高さ
            const panel = document.querySelector('.panel');
            const panelH = panel ? panel.offsetHeight : 190;
            const ctrl = 172 + 12;
            const room = window.innerHeight - ctrl - panelH - 14;
            const cssH = Math.floor(Math.max(170, Math.min(H * z, room)));
            canvas.style.width = cssW + 'px';
            canvas.style.height = cssH + 'px';
            const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
            if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
            view.mode = 'cam'; view.z = z; view.dpr = dpr; view.cssW = cssW; view.cssH = cssH;
            view.lw = cssW / z; view.lh = cssH / z;
            return;
        }
        if (view.mode !== 'full') {
            view.mode = 'full'; view.z = 1; view.dpr = 1; view.cssW = W; view.cssH = H; view.lw = W; view.lh = H; view.camX = 0; view.camY = 0; view.camInit = false;
            canvas.width = W; canvas.height = H;
        }
        const w = Math.min(sw, sh * 16 / 9);
        canvas.style.width = Math.floor(w) + 'px';
        canvas.style.height = Math.floor(w * 9 / 16) + 'px';
    }

    function setupUISettings() {
        if (!window.UISettings) return;
        UISettings.registerGlobal({ key: 'abZoom', label: '戦闘画面の拡大率（スマホ縦向き）', type: 'range', def: 1.3, min: 0.8, max: 2, step: 0.05, note: '大きくすると自キャラ付近が大きく映り、小さくするとフィールド全体が見えます。' });
        const touch = UISettings.isTouchUI();
        if (touch) {
            const hint = document.querySelector('.hint');
            if (hint) hint.textContent = '左側をドラッグで移動 / 攻撃・スキルは押したままドラッグで狙って、離すと発動（タップだけなら自動照準）';
        }
        UISettings.register({ id: 'ab-gauges', label: 'ゲージ（気力・スタミナ）', selector: '#gauges', anchor: 'bc', canHide: true, canScale: true, canOpacity: true, scaleMin: 0.6, scaleMax: 1.8 });
        UISettings.register({ id: 'ab-quiz', label: 'クイズ欄', selector: '.quiz', anchor: 'bc', canHide: false, canScale: true, canOpacity: true, scaleMin: 0.6, scaleMax: 1.5, note: 'バトルに必須なので、非表示にはできません（小さく・薄くはできます）。' });
        UISettings.register({ id: 'ab-skills', label: 'スキルボタン', selector: '.skill-bar', anchor: 'br', canHide: true, canScale: true, canOpacity: true, scaleMin: 0.6, scaleMax: 1.8 });
        UISettings.register({ id: 'ab-attack', label: '攻撃ボタン', selector: '#attackBtn', anchor: 'br', canHide: false, canScale: true, canOpacity: true, scaleMin: 0.6, scaleMax: 1.8 });
        UISettings.register({ id: 'ab-dodge', label: '回避ボタン', selector: '#dodgeBtn', anchor: 'br', canHide: true, canScale: true, canOpacity: true, scaleMin: 0.6, scaleMax: 1.8 });
        UISettings.register({ id: 'ab-guard', label: 'ガードボタン', selector: '#guardBtn', anchor: 'br', canHide: true, canScale: true, canOpacity: true, scaleMin: 0.6, scaleMax: 1.8 });
        UISettings.register({ id: 'ab-hint', label: '操作ヒント', selector: '.hint', anchor: 'c', canHide: true, canScale: false });
        UISettings.addGearButton({ top: 'max(8px, env(safe-area-inset-top, 0px))', right: 'max(8px, env(safe-area-inset-right, 0px))' });
        UISettings.onChange((id) => { if (id === '_g:touchUI' || id === '_g:abZoom' || id === '*') fitCanvas(); });
    }

    // ---------- 終了処理 ----------
    function checkEnd() {
        if (ended) return;
        if (enemy.hp <= 0) finish(true);
        else if (player.hp <= 0) finish(false);
    }

    function finish(win) {
        if (ended) return;
        ended = true;
        timers.length = 0;
        const overlay = document.getElementById('endOverlay');
        overlay.textContent = win ? '勝利！' : '敗北…';
        overlay.className = 'end-overlay show ' + (win ? 'win' : 'lose');

        localStorage.setItem('battleResult', win ? 'win' : 'lose');
        localStorage.setItem('playerHP', String(Math.max(0, Math.round(player.hp))));
        localStorage.setItem('enemyHP', String(Math.max(0, Math.round(enemy.hp))));
        localStorage.setItem('totalDamage', String(totalDamage));
        localStorage.setItem('battleTurn', String(Math.max(1, answered)));
        localStorage.setItem('criticalCount', '0');

        // オーブの付与自体はresult.js側のapplyBattleRewards()内のrollOrbDrop()
        // （通常の確率抽選）に任せる。ここで別にオーブを作って渡すと、
        // 二重付与や表示と実際の所持オーブの不一致を起こすため行わない。
        // 素材ドロップだけはapplyBattleRewards()がlocalStorageの
        // droppedMaterialを直接読むので、ここで設定する。
        // 地域ボスは探索の目玉報酬として、確率に頼らずtier4オーブを保証する
        // （result.js側のforceOrbTierフックで付与）。
        if (win && enemy && monsterData && typeof generateMonsterDrop === 'function') {
            const drops = generateMonsterDrop(monsterData);
            drops.forEach(d => {
                if (d.type === 'material') localStorage.setItem('droppedMaterial', d.materialId);
            });
            if (monsterData.isFieldBoss) localStorage.setItem('forceOrbTier', 'tier4');
        }
        localStorage.removeItem('rewardsApplied');
        setTimeout(() => { location.href = 'result.html'; }, 1800);
    }

    // ---------- 起動 ----------
    // 起動：どこか1つ（UI設定・ジョイスティック・画面フィットなど）で例外が出ても、
    // クイズとゲームループは必ず始まるようにする（以前は途中で止まって「読み込み中...」のままになった）
    const safe = (name, fn) => { try { fn(); } catch (e) { console.error('[ActionBattle] ' + name + ' failed:', e); } };
    safe('buildSkillBar', buildSkillBar);
    safe('updateEnergyUI', updateEnergyUI);
    safe('updateStaminaUI', updateStaminaUI);
    safe('bindInput', bindInput);
    safe('setupUISettings', setupUISettings);
    safe('fitCanvas', fitCanvas);
    window.addEventListener('resize', () => safe('fitCanvas', fitCanvas));
    window.addEventListener('orientationchange', () => setTimeout(() => safe('fitCanvas', fitCanvas), 250));
    if (typeof ResizeObserver !== 'undefined') {
        safe('ResizeObserver', () => {
            const ro = new ResizeObserver(() => safe('fitCanvas', fitCanvas));
            ro.observe(canvas.parentElement);
            const pn = document.querySelector('.panel');
            if (pn) ro.observe(pn);
        });
    }
    safe('nextQuiz', nextQuiz);
    const introEl = document.getElementById('enemyIntro');
    if (introEl) introEl.textContent =
        (tier === 'boss' ? '⚠️ ボス「' : (tier === 'elite' ? '✨ レア個体「' : '「')) + enemy.name + '」との戦闘！';
    setTimeout(() => { const el = document.getElementById('enemyIntro'); if (el) el.classList.add('hide'); }, 2200);
    requestAnimationFrame((t) => { last = t; loop(t); });
})();
