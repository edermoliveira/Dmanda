-- Entradas (decisões 37 a 39): anotações rápidas em post-its, que ficam até serem arquivadas e podem virar demanda.
-- Mesmas regras do núcleo de demandas: cada linha pertence a quem criou (RLS por user_id), todas as operações são funções SQL (security invoker, com a RLS de quem chama),
-- toda criação aceita um identificador gerado pelo aplicativo (repetir a chamada devolve a mesma anotação, nunca uma cópia) e cada anotação tem uma versão que sobe a cada
-- alteração (salvar com uma versão antiga é recusado com o código DM409, como nas demandas). As nove migrações anteriores não foram reescritas.
--
-- Estados de uma anotação (derivados das colunas, sem coluna de estado):
--   ativa      : arquivada_em nulo e demanda_id nulo   (aparece em Entradas)
--   arquivada  : arquivada_em preenchido, demanda_id nulo (aparece em Arquivo, pode ser recuperada)
--   convertida : demanda_id preenchido (virou demanda; sai de Entradas e fica em Arquivo, preservada exatamente como estava, sem edição, para consulta e rastreabilidade)
-- A conversão grava a demanda e o vínculo na MESMA transação (criar_demanda_de_entrada): ou existem as duas coisas, ou nenhuma.
-- Se a demanda for excluída de vez, o vínculo é desfeito pelo banco (on delete set null) e a anotação volta sozinha para Entradas, com o conteúdo original: nada se perde.
-- Tags (#assim) não têm coluna: derivam do título e do texto, pela mesma regra do aplicativo.

create table public.entradas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null default '' check (char_length(titulo) <= 200),
  texto text not null default '' check (char_length(texto) <= 20000),
  cor smallint not null default 0 check (cor between 0 and 5),
  fixada boolean not null default false,
  arquivada_em timestamptz,
  demanda_id uuid references public.demandas (id) on delete set null,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- nenhum registro completamente vazio: precisa de título ou de texto
  constraint entradas_nao_vazia check (char_length(btrim(titulo, E' \t\r\n')) + char_length(btrim(texto, E' \t\r\n')) > 0)
);
create index entradas_usuario_estado on public.entradas (user_id, arquivada_em, demanda_id);
-- uma demanda nasce de no máximo uma anotação
create unique index entradas_demanda_unica on public.entradas (demanda_id) where demanda_id is not null;

create trigger entradas_atualizado before update on public.entradas for each row execute function public.tocar_atualizado_em();
-- a função de versão das demandas é genérica (sobe "versao" a cada atualização): reaproveitada, sem duplicar
create trigger entradas_versao before update on public.entradas for each row execute function public.subir_versao_demanda();

alter table public.entradas enable row level security;
create policy entradas_dono on public.entradas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.entradas from public, anon, authenticated;
grant select, insert, update, delete on public.entradas to authenticated;

-- ---------- leitura ----------
create or replace function public.entrada_json(p_id uuid) returns jsonb language sql stable set search_path = '' as $$
  select to_jsonb(e) - 'user_id' from public.entradas e where e.id = p_id
$$;

-- p_arquivadas = false: as ativas (Entradas). true: as arquivadas e as convertidas (Arquivo).
create or replace function public.listar_entradas(p_arquivadas boolean default false) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.entrada_json(e.id) order by e.criado_em desc, e.id), '[]'::jsonb)
  from public.entradas e
  where case when p_arquivadas then (e.arquivada_em is not null or e.demanda_id is not null) else (e.arquivada_em is null and e.demanda_id is null) end
$$;

create or replace function public.buscar_entrada(p_id uuid) returns jsonb language plpgsql stable set search_path = '' as $$
declare r jsonb;
begin
  r := public.entrada_json(p_id);
  if r is null then perform public.erro_dmanda('Anotação não encontrada.'); end if;
  return r;
end $$;

-- ---------- escrita ----------
-- Sem escolha de cor, sorteia entre as cores menos usadas pelas anotações ativas, para não repetir demais (comportamento aprovado no protótipo).
create or replace function public.cor_entrada_automatica() returns smallint language sql volatile set search_path = '' as $$
  with uso as (
    select c::smallint as cor, (select count(*) from public.entradas e where e.cor = c and e.arquivada_em is null and e.demanda_id is null) as n from generate_series(0, 5) c
  )
  select cor from uso where n = (select min(n) from uso) order by random() limit 1
$$;

create or replace function public.criar_entrada(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_tit text := btrim(coalesce(p ->> 'titulo', ''), E' \t\r\n'); v_txt text := btrim(coalesce(p ->> 'texto', ''), E' \t\r\n');
        v_cor smallint;
begin
  -- repetir a chamada com o mesmo identificador (resposta perdida, clique duplo, nova tentativa) devolve a anotação que já existe
  if v_id is not null and exists (select 1 from public.entradas where id = v_id) then return public.entrada_json(v_id); end if;
  if char_length(v_tit) + char_length(v_txt) = 0 then perform public.erro_dmanda('Escreva um título ou o texto da anotação.'); end if;
  if char_length(v_tit) > 200 then perform public.erro_dmanda('O título passa de 200 caracteres.'); end if;
  if char_length(v_txt) > 20000 then perform public.erro_dmanda('O texto passa de 20000 caracteres.'); end if;
  if nullif(p ->> 'cor', '') is not null then
    v_cor := (p ->> 'cor')::smallint;
    if v_cor not between 0 and 5 then perform public.erro_dmanda('Cor inválida.'); end if;
  else v_cor := public.cor_entrada_automatica(); end if;
  insert into public.entradas (id, titulo, texto, cor, fixada)
  values (coalesce(v_id, gen_random_uuid()), v_tit, v_txt, v_cor, coalesce((p ->> 'fixada')::boolean, false))
  returning id into v_id;
  return public.entrada_json(v_id);
end $$;

-- Altera só os campos informados (título, texto, cor, fixada), se a anotação ainda está na versão em que a janela foi aberta.
-- Uma anotação convertida em demanda não se altera: ela fica preservada como estava quando virou demanda.
create or replace function public.salvar_entrada(p_id uuid, p jsonb, p_versao integer) returns jsonb language plpgsql set search_path = '' as $$
declare e public.entradas; v_tit text; v_txt text; v_cor smallint;
begin
  select * into e from public.entradas where id = p_id for update;
  if not found then perform public.erro_dmanda('Anotação não encontrada.'); end if;
  if e.demanda_id is not null then perform public.erro_dmanda('Esta anotação já virou demanda e fica preservada como estava. Nada foi gravado.'); end if;
  if p_versao is null then perform public.erro_dmanda('Versão da anotação não informada. Nada foi gravado.'); end if;
  if e.versao <> p_versao then
    raise exception 'Esta anotação foi alterada em outro aparelho ou janela depois que você abriu a edição. Nada foi gravado.' using errcode = 'DM409';
  end if;
  v_tit := case when p ? 'titulo' then btrim(coalesce(p ->> 'titulo', ''), E' \t\r\n') else e.titulo end;
  v_txt := case when p ? 'texto' then btrim(coalesce(p ->> 'texto', ''), E' \t\r\n') else e.texto end;
  if char_length(v_tit) + char_length(v_txt) = 0 then perform public.erro_dmanda('A anotação não pode ficar vazia. Para tirá-la da lista, arquive.'); end if;
  if char_length(v_tit) > 200 then perform public.erro_dmanda('O título passa de 200 caracteres.'); end if;
  if char_length(v_txt) > 20000 then perform public.erro_dmanda('O texto passa de 20000 caracteres.'); end if;
  v_cor := case when p ? 'cor' and nullif(p ->> 'cor', '') is not null then (p ->> 'cor')::smallint else e.cor end;
  if v_cor not between 0 and 5 then perform public.erro_dmanda('Cor inválida.'); end if;
  -- sem mudança real, não sobe a versão
  if (v_tit, v_txt, v_cor, case when p ? 'fixada' then (p ->> 'fixada')::boolean else e.fixada end) is not distinct from (e.titulo, e.texto, e.cor, e.fixada) then return public.entrada_json(p_id); end if;
  update public.entradas set titulo = v_tit, texto = v_txt, cor = v_cor, fixada = case when p ? 'fixada' then (p ->> 'fixada')::boolean else fixada end where id = p_id;
  return public.entrada_json(p_id);
end $$;

-- Fixar e desafixar não dependem da versão: é uma escolha pontual, e repetir não faz mal.
create or replace function public.fixar_entrada(p_id uuid, p_fixada boolean) returns jsonb language plpgsql set search_path = '' as $$
declare e public.entradas;
begin
  select * into e from public.entradas where id = p_id for update;
  if not found then perform public.erro_dmanda('Anotação não encontrada.'); end if;
  if e.demanda_id is not null then perform public.erro_dmanda('Esta anotação já virou demanda e fica preservada como estava.'); end if;
  if e.fixada is distinct from (p_fixada is true) then update public.entradas set fixada = (p_fixada is true) where id = p_id; end if;
  return public.entrada_json(p_id);
end $$;

create or replace function public.arquivar_entrada(p_id uuid) returns jsonb language plpgsql set search_path = '' as $$
declare e public.entradas;
begin
  select * into e from public.entradas where id = p_id for update;
  if not found then perform public.erro_dmanda('Anotação não encontrada.'); end if;
  if e.demanda_id is not null then perform public.erro_dmanda('Esta anotação já virou demanda e já está no Arquivo.'); end if;
  if e.arquivada_em is null then update public.entradas set arquivada_em = now() where id = p_id; end if;
  return public.entrada_json(p_id);
end $$;

create or replace function public.desarquivar_entrada(p_id uuid) returns jsonb language plpgsql set search_path = '' as $$
declare e public.entradas;
begin
  select * into e from public.entradas where id = p_id for update;
  if not found then perform public.erro_dmanda('Anotação não encontrada.'); end if;
  if e.demanda_id is not null then perform public.erro_dmanda('Esta anotação virou demanda e não volta para Entradas. Abra a demanda.'); end if;
  if e.arquivada_em is not null then update public.entradas set arquivada_em = null where id = p_id; end if;
  return public.entrada_json(p_id);
end $$;

-- Exclusão definitiva: só de anotação arquivada e com confirmação (como no Arquivo de demandas). A convertida nunca é excluída por aqui: a demanda guarda a origem.
create or replace function public.excluir_entrada(p_id uuid, p_confirmado boolean default false) returns jsonb language plpgsql set search_path = '' as $$
declare e public.entradas;
begin
  if p_confirmado is not true then perform public.erro_dmanda('A exclusão precisa de confirmação.'); end if;
  select * into e from public.entradas where id = p_id for update;
  if not found then perform public.erro_dmanda('Anotação não encontrada.'); end if;
  if e.demanda_id is not null then perform public.erro_dmanda('Esta anotação virou demanda e fica preservada como origem dela.'); end if;
  if e.arquivada_em is null then perform public.erro_dmanda('Arquive a anotação antes de excluir de vez.'); end if;
  delete from public.entradas where id = p_id;
  return jsonb_build_object('id', p_id, 'excluida', true);
end $$;

-- Virar demanda: cria a demanda (idempotente pelo identificador que o aplicativo gerou) e liga a anotação a ela, na mesma transação.
-- Com a anotação travada, duas conversões simultâneas não geram duas demandas: a segunda vê o vínculo da primeira e é recusada, sem criar nada.
-- Se a anotação já não existe (foi excluída do Arquivo em outro aparelho), a demanda é criada do mesmo jeito, sem vínculo: o que a pessoa digitou não se perde.
create or replace function public.criar_demanda_de_entrada(p_entrada uuid, p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare e public.entradas; v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then perform public.erro_dmanda('Identificador da demanda não informado.'); end if;
  select * into e from public.entradas where id = p_entrada for update;
  if not found then return public.criar_demanda(p); end if;
  if e.demanda_id is not null and e.demanda_id <> v_id then perform public.erro_dmanda('Esta anotação já virou outra demanda. Nada foi criado.'); end if;
  perform public.criar_demanda(p);
  if e.demanda_id is distinct from v_id then update public.entradas set demanda_id = v_id where id = p_entrada; end if;
  return public.demanda_json(v_id);
end $$;

-- A demanda passa a informar de qual anotação veio (nulo quando não veio de nenhuma).
create or replace function public.demanda_json(p_id uuid) returns jsonb language sql stable set search_path = '' as $$
  select (to_jsonb(d) - 'user_id') || jsonb_build_object('entrada_id', (select e.id from public.entradas e where e.demanda_id = d.id), 'tarefas', coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'texto', t.texto, 'concluida', t.concluida, 'posicao', t.posicao) order by t.posicao, t.criado_em)
    from public.tarefas t where t.demanda_id = d.id), '[]'::jsonb))
  from public.demandas d where d.id = p_id
$$;

-- Funções novas nascem executáveis por qualquer papel: só o usuário logado executa. Lista explícita, nunca "all functions".
revoke all on function
  public.entrada_json(uuid), public.listar_entradas(boolean), public.buscar_entrada(uuid), public.cor_entrada_automatica(), public.criar_entrada(jsonb),
  public.salvar_entrada(uuid, jsonb, integer), public.fixar_entrada(uuid, boolean), public.arquivar_entrada(uuid), public.desarquivar_entrada(uuid),
  public.excluir_entrada(uuid, boolean), public.criar_demanda_de_entrada(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.entrada_json(uuid), public.listar_entradas(boolean), public.buscar_entrada(uuid), public.cor_entrada_automatica(), public.criar_entrada(jsonb),
  public.salvar_entrada(uuid, jsonb, integer), public.fixar_entrada(uuid, boolean), public.arquivar_entrada(uuid), public.desarquivar_entrada(uuid),
  public.excluir_entrada(uuid, boolean), public.criar_demanda_de_entrada(uuid, jsonb)
  to authenticated;
