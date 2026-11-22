// Rota dos rascunhos online (decisão 92). POST com JSON { acao, ... }: listar, salvar, resolver, encerrar e importarLegado. Cada operação roda com a IDENTIDADE da sessão (cookie HTTP-only) e as funções do banco
// (RLS por autor): nenhum campo aceita usuário. Usar uma rota (e não ações do servidor) tira o envio dos rascunhos da fila das ações de dados, que esperam umas às outras. Resposta sempre { ok, dados | erro } e nunca em cache.
// Proteção contra pedido de outro site: só JSON do mesmo site (Sec-Fetch-Site) e Content-Type application/json (um formulário de outro site não consegue enviá-lo).
import { connection } from 'next/server';
import { importarRascunhoLegado, listarRascunhos, resolverRascunho, salvarRascunho, encerrarRascunho } from '@/servidor/rascunhos';

const cab = { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' };

export async function POST(request: Request) {
  await connection();
  const site = request.headers.get('sec-fetch-site');
  if ((site && site !== 'same-origin') || !/^application\/json/i.test(request.headers.get('content-type') ?? '')) return Response.json({ ok: false, erro: 'Pedido recusado.' }, { status: 403, headers: cab });
  let b: Record<string, unknown>;
  try { b = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ ok: false, erro: 'Pedido inválido.' }, { status: 400, headers: cab }); }
  const s = (x: unknown) => String(x ?? ''), n = (x: unknown) => (typeof x === 'number' ? x : 0), o = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : ({} as Record<string, unknown>));
  try {
    let r;
    switch (b.acao) {
      case 'listar': r = await listarRascunhos(); break;
      case 'salvar': r = await salvarRascunho(s(b.id), s(b.chave), o(b.dados), n(b.base), s(b.op)); break;
      case 'resolver': r = await resolverRascunho(s(b.id), o(b.dados), n(b.base), s(b.op)); break;
      case 'encerrar': r = await encerrarRascunho(s(b.id), s(b.chave), b.estado === 'consumido' ? 'consumido' : 'descartado'); break;
      case 'importarLegado': r = await importarRascunhoLegado(s(b.id), s(b.chave), o(b.dados)); break;
      default: return Response.json({ ok: false, erro: 'Operação desconhecida.' }, { status: 400, headers: cab });
    }
    return Response.json(r, { headers: cab });
  } catch (e) {
    // sem sessão (o transporte redireciona ao login nas páginas): na rota é 401, para o motor guardar a fila e tentar depois
    if (typeof (e as { digest?: unknown })?.digest === 'string' && (e as { digest: string }).digest.startsWith('NEXT_REDIRECT')) return Response.json({ ok: false, erro: 'Sessão encerrada.' }, { status: 401, headers: cab });
    console.error('[rascunhos] falhou:', (e as { code?: string })?.code ?? 'sem código');
    return Response.json({ ok: false, erro: 'Não foi possível concluir a operação. Nada foi perdido.' }, { status: 500, headers: cab });
  }
}
