# Organização estrutural do Dmanda (19/11/2026)

Bloco de organização feito com o procedimento do `untangle-codebase` (fonte consultada: `https://github.com/caldoai/skills/blob/HEAD/skills/untangle-codebase/SKILL.md`, lida na íntegra; a skill não está instalada no projeto e nada foi instalado: o procedimento foi aplicado à mão, com os complementos **Comments** e **Tests** que o Éder escolheu). Branch `bloco/organizacao-estrutural`, criada de `a400883` (subbloco 1.4 fechado); nada publicado, nada aplicado no Supabase real. Este é o **único mapa** do bloco: problemas, decisões, o que foi feito e o que ficou de fora.

A pergunta usada para cada trecho foi: **estas peças devem mudar juntas?** Os erros possíveis são três: ligações ocultas (peças que mudam juntas sem o código dizer), ligações desnecessárias (peças presas que mudam por motivos diferentes) e sobra (peças sem motivo próprio para mudar). Casos especiais (um `if` para um valor, uma exceção engolida, um sleep, um teste desligado) foram lidos como requisitos que o desenho não previu, sem tratar toda condição especial como defeito.

Evidências vieram de leitura direta e de dois levantamentos de leitura (testes, `src`), conferidos por busca antes de cada correção. Ausência de importação não foi tomada como prova de código morto: rotas do Next (`page`, `layout`, `route`, `manifest`, ícones), chamadas por string (nomes de RPC), `package.json`, CSS e documentos foram conferidos.

## Grupos resolvidos

| Grupo | Evidência | Causa | Solução | Verificação |
|---|---|---|---|---|
| **T1** Preparo copiado nas suítes de navegador | servidor de teste, espera, parada, Edge, contexto com relógio e erros, contador de verificações e rodapé repetidos em 20 suítes (`testar-falha-dias`, `testar-periodos` e `testar-agenda` eram cópias entre si) | cada suíte nasceu copiando a anterior | `scripts/auxiliar-navegador.mjs` (`iniciarServidor`, `pararServidores`, `abrirEdge`, `abrirWebkit`, `novoContexto`, `criarVerificador`, `semearBanco`, `instanteDaReferencia`) | as suítes migradas mantêm as contagens de verificações |
| **T2** Repetição da partida do Next em três cópias | `testar-baralho`, `testar-resistencia`, `testar-vagas-carrosseis` repetiam a partida quando o Next sai ao mostrar o aviso de atualização, cada uma com a sua versão; as outras suítes não tinham a proteção | convenção copiada em três lugares e ausente em dezessete | a repetição (4 tentativas, 6 s de estabilização) e o erro explícito se o servidor não sobe ficam em `iniciarServidor` e valem para todas | suítes migradas |
| **T3** Portas repetidas | `testar-config` e `testar-busca` (7112), `testar-perfil` e `verificar-ajuste-cards` (7113), `testar-auditoria` e `testar-detalhe` (7125) | número escrito à mão em cada arquivo | portas próprias (busca 7118, verificar-ajuste-cards 7120, detalhe 7121); `testar:regras` falha se duas suítes usarem a mesma | `testar:regras` |
| **T4** Titular de teste copiado | `USUARIO` e as duas inserções (usuário e e-mail autorizado) estavam no servidor de desenvolvimento (`banco.ts`), em 13 suítes, nas sementes e nas prévias | cada um criava o seu titular | `USUARIO_TESTE` e `prepararTitularDeTeste` em `src/servidor/banco-teste-base.mjs`, usados por todos | suítes e prévias migradas |
| **T5** Variáveis sem efeito | `DMANDA_SEM_CLIMA` (nenhum código lê) e `CRON_SECRET` em 12 suítes que não chamam a rota (só `testar:app` e `testar:acesso-direto` chamam) | cópia de um modelo | saem; o segredo só existe com `cron: true` | suítes migradas |
| **T6** Lista de operações: código x SQL | a lista de `executar_como_titular` no SQL e as chamadas em `src/nucleo/operacoes.ts` e `src/servidor/*.ts` (41 nomes) precisam mudar juntas, e o SQL só avisa em comentário; `testar:acesso-direto` lia a lista da PRIMEIRA versão da migração | convenção sem cobrança | `scripts/auxiliar-operacoes.mjs` lê as duas e `testar:regras` cobra as duas direções (provado por mutação: tirar `excluir_tarefa` da lista do SQL faz o teste falhar); `testar:acesso-direto` passa a ler a lista vigente | `testar:regras`, `testar:acesso-direto` |
| **T7** Verificações que não detectavam falha | `ok(true)` depois de uma espera derrubava o script sem resumo se a espera estourava; "semana navegada sem erro" não verificava nada; `testar:cards-inicio` passava em silêncio se o baralho da Nova urgência sumisse | convenção de assertar por exceção | `verificador.aguardar(espera, mensagem)` vira FALHOU com o motivo; a verificação vazia sai (a Semana tem verificações próprias); o baralho passa a ser exigido | suítes migradas |
| **T8** Sobras nos testes | variáveis e parâmetros nunca usados (lint com 10 avisos), duas leituras de `supabase/pendentes` | sobra de edições antigas | removidos; a leitura do segundo diretório de migrações do banco de teste (`supabase/pendentes`, que já não é usado) sai. **Correção de rumo:** a opção `raizMigracoes` também havia saído por engano (a busca por chamadores foi truncada); `testar:banco` a usa em dez testes de atualização e falhou, então foi restaurada e comentada | `eslint` sem avisos |
| **S1** Limites de tamanho copiados | assunto 300 em `validacao.ts`, `campos.tsx` e `entradas.ts` (o comentário admitia a cópia); 80 e 160 em `validacao.ts`, `campos.tsx`, `seletor.tsx`, `dia-indisponivel.tsx`; 200 e 5000 do evento em `validacao.ts` e `evento.tsx` | cada camada escreveu o número | `src/lib/limites.ts` (`LIMITES`); o evento usa as constantes que `lib/eventos.ts` já exportava | `tsc`, `testar:regras` |
| **S2** Datas definidas duas e três vezes | `dataExiste` e `DATA` em `eventos.ts` e `validacao.ts`; `MS_DIA` e `emMs` em `demandas.ts` e `prazos.ts` | cada módulo precisou e copiou | `src/lib/datas.ts` | `testar:regras`, `testar:agenda-regras`, `testar:fuso` |
| **S3** Visões, colunas e a chave do tema | `VISOES` e `COLUNAS` em `armazenamento.ts`, `Visao` em `contexto.tsx`, a lista de botões em `paginas.tsx`, `Coluna` em `demandas.ts`: uma visão nova sumiria em silêncio do que fica guardado no navegador; `'dmanda-tema'` em três lugares, um deles dentro do script de abertura do layout | listas paralelas | uma definição em `lib/demandas.ts` (os botões são um `Record<Visao, ...>`: visão nova sem botão não compila); `CHAVE_TEMA` em `lib/aparencia.ts`, interpolada no script do layout | `tsc`, suítes de navegador |
| **S4** Operações e transporte | `const op = () => criarOperacoes(chamar)` copiado em quatro arquivos de servidor e na rota de exportação (o parâmetro `chamar` só tem um valor); o comentário de `validarDia` ("sem id cria") contradizia `salvarDia` | cópia e comentário desatualizado | `operacoes()` em `src/servidor/banco.ts`; comentário corrigido | `tsc`, `testar:regras`, suítes |
| **S5** Sem uso e rascunho que não guardava | `prioritariasPrimeiro` e `TIPOS` não têm nenhum chamador; a janela Nova tarefa lia `dem` do rascunho, mas só gravava `{ assunto }`: a demanda escolhida nunca voltava | resto de implementação; leitura sem escrita | os dois sem uso saem; o rascunho passa a gravar `dem` (a leitura já o esperava) | nova verificação em `testar:busca` (Esc guarda, reabrir devolve texto e a mesma demanda) |
| **S6** `localStorage` lido e gravado em quatro cópias | `contexto.tsx`, `agenda.tsx`, `lembretes.tsx`, `para-hoje.tsx`, cada uma com o seu `try/catch` e o mesmo comentário | cópia | `lerGuardado` e `guardarNoNavegador` em `lib/armazenamento.ts`; cada tela mantém a validação da forma do que lê; o `try/catch` em volta de validação total sai | `testar:resistencia` (armazenamento corrompido), suítes |
| **S7** Divergência entre o objeto do contexto e a lista de dependências | o aviso do `eslint` (`aplicarEvento` faltando) | a lista repete as chaves do objeto | dependência acrescentada (função estável: sem mudança de comportamento) | `eslint` |
| **C1** Instruções locais | `CLAUDE.md` com 44 KB, 13 KB de "Estado atual" de outubro e novembro (descrevia os aparelhos autorizados, retirados em 17/11), 27 descrições de suítes e contagens antigas | histórico acumulado na instrução carregada em toda sessão | `CLAUDE.md` com cerca de 22 KB: estado vigente curto, comandos por grupo, regras permanentes preservadas; o texto antigo foi movido sem alteração para `docs/historico-estado-claude-md.md` e `docs/testes.md` | leitura; nada foi perdido (movido, não apagado) |

## Avaliado e mantido (proteção necessária ou contorno com causa externa)

- `protegido` e `explicarFalha` em `ui/contexto.tsx` e `executar` em `nucleo/operacoes.ts`: distinguem "nada foi gravado" de resultado incerto (cancelamento de tentativa, idempotência, gravação tardia). Não são contorno.
- `src/lib/prazos.ts` copia `ajustar_prazo` do SQL de propósito (a prévia precisa da mesma conta); a equivalência é coberta por `testar:banco`.
- `src/lib/cores-barra.ts` lê a cor de `catalyst.css` na montagem porque o manifesto e o `theme-color` não aceitam variáveis de CSS; falha de propósito se o formato mudar (documentado no arquivo).
- `navigator.locks` com alternativa em `lembretes.tsx`, o singleton `globalThis.__dmandaBancoTeste` (desenvolvimento), a fila de gravação e o autosave de 1,2 s de Entradas, o efeito pós-hidratação do contexto.
- `salvar_dia_indisponivel` sem `id` no SQL (sementes e testes), as esperas fixas dos testes (as grandes têm causa: autosave, relógio, animações) e o WebKit emulado como motor opcional.
- `testar:acesso-direto` e `testar:medicao-local` mantêm o seu próprio servidor: um usa o transporte real contra um Supabase falso, o outro o servidor de produção; o ambiente deles difere do `next dev` com banco de teste.

## Pendências fora do escopo (causa e impacto)

| Item | Causa de não ter sido feito | Impacto |
|---|---|---|
| 146 classes de CSS sem uso em `src` (famílias `pomo-*`, `wg-*`, `ag-*`, `am-*`, `prop-*`, parte de `v5.css`), vindas do protótipo | remover exige comparação visual antes e depois (a ordem das folhas em cascata e classes montadas por string tornam a busca literal insuficiente); o bloco não pode mudar aparência | peso de CSS e ruído ao ler; sem risco funcional |
| `src/app/(antigo)` e `src/components` publicam `/marca`, `/pecas` e `/tokens` | é decisão de produto (rotas públicas), não organização | nenhum para o uso; superfície publicada que só o `capturar.mjs` usa |
| Contexto da interface com 104 membros (`ui/contexto.tsx`, 697 linhas) lido por todas as telas | dividir por domínio é uma refatoração de interface grande, com risco de hidratação e de regressão visual | uma mudança em demandas relê tudo; custo de leitura para quem mexe |
| Três camadas com o mesmo nome por operação (contexto, `src/servidor/*`, `nucleo/operacoes.ts`) e a lista do SQL | `'use server'` exige a camada de servidor; gerá-la seria infraestrutura nova | adicionar operação toca quatro lugares; a ligação com o SQL agora é cobrada por teste |
| Constantes com cópia no SQL: etapas, `VAGAS_PARA_HOJE`, 62 dias de registros, código `DM409`, os limites de `limites.ts` | tocaria SQL/RPC (migração); só um teste de comparação seria possível | mudar uma exige migração; os limites estão avisados em `limites.ts` |
| Chaves de rascunho por convenção de string (`e:`, `d:`, `ev:`, `dia:nova`, 17 ocorrências) | centralizar muda chaves guardadas no navegador do Éder e pede teste de recarga | uma chave nova pode colidir; não há defeito hoje |
| Debounce de rascunho (500 ms) em cinco janelas, devolução de foco com `setTimeout(0)` em quatro lugares, tempos acoplados a animações do CSS | um hook único pode mudar o comportamento de rascunho e de acessibilidade; sem benefício demonstrado agora | repetição; se o CSS mudar, o JavaScript não percebe |
| A exportação v4 mapeia qualquer erro para 401 e não inclui registros, opções nem Para hoje | contrato da cópia (compatibilidade v4) e decisão de produto | a cópia não leva o humor por dia, as opções nem as vagas |
| `supabase/pendentes/` (pasta vazia, só neste computador, não rastreada) | pasta local sem conteúdo; não apagada (instrução de não limpar) | nenhum |
| `lib/supabase/config.ts` usa `process` e `fs` dentro de `lib` | movê-lo exige trocar imports em testes por ganho pequeno | `lib` deixa de ser puro nesse arquivo |
| `ok(true)` em `testar-ajustes` (marcar tarefa na lista) e a forma `.then(() => ok(true, ...))` em `testar-app` | seguem uma espera que lança erro se falhar; convertê-las pede olhar caso a caso | falha derruba o script sem resumo |

## Comentários e testes (complementos Comments e Tests)

**Comentários.** Um levantamento de leitura listou 34 comentários e a conferência no código confirmou cada um. Saíram **21 linhas inteiras** que só repetiam a implementação (nome da função, ternário, efeito de teclado ou de foco narrado passo a passo) e **7 comentários cuja causa já não existe** foram reescritos ou removidos (sessão persistente e porta de entrada, "como a sessão do titular fazia", o antigo "Na fila", a distinção Legal/Próprio que "saiu", a história do auxiliar de testes). Ficaram, de propósito, os comentários de regra, de decisão, de restrição externa (Next, Safari, Supabase, Windows, PGlite), de integridade (idempotência, gravação tardia, hidratação) e os avisos de ligação oculta. Alguns comentários citados no levantamento são de fim de linha e não foram apagados (a redundância é pequena: o veredito geral foi "ocasional").

**Testes removidos**
- `testar-agenda`, "semana navegada sem erro": não verificava nada (as verificações da Semana, mais adiante na mesma suíte, e a checagem final de erros de página cobrem o que ela fingia cobrir). Saiu também a variável `diaF` e o `void diaF`.
- `testar-baralho`, "com um card só, a pilha mostra 1 de 1": media a Urgência numa cena em que ela tem **zero** cards (medido: `cards: 0`); passava porque aceitava "posição indefinida". O caso de um card só existe e é verificado em `testar-vagas-carrosseis` ("1 de 1" sem passar).
- `testar-regras`: a metade de uma verificação que comparava `colunaNaSemana` com `diaDaSemana` (o primeiro é só um nome para o segundo; a outra metade, que compara com o nome do dia por extenso, ficou).

**Testes reescritos**: 18 `ok(true)` depois de uma espera viraram `verificador.aguardar` (a contagem se mantém, e um tempo esgotado agora é um FALHOU com o motivo); `testar-cards-inicio` passou a exigir o baralho da Nova urgência (antes, sem ele, passava em silêncio); `testar-ajustes` deixou de aceitar uma lista vazia de botões como "todos desativados"; `testar-acesso-direto` lê a lista vigente de operações.

**Testes novos**: operações do código x lista do SQL (2 verificações, provado por mutação), portas únicas (1), rascunho da Nova tarefa com a demanda escolhida (1, provado por mutação: sem `dem` no rascunho a verificação falha).

**Apontados e não alterados** (com a razão): esperados calculados pela mesma função de `src` que a tela usa (`dataComSemana`, `gradeMes`, `diasPendentes`, `serieDoPeriodo`, `panorama`), que são equivalências entre a tela e a regra em vez de duplicação da implementação, embora uma regra errada errasse nos dois lados; as suítes puras cobrem os mesmos cálculos com literais; seletores por posição (`nth-child`) em `testar-app` e `testar-agenda` e medidas de pixel exatas em `testar-config` e `testar-detalhe` (quebram sem mudança de comportamento, mas trocá-los por papel ou texto exige olhar cada tela); ramos que dependem de navegador ou de data em `testar-agenda` (comparação de preenchimento de fim de semana) e `testar-ajustes`; `testar-config:358` (aceita o padrão ou o máximo; o máximo está nas regras puras); `testar-banco` com `.catch(() => null)` na leitura de período por quem não é titular (precisa de experimento para saber o erro esperado); `testar-resistencia` com clique que ignora erro. Nada disso foi enfraquecido nem removido.

## Resultado das verificações

Execuções rastreáveis (executor com início, término e saída por suíte; sem esperas indefinidas). Última rodada completa com o código final de `src` (exceto comentários, conferidos depois):

| Verificação | Resultado |
|---|---|
| `tsc` | saída 0 |
| `eslint src scripts` | 0 erros e 0 avisos (antes: 10 avisos) |
| `npm run build` | saída 0 |
| `testar:banco` | 618 (uma rodada falhou por um erro meu, `raizMigracoes` removida sem necessidade; restaurada, 618) |
| `testar:regras` / `agenda-regras` / `fuso` / `restauracao-v4` | 260 (era 257) / 89 / 9 / 31 |
| `testar:busca` | 97 (era 96; +1 do rascunho da Nova tarefa) |
| `testar:app` / `agenda` / `entradas` / `config` / `campos` | 137 / 394 (era 395) / 179 / 175 / 459 |
| `testar:interface` / `ajustes` / `detalhe` / `perfil` / `origem` | 148 / 604 / 60 / 117 / 51 |
| `testar:auditoria` / `baralho` / `cards-inicio` / `fila-cards` | 108 / 90 (era 91) / 133 / 45 |
| `testar:vagas-carrosseis` / `resistencia` / `prazo-chegada` / `periodos` / `falha-dias` | 131 / 90 / 71 / 89 / 96 |
| `testar:acesso-direto` | 48 |

Depois dos comentários e dos ajustes finais de testes foram repetidos `testar:regras`, `agenda-regras`, `busca`, `ajustes` e `baralho` (e `tsc`, `eslint` e `build`). As verificações de comentários não mudam o comportamento; `testar:medicao-local`, `medir:desempenho`, `verificar:cores` e `verificar:ajuste-cards` não foram repetidas (não tocam o que mudou).

**Comportamento preservado**: regras de prazo e retorno do servidor, histórico das finalizadas, operações idempotentes e cancelamento de tentativas incertas, sobreposições de indisponibilidade, cópia v4 e restauração, acesso aberto temporário, Catalyst, navegação e acessibilidade (nenhuma tela, texto ou estilo mudou). A única mudança de comportamento é o rascunho da Nova tarefa guardar a demanda escolhida (a leitura já a esperava); nenhuma migração foi criada e nenhum contrato SQL/RPC foi alterado.

**Limites**: tudo em PGlite e Edge, com WebKit emulado e dados fictícios. Não foram testados o Supabase real, o Safari em aparelho real nem o ambiente hospedado. O dia a dia da leitura de contexto (menos tokens por sessão) não foi medido: não há estimativa de economia neste bloco.

