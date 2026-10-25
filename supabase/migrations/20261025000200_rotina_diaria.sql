-- Rotina diária: resumo operacional datado e registro das execuções.
-- Princípios: as datas originais das demandas (prazo, acompanhar_em) são a fonte de verdade; os dias restantes são sempre derivados delas,
-- com a data de hoje em America/Sao_Paulo (public.hoje()). O resumo guarda a data de referência e é recalculado quando uma demanda muda,
-- então a tela nunca depende dele para mostrar prazos corretos. A rotina só LÊ as demandas: não conclui, não altera prazos e não inventa dados.
-- Pode rodar várias vezes no mesmo dia (idempotente) e, se um dia for perdido, o dia seguinte recalcula tudo a partir das datas.

create table public.resumos_operacionais (
  user_id uuid not null references auth.users (id) on delete cascade,
  data_ref date not null,
  calculado_em timestamptz not null default now(),
  origem text not null check (origem in ('rotina', 'alteracao')),
  dados jsonb not null,
  primary key (user_id, data_ref)
);

create table public.execucoes_rotina (
  id uuid primary key default gen_random_uuid(),
  data_ref date not null,
  iniciou_em timestamptz not null default now(),
  terminou_em timestamptz,
  ok boolean not null,
  usuarios integer,
  erro text check (erro is null or char_length(erro) <= 200)
);
create index execucoes_rotina_terminou_idx on public.execucoes_rotina (terminou_em desc);

alter table public.resumos_operacionais enable row level security;
alter table public.execucoes_rotina enable row level security;
create policy resumos_dono_le on public.resumos_operacionais for select to authenticated using (user_id = (select auth.uid()));
-- o registro das execuções não tem dado pessoal (só datas, contagem e uma mensagem curta); só leitura para quem está logado
create policy execucoes_le on public.execucoes_rotina for select to authenticated using (true);
revoke all on public.resumos_operacionais, public.execucoes_rotina from anon, public, authenticated;
grant select on public.resumos_operacionais, public.execucoes_rotina to authenticated;

-- Cálculo puro: depende só das demandas do usuário e da data recebida. Mesma regra dos grupos do Início do aplicativo
-- (finalizada nunca conta; quem aguarda retorno só volta quando faltam 3 dias ou menos para o acompanhamento; sem data nada é inventado).
create or replace function public.calcular_resumo(p_user uuid, p_data date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with base as (
    select d.id, d.etapa, d.prazo, d.chegou_em,
      case d.etapa
        when 'Finalizado' then null
        when 'Aguardando retorno' then case when d.acompanhar_em is not null and d.acompanhar_em - p_data <= 3 then d.acompanhar_em end
        else d.prazo
      end as data_filtro
    from public.demandas d
    where d.user_id = p_user and d.arquivada_em is null
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

create or replace function public.recalcular_resumo_usuario(p_user uuid, p_data date, p_origem text) returns void
language sql security definer set search_path = '' as $$
  insert into public.resumos_operacionais (user_id, data_ref, calculado_em, origem, dados)
  values (p_user, p_data, now(), p_origem, public.calcular_resumo(p_user, p_data))
  on conflict (user_id, data_ref) do update
    set calculado_em = excluded.calculado_em, origem = excluded.origem, dados = excluded.dados
$$;

-- Recalcula o resumo de hoje quando uma demanda muda de algo que o resumo usa (etapa, datas, arquivamento, conclusão) ou é criada ou excluída.
create or replace function public.demandas_atualizam_resumo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_resumo_usuario(case when tg_op = 'DELETE' then old.user_id else new.user_id end, public.hoje(), 'alteracao');
  return null;
end $$;
create trigger demandas_resumo after insert or delete or update of etapa, prazo, acompanhar_em, arquivada_em, concluida_em
  on public.demandas for each row execute function public.demandas_atualizam_resumo();

-- A rotina em si. Só lê as demandas, grava o resumo de hoje de cada usuário que tem demandas e registra a execução bem-sucedida.
-- Não recebe data: sempre usa hoje (America/Sao_Paulo). Em caso de erro a transação inteira volta atrás e quem chamou registra a falha à parte.
create or replace function public.rotina_diaria() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_data date := public.hoje();
  v_ini timestamptz := clock_timestamp();
  v_n integer := 0;
  u record;
begin
  for u in select distinct user_id from public.demandas loop
    perform public.recalcular_resumo_usuario(u.user_id, v_data, 'rotina');
    v_n := v_n + 1;
  end loop;
  insert into public.execucoes_rotina (data_ref, iniciou_em, terminou_em, ok, usuarios) values (v_data, v_ini, clock_timestamp(), true, v_n);
  delete from public.execucoes_rotina where iniciou_em < now() - interval '90 days';
  delete from public.resumos_operacionais where data_ref < v_data - 60;
  return jsonb_build_object('data_ref', v_data, 'usuarios', v_n);
end $$;

create or replace function public.registrar_falha_rotina(p_erro text) returns void
language sql security definer set search_path = '' as $$
  insert into public.execucoes_rotina (data_ref, terminou_em, ok, erro) values (public.hoje(), clock_timestamp(), false, left(coalesce(nullif(btrim(p_erro), ''), 'erro sem detalhe'), 200))
$$;

-- Para a tela: quando a rotina rodou pela última vez com sucesso, quando falhou pela última vez e que resumo existe. Com a RLS de quem pergunta.
create or replace function public.estado_rotina() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'ultima_ok', (select max(terminou_em) from public.execucoes_rotina where ok),
    'ultima_falha', (select max(terminou_em) from public.execucoes_rotina where not ok),
    'resumo_data', (select max(data_ref) from public.resumos_operacionais),
    'resumo_calculado_em', (select r.calculado_em from public.resumos_operacionais r order by r.data_ref desc limit 1)
  )
$$;

-- Privilégios: as funções internas e a da rotina NÃO são chamáveis por anon nem por authenticated (no Supabase os privilégios padrão
-- de funções novas incluem esses papéis, por isso a revogação é explícita). A rotina e o registro de falha são só do papel de serviço.
revoke all on function public.calcular_resumo(uuid, date), public.recalcular_resumo_usuario(uuid, date, text), public.demandas_atualizam_resumo(),
  public.rotina_diaria(), public.registrar_falha_rotina(text), public.estado_rotina() from public, anon, authenticated;
grant execute on function public.rotina_diaria(), public.registrar_falha_rotina(text) to service_role;
grant execute on function public.estado_rotina() to authenticated;
