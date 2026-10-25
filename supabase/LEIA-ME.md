# Supabase, Vercel e rotina diária do Dmanda

**Estado (25/10/2026):** as migrações existem e foram testadas só no Postgres local de teste (PGlite). **Nenhum projeto Supabase ou Vercel está configurado neste computador.** Login Google, persistência real, publicação e agendamento **não foram validados**. Este arquivo descreve o que o código atual espera.

## Quem faz o quê

| Etapa | Quem | Onde |
|---|---|---|
| Criar o projeto Supabase (plano gratuito) e anotar o endereço e a chave **pública** | usuário | site do Supabase, Project Settings > API |
| Aplicar as 3 migrações de `migrations/` em ordem | usuário (SQL Editor) ou Claude (se o usuário liberar a CLI, ver abaixo) | Supabase |
| Ativar o Google em Authentication > Providers (credenciais OAuth no Google Cloud) e cadastrar as URLs de retorno | usuário | Supabase e Google Cloud |
| Criar `.env.local` | usuário | computador (o Claude não lê arquivos `.env*`) |
| Criar o projeto na Vercel ligado ao GitHub, cadastrar as variáveis | usuário (ou Claude com a CLI liberada) | site da Vercel |
| Conferir o esquema remoto, validar RLS, login, gravação e leitura reais, rotina | Claude | depois que o acesso existir |

## Variáveis de ambiente

| Variável | Onde fica | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` e Vercel | endereço do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` e Vercel | chave **pública** (publishable ou anon). Só vale com RLS e login |
| `DMANDA_EMAIL_AUTORIZADO` | `.env.local` e Vercel | e-mail da conta Google do Secretário. Qualquer outra conta é recusada |
| `SUPABASE_SERVICE_ROLE_KEY` | **só na Vercel** (e no `.env.local` se for testar a rotina localmente) | chave privilegiada. Usada apenas pela rotina diária, apenas no servidor. **Nunca** em `NEXT_PUBLIC` nem no Git |
| `CRON_SECRET` | **só na Vercel** (e no `.env.local` para teste local) | texto aleatório de 16 caracteres ou mais. A Vercel o envia como `Authorization: Bearer` ao chamar a rotina |
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

## Migrações (`migrations/`, aplicar em ordem)

1. `20261025000000_nucleo_demandas.sql`: tabelas `demandas` e `tarefas`, RLS por usuário e as funções de todas as operações.
2. `20261025000100_salvar_demanda.sql`: salvar demanda e tarefas de forma atômica.
3. `20261025000200_rotina_diaria.sql`: resumo operacional datado, registro das execuções, gatilho de recálculo, funções restritas ao papel de serviço.

Regras: **antes** de aplicar em um projeto que já tenha dados, conferir o esquema existente (tabelas, políticas, funções) para não duplicar nem sobrescrever. As migrações não apagam nada. Nunca resetar o banco real. Dados do protótipo não entram.

Depois de aplicar, no Supabase: Authentication > Sign In / Providers, desligar "Allow new users to sign up" (usuário único) depois do primeiro login do Secretário, e conferir no Security Advisor que todas as tabelas têm RLS.

## Login Google e acesso

- URLs de retorno (Supabase > Authentication > URL Configuration e Google Cloud): `http://localhost:7100/auth/callback` e `https://<endereço-da-vercel>/auth/callback`.
- O proxy (`src/proxy.ts`) exige sessão, e-mail igual a `DMANDA_EMAIL_AUTORIZADO` e uso nas últimas **6 horas** (cookie `dmanda-ultimo-uso`). Sem Supabase configurado, responde 503.
- Cada operação do banco confere de novo a sessão e o e-mail, e a RLS (`user_id = auth.uid()`) isola os dados mesmo que o proxy falhe.

## Rotina diária na nuvem

- **O que faz:** consulta prazos e acompanhamentos, grava um resumo operacional **datado** (`resumos_operacionais`, com contagens e identificadores, sem texto das demandas) e registra a execução (`execucoes_rotina`). Só **lê** as demandas: não conclui, não altera prazos e não inventa dados.
- **Datas:** as datas originais (`prazo`, `acompanhar_em`) são a fonte de verdade. Dias restantes são derivados delas com a data de hoje em America/Sao_Paulo, na tela e na rotina. O resumo guarda a data de referência e é recalculado quando uma demanda muda. A tela não depende do resumo, então os prazos continuam corretos mesmo se o agendamento atrasar ou falhar.
- **Falhas e repetição:** repetir no mesmo dia mantém um único resumo (idempotente). Se um dia for perdido, o seguinte recalcula tudo pelas datas. A falha é registrada (mensagem curta, sem dado pessoal) e o Início mostra, sem alarme, a última execução e a última falha.
- **Segurança:** a rota `GET /api/cron/diaria` só responde com `Authorization: Bearer <CRON_SECRET>` (401 sem ele, 503 se o segredo não estiver configurado). Não usa sessão Google, não renova o "último uso" e a resposta traz só a data e uma contagem. No banco, `rotina_diaria` e `registrar_falha_rotina` só podem ser executadas pelo papel de serviço; usuário logado e visitante não.
- **Agendamento:** `vercel.json` define uma chamada por dia às 09:00 UTC (06:00 em Brasília). A Vercel usa sempre UTC.
- **Plano da Vercel (conferido na documentação em 25/10/2026):** o plano Hobby permite cron **uma vez por dia**, com precisão de hora (pode rodar entre 06:00 e 06:59), e é restrito a **uso pessoal e não comercial** (a Vercel define uso comercial como projeto de que alguém ganhe dinheiro, **incluindo um funcionário pago que escreva o código**). Cron só roda no deployment de **produção**, não em Preview, e não tem retentativa nem garantia de entrega única. **Decisão do usuário:** o enquadramento do Dmanda (ferramenta pessoal usada no trabalho da Prefeitura) no plano Hobby precisa ser confirmado por ele, se necessário com o suporte da Vercel. Nada foi contratado.
- **Supabase gratuito:** projetos de baixa atividade podem ser **pausados** (a documentação fala em 7 dias). Uma chamada diária **não garante** que o projeto nunca pause. O plano Pro evita a pausa, mas não foi contratado.
- **Em quatro níveis:** código preparado (sim); chamada manual validada (sim, no banco de teste e em produção local sem credenciais); agendamento implantado (**não**); primeira execução automática observada (**não**).

## Proteção dos dados reais (cópia própria)

- O GitHub guarda **código e migrações**, não os dados. Os registros reais ficam só no Supabase e **nunca** vão para o repositório.
- **Já existe:** nada além do banco do próprio Supabase. O plano gratuito **não permite baixar backups** pelo painel.
- **Falta:** uma cópia privada periódica dos dados (por exemplo, um `pg_dump` guardado em pasta privada fora do repositório, ou exportação das tabelas), com teste de restauração. Precisa da senha do banco, que fica só com o usuário. Proposta de script a combinar quando o projeto existir.

## Acesso do assistente (opcional, para ele conferir e aplicar)

O assistente não tem hoje CLI nem conexão ao Supabase ou à Vercel. Se o usuário quiser que ele confira o esquema remoto, aplique migrações e cadastre variáveis, pode autorizar o uso das CLIs oficiais (`npx supabase`, `npx vercel`, sem instalar globalmente), com o login feito **pelo próprio usuário** no terminal da sessão (`! npx supabase login`, `! npx vercel login`). Nenhuma senha ou token passa pelo chat.

## Teste local sem Supabase

`npm run dev:teste` usa o banco local descartável (`.dados-teste/`, não vai para o Git). As migrações novas são aplicadas sozinhas a um banco de teste já existente. Testes: `npm run testar:banco`, `testar:regras`, `testar:app`. Eles **não** substituem a validação no Supabase real.
