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
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

// Papel de serviço (a chave de serviço do Supabase). Separado e idempotente para também valer em bancos de teste criados antes dele existir.
const PALCO_SERVICO = `
do $$ begin if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if; end $$;
grant usage on schema public to service_role; grant usage on schema auth to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to service_role;
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

// Executa uma função do banco como um usuário autenticado (RLS valendo), como o PostgREST do Supabase faz.
export async function chamarComoUsuario(db, usuarioId, funcao, args = {}) {
  const nomes = Object.keys(args);
  const valores = nomes.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
  const tipos = nomes.map((n) => (args[n] !== null && typeof args[n] === 'object' ? '::jsonb' : ''));
  const sql = `select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}${tipos[i]}`).join(', ')}) as r`;
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [usuarioId]);
    await tx.exec('set local role authenticated');
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
