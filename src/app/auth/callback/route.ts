import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { contaAutorizada } from '@/lib/sessao';

// Volta do login com o Google: troca o código pela sessão e só deixa entrar a conta autorizada.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) {
    // O hook de cadastro do Supabase recusou uma conta que não é a autorizada: o Auth volta aqui com o motivo e sem código.
    const motivo = searchParams.get('error_description') ?? '';
    return NextResponse.redirect(`${origin}/login?${/acesso ao Dmanda/i.test(motivo) ? 'negado' : 'erro'}=1`);
  }
  const sb = await criarClienteServidor();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?erro=1`);
  const { data: { user } } = await sb.auth.getUser();
  if (!contaAutorizada(user)) {
    await sb.auth.signOut({ scope: 'local' });
    return NextResponse.redirect(`${origin}/login?negado=1`);
  }
  return NextResponse.redirect(`${origin}/`);
}
