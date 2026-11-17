-- PROPOSTA DE REVERSÃO das migrações das etapas 3, 4 e 5 (decisões 80, 81 e 82). NÃO é migração e não foi aplicada em lugar nenhum além do banco de teste.
-- Só com autorização específica do Éder, no SQL Editor do Supabase (ou `supabase db query --linked -f`), de cima para baixo e só as seções necessárias.
-- Cada seção é independente e devolve as funções (e a restrição) ao que a migração 20261110000000 e as anteriores definiam. Nenhuma tabela é apagada; os dados criados depois ficam.

-- ===== 1) Aparelhos autorizados (migração 20261118000000): NÃO HÁ MAIS O QUE REVERTER AQUI =====
-- O recurso foi retirado por inteiro pela migração 20261119000000_retirar_aparelhos (decisão de 17/11/2026): as funções, as tabelas e a exigência deixaram de existir e conta_autorizada() voltou a ser só a regra do titular.
-- A seção foi removida porque chamava exigir_aparelhos(), que não existe mais. As seções 2 em diante seguem valendo.

-- ===== 2) Prazo pela chegada (migração 20261117000000): as duas funções voltam a contar a duração a partir de hoje =====
begin;
-- ---------- criar_demanda e atualizar_demanda com os campos novos ----------
create or replace function public.criar_demanda(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_etapa text := coalesce(nullif(p ->> 'etapa', ''), 'Cadastro'); v_tipo text := nullif(btrim(coalesce(p ->> 'tipo', '')), '');
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
  insert into public.demandas (id, tipo, area, numero, assunto, descricao, origem, etapa, chegou_em, prazo, prazo_original, prazo_dias, prazo_base_em, prazo_ajuste, prazo_tipo, setor, acompanhar_em, rapida, documento_ano)
  values (coalesce(v_id, gen_random_uuid()), v_tipo, v_area, coalesce(btrim(p ->> 'numero'), ''), btrim(p ->> 'assunto'), coalesce(p ->> 'descricao', ''), coalesce(btrim(p ->> 'origem'), ''),
          v_etapa, nullif(p ->> 'chegou_em', '')::date, (v_aj ->> 'prazo')::date, v_orig, v_dias, v_base, v_aj ->> 'ajuste', coalesce(nullif(p ->> 'prazo_tipo', ''), 'Próprio'),
          nullif(btrim(coalesce(p ->> 'setor', '')), ''), nullif(p ->> 'acompanhar_em', '')::date, coalesce((p ->> 'rapida')::boolean, false), nullif(p ->> 'documento_ano', '')::smallint)
  returning id into v_id;
  return public.demanda_json(v_id);
end $$;

create or replace function public.atualizar_demanda(p_id uuid, p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas; v_tem boolean := false; v_dias integer; v_base date; v_orig date; v_aj jsonb; v_legado boolean;
begin
  select * into d from public.demandas where id = p_id for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  if p ? 'assunto' and length(btrim(coalesce(p ->> 'assunto', ''))) = 0 then perform public.erro_dmanda('O assunto não pode ficar vazio.'); end if;
  if (case when p ? 'tipo' then nullif(btrim(coalesce(p ->> 'tipo', '')), '') else d.tipo end) = 'Protocolo' and coalesce(p ->> 'area', d.area) = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
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
commit;

-- ===== 3) Quatro vagas (migração 20261116000000): a quarta vaga some (é só o ponteiro para a demanda, que continua existindo) e a restrição volta a 1 a 3 =====
begin;
delete from public.para_hoje where posicao = 4;
alter table public.para_hoje drop constraint if exists para_hoje_posicao_check;
alter table public.para_hoje add constraint para_hoje_posicao_check check (posicao between 1 and 3);
create or replace function public.atualizar_para_hoje(p_candidatas jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid; v_pos smallint; x text;
begin
  if p_candidatas is not null and (jsonb_typeof(p_candidatas) <> 'array' or jsonb_array_length(p_candidatas) > 30) then perform public.erro_dmanda('Lista de candidatas inválida.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('para_hoje:' || coalesce(v_user::text, ''), 0));
  delete from public.para_hoje p using public.demandas d where d.id = p.demanda_id and (d.etapa = 'Finalizado' or d.arquivada_em is not null);
  for x in select e from jsonb_array_elements_text(coalesce(p_candidatas, '[]'::jsonb)) e loop
    select s into v_pos from generate_series(1, 3) s where not exists (select 1 from public.para_hoje p where p.posicao = s) order by s limit 1;
    exit when v_pos is null;
    if x !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then continue; end if;
    v_id := x::uuid;
    if exists (select 1 from public.demandas d where d.id = v_id and d.etapa <> 'Finalizado' and d.arquivada_em is null)
       and not exists (select 1 from public.para_hoje p where p.demanda_id = v_id) then
      insert into public.para_hoje (posicao, demanda_id) values (v_pos, v_id);
    end if;
  end loop;
  return public.listar_para_hoje();
end $$;
commit;
