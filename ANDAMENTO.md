# Andamento do Dmanda

Última revisão da fórmula e das evidências: 25/10/2026. **Total mantido: 18%** (os pontos abaixo não mudaram: nenhuma etapa nova cumpre ainda o critério de contagem, ver adiante).

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
| Instalar como PWA online | Manifesto, ícones e metadados prontos e conferidos em produção local | Instalar no iPhone e no iPad |
| Exportar uma cópia dos dados | Feito (rota, menu da conta, restauração provada só em banco local) | Destino e rotina de guarda (Issue #4); o Supabase Free não tem backup para baixar |
| Rotina diária | Código e prova HTTP local de 25/10; agendamento no `vercel.json` validado no esquema da Vercel; rota publicada responde 401 sem segredo | Cron registrado no painel, Run manual e primeira execução automática (não comprovados) |

**Nota de 28/10/2026:** o percentual continua 18%. A aplicação foi publicada e conferida sem sessão, mas nenhuma etapa cumpre o critério de contagem (verificada no ambiente real publicado **e** avaliada pelo usuário). Detalhes e evidências em `CONTINUIDADE-DMANDA.md`.
