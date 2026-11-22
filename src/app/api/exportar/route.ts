// Cópia dos dados do usuário em um arquivo JSON para guardar em lugar privado (primeira peça do backup; ver supabase/LEIA-ME.md).
// Exige a sessão (decisão 92): lê pelas funções de sempre com o JWT de quem pediu (RLS e conta autorizada no banco); sem sessão é 401.
// Nada é gravado, copiado para o Git nem para outro serviço: o arquivo vai só para quem pediu.
import { connection } from 'next/server';
import { operacoes } from '@/servidor/banco';
import { ErroDmanda } from '@/nucleo/operacoes';
import { hojeISO } from '@/lib/demandas';

export async function GET() {
  await connection(); // só existe por pedido de uma pessoa: nunca entra na pré-geração do build
  const cabecalhos = { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' };
  try {
    const op = operacoes();
    const [ativas, arquivadas, dias, entradas, entradasArquivadas, eventos] = await Promise.all([op.listar(false), op.listar(true), op.listarDias(), op.listarEntradas(false), op.listarEntradas(true), op.listarEventos()]);
    const agora = new Date();
    const corpo = { formato: 'dmanda-exportacao', versao: 4, exportado_em: agora.toISOString(), fuso: 'America/Sao_Paulo', demandas: ativas, arquivadas, dias_indisponiveis: dias, entradas, entradas_arquivadas: entradasArquivadas, eventos };
    return new Response(JSON.stringify(corpo, null, 2), { headers: { ...cabecalhos, 'content-disposition': `attachment; filename="dmanda-copia-${hojeISO(agora)}.json"` } });
  } catch (e) {
    // sem sessão (o transporte redireciona ao login nas páginas): na API é 401, sem arquivo e sem dado
    if (typeof (e as { digest?: unknown })?.digest === 'string' && (e as { digest: string }).digest.startsWith('NEXT_REDIRECT')) return Response.json({ ok: false, erro: 'Entre para baixar a cópia.' }, { status: 401, headers: cabecalhos });
    // O aplicativo é aberto: nenhuma falha daqui é "falta de login". Uma regra do banco recusando a leitura (ErroDmanda: titular ausente da lista protegida, operação fora da lista) é falha do servidor,
    // como a rede caindo, a configuração ausente ou a chave de serviço recusada: sempre 500, sem arquivo e sem repetir a mensagem do banco ao navegador. O log do servidor leva só a causa.
    console.error('[exportar] falhou:', e instanceof ErroDmanda ? `regra do banco: ${e.message}` : ((e as { code?: string })?.code || 'sem código'));
    return Response.json({ ok: false, erro: 'Não foi possível gerar a cópia agora.' }, { status: 500, headers: cabecalhos });
  }
}
