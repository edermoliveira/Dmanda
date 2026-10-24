@AGENTS.md

# Dmanda

Painel pessoal do Secretário de Administração da Prefeitura de Taquara/RS, com sete áreas: Início, Entradas, Demandas, Agenda, Documentos, IA e Configurações (mais Arquivo, Perfil, busca global e botão "+"). O objetivo é não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. Há um único usuário, o admin, que é o próprio Secretário. Não existe equipe, convite nem comentário. Existe um Perfil pessoal e privado (humor, energia e produtividade).

Desenvolvido no computador e publicado na Vercel (com login Google) a partir da versão mínima de Demandas. Funciona no celular, iPad e computador (computador primeiro), instalável como PWA. O app nativo da App Store é uma etapa futura.

**Em 21/10/2026 o escopo foi ampliado e o design system está sendo refeito do zero.** Em 23/10/2026 o **Catalyst** passou a ser a única direção visual (claro e escuro); Aurora, Papel e Grafite foram retiradas (protótipo em `prototipo/`). A fonte mais recente das decisões é `DECISOES.md`.

## Como rodar

```
npm install      (só na primeira vez)
npm run dev
```

Endereço: http://localhost:7100 (a porta 7100 está fixada no package.json).

Testes do protótipo (dentro de `prototipo`, usam o Edge instalado, sem servidor à parte):

```
node testes/fluxos.mjs                          (fluxos principais, cerca de 1 minuto)
node testes/clicar-tudo.mjs d claro desktop     (cliques, contraste e layout de um tema, cerca de 5 minutos)
node testes/clicar-tudo.mjs                     (Catalyst, claro e escuro, computador e celular)
node testes/menu.mjs                            (Mostrar menu: mostrar, navegar, voltar, recolher, recarregar)
node testes/consolidacao.mjs                    (Catalyst único, endereços antigos, sete ícones de navegação, erros de recursos)
node testes/preservar-catalyst.mjs comparar <referência.json>  (78 telas contra uma referência gravada com `gravar`)
node verificar-cores.mjs                        (nenhum branco ou preto absoluto)
```

Variáveis de ambiente: copiar `.env.example` para `.env.local` e preencher. O `.env.local` nunca vai para o Git.

## Documentos do projeto

- DECISOES.md: **fonte mais recente.** Respostas do usuário ao questionário. Se algo divergir, vale este arquivo.
- PESQUISA.md: as dores do usuário.
- REFERENCIAS.md: prints de referência (todos de uma só ferramenta). Valem para a organização das informações, não para o visual.
- PRODUTO.md: o que o sistema tem (sete áreas) e os cuidados gerais.
- FUNCIONALIDADES.md: mapa por tela, jornada de uma demanda e etapas de construção. Seguir a ordem das etapas.
- ANALISE-FERRAMENTAS.md: avaliação de skills, plugins, MCPs e sites de componentes (o que entra e o que sai).
- QUESTIONARIO.md: perguntas de alinhamento (já respondidas, ver DECISOES.md).
- ANDAMENTO.md: cálculo do percentual de andamento.
- PENDENCIAS.md: o que aguarda o usuário.

## Regras

- Todos os textos em português do Brasil: interface, mensagens, commits, documentos e comentários.
- Sem travessão (nem "—" nem "–") em nenhum texto. Usar vírgula, ponto, dois-pontos ou parênteses.
- Fazer um commit a cada avanço, com mensagem em português.
- Nunca colocar senha, chave, token ou dado real em arquivo que vá para o Git. Valores reais ficam só no `.env.local`.
- Cadastro rápido com poucos campos (número, prazo, assunto, origem). Poucas cores por tela, cor forte só para atrasado ou crítico. Exceções combinadas: post-its pastel em Entradas e cores de demanda (amarelo) e evento (azul) na Agenda.
- O que o usuário digita é guardado automaticamente.
- Não pagar nada além das assinaturas Claude Pro e ChatGPT Plus. Sem instaladores que peçam administrador (o computador não dá essa permissão). Ficam para o app nativo e foram aprovados para depois: conta Apple Developer, IA paga e Mobbin Pro.
- Nunca usar mensagem de cobrança, culpa ou alerta negativo dirigido ao usuário (vale principalmente em humor, energia e produtividade).
- Decisões que dependem do usuário são perguntadas no chat (uma rodada curta por vez) e gravadas em `DECISOES.md`.
- Instalar skills, plugins e MCPs só na hora em que forem usados, depois de ler o que eles escrevem. Avaliação em `ANALISE-FERRAMENTAS.md`.

## Design system

**Uma só direção, o Catalyst** (decidido em 23/10/2026): estilo Apple Mac e iPad, a partir do kit oficial do Figma (`prototipo/catalyst.css`), com modo claro e escuro. Aurora, Papel e Grafite foram retiradas. O identificador interno continua `d` (`data-dir="d"`). Endereços e preferências antigas (`dir=a|b|c`) abrem o Catalyst. O usuário escolhe cores (10 paletas), ícones, tamanhos e fontes.

O protótipo navegável está em `prototipo/` (HTML, CSS e JS puros, dados fictícios, isolado do `src/`). Abrir por um servidor local, por exemplo `python -m http.server 7200` dentro da pasta `prototipo`, e acessar http://127.0.0.1:7200. Hashes úteis na URL: `#tema=claro|escuro&tela=demandas&vis=quadro&dev=phone&balao=nao` (o app só lê o hash ao carregar: depois de mudar o endereço, recarregar).

- **iPhone e iPad (decidido em 23/10/2026):** o mobile é pensado para o iPhone como PWA, mas **construído como app nativo**. O iPad segue a mesma regra e, no futuro, terá Entradas com Apple Pencil. Propostas técnicas aguardando aprovação em `DECISOES.md`.
- **Vidro líquido** em quase todo o desenho (barras, menu, painéis, indicadores, botões, abas). Cards de demanda mais sólidos. **Caixas de preenchimento (janelas, busca, balões) quase opacas**: brancas no claro e escuras no escuro, com campos de alto contraste.
- **Fontes em três papéis:** principal para títulos, secundária para subtítulos e textos, mono para detalhes pontuais (números de processo, datas, contadores) e, por exceção, a descrição resumida dos cards de demanda.
- **Ícones:** a família escolhida é a **Ionicons outline** (MIT, 8.0.13). **Já implementados: só os sete do menu de navegação** (`prototipo/icones-nav/`, originais em `imagens/figma-kit/icones/`). Os demais ícones continuam com Iconoir e Lucide **até o usuário selecionar os símbolos**; não escolher substitutos por conta própria. Sempre por uma única função de ícone. Nada de emoji nos controles. Os emojis de humor são os PNGs do usuário em `prototipo/emojis/` (ver o `LEIA-ME.md` da pasta).
- **Regras mantidas:** nenhuma cor solta no código (valores só nos arquivos de tokens), espaços e cantos por nome, alvo de toque de 44 px, funcionar nos dois modos, cinco estados por peça (normal, foco, desativado, carregando, erro), vermelho só para atrasado ou crítico.
- **Exceções à regra do travessão:** o traço "—" aparece na interface como símbolo de "sem progresso" (decisão do usuário), e valem fora da regra o `AGENTS.md` (gerado pelo Next.js) e as skills de terceiros copiadas em `.claude/skills/`.

### Design antigo (código atual em `src/`)

O que está em `src/` ainda é o design de 20/10/2026 (verde-água, Averia Serif Livre, Lucide, peças Botao, Campo, Janela, Menu, Avatar e Etiqueta, páginas /pecas, /tokens e /marca). Compila, passa no lint e na checagem de cores, e será **substituído** quando a construção real começar, sobre os três temas. Até lá, vale para ele:

- Tokens em `src/app/globals.css` (único lugar com valores de cor), vistos em http://localhost:7100/tokens. Conferir com `npm run verificar:cores`.
- Usar sempre o nome (`bg-superficie`, `text-texto`, `bg-destaque`, `text-perigo`), cantos `rounded-card`, `rounded-medio`, `rounded-pilula` e espaços da escala nomeada (`p-grande`, `gap-normal`).
- Peças em `src/components`, vistas em http://localhost:7100/pecas. Ícones pelo componente `Icone` (20 px).
- Logo: `npm run gerar:logo` (não editar `public/marca`, `src/app/icon.svg` e `src/components/logo-dados.ts` à mão). Prints das páginas: `npm run capturar` (precisa do sistema ligado).

## Ferramentas (decidido em 23/10/2026)

São regras de trabalho, não travas técnicas: os plugins instalados no escopo do usuário continuam disponíveis em qualquer sessão, então a disciplina é nossa.

- **Impeccable** (instalada no projeto, versão 4.7.0, sem hooks, telemetria desligada em `.impeccable/config.json`): UX, responsividade, acessibilidade e acabamento. Serve para avaliar e refinar a direção já aprovada, nunca para gerar novas direções. `bolder` e `overdrive` ficam fora. As sugestões dela não substituem as decisões do usuário.
- **Taste:** só para exploração artística pedida expressamente.
- **ui-ux-pro-max:** uso excepcional, quando acrescentar algo que a Impeccable não cobre.
- **Ponytail:** adiada para o Bloco C. **Vercel React Best Practices:** só na implementação real em React/Next.js.
- **Transitions.dev:** só os recursos gratuitos, para microinterações concretas.
- **Playwright:** manter os testes atuais com `playwright-core` e o Edge. Sem CLI nem troca da infraestrutura por ora.
- **Context7:** consultar quando precisar de documentação externa.
- **code-review e code-simplifier:** conforme a necessidade, nunca os dois automaticamente sobre o mesmo diff.
- **Supabase** é o banco do projeto, mas nada de MCP, banco ou backend até a decisão de iniciar. A IA operacional é etapa futura (Open Notebook não serve).
- Sem hooks automáticos de auditoria e sem pacotes de memória. Superpowers completo não será instalado (só as três skills copiadas em `.claude/skills/`).

## Pendências

Ler `PENDENCIAS.md` no início de cada sessão. Ali está o que aguarda aprovação do usuário.

## Andamento do projeto

**Terminar toda resposta neste projeto com a linha: "Andamento do projeto: X%".** O cálculo e a data da última revisão ficam em `ANDAMENTO.md`. Reavaliar o percentual a cada avanço real (commit de funcionalidade, aprovação ou mudança de escopo) e atualizar o arquivo.

## Regras aprendidas com as correções

Sempre que o usuário corrigir algo, acrescentar aqui a regra nova, em uma linha, logo após a correção.

- Quando o usuário tiver que fazer algo fora do Claude Code (comando no PowerShell, ação no site do GitHub, outro programa), avisar sempre e destacar em negrito, dizendo onde fazer e o que fazer.
- Nunca fazer `git push` (nem outro envio ao GitHub) sem autorização do usuário. O usuário quer conferir antes. Pedir autorização a cada rodada, a menos que ele a conceda de forma geral.
- Janelas e caixas de preenchimento (cadastro, busca, balões) devem ser quase opacas: claras no modo claro e escuras no modo escuro. Vidro transparente demais deixa o campo pouco visível.
- Telas novas precisam ser testadas no navegador de verdade (clicar nos botões, trocar tema e largura), não só conferidas em captura de imagem. Ao testar o protótipo, servir por http (o Playwright bloqueia `file://`).
- Ao instalar plugins, skills ou MCPs a pedido do usuário, avisar o que ficou instalado e onde (usuário ou projeto), e que o outro computador precisa repetir a instalação.
- Cards e post-its nunca têm barra de rolagem: se não couber, mostrar só o título e deixar o título preencher o espaço até onde couber.
- Texto digitado nunca se perde: clicar fora de uma janela com texto não fecha, Esc e X guardam rascunho, só Cancelar descarta.
- Tom dos textos: simpático e direto, sem bajulação, com tom de alerta quando necessário.
- Botões no estilo Apple: chatos, levemente arredondados, sem borda nem relevo. Sem prazo, nada é mostrado (nem "Chegou há N d").
- Botões numa escala única e harmônica (40 px padrão, 32 px mini, 44 px só nas barras), área de toque sempre de 44 px. Nada de tamanho solto.
- Toda informação incluída pelo usuário (tarefa, nota, evento, demanda, perfil) precisa ser alterável de forma fácil, de preferência no próprio lugar.
- Nenhuma decisão é tomada pelo Claude sem o conhecimento e a autorização prévios do usuário: dúvida vira pergunta no chat e a resposta é gravada em `DECISOES.md`.
- Trabalhar em blocos maiores (início, fim e entrega testada). No fim de cada bloco, informar o percentual do projeto, o que ficou pendente do usuário e **sugerir o modelo (Opus ou Sonnet) e o effort do próximo bloco**. É sempre sugestão: quem troca é o usuário. Plano em `SINCRONIZA-PROJETINHO.md`, seção 7.
- Ao encerrar uma sessão, atualizar `SINCRONIZA-PROJETINHO.md` (estado, histórico, pendências e prompt de retomada), fazer o commit e, só com autorização, o push.
- Antes de excluir qualquer pasta ou arquivo, olhar o alvo e conferir que nada exclusivo se perde (por exemplo, comparar o hash da árvore do Git). Excluir só com pedido ou autorização do usuário.
- A cada etapa, rodar o teste de cliques (`node testes/clicar-tudo.mjs` em `prototipo`) e corrigir o que ele achar antes de dizer que está pronto.
