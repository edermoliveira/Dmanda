// Preferências visuais (tema, tamanho do texto, cores por tokens). Ficam só no aparelho (localStorage), nunca no banco, e valem por aparelho.
// Regras puras: contraste (WCAG), validação das cores escolhidas e a montagem das variáveis --u-* que o orbita.css lê na raiz.

export type ModoTema = 'claro' | 'escuro';
export type TokenCor = 'fundo' | 'texto' | 'acento';
export type CoresModo = Partial<Record<TokenCor, string>>;
export type CoresTema = Partial<Record<ModoTema, CoresModo>>;

/** Padrão Órbita de cada modo (os mesmos valores de src/estilos/orbita.css). */
export const PADRAO: Record<ModoTema, Record<TokenCor, string>> = {
  escuro: { fundo: '#080A0C', texto: '#FFFFFF', acento: '#6F8096' },
  claro: { fundo: '#EDF0F3', texto: '#0E1319', acento: '#6F8096' },
};
export const ROTULO_TOKEN: Record<TokenCor, string> = { fundo: 'Fundo', texto: 'Texto', acento: 'Acento' };

export const ESCALA_MIN = 0.85, ESCALA_MAX = 1.3, ESCALA_PADRAO = 1, ESCALA_PASSO = 0.05;
export const CHAVE_TEMA = 'dmanda-tema', CHAVE_ESCALA = 'dmanda:escala', CHAVE_CORES = 'dmanda:cores';

export const hexValido = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
export const limitarEscala = (n: unknown): number => {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : ESCALA_PADRAO;
  return Math.round(Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, x)) / ESCALA_PASSO) * ESCALA_PASSO;
};

const canal = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255;
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminancia = (hex: string) => 0.2126 * lin(canal(hex, 0)) + 0.7152 * lin(canal(hex, 1)) + 0.0722 * lin(canal(hex, 2));
export const contraste = (a: string, b: string) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** Mistura `cima` sobre `base` (a = 0 a 1) e devolve hexadecimal. */
export function misturar(cima: string, base: string, a: number): string {
  const c = (i: number) => Math.round((canal(cima, i) * a + canal(base, i) * (1 - a)) * 255).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`.toUpperCase();
}

// As camadas que ficam atrás do texto (vidro e iluminação ambiente), para medir o contraste no pior fundo.
const VIDRO: Record<ModoTema, { cor: string; a: number }> = { escuro: { cor: '#FFFFFF', a: 0.10 }, claro: { cor: '#FFFFFF', a: 0.66 } };
const AMBIENTE: Record<ModoTema, { cor: string; a: number }> = { escuro: { cor: '#1E5468', a: 0.40 }, claro: { cor: '#78AABE', a: 0.17 } };
const TINTAS = ['#080A0C', '#FFFFFF'];

/** Fundos reais atrás do texto: o fundo puro, o vidro sobre ele e o vidro sobre a iluminação ambiente (o pior caso para texto claro no escuro, com a luz a meia força, pois o gradiente some longe da fonte). */
export function fundosEfetivos(modo: ModoTema, fundo: string): string[] {
  const v = VIDRO[modo], l = AMBIENTE[modo];
  const luz = misturar(l.cor, fundo, l.a);
  return [fundo, misturar(v.cor, fundo, v.a), misturar(v.cor, luz, v.a)];
}
const pior = (frente: string, fundos: string[]) => Math.min(...fundos.map((f) => contraste(frente, f)));

/** Tinta do texto dos botões sobre o acento: a escura ou a branca, a que tiver mais contraste (sempre passa de 4,5:1, pois o melhor dos dois nunca fica abaixo de cerca de 4,58). */
export const tintaDoAcento = (acento: string) => (contraste(TINTAS[0], acento) >= contraste(TINTAS[1], acento) ? TINTAS[0] : TINTAS[1]);

/** Cor de links e ícones de destaque: o acento, aproximado do texto até chegar a 4,5:1 no pior fundo (no limite vira o próprio texto, que já passou). */
export function acentoParaTexto(acento: string, texto: string, fundos: string[]): string {
  let t = acento;
  for (let a = 0; pior(t, fundos) < 4.5 && a <= 1; a += 0.05) t = misturar(texto, acento, a);
  return t;
}

/**
 * Confere uma combinação de cores do modo. Texto de leitura (principal e secundário a 76% e discreto a 64%) precisa de 4,5:1 sobre os fundos reais;
 * elementos gráficos (acento sobre o fundo) precisam de 3:1; o texto dos botões usa uma tinta escolhida sozinha com 4,5:1 sobre o acento.
 * Devolve a mensagem do primeiro problema ou nulo. Atraso e erro não são personalizáveis: o vermelho mantém o significado.
 */
export function problemaDeContraste(modo: ModoTema, cores: CoresModo): string | null {
  const c = { ...PADRAO[modo], ...cores };
  const fundos = fundosEfetivos(modo, c.fundo);
  const txt = pior(c.texto, fundos);
  if (txt < 4.5) return `O texto fica difícil de ler sobre esse fundo (contraste ${txt.toFixed(1)}:1; o mínimo é 4,5:1).`;
  const mudo = Math.min(pior(misturar(c.texto, c.fundo, 0.76), fundos), pior(misturar(c.texto, c.fundo, 0.64), fundos));
  if (mudo < 4.5) return `O texto secundário (legendas e datas, mais suaves que o texto principal) fica difícil de ler (contraste ${mudo.toFixed(1)}:1; o mínimo é 4,5:1). Escolha um texto com mais diferença para o fundo.`;
  const grafico = pior(c.acento, fundos.slice(0, 2)); // elemento gráfico fica sobre o fundo e o vidro, não sobre a luz ambiente
  if (grafico < 3) return `O acento quase some sobre esse fundo (contraste ${grafico.toFixed(1)}:1; o mínimo é 3:1).`;
  return null;
}

/** Variáveis --u-* da raiz para um modo: só as que o usuário escolheu e que passam no contraste, mais as derivadas (texto de acento e tinta dos botões) que acompanham qualquer escolha. */
export function variaveisDoModo(modo: ModoTema, cores: CoresModo | undefined): Record<string, string> {
  if (!cores) return {};
  const limpas: CoresModo = {};
  for (const t of ['fundo', 'texto', 'acento'] as const) if (hexValido(cores[t])) limpas[t] = cores[t]!.toUpperCase();
  if (!Object.keys(limpas).length || problemaDeContraste(modo, limpas)) return {};
  const c = { ...PADRAO[modo], ...limpas };
  const v: Record<string, string> = {};
  if (limpas.fundo) v['--u-fundo'] = c.fundo;
  if (limpas.texto) v['--u-texto'] = c.texto;
  if (limpas.acento) { v['--u-acento'] = c.acento; v['--u-acento-tinta'] = tintaDoAcento(c.acento); }
  // links e ícones de destaque dependem do fundo, do texto e do acento: qualquer escolha os recalcula (com só o fundo trocado, o padrão fixo deixaria de ser legível)
  v['--u-acento-texto'] = acentoParaTexto(c.acento, c.texto, fundosEfetivos(modo, c.fundo));
  return v;
}

/** Cor do fundo do modo que vale agora (a do usuário, se aprovada, ou o padrão): usada na barra do sistema (theme-color). */
export const fundoEfetivo = (modo: ModoTema, cores: CoresModo | undefined) => variaveisDoModo(modo, cores)['--u-fundo'] ?? PADRAO[modo].fundo;

export function lerCores(bruto: unknown): CoresTema {
  const saida: CoresTema = {};
  if (!bruto || typeof bruto !== 'object') return saida;
  for (const m of ['claro', 'escuro'] as const) {
    const o = (bruto as Record<string, unknown>)[m];
    if (!o || typeof o !== 'object') continue;
    const modo: CoresModo = {};
    for (const t of ['fundo', 'texto', 'acento'] as const) { const x = (o as Record<string, unknown>)[t]; if (hexValido(x)) modo[t] = x.toUpperCase(); }
    if (Object.keys(modo).length) saida[m] = modo;
  }
  return saida;
}

const TODAS = ['--u-fundo', '--u-texto', '--u-acento', '--u-acento-texto', '--u-acento-tinta', '--u-esc'];
/** Aplica na raiz (documentElement) o modo, o tamanho do texto e as cores. Usada pelo app depois da hidratação e, em texto, pelo script que roda antes da página aparecer. */
export function aplicarNaRaiz(raiz: HTMLElement, modo: ModoTema, escala: number, cores: CoresTema) {
  raiz.dataset.tema = modo;
  for (const k of TODAS) raiz.style.removeProperty(k);
  raiz.style.setProperty('--esc', String(limitarEscala(escala)));
  const v = variaveisDoModo(modo, cores[modo]);
  for (const [k, val] of Object.entries(v)) raiz.style.setProperty(k, val);
  atualizarBarra(raiz.ownerDocument, v['--u-fundo'] ?? PADRAO[modo].fundo);
}

/** theme-color segue o modo e o fundo escolhidos no app (não o esquema do sistema): uma única marcação, sem media, com o fundo efetivo. Navegadores que ignoram a mudança em tempo real mantêm a cor da abertura. */
export function atualizarBarra(doc: Document, cor: string) {
  const metas = doc.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (!metas.length) { const m = doc.createElement('meta'); m.name = 'theme-color'; m.content = cor; doc.head.appendChild(m); return; }
  metas.forEach((m) => { m.removeAttribute('media'); m.content = cor; });
}
