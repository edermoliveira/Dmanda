// Lógica pura da rotina diária (sem dependências do aplicativo, para ser testada isolada).
import { timingSafeEqual } from 'node:crypto';

export type ChamarServico = (funcao: string, args?: Record<string, unknown>) => Promise<unknown>;
export type ResultadoRotina = { data_ref: string; usuarios: number };

/** Confere o cabeçalho "Authorization: Bearer <segredo>" em tempo constante. Sem segredo configurado, nunca confere. */
export function segredoConfere(cabecalho: string | null | undefined, segredo: string | undefined): boolean {
  if (!segredo || segredo.length < 16 || !cabecalho) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/**
 * Executa a rotina no banco. Em caso de erro tenta registrar a falha (com mensagem curta e sem dado pessoal) e devolve o erro ao chamador,
 * para o agendador também enxergar a falha. Se nem o registro for possível (banco fora do ar), o erro original é o que sobe.
 */
export async function executarRotinaDiaria(chamarServico: ChamarServico): Promise<ResultadoRotina> {
  try {
    return (await chamarServico('rotina_diaria')) as ResultadoRotina;
  } catch (e) {
    const resumo = String((e as { code?: string })?.code ?? 'erro').replace(/[^\w.-]/g, '').slice(0, 40);
    try {
      await chamarServico('registrar_falha_rotina', { p_erro: `Falha ao executar a rotina (${resumo}).` });
    } catch {
      /* o banco pode estar indisponível: o registro da falha fica nos logs do agendador */
    }
    throw e;
  }
}
