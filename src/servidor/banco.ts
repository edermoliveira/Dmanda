// Transporte das operações para o banco. Há dois: o Supabase real (padrão) e, só em desenvolvimento e sob DMANDA_BANCO=teste,
// um Postgres local descartável com as mesmas migrações. Os dois executam exatamente as mesmas funções SQL.
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { clienteDaSessao, exigirUsuario } from './sessao';
import { modoTeste } from '@/lib/supabase/config';
import { criarOperacoes, ErroConflito, ErroDmanda, ErroRevogado, ErroSessao, type Chamar } from '@/nucleo/operacoes';

type Banco = { db: import('@electric-sql/pglite').PGlite };
const g = globalThis as unknown as { __dmandaBancoTeste?: Promise<Banco> };

async function bancoTeste(): Promise<Banco> {
  g.__dmandaBancoTeste ??= (async () => {
    const { abrirBancoTeste, prepararTitularDeTeste, prepararAdminDeTeste } = await import('./banco-teste-base.mjs');
    const db = await abrirBancoTeste({ pasta: process.env.DMANDA_PASTA_TESTE ?? './.dados-teste/pg', pendentes: true });
    await prepararTitularDeTeste(db);
    await prepararAdminDeTeste(db);
    return { db };
  })();
  return g.__dmandaBancoTeste;
}

/** Erros de regra do banco (P0001) já vêm em português e são mostrados; o resto vira mensagem genérica (o detalhe vai para o log). */
function traduzir(e: { message?: string; code?: string }): Error {
  if (e.code === 'DM403') return new ErroRevogado(e.message ?? 'Seu acesso ao Dmanda foi revogado.');
  if (e.code === 'DM409') return new ErroConflito(e.message ?? 'A demanda foi alterada em outro aparelho. Nada foi gravado.');
  if (e.code === 'P0001') return new ErroDmanda(e.message ?? 'Operação recusada.');
  if (/constraint|violates/i.test(e.message ?? '')) return new ErroDmanda('Os dados não passaram na validação do banco. Confira os campos.');
  return Object.assign(new Error(e.message ?? 'erro de banco'), { code: e.code });
}

/** Só para a rota de limpeza das suítes (modo de teste): o banco descartável. */
export async function clienteBancoTeste() { if (!modoTeste()) throw new Error('somente no modo de teste'); return (await bancoTeste()).db; }

const chamarTeste: Chamar = async (funcao, args) => {
  const { chamarComoUsuario } = await import('./banco-teste-base.mjs');
  const { db } = await bancoTeste();
  const u = await identidade();
  try {
    return await chamarComoUsuario(db, u.id, funcao, args);
  } catch (e) {
    throw traduzir(e as { message?: string; code?: string });
  }
};

/** Sem sessão válida a operação não roda: a interface é levada ao login (redirect do Next; as ações e o cliente tratam). */
async function identidade() {
  try { return await exigirUsuario(); }
  catch (e) { if (e instanceof ErroSessao) redirect('/login?motivo=sessao'); throw e; }
}

/** Cliente com a chave de serviço (só no servidor, nunca em NEXT_PUBLIC): uso EXCLUSIVO da rotina diária e da administração dos acessos no Auth (src/servidor/acessos.ts). Não lê nem altera o painel. */
export function clienteServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveServico) throw Object.assign(new Error('Supabase ou chave de serviço não configurados.'), { code: 'sem-config' });
  return createClient(url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Operações do painel com a IDENTIDADE do usuário (decisão 92): a função do banco é chamada com o JWT da sessão (papel authenticated), então a RLS e conta_autorizada() decidem a cada chamada.
 * Não existe caminho que use a chave de serviço para ler ou alterar o painel. Token vencido é renovado por exigirUsuario(); o JWT recusado pelo banco (401) é sessão encerrada.
 */
const chamarSupabase: Chamar = async (funcao, args) => {
  await identidade();
  const sb = await clienteDaSessao();
  const { data, error, status } = await sb.rpc(funcao, args);
  if (error) {
    if (status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303') redirect('/login?motivo=sessao');
    throw traduzir(error);
  }
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

const transporte: Chamar = (funcao, args) => (modoTeste() ? chamarTeste(funcao, args) : chamarSupabase(funcao, args));

/**
 * Toda operação do painel. Uma conta sem acesso é recusada pelo banco (DM403) quando a política chega a ser avaliada; numa leitura que volta VAZIA a política pode nem ter sido avaliada
 * (nenhuma linha passou pela primeira condição), então a lista vazia só é entregue depois de conferir que o acesso está vigente: "sem acesso" nunca aparece como "nenhuma demanda".
 */
export const chamar: Chamar = async (funcao, args) => {
  const r = await transporte(funcao, args);
  if (Array.isArray(r) && r.length === 0 && funcao.startsWith('listar_')) {
    const e = (await transporte('estado_acesso', {})) as { autorizado?: boolean; revogado?: boolean };
    if (!e?.autorizado) throw new ErroRevogado(e?.revogado ? 'Seu acesso ao Dmanda foi revogado.' : 'Esta conta não tem acesso ao Dmanda.');
  }
  return r;
};

/** As operações de demandas, tarefas, entradas, agenda e perfil sobre o transporte atual: as ações do servidor e a exportação partem daqui (o transporte nunca varia entre elas). */
export const operacoes = () => criarOperacoes(chamar);
