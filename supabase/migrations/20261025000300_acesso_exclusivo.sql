-- Acesso exclusivo à conta autorizada (usuário único). Três camadas, esta é a do banco e a do cadastro no Supabase Auth:
--   1. Supabase Auth: o hook "Before User Created" (public.hook_antes_criar_usuario) recusa a criação de qualquer usuário que não seja
--      a conta autorizada entrando pelo Google. Decide só por dados que o servidor de Auth define (e-mail do provedor e app_metadata.provider),
--      nunca por user_metadata nem nome de exibição, que o usuário pode editar.
--   2. Servidor da aplicação: src/proxy.ts e cada operação conferem a sessão e o e-mail (DMANDA_EMAIL_AUTORIZADO) antes de entregar dados.
--   3. Banco: as políticas de RLS passam a exigir também dmanda_privado.conta_autorizada(), que compara o e-mail do JWT (assinado, não editável)
--      com a lista protegida abaixo. Mesmo que outro usuário existisse, não leria nem gravaria nada.
-- O endereço autorizado NÃO está nesta migração nem em nenhum arquivo versionado: fica na tabela abaixo, preenchida à parte
-- (comando em supabase/LEIA-ME.md). Tabela vazia significa ninguém autorizado: o padrão é fechado.

create schema if not exists dmanda_privado;
revoke all on schema dmanda_privado from public, anon;
grant usage on schema dmanda_privado to authenticated;

create table dmanda_privado.acesso_autorizado (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  criado_em timestamptz not null default now()
);
-- RLS ligada e sem nenhuma política: ninguém lê nem grava pela API. Só as funções abaixo (dono do banco) consultam.
alter table dmanda_privado.acesso_autorizado enable row level security;
revoke all on dmanda_privado.acesso_autorizado from public, anon, authenticated;

-- true só se o JWT da chamada é de um usuário autorizado, entrando pelo Google. auth.jwt() lê as claims assinadas da requisição.
create or replace function dmanda_privado.conta_autorizada() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'provider', '') = 'google'
    and exists (
      select 1 from dmanda_privado.acesso_autorizado a
      where a.email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
    )
$$;
revoke all on function dmanda_privado.conta_autorizada() from public, anon, authenticated;
grant execute on function dmanda_privado.conta_autorizada() to authenticated;

-- Hook "Before User Created". O Supabase Auth o executa como supabase_auth_admin antes de criar qualquer usuário.
-- Entrada: { metadata, user: { email, app_metadata: { provider }, ... } }. Saída: {} permite; { error: {...} } recusa o cadastro.
create or replace function public.hook_antes_criar_usuario(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  v_provedor text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '');
begin
  if v_provedor = 'google' and v_email <> '' and exists (select 1 from dmanda_privado.acesso_autorizado where email = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Este endereço não tem acesso ao Dmanda.'));
end $$;
revoke all on function public.hook_antes_criar_usuario(jsonb) from public, anon, authenticated;
grant execute on function public.hook_antes_criar_usuario(jsonb) to supabase_auth_admin;

-- RLS: a mesma regra de dono de antes, agora também exigindo a conta autorizada. Trocar política não toca nos dados.
drop policy demandas_dono on public.demandas;
create policy demandas_dono on public.demandas for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
drop policy tarefas_dono on public.tarefas;
create policy tarefas_dono on public.tarefas for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
drop policy resumos_dono_le on public.resumos_operacionais;
create policy resumos_dono_le on public.resumos_operacionais for select to authenticated
  using (user_id = (select auth.uid()) and (select dmanda_privado.conta_autorizada()));
drop policy execucoes_le on public.execucoes_rotina;
create policy execucoes_le on public.execucoes_rotina for select to authenticated
  using ((select dmanda_privado.conta_autorizada()));
