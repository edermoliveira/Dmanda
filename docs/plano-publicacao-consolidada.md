# Plano de publicação consolidada (19/11/2026)

Estado: **PREPARADO, NÃO EXECUTADO.** Cada passo marcado com **[autorização]** só roda depois de o Éder autorizar aquele passo de forma específica. Este plano substitui `docs/plano-publicacao-etapa-6.md` e `docs/plano-retirada-aparelhos.md`, que ficam como história (o segundo foi executado em 17/11/2026). Nada foi consultado, simulado nem aplicado no Supabase real nem na Vercel para prepará-lo (o GitHub foi consultado só por leitura: `git fetch` e as Issues): o que se diz do ambiente real vem dos registros do repositório e está marcado como **registro, não reconferido**.

## 1. Candidato e intervalo

- Branch local: `bloco/organizacao-estrutural`. **Código verificado: `d5d83e5262ebb15a93e2265e366f24263c79733b`** (todas as verificações da seção 5 foram feitas neste conteúdo). Os commits seguintes da branch só mexem em documentação (`git diff d5d83e5..HEAD --stat` deve listar apenas `docs/`, `CLAUDE.md`, `CONTINUIDADE-DMANDA.md`, `DECISOES.md` e `supabase/LEIA-ME.md`). **O candidato a publicar é o `HEAD` final da branch**, e o Éder aprova o SHA exato (abaixo, `<SHA>`) antes de qualquer envio.
- Base remota consultada por `git fetch` em 19/11/2026: `origin/main` = `1b3b9dba79d79941076720f070956b704ff3c4d0`, que é ancestral do candidato (avanço por fast-forward, sem reescrever histórico). Intervalo exato: `git log --oneline origin/main..<SHA>` e `git diff --stat origin/main..<SHA>`. Até o código verificado: 23 commits e 138 arquivos (4.033 inserções, 2.746 remoções); depois dele, só documentação.
- O que o intervalo traz: subbloco 1.4 (períodos de indisponibilidade com identidade da operação, retorno do setor vindo do servidor, avisos de vencimento antes da chegada), organização estrutural (auxiliar único de testes, definições únicas em `src/lib`, `CLAUDE.md` enxuto) e acabamento técnico (rotas `/marca`, `/pecas` e `/tokens` retiradas, CSS sem consumidor removido, exportação sem 401 indevido, caminhos de falha do auxiliar de testes provados).
- Duas migrações novas, e só elas: `supabase/migrations/20261120000000_periodos_indisponiveis.sql` e `20261120000100_retorno_do_servidor.sql`. Nenhuma migração já aplicada foi reescrita (`git diff --name-status origin/main..<SHA> -- supabase/migrations` mostra só duas linhas `A`).

## 2. O que NÃO está conferido do ambiente real

Registro de 17/11/2026 (`docs/plano-retirada-aparelhos.md`, seção "Registro da execução"): histórico de migrações do Supabase terminando em `20261119000100_retirar_aparelhos`, deploy de produção do commit `9bfff59`, exigência de aparelho removida, entrada direta em uso. **Reconferir antes de começar**, só por leitura e com autorização: `npx supabase migration list --remote` (a última deve ser `20261119000100`), o deploy ativo da Vercel (o SHA que está no ar) e a presença das variáveis `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` (nomes, sem copiar valores). Se algo divergir do registro, **parar** e atualizar este plano antes de seguir.

## 3. Compatibilidade entre código e banco

| Etapa | Código no ar | Banco | Resultado |
|---|---|---|---|
| 0, hoje (registro de 17/11, não reconferido) | o deploy de produção anotado na reconferência (o registro diz `9bfff59`; `origin/main` está em `1b3b9db`, o mesmo código mais o registro da implantação) | até `20261119000100` | funciona |
| A, depois de aplicar as duas migrações | o código atual de produção | + `20261120000000` e `20261120000100` | **compatível** (ver abaixo) |
| B, estado final | candidato | + as duas migrações | funciona (suítes) |
| C, código novo antes das migrações | candidato | até `20261119000100` | **NÃO usar**: cadastrar dia ou período chama `salvar_periodo_indisponivel`, que `executar_como_titular` ainda recusa ("Operação não permitida."); a demanda não traz `retorno`, e então o marco de retorno do setor some **em silêncio** do Início, da Agenda, do Para hoje e das filas (`contagemRetorno` devolve nulo), sem aviso |

Por isso a ordem é obrigatória: **banco primeiro, código depois**.

Por que a etapa A é compatível (do que foi provado e do que é inferência):

- **Provado em teste local (`testar:banco`):** as duas migrações são aditivas (uma coluna `periodo_id` nula, uma tabela nova `periodos_operacoes`, funções novas); aplicadas sobre um banco com dados antigos não mudam nenhuma linha; um dia avulso continua com as mesmas cinco chaves de antes (sem `periodo_id`); a lista de `executar_como_titular` mantém as 38 operações que o código atual chama e ganha 3 (41); o cálculo do vencimento muda em dois pontos: sequências indisponíveis acima de 400 dias (antes recusava ou devolvia um dia ainda indisponível) e o texto do motivo do ajuste (`prazo_ajuste`), que agora lista cada motivo uma vez só quando dois registros iguais cobrem a mesma data (união das datas, com desempate por criação e identificador). Só aparece em dados com registros repetidos na mesma data e só depois de um recálculo.
- **Alterado em funções existentes (create or replace):** `dia_indisponivel_json` (acrescenta `periodo_id` só quando existe), `demanda_json` (acrescenta a chave derivada `retorno`), `ajustar_prazo` e `retorno_setor_data` (sem o limite de 400 dias) e `executar_como_titular` (a mesma função, com 3 nomes a mais). Uma chave a mais num JSON não afeta quem não a lê.
- **Prova de ponta a ponta com o código atual de produção contra o banco novo:** ver a seção 9.
- **Inferência, não provada:** o comportamento do Supabase hospedado (PostgreSQL 17 no registro, contra o 18 do PGlite local) com as duas migrações; as concessões e a RLS são conferidas por leitura depois de aplicar (seção 5).

## 4. O que as migrações escrevem e recalculam

- **Nas migrações:** DDL apenas (`alter table ... add column periodo_id` sem valor padrão, `create table periodos_operacoes` com RLS, um índice parcial, funções). **Nenhuma linha existente é lida para escrita, atualizada ou apagada**, nenhum backfill, nenhum recálculo. Tabela e coluna novas nascem vazias/nulas.
- **Depois, por ação do Éder no aplicativo novo:** cadastrar, alterar ou excluir um período ou dia indisponível grava as linhas do período e **recalcula, na mesma transação, o vencimento ajustado das demandas abertas** (não finalizadas; arquivadas não finalizadas também; finalizadas preservam o histórico) que passam por aquelas datas. É o comportamento aprovado (decisões 83 e 84), só acontece sob ação explícita e é reversível pelo mesmo caminho (excluir o período recalcula de volta).
- **A rotina diária** (agendada em `vercel.json` para 09:00 UTC; se o agendamento está ativo no painel não foi conferido) usa `retorno_setor_data` e `ajustar_prazo` com a nova regra; só altera o resumo operacional, nunca demandas.

## 5. Verificações antes e depois

Antes de qualquer operação **[autorização]**:

1. Árvore limpa no `<SHA>` aprovado: `git status --short` vazio; `git rev-parse HEAD` igual ao SHA; `git ls-remote origin refs/heads/main` igual a `1b3b9db...`; `git merge-base --is-ancestor 1b3b9dba79d79941076720f070956b704ff3c4d0 HEAD`.
2. Verificações locais do SHA: `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build` e as suítes listadas em `docs/testes.md` (a execução de 19/11/2026 está em "Resultado das verificações" de `docs/organizacao-estrutural.md`).
3. CLI: `npx supabase --version` (3.2.0 ou superior, no registro). A ajuda de 3.2.0 mostra `--remote` como destino (as notas antigas dizem `--linked`); consultar `npx supabase db push --help` antes de usar. **Nunca `db reset`.**
4. **Cópia privada atual (obrigatória antes da primeira operação real):** (a) o Éder baixa a cópia v4 pelo aplicativo no ar (menu do avatar, Baixar cópia dos dados); (b) cópia funcional por leitura: `npx supabase db query --remote --read-only -f supabase/propostas/copia_funcional_leitura.sql --output-format json > dmanda-copia-funcional-AAAA-MM-DD.json`, guardada fora do repositório (`Dmanda-backups/`). A v4 **não** leva registros do dia, opções, Para hoje, resumos nem execuções da rotina; a funcional leva todas as tabelas de `public` (não leva a conta nem a lista de acesso). Os dois arquivos têm dados reais: nunca no Git, nunca em serviço externo.
5. Linha de base, só leitura: `npx supabase db query --remote --read-only -f supabase/propostas/verificar_migracoes_1_4_hospedado.sql` (anotar as contagens por tabela; esperado: coluna, tabela e funções novas **ausentes**) e `npx supabase db query --remote --read-only -f supabase/propostas/verificar_papeis_hospedado.sql` (papéis, como em 17/11).

Passo B1, banco **[autorização]**:

1. `npx supabase db push --remote --dry-run` **tem de listar exatamente duas migrações, nesta ordem: `20261120000000_periodos_indisponiveis.sql` e `20261120000100_retorno_do_servidor.sql`.** Qualquer outra: parar.
2. `npx supabase db push --remote` (confirmar a mesma lista).
3. Conferir: `npx supabase migration list --remote` (a última é `20261120000100`, sem divergência) e de novo `verificar_migracoes_1_4_hospedado.sql`: coluna e tabela presentes, tabela com RLS e só `select` e `insert` para `authenticated`, as cinco funções novas `definer=false` com `search_path` vazio, `executar_como_titular` com a lista dos três nomes, `demanda_json` lendo `retorno_setor_info`, `linhas com periodo_id` = 0 e **as contagens por tabela iguais às da linha de base**.
4. O aplicativo atual segue funcionando (etapa A): abrir o domínio, listar demandas, Agenda e Configurações.

Passo B2, publicação do SHA exato **[autorização]**:

1. `git push origin <SHA>:main` (fast-forward; sem `--force`). Pelo `vercel.json`, só a `main` implanta (as outras branches são desligadas), então o envio publica.
2. Confirmar que o deploy de Production aponta para `<SHA>` e está "Ready" (painel da Vercel, ou `gh api repos/edermoliveira/Dmanda/commits/main --jq .sha` igual a `<SHA>`).
3. Domínio: `node --env-file=.env.local scripts/verificar-entrada-direta-real.mjs dominio https://dmanda-adm.vercel.app` (só leitura; o `--env-file` entrega as variáveis ao processo sem que ninguém as leia) e, antes dele, `... rest`. Esperado: rotas abertas com 200 e sem cookie, `/acesso` e `/login` com 307 para `/`, `/api/exportar` com versão 4 e as mesmas contagens de demandas, entradas e eventos, cron sem credencial com 401. **Também esperado agora:** `/marca`, `/pecas` e `/tokens` com **404**. O script não testa esses caminhos nem as funções novas; conferir à mão por leitura simples (`curl -s -o /dev/null -w "%{http_code}
" https://dmanda-adm.vercel.app/marca`, e o mesmo para `/pecas` e `/tokens`).
4. **[ação do Éder, num navegador novo]** Início, Demandas, Agenda e Configurações; cadastrar um período de teste (por exemplo, um fim de semana de recesso fictício) e conferir o aviso de vencimentos recalculados; excluí-lo; abrir uma demanda em Aguardando retorno e conferir a data do retorno; baixar a cópia dos dados.
5. Depois do aceite do Éder: conferir a primeira execução da rotina diária após o deploy (a tabela `execucoes_rotina`, leitura), sem presumir que o agendamento do painel esteja ativo.

## 6. Critérios de parada e recuperação

**Parar** e não avançar se: a reconferência da seção 2 divergir do registro; o `dry-run` listar qualquer migração além das duas; o `db push` falhar; alguma contagem por tabela mudar depois das migrações; a verificação hospedada mostrar `definer=true`, `acl` com `anon` ou `public`, ou RLS desligada na tabela nova; o domínio responder diferente do esperado.

Recuperação (sempre **para a frente**, sem restauração destrutiva):

- **Migração falhou no meio:** cada arquivo é executado como um lote; confira com `migration list --remote` e com a verificação hospedada o que de fato ficou antes de rodar de novo. Não reaplicar às cegas.
- **Banco novo com problema, código ainda o atual (etapa A):** nada precisa voltar. O código atual não chama nenhuma função nova. Corrigir à frente em migração nova.
- **Código novo com defeito no ar:** "Promote to Production" do deploy anterior na Vercel (o que estava no ar antes da publicação; anotar o identificador dele na reconferência da seção 2) é seguro com o banco novo, pela compatibilidade da etapa A. O banco **não** volta atrás: as migrações são aditivas e o código anterior as ignora.
- **Períodos cadastrados que se queira desfazer:** excluir o período pela interface recalcula os vencimentos de volta. Não há script de reversão do banco (a remoção da coluna e da tabela perderia o vínculo dos períodos) e não é necessário para a recuperação; se o Éder decidir um dia removê-las, será uma migração nova, escrita e testada na hora.
- **Corrupção por outra causa:** restaurar a partir da cópia v4 (`supabase/restaurar-copia.sql`, procedimento em `supabase/LEIA-ME.md`, demonstrado só em banco local com dados fictícios) e da cópia funcional.

## 7. Limitações que nenhum teste local remove

- **Safari físico:** o WebKit do Playwright não é o Safari do iPhone. O aceite visual e de toque no aparelho é do Éder.
- **Ambiente hospedado:** PGlite (PostgreSQL 18) não é o Supabase (PostgreSQL 17 no registro). Papéis, concessões, plano de execução, tempos e a plataforma só se provam por leitura depois de aplicar.
- **Concorrência real:** a idempotência de períodos (mesma `operacao_id`, cancelamento por conferência, gravação tardia) é provada com sessões simultâneas no PGlite, mas não com várias instâncias serverless reais sob carga.
- **Acesso aberto (decisão expressa, registro de 17/11):** quem souber o endereço lê, grava, apaga e exporta tudo; a rotina diária segue protegida por `CRON_SECRET`; a consolidação de segurança fica para o fim do projeto.
- **Variáveis e cron na Vercel:** não consultados; conferir na reconferência da seção 2.

## 8. Issues (somente leitura, em 19/11/2026)

Não foram fechadas nem alteradas. `edermoliveira/Dmanda`, abertas: **#2** conferir a aplicação nos dispositivos (avaliação visual no iPhone e no iPad: **pendente**, é do Éder); **#3** publicar e ativar a rotina diária (a publicação existe desde 28/10/2026 e a rotina rodou em 17/11 pelo registro; o texto da Issue está desatualizado quanto ao login, que foi retirado; a conferência do agendamento no painel segue **pendente**); **#4** cópia privada (mecanismo pronto, v4 e agora a cópia funcional por leitura; **destino privado e demonstração de recuperação em projeto real descartável: pendentes**); **#7** resistência e desempenho (testado localmente; medições em ambiente hospedado **pendentes**). Resolvido localmente neste intervalo e dependente de implantação: períodos de indisponibilidade, retorno do setor vindo do servidor e aviso de vencimento antes da chegada (dependem das duas migrações e do código). Nenhuma Issue nova foi criada; se o Éder quiser uma por este bloco, o texto sai do resumo desta seção.

## 9. Resultado da verificação do código atual contra o banco novo

Feita em 19/11/2026, em cópia temporária fora do repositório, com o código exato de `origin/main` (`git archive`, mais a dependência `lucide-react` na versão do lock, que o candidato já não tem) e as duas migrações novas acrescentadas à pasta de migrações **dessa cópia**; o banco de cada suíte é o PGlite descartável que aplica todas as migrações da pasta:

- `testar:banco` do código atual: **546 verificações, todas aprovadas** (a construção do "banco antigo" dentro dessa suíte precisou excluir as duas migrações novas na cópia, porque ela monta o estado anterior por nome de arquivo; as 316 verificações que rodam antes disso já eram sobre o banco com as duas migrações e passaram do mesmo modo).
- `testar:acesso-direto` do código atual (aplicativo real contra um Supabase falso na frente do banco novo): **48 de 48**. `testar:app`: **137 de 137**. `testar:config` (inclui Dias indisponíveis, cadastrados pelo código antigo com `salvar_dia_indisponivel`): **175 de 175**.

Isso prova a etapa A **contra o PGlite**, com dados fictícios. Não prova o Supabase hospedado (seção 7) nem o Vercel; o comportamento hospedado é conferido por leitura logo depois de aplicar (seção 5, passo B1).
