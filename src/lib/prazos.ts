// Regras de prazo do Dmanda (DECISOES.md, decisão 27). Funções puras, sem relógio: a data de hoje vem sempre de fora.
// O banco é quem decide de verdade (função ajustar_prazo, na migração 20261029000000, que recalcula também no servidor); esta cópia serve à prévia do
// formulário e deve dar exatamente o mesmo resultado e o mesmo texto de explicação (há teste de equivalência contra o SQL).

export const CATEGORIAS_DIA = ['Feriado', 'Evento externo'] as const;
export type CategoriaDia = (typeof CATEGORIAS_DIA)[number];
export const ROTULO_CATEGORIA: Record<CategoriaDia, string> = { Feriado: 'Feriado', 'Evento externo': 'Evento externo de dia inteiro' };
export type DiaIndisponivel = { id: string; data: string; descricao: string; categoria: CategoriaDia; criado_em?: string };

/** Botões de prazo: dias corridos a partir da data de chegada, excluindo o dia da chegada e incluindo o último (decisão 81). */
export const BOTOES_PRAZO = [5, 10, 20, 30] as const;

const MS_DIA = 86_400_000;
const emMs = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(a, m - 1, d); };
const paraISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Soma dias corridos a uma data AAAA-MM-DD (sem fuso: tudo em UTC, então não há deslocamento de dia). */
export const somarDias = (iso: string, n: number) => paraISO(emMs(iso) + n * MS_DIA);
/** Dia da semana de uma data AAAA-MM-DD: 0 domingo, 6 sábado. */
export const diaDaSemana = (iso: string) => new Date(emMs(iso)).getUTCDay();
const NOMES_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const nomeDoDia = (iso: string) => NOMES_DIA[diaDaSemana(iso)];
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Prazo original calculado pelos botões: a data de chegada mais N dias corridos. A referência é sempre a chegada: nunca o dia do cadastro, o da edição nem o de hoje. */
export const prazoPorDias = (dias: number, chegada: string) => somarDias(chegada, dias);
/** O que falta quando se pede um prazo por duração sem a data de chegada (o banco devolve exatamente este texto). */
export const textoFaltaChegada = (dias: number) => `Informe a data de chegada para calcular o prazo de ${dias} dias.`;
/**
 * A duração em dias está "viva" quando foi contada a partir da chegada que a demanda tem agora (prazo_base_em = chegou_em). Só então mudar a chegada recalcula o prazo.
 * Duração gravada pela regra anterior (contada de outro dia) e data escolhida à mão não são recalculadas: o vencimento registrado e o seu significado ficam.
 */
export const duracaoViva = (c: { chegou_em: string | null; prazo_dias: number | null; prazo_base_em: string | null }) => c.prazo_dias !== null && !!c.chegou_em && c.prazo_base_em === c.chegou_em;
/** Rascunho guardado antes da etapa 4: tem os dias mas não a base da contagem, então a contagem não é viva (vale a data que a pessoa viu, sem recalcular nem enviar os dias). */
export const sanearRascunho = <T extends { prazo_dias?: number | null; prazo_base_em?: string | null }>(dados: T | undefined): T | undefined => (dados && dados.prazo_dias != null && !('prazo_base_em' in dados) ? ({ ...dados, prazo_base_em: '' } as T) : dados);
/** Nova data original e nova base quando a chegada muda numa demanda de duração viva; nulo quando não há o que recalcular (sem nova chegada ou sem duração viva). */
export function recontarPelaChegada(c: { chegou_em: string | null; prazo_dias: number | null; prazo_base_em: string | null }, nova: string | null): { prazo_original: string; prazo_base_em: string } | null {
  return nova && duracaoViva(c) ? { prazo_original: prazoPorDias(c.prazo_dias!, nova), prazo_base_em: nova } : null;
}

export type PrazoAjustado = { prazo: string; ajuste: string | null };

/**
 * Antecipa a data original, dia a dia, até o primeiro dia disponível: nem sábado, nem domingo, nem dia cadastrado (feriado ou evento externo de dia inteiro).
 * O texto de explicação lista cada dia pulado e o motivo, como o banco: "21/11 sábado; 20/11 feriado: Consciência Negra".
 */
export function ajustarPrazo(original: string, dias: readonly DiaIndisponivel[]): PrazoAjustado {
  const porData = new Map<string, DiaIndisponivel[]>();
  for (const x of [...dias].sort((a, b) => (a.criado_em ?? '').localeCompare(b.criado_em ?? '') || a.id.localeCompare(b.id))) porData.set(x.data, [...(porData.get(x.data) ?? []), x]);
  const pulados: string[] = [];
  let d = original;
  for (let n = 1; ; n++) {
    if (n > 400) throw new Error('Não há dia disponível nos 400 dias anteriores a essa data. Confira os dias indisponíveis cadastrados.');
    const semana = diaDaSemana(d);
    const razoes = [...(semana === 6 ? ['sábado'] : semana === 0 ? ['domingo'] : []), ...(porData.get(d) ?? []).map((x) => `${x.categoria.toLowerCase()}: ${x.descricao.trim()}`)];
    if (!razoes.length) break;
    pulados.push(`${diaMes(d)} ${razoes.join(', ')}`);
    d = somarDias(d, -1);
  }
  return { prazo: d, ajuste: pulados.length ? pulados.join('; ') : null };
}

const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** "sex, 05/03/2027": a data com o dia da semana, para a pessoa conferir o que o ajuste fez. */
export const dataComSemana = (iso: string) => `${SEMANA_CURTA[diaDaSemana(iso)]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
