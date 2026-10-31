// Porta de entrada: só entra quem tem sessão válida do Supabase, na conta autorizada. Verificação otimista (a autorização de verdade está nas funções do
// banco, com RLS, e em cada ação do servidor).
//
// A sessão persiste: o token de acesso é renovado aqui, pelo SDK oficial, e os cookies renovados precisam chegar a DOIS lugares: ao navegador (Set-Cookie na
// resposta, inclusive nos redirecionamentos) e à renderização da mesma requisição (cookies do pedido). Se a renovação não chegasse à renderização, a página ou a
// ação gastaria o token de renovação de novo; se não chegasse ao navegador, o próximo pedido tentaria renovar com um token já usado e a sessão seria revogada.
// Falha de rede ao confirmar a sessão NÃO a apaga e NÃO libera o acesso: a página mostra "tente de novo" e nada é gravado nos cookies.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configSupabase, modoTeste, opcoesCookiesSessao } from '@/lib/supabase/config';
import { modoDemo } from '@/lib/demo';
import { COOKIE_LEGADO_ULTIMO_USO, contaAutorizada, ehCookieDeSessao, situacaoDoErroAuth } from '@/lib/sessao';

const emHttps = (request: NextRequest) => request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

type Gravacao = { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] };

const PAGINA_INDISPONIVEL = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><title>Dmanda</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:13.6px/1.5 system-ui,-apple-system,sans-serif;background:Canvas;color:CanvasText}main{max-width:26rem}h1{font-size:1.06rem;margin:0 0 .5rem}button{font:inherit;min-height:44px;padding:0 20px;border-radius:12px;border:0;background:#0A84FF;color:#fff;cursor:pointer}</style></head>
<body><main><h1>Não foi possível confirmar sua sessão agora</h1><p>Parece um problema de conexão. Sua sessão foi mantida e nada foi perdido. Confira a internet e tente de novo.</p><button type="button" onclick="location.reload()">Tentar de novo</button></main></body></html>`;

export async function proxy(request: NextRequest) {
  // A rotina diária se autentica sozinha (CRON_SECRET) e não pode renovar nem exigir sessão: passa direto, sem tocar em cookies.
  if (request.nextUrl.pathname.startsWith('/api/cron/')) return NextResponse.next();
  if (modoTeste() || modoDemo()) return NextResponse.next(); // prévia visual com dados fictícios: sem Supabase, sem login (a Vercel protege a implantação)
  const c = configSupabase();
  if (!c) {
    return new NextResponse('Dmanda: o Supabase ainda não está configurado neste ambiente (faltam as variáveis do .env.local, veja .env.example).', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const { pathname } = request.nextUrl;
  const publico = pathname.startsWith('/login') || pathname.startsWith('/auth');
  const tinhaCookieLegado = request.cookies.has(COOKIE_LEGADO_ULTIMO_USO);
  // lido antes de conferir a sessão: o SDK limpa os cookies de uma sessão que o Auth recusa, e depois disso não dá mais para saber se existia sessão
  const tinhaSessao = request.cookies.getAll().some((k) => ehCookieDeSessao(k.name) && k.value);

  let resposta = NextResponse.next({ request });
  const gravacoes: Gravacao[] = [];
  let cabecalhos: Record<string, string> = {};
  const aplicar = (r: NextResponse) => {
    for (const g of gravacoes) r.cookies.set(g.name, g.value, g.options);
    for (const [k, v] of Object.entries(cabecalhos)) r.headers.set(k, v);
    if (tinhaCookieLegado) r.cookies.delete(COOKIE_LEGADO_ULTIMO_USO); // resto da regra antiga das 6 horas: só limpeza, nunca decide nada
    return r;
  };
  const sb = createServerClient(c.url, c.chave, {
    cookieOptions: opcoesCookiesSessao(emHttps(request)),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, headers) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        // a resposta é refeita com o pedido já atualizado: assim a página e as ações desta mesma requisição enxergam os cookies renovados
        resposta = NextResponse.next({ request });
        gravacoes.push(...lista);
        cabecalhos = { ...cabecalhos, ...headers };
        aplicar(resposta);
      },
    },
  });
  const redirecionar = (destino: string) => aplicar(NextResponse.redirect(new URL(destino, request.url)));

  const { data: { user }, error } = await sb.auth.getUser();
  const situacao = user ? 'ok' : situacaoDoErroAuth(error);

  if (situacao === 'transitoria') {
    // não deu para confirmar a sessão (rede, Auth fora do ar, limite de requisições): nada é apagado e nada é liberado
    if (publico) return aplicar(resposta);
    return aplicar(new NextResponse(PAGINA_INDISPONIVEL, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '5' } }));
  }
  if (!user) {
    if (publico) return aplicar(resposta);
    // sem sessão alguma é a primeira visita; com cookies de sessão que o Auth recusou, a sessão foi encerrada ou revogada
    if (tinhaSessao && situacao === 'invalida') await sb.auth.signOut({ scope: 'local' }).catch(() => undefined); // limpa só os cookies deste navegador
    return redirecionar(tinhaSessao || situacao === 'invalida' ? '/login?encerrada=1' : '/login');
  }
  // as páginas públicas não barram a conta fora da lista: a ação de entrada do próprio /login confere a conta e responde "e-mail ou senha incorretos"
  if (!publico && !contaAutorizada(user)) {
    // escopo local: encerra só a sessão deste navegador
    await sb.auth.signOut({ scope: 'local' });
    return redirecionar('/login?negado=1');
  }
  // com sessão válida o login não faz sentido. Só para quem navega até lá (GET): a ação que conclui a entrada é um POST para /login e precisa rodar
  // (é ela que confere a conta e regrava a sessão pelo servidor); uma tela de login que ficou velha também a chama e termina no painel.
  if (pathname.startsWith('/login') && request.method === 'GET' && contaAutorizada(user)) return redirecionar('/');
  return aplicar(resposta);
}

// Fora da porta de entrada ficam só os arquivos estáticos pela extensão (imagens, ícones, manifesto). Nomes de pasta como "marca" não entram na exceção:
// a página antiga /marca ficava aberta sem login.
export const config = { matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|webmanifest)$).*)'] };
