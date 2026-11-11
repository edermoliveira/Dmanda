// Eventos e lembretes próprios da Agenda (decisão 47). Regras puras, sem banco nem relógio: a data de hoje e a hora de agora vêm sempre de fora.
// Datas são datas do calendário (AAAA-MM-DD) e horários são "HH:MM" sem fuso: nada passa por Date local, então não há deslocamento por UTC.

// 'Evento externo' (decisão 64) é só um tipo de lançamento da Agenda: não muda vencimento. Quem antecipa prazos é o cadastro de Dias indisponíveis (Configurações).
export const TIPOS_EVENTO = ['Reunião', 'Compromisso', 'Lembrete', 'Evento externo'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export type Evento = {
  id: string;
  titulo: string;
  tipo: TipoEvento;
  data: string;
  dia_inteiro: boolean;
  /** "HH:MM"; nulo em evento de dia inteiro. */
  inicio: string | null;
  /** "HH:MM"; opcional, sempre depois do início. */
  fim: string | null;
  descricao: string;
  /** Aviso dentro do aplicativo, em minutos antes do início. Em evento de dia inteiro, qualquer valor (use 0) significa "avisar no dia". Nulo = sem aviso. */
  aviso_min: number | null;
  versao: number;
  criado_em: string;
  atualizado_em: string;
};
export type DadosEvento = Partial<Pick<Evento, 'titulo' | 'tipo' | 'data' | 'dia_inteiro' | 'inicio' | 'fim' | 'descricao' | 'aviso_min'>> & { id?: string };

export const LIMITE_TITULO_EVENTO = 200;
export const LIMITE_DESCRICAO_EVENTO = 5000;
/** Antecedências oferecidas para o aviso de um evento com horário (minutos). O padrão é 15, como definido para a Agenda. */
export const AVISOS_MIN = [5, 10, 15, 30, 60, 120] as const;
export const AVISO_PADRAO = 15;
export const rotuloAviso = (m: number | null) => (m === null ? 'Sem aviso' : m >= 60 ? `${m / 60} h antes` : `${m} min antes`);

export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const minutosDe = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataExiste = (v: string) => { if (!DATA.test(v)) return false; const [a, m, d] = v.split('-').map(Number); const x = new Date(Date.UTC(a, m - 1, d)); return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; };

/** Confere um evento (a mesma regra da tela e do servidor). Devolve a mensagem para a pessoa, ou nulo quando está certo. */
export function erroDoEvento(e: DadosEvento): string | null {
  if (typeof e.titulo !== 'string' || !e.titulo.trim()) return 'Informe o título do evento.';
  if (e.titulo.trim().length > LIMITE_TITULO_EVENTO) return `O título passa de ${LIMITE_TITULO_EVENTO} caracteres.`;
  if (e.tipo === undefined || !(TIPOS_EVENTO as readonly string[]).includes(e.tipo)) return 'Escolha o tipo do evento.';
  if (typeof e.data !== 'string' || !dataExiste(e.data)) return 'Informe uma data que exista no calendário.';
  if ((e.descricao ?? '').length > LIMITE_DESCRICAO_EVENTO) return `A descrição passa de ${LIMITE_DESCRICAO_EVENTO} caracteres.`;
  if (e.dia_inteiro) {
    if (e.inicio || e.fim) return 'Evento de dia inteiro não tem horário.';
  } else {
    if (!e.inicio || !HORA.test(e.inicio)) return 'Informe o horário de início (por exemplo, 09:30).';
    if (e.fim) {
      if (!HORA.test(e.fim)) return 'Horário de término inválido.';
      if (minutosDe(e.fim) <= minutosDe(e.inicio)) return 'O término precisa ser depois do início.';
    }
  }
  if (e.aviso_min !== null && e.aviso_min !== undefined) {
    if (e.dia_inteiro) { if (e.aviso_min !== 0) return 'Aviso inválido.'; }
    else if (!(AVISOS_MIN as readonly number[]).includes(e.aviso_min)) return 'Aviso inválido.';
  }
  return null;
}

/** Dia inteiro primeiro; depois por horário de início, término e criação. */
type Ordenavel = Pick<Evento, 'dia_inteiro' | 'inicio' | 'fim' | 'criado_em'>;
export const compararEventos = (a: Ordenavel, b: Ordenavel) => Number(b.dia_inteiro) - Number(a.dia_inteiro) || (a.inicio ?? '').localeCompare(b.inicio ?? '') || (a.fim ?? '99:99').localeCompare(b.fim ?? '99:99') || a.criado_em.localeCompare(b.criado_em);
export const ordenarEventos = <T extends Ordenavel>(l: readonly T[]): T[] => [...l].sort(compararEventos);
export const horarioDe = (e: Pick<Evento, 'dia_inteiro' | 'inicio' | 'fim'>) => (e.dia_inteiro ? 'Dia inteiro' : e.fim ? `${e.inicio} às ${e.fim}` : `${e.inicio}`);

/** Intervalo em minutos; sem término, o evento ocupa só o instante do início. */
const intervalo = (e: Pick<Evento, 'inicio' | 'fim'>): [number, number] => { const i = minutosDe(e.inicio!); return [i, e.fim ? minutosDe(e.fim) : i]; };
/** Dois eventos com horário se sobrepõem quando os intervalos se cruzam, ou quando começam no mesmo minuto. Eventos de dia inteiro não entram (a regra vale só para compromissos com horário). */
export function seSobrepoem(a: Pick<Evento, 'data' | 'dia_inteiro' | 'inicio' | 'fim'>, b: Pick<Evento, 'data' | 'dia_inteiro' | 'inicio' | 'fim'>): boolean {
  if (a.dia_inteiro || b.dia_inteiro || !a.inicio || !b.inicio || a.data !== b.data) return false;
  const [ai, af] = intervalo(a), [bi, bf] = intervalo(b);
  return ai === bi || (ai < bf && bi < af);
}
/** Os eventos que se sobrepõem ao informado (ele mesmo fica de fora, por id). */
export const sobrepostosA = (e: Pick<Evento, 'id' | 'data' | 'dia_inteiro' | 'inicio' | 'fim'>, todos: readonly Evento[]): Evento[] => todos.filter((o) => o.id !== e.id && seSobrepoem(e, o));

export type AvisoEvento = { evento: Evento; tipo: 'em-breve' | 'no-dia'; minutos: number };
/**
 * Avisos de hoje para mostrar dentro do aplicativo. Com horário: da antecedência escolhida até o início ("em N min"). Dia inteiro com aviso: durante o dia ("hoje").
 * `agora` é o horário atual em minutos desde 00:00 (de Brasília). Evento já iniciado deixa de ser aviso.
 */
export function avisosDeHoje(eventos: readonly Evento[], hoje: string, agora: number): AvisoEvento[] {
  const r: AvisoEvento[] = [];
  for (const e of eventos) {
    if (e.data !== hoje || e.aviso_min === null) continue;
    if (e.dia_inteiro) { r.push({ evento: e, tipo: 'no-dia', minutos: 0 }); continue; }
    const falta = minutosDe(e.inicio!) - agora;
    if (falta >= 0 && falta <= e.aviso_min) r.push({ evento: e, tipo: 'em-breve', minutos: falta });
  }
  return r.sort((a, b) => a.minutos - b.minutos);
}
/** Minutos desde 00:00 em Brasília, a partir de um instante. */
export function minutosAgora(agora: Date = new Date()): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora);
  return minutosDe(p.slice(0, 5));
}
