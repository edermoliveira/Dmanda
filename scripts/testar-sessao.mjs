// Teste de integração da sessão em ambiente ISOLADO: a aplicação real (proxy, ação "Sair", callback não) roda contra um servidor de Auth FALSO local
// (127.0.0.1), nunca contra o Supabase real. O app não ganha nenhum atalho: o servidor falso só devolve um usuário para um cookie de sessão fabricado.
// O tempo é controlado pelo carimbo do cookie de último uso (a regra de 6 horas continua a real). Cobre: expiração por inatividade (limites de 5h59 e
// 6h01), renovação do uso (e o que NÃO renova), cookie ausente ou adulterado, conta fora da lista, provedores aceitos (Google e e-mail e senha), entrada por
// e-mail e senha pelo formulário e o botão Sair (escopo local, falha sem sucesso indevido, cookies, rotas protegidas, preferências preservadas).
// NÃO valida o Google real, a senha real nem o Supabase real. Uso: node scripts/testar-sessao.mjs
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORTA = process.env.PORTA_SESSAO || '7104', PORTA_AUTH = 7105, BASE = `http://localhost:${PORTA}`;
const EMAIL = 'conta-de-teste@exemplo.invalid', ID = '00000000-0000-4000-8000-0000000000aa', SEIS_H = 6 * 60 * 60 * 1000;
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };

// ---- servidor de Auth falso ----
let atual = null, logoutFalha = false, provedorSenha = 'google';
const SENHA = 'senha-de-teste-nao-real-123', EMAIL_FORA = 'fora-da-lista@exemplo.invalid', EMAIL_LIMITE = 'limite@exemplo.invalid';
const chamadas = [];
let usuariosAdmin = [], putsAdmin = [];
const lerCorpo = (req) => new Promise((r) => { let t = ''; req.on('data', (c) => { t += c; }); req.on('end', () => { try { r(JSON.parse(t || '{}')); } catch { r({}); } }); });
const jwtFalso = (id) => { const agora = Math.floor(Date.now() / 1000); const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: id, role: 'authenticated', exp: agora + 3600 })}.assinatura`; };
const usuario = (email, provedor = 'google') => ({ id: ID, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: provedor, providers: [provedor] }, user_metadata: { full_name: 'Conta de Teste' }, created_at: '2026-01-01T00:00:00Z' });
// CORS aberto no Auth falso: o formulário de senha fala com o Auth direto do navegador (como o Supabase real permite), de outra origem
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
const json = (res, status, corpo) => { res.writeHead(status, { 'content-type': 'application/json', ...CORS }); res.end(corpo === undefined ? '' : JSON.stringify(corpo)); };
const auth = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  chamadas.push(`${req.method} ${u.pathname}${u.search}`);
  if (u.pathname === '/auth/v1/admin/users' && req.method === 'GET') return json(res, 200, { users: usuariosAdmin, aud: 'authenticated' });
  if (/^\/auth\/v1\/admin\/users\/[\w-]+$/.test(u.pathname) && req.method === 'PUT') { const c = await lerCorpo(req); putsAdmin.push(c); return json(res, 200, { ...usuariosAdmin[0], updated_at: new Date().toISOString() }); }
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
    const c = await lerCorpo(req), email = String(c.email ?? '').toLowerCase();
    if (email === EMAIL_LIMITE) return json(res, 429, { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' });
    if (c.password !== SENHA || (email !== EMAIL && email !== EMAIL_FORA)) return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    atual = usuario(email, provedorSenha);
    const agora = Math.floor(Date.now() / 1000);
    return json(res, 200, { access_token: jwtFalso(ID), token_type: 'bearer', expires_in: 3600, expires_at: agora + 3600, refresh_token: 'rt-falso', user: atual });
  }
  if (u.pathname === '/auth/v1/user') return json(res, 200, atual);
  if (u.pathname === '/auth/v1/logout') return logoutFalha ? json(res, 500, { code: 500, msg: 'falha proposital' }) : (res.writeHead(204, CORS), res.end());
  if (u.pathname === '/rest/v1/rpc/listar_demandas') return json(res, 200, []);
  if (u.pathname === '/rest/v1/rpc/estado_rotina') return json(res, 200, { ultima_ok: null, ultima_falha: null, resumo_data: null, resumo_calculado_em: null });
  return json(res, 404, {});
});
await new Promise((r) => auth.listen(PORTA_AUTH, '127.0.0.1', r));

// ---- aplicação real (modo real, apontada para o Auth falso) ----
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTA_AUTH}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_falsa_para_teste', DMANDA_EMAIL_AUTORIZADO: EMAIL, SUPABASE_SERVICE_ROLE_KEY: '', CRON_SECRET: 'segredo-de-teste-1234567890', DMANDA_BANCO: '' };
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } auth.close(); };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login', { redirect: 'manual' }); if (r.status < 500) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

// ---- cookies fabricados (formato do @supabase/ssr) ----
const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const sessaoSb = () => {
  const agora = Math.floor(Date.now() / 1000);
  const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: ID, role: 'authenticated', exp: agora + 3600 })}.assinatura`;
  return 'base64-' + b64u({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: agora + 3600, refresh_token: 'rt', user: atual });
};
const cookieHeader = (uso) => `sb-127-auth-token=${sessaoSb()}` + (uso == null ? '' : `; dmanda-ultimo-uso=${uso}`);
const pedir = async (cookie, rota = '/demandas') => fetch(BASE + rota, { redirect: 'manual', headers: cookie ? { cookie } : {} });
const local = (r) => (r.headers.get('location') ?? '').replace(BASE, '');
const setCookies = (r) => r.headers.getSetCookie();
const apagado = (lista, nome) => lista.some((c) => c.startsWith(nome + '=') && /max-age=0|expires=thu, 01 jan 1970/i.test(c));

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
ok(r.status === 307 && local(r) === '/login', 'sem sessão: /demandas redireciona ao login');

// 2) conta autorizada, uso há 5h59: passa e renova o carimbo de uso
const agora = Date.now();
chamadas.length = 0;
r = await pedir(cookieHeader(agora - (SEIS_H - 60_000)));
const renovado = setCookies(r).find((c) => c.startsWith('dmanda-ultimo-uso='));
const valorRenovado = renovado ? Number(renovado.split(';')[0].split('=')[1]) : NaN;
ok(r.status === 200 && Math.abs(valorRenovado - Date.now()) < 60_000, 'uso há 5h59: passa (200) e o carimbo de último uso é renovado para agora');

// 3) o carimbo renovado vale como uso novo
r = await pedir(cookieHeader(valorRenovado));
ok(r.status === 200, 'depois da renovação, o próximo pedido passa de novo');

// 4) uso há 6h01: expira, sai só desta sessão (escopo local) e apaga o carimbo
chamadas.length = 0;
r = await pedir(cookieHeader(Date.now() - (SEIS_H + 60_000)));
ok(r.status === 307 && local(r) === '/login?expirou=1', 'uso há 6h01: redireciona ao login com aviso de expiração');
ok(chamadas.some((c) => c === 'POST /auth/v1/logout?scope=local') && !chamadas.some((c) => /scope=(global|others)/.test(c)), 'a expiração encerra só a sessão deste navegador (logout com escopo local, nunca global)');
ok(apagado(setCookies(r), 'dmanda-ultimo-uso'), 'a expiração apaga o carimbo de último uso');

// 5) sem carimbo (cookie apagado ou nunca gravado): falha fechada, a sessão é encerrada só neste navegador
chamadas.length = 0;
r = await pedir(cookieHeader(null));
ok(r.status === 307 && local(r) === '/login?expirou=1' && chamadas.includes('POST /auth/v1/logout?scope=local'), 'sem carimbo de uso (cookie apagado): não prolonga a sessão, expira e encerra só esta sessão');
r = await pedir(cookieHeader('lixo'));
ok(r.status === 307 && local(r) === '/login?expirou=1', 'carimbo ilegível: expira');
r = await pedir(cookieHeader(Date.now() + 30 * 24 * 60 * 60 * 1000));
ok(r.status === 307 && local(r) === '/login?expirou=1', 'carimbo no futuro (cookie adulterado para nunca expirar): expira');
// /login com sessão do Supabase mas sem carimbo válido mostra o formulário (sem laço de redirecionamento)
r = await pedir(cookieHeader(null), '/login');
ok(r.status === 200, 'login com sessão sem carimbo de uso válido: mostra o formulário em vez de redirecionar');
r = await pedir(cookieHeader(Date.now()), '/login');
ok(r.status === 307 && local(r) === '/', 'login com sessão válida e uso recente: vai ao Início');
// o que NÃO renova o uso: as páginas públicas (o app não pré-carrega nada sozinho; o Next esconde os cabeçalhos de pré-carregamento do proxy)
const antigo = Date.now() - 3 * 60 * 60 * 1000;
r = await pedir(cookieHeader(antigo), '/login?expirou=1');
ok(!setCookies(r).some((c) => c.startsWith('dmanda-ultimo-uso=')), 'a página de login não renova o carimbo de uso');
r = await pedir(cookieHeader(antigo), '/demandas');
ok(setCookies(r).some((c) => c.startsWith('dmanda-ultimo-uso=')), 'um pedido normal de página renova o carimbo de uso');
// sonda leve de sessão: 204 com sessão válida e redirecionamento ao login sem ela (e renova o carimbo, como qualquer uso)
r = await pedir(cookieHeader(antigo), '/api/sessao');
ok(r.status === 204, 'sonda /api/sessao com sessão válida: 204 sem corpo');
r = await pedir(null, '/api/sessao');
ok(r.status === 307 && local(r) === '/login', 'sonda /api/sessao sem sessão: redireciona ao login (é o sinal de "sessão encerrada" para a tela)');
// páginas antigas de desenvolvimento e a página /marca não ficam abertas sem login
for (const rota of ['/marca', '/pecas', '/tokens']) { r = await pedir(null, rota); ok(r.status === 307 && local(r) === '/login', `sem login, ${rota} redireciona ao login`); }
r = await pedir(null, '/marca/icone-app.svg');
ok(r.status === 200, 'os arquivos estáticos da marca (SVG, PNG, manifesto) continuam públicos para o login e a instalação');

// 6) conta fora da lista e provedor diferente de Google
atual = usuario('outra-conta@exemplo.invalid'); chamadas.length = 0;
r = await pedir(cookieHeader(Date.now()));
ok(r.status === 307 && local(r) === '/login?negado=1' && chamadas.includes('POST /auth/v1/logout?scope=local'), 'conta fora da lista com sessão válida: negada e a sessão é encerrada (escopo local)');
atual = usuario(EMAIL, 'github');
r = await pedir(cookieHeader(Date.now()));
ok(r.status === 307 && local(r) === '/login?negado=1', 'e-mail certo mas provedor fora de Google e e-mail e senha: negado');
atual = usuario(EMAIL, 'email');
r = await pedir(cookieHeader(Date.now()));
ok(r.status === 200, 'e-mail certo entrando por e-mail e senha: passa');

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
  ok(await p0.isVisible('#login-senha') && (await p0.textContent('.login-caixa')).includes('Entrar com Google'), 'login: formulário de e-mail e senha e (na transição) o botão do Google aparecem');
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
  // entrada correta (usuário criado pelo Google, que ganhou senha: provider continua google)
  provedorSenha = 'google';
  await Promise.all([p0.waitForURL((u) => u.pathname === '/', { timeout: 120000 }), entrar(EMAIL, SENHA)]);
  await p0.waitForSelector('.app .main', { timeout: 120000 });
  const ck = await c0.cookies();
  const uso = ck.find((c) => c.name === 'dmanda-ultimo-uso');
  ok(!!ck.find((c) => c.name.startsWith('sb-') && c.value) && !!uso && Math.abs(Number(uso.value) - Date.now()) < 120_000 && uso.httpOnly, 'login: entrada correta cria a sessão e o carimbo de último uso (somente servidor) e abre o Início');
  ok(!(await p0.content()).includes(SENHA), 'login: a senha não aparece na página depois da entrada');
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
  await c0.addCookies([{ name: 'sb-127-auth-token', value: sessaoSb(), domain: 'localhost', path: '/' }, { name: 'dmanda-ultimo-uso', value: String(Date.now()), domain: 'localhost', path: '/' }]);
  await entrar(EMAIL, SENHA);
  const velha = await p0.waitForURL((u) => u.pathname === '/', { timeout: 60000 }).then(() => true, () => false);
  ok(velha, 'login: tela de login velha, com outra aba já logada, termina no painel (sem mensagem de erro falsa)');
  await nav0.close();
}

// ---- falha ao gravar: sem internet e sessão expirada no meio do uso (a tela nunca mostra sucesso e o texto digitado não se perde) ----
{
  atual = usuario(EMAIL);
  const nav1 = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
  const c1 = await nav1.newContext({ viewport: { width: 1100, height: 800 } });
  await c1.addCookies([
    { name: 'sb-127-auth-token', value: sessaoSb(), domain: 'localhost', path: '/' },
    { name: 'dmanda-ultimo-uso', value: String(Date.now()), domain: 'localhost', path: '/' },
  ]);
  const p1 = await c1.newPage();
  await p1.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 120000 });
  await p1.waitForSelector('.app .main', { timeout: 120000 });
  await p1.waitForFunction(() => !document.body.innerText.includes('Carregando as demandas'), null, { timeout: 60000 });
  await p1.click('.pagehead ~ * button[aria-label="Nova demanda"], button[aria-label="Nova demanda"]');
  await p1.waitForSelector('#n-assunto');
  await p1.fill('#n-assunto', 'Texto que não pode se perder');
  // 1) sem internet
  await c1.setOffline(true);
  await p1.waitForSelector('.faixa-offline', { timeout: 10000 }).catch(() => {});
  const faixa = await p1.isVisible('.faixa-offline');
  await p1.click('.modal .btn.pri');
  await p1.waitForSelector('#toast.on.erro', { timeout: 30000 });
  const toast = await p1.textContent('#toast');
  ok(faixa, 'sem internet: a faixa "Sem conexão" aparece no painel');
  ok(/Sem conexão/.test(toast ?? '') && /Nada foi gravado/.test(toast ?? ''), 'sem internet: gravar mostra erro claro ("Nada foi gravado"), nunca sucesso');
  ok((await p1.inputValue('#n-assunto')) === 'Texto que não pode se perder' && await p1.isEnabled('.modal .btn.pri'), 'sem internet: o texto continua na janela e o botão volta a funcionar (não fica travado)');
  await c1.setOffline(false);
  await p1.waitForFunction(() => !document.querySelector('.faixa-offline'), null, { timeout: 10000 });
  ok(true, 'ao voltar a conexão, a faixa de "Sem conexão" some');
  // 2) sessão expira no meio do uso: o carimbo vence e a ação é barrada pela porta de entrada
  await c1.addCookies([{ name: 'dmanda-ultimo-uso', value: String(Date.now() - (SEIS_H + 60_000)), domain: 'localhost', path: '/' }]);
  await p1.waitForSelector('#toast:not(.on)', { timeout: 15000 }).catch(() => {});
  await p1.click('.modal .btn.pri');
  const foiAoLogin = await p1.waitForURL(/\/login\?expirou=1/, { timeout: 30000 }).then(() => true, () => false);
  ok(foiAoLogin, 'sessão expirada no meio do uso: gravar leva ao login com o aviso de expiração (sem sucesso de mentira)');
  const rascunho = await p1.evaluate(() => localStorage.getItem('dmanda:rascunhos'));
  ok(foiAoLogin && !!rascunho && rascunho.includes('Texto que não pode se perder'), 'sessão expirada: o texto digitado continua guardado como rascunho neste navegador');
  await nav1.close();
}

// ---- Sair, no navegador ----
atual = usuario(EMAIL);
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 800 } });
const semarCookies = async () => ctx.addCookies([
  { name: 'sb-127-auth-token', value: sessaoSb(), domain: 'localhost', path: '/' },
  { name: 'dmanda-ultimo-uso', value: String(Date.now()), domain: 'localhost', path: '/' },
]);
await semarCookies();
const pg = await ctx.newPage();
const ir = async (rota) => { await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 }); await pg.waitForFunction(() => !document.body.innerText.includes('Carregando as demandas'), null, { timeout: 60000 }); };
await ir('/demandas');
await pg.click('.icbtn[aria-label^="Alternar tema"]');
await pg.waitForFunction(() => localStorage.getItem('dmanda-tema') === '"escuro"' && !!localStorage.getItem('dmanda:ui'), null, { timeout: 10000 }).catch(() => {});
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
ok(!cks.some((c) => c.name === 'sb-127-auth-token' && c.value) && !cks.some((c) => c.name === 'dmanda-ultimo-uso' && c.value), 'falha do Auth ao sair: a sessão deste navegador é apagada (a tela não fica parecendo autenticada)');
ok(chamadas.includes('POST /auth/v1/logout?scope=local'), 'a tentativa de sair usou o escopo local');

// 8) sair de verdade
logoutFalha = false; chamadas.length = 0;
await semarCookies(); await ir('/demandas');
await pg.click('.top .perfil-b'); await pg.waitForSelector('.mv-menu[aria-label="Conta"]');
await Promise.all([pg.waitForURL(/\/login\?saiu=1/, { timeout: 30000 }), pg.click('.mv-menu [role=menuitem]:last-of-type')]);
const aviso = await pg.textContent('.login-aviso').catch(() => '');
const cks2 = await ctx.cookies();
ok(/saiu do Dmanda/.test(aviso ?? ''), 'depois de sair: login com a mensagem "Você saiu do Dmanda neste navegador"');
ok(!cks2.some((c) => c.name === 'sb-127-auth-token' && c.value) && !cks2.some((c) => c.name === 'dmanda-ultimo-uso' && c.value), 'os cookies de sessão e de último uso foram removidos');
ok(chamadas.includes('POST /auth/v1/logout?scope=local') && !chamadas.some((c) => /scope=(global|others)/.test(c)), 'o Auth recebeu logout só do escopo local (outros aparelhos e a conta Google não são tocados)');
const prefDepois = await pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('dmanda')).sort(([x], [y]) => x.localeCompare(y)))));
ok(prefAntes === prefDepois && prefAntes.includes('dmanda-tema'), 'as preferências do navegador (tema e outras) continuam depois de sair' + (prefAntes === prefDepois ? '' : ` [antes: ${prefAntes} | depois: ${prefDepois}]`));
await pg.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 60000 });
ok(new URL(pg.url()).pathname === '/login', 'depois de sair, /demandas exige novo login');
const semAuth = await pedir(null, '/');
ok(semAuth.status === 307 && local(semAuth) === '/login', 'depois de sair, o Início também exige novo login');
await pg.goBack().catch(() => {}); await pg.waitForTimeout(500);
ok(new URL(pg.url()).pathname === '/login' || !(await pg.$('.dcard')), 'voltar no histórico não mostra demandas de volta');

await nav.close(); parar();
console.log(`\n${total - falhas} de ${total} verificações passaram.`);
process.exit(falhas ? 1 : 0);
