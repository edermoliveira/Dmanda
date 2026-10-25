# Supabase do Dmanda

**Estado (25/10/2026):** as migrações em `migrations/` existem e foram testadas só num Postgres local de teste (PGlite, `npm run testar:banco`). **Nenhum projeto Supabase está configurado** e nenhuma credencial existe no computador. A integração com o Supabase real (login Google, RLS na plataforma, leitura e gravação reais) **não foi validada**.

## O que o usuário precisa fazer (uma vez)
1. Criar um projeto no Supabase (plano gratuito) e anotar o endereço do projeto e a chave **pública** (publishable ou anon) em Project Settings > API.
2. Aplicar as migrações em ordem: copiar o conteúdo de `migrations/20261025000000_nucleo_demandas.sql` e depois `...000100_salvar_demanda.sql` no SQL Editor (ou usar a CLI do Supabase, se for instalada depois).
3. Authentication > Providers: ativar o Google (criar as credenciais OAuth no Google Cloud) e, em URL Configuration, colocar `http://localhost:7100/auth/callback` (e o endereço da Vercel quando houver). Desligar "Allow new users to sign up" depois do primeiro login do Secretário (usuário único).
4. Criar `.env.local` (nunca vai para o Git) com:
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...` (chave pública; **nunca** a `service_role`)
   - `DMANDA_EMAIL_AUTORIZADO=` o e-mail Google do Secretário
5. `npm run dev` e abrir http://localhost:7100.

## Como funciona
- Todas as operações são funções SQL (`security invoker`, com a RLS do usuário): criar, atualizar, `salvar_demanda` (atômico), `mover_etapa`, concluir, reabrir, arquivar, excluir (exige confirmação), tarefas. Devolvem a demanda completa em jsonb.
- A aplicação chama as funções com `supabase.rpc` (padrão) ou, só em desenvolvimento com `DMANDA_BANCO=teste` (`npm run dev:teste`), com um Postgres local descartável em `.dados-teste/`. O modo de teste é recusado em produção.
- Segurança: RLS por `user_id = auth.uid()`; sem acesso para `anon`; o proxy exige sessão, e-mail autorizado e uso nas últimas 6 horas.
