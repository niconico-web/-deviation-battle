// ============================================================
// 進行システム (progression.js)
//  1) Lv60まで経験値3倍（倍率の本体は stats.js の getLevelXpBoost）
//  2) レベル到達報酬
//       Lv60  : 「神話武器の素材」か「コイン」を選んで受け取る。大討伐戦・市場・緊急ステージ・PvPが解放される
//       Lv100 : 混沌の結晶×10 ＋ Lv60で受け取らなかった方
//  3) メインミッション（村長）… 最初はステージが全部ロック。推奨合計の6割を満たして村長に話しかけると解放（飛び級OK）
//  4) 緊急ステージ（○○ニグス）… 13/15/17/20/22時に開催。1時間前にアラート。ステージ本体は stage-data.js の EMERGENCY
//  5) 通知 … 勉強が終わったとき／緊急ステージの1時間前・開催時に、その端末へ通知する
//
//  保存先：武器庫のデータ（HW.load().prog）。player には触らない（勉強のたびに作り直されるため）。
//  数字を変えたいときは、下の定数だけ触ればよい。
// ============================================================
(function () {
    'use strict';

    // ---------- 調整用の定数 ----------
    const UNLOCK_LV = 60;                  // 大討伐戦・市場・緊急ステージ・PvPが解放されるレベル
    const LV60_COINS = 1000000;            // Lv60報酬（コイン案）。神話への鍛え直し代（HW.MYTHIC_FORGE）と同じ額
    const LV60_MAT_EACH = 30;              // Lv60報酬（素材案）。レア度4の素材を、1種類につきこの個数
    const LV100_CHAOS = 10;                // Lv100報酬の混沌の結晶
    const MISSION_RATIO = 0.6;             // 推奨合計のこの割合を満たしていれば、村長からステージを受注できる
    const EMG_HOURS = [13, 15, 17, 20, 22];  // 緊急ステージの開催時刻（端末のローカル時間）
    const EMG_OPEN_MIN = 60;               // 開催している時間（分）
    const EMG_ALERT_MIN = 60;              // 何分前にアラートを出すか

    // ---------- 共通 ----------
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = n => Number(n || 0).toLocaleString('ja-JP');
    function getP() { try { return (typeof getPlayerData === 'function') ? getPlayerData() : null; } catch (e) { return null; } }
    function lvOf(p) { if (!p) return 1; try { return typeof calcLevel === 'function' ? calcLevel(p.xp || 0) : (p.level || 1); } catch (e) { return p.level || 1; } }
    function totalOf(p) { try { return window.SBCost ? SBCost.totalOf(p) : 250; } catch (e) { return 250; } }
    function hasHW() { return !!(window.HW && HW.load); }
    function prog(h) { h.prog = h.prog || {}; h.prog.mission = h.prog.mission || { unlocked: {}, active: null }; return h.prog; }
    function savePlayer(p) { try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {} try { if (typeof syncPlayerToServer === 'function') syncPlayerToServer(true); } catch (e) {} }

    function modal(title, html, onClose) {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:10px';
        const box = document.createElement('div');
        box.style.cssText = 'background:#1b2036;color:#eef;border:2px solid #7a8cff;border-radius:12px;max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:14px 16px;font-size:.92rem;line-height:1.6';
        box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:1.1rem">' + title + '</b><button data-x style="background:#333a5a;color:#fff;border:0;border-radius:6px;padding:3px 10px;cursor:pointer">✕</button></div><div data-body>' + html + '</div>';
        ov.appendChild(box); document.body.appendChild(ov);
        const close = () => { ov.remove(); if (onClose) onClose(); };
        box.querySelector('[data-x]').addEventListener('click', close);
        ov.addEventListener('click', e => { if (e.target === ov) close(); });
        return { ov, box, body: box.querySelector('[data-body]'), close };
    }
    const BTN = 'background:#4a63ff;color:#fff;border:0;border-radius:8px;padding:8px 14px;margin:4px 4px 0 0;cursor:pointer;font-weight:bold';
    const BTN_G = 'background:#2f9e5b;color:#fff;border:0;border-radius:8px;padding:8px 14px;margin:4px 4px 0 0;cursor:pointer;font-weight:bold';
    const BTN_X = 'background:#555c7a;color:#fff;border:0;border-radius:8px;padding:6px 10px;margin:4px 4px 0 0;cursor:pointer';

    // ---------- 通知 ----------
    function canNotify() { return ('Notification' in window); }
    function notify(title, body, tag) {
        if (!canNotify() || Notification.permission !== 'granted') return false;
        const opt = { body: body, tag: tag || undefined, icon: 'images/icons/icon-192x192.png', badge: 'images/icons/icon-192x192.png', vibrate: [200, 100, 200] };
        const fallback = () => { try { new Notification(title, opt); } catch (e) { /* 通知が出せない端末では、画面内の表示だけ */ } };
        try {
            if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
                navigator.serviceWorker.getRegistration().then(r => { if (r && r.showNotification) r.showNotification(title, opt); else fallback(); }).catch(fallback);
            } else fallback();
        } catch (e) { fallback(); }
        return true;
    }
    function askNotifyPermission() {
        if (!canNotify() || Notification.permission !== 'default') return;
        try { const r = Notification.requestPermission(); if (r && r.then) r.then(updateNotifyBtn); } catch (e) { /* 古いブラウザ */ }
    }
    let notifyBtn = null;
    function updateNotifyBtn() {
        const need = canNotify() && Notification.permission === 'default';
        if (need && !notifyBtn) {
            notifyBtn = document.createElement('button');
            notifyBtn.textContent = '🔔 通知をオンにする';
            notifyBtn.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9000;background:#2b3358;color:#fff;border:1px solid #7a8cff;border-radius:18px;padding:6px 12px;font-size:.8rem;cursor:pointer;opacity:.92';
            notifyBtn.addEventListener('click', () => { askNotifyPermission(); });
            document.body.appendChild(notifyBtn);
        } else if (!need && notifyBtn) { notifyBtn.remove(); notifyBtn = null; }
    }

    // ---------- 1) レベル報酬 ----------
    function matIds() {
        try { return Object.keys(MATERIAL_DATA).filter(id => MATERIAL_DATA[id].rarity === 4); } catch (e) { return []; }
    }
    function grantCoins(p, n) { p.coins = (p.coins || 0) + n; }
    function grantMats(p, n) {
        if (!p.materials || Array.isArray(p.materials)) p.materials = {};
        matIds().forEach(id => { p.materials[id] = (p.materials[id] || 0) + n; });
    }
    function grantChaos(p, n) {
        const cc = p.craftCurrency || (p.craftCurrency = { chaos: 0, divine: 0, imprint: 0 });
        cc.chaos = (cc.chaos | 0) + n;
    }
    function rewardText(kind) { return kind === 'coin' ? 'コイン ' + fmt(LV60_COINS) + '枚' : '神話武器の素材（最高ランク素材 ' + matIds().length + '種×' + LV60_MAT_EACH + '個）'; }
    function applyChoice(kind) { const p = getP(); if (!p) return; if (kind === 'coin') grantCoins(p, LV60_COINS); else grantMats(p, LV60_MAT_EACH); savePlayer(p); }

    let rewardOpen = false;
    function showLv60() {
        if (rewardOpen) return; rewardOpen = true;
        const m = modal('🎉 Lv' + UNLOCK_LV + ' 到達報酬', '<div>レベル' + UNLOCK_LV + 'に到達しました！<br>どちらか <b>1つ</b> を選んで受け取れます。<small style="color:#9fb3d9">（選ばなかった方は Lv' + 100 + ' 到達時にもらえます）</small></div>' +
            '<div style="margin:8px 0;padding:8px;border:1px solid #5a6aa8;border-radius:8px">🌟 <b>解放されたもの</b><br>大討伐戦 ／ 市場 ／ 緊急ステージ ／ PvP</div>' +
            '<button style="' + BTN + '" data-k="mat">🧪 ' + esc(rewardText('mat')) + '</button><br><button style="' + BTN + '" data-k="coin">🪙 ' + esc(rewardText('coin')) + '</button>',
            () => { rewardOpen = false; });
        m.body.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
            const k = b.dataset.k; if (!hasHW()) return;
            const h = HW.load(), pr = prog(h); if (pr.lv60) { m.close(); return; }
            pr.lv60 = k; HW.save(h); applyChoice(k);
            m.body.innerHTML = '<div style="padding:8px">✅ <b>' + esc(rewardText(k)) + '</b> を受け取りました！<br><small style="color:#9fb3d9">Lv' + 100 + 'に到達すると、混沌の結晶×' + LV100_CHAOS + 'と、もう一方の報酬がもらえます。</small></div><button style="' + BTN_X + '" data-ok>閉じる</button>';
            m.body.querySelector('[data-ok]').addEventListener('click', m.close);
        }));
    }
    function showLv100(first) {
        if (rewardOpen) return; rewardOpen = true;
        const other = first === 'coin' ? 'mat' : 'coin';
        const m = modal('🏆 Lv100 到達報酬', '<div>レベル100に到達しました！おめでとうございます！</div><div style="margin:8px 0">・🔮 混沌の結晶 ×' + LV100_CHAOS + '<br>・' + (other === 'coin' ? '🪙 ' : '🧪 ') + esc(rewardText(other)) + '（Lv' + UNLOCK_LV + 'で受け取らなかった方）</div><button style="' + BTN + '" data-get>受け取る</button>', () => { rewardOpen = false; });
        m.body.querySelector('[data-get]').addEventListener('click', () => {
            const h = HW.load(), pr = prog(h); if (pr.lv100) { m.close(); return; }
            pr.lv100 = true; HW.save(h);
            const p = getP(); if (p) { grantChaos(p, LV100_CHAOS); if (other === 'coin') grantCoins(p, LV60_COINS); else grantMats(p, LV60_MAT_EACH); savePlayer(p); }
            m.body.innerHTML = '<div style="padding:8px">✅ 受け取りました！</div><button style="' + BTN_X + '" data-ok>閉じる</button>';
            m.body.querySelector('[data-ok]').addEventListener('click', m.close);
        });
    }
    function checkLevelRewards() {
        if (!hasHW() || rewardOpen) return;
        const p = getP(); if (!p) return;
        const lv = lvOf(p), pr = prog(HW.load());
        if (lv >= UNLOCK_LV && !pr.lv60) showLv60();
        else if (lv >= 100 && pr.lv60 && !pr.lv100) showLv100(pr.lv60);
    }

    // ---------- 2) Lv60で解放されるもの ----------
    function lvLocked() { return lvOf(getP()) < UNLOCK_LV; }
    function lockMsg(what) { return '🔒 ' + what + 'は Lv' + UNLOCK_LV + ' になると解放されます（いまは Lv' + lvOf(getP()) + '）。\n勉強して、レベルを上げましょう！'; }
    function guardWindowFn(name, what) {
        const orig = window[name]; if (typeof orig !== 'function' || orig.__sbGuard) return;
        const g = function () { if (lvLocked()) { alert(lockMsg(what)); return; } return orig.apply(this, arguments); };
        g.__sbGuard = true; window[name] = g;
    }
    function installGuards() {
        guardWindowFn('openPvpArena', 'PvP');
        guardWindowFn('openRaidLobby', '大討伐戦');
        const orig = window.activateSection;
        if (typeof orig === 'function' && !orig.__sbGuard) {
            const g = function (section) {
                if (section === 'market' && lvLocked()) { alert(lockMsg('市場')); return; }
                if (section === 'online' && lvLocked()) { alert(lockMsg('PvP（闘技場）')); return; }
                return orig.apply(this, arguments);
            };
            g.__sbGuard = true; window.activateSection = g;
        }
    }

    // ---------- 3) メインミッション ----------
    const isMainStage = s => !!(s && s.req && !s.pvp && !s.raid && !s.ambush && !s.rush && !s.corridor && !s.standardOnly && !s.emergency && (s.world || 1) <= 5);
    function missionOpen(s) {          // すでに解放ずみ（受注した／前にクリアしたことがある）
        if (!hasHW()) return true;
        const h = HW.load(), m = prog(h).mission;
        return !!(m.unlocked[s.id] || ((h.cleared || {})[s.id] | 0) > 0);
    }
    function needOf(s) { return Math.ceil(s.req * MISSION_RATIO); }
    function stageBlocked(s) {
        if (!isMainStage(s) || missionOpen(s)) return '';
        return '🔒 このステージは、まだメインミッションとして解放されていません。\n村長に話しかけて、受注しましょう（推奨合計の' + Math.round(MISSION_RATIO * 100) + '%＝' + fmt(needOf(s)) + ' 以上が必要）。';
    }
    function decorateCards(root) {
        if (!root || !window.getStageById) return;
        root.querySelectorAll('.sbl-card[data-id]').forEach(c => {
            const s = window.getStageById(c.dataset.id);
            if (s && stageBlocked(s)) { c.style.opacity = '.6'; const b = c.querySelector('b'); if (b && !b.dataset.lk) { b.dataset.lk = '1'; b.textContent = '🔒 ' + b.textContent; } }
        });
    }
    function decorateDetail(det, s) {
        if (!det) return;
        if (hasHW() && !s.emergency) { const hb = healerBox(), btn = det.querySelector('#sbSolo'); if (btn && btn.parentNode) btn.parentNode.parentNode.insertBefore(hb, btn.parentNode); }
        const msg = stageBlocked(s); if (!msg) return;
        const d = document.createElement('div');
        d.style.cssText = 'margin:8px 0;padding:8px;border:2px solid #ffb86a;border-radius:8px;color:#ffd9a0;font-weight:bold;white-space:pre-line';
        d.textContent = msg; det.insertBefore(d, det.children[1] || null);
    }
    // ---------- 治療師の同行 ----------
    //  加護の杖を持っていれば、治療師に杖を持たせて一緒にステージへ行ける（数秒ごとに自分のHPを回復）。杖のレア度で回復量が上がる。
    const HEAL_PCT = { normal: 0.03, magic: 0.04, rare: 0.05, epic: 0.06, legendary: 0.08, mythic: 0.10 };   // 3秒ごとに、最大HPのこの割合
    function bestStaff() {
        if (!hasHW()) return null;
        const ws = (HW.load().weapons || []).filter(w => w && w.type === 'supportstaff');
        let best = null; ws.forEach(w => { if (!best || (HEAL_PCT[w.rarity] || 0) > (HEAL_PCT[best.rarity] || 0)) best = w; });
        return best;
    }
    function healerPower() {
        if (!hasHW() || !prog(HW.load()).healerOn) return 0;
        const w = bestStaff(); return w ? (HEAL_PCT[w.rarity] || 0.03) : 0;
    }
    function healerBox() {
        const w = bestStaff(), on = !!(hasHW() && prog(HW.load()).healerOn && w);
        const d = document.createElement('label');
        d.style.cssText = 'display:block;margin:6px 0;padding:6px 8px;border:1px solid #5a6aa8;border-radius:8px;font-size:.85rem;' + (w ? 'cursor:pointer' : 'opacity:.6');
        d.innerHTML = '<input type="checkbox"' + (on ? ' checked' : '') + (w ? '' : ' disabled') + '> 👩‍⚕️ 治療師を連れていく' + (w ? '（' + esc(w.name || '加護の杖') + 'を持たせる）' : '<br><small>加護の杖を持っていると、治療師に持たせて一緒に行けます</small>');
        const cb = d.querySelector('input');
        cb.addEventListener('change', () => { const h = HW.load(); prog(h).healerOn = cb.checked; HW.save(h); });
        return d;
    }
    function openWorldIds() {
        const W = (window.STAGE_DATA && STAGE_DATA.WORLDS) || [], h = HW.load(), ok = {};
        W.forEach(w => { if (w.id <= 5 && (w.id === 1 || (w.unlock && h[w.unlock.flag]))) ok[w.id] = w; });
        if (!ok[1]) ok[1] = { id: 1, name: '第一世界' };
        return ok;
    }
    function accept(s) {
        const h = HW.load(), m = prog(h).mission;
        m.unlocked[s.id] = true; m.active = s.id; HW.save(h);
    }
    function showMainMission() {
        if (!hasHW() || !window.STAGE_DATA) { alert('データの読み込みに失敗しました'); return; }
        const p = getP(), total = totalOf(p), worlds = openWorldIds();
        const stages = STAGE_DATA.STAGES.filter(s => isMainStage(s) && worlds[s.world || 1]).sort((a, b) => a.req - b.req);
        const sat = stages.filter(s => total >= needOf(s));
        const best = sat.length ? sat[sat.length - 1] : null;                 // いまのステータスで受注できる、いちばん強いステージ
        const next = stages.find(s => total < needOf(s)) || null;             // その次の目標
        const m = modal('👴 村長　メインミッション', '', null);
        function draw() {
            const mis = prog(HW.load()).mission;
            let html = '<div style="margin-bottom:6px">「冒険者よ、ステージへ向かうには、まず私に話しにくるのじゃ。<br>推奨ステータス合計の <b>' + Math.round(MISSION_RATIO * 100) + '%</b> を満たしていれば、どのステージでも（飛び級でも）受注できるぞ」</div>' +
                '<div style="padding:6px 8px;background:#262d4d;border-radius:8px">あなたのステータス合計：<b style="color:#ffd36a">' + fmt(total) + '</b></div>';
            if (best) html += '<div style="margin-top:6px">📌 <b>おすすめ</b>：' + best.icon + ' ' + esc(best.name) + '（推奨 ' + fmt(best.req) + '）' + (missionOpen(best) ? ' <small style="color:#7aff9a">解放ずみ</small>' : ' <button style="' + BTN_G + '" data-acc="' + best.id + '">受注する</button>') + '</div>';
            if (next) html += '<div style="margin-top:4px;color:#b8c4e0">🎯 つぎの目標：' + next.icon + ' ' + esc(next.name) + '　あと <b>' + fmt(needOf(next) - total) + '</b> で受注できる</div>';
            let lastW = 0;
            html += '<div style="margin-top:8px">' + stages.map(s => {
                const w = s.world || 1, head = (w !== lastW) ? '<div style="margin:8px 0 2px;color:#d8b8ff;font-weight:bold">' + esc((worlds[w] && worlds[w].name) || ('第' + w + '世界')) + '</div>' : ''; lastW = w;
                const open = missionOpen(s), can = total >= needOf(s);
                const st = open ? '<span style="color:#7aff9a">✔ 解放ずみ' + (mis.active === s.id ? '（受注中）' : '') + '</span>' : (can ? '<button style="' + BTN + ';padding:3px 10px" data-acc="' + s.id + '">受注</button>' : '<span style="color:#ffb86a">🔒 あと ' + fmt(needOf(s) - total) + '</span>');
                return head + '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #2c3454"><span>' + s.icon + ' ' + esc(s.name) + ' <small style="color:#9fb3d9">推奨 ' + fmt(s.req) + ' ／ 必要 ' + fmt(needOf(s)) + '</small></span>' + st + '</div>';
            }).join('') + '</div>';
            html += '<div style="margin-top:8px"><button style="' + BTN_X + '" data-quest>🗒 村の依頼（クエスト）を見る</button></div>';
            m.body.innerHTML = html;
            m.body.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => {
                const s = window.getStageById(b.dataset.acc); if (!s) return; accept(s); draw();
                alert('「' + s.name + '」をメインミッションとして受注しました！\nステージゲートから挑戦できます。');
            }));
            const q = m.body.querySelector('[data-quest]');
            if (q) q.addEventListener('click', () => { m.close(); if (window.__sbOrigNpcDialogue) window.__sbOrigNpcDialogue('village_head'); });
        }
        draw();
    }
    function installNpcHook() {
        if (typeof window.showNPCDialogue !== 'function' || window.showNPCDialogue.__sbHook) return;
        window.__sbOrigNpcDialogue = window.showNPCDialogue;
        const g = function (npcId) { if (npcId === 'village_head') { showMainMission(); return; } return window.__sbOrigNpcDialogue.apply(this, arguments); };
        g.__sbHook = true; window.showNPCDialogue = g;
    }

    // ---------- 4) 緊急ステージ ----------
    const pad2 = n => String(n).padStart(2, '0');
    function slotKey(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + pad2(d.getHours()); }
    function stageForSlot(start) {
        const E = (window.STAGE_DATA && STAGE_DATA.EMERGENCY) || []; if (!E.length) return null;
        const k = parseInt(slotKey(start), 10);
        return E[(Math.imul(k, 2654435761) >>> 0) % E.length];       // 同じ時間枠なら、どの端末でも同じニグスになる
    }
    function slotsAround(now) {       // 昨日〜明日の開催枠
        const out = [], base = new Date(now); base.setHours(0, 0, 0, 0);
        for (let d = -1; d <= 1; d++) EMG_HOURS.forEach(hr => { const s = new Date(base); s.setDate(s.getDate() + d); s.setHours(hr, 0, 0, 0); out.push(s); });
        return out;
    }
    function emgState(now) {          // { open: {start,end,stage} | null, next: {start,stage} | null }
        const t = now || Date.now(); let open = null, next = null;
        slotsAround(t).forEach(s => {
            const a = s.getTime(), b = a + EMG_OPEN_MIN * 60000;
            if (t >= a && t < b) open = { start: a, end: b, stage: stageForSlot(s) };
            else if (a > t && (!next || a < next.start)) next = { start: a, stage: stageForSlot(s) };
        });
        return { open, next };
    }
    function launchEmg(mode, stage) {
        const st = emgState().open;
        if (!st || st.stage.id !== stage.id) { alert('この緊急ステージは終了しました。'); return; }
        if (lvLocked()) { alert(lockMsg('緊急ステージ')); return; }
        if (window.SBCost && !SBCost.guard()) return;
        if (typeof window.cancelStudyTimer === 'function') window.cancelStudyTimer();
        try { localStorage.setItem('sbStageLaunch', JSON.stringify({ stageId: stage.id, mode: mode, roomId: null, diff: 0, at: Date.now() })); } catch (e) {}
        location.href = 'lesson.html';
    }
    function showEmergency() {
        const s = emgState();
        if (!s.open) { alert('いまは緊急ステージは開催していません。' + (s.next ? '\n次回：' + new Date(s.next.start).getHours() + '時' : '')); return; }
        if (lvLocked()) { alert(lockMsg('緊急ステージ')); return; }
        const st = s.open.stage, mm = modal('🚨 緊急ステージ', '', null);
        const tick = () => { const left = Math.max(0, Math.ceil((s.open.end - Date.now()) / 1000)); const el = mm.body.querySelector('[data-left]'); if (el) el.textContent = Math.floor(left / 60) + ':' + pad2(left % 60); };
        mm.body.innerHTML = '<div style="font-size:1.1rem"><b>' + esc(st.boss.name) + '</b> が出現した！</div>' +
            '<div style="color:#ffb86a">残り <b data-left></b></div>' +
            '<div style="margin:6px 0;font-size:.85rem;color:#c8d4ee">元になったボス「' + esc(st.boss.name.replace(/ニグス$/, '')) + '」の<b>数倍の強さ</b>。ステータス合計の目安：' + fmt(st.req) + '<br>報酬：🔮混沌の結晶 ／ 🔶昇華の結晶 ／ 武器 ／ 防具 ／ アクセサリー</div>' +
            '<div style="font-size:.8rem;color:#ffd9a0">※ レベル差が10以上ある人とは、一緒に行けません</div>' +
            '<button style="' + BTN_G + '" data-m="solo">ソロで出発</button><button style="' + BTN + '" data-m="create">部屋を作って募集</button><button style="' + BTN + '" data-m="quick">クイック参加</button>';
        mm.body.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => launchEmg(b.dataset.m, st)));
        tick(); const iv = setInterval(() => { if (!document.body.contains(mm.ov)) { clearInterval(iv); return; } tick(); }, 1000);
    }

    // 画面右上のバナー
    let banner = null;
    function ensureBanner() {
        if (banner) return banner;
        banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;right:8px;top:150px;z-index:9000;background:#7a1d2a;color:#fff;border:2px solid #ff8a9a;border-radius:10px;padding:6px 10px;font-size:.82rem;cursor:pointer;display:none;box-shadow:0 2px 10px rgba(0,0,0,.4)';
        banner.addEventListener('click', showEmergency);
        document.body.appendChild(banner); return banner;
    }
    const NKEY = 'sbEmgNotified';
    function notified(k) { try { return (JSON.parse(localStorage.getItem(NKEY) || '[]')).indexOf(k) >= 0; } catch (e) { return false; } }
    function markNotified(k) { try { const a = JSON.parse(localStorage.getItem(NKEY) || '[]'); a.push(k); localStorage.setItem(NKEY, JSON.stringify(a.slice(-40))); } catch (e) {} }
    function emgTick() {
        if (lvLocked()) { if (banner) banner.style.display = 'none'; return; }
        const s = emgState(), b = ensureBanner(), now = Date.now();
        if (s.open) {
            const left = Math.max(0, Math.ceil((s.open.end - now) / 1000));
            b.style.display = 'block'; b.style.background = '#7a1d2a';
            b.textContent = '🚨 緊急ステージ「' + s.open.stage.boss.name + '」 残り ' + Math.floor(left / 60) + ':' + pad2(left % 60);
            const k = 'o:' + slotKey(new Date(s.open.start));
            if (!notified(k)) { markNotified(k); notify('🚨 緊急ステージ開催中！', s.open.stage.boss.name + ' が出現しました（残り' + EMG_OPEN_MIN + '分）', 'emg-open'); }
        } else if (s.next && s.next.start - now <= EMG_ALERT_MIN * 60000) {
            const mins = Math.ceil((s.next.start - now) / 60000), hh = new Date(s.next.start).getHours();
            b.style.display = 'block'; b.style.background = '#5a4a1d';
            b.textContent = '⏰ ' + hh + '時に緊急ステージ「' + s.next.stage.boss.name + '」（あと' + mins + '分）';
            const k = 'a:' + slotKey(new Date(s.next.start));
            if (!notified(k)) { markNotified(k); notify('⏰ まもなく緊急ステージ', hh + '時に「' + s.next.stage.boss.name + '」が出現します（あと' + mins + '分）', 'emg-alert'); }
        } else b.style.display = 'none';
    }

    // ---------- 5) 勉強終了の通知 ----------
    let trackedEnd = 0, studyNotified = false, timeoutId = null;
    function studyTick() {
        let running = false, end = 0;
        try {
            if (typeof studyStartTime !== 'undefined' && studyStartTime !== null) {
                running = true; end = studyStartTime + Math.max(0, (studyDurationSec || 0) - (studyElapsedBefore || 0)) * 1000;
            }
        } catch (e) { running = false; }
        if (running) {
            if (end !== trackedEnd) {          // 新しく勉強が始まった：終わる時刻に通知をセット（画面が止まっていても、タイマーで知らせる）
                trackedEnd = end; studyNotified = false; if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(fireStudy, Math.max(0, end - Date.now()));
            }
            if (!studyNotified && Date.now() >= end) fireStudy();
        } else { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } trackedEnd = 0; }
    }
    function fireStudy() {
        if (studyNotified || !trackedEnd) return; studyNotified = true;
        notify('📚 勉強おつかれさま！', 'タイマーが終わりました。報酬を受け取りに戻りましょう。', 'study-done');
    }

    // ---------- 起動 ----------
    window.SBProg = {
        UNLOCK_LV: UNLOCK_LV, LV_GAP: 10, stageBlocked: stageBlocked, decorateCards: decorateCards, decorateDetail: decorateDetail,
        showMainMission: showMainMission, healerPower: healerPower, showEmergency: showEmergency, emgState: emgState, lvLocked: lvLocked, lockMsg: lockMsg,
        enableNotifications: askNotifyPermission, notify: notify, checkLevelRewards: checkLevelRewards
    };
    function boot() {
        installGuards(); installNpcHook(); updateNotifyBtn();
        document.addEventListener('click', e => { const t = e.target; if (t && t.id === 'studyStart') askNotifyPermission(); }, true);      // 勉強を始めるタップで、通知の許可を聞く
        setInterval(() => { installGuards(); installNpcHook(); }, 3000);        // 後から作られる関数にも、ガードをかける
        setInterval(studyTick, 1000);
        setInterval(emgTick, 15000); emgTick();
        setInterval(checkLevelRewards, 4000); setTimeout(checkLevelRewards, 1500);
        setInterval(updateNotifyBtn, 5000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
