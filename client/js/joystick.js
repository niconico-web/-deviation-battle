// ============================================================
// 仮想ジョイスティック (joystick.js)
//  ・町フィールドとアクションバトルで共通利用するアナログ式スティック
//  ・「フリー」方式: 画面の指定エリアを触った場所にスティックが出る（指を離すと元の位置へ）
//  ・「固定」方式 : 決まった位置のスティックだけが反応する
//  ・サイズ／表示は UISettings の 'joystick' 項目、方式は共通オプション 'joyMode' で変更できる
//  ・ちょんと軽く触れただけ（タップ）の場合は onTap にそのまま渡す
//    → 建物やNPCのタップ操作がスティックのエリアと重なっても邪魔されない
// ============================================================
(function () {
    'use strict';

    const BASE_DIAMETER = 128;  // scale=1 のときのスティック土台の直径(px)
    const DEADZONE = 0.14;
    const TAP_MAX_MS = 350;
    const TAP_MAX_MOVE = 12;

    if (window.UISettings) {
        window.UISettings.register({
            id: 'joystick', label: 'ジョイスティック', canHide: true, canScale: true, canOpacity: true,
            scaleMin: 0.6, scaleMax: 1.8, scaleDef: 1, alwaysList: true,
            note: '「固定」方式のときは左下の決まった位置に表示されます。'
        });
    }

    function settings() {
        const U = window.UISettings;
        return {
            visible: U ? U.get('joystick').visible : true,
            scale: U ? U.get('joystick').scale : 1,
            opacity: U ? U.get('joystick').opacity : 1,
            mode: U ? U.getGlobal('joyMode') : 'float'
        };
    }

    // opts:
    //   parent   : 追加先（省略時 body）
    //   region   : 反応エリア（画面に対する割合） { left, top, width, height }  既定: 左45% × 下75%
    //   onChange : (x, y, mag) スティックが動くたび（-1〜1）
    //   onTap    : (clientX, clientY, event) タップ扱いのとき
    function mount(opts) {
        opts = opts || {};
        const parent = opts.parent || document.body;
<<<<<<< HEAD
=======

>>>>>>> f774ba390c32f3e1953b5d68ca70b35a7a19c043
        // region は固定値でも、画面の向きに応じて返す関数でもよい
        const regionOf = () => Object.assign({ left: 0, top: 0.25, width: 0.45, height: 0.75 },
            (typeof opts.region === 'function' ? opts.region() : opts.region) || {});

        const zone = document.createElement('div');
        zone.className = 'joy-zone';
        const base = document.createElement('div');
        base.className = 'joy-base';
        const knob = document.createElement('div');
        knob.className = 'joy-knob';
        base.appendChild(knob);
        // 安全領域（ノッチ）を考慮した「定位置」を測るための見えないプローブ
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;left:env(safe-area-inset-left,0px);bottom:env(safe-area-inset-bottom,0px);width:0;height:0;visibility:hidden;pointer-events:none;';
        parent.append(zone, base, probe);

        const vec = { x: 0, y: 0, mag: 0 };
        let pid = null;
        let cx = 0, cy = 0;          // 現在のスティック中心(画面座標)
        let downX = 0, downY = 0, downT = 0, moved = 0;
        let tapOnly = false, tapPointer = null;
        let R = 64;

        function applyLayout() {
            const s = settings();
            R = BASE_DIAMETER * s.scale / 2;
            base.style.width = base.style.height = (R * 2) + 'px';
            const kd = Math.round(R * 0.86);
            knob.style.width = knob.style.height = kd + 'px';
            knob.style.marginLeft = knob.style.marginTop = (-kd / 2) + 'px';
            base.style.setProperty('--joy-o', String(s.opacity));
<<<<<<< HEAD
=======

>>>>>>> f774ba390c32f3e1953b5d68ca70b35a7a19c043
            const region = regionOf();
            zone.style.left = (region.left * 100) + '%';
            zone.style.top = (region.top * 100) + '%';
            zone.style.width = (region.width * 100) + '%';
            zone.style.height = (region.height * 100) + '%';
            zone.style.pointerEvents = s.visible ? 'auto' : 'none';
            base.style.visibility = s.visible ? '' : 'hidden';
            if (pid === null) goHome();
        }
        function home() {
            const r = probe.getBoundingClientRect();
            const margin = 20;
            return { x: r.left + margin + R, y: (r.bottom || window.innerHeight) - margin - R };
        }
        function place(x, y) {
            cx = x; cy = y;
            base.style.transform = 'translate(' + (x - R) + 'px,' + (y - R) + 'px)';
        }
        function goHome() {
            const h = home();
            place(h.x, h.y);
            knob.style.transform = 'translate(0,0)';
        }
        function setKnob(dx, dy) {
            knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        }
        function emit() {
            if (opts.onChange) opts.onChange(vec.x, vec.y, vec.mag);
        }
        function reset() {
            pid = null;
            vec.x = vec.y = vec.mag = 0;
            base.classList.remove('active');
            goHome();
            emit();
        }

        function inRegionFixed(x, y) {
            const h = home();
            return Math.hypot(x - h.x, y - h.y) <= R * 1.35;
        }

        zone.addEventListener('contextmenu', (e) => e.preventDefault());
        zone.addEventListener('pointerdown', (e) => {
            if (pid !== null) return;
            const s = settings();
            if (!s.visible) return;
            downX = e.clientX; downY = e.clientY; downT = performance.now(); moved = 0;
            if (s.mode === 'fixed' && !inRegionFixed(e.clientX, e.clientY)) {
                // 固定方式で土台の外を触った → タップ候補としてだけ扱う
                pid = -1 - e.pointerId; // 「スティック操作ではない」目印
                tapOnly = true;
                try { zone.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
                tapPointer = e.pointerId;
                return;
            }
            tapOnly = false;
            pid = e.pointerId;
            tapPointer = e.pointerId;
            try { zone.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
            if (s.mode === 'float') place(e.clientX, e.clientY);
            base.classList.add('active');
            update(e.clientX, e.clientY);
            e.preventDefault();
        });

        function update(x, y) {
            let dx = x - cx, dy = y - cy;
            const len = Math.hypot(dx, dy);
            if (len > R) {
                // フリー方式では、行き過ぎた分だけ土台が指に付いてくる（親指が端に届かなくなるのを防ぐ）
                if (settings().mode === 'float') {
                    const over = len - R;
                    place(cx + dx / len * over, cy + dy / len * over);
                    dx = x - cx; dy = y - cy;
                } else {
                    dx = dx / len * R; dy = dy / len * R;
                }
            }
            const l = Math.min(R, Math.hypot(dx, dy));
            setKnob(dx, dy);
            let mag = l / R;
            if (mag < DEADZONE) {
                vec.x = vec.y = vec.mag = 0;
            } else {
                mag = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));
                const ang = Math.atan2(dy, dx);
                vec.x = Math.cos(ang) * mag;
                vec.y = Math.sin(ang) * mag;
                vec.mag = mag;
            }
            emit();
        }

        zone.addEventListener('pointermove', (e) => {
            if (e.pointerId !== tapPointer) return;
            moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
            if (tapOnly) return;
            update(e.clientX, e.clientY);
            e.preventDefault();
        });
        function end(e) {
            if (e.pointerId !== tapPointer) return;
            const wasTap = (e.type === 'pointerup') && moved < TAP_MAX_MOVE && (performance.now() - downT) < TAP_MAX_MS;
            tapPointer = null;
            try { zone.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
            if (!tapOnly) reset(); else pid = null;
            tapOnly = false;
            if (wasTap && opts.onTap) opts.onTap(e.clientX, e.clientY, e);
        }
        zone.addEventListener('pointerup', end);
        zone.addEventListener('pointercancel', end);
        zone.addEventListener('lostpointercapture', (e) => {
            if (e.pointerId === tapPointer) end({ pointerId: e.pointerId, type: 'pointercancel', clientX: 0, clientY: 0 });
        });

<<<<<<< HEAD
        window.addEventListener('resize', () => { if (pid === null) applyLayout(); });
        window.addEventListener('orientationchange', () => setTimeout(() => { if (pid === null) applyLayout(); }, 250));
=======

        window.addEventListener('resize', () => { if (pid === null) applyLayout(); });
        window.addEventListener('orientationchange', () => setTimeout(() => { if (pid === null) applyLayout(); }, 250));
        window.addEventListener('resize', () => { if (pid === null) applyLayout(); });
        window.addEventListener('orientationchange', () => setTimeout(() => { if (pid === null) applyLayout(); }, 250));
        window.addEventListener('resize', () => { if (pid === null) applyLayout(); });
        window.addEventListener('orientationchange', () => setTimeout(() => { if (pid === null) applyLayout(); }, 250));

>>>>>>> f774ba390c32f3e1953b5d68ca70b35a7a19c043
        window.addEventListener('blur', reset);
        if (window.UISettings) window.UISettings.onChange((id) => {
            if (id === 'joystick' || id === '_g:joyMode' || id === '*') applyLayout();
        });
        applyLayout();

        return {
            getVector: () => ({ x: vec.x, y: vec.y, mag: vec.mag }),
            isActive: () => pid !== null && !tapOnly,
            reset,
            refresh: applyLayout,
            zone, base
        };
    }

    window.Joystick = { mount };
})();
