'use server';
// Ações do servidor da Agenda chamadas pela interface (eventos e lembretes). Cada uma devolve { ok, dados | erro }: a tela só mostra sucesso quando o banco confirmou.
import { chamar } from './banco';
import { criarOperacoes, executar } from '@/nucleo/operacoes';
import type { DadosEvento } from '@/lib/eventos';

const op = () => criarOperacoes(chamar);

export async function listarEventos() {
  return executar(() => op().listarEventos());
}
export async function buscarEvento(id: string) {
  return executar(() => op().buscarEvento(id));
}
export async function criarEvento(dados: DadosEvento) {
  return executar(() => op().criarEvento(dados));
}
export async function salvarEvento(id: string, dados: DadosEvento, versao: number) {
  return executar(() => op().salvarEvento(id, dados, versao));
}
export async function excluirEvento(id: string, confirmado: boolean) {
  return executar(() => op().excluirEvento(id, confirmado));
}
