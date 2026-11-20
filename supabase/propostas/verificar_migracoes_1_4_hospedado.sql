-- SOMENTE LEITURA. Verificação do Supabase hospedado para as duas migrações do subbloco 1.4 (docs/plano-publicacao-consolidada.md). Rodar só com autorização específica:
--   npx supabase db query --remote --read-only -f supabase/propostas/verificar_migracoes_1_4_hospedado.sql
-- Uma única consulta; não imprime dado nenhum do Dmanda (só nomes de tabela, contagens e propriedades de objetos). Serve antes (linha de base das contagens) e depois (estado esperado):
--
-- ANTES de aplicar 20261120000000 e 20261120000100:
--   contagem public.<tabela>: anotar todas (o "depois" precisa ser igual: as migrações não escrevem em nenhuma tabela existente)
--   dias_indisponiveis.periodo_id: ausente | tabela periodos_operacoes: ausente | funções do período e retorno_setor_info: ausentes
--   executar_como_titular: lista sem os três nomes do período (salvar_periodo_indisponivel, excluir_periodo_indisponivel, conferir_periodo_por_operacao)
-- DEPOIS:
--   dias_indisponiveis.periodo_id: presente | periodos_operacoes: presente, com RLS ligada, authenticated com select e insert e sem update nem delete
--   salvar_periodo_indisponivel, excluir_periodo_indisponivel, dias_do_periodo, conferir_periodo_por_operacao, retorno_setor_info: definer=false, config={search_path=""}, EXECUTE só do dono e de authenticated
--   executar_como_titular: definer=false, config={search_path=""}, EXECUTE só do dono e de service_role, e a lista com os três nomes novos
--   demanda_json lê retorno_setor_info | linhas com periodo_id: 0 (nenhum período foi cadastrado ainda)
--   contagens iguais às de antes (mais a nova tabela periodos_operacoes, com 0)
-- Qualquer divergência: PARE e leia o resultado antes de qualquer outra ação (ver "Critérios de parada" no plano).
select 'servidor' as verificacao, current_setting('server_version') as resultado
union all
select 'ultima migração registrada',
  case when to_regclass('supabase_migrations.schema_migrations') is null then 'sem histórico (banco local)'
       else (xpath('/row/n/text()', query_to_xml('select max(version) as n from supabase_migrations.schema_migrations', false, true, '')))[1]::text end
union all
select 'contagem public.' || t.table_name,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t.table_name), false, true, '')))[1]::text
  from information_schema.tables t where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
union all
select 'dias_indisponiveis.periodo_id',
  case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dias_indisponiveis' and column_name = 'periodo_id') then 'presente' else 'ausente' end
union all
select 'linhas com periodo_id',
  case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dias_indisponiveis' and column_name = 'periodo_id')
       then (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.dias_indisponiveis where periodo_id is not null', false, true, '')))[1]::text
       else 'n/a' end
union all
select 'tabela periodos_operacoes',
  case when to_regclass('public.periodos_operacoes') is null then 'ausente'
       else format('presente rls=%s select=%s insert=%s update=%s delete=%s', (select relrowsecurity from pg_class where oid = to_regclass('public.periodos_operacoes')),
                   has_table_privilege('authenticated', to_regclass('public.periodos_operacoes'), 'select'), has_table_privilege('authenticated', to_regclass('public.periodos_operacoes'), 'insert'),
                   has_table_privilege('authenticated', to_regclass('public.periodos_operacoes'), 'update'), has_table_privilege('authenticated', to_regclass('public.periodos_operacoes'), 'delete')) end
union all
select 'função ' || p.proname, format('definer=%s dono=%s config=%s acl=%s', p.prosecdef, pg_get_userbyid(p.proowner), p.proconfig, p.proacl)
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('salvar_periodo_indisponivel', 'excluir_periodo_indisponivel', 'dias_do_periodo', 'conferir_periodo_por_operacao', 'retorno_setor_info', 'executar_como_titular')
union all
select 'executar_como_titular lista ' || n,
  case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'executar_como_titular' and position('''' || n || '''' in pg_get_functiondef(p.oid)) > 0) then 'presente' else 'ausente' end
  from unnest(array['salvar_periodo_indisponivel', 'excluir_periodo_indisponivel', 'conferir_periodo_por_operacao', 'salvar_dia_indisponivel', 'listar_demandas']) as n
union all
select 'demanda_json lê retorno_setor_info',
  case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'demanda_json' and position('retorno_setor_info' in pg_get_functiondef(p.oid)) > 0) then 'sim' else 'não' end
order by 1;
