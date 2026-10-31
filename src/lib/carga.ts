// Carga pendente semanal e mensal do Início (regras aprovadas). Tudo é derivado das datas e das tarefas já gravadas: nada é inventado e nada vai ao banco.
// Semana de domingo a sábado, em America/Sao_Paulo (a data de hoje chega pelo contexto, AAAA-MM-DD).
import { diasAte, type Demanda } from './demandas.ts';

const MS_DIA = 86_400_000;
const emMs = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(a, m - 1, d); };
const paraISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const somarDias = (iso: string, n: number) => paraISO(emMs(iso) + n * MS_DIA);
/** 0 = domingo ... 6 = sábado. */
export const diaDaSemana = (iso: string) => new Date(emMs(iso)).getUTCDay();

export function semanaDe(hoje: string): { inicio: string; fim: string } {
  const inicio = somarDias(hoje, -diaDaSemana(hoje));
  return { inicio, fim: somarDias(inicio, 6) };
}

/** A data que posiciona a demanda na carga: a mais próxima entre o vencimento ajustado e o acompanhamento programado. Sem nenhuma das duas, não há data aplicável. */
export function dataAplicavel(d: Demanda): string | null {
  const datas = [d.prazo, d.acompanhar_em].filter((x): x is string => !!x).map((x) => x.slice(0, 10)).sort();
  return datas[0] ?? null;
}

/** Participação pelas tarefas; sem tarefas, uma unidade apenas para o indicador. */
export const unidades = (d: Demanda) => Math.max(1, d.tarefas.length);
export const unidadesPendentes = (d: Demanda) => (d.etapa === 'Finalizado' || d.concluida_em ? 0 : d.tarefas.length ? d.tarefas.filter((t) => !t.concluida).length : 1);

// concluida_em é uma data do calendário (coluna date, AAAA-MM-DD, definida pelo banco com o dia de Brasília): nunca passar por Date, que a recuaria um dia em UTC
const dataDaConclusao = (d: Demanda) => (d.concluida_em ? d.concluida_em.slice(0, 10) : null);

export type CargaSemana = {
  inicio: string; fim: string;
  /** unidades que entram no total semanal (pendentes + concluídas durante a semana) */
  total: number; pendentes: number; concluidas: number;
  /** percentual de carga pendente (0 a 100); nulo quando não há nada na semana */
  pct: number | null;
  /** demandas abertas sem nenhuma data aplicável: contador separado, fora do percentual */
  semData: number;
  atrasadas: number; hoje: number;
};

export function cargaSemana(lista: Demanda[], hoje: string): CargaSemana {
  const { inicio, fim } = semanaDe(hoje);
  let pendentes = 0, concluidas = 0, semData = 0, atrasadas = 0, deHoje = 0;
  for (const d of lista) {
    if (d.arquivada_em && !d.concluida_em) continue;
    const aberta = d.etapa !== 'Finalizado' && !d.concluida_em;
    if (aberta) {
      const dt = dataAplicavel(d);
      if (!dt) { semData += 1; continue; }
      if (dt > fim) continue; // fora da semana (atrasadas entram: a data é anterior ao fim)
      pendentes += unidadesPendentes(d);
      if (diasAte(dt, hoje) < 0) atrasadas += 1; else if (dt === hoje) deHoje += 1;
    } else {
      const c = dataDaConclusao(d), dt = dataAplicavel(d);
      // concluída durante a semana permanece no total semanal, saindo das pendências
      if (c && c >= inicio && c <= fim && (!dt || dt <= fim)) concluidas += unidades(d);
    }
  }
  const total = pendentes + concluidas;
  return { inicio, fim, total, pendentes, concluidas, pct: total ? Math.round((pendentes / total) * 100) : null, semData, atrasadas, hoje: deHoje };
}

/** Carga pendente por dia (unidades), das demandas abertas com data aplicável. */
export function cargaPorDia(lista: Demanda[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of lista) {
    if (d.arquivada_em || d.etapa === 'Finalizado' || d.concluida_em) continue;
    const dt = dataAplicavel(d);
    if (!dt) continue;
    m.set(dt, (m.get(dt) ?? 0) + unidadesPendentes(d));
  }
  return m;
}

export type CelulaMes = { iso: string; dia: number; carga: number; nivel: 0 | 1 | 2 | 3 | 4 } | null;

/** Grade do mês (domingo na primeira coluna): posições anteriores ao dia 1 ficam vazias (nulo). O nível 0 a 4 segue a escala sequencial, relativa ao maior valor do mês. */
export function gradeDoMes(ano: number, mes: number, carga: Map<string, number>): CelulaMes[] {
  const primeiro = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const vazias = diaDaSemana(primeiro);
  let max = 0;
  for (let d = 1; d <= ultimoDia; d++) max = Math.max(max, carga.get(`${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`) ?? 0);
  const nivel = (c: number): 0 | 1 | 2 | 3 | 4 => (c <= 0 || max === 0 ? 0 : (Math.min(4, Math.max(1, Math.ceil((c / max) * 4))) as 1 | 2 | 3 | 4));
  const grade: CelulaMes[] = Array.from({ length: vazias }, () => null);
  for (let d = 1; d <= ultimoDia; d++) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const c = carga.get(iso) ?? 0;
    grade.push({ iso, dia: d, carga: c, nivel: nivel(c) });
  }
  return grade;
}
