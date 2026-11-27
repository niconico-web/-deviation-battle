# SchoolBattle × Supabase (Render)

This integration keeps the existing synchronous file-based managers intact and mirrors mutable runtime JSON stores to the `kv_store` Supabase table. On startup, the server restores data before loading game managers; file updates are debounced and written back to Supabase. Static question and boss data remain in the repository.

## 1. Create the table

1. Create/open the Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Open **Project Settings → API Keys** (or the project's API settings) and copy the `service_role` secret. Treat it as a password.
4. Copy the project's URL.

## 2. Set Render environment variables

In Render Dashboard → the SchoolBattle Web Service → **Environment**, add:

- `SUPABASE_URL` = your Supabase project URL, e.g. `https://YOUR_PROJECT_REF.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = the server-only `service_role` secret

Do not put the service-role key in any client HTML/JS, commit it to Git, or share it publicly. Save changes and redeploy.

## 3. How first boot behaves

- If `kv_store` is empty, current local runtime JSON data files are seeded into Supabase.
- If a key already exists in Supabase, its value is restored to the local JSON file before the managers load.
- Newly introduced local stores are seeded when their key is not yet present.
- If restore fails, uploads are disabled for that process. This prevents an empty Render filesystem from overwriting cloud data.
- The schema safely imports the obsolete `schoolbattle_storage` table only for keys missing from `kv_store`.
- Without both environment variables, Supabase syncing is disabled and the app runs in local-file mode.

## 4. Current scope and limitations

Synced files: every mutable JSON store in `server/data`, including `players.json`, `market.json`, `guilds.json`, and `quests.json`. `quests.json` contains live guild-quest state and is deliberately synced. Static question/boss source JSON is excluded. Rankings are calculated from the persisted `players.json` data.

This is a compatibility bridge, not a full relational redesign. It is intended for a single Render web-service instance: multiple instances writing the same whole-file JSON stores can overwrite one another. File changes are mirrored with a short debounce, so this is not a transactional per-action database write. Before scaling to multiple instances or high concurrent traffic, migrate managers to direct row-level PostgreSQL operations and add conflict/transaction handling. Existing JSON files are not automatically merged with existing Supabase values; Supabase values take precedence for keys already present.

## 5. Verify

After redeploying, check Render logs for `[Supabase] restored`. Play the game, then inspect `public.kv_store` in Supabase Table Editor and confirm the `players.json`, `market.json`, or `quests.json` row's `updated_at` changes. Restart/redeploy and verify the saved player state is restored.
