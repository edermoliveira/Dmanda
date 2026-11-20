# Plano de implantação em duas fases: entrada direta e retirada dos aparelhos

> **Substituído em 19/11/2026 por `docs/plano-publicacao-consolidada.md`** (candidato consolidado, com as duas migrações do subbloco 1.4). Este texto fica como história.

Estado: **EXECUTADO em 17/11/2026** (fase 1, publicação, validação do domínio e fase 2; ver "Registro da execução" no fim). O texto abaixo é o roteiro como foi preparado e é mantido como história. Substitui `docs/plano-publicacao-etapa-6.md` no que toca aos aparelhos. Cada passo marcado com **[autorização]** só roda depois de o Éder autorizar aquele passo de forma específica. O assistente nunca lê nem imprime `.env*`, chaves ou o conteúdo de dados reais.

Base: `origin/main` = `b2adb39cad10c290fddf31530653c65f55a8a56f`. Candidato: branch `retirada/aparelhos` (o SHA final aprovado é o que o Éder indicar; abaixo, `$SHA`).

## Como as duas fases ficam separadas

- A fase 1 é `supabase/migrations/20261119000000_entrada_direta.sql` (aditiva: só cria `assumir_titular` e `executar_como_titular`).
- A fase 2 é `20261119000100_retirar_aparelhos.sql` e está em `supabase/pendentes/`, **fora** de `supabase/migrations/`. A CLI do Supabase (3.2.0) não tem opção de aplicar "só até a versão X"; `db push` aplica tudo o que está em `migrations/` e ainda não consta no histórico. Com a retirada fora da pasta, um `db push` comum, em qualquer momento, só enxerga a fase 1. Nenhuma migração já aplicada foi renomeada ou alterada.
- A fase 2 só entra em `migrations/` (com `git mv`, na máquina de quem aplica) depois que o código novo estiver publicado e verificado.
- O banco de teste (`testar:banco`, `dev:teste`, `testar:acesso-direto`) aplica as duas pastas juntas e por isso testa o estado final.

Regra de ouro: **o código novo e o código antigo convivem com o banco depois da fase 1; só o código novo convive com o banco depois da fase 2.** A exigência de aparelho (`exigir_aparelho`) tem de ficar **desligada** até a fase 2 (as claims da entrada direta não trazem `session_id`; com a exigência ligada a função devolveria listas vazias). Hoje ela está desligada.

## Antes de começar (os dois lados conferem)

1. Árvore limpa no `$SHA` aprovado: `git status --short` vazio, `git rev-parse HEAD` igual ao SHA aprovado, `git ls-remote origin refs/heads/main` igual a `b2adb39...`.
2. **[ação do Éder, no site da Vercel]** conferir em Settings > Environment Variables (Production) que existem `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` (nomes apenas, sem copiar valores) e anotar o endereço do deploy de produção atual (o "deploy anterior", usado na recuperação).
3. Cópia de segurança fresca: o Éder baixa a cópia v4 pelo aplicativo atual (Baixar cópia dos dados) e a guarda; o snapshot SQL de `Dmanda-backups` (`snapshot-sql-2026-11-17-antes-da-etapa-6.json`) segue preservado.
4. `npx supabase --version` (3.2.0 ou superior) e `npx supabase db push --help` para confirmar o nome da opção de destino (`--remote`; as notas antigas dizem `--linked`). Nunca `db reset`. Os comandos abaixo usam `--remote`.
5. Registrar o estado do histórico: `npx supabase migration list --remote` (deve acabar em `20261118000100`).

## Fase 0: o que ainda falta provar no Supabase hospedado (só leitura) [autorização]

O PGlite é um PostgreSQL de verdade, e o teste `testar:banco` (bloco "papéis") reproduz o caminho do PostgREST (sessão `authenticator`, `set local role service_role`, função, `set local role authenticated`) e observa o papel efetivo com um gatilho de sonda. Mas **não prova** o hospedado. O que só o hospedado mostra:

- (a) que `authenticator` é membro de `authenticated` com a opção SET (o PostgreSQL confere o papel da **sessão**, não o corrente; ver https://www.postgresql.org/docs/17/sql-set-role.html);
- (b) que a chave de serviço, pela API REST, chega à função e a troca de papel funciona;
- (c) o papel efetivo durante a execução: no hospedado não há sonda, só a inferência (se a troca falhasse, a chamada devolveria `42501 permission denied to set role`; se passou, a instrução seguinte já roda como `authenticated`).

Comando (uma consulta, sem dados do Dmanda):

```
npx supabase db query --remote --read-only -f supabase/propostas/verificar_papeis_hospedado.sql
```

Critério de parada: `authenticator -> authenticated` com `membro=true set=true`; `authenticated` e `authenticator` com `super=false bypassrls=false`. Se não for assim, **parar**: nada foi aplicado, o aplicativo atual segue como está, e corrigir a concessão de papéis é decisão à parte.

## Fase 1: banco (entrada direta) [autorização]

1. Dry-run: `npx supabase db push --remote --dry-run`. **Tem de listar exatamente uma migração: `20261119000000_entrada_direta.sql`.** Se listar qualquer outra (inclusive a retirada), parar e não aplicar.
2. Aplicar: `npx supabase db push --remote` (confirmar apenas a mesma lista).
3. Conferir: `npx supabase migration list --remote` (a última é `20261119000000`) e de novo `verificar_papeis_hospedado.sql`: `executar_como_titular` com `definer=false`, `assumir_titular` com `definer=true`, dono `postgres`, `search_path` vazio, `acl` só do dono e do `service_role`.
4. Conferir a exigência (só leitura): `npx supabase db query --remote --read-only "select exigir_aparelho from dmanda_privado.config_acesso"`. **Tem de ser `false`.**
5. Conferir a execução REST com a chave de serviço, sem exibir segredo e sem gravar: `node --env-file=.env.local scripts/verificar-entrada-direta-real.mjs rest`. O script só imprime estados HTTP e contagens; o `--env-file` entrega as variáveis ao processo sem que ninguém as leia. Esperado: leituras 200, função fora da lista e argumento inexistente recusados, sem chave recusado. Comparar as contagens com o que o Éder conhece.

**Parar e não publicar** se: o dry-run listar outra migração; houver erro no `db push`; o passo 4 for `true`; o passo 5 falhar (em especial `42501` ou `permission denied to set role`).

Se a fase 1 falhar: o aplicativo em produção continua sendo o antigo e continua funcionando (a migração é aditiva). Se o `db push` der erro, `migration list --remote` mostra se a migração foi registrada; não há objeto antigo alterado. Se foi aplicada mas a verificação REST falhou, corrigir à frente em migração nova (candidata: nada mudou nos objetos antigos) e, se a decisão for desistir, retirar só as duas funções novas com `drop function public.executar_como_titular(text, jsonb); drop function public.assumir_titular();` (ninguém as usa até a publicação). Nunca aplicar a fase 2.

## Publicação do SHA exato [autorização]

1. Conferir o SHA: `git rev-parse HEAD` = `$SHA` aprovado, e que `b2adb39...` é ancestral (`git merge-base --is-ancestor b2adb39cad10c290fddf31530653c65f55a8a56f HEAD`).
2. Enviar sem reescrever histórico: `git push origin $SHA:main` (fast-forward; a Vercel publica a `main` sozinha). Sem `--force`.
3. Confirmar o deploy do SHA exato: no painel da Vercel, o deploy de Production deve apontar para `$SHA` (ou `gh api repos/edermoliveira/Dmanda/commits/main --jq .sha` igual a `$SHA`, e o status do deploy "Ready").
4. Confirmar o domínio: `node --env-file=.env.local scripts/verificar-entrada-direta-real.mjs dominio https://dmanda-adm.vercel.app`. Esperado: `/`, `/demandas`, `/agenda`, `/config`, `/entradas` com 200, sem cookie e sem segredo no HTML; `/acesso` e `/login` com 307 para `/`; `/config` sem a seção Aparelhos; `/api/exportar` versão 4 com as mesmas contagens da leitura direta; cron sem credencial 401; `/api/sonda` 204.
5. **[ação do Éder, num navegador novo]** abrir o endereço (sem código, sem tela de acesso), conferir Início, Demandas, Agenda e Configurações, criar e apagar uma demanda de teste (ou uma anotação) e baixar a cópia dos dados.

**Parar** (não aplicar a fase 2) se qualquer item falhar. Se o código novo falhar no ar: na Vercel, "Promote to Production" do deploy anterior (código antigo). Isso é seguro porque a fase 2 ainda não foi aplicada: o código antigo ainda encontra os aparelhos e a exigência continua desligada.

## Fase 2: retirada dos aparelhos [autorização]

Só depois de a publicação estar verificada e de o Éder dar o aceite.

1. Na máquina e no `$SHA` da publicação: `git mv supabase/pendentes/20261119000100_retirar_aparelhos.sql supabase/migrations/` (sem commit por enquanto).
2. `npx supabase db push --remote --dry-run`: **tem de listar exatamente `20261119000100_retirar_aparelhos.sql`**. Qualquer outra, parar.
3. `npx supabase db push --remote`. O arquivo só tem DDL sem CASCADE (se algo independente dependesse dos objetos, falharia em vez de levá-lo junto).
4. Conferir: `migration list --remote`; `verificar_papeis_hospedado.sql` com `aparelhos tabela=ausente`; `verificar-entrada-direta-real.mjs rest` e `dominio` de novo; o Éder abre o aplicativo e grava uma demanda de teste.
5. Registrar a mudança no repositório: `git commit` do `git mv` (mensagem em português) e, com autorização, `git push origin main` (publica um deploy idêntico em código; só o arquivo muda de pasta). Atualizar a documentação.

Se a fase 2 falhar: o arquivo é atômico na prática (um lote por migração, mais o registro no histórico), mas **confira** com `migration list --remote` e com `verificar_papeis_hospedado.sql` o que de fato ficou. Se parte dos objetos saiu e a migração não foi registrada, não rodar de novo às cegas: restaurar com a proposta abaixo ou completar à mão o que faltar, depois de ler o estado.

## Recuperação depois da fase 2 (sem restauração destrutiva dos dados)

Depois da fase 2 o código **antigo** não funciona (ele chama funções que deixaram de existir). Por isso a volta é sempre para a frente:

- **O código novo tem um defeito:** não promover o deploy antigo. Promover um deploy anterior **do código novo** na Vercel, ou corrigir e publicar um commit novo (fast-forward). O banco é compatível: o código novo só precisa de `executar_como_titular`.
- **O banco tem um problema:** a retirada não toca em demandas, tarefas, entradas, eventos, dias indisponíveis, perfil nem na lista protegida, então não há o que restaurar dos dados funcionais. A cópia v4 e o snapshot só entram se houver corrupção por outra causa.
- **O Éder decide voltar ao pareamento** (decisão de produto, não falha): (1) rodar `supabase/propostas/restaurar_aparelhos_apos_retirada.sql` (recria, vazios, as tabelas e as funções dos aparelhos; a exigência volta desligada; o `testar:banco` prova que isso não muda nenhum dado), (2) só depois "Promote to Production" do deploy antigo, (3) conferir. Perde-se apenas o que a retirada apagou de propósito: o aparelho do iPhone, o convite não usado e a configuração; o iPhone teria de ser pareado de novo.

## O que continua sem prova

- O hospedado só é provado pelas fases acima (o PGlite não é o Supabase). O papel efetivo na execução hospedada é inferido, não observado.
- O Safari físico e o domínio final só o Éder confere (passo 5 da publicação).
- Acesso aberto: depois da publicação, quem souber o endereço lê, grava, apaga e exporta tudo; o cron segue protegido por `CRON_SECRET`; a chave de serviço e o endereço público passam a ser os únicos limites. Decisão do Éder, a ser refeita perto da conclusão do projeto.

## Registro da execução (17/11/2026)

Executado a partir da branch `retirada/aparelhos`, com autorização expressa do Éder para cada fase. Nenhum segredo nem conteúdo de dado real foi impresso ou guardado no Git.

- **Conferências:** HEAD = `9bfff59e637ba3c3fa0ec780442fe509c34c26a6` (branch `retirada/aparelhos`, árvore limpa, `b2adb39cad10c290fddf31530653c65f55a8a56f` ancestral, `origin/main` ainda em `b2adb39`, avanço por fast-forward). CLI Supabase 3.2.0; destino `--remote` (a ajuda da CLI mostra `--remote`, não `--linked`); projeto vinculado: Dmanda (`gmxoosvgfcydccyeudej`, produção); histórico remoto terminava em `20261118000100`; `exigir_aparelho = false`. Nenhum dos arquivos de migração tem `begin`/`commit` de topo (os `begin` encontrados são corpos de função).
- **Cópia privada antes de mexer:** cópia funcional gerada por leitura (`db query --remote --read-only`) e guardada em `Dmanda-backups/` (fora do Git), com as contagens conferidas contra o banco. Linha de base: 23 demandas, 29 tarefas, 3 entradas, 2 eventos, 1 dia indisponível, 23 opções, 4 vagas do Para hoje, 7 registros do dia, 24 resumos, 23 execuções da rotina, 1 conta autorizada; aparelhos 3, convites 3, falhas 0, configuração 1.
- **Fase 0 (somente leitura):** `authenticator` é membro de `anon`, `authenticated` e `service_role` com a opção SET; `authenticated` e `authenticator` sem superusuário e sem BYPASSRLS; `service_role` com BYPASSRLS; servidor PostgreSQL 17.11.
- **Fase 1:** `db push --remote --dry-run` listou só `20261119000000_entrada_direta.sql`; aplicada (saída 0, histórico sem divergência). Definições efetivas: `assumir_titular` DEFINER e `executar_como_titular` INVOKER, dono `postgres`, `search_path` vazio, EXECUTE só do dono e de `service_role`. `scripts/verificar-entrada-direta-real.mjs rest`: leituras 200 (23 opções, 19 + 4 demandas, 2 entradas, 2 eventos, 1 dia), função fora da lista e argumento inexistente recusados (400), sem chave 401.
- **Publicação:** `git push origin 9bfff59e637ba3c3fa0ec780442fe509c34c26a6:refs/heads/main` (b2adb39..9bfff59, fast-forward). Deploy da Vercel `55pATqRVG4a4aY5N1c3khgaium8S` concluído para esse commit (o deploy anterior, `41YzsmGnaj6hNVjeKyDMJkFYd8uv`, era do `b2adb39` e é a opção de recuperação enquanto os aparelhos existiam). Domínio: roteiro `dominio` todo ok, mais carga real no Edge em contexto novo (computador e iPhone emulado, cinco rotas, nenhum cookie, nenhuma requisição a aparelho, pareamento, convite, `/acesso` ou `/login`, nenhuma resposta 4xx/5xx). Exportação v4 do domínio com ids de demandas iguais aos do banco, guardada em `Dmanda-backups/` (fora do Git).
- **Fase 2:** `git mv` de `supabase/pendentes/20261119000100_retirar_aparelhos.sql` para `supabase/migrations/` (SHA-256 igual antes e depois); `db push --remote --dry-run` listou só essa migração; aplicada (saída 0). `migration list --remote` sem divergência. Ausentes: as tabelas `aparelhos`, `convites_aparelho`, `falhas_pareamento` e `config_acesso` e todas as funções do recurso; `conta_autorizada()` agora só chama `titular_autorizado()`. Contagens funcionais e a conta proprietária idênticas antes e depois. `rest`, `dominio`, carga no Edge e a exportação v4 repetidos: tudo ok, exportação idêntica à da fase 1.
- **Teste ajustado ao estado final:** `scripts/testar-banco.mjs` lia a retirada em `supabase/pendentes/`; passou a lê-la de `supabase/migrations/` (as verificações de conteúdo são as mesmas; 546 verificações ok).
- **Recuperação depois da fase 2:** como descrita acima (só para a frente; o SQL de restauração do pareamento continua sendo decisão expressa do Éder).
- **Limites desta execução:** a Vercel não pôde ser consultada diretamente (sem credencial neste computador): o deploy foi identificado pelo status do GitHub e as três variáveis obrigatórias foram inferidas pela rotina diária de hoje (09:34 UTC, ok); o escopo exato das variáveis, o agendamento do cron no painel, o Safari do iPhone e o uso real no computador seguem para o Éder conferir. O papel efetivo durante a execução no hospedado continua inferido (as leituras devolveram os dados do titular, o que só ocorre com a troca de papel funcionando).
