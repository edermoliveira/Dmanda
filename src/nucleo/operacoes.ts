// Operações de demandas, tarefas e etapas, com validação das entradas, independentes de interface e de transporte.
// A interface (ações do servidor) e, no futuro, a IA operacional chamam estas funções. As regras de negócio ficam no banco (migrações);
// aqui só se confere o formato e se traduz o erro em mensagem para a pessoa.
import { ETAPAS, type DadosDemanda, type Demanda, type Etapa } from '@/lib/demandas';
import type { DiaIndisponivel } from '@/lib/prazos';
import type { Entrada } from '@/lib/entradas';
import { ErroConflito, ErroDmanda, enumerado, id, texto, validarDados, validarDia, validarEntrada, validarTarefas, versaoDe, type TarefaEdicao } from './validacao.ts';
export { ErroConflito, ErroDmanda, validarDados, validarDia, validarEntrada };
export type { TarefaEdicao };

export type Chamar = (funcao: string, args: Record<string, unknown>) => Promise<unknown>;
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string; conflito?: true };
export type RespostaDia = { dia: DiaIndisponivel; recalculadas: number };

export function criarOperacoes(chamar: Chamar) {
  const demanda = async (f: string, a: Record<string, unknown>) => (await chamar(f, a)) as Demanda;
  const entrada = async (f: string, a: Record<string, unknown>) => (await chamar(f, a)) as Entrada;
  return {
    listar: async (arquivadas = false) => (await chamar('listar_demandas', { p_arquivadas: !!arquivadas })) as Demanda[],
    criar: (dados: DadosDemanda) => demanda('criar_demanda', { p: validarDados(dados, { criando: true }) }),
    atualizar: (demandaId: string, dados: DadosDemanda) => demanda('atualizar_demanda', { p_id: id(demandaId, 'Demanda'), p: validarDados(dados, { criando: false }) }),
    buscar: (demandaId: string) => demanda('buscar_demanda', { p_id: id(demandaId, 'Demanda') }),
    /**
     * Salva a janela de edição inteira, de forma atômica: campos, lista de tarefas (na ordem) e, se informada, a etapa. `versao` é a que a demanda tinha quando a janela
     * foi aberta: se mudou desde então, o banco recusa tudo (ErroConflito) em vez de sobrescrever o que outro aparelho gravou.
     */
    salvar: (demandaId: string, dados: DadosDemanda, tarefas: TarefaEdicao[] | null, versao: number) => demanda('salvar_demanda', { p_id: id(demandaId, 'Demanda'), p: validarDados(dados, { criando: false, aceitaEtapa: true }), p_tarefas: validarTarefas(tarefas), p_versao: versaoDe(versao) }),
    moverEtapa: (demandaId: string, etapa: Etapa) => demanda('mover_etapa', { p_id: id(demandaId, 'Demanda'), p_etapa: enumerado(etapa, ETAPAS, 'Etapa') }),
    concluir: (demandaId: string) => demanda('concluir_demanda', { p_id: id(demandaId, 'Demanda') }),
    reabrir: (demandaId: string, etapa: Etapa = 'Fazendo') => demanda('reabrir_demanda', { p_id: id(demandaId, 'Demanda'), p_etapa: enumerado(etapa, ETAPAS, 'Etapa') }),
    arquivar: (demandaId: string) => demanda('arquivar_demanda', { p_id: id(demandaId, 'Demanda') }),
    desarquivar: (demandaId: string) => demanda('desarquivar_demanda', { p_id: id(demandaId, 'Demanda') }),
    excluir: async (demandaId: string, confirmado: boolean) => (await chamar('excluir_demanda', { p_id: id(demandaId, 'Demanda'), p_confirmado: confirmado === true })) as { id: string; excluida: true },
    listarDias: async () => (await chamar('listar_dias_indisponiveis', {})) as DiaIndisponivel[],
    salvarDia: async (dia: unknown) => (await chamar('salvar_dia_indisponivel', { p: validarDia(dia) })) as RespostaDia,
    excluirDia: async (diaId: string) => (await chamar('excluir_dia_indisponivel', { p_id: id(diaId, 'Dia') })) as { id: string; excluido: true; recalculadas: number },
    // ---------- Entradas (anotações) ----------
    /** arquivadas = false: as ativas. true: as arquivadas e as que já viraram demanda (Arquivo). */
    listarEntradas: async (arquivadas = false) => (await chamar('listar_entradas', { p_arquivadas: !!arquivadas })) as Entrada[],
    buscarEntrada: (entradaId: string) => entrada('buscar_entrada', { p_id: id(entradaId, 'Anotação') }),
    /** O identificador (opcional) é gerado pelo aplicativo: repetir a criação com ele devolve a mesma anotação. */
    criarEntrada: (dados: { id?: string; titulo?: string; texto?: string; cor?: number | null; fixada?: boolean }) => entrada('criar_entrada', { p: validarEntrada(dados, { criando: true }) }),
    /** Só os campos enviados mudam; `versao` é a que a janela viu por último (se mudou, o banco recusa com ErroConflito em vez de sobrescrever). */
    salvarEntrada: (entradaId: string, dados: { titulo?: string; texto?: string; cor?: number; fixada?: boolean }, versao: number) =>
      entrada('salvar_entrada', { p_id: id(entradaId, 'Anotação'), p: validarEntrada(dados, { criando: false }), p_versao: versaoDe(versao) }),
    fixarEntrada: (entradaId: string, fixada: boolean) => entrada('fixar_entrada', { p_id: id(entradaId, 'Anotação'), p_fixada: fixada === true }),
    arquivarEntrada: (entradaId: string) => entrada('arquivar_entrada', { p_id: id(entradaId, 'Anotação') }),
    desarquivarEntrada: (entradaId: string) => entrada('desarquivar_entrada', { p_id: id(entradaId, 'Anotação') }),
    excluirEntrada: async (entradaId: string, confirmado: boolean) => (await chamar('excluir_entrada', { p_id: id(entradaId, 'Anotação'), p_confirmado: confirmado === true })) as { id: string; excluida: true },
    /** Virar demanda: cria a demanda (o `id` é obrigatório, gerado pelo aplicativo) e liga a anotação a ela na mesma transação do banco. */
    criarDemandaDeEntrada: (entradaId: string, dados: DadosDemanda & { id: string }) => {
      if (!dados?.id) throw new ErroDmanda('Identificador da demanda não informado.');
      return demanda('criar_demanda_de_entrada', { p_entrada: id(entradaId, 'Anotação'), p: validarDados(dados, { criando: true }) });
    },
    adicionarTarefa: (demandaId: string, t: string) => demanda('adicionar_tarefa', { p_demanda: id(demandaId, 'Demanda'), p_texto: texto(t, 'Tarefa', 1000) }),
    editarTarefa: (tarefaId: string, t: string) => demanda('editar_tarefa', { p_id: id(tarefaId, 'Tarefa'), p_texto: texto(t, 'Tarefa', 1000) }),
    marcarTarefa: (tarefaId: string, concluida: boolean) => demanda('marcar_tarefa', { p_id: id(tarefaId, 'Tarefa'), p_concluida: concluida === true }),
    excluirTarefa: (tarefaId: string) => demanda('excluir_tarefa', { p_id: id(tarefaId, 'Tarefa') }),
  };
}
export type Operacoes = ReturnType<typeof criarOperacoes>;

/** Executa uma operação e devolve sempre um resultado; nunca finge sucesso. */
export async function executar<T>(f: () => Promise<T>): Promise<Resultado<T>> {
  try { return { ok: true, dados: await f() }; }
  catch (e) {
    if (e instanceof ErroConflito) return { ok: false, erro: e.message, conflito: true };
    if (e instanceof ErroDmanda) return { ok: false, erro: e.message };
    console.error('[dmanda] falha na operação:', e);
    return { ok: false, erro: 'Não foi possível concluir a operação. Nada foi gravado. Tente de novo.' };
  }
}
