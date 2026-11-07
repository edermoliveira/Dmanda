'use server';
// Ações do servidor do Perfil: humor e energia por dia. Cada uma devolve { ok, dados | erro }: a tela só mostra "registrado" quando o banco confirmou.
// Dado privado: o log do servidor leva só o código do erro (ver `executar`), e estes valores não passam por busca, IA, telemetria nem cópia dos dados.
import { chamar } from './banco';
import { criarOperacoes, executar } from '@/nucleo/operacoes';

const op = () => criarOperacoes(chamar);

export async function listarRegistros() {
  return executar(() => op().listarRegistros(), { privado: true });
}
export async function registrarDias(lista: { dia: string; humor: number; energia: number }[]) {
  return executar(() => op().registrarDias(lista), { privado: true });
}
