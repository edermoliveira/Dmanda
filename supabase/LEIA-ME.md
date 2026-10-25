# Supabase, Vercel e rotina diária do Dmanda

**Estado (25/10/2026):** o projeto Supabase **Dmanda** existe, está vinculado a esta pasta e **as 5 migrações foram aplicadas no banco real**. A segurança do banco foi validada nele com JWTs simulados dentro de transações desfeitas. **Ainda não validados:** o login Google de verdade (depende do Google Cloud e do painel do Supabase, ações suas), o hook de cadastro ativo no painel, a gravação pela interface com sessão real, a publicação na Vercel e o agendamento.

## O projeto

| Item | Valor |
|---|---|
| Nome | Dmanda |
| Referência | `gmxoosvgfcydccyeudej` (endereço `https://gmxoosvgfcydccyeudej.supabase.co`) |
| Organização | `ubuzntqxnuaiqrprrknw` |
| Região | São Paulo (`sa-east-1`), Postgres 17, plano gratuito |
| Vínculo local | `npx supabase link --project-ref gmxoosvgfcydccyeudej` (feito; os metadados ficam em `supabase/.temp/`, ignorado pelo Git) |
| Outros projetos da conta | existem, **não são tocados** pelo Dmanda |

A CLI oficial (`npx supabase`, sem instalação global) está autenticada neste computador por login seu. O assistente a usa só neste projeto: `migration list`, `db push`, `db query --linked`, `db advisors`. Nunca `db reset`.

## Quem faz o quê

| Etapa | Quem | Onde | Estado |
|---|---|---|---|
| Criar o projeto | usuário | site do Supabase | feito |
| Aplicar as migrações e conferir o banco | Claude (CLI) | Supabase | feito |
| Cadastrar a conta autorizada na lista protegida | Claude (CLI) | banco | feito |
| Criar `.env.local` com URL, chave pública, conta autorizada e `CRON_SECRET` | Claude | computador | feito (sem exibir valores) |
| **Preencher `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`** | **usuário** | painel do Supabase e arquivo local | pendente |
| **Login Google (Google Cloud + painel do Supabase) e hook de cadastro** | **usuário** | ver "Passo a passo" abaixo | pendente |
| Validar o login real, o primeiro acesso, o segundo acesso e a rejeição de outra conta | Claude, com o usuário entrando | `http://localhost:7100` | depois do passo anterior |
| Projeto da Vercel, variáveis e agendamento | usuário e Claude | site da Vercel | depois, fora deste bloco |

## Variáveis de ambiente

| Variável | Onde fica | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` e Vercel | endereço do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` e Vercel | chave **pública** (publishable). Só vale com RLS e login |
| `DMANDA_EMAIL_AUTORIZADO` | `.env.local` e Vercel | e-mail da conta Google do Secretário. O servidor recusa qualquer outra conta |
| `SUPABASE_SERVICE_ROLE_KEY` | **só no servidor**: `.env.local` (teste local da rotina) e Vercel | chave privilegiada (a "secret key"). Usada apenas pela rotina diária. **Nunca** em `NEXT_PUBLIC` nem no Git |
| `CRON_SECRET` | `.env.local` e Vercel (só no servidor) | texto aleatório de 16 caracteres ou mais. A Vercel o envia como `Authorization: Bearer` ao chamar a rotina |
| `DMANDA_BANCO=teste` | só em desenvolvimento (`npm run dev:teste`) | banco local descartável. **Recusado em produção** |

Modelo do `.env.example` (valores fictícios; o assistente não tem permissão para editar esse arquivo, então este é o texto a conferir ou colar):

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=chave-publica-de-exemplo
DMANDA_EMAIL_AUTORIZADO=seu-email@exemplo.com
# Só no servidor (Vercel). Nunca com NEXT_PUBLIC e nunca no Git:
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

**Conferir o `.env.local` sem revelar valores** (no PowerShell, dentro da pasta do projeto):

```
node --env-file=.env.local -e "for (const k of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','DMANDA_EMAIL_AUTORIZADO','SUPABASE_SERVICE_ROLE_KEY','CRON_SECRET']) console.log(k.padEnd(40), process.env[k] ? 'preenchida' : 'VAZIA')"
```

## Migrações (`migrations/`, aplicadas em ordem)

1. `20261025000000_nucleo_demandas.sql`: tabelas `demandas` e `tarefas`, RLS por usuário, funções de todas as operações. Os privilégios são explícitos (lista de funções, sem "all functions"; tira tudo de `authenticated` e devolve só select, insert, update e delete nas tabelas).
2. `20261025000100_salvar_demanda.sql`: salvar demanda e tarefas de forma atômica.
3. `20261025000200_rotina_diaria.sql`: resumo operacional datado, registro das execuções, gatilho de recálculo, funções restritas ao papel de serviço.
4. `20261025000300_acesso_exclusivo.sql`: lista protegida de contas (`dmanda_privado.acesso_autorizado`), função `dmanda_privado.conta_autorizada()`, hook `public.hook_antes_criar_usuario` e as políticas de RLS exigindo também a conta autorizada.
5. `20261025000400_revogar_funcao_da_plataforma.sql`: tira a execução pública de `public.rls_auto_enable()`, função da própria plataforma que o Security Advisor apontava. O RLS automático continua funcionando (conferido).

**Por que a conferência de privilégios importa aqui:** o projeto foi criado com a exposição automática de tabelas **desligada**. Tabelas novas nascem **sem** select, insert, update e delete para `anon`, `authenticated` e `service_role`, e funções novas nascem executáveis por qualquer papel até serem revogadas. Por isso cada migração declara tudo de que depende. O banco de teste local (PGlite) agora imita esse comportamento, então uma permissão esquecida aparece nos testes.

Regras: antes de aplicar, conferir o esquema remoto e `npx supabase db push --linked --dry-run`. As migrações não apagam dados. Nunca resetar o banco real. Dados do protótipo não entram. Migração já aplicada não se reescreve: correções vão em migração nova.

## Acesso exclusivo à conta autorizada (três camadas)

1. **Supabase Auth (cadastro):** o hook **Before User Created** (`public.hook_antes_criar_usuario`) só permite criar usuário com o e-mail da lista protegida **e** `app_metadata.provider = google`. Decide só por dados que o servidor de Auth define, nunca por nome de exibição nem `user_metadata`. Qualquer outra conta recebe 403 e a mensagem "Este endereço não tem acesso ao Dmanda."; o callback leva o usuário a `/login?negado=1`.
2. **Servidor da aplicação:** `src/proxy.ts`, o callback e cada operação (`src/servidor/banco.ts`) exigem sessão válida, provedor Google e e-mail igual a `DMANDA_EMAIL_AUTORIZADO`, mais o uso nas últimas **6 horas**.
3. **Banco:** as políticas de RLS exigem `user_id = auth.uid()` **e** `dmanda_privado.conta_autorizada()`, que compara o e-mail e o provedor do JWT assinado com a lista protegida. Mesmo que outro usuário existisse, não leria nem gravaria nada.

A lista protegida **não está em nenhum arquivo versionado** (vazia significa ninguém autorizado). Para trocar ou acrescentar a conta (o assistente faz com a CLI, ou você no SQL Editor do painel):

```
npx supabase db query --linked "insert into dmanda_privado.acesso_autorizado (email) values ('endereco@exemplo.com')"
```

O endereço vai em minúsculas. O esquema `dmanda_privado` **não** deve ser adicionado aos "Exposed schemas" da Data API.

## Passo a passo do login Google (ações suas)

A ordem importa: faça o Google Cloud primeiro, depois o painel do Supabase. Não envie o Client Secret nem a chave secreta no chat.

**1. Google Cloud** (`https://console.cloud.google.com`, com a conta do Secretário):
1. Crie ou escolha um projeto (por exemplo, "Dmanda").
2. Menu "APIs e serviços" > "Tela de permissão OAuth" (ou "Google Auth Platform"): tipo de usuário **Externo**; nome do app "Dmanda"; e-mail de suporte e de contato: o seu.
3. Público-alvo: deixe em **Teste** e, em "Usuários de teste", adicione a conta autorizada. Escopos: apenas os básicos (`openid`, e-mail e perfil). **Não** habilite Calendar nem Drive agora.
4. "Credenciais" > "Criar credenciais" > "ID do cliente OAuth" > tipo **Aplicativo da Web**:
   - **Origens JavaScript autorizadas:** `http://localhost:7100`
   - **URIs de redirecionamento autorizados:** `https://gmxoosvgfcydccyeudej.supabase.co/auth/v1/callback`
5. Copie o **ID do cliente** e a **chave secreta** (só para colar no passo 2).

**2. Painel do Supabase** (`https://supabase.com/dashboard/project/gmxoosvgfcydccyeudej`):
1. **Authentication > Sign In / Providers > Google:** ative, cole o ID do cliente e a chave secreta, deixe "Skip nonce checks" desligado e salve.
2. Na mesma tela, **desative o provedor Email** e mantenha o acesso anônimo desligado. Mantenha "Allow new users to sign up" **ligado até o seu primeiro login**; o hook já impede cadastros de outras contas.
3. **Authentication > URL Configuration:** "Site URL" = `http://localhost:7100`; em "Redirect URLs" adicione `http://localhost:7100/auth/callback`. (O retorno do Google para o Supabase é o endereço `.../auth/v1/callback` do passo anterior; o retorno do Supabase para o aplicativo é `/auth/callback` na porta 7100. São duas coisas diferentes.)
4. **Authentication > Auth Hooks** (ou "Hooks"): "Add a new hook" > **Before User Created** > tipo **Postgres function** > esquema `public`, função `hook_antes_criar_usuario` > crie e **ative**. O painel concede sozinho a execução ao papel do Auth.
5. **Project Settings > API Keys > Secret keys > "default":** revele e copie a chave. Cole no `.env.local`, na linha `SUPABASE_SERVICE_ROLE_KEY=` (sem aspas), e salve.

**3. Depois, no terminal da sessão:** pare o servidor de teste e rode `npm run dev`; o assistente então valida com você o primeiro login, o segundo acesso e a rejeição de outra conta. Depois do primeiro login bem-sucedido, em Authentication > Sign In / Providers, desligue "Allow new users to sign up" (proteção extra).

## Validação feita no Supabase real (25/10/2026)

Feita com a CLI, em transações sempre desfeitas, com JWTs simulados no nível do banco (**não** é um login real):

- Esquema remoto antes: vazio (sem tabelas, sem usuários, sem migrações). Depois: 5 migrações registradas, 4 tabelas com RLS, 1 tabela privada com RLS e sem política.
- Security Advisor: sem problemas.
- Conta autorizada (Google): criou demanda, adicionou tarefa (Cadastro vai para Vistos), moveu etapa, salvou com tarefas, concluiu (todas as tarefas marcadas), reabriu mantendo as tarefas e leu o estado da rotina.
- Outra conta, mesmo com sessão válida: vê zero demandas, não grava, não cria, não move demanda alheia (RLS).
- Mesma conta por outro provedor: vê zero.
- Visitante (anon): sem acesso a funções, tabelas nem à lista protegida.
- Usuário logado: não executa a rotina nem lê a lista protegida.
- Papel de serviço: executa só a rotina e o registro de falha, gravou o resumo e a execução, e não toca as demandas diretamente.
- Hook: libera a conta autorizada pelo Google; recusa (403) outra conta, a mesma conta por e-mail e senha, anônimo e sem e-mail; só o papel do Auth o executa.
- Nenhum dado de teste ficou no banco (0 usuários, 0 demandas, 0 execuções depois).

**Ainda não validado:** login Google real, primeiro e segundo acesso, rejeição real de outra conta pelo hook ativo, gravação e leitura pela interface, persistência depois de recarregar, quatro visões com dados reais, chamada HTTP da rotina com a chave de serviço.

## Rotina diária na nuvem

- **O que faz:** consulta prazos e acompanhamentos, grava um resumo operacional **datado** (`resumos_operacionais`, com contagens e identificadores, sem texto das demandas) e registra a execução (`execucoes_rotina`). Só **lê** as demandas: não conclui, não altera prazos e não inventa dados.
- **Datas:** as datas originais (`prazo`, `acompanhar_em`) são a fonte de verdade. Dias restantes são derivados delas com a data de hoje em America/Sao_Paulo, na tela e na rotina. O resumo guarda a data de referência e é recalculado quando uma demanda muda. A tela não depende do resumo, então os prazos continuam corretos mesmo se o agendamento atrasar ou falhar.
- **Falhas e repetição:** repetir no mesmo dia mantém um único resumo (idempotente). Se um dia for perdido, o seguinte recalcula tudo pelas datas. A falha é registrada (mensagem curta, sem dado pessoal) e o Início mostra, sem alarme, a última execução e a última falha.
- **Segurança:** a rota `GET /api/cron/diaria` só responde com `Authorization: Bearer <CRON_SECRET>` (401 sem ele, 503 se o segredo não estiver configurado, 500 se faltar a chave de serviço). Não usa sessão Google, não renova o "último uso" e a resposta traz só a data e uma contagem. No banco, `rotina_diaria` e `registrar_falha_rotina` só podem ser executadas pelo papel de serviço (conferido no banco real).
- **Agendamento:** `vercel.json` define uma chamada por dia às 09:00 UTC (06:00 em Brasília). A Vercel usa sempre UTC.
- **Plano da Vercel (conferido na documentação em 25/10/2026):** o plano Hobby permite cron **uma vez por dia**, com precisão de hora (pode rodar entre 06:00 e 06:59), e é restrito a **uso pessoal e não comercial** (a Vercel define uso comercial como projeto de que alguém ganhe dinheiro, **incluindo um funcionário pago que escreva o código**). Cron só roda no deployment de **produção**, não em Preview, e não tem retentativa nem garantia de entrega única. **Decisão do usuário:** o enquadramento do Dmanda (ferramenta pessoal usada no trabalho da Prefeitura) no plano Hobby precisa ser confirmado por ele, se necessário com o suporte da Vercel. Nada foi contratado, e a publicação não faz parte deste bloco.
- **Supabase gratuito:** projetos de baixa atividade podem ser **pausados** (a documentação fala em 7 dias). Uma chamada diária **não garante** que o projeto nunca pause. O plano Pro evita a pausa, mas não foi contratado.
- **Em quatro níveis:**
  1. Código preparado: **sim**.
  2. Função validada no banco real, como papel de serviço, dentro de transação desfeita: **sim**. Chamada HTTP da rota em produção local: 401 sem segredo, 401 com segredo errado e 500 com segredo correto e chave de serviço ainda em branco (falha por configuração ausente). **Chamada HTTP bem-sucedida no banco real: ainda não** (falta a chave de serviço no `.env.local`).
  3. Agendamento implantado na Vercel: **não**.
  4. Primeira execução automática observada: **não**.

## Proteção dos dados reais (cópia própria)

- O GitHub guarda **código e migrações**, não os dados. Os registros reais ficam só no Supabase e **nunca** vão para o repositório.
- **Correção:** o plano gratuito **não oferece os backups gerenciados** dos planos pagos (nem restauração pelo painel), mas **permite a exportação lógica** dos próprios dados (por exemplo, `pg_dump` ou exportação das tabelas).
- **Hoje:** não existe nenhuma cópia própria. **Pendente explícita** até haver mecanismo e destino definidos: uma cópia privada periódica, fora do repositório, com teste de restauração. O `supabase db dump` da CLI pode exigir o Docker, que **não** será instalado sem necessidade; alternativas (pg_dump com a senha do banco, que fica só com você, ou um script de exportação das tabelas) serão propostas na hora de decidir.

## Teste local sem Supabase

`npm run dev:teste` usa o banco local descartável (`.dados-teste/`, não vai para o Git). As migrações novas são aplicadas sozinhas a um banco de teste já existente. Testes: `npm run testar:banco` (87), `testar:regras` (21), `testar:app` (58). Eles **não** substituem a validação no Supabase real.
