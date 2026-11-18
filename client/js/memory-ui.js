// ============================================
// School Battle
// memory-ui.js（復習・統計の画面）
// ============================================
// 中身の計算は memory.js（SBMemory）。ここは画面だけ。
//   ・いつ、どんな復習をしたらいいか（アドバイス・復習の予定・忘却曲線）
//   ・教科ごとの統計（回答数・正答率・定着度・勉強時間）、苦手な問題
//   ・その場で復習するクイズ
//   ・ステージ・ボス戦（オンラインマッチ以外）で出題する問題を、自作の問題リストに切り替える
(function (global) {
    'use strict';
    const M = () => global.SBMemory, esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const LAB = s => (M().SUBJECT_LABEL[s] || s);
    const COLORS = { math: '#4ac8ff', math_hard: '#3a6ee8', jp: '#ff7a9a', eng: '#ffd84a', sci: '#7fd13b', soc: '#c06aff', list: '#ffa13a', other: '#9aa6c0' };
    const col = s => COLORS[s] || COLORS.other;
    const pct = v => Math.round(v * 100) + '%';
    const fmtTime = sec => sec >= 3600 ? Math.floor(sec / 3600) + '時間' + Math.floor(sec % 3600 / 60) + '分' : Math.floor(sec / 60) + '分';

    function lists() { try { const p = global.getPlayerData ? global.getPlayerData() : null; return (p && p.questionLists) || []; } catch (e) { return []; } }
    function curListId() { try { return localStorage.getItem('sbQuizList') || ''; } catch (e) { return ''; } }
    function setListId(id) { try { if (id) localStorage.setItem('sbQuizList', id); else localStorage.removeItem('sbQuizList'); } catch (e) { /* 保存できない端末でも画面は使える */ } }

    // ---------- グラフ（SVG）----------
    function lineChart(series, days, h) {      // series: [{ label, color, vals(0..1) }]
        const W = 320, H = h || 150, L = 32, R = 8, T = 8, B = 20, pw = W - L - R, ph = H - T - B;
        const x = i => L + pw * i / days, y = v => T + ph * (1 - v);
        let g = '';
        [0, 0.25, 0.5, 0.75, 1].forEach(v => { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#2b3550" stroke-width="1"/><text x="' + (L - 4) + '" y="' + (y(v) + 3) + '" text-anchor="end" font-size="9" fill="#8a97b8">' + Math.round(v * 100) + '%</text>'; });
        g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0.9) + '" y2="' + y(0.9) + '" stroke="#7aff9a" stroke-dasharray="4 3" stroke-width="1"/><text x="' + (W - R) + '" y="' + (y(0.9) - 3) + '" text-anchor="end" font-size="9" fill="#7aff9a">復習の目安 90%</text>';
        for (let i = 0; i <= days; i += (days > 10 ? 2 : 1)) g += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="#8a97b8">' + (i === 0 ? '今日' : i + '日後') + '</text>';
        series.forEach(s => { g += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2" points="' + s.vals.map((v, i) => x(i).toFixed(1) + ',' + y(Math.max(0, Math.min(1, v))).toFixed(1)).join(' ') + '"/>'; });
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:420px;background:#10131c;border-radius:8px;border:1px solid #2b3550">' + g + '</svg>';
    }
    function barChart(rows) {      // rows: [{ label, ok, ng }]
        const W = 320, H = 110, L = 6, B = 18, T = 6, n = rows.length, bw = (W - L * 2) / n, mx = Math.max(5, Math.max.apply(null, rows.map(r => r.ok + r.ng)));
        let g = '';
        rows.forEach((r, i) => { const x = L + i * bw + 2, w = bw - 4, hok = (H - T - B) * r.ok / mx, hng = (H - T - B) * r.ng / mx;
            g += '<rect x="' + x + '" y="' + (H - B - hok) + '" width="' + w + '" height="' + hok + '" fill="#4ad6a0"/><rect x="' + x + '" y="' + (H - B - hok - hng) + '" width="' + w + '" height="' + hng + '" fill="#ff7a7a"/>';
            if (i % 2 === (n % 2 ? 0 : 1)) g += '<text x="' + (x + w / 2) + '" y="' + (H - 5) + '" text-anchor="middle" font-size="8" fill="#8a97b8">' + r.day.slice(5).replace('-', '/') + '</text>'; });
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:420px;background:#10131c;border-radius:8px;border:1px solid #2b3550">' + g + '</svg><div style="font-size:.74rem;color:#8a97b8"><span style="color:#4ad6a0">■</span> 正解　<span style="color:#ff7a7a">■</span> 不正解</div>';
    }

    // ---------- 復習クイズ ----------
    function reviewQuiz(m, onEnd) {
        const items = M().dueItems().slice(0, 10), all = M()._load().items;
        if (!items.length) { alert('いま復習する問題はありません。'); return; }
        let i = 0, ok = 0, lock = false; const res = [];
        const distract = it => {
            const pool = Object.keys(all).map(k => all[k]).filter(x => x.a !== it.a && x.sub === it.sub).map(x => x.a); const outs = [it.a], seen = new Set(outs);
            for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); const t = pool[k]; pool[k] = pool[j]; pool[j] = t; }
            pool.forEach(a => { if (outs.length < 4 && !seen.has(a)) { seen.add(a); outs.push(a); } });
            if (!isNaN(parseFloat(it.a)) && String(parseFloat(it.a)) === String(it.a).trim()) { const n = parseFloat(it.a); [1, -1, 2, -2, 10, -10].forEach(d => { const v = String(n + d); if (outs.length < 4 && !seen.has(v)) { seen.add(v); outs.push(v); } }); }
            let k = 1; while (outs.length < 4) outs.push(it.a + '・' + k++);
            for (let a = outs.length - 1; a > 0; a--) { const b = Math.floor(Math.random() * (a + 1)); const t = outs[a]; outs[a] = outs[b]; outs[b] = t; }
            return outs;
        };
        function draw() {
            if (i >= items.length) {
                m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%"><h3 style="margin:0">復習おつかれさま！</h3><div style="font-size:1.1rem;margin:8px 0">' + ok + ' / ' + items.length + ' 問 正解</div>' +
                    res.map(r => '<div style="font-size:.84rem;padding:3px 0;color:' + (r.ok ? '#7aff9a' : '#ff9a9a') + '">' + (r.ok ? '○' : '×') + ' ' + esc(r.q) + ' → ' + esc(r.a) + '</div>').join('') + '<div style="margin-top:10px"><button type="button" class="sbl-btn green" id="rvDone">もどる</button></div></div>';
                m.body.querySelector('#rvDone').addEventListener('click', onEnd); return;
            }
            const it = items[i], o = distract(it);
            m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%"><div style="font-size:.8rem;color:#9fb3d9">復習 ' + (i + 1) + ' / ' + items.length + '　[' + esc(LAB(it.sub)) + ']　定着度 ' + pct(M().retention(it)) + '</div><div style="font-size:1.15rem;font-weight:bold;margin:10px 0;line-height:1.5">' + esc(it.q) + '</div>' +
                '<div id="rvC">' + o.map(a => '<button type="button" class="sbl-btn gray" data-a="' + esc(a) + '" style="display:block;width:100%;text-align:left;margin:4px 0;padding:10px">' + esc(a) + '</button>').join('') + '</div></div>';
            m.body.querySelectorAll('#rvC button').forEach(b => b.addEventListener('click', () => {
                if (lock) return; lock = true; const good = b.dataset.a === it.a; if (good) ok++;
                M().record({ q: it.q, a: it.a, subj: it.sub, src: it.src, ok: good }); res.push({ q: it.q, a: it.a, ok: good });
                b.style.background = good ? '#2e7d4f' : '#8a2f3a'; if (!good) m.body.querySelectorAll('#rvC button').forEach(x => { if (x.dataset.a === it.a) x.style.background = '#2e7d4f'; });
                setTimeout(() => { lock = false; i++; draw(); }, good ? 500 : 1400);
            }));
        }
        draw();
    }

    // ---------- 画面本体 ----------
    function open() {
        if (!global.SBLobbyUI || !M()) { alert('読み込みに失敗しました'); return; }
        const m = global.SBLobbyUI.modal('📈 復習・統計', null);
        function draw() {
            const st = M().stats(), sch = M().schedule(), tips = M().advice(), rec = M().recentDays(14), studyT = M().studyTime();
            const subs = Object.keys(st).sort((a, b) => st[b].total - st[a].total), nItems = Object.keys(M()._load().items).length;
            const fc = M().forecast(14), lastDay = M().recentDays(14);
            const series = [{ label: '全体（復習しない場合）', color: '#ffffff', vals: fc }];
            const bySub = {}; Object.keys(M()._load().items).forEach(k => { const it = M()._load().items[k], s = it.sub || 'other'; (bySub[s] = bySub[s] || []).push(it); });
            Object.keys(bySub).filter(s => bySub[s].length >= 3).slice(0, 5).forEach(s => { const vals = []; for (let d = 0; d <= 14; d++) { let sum = 0; bySub[s].forEach(it => { sum += M().retention(it, Date.now() + d * 86400000); }); vals.push(sum / bySub[s].length); } series.push({ label: LAB(s), color: col(s), vals: vals }); });
            const lst = lists(), cur = curListId(), curOk = cur && lst.some(l => l.id === cur && (l.questions || []).length >= 4);
            const SCH = [['今日（復習のタイミング）', sch.now, '#ff7a7a'], ['明日まで', sch.d1, '#ffa13a'], ['2〜3日以内', sch.d3, '#ffd84a'], ['4〜7日以内', sch.d7, '#7fd13b'], ['それ以降', sch.later, '#4ac8ff']], mxS = Math.max(1, ...SCH.map(x => x[1]));
            m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%">' +
                '<div class="sbl-card" style="border-color:#7aff9a;cursor:default"><b>🧠 いつ・どんな復習をする？</b><div style="font-size:.84rem;line-height:1.7;margin-top:4px">' + tips.map(t => '・' + esc(t)).join('<br>') + '</div>' +
                '<div style="margin-top:8px"><button type="button" class="sbl-btn orange" id="mmReview"' + (sch.now ? '' : ' disabled style="opacity:.5"') + '>🔁 いま復習する（' + Math.min(10, sch.now) + '問）</button></div></div>' +
                '<div class="sbl-sec">復習の予定（記録した問題 ' + nItems + '問）</div>' + SCH.map(x => '<div style="display:flex;align-items:center;gap:6px;font-size:.82rem;margin:2px 0"><span style="width:150px;flex:none">' + x[0] + '</span><div style="flex:1;background:#10131c;border-radius:6px;height:14px"><div style="width:' + Math.round(x[1] / mxS * 100) + '%;height:100%;background:' + x[2] + ';border-radius:6px"></div></div><b style="width:36px;text-align:right">' + x[1] + '</b></div>').join('') +
                '<div class="sbl-sec">忘却曲線（このまま復習しなかった場合の、覚えている確率の予想）</div>' + (nItems ? lineChart(series, 14) + '<div style="font-size:.76rem;margin-top:3px">' + series.map(s => '<span style="color:' + s.color + '">━</span> ' + esc(s.label)).join('　') + '</div><div style="font-size:.76rem;color:#8a97b8;margin-top:3px">時間がたつと忘れます。確率が緑の線（90%）を下回る前に復習すると、次に忘れるまでの時間がどんどん長くなります。</div>' : '<div style="color:#778;font-size:.84rem">問題に答えると、ここにグラフが出ます。</div>') +
                '<div class="sbl-sec">教科ごとの統計</div>' + (subs.length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8rem"><tr style="color:#9fb3d9;text-align:right"><th style="text-align:left">教科</th><th>回答</th><th>正答率</th><th>定着度</th><th>復習待ち</th><th>勉強時間</th></tr>' +
                    subs.map(s => { const o = st[s]; return '<tr style="border-top:1px solid #232a3d;text-align:right"><td style="text-align:left;color:' + col(s) + '">' + esc(LAB(s)) + '</td><td>' + o.total + '</td><td>' + pct(o.acc) + '</td><td>' + (o.items ? pct(o.ret) : '-') + '</td><td>' + o.due + '</td><td>' + (studyT[s] ? fmtTime(studyT[s]) : '-') + '</td></tr>'; }).join('') + '</table></div>' : '<div style="color:#778;font-size:.84rem">まだ回答の記録がありません。</div>') +
                (Object.keys(studyT).length ? '<div style="font-size:.78rem;color:#9fb3d9;margin-top:4px">勉強タイマーの時間：' + Object.keys(studyT).map(s => esc(LAB(s)) + ' ' + fmtTime(studyT[s])).join('／') + '</div>' : '') +
                '<div class="sbl-sec">直近14日の回答数</div>' + barChart(rec) +
                '<div class="sbl-sec">苦手な問題</div>' + (M().weakItems(8).length ? M().weakItems(8).map(it => '<div style="font-size:.82rem;padding:3px 0;border-bottom:1px solid #232a3d"><span style="color:' + col(it.sub) + '">[' + esc(LAB(it.sub)) + ']</span> ' + esc(it.q) + ' → <b>' + esc(it.a) + '</b> <small style="color:#ff9a9a">×' + it.ng + '</small> <small style="color:#9fb3d9">定着度 ' + pct(M().retention(it)) + '</small></div>').join('') : '<div style="color:#778;font-size:.84rem">間違えた問題はまだありません。</div>') +
                '<div class="sbl-sec">設定</div>' +
                '<label style="font-size:.86rem;display:block;margin:4px 0"><input type="checkbox" id="mmRev"' + (M().reviewOn() ? ' checked' : '') + '> ステージ・ボス戦のクイズで、復習のタイミングの問題を優先して出す</label>' +
                '<div style="font-size:.86rem;margin:8px 0 2px">ステージ・ボス戦などで出題する問題（オンラインマッチは、いつも標準の問題です）</div>' +
                '<select id="mmList" style="padding:6px;max-width:100%"><option value="">標準の問題（学年・教科）</option>' + lst.map(l => '<option value="' + esc(l.id) + '"' + (l.id === cur ? ' selected' : '') + (((l.questions || []).length < 4) ? ' disabled' : '') + '>' + esc(l.name) + '（' + (l.questions || []).length + '問' + ((l.questions || []).length < 4 ? '：4問以上で使えます' : '') + '）</option>').join('') + '</select>' +
                '<div style="font-size:.78rem;color:' + (curOk ? '#7aff9a' : '#8a97b8') + ';margin-top:3px">' + (curOk ? '✔ 自作の問題リストで出題します（正解でエネルギー）。' : '標準の問題で出題します。') + '</div>' +
                '<div style="margin-top:6px"><button type="button" class="sbl-btn gray" id="mmNewList">＋ 問題リストを作る・編集する</button></div>' +
                '<div style="margin-top:14px"><button type="button" class="sbl-btn gray" id="mmReset" style="font-size:.74rem">記録をすべて消す</button></div></div>';
            const rv = m.body.querySelector('#mmReview'); if (rv) rv.addEventListener('click', () => { if (!rv.disabled) reviewQuiz(m, draw); });
            m.body.querySelector('#mmRev').addEventListener('change', e => M().setReview(e.target.checked));
            m.body.querySelector('#mmList').addEventListener('change', e => { setListId(e.target.value); draw(); });
            m.body.querySelector('#mmNewList').addEventListener('click', () => { const b = document.getElementById('questionListCreateBtn'); if (b) { m.close(); b.click(); } else alert('問題リストの画面から作成できます。'); });
            m.body.querySelector('#mmReset').addEventListener('click', () => { if (confirm('復習の記録（忘却曲線・統計）をすべて消します。よろしいですか？（勉強タイマーの記録は消えません）')) { M().reset(); draw(); } });
        }
        draw();
    }
    global.SBMemoryUI = { open: open };
    document.addEventListener('click', e => { const b = e.target && e.target.closest && e.target.closest('#memBtn'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation(); open(); }, true);
})(window);
