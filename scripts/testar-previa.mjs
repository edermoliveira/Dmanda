// Prévia visual com dados fictícios (modo de demonstração, sem Supabase e sem banco no servidor) e theme-color que segue o app, no Edge, porta 7110.
// O modo liga por DMANDA_DEMO=sim em desenvolvimento (na Vercel, por prévia de branch visual/...). Não valida a Vercel, o Supabase real nem aparelho físico. Uso: node scripts/testar-previa.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';

const PORTA = '7110', BASE = `http://localhost:${PORTA}`;
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_DEMO: 'sim', DMANDA_BANCO: '', NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login', { redirect: 'manual' }); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions'] });
const erros = [], posts = [];
const ctx = await nav.newContext({ viewport: { width: 1360, height: 800 } });
const pg = await ctx.newPage(); pg.setDefaultTimeout(30000);
pg.on('pageerror', (e) => erros.push(e.message.slice(0, 300)));
pg.on('console', (m) => { if (/hydrat/i.test(m.text())) erros.push('hidratação: ' + m.text().slice(0, 200)); });
pg.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });
const ir = async (rota) => { await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 }); await pg.waitForFunction(() => !/Carregando as (entradas|demandas)/.test(document.body.innerText), null, { timeout: 60000 }); await pg.waitForTimeout(800); };
const barra = () => pg.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => ({ c: m.content.toUpperCase(), media: m.getAttribute('media') })));

// ---- entrada direta, sem login, e dados fictícios ----
await pg.goto(BASE + '/login', { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
ok(new URL(pg.url()).pathname === '/', 'prévia: /login leva ao painel (não há conta nem Supabase)');
await ir('/');
ok(await pg.evaluate(() => window.__DMANDA_DEMO__ === true), 'o servidor marcou o modo de demonstração para a interface');
ok(/Prévia visual com dados fictícios/.test(await pg.textContent('.faixa-teste')), 'faixa avisa que é prévia com dados fictícios (e não "banco local de teste")');
ok(await pg.locator('.o-anel').count() === 1 && /\d+%/.test(await pg.textContent('.o-pct')), 'Início mostra o anel com o percentual calculado pelos dados fictícios');
ok((await pg.locator('.o-cel').count()) >= 28 && (await pg.locator('.o-cel[data-n="4"]').count()) >= 1, 'o calendário de carga tem dias com carga (dados fictícios relativos a hoje)');
await ir('/demandas');
const n = await pg.locator('.cards .dcard').count();
ok(n >= 10, `Demandas lista os dados fictícios (${n} cards)`);
await ir('/entradas');
ok((await pg.locator('.postits .postit').count()) === 5, 'Entradas mostra 5 post-its fictícios (a arquivada fica no Arquivo)');

// ---- gravar funciona só na memória: cria entrada, vê na lista, some ao recarregar ----
await pg.keyboard.press('n'); await pg.waitForSelector('#e-texto');
await pg.fill('#e-titulo', 'Anotação da prévia'); await pg.fill('#e-texto', 'Escrita durante o teste #previa');
await pg.waitForFunction(() => document.querySelector('.modal .estado-entrada')?.getAttribute('data-estado') === 'salvo', null, { timeout: 15000 });
await pg.click('.modal .btn.pri'); await pg.waitForFunction(() => !document.querySelector('.modal'));
ok((await pg.locator('.postits .postit').count()) === 6 && /Anotação da prévia/.test(await pg.textContent('.postits')), 'a anotação criada aparece na lista (gravada na memória do navegador)');
await pg.click('.postits .postit:has-text("Anotação da prévia") .p-abrir'); await pg.waitForSelector('.modal');
await pg.waitForTimeout(400); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await ir('/entradas');
ok((await pg.locator('.postits .postit').count()) === 5, 'ao recarregar, os dados voltam ao estado fictício inicial (nada é durável)');
ok(posts.length === 0, `nenhuma requisição POST ao servidor durante o uso (${posts.length}): nada foi enviado a Supabase nem a ação do servidor`);

// ---- theme-color acompanha o modo e o fundo escolhidos no app ----
await ir('/config');
const b0 = await barra();
ok(b0.length >= 1 && b0.every((m) => !m.media) && new Set(b0.map((m) => m.c)).size === 1, `theme-color: uma cor só, sem depender do esquema do sistema (${JSON.stringify(b0)})`);
const claro0 = b0[0].c;
await pg.click('.ap-seg button:has-text("Escuro")');
await pg.waitForTimeout(300);
const b1 = await barra();
ok(claro0 === '#EDF0F3' && b1.every((m) => m.c === '#080A0C'), `theme-color vira o fundo escuro ao escolher o modo escuro (${claro0} para ${b1[0]?.c})`);
const definir = (sel, v) => pg.$eval(sel, (el, val) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
await definir('input[aria-label="Cor de fundo no modo escuro"]', '#0C1015'); await pg.waitForTimeout(300);
ok((await barra()).every((m) => m.c === '#0C1015'), 'theme-color acompanha o fundo personalizado');
await pg.goto(BASE + '/', { waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await pg.waitForTimeout(800);
ok((await barra()).every((m) => m.c === '#0C1015'), 'depois de recarregar e navegar, theme-color continua com o fundo personalizado');
await pg.click('a[href="/demandas"], [role="link"][href="/demandas"]').catch(() => {}); await pg.waitForTimeout(600);
ok((await barra()).every((m) => m.c === '#0C1015'), 'depois de navegar entre telas, theme-color não volta à cor do sistema');
// restaurar volta ao padrão do modo
await ir('/config'); await pg.click('button:has-text("Restaurar padrão Órbita")'); await pg.waitForTimeout(300);
ok((await barra()).every((m) => m.c === '#080A0C'), 'Restaurar padrão: theme-color volta ao fundo padrão do modo atual (escuro)');
// cores novas: botão com texto legível (tinta escolhida sozinha) e recusa do texto secundário fraco
await pg.click('.ap-seg button:has-text("Escuro")'); await pg.waitForTimeout(200);
await definir('input[aria-label="Cor de acento no modo escuro"]', '#E8E8E8'); await pg.waitForTimeout(300);
const tinta = await pg.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--acc-ink').trim().toUpperCase());
ok(tinta === '#080A0C', `acento claro mantém tinta escura nos botões (${tinta})`);
await definir('input[aria-label="Cor de acento no modo escuro"]', '#2F4F7A'); await pg.waitForTimeout(300);
ok(/quase some|escuro demais/.test((await pg.textContent('.ap-aviso').catch(() => '')) || ''), 'acento escuro demais para o fundo é recusado com explicação');
await definir('input[aria-label="Cor de texto no modo escuro"]', '#8C8F92'); await pg.waitForTimeout(300);
ok(/(secundário|difícil de ler)/.test((await pg.textContent('.ap-aviso').catch(() => '')) || ''), 'texto cinza médio no escuro é recusado com explicação');
ok(erros.length === 0, `sem erro de página nem aviso de hidratação (${erros.join(' | ') || 'nenhum'})`);

await nav.close();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
