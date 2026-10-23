# Pendências do Dmanda

Arquivo lido no início de cada sessão. Fica no repositório para valer em qualquer computador.

## Aguardando o usuário

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
9. **Escolher os padrões de cada tema:** par de fontes, estilo de ícones e paleta padrão de Aurora, Papel e Grafite (hoje há padrões provisórios).
10. **Plano de blocos maiores e de modelos (Opus ou Sonnet, effort):** aprovar ou ajustar, `SINCRONIZA-PROJETINHO.md`, seção 7.

**Novas, de 23/10/2026**
13. **Ícones:** decidir a troca da biblioteca por uma família com contorno e cheio completos e proporção próxima à dos apps Apple (proposta a apresentar; nada foi adicionado).
14. **Ferramentas:** aprovar a configuração proposta (Impeccable, Taste reservada, Ponytail, Transitions.dev, Playwright CLI), um item por vez.
15. **Teste de cliques completo** (`node testes/clicar-tudo.mjs`): foi interrompido por falta de memória do computador. Feitos: Aurora claro e escuro no computador. Faltam Papel, Grafite e Catalyst no computador e o celular (Aurora e Catalyst). Rodar com poucos programas abertos.

**Ações**
11. **No Figma (navegador), exportar como PNG as páginas que faltam** (8 da lista A, mais as da lista B se aprovar), seguindo o passo a passo da seção 6 do `SINCRONIZA-PROJETINHO.md`. Salvar em `imagens\figma-kit\`.
12. Sem pressa: **banco de 500 frases** da mensagem do dia e, opcional, `energia-1.png` a `energia-5.png` em `prototipo/emojis/`.

**Resolvido em 23/10/2026:** a pasta duplicada `Dmanda\Dmanda` foi revisada e excluída (conteúdo idêntico ao commit `d6e8406`, nada exclusivo).

## Limite do Figma

O MCP do Figma usa o plano gratuito (Starter): **20 chamadas de leitura por mês**, e escrever não conta. As 20 foram usadas em 21 e 22/10/2026. A documentação não informa quando renova: o Claude tenta de novo em novembro. Plano pago está fora das regras de custo. **Para não depender do limite, o plano é exportar as páginas que faltam como PNG (ação 11).** Páginas que faltam: Steppers, Progress Indicators, Popovers, Alerts, Empty States, Contextual Menus, Date and Time Pickers e Examples.

## Próximo passo do Claude

- **Blocos maiores** daqui em diante. No fim de cada bloco: percentual do projeto e sugestão de modelo e effort para o próximo (plano em `SINCRONIZA-PROJETINHO.md`, seção 7).
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
