// Regras puras do Perfil: humor e energia por dia, dias pendentes do convite, produtividade derivada das demandas finalizadas e os textos neutros.
// Sem banco, sem relógio e sem estado: a data de hoje vem de fora (America/Sao_Paulo, a mesma do banco). Nada daqui entra em busca, IA, telemetria nem log.
import { somarDias, diaDaSemana, nomeDoDia, type DiaIndisponivel } from './prazos.ts';
import { plural, type Demanda } from './demandas.ts';

export type Nivel = 1 | 2 | 3 | 4 | 5;
export const NIVEIS: readonly Nivel[] = [1, 2, 3, 4, 5];
export type RegistroDia = { dia: string; humor: Nivel; energia: Nivel };
export const ROTULO_HUMOR: Record<Nivel, string> = { 1: 'Muito mal', 2: 'Mal', 3: 'Neutro', 4: 'Bem', 5: 'Muito bem' };
export const ROTULO_ENERGIA: Record<Nivel, string> = { 1: 'Muito baixa', 2: 'Baixa', 3: 'Média', 4: 'Alta', 5: 'Muito alta' };

/** Hoje e os 5 dias anteriores podem ser registrados ou corrigidos (DECISOES.md, seção 9). */
export const DIAS_CORRECAO = 5;
export const emJanelaDeCorrecao = (dia: string, hoje: string) => dia <= hoje && dia >= somarDias(hoje, -DIAS_CORRECAO);

/** O mesmo dia, na forma por extenso curta: "quinta-feira, 05/11". */
export const diaPorExtenso = (dia: string) => `${nomeDoDia(dia)}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
export const dataCurta = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const SEMANA_ABR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const semanaAbreviada = (dia: string) => SEMANA_ABR[diaDaSemana(dia)];

/** Dia de trabalho para o convite: de segunda a sexta e que não seja um feriado cadastrado em Configurações. Evento externo de dia inteiro não tira o dia (humor continua valendo). */
export const diaDeTrabalho = (dia: string, dias: readonly DiaIndisponivel[]) => {
  const s = diaDaSemana(dia);
  return s >= 1 && s <= 5 && !dias.some((d) => d.categoria === 'Feriado' && d.data === dia);
};

/** Os dias que o convite pede: dos 5 dias anteriores a hoje, os de trabalho que ainda não têm humor e energia, do mais antigo ao mais recente. Hoje fica com o lembrete normal. */
export function diasPendentes(hoje: string, registros: readonly RegistroDia[], dias: readonly DiaIndisponivel[]): string[] {
  const feitos = new Set(registros.map((r) => r.dia));
  const lista: string[] = [];
  for (let n = DIAS_CORRECAO; n >= 1; n--) { const d = somarDias(hoje, -n); if (diaDeTrabalho(d, dias) && !feitos.has(d)) lista.push(d); }
  return lista;
}

/** Produtividade: demandas finalizadas em cada dia, pela data de conclusão (`concluida_em`), independentemente do prazo. Zero é um valor normal. */
export type PontoDia = { dia: string; concluidas: number; registro: RegistroDia | null };
export function serieDoPeriodo(demandas: readonly Demanda[], registros: readonly RegistroDia[], hoje: string, n: number): PontoDia[] {
  const vistas = new Set<string>(), porDia = new Map<string, number>();
  for (const d of demandas) {
    if (vistas.has(d.id)) continue; vistas.add(d.id);
    if (d.etapa === 'Finalizado' && d.concluida_em) porDia.set(d.concluida_em, (porDia.get(d.concluida_em) ?? 0) + 1);
  }
  const reg = new Map(registros.map((r) => [r.dia, r] as const));
  return Array.from({ length: n }, (_, i) => { const dia = somarDias(hoje, i - (n - 1)); return { dia, concluidas: porDia.get(dia) ?? 0, registro: reg.get(dia) ?? null }; });
}

export const textoConcluidas = (n: number) => (n === 0 ? 'nenhuma demanda finalizada' : `${plural(n, 'demanda')} ${n === 1 ? 'finalizada' : 'finalizadas'}`);
/** O resumo do dia por extenso (tooltip, leitura de tela e a linha de detalhe). Sem registro, diz "sem registro de humor e energia". */
export function textoDoDia(p: PontoDia, hoje: string): string {
  const quando = p.dia === hoje ? `Hoje, ${diaPorExtenso(p.dia)}` : diaPorExtenso(p.dia).replace(/^./, (c) => c.toUpperCase());
  const hum = p.registro ? `humor ${ROTULO_HUMOR[p.registro.humor].toLowerCase()}, energia ${ROTULO_ENERGIA[p.registro.energia].toLowerCase()}` : 'sem registro de humor e energia';
  return `${quando}: ${textoConcluidas(p.concluidas)}, ${hum}.`;
}

/** Frase conclusiva do dia: sempre neutra e acolhedora, sem comparação, meta nem classificação. */
export function fraseDoDia(concluidasHoje: number): string {
  if (concluidasHoje === 0) return 'Hoje ainda não há demanda finalizada. Dia com zero também acontece e não desfaz o resto da semana.';
  return `Hoje: ${textoConcluidas(concluidasHoje)}.`;
}

export const AVISO_PERFIL = 'Humor e energia são privados e nunca vão para a IA sem a sua permissão. Este espaço não substitui acompanhamento profissional.';

/** Confere o que vem do banco antes de usar (resposta inesperada vira lista vazia, nunca um erro na tela). */
export function registrosValidos(x: unknown): RegistroDia[] {
  if (!Array.isArray(x)) return [];
  const nivel = (v: unknown): v is Nivel => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
  return x.filter((r): r is RegistroDia => !!r && typeof r === 'object' && typeof (r as RegistroDia).dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((r as RegistroDia).dia) && nivel((r as RegistroDia).humor) && nivel((r as RegistroDia).energia))
    .map((r) => ({ dia: r.dia, humor: r.humor, energia: r.energia }));
}

/** Os registros gravados (devolvidos pelo banco) entram no lugar dos do mesmo dia, sem duplicar, em ordem de data. */
export function substituirRegistros(atual: readonly RegistroDia[], novos: readonly RegistroDia[]): RegistroDia[] {
  const dias = new Set(novos.map((r) => r.dia));
  return [...atual.filter((r) => !dias.has(r.dia)), ...novos].sort((a, b) => a.dia.localeCompare(b.dia));
}
