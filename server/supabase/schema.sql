-- ============================================================
-- SchoolBattle 用の Supabase テーブル（SQL Editor に貼って Run するだけ）
--  サーバーが使うJSONファイル（players.json / market.json / survival.json など）を、
--  ファイル名をキーにして丸ごと保存する「入れ物」。Renderの無料プランでサーバーが再起動しても、
--  起動時にここから復元される。
-- ============================================================
create table if not exists public.kv_store (
    key        text primary key,                 -- 例: players.json
    content    text not null,                    -- JSONの中身（文字列のまま保存）
    updated_at timestamptz not null default now()
);

-- 【重要】ブラウザ（anonキー）からは誰も読み書きできないようにする。
--  サーバーは service_role キーで接続するので、RLSを無視してアクセスできる。
alter table public.kv_store enable row level security;
-- ポリシーは意図的に作らない（＝anon/authenticated は全拒否）。

create or replace function public.kv_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists kv_touch on public.kv_store;
create trigger kv_touch before update on public.kv_store for each row execute function public.kv_touch();

-- Safe one-time import from the obsolete schoolbattle_storage prototype.
-- Existing kv_store rows always win, so live data cannot be overwritten.
do $$
begin
    if to_regclass('public.schoolbattle_storage') is not null then
        insert into public.kv_store (key, content)
        select key, value::text
        from public.schoolbattle_storage
        on conflict (key) do nothing;
    end if;
end $$;
