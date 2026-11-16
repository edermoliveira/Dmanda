// Transporte das operações para o banco. Há dois: o Supabase real (padrão) e, só em desenvolvimento e sob DMANDA_BANCO=teste,
// um Postgres local descartável com as mesmas migrações. Os dois executam exatamente as mesmas funções SQL.
import { cache } from 'react';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { createClient } from '@supabase/supabase-js';
import { configSupabase, modoTeste } from '@/lib/supabase/config';
import { contaAutorizada, situacaoDoErroAuth } from '@/lib/sessao';
import { ErroConflito, ErroDmanda, type Chamar } from '@/nucleo/operacoes';

const USUARIO_TESTE = '00000000-0000-4000-8000-000000000001';

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
  if (e.code === 'DM409') return new ErroConflito(e.message ?? 'A demanda foi alterada em outro aparelho. Nada foi gravado.');
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

/**
 * O aparelho desta sessão continua autorizado? (decisão 82). O banco decide: estado_aparelho lê o session_id do token e a lista de aparelhos revogáveis. Conferido uma vez por pedido
 * (cache do React) em toda leitura e gravação, porque a RLS sozinha devolveria listas vazias a um aparelho revogado, e uma cópia dos dados vazia pareceria uma cópia boa.
 * Falha de rede ou do banco nunca libera: vira "transitoria". Função ausente (banco ainda sem a migração) vale como transição, como no proxy.
 */
export const situacaoDoAparelho = cache(async (): Promise<'ativo' | 'negado' | 'transitoria'> => {
  const sb = await criarClienteServidor();
  const { data, error } = await sb.rpc('estado_aparelho');
  if (error) return error.code === 'PGRST202' || error.code === '42883' ? 'ativo' : 'transitoria';
  return (data as { ativo?: boolean } | null)?.ativo === true ? 'ativo' : 'negado';
});

/** Cliente com a chave de serviço (só no servidor, nunca em NEXT_PUBLIC): uso da rotina diária e da autorização de aparelhos. */
export function clienteServico() {
  const c = configSupabase();
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!c || !chaveServico) throw Object.assign(new Error('Supabase ou chave de serviço não configurados.'), { code: 'sem-config' });
  return createClient(c.url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });
}

const chamarSupabase: Chamar = async (funcao, args) => {
  const sb = await criarClienteServidor();
  const { data: { user }, error: erroUser } = await sb.auth.getUser();
  if (erroUser || !user) {
    // falha de conexão com o Auth não é sessão encerrada: a sessão continua nos cookies e nada foi gravado (a tela explica pela sonda de sessão)
    if (situacaoDoErroAuth(erroUser) === 'transitoria') throw Object.assign(new Error('Não foi possível confirmar a sessão agora.'), { code: 'auth-indisponivel' });
    throw new ErroDmanda('Sua sessão terminou. Entre de novo.');
  }
  if (!contaAutorizada(user)) throw new ErroDmanda('Esta conta não tem acesso ao Dmanda.');
  const aparelho = await situacaoDoAparelho();
  if (aparelho === 'transitoria') throw Object.assign(new Error('Não foi possível confirmar o aparelho agora.'), { code: 'auth-indisponivel' });
  if (aparelho === 'negado') throw new ErroDmanda('Este aparelho não está mais autorizado. Peça um novo código para abrir o Dmanda de novo.');
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
  const { data, error } = await clienteServico().rpc(funcao, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
};

export const chamar: Chamar = (funcao, args) => (modoTeste() ? chamarTeste(funcao, args) : chamarSupabase(funcao, args));
