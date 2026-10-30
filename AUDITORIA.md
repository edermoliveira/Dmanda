# Auditoria única do Dmanda (26/10/2026)

Relatório consolidado. **A seção 18 (27/10/2026) foi a auditoria completa pedida antes da primeira versão utilizável e substitui a regra de não auditar. Não abrir outra auditoria geral sem fato novo.** Pendências continuam nas Issues #1 a #4 (ver o fim, "Issue consolidada").

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
| code-simplifier | usuário (no trabalho `claude-plugins-official`; em casa `anthropic-plugin-directory`, ver seção 16) | **estava ativo no trabalho** (chave errada no projeto) | sim nesta sessão (agente listado) | não; corrigido, vale na próxima sessão |

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

## 16. Ambiente do Claude Code (conferência única de 26/10/2026, computador de casa)

Conferência do ambiente, não do aplicativo. Feita uma vez: inventário, ajustes justificados e conferência final. **Não abrir outra rodada sem fato novo.** Configurações pessoais e credenciais não foram lidas nem copiadas para cá.

**Retomada:** local e remoto idênticos em `b78f763` (resumo de encerramento `RESUMOCASA-26-10.md`), árvore limpa, nenhum pull necessário. `.env.local` de casa preservado: `npm run conferir:env` (a única forma de conferir, porque uma regra de usuário bloqueia a leitura direta de `.env*`) mostra tudo preenchido no formato esperado, provedor Email ligado, cadastro público desligado, 1 usuário autorizado. **Divergências com o resumo:** `DMANDA_LOGIN_GOOGLE` está vazia neste computador (o botão do Google ainda aparece) e o provedor Google segue LIGADO no painel. `npm run build` passou neste computador.

**Instalação.** Claude Code 2.1.310, instalação nativa, `C:\Users\Éder\.local\bin\claude.exe`; é o único executável encontrado (nenhum `claude` no npm global). A atualização automática do canal "latest" já baixou a 2.1.311 (`~/.claude/.last-update-result.json`: sucesso), que vale a partir da próxima abertura. Atualizações, modo auto e permissões gerais não foram tocados. Não há política gerenciada, `.mcp.json` nem `settings.local.json`.

**Inventário e estado efetivo** (instalado, habilitado, carregado nesta sessão e conectado são coisas diferentes):

| Componente | Origem e versão | Escopo | Estado efetivo | Decisão |
|---|---|---|---|---|
| Impeccable (skill 4.7.0, motor 0.1.16, 4 agentes: asset-producer, documenter, finish-reviewer, manual-edit-applier) | `.claude/skills` e `.claude/agents` (versionados; o binário `scripts/bin` é ignorado pelo Git e existe neste computador) | projeto | carregado na sessão; sem hooks; `.impeccable/config.json` com `telemetry: false` | manter; só avalia e refina a direção aprovada |
| systematic-debugging, test-driven-development, verification-before-completion | cópias em `.claude/skills` | projeto | carregadas na sessão | manter |
| code-review | `code-review-anthropics@anthropic-plugin-directory` (58267944f921-f52fa04c) | usuário | habilitado e carregado (`code-review:code-review`). O `code-review` nativo (diff local, níveis de esforço) coexiste com nome diferente: sobreposição parcial, sem conflito | manter |
| Playwright | `playwright@anthropic-plugin-directory` (MCP `npx @playwright/mcp@latest`) | usuário | habilitado e **conectado** (`claude mcp list`). Os testes do projeto usam `playwright-core` e o Edge, não este MCP | manter |
| Context7 | `context7@anthropic-plugin-directory` (MCP http) | usuário | habilitado e **conectado** | manter |
| Figma MCP | `https://mcp.figma.com/mcp` | local, só neste projeto (`~/.claude.json`) | **conectado**; nenhuma tarefa atual depende dele | preservar |
| taste-skill 2.1.4 | `taste-skill@taste-skill` | usuário | desativado (usuário e projeto); não aparece nesta sessão | manter desativado |
| ui-ux-pro-max 2.15.0 | `ui-ux-pro-max@ui-ux-pro-max-skill` | usuário (**habilitado**) e um registro de instalação de projeto | desativado **só pelo projeto**; `claude plugin list` neste diretório mostra os dois registros desativados; não aparece nesta sessão | manter desativado no projeto |
| code-simplifier 1.0.0 | **`code-simplifier@anthropic-plugin-directory`** (id instalado em casa) | usuário | desativado (usuário e projeto); o agente não aparece nesta sessão | manter desativado |
| Conectores do claude.ai (Canva, Notion, Adobe etc.) | conta | conta | `disableClaudeAiConnectors: true` no usuário; nenhum carregado | manter |
| Hooks | nenhum em `~/.claude/settings.json`, no projeto, nos plugins habilitados nem em skills e agentes do projeto | nenhum | nenhum ativo | nada a criar |
| Comandos e agentes pessoais | `~/.claude/commands`, `agents` e `hooks` não existem; `~/.claude/skills` só tem lixeira | nenhum | nenhum | nada |
| Instruções e memória | `CLAUDE.md` (18 mil caracteres), `AGENTS.md` (0,7 mil) e o índice da memória local (5 linhas) | projeto e usuário | carregados | memória reescrita, ver abaixo |

**Correção do code-simplifier recebida do trabalho.** No trabalho o plugin instalado é `code-simplifier@claude-plugins-official`; **em casa o instalado é `code-simplifier@anthropic-plugin-directory`** (conferido em `installed_plugins.json`, `plugin-directory-bindings.json` e `claude plugin list`). O `.claude/settings.json` do projeto já traz as **duas** chaves em `false`, então cobre os dois computadores e nada foi alterado. A chave que não existe numa máquina é inofensiva (`claude plugin list` não acusa erro). Manter as duas.

**Conflitos, resíduos e falhas concretas** (nenhum quebra a sessão):
1. `ui-ux-pro-max` está habilitado no escopo de **usuário** e só o projeto o desativa. Em outros projetos ele carrega. Isso cumpre "desativado no Dmanda"; por isso nada foi mudado.
2. `~/.claude/plugins/cache` guarda versões antigas de plugins instalados e pastas de plugins **não instalados** (Superpowers 6.4.2 com hook de `SessionStart`, `superpowers-dev`, `frontend-design`, `claude-code-setup`). Não constam em `installed_plugins.json` nem em `enabledPlugins`, não carregam nesta sessão (nenhuma skill do Superpowers aparece) e seus hooks não rodam. É só espaço em disco; nenhum cache foi apagado.
3. `~/.claude/.credentials.json.tmp.0d889b23` (30/08) é um **arquivo temporário de credenciais que sobrou**. Não foi aberto nem apagado. Recomendação 1 abaixo.
4. Restos inofensivos: `.ponytail-active` e `.ponytail-statusline-nudged` (sem plugin nem hook que os leia), `settings.json.bak-doctor`, `skills-backup-20261006`.
5. `/doctor`: o nativo é um comando interno do Claude Code. O Impeccable tem um subcomando próprio, `impeccable doctor`, que só confere os artefatos dele (`PRODUCT.md`, `DESIGN.md`, `.impeccable/`). **Nenhum dos dois foi executado**, para não entrar em ciclo de doctor, e nenhum resultado foi interpretado.
6. Sobreposição `code-review` (nativo) e `code-review:code-review` (plugin): funções vizinhas, nomes distintos. Mantidos pela definição acordada.
7. Ferramentas oficiais já suficientes, sem MCP novo: Supabase pela CLI (`npx supabase`, 2.122.0), GitHub pelo `gh` 2.103.0 (logado, Issues #1 a #4 abertas) e Vercel pelo site (não há CLI da Vercel instalada e não é necessária para o primeiro deploy).

**Ajustes feitos (locais e reversíveis):** nenhum arquivo de configuração do Claude Code precisou mudar, porque o estado já cumpre a definição. Foram feitos: cópia privada de segurança da memória local e das configurações de projeto e de usuário em `~/.claude/backups/dmanda-memoria-2026-10-26/` (fora do repositório, nunca vai para o Git); reescrita da nota de estado da memória (estava em 25/10, dizia Google exclusivo e 5 migrações) e nova nota `ambiente-claude-code-dmanda`; esta seção; a retomada em `SINCRONIZA-PROJETINHO.md`; duas frases desatualizadas de `supabase/LEIA-ME.md`.

**Contexto e inicialização (estimativas, não medidas):** sem acesso programático ao `/context`. Fixo em toda sessão: `CLAUDE.md` mais `AGENTS.md` com cerca de 19 mil caracteres (ordem de 5 mil tokens, estimativa) e a lista de skills, agentes e nomes de ferramentas adiadas (Figma cerca de 50 nomes, Playwright 25, Context7 2). O corpo das skills (`impeccable` 11,9 mil caracteres; as outras três de 3,6 a 9,6 mil) e dos 4 agentes só entra quando usados. Não houve medição de lentidão de inicialização e não se afirma economia de tokens.

**Limitações da conferência:** não abri `.env.local` (bloqueado de propósito); não rodei `/context`, `/doctor` nem `impeccable doctor`; a saúde dos MCPs vem de `claude mcp list` no momento da conferência; não inspecionei outros projetos nem conversas antigas; o desempenho real de cada plugin não foi medido.

**Recarga:** nada pede nova sessão, porque nenhuma configuração do Claude Code mudou. A memória reescrita vale a partir da próxima sessão. A versão 2.1.311, já baixada, vale na próxima abertura.

**Recomendações globais (nada aplicado; só com sua decisão):**
1. **Apagar o temporário de credenciais.** Necessidade: arquivo sensível sem uso. Impacto: nenhum no funcionamento (o `.credentials.json` ativo é outro arquivo). Mudança: excluir `C:\Users\Éder\.claude\.credentials.json.tmp.0d889b23`. Desfazer: não se desfaz; se algo falhar, o login se refaz pelo próprio Claude Code.
2. **Opcional: desativar `ui-ux-pro-max` também no escopo de usuário.** Necessidade: coerência com taste-skill e code-simplifier, já desativados globalmente. Impacto: em outros projetos o plugin deixa de carregar. Mudança: em `~/.claude/settings.json`, `"ui-ux-pro-max@ui-ux-pro-max-skill": false`. Desfazer: voltar para `true`. Não é necessário para o Dmanda.
3. **Opcional: limpar caches de plugins não instalados** (`plugins/cache/superpowers-dev`, `claude-plugins-official`, versões antigas). Necessidade: só espaço em disco. Impacto: nenhum se não estiverem instalados; o Claude Code baixa de novo se forem instalados. Desfazer: reinstalar o plugin. Não recomendo agora.


## 17. Fechamento da base Supabase do núcleo (27/10/2026)

**Escopo:** acesso por e-mail e senha ao usuário existente, saída e nova entrada, gravação e leitura persistentes de demandas e tarefas, restrições de acesso, interface de login coerente com os provedores e procedimento de cópia e recuperação com seus limites. **Não** inclui os demais módulos, a publicação nem a avaliação visual da aplicação React.

**Configuração remota conferida (`npm run conferir:env`, só leitura):** Email ligado, Google desligado (desativado pelo usuário no painel em 26/10/2026, à noite), cadastro público desligado, confirmação de e-mail exigida, 1 usuário, que é o autorizado. Migrações: 7 de 7 registradas (`supabase migration list --linked`), a 6 é `20261026000000`; nenhuma reaplicada, nenhuma migração nova.

**Teste manual do usuário (27/10/2026), vinculado ao banco por consulta de leitura:**
- A demanda TESTE pertencia ao usuário `e38872d3` (o mesmo de sempre), tinha 2 tarefas (`parecer`, `memorando`), etapa Vistos e versão 5 (cinco alterações pelo gatilho de versão), criada às 03:11:08Z e alterada até 03:11:37Z.
- O banco tem 4 sessões, todas desse usuário, e a mais recente foi criada às 03:11:54Z, depois da última gravação da demanda. Isso é coerente com sair e entrar de novo. O banco sozinho não prova o clique em Sair: essa parte vem da confirmação do usuário, e a prova técnica de Sair (cookies apagados, rotas barradas, nova entrada no mesmo usuário) já estava na seção 15 (19 verificações).
- O usuário confirmou que a demanda e as tarefas permaneceram depois do fluxo.
- Limpeza: removidas só essa demanda (por identificador) e suas 2 tarefas. Banco no fim: **0 demandas, 0 tarefas, 1 usuário, 1 e-mail na lista de acesso.**

**Interface de login:** o botão "Entrar com Google" passou a ficar oculto por padrão e só aparece com `DMANDA_LOGIN_GOOGLE=sim` (`src/lib/login.ts`, `src/app/(app)/login/page.tsx`, decisão 14 de `DECISOES.md`). Estados conferidos: variável ausente, vazia e `nao` ocultam; `sim` mostra (teste de regra e verificação real com a variável `sim`, ver abaixo). O login por senha, o Sair e as mensagens de erro não foram alteradas (`testar:sessao` 57 de 57, que cobre senha errada, conta fora da lista, aviso de saída e falhas do Auth). Nenhuma regra de acesso mudou (hook, RLS, conta autorizada) e o provedor Google não foi reativado. Em modo real, com o `.env.local` desta máquina (variável vazia), `/login` responde só com o campo de e-mail e senha.

**Cópias e recuperação:** `supabase/LEIA-ME.md`, seção "Cópia dos dados e restauração", reescrita com: o que a cópia contém e o que fica fora, como verificar o arquivo (comando que mostra só contagens), como recuperar, quadro de provas feitas e faltantes e a orientação de uso (uma cópia por dia de uso e antes de migrações). Quatro estados distintos: **exportação disponível: sim; recuperação demonstrada: só em banco local, com dados fictícios, mecanismo inalterado; armazenamento externo: não configurado; execução automática: não configurada.** Isto **não é** backup completo nem automático. Nada foi enviado a Drive, OneDrive, GitHub ou outro destino. Novidade: `dmanda-copia-*.json` ignorado pelo Git. Nenhuma restauração foi feita em ambiente real nesta etapa.

**Verificações desta etapa (só o afetado):**

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src scripts` | exit 0 |
| `npm run testar:regras` | 26 de 26 (a nova: botão do Google nos estados ausente, vazio, `nao`, `sim`, ` SIM `, `true` e `1`) |
| `npm run testar:sessao` (aplicação real contra Auth falso) | 57 de 57; a verificação de login passou a exigir ausência do botão e do "ou" |
| `/login` real com `DMANDA_LOGIN_GOOGLE=sim` | botão presente e formulário de senha presente (variável só no processo, `.env.local` intacto) |
| `/login` real com a variável vazia, `/api/exportar` sem sessão | sem botão do Google; exportação redireciona ao login (307) |
| `npm run build` | exit 0 |

Não repetidos, por justificativa: `testar:banco` e `testar:app` (SQL, migrações e telas internas não mudaram; o login só é exibido fora do modo de teste) e a rotina diária por HTTP real (prova de 25/10/2026 continua válida: `src/nucleo/rotina.ts` e a rota de cron não mudaram desde então e os diffs do `proxy.ts` não tocaram a isenção do cron).

**Veredito:** a base Supabase do núcleo de demandas e tarefas com login por e-mail e senha está **concluída** pelos critérios acima. Limitações que permanecem: expiração de 6 h reais, restauração em projeto real, destino e automação das cópias, cookie `dmanda-ultimo-uso` não assinado, intermitência não reproduzida do `testar:sessao`, senhas vazadas (plano pago), PowerShell 7 e outros terminais, avaliação visual da aplicação (Issue #2), publicação, agendamento e primeira execução automática (Issue #3).

## 18. Auditoria completa antes da primeira versão utilizável (27/10/2026)

**Base auditada:** branch `checkpoint/2026-10-23-ajustes-a-d`, partindo do commit `a0eaa46` (árvore limpa, igual ao remoto). Banco real não tocado nesta etapa; `producao` não avançou; `main` preservada.

### 18.1 Ferramentas realmente usadas
- **Ponytail** (`ponytail-audit`, auditoria do repositório inteiro): estava ausente. Foram copiados para `.claude/skills/ponytail-audit/` e `ponytail-review/` só os dois `SKILL.md`, sem alteração, da revisão `09c434a` (18/10/2026) de https://github.com/DietrichGebert/ponytail, licença MIT (`.claude/skills/LICENSE-ponytail.txt`, origem em `.claude/skills/ponytail-ORIGEM.txt`). Sem hooks, band, telemetria, comandos nem adaptadores. Os dois arquivos foram lidos por inteiro e o roteiro foi seguido à mão (mapa, fluxos de ponta a ponta, achado só com caso concreto, relatório com "Not checked"); a skill não foi invocada pelo comando de skills, e o relatório desta seção é o resultado dessa leitura, não a saída automática dela. A prioridade é a do usuário: Catalyst e escopo prevalecem.
- **Taste** (`taste-skill` 2.1.4, commit `6010f91`, MIT, já instalado no computador e **desativado no projeto**, permanece assim): lidos `SKILL.md`, `references/app-screens.md` (telas de trabalho) e `references/critique.md` (passes de olhar). Usado só como lista de passes na análise da interface (hierarquia, bordas, vazio, colisões, estados, celular), **sem** os scripts de geração de direção e sem trocar identidade, fontes, ícones ou biblioteca. Como a skill está desativada no projeto, não foi carregada pelo Skill tool: foi lida em arquivo e aplicada como roteiro. A pontuação por "jurado" não foi usada (não substitui a avaliação do usuário).
- **Método de verificação** (`verification-before-completion`, `systematic-debugging`) e testes próprios. O `code-review` não foi acionado: não havia diff de PR para revisar e a leitura completa o substituiu.

### 18.2 Cobertura efetiva
- **Lido por inteiro, linha a linha:** `src/proxy.ts`, `src/lib/{sessao,demandas,login,cores-barra}.ts`, `src/lib/supabase/*`, `src/servidor/{banco,demandas,entrar}.ts`, `src/nucleo/*`, rotas `api/{cron,exportar,sessao}` e `auth/callback`, `src/app/(app)` (layouts, páginas, login), `src/ui/*` (contexto, Casca, páginas, janelas, cartões, visões, MenuConta, Capsula, Icone), `manifest.ts`, `next.config.ts`, `vercel.json`, as 7 migrações e `supabase/restaurar-copia.sql`, `package.json`.
- **Por amostragem e por medição, não linha a linha:** CSS em `src/estilos/` (cerca de 180 KB; avaliado pelo resultado renderizado, por medições no navegador e por busca de cores soltas), `src/lib/icones-dados.ts` (dados), scripts de teste (executados, não relidos), `src/app/(antigo)` e `src/components` (só para provar que são código sem uso).
- **Interface:** 5 tamanhos (computador 1440, iPad horizontal 1180, janela média 1000, iPad vertical 820, celular 390) nos 2 modos, cerca de 14 telas e estados por combinação (Início e Início filtrado, quatro visões, janela nova com e sem erro, janela de edição, menu da conta, menu "+", Arquivo, Configurações, Mais), mais o login real em produção local. Medições automáticas: rolagem lateral, elementos fora da tela, controles sem nome, texto cortado, contraste (377 textos no claro e 369 no escuro). Foram **vistas por mim** cerca de 12 capturas (computador, iPad, janela média e celular, nos dois modos); as demais passaram só pelas medições. Banco de teste com dados fictícios; nada visto no Supabase real.
- **Não foi possível:** iPhone e iPad reais (instalação como PWA, download da cópia dentro do app instalado, teclado do iOS, toque de verdade), publicação na Vercel (região, cron e pacote das funções só se confirmam publicada), expiração real de 6 h e primeira execução automática, o efeito do vidro (desfoque) sobre o contraste calculado.

### 18.3 Achados
**Bloqueadores:** nenhum encontrado. Não declaro ausência absoluta de defeitos nem segurança garantida.

**Correções importantes (corrigidas e verificadas):**

| # | Local | Evidência | Consequência | Correção |
|---|---|---|---|---|
| I1 | `src/ui/contexto.tsx` (`recarregar` e a atualização ao voltar à tela) | Amostragem a cada 25 ms: em 8 de 8 cargas os cards apareciam por cerca de 200 ms com a data provisória de 2000 ("faltam 9789 d", "Chegou há -9796 d", "0 atrasadas"); com CPU 4 vezes mais lenta, durante toda a carga | Prazo errado na tela em toda abertura, mais visível no celular | A data de hoje entra no mesmo lote das demandas. Depois: 0 quadros errados em 8 cargas, inclusive com CPU 4 vezes mais lenta. Verificação nova no `testar:app` |
| I2 | `src/ui/janelas.tsx` | O Tab percorria a janela e saía para o fundo (24ª tecla); o Esc não devolvia o foco ao card | Quem usa teclado perde a posição; a janela é modal | Foco preso na janela e devolvido a quem a abriu. Verificações novas |
| I3 | `src/ui/paginas.tsx` | O campo diz "Filtrar demandas ( / )", mas nenhum código tratava a tecla (o protótipo aprovado trata) | Atalho anunciado que não existe | Atalho "/" como no protótipo. Verificações novas |
| I4 | `src/ui/Casca.tsx` | `suppressHydrationWarning` no `.app`, contra a regra de hidratação do projeto | Poderia esconder divergência real | Removido: 6 rotas em 4 contextos (claro, escuro, toque) sem aviso; `testar:app` sem erro de console |
| I5 | `next.config.ts` | O rastreio das funções de produção incluía o PGlite de teste (26 MB, 611 itens) em `/api/exportar` e `/api/cron/diaria` | Pacote maior e partida a frio mais lenta na Vercel, por código que só o teste local usa | `outputFileTracingExcludes`: de 611 para 261 itens |
| I6 | `next.config.ts` | `coresDaBarra()` lê `catalyst.css` com `turbopackIgnore` (não entra no rastreio sozinho). Hoje roda na build, mas, se alguma página rodar a leitura no servidor da Vercel, o arquivo não estaria no pacote | Possível erro 500 só em produção, **não confirmado** | `outputFileTracingIncludes` (preventivo, só confirmável publicado) |
| I7 | `src/app/(app)/login/page.tsx` | "Você saiu" e "o login vale por 6 horas" apareciam em vermelho negrito | O vermelho é reservado ao crítico; tom de alerta onde só há informação | Tom neutro; vermelho só para recusa, falha e saída não confirmada pelo servidor |
| I8 | `src/ui/janelas.tsx` | Variável calculada e descartada (`void n`) | Código morto | Removida |

**Melhorias posteriores (registradas; nenhuma bloqueia o primeiro uso):**

| # | O quê | Observação |
|---|---|---|
| P1 | Design antigo sem uso: `src/app/(antigo)` (rotas `/marca`, `/pecas`, `/tokens`, protegidas pelo login) e `src/components`: 18 arquivos, 1 463 linhas e 3 dependências (`lucide-react`, `tailwindcss`, `@tailwindcss/turbopack`), além da regra de CSS no `next.config.ts` e dos scripts `capturar` e `verificar:cores` | Só o código antigo os usa. Excluir exige a sua autorização; o histórico fica no Git |
| P2 | `npm run verificar:cores` aponta para um arquivo que não existe e acusa 173 cores soltas do design antigo | A regra "nenhuma cor solta" não tem verificação automática hoje; nenhuma cor solta foi achada nos `.tsx` da aplicação |
| P3 | Tabela na janela média (1000 px): coluna Assunto estreita (até 4 linhas) e Andamento cortado, com rolagem interna | Acabamento; avaliar no uso |
| P4 | Controles de áreas não construídas aparecem: busca global com "Ctrl K", sino, 4 de 6 itens do "+", 5 áreas "Em construção" | Segue o desenho aprovado. **Decisão sua:** manter ou ocultar até existirem |
| P5 | Regra do Início para "Aguardando retorno": a demanda só entra nos grupos quando faltam 3 dias ou menos para a data de acompanhamento; **sem data de acompanhamento, nunca entra**, mesmo com prazo vencendo hoje ou vencido (o card em Demandas mostra o prazo) | Regra já decidida em `DECISOES.md`; é lacuna, não defeito. **Decisão sua:** usar o menor entre prazo e acompanhamento, ou manter |
| P6 | Dois acessos ao Auth por operação (porta de entrada e ação); `getClaims()` evitaria um | Medir a latência depois de publicado |
| P7 | Sem Content-Security-Policy (o script do tema é embutido e exigiria hash ou nonce) | Risco baixo (usuário único, sem dados sigilosos); os cabeçalhos de segurança existentes ficam |
| P8 | Atualizações de patch: Next 16.4.3, React 19.3.1, PGlite 0.5.12 | `npm audit` de produção: 0 vulnerabilidades. Atualizar com os testes, em bloco próprio |
| P9 | Alvos de toque: o lápis das tarefas mede 28 px, e o texto da tarefa e o filtro, 25 px de altura (regra do projeto: 44 px de área de toque) | A área efetiva de toque não ficou medida de forma conclusiva; conferir no iPhone (Issue #2) |

### 18.4 Planos gratuitos (restrição financeira definida)
Vercel Hobby e Supabase Free; nada pago. Compatibilidade conferida na documentação oficial (fontes e efeitos em `supabase/LEIA-ME.md`, "Planos gratuitos"): limites técnicos do Hobby compatíveis (300 s por função, 100 implantações por dia, rotina diária, repositório de conta pessoal). **Dois pontos concretos:** (1) a regra de "uso não comercial" do Hobby cita "paid employee ... writing the code" sem esclarecer o caso de servidor público sem receita; se a Vercel entendesse que não cabe, o efeito seria a pausa da conta ou do deployment (mitigação gratuita: a cópia em arquivo; a pergunta ao suporte é opcional e não bloqueia); (2) o Supabase Free pode pausar o projeto depois de uma semana de pouca atividade e **não oferece backup para baixar**, então a cópia dos dados em arquivo é o único backup (Issue #4).

### 18.5 Verificações executadas nesta etapa

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit`, `npx eslint src scripts` | exit 0 nos dois |
| `npm run testar:regras` | 26 de 26 |
| `npm run testar:banco` | 118 de 118 (SQL lido e inalterado) |
| `npm run testar:app` | 74 de 74 (69 anteriores mais 5 novas: data provisória, foco preso, foco devolvido, atalho "/", barra no filtro), sem erro de console |
| `npm run testar:sessao` | 57 de 57 |
| `npm run build` e produção local (`npm run start`) | exit 0; `/login`, manifesto e ícones 200; `/demandas`, `/arquivo`, `/marca`, `/pecas`, `/tokens`, `/api/exportar` e `/api/sessao` redirecionam ao login; `/api/cron/diaria` 401 sem segredo e com segredo errado; cabeçalhos de segurança presentes; nenhum segredo nos arquivos do cliente; `npm audit` de produção sem vulnerabilidades |
| Medições no navegador | sem rolagem lateral, sem elemento fora da tela e sem controle sem nome nos 5 tamanhos e 2 modos; contraste mínimo 4,58 (claro) e 4,87 (escuro), todos acima de 4,5 (aproximação: o desfoque do vidro não entra no cálculo) |
| Não repetidos | `testar:senha-terminal` (nada do terminal mudou) e a rotina diária por HTTP real (código inalterado, prova de 25/10) |
| Limite do teste novo | a verificação da data provisória usa o mesmo amostrador que reproduziu o defeito; ela não foi executada contra o código antigo |

### 18.6 Parecer de prontidão
O código está **pronto para a publicação gratuita** no que a auditoria alcança: nenhum bloqueador, correções importantes aplicadas e verificadas, e os fluxos de entrada, gravação, leitura posterior, edição simultânea, dois aparelhos e cópia dos dados cobertos por testes e por leitura. **Dependem de coisas que só existem depois de publicar ou no seu aparelho:** pacote das funções e região na Vercel, cron registrado e primeira execução automática, instalação da PWA, download da cópia no app instalado, 6 h reais e a sua avaliação visual (Issue #2). Isto não é garantia de ausência de defeitos.

## 19. Revisão focada do bloco "sessão persistente, cadastro guiado e prazos" (29/10/2026)

Revisão deste bloco apenas; **não** é outra auditoria geral. Método: leitura do fluxo anterior antes de alterar, reprodução por teste, correção, repetição.

### 19.1 Problemas do fluxo anterior (registrados antes da alteração)
| # | Onde | Problema | Efeito |
|---|---|---|---|
| S1 | `src/proxy.ts`, `src/lib/sessao.ts` | A regra das 6 horas dependia de um cookie próprio (`dmanda-ultimo-uso`) renovado só em navegações; ausente, ilegível ou antigo valia como "expirado" e encerrava a sessão do Supabase mesmo válida | **Causa do relato do iPhone:** a PWA reaberta depois de horas caía no login |
| S2 | `src/proxy.ts` | `NextResponse.next({ request })` era criado **antes** da renovação: os cookies renovados não chegavam à página nem à ação da mesma requisição (renovação possivelmente em duplicidade, com o token de renovação já gasto) | Risco de revogação da sessão pelo Auth |
| S3 | `src/proxy.ts` | Os redirecionamentos (login, saída, negado) não levavam os cookies renovados | Token novo perdido, token antigo já gasto |
| S4 | `src/proxy.ts`, `src/servidor/banco.ts` | Qualquer falha de rede em `getUser()` virava "sem sessão": redirecionava ao login (proxy) ou dizia "Sua sessão terminou" (operação) | Perda aparente da sessão por queda de conexão |
| S5 | `FormularioSenha` + cookies do navegador | Na primeira entrada, os cookies são escritos por script no navegador; o Safari limita a 7 dias os cookies escritos por script | Possível novo login semanal no iPhone e no iPad |
| S6 | `src/proxy.ts` (`setAll`) | Ignorava o segundo argumento (cabeçalhos de cache) que o `@supabase/ssr` 0.12 entrega com os cookies | Respostas com cookie de sessão sem `Cache-Control: private, no-store` |
| C1 | `criar_demanda` | `numero` e `origem` ganhavam "s/n" e "Não informada" e `chegou_em` ganhava a data de hoje | Informação inventada; contagem de permanência falsa |
| C2 | Janela "Nova demanda" | Formulário único com muitos campos e prazo opcional só por "Sugerir 30 dias" (a partir de hoje, sem ajuste por fim de semana ou feriado) | Cadastro poluído; vencimento em dia sem expediente |
| C3 | Janela de edição | Abrir um card já abria um formulário completo de edição | Sem consulta organizada |
| P1 | Prazos | Uma única data de prazo, digitada; sem prazo original, sem ajuste, sem calendário | Vencimento podia cair em sábado, domingo ou feriado |

### 19.2 Descobertas durante a implementação (corrigidas)
- **Ação de entrada pulada:** com a sessão válida, o proxy redirecionava qualquer pedido a `/login`, inclusive o POST da ação `concluirEntrada` (a ação nunca rodava; antes o carimbo ausente impedia isso por acaso). Agora só redireciona GET.
- **Cookie idêntico não é regravado:** o SDK só emite `Set-Cookie` quando o valor muda; por isso a regravação no login usa `refreshSession()` (troca os tokens) e não `setSession()` (mesmos valores, nenhuma escrita).
- **Aviso de sessão encerrada perdido:** o SDK limpa os cookies de uma sessão recusada antes de o proxy checar "havia sessão?"; a leitura passou a vir antes da conferência.
- **Conta fora da lista no login:** a recusa não pode valer para as páginas públicas, senão a ação de entrada não responde "e-mail ou senha incorretos".

### 19.3 Verificações (resultado no fim do documento de continuidade, seção E)
Banco 164, regras 51, aplicação no navegador 131, sessão 78 (contagens finais: ver `CONTINUIDADE-DMANDA.md`). Ferramentas usadas neste bloco: ver `CONTINUIDADE-DMANDA.md`, seção C.

### 19.4 Texto pronto da Issue consolidada do bloco (o `gh` não está instalado neste computador)
Título: **Bloco: sessão persistente, cadastro guiado em três passos, consulta com lápis, prazo original e ajustado, dias indisponíveis**. Marco: "Base real e primeiro uso". Conteúdo: decisões 27 a 33 de `DECISOES.md`; migração `20261029000000_prazos_e_dias_indisponiveis`; testes (banco, regras, aplicação, sessão); pendências: avaliação no iPhone real (roteiro em `CONTINUIDADE-DMANDA.md`), avaliação visual do usuário (Issue #2), validação autenticada em produção (Issue #3). Critério de fechamento: avaliação do usuário no computador e no iPhone. Sem credenciais, e-mail pessoal nem dados reais.

## 20. Bloco de integração e correções (29/10/2026, tarde)

Escopo restrito (não é auditoria geral): três achados, cards e escala tipográfica. Cada defeito foi reproduzido antes da correção.

### 20.1 Achados reproduzidos e corrigidos
| # | Achado | Reprodução | Correção |
|---|---|---|---|
| 1 | Quadro criava demanda na etapa da coluna | Navegador: botão da coluna Vistos, aviso "criada e salva em Vistos" | Só a coluna Cadastro oferece o botão; a janela não recebe etapa |
| 2 | Passo 3 perdido na recarga; risco de duplicar | `dmanda:rascunhos` vazio e cadastro volta ao passo 1 | Rascunho do cadastro inteiro, identificador gravado antes da chamada, versão de origem |
| 3 | Legados abertos em fim de semana | Banco de teste: legado em sábado seguia no sábado | Migração 9 (nova), testada em dados antigos |
| 4 | Título do card em faixa ou cortado | Medição: 5 a 6 linhas necessárias, 1 visível, descrição em 3 | Título sem encolhimento por flexão; ajuste com prioridade explícita |
| 5 | Texto 15% menor | Linha de base medida: 3765 textos em 26 estados | Escala `--esc`; medição final 3795 textos, todos a 0,85 ou exceção |
| 6 | "Não informado" centralizado e cabeçalhos do Quadro desalinhados | Revisão visual | `dd.vazio` à esquerda; altura mínima igual nos cabeçalhos |
| 7 | Cadastro retomado com lista não carregada duplicaria (achado do `ponytail-review`) | Raciocínio sobre o fluxo e teste novo | Reutilizar sempre o identificador do rascunho |

### 20.2 Ferramentas efetivamente usadas
`ponytail-review` (invocado; 4 achados, todos tratados), Impeccable 4.8.0 `critique` em modo enxuto (detector limpo; sem subagentes isolados, por regra de não criá-los sem pedido), `systematic-debugging`, TDD e `verification-before-completion` como método. Ponytail conferido contra a origem por hash. Taste, ui-ux-pro-max e code-simplifier seguem desativados.

### 20.3 Observação de risco aceito
O piso de 10 px e o texto de descrição mono em 11 px no iPhone são o efeito direto dos 15% pedidos. A legibilidade em aparelho real só o usuário confirma (Issue #2). O ajuste é um número (`--esc`) ou o piso em `app.css`.

## 21. Bloco Entradas e as duas falhas de teste (30/10/2026)

Escopo restrito (não é auditoria geral): Entradas, Virar demanda, cópia versão 3 e a investigação de duas falhas dos testes.

### 21.1 Estado preservado antes de continuar
Interrupção do computador: conferidos `git status`, commits locais e último estado remoto (`origin/main` seguia em `2714937`); nenhum processo de teste deste projeto em execução (só o MCP do Playwright, que não é do projeto e não foi encerrado); migração 10 já aplicada no Supabase real, sem reaplicar nem reescrever; checkpoint local `53a7ed1` (identificado como incompleto, não publicado). Os resultados de testes existentes foram classificados como finais do estado de código então vigente.

### 21.2 Falhas investigadas
| # | Falha | Evidência | Causa | Tratamento |
|---|---|---|---|---|
| 1 | `testar:interface`: coluna Cadastro não encontrada | Linha do tempo da página (MutationObserver, leitura de `dmanda:ui`, ações do servidor): quando o auxiliar `ir` devolve, a tela ainda mostra Cards; a visão guardada (Quadro) aparece 40 a 200 ms depois, ao fim da fila de ações do servidor do início. Igual na versão anterior (`2714937`, extraída com `git archive`) | Leitura do teste antes da condição; comportamento pré-existente. Entradas acrescenta uma ação à fila (cerca de 27 ms), margem pior, não a causa | `ir` espera explicitamente a visão guardada (ou estado vazio, ou erro de carga), limite de 30 s e retrato da tela na falha; sem pausa fixa. 140 de 140 |
| 2 | `testar:sessao`: renovação do proxy na mesma requisição | Diagnóstico sem tokens: `/api/exportar` respondeu **500** com **1 renovação**; o Auth falso recebeu `rpc/listar_entradas` e respondeu 404 | O servidor falso só conhecia duas funções; a rota de cópia passou a ler Entradas. Não era renovação dupla nem propagação de cookies | Servidor falso responde lista vazia a `listar_entradas`; mensagem da verificação mostra status, renovações e rotas. 80 de 80 em duas rodadas |

Incerteza residual (falha 1): a falha original dentro da bateria completa não foi reproduzida; foi reproduzida e eliminada a condição que a explica.

### 21.3 Revisão `ponytail-review` (duas passagens)
1ª passagem (5 achados, tratados): rascunho falso ao esconder a tela sem alteração (corrigido e testado), ramo morto, volatilidade da função de cor, depuração esquecida, teste correspondente. Passagem final: um achado procedente (Virar demanda pela janela recusado por rascunho já salvo, estado antigo na verificação), corrigido e testado; dois itens de baixa prioridade registrados sem alteração (mais uma ação do servidor na abertura; ajuste de texto dos post-its a cada renderização).

### 21.4 Ferramentas efetivamente usadas
`ponytail-review` (invocado), `systematic-debugging` como método (causas antes das correções), Supabase CLI (dry-run, push, leitura) e Edge via `playwright-core` nos testes. O Impeccable não foi invocado neste bloco; a revisão visual foi por capturas (computador e iPhone, claro) e por medições de contraste, piso de 10 px, área de toque e rolagem nos cinco aparelhos emulados, claro e escuro. Taste, ui-ux-pro-max e code-simplifier seguem desativados.

### 21.5 Pendências (dependem do usuário)
Avaliação de Entradas na PWA (Issue #5, roteiro em `CONTINUIDADE-DMANDA.md` H); avaliação do Início, Tabela, Lista e demais itens listados em `ANDAMENTO.md`; PWA instalada; cron registrado; sessão por horas reais; restauração da cópia em projeto real; destino da cópia (Issue #4).

## 22. Ajustes depois da aprovação funcional de Entradas (30/10/2026)

Escopo restrito (não é auditoria geral): cinco ajustes de interface pedidos pelo usuário depois de testar Entradas no iPhone (commit `c932dac`, decisão 40). Os prints citados pelo usuário (IMG_4108 a IMG_4111) não estavam no computador; os defeitos foram diagnosticados pelo código e reproduzidos no navegador.

| # | Defeito | Causa (evidência) | Tratamento |
|---|---|---|---|
| 1 | Entrada abre com teclado | `Janela` focava o primeiro campo ao abrir e a janela da entrada nascia em edição | Janela de leitura com foco na própria janela; lápis liga a edição; rascunho não enviado em espera (nada enviado em silêncio) |
| 2 | Seletor do Arquivo sem texto | `@container` esconde `.tabs .tx` em telas estreitas e o seletor do Arquivo não tem ícones | Classe `so-texto` só nesse seletor |
| 3 | Campo Data fora do quadro | Controle nativo de data com largura mínima própria (a 360 px a coluna principal media 363 px: reproduzido) | Trilho `minmax(min(190px, 100%), 1fr)`, `min-width: 0`, `appearance: none` no campo |
| 4 | Lista confusa | Classes `.linha-c` e `.linha-m` compartilhadas, número com 80 px reservados, traço de porcentagem solto | Linha própria sob `.lista-dem`; regras antigas removidas |
| 5 | Selo Legal/Próprio nos cards | `ChipsRow` reaproveitado em Cards, Quadro e Início | Removido do resumo; mantido em Tabela, detalhes, dados, filtros e cópia |

Fora do bloco, observado: abaixo de 360 px a barra superior do app (marca e botões) ultrapassa a largura da tela (anterior a este bloco).

**Revisão `ponytail-review`** (invocada): sem achado que exigisse correção de comportamento. Um ponto de limpeza tratado (regra de área de toque do lápis, redundante porque a área já era de 44 px) e um teste acrescentado (Lista marcando a demanda atrasada); um risco sem prova: o rendering do campo de data no Safari real. **Impeccable:** crítica enxuta, detector sem achados; contraste e piso de 10 px medidos nos testes. **Limite:** o WebKit do Playwright no Windows não é o Safari do iPhone.
