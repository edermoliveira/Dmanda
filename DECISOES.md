# Decisões do projeto (rodada de alinhamento de 21/10/2026)

Registro das respostas do usuário ao `QUESTIONARIO.md`. É a fonte mais recente: se qualquer outro `.md` divergir, vale este. Os demais documentos (`PRODUTO.md`, `FUNCIONALIDADES.md`, `CLAUDE.md` etc.) foram revisados para ficarem iguais a ele.

Legenda: **[definido]** o usuário decidiu. **[aprovado]** era uma recomendação minha e o usuário aprovou (ou ajustou, e o ajuste está escrito).

## 1. Escopo e ordem
- [definido] Menus: **Início, Entradas, Demandas, Agenda, Documentos, IA, Configurações**. O Arquivo é uma página à parte (ver seção 3).
- [definido] Ordem de construção: 1) design system, protótipo e menus; 2) versão mínima de Demandas + Início (para começar a carga inicial cedo); 3) Entradas; 4) Agenda local; 5) Configurações; 6) busca global e botão "+"; 7) humor, produtividade e clima; 8) Google Calendar e Drive; 9) IA; 10) Documentos.
- [definido] Começar como **PWA** (instalável no iPhone e iPad). O app nativo da App Store fica para depois, assim como os custos que ele traz (conta Apple Developer, API de IA paga, Mobbin Pro).
- [definido] **Computador (web) primeiro.** Projetar e testar primeiro no computador, depois adaptar para iPad e celular (sempre responsivo pela largura da tela). Substitui o "mobile primeiro" do padrão anterior.
- [aprovado] Sem uso offline completo na primeira versão. Rascunhos ficam no aparelho e sincronizam quando voltar a conexão.

## 2. Onde roda, dados e segurança
- [definido] Desenvolver local até a primeira tela de Demandas, e então publicar na **Vercel com login**.
- [definido] Banco: **Postgres gratuito (Neon ou Supabase)**, com exportação de cópia de segurança. Confirmar os limites do plano gratuito antes de escolher entre os dois.
- [definido] Login: **conta Google**, com uma única conta permitida e sessão longa.
- [definido] Os dados ficam em serviço de terceiros e o usuário decidiu seguir sem consultar a TI ou o jurídico da Prefeitura. A responsabilidade é dele. Mesmo assim, o sistema guarda só o necessário (número, assunto, origem), sem CPF.
- [definido] Google Calendar e Drive: começar em modo de teste (o Google pede para reconectar a cada 7 dias) e publicar o aplicativo no Google Cloud quando a integração estiver pronta.

## 2b. Ajustes de 21/10/2026 (segunda rodada)
- [definido] **Acompanhamento:** em Aguardando retorno, o card permite registrar uma **data de acompanhamento** (para cobrar, reiterar o pedido ou conferir). Ela aparece no card, no Início (alerta no dia) e na Agenda.
- [definido] **Reabrir demanda finalizada:** preserva o histórico e as tarefas já cumpridas, e permite cadastrar tarefas novas sem perder as anteriores. A demanda volta para a etapa que o usuário escolher (padrão: Fazendo). Vale também para demandas arquivadas (desarquivar e reabrir).
- [definido] **As quatro visões têm funções distintas:** Cards = leitura visual. Quadro = movimentação entre etapas. Tabela = análise detalhada. Lista = consulta rápida.
- [definido] **Adaptação por largura:** o layout muda pela **largura disponível da tela**, e não só pela orientação. Faixas: estreita (barra inferior), média (menu lateral recolhido) e larga (menu lateral completo). Vale para celular, iPad (inclusive com tela dividida) e janela do computador.
- [definido] **Botão "+"** permite cadastrar **anotação, demanda ou evento rapidamente** (as três primeiras opções, em um toque). Tarefa, documento e chat continuam no mesmo menu.
- [definido] **Agenda:** destaque discreto para os **dias úteis** (fins de semana esmaecidos). A sincronização com o Google **impede duplicações**. O sistema **alerta sobre eventos concomitantes** (só eventos, nunca demandas).
- [definido] **Gráficos do Perfil** podem ser **coloridos, animados e elegantes**, desde que as cores **não classifiquem** a produtividade como boa ou ruim (nada de verde para muito e vermelho para pouco). **Humor e energia ficam privados.**

## 3. Demandas
- [definido] Colunas do quadro:
  1. **Cadastro:** acabou de chegar, ainda não vi do que se trata.
  2. **Vista:** já vi o que precisa ser feito. O marco é o botão **"Já vi"**, manual. Vale com ou sem tarefas (demanda de passo único não precisa de tarefa).
  3. **Fazendo:** em trabalho comigo (já comecei parte das tarefas).
  4. **Aguardando retorno:** mandei a outro setor externo à Secretaria, ou aguarda análise ou decisão da Prefeita. Mostra o setor e os dias parados.
  5. **Finalizado:** concluída. O card sugere "Finalizar?" quando todas as tarefas forem concluídas. Sem tarefas, há o botão Concluir. Sempre manual.
- [definido] Visões: **Cards, Quadro, Tabela e Lista**, com possibilidade de expandir para ver e marcar tarefas concluídas.
- [definido] **Frente do card** (sem abrir): número do processo/memorando, assunto e origem, prazo com selo legal ou próprio (atraso em vermelho), próxima tarefa (nunca a concluída) e porcentagem pronta.
- [definido] **Verso do card:** lista de tarefas com marcar, data de chegada, dias parado, tipo de documento, setor e dias em Aguardando retorno, e as ações (Já vi, Concluir, Arquivar, Mover, Editar).
- [definido] **Flip:** no computador, ao passar o mouse. No celular e no iPad, botão de girar. Toque no corpo do card abre a demanda completa.
- [definido] **Tarefas e porcentagem no card** (valem em todas as visões, respeitando o layout de cada uma):
  1. **Sem tarefas:** mensagem "Nenhuma tarefa cadastrada", atalho discreto "+ Adicionar tarefa", progresso com traço (—) e nenhuma barra preenchida.
  2. **Com tarefas:** progresso = (concluídas ÷ total) × 100, com percentual e barra integrada ao card. Havendo pendentes, destaca a próxima tarefa, na ordem definida na demanda.
  3. **Todas concluídas:** 100% com a mensagem "Todas as tarefas concluídas" e sugestão discreta e interativa "Finalizar demanda?". Só finaliza após ação expressa, nunca automaticamente.
  4. **Finalizada:** status "Finalizada", com ou sem tarefas. Mantém o percentual realmente calculado (ou "—" sem tarefas). Sem sugestões de adicionar tarefa nem de finalizar.
  5. **Regra geral:** o percentual mede só o progresso das tarefas, não o andamento administrativo. Concluir todas as tarefas **não muda a etapa** sozinho, e é possível finalizar uma demanda sem tarefas.
- [definido] **Arquivo é uma página separada no menu** (arquivar continua sempre manual, exclusão definitiva com segunda confirmação). Haverá também um atalho "Arquivo" ao final da tela de Demandas.
- Continuam valendo as regras anteriores: prazo legal prevalece sobre o próprio, 30 dias automáticos sem prazo (editáveis), todo campo é editável e o sistema se ajusta, tipo de documento opcional e ampliável, tudo que se digita é guardado automaticamente.

## 4. Entradas
- [definido] Post-its **pastel só em Entradas**, até 6 tons derivados da paleta ativa. As demais telas seguem poucas cores.
- [definido] **Virar demanda** abre o cadastro preenchido (1ª linha vira assunto, o resto vai para observação). A nota sai de Entradas ao salvar. Se cancelar, a nota fica. A demanda guarda o vínculo com a nota original.
- [aprovado] Só um tipo: a nota (com cor, tags com `#` e fixar no topo). Fica até arquivar manualmente. Voz e foto ficam para depois. Atalho de teclado `N` no computador.

## 5. Agenda
- [definido] Duas visões: **semanal e mensal**, minimalistas, cores suaves e padronizadas, dia atual em destaque.
- [definido] **Demandas**: aparecem só na data de vencimento, em **cards amarelos**, separadas da grade de horários.
- [definido] **Eventos** (reuniões e compromissos com início e fim): **cards azuis**. Eventos de dia inteiro (como feriados): **cinza-azulado**.
- [definido] **Semana:** colunas de domingo a sábado, fins de semana esmaecidos, demandas na parte inferior do quadradinho do dia, eventos de dia inteiro ocupando o dia, compromissos numa grade de horários.
- [definido] **Mês:** grade tradicional com cards compactos de cantos levemente arredondados, leve efeito de tilt ao passar o mouse, indicador da quantidade de demandas, destaque para dias de maior concentração (com sugestão de antecipar ou redistribuir).
- [definido] Navegação por datas, filtros por categoria, detalhes ao clicar. Demanda vencida fica na data original em **vermelho**. Tarefas concluídas ficam ocultas, mas podem ser reexibidas por filtro.
- [definido] Cadastro de evento pelo "+" dentro do dia (aparece ao passar o mouse ou tocar no número do dia), em janela de passos. Notificação só para evento, compromisso e lembrete, nunca para prazo de demanda.
- [definido] **Google Calendar: só do Dmanda para o Google.** O calendário da Apple entra no futuro.
- [definido] **Feriados:** só os que o usuário cadastra (nacionais, estaduais, municipais e pontos facultativos). Aparecem na agenda como evento de dia inteiro e valem para o preenchimento de humor.
- [definido] **Visão "Hoje"** (a mais simples das três e a **inicial da agenda no celular**): cards compactos, horários destacados e clara diferença entre compromissos, lembretes e vencimentos. Mostra os compromissos e lembretes do dia em ordem cronológica e, em seção separada, as demandas que vencem hoje. Hoje + Semana + Mês são três perspectivas: agora, a semana e o que vem pela frente.
- [definido] **Google:** sincronizam só compromissos e lembretes independentes (prazos de demanda ficam no Dmanda). Unidirecional (Dmanda para Google): alterar ou excluir no Dmanda atualiza ou remove no Google, sem duplicar.
- [definido] **Avisos:** 15 minutos antes como padrão para eventos com horário, com personalização ou desativação individual. Eventos de dia inteiro têm configuração própria de aviso (nada de notificação à meia-noite).
- [definido] Entradas: aprovado o padrão (um tipo de nota, fica até arquivar, voz e foto depois, atalho `N`).

## 6. Documentos
- [aprovado] Primeira versão: estrutura e tela vazia ("conecte o Drive"), tabela no banco pronta. Uma demanda poderá ter documentos anexados (links do Drive). Gerar .docx a partir de modelo continua em "Depois".

## 7. IA estagiária
- [definido] Responde e **executa** ações (arquivar, marcar tarefa como cumprida, incluir tarefa, marcar reunião etc.). **Toda ação pode ser desfeita** por pedido. **Excluir**: ela pergunta e só executa se o usuário confirmar.
- [definido] Prioridade é uma IA gratuita. Plano: construir tudo provedor-agnóstico (a lógica de buscar, executar, desfazer e consolidar é código do Dmanda, o modelo só entende o pedido e redige). Consolidações como "qual mês teve mais demandas" são contas no banco. Candidato gratuito: Gemini (camada gratuita, mas o Google usa os dados enviados para melhorar produtos), Groq (limites modestos). Ollama local é privado, mas não alcança o celular com o sistema na Vercel. Na hora da IA, testar o gratuito com filtro que oculta números e nomes. Se não servir, deixar pronto para integração futura.
- [aprovado] A IA lê demandas, tarefas, agenda e entradas. **Humor nunca**, sem permissão explícita. Tom cordial e direto.

## 8. Início
- [definido] Mensagem motivacional e bem-humorada no topo, **uma por dia**. O usuário cria um **banco de 500 frases**; o sistema sorteia de forma aleatória, **sem repetir nenhuma até esgotar**, e reinicia o ciclo na 501ª. O sistema fornece o lugar para cadastrar e editar as frases (ou importar uma lista). Substitui a ideia das 365 mensagens escritas por mim.
- [aprovado] Alertas ao abrir: atrasadas (vermelho), vencendo hoje, compromissos de hoje, aguardando retorno parado há mais de 7 dias (ajustável). Quantitativos: atrasadas, para hoje, próximos 7 dias, aguardando retorno, entradas sem tratar. "Foco do dia" sugere até 3 demandas (prazo legal primeiro, depois próprio, depois mais tempo parada), e o usuário pode trocar.
- [aprovado] Clima: **Open-Meteo** (sem chave e sem custo para uso pessoal, com crédito), cidade padrão Taquara/RS, configurável.

## 9. Perfil, humor, energia e produtividade
- [definido] O **Avatar** (topo) abre o **Perfil**, que também fica em Configurações > Perfil. O avatar aceita foto ou 5 ilustrações a escolher, importadas de alguma biblioteca de componentes. O CLAUDE.md dizia "não existe perfil": passa a existir como página pessoal do único usuário.
- [definido] Três indicadores diários: **Humor** (emojis, manual), **Energia** (manual) e **Produtividade** (calculada: demandas finalizadas no dia, independentemente do vencimento). Produtividade não é classificada como boa ou ruim. Dia com zero é normal.
- [definido] **Balões discretos**: um a cada 3 horas de trabalho, contadas a partir do login, incluindo o primeiro humor do dia antes de começar. Cerca de 4 por dia. Só o último registro de cada indicador fica no dia.
- [definido] Correção manual de humor e energia até **5 dias** depois. Ao entrar, se houver pendência, uma janela antes do Início convida a completar os últimos 5 dias (ignora sábados, domingos e feriados cadastrados, pede só o que falta, permite preencher vários rápido, é opcional). Dias sem preenchimento ficam "Sem registro".
- [definido] **Perfil:** resumo do dia (concluídas, com destaque), gráfico interativo semanal e mensal com animações sutis, histórico visual compacto dos dias, os três indicadores juntos, e ao passar o mouse numa coluna do gráfico, resumo do dia (demandas concluídas, humor e energia). Frase conclusiva sempre neutra e acolhedora (nunca comparação negativa).
- [definido] Privado, sem metas, sem cobrança, sem alertas negativos, sem sequência de dias, sem exportar resumo, sem comparação com outras pessoas. Aviso fixo de que não substitui acompanhamento profissional.

## 10. Visual
- [definido] Estilo Apple com **vidro** em barras, menu, botão flutuante, janelas e campos. Cards de demanda mais sólidos. Menos vidro no celular.
- [definido] Fundo com gradiente: **estático por padrão, animado opcional** nas Configurações. Desliga em "reduzir movimento". As cores seguem a paleta ativa.
- [definido] Navegação: **computador e iPad horizontal:** menu lateral completo e recolhido (só ícones), busca no topo. **Celular e iPad vertical:** barra inferior com vidro: **Início, Demandas, "+" (centro), Agenda, Mais** (Entradas, Documentos, IA, Configurações, Arquivo). Entradas é a 1ª opção do "+".
- [definido] Botão "+" flutuante no canto inferior direito (no celular, no centro da barra) com: nova entrada, demanda, tarefa, evento, documento, chat. Botão de busca fixo no canto superior direito (lupa), que abre a pesquisa rápida em tudo.
- [definido] Ícones: o usuário quer ícones criativos, nem simples demais nem feios. Decisão no protótipo, comparando Lucide com tratamento, Iconoir e um estilo duotone.
- [definido] Fontes: eu proponho 5 pares (Google Fonts, acentos conferidos) no protótipo. O usuário escolhe o padrão.
- [definido] Protótipo: **3 direções de estilo** numa página única, cada uma com Início, um card (frente e verso), menu lateral, barra inferior, "+" e busca, claro e escuro, celular e computador.
- [aprovado] Mantidas as regras: cor forte só para atrasado ou crítico (igual em todas as paletas), nenhuma cor solta no código, alvo de toque de 44 px. **Sem nenhum som** no sistema (decisão do usuário). Prints de `imagens/prints` valem para a organização das informações, o visual segue o estilo Apple. Peças refeitas sobre a base shadcn, mantendo os nomes e os 5 estados; logo a redefinir no protótipo.

- [definido] **Logo:** redefinido no protótipo. Cada uma das 3 direções traz uma proposta de logo, incluindo o D de três colunas atual como opção.
- [definido] **Lista x Tabela:** Lista = linhas expansíveis com tarefas (para trabalhar). Tabela = colunas ordenáveis (número, assunto, origem, prazo, etapa, %) com filtros (visão macro).
- [definido] **Google:** o usuário aceita reconectar a conta a cada 7 dias no começo (modo de teste), até o aplicativo ser publicado no Google Cloud.
- [definido] **Protótipo liberado:** itens [aprovado] revisados pelo usuário em 21/10/2026. Protótipo começa pelo computador, depois iPad e celular.

## 11. Configurações
- [definido] Cores (10 paletas, cada uma com claro e escuro, mais escolha aleatória), fontes (5), tamanhos (ícones, fontes, cards, botões, em barras com visualização em tempo real), conta Google, IA, Perfil e o que for pertinente.
- [aprovado] Botão "Surpreenda-me" (e opção de trocar a paleta por dia), tema claro/escuro seguindo o aparelho, limites que impedem tamanho ilegível ou botão abaixo de 44 px, botão "restaurar padrão". Também: cidade do clima, dias do prazo automático, alerta de parado há X dias, horário dos balões, reduzir movimento, **exportar e importar todos os dados** (cópia de segurança).

## 12. Ferramentas
- [definido] Trail-code (o "GRAFT"): instalar **depois da versão mínima de Demandas**, rodando antes `trail init --dry-run`.
- [definido] `claude-code-setup` desativado. Resta o plugin `ui-ux-pro-max` até o design system ficar pronto.
- [definido] Skills de design: instalar `design-taste-frontend` (taste-skill, MIT) na hora do protótipo, depois de revisar seus scripts. `critique` e `delight` (pbakaus) como revisão. Não usar `bolder` nem `overdrive`.
- [aprovado] Resto do `ANALISE-FERRAMENTAS.md` vale como está. Mobbin descartado (plano pago). Playwright MCP quando começarem as telas.
- [definido] **Ferramentas instaladas em 21/10/2026 (computador de casa), a pedido do usuário:** plugin `taste-skill` (marketplace `Leonxlnx/taste-skill`) e plugin `ui-ux-pro-max` (marketplace `nextlevelbuilder/ui-ux-pro-max-skill`), ambos no escopo do usuário, e o MCP `context7` (`cmd /c npx -y @upstash/context7-mcp`, escopo do usuário). A taste-skill é usada só para direção visual, tipografia, espaçamento e hierarquia, sem imagens externas. O ui-ux-pro-max é a principal referência técnica de interface.
- [definido] **Limpeza de ferramentas (21/10/2026):** Context7 fica só pelo plugin oficial (endpoint HTTP, sem depender de npx no Windows); a entrada local duplicada foi removida. O plugin Superpowers foi desinstalado e só três skills dele (MIT, com a licença junto) foram copiadas para `.claude/skills/` do projeto: `test-driven-development`, `systematic-debugging` e `verification-before-completion`. Elas viajam pelo Git para o outro computador.
- [definido] **Escolha do protótipo (21/10/2026):** direção **A Aurora**, com o **logo da Aurora** (D de três colunas). Fontes e emojis da primeira versão foram considerados fracos e foram refeitos: título em Sora e texto em Inter por padrão, emojis do Noto Color Emoji. Ainda a decidir em Configurações do protótipo: par de fontes, estilo de ícones (Lucide em pastilha, fino ou duotone) e paleta padrão. `frontend-design` foi desinstalado: fica o `ui-ux-pro-max` (dados de paletas, fontes e regras de UX) e a `taste-skill` (direção visual e conferência no navegador).
- [definido] **Segunda rodada do protótipo (21/10/2026):** Demandas passa a seguir a organização dos prints de referência (topo com busca larga, sino e perfil; título com subtítulo; barra com abas de visão, filtro, "Só atrasadas", Filtros e botão "Nova demanda"; Quadro com colunas coloridas por etapa e Lista agrupada por etapa). Ícones: o usuário não gostou do Lucide; a biblioteca padrão passa a ser o **Iconoir** (MIT), com o Lucide ainda disponível para comparar em Configurações. O usuário poderá enviar emojis próprios em PNG na pasta `prototipo/emojis/` (ver `LEIA-ME.md` da pasta).
- [definido] **Temas definitivos (22/10/2026):** **Aurora, Papel e Grafite** viram os três temas do sistema, cada um com claro e escuro. Dentro de cada tema o usuário escolhe cores (10 paletas), ícones (Iconoir ou Lucide; pastilha, fino ou duotone), tamanhos e fontes, e cada tema guarda as suas próprias escolhas.
- [definido] **Fontes em três papéis:** uma **principal para títulos**, uma **secundária para subtítulos e textos** e uma **mono para detalhes pontuais** (números de processo, datas, contadores).
- [definido] **Humor e energia:** o usuário forneceu os emojis de humor em PNG (`prototipo/emojis/humor-1..5.png`, estilo Apple). A energia usa ícones de bateria até o usuário enviar `energia-1..5.png`.
- [definido] **Menu lateral recolhido:** versão só com ícones, como nos prints, com botão para recolher e expandir. Vale nas larguras grandes; nas médias já nasce recolhido.
- [definido] **Vidro líquido** aplicado em todo o desenho (barras, menu, painéis, indicadores, alertas, janelas, botão "+", campos e abas), em intensidades diferentes por tema. Cards de demanda seguem mais sólidos.
- [definido] Rolagem lateral é aceita onde for necessária (por exemplo, o Quadro com 5 etapas).
- [definido] **Caixas de preenchimento (22/10/2026):** janelas de cadastro, busca e balões ficam quase opacas: brancas no modo claro e escuras no modo escuro, com campos de alto contraste, para facilitar a leitura e o preenchimento. O vidro fica para barras, menu, painéis e botões.


## Avaliação do protótipo (22/10/2026)

Respostas do usuário após testar o protótipo. **Aplicadas no protótipo em 22/10/2026** (exceto Agenda, item 11). Aguardando aprovação. No Início, as estatísticas "Aguardando retorno" e "Entradas sem tratar" e a lista de Alertas saíram para dar foco à agenda e aos três filtros. A frente neutra vale para documentos em geral; "Papel" manteve o fundo cor de papel como identidade do tema, com texto neutro.

1. **Humor e energia:** o balão só salva e fecha quando os dois estiverem preenchidos.
2. **Início:** widgets de data, frase, clima, humor e energia ficam compactos no topo, ampliando ao passar o mouse. O foco da tela são os compromissos da agenda (cards menores) e três filtros: Atrasadas, Para hoje e Próximos 7 dias. Foco do dia mostra 3 demandas, sempre na ordem atrasadas, hoje, 7 dias. Desempate: mais antiga primeiro (atrasada há mais tempo; nas demais, prazo mais próximo e depois a que chegou antes). A visão macro dos cards fica em Demandas.
3. **Flip dos cards:** botão menor, presente nos dois lados, e a face escolhida fica fixada. Demanda aguardando retorno só volta aos filtros quando faltarem 3 dias para o prazo do retorno (regra já existente).
4. **Cores por tipo:** frente branca (neutra) para memorandos, ofícios, pedidos de informação, projetos de lei e documentos em geral. Processos em tom pastel: azul claro (protocolo geral, aberto por munícipe, maioria vai à análise jurídica), verde claro (protocolo de pessoal, aberto por servidor ou RH), amarelo claro (compras, aberto só pelo setor de compras, nunca pelo Protocolo). Verso sempre neutro. Processo é o meio oficial de trâmite; protocolo é o processo aberto no setor de Protocolo, e o assunto define verde ou azul.
5. **Cores:** proibido #FFFFFF e #000000 em qualquer lugar. Branco = #FCFCFC, preto = #0A0A0A. Neutros claro: fundo #FCFCFC, cartão #FEFEFE, apoio #F7F7F7, texto #0A0A0A, secundário #5F5F5F, divisória #DADADA. Escuro: fundo #0A0A0A, cartão #141414, apoio #0F0F0F, texto #FCFCFC, secundário #A7A7A7, divisória #2C2C2C. Borda de campo neutro #838383. Valem as listas do item 9.
6. **Prazo:** acaba a regra dos 30 dias automáticos. Sem prazo, não inventar: sugerir 30 dias e permitir escolher data em calendário no formulário. Com prazo, contagem regressiva. Sem prazo, a demanda fica fora dos filtros e do Foco do dia e mostra só "dias desde a chegada", sem alerta. Registrar a data de chegada (em geral a do cadastro, editável) até a conclusão, para medir tempo por tipo de processo e tempo médio de resolução.
7. **Botões:** no editar, o botão confirma a edição (não conclui). Concluir demanda é botão separado. Botões mais flat, liquid glass da Apple, sem efeito 3D e sem cara de Aero do Windows Vista. "Virar demanda" na nota fica menor.
8. **Entradas:** notas como post-its quadrados (1:1), com uma ponta dobrada; cores atuais mantidas; escolha de cor opcional ao criar (senão sorteia, evitando repetir muito); # em qualquer lugar da nota; PIN para fixar; título sempre opcional (mostra só o título, ou as primeiras frases se não houver); tocar na nota abre para ler e permite editar; PIN e "virar demanda" como ícones pequenos de 28 px no canto, visíveis ao passar o mouse (toque no celular); filtro por #. Envelhecimento após 30 dias sem edição (abrir não renova, editar renova) fica para depois.
9. **Design system:** usar as sugestões como ponto de partida, sem rigidez: Manrope (títulos 37px/700, menus e botões 14px/600), Inter (texto 16px/400, subtítulos 19px/700), IBM Plex Mono (datas, horários, IDs, 12px/400), múltiplos de 4 px, padding 24 px, raio 14 px. Não impor interface monocromática, não aplicar R=G=B à marca, não forçar ação e foco a preto ou branco, não usar mono em parágrafos, não comunicar estado só por cor. Contraste mínimo 4,5:1 (3:1 para texto grande), foco visível, teclado, movimento reduzido.
10. **Rolagem e celular:** nova barra de rolagem alinhada ao design system (pesquisar inspirações). No celular, o Quadro de Demandas tem nome da etapa que some ao tocar (texto claro sobre fundo claro): corrigir. Liquid glass da Apple, não Aero.
11. **Agenda:** ajustes de design ficam para depois.

## Avaliação do protótipo, rodada 2 (22/10/2026)

Aplicado no protótipo (`prototipo/v4.css`, `app.js`, `extra.js`):

- **Início:** sem o título "Início", a frase do dia ocupa o lugar do subtítulo. Compromissos em cards por tipo (Reunião azul, Compromisso violeta, Feriado e ponto facultativo verde tracejado). Faixa de aviso de emergência, que só existe quando há aviso (exemplo: 8 dias sem abrir, sugere revisar todas as demandas; limite configurável no Perfil).
- **Cards (todas as telas):** sem barra de rolagem. Sem espaço, some primeiro o secundário e o título preenche o que sobrar. Sem caixa de marcar a demanda: o card mostra a próxima tarefa com caixa e, sem tarefas pendentes, o botão "Concluir demanda" em largura total. Mover para Finalizado ou concluir marca todas as tarefas. Contraste reforçado nos cards coloridos.
- **Prazo:** sem prazo não aparece nada. Neutro até 6 dias, amarelo com 5 e 4, laranja com 3 e 2, vermelho com 1 e no dia, e vencido com o card todo em vermelho pastel e o selo "Prazo vencido" em vermelho vivo.
- **Menu lateral:** recolhido por padrão (só ícones), abre ao passar o mouse ou por "Mostrar menu". Configurações desceu para o fim do menu.
- **Perfil:** gaveta à direita com o resto desfocado, edição rápida (nome, cargo, órgão, expediente, cidade, aviso de retorno, balão).
- **Rascunho:** clicar fora de uma janela com texto não salvo não fecha. Esc e X fecham e guardam o rascunho (reabrir recupera). Cancelar descarta.
- **Botões:** estilo Apple, chatos e levemente arredondados (raio 12), sem borda nem relevo.
- **Textos:** simpáticos e diretos, sem bajulação, com tom de alerta quando necessário.

Pendente de decisão do usuário: o tema **Catalyst** (quarto tema, a partir do kit iOS e iPadOS 27 da Apple no Figma). Exige conectar o Figma ao Claude Code (ver PENDENCIAS.md). Energia: PNGs em `prototipo/emojis/energia-1.png` a `energia-5.png`.
