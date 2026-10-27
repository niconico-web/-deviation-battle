// Render entry point. Restore persistent JSON stores before managers load them.
const supabaseSync = require('./server/supabase-json-sync');

supabaseSync.initialize()
  .then(() => {
    require('./server/server.js');
  })
  .catch(error => {
    console.error('[SupabaseSync] Startup failed; server was not started to avoid loading stale data:', error.message);
    process.exit(1);
  });

