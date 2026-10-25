// Transporte das operações para o banco. Há dois: o Supabase real (padrão) e, só em desenvolvimento e sob DMANDA_BANCO=teste,
// um Postgres local descartável com as mesmas migrações. Os dois executam exatamente as mesmas funções SQL.
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { createClient } from '@supabase/supabase-js';
import { configSupabase, modoTeste } from '@/lib/supabase/config';
import { contaAutorizada } from '@/lib/sessao';
import { ErroDmanda, type Chamar } from '@/nucleo/operacoes';

export const USUARIO_TESTE = '00000000-0000-4000-8000-000000000001';

type Banco = { db: import('@electric-sql/pglite').PGlite };
const g = globalThis as unknown as { __dmandaBancoTeste?: Promise<Banco> };

async function bancoTeste(): Promise<Banco> {
  g.__dmandaBancoTeste ??= (async () => {
    const { abrirBancoTeste } = await import('./banco-teste-base.mjs');
    const db = await abrirBancoTeste({ pasta: process.env.DMANDA_PASTA_TESTE ?? './.dados-teste/pg' });
    await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO_TESTE]);
    await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
    return { db };
  })();
  return g.__dmandaBancoTeste;
}

/** Erros de regra do banco (P0001) já vêm em português e são mostrados; o resto vira mensagem genérica (o detalhe vai para o log). */
function traduzir(e: { message?: string; code?: string }): Error {
  if (e.code === 'P0001') return new ErroDmanda(e.message ?? 'Operação recusada.');
  if (/constraint|violates/i.test(e.message ?? '')) return new ErroDmanda('Os dados não passaram na validação do banco. Confira os campos.');
  return Object.assign(new Error(e.message ?? 'erro de banco'), { code: e.code });
}

const chamarTeste: Chamar = async (funcao, args) => {
  const { chamarComoUsuario } = await import('./banco-teste-base.mjs');
  const { db } = await bancoTeste();
  try {
    return await chamarComoUsuario(db, USUARIO_TESTE, funcao, args);
  } catch (e) {
    throw traduzir(e as { message?: string; code?: string });
  }
};

const chamarSupabase: Chamar = async (funcao, args) => {
  const sb = await criarClienteServidor();
  const { data: { user }, error: erroUser } = await sb.auth.getUser();
  if (erroUser || !user) throw new ErroDmanda('Sua sessão terminou. Entre de novo.');
  if (!contaAutorizada(user)) throw new ErroDmanda('Esta conta não tem acesso ao Dmanda.');
  const { data, error } = await sb.rpc(funcao, args);
  if (error) throw traduzir(error);
  return data;
};

/**
 * Chamada com o papel de serviço (chave de serviço do Supabase, só no servidor, nunca em NEXT_PUBLIC). Uso exclusivo da rotina diária:
 * ela só chama as funções rotina_diaria e registrar_falha_rotina, que são as únicas liberadas para esse papel.
 */
export const chamarServico = async (funcao: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  if (modoTeste()) {
    const { chamarComoServico } = await import('./banco-teste-base.mjs');
    const { db } = await bancoTeste();
    return chamarComoServico(db, funcao, args);
  }
  const c = configSupabase();
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!c || !chaveServico) throw Object.assign(new Error('Supabase ou chave de serviço não configurados.'), { code: 'sem-config' });
  const sb = createClient(c.url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc(funcao, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
};

export const chamar: Chamar = (funcao, args) => (modoTeste() ? chamarTeste(funcao, args) : chamarSupabase(funcao, args));
