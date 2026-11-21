# Demonstração da restauração em um projeto Supabase descartável (preparada em 20/11/2026, não executada)

> **Estado em 21/11/2026: executada com sucesso e projeto excluído** (projeto `dmanda-teste-restauracao-2026-11-21`, ref `jjjkcrikpmqsaowwjhlb`; resultados em `CONTINUIDADE-DMANDA.md`, seção AV). Ajustes feitos na execução: o projeto foi criado pela CLI (`supabase projects create`) e a conta de teste por SQL (lista protegida e depois `auth.users`, sem e-mail), em vez do painel; todas as escritas usaram `--remote=REF_TESTE`. A exclusão foi `supabase projects delete REF_TESTE`.

Objetivo (Issue #4): provar, num ambiente hospedado de verdade e **só com dados fictícios**, que uma cópia v4 gerada pelo aplicativo é restaurada por `supabase/restaurar-copia.sql` com o conteúdo e os vínculos idênticos. Hoje a restauração está demonstrada **só em PGlite** (`testar:restauracao-v4`, 31 verificações, e `testar:banco`); o que falta é o Supabase hospedado.

Este procedimento **não** cria v5, backup automático nem armazenamento externo, e **nunca** usa o projeto real (`gmxoosvgfcydccyeudej`) nem as cópias privadas. Cada passo marcado com **[Éder]** é uma ação dele; cada passo marcado com **[aprovação]** é uma escrita no projeto de TESTE e só roda com a aprovação pontual da ferramenta.

## Pré-requisitos

1. **[Éder, painel do Supabase]** Criar um projeto novo, **gratuito**, com nome `dmanda-teste-restauracao` (qualquer região; senha do banco nova e só dele). Custo: nenhum no plano gratuito (decisão de 27/10/2026: nada pago). Conferir no painel o limite de projetos ativos do plano gratuito antes de criar. Um projeto gratuito pode ser pausado depois de 7 dias sem atividade: a demonstração cabe numa sessão.
2. Anotar a **referência do projeto de teste** (a sequência de letras na URL do painel). Ela **tem de ser diferente** de `gmxoosvgfcydccyeudej`. Daqui em diante `REF_TESTE`.
3. **Não** rodar `supabase link` no checkout (isso trocaria o projeto vinculado, hoje o real, em `supabase/.temp/project-ref`). Todos os comandos usam `--remote=REF_TESTE` de forma explícita. A senha do banco de teste vai por `SUPABASE_DB_PASSWORD` no ambiente do terminal, nunca em arquivo nem no chat.
4. Trava de identidade, **antes de qualquer escrita**, no PowerShell, em `C:\Users\Éder\Desktop\Dmanda-release`:
   `npx supabase migration list --remote=REF_TESTE`
   A primeira linha de saída mostra `Target: project <nome> (<ref>)`. Só siga se o nome for `dmanda-teste-restauracao`, o ref for o de teste, **e** o histórico remoto estiver vazio (todas as migrações locais sem par remoto).

## Passos

1. **Esquema [aprovação].** `npx supabase --yes db push --remote=REF_TESTE --dry-run` deve listar **todas** as migrações de `supabase/migrations/` (28 hoje), porque o projeto é novo. Depois, `npx supabase --yes db push --remote=REF_TESTE`. Se alguma migração falhar, **parar** e registrar qual (é informação valiosa: nenhuma migração já foi aplicada do zero num Supabase hospedado). Conferir: `npx supabase migration list --remote=REF_TESTE` sem divergência.
2. **Conta de teste [Éder, painel]** Em Authentication > Users, criar **um único** usuário com um e-mail de teste (por exemplo `restauracao.teste@example.com`). O `restaurar-copia.sql` exige exatamente 1 usuário em `auth.users` e atribui tudo a ele.
3. **Lista protegida [aprovação].** `npx supabase --yes db query --remote=REF_TESTE "insert into dmanda_privado.acesso_autorizado (email) values ('restauracao.teste@example.com')"` (só para o projeto de teste ficar com a mesma configuração de acesso do real).
4. **Arquivo fictício (local, sem rede).** `npm run copia:ficticia` gera, fora do repositório (pasta temporária do sistema), `dmanda-copia-FICTICIA-v4-AAAA-MM-DD.json` (cópia v4 produzida pela rota real `/api/exportar` contra um banco de teste semeado: demandas ativas, finalizada e arquivada, tarefas, dias avulsos e um período, entradas ativas, arquivada e convertida em demanda, eventos, um texto com `&`, `<`, aspas e acento) e `restaurar-copia-FICTICIA.sql` (o `restaurar-copia.sql` verdadeiro com esse JSON embutido). O comando imprime os caminhos, o SHA-256 e as contagens; o script recusa gravar se algum assunto não começar por `FICTÍCIO`.
5. **Restauração [aprovação].** `npx supabase --yes db query --remote=REF_TESTE -f <caminho>\restaurar-copia-FICTICIA.sql`. É uma transação só: se algo falhar, nada é gravado.
6. **Verificação do conteúdo e dos vínculos (leitura).** `npx supabase db query --remote=REF_TESTE --read-only -f supabase/propostas/copia_funcional_leitura.sql --output-format json > <pasta>\restaurado-teste.json` e depois
   `npm run copia:comparar -- <caminho>\dmanda-copia-FICTICIA-v4-AAAA-MM-DD.json <pasta>\restaurado-teste.json`
   O comparador confere **campo a campo** demandas (ativas e arquivadas), tarefas (texto, estado, posição e a demanda), entradas, o vínculo entrada para demanda e de volta, eventos, dias (inclusive o período a que cada dia pertence) e que o humor do dia e as vagas do Para hoje, que a v4 não leva, ficaram vazios. Imprime só contagens e nomes de campo.
7. **Idempotência [aprovação].** Repetir o passo 5 com o mesmo arquivo e repetir o 6: nada duplicado, comparador idêntico.
8. **Uso depois de restaurar (opcional, só leitura).** `npx supabase db query --remote=REF_TESTE --read-only -f supabase/propostas/verificar_migracoes_1_4_hospedado.sql`: as contagens por tabela batem com o arquivo (demandas 6, tarefas 4, entradas 3, eventos 2, dias 12 na cópia fictícia atual) e o esquema está completo.

## Critérios de sucesso

- Passo 1 sem erro, com o histórico remoto igual ao local.
- Passo 5 termina sem erro; passo 6 termina com `Idêntico: o conteúdo restaurado confere com a cópia, campo a campo.` e saída 0 (14 conferências ok).
- Passo 7: contagens inalteradas e comparador idêntico.

## Falhas e como tratar

- **Identidade duvidosa** (nome ou ref não conferem): parar, nada foi escrito.
- **Migração falha no esquema novo:** registrar o erro e a migração; não corrigir migração já aplicada no real; a correção, se houver, é uma decisão à parte.
- **Restauração com erro:** a transação desfaz tudo; ler a mensagem (formato do arquivo, número de usuários diferente de 1, conta ausente) e refazer o passo certo.
- **Conexão cai no meio de um comando de escrita:** antes de repetir, ler as contagens (passo 8); a restauração é idempotente e o esquema pode ser conferido por `migration list`.
- **Comparador acusa diferença:** guardar a saída (só contagens e nomes de campo) e investigar o campo; é um defeito real do caminho cópia v4 para restauração.

## O que esta demonstração prova e o que não prova

Prova: a restauração por SQL num PostgreSQL hospedado do Supabase (papéis, versão, plano de execução), com o conteúdo e os vínculos idênticos aos da cópia, e a repetição segura. **Não prova:** o volume e os textos reais do Éder (a comparação campo a campo de uma cópia real, antes e depois, já foi feita para a cópia v4 contra a cópia funcional do mesmo projeto, em 20/11/2026), a restauração das tabelas que a v4 não leva (não existe restauração para elas: ver `docs/plano-publicacao-consolidada.md` e `CONTINUIDADE-DMANDA.md`, seção AR), nem recuperação de uma queda real do projeto.

## Limpeza (só com a autorização correspondente)

**[Éder, painel]** pausar ou excluir o projeto `dmanda-teste-restauracao` (excluir é irreversível: só ele decide); apagar o arquivo e o SQL fictícios da pasta temporária; limpar `SUPABASE_DB_PASSWORD` do terminal. Nada disso toca o projeto real nem `Dmanda-backups`.
