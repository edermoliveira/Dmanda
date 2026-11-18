-- Dmanda: o retorno do setor passa a vir do servidor (subbloco 1.4). Migração ADITIVA: só cria uma função e acrescenta uma chave DERIVADA ao JSON da demanda. Nada é gravado, nenhum dado é tocado, sem backfill.
--
-- Por quê: o retorno de outro setor (10 dias corridos do encaminhamento ou da reiteração mais recente, ou da entrada na etapa, antecipado pelos fins de semana e pelos dias indisponíveis) é calculado, não
-- guardado. O aplicativo o recalculava no navegador com a lista de dias indisponíveis que tivesse carregado: se essa leitura falhasse, o Início, o Para hoje, os Cards e a Agenda classificavam a demanda com
-- uma data sem a antecipação, sem aviso na própria data. Agora o servidor calcula com o calendário completo, no momento da leitura, e a tela usa esse valor para exibir, ordenar e classificar.
--
-- demanda_json passa a trazer "retorno": { data, original, base, origem, ajuste } para a demanda aberta em Aguardando retorno, e nulo nas demais. É valor DERIVADO (como "tarefas" e "entrada_id"): não é coluna,
-- não é copiado para a cópia dos dados como dado do usuário (a restauração o ignora) e muda sozinho quando o calendário muda. As funções de leitura (listar, buscar, mover, salvar...) todas passam por demanda_json.

-- O retorno de UMA demanda, com a mesma regra de retorno_setor_data (a da rotina diária) e o texto de explicação do vencimento (ajustar_prazo). Lê os dias do usuário que chama (RLS).
create or replace function public.retorno_setor_info(d public.demandas) returns jsonb language plpgsql stable set search_path = '' as $$
declare v_base date; v_origem text; v_original date; v_aj jsonb;
begin
  if d.etapa <> 'Aguardando retorno' or d.arquivada_em is not null then return null; end if;
  if d.encaminhada_em is null and d.reiterada_em is null then v_base := (d.etapa_desde at time zone 'America/Sao_Paulo')::date; v_origem := 'entrada na etapa';
  elsif d.reiterada_em is not null and (d.encaminhada_em is null or d.reiterada_em > d.encaminhada_em) then v_base := d.reiterada_em; v_origem := 'reiteração';
  else v_base := d.encaminhada_em; v_origem := 'encaminhamento'; end if;
  v_original := v_base + 10;
  v_aj := public.ajustar_prazo(v_original);
  return jsonb_build_object('data', v_aj -> 'prazo', 'original', v_original, 'base', v_base, 'origem', v_origem, 'ajuste', v_aj -> 'ajuste');
end $$;
revoke all on function public.retorno_setor_info(public.demandas) from public, anon, authenticated;
grant execute on function public.retorno_setor_info(public.demandas) to authenticated;

create or replace function public.demanda_json(p_id uuid) returns jsonb language sql stable set search_path = '' as $$
  select (to_jsonb(d) - 'user_id') || jsonb_build_object('entrada_id', (select e.id from public.entradas e where e.demanda_id = d.id), 'retorno', public.retorno_setor_info(d), 'tarefas', coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'texto', t.texto, 'concluida', t.concluida, 'posicao', t.posicao) order by t.posicao, t.criado_em)
    from public.tarefas t where t.demanda_id = d.id), '[]'::jsonb))
  from public.demandas d where d.id = p_id
$$;
