-- Origem, documento associado, marca Rápida e Para hoje (decisão 60). Aditiva: nenhuma migração anterior é reescrita e nenhuma linha existente é alterada.
--   * Origem da solicitação e documento associado são campos independentes e opcionais. A origem já era um texto livre (public.demandas.origem) e continua sendo: o nome escolhido.
--     O tipo do documento (public.demandas.tipo) passa a poder ficar vazio (demanda sem documento) e deixa de ser limitado a uma lista fixa: os tipos viram opções cadastráveis.
--     Os valores antigos (origem digitada e os oito tipos de antes) permanecem como estão e aparecem como opções (listar_opcoes os incorpora, sem duplicar).
--   * public.opcoes guarda as opções de origem e de tipo de documento de cada usuário. criar_opcao é idempotente: o mesmo nome (sem diferença de maiúsculas ou de espaços) devolve a opção
--     que já existe, então repetir a tentativa ou criar em duas abas não duplica. Nome vazio ou com mais de 80 caracteres é recusado.
--   * documento_ano guarda SÓ o ano confirmado à mão (nulo = o aplicativo reconhece pelo número, quando o formato é inequívoco; ver src/lib/documentos.ts). O número fica como foi informado.
--   * rapida: marca opcional de uma demanda que se resolve em pouco tempo (desempata o Para hoje).
--   * public.para_hoje guarda as até 3 vagas do painel Para hoje (posição e demanda), por usuário. Persistem entre recargas, aparelhos e dias. atualizar_para_hoje libera só as vagas cuja
--     demanda foi finalizada ou arquivada (a exclusão remove a vaga em cascata) e preenche as vagas livres, em ordem, com a lista de candidatas que o aplicativo calculou (as regras de
--     prioridade dependem do calendário e ficam em src/lib/para-hoje.ts). Uma trava por usuário e as chaves únicas impedem vaga duplicada em sessões simultâneas.
--   * Tudo SECURITY INVOKER, com RLS pela conta autorizada (mesmo padrão das demais tabelas). As funções de criar_demanda e atualizar_demanda são recriadas com os campos novos
--     (o resto do corpo é idêntico ao da migração anterior).

-- ---------- demandas ----------
alter table public.demandas drop constraint if exists demandas_tipo_check;
alter table public.demandas alter column tipo drop not null;
alter table public.demandas alter column tipo drop default;
alter table public.demandas add column if not exists rapida boolean not null default false;
alter table public.demandas add column if not exists documento_ano smallint check (documento_ano between 1900 and 2100);

-- ---------- opções de origem e de tipo de documento ----------
create table if not exists public.opcoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  campo text not null check (campo in ('origem', 'tipo')),
  nome text not null check (length(btrim(nome)) between 1 and 80),
  chave text generated always as (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g'))) stored,
  criado_em timestamptz not null default now(),
  unique (user_id, campo, chave)
);
alter table public.opcoes enable row level security;
drop policy if exists opcoes_dono on public.opcoes;
create policy opcoes_dono on public.opcoes for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
revoke all on public.opcoes from public, anon, authenticated;
grant select, insert on public.opcoes to authenticated;

create or replace function public.listar_opcoes() returns jsonb language plpgsql set search_path = '' as $$
begin
  insert into public.opcoes (campo, nome) select 'origem', n from unnest(array['Prefeita', 'Reunião', 'Pedido de colega', 'Iniciativa própria']) n on conflict (user_id, campo, chave) do nothing;
  insert into public.opcoes (campo, nome) select 'tipo', n from unnest(array['Protocolo', 'Processo', 'Memorando', 'Ofício', 'Pedido de informação', 'Projeto de lei', 'Portaria', 'Outro documento']) n on conflict (user_id, campo, chave) do nothing;
  -- valores antigos das demandas entram como opções (sem duplicar)
  insert into public.opcoes (campo, nome) select distinct 'origem', left(regexp_replace(btrim(d.origem), '\s+', ' ', 'g'), 80) from public.demandas d
    where btrim(d.origem) <> '' and d.origem <> 'Não informada' on conflict (user_id, campo, chave) do nothing;
  insert into public.opcoes (campo, nome) select distinct 'tipo', left(regexp_replace(btrim(d.tipo), '\s+', ' ', 'g'), 80) from public.demandas d
    where d.tipo is not null and btrim(d.tipo) <> '' on conflict (user_id, campo, chave) do nothing;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'campo', o.campo, 'nome', o.nome) order by o.campo, o.criado_em, o.nome), '[]'::jsonb) from public.opcoes o);
end $$;

-- Cria a opção (idempotente). Devolve { id, campo, nome, existente }: com o mesmo nome (maiúsculas e espaços não contam) devolve a que já existe.
create or replace function public.criar_opcao(p_campo text, p_nome text) returns jsonb language plpgsql set search_path = '' as $$
declare v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'); o public.opcoes; v_novo boolean := false;
begin
  if p_campo is null or p_campo not in ('origem', 'tipo') then perform public.erro_dmanda('Campo da opção inválido.'); end if;
  if length(v_nome) = 0 then perform public.erro_dmanda(case when p_campo = 'origem' then 'Digite o nome da origem.' else 'Digite o nome do tipo de documento.' end); end if;
  if length(v_nome) > 80 then perform public.erro_dmanda('O nome passa de 80 caracteres.'); end if;
  insert into public.opcoes (campo, nome) values (p_campo, v_nome) on conflict (user_id, campo, chave) do nothing returning * into o;
  if found then v_novo := true; else select * into o from public.opcoes x where x.campo = p_campo and x.chave = lower(v_nome); end if;
  return jsonb_build_object('id', o.id, 'campo', o.campo, 'nome', o.nome, 'existente', not v_novo);
end $$;

-- ---------- Para hoje ----------
create table if not exists public.para_hoje (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  posicao smallint not null check (posicao between 1 and 3),
  demanda_id uuid not null references public.demandas (id) on delete cascade,
  desde date not null default public.hoje(),
  primary key (user_id, posicao),
  unique (user_id, demanda_id)
);
alter table public.para_hoje enable row level security;
drop policy if exists para_hoje_dono on public.para_hoje;
create policy para_hoje_dono on public.para_hoje for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
revoke all on public.para_hoje from public, anon, authenticated;
grant select, insert, delete on public.para_hoje to authenticated;

create or replace function public.listar_para_hoje() returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('posicao', p.posicao, 'demanda_id', p.demanda_id) order by p.posicao), '[]'::jsonb) from public.para_hoje p
$$;

-- Libera as vagas de demandas finalizadas ou arquivadas e preenche as vagas livres (na ordem das posições) com as candidatas, na ordem recebida, que ainda existem, estão abertas e não estão em outra vaga.
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

-- Funções novas nascem executáveis por qualquer papel: só o usuário logado executa. Lista explícita, nunca "all functions".
revoke all on function public.listar_opcoes(), public.criar_opcao(text, text), public.listar_para_hoje(), public.atualizar_para_hoje(jsonb) from public, anon, authenticated;
grant execute on function public.listar_opcoes(), public.criar_opcao(text, text), public.listar_para_hoje(), public.atualizar_para_hoje(jsonb) to authenticated;
