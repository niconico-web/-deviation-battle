// ============================================================
//  職業の画面（メインメニュー「職業」）
//   ・メイン職業・サブ職業の選択
//   ・選んだ職業の専用ツリー（3段階 × 形・グリフ・強化）。ポイントはレベル1につき1（メインとサブで共有）
//   ・全職業の一覧（固有効果・使える武器・形・グリフ）
//  ロジックは classes.js（ClassSys）。ここは表示と操作だけ。
// ============================================================
(function () {
    'use strict';
    const CS = () => window.ClassSys;
    const root = () => document.getElementById('classesRoot');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let msg = '', msgErr = false, openCard = null;

    function css() {
        if (document.getElementById('classesCss')) return;
        const st = document.createElement('style'); st.id = 'classesCss';
        st.textContent = '' +
            '#classesRoot .cl-note{font-size:.8rem;color:#b9c3e0;line-height:1.6;margin:4px 0 10px}' +
            '#classesRoot .cl-pts{display:inline-block;background:#1a2340;border:1px solid #3a4a80;border-radius:14px;padding:3px 12px;font-size:.85rem;margin-bottom:8px}' +
            '#classesRoot .cl-sel{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}' +
            '#classesRoot .cl-sel label{font-size:.8rem;color:#9aa6c4;display:flex;flex-direction:column;gap:3px;flex:1;min-width:150px}' +
            '#classesRoot select{padding:7px;border-radius:8px;border:1px solid #3a4470;background:#10152b;color:#fff;font:inherit}' +
            '#classesRoot .cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;margin:8px 0}' +
            '#classesRoot .cl-card{background:#161c33;border:1px solid #2f3a66;border-radius:10px;padding:9px;font-size:.78rem;line-height:1.5}' +
            '#classesRoot .cl-card.main{border-color:#ffd84a;box-shadow:0 0 0 1px #ffd84a55}' +
            '#classesRoot .cl-card.sub{border-color:#7fc8ff;box-shadow:0 0 0 1px #7fc8ff55}' +
            '#classesRoot .cl-card h4{margin:0 0 3px;font-size:.95rem}' +
            '#classesRoot .cl-tag{display:inline-block;font-size:.66rem;border-radius:8px;padding:0 6px;margin-left:4px;background:#27325c;color:#cfd8ff}' +
            '#classesRoot .cl-uniq{background:#10152b;border:1px dashed #4a5a98;border-radius:6px;padding:5px;margin:5px 0}' +
            '#classesRoot .cl-btns{display:flex;gap:6px;margin-top:6px}' +
            '#classesRoot .cl-btns button{flex:1;padding:5px;font-size:.75rem}' +
            '#classesRoot .cl-tree{background:#121830;border:1px solid #34407a;border-radius:10px;padding:10px;margin:10px 0}' +
            '#classesRoot .cl-tier{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0}' +
            '#classesRoot .cl-node{background:#1b2244;border:1px solid #39478a;border-radius:8px;padding:6px;font-size:.74rem;line-height:1.45;text-align:left;color:#fff;cursor:pointer}' +
            '#classesRoot .cl-node.done{background:#1f3b2c;border-color:#4fbf7a}' +
            '#classesRoot .cl-node.off{opacity:.45;cursor:not-allowed}' +
            '#classesRoot .cl-node.can{border-color:#ffd84a}' +
            '#classesRoot .cl-node b{display:block;font-size:.8rem}' +
            '#classesRoot .cl-msg{min-height:1.2em;font-size:.8rem;margin-top:6px;color:#9df0ff}#classesRoot .cl-msg.err{color:#ff9a9a}' +
            '#classesRoot .cl-role{font-size:.85rem;margin:12px 0 2px;color:#cfd8ff}' +
            '#classesRoot .cl-perks{margin-top:10px;padding-top:8px;border-top:1px dashed #4a5a98}' +
            '#classesRoot .cl-perk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px;margin:6px 0}' +
            '#classesRoot .cl-perk{background:#241a38;border:1px solid #6a4a98;border-radius:8px;padding:7px;font-size:.74rem;line-height:1.5;text-align:left;color:#fff;cursor:pointer}' +
            '#classesRoot .cl-perk.done{background:#3a2a10;border-color:#ffd84a;box-shadow:0 0 0 1px #ffd84a66}' +
            '#classesRoot .cl-perk.off{opacity:.5;cursor:not-allowed}' +
            '#classesRoot .cl-perk b{display:block;font-size:.82rem}' +
            '#classesRoot .cl-pro{color:#8fe8a8}#classesRoot .cl-con{color:#ff9a9a}';
        document.head.appendChild(st);
    }
    const rangeLabel = (r) => r === 'melee' ? '近距離（近接武器）' : '遠距離（弾・魔法の武器）';

    function selectHtml(id, label, value, exclude) {
        let h = '<label>' + label + '<select id="' + id + '"><option value="">（なし）</option>';
        Object.keys(CS().ROLES).forEach(role => {
            h += '<optgroup label="' + CS().ROLES[role].icon + ' ' + CS().ROLES[role].name + '">';
            CS().CLASSES.filter(c => c.role === role).forEach(c => { h += '<option value="' + c.id + '"' + (value === c.id ? ' selected' : '') + (exclude === c.id ? ' disabled' : '') + '>' + c.icon + ' ' + c.name + '</option>'; });
            h += '</optgroup>';
        });
        return h + '</select></label>';
    }

    function treeHtml(cid, slotLabel) {
        const sys = CS(), st = sys.state(), c = sys.BY_ID[cid], nodes = sys.treeNodes(cid);
        const pts = sys.pointsInfo();
        let h = '<div class="cl-tree"><b>' + c.icon + ' ' + esc(c.name) + 'の専用ツリー</b> <span class="cl-tag">' + slotLabel + (slotLabel === 'サブ' ? '：固有効果・強化は半分／先頭の' + sys.SUB_SLOTS + '段階まで' : '') + '</span>';
        for (let t = 1; t <= 3; t++) {
            h += '<div class="cl-tier">';
            nodes.filter(n => n.tier === t).forEach(n => {
                const done = sys.isUnlockedNode(st, cid, n.id), chk = done ? null : sys.canUnlock(cid, n.id);
                const cls = done ? 'done' : (chk && chk.ok ? 'can' : 'off');
                const kind = n.kind === 'form' ? '形' : (n.kind === 'glyph' ? 'グリフ' : '強化');
                h += '<button class="cl-node ' + cls + '" data-cid="' + cid + '" data-nid="' + n.id + '" title="' + esc(done ? '解放済み' : (chk && chk.ok ? 'クリックで解放' : (chk ? chk.reason : ''))) + '">' +
                    '<b>' + n.icon + ' ' + esc(n.name) + '</b><span style="color:#9aa6c4">' + kind + '・' + (done ? '解放済み' : 'コスト' + n.cost) + '</span><br>' + esc(n.desc) + '</button>';
            });
            h += '</div>';
        }
        h += perkHtml(cid, slotLabel);
        h += '<button class="ghost" data-reset="' + cid + '" style="font-size:.72rem">このツリーをリセット（ポイントが戻ります）</button></div>';
        return h;
    }

    // パーク：1つだけ選べる、大きな長所と大きな代償のセット（メイン職業のツリーだけ）
    function perkHtml(cid, slotLabel) {
        const sys = CS(), st = sys.state(), list = sys.perkList(cid); if (!list.length) return '';
        const cost = sys.perkCost(), picked = st.perk[cid] || null, isMain = cid === st.main;
        let h = '<div class="cl-perks"><b>🌟 パーク</b> <span class="cl-tag">1つだけ選べる／コスト' + cost + '</span>' +
            '<div class="cl-note" style="margin:3px 0 4px">' + '使える形（' + sys.slotsOf(cid) + 'つ）をすべて解放すると選べます。選ぶとプレイスタイルが大きく変わる代わりに、重いデメリットがつきます。外すとポイントが戻ります。' + (isMain ? '' : '<br>サブ職業では、3つ目の形を使うパークは選べません。') + '</div>';
        h += '<div class="cl-perk-grid">';
        list.forEach(pk => {
            const done = picked === pk.id, chk = done ? null : sys.canChoosePerk(cid, pk.id);
            const cls = done ? 'done' : (chk && chk.ok ? '' : 'off');
            h += '<button class="cl-perk ' + cls + '" data-perk="' + pk.id + '" data-cid="' + cid + '" title="' + esc(done ? '選択中（クリックで外す）' : (chk && chk.ok ? 'クリックで選ぶ' : (chk ? chk.reason : ''))) + '">' +
                '<b>' + pk.icon + ' ' + esc(pk.name) + (done ? ' <span class="cl-tag">選択中</span>' : '') + '</b>' +
                '<span class="cl-pro">◎ ' + esc(pk.pro) + '</span><br><span class="cl-con">▼ ' + esc(pk.con) + '</span></button>';
        });
        return h + '</div></div>';
    }

    function render() {
        const el = root(); if (!el) return;
        if (!CS()) { el.innerHTML = '<p style="color:#ff9a9a">職業のデータ（js/classes.js）が読み込めていません。ファイルがサーバーに置かれているか、ページを強制再読み込み（Ctrl+F5）して確認してください。</p>'; return; }
        try { draw(el); } catch (e) { console.error('[ClassUI]', e); el.innerHTML = '<p style="color:#ff9a9a">職業画面の表示でエラーが出ました：' + esc(e && e.message) + '<br>ブラウザの開発者ツール（F12）のコンソールに詳しい内容が出ています。</p>'; }
    }
    function draw(el) {
        css();
        const sys = CS(), st = sys.state(), pts = sys.pointsInfo();
        let h = '<p class="cl-note">職業は、<b>メイン</b>と<b>サブ</b>を1つずつ選べます。どちらの職業の武器も使え、専用ツリーも両方進められます。' +
            'ただし<b>サブ職業は、固有効果と強化が半分</b>で、ツリーは先頭の' + sys.SUB_SLOTS + '段階までです。職業の「形」と「グリフ」は、スキル工房で使えます。<br>' +
            '武器は、近距離の職業は近接武器、遠距離の職業は弾・魔法の武器が使えます（どちらかの職業で使えれば装備できます）。職業を選ぶまでは、制限はありません。</p>' +
            '<span class="cl-pts">ツリーのポイント：残り <b>' + pts.available + '</b> ／ 獲得 ' + pts.earned + '（レベル1につき' + sys.POINTS_PER_LEVEL + '）</span>' +
            '<div class="cl-sel">' + selectHtml('clMain', '🥇 メイン職業', st.main, st.sub) + selectHtml('clSub', '🥈 サブ職業', st.sub, st.main) + '</div>';
        if (st.main) h += treeHtml(st.main, 'メイン');
        if (st.sub) h += treeHtml(st.sub, 'サブ');
        Object.keys(st.perk || {}).forEach(cid => { if (cid !== st.main && cid !== st.sub && sys.BY_ID[cid] && st.perk[cid]) { const pk = sys.perkList(cid).find(x => x.id === st.perk[cid]); if (pk) h += '<div class="cl-tree"><b>' + sys.BY_ID[cid].icon + ' ' + esc(sys.BY_ID[cid].name) + '</b> のパーク（いまはメインでもサブでもないので効きません）：' + pk.icon + esc(pk.name) + ' <button class="ghost" data-perk="' + pk.id + '" data-cid="' + cid + '" style="font-size:.72rem">外してポイントを戻す</button></div>'; } });
        h += '<div class="cl-msg' + (msgErr ? ' err' : '') + '" id="clMsg">' + esc(msg) + '</div>';
        // 全職業の一覧
        Object.keys(sys.ROLES).forEach(role => {
            h += '<div class="cl-role">' + sys.ROLES[role].icon + ' <b>' + sys.ROLES[role].name + '</b></div><div class="cl-grid">';
            sys.CLASSES.filter(c => c.role === role).forEach(c => {
                const tag = st.main === c.id ? ' main' : (st.sub === c.id ? ' sub' : '');
                h += '<div class="cl-card' + tag + '"><h4>' + c.icon + ' ' + esc(c.name) + (st.main === c.id ? '<span class="cl-tag">メイン</span>' : (st.sub === c.id ? '<span class="cl-tag">サブ</span>' : '')) + '</h4>' +
                    '<div style="color:#9aa6c4">' + rangeLabel(c.range) + '</div><div>' + esc(c.blurb) + '</div>' +
                    '<div class="cl-uniq"><b>' + c.unique.icon + ' 固有効果：' + esc(c.unique.name) + '</b><br>' + esc(c.unique.desc) + '</div>' +
                    '<div>形：' + c.forms.map(f => f.icon + esc(f.name)).join('／') + '</div><div>グリフ：' + c.glyphs.map(g => g.icon + esc(g.name)).join('／') + '</div>' +
                    '<div class="cl-btns"><button data-set="main" data-cid="' + c.id + '"' + (st.main === c.id ? ' disabled' : '') + '>メインにする</button><button data-set="sub" data-cid="' + c.id + '"' + (st.sub === c.id || !st.main ? ' disabled' : '') + ' class="ghost">サブにする</button></div></div>';
            });
            h += '</div>';
        });
        el.innerHTML = h;
        bind();
    }

    function say(t, err) { msg = t || ''; msgErr = !!err; }
    function bind() {
        const el = root(); const sys = CS();
        const main = el.querySelector('#clMain'), sub = el.querySelector('#clSub');
        const apply = () => { const r = sys.setClasses(main.value || null, sub.value || null); say(r.ok ? '職業を設定しました' : r.reason, !r.ok); render(); };
        if (main) main.addEventListener('change', () => { if (!main.value) sub.value = ''; apply(); });
        if (sub) sub.addEventListener('change', apply);
        el.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
            const st = sys.state(), cid = b.dataset.cid;
            const r = b.dataset.set === 'main' ? sys.setClasses(cid, st.sub === cid ? st.main : st.sub) : sys.setClasses(st.main, cid);
            say(r.ok ? '職業を設定しました' : r.reason, !r.ok); render();
        }));
        el.querySelectorAll('.cl-node').forEach(b => b.addEventListener('click', () => {
            const r = sys.unlock(b.dataset.cid, b.dataset.nid);
            say(r.ok ? '「' + r.node.name + '」を解放しました' : r.reason, !r.ok); render();
        }));
        el.querySelectorAll('[data-perk]').forEach(b => b.addEventListener('click', () => {
            const cid = b.dataset.cid, pid = b.dataset.perk, st = sys.state();
            if (st.perk[cid] === pid) { if (!confirm('このパークを外します（ポイントは戻ります）。よろしいですか？')) return; sys.clearPerk(cid); say('パークを外しました'); render(); return; }
            const pk = sys.perkList(cid).find(x => x.id === pid);
            if (pk && sys.canChoosePerk(cid, pid).ok && !confirm('「' + pk.name + '」を選びます。\n◎ ' + pk.pro + '\n▼ ' + pk.con + '\n\nよろしいですか？（あとで外してポイントを戻せます）')) return;
            const r = sys.choosePerk(cid, pid); say(r.ok ? 'パーク「' + r.perk.name + '」を選びました' : r.reason, !r.ok); render();
        }));
        el.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => {
            if (!confirm('この職業のツリーをリセットして、使ったポイントを戻します。よろしいですか？')) return;
            sys.resetTree(b.dataset.reset); say('リセットしました'); render();
        }));
    }

    // 読み込みのタイミングに関係なく動くように：すぐ1回描画し、「職業」ボタンを押すたびに（ほかの処理のあとで）描き直す
    function start() { render(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    document.addEventListener('click', (ev) => {
        const b = ev.target && ev.target.closest && ev.target.closest('.menu-btn[data-section="classes"]');
        if (b) setTimeout(render, 0);
    });
    window.addEventListener('load', render);
    window.ClassUI = { render };
})();
