// Dados para acompanhar a evolução (decisão 65): séries por dia (America/Sao_Paulo) e resumos, calculados só a partir do que o Dmanda guarda. Regras puras: sem banco, sem relógio ("hoje" vem de fora)
// e sem gráficos. Esta rodada só COLETA e AGREGA; a apresentação virá depois.
//
// De onde vem cada série e desde quando ela é confiável:
//  - chegadas na Secretaria: `chegou_em` (data informada). Só entram demandas com a data; sem ela o dado é INDISPONÍVEL para a métrica (nunca se inventa). Confiável desde a menor `chegou_em`.
//  - cadastros no Dmanda: `criado_em` (o instante do cadastro, convertido para o dia de Brasília). Confiável desde o menor `criado_em`.
//  - conclusões: as gravadas pela migração 24 (`registradas`, confiáveis desde o início da coleta) e, à parte, as `legadas`: a data `concluida_em` comprovada de uma demanda que já estava finalizada
//    antes da coleta (ou a `concluida_em_anterior` de uma reabertura de ciclo 0). Nada é reconstruído: uma conclusão antiga que foi desfeita antes da coleta não existe aqui.
//  - reaberturas: só as gravadas, confiáveis desde o início da coleta.
// Quantidade de demandas ÚNICAS e quantidade de CICLOS são separadas: uma demanda concluída, reaberta e concluída de novo conta 1 demanda e 2 ciclos.
import { diasDesde, hojeISO, type Demanda } from './demandas.ts';
import { somarDias } from './prazos.ts';

export type Transicao = {
  id: string; demanda_id: string; tipo: 'conclusao' | 'reabertura'; ciclo: number; dia: string; ocorreu_em: string;
  etapa_anterior: string; etapa_nova: string; concluida_em_anterior: string | null;
};
export type TransicoesDoBanco = { desde: string | null; desde_em?: string | null; transicoes: Transicao[] };
export type DemandaMetrica = Pick<Demanda, 'id' | 'criado_em' | 'chegou_em' | 'concluida_em' | 'etapa' | 'arquivada_em'>;

export type PontoDia = { dia: string; demandas: number; ciclos: number };
export type Resumo = { casos: number; media: number | null; mediana: number | null; minimo: number | null; maximo: number | null };
export type Metricas = {
  hoje: string;
  /** Desde quando cada série é confiável (AAAA-MM-DD) ou null quando ainda não há dado. */
  confiavelDesde: { chegadas: string | null; cadastros: string | null; conclusoesRegistradas: string | null; reaberturas: string | null; conclusoesLegadas: string | null };
  series: { chegadas: PontoDia[]; cadastros: PontoDia[]; conclusoes: PontoDia[]; conclusoesLegadas: PontoDia[]; reaberturas: PontoDia[] };
  totais: { chegadas: number; cadastros: number; conclusoesDemandas: number; conclusoesCiclos: number; conclusoesLegadasCiclos: number; reaberturasDemandas: number; reaberturasCiclos: number };
  /** Dias corridos de permanência das demandas ABERTAS (não finalizadas, não arquivadas) desde a chegada. */
  permanenciaAbertas: Resumo & { semChegada: number };
  /** Dias corridos da chegada até a conclusão, por ciclo de conclusão (registrado ou legado). */
  chegadaAteConclusao: Resumo & { semChegada: number; invalidos: number };
};

const semDados: Resumo = { casos: 0, media: null, mediana: null, minimo: null, maximo: null };
/** Média, mediana, mínimo e máximo de uma lista de números (arredondados a duas casas); lista vazia dá casos 0 e o resto indisponível (null). */
export function resumir(valores: readonly number[]): Resumo {
  if (!valores.length) return { ...semDados };
  const o = [...valores].sort((a, b) => a - b), m = o.length >> 1, r = (x: number) => Math.round(x * 100) / 100;
  return { casos: o.length, media: r(o.reduce((s, x) => s + x, 0) / o.length), mediana: r(o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2), minimo: o[0], maximo: o[o.length - 1] };
}

/** O dia de Brasília (AAAA-MM-DD) de um instante ISO. */
export const diaDoInstante = (instante: string): string => hojeISO(new Date(instante));

type Marca = { dia: string; demanda: string };
/** Conta por dia: `ciclos` = quantas marcas, `demandas` = quantas demandas diferentes no dia. Ordenado por dia (só os dias com dado). */
export function serieDiaria(marcas: readonly Marca[]): PontoDia[] {
  const por = new Map<string, { ciclos: number; ids: Set<string> }>();
  for (const m of marcas) { const p = por.get(m.dia) ?? { ciclos: 0, ids: new Set<string>() }; p.ciclos++; p.ids.add(m.demanda); por.set(m.dia, p); }
  return [...por.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([dia, p]) => ({ dia, demandas: p.ids.size, ciclos: p.ciclos }));
}
/** Completa os dias sem dado com zero, de `de` a `ate` (inclusive), para quem for desenhar a série depois. */
export function preencherDias(serie: readonly PontoDia[], de: string, ate: string): PontoDia[] {
  const por = new Map(serie.map((p) => [p.dia, p] as const)), saida: PontoDia[] = [];
  for (let d = de; d <= ate && saida.length < 4000; d = somarDias(d, 1)) saida.push(por.get(d) ?? { dia: d, demandas: 0, ciclos: 0 });
  return saida;
}
const total = (s: readonly PontoDia[], k: 'demandas' | 'ciclos') => s.reduce((x, p) => x + p[k], 0);
const minimo = (l: readonly string[]) => (l.length ? l.reduce((a, b) => (a < b ? a : b)) : null);

/**
 * Tudo junto. `demandas` deve trazer as abertas e as arquivadas (uma demanda arquivada também chegou, foi cadastrada e pode ter sido concluída). `transicoes` é o que o banco devolve
 * (`listar_transicoes_demanda`), com a data em que a coleta começou. Uma demanda excluída leva o seu histórico junto (limite conhecido).
 */
export function calcularMetricas(demandas: readonly DemandaMetrica[], coleta: TransicoesDoBanco, hoje: string): Metricas {
  const porId = new Map(demandas.map((d) => [d.id, d] as const));
  const trans = coleta.transicoes.filter((t) => porId.has(t.demanda_id));
  const concl = trans.filter((t) => t.tipo === 'conclusao'), reab = trans.filter((t) => t.tipo === 'reabertura');

  // conclusões legadas: a data comprovada do que já estava finalizado sem conclusão gravada, mais a data guardada pela reabertura de ciclo 0
  const comConclusaoGravada = new Set(concl.map((t) => t.demanda_id));
  const legadas: { demanda: string; dia: string }[] = [];
  for (const d of demandas) if (d.etapa === 'Finalizado' && d.concluida_em && !comConclusaoGravada.has(d.id)) legadas.push({ demanda: d.id, dia: d.concluida_em });
  for (const t of reab) if (t.ciclo === 0 && t.concluida_em_anterior) legadas.push({ demanda: t.demanda_id, dia: t.concluida_em_anterior });

  const chegadas = serieDiaria(demandas.filter((d) => d.chegou_em).map((d) => ({ dia: d.chegou_em as string, demanda: d.id })));
  const cadastros = serieDiaria(demandas.map((d) => ({ dia: diaDoInstante(d.criado_em), demanda: d.id })));
  const conclusoes = serieDiaria(concl.map((t) => ({ dia: t.dia, demanda: t.demanda_id })));
  const conclusoesLegadas = serieDiaria(legadas.map((l) => ({ dia: l.dia, demanda: l.demanda })));
  const reaberturas = serieDiaria(reab.map((t) => ({ dia: t.dia, demanda: t.demanda_id })));

  // permanência: só demandas abertas; sem chegada é indisponível (contada à parte)
  const abertas = demandas.filter((d) => d.etapa !== 'Finalizado' && !d.arquivada_em);
  const perm = abertas.filter((d) => d.chegou_em).map((d) => Math.max(0, diasDesde(d.chegou_em as string, hoje)));
  // chegada até a conclusão, por ciclo; chegada depois da conclusão (dado digitado fora de ordem) é inválida e não entra na conta
  const ciclos = [...concl.map((t) => ({ demanda: t.demanda_id, dia: t.dia })), ...legadas.map((l) => ({ demanda: l.demanda, dia: l.dia }))];
  const tempos: number[] = []; let semChegada = 0, invalidos = 0;
  for (const c of ciclos) {
    const ch = porId.get(c.demanda)?.chegou_em;
    if (!ch) { semChegada++; continue; }
    const dias = diasDesde(ch, c.dia);
    if (dias < 0) invalidos++; else tempos.push(dias);
  }
  const desdeRegistro = coleta.desde ?? minimo(trans.map((t) => t.dia));
  return {
    hoje,
    confiavelDesde: {
      chegadas: minimo(demandas.map((d) => d.chegou_em).filter((x): x is string => !!x)), cadastros: minimo(demandas.map((d) => diaDoInstante(d.criado_em))),
      conclusoesRegistradas: desdeRegistro, reaberturas: desdeRegistro, conclusoesLegadas: minimo(legadas.map((l) => l.dia)),
    },
    series: { chegadas, cadastros, conclusoes, conclusoesLegadas, reaberturas },
    totais: {
      chegadas: total(chegadas, 'demandas'), cadastros: total(cadastros, 'demandas'),
      conclusoesDemandas: new Set(concl.map((t) => t.demanda_id)).size, conclusoesCiclos: concl.length, conclusoesLegadasCiclos: legadas.length,
      reaberturasDemandas: new Set(reab.map((t) => t.demanda_id)).size, reaberturasCiclos: reab.length,
    },
    permanenciaAbertas: { ...resumir(perm), semChegada: abertas.length - perm.length },
    chegadaAteConclusao: { ...resumir(tempos), semChegada, invalidos },
  };
}
