// push.js ― サイトを閉じていても届く通知（Web Push）。サーバー側は server/managers/PushManager.js
//  ・通知の許可がONなら、この端末をサーバーに登録する（ページを開くたびに登録し直すので、サーバーが再起動しても復活する）
//  ・勉強を始めたら「終わる時刻」をサーバーに予約。画面が閉じていても、その時刻にサーバーから通知が届く
//  ・勉強を自分で終える／やめたら予約を取り消す
//  ・iPhone/iPadは「ホーム画面に追加」したアプリでのみ届く（iOSの仕様）
(function () {
    'use strict';
    const OK = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
    const KEY_STORE = 'sbPushKey';
    const STUDY_GRACE_MS = 20000;      // サイトを開いたまま終わるときは、画面側が先に取り消せるよう、少しだけ遅らせて送る

    function b64ToU8(b64) {
        const pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
        const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
    }
    function post(url, body) {
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).then(r => r.ok).catch(() => false);
    }

    let subPromise = null;
    // この端末を登録して、購読情報を返す（許可が無い／非対応なら null）
    function ensure() {
        if (!OK || Notification.permission !== 'granted') return Promise.resolve(null);
        if (subPromise) return subPromise;
        subPromise = (async () => {
            try {
                const k = await (await fetch('/api/push/key', { cache: 'no-store' })).json();
                if (!k || !k.ok || !k.key) return null;
                const reg = await navigator.serviceWorker.ready;
                let sub = await reg.pushManager.getSubscription();
                if (sub && localStorage.getItem(KEY_STORE) !== k.key) { try { await sub.unsubscribe(); } catch (e) { /* 無視 */ } sub = null; }      // サーバーの鍵が変わっていたら登録し直す
                if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(k.key) });
                try { localStorage.setItem(KEY_STORE, k.key); } catch (e) { /* 無視 */ }
                await post('/api/push/subscribe', { subscription: sub.toJSON() });
                return sub;
            } catch (e) { return null; }
        })();
        subPromise.then(v => { if (!v) subPromise = null; });      // 失敗したら、次にまたやり直せるようにする
        return subPromise;
    }
    // 許可がまだなら聞いてから登録する（ボタンを押した直後に呼ぶこと）
    async function enable() {
        if (!OK) return null;
        try { if (Notification.permission === 'default') await Notification.requestPermission(); } catch (e) { /* 古いブラウザ */ }
        return ensure();
    }

    // 勉強の終了時刻（ミリ秒）に通知を予約
    async function scheduleStudy(endAtMs) {
        const sub = await enable(); if (!sub) return false;
        return post('/api/push/schedule', { endpoint: sub.endpoint, at: endAtMs + STUDY_GRACE_MS, tag: 'study-done', title: '📚 勉強おつかれさま！', body: 'タイマーが終わりました。報酬を受け取りに戻りましょう。' });
    }
    async function cancelStudy() {
        if (!OK) return;
        try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) post('/api/push/cancel', { endpoint: sub.endpoint, tag: 'study-done' }); } catch (e) { /* 無視 */ }
    }

    window.SBPush = { supported: OK, ensure: ensure, enable: enable, scheduleStudy: scheduleStudy, cancelStudy: cancelStudy };

    // ページを開いたとき、許可済みなら登録（サーバーの再起動・鍵の変更に備える）
    if (OK) {
        const boot = () => { if (Notification.permission === 'granted') ensure(); };
        if (document.readyState === 'complete') setTimeout(boot, 1500); else window.addEventListener('load', () => setTimeout(boot, 1500));
    }
})();
