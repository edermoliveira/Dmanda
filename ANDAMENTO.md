# Andamento do Dmanda

Última revisão da fórmula e das evidências: **30/10/2026**. **Total: 37%** (33% antes da aprovação dos ajustes; 29% na primeira reavaliação de 30/10/2026; 18% até 29/10/2026). É a primeira reavaliação que incorpora uma avaliação do usuário: em 30/10/2026 ele **aprovou o bloco entregue na versão `2714937`** (correções do cadastro, cards, tipografia e prazos, na aplicação publicada). A aprovação vale **só** para o que ele disse. Ela **não** comprova a origem das execuções do cron nem a permanência prolongada da sessão, e nada abaixo a usa para isso.

**Segunda reavaliação de 30/10/2026 (depois do bloco de ajustes).** O usuário **aprovou o funcionamento de Entradas** (versão `1aecf40`, testada por ele na PWA do iPhone) e pediu cinco ajustes de consulta e interface, entregues no commit `c932dac` e **ainda aguardando a conferência dele no iPhone**. A aprovação vale para o **funcionamento**; não é aprovação visual. Mudanças nas contas: (a) Entradas passa a contar os itens que ele aprovou; (b) Estrutura ganha meio ponto, porque ele confirmou usar a PWA no iPhone (o iPad não é presumido); (c) Demandas **perde** meio item: "Dias indisponíveis" estava contado como aprovado, e ele apontou depois o campo Data saindo do quadro no iPhone, então o item volta a meio ponto até ele conferir a correção.

**Como o número foi calculado.** A fórmula não mudou: **pontos = peso x percentual feito, somados.** O percentual de cada etapa passou a ser, desde 30/10/2026, **a fração dos itens da etapa que cumprem o critério de contagem** (abaixo), com **itens de peso igual** e a lista completa na tabela "Itens por etapa". Um item só conta quando está verificado no ambiente real publicado **e** avaliado pelo usuário; item avaliado só em parte conta meio. O resultado não foi escolhido como meta: é o que sai da contagem. Etapas sem nenhum item avaliado ficam em 0.

| Etapa | Peso | Feito | Pontos | Situação em 30/10/2026 |
|---|---|---|---|---|
| Planejamento e pesquisa de ferramentas | 8 | 100% | 8,0 | Documentos revisados e decisões gravadas |
| Design system novo (refação) e protótipos | 12 | 85% | 10,2 | **Catalyst único aprovado** (`cd7b03f`), claro e escuro, com a escala tipográfica de 85% aprovada na aplicação. Falta a página de peças com os cinco estados e a revisão consolidada dos ícones restantes |
| Estrutura: menus, banco de dados, login, publicação | 12 | 45% | 5,4 | Contam: menus e moldura, entrada por senha no Supabase real, banco real com 10 migrações e dados reais em uso, publicação na Vercel e, pela metade, a PWA instalada (o usuário confirmou usar no iPhone em 30/10/2026; o iPad não é presumido). Faltam: sessão por horas reais, PWA no iPad, cron registrado e com execução comprovada, cópia dos dados baixada no app instalado, restauração em projeto real e destino da cópia (Issue #4) |
| Demandas (cards, cadastro, prazos, tarefas, arquivo) | 18 | 42% | 7,6 | Aprovados pelo usuário: cadastro guiado, cards, prazo original e ajustado, dias indisponíveis (campo Data corrigido e aprovado em `ddef462`), a Lista reorganizada e, em parte, o Quadro. O botão "Arquivadas" de Demandas aguarda a conferência. Falta a avaliação de Tabela, Lista, consulta com lápis, tarefas, etapas, arquivo, filtros e do uso com dados reais |
| Início (indicadores, alertas, mensagem do dia, clima) | 7 | 0% | 0 | Indicadores, grupos e Foco do dia existem e passam nos testes, mas **o usuário ainda não avaliou o Início**. Não existem clima, mensagem do dia nem widgets |
| Entradas (post-its, virar demanda) | 6 | 92% | 5,5 | **Funcionamento aprovado pelo usuário em 30/10/2026** (`1aecf40`) e ajustes aprovados (`ddef462`): leitura com lápis e seletor do Arquivo; o visual dos post-its não foi declarado aprovado (meio ponto). Fora do bloco: voz, foto, envelhecimento das notas e IA |
| Agenda (visões, eventos, notificações) | 9 | 0% | 0 | Só no protótipo. Não iniciada na aplicação |
| Busca global e botão "+" | 5 | 0% | 0 | O "+" existe com Demanda, Tarefa e Nova entrada; Evento, Documento e Chat estão desativados. Busca global não existe |
| Configurações (paletas, fontes, tamanhos) | 8 | 0% | 0 | Só Dias indisponíveis existe na aplicação |
| Humor e produtividade | 4 | 0% | 0 | Só no protótipo |
| Google Calendar e Drive | 5 | 0% | 0 | Não iniciada |
| IA estagiária | 4 | 0% | 0 | Não iniciada |
| Documentos | 2 | 0% | 0 | Não iniciada |

Soma dos pontos: 36,7, ou **37%** (8,0 + 10,2 + 5,4 + 7,6 + 5,5); era 33,1 antes da aprovação dos ajustes. Antes: 29,3 na primeira reavaliação de 30/10/2026 e 18,2 até 29/10/2026. Subiram Estrutura (meio ponto, PWA no iPhone) e Entradas (aprovação funcional); desceu Demandas (Dias indisponíveis voltou a meio ponto). O resultado sai da contagem, não de uma meta. (Linha anterior, superada: "29,3, ou 29%".)

### Itens por etapa (base dos percentuais de 30/10/2026; itens de peso igual)

| Etapa | Itens que contam (evidência) | Itens que ainda não contam (o que falta) |
|---|---|---|
| Estrutura (10 itens, 4,5 contam = 45%) | (1) Entrada por e-mail e senha no Supabase real (26 e 27/10, 19 verificações; saída e nova entrada confirmadas pelo usuário em 27/10). (2) Banco real com 10 migrações aplicadas com dry-run, sem perda de dados, RLS e conta única. (3) Publicação em https://dmanda-adm.vercel.app com o commit servido conferido e blocos publicados aprovados pelo usuário. (4) Menus e moldura da aplicação. (6, metade) PWA instalada no **iPhone** (confirmado pelo usuário em 30/10/2026); o iPad não é presumido | (5) Sessão persistente por horas reais. (6, outra metade) PWA no iPad. (7) Cron registrado e execução automática (o banco mostra execuções, sem distinguir agendamento de clique manual). (8) Cópia dos dados baixada dentro do app instalado. (9) Restauração da cópia em projeto real. (10) Destino da cópia fora do aparelho (Issue #4) |
| Demandas (13 itens, 4 contam = 31%) | (1) Cadastro guiado em três passos. (2) Cards com título priorizado. (3) Prazo original e ajustado. (4, metade) Dias indisponíveis em Configurações (aprovado em 30/10 pela versão `2714937`; depois o usuário viu o campo Data fora do quadro no iPhone). (5, metade) Quadro: botão "Nova demanda" só em Cadastro; arrastar não foi avaliado | Tabela; Lista (reorganizada em 30/10/2026, aguarda conferência); consulta com lápis por seção; tarefas (edição, marcar); etapas (mover, concluir, reabrir); arquivo e exclusão; filtros, busca e ordenação; uso com dados reais avaliado; atalho "Arquivo" no fim da tela; conferência do campo Data corrigido |
| Início | (nenhum item avaliado) | Indicadores, grupos e Foco do dia avaliados pelo usuário; clima; mensagem do dia; widgets; regra de "Aguardando retorno" (`AUDITORIA.md`, P5) |
| Entradas (6 itens, 4 contam = 67%) | (1) Criar, consultar e editar com salvamento automático e rascunho. (2) Buscar, tags e fixar. (3, metade) Arquivar e recuperar pelo Arquivo (o seletor Demandas e Entradas apareceu sem texto no iPhone; corrigido, aguarda conferência). (4) Virar demanda. (6, metade) Post-its no iPhone: funcionamento aprovado, visual não declarado aprovado. Aprovação do funcionamento pelo usuário em 30/10/2026 (versão `1aecf40`) | (5) Modo de leitura com lápis (implementado, aguarda conferência no iPhone). Voz, foto, envelhecimento das notas e IA ficam para depois |

Observação sobre os números antigos desta página: as linhas "Não iniciada" das versões anteriores (Estrutura, Demandas, Início, Entradas) foram **superadas** pela tabela acima; o texto histórico abaixo continua como registro do que valia em cada data.

## Critério para contar pontos (definido em 25/10/2026)

Uma etapa só soma pontos quando está **verificada no ambiente real** e **avaliada pelo usuário**. Teste no banco local de teste mostra que a lógica e a interface funcionam, mas não conta como entrega da etapa. A cada reavaliação, anotar a evidência (teste, commit, data) ao lado do percentual. Estimativas antigas não valem como prova.

Evidências já existentes em 25/10/2026 (por isso as linhas abaixo não mudaram de percentual):

| Etapa | Evidência verificada | O que falta para contar |
|---|---|---|
| Design system e protótipos | Catalyst aprovado visualmente em `cd7b03f`; testes do protótipo em `prototipo/testes/` | Peças com cinco estados e revisão consolidada dos ícones restantes |
| Estrutura: menus, banco, login, publicação | Menus e moldura da aplicação funcionando (`testar:app`, 58 verificações); esquema, RLS, funções, acesso exclusivo e hook (`testar:banco`, 87); proxy, expiração de 6 h, rotina diária e build limpo, **em banco de teste**. **No Supabase real (25/10/2026):** 5 migrações aplicadas, Security Advisor sem problemas, RLS, privilégios, conta única, rejeição de outras contas, hook e rotina como papel de serviço validados por SQL em transações desfeitas (JWT simulado) | Login Google real (primeiro e segundo acesso, rejeição de outra conta), hook ativado no painel, gravação pela interface com sessão real, publicação protegida na Vercel, primeira execução automática da rotina |
| Demandas | Cadastro, edição, tarefas, etapas, concluir, reabrir, arquivar, excluir, quatro visões, filtros e ordenação passam em `testar:app` no banco de teste. As operações SQL (criar, tarefa, etapa, salvar, concluir, reabrir) também passaram no banco real por SQL | Persistência pela interface com login real, quatro visões com dados reais e avaliação do usuário da aplicação atual |
| Início | Contadores, grupos e Foco do dia passam em `testar:regras` e `testar:app` (banco de teste); falta clima, mensagem do dia e widgets | Validação real, avaliação do usuário e os itens que ainda não existem na aplicação funcional |
| Demais etapas | Existem só no protótipo (Entradas, Agenda, Configurações, Perfil, IA simulada) | Construção na aplicação funcional |

Os pontos não mudaram em 25/10/2026 (segunda revisão do dia): a validação real ficou parcial (banco, sem login Google) e o usuário ainda não avaliou a aplicação. Assim que o login real for validado e o usuário avaliar a aplicação, reavaliar as linhas Estrutura, Demandas e Início com os critérios acima e registrar a nova soma.


**Nota de 26/10/2026 (noite):** o percentual continua 18%. Entrada por senha provada no Supabase real, migrações 6 e 7 aplicadas e a perda de tarefas corrigida são marcos de verificação registrados em `AUDITORIA.md` (seção 15); o critério de cálculo não mudou e o percentual não substitui esses marcos.

**Nota de 27/10/2026:** o percentual continua 18%. A base Supabase do núcleo (acesso por senha, saída e nova entrada, gravação e leitura persistentes, restrições de acesso) tem evidência no Supabase real e foi fechada tecnicamente (`AUDITORIA.md`, seção 17), mas pelo critério acima nenhuma etapa soma pontos ainda: faltam a publicação protegida, a primeira execução automática e a avaliação do usuário da aplicação (Issue #2). O percentual não substitui esses marcos.

**Nota de 27/10/2026 (noite):** o percentual continua 18%. A auditoria completa (`AUDITORIA.md`, seção 18) corrigiu defeitos e confirmou a prontidão técnica, mas nenhuma etapa cumpre ainda o critério de contagem (verificada no ambiente real publicado **e** avaliada pelo usuário).

## Prontidão da primeira versão utilizável (lista, sem percentual próprio)

Estados reais em 27/10/2026. "Feito" quer dizer verificado nos testes e, onde indicado, no Supabase real; "Depende de" aponta o que só existe depois de publicar ou no aparelho do usuário.

| Critério | Estado | Depende de |
|---|---|---|
| Entrar e sair por senha | Feito no Supabase real (26 e 27/10) e no Auth falso (57 verificações) | Conferir de novo no endereço publicado |
| Cadastrar e editar demandas e tarefas | Feito (`testar:app` 74, `testar:banco` 118; gravação real em 26/10) | Nada além da publicação |
| Mover etapas, concluir, reabrir e as quatro visões | Feito nos testes | Avaliação visual do usuário (Issue #2) |
| Dados preservados ao recarregar e entre aparelhos | Feito (recarga real, dois aparelhos simulados, edição simultânea recusada) | Conferir com computador e iPhone reais |
| Início com dados reais | Feito com banco de teste; banco real tem 0 demandas | Uso real; regra de "Aguardando retorno" pendente de decisão (`AUDITORIA.md`, P5) |
| Aplicação publicada | **Feito em 28/10/2026**: https://dmanda-adm.vercel.app, commit `58fc8ec` servido (status da Vercel no GitHub), login, rotas protegidas, manifesto, ícones, estilos, cron 401 e região `gru1` observados sem sessão | Validação autenticada em produção (entrar, cadastrar, recarregar) e avaliação do usuário |
| Instalar como PWA online | Manifesto, ícones e metadados prontos e conferidos em produção local | **iPhone: instalada** (confirmado pelo usuário em 30/10/2026). iPad: instalar, se for usar (não presumido) |
| Exportar uma cópia dos dados | Feito (rota, menu da conta, restauração provada só em banco local) | Destino e rotina de guarda (Issue #4); o Supabase Free não tem backup para baixar |
| Rotina diária | Código e prova HTTP local de 25/10; agendamento no `vercel.json` validado no esquema da Vercel; rota publicada responde 401 sem segredo | Cron registrado no painel, Run manual e primeira execução automática (não comprovados) |

**Nota de 28/10/2026:** o percentual continua 18%. A aplicação foi publicada e conferida sem sessão, mas nenhuma etapa cumpre o critério de contagem (verificada no ambiente real publicado **e** avaliada pelo usuário). Detalhes e evidências em `CONTINUIDADE-DMANDA.md`.

**Nota de 29/10/2026:** o percentual continua 18%. O bloco de sessão persistente, cadastro guiado, consulta com lápis, prazo original e ajustado e dias indisponíveis está implementado e testado (banco, regras, aplicação e sessão), mas nenhuma etapa cumpre o critério de contagem (verificada no ambiente real publicado **e** avaliada pelo usuário): a avaliação no iPhone real e no computador, a validação autenticada em produção e a avaliação visual da aplicação React (Issue #2) continuam pendentes. Estimativas e testes automatizados não substituem esses marcos.

**Nota de 30/10/2026:** o percentual passou de 18% para 29% pela contagem de itens descrita no topo, depois da aprovação do usuário ao bloco `2714937`. Entradas, publicada no mesmo dia, ainda não soma pontos (aguarda a avaliação). Nenhum ponto foi atribuído a cron, sessão por horas reais, PWA instalada ou restauração real, que seguem não verificados.

**Nota da segunda reavaliação de 30/10/2026:** 29% para 33%, pela contagem acima. O bloco de ajustes (leitura com lápis, seletor do Arquivo, campo Data, Lista, selo) não soma ponto por si: só passa a contar depois da conferência do usuário no iPhone. Limitação das provas: Edge e WebKit do Playwright no Windows (o motor do Safari, não o Safari do iPhone).

## Histórico: versão da página até 29/10/2026 (superada pelo topo acima)

Última revisão da fórmula e das evidências: 29/10/2026. **Total mantido: 18%** (os pontos abaixo não mudaram: nenhuma etapa nova cumpre ainda o critério de contagem, ver adiante).

Em 21/10/2026 o escopo cresceu muito (Entradas, Agenda com Google, Documentos, IA, Configurações, humor, clima, PWA) e o design system será refeito do zero. Por isso o percentual caiu de 24% para 6%: o cálculo agora considera o plano novo, ainda pendente de aprovação (ver `QUESTIONARIO.md`). O número volta a subir conforme as etapas forem entregues.

Cada etapa tem um peso (soma 100) e um percentual feito. O total é a soma dos pontos.

| Etapa | Peso | Feito | Pontos | Situação |
|---|---|---|---|---|
| Planejamento e pesquisa de ferramentas | 8 | 100% | 8,0 | Documentos revisados e decisões gravadas em 21/10/2026 |
| Design system novo (refação) e protótipos | 12 | 85% | 10,2 | Três temas definitivos (Aurora, Papel, Grafite) mais o Catalyst (em avaliação) no protótipo `prototipo/`, com escala única de botões, widgets e testes automáticos de cliques e contraste (`prototipo/testes/`). Falta a página de peças com os cinco estados |
| Estrutura: menus, banco de dados, login, publicação | 12 | 0% | 0 | Não iniciada |
| Demandas (cards, cadastro, prazos, tarefas, arquivo) | 18 | 0% | 0 | Não iniciada |
| Início (indicadores, alertas, mensagem do dia, clima) | 7 | 0% | 0 | Não iniciada |
| Entradas (post-its, virar demanda) | 6 | 0% | 0 | Não iniciada |
| Agenda (visões, eventos, notificações) | 9 | 0% | 0 | Não iniciada |
| Busca global e botão "+" | 5 | 0% | 0 | Não iniciada |
| Configurações (paletas, fontes, tamanhos) | 8 | 0% | 0 | Não iniciada |
| Humor e produtividade | 4 | 0% | 0 | Não iniciada |
| Google Calendar e Drive | 5 | 0% | 0 | Não iniciada |
| IA estagiária | 4 | 0% | 0 | Não iniciada |
| Documentos | 2 | 0% | 0 | Não iniciada |

Soma dos pontos: 18,2, ou 18%. (Era 17,6 antes da rodada 3.) A fórmula não mudou: pontos = peso x percentual feito, soma de todas as etapas.

**Nota de 30/10/2026 (aprovação dos ajustes):** o usuário aprovou os ajustes da versão `ddef462` (leitura de Entradas com lápis, seletor do Arquivo, campo Data, Lista, selo fora dos cards). Isso passa a contar: Entradas completa os itens 3 e 5 e o item 6 fica em meio ponto (o visual não foi declarado aprovado), Demandas recupera "Dias indisponíveis" por inteiro e ganha a Lista. Recontagem (corrige a tabela das notas): Entradas 5,5 de 6 (92%, 5,5 pontos); Demandas 5,5 de 13 itens, com o Quadro em meio (42%, 7,6 pontos), sem contar Tabela, tarefas, etapas, arquivo e filtros; Estrutura 45% (5,4); Design 85% (10,2); Planejamento 100% (8,0). Soma: 36,7, ou **37%**. O botão "Arquivadas" de Demandas (`d1cac39`) ainda aguarda a conferência e não soma.
