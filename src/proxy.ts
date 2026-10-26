// Porta de entrada: só entra quem tem sessão do Supabase, na conta autorizada, e com uso nas últimas 6 horas.
// Verificação otimista (a autorização de verdade está nas funções do banco, com RLS, e em cada ação do servidor).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configSupabase, modoTeste, opcoesCookiesSessao } from '@/lib/supabase/config';
import { COOKIE_ULTIMO_USO, contaAutorizada, opcoesCookieUltimoUso, sessaoExpirou } from '@/lib/sessao';

const emHttps = (request: NextRequest) => request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

function clienteCom(request: NextRequest, resposta: NextResponse) {
  const c = configSupabase()!;
  return createServerClient(c.url, c.chave, {
    cookieOptions: opcoesCookiesSessao(emHttps(request)),
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
    // escopo local: encerra só a sessão deste navegador (a expiração por inatividade de um aparelho não derruba os outros)
    await clienteCom(request, r).auth.signOut({ scope: 'local' });
    r.cookies.delete(COOKIE_ULTIMO_USO);
    return r;
  };
  const marca = request.cookies.get(COOKIE_ULTIMO_USO)?.value;
  if (user && !publico) {
    if (!contaAutorizada(user)) return sair('negado');
    if (sessaoExpirou(marca)) return sair('expirou');
  }
  if (!user && !publico) return NextResponse.redirect(new URL('/login', request.url));
  // com sessão válida o login não faz sentido; com a marca de uso vencida ou ausente mostra o formulário para entrar de novo
  if (user && pathname.startsWith('/login') && contaAutorizada(user) && !sessaoExpirou(marca)) return NextResponse.redirect(new URL('/', request.url));
  // Só uso de verdade renova a marca: páginas e ações pedidas por quem usa o painel. As páginas públicas (login e retorno do login) não renovam: quem
  // grava a marca ao entrar é o próprio login. O Next remove os cabeçalhos de pré-carregamento antes do proxy, então ele não os distingue; o aplicativo não
  // usa <Link> nem router.prefetch, logo nada pré-carrega sozinho. Se isso mudar, rever esta regra.
  if (user && !publico) resposta.cookies.set(COOKIE_ULTIMO_USO, String(Date.now()), opcoesCookieUltimoUso(emHttps(request)));
  return resposta;
}

// Fora da porta de entrada ficam só os arquivos estáticos pela extensão (imagens, ícones, manifesto). Nomes de pasta como "marca" não entram na exceção:
// a página antiga /marca ficava aberta sem login.
export const config = { matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|webmanifest)$).*)'] };
