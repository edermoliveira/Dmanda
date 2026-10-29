'use server';
// Conclusão da entrada por e-mail e senha. A senha vai do navegador direto ao Supabase Auth (signInWithPassword, em FormularioSenha): assim o limite de
// tentativas do Auth conta pelo endereço de quem tenta, e não pelo endereço do servidor, que é um só e esgotaria o limite para o próprio Secretário.
// Esta ação roda depois, já com a sessão nos cookies, e faz duas coisas:
//  1. confere que a conta é a autorizada (e-mail e provedor); se não for, encerra só esta sessão e responde como credencial incorreta (não revela qual existe);
//  2. regrava a sessão pelo servidor (Set-Cookie). Os cookies que o navegador escreve por script (document.cookie) valem pouco no Safari do iPhone e do iPad
//     (a prevenção de rastreamento limita a 7 dias os cookies escritos por script); os escritos pelo servidor mantêm a validade inteira. Se a regravação falhar,
//     a entrada continua valendo com os cookies que já existem: nada disso é motivo para recusar uma senha correta.
import { modoTeste } from '@/lib/supabase/config';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { contaAutorizada } from '@/lib/sessao';

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
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    } catch {
      /* regravação é reforço de durabilidade; a sessão já está nos cookies do navegador */
    }
    return { ok: true };
  } catch {
    return { ok: false, erro: MSG_GENERICA };
  }
}
