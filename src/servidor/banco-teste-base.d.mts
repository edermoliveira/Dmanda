import type { PGlite } from '@electric-sql/pglite';
export function abrirBancoTeste(opcoes?: { pasta?: string; raizMigracoes?: string }): Promise<PGlite>;
export type OpcoesJwt = { email?: string | null; provedor?: string };
export function entrarComo(tx: { query: PGlite['query']; exec: PGlite['exec'] }, usuarioId: string, opcoes?: OpcoesJwt): Promise<void>;
export function chamarComoUsuario(db: PGlite, usuarioId: string, funcao: string, args?: Record<string, unknown>, opcoes?: OpcoesJwt): Promise<unknown>;
export function chamarComoServico(db: PGlite, funcao: string, args?: Record<string, unknown>): Promise<unknown>;
