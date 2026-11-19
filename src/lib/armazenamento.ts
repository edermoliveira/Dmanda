// Validação do que o aplicativo guarda no navegador (localStorage). O conteúdo pode estar corrompido, ter vindo de uma versão antiga ou ter sido mexido por outra aba/extensão:
// um valor com o formato errado nunca pode impedir a abertura do aplicativo, e um rascunho sem a forma esperada não pode derrubar a janela que o abrir.
// Cada função devolve o valor aproveitável ou o padrão. Não valida o conteúdo dos campos de um rascunho (isso continua nas janelas e no servidor).
import { COLUNAS, VISOES, type Coluna, type Visao } from './demandas.ts';

/** Lê um valor JSON guardado no navegador. Qualquer falha (sem armazenamento, texto corrompido) devolve `padrao`; quem lê ainda valida a FORMA do que veio (as funções abaixo e as das telas). */
export const lerGuardado = <T = unknown>(chave: string, padrao: T): T => { try { const v = localStorage.getItem(chave); return v === null ? padrao : (JSON.parse(v) as T); } catch { return padrao; } };
/** Guarda um valor JSON no navegador. Sem armazenamento (modo privado, cota cheia) o valor vale só nesta visita. */
export const guardarNoNavegador = (chave: string, valor: unknown): void => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: vale só nesta visita */ } };

export const eObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);


export const visaoGuardada = (v: unknown): Visao | null => (VISOES as readonly unknown[]).includes(v) ? (v as Visao) : null;
export const ordemGuardada = (v: unknown): { coluna: Coluna; sentido: 1 | -1 } | null =>
  eObjeto(v) && (COLUNAS as readonly unknown[]).includes(v.coluna) && (v.sentido === 1 || v.sentido === -1) ? { coluna: v.coluna as Coluna, sentido: v.sentido } : null;
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
