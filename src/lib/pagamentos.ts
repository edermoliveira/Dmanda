// Pagamentos (decisão 64): a data do salário, cadastrada uma a uma em Configurações, sem valor e sem recorrência automática. Regras puras, sem relógio.
// Datas são datas do calendário (AAAA-MM-DD, America/Sao_Paulo), nunca passam por Date local.
export type Pagamento = { id: string; data: string; criado_em?: string };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
/** A data existe no calendário (31/02 não existe). */
export const dataExiste = (v: string) => { if (!DATA.test(v)) return false; const [a, m, d] = v.split('-').map(Number); const x = new Date(Date.UTC(a, m - 1, d)); return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; };

/** Confere a data digitada (a mesma regra da tela e do servidor). Devolve a mensagem para a pessoa, ou nulo quando está certa. `outros`: os pagamentos que já existem (o próprio, na edição, fica de fora por id). */
export function erroDoPagamento(data: string, outros: readonly Pagamento[] = [], idAtual?: string): string | null {
  if (!data) return 'Informe a data do pagamento.';
  if (!dataExiste(data)) return 'Informe uma data que exista no calendário.';
  if (outros.some((p) => p.data === data && p.id !== idAtual)) return 'Já existe um pagamento cadastrado nesta data.';
  return null;
}
export const ordenarPagamentos = <T extends Pick<Pagamento, 'data'>>(l: readonly T[]): T[] => [...l].sort((a, b) => a.data.localeCompare(b.data));
