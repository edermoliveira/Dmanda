# CONTINUIDADE DO DMANDA

Documento consolidado para uma sessão nova, em qualquer computador, entender o projeto e continuar do ponto certo. Escrito em 28/10/2026 a partir dos arquivos do repositório e das evidências coletadas nesse dia. Os demais documentos têm o detalhe de cada assunto; este aponta para eles e não os substitui. Se algo divergir, vale `DECISOES.md` (decisões) e o que o próprio repositório mostrar (código).

Este arquivo não registra o hash do commit que o contém, de propósito. Para saber o commit atual: `git ls-remote origin refs/heads/main`. Para saber o commit que a Vercel serve: ver a seção E.

---

## A. Estado atual

**Finalidade.** Painel pessoal do Secretário de Administração da Prefeitura de Taquara/RS, para não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. **Usuário único**, que é o próprio Secretário e o administrador do sistema. Não existe equipe, convite nem comentário. Sem dados sigilosos, mas com autenticação, autorização e proteção mantidas.

**Endereço publicado:** https://dmanda-adm.vercel.app (Vercel Hobby, equipe EDER, projeto `dmanda`, ambiente Production, branch `main`).

**Repositório:** https://github.com/edermoliveira/Dmanda (privado). **Única branch: `main`**, que é a de trabalho e a de publicação.

**Versão verificada e servida em 28/10/2026:** commit `58fc8ec938a4b0874f7d7c1c4ea452295090ab85`. O GitHub registra o status "Vercel, success, Deployment has completed" para esse commit. Commits posteriores a ele só alteram documentação (inclusive este arquivo) e geram uma nova implantação cada um.

**Utilizável hoje (aplicação em `src/`):**
- Entrar por e-mail e senha, sair, sessão que expira após 6 horas sem uso.
- Demandas: cadastro rápido, edição, etapas (mover, concluir, reabrir, arquivar, excluir), tarefas dentro da demanda, filtros e ordenação, quatro visões (Cards, Tabela, Lista, Quadro com arrastar).
- Início com indicadores, grupos por prazo e Foco do dia (a partir das datas originais, em America/Sao_Paulo).
- Dados guardados no Supabase; atualização ao voltar à tela; proteção contra edição simultânea (aviso `DM409`, nada é gravado pela metade); rascunho automático dos textos digitados.
- Cópia dos dados em JSON (menu do avatar, "Baixar cópia dos dados") e restauração por SQL (`supabase/restaurar-copia.sql`).
- PWA somente online: manifesto, ícones, metadados para iPhone e iPad. Sem service worker, sem cache de dados, sem edição offline.
- Rotina diária na nuvem (código pronto): `GET /api/cron/diaria`, às 09:00 UTC, protegida por `CRON_SECRET`.

**Em construção (aparecem como "Em construção" ou só existem no protótipo):** Entradas (post-its), Agenda (com Google Calendar), Documentos (com Drive), IA, Configurações (paletas, fontes, tamanhos), Perfil (humor, energia, produtividade), busca global e itens do botão "+". Nenhum desses módulos foi iniciado na aplicação funcional.

**Integração real:**
- **Supabase** (projeto `gmxoosvgfcydccyeudej`, São Paulo, plano Free): 7 migrações aplicadas e correspondentes às versionadas; login por e-mail e senha; Google desativado; cadastro público desligado; 1 usuário.
- **Vercel Hobby:** publicada na região `gru1`, `main` como origem de produção. Valores das variáveis ficam só na plataforma.

---

## B. Etapas realizadas

1. **20 a 22/10/2026, planejamento e protótipo.** Projeto Next.js, documentos, pesquisa de dores e de ferramentas, questionário respondido. Protótipo em HTML, CSS e JS puros (`prototipo/`, dados fictícios) com três direções de estilo (Aurora, Papel, Grafite), depois o **Catalyst** (estilo Mac e iPad, a partir do kit oficial do Figma, claro e escuro).
2. **22 a 25/10, definição visual.** Catalyst virou a **única** direção; as outras foram retiradas. Revisões visuais, vidro líquido, fontes em três papéis, ícones Ionicons escolhidos pelo usuário. **Aprovação visual do protótipo no commit `cd7b03f`** (24/10/2026), com referência visual gravada (78 cenários).
3. **25/10, aplicação funcional.** Next.js 16 e React 19 em `src/`, reaproveitando os CSS do protótipo. Banco local descartável (PGlite) para testes. Operações de demandas e tarefas como funções SQL com RLS. Rotina diária (migração e rota).
4. **25/10, Supabase real.** Projeto criado e vinculado; migrações 1 a 5 aplicadas; acesso exclusivo à conta autorizada em três camadas (hook de cadastro, servidor, RLS); login Google e gravação reais validados. **GitHub Issues** adotadas como controle operacional (#1 a #4).
5. **26/10, autenticação por senha, PWA e cópia.** Entrada por e-mail e senha no mesmo usuário (migração 6), Sair, expiração de 6 horas, falhas de conexão tratadas, rascunho automático, cópia dos dados em JSON, primeira PWA online, proteção contra edição simultânea (migração 7). Prova no Supabase real com 19 verificações.
6. **27/10, base Supabase fechada.** Google desativado no painel (pelo usuário), botão do Google oculto por padrão. Decisão de **Vercel Hobby e Supabase Free** (a recomendação de Pro do mesmo dia foi superada).
7. **27/10, auditoria completa** (`AUDITORIA.md`, seção 18): 0 bloqueadores, 8 correções aplicadas (detalhadas em G) e 9 melhorias posteriores. Ponytail e Taste usados como roteiros de leitura (ver C).
8. **27/10, consolidação.** O checkpoint foi integrado à `main` por fast-forward e removido; a `main` passou a ser a referência única (decisão 24).
9. **27/10, publicação pela main.** `vercel.json` passou a implantar só a `main`; a branch `producao` foi removida (decisão 25). O usuário importou o projeto na Vercel.
10. **28/10, conferência da publicação** e criação deste documento.

Decisões antigas que **não valem mais** e podem aparecer em documentos históricos: login exclusivo pelo Google; recomendação de plano Pro da Vercel (decisão 17); branch `checkpoint/2026-10-23-ajustes-a-d` como branch de trabalho; branch `producao` como portão de publicação (decisão 16); o direcionamento "primeira implantação descartável vinda da `main`". As seções históricas de `SINCRONIZA-PROJETINHO.md` e `AUDITORIA.md` (1 a 17) preservam esses registros.

---

## C. Decisões que continuam válidas

- **Planos gratuitos:** Vercel Hobby e Supabase Free. Nada pago, nem teste pago, e o Pro não é decisão presumida. Limites com fonte em `supabase/LEIA-ME.md`, "Planos gratuitos". Dois pontos reais: a regra de uso não comercial do Hobby não esclarece o caso (efeito possível: pausa da conta; pergunta opcional ao suporte, que não bloqueia) e o Supabase Free pode pausar após uma semana de pouca atividade e **não oferece backup para baixar**.
- **Acesso:** e-mail e senha ao usuário existente (o mesmo identificador de sempre), definida pelo script `npm run definir:senha` e nunca registrada em arquivo. **Google desligado** no painel do Supabase (o botão só aparece com `DMANDA_LOGIN_GOOGLE=sim`); **cadastro público desligado**; hook de cadastro continua só Google, de propósito, para ninguém criar usuário por senha. Restrição em três camadas: hook, servidor (sessão, provedor, e-mail, 6 horas) e RLS por `conta_autorizada()`.
- **Git e publicação:** `main` é a única branch de continuidade e de publicação. Cada envio à `main` implanta o painel real. Nada de force push nem de reescrever histórico. `producao` e checkpoint não existem mais.
- **Dados e credenciais:** valores reais só no `.env.local` (nunca no Git, nunca no chat) e nas variáveis da Vercel. Chave de serviço do Supabase só no servidor. Dados fictícios do protótipo nunca entram no banco real. Cópias `dmanda-copia-*.json` ficam fora do Git. O assistente não lê nem imprime `.env*`; conferência por `npm run conferir:env`.
- **Referência visual:** o protótipo Catalyst aprovado no commit `cd7b03f` é a referência. A aprovação vale para o **protótipo**. A **aplicação React ainda não recebeu aprovação visual do usuário** (Issue #2); conferências feitas por ferramenta não equivalem a essa aprovação.
- **PWA:** somente online na primeira versão. Service worker só com necessidade demonstrada.
- **Cópias e recuperação (estado real):** exportação disponível e restauração por SQL **demonstrada só em banco local**, com dados fictícios. Armazenamento externo e execução automática **não existem**; o destino privado é decisão pendente do usuário (Issue #4). Como o Supabase Free não tem backup para baixar, **a cópia em arquivo é o único backup**. Orientação enquanto isso: uma cópia por dia de uso, guardada fora do projeto.
- **Produto:** cadastro rápido com poucos campos; prazos derivados das datas originais; falha de gravação nunca mostra sucesso; nunca mensagem de cobrança ou culpa; cards sem barra de rolagem; texto digitado nunca se perde.

**Ferramentas: instaladas, habilitadas e efetivamente usadas** (plugins, MCPs e o binário do Impeccable são **por computador** e não vêm pelo Git; o que vem é `.claude/settings.json` e `.claude/skills/`):

| Ferramenta | Instalada | Habilitada no projeto | Uso real |
|---|---|---|---|
| Ponytail (`ponytail-audit`, `ponytail-review`) | Dois `SKILL.md` copiados sem alteração para `.claude/skills/` (revisão `09c434a`, licença MIT, origem em `ponytail-ORIGEM.txt`; sem hooks nem telemetria) | Sim, como skills do projeto | **Lidos e seguidos manualmente como roteiro na auditoria de 27/10. Não foram invocados pelo comando de skills.** |
| Taste (`taste-skill`) | Plugin 2.1.4 no computador | **Não** (desativado em `.claude/settings.json`) | **Lido manualmente** (`references/app-screens.md` e `critique.md`) como lista de pontos de olhar; não invocado; nada do Catalyst foi trocado |
| Impeccable | Skill em `.claude/skills/impeccable` e agentes em `.claude/agents/`, sem hooks, telemetria desligada, binário local ignorado pelo Git | Sim | Avalia e refina a direção aprovada, nunca gera novas direções. Não foi usado na auditoria de 27/10 |
| `systematic-debugging`, `test-driven-development`, `verification-before-completion` | Copiadas em `.claude/skills/` (licença em `LICENSE-superpowers.txt`) | Sim | Método de trabalho |
| Playwright | Plugin de usuário; **os testes do projeto usam `playwright-core` com o Edge**, sem o plugin | Sim | Os scripts `testar:app` e `testar:sessao` rodam sem o plugin. Nesta sessão o servidor MCP do plugin falhou ao conectar (timeout) e não foi necessário |
| Context7 | Plugin de usuário | Sim | Documentação externa, quando necessário |
| code-review | Plugin de usuário | Sim | Revisão concentrada; usada na auditoria de 26/10 (`AUDITORIA.md` 3.5) |
| Figma MCP | Escopo local do projeto (`https://mcp.figma.com/mcp`) | Sim | Consultas pontuais; não usado nesta fase |
| `ui-ux-pro-max`, `code-simplifier` | Instalados no computador | **Não** (as duas chaves de `code-simplifier` ficam desativadas) | Não usados |
| Extensão do Chrome (claude-in-chrome) | Disponível nesta sessão | Por sessão | Em 28/10 só abriu a página de login (sem sessão) |

Não instalar, sem necessidade concreta: Superpowers completo, ferramentas de memória, o restante do Ponytail, Trail-code, Playwright CLI. `ANALISE-FERRAMENTAS.md` e `AUDITORIA.md` (seções 4, 16 e 18.1) têm o histórico.

---

## D. Organização técnica

**Pastas e arquivos principais**

| Caminho | O que é |
|---|---|
| `src/nucleo/` | Operações validadas de demandas e a lógica da rotina diária (reutilizáveis pela futura IA) |
| `src/servidor/` | Transporte (Supabase real ou banco de teste) e ações do servidor |
| `src/lib/` | Regras puras (datas, grupos do Início, sessão, conta autorizada) e clientes Supabase |
| `src/ui/` | Interface (contexto, janelas, páginas, cápsula de seleção) |
| `src/estilos/` | CSS do Catalyst reaproveitado do protótipo |
| `src/proxy.ts` | Porta de entrada: sessão, e-mail autorizado, expiração de 6 horas |
| `src/app/api/cron/diaria` | Rotina diária (autenticação própria por `CRON_SECRET`, isenta do proxy) |
| `src/app/(antigo)` e `src/components` | Design antigo sem uso (referência; exclusão aguarda autorização, melhoria P1) |
| `supabase/migrations/` | 7 migrações em ordem; `supabase/restaurar-copia.sql`; `supabase/LEIA-ME.md` |
| `scripts/` | Testes, `conferir-env`, `definir-senha`, captura de telas, `dev-teste` |
| `prototipo/` | Protótipo Catalyst aprovado (referência), com testes próprios (`prototipo/CLAUDE.md`) |
| `public/` e `imagens/` | Ícones da PWA e imagens |
| `vercel.json` | Região `gru1`, implantação só da `main`, cron diário |
| `.claude/` | `settings.json` do projeto e skills copiadas |

**Requisitos e versões:** Node 24.22.1 e npm 12.2.1 (os de 28/10/2026 neste computador; não há campo `engines`), Next.js 16.4.2, React 19.3.0, Python 3.11 (só para `testar:senha-terminal`, Windows), Microsoft Edge (para `testar:app` e `testar:sessao`). A CLI do Supabase roda por `npx supabase`. A Vercel só é usada pelo site. Antes de escrever código Next.js, ler o guia em `node_modules/next/dist/docs/` (esta versão tem mudanças de API; ver `AGENTS.md`).

**Comandos**

| Comando | Para que serve |
|---|---|
| `npm run dev` | Aplicação em http://localhost:7100, **Supabase real** (exige `.env.local`) |
| `npm run dev:teste` | Mesma porta, **banco local descartável** (`.dados-teste/`), sem credenciais |
| `npm run build` e `npm run start` | Produção local na 7100 |
| `npx tsc --noEmit` e `npx eslint src scripts` | Tipos e lint |
| `npm run testar:regras` | Regras puras (26) |
| `npm run testar:banco` | SQL, RLS, rotina, acesso, hook no PGlite (118) |
| `npm run testar:app` | Navegador e banco de teste (74); sobe o próprio servidor na 7103 |
| `npm run testar:sessao` | Sessão e entrada por senha com Auth **falso** (57) |
| `npm run testar:senha-terminal` | `definir:senha` em console Windows (10 cenários) |
| `npm run conferir:env` | Confere o `.env.local` sem mostrar valores e lê configurações do Supabase em modo leitura |
| `npm run definir:senha` | Define a senha do usuário existente (digitada no terminal, nunca gravada) |

Só pode haver um `next dev` por vez (a pasta `.next` tem trava). Portas: 7100 aplicação, 7103 `testar:app`, 7200 protótipo.

**Variáveis (só os nomes; valores nunca no Git):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DMANDA_EMAIL_AUTORIZADO`, `SUPABASE_SERVICE_ROLE_KEY` (só servidor, sensível), `CRON_SECRET` (16 ou mais caracteres). Opcional: `DMANDA_LOGIN_GOOGLE` (vazia por padrão). Só em desenvolvimento: `DMANDA_BANCO=teste` (recusada em produção). Modelo em `.env.example`. Na Vercel, as cinco primeiras ficam **só em Production**.

**Migrações** (todas aplicadas no projeto real; histórico remoto igual ao versionado em 28/10/2026):
`20261025000000_nucleo_demandas`, `20261025000100_salvar_demanda`, `20261025000200_rotina_diaria`, `20261025000300_acesso_exclusivo`, `20261025000400_revogar_funcao_da_plataforma`, `20261026000000_login_email_senha`, `20261026000100_protecao_edicao_simultanea`. Nunca reescrever uma migração aplicada nem usar `db reset` no projeto real; novas migrações só com dry-run (`npx supabase db push --linked --dry-run`).

**Onde estão as decisões, auditorias e tarefas**
- Decisões: `DECISOES.md` (a mais recente é a fonte). Auditorias e mapa de persistência: `AUDITORIA.md` (seção 18 é a auditoria completa de 27/10; 17 fecha a base Supabase).
- Tarefas, estado e bloqueios: **GitHub Issues** do repositório (#1 fechada; #2, #3, #4 abertas). `PENDENCIAS.md` é o índice com links.
- Produto e escopo: `PRODUTO.md`, `FUNCIONALIDADES.md`. Percentual e critérios: `ANDAMENTO.md` (oficial **18%**).
- Supabase, Vercel, rotina e planos: `supabase/LEIA-ME.md`. Retomada histórica: `SINCRONIZA-PROJETINHO.md`. `RESUMOCASA-26-10.md` é um resumo antigo de 26/10, mantido como histórico.

---

## E. Validação e pendências

**Distinção usada neste documento:** *verificado localmente* (testes e build no computador), *observado em produção* (no endereço publicado) e *aprovação visual do usuário* (só ele concede).

**Observado em produção em 28/10/2026 (sem sessão, por HTTP):**
- `/login` responde 200 e mostra o formulário com estilo (captura conferida no Chrome).
- `/`, `/demandas`, `/marca`, `/pecas`, `/tokens`, `/config`, `/arquivo`, `/api/exportar` e `/api/sessao` respondem 307 para `/login`.
- `/manifest.webmanifest` (nome, escopo, `start_url`, três ícones), `/icon.svg`, `/apple-icon.png`, `/favicon.ico`, `/icones/icone-192.png`, `/icones/icone-512.png` e `/icones/icone-maskable-512.png` respondem 200.
- A folha de estilos publicada contém os tokens (`--bg1`, `--text`, `--bgbase` e outros) e as duas cores de tema (`#F2F2F7` claro, `#0A0A0A` escuro) estão nas metatags: isso mostra que `catalyst.css` esteve disponível na construção da publicação (correção I6 da auditoria).
- `/api/cron/diaria` responde 401 sem segredo e com segredo errado. Cabeçalhos de segurança presentes (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Região:** o cabeçalho `X-Vercel-Id` de uma função mostra `gru1::gru1`.
- **Commit servido:** status `success` da Vercel no GitHub para `58fc8ec`.
- Supabase (leitura pela CLI): histórico de migrações 7 de 7 igual ao versionado, `db push --dry-run` com "Remote database is up to date", 1 usuário, 1 e-mail na lista de acesso, único alerta do Security Advisor é o conhecido (proteção contra senhas vazadas, que exige plano pago).
- Indício de uso real em produção: o banco tem uma sessão criada em 28/10 às 03:09 UTC e uma demanda ("Portarias Comissões", etapa Cadastro, versão 1) criada às 03:11 UTC, ambas do próprio usuário, logo depois da publicação. É compatível com entrada e cadastro pelo endereço publicado, mas **o banco não prova de onde veio o clique**. Essa demanda é dado real do usuário e **não foi alterada nem removida**.
- Atualização de 28/10 (consulta somente leitura ao fim do dia): "Portarias Comissões" está agora na etapa Vistos com versão 14, e existe uma segunda demanda real, "Sindicância Teresinha" (etapa Vistos, versão 5, criada às 17:32 UTC). As versões altas mostram que as edições do usuário foram gravadas e persistiram no Supabase real por uso do painel; continua não provado de qual aparelho ou endereço vieram. Nenhum dado foi alterado pelo assistente.

**Não foi possível observar em produção:**
- **Validação autenticada pelo assistente:** o Chrome da extensão não tinha sessão, e a senha não foi (nem será) pedida. Cadastro de demandas e tarefas TESTE, recarga e persistência pelo assistente em produção estão **pendentes**.
- **Registro do cron na Vercel e logs de execução:** dependem do painel da Vercel, que o assistente não acessa (a CLI da Vercel não está instalada nem autenticada). O código e o `vercel.json` estão corretos e validados no esquema oficial, mas **"cron registrado" não foi comprovado**.
- **Chamada manual da rotina:** exige o `CRON_SECRET`, que o assistente não lê. Pendente (ver F, primeira ação).
- **Logs da Vercel:** não consultados (sem acesso). Nenhum erro foi visto nas respostas HTTP observadas.

**Verificado localmente (resultados anteriores ainda aplicáveis; o código da aplicação não mudou desde `8fb7c01`):**
`tsc` e `eslint` sem erros; `testar:regras` 26 de 26; `testar:banco` 118 de 118; `testar:app` 74 de 74; `testar:sessao` 57 de 57; `build` e produção local; `npm audit` de produção com 0 vulnerabilidades; medições de interface em 5 tamanhos e 2 modos (`AUDITORIA.md` 18.5). Em 27/10, depois da consolidação, repetidos `tsc`, `eslint`, `testar:regras` e `build`. `testar:senha-terminal` e a rotina por HTTP real local não foram repetidos depois de 26 e 25/10 (código inalterado). A `vercel.json` foi validada no esquema oficial da Vercel e os padrões de branch no minimatch 3.1.5 (só `main` implanta; a versão usada pela Vercel não é pública).

**Estado do cron:** código pronto e testado localmente; `vercel.json` com o agendamento `0 9 * * *` e rota correta; **Atualização de 28/10/2026 (consulta ao banco real, ao fim do dia): há uma execução registrada em `execucoes_rotina`, `data_ref` 2026-10-28, `ok = true`, sem erro, 1 usuário, iniciada às 09:34:10 UTC (06:34 em Brasília), dentro da janela do Hobby (06:00 a 06:59).** É compatível com a primeira execução automática do cron, mas o banco não distingue disparo automático de botão Run, então a origem exata e o registro do cron em Settings > Cron Jobs continuam a conferir no painel da Vercel. Antes dessa, só existem os testes locais de 25 e 26/10. Pendente: observar a segunda execução (29/10) sem intervenção. No Hobby a chamada ocorre em qualquer minuto da hora marcada (09:00 a 09:59 UTC, ou 06:00 a 06:59 em Brasília). A prova da rotina é a linha "Rotina diária na nuvem: última execução em..." no Início (vem da tabela `execucoes_rotina`; os dois registros que existem hoje são testes locais de 25/10).

**Nunca validado de ponta a ponta:** expiração real de 6 horas; restauração da cópia em projeto real; download da cópia dentro do app instalado; instalação da PWA no iPhone e no iPad; **aprovação visual da aplicação React**; desempenho e latência em produção.

**Pendências realmente necessárias para o primeiro uso**
1. Confirmar a persistência real (recarregar e a demanda continuar) e a saída e nova entrada no endereço publicado: do usuário, em segundos.
2. Confirmar na Vercel que o cron está registrado e disparar o Run manual; o assistente confere o resultado no banco.
3. Instalar a PWA no iPhone e no iPad e baixar uma cópia dos dados dentro do app instalado.
4. Avaliação visual da aplicação (Issue #2).

**Melhorias posteriores (não bloqueiam o uso; detalhe em `AUDITORIA.md` 18.3):** P1 excluir o design antigo sem uso (aguarda autorização); P2 `verificar:cores` aponta para arquivo inexistente; P3 Tabela em janela média; P4 controles de áreas ainda não construídas; P5 regra do Início para "Aguardando retorno" sem data de acompanhamento; P6 um acesso a menos ao Auth por operação; P7 sem Content-Security-Policy; P8 atualizações de patch (Next 16.4.3, React 19.3.1, PGlite 0.5.12); P9 alvos de toque do lápis das tarefas e do filtro no iPhone.

**Decisões do usuário ainda necessárias (nenhuma bloqueia):** P4 (manter ou ocultar controles de áreas não construídas), P5 (regra do Início para "Aguardando retorno"), P1 (autorizar a exclusão do design antigo), destino privado das cópias (Issue #4), ordem dos próximos módulos.

**Limitações conhecidas:** Supabase Free pode pausar após uma semana de pouca atividade (abrir o app antes de ausências longas) e não tem backup para baixar; regra do Hobby sobre uso não comercial sem esclarecimento; operações pontuais (mover etapa, marcar tarefa, arquivar) seguem "último a gravar vence" por campo; cookie `dmanda-ultimo-uso` não é assinado (controle da aplicação, não fronteira de segurança); sem service worker; proteção contra senhas vazadas exige plano pago.

---

## F. Retomada em outro computador

**Atualizar uma cópia existente** (PowerShell, na pasta do projeto):
```
git fetch origin
git checkout main
git pull --ff-only origin main
git ls-remote origin refs/heads/main
npm ci
```
Se existirem branches antigas locais (`checkpoint/...` ou `producao`), elas foram removidas do remoto e podem ser ignoradas. Antes de excluir qualquer pasta ou arquivo local, olhar o conteúdo.

**Computador novo:**
```
git clone https://github.com/edermoliveira/Dmanda.git
cd Dmanda
npm ci
```
Depois: criar o `.env.local` copiando o modelo `.env.example` e preencher **sem colar valores no chat** (passos em `supabase/LEIA-ME.md`; o `CRON_SECRET` local pode ser qualquer texto de 16 ou mais caracteres; o que vale em produção é o da Vercel). Conferir: `npm run conferir:env` (mostra só ok, VAZIA ou ATENÇÃO).

**Autenticar as ferramentas naquela máquina (por computador, fora do Git):**
- GitHub: `gh auth login` (as Issues usam `gh`).
- Supabase: `npx supabase login` e `npx supabase link --project-ref gmxoosvgfcydccyeudej`.
- Claude Code: reinstalar os plugins que se quiser (Playwright, Context7, code-review) e o Figma MCP (`claude mcp add --transport http figma https://mcp.figma.com/mcp`, depois autenticar em `/mcp`). A memória do Claude é local e não acompanha o repositório: este documento e o topo de `SINCRONIZA-PROJETINHO.md` bastam.
- O binário do Impeccable (`.claude/skills/impeccable/scripts/bin`) é por computador.
- A Vercel é acessada só pelo site (vercel.com), com a conta do usuário.

**Iniciar:** `npm run dev` abre http://localhost:7100/login com o **Supabase real** (cuidado: grava dados reais). `npm run dev:teste` usa um banco local descartável, sem credenciais. Protótipo: dentro de `prototipo`, `python -m http.server 7200 --bind 127.0.0.1`.

**O que o `git pull` atualiza:** só o **código**. Os **dados** (demandas, tarefas, usuário, sessões) ficam no Supabase e são os mesmos em qualquer computador e no endereço publicado. O `.env.local` e o banco de teste (`.dados-teste/`) são por computador e não vão para o Git. **Atenção:** enviar um commit à `main` publica o painel real; enviar só o que foi verificado.

**Roteiro único do que depende do usuário (atualizado em 28/10 à noite)**
1. **Na Vercel (vercel.com, projeto `dmanda`, Settings > Cron Jobs):** confirmar que `/api/cron/diaria` (`0 9 * * *`) está registrada e, em Logs, se a execução de 06:34 de hoje veio do agendamento. Amanhã, 29/10, depois das 07:00, abrir o Início e ver a linha "Rotina diária na nuvem: última execução em..." com a data de 29/10.
2. **No endereço publicado:** sair e entrar de novo (valida a nova entrada) e baixar uma cópia dos dados (menu do avatar). Guardar o arquivo fora do projeto.
3. **No iPhone (Safari):** abrir o endereço, Compartilhar > Adicionar à Tela de Início, abrir pelo ícone, entrar e conferir que as demandas aparecem. **No iPad:** o mesmo. Em cada um, tentar "Baixar cópia dos dados" dentro do app instalado e dizer se baixou.
4. Avaliar visualmente a aplicação (Issue #2).

**Primeira ação concreta da próxima sessão (anterior, parte já cumprida pelo uso)**
1. **Usuário, no endereço publicado:** entrar com e-mail e senha, recarregar a página e conferir se a demanda "Portarias Comissões" continua; sair e entrar de novo. Isso valida persistência e sessão em produção.
2. **Usuário, na Vercel (projeto `dmanda`, Settings > Cron Jobs):** conferir que `/api/cron/diaria` com `0 9 * * *` aparece registrada e clicar em **Run**. Se a execução automática de 28/10 já tiver ocorrido, o Início mostra a última execução.
3. **Assistente:** `git pull`, conferir no banco (`npx supabase db query --linked "select ok, erro, iniciou_em from public.execucoes_rotina order by iniciou_em desc limit 3"`) e registrar o resultado nas Issues #3 e neste documento. Se o Chrome da extensão estiver com a sessão aberta, fazer a conferência curta com registros TESTE identificados e removê-los em seguida.

---

## G. Últimas alterações (27 e 28/10/2026)

**Correções da auditoria (commit `ba6b33a`, em `main`):** (1) data provisória de 2000 aparecia por cerca de 0,2 s nos cards em toda carga ("faltam 9789 d", "0 atrasadas"); corrigida (`src/ui/contexto.tsx`: `setHoje(hojeISO())` junto de `setDemandas`). (2) Foco do teclado preso na janela e devolvido a quem a abriu (`src/ui/janelas.tsx`). (3) Atalho "/" que foca o filtro, como no protótipo (`src/ui/paginas.tsx`). (4) Removido `suppressHydrationWarning` indevido (`src/ui/Casca.tsx`). (5) PGlite de teste fora do pacote das funções da Vercel, de 611 para 261 itens (`next.config.ts`). (6) `catalyst.css` incluído no pacote das funções (`next.config.ts`). (7) Avisos "Você saiu" e "login vale 6 horas" em tom neutro e não em vermelho. (8) Variável morta removida. Verificações novas em `testar:app` (74).

**Consolidação (27/10):** `checkpoint/2026-10-23-ajustes-a-d` (era `8fb7c01`, 56 commits à frente da `main` antiga `c314b53`) integrado por fast-forward e removido, local e remoto.

**Publicação pela main (27/10, `58fc8ec`):** `vercel.json` = `{"regions":["gru1"], "git":{"deploymentEnabled":{"**":false,"main":true}}, "crons":[{"path":"/api/cron/diaria","schedule":"0 9 * * *"}]}`. A `producao` (`a0eaa46`) era ancestral da `main`, sem trabalho exclusivo, e foi removida. Decisões 24 e 25 em `DECISOES.md`.

**28/10:** o painel da Vercel mostrou `dmanda-adm.vercel.app` em Production, branch `main`, commit `58fc8ec`, Ready. A conferência desta data está na seção E. Os documentos `CLAUDE.md`, `README.md`, `SINCRONIZA-PROJETINHO.md`, `supabase/LEIA-ME.md`, `PENDENCIAS.md`, `DECISOES.md`, `ANDAMENTO.md` e as Issues #2 e #3 foram ajustados para apontar para este arquivo.

**Para não repetir:** não abrir outra auditoria geral sem fato novo; não recriar o projeto da Vercel; não restaurar `producao`; não reaplicar migrações; não ler o `.env.local`; não declarar validado em produção o que só foi testado localmente.
