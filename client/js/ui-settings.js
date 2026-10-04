// ============================================================
// UI設定マネージャ (ui-settings.js)
//  ・画面上の各UI部品（チャット／ツールバー／ジョイスティック／ボタン類…）に
//    「表示・非表示」「サイズ」「不透明度」を持たせ、localStorageに保存する
//  ・UISettings.register({...}) で部品を登録するだけで、設定パネル(⚙️)に自動で並ぶ
//  ・チャットのように「幅/高さ/文字サイズ」など独自の項目を持たせることもできる
//  ・全画面共通のオプション（ジョイスティック方式・タッチ操作UI・マップ拡大率）も管理
// ============================================================
(function () {
    'use strict';

    const KEY = 'sb_ui_settings_v1';
    const items = new Map();      // id -> 定義
    const globals = new Map();    // key -> 定義
    const listeners = [];
    let store = load();
    let panelEl = null;
    let observer = null;
    let reapplyQueued = false;

    // ---------- 保存 ----------
    function load() {
        try {
            const o = JSON.parse(localStorage.getItem(KEY) || '{}');
            return o && typeof o === 'object' ? o : {};
        } catch (e) { return {}; }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 保存できない環境では無視 */ }
    }
    function num(v, d) {
        const n = Number(v);
        return v !== undefined && v !== null && v !== '' && isFinite(n) ? n : d;
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ---------- 登録 ----------
    // def: { id, label, selector?, anchor?, canHide?, canScale?, canOpacity?,
    //        scaleMin?, scaleMax?, scaleDef?, hiddenDef?, controls?:[{key,label,min,max,step,def,unit}] }
    // anchor: 'tl' 'tr' 'bl' 'br' 'tc' 'bc' 'c' … 拡大縮小の基準位置（画面の隅に寄せたまま大きくなる）
    function register(def) {
        if (!def || !def.id) return;
        items.set(def.id, Object.assign({
            canHide: true, canScale: true, canOpacity: false,
            scaleMin: 0.5, scaleMax: 2, scaleDef: 1, hiddenDef: false, anchor: 'c', controls: []
        }, def));
        applyOne(def.id);
        ensureObserver();
    }
    // 画面共通オプション: { key, label, type:'select'|'range', options?, min?, max?, step?, def, unit?, note? }
    function registerGlobal(def) {
        if (!def || !def.key) return;
        globals.set(def.key, def);
    }

    // ---------- 取得・変更 ----------
    function get(id) {
        const d = items.get(id) || {};
        const s = store[id] || {};
        const out = {
            visible: d.canHide === false ? true : (s.v === undefined ? !d.hiddenDef : !!s.v),
            scale: clamp(num(s.s, d.scaleDef === undefined ? 1 : d.scaleDef), d.scaleMin || 0.3, d.scaleMax || 3),
            opacity: clamp(num(s.o, 1), 0.2, 1)
        };
        (d.controls || []).forEach(c => { out[c.key] = clamp(num(s[c.key], c.def), c.min, c.max); });
        return out;
    }
    function set(id, patch, silent) {
        const cur = Object.assign({}, store[id] || {});
        if (patch.visible !== undefined) cur.v = patch.visible ? 1 : 0;
        if (patch.scale !== undefined) cur.s = patch.scale;
        if (patch.opacity !== undefined) cur.o = patch.opacity;
        const d = items.get(id);
        ((d && d.controls) || []).forEach(c => { if (patch[c.key] !== undefined) cur[c.key] = patch[c.key]; });
        store[id] = cur;
        save();
        applyOne(id);
        if (!silent) emit(id);
    }
    function getGlobal(key) {
        const d = globals.get(key);
        const g = store._g || {};
        if (g[key] !== undefined) return g[key];
        return d ? d.def : undefined;
    }
    function setGlobal(key, value) {
        store._g = Object.assign({}, store._g || {}, { [key]: value });
        save();
        applyGlobals();
        emit('_g:' + key);
    }
    function resetAll(idsOnly) {
        if (idsOnly) {
            idsOnly.forEach(id => { delete store[id]; });
        } else {
            const g = store._g;
            store = {};
            if (g) store._g = g; // 共通オプションは残す
        }
        save();
        items.forEach((_, id) => applyOne(id));
        emit('*');
    }
    function onChange(fn) { listeners.push(fn); }
    function emit(id) {
        listeners.forEach(fn => { try { fn(id); } catch (e) { console.error(e); } });
    }

    // ---------- DOMへの反映 ----------
    const ORIGIN = {
        tl: 'left top', tr: 'right top', bl: 'left bottom', br: 'right bottom',
        tc: 'center top', bc: 'center bottom', c: 'center', l: 'left center', r: 'right center'
    };
    function applyOne(id) {
        const d = items.get(id);
        if (!d || !d.selector) return;
        const st = get(id);
        let els;
        try { els = document.querySelectorAll(d.selector); } catch (e) { return; }
        els.forEach(el => {
            el.setAttribute('data-ui-id', id);
            el.classList.toggle('ui-hidden', !st.visible);
            if (d.canScale) {
                // scale が 1 のときは none にする（1でも指定すると fixed 子要素の基準が変わってしまうため）
                if (Math.abs(st.scale - 1) < 0.001) {
                    el.style.removeProperty('scale');
                } else {
                    el.style.setProperty('scale', String(st.scale));
                    el.style.transformOrigin = ORIGIN[d.anchor] || 'center';
                }
            }
            if (d.canOpacity) {
                if (st.opacity >= 0.999) el.style.removeProperty('opacity');
                else el.style.opacity = String(st.opacity);
            }
        });
    }
    function applyAll() { items.forEach((_, id) => applyOne(id)); }

    // 後から作られる要素（チャットなど）にも設定を適用する
    function ensureObserver() {
        if (observer || typeof MutationObserver === 'undefined' || !document.body) {
            if (!document.body) document.addEventListener('DOMContentLoaded', ensureObserver, { once: true });
            return;
        }
        observer = new MutationObserver(() => {
            if (reapplyQueued) return;
            reapplyQueued = true;
            requestAnimationFrame(() => {
                reapplyQueued = false;
                items.forEach((d, id) => {
                    if (!d.selector) return;
                    let unmarked;
                    try { unmarked = document.querySelector(d.selector + ':not([data-ui-id="' + id + '"])'); } catch (e) { return; }
                    if (unmarked) applyOne(id);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ---------- 共通オプション ----------
    registerGlobal({
        key: 'touchUI', label: 'タッチ操作UI（ジョイスティック等）', type: 'select', def: 'auto',
        options: [['auto', '自動（スマホ・タブレットで表示）'], ['on', '常に表示'], ['off', '表示しない']]
    });
    registerGlobal({
        key: 'joyMode', label: 'ジョイスティック方式', type: 'select', def: 'float',
        options: [['float', 'フリー（画面の左側を触った所に出る）'], ['fixed', '固定（決まった位置）']]
    });

    function isTouchUI() {
        const m = getGlobal('touchUI');
        if (m === 'on') return true;
        if (m === 'off') return false;
        try {
            return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches
                || (navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches);
        } catch (e) { return 'ontouchstart' in window; }
    }
    function applyGlobals() {
        document.documentElement.classList.toggle('touch-ui', isTouchUI());
    }
    applyGlobals();
    // 「自動」のとき、端末がタッチ対応と報告しなくても（PC表示モード・ウィンドウを狭めた表示など）、
    // 実際に指で触れた時点でタッチ操作UI（ジョイスティック等）を有効にする
    window.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch' && getGlobal('touchUI') === 'auto'
            && !document.documentElement.classList.contains('touch-ui')) {
            document.documentElement.classList.add('touch-ui');
            emit('_g:touchUI');
        }
    }, { passive: true, capture: true });

    try {
        const mq = window.matchMedia('(pointer: coarse)');
        if (mq.addEventListener) mq.addEventListener('change', applyGlobals);
    } catch (e) { /* noop */ }

    // ---------- 設定パネル ----------
    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }
    function sliderRow(label, min, max, step, value, fmt, onInput) {
        const row = el('div', 'uis-sub');
        const lab = el('span', '', escapeHtml(label));
        const inp = document.createElement('input');
        inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
        const val = el('span', 'uis-val', fmt(value));
        inp.addEventListener('input', () => {
            const v = Number(inp.value);
            val.textContent = fmt(v);
            onInput(v);
        });
        row.append(lab, inp, val);
        return { row, input: inp, val };
    }

    function buildPanel() {
        if (panelEl) panelEl.remove();
        panelEl = el('div', 'uis-overlay');
        panelEl.setAttribute('role', 'dialog');
        panelEl.setAttribute('aria-label', 'UI設定');
        const sheet = el('div', 'uis-sheet');
        const head = el('div', 'uis-head', '<h2>⚙️ UI設定</h2>');
        const closeBtn = el('button', 'uis-close', '✕');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', '閉じる');
        closeBtn.addEventListener('click', closePanel);
        head.appendChild(closeBtn);
        const body = el('div', 'uis-body');

        // 共通オプション
        if (globals.size) {
            body.appendChild(el('div', 'uis-section-title', '全体の設定'));
            globals.forEach((g, key) => {
                if (g.hidden) return;
                const row = el('div', 'uis-row');
                row.appendChild(el('div', 'uis-row-top', '<span class="uis-label">' + escapeHtml(g.label) + '</span>'));
                if (g.type === 'select') {
                    const sub = el('div', 'uis-sub');
                    const sel = document.createElement('select');
                    g.options.forEach(([v, t]) => {
                        const o = document.createElement('option');
                        o.value = v; o.textContent = t;
                        sel.appendChild(o);
                    });
                    sel.value = getGlobal(key);
                    sel.addEventListener('change', () => setGlobal(key, sel.value));
                    sub.appendChild(sel);
                    row.appendChild(sub);
                } else if (g.type === 'range') {
                    const fmt = v => Math.round(v * 100) + '%';
                    const s = sliderRow('倍率', g.min, g.max, g.step, getGlobal(key), g.fmt || fmt, v => setGlobal(key, v));
                    row.appendChild(s.row);
                }
                if (g.note) row.appendChild(el('p', 'uis-note', escapeHtml(g.note)));
                body.appendChild(row);
            });
        }

        // 画面上のUI部品
        const present = [];
        items.forEach((d, id) => {
            if (d.alwaysList) { present.push([id, d]); return; }
            if (!d.selector) return;
            let found = null;
            try { found = document.querySelector(d.selector); } catch (e) { /* noop */ }
            if (found) present.push([id, d]);
        });
        if (present.length) {
            body.appendChild(el('div', 'uis-section-title', 'この画面のUI部品'));
            present.forEach(([id, d]) => {
                const row = el('div', 'uis-row');
                const top = el('div', 'uis-row-top', '<span class="uis-label">' + escapeHtml(d.label) + '</span>');
                if (d.canHide) {
                    const sw = el('label', 'uis-switch');
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = get(id).visible;
                    cb.setAttribute('aria-label', d.label + 'を表示');
                    cb.addEventListener('change', () => set(id, { visible: cb.checked }));
                    sw.append(cb, el('span', 'uis-switch-track'));
                    top.appendChild(sw);
                }
                row.appendChild(top);
                const st = get(id);
                if (d.canScale) {
                    row.appendChild(sliderRow('サイズ', Math.round(d.scaleMin * 100), Math.round(d.scaleMax * 100), 5,
                        Math.round(st.scale * 100), v => v + '%', v => set(id, { scale: v / 100 })).row);
                }
                if (d.canOpacity) {
                    row.appendChild(sliderRow('濃さ', 20, 100, 5, Math.round(st.opacity * 100),
                        v => v + '%', v => set(id, { opacity: v / 100 })).row);
                }
                (d.controls || []).forEach(c => {
                    const sr = sliderRow(c.label, c.min, c.max, c.step || 1, st[c.key],
                        v => v + (c.unit || ''), v => set(id, { [c.key]: v }));
                    sr.input.dataset.ctl = id + ':' + c.key;
                    row.appendChild(sr.row);
                });
                if (d.note) row.appendChild(el('p', 'uis-note', escapeHtml(d.note)));
                body.appendChild(row);
            });
        }

        const foot = el('div', 'uis-foot');
        const resetBtn = el('button', 'uis-btn', '初期設定に戻す');
        resetBtn.type = 'button';
        resetBtn.addEventListener('click', () => {
            if (!confirm('この画面のUI設定をすべて初期状態に戻しますか？')) return;
            resetAll(present.map(p => p[0]));
            buildPanel();
            panelEl.classList.add('open');
        });
        const doneBtn = el('button', 'uis-btn primary', '完了');
        doneBtn.type = 'button';
        doneBtn.addEventListener('click', closePanel);
        foot.append(resetBtn, doneBtn);

        sheet.append(head, body, foot);
        panelEl.appendChild(sheet);
        panelEl.addEventListener('click', (e) => { if (e.target === panelEl) closePanel(); });
        document.body.appendChild(panelEl);
    }
    function openPanel() {
        buildPanel();
        panelEl.classList.add('open');
    }
    function closePanel() {
        if (panelEl) panelEl.classList.remove('open');
    }
    // 外部（チャットのドラッグ等）で値が変わったときにパネルのスライダーも追従させる
    onChange((id) => {
        if (!panelEl || !panelEl.classList.contains('open')) return;
        panelEl.querySelectorAll('input[data-ctl]').forEach(inp => {
            const [iid, key] = inp.dataset.ctl.split(':');
            if (id !== iid) return;
            const v = get(iid)[key];
            if (Number(inp.value) !== v) {
                inp.value = v;
                const val = inp.parentElement.querySelector('.uis-val');
                const c = (items.get(iid).controls || []).find(x => x.key === key);
                if (val) val.textContent = v + ((c && c.unit) || '');
            }
        });
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    // キャプチャ段階で受ける：他のクリック処理が伝播を止めても、⚙️ボタンが必ず反応するようにする
    document.addEventListener('click', (e) => {
        const t = e.target.closest && e.target.closest('[data-open-ui-settings]');
        if (t) { e.preventDefault(); e.stopPropagation(); openPanel(); }
    }, true);

    // 歯車ボタンを画面の隅に常設する（ツールバーの無い画面用）
    function addGearButton(pos) {
        if (document.querySelector('.uis-gear')) return;
        const b = el('button', 'uis-gear', '⚙️');
        b.type = 'button';
        b.setAttribute('aria-label', 'UI設定');
        b.setAttribute('data-open-ui-settings', '');
        const p = pos || { top: '8px', right: '8px' };
        Object.keys(p).forEach(k => { b.style[k] = p[k]; });
        document.body.appendChild(b);
        return b;
    }

    window.UISettings = {
        register, registerGlobal, get, set, getGlobal, setGlobal, resetAll, onChange,
        isTouchUI, applyAll, openPanel, closePanel, addGearButton
    };

    document.addEventListener('DOMContentLoaded', () => { applyAll(); ensureObserver(); });
})();
