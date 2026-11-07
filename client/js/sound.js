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
        g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
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

    // ---------- BGM（16分音符ステップのシーケンサ） ----------
    // 各トラック: 32ステップ(2小節)の bass / lead / lead2 / hat パターン。0=休符
    const TRACKS = {
        town: {
            bpm: 92,
            bass: [48,0,0,0,0,0,0,0,55,0,0,0,0,0,0,0, 50,0,0,0,0,0,0,0,55,0,0,0,0,0,0,0],
            lead: [76,0,79,0,81,0,79,0,77,0,81,0,79,0,76,0, 74,0,77,0,79,0,77,0,76,0,74,0,71,0,0,0],
            lead2: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            hat:  [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,1, 0,0,1,0,0,0,1,0,0,0,1,0,0,1,0,0]
        },
        stage: {
            bpm: 126,
            bass: [45,0,45,0,48,0,45,0,43,0,43,0,48,0,50,0, 45,0,45,0,48,0,45,0,43,0,45,0,50,0,52,0],
            lead: [69,0,0,72,0,0,69,0,0,67,0,0,69,0,0,0, 71,0,0,72,0,0,76,0,0,74,0,0,72,0,0,0],
            lead2: [0,0,57,0,0,57,0,0,0,55,0,0,57,0,0,0, 0,0,59,0,0,59,0,0,0,57,0,0,59,0,0,0],
            hat:  [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1, 1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,1]
        },
        battle: {
            bpm: 148,
            bass: [45,45,0,45,48,0,45,0,43,43,0,43,50,0,48,0, 45,45,0,45,48,0,45,0,43,43,0,45,50,52,50,0],
            lead: [69,0,72,0,76,0,72,0,74,0,77,0,76,0,72,0, 69,0,72,0,76,0,79,0,77,0,76,0,74,0,0,0],
            lead2: [0,0,57,0,0,57,0,62,0,0,55,0,0,57,0,0, 0,0,59,0,0,59,0,64,0,0,62,0,0,60,0,0],
            hat:  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2, 1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2]
        },
        boss: {
            bpm: 160,
            bass: [40,0,40,40,0,40,0,43,40,0,40,40,0,45,0,43, 40,0,40,40,0,40,0,43,40,0,40,40,0,47,45,43],
            lead: [64,0,0,64,0,0,67,0,0,64,0,0,62,0,64,0, 66,0,0,66,0,0,69,0,0,67,0,64,0,0,0,0],
            lead2: [0,0,52,0,0,52,0,55,0,0,52,0,0,50,0,52, 0,0,54,0,0,54,0,57,0,0,55,0,52,0,0,0],
            hat:  [2,0,1,0,2,0,1,0,2,0,1,0,2,0,1,1, 2,0,1,0,2,0,1,0,2,0,1,0,2,1,1,1]
        },
        dungeon: {
            bpm: 104,
            bass: [43,0,0,0,43,0,0,0,46,0,0,0,43,0,41,0, 43,0,0,0,43,0,0,0,45,0,0,0,41,0,43,0],
            lead: [67,0,0,70,0,0,67,0,0,65,0,0,64,0,0,0, 67,0,0,70,0,0,72,0,0,70,0,67,0,0,0,0],
            lead2: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            hat:  [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0, 0,0,1,0,0,0,1,0,0,0,1,0,0,1,0,0]
        },
        result: {
            bpm: 100,
            bass: [48,0,0,0,0,0,0,0,53,0,0,0,0,0,0,0, 55,0,0,0,0,0,0,0,48,0,0,0,0,0,0,0],
            lead: [72,0,76,0,79,0,0,76,0,74,0,77,0,76,0,72, 74,0,77,0,81,0,0,77,0,76,0,72,0,0,0,0],
            lead2: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            hat:  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0, 0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]
        }
    };

    function scheduleStep(tr, stepIdx, t) {
        const stepDur = 60 / tr.bpm / 4;
        const i = stepIdx % tr.bass.length;
        const N = m => m ? N2F(m) : 0;
        if (tr.bass[i]) tone({ f: N(tr.bass[i]), dur: stepDur * 3.5, vol: 0.34, type: 'triangle', bus: musicBus, delay: Math.max(0, t - ctx.currentTime) });
        if (tr.lead[i]) tone({ f: N(tr.lead[i]), dur: stepDur * 1.6, vol: 0.11, type: 'square', bus: musicBus, delay: Math.max(0, t - ctx.currentTime) });
        if (tr.lead2 && tr.lead2[i]) tone({ f: N(tr.lead2[i]), dur: stepDur * 1.4, vol: 0.07, type: 'sawtooth', bus: musicBus, delay: Math.max(0, t - ctx.currentTime) });
        const h = tr.hat[i];
        if (h) noise({ dur: h === 2 ? 0.12 : 0.04, vol: h === 2 ? 0.1 : 0.05, f: 7000, filter: 'highpass', bus: musicBus, delay: Math.max(0, t - ctx.currentTime) });
    }
    function bgmTick() {
        const c = ac(); if (!c) return;
        const tr = bgmName && TRACKS[bgmName];
        if (!tr) { bgmNextTime = 0; return; }
        const stepDur = 60 / tr.bpm / 4;
        if (!bgmNextTime || bgmNextTime < c.currentTime) bgmNextTime = c.currentTime + 0.05;
        while (bgmNextTime < c.currentTime + 0.18) {
            scheduleStep(tr, bgmStep, bgmNextTime);
            bgmNextTime += stepDur;
            bgmStep = (bgmStep + 1) % 32;
        }
    }

    // 画面ごとのBGM（URLのファイル名で自動判定）
    const PAGE_BGM = {
        'index.html': 'town', 'online.html': 'town', 'action-skills.html': 'town', 'help.html': 'town',
        'lesson.html': 'stage', 'stage-loader.html': 'stage', 'stage-backup.html': 'stage',
        'battle.html': 'battle', 'action-battle.html': 'battle',
        'survival.html': 'dungeon', 'dungeon-ui.html': 'dungeon',
        'result.html': 'result'
    };
    function defaultBgm() {
        const f = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        return PAGE_BGM[f] || null;
    }

    function bgm(name) {
        bgmName = (name && TRACKS[name]) ? name : null;
        bgmStep = 0; bgmNextTime = 0;
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
