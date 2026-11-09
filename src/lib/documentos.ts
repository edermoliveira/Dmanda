// Documento associado de uma demanda: o ano reconhecido no número e as chaves de comparação das opções (origem e tipo). Regras puras, sem banco nem relógio.
// O número fica SEMPRE como foi informado; o ano é à parte. Quem confirma o ano à mão (campo `documento_ano` da demanda) vence o reconhecimento.

const ANO_MIN = 1990, ANO_MAX = 2100;
const quatro = (s: string) => s.length === 4 && Number(s) >= ANO_MIN && Number(s) <= ANO_MAX;

/**
 * Reconhece o ano de um número só em formato inequívoco: "32/2026" ou "2024/1250" (dois grupos de dígitos separados por barra, com exatamente um deles sendo um ano de 4 dígitos
 * entre 1990 e 2100). Ausente ou ambíguo (nenhum ou os dois grupos parecem ano, como "2024/2025"), devolve null: a demanda segue sem ano e continua aparecendo em "Todos".
 */
export function anoReconhecido(numero: string | null | undefined): number | null {
  const m = /^\s*(\d{1,6})\s*\/\s*(\d{1,6})\s*$/.exec(numero ?? '');
  if (!m) return null;
  const a = quatro(m[1]), b = quatro(m[2]);
  if (a === b) return null;
  return Number(a ? m[1] : m[2]);
}

/** O ano que vale para a demanda: o confirmado à mão ou, sem ele, o reconhecido no número. */
export const anoDoDocumento = (d: { numero: string; documento_ano?: number | null }): number | null => d.documento_ano ?? anoReconhecido(d.numero);

/** Chave de comparação de origem e tipo: sem diferença de maiúsculas ou de espaços repetidos (a mesma regra do banco). */
export const chaveOpcao = (nome: string | null | undefined) => (nome ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export type Opcao = { id: string; campo: 'origem' | 'tipo'; nome: string };
