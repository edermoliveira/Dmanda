// Rotina diária chamada pelo agendador (Vercel Cron: GET na produção, com "Authorization: Bearer CRON_SECRET").
// Autenticação própria: não usa sessão Google, não renova o "último uso" e não devolve dado pessoal (só a data e uma contagem).
// A rotina só lê as demandas e grava o resumo do dia; nunca conclui, altera prazos nem cria dados.
import { segredoConfere, executarRotinaDiaria } from '@/nucleo/rotina';
import { chamarServico } from '@/servidor/banco';

const cabecalhos = { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' };

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ ok: false, erro: 'rotina não configurada' }, { status: 503, headers: cabecalhos });
  if (!segredoConfere(request.headers.get('authorization'), process.env.CRON_SECRET)) return Response.json({ ok: false, erro: 'não autorizado' }, { status: 401, headers: cabecalhos });
  try {
    const r = await executarRotinaDiaria(chamarServico);
    return Response.json({ ok: true, data_ref: r.data_ref, usuarios: r.usuarios }, { headers: cabecalhos });
  } catch (e) {
    console.error('[rotina diária] falhou:', (e as { code?: string })?.code ?? 'sem código');
    return Response.json({ ok: false, erro: 'falha ao executar a rotina' }, { status: 500, headers: cabecalhos });
  }
}
