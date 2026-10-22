// ============================================================
// PvPイベント (pvp-event.js)  ※シーズンの最終週（4週目）〜終了まで開催（season.js の SCHEDULE.pvpWeek）
//  ・対象：シーズンキャラ。オンラインマッチ（2人以上で遊んだ対人戦）に参加するとイベントポイント(EP)がたまる
//      勝利 +30EP ／ 負け +10EP（ボット練習はEPなし）
//  ・EPに応じた報酬（マイルストーン）をもらえる。ランキングはサーバーで集計（上位20人）
//  ・データは localStorage の sbPvpEvent（引き継ぎでも運ばれる）。シーズンIDごとに分けて保存
// ============================================================
(function () {
    'use strict';
    const KEY = 'sbPvpEvent';
    const EP_WIN = 30, EP_LOSE = 10;
    // 報酬：コイン／防具（レア度以上）／武器（レア度以上）。ilvl は第五世界の最高レベル相当
    const MILESTONES = [
        { ep: 30,  label: '2,000コイン',                    coins: 2000 },
        { ep: 80,  label: '防具1個（レア以上）',             armor: 'rare' },
        { ep: 150, label: '5,000コイン',                    coins: 5000 },
        { ep: 250, label: '武器1本（エピック以上）',         weapon: 'epic' },
        { ep: 400, label: '防具1個（エピック以上）',         armor: 'epic' },
        { ep: 600, label: '20,000コイン＋武器1本（レジェンド）', coins: 20000, weapon: 'legendary' }
    ];
    const ILVL = 46;

    function S() { return window.SeasonSys || null; }
    function seasonState() { const s = S(); return s && s.state ? s.state() : null; }   // シーズンキャラでなければ null
    function open() { const s = S(); return !!(s && s.pvpEventOpen && s.pvpEventOpen()); }
    function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
    function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* 容量不足 */ } }
    function seasonId() { const st = seasonState(); return st && st.def ? String(st.def.id) : null; }
    function rec() {
        const id = seasonId(); if (!id) return null;
        const o = load(); const r = o[id] || { pts: 0, wins: 0, plays: 0, claimed: {}, sent: 0 };
        if (!r.claimed) r.claimed = {};
        return r;
    }
    function put(r) { const id = seasonId(); if (!id) return; const o = load(); o[id] = r; save(o); }

    // 対戦が終わったとき（stage.js の finish）に呼ぶ。EPを足して、増えた量を返す（開催中でなければ 0）
    function award(win) {
        if (!open()) return 0;
        const r = rec(); if (!r) return 0;
        const gain = win ? EP_WIN : EP_LOSE;
        r.pts += gain; r.plays += 1; if (win) r.wins += 1; r.sent = 0;     // sent=0：次にサーバーへ送る
        put(r);
        return gain;
    }
    function playerOf() { try { return typeof getPlayerData === 'function' ? getPlayerData() : JSON.parse(localStorage.getItem('player') || 'null'); } catch (e) { return null; } }
    // ランキング用に、いまのEPをサーバーへ送る（まだ送っていない分があるときだけ）
    function report(sock, force) {
        const r = rec(), p = playerOf(), id = seasonId();
        if (!r || !p || !id || !sock || !sock.connected) return;
        if (r.sent && !force) return;
        sock.emit('pvpEvent:report', { seasonId: id, id: p.id, name: p.name, pts: r.pts, wins: r.wins, plays: r.plays });
        r.sent = 1; put(r);
    }
    function mkClaimReward(m, addCoins) {
        const lines = [];
        if (m.coins) { addCoins(m.coins); lines.push(m.coins.toLocaleString() + ' コイン'); }
        if (m.armor && window.SBArmor && window.HW) { const d = HW.load(); const a = SBArmor.roll({ ilvl: ILVL, luck: 0, minRarity: m.armor, source: 'pvp_event' }); SBArmor.add(d, a); HW.save(d); lines.push('防具「' + a.name + '」'); }
        if (m.weapon && window.HW) {
            const d = HW.load();
            const w = HW.roll({ ilvl: ILVL, minRarity: m.weapon, forceRarity: m.weapon === 'legendary' ? 'legendary' : undefined, source: 'pvp_event' });
            d.weapons.push(w); HW.save(d); lines.push('武器「' + w.name + '」');
        }
        return lines;
    }
    // 受け取り。addCoins は呼び出し側（コインの足し方を知っている側）が渡す。成功すると受け取った内容の文を返す
    function claim(i, addCoins) {
        const m = MILESTONES[i], r = rec();
        if (!m || !r || !seasonState()) return null;
        if (r.claimed[i] || r.pts < m.ep) return null;
        r.claimed[i] = 1; put(r);
        return mkClaimReward(m, addCoins);
    }
    window.SBPvpEvent = { MILESTONES: MILESTONES, EP_WIN: EP_WIN, EP_LOSE: EP_LOSE, open: open, seasonState: seasonState, rec: rec, award: award, report: report, claim: claim, seasonId: seasonId };
})();
