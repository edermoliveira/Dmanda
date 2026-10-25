// Banco local de TESTE (Postgres em WebAssembly, PGlite): aplica as mesmas migrações de supabase/migrations/ e simula só o que o Supabase
// fornece (papéis anon e authenticated, esquema auth com auth.uid()). Serve para testar as regras e a RLS sem um projeto Supabase.
// NÃO é o banco de uso: não valida o Supabase real (plataforma, Auth, chaves, rede). Usado pelos testes e, sob DMANDA_BANCO=teste, pelo aplicativo em desenvolvimento.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PALCO = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select on auth.users to authenticated;
`;

// Fiel ao Supabase com a exposição automática desligada (configuração deste projeto): tabelas novas nascem com truncate, references e trigger para
// anon, authenticated e service_role, e SEM select, insert, update nem delete; funções novas continuam executáveis por public até serem revogadas.
// As migrações precisam declarar todos os privilégios de que dependem. Idempotente, para valer também em bancos de teste criados antes.
const PALCO_PRIVILEGIOS = `
do $$ begin if not exists (select from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if; end $$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
grant execute on function auth.jwt() to anon, authenticated, service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from anon, authenticated, service_role;
alter default privileges in schema public grant references, trigger, truncate on tables to anon, authenticated, service_role;
`;

// Papel de serviço (a chave de serviço do Supabase). Separado e idempotente para também valer em bancos de teste criados antes dele existir.
const PALCO_SERVICO = `
do $$ begin if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if; end $$;
grant usage on schema public to service_role; grant usage on schema auth to service_role;
`;

// Migrações já aplicadas ficam registradas, para um banco de teste que já existe receber só as novas (sem recriar nem apagar nada).
// Bancos criados antes do registro existir já tinham as duas primeiras migrações.
const JA_TINHAM = ['20261025000000_nucleo_demandas.sql', '20261025000100_salvar_demanda.sql'];

export async function abrirBancoTeste({ pasta, raizMigracoes = join(/*turbopackIgnore: true*/ process.cwd(), 'supabase', 'migrations') } = {}) {
  const db = pasta ? new PGlite(pasta) : new PGlite();
  await db.waitReady;
  const ja = await db.query("select to_regnamespace('auth') as a, to_regclass('public.demandas') as d, to_regclass('teste_infra.migracoes') as m");
  if (!ja.rows[0].a) await db.exec(PALCO);
  await db.exec(PALCO_SERVICO);
  await db.exec(PALCO_PRIVILEGIOS);
  await db.exec('create schema if not exists teste_infra; create table if not exists teste_infra.migracoes (nome text primary key)');
  if (ja.rows[0].d && !ja.rows[0].m) for (const f of JA_TINHAM) await db.query('insert into teste_infra.migracoes (nome) values ($1) on conflict do nothing', [f]);
  const feitas = new Set((await db.query('select nome from teste_infra.migracoes')).rows.map((x) => x.nome));
  for (const f of readdirSync(/*turbopackIgnore: true*/ raizMigracoes).filter((x) => x.endsWith('.sql')).sort()) {
    if (feitas.has(f)) continue;
    await db.exec(readFileSync(join(/*turbopackIgnore: true*/ raizMigracoes, f), 'utf8'));
    await db.query('insert into teste_infra.migracoes (nome) values ($1)', [f]);
  }
  return db;
}

// Entra, dentro de uma transação, como um usuário autenticado: define as claims do JWT (sub, e-mail e provedor, como o Supabase Auth assina)
// e troca para o papel authenticated. O e-mail vem de auth.users, a menos que seja informado.
export async function entrarComo(tx, usuarioId, { email, provedor = 'google' } = {}) {
  const e = email !== undefined ? email : ((await tx.query('select email from auth.users where id = $1', [usuarioId])).rows[0]?.email ?? null);
  const claims = JSON.stringify({ sub: usuarioId, role: 'authenticated', email: e, app_metadata: { provider: provedor, providers: [provedor] } });
  await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [usuarioId, claims]);
  await tx.exec('set local role authenticated');
}

// Executa uma função do banco como um usuário autenticado (RLS valendo), como o PostgREST do Supabase faz.
export async function chamarComoUsuario(db, usuarioId, funcao, args = {}, opcoes = {}) {
  const nomes = Object.keys(args);
  const valores = nomes.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
  const tipos = nomes.map((n) => (args[n] !== null && typeof args[n] === 'object' ? '::jsonb' : ''));
  const sql = `select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}${tipos[i]}`).join(', ')}) as r`;
  return db.transaction(async (tx) => {
    await entrarComo(tx, usuarioId, opcoes);
    const r = await tx.query(sql, valores);
    return r.rows[0].r;
  });
}

// Executa uma função do banco como o papel de serviço (sem usuário), como a chave de serviço do Supabase faz. Só a rotina diária usa isto.
export async function chamarComoServico(db, funcao, args = {}) {
  const nomes = Object.keys(args);
  const sql = `select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
  return db.transaction(async (tx) => {
    await tx.exec('set local role service_role');
    const r = await tx.query(sql, nomes.map((n) => args[n]));
    return r.rows[0].r;
  });
}
