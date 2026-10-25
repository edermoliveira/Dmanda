import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { COOKIE_ULTIMO_USO, emailAutorizado } from '@/lib/sessao';

// Volta do login com o Google: troca o código pela sessão e só deixa entrar a conta autorizada.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) return NextResponse.redirect(`${origin}/login?erro=1`);
  const sb = await criarClienteServidor();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?erro=1`);
  const { data: { user } } = await sb.auth.getUser();
  if (!emailAutorizado(user?.email)) {
    await sb.auth.signOut();
    return NextResponse.redirect(`${origin}/login?negado=1`);
  }
  const r = NextResponse.redirect(`${origin}/`);
  r.cookies.set(COOKIE_ULTIMO_USO, String(Date.now()), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30, path: '/' });
  return r;
}
