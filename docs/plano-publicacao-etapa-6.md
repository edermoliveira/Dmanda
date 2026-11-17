# Plano de publicação da etapa 6 (decisão 83)

> **SUPERADO em 17/11/2026. NÃO SEGUIR.** Os aparelhos autorizados e o acesso por código foram retirados por decisão do Éder. O plano vigente é `docs/plano-retirada-aparelhos.md` (duas fases). O texto abaixo fica só como registro histórico.

Estado: **proposta para o Éder decidir.** Nada abaixo foi executado no Supabase real, no GitHub ou na Vercel. Cada passo marcado com **[AUTORIZAÇÃO]** só acontece com a sua autorização específica, uma a uma.

## 1. O candidato

- **Branch e pasta:** `release/etapas-2-5`, no worktree `C:\Users\Éder\Desktop\Dmanda-release` (criado a partir de `origin/main` `ed1e63e`; o checkout principal `Dmanda`, o stash do Clima e os trabalhos adiados não foram tocados).
- **SHA do candidato:** `c6c0ae2` (último commit de código; o commit seguinte só traz a documentação). A pasta `Dmanda-release` tem o seu próprio `node_modules`, uma cópia do da `main` (o Turbopack não aceita atalho para fora da pasta).
- **O que entra:** as correções da decisão 78 (auditoria), a etapa 2 (cards do Início), a etapa 3 (quatro vagas, Urgência, nove carrosséis), a etapa 4 (prazos pela chegada, sem Legal/Próprio) e a etapa 5 (aparelhos autorizados), por `git cherry-pick -x` dos commits já aprovados (o SHA original fica na mensagem de cada commit). Três migrações novas, todas aditivas: `20261116000000_para_hoje_quatro_vagas`, `20261117000000_prazo_pela_chegada` e `20261118000000_aparelhos_autorizados`.
- **O que NÃO entra:** Pagamentos (migração `20261115000000` e tela), a cópia versão 5 (a exportação do candidato continua na v4), a prévia dos lançamentos do dia, o minicalendário (branch própria) e o backfill dos prazos legados (só proposta em `supabase/propostas/`, sem aplicar).
- **Documentos:** os `.md` do candidato são os da `main` local, que contam a história inteira (inclusive Pagamentos como adiado).

## 2. Ordem exata proposta

Todos os comandos de banco são rodados **da pasta do candidato** (`Dmanda-release`), para a CLI enxergar só as três migrações novas. Rodar da `main` local listaria também a de Pagamentos.

0. **Conferência de leitura (sem alterar nada).** `git fetch origin`; `git rev-parse origin/main` deve ser `ed1e63e`. `npx supabase migration list --linked`: a última migração aplicada deve ser `20261110000000` (A1 resolvido em 15/11: as 16 a 20 antigas estão aplicadas; Pagamentos não). Se for outra, parar e me avisar.
1. **Backup.** (a) No aplicativo publicado, menu da conta, "Baixar cópia dos dados" (arquivo JSON v4, guardar fora do Git e fora da nuvem pública). (b) Contagens de referência, só leitura: `npx supabase db query --linked "select (select count(*) from public.demandas) d, (select count(*) from public.tarefas) t, (select count(*) from public.entradas) e, (select count(*) from public.eventos) ev, (select count(*) from public.dias_indisponiveis) di, (select count(*) from auth.users) u"`. Anotar. (c) Confirmar que a restauração da cópia funciona num banco de teste (`testar:banco` faz isso).
2. **Dry-run das migrações.** `npx supabase db push --linked --dry-run`. Esperado: exatamente `20261116000000`, `20261117000000`, `20261118000000`, nesta ordem, e nenhuma outra.
3. **[AUTORIZAÇÃO] Aplicar as migrações.** `npx supabase db push --linked` (sem `db reset`). Em seguida: as mesmas contagens do passo 1 (iguais), `npx supabase db advisors --linked` (só o aviso antigo de senhas vazadas) e, só leitura, `select exigir_aparelho from dmanda_privado.config_acesso` deve dar `false`.
   - **Importante:** aplicar **antes** do código. O código novo sobre o banco antigo contaria "10 dias" a partir de hoje (o banco antigo ignora a chegada). O aplicativo antigo sobre o banco novo funciona (a exigência de aparelho nasce desligada), com uma exceção: os botões de 5, 10, 20 e 30 dias, sem chegada, mostram "Informe a data de chegada para calcular o prazo de N dias." e, com chegada, o banco conta pela chegada e não por hoje. Por isso o passo 4 vem logo em seguida.
   - **Ordem futura de Pagamentos:** a migração `20261115000000` é mais antiga que as três aplicadas aqui. Quando Pagamentos for publicado, a CLI vai pedir `npx supabase db push --linked --include-all` (e o dry-run antes).
4. **[AUTORIZAÇÃO] Publicar o código.** `git push origin release/etapas-2-5:main` (avanço direto de `ed1e63e`, sem force; a `main` do GitHub fica no SHA do candidato) e a Vercel publica sozinha (o `vercel.json` só implanta a `main`). Alternativa, se preferir revisão: abrir um PR de `release/etapas-2-5` para `main`, mesmo conteúdo, e dar o merge.
5. **Verificação do deploy (só leitura).** A Vercel mostra o deploy "Ready" no SHA do candidato. Sem sessão: `/` e `/demandas` redirecionam para `/acesso`; `/login` redireciona para `/acesso`; `/api/exportar` redireciona; `/api/cron/diaria` sem segredo devolve 401; o manifesto e os ícones abrem. A sessão que você já tinha (entrada por senha) continua abrindo, porque a exigência ainda está desligada.
6. **[AUTORIZAÇÃO] Autorizar o primeiro aparelho.** No computador, na pasta do candidato (ou da `main`, com o mesmo `.env.local`): `npm run aparelhos -- convite` mostra um código de 8 caracteres (10 minutos, uso único). No iPhone, abrir o endereço publicado, ele cai em `/acesso`; digitar o código; abre direto. Repetir para o computador e o iPad (o app instalado na tela de início do iPhone é um aparelho à parte e precisa do próprio código). Em Configurações, Aparelhos, conferir a lista.
7. **[AUTORIZAÇÃO] Ligar a exigência.** `npm run aparelhos -- exigir sim`. A função recusa se não houver ao menos um aparelho autorizado. Depois: as sessões antigas (por senha) perdem o acesso, os aparelhos autorizados continuam, a exportação funciona nos autorizados. Conferir no iPhone e no computador.
8. **Verificações em produção (você, no aparelho).** Roteiro das seções AL (etapa 5) e AK (prazos) de `CONTINUIDADE-DMANDA.md`, mais: Para hoje com quatro vagas estáveis, contadores abrindo a lista correspondente, Ofício concluído e reaberto nas filas, cópia dos dados baixada (v4), e a rotina diária da manhã seguinte (a página de Configurações mostra a última execução).

## 3. Recuperação de acesso

- **Perdi todos os aparelhos, mas tenho o computador com o `.env.local`:** `npm run aparelhos -- convite` e digitar o código no aparelho novo.
- **Sem o computador:** no painel do Supabase, SQL Editor, rodar `select public.criar_convite_terminal('ABCD2345');` com um código de 8 letras e números à sua escolha (sem I, L, O, 0 e 1) e digitá-lo na tela `/acesso` em até 10 minutos. O SQL Editor roda como dono do banco, então a função está liberada.
- **Se alguém travar a tela de acesso com tentativas erradas** (10 falhas seguidas bloqueiam por 10 minutos): gerar o código pelo terminal ou pelo SQL acima limpa a trava.
- **Aparelho perdido ou roubado:** de qualquer aparelho autorizado, Configurações, Aparelhos, Revogar (efeito imediato, mesmo com o token ainda válido). Sem nenhum aparelho à mão: `npm run aparelhos -- revogar-todos --sim` e depois um convite novo.
- **A chave de serviço** (`SUPABASE_SERVICE_ROLE_KEY`) é o segredo que tudo isso protege: só no `.env.local` e na Vercel, nunca em `NEXT_PUBLIC`, nunca no Git.

## 4. Rollback

- **Aplicativo:** na Vercel, Deployments, o deploy anterior ao candidato, "Promote to Production" (instantâneo, sem mexer no Git). O aplicativo antigo tem entrada por e-mail e senha, e a senha continua no Supabase (`npm run definir:senha` redefine). **Antes de voltar o aplicativo, desligar a exigência** (`npm run aparelhos -- exigir nao`): com ela ligada, a sessão por senha do aplicativo antigo não leria nada. Para desfazer o Git, `git revert` do avanço (nunca force push).
- **Banco:** as três migrações são aditivas e nenhuma apaga dado. O mínimo que desfaz o efeito de acesso é `exigir nao`. A reversão completa, validada em banco de teste, está em `supabase/propostas/reverter_migracoes_etapas_3_a_5.sql` (seção 1 aparelhos, seção 2 prazo pela chegada, seção 3 quatro vagas), aplicada só com autorização e só as seções necessárias. A seção 3 apaga o ponteiro da quarta vaga (a demanda em si fica).
- **Dados:** a cópia do passo 1 (v4) restaura num projeto novo com `supabase/restaurar-copia.sql`; as demandas ficam como estavam antes das migrações, pois nenhuma migração tocou dado.

## 5. Depois da confirmação do deploy (etapa 6, limpeza)

Só depois de eu informar que o deploy foi confirmado por você no aparelho, e cada item com autorização:

1. **Sincronizar o checkout principal.** A `main` local tem os mesmos patches do candidato com SHAs diferentes, mais Pagamentos, a prévia dos lançamentos e a documentação. Antes de mexer: criar a branch `bloco/pagamentos-e-previa` no SHA atual da `main` local (preserva tudo). Depois `git fetch origin` e `git rebase origin/main` na `main` (os commits idênticos por patch são descartados pelo rebase; ficam por cima só Pagamentos, a prévia e as correções que dependem deles). Conferir `testar:banco` e `testar:regras` no resultado.
2. **Sincronizar os demais worktrees** (matriz da seção AH): `git fetch` e avanço direto onde já estão contidos em `origin/main`; nenhum com alteração local é tocado.
3. **Aposentar referências já inventariadas** (lista da seção AH: as 100% contidas em `origin/main`), uma a uma, só com `git branch -d`/`git push origin --delete` depois de gravar o SHA no documento. Preservar o que só existe localmente: `stash@{0}` do Clima, `bloco/inicio-clima`, `bloco/perfil-indicadores` (até conferir `3595a7e`), `bloco/mini-calendario-domingo`, os checkpoints com exclusivos (`retomada-casa`, `rascunho-apple-design`, `stash-desempenho`) e o arquivo `scripts/capturar-calendarios.mjs` não rastreado de `Dmanda-ref-395e45a`.
4. **Remover o worktree `Dmanda-release`** só quando não for mais necessário (a pasta tem a própria cópia de `node_modules`, então a remoção não afeta o checkout principal).
5. **Primeiro bloco depois das seis etapas e da confirmação do deploy final: Início e Demandas > Cards** (o Éder pediu este registro).

## 6. Aviso do Next.js (versão 16.4.4)

O Next 16.4.4 mostra uma recomendação de atualização de segurança e interrompe a primeira partida de `next dev` e de `next build` (a repetição passa). Texto integral na decisão 83, item 6. **Decidir antes de publicar:** atualizar o Next (comando sugerido `next upgrade --agent=security`, em worktree separado ou no checkout atual) ou publicar com a 16.4.4. Nada foi atualizado.

## 7. O que depende do Éder

Aceite da etapa 5 no aparelho; decidir o plano acima; autorizar, um a um, os passos 3, 4, 6 e 7 e a limpeza da seção 5; decidir as duas regras de produto em aberto (arquivadas e indisponibilidade prolongada, em `CONTINUIDADE-DMANDA.md`, seção AM); decidir se haverá backfill dos prazos legados (fora desta publicação).
