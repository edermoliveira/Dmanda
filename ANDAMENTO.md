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
| Estrutura: menus, banco, login, publicação | Menus e moldura da aplicação funcionando (`testar:app`, 57 verificações); esquema, RLS e funções SQL (`testar:banco`, 68); proxy, expiração de 6 h, rotina diária e build limpo, **todos em banco de teste** | Projeto Supabase real com migrações aplicadas, login Google restrito, publicação protegida na Vercel, primeira execução automática da rotina |
| Demandas | Cadastro, edição, tarefas, etapas, concluir, reabrir, arquivar, excluir, quatro visões, filtros e ordenação passam em `testar:app` no banco de teste | Validação no Supabase real e avaliação do usuário da aplicação atual |
| Início | Contadores, grupos e Foco do dia passam em `testar:regras` e `testar:app` (banco de teste); falta clima, mensagem do dia e widgets | Validação real, avaliação do usuário e os itens que ainda não existem na aplicação funcional |
| Demais etapas | Existem só no protótipo (Entradas, Agenda, Configurações, Perfil, IA simulada) | Construção na aplicação funcional |

Assim que o Supabase real for validado e o usuário avaliar a aplicação, reavaliar as linhas Estrutura, Demandas e Início com os critérios acima e registrar a nova soma.
