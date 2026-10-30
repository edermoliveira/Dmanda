'use server';
// Ações do servidor de Entradas chamadas pela interface. Cada uma devolve { ok, dados | erro }: a tela só mostra sucesso quando o banco confirmou.
import { chamar } from './banco';
import { criarOperacoes, executar } from '@/nucleo/operacoes';
import type { DadosDemanda } from '@/lib/demandas';

const op = () => criarOperacoes(chamar);

export async function listarEntradas(arquivadas = false) {
  return executar(() => op().listarEntradas(arquivadas));
}
export async function buscarEntrada(id: string) {
  return executar(() => op().buscarEntrada(id));
}
export async function criarEntrada(dados: { id?: string; titulo?: string; texto?: string; cor?: number | null; fixada?: boolean }) {
  return executar(() => op().criarEntrada(dados));
}
export async function salvarEntrada(id: string, dados: { titulo?: string; texto?: string; cor?: number; fixada?: boolean }, versao: number) {
  return executar(() => op().salvarEntrada(id, dados, versao));
}
export async function fixarEntrada(id: string, fixada: boolean) {
  return executar(() => op().fixarEntrada(id, fixada));
}
export async function arquivarEntrada(id: string) {
  return executar(() => op().arquivarEntrada(id));
}
export async function desarquivarEntrada(id: string) {
  return executar(() => op().desarquivarEntrada(id));
}
export async function excluirEntrada(id: string, confirmado: boolean) {
  return executar(() => op().excluirEntrada(id, confirmado));
}
export async function criarDemandaDeEntrada(entradaId: string, dados: DadosDemanda & { id: string }) {
  return executar(() => op().criarDemandaDeEntrada(entradaId, dados));
}
