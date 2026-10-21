# Decisões do projeto (rodada de alinhamento de 21/10/2026)

Registro das respostas do usuário ao `QUESTIONARIO.md`. É a fonte mais recente: se qualquer outro `.md` divergir, vale este. Os demais documentos (`PRODUTO.md`, `FUNCIONALIDADES.md`, `CLAUDE.md` etc.) foram revisados para ficarem iguais a ele.

Legenda: **[definido]** o usuário decidiu. **[padrão]** o usuário não respondeu e vale a recomendação (R) do questionário, até ele pedir mudança.

## 1. Escopo e ordem
- [definido] Menus: **Início, Entradas, Demandas, Agenda, Documentos, IA, Configurações**. O Arquivo é uma página à parte (ver seção 3).
- [definido] Ordem de construção: 1) design system, protótipo e menus; 2) versão mínima de Demandas + Início (para começar a carga inicial cedo); 3) Entradas; 4) Agenda local; 5) Configurações; 6) busca global e botão "+"; 7) humor, produtividade e clima; 8) Google Calendar e Drive; 9) IA; 10) Documentos.
- [definido] Começar como **PWA** (instalável no iPhone e iPad). O app nativo da App Store fica para depois, assim como os custos que ele traz (conta Apple Developer, API de IA paga, Mobbin Pro).
- [padrão] Mobile primeiro: projetar e testar no celular e no iPad antes do computador.
- [padrão] Sem uso offline completo na primeira versão. Rascunhos ficam no aparelho e sincronizam quando voltar a conexão.

## 2. Onde roda, dados e segurança
- [definido] Desenvolver local até a primeira tela de Demandas, e então publicar na **Vercel com login**.
- [definido] Banco: **Postgres gratuito (Neon ou Supabase)**, com exportação de cópia de segurança. Confirmar os limites do plano gratuito antes de escolher entre os dois.
- [definido] Login: **conta Google**, com uma única conta permitida e sessão longa.
- [definido] Os dados ficam em serviço de terceiros e o usuário decidiu seguir sem consultar a TI ou o jurídico da Prefeitura. A responsabilidade é dele. Mesmo assim, o sistema guarda só o necessário (número, assunto, origem), sem CPF.
- [definido] Google Calendar e Drive: começar em modo de teste (o Google pede para reconectar a cada 7 dias) e publicar o aplicativo no Google Cloud quando a integração estiver pronta.

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
- [padrão] Sem próxima tarefa: mostra "Sem próxima tarefa" com atalho para adicionar. Porcentagem = concluídas ÷ total, e sem tarefas mostra traço (não 0%).
- [definido] **Arquivo é uma página separada no menu** (arquivar continua sempre manual, exclusão definitiva com segunda confirmação). Haverá também um atalho "Arquivo" ao final da tela de Demandas.
- Continuam valendo as regras anteriores: prazo legal prevalece sobre o próprio, 30 dias automáticos sem prazo (editáveis), todo campo é editável e o sistema se ajusta, tipo de documento opcional e ampliável, tudo que se digita é guardado automaticamente.

## 4. Entradas
- [definido] Post-its **pastel só em Entradas**, até 6 tons derivados da paleta ativa. As demais telas seguem poucas cores.
- [definido] **Virar demanda** abre o cadastro preenchido (1ª linha vira assunto, o resto vai para observação). A nota sai de Entradas ao salvar. Se cancelar, a nota fica. A demanda guarda o vínculo com a nota original.
- [padrão] Só um tipo: a nota (com cor, tags com `#` e fixar no topo). Fica até arquivar manualmente. Voz e foto ficam para depois. Atalho de teclado `N` no computador.

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
- [padrão] No celular, além de semana e mês, uma lista "Hoje". Só compromissos e lembretes vão para o Google. Aviso padrão de 15 minutos antes, ajustável por evento.

## 6. Documentos
- [padrão] Primeira versão: estrutura e tela vazia ("conecte o Drive"), tabela no banco pronta. Uma demanda poderá ter documentos anexados (links do Drive). Gerar .docx a partir de modelo continua em "Depois".

## 7. IA estagiária
- [definido] Responde e **executa** ações (arquivar, marcar tarefa como cumprida, incluir tarefa, marcar reunião etc.). **Toda ação pode ser desfeita** por pedido. **Excluir**: ela pergunta e só executa se o usuário confirmar.
- [definido] Prioridade é uma IA gratuita. Plano: construir tudo provedor-agnóstico (a lógica de buscar, executar, desfazer e consolidar é código do Dmanda, o modelo só entende o pedido e redige). Consolidações como "qual mês teve mais demandas" são contas no banco. Candidato gratuito: Gemini (camada gratuita, mas o Google usa os dados enviados para melhorar produtos), Groq (limites modestos). Ollama local é privado, mas não alcança o celular com o sistema na Vercel. Na hora da IA, testar o gratuito com filtro que oculta números e nomes. Se não servir, deixar pronto para integração futura.
- [padrão] A IA lê demandas, tarefas, agenda e entradas. **Humor nunca**, sem permissão explícita. Tom cordial e direto.

## 8. Início
- [definido] Mensagem motivacional e bem-humorada no topo, **uma por dia**, 365 originais escritas por mim e guardadas no projeto. O usuário edita ou apaga nas Configurações.
- [padrão] Alertas ao abrir: atrasadas (vermelho), vencendo hoje, compromissos de hoje, aguardando retorno parado há mais de 7 dias (ajustável). Quantitativos: atrasadas, para hoje, próximos 7 dias, aguardando retorno, entradas sem tratar. "Foco do dia" sugere até 3 demandas (prazo legal primeiro, depois próprio, depois mais tempo parada), e o usuário pode trocar.
- [padrão] Clima: **Open-Meteo** (sem chave e sem custo para uso pessoal, com crédito), cidade padrão Taquara/RS, configurável.

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
- [padrão] Mantidas as regras: cor forte só para atrasado ou crítico (igual em todas as paletas), nenhuma cor solta no código, alvo de toque de 44 px. Sons: só ao concluir uma demanda, desligado por padrão. Prints de `imagens/prints` valem para a organização das informações, o visual segue o estilo Apple. Peças refeitas sobre a base shadcn, mantendo os nomes e os 5 estados; logo a redefinir no protótipo.

## 11. Configurações
- [definido] Cores (10 paletas, cada uma com claro e escuro, mais escolha aleatória), fontes (5), tamanhos (ícones, fontes, cards, botões, em barras com visualização em tempo real), conta Google, IA, Perfil e o que for pertinente.
- [padrão] Botão "Surpreenda-me" (e opção de trocar a paleta por dia), tema claro/escuro seguindo o aparelho, limites que impedem tamanho ilegível ou botão abaixo de 44 px, botão "restaurar padrão". Também: cidade do clima, dias do prazo automático, alerta de parado há X dias, horário dos balões, reduzir movimento, som, **exportar e importar todos os dados** (cópia de segurança), editar as 365 mensagens.

## 12. Ferramentas
- [definido] Trail-code (o "GRAFT"): instalar **depois da versão mínima de Demandas**, rodando antes `trail init --dry-run`.
- [definido] `claude-code-setup` desativado. Resta o plugin `ui-ux-pro-max` até o design system ficar pronto.
- [definido] Skills de design: instalar `design-taste-frontend` (taste-skill, MIT) na hora do protótipo, depois de revisar seus scripts. `critique` e `delight` (pbakaus) como revisão. Não usar `bolder` nem `overdrive`.
- [padrão] Resto do `ANALISE-FERRAMENTAS.md` vale como está. Mobbin descartado (plano pago). Playwright MCP quando começarem as telas.
