# Auditoria do Dmanda: mapa do código e do frontend em uso

**Data:** 14/11/2026. **Código auditado:** `96f5b51` (`main` local, 6 commits à frente de `origin/main`, que está em `35c15a9`). **Dados:** só fictícios, no banco de teste descartável (`npm run dev:teste`). **Nada foi gravado no Supabase real, enviado ao GitHub ou publicado.**

Este documento é um retrato desta data. A fonte das decisões continua sendo `DECISOES.md`; o estado e a retomada, `CONTINUIDADE-DMANDA.md`. A auditoria anterior (`AUDITORIA.md`, 26 e 27/10/2026) continua valendo para o que não mudou; esta foi pedida pelo Éder junto com a decisão 75.

## Índice

1. [Resumo executivo](#1-resumo-executivo)
2. [Como a auditoria foi feita](#2-como-a-auditoria-foi-feita)
3. [Mapa funcional](#3-mapa-funcional)
4. [Arquitetura e integrações](#4-arquitetura-e-integrações)
5. [Auditoria visual em uso](#5-auditoria-visual-em-uso)
6. [Achados priorizados](#6-achados-priorizados)
7. [Estado das pendências citadas](#7-estado-das-pendências-citadas)
8. [Lacunas de documentação](#8-lacunas-de-documentação)
9. [Próximo trabalho, pela ordem de impacto](#9-próximo-trabalho-pela-ordem-de-impacto)
10. [Índice das capturas](#10-índice-das-capturas)

## 1. Resumo executivo

- **O que existe e funciona na `main` local:** Início (Para hoje, Nova urgência, filtros de prazo, humor), Demandas (quatro visões, filtros, cadastro guiado, detalhe por seção), Entradas, Agenda (Dia, Semana, Mês, eventos, dias indisponíveis), Arquivo, Perfil, Configurações (aparência e dias indisponíveis), busca global, botão "+", login por e-mail e senha, cópia dos dados em JSON e a rotina diária. Documentos e IA são páginas "Em construção".
- **Corrigido neste bloco (decisão 75):** o salto da página ao trocar de card no baralho (`64c6757`) e a composição de Dia e Semana da Agenda (`96f5b51`). O Mês não mudou (22 capturas idênticas byte a byte antes e depois).
- **A conferir primeiro (achado A1):** o código publicado (`origin/main`, `35c15a9`) usa as funções das migrações 16 a 20, e a documentação registra 15 migrações aplicadas no Supabase real, com cinco pendentes. Se elas não foram aplicadas, o Para hoje, o Perfil e a origem falham em produção. **Não conferido nesta sessão**, porque a instrução foi não operar o Supabase real.
- **Navegação:** 9 rotas, 3 aparelhos emulados e 2 temas (52 chegadas), sem rolagem horizontal e sem erro de console ou de página em nenhuma. Nove jornadas concluídas no computador e no celular emulados.
- **O que mais atrapalha o uso, fora o que foi corrigido:** a janela de humor que abre sozinha sobre o Início e o balão de humor que cobre os controles do topo no celular (A2 e A3); o seletor de visões do Mês com "Semana" cortado no celular (A4); alvos de toque abaixo de 44 px em alguns botões (A6); a janela de detalhe que não recebe o foco do teclado (A7).
- **Limite desta auditoria:** tudo foi emulado (Edge e WebKit do Playwright, no Windows). O Safari do iPhone e do iPad, a PWA instalada e a produção com sessão não foram exercitados.

## 2. Como a auditoria foi feita

| Meio | O que cobre | O que não cobre |
|---|---|---|
| Leitura do código (`src/`, `supabase/migrations/`, `scripts/`, `next.config.ts`, `vercel.json`) | Rotas, componentes, funções, validação, persistência, integrações | Comportamento em execução |
| Varredura no navegador (Edge, Playwright): 9 rotas em computador 1360x800, iPad em pé 820x1180 e celular 390x844, claro e escuro, com os lembretes ligados | Rolagem horizontal, itens fora da tela, área de toque (sondagem a 21 px do centro), nomes acessíveis, textos cortados, fim da rolagem contra a barra de baixo, erros de console | Contraste (coberto pelas suítes `testar:config` e `testar:agenda`), Safari real |
| Jornadas no navegador (Edge), computador e celular | Busca, detalhe e edição, visões e tarefa, evento e dia indisponível, anotação, cadastro guiado, Perfil, preferência com recarga, Arquivo | Login real, exportação, rotina diária, dois aparelhos |
| WebKit do Playwright (motor do Safari no Windows) | Dia e Semana a 390, 375 e 320 px, texto a 100% e 125%; o salto do baralho | Gesto com o dedo, seletor nativo de data, área segura, barra do Safari |
| Suítes do projeto rodadas hoje | `testar:baralho` 91, `testar:agenda` 389, `testar:config` 175, `testar:interface` 148, todas sem falha; `tsc`, `eslint` (0 erros, 10 avisos antigos), `verificar:cores` | As demais suítes não foram repetidas (sem mudança nos arquivos que elas cobrem) |
| Produção, sem sessão (14/11/2026, 22:55 GMT) | `GET /login` 200, `/` 307 para `/login`, `/api/cron/diaria` 401 sem segredo, manifesto 200, cabeçalhos de segurança, região `gru1` | Qualquer tela com sessão, o banco real, a execução do cron |

## 3. Mapa funcional

### 3.1 Rotas e telas

| Rota | Arquivo da rota | Componente | Situação |
|---|---|---|---|
| `/` | `src/app/(app)/(painel)/page.tsx` | `PaginaInicio` (`src/ui/paginas.tsx`), `ParaHoje` (`src/ui/para-hoje.tsx`), `RegistroNoInicio` (`src/ui/perfil.tsx`) | Funciona |
| `/demandas` | `.../demandas/page.tsx` | `PaginaDemandas` (`paginas.tsx`), `Cards`, `Quadro`, `Tabela`, `Lista` (`src/ui/visoes.tsx`) | Funciona |
| `/entradas` | `.../entradas/page.tsx` | `PaginaEntradas` (`src/ui/entradas.tsx`) | Funciona |
| `/agenda` | `.../agenda/page.tsx` | `PaginaAgenda` (`src/ui/agenda.tsx`) | Funciona |
| `/arquivo` | `.../arquivo/page.tsx` | `PaginaArquivo` (`paginas.tsx`), `ListaEntradasArquivadas` (`entradas.tsx`) | Funciona |
| `/config` | `.../config/page.tsx` | `PaginaConfig` (`src/ui/config.tsx`), `SecoesAparencia` (`src/ui/config-aparencia.tsx`), `SecaoPerfilConfig` (`perfil.tsx`) | Funciona (aparência, Perfil, dias indisponíveis) |
| `/documentos`, `/ia` | `.../documentos/page.tsx`, `.../ia/page.tsx` | `EmConstrucao` (`paginas.tsx`) | Em construção |
| `/mais` | `.../mais/page.tsx` | `PaginaMais` (`paginas.tsx`) | Funciona (atalhos do celular e do iPad) |
| `/login` | `src/app/(app)/login/page.tsx` | `PainelLogin`, `FormularioSenha`, `BotaoGoogle` | Funciona; Google oculto por padrão |
| `/auth/callback` | `src/app/auth/callback/route.ts` | retorno do provedor | Mantido para o Google desativado |
| `/api/cron/diaria` | `src/app/api/cron/diaria/route.ts` | rotina diária | Ver 4.3 |
| `/api/exportar` | `src/app/api/exportar/route.ts` | cópia dos dados em JSON | Funciona no teste |
| `/api/sessao` | `src/app/api/sessao/route.ts` | conferência da sessão | Funciona |
| `/manifest.webmanifest` | `src/app/manifest.ts` | manifesto da PWA | 200 em produção |
| `/marca`, `/pecas`, `/tokens` | `src/app/(antigo)/` | páginas do design antigo (20/10/2026) | Só referência; continuam sendo construídas e servidas (achado A12) |

A casca de todas as telas é `Casca` (`src/ui/Casca.tsx`): menu lateral (computador), barra de baixo (iPad e celular), busca, avisos, tema, menu da conta e o botão "+".

### 3.2 Janelas, menus e painéis

| Peça | Onde abre | Componente | Observação |
|---|---|---|---|
| Nova demanda (três passos) | "+", Demandas, atalho | `JanelaNova` (`src/ui/cadastro.tsx`) | A demanda é criada ao fim do passo 2, em Cadastro |
| Detalhe da demanda | card, linha, busca | `JanelaDemanda`, `Detalhe`, `Bloco`, `MenuAcoes` (`src/ui/detalhe.tsx`) | Lápis por seção: identificação, descrição, chegada, andamento, tarefas |
| Nova tarefa | "+" | `JanelaTarefa` (`src/ui/janelas.tsx`) | |
| Entrada | Entradas, "+", atalho N | `JanelaEntrada` (`entradas.tsx`) | Salvamento automático com rascunho no aparelho |
| Virar demanda | janela da entrada | `JanelaNovaDeEntrada` (`janelas.tsx`), `useVirarDemanda` | Demanda e vínculo na mesma transação |
| Evento | Agenda, "+" | `JanelaEvento` (`src/ui/evento.tsx`) | |
| Dia indisponível | Agenda, Configurações | `JanelaDiaIndisponivel`, `CamposDiaIndisponivel` (`src/ui/dia-indisponivel.tsx`) | |
| Busca global | lupa, Ctrl K | `Busca` (`src/ui/busca.tsx`) | |
| Menu "+" | botão flutuante ou da barra | `Casca.tsx` | Nova entrada, Nova demanda, Novo evento, Nova tarefa; Documento e Chat com a IA "em breve" |
| Menu da conta | avatar | `MenuConta` (`src/ui/MenuConta.tsx`) | Perfil, Baixar cópia dos dados, Sair |
| Perfil | menu da conta, Início | `PerfilGaveta`, `Gaveta` (`perfil.tsx`) | Humor e ritmo, gráfico e histórico |
| Completar os últimos dias | abre sozinha na entrada do dia, Início, Perfil | `JanelaCompletar` (`src/ui/lembretes.tsx`) | Achado A2 |
| Balão de humor | entrada do dia e a cada 3 horas de uso | `Lembretes` (`lembretes.tsx`) | Achado A3 |
| Menu de etapas | card, baralho | `MenuMover` (`visoes.tsx`) | |
| Gaveta do dia (Mês) | célula do Mês, computador e iPad | `GavetaDia` (`agenda.tsx`) | No celular é `PainelDia`, abaixo da grade |
| Filtros de Demandas | botão Filtros | `PainelFiltros` (`paginas.tsx`) | Origem, tipo, ano, prazo |

### 3.3 Fluxos principais

Em todos os fluxos de gravação, a chamada sai do contexto (`ProvedorApp`, `src/ui/contexto.tsx`), passa por uma ação de servidor (`src/servidor/*.ts`), é validada em `src/nucleo/validacao.ts`, vira uma função SQL em `src/nucleo/operacoes.ts` e volta como `Resultado` (`executar`, que nunca finge sucesso). A falha vira aviso (`avisar`, com `explicarFalha`) e o texto digitado fica no rascunho do aparelho.

| Fluxo | Componente e entrada | Validação | Gravação (ação de servidor e função SQL) | Atualização da interface | Falhas tratadas | Testes |
|---|---|---|---|---|---|---|
| Cadastrar demanda | `JanelaNova`, `criar` | `validarDados` | `criarDemanda`, `criar_demanda` (identificador gerado no aparelho antes da chamada) | `aplicar` na lista; segue para o passo 3 | Resposta perdida, recarga, lista não carregada, versão mudada | `testar:interface`, `testar:app`, `testar:resistencia` |
| Editar seção do detalhe | `Detalhe`, `salvar` | `validarDados`, `validarTarefas` | `salvarDemanda`, `salvar_demanda` (com a versão) | `aplicar`; aviso por seção | Conflito de versão (traz a atual e mantém o digitado) | `testar:detalhe`, `testar:app` |
| Mover de etapa | cards, menu, baralho; `mover` | `enumerado` | `moverEtapa`, `mover_etapa` | `aplicar` | Aviso de erro; o card fica onde estava | `testar:app`, `testar:baralho` |
| Concluir e reabrir | `AcaoCard`, baralho; `concluir`, `reabrir` | `id` | `concluir_demanda`, `reabrir_demanda` | `aplicar`; a vaga do Para hoje é liberada | Confirmação quando há tarefas pendentes (baralho) | `testar:app`, `testar:baralho` |
| Tarefas | `ItemTarefa`, `NovaTarefaInline`, `EditorTarefas`; `adicionarTarefa`, `editarTarefa`, `marcarTarefa`, `excluirTarefa` | `texto` (até 1000) | `adicionar_tarefa` (com a identidade da tentativa), `editar_tarefa`, `marcar_tarefa`, `excluir_tarefa` | `aplicar` | Resultado incerto na resposta perdida, sem duplicar | `testar:interface`, `testar:banco` |
| Arquivar, recuperar, excluir | detalhe, Arquivo; `arquivar`, `desarquivar`, `excluir` | `id`, confirmação | `arquivar_demanda`, `desarquivar_demanda`, `excluir_demanda` | listas ativas e arquivadas | Excluir pede confirmação | `testar:app`, `testar:ajustes` |
| Para hoje | `ParaHoje`, `Pilha`; `sincronizarParaHoje` | `validarCandidatas` | `atualizarParaHoje`, `atualizar_para_hoje` | três vagas; ordem da pilha só no aparelho (`dmanda:para-hoje-ordem`) | Duas sessões, virada do dia | `testar:origem`, `testar:baralho` |
| Entradas | `JanelaEntrada`; `criarEntrada`, `salvarEntrada`, `fixarEntrada`, `arquivarEntrada`, `desarquivarEntrada`, `excluirEntrada` | `validarEntrada` | funções `*_entrada` | `aplicarEntrada`; estado "Salvando", carimbo "Criada em" | Sem conexão, conflito de campos, resposta perdida | `testar:entradas` (179), `testar:ajustes` |
| Virar demanda | `useVirarDemanda`; `criar` com `entradaId` | `validarDados` | `criarDemandaDeEntrada`, `criar_demanda_de_entrada` | a entrada sai da lista e fica ligada | Cancelar, repetir, falha, bloqueio por outro cadastro | `testar:entradas` |
| Eventos | `JanelaEvento`; `criarEvento`, `salvarEvento`, `excluirEvento` | `validarEvento`, `erroDoEvento` | funções `*_evento` (identificador gerado no aparelho, versão) | `aplicarEvento`; avisos de hoje | Sobreposição, clique repetido, rede, edição simultânea | `testar:agenda` |
| Dia indisponível | `useGravarDia`; `salvarDia`, `excluirDia` | `validarDia` | `salvar_dia_indisponivel`, `excluir_dia_indisponivel` | `aposCalendario` (prazos recalculados no banco) | Rascunho, envio repetido travado; **sem identidade da tentativa** (ver 7.2) | `testar:agenda`, `testar:config`, `testar:banco` |
| Humor | `FormularioRegistro` (`src/ui/escala.tsx`), `JanelaCompletar`; `registrarDias` | `validarRegistros` | `registrar_dias`, `listar_registros_dia` | `recarregarRegistros`; log sem o valor | Correção de até 5 dias, duas abas | `testar:perfil` |
| Origem e tipo | `SeletorOpcao` (`src/ui/seletor.tsx`); `criarOpcao` | `validarOpcao` | `criar_opcao`, `listar_opcoes` | opções no seletor | Nome repetido devolve a existente | `testar:origem` |
| Busca | `Busca`; `buscar` (`src/lib/busca.ts`) | texto simplificado | só leitura do que já está carregado | abre a janela do resultado | Arquivados lidos sob demanda | `testar:busca` |
| Aparência | `SecoesAparencia`; `mudarAparencia`, `setModo`, `restaurarAparencia` | `aparenciaGuardada` | só no aparelho (`dmanda:aparencia`, `dmanda-tema`) | variáveis CSS na casca | Armazenamento corrompido | `testar:config` (175) |
| Entrar e sair | `FormularioSenha`, `concluirEntrada` (`src/servidor/entrar.ts`), `sairDaConta` | `contaAutorizada` (`src/lib/sessao.ts`) | Supabase Auth | redireciona; `proxy.ts` confere a sessão | Senha errada, rede, token vencido ou já usado | `testar:sessao` (Auth falso) |
| Cópia dos dados | menu da conta, `GET /api/exportar` | sessão | leitura | baixa o JSON (versão 4) | Sem sessão | `testar:app`, `testar:banco` |

### 3.4 Funções auxiliares, por módulo

| Módulo | Papel | Funções principais |
|---|---|---|
| `src/lib/demandas.ts` | Tipos e regras da demanda | `ETAPAS`, `filtrar`, `ordenar`, `porGrupo`, `grupoFiltro`, `atrasada`, `permanencia`, `contagemRetorno`, `esperaPrefeita`, `proximaTarefa`, `percentual`, `titulo`, `plural` |
| `src/lib/prazos.ts` | Prazo original e ajustado | `somarDias`, `prazoPorDias`, `ajustarPrazo`, `diaDaSemana`, `dataComSemana`, `BOTOES_PRAZO` |
| `src/lib/agenda.ts` | Calendário, marcos e carga | `gradeMes`, `semanaDe`, `colunaNaSemana`, `diaNaoUtil`, `marcosPorDia`, `itensDoDia`, `cargaPorDia`, `nivelDaCarga`, `panorama`, `pendenciasSemPrazo`, `descreverDia`, `rotuloSemana`, `dataPorExtenso` |
| `src/lib/eventos.ts` | Eventos e avisos | `erroDoEvento`, `ordenarEventos`, `seSobrepoem`, `sobrepostosA`, `avisosDeHoje`, `minutosAgora` |
| `src/lib/para-hoje.ts` | Vagas e baralho | `elegiveisParaHoje`, `vagasAbertas`, `precisaCompletar`, `novasUrgencias`, `ETAPA_SEGUINTE`, `etapaDeEspera`, `ordemDaPilha`, `ativoParaOFim`, `ultimoParaAFrente`, `gestoValido` |
| `src/lib/entradas.ts` | Anotações | `estadoDe`, `tagsDe`, `filtrarEntradas`, `ordenarEntradas`, `paraDemanda`, `diferencas`, `camposEmConflito`, `carimbo` |
| `src/lib/registros.ts` e `src/lib/lembretes.ts` | Humor e lembretes | `emJanelaDeCorrecao`, `diasPendentes`, `serieDoPeriodo`, `fraseDoDia`; `tique`, `resolver`, `lerEstado` |
| `src/lib/busca.ts` | Busca global | `buscar`, `simplificar`, `palavrasDa` |
| `src/lib/aparencia.ts` | Preferências visuais | `aparenciaGuardada`, `variaveisAparencia`, `temaDoModo`, `PALETAS`, `CONJUNTOS` |
| `src/lib/armazenamento.ts` | Leitura segura do aparelho | `visaoGuardada`, `ordemGuardada`, `gruposGuardados`, `rascunhosGuardados`, `textosGuardados` |
| `src/lib/sessao.ts` | Conta autorizada | `contaAutorizada`, `emailAutorizado`, `situacaoDoErroAuth`, `ehCookieDeSessao` |
| `src/lib/documentos.ts` | Ano e opções do documento | `anoDoDocumento`, `chaveOpcao` |
| `src/ui/ajuste.ts`, `src/ui/visoes.tsx` | Ajuste de cards ao espaço | `emLote`, `pendentes`, `ajustar`, `useAjustar` |
| `src/ui/baralho.tsx` | Pilha do celular | `Baralho`, `BaralhoSimples`, `CardsDeDemandas`, `useArrasto`, `useModo` |
| `src/ui/coluna-fixa.ts` | Coluna lateral que acompanha a página | `useColunaFixa`, `limitesDaColuna` |
| `src/ui/campos.tsx` | Campos do cadastro e do detalhe | `CamposIdentificacao`, `CamposChegadaPrazo`, `EditorTarefas`, `PreviaPrazo`, `novaTentativa` |

### 3.5 Preferências e o que fica no aparelho

| Chave | O que guarda | Quem lê |
|---|---|---|
| `dmanda-tema` | Claro, Escuro ou Sistema | `contexto.tsx` |
| `dmanda:aparencia` | Paleta, fontes, tamanhos, fundo, movimento | `contexto.tsx`, `aparencia.ts` |
| `dmanda:ui` | Visão de Demandas, ordem e grupos | `contexto.tsx`, `armazenamento.ts` |
| `dmanda:menu-aberto` | Menu lateral aberto ou recolhido | `contexto.tsx` |
| `dmanda:agenda` | Visão, filtros e opções da Agenda | `agenda.tsx` |
| `dmanda:rascunhos` | Texto digitado e identificadores das tentativas | `contexto.tsx`, janelas |
| `dmanda:para-hoje-ordem` | Ordem da pilha do dia | `para-hoje.tsx` |
| `dmanda:avisos-vistos` | Avisos de evento dispensados | `contexto.tsx` |
| `dmanda:lembretes`, `dmanda:registro-gravado` | Relógio dos lembretes (sem valor de humor) | `lembretes.tsx` |
| `dmanda-ultimo-uso`, `dmanda-exportacao`, `dmanda-lembretes` | Chaves que aparecem uma vez no código; uso não analisado nesta auditoria | a conferir |
| IndexedDB (imagem de fundo) | Previsto no design; não há uso em `src/` hoje | Lacuna (seção 8) |

## 4. Arquitetura e integrações

### 4.1 Camadas

| Camada | Arquivos | Papel |
|---|---|---|
| Porta de entrada | `src/proxy.ts` | Renova a sessão do Supabase nos cookies, confere o e-mail autorizado, responde 503 em falha de rede sem apagar a sessão |
| Estado compartilhado | `src/ui/contexto.tsx` (`ProvedorApp`) | Demandas, entradas, eventos, dias, registros, opções, vagas, janela aberta, aviso, aparência, rascunhos |
| Ações de servidor | `src/servidor/demandas.ts`, `entradas.ts`, `agenda.ts`, `perfil.ts`, `carga.ts`, `entrar.ts` | Transporte entre a interface e as operações; `cargaInicial` lê tudo de uma vez |
| Operações | `src/nucleo/operacoes.ts`, `validacao.ts` | Validação e chamada das funções SQL; reutilizáveis pela futura IA |
| Transporte do banco | `src/servidor/banco.ts`, `banco-teste-base.mjs` | Supabase real ou PGlite de teste (`DMANDA_BANCO=teste`, recusado em produção) |
| Banco | `supabase/migrations/` (20 arquivos) | Funções SQL com RLS pela conta autorizada |
| Rotina | `src/nucleo/rotina.ts`, `src/app/api/cron/diaria/route.ts` | Rotina diária com `CRON_SECRET` |

### 4.2 Variáveis de ambiente (só os nomes)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DMANDA_EMAIL_AUTORIZADO`, `CRON_SECRET`, `DMANDA_LOGIN_GOOGLE`, `DMANDA_BANCO`, `DMANDA_PASTA_TESTE`, `DMANDA_SEM_LEMBRETES`, `DMANDA_ORIGENS_DEV`, `NODE_ENV`, `PORT`.

### 4.3 Situação de cada integração

| Item | Evidência | Situação em 14/11/2026 |
|---|---|---|
| Next.js 16.4.4, React 19.3.1 | `package.json` | Ativo |
| Banco de teste (PGlite) | `src/servidor/banco-teste-base.mjs`, suítes | Só local; recusado em produção (`testar:medicao-local`) |
| Supabase (banco e Auth) | `src/servidor/banco.ts`, `src/lib/supabase/`, `supabase/LEIA-ME.md` | Ativo no código publicado. Documentado: 15 migrações aplicadas até 02/11/2026. **As migrações 16 a 20 constam como pendentes na documentação** (achado A1). Não conferido hoje |
| Login por e-mail e senha | `src/servidor/entrar.ts`, `FormularioSenha.tsx` | Ativo; validado no real em 26 e 27/10/2026 (documentado) |
| Login Google | `BotaoGoogle.tsx`, `DMANDA_LOGIN_GOOGLE` | Desativado; botão oculto por padrão |
| Vercel (Hobby, `gru1`) | `vercel.json`; `GET /login` 200 hoje | Ativo; só a `main` publica. Serve `origin/main` (`35c15a9`), não os 6 commits locais |
| Rotina diária (cron 09:00 UTC) | `vercel.json`, `route.ts`; 401 sem segredo hoje | Configurada; **primeira execução automática sem confirmação registrada** (Issue #3) |
| Cópia dos dados (JSON, versão 4) | `src/app/api/exportar/route.ts`, `supabase/restaurar-copia.sql` | Ativa; restauração testada só no banco de teste. Cópia privada automática: proposta (Issue #4) |
| PWA | `src/app/manifest.ts`, ícones | Manifesto 200 em produção; instalação e uso no iPhone: confirmados pelo Éder em 30/10/2026; primeira versão só online |
| Prévia pela rede local | `next.config.ts` (`allowedDevOrigins`, `efdc761`) | Só local, só no banco de teste, só com `DMANDA_ORIGENS_DEV` |
| Clima, mini calendário | branches `bloco/inicio-perfil-clima` e `bloco/mini-calendario-domingo` | Em branch paralela; fora da `main` |
| Google Calendar e Drive, IA, documentos | `FUNCIONALIDADES.md` | Proposta; sem código |
| Serviços externos em execução no cliente | busca em `src/` | Nenhum (sem telemetria, sem fontes ou scripts de terceiros carregados em tempo de uso além do que o Next empacota) |

## 5. Auditoria visual em uso

### 5.1 O que foi navegado

| Jornada | Computador 1360 | Celular 390 | Resultado |
|---|---|---|---|
| Abrir o aplicativo | sim | sim | A janela "Completar os últimos dias" abre sozinha e recebe o foco (A2) |
| Achar uma demanda pela busca (Ctrl K ou lupa), abrir | sim | sim | 1 resultado para "portaria", Enter abre o detalhe em menos de 1 s. O foco não entra na janela (A7) |
| Editar a descrição no detalhe e salvar | sim | sim | "Descrição: alterações salvas"; a seção sai da edição |
| Trocar de visão em Demandas | sim | sim | Cards, Quadro, Tabela e Lista sem rolagem horizontal da página |
| Concluir a próxima tarefa de um card | sim | sim | A tarefa seguinte assume o lugar; sem aviso (silencioso por desenho) |
| Abrir os filtros de Demandas | sim | sim | Origem, tipo, ano e prazo; Esc devolve o foco ao botão Filtros |
| Criar um evento pela visão Dia | sim | sim | Foco no título ao abrir; "Evento criado"; aparece no Dia; o foco volta ao botão |
| Cadastrar um dia indisponível pela Agenda | sim | sim | Aviso com a data e o efeito nos vencimentos; a janela fecha; o foco volta ao botão |
| Semana e Mês; tocar num dia do Mês | sim | sim | Gaveta no computador, painel abaixo da grade no celular |
| Criar uma anotação em Entradas | sim | sim | Grava e mostra "Criada em 14/11/2026 às 20:01" |
| Cadastro guiado pelo "+" | sim | sim | Passos 1 e 2 concluídos, demanda criada em Cadastro; o passo 3 exige uma tarefa ou "Pular tarefas" (o roteiro parou aí, sem defeito) |
| Menu da conta e Perfil | sim | sim | Abre; Esc devolve o foco ao avatar |
| Mudar destaque e modo, recarregar | sim | sim | Paleta 3 e Escuro persistem depois da recarga |
| Arquivo | sim | sim | Estado vazio claro: "Nada arquivado" |

Também foram conferidos, em Dia e Semana: 390, 375 e 320 px, claro e escuro, texto a 100% e a 125%, semana que atravessa o ano, feriado em dia útil, dia escolhido diferente de hoje e a falha parcial das demandas (suíte `testar:agenda`).

### 5.2 O que ficou verificado só pelo código ou pelas suítes

Login real e recuperação de senha; exportação e restauração; rotina diária; edição simultânea em dois aparelhos; Virar demanda; excluir demanda, entrada e evento; conflito de versão; estados de erro e de rede lenta (cobertos por `testar:resistencia`, não repetida hoje); o Quadro com arrastar; contraste das dez paletas (`testar:config`); o gráfico do Perfil.

### 5.3 Medidas da varredura (tema claro; o escuro deu os mesmos números)

| Rota | Computador | iPad em pé | Celular |
|---|---|---|---|
| Início | sem rolagem horizontal; nada cortado | 6 alvos abaixo de 44 px (A6) | 2 alvos abaixo de 44 px (A6) |
| Demandas | limpo | 13 alvos (visões e campo de filtro) | 8 alvos; texto do campo de filtro cortado (A8) |
| Entradas | limpo | 1 alvo (campo de busca) | 1 alvo |
| Agenda | limpo | 2 alvos ("Dia" com 41 px de largura; campo de data com 40 px de altura) | limpo em Dia e Semana; Mês com "Semana" cortado (A4) |
| Arquivo | limpo | 2 alvos (abas com 34 px) | 2 alvos |
| Configurações | limpo | 5 alvos (conjuntos de fontes com 32 px) | limpo |
| Documentos, IA | Em construção | Em construção | Em construção |

Em todas as rotas, no fim da rolagem, o último item termina acima da barra de baixo (celular: 724 de 764 px; iPad: 1060 de 1100 px). Nenhum erro de console ou de página nas 52 chegadas e nas duas sequências de jornadas.

## 6. Achados priorizados

Ordem: primeiro o que impede leitura ou ação, depois o que dificulta o uso, por último o acabamento.

### Impede leitura ou ação

**A1. Código publicado e migrações do Supabase real podem estar desencontrados (a confirmar).**
- Onde: produção (`https://dmanda-adm.vercel.app`), `origin/main` em `35c15a9`.
- Evidência: `git ls-tree origin/main supabase/migrations/` lista 20 migrações e o commit da migração 20 (`0eb1b5f`) é ancestral de `origin/main`; `CONTINUIDADE-DMANDA.md` registra "Cinco migrações pendentes no Supabase real" (16 a 20) e o `CLAUDE.md` diz "15 migrações aplicadas". O código publicado chama `listar_para_hoje`, `atualizar_para_hoje`, `listar_opcoes`, `listar_registros_dia` e `registrar_dias`, que só existem depois delas.
- Impacto se não foram aplicadas: o Para hoje, o Perfil (humor) e a origem falham em produção; a carga inicial pode mostrar erro.
- Como conferir (só leitura, com autorização do Éder): `npx supabase migration list --linked` e `npx supabase db push --linked --dry-run`. Se o painel já funciona no iPhone com o Para hoje, as migrações foram aplicadas e só a documentação está atrasada.
- Correção sugerida: conferir, aplicar o que faltar com dry-run antes (como nas anteriores) e atualizar o `CLAUDE.md` e a `CONTINUIDADE-DMANDA.md`.

**Corrigidos neste bloco (ficam aqui como registro):**
- **C1. A página saltava ao trocar de card no baralho** (`/`, celular, WebKit). Causa: o card da frente é remontado e o palco ficava sem altura por um layout; a rolagem era cortada em 340 px. Correção em `src/estilos/inicio.css` (`64c6757`); regressão em `scripts/testar-baralho.mjs`. Falta o gesto no iPhone.
- **C2. Dia e Semana no celular** (`/agenda`, 390 px): seletor com 52 px por botão e "Semana" cortado, três ações de novo evento à vista, campo de data disputando a linha, caixa dentro de caixa no dia da Semana. Correção em `src/ui/agenda.tsx` e `src/estilos/agenda.css` (`96f5b51`); capturas 05 a 11. Falta a avaliação no Safari do iPhone.

### Dificulta o uso

**A2. A janela "Completar os últimos dias" abre sozinha sobre o Início.**
- Onde: `/`, todos os aparelhos, na primeira abertura do dia em cada aparelho, quando há dias de trabalho sem registro. Captura 01.
- Passos: abrir o aplicativo num navegador sem registro do dia. A janela abre em cerca de 3 s e recebe o foco.
- Impacto: a primeira tela do dia é uma pergunta opcional, e não as demandas. No celular ela ocupa a tela inteira. O Início já tem a linha "Há 5 dias de trabalho sem registro. Completar (opcional)", que leva à mesma janela.
- Componente: `Lembretes` e `JanelaCompletar` (`src/ui/lembretes.tsx`, convite da entrada).
- Sugestão (escolha de produto, do Éder): manter só o convite dentro do Início e abrir a janela apenas pelo toque; ou abrir sozinha no máximo uma vez por semana.

**A3. O balão de humor cobre os controles do topo no celular.**
- Onde: todas as rotas depois da entrada do dia; medido em `/agenda`, 390 px. Captura 02.
- Passos: abrir `/agenda` no celular com o balão ativo e tentar tocar em "Semana". O toque cai no balão (o roteiro de teste registrou o balão interceptando o toque sobre o seletor de visões).
- Impacto: é preciso escolher o humor ou fechar o balão antes de usar o seletor de visões e os filtros.
- Componente: `Lembretes` (`src/ui/lembretes.tsx`), classe `.balao`.
- Sugestão: no celular, ancorar o balão acima da barra de baixo ou reduzi-lo a uma linha com o botão de abrir.

**A4. No Mês, a 390 e 375 px, o rótulo "Semana" do seletor fica cortado.**
- Onde: `/agenda`, Mês, celular. Captura 04. Medida: 52 px por botão a 390 px (59 px com o texto a 125%).
- Impacto: leitura do seletor. Em Dia e Semana isso foi corrigido; o Mês ficou como aprovado, por instrução do Éder.
- Componente: `.agd-barra .opcoes` em `src/estilos/agenda.css` (regra do contêiner até 560 px).
- Sugestão: aplicar ao Mês a mesma linha inteira do seletor, com o "Novo evento" na linha de baixo ou como botão só com o ícone. Depende de nova avaliação do Mês.

**A5. A barra de baixo é translúcida e o texto que passa por baixo se mistura com os rótulos dela.**
- Onde: celular e iPad, qualquer tela com rolagem. Capturas 08 e 03.
- Impacto: durante a rolagem, títulos e botões aparecem atrás de "Início", "Demandas", "Agenda" e "Mais". No fim da rolagem nada fica coberto (medido).
- Componente: `.bar` em `src/estilos/catalyst.css` e `app.css` (vidro líquido).
- Sugestão: aumentar a opacidade do vidro da barra ou acrescentar um esmaecimento do conteúdo logo acima dela. Conferir a área segura no Safari do iPhone.

**A6. Alvos de toque abaixo de 44 px (sondagem; conferir no aparelho).**
- Onde e medida: botão "Concluir demanda" dos cards, 32 px de altura (`/`, `/demandas`; a regra `.btn.fino.bloco` em `src/estilos/v5.css` tem `overflow: hidden`, que corta a área estendida); seletor de visões de Demandas e abas do Arquivo, 34 px; conjuntos de fontes em Configurações no iPad, 32 px; campo "Filtrar demandas" e "Buscar nas entradas", 25 px de altura dentro da caixa; título do card (`.assunto`, que abre a demanda), 19 a 38 px. Captura 13.
- Impacto: toques que erram o alvo no iPad e no iPhone.
- Sugestão: dar a esses controles a mesma área estendida de 44 px dos demais botões; tornar a caixa inteira do campo de busca clicável.
- Observação: a sondagem pode acusar a mais quando áreas vizinhas se sobrepõem; por isso o aceite é no aparelho.

**A7. A janela de detalhe não recebe o foco ao abrir e não o devolve ao fechar.**
- Onde: detalhe da demanda aberto pela busca ou por um card, computador. Captura 14.
- Passos: Ctrl K, digitar, Enter. O foco fica no `body` (medido); Esc fecha, mas o foco não volta ao card ou à busca.
- Impacto: quem usa teclado ou leitor de tela perde o ponto de leitura. As janelas de evento, dia indisponível, filtros e Perfil devolvem o foco corretamente.
- Componente: `Janela` (`src/ui/janela-base.tsx`, que só foca o primeiro campo de texto) e `JanelaDemanda` (`src/ui/detalhe.tsx`).
- Sugestão: no modo de leitura, focar a própria janela (`foco="janela"`) e guardar o elemento que a abriu para devolver o foco.

### Acabamento

**A8. O texto de exemplo "Filtrar demandas" aparece cortado no celular** ("Filtrar deman"). `/demandas`, 390 px, captura 03. Sugestão: "Filtrar" como texto de exemplo no celular, mantendo o nome acessível completo.

**A9. Cards com muito espaço vazio no celular.** `/demandas`, visão Cards, 390 px, captura 03: um card com só o título ocupa os 340 px de altura fixa. Sugestão: avaliar altura menor no celular (o tamanho já é uma preferência em Configurações).

**A10. No iPad, o botão "Dia" do seletor da Agenda tem 41 px de largura e o campo de data, 40 px de altura.** Ficam um pouco abaixo dos 44 px. Sugestão: largura mínima de 44 px nos botões do seletor.

**A11. Seis caminhos para criar um evento.** Menu "+", "Novo evento" do Mês, "+" de cada coluna da Semana larga, ação do dia em Dia e Semana, gaveta e painel do Mês. Em Dia e Semana ficou uma só ação principal por tela; os demais são atalhos. Registrado para a revisão do Mês.

**A12. As páginas do design antigo continuam no pacote publicado.** `/marca`, `/pecas` e `/tokens` (`src/app/(antigo)/`) aparecem na lista de rotas do `npm run build` de hoje. Não estão no menu e ficam atrás da mesma porta de entrada, mas são servidas. Sugestão: tirar do build de produção (ou mover para fora de `src/app`) quando a referência não for mais necessária. Verificado só pela lista do build, sem abrir as páginas.

## 7. Estado das pendências citadas

### 7.1 `testar:config` (relato anterior: 168 de 175)

Hoje, no código `96f5b51`, uma execução completa deu **175 de 175**. As sete falhas anteriores eram as verificações de "sobrevive à recarga" e, pelo registro da decisão 74, falhavam igual na versão publicada. Não há correção local posterior nesses arquivos: o resultado de hoje indica falha intermitente (provável dependência do tempo de subida do servidor). Pendência: repetir a suíte algumas vezes e, se a falha voltar, trocar as esperas fixas dessas verificações por espera pela condição.

Observação da mesma natureza em `testar:baralho`: em cinco execuções de hoje, duas (a primeira do dia e a que veio logo depois do `npm run build`, com o servidor frio) tiveram as mesmas quatro falhas em verificações antigas de toque ("novo toque numa área livre volta à frente" e três em cascata). O teste esperava 500 ms depois do toque e a virada do card leva 550 ms (`src/estilos/estilo.css`), então a medida do verso podia ser lida no meio da animação. A espera passou a 750 ms e as duas execuções seguintes deram 91 de 91. **Limite:** essas duas rodaram com o servidor já aquecido; a causa é a mais provável, mas não foi comprovada com o servidor frio. A regressão nova da rolagem passou nas cinco execuções.

### 7.2 Risco de duplicação no cadastro depois de uma resposta perdida

| Cadastro | Identidade da tentativa | Estado |
|---|---|---|
| Demanda (cadastro guiado) | Identificador gerado no aparelho e guardado no rascunho antes da chamada | Coberto (`testar:interface`, 148 de 148 hoje) |
| Tarefa | `p_id` em `adicionar_tarefa` (migração 13) | Coberto (`testar:interface`, `testar:banco`) |
| Entrada | Identificador no rascunho antes da primeira gravação | Coberto (`testar:entradas`) |
| Evento | Identificador gerado no aparelho | Coberto (`testar:agenda`) |
| Virar demanda | Identificador obrigatório, mesma transação | Coberto (`testar:entradas`) |
| **Dia indisponível** | **Não há**: `salvar_dia_indisponivel` não recebe identificador do aparelho e a tabela não tem restrição de unicidade | **Pendente.** Se a resposta se perder e a pessoa salvar de novo, podem ficar dois registros iguais na mesma data. O efeito nos prazos é o mesmo (a data já estava indisponível); sobra uma linha repetida em Configurações, que pode ser excluída. Corrigir exige migração nova (identificador ou unicidade por data, tipo e descrição) |

### 7.3 Configurações

- Funciona: modo Claro, Escuro e Sistema, dez destaques, conjuntos de fontes, tamanhos (texto, ícones, cards), fundo e movimento, Perfil e dias indisponíveis.
- Sem código, embora listado em `FUNCIONALIDADES.md`: conta Google, IA, cidade do clima, dias do prazo automático, alerta de parado há X dias, avatar, importar dados, banco de mensagens, tipos de documento (renomear e ocultar), fundo por imagem.
- A aparência (decisão 53) consta no `CLAUDE.md` como "a validar" e numa branch; o código está na `main`.
- Toque: os botões de conjunto de fontes têm 32 px de altura no iPad (A6).

## 8. Lacunas de documentação

| Onde | O que está desatualizado |
|---|---|
| `CLAUDE.md`, "Estado atual" | Data de 30/10/2026; diz que as demais áreas aparecem como "Em construção" (hoje só Documentos e IA); diz 15 migrações (o repositório tem 20); cita Configurações numa branch |
| `CLAUDE.md`, contagens das suítes | `testar:baralho` 55 (hoje 91), `testar:agenda` 297 (hoje 389), `testar:config` 163 (hoje 175), `testar:banco` 285 (registro mais recente: 425) |
| `SINCRONIZA-PROJETINHO.md` | "Última atualização" de 30/10/2026 no topo, com blocos posteriores abaixo |
| Supabase real | Sem registro de aplicação das migrações 16 a 20 (A1) |
| Rotina diária | Sem registro da primeira execução automática em produção |
| Fundo por imagem (IndexedDB) | Descrito no design system; sem código em `src/` |
| `ANDAMENTO.md` | 45% desde 04/11/2026; os blocos de Perfil, busca, origem, Configurações e baralho não entraram no cálculo |

## 9. Próximo trabalho, pela ordem de impacto

1. **Conferir as migrações no Supabase real (A1)** e alinhar a documentação. Sem isso não dá para afirmar que a produção está inteira.
2. **Avaliar no iPhone** o baralho, Dia e Semana (este bloco), pelo endereço da prévia.
3. **Humor na entrada (A2 e A3):** decidir como o convite e o balão aparecem no celular.
4. **Seletor do Mês no celular (A4)**, junto com a revisão dos caminhos de novo evento (A11).
5. **Toque e foco (A6, A7, A10):** área de 44 px nos controles listados e foco na janela de detalhe.
6. **Barra de baixo (A5)** e área segura no Safari.
7. **Dia indisponível sem duplicar (7.2)**, com migração nova.
8. **Estabilizar as esperas** de `testar:config` e de `testar:baralho` (7.1).
9. **Atualizar a documentação** (seção 8) e recalcular o `ANDAMENTO.md`.
10. Acabamento: A8 e A9.

## 10. Índice das capturas

Todas com dados fictícios, em `docs/auditoria-capturas/`. As de celular vêm do WebKit do Playwright ou do Edge emulado, não de um iPhone.

| Arquivo | O que mostra | Achado |
|---|---|---|
| `01-inicio-celular-janela-de-humor.png` | Início no celular ao abrir, com a janela "Completar os últimos dias" | A2 |
| `02-agenda-celular-balao-de-humor.png` | Agenda no celular com o balão de humor sobre o seletor de visões | A3 |
| `03-demandas-celular.png` | Demandas no celular: campo de filtro cortado, card com espaço vazio, barra de baixo | A5, A8, A9 |
| `04-mes-celular-seletor.png` | Mês a 390 px: "Semana" cortado no seletor (não alterado) | A4 |
| `05-dia-celular-antes.png`, `06-dia-celular-depois.png` | Dia a 390 px, antes e depois | C2 |
| `07-semana-celular-antes.png`, `08-semana-celular-depois.png` | Semana a 390 px, antes e depois | C2, A5 |
| `09-semana-computador-antes.png`, `10-semana-computador-depois.png` | Semana no computador, antes e depois | C2 |
| `11-dia-320-texto-125.png` | Dia a 320 px com o texto a 125% | C2 |
| `12-config-ipad.png` | Configurações no iPad em pé | A6, 7.3 |
| `13-inicio-ipad.png` | Início no iPad em pé | A6 |
| `14-detalhe-computador.png` | Detalhe aberto pela busca | A7 |
| `15-semana-celular-fim-da-rolagem.png` | Semana no celular no fim da rolagem, acima da barra | C2 |

O comparativo completo de Mês, Semana e Dia (66 capturas por versão, computador, iPad e três larguras de iPhone, claro e escuro) fica fora do Git, em `.dados-teste/comparacao-calendarios/` (`antes-d75` e `depois-d75`, com `medidas.json`).
