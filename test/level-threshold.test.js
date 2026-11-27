const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadLevelFunctions() {
    const source = fs.readFileSync(path.join(root, 'client/js/stats.js'), 'utf8');
    const context = vm.createContext({
        I18N: { atk: '攻撃', def: '防御', speed: '速さ', statMinError: '', statTotalError: '' },
        window: {},
        console,
        Math
    });
    vm.runInContext(`${source}\nglobalThis.levelFunctions = { getLevelXpBoost, calcStatGain };`, context);
    return context.levelFunctions;
}

test('経験値・ステータスの3倍ボーナスはLv50未満でのみ適用される', () => {
    const { getLevelXpBoost, calcStatGain } = loadLevelFunctions();

    assert.equal(getLevelXpBoost({ level: 49 }), 3);
    assert.equal(getLevelXpBoost({ level: 50 }), 1);
    assert.equal(calcStatGain(60, { level: 49, prestigeCount: 0 }), 3);
    assert.equal(calcStatGain(60, { level: 50, prestigeCount: 0 }), 1);
});

function connectStageSocket(socketId = 'test-socket') {
    const handlers = new Map();
    const emitted = [];
    const socket = {
        id: socketId,
        on(event, handler) { handlers.set(event, handler); },
        emit(event, payload) { emitted.push({ event, payload }); },
        join() {},
        leave() {},
        to() { return { volatile: { emit() {} }, emit() {} }; }
    };
    let onConnection;
    const io = {
        on(event, handler) { if (event === 'connection') onConnection = handler; },
        to() { return { emit(event, payload) { emitted.push({ event, payload }); } }; }
    };
    require(path.join(root, 'server/socket/stage.js'))(io);
    onConnection(socket);
    return { handlers, emitted };
}

test('Lv50で解放され、Lv49では大討伐戦を作成できない', () => {
    const { handlers, emitted } = connectStageSocket();

    handlers.get('stage:create')({ stageId: 'raid_increase', player: { id: 'lv49', lv: 49 } });
    assert.match(emitted.at(-1).payload.message, /Lv50/);

    handlers.get('stage:create')({ stageId: 'raid_increase', player: { id: 'lv50', lv: 50 } });
    assert.equal(emitted.at(-1).event, 'stage:room');
});

test('クライアント側の解放レベルもLv50である', () => {
    const progression = fs.readFileSync(path.join(root, 'client/js/progression.js'), 'utf8');

    assert.match(progression, /const UNLOCK_LV = 50;/);
});

test('レベル差20まではマルチバトルに参加でき、21では参加できない', () => {
    const host = connectStageSocket('gap-host');
    host.handlers.get('stage:create')({ stageId: 'gap-test', player: { id: 'host', lv: 10 } });
    const roomId = host.emitted.find(({ event }) => event === 'stage:room').payload.id;

    const withinGap = connectStageSocket('gap-30');
    withinGap.handlers.get('stage:join')({ roomId, player: { id: 'lv30', lv: 30 } });
    assert.equal(withinGap.emitted.some(({ event }) => event === 'stage:error'), false);

    const overGap = connectStageSocket('gap-31');
    overGap.handlers.get('stage:join')({ roomId, player: { id: 'lv31', lv: 31 } });
    assert.match(overGap.emitted.at(-1).payload.message, /20を超える/);
});

test('高頻度の状態同期は古いパケットを待ち行列にためない送信方式を使う', () => {
    const practice = fs.readFileSync(path.join(root, 'client/js/practice.js'), 'utf8');

    assert.match(practice, /const SNAP_HZ = 12;/);
    assert.match(practice, /const hot = t === 'pos' \|\| t === 'snap' \|\| t === 'mn';/);
    assert.match(practice, /sender\.emit\('stage:relay', packet\);/);
});
