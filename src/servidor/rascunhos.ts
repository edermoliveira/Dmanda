'use server';
// Rascunhos online (decisão 92): ações do servidor sobre as funções do banco. O rascunho é INDIVIDUAL (RLS por autor): nenhuma ação recebe nem aceita um usuário. Cada uma devolve { ok, dados | erro }.
// O conteúdo é privado: o log de falha leva só o código do erro. Senhas e credenciais não são rascunhos (o banco só aceita as chaves de rascunho conhecidas).
import { chamar } from './banco';
import { executar, ErroDmanda } from '@/nucleo/operacoes';

export type RascunhoNoBanco = { id: string; chave: string; estado: 'aberto' | 'consumido' | 'descartado'; dados: Record<string, unknown>; versao: number; conflitos: { op: string; base: number; dados: Record<string, unknown>; em: string; instancia?: string }[]; atualizado_em: string };
export type RespostaRascunho =
  | { status: 'ok'; id: string; versao: number; repetida?: true }
  | { status: 'conflito'; id: string; versao: number; dados: Record<string, unknown>; conflitos: RascunhoNoBanco['conflitos'] }
  | { status: 'encerrado'; id: string; estado: 'consumido' | 'descartado' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => { if (typeof v !== 'string' || !UUID.test(v)) throw new ErroDmanda('Rascunho inválido.'); return v; };
const chaveOk = (v: unknown) => { if (typeof v !== 'string' || v.length > 120) throw new ErroDmanda('Rascunho inválido.'); return v; };
const objeto = (v: unknown) => { if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ErroDmanda('Rascunho inválido.'); return v as Record<string, unknown>; };

export async function listarRascunhos() {
  return executar(async () => (await chamar('listar_rascunhos', {})) as RascunhoNoBanco[], { privado: true });
}
export async function salvarRascunho(id: string, chave: string, dados: Record<string, unknown>, base: number, op: string) {
  return executar(async () => (await chamar('salvar_rascunho', { p_id: uuid(id), p_chave: chaveOk(chave), p_dados: objeto(dados), p_base: Number.isInteger(base) ? base : 0, p_op: uuid(op) })) as RespostaRascunho, { privado: true });
}
export async function resolverRascunho(id: string, dados: Record<string, unknown>, base: number, op: string) {
  return executar(async () => (await chamar('resolver_rascunho', { p_id: uuid(id), p_dados: objeto(dados), p_base: Number.isInteger(base) ? base : 0, p_op: uuid(op) })) as RespostaRascunho, { privado: true });
}
export async function encerrarRascunho(id: string, chave: string, estado: 'consumido' | 'descartado') {
  return executar(async () => (await chamar('encerrar_rascunho', { p_id: uuid(id), p_chave: chaveOk(chave), p_estado: estado === 'consumido' ? 'consumido' : 'descartado' })) as { status: 'ok'; estado: string; id: string }, { privado: true });
}
/** Só a administradora (o banco confere). Devolve 'ok', 'repetido' (já importado: o aparelho pode apagar a cópia local) ou 'ocupado' (a chave tem rascunho aberto: tentar outro nome). */
export async function importarRascunhoLegado(id: string, chave: string, dados: Record<string, unknown>) {
  return executar(async () => (await chamar('importar_rascunho_legado', { p_id: uuid(id), p_chave: chaveOk(chave), p_dados: objeto(dados) })) as { status: 'ok' | 'repetido' | 'ocupado'; id?: string; chave: string }, { privado: true });
}
