// Variáveis públicas do Supabase. A chave aqui é a pública (publishable/anon): ela só vale com a RLS e o login.
// Nunca coloque a chave de serviço (service_role) em variável NEXT_PUBLIC.
export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return null;
  return { url, chave };
}

/** Modo de teste: banco local descartável, só em desenvolvimento. Em produção a variável é recusada. */
export function modoTeste(): boolean {
  if (process.env.DMANDA_BANCO !== 'teste') return false;
  if (process.env.NODE_ENV === 'production') throw new Error('DMANDA_BANCO=teste não é permitido em produção.');
  return true;
}
