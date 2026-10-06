// ============================================================
// 画面の向き (orientation.js)
//  ・スマホは横画面で遊ぶ。可能なら横向きに固定する（インストール済みアプリ／全画面なら固定できる）
//  ・固定できない環境（iPhoneのSafariなど）では、縦向きのときだけ「横にしてね」案内を出す
//  使い方：SBOrientation.guard() で案内を有効化（ステージ画面で使用）。町では固定の試行だけ行う。
// ============================================================
(function () {
    'use strict';
    const isTouch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    let dismissed = false, guardOn = false, el = null;

    function isPortrait() { return window.innerHeight > window.innerWidth; }

    function tryLock() {
        try {
            if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape').then(() => true, () => false);
        } catch (e) { /* 非対応 */ }
        return Promise.resolve(false);
    }
    // ユーザー操作の中で呼ぶ：全画面にして横向きに固定（Androidなど）
    function enterFullscreenLandscape() {
        let p = Promise.resolve();
        try {
            const d = document.documentElement;
            if (!document.fullscreenElement && d.requestFullscreen) p = d.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        } catch (e) { /* 非対応 */ }
        return p.then(tryLock);
    }

    function build() {
        el = document.createElement('div');
        el.id = 'rotateGuide';
        el.style.cssText = 'position:fixed;inset:0;z-index:100002;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(8,10,16,.96);color:#fff;font-family:sans-serif;text-align:center;padding:20px;';
        el.innerHTML =
            '<style>@keyframes sbRot{0%,25%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}</style>' +
            '<div style="font-size:64px;animation:sbRot 1.8s ease-in-out infinite alternate">📱</div>' +
            '<div style="font-size:1.15rem;font-weight:bold">端末を横向きにしてください</div>' +
            '<div style="font-size:.85rem;color:#b8c4e0;max-width:320px">横画面のほうがボタンや問題が見やすくなります。向きが変わらないときは、下のボタンか端末の画面回転ロックを確認してください。</div>' +
            '<button type="button" id="rotateFs" style="background:#3a6ee8;color:#fff;border:0;border-radius:10px;padding:11px 20px;font-size:1rem">全画面で横向きにする</button>' +
            '<button type="button" id="rotateSkip" style="background:none;color:#9fb3d9;border:1px solid #44495a;border-radius:10px;padding:7px 14px;font-size:.8rem">縦のまま続ける</button>';
        document.body.appendChild(el);
        el.querySelector('#rotateFs').addEventListener('click', () => { enterFullscreenLandscape().then(update); });
        el.querySelector('#rotateSkip').addEventListener('click', () => { dismissed = true; update(); });
    }
    function update() {
        if (!guardOn || !isTouch) return;
        if (!el) build();
        el.style.display = (isPortrait() && !dismissed) ? 'flex' : 'none';
    }
    function guard() {
        if (guardOn) return; guardOn = true;
        const start = () => { update(); window.addEventListener('resize', update); window.addEventListener('orientationchange', () => setTimeout(update, 200)); };
        if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    }

    window.SBOrientation = {
        isTouch: isTouch, isPortrait: isPortrait, tryLock: tryLock, enterFullscreenLandscape: enterFullscreenLandscape, guard: guard,
        // 案内が表示されていて（＝縦のまま未解除）、ゲームを止めるべきか
        blocking: () => guardOn && isTouch && isPortrait() && !dismissed
    };
    if (isTouch) tryLock();
})();
