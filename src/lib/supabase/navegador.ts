import { createBrowserClient } from '@supabase/ssr';
import { configSupabase, opcoesCookiesSessao } from './config';

export function criarClienteNavegador() {
  const c = configSupabase();
  if (!c) throw new Error('Supabase não configurado.');
  return createBrowserClient(c.url, c.chave, { cookieOptions: opcoesCookiesSessao(location.protocol === 'https:') });
}
