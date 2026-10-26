# Auditoria única do Dmanda (26/10/2026)

Relatório consolidado. **Não abrir outra auditoria geral sem fato novo.** Pendências continuam nas Issues #1 a #4 (ver o fim, "Issue consolidada").

## 1. Versão e escopo

- Base auditada: branch `checkpoint/2026-10-23-ajustes-a-d`, commit `d22f216` (árvore limpa, local igual ao remoto). Computador do trabalho, sem `.env.local`, sem login da CLI do Supabase e sem `gh`. `node_modules` estava incompleto (faltavam `@supabase/*` e o PGlite): reinstalado com `npm ci` (lockfile intacto).
- Revisado: aplicativo (`src/`), migrações, testes, configuração (Next, Vercel, ferramentas), instruções de trabalho. Fora do escopo: redesenho, troca de stack, módulos futuros. O protótipo e o design aprovado não foram alterados; a aplicação React continua sem aprovação visual do usuário.
- **Nada foi validado no Supabase real nesta auditoria** (sem credenciais neste computador). Tudo abaixo foi verificado em banco local (PGlite) ou em Auth **falso** (servidor local que imita o Auth), e está identificado assim.

## 2. Pronto para usar e em construção

| Pronto (testado só em ambiente local) | Em construção |
|---|---|
| Demandas e tarefas (cadastro, edição, etapas, concluir, reabrir, arquivar, excluir), quatro visões, filtros, Início (grupos e Foco do dia), Arquivo, rascunho automático, entrada por e-mail e senha, Sair, expiração de 6 h, aviso de falha de conexão, atualização ao voltar à tela, cópia dos dados (JSON), PWA online | Entradas, Agenda, Documentos, IA, Configurações (paletas, fontes, fundo), Perfil (humor e energia), busca global, avisos (sino), botões "+" de Anotação, Evento, Documento e Chat, importação de cópia, edição offline, notificações, app nativo |

"Pronto" aqui não significa validado no Supabase real nem avaliado visualmente pelo usuário.

## 3. Achados

### 3.1 Defeitos confirmados e corrigidos (com evidência)

| # | Local | Evidência | Impacto | Correção |
|---|---|---|---|---|
| D1 | `src/app/(antigo)/marca`, `src/proxy.ts` (matcher) | `curl` sem login em `next dev` e `next start`: `/marca` respondia 200 (a exceção por nome de pasta `marca` e `emojis` isentava qualquer caminho começando assim) | Página antiga de desenvolvimento aberta sem login (sem dado privado, mas fora da porta de entrada) | Matcher só isenta arquivos estáticos pela extensão; testes cobrem `/marca`, `/pecas`, `/tokens` e a marca estática |
| D2 | `src/lib/sessao.ts` (`sessaoExpirou`) | Cookie `dmanda-ultimo-uso` ausente ou ilegível "não expirava"; valor no futuro nunca expirava | Apagar ou adulterar o cookie prolongava a sessão | Ausente, ilegível ou futuro (acima de 1 min) conta como expirado; o login grava o carimbo; `/login` com carimbo inválido mostra o formulário (sem laço) |
| D3 | `src/ui/contexto.tsx` (`rodar`, `recarregar`, `excluir`) | Mesmo cenário (internet cortada, gravar) no código antigo: nenhum aviso em 30 s, botão preso (`TimeoutError` do teste); sessão expirada no meio do uso idem | Falha de conexão ou de sessão sem mensagem; janela travada | `try/catch` central: sem internet mostra "Nada foi gravado"; sessão encerrada leva ao login (sonda `/api/sessao`); texto e botão preservados; faixa "Sem conexão" |
| D4 | `src/ui/janelas.tsx` | Rodapé dizia "Rascunho guardado automaticamente", mas o rascunho só era guardado ao fechar com Esc ou X | Recarregar, sessão expirada ou o iOS matar o app perdiam o texto (regra do projeto: texto digitado nunca se perde) | Gravação automática 0,5 s depois da última digitação nas três janelas; teste confirma o texto guardado após o redirecionamento por expiração |
| D5 | `src/app/(app)/login` | Captura de tela: fora de `.app[data-dir="d"]` os tokens e botões do Catalyst não valem; campos sem estilo e, no modo escuro, texto invisível sobre cartão claro | Login ilegível no escuro, botão do Google sem aparência de botão | `PainelLogin` aplica os tokens do Catalyst (claro e escuro); Google passa a botão secundário |
| D6 | `.claude/settings.json` | O projeto desativava `code-simplifier@anthropic-plugin-directory`; o instalado e habilitado no usuário é `code-simplifier@claude-plugins-official`. O agente `code-simplifier:code-simplifier` aparecia ativo nesta sessão | Plugin que deveria estar desativado seguia ativo neste computador | Chave certa adicionada (a antiga foi mantida para o computador de casa). Vale a partir da próxima sessão |
| D7 | `.env.example` | Continha nomes antigos (`DATABASE_URL`, `ADMIN_EMAIL`, `AUTH_SECRET`...) que nada usa | Configuração errada ao copiar o modelo | Reescrito com as variáveis reais (só nomes) |
| D8 | `src/app/auth/callback/route.ts` | `signOut()` sem escopo (global) ao recusar conta | Inconsistência com o resto (todo o resto é local) | Escopo local |
| D9 | `src/ui/contexto.tsx` | Lista só se atualizava ao recarregar | Com iPhone e computador no mesmo banco, a PWA reaberta mostrava dados velhos | Releitura ao voltar à tela ou recuperar a conexão, sem janela aberta, descartando leitura que ficou velha por gravação (contadores) |
| D10 | `src/estilos` | Sem `env(safe-area-inset-bottom)` com `viewportFit: cover` | No iPhone a barra inferior, o botão + e os avisos ficariam sob o indicador de início | CSS com `max()` e `calc()`; medido com insets emulados: 14 px sem inset (igual ao aprovado), 34 px com inset de 34 |

### 3.2 Mudanças pedidas (não são defeitos)

- Entrada por e-mail e senha (seção 5), PWA (seção 8), cópia dos dados (seção 9), cabeçalhos de segurança (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS), `robots: noindex`, cookies de sessão `secure` apenas sobre HTTPS.

### 3.3 Hipóteses descartadas

- "A rotina diária renova a sessão humana": falso. `/api/cron/*` passa direto pelo proxy, sem cookies (testado).
- "Pré-carregamentos do Next renovam o último uso": o Next remove esses cabeçalhos antes do proxy (documentado no pacote), mas o aplicativo não usa `<Link>` nem `router.prefetch`. Um teste agora falha se isso mudar.
- Datas: `hojeISO` usa `America/Sao_Paulo`, cálculos por `Date.UTC`, sem contador que decai. Sem defeito.
- `DMANDA_BANCO=teste` em produção: o servidor responde 500 (recusa), conferido em `next start`.
- Dependências: `npm audit` sem vulnerabilidades (produção e desenvolvimento).

### 3.4 Pendentes e limites (preferência ou melhoria, nenhum bloqueia o uso)

1. **Expiração de 6 h é controle da aplicação.** O cookie não é assinado e o token do Supabase segue válido na API por até 1 h (renovável) mesmo depois das 6 h. Proteção contra aparelho esquecido, não fronteira contra quem controla o aparelho. O caminho "duro" é o plano pago do Supabase (expiração por inatividade).
2. **Dois aparelhos editando a mesma demanda:** o último a salvar vence, sem aviso de conflito (`salvar_demanda` não compara versão). Recomendado antes de usar muito nos dois aparelhos: comparar `atualizado_em`.
3. **Rascunhos e preferências ficam no navegador depois de "Sair"** (decisão anterior de preservar). Em computador compartilhado, os rascunhos (texto de demandas) permanecem.
4. **Sem service worker:** abrir a PWA sem internet mostra a tela de erro do navegador (só o uso com o app aberto tem aviso próprio).
5. **Cookies do Supabase não são `httpOnly`** enquanto o cliente do navegador for usado (hoje: login por senha e Google). É padrão do Supabase para esse modo.
6. **Design antigo no build** (`/marca`, `/pecas`, `/tokens`, `src/components`): só referência, atrás do login. Remover quando o usuário decidir.
7. **`scripts/verificar-cores.mjs`** olha um `globals.css` do design antigo: obsoleto, não faz parte dos testes acordados.
8. **eslint 9.39** avisa fim de suporte: atualizar depois (preferência).
9. **Projeto Supabase gratuito pode pausar** por inatividade. A rotina diária ajuda mas não garante; a cópia manual protege.
10. **Intermitência registrada:** em cerca de 2 de 10 execuções do `testar:sessao` uma verificação ("as preferências do navegador continuam depois de sair") falhou uma vez, sem causa conclusiva. A comparação agora ignora a ordem das chaves e mostra os valores se falhar; as 6 execuções seguintes e as 3 finais passaram 57 de 57. Se voltar, investigar com a mensagem nova.
11. O prompt oculto de `definir:senha` em terminal real (PowerShell) não é automatizável aqui: foi testado só o caminho canalizado. Se a digitação oculta falhar, avise.

### 3.5 Revisão de código (skill `code-review`, nível alto, sobre o conjunto de mudanças)

Oito apontamentos. Procedentes e corrigidos: releitura que podia sobrescrever dados (contadores no início e no fim das gravações, inclusive `excluir`); `erroCarga` não limpo na releitura; hook aceitando `email` (voltou a só Google; a migração 6 mexe só em `conta_autorizada()`); limite de tentativas contado pelo IP do servidor (login agora direto do navegador ao Auth, ver seção 5); `secure` em `http://localhost` (agora só sobre HTTPS); cores soltas no manifesto (lidas de `catalyst.css` por `coresDaBarra()`); sonda pesada (nova `/api/sessao`); dependência de nada pré-carregar (teste de guarda). Nada foi descartado.

## 4. Configuração efetiva de skills e ferramentas

Instalado, habilitado, disponível nesta sessão e efetivamente usado são coisas diferentes:

| Item | Instalado | Habilitado | Disponível nesta sessão | Usado na revisão |
|---|---|---|---|---|
| Impeccable (skill e 4 agentes) | projeto (`.claude/skills`, `.claude/agents`) | sim | sim | **não** (sem avaliação de design pedida; só capturas de tela minhas do login). O binário do motor (`scripts/bin`, ignorado pelo Git, por computador) não existe aqui |
| systematic-debugging, test-driven-development | projeto | sim | sim | **aplicados como prática** (testes antes do código nas regras de sessão e banco; investigação por evidência do cookie e do deadlock); só a verification-before-completion foi chamada pela skill |
| verification-before-completion | projeto | sim | sim | **sim**, antes de declarar o fechamento |
| Playwright | plugin (usuário) + `playwright-core` no projeto | sim | sim (MCP conectado) | **sim** via `playwright-core` e Edge nos testes; o MCP não foi usado |
| Context7 | plugin (usuário) | sim | sim (MCP conectado) | **não** (a documentação do Next foi lida no próprio `node_modules`) |
| code-review | plugin (usuário) | sim | sim | **sim** (seção 3.5) |
| Figma MCP | escopo local deste projeto (`~/.claude.json`) | sim | sim (conectado) | não, preservado |
| taste-skill | usuário (v2.1.4) | desativado no projeto | **não** | não |
| ui-ux-pro-max | projeto (cache) | desativado no projeto | não | não |
| code-simplifier | usuário (`claude-plugins-official`) | **estava ativo** (chave errada no projeto) | sim nesta sessão (agente listado) | não; corrigido, vale na próxima sessão |

Não foram instalados pacotes, skills, memória nem MCPs. Permissões e modo de execução não foram tocados. A CLI do Supabase foi apenas executada por `npx` (2.122.0), sem login.

## 5. Autenticação (e-mail e senha)

- **Antes:** não havia senha no aplicativo; o formulário só tinha o Google e o código, o hook e a RLS exigiam `provider = google`. As credenciais de e-mail e senha que você conhece são do painel do Supabase.
- **Agora:** `FormularioSenha` chama o Supabase Auth direto do navegador (limite de tentativas por quem tenta, e não pelo IP do servidor, que um terceiro poderia esgotar para bloquear você), e `concluirEntrada` (servidor) confere a conta autorizada e grava o carimbo de uso. `conta_autorizada()` aceita `google` e `email` (migração 6, nova, não reescreve nenhuma). O hook segue só Google (ninguém cria usuário por senha). Mesmo usuário e identificador: a senha é definida no usuário existente por `npm run definir:senha` (API de administração, senha oculta, exige exatamente 1 usuário e que seja o autorizado, só envia `password` e `email_confirm`). Sair e as 6 h valem para os dois modos. O Google continua ligado até a senha ser provada.
- **Recuperação:** `npm run definir:senha` de novo, em qualquer computador com o repositório e o `.env.local`; a chave secreta se recupera no painel. Detalhes e limites em `supabase/LEIA-ME.md`.
- **Verificado (Auth falso e banco local):** entrada correta, senha errada, conta fora da lista, provedor GitHub, limite de tentativas, usuário Google com senha (provider `google`) e provider `email`, aba de login velha, senha ausente da página, cookies, Sair; banco: RLS e hook para os dois provedores; script: sucesso, senha curta, mais de um usuário, usuário diferente, variáveis ausentes, saída sem senha nem chave.
- **Não verificado:** o comportamento real do Supabase (em especial o valor de `app_metadata.provider` no JWT de um usuário Google que ganhou senha; ambos os valores são aceitos por isso), a migração 6 no banco real, o provedor Email ligado, a entrada por senha de verdade.

## 6. Mapa real de persistência

| Grupo | Onde está hoje | Observação |
|---|---|---|
| Demandas, tarefas, etapas, datas, prazos, setor, arquivadas | **Supabase** (`public.demandas`, `public.tarefas`) | Valem para todos os aparelhos, relidas ao abrir e ao voltar à tela. Último a salvar vence |
| Resumo da rotina e execuções | **Supabase** (`resumos_operacionais`, `execucoes_rotina`) | Aparece no Início |
| Conta, sessão | Supabase Auth + cookies do navegador (`sb-...-auth-token`, `dmanda-ultimo-uso`) | Por navegador. No iPhone, o app instalado e o Safari têm cookies separados: entra-se de novo no app |
| Lista de conta autorizada | **Supabase** (`dmanda_privado.acesso_autorizado`) | Fora do Git |
| Tema claro ou escuro | **só o navegador** (`dmanda-tema`) | Não sincroniza entre aparelhos (aceitável: por aparelho) |
| Visão (cards, quadro, tabela, lista), ordenação, grupos fechados | **só o navegador** (`dmanda:ui`) | Idem |
| Menu lateral aberto ou recolhido | **só o navegador** (`dmanda:menu-aberto`) | Idem |
| Rascunhos de janelas | **só o navegador** (`dmanda:rascunhos`) | Ficam depois de "Sair"; não passam de um aparelho para outro |
| Filtros (texto, prazo, tipo) | só a memória da página | Somem ao recarregar |
| Fundo, 10 paletas, fontes, tamanhos, widgets | **não implementado** no aplicativo | Existem só no protótipo (fundo em imagem local ficaria no navegador) |
| Perfil (humor, energia, produtividade) | **não implementado** | Só protótipo, com dados fictícios |
| Entradas, Agenda, Documentos, IA, busca, avisos, notificações | **não implementado** | Telas "Em construção" |
| Dados de exemplo | **nenhum** no aplicativo | Dados fictícios só em `prototipo/` e no banco de teste local `.dados-teste/` (dev) |

**Sincronização entre dispositivos hoje:** só demandas e tarefas. Preferências e rascunhos NÃO sincronizam. Para a primeira versão: (a) manter preferências por aparelho (decisão do usuário, ver abaixo); (b) conflito de edição, recomendado antes de usar muito nos dois aparelhos; (c) fundo e paletas só quando Configurações for construída (aí decidir onde guardar).

## 7. Verificações e limitações (rodada final, depois da última mudança de código)

| Verificação | Resultado | O que é |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | tipos |
| `npx eslint src scripts` | exit 0 | lint |
| `npm run testar:regras` | 25 de 25 | regras puras (datas, sessão, conta, rotina, cookie, guarda de pré-carregamento) |
| `npm run testar:banco` | 90 de 90 | **PGlite** (banco local), não o Supabase real |
| `npm run testar:app` | 64 de 64 | navegador (Edge) + banco de teste local; inclui dois aparelhos e a cópia dos dados |
| `npm run testar:sessao` | 57 de 57 (3 execuções seguidas) | aplicação real contra **Auth falso**; entrada por senha, 6 h, Sair, falhas, `definir:senha` |
| `npm run build` | passa | produção |
| `next start` (fake env) | conferido | rotas públicas e protegidas, manifesto, ícones, cron 401, `DMANDA_BANCO=teste` recusado |
| `npm audit` | 0 vulnerabilidades | dependências |

Limitações: nada contra o Supabase real, o Google real, a Vercel, o iPhone/iPad/Safari reais nem 6 horas reais. As capturas de tela (login claro e escuro, ícones, área segura emulada) são minhas, **não** aprovação visual sua. D3 foi confirmado "vermelho" contra o código antigo (o mesmo cenário não mostrava aviso e o teste estourou o tempo). D4 foi confirmado por leitura do código (não havia gravação automática) e o teste correspondente só passa com a correção; o cenário antigo não chegou a rodar por ter parado antes, em D3.

## 8. PWA (primeira versão, só online)

- Pronto: `manifest.webmanifest` (`standalone`, `scope /`, ícones 192, 512 e maskable gerados da marca aprovada por `scripts/gerar-icones-pwa.mjs`), `apple-icon.png` (180), `appleWebApp`, `theme-color` por tema (lido dos tokens), área segura do iPhone, faixa "Sem conexão", gravações que falham com aviso e nunca viram "salvo", noindex.
- Deliberadamente fora: service worker, cache de respostas autenticadas, edição offline, conflitos, notificações. Necessidade não demonstrada; nada de dados privados em cache.
- Para conferir: Safari no iPhone/iPad > Compartilhar > Adicionar à Tela de Início; Edge/Chrome > instalar. Só testável de verdade com HTTPS publicado (ou rede local em http para ver o layout).

## 9. Cópia dos dados (backup)

- Implantado: menu do avatar > "Baixar cópia dos dados" (`GET /api/exportar`, só com sessão da conta autorizada, sem cache) gera `dmanda-copia-AAAA-MM-DD.json` versionado (`dmanda-exportacao`, `versao 1`) com demandas, arquivadas e tarefas. Dados reais: nunca no GitHub.
- Proposto: função SQL `importar_dados(jsonb)` chamada como o próprio usuário (RLS), atômica, ligada a "Importar" em Configurações; rotina semanal manual e antes de migrações.
- **Decisão sua (não bloqueia):** destino privado das cópias (por exemplo pasta privada do Drive ou OneDrive pessoal, ou pendrive) e frequência.

## 10. Bloqueios reais para publicação

1. Entrada por senha ainda não provada no Supabase real (depende das suas ações abaixo).
2. Migração 6 não aplicada no banco real.
3. Enquadramento do plano Hobby da Vercel (uso pessoal e não comercial) para o uso no trabalho da Prefeitura: decisão e confirmação suas.
4. Avaliação visual da aplicação React por você (Issue #2) e teste em aparelho real.
5. Cron diário só é observável depois de publicado.

Não bloqueiam: destino do backup, melhorias da seção 3.4.

## 11. Ações suas, em ordem

1. **No PowerShell, na pasta do projeto:** copie `.env.example` para `.env.local` e preencha (URL e chave pública: painel do Supabase > Project Settings > API; chave secreta: API Keys > Secret keys > "default"; `DMANDA_EMAIL_AUTORIZADO`; `CRON_SECRET` com 16 ou mais caracteres). Não cole valores no chat. Conferir sem revelar: comando em `supabase/LEIA-ME.md`.
2. **No prompt desta sessão:** `! npx supabase login` e depois `! npx supabase link --project-ref gmxoosvgfcydccyeudej`.
3. **Avise o Claude:** ele roda `db push --linked --dry-run`, depois a migração 6, e confere o banco.
4. **Painel do Supabase > Authentication > Sign In / Providers > Email:** ligar; mínimo de senha 12; "Confirm email" ligado; "Allow new users to sign up" desligado.
5. **No PowerShell:** `npm run definir:senha` (digite a senha duas vezes; não aparece na tela).
6. **`npm run dev`**, abrir `http://localhost:7100/login`, entrar com e-mail e senha; avise o Claude para conferir que o usuário e as demandas são os mesmos.
7. **Só depois:** painel > Google > desativar (sem excluir nada no Google Cloud) e `DMANDA_LOGIN_GOOGLE=nao` no `.env.local`.
8. **Decidir:** destino das cópias; enquadramento da Vercel.
9. **Publicar** (passos em `supabase/LEIA-ME.md`, "Publicação na Vercel") e **avaliar** a aplicação (Issue #2), inclusive instalando a PWA no iPhone e no iPad.
10. **GitHub:** criar a Issue consolidada (texto abaixo) ou instalar o `gh` portátil e `gh auth login`.

## 12. Roteiro curto de conferência (depois dos passos 1 a 6)

1. `/login` em claro e escuro: campos legíveis; senha errada mostra "E-mail ou senha incorretos."; a certa entra.
2. Criar uma demanda, digitar outra e recarregar no meio: o texto volta (rascunho).
3. Desligar a internet e gravar: faixa "Sem conexão" e aviso "Nada foi gravado"; religar: some.
4. Avatar > "Baixar cópia dos dados": baixa o JSON.
5. Abrir o app em dois aparelhos: o que um grava aparece no outro ao voltar para a tela.
6. Avatar > "Sair": volta ao login; entrar de novo.
7. iPhone: instalar na tela de início; conferir a barra inferior acima do indicador.

## 13. Texto da Issue consolidada (para criar no GitHub; sem dados pessoais)

**Título:** Auditoria única de 26/10/2026: entrada por senha, PWA e fechamento da primeira versão

**Corpo:** Relatório em `AUDITORIA.md` (branch de checkpoint). Vinculada a #1 (login e integração real), #2 (avaliação da aplicação), #3 (publicação e rotina) e #4 (cópia dos dados). Pendências, sem duplicar as Issues: (a) aplicar a migração 6 e provar a entrada por senha no real, depois desligar o Google (#1); (b) avaliação visual e teste em iPhone e iPad (#2); (c) enquadramento do plano Hobby e publicação (#3); (d) destino privado das cópias e importação (#4); (e) melhorias: conflito de edição, assinatura do carimbo de uso, service worker se houver necessidade. Critério de encerramento: escopo revisado, achados classificados, correções verificadas, pendências externas explícitas. Não abrir outra auditoria geral sem fato novo.
