// ============================================================
// survival-hud.js ― サバイバルエリアの画面UIと入力（ステージ＝無限回廊の画面を、そのまま真似たもの）
//   見た目は lesson.html（ステージ）と同じ HTML と CSS を使う。ここは、その中身を動かすところ
//    ・上のバー：HP／精神力（ENERGY）／必殺ゲージ。右上：ミニマップ。上の中央：拠点の占領ゲージ
//    ・下の中央：クイズ（正解で精神力）。右下：スキル Z X C V、スキップ・集中・必殺・神器・使う
//    ・左下：「あきらめる」の代わりに「町へ戻る」「国」「店」
//    ・入力はステージと同じ：左半分＝移動スティック／右半分＝エイム＆攻撃スティック、PCは WASD・Space・マウス
//  計算はすべてサーバー。ここは表示と、操作を送るだけ
// ============================================================
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ARTI = [['🔥', 'フェニックスの翼'], ['⚡', '雷神の槌'], ['❄️', '氷結の王冠'], ['🌋', '大地の心臓'], ['🌀', '虚空の鏡'], ['🏆', '生命の聖杯'], ['⏳', '時の砂時計']];
    const FORM_ICON = { projectile: '🏹', laser: '🔦', slash: '🌙', nova: '💥', meteor: '☄️', orbit: '🌀', thrust: '🗡️', barrage: '🎯', summon: '👻', domain: '⛩️', flash: '⚡' };
    const KEYS = ['Z', 'X', 'C', 'V'];
    const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const input = { keys: {}, mouseDown: false, aimX: 0, aimY: 0, aimOn: false, stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, aimStick: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, useHeld: false, ultReq: 0 };
    let slots = [null, null, null, null], cm = null, mounted = false, quizOn = true, curQ = null, lock = false, pool = null, bound = false, autoAim = true, holdArt = null, cb = {};
    try { autoAim = localStorage.getItem('sbAutoAim') !== '0'; } catch (e) { /* なし */ }
    if (isTouch && document.documentElement) document.documentElement.classList.add('touch');
    const sock = () => window.socket;
    const emit = (ev, d) => { const s = sock(); if (s && s.connected) s.emit(ev, d || {}, () => {}); };

    // ---------- 表示の小道具（ステージと同じ announce / lootLog） ----------
    let annT = 0;
    function announce(t, ms) { const a = $('announce'); if (!a) return; a.textContent = t; a.classList.add('show'); clearTimeout(annT); annT = setTimeout(() => a.classList.remove('show'), ms || 2200); }
    const feed = [];
    function pushFeed(t) { feed.push(String(t)); if (feed.length > 5) feed.shift(); const b = $('lootLog'); if (b) b.innerHTML = feed.map((x) => '<div>' + esc(x) + '</div>').join(''); }
    const setT = (el, v) => { if (el && el._v !== v) { el._v = v; el.textContent = v; } };
    const setW = (el, p) => { if (el) { const w = Math.max(0, Math.min(100, p)).toFixed(1) + '%'; if (el._w !== w) { el._w = w; el.style.width = w; } } };

    // ---------- クイズ（ステージと同じ。正解で精神力） ----------
    const shuf = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; };
    function gradeInfo() {
        let p = null; try { p = JSON.parse(localStorage.getItem('player') || 'null'); } catch (e) { /* なし */ }
        const g = Math.max(1, Math.min(12, parseInt(p && p.grade, 10) || 1));
        return g <= 6 ? { l: 'elementary', g: g } : (g <= 9 ? { l: 'junior_high', g: g - 6 } : { l: 'high_school', g: g - 9 });
    }
    function buildPool() {
        const out = {}; if (typeof QUESTIONS_DATA === 'undefined') return out;
        const gi = gradeInfo(), lv = QUESTIONS_DATA[gi.l], gd = lv && lv[String(gi.g)]; if (!gd) return out;
        ['math', 'jp', 'eng'].forEach((s) => { if (gd[s] && gd[s].length) out[s] = gd[s]; });
        return out;
    }
    function options(q, qs) {
        if (q.options && q.options.length === 4) return shuf(q.options.map(String));
        const ans = String(q.answer), out = [ans], set = new Set(out);
        if (ans.trim() !== '' && !isNaN(ans)) {
            const n = parseFloat(ans), isInt = Number.isInteger(n);
            for (const c of shuf([1, -1, 2, -2, 10, -10, 3, -3, 5, 4])) { if (out.length >= 4) break; const v = isInt ? String(n + c) : String(Math.round((n + c * 0.1) * 100) / 100); if (!set.has(v)) { set.add(v); out.push(v); } }
        } else { for (const o of shuf(qs.map((x) => String(x.answer)))) { if (out.length >= 4) break; if (!set.has(o)) { set.add(o); out.push(o); } } }
        let k = 1; while (out.length < 4) out.push(ans + '・' + k++);
        return shuf(out);
    }
    function nextQuiz() {
        if (!pool) pool = buildPool();
        const subs = Object.keys(pool);
        if (!subs.length) curQ = { q: '3 + 4 = ?', a: '7', o: ['7', '6', '8', '12'] };
        else { const s = subs[Math.floor(Math.random() * subs.length)], qs = pool[s], q = qs[Math.floor(Math.random() * qs.length)]; curQ = { q: q.question, a: String(q.answer), o: options(q, qs) }; }
        lock = false;
        setT($('quizQ'), curQ.q);
        const box = $('quizC'); if (!box) return; box.innerHTML = '';
        curQ.o.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + '. ' + o; b.dataset.v = o; b.addEventListener('click', () => answer(o, b)); box.appendChild(b); });
    }
    function answer(o, b) {
        if (lock || !curQ) return; lock = true;
        const ok = o === curQ.a;
        emit('survival:quiz', { ok: ok });
        if (ok) { b.classList.add('ok'); setTimeout(nextQuiz, 300); }
        else { b.classList.add('ng'); Array.from($('quizC').children).forEach((x) => { if (x.dataset.v === curQ.a) x.classList.add('ok'); }); setTimeout(nextQuiz, 1300); }
    }
    const quizPick = (i) => { const b = $('quizC') && $('quizC').children[i]; if (b && quizOn) b.click(); };
    function toggleQuiz() { quizOn = !quizOn; const q = $('quiz'); if (q) q.style.display = quizOn ? 'block' : 'none'; }
    const skipQuiz = () => { if (!lock) nextQuiz(); };

    // ---------- 技の発動 ----------
    const aimNow = () => (cb.aim ? cb.aim() : 0);
    function cast(i) { if (!slots[i]) return; emit('survival:skill', { i: i, aim: aimNow() }); }
    function useArt() { emit('survival:art'); }
    function ult() { input.ultReq = performance.now() + 220; }
    function guardOn() { emit('survival:guard'); }

    // ---------- 入力（ステージと同じ） ----------
    function moveVec() {
        const k = input.keys; let x = 0, y = 0;
        if (k.KeyA || k.ArrowLeft) x -= 1; if (k.KeyD || k.ArrowRight) x += 1;
        if (k.KeyW || k.ArrowUp) y -= 1; if (k.KeyS || k.ArrowDown) y += 1;
        x += input.stick.x; y += input.stick.y;
        const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
        return { x: x, y: y };
    }
    // 向き：右スティック → オートエイム（近くの敵） → マウス
    function aimAngle(nearestFoe, pred, last, vw, vh) {
        const as = input.aimStick;
        if (as.id !== null && Math.hypot(as.x, as.y) > 0.2) return Math.atan2(as.y, as.x);
        if (autoAim || isTouch) { const f = nearestFoe(520); if (f) return Math.atan2(f.y - pred.y, f.x - pred.x); }
        if (input.aimOn && !isTouch) return Math.atan2(input.aimY - vh / 2, input.aimX - vw / 2);
        const f2 = nearestFoe(300); if (f2) return Math.atan2(f2.y - pred.y, f2.x - pred.x);
        return last;
    }
    const attacking = () => !!(input.keys.Space || input.mouseDown || input.aimStick.id !== null);
    const using = () => !!(input.keys.KeyE || input.useHeld);
    const ultHeld = () => performance.now() < input.ultReq;

    function bindInput(canvas) {
        if (bound) return; bound = true;
        window.addEventListener('keydown', (e) => {
            if (!mounted || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
            if (e.repeat && e.code === 'Space') return;
            input.keys[e.code] = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') skipQuiz();
            const sk = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3 }[e.code]; if (sk !== undefined) cast(sk);
            if (e.code === 'Tab') { e.preventDefault(); toggleQuiz(); }
            if (e.code === 'KeyB' && !e.repeat) guardOn();
            if (e.code === 'KeyF' && !e.repeat) guardOn();
            if (e.code === 'KeyR' && !e.repeat) { if (holdArt != null) useArt(); else ult(); }          // 神器を持っていれば神器、なければ必殺技
            if (e.code === 'KeyQ' && !e.repeat) ult();
            if (e.code === 'KeyG') { autoAim = !autoAim; try { localStorage.setItem('sbAutoAim', autoAim ? '1' : '0'); } catch (er) { /* なし */ } announce(autoAim ? '🎯 オートエイム ON' : '🎯 オートエイム OFF（マウスで狙う）', 1400); }
            if (/^Digit[1-4]$/.test(e.code)) quizPick(parseInt(e.code.slice(5), 10) - 1);
            if (e.code.indexOf('Arrow') === 0 || e.code === 'Space') e.preventDefault();
        });
        window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
        canvas.addEventListener('mousemove', (e) => { input.aimX = e.clientX; input.aimY = e.clientY; input.aimOn = true; });
        canvas.addEventListener('mousedown', (e) => { if (e.button === 2) { skipQuiz(); return; } input.mouseDown = true; input.aimX = e.clientX; input.aimY = e.clientY; input.aimOn = true; });
        window.addEventListener('mouseup', () => { input.mouseDown = false; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        // タッチ：左半分＝移動スティック／右半分＝エイム＆攻撃スティック
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            const left = e.clientX < window.innerWidth / 2, st = left ? input.stick : input.aimStick;
            if (st.id !== null) return;
            st.id = e.pointerId; st.ox = e.clientX; st.oy = e.clientY; st.x = 0; st.y = 0;
            try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* なし */ }
        });
        canvas.addEventListener('pointermove', (e) => {
            [input.stick, input.aimStick].forEach((st) => {
                if (st.id !== e.pointerId) return;
                let dx = e.clientX - st.ox, dy = e.clientY - st.oy; const l = Math.hypot(dx, dy), m = 56;
                if (l > m) { dx = dx / l * m; dy = dy / l * m; }
                st.x = dx / m; st.y = dy / m;
            });
        });
        const endPtr = (e) => { [input.stick, input.aimStick].forEach((st) => { if (st.id === e.pointerId) { st.id = null; st.x = 0; st.y = 0; } }); };
        canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
        const pd = (id, fn) => { const b = $(id); if (b) b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }); return b; };
        pd('btnDash', skipQuiz); pd('btnUlt', ult); pd('btnArt', useArt); pd('btnGuard', guardOn);
        const u = pd('btnUse', () => { input.useHeld = true; }); if (u) ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => u.addEventListener(ev, () => { input.useHeld = false; }));
        const qt = $('quizToggle'); if (qt) qt.addEventListener('click', toggleQuiz);
        const tp = $('svBtnTown'), na = $('svBtnNation'), sh = $('svBtnShop');
        if (tp) tp.addEventListener('click', () => { if (cb.town) cb.town(); });
        if (na) na.addEventListener('click', () => { if (window.SBNation) SBNation.open(); });
        if (sh) sh.addEventListener('click', () => { if (cb.shop) cb.shop(); });
    }
    // スティックの描画（ステージと同じ）
    function drawSticks(ctx) {
        [input.stick, input.aimStick].forEach((st) => { if (st.id === null) return; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(st.ox, st.oy, 56, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(st.ox + st.x * 56, st.oy + st.y * 56, 24, 0, 7); ctx.fill(); });
    }
    function reset() { Object.keys(input.keys).forEach((k) => { input.keys[k] = false; }); input.mouseDown = false; input.useHeld = false; ['stick', 'aimStick'].forEach((n) => { input[n].id = null; input[n].x = 0; input[n].y = 0; }); }

    // ---------- 画面の更新 ----------
    function buildSkillBar() {
        const box = $('skillBar'); if (!box) return; box.innerHTML = '';
        slots.forEach((s, i) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'skill-btn';
            if (s) b.innerHTML = '<span class="sk-key">' + KEYS[i] + '</span><span class="sk-icon">' + (FORM_ICON[s.f] || '✨') + '</span><span class="sk-name">' + esc(s.n) + '</span><span class="sk-cost">' + s.c + '</span><span class="sk-cd"></span>';
            else { b.classList.add('empty'); b.innerHTML = '<span class="sk-key">' + KEYS[i] + '</span><span class="sk-name">未設定</span>'; }
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); cast(i); });
            box.appendChild(b);
        });
    }
    // info: { stage, wpn, timer, chall:{show,text,pct,col}, canUse, useLabel, hint }
    function update(me, info) {
        if (!mounted) return;
        cm = me.cm || cm; holdArt = me.art ? me.art.id : null;
        setW($('hpFill'), me.mhp ? me.hp / me.mhp * 100 : 0); setT($('hpText'), 'HP ' + Math.max(0, Math.round(me.hp)) + ' / ' + me.mhp);
        if (cm) {
            setW($('enFill'), cm.en / cm.em * 100); setT($('enText'), 'ENERGY ' + cm.en + ' / ' + cm.em + (cm.st >= 2 ? '　🔥' + cm.st + '連続' : ''));
            setW($('progFill'), cm.ug); setT($('prog'), cm.ult ? '⚡ 必殺技 発動可能！ [R / Q]' : '⚡ 必殺 ' + cm.ug + '%');
            const bu = $('btnUlt'); if (bu) { setT(bu, cm.ult ? '⚡' : '⚡' + cm.ug + '%'); bu.style.outline = cm.ult ? '3px solid #ffe08a' : ''; }
            const bg = $('btnGuard'); if (bg) bg.style.opacity = cm.gc > 0 ? '.5' : '';
            const bar = $('skillBar');
            if (bar) Array.from(bar.children).forEach((b, i) => {
                const s = slots[i]; if (!s) return; const cd = cm.sk[i] || 0, c = b.querySelector('.sk-cd');
                if (c) setT(c, cd > 0 ? cd.toFixed(1) : '');
                b.classList.toggle('ready', cm.en >= s.c && cd <= 0); b.classList.toggle('short', cm.en < s.c);
            });
        }
        const ba = $('btnArt'); if (ba) { if (me.art) { const a = ARTI[me.art.id] || ['✨', '神器']; ba.style.display = isTouch ? 'block' : 'none'; setT(ba, a[0] + (me.art.cd > 0 ? Math.ceil(me.art.cd) : '')); ba.style.opacity = me.art.cd > 0 ? '.5' : ''; } else ba.style.display = 'none'; }
        if (info) {
            setT($('stageName'), info.stage || ''); setT($('wpnName'), info.wpn || ''); setT($('timer'), info.timer || '');
            const cbx = $('challengeBar');
            if (cbx) { const show = !!(info.chall && info.chall.show); if (cbx._s !== show) { cbx._s = show; cbx.style.display = show ? 'block' : 'none'; } if (show) { setT($('challengeName'), info.chall.text); const f = $('challengeFill'); if (f) { f.style.width = Math.max(0, Math.min(100, info.chall.pct)).toFixed(0) + '%'; if (info.chall.col) f.style.background = info.chall.col; } } }
            const bu2 = $('btnUse'); if (bu2) { bu2.style.display = isTouch && info.canUse ? 'block' : 'none'; setT(bu2, info.useLabel || '使う'); }
            const hint = document.querySelector('.hint'); if (hint && info.hint != null) setT(hint, info.hint);
        }
    }
    function mount(res, callbacks) {
        cb = callbacks || cb;
        slots = (res && res.combat && res.combat.slots) || [null, null, null, null];
        cm = null; mounted = true; pool = null; quizOn = true;
        const q = $('quiz'); if (q) q.style.display = 'block';
        buildSkillBar(); nextQuiz();
    }
    function unmount() { mounted = false; reset(); }

    // ---------- 出撃準備（武器・持ち込む装備・スキルを選んで、入る） ----------
    function prepare(gatherFn) {
        return new Promise((resolve) => {
            let box = $('svPrep'); if (box) box.remove();
            box = document.createElement('div'); box.id = 'svPrep'; document.body.appendChild(box);
            const H = window.HW;
            const label = (x) => { try { return (H.displayName ? H.displayName(x) : x.name) || '装備'; } catch (e) { return x.name || '装備'; } };
            const col = (x) => { try { return H.rarityOf(x).color; } catch (e) { return '#ddd'; } };
            let skills = []; try { skills = window.ActionSkills ? ActionSkills.loadLoadout() : []; } catch (e) { /* なし */ }
            const draw = () => {
                const d = H.load(), ws = d.weapons || [], gear = gatherFn();
                const eqw = ws.find((x) => x.id === d.equipped);
                box.innerHTML = '<div class="pp"><h3>⚔ 出撃準備</h3>' +
                    '<div class="pc"><b>武器</b><select id="svpW">' + (ws.length ? ws.map((w) => '<option value="' + esc(w.id) + '"' + (w.id === d.equipped ? ' selected' : '') + '>' + esc(label(w)) + (w.locked ? '🔒' : '') + '</option>').join('') : '<option value="">（武器なし：素手）</option>') + '</select>' +
                    '<small>' + (eqw ? (eqw.mythicId || eqw.rarity === 'mythic' ? '神話：持ち込まれず、奪われません' : eqw.locked ? 'ロック中：持ち込まれません' : '倒されると奪われることがあります') : '素手で戦います') + '</small></div>' +
                    '<div class="pc"><b>持ち込む装備</b><small>預けた装備は、PvPで倒されると1つ奪われます。奪われたくない装備はチェックを外します（外した装備は安全）。</small>' +
                    (gear.length ? gear.map((it, i) => '<label class="pg"><input type="checkbox" data-i="' + i + '" checked> <span style="color:' + col(it.data) + '">' + esc(label(it.data)) + '</span> <small>' + ({ weapon: '武器', armor: '防具', acc: 'アクセ' }[it.kind] || '') + '</small></label>').join('') : '<div class="pe">持ち込める装備はありません（ロック中・神話は安全なので持ち込みません）</div>') + '</div>' +
                    '<div class="pc"><b>スキル（Z X C V）</b>' + (skills.length ? skills.slice(0, 4).map((s, i) => '<div class="ps">' + KEYS[i] + '　' + esc(s && s.name || '（空き）') + '</div>').join('') : '<div class="pe">スキルは「ステージ」のスキル工房で作ると、ここで使えます</div>') + '</div>' +
                    '<div class="pc"><b>操作（ステージと同じ）</b><small>移動：WASD／左スティック　攻撃：Space・クリック／右スティック　スキル：Z X C V　必殺・神器：R　集中：B　スキップ：Shift　使う：E　クイズ：1〜4</small></div>' +
                    '<div class="pb"><button type="button" id="svpGo">出撃する</button><button type="button" id="svpNo">やめる</button></div></div>';
                $('svpW').addEventListener('change', (e) => { const dd = H.load(); dd.equipped = e.target.value || null; H.save(dd); draw(); });
                $('svpGo').addEventListener('click', () => { const g = gatherFn(), on = Array.from(box.querySelectorAll('input[type=checkbox]')).filter((c) => c.checked).map((c) => g[Number(c.dataset.i)]).filter(Boolean); box.remove(); resolve(on); });
                $('svpNo').addEventListener('click', () => { box.remove(); resolve(null); });
            };
            ['keydown', 'keyup'].forEach((ev) => box.addEventListener(ev, (e) => e.stopPropagation()));
            draw();
        });
    }

    window.SVHud = { mount: mount, unmount: unmount, update: update, prepare: prepare, bindInput: bindInput, moveVec: moveVec, aimAngle: aimAngle, attacking: attacking, using: using, ultHeld: ultHeld, drawSticks: drawSticks, announce: announce, pushFeed: pushFeed, isTouch: isTouch, input: input, quizOn: () => quizOn };
})();
