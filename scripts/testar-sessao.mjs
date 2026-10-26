// Teste de integração da sessão em ambiente ISOLADO: a aplicação real (proxy, ação "Sair", callback não) roda contra um servidor de Auth FALSO local
// (127.0.0.1), nunca contra o Supabase real. O app não ganha nenhum atalho: o servidor falso só devolve um usuário para um cookie de sessão fabricado.
// O tempo é controlado pelo carimbo do cookie de último uso (a regra de 6 horas continua a real). Cobre: expiração por inatividade (limites de 5h59 e
// 6h01), renovação do uso, conta fora da lista, provedor diferente de Google e o botão Sair (escopo local, falha sem sucesso indevido, cookies, rotas protegidas,
// preferências preservadas). NÃO valida o Google real nem o Supabase real. Uso: node scripts/testar-sessao.mjs
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORTA = process.env.PORTA_SESSAO || '7104', PORTA_AUTH = 7105, BASE = `http://localhost:${PORTA}`;
const EMAIL = 'conta-de-teste@exemplo.invalid', ID = '00000000-0000-4000-8000-0000000000aa', SEIS_H = 6 * 60 * 60 * 1000;
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };

// ---- servidor de Auth falso ----
let atual = null, logoutFalha = false;
const chamadas = [];
const usuario = (email, provedor = 'google') => ({ id: ID, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: provedor, providers: [provedor] }, user_metadata: { full_name: 'Conta de Teste' }, created_at: '2026-01-01T00:00:00Z' });
const json = (res, status, corpo) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(corpo === undefined ? '' : JSON.stringify(corpo)); };
const auth = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); chamadas.push(`${req.method} ${u.pathname}${u.search}`);
  if (u.pathname === '/auth/v1/user') return json(res, 200, atual);
  if (u.pathname === '/auth/v1/logout') return logoutFalha ? json(res, 500, { code: 500, msg: 'falha proposital' }) : (res.writeHead(204), res.end());
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

// 5) sem carimbo (primeiro pedido depois do login): o próprio login vale como uso
r = await pedir(cookieHeader(null));
ok(r.status === 200, 'sem carimbo de uso (acabou de entrar): passa');

// 6) conta fora da lista e provedor diferente de Google
atual = usuario('outra-conta@exemplo.invalid'); chamadas.length = 0;
r = await pedir(cookieHeader(Date.now()));
ok(r.status === 307 && local(r) === '/login?negado=1' && chamadas.includes('POST /auth/v1/logout?scope=local'), 'conta fora da lista com sessão válida: negada e a sessão é encerrada (escopo local)');
atual = usuario(EMAIL, 'email');
r = await pedir(cookieHeader(Date.now()));
ok(r.status === 307 && local(r) === '/login?negado=1', 'e-mail certo mas provedor diferente de Google: negado');

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
const prefAntes = await pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('dmanda')))));

// 7) falha ao sair: nada de sucesso, a sessão continua
logoutFalha = true; chamadas.length = 0;
await pg.click('.top .perfil-b'); await pg.waitForSelector('.mv-menu[aria-label="Conta"]');
const item = await pg.evaluate(() => ({ nome: document.querySelector('.mv-menu .mv-t')?.textContent, bloqueado: document.querySelector('.mv-menu [role=menuitem]')?.getAttribute('aria-disabled') }));
ok(item.nome === 'Conta de Teste' && item.bloqueado === null, 'no celular o menu do avatar mostra a conta e o "Sair" habilitado');
await pg.click('.mv-menu [role=menuitem]');
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
await Promise.all([pg.waitForURL(/\/login\?saiu=1/, { timeout: 30000 }), pg.click('.mv-menu [role=menuitem]')]);
const aviso = await pg.textContent('.login-aviso').catch(() => '');
const cks2 = await ctx.cookies();
ok(/saiu do Dmanda/.test(aviso ?? ''), 'depois de sair: login com a mensagem "Você saiu do Dmanda neste navegador"');
ok(!cks2.some((c) => c.name === 'sb-127-auth-token' && c.value) && !cks2.some((c) => c.name === 'dmanda-ultimo-uso' && c.value), 'os cookies de sessão e de último uso foram removidos');
ok(chamadas.includes('POST /auth/v1/logout?scope=local') && !chamadas.some((c) => /scope=(global|others)/.test(c)), 'o Auth recebeu logout só do escopo local (outros aparelhos e a conta Google não são tocados)');
const prefDepois = await pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('dmanda')))));
ok(prefAntes === prefDepois && prefAntes.includes('dmanda-tema'), 'as preferências do navegador (tema e outras) continuam depois de sair');
await pg.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 60000 });
ok(new URL(pg.url()).pathname === '/login', 'depois de sair, /demandas exige novo login');
const semAuth = await pedir(null, '/');
ok(semAuth.status === 307 && local(semAuth) === '/login', 'depois de sair, o Início também exige novo login');
await pg.goBack().catch(() => {}); await pg.waitForTimeout(500);
ok(new URL(pg.url()).pathname === '/login' || !(await pg.$('.dcard')), 'voltar no histórico não mostra demandas de volta');

await nav.close(); parar();
console.log(`\n${total - falhas} de ${total} verificações passaram.`);
process.exit(falhas ? 1 : 0);
