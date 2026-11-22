-- Restaura uma cópia dos dados do Dmanda (arquivo "dmanda-copia-AAAA-MM-DD.json", menu do avatar > "Baixar cópia dos dados") em um projeto Supabase.
-- Aceita cópias da versão 5 (a 4 + autoria por e-mail, só na cópia da administradora, e os rascunhos da conta que gerou a cópia), da versão 4 (demandas, tarefas, dias indisponíveis, entradas e eventos da Agenda), da versão 3 (sem eventos), da versão 2 (sem entradas) e da versão 1 (antigas, sem dias indisponíveis; o prazo delas vira a referência original, marcada como legado).
-- Procedimento completo e limites: supabase/LEIA-ME.md, seção "Cópia dos dados e restauração".
--
-- Como usar (no SQL Editor do painel do Supabase, do projeto Dmanda, ou em um banco de teste):
--   1. Abra o arquivo .json da cópia em um editor de texto e copie TODO o conteúdo.
--   2. Na linha "j jsonb := ..." mais abaixo, troque a palavra marcadora (COLE_AQUI_O_JSON, com dois sublinhados de cada lado) pelo conteúdo copiado,
--      mantendo as marcas $dmanda$ ao redor e sem alterar mais nada.
--   3. Execute. Tudo acontece em uma transação só: se algo estiver errado, nada é gravado.
--   4. Confira: select count(*) from public.demandas; select count(*) from public.tarefas;
--
-- Garantias e limites:
--   - Só grava demandas, tarefas (com as arquivadas), dias indisponíveis, entradas (ativas, arquivadas e já convertidas, com o vínculo à demanda) e eventos da Agenda. Uma demanda ou entrada que já existe com o mesmo identificador NÃO é tocada nem sobrescrita, nem recebe tarefas.
--   - AUTORIA (decisão 92): cada registro volta para a conta cujo e-mail consta na autoria da cópia (versão 5), se essa conta existir NESTE projeto; o que não tem autoria (cópias 1 a 4) ou cujo autor não existe aqui
--     volta para a conta ADMINISTRADORA do projeto (e o aviso final conta quantos). Nenhuma conta é criada, nenhum acesso é concedido ou restabelecido: a situação dos acessos na cópia é só informação, e as contas, as
--     senhas, a lista de acessos e as migrações NÃO fazem parte da cópia e precisam existir antes. Sem a conta administradora neste projeto vale o único usuário; com vários usuários e sem ela, nada é gravado.
--   - RASCUNHOS (versão 5): voltam só para a conta de rascunhos_de (a que gerou a cópia), se existir; um rascunho cuja chave já tem rascunho aberto nessa conta não é tocado. Rascunhos de outras contas não estão na cópia.
--   - Exige o dono da tabela (no SQL Editor do Supabase você já é): o script desliga e religa um gatilho dentro da própria transação.
--   - Não restaura: preferências do navegador (tema, visão, rascunhos), resumos e registros da rotina diária (a rotina recalcula), nem a data de criação de cada tarefa.
--   - Também fica fora do JSON: o humor do dia (tabela registros_dia, dado pessoal e privado), as opções de origem e de tipo cadastradas e ainda não usadas por nenhuma demanda (tabela opcoes; a origem e o tipo de cada demanda restaurada voltam no texto da própria demanda)
--     e as vagas de Para hoje (tabela para_hoje; o painel recompõe as vagas a partir das demandas abertas). Cópia anterior à migração 20 não traz a marca Rápida: as demandas voltam com Rápida desligada.
--   - Rodar duas vezes com o mesmo arquivo não duplica nada.
do $restaurar$
declare
  j jsonb := $dmanda$__COLE_AQUI_O_JSON__$dmanda$::jsonb;
  dono uuid;
  qtd integer;
  todas jsonb;
  novas uuid[];
  n_dem integer;
  n_tar integer;
  n_dias integer;
  n_ent integer;
  n_eve integer;
  n_ras integer := 0;
  n_sem_autor integer;
  tipo_a text;
begin
  if j ->> 'formato' is distinct from 'dmanda-exportacao' or j ->> 'versao' not in ('1', '2', '3', '4', '5') then
    raise exception 'Este arquivo não é uma cópia do Dmanda (esperado formato dmanda-exportacao, versão 1, 2, 3, 4 ou 5).';
  end if;
  -- conta de destino padrão: a administradora (o e-mail está fixado no banco). Sem ela neste projeto (ou em projeto anterior à decisão 92) vale o ÚNICO usuário, como sempre foi; com vários usuários e sem a
  -- administradora, nada é gravado (não se adivinha o destino).
  if to_regprocedure('dmanda_privado.email_admin()') is not null then
    select u.id into dono from auth.users u where lower(btrim(u.email)) = dmanda_privado.email_admin() limit 1;
  end if;
  if dono is null then
    select count(*) into qtd from auth.users;
    if qtd <> 1 then raise exception 'A conta administradora não existe neste projeto e há % usuário(s) (esperado exatamente 1 usuário nesse caso). Nada foi gravado.', qtd; end if;
    select id into dono from auth.users;
  end if;

  -- autoria da cópia (versão 5): registro -> conta de destino, pelo e-mail; só entra quem existe neste projeto
  create temp table _autoria (tipo text, id text, usuario uuid) on commit drop;
  if jsonb_typeof(j -> 'autoria') = 'object' then
    foreach tipo_a in array array['demandas', 'tarefas', 'entradas', 'eventos', 'dias_indisponiveis'] loop
      insert into _autoria (tipo, id, usuario)
      select tipo_a, a.key, u.id from jsonb_each_text(coalesce(j -> 'autoria' -> tipo_a, '{}'::jsonb)) a join auth.users u on lower(btrim(u.email)) = lower(btrim(a.value));
    end loop;
  end if;

  todas := coalesce(j -> 'demandas', '[]'::jsonb) || coalesce(j -> 'arquivadas', '[]'::jsonb);

  with inseridas as (
    insert into public.demandas
    select r.*
    from jsonb_populate_recordset(null::public.demandas,
      (select coalesce(jsonb_agg(x || jsonb_build_object('user_id', coalesce((select a.usuario from _autoria a where a.tipo = 'demandas' and a.id = x ->> 'id'), dono), 'versao', coalesce(x -> 'versao', '1'::jsonb), 'prazo_legado', coalesce(x -> 'prazo_legado', 'false'::jsonb),
        -- cópia anterior à migração 20 não tem a marca Rápida (coluna NOT NULL): ausente ou nula vira false; true e false presentes são preservados
        'rapida', case when jsonb_typeof(x -> 'rapida') = 'boolean' then x -> 'rapida' else 'false'::jsonb end)
        -- cópia antiga (sem prazo original): o prazo que ela tinha vira a referência original, marcada como legado
        || case when x ? 'prazo_original' or x ->> 'prazo' is null then '{}'::jsonb else jsonb_build_object('prazo_original', x -> 'prazo', 'prazo_legado', true) end), '[]'::jsonb) from jsonb_array_elements(todas) x)) r
    on conflict (id) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into novas from inseridas;
  n_dem := coalesce(array_length(novas, 1), 0);

  -- o gatilho que sobe a versão da demanda a cada tarefa gravada fica desligado só durante esta transação (a restauração devolve a versão e a data de atualização da cópia;
  -- cópias antigas, sem versão, entram com versão 1). Se algo falhar, a transação inteira é desfeita, inclusive esta troca.
  alter table public.tarefas disable trigger tarefas_versao;

  -- só as tarefas das demandas inseridas agora: uma demanda que já existia fica exatamente como está, com as tarefas que tem
  -- a cópia não traz a data de criação das tarefas (a ordem vem de "posicao"): as colunas são listadas e essa data recebe o momento da restauração
  insert into public.tarefas (id, user_id, demanda_id, texto, concluida, posicao, criado_em, atualizado_em)
  select r.id, r.user_id, r.demanda_id, r.texto, coalesce(r.concluida, false), r.posicao, now(), now()
  from jsonb_populate_recordset(null::public.tarefas,
    (select coalesce(jsonb_agg(t || jsonb_build_object('user_id', coalesce((select a.usuario from _autoria a where a.tipo = 'tarefas' and a.id = t ->> 'id'), dono), 'demanda_id', x ->> 'id')), '[]'::jsonb)
     from jsonb_array_elements(todas) x, jsonb_array_elements(coalesce(x -> 'tarefas', '[]'::jsonb)) t
     where (x ->> 'id')::uuid = any (novas))) r
  on conflict (id) do nothing;
  get diagnostics n_tar = row_count;
  alter table public.tarefas enable trigger tarefas_versao;

  -- dias indisponíveis (cópias da versão 2): o que já existe com o mesmo identificador não é tocado; o vencimento das demandas vem como estava na cópia, sem recalcular.
  -- periodo_id (cópias feitas depois da migração dos períodos) liga os dias do mesmo período; cópias sem ele restauram cada dia como avulso, com o mesmo efeito no cálculo
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dias_indisponiveis' and column_name = 'periodo_id') then
    insert into public.dias_indisponiveis (id, user_id, data, descricao, categoria, criado_em, atualizado_em, periodo_id)
    select (x ->> 'id')::uuid, coalesce((select a.usuario from _autoria a where a.tipo = 'dias_indisponiveis' and a.id = x ->> 'id'), dono), (x ->> 'data')::date, x ->> 'descricao', x ->> 'categoria', coalesce((x ->> 'criado_em')::timestamptz, now()), now(), nullif(x ->> 'periodo_id', '')::uuid
    from jsonb_array_elements(coalesce(j -> 'dias_indisponiveis', '[]'::jsonb)) x
    on conflict (id) do nothing;
  else   -- projeto ainda sem a migração dos períodos: cada dia volta como avulso, com o mesmo efeito no cálculo
    insert into public.dias_indisponiveis (id, user_id, data, descricao, categoria, criado_em, atualizado_em)
    select (x ->> 'id')::uuid, coalesce((select a.usuario from _autoria a where a.tipo = 'dias_indisponiveis' and a.id = x ->> 'id'), dono), (x ->> 'data')::date, x ->> 'descricao', x ->> 'categoria', coalesce((x ->> 'criado_em')::timestamptz, now()), now()
    from jsonb_array_elements(coalesce(j -> 'dias_indisponiveis', '[]'::jsonb)) x
    on conflict (id) do nothing;
  end if;
  get diagnostics n_dias = row_count;

  -- entradas (cópias da versão 3), depois das demandas porque uma entrada convertida aponta para a sua demanda: o vínculo só é refeito se a demanda existe neste projeto
  -- (senão a anotação volta como ativa, com o conteúdo original). Versão e datas vêm como estavam na cópia; o que já existe com o mesmo identificador não é tocado.
  insert into public.entradas (id, user_id, titulo, texto, cor, fixada, arquivada_em, demanda_id, versao, criado_em, atualizado_em)
  select (x ->> 'id')::uuid, coalesce((select a.usuario from _autoria a where a.tipo = 'entradas' and a.id = x ->> 'id'), dono), coalesce(x ->> 'titulo', ''), coalesce(x ->> 'texto', ''), (x ->> 'cor')::smallint, coalesce((x ->> 'fixada')::boolean, false),
         (x ->> 'arquivada_em')::timestamptz,
         case when (x ->> 'demanda_id')::uuid in (select id from public.demandas) then (x ->> 'demanda_id')::uuid end,
         coalesce((x ->> 'versao')::integer, 1), coalesce((x ->> 'criado_em')::timestamptz, now()), coalesce((x ->> 'atualizado_em')::timestamptz, now())
  from jsonb_array_elements(coalesce(j -> 'entradas', '[]'::jsonb) || coalesce(j -> 'entradas_arquivadas', '[]'::jsonb)) x
  on conflict (id) do nothing;
  get diagnostics n_ent = row_count;

  -- eventos e lembretes da Agenda (cópias da versão 4): versão e datas vêm como estavam; o que já existe com o mesmo identificador não é tocado
  insert into public.eventos (id, user_id, titulo, tipo, data, dia_inteiro, inicio, fim, descricao, aviso_min, versao, criado_em, atualizado_em)
  select (x ->> 'id')::uuid, coalesce((select a.usuario from _autoria a where a.tipo = 'eventos' and a.id = x ->> 'id'), dono), x ->> 'titulo', x ->> 'tipo', (x ->> 'data')::date, coalesce((x ->> 'dia_inteiro')::boolean, false), nullif(x ->> 'inicio', '')::time, nullif(x ->> 'fim', '')::time,
         coalesce(x ->> 'descricao', ''), (x ->> 'aviso_min')::integer, coalesce((x ->> 'versao')::integer, 1), coalesce((x ->> 'criado_em')::timestamptz, now()), coalesce((x ->> 'atualizado_em')::timestamptz, now())
  from jsonb_array_elements(coalesce(j -> 'eventos', '[]'::jsonb)) x
  on conflict (id) do nothing;
  get diagnostics n_eve = row_count;

  -- rascunhos (versão 5): só para a conta que gerou a cópia, se existir aqui; chave já ocupada por rascunho aberto não é tocada; o conteúdo não é interpretado
  if to_regclass('public.rascunhos') is not null and jsonb_typeof(j -> 'rascunhos') = 'array' and nullif(j ->> 'rascunhos_de', '') is not null then
    insert into public.rascunhos (id, user_id, chave, dados, versao, ultima_op)
    select (x ->> 'id')::uuid, u.id, x ->> 'chave', x -> 'dados', 1, (x ->> 'id')::uuid
    from jsonb_array_elements(j -> 'rascunhos') x join auth.users u on lower(btrim(u.email)) = lower(btrim(j ->> 'rascunhos_de'))
    where jsonb_typeof(x -> 'dados') = 'object'
      and not exists (select 1 from public.rascunhos r where r.user_id = u.id and r.chave = x ->> 'chave' and r.estado = 'aberto')
    on conflict (id) do nothing;
    get diagnostics n_ras = row_count;
  end if;
  select count(*) into n_sem_autor from (
    select 1 from jsonb_array_elements(todas) x where not exists (select 1 from _autoria a where a.tipo = 'demandas' and a.id = x ->> 'id')) q;

  raise notice 'Restauradas % demanda(s), % tarefa(s), % dia(s) indisponível(is), % entrada(s) e % evento(s), e % rascunho(s) da conta de origem; % demanda(s) sem autoria mapeada voltaram para a conta administradora; o que já existia não foi tocado.', n_dem, n_tar, n_dias, n_ent, n_eve, n_ras, n_sem_autor;
end
$restaurar$;
