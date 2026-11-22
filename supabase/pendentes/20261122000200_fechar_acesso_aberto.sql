-- ARQUIVO PENDENTE: fica em supabase/pendentes/, FORA de supabase/migrations/, de propósito (decisão 92, passo 2 de 2). Um "db push" comum só enxerga a pasta de migrações e, assim, não aplica o
-- fechamento antes de o código novo (com Supabase Auth) estar publicado e verificado: o código anterior ainda chama executar_como_titular.
-- Para a ativação (docs/plano-ativacao-autenticacao.md), com autorização: git mv supabase/pendentes/20261122000200_fechar_acesso_aberto.sql supabase/migrations/ , dry-run listando só ela, e então db push.
--
-- Fecha o acesso aberto: remove as duas funções que permitiam consultar e alterar o painel SEM identidade autenticada (a chave de serviço chamava executar_como_titular, que assumia o titular
-- pela lista protegida). Depois deste passo, o painel só se lê e se altera com o JWT de uma conta autorizada (RLS + conta_autorizada()), e o papel de serviço executa somente a rotina diária.
-- Sem CASCADE: se algo independente dependesse delas, a migração falharia em vez de levá-lo junto. Seguro para repetir (if exists).
drop function if exists public.executar_como_titular(text, jsonb);
drop function if exists public.assumir_titular();
