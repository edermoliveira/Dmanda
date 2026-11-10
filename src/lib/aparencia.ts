// Aparência (Configurações): regras puras, sem React nem navegador, para poderem ser testadas sozinhas.
// Guardada só neste navegador (como o tema, o menu e a visão). O que está guardado pode estar corrompido ou ser de outra versão:
// `aparenciaGuardada` devolve sempre um valor utilizável, campo a campo, e nunca derruba a abertura do aplicativo.
// Os tamanhos de texto continuam sendo `calc(Npx * var(--esc))` (decisão 35): o ajuste do usuário só multiplica o `--esc` padrão.
import { eObjeto } from './armazenamento.ts';

export type Modo = 'claro' | 'escuro' | 'sistema';
export type Tema = 'claro' | 'escuro';
export const MODOS: readonly Modo[] = ['claro', 'escuro', 'sistema'];
export const ROTULO_MODO: Record<Modo, string> = { claro: 'Claro', escuro: 'Escuro', sistema: 'Sistema' };

/** Fundo: o padrão do Catalyst (liso) ou o gradiente animado já previsto nas decisões. */
export type Fundo = 'padrao' | 'animado';
/** Movimento: seguir o sistema (padrão) ou reduzir sempre. */
export type Movimento = 'sistema' | 'reduzido';

// ---------- destaques: dez paletas, na ordem do protótipo. Os valores das cores ficam só no CSS (src/estilos/app.css, `data-paleta`) ----------
export const PALETAS: readonly { nome: string }[] = [
  { nome: 'Água-marinha' }, { nome: 'Céu' }, { nome: 'Oceano' }, { nome: 'Índigo' }, { nome: 'Violeta' }, { nome: 'Orquídea' }, { nome: 'Rosa' }, { nome: 'Âmbar' }, { nome: 'Oliva' }, { nome: 'Grafite' },
];

// ---------- fontes em três papéis (principal, secundária, mono). `css` usa as variáveis do next/font (layout) ----------
export type Fonte = { id: string; nome: string; css: string };
const f = (id: string, nome: string, variavel: string, resto: string): Fonte => ({ id, nome, css: `var(${variavel}), ${resto}` });
export const FONTES_TITULO: readonly Fonte[] = [
  f('inter', 'Inter', '--f-inter', '-apple-system, "SF Pro Text", "Segoe UI", sans-serif'), f('sora', 'Sora', '--f-sora', 'sans-serif'), f('jakarta', 'Plus Jakarta Sans', '--f-jakarta', 'sans-serif'),
  f('dmserif', 'DM Serif Display', '--f-dmserif', 'Georgia, serif'), f('fraunces', 'Fraunces', '--f-fraunces', 'Georgia, serif'), f('manrope', 'Manrope', '--f-manrope', 'sans-serif'),
  f('grotesk', 'Space Grotesk', '--f-grotesk', 'sans-serif'), f('playfair', 'Playfair Display', '--f-playfair', 'Georgia, serif'), f('outfit', 'Outfit', '--f-outfit', 'sans-serif'),
];
export const FONTES_TEXTO: readonly Fonte[] = [
  f('inter', 'Inter', '--f-inter', 'system-ui, sans-serif'), f('dmsans', 'DM Sans', '--f-dmsans', 'system-ui, sans-serif'), f('jakarta', 'Plus Jakarta Sans', '--f-jakarta', 'system-ui, sans-serif'),
  f('manrope', 'Manrope', '--f-manrope', 'system-ui, sans-serif'), f('source', 'Source Sans 3', '--f-source', 'system-ui, sans-serif'), f('nunito', 'Nunito Sans', '--f-nunito', 'system-ui, sans-serif'),
];
export const FONTES_MONO: readonly Fonte[] = [
  f('plex', 'IBM Plex Mono', '--f-mono', 'ui-monospace, monospace'), f('jetbrains', 'JetBrains Mono', '--f-jetbrains', 'ui-monospace, monospace'), f('dmmono', 'DM Mono', '--f-dmmono', 'ui-monospace, monospace'),
  f('spacemono', 'Space Mono', '--f-spacemono', 'ui-monospace, monospace'), f('fira', 'Fira Code', '--f-fira', 'ui-monospace, monospace'),
];
export const CONJUNTOS: readonly { nome: string; titulo: string; texto: string; mono: string }[] = [
  { nome: 'Inter e IBM Plex Mono (padrão)', titulo: 'inter', texto: 'inter', mono: 'plex' },
  { nome: 'Manrope, Inter e IBM Plex Mono', titulo: 'manrope', texto: 'inter', mono: 'plex' },
  { nome: 'Sora, Inter e IBM Plex Mono', titulo: 'sora', texto: 'inter', mono: 'plex' },
  { nome: 'Jakarta e JetBrains Mono', titulo: 'jakarta', texto: 'jakarta', mono: 'jetbrains' },
  { nome: 'DM Serif, DM Sans e DM Mono', titulo: 'dmserif', texto: 'dmsans', mono: 'dmmono' },
  { nome: 'Fraunces, Inter e IBM Plex Mono', titulo: 'fraunces', texto: 'inter', mono: 'plex' },
  { nome: 'Fraunces, Inter e DM Mono', titulo: 'fraunces', texto: 'inter', mono: 'dmmono' },
  { nome: 'Manrope, Inter e JetBrains Mono', titulo: 'manrope', texto: 'inter', mono: 'jetbrains' },
];

// ---------- tamanhos: limites que impedem texto ilegível e card que não cabe ----------
/** Texto em porcentagem do padrão (100 = escala 0,85 da decisão 35). Nunca abaixo do padrão: vários textos pequenos já estão no piso de 10 px e diminuir os deixaria ilegíveis. */
export const TEXTO = { min: 100, max: 125, padrao: 100, passo: 5 } as const;
export const ICONE = { min: 16, max: 28, padrao: 20, passo: 1 } as const;
export const CARD = { min: 300, max: 420, padrao: 340, passo: 10 } as const;
export const ESCALA_BASE = 0.85;

export type Aparencia = {
  paleta: number | null; // índice em PALETAS; null = destaque padrão do Catalyst
  titulo: string; texto: string; mono: string; // ids de fontes
  textoPct: number; icone: number; card: number;
  fundo: Fundo; movimento: Movimento;
};
export const APARENCIA_PADRAO: Aparencia = {
  paleta: null, titulo: 'inter', texto: 'inter', mono: 'plex', textoPct: TEXTO.padrao, icone: ICONE.padrao, card: CARD.padrao, fundo: 'padrao', movimento: 'sistema',
};

const limitar = (v: unknown, lim: { min: number; max: number; padrao: number }): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(lim.max, Math.max(lim.min, Math.round(v))) : lim.padrao;
const idDe = (v: unknown, lista: readonly Fonte[], padrao: string): string => (typeof v === 'string' && lista.some((x) => x.id === v) ? v : padrao);

/** Aproveita campo a campo o que estiver guardado; o que faltar ou vier inválido volta ao padrão. */
export function aparenciaGuardada(v: unknown): Aparencia {
  const p = APARENCIA_PADRAO;
  if (!eObjeto(v)) return { ...p };
  return {
    paleta: typeof v.paleta === 'number' && Number.isInteger(v.paleta) && v.paleta >= 0 && v.paleta < PALETAS.length ? v.paleta : null,
    titulo: idDe(v.titulo, FONTES_TITULO, p.titulo), texto: idDe(v.texto, FONTES_TEXTO, p.texto), mono: idDe(v.mono, FONTES_MONO, p.mono),
    textoPct: limitar(v.textoPct, TEXTO), icone: limitar(v.icone, ICONE), card: limitar(v.card, CARD),
    fundo: v.fundo === 'animado' ? 'animado' : 'padrao', movimento: v.movimento === 'reduzido' ? 'reduzido' : 'sistema',
  };
}
export const modoGuardado = (v: unknown): Modo | null => (v === 'claro' || v === 'escuro' || v === 'sistema' ? v : null);
export const ePadrao = (a: Aparencia): boolean => (Object.keys(APARENCIA_PADRAO) as (keyof Aparencia)[]).every((k) => a[k] === APARENCIA_PADRAO[k]);

const fonte = (lista: readonly Fonte[], id: string) => (lista.find((x) => x.id === id) ?? lista[0]).css;

/** Variáveis de CSS da aparência (fontes e tamanhos), no `style` do `.app`. `--font-h` é a fonte dos títulos de página e do assunto; `--font-ui` (botões, abas, menu) segue a fonte de texto, então um título serifado não vai para os controles. O destaque sai por `data-paleta` (cores só no CSS). */
export function variaveisAparencia(a: Aparencia): Record<string, string> {
  return {
    '--font': fonte(FONTES_TEXTO, a.texto), '--font-h': fonte(FONTES_TITULO, a.titulo), '--font-ui': fonte(FONTES_TEXTO, a.texto), '--font-n': fonte(FONTES_MONO, a.mono),
    '--icn': `${a.icone}px`, '--cardh': `${a.card}px`, '--esc': String(+(ESCALA_BASE * a.textoPct / 100).toFixed(4)),
  };
}

/** Resolve o modo escolhido no tema que vale agora. */
export const temaDoModo = (m: Modo, sistemaEscuro: boolean): Tema => (m === 'sistema' ? (sistemaEscuro ? 'escuro' : 'claro') : m);
