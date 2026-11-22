# Plano de ativação da autenticação, dos acessos e dos rascunhos online (decisão 92)

Estado: **só planejado e testado localmente**. Nada deste plano foi executado no Supabase real, na Vercel ou no GitHub. Cada etapa exige a autorização expressa do Éder. Quem executa cada passo está indicado: **você (Éder)** ou **o assistente, com a sua autorização**.

## 0. O que mudou e por que a ativação tem duas etapas

O código novo troca a entrada aberta (`executar_como_titular`, chamada com a chave de serviço) pelo JWT de cada usuário. O código **publicado hoje** (`origin/main` = `085c03c8`) ainda usa a entrada aberta. Por isso:

1. **Migração aditiva** (`20261122000000`, `20261122000100`, `20261122000150`): compatível com o código publicado. Depois dela o aplicativo atual continua funcionando (a decisão de acesso passa a ler `auth.users` pelo `auth.uid()`, e o titular assumido pelo servidor é a conta administradora).
2. **Publicação do código novo** (push da `main`, deploy automático na Vercel).
3. **Fechamento do acesso aberto** (`supabase/pendentes/20261122000200_fechar_acesso_aberto.sql`, movida para `supabase/migrations/`): só depois de o código novo estar no ar e conferido. Ela remove `executar_como_titular` e `assumir_titular`.

Se o passo 3 for aplicado antes do 2, o painel publicado deixa de funcionar. Se o 2 for feito antes do 1, o código novo chama funções que ainda não existem.

## 1. Pré-requisitos (você, no painel do Supabase e no computador)

| Item | Onde | Por quê |
|---|---|---|
| **Cópia privada dos dados** antes de qualquer operação real | `npm run dev` com o Supabase real e menu do avatar > Baixar cópia (ou o `copia_funcional_leitura.sql`), guardada em `C:\Users\Éder\Desktop\Dmanda-backups\` | recuperação sem expor o painel de novo |
| Chave **publicável** do projeto em `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`.env.local` e variáveis da Vercel) | painel do Supabase > Project Settings > API | o código novo cria o cliente de autenticação com ela (nunca a chave secreta) |
| `DMANDA_URL_PUBLICA` (endereço público do painel, sem barra final) | `.env.local` e Vercel | o link do convite e da recuperação |
| **E-mail de envio** configurado | painel do Supabase > Authentication > SMTP, **ou** o serviço padrão do Supabase | sem isso nenhum convite chega. O serviço padrão do Supabase tem limite baixo de mensagens por hora e só entrega a quem é membro da organização do projeto; para convidar pessoas de fora é preciso um SMTP próprio. **Não foi verificado aqui** (não há acesso ao painel) e **não é contratado pelo assistente** |
| **Modelos de e-mail** (Authentication > Email Templates) apontando para o aplicativo | painel | convite: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite`; recuperação: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery` (o aplicativo só consome o link quando a pessoa toca em Continuar) |
| **Site URL** e **Redirect URLs** | painel > Authentication > URL Configuration | `Site URL` = `DMANDA_URL_PUBLICA`; incluir `…/auth/confirmar` |
| **Cadastro público desligado** | painel > Authentication > Sign In / Providers > "Allow new users to sign up" desligado | defesa adicional; o hook do banco recusa de qualquer forma |
| **Google desligado** | painel > Authentication > Providers | o aplicativo não tem login Google |
| **Hook "Before User Created"** apontando para `public.hook_antes_criar_usuario` | painel > Authentication > Hooks | a função já existe (migração anterior); a nova versão só aceita e-mail e senha de endereço autorizado e não revogado. Conferir que o hook segue ativo |
| Prazo de validade do link (OTP) | painel > Authentication > Providers > Email | recomendado 24 h (o teste local usa 24 h) |

## 2. Sequência (com critérios de conferência)

**Etapa A, migração aditiva (assistente, com autorização).**
1. `git` local: confirmar que a `main` é a revisada; `npx supabase db push --linked --dry-run` e conferir que lista **somente** as três migrações novas (`20261122000000`, `…0100`, `…0150`).
2. Cópia privada feita (pré-requisito).
3. `npx supabase db push --linked`.
4. Conferir no SQL (consulta de leitura): `select dmanda_privado.email_admin()`; `select count(*) from dmanda_privado.acesso_autorizado` (a administradora autorizada); `select count(*) from public.demandas` igual ao de antes; o aplicativo **publicado** continua abrindo e listando (compatível).

**Etapa B, bootstrap da administradora (você).**
1. Rodar o ensaio: `node --env-file=.env.local scripts/bootstrap-admin.mjs --email=<e-mail da administradora>` (diz o que faria, sem enviar).
2. Se a conta já existe no Auth (o login antigo), ela será **reaproveitada** (mesmo `user_id`, então todos os registros legados continuam ligados): o script envia o e-mail de recuperação. Se não existe, envia o convite. Nada é criado por outra identidade.
3. Repetir com `--executar`, abrir o e-mail, tocar no link, tocar em Continuar e **definir a própria senha**.

**Etapa C, publicação do código novo (assistente, com autorização para o push).** Fluxo da decisão 89: `git ls-remote origin refs/heads/main` para conferir a base, push da `main`, esperar o deploy de Production da Vercel (conferir o SHA, o domínio, o cron e as variáveis).

**Etapa D, primeiro login e verificação no ar (você, com o assistente conferindo o que for verificável).**
1. Abrir o painel publicado: deve levar a `/login`; entrar com a conta administradora; Início mostra as demandas legadas (mesmos dados).
2. Configurações > Usuários e acesso aparece só para a administradora.
3. `GET /api/exportar` sem sessão: 401. `GET /api/cron/diaria` com o segredo: 200.
4. Convidar uma conta de teste (um e-mail seu): o convite chega, a pessoa define a senha, entra, vê o mesmo painel; revogar a conta de teste: na próxima abertura ela é levada ao login com a explicação.

**Etapa E, fechamento do acesso aberto (assistente, com autorização).** `git mv supabase/pendentes/20261122000200_fechar_acesso_aberto.sql supabase/migrations/`, dry-run listando só ela, `db push`. Conferir: `select proname from pg_proc where proname in ('executar_como_titular','assumir_titular')` vazio; o painel segue funcionando para a conta autenticada; uma chamada com **só** a chave de serviço (RPC `listar_demandas`) é recusada.

**Critérios de conclusão:** nenhum caminho lê ou altera o painel sem identidade autenticada; revogação testada no ar; administradora não revogável; rotina diária rodando uma vez por dia (resumo único); rascunhos entre dois aparelhos da mesma conta.

## 3. Recuperação que não reexponha o painel

- **Código:** reverter para a `main` anterior no GitHub **não é seguro depois da etapa E** (o código antigo depende da função removida). Antes da etapa E, voltar ao commit anterior é seguro (a migração aditiva é compatível).
- **Banco:** a restauração (`supabase/restaurar-copia.sql`, versão 5) não cria contas e não concede acessos. Se for preciso restaurar os dados, a administradora existe e as demais contas são convidadas de novo: nenhuma autorização é restabelecida em silêncio. **Nunca** recriar a função `executar_como_titular` sem a decisão do Éder (ela reabriria o painel).
- **Perda de acesso da administradora (esqueceu a senha):** "Esqueci a senha" na tela de entrada; se o e-mail não chegar, o `bootstrap-admin.mjs` reenvia (precisa da chave de serviço, que só você tem).
- **Falha no envio de e-mail:** a autorização fica guardada (estado "autorizado"), a tela mostra a falha e o botão Reenviar convite funciona quando o envio voltar.

## 4. Limites conhecidos

- Os testes locais usam um **Supabase falso** (`scripts/auth-falso.mjs`) para o Auth e a API de funções, sobre um PGlite com as mesmas migrações: provam o nosso código e as regras do banco, **não** o GoTrue real (emissão e assinatura dos tokens, entrega de e-mail, modelos, limites de taxa, o hook configurado no painel). Isso só se prova na etapa D.
- Não há Docker nesta máquina, então não foi possível subir o Supabase local oficial.
- Safari físico, PWA instalada e domínio final não foram testados.
