// 上部ツールバーの「☰」：アイコンボタン群を1つのドロップダウンにまとめる
(function () {
    'use strict';
    function init() {
        var btn = document.getElementById('toolMoreBtn');
        var menu = document.getElementById('toolMoreMenu');
        if (!btn || !menu) return;
        function setOpen(open) {
            menu.hidden = !open;
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.classList.toggle('active', open);
        }
        window.toolMoreSetOpen = setOpen;   // ビギナーミッションの案内などから開けるように公開
        // windowのキャプチャ段階で受ける（他のスクリプトがstopImmediatePropagationしても閉じられるように）
        window.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.closest && t.closest('#toolMoreBtn')) { setOpen(menu.hidden); return; }
            if (menu.hidden) return;
            setOpen(false);   // メニュー内の項目を押したとき・外側を押したとき
        }, true);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
