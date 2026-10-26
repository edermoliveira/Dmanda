// Operações de demandas, tarefas e etapas, com validação das entradas, independentes de interface e de transporte.
// A interface (ações do servidor) e, no futuro, a IA operacional chamam estas funções. As regras de negócio ficam no banco (migrações);
// aqui só se confere o formato e se traduz o erro em mensagem para a pessoa.
import { AREAS, ETAPAS, PRAZOS, TIPOS, type DadosDemanda, type Demanda, type Etapa } from '@/lib/demandas';

export type Chamar = (funcao: string, args: Record<string, unknown>) => Promise<unknown>;
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string; conflito?: true };

/** Erro com texto próprio para mostrar na tela. */
export class ErroDmanda extends Error {}
/** A demanda mudou depois que a janela de edição foi aberta (outro aparelho ou janela): nada foi gravado e a tela precisa avisar sem apagar o que foi digitado. */
export class ErroConflito extends ErroDmanda {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const id = (v: unknown, nome: string) => { if (typeof v !== 'string' || !UUID.test(v)) throw new ErroDmanda(`${nome} inválido.`); return v; };
const versaoDe = (v: unknown) => { if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ErroDmanda('Versão da demanda inválida. Recarregue a tela e abra a demanda de novo.'); return v; };
const enumerado = <T extends string>(v: unknown, lista: readonly T[], nome: string) => { if (typeof v !== 'string' || !(lista as readonly string[]).includes(v)) throw new ErroDmanda(`${nome} inválido.`); return v as T; };
const texto = (v: unknown, nome: string, max: number) => { if (typeof v !== 'string') throw new ErroDmanda(`${nome} inválido.`); if (v.length > max) throw new ErroDmanda(`${nome} passa de ${max} caracteres.`); return v; };
const dataOuNulo = (v: unknown, nome: string) => { if (v === null || v === '') return null; if (typeof v !== 'string' || !DATA.test(v) || Number.isNaN(Date.parse(v))) throw new ErroDmanda(`${nome} inválida.`); return v; };

/** Confere o objeto vindo da tela e deixa só os campos conhecidos. Chave ausente = não mexe; null = limpa (prazo, setor, acompanhamento). */
export function validarDados(entrada: unknown, { criando, aceitaEtapa = false }: { criando: boolean; aceitaEtapa?: boolean }): Record<string, unknown> {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErroDmanda('Dados da demanda inválidos.');
  const e = entrada as Record<string, unknown>, s: Record<string, unknown> = {};
  if ('assunto' in e) { const a = texto(e.assunto, 'Assunto', 300); if (!a.trim()) throw new ErroDmanda(criando ? 'Informe o assunto da demanda.' : 'O assunto não pode ficar vazio.'); s.assunto = a; }
  else if (criando) throw new ErroDmanda('Informe o assunto da demanda.');
  if ('numero' in e) s.numero = texto(e.numero, 'Número', 80);
  if ('origem' in e) s.origem = texto(e.origem, 'Origem', 160);
  if ('descricao' in e) s.descricao = texto(e.descricao, 'Descrição', 20_000);
  if ('tipo' in e) s.tipo = enumerado(e.tipo, TIPOS, 'Tipo');
  if ('area' in e) s.area = enumerado(e.area, AREAS, 'Área');
  if ('prazo_tipo' in e) s.prazo_tipo = enumerado(e.prazo_tipo, PRAZOS, 'Tipo de prazo');
  if ('chegou_em' in e) { const d = dataOuNulo(e.chegou_em, 'Data de chegada'); if (d) s.chegou_em = d; }
  if ('prazo' in e) s.prazo = dataOuNulo(e.prazo, 'Prazo');
  if ('acompanhar_em' in e) s.acompanhar_em = dataOuNulo(e.acompanhar_em, 'Data de acompanhamento');
  if ('setor' in e) s.setor = e.setor === null ? null : texto(e.setor, 'Setor', 160);
  if ((criando || aceitaEtapa) && 'etapa' in e && e.etapa !== undefined) s.etapa = enumerado(e.etapa, ETAPAS, 'Etapa');
  return s;
}

export type TarefaEdicao = { id?: string; texto: string; concluida: boolean };
function validarTarefas(l: unknown): TarefaEdicao[] | null {
  if (l === null || l === undefined) return null;
  if (!Array.isArray(l) || l.length > 500) throw new ErroDmanda('Lista de tarefas inválida.');
  return l.map((t) => {
    if (!t || typeof t !== 'object') throw new ErroDmanda('Tarefa inválida.');
    const x = t as Record<string, unknown>, tx = texto(x.texto, 'Tarefa', 1000);
    if (!tx.trim()) throw new ErroDmanda('A tarefa não pode ficar vazia.');
    return { ...(x.id ? { id: id(x.id, 'Tarefa') } : {}), texto: tx, concluida: x.concluida === true };
  });
}

export function criarOperacoes(chamar: Chamar) {
  const demanda = async (f: string, a: Record<string, unknown>) => (await chamar(f, a)) as Demanda;
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
