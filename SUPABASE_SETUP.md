# SchoolBattle × Supabase (Render)

This integration keeps the existing synchronous file-based managers intact and mirrors the mutable runtime JSON stores to a Supabase table. On startup, the server restores known stores from Supabase before loading game managers; file updates are debounced and written back to Supabase. Static question and boss data remain in the repository.

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

- If `schoolbattle_storage` is empty, current local JSON data files are seeded into Supabase.
- If a key already exists in Supabase, its value is restored to the local JSON file before the managers load.
- New known mutable stores are seeded from local files when their key is not yet present.
- If Supabase is configured but unreachable or the table is missing, startup fails instead of silently running on stale local data.
- Without both environment variables, Supabase syncing is disabled and the app runs in local-file mode.

## 4. Current scope and limitations

Synced files: `players.json`, `unique_claims.json`, `social.json`, `market.json`, `guilds.json`, `quests.json`, `survival.json`, `bundles.json`, `pvp_event.json`.

This is a compatibility bridge, not a full relational redesign. It is intended for a single Render web-service instance: multiple instances writing the same whole-file JSON stores can overwrite one another. File changes are mirrored with a short debounce, so this is not a transactional per-action database write. Before scaling to multiple instances or high concurrent traffic, migrate managers to direct row-level PostgreSQL operations and add conflict/transaction handling. Existing JSON files are not automatically merged with existing Supabase values; Supabase values take precedence for keys already present.

## 5. Verify

After redeploying, check Render logs for `[SupabaseSync] Connected`. Play the game, then inspect `public.schoolbattle_storage` in Supabase Table Editor and confirm the `players.json` row's `updated_at` changes. Restart/redeploy and verify the saved player state is restored.
