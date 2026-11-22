// Proxy (Next 16): renova a sessão do Supabase Auth a cada requisição e leva páginas sem sessão ao login. NÃO é a proteção dos dados: ela está no banco (RLS + conta_autorizada) e nas ações do servidor,
// que exigem a identidade em toda operação. Aqui ficam só a experiência (redirecionar) e o cuidado de cache: respostas autenticadas nunca vão para cache compartilhado.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

const PUBLICAS = ['/login', '/recuperar', '/auth/confirmar'];
const emTeste = () => process.env.DMANDA_BANCO === 'teste' && process.env.NODE_ENV !== 'production';

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const api = pathname.startsWith('/api/');
  const acao = request.headers.has('next-action');   // ação do servidor: ela mesma exige a identidade e responde ao cliente
  let resposta = NextResponse.next({ request });
  if (!api) resposta.headers.set('cache-control', 'private, no-store');   // as rotas de API definem o próprio cabeçalho (no-store)
  let autenticado = false, incerto = false, banido = false;

  if (emTeste()) {
    autenticado = !!(request.cookies.get('dmanda-teste-usuario')?.value || process.env.DMANDA_USUARIO_TESTE);
  } else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && chave) {
      const sb = createServerClient(url, chave, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (lista) => {
            for (const { name, value } of lista) request.cookies.set(name, value);
            resposta = NextResponse.next({ request });
            if (!api) resposta.headers.set('cache-control', 'private, no-store');
            for (const { name, value, options } of lista) resposta.cookies.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
          },
        },
      });
      const { data, error } = await sb.auth.getClaims();
      autenticado = !error && !!data?.claims?.sub;
      banido = (error as { code?: string } | null)?.code === 'user_banned';   // a revogação também bloqueia a conta no Auth
      incerto = !!error && isAuthRetryableFetchError(error);   // rede fora ao renovar: a sessão continua guardada, ninguém é mandado ao login
    }
  }

  if (!autenticado && !incerto && !publica && !api && !acao) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/login'; destino.search = '';
    if (request.method === 'GET' && pathname !== '/') destino.searchParams.set('proximo', pathname + search);
    // havia sessão e ela deixou de valer (revogada, banida, expirada): o login explica, em vez de parecer que nada aconteceu
    if (banido) destino.searchParams.set('motivo', 'sem-acesso');
    else if (request.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name))) destino.searchParams.set('motivo', 'sessao');
    const r = NextResponse.redirect(destino);
    r.headers.set('cache-control', 'private, no-store');
    return r;
  }
  if (autenticado && pathname === '/login') {
    const r = NextResponse.redirect(new URL('/', request.url));
    for (const c of resposta.cookies.getAll()) r.cookies.set(c);
    r.headers.set('cache-control', 'private, no-store');
    return r;
  }
  return resposta;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|api/cron|api/sonda).*)'] };
