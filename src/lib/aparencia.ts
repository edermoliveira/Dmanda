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

/**
 * Confere uma combinação de cores do modo (texto sobre fundo ≥ 4,5:1; acento sobre fundo ≥ 3:1, por ser elemento gráfico; tinta escura do botão sobre o acento ≥ 3:1).
 * Devolve a mensagem do primeiro problema ou nulo. Atraso e erro não são personalizáveis: o vermelho mantém o significado.
 */
export function problemaDeContraste(modo: ModoTema, cores: CoresModo): string | null {
  const c = { ...PADRAO[modo], ...cores };
  if (contraste(c.texto, c.fundo) < 4.5) return `O texto fica difícil de ler sobre esse fundo (contraste ${contraste(c.texto, c.fundo).toFixed(1)}:1; o mínimo é 4,5:1).`;
  if (contraste(c.acento, c.fundo) < 3) return `O acento quase some sobre esse fundo (contraste ${contraste(c.acento, c.fundo).toFixed(1)}:1; o mínimo é 3:1).`;
  if (contraste('#080A0C', c.acento) < 3) return 'O acento está escuro demais para o texto dos botões.';
  return null;
}

/** Variáveis --u-* da raiz para um modo: só as que o usuário escolheu e que passam no contraste. O texto de acento (links, ícones) é derivado para manter 4,5:1. */
export function variaveisDoModo(modo: ModoTema, cores: CoresModo | undefined): Record<string, string> {
  if (!cores) return {};
  const limpas: CoresModo = {};
  for (const t of ['fundo', 'texto', 'acento'] as const) if (hexValido(cores[t])) limpas[t] = cores[t]!.toUpperCase();
  if (!Object.keys(limpas).length || problemaDeContraste(modo, limpas)) return {};
  const c = { ...PADRAO[modo], ...limpas };
  const v: Record<string, string> = {};
  if (limpas.fundo) v['--u-fundo'] = c.fundo;
  if (limpas.texto) v['--u-texto'] = c.texto;
  if (limpas.acento) {
    v['--u-acento'] = c.acento;
    // texto de acento: o próprio acento se já passa de 4,5:1 sobre o fundo; senão clareia (escuro) ou escurece (claro) até passar
    let t = c.acento; const alvo = modo === 'escuro' ? '#FFFFFF' : '#000000';
    for (let a = 0; contraste(t, c.fundo) < 4.5 && a <= 1; a += 0.05) t = misturar(alvo, c.acento, a);
    v['--u-acento-texto'] = t;
  }
  return v;
}

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

const TODAS = ['--u-fundo', '--u-texto', '--u-acento', '--u-acento-texto', '--u-esc'];
/** Aplica na raiz (documentElement) o modo, o tamanho do texto e as cores. Usada pelo app depois da hidratação e, em texto, pelo script que roda antes da página aparecer. */
export function aplicarNaRaiz(raiz: HTMLElement, modo: ModoTema, escala: number, cores: CoresTema) {
  raiz.dataset.tema = modo;
  for (const k of TODAS) raiz.style.removeProperty(k);
  raiz.style.setProperty('--esc', String(limitarEscala(escala)));
  for (const [k, val] of Object.entries(variaveisDoModo(modo, cores[modo]))) raiz.style.setProperty(k, val);
}
