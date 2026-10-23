# SINCRONIZA-PROJETINHO

Guia para continuar o Dmanda em outro computador a partir do ponto exato em que paramos. Contém: onde estamos, histórico das sessões, o que depende de **você** (nada foi decidido pelo Claude em seu lugar), avaliação das duas ferramentas novas, plano de blocos de trabalho maiores com modelo e effort sugeridos, como sincronizar e o prompt para retomar.

**Última atualização:** sessão de 22 para 23/10/2026, no computador de casa. A próxima sessão será no computador do trabalho (sem administrador).
**Andamento do projeto: 18%** (cálculo em `ANDAMENTO.md`).
**Repositório:** https://github.com/edermoliveira/Dmanda.git (privado).

---

## 1. Onde estamos

- **Protótipo** (`prototipo/`, HTML, CSS e JS puros, dados fictícios): quatro temas (Aurora, Papel, Grafite e o experimental Catalyst), claro e escuro, celular, iPad e computador. A rodada 3 de ajustes foi aplicada e testada (commit `492778b`) e **aguarda a sua avaliação**.
- **Testes automáticos** (novos): `prototipo/testes/clicar-tudo.mjs` clica em todos os controles de todas as telas, mede contraste, estouro de layout e erros de JavaScript. `prototipo/testes/fluxos.mjs` confere 17 fluxos de uso. Última rodada completa (quatro temas, claro e escuro, computador e celular): **6.370 cliques, 0 erros, 0 problemas de contraste, 0 estouros, 0 controles não clicáveis**.
- **Código real em `src/`:** ainda é o design antigo de 20/10/2026 e será substituído quando a construção real começar.
- **Figma:** o limite gratuito acabou (ver seção 5.4). Nada pendente depende dele agora.
- **Nada foi instalado** além do `playwright-core` (dependência de desenvolvimento do projeto, já no `package.json`). As duas ferramentas novas só foram avaliadas.

---

## 2. Histórico

### 21/10/2026 (resumo)
Planejamento concluído e decisões gravadas em `DECISOES.md`. Escopo ampliado (Entradas, Agenda, Documentos, IA, Configurações, humor, clima, PWA). Design system antigo será refeito do zero. Protótipo de três direções criado.

### 22/10/2026, manhã e tarde (resumo)
Temas Aurora, Papel e Grafite definidos como definitivos. Rodada 2 do protótipo (menu recolhido, Perfil em gaveta, aviso de retorno, compromissos por tipo, cards sem rolagem, rascunho que nunca se perde, botões estilo Apple). Figma conectado (kit "iOS and iPadOS 27"). Quarto tema, **Catalyst**, criado e testado (Liquid Glass, movimento com mola, folhas, menus). Primeira versão deste documento criada.

### 22 para 23/10/2026, noite (este chat, computador de casa)

1. **Retomada:** `git pull` confirmou que estava atualizado. Documentos lidos. Memória local já existia. Protótipo subido em http://127.0.0.1:7200.
2. **Sua avaliação do Catalyst e da rodada 2** (texto colado): Início com "Amanhã", botões menos arredondados e mais harmônicos, Concluir demanda menor e mais fino, tarefas e tudo alterável, etapa "Vista" vira "Vistos", texto das notas de um tamanho só, "+" em cada dia da Agenda, IA que registra entrada ou evento, widgets com Pomodoro, revisão geral do Catalyst com o kit do Figma, e quatro questões para o futuro (testes, backup, segurança com login após 6 horas sem uso, velocidade).
3. **O que foi feito:** tudo isso foi aplicado (detalhes em `DECISOES.md`, "Avaliação do protótipo, rodada 3"). Arquivos novos: `prototipo/v5.css` e `prototipo/v5.js`. Ajustes em `app.js`, `extra.js`, `catalyst.css` e `index.html`.
4. **Testes:** o script de cliques foi recriado e agora vive no repositório. O primeiro teste achou defeitos reais, todos corrigidos: o card girava antes do clique quando o mouse mirava no "Concluir demanda"; as etiquetas "Portaria" e "Pedido de informação" e os fins de semana da Agenda estavam abaixo do contraste mínimo; os botões "+" e "..." das colunas do Quadro passavam da borda; o círculo das tarefas desmarcadas não aparecia no Catalyst; o botão de menos do Pomodoro não desligava no mínimo.
5. **Figma:** a leitura do kit parou depois de Widgets, Botões e Campos de texto por causa do limite do plano gratuito (20 chamadas de leitura por mês, sem data de renovação informada). Detalhes na seção 5.4.
6. **Perguntas suas respondidas:** GitHub Issues (proposta feita, aguarda você), limite do Figma, graphify (ainda não compensa).
7. **Avaliação das duas ferramentas novas** (no-ai-slop e Open Notebook): seção 5 e `ANALISE-FERRAMENTAS.md`, seção 11.
8. **Fechamento:** commit de tudo e envio ao GitHub a seu pedido expresso, sem incluir a pasta solta `Desktop\Dmanda\Dmanda`.

---

## 3. O que depende de VOCÊ (nada disto foi decidido pelo Claude)

### Decisões
1. **GitHub Issues:** você disse "passaremos a usar". **Ainda não foi criado nada.** A proposta do Claude está pendente de aprovação: etiquetas em português (`decisão sua`, `defeito`, `melhoria`, `ideia`, `técnico`, `protótipo`, `aguardando você`), marcos com as etapas do `DECISOES.md`, `PENDENCIAS.md` virando só um índice com links, commits citando a issue ("fecha #12"). Responda "aprovo", ajuste, ou diga "pode criar".
2. **no-ai-slop:** instalar como está, criar uma versão em português dentro do projeto, ou não usar (seção 5.1).
3. **Open Notebook:** o Claude avaliou que **não serve** como IA do sistema (seção 5.2). Confirme se aceita essa conclusão ou quer outra análise.
4. **Concluir demanda:** deixei o fundo azul claro (mais sutil). Manter, ou voltar ao azul cheio já mais fino?
5. **Avaliar a rodada 3 e o Catalyst** (http://127.0.0.1:7200; no Catalyst, clicar em "D Catalyst"; se algo parecer antigo, Ctrl+F5): dizer o que ainda destoa.
6. **Escolher os padrões de cada tema** (Aurora, Papel e Grafite): par de fontes, estilo de ícones e paleta padrão. Hoje há padrões provisórios.
7. **Figma:** esperar o limite renovar ou exportar as 8 páginas que faltam como imagem (seção 5.4).
8. **Plano de blocos e de modelos (seção 6):** aprovar, ajustar ou recusar.

### Ações fora do Claude Code
9. **No Explorador de Arquivos:** conferir a pasta `Desktop\Dmanda\Dmanda` (no computador de casa). É uma cópia limpa do repositório, igual a um commit antigo, provavelmente de um `git clone` feito dentro do projeto sem querer. Pode apagar sem perda. O Claude não mexeu nela e não a incluiu no commit.
10. **Sem pressa:** criar o banco de 500 frases da mensagem do dia; enviar `energia-1.png` a `energia-5.png` em `prototipo/emojis/` (opcional).

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

- O `git log` deve mostrar no topo o commit "Sincronização de 22 para 23/10/2026..." (que inclui este arquivo), logo acima do `492778b` (rodada 3).
- O `npm install` agora também instala o `playwright-core`, usado pelos testes. Ele **não baixa navegador**: usa o Microsoft Edge que já vem no Windows.
- Ver o protótipo: `cd prototipo` e `python -m http.server 7200`, depois abrir http://127.0.0.1:7200. Os testes têm servidor próprio e não precisam desse comando.
- Conferir o ambiente: dentro de `prototipo`, `node testes/fluxos.mjs` (cerca de 1 minuto). Deve terminar com "Todos os fluxos passaram."
- GitHub Issues: conferir `gh --version`. Se o `gh` não existir no trabalho, as issues podem ser criadas pelo site do GitHub (não instalar nada que peça administrador).

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
- **Funciona para texto, mas só em inglês:** as listas de padrões e palavras estão em inglês. O português tem vícios próprios, e a skill pegaria pouco nos nossos textos como está.
- **Não é para o visual.** Para a "cara de IA" das telas, a taste-skill (já instalada) é a ferramenta.
- **Opções para você decidir:** (a) instalar como está e testar em português; (b) criar uma **versão em português** no projeto (`.claude/skills/`, com a licença MIT junto), com as nossas regras (sem travessão, tom simpático e direto, sem bajulação); (c) não usar. Ajudaria em: textos da interface, mensagens do sistema, as 500 frases do dia, respostas da IA e documentos.
- Instalação, se aprovada: `npx skills add petergyang/no-ai-slop --skill no-ai-slop --global --yes` (grava na pasta do usuário; confirmar que não pede administrador). Falta ler o `eval.md` antes.

### 5.2 Open Notebook (não é skill)
- É um **aplicativo completo** (parecido com o NotebookLM do Google): Python, Next.js, banco SurrealDB, roda com **Docker Compose**, aceita mais de 20 provedores de IA. Licença MIT.
- **Não funciona como a IA do Dmanda:** (1) exige servidor sempre ligado e Docker (o Dmanda roda na Vercel, e o Docker Desktop pede administrador, que o trabalho não dá; hospedar em outro lugar custaria dinheiro); (2) vem **sem senha** e aberto na rede, o que é arriscado com dados da Prefeitura; (3) foi feito para **pesquisar documentos**, não para **executar ações no nosso banco com Desfazer**, que é a nossa decisão para a IA.
- **Usos possíveis, nenhum urgente:** referência de desenho para trocar de provedor de IA; ou uma ferramenta separada, só no computador de casa, para pesquisar PDFs quando chegar a etapa Documentos.

### 5.3 Graphify e mapas de código
Ainda não compensa (cerca de 5 mil linhas de código). Reavaliar depois da versão mínima de Demandas, junto com o Trail-code, e ficar com um só.

### 5.4 Figma (plano gratuito)
Plano Starter: **20 chamadas de leitura por mês**, escrever não conta. As 20 já foram usadas. A documentação não diz quando renova (o Claude tenta de novo em novembro e relata). Alternativa grátis: você exporta como PNG as páginas que faltam (Steppers, Progress Indicators, Popovers, Alerts, Empty States, Contextual Menus, Date and Time Pickers, Examples) e salva numa pasta do projeto; o Claude lê as imagens.

---

## 6. Blocos de trabalho maiores (sugestão, aguarda sua aprovação)

**Regra para daqui em diante:** blocos **maiores**, com início, fim e entrega testada, em vez de passos pequenos. **No fim de cada bloco** o Claude informa: o percentual do projeto, o que ficou pendente de você e **qual modelo e qual effort sugere para o próximo bloco**. O modelo e o effort são sempre uma sugestão: quem troca é você (`/model` e `/effort`).

Hoje o padrão salvo é **Sonnet 5.5 com effort high**.

| Bloco | O que entrega | Modelo sugerido | Effort sugerido | Andamento ao fim (estimativa) |
|---|---|---|---|---|
| **A. Abertura** (curto) | Sincronizar, suas decisões da seção 3, criar issues (se aprovado), ler skills | Sonnet 5.5 | medium | 18% |
| **B. Fechar o design system** | Ajustes da sua avaliação, padrões de cada tema, página de peças com os 5 estados, conferência de contraste, teste completo | Sonnet 5.5 | high | cerca de 20% |
| **C. Base técnica** | Projeto novo sobre os temas, banco Postgres (escolher Neon ou Supabase depois de confirmar limites), login Google com expiração após 6 horas sem uso, publicação na Vercel, backup em mais de um lugar, `.env.example` | **Opus 5.5** | **high** (xhigh para segurança e backup) | cerca de 32% |
| **D. Demandas e Início, versão mínima** | Cadastro, cards, quatro visões, tarefas editáveis, prazos, arquivo; Início com filtros e Foco do dia; testes de cliques no sistema real | Opus 5.5 no desenho dos dados, depois Sonnet 5.5 | high | cerca de 45% a 50% |
| **E. Entradas e Agenda** | Notas, virar demanda, Agenda local com "+" por dia, eventos | Sonnet 5.5 | high | cerca de 60% |
| **F. Configurações, busca e "+"** | Paletas, fontes, tamanhos, widgets, busca global, exportar e importar | Sonnet 5.5 | medium a high | cerca de 70% |
| **G. Humor, produtividade, clima, Perfil** | Balões, gráficos, Open-Meteo | Sonnet 5.5 | medium | cerca de 78% |
| **H. IA que registra entrada e evento** | Texto livre vira entrada ou evento com Registrar, Ajustar e Desfazer, provedor trocável, filtro de dados | **Opus 5.5** | high | cerca de 90% |
| **I. Google Calendar e Drive, Documentos** | Sincronização só do Dmanda para o Google, Documentos | Sonnet 5.5 | high | 100% |

Cada bloco termina com `node testes/clicar-tudo.mjs` (ou o equivalente do sistema real) sem pendências. As porcentagens são estimativas do Claude e valem só como guia. A ordem segue `DECISOES.md`, seção 1, que continua sendo a fonte oficial.

---

## 7. Regras de condução (valem para toda sessão)

- **Nenhuma decisão é tomada pelo Claude sem o seu conhecimento e autorização prévios.** Dúvidas viram pergunta no chat, em rodada curta, e a resposta é gravada em `DECISOES.md`.
- **Nunca `git push` sem a sua autorização.** Em 23/10/2026 você autorizou o envio desta rodada. Para as próximas, o Claude pergunta de novo.
- Tudo em português do Brasil, sem travessão, commits em português a cada avanço.
- Testar no navegador de verdade antes de dizer que está pronto.
- Avisar em **negrito** quando você tiver que fazer algo fora do Claude Code.
- Terminar toda resposta com "Andamento do projeto: X%".
- Não pagar nada além de Claude Pro e ChatGPT Plus. Instalar skills, plugins e MCPs só na hora de usar e depois de ler o que escrevem.

---

## 8. Prompt para colar no Claude Code (computador do trabalho)

Abrir o Claude Code dentro da pasta do Dmanda e colar:

```
Estou continuando o projeto Dmanda em outro computador (trabalho, sem administrador). Antes de qualquer coisa:
1. Rode git pull e npm install. Confirme que o último commit é "Sincronização de 22 para 23/10/2026..." e que inclui o SINCRONIZA-PROJETINHO.md.
2. Leia CLAUDE.md, DECISOES.md (rodada 3 e "Questões para o futuro"), PENDENCIAS.md, ANDAMENTO.md, SINCRONIZA-PROJETINHO.md e a seção 11 do ANALISE-FERRAMENTAS.md.
3. Confira a memória local (usuário único admin, regras de custo e máquina, nunca fazer push sem minha autorização, terminar toda resposta com "Andamento do projeto: X%") e recrie ou atualize o que faltar.
4. Dentro de prototipo, rode node testes/fluxos.mjs para confirmar que o ambiente funciona, suba o protótipo (python -m http.server 7200) e me avise.

Onde paramos: a rodada 3 do protótipo (widgets com Pomodoro, IA que registra entrada ou evento, tarefas editáveis, etapa Vistos, "+" por dia na Agenda, escala única de botões, Catalyst revisado) está pronta, testada e enviada ao GitHub (commit 492778b e o de sincronização). Andamento: 18%. Aguardo decidir os itens da seção 3 do SINCRONIZA-PROJETINHO.

Pauta de hoje: (a) conversar sobre as duas ferramentas novas, no-ai-slop e Open Notebook. A avaliação do Claude está na seção 5 do SINCRONIZA-PROJETINHO e na seção 11 do ANALISE-FERRAMENTAS. Não instale nada antes da minha decisão. (b) Me apresente, um item por vez, as decisões pendentes da seção 3. (c) Depois, siga o plano de blocos da seção 6, só o que eu aprovar.

Regras: nenhuma decisão sem meu conhecimento e autorização prévios; tudo em português do Brasil, sem travessão; commits em português a cada avanço; blocos de trabalho maiores; no fim de cada bloco me diga o percentual do projeto e sugira o modelo (Opus ou Sonnet) e o effort do próximo bloco; testar no navegador de verdade (testes/clicar-tudo.mjs) antes de dizer que está pronto; avisar em negrito quando eu tiver que fazer algo fora do Claude Code; nunca fazer git push sem autorização.
```

---

## 9. Antes de fechar o Claude Code (checklist)

- [ ] `git status` limpo (só a pasta solta `Dmanda/` pode aparecer como não rastreada).
- [ ] `git log origin/main -1` igual ao `git log -1` (nada ficou só no computador).
- [ ] Este arquivo e o `PENDENCIAS.md` estão no último commit.
