-- Dmanda: núcleo de demandas e tarefas.
-- Usuário único: cada linha pertence a quem criou (user_id = auth.uid()) e a segurança de nível de linha (RLS) isola os dados.
-- Todas as operações do aplicativo são funções SQL (security invoker, ou seja, com a RLS do usuário que chama), que validam as regras
-- e devolvem a demanda completa em jsonb. O mesmo conjunto de funções serve ao aplicativo e, no futuro, à IA operacional.
-- Regras (DECISOES.md): concluir marca todas as tarefas; reabrir mantém as tarefas e a etapa é a escolhida (padrão Fazendo);
-- a demanda em Cadastro vai para Vistos quando ganha a primeira tarefa; mudar de etapa nunca inventa setor, prazo nem data;
-- arquivar é sempre manual; excluir exige confirmação explícita.

create or replace function public.hoje() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create table public.demandas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null default 'Processo' check (tipo in ('Protocolo','Processo','Memorando','Ofício','Pedido de informação','Projeto de lei','Portaria','Outro documento')),
  area text not null default 'Geral' check (area in ('Geral','Pessoal','Compras')),
  numero text not null default 's/n',
  assunto text not null check (length(btrim(assunto)) > 0),
  descricao text not null default '',
  origem text not null default 'Não informada',
  etapa text not null default 'Cadastro' check (etapa in ('Cadastro','Vistos','Fazendo','Aguardando retorno','Finalizado')),
  etapa_desde timestamptz not null default now(),
  chegou_em date not null default public.hoje(),
  prazo date,
  prazo_tipo text not null default 'Próprio' check (prazo_tipo in ('Legal','Próprio')),
  setor text,
  acompanhar_em date,
  concluida_em date,
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint protocolo_sem_compras check (not (tipo = 'Protocolo' and area = 'Compras')),
  constraint concluida_so_finalizada check ((etapa = 'Finalizado') = (concluida_em is not null))
);
create index demandas_usuario_etapa on public.demandas (user_id, etapa);
create index demandas_usuario_arquivada on public.demandas (user_id, arquivada_em);

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  demanda_id uuid not null references public.demandas (id) on delete cascade,
  texto text not null check (length(btrim(texto)) > 0),
  concluida boolean not null default false,
  posicao integer not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index tarefas_demanda on public.tarefas (demanda_id, posicao);

create or replace function public.tocar_atualizado_em() returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger demandas_atualizado before update on public.demandas for each row execute function public.tocar_atualizado_em();
create trigger tarefas_atualizado before update on public.tarefas for each row execute function public.tocar_atualizado_em();

-- Segurança de nível de linha: só o dono vê e altera. Sem acesso anônimo.
alter table public.demandas enable row level security;
alter table public.tarefas enable row level security;
create policy demandas_dono on public.demandas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tarefas_dono on public.tarefas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.demandas, public.tarefas from anon, public;
grant select, insert, update, delete on public.demandas, public.tarefas to authenticated;

-- ---------- funções auxiliares ----------
create or replace function public.demanda_json(p_id uuid) returns jsonb language sql stable set search_path = '' as $$
  select (to_jsonb(d) - 'user_id') || jsonb_build_object('tarefas', coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'texto', t.texto, 'concluida', t.concluida, 'posicao', t.posicao) order by t.posicao, t.criado_em)
    from public.tarefas t where t.demanda_id = d.id), '[]'::jsonb))
  from public.demandas d where d.id = p_id
$$;

create or replace function public.erro_dmanda(p_msg text) returns void language plpgsql set search_path = '' as $$
begin raise exception '%', p_msg using errcode = 'P0001'; end $$;

-- ---------- demandas ----------
create or replace function public.listar_demandas(p_arquivadas boolean default false) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.demanda_json(d.id) order by d.criado_em, d.id), '[]'::jsonb)
  from public.demandas d where (d.arquivada_em is not null) = p_arquivadas
$$;

create or replace function public.buscar_demanda(p_id uuid) returns jsonb language plpgsql stable set search_path = '' as $$
declare r jsonb;
begin
  r := public.demanda_json(p_id);
  if r is null then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  return r;
end $$;

create or replace function public.criar_demanda(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid; v_etapa text := coalesce(nullif(p->>'etapa',''), 'Cadastro'); v_tipo text := coalesce(nullif(p->>'tipo',''), 'Processo');
        v_area text := coalesce(nullif(p->>'area',''), 'Geral');
begin
  if length(btrim(coalesce(p->>'assunto',''))) = 0 then perform public.erro_dmanda('Informe o assunto da demanda.'); end if;
  if v_etapa = 'Finalizado' then perform public.erro_dmanda('Uma demanda nova não nasce finalizada. Cadastre e depois conclua.'); end if;
  if v_tipo = 'Protocolo' and v_area = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
  insert into public.demandas (tipo, area, numero, assunto, descricao, origem, etapa, chegou_em, prazo, prazo_tipo, setor, acompanhar_em)
  values (v_tipo, v_area,
          coalesce(nullif(btrim(p->>'numero'),''), 's/n'), btrim(p->>'assunto'), coalesce(p->>'descricao',''), coalesce(nullif(btrim(p->>'origem'),''), 'Não informada'),
          v_etapa, coalesce(nullif(p->>'chegou_em','')::date, public.hoje()), nullif(p->>'prazo','')::date, coalesce(nullif(p->>'prazo_tipo',''), 'Próprio'),
          nullif(btrim(coalesce(p->>'setor','')),''), nullif(p->>'acompanhar_em','')::date)
  returning id into v_id;
  return public.demanda_json(v_id);
end $$;

-- Atualiza só os campos informados (a chave presente com null limpa prazo, setor e acompanhamento). Não mexe em etapa, tarefas nem arquivamento.
create or replace function public.atualizar_demanda(p_id uuid, p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas;
begin
  select * into d from public.demandas where id = p_id for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  if p ? 'assunto' and length(btrim(coalesce(p->>'assunto',''))) = 0 then perform public.erro_dmanda('O assunto não pode ficar vazio.'); end if;
  if coalesce(p->>'tipo', d.tipo) = 'Protocolo' and coalesce(p->>'area', d.area) = 'Compras' then perform public.erro_dmanda('Protocolo só pode ser da área Geral ou Pessoal.'); end if;
  update public.demandas set
    assunto = case when p ? 'assunto' then btrim(p->>'assunto') else assunto end,
    numero = case when p ? 'numero' then coalesce(nullif(btrim(p->>'numero'),''), 's/n') else numero end,
    origem = case when p ? 'origem' then coalesce(nullif(btrim(p->>'origem'),''), 'Não informada') else origem end,
    descricao = case when p ? 'descricao' then coalesce(p->>'descricao','') else descricao end,
    tipo = case when p ? 'tipo' then p->>'tipo' else tipo end,
    area = case when p ? 'area' then p->>'area' else area end,
    chegou_em = case when p ? 'chegou_em' then coalesce(nullif(p->>'chegou_em','')::date, chegou_em) else chegou_em end,
    prazo = case when p ? 'prazo' then nullif(p->>'prazo','')::date else prazo end,
    prazo_tipo = case when p ? 'prazo_tipo' then p->>'prazo_tipo' else prazo_tipo end,
    setor = case when p ? 'setor' then nullif(btrim(coalesce(p->>'setor','')),'') else setor end,
    acompanhar_em = case when p ? 'acompanhar_em' then nullif(p->>'acompanhar_em','')::date else acompanhar_em end
  where id = p_id;
  return public.demanda_json(p_id);
end $$;

-- Transição de etapa (uma só regra, usada pelo menu, pelo arraste, por Já vi, Concluir, Reabrir e pela futura IA).
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
    -- sair de Finalizado é reabrir: mantém as tarefas como estão e limpa só a data de conclusão
    update public.demandas set etapa = p_etapa, concluida_em = null, etapa_desde = now() where id = p_id;
  end if;
  return public.demanda_json(p_id);
end $$;

create or replace function public.concluir_demanda(p_id uuid) returns jsonb language sql set search_path = '' as $$ select public.mover_etapa(p_id, 'Finalizado') $$;

create or replace function public.reabrir_demanda(p_id uuid, p_etapa text default 'Fazendo') returns jsonb language plpgsql set search_path = '' as $$
declare e text;
begin
  select etapa into e from public.demandas where id = p_id;
  if e is null then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  if e <> 'Finalizado' then perform public.erro_dmanda('Só uma demanda finalizada pode ser reaberta.'); end if;
  if p_etapa = 'Finalizado' then perform public.erro_dmanda('Escolha a etapa para onde a demanda volta.'); end if;
  return public.mover_etapa(p_id, p_etapa);
end $$;

create or replace function public.arquivar_demanda(p_id uuid) returns jsonb language plpgsql set search_path = '' as $$
begin
  update public.demandas set arquivada_em = coalesce(arquivada_em, now()) where id = p_id;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  return public.demanda_json(p_id);
end $$;

create or replace function public.desarquivar_demanda(p_id uuid) returns jsonb language plpgsql set search_path = '' as $$
begin
  update public.demandas set arquivada_em = null where id = p_id;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  return public.demanda_json(p_id);
end $$;

create or replace function public.excluir_demanda(p_id uuid, p_confirmado boolean default false) returns jsonb language plpgsql set search_path = '' as $$
begin
  if p_confirmado is not true then perform public.erro_dmanda('A exclusão precisa de confirmação.'); end if;
  delete from public.demandas where id = p_id;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  return jsonb_build_object('id', p_id, 'excluida', true);
end $$;

-- ---------- tarefas ----------
create or replace function public.adicionar_tarefa(p_demanda uuid, p_texto text) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas; n integer;
begin
  if length(btrim(coalesce(p_texto,''))) = 0 then perform public.erro_dmanda('Escreva a tarefa.'); end if;
  select * into d from public.demandas where id = p_demanda for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  select count(*) into n from public.tarefas where demanda_id = p_demanda;
  insert into public.tarefas (demanda_id, user_id, texto, posicao)
  values (p_demanda, d.user_id, btrim(p_texto), coalesce((select max(posicao) from public.tarefas where demanda_id = p_demanda), 0) + 1);
  -- Cadastro vai para Vistos quando ganha a primeira tarefa (não inventa nada além disso)
  if n = 0 and d.etapa = 'Cadastro' and d.arquivada_em is null then
    update public.demandas set etapa = 'Vistos', etapa_desde = now() where id = p_demanda;
  end if;
  return public.demanda_json(p_demanda);
end $$;

create or replace function public.editar_tarefa(p_id uuid, p_texto text) returns jsonb language plpgsql set search_path = '' as $$
declare v_d uuid;
begin
  if length(btrim(coalesce(p_texto,''))) = 0 then perform public.erro_dmanda('A tarefa não pode ficar vazia.'); end if;
  update public.tarefas set texto = btrim(p_texto) where id = p_id returning demanda_id into v_d;
  if v_d is null then perform public.erro_dmanda('Tarefa não encontrada.'); end if;
  return public.demanda_json(v_d);
end $$;

create or replace function public.marcar_tarefa(p_id uuid, p_concluida boolean) returns jsonb language plpgsql set search_path = '' as $$
declare v_d uuid;
begin
  update public.tarefas set concluida = coalesce(p_concluida, false) where id = p_id returning demanda_id into v_d;
  if v_d is null then perform public.erro_dmanda('Tarefa não encontrada.'); end if;
  return public.demanda_json(v_d);   -- marcar tarefas nunca muda a etapa sozinho
end $$;

create or replace function public.excluir_tarefa(p_id uuid) returns jsonb language plpgsql set search_path = '' as $$
declare v_d uuid;
begin
  delete from public.tarefas where id = p_id returning demanda_id into v_d;
  if v_d is null then perform public.erro_dmanda('Tarefa não encontrada.'); end if;
  -- mantém a ordem relativa e fecha o buraco
  update public.tarefas t set posicao = r.n from (select id, row_number() over (order by posicao, criado_em) as n from public.tarefas where demanda_id = v_d) r where t.id = r.id and t.posicao <> r.n;
  return public.demanda_json(v_d);
end $$;

-- Só usuários autenticados executam as funções; nada para anônimos.
revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
