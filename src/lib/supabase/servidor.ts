import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { configSupabase } from './config';

/** Cliente do Supabase no servidor, com a sessão do usuário nos cookies (a RLS vale como esse usuário). */
export async function criarClienteServidor() {
  const c = configSupabase();
  if (!c) throw new Error('Supabase não configurado: faltam NEXT_PUBLIC_SUPABASE_URL e a chave pública (veja .env.example).');
  const jar = await cookies();
  return createServerClient(c.url, c.chave, {
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
