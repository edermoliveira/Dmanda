// Cópia dos dados do usuário em um arquivo JSON para guardar em lugar privado (primeira peça do backup; ver supabase/LEIA-ME.md).
// Exige a sessão da conta autorizada (a porta de entrada e a própria operação conferem) e lê só pelas funções de sempre, com a RLS do usuário.
// Nada é gravado, copiado para o Git nem para outro serviço: o arquivo vai só para quem pediu.
import { connection } from 'next/server';
import { chamar } from '@/servidor/banco';
import { criarOperacoes, ErroDmanda } from '@/nucleo/operacoes';
import { hojeISO } from '@/lib/demandas';

export async function GET() {
  await connection(); // só existe por pedido de uma pessoa logada: nunca entra na pré-geração do build
  const cabecalhos = { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' };
  try {
    const op = criarOperacoes(chamar);
    const [ativas, arquivadas, dias, entradas, entradasArquivadas] = await Promise.all([op.listar(false), op.listar(true), op.listarDias(), op.listarEntradas(false), op.listarEntradas(true)]);
    const agora = new Date();
    const corpo = { formato: 'dmanda-exportacao', versao: 3, exportado_em: agora.toISOString(), fuso: 'America/Sao_Paulo', demandas: ativas, arquivadas, dias_indisponiveis: dias, entradas, entradas_arquivadas: entradasArquivadas };
    return new Response(JSON.stringify(corpo, null, 2), { headers: { ...cabecalhos, 'content-disposition': `attachment; filename="dmanda-copia-${hojeISO(agora)}.json"` } });
  } catch (e) {
    if (e instanceof ErroDmanda) return Response.json({ ok: false, erro: e.message }, { status: 401, headers: cabecalhos });
    console.error('[exportar] falhou:', (e as { code?: string })?.code ?? 'sem código');
    return Response.json({ ok: false, erro: 'Não foi possível gerar a cópia agora.' }, { status: 500, headers: cabecalhos });
  }
}
