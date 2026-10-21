@AGENTS.md

# Dmanda

Painel pessoal do Secretário de Administração da Prefeitura de Taquara/RS, com sete áreas: Início, Entradas, Demandas, Agenda, Documentos, IA e Configurações (mais Arquivo, Perfil, busca global e botão "+"). O objetivo é não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. Há um único usuário, o admin, que é o próprio Secretário. Não existe equipe, convite nem comentário. Existe um Perfil pessoal e privado (humor, energia e produtividade).

Desenvolvido no computador e publicado na Vercel (com login Google) a partir da versão mínima de Demandas. Funciona no celular, iPad e computador (computador primeiro), instalável como PWA. O app nativo da App Store é uma etapa futura.

**Em 21/10/2026 o escopo foi ampliado e o design system será refeito do zero.** A fonte mais recente das decisões é `DECISOES.md`.

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

**Será refeito do zero** (decidido em 21/10/2026). Novo estilo: Apple com vidro (barras, menu, botão flutuante, janelas e campos; cards de demanda mais sólidos), 10 paletas com claro e escuro, 5 pares de fontes e tamanhos ajustáveis em tempo real. O protótipo terá 3 direções para o usuário escolher. Até lá, o que está abaixo descreve o design **atual** e continua valendo para o código existente. As regras que seguem valendo no novo: nenhuma cor solta no código, espaços e cantos por nome, alvo de toque de 44 px, funcionar nos dois temas, cinco estados por peça, vermelho só para atrasado ou crítico.

Fica em `src/app/globals.css` e pode ser visto em http://localhost:7100/tokens (com botão para trocar entre tema claro e escuro). Foi criado a partir dos prints da pasta `imagens/prints`.

- Cores por função, cada uma com versão clara e escura: fundo, superficie, texto, destaque (verde-água #19C9A9) e perigo. Derivadas: borda, texto-suave, destaque-forte, sobre-destaque, perigo-suave, sobre-perigo, brilho-a e brilho-b.
- **Nenhuma cor solta no código.** Usar sempre o nome (`bg-superficie`, `text-texto`, `bg-destaque`, `text-perigo`). Valores de cor só existem no globals.css. Conferir com `npm run verificar:cores`.
- Fontes: Averia Serif Livre para títulos (negrito), subtítulos e textos; IBM Plex Mono Regular (`font-mono`) só para detalhes, como números de processo e datas.
- Cantos: cards com 24 px (`rounded-card`), campos `rounded-medio`, botões e etiquetas `rounded-pilula`.
- Espaços: usar a escala nomeada (mini 4, pequeno 8, medio 12, normal 16, grande 24, enorme 32, gigante 48, maximo 64), como `p-grande` e `gap-normal`.
- Vermelho (`perigo`) só para atrasado ou crítico.
- Todo componente novo deve funcionar nos dois temas.

## Peças e marca

- Peças em `src/components`: Botao, Campo, Janela, Menu, Avatar e Etiqueta. Ver todas em http://localhost:7100/pecas. Usar sempre essas peças, sem refazer botão ou campo na mão.
- Toda peça tem cinco estados: normal, foco, desativado, carregando e erro. Peça nova só entra com os cinco, e é mostrada em /pecas.
- Ícones: só Lucide, sempre pelo componente `Icone` (20 px, token `size-icone`). Nada de emoji nem outra biblioteca.
- Alvo de toque mínimo de 44 px (`min-h-toque`). Erro aparece junto do campo. Carregando usa `aria-busy`.
- Logo: um D com três colunas. Gerado por `npm run gerar:logo` (lê as cores do globals.css e escreve `public/marca`, `src/app/icon.svg` e `src/components/logo-dados.ts`). Não editar esses arquivos à mão. Uso e arquivos em /marca.
- Prints das páginas: `npm run capturar` (precisa do sistema ligado) salva em `imagens/aprovacao`.

## Pendências

Ler `PENDENCIAS.md` no início de cada sessão. Ali está o que aguarda aprovação do usuário.

## Andamento do projeto

**Terminar toda resposta neste projeto com a linha: "Andamento do projeto: X%".** O cálculo e a data da última revisão ficam em `ANDAMENTO.md`. Reavaliar o percentual a cada avanço real (commit de funcionalidade, aprovação ou mudança de escopo) e atualizar o arquivo.

## Regras aprendidas com as correções

Sempre que o usuário corrigir algo, acrescentar aqui a regra nova, em uma linha, logo após a correção.

- Quando o usuário tiver que fazer algo fora do Claude Code (comando no PowerShell, ação no site do GitHub, outro programa), avisar sempre e destacar em negrito, dizendo onde fazer e o que fazer.
