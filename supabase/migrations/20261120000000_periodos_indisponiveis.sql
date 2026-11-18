-- Dmanda: períodos de indisponibilidade (subbloco 1.4). Migração ADITIVA: não reescreve migração anterior, não toca em nenhum dado existente e não faz backfill.
--
-- O que muda:
--  1) Um período (curso de vários dias, semana de recesso, recesso que atravessa dezembro e janeiro) é gravado como UMA LINHA POR DIA em public.dias_indisponiveis, ligadas por
--     periodo_id (coluna nova, nula nos dias avulsos). Todo o resto continua igual: o cálculo do vencimento, o retorno do setor, a Agenda, a cópia versão 4 e a restauração leem a mesma lista de dias
--     de sempre. Um dia avulso continua sendo uma linha sem periodo_id (nada precisa ser migrado). CADA período é dono das suas linhas: se outro registro (um dia avulso ou outro período) já cobre a
--     mesma data, as duas linhas convivem. O cálculo usa a UNIÃO das datas (o motivo do ajuste lista cada motivo uma vez só), o intervalo do período fica íntegro (24/12 a 29/12 continua 24/12 a 29/12)
--     e excluir um registro nunca tira a indisponibilidade que outro ainda sustenta.
--  2) salvar_periodo_indisponivel grava (ou substitui, se o periodo_id já existe) todos os dias de uma vez, com o recálculo dos vencimentos na MESMA transação, sobre todas as datas tocadas.
--     Datas inicial e final inclusivas; máximo de 366 dias. excluir_periodo_indisponivel remove o período inteiro e recalcula.
--  3) IDENTIDADE DA OPERAÇÃO separada da identidade do período. Cada envio traz um operacao_id (gerado pela tela para aquela tentativa). A tabela periodos_operacoes guarda qual período aquela operação
--     criou ou alterou: repetir a MESMA operação (resposta perdida, clique duplo) devolve o resultado dela sem aplicar de novo; uma operação nova nunca altera um período por herdar a tentativa anterior.
--     conferir_periodo_por_operacao permite à tela conferir, depois de uma resposta perdida, se a operação foi aplicada. A conferência que NÃO encontra a operação a CANCELA (marca registrada de cancelamento): se o
--     pedido original ainda estiver a caminho ou atrasado e chegar depois, o banco o recusa em vez de gravá-lo. Assim, depois de "não foi gravado", corrigir o preenchimento e gravar de novo nunca duplica.
--  4) ajustar_prazo e retorno_setor_data deixam de parar em 400 dias. O limite antigo recusava (ajustar_prazo) ou devolvia, em silêncio, um dia que AINDA era indisponível (retorno_setor_data)
--     quando uma sequência indisponível passava de 400 dias. A busca para sozinha: a lista de dias é finita, então a sequência acaba no primeiro dia útil sem cadastro.
--  5) A lista de operações de executar_como_titular ganha as três funções novas (41 operações, com conferir_periodo_por_operacao). O corpo da função é o mesmo da migração 20261119000000, só com os nomes a mais.
--  6) dia_indisponivel_json passa a trazer periodo_id, só quando existe (um dia avulso devolve exatamente as mesmas chaves de antes: compatível com a cópia versão 4).

-- ---------- 1) a coluna de agrupamento ----------
alter table public.dias_indisponiveis add column periodo_id uuid;
create index dias_indisponiveis_periodo on public.dias_indisponiveis (periodo_id) where periodo_id is not null;

create or replace function public.dia_indisponivel_json(p_id uuid) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'data', c.data, 'descricao', c.descricao, 'categoria', c.categoria, 'criado_em', c.criado_em)
         || case when c.periodo_id is null then '{}'::jsonb else jsonb_build_object('periodo_id', c.periodo_id) end
  from public.dias_indisponiveis c where c.id = p_id
$$;

-- ---------- 2) o registro das operações (identidade da tentativa) ----------
-- Uma linha por operação: aplicada (com o periodo_id que criou ou alterou) ou CANCELADA (a conferência não a encontrou e a barrou: um pedido tardio com essa identidade é recusado). Não entra na cópia dos dados
-- (é controle de repetição, não dado do usuário) e acompanha o usuário (cascade).
create table public.periodos_operacoes (
  operacao_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  periodo_id uuid,
  cancelada boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint periodos_operacoes_estado check ((cancelada and periodo_id is null) or (not cancelada and periodo_id is not null))
);
alter table public.periodos_operacoes enable row level security;
create policy periodos_operacoes_dono on public.periodos_operacoes for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
revoke all on public.periodos_operacoes from public, anon, authenticated;
grant select, insert on public.periodos_operacoes to authenticated;

-- ---------- 3) o cálculo sem o limite fixo e com a união dos motivos ----------
-- Os motivos de um mesmo dia saem uma vez cada (dois registros "feriado: Natal" no mesmo dia são um motivo só), na ordem em que foram cadastrados.
create or replace function public.ajustar_prazo(p_original date) returns jsonb language plpgsql stable set search_path = '' as $$
declare d date := p_original; pulados text[] := '{}'; razoes text[];
begin
  if p_original is null then return null; end if;
  -- Termina sozinho: cada volta anda um dia para trás e só continua enquanto o dia é fim de semana ou está cadastrado; como os dias cadastrados são em número finito, a sequência acaba.
  loop
    razoes := array_remove(array[case extract(isodow from d)::integer when 6 then 'sábado' when 7 then 'domingo' end], null)
      || coalesce((select array_agg(x.r order by x.m, x.i) from (
           select lower(c.categoria) || ': ' || btrim(c.descricao) as r, min(c.criado_em) as m, min(c.id::text) as i
           from public.dias_indisponiveis c where c.data = d group by 1) x), '{}');
    exit when cardinality(razoes) = 0;
    pulados := pulados || (to_char(d, 'DD/MM') || ' ' || array_to_string(razoes, ', '));
    d := d - 1;
  end loop;
  return jsonb_build_object('prazo', d, 'ajuste', case when cardinality(pulados) = 0 then null else array_to_string(pulados, '; ') end);
end $$;

create or replace function public.retorno_setor_data(p_user uuid, p_encaminhada date, p_reiterada date, p_etapa_desde timestamptz) returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  v_base date := coalesce(greatest(p_encaminhada, p_reiterada), (p_etapa_desde at time zone 'America/Sao_Paulo')::date);
  v_dia date := v_base + 10;
begin
  -- mesma regra do vencimento, sem limite fixo (ver ajustar_prazo)
  while extract(isodow from v_dia) in (6, 7) or exists (select 1 from public.dias_indisponiveis c where c.user_id = p_user and c.data = v_dia) loop
    v_dia := v_dia - 1;
  end loop;
  return v_dia;
end $$;

-- ---------- 4) o cadastro de períodos ----------
-- p: { operacao_id (obrigatório: a identidade desta tentativa), periodo_id? (só para ALTERAR um período que existe), data_inicio, data_fim (inclusivas), descricao, categoria }.
--  * operacao_id já aplicada: devolve o resultado dela como está agora, sem aplicar de novo ("repetida": true).
--  * sem periodo_id: cria um período novo (o banco escolhe o periodo_id). Com periodo_id: substitui os dias daquele período (altera datas, descrição ou tipo); se ele não existe mais, recusa.
--  * nenhum dia é pulado nem atribuído a outro registro: o período grava todos os seus dias, mesmo onde já há outro registro na data.
-- Devolve o período (periodo_id e os dias), quantas demandas tiveram o vencimento recalculado e se a operação era repetida.
create or replace function public.salvar_periodo_indisponivel(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_op uuid := nullif(p ->> 'operacao_id', '')::uuid; v_pid uuid := nullif(p ->> 'periodo_id', '')::uuid; v_ini date; v_fim date;
  v_desc text := btrim(coalesce(p ->> 'descricao', '')); v_cat text := p ->> 'categoria'; v_antigas date[]; v_novas date[]; v_anterior uuid; v_cancelada boolean; n integer;
begin
  if v_op is null then perform public.erro_dmanda('Identificador da operação não informado.'); end if;
  perform pg_advisory_xact_lock(hashtext(v_op::text));   -- dois envios simultâneos da mesma operação (clique duplo, aba repetida) esperam um ao outro
  select o.periodo_id, o.cancelada into v_anterior, v_cancelada from public.periodos_operacoes o where o.operacao_id = v_op;
  if found then
    if v_cancelada then perform public.erro_dmanda('Esta tentativa foi cancelada depois de uma conferência que não a encontrou. Nada foi gravado: salve o período de novo.'); end if;
    return jsonb_build_object('periodo_id', v_anterior, 'dias', public.dias_do_periodo(v_anterior), 'recalculadas', 0, 'repetida', true);
  end if;
  if coalesce(p ->> 'data_inicio', '') = '' then perform public.erro_dmanda('Informe a data inicial.'); end if;
  if coalesce(p ->> 'data_fim', '') = '' then perform public.erro_dmanda('Informe a data final.'); end if;
  v_ini := (p ->> 'data_inicio')::date; v_fim := (p ->> 'data_fim')::date;
  if v_fim < v_ini then perform public.erro_dmanda('A data final não pode ser anterior à data inicial.'); end if;
  if v_fim - v_ini + 1 > 366 then perform public.erro_dmanda('O período passa de 366 dias. Cadastre em mais de um período.'); end if;
  if length(v_desc) = 0 then perform public.erro_dmanda('Descreva o período, por exemplo: Recesso de fim de ano.'); end if;
  if length(v_desc) > 160 then perform public.erro_dmanda('A descrição passa de 160 caracteres.'); end if;
  if v_cat is null or v_cat not in ('Feriado', 'Evento externo') then perform public.erro_dmanda('Escolha Feriado ou Evento externo de dia inteiro.'); end if;

  if v_pid is null then
    v_pid := gen_random_uuid(); v_antigas := '{}';
  else
    perform pg_advisory_xact_lock(hashtext(v_pid::text));
    select coalesce(array_agg(c.data), '{}') into v_antigas from public.dias_indisponiveis c where c.periodo_id = v_pid;
    if cardinality(v_antigas) = 0 then perform public.erro_dmanda('Período não encontrado. Ele pode ter sido excluído em outro aparelho: atualize a lista.'); end if;
    delete from public.dias_indisponiveis where periodo_id = v_pid;
  end if;
  insert into public.dias_indisponiveis (data, descricao, categoria, periodo_id)
    select g::date, v_desc, v_cat, v_pid from generate_series(v_ini, v_fim, interval '1 day') g;
  insert into public.periodos_operacoes (operacao_id, periodo_id) values (v_op, v_pid);
  select coalesce(array_agg(g::date), '{}') into v_novas from generate_series(v_ini, v_fim, interval '1 day') g;
  n := public.recalcular_prazos(v_antigas || v_novas);
  return jsonb_build_object('periodo_id', v_pid, 'dias', public.dias_do_periodo(v_pid), 'recalculadas', n, 'repetida', false);
end $$;

-- Os dias de um período, na ordem das datas (vazio se o período foi excluído).
create or replace function public.dias_do_periodo(p_periodo uuid) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.dia_indisponivel_json(c.id) order by c.data, c.id), '[]'::jsonb) from public.dias_indisponiveis c where c.periodo_id = p_periodo
$$;

-- Conferência depois de uma resposta perdida: a operação foi aplicada? Devolve { encontrada, cancelada, periodo_id, dias } (dias vazio quando o período foi excluído depois).
-- Usa o MESMO bloqueio de salvar_periodo_indisponivel: ou a gravação termina antes (e a conferência a encontra) ou a conferência vem antes, não encontra e CANCELA a operação (um pedido atrasado com essa
-- identidade será recusado). Não há resposta "ainda não" que deixe a operação aberta.
create or replace function public.conferir_periodo_por_operacao(p_operacao uuid) returns jsonb language plpgsql set search_path = '' as $$
declare v_pid uuid; v_cancelada boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_operacao::text));
  select o.periodo_id, o.cancelada into v_pid, v_cancelada from public.periodos_operacoes o where o.operacao_id = p_operacao;
  if not found then
    insert into public.periodos_operacoes (operacao_id, periodo_id, cancelada) values (p_operacao, null, true);
    return jsonb_build_object('encontrada', false, 'cancelada', true, 'periodo_id', null, 'dias', '[]'::jsonb);
  end if;
  if v_cancelada then return jsonb_build_object('encontrada', false, 'cancelada', true, 'periodo_id', null, 'dias', '[]'::jsonb); end if;
  return jsonb_build_object('encontrada', true, 'cancelada', false, 'periodo_id', v_pid, 'dias', public.dias_do_periodo(v_pid));
end $$;

create or replace function public.excluir_periodo_indisponivel(p_periodo uuid) returns jsonb language plpgsql set search_path = '' as $$
declare v_datas date[]; n integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_periodo::text));   -- o mesmo bloqueio da alteração do período: excluir e alterar o mesmo período ao mesmo tempo esperam um ao outro
  select coalesce(array_agg(c.data), '{}') into v_datas from public.dias_indisponiveis c where c.periodo_id = p_periodo;
  if cardinality(v_datas) = 0 then perform public.erro_dmanda('Período não encontrado.'); end if;
  delete from public.dias_indisponiveis where periodo_id = p_periodo;
  n := public.recalcular_prazos(v_datas);
  return jsonb_build_object('periodo_id', p_periodo, 'excluido', true, 'dias', cardinality(v_datas), 'recalculadas', n);
end $$;

revoke all on function public.salvar_periodo_indisponivel(jsonb), public.excluir_periodo_indisponivel(uuid), public.dias_do_periodo(uuid), public.conferir_periodo_por_operacao(uuid)
  from public, anon, authenticated;
grant execute on function public.salvar_periodo_indisponivel(jsonb), public.excluir_periodo_indisponivel(uuid), public.dias_do_periodo(uuid), public.conferir_periodo_por_operacao(uuid)
  to authenticated;

-- ---------- 5) a lista de operações da entrada direta ----------
create or replace function public.executar_como_titular(p_funcao text, p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  -- exatamente as operações que o aplicativo chama (src/nucleo/operacoes.ts e src/servidor/demandas.ts); atualizar esta lista é parte de criar uma operação nova
  v_permitidas constant text[] := array[
    'adicionar_tarefa', 'arquivar_demanda', 'arquivar_entrada', 'atualizar_para_hoje', 'buscar_demanda', 'buscar_entrada', 'buscar_evento', 'concluir_demanda', 'conferir_periodo_por_operacao', 'criar_demanda',
    'criar_demanda_de_entrada', 'criar_entrada', 'criar_evento', 'criar_opcao', 'desarquivar_demanda', 'desarquivar_entrada', 'editar_tarefa', 'estado_rotina', 'excluir_demanda',
    'excluir_dia_indisponivel', 'excluir_entrada', 'excluir_evento', 'excluir_periodo_indisponivel', 'excluir_tarefa', 'fixar_entrada', 'listar_demandas', 'listar_dias_indisponiveis', 'listar_entradas',
    'listar_eventos', 'listar_opcoes', 'listar_para_hoje', 'listar_registros_dia', 'marcar_tarefa', 'mover_etapa', 'reabrir_demanda', 'registrar_dias', 'salvar_demanda',
    'salvar_dia_indisponivel', 'salvar_entrada', 'salvar_evento', 'salvar_periodo_indisponivel'];
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
  v_oid oid; v_n int; v_parametros text; v_resultado jsonb;
begin
  if p_funcao is null or not (p_funcao = any (v_permitidas)) then raise exception 'Operação não permitida.' using errcode = 'P0001'; end if;
  if jsonb_typeof(v_args) <> 'object' then raise exception 'Argumentos inválidos.' using errcode = 'P0001'; end if;
  select count(*) into v_n from pg_catalog.pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_funcao;
  if v_n <> 1 then raise exception 'Operação indisponível.' using errcode = 'P0001'; end if;
  select p.oid into v_oid from pg_catalog.pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_funcao;
  -- os argumentos são parâmetros nomeados da função: o nome tem de existir na assinatura, o tipo vem do catálogo e o valor entra como literal (nunca como SQL)
  select string_agg(format('%I => %L::%s', a.nome, case when a.tipo::regtype in ('jsonb'::regtype, 'json'::regtype) then k.value::text else k.value #>> '{}' end, a.tipo::regtype::text), ', ' order by a.nome), count(*)
    into v_parametros, v_n
    from jsonb_each(v_args) k
    join (select x.nome, x.tipo from pg_catalog.pg_proc p, unnest(p.proargnames, string_to_array(p.proargtypes::text, ' ')::oid[]) as x(nome, tipo) where p.oid = v_oid) a on a.nome = k.key;
  if v_n <> (select count(*) from jsonb_object_keys(v_args)) then raise exception 'Argumento desconhecido para a operação.' using errcode = 'P0001'; end if;
  perform public.assumir_titular();
  set local role authenticated;
  execute format('select public.%I(%s)', p_funcao, coalesce(v_parametros, '')) into v_resultado;
  return v_resultado;
end $$;
