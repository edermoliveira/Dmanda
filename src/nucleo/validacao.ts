// Validação das entradas das operações (puro, sem banco nem alias de importação: roda também nos testes de regras, direto no Node).
// As regras de negócio ficam no banco (migrações); aqui só se confere o formato e se traduz o erro em mensagem para a pessoa.
import { AREAS, ETAPAS, PRAZOS, TIPOS } from '../lib/demandas.ts';
import { BOTOES_PRAZO, CATEGORIAS_DIA, type CategoriaDia } from '../lib/prazos.ts';
import { COR_MAX_ACEITA, LIMITE_TEXTO, LIMITE_TITULO } from '../lib/entradas.ts';

/** Erro com texto próprio para mostrar na tela. */
export class ErroDmanda extends Error {}
/** A demanda mudou depois que a janela de edição foi aberta (outro aparelho ou janela): nada foi gravado e a tela precisa avisar sem apagar o que foi digitado. */
export class ErroConflito extends ErroDmanda {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const id = (v: unknown, nome: string) => { if (typeof v !== 'string' || !UUID.test(v)) throw new ErroDmanda(`${nome} inválido.`); return v; };
export const versaoDe = (v: unknown) => { if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ErroDmanda('Versão da demanda inválida. Recarregue a tela e abra a demanda de novo.'); return v; };
export const enumerado = <T extends string>(v: unknown, lista: readonly T[], nome: string) => { if (typeof v !== 'string' || !(lista as readonly string[]).includes(v)) throw new ErroDmanda(`${nome} inválido.`); return v as T; };
export const texto = (v: unknown, nome: string, max: number) => { if (typeof v !== 'string') throw new ErroDmanda(`${nome} inválido.`); if (v.length > max) throw new ErroDmanda(`${nome} passa de ${max} caracteres.`); return v; };
const dataOuNulo = (v: unknown, nome: string) => { if (v === null || v === '') return null; if (typeof v !== 'string' || !DATA.test(v) || Number.isNaN(Date.parse(v))) throw new ErroDmanda(`${nome} inválida.`); return v; };

/**
 * Confere o objeto vindo da tela e deixa só os campos conhecidos. Chave ausente = não mexe; null = limpa (chegada, prazo, setor, acompanhamento).
 * Só o assunto é obrigatório (e só na criação ou quando informado). Número, origem, descrição e chegada são opcionais e podem ficar vazios.
 * O vencimento nunca vem da tela: ela envia o prazo original (ou a quantidade de dias de um botão) e o banco calcula e guarda o vencimento ajustado.
 */
export function validarDados(entrada: unknown, { criando, aceitaEtapa = false }: { criando: boolean; aceitaEtapa?: boolean }): Record<string, unknown> {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErroDmanda('Dados da demanda inválidos.');
  const e = entrada as Record<string, unknown>, s: Record<string, unknown> = {};
  if ('id' in e && e.id !== undefined) s.id = id(e.id, 'Identificador');
  if ('assunto' in e) { const a = texto(e.assunto, 'Assunto', 300); if (!a.trim()) throw new ErroDmanda(criando ? 'Informe o assunto da demanda.' : 'O assunto não pode ficar vazio.'); s.assunto = a; }
  else if (criando) throw new ErroDmanda('Informe o assunto da demanda.');
  if ('numero' in e) s.numero = texto(e.numero, 'Número', 80);
  if ('origem' in e) s.origem = texto(e.origem, 'Origem', 160);
  if ('descricao' in e) s.descricao = texto(e.descricao, 'Descrição', 20_000);
  if ('tipo' in e) s.tipo = enumerado(e.tipo, TIPOS, 'Tipo');
  if ('area' in e) s.area = enumerado(e.area, AREAS, 'Área');
  if ('prazo_tipo' in e) s.prazo_tipo = enumerado(e.prazo_tipo, PRAZOS, 'Tipo de prazo');
  if ('chegou_em' in e) s.chegou_em = dataOuNulo(e.chegou_em, 'Data de chegada');
  if ('prazo_original' in e) s.prazo_original = dataOuNulo(e.prazo_original, 'Prazo');
  if ('prazo_dias' in e && e.prazo_dias !== null) { if (typeof e.prazo_dias !== 'number' || !(BOTOES_PRAZO as readonly number[]).includes(e.prazo_dias)) throw new ErroDmanda('Quantidade de dias do prazo inválida.'); s.prazo_dias = e.prazo_dias; }
  if ('acompanhar_em' in e) s.acompanhar_em = dataOuNulo(e.acompanhar_em, 'Data de acompanhamento');
  if ('setor' in e) s.setor = e.setor === null ? null : texto(e.setor, 'Setor', 160);
  if ((criando || aceitaEtapa) && 'etapa' in e && e.etapa !== undefined) s.etapa = enumerado(e.etapa, ETAPAS, 'Etapa');
  return s;
}

/** Dia indisponível (feriado ou evento externo de dia inteiro) vindo da tela. Com "id" altera, sem "id" cria. */
export function validarDia(entrada: unknown): { id?: string; data: string; descricao: string; categoria: CategoriaDia } {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErroDmanda('Dados do dia inválidos.');
  const e = entrada as Record<string, unknown>;
  const data = dataOuNulo(e.data ?? null, 'Data');
  if (!data) throw new ErroDmanda('Informe a data.');
  const descricao = texto(e.descricao, 'Descrição', 160).trim();
  if (!descricao) throw new ErroDmanda('Descreva o dia, por exemplo: Natal.');
  const categoria = enumerado(e.categoria, CATEGORIAS_DIA, 'Categoria');
  return { ...(e.id ? { id: id(e.id, 'Dia') } : {}), data, descricao, categoria };
}

/**
 * Anotação de Entradas vinda da tela. Chave ausente = não mexe; na criação, "cor" ausente ou nula = o banco escolhe entre as menos usadas.
 * Nenhuma anotação fica completamente vazia: precisa de título ou de texto (na alteração, o banco confere o resultado final, porque a tela só envia o que mudou).
 */
export function validarEntrada(entrada: unknown, { criando }: { criando: boolean }): Record<string, unknown> {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErroDmanda('Dados da anotação inválidos.');
  const e = entrada as Record<string, unknown>, s: Record<string, unknown> = {};
  if ('id' in e && e.id !== undefined) s.id = id(e.id, 'Identificador');
  if ('titulo' in e) s.titulo = texto(e.titulo, 'Título', LIMITE_TITULO + 1000).trim();
  if ('texto' in e) s.texto = texto(e.texto, 'Texto', LIMITE_TEXTO + 1000).trim();
  if (typeof s.titulo === 'string' && s.titulo.length > LIMITE_TITULO) throw new ErroDmanda(`O título passa de ${LIMITE_TITULO} caracteres.`);
  if (typeof s.texto === 'string' && s.texto.length > LIMITE_TEXTO) throw new ErroDmanda(`O texto passa de ${LIMITE_TEXTO} caracteres.`);
  if ('cor' in e && e.cor !== null && e.cor !== undefined) { if (typeof e.cor !== 'number' || !Number.isInteger(e.cor) || e.cor < 0 || e.cor > COR_MAX_ACEITA) throw new ErroDmanda('Cor inválida.'); s.cor = e.cor; }
  if ('fixada' in e && e.fixada !== undefined) { if (typeof e.fixada !== 'boolean') throw new ErroDmanda('Fixação inválida.'); s.fixada = e.fixada; }
  if (criando && !String(s.titulo ?? '') && !String(s.texto ?? '')) throw new ErroDmanda('Escreva um título ou o texto da anotação.');
  if (!criando && 'titulo' in s && 'texto' in s && !s.titulo && !s.texto) throw new ErroDmanda('A anotação não pode ficar vazia. Para tirá-la da lista, arquive.');
  return s;
}

export type TarefaEdicao = { id?: string; texto: string; concluida: boolean };
export function validarTarefas(l: unknown): TarefaEdicao[] | null {
  if (l === null || l === undefined) return null;
  if (!Array.isArray(l) || l.length > 500) throw new ErroDmanda('Lista de tarefas inválida.');
  return l.map((t) => {
    if (!t || typeof t !== 'object') throw new ErroDmanda('Tarefa inválida.');
    const x = t as Record<string, unknown>, tx = texto(x.texto, 'Tarefa', 1000);
    if (!tx.trim()) throw new ErroDmanda('A tarefa não pode ficar vazia.');
    return { ...(x.id ? { id: id(x.id, 'Tarefa') } : {}), texto: tx, concluida: x.concluida === true };
  });
}

