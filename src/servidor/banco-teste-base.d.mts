import type { PGlite } from '@electric-sql/pglite';
export function abrirBancoTeste(opcoes?: { pasta?: string; raizMigracoes?: string }): Promise<PGlite>;
export function chamarComoUsuario(db: PGlite, usuarioId: string, funcao: string, args?: Record<string, unknown>): Promise<unknown>;
export function chamarComoServico(db: PGlite, funcao: string, args?: Record<string, unknown>): Promise<unknown>;
