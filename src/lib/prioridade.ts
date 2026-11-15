// Prioridade máxima dos pedidos da Prefeita e do Gabinete (decisão 61, trazida da branch do Início só como regra pura de apresentação, em 15/11/2026). A regra é derivada do campo Origem da demanda:
// nenhuma coluna, nenhum dado novo, nenhuma migração, e o texto gravado nunca é alterado. Sem relógio e sem React.
//
// O que ativa: a origem inteira (sem diferença de maiúsculas, acentos ou espaços repetidos) é uma das ORIGENS_PRIORITARIAS. A comparação é exata, nunca por trecho: "Gabinete do Vice-Prefeito"
// ou "Prefeitura de Gramado" NÃO ativam. O que NÃO ativa: uma menção à Prefeita no assunto ou na descrição e a etapa "Aguardando Prefeita" (que só diz onde a demanda espera).
// Demanda finalizada ou arquivada não está na fila ativa, então não recebe a prioridade.
import { chaveOpcao } from './documentos.ts';
import type { Demanda } from './demandas.ts';

/** Nomes de origem reconhecidos de forma explícita e centralizada. "Prefeita" é a opção padrão do cadastro; os demais são equivalentes escritos à mão. */
export const ORIGENS_PRIORITARIAS = [
  'Prefeita', 'Pedido da Prefeita', 'Solicitação da Prefeita',
  'Gabinete', 'Gabinete da Prefeita', 'Pedido do Gabinete', 'Solicitação do Gabinete',
  'Pedido do Gabinete da Prefeita', 'Solicitação do Gabinete da Prefeita',
] as const;

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
const chave = (nome: string | null | undefined) => semAcento(chaveOpcao(nome));
const CHAVES = new Set<string>(ORIGENS_PRIORITARIAS.map((n) => chave(n)));

type ComOrigem = Pick<Demanda, 'origem' | 'etapa' | 'arquivada_em'>;

/** A origem, sozinha, é de um pedido da Prefeita ou do Gabinete? (não olha etapa nem arquivamento) */
export const ehOrigemPrioritaria = (origem: string | null | undefined): boolean => CHAVES.has(chave(origem));

/** A demanda está na fila ativa e a origem é prioritária. */
export const demandaPrioritaria = (d: ComOrigem): boolean => d.etapa !== 'Finalizado' && !d.arquivada_em && ehOrigemPrioritaria(d.origem);

/** As prioritárias antes das comuns; a ordem relativa de cada grupo é a que a lista já tinha (partição estável). */
export function prioritariasPrimeiro<T extends ComOrigem>(lista: readonly T[]): T[] {
  const primeiras: T[] = [], demais: T[] = [];
  for (const d of lista) (demandaPrioritaria(d) ? primeiras : demais).push(d);
  return [...primeiras, ...demais];
}
