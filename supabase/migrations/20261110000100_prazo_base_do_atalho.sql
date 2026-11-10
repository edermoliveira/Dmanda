-- Prazo pelos botões de 5, 10, 20 e 30 dias: a data-base é o dia em que o botão foi escolhido (decisão 31, esclarecida em 10/11/2026). Aditiva: nenhuma migração anterior é reescrita,
-- nenhuma linha existente é alterada e nenhum privilégio muda (create or replace mantém os privilégios das funções).
--   * Falha corrigida: a tela mostra "N dias a partir do dia do clique" (a data original vai junto com prazo_dias), mas criar_demanda e atualizar_demanda ignoravam a data enviada e
--     recalculavam hoje + N na hora de gravar. Um rascunho aberto no dia seguinte (ou o clique feito antes da meia-noite e a gravação depois) gravava uma data DIFERENTE da exibida.
--   * Agora as duas funções aceitam, junto com prazo_dias, o campo opcional prazo_base_em (AAAA-MM-DD): a base passa a ser a informada e o prazo original é base + dias. Regras:
--       - base no futuro (depois de hoje em America/Sao_Paulo, public.hoje()) é recusada; NÃO há limite de antiguidade: a base de um rascunho antigo e válido é preservada;
--       - base sem prazo_dias é recusada (a base só existe junto com o atalho);
--       - se a tela também enviar prazo_original, ele precisa ser exatamente base + dias, senão tudo é recusado (a data exibida e a gravada nunca divergem);
--       - sem prazo_base_em o comportamento é o de sempre (base = hoje), então telas antigas e a própria migração 20 continuam funcionando.
--   * O vencimento ajustado (prazo) segue vindo de public.ajustar_prazo(prazo_original): feriados e fins de semana continuam antecipando o vencimento.
--   * Corpo idêntico ao da migração 20261110000000 fora das linhas marcadas com "-- base do atalho".
--   * PRÉ-REQUISITO DE PUBLICAÇÃO: o código novo da tela só é seguro com esta migração aplicada. Com o banco antigo, a tela envia a base e o banco a ignora, podendo gravar um
--     prazo diferente do exibido. Ordem futura: db push --dry-run, aplicar esta migração, conferir, e só então publicar o código.

create or replace function public.criar_demanda(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_etapa text := coalesce(nullif(p ->> 'etapa', ''), 'Cadastro'); v_tipo text := nullif(btrim(coalesce(p ->> 'tipo', '')), '');
        v_area text := coalesce(nullif(p ->> 'area', ''), 'Geral'); v_dias integer := nullif(p ->> 'prazo_dias', '')::integer; v_base date; v_orig date; v_aj jsonb;
        v_base_in date := nullif(p ->> 'prazo_base_em', '')::date; -- base do atalho
begin
  if length(btrim(coalesce(p ->> 'assunto', ''))) = 0 then perform public.erro_dmanda('Informe o assunto da demanda.'); end if;
  if v_etapa = 'Finalizado' then perform public.erro_dmanda('Uma demanda nova não nasce finalizada. Cadastre e depois conclua.'); end if;
  if v_tipo = 'Protocolo' and v_area = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
  -- repetir a chamada com o mesmo identificador (resposta perdida, clique duplo) devolve a demanda que já existe
  if v_id is not null and exists (select 1 from public.demandas where id = v_id) then return public.demanda_json(v_id); end if;
  if v_base_in is not null and v_dias is null then perform public.erro_dmanda('A data-base do prazo só vale junto com a quantidade de dias.'); end if; -- base do atalho
  if v_dias is not null then
    if v_base_in is not null and v_base_in > public.hoje() then perform public.erro_dmanda('A data-base do prazo não pode estar no futuro.'); end if; -- base do atalho
    v_base := coalesce(v_base_in, public.hoje()); v_orig := v_base + v_dias; -- base do atalho
    if v_base_in is not null and nullif(p ->> 'prazo_original', '') is not null and (p ->> 'prazo_original')::date <> v_orig then perform public.erro_dmanda('O prazo não confere com a data-base e a quantidade de dias.'); end if; -- base do atalho
  else v_orig := nullif(coalesce(p ->> 'prazo_original', p ->> 'prazo'), '')::date; end if;
  v_aj := public.ajustar_prazo(v_orig);
  insert into public.demandas (id, tipo, area, numero, assunto, descricao, origem, etapa, chegou_em, prazo, prazo_original, prazo_dias, prazo_base_em, prazo_ajuste, prazo_tipo, setor, acompanhar_em, rapida, documento_ano)
  values (coalesce(v_id, gen_random_uuid()), v_tipo, v_area, coalesce(btrim(p ->> 'numero'), ''), btrim(p ->> 'assunto'), coalesce(p ->> 'descricao', ''), coalesce(btrim(p ->> 'origem'), ''),
          v_etapa, nullif(p ->> 'chegou_em', '')::date, (v_aj ->> 'prazo')::date, v_orig, v_dias, v_base, v_aj ->> 'ajuste', coalesce(nullif(p ->> 'prazo_tipo', ''), 'Próprio'),
          nullif(btrim(coalesce(p ->> 'setor', '')), ''), nullif(p ->> 'acompanhar_em', '')::date, coalesce((p ->> 'rapida')::boolean, false), nullif(p ->> 'documento_ano', '')::smallint)
  returning id into v_id;
  return public.demanda_json(v_id);
end $$;

create or replace function public.atualizar_demanda(p_id uuid, p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas; v_tem boolean := false; v_dias integer; v_base date; v_orig date; v_aj jsonb; v_legado boolean;
        v_base_in date := nullif(p ->> 'prazo_base_em', '')::date; -- base do atalho
begin
  select * into d from public.demandas where id = p_id for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  if p ? 'assunto' and length(btrim(coalesce(p ->> 'assunto', ''))) = 0 then perform public.erro_dmanda('O assunto não pode ficar vazio.'); end if;
  if (case when p ? 'tipo' then nullif(btrim(coalesce(p ->> 'tipo', '')), '') else d.tipo end) = 'Protocolo' and coalesce(p ->> 'area', d.area) = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
  v_base := d.prazo_base_em; v_dias := d.prazo_dias; v_orig := d.prazo_original; v_legado := d.prazo_legado;
  if v_base_in is not null and nullif(p ->> 'prazo_dias', '') is null then perform public.erro_dmanda('A data-base do prazo só vale junto com a quantidade de dias.'); end if; -- base do atalho
  if p ? 'prazo_original' or nullif(p ->> 'prazo_dias', '') is not null then
    v_tem := true;
    v_dias := nullif(p ->> 'prazo_dias', '')::integer;
    if v_dias is not null then
      if v_base_in is not null and v_base_in > public.hoje() then perform public.erro_dmanda('A data-base do prazo não pode estar no futuro.'); end if; -- base do atalho
      v_base := coalesce(v_base_in, public.hoje()); v_orig := v_base + v_dias; -- base do atalho
      if v_base_in is not null and nullif(p ->> 'prazo_original', '') is not null and (p ->> 'prazo_original')::date <> v_orig then perform public.erro_dmanda('O prazo não confere com a data-base e a quantidade de dias.'); end if; -- base do atalho
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
    tipo = case when p ? 'tipo' then nullif(btrim(coalesce(p ->> 'tipo', '')), '') else tipo end,
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
    acompanhar_em = case when p ? 'acompanhar_em' then nullif(p ->> 'acompanhar_em', '')::date else acompanhar_em end,
    encaminhada_em = case when p ? 'encaminhada_em' then nullif(p ->> 'encaminhada_em', '')::date else encaminhada_em end,
    reiterada_em = case when p ? 'reiterada_em' then nullif(p ->> 'reiterada_em', '')::date else reiterada_em end,
    rapida = case when p ? 'rapida' then coalesce((p ->> 'rapida')::boolean, false) else rapida end,
    documento_ano = case when p ? 'documento_ano' then nullif(p ->> 'documento_ano', '')::smallint else documento_ano end
  where id = p_id;
  return public.demanda_json(p_id);
end $$;
