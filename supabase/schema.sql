-- Run this once in Supabase Dashboard > SQL Editor.
-- One row per mutable server/data JSON file. Content stays text so the server
-- can validate it before replacing a local save file.
create table if not exists public.kv_store (
    key        text primary key,
    content    text not null,
    updated_at timestamptz not null default now()
);

-- Only the Render server uses a service-role key. No browser policy is added.
alter table public.kv_store enable row level security;

create or replace function public.kv_touch() returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end $$;

drop trigger if exists kv_touch on public.kv_store;
create trigger kv_touch before update on public.kv_store
for each row execute function public.kv_touch();

-- Safe migration from the obsolete schoolbattle_storage prototype. A value
-- already present in kv_store always wins, so this cannot overwrite live data.
do $$
begin
    if to_regclass('public.schoolbattle_storage') is not null then
        insert into public.kv_store (key, content)
        select key, value::text
        from public.schoolbattle_storage
        on conflict (key) do nothing;
    end if;
end $$;
