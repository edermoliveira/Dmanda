// Relógio dos lembretes discretos de humor (DECISOES.md, seção 9): um na entrada do dia e outro a cada 3 horas de trabalho.
// Regra pura, sem relógio próprio: quem chama passa o instante, o dia de São Paulo daquele mesmo instante e se o aplicativo está visível.
//
// O que é "entrada" e "trabalho" (a sessão é persistente, então não existe um login diário a contar):
//   - entrada = a primeira vez, em cada dia civil de São Paulo, que o aplicativo está visível e em uso neste aparelho (abrir de manhã, reabrir a PWA, ou voltar a mexer no dia seguinte);
//   - trabalho = tempo com o aplicativo aberto, visível e em uso (houve toque, tecla ou mouse nos últimos 15 minutos: um computador esquecido ligado à noite não gera lembrete).
//     Aba escondida, tela bloqueada, computador dormindo e o aparelho fechado não contam: cada tique conta no máximo PASSO_MAX segundos, então voltar depois de um intervalo longo
//     não "paga" o intervalo. Com duas abas em uso, o tempo é contado uma só vez (o último tique é compartilhado).
//   - o expediente do Secretário (decisão 51) ainda não altera nada aqui: a primeira aplicação dele será combinada com o usuário.
// O estado fica no aparelho (localStorage) e só guarda contagens e datas: nenhum valor de humor.

export const INTERVALO_S = 3 * 60 * 60;
/** Sem uso por mais que isto (ms), o aparelho conta como parado. */
export const OCIOSO_MS = 15 * 60 * 1000;
/** Cada tique conta, no máximo, este tanto de segundos de trabalho (o tique normal é de 30 s). */
export const PASSO_MAX = 45;

export type Pendente = 'entrada' | 'horas' | null;
export type EstadoLembretes = {
  /** Dia civil (São Paulo) a que o contador pertence. */
  dia: string;
  /** Segundos de trabalho no dia. */
  trabalhado: number;
  /** Instante (ms) do último tique que contou. */
  ultimo: number;
  /** Quantos lembretes por horas já foram gerados no dia. */
  lembretes: number;
  /** O lembrete de entrada do dia já foi tratado (mostrado ou dispensado por já haver registro). */
  entrada: boolean;
  /** O convite para completar dias pendentes já foi feito hoje. */
  convite: boolean;
  /** Lembrete esperando resposta (aparece como balão); some ao registrar ou fechar. */
  pendente: Pendente;
};

export const estadoInicial = (dia: string, agora: number): EstadoLembretes => ({ dia, trabalhado: 0, ultimo: agora, lembretes: 0, entrada: false, convite: false, pendente: null });

/** Lê o estado guardado; qualquer coisa fora do formato volta ao começo do dia (nunca quebra a tela). */
export function lerEstado(bruto: unknown, dia: string, agora: number): EstadoLembretes {
  const o = bruto as Partial<EstadoLembretes> | null;
  if (!o || typeof o !== 'object' || o.dia !== dia) return estadoInicial(dia, agora);
  const n = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : padrao);
  return {
    dia, trabalhado: n(o.trabalhado, 0), ultimo: n(o.ultimo, agora), lembretes: Math.floor(n(o.lembretes, 0)),
    entrada: o.entrada === true, convite: o.convite === true, pendente: o.pendente === 'entrada' || o.pendente === 'horas' ? o.pendente : null,
  };
}

export type EntradaTique = {
  agora: number;
  /** Dia de São Paulo do mesmo instante `agora`. */
  dia: string;
  visivel: boolean;
  /** Houve uso (toque, tecla ou mouse) neste aparelho nos últimos 15 minutos. */
  ativo: boolean;
  /** Os registros já foram lidos do banco? Sem isso não se sabe se hoje já tem registro, então a entrada espera. */
  carregado: boolean;
  /** Hoje já tem humor registrado. */
  registradoHoje: boolean;
  /** Há dias de trabalho pendentes nos últimos 5 dias. */
  temPendencias: boolean;
};
export type Saida = { estado: EstadoLembretes; /** Abrir o convite para completar os dias pendentes agora. */ convidar: boolean; mudou: boolean };

/** Um tique do relógio. Devolve o novo estado e se é hora de convidar para completar os dias. */
export function tique(atual: EstadoLembretes, e: EntradaTique): Saida {
  const base = atual.dia === e.dia ? atual : estadoInicial(e.dia, e.agora);
  // aba escondida, aparelho parado ou registros ainda não lidos: nada conta e nada é decidido (o próximo tique visível e em uso decide)
  if (!e.visivel || !e.ativo || !e.carregado) return { estado: base, convidar: false, mudou: base !== atual };
  const s: EstadoLembretes = { ...base };
  s.trabalhado += Math.min(Math.max(0, (e.agora - base.ultimo) / 1000), PASSO_MAX);
  s.ultimo = e.agora;
  let convidar = false;
  if (!s.entrada) { s.entrada = true; if (!e.registradoHoje) s.pendente = 'entrada'; }
  if (!s.convite) { s.convite = true; convidar = e.temPendencias; }
  const devidos = Math.floor(s.trabalhado / INTERVALO_S);
  if (devidos > s.lembretes) { s.lembretes = devidos; s.pendente = s.pendente ?? 'horas'; }
  return { estado: s, convidar, mudou: true };
}

/** Responder ao lembrete (registrar) ou fechá-lo: o balão some e só volta no próximo marco. */
export const resolver = (s: EstadoLembretes): EstadoLembretes => (s.pendente ? { ...s, pendente: null } : s);
