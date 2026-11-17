// Sonda leve de conexão: devolve 204 sem corpo. A tela a usa depois de uma falha para saber se o servidor está inalcançável (o pedido nem chegou) ou respondeu (o resultado é incerto),
// sem renderizar nenhuma página nem tocar no banco.
import { connection } from 'next/server';

export async function GET() {
  await connection();
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
