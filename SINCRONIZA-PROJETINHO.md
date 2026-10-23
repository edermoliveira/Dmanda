# SINCRONIZA-PROJETINHO

Guia para continuar o Dmanda em outro computador a partir do ponto exato em que paramos. Contém: onde estamos, histórico das sessões, o que depende de **você** (nada foi decidido pelo Claude em seu lugar), o plano do Figma (só o que faltou), a avaliação das ferramentas, o plano de blocos de trabalho maiores com modelo e effort sugeridos, como sincronizar e o prompt para retomar.

**Última atualização:** 23/10/2026, no computador do trabalho, com um ponto de retomada na branch `checkpoint/2026-10-23-ajustes-a-d` (seção 0). A próxima sessão será em casa.
**Andamento do projeto: 18%** (cálculo em `ANDAMENTO.md`).
**Repositório:** https://github.com/edermoliveira/Dmanda.git (privado).

---

## 0. PONTO DE RETOMADA (checkpoint de 23/10/2026, computador do trabalho)

**Branch do checkpoint:** `checkpoint/2026-10-23-ajustes-a-d` (enviada ao GitHub com autorização expressa; **sem merge na main**). Para continuar em casa, **no PowerShell, dentro da pasta do projeto:** `git fetch` e `git checkout checkpoint/2026-10-23-ajustes-a-d`, depois `npm install`.

**Trabalho realizado (implementado, commitado nesta branch):**
- A. Descrição opcional nas demandas (cadastro, edição, cards, Quadro, Início, Lista), em mono, até 3 linhas.
- B. Vidro cerca de 30% mais transparente por um fator único (`--vidro: .7`).
- C. Cores dos processos restauradas (causa: empate de especificidade no Catalyst), faixa do tipo no card atrasado.
- D. Menu lateral: ícone selecionado legível, mesmo desenho em todos os estados, seleção por forma, nome acessível.
- Correções achadas pelo teste: contraste de "Concluir demanda", "Finalizada" e "Reabrir demanda" no modo escuro e claro; botão mini só com ícone no Catalyst. Detalhes em `DECISOES.md`, seção "Ajustes A a D".

**Atividade interrompida (incompleta):** investigação de dois defeitos **antigos** do Catalyst no celular (existem também no commit `c314b53`, não vêm do trabalho de hoje): (1) o botão de busca do topo (`.icbtn.buscabtn`) é acusado de "texto maior que o botão" em todas as telas; (2) "Cadastro 0" no Quadro com contraste 1:1 (rótulo da aba selecionada some). Pistas: `catalyst.css` linhas 63, 80 e 176 a 178 e `v3.css` linhas 60 e 61 (aba selecionada com `--acc`/`--acc-ink` contra o fundo `var(--card)` do Catalyst). **Nada foi alterado para esses dois defeitos.**

**Testes concluídos (passaram, 0 problemas):** `ajustes-a-d.mjs` nos 4 temas, claro e escuro; `fluxos.mjs`; `clicar-tudo.mjs` no computador nos 4 temas, claro e escuro (8 combinações), e no celular Aurora claro e escuro, todos depois das últimas correções de CSS.

**Verificações pendentes:** `clicar-tudo.mjs d claro phone` e `d escuro phone` **falham** pelos dois defeitos antigos acima. Papel e Grafite no celular nunca foram rodados. Não houve aprovação visual sua dos itens A a D.

**Decisões suas pendentes:** (1) biblioteca de ícones (apresentar exemplos de normal e selecionado e a recomendação, sem adicionar dependência antes da sua decisão); (2) configuração das ferramentas, começando pela Impeccable, um item por vez (nada instalado); (3) avaliação visual de A a D; (4) autorização para o merge na main, se quiser.

**Próxima ação em casa:** rodar `node testes/ajustes-a-d.mjs` e `node testes/fluxos.mjs` para confirmar o ambiente; corrigir os dois defeitos do Catalyst no celular e rodar `clicar-tudo.mjs d claro phone`; depois apresentar a proposta dos ícones.

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
12. **Sem pressa:** criar o banco de 500 frases da mensagem do dia; enviar `energia-1.png` a `energia-5.png` em `prototipo/emojis/` (opcional).

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
| **C. Base técnica** | Projeto novo sobre os temas, **PWA configurado para iPhone e iPad**, banco Postgres (Neon ou Supabase, depois de confirmar limites), login Google com expiração após 6 horas sem uso, publicação na Vercel, backup em mais de um lugar, `.env.example`, arquitetura pronta para virar nativo | **Opus 5.5** | **high** (xhigh para segurança e backup) | cerca de 32% |
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
