-- ERP 3STRUZA: histórico de alterações (auditoria)
-- Cole no Supabase em SQL Editor -> New query -> Run (uma vez só).
-- Registra automaticamente toda criação, alteração e exclusão feita na tabela docs,
-- com o usuário logado, data/hora e os dados antes e depois.

create table if not exists public.historico (
  hid bigserial primary key,
  quando timestamptz not null default now(),
  usuario_id uuid,
  usuario_email text,
  acao text not null check (acao in ('criou','alterou','excluiu')),
  col text not null,
  id text not null,
  antes jsonb,
  depois jsonb
);
create index if not exists historico_quando_idx on public.historico (quando desc);
create index if not exists historico_reg_idx on public.historico (col, id);

-- Usuários logados podem consultar; ninguém altera ou apaga pelo sistema.
alter table public.historico enable row level security;
drop policy if exists "historico_select" on public.historico;
create policy "historico_select" on public.historico for select to authenticated using (true);

create or replace function public.docs_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  em text := coalesce(auth.jwt() ->> 'email', '');
begin
  if tg_op = 'INSERT' then
    insert into historico (usuario_id, usuario_email, acao, col, id, depois)
    values (uid, em, 'criou', new.col, new.id, new.data);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.data is distinct from old.data then
      insert into historico (usuario_id, usuario_email, acao, col, id, antes, depois)
      values (uid, em, 'alterou', new.col, new.id, old.data, new.data);
    end if;
    return new;
  else
    insert into historico (usuario_id, usuario_email, acao, col, id, antes)
    values (uid, em, 'excluiu', old.col, old.id, old.data);
    return old;
  end if;
end $$;

drop trigger if exists docs_auditar on public.docs;
create trigger docs_auditar after insert or update or delete on public.docs
for each row execute function public.docs_auditar();
-- a função só roda pelo gatilho; ninguém precisa chamá-la direto pela API
revoke execute on function public.docs_auditar() from public, anon, authenticated;

-- Tempo real: o histórico aparece na tela assim que alguém salva algo.
do $$ begin
  alter publication supabase_realtime add table public.historico;
exception when duplicate_object then null; end $$;
