@AGENTS.md

# Dmanda

Painel pessoal do Secretário de Administração da Prefeitura de Taquara/RS, com sete áreas: Início, Entradas, Demandas, Agenda, Documentos, IA e Configurações (mais Arquivo, Perfil, busca global e botão "+"). O objetivo é não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. Há um único usuário, o admin, que é o próprio Secretário. Não existe equipe, convite nem comentário. Existe um Perfil pessoal e privado (humor, energia e produtividade).

Desenvolvido no computador e publicado na Vercel (com login Google restrito à conta do Secretário). Funciona no celular, iPad e computador (computador primeiro), instalável como PWA. O app nativo da App Store é uma etapa futura.

## Estado atual (25/10/2026)

- **Design:** Catalyst único, claro e escuro. O protótipo (`prototipo/`, HTML, CSS e JS puros, dados fictícios) está aprovado visualmente desde o commit `cd7b03f` e é a referência. Aurora, Papel e Grafite foram retiradas. A fonte mais recente das decisões é `DECISOES.md`.
- **Aplicação funcional** (Next.js 16, React 19, Supabase) em `src/`: núcleo de Demandas e tarefas pronto e testado no banco local de teste. Rotina diária na nuvem preparada. As demais áreas aparecem como "Em construção".
- **Ainda não validado:** Supabase real, login Google, persistência real, publicação na Vercel e primeira execução automática da rotina. Sem isso, não declarar integração remota concluída.
- **Ícones:** escolhidos e implementados (Ionicons outline 8.0.13): os sete do menu, Cards, Tabela, Lista, busca, filtros, ordenação e expansão. Os restantes ficam para uma revisão consolidada e não bloqueiam funcionalidades. O Quadro mantém `columns` como exceção provisória.
- Retomada detalhada: seção "Retomada rápida" no topo de `SINCRONIZA-PROJETINHO.md`. Pendências do usuário: `PENDENCIAS.md`.

## Como rodar

| Comando | O que faz | Banco |
|---|---|---|
| `npm run dev` | aplicação em http://localhost:7100 | **Supabase real** (exige `.env.local`; sem ele o proxy responde 503) |
| `npm run dev:teste` | aplicação em http://localhost:7100 | **banco local descartável** (PGlite em `.dados-teste/`, `DMANDA_BANCO=teste`, só em desenvolvimento, recusado em produção) |
| `npm run build` e `npm run start` | produção local na 7100 | Supabase real |
| `cd prototipo` e `python -m http.server 7200 --bind 127.0.0.1` | protótipo de referência em http://127.0.0.1:7200 | nenhum (dados fictícios) |

Portas: 7100 aplicação (fixa no `package.json`), 7200 protótipo, 7103 usada pelo `testar:app` (sobe o próprio servidor). Só pode haver **um `next dev` por vez** neste projeto (a pasta `.next` tem trava): encerrar o da 7100 antes de rodar `testar:app`. O banco de teste tem pastas por finalidade em `.dados-teste/` (`pg` do `dev:teste`, `e2e` e `visual` dos testes e das conferências); são descartáveis, mas só apagar com autorização. As migrações novas são aplicadas sozinhas a um banco de teste que já existe.

Variáveis: copiar `.env.example` para `.env.local` e preencher (nunca vai para o Git; o assistente não lê arquivos `.env*`). Lista e passos do Supabase e da Vercel em `supabase/LEIA-ME.md`.

Testes da aplicação real (rodar só os dos componentes afetados):

- `npm run testar:banco`: SQL, RLS, rotina diária e privilégios no PGlite (68 verificações).
- `npm run testar:regras`: datas, grupos do Início, sessão de 6 h, e-mail autorizado, segredo e falha da rotina (19).
- `npm run testar:app`: navegador (Edge) e leitura direta do banco de teste: fluxos de demandas, tarefas, quatro visões, celular, iPad, claro e escuro, cápsula, rotina diária (57).
- Também: `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build`.
- Testes do protótipo: ver `prototipo/CLAUDE.md`.

Estes testes validam a lógica e a interface no banco de **teste**. Não substituem a validação no Supabase real.

## Documentos do projeto

- DECISOES.md: **fonte mais recente.** Se algo divergir, vale este arquivo.
- PENDENCIAS.md: o que aguarda o usuário. SINCRONIZA-PROJETINHO.md: retomada e histórico das sessões.
- PRODUTO.md (o que o sistema tem), FUNCIONALIDADES.md (mapa por tela e etapas de construção), ANDAMENTO.md (cálculo do percentual).
- PESQUISA.md (dores do usuário), REFERENCIAS.md (organização das informações, não o visual), QUESTIONARIO.md (já respondido), ANALISE-FERRAMENTAS.md, INVENTARIO-ICONES.md.
- supabase/LEIA-ME.md: Supabase, Vercel, rotina diária e proteção dos dados reais.

## Regras

- Todos os textos em português do Brasil: interface, mensagens, commits, documentos e comentários.
- Sem travessão (nem "—" nem "–") em nenhum texto. Usar vírgula, ponto, dois-pontos ou parênteses.
- Um commit a cada avanço, com mensagem em português.
- Nunca colocar senha, chave, token ou dado real em arquivo que vá para o Git. Valores reais ficam só no `.env.local` e nas variáveis da Vercel. Chave de serviço do Supabase só no servidor, nunca em `NEXT_PUBLIC`.
- Dados fictícios do protótipo nunca entram no banco real.
- Cadastro rápido com poucos campos (número, prazo, assunto, origem). Poucas cores por tela, cor forte só para atrasado ou crítico. Exceções combinadas: post-its pastel em Entradas e cores de demanda (amarelo) e evento (azul) na Agenda.
- O que o usuário digita é guardado automaticamente. Falha de gravação nunca mostra sucesso.
- Prazos: as datas originais são a fonte de verdade; dias restantes são sempre derivados delas (America/Sao_Paulo), nunca de um contador que decai.
- Custo: nada além das assinaturas Claude Pro e ChatGPT Plus. Contratar plano pago (por exemplo Vercel Pro) só por decisão do usuário. Sem instaladores que peçam administrador. Ficam para o app nativo e foram aprovados para depois: conta Apple Developer, IA paga e Mobbin Pro.
- Nunca usar mensagem de cobrança, culpa ou alerta negativo dirigido ao usuário (vale principalmente em humor, energia e produtividade).

## Design system

**Uma só direção, o Catalyst:** estilo Apple Mac e iPad, a partir do kit oficial do Figma (`prototipo/catalyst.css`), com modo claro e escuro. O identificador interno continua `d` (`data-dir="d"`). O usuário escolhe cores (10 paletas), ícones, tamanhos e fontes. A aplicação em `src/` reaproveita os CSS do protótipo (`src/estilos/`) com as mesmas classes e marcação. Hashes úteis no protótipo: `#tema=claro|escuro&tela=demandas&vis=quadro&dev=phone&balao=nao` (só lidos ao carregar).

- **iPhone e iPad:** o mobile é pensado para o iPhone como PWA, mas **construído como app nativo**. O iPad segue a mesma regra e, no futuro, terá Entradas com Apple Pencil. Propostas técnicas aguardando aprovação em `DECISOES.md`.
- **Vidro líquido** em quase todo o desenho (barras, menu, painéis, indicadores, botões, abas). Cards de demanda mais sólidos. **Janelas, busca e balões quase opacos**: brancos no claro e escuros no escuro, com campos de alto contraste.
- **Fontes em três papéis:** principal para títulos, secundária para subtítulos e textos, mono para detalhes pontuais (números de processo, datas, contadores) e, por exceção, a descrição resumida dos cards de demanda.
- **Ícones:** sempre por uma única função. Os ainda não escolhidos continuam em Iconoir e Lucide até o usuário selecionar os símbolos; não escolher substitutos por conta própria. Nada de emoji nos controles. Humor: PNGs do usuário em `prototipo/emojis/`. Energia: SVGs coloridos do usuário (`energia-1..5.svg`), nunca recoloridos.
- **Fundo:** Padrão do tema, Cor (uma por modo) ou Imagem local (IndexedDB), só neste navegador.
- **Regras mantidas:** nenhuma cor solta no código (valores só nos arquivos de tokens), espaços e cantos por nome, alvo de toque de 44 px, funcionar nos dois modos, cinco estados por peça (normal, foco, desativado, carregando, erro), vermelho só para atrasado ou crítico.
- **Exceções à regra do travessão:** o traço "—" aparece na interface como símbolo de "sem progresso" (decisão do usuário), e valem fora da regra o `AGENTS.md` (gerado pelo Next.js) e as skills de terceiros copiadas em `.claude/skills/`.

### Aplicação funcional (`src/`)

- `src/nucleo/` operações validadas (reutilizáveis pela futura IA) e lógica da rotina; `src/servidor/` transporte (Supabase real ou banco de teste) e ações do servidor; `src/lib/` regras puras e Supabase; `src/ui/` interface; `src/proxy.ts` porta de entrada (sessão Google, e-mail autorizado, expiração após 6 h sem uso); `src/app/api/cron/diaria` rotina diária (autenticação própria por `CRON_SECRET`, isenta do proxy e sem tocar na sessão).
- Banco em `supabase/migrations/` (versionadas, em ordem). Operações como funções SQL com RLS por usuário.
- O design antigo (20/10/2026) fica em `src/app/(antigo)` só como referência; não evoluir.
- Hidratação: o servidor e o primeiro desenho do cliente devem ser iguais. Nada de `new Date()` na renderização (a data de hoje vem do contexto), nada de mexer no DOM antes da hidratação, e sem `suppressHydrationWarning` ou esperas fixas para esconder divergência. A cápsula de seleção é o componente `Capsula`.

## Ferramentas (decidido em 25/10/2026)

São regras de trabalho. A configuração de plugins do projeto está em `.claude/settings.json`.

- **Mantidas:** Playwright (testes atuais com `playwright-core` e o Edge; sem CLI), Context7 (documentação externa), code-review (revisão concentrada, quando pertinente), Impeccable (instalada no projeto, sem hooks, telemetria desligada; avalia e refina a direção aprovada, nunca gera novas direções, `bolder` e `overdrive` fora), as skills `test-driven-development`, `systematic-debugging` e `verification-before-completion` (copiadas em `.claude/skills/`), e o Figma para consultas pontuais.
- **Desativadas, sem desinstalar:** taste-skill, ui-ux-pro-max e code-simplifier.
- **Não instalar** sem necessidade concreta: Superpowers completo, ferramentas de memória, Ponytail, Trail-code, Playwright CLI. Vercel React Best Practices só se for útil na implementação.
- Instalar skills, plugins e MCPs só na hora em que forem usados, depois de ler o que escrevem. Avaliação em `ANALISE-FERRAMENTAS.md`.
- Não alterar o modo auto, as permissões gerais nem as atualizações do Claude por conta própria.

## Andamento do projeto

**Terminar toda resposta neste projeto com a linha: "Andamento do projeto: X%".** O cálculo, os critérios e a data da última revisão ficam em `ANDAMENTO.md`. Só mudar o percentual com critério e evidência explícitos; não usar estimativas antigas como prova.

## Regras de trabalho

- **Autonomia:** decidir sozinho o que for rotina técnica dentro do escopo. Perguntar apenas quando depender de informação, escolha de produto, autenticação ou ação externa do usuário, e agrupar tudo em uma rodada curta. Decisões do usuário são gravadas em `DECISOES.md`. Não reabrir decisões encerradas nem reduzir escopo para terminar mais rápido.
- **Blocos maiores:** início, fim e entrega verificada. No fim de cada bloco, informar o percentual, o que depende do usuário e sugerir modelo e effort do próximo (quem troca é o usuário).
- **Verificação proporcional:** rodar só as verificações dos componentes afetados pela mudança (por exemplo, `testar:app` para a interface funcional, `testar:banco` para migrações, `prototipo/CLAUDE.md` para mudanças no protótipo). Repetir suíte extensa só com alteração ou dúvida que justifique. Não declarar concluído sem rodar a verificação e conferir o resultado.
- **Navegador de verdade:** telas novas são testadas clicando, trocando tema e largura, não só por captura. Servir o protótipo por http (o Playwright bloqueia `file://`). Capturas minhas não valem como aprovação visual do usuário.
- **Git:** `git push` só com autorização do usuário (vale para o bloco e a branch indicados; nunca na main, nunca force push, nunca reescrever histórico publicado). Para confirmar o backup, comparar o commit local com a **branch correspondente no remoto** (`git ls-remote origin refs/heads/<branch>`), nunca com `origin/main`. Revisar arquivos novos e segredos antes de commitar. Ao encerrar uma sessão, atualizar a retomada em `SINCRONIZA-PROJETINHO.md`, a memória local e fazer o commit.
- **Ação do usuário fora do Claude Code** (comando no PowerShell, site do Supabase, da Vercel, do GitHub, outro programa): avisar sempre, em negrito, dizendo onde e o que fazer. Não pedir senha, token privado nem conteúdo do `.env.local` no chat.
- Ao instalar plugins, skills ou MCPs a pedido do usuário, informar o que ficou instalado, o escopo (usuário ou projeto) e que o outro computador precisa repetir a instalação.
- Antes de excluir qualquer pasta ou arquivo, olhar o alvo e conferir que nada exclusivo se perde. Excluir só com pedido ou autorização. Não apagar dados locais do usuário.
- Cards e post-its nunca têm barra de rolagem: se não couber, mostrar só o título.
- Texto digitado nunca se perde: clicar fora de uma janela com texto não fecha, Esc e X guardam rascunho, só Cancelar descarta.
- Toda informação incluída pelo usuário (tarefa, nota, evento, demanda, perfil) precisa ser alterável de forma fácil, de preferência no próprio lugar.
- Tom dos textos: simpático e direto, sem bajulação, com tom de alerta quando necessário.
- Botões no estilo Apple: chatos, levemente arredondados, sem borda nem relevo. Escala única: 40 px padrão, 32 px mini, 44 px só nas barras, área de toque sempre de 44 px. Sem prazo, nada é mostrado (nem "Chegou há N d").
