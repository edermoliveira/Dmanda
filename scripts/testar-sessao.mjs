// Teste de integração da sessão em ambiente ISOLADO: a aplicação real (proxy, ação "Sair", entrada por senha) roda contra um servidor de Auth FALSO local
// (127.0.0.1), nunca contra o Supabase real. O app não ganha nenhum atalho: o servidor falso só devolve um usuário para um cookie de sessão fabricado.
// Política de sessão (decisão 27): a sessão PERSISTE. Não existe mais encerramento por inatividade (a regra antiga das 6 horas foi removida e este teste a substitui de
// forma explícita). O token de acesso é renovado pelo token de renovação (o Auth falso rotaciona e recusa token já usado, como o real); a sessão só termina na saída
// explícita (escopo local, preservando as outras), na revogação ou invalidação pelo Auth, ou se a conta não for a autorizada. Falha de rede ao conferir a sessão nunca
// a apaga e nunca libera o acesso. Cobre também: provedores aceitos, entrada por senha pelo formulário, o botão Sair e o script definir:senha.
// NÃO valida o Google real, a senha real nem o Supabase real. Uso: node scripts/testar-sessao.mjs
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORTA = process.env.PORTA_SESSAO || '7104', PORTA_AUTH = 7105, BASE = `http://localhost:${PORTA}`;
const EMAIL = 'conta-de-teste@exemplo.invalid', ID = '00000000-0000-4000-8000-0000000000aa', HORA = 60 * 60 * 1000;
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };

// ---- servidor de Auth falso ----
let atual = null, logoutFalha = false, provedorSenha = 'google';
let modoAuth = 'normal'; // 'normal' | 'cai' (derruba a conexão) | '500' (erro do servidor de Auth)
const SENHA = 'senha-de-teste-nao-real-123', EMAIL_FORA = 'fora-da-lista@exemplo.invalid', EMAIL_LIMITE = 'limite@exemplo.invalid';
const chamadas = [];
const revogadas = new Set();      // sessões encerradas (por Sair local ou revogação)
const rotacao = new Map();        // sessão -> número do token de renovação válido; um número menor já foi usado
let usuariosAdmin = [], putsAdmin = [];
const lerCorpo = (req) => new Promise((r) => { let t = ''; req.on('data', (c) => { t += c; }); req.on('end', () => { try { r(JSON.parse(t || '{}')); } catch { r({}); } }); });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwtFalso = (sid, exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ID, role: 'authenticated', session_id: sid, exp })}.assinatura`;
const sidDoBearer = (req) => { try { return JSON.parse(Buffer.from(String(req.headers.authorization ?? '').replace(/^Bearer /, '').split('.')[1], 'base64url').toString()).session_id; } catch { return null; } };
const usuario = (email, provedor = 'google') => ({ id: ID, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: provedor, providers: [provedor] }, user_metadata: { full_name: 'Conta de Teste' }, created_at: '2026-01-01T00:00:00Z' });
// CORS aberto no Auth falso: o formulário de senha fala com o Auth direto do navegador (como o Supabase real permite), de outra origem
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
const json = (res, status, corpo) => { res.writeHead(status, { 'content-type': 'application/json', ...CORS }); res.end(corpo === undefined ? '' : JSON.stringify(corpo)); };
const sessaoJson = (sid, n) => { const agora = Math.floor(Date.now() / 1000); return { access_token: jwtFalso(sid, agora + 3600), token_type: 'bearer', expires_in: 3600, expires_at: agora + 3600, refresh_token: `rt:${sid}:${n}`, user: atual }; };
const auth = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  chamadas.push(`${req.method} ${u.pathname}${u.search}`);
  if (u.pathname === '/auth/v1/admin/users' && req.method === 'GET') return json(res, 200, { users: usuariosAdmin, aud: 'authenticated' });
  if (/^\/auth\/v1\/admin\/users\/[\w-]+$/.test(u.pathname) && req.method === 'PUT') { const c = await lerCorpo(req); putsAdmin.push(c); return json(res, 200, { ...usuariosAdmin[0], updated_at: new Date().toISOString() }); }
  if (modoAuth === 'cai' && !u.pathname.startsWith('/rest/')) { req.socket.destroy(); return; }
  if (modoAuth === '500' && !u.pathname.startsWith('/rest/')) return json(res, 500, { code: 500, msg: 'falha proposital do Auth' });
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
    const c = await lerCorpo(req), email = String(c.email ?? '').toLowerCase();
    if (email === EMAIL_LIMITE) return json(res, 429, { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' });
    if (c.password !== SENHA || (email !== EMAIL && email !== EMAIL_FORA)) return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    atual = usuario(email, provedorSenha);
    const sid = 'login' + Date.now(); rotacao.set(sid, 0);
    return json(res, 200, sessaoJson(sid, 0));
  }
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') {
    const c = await lerCorpo(req), [, sid, n] = /^rt:(.+):(\d+)$/.exec(String(c.refresh_token ?? '')) ?? [];
    if (!sid || revogadas.has(sid)) return json(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
    const vigente = rotacao.get(sid) ?? 0;
    if (Number(n) < vigente) return json(res, 400, { code: 400, error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' });
    rotacao.set(sid, vigente + 1);
    return json(res, 200, sessaoJson(sid, vigente + 1));
  }
  if (u.pathname === '/auth/v1/user') {
    const sid = sidDoBearer(req);
    if (sid && revogadas.has(sid)) return json(res, 403, { code: 403, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' });
    return json(res, 200, atual);
  }
  if (u.pathname === '/auth/v1/logout') {
    if (logoutFalha) return json(res, 500, { code: 500, msg: 'falha proposital' });
    const sid = sidDoBearer(req);
    if (u.searchParams.get('scope') === 'local' && sid) revogadas.add(sid);
    else if (u.searchParams.get('scope') === 'global' || u.searchParams.get('scope') === 'others') revogadas.add('TUDO');
    res.writeHead(204, CORS); return res.end();
  }
  if (u.pathname === '/rest/v1/rpc/listar_demandas' || u.pathname === '/rest/v1/rpc/listar_dias_indisponiveis') return json(res, 200, []);
  if (u.pathname === '/rest/v1/rpc/estado_rotina') return json(res, 200, { ultima_ok: null, ultima_falha: null, resumo_data: null, resumo_calculado_em: null });
  return json(res, 404, {});
});
await new Promise((r) => auth.listen(PORTA_AUTH, '127.0.0.1', r));

// ---- aplicação real (modo real, apontada para o Auth falso) ----
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTA_AUTH}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_falsa_para_teste', DMANDA_EMAIL_AUTORIZADO: EMAIL, SUPABASE_SERVICE_ROLE_KEY: '', CRON_SECRET: 'segredo-de-teste-1234567890', DMANDA_BANCO: '', DMANDA_LOGIN_GOOGLE: '' };
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } auth.close(); };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login', { redirect: 'manual' }); if (r.status < 500) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

// ---- cookies fabricados (formato do @supabase/ssr) ----
// sid: identifica a sessão (um aparelho); n: número do token de renovação; expiraEm: segundos até o token de acesso vencer (negativo = já venceu)
const sessaoSb = ({ sid = 's1', n = 0, expiraEm = 3600 } = {}) => {
  const agora = Math.floor(Date.now() / 1000);
  if (!rotacao.has(sid)) rotacao.set(sid, 0);
  return 'base64-' + Buffer.from(JSON.stringify({ access_token: jwtFalso(sid, agora + expiraEm), token_type: 'bearer', expires_in: 3600, expires_at: agora + expiraEm, refresh_token: `rt:${sid}:${n}`, user: atual })).toString('base64url');
};
const cookieHeader = (o, extra = '') => `sb-127-auth-token=${sessaoSb(o)}${extra}`;
const pedir = async (cookie, rota = '/demandas') => fetch(BASE + rota, { redirect: 'manual', headers: cookie ? { cookie } : {} });
const local = (r) => (r.headers.get('location') ?? '').replace(BASE, '');
const setCookies = (r) => r.headers.getSetCookie();
const apagado = (lista, nome) => lista.some((c) => c.startsWith(nome + '=') && /max-age=0|expires=thu, 01 jan 1970/i.test(c));
const gravado = (lista, nome) => lista.find((c) => c.startsWith(nome + '=') && !/max-age=0|expires=thu, 01 jan 1970/i.test(c));
const valorDoCookie = (c) => c.split(';')[0].slice(c.indexOf('=') + 1);
const contar = (re) => chamadas.filter((c) => re.test(c)).length;
const renovacoes = () => contar(/grant_type=refresh_token/);

// ---- script "definir:senha" (API de administração, contra o Auth FALSO) ----
{
  const rodarScript = (senha, extraEnv = {}) => new Promise((resolver) => {
    // assíncrono de propósito: o Auth falso roda neste mesmo processo e precisa responder enquanto o script espera
    const f = spawn(process.execPath, ['scripts/definir-senha.mjs'], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTA_AUTH}`, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_falsa_para_teste', DMANDA_EMAIL_AUTORIZADO: EMAIL, ...extraEnv } });
    let stdout = '', stderr = '';
    f.stdout.on('data', (c) => { stdout += c; }); f.stderr.on('data', (c) => { stderr += c; });
    f.on('close', (status) => resolver({ status, stdout, stderr }));
    f.stdin.end(senha + String.fromCharCode(10));
  });
  const senhaNova = 'frase-longa-de-teste-nao-real-456';
  usuariosAdmin = [usuario(EMAIL)]; putsAdmin = [];
  let x = await rodarScript(senhaNova);
  ok(x.status === 0 && /Senha definida para o usuário existente/.test(x.stdout) && putsAdmin.length === 1, 'definir:senha: com um único usuário (o autorizado) define a senha e confirma');
  ok(putsAdmin[0]?.password === senhaNova && putsAdmin[0]?.email_confirm === true && !('email' in putsAdmin[0]) && !('app_metadata' in putsAdmin[0]), 'definir:senha: envia só a senha e a confirmação do e-mail (não troca e-mail nem metadados; o usuário e o identificador são os mesmos)');
  ok(!(x.stdout + x.stderr).includes(senhaNova) && !(x.stdout + x.stderr).includes('sb_secret_falsa'), 'definir:senha: nem a senha nem a chave aparecem na saída');
  putsAdmin = []; x = await rodarScript('curta');
  ok(x.status === 1 && /pelo menos 12/.test(x.stderr) && putsAdmin.length === 0, 'definir:senha: senha curta é recusada antes de falar com o Supabase');
  usuariosAdmin = [usuario(EMAIL), { ...usuario('outro@exemplo.invalid'), id: '00000000-0000-4000-8000-0000000000bb' }]; putsAdmin = [];
  x = await rodarScript(senhaNova);
  ok(x.status === 1 && /exatamente 1 usuário/.test(x.stderr) && putsAdmin.length === 0, 'definir:senha: se o projeto tiver mais de um usuário, não altera nada');
  usuariosAdmin = [usuario('outro@exemplo.invalid')]; putsAdmin = [];
  x = await rodarScript(senhaNova);
  ok(x.status === 1 && putsAdmin.length === 0, 'definir:senha: se o único usuário não é o autorizado, não altera nada');
  x = await rodarScript(senhaNova, { SUPABASE_SERVICE_ROLE_KEY: '' });
  ok(x.status === 2 && /Faltam variáveis/.test(x.stderr), 'definir:senha: sem a chave de serviço no ambiente, avisa quais variáveis faltam (só os nomes)');
  usuariosAdmin = [];
}


// 1) sem sessão
atual = usuario(EMAIL);
let r = await pedir(null);
ok(r.status === 307 && local(r) === '/login', 'sem sessão: /demandas redireciona ao login (primeira visita, sem aviso de sessão encerrada)');

// 2) a sessão persiste: sem carimbo de último uso, com carimbo antigo, adulterado ou no futuro, a sessão válida continua entrando (a regra das 6 horas foi removida)
chamadas.length = 0;
r = await pedir(cookieHeader({ sid: 'persiste' }));
ok(r.status === 200, 'sessão válida sem nenhum cookie de último uso (nunca existiu, foi apagado ou o navegador o descartou): entra normalmente');
for (const [rotulo, valor] of [['de 7 horas atrás', Date.now() - 7 * HORA], ['de 30 dias atrás', Date.now() - 30 * 24 * HORA], ['ilegível', 'lixo'], ['no futuro', Date.now() + 30 * 24 * HORA]]) {
  r = await pedir(cookieHeader({ sid: 'persiste' }, `; dmanda-ultimo-uso=${valor}`));
  ok(r.status === 200 && apagado(setCookies(r), 'dmanda-ultimo-uso'), `sessão válida com o carimbo antigo ${rotulo}: continua entrando, e o carimbo antigo é apenas apagado do navegador`);
}
ok(!chamadas.some((c) => /logout/.test(c)), 'nenhuma dessas entradas encerrou a sessão no Auth (nada de logout por "inatividade")');
r = await pedir(cookieHeader({ sid: 'persiste' }), '/login');
ok(r.status === 307 && local(r) === '/', 'login com sessão válida (mesmo sem carimbo): vai ao Início');
r = await pedir(cookieHeader({ sid: 'persiste' }), '/api/sessao');
ok(r.status === 204, 'sonda /api/sessao com sessão válida: 204 sem corpo');
r = await pedir(null, '/api/sessao');
ok(r.status === 307 && local(r) === '/login', 'sonda /api/sessao sem sessão: redireciona ao login (é o sinal de "sessão encerrada" para a tela)');

// 3) renovação do token de acesso vencido: o servidor renova uma vez, grava os cookies novos e a sessão segue; o token de renovação gasto não é reaproveitado
chamadas.length = 0;
r = await pedir(cookieHeader({ sid: 'renova', expiraEm: -3600, n: 0 }));
const novo = gravado(setCookies(r), 'sb-127-auth-token');
ok(r.status === 200 && !!novo && renovacoes() === 1, 'token de acesso vencido: o proxy renova pelo token de renovação (1 chamada) e devolve a sessão nova nos cookies');
const cookiesNovos = novo ? valorDoCookie(novo) : '';
ok(/Max-Age=\d{7,}/i.test(novo ?? '') || /Expires=/i.test(novo ?? ''), 'a sessão renovada volta com validade longa (cookie persistente, não de sessão do navegador)');
chamadas.length = 0;
r = await pedir(`sb-127-auth-token=${cookiesNovos}`);
ok(r.status === 200 && renovacoes() === 0 && !gravado(setCookies(r), 'sb-127-auth-token'), 'com a sessão renovada o próximo pedido não renova de novo');
// renovação visível à renderização da mesma requisição: a rota de exportação lê a sessão de novo no servidor e NÃO pode renovar outra vez
chamadas.length = 0;
r = await pedir(cookieHeader({ sid: 'renova2', expiraEm: -3600, n: 0 }), '/api/exportar');
ok(r.status === 200 && renovacoes() === 1, 'a renovação feita no proxy chega à rota do servidor na mesma requisição: uma única renovação, não duas (renovar duas vezes gastaria o token e revogaria a sessão)');
// redirecionamento depois de renovar também leva os cookies novos
chamadas.length = 0;
r = await pedir(cookieHeader({ sid: 'renova3', expiraEm: -3600, n: 0 }), '/login');
ok(r.status === 307 && local(r) === '/' && !!gravado(setCookies(r), 'sb-127-auth-token') && renovacoes() === 1, 'redirecionamento logo após renovar também entrega os cookies renovados (senão o token gasto se perderia)');
// token de renovação já usado e fora da janela: o Auth recusa; sessão inválida vai ao login com o aviso de sessão encerrada e cookies limpos
chamadas.length = 0;
rotacao.set('velha', 5);
r = await pedir(cookieHeader({ sid: 'velha', expiraEm: -3600, n: 1 }));
ok(r.status === 307 && local(r) === '/login?encerrada=1' && apagado(setCookies(r), 'sb-127-auth-token'), 'token de renovação inválido ou já usado: vai ao login com o aviso de sessão encerrada e limpa os cookies');

// 4) sessão revogada no Auth (por exemplo, saída em outro aparelho com escopo global, ou revogação no painel)
revogadas.add('revogada'); chamadas.length = 0;
r = await pedir(cookieHeader({ sid: 'revogada' }));
ok(r.status === 307 && local(r) === '/login?encerrada=1', 'sessão revogada pelo Auth: vai ao login com o aviso de sessão encerrada');
ok(apagado(setCookies(r), 'sb-127-auth-token'), 'sessão revogada: os cookies de sessão deste navegador são limpos');

// 5) falha de rede ou do Auth ao conferir: a sessão NÃO é apagada e o acesso NÃO é liberado
for (const [modo, rotulo] of [['500', 'erro do servidor de Auth (500)'], ['cai', 'conexão derrubada']]) {
  modoAuth = modo; chamadas.length = 0;
  r = await pedir(cookieHeader({ sid: 'rede' }));
  const corpo = await r.text();
  ok(r.status === 503 && /Tentar de novo/.test(corpo) && /sess[ãa]o foi mantida/.test(corpo) && !/<main[^>]*class="app/.test(corpo), `${rotulo}: a página mostra "tente de novo" (503), sem liberar o painel`);
  ok(!apagado(setCookies(r), 'sb-127-auth-token') && !gravado(setCookies(r), 'sb-127-auth-token') && !chamadas.some((c) => /logout/.test(c)), `${rotulo}: nenhum cookie de sessão é apagado nem trocado e não há logout`);
  r = await pedir(cookieHeader({ sid: 'rede' }), '/login');
  ok(r.status === 200, `${rotulo}: a tela de login continua abrindo`);
  r = await pedir(cookieHeader({ sid: 'rede', expiraEm: -3600 }));
  ok(r.status === 503 && !apagado(setCookies(r), 'sb-127-auth-token'), `${rotulo} com o token de acesso vencido: também 503, sem apagar a sessão recuperável`);
}
modoAuth = 'normal';
r = await pedir(cookieHeader({ sid: 'rede' }));
ok(r.status === 200, 'passada a falha, a mesma sessão volta a entrar (nada foi perdido)');

// 6) Sair é local: encerra só a sessão deste aparelho e preserva as outras
atual = usuario(EMAIL); revogadas.delete('TUDO');
chamadas.length = 0;
const aparelhoA = { sid: 'aparelho-a' }, aparelhoB = { sid: 'aparelho-b' };
ok((await pedir(cookieHeader(aparelhoA))).status === 200 && (await pedir(cookieHeader(aparelhoB))).status === 200, 'dois aparelhos com sessões diferentes entram');
// conta fora da lista e provedor diferente de Google e e-mail e senha
atual = usuario('outra-conta@exemplo.invalid'); chamadas.length = 0;
r = await pedir(cookieHeader({ sid: 'fora' }));
ok(r.status === 307 && local(r) === '/login?negado=1' && chamadas.includes('POST /auth/v1/logout?scope=local'), 'conta fora da lista com sessão válida: negada e a sessão é encerrada (escopo local)');
atual = usuario(EMAIL, 'github');
r = await pedir(cookieHeader({ sid: 'fora2' }));
ok(r.status === 307 && local(r) === '/login?negado=1', 'e-mail certo mas provedor fora de Google e e-mail e senha: negado');
atual = usuario(EMAIL, 'email');
r = await pedir(cookieHeader({ sid: 'email1' }));
ok(r.status === 200, 'e-mail certo entrando por e-mail e senha: passa');
atual = usuario(EMAIL);

// páginas antigas de desenvolvimento e a página /marca não ficam abertas sem login
for (const rota of ['/marca', '/pecas', '/tokens']) { r = await pedir(null, rota); ok(r.status === 307 && local(r) === '/login', `sem login, ${rota} redireciona ao login`); }
r = await pedir(null, '/marca/icone-app.svg');
ok(r.status === 200, 'os arquivos estáticos da marca (SVG, PNG, manifesto) continuam públicos para o login e a instalação');

// ---- entrada por e-mail e senha, no navegador ----
{
  const nav0 = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
  const c0 = await nav0.newContext({ viewport: { width: 1100, height: 800 } });
  const p0 = await c0.newPage();
  const abrirLogin = async () => { await p0.goto(BASE + '/login', { waitUntil: 'load', timeout: 120000 }); await p0.waitForSelector('#login-email', { timeout: 60000 }); };
  const entrar = async (email, senha) => { await p0.fill('#login-email', email); await p0.fill('#login-senha', senha); await p0.click('.login-form button[type=submit]'); };
  const nomesCookies = async () => (await c0.cookies()).filter((c) => c.value).map((c) => c.name);
  const avisoLogin = () => p0.evaluate(() => document.querySelector('.login-form .login-aviso')?.textContent ?? '');
  atual = null; chamadas.length = 0;
  await abrirLogin();
  ok(await p0.isVisible('#login-senha') && !(await p0.textContent('.login-caixa')).includes('Google') && (await p0.locator('.login-ou').count()) === 0, 'login: com a variável do Google ausente aparece só o formulário de e-mail e senha (sem botão do Google nem o "ou")');
  // senha errada
  await entrar(EMAIL, 'senha-errada-qualquer');
  await p0.waitForFunction(() => document.querySelector('.login-form .login-aviso')?.textContent === 'E-mail ou senha incorretos.', null, { timeout: 60000 });
  ok(new URL(p0.url()).pathname === '/login', 'login: senha errada mostra mensagem genérica e continua no login');
  ok((await p0.inputValue('#login-email')) === EMAIL && (await p0.inputValue('#login-senha')) === '', 'login: após erro o e-mail digitado é mantido e a senha não volta para a tela');
  ok((await nomesCookies()).length === 0, 'login: senha errada não cria nenhum cookie de sessão');
  // conta fora da lista, mesmo com senha correta para o Auth falso
  chamadas.length = 0;
  await entrar(EMAIL_FORA, SENHA);
  await p0.waitForFunction(() => document.querySelector('.login-form .login-aviso')?.textContent === 'E-mail ou senha incorretos.' && document.querySelector('#login-senha')?.value === '', null, { timeout: 60000 });
  await p0.waitForTimeout(300);
  ok(new URL(p0.url()).pathname === '/login' && (await nomesCookies()).length === 0 && chamadas.includes('POST /auth/v1/logout?scope=local'), 'login: conta fora da lista é recusada com a mesma mensagem, sem cookies, e a sessão criada é encerrada (escopo local)');
  // provedor não aceito
  provedorSenha = 'github'; await entrar(EMAIL, SENHA);
  await p0.waitForTimeout(1500);
  ok((await avisoLogin()) === 'E-mail ou senha incorretos.' && (await nomesCookies()).length === 0, 'login: e-mail certo por provedor não aceito (GitHub) é recusado e não deixa cookies');
  // limite de tentativas do Auth
  await entrar(EMAIL_LIMITE, SENHA);
  await p0.waitForFunction(() => /Muitas tentativas/.test(document.querySelector('.login-form .login-aviso')?.textContent ?? ''), null, { timeout: 60000 });
  ok(true, 'login: limite de tentativas do Auth vira aviso claro');
  // entrada correta (usuário criado pelo Google, que ganhou senha: provider continua google); o servidor regrava a sessão por Set-Cookie
  provedorSenha = 'google';
  const acoes = [];
  p0.on('response', async (resp) => { if (resp.request().method() === 'POST' && resp.request().headers()['next-action']) acoes.push(String((await resp.allHeaders().catch(() => ({})))['set-cookie'] ?? '').split(String.fromCharCode(10))); });
  await Promise.all([p0.waitForURL((u) => u.pathname === '/', { timeout: 120000 }), entrar(EMAIL, SENHA)]);
  await p0.waitForSelector('.app .main', { timeout: 120000 });
  const ck = await c0.cookies();
  const sessaoCk = ck.find((c) => c.name.startsWith('sb-') && c.value);
  ok(!!sessaoCk && !ck.some((c) => c.name === 'dmanda-ultimo-uso'), 'login: entrada correta cria a sessão e abre o Início, sem criar o carimbo de último uso (a regra das 6 horas não existe mais)');
  ok(acoes.flat().some((c) => /^sb-127-auth-token/.test(c) && /Max-Age=\d{7,}/i.test(c)), 'login: o servidor regrava a sessão por Set-Cookie com validade longa (cookies escritos só por script têm validade limitada no Safari do iPhone)');
  ok(!!sessaoCk && (sessaoCk.expires === -1 || sessaoCk.expires * 1000 - Date.now() > 300 * 24 * HORA), 'login: o cookie da sessão é persistente (vale por mais de 300 dias), não de sessão do navegador');
  ok(!(await p0.content()).includes(SENHA), 'login: a senha não aparece na página depois da entrada');
  // fechar e reabrir o navegador mantém a sessão: novo contexto com os mesmos cookies (como o iPhone reabrindo a PWA depois de horas)
  const guardados = await c0.cookies();
  const c0b = await nav0.newContext({ viewport: { width: 1100, height: 800 } });
  await c0b.addCookies(guardados.map(({ name, value, domain, path, expires }) => ({ name, value, domain, path, expires })));
  const p0b = await c0b.newPage();
  await p0b.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 120000 });
  await p0b.waitForSelector('.app .main', { timeout: 120000 });
  ok(new URL(p0b.url()).pathname === '/demandas', 'reabrir o aplicativo com os mesmos cookies (como reabrir a PWA depois de horas parada): entra direto, sem pedir login');
  await c0b.close();
  // provedor e-mail também entra
  // sai da página do painel antes de limpar os cookies, para respostas atrasadas dela não recriarem a sessão no meio do teste
  await p0.goto('about:blank'); await c0.clearCookies(); provedorSenha = 'email';
  await abrirLogin();
  await entrar(EMAIL, SENHA);
  const entrouEmail = await p0.waitForURL((u) => u.pathname === '/', { timeout: 60000 }).then(() => true, () => false);
  ok(entrouEmail, 'login: usuário com provedor "email" também entra pela senha' + (entrouEmail ? '' : ' (aviso na tela: ' + (await avisoLogin()) + '; Auth: ' + chamadas.slice(-6).join(' | ') + ')'));
  // tela de login velha: abre sem sessão, outra aba entra (cookies válidos aparecem) e o formulário é enviado: o servidor redireciona a ação e o cliente cai no painel
  await p0.goto('about:blank'); await c0.clearCookies(); provedorSenha = 'google';
  await abrirLogin();
  await c0.addCookies([{ name: 'sb-127-auth-token', value: sessaoSb({ sid: 'outra-aba' }), domain: 'localhost', path: '/' }]);
  await entrar(EMAIL, SENHA);
  const velha = await p0.waitForURL((u) => u.pathname === '/', { timeout: 60000 }).then(() => true, () => false);
  ok(velha, 'login: tela de login velha, com outra aba já logada, termina no painel (sem mensagem de erro falsa)');
  await nav0.close();
}

// ---- falha ao gravar: sem internet, Auth indisponível e sessão revogada no meio do uso (a tela nunca mostra sucesso e o texto digitado não se perde) ----
{
  atual = usuario(EMAIL);
  const nav1 = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
  const c1 = await nav1.newContext({ viewport: { width: 1100, height: 800 } });
  await c1.addCookies([{ name: 'sb-127-auth-token', value: sessaoSb({ sid: 'meio-do-uso' }), domain: 'localhost', path: '/' }]);
  const p1 = await c1.newPage();
  await p1.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 120000 });
  await p1.waitForSelector('.app .main', { timeout: 120000 });
  await p1.waitForFunction(() => !document.body.innerText.includes('Carregando as demandas'), null, { timeout: 60000 });
  await p1.click('button[aria-label="Nova demanda"]');
  await p1.waitForSelector('#n-assunto');
  await p1.fill('#n-assunto', 'Texto que não pode se perder');
  await p1.click('.modal .btn.pri'); // Próximo (passo 1 para o 2)
  await p1.waitForSelector('#n-chegou');
  const salvar = async () => { await p1.click('.modal .btn.pri'); };
  // 1) sem internet
  await c1.setOffline(true);
  await p1.waitForSelector('.faixa-offline', { timeout: 10000 }).catch(() => {});
  const faixa = await p1.isVisible('.faixa-offline');
  await salvar();
  await p1.waitForSelector('#toast.on.erro', { timeout: 30000 });
  const toast = await p1.textContent('#toast');
  ok(faixa, 'sem internet: a faixa "Sem conexão" aparece no painel');
  ok(/Sem conexão/.test(toast ?? '') && /Nada foi gravado/.test(toast ?? ''), 'sem internet: gravar mostra erro claro ("Nada foi gravado"), nunca sucesso');
  ok(await p1.isEnabled('.modal .btn.pri'), 'sem internet: o botão volta a funcionar (não fica travado) e o texto digitado continua na janela');
  await c1.setOffline(false);
  await p1.waitForFunction(() => !document.querySelector('.faixa-offline'), null, { timeout: 10000 });
  ok(true, 'ao voltar a conexão, a faixa de "Sem conexão" some');
  // 2) o servidor de Auth fica indisponível no meio do uso: erro de conexão, a sessão não é encerrada e continua na tela
  modoAuth = '500';
  await p1.waitForSelector('#toast:not(.on)', { timeout: 15000 }).catch(() => {});
  await salvar();
  await p1.waitForSelector('#toast.on.erro', { timeout: 30000 });
  const toastAuth = await p1.textContent('#toast');
  ok(!/salvas|cadastrada|criada/i.test(toastAuth ?? '') && new URL(p1.url()).pathname === '/demandas' && !!(await p1.$('.modal')), 'Auth indisponível no meio do uso: erro à vista, sem sucesso falso, sem sair do painel e com a janela e o texto intactos');
  modoAuth = 'normal';
  // 3) sessão revogada no meio do uso: a gravação leva ao login com o aviso de sessão encerrada e o texto digitado fica como rascunho
  revogadas.add('meio-do-uso');
  await p1.waitForSelector('#toast:not(.on)', { timeout: 15000 }).catch(() => {});
  await salvar();
  const foiAoLogin = await p1.waitForURL(/\/login\?encerrada=1/, { timeout: 30000 }).then(() => true, () => false);
  ok(foiAoLogin, 'sessão revogada no meio do uso: gravar leva ao login com o aviso de sessão encerrada (sem sucesso de mentira)');
  const rascunho = await p1.evaluate(() => localStorage.getItem('dmanda:rascunhos'));
  ok(foiAoLogin && !!rascunho && rascunho.includes('Texto que não pode se perder'), 'sessão revogada: o texto digitado continua guardado como rascunho neste navegador');
  ok(foiAoLogin && /sess[ãa]o foi encerrada/i.test(await p1.textContent('.login-info').catch(() => '') ?? ''), 'o login explica que a sessão foi encerrada (aviso neutro, não de erro)');
  await nav1.close();
}

// ---- Sair, no navegador ----
atual = usuario(EMAIL);
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 800 } });
const semarCookies = async (sid) => ctx.addCookies([{ name: 'sb-127-auth-token', value: sessaoSb({ sid }), domain: 'localhost', path: '/' }]);
await semarCookies('sair-1');
const pg = await ctx.newPage();
const ir = async (rota) => { await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 }); await pg.waitForFunction(() => !document.body.innerText.includes('Carregando as demandas'), null, { timeout: 60000 }); };
await ir('/demandas');
await pg.click('.icbtn[aria-label^="Alternar tema"]');
const prefProntas = await pg.waitForFunction(() => localStorage.getItem('dmanda-tema') === '"escuro"' && !!localStorage.getItem('dmanda:ui'), null, { timeout: 10000 }).then(() => true, () => false);
const prefAntes = await pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('dmanda')).sort(([x], [y]) => x.localeCompare(y)))));

// 7) falha ao sair: nada de sucesso, a sessão continua
logoutFalha = true; chamadas.length = 0;
await pg.click('.top .perfil-b'); await pg.waitForSelector('.mv-menu[aria-label="Conta"]');
const item = await pg.evaluate(() => ({ nome: document.querySelector('.mv-menu .mv-t')?.textContent, bloqueado: document.querySelector('.mv-menu [role=menuitem]:last-of-type')?.getAttribute('aria-disabled') }));
ok(item.nome === 'Conta de Teste' && item.bloqueado === null, 'no celular o menu do avatar mostra a conta e o "Sair" habilitado');
await pg.click('.mv-menu [role=menuitem]:last-of-type');
const parcial = await pg.waitForURL(/\/login\?saiu=parcial/, { timeout: 30000 }).then(() => true, () => false);
const avisoParcial = await pg.textContent('.login-aviso').catch(() => '');
const cks = await ctx.cookies();
ok(parcial && /não confirmou/.test(avisoParcial ?? '') && !/Você saiu do Dmanda neste navegador\.$/.test(avisoParcial ?? ''), 'falha do Auth ao sair: vai ao login com o aviso honesto (servidor não confirmou), sem mensagem de saída limpa');
ok(!cks.some((c) => c.name === 'sb-127-auth-token' && c.value), 'falha do Auth ao sair: a sessão deste navegador é apagada (a tela não fica parecendo autenticada)');
ok(chamadas.includes('POST /auth/v1/logout?scope=local'), 'a tentativa de sair usou o escopo local');

// 8) sair de verdade, com outro aparelho logado ao mesmo tempo
logoutFalha = false; chamadas.length = 0;
await semarCookies('sair-2'); await ir('/demandas');
const outroAparelho = cookieHeader({ sid: 'outro-aparelho' });
ok((await pedir(outroAparelho)).status === 200, 'antes de sair, o outro aparelho (outra sessão) está logado');
await pg.click('.top .perfil-b'); await pg.waitForSelector('.mv-menu[aria-label="Conta"]');
await Promise.all([pg.waitForURL(/\/login\?saiu=1/, { timeout: 30000 }), pg.click('.mv-menu [role=menuitem]:last-of-type')]);
const aviso = await pg.textContent('.login-info').catch(() => '');
const cks2 = await ctx.cookies();
ok(/saiu do Dmanda/.test(aviso ?? ''), 'depois de sair: login com a mensagem "Você saiu do Dmanda neste navegador"');
ok(!cks2.some((c) => c.name === 'sb-127-auth-token' && c.value), 'o cookie de sessão foi removido');
ok(chamadas.includes('POST /auth/v1/logout?scope=local') && !chamadas.some((c) => /scope=(global|others)/.test(c)), 'o Auth recebeu logout só do escopo local (outros aparelhos e a conta Google não são tocados)');
ok(revogadas.has('sair-2') && !revogadas.has('outro-aparelho') && !revogadas.has('TUDO'), 'o Auth encerrou só a sessão deste aparelho');
ok((await pedir(outroAparelho)).status === 200, 'sair neste navegador preserva a sessão do outro aparelho: ele continua entrando');
const lerPref = () => pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('dmanda')).sort(([x], [y]) => x.localeCompare(y)))));
const prefDepois = await lerPref();
// a verificação usa só a primeira leitura (não é afrouxada); a segunda, 1 s depois, só entra na mensagem para distinguir escrita tardia de valor diferente
const prefTarde = prefAntes === prefDepois ? prefDepois : (await pg.waitForTimeout(1000), await lerPref());
ok(prefAntes === prefDepois && prefAntes.includes('dmanda-tema'), 'as preferências do navegador (tema e outras) continuam depois de sair' + (prefAntes === prefDepois ? '' : ` [antes: ${prefAntes} | depois: ${prefDepois} | depois+1s: ${prefTarde} | url: ${pg.url()} | tema e ui gravados antes de sair: ${prefProntas}]`));
await pg.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 60000 });
ok(new URL(pg.url()).pathname === '/login', 'depois de sair, /demandas exige novo login');
const semAuth = await pedir(null, '/');
ok(semAuth.status === 307 && local(semAuth) === '/login', 'depois de sair, o Início também exige novo login');
await pg.goBack().catch(() => {}); await pg.waitForTimeout(500);
ok(new URL(pg.url()).pathname === '/login' || !(await pg.$('.dcard')), 'voltar no histórico não mostra demandas de volta');

await nav.close(); parar();
console.log(`\n${total - falhas} de ${total} verificações passaram.`);
process.exit(falhas ? 1 : 0);
