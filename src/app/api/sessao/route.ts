// Sonda leve da sessão: devolve 204 sem corpo. Quem não tem sessão válida nunca chega aqui, porque a porta de entrada (src/proxy.ts) redireciona ao login.
// A tela a usa depois de uma falha para saber se o problema é a sessão encerrada (redirecionamento) ou a conexão, sem renderizar nenhuma página.
import { connection } from 'next/server';

export async function GET() {
  await connection();
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
