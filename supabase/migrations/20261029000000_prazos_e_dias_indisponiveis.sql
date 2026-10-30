-- Dmanda: cadastro guiado, prazo original e prazo ajustado, dias indisponíveis (feriados e eventos externos de dia inteiro).
-- Migração aditiva: nenhuma migração anterior é reescrita, nenhuma linha existente perde dado e as funções mantêm as assinaturas
-- (o aplicativo antigo, ainda publicado durante a implantação, continua funcionando: veja "compatibilidade" abaixo).
--
-- Regras (DECISOES.md, decisão 27):
--  * numero e origem passam a aceitar vazio (nada de "s/n" nem "Não informada" inventados) e chegou_em passa a aceitar nulo. As linhas que já existem ficam como estão.
--  * prazo_original é a data escolhida (à mão ou calculada pelos botões de 5, 10, 20 e 30 dias a partir de hoje, excluindo o dia inicial e incluindo o último).
--    prazo é o vencimento AJUSTADO: se a data original cai em sábado, domingo, feriado ou evento externo de dia inteiro, antecipa sucessivamente até o primeiro dia
--    disponível anterior. Todas as telas, filtros, ordenações, indicadores e a rotina diária continuam lendo "prazo" (agora o ajustado).
--  * prazo_dias e prazo_base_em guardam a referência da contagem (quantos dias e a partir de que dia), para a alteração do calendário nunca refazer a conta a partir de um novo "hoje".
--  * prazo_ajuste explica o ajuste em texto (dias pulados e o motivo de cada um). prazo_legado marca o prazo que já existia antes desta migração: o prazo atual vira a
--    referência original, sem reconstruir datas nem quantidades de dias que nunca foram guardadas.
--  * Cadastrar, alterar ou remover um dia indisponível recalcula, na mesma transação, o vencimento das demandas não finalizadas que o dia afeta (nunca passa do original;
--    pode voltar ao original se a restrição sair). Demandas finalizadas não mudam; ao reabrir, vale o calendário daquele momento.
--  * O recálculo mexe só nas colunas de prazo e sobe a versão da demanda (gatilho existente), então uma janela de edição aberta com o prazo antigo é recusada (DM409) em vez de
--    sobrescrever o vencimento novo.
--  * criar_demanda aceita um identificador gerado pelo aplicativo: repetir a chamada (resposta perdida, clique duplo) devolve a mesma demanda em vez de criar outra.
--
-- Compatibilidade com o aplicativo antigo durante a implantação: criar_demanda e atualizar_demanda continuam aceitando a chave "prazo" (tratada como data original; se
-- vier igual ao vencimento ajustado atual, é só o eco do formulário antigo e não muda nada). A leitura devolve campos novos, que o aplicativo antigo ignora.

-- ---------- 1) campos opcionais ----------
alter table public.demandas alter column chegou_em drop not null;
alter table public.demandas alter column chegou_em drop default;
alter table public.demandas alter column numero set default '';
alter table public.demandas alter column origem set default '';

-- ---------- 2) colunas do prazo ----------
alter table public.demandas
  add column prazo_original date,
  add column prazo_dias integer check (prazo_dias is null or prazo_dias between 1 and 365),
  add column prazo_base_em date,
  add column prazo_ajuste text,
  add column prazo_legado boolean not null default false;

-- Os prazos que já existem viram a referência original (legado). Os gatilhos ficam desligados só dentro desta transação, para não alterar
-- atualizado_em nem a versão de ninguém: o histórico é preservado exatamente como estava.
alter table public.demandas disable trigger demandas_atualizado;
alter table public.demandas disable trigger demandas_versao;
update public.demandas set prazo_original = prazo, prazo_legado = true where prazo is not null;
alter table public.demandas enable trigger demandas_atualizado;
alter table public.demandas enable trigger demandas_versao;

alter table public.demandas add constraint demandas_prazo_com_original check ((prazo is null) = (prazo_original is null));

-- ---------- 3) dias indisponíveis ----------
create table public.dias_indisponiveis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 160),
  categoria text not null check (categoria in ('Feriado', 'Evento externo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index dias_indisponiveis_usuario_data on public.dias_indisponiveis (user_id, data);
create trigger dias_indisponiveis_atualizado before update on public.dias_indisponiveis for each row execute function public.tocar_atualizado_em();
alter table public.dias_indisponiveis enable row level security;
create policy dias_indisponiveis_dono on public.dias_indisponiveis for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.dias_indisponiveis from public, anon, authenticated;
grant select, insert, update, delete on public.dias_indisponiveis to authenticated;

-- ---------- 4) o cálculo do vencimento ajustado ----------
-- Do dia original para trás, até o primeiro dia disponível (nem sábado, nem domingo, nem dia cadastrado). Devolve o prazo e o texto que explica cada dia pulado,
-- por exemplo "21/11 sábado; 20/11 feriado: Consciência Negra". Lê os dias do usuário que chama (RLS). O texto é montado do mesmo jeito em src/lib/prazos.ts.
create or replace function public.ajustar_prazo(p_original date) returns jsonb language plpgsql stable set search_path = '' as $$
declare d date := p_original; pulados text[] := '{}'; razoes text[]; n integer := 0;
begin
  if p_original is null then return null; end if;
  loop
    n := n + 1;
    if n > 400 then perform public.erro_dmanda('Não há dia disponível nos 400 dias anteriores a essa data. Confira os dias indisponíveis cadastrados.'); end if;
    razoes := array_remove(array[case extract(isodow from d)::integer when 6 then 'sábado' when 7 then 'domingo' end], null)
      || coalesce((select array_agg(lower(c.categoria) || ': ' || btrim(c.descricao) order by c.criado_em, c.id) from public.dias_indisponiveis c where c.data = d), '{}');
    exit when cardinality(razoes) = 0;
    pulados := pulados || (to_char(d, 'DD/MM') || ' ' || array_to_string(razoes, ', '));
    d := d - 1;
  end loop;
  return jsonb_build_object('prazo', d, 'ajuste', case when cardinality(pulados) = 0 then null else array_to_string(pulados, '; ') end);
end $$;

-- Recalcula uma demanda (usado ao reabrir) e as demandas afetadas por datas de calendário que mudaram. Afetada: não finalizada e a data mudada cai entre o
-- vencimento atual e o prazo original (inclusive), ou seja, a conta passa por aquele dia. Só grava se algo mudou (sem versões à toa). Devolve quantas mudaram.
create or replace function public.recalcular_prazo_demanda(p_id uuid) returns integer language plpgsql set search_path = '' as $$
declare r public.demandas; a jsonb;
begin
  select * into r from public.demandas where id = p_id for update;
  if not found or r.prazo_original is null then return 0; end if;
  a := public.ajustar_prazo(r.prazo_original);
  if (a ->> 'prazo')::date is distinct from r.prazo or (a ->> 'ajuste') is distinct from r.prazo_ajuste then
    update public.demandas set prazo = (a ->> 'prazo')::date, prazo_ajuste = a ->> 'ajuste' where id = p_id;
    return 1;
  end if;
  return 0;
end $$;

create or replace function public.recalcular_prazos(p_datas date[]) returns integer language plpgsql set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in
    select d.id from public.demandas d
    where d.etapa <> 'Finalizado' and d.prazo_original is not null
      and exists (select 1 from unnest(p_datas) x where x between least(d.prazo, d.prazo_original) and greatest(d.prazo, d.prazo_original))
    order by d.id
  loop
    n := n + public.recalcular_prazo_demanda(r.id);
  end loop;
  return n;
end $$;

-- ---------- 5) cadastro dos dias indisponíveis ----------
create or replace function public.dia_indisponivel_json(p_id uuid) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'data', c.data, 'descricao', c.descricao, 'categoria', c.categoria, 'criado_em', c.criado_em) from public.dias_indisponiveis c where c.id = p_id
$$;

create or replace function public.listar_dias_indisponiveis() returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.dia_indisponivel_json(c.id) order by c.data, c.criado_em, c.id), '[]'::jsonb) from public.dias_indisponiveis c
$$;

-- Cria (sem "id") ou altera (com "id") um dia. Devolve o dia e quantas demandas tiveram o vencimento recalculado.
create or replace function public.salvar_dia_indisponivel(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_data date; v_antiga date; v_desc text := btrim(coalesce(p ->> 'descricao', '')); v_cat text := p ->> 'categoria'; n integer;
begin
  if coalesce(p ->> 'data', '') = '' then perform public.erro_dmanda('Informe a data.'); end if;
  v_data := (p ->> 'data')::date;
  if length(v_desc) = 0 then perform public.erro_dmanda('Descreva o dia, por exemplo: Natal.'); end if;
  if length(v_desc) > 160 then perform public.erro_dmanda('A descrição passa de 160 caracteres.'); end if;
  if v_cat is null or v_cat not in ('Feriado', 'Evento externo') then perform public.erro_dmanda('Escolha Feriado ou Evento externo de dia inteiro.'); end if;
  if v_id is null then
    insert into public.dias_indisponiveis (data, descricao, categoria) values (v_data, v_desc, v_cat) returning id into v_id;
    n := public.recalcular_prazos(array[v_data]);
  else
    select data into v_antiga from public.dias_indisponiveis where id = v_id for update;
    if not found then perform public.erro_dmanda('Dia não encontrado.'); end if;
    update public.dias_indisponiveis set data = v_data, descricao = v_desc, categoria = v_cat where id = v_id;
    n := public.recalcular_prazos(array[v_antiga, v_data]);
  end if;
  return jsonb_build_object('dia', public.dia_indisponivel_json(v_id), 'recalculadas', n);
end $$;

create or replace function public.excluir_dia_indisponivel(p_id uuid) returns jsonb language plpgsql set search_path = '' as $$
declare v_data date; n integer;
begin
  delete from public.dias_indisponiveis where id = p_id returning data into v_data;
  if v_data is null then perform public.erro_dmanda('Dia não encontrado.'); end if;
  n := public.recalcular_prazos(array[v_data]);
  return jsonb_build_object('id', p_id, 'excluido', true, 'recalculadas', n);
end $$;

-- ---------- 6) criar e atualizar demandas com o prazo novo ----------
create or replace function public.criar_demanda(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_etapa text := coalesce(nullif(p ->> 'etapa', ''), 'Cadastro'); v_tipo text := coalesce(nullif(p ->> 'tipo', ''), 'Processo');
        v_area text := coalesce(nullif(p ->> 'area', ''), 'Geral'); v_dias integer := nullif(p ->> 'prazo_dias', '')::integer; v_base date; v_orig date; v_aj jsonb;
begin
  if length(btrim(coalesce(p ->> 'assunto', ''))) = 0 then perform public.erro_dmanda('Informe o assunto da demanda.'); end if;
  if v_etapa = 'Finalizado' then perform public.erro_dmanda('Uma demanda nova não nasce finalizada. Cadastre e depois conclua.'); end if;
  if v_tipo = 'Protocolo' and v_area = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
  -- repetir a chamada com o mesmo identificador (resposta perdida, clique duplo) devolve a demanda que já existe
  if v_id is not null and exists (select 1 from public.demandas where id = v_id) then return public.demanda_json(v_id); end if;
  if v_dias is not null then v_base := public.hoje(); v_orig := v_base + v_dias;
  else v_orig := nullif(coalesce(p ->> 'prazo_original', p ->> 'prazo'), '')::date; end if;
  v_aj := public.ajustar_prazo(v_orig);
  insert into public.demandas (id, tipo, area, numero, assunto, descricao, origem, etapa, chegou_em, prazo, prazo_original, prazo_dias, prazo_base_em, prazo_ajuste, prazo_tipo, setor, acompanhar_em)
  values (coalesce(v_id, gen_random_uuid()), v_tipo, v_area, coalesce(btrim(p ->> 'numero'), ''), btrim(p ->> 'assunto'), coalesce(p ->> 'descricao', ''), coalesce(btrim(p ->> 'origem'), ''),
          v_etapa, nullif(p ->> 'chegou_em', '')::date, (v_aj ->> 'prazo')::date, v_orig, v_dias, v_base, v_aj ->> 'ajuste', coalesce(nullif(p ->> 'prazo_tipo', ''), 'Próprio'),
          nullif(btrim(coalesce(p ->> 'setor', '')), ''), nullif(p ->> 'acompanhar_em', '')::date)
  returning id into v_id;
  return public.demanda_json(v_id);
end $$;

create or replace function public.atualizar_demanda(p_id uuid, p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas; v_tem boolean := false; v_dias integer; v_base date; v_orig date; v_aj jsonb; v_legado boolean;
begin
  select * into d from public.demandas where id = p_id for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  if p ? 'assunto' and length(btrim(coalesce(p ->> 'assunto', ''))) = 0 then perform public.erro_dmanda('O assunto não pode ficar vazio.'); end if;
  if coalesce(p ->> 'tipo', d.tipo) = 'Protocolo' and coalesce(p ->> 'area', d.area) = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
  v_base := d.prazo_base_em; v_dias := d.prazo_dias; v_orig := d.prazo_original; v_legado := d.prazo_legado;
  if p ? 'prazo_original' or nullif(p ->> 'prazo_dias', '') is not null then
    v_tem := true;
    v_dias := nullif(p ->> 'prazo_dias', '')::integer;
    if v_dias is not null then v_base := public.hoje(); v_orig := v_base + v_dias;
    else
      v_orig := nullif(p ->> 'prazo_original', '')::date;
      -- a mesma data de antes mantém a referência da contagem (dias e dia de partida)
      if v_orig is not distinct from d.prazo_original then v_dias := d.prazo_dias; v_base := d.prazo_base_em; else v_base := null; end if;
    end if;
  elsif p ? 'prazo' then
    -- aplicativo antigo: o formulário devolve o vencimento atual a cada gravação; igual ao que já está, não muda nada
    if nullif(p ->> 'prazo', '')::date is distinct from d.prazo then
      v_tem := true; v_orig := nullif(p ->> 'prazo', '')::date; v_dias := null; v_base := null;
    end if;
  end if;
  if v_tem then
    v_aj := public.ajustar_prazo(v_orig);
    if v_orig is distinct from d.prazo_original then v_legado := false; end if;
  end if;
  update public.demandas set
    assunto = case when p ? 'assunto' then btrim(p ->> 'assunto') else assunto end,
    numero = case when p ? 'numero' then coalesce(btrim(p ->> 'numero'), '') else numero end,
    origem = case when p ? 'origem' then coalesce(btrim(p ->> 'origem'), '') else origem end,
    descricao = case when p ? 'descricao' then coalesce(p ->> 'descricao', '') else descricao end,
    tipo = case when p ? 'tipo' then p ->> 'tipo' else tipo end,
    area = case when p ? 'area' then p ->> 'area' else area end,
    chegou_em = case when p ? 'chegou_em' then nullif(p ->> 'chegou_em', '')::date else chegou_em end,
    prazo = case when v_tem then (v_aj ->> 'prazo')::date else prazo end,
    prazo_original = case when v_tem then v_orig else prazo_original end,
    prazo_dias = case when v_tem then v_dias else prazo_dias end,
    prazo_base_em = case when v_tem then v_base else prazo_base_em end,
    prazo_ajuste = case when v_tem then v_aj ->> 'ajuste' else prazo_ajuste end,
    prazo_legado = case when v_tem then v_legado else prazo_legado end,
    prazo_tipo = case when p ? 'prazo_tipo' then p ->> 'prazo_tipo' else prazo_tipo end,
    setor = case when p ? 'setor' then nullif(btrim(coalesce(p ->> 'setor', '')), '') else setor end,
    acompanhar_em = case when p ? 'acompanhar_em' then nullif(p ->> 'acompanhar_em', '')::date else acompanhar_em end
  where id = p_id;
  return public.demanda_json(p_id);
end $$;

-- Mesma regra de etapa de sempre; a única novidade é que sair de Finalizado (reabrir) recalcula o vencimento com o calendário de agora.
create or replace function public.mover_etapa(p_id uuid, p_etapa text) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas;
begin
  if p_etapa not in ('Cadastro','Vistos','Fazendo','Aguardando retorno','Finalizado') then perform public.erro_dmanda('Etapa desconhecida.'); end if;
  select * into d from public.demandas where id = p_id for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  if d.arquivada_em is not null then perform public.erro_dmanda('Demanda arquivada. Desarquive antes de mover.'); end if;
  if d.etapa = p_etapa then return public.demanda_json(p_id); end if;
  if p_etapa = 'Finalizado' then
    update public.tarefas set concluida = true where demanda_id = p_id and not concluida;   -- concluir marca todas as tarefas
    update public.demandas set etapa = 'Finalizado', concluida_em = public.hoje(), etapa_desde = now() where id = p_id;
  else
    -- sair de Finalizado é reabrir: mantém as tarefas como estão, limpa só a data de conclusão e confere o vencimento no calendário vigente
    update public.demandas set etapa = p_etapa, concluida_em = null, etapa_desde = now() where id = p_id;
    if d.etapa = 'Finalizado' then perform public.recalcular_prazo_demanda(p_id); end if;
  end if;
  return public.demanda_json(p_id);
end $$;

-- ---------- 7) privilégios ----------
-- Funções novas nascem executáveis por qualquer papel: tira de todos e devolve só ao usuário logado (lista explícita, nunca "all functions").
revoke all on function
  public.ajustar_prazo(date), public.recalcular_prazo_demanda(uuid), public.recalcular_prazos(date[]), public.dia_indisponivel_json(uuid),
  public.listar_dias_indisponiveis(), public.salvar_dia_indisponivel(jsonb), public.excluir_dia_indisponivel(uuid)
  from public, anon, authenticated;
grant execute on function
  public.ajustar_prazo(date), public.recalcular_prazo_demanda(uuid), public.recalcular_prazos(date[]), public.dia_indisponivel_json(uuid),
  public.listar_dias_indisponiveis(), public.salvar_dia_indisponivel(jsonb), public.excluir_dia_indisponivel(uuid)
  to authenticated;
