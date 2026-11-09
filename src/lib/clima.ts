// Clima do Início (Open-Meteo): regras puras, sem React, para poderem ser testadas sozinhas com respostas de exemplo (fixtures).
//
// Fonte: Open-Meteo, API gratuita de uso não comercial (menos de 10.000 chamadas por dia, 5.000 por hora, 600 por minuto), dados sob CC BY 4.0: o link
// "Weather data by Open-Meteo.com" fica ao lado do clima (ver ATRIBUICAO). Documentação consultada em 07/11/2026:
//   - previsão: https://open-meteo.com/en/docs (current: temperature_2m, weather_code, is_day; daily: temperature_2m_max, temperature_2m_min, weather_code);
//   - cidades:  https://open-meteo.com/en/docs/geocoding-api (name, count, language, format; sem resultado, a chave `results` não vem);
//   - termos:   https://open-meteo.com/en/terms e https://open-meteo.com/en/licence.
// Duas coisas diferentes, nunca misturadas na tela: "agora" (`current`, condições do último intervalo de 15 minutos) e "previsão de hoje" (`daily`, mínima e máxima do dia).
//
// Privacidade: o navegador envia ao Open-Meteo só latitude e longitude da cidade (ou o nome digitado na busca), sem cookie e sem referência (`no-referrer`).
// Nada do Dmanda (demandas, humor, conta) entra nestes pedidos. Os endereços são fixos: `pedirJson` recusa qualquer outro.
import { eObjeto } from './armazenamento.ts';

export const API_PREVISAO = 'https://api.open-meteo.com/v1/forecast';
export const API_CIDADES = 'https://geocoding-api.open-meteo.com/v1/search';
export const ATRIBUICAO = { texto: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/' } as const;

/** Os dados "atuais" do Open-Meteo vêm de intervalos de 15 minutos: consultar antes disso não traz nada novo. */
export const TTL_FRESCO_MS = 15 * 60 * 1000;
/** Dado guardado mais velho que isto não é mais mostrado (nem como "desatualizado"). */
export const TTL_MAXIMO_MS = 12 * 60 * 60 * 1000;
/** Depois de uma falha, nenhuma consulta automática antes disto (o botão "Tentar de novo" vale a qualquer hora). */
export const ESPERA_APOS_FALHA_MS = 2 * 60 * 1000;
export const TIMEOUT_MS = 8000;
export const DEBOUNCE_MS = 350;
export const MAX_RESULTADOS = 8;

// ---------- cidade ----------
export type Cidade = { id: number; nome: string; estado: string; pais: string; lat: number; lon: number };
/** Taquara/RS (GeoNames 3446847, a mesma que o geocoding devolve para "Taquara, Rio Grande do Sul"). */
export const CIDADE_PADRAO: Cidade = { id: 3446847, nome: 'Taquara', estado: 'Rio Grande do Sul', pais: 'Brasil', lat: -29.65056, lon: -50.78056 };

const texto = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

export function cidadeValida(x: unknown): x is Cidade {
  if (!eObjeto(x)) return false;
  return typeof x.id === 'number' && Number.isInteger(x.id) && x.id > 0 && texto(x.nome, 100) && typeof x.estado === 'string' && x.estado.length <= 100 && typeof x.pais === 'string' && x.pais.length <= 100
    && num(x.lat, -90, 90) && num(x.lon, -180, 180);
}
/** Só os campos conhecidos (um valor guardado com campos a mais não leva lixo adiante). */
export const copiarCidade = (c: Cidade): Cidade => ({ id: c.id, nome: c.nome, estado: c.estado, pais: c.pais, lat: c.lat, lon: c.lon });
export const cidadeGuardada = (x: unknown): Cidade => (cidadeValida(x) ? copiarCidade(x) : CIDADE_PADRAO);
/** "Rio Grande do Sul, Brasil": o que distingue duas cidades de mesmo nome. */
export const localDaCidade = (c: Cidade) => [c.estado, c.pais].filter(Boolean).join(', ');

// ---------- pedidos (endereços fixos, parâmetros validados) ----------
export class ErroParametro extends Error {}

export function urlPrevisao(c: Cidade): string {
  if (!cidadeValida(c)) throw new ErroParametro('Cidade inválida.');
  const q = new URLSearchParams({
    latitude: c.lat.toFixed(4), longitude: c.lon.toFixed(4),
    current: 'temperature_2m,weather_code,is_day', daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    timezone: 'auto', forecast_days: '1',
  });
  return `${API_PREVISAO}?${q}`;
}

/** Texto da busca: de 2 a 80 caracteres úteis (o geocoding não responde a 1 letra). Devolve nulo quando ainda não dá para buscar. */
export function termoDeBusca(bruto: string): string | null {
  const t = bruto.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 80) return null;
  if (!/^[\p{L}\p{N} .,'’-]+$/u.test(t)) return null;
  return t;
}
export function urlCidades(termo: string): string {
  const t = termoDeBusca(termo);
  if (t === null) throw new ErroParametro('Busca inválida.');
  return `${API_CIDADES}?${new URLSearchParams({ name: t, count: String(MAX_RESULTADOS), language: 'pt', format: 'json' })}`;
}

// ---------- falhas do provedor, ditas sem culpa ----------
export type TipoFalha = 'timeout' | 'rede' | 'limite' | 'servidor' | 'invalido' | 'cancelado';
export class FalhaClima extends Error {
  readonly tipo: TipoFalha;
  constructor(tipo: TipoFalha) { super(tipo); this.tipo = tipo; }
}
export const TEXTO_FALHA: Record<Exclude<TipoFalha, 'cancelado'>, string> = {
  timeout: 'O serviço de clima demorou para responder.',
  rede: 'Sem conexão para consultar o clima agora.',
  limite: 'O serviço de clima pediu uma pausa nas consultas.',
  servidor: 'O serviço de clima está fora do ar no momento.',
  invalido: 'O serviço de clima respondeu algo que não foi possível ler.',
};

// só estes dois endereços completos (origem e caminho); nenhum outro, com usuário e senha na URL ou com a origem de um trocada pelo caminho do outro
const ENDERECOS = new Set([API_PREVISAO, API_CIDADES]);

/** GET de um dos dois endereços fixos, com limite de tempo. HTTP 429 vira `limite`, 5xx `servidor`, outro erro HTTP ou corpo que não é JSON `invalido`. */
export async function pedirJson(url: string, opcoes: { sinal?: AbortSignal; timeoutMs?: number; fetcher?: typeof fetch } = {}): Promise<unknown> {
  const u = new URL(url);
  if (!ENDERECOS.has(u.origin + u.pathname) || u.username !== '' || u.password !== '' || u.hash !== '') throw new FalhaClima('invalido');
  const ctl = new AbortController();
  let estourou = false;
  const t = setTimeout(() => { estourou = true; ctl.abort(); }, opcoes.timeoutMs ?? TIMEOUT_MS);
  const cancelar = () => ctl.abort();
  if (opcoes.sinal?.aborted) { clearTimeout(t); throw new FalhaClima('cancelado'); }
  opcoes.sinal?.addEventListener('abort', cancelar, { once: true });
  try {
    const r = await (opcoes.fetcher ?? fetch)(url, { signal: ctl.signal, headers: { accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
    if (r.status === 429) throw new FalhaClima('limite');
    if (r.status >= 500) throw new FalhaClima('servidor');
    if (!r.ok) throw new FalhaClima('invalido');
    try { return await r.json(); } catch { if (estourou) throw new FalhaClima('timeout'); if (opcoes.sinal?.aborted) throw new FalhaClima('cancelado'); throw new FalhaClima('invalido'); }
  } catch (e) {
    if (e instanceof FalhaClima) throw e;
    if (opcoes.sinal?.aborted) throw new FalhaClima('cancelado');
    throw new FalhaClima(estourou ? 'timeout' : 'rede');
  } finally {
    clearTimeout(t);
    opcoes.sinal?.removeEventListener('abort', cancelar);
  }
}

// ---------- previsão ----------
/** Condições de agora (`current`) e previsão do dia (`daily`) são coisas diferentes: agora muda a cada 15 minutos, a previsão do dia é a mínima e a máxima esperadas. */
export type Atual = { temperatura: number; codigo: number; diurno: boolean; observadoEm: string };
export type PrevisaoDoDia = { data: string; max: number; min: number; codigo: number };
export type Previsao = { atual: Atual; hoje: PrevisaoDoDia };

const MOMENTO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const TEMP: [number, number] = [-90, 60];

/** Confere a resposta do Open-Meteo campo a campo; qualquer coisa fora do combinado vira nulo (o widget diz que não conseguiu ler, nunca mostra um número inventado). */
export function lerPrevisao(x: unknown): Previsao | null {
  if (!eObjeto(x) || !eObjeto(x.current) || !eObjeto(x.daily) || !eObjeto(x.current_units) || !eObjeto(x.daily_units)) return null;
  const { current: c, daily: d } = x;
  if (x.current_units.temperature_2m !== '°C' || x.daily_units.temperature_2m_max !== '°C' || x.daily_units.temperature_2m_min !== '°C') return null;
  const um = (v: unknown) => (Array.isArray(v) && v.length >= 1 ? v[0] : undefined);
  const data = um(d.time), max = um(d.temperature_2m_max), min = um(d.temperature_2m_min), codDia = um(d.weather_code);
  if (typeof c.time !== 'string' || !MOMENTO.test(c.time) || typeof data !== 'string' || !DATA.test(data)) return null;
  if (!num(c.temperature_2m, ...TEMP) || !num(max, ...TEMP) || !num(min, ...TEMP) || min > max) return null;
  if (!codigoValido(c.weather_code) || !codigoValido(codDia) || (c.is_day !== 0 && c.is_day !== 1)) return null;
  return { atual: { temperatura: c.temperature_2m, codigo: c.weather_code, diurno: c.is_day === 1, observadoEm: c.time }, hoje: { data, max, min, codigo: codDia } };
}

/** Cidades do geocoding. Sem a chave `results` (nenhum resultado) a lista é vazia; resultado malformado é descartado, sem derrubar os outros. */
export function lerCidades(x: unknown): Cidade[] {
  if (!eObjeto(x) || !Array.isArray(x.results)) return [];
  const vistas = new Set<number>(), saida: Cidade[] = [];
  for (const r of x.results) {
    if (!eObjeto(r)) continue;
    const c = { id: r.id, nome: r.name, estado: typeof r.admin1 === 'string' ? r.admin1 : '', pais: typeof r.country === 'string' ? r.country : '', lat: r.latitude, lon: r.longitude };
    if (!cidadeValida(c) || vistas.has(c.id)) continue;
    vistas.add(c.id); saida.push(copiarCidade(c));
    if (saida.length >= MAX_RESULTADOS) break;
  }
  return saida;
}

export const consultarPrevisao = async (c: Cidade, o: Parameters<typeof pedirJson>[1] = {}): Promise<Previsao> => {
  const p = lerPrevisao(await pedirJson(urlPrevisao(c), o));
  if (!p) throw new FalhaClima('invalido');
  return p;
};
export const consultarCidades = async (termo: string, o: Parameters<typeof pedirJson>[1] = {}): Promise<Cidade[]> => lerCidades(await pedirJson(urlCidades(termo), o));

// ---------- guardado no aparelho: a última previsão, sempre junto da cidade a que pertence ----------
export type EntradaCache = { cidade: Cidade; previsao: Previsao; buscadoEm: number };
export function cacheGuardado(x: unknown): EntradaCache | null {
  if (!eObjeto(x) || !cidadeValida(x.cidade) || typeof x.buscadoEm !== 'number' || !Number.isFinite(x.buscadoEm) || x.buscadoEm <= 0) return null;
  // a previsão guardada passa pela mesma conferência de uma resposta nova (as unidades vêm junto no formato original)
  const p = eObjeto(x.previsao) && eObjeto(x.previsao.atual) && eObjeto(x.previsao.hoje) ? x.previsao : null;
  if (!p) return null;
  const a = p.atual as Record<string, unknown>, h = p.hoje as Record<string, unknown>;
  const original = { current: { time: a.observadoEm, temperature_2m: a.temperatura, weather_code: a.codigo, is_day: a.diurno ? 1 : 0 }, current_units: { temperature_2m: '°C' },
    daily: { time: [h.data], temperature_2m_max: [h.max], temperature_2m_min: [h.min], weather_code: [h.codigo] }, daily_units: { temperature_2m_max: '°C', temperature_2m_min: '°C' } };
  const previsao = lerPrevisao(original);
  return previsao ? { cidade: copiarCidade(x.cidade), previsao, buscadoEm: x.buscadoEm } : null;
}

/** O guardado vale só para a cidade escolhida agora (nunca se mostra o clima de uma cidade sob o nome de outra). */
export type EstadoCache = 'fresco' | 'velho' | 'expirado' | 'outra-cidade' | 'nenhum';
export function estadoDoCache(c: EntradaCache | null, cidade: Cidade, agora: number): EstadoCache {
  if (!c) return 'nenhum';
  if (c.cidade.id !== cidade.id) return 'outra-cidade';
  const idade = agora - c.buscadoEm;
  if (idade < 0) return 'velho';   // relógio do aparelho voltou: não dá para saber a idade, então se consulta de novo
  if (idade <= TTL_FRESCO_MS) return 'fresco';
  return idade <= TTL_MAXIMO_MS ? 'velho' : 'expirado';
}

/** Só a consulta mais recente vale: iniciar uma nova cancela a anterior, e `vale(id)` diz se a resposta que chegou ainda é a esperada. */
export function criarUltimaConsulta() {
  let n = 0, ctl: AbortController | null = null;
  return {
    iniciar() { ctl?.abort(); ctl = new AbortController(); return { id: ++n, sinal: ctl.signal }; },
    vale: (id: number) => id === n,
    cancelar() { ctl?.abort(); ctl = null; n++; },
  };
}

// ---------- textos em português ----------
/** Códigos WMO de tempo, na lista da documentação do Open-Meteo. */
const DESCRICAO: Record<number, string> = {
  0: 'Céu limpo', 1: 'Predominantemente limpo', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Nevoeiro', 48: 'Nevoeiro com geada',
  51: 'Garoa fraca', 53: 'Garoa moderada', 55: 'Garoa intensa', 56: 'Garoa congelante fraca', 57: 'Garoa congelante intensa',
  61: 'Chuva fraca', 63: 'Chuva moderada', 65: 'Chuva forte', 66: 'Chuva congelante fraca', 67: 'Chuva congelante forte',
  71: 'Neve fraca', 73: 'Neve moderada', 75: 'Neve forte', 77: 'Grãos de neve',
  80: 'Pancadas de chuva fracas', 81: 'Pancadas de chuva moderadas', 82: 'Pancadas de chuva violentas', 85: 'Pancadas de neve fracas', 86: 'Pancadas de neve fortes',
  95: 'Trovoada', 96: 'Trovoada com granizo fraco', 97: 'Trovoada forte', 99: 'Trovoada com granizo forte',
};
export const codigoValido = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v in DESCRICAO;
export const descricaoDoTempo = (codigo: number) => DESCRICAO[codigo] ?? 'Condição não identificada';
/**
 * Ícone do tempo, entre os que o aplicativo já tem (sol, lua e nuvem com sol; a escolha de ícones de chuva, neve e trovoada ainda depende do usuário):
 * céu limpo ou quase limpo mostra sol de dia e lua de noite, o resto mostra a nuvem com sol. A condição sempre vem escrita ao lado.
 */
export const iconeDoTempo = (codigo: number, diurno: boolean) => (codigo <= 1 ? (diurno ? 'sun' : 'moon') : 'cloud-sun');

export const graus = (t: number) => `${Math.round(t)}°`;
const grausFala = (t: number) => { const n = Math.abs(Math.round(t)), um = n === 1; return `${n} ${um ? 'grau' : 'graus'}${Math.round(t) < 0 ? (um ? ' negativo' : ' negativos') : ''}`; };

/** "00:15" da hora local da cidade, tirada do instante devolvido pelo Open-Meteo (AAAA-MM-DDTHH:MM). */
export const horaDoMomento = (m: string) => m.slice(11, 16);
/** Hora de Brasília de um instante (ms), para "consultado às". */
export const horaDeBrasilia = (ms: number) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);

/** A frase completa, para a leitura de tela e o título do widget. */
export function resumoDoClima(c: Cidade, p: Previsao): string {
  return `${c.nome}: agora ${grausFala(p.atual.temperatura)}, ${descricaoDoTempo(p.atual.codigo).toLowerCase()}. Previsão de hoje: máxima de ${grausFala(p.hoje.max)} e mínima de ${grausFala(p.hoje.min)}.`;
}
