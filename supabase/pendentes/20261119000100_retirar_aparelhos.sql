-- ARQUIVO PENDENTE: fica em supabase/pendentes/, FORA de supabase/migrations/, de propósito. Um "db push" comum só enxerga a pasta de migrações e, assim, não aplica esta retirada antes de o código novo estar publicado e verificado.
-- Para a fase 2 (docs/plano-retirada-aparelhos.md), com autorização: git mv supabase/pendentes/20261119000100_retirar_aparelhos.sql supabase/migrations/ , dry-run listando só ela, e então db push.
-- Dmanda: retirada dos aparelhos autorizados e do acesso por código (decisão de 17/11/2026), PASSO 2 de 2. Aplicar SÓ depois do passo 1 (20261119000000_entrada_direta) e do código novo no ar.
-- Migração aditiva sobre as 20261118000000 e 20261118000100 (que ficam como estão: foram aplicadas e são o histórico). Não toca em tabela de dados, em política de RLS nem em privilégio de dados.
--
-- O que sai (todos exclusivos do recurso; nada além disto é removido, e nenhum DROP usa CASCADE: se algo independente dependesse deles, a migração falharia em vez de levá-lo junto):
--   funções: estado_aparelho, criar_convite_aparelho, listar_aparelhos, revogar_aparelho, consumir_convite_aparelho, registrar_aparelho, criar_convite_terminal, exigir_aparelhos,
--            revogar_todos_aparelhos e dmanda_privado.aparelho_autorizado;
--   tabelas: dmanda_privado.aparelhos, convites_aparelho, falhas_pareamento e config_acesso (a flag exigir_aparelho).
-- O que fica: a lista protegida (dmanda_privado.acesso_autorizado), o hook de cadastro fechado, titular_autorizado() e conta_autorizada(), que todas as políticas de RLS já chamam.
--   conta_autorizada() volta a significar só "e-mail da lista protegida e provedor aceito", como antes da decisão 82.
-- Atenção: o código antigo (proxy, tela /acesso, seção de Aparelhos) chama as funções removidas. Depois deste passo ele deixa de funcionar; por isso o código novo vem antes.

-- ---------- 1) a decisão de acesso volta a ser só a do titular ----------
create or replace function dmanda_privado.conta_autorizada() returns boolean
language sql stable security definer set search_path = '' as $$
  select dmanda_privado.titular_autorizado()
$$;
revoke all on function dmanda_privado.conta_autorizada() from public, anon, authenticated;
grant execute on function dmanda_privado.conta_autorizada() to authenticated;

-- ---------- 2) retirada dos objetos do recurso (sem CASCADE) ----------
drop function public.estado_aparelho();
drop function public.criar_convite_aparelho(text);
drop function public.listar_aparelhos();
drop function public.revogar_aparelho(uuid);
drop function public.consumir_convite_aparelho(text);
drop function public.registrar_aparelho(uuid, uuid, text);
drop function public.criar_convite_terminal(text);
drop function public.exigir_aparelhos(boolean);
drop function public.revogar_todos_aparelhos();
drop function dmanda_privado.aparelho_autorizado();
drop table dmanda_privado.aparelhos;
drop table dmanda_privado.convites_aparelho;
drop table dmanda_privado.falhas_pareamento;
drop table dmanda_privado.config_acesso;
