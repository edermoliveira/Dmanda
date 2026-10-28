# SINCRONIZA-PROJETINHO

Guia para continuar o Dmanda em outro computador a partir do ponto exato em que paramos. Contém: onde estamos, histórico das sessões, o que depende de **você** (nada foi decidido pelo Claude em seu lugar), o plano do Figma (só o que faltou), a avaliação das ferramentas, o plano de blocos de trabalho maiores com modelo e effort sugeridos, como sincronizar e o prompt para retomar.

**Última atualização:** 27/10/2026 (consolidação na `main`, bloco logo abaixo); antes dela, auditoria completa e realinhamento (bloco logo abaixo, em "ATUALIZAÇÃO 27/10/2026 (noite)"); antes dela, o bloco de publicação controlada no computador de casa (ver "PONTO DE RETOMADA ATUAL" logo abaixo; as seções seguintes são histórico), branch `checkpoint/2026-10-23-ajustes-a-d` (ver "PONTO DE RETOMADA (26/10/2026...)" logo abaixo, depois o ponto de 01h20 do computador de casa). As seções 1 em diante são histórico de sessões anteriores e podem estar superadas.
**Andamento do projeto: 18%** (cálculo em `ANDAMENTO.md`).
**Repositório:** https://github.com/edermoliveira/Dmanda.git (privado).

---

## CONSOLIDAÇÃO NA MAIN (27/10/2026): LEIA ESTE BLOCO PRIMEIRO

**A `main` é a única branch de trabalho.** O checkpoint foi integrado por fast-forward (sem commit de merge, sem reescrever histórico). Nada foi publicado, nada foi configurado na Vercel ou na nuvem, o Supabase real não foi tocado e nenhuma migração foi aplicada. Decisão 24 em `DECISOES.md`.

**Para iniciar a partir da `main`** (PowerShell, na pasta do projeto):
```
git checkout main
git pull --ff-only origin main
git ls-remote origin refs/heads/main
npm ci
npm run conferir:env
npm run dev
```
`npm run dev` abre o Supabase real em http://localhost:7100/login (exige `.env.local`; só um `next dev` por vez). Sem credenciais: `npm run dev:teste` (banco descartável).

**PUBLICAÇÃO PELA MAIN (decisão 25, 27/10/2026): a `main` é a única branch de trabalho e de publicação. A branch `producao` não existe mais.** Qualquer instrução abaixo (ou em outro documento) que mande "avançar a `producao`" é **histórico superado**.

**Como a Vercel decide (`vercel.json`):** `"git.deploymentEnabled": {"**": false, "main": true}`. Pela documentação da Vercel (minimatch; basta uma regra `true` para implantar), só a `main` implanta; branches com qualquer outro nome, inclusive com barras (`claude/...`, `feature/x`), não implantam sozinhas. Testado com minimatch 3.1.5 (o que o projeto tem instalado; a versão da Vercel não é conhecida): `main` implanta; `claude/abc`, `claude/a/b`, `feature/main`, `main/x`, `Main` e `producao` não. Região `gru1` e cron diário (09:00 UTC) preservados. **Consequência:** cada commit enviado à `main` passa a publicar o painel real. Por isso, só enviar à `main` o que foi verificado; commits só de documentação também geram uma implantação.

**Registro das branches (27/10/2026):**
- `checkpoint/2026-10-23-ajustes-a-d`: removida (local e remoto) na consolidação; estava em `8fb7c01386e6d20e096304c83ec1c7a17978715b`, contida na `main`.
- `producao`: removida (local e remoto) na publicação; estava em `a0eaa4630f87700ba8b3d78d63238b8af05beb4d`, ancestral da `main`, 0 commits exclusivos. Para consultar o histórico, `git log a0eaa46`.
- Resta só a `main`. Não existem PRs, stashes, tags nem worktrees. Issues abertas: #2, #3, #4.

**Publicação (Vercel Hobby, equipe EDER, projeto `dmanda`, importado da `main`, cinco variáveis só em Production):** o estado exato (publicado, validado, ainda não validado) está no bloco "PUBLICAÇÃO E FECHAMENTO" quando ele existir; enquanto não existir, nada foi publicado.

## PONTO DE RETOMADA ATUAL (27/10/2026, em casa: publicação preparada, aguardando o plano da Vercel e a conexão da nuvem)

Esta seção basta para continuar sem a conversa e sem a memória local. Detalhes: `AUDITORIA.md` (seção 17 fecha a base Supabase; seção 16 é a conferência do ambiente, encerrada) e `supabase/LEIA-ME.md`. Não abrir outra auditoria geral nem do ambiente sem fato novo.

**Onde está o código:** repositório `edermoliveira/Dmanda` (privado), branch `main` (o checkpoint foi integrado em 27/10/2026; ver o bloco "CONSOLIDAÇÃO NA MAIN" acima). Conferir sempre com `git ls-remote origin refs/heads/main`.

**Base Supabase do núcleo: CONCLUÍDA** (login por e-mail e senha, demandas e tarefas):
- Painel: Email ligado, Google desligado (pelo usuário), cadastro público desligado, 1 usuário (`e38872d3`, o mesmo de sempre). Migrações: 7 de 7 registradas, nenhuma a reaplicar.
- Teste manual do usuário (confirmado em 27/10/2026): demanda TESTE com tarefas permaneceu depois de sair e entrar. Evidência complementar no banco real: a demanda pertencia ao usuário existente (2 tarefas, versão 5) e havia uma sessão nova criada depois da última gravação. O banco não prova o clique em Sair; isso vem da confirmação do usuário e das 19 verificações de 26/10.
- Limpeza: removidas só essa demanda (por identificador) e suas tarefas. Banco real: **0 demandas, 0 tarefas, 1 usuário, 1 e-mail na lista de acesso.**
- Últimas alterações: botão "Entrar com Google" oculto por padrão (só com `DMANDA_LOGIN_GOOGLE=sim`; nada a configurar); seção de cópias do `LEIA-ME` reescrita; `.gitignore` ignora `dmanda-copia-*.json`; decisões 14 e 15 em `DECISOES.md`.
- Verificado nesta etapa: `tsc`, `eslint`, `testar:regras` 26, `testar:sessao` 57, build, login real com a variável vazia e com `sim`. A rotina diária mantém a prova HTTP de 25/10 (código inalterado). `testar:banco` (118) e `testar:app` (69) não foram repetidos porque SQL e telas internas não mudaram.

**Cópias dos dados (não é backup completo nem automático):** exportação disponível (avatar > Baixar cópia dos dados); recuperação demonstrada **somente em banco local**, com dados fictícios; armazenamento externo **pendente** (destino privado a definir pelo usuário); execução automática **pendente**. Orientação de uso e verificação do arquivo em `supabase/LEIA-ME.md`. Nada foi enviado a Drive, OneDrive ou GitHub.

**Issues (repositório privado):** #1 FECHADA (login e integração real, e-mail e senha). #2 aberta (avaliar a aplicação React, sem avaliação visual do usuário ainda). #3 aberta (publicar, rotina diária, 6 h reais). #4 aberta (cópia privada: destino e restauração em projeto real). Andamento oficial: 18% (`ANDAMENTO.md`).

**Para iniciar no computador do trabalho** (PowerShell, na pasta do projeto):
```
git fetch origin
git checkout main
git pull --ff-only origin main
git ls-remote origin refs/heads/main
npm ci
npm run conferir:env
npm run dev
```
`conferir:env` mostra só ok, VAZIA ou ATENÇÃO, nunca valores, e lê o painel em modo leitura (deve mostrar Email LIGADO, Google desligado, cadastro público desligado, 1 usuário). `npm run dev` abre a aplicação real em http://localhost:7100/login (só um `next dev` por vez). O `.env.local` e a CLI do Supabase não vão para o Git: o computador do trabalho já tem os seus. Se a CLI pedir login: `npx supabase login` e `npx supabase link --project-ref gmxoosvgfcydccyeudej`. O binário do Impeccable (`.claude/skills/impeccable/scripts/bin`) é por computador e não vai para o Git.

**ATUALIZAÇÃO 27/10/2026 (noite): REALINHAMENTO E AUDITORIA COMPLETA. Esta atualização vale mais que o roteiro de publicação anterior (que previa decisão de plano e Pro).**
- **Decisões do usuário:** Vercel Hobby e Supabase Free; nada pago, nem teste pago; o Pro não é decisão presumida. Quer usar o núcleo o quanto antes, com o Catalyst aprovado. Desenvolvimento pelo iPhone (nuvem) **não bloqueia** a entrega. Blocos completos, sem rodadas de pequenas preparações. Decisões 19 a 23 em `DECISOES.md`.
- **Feito neste bloco:** auditoria completa (`AUDITORIA.md`, seção 18): 0 bloqueadores; 8 correções importantes aplicadas e verificadas (data provisória de 2000 aparecendo nos cards em toda carga, foco do teclado na janela, atalho "/", `suppressHydrationWarning` indevido, PGlite de teste fora do pacote das funções, CSS dos tokens no pacote, aviso de saída em tom neutro, código morto); 9 melhorias posteriores registradas (P1 a P9). Ponytail (`ponytail-audit`, `ponytail-review`) copiado para `.claude/skills/` com licença MIT e origem; Taste lido como roteiro, plugin continua desativado.
- **Verificado:** `tsc`, `eslint`, `testar:regras` 26, `testar:banco` 118, `testar:app` 74, `testar:sessao` 57, `build` e produção local (rotas, cron 401, cabeçalhos, nenhum segredo no cliente), `npm audit` de produção 0, medições de interface em 5 tamanhos e 2 modos.
- **Não alterado:** `main` (c314b53), `producao` (a0eaa46, não avançou), o banco real, `.env.local`. Os commits deste bloco estão agora na `main` (consolidação acima); **a `producao` só avança com a autorização do usuário**, e as correções acima só chegam ao ar quando ela avançar.
- **Decisões que o usuário pode tomar sem pressa (não bloqueiam):** (a) manter ou ocultar os controles de áreas não construídas; (b) regra do Início para "Aguardando retorno" sem data de acompanhamento; (c) autorizar a exclusão do design antigo sem uso (`AUDITORIA.md`, P1, P4, P5).
- **Planos gratuitos (fontes em `supabase/LEIA-ME.md`, "Planos gratuitos"):** o texto do Hobby sobre uso não comercial não esclarece o servidor público sem receita (efeito, se a Vercel entender que não cabe: pausa; pergunta opcional ao suporte, que não bloqueia); o Supabase Free pode pausar o projeto depois de uma semana de pouca atividade e **não tem backup para baixar**, então a cópia dos dados em arquivo é o único backup (Issue #4).
- **PRÓXIMO BLOCO (publicação gratuita, rotina diária e PWA), roteiro único (SUPERADO nos itens que citam `producao`: ver a decisão 25, publicar pela `main`):**
  1. **Usuário (vercel.com):** criar a conta Hobby entrando com o GitHub, autorizar **só** o repositório `Dmanda`, importar o projeto, cadastrar as cinco variáveis só em Produção (chave de serviço como sensível), Settings > Environments > Production > Branch Tracking = `producao`, e avisar o endereço. A primeira implantação sai da `main` e é descartável.
  2. **Claude, com autorização:** avançar a `producao` por fast-forward a partir do commit verificado (traz as correções e dispara a implantação certa), conferir o publicado sem sessão (200 e redirecionamentos, cron 401, cabeçalhos, região `gru1`, rotina registrada em Settings > Cron Jobs).
  3. **Usuário:** entrar com e-mail e senha no endereço publicado e apagar a primeira implantação (Deployments > ⋯ > Delete).
  4. **Claude:** conferir a sessão no banco real, criar e remover uma demanda TESTE pelo endereço, chamar a rotina manualmente (resposta 200 e linha em `execucoes_rotina`).
  5. **Usuário, no dia seguinte:** conferir no Início a última execução automática; instalar a PWA no iPhone e no iPad (Safari > Compartilhar > Adicionar à Tela de Início); baixar a cópia dos dados dentro do app instalado e dizer se funcionou; avaliar a aplicação (Issue #2).
  6. Então: destino das cópias (#4) e, se quiser, o desenvolvimento pelo iPhone (guia abaixo).

**ATUALIZAÇÃO 27/10/2026 (bloco "publicação controlada", em casa; o item do plano e o mecanismo da `producao` foram superados, ver a decisão 25):** preparado, **nada publicado, nada contratado**.
- `vercel.json` agora tem região `gru1`, a regra "só a branch `producao` implanta" (`git.deploymentEnabled`) e o cron diário (09:00 UTC). Branch `producao` criada a partir do commit verificado (conferir com `git ls-remote origin refs/heads/producao`); regra de avanço em `CLAUDE.md` e `DECISOES.md` 16.
- Verificado hoje: `tsc`, `eslint`, `testar:regras` 26, `npm run build`, `conferir:env` (tudo ok, Email ligado, Google desligado, cadastro público desligado, 1 usuário) e produção local (`npm run start`): `/login`, manifesto e ícones 200; `/demandas`, `/marca`, `/api/exportar` redirecionam ao login; cron 401 sem segredo e com segredo errado; cabeçalhos de segurança presentes. `testar:banco` e `testar:app` não repetidos (SQL e telas não mudaram).
- **Plano da Vercel:** a recomendação de Pro foi **superada** pela decisão do usuário de usar Hobby e Free (decisão 19). Regra, limites e efeitos em `supabase/LEIA-ME.md`, "Planos gratuitos".
- **Aviso:** a primeira implantação de um projeto novo na Vercel é sempre de produção e sai da `main` (protótipo antigo, dados fictícios). Roteiro em `supabase/LEIA-ME.md` ("Ações exatas para publicar").
- **Ainda pendente:** publicação, agendamento implantado, primeira execução automática, 6 h reais, avaliação visual da aplicação React (#2), destino e automação das cópias (#4).
- Guia do iPhone (Claude Code na nuvem): seção "Claude Code na nuvem" logo abaixo.

**Pendências que exigem ação ANTES da publicação:**
1. Plano decidido: Hobby (gratuito). Nada será contratado; a pergunta ao suporte da Vercel é opcional e não bloqueia.
2. Usuário: criar o projeto na Vercel conforme "Ações exatas para publicar" no `LEIA-ME`, cadastrar as variáveis só em Produção e avisar o endereço.
3. Claude, depois do endereço: conferir o publicado, o cron e o banco (a `producao` foi removida; publica-se pela `main`).

**Limitações conhecidas (podem continuar registradas, não bloqueiam a publicação):** expiração de 6 h reais ainda não observada (só em ambiente isolado); restauração da cópia nunca feita em projeto real; destino e automação das cópias; cookie `dmanda-ultimo-uso` não assinado; operações pontuais (mover etapa, marcar tarefa, arquivar) seguem "último a gravar vence" por campo; sem service worker (a PWA só abre online); intermitência não reproduzida do `testar:sessao` (57 de 57 agora); senhas vazadas exigem plano pago; PowerShell 7 não testado; projeto Supabase gratuito pode pausar por inatividade; aplicação React sem avaliação visual (#2).

**PRÓXIMO BLOCO (já definido): publicação controlada, rotina diária em nuvem e conferência da PWA.**
- **(SUPERADO pela decisão 25: a `main` publica e a `producao` foi removida.) Enviar para a `main` não é liberar (mecanismo aplicado em 27/10/2026).** A Vercel publica só a branch `producao`, que avança por fast-forward a partir de um commit verificado da `main` (`git push origin <commit-verificado>:refs/heads/producao`, nunca force). As outras branches, a `main` inclusive, não implantam, por regra no próprio `vercel.json`. Na Vercel, a Production Branch é definida em Settings > Environments > Production > Branch Tracking.
- **Roteiro:** (1) plano já decidido (Hobby); (2) criar o projeto na Vercel com a Production Branch definida acima, região São Paulo (gru1) e as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DMANDA_EMAIL_AUTORIZADO`, `SUPABASE_SERVICE_ROLE_KEY` (sensível) e `CRON_SECRET` (16 ou mais caracteres); não definir `DMANDA_BANCO` nem `DMANDA_LOGIN_GOOGLE`; (3) Claude confere o publicado sem sessão (login, manifesto, ícones, `/api/exportar` barrado, cron 401 sem segredo), depois da entrada por senha confere o banco; (4) execução manual do cron pelo painel (Cron Jobs, Run) ou a automática do dia seguinte, lida em `execucoes_rotina` e no Início; (5) PWA no iPhone e no iPad e avaliação (#2).
- **Depois, quando o usuário decidir:** destino privado das cópias (então armazenamento e, se quiser, automação) e uma demonstração da restauração em projeto descartável.

---

## Claude Code na nuvem (iPhone): guia único (preparado em 27/10/2026; NADA configurado ainda)

**Duas coisas diferentes (fonte: code.claude.com/docs, lida em 27/10/2026):**

| | Remote Control | Execução na nuvem (cloud session) |
|---|---|---|
| Onde roda | no **seu computador**; o iPhone só controla a sessão | numa máquina virtual da Anthropic que clona o GitHub |
| Computador ligado? | **sim**, com a sessão aberta | **não**; continua com o computador desligado |
| O que enxerga | seus arquivos, `.env.local`, plugins, memória e MCPs locais | **só o que está no repositório**; sem `~/.claude`, sem memória pessoal, sem `.env.local`, sem plugins do usuário nem os declarados em `.claude/settings.json` |
| Custo | dentro do plano Claude | dentro dos limites do plano Claude (sem cobrança extra pela máquina) |

Aqui o objetivo é a segunda. Ela vale no Claude Pro. Os arquivos versionados (`CLAUDE.md`, `AGENTS.md`, `.claude/skills/`, esta seção) chegam; o resto, não.

**Ações suas (nada disso foi feito):**
1. No iPhone, instalar o aplicativo Claude (App Store) e entrar com a mesma conta do Claude Code do computador.
2. **Conectar o GitHub pelo navegador, não por `/web-setup`.** Abrir https://claude.ai/code, entrar, escolher conectar o GitHub e autorizar. Quando pedir para instalar o **Claude GitHub App** (https://github.com/apps/claude/installations/new), escolher **Only select repositories** e marcar só `edermoliveira/Dmanda`. Motivo: `/web-setup` envia o token do `gh`, que alcança todos os seus repositórios.
3. Aceitar o ambiente **Default** (rede **Trusted**). Não adicionar variáveis de ambiente, segredos de rede nem script de instalação agora (qualquer pessoa que use o ambiente lê as variáveis; e a primeira conferência não precisa de nada disso).
4. Iniciar a sessão **pelo https://claude.ai/code** (o Safari do iPhone serve): repositório `Dmanda` e deixe a branch padrão, a `main` (desde a consolidação de 27/10/2026 ela tem a aplicação atual). Modo **Plan** (só lê e propõe). Depois a sessão aparece na aba **Code** do aplicativo e continua de lá.
5. Colar o texto abaixo.

**Primeira conferência (somente leitura), texto para colar:**
> Conferência SOMENTE DE LEITURA do repositório Dmanda. Não edite arquivos, não faça commit nem push, não instale dependências e não acesse Supabase, Vercel ou qualquer serviço externo. 1) Informe a branch atual e o hash do HEAD, e rode `git ls-remote origin` para dizer se existem `producao` e `main` e em quais hashes. 2) Leia CLAUDE.md, AGENTS.md e a seção "PONTO DE RETOMADA ATUAL" de SINCRONIZA-PROJETINHO.md. 3) Confirme que o vercel.json tem região gru1, a regra para só a branch producao implantar e o cron diário. 4) Liste o que está pendente e o que você NÃO consegue fazer neste ambiente (por exemplo, usar .env.local, acessar o Supabase real, usar a memória do computador). Responda em português, sem travessão, e termine com a linha de andamento copiada de ANDAMENTO.md, sem recalcular.

**Regras para qualquer tarefa depois disso:**
- Trabalhar em uma branch `claude/...` criada pela sessão. **Nunca** enviar diretamente para a `main`, que agora publica sozinha (a `producao` não existe mais). (O GitHub Free não protege branches de repositório privado, então a regra é escrita, não técnica. Diga isso no primeiro pedido de cada tarefa.)
- Só configurar o ambiente quando uma tarefa concreta exigir. Exemplo: para a nuvem rodar `tsc`, `eslint` e `testar:regras`, um script de instalação com `npm ci` (rede Trusted alcança o npm). `testar:app` precisa do Edge e não roda lá.
- Sem acesso ao Supabase real: não há chave na nuvem e nenhuma será colocada sem decisão sua. Qualquer chave futura entra como **segredo de rede** do ambiente (não como variável), com o menor privilégio possível.
- Não enviar `.env.local`, nem `~/.claude`, nem cópias de dados (`dmanda-copia-*.json`) ao GitHub ou à nuvem.

**Uma sessão por vez.** Antes de abrir uma sessão na nuvem, no computador: `git status` limpo, `git push` da `main` (com autorização) e conferência com `git ls-remote origin refs/heads/main`. Enquanto a sessão da nuvem não terminar e o resultado não voltar, não editar no computador.

**Como o resultado volta ao fluxo principal:**
1. A sessão termina com um push da branch `claude/...`. No claude.ai/code (ou no app), abrir **Changes** e revisar.
2. **Create PR** com **base na `main`**. Conferir a base antes de confirmar.
3. Você revisa e faz o merge do PR no GitHub (o site no iPhone serve). Só o seu merge altera a `main`.
4. No computador: `git fetch origin`, `git checkout main`, `git pull --ff-only origin main`, e `git ls-remote origin refs/heads/main` para confirmar o hash. Se o `--ff-only` recusar, houve edição paralela: parar e pedir ao Claude para conciliar.
5. O merge do PR na `main` publica o painel: revisar com esse peso.

**Limites e cuidados:** as sessões na nuvem dividem o limite de uso do seu plano com o restante do Claude; o ambiente é recolhido depois de um tempo parado (reabrir a sessão restaura a conversa, não processos em andamento); sem Remote Control, o computador pode ficar desligado, mas nada local (como `.dados-teste/` e o `.env.local`) existe na nuvem.

---

## PONTO DE RETOMADA (26/10/2026, noite, computador do trabalho, login por senha provado no Supabase real)

**Leia primeiro `AUDITORIA.md`, seção 15.** Branch `checkpoint/2026-10-23-ajustes-a-d` (sem merge na main, sem force push).

- **Feito e provado no Supabase real:** migrações 6 e 7 aplicadas (histórico remoto 7 de 7, sem reset, só as pendentes); autorização e hook conferidos; entrada por e-mail e senha no mesmo usuário (19 verificações com a senha digitada pelo usuário: saída, nova entrada, senha incorreta recusada, demanda TESTE com tarefas criada, editada, recarregada e removida, edição simultânea recusada); acesso sem sessão barrado (16 de 16). Banco real: 0 demandas e 0 tarefas, 1 usuário.
- **Perda de tarefas corrigida (migração 7):** versão por demanda, `salvar_demanda` recusa a janela desatualizada (`DM409`) sem gravar nada, aviso fixo e edição local preservada. Testes: `testar:banco` 118, `testar:app` 69, `testar:regras` 25.
- **Google:** botão oculto (`DMANDA_LOGIN_GOOGLE=nao` no `.env.local`; incluir também nas variáveis da Vercel). **Falta o usuário desativar o provedor Google no painel do Supabase** (Authentication > Sign In / Providers > Google), sem excluir usuário, identidade nem o projeto do Google Cloud; depois `npm run conferir:env` deve mostrar o Google desligado.
- **Depende do usuário:** desativar o Google no painel; decidir o destino privado das cópias; enquadramento do plano Hobby da Vercel; publicar na Vercel (variáveis, agendamento da rotina); avaliação visual (Issue #2) e PWA no iPhone e iPad; autorizar (ou não) uma demonstração da restauração da cópia no projeto real com dados TESTE.
- **Limitações conhecidas:** intermitência do `testar:sessao` com causa desconhecida (19 execuções seguidas sem falha); proteção só no salvamento da janela (operações pontuais seguem "último a gravar vence" por campo); cookie `dmanda-ultimo-uso` não assinado; restauração só testada em banco local; senhas vazadas dependem de plano pago; outros terminais além do PowerShell 5.1 não testados.
- **Próximo passo:** publicação na Vercel (passos em `supabase/LEIA-ME.md`), depois a avaliação do aplicativo publicado e o uso real.
- **Comandos:** `npm run testar:banco` (118), `testar:regras` (25), `testar:app` (69, sobe a 7103), `testar:sessao` (57), `conferir:env`, `definir:senha`, `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build`. Só um `next dev` por vez.

---

## PONTO ANTERIOR (26/10/2026, auditoria única; superado pelo ponto acima)

**Leia primeiro `AUDITORIA.md`** (relatório, achados, mapa de persistência, ações do usuário em ordem). Esta seção é só o resumo para continuar.

- **Branch:** `checkpoint/2026-10-23-ajustes-a-d` (sem merge na main). Base da auditoria: `d22f216`. Os commits da auditoria vêm em seguida (hash conferido no remoto no relatório).
- **Feito (código, testado em banco local e Auth falso):** entrada por e-mail e senha (`src/servidor/entrar.ts`, `FormularioSenha`, migração 6, `scripts/definir-senha.mjs`), sessão de 6 h mais firme (cookie ausente ou futuro expira), `/marca` fechada ao público, falhas de conexão e de sessão tratadas, rascunho automático, atualização ao voltar para a tela, login com os tokens do Catalyst (claro e escuro), PWA online (manifesto, ícones, metadados, área segura do iPhone), cabeçalhos de segurança, cópia dos dados em JSON, ajustes de ferramentas e do `.env.example`.
- **Não feito, depende de você:** `.env.local` neste computador, `npx supabase login` e `link`, aplicar a migração 6 (o Claude faz depois do login), ligar o provedor Email, `npm run definir:senha`, provar a entrada por senha, só então desligar o Google; Vercel e enquadramento do plano; destino privado das cópias. Ver a lista ordenada no fim de `AUDITORIA.md`.
- **Neste computador:** não há `.env.local` nem login da CLI do Supabase, então **nada foi validado no Supabase real**. `gh` não instalado (Issue consolidada: texto pronto em `AUDITORIA.md`). `node_modules` foi reinstalado com `npm ci`.
- **Comandos:** `npm run testar:banco` (103), `testar:regras` (25), `testar:app` (65, sobe a 7103), `testar:sessao` (57, sobe a 7104 e usa o Auth falso na 7105), `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build`, `npm run definir:senha`. Só um `next dev` por vez.
- **Atualização do mesmo dia (bloco "validar no Supabase real", em andamento):** `.env.local` criado neste computador a partir do modelo (URL do projeto e `CRON_SECRET` gerado; **faltam** chave pública, chave secreta e `DMANDA_EMAIL_AUTORIZADO`, que só o usuário preenche). Novos: `npm run conferir:env`, `npm run testar:senha-terminal` (ConPTY), `supabase/restaurar-copia.sql` (restauração testada em banco de teste). `definir:senha` ganhou ignorar setas e checar tamanho antes da confirmação. Intermitência do `testar:sessao`: causa desconhecida, 10 execuções seguidas passaram, diagnóstico reforçado. **CLI do Supabase continua sem login** (`AccessTokenRequiredError`) e sem projeto vinculado; nada no Supabase real foi tocado. Próximo passo é do usuário: preencher o `.env.local`, `! npx supabase login`, `! npx supabase link --project-ref gmxoosvgfcydccyeudej`; depois o Claude roda `npm run conferir:env`, o dry-run da migração 6 e a aplicação.
- **Próxima ação concreta:** depois do `supabase login` e do `.env.local`, pedir ao Claude para aplicar a migração 6 (dry-run primeiro) e conferir o banco; em seguida ligar o provedor Email e rodar `npm run definir:senha`.

---

## PONTO DE RETOMADA PARA O COMPUTADOR DO TRABALHO (26/10/2026, ~01h20, computador de casa)

Esta seção basta para continuar sem reler a conversa nem depender da memória local do Claude.

**Onde está o código:** https://github.com/edermoliveira/Dmanda.git (privado), branch `checkpoint/2026-10-23-ajustes-a-d`. Último commit de implementação: `1c00141` (botão Sair, ajuste da expiração, `testar:sessao`). Depois dele só documentação de retomada. Sem merge na main. O GitHub guarda o código, não os registros reais do Supabase (cópia dos dados: Issue #4).

**Bloco em andamento:** Issue #1 (login Google e integração real), fechamento da validação real. Estado: o bloco de implementação está concluído e a validação real está parada no meio, por escolha do usuário (continua no trabalho).

**Últimas alterações (1c00141):**
- `src/servidor/demandas.ts`: ação `sairDaConta` (`signOut({ scope: 'local' })`, apaga o cookie de último uso, devolve `sessaoLocalEncerrada` quando o Auth falha mas a sessão local já foi apagada).
- `src/ui/MenuConta.tsx` (novo) e `src/ui/Casca.tsx`: menu do avatar do topo com "Sair" (desktop e celular), sem o módulo Perfil.
- `src/app/(app)/login/page.tsx`: avisos `?saiu=1`, `?saiu=parcial`, `?negado=1`, `?expirou=1`, `?erro=1`.
- `src/proxy.ts`: expiração por inatividade (6 h) também com escopo local.
- `scripts/testar-sessao.mjs` (novo, `npm run testar:sessao`) e bloco 11b em `scripts/testar-app.mjs`.

**O que está VALIDADO, por tipo de prova:**
- *Supabase real, com o usuário logado (Google real):* primeiro login (1 usuário, 1 identidade, na lista protegida); cadastro, edição, tarefas, etapa, concluir, reabrir, excluir, persistência e quatro visões pela interface, conferidos por leitura do banco; arraste no Quadro com persistência (registro TESTE removido); rotina diária por HTTP local autenticado contra o banco real (200, execução e resumo gravados). Hook, Google, Email desligado, Site URL e Redirect URL conferidos pela CLI.
- *Testes locais, sem Supabase real:* `testar:sessao` 20/20 (Auth falso e tempo controlado: 5h59 renova, 6h01 expira, Sair com falha, rotas protegidas, preferências preservadas); `testar:app` 60/60 (PGlite); `tsc` e `eslint` aprovados no último bloco. `testar:banco` (87) e `testar:regras` (21) não foram repetidos neste bloco. `next build` não foi rodado depois da implementação do Sair.
- *Limitação:* as seis horas só foram testadas em ambiente isolado, não em 6 h reais nem com o Google real. Os fluxos e o arraste foram feitos por mim, via extensão do Chrome sobre a sessão do usuário, e **não são avaliação visual dele**.

**O que AINDA NÃO ocorreu:**
- Teste real simultâneo em Edge e Chrome (prova de que Sair local não derruba outro navegador).
- Segundo acesso depois de Sair (mesmo usuário e mesma identidade Google reutilizados).
- Tentativa real com outra conta Google e comprovação da rejeição pelo hook (o app deve mostrar `/login?negado=1`; se o Supabase devolver outra forma de erro, ajustar `src/app/auth/callback/route.ts` com base no log do servidor).
- Desligar "Allow new users to sign up" e nova entrada da conta existente (só DEPOIS da rejeição provada, para não confundir as causas).
- Aprovação visual da aplicação React pelo usuário (Issue #2). Nenhuma foi registrada.
- Publicação na Vercel, backup próprio dos dados (#4) e agendamento da rotina em produção com primeira execução automática (#3).

**Estado do Supabase:** projeto Dmanda (`gmxoosvgfcydccyeudej`, São Paulo, plano gratuito). 5 migrações aplicadas na época (hoje 7, ver o ponto de retomada mais recente). Banco real no fim da sessão: 0 demandas, 0 tarefas, 1 usuário, 1 identidade Google, `execucoes_rotina` com 2 linhas e 1 resumo (evidência da rotina, preservados). Cadastro de novos usuários ainda ABERTO no painel, de propósito. Provedor Google ativo, Email desligado, hook Before User Created ativo.

**Próxima ação concreta (no computador do trabalho):** a validação real precisa do Google Cloud e do Supabase, então só é possível onde o `.env.local` e o Redirect URL `http://localhost:7100/auth/callback` funcionarem. Ordem: (1) preparar o ambiente (abaixo); (2) `npm run dev`; (3) Edge: entrar com a conta autorizada; (4) Chrome (ou outro navegador): avatar, Sair, entrar de novo, avisar o Claude para conferir o banco (mesmo usuário e identidade, sessão antiga removida, sessão do Edge preservada); (5) Sair e tentar entrar com outra conta Google SUA, sem adicioná-la ao Google Cloud nem à lista do Dmanda, e descrever o que apareceu; (6) só então o Claude orienta desligar o cadastro e testar a entrada da conta existente.

**Comandos atuais:** `npm install`, `npm run dev` (Supabase real, exige `.env.local`), `npm run dev:teste` (banco local descartável, PGlite), `npm run build` e `npm run start` (produção local na 7100), `npm run testar:banco`, `testar:regras`, `testar:app` (sobe a 7103), `testar:sessao` (sobe a 7104 e a 7105), `npx tsc --noEmit`, `npx eslint src scripts`. Protótipo: dentro de `prototipo`, `python -m http.server 7200 --bind 127.0.0.1`. Só um `next dev` por vez (a pasta `.next` tem trava); encerrar o da 7100 antes de `testar:app` e `testar:sessao`.

**Portas:** 7100 aplicação; 7200 protótipo; 7103 `testar:app`; 7104 e 7105 `testar:sessao` (aplicação e Auth falso).

**Variáveis de ambiente (só os NOMES; valores nunca no Git, no chat nem nas Issues):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DMANDA_EMAIL_AUTORIZADO`, `SUPABASE_SERVICE_ROLE_KEY` (a chave `sb_secret_...`, só no servidor), `CRON_SECRET`. `DMANDA_BANCO=teste` só em desenvolvimento (`dev:teste`). Descrição de cada uma e modelo: `supabase/LEIA-ME.md` e `.env.example` (versionado, sem valores).

**O que fica FORA do Git e precisa ser configurado no computador do trabalho:**
1. **`.env.local`** na raiz do projeto. **Fazer no computador do trabalho:** copiar `.env.example` para `.env.local` e preencher. URL e chave pública: painel do Supabase, Project Settings, API. Chave secreta: Project Settings, API Keys, Secret keys, "default". `DMANDA_EMAIL_AUTORIZADO`: a conta Google autorizada. `CRON_SECRET`: texto aleatório de 16 caracteres ou mais (pode ser novo; só precisa coincidir com o da Vercel quando houver publicação). Conferir sem revelar: comando de `node --env-file=.env.local -e ...` em `supabase/LEIA-ME.md` (mostra "preenchida" ou "VAZIA"). Se preferir não digitar segredos no trabalho, usar `npm run dev:teste`, que não precisa de nada disso.
2. **CLI do Supabase:** `npx supabase login` (abre o navegador) e `npx supabase link --project-ref gmxoosvgfcydccyeudej`. Só para este projeto; nunca `db reset`. A pasta `supabase/.temp` não vai para o Git.
3. **`gh` (GitHub CLI):** `gh auth login`, para as Issues. Se não existir, usar o site do GitHub.
4. **Chrome com a extensão Claude in Chrome**, logado na conta Google autorizada, se o Claude for conduzir testes no navegador. Edge já vem no Windows (usado por `testar:app`).
5. **Claude Code:** a memória local (`~/.claude`) não vai para o Git. Esta seção e as Issues bastam para retomar. Os plugins desativados no projeto estão em `.claude/settings.json` (versionado). Plugins e MCPs (Context7, Playwright, Figma) só reinstalar se forem usados.
6. **`.dados-teste/`** (banco de teste descartável) é local e fica fora do Git; é recriado pelos testes.
7. **Google Cloud e painel do Supabase já estão configurados na nuvem;** nada disso precisa ser refeito no trabalho. O único cuidado: o Redirect URL cadastrado é `http://localhost:7100/auth/callback`, então o login só funciona com a aplicação na porta 7100.

**Antes de pedir acesso real no trabalho:** se a rede do trabalho bloquear o Google ou o Supabase, o login real não será possível lá. Nesse caso, avançar com `dev:teste` e a Issue #2, e deixar o login real para casa.

---


## RETOMADA RÁPIDA (atualizada em 25/10/2026, computador de casa)

**Situação (25/10/2026, noite): login Google real FUNCIONA e a interface grava no Supabase real.** Hook Before User Created ativo, provedor Google ativo, Email desativado, Site URL e Redirect URL certos (tudo conferido pela CLI com `config pull` em pasta temporária). O usuário fez o primeiro login (1 usuário, 1 identidade Google, na lista protegida). Pela interface, na sessão real, com registros TESTE (depois excluídos, banco com 0 demandas): cadastro, edição, tarefas (incluir, editar, marcar, remover), mudança de etapa, concluir, reabrir, excluir, persistência ao recarregar e as quatro visões iguais, cada passo conferido por leitura do banco. Rotina: chamada HTTP local autenticada 200 contra o Supabase real, execução e resumo gravados e recalculados. **Ainda não validados:** segundo acesso (mesmo usuário reutilizado), rejeição de outra conta (bloqueio do Google em Teste vs rejeição pelo hook), expiração de 6 h, desligar "Allow new users to sign up", Vercel, agendamento e primeira execução automática. **26/10/2026:** botão **Sair** implementado no menu do avatar (commit 1c00141; `sairDaConta` em `src/servidor/demandas.ts`, `src/ui/MenuConta.tsx`): signOut oficial com escopo local; se o Auth não confirmar, o SDK apaga a sessão local mesmo assim e a tela vai a `/login?saiu=parcial` com aviso honesto. Expiração por inatividade passou a usar escopo local também. Arraste no Quadro validado na sessão real (TESTE removido). Seis horas: testado em ambiente isolado (`npm run testar:sessao`, Auth falso e tempo controlado, 20 verificações), não é teste de 6 h reais. A aplicação React continua SEM aprovação visual do usuário. `npm run dev` (modo real) está no ar na 7100.
**Branch:** `checkpoint/2026-10-23-ajustes-a-d`. Remoto: https://github.com/edermoliveira/Dmanda.git. Push autorizado para esta branch durante o bloco (nunca main, nunca force push). O hash enviado é conferido com `git ls-remote origin refs/heads/checkpoint/2026-10-23-ajustes-a-d`; nunca comparar o backup com `origin/main`.

**Projeto Supabase:** Dmanda, referência `gmxoosvgfcydccyeudej`, organização `ubuzntqxnuaiqrprrknw`, São Paulo, plano gratuito, vinculado por `npx supabase link` (CLI oficial autenticada neste computador por login do usuário; outros projetos da conta não são tocados). `.env.local` criado neste computador (URL, chave pública, conta autorizada, `CRON_SECRET`); **falta o usuário colar a chave secreta** em `SUPABASE_SERVICE_ROLE_KEY=`. Valores nunca no chat nem no Git.

**Migrações aplicadas no banco real (5):** `20261025000000_nucleo_demandas` (privilégios agora explícitos), `..000100_salvar_demanda`, `..000200_rotina_diaria`, `..000300_acesso_exclusivo` (lista protegida `dmanda_privado.acesso_autorizado`, `conta_autorizada()`, hook `public.hook_antes_criar_usuario`, RLS exigindo a conta autorizada), `..000400_revogar_funcao_da_plataforma` (`rls_auto_enable`). A conta autorizada foi cadastrada na lista protegida por comando (o endereço não está em arquivo versionado). Security Advisor: sem problemas.

**Restrição à conta do usuário, em três camadas:** (1) hook Before User Created no Auth: **escrito e no banco, mas a ativação no painel é ação do usuário**; (2) servidor: proxy, callback e cada operação exigem sessão, provedor Google, e-mail autorizado e uso nas últimas 6 h (`contaAutorizada` em `src/lib/sessao.ts`); (3) banco: RLS com `user_id = auth.uid()` e `conta_autorizada()`. O cadastro continua aberto no painel até o primeiro login do usuário, de propósito.

**Para conferir agora:** aplicação React em http://localhost:7100 em **modo de teste** (`.dados-teste/visual`, 5 demandas de teste, não é o Supabase) e protótipo em http://127.0.0.1:7200. Se não estiverem no ar: `DMANDA_BANCO=teste DMANDA_PASTA_TESTE=./.dados-teste/visual node node_modules/next/dist/bin/next dev -p 7100` e `python -m http.server 7200 --bind 127.0.0.1` dentro de `prototipo`. Só um `next dev` por vez: para o modo real, encerrar o de teste e rodar `npm run dev`.

**Feito nos blocos de 25/10/2026:** cápsula como componente (`src/ui/Capsula.tsx`), preferências do navegador só gravadas depois de lidas, rotina diária (migração, `src/nucleo/rotina.ts`, rota `/api/cron/diaria`, `vercel.json` 09:00 UTC), plugins desativados no projeto (taste-skill, ui-ux-pro-max, code-simplifier), documentos consolidados; e, neste bloco, a integração com o Supabase real, o acesso exclusivo, o banco de teste fiel ao Supabase com exposição automática desligada (privilégios padrão iguais aos do real, `auth.jwt()`, `supabase_auth_admin`, `entrarComo`), o ajuste do callback (conta recusada leva a `/login?negado=1`), `prompt: select_account` no login e três esperas por condição no `testar:app` (antes eram leituras imediatas, que falhavam por corrida).

**Testes (resultados reais deste bloco):** `testar:banco` 87/87; `testar:regras` 21/21; `testar:app` 58/58 (com o `.env.local` presente); `tsc`, `eslint` e `next build` limpos. Banco real: validação por SQL descrita em `supabase/LEIA-ME.md`. Produção local com `.env.local`: `/login` 200, `/` e `/demandas` redirecionam ao login, rota da rotina 401 sem segredo e com segredo errado, **500 com segredo correto e chave de serviço em branco** (falha por configuração ausente). Resultados anteriores (68, 19, 57) são históricos.

**Rotina diária em quatro níveis:** código preparado sim; função validada no banco real como papel de serviço sim, chamada HTTP bem-sucedida no banco real **não** (falta a chave de serviço); agendamento implantado **não**; primeira execução automática **não**.

**Limitações e pendências:** tudo que depende do Google Cloud, do painel do Supabase e da Vercel; `.env.example` (o assistente não tem permissão de editar, modelo em `supabase/LEIA-ME.md`); cópia privada dos dados reais (sem mecanismo nem destino; o plano gratuito não tem backups gerenciados, mas permite exportação lógica); enquadramento do plano Hobby da Vercel e pausa do Supabase gratuito (decisões e riscos do usuário); teclado virtual em aparelho real; ícones restantes; aprovação visual da aplicação (só o usuário). `rls_auto_enable` e o papel de serviço (`service_role`) mantêm privilégios padrão da plataforma que não são do Dmanda.

**Controle das tarefas: GitHub Issues** (repositório privado). Marco "Base real e primeiro uso": [#1 login Google e integração real](https://github.com/edermoliveira/Dmanda/issues/1), [#2 conferir a aplicação React](https://github.com/edermoliveira/Dmanda/issues/2), [#3 publicar e ativar a rotina](https://github.com/edermoliveira/Dmanda/issues/3), [#4 cópia privada dos dados](https://github.com/edermoliveira/Dmanda/issues/4). Ao iniciar um bloco, consultar as Issues (`gh issue list`); referenciar os números nos commits, sem fechamento automático. **Dependência atual: #1 aguarda o usuário** (Google Cloud, depois painel do Supabase). A aplicação React **não** foi aprovada pelo usuário (#2 aberta).

**Chave secreta e papel de serviço (conferido):** `sb_secret_...` não é JWT; o código a entrega como texto opaco ao `createClient` (supabase-js 2.118 a envia em `apikey`). Nos GRANTs reais, `service_role` só executa `rotina_diaria()` e `registrar_falha_rotina(text)` e não tem select/insert/update/delete nas tabelas (restrição real); mas a chave também vale para APIs administrativas do Supabase e o papel mantém `TRUNCATE`/`REFERENCES`/`TRIGGER` por padrão da plataforma. Os testes no banco real são **SQL com contextos de autenticação simulados** e não comprovam o login Google.

**Próxima ação concreta (Issue #1):** o usuário (1) faz o segundo acesso (limpar os dados do site localhost:7100 e entrar de novo); (2) testa uma segunda conta Google SUA, que não entra na lista do Dmanda: primeiro sem ser usuária de teste no Google Cloud (esperado: bloqueio do próprio Google, sem passar pelo hook), depois adicionada como usuária de teste (esperado: o hook recusa e o app mostra "sem acesso", ainda 1 usuário no banco); (3) desliga "Allow new users to sign up" e entra de novo com a conta autorizada. O assistente confere cada passo no banco real. Não iniciar Entradas, Agenda ou outro módulo antes disso e da avaliação do usuário.

**Comandos:** `npm run dev:teste`, `npm run dev` (exige `.env.local`), `npm run testar:banco`, `testar:regras`, `testar:app` (sobe a 7103; encerrar antes qualquer `next dev`), `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build`, `npx supabase migration list --linked`, `npx supabase db push --linked --dry-run`, `npx supabase db advisors --linked`.

---

## 0. PONTO DE RETOMADA (23/10/2026, computador de casa) [HISTÓRICO, superado pela Retomada rápida acima]

**Branch do checkpoint:** `checkpoint/2026-10-23-ajustes-a-d` (enviada ao GitHub com autorização expressa; **sem merge na main**). Para continuar em casa, **no PowerShell, dentro da pasta do projeto:** `git fetch` e `git checkout checkpoint/2026-10-23-ajustes-a-d`, depois `npm install`.

**Trabalho realizado (implementado, commitado nesta branch):**
- A. Descrição opcional nas demandas (cadastro, edição, cards, Quadro, Início, Lista), em mono, até 3 linhas.
- B. Vidro cerca de 30% mais transparente por um fator único (`--vidro: .7`).
- C. Cores dos processos restauradas (causa: empate de especificidade no Catalyst), faixa do tipo no card atrasado.
- D. Menu lateral: ícone selecionado legível, mesmo desenho em todos os estados, seleção por forma, nome acessível.
- Correções achadas pelo teste: contraste de "Concluir demanda", "Finalizada" e "Reabrir demanda" no modo escuro e claro; botão mini só com ícone no Catalyst. Detalhes em `DECISOES.md`, seção "Ajustes A a D".

**ESTADO ATUAL (23/10/2026, casa):** ajustes A a D **aprovados visualmente**. Catalyst é a **única direção** (claro e escuro). **Mostrar menu** corrigido e testado (`testes/menu.mjs`; causa e correção em `DECISOES.md`). Ionicons outline escolhido; **só os 7 ícones de navegação** estão implementados (`prototipo/icones-nav/`); os demais ícones **aguardam a seleção do usuário**. Esta mudança de bloco **aguarda a avaliação visual do usuário**. Detalhes e testes em `DECISOES.md`, seção "Ajustes A a D aprovados; Catalyst único; Ionicons; Mostrar menu".

**CONFIGURAÇÃO DE CASA (23/10/2026, mesma sessão):**
- **Compartilhado pelo repositório:** `.claude/settings.json` (plugin `ui-ux-pro-max`), as três skills em `.claude/skills/` com licença, a Impeccable em `.claude/skills/impeccable/` e `.claude/agents/` (4 agentes dela), `.impeccable/config.json` (telemetria desligada) e a seção "Ferramentas" do `CLAUDE.md`. O binário do motor (`.claude/skills/impeccable/scripts/bin/`, 19 MB, por sistema) fica no `.gitignore`.
- **Local deste computador (não vai ao Git):** plugins do usuário (`taste-skill`, `ui-ux-pro-max`, `context7`, `code-review`, `code-simplifier`, `playwright`), o MCP do Figma no escopo do projeto em `~/.claude.json`, memória local, `~/.impeccable/` (cache do motor), padrão de esforço (`xhigh` global, `medium` para o Sonnet 5.5).
- **`ui-ux-pro-max` em dois escopos:** o registro mostra usuário e projeto, mas a sessão lista um único conjunto de skills dele, então não está carregado em dobro. Nada foi desinstalado.
- **`~/.claude.json`:** o arquivo é JSON válido. A falha era do leitor (PowerShell 5.1 trata chaves sem distinguir maiúsculas, e há duas entradas de projeto que diferem só por maiúsculas). Nada foi alterado.
- **Computador do trabalho: sem confirmação.** Não sabemos quais plugins, MCPs e ajustes existem lá. Para reproduzir esta configuração lá, **no PowerShell, dentro da pasta do projeto:** `git pull`, `npm install` e `npx impeccable install --providers=claude --scope=project --no-hooks --yes` (reinstala o motor; confira que `.impeccable/config.json` veio do Git). Plugins do usuário precisam ser conferidos à mão.

**Testes sobre a versão final deste bloco (23/10/2026, Catalyst; cada comando em sequência, resultado real):**
- `consolidacao.mjs`: aprovado (endereços antigos, sem seletor de direções, 7 ícones Ionicons em claro e escuro, menu recolhido e aberto, iPad vertical e celular, sem erros de recurso).
- `menu.mjs`: aprovado (mostrar, navegar, voltar, recarregar, recolher, janela média, iPad e celular).
- `preservar-catalyst.mjs comparar`: 78 telas conferidas contra a referência anterior à consolidação, sem diferenças além das autorizadas (painel de tema da Config e desenho dos 7 ícones; cor, caixa e posição dos ícones iguais em 804 ocorrências).
- `ajustes-a-d.mjs` (claro e escuro), `fluxos.mjs`: aprovados.
- `clicar-tudo.mjs d` claro e escuro, computador (462 cliques) e celular (367 cliques): 0 erros, 0 contraste, 0 estouros, 0 não clicáveis. `verificar-cores.mjs`: ok.
- **iPad vertical (820 px) acusava 18 "texto maior que o botão" em Demandas (resultado histórico, antes da correção de 24/10/2026; já existiam no código anterior à consolidação).** Ver o bloco "Correção do iPad" abaixo.

**Correção do iPad (24/10/2026, executada sobre `dd3bf3c`):**
- **Causa confirmada:** `estilo.css` esconde o rótulo (`.tx`) e fixa 44 px nos botões `.btn.gl` e `.btn.escuro` até 899 px de container, mas o `padding: 0` do Catalyst nesses botões vivia só no `@container tela (max-width: 520px)`. Entre 521 e 899 px sobravam 12 px úteis (44 menos 2 x 16) para um ícone de 18 px. O container é o `.frame`, 2 px menor que o frame por causa da borda.
- **Alteração:** uma regra de duas linhas em `catalyst.css`, no bloco de 899 px: `.toolbar .btn.gl, .toolbar .btn.escuro { padding: 0; }`. Largura de 44 px, ícone de 18 px, rótulos e demais estilos intactos.
- **Executado sobre esta correção:** `testes/ipad-botoes.mjs` (novo): iPad vertical de 820 px em claro e escuro, nas quatro visualizações de Demandas, e limites do container em 520, 521, 899 e 900 px; antes da correção falhava em 11 verificações (largura útil de 12 px), depois passou todas. `clicar-tudo.mjs d claro,escuro tablet-v`: 713 cliques, 0 erros, 0 contraste, **0 estouros (eram 18)**, 0 não clicáveis, 0 sem efeito, 0 alvos pequenos. `preservar-catalyst.mjs comparar` (78 telas contra uma referência regravada de `dd3bf3c`): 48 diferenças, todas o esperado (padding lateral de 16 px para 0 nos 3 botões, em 4 visualizações de Demandas, nos 2 modos, só no iPad vertical); as outras 70 telas, idênticas. Não regravei a linha de base e não repeti a suíte do computador e do celular (nenhuma regra delas mudou).
- **Ajuste no script de comparação:** a regra "ícone Ionicons é mudança autorizada" agora só vale quando a referência é anterior à migração (`!x.k` com `ion`), senão acusava os ícones que já eram Ionicons na referência.

**Revisão visual de 24/10/2026 (commits locais sobre `67b425c`, branch `checkpoint/2026-10-23-ajustes-a-d`):** `e0817b2` energia em SVG; `50c11bd` Perfil e Pomodoro; `98790c8` cards em duas colunas; `b0c17d1` Agenda; `60f2c7a` Quadro; mais os commits da retomada (mover etapa sem inventar dados, fundo, caixas de marcar; hashes no relatório final). Decisões em `DECISOES.md`, "Revisão visual de 24/10/2026". Testes novos (em `prototipo/testes`): `energia`, `perfil-pomodoro`, `ipad-cards`, `agenda-demandas`, `quadro`, `fundo`, `checkbox`. O arraste anterior (HTML5) foi substituído por um arraste por ponteiro; o fundo animado foi retirado (`data-anim`, `anim` e a animação `flutua`). **Ponto de retomada, se algo falhar:** tudo desta lista está commitado; o que resta é a avaliação visual do usuário.

**Testes desta retomada (24/10/2026, executados sobre a versão final do bloco, cada um com seu código de saída):** `energia` 22 ok; `perfil-pomodoro` 121 ok; `ipad-botoes` 13 ok; `ipad-cards` 39 ok; `agenda-demandas` 46 ok; `quadro` 38 ok; `fundo` 36 ok; `checkbox` 32 ok; `consolidacao` 22 ok; `menu` 18 ok; `fluxos` e `ajustes-a-d` aprovados; `verificar-cores` ok; todos com saída 0. `clicar-tudo.mjs d claro,escuro desktop,phone`: 1676 cliques, 0 erros, 0 contraste, 0 estouros, 0 não clicáveis, saída 0. `clicar-tudo.mjs d claro,escuro tablet-v,tablet-h,media`: 2125 cliques, 0 erros, 0 estouros, 0 não clicáveis, **3 contrastes** (selo "Legal" no escuro com as paletas Índigo e Violeta; defeito da paleta, ver PENDENCIAS.md), saída 1. `preservar-catalyst.mjs comparar` contra uma referência regravada de `dd3bf3c` (não regravei nada): as 78 telas diferem, todas por mudanças intencionais desta revisão (camada do fundo, energia em SVG no lugar da reserva, círculo e botão da Agenda, painel Fundo, avatar, cards em duas colunas, Quadro de 300 px, caixas de marcar, Pomodoro); depois de alinhar os elementos acrescentados não restou mudança de cor, fonte ou posição fora desse escopo. Resultados anteriores a esta retomada continuam registrados acima como históricos.

**Segundo bloco de ajustes visuais (24/10/2026):** faixa lateral dos cards retirada, Configurações em colunas, histórico do Perfil em colunas por dia e cadastro e edição de demandas em grupos. Código em `v5.css`, `v3.css`, `catalyst.css`, `tema.css` e `extra.js`. Testes novos: `card-faixa`, `config-layout`, `perfil-historico`, `form-demanda`; o `ajustes-a-d.mjs` passou a conferir que NÃO há faixa (a regra antiga foi substituída). Decisões em `DECISOES.md`, "Ajustes visuais de 24/10/2026 (segundo bloco)".

**Testes do segundo bloco (24/10/2026, saídas reais):** `card-faixa` 25 ok; `config-layout` 66 ok; `perfil-historico` 49 ok; `form-demanda` 61 ok; `checkbox` 32; `agenda-demandas` 46; `perfil-pomodoro` 121; `energia` 22; `ipad-cards` 39; `fundo` 36; `quadro` 38; `consolidacao` 22; `menu` 18; `fluxos` 17; `ipad-botoes` 13; `verificar-cores` ok; `ajustes-a-d` 83 ok depois de trocar a verificação que exigia a faixa (a regra foi substituída); todos com saída 0. `clicar-tudo d claro,escuro desktop,phone`: 1676 cliques, 0 problemas, saída 0. `clicar-tudo d claro,escuro tablet-v,tablet-h,media`: 2125 cliques, 0 erros, 0 estouros, 3 contrastes (o selo "Legal" do escuro; ver PENDENCIAS.md), saída 1.

**Acabamento de 24/10/2026 (depois do segundo bloco):** selo "Legal" corrigido no escuro, rodapé do formulário compactado no celular com menu de ações no cabeçalho, datas do histórico marcadas como demonstrativas e estado da comparação visual registrado em `PENDENCIAS.md`. Testes: `selo-legal` 6 ok, `form-demanda` 69 ok, `quadro` 38 ok (a espera da rolagem automática foi tornada robusta: dependia dos quadros por segundo), `fluxos`, `consolidacao`, `agenda-demandas`, `perfil-historico`, `checkbox` ok.

**Aprovação visual e referência (24/10/2026):** o usuário aprovou visualmente o commit `cd7b03f` (ver DECISOES.md). Nova referência: `prototipo/testes/referencias/catalyst-cd7b03f.json.gz`, 78 cenários (claro e escuro, Computador, iPad vertical e Celular, 13 telas), conferida contra o próprio commit: 78 telas sem diferenças. O `preservar-catalyst.mjs` agora lê e grava arquivos `.gz`.

**Fechamento do design (24/10/2026):** design do protótipo aprovado pelo usuário, vinculado a `cd7b03f` (versão servida idêntica nos arquivos do protótipo); referência `catalyst-cd7b03f.json.gz` reutilizada. Pendências reais: teclado virtual em aparelho real, data própria por registro de Humor e Energia na implementação funcional, seleção dos demais ícones.

**Ícones, primeiro grupo (24/10/2026):** Cards (`albums-outline`), Tabela (`grid-outline`) e Lista (`list-outline`) em Ionicons; Quadro pendente. Teste novo `testes/icones-visualizacoes.mjs` (41 ok, saída 0); `consolidacao` (22), `fluxos` (17) e `menu` (18) ok, saída 0. A verificação dos sete ícones do `consolidacao` agora ignora a barra de ferramentas, que tem teste próprio. Referência visual não regravada.

**Ícones, segundo grupo (25/10/2026):** `search-outline`, `funnel-outline`, `arrow-up-outline`, `arrow-down-outline` e `chevron-down-outline`. Teste novo `testes/icones-busca-filtros.mjs` (52 ok, saída 0); `consolidacao` (22), `menu` (18), `fluxos` (17) e `icones-visualizacoes` (41) ok. Referência visual não regravada.

**Pendências do usuário:** (1) avaliar visualmente este bloco (Catalyst único, 7 ícones, Mostrar menu); (2) selecionar os símbolos Ionicons dos demais ícones; (3) ajuste do iPad vertical corrigido em 24/10/2026 e revisão visual do mesmo dia implementada (ver bloco acima), ambos só aguardam a sua avaliação; (4) ferramentas (Impeccable já instalada), um assunto por vez; (5) merge na main, se quiser.

**Lembretes de máquina:** no trabalho o computador ficou com pouca memória (Chrome do usuário ocupa muita). O `clicar-tudo.mjs` agora usa flags que poupam memória; rodar uma combinação por vez. Não rodar a suíte inteira de uma vez.

---

## 1. Onde estamos

- **Protótipo** (`prototipo/`, HTML, CSS e JS puros, dados fictícios): quatro temas (Aurora, Papel, Grafite e o experimental Catalyst), claro e escuro, celular, iPad e computador. A rodada 3 de ajustes foi aplicada e testada (commit `492778b`) e **aguarda a sua avaliação**.
- **Testes automáticos:** `prototipo/testes/clicar-tudo.mjs` clica em todos os controles de todas as telas, mede contraste, estouro de layout e erros de JavaScript. `prototipo/testes/fluxos.mjs` confere 17 fluxos de uso. Última rodada completa (quatro temas, claro e escuro, computador e celular): **6.370 cliques, 0 erros, 0 problemas de contraste, 0 estouros, 0 controles não clicáveis**.
- **Código real em `src/`:** ainda é o design antigo de 20/10/2026 e será substituído quando a construção real começar.
- **Pastas:** a duplicidade foi resolvida em 23/10/2026. Existe **uma só pasta do projeto, `Desktop\Dmanda`**. A cópia `Desktop\Dmanda\Dmanda` foi excluída depois de revisada (seção 2).
- **Figma:** o limite gratuito acabou (20 leituras por mês). O plano para não perder mais chamadas está na seção 6.
- **Nada foi instalado** além do `playwright-core` (dependência de desenvolvimento do projeto, já no `package.json`). As ferramentas novas só foram avaliadas.
- **Nova direção de design (decidida por você):** iPhone como PWA já construído como app nativo, e iPad igual, com Apple Pencil em Entradas no futuro. As propostas técnicas aguardam a sua aprovação (`DECISOES.md`, "Direção iPhone e iPad").

---

## 2. Histórico

### 21/10/2026 (resumo)
Planejamento concluído e decisões gravadas em `DECISOES.md`. Escopo ampliado (Entradas, Agenda, Documentos, IA, Configurações, humor, clima, PWA). Design system antigo será refeito do zero. Protótipo de três direções criado.

### 22/10/2026, manhã e tarde (resumo)
Temas Aurora, Papel e Grafite definidos como definitivos. Rodada 2 do protótipo (menu recolhido, Perfil em gaveta, aviso de retorno, compromissos por tipo, cards sem rolagem, rascunho que nunca se perde, botões estilo Apple). Figma conectado (kit "iOS and iPadOS 27"). Quarto tema, **Catalyst**, criado e testado. Primeira versão deste documento criada.

### 22 para 23/10/2026, noite (este chat, computador de casa)

1. **Retomada:** `git pull` confirmou que estava atualizado. Documentos lidos. Memória local já existia. Protótipo subido em http://127.0.0.1:7200.
2. **Sua avaliação do Catalyst e da rodada 2:** Início com "Amanhã", botões menos arredondados e mais harmônicos, Concluir demanda menor e mais fino, tarefas e tudo alterável, etapa "Vista" vira "Vistos", texto das notas de um tamanho só, "+" em cada dia da Agenda, IA que registra entrada ou evento, widgets com Pomodoro, revisão geral do Catalyst com o kit do Figma, e quatro questões para o futuro (testes, backup, segurança com login após 6 horas sem uso, velocidade).
3. **O que foi feito:** tudo isso foi aplicado (detalhes em `DECISOES.md`, "Avaliação do protótipo, rodada 3"). Arquivos novos: `prototipo/v5.css` e `prototipo/v5.js`. Ajustes em `app.js`, `extra.js`, `catalyst.css` e `index.html`.
4. **Testes:** o script de cliques foi recriado e agora vive no repositório. O primeiro teste achou defeitos reais, todos corrigidos: o card girava antes do clique quando o mouse mirava no "Concluir demanda"; as etiquetas "Portaria" e "Pedido de informação" e os fins de semana da Agenda estavam abaixo do contraste mínimo; os botões "+" e "..." das colunas do Quadro passavam da borda; o círculo das tarefas desmarcadas não aparecia no Catalyst; o botão de menos do Pomodoro não desligava no mínimo.
5. **Figma:** a leitura do kit parou depois de Widgets, Botões e Campos de texto por causa do limite gratuito. Detalhes na seção 6.
6. **Perguntas suas respondidas:** GitHub Issues (proposta feita, aguarda você), limite do Figma, graphify (ainda não compensa).
7. **Primeiro fechamento:** commit `7dc0dff` enviado ao GitHub a seu pedido, com a avaliação do no-ai-slop e do Open Notebook (seção 5).
8. **Segunda parte da sessão, a seu pedido:**
   - **Plano do Figma só com o que faltou**, para não gastar mais chamadas: seção 6.
   - **Avaliação de nove skills e ferramentas** (Taste skill, Impeccable, React Bits, GSAP skills, Playwright CLI, Transitions.dev, Designlang, Claude Design, Ponytail): seção 5.5 e `ANALISE-FERRAMENTAS.md`, seção 11.5. Nada foi instalado nem removido.
   - **Direção iPhone e iPad** gravada em `DECISOES.md` e no `CLAUDE.md`, com seis propostas técnicas aguardando você.
   - **Pastas duplicadas revisadas e resolvidas.** `Desktop\Dmanda` e `Desktop\Dmanda\Dmanda` tinham conteúdo idêntico no commit `d6e8406` (mesmo hash da árvore do Git). A interna não tinha nenhum commit exclusivo, nenhuma alteração, nenhum arquivo ignorado, ramo ou stash, e apontava para o mesmo GitHub. A principal estava 2 commits à frente e tem `node_modules`, `.next` e o histórico da sessão. **A interna (31 MB) foi excluída; a principal foi mantida.** Nada se perdeu.
   - **Segundo fechamento:** commit e envio ao GitHub, com a sua autorização expressa.

---

## 3. O que depende de VOCÊ (nada disto foi decidido pelo Claude)

### Decisões
1. **GitHub Issues:** você disse "passaremos a usar". **Ainda não foi criado nada.** A proposta está pendente: etiquetas em português (`decisão sua`, `defeito`, `melhoria`, `ideia`, `técnico`, `protótipo`, `aguardando você`), marcos com as etapas do `DECISOES.md`, `PENDENCIAS.md` virando só um índice com links, commits citando a issue ("fecha #12"). Responda "aprovo", ajuste, ou diga "pode criar".
2. **Skills de design (seção 5.5):** o Claude recomenda a **Impeccable** como a de melhor encaixe e como substituta possível da Taste skill. Você decide se instala (e quando), se substitui a Taste skill ou se mantém as duas, e se quer testar Transitions.dev, Playwright CLI, Ponytail e Claude Design.
3. **no-ai-slop:** instalar como está, criar uma versão em português dentro do projeto, ou não usar (seção 5.1).
4. **Open Notebook:** o Claude avaliou que **não serve** como IA do sistema (seção 5.2). Confirme.
5. **Direção iPhone e iPad:** aprovar, ajustar ou recusar cada uma das seis propostas técnicas (`DECISOES.md`, "Direção iPhone e iPad").
6. **Figma:** guardar os PNGs exportados **dentro do Git** (recomendado, cerca de 10 MB no total, fica nos dois computadores) ou só no computador de casa; e se aceita incluir a lista B (seção 6).
7. **Concluir demanda:** deixei o fundo azul claro (mais sutil). Manter, ou voltar ao azul cheio já mais fino?
8. **Avaliar a rodada 3 e o Catalyst** (http://127.0.0.1:7200; no Catalyst, clicar em "D Catalyst"; se algo parecer antigo, Ctrl+F5): dizer o que ainda destoa.
9. **Escolher os padrões de cada tema** (Aurora, Papel e Grafite): par de fontes, estilo de ícones e paleta padrão. Hoje há padrões provisórios.
10. **Plano de blocos e de modelos (seção 7):** aprovar, ajustar ou recusar.

### Ações fora do Claude Code
11. **No Figma (navegador), exportar as páginas que faltam como PNG:** passo a passo na seção 6. Leva de 10 a 15 minutos e não gasta nenhuma chamada.
12. **Sem pressa:** criar o banco de 500 frases da mensagem do dia; (a energia já foi enviada em SVG e integrada; antes: `energia-1.png` a `energia-5.png` (opcional).

---

## 4. Como sincronizar no computador do trabalho (sem administrador)

**Fazer no PowerShell (fora do Claude Code), dentro da pasta do projeto:**

```
cd $HOME\Desktop\Dmanda
git pull
npm install
git log --oneline -3
```

(Se a pasta ainda não existir: `git clone https://github.com/edermoliveira/Dmanda.git` e depois `cd Dmanda`.)

- O `git log` deve mostrar no topo o commit "Sincronização de 23/10/2026..." (que inclui este arquivo), logo acima do `7dc0dff`.
- O `npm install` agora também instala o `playwright-core`, usado pelos testes. Ele **não baixa navegador**: usa o Microsoft Edge que já vem no Windows.
- Ver o protótipo: `cd prototipo` e `python -m http.server 7200`, depois abrir http://127.0.0.1:7200. Os testes têm servidor próprio e não precisam desse comando.
- Conferir o ambiente: dentro de `prototipo`, `node testes/fluxos.mjs` (cerca de 1 minuto). Deve terminar com "Todos os fluxos passaram."
- GitHub Issues: conferir `gh --version`. Se o `gh` não existir no trabalho, as issues podem ser criadas pelo site do GitHub (não instalar nada que peça administrador).
- **No computador do trabalho pode existir uma pasta `Dmanda\Dmanda` duplicada, como havia em casa.** Se existir, não apague sozinho: peça ao Claude para repetir a revisão (comparar o hash da árvore do Git e conferir que não há nada exclusivo) antes de excluir.

### O que NÃO vem pelo Git e precisa ser refeito
- **Memória do Claude:** é local de cada computador. O Claude recria a partir de `CLAUDE.md`, `DECISOES.md`, `PENDENCIAS.md` e deste arquivo.
- **MCP do Figma** (só se for usar; o limite gratuito já acabou). **No PowerShell, dentro da pasta do projeto:** `claude mcp add --transport http figma https://mcp.figma.com/mcp`, reiniciar o Claude Code e autenticar em `/mcp`.
- **Plugins e skills** (só instalar se precisar): `taste-skill` (marketplace `Leonxlnx/taste-skill`), `ui-ux-pro-max` (marketplace `nextlevelbuilder/ui-ux-pro-max-skill`), plugin `context7` e o Playwright. As três skills do Superpowers já vêm no Git (`.claude/skills/`).
- **`.env.local`:** nunca vai para o Git. Hoje não é necessário.
- **Regras da máquina:** sem instaladores que peçam administrador. Docker Desktop, por exemplo, não roda no trabalho.

---

## 5. Avaliação das ferramentas (nada instalado)

Texto completo em `ANALISE-FERRAMENTAS.md`, seção 11.

### 5.1 no-ai-slop (skill de texto)
- Skill MIT, sem scripts nem chaves, que **edita texto** removendo mais de 20 vícios de "texto de IA" (contraste "não é X, é Y", aberturas enfeitadas, falsa profundidade, palavras proibidas, travessão, dois-pontos demais, negrito e emoji). Devolve texto, não mexe em arquivo.
- **Funciona para texto, mas só em inglês.** O português tem vícios próprios, e a skill pegaria pouco nos nossos textos como está.
- **Não é para o visual.** Para a "cara de IA" das telas, a Taste skill (e a Impeccable, se aprovada) é a ferramenta.
- **Opções para você decidir:** (a) instalar como está e testar em português; (b) criar uma **versão em português** no projeto (`.claude/skills/`, com a licença MIT junto), com as nossas regras (sem travessão, tom simpático e direto, sem bajulação); (c) não usar.

### 5.2 Open Notebook (não é skill)
- É um **aplicativo completo** (parecido com o NotebookLM do Google): Python, Next.js, banco SurrealDB, roda com **Docker Compose**. Licença MIT.
- **Não funciona como a IA do Dmanda:** exige servidor sempre ligado e Docker (o Dmanda roda na Vercel, e o Docker Desktop pede administrador); vem **sem senha** e aberto na rede; foi feito para **pesquisar documentos**, não para **executar ações no nosso banco com Desfazer**.
- **Usos possíveis, nenhum urgente:** referência de desenho para trocar de provedor de IA; ou ferramenta separada, só em casa, para pesquisar PDFs na etapa Documentos.

### 5.3 Graphify e mapas de código
Ainda não compensa (cerca de 5 mil linhas de código). Reavaliar depois da versão mínima de Demandas, junto com o Trail-code, e ficar com um só.

### 5.4 Figma (plano gratuito)
Plano Starter: **20 chamadas de leitura por mês**, escrever não conta. As 20 já foram usadas. A documentação não diz quando renova (o Claude tenta de novo em novembro e relata).

### 5.5 Skills de design e ferramentas relacionadas
Critério: serve a um sistema com estilo Apple, **iPhone e iPad como PWA com jeito de app nativo**, rápido em internet fraca, sem custo e sem administrador?

| Posição | Ferramenta | Veredito do Claude |
|---|---|---|
| 1 | **Impeccable** (design, Apache 2.0) | **Melhor encaixe.** 24 comandos de revisão e correção (`critique`, `audit`, `polish`, `adapt`, `typeset`, `layout`...), detector de 62 regras que roda sem IA, hook ao editar interface. Pode **substituir a Taste skill** e reduzir o uso da `ui-ux-pro-max`. Sem orientação própria de iOS. Cuidados: motor binário e hook, telemetria anônima desligável, `bolder` e `overdrive` continuam fora. |
| 2 | **Transitions.dev** (movimento) | Bom complemento: transições em CSS puro com proteção de "reduzir movimento". Só os gratuitos (Pro é pago). Não traz folha, aba nem gesto no padrão iOS. |
| 3 | **Playwright CLI** (testes) | Pode substituir o plugin Playwright MCP, com menos contexto. Os nossos scripts de teste continuam. |
| 4 | **Claude Design** (Anthropic) | **Não substitui o Figma** para o design Apple: o Figma tem o kit oficial dos componentes. O Claude Design faria o papel do nosso protótipo em HTML (explorar telas, como o iPad com Pencil). Conta nos limites do plano Pro. Opcional, por sua conta. |
| código | **Ponytail** | Skill de código (menos código, mais reaproveitamento), não de design. Testar a partir do Bloco C. Benchmarks do próprio autor. |
| adiar | **GSAP skills** | O movimento de mola já é feito com CSS. Reavaliar se surgir animação complexa. |
| não | **React Bits** e **Designlang** | Efeitos decorativos pesados e licença incerta (React Bits); extração e clone de sites de terceiros (Designlang). |

**Nada foi instalado, removido ou trocado.** A escolha é sua (decisão 2).

---

## 6. Plano do Figma: só o que faltou

**Por quê:** as chamadas de leitura acabaram. Exportar como imagem no próprio Figma **não gasta nenhuma chamada**, e o Claude lê as imagens direto da pasta do projeto. Faça tudo de uma vez, uma única sessão de 10 a 15 minutos.

**Já lido (não precisa de nada):** Colors, Buttons, Sidebars, Lists, Segmented Controls, Materials, Menus, Sheets, Toolbars, Tab Bars, Toggles, Typography, Widgets e Text Fields.

### Lista A: o que falta e já importa ao Dmanda (8 páginas)

| Página | Para que serve no Dmanda |
|---|---|
| Steppers | Os botões de mais e menos do Pomodoro e campos numéricos |
| Progress Indicators | Barra de progresso das tarefas, estado "carregando", anel do Pomodoro |
| Popovers | Widgets que se ampliam no Início, balões |
| Alerts | Confirmação de exclusão (segunda confirmação), erros |
| Empty States | Telas vazias (Documentos sem Drive, sem tarefas, sem demandas) |
| Contextual Menus | Menu "Mais ações" do card, menu ao manter o dedo pressionado no iPhone |
| Date and Time Pickers | Campos de prazo, data e hora do evento |
| Examples | Telas completas de exemplo do kit (página pesada: exportar em partes) |

### Lista B: opcional, só por causa da nova direção iPhone e iPad (5 páginas)
Nunca foram lidas e passam a importar para o app com jeito nativo. **Inclua só se você aprovar (decisão 6).**

| Página | Para que serve |
|---|---|
| Layout Guides | Margens, áreas seguras e grade do iPhone e do iPad |
| Status Bars and Menu Bars | Topo do iPhone (ilha dinâmica) e do iPad |
| Windows | Janelas do iPad (tela dividida) |
| Keyboards | Como o teclado empurra o conteúdo |
| Product Bezels | Molduras de iPhone e iPad para o protótipo |

### Passo a passo (fazer no navegador, no site do Figma)

1. Abra o arquivo do kit: https://www.figma.com/design/VOqem67sPifvvgYa0MwyKh/iOS-and-iPadOS-27--Community-
2. Na lista de páginas, à esquerda, clique no **nome da página** (por exemplo "Steppers").
3. Aperte **Ctrl+A** para selecionar tudo o que está na página. Se vier quadro demais, clique só no quadro grande principal.
4. No painel da direita, role até **Export**, clique no **+**, escolha **PNG** e a escala **1x**, e clique em **Export**.
5. Salve na pasta `Desktop\Dmanda\imagens\figma-kit\` (crie a pasta) com o nome da página, em minúsculas e com hífen: `steppers.png`, `progress-indicators.png`, `popovers.png`, `alerts.png`, `empty-states.png`, `contextual-menus.png`, `date-and-time-pickers.png`, `examples.png`. Se o Figma baixar um ZIP, extraia na mesma pasta.
6. Repita para cada página. Em **Examples**, se der erro por tamanho, exporte só os quadros do iPhone e do iPad, um por vez.
7. Quando terminar, **avise o Claude no chat**: ele lê as imagens, registra o que serve em `DECISOES.md` e aplica no protótipo.

**Ordem sugerida:** Alerts, Empty States e Progress Indicators primeiro (são as que mais mexem em telas); depois as outras.
**Se as imagens forem para o Git** (decisão 6), o Claude faz o commit e elas ficam disponíveis nos dois computadores.

---

## 7. Blocos de trabalho maiores (sugestão, aguarda sua aprovação)

**Regra para daqui em diante:** blocos **maiores**, com início, fim e entrega testada, em vez de passos pequenos. **No fim de cada bloco** o Claude informa: o percentual do projeto, o que ficou pendente de você e **qual modelo e qual effort sugere para o próximo bloco**. O modelo e o effort são sempre uma sugestão: quem troca é você (`/model` e `/effort`).

Hoje o padrão salvo é **Sonnet 5.5 com effort high**.

| Bloco | O que entrega | Modelo sugerido | Effort sugerido | Andamento ao fim (estimativa) |
|---|---|---|---|---|
| **A. Abertura** (curto) | Sincronizar, suas decisões da seção 3, criar issues (se aprovado), ler skills | Sonnet 5.5 | medium | 18% |
| **Ação sua: Figma** | Exportar as páginas da seção 6 (10 a 15 minutos, fora do Claude Code) | nenhum | nenhum | 18% |
| **B. Fechar o design system, agora com iPhone e iPad nativos** | Ler os PNGs do Figma, ajustes da sua avaliação, padrões de cada tema, **molduras de iPhone e iPad no protótipo** e estrutura de app nativo (título grande, folhas com alça, deslizar nas linhas, áreas seguras), página de peças com os 5 estados, conferência de contraste, instalar a Impeccable (se aprovada) para revisar, teste completo | Sonnet 5.5 | high | cerca de 20% |
| **C. Base técnica** | Projeto novo sobre os temas, **PWA configurado para iPhone e iPad**, banco Postgres no Supabase (escolha do projeto, depois de confirmar limites), login Google com expiração após 6 horas sem uso, publicação na Vercel, backup em mais de um lugar, `.env.example`, arquitetura pronta para virar nativo | **Opus 5.5** | **high** (xhigh para segurança e backup) | cerca de 32% |
| **D. Demandas e Início, versão mínima** | Cadastro, cards, quatro visões, tarefas editáveis, prazos, arquivo; Início com filtros e Foco do dia; testes de cliques no sistema real; testar o Ponytail | Opus 5.5 no desenho dos dados, depois Sonnet 5.5 | high | cerca de 45% a 50% |
| **E. Entradas e Agenda** | Notas, virar demanda, Agenda local com "+" por dia, eventos; **base do desenho à mão com Apple Pencil**, testada num iPad de verdade | Sonnet 5.5 | high | cerca de 60% |
| **F. Configurações, busca e "+"** | Paletas, fontes, tamanhos, widgets, busca global, exportar e importar | Sonnet 5.5 | medium a high | cerca de 70% |
| **G. Humor, produtividade, clima, Perfil** | Balões, gráficos, Open-Meteo | Sonnet 5.5 | medium | cerca de 78% |
| **H. IA que registra entrada e evento** | Texto livre vira entrada ou evento com Registrar, Ajustar e Desfazer, provedor trocável, filtro de dados | **Opus 5.5** | high | cerca de 90% |
| **I. Google Calendar e Drive, Documentos** | Sincronização só do Dmanda para o Google, Documentos | Sonnet 5.5 | high | 100% |

Cada bloco termina com `node testes/clicar-tudo.mjs` (ou o equivalente do sistema real) sem pendências. As porcentagens são estimativas do Claude e valem só como guia. A ordem segue `DECISOES.md`, seção 1, que continua sendo a fonte oficial.

---

## 8. Regras de condução (valem para toda sessão)

- **Nenhuma decisão é tomada pelo Claude sem o seu conhecimento e autorização prévios.** Dúvidas viram pergunta no chat, em rodada curta, e a resposta é gravada em `DECISOES.md`.
- **Nunca `git push` sem a sua autorização.** Em 23/10/2026 você autorizou os dois envios desta sessão. Para as próximas, o Claude pergunta de novo.
- Antes de **excluir** qualquer coisa, o Claude olha o alvo e confere que nada se perde (como foi feito com a pasta duplicada).
- Tudo em português do Brasil, sem travessão, commits em português a cada avanço.
- Testar no navegador de verdade antes de dizer que está pronto.
- Avisar em **negrito** quando você tiver que fazer algo fora do Claude Code.
- Terminar toda resposta com "Andamento do projeto: X%".
- Não pagar nada além de Claude Pro e ChatGPT Plus. Instalar skills, plugins e MCPs só na hora de usar e depois de ler o que escrevem.

---

## 9. Prompt para colar no Claude Code (computador do trabalho)

Abrir o Claude Code dentro da pasta do Dmanda e colar:

```
Estou continuando o projeto Dmanda em outro computador (trabalho, sem administrador). Antes de qualquer coisa:
1. Rode git pull e npm install. Confirme que o último commit é "Sincronização de 23/10/2026..." e que inclui o SINCRONIZA-PROJETINHO.md.
2. Leia CLAUDE.md, DECISOES.md (rodada 3, "Questões para o futuro" e "Direção iPhone e iPad"), PENDENCIAS.md, ANDAMENTO.md, SINCRONIZA-PROJETINHO.md e a seção 11 do ANALISE-FERRAMENTAS.md.
3. Confira a memória local (usuário único admin, regras de custo e máquina, nunca fazer push sem minha autorização, terminar toda resposta com "Andamento do projeto: X%") e recrie ou atualize o que faltar.
4. Dentro de prototipo, rode node testes/fluxos.mjs para confirmar que o ambiente funciona, suba o protótipo (python -m http.server 7200) e me avise. Se existir uma pasta Dmanda\Dmanda duplicada, não apague: me avise e repita a revisão que foi feita em casa.

Onde paramos: a rodada 3 do protótipo (widgets com Pomodoro, IA que registra entrada ou evento, tarefas editáveis, etapa Vistos, "+" por dia na Agenda, escala única de botões, Catalyst revisado) está pronta, testada e enviada ao GitHub. A pasta duplicada foi resolvida em casa. Foram avaliadas, sem instalar, as skills no-ai-slop, Impeccable, Transitions.dev, Playwright CLI, Ponytail, React Bits, GSAP, Designlang e o Claude Design, e o Open Notebook. Defini a direção iPhone e iPad (PWA construído como app nativo, Apple Pencil no futuro). Andamento: 18%. Aguardo decidir os itens da seção 3 do SINCRONIZA-PROJETINHO.

Pauta de hoje: (a) me apresente, um item por vez, as decisões pendentes da seção 3, começando pelas ferramentas (skills e Open Notebook) e pela direção iPhone e iPad. Não instale nada antes da minha decisão. (b) Me lembre da ação do Figma (seção 6) se eu ainda não exportei os PNGs. (c) Depois, siga o plano de blocos da seção 7, só o que eu aprovar.

Regras: nenhuma decisão sem meu conhecimento e autorização prévios; tudo em português do Brasil, sem travessão; commits em português a cada avanço; blocos de trabalho maiores; no fim de cada bloco me diga o percentual do projeto e sugira o modelo (Opus ou Sonnet) e o effort do próximo bloco; testar no navegador de verdade (testes/clicar-tudo.mjs) antes de dizer que está pronto; avisar em negrito quando eu tiver que fazer algo fora do Claude Code; antes de excluir qualquer coisa, olhar o alvo; nunca fazer git push sem autorização.
```

---

## 10. Antes de fechar o Claude Code (checklist)

- [ ] `git status` limpo.
- [ ] `git log origin/main -1` igual ao `git log -1` (nada ficou só no computador).
- [ ] Este arquivo, o `PENDENCIAS.md` e o `DECISOES.md` estão no último commit.
