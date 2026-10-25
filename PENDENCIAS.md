# Pendências do Dmanda

Arquivo lido no início de cada sessão. Fica no repositório para valer em qualquer computador.

## Aguardando o usuário

**Supabase real (25/10/2026, bloqueia a validação da persistência):** criar o projeto no Supabase, aplicar as duas migrações de `supabase/migrations/`, configurar o Google OAuth, criar o `.env.local` e dizer ao Claude. Passo a passo em `supabase/LEIA-ME.md`. Até lá o aplicativo só roda no banco local de teste.

Nada abaixo foi decidido pelo Claude. O detalhe de cada item está em `SINCRONIZA-PROJETINHO.md`, seção 3.

**Decisões**
1. **GitHub Issues:** aprovar (ou ajustar) a proposta de etiquetas, marcos e uso nos commits, e dizer "pode criar". Nada foi criado ainda.
2. **Skills de design:** o Claude recomenda a **Impeccable** (melhor encaixe, pode substituir a Taste skill). Decidir se instala, quando, e se testa Transitions.dev, Playwright CLI, Ponytail e Claude Design. Avaliação em `ANALISE-FERRAMENTAS.md`, seção 11.5. Nada foi instalado.
3. **no-ai-slop** (skill de texto, só em inglês): instalar como está, criar versão em português no projeto, ou não usar. Seção 11.1.
4. **Open Notebook:** o Claude avaliou que não serve como IA do sistema. Confirmar a conclusão. Seção 11.2.
5. **Direção iPhone e iPad:** aprovar, ajustar ou recusar as seis propostas técnicas em `DECISOES.md`, "Direção iPhone e iPad".
6. **Figma:** guardar os PNGs exportados dentro do Git (recomendado, cerca de 10 MB) ou só em casa; e se inclui a lista B (5 páginas por causa de iPhone e iPad).
7. **Concluir demanda:** manter o fundo azul claro (mais sutil) ou voltar ao azul cheio, já mais fino.
8. **Avaliar a rodada 3 e o Catalyst** (http://127.0.0.1:7200): dizer o que ainda destoa. Ver `DECISOES.md`, rodada 3.
9. **Padrões do Catalyst:** par de fontes, estilo de ícones e paleta padrão (hoje há padrões provisórios).
10. **Plano de blocos maiores e de modelos (Opus ou Sonnet, effort):** aprovar ou ajustar, `SINCRONIZA-PROJETINHO.md`, seção 7.

**Novas, de 23/10/2026**
13. **Ícones:** decidir a troca da biblioteca por uma família com contorno e cheio completos e proporção próxima à dos apps Apple (proposta a apresentar; nada foi adicionado).
14. **Ferramentas:** aprovar a configuração proposta (Impeccable, Taste reservada, Ponytail, Transitions.dev, Playwright CLI), um item por vez.
15. **Ícones restantes:** só os sete do menu estão em Ionicons. O usuário ainda precisa selecionar os símbolos dos demais (botões, busca, ações, formulários), depois removem-se Iconoir e Lucide.

**Ações**
11. **No Figma (navegador), exportar como PNG as páginas que faltam** (8 da lista A, mais as da lista B se aprovar), seguindo o passo a passo da seção 6 do `SINCRONIZA-PROJETINHO.md`. Salvar em `imagens\figma-kit\`.
12. Sem pressa: **banco de 500 frases** da mensagem do dia. (A energia já foi enviada em SVG.)

**Resolvido em 23/10/2026:** a pasta duplicada `Dmanda\Dmanda` foi revisada e excluída (conteúdo idêntico ao commit `d6e8406`, nada exclusivo).

## Limite do Figma

O MCP do Figma usa o plano gratuito (Starter): **20 chamadas de leitura por mês**, e escrever não conta. As 20 foram usadas em 21 e 22/10/2026. A documentação não informa quando renova: o Claude tenta de novo em novembro. Plano pago está fora das regras de custo. **Para não depender do limite, o plano é exportar as páginas que faltam como PNG (ação 11).** Páginas que faltam: Steppers, Progress Indicators, Popovers, Alerts, Empty States, Contextual Menus, Date and Time Pickers e Examples.

## Próximo passo do Claude

- **Blocos maiores** daqui em diante. No fim de cada bloco: percentual do projeto e sugestão de modelo e effort para o próximo (plano em `SINCRONIZA-PROJETINHO.md`, seção 7).
- Página de **peças com os cinco estados** (normal, foco, desativado, carregando, erro) para os três temas, e conferência de contraste (`inspect.mjs` da taste-skill e verificação por código).
- Depois, começar a **construção real** (ordem em `DECISOES.md`, seção 1): base técnica (banco, login Google, publicação na Vercel) e versão mínima de Demandas e Início, sobre os três temas.
- O código de `src/` ainda é o design antigo e será substituído (ver `CLAUDE.md`).

## Pontos em aberto técnicos (não dependem do usuário)

- Confirmar os limites atuais do plano gratuito do Postgres do Supabase (escolha do projeto) antes de configurar.
- Confirmar os limites da IA gratuita (Gemini ou Groq) na hora da etapa de IA.
- Rodar `trail init --dry-run` e instalar o Trail-code depois da versão mínima de Demandas.
- Quando o design system real estiver pronto, avaliar a remoção do plugin `ui-ux-pro-max` (instalado no ambiente do usuário a pedido).
- Acrescentar ao `.env.example` as variáveis do Google (login, Calendar e Drive) e da IA quando essas etapas começarem.
- `npm audit` mostrou avisos de dependências em 21/10/2026; reavaliar sem usar `--force` (o serviço de auditoria estava fora do ar em 22/10/2026).
- Opcional: apagar `imagens/aprovacao` (prints do design antigo, 2 MB, sem uso) e trocar a descrição do repositório no GitHub ("Sistema pessoal de demandas em quadros") por algo atual.

## Como continuar em outro computador

1. Baixar o projeto: `git clone https://github.com/edermoliveira/Dmanda.git` (ou `git pull`, se já existir).
2. Na pasta do projeto: `npm install` (só na primeira vez).
3. Ligar: `npm run dev` e abrir http://localhost:7100. Para o protótipo: `python -m http.server 7200` dentro de `prototipo`.
4. O `.env.local` não vai para o GitHub. Hoje o sistema ainda não precisa dele. Quando precisar, copiar o `.env.example` e preencher.
5. Plugins, skills e MCPs **não** vêm pelo Git (exceto as três skills do Superpowers em `.claude/skills/`). Instalar de novo no outro computador, se quiser: `taste-skill` (marketplace `Leonxlnx/taste-skill`), `ui-ux-pro-max` (marketplace `nextlevelbuilder/ui-ux-pro-max-skill`) e o plugin `context7`. O `.claude/settings.json` do projeto já marca o `ui-ux-pro-max` como ativo, mas ele só funciona depois de instalado.
6. A memória do Claude é local de cada computador: ela foi recriada aqui a partir destes documentos.

## Rodada 2 (22/10/2026)

- **Aprovar o protótipo atualizado** (http://127.0.0.1:7200).
- **Catalyst (Figma):** o Figma foi conectado em 22/10/2026 (MCP `figma`, escopo local deste projeto; o outro computador precisa repetir `claude mcp add --transport http figma https://mcp.figma.com/mcp` e autenticar em `/mcp`). O arquivo "iOS and iPadOS 27 (Community)" (chave `VOqem67sPifvvgYa0MwyKh`) abre sem erro. **Feito em 22/10/2026:** tema "d" (Catalyst, estilo Mac e iPad) criado em `prototipo/catalyst.css`, testado em claro, escuro e celular; Aurora, Papel e Grafite intactos. **Refinado no mesmo dia:** Liquid Glass (barras flutuantes, menus, folhas e Perfil), abas e seleção em cápsula que deslizam com mola, botões redondos, caixas de marcar do iOS, movimento de entrada e saída (`prototipo/catalyst.js`). Testado: todos os botões das 9 telas em claro, escuro e celular, contraste de todos os textos e estouro de layout. **Aguarda o usuário avaliar** (http://127.0.0.1:7200, botão "D Catalyst"; se algo parecer antigo, Ctrl+F5). Cuidado: `get_metadata` em páginas grandes do Figma (Buttons) devolve retornos enormes, pedir nós pequenos.
- **Ilustrações de energia:** enviadas em SVG (`energia-1.svg` a `energia-5.svg`) e integradas em 24/10/2026.

## Pendências do bloco de 24/10/2026

- **Avaliação visual** do Catalyst único, dos sete ícones, do Mostrar menu e dos botões de Demandas no iPad vertical.
- **Selecionar os símbolos Ionicons dos demais ícones**, a partir de `INVENTARIO-ICONES.md`. Só depois Iconoir e Lucide saem.
- **Energia:** os cinco SVGs foram integrados e conferidos (testes). Deixou de ser pendência, mas **aguarda a sua avaliação visual** junto com o resto da revisão de 24/10/2026.
- **Avaliação visual da revisão de 24/10/2026:** avatar do Perfil, Pomodoro, duas colunas no iPad vertical, siglas e abertura na Agenda, Quadro (largura, filtros, mover por arraste e menu), fundo (cor e imagem) e caixas de marcar.
- Decisões que tomei e que o usuário pode querer rever: breakpoint de 640 px para duas colunas; siglas PT, PO e PL; "MP" só com cadastro explícito (hoje não há campo para cadastrar); de Finalizado só se volta para Fazendo; véu de 50% sobre a imagem de fundo; cor de fundo guardada separadamente para claro e escuro.
- Limitações reais: o texto sobre uma imagem muito colorida pode ficar pouco legível (use o desfoque ou outra imagem); o limite de 15 MB e o armazenamento do navegador valem só neste navegador, sem cópia em outro computador.
- **Contraste do selo "Legal" no escuro: corrigido e verificado** (`testes/selo-legal.mjs`). Antes: Índigo 3,66:1 e Violeta 4,27:1. Agora o pior caso nas dez paletas é 5,84:1 na Tabela e na Lista escuras, 5,31:1 nas claras e 6,94:1 e 15,18:1 nos cards escuros e claros. A explicação de que a ordem dos botões levou o teste de cliques a essas paletas continua sendo só uma hipótese, sem evidência.
- **Avaliação visual do segundo bloco de 24/10/2026:** cards sem faixa lateral, Configurações em colunas, histórico do Perfil, cadastro e edição de demandas em grupos.
- **Rodapé do formulário no celular: compactado.** Arquivar e Excluir foram para um menu no cabeçalho (só nessa largura); o rodapé ficou numa linha (Cancelar, Concluir demanda, Salvar). Aguarda a sua avaliação visual.
- **Histórico do Perfil, datas demonstrativas:** as datas mostradas são de exemplo, calculadas a partir da referência do protótipo (21/10/2026); os valores são dados fictícios. A interface agora diz isso. **Requisito da implementação funcional:** cada registro de Humor e Energia deve ter a sua própria data, preservada ao editar e usada na apresentação do histórico; nada de datar por posição.
- **Comparação visual de 78 telas (a das 6.682 diferenças):** foi feita uma vez, nesta sessão, contra uma referência de `dd3bf3c`. As diferenças foram agrupadas por tipo e conferidas por mim: todas correspondem a mudanças autorizadas daquele bloco (fundo, energia em SVG, Agenda, painel Fundo, avatar, cards em duas colunas, Quadro de 300 px, caixas de marcar, Pomodoro); não achei regressão. Limitações: o resultado só está no relatório da época (não havia registro em arquivo, agora está aqui); a conferência por agrupamento não é exaustiva elemento a elemento; e ficou superada pelo segundo bloco (faixa, Configurações, histórico, formulário), que mudou as mesmas telas de propósito. **A pendência permanece aberta como limitação** (os resultados dela não foram aprovados retroativamente). A referência nova foi gravada em 24/10/2026 depois da aprovação visual do commit `cd7b03f` (`prototipo/testes/referencias/`) e passa a orientar as comparações futuras. Ela cobre 3 aparelhos (não cobre iPad horizontal, Janela média, janelas abertas nem fundos personalizados); ampliar a cobertura é uma decisão futura.
- **Teclado virtual em aparelho real:** o rodapé do formulário no celular ainda não foi testado com o teclado virtual de um aparelho de verdade (só em emulação).
- **Seleção dos demais ícones Ionicons:** continua pendente da sua escolha (inventário em `INVENTARIO-ICONES.md`).
- **Design do protótipo aprovado em 24/10/2026 (commit `cd7b03f`).** Continuam abertas: teclado virtual em aparelho real, data própria por registro na implementação funcional e seleção dos demais ícones (aguarda a escolha do usuário).
- **Ícones:** feitos Cards, Tabela e Lista (aguardam sua avaliação visual). Quadro pendente (nenhum ícone do Ionicons comunica colunas ou Kanban; decisão sua). Demais grupos do `INVENTARIO-ICONES.md` aguardam escolha.
- **Ícones:** Cards, Tabela e Lista aprovados em `dd1b340`. Quadro mantém `columns` como exceção provisória (migração pendente, sem bloquear os outros grupos). Próximo grupo em escolha: busca, filtros e ordenação.
- **Ícones de busca, filtros, ordenação e expansão** implementados em 25/10/2026, aguardam a sua avaliação visual. Demais grupos do `INVENTARIO-ICONES.md` (ações, prazo e tempo, tipos de evento, topo e menu, conteúdo, IA e Perfil) aguardam escolha; Quadro segue provisório.
