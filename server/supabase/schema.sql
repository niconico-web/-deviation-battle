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
