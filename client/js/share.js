// ===================================
// シェア機能（友達紹介・戦果シェア）
// ===================================
// スマホ（タッチ端末）では端末標準の共有シート（LINE・X・Instagramなど）を開き、
// PCなど共有シートが使えない環境ではX（旧Twitter）の投稿画面を新しいタブで開く。
// どちらも失敗した場合は、文章とURLをクリップボードにコピーする。
(function (global) {
    'use strict';

    var HASHTAG = 'SchoolBattle';

    function getSiteUrl() {
        return location.origin + '/';
    }

    function buildXIntentUrl(text, url) {
        return 'https://x.com/intent/tweet' +
            '?text=' + encodeURIComponent(text) +
            '&url=' + encodeURIComponent(url) +
            '&hashtags=' + encodeURIComponent(HASHTAG);
    }

    function canUseNativeShare() {
        return typeof navigator.share === 'function' &&
            typeof global.matchMedia === 'function' &&
            global.matchMedia('(pointer: coarse)').matches;
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
        }
        return Promise.resolve(false);
    }

    // text: 投稿文（URL・ハッシュタグは自動で付く）
    function shareText(text) {
        var url = getSiteUrl();

        if (canUseNativeShare()) {
            return navigator.share({
                title: 'School Battle',
                text: text + ' #' + HASHTAG,
                url: url
            }).catch(function (err) {
                // ユーザーが共有シートを閉じただけ（AbortError）なら何もしない
                if (err && err.name === 'AbortError') return;
                return fallbackToX(text, url);
            });
        }
        return Promise.resolve(fallbackToX(text, url));
    }

    function fallbackToX(text, url) {
        var opened = global.open(buildXIntentUrl(text, url), '_blank', 'noopener');
        if (opened) return;
        // ポップアップがブロックされた場合はクリップボードにコピー
        return copyToClipboard(text + ' ' + url + ' #' + HASHTAG).then(function (ok) {
            alert(ok
                ? '共有用の文章をコピーしました。SNSに貼り付けてください。'
                : '共有できませんでした。このページのURLを直接お友達に送ってください。');
        });
    }

    // 「友達に紹介する」用の定型文
    function shareInvite() {
        return shareText('勉強するほど強くなるクイズRPG「School Battle」で遊んでみない？');
    }

    global.SchoolBattleShare = {
        shareText: shareText,
        shareInvite: shareInvite
    };

    // ホーム画面の「友達に紹介」ボタン（存在するページのみ）
    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('shareInviteBtn');
        if (btn) btn.addEventListener('click', function () { shareInvite(); });
    });
})(window);
