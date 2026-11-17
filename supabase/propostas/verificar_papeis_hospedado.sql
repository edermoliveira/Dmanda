-- SOMENTE LEITURA. Verificação do Supabase hospedado para a entrada direta (docs/plano-retirada-aparelhos.md). Rodar só com autorização específica:
--   npx supabase db query --remote --read-only -f supabase/propostas/verificar_papeis_hospedado.sql
-- (confira o nome da opção de destino com "npx supabase db query --help" na versão instalada da CLI). Uma única consulta, para a CLI mostrar tudo de uma vez. Não imprime dado nenhum do Dmanda.
--
-- O que esperar ANTES da fase 1 (nada criado ainda):
--   authenticator -> authenticated: membro=true set=true  (é isso que permite "set local role authenticated" dentro da função, porque o PostgreSQL confere o papel da SESSÃO)
--   authenticator -> service_role e anon: membro=true set=true
--   papel authenticated e authenticator: super=false bypassrls=false (a RLS vale); service_role: bypassrls=true
--   nenhuma linha "função ..." ; aparelhos: tabela=dmanda_privado.aparelhos
-- DEPOIS da fase 1:
--   função assumir_titular: definer=true, dono=postgres, config={search_path=""}, acl só postgres e service_role
--   função executar_como_titular: definer=false (INVOKER), dono=postgres, config={search_path=""}, acl só postgres e service_role
-- DEPOIS da fase 2:
--   aparelhos: tabela=ausente
-- Se authenticator NÃO for membro com set=true de authenticated, PARE: a função falharia com "permission denied to set role" (nada a corrigir no aplicativo; corrigir a concessão de papel é decisão à parte).
select 'servidor' as verificacao, current_setting('server_version') as resultado
union all
select 'papel ' || rolname, format('super=%s bypassrls=%s login=%s', rolsuper, rolbypassrls, rolcanlogin)
  from pg_roles where rolname in ('authenticator', 'anon', 'authenticated', 'service_role')
union all
select 'authenticator -> ' || r.rolname, format('membro=%s set=%s', pg_has_role('authenticator', r.oid, 'member'), pg_has_role('authenticator', r.oid, 'set'))
  from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')
union all
select 'função ' || p.proname, format('definer=%s dono=%s config=%s acl=%s', p.prosecdef, pg_get_userbyid(p.proowner), p.proconfig, p.proacl)
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('assumir_titular', 'executar_como_titular')
union all
select 'aparelhos', format('tabela=%s', coalesce(to_regclass('dmanda_privado.aparelhos')::text, 'ausente'))
order by 1;
