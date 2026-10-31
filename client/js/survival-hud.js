// ============================================================
// survival-hud.js ― サバイバルエリアの画面UI（stage.html を参考に作り直し）
//   ・HP / 精神力（エネルギー） / 必殺技ゲージ
//   ・クイズ：正解で精神力がたまる（1〜4キー、タップ）。「スキップ」「しまう」あり
//   ・スキル Z X C V ／ 必殺技 Q ／ 集中（ガード）F ／ 神器 R
//   ・出撃準備：武器・持ち込む装備・スキルを確認してから入る
//  数値の計算はすべてサーバー。ここは表示と操作の送信だけ。スマホの横画面でも使えるよう、小さく畳める
// ============================================================
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const ARTI = [['🔥', 'フェニックスの翼'], ['⚡', '雷神の槌'], ['❄️', '氷結の王冠'], ['🌋', '大地の心臓'], ['🌀', '虚空の鏡'], ['🏆', '生命の聖杯'], ['⏳', '時の砂時計']];
    const FORM_ICON = { projectile: '🏹', laser: '🔦', slash: '🌙', nova: '💥', meteor: '☄️', orbit: '🌀', thrust: '🗡️', barrage: '🎯', summon: '👻', domain: '⛩️', flash: '⚡' };
    const KEYS = ['z', 'x', 'c', 'v'];
    let slots = [null, null, null, null], cm = null, mounted = false, quizOn = true, curQ = null, lock = false, pool = null, ultHeld = false, lastMe = null, enMax = 100;

    const sock = () => window.socket;
    const emit = (ev, d) => { const s = sock(); if (s && s.connected) s.emit(ev, d || {}, () => {}); };
    const sv = () => window.SBSurvival || {};

    // ---------- クイズ ----------
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
            for (const c of shuf([1, -1, 2, -2, 10, -10, 3, -3, 5, 4])) { if (out.length >= 4) break; const v = isInt ? String(n + c) : String(Math.round((n + c) * 100) / 100); if (!set.has(v)) { set.add(v); out.push(v); } }
        } else { for (const o of shuf(qs.map((x) => String(x.answer)))) { if (out.length >= 4) break; if (!set.has(o)) { set.add(o); out.push(o); } } }
        let k = 1; while (out.length < 4) out.push(ans + '・' + k++);
        return shuf(out);
    }
    function nextQuiz() {
        if (!pool) pool = buildPool();
        const subs = Object.keys(pool);
        if (!subs.length) curQ = { q: '3 + 4 = ?', a: '7', o: ['7', '6', '8', '12'] };
        else { const s = subs[Math.floor(Math.random() * subs.length)], qs = pool[s], q = qs[Math.floor(Math.random() * qs.length)]; curQ = { q: q.question, a: String(q.answer), o: options(q, qs) }; }
        lock = false; renderQuiz();
    }
    function renderQuiz() {
        const box = $('svQuizC'); if (!box || !curQ) return;
        $('svQuizQ').textContent = curQ.q; box.innerHTML = '';
        curQ.o.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + '. ' + o; b.dataset.v = o; b.addEventListener('click', () => answer(o, b)); box.appendChild(b); });
    }
    function answer(o, b) {
        if (lock || !curQ) return; lock = true;
        const ok = o === curQ.a;
        emit('survival:quiz', { ok: ok });
        if (ok) { b.classList.add('ok'); setTimeout(nextQuiz, 250); }
        else { b.classList.add('ng'); Array.from($('svQuizC').children).forEach((x) => { if (x.dataset.v === curQ.a) x.classList.add('ok'); }); setTimeout(nextQuiz, 1200); }
    }

    // ---------- 操作 ----------
    function cast(i) { if (!slots[i]) return; emit('survival:skill', { i: i, aim: sv().aim ? sv().aim() : 0 }); }
    function useArt() { emit('survival:art'); }
    function guard() { emit('survival:guard'); }
    function onKey(e) {
        if (!mounted || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
        const k = e.key.toLowerCase();
        if (k === 'z' || k === 'x' || k === 'c' || k === 'v') cast(KEYS.indexOf(k));
        else if (k === 'r') useArt();
        else if (k === 'f') guard();
        else if (k === 'q') { ultHeld = true; setTimeout(() => { ultHeld = false; }, 200); }
        else if (k >= '1' && k <= '4') { const b = $('svQuizC') && $('svQuizC').children[Number(k) - 1]; if (b && quizOn) b.click(); }
        else if (k === 'n') { if (!lock) nextQuiz(); }
        else if (k === 'h') toggleQuiz();
    }
    function toggleQuiz() { quizOn = !quizOn; const q = $('svQuiz'); if (q) q.classList.toggle('min', !quizOn); }

    // ---------- 表示 ----------
    function mount(res) {
        const wrap = document.querySelector('#section-survival .sv-wrap'); if (!wrap) return;
        cm = null; slots = (res && res.combat && res.combat.slots) || [null, null, null, null]; enMax = (res && res.combat && res.combat.enMax) || 100;
        if (!$('svHud')) {
            const d = document.createElement('div'); d.id = 'svHud';
            d.innerHTML =
                '<div id="svBars"><div class="svb hp"><i id="svBarHp"></i><span id="svTxtHp"></span></div><div class="svb en"><i id="svBarEn"></i><span id="svTxtEn"></span></div><div class="svb ug"><i id="svBarUg"></i><span id="svTxtUg">必殺 0%</span></div><div id="svStreak"></div></div>' +
                '<div id="svQuiz"><div class="qh"><b>📝 クイズ（正解で精神力）</b><span><button type="button" id="svQuizSkip">スキップ[N]</button><button type="button" id="svQuizHide">しまう[H]</button></span></div><div id="svQuizQ"></div><div id="svQuizC"></div></div>' +
                '<div id="svAct"><div id="svSkillBar"></div><div class="svrow"><button type="button" id="svBtnGuard">🛡 集中<small>F</small></button><button type="button" id="svBtnUlt">⚡ 必殺<small>Q</small></button><button type="button" id="svBtnArt">神器<small>R</small></button></div></div>';
            wrap.appendChild(d);
            $('svQuizSkip').addEventListener('click', () => { if (!lock) nextQuiz(); });
            $('svQuizHide').addEventListener('click', toggleQuiz);
            $('svQuiz').addEventListener('dblclick', toggleQuiz);
            const tap = (id, fn) => { const b = $(id); const h = (e) => { e.preventDefault(); fn(); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); };
            tap('svBtnGuard', guard); tap('svBtnUlt', () => { ultHeld = true; setTimeout(() => { ultHeld = false; }, 200); }); tap('svBtnArt', useArt);
            ['keydown', 'keyup'].forEach((ev) => $('svQuiz').addEventListener(ev, (e) => e.stopPropagation()));
            
            // タッチ用必殺技ボタン
            const ultBtn = document.createElement('button');
            ultBtn.id = 'svUltBtn';
            ultBtn.type = 'button';
            ultBtn.className = 'touch-btn';
            ultBtn.textContent = '⚡';
            wrap.appendChild(ultBtn);
            ultBtn.addEventListener('touchstart', (e) => { e.preventDefault(); ultHeld = true; setTimeout(() => { ultHeld = false; }, 200); }, { passive: false });
            ultBtn.addEventListener('mousedown', (e) => { e.preventDefault(); ultHeld = true; setTimeout(() => { ultHeld = false; }, 200); });
        }
        $('svHud').style.display = 'block';
        buildSkillBar();
        window.addEventListener('keydown', onKey);
        mounted = true; pool = null; nextQuiz();
    }
    function buildSkillBar() {
        const bar = $('svSkillBar'); if (!bar) return;
        bar.innerHTML = '';
        slots.forEach((s, i) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'svs'; b.dataset.i = i;
            if (s) {
                b.innerHTML = '<span class="sk-key">' + KEYS[i].toUpperCase() + '</span><span class="ic">' + (FORM_ICON[s.f] || '✨') + '</span><span class="nm">' + esc(s.n) + '</span><small class="sk-cost">' + s.c + '</small><u class="sk-cd"></u>';
                b.classList.add('ready');
            } else {
                b.innerHTML = '<span class="sk-key">' + KEYS[i].toUpperCase() + '</span><span class="ic">・</span><span class="nm">（空き）</span><small class="sk-cost">-</small><u class="sk-cd"></u>';
                b.classList.add('empty');
            }
            const h = (e) => { e.preventDefault(); cast(i); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
            bar.appendChild(b);
        });
    }
    function unmount() { mounted = false; window.removeEventListener('keydown', onKey); const h = $('svHud'); if (h) h.style.display = 'none'; }
    function update(me) {
        lastMe = me; if (!mounted || !$('svBarHp')) return;
        cm = me.cm || cm; if (!cm) return;
        $('svBarHp').style.width = Math.max(0, Math.min(100, me.hp / me.mhp * 100)) + '%'; $('svTxtHp').textContent = 'HP ' + Math.max(0, Math.round(me.hp)) + ' / ' + me.mhp;
        $('svBarEn').style.width = Math.min(100, cm.en / cm.em * 100) + '%'; $('svTxtEn').textContent = '精神力 ' + cm.en + ' / ' + cm.em;
        $('svBarUg').style.width = cm.ug + '%'; $('svTxtUg').textContent = cm.ult ? '⚡ 必殺技 発動可能！ [Q]' : '必殺 ' + cm.ug + '%';
        $('svBarUg').parentNode.classList.toggle('ready', !!cm.ult);
        $('svStreak').textContent = cm.st >= 2 ? '🔥 ' + cm.st + '連続正解' + (cm.st >= 3 ? '（精神力ボーナス）' : '') : '';
        const bar = $('svSkillBar');
        if (bar) Array.from(bar.children).forEach((b, i) => {
            const s = slots[i]; if (!s) return; const cd = cm.sk[i] || 0, no = cm.en < s.c;
            b.classList.toggle('cd', cd > 0); b.classList.toggle('short', cd <= 0 && no);
            const u = b.querySelector('.sk-cd'); if (u) u.textContent = cd > 0 ? cd.toFixed(1) : '';
        });
        const g = $('svBtnGuard'); if (g) { g.classList.toggle('cd', cm.gc > 0); g.classList.toggle('on', cm.gd > 0); }
        const u = $('svBtnUlt'); if (u) u.classList.toggle('ready', !!cm.ult);
        const a = $('svBtnArt'); if (a) { const has = !!me.art; a.style.display = has ? 'inline-block' : 'none'; if (has) { const ar = ARTI[me.art.id] || ['✨', '神器']; a.innerHTML = ar[0] + ' ' + ar[1] + '<small>R' + (me.art.cd > 0 ? ' ' + Math.ceil(me.art.cd) + 's' : '') + '</small>'; a.classList.toggle('cd', me.art.cd > 0); } }
    }

    // ---------- 出撃準備 ----------
    // 武器を選び、持ち込む装備にチェックを入れ、スキルを確認して「出撃」。戻り値：持ち込む装備の配列（やめるなら null）
    function prepare(gatherFn) {
        return new Promise((resolve) => {
            const wrap = document.querySelector('#section-survival .sv-wrap'); if (!wrap) { resolve(gatherFn()); return; }
            let box = $('svPrep'); if (box) box.remove();
            box = document.createElement('div'); box.id = 'svPrep'; wrap.appendChild(box);
            const H = window.HW;
            const label = (x) => { try { return (H.displayName ? H.displayName(x) : x.name) || '装備'; } catch (e) { return x.name || '装備'; } };
            const col = (x) => { try { return H.rarityOf(x).color; } catch (e) { return '#ddd'; } };
            let skills = []; try { skills = window.ActionSkills ? ActionSkills.loadLoadout() : []; } catch (e) { /* なし */ }
            const draw = () => {
                const d = H.load(), ws = d.weapons || [], gear = gatherFn();
                const eqw = ws.find((x) => x.id === d.equipped);
                box.innerHTML = '<div class="pp"><h3>⚔ 出撃準備</h3>' +
                    '<div class="pc"><b>武器</b><select id="svpW">' + (ws.length ? ws.map((w) => '<option value="' + esc(w.id) + '"' + (w.id === d.equipped ? ' selected' : '') + '>' + esc(label(w)) + (w.locked ? '🔒' : '') + '</option>').join('') : '<option value="">（武器なし：素手）</option>') + '</select>' +
                    '<small>' + (eqw ? '攻撃 ' + (H.pctLabel ? H.pctLabel(eqw) : '') + (eqw.mythicId || eqw.rarity === 'mythic' ? ' ／ 神話：持ち込まれず、奪われません' : eqw.locked ? ' ／ ロック中：持ち込まれません' : ' ／ 倒されると奪われることがあります') : '素手で戦います') + '</small></div>' +
                    '<div class="pc"><b>持ち込む装備</b><small>預けた装備は、PvPで倒されると1つ奪われます。奪われたくない装備はチェックを外します（外した装備は安全）。</small>' +
                    (gear.length ? gear.map((it, i) => '<label class="pg"><input type="checkbox" data-i="' + i + '" checked> <span style="color:' + col(it.data) + '">' + esc(label(it.data)) + '</span> <small>' + ({ weapon: '武器', armor: '防具', acc: 'アクセ' }[it.kind] || '') + '</small></label>').join('') : '<div class="pe">持ち込める装備はありません（ロック中・神話は安全なので持ち込みません）</div>') + '</div>' +
                    '<div class="pc"><b>スキル（Z X C V）</b>' + (skills.length ? skills.slice(0, 4).map((s, i) => '<div class="ps">' + KEYS[i].toUpperCase() + '　' + esc(s && s.name || '（空き）') + '</div>').join('') : '<div class="pe">スキルは「ステージ」のスキル工房で作ると、ここで使えます</div>') + '</div>' +
                    '<div class="pc"><b>操作</b><small>移動：WASD／スティック　攻撃：スペース／ボタン　スキル：Z X C V　必殺：Q　集中：F　神器：R　使う：E　クイズ：1〜4</small><small>クイズに正解すると精神力がたまり、スキルが撃てます。敵にダメージを与えると必殺技ゲージがたまります。</small></div>' +
                    '<div class="pb"><button type="button" id="svpGo">出撃する</button><button type="button" id="svpNo">やめる</button></div></div>';
                $('svpW').addEventListener('change', (e) => { const dd = H.load(); dd.equipped = e.target.value || null; H.save(dd); draw(); });
                $('svpGo').addEventListener('click', () => { const g = gatherFn(), on = Array.from(box.querySelectorAll('input[type=checkbox]')).filter((c) => c.checked).map((c) => g[Number(c.dataset.i)]).filter(Boolean); box.remove(); resolve(on); });
                $('svpNo').addEventListener('click', () => { box.remove(); resolve(null); });
            };
            ['keydown', 'keyup'].forEach((ev) => box.addEventListener(ev, (e) => e.stopPropagation()));
            draw();
        });
    }

    window.SVHud = { mount: mount, unmount: unmount, update: update, prepare: prepare, ultHeld: () => ultHeld, quizOn: () => quizOn };
})();
