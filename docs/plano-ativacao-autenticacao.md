# Plano de ativação da autenticação, dos acessos e dos rascunhos online (decisão 92)

Estado: **só implementado e testado localmente** (banco de teste PGlite e Auth fictício). Nada deste plano foi executado no Supabase real, na Vercel ou no GitHub, e nenhuma chave foi rotacionada. Cada etapa exige a autorização expressa do Éder. Em cada passo está dito quem executa: **você (Éder)** ou **o assistente, com a sua autorização**.

## 0. Por que a ativação tem etapas, e o que é compatível com o quê

O código local troca a entrada aberta (`executar_como_titular`, chamada com a chave de serviço) pelo JWT de cada usuário. O código **publicado hoje** (`origin/main` = `085c03c8`) ainda usa a entrada aberta.

| Peça | Compatível com o código publicado? | Observação |
|---|---|---|
| Migrações `20261122000000`, `…0100`, `…0150`, `…0300` (aditivas) | **Sim** | a entrada aberta assume a conta administradora, que fica autorizada; nada muda para ela. **Pré-condição:** a conta da administradora existir em `auth.users` com o e-mail confirmado (é a conta antiga, dona dos dados). Sem ela, a entrada aberta já não encontraria titular |
| Código novo (push da `main`) | precisa das 4 migrações aplicadas antes | chama `estado_acesso`, `listar_rascunhos`, `consumir_etapa_senha` e outras que só existem depois delas |
| Fechamento `supabase/pendentes/20261122000200_fechar_acesso_aberto.sql` | **Não** (remove o que o código publicado usa) | só depois do código novo no ar e conferido |

Ordem obrigatória: **A** migrações, **B** bootstrap da administradora, **C** conferência local contra o serviço real, **D** publicação, **E** conferência no ar, **F** fechamento do acesso aberto.

## 1. Configurações exatas do Supabase (você, no painel do projeto Dmanda)

Os nomes são os do painel em novembro de 2026; se algum rótulo mudar, vale a função descrita.

**Authentication > Sign In / Providers**
- "Allow new users to sign up": **desligado** (o cadastro público fica fechado também no Auth; o hook do banco recusa de qualquer forma).
- Provedor **Email**: ligado. "Confirm email": **ligado**. "Secure email change": **ligado**. **"Secure password change": ligado** (o Auth passa a exigir reautenticação para trocar a senha de uma sessão criada há mais de 24 horas; é a proteção do próprio provedor contra uma sessão antiga tentando trocar a senha direto na API).
- "Minimum password length": **10** (o aplicativo também exige 10). "Password requirements": letras e números (opcional; o aplicativo não depende disso).
- "Email OTP Expiration": **86400** segundos (24 h), que é a validade do link de convite e de recuperação (o mesmo ajuste vale para os dois).
- **Google e todos os outros provedores: desligados.**

**Authentication > URL Configuration** e variável `DMANDA_URL_PUBLICA` (três valores diferentes, que precisam bater)

| Onde | Valor exato | Para que serve |
|---|---|---|
| Site URL (painel do Auth) | `https://dmanda-adm.vercel.app` | é o `{{ .SiteURL }}` dos modelos de e-mail: a base dos links de convite e de recuperação. **Sem barra no fim** (com barra, o link sairia `…app//auth/confirmar`) |
| Redirect URLs (painel do Auth, lista de permitidos) | `https://dmanda-adm.vercel.app/auth/confirmar` | o endereço que o código manda como `redirectTo` no convite (`src/servidor/acessos.ts`) e no bootstrap; o Auth só aceita destinos desta lista |
| `DMANDA_URL_PUBLICA` (Vercel e `.env.local`) | `https://dmanda-adm.vercel.app` | só a ORIGEM, sem caminho e sem barra: o código valida (`^https?://host$`), tira barras finais e acrescenta `/auth/confirmar`, então não há caminho repetido |

**Authentication > Emails > Templates** (só estes dois são usados; os demais ficam como estão)
- **Invite user**: trocar o link padrão `{{ .ConfirmationURL }}` por `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite`.
- **Reset password**: trocar `{{ .ConfirmationURL }}` por `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery`.
- Links completos que chegam por e-mail, com esses valores: convite `https://dmanda-adm.vercel.app/auth/confirmar?token_hash=<código>&type=invite`; recuperação `https://dmanda-adm.vercel.app/auth/confirmar?token_hash=<código>&type=recovery`.
- **Não manter `{{ .ConfirmationURL }}`**: o padrão passa pelo endereço do Auth e devolve a sessão no fragmento da URL, um caminho que o aplicativo não aceita (ele exige `token_hash` e confirma no servidor).
- O tipo de cada modelo é fixo (`invite` no convite, `recovery` na recuperação): a tela `/auth/confirmar` só aceita esses dois, e o Auth recusa um `token_hash` apresentado com o tipo trocado. O link só é consumido quando a pessoa toca em **Continuar** (um leitor automático de e-mail que abre o endereço não gasta o link de uso único).
- A recuperação pedida pela tela "Esqueci a senha" não envia `redirectTo` (o link vem só do modelo, pela Site URL); o convite e o bootstrap enviam `https://dmanda-adm.vercel.app/auth/confirmar`, que está na lista de permitidos. Nos dois casos o endereço final é o mesmo.

**Authentication > Emails > SMTP Settings** (dependência externa; nada foi contratado)
- O serviço de e-mail padrão do Supabase só entrega a quem é membro da organização do projeto e tem limite muito baixo: para convidar outras pessoas é preciso um **SMTP próprio**: host, porta 587 (STARTTLS) ou 465 (SSL), usuário, senha de aplicativo, remetente (ex.: `dmanda@<seu domínio>`) e nome do remetente "Dmanda".
- **Authentication > Rate Limits** > "Rate limit for sending emails": com SMTP próprio, um valor pequeno e suficiente (ex.: 30 por hora).

**Authentication > Hooks**
- "Before User Created": **Postgres function** `public.hook_antes_criar_usuario` (já existe; a nova versão só aceita e-mail e senha de endereço autorizado e não revogado).

**Authentication > Sessions**
- JWT expiry: **3600** s (padrão). Refresh token rotation: **ligado**, reuse interval **10 s** (padrão; o aplicativo e o servidor renovam em paralelo, e o intervalo evita derrubar a sessão). Não ativar time-box nem inatividade (o pedido é sessão persistente).

**Chaves de assinatura do JWT:** **não rotacionar neste fechamento.** Com a chave simétrica atual (HS256), cada requisição autenticada confere o token chamando o Auth (uma ida a mais por requisição); a troca para chaves assimétricas fica para uma decisão futura, separada.

**Variáveis** (`.env.local` deste computador e Vercel > Project > Environment Variables, Production)
| Variável | Situação | Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | já existe | inalterada |
| `SUPABASE_SERVICE_ROLE_KEY` | já existe | inalterada (só servidor) |
| `CRON_SECRET` | já existe | inalterada |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **nova** | a chave publicável do projeto (Project Settings > API Keys; começa com `sb_publishable_`) |
| `DMANDA_URL_PUBLICA` | **nova** | `https://dmanda-adm.vercel.app` (só a origem: sem caminho e sem barra final) |
| `DMANDA_SEGREDO_FLUXO` | **nova** | 32 caracteres ou mais, aleatórios, só do servidor (assina a etapa de definição de senha). Gere no PowerShell: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` e cole só nas variáveis, nunca no Git |

Sem `DMANDA_SEGREDO_FLUXO` a definição de senha por convite ou recuperação **recusa** (falha fechada) e o resto do painel funciona.

## 2. Etapas

**Etapa A, migrações aditivas (o assistente, com autorização).**
1. Cópia privada dos dados antes de tudo (você): menu do avatar > Baixar cópia, guardada em `C:\Users\Éder\Desktop\Dmanda-backups\`.
2. Conferência de leitura, sem gravar: a conta da administradora existe e está confirmada (`select id, email_confirmed_at is not null as confirmada from auth.users where lower(email) = '<e-mail da administradora>'`).
3. `npx supabase db push --linked --dry-run`: deve listar **somente** `20261122000000`, `20261122000100`, `20261122000150` e `20261122000300`.
4. `npx supabase db push --linked`.
5. Conferir: `select dmanda_privado.email_admin()`; contagens de `public.demandas`, `public.entradas` e `public.eventos` iguais às de antes; o painel **publicado** continua abrindo e listando.

**Etapa B, bootstrap da administradora (você).**
1. Ensaio: `node --env-file=.env.local scripts/bootstrap-admin.mjs --email=<e-mail da administradora>` (só diz o que faria).
2. A conta antiga é **reaproveitada** (mesmo `user_id`, então os registros legados continuam ligados a ela): o script envia o e-mail de recuperação. Se não existisse, enviaria o convite. Nenhuma outra identidade é criada e a API administrativa não define senha por ninguém.
3. `--executar`, abrir o e-mail, tocar no link, tocar em Continuar, definir a senha.

**Etapa C, conferência contra o serviço real, ANTES de publicar (você, com o assistente conferindo o que der).**
Local: **este computador (NOTE-EDER)**, `npm run dev` (Supabase real pelo `.env.local`), em `http://localhost:7100`. O código novo funciona contra o banco real depois da etapa A, e o painel publicado continua como está.
- Entrar com a administradora; Início mostra os dados legados.
- Convidar um e-mail **seu** (secundário): o convite chega pelo SMTP configurado, com o link no formato do modelo; definir a senha; entrar; ver o mesmo painel.
- "Esqueci a senha" com esse e-mail: chega, define nova senha, a antiga deixa de valer.
- Abrir o link de recuperação trocando `type=recovery` por `type=invite` na barra: deve ser recusado.
- Revogar o e-mail de teste com a página dele aberta: na próxima ação aparece "Acesso revogado"; restabelecer.
- Rascunho: começar uma demanda nova num navegador e ver "Salvo online"; abrir em outro navegador e recuperar.
- Autorizações desta etapa: envio de e-mails reais **só para endereços seus**.

**Etapa D, publicação (o assistente, com autorização para o push).** Conferir as variáveis da Vercel (seção 1), `git ls-remote origin refs/heads/main`, push da `main`, esperar o deploy de Production e conferir SHA, domínio, cron e variáveis.

**Etapa E, conferência no ar (você).** No domínio público: `/` leva a `/login`; a administradora entra; `GET /api/exportar` sem sessão responde 401; a rotina diária (cron) responde 200 com o segredo; um convite real a um e-mail seu completa o fluxo pelo domínio (Site URL e Redirect URLs certos).

**Etapa F, fechamento do acesso aberto (o assistente, com autorização).** `git mv supabase/pendentes/20261122000200_fechar_acesso_aberto.sql supabase/migrations/`, dry-run listando só ela, `db push`, commit e push. Conferir: `executar_como_titular` e `assumir_titular` não existem mais; o painel segue funcionando para a conta autenticada; uma chamada só com a chave de serviço (RPC `listar_demandas`) é recusada.

**Critérios de conclusão:** nenhum caminho lê ou altera o painel sem identidade autenticada; revogação confirmada no ar; administradora não revogável; rotina diária com um resumo por dia; rascunho retomado entre dois aparelhos da mesma conta; convite e recuperação pelo SMTP real.

## 3. O que só o serviço real prova

- Emissão e assinatura dos tokens pelo GoTrue, a resposta do Auth a um usuário banido em `/user` e na renovação, e o comportamento de "Secure password change" (o Auth fictício simula só a regra de idade de 24 h, sem o nonce por e-mail).
- Entrega dos e-mails (SMTP, modelos, limites, caixa de spam) e o hook configurado no painel.
- Domínio, HTTPS e cookies `Secure` em produção; Safari físico e PWA instalada.

## 4. Recuperação que mantém o painel protegido

- **Antes da etapa F**, voltar o código ao commit anterior é seguro (as migrações são compatíveis). **Depois da etapa F, não**: o código antigo depende da função removida.
- **Nunca** recriar `executar_como_titular` sem decisão expressa do Éder: ela reabriria o painel sem identidade.
- **Dados:** `supabase/restaurar-copia.sql` (versões 1 a 5) não cria contas e não concede nem restabelece acessos; a administradora existe e as demais contas são convidadas de novo.
- **A administradora esqueceu a senha:** "Esqueci a senha"; se o e-mail não chegar, o `bootstrap-admin.mjs` reenvia (precisa da chave de serviço, que só você tem).
- **SMTP fora do ar:** a autorização fica guardada, a tela mostra a falha e "Reenviar convite" funciona quando o envio voltar; nada é dado como enviado sem a confirmação do Auth.
- **Suspeita de sessão roubada:** revogar a conta (o banco recusa na hora, mesmo com o token anterior) e restabelecer depois de a pessoa trocar a senha.
