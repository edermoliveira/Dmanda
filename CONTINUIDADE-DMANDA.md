# CONTINUIDADE DO DMANDA

Documento consolidado para uma sessão nova, em qualquer computador, entender o projeto e continuar do ponto certo. Escrito em 28/10/2026 e atualizado em 29/10/2026 (bloco de sessão persistente, cadastro guiado e prazos, e depois integração e correções: seção G) e em 30/10/2026 (aprovação do bloco anterior e Entradas: seção H). Os demais documentos têm o detalhe de cada assunto; este aponta para eles e não os substitui. Se algo divergir, vale `DECISOES.md` (decisões) e o que o próprio repositório mostrar (código).

Este arquivo não registra o hash do commit que o contém, de propósito. Para saber o commit atual: `git ls-remote origin refs/heads/main`. Para saber o commit que a Vercel serve: ver a seção E.

---

## A. Estado atual

**Finalidade.** Painel pessoal do Secretário de Administração da Prefeitura de Taquara/RS, para não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. **Usuário único**, que é o próprio Secretário e o administrador do sistema. Não existe equipe, convite nem comentário. Sem dados sigilosos, mas com autenticação, autorização e proteção mantidas.

**Endereço publicado:** https://dmanda-adm.vercel.app (Vercel Hobby, equipe EDER, projeto `dmanda`, ambiente Production, branch `main`).

**Repositório:** https://github.com/edermoliveira/Dmanda (privado). **Única branch: `main`**, que é a de trabalho e a de publicação.

**Código deste bloco (29/10/2026):** o commit `6175a27a495352509d99308692ef5d45aefa4e0c` foi enviado à `main` (hash local igual ao remoto, conferido com `git ls-remote`) e a Vercel passou a servi-lo: observado no endereço publicado, sem sessão, que a resposta de `/demandas` já limpa o cookie antigo `dmanda-ultimo-uso` (comportamento só da versão nova), `/login`, manifesto e ícones 200, `/demandas`, `/config`, `/api/exportar`, `/api/sessao` e `/marca` redirecionam ao login, `/api/cron/diaria` 401 sem segredo, cabeçalhos de segurança presentes, região `gru1`. O status "success" da Vercel no GitHub desse commit **não foi consultado** (sem `gh` e sem acesso ao painel); a conclusão vem da resposta do endereço. **Depende de autenticação (seu login):** tudo o que está no roteiro da seção G.

**Código do bloco de integração e correções (29/10/2026, tarde):** o commit `5fd059b14401b020844868ce8f172e8d84ef07fe` foi enviado à `main` (hash remoto conferido com `git ls-remote`, igual ao local) e a Vercel o implantou: o GitHub registra o status `success` ("Deployment has completed") para esse commit, e o endereço publicado responde `/login` 200, serve o CSS com `--esc:.85`, `/demandas`, `/config`, `/api/exportar` e `/api/sessao` redirecionam ao login, `/api/cron/diaria` 401 sem segredo, região `gru1`. A migração 9 foi aplicada no Supabase real (dry-run antes; dados das 4 demandas idênticos depois; `db push --dry-run` final: "Remote database is up to date"). **Não observado em produção:** nada que dependa da sua sessão (cadastro, cards e escala vistos por você no iPhone e no computador, Issue #2). Commits posteriores a `5fd059b` só mudam documentação.

**Código do bloco Entradas (30/10/2026):** o commit `7bf06ef5eb89b85ef54f452cd25ee4bc5997026b` (último commit de código do bloco, seguido só de documentação) foi enviado à `main` (hash local igual ao remoto, conferido com `git ls-remote`); situação da implantação na Vercel: o GitHub registra o status `success` ("Deployment has completed") para o commit `d0a15bd` (o último da `main` nesse envio, só de documentação depois do commit de código); o endereço publicado responde `/login` 200, serve o CSS com `--nota-h:170` e `--esc:.85`, `/entradas`, `/demandas`, `/arquivo`, `/api/exportar` e `/api/sessao` redirecionam ao login, `/manifest.webmanifest` 200, `/api/cron/diaria` 401 sem segredo, região `gru1`. Antes do envio houve um checkpoint local identificado como incompleto (`53a7ed1`), que ficou no histórico e **não** foi publicado sozinho.

**Versão verificada e servida em 28/10/2026:** commit `58fc8ec938a4b0874f7d7c1c4ea452295090ab85`. O GitHub registra o status "Vercel, success, Deployment has completed" para esse commit. Commits posteriores a ele só alteram documentação (inclusive este arquivo) e geram uma nova implantação cada um.

**Utilizável hoje (aplicação em `src/`):**
- Entrar por e-mail e senha, sair (só neste navegador) e **sessão persistente**: o Supabase Auth a renova e o servidor regrava os cookies; não existe mais encerramento por inatividade (decisão 27).
- Demandas: **cadastro guiado em três passos** (só o assunto é obrigatório; a demanda é criada ao fim do passo 2, em Cadastro; concluir com tarefas leva a Vistos), **consulta organizada com lápis por seção**, etapas (mover, concluir, reabrir, arquivar, excluir), tarefas, filtros e ordenação, quatro visões (Cards, Tabela, Lista, Quadro com arrastar).
- **Prazos** (decisão 31): prazo original (data ou 5, 10, 20, 30 dias a partir de hoje) e vencimento ajustado (antecipa para o primeiro dia disponível se cair em fim de semana, feriado ou evento externo de dia inteiro), recalculado no banco quando o calendário muda. **Configurações > Dias indisponíveis** (decisão 32).
- **Entradas (30/10/2026):** post-its no Supabase, com busca, tags, fixar, arquivar e recuperar, **Virar demanda** (demanda e vínculo na mesma transação), atalho N, "Nova entrada" no "+", salvamento automático com rascunho no aparelho e edição simultânea tratada (decisões 37 a 39, seção H).
- Início com indicadores, grupos por prazo e Foco do dia (a partir do vencimento ajustado, em America/Sao_Paulo).
- Dados guardados no Supabase; atualização ao voltar à tela; proteção contra edição simultânea (aviso `DM409`, nada é gravado pela metade); rascunho automático dos textos digitados.
- Cópia dos dados em JSON **versão 3** (demandas, tarefas, dias indisponíveis e entradas; menu do avatar, "Baixar cópia dos dados"), e restauração por SQL (`supabase/restaurar-copia.sql`, aceita também as versões 1 e 2).
- PWA somente online: manifesto, ícones, metadados para iPhone e iPad. Sem service worker, sem cache de dados, sem edição offline.
- Rotina diária na nuvem (código pronto): `GET /api/cron/diaria`, às 09:00 UTC, protegida por `CRON_SECRET`.

**Em construção (aparecem como "Em construção" ou só existem no protótipo):** Agenda (com Google Calendar), Documentos (com Drive), IA, Configurações além dos dias indisponíveis (paletas, fontes, tamanhos), Perfil (humor, energia, produtividade), busca global e itens do botão "+". Nenhum desses módulos foi iniciado na aplicação funcional.

**Integração real:**
- **Supabase** (projeto `gmxoosvgfcydccyeudej`, São Paulo, plano Free): **10 migrações aplicadas** (a 10, `20261030000000_entradas`, em 30/10/2026, aditiva, com dry-run antes) e correspondentes às versionadas (a 8, `20261029000000_prazos_e_dias_indisponiveis`, aplicada em 29/10/2026 com dry-run antes, sem reset e sem reaplicar as anteriores); login por e-mail e senha; Google desativado; cadastro público desligado; 1 usuário.
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
12. **30/10, aprovação do bloco anterior e Entradas** (decisões 37 a 39): migração 10, Entradas completa, Virar demanda, cópia versão 3, duas falhas de teste investigadas e tratadas, reavaliação do andamento (29%). Detalhes na seção H.
11. **29/10, bloco de melhorias** (decisões 27 a 33): sessão persistente (fim da regra das 6 horas), cadastro guiado em três passos, consulta com lápis por seção, prazo original e ajustado, dias indisponíveis em Configurações, migração 8 e cópia versão 2. Detalhes na seção G.

Decisões antigas que **não valem mais** e podem aparecer em documentos históricos: **a sessão que expira após 6 horas sem uso (superada pela decisão 27)**; cadastro rápido com número e origem preenchidos por padrão e prazo único digitado (superado pelas decisões 28, 30 e 31); login exclusivo pelo Google; recomendação de plano Pro da Vercel (decisão 17); branch `checkpoint/2026-10-23-ajustes-a-d` como branch de trabalho; branch `producao` como portão de publicação (decisão 16); o direcionamento "primeira implantação descartável vinda da `main`". As seções históricas de `SINCRONIZA-PROJETINHO.md` e `AUDITORIA.md` (1 a 17) preservam esses registros.

---

## C. Decisões que continuam válidas

- **Planos gratuitos:** Vercel Hobby e Supabase Free. Nada pago, nem teste pago, e o Pro não é decisão presumida. Limites com fonte em `supabase/LEIA-ME.md`, "Planos gratuitos". Dois pontos reais: a regra de uso não comercial do Hobby não esclarece o caso (efeito possível: pausa da conta; pergunta opcional ao suporte, que não bloqueia) e o Supabase Free pode pausar após uma semana de pouca atividade e **não oferece backup para baixar**.
- **Acesso:** e-mail e senha ao usuário existente (o mesmo identificador de sempre), definida pelo script `npm run definir:senha` e nunca registrada em arquivo. **Google desligado** no painel do Supabase (o botão só aparece com `DMANDA_LOGIN_GOOGLE=sim`); **cadastro público desligado**; hook de cadastro continua só Google, de propósito, para ninguém criar usuário por senha. Restrição em três camadas: hook, servidor (sessão, provedor, e-mail; **sem limite de inatividade**, decisão 27) e RLS por `conta_autorizada()`.
- **Git e publicação:** `main` é a única branch de continuidade e de publicação. Cada envio à `main` implanta o painel real. Nada de force push nem de reescrever histórico. `producao` e checkpoint não existem mais.
- **Dados e credenciais:** valores reais só no `.env.local` (nunca no Git, nunca no chat) e nas variáveis da Vercel. Chave de serviço do Supabase só no servidor. Dados fictícios do protótipo nunca entram no banco real. Cópias `dmanda-copia-*.json` ficam fora do Git. O assistente não lê nem imprime `.env*`; conferência por `npm run conferir:env`.
- **Referência visual:** o protótipo Catalyst aprovado no commit `cd7b03f` é a referência. A aprovação vale para o **protótipo**. A **aplicação React ainda não recebeu aprovação visual do usuário** (Issue #2); conferências feitas por ferramenta não equivalem a essa aprovação.
- **PWA:** somente online na primeira versão. Service worker só com necessidade demonstrada.
- **Cópias e recuperação (estado real):** exportação disponível e restauração por SQL **demonstrada só em banco local**, com dados fictícios. Armazenamento externo e execução automática **não existem**; o destino privado é decisão pendente do usuário (Issue #4). Como o Supabase Free não tem backup para baixar, **a cópia em arquivo é o único backup**. Orientação enquanto isso: uma cópia por dia de uso, guardada fora do projeto.
- **Produto:** cadastro rápido com poucos campos; prazos derivados das datas originais; falha de gravação nunca mostra sucesso; nunca mensagem de cobrança ou culpa; cards sem barra de rolagem; texto digitado nunca se perde.

**Ferramentas: instaladas, habilitadas, carregadas e efetivamente usadas** (plugins, MCPs e o binário do Impeccable são **por computador** e não vêm pelo Git; o que vem é `.claude/settings.json` e `.claude/skills/`). Conferência única de 29/10/2026 para o bloco de sessão, cadastro e prazos:

| Ferramenta | Instalada (versão) | Habilitada | Carregada nesta sessão | Uso real |
|---|---|---|---|---|
| Impeccable | **4.8.0** (atualizado em 29/10 pelo `impeccable update --project --no-hooks`; antes 4.7.0; motor 0.1.18; sem hooks, telemetria desligada, `settings.json` intacto) | Sim, skill do projeto | A skill foi listada no início da sessão (4.7.0); a 4.8.0 vale a partir da próxima sessão | **Não invocado** neste bloco. A revisão da interface foi feita à mão sobre as capturas e as medições (hierarquia, transbordo, rodapé, alvos), o que achou e corrigiu três defeitos do celular |
| `systematic-debugging` | Atualizado em 29/10 (2 linhas de um exemplo que imprimiam o valor de um segredo, corrigidas como na origem `obra/superpowers`, revisão `2ce8aa1`); origem em `superpowers-ORIGEM.txt` | Sim | Sim | Método da investigação da perda de sessão e dos defeitos de login |
| `test-driven-development`, `verification-before-completion` | Idênticos à origem (só fim de linha) | Sim | Sim | Testes escritos antes das correções; verificação antes de concluir |
| Ponytail (`ponytail-audit`, `ponytail-review`) | Idênticos à origem `DietrichGebert/ponytail` (conferido em 29/10: só o README mudou depois da revisão `09c434a`) | Sim, skills do projeto | Sim | **`ponytail-review` invocado** sobre o bloco |
| code-review | Plugin atualizado em 29/10 para **1.0.1** (antes `58267944f921`); a skill embutida `code-review` é a usada | Sim | A skill embutida sim; o plugin novo só após reiniciar | **`/code-review medium` executado** sobre o bloco: 5 apontamentos, 1 procedente (erro do `refreshSession` na entrada, corrigido) |
| Context7 | Plugin atualizado em 29/10 para `f8c5e7a1dcb7` | Sim | O servidor MCP carregado é o anterior; o novo só após reiniciar | Consultado para o `@supabase/ssr` (cookies, cabeçalhos de cache, `getClaims` x `getUser`) |
| Playwright | Plugin atualizado em 29/10 para `f8c5e7a1dcb7`. **Os testes do projeto usam `playwright-core` com o Edge** (1.64.1), sem o plugin | Sim | Plugin: só após reiniciar | Todos os testes de navegador e as capturas do bloco usaram `playwright-core` + Edge |
| Taste (`taste-skill` 2.1.4) | Marketplace atualizado em 29/10; plugin **não** foi atualizado | **Não** (desativado) | Não | Não usado neste bloco |
| `ui-ux-pro-max`, `code-simplifier` | Instalados no computador | **Não** (as duas chaves do `code-simplifier` ficam desativadas) | Não | Não usados |
| Figma MCP | Escopo local do projeto | Sim | Disponível | Não usado |
| GitHub CLI (`gh`) | **Não instalado neste computador** | n/a | n/a | As Issues não puderam ser atualizadas daqui: texto pronto em `AUDITORIA.md` 19.4 |

**Atualização de 29/10/2026 (tarde), distinguindo os estados.** *Ponytail:* instalado e versionado no projeto (`.claude/skills/`, duas skills); **atualizado**: idêntico à origem (hash do conteúdo igual, origem sem mudança nos dois arquivos desde 08/10); **habilitado** (skill do projeto); **carregado** e **efetivamente usado**: `ponytail-review` invocado pelo comando de skills sobre o conjunto final do bloco (achados na seção G); regra permanente no `CLAUDE.md`. *Impeccable 4.8.0* (motor 0.1.18): instalado, habilitado, carregado; **usado**: `critique` em modo enxuto sobre cards e escala (detector `detect` limpo, sem achados mecânicos), com banner de execução reduzida (sem subagentes isolados, que só se criam a pedido). *Taste:* instalado, **desativado**, não usado (sem pertinência: o Catalyst está aprovado). *Playwright:* os testes usam `playwright-core` com o Edge (o plugin não foi usado); *Context7* e *code-review*: disponíveis, **não necessários** neste bloco. *`systematic-debugging`:* usado para reproduzir antes de corrigir (achados 1 a 3 e causa dos cards); *TDD:* os testes de banco (migração 9) foram escritos antes da migração e falharam; *`verification-before-completion`:* verificações rodadas antes de declarar. `npm ci` **não** atualiza skills nem plugins: instala as dependências do `package-lock.json`. O `gh` está instalado e autenticado neste computador.

**Para carregar as versões novas dos plugins:** fechar e reabrir o Claude Code neste projeto (`claude` na pasta do projeto). Nada disso bloqueia o projeto.

Não instalar, sem necessidade concreta: Superpowers completo, ferramentas de memória, o restante do Ponytail, Trail-code, Playwright CLI. `ANALISE-FERRAMENTAS.md` e `AUDITORIA.md` (seções 4, 16 e 18.1) têm o histórico.

---

## D. Organização técnica

**Pastas e arquivos principais**

| Caminho | O que é |
|---|---|
| `src/nucleo/` | Operações validadas de demandas e a lógica da rotina diária (reutilizáveis pela futura IA) |
| `src/servidor/` | Transporte (Supabase real ou banco de teste) e ações do servidor |
| `src/lib/` | Regras puras (datas, `prazos.ts`, grupos do Início, sessão, conta autorizada) e clientes Supabase |
| `src/ui/` | Interface (contexto, janelas, páginas, cápsula de seleção); `cadastro.tsx` (cadastro guiado), `detalhe.tsx` (consulta com lápis), `campos.tsx` (campos e prévia do prazo), `config.tsx` (dias indisponíveis) |
| `src/estilos/` | CSS do Catalyst reaproveitado do protótipo |
| `src/proxy.ts` | Porta de entrada: confere e renova a sessão do Supabase, regrava os cookies (resposta, redirecionamentos e pedido), e-mail autorizado, 503 sem apagar a sessão em falha de rede |
| `src/app/api/cron/diaria` | Rotina diária (autenticação própria por `CRON_SECRET`, isenta do proxy) |
| `src/app/(antigo)` e `src/components` | Design antigo sem uso (referência; exclusão aguarda autorização, melhoria P1) |
| `supabase/migrations/` | 9 migrações em ordem; `supabase/restaurar-copia.sql`; `supabase/LEIA-ME.md` |
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
| `npm run testar:regras` | Regras puras (51) |
| `npm run testar:banco` | SQL, RLS, rotina, acesso, hook, prazos, calendário e migrações 8 e 9 sobre dados antigos no PGlite (171) |
| `npm run testar:interface` | Cadastro (Cadastro sempre primeiro, retomada, sem duplicar), cards (título priorizado, zoom, aparelhos emulados) e escala tipográfica (140); porta 7104 |
| `npm run testar:app` | Navegador e banco de teste (131); sobe o próprio servidor na 7103 |
| `npm run testar:sessao` | Sessão persistente, renovação, revogação, falhas de rede, Sair local e entrada por senha com Auth **falso** (80) |
| `npm run testar:senha-terminal` | `definir:senha` em console Windows (10 cenários) |
| `npm run conferir:env` | Confere o `.env.local` sem mostrar valores e lê configurações do Supabase em modo leitura |
| `npm run definir:senha` | Define a senha do usuário existente (digitada no terminal, nunca gravada) |

Só pode haver um `next dev` por vez (a pasta `.next` tem trava). Portas: 7100 aplicação, 7103 `testar:app`, 7200 protótipo.

**Variáveis (só os nomes; valores nunca no Git):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DMANDA_EMAIL_AUTORIZADO`, `SUPABASE_SERVICE_ROLE_KEY` (só servidor, sensível), `CRON_SECRET` (16 ou mais caracteres). Opcional: `DMANDA_LOGIN_GOOGLE` (vazia por padrão). Só em desenvolvimento: `DMANDA_BANCO=teste` (recusada em produção). Modelo em `.env.example`. Na Vercel, as cinco primeiras ficam **só em Production**.

**Migrações** (todas aplicadas no projeto real; histórico remoto igual ao versionado em 29/10/2026 (`db push --dry-run`: "Remote database is up to date")):
`20261025000000_nucleo_demandas`, `20261025000100_salvar_demanda`, `20261025000200_rotina_diaria`, `20261025000300_acesso_exclusivo`, `20261025000400_revogar_funcao_da_plataforma`, `20261026000000_login_email_senha`, `20261026000100_protecao_edicao_simultanea`, `20261029000100_normalizar_prazos_legados` (só dados: antecipa o vencimento dos legados abertos pelo calendário, preserva original e finalizadas), `20261029000000_prazos_e_dias_indisponiveis` (aditiva: campos opcionais, prazo original e ajustado, dias indisponíveis; testada sobre dados antigos; compatível com o aplicativo anterior). Nunca reescrever uma migração aplicada nem usar `db reset` no projeto real; novas migrações só com dry-run (`npx supabase db push --linked --dry-run`).

**Onde estão as decisões, auditorias e tarefas**
- Decisões: `DECISOES.md` (a mais recente é a fonte). Auditorias e mapa de persistência: `AUDITORIA.md` (seção 18 é a auditoria completa de 27/10; 17 fecha a base Supabase).
- Tarefas, estado e bloqueios: **GitHub Issues** do repositório (#1 fechada; #2, #3, #4 abertas). `PENDENCIAS.md` é o índice com links.
- Produto e escopo: `PRODUTO.md`, `FUNCIONALIDADES.md`. Percentual e critérios: `ANDAMENTO.md` (oficial **29%** desde 30/10/2026, com a contagem item a item).
- Supabase, Vercel, rotina e planos: `supabase/LEIA-ME.md`. Retomada histórica: `SINCRONIZA-PROJETINHO.md`. `RESUMOCASA-26-10.md` é um resumo antigo de 26/10, mantido como histórico.

---

## E. Validação e pendências

**Atualização de 30/10/2026 (Entradas):** *verificado localmente (automatizado), no mesmo estado de código:* `tsc` e `eslint` limpos; `testar:banco` 210 de 210; `testar:regras` 79 de 79; `testar:entradas` 173 de 173; `testar:app` 131 de 131; `testar:interface` 140 de 140 (duas execuções isoladas depois da correção do teste); `testar:sessao` 80 de 80 (duas rodadas); `build` com saída 0. *Supabase real (leitura pela CLI):* migração 10 aplicada, 10 de 10 iguais às versionadas, `db push --dry-run` com "Remote database is up to date", 5 demandas, 8 tarefas e 1 usuário, 0 entradas, RLS ligada na tabela nova e único alerta do Advisor o conhecido; criar entrada e converter em demanda provados com a conta autorizada em transação desfeita. **Não verificado:** uso autenticado de Entradas pelo assistente em produção, PWA instalada, cron, sessão por horas reais.

**Atualização de 29/10/2026 (bloco de sessão, cadastro e prazos):** *verificado localmente (automatizado)*: `tsc` e `eslint` sem erros; `testar:regras` 51 de 51; `testar:banco` 164 de 164; `testar:app` 131 de 131 (Edge, banco de teste); `testar:sessao` 78 de 78 (Auth falso); `build` com saída 0. *Emulação de aparelho* (Edge, não é o aparelho): computador 1360x800, iPad 820x1100 e iPhone 390x844, nos temas claro e escuro, com capturas examinadas e medições (sem rolagem lateral, rodapé à vista; os campos de tarefa têm linha de 48 px de altura, desenho aprovado). *Supabase real:* migração 8 aplicada e conferida (3 demandas, 7 tarefas e 1 usuário preservados; os 3 prazos viraram referência original legada; 0 dias indisponíveis). **Não validado (depende de você ou do aparelho):** teste no iPhone real e na PWA instalada, a persistência da sessão por horas reais, avaliação visual do usuário (Issue #2), validação autenticada em produção feita pelo assistente (sem a sua senha), cron.

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

**Estado do cron:** código pronto e testado localmente; `vercel.json` com o agendamento `0 9 * * *` e rota correta; **Atualização de 28/10/2026 (consulta ao banco real, ao fim do dia): há uma execução registrada em `execucoes_rotina`, `data_ref` 2026-10-28, `ok = true`, sem erro, 1 usuário, iniciada às 09:34:10 UTC (06:34 em Brasília), dentro da janela do Hobby (06:00 a 06:59).** É compatível com a primeira execução automática do cron, mas o banco não distingue disparo automático de botão Run, então a origem exata e o registro do cron em Settings > Cron Jobs continuam a conferir no painel da Vercel. Antes dessa, só existem os testes locais de 25 e 26/10. **Atualização de 29/10/2026 (consulta somente leitura ao banco real):** segunda execução registrada, `data_ref` 2026-10-29, `ok = true`, sem erro, iniciada às 09:34:10 UTC, no mesmo minuto e segundo da de 28/10. Dois dias seguidos no mesmo instante, sem intervenção, indicam disparo agendado (o Hobby sorteia o minuto, mas ele se repete). O banco ainda não distingue agendamento de botão Run, então o registro em Settings > Cron Jobs continua a conferir no painel da Vercel. No Hobby a chamada ocorre em qualquer minuto da hora marcada (09:00 a 09:59 UTC, ou 06:00 a 06:59 em Brasília). A prova da rotina é a linha "Rotina diária na nuvem: última execução em..." no Início (vem da tabela `execucoes_rotina`; os dois registros que existem hoje são testes locais de 25/10).

**Nunca validado de ponta a ponta:** a sessão persistente por horas reais no iPhone (a antiga expiração de 6 horas deixou de existir); restauração da cópia em projeto real; download da cópia dentro do app instalado; instalação da PWA no iPad (o iPhone já tem, confirmado pelo usuário em 30/10/2026); **aprovação visual da aplicação React**; desempenho e latência em produção.

**Pendências realmente necessárias para o primeiro uso**
1. Confirmar a persistência real (recarregar e a demanda continuar) e a saída e nova entrada no endereço publicado: do usuário, em segundos.
2. Confirmar na Vercel que o cron está registrado e disparar o Run manual; o assistente confere o resultado no banco.
3. PWA: **já instalada no iPhone** (confirmado pelo usuário em 30/10/2026); instalar no iPad só se for usar (não presumido). Baixar uma cópia dos dados dentro do app instalado.
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

**O que este bloco mudou fora do Git (para continuar em casa)**
- **`.env.local` e variáveis da Vercel: nenhuma foi alterada nem criada** neste bloco. Nenhuma variável nova é necessária. O que você já tem continua valendo.
- **Supabase (remoto, vale em qualquer computador):** a migração `20261029000000_prazos_e_dias_indisponiveis` já está aplicada no projeto real. Em casa não aplique nada: `git pull` e `npx supabase db push --linked --dry-run` deve dizer "Remote database is up to date".
- **Nada foi mudado no painel do Supabase nem da Vercel** (Google segue desligado, cadastro público desligado).
- **Só neste computador de trabalho (repetir em casa se quiser as mesmas versões):** os plugins `code-review` (1.0.1), `context7` e `playwright` (`f8c5e7a1dcb7`) foram atualizados com `claude plugin marketplace update claude-plugins-official` e `claude plugin update <plugin>@claude-plugins-official`; as skills do projeto (Impeccable 4.8.0 e `systematic-debugging`) **vêm pelo Git** com o `git pull`; só o binário do Impeccable é por computador (`.claude/skills/impeccable/scripts/impeccable.cmd update -y --project --no-hooks` baixa o motor 0.1.18). O `gh` não está instalado neste computador de trabalho.
- **Fora do Git de propósito:** `.env.local`, `.dados-teste/` (bancos de teste descartáveis) e cópias `dmanda-copia-*.json`. Tudo o mais foi enviado.

**Primeira ação concreta da próxima sessão**
1. **Você, no computador e no iPhone, no endereço publicado:** seguir o **roteiro de avaliação** da seção G (dura poucos minutos). Reabra a PWA no iPhone horas depois e confirme que não pede login.
2. **Você, na Vercel (projeto `dmanda`, Settings > Cron Jobs):** conferir que `/api/cron/diaria` com `0 9 * * *` aparece registrada e clicar em **Run**.
3. **Assistente:** `git pull`, conferir no banco (`npx supabase db query --linked "select ok, erro, iniciou_em from public.execucoes_rotina order by iniciou_em desc limit 3"`) e registrar o resultado. Só depois da sua aprovação deste bloco avançar para Entradas, Agenda, Documentos, IA e demais módulos.

**Roteiro de 28/10 que segue em aberto (veio do commit `eae8337`, integrado em 29/10; a cópia dos dados agora é versão 2)**
1. **Na Vercel (vercel.com, projeto `dmanda`, Settings > Cron Jobs):** confirmar que `/api/cron/diaria` (`0 9 * * *`) está registrada e, em Logs, se a execução de 06:34 de hoje veio do agendamento. Depois das 07:00 de qualquer dia seguinte, abrir o Início e ver a linha "Rotina diária na nuvem: última execução em..." com a data do dia (a execução de 29/10 ainda não foi conferida no banco).
2. **No endereço publicado:** sair e entrar de novo (valida a nova entrada) e baixar uma cópia dos dados (menu do avatar). Guardar o arquivo fora do projeto.
3. **No iPhone (Safari):** abrir o endereço, Compartilhar > Adicionar à Tela de Início, abrir pelo ícone, entrar e conferir que as demandas aparecem. **No iPad:** o mesmo. Em cada um, tentar "Baixar cópia dos dados" dentro do app instalado e dizer se baixou.
4. Avaliar visualmente a aplicação (Issue #2).

---

## G. Últimas alterações (29/10/2026: sessão persistente, cadastro guiado, consulta e prazos)

**Bloco de integração e correções (29/10, tarde; decisões 34 a 36).** Os históricos dos dois computadores foram integrados por merge (`d9c1328`, sem reescrever histórico; o commit local `eae8337` e o registro `a585ab8` preservados). Os três achados foram **reproduzidos antes de corrigir** e corrigidos:
1. *Nova demanda pelo botão de uma coluna do Quadro nascia na etapa da coluna* (reproduzido: "criada e salva em Vistos"). Agora só a coluna Cadastro tem o botão e toda demanda nasce em Cadastro.
2. *Rascunho do passo 3 perdido na recarga e risco de duplicar* (reproduzido: `dmanda:rascunhos` vazio e volta ao passo 1). O rascunho guarda passo, identificador (gravado antes de chamar o servidor), demanda criada, versão, tarefas e a tarefa em digitação; retomada testada com recarga, resposta perdida (servidor criou, aparelho não recebeu), lista que não carregou e versão mudada em outro aparelho.
3. *Legados abertos em fim de semana sem normalização* (reproduzido no banco de teste). Migração 9 (nova, a 8 não foi reescrita), testada: sábado e feriado do próprio usuário antecipados, calendário de outro usuário não aplicado, dia útil e finalizadas intocados (versão idêntica), tarefas idênticas, reaplicar inofensivo. **No Supabase real hoje nenhuma legada aberta caía em fim de semana** (quinta, sexta e quinta), então a migração não mudou dado nenhum lá.
*Cards:* título em faixa ou cortado reproduzido por medição (5 a 6 linhas necessárias, 1 visível, com a descrição em 3 linhas) e corrigido na causa (decisão 35). *Escala 85%:* 3795 textos medidos antes e depois, todos a 0,85 (ou piso de 10 px, ou campo de 16 px no toque), sem redução dupla. Também corrigidos, achados na revisão visual: "Não informado" centralizado na consulta (a classe global `.vazio` vazava para o `dd.vazio`) e cabeçalhos das colunas do Quadro desalinhados.
*Verificações finais:* `tsc` e `eslint` limpos; `testar:regras` 51/51; `testar:banco` 171/171; `testar:app` 131/131; `testar:sessao` 80/80; `testar:interface` 140/140 (estável em execuções repetidas); `build` ok. *Revisão `ponytail-review`:* 1 achado procedente de correção (cadastro retomado com lista não carregada geraria identificador novo e duplicaria a demanda), 1 de teste (dois ramos de retomada sem cobertura) e 2 pequenos (asserção sem força e interpolação inútil), todos tratados.
*Diferenças de ambiente:* "zoom" nos testes é o equivalente de layout do navegador (viewport em px CSS dividido pelo zoom, densidade multiplicada), não o zoom de texto isolado; iPad e iPhone são emulação do Edge (toque e densidade), **não** aparelho; o iPhone real continua pendente (Issue #2).
**Roteiro de avaliação no iPhone (curto):** (1) abrir o app e rolar Demandas em Cards: os títulos longos devem aparecer em 3 ou 4 linhas, com a descrição curta ou ausente; (2) tocar em um campo do cadastro: a tela **não** deve dar zoom; (3) criar uma demanda pelo "Nova demanda" e, no passo 3, adicionar uma tarefa, deixar outra digitada, fechar o app por completo e reabrir: o cadastro deve voltar no passo 3 com as duas; (4) no Quadro, só a coluna Cadastro tem o "+"; (5) ver se o texto menor (cerca de 85%) continua legível, principalmente as etiquetas de 10 px, e dizer se prefere um piso maior (o ajuste é o `--esc` ou o piso em `src/estilos/app.css`).


**Causa da perda de sessão no iPhone (investigada antes de corrigir):** a regra das 6 horas dependia de um cookie próprio, `dmanda-ultimo-uso`, renovado só em navegações, cuja ausência ou idade maior que 6 h encerrava a sessão do Supabase mesmo válida. A PWA reaberta depois de horas caía no login. Além disso o proxy não entregava os cookies renovados à renderização e aos redirecionamentos, tratava qualquer falha de rede como "sem sessão" e a primeira entrada escrevia os cookies por script (limitados a 7 dias no Safari). Correção: sessão do Supabase renovada pelo SDK e regravada nos cookies (resposta, redirecionamentos e pedido), falha de rede responde 503 "tente de novo" sem apagar nem liberar, o login regrava a sessão pelo servidor, o cookie antigo só é apagado. Detalhes e limites em `supabase/LEIA-ME.md` ("Sessão persistente") e `AUDITORIA.md` 19.

**O que foi implementado e onde encontrar:**
- **Cadastro guiado:** botão "Nova demanda" (Demandas, botão "+", Início, colunas do Quadro). Três passos; a demanda é criada ao fim do passo 2; concluir com tarefas leva a Vistos. `src/ui/cadastro.tsx`.
- **Consulta com lápis:** clique em qualquer card, linha ou item. Cinco seções (Identificação, Descrição, Chegada e prazo, Andamento, Tarefas), um lápis em cada, Cancelar e Salvar na seção. `src/ui/detalhe.tsx`.
- **Prazos:** prazo original, vencimento ajustado e explicação em Chegada e prazo; Cards, Quadro, Tabela, Lista, Início e a rotina diária leem o vencimento ajustado. Regra em `src/lib/prazos.ts` e na migração 8.
- **Dias indisponíveis:** Configurações (menu lateral ou "Mais" no celular). Cadastro de feriados e eventos externos de dia inteiro, com edição e exclusão; recalcula os vencimentos no servidor.
- **Cópia dos dados versão 2** (`/api/exportar`) e restauração (`supabase/restaurar-copia.sql`, aceita versões 1 e 2).

**Comportamento definitivo dos prazos:** permanência = dias corridos desde a chegada (sem chegada, não há contagem); prazo original = data escolhida ou hoje + 5, 10, 20 ou 30 dias corridos (exclui o dia de hoje, inclui o último; nunca parte da chegada); vencimento ajustado = original antecipado, dia a dia, até o primeiro dia que não seja sábado, domingo, feriado ou evento externo cadastrado (vale para data digitada); recálculo automático e persistido no Supabase ao cadastrar, alterar ou excluir um dia, nos dois sentidos, sem passar do original e sem tocar nas finalizadas; reabrir usa o calendário de então; demandas antigas viram "legado" (o prazo de então é a referência original).

**Testes executados (resultados reais):** `tsc` e `eslint` limpos; `testar:regras` 51/51; `testar:banco` 164/164 (inclui migração sobre dados antigos, equivalência com a prévia em TypeScript em 150 datas e concorrência); `testar:app` 131/131; `testar:sessao` 78/78; `build` exit 0. **Limitações:** Auth falso (não é o Supabase real), Edge emulando aparelhos (não é iPhone), banco PGlite (não é o Postgres do Supabase).

**Ferramentas:** ver a tabela da seção C. Revisões: `ponytail-review` (1 sobra de código removida) e `/code-review medium` (1 apontamento procedente, corrigido: o erro do `refreshSession` na entrada).

**Roteiro único de avaliação (computador e iPhone, no endereço publicado, com a sua senha):**
1. *Computador:* entrar; Demandas > Nova demanda; passo 1 só com o assunto > Próximo; passo 2 clicar "10 dias" e conferir a prévia; escolher um sábado e ver a antecipação para sexta; **Pular e salvar demanda** (ou salvar) e ver o aviso "criada e salva em Cadastro"; passo 3 adicionar uma tarefa > Concluir cadastro (deve ir para Vistos). Apague essa demanda de teste depois.
2. *Computador:* abrir um card; tocar no lápis de cada seção, editar e salvar; Cancelar descarta. Em Configurações cadastrar um feriado numa sexta e ver o vencimento de uma demanda de sábado recuar; excluir o feriado e ver voltar.
3. *iPhone:* abrir o app instalado, entrar uma vez, fechar totalmente, esperar algumas horas (o ideal é um dia) e reabrir: **não deve pedir senha**. Conferir também o teclado virtual no cadastro e na consulta, os botões do rodapé e o modo escuro.
4. *Avise o que estranhar:* qualquer tela confusa, texto, ou data que não bata com a sua conta.

**Registro anterior (27 e 28/10/2026):**

**Correções da auditoria (commit `ba6b33a`, em `main`):** (1) data provisória de 2000 aparecia por cerca de 0,2 s nos cards em toda carga ("faltam 9789 d", "0 atrasadas"); corrigida (`src/ui/contexto.tsx`: `setHoje(hojeISO())` junto de `setDemandas`). (2) Foco do teclado preso na janela e devolvido a quem a abriu (`src/ui/janelas.tsx`). (3) Atalho "/" que foca o filtro, como no protótipo (`src/ui/paginas.tsx`). (4) Removido `suppressHydrationWarning` indevido (`src/ui/Casca.tsx`). (5) PGlite de teste fora do pacote das funções da Vercel, de 611 para 261 itens (`next.config.ts`). (6) `catalyst.css` incluído no pacote das funções (`next.config.ts`). (7) Avisos "Você saiu" e "login vale 6 horas" em tom neutro e não em vermelho. (8) Variável morta removida. Verificações novas em `testar:app` (74).

**Consolidação (27/10):** `checkpoint/2026-10-23-ajustes-a-d` (era `8fb7c01`, 56 commits à frente da `main` antiga `c314b53`) integrado por fast-forward e removido, local e remoto.

**Publicação pela main (27/10, `58fc8ec`):** `vercel.json` = `{"regions":["gru1"], "git":{"deploymentEnabled":{"**":false,"main":true}}, "crons":[{"path":"/api/cron/diaria","schedule":"0 9 * * *"}]}`. A `producao` (`a0eaa46`) era ancestral da `main`, sem trabalho exclusivo, e foi removida. Decisões 24 e 25 em `DECISOES.md`.

**28/10:** o painel da Vercel mostrou `dmanda-adm.vercel.app` em Production, branch `main`, commit `58fc8ec`, Ready. A conferência desta data está na seção E. Os documentos `CLAUDE.md`, `README.md`, `SINCRONIZA-PROJETINHO.md`, `supabase/LEIA-ME.md`, `PENDENCIAS.md`, `DECISOES.md`, `ANDAMENTO.md` e as Issues #2 e #3 foram ajustados para apontar para este arquivo.

**Para não repetir:** não abrir outra auditoria geral sem fato novo; não recriar o projeto da Vercel; não restaurar `producao`; não reaplicar migrações; não ler o `.env.local`; não declarar validado em produção o que só foi testado localmente.


---

## H. Bloco Entradas (30/10/2026: aprovação do bloco anterior, Entradas e as duas falhas de teste investigadas)

**Aprovação.** Em 30/10/2026 o usuário aprovou o bloco entregue na versão `2714937` (cadastro, cards, tipografia e prazos) e autorizou Entradas, com migração, commits, push e Vercel. A aprovação encerra a espera por **esse** bloco e **não** comprova a origem das execuções do cron nem a sessão por horas reais. O estado vigente de cada etapa, com o que falta, está em `ANDAMENTO.md` (reavaliado em 30/10/2026).

**O que passou a funcionar (decisões 37 a 39, Issue #5).** Entradas em post-its no Supabase, iguais no computador e na PWA: criar, consultar e editar (título opcional, texto, cor entre seis tons pastel, tags `#`, fixar no topo), buscar sem acento e filtrar por tag, arquivar e recuperar pelo Arquivo (aba Entradas), excluir de vez só o que está arquivado e com segunda confirmação. Acesso por Entradas, "Nova entrada" do "+" e atalho N no computador; no toque os botões ficam sempre visíveis. A janela salva sozinha (rascunho no aparelho em 0,4 s, banco em 1,2 s) e diz a verdade: "Salvo no Dmanda" só com a confirmação do banco, "Só neste aparelho" enquanto não chegou. **Virar demanda** abre o cadastro guiado preenchido (título explícito vira o assunto; sem título, a primeira linha útil; o resto vai para a descrição, com as tags); a demanda e o vínculo são gravados na **mesma transação** quando o passo 2 cria a demanda; a anotação original fica preservada, ligada e sem edição no Arquivo, e a consulta da demanda mostra a "Entrada de origem". Cópia dos dados **versão 3** (`entradas`, `entradas_arquivadas`), com restauração por SQL (aceita as versões 1, 2 e 3).

**Banco.** Migração 10 (`20261030000000_entradas.sql`): tabela `entradas` com RLS e privilégios mínimos, versão por gatilho, funções de leitura e escrita, `criar_demanda_de_entrada` e `entrada_id` na leitura da demanda. **Aplicada no Supabase real em 30/10/2026** (dry-run antes; aditiva, sem tocar em dados): 10 de 10 migrações iguais às versionadas, 5 demandas, 8 tarefas e 1 usuário como antes, 0 entradas, RLS ligada, visitante sem acesso, único alerta do Advisor o já conhecido. Provado no real, com a conta autorizada em transação desfeita: criar entrada, converter em demanda e vínculo correto, sem sobrar nada.

**As duas falhas de teste e como foram tratadas (investigadas antes de corrigir).**
1. `testar:interface`, "coluna Cadastro não encontrada" (linha do Quadro). *Evidência:* medição com linha do tempo da página (MutationObserver, leitura de `dmanda:ui`, ações do servidor) mostrou que, quando o auxiliar `ir` devolve o controle, a tela ainda mostra a visão **Cards** (a visão guardada, Quadro, aparece de 40 a 200 ms depois, quando termina a fila de ações do servidor do início: as ações rodam uma de cada vez). Acontece na versão **atual e na anterior ao bloco** (`2714937`, extraída com `git archive` e executada à parte), então **não é regressão de Entradas**; Entradas lança mais uma ação nessa fila (cerca de 27 ms a mais na medição), o que pode ter piorado uma margem que já era curta, sem ser a causa. *Tratamento:* o `ir` do teste agora espera explicitamente a visão guardada (ou o estado vazio, ou o erro de carga) com limite de 30 s e falha com o retrato da tela (visão, contagens, texto); nenhuma pausa fixa foi acrescentada e nenhuma verificação foi enfraquecida. *Incerteza que resta:* a falha original, dentro da bateria completa, não foi reproduzida; reproduzi a condição que a causa (visão aplicada depois do retorno do `ir`) e confirmei que a espera a elimina (140 de 140). Observação de produto, sem alteração: a visão guardada aparecer algumas centenas de milissegundos depois dos dados é um piscar de Cards no Quadro, anterior a este bloco.
2. `testar:sessao`, "a renovação feita no proxy chega à rota do servidor na mesma requisição" (80 verificações, 1 falha). *Evidência:* com diagnóstico (contagens e caminhos, sem tokens), a requisição a `/api/exportar` respondeu **500** e houve **exatamente 1 renovação**: a renovação única e a propagação dos cookies estavam corretas. A rota de cópia passou a ler `listar_entradas`, e o servidor falso do teste só conhecia `listar_demandas` e `listar_dias_indisponiveis` (o resto vira 404), então a rota respondia 500. *Tratamento:* o servidor falso responde lista vazia também para `listar_entradas` (o contrato novo da cópia); a mensagem da verificação agora mostra status, renovações e rotas chamadas. 80 de 80 em duas rodadas seguidas. Não era defeito da aplicação, não houve renovação dupla e nenhuma proteção de sessão foi alterada.

**Revisão `ponytail-review`** (invocada de fato, duas vezes). Primeira passagem, 5 achados, todos tratados: rascunho falso ao esconder a tela sem alteração (corrigido, com teste), ramo morto, volatilidade da função de cor (`volatile`, antes de aplicar), código de depuração, e o teste correspondente. Passagem final: ver `AUDITORIA.md`, seção 21.

**Roteiro curto para avaliar Entradas na PWA (cerca de 4 minutos).**
1. Abra **Entradas** pelo menu (ou "+" e "Nova entrada") e crie uma nota com um título e outra só com texto e uma tag (`#teste`). A mensagem na base da janela deve passar de "Só neste aparelho" para "Salvo no Dmanda".
2. Feche o app por completo e reabra: as notas devem estar lá. Toque numa nota, altere o texto e feche o app logo em seguida: ao reabrir, a alteração deve estar salva ou aparecer como "Só neste aparelho" (com a opção de continuar).
3. Toque em fixar e confira que a nota sobe ao topo. Toque na tag da barra e use a busca (sem acento).
4. Toque em **Virar demanda** numa nota: o cadastro deve abrir com assunto e descrição preenchidos. Cancele: a nota continua em Entradas. Faça de novo, avance até o passo 2 (a demanda é criada) e pule as tarefas: a nota sai de Entradas e a demanda fica em Cadastro.
5. Em **Mais > Arquivo > Entradas** (ou "Arquivadas" na tela de Entradas) a nota convertida aparece como "Virou demanda"; arquive e recupere outra nota.
6. Diga se os post-its (duas colunas no iPhone), o texto e os botões estão legíveis e fáceis de tocar. Se tiver dois aparelhos, edite a mesma nota nos dois e confira o aviso de conflito.

---

## I. Ajustes depois da aprovação funcional de Entradas (30/10/2026, decisão 40)

**Aprovação.** O usuário testou **Entradas** na versão `1aecf40` (PWA do iPhone) e aprovou o **funcionamento**; pediu cinco ajustes, entregues no commit `c932dac` (sem migração, sem mexer em dados). Não é aprovação visual. A Issue #5 segue aberta só para a conferência desses ajustes; a #2 recebe a observação de que o usuário já usa a PWA no iPhone.

**O que mudou.** (1) Entrada abre em **leitura** (sem campo focado nem teclado; foco na janela, Tab preso à janela, foco devolvido a quem abriu); o **lápis** liga a edição e foca o texto no mesmo toque; "Voltar à leitura"; rascunho não enviado fica **em espera** com aviso e "Retomar edição" (nada é enviado em silêncio); convertida só em leitura. (2) Seletor do Arquivo com texto visível em todas as larguras (classe `so-texto`, só ali). (3) Campo Data cabe no quadro (o controle nativo tinha largura mínima própria; reproduzido a 360 px). (4) Lista de Demandas reorganizada (`.lista-dem`). (5) Selo Legal/Próprio fora dos cards (Cards, Quadro, Início, Lista); continua na Tabela, nos detalhes, nos dados e na cópia.

**Verificado localmente (automatizado), no mesmo estado de código:** `tsc` e `eslint` limpos; `testar:ajustes` **563 de 563** (Edge e WebKit do Playwright; novo); `testar:entradas` 173 de 173 (abrindo pelo lápis); `testar:app` 132 de 132 (agora com a Lista marcando a demanda atrasada); `testar:interface` 140 de 140; `testar:regras` 79 de 79; `build` com saída 0. `testar:banco` e `testar:sessao` não rodaram de novo: nada de banco, sessão ou Auth mudou neste bloco. **Revisão `ponytail-review`** invocada; o Impeccable foi usado em crítica enxuta (detector sem achados). **Limite:** o WebKit do Playwright no Windows é o motor do Safari, **não** o Safari do iPhone: o rendering real do campo de data nativo (e se o campo vazio aparece em branco com `appearance: none`) só se confirma no aparelho.

**Roteiro curto para conferir só estes ajustes no iPhone (cerca de 4 minutos).**
1. **Entradas:** toque numa nota. Deve abrir **sem teclado**, com título, texto completo (quebras de linha) e tags. Toque no **lápis** (no alto da janela, à esquerda do X): aparecem os campos e o teclado. "Voltar à leitura" mostra o que você digitou. Feche e confirme "Salvo no Dmanda".
2. **Nova entrada** ("+" ou o botão): abre pronta para digitar. **Virar demanda**, **Arquivar** e **Fixar** continuam na janela de leitura.
3. **Mais > Arquivo:** as abas **Demandas** e **Entradas** devem mostrar o texto, nos temas claro e escuro. Troque de aba.
4. **Mais > Configurações > Dias indisponíveis:** o campo **Data** deve ficar dentro do quadro, vazio e depois de escolher uma data, e também ao girar o aparelho. Veja se o campo vazio se identifica bem. Cadastre, edite e exclua um dia.
5. **Demandas > Lista:** assunto à esquerda, número/tipo/origem só quando existem, vencimento e tarefas alinhados, **seta** (mostra as tarefas) e **lápis** (consulta completa) fazendo coisas diferentes. Abra uma linha, marque uma tarefa.
6. **Cards** e **Quadro** (e o Início): sem o selo "Legal"/"Próprio", com vencimento e contagem; a **Tabela** e a consulta da demanda ainda mostram o tipo do prazo.

**Complemento de navegação (30/10/2026, `d1cac39`, decisão 41).** O usuário aprovou os ajustes da `ddef462`. Entrou o botão "Arquivadas" na barra de Demandas (ícone no celular, "Ver demandas arquivadas"), que abre `/arquivo` na aba Demandas; o de Entradas abre a aba Entradas; "Mais > Arquivo" segue geral. Verificado: `testar:ajustes` 583 de 583 (navegação nos dois sentidos com a última aba oposta, troca de abas, vazio e preenchido, claro e escuro, computador, iPad e iPhone), `testar:app` 132, `testar:interface` 140, `tsc`, `eslint`, `build` com saída 0. Para conferir no iPhone: Demandas, ícone de arquivo na barra, deve abrir Arquivo na aba Demandas; Entradas, ícone de arquivo, na aba Entradas. Observação: o teste que prepara a tela de Quadro mostrou instabilidade ocasional (a visão guardada aparece depois dos dados, comportamento anterior já registrado); o auxiliar agora espera a visão explicitamente.

**Entradas: descrição, carimbo e cinco cores (30/10/2026, `2d6d368`, decisão 42, migração 11).** Pedido do usuário depois de aprovar o complemento de navegação. O post-it mostra título e, abaixo, o texto como descrição (estilo das demandas); o pé mostra a data da primeira criação ("30/10/2026 às 14:48", Brasília, sem segundos), e a consulta troca "Salvo no Dmanda" por "Criada em ...". Cinco cores e sorteio de 0 a 4. **Migração 11 aplicada no Supabase real com dry-run:** contagens e resumo (hash) das entradas idênticos antes e depois (6 demandas, 10 tarefas, 2 entradas, 1 com a cor 5 intacta); "Remote database is up to date". Verificado: `testar:ajustes` 604, `testar:banco` 214, `testar:regras` 81, `testar:entradas` 174, `testar:app` 132, `testar:interface` 140, `tsc`, `eslint`, `build` com saída 0; `ponytail-review` invocado sem achado que exigisse correção. Para conferir no iPhone: Entradas com título mostram o texto em fonte mono abaixo; o pé de cada post-it mostra a data; abrir uma entrada mostra "Criada em ..." no rodapé; a janela oferece cinco cores e a automática; a nota antiga de cor 5 continua visível e editável.

---

## J. Fechamento de Entradas e Arquivo (30/10/2026)

**Entradas e Arquivo aprovados e encerrados. Próximo bloco: Agenda, aguardando autorização para começar.**

O usuário aprovou os ajustes de `ddef462` (leitura com lápis, seletor do Arquivo, campo Data, Lista, selo fora dos cards), o botão Arquivadas em Demandas e, por último, a descrição nos post-its, o carimbo da primeira criação e as cinco cores (`77d4a70`). **Isso substitui** qualquer "aguarda a conferência no iPhone" nas seções H e I acima, que ficam como histórico. Issue #5 fechada. Continuam abertas, por outros assuntos: #2 (conferir o restante da aplicação nos aparelhos), #3 (cron registrado e primeira execução, sessão por horas reais) e #4 (destino da cópia dos dados). O iPad não foi testado nem aprovado. Andamento 37% (`ANDAMENTO.md`).

---

## K. Rodada de revisão e refatoração antes da Agenda (30/10/2026)

Detalhes e a lista completa em `AUDITORIA.md`, seção 23. **Estado:** código e testes prontos e **commitados localmente; ainda sem push** e **sem aplicar a migração 12 no Supabase real**, porque este pedido não autorizava nenhuma das duas coisas (a migração mexe no banco real e o push publica na Vercel). Verificado no banco de teste e no navegador: `tsc`, `eslint`, `testar:banco` 219, `testar:regras` 82, `testar:entradas` 179, `testar:app` 132, `testar:interface` 142, `testar:ajustes` 604, `build` com saída 0, `verificar:cores` limpo, `ponytail-review` invocado (achou um defeito da própria correção, a lista de entradas do Arquivo presa em "Carregando", reproduzido e corrigido). **Depende do usuário:** autorizar (1) aplicar a migração 12 no Supabase real (dry-run antes; só troca duas políticas de RLS) e (2) o push para a `main`; decidir (3) o destino do design antigo (`(antigo)` e as 3 dependências).
