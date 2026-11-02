-- Agenda (decisões 46 a 49): etapa Aguardando Prefeita, datas de encaminhamento e reiteração (retorno de outro setor em 10 dias) e eventos e lembretes próprios.
-- Aditiva: as 13 migrações anteriores não foram reescritas e nenhum dado existente é alterado (só colunas novas, vazias, e uma etapa a mais permitida).
--   * Aguardando Prefeita: nova etapa do fluxo. A data de entrada na etapa é a `etapa_desde` que todas as etapas já têm (muda a cada troca de etapa, então sair e voltar começa um novo período).
--     Uma reiteração não zera a espera, e nada move a demanda nem altera o vencimento sozinho (a regra é só de apresentação, no aplicativo).
--   * encaminhada_em e reiterada_em: datas opcionais para a contagem de 10 dias do retorno de outro setor. Ao entrar em Aguardando retorno (vindo de outra etapa), as duas começam vazias:
--     é um novo período de espera. O campo manual "Acompanhar em" não é tocado por nada disto.
--   * eventos: compromissos, reuniões e lembretes próprios (com horário ou de dia inteiro), com versão contra edição simultânea, criação idempotente pelo identificador gerado
--     no aplicativo e RLS pela conta autorizada, como Entradas e dias indisponíveis.
-- Dias indisponíveis continuam sendo a única fonte de feriados e eventos externos (nada é duplicado em eventos).

-- ---------- 1) etapa e datas ----------
alter table public.demandas drop constraint demandas_etapa_check;
alter table public.demandas add constraint demandas_etapa_check check (etapa in ('Cadastro','Vistos','Fazendo','Aguardando retorno','Aguardando Prefeita','Finalizado'));
alter table public.demandas add column encaminhada_em date, add column reiterada_em date;

-- ---------- 2) as duas funções que conhecem a lista de etapas e os campos da demanda ----------
-- atualizar_demanda: igual à da migração 8, com os dois campos novos (chave ausente não mexe; null limpa).
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
    acompanhar_em = case when p ? 'acompanhar_em' then nullif(p ->> 'acompanhar_em', '')::date else acompanhar_em end,
    encaminhada_em = case when p ? 'encaminhada_em' then nullif(p ->> 'encaminhada_em', '')::date else encaminhada_em end,
    reiterada_em = case when p ? 'reiterada_em' then nullif(p ->> 'reiterada_em', '')::date else reiterada_em end
  where id = p_id;
  return public.demanda_json(p_id);
end $$;

-- mover_etapa: igual à da migração 8, com a etapa nova na lista e as datas de espera zeradas ao começar um novo período em Aguardando retorno.
create or replace function public.mover_etapa(p_id uuid, p_etapa text) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas;
begin
  if p_etapa not in ('Cadastro','Vistos','Fazendo','Aguardando retorno','Aguardando Prefeita','Finalizado') then perform public.erro_dmanda('Etapa desconhecida.'); end if;
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
    -- um novo período de espera por outro setor começa sem as datas do período anterior (o encaminhamento e a reiteração de antes não valem mais)
    if p_etapa = 'Aguardando retorno' then update public.demandas set encaminhada_em = null, reiterada_em = null where id = p_id; end if;
    if d.etapa = 'Finalizado' then perform public.recalcular_prazo_demanda(p_id); end if;
  end if;
  return public.demanda_json(p_id);
end $$;

-- ---------- 3) eventos ----------
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  tipo text not null check (tipo in ('Reunião','Compromisso','Lembrete')),
  data date not null,
  dia_inteiro boolean not null default false,
  inicio time,
  fim time,
  descricao text not null default '' check (char_length(descricao) <= 5000),
  -- minutos de antecedência do aviso dentro do aplicativo; em dia inteiro, 0 significa "avisar no dia"; nulo = sem aviso
  aviso_min integer check (aviso_min is null or aviso_min between 0 and 1440),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint eventos_horario check ((dia_inteiro and inicio is null and fim is null) or (not dia_inteiro and inicio is not null and (fim is null or fim > inicio)))
);
create index eventos_usuario_data on public.eventos (user_id, data);
create trigger eventos_atualizado before update on public.eventos for each row execute function public.tocar_atualizado_em();
-- a função de versão das demandas é genérica (sobe "versao" a cada atualização): reaproveitada, sem duplicar
create trigger eventos_versao before update on public.eventos for each row execute function public.subir_versao_demanda();

alter table public.eventos enable row level security;
create policy eventos_dono on public.eventos for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
revoke all on public.eventos from public, anon, authenticated;
grant select, insert, update, delete on public.eventos to authenticated;

create or replace function public.evento_json(p_id uuid) returns jsonb language sql stable set search_path = '' as $$
  select (to_jsonb(e) - 'user_id') || jsonb_build_object('inicio', to_char(e.inicio, 'HH24:MI'), 'fim', to_char(e.fim, 'HH24:MI')) from public.eventos e where e.id = p_id
$$;

create or replace function public.listar_eventos() returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.evento_json(e.id) order by e.data, e.dia_inteiro desc, e.inicio, e.criado_em, e.id), '[]'::jsonb) from public.eventos e
$$;

create or replace function public.buscar_evento(p_id uuid) returns jsonb language plpgsql stable set search_path = '' as $$
declare r jsonb;
begin
  r := public.evento_json(p_id);
  if r is null then perform public.erro_dmanda('Evento não encontrado.'); end if;
  return r;
end $$;

-- Mesmas conferências da tela, repetidas no banco (a tela nunca é a única defesa).
create or replace function public.conferir_evento(p_titulo text, p_tipo text, p_dia_inteiro boolean, p_inicio text, p_fim text, p_descricao text, p_aviso integer) returns void language plpgsql stable set search_path = '' as $$
begin
  if length(btrim(coalesce(p_titulo, ''))) = 0 then perform public.erro_dmanda('Informe o título do evento.'); end if;
  if char_length(btrim(p_titulo)) > 200 then perform public.erro_dmanda('O título passa de 200 caracteres.'); end if;
  if p_tipo is null or p_tipo not in ('Reunião','Compromisso','Lembrete') then perform public.erro_dmanda('Escolha o tipo do evento.'); end if;
  if char_length(coalesce(p_descricao, '')) > 5000 then perform public.erro_dmanda('A descrição passa de 5000 caracteres.'); end if;
  if p_dia_inteiro then
    if nullif(p_inicio, '') is not null or nullif(p_fim, '') is not null then perform public.erro_dmanda('Evento de dia inteiro não tem horário.'); end if;
    if p_aviso is not null and p_aviso <> 0 then perform public.erro_dmanda('Aviso inválido.'); end if;
  else
    if nullif(p_inicio, '') is null or p_inicio !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then perform public.erro_dmanda('Informe o horário de início (por exemplo, 09:30).'); end if;
    if nullif(p_fim, '') is not null then
      if p_fim !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then perform public.erro_dmanda('Horário de término inválido.'); end if;
      if p_fim::time <= p_inicio::time then perform public.erro_dmanda('O término precisa ser depois do início.'); end if;
    end if;
    if p_aviso is not null and p_aviso not in (5, 10, 15, 30, 60, 120) then perform public.erro_dmanda('Aviso inválido.'); end if;
  end if;
end $$;

create or replace function public.criar_evento(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_dia boolean := coalesce((p ->> 'dia_inteiro')::boolean, false);
begin
  -- repetir a chamada com o mesmo identificador (resposta perdida, clique duplo, nova tentativa) devolve o evento que já existe
  if v_id is not null and exists (select 1 from public.eventos where id = v_id) then return public.evento_json(v_id); end if;
  perform public.conferir_evento(p ->> 'titulo', p ->> 'tipo', v_dia, p ->> 'inicio', p ->> 'fim', p ->> 'descricao', nullif(p ->> 'aviso_min', '')::integer);
  if nullif(p ->> 'data', '') is null then perform public.erro_dmanda('Informe a data do evento.'); end if;
  insert into public.eventos (id, titulo, tipo, data, dia_inteiro, inicio, fim, descricao, aviso_min)
  values (coalesce(v_id, gen_random_uuid()), btrim(p ->> 'titulo'), p ->> 'tipo', (p ->> 'data')::date, v_dia, nullif(p ->> 'inicio', '')::time, nullif(p ->> 'fim', '')::time,
          btrim(coalesce(p ->> 'descricao', '')), nullif(p ->> 'aviso_min', '')::integer)
  returning id into v_id;
  return public.evento_json(v_id);
end $$;

-- Altera só os campos informados, se o evento ainda está na versão em que a janela foi aberta (senão, DM409, como nas demandas e em Entradas).
create or replace function public.salvar_evento(p_id uuid, p jsonb, p_versao integer) returns jsonb language plpgsql set search_path = '' as $$
declare e public.eventos; v_tit text; v_tipo text; v_data date; v_dia boolean; v_ini text; v_fim text; v_desc text; v_av integer;
begin
  select * into e from public.eventos where id = p_id for update;
  if not found then perform public.erro_dmanda('Evento não encontrado. Ele pode ter sido excluído em outro aparelho.'); end if;
  if p_versao is null then perform public.erro_dmanda('Versão do evento não informada. Nada foi gravado.'); end if;
  if e.versao <> p_versao then
    raise exception 'Este evento foi alterado em outro aparelho ou janela depois que você abriu a edição. Nada foi gravado.' using errcode = 'DM409';
  end if;
  v_tit := case when p ? 'titulo' then btrim(coalesce(p ->> 'titulo', '')) else e.titulo end;
  v_tipo := case when p ? 'tipo' then p ->> 'tipo' else e.tipo end;
  v_data := case when p ? 'data' then nullif(p ->> 'data', '')::date else e.data end;
  v_dia := case when p ? 'dia_inteiro' then (p ->> 'dia_inteiro')::boolean else e.dia_inteiro end;
  v_ini := case when p ? 'inicio' then nullif(p ->> 'inicio', '') else to_char(e.inicio, 'HH24:MI') end;
  v_fim := case when p ? 'fim' then nullif(p ->> 'fim', '') else to_char(e.fim, 'HH24:MI') end;
  v_desc := case when p ? 'descricao' then btrim(coalesce(p ->> 'descricao', '')) else e.descricao end;
  v_av := case when p ? 'aviso_min' then nullif(p ->> 'aviso_min', '')::integer else e.aviso_min end;
  if v_data is null then perform public.erro_dmanda('Informe a data do evento.'); end if;
  perform public.conferir_evento(v_tit, v_tipo, v_dia, v_ini, v_fim, v_desc, v_av);
  -- sem mudança real, não sobe a versão
  if (v_tit, v_tipo, v_data, v_dia, v_ini, v_fim, v_desc, v_av) is not distinct from (e.titulo, e.tipo, e.data, e.dia_inteiro, to_char(e.inicio, 'HH24:MI'), to_char(e.fim, 'HH24:MI'), e.descricao, e.aviso_min) then
    return public.evento_json(p_id);
  end if;
  update public.eventos set titulo = v_tit, tipo = v_tipo, data = v_data, dia_inteiro = v_dia, inicio = v_ini::time, fim = v_fim::time, descricao = v_desc, aviso_min = v_av where id = p_id;
  return public.evento_json(p_id);
end $$;

-- Excluir precisa de confirmação. Repetir depois de uma resposta perdida não é erro: o evento já não existe, e o resultado é o mesmo.
create or replace function public.excluir_evento(p_id uuid, p_confirmado boolean default false) returns jsonb language plpgsql set search_path = '' as $$
begin
  if p_confirmado is not true then perform public.erro_dmanda('A exclusão precisa de confirmação.'); end if;
  delete from public.eventos where id = p_id;
  return jsonb_build_object('id', p_id, 'excluido', true);
end $$;

-- ---------- 4) privilégios ----------
-- Funções novas nascem executáveis por qualquer papel: só o usuário logado executa. Lista explícita, nunca "all functions".
revoke all on function
  public.evento_json(uuid), public.listar_eventos(), public.buscar_evento(uuid), public.conferir_evento(text, text, boolean, text, text, text, integer),
  public.criar_evento(jsonb), public.salvar_evento(uuid, jsonb, integer), public.excluir_evento(uuid, boolean)
  from public, anon, authenticated;
grant execute on function
  public.evento_json(uuid), public.listar_eventos(), public.buscar_evento(uuid), public.conferir_evento(text, text, boolean, text, text, text, integer),
  public.criar_evento(jsonb), public.salvar_evento(uuid, jsonb, integer), public.excluir_evento(uuid, boolean)
  to authenticated;
