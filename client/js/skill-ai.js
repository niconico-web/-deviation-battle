// ============================================================
// skill-ai.js ― スキル編集画面（action-skills.html）の「AIにスキルを作ってもらう」
//  文章 → サーバー（skillai:generate）→ 設計図(JSON) → 編集欄に入る → 自分で手直しして保存
//  ・AIが使えるのは「いま解放済みの形・グリフ」だけ（解放の進行を飛ばせないように、送る前に絞る）
//  ・設計図は、サーバーと端末の両方で ActionSkills.normalize() によって上限内に丸められる
// ============================================================
(function () {
    'use strict';
    const AS = window.ActionSkills;
    const $ = (id) => document.getElementById(id);
    if (!AS || !$('aiBtn')) return;

    const REASONS = {
        busy: 'いま別の設計を処理中です。少し待ってください',
        too_fast: '続けて送りすぎです。数秒待ってからもう一度',
        daily_limit: '今日はAIで作れる回数の上限に達しました。明日また使えます（手動で作るのは何回でもできます）',
        too_short: '説明をもう少し詳しく書いてください（4文字以上）',
        invalid: 'キャラクターデータが見つかりません。町の画面を一度開いてから戻ってください',
        server_error: 'うまく作れませんでした。もう一度試してください'
    };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    let sock = null;
    function getSock() { if (!sock && window.io) sock = window.io(); return sock; }
    function playerId() { try { const p = JSON.parse(localStorage.getItem('player') || 'null'); return p && p.id ? String(p.id) : null; } catch (e) { return null; } }

    function request(payload) {
        return new Promise((resolve) => {
            const s = getSock();
            if (!s) { resolve({ ok: false, reason: 'offline' }); return; }
            s.timeout(40000).emit('skillai:generate', payload, (err, res) => resolve(err ? { ok: false, reason: 'timeout' } : res));
        });
    }

    let busy = false;
    async function run() {
        if (busy) return;
        const text = $('aiText').value.trim();
        const out = $('aiResult');
        const pid = playerId();
        if (!pid) { out.innerHTML = '<span class="warn">' + REASONS.invalid + '</span>'; return; }
        if (text.length < 4) { out.innerHTML = '<span class="warn">' + REASONS.too_short + '</span>'; return; }

        busy = true; $('aiBtn').disabled = true; $('aiBtn').textContent = '設計中…';
        out.textContent = 'AIがスキルを考えています…';
        const allowForms = Object.keys(AS.FORMS).filter((k) => AS.isFormUnlocked(k));
        const allowEffects = Object.keys(AS.EFFECTS).filter((k) => AS.isGlyphUnlocked(k));
        const res = await request({ playerId: pid, text: text, allowForms: allowForms, allowEffects: allowEffects, special: AS.playerSpecial() });
        busy = false; $('aiBtn').disabled = false; $('aiBtn').textContent = 'AIで設計する';

        if (!res || !res.ok) {
            const why = res && res.reason;
            out.innerHTML = '<span class="warn">' + esc(REASONS[why] || (why === 'offline' || why === 'timeout' ? 'サーバーに接続できませんでした。通信できる状態でもう一度お試しください' : REASONS.server_error)) + '</span>';
            return;
        }
        const applied = window.__skillBuilder.apply(res.spec);
        const lines = [];
        lines.push((res.ai ? '🤖 ' : '📝 ') + esc(res.summary || 'スキルを作りました') + ' → 下の欄に入れました。手直ししてから保存してください。');
        // 解放前・枠不足などで、端末側で外れた部品があれば知らせる
        const dropped = (res.spec.effects || []).filter((e) => (applied.effects || []).indexOf(e) === -1).map((e) => AS.EFFECTS[e] ? AS.EFFECTS[e].name : e);
        if (dropped.length) lines.push('<span class="warn">※ 入りきらなかった／未解放の効果：' + esc(dropped.join('、')) + '</span>');
        (res.unsupported || []).forEach((u) => lines.push('<span class="warn">※ 再現できなかった部分：' + esc(u) + '</span>'));
        out.innerHTML = lines.join('<br>');
        if (typeof res.left === 'number') $('aiLeft').textContent = '今日あと ' + res.left + ' 回';
        window.__skillBuilder.say('');
    }

    $('aiBtn').addEventListener('click', run);
    $('aiText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
})();
