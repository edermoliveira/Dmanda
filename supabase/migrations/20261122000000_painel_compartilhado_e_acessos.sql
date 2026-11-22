-- Dmanda: autenticação por e-mail e senha, administração dos acessos e painel compartilhado (decisão 92, 22/11/2026).
-- Substitui a entrada aberta (decisão de 17/11/2026) e a restrição de usuário único NO ALCANCE necessário para que várias pessoas autorizadas trabalhem no MESMO painel.
-- Migração ADITIVA e compatível com o código anterior: não remove executar_como_titular nem assumir_titular (o código publicado ainda os chama até o novo estar no ar; a retirada fica em
-- supabase/pendentes/20261122000200_fechar_acesso_aberto.sql, passo 2, como foi feito com os aparelhos). Não altera nem apaga nenhum registro de trabalho: os user_id existentes passam a ser a AUTORIA.
--
-- O que muda:
--   1) Administrador único: dmanda_privado.email_admin() (constante do banco, fora do alcance do cliente). Ninguém concede nem retira essa condição: ela é o e-mail desta função.
--   2) Autorização: dmanda_privado.acesso_autorizado ganha revogado_em, convite_enviado_em e autorizado_por. conta_autorizada() agora consulta auth.users PELO auth.uid() (não pelas claims do JWT) e exige
--      e-mail confirmado, não banido, não apagado e não revogado: a revogação vale na próxima consulta, mesmo com um JWT anterior ainda dentro da validade.
--   3) A conta administradora é protegida por gatilho: não pode ser revogada, apagada nem trocada de e-mail por nenhum papel.
--   4) Hook de criação de usuários: só e-mail e senha, e só para endereços autorizados e não revogados.
--   5) Gestão dos acessos (funções só do administrador, verificado no banco) e estado_acesso() (cada pessoa vê só o próprio).
--   6) RLS: demandas, tarefas, entradas, eventos, dias e períodos indisponíveis, opções, resumos e execuções passam a ser do PAINEL (qualquer conta autorizada). Continuam INDIVIDUAIS: registros_dia
--      (humor) e para_hoje (as quatro vagas). user_id vira autoria: o gatilho dmanda_privado.autoria() grava o autor no INSERT e o mantém no UPDATE quando quem chama é um usuário.
--   7) Resumo e rotina diária passam a ser do painel (calculados uma única vez, não por usuário).

-- ---------- 1) administrador ----------
create or replace function dmanda_privado.email_admin() returns text language sql immutable set search_path = '' as $$ select 'ederoliveiramachado@gmail.com'::text $$;
revoke all on function dmanda_privado.email_admin() from public, anon, authenticated;

-- ---------- 2) autorização ----------
alter table dmanda_privado.acesso_autorizado
  add column if not exists revogado_em timestamptz,
  add column if not exists convite_enviado_em timestamptz,
  add column if not exists autorizado_por uuid;

insert into dmanda_privado.acesso_autorizado (email) values (dmanda_privado.email_admin()) on conflict (email) do update set revogado_em = null;

-- a conta administradora não sai da lista nem muda de endereço; nenhum endereço muda de e-mail (a identidade da linha é o e-mail)
create or replace function dmanda_privado.proteger_acesso() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.email = dmanda_privado.email_admin() then raise exception 'A conta administradora não pode ser removida.' using errcode = 'P0001'; end if;
    return old;
  end if;
  if new.email <> old.email then raise exception 'O endereço de um acesso não pode ser trocado.' using errcode = 'P0001'; end if;
  if old.email = dmanda_privado.email_admin() and new.revogado_em is not null then raise exception 'A conta administradora não pode ser revogada.' using errcode = 'P0001'; end if;
  return new;
end $$;
revoke all on function dmanda_privado.proteger_acesso() from public, anon, authenticated;
drop trigger if exists acesso_protegido on dmanda_privado.acesso_autorizado;
create trigger acesso_protegido before update or delete on dmanda_privado.acesso_autorizado for each row execute function dmanda_privado.proteger_acesso();

-- true só se a identidade DESTA chamada (auth.uid(), de um JWT assinado) é de uma pessoa autorizada, com e-mail confirmado, sem banimento, sem exclusão e sem revogação. Lê o estado atual do banco.
create or replace function dmanda_privado.conta_autorizada() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join dmanda_privado.acesso_autorizado a on a.email = lower(btrim(u.email))
    where u.id = (select auth.uid()) and a.revogado_em is null and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now()) and u.deleted_at is null)
$$;
revoke all on function dmanda_privado.conta_autorizada() from public, anon, authenticated;
grant execute on function dmanda_privado.conta_autorizada() to authenticated;

-- true só para a conta administradora (e-mail desta função, confirmado pelo Auth) E autorizada agora
create or replace function dmanda_privado.e_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select dmanda_privado.conta_autorizada() and exists (select 1 from auth.users u where u.id = (select auth.uid()) and lower(btrim(u.email)) = dmanda_privado.email_admin())
$$;
revoke all on function dmanda_privado.e_admin() from public, anon, authenticated;
grant execute on function dmanda_privado.e_admin() to authenticated;

-- ---------- 4) hook de criação de usuários (cadastro público fechado também fora da interface) ----------
create or replace function public.hook_antes_criar_usuario(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  v_provedor text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '');
begin
  if v_provedor = 'email' and v_email <> '' and exists (select 1 from dmanda_privado.acesso_autorizado where email = v_email and revogado_em is null) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Este endereço não tem acesso ao Dmanda.'));
end $$;
revoke all on function public.hook_antes_criar_usuario(jsonb) from public, anon, authenticated;
grant execute on function public.hook_antes_criar_usuario(jsonb) to supabase_auth_admin;

-- ---------- 5) gestão dos acessos ----------
create or replace function public.erro_acesso(p_msg text) returns void language plpgsql set search_path = '' as $$ begin raise exception '%', p_msg using errcode = 'P0001'; end $$;
revoke all on function public.erro_acesso(text) from public, anon, authenticated;

-- A situação de quem chama (qualquer conta autenticada pode perguntar, e só recebe a própria): { autorizado, admin, email }
create or replace function public.estado_acesso() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('autorizado', dmanda_privado.conta_autorizada(), 'admin', dmanda_privado.e_admin(),
    'email', (select u.email from auth.users u where u.id = (select auth.uid())))
$$;

-- Só o administrador. Estados: autorizado (e-mail na lista, sem convite), convite_pendente (convite enviado e ainda sem primeiro acesso), ativo (já entrou) e revogado.
create or replace function public.listar_acessos() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not dmanda_privado.e_admin() then perform public.erro_acesso('Somente a conta administradora gerencia os acessos.'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'email', a.email, 'admin', a.email = dmanda_privado.email_admin(),
      'estado', case when a.revogado_em is not null then 'revogado'
                     when u.id is not null and u.email_confirmed_at is not null and u.last_sign_in_at is not null then 'ativo'
                     when a.convite_enviado_em is not null or u.invited_at is not null then 'convite_pendente' else 'autorizado' end,
      'convite_enviado_em', a.convite_enviado_em, 'revogado_em', a.revogado_em, 'ultimo_acesso', u.last_sign_in_at, 'criado_em', a.criado_em)
      order by (a.email = dmanda_privado.email_admin()) desc, a.criado_em, a.email)
    from dmanda_privado.acesso_autorizado a left join auth.users u on lower(btrim(u.email)) = a.email), '[]'::jsonb);
end $$;

create or replace function dmanda_privado.email_valido(p text) returns text language plpgsql immutable set search_path = '' as $$
declare v text := lower(btrim(coalesce(p, '')));
begin
  if length(v) > 254 or v !~ '^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$' then perform public.erro_acesso('Informe um e-mail válido.'); end if;
  return v;
end $$;
revoke all on function dmanda_privado.email_valido(text) from public, anon, authenticated;

-- Autoriza um e-mail (sem enviar nada: o envio é o convite, feito pelo servidor com a chave de serviço DEPOIS desta autorização). Repetir o mesmo e-mail não duplica e não restabelece um acesso revogado.
create or replace function public.autorizar_acesso(p_email text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v text; r dmanda_privado.acesso_autorizado;
begin
  if not dmanda_privado.e_admin() then perform public.erro_acesso('Somente a conta administradora gerencia os acessos.'); end if;
  v := dmanda_privado.email_valido(p_email);
  insert into dmanda_privado.acesso_autorizado (email, autorizado_por) values (v, (select auth.uid())) on conflict (email) do nothing;
  select * into r from dmanda_privado.acesso_autorizado where email = v;
  return jsonb_build_object('email', r.email, 'revogado', r.revogado_em is not null);
end $$;

-- Marca que o convite foi enviado (chamada depois do envio ter sido aceito pelo Auth). Só para e-mail autorizado e não revogado.
create or replace function public.registrar_convite_enviado(p_email text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if not dmanda_privado.e_admin() then perform public.erro_acesso('Somente a conta administradora gerencia os acessos.'); end if;
  v := dmanda_privado.email_valido(p_email);
  update dmanda_privado.acesso_autorizado set convite_enviado_em = now() where email = v and revogado_em is null;
  if not found then perform public.erro_acesso('Este e-mail não está autorizado ou o acesso foi revogado.'); end if;
  return jsonb_build_object('email', v);
end $$;

-- Revoga: o acesso aos dados acaba na próxima consulta (conta_autorizada() lê esta linha) mesmo com um JWT anterior ainda válido. Nada do que a pessoa registrou é apagado. Devolve o usuario_id (se já existe no Auth)
-- para o servidor também banir a conta e encerrar as sessões (defesa adicional; a decisão é do banco).
create or replace function public.revogar_acesso(p_email text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v text; uid uuid;
begin
  if not dmanda_privado.e_admin() then perform public.erro_acesso('Somente a conta administradora gerencia os acessos.'); end if;
  v := dmanda_privado.email_valido(p_email);
  if v = dmanda_privado.email_admin() then perform public.erro_acesso('A conta administradora não pode ser revogada.'); end if;
  update dmanda_privado.acesso_autorizado set revogado_em = coalesce(revogado_em, now()) where email = v;
  if not found then perform public.erro_acesso('Este e-mail não está na lista de acessos.'); end if;
  select u.id into uid from auth.users u where lower(btrim(u.email)) = v;
  return jsonb_build_object('email', v, 'usuario_id', uid);
end $$;

create or replace function public.restabelecer_acesso(p_email text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v text; uid uuid;
begin
  if not dmanda_privado.e_admin() then perform public.erro_acesso('Somente a conta administradora gerencia os acessos.'); end if;
  v := dmanda_privado.email_valido(p_email);
  update dmanda_privado.acesso_autorizado set revogado_em = null where email = v;
  if not found then perform public.erro_acesso('Este e-mail não está na lista de acessos.'); end if;
  select u.id into uid from auth.users u where lower(btrim(u.email)) = v;
  return jsonb_build_object('email', v, 'usuario_id', uid);
end $$;

revoke all on function public.estado_acesso(), public.listar_acessos(), public.autorizar_acesso(text), public.registrar_convite_enviado(text), public.revogar_acesso(text), public.restabelecer_acesso(text)
  from public, anon, authenticated;
grant execute on function public.estado_acesso(), public.listar_acessos(), public.autorizar_acesso(text), public.registrar_convite_enviado(text), public.revogar_acesso(text), public.restabelecer_acesso(text)
  to authenticated;

-- ---------- 6) RLS do painel compartilhado e autoria ----------
create or replace function dmanda_privado.autoria() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then new.user_id := (select auth.uid()); else new.user_id := old.user_id; end if;
  end if;
  return new;
end $$;
revoke all on function dmanda_privado.autoria() from public, anon, authenticated;
grant execute on function dmanda_privado.autoria() to authenticated;

do $$
declare t text; pol text;
begin
  for t, pol in select * from (values ('demandas', 'demandas_dono'), ('tarefas', 'tarefas_dono'), ('entradas', 'entradas_dono'), ('eventos', 'eventos_dono'),
      ('dias_indisponiveis', 'dias_indisponiveis_dono'), ('periodos_operacoes', 'periodos_operacoes_dono'), ('opcoes', 'opcoes_dono')) v(a, b)
  loop
    execute format('drop policy %I on public.%I', pol, t);
    execute format('create policy %I on public.%I for all to authenticated using ((select dmanda_privado.conta_autorizada())) with check ((select dmanda_privado.conta_autorizada()))', t || '_painel', t);
    execute format('drop trigger if exists %I on public.%I', t || '_autoria', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function dmanda_privado.autoria()', t || '_autoria', t);
  end loop;
end $$;

-- opções: o mesmo nome (sem contar maiúsculas e espaços) é UMA opção do painel, não uma por pessoa
alter table public.opcoes drop constraint opcoes_user_id_campo_chave_key;
alter table public.opcoes add constraint opcoes_campo_chave_key unique (campo, chave);

create or replace function public.listar_opcoes() returns jsonb language plpgsql set search_path = '' as $$
begin
  insert into public.opcoes (campo, nome) select 'origem', n from unnest(array['Prefeita', 'Reunião', 'Pedido de colega', 'Iniciativa própria']) n on conflict (campo, chave) do nothing;
  insert into public.opcoes (campo, nome) select 'tipo', n from unnest(array['Protocolo', 'Processo', 'Memorando', 'Ofício', 'Pedido de informação', 'Projeto de lei', 'Portaria', 'Outro documento']) n on conflict (campo, chave) do nothing;
  -- valores antigos das demandas entram como opções (sem duplicar)
  insert into public.opcoes (campo, nome) select distinct 'origem', left(regexp_replace(btrim(d.origem), '\s+', ' ', 'g'), 80) from public.demandas d
    where btrim(d.origem) <> '' and d.origem <> 'Não informada' on conflict (campo, chave) do nothing;
  insert into public.opcoes (campo, nome) select distinct 'tipo', left(regexp_replace(btrim(d.tipo), '\s+', ' ', 'g'), 80) from public.demandas d
    where d.tipo is not null and btrim(d.tipo) <> '' on conflict (campo, chave) do nothing;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'campo', o.campo, 'nome', o.nome) order by o.campo, o.criado_em, o.nome), '[]'::jsonb) from public.opcoes o);
end $$;

create or replace function public.criar_opcao(p_campo text, p_nome text) returns jsonb language plpgsql set search_path = '' as $$
declare v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'); o public.opcoes; v_novo boolean := false;
begin
  if p_campo is null or p_campo not in ('origem', 'tipo') then perform public.erro_dmanda('Campo da opção inválido.'); end if;
  if length(v_nome) = 0 then perform public.erro_dmanda(case when p_campo = 'origem' then 'Digite o nome da origem.' else 'Digite o nome do tipo de documento.' end); end if;
  if length(v_nome) > 80 then perform public.erro_dmanda('O nome passa de 80 caracteres.'); end if;
  insert into public.opcoes (campo, nome) values (p_campo, v_nome) on conflict (campo, chave) do nothing returning * into o;
  if found then v_novo := true; else select * into o from public.opcoes x where x.campo = p_campo and x.chave = lower(v_nome); end if;
  return jsonb_build_object('id', o.id, 'campo', o.campo, 'nome', o.nome, 'existente', not v_novo);
end $$;

-- ---------- 7) resumo e rotina diária do painel ----------
-- O resumo de hoje deixa de ser por usuário: uma linha por data (user_id fica nulo, histórico). A rotina calcula UMA vez, qualquer que seja o número de pessoas.
alter table public.resumos_operacionais drop constraint resumos_operacionais_pkey;
alter table public.resumos_operacionais alter column user_id drop not null;
delete from public.resumos_operacionais r where exists (select 1 from public.resumos_operacionais o where o.data_ref = r.data_ref and (o.calculado_em, o.ctid) > (r.calculado_em, r.ctid));
update public.resumos_operacionais set user_id = null;
alter table public.resumos_operacionais add primary key (data_ref);
drop policy resumos_dono_le on public.resumos_operacionais;
create policy resumos_painel_le on public.resumos_operacionais for select to authenticated using ((select dmanda_privado.conta_autorizada()));

-- p_user é ignorado (mantido só para não mudar as assinaturas): o calendário e as demandas são do painel
create or replace function public.retorno_setor_data(p_user uuid, p_encaminhada date, p_reiterada date, p_etapa_desde timestamptz) returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  v_base date := coalesce(greatest(p_encaminhada, p_reiterada), (p_etapa_desde at time zone 'America/Sao_Paulo')::date);
  v_dia date := v_base + 10;
begin
  while extract(isodow from v_dia) in (6, 7) or exists (select 1 from public.dias_indisponiveis c where c.data = v_dia) loop
    v_dia := v_dia - 1;
  end loop;
  return v_dia;
end $$;

create or replace function public.calcular_resumo(p_user uuid, p_data date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with base as (
    select d.id, d.etapa, d.prazo, d.chegou_em, d.etapa_desde,
      case when d.etapa = 'Finalizado' then null
        else least(d.prazo, d.acompanhar_em,
          case when d.etapa = 'Aguardando retorno' then public.retorno_setor_data(p_user, d.encaminhada_em, d.reiterada_em, d.etapa_desde) end)
      end as data_filtro
    from public.demandas d
    where d.arquivada_em is null
  ), g as (
    select b.*, case
      when b.data_filtro is null then null
      when b.data_filtro < p_data then 'atrasadas'
      when b.data_filtro = p_data then 'hoje'
      when b.data_filtro - p_data <= 7 then 'sete'
    end as grupo
    from base b
  )
  select jsonb_build_object(
    'data_ref', p_data,
    'abertas', count(*) filter (where etapa <> 'Finalizado'),
    'finalizadas', count(*) filter (where etapa = 'Finalizado'),
    'prazo_vencido', count(*) filter (where etapa <> 'Finalizado' and prazo is not null and prazo < p_data),
    'atrasadas', count(*) filter (where grupo = 'atrasadas'),
    'hoje', count(*) filter (where grupo = 'hoje'),
    'sete_dias', count(*) filter (where grupo = 'sete'),
    'aguardando_retorno', count(*) filter (where etapa = 'Aguardando retorno'),
    'aguardando_prefeita', count(*) filter (where etapa = 'Aguardando Prefeita'),
    'espera_prefeita_alerta', count(*) filter (where etapa = 'Aguardando Prefeita' and p_data - (etapa_desde at time zone 'America/Sao_Paulo')::date > 10),
    'sem_prazo', count(*) filter (where etapa not in ('Finalizado', 'Aguardando retorno') and prazo is null),
    'proxima_data', min(data_filtro) filter (where data_filtro >= p_data),
    'ids', jsonb_build_object(
      'atrasadas', coalesce(jsonb_agg(id order by data_filtro, chegou_em) filter (where grupo = 'atrasadas'), '[]'::jsonb),
      'hoje', coalesce(jsonb_agg(id order by chegou_em) filter (where grupo = 'hoje'), '[]'::jsonb),
      'sete_dias', coalesce(jsonb_agg(id order by data_filtro, chegou_em) filter (where grupo = 'sete'), '[]'::jsonb)
    )
  )
  from g
$$;

-- grava o resumo do PAINEL (uma linha por data); p_user é ignorado
create or replace function public.recalcular_resumo_usuario(p_user uuid, p_data date, p_origem text) returns void
language sql security definer set search_path = '' as $$
  insert into public.resumos_operacionais (user_id, data_ref, calculado_em, origem, dados)
  values (null, p_data, now(), p_origem, public.calcular_resumo(null, p_data))
  on conflict (data_ref) do update set calculado_em = excluded.calculado_em, origem = excluded.origem, dados = excluded.dados
$$;

create or replace function public.demandas_atualizam_resumo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_resumo_usuario(null, public.hoje(), 'alteracao');
  return null;
end $$;

-- A rotina: um cálculo só (o painel), registrado em execucoes_rotina.usuarios (que passa a significar painéis: 1 quando há demandas, 0 quando não há).
create or replace function public.rotina_diaria() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_data date := public.hoje();
  v_ini timestamptz := clock_timestamp();
  v_n integer := 0;
begin
  if exists (select 1 from public.demandas) then
    perform public.recalcular_resumo_usuario(null, v_data, 'rotina');
    v_n := 1;
  end if;
  insert into public.execucoes_rotina (data_ref, iniciou_em, terminou_em, ok, usuarios) values (v_data, v_ini, clock_timestamp(), true, v_n);
  delete from public.execucoes_rotina where iniciou_em < now() - interval '90 days';
  delete from public.resumos_operacionais where data_ref < v_data - 60;
  return jsonb_build_object('data_ref', v_data, 'usuarios', v_n);
end $$;

-- o resumo de hoje com o painel inteiro (dado derivado)
select public.recalcular_resumo_usuario(null, public.hoje(), 'alteracao') where exists (select 1 from public.demandas);
