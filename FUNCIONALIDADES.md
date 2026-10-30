# FUNCIONALIDADES: Mapa do Dmanda

Atualizado em 22/10/2026. Base: `PRODUTO.md`, `PESQUISA.md`, `REFERENCIAS.md` e `DECISOES.md` (esta é a fonte mais recente). Só o mapa, sem código.

**Quem usa:** o **admin**, que é o Secretário, o único usuário. Não existe equipe, convite nem comentário.

**Onde usa:** celular, iPad e computador (a tela se adapta pela largura; computador primeiro). Instalável como PWA. O app nativo fica para o futuro.

**Regra para todas as telas:** o que está sendo digitado é **guardado automaticamente**. Nenhuma mensagem de cobrança ou culpa dirigida ao usuário.

**Navegação (pela largura da tela, não só pela orientação):** largura estreita (celular, iPad vertical ou em tela dividida): barra inferior de vidro com Início, Demandas, "+" (centro), Agenda e Mais. Largura média: menu lateral recolhido (só ícones). Largura larga (computador, iPad horizontal): menu lateral completo, busca no topo. O "+" cadastra anotação, demanda ou evento em um toque. Botão de busca (lupa) fixo no canto superior direito. Avatar no topo abre o Perfil.

---

## 1. Funções por tela

### Início
- Mensagem motivacional e bem-humorada do dia (uma por dia, sorteada de um banco de 500 frases do usuário, sem repetir até esgotar).
- Quantitativos: atrasadas, para hoje, próximos 7 dias, aguardando retorno e entradas sem tratar.
- Alertas ao abrir: atrasadas (vermelho), vencendo hoje, compromissos de hoje, aguardando retorno parado há mais de 7 dias (ajustável).
- "Foco do dia": até 3 demandas sugeridas (prazo legal primeiro, depois próprio, depois mais tempo parada). O usuário pode trocar.
- Widget de clima da cidade (configurável).
- Acesso rápido para registrar humor e energia.
- Abrir uma demanda a partir da lista. Marcar como concluída.

### Entradas
- Notas em post-its pastel (até 6 tons), em cards, com tags `#` e fixar no topo.
- Criar, consultar e editar nota rápida (título opcional, texto, cor, fixar), com salvamento automático no Supabase e rascunho no aparelho. **Implementado em 30/10/2026** (decisões 37 a 39, Issue #5); **funcionamento aprovado pelo usuário em 30/10/2026**.
- **Post-it (decisão 42):** título e, abaixo, o texto como descrição (estilo das demandas); no pé, a data da primeira criação (`criado_em`, "30/10/2026 às 14:48"); cinco cores mais a automática.
- **Abrir uma entrada é ler, não editar (decisão 40):** a janela de leitura mostra título, texto completo e tags sem abrir o teclado; o **lápis** liga a edição. Rascunho não enviado fica em espera, com aviso e botão "Retomar edição". Entrada convertida só abre em leitura, com "Abrir a demanda".
- **Virar demanda:** abre o cadastro guiado preenchido e editável (título explícito vira o assunto; sem título, a primeira linha útil; o resto vai para a descrição, com as tags). A nota sai de Entradas quando a demanda é criada no passo 2, na mesma transação do banco; cancelar antes mantém a nota. A demanda guarda o vínculo e a nota original fica preservada no Arquivo.
- Arquivar nota (manual) e recuperar pelo Arquivo (aba Entradas). Buscar dentro das entradas e filtrar por tag. Atalho N no computador e "Nova entrada" no botão "+".

### Demandas
- Visões, cada uma com função própria: **Cards** (leitura visual), **Quadro** (mover entre etapas), **Tabela** (análise detalhada, colunas ordenáveis e filtros) e **Lista** (consulta rápida: uma linha por demanda, com seta para ver e marcar tarefas, lápis para a consulta completa, assunto à esquerda, número, tipo e origem quando existem, vencimento e tarefas em posição fixa).
- Cinco etapas: **Cadastro, Vistos, Fazendo, Aguardando retorno, Finalizado**.
- Cadastro guiado em três passos (identificação, chegada e prazo, tarefas), com só o assunto obrigatório, em qualquer etapa (decisão 28). Consulta da demanda com lápis por seção (decisão 29). Prazo original e vencimento ajustado, dias indisponíveis em Configurações (decisões 31 e 32).
- Mover card entre etapas. Botão **"Já vi"** leva de Cadastro para Vistos (com ou sem tarefas). Cadastrar a primeira tarefa também leva para Vistos.
- Quando todas as tarefas forem concluídas, o card sugere "Finalizar?". Sem tarefas, há o botão Concluir.
- Contagem de cards por etapa. Filtros (prazo, origem, só atrasadas, legal, próprio, sem prazo) e filtro de texto.
- No **Quadro**, arrastar o card para outra etapa. Atalho `N` abre nova anotação.
- Atalho "Arquivo" ao final da tela.

### Card (dois lados)
- **Frente:** número do processo/memorando, assunto e origem, vencimento e contagem regressiva (atraso em vermelho; o selo legal ou próprio **não** aparece mais nos cards, só na Tabela e nos detalhes), próxima tarefa (nunca a concluída) e porcentagem pronta.
- **Verso:** lista de tarefas com marcar, data de chegada, dias parado, tipo de documento, setor e dias em Aguardando retorno, e ações (Já vi, Concluir, Arquivar, Mover, Editar).
- Giro: passar o mouse no computador. Botão de girar no celular e no iPad. Toque no corpo do card abre a demanda completa.
- Sem tarefas: mostra "Sem próxima tarefa" com atalho. Porcentagem só aparece quando há tarefas.

### Demanda aberta
- Editar **qualquer campo** (número, assunto, origem, tipo, prazo, tipo de prazo, data de chegada, etapa, tarefas). O sistema ajusta o que depende dele.
- Tipo de documento com um clique, opcional. Criar tipo novo na hora.
- Prazo legal ou próprio. Sem prazo, nada é inventado: a demanda fica fora dos filtros de prazo e do Foco do dia (o formulário pode sugerir 30 dias, mas só vale se o usuário escolher; regra de `DECISOES.md`, item 6).
- Tarefas: criar, marcar, ordenar.
- Aguardando retorno: dizer o setor (ou "Prefeita"), registrar uma **data de acompanhamento** (cobrar, reiterar o pedido ou conferir; avisa no Início e aparece na Agenda), marcar o retorno (volta para Fazendo).
- Concluir. **Reabrir** uma demanda finalizada ou arquivada: preserva o histórico e as tarefas cumpridas, permite novas tarefas sem perder as anteriores e volta para a etapa escolhida (padrão: Fazendo).
- Anexar documentos (links do Drive).
- Arquivar (botão em todo card) ou remover: perguntar "arquivar" ou "excluir definitivamente" (segunda confirmação).

### Arquivo (página separada)
- Demandas arquivadas, concluídas ou não. Não aparecem em Início, Agenda, Lista nem contam como atrasadas.
- Buscar, abrir para consulta, desarquivar, excluir definitivamente (segunda confirmação).

### Agenda
- Visão **semanal** (domingo a sábado, fins de semana esmaecidos) e **mensal**. No celular, também lista "Hoje".
- Demandas: cards **amarelos** só no dia do vencimento (parte inferior do dia na semana). Vencidas permanecem na data original em vermelho. Tarefas concluídas ocultas, reexibíveis por filtro.
- Eventos: cards **azuis** (com horário) e **cinza-azulado** (dia inteiro, como feriados).
- Mês: indicador da quantidade de demandas, destaque dos dias mais cheios com sugestão de antecipar ou redistribuir, tilt leve ao passar o mouse.
- Criar evento pelo "+" dentro do dia (janela em passos). Navegar por datas, filtrar por categoria, abrir detalhes.
- Dias úteis com destaque discreto.
- Alerta de **eventos concomitantes** (só eventos).
- Notificação para evento, compromisso e lembrete (nunca para prazo de demanda).
- Sincroniza do Dmanda para o Google Calendar, **sem duplicar eventos**. Apple Calendar no futuro.
- Cadastro de feriados e pontos facultativos.

### Documentos
- Primeira versão: estrutura e tela vazia, tabela pronta. Depois: modelos e arquivos ligados ao Google Drive, subir ou criar documento.

### IA
- Chat em português que age como estagiária: resume o dia, lista pendências, documentos e compromissos, consolida dados (por exemplo, meses com mais demandas).
- Executa ações: marcar tarefa como cumprida, arquivar, incluir tarefa, marcar reunião. **Toda ação pode ser desfeita.** Excluir: pergunta e só executa com confirmação.
- Lê demandas, tarefas, agenda e entradas. Nunca lê humor sem permissão.
- Provedor trocável (prioridade: gratuito). Primeira versão pode ter a tela pronta, ainda sem IA conectada.

### Configurações
- Cores: 10 paletas (cada uma com claro e escuro), escolha aleatória, tema seguindo o aparelho.
- Fontes: 5 pares.
- Tamanhos: ícones, fontes, cards e botões, em barras com visualização em tempo real, com limites e "restaurar padrão".
- Fundo: gradiente estático ou animado.
- Conta Google (Calendar e Drive), IA (provedor, chave), cidade do clima, dias do prazo automático, alerta de parado há X dias, balões de humor, reduzir movimento.
- Perfil (avatar com foto ou 5 ilustrações).
- Exportar e importar todos os dados. Cadastrar e editar o banco de 500 mensagens.
- Tipos de documento (adicionar, renomear, ocultar). Feriados.

### Perfil (avatar no topo)
- Registro de **humor** (emojis), **energia** e **produtividade** (demandas finalizadas no dia, calculada).
- Balões discretos a cada 3 horas de trabalho desde o login (cerca de 4 por dia, incluindo o primeiro do dia). Só o último registro de cada indicador fica no dia.
- Correção até 5 dias depois. Janela antes do Início para completar pendências (ignora fins de semana e feriados, só o que falta, rápida, opcional). Dias sem registro ficam "Sem registro".
- Painel: resumo do dia, gráfico interativo (semana e mês) com resumo ao passar o mouse, histórico visual compacto e os três indicadores juntos. Frase sempre neutra e acolhedora. Gráficos podem ser coloridos, animados e elegantes, desde que as cores não classifiquem a produtividade como boa ou ruim.
- Humor e energia privados. Sem metas nem cobrança. Aviso de que não substitui acompanhamento profissional.

### Busca global (lupa)
- Procura em tudo: demandas (número, assunto, origem), tarefas, entradas, documentos, eventos.

### Botão "+" (flutuante)
- Nova entrada, nova demanda, nova tarefa (dentro de uma demanda), novo evento, novo documento, novo chat. Entrada é a primeira opção.

### Rascunhos
- Guardar automaticamente cadastro ou edição ainda não salvo, retomar ao reabrir e descartar.

---

## 2. A jornada de uma demanda

1. **Chega.** Processo, memorando, ofício ou pedido por papel, e-mail, WhatsApp ou reunião. Pode começar como uma **entrada** (nota rápida) e virar demanda.
2. **Cadastro.** Registra-se número, prazo, assunto e origem, e o tipo de documento se quiser. Sem prazo, nenhuma data é inventada (ver a regra em `DECISOES.md`). Prazo legal prevalece.
3. **Vistos.** Você olhou, entendeu o que precisa ser feito e tocou em **"Já vi"**. Pode cadastrar tarefas (ou não, se for um passo só).
4. **Fazendo.** Está em trabalho com você.
5. **Aguardando retorno.** Enviou a outro setor externo à Secretaria, ou aguarda análise ou decisão da Prefeita. Mostra o setor e os dias parado.
6. **Retorno.** Quando a resposta volta, você marca o retorno e a demanda volta para Fazendo.
7. **Finalizado.** O card sugere "Finalizar?" quando as tarefas acabam. A demanda sai da Secretaria.
8. **Reativação.** Se o processo voltar, a demanda antiga é reaberta com histórico e tarefas.
9. **Arquivo.** Arquivar é sempre manual.

---

## 3. Etapas de construção (situação em 25/10/2026)

Situação: **concluída e verificada**, **implementada, a validar**, **em andamento** ou **não iniciada**. Nada é marcado como concluído sem verificação.

1. **Design system e protótipo:** concluída. Catalyst único, claro e escuro, aprovado visualmente em `cd7b03f`. Restam acabamentos agrupados (ícones restantes, teclado virtual em aparelho real) que não bloqueiam as funcionalidades.
2. **Base técnica:** em andamento. Pronto e testado no banco local de teste: esquema, RLS, funções SQL, proxy de acesso, login Google no código e expiração após 6 h (ambos superados em 26 e 27/10/2026: vale a entrada por e-mail e senha e a sessão persistente). Supabase real criado e migrado, com RLS, privilégios, conta única e hook validados por SQL. **A validar:** login Google real, persistência pela interface com sessão real, publicação protegida na Vercel. Rotina diária preparada (chamada manual validada no banco de teste), sem agendamento implantado.
3. **Versão mínima de Demandas e Início:** implementada, a validar no Supabase real. Cadastro rápido, cards de dois lados, etapas, tarefas, prazos, concluir, reabrir, arquivar, excluir, quantitativos e Foco do dia, testados no banco de teste.
4. **Demandas completas:** implementada, a validar no Supabase real. Quatro visões (Cards, Quadro, Tabela, Lista), Arquivo, edição de qualquer campo, mover por menu e arraste, rascunhos, busca, filtros e ordenação. Pendente dentro desta etapa: campo para cadastrar o selo MP, tipos de documento opcionais além dos atuais, se o usuário quiser.
5. **Entradas** e virar demanda: **implementada em 30/10/2026**, testada no banco de teste e com a migração 10 aplicada no Supabase real; **a validar** (avaliação do usuário na PWA, Issue #5). Fora do bloco: voz, foto, envelhecimento das notas, IA.
6. **Agenda local** (semana, mês, feriados, notificações): não iniciada.
7. **Configurações** (paletas, fontes, tamanhos, fundo): não iniciada na aplicação funcional (existe no protótipo).
8. **Busca global e botão "+":** botão "+" funcional para nova demanda; busca global desativada com aviso. Busca e filtros de Demandas funcionam.
9. **Perfil: humor, energia, produtividade, clima e mensagem do dia:** não iniciada na aplicação funcional (existe no protótipo). Cada registro de Humor e Energia terá a sua própria data.
10. **Google Calendar e Drive:** não iniciada.
11. **IA estagiária:** não iniciada (as operações de Demandas já estão em funções reutilizáveis).
12. **Documentos:** não iniciada.

Histórico: "antes de iniciar Entradas, Agenda ou outro módulo grande, fechar a base real e obter a avaliação do usuário sobre a aplicação atual". **Cumprido em 30/10/2026**: o usuário aprovou o bloco anterior e autorizou Entradas. **Vigente:** a Agenda e os demais módulos só começam depois da avaliação de Entradas pelo usuário.

---

## 4. Decisões já tomadas
Estão em `DECISOES.md`. Resumo das regras de negócio: Aguardando retorno é uma **coluna**. Sem prazo, nenhuma data é inventada (item 6 de `DECISOES.md`). Categoria é o **tipo de documento**, opcional. Arquivar é sempre manual e todo card tem esse botão. Excluir definitivamente pede segunda confirmação.

## 5. Pontos ainda em aberto
- Padrões do Catalyst: par de fontes, estilo de ícones e paleta padrão (há padrões provisórios). Direção única já decidida.
- Limites do plano gratuito do Postgres (Supabase) e da IA gratuita.
- Nomes e textos exatos de botões, ficam para a etapa das telas.
- Peças com os cinco estados e conferência de contraste no Catalyst, claro e escuro.
