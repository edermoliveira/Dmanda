-- SOMENTE LEITURA. Cópia funcional de TODAS as tabelas de public em um único JSON (uma chave por tabela, cada uma com a lista completa de linhas), para guardar em lugar privado ANTES de qualquer
-- operação real no banco (docs/plano-publicacao-consolidada.md). Completa a cópia versão 4 do aplicativo, que não leva os registros do dia, as opções, o Para hoje, os resumos e as execuções da rotina.
--   npx supabase db query --remote --read-only -f supabase/propostas/copia_funcional_leitura.sql --output-format json > dmanda-copia-funcional-AAAA-MM-DD.json
-- (confira as opções com "npx supabase db query --help" na versão instalada da CLI). O arquivo tem dados reais: guardar só fora do repositório (o .gitignore ignora dmanda-copia-*.json) e nunca enviar a serviço nenhum.
-- Não inclui a conta, a senha nem a lista de acesso (dmanda_privado, auth): isso fica fora desta cópia. Para conferir depois, comparar o número de linhas de cada chave com a consulta
-- supabase/propostas/verificar_migracoes_1_4_hospedado.sql (linhas "contagem public.<tabela>").
-- O texto passa por XML (query_to_xml) só para executar uma consulta por tabela sem listar as tabelas à mão; por isso & < > voltam ao normal antes de virar JSON (o teste testar:banco confere com um texto que os contém).
select jsonb_object_agg(t.table_name,
  replace(replace(replace(((xpath('/row/j/text()', query_to_xml(format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) as j from public.%I x', t.table_name), false, true, '')))[1])::text, '&lt;', '<'), '&gt;', '>'), '&amp;', '&')::jsonb) as copia
from information_schema.tables t where t.table_schema = 'public' and t.table_type = 'BASE TABLE';
