// ============================================================
// ビギナーミッション (beginner.js)
//  「○○に行こう！」「○○をクリアしよう！」「○○分勉強しよう！」を順番にこなすだけで、
//  このゲームの遊び方がひととおり身につくミッション。町の画面の左下に「いまのミッション」が出る。
//  ・達成すると自動でコインがもらえる（キャラクターごとに1回ずつ）
//  ・すでに遊び込んでいるキャラ（勉強2時間以上 or ステージ5つ以上クリア）には出ない
//  ・達成の判定は、保存データ（勉強時間・クリア記録・装備・スキルなど）を見て自動でやる。
//    「ゲートに行く」「武器庫を開く」のような行動だけは、各画面から SbBeginner.event('gate') のように知らせてもらう
//  ミッションを足す・変える：下の MISSIONS を編集するだけ
// ============================================================
(function () {
    'use strict';
    const KEY = 'sbBeginner';

    const fmt = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
    const player = () => parse(localStorage.getItem('player'));
    const hackData = () => { try { return window.HW ? window.HW.load() : null; } catch (e) { return null; } };
    const clearedCount = h => Object.keys((h && h.cleared) || {}).filter(k => h.cleared[k] > 0).length;
    const seasonState = () => parse(localStorage.getItem('sbSeason')) || {};

    // check(ctx) → { done, text?, ratio? }   ctx = { p: プレイヤー, h: 武器庫データ, ev: 行動の記録 }
    const MISSIONS = [
        { id: 'study5', icon: '📖', title: '5分勉強しよう', hint: '「勉強」タブを開いて、科目を選んでタイマーを動かそう（模擬戦闘でもOK）', reward: 100, target: '.menu-btn[data-section="study"]',
          check: c => { const s = c.p.totalStudySeconds || 0; return { done: s >= 300, text: fmt(Math.min(s, 300)) + ' / 5:00', ratio: s / 300 }; } },
        { id: 'gate', icon: '🚪', title: 'ステージゲートに行こう', hint: '町の「ステージゲート」か、画面の「🚪 ステージゲートへ」ボタンを押そう', reward: 100, target: '#openStageGateFromInv',
          check: c => ({ done: !!c.ev.gate }) },
        { id: 'meadow', icon: '🌾', title: '「陽だまりの草原」をクリアしよう', hint: 'ステージゲートで第一世界の最初のステージを選んで「ソロ」で出発！ 倒した敵が武器を落とすよ', reward: 200, target: '#openStageGateFromInv',
          check: c => ({ done: ((c.h && c.h.cleared && c.h.cleared.meadow) || 0) > 0 }) },
        { id: 'armory', icon: '🗡️', title: '武器庫を開こう', hint: '「🗡 武器庫を開く」で、手に入れた武器を確認しよう', reward: 100, target: '#openArmoryFromInv',
          check: c => ({ done: !!c.ev.armory }) },
        { id: 'equip', icon: '⚔️', title: '新しい武器を装備しよう', hint: '武器庫で、ステージで拾った武器を選んで「装備」。攻撃力の＋％が高い武器がおすすめ', reward: 150, target: '#openArmoryFromInv',
          check: c => { const h = c.h; if (!h || !h.weapons || !h.weapons.length) return { done: false }; const st = h.weapons.find(w => w.source === 'starter'); return { done: st ? h.equipped !== st.id : true }; } },
        { id: 'clear3', icon: '🏁', title: 'ステージを3つクリアしよう', hint: '勝つほど武器とコインが集まる。ハードやナイトメアは、ドロップが良いよ', reward: 300, target: '#openStageGateFromInv',
          check: c => { const n = clearedCount(c.h); return { done: n >= 3, text: Math.min(n, 3) + ' / 3', ratio: n / 3 }; } },
        { id: 'study30', icon: '⏱️', title: '合計30分勉強しよう', hint: '勉強するほどステータスが上がって、強いステージに挑めるようになる', reward: 300, target: '.menu-btn[data-section="study"]',
          check: c => { const s = c.p.totalStudySeconds || 0; return { done: s >= 1800, text: fmt(Math.min(s, 1800)) + ' / 30:00', ratio: s / 1800 }; } },
        { id: 'skill', icon: '✨', title: 'オリジナルスキルを作ろう', hint: '「スキル」から、形・グリフ（効果）・強化を選んで保存しよう。特殊ステータスが高いほどグリフ枠が増える', reward: 300, target: '.menu-btn[data-section="skills"]',
          check: c => { const l = parse(localStorage.getItem('sb_action_skills')); return { done: Array.isArray(l) && l.length > 0 }; } },
        { id: 'loadout', icon: '🔥', title: 'スキルを装備しよう', hint: '作ったスキルをZ・X・C・Vの枠にセットすると、戦闘中に使えるよ（エネルギーはクイズ正解で溜まる）', reward: 200, target: '.menu-btn[data-section="skills"]',
          check: c => { const l = parse(localStorage.getItem('sb_action_loadout')); return { done: Array.isArray(l) && l.some(Boolean) }; } },
        { id: 'forge', icon: '🔨', title: 'コインでオリジナル武器を作ろう', hint: '武器庫の「🔨 オリジナル武器を作る」で、好きな名前の武器が作れる（ノーマルは100コインから）', reward: 500, target: '#openArmoryFromInv',
          check: c => ({ done: !!(c.h && c.h.weapons && c.h.weapons.some(w => w.custom)) }) },
        { id: 'pvp', icon: '⚔️', title: 'オンラインマッチに参加しよう', hint: '右上の「⚔️」から。1人で出発すればボット練習になるよ', reward: 300, target: '#pvpBtn',
          check: c => ({ done: !!(c.h && c.h.pvpPlayed) }) },
        { id: 'rift', icon: '🌀', title: '第一世界のボス「深淵の裂け目」をクリアしよう', hint: '第一世界の最後のステージ。クリアすると、次の世界への門が現れる（ノーマルでもOK）', reward: 1000, target: '#openStageGateFromInv',
          check: c => ({ done: ((c.h && c.h.cleared && c.h.cleared.abyssal_rift) || 0) > 0 }) }
    ];
    // スタンダードキャラ（まだ遊び込んでいない人）には、シーズンワールドへの案内だけを出す
    const MISSIONS_STD = [
        { id: 'joinSeason', icon: '🌟', title: 'シーズンワールドに参加しよう', hint: '右上の「🏆」から、シーズンキャラを作って参加しよう。第一〜第五世界はシーズンキャラで遊ぶよ', reward: 300, target: '#seasonBtn',
          check: c => { const s = seasonState(); return { done: !!(s.active === 'season' || (s.slots && s.slots.season && s.slots.season.player)) }; } }
    ];

    // ---------- 保存 ----------
    function loadAll() { return parse(localStorage.getItem(KEY)) || {}; }
    function saveAll(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
    function me() { const p = player(); return p && p.id ? String(p.id) : null; }
    function stateOf(all, pid, p, h) {
        let st = all[pid];
        if (!st) {
            // はじめて見るキャラ。もう遊び込んでいる人にはミッションを出さない
            // 別の端末で引き継いだキャラなど「進捗はあるのに、この端末にはミッションの記録が無い」場合は、
            // すでに達成済みのものを報酬なしで済みにして、残りだけを表示する（evaluate() で処理）
            st = all[pid] = { done: {}, ev: {}, veteran: false, min: false, fresh: true };
        }
        return st;
    }
    function list() { const s = seasonState(); return (s.active === 'season') ? MISSIONS : MISSIONS_STD; }
    const isSeasonChar = () => seasonState().active === 'season';

    // ---------- 判定 ----------
    let lastView = null;
    function evaluate() {
        const pid = me(); if (!pid) { lastView = null; return null; }
        const p = player(), h = hackData(), all = loadAll(), st = stateOf(all, pid, p, h);
        if (st.veteran) { saveAll(all); lastView = null; return null; }
        const ms = list(), ctx = { p: p, h: h, ev: st.ev };
        if (st.fresh) {
            st.fresh = false;
            // 行動の記録（ev）は端末ごとなので、進捗から推測する
            if (clearedCount(h) > 0) st.ev.gate = true;
            if (clearedCount(h) > 0 && h && h.weapons && h.weapons.length > 1) st.ev.armory = true;
            ms.forEach(m => { if (m.check(ctx).done) st.done[m.id] = true; });   // 報酬なしで済みにする
            if (ms.every(m => st.done[m.id])) st.veteran = true;
        }
        const gained = [];
        ms.forEach(m => { if (!st.done[m.id] && m.check(ctx).done) { st.done[m.id] = true; gained.push(m); } });
        if (gained.length) {
            const coins = gained.reduce((a, m) => a + m.reward, 0);
            const pp = player(); if (pp) { pp.coins = (pp.coins || 0) + coins; try { localStorage.setItem('player', JSON.stringify(pp)); } catch (e) {} }
            toast('🎉 ミッション達成！　' + gained.map(m => m.title).join(' / ') + '　+' + coins + 'コイン');
        }
        saveAll(all);
        const cur = ms.find(m => !st.done[m.id]) || null;
        lastView = { st: st, ms: ms, cur: cur, info: cur ? cur.check(ctx) : null, done: ms.filter(m => st.done[m.id]).length };
        return lastView;
    }

    // ---------- 画面 ----------
    function css() {
        if (document.getElementById('bmCss')) return;
        const s = document.createElement('style'); s.id = 'bmCss';
        s.textContent = [
            '#bmTracker{position:fixed;left:8px;bottom:8px;z-index:9000;width:min(290px,86vw);background:rgba(20,26,50,.94);color:#e6ecff;border:1px solid #ffd36a;border-radius:12px;padding:8px 10px;font-size:.82rem;line-height:1.45;box-shadow:0 4px 16px rgba(0,0,0,.45)}',
            '#bmTracker .bm-h{display:flex;justify-content:space-between;align-items:center;font-weight:bold;color:#ffd36a;cursor:pointer}',
            '#bmTracker .bm-t{font-size:.95rem;font-weight:bold;margin:4px 0 2px}',
            '#bmTracker .bm-hint{color:#b9c8ee;font-size:.78rem}',
            '#bmTracker .bm-bar{height:6px;background:#2a3358;border-radius:3px;margin:5px 0 2px;overflow:hidden}#bmTracker .bm-bar i{display:block;height:100%;background:#ffd36a}',
            '#bmTracker button{background:#3a6ee8;color:#fff;border:0;border-radius:8px;padding:3px 9px;margin:4px 6px 0 0;cursor:pointer;font-size:.78rem}',
            '#bmTracker.min{width:auto;padding:5px 10px}',
            // スマホ（狭い画面）：左下はジョイスティック、上はツールバーとチャットがあるので、下の中央に小さく出す
            '@media (max-width:700px),(max-height:520px){#bmTracker{left:50%;transform:translateX(-50%);bottom:calc(6px + env(safe-area-inset-bottom,0px));width:min(260px,58vw);font-size:.74rem;padding:6px 8px;z-index:100010}#bmTracker.min{width:auto}}',
            '.bm-glow{animation:bmGlow 1.1s ease-in-out infinite;position:relative;z-index:1}',
            '@keyframes bmGlow{0%,100%{box-shadow:0 0 0 0 rgba(255,211,106,.0)}50%{box-shadow:0 0 0 5px rgba(255,211,106,.85)}}',
            '.bm-toast{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:100020;background:#2a1f5a;color:#fff;border:1px solid #ffd36a;border-radius:12px;padding:10px 14px;max-width:92vw;font-size:.9rem;text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.5)}',
            '.bm-ov{position:fixed;inset:0;background:rgba(5,8,20,.78);z-index:100015;display:flex;align-items:center;justify-content:center;padding:10px}',
            '.bm-box{background:#141a2e;color:#e6ecff;border:1px solid #3a4a80;border-radius:14px;width:min(520px,100%);max-height:90vh;overflow:auto;padding:14px 16px;font-size:.9rem}',
            '.bm-row{padding:6px 8px;border-radius:8px;margin:4px 0;background:#1c2542}.bm-row.done{opacity:.6}.bm-row.cur{border:1px solid #ffd36a}'
        ].join('');
        document.head.appendChild(s);
    }
    function toast(text) {
        css();
        const t = document.createElement('div'); t.className = 'bm-toast'; t.textContent = text; document.body.appendChild(t);
        setTimeout(() => t.remove(), 6500);
    }
    let glowEl = null;
    function glow(sel) {
        if (glowEl) { glowEl.classList.remove('bm-glow'); glowEl = null; }
        if (!sel) return;
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { el.classList.add('bm-glow'); glowEl = el; }
    }
    function openList() {
        const v = lastView; if (!v) return;
        css();
        const ov = document.createElement('div'); ov.className = 'bm-ov';
        const box = document.createElement('div'); box.className = 'bm-box'; ov.appendChild(box);
        const h2 = document.createElement('h2'); h2.style.margin = '0 0 6px'; h2.textContent = '📘 ビギナーミッション　' + v.done + ' / ' + v.ms.length; box.appendChild(h2);
        v.ms.forEach(m => {
            const r = document.createElement('div'); r.className = 'bm-row' + (v.st.done[m.id] ? ' done' : '') + (v.cur && v.cur.id === m.id ? ' cur' : '');
            const a = document.createElement('div'); a.textContent = (v.st.done[m.id] ? '✅ ' : (v.cur && v.cur.id === m.id ? '▶ ' : '⬜ ')) + m.icon + ' ' + m.title + '　(+' + m.reward + 'コイン)'; a.style.fontWeight = 'bold';
            const b = document.createElement('div'); b.textContent = m.hint; b.style.cssText = 'font-size:.78rem;color:#b9c8ee';
            r.appendChild(a); r.appendChild(b); box.appendChild(r);
        });
        const x = document.createElement('button'); x.textContent = '閉じる'; x.style.cssText = 'margin-top:8px;background:#3a4468;color:#fff;border:0;border-radius:8px;padding:6px 14px;cursor:pointer';
        x.addEventListener('click', () => ov.remove()); box.appendChild(x);
        ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
    }
    function render() {
        const v = evaluate();
        let box = document.getElementById('bmTracker');
        if (!v) { if (box) box.remove(); glow(null); return; }
        css();
        if (!box) { box = document.createElement('div'); box.id = 'bmTracker'; document.body.appendChild(box); }
        box.className = v.st.min ? 'min' : '';
        box.textContent = '';
        const head = document.createElement('div'); head.className = 'bm-h';
        const ht = document.createElement('span'); ht.textContent = '📘 ビギナーミッション ' + v.done + '/' + v.ms.length;
        const hm = document.createElement('span'); hm.textContent = v.st.min ? '▲' : '▼';
        head.appendChild(ht); head.appendChild(hm);
        head.addEventListener('click', () => { const all = loadAll(), pid = me(); if (all[pid]) { all[pid].min = !all[pid].min; saveAll(all); render(); } });
        box.appendChild(head);
        if (v.st.min) { glow(v.cur && v.cur.target); return; }
        if (!v.cur) {
            const t = document.createElement('div'); t.className = 'bm-t'; t.textContent = '🎉 ビギナーミッション、全部クリア！'; box.appendChild(t);
            const s = document.createElement('div'); s.className = 'bm-hint'; s.textContent = 'ここからは自由に冒険しよう。次の目標は、第二世界への門と、シーズンの完走！'; box.appendChild(s);
            const c = document.createElement('button'); c.textContent = '閉じる'; c.addEventListener('click', () => { const all = loadAll(), pid = me(); if (all[pid]) { all[pid].veteran = true; saveAll(all); render(); } }); box.appendChild(c);
            glow(null); return;
        }
        const t = document.createElement('div'); t.className = 'bm-t'; t.textContent = v.cur.icon + ' ' + v.cur.title; box.appendChild(t);
        if (v.info && v.info.ratio != null) {
            const bar = document.createElement('div'); bar.className = 'bm-bar'; const i = document.createElement('i'); i.style.width = Math.max(2, Math.min(100, v.info.ratio * 100)) + '%'; bar.appendChild(i); box.appendChild(bar);
            const tx = document.createElement('div'); tx.className = 'bm-hint'; tx.textContent = v.info.text; box.appendChild(tx);
        }
        const hint = document.createElement('div'); hint.className = 'bm-hint'; hint.textContent = v.cur.hint; box.appendChild(hint);
        const rw = document.createElement('div'); rw.className = 'bm-hint'; rw.style.color = '#ffd36a'; rw.textContent = '報酬：' + v.cur.reward + ' コイン'; box.appendChild(rw);
        const lb = document.createElement('button'); lb.textContent = 'ミッション一覧'; lb.addEventListener('click', openList); box.appendChild(lb);
        glow(v.cur.target);
    }

    // 行動の記録（各画面から呼ばれる）
    function event(name) {
        const pid = me(); if (!pid) return;
        const all = loadAll(); if (!all[pid]) { render(); return; }
        all[pid].ev = all[pid].ev || {}; all[pid].ev[name] = true; saveAll(all);
        render();
    }

    function start() {
        if (!document.getElementById('uiSettingsBtn')) return;      // 町の画面だけ
        setTimeout(render, 1200);                                    // ワールド選択などが落ち着いてから
        setInterval(render, 3000);
        window.addEventListener('storage', render);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.SbBeginner = { event: event, render: render, MISSIONS: MISSIONS };
})();
