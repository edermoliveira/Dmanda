'use client';
// Cliente da rota /api/rascunhos (decisão 92): um fetch comum, fora da fila das ações do servidor. Falha de rede lança (o motor guarda a fila e tenta de novo); recusa do servidor volta como { ok: false }.
export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string };
export async function chamarRascunhos<T>(corpo: Record<string, unknown>): Promise<Resposta<T>> {
  const r = await fetch('/api/rascunhos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), cache: 'no-store', credentials: 'same-origin' });
  if (r.status === 401) { if (typeof window !== 'undefined') window.location.assign(new URL('/login?motivo=sessao', window.location.origin).href); return { ok: false, erro: 'Sessão encerrada.' }; }
  const j = (await r.json().catch(() => null)) as Resposta<T> | null;
  return j && typeof j === 'object' && 'ok' in j ? j : { ok: false, erro: 'Resposta inesperada.' };
}
