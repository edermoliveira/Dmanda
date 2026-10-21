# Questionário de alinhamento (refação do design system e novo escopo)

Data: 21/10/2026. Marque a opção ou escreva a sua. A opção marcada com **(R)** é a que eu recomendo. Cada pergunta cita o arquivo `.md` com o qual o novo plano colide.

Decisões já tomadas por você e **não** perguntadas aqui: os 7 menus (Início, Entradas, Demandas, Agenda, Documentos, IA, Configurações), o botão "+" flutuante, o botão de busca fixo, 10 paletas com modo noturno, 5 fontes, tamanhos ajustáveis em tempo real, cards com dois lados, estilo Apple com vidro, mensagem do dia, clima, humor e produtividade.

---

## A. Escopo e ordem (colide com FUNCIONALIDADES.md e PRODUTO.md)

O PRODUTO.md manda "poucos campos, cinco funções essenciais" e põe rascunho solto, documentos, integrações e iPhone em "Depois". O novo plano traz tudo isso para o centro.

**A1. Ordem de construção.** Hoje as fatias começam por cadastro e tela do dia. Qual ordem?
- (R) 1) Novo design system e estrutura de menus. 2) Demandas (cards, cadastro rápido, prazos) + Início. 3) Entradas. 4) Agenda local. 5) Configurações. 6) Busca e botão "+" global. 7) Humor e clima. 8) Google Calendar e Drive. 9) IA. 10) Documentos.
- Manter as fatias antigas e encaixar o novo depois.
- Outra: ______

**A2. O PRODUTO.md deve ser reescrito para o novo escopo?**
- (R) Sim, eu reescrevo PRODUTO.md e FUNCIONALIDADES.md e você aprova antes de qualquer código.
- Não, só acrescentar o que é novo.

**A3. Você aceita que o primeiro uso real (carga inicial das demandas) aconteça só depois das etapas 1 e 2 da A1, ou prefere uma versão mínima de Demandas usável antes de tudo?**
- (R) Versão mínima de Demandas primeiro (cadastro rápido + tela com cards), para você já usar enquanto o resto é construído.
- Só usar quando tudo estiver pronto.

## B. Cores, visual e as regras do CLAUDE.md

O CLAUDE.md diz "poucas cores por tela, cor forte só para atrasado ou crítico", fontes Averia Serif Livre e IBM Plex Mono, e "nenhuma cor solta no código". As Entradas coloridas, as 10 paletas e o gradiente animado mexem nisso.

**B1. Post-its pastéis das Entradas e a regra de poucas cores.**
- (R) Post-its pastéis só na tela Entradas (até 6 tons fixos, derivados da paleta ativa). Demais telas seguem poucas cores.
- Post-its em qualquer tela onde apareçam.

**B2. Regra "cor forte só para atrasado ou crítico" em todas as 10 paletas.**
- (R) Mantida: vermelho (ou o equivalente de alerta) é igual em todas as paletas e só aparece para atraso e crítico.
- Cada paleta pode ter o seu próprio alerta.

**B3. Regra "nenhuma cor solta no código".**
- (R) Mantida. As 10 paletas viram conjuntos de variáveis com nomes de função (fundo, superfície, destaque etc.), e a checagem `verificar:cores` continua.
- Abandonar a regra.

**B4. Fonte atual (Averia Serif Livre).** Ela tem personalidade, mas é pouco usual em painéis. Para a refação:
- (R) Eu proponho 5 pares com FontPair/Google Fonts (com acentos conferidos) e você escolhe o padrão olhando os exemplos.
- Manter Averia como padrão e criar 4 pares a mais.

**B5. Vidro (liquid glass).**
- (R) Vidro em barras, menu lateral, botão flutuante, janelas e campos. Cards de demanda mais sólidos para a leitura. Padrão do celular com menos vidro (desempenho).
- Vidro em tudo, inclusive nos cards.
- Visual mais plano, só um toque de vidro.

**B6. Fundo com gradiente animado (shader).**
- (R) Opcional nas Configurações. Padrão: gradiente estático em CSS. Animado só se você ligar, e desligado sozinho em "reduzir movimento" e economia de bateria.
- Animado como padrão no computador.

**B7. Ícones.** Hoje o CLAUDE.md fixa o Lucide.
- (R) Manter Lucide (já pronto, MIT). Comparo com Iconoir no protótipo e só troco se ficar claramente melhor.
- Trocar para Iconoir já.
- Hugeicons (só se eu confirmar que o pacote gratuito tem licença livre).

**B8. Sons.**
- (R) Só som de concluir demanda, desligado por padrão, com chave nas Configurações.
- Sem som nenhum.
- Sons em várias ações.

**B9. O que você quer aproveitar do design system atual?** (marque o que fica)
- Nome e conceito do logo (D de três colunas). Quer manter, mudar ou refazer?
- Nomes dos tokens de espaço (mini, pequeno, medio...). (R) Manter.
- Cantos 24 px nos cards. (R) Manter como padrão ajustável.
- As 6 peças (Botão, Campo, Janela, Menu, Avatar, Etiqueta): (R) refazer sobre a base shadcn, mantendo os nomes e os 5 estados.

**B10. Prints de referência (`imagens/prints`).** Você manda manter "o mesmo estilo" dos prints para os cards. Eles são de uma só ferramenta, e o REFERENCIAS.md fala disso. O estilo Apple com vidro difere deles.
- (R) Os prints valem para a **organização** (o que aparece no card e como se agrupa), e o **visual** segue o estilo Apple.
- Os prints valem para tudo, inclusive o visual.

## C. Demandas e cards (colide com FUNCIONALIDADES.md)

O mapa tem "Quadro" com 5 colunas arrastáveis, Lista, Calendário e Card aberto. A sua descrição fala de cards com dois lados, e as demandas arquivadas ao final.

**C1. As 5 colunas (Entrada, Triada, Fazendo, Aguardando retorno, Finalizado) continuam?** Atenção: você agora também tem o menu "Entradas", que pode confundir com a coluna "Entrada".
- (R) Manter 5 colunas, renomear a primeira para "Nova" (para não confundir com o menu Entradas), e mostrar as demandas por coluna com alternância de visão (colunas ou grade).
- Manter os nomes como estão.
- Sem colunas: só grade de cards com um selo de etapa.

**C2. Visão de Demandas.**
- (R) Três visões alternáveis no topo: Cards (padrão), Quadro por colunas e Tabela (visão macro, ordenada por prazo, com filtros).
- Só Cards.

**C3. Frente do card** (o que você precisa ver sem abrir). Proposta: número do processo/memorando, assunto, origem, prazo (com selo legal/próprio e atraso em vermelho), próxima tarefa (nunca a concluída), porcentagem pronta pelas tarefas, e setor com dias parados quando estiver em "Aguardando retorno". Falta algo? Sobra algo? ______

**C4. Verso do card** (mais detalhado). Proposta: lista de tarefas com progresso, data de chegada, dias parados, tipo de documento, ações (concluir, arquivar, mover, editar). Algo mais? ______

**C5. Flip por passar o mouse não existe no celular e no iPad.**
- (R) Computador: gira ao passar o mouse. Celular e iPad: gira ao tocar no botão de girar (ícone no canto do card). Toque no corpo do card abre a demanda completa.
- Girar ao tocar em qualquer lugar do card.
- Sem flip, só abrir.

**C6. Se uma demanda não tem tarefas ainda,** o card mostra:
- (R) "Sem próxima tarefa" com atalho para adicionar uma.
- Esconder a linha.

**C7. Arquivo.** O mapa diz "botão Arquivo ao final dos cards". Você agora diz "ao final dos cards ficarão as demandas arquivadas".
- (R) Seção recolhida "Arquivadas (N)" ao final da tela de Demandas, com busca, desarquivar e exclusão definitiva (com segunda confirmação). Continua sendo sempre manual.
- Página separada de Arquivo no menu.

**C8. Porcentagem pronta.**
- (R) Concluídas ÷ total de tarefas. Sem tarefas: sem porcentagem (traço), não 0%.
- Sem tarefas: 0%.

## D. Entradas

**D1. Quais tipos de entrada existem?**
- (R) Só uma coisa: a nota (post-it). Com cor, tags com `#` e fixar no topo. Sem subtipos.
- Nota, lembrete e registro como tipos diferentes.

**D2. "Virar demanda."** Ao converter:
- (R) Abre o cadastro de demanda com o texto da nota já preenchido (primeira linha vira assunto, o resto vai para um campo de observação). A nota some de Entradas e ganha um vínculo com a demanda. Se você cancelar o cadastro, a nota fica.
- A nota fica em Entradas marcada como "virou demanda".

**D3. Entradas antigas.** Notas não convertidas ficam para sempre?
- (R) Para sempre, com arquivar manual (mesma lógica das demandas).
- Apagar sozinhas após X dias.

**D4. Entrada por voz ou foto (celular)?**
- (R) Fica para depois. Primeira versão só texto.
- Já na primeira versão.

**D5. Atalho de captura.** O botão "+" flutuante já cobre. Quer também um atalho de teclado no computador (por exemplo `N`)?
- (R) Sim.
- Não.

## E. Agenda e Google Calendar

**E1. Visões.**
- (R) Mês e semana, mais "Hoje" em lista no celular (calendário mensal fica apertado em celular).
- Só mês e semana.

**E2. Demandas na agenda.**
- (R) Demandas aparecem nos dias de vencimento com cor e forma diferentes dos compromissos (por exemplo, compromisso é bloco cheio e demanda é uma pílula com ícone de documento). Atrasadas ficam em vermelho.
- Demandas só em uma camada que se liga e desliga.

**E3. Sincronia com o Google Calendar.**
- (R) Só do Dmanda para o Google no começo (simples e seguro). Dupla via fica para depois.
- Dupla via desde o início (bem mais trabalhosa).

**E4. Quais itens vão para o Google?** Compromissos e lembretes, claro. E as demandas (prazos)?
- (R) Só compromissos e lembretes. Prazos de demanda ficam no Dmanda.
- Também os prazos legais.

**E5. Tokens do Google em modo de teste expiram em 7 dias,** a menos que o app seja publicado no Google Cloud (processo que pode pedir verificação).
- (R) Eu preparo o modo teste para começar, e deixamos a publicação para quando a integração estiver pronta. Você aceita reconectar a cada 7 dias no começo?
- Só construir a integração depois de resolver isso.

**E6. Notificações de compromissos.**
- (R) No computador e no celular instalado como PWA, com aviso 15 minutos antes (ajustável por evento). Prazo de demanda nunca notifica, como você definiu.
- Outro tempo padrão: ______

**E7. Cadastro de evento "onboarding".** Você descreveu uma tela passo a passo.
- (R) Janela curta em passos (título e hora, depois repetição e lembrete, depois detalhes). Passo 1 já salva se você fechar.
- Formulário único numa janela.

## F. Documentos e Google Drive

**F1. Primeira versão.** Estrutura pronta, sem operar.
- (R) Tela com pastas e modelos vazios ("conecte o Drive para começar"), banco já com tabela de documentos e campo para o endereço no Drive.
- Esconder o menu até estar funcional.

**F2. Documentos vinculados a demandas?** Hoje o mapa não prevê.
- (R) Sim: uma demanda pode ter documentos anexados (links do Drive). Em "Depois", gerar .docx a partir de modelo continua.
- Não.

## G. IA estagiária (colide com a regra de custos do CLAUDE.md)

**G1. Custo.** Pelas informações públicas, a API da Anthropic ou da OpenAI é paga por uso e **separada** das assinaturas Claude Pro e ChatGPT Plus. Opções:
- (R) Construir a tela e o contrato do chat agora, sem IA conectada (mostra "configure a IA"). Decidir o provedor depois de ver o custo real de uso pessoal (costuma ser baixo, mas não é zero).
- Usar IA local (Ollama): sem custo de uso, mas exige um computador forte e instalação, e pode ser lenta.
- Autorizar uma exceção à regra de custos, com limite mensal de US$ ____.

**G2. Poder de ação.**
- (R) A IA propõe e você confirma ("vou marcar X como concluída. Confirma?"), com botão Desfazer. Excluir definitivamente nunca é permitido à IA.
- Executa direto, sem confirmar, ações simples (concluir tarefa, criar evento) e confirma só as demais.
- Só responde, não executa.

**G3. O que a IA pode ler?**
- (R) Demandas, tarefas, agenda e entradas. **Humor não**, a não ser que você autorize.
- Tudo, inclusive humor.

**G4. Dados de processos e LGPD.** Assuntos de processos podem conter nome de pessoas. Se a IA for de um provedor externo, esse texto sai do seu computador.
- (R) Aviso na tela de configuração da IA e opção "ocultar números e nomes" antes de enviar.
- Sem tratamento especial.

**G5. Voz da IA.** "Estagiária" que fala em português do Brasil:
- (R) Tom cordial, direto, sem exagero de elogios, sem gíria.
- Mais descontraído.

## H. Home, mensagem do dia, clima, humor e produtividade

**H1. Mensagem motivacional e bem-humorada (uma por dia).** Quem escreve e de onde vem?
- (R) Eu escrevo 365 mensagens originais e curtas, guardadas no projeto (sem IA em tempo real, sem custo), e elas giram por dia. Você edita ou apaga qualquer uma nas Configurações.
- Gerar pela IA a cada dia (depende de G1).
- Você escreve as suas.

**H2. Alertas ao abrir.** Proposta de ordem: atrasadas (vermelho), vencendo hoje, compromissos de hoje, aguardando retorno parado há mais de X dias. X padrão:
- (R) 7 dias, ajustável.
- 5 dias.
- Outro: ____

**H3. Quantitativos.** Proposta: atrasadas, para hoje, próximos 7 dias, aguardando retorno, entradas sem tratar. Falta ou sobra algum? ______

**H4. Foco do dia (sugestão de até 3 demandas).**
- (R) Incluir. Critério: prazo legal primeiro, depois prazo próprio, depois mais tempo parada. Você pode trocar a escolha.
- Não incluir, só a lista.

**H5. Clima.**
- (R) Open-Meteo (sem chave e sem custo para uso pessoal, com crédito exibido). Cidade padrão Taquara/RS, configurável.
- Outra fonte: ______

**H6. Humor e energia** (veja a pesquisa em ANALISE-FERRAMENTAS.md, item 6).
- (R) Check-in de 5 segundos (humor com 5 rostos e energia em 3 níveis), até 2 vezes ao dia, linha do tempo semanal cruzando com demandas concluídas, sequência gentil e alerta acolhedor de sobrecarga. Tudo desativável. Aviso fixo de que não substitui acompanhamento.
- Só humor, sem energia nem cruzamentos.
- Não incluir.

**H7. Você faz acompanhamento profissional (psicólogo, psiquiatra)?** Se sim, posso incluir "exportar resumo da semana" para levar a consulta (opcional). (R) Incluir o recurso de exportar. Sim / Não / Depois.

## I. Configurações

**I1. Tamanhos em tempo real.** Barra para ícones, fontes, cards e botões.
- (R) Quatro barras (fonte, ícone, card, botão) com prévia ao vivo, mais um botão "restaurar padrão". Limites que impedem tamanho ilegível ou botão menor que 44 px.
- Sem limites.

**I2. Paleta aleatória.**
- (R) Botão "Surpreenda-me" que escolhe uma das 10 e permite voltar à anterior, e opção "trocar a paleta todo dia".
- Só o botão.

**I3. Modo noturno.**
- (R) Cada paleta tem claro e escuro, e a escolha segue o tema do aparelho por padrão (com opção de forçar).
- Escolha manual somente.

**I4. Mais configurações pertinentes** (marque o que quer):
- Cidade do clima. (R)
- Dias de prazo automático (hoje 30). (R)
- Alerta de "parado há X dias". (R)
- Horário dos check-ins de humor. (R)
- Redução de movimento. (R)
- Som ligado ou desligado. (R)
- Exportar todos os dados e importar (cópia de segurança). (R) Importante.
- Idioma: só português. (R)

## J. Onde roda, banco de dados, segurança e custo (colide com PRODUTO.md e CLAUDE.md)

O PRODUTO.md diz "primeiro no computador, depois na internet". Você agora fala em Vercel.

**J1. Vai direto para a internet (Vercel) ou continua local por um tempo?**
- (R) Desenvolver local e publicar na Vercel assim que houver a primeira tela de Demandas, **com login**.
- Só local por enquanto.
- Publicar já.

**J2. Banco de dados.** Na Vercel, dados não podem ficar em arquivo local. Pelo que sei, há bancos Postgres com camada gratuita (por exemplo Neon, Supabase) suficientes para uso pessoal. Confirmo os limites atuais antes de decidir.
- (R) Postgres gratuito (Neon ou Supabase), com cópia de segurança exportável.
- SQLite local enquanto estiver só no computador, migrar depois.
- Outro: ____

**J3. Login.** O `.env.example` prevê login do admin. Os dados de demandas de uma Prefeitura ficam na internet.
- (R) Login por e-mail com link mágico ou conta Google (a mesma da agenda), com uma única conta permitida. Sessão longa no seu aparelho.
- Senha tradicional.
- Sem login (não recomendo, os dados ficariam abertos).

**J4. Dados de trabalho na nuvem.** Os dados dos processos ficam em serviço de terceiros fora do governo. Isso é permitido pela política da Prefeitura?
- (R) Você confirma com a TI/jurídico. Enquanto isso, o sistema evita guardar dados sensíveis desnecessários (nomes de cidadãos, CPF), só número, assunto e origem.
- Segue sem consultar.

**J5. App na App Store.** Exige conta Apple Developer (US$ 99 por ano) e um Mac. Colide com "não pagar além das assinaturas". E a Apple costuma rejeitar sites apenas embrulhados.
- (R) Manter o app nativo como etapa futura, a decidir depois de usar a PWA por algumas semanas. Isso não pesa no projeto agora.
- Já aprovar o custo anual.
- Abandonar a ideia de App Store e ficar na PWA.

**J6. PWA (instalar na tela inicial do iPhone e iPad).**
- (R) Incluir desde o começo: ícone, tela cheia, notificações (iOS 16.4 ou superior) e funcionamento rápido.
- Não.

**J7. Funcionar sem internet?**
- (R) Não na primeira versão. O app guarda rascunhos no aparelho e envia quando voltar a conexão.
- Sim, completo (muito mais trabalhoso).

## K. Ferramentas (resultado de ANALISE-FERRAMENTAS.md)

**K1. Concordo com o resumo "entra, fica fora, adiado"?**
- (R) Sim, exatamente como está.
- Sim, com ajustes: ______

**K2. Mobbin.** Você já assina o plano Pro?
- Sim: então uso o MCP, no momento do app nativo.
- (R) Não: descarto.

**K3. Trail-code (o GRAFT).** Você disse que é obrigatório. Minha avaliação é útil, porém adiar até haver código (~30 arquivos).
- (R) Aceita adiar. Eu rodo `trail init --dry-run` na hora certa e mostro o que será escrito.
- Instalar já. (Aviso: ele escreve em `~/.claude/` e `~/.claude.json` e cria `.mcp.json`. Nessa opção, você roda `npm install -g @trailhq/trail-code` e `trail init --agents claude` pelo PowerShell, e eu reviso antes.)

**K4. Desativar o plugin claude-code-setup.** A edição automática foi bloqueada pelo Claude Code. **Ação sua, no Claude Code:** digite `/plugin`, abra a aba "Installed", escolha `claude-code-setup` e desative. Pode me avisar quando fizer, ou pedir que eu tente de outra forma.

## L. Design system, nome e processo

**L1. Refação "do zero".** Antes de qualquer código, quero fazer uma proposta visual para você aprovar.
- (R) Eu faço 3 direções de estilo em uma página única de protótipo (cada uma com Início, um card de demanda, o menu lateral, o botão flutuante e a busca, claro e escuro), e você escolhe uma. Depois detalhamos.
- Você já tem uma direção em mente e me descreve.

**L2. Mobile primeiro?** Você citou desktop, celular e iPad.
- (R) Projetar e testar primeiro no celular e no iPad, depois ampliar para o computador (as telas de celular costumam ser as mais difíceis).
- Computador primeiro.

**L3. Menu lateral.** Versão completa e recolhida (só ícones), com busca no topo.
- (R) Computador e iPad na horizontal: lateral completa e recolhida. Celular e iPad na vertical: barra inferior com 5 itens principais (Início, Entradas, Demandas, Agenda, Mais) e o resto em "Mais". Pelo alcance do polegar.
- Menu lateral deslizante no celular (hambúrguer).

**L4. Busca e botão "+" ocupam os cantos.** No celular, a barra inferior e o botão "+" flutuante podem brigar.
- (R) Botão "+" flutuante sobre a barra, no canto direito, e busca no topo à direita.
- Colocar o "+" dentro da barra inferior, no centro.

---

## Como responder

Pode responder por letra e número (por exemplo "A1 R, A2 R, B1 R, C1 Nova, ...") ou dizer "tudo R, exceto: ...". Eu atualizo FUNCIONALIDADES.md, PRODUTO.md, CLAUDE.md e ANDAMENTO.md com as respostas, e só depois começo o protótipo (L1).
