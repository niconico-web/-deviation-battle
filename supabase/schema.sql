-- Run this once in Supabase Dashboard > SQL Editor.
-- This table stores existing mutable SchoolBattle JSON stores as JSONB values.
create table if not exists public.schoolbattle_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- The service-role key is only used by the trusted Render server.
-- Do not expose it in client-side JavaScript or enable public table access.
alter table public.schoolbattle_storage enable row level security;
