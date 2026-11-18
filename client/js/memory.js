// ============================================
// School Battle
// memory.js（忘却曲線・復習スケジュール・教科別の統計）
// ============================================
// 問題に答えるたびに、その問題の「覚えている度合い」を記録する。
//   ・時間がたつと忘れる（忘却曲線）：覚えている確率 R = 0.9 ^ (経過日数 ÷ 定着日数)
//       定着日数 S = 「覚えている確率が 90% まで下がるまでの日数」。正解するほど S が伸び、間違えると縮む
//   ・復習の目安日 = 最後に答えた日 + S 日（ちょうど覚えている確率が 90% に下がるころ）
//   ・出題は、復習の目安を過ぎた問題を優先して混ぜる（ステージ・ボス戦のクイズ）
//   ・教科ごとの回答数・正答率・定着度・苦手な問題を集計する
// 保存先：localStorage の 'sbMemLog'（プレイヤーデータとは別。大きくなりすぎないよう、問題の数に上限がある）
(function (global) {
    'use strict';
    const KEY = 'sbMemLog', MAX_ITEMS = 1500, DAY = 86400000;
    const S_FIRST = 1, S_WRONG_MIN = 0.4, WRONG_MUL = 0.3, DAILY_KEEP = 120;
    const SUBJECT_LABEL = { math: '算数・数学', math_hard: '数学（発展）', jp: '国語', eng: '英語', sci: '理科', soc: '社会', list: '自作の問題リスト' };

    let db = null;
    function fresh() { return { v: 1, items: {}, daily: {}, tot: {}, set: { review: true } }; }
    function load() {
        if (db) return db;
        try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
        if (!db || typeof db !== 'object' || !db.items) db = fresh();
        db.daily = db.daily || {}; db.tot = db.tot || {}; db.set = db.set || { review: true };
        return db;
    }
    let saveT = null;
    function save() { if (saveT) return; saveT = setTimeout(() => { saveT = null; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 容量がいっぱいでも、ゲームは続ける */ } }, 400); }
    function saveNow() { if (saveT) { clearTimeout(saveT); saveT = null; } try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { /* 同上 */ } }

    function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
    const idOf = (q, a, src) => (src || 'd') + ':' + hash(String(q) + '|' + String(a));
    const dayStr = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const subjKey = s => String(s || '').startsWith('list') ? 'list' : (s || 'other');

    // ---- 忘却曲線 ----
    function retention(it, now) { const t = ((now || Date.now()) - it.last) / DAY; return Math.pow(0.9, Math.max(0, t) / Math.max(0.05, it.S)); }
    function dueAt(it) { return it.last + it.S * DAY; }
    function nextS(it, ok, now) {
        if (!it) return ok ? S_FIRST : S_WRONG_MIN;
        if (!ok) return Math.max(S_WRONG_MIN, Math.min(2, it.S * WRONG_MUL));      // 間違えたら、定着日数は大きく縮む（長く覚えていた問題でも、2日以内にもう一度出る）
        const R = retention(it, now);
        return Math.min(365, Math.max(S_FIRST, it.S) * (1.9 + 1.2 * (1 - R)));      // 忘れかけてから思い出せたほうが、定着は強くなる
    }

    // ---- 記録 ----
    // o: { q, a, subj, src, ok }。src：'d'=標準の問題、'l:<リストid>'=自作の問題リスト
    function record(o) {
        if (!o || o.q == null || o.a == null) return;
        const d = load(), now = Date.now(), id = idOf(o.q, o.a, o.src), ok = !!o.ok, subj = subjKey(o.subj);
        let it = d.items[id];
        const S = nextS(it, ok, now);
        if (!it) it = d.items[id] = { q: String(o.q).slice(0, 70), a: String(o.a).slice(0, 40), sub: o.subj || 'other', src: o.src || 'd', ok: 0, ng: 0, S: S, first: now, last: now, lapse: 0 };
        else { it.S = S; it.last = now; }
        if (ok) it.ok++; else { it.ng++; it.lapse++; }
        const day = dayStr(now), dd = d.daily[day] || (d.daily[day] = {}), ds = dd[subj] || (dd[subj] = [0, 0]); ds[ok ? 0 : 1]++;
        const tt = d.tot[subj] || (d.tot[subj] = [0, 0]); tt[ok ? 0 : 1]++;
        // 古い日の記録を整理する／問題の数に上限を設ける（長く見ていないものから捨てる。一度も間違えていないものを先に）
        const days = Object.keys(d.daily); if (days.length > DAILY_KEEP) days.sort().slice(0, days.length - DAILY_KEEP).forEach(k => delete d.daily[k]);
        const ids = Object.keys(d.items); if (ids.length > MAX_ITEMS) ids.sort((x, y) => ((d.items[x].ng ? 1 : 0) - (d.items[y].ng ? 1 : 0)) || (d.items[x].last - d.items[y].last)).slice(0, ids.length - MAX_ITEMS).forEach(k => delete d.items[k]);
        save();
    }

    // ---- 復習の対象 ----
    function dueItems(now, filter) {
        now = now || Date.now();
        return Object.keys(load().items).map(k => Object.assign({ id: k }, db.items[k])).filter(it => dueAt(it) <= now && (!filter || filter(it))).sort((a, b) => retention(a, now) - retention(b, now));
    }
    // 出題：復習の目安を過ぎた問題を、ときどき混ぜる。pool（いまの出題の候補）に含まれる問題だけを返す。なければ null
    function pickDue(pool, src) {
        const d = load(); if (!d.set.review) return null;
        const now = Date.now(), cand = [];
        const want = {}; pool.forEach(it => { want[idOf(it.q, it.a, src(it))] = it; });
        Object.keys(d.items).forEach(k => { const it = d.items[k]; if (want[k] && dueAt(it) <= now) cand.push({ k: k, r: retention(it, now) }); });
        if (!cand.length) return null;
        cand.sort((a, b) => a.r - b.r);
        const top = cand.slice(0, 6), pick = top[Math.floor(Math.random() * top.length)];
        return want[pick.k];
    }
    function reviewChance() { const n = dueItems().length; return n === 0 ? 0 : Math.min(0.5, 0.2 + n * 0.02); }

    // ---- 統計 ----
    function stats() {
        const d = load(), now = Date.now(), subs = {};
        Object.keys(d.tot).forEach(s => { subs[s] = { ok: d.tot[s][0], ng: d.tot[s][1], items: 0, ret: 0, due: 0, weak: 0 }; });
        Object.keys(d.items).forEach(k => {
            const it = d.items[k], s = subjKey(it.sub), o = subs[s] || (subs[s] = { ok: 0, ng: 0, items: 0, ret: 0, due: 0, weak: 0 });
            o.items++; o.ret += retention(it, now); if (dueAt(it) <= now) o.due++; if (it.lapse >= 2 && it.ng >= it.ok) o.weak++;
        });
        Object.keys(subs).forEach(s => { const o = subs[s]; o.ret = o.items ? o.ret / o.items : 0; o.total = o.ok + o.ng; o.acc = o.total ? o.ok / o.total : 0; });
        return subs;
    }
    function weakItems(n) { const d = load(); return Object.keys(d.items).map(k => Object.assign({ id: k }, d.items[k])).filter(it => it.ng > 0).sort((a, b) => (b.lapse - a.lapse) || (b.ng / (b.ok + b.ng) - a.ng / (a.ok + a.ng))).slice(0, n || 10); }
    // 直近 n 日の回答数（教科ごと）
    function recentDays(n) { const d = load(), out = [], now = Date.now(); for (let i = n - 1; i >= 0; i--) { const k = dayStr(now - i * DAY), dd = d.daily[k] || {}; let ok = 0, ng = 0; Object.keys(dd).forEach(s => { ok += dd[s][0]; ng += dd[s][1]; }); out.push({ day: k, ok: ok, ng: ng }); } return out; }
    // これからの復習の予定：今日（もう目安を過ぎた）・明日・2〜3日後・4〜7日後・それ以降
    function schedule() {
        const d = load(), now = Date.now(), b = { now: 0, d1: 0, d3: 0, d7: 0, later: 0 };
        Object.keys(d.items).forEach(k => { const t = (dueAt(d.items[k]) - now) / DAY; if (t <= 0) b.now++; else if (t <= 1) b.d1++; else if (t <= 3) b.d3++; else if (t <= 7) b.d7++; else b.later++; });
        return b;
    }
    // 全体の「覚えている確率」の予想：いま復習しなかった場合に、これから何日かでどう下がるか
    function forecast(days) {
        const d = load(), now = Date.now(), ids = Object.keys(d.items), out = [];
        for (let i = 0; i <= days; i++) { let sum = 0; ids.forEach(k => { sum += retention(d.items[k], now + i * DAY); }); out.push(ids.length ? sum / ids.length : 0); }
        return out;
    }
    // 1つの問題の忘却曲線（日数ごとの覚えている確率）
    function curveOf(it, days) { const out = []; for (let i = 0; i <= days; i++) out.push(Math.pow(0.9, i / it.S)); return out; }
    // 復習のアドバイス（文章）
    function advice() {
        const st = schedule(), subs = stats(), tips = [], lab = s => SUBJECT_LABEL[s] || s;
        if (!Object.keys(load().items).length) return ['まだ記録がありません。ステージやボス戦のクイズに答えると、その問題の「覚えている度合い」が記録されます。'];
        if (st.now > 0) tips.push('今日の復習：' + st.now + '問が、復習のタイミングです。覚えている確率が90%を切るころ（いま）に復習すると、いちばん定着します。');
        else tips.push('復習のタイミングを過ぎた問題は、いまはありません。');
        if (st.d1 > 0) tips.push('明日までに ' + st.d1 + '問が復習の時期になります。寝る前や朝に、短く見直すと効果的です。');
        const weak = Object.keys(subs).filter(s => subs[s].items >= 5).sort((a, b) => subs[a].ret - subs[b].ret)[0];
        if (weak && subs[weak].ret < 0.85) tips.push('いちばん忘れやすいのは「' + lab(weak) + '」（平均の定着度 ' + Math.round(subs[weak].ret * 100) + '%）。この教科を優先して復習しましょう。');
        const wk = weakItems(3); if (wk.length && wk[0].lapse >= 2) tips.push('何度も間違えている問題があります。答えだけでなく、理由や覚え方もノートに書くと定着しやすくなります。');
        tips.push('復習の間隔の目安：1日後 → 2日後 → 4日後 → 8日後 → 2週間後 …と、思い出せるたびに間隔が伸びます。間違えた問題は、半日〜2日後にもう一度。');
        return tips;
    }
    // 勉強タイマーの記録（教科ごとの勉強時間）。study-manager.js が保存している player.studyHistory を読む
    function studyTime() {
        const out = {}; let all = [];
        try { const p = global.getPlayerData ? global.getPlayerData() : JSON.parse(localStorage.getItem('player') || 'null'); all = (p && p.studyHistory) || []; } catch (e) { all = []; }
        all.forEach(r => { if (!r || !r.subject) return; out[r.subject] = (out[r.subject] || 0) + (r.time | 0); });
        return out;
    }
    function setReview(on) { load().set.review = !!on; saveNow(); }
    function reviewOn() { return !!load().set.review; }
    function reset() { db = fresh(); saveNow(); }

    global.SBMemory = { record: record, pickDue: pickDue, dueItems: dueItems, reviewChance: reviewChance, retention: retention, dueAt: dueAt, stats: stats, weakItems: weakItems, recentDays: recentDays, schedule: schedule,
        forecast: forecast, curveOf: curveOf, advice: advice, studyTime: studyTime, setReview: setReview, reviewOn: reviewOn, reset: reset, idOf: idOf, SUBJECT_LABEL: SUBJECT_LABEL, saveNow: saveNow, _load: load };
    global.addEventListener && global.addEventListener('pagehide', () => { try { saveNow(); } catch (e) { /* 閉じるときの保存に失敗しても何もしない */ } });
})(window);
