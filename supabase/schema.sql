-- ERP 3STRUZA: cole no Supabase em SQL Editor -> New query -> Run (uma vez só)
create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
alter table public.docs enable row level security;
drop policy if exists "docs_select" on public.docs;
drop policy if exists "docs_insert" on public.docs;
drop policy if exists "docs_update" on public.docs;
drop policy if exists "docs_delete" on public.docs;
create policy "docs_select" on public.docs for select to authenticated using (true);
create policy "docs_insert" on public.docs for insert to authenticated with check (true);
create policy "docs_update" on public.docs for update to authenticated using (true) with check (true);
create policy "docs_delete" on public.docs for delete to authenticated using (true);
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
