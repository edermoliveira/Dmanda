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
2. **Dois aparelhos editando a mesma demanda (corrigido em 26/10/2026, migração 7):** a limitação original (o último a salvar vencia e uma tarefa criada no outro aparelho sumia) foi corrigida com versão por demanda e recusa, no banco, do salvamento da janela desatualizada (`DM409`), com aviso fixo e a edição local preservada. Ver seção 15. Resta: as operações pontuais seguem "último a gravar vence" por campo.
3. **Rascunhos e preferências ficam no navegador depois de "Sair"** (decisão anterior de preservar). Em computador compartilhado, os rascunhos (texto de demandas) permanecem.
4. **Sem service worker:** abrir a PWA sem internet mostra a tela de erro do navegador (só o uso com o app aberto tem aviso próprio).
5. **Cookies do Supabase não são `httpOnly`** enquanto o cliente do navegador for usado (hoje: login por senha e Google). É padrão do Supabase para esse modo.
6. **Design antigo no build** (`/marca`, `/pecas`, `/tokens`, `src/components`): só referência, atrás do login. Remover quando o usuário decidir.
7. **`scripts/verificar-cores.mjs`** olha um `globals.css` do design antigo: obsoleto, não faz parte dos testes acordados.
8. **eslint 9.39** avisa fim de suporte: atualizar depois (preferência).
9. **Projeto Supabase gratuito pode pausar** por inatividade. A rotina diária ajuda mas não garante; a cópia manual protege.
10. **Intermitência do `testar:sessao` (causa AINDA DESCONHECIDA).** Verificação: "as preferências do navegador (tema e outras) continuam depois de sair" (`scripts/testar-sessao.mjs`, passo 8, compara o `localStorage` com chave `dmanda*` antes e depois de sair). Evidência: falhou em cerca de 2 de 10 execuções e em 1 de 3 numa repetição de investigação, sempre uma verificação só, e **a mensagem da época não mostrava os valores**, então nunca se soube qual chave diferiu. O que mudou: (a) as chaves passaram a ser **ordenadas** antes de comparar (antes valia a ordem de enumeração do navegador, que não é garantida); (b) a mensagem de falha mostra antes, depois, uma segunda leitura 1 s depois, a URL e se o tema e a visão chegaram a ser gravados antes de sair. A verificação **não foi afrouxada**: continua exigindo igualdade exata entre as duas leituras (a segunda leitura só entra na mensagem). Resultado desde a mudança: 19 execuções seguidas sem falha (6 e 3 na sessão anterior, 10 em 26/10/2026 na rodada de validação). Se a taxa original (cerca de 20%) continuasse, 19 acertos seguidos teriam chance de uns 1,4%: isso favorece a hipótese da ordem de enumeração, **mas não a prova**. Tratar como causa provável, não resolvida. Se voltar, a mensagem nova dirá se foi valor diferente ou escrita tardia.
11. O prompt oculto de `definir:senha` foi testado em console de verdade (ConPTY do Windows, entradas fictícias, Auth falso): `npm run testar:senha-terminal`, 10 cenários (ocultação, confirmação, Ctrl+C, Backspace, senha curta ou longa, setas, chave recusada, senha fraca). Achou um defeito real (setas e Delete entravam na senha como texto), corrigido. Não foi testado em PowerShell 7 nem em outros terminais; a ocultação vem do modo bruto do Node, comum a todos.

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
- **Não verificado na auditoria (provado depois, ver seção 15):** o comportamento real do Supabase (em especial o valor de `app_metadata.provider` no JWT de um usuário Google que ganhou senha; ambos os valores são aceitos por isso), a migração 6 no banco real, o provedor Email ligado, a entrada por senha de verdade.

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
| `npm run testar:banco` | 118 de 118 (eram 103 na auditoria) | **PGlite** (banco local), não o Supabase real; inclui restauração da cópia (12) e a proteção de edição simultânea, com ciclo vermelho e verde (10 falhas com a conferência desligada) |
| `npm run testar:app` | 69 de 69 (eram 65) | navegador (Edge) + banco de teste local; inclui dois aparelhos, a edição simultânea, a cópia dos dados e a restauração do arquivo que a rota entrega |
| `npm run testar:sessao` | 57 de 57 (10 execuções seguidas em 26/10/2026, depois do script de senha mudar) | aplicação real contra **Auth falso**; entrada por senha, 6 h, Sair, falhas, `definir:senha` canalizado |
| `npm run testar:senha-terminal` | 10 de 10 | `definir:senha` em console de verdade (ConPTY), teclas fictícias, Auth falso |
| `npm run conferir:env` | testado com arquivos fictícios (formato errado, certo, vazio, ausente) | conferência do `.env.local` sem mostrar valores |
| `npm run build` | passou em `0a8aa3a`; `src/` e as migrações não mudaram desde então (só scripts e documentos) | produção |
| `next start` (fake env) | conferido | rotas públicas e protegidas, manifesto, ícones, cron 401, `DMANDA_BANCO=teste` recusado |
| `npm audit` | 0 vulnerabilidades | dependências |

Limitações: nada contra o Supabase real, o Google real, a Vercel, o iPhone/iPad/Safari reais nem 6 horas reais. As capturas de tela (login claro e escuro, ícones, área segura emulada) são minhas, **não** aprovação visual sua. D3 foi confirmado "vermelho" contra o código antigo (o mesmo cenário não mostrava aviso e o teste estourou o tempo). D4 foi confirmado por leitura do código (não havia gravação automática) e o teste correspondente só passa com a correção; o cenário antigo não chegou a rodar por ter parado antes, em D3.

## 8. PWA (primeira versão, só online)

- Pronto: `manifest.webmanifest` (`standalone`, `scope /`, ícones 192, 512 e maskable gerados da marca aprovada por `scripts/gerar-icones-pwa.mjs`), `apple-icon.png` (180), `appleWebApp`, `theme-color` por tema (lido dos tokens), área segura do iPhone, faixa "Sem conexão", gravações que falham com aviso e nunca viram "salvo", noindex.
- Deliberadamente fora: service worker, cache de respostas autenticadas, edição offline, conflitos, notificações. Necessidade não demonstrada; nada de dados privados em cache.
- Para conferir: Safari no iPhone/iPad > Compartilhar > Adicionar à Tela de Início; Edge/Chrome > instalar. Só testável de verdade com HTTPS publicado (ou rede local em http para ver o layout).

## 9. Cópia dos dados (backup)

- Implantado: menu do avatar > "Baixar cópia dos dados" (`GET /api/exportar`, só com sessão da conta autorizada, sem cache) gera `dmanda-copia-AAAA-MM-DD.json` versionado (`dmanda-exportacao`, `versao 1`) com demandas, arquivadas e tarefas. Dados reais: nunca no GitHub. É uma **exportação**: só vira "backup" depois de uma restauração demonstrada no projeto real.
- **Restauração (26/10/2026, em banco de teste, dados fictícios):** `supabase/restaurar-copia.sql`, em transação única, só para o usuário único, sem sobrescrever nada existente e sem duplicar. Testado: projeto novo com outro identificador de usuário, perda total no mesmo projeto, repetição, demanda existente preservada, formato errado, zero ou dois usuários, tarefa inválida (nada fica pela metade), acentos, aspas, cifrão e quebra de linha. O arquivo que a rota real entrega também é aceito. O teste achou um defeito real no primeiro rascunho do SQL (a cópia não traz a data de criação das tarefas e o `not null` quebrava), corrigido. **Não restaurado ainda em projeto Supabase real.**
- A cópia não traz conta, senha, lista de acesso, preferências do navegador, resumos e registro da rotina, nem a data de criação das tarefas. Detalhes e passo a passo em `supabase/LEIA-ME.md`.
- Adiado: tela "Importar" em Configurações (função SQL com a RLS do usuário). Rotina semanal manual e antes de migrações.
- **Decisão sua (não bloqueia):** destino privado das cópias (por exemplo pasta privada do Drive ou OneDrive pessoal, ou pendrive) e frequência.

## 10. Bloqueios reais para publicação

1. (Resolvido em 26/10/2026) Entrada por senha provada no Supabase real, ver seção 15.
2. (Resolvido em 26/10/2026) Migrações 6 e 7 aplicadas no banco real.
3. Enquadramento do plano Hobby da Vercel (uso pessoal e não comercial) para o uso no trabalho da Prefeitura: decisão e confirmação suas.
4. Avaliação visual da aplicação React por você (Issue #2) e teste em aparelho real.
5. Cron diário só é observável depois de publicado.

Não bloqueiam: destino do backup, melhorias da seção 3.4.

## 11. Ações suas, em ordem

*Atualização de 26/10/2026: os passos 1 a 6 estão concluídos e provados. O passo 7 está em andamento: o botão foi ocultado, falta desativar o Google no painel (ver seção 15).*

1. **Abra `.env.local` (na pasta do projeto, no Desktop) no Bloco de Notas** (já foi criado a partir do modelo, com a URL do projeto e o `CRON_SECRET` gerado) e preencha só 3 valores: chave pública (painel do Supabase > Project Settings > API Keys > Publishable key), chave secreta (mesma tela, Secret keys) e `DMANDA_EMAIL_AUTORIZADO`. Salve. Não cole valores no chat. Depois rode `npm run conferir:env` no PowerShell (ou avise o Claude, que roda): mostra só ok ou VAZIA, nunca os valores.
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

**Corpo:** Relatório em `AUDITORIA.md` (branch de checkpoint). Vinculada a #1 (login e integração real), #2 (avaliação da aplicação), #3 (publicação e rotina) e #4 (cópia dos dados). Pendências, sem duplicar as Issues: (a) desativar o Google no painel (migrações 6 e 7 aplicadas e entrada por senha provada no real em 26/10/2026, ver seção 15) (#1); (b) avaliação visual e teste em iPhone e iPad (#2); (c) enquadramento do plano Hobby e publicação (#3); (d) destino privado das cópias e importação (#4); (e) melhorias: assinatura do carimbo de uso, service worker se houver necessidade. Critério de encerramento: escopo revisado, achados classificados, correções verificadas, pendências externas explícitas. Não abrir outra auditoria geral sem fato novo.

## 14. Continuação: validação no Supabase real (bloco de 26/10/2026, em andamento)

**Preservado das validações reais anteriores (25/10/2026, Issue #1):** login Google real, hook ativo, gravação pela interface com sessão real, persistência, quatro visões, chamada HTTP local da rotina, segurança do banco nas 5 primeiras migrações. Nada disso foi refeito nem invalidado.

**(Superado, ver seção 15) Lista de antes: ainda NÃO validado no Supabase real:** migração 6, entrada por senha, `definir:senha` no usuário real, expiração de 6 h real, restauração da cópia em projeto real, publicação e primeira execução automática.

**Feito neste bloco, só localmente (sem credenciais do Supabase):**
- `.env.local` criado a partir do modelo (URL do projeto e `CRON_SECRET` gerado; chaves e e-mail ficaram para você). `npm run conferir:env` confere o formato e, depois, o painel (provedores, cadastro público, confirmação de e-mail, usuários) sem mostrar valores.
- `definir:senha` em console de verdade: 10 cenários, um defeito real achado e corrigido (setas e Delete entravam na senha). Mínimo e máximo agora são checados antes da confirmação.
- Intermitência do `testar:sessao`: causa ainda desconhecida; 10 execuções seguidas sem falha; diagnóstico reforçado (seção 3.4, item 10).
- Restauração da cópia em SQL (`supabase/restaurar-copia.sql`), testada em banco de teste com dados fictícios.
- Limitação de edição simultânea descrita com precisão (a tarefa criada no outro aparelho pode sumir) e coberta por teste de caracterização (corrigida depois, ver seção 15).

**Bloqueio daquele momento (resolvido, ver seção 15):** neste computador não há `.env.local` preenchido nem login da CLI do Supabase (a CLI responde `AccessTokenRequiredError`; `supabase/.temp` só tem `cli-latest`, sem projeto vinculado). A migração 6, a conferência do painel e a prova da senha dependem disso.


## 15. Conclusão da validação no Supabase real (26/10/2026)

**Preservado:** as validações reais de 25/10/2026 (login Google, hook, gravação, persistência, rotina, segurança do banco) e a seção 14 não foram refeitas nem invalidadas.

**Provado no Supabase real nesta etapa:**
- **Migrações:** histórico remoto 7 de 7. Foram aplicadas só a 6 e a 7, depois de dry-run, sem `reset`, sem reaplicar as cinco anteriores e sem tocar outros projetos da conta.
- **Autorização (SQL em transação desfeita):** a conta existente é aceita por `email` e por `google`; outro e-mail, `phone`, `github` e anônimo são recusados. O hook de cadastro segue só Google (`email` e outros endereços recusados).
- **Sem sessão (16 de 16):** páginas, `/api/exportar` e operações do servidor redirecionam ao login; a rotina diária recusa segredo ausente ou errado; senha errada, e-mail desconhecido e senha curta recebem a mesma mensagem, sem criar sessão nem usuário.
- **Entrada por senha (19 de 19, senha digitada pelo usuário numa janela do Edge):** mesmo usuário e identificador, último acesso atualizado, 1 usuário e 1 e-mail na lista de acesso antes e depois, carimbo de 6 h criado; senha incorreta recusada sem sessão; demanda TESTE com duas tarefas criada, editada, recarregada e conferida no banco; edição simultânea recusada com aviso e a tarefa do outro aparelho preservada; Sair apaga os cookies e barra a página protegida e a exportação; nova entrada com o mesmo usuário; exportação com demandas, tarefas e versão; limpeza só dos registros TESTE; nenhum erro de JavaScript.
- **Observação:** o banco real tem 0 demandas e 0 tarefas (os registros de 25/10 eram de teste). "Dados preservados" refere-se, portanto, a usuário, identidade e lista de acesso; a prova de dados usou registros TESTE, removidos no fim (o banco voltou a 0 e 0).

**Perda de tarefas, corrigida (migração 7):** a janela de edição gravava a lista inteira de tarefas e apagava as que não estavam nela. Agora cada demanda tem uma `versao` (gatilhos na demanda e nas tarefas), `salvar_demanda` exige a versão da abertura e o banco recusa tudo com `DM409` antes de gravar qualquer coisa (sem perda parcial). Na tela o aviso fica fixo, o texto digitado permanece, Salvar fica bloqueado e o rascunho lembra a versão. Sem tela de mesclagem. Verificação: banco local 118 de 118 (ciclo vermelho e verde: 10 falhas com a conferência desligada), navegador 69 de 69 (inclui dois aparelhos), e no real em transação desfeita (recusa, tarefa preservada, visitante barrado) e pela interface na prova acima. Alcance: o salvamento da janela de edição. As operações pontuais seguem "último a gravar vence" por campo.

**Google:** com a senha provada, o botão foi ocultado (`DMANDA_LOGIN_GOOGLE=nao`; conferido: a página de login não tem o botão nem o "ou" e mantém o campo de senha). **Pendente do usuário:** desativar o provedor Google no painel (Authentication > Sign In / Providers > Google), sem excluir usuário, identidade nem o projeto do Google Cloud. Depois, `npm run conferir:env` deve mostrar o Google desligado.

**Limitações e pendências que permanecem:** intermitência do `testar:sessao` (causa desconhecida; 19 execuções sem falha desde a mudança, não repetida nesta etapa porque a área não mudou); restauração da cópia só testada em banco local (demonstrar no projeto real exige dados TESTE e autorização); cookie `dmanda-ultimo-uso` não assinado (não é garantia inviolável); expiração de 6 h real; aviso do Supabase sobre proteção contra senhas vazadas (exige plano pago, não contratado); PowerShell 7 e outros terminais não testados; Vercel e primeira execução automática; iPhone e iPad reais; avaliação visual (Issue #2); Issue consolidada sem `gh` (texto na seção 13).
