// Validação do que o aplicativo guarda no navegador (localStorage). O conteúdo pode estar corrompido, ter vindo de uma versão antiga ou ter sido mexido por outra aba/extensão:
// um valor com o formato errado nunca pode impedir a abertura do aplicativo, e um rascunho sem a forma esperada não pode derrubar a janela que o abrir.
// Cada função devolve o valor aproveitável ou o padrão. Não valida o conteúdo dos campos de um rascunho (isso continua nas janelas e no servidor).
export const eObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const VISOES = ['cards', 'quadro', 'tabela', 'lista'] as const;
const COLUNAS = ['numero', 'assunto', 'origem', 'prazo', 'etapa', 'pct'] as const;
export type VisaoGuardada = (typeof VISOES)[number];
export type ColunaGuardada = (typeof COLUNAS)[number];

export const visaoGuardada = (v: unknown): VisaoGuardada | null => (VISOES as readonly unknown[]).includes(v) ? (v as VisaoGuardada) : null;
export const ordemGuardada = (v: unknown): { coluna: ColunaGuardada; sentido: 1 | -1 } | null =>
  eObjeto(v) && (COLUNAS as readonly unknown[]).includes(v.coluna) && (v.sentido === 1 || v.sentido === -1) ? { coluna: v.coluna as ColunaGuardada, sentido: v.sentido } : null;
export const gruposGuardados = (v: unknown): Record<string, boolean> => {
  const r: Record<string, boolean> = {};
  if (eObjeto(v)) for (const [k, x] of Object.entries(v)) if (typeof x === 'boolean') r[k] = x;
  return r;
};
/** Só entram os rascunhos com a forma mínima de sempre (um objeto com `dados` objeto); os outros são ignorados, sem apagar nada do armazenamento por conta própria. */
export const rascunhosGuardados = <T,>(v: unknown): Record<string, T> => {
  const r: Record<string, T> = {};
  if (eObjeto(v)) for (const [k, x] of Object.entries(v)) if (eObjeto(x) && eObjeto(x.dados)) r[k] = x as T;
  return r;
};
export const textosGuardados = (v: unknown, max = 200): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-max) : []);
