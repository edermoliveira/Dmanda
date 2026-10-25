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

export async function abrirBancoTeste({ pasta, raizMigracoes = join(process.cwd(), 'supabase', 'migrations') } = {}) {
  const db = pasta ? new PGlite(pasta) : new PGlite();
  await db.waitReady;
  const ja = await db.query("select to_regnamespace('auth') as a");
  if (!ja.rows[0].a) {
    await db.exec(PALCO);
    for (const f of readdirSync(raizMigracoes).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(join(raizMigracoes, f), 'utf8'));
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
