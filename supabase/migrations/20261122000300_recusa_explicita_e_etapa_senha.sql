-- Dmanda: recusa EXPLÍCITA para conta revogada ou fora da lista, e uso único da etapa de definição de senha (decisão 92, fechamento de 22/11/2026). Aditiva e compatível com o código publicado
-- (a entrada aberta assume a conta administradora, que é autorizada: nada muda para ela).
--
-- 1) Antes, uma conta revogada com JWT ainda válido recebia listas VAZIAS (a RLS só filtrava): a tela não tinha como distinguir "sem demandas" de "sem acesso". Agora toda política que chama
--    dmanda_privado.conta_autorizada() recusa a consulta com o código DM403 e a mensagem em português, e o aplicativo mostra "acesso revogado" em vez de zeros. Nenhuma política é recriada: todas
--    já chamam conta_autorizada(). A verificação que só RESPONDE (sem recusar) passa a ser dmanda_privado.acesso_vigente(), usada por estado_acesso() e e_admin().
-- 2) A etapa de definição de senha (convite ou recuperação) é emitida pelo servidor, assinada, só depois de o Auth validar o link; o banco garante que cada etapa seja usada UMA vez.

create or replace function dmanda_privado.acesso_vigente() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join dmanda_privado.acesso_autorizado a on a.email = lower(btrim(u.email))
    where u.id = (select auth.uid()) and a.revogado_em is null and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now()) and u.deleted_at is null)
$$;
revoke all on function dmanda_privado.acesso_vigente() from public, anon, authenticated;
grant execute on function dmanda_privado.acesso_vigente() to authenticated;

-- Usada pelas políticas: verdadeira para a conta autorizada; para uma identidade sem acesso, RECUSA (DM403) em vez de devolver falso (o que faria as listas parecerem vazias).
create or replace function dmanda_privado.conta_autorizada() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if dmanda_privado.acesso_vigente() then return true; end if;
  if (select auth.uid()) is null then return false; end if;
  if exists (select 1 from auth.users u join dmanda_privado.acesso_autorizado a on a.email = lower(btrim(u.email)) where u.id = (select auth.uid()) and a.revogado_em is not null) then
    raise exception 'Seu acesso ao Dmanda foi revogado.' using errcode = 'DM403';
  end if;
  raise exception 'Esta conta não tem acesso ao Dmanda.' using errcode = 'DM403';
end $$;
revoke all on function dmanda_privado.conta_autorizada() from public, anon, authenticated;
grant execute on function dmanda_privado.conta_autorizada() to authenticated;

create or replace function dmanda_privado.e_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select dmanda_privado.acesso_vigente() and exists (select 1 from auth.users u where u.id = (select auth.uid()) and lower(btrim(u.email)) = dmanda_privado.email_admin())
$$;

create or replace function public.estado_acesso() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('autorizado', dmanda_privado.acesso_vigente(), 'admin', dmanda_privado.e_admin(),
    'revogado', exists (select 1 from auth.users u join dmanda_privado.acesso_autorizado a on a.email = lower(btrim(u.email)) where u.id = (select auth.uid()) and a.revogado_em is not null),
    'email', (select u.email from auth.users u where u.id = (select auth.uid())))
$$;

-- ---------- 2) uso único da etapa de senha ----------
create table if not exists dmanda_privado.etapas_senha_usadas (
  nonce uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  usado_em timestamptz not null default now()
);
alter table dmanda_privado.etapas_senha_usadas enable row level security;
revoke all on dmanda_privado.etapas_senha_usadas from public, anon, authenticated;

-- true na primeira vez que a etapa (nonce emitido pelo servidor, assinado) é usada pela conta autorizada que chama; false se já foi usada. A assinatura e a validade são conferidas pelo servidor;
-- aqui só se impede a reutilização. Uma conta só consegue "gastar" nonces em nome dela mesma (não há como afetar outra pessoa). Linhas com mais de 2 dias saem (a etapa vale 15 minutos).
create or replace function public.consumir_etapa_senha(p_nonce uuid) returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_nonce is null or not dmanda_privado.acesso_vigente() then raise exception 'Este acesso foi revogado ou não está autorizado.' using errcode = 'DM403'; end if;
  delete from dmanda_privado.etapas_senha_usadas where usado_em < now() - interval '2 days';
  insert into dmanda_privado.etapas_senha_usadas (nonce, user_id) values (p_nonce, (select auth.uid())) on conflict (nonce) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.consumir_etapa_senha(uuid) from public, anon, authenticated;
grant execute on function public.consumir_etapa_senha(uuid) to authenticated;
