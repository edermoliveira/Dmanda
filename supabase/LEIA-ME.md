# Supabase, Vercel e rotina diária do Dmanda

**Estado vigente (30/10/2026):** **10 migrações aplicadas no banco real** (a 10, `20261030000000_entradas`, foi aplicada em 30/10/2026 com dry-run, sem reset, sem tocar nos dados: 5 demandas, 8 tarefas e 1 usuário seguiram iguais; a tabela `entradas` nasceu vazia). Entrada por e-mail e senha, Google desativado e sessão persistente (decisão 27: **não existe mais a expiração de 6 horas**). Ainda **não validados no real:** a sessão por horas reais, a restauração da cópia, o agendamento do cron e o uso autenticado de Entradas pelo assistente. **O parágrafo abaixo é o estado de 27/10/2026 e está superado nos pontos acima** (mantido como histórico).

**Estado (27/10/2026):** o projeto Supabase **Dmanda** existe, está vinculado a este computador e tem **8 migrações aplicadas no banco real** (a 8, `20261029000000_prazos_e_dias_indisponiveis`, foi aplicada em 29/10/2026 com dry-run, sem reset, preservando as 3 demandas e 7 tarefas existentes; os 3 prazos antigos viraram a referência original, marcada como legado) (a 6, login por e-mail e senha, e a 7, proteção de edição simultânea, aplicadas em 26/10/2026 com dry-run, sem reset). A entrada por **e-mail e senha** (Supabase Auth) foi **provada no Supabase real** no mesmo usuário (ver `AUDITORIA.md`, seção 15). Em 27/10/2026 o **provedor Google foi desativado no painel** (Email ligado, cadastro público desligado) e a gravação, a saída e a nova entrada foram confirmadas pelo usuário (ver `AUDITORIA.md`, seção 17). O botão do Google fica **oculto por padrão** (só aparece com `DMANDA_LOGIN_GOOGLE=sim`). **Ainda não validados no real:** expiração de 6 h real, restauração da cópia, publicação na Vercel e o agendamento.

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

## Quem faz o quê (entrada por senha, 26/10/2026)

Situação em 27/10/2026: as etapas 1 a 7 estão **concluídas**. Falta só a 8 (publicação).

| # | Etapa | Quem | Onde |
|---|---|---|---|
| 1 | Criar `.env.local` (copiar `.env.example`) e preencher URL, chave pública, e-mail autorizado, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` | **usuário** | computador, no PowerShell, sem colar valores no chat |
| 2 | `npx supabase login` e `npx supabase link --project-ref gmxoosvgfcydccyeudej` (neste computador ainda não há login) | **usuário** | PowerShell (`! npx supabase login` na sessão) |
| 3 | Aplicar a migração 6: `npx supabase db push --linked --dry-run`, depois `npx supabase db push --linked` | Claude (CLI) | Supabase, sem reset e sem perda de dados |
| 4 | Ligar o provedor **Email** (ver "Entrada por e-mail e senha") | **usuário** | painel do Supabase |
| 5 | Definir a senha: `npm run definir:senha` (digitada duas vezes, tela oculta) | **usuário** | PowerShell, na pasta do projeto |
| 6 | Provar a entrada por senha no mesmo usuário (mesmo identificador) e a gravação | usuário entra; Claude confere o banco | `http://localhost:7100` |
| 7 | Desligar o Google no painel (feito em 27/10/2026). Não precisa de variável: o botão já fica oculto por padrão | **usuário** | painel do Supabase |
| 8 | Projeto da Vercel, variáveis e agendamento | usuário e Claude | site da Vercel, depois (ver "Publicação") |

## Variáveis de ambiente

| Variável | Onde fica | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` e Vercel | endereço do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` e Vercel | chave **pública** (publishable). Só vale com RLS e login |
| `DMANDA_EMAIL_AUTORIZADO` | `.env.local` e Vercel | e-mail da conta Google do Secretário. O servidor recusa qualquer outra conta |
| `SUPABASE_SERVICE_ROLE_KEY` | **só no servidor**: `.env.local` (teste local da rotina) e Vercel | chave privilegiada (a "secret key"). Usada apenas pela rotina diária. **Nunca** em `NEXT_PUBLIC` nem no Git |
| `CRON_SECRET` | `.env.local` e Vercel (só no servidor) | texto aleatório de 16 caracteres ou mais. A Vercel o envia como `Authorization: Bearer` ao chamar a rotina |
| `DMANDA_LOGIN_GOOGLE` | `.env.local` e Vercel (opcional) | deixe **vazia** (padrão): o botão do Google fica oculto e só e-mail e senha aparecem. `sim`: mostra o botão (só faz sentido com o provedor Google ligado no painel). Lida na montagem da página (vale no próximo build ou publicação) |
| `DMANDA_BANCO=teste` | só em desenvolvimento (`npm run dev:teste`) | banco local descartável. **Recusado em produção** |

O modelo está no `.env.example` (versionado, sem valores; atualizado em 26/10/2026, antes tinha nomes antigos). Copiar para `.env.local` e preencher.

**Conferir o `.env.local` sem revelar valores** (no PowerShell, dentro da pasta do projeto):

```
npm run conferir:env
```

Mostra só `ok`, `VAZIA` ou `ATENÇÃO` com o motivo, nunca os valores. Confere o formato (a URL precisa ser a do projeto Dmanda, a chave pública não pode ser a secreta e vice-versa, o `CRON_SECRET` precisa de 16 caracteres ou mais, `DMANDA_BANCO` precisa estar vazia aqui). Com tudo no formato certo, também consulta o Supabase só para leitura: provedores ligados (Email, Google), cadastro público, confirmação automática de e-mail, quantos usuários existem e o início do identificador do usuário autorizado. Não altera nada. `node scripts/conferir-env.mjs --sem-rede` pula a consulta.

**De onde vem cada valor** (valores só no `.env.local`; nada disso vai ao chat, a comandos visíveis ou ao Git):

| Variável | Painel de origem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | já vem preenchida (endereço do projeto Dmanda; não é segredo). Também em Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase > Project Settings > API Keys > aba **Publishable key** (`sb_publishable_...`) |
| `DMANDA_EMAIL_AUTORIZADO` | o e-mail da conta autorizada: o mesmo da conta Google com que você já entrou (ou Authentication > Users, coluna de e-mail) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API Keys > aba **Secret keys** (`sb_secret_...`). Nunca em `NEXT_PUBLIC` |
| `CRON_SECRET` | já vem gerado (aleatório, só neste computador). Na Vercel pode ser o mesmo valor ou outro novo (16 caracteres ou mais): o da Vercel é o que vale em produção |
| `DMANDA_LOGIN_GOOGLE` | vazio (botão do Google oculto). Só `sim` o mostra |
| `DMANDA_BANCO` | vazio |

## Migrações (`migrations/`, aplicadas em ordem)

1. `20261025000000_nucleo_demandas.sql`: tabelas `demandas` e `tarefas`, RLS por usuário, funções de todas as operações. Os privilégios são explícitos (lista de funções, sem "all functions"; tira tudo de `authenticated` e devolve só select, insert, update e delete nas tabelas).
2. `20261025000100_salvar_demanda.sql`: salvar demanda e tarefas de forma atômica.
3. `20261025000200_rotina_diaria.sql`: resumo operacional datado, registro das execuções, gatilho de recálculo, funções restritas ao papel de serviço.
4. `20261025000300_acesso_exclusivo.sql`: lista protegida de contas (`dmanda_privado.acesso_autorizado`), função `dmanda_privado.conta_autorizada()`, hook `public.hook_antes_criar_usuario` e as políticas de RLS exigindo também a conta autorizada.
5. `20261025000400_revogar_funcao_da_plataforma.sql`: tira a execução pública de `public.rls_auto_enable()`, função da própria plataforma que o Security Advisor apontava. O RLS automático continua funcionando (conferido).

6. `20261026000000_login_email_senha.sql` (**aplicada no banco real em 26/10/2026**): troca só `dmanda_privado.conta_autorizada()` para aceitar o provedor `email` além de `google`, mantendo a lista protegida. O **hook de cadastro não muda** (continua só Google): ninguém cria usuário por e-mail e senha, e a senha é definida no usuário que já existe. Nenhuma tabela, política ou privilégio muda; o usuário e os dados são os mesmos. Compatível com as anteriores (não reescreve nenhuma).
7. `20261026000100_protecao_edicao_simultanea.sql` (**aplicada no banco real em 26/10/2026**): coluna `demandas.versao` (padrão 1), gatilhos que a sobem a cada alteração da demanda ou de qualquer tarefa dela, e `salvar_demanda(p_id, p, p_tarefas, p_versao)` que, depois de travar a linha, recusa tudo com o código `DM409` se a versão mudou (nada é gravado). A função antiga de três argumentos foi removida. Não reescreve nenhuma migração anterior; os dados existentes ganham versão 1.

**Por que a conferência de privilégios importa aqui:** o projeto foi criado com a exposição automática de tabelas **desligada**. Tabelas novas nascem **sem** select, insert, update e delete para `anon`, `authenticated` e `service_role`, e funções novas nascem executáveis por qualquer papel até serem revogadas. Por isso cada migração declara tudo de que depende. O banco de teste local (PGlite) agora imita esse comportamento, então uma permissão esquecida aparece nos testes.

Regras: antes de aplicar, conferir o esquema remoto e `npx supabase db push --linked --dry-run`. As migrações não apagam dados. Nunca resetar o banco real. Dados do protótipo não entram. Migração já aplicada não se reescreve: correções vão em migração nova.

## Acesso exclusivo à conta autorizada (três camadas)

1. **Supabase Auth (cadastro):** o hook **Before User Created** (`public.hook_antes_criar_usuario`) só permite criar usuário com o e-mail da lista protegida **e** provedor `google`. Mesmo com a entrada por senha, ele **continua só Google de propósito**: aceitar `email` abriria cadastro por senha para o endereço autorizado sem exigir e-mail confirmado (se a conta fosse apagada ou a confirmação desligada). Decide só por dados que o servidor de Auth define, nunca por nome de exibição nem `user_metadata`. Qualquer outra conta recebe 403 e a mensagem "Este endereço não tem acesso ao Dmanda.".
2. **Servidor da aplicação:** `src/proxy.ts`, o callback, a conclusão da entrada por senha (`src/servidor/entrar.ts`) e cada operação (`src/servidor/banco.ts`) exigem sessão válida, provedor aceito (Google ou e-mail e senha) e e-mail igual a `DMANDA_EMAIL_AUTORIZADO`, (a sessão persiste: ver "Sessão persistente").
3. **Banco:** as políticas de RLS exigem `user_id = auth.uid()` **e** `dmanda_privado.conta_autorizada()`, que compara o e-mail e o provedor do JWT assinado com a lista protegida. Mesmo que outro usuário existisse, não leria nem gravaria nada.

A lista protegida **não está em nenhum arquivo versionado** (vazia significa ninguém autorizado). Para trocar ou acrescentar a conta (o assistente faz com a CLI, ou você no SQL Editor do painel):

```
npx supabase db query --linked "insert into dmanda_privado.acesso_autorizado (email) values ('endereco@exemplo.com')"
```

O endereço vai em minúsculas. O esquema `dmanda_privado` **não** deve ser adicionado aos "Exposed schemas" da Data API.

## Entrada por e-mail e senha (decisão de 26/10/2026)

**Situação encontrada na auditoria:** não havia autenticação por senha no aplicativo. O formulário só tinha o botão do Google, e o código (`contaAutorizada`), o hook e a RLS exigiam `provider = google`. As credenciais de e-mail e senha que o usuário conhece são do **painel de administração** do Supabase, outra coisa. Habilitar "Email" no painel sozinho não bastava. Agora:

- **Formulário** em `/login` (`FormularioSenha`): o navegador chama o Supabase Auth direto (`signInWithPassword`), de modo que o **limite de tentativas do Auth conta pelo endereço de quem tenta**; se a chamada saísse do servidor, todas contariam pelo endereço do servidor e um terceiro poderia esgotar o limite e bloquear o próprio Secretário. Em seguida uma **ação do servidor** (`concluirEntrada`, `src/servidor/entrar.ts`) confere que a conta é a autorizada (e-mail e provedor), encerra a sessão local se não for e só então grava o carimbo de último uso. A senha nunca é guardada nem registrada e nunca volta para a tela (só o e-mail digitado é mantido se a entrada falhar). Erro de e-mail, de senha ou de conta fora da lista mostra sempre a mesma mensagem. Sem a conclusão não há carimbo, e sem carimbo a porta de entrada trata a sessão como expirada.
- **Mesmo usuário e mesmos dados:** a senha é definida **no usuário que já existe** (o que entrou pelo Google), com a API de administração oficial. Não se cria outro usuário, não se troca o e-mail, o identificador e as linhas de `demandas` continuam os mesmos.
- **Sem autenticação própria, sem senha no código, sem cadastro público, sem vários usuários.**
- **Saída** (`Sair`, escopo local) e a **sessão persistente** valem igualmente para os dois modos de entrada.

**Ordem segura de implantação (o acesso atual não é interrompido):**

1. (Feito em 26/10/2026) Aplicar a migração 6 (`npx supabase db push --linked --dry-run`, depois sem `--dry-run`). O Google continua funcionando.
2. No painel do Supabase, **Authentication > Sign In / Providers > Email**: **ligue** o provedor. Em "Password" defina o **mínimo de 12 caracteres** (padrão é 6). Mantenha **"Confirm email" ligado** e **"Allow new users to sign up" desligado** (o usuário já existe; o hook continua barrando qualquer outro cadastro).
3. **Definir a senha** (você mesmo, no PowerShell, dentro da pasta do projeto, com o `.env.local` preenchido):

```
npm run definir:senha
```

   O script pede a senha duas vezes **sem mostrá-la**, confere 12 a 72 caracteres, exige que exista **exatamente 1 usuário** no projeto e que ele seja a conta autorizada, e chama `auth.admin.updateUserById` (só `password` e `email_confirm: true`). Não imprime a senha nem a chave, não grava arquivo e não usa argumento de comando. Use uma frase longa e única. Teclas de seta, Delete e Home são ignoradas (não entram na senha). Ctrl+C cancela sem alterar nada. O caminho do terminal foi testado em um console de verdade do Windows (ConPTY) com entradas fictícias: `npm run testar:senha-terminal` (10 cenários: ocultação, confirmação, cancelamento, Backspace, senha curta ou longa demais, setas, chave recusada e senha fraca).
4. Entrar por senha em `http://localhost:7100/login` e conferir, com o Claude, que o identificador do usuário e as demandas são os mesmos.
5. **Só depois de provado**, desligar o Google: painel, Authentication > Sign In / Providers > Google > desativar (não excluir o projeto do Google Cloud nem a credencial); (feito em 27/10/2026). O botão do Google já fica oculto por padrão, sem variável. Dá para reverter ligando o Google de novo e usando `DMANDA_LOGIN_GOOGLE=sim`.

**Recuperação de acesso (conta única).** Há dois caminhos, nenhum depende de e-mail:

- **Esqueci a senha:** com o `.env.local` deste projeto (ou com `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `DMANDA_EMAIL_AUTORIZADO` no ambiente), rodar de novo `npm run definir:senha`. Se o `.env.local` foi perdido, a chave secreta está em Project Settings > API Keys > Secret keys no painel do Supabase (a conta do painel é protegida pelo acesso do Supabase do usuário: guarde esse acesso e a recuperação dele em lugar seguro).
- **Sem o computador do projeto:** no painel do Supabase, Authentication > Users > o usuário > "Send password recovery" **não funciona hoje** (não há tela de redefinição no aplicativo). Use o primeiro caminho em qualquer computador com Node e o repositório.
- **Se perder também o acesso ao painel do Supabase:** a recuperação passa pelo suporte do Supabase com o e-mail dono da conta. O Google, enquanto ligado, é a porta reserva: por isso não o desligue antes de provar a senha e de guardar o acesso ao painel.
- Para trocar a conta autorizada, ver o comando da lista protegida acima.

**Limites a saber:**

- O Supabase Auth, no plano gratuito, **não** tem expiração por inatividade nem tempo máximo de sessão (planos pagos têm). Desde 29/10/2026 o Dmanda também **não** impõe nenhuma (ver "Sessão persistente").
- A senha trafega pelo HTTPS do Supabase e pela ação do servidor; o servidor só repassa. Se as redes do trabalho inspecionarem tráfego, use as mesmas cautelas de qualquer senha de trabalho.

## Sessão persistente (decisão 27, 29/10/2026)

**Problema que isto resolve:** a PWA instalada no iPhone pedia login ao ser aberta depois de horas. A causa era a regra antiga das 6 horas: um cookie próprio (`dmanda-ultimo-uso`) renovado só em navegações, cuja ausência ou idade maior que 6 h encerrava a sessão do Supabase mesmo válida. Essa regra foi **removida**; o cookie só é apagado dos navegadores onde ficou.

- **Quem mantém a sessão:** o Supabase Auth. O token de acesso (JWT, 1 hora no padrão do projeto) é renovado pelo **token de renovação**, que no plano gratuito não expira por inatividade. O `src/proxy.ts` confere a sessão com `getUser()` (pergunta ao Auth; detecta revogação) a cada pedido, deixa o SDK renovar quando preciso e **entrega os cookies renovados a três lugares**: `Set-Cookie` na resposta, `Set-Cookie` nos redirecionamentos e o pedido que segue para a página ou ação (senão a renderização tentaria renovar com um token já gasto e o Auth revogaria a sessão). As respostas que gravam cookies levam `Cache-Control: private, no-store`.
- **Durabilidade no iPhone e no iPad:** o Safari limita a 7 dias os cookies escritos por script (o navegador escreve os da primeira entrada). Por isso, depois de aceitar a senha, `concluirEntrada` (`src/servidor/entrar.ts`) **renova a sessão uma vez pelo servidor** (`refreshSession`; com os mesmos valores o SDK não regravaria o cookie), e o cookie passa a vir por `Set-Cookie` com validade de 400 dias.
- **Quando a sessão termina:** Sair (escopo local: só este navegador; as outras sessões continuam), revogação ou invalidação pelo Auth (token de renovação inexistente ou já usado, sessão apagada, senha trocada em outro lugar), ou conta que deixou de ser a autorizada. Nesses casos o `proxy` limpa os cookies deste navegador e leva a `/login?encerrada=1` (aviso neutro).
- **Falha de rede ao conferir a sessão:** o Auth fora do ar (5xx), limite de requisições ou conexão derrubada são **transitórios**: a sessão não é apagada e o acesso **não** é liberado. A página mostra "Não foi possível confirmar sua sessão agora" com o botão Tentar de novo (503); em uma ação, a tela mostra erro de conexão e o que foi digitado continua nos campos. A tela de login continua abrindo.
- **Não há senha guardada** nem login automático; o JWT não foi alongado (a duração de 1 hora fica como está, e a renovação é o mecanismo oficial).
- **O que o Supabase Free não oferece:** expiração por inatividade e tempo máximo de sessão são recursos pagos. Quem quiser uma sessão que acabe sozinha precisaria deles; não é a decisão do usuário (decisão 27).
- **Testes:** `npm run testar:sessao` (Auth falso que rotaciona e recusa o token de renovação já usado, revoga sessões individualmente e simula queda e erro 500) e `npm run testar:regras`. **Não validado ainda:** a renovação no Supabase real em horas reais, no iPhone real e no Safari real.

## Passo a passo do login Google (já feito em 25/10/2026; passa a ser transitório)

O Google continua ligado enquanto a entrada por senha não é provada. Depois, ver o passo 5 de "Entrada por e-mail e senha". Este passo a passo fica como histórico e para religar o Google se for preciso.

A ordem importa: faça o Google Cloud primeiro, depois o painel do Supabase. Não envie o Client Secret nem a chave secreta no chat.

**1. Google Cloud** (`https://console.cloud.google.com`, com a conta do Secretário):
1. Crie ou escolha um projeto (por exemplo, "Dmanda").
2. Menu "APIs e serviços" > "Tela de permissão OAuth" (ou "Google Auth Platform"): tipo de usuário **Externo**; nome do app "Dmanda"; e-mail de suporte e de contato: o seu.
3. Público-alvo: deixe em **Teste** e, em "Usuários de teste", adicione a conta autorizada. Escopos: apenas os básicos (`openid`, e-mail e perfil). **Não** habilite Calendar nem Drive agora.
4. "Credenciais" > "Criar credenciais" > "ID do cliente OAuth" > tipo **Aplicativo da Web**:
   - **Origens JavaScript autorizadas:** `http://localhost:7100`
   - **URIs de redirecionamento autorizados:** `https://gmxoosvgfcydccyeudej.supabase.co/auth/v1/callback`
5. Copie o **ID do cliente** e a **chave secreta** (só para colar no passo 2).

**2. Painel do Supabase** (`https://supabase.com/dashboard/project/gmxoosvgfcydccyeudej`). **A ordem importa: o hook vem antes do provedor Google**, para que nenhum cadastro aconteça sem a trava.
1. **Authentication > Auth Hooks** (ou "Hooks"): "Add a new hook" > **Before User Created** > tipo **Postgres function** > esquema `public`, função `hook_antes_criar_usuario` > crie e **ative**. O painel concede sozinho a execução ao papel do Auth.
2. **Avise o assistente.** Ele confere a ativação pela CLI, em leitura, antes de você prosseguir (`config pull` numa pasta temporária; `[auth.hook.before_user_created]` deve aparecer com `enabled = true` e `uri = "pg-functions://postgres/public/hook_antes_criar_usuario"`).
3. **Authentication > Sign In / Providers > Google:** ative, cole o ID do cliente e a chave secreta, deixe "Skip nonce checks" desligado e salve.
4. Na época, o provedor Email ficou **desligado**; agora ele é ligado conforme "Entrada por e-mail e senha". Mantenha o acesso anônimo desligado. Mantenha "Allow new users to sign up" **ligado até o seu primeiro login**; o hook já impede cadastros de outras contas.
5. **Authentication > URL Configuration:** "Site URL" = `http://localhost:7100`; em "Redirect URLs" adicione `http://localhost:7100/auth/callback`. (O retorno do Google para o Supabase é o endereço `.../auth/v1/callback` do passo anterior; o retorno do Supabase para o aplicativo é `/auth/callback` na porta 7100. São duas coisas diferentes.)
6. **Project Settings > API Keys > Secret keys > "default":** revele e copie a chave (começa com `sb_secret_`). Cole no `.env.local`, na linha `SUPABASE_SERVICE_ROLE_KEY=` (sem aspas), e salve. Ver "Chave secreta" abaixo.

**3. Depois, no terminal da sessão:** pare o servidor de teste e rode `npm run dev`; o assistente então valida com você o primeiro login, o segundo acesso e a rejeição de outra conta. Depois do primeiro login bem-sucedido, em Authentication > Sign In / Providers, desligue "Allow new users to sign up" (proteção extra).

## Chave secreta (`sb_secret_...`) e o que o papel de serviço pode

- **Formato:** a chave nova do Supabase **não é um JWT** (começa com `sb_secret_`). O código a trata como texto opaco: `src/servidor/banco.ts` só a repassa a `createClient` do `@supabase/supabase-js` (versão instalada 2.118, que reconhece o prefixo e a envia no cabeçalho `apikey`). Nada no código a decodifica nem a valida como JWT. O nome da variável continua `SUPABASE_SERVICE_ROLE_KEY` (a chave "default" mapeia para o papel `service_role`). Chaves antigas no formato JWT (`eyJ...`) também funcionariam, mas não são necessárias.
- **Onde fica:** só no servidor (`.env.local` e, depois, variáveis da Vercel). Nunca em `NEXT_PUBLIC`, nunca no navegador, no Git, em Issues ou no chat.
- **Restrição real no banco (conferida no banco real em 25/10/2026, por `has_table_privilege` e `has_function_privilege`):** `service_role` tem `BYPASSRLS`, não faz login direto no Postgres, **não** tem select, insert, update nem delete em nenhuma tabela de `public`, **não** tem uso do esquema `dmanda_privado` e só executa duas funções: `rotina_diaria()` e `registrar_falha_rotina(text)`. Pela Data API (PostgREST), portanto, a chave só consegue chamar essas duas funções. Isso é restrição de privilégio, não apenas "a rota só chama essas duas".
- **O que os GRANTs não restringem:** (1) `service_role` mantém `TRUNCATE`, `REFERENCES` e `TRIGGER` nas tabelas por padrão da plataforma, mas a Data API não expõe esses comandos e o papel não faz login direto; (2) a chave secreta vale também para as APIs administrativas do próprio Supabase (por exemplo, a administração de usuários do Auth), que não dependem dos GRANTs do nosso esquema. Por isso a chave é tratada como credencial de administração: só no servidor, rotacionável no painel, e nunca exposta. Se for desejado, uma migração nova pode retirar `TRUNCATE`, `REFERENCES` e `TRIGGER` do papel; não foi feita por não alterar o alcance da Data API.

## Validação feita no Supabase real (25/10/2026)

Feita com a CLI, como **SQL no banco real com contextos de autenticação simulados** (JWTs simulados em transações sempre desfeitas). **Não comprova o login Google real**, nem o hook ativo no painel:

- Esquema remoto antes: vazio (sem tabelas, sem usuários, sem migrações). Depois: 5 migrações registradas, 4 tabelas com RLS, 1 tabela privada com RLS e sem política.
- Security Advisor: sem problemas.
- Conta autorizada (Google): criou demanda, adicionou tarefa (Cadastro vai para Vistos), moveu etapa, salvou com tarefas, concluiu (todas as tarefas marcadas), reabriu mantendo as tarefas e leu o estado da rotina.
- Outra conta, mesmo com sessão válida: vê zero demandas, não grava, não cria, não move demanda alheia (RLS).
- Mesma conta por outro provedor: vê zero.
- Visitante (anon): sem acesso a funções, tabelas nem à lista protegida.
- Usuário logado: não executa a rotina nem lê a lista protegida.
- Papel de serviço: pelos GRANTs, executa só a rotina e o registro de falha e não lê nem grava as tabelas diretamente (ver "Chave secreta" para o que os GRANTs não cobrem). Gravou o resumo e a execução.
- Hook: libera a conta autorizada pelo Google; recusa (403) outra conta, a mesma conta por e-mail e senha, anônimo e sem e-mail; só o papel do Auth o executa.
- Nenhum dado de teste ficou no banco (0 usuários, 0 demandas, 0 execuções depois).

**Validado depois, com login Google real (25/10/2026, Issue #1):** primeiro login (1 usuário, identidade Google); pela interface, na sessão real e com registros TESTE já excluídos: cadastro, edição, tarefas, mudança de etapa, conclusão, reabertura, exclusão, persistência ao recarregar e as quatro visões consistentes, tudo conferido por leitura do banco; chamada HTTP local da rotina com a chave de serviço (200, execução e resumo gravados).

**Ainda não validado no Supabase real:** renovação da sessão por horas reais, restauração da cópia, produção na Vercel e agendamento. (Em 26/10/2026 foram validados: migrações 6 e 7, entrada por senha no mesmo usuário, saída e nova entrada, recusa de credenciais inválidas e de outras contas, gravação de demanda com tarefas e a proteção de edição simultânea. O botão Sair existe no menu do avatar.) Esta lista não muda por causa dos testes locais abaixo.

**Auditoria de 26/10/2026 (computador do trabalho, sem credenciais do Supabase):** verificações em banco local e em Auth **falso**, todas identificadas como tais: banco 90, regras 25, aplicação 64, sessão e senha 57 (ver `AUDITORIA.md`). Não houve acesso ao Supabase real neste computador (sem `.env.local` e sem login da CLI).

## Rotina diária na nuvem

- **O que faz:** consulta prazos e acompanhamentos, grava um resumo operacional **datado** (`resumos_operacionais`, com contagens e identificadores, sem texto das demandas) e registra a execução (`execucoes_rotina`). Só **lê** as demandas: não conclui, não altera prazos e não inventa dados.
- **Datas:** as datas originais (`prazo`, `acompanhar_em`) são a fonte de verdade. Dias restantes são derivados delas com a data de hoje em America/Sao_Paulo, na tela e na rotina. O resumo guarda a data de referência e é recalculado quando uma demanda muda. A tela não depende do resumo, então os prazos continuam corretos mesmo se o agendamento atrasar ou falhar.
- **Falhas e repetição:** repetir no mesmo dia mantém um único resumo (idempotente). Se um dia for perdido, o seguinte recalcula tudo pelas datas. A falha é registrada (mensagem curta, sem dado pessoal) e o Início mostra, sem alarme, a última execução e a última falha.
- **Segurança:** a rota `GET /api/cron/diaria` só responde com `Authorization: Bearer <CRON_SECRET>` (401 sem ele, 503 se o segredo não estiver configurado, 500 se faltar a chave de serviço). Não usa sessão Google, não renova o "último uso" e a resposta traz só a data e uma contagem. No banco, `rotina_diaria` e `registrar_falha_rotina` só podem ser executadas pelo papel de serviço (conferido no banco real).
- **Agendamento:** `vercel.json` define uma chamada por dia às 09:00 UTC (06:00 em Brasília). A Vercel usa sempre UTC.
- **Plano da Vercel (conferido na documentação em 25/10/2026):** o plano Hobby permite cron **uma vez por dia**, com precisão de hora (pode rodar entre 06:00 e 06:59), e é restrito a **uso pessoal e não comercial** (a Vercel define uso comercial como projeto de que alguém ganhe dinheiro, **incluindo um funcionário pago que escreva o código**). Cron só roda no deployment de **produção**, não em Preview, e não tem retentativa nem garantia de entrega única. **Decisão do usuário (27/10/2026):** o Dmanda roda no Hobby, sem contratação; a regra e o efeito estão em "Planos gratuitos", mais abaixo.
- **Supabase gratuito:** projetos de baixa atividade podem ser **pausados** (a documentação fala em 7 dias). Uma chamada diária **não garante** que o projeto nunca pause. O plano Pro evita a pausa, mas não foi contratado.
- **Em quatro níveis:**
  1. Código preparado: **sim**.
  2. Função validada no banco real, como papel de serviço, dentro de transação desfeita: **sim**. Chamada HTTP da rota contra o banco real, em `localhost:7100` (não é produção): 401 sem segredo, 401 com segredo errado e 200 com o segredo correto, execução e resumo gravados (25/10/2026).
  3. Agendamento implantado na Vercel: **não**.
  4. Primeira execução automática observada: **não**.

## Cópia dos dados e restauração

O GitHub guarda **código e migrações**, não os dados. Os registros reais ficam só no Supabase e **nunca** vão para o repositório (o `.gitignore` ignora `dmanda-copia-*.json`). O plano gratuito **não tem os backups gerenciados** dos planos pagos; o que existe é a exportação própria abaixo. **Isto ainda não é um backup completo nem automático.** Situação por parte (27/10/2026):

| Parte | Situação |
|---|---|
| Exportação disponível | **Sim.** Menu do avatar > **Baixar cópia dos dados** gera `dmanda-copia-AAAA-MM-DD.json` (`GET /api/exportar`, só com a sessão da conta autorizada, sem cache). Conferida em teste local; no Supabase real foi baixada com demandas e tarefas na prova de 26/10/2026 |
| Recuperação demonstrada | **Só em banco local de teste**, com dados fictícios (`supabase/restaurar-copia.sql`, 12 verificações no `testar:banco`, mais a conferência do `testar:app` de que o arquivo que a rota real entrega é aceito). **Nunca restaurada em projeto Supabase real** |
| Armazenamento externo | **Não configurado.** O destino privado será definido pelo usuário. Até lá, nada é enviado a Drive, OneDrive, GitHub ou outro serviço |
| Execução automática | **Não configurada.** Hoje a cópia é manual (um clique). A rotina diária da Vercel não faz cópia: ela só grava o resumo operacional |

### O que a cópia contém e o que fica fora

- **Contém:** `formato: "dmanda-exportacao"`, `versao: 3` (desde 30/10/2026; as cópias `versao: 2` e `versao: 1` continuam aceitas na restauração: o prazo das antigas vira a referência original, marcada como legado), `exportado_em`, `fuso`, e cinco listas, `demandas` (ativas), `arquivadas`, `dias_indisponiveis` (feriados e eventos externos de dia inteiro cadastrados em Configurações), `entradas` (anotações ativas) e `entradas_arquivadas` (arquivadas e as que já viraram demanda, com `demanda_id`). Cada demanda também traz o prazo original, o vencimento ajustado e a explicação do ajuste. Cada demanda traz todos os campos (identificador, tipo, área, número, assunto, descrição, origem, etapa, datas de chegada, prazo, tipo de prazo, setor, acompanhamento, conclusão, arquivamento, criação e última alteração) e suas `tarefas` (identificador, texto, concluída, posição).
- **Fica fora:** a conta e a senha (Supabase Auth), a lista de acesso, as migrações, as configurações do painel (provedores, cadastro público, hook), as variáveis de ambiente, as preferências do navegador (tema, visão, filtros, rascunhos não salvos), os resumos e o registro da rotina diária (a rotina recalcula) e a data de criação de cada tarefa. Por isso a cópia sozinha não recria o projeto: primeiro as migrações, a conta e o painel, depois os dados.

### Como verificar se o arquivo foi gerado corretamente

Ele deve ser um JSON válido, com `formato` e `versao` certos e contagens iguais às da aplicação. No PowerShell, na pasta do projeto, trocando o nome do arquivo (o comando não mostra nenhum conteúdo, só números):

```
node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const t=l=>l.reduce((s,d)=>s+(d.tarefas||[]).length,0);console.log(j.formato,j.versao,'| demandas',j.demandas.length,'| arquivadas',j.arquivadas.length,'| tarefas',t(j.demandas)+t(j.arquivadas))" dmanda-copia-AAAA-MM-DD.json
```

Esperado: `dmanda-exportacao 1`, e `demandas` e `arquivadas` iguais ao que aparece em Demandas e em Arquivo. Se o comando der erro, o arquivo está incompleto: baixe de novo. Se a aplicação disser "Não foi possível gerar a cópia agora", nada foi baixado.

### Como recuperar os dados

`supabase/restaurar-copia.sql`, em transação única. Passo a passo:

1. Garanta o projeto pronto: migrações aplicadas e o usuário existente (para um projeto novo, ver "Passo a passo do login Google" e "Entrada por e-mail e senha").
2. Abra o `.json` da cópia em um editor de texto e copie todo o conteúdo.
3. Abra `supabase/restaurar-copia.sql`, troque a palavra marcadora `COLE_AQUI_O_JSON` (com dois sublinhados de cada lado, na linha `j jsonb := ...`) pelo conteúdo copiado, mantendo as marcas `$dmanda$`.
4. No **SQL Editor** do painel do Supabase do projeto, cole o arquivo inteiro e execute. Não salve o arquivo editado no repositório (ele passa a ter dados reais).
5. Confira: `select count(*) from public.demandas;` e `select count(*) from public.tarefas;` e compare com a verificação acima.

Garantias do restaurador (testadas no `testar:banco`): tudo em uma transação (se algo estiver errado, nada é gravado); atribui tudo ao único usuário do projeto (e recusa se não houver exatamente 1); rodar duas vezes não duplica; uma demanda que já existe com o mesmo identificador não é sobrescrita nem recebe tarefas de volta; após apagar tudo no mesmo projeto, a cópia devolve demandas e tarefas idênticas (campos, datas, etapas, ordem das tarefas, acentos e aspas). A restauração preserva a `versao` da cópia (migração 7) e religa o gatilho dentro da transação. **Não restaure por cima de um banco em uso:** use um projeto novo ou vazio.

### O que já foi provado e o que falta

| Prova | Estado |
|---|---|
| Exportação gera o formato esperado | feita em teste local e no Supabase real (26/10/2026) |
| Restauração em banco local: projeto novo com outro identificador de usuário, perda total no mesmo projeto, repetição, demanda existente preservada, formato errado, zero ou dois usuários, tarefa inválida, acentos e aspas | feita (banco de teste, dados fictícios). O mecanismo não mudou desde a migração 7 |
| Restauração em projeto Supabase real | **falta.** Exige um projeto descartável (o plano gratuito permite criar outro) ou autorização para uma demonstração com dados TESTE |
| Destino privado das cópias | **falta** (decisão do usuário) |
| Cópia automática | **falta** (depende do destino) |
| Tela de importar | não existe, adiada de propósito |

### Orientação simples para o uso

- **Quando:** uma vez por dia em que usar o Dmanda (ao terminar) e **antes de qualquer migração relevante** (por exemplo antes de `db push`).
- **Como:** avatar > Baixar cópia dos dados; rode a verificação acima. Guarde as últimas 7 cópias e apague as mais antigas.
- **Onde, enquanto o destino não estiver definido:** só na pasta de Downloads deste computador, **nunca** dentro da pasta do projeto, do Git, de Issues ou de serviços de nuvem. Quando o destino privado for definido, mover os arquivos para lá.
- Como o plano gratuito pode pausar um projeto sem uso, a exportação também protege contra isso.

### Edição simultânea (protegida desde 26/10/2026, migração 7)

Cada demanda tem uma `versao`. Se a mesma demanda for alterada em outro aparelho ou janela depois que a janela de edição foi aberta, salvar é **recusado por inteiro** (código `DM409`, nada é gravado, nem campos nem tarefas) e a janela mostra um aviso fixo; o que foi digitado continua nos campos para copiar e Salvar fica bloqueado. Feche a janela e reabra para ver a versão atual. Não há tela de mesclagem. Alcance: o salvamento da janela de edição. As operações pontuais (mover de etapa, marcar uma tarefa, arquivar) seguem "último a gravar vence" por campo. Cada aparelho só vê a mudança do outro ao recarregar ou ao voltar à tela.

## Publicação na Vercel (preparo; nada foi publicado nem contratado)

**Estado do código:** `npm run build` passa; em produção local (`next start`) conferidos: `/login`, `/manifest.webmanifest`, ícones e `/apple-icon.png` públicos; qualquer outra página, `/marca`, `/pecas`, `/tokens` e `/api/exportar` redirecionam ao login sem sessão; `/api/cron/diaria` responde 401 sem o segredo; `DMANDA_BANCO=teste` em produção derruba as páginas com erro 500 (o modo de teste é recusado, não ignorado).

**Variáveis (Vercel, ambiente Produção apenas; nunca em Preview, para previews não tocarem o banco real):**

| Variável | Valor | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | endereço do projeto | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publishable | pública, vale só com RLS e login |
| `DMANDA_EMAIL_AUTORIZADO` | e-mail da conta | servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `sb_secret_` | servidor; marcar como sensível |
| `CRON_SECRET` | 16 ou mais caracteres | servidor; a Vercel o envia ao cron |
| `DMANDA_LOGIN_GOOGLE` | **não definir** (botão do Google oculto por padrão) | opcional; só `sim` mostra o botão |
| `DMANDA_BANCO` | **não definir** | recusado em produção |

**URLs:** com o login por senha **não há redirecionamento de volta**, então Site URL e Redirect URLs do Supabase deixam de importar para entrar. Se o Google continuar ligado, acrescente o endereço de produção em Authentication > URL Configuration (Site URL e `/auth/callback`) e em "Origens JavaScript autorizadas" do cliente OAuth no Google Cloud. Os endereços de localhost continuam.

**Publicação pela `main` (decisão 25, 27/10/2026; substitui a antiga separação por branch `producao`, removida):** a `main` é a única branch de trabalho e de publicação. O `vercel.json` desliga a implantação automática de todas as outras (`"**": false`, `"main": true`), então só a `main` publica; branches com outros nomes, inclusive com barras (`claude/...`), não. **Cada envio à `main` publica o painel real**, inclusive os que só mudam documentação, então só se envia o que foi verificado. Região das funções: `gru1` (São Paulo), junto do Supabase, também no `vercel.json` (o Hobby aceita uma região, o Pro aceita cinco). O padrão foi testado com minimatch (a biblioteca que a Vercel documenta; versão local 3.1.5): só `main` implanta.

**Rotina diária:** `vercel.json` agenda `GET /api/cron/diaria` às 09:00 UTC (06:00 em Brasília); só roda no deployment de **Produção** e só com `CRON_SECRET`. A Vercel não segue redirecionamentos, não repete a chamada se ela falhar e entrega em "melhor esforço" (pode falhar ou, raramente, duplicar); a rotina recalcula a partir das datas originais, então uma falta ou repetição se corrige na execução seguinte. No Hobby a chamada pode ocorrer a qualquer minuto da hora marcada (06:00 a 06:59 em Brasília); no Pro, no minuto marcado. A primeira execução automática só pode ser observada depois da publicação (a tela do Início mostra a última execução). Disparo manual de teste depois do deploy: o Claude chama a rota com o `CRON_SECRET` (lido do `.env.local` sem exibir) ou, pela CLI da Vercel, `vercel crons run /api/cron/diaria` (beta, só acha a rotina em produção já implantada).

### Planos gratuitos: Vercel Hobby e Supabase Free (decisão do usuário, 27/10/2026)

**Decisão:** o projeto roda no **Vercel Hobby** e no **Supabase Free**. Nada pago é contratado, nem teste pago, e o Pro não é decisão presumida. A restrição financeira é essa. A recomendação anterior de Pro (feita no mesmo dia, antes dessa decisão) está superada; a leitura da regra abaixo fica registrada como fato, não como pendência que bloqueie a publicação.

**Regra do Hobby (Fair Use Guidelines da Vercel, lida em 27/10/2026):** "Hobby teams are restricted to non-commercial personal use only." Uso comercial é "any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project, including a paid employee or consultant writing the code". A página não diz se o uso de um servidor público na própria função, sem receita nem público externo, conta como ganho financeiro. **Efeito específico se a Vercel entender que conta:** conta ou deployment pausado, o que derrubaria o painel e a rotina diária. **Mitigação gratuita:** os dados continuam no Supabase e a cópia em arquivo (menu da conta) permite recomeçar em outro lugar; pergunta opcional ao suporte (https://vercel.com/help), que não bloqueia nada: "I am a salaried public employee. I host a private, single-user, login-protected web app for my own work tasks. No ads, no sales, no payments, no public users. Does this fit Hobby's non-commercial personal use rule?"

**Limites conferidos que NÃO atrapalham o Dmanda (documentação da Vercel, `docs/limits`, 16/09/2026):** funções de até 300 s (a maior operação do app dura menos de 2 s); 100 implantações por dia e por hora; rotina agendada uma vez por dia (o Dmanda usa uma); o repositório `edermoliveira/Dmanda` pertence a uma conta pessoal (o Hobby não conecta repositórios de organizações do GitHub); 100 GB de transferência e 1 milhão de invocações por mês são muito mais do que um usuário consome. **Limites que mudam o jeito de operar:** a rotina roda em qualquer minuto da hora marcada (06:00 a 06:59 em Brasília), sem importar para um resumo diário; os registros de execução da Vercel ficam só 1 hora, então a prova da rotina é a linha "Rotina diária na nuvem: última execução em..." do Início (vem da tabela `execucoes_rotina` do banco), não o painel da Vercel; uma região de funções (`gru1`, já configurada).

**Limites do Supabase Free que importam (documentação do Supabase, lida em 27/10/2026):** (1) "We may pause applications on the Free Plan that exhibit low activity in a 7-day period to save on server resources" (`supabase.com/docs/guides/platform/going-into-prod`). **Efeito específico:** depois de uma semana sem uso, o projeto pode ser pausado e o painel mostra erro até ele ser reativado no painel do Supabase (Restore project). A rotina diária chama o banco todo dia, o que provavelmente conta como atividade, mas a documentação não promete isso. Aviso útil: antes de uma ausência longa, abrir o app. (2) "Database backups are not available for download for Free Plan projects." **Efeito específico:** não há backup do Supabase para baixar, então a **cópia dos dados em arquivo (menu da conta) é o único backup**; o destino e a rotina de guardá-la seguem na Issue #4. (3) 500 MB de banco e 5 GB de tráfego por projeto, muito acima do uso (demandas são texto).

**Estado em 28/10/2026:** os passos 1 a 4 abaixo foram feitos pelo usuário (https://dmanda-adm.vercel.app, projeto `dmanda`, `main`, Production, `gru1`). O que resta é o passo 5 e a conferência autenticada; a lista atual de pendências está em `CONTINUIDADE-DMANDA.md`, seções E e F.

**Ações exatas para publicar (suas, no plano Hobby):**
1. https://vercel.com: criar a conta **Hobby** (gratuita) entrando com a conta do GitHub. Na autorização do aplicativo da Vercel no GitHub, escolher **Only select repositories** e marcar só `edermoliveira/Dmanda`. Não aceitar nenhum upgrade nem período de teste.
2. Add New > Project > importar `edermoliveira/Dmanda` pela **`main`**, na equipe EDER (Hobby), com o nome de projeto `dmanda`. Framework Next.js (automático). Cadastrar as cinco variáveis da tabela acima **somente em Production** (sem Preview nem Development), marcar `SUPABASE_SERVICE_ROLE_KEY` como sensível, e clicar em Deploy. A primeira implantação já é a publicação real da `main` verificada; não é descartável e não se cria projeto paralelo.
3. Settings > Environments > Production: a Branch Tracking já vem como `main`; só conferir. Não aceitar upgrade nem teste pago.
4. Avisar o Claude com o endereço (algo como `dmanda-xxxx.vercel.app`). O Claude confere o publicado (commit e branch, rotas, manifesto, região, cron, logs) e, depois da sua entrada, o banco.
5. Entrar pelo endereço publicado com e-mail e senha. No dia seguinte, conferir no Início a última execução da rotina diária.

**Conferência depois da publicação (feita pelo Claude; a parte sem sessão foi observada em 28/10/2026 no endereço publicado e a parte autenticada continua pendente, ver `CONTINUIDADE-DMANDA.md`):** sem sessão, `/login`, `/manifest.webmanifest`, `/icon.svg` e `/apple-icon.png` respondem 200; `/demandas`, `/marca` e `/api/exportar` redirecionam ao login; `/api/cron/diaria` responde 401 sem segredo e com segredo errado; cabeçalhos de segurança presentes (o mesmo roteiro passou em `npm run start` local em 27/10/2026). Depois da sua entrada: nova sessão no banco real, uma demanda TESTE criada pelo endereço publicado e removida, chamada manual da rotina (200 e linha em `execucoes_rotina`), cron registrado no painel (Settings > Cron Jobs) e região `gru1` no resumo do deployment. Em seguida, instalar a PWA e avaliar (Issue #2).

**Instalação no aparelho (PWA):** iPhone/iPad: Safari > Compartilhar > Adicionar à Tela de Início; computador: ícone de instalar na barra do Edge ou Chrome. A PWA **só abre online**: não há service worker, cache de dados nem edição offline. Sem internet o painel mostra a faixa "Sem conexão" e as gravações falham com aviso claro; abrir o app sem internet mostra a tela de erro do navegador.

## Teste local sem Supabase

`npm run dev:teste` usa o banco local descartável (`.dados-teste/`, não vai para o Git). As migrações novas são aplicadas sozinhas a um banco de teste já existente. Testes: `npm run testar:banco` (118), `testar:regras` (25), `testar:app` (69), `testar:sessao` (57, Auth falso). Eles **não** substituem a validação no Supabase real.

## Migração 9: prazos legados abertos (29/10/2026)

`20261029000100_normalizar_prazos_legados.sql` só mexe em dados: nas demandas não finalizadas com prazo legado, o vencimento efetivo (`prazo`) passa a seguir o calendário do próprio usuário; `prazo_original` e `prazo_legado` ficam. Finalizadas e quem já está num dia disponível não mudam. Reaplicar é inofensivo. Aplicada com `npx supabase db push --linked --dry-run` e depois sem `--dry-run`, sem reset. Depois de **restaurar uma cópia da versão 1** (`restaurar-copia.sql`), rode de novo o conteúdo desta migração com `npx supabase db query --linked -f supabase/migrations/20261029000100_normalizar_prazos_legados.sql`.

## Migração 10: Entradas (30/10/2026)

`20261030000000_entradas.sql` é **aditiva**: cria a tabela `entradas` (RLS por usuário, privilégios só de select, insert, update e delete para o usuário logado, sem acesso do visitante nem do papel de serviço), o índice único `entradas_demanda_unica` (uma demanda nasce de no máximo uma anotação), gatilhos de data e de versão (reaproveita `subir_versao_demanda`), as funções `listar_entradas`, `buscar_entrada`, `criar_entrada`, `salvar_entrada` (com versão, recusa `DM409`), `fixar_entrada`, `arquivar_entrada`, `desarquivar_entrada`, `excluir_entrada` e `criar_demanda_de_entrada` (cria a demanda e liga a anotação na mesma transação, idempotente pelo identificador da demanda), além do campo `entrada_id` na leitura da demanda (`demanda_json`, redefinida com `create or replace`, privilégios mantidos). Nenhuma coluna existente muda e nenhum dado é reescrito.

- **Estados:** ativa (sem arquivamento e sem demanda), arquivada e convertida (tem `demanda_id`, imutável). Excluir a demanda de vez solta o vínculo (`on delete set null`) e a anotação volta a Entradas.
- **Aplicação:** `npx supabase db push --linked --dry-run` e depois `npx supabase db push --linked` (feito em 30/10/2026). Conferência depois: `migration list` com 10 de 10, contagens iguais, `db advisors --linked` só com o aviso conhecido de senhas vazadas, e prova com a conta autorizada em transação desfeita (criar entrada e converter em demanda, nada sobra).
- **Restauração:** `supabase/restaurar-copia.sql` aceita as versões 1, 2 e 3; as entradas voltam com a versão e as datas da cópia e o vínculo só é refeito se a demanda existe no projeto (senão a anotação volta ativa, com o conteúdo original). Não restaure por cima de um banco em uso.
- **Compatibilidade:** a versão do código publicada antes da migração (`2714937`) continua funcionando com ela aplicada, porque a migração só acrescenta. O inverso não vale: o código novo chama as funções de Entradas, então a migração precisa estar aplicada antes de publicar.

## Migração 11: cinco cores em Entradas (30/10/2026)

`20261030000100_entradas_cinco_cores.sql`: redefine só `cor_entrada_automatica` (sorteio de 0 a 4). Aditiva: não altera dados nem a restrição da tabela (0 a 5), então notas antigas com a cor 5 e cópias anteriores continuam válidas. Aplicada com dry-run em 30/10/2026; contagens e resumo das entradas idênticos antes e depois.

## Migração 12: conta autorizada na RLS de Entradas e dos dias indisponíveis (revisão de 30/10/2026)

`20261030000200_rls_conta_autorizada_entradas_dias.sql`: troca só as políticas `entradas_dono` e `dias_indisponiveis_dono` para também exigirem `dmanda_privado.conta_autorizada()`, como a migração 4 já fazia em demandas, tarefas e rotina (a terceira camada de acesso valia só para parte dos dados). Não toca em dados. **Criada e provada no banco de teste; ainda NÃO aplicada no Supabase real** (aguarda autorização). Quando aplicar: `npx supabase db push --linked --dry-run`, depois sem `--dry-run`, e conferir contagens e `db push --dry-run` em dia.

## Migração 13: tarefa com a identidade da tentativa (30/10/2026)

`20261030000300_tarefa_idempotente.sql`: `adicionar_tarefa(p_demanda, p_texto, p_id default null)`. O aplicativo gera o identificador ao começar a tentativa e o reaproveita enquanto o texto digitado for o mesmo; se a tarefa foi gravada mas a resposta se perdeu, repetir devolve a tarefa que já existe em vez de criar outra. O banco **nunca** deduplica pelo conteúdo (tarefas diferentes podem ter o mesmo texto) e a mesma identidade em outra demanda é recusada. Remove a assinatura antiga de duas entradas (duas assinaturas com parâmetro opcional deixariam a chamada ambígua para a API), refaz os privilégios (só o usuário logado) e não toca em dados. **Criada e provada no banco de teste; ainda NÃO aplicada no Supabase real.** O código novo do aplicativo **sempre** envia `p_id` ao adicionar tarefa: sem a migração 13 no banco, adicionar tarefa falharia. **Aplicar a migração 13 antes (ou junto) da publicação do código.** Ordem recomendada para a autorização única: dry-run, aplicar as migrações 12 e 13, conferir contagens e o dry-run em dia, e só então o push.
