@AGENTS.md

# Dmanda

Painel pessoal do Secretário de Administração da Prefeitura de Taquara/RS, com sete áreas: Início, Entradas, Demandas, Agenda, Documentos, IA e Configurações (mais Arquivo, Perfil, busca global e botão "+"). O objetivo é não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. Há um único usuário, o admin, que é o próprio Secretário. Não existe equipe, convite nem comentário. Existe um Perfil pessoal e privado (humor, energia e produtividade).

Desenvolvido no computador e publicado na Vercel (com login Google) a partir da versão mínima de Demandas. Funciona no celular, iPad e computador (computador primeiro), instalável como PWA. O app nativo da App Store é uma etapa futura.

**Em 21/10/2026 o escopo foi ampliado e o design system está sendo refeito do zero.** Em 22/10/2026 os temas Aurora, Papel e Grafite foram definidos (protótipo em `prototipo/`). A fonte mais recente das decisões é `DECISOES.md`.

## Como rodar

```
npm install      (só na primeira vez)
npm run dev
```

Endereço: http://localhost:7100 (a porta 7100 está fixada no package.json).

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

**Três temas definitivos** (decidido em 22/10/2026): **Aurora** (vidro estilo Apple), **Papel** (calmo, tom de papel) e **Grafite** (denso, bordas finas), mais o **Catalyst** (estilo Apple Mac e iPad, a partir do kit oficial do Figma, adicionado em 22/10/2026 como quarto tema experimental no protótipo, `prototipo/catalyst.css`), cada um com modo claro e escuro. O logo da Aurora vale para todos. Dentro de cada tema o usuário escolhe cores (10 paletas), ícones, tamanhos e fontes, e cada tema guarda as suas escolhas.

O protótipo navegável está em `prototipo/` (HTML, CSS e JS puros, dados fictícios, isolado do `src/`). Abrir por um servidor local, por exemplo `python -m http.server 7200` dentro da pasta `prototipo`, e acessar http://127.0.0.1:7200. Hashes úteis na URL: `#dir=a|b|c&tema=claro|escuro&tela=demandas&vis=quadro&dev=phone&balao=nao`.

- **Vidro líquido** em quase todo o desenho (barras, menu, painéis, indicadores, botões, abas). Cards de demanda mais sólidos. **Caixas de preenchimento (janelas, busca, balões) quase opacas**: brancas no claro e escuras no escuro, com campos de alto contraste.
- **Fontes em três papéis:** principal para títulos, secundária para subtítulos e textos, mono para detalhes pontuais (números de processo, datas, contadores).
- **Ícones:** Iconoir (padrão, MIT) ou Lucide, em pastilha, fino ou duotone, sempre por uma única função ou componente de ícone. Nada de emoji nos controles. Os emojis de humor são os PNGs do usuário em `prototipo/emojis/` (ver o `LEIA-ME.md` da pasta).
- **Regras mantidas:** nenhuma cor solta no código (valores só nos arquivos de tokens), espaços e cantos por nome, alvo de toque de 44 px, funcionar nos dois modos, cinco estados por peça (normal, foco, desativado, carregando, erro), vermelho só para atrasado ou crítico.
- **Exceções à regra do travessão:** o traço "—" aparece na interface como símbolo de "sem progresso" (decisão do usuário), e valem fora da regra o `AGENTS.md` (gerado pelo Next.js) e as skills de terceiros copiadas em `.claude/skills/`.

### Design antigo (código atual em `src/`)

O que está em `src/` ainda é o design de 20/10/2026 (verde-água, Averia Serif Livre, Lucide, peças Botao, Campo, Janela, Menu, Avatar e Etiqueta, páginas /pecas, /tokens e /marca). Compila, passa no lint e na checagem de cores, e será **substituído** quando a construção real começar, sobre os três temas. Até lá, vale para ele:

- Tokens em `src/app/globals.css` (único lugar com valores de cor), vistos em http://localhost:7100/tokens. Conferir com `npm run verificar:cores`.
- Usar sempre o nome (`bg-superficie`, `text-texto`, `bg-destaque`, `text-perigo`), cantos `rounded-card`, `rounded-medio`, `rounded-pilula` e espaços da escala nomeada (`p-grande`, `gap-normal`).
- Peças em `src/components`, vistas em http://localhost:7100/pecas. Ícones pelo componente `Icone` (20 px).
- Logo: `npm run gerar:logo` (não editar `public/marca`, `src/app/icon.svg` e `src/components/logo-dados.ts` à mão). Prints das páginas: `npm run capturar` (precisa do sistema ligado).

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
