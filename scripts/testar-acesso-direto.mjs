// Entrada direta (decisão de 17/11/2026): o Dmanda abre sem código, sem cadastro de aparelho e sem tela de autenticação, e funciona de ponta a ponta. O aplicativo REAL (páginas, ações do
// servidor, exportação, rotina diária) roda em modo real contra um Supabase FALSO local (scripts/supabase-falso.mjs, só a API de funções com a chave de serviço) na frente de um banco de
// TESTE (PGlite, as mesmas migrações, dados fictícios). Nunca toca o Supabase real. Cada contexto de navegador começa SEM cookies nem armazenamento (Edge e WebKit emulado).
// NÃO prova o Supabase real (plataforma, papéis, chaves), o Safari físico nem o domínio final. Uso: node scripts/testar-acesso-direto.mjs
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { iniciarSupabaseFalso, CHAVE_SERVICO } from './supabase-falso.mjs';

const PORTA = process.env.PORTA_TESTE_ACESSO || '7129', PORTA_FALSO = 7130, BASE = `http://localhost:${PORTA}`, RAIZ = '.dados-teste/acesso-direto', CAPTURAS = '.dados-teste/acesso-direto-capturas';
const EMAIL = 'titular-de-teste@exemplo.invalid', USUARIO = 'f0f0f0f0-0000-4000-8000-0000000000a1', SEGREDO_CRON = 'segredo-do-cron-de-teste-0123456789';
rmSync(RAIZ, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true }); mkdirSync(RAIZ, { recursive: true });
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- banco de teste, Supabase falso e aplicativo real ----------
const db = await abrirBancoTeste({ pasta: `${RAIZ}/pg` });
await db.query('insert into auth.users (id, email) values ($1, $2)', [USUARIO, EMAIL]);
await db.query('insert into dmanda_privado.acesso_autorizado (email) values ($1)', [EMAIL]);
const comoTitular = (f, a) => chamarComoUsuario(db, USUARIO, f, a, { provedor: 'email' });
const semente = await comoTitular('criar_demanda', { p: { assunto: 'Demanda fictícia do titular', tipo: 'Memorando' } });
await comoTitular('adicionar_tarefa', { p_demanda: semente.id, p_texto: 'Tarefa fictícia' });
await comoTitular('criar_entrada', { p: { titulo: 'Nota fictícia', texto: 'Texto da nota fictícia' } });
const sqlq = async (q, p = []) => (await db.query(q, p)).rows;
const falso = await iniciarSupabaseFalso({ db, porta: PORTA_FALSO });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: falso.url, SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO, CRON_SECRET: SEGREDO_CRON, DMANDA_SEM_LEMBRETES: 'sim', PORT: PORTA };
delete env.DMANDA_BANCO; delete env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY; delete env.DMANDA_EMAIL_AUTORIZADO;
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } falso.parar(); };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/api/sonda'); if (r.status < 500) break; } catch { /* subindo */ } await esperar(2000); }

const edge = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const wk = await webkit.launch().catch((e) => { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); return null; });
const erros = [], respostasDoNavegador = [], pedidosAoFalso = [];
// contexto novo: sem cookies, sem armazenamento; guarda o texto de tudo que o servidor entrega ao navegador (HTML, JS, JSON) para conferir que nenhum segredo vai junto
const novo = async (motor, opcoes, tema = 'claro') => {
  const ctx = await motor.newContext(opcoes);
  await ctx.addInitScript((t) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, tema);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('request', (q) => { if (q.url().startsWith(falso.url)) pedidosAoFalso.push(q.url()); });
  pg.on('response', async (r) => { try { const t = r.headers()['content-type'] ?? ''; if (/text|json|javascript/.test(t)) respostasDoNavegador.push({ url: r.url(), corpo: await r.text() }); } catch { /* corpo indisponível */ } });
  return { ctx, pg };
};
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando as (entradas|demandas)|Carregando a agenda/.test(document.body.innerText), null, { timeout: 120000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 2000 }).catch(() => {}); await esperar(400);
};
const rotinasChamadas = () => falso.estado.corpos.filter((x) => x.fn === 'executar_como_titular').map((x) => x.args.p_funcao);

// =============================================================================================================================================
// 1) sem navegador e sem credencial: as páginas e a cópia abrem direto, nada pede código nem grava cookie
// =============================================================================================================================================
{
  for (const rota of ['/', '/demandas', '/agenda', '/config', '/entradas']) {
    const r = await fetch(BASE + rota, { redirect: 'manual' });
    const html = await r.text();
    ok(r.status === 200 && !r.headers.get('set-cookie') && !/acesso-codigo|login-form|código de uso único/i.test(html), `sem cookie nenhum, ${rota} abre direto (200), sem pedir código e sem gravar cookie (${r.status})`);
  }
  const ex = await fetch(BASE + '/api/exportar', { redirect: 'manual' });
  const j = await ex.json().catch(() => null);
  ok(ex.status === 200 && j?.formato === 'dmanda-exportacao' && j?.versao === 4 && j.demandas.some((d) => d.assunto === 'Demanda fictícia do titular' && d.tarefas?.length === 1) && j.entradas.some((e) => e.titulo === 'Nota fictícia') && !ex.headers.get('set-cookie'), 'exportação sem sessão: 200, formato v4 e o conteúdo fictício do titular (demanda com tarefa, anotação)');
  ok(/attachment; filename="dmanda-copia-/.test(ex.headers.get('content-disposition') ?? '') && /no-store/.test(ex.headers.get('cache-control') ?? ''), 'exportação: baixa como arquivo e sem cache');
  ok((await fetch(BASE + '/api/sonda')).status === 204, 'a sonda de conexão responde 204');
  // as antigas URLs de entrada não existem mais (sem formulário): vão para o painel
  for (const rota of ['/acesso', '/acesso?saiu=1', '/acesso?encerrada=1', '/acesso/qualquer', '/login', '/login?x=1']) {
    const r = await fetch(BASE + rota, { redirect: 'manual' });
    ok(r.status === 307 && new URL(r.headers.get('location'), BASE).pathname === '/' && !r.headers.get('set-cookie'), `a antiga URL ${rota} redireciona para o painel (${r.status} ${r.headers.get('location')})`);
  }
  // a rotina diária continua com a proteção própria (CRON_SECRET), independente de qualquer acesso
  const semCred = await fetch(BASE + '/api/cron/diaria'), errada = await fetch(BASE + '/api/cron/diaria', { headers: { authorization: 'Bearer errado-errado-errado' } });
  const certa = await fetch(BASE + '/api/cron/diaria', { headers: { authorization: `Bearer ${SEGREDO_CRON}` } });
  ok(semCred.status === 401 && errada.status === 401 && certa.status === 200 && (await certa.json()).ok === true, 'cron: sem credencial e com segredo errado dão 401; com o CRON_SECRET roda (200)');
}

// =============================================================================================================================================
// 2) navegador novo (Edge, computador, Claro): abrir, ler, gravar, recarregar
// =============================================================================================================================================
const A = await novo(edge, { viewport: { width: 1440, height: 900 } });
{
  const { pg, ctx } = A;
  await ir(pg, '/');
  const nav = await pg.evaluate(() => [...document.querySelectorAll('.app a, .app button')].map((e) => (e.getAttribute('aria-label') ?? '') + ' ' + e.textContent.trim()).join('|'));
  ok(new URL(pg.url()).pathname === '/' && /Demandas/.test(nav) && /Agenda/.test(nav) && /Configurações/.test(nav), 'navegador sem sessão anterior: a raiz abre o Início direto, com o menu do painel, sem passar por /acesso');
  ok(!(await pg.$('.faixa-teste')) && !(await pg.$('#acesso-codigo')), 'é o aplicativo em modo real (sem a faixa do banco de teste) e não há campo de código');
  await ir(pg, '/demandas');
  ok(/Demanda fictícia do titular/.test(await pg.textContent('#vista')), 'Demandas abre direto e lista a demanda do titular');
  await ir(pg, '/agenda');
  ok(!!(await pg.$('.agd')), 'Agenda abre direto');
  await ir(pg, '/config');
  const cfg = await pg.textContent('.app .main');
  ok(!(await pg.$('[data-aparelhos]')) && !/Aparelhos autorizados|Autorizar outro aparelho|código de uso único|Revogar/i.test(cfg), 'Configurações abre direto e não tem a seção de Aparelhos nem pedido de código');
  // menu da conta: só Perfil e a cópia dos dados, sem "Sair"
  await pg.click('.top .perfil-b'); await pg.waitForSelector('.mv-menu[aria-label="Conta"]');
  const itens = await pg.$$eval('.mv-menu [role=menuitem]', (l) => l.map((e) => e.textContent.trim()));
  ok(itens.length === 2 && /^Perfil/.test(itens[0]) && /^Baixar cópia/.test(itens[1]) && !itens.some((t) => /Sair|código|aparelho/i.test(t)), `menu da conta: só ${itens.map((t) => t.split(/(?=[a-z][A-Z])/)[0].slice(0, 22)).join(' e ')}, sem Sair e sem código`);
  await pg.keyboard.press('Escape');

  // gravação: demanda pelo cadastro rápido, anotação, e a cópia mostra tudo; recarregar mantém
  await ir(pg, '/demandas');
  const antes = (await sqlq('select count(*)::int n from public.demandas'))[0].n;
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto'); await pg.fill('#n-assunto', 'Criada pela entrada direta'); await pg.click('.modal .btn.pri');
  await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt'); await pg.click('.modal .btn:has-text("Pular tarefas")');
  await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 30000 });
  const linhas = await sqlq("select user_id::text u, assunto from public.demandas where assunto = 'Criada pela entrada direta'");
  ok(linhas.length === 1 && linhas[0].u === USUARIO && (await sqlq('select count(*)::int n from public.demandas'))[0].n === antes + 1, 'cadastrar demanda pela tela grava uma linha, com a identidade (user_id) do titular existente');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await pg.waitForFunction(() => !/Carregando as demandas/.test(document.body.innerText), null, { timeout: 60000 });
  ok(/Criada pela entrada direta/.test(await pg.textContent('#vista')), 'depois de recarregar a demanda continua lá (veio do banco, não da memória)');
  await ir(pg, '/entradas');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto'); await pg.fill('#e-texto', 'Anotação da entrada direta');
  await pg.waitForFunction(() => document.querySelector('.modal .estado-entrada')?.getAttribute('data-estado') === 'salvo', null, { timeout: 30000 });
  await pg.click('.modal .btn.pri'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
  const ent = await sqlq("select user_id::text u from public.entradas where texto = 'Anotação da entrada direta'");
  ok(ent.length === 1 && ent[0].u === USUARIO, 'anotar pela tela confirma "Salvo no Dmanda" e grava com a identidade do titular');
  const ex = await (await ctx.request.get(BASE + '/api/exportar')).json();
  ok(ex.demandas.some((d) => d.assunto === 'Criada pela entrada direta') && ex.entradas.some((e) => e.texto === 'Anotação da entrada direta') && ex.demandas.length === antes + 1, 'a cópia dos dados do navegador inclui o que acabou de ser gravado (e nada a mais)');

  // falha do banco: a tela não finge sucesso, nada é gravado, e ao voltar o cadastro grava uma vez só
  await ir(pg, '/demandas');
  const n0 = (await sqlq('select count(*)::int n from public.demandas'))[0].n;
  falso.estado.falhas.set('executar_como_titular', '500');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto'); await pg.fill('#n-assunto', 'Tentativa com falha'); await pg.click('.modal .btn.pri');
  await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn.pri');
  await pg.waitForFunction(() => /Não foi possível salvar a demanda/.test(document.querySelector('.modal')?.textContent || ''), null, { timeout: 30000 });
  ok((await sqlq('select count(*)::int n from public.demandas'))[0].n === n0, 'com o banco falhando, a tela diz que não salvou e nada é gravado');
  falso.estado.falhas.delete('executar_como_titular');
  await pg.click('.modal .btn.pri'); await pg.waitForFunction(() => !!document.querySelector('#n-nt') || !document.querySelector('.modal'), null, { timeout: 30000 });
  if (await pg.$('#n-nt')) await pg.click('.modal .btn:has-text("Pular tarefas")');
  await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 30000 });
  ok((await sqlq("select count(*)::int n from public.demandas where assunto = 'Tentativa com falha'"))[0].n === 1, 'repetida depois da falha, a demanda grava exatamente uma vez');
}

// =============================================================================================================================================
// 3) o que o servidor chamou e o que o navegador recebeu
// =============================================================================================================================================
{
  const permitidas = (readFileSync(readdirSync('supabase/migrations').map((f) => 'supabase/migrations/' + f).find((f) => f.includes('entrada_direta')), 'utf8').match(/array\[([^\]]+)\]/)?.[1] ?? '').match(/'([a-z_]+)'/g).map((x) => x.slice(1, -1));
  const caminhos = [...new Set(falso.estado.chamadas.map((c) => c.split('?')[0]))];
  ok(caminhos.every((c) => ['POST /rest/v1/rpc/executar_como_titular', 'POST /rest/v1/rpc/rotina_diaria'].includes(c)), `o servidor só chamou executar_como_titular e a rotina diária (${caminhos.join(', ')})`);
  ok(!falso.estado.chamadas.some((c) => /auth|aparelho|convite|exigir|estado_aparelho/i.test(c)) && rotinasChamadas().length > 5 && rotinasChamadas().every((f) => permitidas.includes(f)), `nenhuma chamada ao Auth nem às funções retiradas; ${rotinasChamadas().length} operações executadas, todas da lista permitida`);
  const texto = respostasDoNavegador.map((r) => r.corpo).join('\n');
  ok(!texto.includes(CHAVE_SERVICO) && !texto.includes(SEGREDO_CRON) && !texto.includes(EMAIL) && !texto.includes(falso.url), 'nada que o navegador recebeu (HTML, JavaScript, JSON) contém a chave de serviço, o segredo do cron, o e-mail do titular ou o endereço do banco');
  ok(pedidosAoFalso.length === 0, 'o navegador nunca falou com o banco: só o servidor do aplicativo fala');
  ok(!(await A.ctx.cookies()).some((c) => /^sb-|auth|token|session/i.test(c.name)) && !(await A.pg.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter((k) => /token|auth|sess|jwt|sb-/i.test(k)).join())), 'o navegador não guarda cookie, token nem sessão: não existe credencial do lado dele');
}

// =============================================================================================================================================
// 4) interface em Claro e Escuro, nas larguras pertinentes (computador, iPad, iPhone), sem a seção de Aparelhos
// =============================================================================================================================================
{
  const perfis = [['computador 1440', edge, { viewport: { width: 1440, height: 900 } }], ['iPad 820', edge, { viewport: { width: 820, height: 1100 } }], ['iPhone 390', wk ?? edge, wk ? { ...devices['iPhone 13'] } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]];
  for (const [nome, motor, opcoes] of perfis) for (const tema of ['claro', 'escuro']) {
    const c = await novo(motor, opcoes, tema);
    await ir(c.pg, '/config');
    const m = await c.pg.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, tema: document.documentElement.getAttribute('data-tema') ?? document.documentElement.className, aparelhos: !!document.querySelector('[data-aparelhos]'), titulos: [...document.querySelectorAll('.app .main h2, .app .main h3')].map((e) => e.textContent.trim()).slice(0, 8) }));
    await c.pg.screenshot({ path: `${CAPTURAS}/config-${nome.replace(/ /g, '-')}-${tema}.png`, fullPage: true });
    ok(m.sw <= m.vw + 1 && !m.aparelhos, `Configurações ${nome} (${tema}): sem rolagem lateral e sem a seção de Aparelhos (${m.titulos.slice(0, 4).join(' / ')})`);
    await ir(c.pg, '/');
    const cabe = await c.pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    ok(cabe, `Início ${nome} (${tema}): abre direto e cabe na largura`);
    await c.ctx.close();
  }
}

await wk?.close(); await edge.close();
ok(erros.length === 0, 'nenhum erro de página no navegador' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
await db.close(); parar();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
