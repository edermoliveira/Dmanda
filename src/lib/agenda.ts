// Regras puras da Agenda (decisões 46 a 49): grade do mês e da semana, marcos das demandas (vencimento, acompanhamento e retorno do setor), data aplicável,
// carga pendente do heatmap e dias mais cheios. Sem banco e sem relógio: "hoje" vem sempre de fora. Todas as datas são datas do calendário (AAAA-MM-DD), em UTC puro,
// então não há deslocamento por fuso. Vencimento, ajuste de prazo e dias indisponíveis seguem exatamente as regras de prazos.ts: nada aqui reescreve um vencimento.
import { ajustarPrazo, diaDaSemana, somarDias, type DiaIndisponivel } from './prazos.ts';
import { dataBR, diasAte, hojeISO, type Demanda } from './demandas.ts';
import { ordenarEventos, type Evento } from './eventos.ts';

// ---------- calendário ----------
export const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const SEMANA_INICIAIS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const SEMANA_NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const NOMES_DIA_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const anoMes = (iso: string) => ({ ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) });
export const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const dois = (n: number) => String(n).padStart(2, '0');
export const primeiroDoMes = (iso: string) => `${iso.slice(0, 7)}-01`;
export const tituloMes = (iso: string) => { const { ano, mes } = anoMes(iso); return `${NOMES_MES[mes - 1]} de ${ano}`; };

/** Soma meses mantendo o dia, ou o último dia do mês de destino quando ele não existe (31 de janeiro + 1 mês = 28 ou 29 de fevereiro). */
export function somarMeses(iso: string, n: number): string {
  const { ano, mes } = anoMes(iso);
  const total = ano * 12 + (mes - 1) + n, a = Math.floor(total / 12), m = ((total % 12) + 12) % 12 + 1;
  return `${a}-${dois(m)}-${dois(Math.min(Number(iso.slice(8, 10)), diasNoMes(a, m)))}`;
}

/** Grade do mês: semanas de domingo a sábado; as posições antes do dia 1 e depois do último dia são nulas (vazias). O número de semanas muda com o mês (4 a 6). */
export function gradeMes(ano: number, mes: number): (string | null)[][] {
  const primeiro = `${ano}-${dois(mes)}-01`, inicio = diaDaSemana(primeiro), total = diasNoMes(ano, mes);
  const celulas: (string | null)[] = [...Array<null>(inicio).fill(null), ...Array.from({ length: total }, (_, i) => `${ano}-${dois(mes)}-${dois(i + 1)}`)];
  while (celulas.length % 7) celulas.push(null);
  return Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));
}
/** A semana (domingo a sábado) que contém a data. */
export const semanaDe = (iso: string): string[] => { const d = somarDias(iso, -diaDaSemana(iso)); return Array.from({ length: 7 }, (_, i) => somarDias(d, i)); };
export const fimDeSemana = (iso: string) => diaDaSemana(iso) === 0 || diaDaSemana(iso) === 6;
export const nomeLongoDoDia = (iso: string) => NOMES_DIA_LONGO[diaDaSemana(iso)];
/** "terça-feira, 3 de novembro de 2026" */
export const dataPorExtenso = (iso: string) => `${nomeLongoDoDia(iso)}, ${Number(iso.slice(8, 10))} de ${NOMES_MES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
export const diaDoMes = (iso: string) => Number(iso.slice(8, 10));
export const rotuloSemana = (dias: readonly string[]) => {
  const a = dias[0], b = dias[6], mA = NOMES_MES[Number(a.slice(5, 7)) - 1], mB = NOMES_MES[Number(b.slice(5, 7)) - 1];
  return a.slice(0, 7) === b.slice(0, 7) ? `${diaDoMes(a)} a ${diaDoMes(b)} de ${mA} de ${a.slice(0, 4)}` : `${diaDoMes(a)} de ${mA.slice(0, 3)} a ${diaDoMes(b)} de ${mB.slice(0, 3)} de ${b.slice(0, 4)}`;
};

// ---------- marcos das demandas ----------
export type TipoMarco = 'vencimento' | 'acompanhamento' | 'retorno';
export const ROTULO_MARCO: Record<TipoMarco, string> = { vencimento: 'Vencimento', acompanhamento: 'Acompanhar', retorno: 'Retorno do setor' };
export type Marco = { tipo: TipoMarco; data: string; demanda: Demanda; atrasado: boolean; detalhe: string };
/** Dias corridos até cobrar o retorno de outro setor, contados do encaminhamento (exclui o primeiro dia, inclui o último). */
export const DIAS_RETORNO_SETOR = 10;

export type ContagemRetorno = { data: string; original: string; base: string; origemBase: 'reiteração' | 'encaminhamento' | 'entrada na etapa'; ajuste: string | null };
/**
 * Marco de retorno de outro setor: 10 dias corridos a partir do efetivo encaminhamento (data informada) ou, sem ela, do dia em que a demanda entrou em Aguardando retorno.
 * Reiteração registrada inicia uma nova contagem a partir dela (vale a mais recente entre encaminhamento e reiteração). Se o limite cai em dia indisponível,
 * antecipa para o dia disponível anterior (mesma regra dos prazos). Não altera o vencimento da demanda nem o campo manual "Acompanhar em". Fora da etapa, nulo.
 */
export function contagemRetorno(d: Pick<Demanda, 'etapa' | 'etapa_desde' | 'encaminhada_em' | 'reiterada_em' | 'arquivada_em'>, dias: readonly DiaIndisponivel[]): ContagemRetorno | null {
  if (d.etapa !== 'Aguardando retorno' || d.arquivada_em) return null;
  const candidatas: [string, ContagemRetorno['origemBase']][] = [];
  if (d.encaminhada_em) candidatas.push([d.encaminhada_em, 'encaminhamento']);
  if (d.reiterada_em) candidatas.push([d.reiterada_em, 'reiteração']);
  const [base, origemBase]: [string, ContagemRetorno['origemBase']] = candidatas.length ? candidatas.sort((a, b) => b[0].localeCompare(a[0]))[0] : [hojeISO(new Date(d.etapa_desde)), 'entrada na etapa'];
  const original = somarDias(base, DIAS_RETORNO_SETOR), aj = ajustarPrazo(original, dias);
  return { data: aj.prazo, original, base, origemBase, ajuste: aj.ajuste };
}

/**
 * Todos os marcos de uma demanda em aberto: vencimento (o ajustado já gravado), "Acompanhar em" (a data digitada) e, em Aguardando retorno, o retorno do setor calculado.
 * Cada um fica na própria data; o que já passou fica na data em que ocorreu, marcado como atrasado. Arquivada não tem marcos. Finalizada só aparece (no vencimento, sem atraso)
 * quando `comFinalizadas` pede. Aguardando Prefeita não tem marco de data: a espera aparece como texto na própria demanda.
 */
export function marcosDaDemanda(d: Demanda, dias: readonly DiaIndisponivel[], hoje: string, comFinalizadas = false): Marco[] {
  if (d.arquivada_em) return [];
  if (d.etapa === 'Finalizado') return comFinalizadas && d.prazo ? [{ tipo: 'vencimento', data: d.prazo, demanda: d, atrasado: false, detalhe: 'Demanda finalizada' }] : [];
  const m: Marco[] = [];
  if (d.prazo) m.push({ tipo: 'vencimento', data: d.prazo, demanda: d, atrasado: diasAte(d.prazo, hoje) < 0, detalhe: d.prazo_original && d.prazo_original !== d.prazo ? `Prazo original ${dataBR(d.prazo_original)}, antecipado` : `Prazo ${d.prazo_tipo.toLowerCase()}` });
  if (d.acompanhar_em) m.push({ tipo: 'acompanhamento', data: d.acompanhar_em, demanda: d, atrasado: diasAte(d.acompanhar_em, hoje) < 0, detalhe: 'Data digitada em Acompanhar em' });
  const r = contagemRetorno(d, dias);
  if (r) m.push({ tipo: 'retorno', data: r.data, demanda: d, atrasado: diasAte(r.data, hoje) < 0, detalhe: `${DIAS_RETORNO_SETOR} dias desde ${dataBR(r.base)} (${r.origemBase})${r.ajuste ? `; antecipado: ${r.ajuste}` : ''}` });
  return m.sort((a, b) => a.data.localeCompare(b.data));
}
/** Data aplicável: a mais próxima do calendário entre os marcos (a primeira data programada). Os demais marcos continuam existindo, cada um no seu dia. Sem marcos, nulo. */
export const dataAplicavel = (marcos: readonly Marco[]): string | null => (marcos.length ? marcos.reduce((m, x) => (x.data < m ? x.data : m), marcos[0].data) : null);

// ---------- carga pendente (heatmap) ----------
/**
 * Carga pendente de uma demanda: as tarefas não concluídas. Sem tarefas vale uma unidade; com todas as tarefas concluídas e a demanda ainda aberta também vale uma (falta concluir a demanda).
 * Finalizada e arquivada não somam nada.
 */
export function cargaDaDemanda(d: Demanda): number {
  if (d.etapa === 'Finalizado' || d.arquivada_em) return 0;
  const pendentes = d.tarefas.filter((t) => !t.concluida).length;
  return pendentes > 0 ? pendentes : 1;
}
export type NivelCarga = 'zero' | 'baixa' | 'media' | 'alta';
/** Limiares do heatmap: 0 sem pendências; 1 a 3 baixa; 4 a 7 média; 8 ou mais alta (oito tarefas pendentes num só dia já são mais que um dia de trabalho). */
export const LIMIARES_CARGA = { baixa: 1, media: 4, alta: 8 } as const;
export const nivelDaCarga = (n: number): NivelCarga => (n >= LIMIARES_CARGA.alta ? 'alta' : n >= LIMIARES_CARGA.media ? 'media' : n >= LIMIARES_CARGA.baixa ? 'baixa' : 'zero');
export const ROTULO_NIVEL: Record<NivelCarga, string> = { zero: 'sem pendências', baixa: 'carga baixa', media: 'carga média', alta: 'carga alta' };

export type CargaDia = { carga: number; demandas: number; atrasada: boolean };
/** Cada demanda soma a carga uma só vez, no dia da data aplicável, mesmo tendo vários marcos. Demandas sem nenhum marco ficam fora (vão para Pendências sem prazo). */
export function cargaPorDia(demandas: readonly Demanda[], dias: readonly DiaIndisponivel[], hoje: string): Map<string, CargaDia> {
  const mapa = new Map<string, CargaDia>();
  for (const d of demandas) {
    const c = cargaDaDemanda(d);
    if (!c) continue;
    const data = dataAplicavel(marcosDaDemanda(d, dias, hoje));
    if (!data) continue;
    const x = mapa.get(data) ?? { carga: 0, demandas: 0, atrasada: false };
    x.carga += c; x.demandas += 1; x.atrasada = x.atrasada || diasAte(data, hoje) < 0;
    mapa.set(data, x);
  }
  return mapa;
}
/** Demandas abertas sem nenhuma data aplicável: nada é inventado, elas ficam numa lista própria. Das que chegaram há mais tempo para as mais recentes. */
export function pendenciasSemPrazo(demandas: readonly Demanda[], dias: readonly DiaIndisponivel[], hoje: string): Demanda[] {
  return demandas
    .filter((d) => d.etapa !== 'Finalizado' && !d.arquivada_em && marcosDaDemanda(d, dias, hoje).length === 0)
    .sort((a, b) => (a.chegou_em ?? '9999').localeCompare(b.chegou_em ?? '9999') || a.criado_em.localeCompare(b.criado_em));
}

// ---------- o dia ----------
export type ItensDoDia = { data: string; eventos: Evento[]; indisponiveis: DiaIndisponivel[]; marcos: Marco[] };
export type OpcoesAgenda = { demandas: readonly Demanda[]; eventos: readonly Evento[]; indisponiveis: readonly DiaIndisponivel[]; hoje: string; comFinalizadas?: boolean };
/** Tudo o que cai num dia, no desenho da Agenda: eventos em ordem cronológica, dias indisponíveis e marcos das demandas (atrasados primeiro, depois por tipo). */
export function itensDoDia(data: string, o: OpcoesAgenda): ItensDoDia {
  const ordem: Record<TipoMarco, number> = { vencimento: 0, retorno: 1, acompanhamento: 2 };
  const marcos = o.demandas.flatMap((d) => marcosDaDemanda(d, o.indisponiveis, o.hoje, o.comFinalizadas)).filter((m) => m.data === data)
    .sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || ordem[a.tipo] - ordem[b.tipo] || a.demanda.criado_em.localeCompare(b.demanda.criado_em));
  return { data, eventos: ordenarEventos(o.eventos.filter((e) => e.data === data)), indisponiveis: o.indisponiveis.filter((x) => x.data === data), marcos };
}
/** Marcos de um intervalo de datas (inclusive), agrupados por dia: usado pela semana e pelo mês. */
export function marcosPorDia(o: OpcoesAgenda, de: string, ate: string): Map<string, Marco[]> {
  const mapa = new Map<string, Marco[]>();
  for (const d of o.demandas) for (const m of marcosDaDemanda(d, o.indisponiveis, o.hoje, o.comFinalizadas)) if (m.data >= de && m.data <= ate) mapa.set(m.data, [...(mapa.get(m.data) ?? []), m]);
  return mapa;
}

const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
/** Descrição acessível de um dia: a quantidade, o atraso, os compromissos e as marcas que a cor sozinha não conta. */
export function descreverDia(data: string, o: { carga?: CargaDia; eventos: number; indisponiveis: readonly DiaIndisponivel[]; hoje: string; selecionado?: boolean }): string {
  const p: string[] = [dataPorExtenso(data)];
  if (data === o.hoje) p.push('hoje');
  const c = o.carga;
  p.push(c && c.carga ? `${plural(c.carga, 'pendência')} em ${plural(c.demandas, 'demanda')}, ${ROTULO_NIVEL[nivelDaCarga(c.carga)]}${c.atrasada ? ', com atraso' : ''}` : 'sem pendências');
  if (o.eventos) p.push(plural(o.eventos, 'compromisso'));
  for (const x of o.indisponiveis) p.push(`${x.categoria === 'Feriado' ? 'feriado' : 'evento externo'}: ${x.descricao}`);
  if (o.selecionado) p.push('selecionado');
  return p.join('; ');
}

// ---------- panorama do período ----------
export type DiaCheio = { data: string; carga: number; sugestao: string | null };
export type Panorama = { pendencias: number; demandas: number; atrasadas: number; compromissos: number; cheios: DiaCheio[] };
/** Dia útil sem feriado ou evento externo (para sugerir uma data de alívio). */
const disponivel = (data: string, indisponiveis: readonly DiaIndisponivel[]) => !fimDeSemana(data) && !indisponiveis.some((x) => x.data === data);
/** O dia disponível mais leve até 5 dias antes ou depois (em empate, o mais próximo). Nulo se não houver nenhum mais leve que o dia cheio. */
export function diaMaisLivre(data: string, carga: ReadonlyMap<string, CargaDia>, indisponiveis: readonly DiaIndisponivel[], hoje: string): string | null {
  let melhor: string | null = null, melhorCarga = carga.get(data)?.carga ?? 0;
  for (let k = 1; k <= 5; k++) for (const alvo of [somarDias(data, -k), somarDias(data, k)]) {
    if (alvo < hoje || !disponivel(alvo, indisponiveis)) continue;
    const c = carga.get(alvo)?.carga ?? 0;
    if (c < melhorCarga) { melhor = alvo; melhorCarga = c; }
  }
  return melhor;
}
/** Resumo de um intervalo (o mês ou a semana) a partir da carga já calculada. Os dias cheios são os de carga média ou alta, do mais carregado para o menos, no máximo três. */
export function panorama(carga: ReadonlyMap<string, CargaDia>, eventos: readonly Evento[], indisponiveis: readonly DiaIndisponivel[], hoje: string, de: string, ate: string): Panorama {
  let pendencias = 0, demandas = 0, atrasadas = 0;
  const cheios: DiaCheio[] = [];
  for (const [data, c] of carga) {
    if (data < de || data > ate) continue;
    pendencias += c.carga; demandas += c.demandas; if (c.atrasada) atrasadas += c.demandas;
    if (c.carga >= LIMIARES_CARGA.media) {
      const alvo = diaMaisLivre(data, carga, indisponiveis, hoje);
      cheios.push({ data, carga: c.carga, sugestao: alvo ? `Considere antecipar ou redistribuir parte da carga para ${dataPorExtenso(alvo)} (${plural(carga.get(alvo)?.carga ?? 0, 'pendência')}).` : null });
    }
  }
  cheios.sort((a, b) => b.carga - a.carga || a.data.localeCompare(b.data));
  return { pendencias, demandas, atrasadas, compromissos: eventos.filter((e) => e.data >= de && e.data <= ate).length, cheios: cheios.slice(0, 3) };
}
