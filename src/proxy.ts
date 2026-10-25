// Porta de entrada: só entra quem tem sessão do Supabase, na conta autorizada, e com uso nas últimas 6 horas.
// Verificação otimista (a autorização de verdade está nas funções do banco, com RLS, e em cada ação do servidor).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configSupabase, modoTeste } from '@/lib/supabase/config';
import { COOKIE_ULTIMO_USO, emailAutorizado, sessaoExpirou } from '@/lib/sessao';

function clienteCom(request: NextRequest, resposta: NextResponse) {
  const c = configSupabase()!;
  return createServerClient(c.url, c.chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
      },
    },
  });
}

export async function proxy(request: NextRequest) {
  // A rotina diária se autentica sozinha (CRON_SECRET) e não pode renovar nem exigir sessão: passa direto, sem tocar em cookies.
  if (request.nextUrl.pathname.startsWith('/api/cron/')) return NextResponse.next();
  if (modoTeste()) return NextResponse.next();
  if (!configSupabase()) {
    return new NextResponse('Dmanda: o Supabase ainda não está configurado neste ambiente (faltam as variáveis do .env.local, veja .env.example).', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const { pathname } = request.nextUrl;
  const publico = pathname.startsWith('/login') || pathname.startsWith('/auth');
  const resposta = NextResponse.next({ request });
  const sb = clienteCom(request, resposta);
  const { data: { user } } = await sb.auth.getUser();

  const sair = async (motivo: string) => {
    const r = NextResponse.redirect(new URL(`/login?${motivo}=1`, request.url));
    await clienteCom(request, r).auth.signOut();
    r.cookies.delete(COOKIE_ULTIMO_USO);
    return r;
  };
  if (user && !publico) {
    if (!emailAutorizado(user.email)) return sair('negado');
    if (sessaoExpirou(request.cookies.get(COOKIE_ULTIMO_USO)?.value)) return sair('expirou');
  }
  if (!user && !publico) return NextResponse.redirect(new URL('/login', request.url));
  if (user && pathname.startsWith('/login') && emailAutorizado(user.email)) return NextResponse.redirect(new URL('/', request.url));
  if (user) resposta.cookies.set(COOKIE_ULTIMO_USO, String(Date.now()), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30, path: '/' });
  return resposta;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|marca|emojis|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|webmanifest)$).*)'] };
