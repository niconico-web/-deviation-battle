// ============================================================
// シーズン制度 (season.js)
//  ・キャラクターは2種類：スタンダードキャラ（永遠の資産）／シーズンキャラ（そのシーズン限定）
//  ・シーズンキャラは勉強効率+10%。レベル1・素手から始まり、週ごとにステージ（世界）と難易度が解放される
//  ・シーズンが終わると、シーズンキャラがスタンダードキャラに「統合」される（置き換えではなく足し合わせ）。
//    シーズンで伸ばしたステータス・XP・勉強時間・コイン・素材・武器などが、既存のスタンダードキャラに加算される
//  ・2つのキャラは同じプレイヤーID（＝共通の引継ぎコード）を使う。サーバーでも1つのアカウントとして保存される
//  ・いま操作中のキャラは今までどおり localStorage の "player" / "sbHack" に入っている（既存コードは一切変更不要）。
//    操作していないほうのキャラは "sbSeason" の slots に生の文字列のまま預かる。切り替え = 入れ替えて再読み込み。
//
//  ★ シーズンを追加・調整するときは、下の SEASONS と SCHEDULE だけ触ればよい。
// ============================================================
(function () {
    'use strict';

    // ---------- シーズン定義 ----------
    //  start : シーズン開始日時（★シーズン1は「この変更を公開した日」に合わせて書き換える）
    //  weeks : シーズンの長さ（週）。いまは1ヶ月 = 4週（以前は2ヶ月 = 8週）
    const SEASONS = [
        { id: 1, name: 'シーズン1', start: '2026-10-07T00:00:00+09:00', weeks: 4, studyBonus: 0.10 },
        { id: 2, name: 'シーズン2', start: '2026-11-04T00:00:00+09:00', weeks: 4, studyBonus: 0.10 }
    ];

    // ---------- 週ごとの解放スケジュール（シーズンキャラだけに適用）----------
    //  worldWeek     : 世界ID → 何週目から入れるか（第四・第五世界を足したら、ここに書く）
    //  diffWeek      : 難易度(0=ノーマル,1=ハード,2=ナイトメア) → 何週目から選べるか
    //  pvpWeek       : PvPイベント期間の開始週
    //  ※ ゲートキーパー（世界をまたぐ門）の条件は、前の世界の最終ステージをクリアすること（どの難易度でもよい）
    const SCHEDULE = {
        worldWeek: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2 },
        diffWeek: [1, 1, 3],
        pvpWeek: 4,      // 1ヶ月（4週）になったので、PvPイベントは最後の4週目に開催
        phases: [
            { from: 1, to: 1, title: '1週目', text: '第一〜第三世界が解放。基礎ステータス上げと低レア武器の厳選' },
            { from: 2, to: 2, title: '2週目', text: '第四・第五世界が解放（実装済みの世界のみ）。ボスの手動アクション攻略開始' },
            { from: 3, to: 3, title: '3週目', text: '最高難易度「ナイトメア」が解放。武器厳選の超ハクスラ期間' },
            { from: 4, to: 99, title: '4週目（最終週）', text: 'PvPイベント期間' }
        ]
    };

    // スタンダードキャラが、シーズンワールド（第一〜第五世界）にも入れるか。
    //  false : スタンダードキャラは「スタンダードワールド」専用（シーズンワールドはシーズンキャラの舞台）
    const STANDARD_CAN_PLAY_SEASON_WORLDS = false;

    const KEY = 'sbSeason';
    const WEEK_MS = 7 * 24 * 3600 * 1000;

    // ---------- 保存 ----------
    function blank() { return { v: 1, active: 'standard', slots: { standard: null, season: null }, seasonId: null, pendingCreate: false, backup: null, history: [], seen: {} }; }
    function load() {
        let d = null;
        try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
        if (!d || typeof d !== 'object') d = blank();
        if (!d.slots) d.slots = { standard: null, season: null };
        if (!d.history) d.history = [];
        if (!d.seen) d.seen = {};
        if (d.active !== 'season') d.active = 'standard';
        return d;
    }
    function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { console.warn('[Season] save failed', e); } }

    // ---------- 既存データ = スタンダードキャラ ----------
    //  シーズン制度が入る前から遊んでいる人のデータ（"player" / "sbHack"）は、何も変えずにそのままスタンダードキャラになる。
    //  武器が「％」方式に変換される前（＝元に戻せない変更の前）に、いまのデータを1度だけ丸ごとバックアップしておく。
    (function firstRunBackup() {
        try {
            const d = load();
            if (d.seen.preSeasonBackup) return;
            const p = localStorage.getItem('player');
            if (p) d.preSeason = { player: p, hack: localStorage.getItem('sbHack'), at: Date.now() };
            d.seen.preSeasonBackup = true;
            save(d);
        } catch (e) { /* バックアップできなくても進行には影響しない */ }
    })();

    // ---------- 共通のプレイヤーID（引継ぎコード）----------
    //  シーズンキャラとスタンダードキャラは、同じプレイヤーIDを使う（＝1つのアカウント）。
    //  ・どちらを操作していても引継ぎコードは同じ。サーバーにもまとめて保存される
    //  ・以前に別々のIDで作ったキャラは、起動時にスタンダードキャラのIDへそろえる（古いIDは legacyIds に残す）
    //  ・武器庫(sbHack)は「持ち主ID」が合わないと空になるので、IDを変えるときは owner も必ず一緒に変える
    const ID_OK = /^[A-Z0-9]{6}$/;
    function idOfRaw(raw) { const p = raw && parseSafe(raw.player); return p && p.id ? String(p.id) : null; }
    function setIdInRaw(raw, id) {
        const p = parseSafe(raw.player); if (!p) return raw;
        p.id = id;
        const h = raw.hack ? parseSafe(raw.hack) : null;
        if (h && typeof h === 'object') h.owner = String(id);
        return { player: JSON.stringify(p), hack: h ? JSON.stringify(h) : raw.hack };
    }
    function ensureAccountId(d) {
        const ids = { standard: hasSlot(d, 'standard') ? idOfRaw(rawOf(d, 'standard')) : null, season: hasSlot(d, 'season') ? idOfRaw(rawOf(d, 'season')) : null };
        let a = (d.accountId && ID_OK.test(d.accountId)) ? d.accountId : null;
        if (a && ids.standard !== a && ids.season !== a) a = null;        // 持ち主のいなくなったIDは使わない
        if (!a) a = (ids.standard && ID_OK.test(ids.standard)) ? ids.standard : ((ids.season && ID_OK.test(ids.season)) ? ids.season : null);
        d.accountId = a;
        return a;
    }
    function unifyIds() {
        try {
            const d = load(), before = d.accountId || null, a = ensureAccountId(d);
            let changed = (a || null) !== before;
            if (a) {
                ['standard', 'season'].forEach(mode => {
                    if (!hasSlot(d, mode)) return;
                    const raw = rawOf(d, mode), cur = idOfRaw(raw);
                    if (!cur || cur === a) return;
                    if (!Array.isArray(d.legacyIds)) d.legacyIds = [];
                    if (d.legacyIds.indexOf(cur) < 0) d.legacyIds.push(cur);
                    d.legacyIds = d.legacyIds.slice(-10);
                    const fixed = setIdInRaw(raw, a);
                    if (d.active === mode) putLive(fixed); else d.slots[mode] = fixed;
                    changed = true;
                });
            }
            if (changed) save(d);
        } catch (e) { console.warn('[Season] unifyIds failed', e); }
    }
    unifyIds();     // ページを開いた直後（ほかのスクリプトがキャラを読む前）にそろえる
    // 新しくキャラを作るときのID：もう片方のキャラがいるなら、同じIDを使う（stats.js の generatePlayerId から呼ばれる）
    function idForNewChar() {
        try { const d = load(); return ensureAccountId(d); } catch (e) { return null; }
    }
    // 市場・サバイバル（国の店を含む）など「プレイヤー同士のやりとり」で使うID。
    //  スタンダードキャラ＝アカウントID（6文字）／シーズンキャラ＝アカウントID＋"S"（7文字）。
    //  IDが別になるので、市場の出品・受け取り箱・店の売上などが、2つのキャラの間で行き来できない
    //  （サーバーは、7文字のIDを「シーズンの世界」として扱う）
    function netId() {
        try { const a = ensureAccountId(load()); return a ? (isSeasonChar() ? a + 'S' : a) : null; } catch (e) { return null; }
    }

    // ---------- 時刻（サーバー時刻に合わせる。端末の時計をいじっても解放が早まらないように）----------
    let offset = 0;
    try { offset = parseInt(localStorage.getItem('sbTimeOffset') || '0', 10) || 0; } catch (e) { offset = 0; }
    function now() { return Date.now() + offset; }
    function syncTime() {
        if (typeof fetch !== 'function') return;
        const t0 = Date.now();
        fetch('/api/time', { cache: 'no-store' }).then(r => r.json()).then(j => {
            if (!j || typeof j.now !== 'number') return;
            const mid = (t0 + Date.now()) / 2;
            offset = Math.round(j.now - mid);
            try { localStorage.setItem('sbTimeOffset', String(offset)); } catch (e) {}
        }).catch(() => { /* オフライン時は前回のずれを使う */ });
    }

    // ---------- シーズン状態 ----------
    function startMs(def) { return new Date(def.start).getTime(); }
    function endMs(def) { return startMs(def) + def.weeks * WEEK_MS; }
    function defById(id) { return SEASONS.find(s => s.id === id) || null; }
    // 開催中のシーズン（無ければ null）
    function currentDef() {
        const t = now();
        return SEASONS.find(s => t >= startMs(s) && t < endMs(s)) || null;
    }
    function weekOf(def, t) { return Math.max(1, Math.min(def.weeks, Math.floor(((t == null ? now() : t) - startMs(def)) / WEEK_MS) + 1)); }

    // 「いま操作しているキャラ」が属するシーズンの状態
    //  → { def, week, ended } / シーズンキャラでなければ null
    function myState() {
        const d = load();
        if (d.active !== 'season') return null;
        const def = defById(d.seasonId) || currentDef();
        if (!def) return null;
        const ended = now() >= endMs(def);
        return { def: def, week: ended ? def.weeks : weekOf(def), ended: ended };
    }
    function isSeasonChar() { return load().active === 'season'; }

    // ---------- 勉強効率 ----------
    function studyMultiplier() {
        const st = myState();
        if (!st || st.ended) return 1;
        return 1 + (st.def.studyBonus || 0);
    }

    // ---------- 解放ルール（シーズンキャラだけ制限される）----------
    function openWeek(table, id, dflt) { return (table && table[id] != null) ? table[id] : dflt; }
    function canEnterWorld(worldId) {
        const w = (window.STAGE_DATA && window.STAGE_DATA.WORLDS || []).find(x => x.id === worldId);
        const seasonChar = isSeasonChar();
        if (w && w.standardOnly) return !seasonChar;         // スタンダードワールドはスタンダードキャラだけ
        if (w && w.anyChar) return true;                      // 無限回廊は、どちらのキャラでも入れる（解放条件は進行状況で判定）
        if (!seasonChar) return STANDARD_CAN_PLAY_SEASON_WORLDS;   // シーズンワールドはシーズンキャラだけ
        const st = myState();
        if (!st || st.ended) return true;
        return st.week >= openWeek(SCHEDULE.worldWeek, worldId, 1);
    }
    function worldOpenWeek(worldId) { return openWeek(SCHEDULE.worldWeek, worldId, 1); }
    function canUseDiff(i) {
        const st = myState();
        if (!st || st.ended) return true;
        return st.week >= openWeek(SCHEDULE.diffWeek, i, 1);
    }
    function diffOpenWeek(i) { return openWeek(SCHEDULE.diffWeek, i, 1); }
    // 世界をまたぐ門の出現条件（難易度）。ナイトメアが解放されるまでは、ハード攻略で代用できる
    function gateDiffReq(req) {
        const st = myState();
        if (!st || st.ended || canUseDiff(req)) return req;
        let best = 0;
        for (let i = 0; i < req; i++) if (canUseDiff(i)) best = i;
        return best;
    }
    function pvpEventOpen() {
        const st = myState();
        return !!(st && !st.ended && st.week >= SCHEDULE.pvpWeek);
    }
    // ステージに入れるか（理由つき）
    function canEnterStage(stage, diffIdx) {
        if (stage && stage.pvp) return { ok: true };         // オンラインマッチはどちらのキャラでも遊べる
        if (stage && stage.anyChar) return { ok: true };       // 無限回廊：どちらのキャラでも、いつでも入れる
        if (stage && stage.standardOnly && isSeasonChar()) return { ok: false, reason: 'このステージは、スタンダードキャラ専用（スタンダードワールド）です。' };
        const wid = stage ? (stage.world || 1) : 1;
        if (!isSeasonChar() && !(stage && stage.standardOnly) && !STANDARD_CAN_PLAY_SEASON_WORLDS) return { ok: false, reason: 'シーズンワールドは、シーズンキャラで遊べます。スタンダードキャラは「スタンダードワールド」へ！' };
        if (!canEnterWorld(wid)) return { ok: false, reason: '第' + wid + '世界は、シーズン' + worldOpenWeek(wid) + '週目から解放されます。' };
        if (!canUseDiff(diffIdx || 0)) return { ok: false, reason: 'この難易度は、シーズン' + diffOpenWeek(diffIdx) + '週目から解放されます。' };
        return { ok: true };
    }

    // ---------- キャラの入れ替え ----------
    function liveRaw() { return { player: localStorage.getItem('player'), hack: localStorage.getItem('sbHack') }; }
    function putLive(raw) {
        if (raw && raw.player) localStorage.setItem('player', raw.player); else localStorage.removeItem('player');
        if (raw && raw.hack) localStorage.setItem('sbHack', raw.hack); else localStorage.removeItem('sbHack');
    }
    function hasSlot(d, mode) {
        return d.active === mode ? !!localStorage.getItem('player') : !!(d.slots[mode] && d.slots[mode].player);
    }
    function rawOf(d, mode) { return d.active === mode ? liveRaw() : d.slots[mode]; }
    function parseSafe(s) { try { return JSON.parse(s); } catch (e) { return null; } }
    function summary(raw) {
        const p = raw && parseSafe(raw.player);
        if (!p) return null;
        const total = ['maxHp', 'atk', 'def', 'speed', 'special'].reduce((a, k) => a + (Number(p[k]) || 0), 0);
        const lv = p.level || (typeof calcLevel === 'function' ? calcLevel(p.xp || 0) : 1);
        return { name: p.name || '名無し', level: lv, total: total, id: p.id };
    }

    // 作りかけのシーズンキャラは、キャラ作成が終わった時点で確定する
    function settle() {
        const d = load();
        if (d.active === 'season' && d.pendingCreate && localStorage.getItem('player')) { d.pendingCreate = false; save(d); }
        unifyIds();     // 作りたてのキャラが別のIDになっていたら、共通IDにそろえる
    }

    function reload() { setTimeout(() => location.reload(), 80); }

    function switchTo(mode) {
        const d = load();
        if (d.active === mode) return false;
        if (!hasSlot(d, mode)) { alert(mode === 'season' ? 'シーズンキャラがまだいません。' : 'スタンダードキャラがまだいません。'); return false; }
        d.slots[d.active] = liveRaw();
        const target = d.slots[mode]; d.slots[mode] = null;
        putLive(target);
        d.active = mode;
        save(d); reload();
        return true;
    }

    function startSeasonChar() {
        const d = load(), cur = currentDef();
        if (!cur) { alert('いま開催中のシーズンはありません。'); return; }
        if (d.active === 'season' || hasSlot(d, 'season')) { alert('すでにシーズンキャラがいます。'); return; }
        if (!confirm(cur.name + 'に参加します。\n・新しいキャラクターを作成します（レベル1・素手スタート）\n・勉強効率+10%\n・いまのキャラはスタンダードキャラとして安全に保管されます\n\nよろしいですか？')) return;
        const raw = liveRaw();
        d.slots.standard = raw.player ? raw : null;      // いまのキャラは（スタンダードとして）そのまま預かる
        putLive(null);
        d.active = 'season'; d.seasonId = cur.id; d.pendingCreate = true;
        save(d); reload();
    }

    function cancelCreation() {
        const d = load();
        if (d.active !== 'season' || localStorage.getItem('player')) return;
        if (!confirm('シーズンキャラの作成をやめて、スタンダードキャラに戻りますか？')) return;
        const target = d.slots.standard; d.slots.standard = null;
        putLive(target);
        d.active = 'standard'; d.seasonId = null; d.pendingCreate = false;
        save(d); reload();
    }

    // シーズン終了：シーズンキャラがスタンダードキャラになり、既存のスタンダードキャラは上書きされる
    function canMerge(d) {
        if (!hasSlot(d, 'season')) return false;
        const def = defById(d.seasonId);
        const cur = currentDef();
        return !!(def && (now() >= endMs(def) || (cur && cur.id !== def.id)));
    }
    // ---------- 統合（足し合わせ）----------
    //  シーズンキャラが「伸ばした分」を、スタンダードキャラに加える（置き換えない）。
    //   ・ステータス：シーズンキャラの値から初期値（キャラ作成直後の合計250）を引いた分を加算
    //   ・XP・勉強時間・コイン・結晶・素材・ボス撃破数などは合算。レベルは合算XPから計算し直す
    //   ・武器・防具・アクセサリー・オーブは、スタンダードの分にシーズンの分を加える（IDが同じものは重複させない）
    //   ・名前・装備中の武器・スキルツリー・勉強記録など「そのキャラらしさ」はスタンダードのまま
    const STAT_KEYS_S = ['maxHp', 'atk', 'def', 'speed', 'special'];
    const BASE_STATS_S = { maxHp: 50, atk: 70, def: 50, speed: 30, special: 50 };   // stats.js の DEFAULT_STATS
    const nz = v => (isFinite(Number(v)) ? Number(v) : 0);
    function asDict(x) {
        if (Array.isArray(x)) { const o = {}; x.forEach(m => { if (m && m.id) o[m.id] = (o[m.id] || 0) + nz(m.count); }); return o; }
        return (x && typeof x === 'object') ? x : {};
    }
    function sumCounters(a, b) {
        const out = Object.assign({}, asDict(a)), bb = asDict(b);
        Object.keys(bb).forEach(k => {
            if (k === '__proto__') return;
            if (typeof out[k] === 'number' && typeof bb[k] === 'number') out[k] = out[k] + bb[k];
            else if (out[k] === undefined) out[k] = bb[k];
        });
        return out;
    }
    function unionById(a, b, skip) {
        const out = Array.isArray(a) ? a.slice() : [];
        const seen = new Set(out.map(x => x && x.id).filter(Boolean));
        (Array.isArray(b) ? b : []).forEach(x => {
            if (!x || (skip && skip(x))) return;
            if (x.id) { if (seen.has(x.id)) return; seen.add(x.id); }
            out.push(x);
        });
        return out;
    }
    function mergePlayers(std, sea, accountId) {
        const m = Object.assign({}, std);
        STAT_KEYS_S.forEach(k => { m[k] = nz(std[k]) + Math.max(0, nz(sea[k]) - BASE_STATS_S[k]); });
        m.xp = nz(std.xp) + nz(sea.xp);
        m.level = typeof calcLevel === 'function' ? calcLevel(m.xp) : Math.max(nz(std.level), nz(sea.level), 1);
        m.totalStudySeconds = nz(std.totalStudySeconds) + nz(sea.totalStudySeconds);
        m.coins = nz(std.coins) + nz(sea.coins);
        m.pvpWins = nz(std.pvpWins) + nz(sea.pvpWins);
        m.bossRunCount = nz(std.bossRunCount) + nz(sea.bossRunCount);
        m.grade = Math.max(nz(std.grade), nz(sea.grade), 1);
        m.craftCurrency = sumCounters(std.craftCurrency, sea.craftCurrency);
        m.materials = sumCounters(std.materials, sea.materials);
        m.bossDefeats = sumCounters(std.bossDefeats, sea.bossDefeats);
        m.dungeonClears = sumCounters(std.dungeonClears, sea.dungeonClears);
        m.orbs = unionById(std.orbs, sea.orbs);
        m.weapons = unionById(std.weapons, sea.weapons, w => w.source === 'starter');
        m.hp = m.maxHp;
        if (accountId) m.id = accountId;
        return m;
    }
    function mergeHacks(sh, ah, accountId) {
        const s0 = (sh && typeof sh === 'object') ? sh : {}, a0 = (ah && typeof ah === 'object') ? ah : {};
        const m = Object.assign({}, s0);
        ['weapons', 'armors', 'accs'].forEach(k => { m[k] = unionById(s0[k], a0[k], x => x.source === 'starter'); });
        m.items = sumCounters(s0.items, a0.items);
        m.cleared = Object.assign({}, a0.cleared || {}); Object.keys(s0.cleared || {}).forEach(k => { if (s0.cleared[k]) m.cleared[k] = s0.cleared[k]; });
        m.clearedDiff = Object.assign({}, a0.clearedDiff || {}); Object.keys(s0.clearedDiff || {}).forEach(k => { m.clearedDiff[k] = Math.max(nz(s0.clearedDiff[k]), nz((a0.clearedDiff || {})[k])); });
        if (accountId) m.owner = String(accountId);
        return m;
    }
    function mergeRaw(stdRaw, seaRaw, accountId) {
        const sp = parseSafe(stdRaw.player), ap = parseSafe(seaRaw.player);
        if (!sp || !ap) return null;
        return {
            player: JSON.stringify(mergePlayers(sp, ap, accountId)),
            hack: JSON.stringify(mergeHacks(parseSafe(stdRaw.hack), parseSafe(seaRaw.hack), accountId))
        };
    }
    function mergeSeason() {
        const d = load();
        if (!canMerge(d)) { alert('シーズンが終わるまでは、スタンダードに統合できません。'); return; }
        const seasonRaw = rawOf(d, 'season'), stdRaw = hasSlot(d, 'standard') ? rawOf(d, 'standard') : null;
        const sc = summary(seasonRaw), sd = stdRaw ? summary(stdRaw) : null;
        if (!sc) { alert('シーズンキャラのデータを読み込めませんでした。統合を中止します。'); return; }
        const acct = ensureAccountId(d);
        let merged = null;
        if (stdRaw && sd) {
            merged = mergeRaw(stdRaw, seasonRaw, acct);
            if (!merged) { alert('キャラのデータを読み込めませんでした。統合を中止します。'); return; }
        } else {
            // スタンダードキャラがいない：シーズンキャラがそのままスタンダードになる
            const np = parseSafe(seasonRaw.player), nh = parseSafe(seasonRaw.hack);
            if (acct) { np.id = acct; if (nh) nh.owner = String(acct); }
            merged = { player: JSON.stringify(np), hack: nh ? JSON.stringify(nh) : seasonRaw.hack };
        }
        const after = summary(merged);
        const msg = 'シーズンキャラ「' + sc.name + '」（Lv' + sc.level + '・ステータス合計 ' + sc.total + '）を、スタンダードキャラに統合します。\n' +
            (sd ? '\n現在のスタンダードキャラ「' + sd.name + '」（Lv' + sd.level + '・合計 ' + sd.total + '）に、シーズンで伸ばした分が足されます。\n' +
                  '→ 統合後：Lv' + after.level + '・合計 ' + after.total + '\n（上書きではなく足し合わせです。念のため統合前の2体は端末にバックアップされます）\n' : '') +
            '\nよろしいですか？';
        if (!confirm(msg)) return;
        // バックアップ（統合前の2体）
        d.backup = stdRaw && stdRaw.player ? { player: stdRaw.player, hack: stdRaw.hack, at: now(), seasonId: d.seasonId, merged: true, season: { player: seasonRaw.player, hack: seasonRaw.hack } } : null;
        putLive(merged);
        d.slots = { standard: null, season: null };
        d.active = 'standard'; d.history.push({ seasonId: d.seasonId, mergedAt: now(), mode: 'add' });
        d.seasonId = null; d.pendingCreate = false;
        save(d); reload();
    }

    // ---------- 「置き換わってしまった」統合のやり直し ----------
    //  以前の版では、統合するとシーズンキャラがスタンダードを「置き換え」ていた。そのとき上書きされたスタンダードは backup に残っている。
    //  それを今の（置き換えで残ったシーズンキャラの）データに足し合わせて、本来の統合にやり直す。
    function canRemerge(d) {
        return !!(d.backup && d.backup.player && !d.backup.merged && d.backup.seasonId && d.active === 'standard' && localStorage.getItem('player'));
    }
    function remergeFromBackup() {
        const d = load();
        if (!canRemerge(d)) { alert('やり直せる統合データがありません。'); return; }
        const live = liveRaw(), cur = summary(live), old = summary(d.backup);
        if (!cur || !old) { alert('データを読み込めませんでした。'); return; }
        const acct = ensureAccountId(d);
        const merged = mergeRaw({ player: d.backup.player, hack: d.backup.hack }, live, acct);
        if (!merged) { alert('データを読み込めませんでした。中止します。'); return; }
        const after = summary(merged);
        if (!confirm('統合をやり直します。\n\n・いまのキャラ「' + cur.name + '」（Lv' + cur.level + '・合計 ' + cur.total + '）\n・置き換えで消えた元のスタンダード「' + old.name + '」（Lv' + old.level + '・合計 ' + old.total + '）\n\n→ 足し合わせて Lv' + after.level + '・合計 ' + after.total + ' のスタンダードキャラになります。\n（やり直しの前の状態は端末に残るので、あとで取り消せます）\n\nよろしいですか？')) return;
        d.undoRemerge = { player: live.player, hack: live.hack, at: now() };
        d.backup.merged = true;
        putLive(merged);
        save(d); reload();
    }
    function undoRemerge() {
        const d = load();
        if (!d.undoRemerge || !d.undoRemerge.player || d.active !== 'standard') { alert('取り消せるやり直しはありません。'); return; }
        if (!confirm('統合のやり直しを取り消して、やり直す前の状態に戻します。よろしいですか？')) return;
        putLive({ player: d.undoRemerge.player, hack: d.undoRemerge.hack });
        if (d.backup) d.backup.merged = false;
        delete d.undoRemerge;
        save(d); reload();
    }
    function restoreBackup() {
        const d = load();
        if (!d.backup || !d.backup.player) { alert('バックアップはありません。'); return; }
        if (d.active === 'season') { alert('スタンダードキャラを操作中にだけ復元できます。'); return; }
        const b = summary(d.backup), cur = summary(liveRaw());
        if (!confirm('1つ前のスタンダードキャラ「' + b.name + '」（Lv' + b.level + '・合計 ' + b.total + '）に戻します。\n' + (cur ? '現在のスタンダードキャラ「' + cur.name + '」はバックアップに入れ替わります。' : '') + '\nよろしいですか？')) return;
        const prev = liveRaw();
        putLive({ player: d.backup.player, hack: d.backup.hack });
        d.backup = prev.player ? { player: prev.player, hack: prev.hack, at: now(), seasonId: null } : null;
        save(d); reload();
    }

    // ---------- 画面（パネル）----------
    function injectStyle() {
        if (document.getElementById('seasonStyle')) return;
        const st = document.createElement('style'); st.id = 'seasonStyle';
        st.textContent = [
            '.ss-ov{position:fixed;inset:0;background:rgba(5,8,20,.78);z-index:100010;display:flex;align-items:center;justify-content:center;padding:10px}',
            '.ss-box{background:#141a2e;color:#e6ecff;border:1px solid #3a4a80;border-radius:14px;width:min(560px,100%);max-height:92vh;overflow:auto;padding:14px 16px;font-size:.92rem;line-height:1.55}',
            '.ss-box h2{margin:0 0 4px;font-size:1.15rem}.ss-sec{margin:12px 0 4px;font-weight:bold;color:#ffd36a;font-size:.88rem}',
            '.ss-x{float:right;background:#2a3358;color:#fff;border:0;border-radius:8px;padding:5px 10px;cursor:pointer}',
            '.ss-card{background:#1c2542;border:1px solid #33427a;border-radius:10px;padding:8px 10px;margin:4px 0}.ss-card.on{border-color:#ffd36a;box-shadow:0 0 0 1px #ffd36a inset}',
            '.ss-ph{padding:5px 8px;border-radius:8px;margin:3px 0;background:#1a2140}.ss-ph.now{background:#3a2f12;border:1px solid #ffd36a}',
            '.ss-btn{display:inline-block;background:#3a6ee8;color:#fff;border:0;border-radius:9px;padding:8px 12px;margin:4px 6px 0 0;cursor:pointer;font-weight:bold}',
            '.ss-btn.gray{background:#3a4468}.ss-btn.red{background:#b03a3a}.ss-btn.gold{background:#d9a62a;color:#201600}',
            '.ss-note{font-size:.78rem;color:#9fb0dc}',
            '.ss-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:100009;background:#2a1f5a;color:#fff;border:1px solid #ffd36a;border-radius:12px;padding:10px 14px;max-width:92vw;font-size:.88rem;text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.5)}',
            '.ss-banner button{margin-left:8px}'
        ].join('');
        document.head.appendChild(st);
    }
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function fmtDate(ms) { const t = new Date(ms); return t.getFullYear() + '/' + (t.getMonth() + 1) + '/' + t.getDate(); }
    function charLine(label, sm, active) {
        if (!sm) return '<div class="ss-card"><b>' + label + '</b>　<span class="ss-note">まだいません</span></div>';
        return '<div class="ss-card' + (active ? ' on' : '') + '"><b>' + label + '</b>' + (active ? ' 【操作中】' : '') + '<br>' + esc(sm.name) + '　Lv' + sm.level + '　ステータス合計 ' + sm.total + '</div>';
    }

    function openPanel() {
        injectStyle();
        const old = document.getElementById('ssOv'); if (old) old.remove();
        const d = load(), cur = currentDef(), t = now();
        const ov = document.createElement('div'); ov.id = 'ssOv'; ov.className = 'ss-ov';
        const box = document.createElement('div'); box.className = 'ss-box'; ov.appendChild(box);
        const close = () => ov.remove();
        ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });

        const mine = defById(d.seasonId) || cur;
        const showDef = mine || cur;
        const week = showDef ? (t >= endMs(showDef) ? showDef.weeks : weekOf(showDef)) : 0;
        const stdSm = hasSlot(d, 'standard') ? summary(rawOf(d, 'standard')) : null;
        const seaSm = hasSlot(d, 'season') ? summary(rawOf(d, 'season')) : null;
        const merge = canMerge(d);

        let h = '<button class="ss-x" id="ssClose">閉じる ✕</button><h2>🏆 シーズン</h2>';
        if (showDef) {
            const started = t >= startMs(showDef), ended = t >= endMs(showDef);
            const daysLeft = Math.max(0, Math.ceil((endMs(showDef) - t) / 86400000));
            h += '<div><b>' + esc(showDef.name) + '</b>　' + fmtDate(startMs(showDef)) + ' 〜 ' + fmtDate(endMs(showDef)) + '</div>' +
                '<div class="ss-note">' + (!started ? 'まだ始まっていません' : (ended ? 'シーズンは終了しました' : '現在 第' + week + '週 / 全' + showDef.weeks + '週（残り' + daysLeft + '日）')) + '</div>';
        } else {
            h += '<div class="ss-note">いま開催中のシーズンはありません。次のシーズンをお待ちください。</div>';
        }
        h += '<div class="ss-sec">キャラクター</div>' +
            charLine('🌟 シーズンキャラ', seaSm, d.active === 'season') + charLine('♾️ スタンダードキャラ', stdSm, d.active === 'standard') +
            '<div class="ss-note">シーズンキャラ：勉強効率+10%・レベル1の素手スタート・週ごとに世界と難易度が解放。<br>スタンダードキャラ：永遠の資産。シーズン終了時、シーズンキャラで伸ばした分がここに足し合わされます（上書きではなく統合）。どちらのキャラも同じ引継ぎコード（プレイヤーID）です。専用のエンドコンテンツ「永劫の玉座」に挑めます。</div>';

        if (showDef) {
            h += '<div class="ss-sec">週ごとのスケジュール</div>';
            SCHEDULE.phases.forEach(p => {
                const on = week >= p.from && week <= p.to && t >= startMs(showDef) && t < endMs(showDef);
                h += '<div class="ss-ph' + (on ? ' now' : '') + '"><b>' + p.title + '</b>' + (on ? ' ◀ 今ここ' : '') + '<br><span class="ss-note">' + esc(p.text) + '</span></div>';
            });
            h += '<div class="ss-note">※ シーズンキャラだけが対象。スタンダードキャラは最初から全て選べます。</div>';
        }

        h += '<div class="ss-sec">操作</div><div id="ssActs"></div>';
        box.innerHTML = h;
        const acts = box.querySelector('#ssActs');
        const add = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'ss-btn ' + cls; b.textContent = label; b.addEventListener('click', fn); acts.appendChild(b); };

        if (d.active === 'season' && !localStorage.getItem('player')) add('作成をやめてスタンダードに戻る', 'gray', cancelCreation);
        if (!seaSm && cur && d.active !== 'season') add('🌟 シーズンキャラを作って参加', 'gold', startSeasonChar);
        if (seaSm && stdSm) {
            if (d.active === 'standard') add('🌟 シーズンキャラに切り替え', '', () => switchTo('season'));
            else add('♾️ スタンダードキャラに切り替え', '', () => switchTo('standard'));
        }
        if (merge) add('🏁 シーズンを終了してスタンダードに統合', 'red', mergeSeason);
        if (canRemerge(d)) add('🔁 置き換わった統合をやり直す（足し合わせ）', 'gold', remergeFromBackup);
        if (d.undoRemerge && d.active === 'standard') add('↩ 統合のやり直しを取り消す', 'gray', undoRemerge);
        if (d.backup && d.backup.player && d.active === 'standard') {
            const b = summary(d.backup);
            add('↩ 1つ前のスタンダードに戻す（' + (b ? b.name : '?') + '）', 'gray', restoreBackup);
        }
        if (!acts.children.length) acts.innerHTML = '<span class="ss-note">いまできる操作はありません。</span>';
        box.querySelector('#ssClose').addEventListener('click', close);
        document.body.appendChild(ov);
    }

    // 小さな通知（画面下）
    function banner(text, btnLabel, fn, ms) {
        injectStyle();
        const b = document.createElement('div'); b.className = 'ss-banner'; b.textContent = text;
        if (btnLabel) { const k = document.createElement('button'); k.className = 'ss-btn'; k.textContent = btnLabel; k.addEventListener('click', () => { b.remove(); fn && fn(); }); b.appendChild(k); }
        const x = document.createElement('button'); x.className = 'ss-btn gray'; x.textContent = '×'; x.addEventListener('click', () => b.remove()); b.appendChild(x);
        document.body.appendChild(b);
        if (ms) setTimeout(() => b.remove(), ms);
    }

    // ---------- 起動時の「ワールド選択」----------
    function enterStandardFresh() {
        // スタンダードキャラがまだいないとき：シーズンキャラを預けて、新しくスタンダードキャラを作る
        const d = load();
        d.slots.season = liveRaw();
        putLive(null);
        d.active = 'standard';
        save(d); reload();
    }
    function chooseWorld(mode) {
        const d = load();
        try { sessionStorage.setItem('sbWorldChosen', '1'); } catch (e) {}
        if (mode === 'standard') {
            if (d.active === 'standard') return 'stay';
            if (hasSlot(d, 'standard')) { switchTo('standard'); return 'switch'; }
            enterStandardFresh(); return 'switch';
        }
        if (d.active === 'season') return 'stay';
        if (hasSlot(d, 'season')) { switchTo('season'); return 'switch'; }
        startSeasonChar();
        return 'switch';
    }
    function openWorldSelect(onDone) {
        injectStyle();
        const old = document.getElementById('ssWorld'); if (old) old.remove();
        const d = load(), cur = currentDef(), t = now();
        const stdSm = hasSlot(d, 'standard') ? summary(rawOf(d, 'standard')) : null;
        const seaSm = hasSlot(d, 'season') ? summary(rawOf(d, 'season')) : null;
        const seaDef = defById(d.seasonId) || cur;
        const merge = canMerge(d);
        const ov = document.createElement('div'); ov.id = 'ssWorld'; ov.className = 'ss-ov';
        const box = document.createElement('div'); box.className = 'ss-box'; box.style.width = 'min(760px,100%)'; ov.appendChild(box);
        const line = sm => sm ? esc(sm.name) + '　Lv' + sm.level + '　合計 ' + sm.total.toLocaleString() : 'まだキャラがいません';
        const week = cur ? weekOf(cur) : 0;
        const seasonDisabled = !cur && !seaSm;
        box.innerHTML = '<h2 style="text-align:center">どちらのワールドで遊ぶ？</h2>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<div class="ss-card' + (d.active === 'season' ? ' on' : '') + '" style="flex:1 1 280px"><div style="font-size:1.25rem"><b>🌟 シーズンワールド</b>' + (d.active === 'season' ? '　【前回】' : '') + (!stdSm && !seaSm ? '　<span style="color:#ffd36a">★はじめての人におすすめ</span>' : '') + '</div>' +
              '<div class="ss-note" style="margin:4px 0">第一〜第五世界。レベル1・素手スタートで、勉強効率+10%。週ごとにステージと難易度が解放される短期決戦。' +
              (cur ? '<br>' + esc(cur.name) + '：第' + week + '週 / 全' + cur.weeks + '週' : '<br>いま開催中のシーズンはありません') + '</div>' +
              '<div style="font-size:.85rem">🌟 ' + line(seaSm) + '</div>' +
              '<button class="ss-btn gold" id="ssGoSeason"' + (seasonDisabled ? ' disabled style="opacity:.5"' : '') + '>' + (seaSm ? (merge ? 'シーズンを終了して統合へ' : 'シーズンワールドへ') : (cur ? 'シーズンに参加（キャラ作成）' : '準備中')) + '</button></div>' +
            '<div class="ss-card' + (d.active === 'standard' ? ' on' : '') + '" style="flex:1 1 280px"><div style="font-size:1.25rem"><b>♾️ スタンダードワールド</b>' + (d.active === 'standard' ? '　【前回】' : '') + '</div>' +
              '<div class="ss-note" style="margin:4px 0">スタンダードキャラの世界。シーズンで持ち帰ったステータスを試す、永遠のエンドコンテンツ。最初のボスからHPが1億超え。協力プレイ推奨。</div>' +
              '<div style="font-size:.85rem">♾️ ' + line(stdSm) + '</div>' +
              '<button class="ss-btn" id="ssGoStd">' + (stdSm ? 'スタンダードワールドへ' : 'キャラを作って入る') + '</button></div>' +
            '</div><div class="ss-note" style="text-align:center;margin-top:8px">あとで 🏆 ボタンから切り替えられます。</div>';
        const done = r => { ov.remove(); if (r === 'stay' && onDone) onDone(); };
        document.body.appendChild(ov);
        box.querySelector('#ssGoStd').addEventListener('click', () => done(chooseWorld('standard')));
        box.querySelector('#ssGoSeason').addEventListener('click', () => {
            if (seaSm && merge) { try { sessionStorage.setItem('sbWorldChosen', '1'); } catch (e) {} ov.remove(); openPanel(); return; }
            done(chooseWorld('season'));
        });
    }

    function showNotices() {
        const d = load(), cur = currentDef();
        if (d.active === 'season' && !localStorage.getItem('player')) {
            banner('🌟 シーズンキャラを作成中です。名前とステータスを決めて「キャラクター作成」を押してください。', 'やめる', cancelCreation);
            return;
        }
        if (canMerge(d)) { banner('🏁 シーズンが終わりました！シーズンキャラをスタンダードに統合できます。', 'シーズン画面を開く', openPanel); return; }
        if (cur && !d.seen['s' + cur.id]) {
            d.seen['s' + cur.id] = true; save(d);
            banner('🏆 ' + cur.name + 'が始まりました！シーズンキャラは勉強効率+10%。', 'くわしく見る', openPanel, 15000);
        }
    }

    function onReady() {
        settle();
        const hasUI = !!document.getElementById('uiSettingsBtn');   // 町（index.html）でだけ通知やボタンを出す
        if (!hasUI) return;
        const btn = document.getElementById('seasonBtn');
        if (btn) { btn.addEventListener('click', openPanel); const sp = btn.querySelector('span'); if (sp) sp.textContent = isSeasonChar() ? '🌟' : '♾️'; btn.title = isSeasonChar() ? 'シーズンワールド' : 'スタンダードワールド'; }
        const d = load();
        let chosen = false; try { chosen = !!sessionStorage.getItem('sbWorldChosen'); } catch (e) {}
        const creating = d.active === 'season' && !localStorage.getItem('player');   // シーズンキャラ作成中は選ばせない
        if (!chosen && !creating) { openWorldSelect(showNotices); return; }
        showNotices();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
    syncTime();

    window.SeasonSys = {
        SEASONS: SEASONS, SCHEDULE: SCHEDULE,
        isSeasonChar: isSeasonChar, studyMultiplier: studyMultiplier, currentDef: currentDef, state: myState,
        canEnterWorld: canEnterWorld, worldOpenWeek: worldOpenWeek, canUseDiff: canUseDiff, diffOpenWeek: diffOpenWeek,
        gateDiffReq: gateDiffReq, pvpEventOpen: pvpEventOpen, canEnterStage: canEnterStage,
        openPanel: openPanel, openWorldSelect: openWorldSelect, switchTo: switchTo, startSeasonChar: startSeasonChar, mergeSeason: mergeSeason, now: now,
        // 共通ID・ワールド（市場・同期が使う）
        mode: function () { return isSeasonChar() ? 'season' : 'standard'; },
        accountId: function () { try { return ensureAccountId(load()); } catch (e) { return null; } },
        legacyIds: function () { try { return (load().legacyIds || []).slice(); } catch (e) { return []; } },
        idForNewChar: idForNewChar, netId: netId,
        remergeFromBackup: remergeFromBackup, undoRemerge: undoRemerge,
        _test: { mergePlayers: mergePlayers, mergeHacks: mergeHacks, mergeRaw: mergeRaw, ensureAccountId: ensureAccountId, unifyIds: unifyIds }
    };
})();
