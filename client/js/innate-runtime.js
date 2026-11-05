// ============================================================
//  innate-runtime.js — 固有能力（AIが書いたコード）を、安全に動かす実行環境（v2）
// ------------------------------------------------------------
//  ・AIのコードは「隔離したiframe」の中でだけ動く（sandbox="allow-scripts"：親のページ・localStorage・通信・DOM には一切触れない。
//    CSP で通信も禁止）。無限ループしても固まるのはiframeだけ（1.5秒返事が無ければiframeごと捨てる）
//  ・AIのコードにできること（自由度の中身）：
//     - 自分の世界を、自分のコードで作る：変数・配列・オブジェクト・タイマー・自前の召喚体など（ゲームに部品を用意しなくてよい）
//     - 常時スクリプト（passive）：戦闘の間ずっと動き、「敵を倒した」「攻撃を受けた」「スキルキーを押した」「毎フレーム」に反応できる（api.on）
//     - 発動をまたいで覚えておく入れ物（api.store）：魂のストックなど。戦闘が終わると消える
//     - 自由な描画（api.render）：Canvasの命令（線・ベジェ曲線・円・グラデーション・文字…）で好きな絵をその場で描く
//  ・ゲーム本体に影響を出せるのは、決められた「命令」だけ（弾・敵への攻撃・範囲/直線攻撃・状態異常・回復・ダッシュ・文字）。
//    実際にダメージを与えるのはゲーム側。命令も描画命令も全部ゲーム側で検証し、威力の合計（budget）で打ち止めにする
//  ・「どれだけ強いか」はコードでは決まらない（階級tier・制約・習熟度で決まる。action-skills.js）。AIが自由に書けるのは「動き・見た目・仕組み」
//
//  使い方（戦闘エンジン側）：
//    InnateRuntime.setAdapter({ world(), apply(cmd, info), bounds:{w,h}, allowEff(k), error(msg) })
//    InnateRuntime.cast(skill, { ang, params(=compute().params), base, eff })   … スキルを撃つ／常時スクリプトを始める
//    InnateRuntime.event('kill'|'hurt'|'press', data)                           … 戦闘の出来事をコードへ伝える
//    InnateRuntime.update(dt) / InnateRuntime.draw(ctx)                         … 毎フレーム呼ぶ（draw は世界座標の中で）
// ============================================================
(function (root) {
    'use strict';

    // ---------- 隔離環境の中で動くコード（iframe の srcdoc に入る。ここは「信用しない側」）----------
    const GUEST = `
(function () {
    var factories = {}, casts = {}, world = { me: { x: 0, y: 0, hp: 1, maxHp: 1, ang: 0 }, en: [] }, now = 0, out = [], done = [], store = {}, drawOut = [];
    var MAXLIFE_ACTIVE = 12, MAXLIFE_PASSIVE = 7200, EVENTS = ['kill', 'hurt', 'press', 'tick'];
    function post(m) { parent.postMessage(m, '*'); }
    function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
    function str(v, n) { return String(v == null ? '' : v).slice(0, n); }
    function effs(v) { return Array.isArray(v) ? v.slice(0, 3).map(function (x) { return str(x, 16); }) : undefined; }
    function errText(e) { return str(e && e.message ? e.message : e, 120); }

    // 描画：AIの描画コードが呼ぶ ctx は「記録するだけ」の偽物。記録した命令（表示リスト）をゲーム側が検証して、本物のCanvasに描く
    function makeRec() {
        var ops = [], gid = 0, MAX = 800, ctx = {}, cur = {};
        function add(a) { if (ops.length < MAX) ops.push(a); }
        ['save', 'restore', 'beginPath', 'closePath', 'fill', 'stroke'].forEach(function (n) { ctx[n] = function () { add([n]); }; });
        ['translate', 'scale', 'rotate', 'moveTo', 'lineTo', 'rect', 'fillRect', 'strokeRect', 'clearRect', 'quadraticCurveTo', 'bezierCurveTo', 'arcTo'].forEach(function (n) {
            ctx[n] = function () { var a = [n]; for (var i = 0; i < arguments.length && i < 6; i++) a.push(num(arguments[i], 0)); add(a); };
        });
        ctx.arc = function (x, y, r, a0, a1, ccw) { add(['arc', num(x, 0), num(y, 0), num(r, 0), num(a0, 0), num(a1, 6.2832), !!ccw]); };
        ctx.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { add(['ellipse', num(x, 0), num(y, 0), num(rx, 0), num(ry, 0), num(rot, 0), num(a0, 0), num(a1, 6.2832), !!ccw]); };
        ctx.fillText = function (t, x, y) { add(['fillText', str(t, 16), num(x, 0), num(y, 0)]); };
        ctx.strokeText = function (t, x, y) { add(['strokeText', str(t, 16), num(x, 0), num(y, 0)]); };
        ctx.createLinearGradient = function (x0, y0, x1, y1) { var id = ++gid; add(['lg', id, num(x0, 0), num(y0, 0), num(x1, 0), num(y1, 0)]); return { __g: id, addColorStop: function (o, c) { add(['gs', id, num(o, 0), str(c, 40)]); } }; };
        ctx.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { var id = ++gid; add(['rg', id, num(x0, 0), num(y0, 0), num(r0, 0), num(x1, 0), num(y1, 0), num(r1, 0)]); return { __g: id, addColorStop: function (o, c) { add(['gs', id, num(o, 0), str(c, 40)]); } }; };
        ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'lineCap', 'lineJoin', 'font', 'textAlign', 'textBaseline', 'shadowBlur', 'shadowColor', 'globalCompositeOperation'].forEach(function (p) {
            Object.defineProperty(ctx, p, {
                get: function () { return cur[p]; },
                set: function (v) { cur[p] = v; add(['set', p, (v && typeof v === 'object' && v.__g) ? { g: v.__g } : (typeof v === 'number' ? num(v, 0) : str(v, 60))]); }
            });
        });
        return { ctx: ctx, ops: ops };
    }

    function hooks(c) { return c.renders.length > 0 || Object.keys(c.handlers).some(function (k) { return c.handlers[k].length > 0; }); }
    function makeApi(c) {
        var alive = function () { if (c.dead) throw new Error('この発動はもう終わっています'); };
        var push = function (cmd) { alive(); if (c.tokens < 1) return; c.tokens--; cmd.c = c.id; out.push(cmd); };
        return {
            aim: c.ang, rangeMul: c.rangeMul, tier: c.tier, passive: c.passive, store: store,
            me: function () { return { x: world.me.x, y: world.me.y, hp: world.me.hp, maxHp: world.me.maxHp, ang: world.me.ang }; },
            enemies: function () { return world.en.map(function (e) { return { id: e.id, x: e.x, y: e.y, r: e.r, hp: e.hp, maxHp: e.maxHp, boss: !!e.boss }; }); },
            nearest: function (x, y, maxDist) {
                x = num(x, world.me.x); y = num(y, world.me.y); maxDist = num(maxDist, 99999);
                var best = null, bd = maxDist;
                world.en.forEach(function (e) { var d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = { id: e.id, x: e.x, y: e.y, r: e.r, hp: e.hp, maxHp: e.maxHp, boss: !!e.boss }; } });
                return best;
            },
            time: function () { return now - c.t0; },
            rand: function () { return Math.random(); },
            wait: function (sec) {
                alive();
                sec = Math.max(0, Math.min(5, num(sec, 0)));
                return new Promise(function (res) { c.waiters.push({ at: now + sec, res: res }); });
            },
            on: function (name, fn) {
                alive();
                if (EVENTS.indexOf(name) < 0 || typeof fn !== 'function') return;
                if (!c.handlers[name]) c.handlers[name] = [];
                if (c.handlers[name].length < 6) c.handlers[name].push(fn);
            },
            render: function (fn) { alive(); if (typeof fn === 'function' && c.renders.length < 3) c.renders.push(fn); },
            end: function () { finish(c, null); },
            shot: function (o) { o = o || {}; push({ k: 'shot', x: num(o.x, world.me.x), y: num(o.y, world.me.y), angle: num(o.angle, c.ang), speed: num(o.speed, 420), r: num(o.r, 10), life: num(o.life, 1.2), pierce: num(o.pierce, 0), homing: !!o.homing, mult: num(o.mult, 0.5), color: str(o.color || '#8fd3ff', 9), eff: effs(o.eff) }); },
            hit: function (id, mult, o) { push({ k: 'hit', id: (typeof id === 'number' || typeof id === 'string') ? id : null, mult: num(mult, 0.5), eff: effs(o && o.eff) }); },
            area: function (x, y, r, mult, o) { push({ k: 'area', x: num(x, world.me.x), y: num(y, world.me.y), r: num(r, 100), mult: num(mult, 0.5), color: str(o && o.color, 9), eff: effs(o && o.eff) }); },
            line: function (x1, y1, x2, y2, w, mult, o) { push({ k: 'line', x1: num(x1, world.me.x), y1: num(y1, world.me.y), x2: num(x2, world.me.x), y2: num(y2, world.me.y), w: num(w, 24), mult: num(mult, 0.5), color: str(o && o.color, 9), eff: effs(o && o.eff) }); },
            status: function (id, o) { o = o || {}; push({ k: 'status', id: (typeof id === 'number' || typeof id === 'string') ? id : null, stun: num(o.stun, 0), slow: num(o.slow, 0), weaken: num(o.weaken, 0), blind: num(o.blind, 0), curse: num(o.curse, 0) }); },
            heal: function (frac) { push({ k: 'heal', frac: num(frac, 0.05) }); },
            dash: function (dx, dy, dist) { push({ k: 'dash', dx: num(dx, 1), dy: num(dy, 0), dist: num(dist, 120) }); },
            popup: function (text, color) { push({ k: 'popup', text: str(text, 12), color: str(color || '#9df0ff', 9) }); }
        };
    }
    function finish(c, err) {
        if (c.dead) return; c.dead = true; c.waiters = []; c.handlers = {}; c.renders = [];
        done.push({ c: c.id, err: err ? errText(err) : null });
    }
    function safeCall(c, fn, a) {
        try { var r = fn(a); if (r && typeof r.then === 'function') r.then(null, function (e) { finish(c, e); }); }
        catch (e) { finish(c, e); }
    }
    function sizeOk() { try { return JSON.stringify(store).length < 20000; } catch (e) { return false; } }
    function flush(seq) {
        Object.keys(casts).forEach(function (id) {
            var c = casts[id];
            if (c.dead) { delete casts[id]; return; }
            if (!c.main && !c.waiters.length && !hooks(c)) finish(c, null);      // メインの処理が終わり、待ちも反応も描画も無ければ終了
            else if (now - c.t0 > c.life) finish(c, null);
            if (c.dead) delete casts[id];
        });
        if (!sizeOk()) { store = {}; done.push({ c: -1, err: 'ストックが大きすぎたので空にしました' }); }
        var m = { t: 'cmds', seq: seq, cmds: out, done: done, draw: drawOut };
        out = []; done = []; drawOut = [];
        post(m);
    }
    function runRenders(dt) {
        Object.keys(casts).forEach(function (id) {
            var c = casts[id]; if (c.dead || !c.renders.length) return;
            var t0 = Date.now(), rec = makeRec();
            c.renders.forEach(function (fn) { try { fn(rec.ctx, now - c.t0); } catch (e) { c.renders = []; finish(c, e); } });
            c.cost = c.cost * 0.9 + (Date.now() - t0) * 0.1;
            if (c.cost > 10) { c.renders = []; done.push({ c: c.id, err: '描画に時間がかかりすぎたので、描画を止めました' }); }
            else if (rec.ops.length) drawOut.push({ c: c.id, ops: rec.ops });
        });
    }
    function onMsg(ev) {
        if (ev.source !== parent) return;
        var m = ev.data; if (!m || typeof m !== 'object') return;
        if (m.t === 'load') {
            try { factories[m.sid] = new Function('api', '"use strict";return (async function(){' + String(m.code) + '\\n})();'); }
            catch (e) { post({ t: 'err', sid: m.sid, msg: str(e && e.message, 160) }); }
        } else if (m.t === 'cast') {
            var f = factories[m.sid]; if (!f) { post({ t: 'cmds', seq: -1, cmds: [], done: [{ c: m.cid, err: 'コードを読み込めませんでした' }], draw: [] }); return; }
            if (m.w && typeof m.w === 'object') world = m.w;      // 発動した瞬間の敵・自分の位置（最初の tick を待たずに使える）
            var pas = !!m.passive;
            var c = { id: m.cid, ang: num(m.ang, 0), rangeMul: num(m.rangeMul, 1), tier: num(m.tier, 1), passive: pas, t0: now, tokens: pas ? 60 : 160, tokenMax: pas ? 80 : 160, life: pas ? MAXLIFE_PASSIVE : MAXLIFE_ACTIVE, waiters: [], handlers: {}, renders: [], dead: false, main: true, cost: 0 };
            casts[c.id] = c;
            try { f(makeApi(c)).then(function () { c.main = false; }, function (e) { finish(c, e); }); }
            catch (e) { finish(c, e); }
        } else if (m.t === 'event') {
            if (EVENTS.indexOf(m.name) < 0) return;
            Object.keys(casts).forEach(function (id) {
                var c = casts[id]; if (c.dead) return;
                (c.handlers[m.name] || []).slice().forEach(function (fn) { safeCall(c, fn, m.data); });
            });
        } else if (m.t === 'tick') {
            var dt = Math.max(0, Math.min(1, num(m.dt, 0.05)));
            now += dt;
            if (m.w && typeof m.w === 'object') world = m.w;
            Object.keys(casts).forEach(function (id) {
                var c = casts[id], rest = [];
                if (c.passive && c.tokens < c.tokenMax) c.tokens = Math.min(c.tokenMax, c.tokens + 40 * dt);
                c.waiters.forEach(function (w) { if (w.at <= now) w.res(); else rest.push(w); });
                c.waiters = rest;
                (c.handlers.tick || []).slice().forEach(function (fn) { safeCall(c, fn, dt); });
            });
            setTimeout(function () { runRenders(dt); flush(m.seq); }, 0);     // 待ちが明けた処理（Promise）が全部進んでから、描画と命令をまとめて返す
        }
    }
    addEventListener('message', onMsg);
    post({ t: 'ready' });
})();`;

    function srcdocHtml() {
        return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'">' +
            '<script>' + GUEST.replace(/<\/script/gi, '<\\/script') + '<\/script>';
    }

    // ---------- 本物のiframe ----------
    function makeIframeFrame(onMessage) {
        const f = document.createElement('iframe');
        f.setAttribute('sandbox', 'allow-scripts');         // allow-same-origin は付けない（親の localStorage・Cookie・DOM に触れさせない）
        f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
        f.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-10px;top:-10px';
        const handler = (ev) => { if (ev.source === f.contentWindow) onMessage(ev.data); };
        window.addEventListener('message', handler);
        f.srcdoc = srcdocHtml();
        document.body.appendChild(f);
        return {
            post: (m) => { try { f.contentWindow.postMessage(m, '*'); } catch (e) { /* 破棄済み */ } },
            destroy: () => { window.removeEventListener('message', handler); if (f.parentNode) f.parentNode.removeChild(f); }
        };
    }

    // ---------- ホスト側（ゲーム本体）----------
    const LIMITS = { mult: [0.02, 2.5], shotSpeed: [120, 900], shotR: [4, 30], shotLife: [0.2, 3], pierce: 4, areaR: [20, 260], lineLen: 700, lineW: [8, 70], dashMax: 320, healPerCast: 0.25, healPerCmd: 0.12, dashPerCast: 520,
        statusMax: { stun: 3, slow: 5, weaken: 5, blind: 4, curse: 5 }, maxCasts: 8, tickSec: 0.04, watchdogMs: 1500, maxOps: 800, maxOpsTotal: 1600, persistRegenSec: 8 };
    const OK_EFF = /^[a-z_]{2,16}$/;
    const COLOR_OK = /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9., %]{3,40}\)|hsla?\([0-9., %deg]{3,40}\)|[a-zA-Z]{3,20})$/;
    const FONT_OK = /^((bold|italic) )?\d{1,3}px [A-Za-z0-9\- ,"']{1,40}$/;
    const COMPOSITE_OK = ['source-over', 'lighter', 'screen', 'multiply'];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const n0 = (v) => { v = Number(v); return isFinite(v) ? clamp(v, -1e5, 1e5) : 0; };

    // 表示リストを、本物のCanvasに描く。知っている命令だけを、範囲を絞って実行する（それ以外は無視）
    function replay(ctx, ops) {
        let depth = 0, grads = {};
        ctx.save();
        try {
            for (let i = 0; i < ops.length && i < LIMITS.maxOps; i++) {
                const o = ops[i]; if (!Array.isArray(o)) continue;
                switch (o[0]) {
                    case 'save': if (depth < 16) { ctx.save(); depth++; } break;
                    case 'restore': if (depth > 0) { ctx.restore(); depth--; } break;
                    case 'beginPath': case 'closePath': case 'fill': case 'stroke': ctx[o[0]](); break;
                    case 'translate': case 'moveTo': case 'lineTo': ctx[o[0]](n0(o[1]), n0(o[2])); break;
                    case 'scale': ctx.scale(clamp(n0(o[1]), -50, 50), clamp(n0(o[2]), -50, 50)); break;
                    case 'rotate': ctx.rotate(n0(o[1])); break;
                    case 'rect': case 'fillRect': case 'strokeRect': case 'clearRect': if (o[0] !== 'clearRect') ctx[o[0]](n0(o[1]), n0(o[2]), n0(o[3]), n0(o[4])); break;
                    case 'quadraticCurveTo': ctx.quadraticCurveTo(n0(o[1]), n0(o[2]), n0(o[3]), n0(o[4])); break;
                    case 'bezierCurveTo': ctx.bezierCurveTo(n0(o[1]), n0(o[2]), n0(o[3]), n0(o[4]), n0(o[5]), n0(o[6])); break;
                    case 'arcTo': ctx.arcTo(n0(o[1]), n0(o[2]), n0(o[3]), n0(o[4]), clamp(n0(o[5]), 0, 1e4)); break;
                    case 'arc': ctx.arc(n0(o[1]), n0(o[2]), clamp(n0(o[3]), 0, 1e4), n0(o[4]), n0(o[5]), !!o[6]); break;
                    case 'ellipse': ctx.ellipse(n0(o[1]), n0(o[2]), clamp(n0(o[3]), 0, 1e4), clamp(n0(o[4]), 0, 1e4), n0(o[5]), n0(o[6]), n0(o[7]), !!o[8]); break;
                    case 'fillText': case 'strokeText': ctx[o[0]](String(o[1]).slice(0, 16), n0(o[2]), n0(o[3])); break;
                    case 'lg': if (Object.keys(grads).length < 40) grads[o[1]] = ctx.createLinearGradient(n0(o[2]), n0(o[3]), n0(o[4]), n0(o[5])); break;
                    case 'rg': if (Object.keys(grads).length < 40) grads[o[1]] = ctx.createRadialGradient(n0(o[2]), n0(o[3]), clamp(n0(o[4]), 0, 1e4), n0(o[5]), n0(o[6]), clamp(n0(o[7]), 0, 1e4)); break;
                    case 'gs': { const g = grads[o[1]]; if (g && COLOR_OK.test(String(o[3]))) { try { g.addColorStop(clamp(n0(o[2]), 0, 1), String(o[3])); } catch (e) { /* 色が不正 */ } } break; }
                    case 'set': {
                        const p = o[1], v = o[2];
                        if (p === 'fillStyle' || p === 'strokeStyle') { if (v && typeof v === 'object') { if (grads[v.g]) ctx[p] = grads[v.g]; } else if (COLOR_OK.test(String(v))) ctx[p] = String(v); }
                        else if (p === 'lineWidth') ctx.lineWidth = clamp(n0(v), 0, 40);
                        else if (p === 'globalAlpha') ctx.globalAlpha = clamp(n0(v), 0, 1);
                        else if (p === 'shadowBlur') ctx.shadowBlur = clamp(n0(v), 0, 40);
                        else if (p === 'shadowColor') { if (COLOR_OK.test(String(v))) ctx.shadowColor = String(v); }
                        else if (p === 'lineCap') { if (['butt', 'round', 'square'].indexOf(v) >= 0) ctx.lineCap = v; }
                        else if (p === 'lineJoin') { if (['bevel', 'round', 'miter'].indexOf(v) >= 0) ctx.lineJoin = v; }
                        else if (p === 'textAlign') { if (['left', 'right', 'center', 'start', 'end'].indexOf(v) >= 0) ctx.textAlign = v; }
                        else if (p === 'textBaseline') { if (['top', 'middle', 'bottom', 'alphabetic'].indexOf(v) >= 0) ctx.textBaseline = v; }
                        else if (p === 'font') { if (FONT_OK.test(String(v))) ctx.font = String(v); }
                        else if (p === 'globalCompositeOperation') { if (COMPOSITE_OK.indexOf(v) >= 0) ctx.globalCompositeOperation = v; }
                        break;
                    }
                    default: break;
                }
            }
        } catch (e) { /* 描画で例外が出ても、ゲームは続ける */ }
        while (depth-- > 0) ctx.restore();
        ctx.restore();
    }

    function createRuntime(opt) {
        opt = opt || {};
        const makeFrame = opt.makeFrame || makeIframeFrame;
        const nowMs = opt.nowMs || (() => Date.now());
        let frame = null, ready = false, queue = [], adapter = null, seq = 0, waitingSince = 0, acc = 0, nextCid = 1, failCount = 0;
        const casts = new Map();          // cid -> info
        const loaded = new Map();         // skillId -> code（読み込み済み）
        const lists = new Map();          // cid -> 最新の表示リスト

        function send(m) { if (!frame) return; if (ready) frame.post(m); else queue.push(m); }
        function ensureFrame() {
            if (frame) return;
            ready = false; queue = []; loaded.clear();
            frame = makeFrame(onGuest);
        }
        function destroy() {
            if (frame) { try { frame.destroy(); } catch (e) { /* ignore */ } }
            frame = null; ready = false; queue = []; loaded.clear(); waitingSince = 0; lists.clear();
        }
        function fail(msg) {
            const n = casts.size;
            casts.clear(); destroy(); failCount++;
            if (adapter && adapter.error && n) adapter.error(msg);
        }
        function allowedEff(list, info) {
            if (!Array.isArray(list)) return info.eff;
            const out = info.eff.slice();
            list.forEach(k => { if (typeof k === 'string' && OK_EFF.test(k) && (!adapter.allowEff || adapter.allowEff(k)) && out.indexOf(k) < 0 && out.length < 4) out.push(k); });
            return out;
        }
        // 命令1つを検証・補正する。budget（威力の合計）を使い切ったら、それ以降の攻撃は無視する
        function sanitize(c, info) {
            if (!c || typeof c !== 'object') return null;
            const B = (adapter && adapter.bounds) || { w: 4000, h: 3000 };
            const num = (v, d) => (isFinite(Number(v)) ? Number(v) : d);
            const rm = info.rangeMul || 1;
            const mult = clamp(num(c.mult, 0.5), LIMITS.mult[0], LIMITS.mult[1]);
            const spend = (cost) => { if (info.budgetLeft < cost) { info.capped = true; return false; } info.budgetLeft -= cost; return true; };
            switch (c.k) {
                case 'shot': {
                    const pierce = clamp(Math.round(num(c.pierce, 0)), 0, LIMITS.pierce);
                    if (info.shots >= 60 && !info.persistent) return null;
                    if (!spend(mult * (1 + pierce))) return null;
                    info.shots++;
                    return { k: 'shot', x: clamp(num(c.x, 0), 0, B.w), y: clamp(num(c.y, 0), 0, B.h), angle: num(c.angle, 0), speed: clamp(num(c.speed, 420), LIMITS.shotSpeed[0], LIMITS.shotSpeed[1]), r: clamp(num(c.r, 10), LIMITS.shotR[0], LIMITS.shotR[1]) * rm, life: clamp(num(c.life, 1.2), LIMITS.shotLife[0], LIMITS.shotLife[1]), pierce: pierce, homing: !!c.homing, mult: mult, color: /^#[0-9a-fA-F]{3,8}$/.test(c.color || '') ? c.color : '#8fd3ff', eff: allowedEff(c.eff, info) };
                }
                case 'hit':
                    if (c.id == null || !spend(mult)) return null;
                    return { k: 'hit', id: c.id, mult: mult, eff: allowedEff(c.eff, info) };
                case 'area':
                    if (!spend(mult * 3)) return null;
                    return { k: 'area', x: clamp(num(c.x, 0), 0, B.w), y: clamp(num(c.y, 0), 0, B.h), r: clamp(num(c.r, 100), LIMITS.areaR[0], LIMITS.areaR[1]) * rm, mult: mult, eff: allowedEff(c.eff, info) };
                case 'line': {
                    if (!spend(mult * 2.5)) return null;
                    const x1 = clamp(num(c.x1, 0), 0, B.w), y1 = clamp(num(c.y1, 0), 0, B.h);
                    let dx = clamp(num(c.x2, 0), 0, B.w) - x1, dy = clamp(num(c.y2, 0), 0, B.h) - y1;
                    const len = Math.hypot(dx, dy), maxLen = LIMITS.lineLen * rm;
                    if (len > maxLen) { dx *= maxLen / len; dy *= maxLen / len; }
                    return { k: 'line', x1: x1, y1: y1, x2: x1 + dx, y2: y1 + dy, w: clamp(num(c.w, 24), LIMITS.lineW[0], LIMITS.lineW[1]) * rm, mult: mult, eff: allowedEff(c.eff, info) };
                }
                case 'status': {
                    if (c.id == null) return null;
                    const S = LIMITS.statusMax, o = { k: 'status', id: c.id };
                    let any = 0;
                    Object.keys(S).forEach(k => { o[k] = clamp(num(c[k], 0), 0, S[k]); if (o[k] > 0) any += o[k] / S[k]; });
                    if (!any || !spend(0.15 + 0.25 * any)) return null;       // 長く強く縛るほど、予算を食う
                    return o;
                }
                case 'heal': {
                    const f = clamp(num(c.frac, 0.05), 0, LIMITS.healPerCmd), room = LIMITS.healPerCast - info.healed;
                    if (room <= 0 || f <= 0) return null;
                    const g = Math.min(f, room); info.healed += g;
                    return { k: 'heal', frac: g };
                }
                case 'dash': {
                    let dx = num(c.dx, 1), dy = num(c.dy, 0); const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
                    const dist = Math.min(clamp(num(c.dist, 120), 0, LIMITS.dashMax) * rm, LIMITS.dashPerCast - info.dashed);
                    if (dist <= 0) return null;
                    info.dashed += dist;
                    return { k: 'dash', dx: dx, dy: dy, dist: dist };
                }
                case 'popup':
                    return { k: 'popup', text: String(c.text || '').slice(0, 12), color: /^#[0-9a-fA-F]{3,8}$/.test(c.color || '') ? c.color : '#9df0ff' };
                default: return null;
            }
        }
        function onGuest(m) {
            if (!m || typeof m !== 'object') return;
            if (m.t === 'ready') { ready = true; const q = queue; queue = []; q.forEach(x => frame && frame.post(x)); return; }
            if (m.t === 'err') { if (adapter && adapter.error) adapter.error('固有能力のコードにエラー：' + String(m.msg || '').slice(0, 80)); return; }
            if (m.t === 'cmds') {
                waitingSince = 0;
                (Array.isArray(m.cmds) ? m.cmds : []).slice(0, 400).forEach(raw => {
                    const info = raw && casts.get(raw.c); if (!info) return;
                    const cmd = sanitize(raw, info);
                    if (cmd && adapter && adapter.apply) { try { adapter.apply(cmd, info); } catch (e) { console.warn('[Innate] apply failed', e); } }
                });
                // 表示リスト：発動ごとに最新のものだけ持つ（描画は draw() で毎フレーム行う）
                lists.clear();
                let total = 0;
                (Array.isArray(m.draw) ? m.draw : []).slice(0, LIMITS.maxCasts).forEach(d => {
                    if (!d || !casts.has(d.c) || !Array.isArray(d.ops)) return;
                    const ops = d.ops.slice(0, LIMITS.maxOps); total += ops.length;
                    if (total <= LIMITS.maxOpsTotal) lists.set(d.c, ops);
                });
                (Array.isArray(m.done) ? m.done : []).slice(0, 50).forEach(d => {
                    const info = d && casts.get(d.c);
                    if (d && d.err && adapter && adapter.error) adapter.error('固有能力のコード：' + String(d.err).slice(0, 60));
                    if (!info) return;
                    casts.delete(d.c); lists.delete(d.c);
                });
            }
        }

        return {
            setAdapter(a) { adapter = a; },
            // スキルを発動する／常時スクリプト(passive)を始める。ctx = { ang, params(compute().params), base, eff }
            cast(skill, ctx) {
                if (!adapter || !skill || skill.kind !== 'code' || !skill.code) return null;
                if (failCount >= 4) return null;                  // 何度も固まる・壊れるコードは、そのセッションでは使わない
                if (casts.size >= LIMITS.maxCasts) return null;
                ensureFrame();
                const sid = String(skill.id || 'ia');
                if (loaded.get(sid) !== skill.code) { loaded.set(sid, skill.code); send({ t: 'load', sid: sid, code: skill.code }); }
                const p = (ctx && ctx.params && ctx.params.innate) || { tier: skill.tier || 1, budget: 1.4, rangeMul: 1 };
                const cid = nextCid++, persistent = !!skill.passive;
                const info = { cid: cid, sid: sid, base: (ctx && ctx.base) || 0, eff: ((ctx && ctx.eff) || []).slice(), ang: (ctx && ctx.ang) || 0, budgetMax: p.budget * (persistent ? 1.5 : 1), budgetLeft: p.budget, rangeMul: p.rangeMul || 1, tier: p.tier, params: (ctx && ctx.params) || null, persistent: persistent, shots: 0, healed: 0, dashed: 0, capped: false, skill: skill };
                casts.set(cid, info);
                send({ t: 'cast', cid: cid, sid: sid, ang: info.ang, rangeMul: info.rangeMul, tier: info.tier, passive: persistent, w: adapter.world() });
                return cid;
            },
            // 戦闘の出来事（'kill' 敵を倒した / 'hurt' 攻撃を受けた / 'press' スキルキーを押した）をコードへ伝える
            event(name, data) {
                if (!frame || !casts.size) return;
                if (name !== 'kill' && name !== 'hurt' && name !== 'press') return;
                send({ t: 'event', name: name, data: data && typeof data === 'object' ? data : {} });
            },
            update(dt) {
                if (!frame || !adapter) return;
                if (!casts.size) { acc = 0; return; }
                // 常時スクリプトの攻撃予算は、少しずつ回復する（上限あり）
                casts.forEach(info => { if (info.persistent) info.budgetLeft = Math.min(info.budgetMax, info.budgetLeft + dt * (info.budgetMax / LIMITS.persistRegenSec)); });
                if (waitingSince && nowMs() - waitingSince > LIMITS.watchdogMs) { fail('固有能力のコードが応答しなくなったため停止しました'); return; }
                acc += dt;
                if (waitingSince || acc < LIMITS.tickSec || !ready) return;
                const w = adapter.world();
                send({ t: 'tick', seq: ++seq, dt: acc, w: w });
                acc = 0; waitingSince = nowMs();
            },
            // 描画：世界座標に合わせた Canvas（カメラの平行移動を済ませたもの）に、コードが作った表示リストを描く
            draw(ctx) {
                if (!lists.size || !ctx) return;
                lists.forEach(ops => replay(ctx, ops));
            },
            active() { return casts.size; },
            destroy: destroy,
            _failCount() { return failCount; },
            _lists() { return lists; }
        };
    }

    // ---------- 試し撃ち：確定する前に、コードが動くか・何か起きるかを確かめる ----------
    //  本番と同じ隔離環境で、場面を変えて（敵が多い／いない／敵が倒れる／攻撃を受ける／スキルキーを押す）動かす
    function selfTest(skill, opt) {
        opt = opt || {};
        return new Promise((resolve) => {
            const rt = createRuntime(opt);
            const cmds = []; const errors = [];
            let scene = 0, enemies = [0, 1, 2, 3, 4].map(i => ({ id: 'e' + i, x: 600 + 80 * i, y: 400 + 60 * ((i % 3) - 1), r: 20, hp: 100, maxHp: 100 }));
            let draws = 0;
            rt.setAdapter({
                world: () => ({ me: { x: 400, y: 400, hp: 100, maxHp: 100, ang: 0 }, en: enemies }),
                apply: (c) => { cmds.push(c); }, bounds: { w: 2000, h: 1200 },
                error: (m) => { errors.push(m); }
            });
            const params = (root.ActionSkills && root.ActionSkills.compute) ? root.ActionSkills.compute(skill).params : { innate: { tier: skill.tier || 1, budget: 2, rangeMul: 1 } };
            const cid = rt.cast(skill, { ang: 0, params: params, base: 10, eff: [] });
            if (cid == null) { rt.destroy(); resolve({ ok: false, error: '実行できませんでした', cmds: 0 }); return; }
            let tries = 0;
            const t = setInterval(() => {
                tries++;
                rt.update(0.1);
                // 場面を順番に変える：敵を倒す→攻撃を受ける→スキルキー→敵がいなくなる
                if (tries === 8) rt.event('kill', { id: 'e0', x: 600, y: 400, r: 20, name: '試し撃ちの敵', icon: '👾', color: '#88ccff', maxHp: 100, boss: false });
                if (tries === 12) rt.event('hurt', { amount: 10, frac: 0.1 });
                if (tries === 16) rt.event('press', { slot: 0, ang: 0 });
                if (tries === 24) enemies = [];
                if (tries === 30) rt.event('press', { slot: 0, ang: 0 });
                if (rt._lists().size) draws++;
                if ((rt.active() === 0 && tries > 3) || tries > 200) {
                    clearInterval(t); const stillActive = rt.active() > 0; rt.destroy();
                    const hasAny = cmds.length > 0 || draws > 0 || stillActive;
                    const bad = errors.length > 0 || !hasAny;
                    resolve({ ok: !bad, cmds: cmds.length, draws: draws, error: errors[0] || (!hasAny ? '何も起きないコードでした' : '') });
                }
            }, 20);
        });
    }

    const api = { createRuntime: createRuntime, selfTest: selfTest, LIMITS: LIMITS, GUEST_SOURCE: GUEST, _replay: replay };
    const shared = createRuntime();
    root.InnateRuntime = Object.assign(shared, api);
    if (typeof module !== 'undefined' && module.exports) module.exports = { createRuntime: createRuntime, selfTest: selfTest, LIMITS: LIMITS, GUEST_SOURCE: GUEST, replay: replay };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
