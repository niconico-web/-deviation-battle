// ============================================================
//  innate-ui.js ― スキル工房の「🌀 固有能力」
//   ・1キャラに1つ。「水を操る能力にしたい」のように書くと、AIが原理と、基本能力1つ＋応用能力3つ（戦闘中に動くコード付き）を作る
//   ・確定する前に、隔離環境で試し撃ち（コードが動くか・何か起きるか）を自動で行い、結果を見せる
//   ・確定すると、スキル一覧に並び、装備スロットにはめ込める（編集・削除はできない）
//   ・応用能力は、習熟度（勉強するほど上がる）3と6で1枠ずつ後から追加できる。AIが「原理に合うか」を判定して、合えば制約つきで作る
//  保存先：localStorage "sbInnate"（action-skills.js の saveInnate）／サーバー：innate:create・innate:extend
// ============================================================
(function () {
    'use strict';
    const AS = window.ActionSkills, RT = window.InnateRuntime;
    const card = document.getElementById('innateCard');
    if (!AS || !card) return;

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const REASONS = {
        busy: 'いま別の設計を処理中です。少し待ってください',
        too_fast: '続けて送りすぎです。数秒待ってからもう一度',
        daily_limit: '今日はAIで作れる回数の上限に達しました。明日また使えます',
        too_short: '説明をもう少し詳しく書いてください（4文字以上）',
        invalid: 'キャラクターデータが見つかりません。町の画面を一度開いてから戻ってください',
        server_error: 'うまく作れませんでした。もう一度試してください',
        offline: 'サーバーに接続できません。通信できる状態でもう一度お試しください',
        timeout: '時間がかかりすぎました。もう一度試してください'
    };
    let sock = null;
    const getSock = () => { if (!sock && window.io) sock = window.io(); return sock; };
    const player = () => { try { return JSON.parse(localStorage.getItem('player') || 'null'); } catch (e) { return null; } };
    const request = (ev, payload) => new Promise((resolve) => {
        const s = getSock();
        if (!s) { resolve({ ok: false, reason: 'offline' }); return; }
        s.timeout(70000).emit(ev, payload, (err, res) => resolve(err ? { ok: false, reason: 'timeout' } : res));
    });
    const asCode = (sk, id) => Object.assign({}, sk, { id: id, innate: true, kind: 'code', form: 'projectile', effects: ['damage'], augments: [] });

    let pending = null;       // 確定前の案 { ability } または { extend: skill }
    let busy = false;
    const isSeason = () => { try { return AS.currentMode() === 'season'; } catch (e) { return false; } };

    // ---------- 部品 ----------
    function chips(sk) {
        return (sk.constraints || []).map(k => { const c = AS.INNATE_CONSTRAINTS[k]; return c ? '<span class="ia-chip" title="' + esc(c.desc) + '">' + c.icon + ' ' + esc(c.name) + '</span>' : ''; }).join('');
    }
    function skillBlock(sk, label, test) {
        const c = AS.compute(asCode(sk, 'preview'));
        const t = test === undefined ? '' : test === null ? '<span class="ia-test">⏳ 試し撃ち中…</span>' : test.ok ? '<span class="ia-test ok">✅ 試し撃ちOK（命令' + test.cmds + '個）</span>' : '<span class="ia-test ng">⚠ ' + esc(test.error || '動きませんでした') + '</span>';
        return '<div class="ia-skill"><div><b>' + esc(label) + '：' + esc(sk.name) + '</b>' + (sk.passive ? ' <span class="ia-chip" title="戦闘が始まると自動で動き続けます（装備スロットに入れておく）">♾ 常時</span>' : '') + ' <span class="ia-meta">階級' + sk.tier + ' ｜ 消費' + c.cost + ' ｜ CT' + c.cooldown.toFixed(1) + 's</span> ' + t + '</div>' +
            '<div class="ia-desc">' + esc(sk.desc || '') + '</div><div>' + chips(sk) + '</div>' +
            (sk.lore ? '<div class="ia-lore">「' + esc(sk.lore) + '」</div>' : '') +
            '<details><summary>コードを見る</summary><pre>' + esc(sk.code) + '</pre></details></div>';
    }
    function principleBlock(a) {
        return '<div class="ia-principle"><div><b>原理</b>：' + esc(a.principle) + '</div>' +
            '<div class="ia-meta">できること：' + esc((a.can || []).join('／')) + '</div><div class="ia-meta">できないこと：' + esc((a.cannot || []).join('／')) + '</div>' +
            (a.lore ? '<div class="ia-lore">「' + esc(a.lore) + '」</div>' : '') + '</div>';
    }

    // ---------- 試し撃ち ----------
    async function runTests(skills, onEach) {
        if (!RT || !RT.selfTest) return skills.map(() => ({ ok: true, cmds: 0 }));
        const out = [];
        for (let i = 0; i < skills.length; i++) {
            let r; try { r = await RT.selfTest(asCode(skills[i], 'test_' + i)); } catch (e) { r = { ok: false, error: '試し撃ちに失敗しました' }; }
            out.push(r); onEach && onEach(i, r);
        }
        return out;
    }

    // ---------- 描画 ----------
    function render() {
        const a = AS.getInnate();
        let h = '<h2>🌀 固有能力' + (isSeason() ? '（シーズンキャラ）' : '') + '</h2>';
        if (!a && !pending) h += introHtml();
        else if (!a && pending && pending.ability) h += previewHtml();
        else h += ownedHtml(a);
        h += '<div class="msg" id="iaMsg"></div>';
        card.innerHTML = css() + h;
        bind();
    }
    function say(t, err) { const m = document.getElementById('iaMsg'); if (m) { m.textContent = t || ''; m.className = 'msg' + (err ? ' err' : ''); } }
    function css() {
        return '<style>.ia-note{font-size:.76rem;color:#b9c3e0;line-height:1.6;margin:0 0 8px}.ia-skill{background:#1a1f33;border:1px solid #3a3566;border-radius:8px;padding:8px;margin:6px 0;font-size:.8rem}' +
            '.ia-meta{font-size:.72rem;color:#9aa6c4}.ia-desc{margin:2px 0}.ia-lore{font-size:.72rem;color:#c9b8ff;margin:2px 0}.ia-chip{display:inline-block;font-size:.68rem;background:#2a2347;border:1px solid #5a4a9a;border-radius:10px;padding:1px 7px;margin:2px 3px 0 0}' +
            '.ia-test{font-size:.7rem;margin-left:4px}.ia-test.ok{color:#7fe3a0}.ia-test.ng{color:#ff8a8a}.ia-principle{background:#161a2b;border:1px dashed #5a4a9a;border-radius:8px;padding:8px;margin:6px 0;font-size:.8rem;line-height:1.6}' +
            '.ia-bar{height:8px;background:#10131b;border:1px solid #3a4870;border-radius:6px;overflow:hidden;margin:4px 0}.ia-bar>i{display:block;height:100%;background:linear-gradient(90deg,#8b5cf6,#64d8ff)}' +
            '#innateCard textarea{width:100%;box-sizing:border-box;margin:6px 0;padding:8px;border-radius:8px;border:1px solid #3a4470;background:#10152b;color:#fff;font:inherit;resize:vertical}' +
            '#innateCard pre{white-space:pre-wrap;word-break:break-all;font-size:.68rem;background:#0c0f17;border:1px solid #2b3550;border-radius:6px;padding:6px;max-height:220px;overflow:auto}</style>';
    }
    function introHtml() {
        return '<p class="ia-note">1キャラにつき<b>1つだけ</b>持てる、あなただけの能力です。「どんな能力にしたいか」を書くと、AIが<b>能力の原理</b>と、<b>基本能力1つ＋応用能力3つ</b>を、戦闘中に動くコードごと作ります。' +
            '<br>強い力には代償がつきます（制約は少し厳しめ）。確定すると変更できないので、気に入るまで作り直してください（確定前なら何度でも。1日の回数には上限があります）。</p>' +
            '<textarea id="iaText" maxlength="300" rows="3" placeholder="例：水を操る能力にしたい　／　影に潜って移動する能力　／　重力を操る能力"></textarea>' +
            '<button class="primary" id="iaCreate">🌀 能力を生み出す</button>';
    }
    function previewHtml() {
        const a = pending.ability, tests = pending.tests || [];
        const allSk = [a.base].concat(a.apps);
        const done = tests.length === allSk.length, allOk = done && tests.every(t => t && t.ok);
        let h = '<div><b style="font-size:1.05rem">' + esc(a.name) + '</b> <span class="ia-meta">（' + esc(a.concept) + '）' + (pending.ai ? '' : ' ・簡易版') + '</span></div>' + principleBlock(a);
        (pending.notes || []).forEach(n => { h += '<div class="ia-meta" style="color:#ffd54a">※ ' + esc(n) + '</div>'; });
        h += skillBlock(a.base, '基本能力', tests[0]);
        a.apps.forEach((sk, i) => { h += skillBlock(sk, '応用能力' + (i + 1), tests[i + 1]); });
        h += '<p class="ia-note">この能力で<b>確定</b>すると、このキャラの固有能力になり、変更できなくなります。気に入らなければ「作り直す」（今日あと' + (pending.left == null ? '?' : pending.left) + '回）。</p>';
        h += '<button class="primary" id="iaConfirm"' + (allOk ? '' : ' disabled') + '>✅ この能力で確定する</button><button class="ghost" id="iaRedo">↺ 作り直す</button><button class="ghost" id="iaCancel">やめる</button>';
        if (!done) h += '<div class="ia-meta" style="margin-top:6px">試し撃ち中です…（隔離環境でコードを動かして確認しています）</div>';
        else if (!allOk) h += '<div class="ia-meta" style="margin-top:6px;color:#ff8a8a">動かないコードがあるため、確定できません。作り直してください。</div>';
        return h;
    }
    function ownedHtml(a) {
        const m = AS.innateMastery(a), extraMax = AS.innateExtraSlots(a), extraNow = (a.extra || []).length;
        const p = player(), study = p ? Number(p.totalStudySeconds) || 0 : 0;
        const into = m >= AS.INNATE_MASTERY_MAX ? 1 : (Math.max(0, study - (Number(a.studyBase) || 0)) % AS.INNATE_SEC_PER_MASTERY) / AS.INNATE_SEC_PER_MASTERY;
        const live = AS.innateSkills();
        let h = '<div><b style="font-size:1.05rem">' + esc(a.name) + '</b> <span class="ia-meta">（' + esc(a.concept) + '）</span></div>' + principleBlock(a);
        h += '<div class="ia-meta">習熟度 <b>' + m + ' / ' + AS.INNATE_MASTERY_MAX + '</b>（勉強30分ごとに+1。上がるほど制約が軽くなり、威力が少し伸びます）</div><div class="ia-bar"><i style="width:' + Math.round(into * 100) + '%"></i></div>';
        live.forEach(sk => { h += skillBlock(sk, sk.role === 'base' ? '基本能力' : '応用能力', undefined); });
        h += '<p class="ia-note">上の「装備スロット」で選ぶと、Z X C V にはめ込めます。</p>';
        // 応用能力の追加
        h += '<div class="ia-principle"><b>応用能力を追加</b>（' + extraNow + ' / ' + AS.INNATE_EXTRA_AT.length + '枠使用）';
        if (pending && pending.extend) {
            const t = pending.test;
            h += skillBlock(pending.extend, '追加案', t === undefined ? null : t);
            h += '<button class="primary" id="iaExtraOk"' + (t && t.ok ? '' : ' disabled') + '>追加する</button><button class="ghost" id="iaExtraNo">やめる</button>';
        } else if (extraNow >= extraMax) {
            const next = AS.INNATE_EXTRA_AT[extraNow];
            h += '<div class="ia-meta">' + (next ? '習熟度' + next + 'で、もう1枠開きます（あと' + Math.max(0, next - m) + '段階）。' : 'これ以上は追加できません。') + '</div>';
        } else {
            h += '<div class="ia-meta">「こんな応用能力がほしい」と伝えてください。能力の原理に合っていれば、制約つきで作ります。原理を越えるものは断られます。</div>' +
                '<textarea id="iaExtraText" maxlength="300" rows="2" placeholder="例：水を雨のように降らせて敵を足止めする"></textarea><button class="primary" id="iaExtra">🌀 応用能力を相談する</button>';
        }
        return h + '</div>';
    }

    // ---------- 操作 ----------
    function bind() {
        const $ = (id) => document.getElementById(id);
        if ($('iaCreate')) $('iaCreate').onclick = () => create($('iaText').value.trim());
        if ($('iaRedo')) $('iaRedo').onclick = () => create(pending.ability.concept);
        if ($('iaCancel')) $('iaCancel').onclick = () => { pending = null; render(); };
        if ($('iaConfirm')) $('iaConfirm').onclick = confirmCreate;
        if ($('iaExtra')) $('iaExtra').onclick = () => extend($('iaExtraText').value.trim());
        if ($('iaExtraOk')) $('iaExtraOk').onclick = confirmExtend;
        if ($('iaExtraNo')) $('iaExtraNo').onclick = () => { pending = null; render(); };
    }
    async function create(text) {
        if (busy) return;
        const p = player(); if (!p || !p.id) { say(REASONS.invalid, true); return; }
        if (!text || text.length < 4) { say(REASONS.too_short, true); return; }
        busy = true; say('AIが能力を考えています…（コードまで書くので、30秒〜1分ほどかかることがあります）');
        const res = await request('innate:create', { playerId: String(p.id), text: text });
        busy = false;
        if (!res || !res.ok) { say(REASONS[res && res.reason] || REASONS.server_error, true); return; }
        pending = { ability: res.ability, notes: res.notes || [], ai: !!res.ai, left: res.left, tests: [] };
        render();
        const sk = [res.ability.base].concat(res.ability.apps), mine = pending;
        mine.tests = await runTests(sk, () => { if (pending === mine) render(); });
        if (pending === mine) render();
    }
    function confirmCreate() {
        if (!pending || !pending.ability || AS.getInnate()) return;
        const a = pending.ability;
        if (!confirm('「' + a.name + '」を、このキャラの固有能力として確定します。\n\n固有能力は1キャラに1つだけで、確定後は変更できません。よろしいですか？')) return;
        const p = player();
        AS.saveInnate({
            v: 2, id: 'ia_' + Date.now().toString(36), concept: a.concept, name: a.name, principle: a.principle, can: a.can, cannot: a.cannot,
            keywords: a.keywords, element: a.element, lore: a.lore, studyBase: p ? Number(p.totalStudySeconds) || 0 : 0,
            base: a.base, apps: a.apps, extra: [], createdAt: Date.now()
        });
        location.reload();      // スキル一覧・装備スロットに反映する
    }
    async function extend(text) {
        if (busy) return;
        const a = AS.getInnate(), p = player(); if (!a || !p || !p.id) { say(REASONS.invalid, true); return; }
        if (!text || text.length < 4) { say(REASONS.too_short, true); return; }
        busy = true; say('AIが、原理に合う応用か判断しています…');
        const res = await request('innate:extend', { playerId: String(p.id), text: text, ability: { name: a.name, principle: a.principle, can: a.can, cannot: a.cannot, keywords: a.keywords, element: a.element, existing: [a.base].concat(a.apps, a.extra || []).map(s => s.name) } });
        busy = false;
        if (!res || !res.ok) { say(REASONS[res && res.reason] || REASONS.server_error, true); return; }
        if (!res.fits) { say('この応用能力は作れません：' + (res.reason || '原理に合いません') + '（今日あと' + (res.left == null ? '?' : res.left) + '回）', true); return; }
        pending = { extend: res.skill, test: null };
        render();
        const mine = pending;
        const r = (await runTests([res.skill]))[0];
        if (pending === mine) { mine.test = r; render(); if (res.note) say(res.note); }
    }
    function confirmExtend() {
        const a = AS.getInnate(); if (!a || !pending || !pending.extend) return;
        if ((a.extra || []).length >= AS.innateExtraSlots(a)) { say('追加できる枠がありません', true); return; }
        a.extra = (a.extra || []).concat([pending.extend]); AS.saveInnate(a);
        location.reload();
    }

    render();
})();
