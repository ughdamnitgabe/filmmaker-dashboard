-- Filmmaker Dashboard — shared library (Gabe + Amelia, same projects)
-- Run this in the Supabase Dashboard -> SQL Editor, on the SAME project
-- Script Builder uses: https://elnbqrnljdqvjcbpyxne.supabase.co
-- (project "script-builder", anon key sb_publishable_3rtVB9nuc61cLb5I7nhYZg_WFlxlk79)
--
-- IMPORTANT: replace 'AMELIA_EMAIL_HERE' with Amelia's real email address
-- BEFORE she signs in, or she will be locked out of the shared library.
-- Gabe's email is already in the list.
--
-- One row, id = 'shared', holds the whole library (all projects) as JSON.
-- Row-level security: ONLY Gabe's and Amelia's accounts may read or write it.
-- No other user, and no anonymous visitor, can see it.

create table if not exists public.filmmaker_libraries (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.filmmaker_libraries enable row level security;

-- Drop old policies if re-running.
drop policy if exists "filmmaker_libraries_select" on public.filmmaker_libraries;
drop policy if exists "filmmaker_libraries_insert" on public.filmmaker_libraries;
drop policy if exists "filmmaker_libraries_update" on public.filmmaker_libraries;
drop policy if exists "filmmaker_libraries_delete" on public.filmmaker_libraries;

create policy "filmmaker_libraries_select" on public.filmmaker_libraries
  for select using (
    lower(auth.jwt() ->> 'email') in ('ga@gabearredondo.com', 'AMELIA_EMAIL_HERE')
  );

create policy "filmmaker_libraries_insert" on public.filmmaker_libraries
  for insert with check (
    lower(auth.jwt() ->> 'email') in ('ga@gabearredondo.com', 'AMELIA_EMAIL_HERE')
  );

create policy "filmmaker_libraries_update" on public.filmmaker_libraries
  for update using (
    lower(auth.jwt() ->> 'email') in ('ga@gabearredondo.com', 'AMELIA_EMAIL_HERE')
  ) with check (
    lower(auth.jwt() ->> 'email') in ('ga@gabearredondo.com', 'AMELIA_EMAIL_HERE')
  );

create policy "filmmaker_libraries_delete" on public.filmmaker_libraries
  for delete using (
    lower(auth.jwt() ->> 'email') in ('ga@gabearredondo.com', 'AMELIA_EMAIL_HERE')
  );

-- Do NOT seed the 'shared' row here. The app creates it on first sign-in
-- push. Seeding an empty row would be mistaken for an empty cloud library
-- and the app would refuse to overwrite it with your real projects.
