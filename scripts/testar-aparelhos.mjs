// Etapa 5 de 6 (decisão 82): abertura direta em aparelhos autorizados, de ponta a ponta e em ambiente ISOLADO. O aplicativo REAL (proxy, ações do servidor, rota de exportação, rotina
// diária) roda em modo real contra um Supabase FALSO local (scripts/supabase-falso.mjs: Auth com generate_link, verify, renovação e logout, mais a API de funções) na frente de um banco
// de TESTE (PGlite, as mesmas migrações, dados fictícios). Nunca toca o Supabase real. Perfis de navegador separados (Edge e WebKit emulado), computador e iPhone, Claro e Escuro.
// Cobre: aparelho novo, autorização inicial por código, abertura direta depois de recarregar e de reiniciar o navegador, validade, revogação individual, recuperação do titular pelo
// terminal, acesso direto a páginas, exportação, ações do servidor e funções do banco com e sem autorização, falha transitória, rotina diária e cabeçalhos de cache.
// NÃO prova o Safari físico, o modo PWA instalado nem o domínio final. Uso: node scripts/testar-aparelhos.mjs
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { iniciarSupabaseFalso, CHAVE_PUBLICA, CHAVE_SERVICO } from './supabase-falso.mjs';

const exec = promisify(execFile);
const PORTA = process.env.PORTA_TESTE_APARELHOS || '7129', PORTA_FALSO = 7130, BASE = `http://localhost:${PORTA}`, RAIZ = '.dados-teste/aparelhos', CAPTURAS = '.dados-teste/aparelhos-capturas';
const EMAIL = 'titular-de-teste@exemplo.invalid', USUARIO = 'f0f0f0f0-0000-4000-8000-0000000000a1', NOME = 'Demanda fictícia do titular';
rmSync(RAIZ, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true }); mkdirSync(RAIZ, { recursive: true });
let falhas = 0, total = 0, ultimo = '';
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m + (c || !ultimo ? '' : `\n        obtido: ${String(ultimo).slice(0, 500)}`)); if (!c) falhas++; ultimo = ''; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- banco de teste, Supabase falso e aplicativo real ----------
const db = await abrirBancoTeste({ pasta: `${RAIZ}/pg` });
await db.query('insert into auth.users (id, email) values ($1, $2)', [USUARIO, EMAIL]);
await db.query('insert into dmanda_privado.acesso_autorizado (email) values ($1)', [EMAIL]);
await chamarComoUsuario(db, USUARIO, 'criar_demanda', { p: { assunto: NOME } }, { provedor: 'email' });
const falso = await iniciarSupabaseFalso({ db, porta: PORTA_FALSO, email: EMAIL, usuarioId: USUARIO });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: falso.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE_PUBLICA, SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO, DMANDA_EMAIL_AUTORIZADO: EMAIL, CRON_SECRET: 'segredo-de-teste', DMANDA_SEM_LEMBRETES: 'sim' };
delete env.DMANDA_BANCO;
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } falso.parar(); };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/acesso', { redirect: 'manual' }); if (r.status < 500) break; } catch { /* subindo */ } await esperar(2000); }

const terminal = async (...args) => {
  const { stdout } = await exec(process.execPath, ['scripts/aparelhos.mjs', ...args], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: falso.url, SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO } }).catch((e) => ({ stdout: `${e.stdout ?? ''}${e.stderr ?? ''}` }));
  return stdout;
};
const novoCodigo = async () => /([A-Z2-9]{4}-[A-Z2-9]{4})/.exec(await terminal('convite'))?.[1] ?? null;
const sqlq = async (q, p = []) => (await db.query(q, p)).rows;

const edge = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const wk = await webkit.launch().catch((e) => { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); return null; });
const erros = [];
const PERFIS = { desktop: { viewport: { width: 1440, height: 900 } }, celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } };
const novo = async (perfil = 'desktop', { motor = edge, tema = 'claro', texto = 100, estado } = {}) => {
  const ctx = await motor.newContext({ ...(motor === wk && perfil === 'celular' ? devices['iPhone 13'] : PERFIS[perfil]), ...(estado ? { storageState: estado } : {}) });
  await ctx.addInitScript(([t, p]) => { try { if (!localStorage.getItem('feito')) { localStorage.setItem('feito', '1'); localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:aparencia', JSON.stringify({ textoPct: p })); } } catch { /* sem armazenamento */ } }, [tema, texto]);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed|status of 40[0-9]|status of 50[0-9]/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
const painel = async (pg) => { await pg.waitForSelector('.app .main', { timeout: 120000 }); await pg.waitForFunction(() => !/Carregando as demandas|Carregando a agenda/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {}); await pg.locator('button:has-text("Agora não")').first().click({ timeout: 2500 }).catch(() => {}); await esperar(500); };
const ir = async (pg, rota) => { await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); };
const caminho = (pg) => new URL(pg.url()).pathname + new URL(pg.url()).search;
const cookieDe = async (ctx) => (await ctx.cookies()).filter((c) => c.value).map((c) => `${c.name}=${c.value}`).join('; ');
const nCookiesSessao = async (ctx) => (await ctx.cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name) && c.value).length;
const pedir = (rota, cookie, extra = {}) => fetch(BASE + rota, { redirect: 'manual', headers: cookie ? { cookie } : {}, ...extra });
const autorizar = async (pg, codigo) => { await ir(pg, '/acesso'); await pg.waitForSelector('#acesso-codigo', { timeout: 120000 }); await pg.fill('#acesso-codigo', codigo); await pg.click('.login-form button[type=submit]'); };
const entrarComCodigo = async (perfil, opcoes) => { const c = await novo(perfil, opcoes), codigo = await novoCodigo(); await autorizar(c.pg, codigo); await c.pg.waitForURL((u) => new URL(u).pathname === '/', { timeout: 120000 }); await painel(c.pg); return { ...c, codigo }; };
const tokenDoContexto = async (ctx) => { const c = (await ctx.cookies()).find((x) => /^sb-.+-auth-token$/.test(x.name)); try { return JSON.parse(Buffer.from(decodeURIComponent(c.value).replace(/^base64-/, ''), 'base64url').toString()).access_token; } catch { return ''; } };
const aparelhosNoBanco = () => sqlq('select nome, revogado_em is not null as revogado, sessao_id::text from dmanda_privado.aparelhos order by criado_em');

// =============================================================================================================================================
// 1) aparelho novo: nada abre sem autorização, e não há e-mail nem senha
// =============================================================================================================================================
{
  for (const rota of ['/', '/demandas', '/api/exportar', '/login', '/api/sessao']) {
    const r = await pedir(rota);
    const dest = new URL(r.headers.get('location') ?? 'http://x/', 'http://x').pathname;
    ok(r.status === 307 && dest === '/acesso', `sem cookie, ${rota} redireciona para /acesso (${r.status} ${dest})`);
  }
  const html = await (await pedir('/acesso')).text();
  ok(/Acesso restrito/.test(html) && /acesso-codigo/.test(html) && !/type="password"|type="email"|login-senha|login-email/.test(html), 'a tela /acesso é um estado de acesso restrito com campo de código, sem e-mail nem senha');
  ok((await pedir('/api/cron/diaria')).status === 401 && (await pedir('/api/cron/diaria', null, { headers: { authorization: 'Bearer segredo-de-teste' } })).status === 200, 'a rotina diária mantém a autenticação própria: sem o segredo 401, com o segredo 200, sem sessão nem aparelho');
  const rpcSemToken = await fetch(`${falso.url}/rest/v1/rpc/listar_demandas`, { method: 'POST', headers: { apikey: CHAVE_PUBLICA, 'content-type': 'application/json' }, body: '{"p_arquivadas":false}' });
  ok(rpcSemToken.status === 401, 'a API de funções recusa quem não tem token (nenhum dado sem sessão)');
}

// =============================================================================================================================================
// 2) autorização inicial pelo terminal do titular, abertura direta, recarga e reinício do navegador
// =============================================================================================================================================
const A = await (async () => {
  const c = await novo('desktop');
  await ir(c.pg, '/acesso'); await c.pg.waitForSelector('#acesso-codigo', { timeout: 120000 });
  // código fora do formato, código errado e a trava por tentativas
  await c.pg.fill('#acesso-codigo', 'abc'); await c.pg.click('.login-form button[type=submit]');
  ok(/Confira o código/.test(await c.pg.textContent('.login-form [role=alert]')), 'código fora do formato: a tela pede para conferir');
  await c.pg.fill('#acesso-codigo', 'ZZZZ-9999'); await c.pg.click('.login-form button[type=submit]'); await c.pg.waitForSelector('.login-form [role=alert]:has-text("inválido ou vencido")', { timeout: 30000 });
  ok(/inválido ou vencido/.test(await c.pg.textContent('.login-form [role=alert]')) && (await nCookiesSessao(c.ctx)) === 0 && caminho(c.pg) === '/acesso', 'código errado: mensagem sem revelar nada, nenhuma sessão criada');
  const codigo = await novoCodigo();
  ok(!!codigo && (await sqlq('select origem from dmanda_privado.convites_aparelho'))[0]?.origem === 'terminal', `o titular gera o código no terminal (${codigo ? 'formato ABCD-2345' : 'falhou'}), de uso único e guardado só como hash`);
  ok((await sqlq("select count(*)::int n from dmanda_privado.convites_aparelho where codigo_hash like '%' || $1 || '%'", [codigo.replace('-', '')]))[0].n === 0, 'o código em si não está no banco (só o hash)');
  await c.pg.fill('#acesso-codigo', codigo.toLowerCase()); await c.pg.click('.login-form button[type=submit]');
  await c.pg.waitForURL((u) => new URL(u).pathname === '/', { timeout: 120000 }); await painel(c.pg);
  ok(caminho(c.pg) === '/' && (await nCookiesSessao(c.ctx)) >= 1 && /Início/.test(await c.pg.textContent('.main')), 'o aparelho novo troca o código por uma sessão e abre direto no painel');
  const linhas = await aparelhosNoBanco();
  ok(linhas.length === 1 && /Edge/.test(linhas[0].nome) && !linhas[0].revogado, `o aparelho foi registrado no banco com nome legível (${linhas[0]?.nome})`);
  ok(falso.estado.chamadas.includes('POST /auth/v1/admin/generate_link') && falso.estado.chamadas.includes('POST /auth/v1/verify'), 'a sessão nasceu no servidor (generate_link + verify), sem e-mail nem senha');
  // o mesmo código não vale duas vezes
  const outro = await novo('desktop'); await autorizar(outro.pg, codigo); await outro.pg.waitForSelector('.login-form [role=alert]', { timeout: 30000 });
  ok(/inválido ou vencido/.test(await outro.pg.textContent('.login-form [role=alert]')) && (await nCookiesSessao(outro.ctx)) === 0, 'o código é de uso único: usado de novo é recusado');
  await outro.ctx.close();
  return { ...c, codigo };
})();
{
  // recarregar, abrir direto numa página interna e reiniciar o navegador (novo perfil com os mesmos cookies)
  await A.pg.reload({ waitUntil: 'load' }); await painel(A.pg);
  ok(caminho(A.pg) === '/', 'recarregar mantém o aparelho aberto direto');
  await ir(A.pg, '/demandas'); await painel(A.pg);
  ok(/Demanda fictícia do titular/.test((await A.pg.textContent('#vista')) ?? ''), 'a página de Demandas abre direto e mostra os dados do titular');
  const estado = await A.ctx.storageState(); await A.ctx.close();
  const R = await novo('desktop', { estado }); await ir(R.pg, '/demandas'); await painel(R.pg);
  ok(caminho(R.pg) === '/demandas' && /Demanda fictícia do titular/.test((await R.pg.textContent('#vista')) ?? ''), 'reiniciar o navegador (novo perfil com os mesmos cookies) abre direto, sem pedir nada');
  A.ctx = R.ctx; A.pg = R.pg;
  // cabeçalhos: resposta personalizada nunca vai para cache compartilhado
  const cab = await pedir('/demandas', await cookieDe(A.ctx));
  const cabExp = await pedir('/api/exportar', await cookieDe(A.ctx));
  ok(cab.status === 200 && /no-store|private/.test(cab.headers.get('cache-control') ?? ''), `a página personalizada sai com cache-control privado (${cab.headers.get('cache-control')})`);
  ok(cabExp.status === 200 && /no-store|private/.test(cabExp.headers.get('cache-control') ?? '') && (await cabExp.json()).formato === 'dmanda-exportacao', 'a exportação funciona no aparelho autorizado e sai sem cache compartilhado');
  // /acesso com aparelho autorizado volta ao painel
  const ac = await pedir('/acesso', await cookieDe(A.ctx));
  ok(ac.status === 307 && new URL(ac.headers.get('location'), 'http://x').pathname === '/', 'quem já tem aparelho autorizado não vê a tela de acesso');
}

// =============================================================================================================================================
// 3) a exigência: sessões sem registro (a versão antiga, por senha) perdem o acesso quando ela é ligada; a transição é reversível
// =============================================================================================================================================
let antigaCookie = '';
{
  // uma sessão do Auth que nunca foi registrada como aparelho (como as da versão com senha)
  const sid = crypto.randomUUID(); falso.estado.sessoes.set(sid, { n: 0 });
  const tok = falso.jwtDe(sid);
  const sbCookie = 'base64-' + Buffer.from(JSON.stringify({ access_token: tok, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `rt:${sid}:0`, user: { id: USUARIO, email: EMAIL, app_metadata: { provider: 'email' } } })).toString('base64url');
  antigaCookie = `sb-127-auth-token=${sbCookie}`;
  ok((await pedir('/demandas', antigaCookie)).status === 200, 'transição: com a exigência desligada a sessão antiga (sem registro) segue abrindo, como antes da etapa 5');
  await terminal('exigir', 'sim');
  const r = await pedir('/demandas', antigaCookie);
  ok(r.status === 307 && /\/acesso\?revogado=1/.test(r.headers.get('location') ?? ''), `exigência ligada: a sessão antiga sem registro é barrada (${r.headers.get('location')})`);
  ok((await pedir('/api/exportar', antigaCookie)).status === 307, 'exigência ligada: a exportação também recusa a sessão sem registro');
  const rpc = await fetch(`${falso.url}/rest/v1/rpc/listar_demandas`, { method: 'POST', headers: { apikey: CHAVE_PUBLICA, authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: '{"p_arquivadas":false}' });
  ok(rpc.status === 200 && (await rpc.json()).length === 0, 'exigência ligada: direto na API de funções, o token ainda válido da sessão sem registro lê uma lista vazia');
  const grava = await fetch(`${falso.url}/rest/v1/rpc/criar_demanda`, { method: 'POST', headers: { apikey: CHAVE_PUBLICA, authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ p: { assunto: 'Não pode gravar' } }) });
  ok(grava.status >= 400 && (await sqlq("select count(*)::int n from public.demandas where assunto = 'Não pode gravar'"))[0].n === 0, 'exigência ligada: e o mesmo token não grava nada');
  ok((await pedir('/demandas', await cookieDe(A.ctx))).status === 200, 'o aparelho autorizado continua abrindo com a exigência ligada');
}

// =============================================================================================================================================
// 4) segundo aparelho, pelo convite de um aparelho autorizado; revogação individual; o outro continua
// =============================================================================================================================================
let B;
{
  await ir(A.pg, '/config'); await painel(A.pg); await A.pg.waitForSelector('[data-aparelhos] [data-aparelho]', { timeout: 60000 });
  ok((await A.pg.$$('[data-aparelhos] [data-aparelho]')).length === 1 && !!(await A.pg.$('[data-aparelho][data-atual]')) && /Este aparelho/.test(await A.pg.textContent('[data-aparelho][data-atual]')), 'Configurações, Aparelhos: a lista mostra o aparelho atual marcado');
  await A.pg.click('[data-gerar-convite]'); await A.pg.waitForSelector('[data-codigo-convite]', { timeout: 30000 });
  const codigoB = (await A.pg.textContent('[data-codigo-convite] .mono')).trim();
  ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(codigoB) && /vale por mais/.test(await A.pg.textContent('[data-codigo-convite]')) && (await sqlq("select origem from dmanda_privado.convites_aparelho where usado_em is null"))[0].origem === 'aparelho', `um aparelho autorizado gera o código na tela (${codigoB}) com a validade à vista`);
  B = await novo('celular', { motor: wk ?? edge });
  await autorizar(B.pg, codigoB); await B.pg.waitForURL((u) => new URL(u).pathname === '/', { timeout: 120000 }); await painel(B.pg);
  ok(caminho(B.pg) === '/' && (await aparelhosNoBanco()).length === 2, `o segundo aparelho (${wk ? 'WebKit emulado, iPhone' : 'Edge, iPhone'}) é autorizado e abre direto`);
  B.cookieAntes = await cookieDe(B.ctx); B.token = await tokenDoContexto(B.ctx);
  await ir(A.pg, '/config'); await painel(A.pg); await A.pg.waitForSelector('[data-aparelhos] [data-aparelho]');
  ok((await A.pg.$$('[data-aparelhos] [data-aparelho]')).length === 2, 'a lista do primeiro aparelho passa a mostrar os dois');
  // o aparelho B abre uma página e fica nela; depois o A o revoga
  await ir(B.pg, '/demandas'); await painel(B.pg);
  const li = A.pg.locator('[data-aparelho]:not([data-atual])');
  await li.locator('button:has-text("Revogar")').click(); await li.locator('[data-confirmar-revogar]').click();
  await A.pg.waitForFunction(() => document.querySelectorAll('[data-aparelho]').length === 1, null, { timeout: 30000 });
  ok((await aparelhosNoBanco()).filter((x) => x.revogado).length === 1 && /revogado/.test(await A.pg.textContent('[data-revogados]')), 'revogar um aparelho específico: sai da lista de autorizados e fica registrado como revogado');
  // B: nova navegação, nova leitura, exportação e ação do servidor
  await ir(B.pg, '/demandas');
  ok(caminho(B.pg) === '/acesso?revogado=1' && (await nCookiesSessao(B.ctx)) === 0 && /não está mais autorizado/.test(await B.pg.textContent('.login-caixa')), 'o aparelho revogado perde o acesso na próxima navegação e volta à tela de acesso, com a sessão local encerrada');
  ok((await pedir('/demandas', B.cookieAntes)).status === 307 && (await pedir('/api/exportar', B.cookieAntes)).status === 307, 'repetir os cookies antigos do aparelho revogado (token ainda válido) não abre página nem exportação');
  const tokB = B.token;
  const lerB = await fetch(`${falso.url}/rest/v1/rpc/listar_demandas`, { method: 'POST', headers: { apikey: CHAVE_PUBLICA, authorization: `Bearer ${tokB}`, 'content-type': 'application/json' }, body: '{"p_arquivadas":false}' });
  ok(!!tokB && lerB.status === 200 && (await lerB.json()).length === 0, 'direto na API de funções, o token ainda válido do aparelho revogado lê uma lista vazia');
  const nAntes = (await sqlq('select count(*)::int n from public.demandas'))[0].n;
  const escrB = await fetch(`${falso.url}/rest/v1/rpc/criar_demanda`, { method: 'POST', headers: { apikey: CHAVE_PUBLICA, authorization: `Bearer ${tokB}`, 'content-type': 'application/json' }, body: JSON.stringify({ p: { assunto: 'Do aparelho revogado' } }) });
  ok(escrB.status >= 400 && (await sqlq('select count(*)::int n from public.demandas'))[0].n === nAntes, 'e não grava nada');
  // o aparelho A segue valendo
  await ir(A.pg, '/demandas'); await painel(A.pg);
  ok(caminho(A.pg) === '/demandas' && /Demanda fictícia do titular/.test((await A.pg.textContent('#vista')) ?? ''), 'enquanto isso o outro aparelho continua autorizado, com os mesmos dados');
  await B.ctx.close();
}

// =============================================================================================================================================
// 5) ação do servidor num aparelho que estava aberto quando foi revogado: nada é gravado e a pessoa é levada à autorização
// =============================================================================================================================================
{
  const C = await entrarComCodigo('desktop');
  await ir(C.pg, '/demandas'); await painel(C.pg);
  await terminal('revogar-todos', '--sim');       // os dois ficam revogados; a página do C continua aberta no navegador
  const antes = (await sqlq('select count(*)::int n from public.demandas'))[0].n;
  await C.pg.click('.toolbar .btn.escuro'); await C.pg.waitForSelector('#n-assunto');
  await C.pg.fill('#n-assunto', 'Tentativa de gravar depois de revogado'); await C.pg.click('.modal .btn.pri'); await esperar(2500);
  await C.pg.click('.modal .btn.pri').catch(() => {}); await esperar(4000);
  ok((await sqlq('select count(*)::int n from public.demandas'))[0].n === antes && (await sqlq("select count(*)::int n from public.demandas where assunto like 'Tentativa%'"))[0].n === 0, 'ação do servidor (criar demanda) de um aparelho revogado com a página ainda aberta: nada é gravado');
  const navegou = /\/acesso/.test(C.pg.url()) || /terminou|não está mais autorizado|Abra de novo/.test(await C.pg.textContent('body'));
  ok(navegou, `a pessoa é avisada ou levada à autorização (${caminho(C.pg)})`);
  const rascunhos = await C.pg.evaluate(() => localStorage.getItem('dmanda:rascunhos') ?? '');
  ok(/Tentativa de gravar/.test(rascunhos) || /Tentativa de gravar/.test(await C.pg.evaluate(() => JSON.stringify(Object.entries(localStorage)))), 'o que foi digitado fica guardado como rascunho no aparelho (nada se perde)');
  await C.ctx.close();
}

// =============================================================================================================================================
// 6) recuperação do titular: todos os aparelhos revogados, um convite do terminal autoriza de novo; os antigos seguem fora
// =============================================================================================================================================
let D;
{
  const antes = await aparelhosNoBanco();
  ok(antes.length >= 3 && antes.every((x) => x.revogado), 'depois de revogar todos, nenhum aparelho está autorizado');
  ok((await pedir('/demandas', await cookieDe(A.ctx))).status === 307, 'o primeiro aparelho também perdeu o acesso');
  D = await entrarComCodigo('celular', { motor: wk ?? edge, tema: 'escuro', texto: 125 });
  await ir(D.pg, '/demandas'); await painel(D.pg);
  ok(/Demanda fictícia do titular/.test((await D.pg.textContent('#vista')) ?? ''), 'recuperação: o convite do terminal autoriza o aparelho novo e os dados do titular estão intactos');
  ok((await pedir('/demandas', await cookieDe(A.ctx))).status === 307, 'e os aparelhos revogados continuam fora');
}

// =============================================================================================================================================
// 7) validade: aparelho vencido perde o acesso; o uso renova; falha transitória não apaga nem libera
// =============================================================================================================================================
{
  const cookieD = await cookieDe(D.ctx);
  await db.query("update dmanda_privado.aparelhos set expira_em = now() + interval '3 days', ultimo_uso = now() - interval '3 hours' where revogado_em is null");
  await pedir('/demandas', cookieD);
  ok((await sqlq("select expira_em > now() + interval '89 days' as renovou from dmanda_privado.aparelhos where revogado_em is null"))[0].renovou, 'validade: usar o aparelho depois de mais de uma hora renova os 90 dias');
  // falha transitória da função de estado: nada é liberado e nada é apagado
  falso.estado.falhas.set('estado_aparelho', 'cai');
  const t = await pedir('/demandas', cookieD);
  ok(t.status === 503 && /Não foi possível confirmar sua sessão/.test(await t.text()), 'falha do banco ao conferir o aparelho: a página diz "tente de novo" (503) e não libera o acesso');
  await ir(D.pg, '/demandas');
  ok((await nCookiesSessao(D.ctx)) >= 1, 'e a sessão do aparelho não é apagada por causa da falha');
  falso.estado.falhas.delete('estado_aparelho');
  await ir(D.pg, '/demandas'); await painel(D.pg);
  ok(caminho(D.pg) === '/demandas', 'passada a falha, o aparelho abre direto de novo, com a mesma sessão');
  falso.estado.falhas.set('auth', '500');
  const t2 = await pedir('/demandas', cookieD);
  ok(t2.status === 503, 'falha do Auth ao confirmar a sessão: também 503, sem liberar nem apagar');
  falso.estado.falhas.delete('auth');
  // vencimento
  await db.query("update dmanda_privado.aparelhos set expira_em = now() - interval '1 minute' where revogado_em is null");
  const v = await pedir('/demandas', cookieD);
  ok(v.status === 307 && /revogado=1/.test(v.headers.get('location') ?? '') && (await pedir('/api/exportar', cookieD)).status === 307, 'validade: passados os 90 dias sem uso o aparelho perde o acesso (página e exportação)');
  await ir(D.pg, '/demandas');
  ultimo = caminho(D.pg);
  ok(/^\/acesso\?(revogado|encerrada)=1$/.test(caminho(D.pg)), 'e a tela leva ao acesso por código (revogado, ou encerrada se a sessão já foi encerrada no Auth pela primeira conferência)');
}

// =============================================================================================================================================
// 8) Sair e revogar o próprio aparelho tiram a autorização
// =============================================================================================================================================
{
  const E = await entrarComCodigo('desktop');
  await E.pg.click('.perfil-b').catch(() => {}); await E.pg.waitForSelector('.mv-menu', { timeout: 15000 });
  await E.pg.click('.mv-menu button:has-text("Sair")'); await E.pg.waitForURL((u) => /\/acesso/.test(u), { timeout: 60000 });
  ok(/saiu=1/.test(E.pg.url()) && (await nCookiesSessao(E.ctx)) === 0 && (await sqlq('select count(*)::int n from dmanda_privado.aparelhos where revogado_em is null and expira_em > now()'))[0].n === 0, 'Sair encerra a sessão e também tira a autorização do aparelho (para voltar, um código novo)');
  await E.ctx.close();
  const F = await entrarComCodigo('desktop');
  await ir(F.pg, '/config'); await painel(F.pg); await F.pg.waitForSelector('[data-aparelho][data-atual]');
  await F.pg.locator('[data-aparelho][data-atual] button:has-text("Revogar")').click(); await F.pg.locator('[data-confirmar-revogar]').click();
  await F.pg.waitForURL((u) => /\/acesso/.test(u), { timeout: 60000 });
  ok(/saiu=1/.test(F.pg.url()) && (await nCookiesSessao(F.ctx)) === 0, 'revogar o próprio aparelho na lista também leva à tela de acesso, com a sessão encerrada');
  await F.ctx.close();
}

// =============================================================================================================================================
// 9) a tela renderizada: Claro e Escuro, computador e iPhone, texto a 125%, Edge e WebKit emulado
// =============================================================================================================================================
for (const [rot, perfil, tema, texto, motor] of [['computador Claro', 'desktop', 'claro', 100, edge], ['computador Escuro', 'desktop', 'escuro', 100, edge], ['iPhone Claro', 'celular', 'claro', 100, edge], ['iPhone Escuro 125%', 'celular', 'escuro', 125, edge], ...(wk ? [['WebKit emulado iPhone Claro', 'celular', 'claro', 100, wk], ['WebKit emulado iPhone Escuro', 'celular', 'escuro', 100, wk]] : [])]) {
  const c = await novo(perfil, { motor, tema, texto });
  await ir(c.pg, '/acesso'); await c.pg.waitForSelector('#acesso-codigo', { timeout: 120000 }); await esperar(500);
  const m = await c.pg.evaluate(() => {
    const vw = document.documentElement.clientWidth, caixa = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height, fonte: parseFloat(getComputedStyle(e).fontSize), cor: getComputedStyle(e).color, fundo: getComputedStyle(e).backgroundColor }; };
    return { vw, rolagem: document.documentElement.scrollWidth <= vw + 1, campo: caixa('#acesso-codigo'), botao: caixa('.login-form button'), como: caixa('[data-como-obter]'), titulo: caixa('.login-caixa h1') };
  });
  const dentro = (b) => b && b.l >= -1 && b.r <= m.vw + 1;
  ok(m.rolagem && dentro(m.campo) && dentro(m.botao) && dentro(m.como) && m.campo.h >= 40 && m.botao.h >= 40 && m.campo.fonte >= (perfil === 'celular' ? 16 : 13.6) * 0.99, `${rot}: a tela de acesso cabe em ${m.vw} px sem rolagem lateral, campo e botão com alvo de toque (${Math.round(m.campo?.h)} e ${Math.round(m.botao?.h)} px) e campo de ${m.campo?.fonte.toFixed(1)} px`);
  await c.pg.screenshot({ path: `${CAPTURAS}/acesso-${rot.replace(/\s+/g, '-')}.png`, fullPage: true });
  await c.pg.fill('#acesso-codigo', 'ZZZZ9999'); await c.pg.click('.login-form button[type=submit]'); await c.pg.waitForSelector('.login-form [role=alert]', { timeout: 30000 });
  const av = await c.pg.$eval('.login-form [role=alert]', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, cor: getComputedStyle(e).color }; });
  ok(av.l >= -1 && av.r <= m.vw + 1, `${rot}: o aviso de código inválido fica visível e inteiro (${av.cor})`);
  await c.ctx.close();
}
{
  // Configurações > Aparelhos no iPhone, Escuro: lista e código cabem na tela
  const c = await entrarComCodigo('celular', { tema: 'escuro', texto: 125 });
  await ir(c.pg, '/config'); await painel(c.pg); await c.pg.waitForSelector('[data-aparelhos] [data-aparelho]');
  await c.pg.click('[data-gerar-convite]'); await c.pg.waitForSelector('[data-codigo-convite]'); await esperar(300);
  await c.pg.locator('[data-aparelhos]').scrollIntoViewIfNeeded();
  const m = await c.pg.evaluate(() => { const vw = document.documentElement.clientWidth, s = document.querySelector('[data-aparelhos]').getBoundingClientRect(), cod = document.querySelector('[data-codigo-convite] .mono').getBoundingClientRect(); return { vw, rolagem: document.documentElement.scrollWidth <= vw + 1, secao: s.right <= vw + 1 && s.left >= -1, codigo: cod.right <= vw + 1 }; });
  ok(m.rolagem && m.secao && m.codigo, 'Configurações, Aparelhos no iPhone Escuro com texto a 125%: a seção e o código cabem na largura, sem rolagem lateral');
  await c.pg.locator('[data-aparelhos]').screenshot({ path: `${CAPTURAS}/config-aparelhos-iphone-escuro.png` });
  await c.ctx.close();
}

parar();
await wk?.close(); await edge.close();
await esperar(1500);
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
