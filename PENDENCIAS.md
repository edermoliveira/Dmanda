# Pendências do Dmanda

Arquivo lido no início de cada sessão. Fica no repositório para valer em qualquer computador.

## Aguardando o usuário

Nada abaixo foi decidido pelo Claude. O detalhe de cada item está em `SINCRONIZA-PROJETINHO.md`, seção 3.

**Decisões**
1. **GitHub Issues:** aprovar (ou ajustar) a proposta de etiquetas, marcos e uso nos commits, e dizer "pode criar". Nada foi criado ainda.
2. **no-ai-slop** (skill de texto, só em inglês): instalar como está, criar versão em português no projeto, ou não usar. Avaliação em `ANALISE-FERRAMENTAS.md`, seção 11.1.
3. **Open Notebook:** o Claude avaliou que não serve como IA do sistema (aplicativo com Docker e servidor, sem senha por padrão, feito para pesquisar documentos). Confirmar a conclusão. Seção 11.2.
4. **Concluir demanda:** manter o fundo azul claro (mais sutil) ou voltar ao azul cheio, já mais fino.
5. **Avaliar a rodada 3 e o Catalyst** (http://127.0.0.1:7200): dizer o que ainda destoa. Ver `DECISOES.md`, rodada 3.
6. **Escolher os padrões de cada tema:** par de fontes, estilo de ícones e paleta padrão de Aurora, Papel e Grafite (hoje há padrões provisórios).
7. **Figma:** esperar o limite renovar ou exportar como PNG as 8 páginas que faltam do kit (ver abaixo).
8. **Plano de blocos maiores e de modelos (Opus ou Sonnet, effort):** aprovar ou ajustar, `SINCRONIZA-PROJETINHO.md`, seção 6.

**Ações**
9. **No computador de casa, apagar `Desktop\Dmanda\Dmanda`** (cópia limpa do repositório dentro do projeto, sem nada novo), se concordar.
10. Sem pressa: **banco de 500 frases** da mensagem do dia e, opcional, `energia-1.png` a `energia-5.png` em `prototipo/emojis/`.

## Limite do Figma

O MCP do Figma usa o plano gratuito (Starter): **20 chamadas de leitura por mês**, e escrever não conta. As 20 foram usadas em 21 e 22/10/2026 (lidas: Widgets, Botões e Campos de texto do kit; faltam Steppers, Progress Indicators, Popovers, Alerts, Empty States, Contextual Menus, Date and Time Pickers e Examples). A documentação não informa quando renova: o Claude tenta de novo em novembro. Plano pago está fora das regras de custo.

## Próximo passo do Claude

- **Blocos maiores** daqui em diante. No fim de cada bloco: percentual do projeto e sugestão de modelo e effort para o próximo (plano em `SINCRONIZA-PROJETINHO.md`, seção 6).
- Página de **peças com os cinco estados** (normal, foco, desativado, carregando, erro) para os três temas, e conferência de contraste (`inspect.mjs` da taste-skill e verificação por código).
- Depois, começar a **construção real** (ordem em `DECISOES.md`, seção 1): base técnica (banco, login Google, publicação na Vercel) e versão mínima de Demandas e Início, sobre os três temas.
- O código de `src/` ainda é o design antigo e será substituído (ver `CLAUDE.md`).

## Pontos em aberto técnicos (não dependem do usuário)

- Confirmar os limites atuais do plano gratuito do Postgres (Neon ou Supabase) e escolher um.
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
- **Ilustrações de energia:** salvar em `prototipo/emojis/` como `energia-1.png` a `energia-5.png` (quadrados, fundo transparente, 128 a 512 px).
