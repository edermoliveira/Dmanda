-- Alinha a rotina diária às regras da Agenda (decisões 46 a 50). Não reescreve migrações anteriores e não altera nenhum dado de demanda.
--   * Data aplicável da demanda: a mais próxima entre o vencimento (prazo), "Acompanhar em" (manual e independente) e o retorno do setor calculado
--     (10 dias corridos a partir do encaminhamento ou da reiteração mais recente; sem elas, do dia em que entrou em Aguardando retorno; se cair em sábado,
--     domingo ou dia indisponível do usuário, antecipa para o dia disponível anterior, igual a src/lib/demandas.ts). Os valores originais seguem separados.
--   * Some o corte antigo de 3 dias para quem aguarda retorno.
--   * Aguardando Prefeita não tem data: o contador de dias na etapa é só um alerta de espera (a partir do 11º dia), nunca vencimento. O resumo passa a trazer
--     os contadores `aguardando_prefeita` e `espera_prefeita_alerta` à parte; `prazo_vencido` continua sendo só o prazo.
--   * O gatilho que recalcula o resumo passa a ouvir também `encaminhada_em` e `reiterada_em`.

-- Retorno do setor de uma demanda, com os dias indisponíveis do usuário informado (a rotina roda sem usuário logado, então não usa a RLS). Interna.
create or replace function public.retorno_setor_data(p_user uuid, p_encaminhada date, p_reiterada date, p_etapa_desde timestamptz) returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  v_base date := coalesce(greatest(p_encaminhada, p_reiterada), (p_etapa_desde at time zone 'America/Sao_Paulo')::date);
  v_dia date := v_base + 10;
  n integer := 0;
begin
  while extract(isodow from v_dia) in (6, 7) or exists (select 1 from public.dias_indisponiveis c where c.user_id = p_user and c.data = v_dia) loop
    v_dia := v_dia - 1;
    n := n + 1;
    if n > 400 then return v_dia; end if;
  end loop;
  return v_dia;
end $$;
revoke all on function public.retorno_setor_data(uuid, date, date, timestamptz) from public, anon, authenticated;

create or replace function public.calcular_resumo(p_user uuid, p_data date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with base as (
    select d.id, d.etapa, d.prazo, d.chegou_em, d.etapa_desde,
      case when d.etapa = 'Finalizado' then null
        else least(d.prazo, d.acompanhar_em,
          case when d.etapa = 'Aguardando retorno' then public.retorno_setor_data(p_user, d.encaminhada_em, d.reiterada_em, d.etapa_desde) end)
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
revoke all on function public.calcular_resumo(uuid, date) from public, anon, authenticated;

drop trigger if exists demandas_resumo on public.demandas;
create trigger demandas_resumo after insert or delete or update of etapa, prazo, acompanhar_em, encaminhada_em, reiterada_em, arquivada_em, concluida_em
  on public.demandas for each row execute function public.demandas_atualizam_resumo();

-- Atualiza o resumo de hoje com a regra nova (dado derivado; não toca em demandas).
select public.recalcular_resumo_usuario(u.user_id, public.hoje(), 'alteracao') from (select distinct user_id from public.demandas) u;
