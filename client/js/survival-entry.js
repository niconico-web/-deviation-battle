// ============================================================
// survival-entry.js ― 町の「次元の裂け目」から、サバイバルエリア（survival.html）へ入る入り口だけ
//   サバイバルエリア本体は、独立した全画面ページ（survival.html）。町の画面（index.html）は軽いままにする
// ============================================================
(function () {
    'use strict';
    function unlocked() { try { return !!(window.HW && window.HW.load().world2); } catch (e) { return false; } }
    window.isSurvivalUnlocked = unlocked;
    window.openSurvival = function () {
        if (!unlocked()) { alert('次元の裂け目は、第二世界に到達すると開きます。\n（第一世界の最終ゲートを突破しよう）'); return; }
        try { if (window.SBOrientation && SBOrientation.enterFullscreenLandscape) SBOrientation.enterFullscreenLandscape(); } catch (e) { /* 全画面にできなくても進む */ }
        location.href = 'survival.html';
    };
})();
