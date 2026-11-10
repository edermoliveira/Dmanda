// Regras de prazo do Dmanda (DECISOES.md, decisão 27). Funções puras, sem relógio: a data de hoje vem sempre de fora.
// O banco é quem decide de verdade (função ajustar_prazo, na migração 20261029000000, que recalcula também no servidor); esta cópia serve à prévia do
// formulário e deve dar exatamente o mesmo resultado e o mesmo texto de explicação (há teste de equivalência contra o SQL).

export const CATEGORIAS_DIA = ['Feriado', 'Evento externo'] as const;
export type CategoriaDia = (typeof CATEGORIAS_DIA)[number];
export const ROTULO_CATEGORIA: Record<CategoriaDia, string> = { Feriado: 'Feriado', 'Evento externo': 'Evento externo de dia inteiro' };
export type DiaIndisponivel = { id: string; data: string; descricao: string; categoria: CategoriaDia; criado_em?: string };

/** Botões de prazo: dias corridos a partir de hoje, excluindo o dia inicial e incluindo o último. */
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

/** Prazo original calculado pelos botões: hoje mais N dias corridos (a referência é o dia da definição, nunca "quando chegou"). */
export const prazoPorDias = (dias: number, hoje: string) => somarDias(hoje, dias);

// ---------- atalhos de 5, 10, 20 e 30 dias: a data-base é o DIA DO CLIQUE (decisão 31) ----------
// O botão guarda três coisas juntas: os dias, o dia em que foi escolhido (a base) e o prazo original (base + dias). Reabrir um rascunho ou virar o dia não mexe em nenhuma delas;
// só um novo clique escolhe outra base. A tela e o banco conferem que as três concordam (a data exibida é a gravada).
/** O que o formulário sabe do prazo. `prazo_base_em` vazio = sem atalho (data escolhida à mão). */
export type PrazoDoFormulario = { prazo_original: string; prazo_dias: number | null; prazo_base_em: string };
/** O que já está gravado na demanda. */
export type PrazoGravado = { prazo_original: string | null; prazo_dias: number | null; prazo_base_em: string | null };

const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && paraISO(emMs(v)) === v;

/**
 * Deixa o prazo do formulário coerente ao recuperar um rascunho. Com atalho, a base precisa ser uma data real que não esteja no futuro e base + dias precisa dar o prazo original.
 * Rascunho legado (tem os dias e a data original, mas não a base): a base é recuperada como prazo original − dias, porque o atalho a determina; só assim o atalho é preservado.
 * Quando a base não puder ser recuperada com segurança (dias que não são de um botão, data inválida ou base no futuro), vira prazo manual: a data exibida é mantida e os dias saem.
 * Não há limite de antiguidade: a base de um rascunho antigo e válido é preservada.
 */
export function normalizarAtalho<T extends PrazoDoFormulario>(p: T, hoje: string): T {
  if (p.prazo_dias === null) return p.prazo_base_em ? { ...p, prazo_base_em: '' } : p;
  const manual = { ...p, prazo_dias: null, prazo_base_em: '' };
  if (!p.prazo_original || !dataValida(p.prazo_original) || !(BOTOES_PRAZO as readonly number[]).includes(p.prazo_dias)) return manual;
  if (p.prazo_base_em && dataValida(p.prazo_base_em) && p.prazo_base_em <= hoje && somarDias(p.prazo_base_em, p.prazo_dias) === p.prazo_original) return p;
  const base = somarDias(p.prazo_original, -p.prazo_dias);
  return base <= hoje ? { ...p, prazo_base_em: base } : manual;
}

/**
 * O que enviar ao servidor sobre o prazo. Vai sempre a data original (vazia = sem prazo). Os dias e a base do atalho só vão quando mudaram em relação ao que está gravado
 * (ou quando não há demanda ainda): regravar o mesmo prazo não muda a referência da contagem.
 */
export function dadosDoPrazo(p: PrazoDoFormulario, gravado: PrazoGravado | null): { prazo_original: string | null; prazo_dias?: number; prazo_base_em?: string } {
  const atalho = p.prazo_dias !== null && !!p.prazo_original && !!p.prazo_base_em
    && (!gravado || p.prazo_original !== gravado.prazo_original || p.prazo_dias !== gravado.prazo_dias || p.prazo_base_em !== gravado.prazo_base_em);
  return { prazo_original: p.prazo_original || null, ...(atalho ? { prazo_dias: p.prazo_dias as number, prazo_base_em: p.prazo_base_em } : {}) };
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
