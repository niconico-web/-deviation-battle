// ============================================================
// サウンド (sound.js)
//  ・音声ファイルを使わず、Web Audio API で効果音とBGMをその場で合成する
//  ・AudioContext はブラウザの仕様上「ユーザー操作のあと」でしか作れないため、
//    最初のタップ／キー入力で初期化する
//  ・BGMは画面ごとに自動で切り替わる（下の PAGE_BGM）。Mキーでミュート切替
// ============================================================
(function () {
    'use strict';

    const STORE_KEY = 'sb_sound_v1';
    let muted = false;
    try { muted = localStorage.getItem(STORE_KEY) === '0'; } catch (e) { /* noop */ }

    let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
    let bgmName = null, bgmStep = 0, bgmNextTime = 0, bgmTimer = null;
    const lastPlay = new Map();   // 連打でSEが重なりすぎないよう、名前ごとの最小間隔

    // ---------- 初期化（ユーザー操作が必要） ----------
    function ac() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            try { ctx = new AC(); } catch (e) { return null; }
            master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
            musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
            sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
            const len = Math.floor(ctx.sampleRate * 1);
            noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    // ---------- 音を鳴らす部品 ----------
    function tone(o) {
        const c = ac(); if (!c || muted) return;
        const t0 = c.currentTime + (o.delay || 0);
        const dur = o.dur || 0.15;
        const osc = c.createOscillator(), g = c.createGain();
        osc.type = o.type || 'square';
        osc.frequency.setValueAtTime(Math.max(20, o.f), t0);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + dur);
        const v = o.vol == null ? 0.25 : o.vol;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(v, t0 + Math.min(o.att || 0.01, dur * 0.6));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g); g.connect(o.bus || sfxBus);
        osc.start(t0); osc.stop(t0 + dur + 0.05);
    }
    function noise(o) {
        const c = ac(); if (!c || muted || !noiseBuf) return;
        const t0 = c.currentTime + (o.delay || 0);
        const dur = o.dur || 0.1;
        const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = o.filter || 'bandpass';
        f.frequency.setValueAtTime(o.f || 1200, t0);
        if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2), t0 + dur);
        f.Q.value = o.q || 1;
        const g = c.createGain();
        const v = o.vol == null ? 0.2 : o.vol;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
        src.start(t0); src.stop(t0 + dur + 0.05);
    }
    const N2F = m => 440 * Math.pow(2, (m - 69) / 12);   // MIDIノート番号 → 周波数

    // ---------- 効果音 ----------
    // 連打されるSEは最小間隔を空ける（hit が毎フレーム鳴り続けるのを防ぐ）
    const MIN_GAP = { hit: 0.05, crit: 0.07, swing: 0.08, coin: 0.05, hurt: 0.15, die: 0.1 };
    const SFX = {
        click:   () => tone({ f: 880, f2: 660, dur: 0.05, vol: 0.12, type: 'square' }),
        swing:   () => noise({ dur: 0.12, vol: 0.22, f: 2600, f2: 500, q: 2 }),
        hit:     () => { noise({ dur: 0.07, vol: 0.3, f: 900, f2: 200, q: 1 }); tone({ f: 160, f2: 70, dur: 0.08, vol: 0.28, type: 'square' }); },
        crit:    () => { noise({ dur: 0.09, vol: 0.35, f: 1400, f2: 250, q: 1.5 }); tone({ f: 220, f2: 60, dur: 0.12, vol: 0.32, type: 'sawtooth' }); },
        hurt:    () => { tone({ f: 240, f2: 90, dur: 0.18, vol: 0.3, type: 'sawtooth' }); noise({ dur: 0.12, vol: 0.2, f: 500, f2: 150, q: 1 }); },
        die:     () => tone({ f: 320, f2: 50, dur: 0.28, vol: 0.25, type: 'square' }),
        bossdie: () => { tone({ f: 200, f2: 40, dur: 0.5, vol: 0.35, type: 'sawtooth' }); noise({ dur: 0.4, vol: 0.3, f: 700, f2: 100, q: 1 }); },
        correct: () => { tone({ f: N2F(76), dur: 0.09, vol: 0.22, type: 'sine' }); tone({ f: N2F(81), dur: 0.14, vol: 0.22, type: 'sine', delay: 0.08 }); },
        wrong:   () => tone({ f: 200, f2: 110, dur: 0.22, vol: 0.22, type: 'square' }),
        coin:    () => { tone({ f: 990, dur: 0.06, vol: 0.16, type: 'square' }); tone({ f: 1320, dur: 0.12, vol: 0.16, type: 'square', delay: 0.06 }); },
        levelup: () => [72, 76, 79, 84].forEach((m, i) => tone({ f: N2F(m), dur: 0.12, vol: 0.2, type: 'square', delay: i * 0.07 })),
        heal:    () => { tone({ f: N2F(67), dur: 0.15, vol: 0.15, type: 'sine' }); tone({ f: N2F(74), dur: 0.2, vol: 0.15, type: 'sine', delay: 0.1 }); },
        skill:   () => { tone({ f: 440, f2: 880, dur: 0.18, vol: 0.2, type: 'sawtooth' }); noise({ dur: 0.15, vol: 0.12, f: 2000, f2: 4000, q: 3 }); },
        ult:     () => { tone({ f: 110, f2: 440, dur: 0.4, vol: 0.3, type: 'sawtooth' }); noise({ dur: 0.35, vol: 0.28, f: 800, f2: 300, q: 1 }); tone({ f: N2F(81), dur: 0.3, vol: 0.18, type: 'square', delay: 0.25 }); },
        dash:    () => noise({ dur: 0.15, vol: 0.18, f: 600, f2: 2400, q: 2 }),
        guard:   () => tone({ f: 330, f2: 220, dur: 0.12, vol: 0.18, type: 'triangle' }),
        boss:    () => { tone({ f: 98, dur: 0.7, vol: 0.35, type: 'sawtooth' }); tone({ f: 147, dur: 0.7, vol: 0.25, type: 'sawtooth', delay: 0.05 }); noise({ dur: 0.5, vol: 0.15, f: 300, q: 1 }); },
        victory: () => [72, 76, 79, 84, 88].forEach((m, i) => tone({ f: N2F(m), dur: 0.22, vol: 0.22, type: 'square', delay: i * 0.12 })),
        defeat:  () => [67, 64, 60, 55].forEach((m, i) => tone({ f: N2F(m), dur: 0.3, vol: 0.2, type: 'triangle', delay: i * 0.18 })),
        energy:  () => tone({ f: 1320, dur: 0.05, vol: 0.1, type: 'sine' }),
        chest:   () => { tone({ f: N2F(72), dur: 0.1, vol: 0.18, type: 'triangle' }); tone({ f: N2F(79), dur: 0.16, vol: 0.18, type: 'triangle', delay: 0.09 }); }
    };

    function sfx(name) {
        const fn = SFX[name]; if (!fn) return;
        const now = ac() ? ctx.currentTime : 0;
        const gap = MIN_GAP[name] || 0;
        if (gap) {
            const last = lastPlay.get(name) || -9;
            if (now - last < gap) return;
            lastPlay.set(name, now);
        }
        try { fn(); } catch (e) { /* 音が出なくてもゲームは続く */ }
    }

    // ---------- BGM：その場で作曲する ----------
    //  以前は「2小節を延々と繰り返す」だけで、すぐに飽きた。いまは、コード進行・旋律・ベース・ドラムを、
    //  8小節ずつの「段落」（静か→盛り上がり→サビ→ブレイク）に分けて作り、旋律は周回のたびに一部が変わる。
    //  曲はステージごとに違う（同じステージでは同じ曲。stage.id から決める）。ボス・大討伐戦・ボスラッシュ・無限回廊・対戦・勝利も別の曲。
    const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10] };
    function rng(seed) { let s = (seed | 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }      // 同じ種からは、同じ乱数列（曲を作り直せる）
    function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function degNote(T, d, oct) { const sc = SCALES[T.scale], n = sc.length, i = d - 1, o = Math.floor(i / n); return T.root + sc[((i % n) + n) % n] + 12 * (o + (oct || 0)); }      // 音階の第d音（1始まり。7を超える・0以下もOK）

    // 曲の設計：bpm／root（主音のMIDI番号）／scale／progs（コード進行：各小節の度数。8小節）／form（8小節ずつの段落の並び）
    //  form の項目：p=どの進行か　bass=ベースの型　pad=和音の持続音　arp=アルペジオ('8'/'16')　lead=旋律(1普通/2まばら)　harm=ハモリ　drums=ドラムの型　crash=段落の頭にシンバル　fill=最後の小節でフィル　build=最後の2小節で盛り上げ
    const TRACKS = {
        town: [
            { bpm: 90, root: 60, scale: 'major', swing: 0.1, lw: 'triangle', lv: 0.12, dense: 0, progs: { a: [1, 5, 6, 3, 4, 1, 4, 5], b: [6, 4, 1, 5, 6, 4, 2, 5] },
              form: [{ p: 'a', bass: 'half', pad: 1, arp: '8', lead: 2 }, { p: 'a', bass: 'half', pad: 1, arp: '8', lead: 1, drums: 'soft' }, { p: 'b', bass: 'eighth', pad: 1, arp: '8', lead: 1, harm: 1, drums: 'soft' }, { p: 'a', bass: 'half', pad: 1, lead: 2 }] },
            { bpm: 84, root: 62, scale: 'lydian', swing: 0.14, lw: 'triangle', lv: 0.12, dense: 0, progs: { a: [1, 3, 4, 1, 6, 4, 2, 5], b: [4, 1, 6, 3, 4, 2, 5, 1] },
              form: [{ p: 'a', bass: 'half', pad: 1, arp: '8', lead: 2 }, { p: 'b', bass: 'walk', pad: 1, arp: '8', lead: 1, drums: 'soft' }, { p: 'a', bass: 'half', pad: 1, arp: '8', lead: 1, harm: 1, drums: 'soft' }, { p: 'b', bass: 'half', pad: 1, lead: 2 }] }
        ],
        stage: [
            { bpm: 126, root: 57, scale: 'dorian', swing: 0, lw: 'square', lv: 0.1, dense: 1, progs: { a: [1, 7, 6, 7, 1, 7, 6, 5], b: [4, 4, 1, 1, 6, 6, 5, 5] },
              form: [{ p: 'a', bass: 'eighth', pad: 1, drums: 'soft', lead: 2 }, { p: 'a', bass: 'drive', arp: '8', lead: 1, drums: 'rock', crash: 1 }, { p: 'b', bass: 'drive', arp: '16', lead: 1, harm: 1, drums: 'drive', fill: 1 }, { p: 'a', bass: 'half', pad: 1, arp: '8', lead: 2, build: 1 }] },
            { bpm: 116, root: 62, scale: 'major', swing: 0.06, lw: 'square', lv: 0.095, dense: 1, progs: { a: [1, 5, 6, 4, 1, 5, 4, 5], b: [2, 5, 1, 6, 4, 5, 3, 5] },
              form: [{ p: 'a', bass: 'eighth', pad: 1, arp: '8', lead: 1, drums: 'soft' }, { p: 'a', bass: 'walk', arp: '8', lead: 1, harm: 1, drums: 'rock', crash: 1 }, { p: 'b', bass: 'eighth', pad: 1, arp: '16', lead: 1, drums: 'rock', fill: 1 }, { p: 'a', bass: 'half', pad: 1, lead: 2, build: 1 }] },
            { bpm: 132, root: 52, scale: 'phrygian', swing: 0, lw: 'sawtooth', lv: 0.07, dense: 1, progs: { a: [1, 2, 1, 7, 1, 2, 3, 2], b: [6, 7, 1, 1, 6, 7, 5, 5] },
              form: [{ p: 'a', bass: 'drive', pad: 1, drums: 'half', lead: 2 }, { p: 'a', bass: 'drive', arp: '16', lead: 1, drums: 'rock', crash: 1 }, { p: 'b', bass: 'drive', arp: '8', lead: 1, harm: 1, drums: 'drive', fill: 1 }, { p: 'a', bass: 'off', pad: 1, lead: 2, drums: 'half', build: 1 }] },
            { bpm: 110, root: 55, scale: 'mixo', swing: 0.12, lw: 'square', lv: 0.095, dense: 1, progs: { a: [1, 4, 1, 5, 1, 4, 7, 5], b: [6, 2, 5, 1, 6, 2, 5, 5] },
              form: [{ p: 'a', bass: 'walk', pad: 1, drums: 'soft', lead: 2 }, { p: 'a', bass: 'walk', arp: '8', lead: 1, drums: 'rock', crash: 1 }, { p: 'b', bass: 'off', arp: '8', lead: 1, harm: 1, drums: 'rock', fill: 1 }, { p: 'a', bass: 'half', pad: 1, arp: '8', lead: 2, build: 1 }] },
            { bpm: 138, root: 54, scale: 'harm', swing: 0, lw: 'sawtooth', lv: 0.07, dense: 1, progs: { a: [1, 6, 7, 1, 4, 5, 1, 5], b: [4, 5, 6, 3, 4, 5, 1, 1] },
              form: [{ p: 'a', bass: 'eighth', pad: 1, drums: 'soft', lead: 2 }, { p: 'a', bass: 'drive', arp: '16', lead: 1, drums: 'drive', crash: 1 }, { p: 'b', bass: 'drive', arp: '16', lead: 1, harm: 1, drums: 'drive', fill: 1 }, { p: 'b', bass: 'half', pad: 1, lead: 2, build: 1 }] }
        ],
        battle: [
            { bpm: 148, root: 57, scale: 'minor', swing: 0, lw: 'square', lv: 0.1, dense: 1, progs: { a: [1, 1, 6, 7, 1, 1, 4, 5], b: [6, 7, 1, 1, 4, 5, 1, 5] },
              form: [{ p: 'a', bass: 'drive', arp: '16', lead: 1, drums: 'drive', crash: 1 }, { p: 'b', bass: 'drive', arp: '8', lead: 1, harm: 1, drums: 'drive', fill: 1 }, { p: 'a', bass: 'drive', arp: '16', lead: 1, harm: 1, drums: 'drive', crash: 1 }, { p: 'b', bass: 'off', pad: 1, lead: 2, drums: 'half', build: 1 }] },
            { bpm: 140, root: 55, scale: 'dorian', swing: 0, lw: 'sawtooth', lv: 0.075, dense: 1, progs: { a: [1, 4, 1, 7, 1, 4, 6, 5], b: [3, 4, 5, 5, 6, 7, 1, 1] },
              form: [{ p: 'a', bass: 'drive', arp: '8', lead: 1, drums: 'rock', crash: 1 }, { p: 'b', bass: 'drive', arp: '16', lead: 1, harm: 1, drums: 'drive', fill: 1 }, { p: 'a', bass: 'eighth', arp: '8', lead: 1, drums: 'rock' }, { p: 'b', bass: 'half', pad: 1, lead: 2, drums: 'half', build: 1 }] }
        ],
        boss: [
            { bpm: 160, root: 52, scale: 'minor', swing: 0, lw: 'sawtooth', lv: 0.075, dense: 1, progs: { a: [1, 1, 7, 6, 1, 1, 2, 5], b: [6, 6, 7, 7, 4, 5, 1, 1] },
              form: [{ p: 'a', bass: 'drive', pad: 1, arp: '16', lead: 2, drums: 'epic', crash: 1 }, { p: 'a', bass: 'drive', arp: '16', lead: 1, harm: 1, drums: 'epic', fill: 1 }, { p: 'b', bass: 'drive', arp: '8', lead: 1, harm: 1, drums: 'epic', crash: 1, fill: 1 }, { p: 'a', bass: 'off', pad: 1, lead: 2, drums: 'half', build: 1 }] },
            { bpm: 152, root: 49, scale: 'harm', swing: 0, lw: 'square', lv: 0.09, dense: 1, progs: { a: [1, 7, 6, 5, 1, 4, 5, 1], b: [4, 5, 6, 6, 7, 7, 1, 5] },
              form: [{ p: 'a', bass: 'eighth', pad: 1, arp: '8', lead: 2, drums: 'half', crash: 1 }, { p: 'a', bass: 'drive', arp: '16', lead: 1, drums: 'epic', crash: 1 }, { p: 'b', bass: 'drive', arp: '16', lead: 1, harm: 1, drums: 'epic', fill: 1 }, { p: 'b', bass: 'half', pad: 1, lead: 2, build: 1 }] },
            { bpm: 168, root: 57, scale: 'phrygian', swing: 0, lw: 'sawtooth', lv: 0.075, dense: 1, progs: { a: [1, 2, 1, 2, 7, 6, 2, 1], b: [3, 2, 1, 1, 6, 7, 2, 2] },
              form: [{ p: 'a', bass: 'drive', arp: '16', lead: 1, drums: 'epic', crash: 1 }, { p: 'b', bass: 'drive', arp: '8', lead: 1, harm: 1, drums: 'epic', fill: 1 }, { p: 'a', bass: 'drive', arp: '16', lead: 1, harm: 1, drums: 'epic', crash: 1, fill: 1 }, { p: 'b', bass: 'off', pad: 1, lead: 2, drums: 'half', build: 1 }] }
        ],
        raid: [
            { bpm: 144, root: 50, scale: 'harm', swing: 0, lw: 'sawtooth', lv: 0.08, dense: 1, progs: { a: [1, 6, 4, 5, 1, 6, 7, 5], b: [4, 5, 6, 7, 4, 5, 1, 5] },
              form: [{ p: 'a', bass: 'half', pad: 1, arp: '8', lead: 2, drums: 'epic', crash: 1 }, { p: 'a', bass: 'drive', pad: 1, arp: '16', lead: 1, harm: 1, drums: 'epic', crash: 1 }, { p: 'b', bass: 'drive', pad: 1, arp: '16', lead: 1, harm: 1, drums: 'epic', crash: 1, fill: 1 }, { p: 'b', bass: 'half', pad: 1, lead: 2, drums: 'half', build: 1 }] },
            { bpm: 138, root: 53, scale: 'minor', swing: 0, lw: 'square', lv: 0.095, dense: 1, progs: { a: [1, 3, 7, 6, 1, 3, 4, 5], b: [6, 7, 1, 3, 6, 7, 5, 5] },
              form: [{ p: 'a', bass: 'eighth', pad: 1, lead: 2, drums: 'epic', crash: 1 }, { p: 'a', bass: 'drive', pad: 1, arp: '8', lead: 1, harm: 1, drums: 'epic' }, { p: 'b', bass: 'drive', pad: 1, arp: '16', lead: 1, harm: 1, drums: 'epic', crash: 1, fill: 1 }, { p: 'b', bass: 'off', pad: 1, arp: '8', lead: 2, drums: 'half', build: 1 }] }
        ],
        rush: [
            { bpm: 152, root: 55, scale: 'phrygian', swing: 0, lw: 'sawtooth', lv: 0.075, dense: 1, progs: { a: [1, 1, 2, 1, 7, 7, 6, 2], b: [1, 2, 3, 2, 6, 7, 2, 2] },
              form: [{ p: 'a', bass: 'drive', arp: '16', lead: 1, drums: 'drive', crash: 1 }, { p: 'b', bass: 'drive', arp: '16', lead: 1, harm: 1, drums: 'epic', fill: 1 }, { p: 'a', bass: 'drive', arp: '8', lead: 1, harm: 1, drums: 'drive', crash: 1 }, { p: 'b', bass: 'off', arp: '16', lead: 2, drums: 'half', build: 1 }] }
        ],
        dungeon: [
            { bpm: 98, root: 55, scale: 'phrygian', swing: 0.08, lw: 'triangle', lv: 0.11, dense: 0, progs: { a: [1, 1, 2, 1, 7, 7, 6, 2], b: [1, 3, 2, 1, 6, 7, 2, 1] },
              form: [{ p: 'a', bass: 'half', pad: 1, lead: 2 }, { p: 'a', bass: 'half', pad: 1, arp: '8', lead: 2, drums: 'soft' }, { p: 'b', bass: 'eighth', pad: 1, arp: '8', lead: 1, drums: 'soft' }, { p: 'a', bass: 'half', pad: 1, lead: 2 }] },
            { bpm: 92, root: 52, scale: 'minor', swing: 0.08, lw: 'triangle', lv: 0.11, dense: 0, progs: { a: [1, 6, 7, 1, 4, 3, 7, 1], b: [3, 6, 4, 7, 1, 6, 2, 5] },
              form: [{ p: 'a', bass: 'half', pad: 1, lead: 2 }, { p: 'b', bass: 'half', pad: 1, arp: '8', lead: 2, drums: 'soft' }, { p: 'a', bass: 'eighth', pad: 1, arp: '8', lead: 1, drums: 'soft' }, { p: 'b', bass: 'half', pad: 1, lead: 2 }] }
        ],
        result: [
            { bpm: 100, root: 60, scale: 'major', swing: 0.08, lw: 'triangle', lv: 0.12, dense: 0, progs: { a: [1, 5, 6, 4, 1, 5, 4, 1], b: [4, 1, 5, 6, 4, 2, 5, 1] },
              form: [{ p: 'a', bass: 'half', pad: 1, arp: '8', lead: 1 }, { p: 'b', bass: 'half', pad: 1, arp: '8', lead: 1, harm: 1, drums: 'soft' }, { p: 'a', bass: 'eighth', pad: 1, lead: 2 }, { p: 'b', bass: 'half', pad: 1, lead: 2 }] }
        ],
        victory: [
            { bpm: 120, root: 62, scale: 'major', swing: 0, lw: 'square', lv: 0.1, dense: 1, progs: { a: [1, 5, 6, 3, 4, 1, 4, 5], b: [1, 4, 5, 1, 6, 4, 5, 1] },
              form: [{ p: 'a', bass: 'eighth', pad: 1, arp: '8', lead: 1, harm: 1, drums: 'epic', crash: 1 }, { p: 'b', bass: 'half', pad: 1, arp: '8', lead: 1, drums: 'rock', fill: 1 }] }
        ]
    };
    TRACKS.battle2 = TRACKS.battle; TRACKS.action = TRACKS.battle;

    // 旋律の「リズムの型」（16分音符16個ぶん。1=音が鳴る）
    const RHY_DENSE = [[1,0,0,1,0,0,1,0, 1,0,0,1,0,0,1,0], [1,0,1,0,1,0,0,1, 1,0,1,0,0,1,0,0], [1,0,0,0,1,0,1,0, 0,1,0,0,1,0,1,0], [1,0,1,1,0,0,1,0, 1,0,0,0,1,1,0,0], [1,1,0,1,0,1,0,0, 1,0,1,0,0,1,0,0], [1,0,0,1,0,1,0,0, 1,0,0,1,0,0,1,0]];
    const RHY_CALM  = [[1,0,0,0,0,0,1,0, 0,0,1,0,0,0,0,0], [1,0,0,0,1,0,0,0, 1,0,0,0,0,0,1,0], [0,0,1,0,0,0,1,0, 0,0,0,0,1,0,0,0], [1,0,0,0,0,0,0,0, 1,0,0,0,1,0,1,0]];
    function makeMelody(T, F, d, bi, sec, loop) {      // 1小節ぶんの旋律（16マス。音階の度数。0=休み）と、鳴らす長さ
        const ph = bi >> 1, pp = bi & 1, base = T.seed + sec * 7919 + ph * 104729;
        const mutated = loop > 0 && rng(T.seed + sec * 31 + ph * 17 + loop * 977)() < 0.35;      // 同じ段落は基本同じ旋律（覚えやすい）で、周回するたびに一部だけ変わる
        const pseed = mutated ? base + loop * 4099 : base;
        const set = (T.dense && F.lead !== 2) ? RHY_DENSE : RHY_CALM, rhy = set[Math.floor(rng(pseed)() * set.length)];
        const R = rng(pseed + pp * 7 + 1), mel = new Array(16).fill(0), idx = [];
        let cur = d + [0, 2, 4][Math.floor(R() * 3)] + 7;      // 主音の1オクターブ上あたりから始める
        for (let s = 0; s < 16; s++) {
            if (!rhy[s]) continue;
            if (R() < (F.lead === 2 ? 0.25 : 0.1)) continue;      // ときどき休む
            const r = R();
            if (s % 4 === 0) { const ct = [d, d + 2, d + 4, d + 7, d + 9, d + 11]; let best = ct[0] + 7; ct.forEach(c => { const cc = c + 7; if (Math.abs(cc - cur) < Math.abs(best - cur)) best = cc; }); cur = best; }      // 強拍は和音の音に落ち着く
            else cur += r < 0.38 ? 1 : r < 0.76 ? -1 : r < 0.88 ? 2 : r < 0.96 ? -2 : (R() < 0.5 ? 4 : -4);
            cur = Math.max(d + 3, Math.min(d + 13, cur));
            mel[s] = cur; idx.push(s);
        }
        const len = new Array(16).fill(0);
        idx.forEach((s, k) => { len[s] = ((idx[k + 1] != null ? idx[k + 1] : 16) - s); });
        return { mel: mel, len: len };
    }

    // ドラム
    const DRUM = {
        kick:  (at, v) => at({ f: 150, f2: 42, dur: 0.14, vol: 0.5 * v, type: 'sine' }),
        snare: (at, v) => { at({ noise: 1, dur: 0.13, vol: 0.17 * v, f: 1900, q: 1 }); at({ f: 200, f2: 130, dur: 0.07, vol: 0.1 * v, type: 'triangle' }); },
        hat:   (at, v) => at({ noise: 1, dur: 0.035, vol: 0.05 * v, f: 7000, filter: 'highpass' }),
        ohat:  (at, v) => at({ noise: 1, dur: 0.12, vol: 0.07 * v, f: 6500, filter: 'highpass' }),
        tom:   (at, v) => at({ f: 190, f2: 90, dur: 0.16, vol: 0.28 * v, type: 'sine' }),
        crash: (at, v) => at({ noise: 1, dur: 0.8, vol: 0.13 * v, f: 5000, filter: 'highpass' })
    };
    function drums(T, F, bi, sp, last, at) {
        const st = F.drums; if (!st) return;
        const k = (v) => DRUM.kick(at, v), s = (v) => DRUM.snare(at, v), h = (v) => DRUM.hat(at, v);
        if (st === 'soft') { if (sp === 0 || sp === 8) k(0.5); if (sp === 4 || sp === 12) h(0.9); }
        else if (st === 'rock') { if (sp === 0 || sp === 8 || (sp === 10 && bi % 2 === 1)) k(1); if (sp === 4 || sp === 12) s(1); if (sp % 2 === 0) h(sp % 4 === 0 ? 1 : 0.7); }
        else if (st === 'drive') { if (sp % 4 === 0) k(1); if (sp === 4 || sp === 12) s(1); if (sp % 4 === 2) DRUM.ohat(at, 0.8); else if (sp % 2 === 1 && T.bpm < 150) h(0.4); }
        else if (st === 'epic') { if (sp === 0 || sp === 3 || sp === 8 || sp === 11) k(1); if (sp === 4 || sp === 12) s(1.2); if (sp % 2 === 0) h(0.8); if (sp === 14 && bi % 2 === 1) DRUM.tom(at, 1); }
        else if (st === 'half') { if (sp === 0 || (sp === 10 && bi % 2 === 0)) k(1); if (sp === 8) s(1.2); if (sp % 4 === 0) h(0.7); }
        if (F.crash && bi === 0 && sp === 0) DRUM.crash(at, 1);
        if (last && sp >= 12 && (F.fill || F.build)) { if (sp === 12 || sp === 13) DRUM.tom(at, 1.1); else s(0.9 + (sp - 12) * 0.12); }      // 段落の最後：フィル
        if (F.build && bi === 6 && sp % 2 === 0) s(0.5 + sp / 20);      // 最後の2小節：スネアのロールで盛り上げる
    }

    function scheduleStep(T, step, t) {
        const sd = 60 / T.bpm / 4, delay = Math.max(0, t - ctx.currentTime), nF = T.form.length;
        const bar = Math.floor(step / 16), sp = step % 16, sec = Math.floor(bar / 8) % nF, bi = bar % 8, loop = Math.floor(bar / (8 * nF));
        const F = T.form[sec], d = T.progs[F.p][bi], last = bi === 7;
        const at = o => { o.bus = musicBus; o.delay = delay; if (o.noise) noise(o); else tone(o); };
        if (sp === 0) T._m = makeMelody(T, F, d, bi, sec, loop);
        // ベース
        const bo = T.root >= 55 ? -2 : -1, rt = degNote(T, d, bo), fifth = degNote(T, d + 4, bo), oct = rt + 12, bt = 'triangle';
        const bs = F.bass;
        if (bs === 'half') { if (sp === 0) at({ f: N2F(rt), dur: sd * 7.5, vol: 0.32, type: bt }); if (sp === 8) at({ f: N2F(bi % 2 ? fifth : rt), dur: sd * 7.5, vol: 0.3, type: bt }); }
        else if (bs === 'eighth') { if (sp % 2 === 0) at({ f: N2F(sp === 6 || sp === 14 ? fifth : rt), dur: sd * 1.8, vol: sp % 8 === 0 ? 0.32 : 0.24, type: bt }); }
        else if (bs === 'drive') { if (sp % 2 === 0 || sp % 4 === 3) at({ f: N2F(sp === 14 ? oct : rt), dur: sd * 1.6, vol: sp % 4 === 0 ? 0.32 : 0.2, type: 'sawtooth' }); }
        else if (bs === 'walk') { const w = { 0: rt, 4: fifth, 8: oct, 12: fifth }[sp]; if (w) at({ f: N2F(w), dur: sd * 3.6, vol: 0.3, type: bt }); }
        else if (bs === 'off') { if (sp === 0) at({ f: N2F(rt), dur: sd * 2, vol: 0.32, type: bt }); if (sp === 2 || sp === 6 || sp === 10 || sp === 14) at({ f: N2F(rt), dur: sd * 1.6, vol: 0.24, type: bt }); }
        // 持続する和音（パッド）
        if (F.pad && sp === 0) [0, 2, 4].forEach(o => at({ f: N2F(degNote(T, d + o, 0)), dur: sd * 15.5, vol: 0.035, type: 'triangle', att: sd * 3 }));
        // アルペジオ
        if (F.arp) {
            const every = F.arp === '16' ? 1 : 2;
            if (sp % every === 0) { const k = (sp / every) | 0, seq = [0, 2, 4, 7, 4, 2, 4, 2], n = seq[k % seq.length]; at({ f: N2F(degNote(T, d + n, 1)), dur: sd * every * 0.9, vol: 0.05, type: 'square' }); }
        }
        // 旋律
        if (F.lead && T._m && T._m.mel[sp]) {
            const dg = T._m.mel[sp], ln = T._m.len[sp] || 2;
            at({ f: N2F(degNote(T, dg, 0)), dur: sd * Math.min(6, Math.max(1.6, ln * 0.95)), vol: T.lv || 0.1, type: T.lw || 'square', att: 0.012 });
            if (F.harm) at({ f: N2F(degNote(T, dg - 2, 0)), dur: sd * Math.min(6, Math.max(1.6, ln * 0.9)), vol: (T.lv || 0.1) * 0.55, type: 'sawtooth', att: 0.015 });
        }
        drums(T, F, bi, sp, last, at);
    }
    let cur = null, lastVar = {};
    function bgmTick() {
        const c = ac(); if (!c) return;
        const tr = bgmName && cur;
        if (!tr) { bgmNextTime = 0; return; }
        const stepDur = 60 / tr.bpm / 4;
        if (!bgmNextTime || bgmNextTime < c.currentTime) bgmNextTime = c.currentTime + 0.05;
        while (bgmNextTime < c.currentTime + 0.18) {
            scheduleStep(tr, bgmStep, bgmNextTime + ((bgmStep & 1) ? (tr.swing || 0) * stepDur : 0));      // 裏拍を少し遅らせる（ノリ）
            bgmNextTime += stepDur;
            bgmStep++;
        }
    }

    // 画面ごとのBGM（URLのファイル名で自動判定）
    const PAGE_BGM = {
        'index.html': 'town', 'online.html': 'town', 'action-skills.html': 'town', 'help.html': 'town',
        'lesson.html': 'stage', 'stage-loader.html': 'stage', 'stage-backup.html': 'stage',
        'battle.html': 'battle', 'action-battle.html': 'battle',
        'dungeon-ui.html': 'dungeon', 'survival.html': 'dungeon',
        'result.html': 'result'
    };
    function defaultBgm() {
        const f = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        return PAGE_BGM[f] || null;
    }

    // bgm(曲の種類, 種)：種（ステージidなど）が同じなら、同じ曲（同じ旋律）になる。種を渡さないときは、毎回ちがう曲
    function bgm(name, seedStr) {
        const d = name && TRACKS[name];
        if (!d) { bgmName = null; cur = null; return; }
        const h = seedStr != null ? hashStr(String(seedStr)) : ((Math.random() * 4294967296) >>> 0);
        let def = d;
        if (Array.isArray(d)) { let i = h % d.length; if (seedStr == null && d.length > 1 && i === lastVar[name]) i = (i + 1) % d.length; lastVar[name] = i; def = d[i]; }
        cur = Object.assign({}, def, { seed: ((h ^ 0x9e3779b9) >>> 0) || 1 });
        bgmName = name; bgmStep = 0; bgmNextTime = 0;
    }

    // ---------- ミュート ----------
    function setMuted(v) {
        muted = !!v;
        try { localStorage.setItem(STORE_KEY, muted ? '0' : '1'); } catch (e) { /* noop */ }
        if (master) master.gain.value = muted ? 0 : 0.55;
    }
    function isMuted() { return muted; }
    function toggleMute() {
        setMuted(!muted);
        if (window.SBSoundToast) SBSoundToast(muted ? '🔇 サウンドOFF（Mキーで戻す）' : '🔊 サウンドON');
    }
    // ミュート切替の小さな通知（画面になければ何もしない）
    function SBSoundToast(text) {
        try {
            let t = document.getElementById('sbSoundToast');
            if (!t) { t = document.createElement('div'); t.id = 'sbSoundToast'; t.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;z-index:99999;pointer-events:none;transition:opacity .3s'; document.body.appendChild(t); }
            t.textContent = text; t.style.opacity = '1';
            clearTimeout(t._tm); t._tm = setTimeout(() => { t.style.opacity = '0'; }, 1400);
        } catch (e) { /* noop */ }
    }

    // ---------- 起動 ----------
    let started = false;
    function boot() {
        if (started) return; started = true;
        ac();
        if (!bgmName) bgm(defaultBgm());
        if (!bgmTimer) bgmTimer = setInterval(bgmTick, 40);
        sfx('click');   // 起動の合図（音が出るかの確認も兼ねる）
    }
    const kick = () => { boot(); };
    window.addEventListener('pointerdown', kick, { capture: true, passive: true });
    window.addEventListener('keydown', kick, { capture: true });
    window.addEventListener('touchstart', kick, { capture: true, passive: true });

    // Mキーでミュート（入力中は無効）
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'm' && e.key !== 'M') return;
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        toggleMute();
    });

    // UI設定パネルに「サウンド」項目を足す（ui-settings.js がある画面だけ）
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!window.UISettings) return;
            UISettings.registerGlobal({ key: 'sound', label: 'サウンド（BGM・効果音）', type: 'select', def: muted ? 'off' : 'on',
                options: [['on', 'オン'], ['off', 'オフ']], note: 'Mキーでも切り替えられます' });
            UISettings.onChange(id => { if (id === '_g:sound') setMuted(UISettings.getGlobal('sound') === 'off'); });
        }, 0);
    });

    window.SBSound = { sfx, bgm, setMuted, isMuted, toggleMute, ac };
})();
