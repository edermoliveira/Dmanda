'use server';
// Conclusão da entrada por e-mail e senha. A senha vai do navegador direto ao Supabase Auth (signInWithPassword, em FormularioSenha): assim o limite de
// tentativas do Auth conta pelo endereço de quem tenta, e não pelo endereço do servidor, que é um só e esgotaria o limite para o próprio Secretário.
// Esta ação roda depois, já com a sessão nos cookies: confere que a conta é a autorizada (e-mail e provedor) e só então grava o carimbo de último uso.
// Se a conta não for a autorizada, encerra só esta sessão e responde como credencial incorreta (não revela qual existe). Sem a conclusão não há carimbo,
// e sem carimbo a porta de entrada trata a sessão como expirada (falha fechada).
import { cookies } from 'next/headers';
import { modoTeste } from '@/lib/supabase/config';
import { criarClienteServidor, requisicaoHttps } from '@/lib/supabase/servidor';
import { COOKIE_ULTIMO_USO, contaAutorizada, opcoesCookieUltimoUso } from '@/lib/sessao';

export type ResultadoEntrada = { ok: true } | { ok: false; erro: string };

const MSG_CREDENCIAIS = 'E-mail ou senha incorretos.';
const MSG_GENERICA = 'Não foi possível entrar agora. Tente de novo em instantes.';

export async function concluirEntrada(): Promise<ResultadoEntrada> {
  if (modoTeste()) return { ok: false, erro: 'No banco de teste não há entrada por senha.' };
  try {
    const sb = await criarClienteServidor();
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return { ok: false, erro: MSG_GENERICA };
    if (!contaAutorizada(user)) {
      await sb.auth.signOut({ scope: 'local' });
      return { ok: false, erro: MSG_CREDENCIAIS };
    }
    (await cookies()).set(COOKIE_ULTIMO_USO, String(Date.now()), opcoesCookieUltimoUso(await requisicaoHttps()));
    return { ok: true };
  } catch {
    return { ok: false, erro: MSG_GENERICA };
  }
}
