@AGENTS.md

# Dmanda

Painel pessoal do Secretário de Administração da Prefeitura de Taquara/RS, com sete áreas: Início, Entradas, Demandas, Agenda, Documentos, IA e Configurações (mais Arquivo, Perfil, busca global e botão "+"). O objetivo é não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. Há um único usuário, o admin, que é o próprio Secretário. Não existe equipe, convite nem comentário. Existe um Perfil pessoal e privado (humor e produtividade).

Desenvolvido no computador e publicado na Vercel (entrada direta, sem login: acesso aberto temporário até a consolidação de segurança no fim; ver "Estado vigente"). Funciona no celular, iPad e computador (computador primeiro), instalável como PWA (primeira versão só online). O app nativo da App Store é uma etapa futura.

## Estado vigente (19/11/2026)

- **Entrada direta, sem login (decisão de 17/11/2026):** os aparelhos autorizados, o pareamento e os códigos foram removidos. O servidor chama o banco com a chave de serviço por `public.executar_como_titular` (lista fixa de operações); não há tela de acesso. O acesso aberto é temporário: a consolidação de segurança fica para o fim (`docs/auditoria-etapa-6.md`, seção "Retirada dos aparelhos"). A retirada foi aplicada no Supabase real e na Vercel (registro em `origin/main`).
- **Publicado em 20/11/2026 (SHA `964884f`, `origin/main`):** as duas migrações do 1.4 estão aplicadas no Supabase real e o código está no ar (registro em `docs/plano-publicacao-consolidada.md`, seção 10). O parágrafo a seguir descreve o que foi entregue; leia "não estão aplicadas" como história. Subbloco 1.4: (períodos de indisponibilidade com identidade da operação, retorno do setor vindo do servidor, avisos, vencimento antes da chegada; decisões 83 e 84) está em `bloco/1-4-lacunas`, fechado tecnicamente. As migrações `20261120000000_periodos_indisponiveis` e `20261120000100_retorno_do_servidor` **não** estão aplicadas no Supabase real. A organização estrutural e o acabamento técnico (rotas `/marca`, `/pecas` e `/tokens` retiradas, CSS sem consumidor removido, exportação sem 401 indevido, caminhos de falha do auxiliar de testes provados) estão em `bloco/organizacao-estrutural` (`docs/organizacao-estrutural.md`, decisão 85). O plano de publicação consolidada, **preparado e não executado**, é `docs/plano-publicacao-consolidada.md`: banco primeiro, código depois.
- **Retomada:** `CONTINUIDADE-DMANDA.md` (a seção AS, ponto de pausa, é a mais recente), decisões em `DECISOES.md` (a mais recente é a 85), andamento em `ANDAMENTO.md`. O Supabase, a Vercel e a rotina diária estão em `supabase/LEIA-ME.md`.
- **Não apagar sem autorização:** a `main` local (diverge de `origin/main` e não é base de trabalho), o stash do Clima, as branches e os worktrees antigos.
- O histórico do que este arquivo dizia até 17/11/2026 (etapas, decisões 75 a 83, estado do Supabase em outubro) está em `docs/historico-estado-claude-md.md`; ele não vale como estado vigente.

## Como rodar

| Comando | O que faz | Banco |
|---|---|---|
| `npm run dev` | aplicação em http://localhost:7100 | **Supabase real** (exige `.env.local`; sem a URL do Supabase e a chave de serviço as ações do servidor recusam com "Supabase ou chave de serviço não configurados". O arquivo existe neste computador de trabalho desde 26/10/2026) |
| `npm run dev:teste` | aplicação em http://localhost:7100 | **banco local descartável** (PGlite em `.dados-teste/`, `DMANDA_BANCO=teste`, só em desenvolvimento, recusado em produção) |
| `npm run build` e `npm run start` | produção local na 7100 | Supabase real |
| `cd prototipo` e `python -m http.server 7200 --bind 127.0.0.1` | protótipo de referência em http://127.0.0.1:7200 | nenhum (dados fictícios) |

Portas: 7100 aplicação (fixa no `package.json`), 7200 protótipo, as suítes de navegador têm cada uma a sua porta, que elas mesmas sobem (lista em `docs/testes.md`). Só pode haver **um `next dev` por vez** neste projeto (a pasta `.next` tem trava): encerrar o da 7100 antes de rodar `testar:app`. O banco de teste tem pastas por finalidade em `.dados-teste/` (`pg` do `dev:teste`, `e2e` e `visual` dos testes e das conferências); são descartáveis, mas só apagar com autorização. As migrações novas são aplicadas sozinhas a um banco de teste que já existe.

Variáveis: `.env.local` (nunca vai para o Git; o assistente não lê nem imprime arquivos `.env*`; para conferir sem revelar, ver `supabase/LEIA-ME.md`). O modelo está em `.env.example` (atualizado em 26/10/2026). Este computador de trabalho tem `.env.local` preenchido pelo usuário e a CLI do Supabase autenticada e vinculada ao projeto (desde 26/10/2026). Lista e passos do Supabase e da Vercel em `supabase/LEIA-ME.md`.

Testes (rodar só os dos componentes afetados; o que cada um cobre, as portas e como escrever uma suíte nova estão em `docs/testes.md`):

- **Regras puras, sem banco nem navegador:** `testar:regras` (inclui a ligação entre as operações do código e a lista de `executar_como_titular`, e as portas), `testar:agenda-regras`, `testar:fuso`, `testar:restauracao-v4`, `testar:auxiliar` (os caminhos de falha do auxiliar das suítes, com servidores falsos).
- **Banco (PGlite):** `testar:banco` (SQL, RLS, rotina diária, prazos, períodos, retorno do servidor, cópia v4 e restauração), `comparar:prazos-legados`.
- **Navegador (Edge e WebKit emulado, banco de teste, um servidor por vez):** `testar:app`, `interface`, `entradas`, `ajustes`, `agenda`, `periodos`, `falha-dias`, `prazo-chegada`, `config`, `campos`, `busca`, `perfil`, `origem`, `baralho`, `cards-inicio`, `vagas-carrosseis`, `auditoria`, `fila-cards`, `detalhe`, `resistencia`, `acesso-direto` (entrada direta contra um Supabase falso).
- **Outros:** `copia:ficticia` e `copia:comparar` (cópia v4 fictícia e comparação campo a campo de uma restauração; ver `docs/demonstracao-restauracao-descartavel.md`), `capturar:referencia` (referência visual do aplicativo inteiro, `gravar` e `comparar-grupos`; use antes e depois de qualquer limpeza de CSS), `verificar:cores` (cor solta só em TS e TSX), `medir:desempenho` e `testar:medicao-local` (exigem `npm run build`), `verificar:ajuste-cards`, `conferir:env` (confere o `.env.local` sem mostrar valores), `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build`.
- Toda suíte de navegador usa `scripts/auxiliar-navegador.mjs` (servidor de teste, Edge, contexto, verificador) e roda sozinha, nunca em paralelo: a pasta `.next` tem trava. Suíte nova: copiar o esqueleto de `docs/testes.md`.

Estes testes validam a lógica e a interface no banco de **teste**. Não substituem a validação no Supabase real, que se faz com a CLI oficial (`npx supabase db query --linked`, `db push --linked --dry-run`, `db advisors --linked`), sempre só neste projeto, sem `db reset`, e com transações desfeitas para testes que não podem deixar dados.

## Documentos do projeto

- CONTINUIDADE-DMANDA.md: **resumo consolidado do estado, das etapas, das decisões vigentes, da validação e da retomada em outro computador. Ler primeiro em sessão nova.**
- DECISOES.md: **fonte mais recente.** Se algo divergir, vale este arquivo.
- GitHub Issues (repositório privado): controle operacional das tarefas, estado, bloqueios e critérios de conclusão. PENDENCIAS.md: índice curto com links e histórico. SINCRONIZA-PROJETINHO.md: ambiente e retomada das sessões.
- PRODUTO.md (o que o sistema tem), FUNCIONALIDADES.md (mapa por tela e etapas de construção), ANDAMENTO.md (cálculo do percentual).
- PESQUISA.md (dores do usuário), REFERENCIAS.md (organização das informações, não o visual), QUESTIONARIO.md (já respondido), ANALISE-FERRAMENTAS.md, INVENTARIO-ICONES.md.
- supabase/LEIA-ME.md: Supabase, entrada direta, Vercel, rotina diária e proteção dos dados reais.
- docs/testes.md: convenções das suítes (auxiliares, portas, esqueleto de suíte nova) e a descrição de cada uma. docs/organizacao-estrutural.md: mapa dos problemas estruturais e o que foi feito (19/11/2026). docs/historico-estado-claude-md.md: o "Estado atual" antigo deste arquivo, só como histórico.
- AUDITORIA.md: auditoria única de 26/10/2026 (achados, configuração das skills, mapa de persistência, PWA, publicação, ações do usuário).

## Regras

- Todos os textos em português do Brasil: interface, mensagens, commits, documentos e comentários.
- Sem travessão (nem "—" nem "–") em nenhum texto. Usar vírgula, ponto, dois-pontos ou parênteses.
- Um commit a cada avanço, com mensagem em português.
- Nunca colocar senha, chave, token ou dado real em arquivo que vá para o Git. Valores reais ficam só no `.env.local` e nas variáveis da Vercel. Chave de serviço do Supabase só no servidor, nunca em `NEXT_PUBLIC`.
- Dados fictícios do protótipo nunca entram no banco real.
- Entradas (decisões 37 a 39): anotação nunca completamente vazia (título ou texto); a anotação que virou demanda fica preservada, ligada e sem edição; Virar demanda grava a demanda e o vínculo na mesma transação; o que é digitado vai para o rascunho do aparelho e só aparece como "Salvo no Dmanda" com a confirmação do banco.
- Cadastro guiado em três passos (identificação, chegada e prazo, tarefas): só o assunto é obrigatório; número, origem, descrição, chegada e prazo são opcionais e nunca inventados; a demanda é criada ao fim do passo 2, em Cadastro (decisão 28). Poucas cores por tela, cor forte só para atrasado ou crítico. Exceções combinadas: post-its pastel em Entradas e cores de demanda (amarelo) e evento (azul) na Agenda.
- O que o usuário digita é guardado automaticamente. Falha de gravação nunca mostra sucesso.
- Prazos (decisão 31): o prazo original (data escolhida, ou a DATA DE CHEGADA mais 5, 10, 20 ou 30 dias corridos, sem contar o dia da chegada; decisão 81: sem chegada o cadastro diz o que falta e hoje nunca entra na conta) é a fonte de verdade; a distinção Legal/Próprio saiu da interface (o campo `prazo_tipo` só fica nos dados); o vencimento ajustado (`prazo`) antecipa para o último dia disponível anterior se cair em sábado, domingo, feriado ou evento externo de dia inteiro cadastrado, e é recalculado no banco quando o calendário muda (toda demanda não finalizada, arquivada ou não; finalizada preserva o histórico); se o ajustado ficar estritamente antes da chegada, o cálculo não muda e a tela avisa (decisão 84, derivado dos dados, sem barra global); todas as telas leem o ajustado; dias restantes são sempre derivados das datas (America/Sao_Paulo), nunca de um contador que decai. Permanência = dias desde a chegada, sem chegada não há contagem.
- Entrada (decisão de 17/11/2026, que substitui as decisões 27 e 82 neste ponto): direta, sem login, sem aparelho e sem sessão do usuário; o servidor chama o banco como titular único por `executar_como_titular`. Não existe encerramento por inatividade. O acesso aberto é temporário e a consolidação de segurança fica para o fim.
- Custo: nada além das assinaturas Claude Pro e ChatGPT Plus. Contratar plano pago só por decisão do usuário. **Decidido em 27/10/2026: Vercel Hobby e Supabase Free; nada pago, nem teste pago, e o Pro não é decisão presumida** (fontes e efeitos em `supabase/LEIA-ME.md`, "Planos gratuitos"). Sem instaladores que peçam administrador. Ficam para o app nativo e foram aprovados para depois: conta Apple Developer, IA paga e Mobbin Pro.
- Nunca usar mensagem de cobrança, culpa ou alerta negativo dirigido ao usuário (vale principalmente em humor e produtividade).

## Design system

**Uma só direção, o Catalyst:** estilo Apple Mac e iPad, a partir do kit oficial do Figma (`prototipo/catalyst.css`), com modo claro e escuro. O identificador interno continua `d` (`data-dir="d"`). O usuário escolhe cores (10 paletas), ícones, tamanhos e fontes. A aplicação em `src/` reaproveita os CSS do protótipo (`src/estilos/`) com as mesmas classes e marcação. Hashes úteis no protótipo: `#tema=claro|escuro&tela=demandas&vis=quadro&dev=phone&balao=nao` (só lidos ao carregar).

- **iPhone e iPad:** o mobile é pensado para o iPhone como PWA, mas **construído como app nativo**. O iPad segue a mesma regra e, no futuro, terá Entradas com Apple Pencil. Propostas técnicas aguardando aprovação em `DECISOES.md`.
- **Vidro líquido** em quase todo o desenho (barras, menu, painéis, indicadores, botões, abas). Cards de demanda mais sólidos. **Janelas, busca e balões quase opacos**: brancos no claro e escuros no escuro, com campos de alto contraste.
- **Fontes em três papéis:** principal para títulos, secundária para subtítulos e textos, mono para detalhes pontuais (números de processo, datas, contadores) e, por exceção, a descrição resumida dos cards de demanda.
- **Ícones:** sempre por uma única função. Os ainda não escolhidos continuam em Iconoir e Lucide até o usuário selecionar os símbolos; não escolher substitutos por conta própria. Nada de emoji nos controles. Humor: PNGs do usuário em `prototipo/emojis/`. O indicador de energia foi retirado do Perfil e do protótipo (decisão 59); os SVGs ficam em `prototipo/emojis/` só como registro.
- **Fundo:** Padrão do tema, Cor (uma por modo) ou Imagem local (IndexedDB), só neste navegador.
- **Escala tipográfica (decisão 35):** todo tamanho de texto é `calc(Npx * var(--esc))`, com `--esc: .85` em `src/estilos/app.css` (o único número a mudar), piso de 10 px e campos de 16 px no toque. Não escrever `font-size` em px solto, nem usar zoom ou transform. O teste `testar:interface` falha se um tamanho fixo escapar.
- **Regras mantidas:** nenhuma cor solta no código (valores só nos arquivos de tokens), espaços e cantos por nome, alvo de toque de 44 px, funcionar nos dois modos, cinco estados por peça (normal, foco, desativado, carregando, erro), vermelho só para atrasado ou crítico.
- **Exceções à regra do travessão:** o traço "—" aparece na interface como símbolo de "sem progresso" (decisão do usuário), e valem fora da regra o `AGENTS.md` (gerado pelo Next.js) e as skills de terceiros copiadas em `.claude/skills/`.

### Aplicação funcional (`src/`)

- `src/nucleo/` operações validadas (reutilizáveis pela futura IA) e lógica da rotina; `src/servidor/` transporte (Supabase real por `executar_como_titular`, ou banco de teste) e ações do servidor; `src/lib/` regras puras e Supabase; `src/ui/` interface; `src/app/api/cron/diaria` rotina diária (autenticação própria por `CRON_SECRET`).
- Banco em `supabase/migrations/` (versionadas, em ordem). Operações como funções SQL com RLS por usuário.
- O design antigo (20/10/2026), com as vitrines `/marca`, `/pecas` e `/tokens`, foi retirado em 19/11/2026 (decisão 85); o Catalyst é o único design. Os arquivos de `public/marca` ficam (o `icone-app.svg` gera os ícones da PWA).
- Hidratação: o servidor e o primeiro desenho do cliente devem ser iguais. Nada de `new Date()` na renderização (a data de hoje vem do contexto), nada de mexer no DOM antes da hidratação, e sem `suppressHydrationWarning` ou esperas fixas para esconder divergência. A cápsula de seleção é o componente `Capsula`.

## Ferramentas (decidido em 25/10/2026)

São regras de trabalho. A configuração de plugins do projeto está em `.claude/settings.json`.

- **Mantidas:** Playwright (testes atuais com `playwright-core` e o Edge; sem CLI), Context7 (documentação externa), code-review (revisão concentrada, quando pertinente), a skill de design **`dmanda-design-por-referencias`** (`.claude/skills/`, a única de design ativa desde 12/11/2026, decisão 71: as referências enviadas mandam na estrutura e na apresentação da tela, dentro do Catalyst; desenho renderizado e aprovado pelo Éder antes da implementação completa; polimento pontual segue o fluxo habitual), as skills `test-driven-development`, `systematic-debugging` e `verification-before-completion` (copiadas em `.claude/skills/`), o Figma para consultas pontuais e o **Ponytail** (só `ponytail-audit` e `ponytail-review`, copiados sem alteração para `.claude/skills/` em 27/10/2026, com origem e licença MIT em `.claude/skills/ponytail-ORIGEM.txt`; sem hooks nem telemetria): usar na auditoria do repositório e na revisão de mudanças, sempre abaixo das decisões do usuário e do Catalyst. **Regra permanente (29/10/2026): todo bloco funcional (código de comportamento, banco ou interface com lógica) passa por `ponytail-review`, invocado de fato pelo comando de skills, antes do commit de entrega; os achados procedentes são corrigidos (com teste quando houver risco) ou justificados, e o resultado entra no relatório do bloco.** Conferência de 29/10: as duas skills são idênticas à origem (`DietrichGebert/ponytail`, hash do conteúdo igual).
- **Removidas (decisão 71, 12/11/2026):** o Impeccable (skill, quatro agentes e `.impeccable/` saíram do projeto). **Desativadas no escopo do projeto, sem desinstalar:** taste-skill (instalado no escopo do usuário deste computador e compartilhado com outros projetos), ui-ux-pro-max e code-simplifier. O Taste (plugin 2.1.4 no computador) foi lido em 27/10/2026 só como roteiro de olhar na auditoria da interface (`references/app-screens.md` e `critique.md`), sem gerar direção nem trocar nada do Catalyst; continua desativado no projeto.
- **Não instalar** sem necessidade concreta: Superpowers completo, ferramentas de memória, o restante do Ponytail (hooks, band, comandos), Trail-code, Playwright CLI. Vercel React Best Practices só se for útil na implementação.
- Instalar skills, plugins e MCPs só na hora em que forem usados, depois de ler o que escrevem. Avaliação em `ANALISE-FERRAMENTAS.md`.
- Não alterar o modo auto, as permissões gerais nem as atualizações do Claude por conta própria.

## Andamento do projeto

**Terminar toda resposta neste projeto com a linha: "Andamento do projeto: X%".** O cálculo, os critérios e a data da última revisão ficam em `ANDAMENTO.md`. Só mudar o percentual com critério e evidência explícitos; não usar estimativas antigas como prova.

## Regras de trabalho

- **Autonomia:** decidir sozinho o que for rotina técnica dentro do escopo. Perguntar apenas quando depender de informação, escolha de produto, autenticação ou ação externa do usuário, e agrupar tudo em uma rodada curta. Decisões do usuário são gravadas em `DECISOES.md`. Não reabrir decisões encerradas nem reduzir escopo para terminar mais rápido.
- **Blocos maiores:** início, fim e entrega verificada. No fim de cada bloco, informar o percentual, o que depende do usuário e sugerir modelo e effort do próximo (quem troca é o usuário).
- **Leitura direcionada e contexto enxuto:** antes de abrir arquivos, localizar com `rg` (símbolos, referências, testes) e partir de `git diff`; ler com `offset` e `limit` e ampliar só quando precisar de dependências ou de segurança; não reler arquivos completos nem documentos históricos sem pergunta concreta; reaproveitar o que já foi verificado enquanto o arquivo não mudou. Saídas extensas vão para arquivos temporários (no diretório de rascunho), e o relatório traz resultado, código de saída e o diagnóstico relevante; em falha, ler o trecho necessário, sem filtro que faça um comando malsucedido parecer aprovado.
- **Verificação proporcional:** rodar só as verificações dos componentes afetados pela mudança (por exemplo, `testar:app` para a interface funcional, `testar:banco` para migrações, `prototipo/CLAUDE.md` para mudanças no protótipo). Repetir suíte extensa só com alteração ou dúvida que justifique. Não declarar concluído sem rodar a verificação e conferir o resultado.
- **Interface renderizada em Claro e Escuro (regra permanente, decisão 76):** todo bloco que altera UI confere a tela renderizada nos dois temas, nos estados vazio, preenchido, foco, edição e erro, em celular, iPad e computador. A aceitação exige evidência de que o controle está **visível e utilizável** (limite, texto e foco medidos na imagem ou no contraste, WebKit além do Edge quando disponível); a presença do elemento no DOM e um clique automatizado, sozinhos, não demonstram isso. Uma revisão em modo Plan inclui esses cenários e registra o que o navegador ainda precisa comprovar (Safari em aparelho real, por exemplo).
- **Navegador de verdade:** telas novas são testadas clicando, trocando tema e largura, não só por captura. Servir o protótipo por http (o Playwright bloqueia `file://`). Capturas minhas não valem como aprovação visual do usuário.
- **Issues:** ao iniciar um bloco, consultar as Issues abertas (`gh issue list -R edermoliveira/Dmanda`). Criar uma Issue por bloco quando ele entrar em execução. Referenciar o número real nos commits ("#1"), sem fechamento automático; fechar só quando os critérios forem atendidos, incluindo a avaliação do usuário quando fizer parte. Nada de credenciais, e-mail pessoal, dados reais ou conteúdo do `.env.local` nas Issues; não mencionar nem atribuir outras pessoas.
- **Git (vigente desde 27/10/2026, decisões 24 e 25):** a **`main` é a referência única de trabalho e de publicação**, com commits organizados e em português. Não criar branch secundária sem pedido do usuário, e a `producao` não existe mais. **Cada envio à `main` publica o painel na Vercel** (o `vercel.json` desliga a implantação de qualquer outra branch), então só enviar o que foi verificado. `git push` da `main` só com autorização do usuário para o bloco (nunca force push, nunca reescrever histórico publicado). Para confirmar o backup, comparar o commit local com `git ls-remote origin refs/heads/main`. Sessões na nuvem trabalham em `claude/...` e voltam por PR revisado pelo usuário. Revisar arquivos novos e segredos antes de commitar. Ao encerrar uma sessão, atualizar a retomada em `SINCRONIZA-PROJETINHO.md`, a memória local e fazer o commit.
- **Ação do usuário fora do Claude Code** (comando no PowerShell, site do Supabase, da Vercel, do GitHub, outro programa): avisar sempre, em negrito, dizendo onde e o que fazer. Não pedir senha, token privado nem conteúdo do `.env.local` no chat.
- Ao instalar plugins, skills ou MCPs a pedido do usuário, informar o que ficou instalado, o escopo (usuário ou projeto) e que o outro computador precisa repetir a instalação.
- Antes de excluir qualquer pasta ou arquivo, olhar o alvo e conferir que nada exclusivo se perde. Excluir só com pedido ou autorização. Não apagar dados locais do usuário.
- Cards e post-its nunca têm barra de rolagem: se não couber, mostrar só o título.
- Texto digitado nunca se perde: clicar fora de uma janela com texto não fecha, Esc e X guardam rascunho, só Cancelar descarta.
- Toda informação incluída pelo usuário (tarefa, nota, evento, demanda, perfil) precisa ser alterável de forma fácil, de preferência no próprio lugar.
- Tom dos textos: simpático e direto, sem bajulação, com tom de alerta quando necessário.
- Botões no estilo Apple: chatos, levemente arredondados, sem borda nem relevo. Escala única: 40 px padrão, 32 px mini, 44 px só nas barras, área de toque sempre de 44 px. Sem prazo, nada é mostrado (nem "Chegou há N d").
