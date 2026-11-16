-- Dmanda: abertura direta em aparelhos autorizados (decisão 82, etapa 5 de 6).
-- Migração aditiva e isolada: cria o cadastro dos aparelhos autorizados (cada um ligado ao session_id da sessão do Supabase Auth), os convites de uso único, a trava de tentativas
-- e a chave "exigir_aparelho", e troca UMA função, dmanda_privado.conta_autorizada(), que todas as políticas de RLS já chamam. Nenhuma tabela de dados, política, privilégio
-- de dados ou migração anterior é alterado; não depende de Pagamentos nem das quatro vagas.
--
-- Como funciona:
--  * Um aparelho autorizado é uma sessão do Supabase Auth da conta única, registrada em dmanda_privado.aparelhos pelo session_id que todo token de acesso traz. A decisão é do banco
--    (RLS via conta_autorizada) e do proxy (estado_aparelho): um token ainda não expirado de uma sessão revogada, vencida ou nunca registrada deixa de ler e de gravar.
--  * Autorização inicial por código de uso único (8 caracteres, 10 minutos), gerado por um aparelho já autorizado (criar_convite_aparelho) ou pelo titular no terminal, com a chave
--    de serviço (criar_convite_terminal, que também é a recuperação quando todos os aparelhos se perdem). O aplicativo troca o código por uma sessão e registra o aparelho no servidor.
--  * Cada aparelho vale por 90 dias sem uso (a validade renova no uso, no máximo uma vez por hora) e pode ser revogado individualmente.
--  * TRANSIÇÃO: a exigência nasce DESLIGADA (exigir_aparelho = false). Com ela desligada nada muda para as sessões que já existem (a versão antiga no ar continua funcionando).
--    O titular autoriza o primeiro aparelho, confere, e só então liga a exigência (scripts/aparelhos.mjs exigir sim); desligar volta ao comportamento anterior (rollback).
--  * O cadastro público segue fechado (hook de cadastro e lista protegida inalterados). A rotina diária (chave de serviço) não é afetada.

-- ---------- tabelas privadas (sem política: só as funções abaixo, do dono do banco, leem e gravam) ----------
create table dmanda_privado.config_acesso (
  id boolean primary key default true check (id),
  exigir_aparelho boolean not null default false
);
insert into dmanda_privado.config_acesso (id) values (true);

create table dmanda_privado.aparelhos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sessao_id uuid not null unique,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  criado_em timestamptz not null default now(),
  ultimo_uso timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '90 days'),
  revogado_em timestamptz
);
create index aparelhos_usuario on dmanda_privado.aparelhos (user_id);

create table dmanda_privado.convites_aparelho (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  codigo_hash text not null unique,
  origem text not null check (origem in ('aparelho', 'terminal')),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz
);

create table dmanda_privado.falhas_pareamento (em timestamptz not null default now());

alter table dmanda_privado.config_acesso enable row level security;
alter table dmanda_privado.aparelhos enable row level security;
alter table dmanda_privado.convites_aparelho enable row level security;
alter table dmanda_privado.falhas_pareamento enable row level security;
revoke all on dmanda_privado.config_acesso, dmanda_privado.aparelhos, dmanda_privado.convites_aparelho, dmanda_privado.falhas_pareamento from public, anon, authenticated;

-- ---------- a decisão de acesso ----------
-- titular_autorizado: a regra de antes (e-mail da lista protegida e provedor aceito), sem olhar o aparelho.
create or replace function dmanda_privado.titular_autorizado() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'provider', '') in ('google', 'email')
    and exists (
      select 1 from dmanda_privado.acesso_autorizado a
      where a.email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
    )
$$;
revoke all on function dmanda_privado.titular_autorizado() from public, anon, authenticated;

-- aparelho_autorizado: sem a exigência ligada, vale tudo (transição); com ela, só a sessão registrada, não revogada e dentro da validade. Sem session_id no token, nega.
create or replace function dmanda_privado.aparelho_autorizado() returns boolean
language sql stable security definer set search_path = '' as $$
  select not coalesce((select exigir_aparelho from dmanda_privado.config_acesso), false)
    or exists (
      select 1 from dmanda_privado.aparelhos a
      where a.sessao_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
        and a.user_id = (select auth.uid())
        and a.revogado_em is null
        and a.expira_em > now()
    )
$$;
revoke all on function dmanda_privado.aparelho_autorizado() from public, anon, authenticated;

-- conta_autorizada: a função que todas as políticas de RLS chamam. Mesma assinatura e mesmos privilégios; passa a exigir também o aparelho autorizado.
create or replace function dmanda_privado.conta_autorizada() returns boolean
language sql stable security definer set search_path = '' as $$
  select dmanda_privado.titular_autorizado() and dmanda_privado.aparelho_autorizado()
$$;
revoke all on function dmanda_privado.conta_autorizada() from public, anon, authenticated;
grant execute on function dmanda_privado.conta_autorizada() to authenticated;

-- ---------- funções do aparelho autorizado (usuário logado) ----------
-- estado_aparelho: o que o proxy pergunta a cada pedido. Renova a validade e o último uso (no máximo uma vez por hora).
create or replace function public.estado_aparelho() returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_exigido boolean := coalesce((select exigir_aparelho from dmanda_privado.config_acesso), false); v_sessao uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
begin
  if not dmanda_privado.titular_autorizado() then return jsonb_build_object('exigido', v_exigido, 'ativo', false, 'motivo', 'conta'); end if;
  if not v_exigido then return jsonb_build_object('exigido', false, 'ativo', true); end if;
  update dmanda_privado.aparelhos set ultimo_uso = now(), expira_em = now() + interval '90 days'
    where sessao_id = v_sessao and user_id = (select auth.uid()) and revogado_em is null and expira_em > now() and ultimo_uso < now() - interval '1 hour';
  return jsonb_build_object('exigido', true, 'ativo', dmanda_privado.aparelho_autorizado());
end $$;

create or replace function public.criar_convite_aparelho(p_codigo text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_codigo text := upper(btrim(coalesce(p_codigo, ''))); v_expira timestamptz := now() + interval '10 minutes';
begin
  if not dmanda_privado.conta_autorizada() then perform public.erro_dmanda('Este aparelho não está autorizado.'); end if;
  if v_codigo !~ '^[A-Z0-9]{8}$' then perform public.erro_dmanda('Código de convite inválido.'); end if;
  -- só um convite aberto por vez: o anterior que ninguém usou deixa de valer
  delete from dmanda_privado.convites_aparelho where user_id = (select auth.uid()) and (usado_em is null or expira_em < now() - interval '1 day');
  insert into dmanda_privado.convites_aparelho (user_id, codigo_hash, origem, expira_em)
    values ((select auth.uid()), encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'), 'aparelho', v_expira);
  return jsonb_build_object('expira_em', v_expira);
end $$;

create or replace function public.listar_aparelhos() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not dmanda_privado.conta_autorizada() then perform public.erro_dmanda('Este aparelho não está autorizado.'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'criado_em', a.criado_em, 'ultimo_uso', a.ultimo_uso, 'expira_em', a.expira_em, 'revogado_em', a.revogado_em,
                                        'atual', a.sessao_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid) order by a.criado_em desc)
    from dmanda_privado.aparelhos a where a.user_id = (select auth.uid())
  ), '[]'::jsonb);
end $$;

create or replace function public.revogar_aparelho(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_atual boolean;
begin
  if not dmanda_privado.conta_autorizada() then perform public.erro_dmanda('Este aparelho não está autorizado.'); end if;
  update dmanda_privado.aparelhos set revogado_em = coalesce(revogado_em, now()) where id = p_id and user_id = (select auth.uid())
    returning sessao_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid into v_atual;
  if not found then perform public.erro_dmanda('Aparelho não encontrado.'); end if;
  return jsonb_build_object('id', p_id, 'atual', coalesce(v_atual, false));
end $$;

-- ---------- funções só da chave de serviço (servidor do aplicativo e terminal do titular) ----------
-- consumir_convite_aparelho devolve {ok:false} em vez de levantar erro: um erro desfaria a anotação da falha que alimenta a trava de tentativas.
create or replace function public.consumir_convite_aparelho(p_codigo text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_hash text := encode(sha256(convert_to(upper(btrim(coalesce(p_codigo, ''))), 'UTF8')), 'hex'); v_conv dmanda_privado.convites_aparelho;
begin
  delete from dmanda_privado.falhas_pareamento where em < now() - interval '1 day';
  if (select count(*) from dmanda_privado.falhas_pareamento where em > now() - interval '10 minutes') >= 10 then return jsonb_build_object('ok', false, 'motivo', 'limite'); end if;
  select * into v_conv from dmanda_privado.convites_aparelho where codigo_hash = v_hash and usado_em is null and expira_em > now() for update;
  if not found then
    insert into dmanda_privado.falhas_pareamento default values;
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;
  update dmanda_privado.convites_aparelho set usado_em = now() where id = v_conv.id;
  return jsonb_build_object('ok', true, 'user_id', v_conv.user_id);
end $$;

create or replace function public.registrar_aparelho(p_user uuid, p_sessao uuid, p_nome text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  -- a lista não cresce para sempre: some o que foi revogado ou venceu há mais de 30 dias
  delete from dmanda_privado.aparelhos where user_id = p_user and (revogado_em < now() - interval '30 days' or expira_em < now() - interval '30 days');
  insert into dmanda_privado.aparelhos (user_id, sessao_id, nome) values (p_user, p_sessao, coalesce(nullif(btrim(left(p_nome, 80)), ''), 'Aparelho'))
    on conflict (sessao_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from dmanda_privado.aparelhos where sessao_id = p_sessao; end if;
  return v_id;
end $$;

-- o titular único é a conta da lista protegida; o convite do terminal vale para ela
create or replace function public.criar_convite_terminal(p_codigo text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_codigo text := upper(btrim(coalesce(p_codigo, ''))); v_user uuid; v_expira timestamptz := now() + interval '10 minutes';
begin
  if v_codigo !~ '^[A-Z0-9]{8}$' then perform public.erro_dmanda('Código de convite inválido.'); end if;
  select u.id into v_user from auth.users u join dmanda_privado.acesso_autorizado a on a.email = lower(btrim(u.email)) order by u.id limit 1;
  if v_user is null then perform public.erro_dmanda('Nenhum usuário da lista protegida foi encontrado.'); end if;
  delete from dmanda_privado.convites_aparelho where user_id = v_user and (usado_em is null or expira_em < now() - interval '1 day');
  -- quem tem a chave de serviço é o titular: a trava de tentativas, aberta a qualquer visitante da tela de acesso, não pode impedir a recuperação
  delete from dmanda_privado.falhas_pareamento;
  insert into dmanda_privado.convites_aparelho (user_id, codigo_hash, origem, expira_em) values (v_user, encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'), 'terminal', v_expira);
  return jsonb_build_object('expira_em', v_expira);
end $$;

create or replace function public.exigir_aparelhos(p_exigir boolean) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- ligar a exigência sem nenhum aparelho autorizado trancaria o titular para fora: antes, autorize ao menos um aparelho (convite do terminal)
  if coalesce(p_exigir, false) and not exists (select 1 from dmanda_privado.aparelhos where revogado_em is null and expira_em > now()) then
    perform public.erro_dmanda('Autorize ao menos um aparelho antes de ligar a exigência.');
  end if;
  update dmanda_privado.config_acesso set exigir_aparelho = coalesce(p_exigir, false);
  return coalesce(p_exigir, false);
end $$;

-- recuperação de emergência: revoga todos os aparelhos (depois, um convite do terminal autoriza o primeiro de novo)
create or replace function public.revogar_todos_aparelhos() returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update dmanda_privado.aparelhos set revogado_em = now() where revogado_em is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Funções novas nascem executáveis por qualquer papel: lista explícita, nunca "all functions".
revoke all on function public.estado_aparelho(), public.criar_convite_aparelho(text), public.listar_aparelhos(), public.revogar_aparelho(uuid),
  public.consumir_convite_aparelho(text), public.registrar_aparelho(uuid, uuid, text), public.criar_convite_terminal(text), public.exigir_aparelhos(boolean), public.revogar_todos_aparelhos()
  from public, anon, authenticated, service_role;
grant execute on function public.estado_aparelho(), public.criar_convite_aparelho(text), public.listar_aparelhos(), public.revogar_aparelho(uuid) to authenticated;
grant execute on function public.consumir_convite_aparelho(text), public.registrar_aparelho(uuid, uuid, text), public.criar_convite_terminal(text), public.exigir_aparelhos(boolean), public.revogar_todos_aparelhos() to service_role;
