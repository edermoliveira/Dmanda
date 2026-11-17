# Auditoria do frontend publicado após as decisões 76 e 77

Data: 15/11/2026. Base auditada: `ed1e63e` (publicada em `origin/main`). HEAD local: `1a6dd5f`. Nenhum arquivo do frontend foi alterado nesta rodada. Nada foi enviado ao GitHub, à Vercel nem ao Supabase real.

## 1. Estado do repositório e correção do registro de publicação

| Item | Valor conferido |
|---|---|
| Branch, árvore | `main`, limpa; stash do Clima preservado (`stash@{0}`, `bloco/inicio-clima`) |
| `origin/main` (fetch feito, igual a `git ls-remote`) | `ed1e63e148192e3a7216e4b161950180d68adab7` |
| Intervalo `b7f3d25..origin/main` | 4 commits: `cbe5fc4` (decisão 76 em recorte), `b2c846a` (data centralizada), `fac1d93` (painéis e legenda), `ed1e63e` (próximo card, Cards por grupo, fila completa) |
| HEAD local | `1a6dd5f`, 0 atrás e 6 à frente do remoto |
| Só locais (6) | `5e7f521` (registro do resultado da AD), `b6c6452` (Pagamentos), `c9c9783` (prévia dos lançamentos), `50de3ab` (revisão Ponytail de Pagamentos), `d56a2e4` (registro 76 e regra Claro/Escuro), `1a6dd5f` (incorporação do publicado) |

**Correção da divergência.** O GitHub mostra os quatro commits acima e a seção AE de `CONTINUIDADE-DMANDA.md` já publicada (publicada como "recorte"). O remoto **não** contém a migração `20261115000000_pagamentos`, o cadastro de Pagamentos, a cópia versão 5 nem a prévia dos lançamentos (`#previa=lancamentos`): tudo isso é exclusivamente local. O achado A1 foi conferido em leitura na entrega anterior (migrações 16 a 20 aplicadas no Supabase real, só a de Pagamentos pendente, funções de Pagamentos ausentes no remoto) e foi reaproveitado, sem nova consulta.

**Código local x publicado nas áreas auditadas.** `git diff ed1e63e HEAD` em `baralho.tsx`, `para-hoje.tsx`, `dia-indisponivel.tsx`, `lib/fila.ts`, `lib/prioridade.ts`, `inicio.css`, `app.css`, `paginas.tsx` e `visoes.tsx` é vazio. Os 11 arquivos de `src` que diferem são de Pagamentos (`config.tsx`, `contexto.tsx`, carga, validação) e da prévia (`agenda.css` e duas linhas de `agenda.tsx`, atrás de `#previa=lancamentos`). Por isso o build local serve de base fiel para o publicado. **Observação exclusivamente local:** o campo de data de Pagamentos (`config.tsx:39`) reutiliza o `CampoData`, então os achados 5 e 12 também valem para ele quando for publicado.

## 2. Ambiente e ferramenta instalada

- Node 24.22.2, npm 12.2.2, Claude Code 2.1.325 (os mesmos do inventário anterior; atualizações só consultadas). Navegadores: Edge instalado, Chromium 1228/1248 e WebKit 2370 do Playwright.
- **Plugin `modern-web-guidance@googlechrome`**: não estava instalado. Instalado com escopo **Local** neste checkout, versão **1.0.0**, origem `https://github.com/GoogleChrome/modern-web-guidance` (commit `4dd968349e54ca45a05dd5c818fb035c9054b022`, licença Apache-2.0). Antes de habilitar li o manifesto: só há skills (`modern-web-guidance` e `chrome-extensions`), sem hooks, MCP, comandos, agentes nem scripts locais. O `SKILL.md` instalado tem o mesmo hash do clone inspecionado. O registro ficou em `.claude/settings.local.json` (ignorado pelo Git, árvore continua limpa): `extraKnownMarketplaces.googlechrome` e `enabledPlugins`. Nada entrou no `package.json` nem em `.claude/settings.json`.
- **Status:** a skill ainda não aparece como carregável nesta sessão (precisa de `/reload-plugins`, comando do usuário). Segui o fluxo do `SKILL.md` pela CLI (`npx.cmd -y modern-web-guidance@latest search|retrieve`, `--skill-version 2026_11_09-5bcc021b`). O pacote npm `modern-web-guidance@1.0.0` é buscado na rede a cada uso.
- Buscas genéricas feitas: "date picker input", "form field label", "responsive card layout", "keyboard accessible carousel", "drag gesture scrolling", "reduce layout shifts", "defer heavy rendering", "inert background content", "reduced motion animation", "respect text scale", "screen reader hidden text", "touch target size", "dashboard info panel", "legend wrap centered", "animate custom property", "reduce style recalculation", "manage focus after update", "disabled button focus". Guias recuperados e lidos nos trechos pertinentes: `accessibility`, `forms`, `swipe-to-remove`, `drag`, `carousel`, `defer-rendering-heavy-content`, `interactions-in-complex-layouts`, `motion`, `progress-ring`, `individual-transform-properties`, `browser-ui-theming`, `respect-os-text-scale`, `form-factor-adaptation`, `card`.

## 3. Método e limites

Banco de teste PGlite com dados fictícios, **build de produção local** (`next build` + `next start`), Playwright com Edge e WebKit do Playwright. O kit está em `.dados-teste/auditoria-frontend/` (fora do Git; logs em `resultado.log`, capturas em `capturas/`, 90+ imagens).

Níveis de evidência usados nos achados:

- **Código**: lido, sem executar.
- **Navegador emulado**: reproduzido no Edge (toque real por CDP) ou no WebKit do Playwright (motor do Safari no Windows, **não** o Safari do iPhone; sem CDP, sem toque real, eventos de ponteiro sintéticos).
- **Aparelho real**: nada nesta rodada. O que só o iPhone ou iPad comprova está marcado como hipótese.

Medições de custo usam `Emulation.setCPUThrottlingRate` 4x no Edge. Isso **não é** um iPhone: serve para comparar duas versões em condições iguais, não para prometer desempenho no aparelho.

## 4. O que foi verificado e está correto (sem achado)

- **Campo de data** (Edge e WebKit, Claro e Escuro, 390 px; janela da Agenda no Escuro): alvo de 44 px; dica "Escolher a data" centralizada (desvio vertical -0,3 px no Edge e 0 no WebKit); contraste da dica 6,17:1 (claro) e 6,63:1 (escuro); data preenchida 19,3:1 e 16,6:1; foco visível (anel de 2 px, azul no claro, azul claro no escuro); clicar no rótulo "Data" leva o foco ao campo; a dica cabe a 125%; no desktop (ponteiro fino) a dica fica oculta e o campo nativo aparece. **Leitura duplicada por tecnologia assistiva: não ocorre**: o texto desenhado é `aria-hidden` e a árvore de acessibilidade expõe só `textbox "Data"`.
- **Painéis e legenda da Agenda**: 9 combinações de largura, tema e texto (320, 375, 390, 820 e 1360 px; 100% e 125%; Claro e Escuro) em Mês e Semana, mais WebKit a 390 px, mais os estados **indisponível** e **vazio**: nenhum painel fora da tela, nenhum estouro interno, nenhuma rolagem horizontal. A **regressão da data quebrada letra a letra não voltou**: em todas as combinações a data do painel de carga tem 3 linhas ou menos e pelo menos 8 caracteres por linha (a 320 px e 125% quebra em 3 linhas legíveis). Contraste de todos os textos dos painéis (data, selo, sugestão, metadados, assunto, estado vazio): mínimo 4,5:1 nos dois temas. Legenda: as 4 amostras "0", "1 a 3", "4 a 7" e "8 ou mais", em uma linha, centralizadas, nos dois temas.
- **Baralho** (Edge com toque real por CDP; WebKit com eventos de ponteiro): arrasto curto devolve o card; arrasto completo leva à frente exatamente o card revelado (Nova urgência e Na fila); o card de fundo é `inert`, `aria-hidden` e sem clique; rolagem vertical com o dedo sobre o card rola a página sem arrastar o card; diagonal não navega e rola ao mesmo tempo; **nenhum salto de rolagem** em arrasto curto, completo e troca por botão (Edge e WebKit); 40 pressões de Tab nunca param dentro de um card de fundo; nenhum `id` nem `data-id` duplicado; movimento reduzido sem animação e com o próximo card ainda revelado enquanto o dedo arrasta.
- **Filas**: no iPhone os 110 cards de 5 grupos ficam alcançáveis (36 cards do maior grupo, uma vez cada, e a pilha fecha o ciclo); pilhas independentes; filtro "Só atrasadas" mostra só os grupos com atrasadas e, ao tirar, os grupos e contagens voltam; marcar a tarefa pelo card não navega nem salta a página.
- **Refutado**: a suspeita de leitura em dobro por duas regiões `aria-live` no baralho não se confirma, porque `1 de N` não muda de texto ao navegar. A checagem de "uma linha por amostra" da legenda que acusou falha foi um erro da medição (o quadradinho de cor tem altura diferente do texto); as capturas mostram uma linha.

## 5. Achados

Classificação: **D** defeito comprovado, **H** hipótese que depende do aparelho, **O** oportunidade de melhoria.

### Achado 1 (D, alto para teclado e leitor de tela): o foco se perde a cada troca de card pelos botões

- **Impacto:** quem navega sem gesto (teclado, Controle por Botão, VoiceOver) aciona "Passar para o fim" e o foco cai em `BODY`; precisa reencontrar o botão do começo da página a cada card. É justamente o caminho "navegação sem gesto" do bloco.
- **Onde:** `src/ui/baralho.tsx:169-170` (`disabled={desligado || ...}`), com `desligado = travado || saindo !== null` (`:123`) e a saída animada de 260 ms em `sair` (`:125-134`). Origem anterior às decisões 76 e 77 (decisões 65 e 75), mas é o componente auditado.
- **Ambiente e reprodução:** Edge e WebKit emulado, iPhone 390 px. Início, `Tab` até "Passar para o fim", `Enter`: `document.activeElement` passa de `BUTTON[passar]` para `BODY` durante a saída e continua `BODY` depois; "Voltar ao anterior" idem. Com `prefers-reduced-motion: reduce` o foco permanece no botão, o que isola a causa: o `disabled` durante a animação.
- **Evidência:** `q-baralho2.mjs`, linhas `[foco]` em `resultado.log`.
- **Guia:** `accessibility`, regra "Be deliberate about `disabled` vs `aria-disabled`": `disabled` tira o elemento da ordem de foco, enquanto `aria-disabled="true"` o mantém, desde que a ativação seja impedida no JavaScript (4.1.2, nível A). `swipe-to-remove`: os botões equivalentes ao gesto compartilham a função de confirmação, incluindo "the focus move" e o anúncio.
- **Baseline e navegadores:** HTML e ARIA padrão, suportados igualmente no Safari/iOS e no Edge; o comportamento do `disabled` é do navegador, então vale no Safari real.
- **Recomendação:** durante a saída, usar `aria-disabled="true"` (mantendo o bloqueio no `onClick`) em vez de `disabled`, ou devolver o foco ao botão depois da troca. Manter `disabled` quando não há ação possível (`total < 2`) é aceitável.
- **Aceite:** em Edge e WebKit, cinco `Enter` seguidos em "Passar para o fim" e em "Voltar ao anterior" mantêm o foco no mesmo botão; com movimento reduzido nada muda; a suíte `testar:baralho` ganha essa verificação.

### Achado 2 (D, médio): painéis da Agenda dizem o contrário da verdade quando as demandas não carregam

- **Impacto:** com a carga das demandas falha, a tela mostra o aviso "Não foi possível carregar as demandas" e, logo abaixo, "Toda demanda aberta tem alguma data." e "Nenhum dia com carga média ou alta neste período". O usuário pode concluir que não há pendência sem prazo nem dia cheio, o que é falso. A regra do projeto é nunca mostrar sucesso em falha.
- **Onde:** `src/ui/agenda.tsx:253` (`PainelDiasCheios`) e `:273` (`PainelSemPrazo`); os painéis não recebem `semDemandas`/`erroCarga` (`:284-285`, `:652-653`, `:680`). A mensagem de "carga indisponível" existe só na legenda e no aviso do Mês.
- **Ambiente e reprodução:** Edge, banco fictício com a falha simulada só nas demandas (a mesma técnica da suíte da Agenda). Dia, Semana e Mês, em 390 e 1360 px: os dois painéis mostram o texto afirmativo; o aviso geral aparece em todos. Capturas `a2-painel*-falha.png`.
- **Guia:** `accessibility` (estado e mensagens programáticas coerentes com o visual; 4.1.3 mensagens de estado) e `forms` (não afirmar estado que a interface não conhece).
- **Recomendação:** passar `erroCarga` aos dois painéis; em falha, esconder o selo e mostrar uma linha neutra, "Indisponível: as demandas não carregaram." (mesma altura baixa do vazio).
- **Aceite:** com a falha simulada, nenhuma frase afirmativa de "tem" ou "não tem" nos dois painéis em Dia, Semana e Mês; sem falha, textos iguais aos de hoje; teste novo em `testar:agenda`.

### Achado 3 (D mensurável, impacto no aparelho é H): arrastar custa 2,5 vezes mais com o próximo card montado

- **Impacto:** durante o arrasto cada movimento recalcula o estilo de toda a pilha, incluindo dois cards completos de fundo. Em Edge com CPU 4x mais lenta, mediana de 40 movimentos, 6 páginas novas por variante:

| Variante | Estilo (ms) | Tarefa (ms) | Quadro mediano | Pior quadro | Quadros acima de 50 ms |
|---|---|---|---|---|---|
| Publicado (`--prog` na pilha) | 1171 | 1541 | 38,3 ms | 71 ms | 4 |
| Sem cards de fundo (referência) | 459 | 631 | 16,4 ms | 35 ms | 0 |
| `@property` sem herança, `--prog` só nas faces (teste externo) | 189 | 486 | 16,7 ms | 76 ms* | 1 |

  \*um quadro isolado; a mediana é igual à da referência. Em 1x o custo seria cerca de um quarto; se o iPhone fica perto de 1x ou 4x deste computador **não foi medido** (H).
- **Peso estrutural:** no Início a pilha mantém 5 cards de fundo, 309 dos 807 nós da página (38%). Em Demandas, visão Cards no iPhone com 5 grupos, são 10 cards de fundo, **778 dos 1566 nós (50%)**, sempre montados, mesmo sem arrasto.
- **Causa:** `--prog` é escrita em `.ph-pilha` a cada `pointermove` (`src/ui/baralho.tsx:56`, `:60`, `:127`). Propriedade personalizada não registrada **herda**, então toda a subárvore (frente e faces) é reestilizada. `--dx` e `--rot` (`:54`) herdam para a subárvore da frente pelo mesmo motivo.
- **Guia e compatibilidade:** `progress-ring`, `spinner` e `icons` (propriedades registradas com `inherits: false`: "keep ... from inheriting"). Baseline: **Registered custom properties, Newly available desde 2024-07-09** (Chrome e Edge 85, Safari 16.4, Firefox 128). Segundo o `SKILL.md`, recurso "Newly" pede fallback: aqui o fallback é natural, porque sem suporte a regra `@property` é ignorada e o comportamento volta ao de hoje (mais lento, igual ao publicado).
- **Recomendação:** registrar `--prog`, `--dx` e `--rot` com `@property` (`inherits: false`) em `inicio.css` e escrever `--prog` nas próprias faces. Não adiar a montagem do próximo card (isso quebraria "face montada antes"). Não usar `will-change` extra.
- **Aceite:** repetir esta medição no mesmo script: estilo menor ou igual a 50% do atual e nenhum quadro acima de 50 ms em mediana; `testar:baralho` e `testar:fila-cards` verdes; visual do reveal idêntico nos dois temas. **Depende do iPhone:** sensação de fluidez do arrasto.

### Achado 4 (D de conteúdo, O de regra): "antecipar" aponta para data posterior, e dias passados entram em "Onde o mês aperta"

- **Impacto:** a sugestão diz "Considere antecipar ou redistribuir parte da carga para sexta-feira, 20 de novembro de 2026 (0 pendências)" num dia de 17/11: antecipar é mover para antes, e o alvo é depois. No mesmo painel aparece "Sexta-feira, 13 de novembro", que já passou (carga de atrasadas ajustadas), com a mesma sugestão.
- **Onde:** `src/lib/agenda.ts:199-209` (`diaMaisLivre` procura até 5 dias antes **ou depois**) e `:217` (texto fixo "antecipar ou redistribuir"); `:211-221` (`panorama` não exclui `data < hoje`).
- **Ambiente e reprodução:** Edge, build local, hoje 15/11/2026; 9 demandas em 17/11 e atrasadas em 13/11. Captura `a2-painel0-Edge-320-claro-125-mes.png`.
- **Recomendação (menor mudança):** trocar o verbo para "redistribuir" quando o alvo for posterior (ou sempre), e decidir com o Éder se o painel lista dias passados ou só o que ainda dá para mover. A parte de dias passados é decisão de produto (O).
- **Aceite:** teste em `testar:agenda-regras`: alvo posterior nunca usa "antecipar"; comportamento definido para `data < hoje`.

### Achado 5 (D em ambiente emulado, H para os aparelhos do Éder, baixo): campo de data com digitação invisível em Chromium de toque

- **Impacto:** onde o campo é editado por segmentos (Chromium com ponteiro `coarse`, como Android e Windows de toque), o texto nativo é transparente e a dica "Escolher a data" fica desenhada por cima: ao digitar "15" no dia, os dígitos não aparecem, a dica continua "Escolher a data" e o segmento selecionado se sobrepõe a ela (captura `a1-data-parcial-Edge-claro.png`). Em cores forçadas (alto contraste do Windows) o valor nativo reaparece sobre o texto desenhado (`a1-data-altocontraste-Edge-claro.png`).
- **Onde:** `src/ui/dia-indisponivel.tsx:19-26` e `src/estilos/app.css:151-156` (`@media (pointer: coarse)`: `color: transparent` e dica visível). Vale para Dias indisponíveis (Configurações e janela da Agenda) e, no local, para Pagamentos.
- **Ambiente:** Edge emulado com toque. No **iPhone e no iPad (Safari)** o campo é um seletor nativo sem segmentos e o valor é um bloco só: a hipótese **não** se aplica, e a correção da decisão 77 está certa para eles. O que só o aparelho comprova é a posição real do valor nativo no Safari.
- **Guia:** `forms` ("do not rely on placeholder alone"; rótulo associado por `for` e `id`, que está correto) e `browser-ui-theming` (preferir tematizar o controle nativo a recriá-lo).
- **Recomendação:** restringir a camada desenhada ao iOS, com `@supports (-webkit-touch-callout: none)` combinado a `(pointer: coarse)`, e desligá-la com `@media (forced-colors: active)`. O `-webkit-touch-callout` é específico do Safari de iOS e iPadOS e não é um recurso Baseline: uso apenas como detecção de plataforma, com o campo nativo como fallback. Alternativa sem detecção de plataforma: esconder a dica em `:has(input:focus)` e manter o valor nativo visível enquanto o campo tem foco.
- **Aceite:** no Edge de toque, digitar "15" deixa os dígitos visíveis e sem sobreposição; no WebKit e no iPhone a aparência atual não muda (as 34 verificações do campo continuam verdes); `forced-colors` sem texto duplicado.

### Achado 6 (O, médio): a prioridade da Prefeita e do Gabinete é só ordem, não aparece como regra

- **Impacto:** o pedido da Prefeita é o primeiro card em 4 dos 5 grupos (e em Nova urgência e Na fila), mas nada diz isso: o card só traz o nome da origem em 11 px com um ponto colorido (`OrigemP`, `src/ui/cartoes.tsx:15-16`), igual a qualquer outra origem. Ao passar "para o fim", o usuário não sabe se pulou uma prioridade.
- **Evidência:** `a4-iphone-grupo-prioridade.png`; checagem no DOM (sem selo de prioridade).
- **Recomendação:** selo discreto "Prioridade" (texto, não só cor) nos cards de origem prioritária (`demandaPrioritaria`) e uma frase no cabeçalho de "Na fila" e de Cards ("Prefeita e Gabinete primeiro"). Decisão de produto do Éder.
- **Aceite:** selo legível nos dois temas, com contraste mínimo de 4,5:1, sem cor como único sinal; o card continua sem barra de rolagem.

### Achado 7 (O, médio): grade de Cards no iPad e na web com grupos longos

- **Medido** (110 demandas em 5 grupos, 3 tarefas cada, Edge): iPad 820 px com 2 colunas, **página de 20.063 px (17 telas)** e 9.018 nós; web 1360 px com 4 colunas, 10.509 px (11,7 telas). O maior grupo (36) tem 6.390 px no iPad. Não há cabeçalho fixo de grupo, índice nem recolher. Os cards são montados todos de uma vez. Cards de uma única tarefa deixam muito espaço vazio por causa da altura fixa de 340 px (`--cardh`), o que é decisão de projeto.
- **Experimento negativo (relevante para não gastar esforço errado):** `content-visibility: auto` com `contain-intrinsic-size: auto 340px` aplicado por fora (guia `defer-rendering-heavy-content`, Baseline Newly desde 2025-09-15, Safari 26) **piorou** a carga a 4x: layout 1214 ms contra 764 ms e tarefa total 4553 ms contra 4154 ms; filtrar "Só atrasadas" 489 ms contra 451 ms. O custo dominante é o JavaScript de renderizar 110 cards (cerca de 37 ms por card a 4x), não layout nem pintura. **Não adotar.** No iOS anterior ao 26 a propriedade seria ignorada de qualquer forma.
- **Limite:** o volume real do Éder hoje é de dezenas de demandas, então a carga medida é um teste de estresse (H para uso real).
- **Recomendação (da menor para a maior):** (1) cabeçalho de grupo fixo (`position: sticky`) com contagem; (2) linha de atalhos com os grupos (âncoras) no topo; (3) recolher e expandir por grupo, com a escolha guardada neste aparelho. Se um dia o volume crescer, janelas de renderização por grupo entram em conflito com "todas à vista" e exigem decisão do Éder. Kanban e suas interações não são tocados.
- **Aceite:** nenhum card perdido (todos continuam alcançáveis e contados); o cabeçalho fixo não cobre o primeiro card nem a barra do iPad; Tab chega ao último card; Quadro intacto (`testar:fila-cards`).

### Achado 8 (O, baixo): arrastar à direita no Para hoje revela o próximo card mesmo quando o card não sai

- **Onde:** `src/ui/baralho.tsx:147,163` (face "ambos" sem olhar o que a direita faz). No Para hoje a direita é "Finalizar", "Avançar" ou "Escolher a etapa": pode abrir confirmação ou menu e o card fica. Medido nos dois motores com rótulo "Finalizar": o próximo card aparece por inteiro com o dedo a 50 px.
- **Recomendação:** revelar só quando a ação da direita for navegação, ou aceitar como está porque, no caso comum (Vistos ou Fazendo), o próximo assume a frente após a gravação.
- **Aceite:** definido pelo Éder; se mudar, o gesto continua devolvendo o card.

### Achado 9 (O, baixo): textos auxiliares que não agem ou não aparecem em toque

- `src/ui/agenda.tsx:271`: "e mais N. Elas aparecem em Demandas, com o filtro Sem prazo." é texto puro; os painéis têm "linhas acionáveis", este item não. Sugestão: botão que abre Demandas com o filtro Sem prazo.
- `src/ui/agenda.tsx:238,262,306`: explicações em `title` (selo de quantidade, amostras da legenda) não aparecem ao toque. A informação essencial já está no texto acessível (`sr-only`), então é só conveniência.
- Assuntos muito longos geram linhas de até 7 linhas a 320 px e 125% em "Pendências sem prazo". É o combinado (quebra em vez de cortar) e não é defeito; se incomodar, limitar a 3 linhas com o texto completo ao abrir.

### Achado 10 (H, baixo, antigo): o verso do card pode receber o toque no motor do Safari

- No WebKit do Playwright (e só nele), `document.elementsFromPoint` sobre a caixa da próxima tarefa lista `ul.tarefas` e `div.face` do **verso** (`backface-visibility: hidden`, `rotateY(180deg)`) antes da frente, e o Playwright recusa o clique ("`button.t-lapis` from `div.face.back` intercepts pointer events"). No Edge isso não acontece. O flip é anterior às decisões 76 e 77 e o Éder já usou o iPhone sem relatar problema.
- **Só o iPhone comprova:** tocar a caixa da próxima tarefa e o lápis de um card em Demandas e no Início. Se falhar, `pointer-events: none` e `visibility: hidden` na face oculta.

### Achado 11 (O, baixo): ordem em dois lugares

- `lib/fila.ts` (Cards por grupo) e `lib/para-hoje.ts` (`elegiveisParaHoje`, usada por "Na fila" e Nova urgência) ordenam por critérios parecidos, mas não iguais: a segunda põe "rápida" antes da data e exclui o que está além de 7 dias. Hoje não há divergência observável nos dados de teste. Sugestão: um teste que compare as duas ordens em um conjunto com demandas rápidas e depois decidir qual regra vale, para a documentação da decisão 77 ("a mesma ordem") continuar verdadeira.

### Achado 12 (H, observação exclusivamente local): Pagamentos herda o campo de data

- Quando Pagamentos for publicado (depende da migração `20261115000000_pagamentos` e de autorização própria para o Supabase real), valem para ele os achados 1 a 5 aplicáveis a `CampoData`. Nenhuma verificação nova é necessária hoje.

## 6. Menor sequência de correções proposta

Ordem pensada para risco baixo e verificação barata. Nada disto foi feito: aguardo a aprovação.

1. **Foco nos botões do baralho (achado 1).** Uma linha de intenção em `baralho.tsx:169-170`. Teste novo em `testar:baralho`. Sem mudança visual.
2. **Painéis em falha (achado 2).** Passar `erroCarga` aos dois painéis e trocar o texto. Teste em `testar:agenda`.
3. **`@property` no arrasto (achado 3).** Três regras em `inicio.css` e a escrita de `--prog` nas faces em `baralho.tsx:56,60`. Repetir a medição acima e as suítes do baralho.
4. **Texto da sugestão (achado 4).** Troca de verbo e, se o Éder quiser, filtro de dias passados. Teste em `testar:agenda-regras`.
5. **Campo de data fora do iOS (achado 5).** Só CSS (`app.css:151-156`). Repetir `testar:campos` (34 verificações do campo e do cabeçalho) e a captura de digitação parcial.
6. **Decisões de produto, uma rodada curta:** selo de prioridade (6), cabeçalho fixo e atalhos de grupo (7), revelar à direita no Para hoje (8), limpezas de texto (9).

## 7. O que só o iPhone ou o iPad comprova

Fluidez real do arrasto e do `--prog` (achado 3); posição do valor nativo e do seletor do campo de data; toque na caixa da tarefa e no lápis com o verso do card (achado 10); leitura por VoiceOver e Controle por Botão (achado 1); tamanho de texto do sistema; barra inferior e área segura ao fim da rolagem (não medi o fim da rolagem nesta rodada).

## 8. Suítes de regressão rodadas nesta rodada

Sobre o código atual (`1a6dd5f`): `testar:fila` 16 de 16, `testar:fila-cards` 117 de 117 (Edge e WebKit emulado) e `testar:baralho` 91 de 91. **Todas passam, e mesmo assim os achados 1, 2 e 3 existem**: as suítes não cobrem foco depois da troca por botão, texto dos painéis em falha nem custo do arrasto. Os achados 1 a 3 pedem verificações novas. As suítes de navegador usam `next dev`; as medições desta auditoria usam o build de produção. As suítes `campos`, `agenda` e `ajustes` não foram repetidas; valem as da entrega anterior (444, 390 e 604 no recorte publicado) e as verificações dirigidas acima.

## 9. Correções aplicadas depois desta auditoria (decisão 78, só local)

Aplicadas em quatro commits sobre `1a6dd5f`, sem tocar em Pagamentos, na migração nem na prévia: achado 1 (`be1acc3`), achados 2 e 4 (`3986484`), achado 5 (`a89a263`) e achado 3 (`52175dd`). Medição do achado 3 repetida com os handlers reais do app: estilo 859 para 145 ms em CPU 4x e 100 para 18 ms em 1x; quadro mediano 33 para 16,7 ms; quadros acima de 50 ms de 2 para 0. Nova suíte `testar:auditoria` (110 verificações) falha em 39 delas no código anterior. Os achados 6 a 9 e 11 seguem como decisão de produto e o 10 como hipótese; o registro completo está na decisão 78 de `DECISOES.md` e o roteiro de conferência no Safari real na seção AG de `CONTINUIDADE-DMANDA.md`.
