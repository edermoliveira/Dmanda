-- Restaura uma cópia dos dados do Dmanda (arquivo "dmanda-copia-AAAA-MM-DD.json", menu do avatar > "Baixar cópia dos dados") em um projeto Supabase.
-- Aceita cópias da versão 3 (demandas, tarefas, dias indisponíveis e entradas), da versão 2 (sem entradas) e da versão 1 (antigas, sem dias indisponíveis; o prazo delas vira a referência original, marcada como legado).
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
--   - Só grava demandas, tarefas (com as arquivadas), dias indisponíveis e entradas (ativas, arquivadas e já convertidas, com o vínculo à demanda). Uma demanda ou entrada que já existe com o mesmo identificador NÃO é tocada nem sobrescrita, nem recebe tarefas.
--   - Tudo é atribuído ao único usuário do projeto (a conta do Secretário): serve ao mesmo projeto e também a um projeto novo, com outro identificador de usuário.
--   - Se o projeto não tiver exatamente 1 usuário, nada é gravado. A conta, a senha, a lista de acesso e as migrações NÃO fazem parte da cópia e precisam existir antes.
--   - Exige o dono da tabela (no SQL Editor do Supabase você já é): o script desliga e religa um gatilho dentro da própria transação.
--   - Não restaura: preferências do navegador (tema, visão, rascunhos), resumos e registros da rotina diária (a rotina recalcula), nem a data de criação de cada tarefa.
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
begin
  if j ->> 'formato' is distinct from 'dmanda-exportacao' or j ->> 'versao' not in ('1', '2', '3') then
    raise exception 'Este arquivo não é uma cópia do Dmanda (esperado formato dmanda-exportacao, versão 1, 2 ou 3).';
  end if;
  select count(*) into qtd from auth.users;
  if qtd <> 1 then
    raise exception 'Esperado exatamente 1 usuário neste projeto; encontrados %. Nada foi gravado.', qtd;
  end if;
  select id into dono from auth.users;

  todas := coalesce(j -> 'demandas', '[]'::jsonb) || coalesce(j -> 'arquivadas', '[]'::jsonb);

  with inseridas as (
    insert into public.demandas
    select r.*
    from jsonb_populate_recordset(null::public.demandas,
      (select coalesce(jsonb_agg(x || jsonb_build_object('user_id', dono, 'versao', coalesce(x -> 'versao', '1'::jsonb), 'prazo_legado', coalesce(x -> 'prazo_legado', 'false'::jsonb))
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
    (select coalesce(jsonb_agg(t || jsonb_build_object('user_id', dono, 'demanda_id', x ->> 'id')), '[]'::jsonb)
     from jsonb_array_elements(todas) x, jsonb_array_elements(coalesce(x -> 'tarefas', '[]'::jsonb)) t
     where (x ->> 'id')::uuid = any (novas))) r
  on conflict (id) do nothing;
  get diagnostics n_tar = row_count;
  alter table public.tarefas enable trigger tarefas_versao;

  -- dias indisponíveis (cópias da versão 2): o que já existe com o mesmo identificador não é tocado; o vencimento das demandas vem como estava na cópia, sem recalcular
  insert into public.dias_indisponiveis (id, user_id, data, descricao, categoria, criado_em, atualizado_em)
  select (x ->> 'id')::uuid, dono, (x ->> 'data')::date, x ->> 'descricao', x ->> 'categoria', coalesce((x ->> 'criado_em')::timestamptz, now()), now()
  from jsonb_array_elements(coalesce(j -> 'dias_indisponiveis', '[]'::jsonb)) x
  on conflict (id) do nothing;
  get diagnostics n_dias = row_count;

  -- entradas (cópias da versão 3), depois das demandas porque uma entrada convertida aponta para a sua demanda: o vínculo só é refeito se a demanda existe neste projeto
  -- (senão a anotação volta como ativa, com o conteúdo original). Versão e datas vêm como estavam na cópia; o que já existe com o mesmo identificador não é tocado.
  insert into public.entradas (id, user_id, titulo, texto, cor, fixada, arquivada_em, demanda_id, versao, criado_em, atualizado_em)
  select (x ->> 'id')::uuid, dono, coalesce(x ->> 'titulo', ''), coalesce(x ->> 'texto', ''), (x ->> 'cor')::smallint, coalesce((x ->> 'fixada')::boolean, false),
         (x ->> 'arquivada_em')::timestamptz,
         case when (x ->> 'demanda_id')::uuid in (select id from public.demandas) then (x ->> 'demanda_id')::uuid end,
         coalesce((x ->> 'versao')::integer, 1), coalesce((x ->> 'criado_em')::timestamptz, now()), coalesce((x ->> 'atualizado_em')::timestamptz, now())
  from jsonb_array_elements(coalesce(j -> 'entradas', '[]'::jsonb) || coalesce(j -> 'entradas_arquivadas', '[]'::jsonb)) x
  on conflict (id) do nothing;
  get diagnostics n_ent = row_count;

  raise notice 'Restauradas % demanda(s), % tarefa(s), % dia(s) indisponível(is) e % entrada(s); o que já existia não foi tocado.', n_dem, n_tar, n_dias, n_ent;
end
$restaurar$;
