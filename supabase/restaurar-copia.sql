-- Restaura uma cópia dos dados do Dmanda (arquivo "dmanda-copia-AAAA-MM-DD.json", menu do avatar > "Baixar cópia dos dados") em um projeto Supabase.
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
--   - Só grava demandas e tarefas (com as arquivadas). Uma demanda que já existe com o mesmo identificador NÃO é tocada nem sobrescrita, nem recebe tarefas.
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
begin
  if j ->> 'formato' is distinct from 'dmanda-exportacao' or j ->> 'versao' is distinct from '1' then
    raise exception 'Este arquivo não é uma cópia do Dmanda (esperado formato dmanda-exportacao, versão 1).';
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
      (select coalesce(jsonb_agg(x || jsonb_build_object('user_id', dono, 'versao', coalesce(x -> 'versao', '1'::jsonb))), '[]'::jsonb) from jsonb_array_elements(todas) x)) r
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

  raise notice 'Restauradas % demanda(s) e % tarefa(s); o que já existia não foi tocado.', n_dem, n_tar;
end
$restaurar$;
