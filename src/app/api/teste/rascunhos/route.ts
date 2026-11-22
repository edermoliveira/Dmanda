// SÓ PARA AS SUÍTES DE NAVEGADOR (modo de teste, nunca em produção): apaga os rascunhos da conta de teste no banco descartável, para que cada cenário comece sem os rascunhos online do anterior
// (antes, o armazenamento de um contexto novo vinha vazio; agora o rascunho mora no banco e é recuperado em qualquer contexto, de propósito). Fora do modo de teste responde 404.
import { connection } from 'next/server';
import { modoTeste } from '@/lib/supabase/config';
import { clienteBancoTeste } from '@/servidor/banco';

export async function DELETE() {
  await connection();
  let teste = false;
  try { teste = modoTeste() && process.env.NODE_ENV !== 'production'; } catch { teste = false; }
  if (!teste) return new Response(null, { status: 404 });
  const db = await clienteBancoTeste();
  await db.query('delete from public.rascunhos');
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
