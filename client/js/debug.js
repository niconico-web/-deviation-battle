// ============================================================
// デバッグ用コマンド (debug.js)
//  ブラウザのコンソール（F12）、またはURLの ?debug=… から、好きなボスにすぐ挑戦できる。
//  デバッグ戦闘では、報酬（コイン・ドロップ）もクリア記録も一切もらえない（進行データは変わらない）。
//
//  ［コンソール］
//    SBDebug.keeper()                  ディメンション・キーパーに挑む（エネルギー無限）
//    SBDebug.keeper2()                 核を全部壊した状態＝第二形態（歴代ラスボス召喚）から始める
//    SBDebug.keeper({ god: true })     無敵で挑む（ギミックの確認用）
//    SBDebug.keeper({ hp: 0.05 })      ボスのHPを5%にする（短時間で最後まで見る）
//    SBDebug.keeper({ cores: 2 })      核が2つ残った状態から始める
//    SBDebug.fight('olympus', { god: true })   好きなステージで（IDは SBDebug.list() で確認）
//  ［URL］  index.html?debug=keeper   index.html?debug=keeper2&god=1&hp=0.1   stage.html?debug=olympus
//  オプション：god(無敵) / energy(エネルギー無限。既定はON) / hp(ボスHPの倍率) / cores(核の数 0〜6) / diff(難易度 0〜2)
// ============================================================
(function () {
    'use strict';
    const ALIAS = { keeper: 'dimension_end', keeper2: 'dimension_end', reaper: 'grave_of_gears', boiler: 'boiler_heart', gravity: 'gravity_well', zeus: 'olympus', olympus: 'olympus', abyss: 'void_throne' };

    function launch(stageId, opts) {
        opts = Object.assign({ god: false, energy: true, hp: 1, cores: 6, diff: 0 }, opts || {});
        const st = typeof window.getStageById === 'function' ? window.getStageById(stageId) : null;
        if (typeof window.getStageById === 'function' && !st) { console.warn('[SBDebug] ステージが見つかりません:', stageId, '→ SBDebug.list() でIDを確認してください'); return false; }
        try { localStorage.setItem('sbStageLaunch', JSON.stringify({ stageId: stageId, mode: 'solo', roomId: null, diff: opts.diff | 0, debug: opts, at: Date.now() })); } catch (e) { return false; }
        if (!/stage\.html$/.test(location.pathname)) location.href = 'stage.html'; else location.reload();
        return true;
    }
    const api = {
        fight: launch,
        keeper: (o) => launch('dimension_end', o),
        keeper2: (o) => launch('dimension_end', Object.assign({ cores: 0 }, o || {})),
        list: () => { const l = (window.STAGE_DATA && STAGE_DATA.STAGES || []).map(s => s.id + '　' + s.name + (s.boss ? '（' + s.boss.name + '）' : '')); console.log(l.join('\n')); return l; },
        help: () => console.log('SBDebug.keeper() / keeper2() / fight(ステージID, {god, energy, hp, cores, diff}) / list()')
    };
    window.SBDebug = api;

    // URL から： ?debug=keeper&god=1&hp=0.1&cores=2
    try {
        const q = new URLSearchParams(location.search), t = q.get('debug');
        if (t) {
            const id = ALIAS[t] || t, o = {};
            if (q.get('god') != null) o.god = q.get('god') !== '0';
            if (q.get('energy') != null) o.energy = q.get('energy') !== '0';
            if (q.get('hp') != null) o.hp = Math.max(0.001, Math.min(10, parseFloat(q.get('hp')) || 1));
            if (q.get('cores') != null) o.cores = Math.max(0, Math.min(6, parseInt(q.get('cores'), 10) || 0));
            else if (t === 'keeper2') o.cores = 0;
            if (q.get('diff') != null) o.diff = Math.max(0, Math.min(2, parseInt(q.get('diff'), 10) || 0));
            const opts = Object.assign({ god: false, energy: true, hp: 1, cores: 6, diff: 0 }, o);
            localStorage.setItem('sbStageLaunch', JSON.stringify({ stageId: id, mode: 'solo', roomId: null, diff: opts.diff, debug: opts, at: Date.now() }));
            if (!/stage\.html$/.test(location.pathname)) location.replace('stage.html');   // stage.html の場合は、そのまま続けて起動する
        }
    } catch (e) { /* URL が読めなければ何もしない */ }
})();
