const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const syncPath = path.resolve(__dirname, '../server/managers/SupabaseSync.js');

test('kv_store sync restores live guild quests and protects static source files', async (t) => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schoolbattle-sync-'));
    const oldEnv = {
        SB_DATA_DIR: process.env.SB_DATA_DIR,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY
    };
    const oldFetch = global.fetch;
    t.after(() => {
        fs.rmSync(dataDir, { recursive: true, force: true });
        Object.assign(process.env, oldEnv);
        for (const [key, value] of Object.entries(oldEnv)) if (value === undefined) delete process.env[key];
        global.fetch = oldFetch;
        delete require.cache[syncPath];
    });

    fs.writeFileSync(path.join(dataDir, 'questions.json'), '{"local":true}');
    process.env.SB_DATA_DIR = dataDir;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    global.fetch = async () => new Response(JSON.stringify([
        { key: 'players.json', content: '{"P1":{"name":"Player"}}' },
        { key: 'market.json', content: '{"listings":{"L1":{}}}' },
        { key: 'quests.json', content: '{"QUEST_1":{"status":"accepted"}}' },
        { key: 'questions.json', content: '{"remote":"must-not-replace-static"}' }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    delete require.cache[syncPath];
    const sync = require(syncPath);

    assert.equal(sync._test.table, 'kv_store');
    assert.equal(sync._test.isMirrored('players.json'), true);
    assert.equal(sync._test.isMirrored('market.json'), true);
    assert.equal(sync._test.isMirrored('quests.json'), true);
    assert.equal(sync._test.isMirrored('questions.json'), false);
    assert.equal(sync._test.isFast('players.json'), true);
    assert.equal(sync._test.isFast('market.json'), true);
    assert.equal(sync._test.isFast('quests.json'), true);

    await sync.restore();
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'players.json'), 'utf8')), { P1: { name: 'Player' } });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'market.json'), 'utf8')), { listings: { L1: {} } });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'quests.json'), 'utf8')), { QUEST_1: { status: 'accepted' } });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'questions.json'), 'utf8')), { local: true });
});
