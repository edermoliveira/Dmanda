// Sessão do usuário no servidor (decisão 92): Supabase Auth por e-mail e senha, com a sessão em cookies HTTP-only renovados pelo servidor (@supabase/ssr).
// Regras:
//  - um cliente NOVO por requisição (nenhum estado de usuário compartilhado entre requisições);
//  - a identidade vem de getClaims() (JWT verificado), nunca de dado enviado pelo navegador; a AUTORIZAÇÃO é do banco (RLS + conta_autorizada(), a cada consulta), então uma revogação vale mesmo com o JWT ainda válido;
//  - falha transitória de rede ao renovar NÃO é sessão inválida: nada é apagado e ninguém é mandado ao login (a operação falha com mensagem de conexão);
//  - em modo de teste (DMANDA_BANCO=teste, recusado em produção) a identidade vem do cookie dmanda-teste-usuario ou de DMANDA_USUARIO_TESTE: não há Auth real aí.
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { modoTeste } from '@/lib/supabase/config';
import { ErroSessao, ErroDmanda, ErroRevogado } from '@/nucleo/validacao';

export type Usuario = { id: string; email: string | null };

export const COOKIE_TESTE = 'dmanda-teste-usuario';

export function configAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) throw Object.assign(new Error('Supabase não configurado.'), { code: 'sem-config' });
  return { url, chave };
}

/** Opções dos cookies de sessão: HTTP-only (o navegador não precisa lê-los: tudo passa por ações do servidor), SameSite Lax, Secure em produção, persistentes (a sessão sobrevive a fechar o navegador). */
export const opcoesCookie = () => ({ httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' });

/** Cliente de autenticação desta requisição, ligado aos cookies da requisição. Fora de ação do servidor e de rota, gravar cookie falha em silêncio (a renovação acontece no proxy). */
export async function clienteDaSessao(): Promise<SupabaseClient> {
  const { url, chave } = configAuth();
  const jar = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => { try { for (const { name, value, options } of lista) jar.set(name, value, { ...options, ...opcoesCookie() }); } catch { /* componente de servidor: o proxy renova */ } },
    },
  });
}

/** Cliente SEM sessão e sem persistência, para operações isoladas (entrar com a senha atual numa checagem). Nunca recebe a chave de serviço. */
export function clienteAvulso(): SupabaseClient {
  const { url, chave } = configAuth();
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function usuarioDeTeste(): Promise<Usuario | null> {
  if (!modoTeste()) return null;
  const id = (await cookies()).get(COOKIE_TESTE)?.value || process.env.DMANDA_USUARIO_TESTE || '';
  return /^[0-9a-f-]{36}$/i.test(id) ? { id, email: null } : null;
}

/** O usuário desta requisição, com o JWT verificado; null se não há sessão válida. Lança ErroDmanda de conexão quando só a rede falhou (a sessão continua guardada). */
export async function usuarioAtual(): Promise<Usuario | null> {
  if (modoTeste()) return usuarioDeTeste();
  const sb = await clienteDaSessao();
  const { data, error } = await sb.auth.getClaims();
  if (error) {
    if (isAuthRetryableFetchError(error)) throw new ErroDmanda('Sem conexão com o serviço de acesso. Nada foi perdido: tente de novo em instantes.');
    // a revogação bloqueia a conta também no Auth: o código oficial user_banned é revogação, não sessão vencida (a tela mostra "acesso revogado" em vez de mandar ao login em silêncio)
    if ((error as { code?: string }).code === 'user_banned') throw new ErroRevogado('Seu acesso ao Dmanda foi revogado.');
    return null;
  }
  const claims = data?.claims;
  return claims?.sub ? { id: String(claims.sub), email: typeof claims.email === 'string' ? claims.email : null } : null;
}

/** Como usuarioAtual, mas sem sessão é erro (ErroSessao): quem chama as operações do painel passa por aqui. */
export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual();
  if (!u) throw new ErroSessao();
  return u;
}
