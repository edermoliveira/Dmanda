-- Dmanda: prazos por duração (5, 10, 20 e 30 dias) contados a partir da data de CHEGADA (decisão 81, etapa 4 de 6).
-- Migração aditiva e isolada: só substitui criar_demanda e atualizar_demanda (mesmas assinaturas, mesmos privilégios, mesma RLS por usuário). Nenhuma tabela, coluna, política
-- ou dado é alterado; nenhuma migração anterior é reescrita. Parte do esquema publicado (até 20261110000000) e da migração das quatro vagas, e não depende da de Pagamentos.
--
-- Regra (dias corridos, sem fuso: tudo em datas de calendário; "hoje" nunca entra na conta):
--  * Prazo por duração: prazo_original = chegou_em + prazo_dias. O dia da chegada não conta e o último dia conta. prazo_base_em passa a guardar a própria chegada.
--  * Sem data de chegada, pedir um prazo por duração é recusado com o texto "Informe a data de chegada para calcular o prazo de N dias." (o cadastro sem prazo segue possível).
--  * A duração fica "viva" quando prazo_base_em = chegou_em. Mudar a chegada de uma demanda com duração viva, sem informar prazo, recalcula o prazo original (e o vencimento,
--    pelo mesmo ajustar_prazo) a partir da nova chegada. Demanda finalizada nunca é recalculada sozinha (o histórico fica como está).
--  * Data escolhida à mão, prazo gravado pela regra anterior (contado de outro dia) e prazo sem chegada NÃO são recalculados: o vencimento registrado e o seu significado ficam.
--    Nenhuma duração é deduzida da diferença entre datas históricas.
--  * A antecipação (sábado, domingo, feriado ou dia indisponível: último dia disponível anterior) e o recálculo ao cadastrar, mudar ou excluir um dia indisponível seguem
--    exatamente os de antes (ajustar_prazo e recalcular_prazos, partindo sempre do prazo original). Os campos legados (prazo_tipo, prazo_legado) continuam sendo lidos e gravados.
--  * Não há backfill aqui: o que mudaria nos dados reais está só na comparação e na proposta reversível de scripts/comparar-prazos-legados.mjs e supabase/propostas/.
--
-- Compatibilidade: o aplicativo antigo publicado, ao pedir "10 dias" sem chegada, passa a receber a mensagem acima até o código novo entrar (aplicar a migração junto da publicação).

create or replace function public.criar_demanda(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_etapa text := coalesce(nullif(p ->> 'etapa', ''), 'Cadastro'); v_tipo text := nullif(btrim(coalesce(p ->> 'tipo', '')), '');
        v_area text := coalesce(nullif(p ->> 'area', ''), 'Geral'); v_dias integer := nullif(p ->> 'prazo_dias', '')::integer; v_cheg date := nullif(p ->> 'chegou_em', '')::date;
        v_base date; v_orig date; v_aj jsonb;
begin
  if length(btrim(coalesce(p ->> 'assunto', ''))) = 0 then perform public.erro_dmanda('Informe o assunto da demanda.'); end if;
  if v_etapa = 'Finalizado' then perform public.erro_dmanda('Uma demanda nova não nasce finalizada. Cadastre e depois conclua.'); end if;
  if v_tipo = 'Protocolo' and v_area = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
  -- repetir a chamada com o mesmo identificador (resposta perdida, clique duplo) devolve a demanda que já existe
  if v_id is not null and exists (select 1 from public.demandas where id = v_id) then return public.demanda_json(v_id); end if;
  if v_dias is not null then
    if v_cheg is null then perform public.erro_dmanda('Informe a data de chegada para calcular o prazo de ' || v_dias || ' dias.'); end if;
    v_base := v_cheg; v_orig := v_base + v_dias;
  else v_orig := nullif(coalesce(p ->> 'prazo_original', p ->> 'prazo'), '')::date; end if;
  v_aj := public.ajustar_prazo(v_orig);
  insert into public.demandas (id, tipo, area, numero, assunto, descricao, origem, etapa, chegou_em, prazo, prazo_original, prazo_dias, prazo_base_em, prazo_ajuste, prazo_tipo, setor, acompanhar_em, rapida, documento_ano)
  values (coalesce(v_id, gen_random_uuid()), v_tipo, v_area, coalesce(btrim(p ->> 'numero'), ''), btrim(p ->> 'assunto'), coalesce(p ->> 'descricao', ''), coalesce(btrim(p ->> 'origem'), ''),
          v_etapa, v_cheg, (v_aj ->> 'prazo')::date, v_orig, v_dias, v_base, v_aj ->> 'ajuste', coalesce(nullif(p ->> 'prazo_tipo', ''), 'Próprio'),
          nullif(btrim(coalesce(p ->> 'setor', '')), ''), nullif(p ->> 'acompanhar_em', '')::date, coalesce((p ->> 'rapida')::boolean, false), nullif(p ->> 'documento_ano', '')::smallint)
  returning id into v_id;
  return public.demanda_json(v_id);
end $$;

create or replace function public.atualizar_demanda(p_id uuid, p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas; v_tem boolean := false; v_dias integer; v_base date; v_orig date; v_aj jsonb; v_legado boolean; v_cheg date;
begin
  select * into d from public.demandas where id = p_id for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  if p ? 'assunto' and length(btrim(coalesce(p ->> 'assunto', ''))) = 0 then perform public.erro_dmanda('O assunto não pode ficar vazio.'); end if;
  if (case when p ? 'tipo' then nullif(btrim(coalesce(p ->> 'tipo', '')), '') else d.tipo end) = 'Protocolo' and coalesce(p ->> 'area', d.area) = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
  v_cheg := case when p ? 'chegou_em' then nullif(p ->> 'chegou_em', '')::date else d.chegou_em end;
  v_base := d.prazo_base_em; v_dias := d.prazo_dias; v_orig := d.prazo_original; v_legado := d.prazo_legado;
  if nullif(p ->> 'prazo_dias', '') is not null then
    -- duração escolhida agora: sempre a partir da chegada que ficará gravada (a enviada junto ou a que a demanda já tem)
    v_tem := true; v_dias := (p ->> 'prazo_dias')::integer;
    if v_cheg is null then perform public.erro_dmanda('Informe a data de chegada para calcular o prazo de ' || v_dias || ' dias.'); end if;
    v_base := v_cheg; v_orig := v_base + v_dias;
  elsif p ? 'prazo_original' then
    v_tem := true; v_orig := nullif(p ->> 'prazo_original', '')::date;
    -- a mesma data de antes mantém a referência da contagem (dias e dia de partida); outra data é uma data explícita
    if v_orig is not distinct from d.prazo_original then v_dias := d.prazo_dias; v_base := d.prazo_base_em; else v_dias := null; v_base := null; end if;
  elsif p ? 'prazo' then
    -- aplicativo antigo: o formulário devolve o vencimento atual a cada gravação; igual ao que já está, não muda nada
    if nullif(p ->> 'prazo', '')::date is distinct from d.prazo then
      v_tem := true; v_orig := nullif(p ->> 'prazo', '')::date; v_dias := null; v_base := null;
    end if;
  elsif v_cheg is distinct from d.chegou_em and v_cheg is not null and d.etapa <> 'Finalizado' and d.prazo_dias is not null and d.prazo_original is not null and d.prazo_base_em is not distinct from d.chegou_em then
    -- a chegada mudou numa demanda de duração viva e nenhum prazo veio junto: a duração é recontada a partir da nova chegada
    v_tem := true; v_base := v_cheg; v_orig := v_base + d.prazo_dias;
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
    tipo = case when p ? 'tipo' then nullif(btrim(coalesce(p ->> 'tipo', '')), '') else tipo end,
    area = case when p ? 'area' then p ->> 'area' else area end,
    chegou_em = v_cheg,
    prazo = case when v_tem then (v_aj ->> 'prazo')::date else prazo end,
    prazo_original = case when v_tem then v_orig else prazo_original end,
    prazo_dias = case when v_tem then v_dias else prazo_dias end,
    prazo_base_em = case when v_tem then v_base else prazo_base_em end,
    prazo_ajuste = case when v_tem then v_aj ->> 'ajuste' else prazo_ajuste end,
    prazo_legado = case when v_tem then v_legado else prazo_legado end,
    prazo_tipo = case when p ? 'prazo_tipo' then p ->> 'prazo_tipo' else prazo_tipo end,
    setor = case when p ? 'setor' then nullif(btrim(coalesce(p ->> 'setor', '')), '') else setor end,
    acompanhar_em = case when p ? 'acompanhar_em' then nullif(p ->> 'acompanhar_em', '')::date else acompanhar_em end,
    encaminhada_em = case when p ? 'encaminhada_em' then nullif(p ->> 'encaminhada_em', '')::date else encaminhada_em end,
    reiterada_em = case when p ? 'reiterada_em' then nullif(p ->> 'reiterada_em', '')::date else reiterada_em end,
    rapida = case when p ? 'rapida' then coalesce((p ->> 'rapida')::boolean, false) else rapida end,
    documento_ano = case when p ? 'documento_ano' then nullif(p ->> 'documento_ano', '')::smallint else documento_ano end
  where id = p_id;
  return public.demanda_json(p_id);
end $$;
