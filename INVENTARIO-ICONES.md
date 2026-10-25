# Inventário dos ícones restantes

Levantado em 24/10/2026 a partir do código (`prototipo/app.js`, `extra.js`, `v5.js`) e de uma varredura no navegador (computador e celular, todas as telas, "+", busca e Perfil). **Serve para o usuário selecionar os símbolos Ionicons em etapa separada. Nenhum substituto foi escolhido e nada foi migrado.**

Os sete ícones de navegação (`nav-inicio`, `nav-entradas`, `nav-demandas`, `nav-agenda`, `nav-documentos`, `nav-ia`, `nav-config`) já estão em Ionicons outline e ficam fora desta lista.

Todos os nomes abaixo vêm hoje do **Iconoir** (padrão). O Lucide é a alternativa escolhida em Configurações, com os mesmos nomes. "Vários" indica reutilização em mais de um local: trocar o símbolo uma vez vale para todos.

## Visualização e filtros de Demandas

**Andamento da seleção:** feitos Cards, Tabela e Lista (SVGs oficiais em `prototipo/icones-nav/originais/`, chaves `vis-cards`, `vis-tabela`, `vis-lista`, iguais com Iconoir ou Lucide). Quadro pendente. **Os demais grupos abaixo (filtros e busca, ações, prazo e tempo, tipos de evento, topo e menu, conteúdo, IA e Perfil) ainda aguardam escolha.**

| Função | Nome atual | Onde aparece | Reuso |
|---|---|---|---|
| Visão em cards | **`albums-outline` (Ionicons, feito em 24/10/2026)**; antes `layout-grid` | aba "Cards" da barra de Demandas | 1 local |
| Visão em quadro | `columns` (Iconoir, **pendente**: o Ionicons não tem ícone de colunas ou Kanban; escolha do usuário aguardada) | aba "Quadro" | 1 local |
| Visão em tabela | **`grid-outline` (Ionicons, feito em 24/10/2026)**; antes `table` | aba "Tabela" | 1 local |
| Visão em lista | **`list-outline` (Ionicons, feito em 24/10/2026)**; antes `list` | aba "Lista" | 1 local |
| Filtros | `filter` | botão "Filtros" de Demandas | 1 local |
| Só atrasadas | `clock` | botão "Só atrasadas" | vários (ver Prazo e tempo) |
| Buscar | `search` | botão "Buscar em tudo" do topo, campo "Filtrar demandas", campos de busca | vários |
| Ordenar crescente e decrescente | `arrow-up`, `arrow-down` | cabeçalho da coluna ordenada na Tabela | 1 local (2 estados) |
| Expandir e recolher grupo | `chevron-down` | etapas da visão Lista | 1 local |

## Ações em cards, tarefas e janelas

| Função | Nome atual | Onde aparece | Reuso |
|---|---|---|---|
| Criar | `plus` | "Criar novo", "Nova demanda", "Nova nota", "Mais 5 minutos", botão "+" central | vários (muitos) |
| Concluir | `check` | "Concluir demanda" (card e janela), "Registrar" e estado "feito" da IA, item Tarefa do menu "+" | vários |
| Mover de etapa, virar demanda | `arrow-right` | "Mover de etapa", "Virar demanda" em Entradas | vários |
| Editar | `pencil` | "Editar" e "Editar a tarefa" | vários |
| Mais ações | `ellipsis` | "Mais" do celular, "Opções da coluna", "Mais ações" | vários |
| Arquivar | `archive` | "Arquivar" em cards e janela; "Arquivo" na lista "Mais" | vários |
| Excluir | `trash` | exclusão de demanda, evento e tarefa | vários |
| Desfazer | `undo` | "Desfazer" da IA | 1 local |
| Já vi | `eye` | botão "Já vi" do card | 1 local |
| Fixar e desafixar | `pin` | post-its de Entradas | 1 local (2 estados) |
| Girar o card (frente e verso) | `rotate-cw` | "Fixar a frente/verso do card"; "Recomeçar" do cronômetro | vários |
| Fechar | `x` | janela, Perfil e balão | vários |
| Enviar mensagem | `send` | chat da IA | 1 local |
| Exportar dados | `export` | Configurações | 1 local |
| Importar dados | `import` | Configurações | 1 local |
| Menos 5 minutos | `minus` | widget do cronômetro | 1 local |
| Iniciar e pausar | `play`, `pause` | widget do cronômetro | 1 local (2 estados) |

## Prazo, tempo e legal

| Função | Nome atual | Onde aparece | Reuso |
|---|---|---|---|
| Prazo, relógio | `clock` | selos de prazo dos cards, "Atrasadas", "Há 2 dias sem registro" | vários (muitos) |
| Data, agenda | `calendar` | prazos, "Próximos 7 dias", data do dia, item Evento do "+" | vários (muitos) |
| Prazo legal | `flag` | selo "legal" dos cards | vários |
| Para hoje | `target` | contador "Para hoje" do Início | 1 local |
| Cronômetro | `timer` | widget Pomodoro | vários (Início e lista de widgets) |
| Ampulheta | `hourglass` | amostra de ícones em Configurações | só amostra |
| Calendário com marca | `calendar-check` | widget "Calendário" na lista de widgets | 1 local |

## Tipos de evento da Agenda

| Função | Nome atual | Onde aparece | Reuso |
|---|---|---|---|
| Reunião | `users` | eventos "Reunião" | vários |
| Compromisso | `map-pin` | eventos "Compromisso" | vários |
| Lembrete | `bell` | tipo "Lembrete" e sino de avisos do topo | vários |
| Feriado | `party` | eventos "Feriado" | vários |

## Topo, menu e aparência

| Função | Nome atual | Onde aparece | Reuso |
|---|---|---|---|
| Tema escuro e claro | `moon`, `sun` | botão do topo e botão em Configurações | vários (2 estados) |
| Avisos | `bell` | sino do topo | ver Lembrete |
| Recolher e mostrar menu | `recolher`, `expandir` | botão "Recolher menu" e "Mostrar menu" | 1 local (2 estados) |
| Alerta | `alert` | aviso "Faz N dias desde o último registro" | 1 local |
| Clima | `cloud-sun` | widget Clima | vários |

## Conteúdo, IA e Perfil

| Função | Nome atual | Onde aparece | Reuso |
|---|---|---|---|
| Documento, modelo | `file-text` | Documentos (vazio), "Tipos de documento", "Modelo de memorando", item Documento do "+" | vários |
| Demanda (kanban) | `square-kanban` | resultados da busca e item Demanda do "+" | vários |
| Nota | `sticky-note` | resultados da busca e Configurações | vários |
| Surpreenda-me, IA | `sparkles` | "Surpreenda-me", amostra de ícones | vários |
| Banco de frases | `message-circle` | Configurações | 1 local |
| Conta Google | `globe` | Configurações | 1 local |
| Energia (5 níveis) | `bat0` a `bat4` (`battery`) | **não são mais usados**: a energia agora é SVG colorido do usuário e o ícone de reserva foi retirado | nenhum |

## Só na amostra de Configurações

`house`, `inbox`, `settings`, `square-kanban`, `calendar`, `file-text`, `sparkles`, `clock`, `hourglass` aparecem no painel "Ícones" de Configurações, que existe por causa da escolha Iconoir ou Lucide e sai quando essa escolha acabar.

## Observações

- Alguns nomes servem a mais de uma função (`clock`, `bell`, `check`, `file-text`, `square-kanban`). Se o usuário quiser símbolos diferentes por função, é preciso separar o nome no código antes. Isso fica para a etapa de migração.
- O resultado da varredura em tempo de execução cobre as telas, o "+", a busca e o Perfil. Estados que só aparecem depois de uma ação (por exemplo `undo`, `trash`, `alert`) foram confirmados no código.
