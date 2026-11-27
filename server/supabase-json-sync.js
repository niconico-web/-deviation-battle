'use strict';

// Compatibility entry point for older imports. Persistence has one
// implementation and one Supabase table: managers/SupabaseSync -> kv_store.
module.exports = require('./managers/SupabaseSync');
