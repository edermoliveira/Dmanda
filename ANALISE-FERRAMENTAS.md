# Análise de ferramentas, skills e sites de design

Data: 21/10/2026. Base: pesquisa nas páginas oficiais de cada item. Quando a página não informava algo (licença, preço), está escrito "não confirmado". Nada foi instalado nem removido (a única limpeza proposta, do item 1, depende de um comando seu).

Critério: o Dmanda é um painel pessoal, de um único usuário, que precisa ser rápido, claro e agradável para quem tem TDAH. Efeito bonito só entra se ajudar a ler, decidir ou se sentir bem usando, e se não deixar o sistema pesado no celular.

---

## 1. Ambiente do Claude Code (o que já estava instalado)

| Item | Onde | Decisão | Motivo |
|---|---|---|---|
| claude-code-setup (plugin) | projeto Dmanda | **Desativado** (feito pelo usuário em 21/10/2026, conferido) | Serve para recomendar automações uma vez. Já cumpriu o papel. |
| ui-ux-pro-max (plugin, 7 skills) | projeto Dmanda | **Manter por enquanto, remover depois** | Traz bases de paletas, pares de fontes e regras de UX úteis agora, na refação do design system. Mas suas skills de banner, slides, marca e logo por IA não servem. Remover quando o design system estiver pronto. |
| context7 (MCP) | usuário | **Manter** | Documentação atual de bibliotecas. Essencial, porque o Next.js deste projeto tem mudanças de versão. |
| frontend-design (plugin) | outro projeto (ADMINISTRACAO-PAINEL) | Não mexi | Não é do Dmanda. |
| ui-ux-pro-max-cli (npm global) | máquina | Não mexi | Duplica o plugin e é global. Pode sair depois, com o plugin. |
| codex, rio-a-dois (npm global) | máquina | Não mexi | Não são do Dmanda. |
| marketplace gsap-skills | usuário | Não mexi | Não instalado, não pesa. Só é útil se formos usar GSAP. |

Resultado esperado: o projeto passa de 2 plugins para 1 e, quando o design system estiver pronto, para 0.

---

## 2. Ferramentas de desenvolvimento sugeridas

### Trail-Code (você chamou de GRAFT)
- O que é: CLI MIT que faz um mapa do código (sem IA, sem chave) e guarda "aprendizados" das conversas em arquivos markdown no repositório.
- Prós: reduz leitura de arquivos a cada prompt (o fabricante diz 23% a 42% menos tokens, números dele, sem teste independente). Os aprendizados vão para o Git e acompanham você entre o computador do trabalho e o de casa.
- Contras: **mexe em arquivos globais** (`~/.claude/`, `~/.claude.json`) e cria `.mcp.json`, `AGENTS.md` e `.trail/` no projeto. O `AGENTS.md` já é gerenciado pelo Next.js. A página não confirma funcionamento em Windows sem administrador. O projeto ainda é pequeno, então o ganho agora é quase zero.
- Observação: o nome mudou de "graft" para "Trail-code". O pacote `@trailhq/trail-code` e a organização `trailhq` são recentes, então vale a revisão que o `--dry-run` permite.
- **Veredito: útil, mas adiar.** Instalar quando houver ~30 arquivos de código (após a Fatia 1). Antes disso, rodar `trail init --dry-run` e ler o que seria escrito. Ele **não substitui** o context7 (que traz documentação externa). Pode substituir o claude-mem (item abaixo), pois cobre "lembrar entre sessões" de forma mais leve.

### Claude-mem
- Faz resumos de cada sessão com IA e os traz de volta. Instala worker local, Bun, uv e banco vetorial (Chroma). Os resumos **gastam tokens do seu plano**, depois do teste de 30 dias.
- **Veredito: descartar.** Já temos três camadas baratas de memória: CLAUDE.md, PENDENCIAS.md/ANDAMENTO.md e a memória do Claude. Claude-mem soma peso (processo rodando, banco) e consumo, e o ganho se sobrepõe ao Trail-code.

### ECC (affaan-m/ecc)
- 71 agentes, 311 skills, 97 comandos, hooks e rules. O próprio README recomenda perfil seletivo por causa do peso. Há hooks que podem bloquear ações, conteúdo comercial e um comando que envia diff à OpenAI.
- **Veredito: não instalar o pacote.** Para um projeto deste tamanho é peso demais, e gasta tokens à toa. O que presta (frontend-patterns, tdd-workflow, e2e-testing, security-review) pode ser lido como referência, sem instalar.

### Skills de Matt Pocock (engineering)
São 20 skills. Avaliação de cada uma para o Dmanda:

| Skill | Veredito | Por quê |
|---|---|---|
| grill-with-docs | **Útil** | Faz entrevista sobre o domínio e atualiza glossário e decisões. É o que estamos fazendo à mão. Boa para a refação. |
| tdd | **Útil depois** | Para as regras de prazo, atraso e 30 dias automáticos, onde erro silencioso é caro. |
| diagnosing-bugs | **Útil** | Sob demanda, sem peso. |
| prototype | **Útil** | Testar telas descartáveis antes de decidir o design. |
| research | Opcional | Eu já pesquiso. |
| domain-modeling, codebase-design | Opcional | Cobertos pelo grill-with-docs. |
| code-review | Já temos | `/code-review` já existe. |
| pr, triage, to-spec, to-tickets, implement, implement-spec, wayfinder, retro, ask-matt, setup-matt-pocock-skills, improve-codebase-architecture, wizard | **Descartar** | Fluxo de equipe com issue tracker (GitHub Issues), PRs e tickets. Há um único usuário e não usamos tracker. |
- **Veredito:** instalar no máximo `grill-with-docs`, `tdd` e `diagnosing-bugs`, copiando só essas três pastas para `.claude/skills/` do projeto. Não instalar o conjunto.

### aitmpl (comando npx com 4 agentes, 3 settings, 8 MCPs, 6 skills)
| Item | Veredito | Por quê |
|---|---|---|
| agentes code-reviewer, frontend-developer, backend-architect, mobile-developer | **Descartar** | Genéricos, duplicam o que já faço, e cada agente listado gasta contexto. |
| statusline context-monitor | Opcional | Só se quiser ver o consumo. |
| environment performance-optimization, development-utils | **Descartar** | Vagos. |
| MCP context7 | Já temos | |
| MCP playwright | **Útil** | Para eu testar telas no navegador, inclusive no tamanho de celular. O projeto já usa capturas (`npm run capturar`). Instalar quando começarem as telas, preferindo o pacote oficial da Microsoft. |
| MCP memory-integration, github-integration | **Descartar** | Duplicam memória e o `gh`. |
| MCP postgresql-integration | **Adiar** | Só quando escolhermos o banco. Pode ser outro. |
| MCP figma-dev-mode | **Descartar** | Não usamos Figma. |
| MCP markitdown | Adiar | Útil quando chegar Documentos e importação de .docx/.pdf. |
| skills frontend-design, ui-design-system, senior-frontend, senior-backend, senior-architect, code-reviewer | **Descartar** | Genéricas e redundantes com o ui-ux-pro-max e com o context7. |
- **Veredito:** não rodar o comando. Pegar só o Playwright, no momento certo.
- Cuidado geral: o catálogo inclui hooks e MCPs que executam código. Sempre ler antes de instalar.

### shadcn (skills, MCP, componentes)
- Traz o que o painel precisa e que é difícil acertar à mão: Sidebar, Calendar, Date Picker, Data Table, Command (a pesquisa rápida), Sheet e Drawer (painéis no celular), Dialog, Toast, Tabs, Progress, Chart, Select, Switch, Slider.
- É código copiado para o seu projeto (você é dono dele), sobre Radix, com acessibilidade resolvida (teclado, foco, leitor de tela). Compatibilidade com Tailwind v4 e React 19 existe, mas a página consultada não confirma, então confirmo na instalação.
- **Veredito: adotar como base de comportamento**, aplicando por cima o nosso visual (tokens, vidro, paletas). É a escolha com melhor custo-benefício de todo o documento, e evita reinventar calendário e barra lateral.

---

## 3. Sites e bibliotecas de UI

### Fonte principal de componentes
| Site | O que vi | Veredito |
|---|---|---|
| **BoardUI** | Servidor MCP que instala componentes no projeto, registro compatível com shadcn, Tailwind v4. Sidebar, Date Picker, Data Table, Notification Center e Stat Cards são **gratuitos**. **Calendar e AI Chat são Pro** (chave de licença paga). Preço não informado. | **Usar os gratuitos como inspiração e base.** Calendar e AI Chat: não pagar (regra do projeto). Fazer o calendário com o do shadcn e o chat com componentes próprios. Verificar a lista completa dos 20 exemplos com o MCP antes de decidir cada um. |
| **Liqui UI** (do liquidglassdesign.com) | Componentes React de vidro líquido, "gratuitos e open source", licença não confirmada. | **Candidato**, mas ver a seção "Vidro e Apple" abaixo. |
| **Magic UI** | Dock, Confetti, Number Ticker, Animated List, barra de progresso circular. Licença e instalação não confirmadas na página. | **Seletivo**: Number Ticker (números dos indicadores), Confetti (concluir demanda), Animated List (entradas). Só esses. |
| **Fancy Components** | 40 itens, a maioria efeitos de texto e física decorativos. | **Descartar** quase tudo: decoração que atrapalha leitura. Exceção possível: nenhuma agora. |
| **CanvasUI** | Efeitos "html-in-canvas" (vidro, líquido, glitch, VHS). Pesado na GPU, licença não confirmada. | **Descartar**. Risco de lentidão no celular e nenhum benefício funcional. |
| **Bencho** | A página só mostra o título (micro-interações React). | **Não confirmado**, adiar. |
| **Gauge UI** | Medidores em SVG, estilo velocímetro, via shadcn. Preço e licença não confirmados. | **Útil em um ponto**: medidor de "carga do dia" ou de progresso da demanda. Leve (SVG). Usar um único estilo, sem excesso. |
| **Uiverse (card com flip)** | Site bloqueou a leitura (403). | O flip é só CSS (`perspective`, `rotateY`, `backface-visibility`), eu faço sem biblioteca. Ver pergunta sobre toque no celular. |

### Fundo e visual
| Site | Veredito |
|---|---|
| **23rd.dev shader-gradient** | Gradiente WebGL que segue o tema e reage ao ponteiro. Aceita até 4 cores (encaixa nas paletas das Configurações). Instala por shadcn. **Risco:** WebGL gasta bateria e pode falhar em aparelhos fracos. **Veredito: usar como fundo opcional**, com versão estática em CSS como padrão do celular, e respeitando "reduzir movimento". Peso e licença não confirmados. |
| **Pryzm** | Só galeria de inspiração e ferramenta própria, com itens Pro. Sem código baixável. | **Só inspiração**, sem integrar. |
| **Cuelume** (sons) | 14 sons, 9 kB, MIT, sintetizados em tempo real. | **Útil, pequeno e opcional**: som ao concluir uma demanda, desligado por padrão, com chave nas Configurações. Ajuda no reforço positivo, que importa no TDAH. |

### Ícones, fontes e cores
| Site | Veredito |
|---|---|
| **Iconoir** | 1.671 ícones, MIT, traço ajustável. | **Boa opção** se quisermos abandonar o Lucide. Mas trocar de biblioteca só pelo gosto custa retrabalho (já temos 16 ícones). Decidir por comparação visual no novo design system. |
| **Hugeicons** | A página não informa quantos são gratuitos nem a licença. 6.035 no total, parte paga. | **Descartar por segurança** até confirmar a licença do pacote gratuito. A regra de não pagar nada pesa aqui. |
| **Lucide** (atual) | Já em uso, 1.500+ ícones, MIT. | Continua como padrão, a menos que a comparação mude. |
| **FontPair** | Pares curados do Google Fonts e Fontshare. Pro pago (não usar). Não informa suporte a acentos. | **Útil para escolher** os 5 pares das Configurações. Conferir cada fonte para acentos do português. |
| **Free Faces** | Coleção de fontes com licenças livres variadas, sem informar licença nem acentos por fonte. | **Só inspiração.** Fonte em app exige licença clara, então prefiro Google Fonts. |
| **Coolors** | Gerador de paletas. Grátis: 10 paletas salvas, 5 cores, com anúncios. Verificação de contraste da paleta toda é Pro. | **Útil para criar** as 10 paletas. O contraste eu verifico por código (WCAG), sem pagar. |

### Memos (usememos.com), para Entradas
- Memos é um app de notas separado, MIT, com API, que roda em Docker ou binário. Não é um componente embutível.
- **Veredito: não integrar o Memos, copiar a ideia.** Rodar um segundo sistema (outro servidor, outro login, outro banco) contradiz o objetivo de um painel único. As Entradas serão uma tabela do nosso banco, com post-its, tags com `#` e botão "virar demanda". Do Memos aproveito: captura em um toque, tags e linha do tempo.

### MCP da Mobbin
- Somente leitura: busca telas e fluxos de apps reais (onboarding, estado vazio, formulário etc.). **Exige plano Pro, Team ou Enterprise** (pago). OAuth, 60 requisições por minuto.
- **Veredito:** só se você já assina a Mobbin. Se não, descartar (regra de custo). Melhor momento de uso: **antes de desenhar as telas do app iPhone/iPad**, para ver como apps de agenda e tarefas resolvem o onboarding e os estados vazios. Não faz sentido agora na web.

---

## 3b. Skills de design e gosto (taste-skill e ui-skills.com)

Avaliadas em 21/10/2026, a pedido do usuário, para ajudar a decidir ícones e a direção visual.

- **taste-skill** (`design-taste-frontend`, v2.1, MIT, Leonxlnx): faz o agente escolher uma direção de arte, construir, testar no navegador em três larguras e se criticar sozinho. Tem fluxo próprio para painéis e apps (painéis discretos, números alinhados, navegação que recolhe no celular). Requisitos: Node 22+ e Chrome ou Edge, sem chave de API.
  - Custos: "centenas de milhares de tokens" por construção, e roda scripts locais.
  - **Veredito: instalar só `design-taste-frontend`, na hora do protótipo, depois de ler os scripts.** Não instalar agora.
- **ui-skills.com** (diretório de skills de terceiros):
  - **Úteis:** `critique` (nota de UX e correções) e `delight` (detalhes de interação), ambas de pbakaus, como revisão. `emil-design-eng` (polimento de animação) como opção.
  - **Descartadas:** `bolder` e `overdrive` (empurram para mais efeito e menos clareza), `brutalist`, `minimalist`, `scandinavian`, `stitch`, `chalk-logic`, `regards-art-direction` (para sites públicos, exige MCP) e as skills de "humanizar" texto.
  - Licença não informada na página para a maioria. Conferir no GitHub antes de instalar.
- **Ícones (decisão adiada para o protótipo):** o usuário quer ícones criativos, nem simples demais nem feios. Comparar Lucide com tratamento (pastilha de vidro, traço mais grosso, cor de destaque), Iconoir e um estilo duotone, julgando com `design-taste-frontend` e `critique`.

---

## 4. Vidro líquido e a estética Apple

- O efeito de "liquid glass" da Apple é nativo no iOS. Na web ele se imita com `backdrop-filter: blur()`, translucidez, bordas finas claras e sombra suave. Funciona bem no Safari e no Chrome, mas **tem custo de desempenho** quando há muitas camadas sobrepostas, principalmente em celulares mais antigos.
- Risco real: **legibilidade**. Texto sobre vidro sobre gradiente em movimento pode ficar ilegível, e isso fere o princípio do projeto (poucas cores, leitura rápida). Proposta: vidro apenas em barras, menus, botão flutuante e janelas. **Cards de demanda com fundo mais sólido** (translúcido leve), para o texto ficar nítido.
- Regras do projeto que continuam: contraste mínimo, alvo de toque de 44 px, vermelho só para atrasado.

---

## 5. Sobre o app na App Store

- Pesquisei as regras da Apple (diretriz 4.2, "funcionalidade mínima"). Relatos de desenvolvedores indicam que **um site embrulhado em Capacitor, sozinho, costuma ser rejeitado**. A Apple pede recursos que um site não tem (por exemplo integração com calendário nativo, notificações nativas, widgets, extensões).
- Boa notícia: os recursos que você descreveu (notificações de compromissos, calendário, widgets de tela inicial, atalhos) são justamente o tipo que ajuda a passar. Mas isso significa planejar o app nativo como **etapa própria**, e não como um "empacotar".
- Detalhe de custo: **publicar na App Store exige a conta Apple Developer (US$ 99 por ano)** e um Mac para compilar. Isso colide com a regra "não pagar além das assinaturas Claude Pro e ChatGPT Plus". Há pergunta no questionário.
- Plano sensato: web responsiva instalável como **PWA** (funciona na tela inicial do iPhone e iPad, com notificações no iOS 16.4 ou superior), na Vercel. Decidir o app nativo depois de usar a PWA por algumas semanas.
- A Mobbin ajuda mais nessa etapa nativa. Por isso a resposta sobre "melhor momento": depois.

---

## 6. Humor e produtividade com TDAH: o que a pesquisa sustenta

- Evidência: a desregulação emocional é uma característica frequente e importante no TDAH, e há revisões que tratam a regulação emocional como alvo de intervenção digital. **Não encontrei ensaios controlados** que provem que registrar o humor todo dia melhora o quadro. Então proponho como **ferramenta de autoconhecimento**, nunca como tratamento, e sem prometer resultado.
- O que os produtos existentes têm em comum (e que reduz esforço): poucas perguntas por dia, registro em um toque, ver tendência, e recompensa simples por manter a rotina.
- **Versão aprovada** (o usuário substituiu a minha proposta inicial por uma especificação própria, ver `DECISOES.md`, seção 9): humor e energia manuais, produtividade calculada pelas demandas finalizadas, balões a cada 3 horas, correção até 5 dias, painel interativo no Perfil, sem metas, sem sequência de dias, sem alerta de sobrecarga e sem exportar resumo.
- Mantido da pesquisa: o "foco do dia" (até 3 demandas sugeridas) combate a escolha "pelo que é interessante".
- Aviso a manter na tela: não substitui acompanhamento profissional.
- Privacidade: dado de humor é dado de saúde, e o sistema deve guardá-lo só no seu banco, nunca enviá-lo à IA sem permissão explícita.

---

## 7. Clima na Home

- **Open-Meteo**: sem chave, 10.000 chamadas por dia no gratuito, com crédito obrigatório (CC BY 4.0). O plano gratuito é "não comercial": uso pessoal serve.
- Cidade configurável nas Configurações (padrão: Taquara/RS). Guardar a resposta em cache por 30 minutos, para ser rápido.

---

## 8. Integrações do Google

- **Google Calendar e Drive** exigem um projeto no Google Cloud com login OAuth. O uso pessoal é gratuito, mas o processo de verificação do Google para apps com escopos sensíveis é trabalhoso. Para uso só seu, o app pode ficar em "modo de teste" com você como usuário de teste, mas os tokens de teste **expiram em 7 dias**, a menos que se publique o app. Isso será pergunta.
- Sincronização com o Calendar: sentido único (Dmanda para Google) é simples. Sentido duplo (mudar no Google e refletir aqui) exige notificações push do Google e é bem mais trabalhoso.
- Estrutura de Documentos ligada ao Drive: preparar o banco e a tela, deixar a conexão para depois (como você pediu).

---

## 9. IA como estagiária

- Dois níveis: (1) responde e resume com os seus dados; (2) **executa ações** (marcar tarefa, arquivar, criar evento). O nível 2 é bem mais delicado: pode apagar ou alterar demanda por mal-entendido.
- **Decidido:** a IA executa ações e **toda ação pode ser desfeita**. Só para excluir ela pergunta e executa se o usuário confirmar.
- Custo: a API da Anthropic ou da OpenAI é **paga por uso**, separada das assinaturas. Opções gratuitas pesquisadas em 21/10/2026: **Gemini** (camada gratuita em vários modelos, mas no plano gratuito o Google usa os dados para melhorar produtos, e os limites por minuto e dia não foram confirmados), **Groq** (camada gratuita com limites modestos) e **Ollama local** (privado e gratuito, mas não alcança o celular com o sistema na Vercel).
- Estratégia: o Dmanda não treina modelo. A "estagiária" é código nosso (buscar, executar, desfazer, consolidar por contas no banco) com um modelo trocável só para entender o pedido e redigir. Tudo fica pronto para integração, e o gratuito é testado na hora da IA, com filtro que oculta números e nomes antes de enviar.

---

## 10. Resumo: o que entra, o que sai

**Entra (quando for a hora):** shadcn (base), BoardUI gratuitos (inspiração e peças), Playwright MCP, Open-Meteo, Cuelume (opcional), Magic UI (3 itens), Gauge UI (1 uso), shader-gradient 23rd (fundo opcional), Coolors e FontPair (para escolher), grill-with-docs, tdd e diagnosing-bugs (Matt Pocock), Trail-code (após a Fatia 1).

**Fica fora:** Claude-mem, ECC, aitmpl completo, quase todas as skills de Matt Pocock, Fancy Components, CanvasUI, Pryzm (só inspiração), Free Faces (só inspiração), Hugeicons, Memos (copiar a ideia), Mobbin (a menos que já assine), Calendar e AI Chat Pro do BoardUI.

**Adiado:** Bencho (não confirmado), MCP PostgreSQL e markitdown (quando houver banco e Documentos), app nativo.
