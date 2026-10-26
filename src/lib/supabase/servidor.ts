import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { configSupabase, opcoesCookiesSessao } from './config';

/** true se a requisição chegou por HTTPS (atrás da Vercel o cabeçalho x-forwarded-proto vale https; no computador, em http, não existe). */
export async function requisicaoHttps() {
  return (await headers()).get('x-forwarded-proto') === 'https';
}

/** Cliente do Supabase no servidor, com a sessão do usuário nos cookies (a RLS vale como esse usuário). */
export async function criarClienteServidor() {
  const c = configSupabase();
  if (!c) throw new Error('Supabase não configurado: faltam NEXT_PUBLIC_SUPABASE_URL e a chave pública (veja .env.example).');
  const jar = await cookies();
  const https = await requisicaoHttps();
  return createServerClient(c.url, c.chave, {
    cookieOptions: opcoesCookiesSessao(https),
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) jar.set(name, value, options);
        } catch {
          /* chamado de um componente do servidor: o proxy renova a sessão */
        }
      },
    },
  });
}
