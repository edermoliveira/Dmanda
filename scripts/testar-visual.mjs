// Organização visual (decisão 62) no navegador (Edge) com o banco local de TESTE (PGlite), só com dados fictícios. Cobre:
//   largura e grade: Início e Configurações numa coluna central de até 1.200 px (título, contadores e painéis na mesma borda, busca do cabeçalho alinhada); Para hoje com cerca de dois
//     terços e Humor e Clima com um terço no largo; empilhados no estreito, com Para hoje antes; sem rolagem horizontal em 390 px; widgets com altura pelo conteúdo; contadores compactos.
//   tipografia: faixas de tamanho a 100% e a 125%, Fraunces nos títulos, Inter nos controles e IBM Plex Mono nos identificadores, claro e escuro, contraste, títulos longos.
//   cadastro: Assunto no topo, Origem separada de Documento associado (tipo e número, exemplo 250/2026), sem campo de ano.
//   consulta: assunto como título, documento no cabeçalho, Tarefas e Descrição lado a lado no largo e uma sobre a outra no estreito (Tarefas primeiro), próxima tarefa marcada,
//     seções abaixo, rodapé sem cobrir o conteúdo, demanda sem documento e assunto longo.
// Sobe o próprio servidor na porta 7118. Nunca toca o Supabase real. Uso: node scripts/testar-visual.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';
import * as F from './clima-fixtures.mjs';

const PORTA = process.env.PORTA_TESTE_VISUAL || '7118', BASE = `http://localhost:${PORTA}`;
const PASTA = '.dados-teste/visual', CAPTURAS = '.dados-teste/visual-capturas';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });

const USUARIO = '00000000-0000-4000-8000-000000000001';
let HOJE = null;
const ASSUNTO_RICO = 'Parecer sobre o reajuste do contrato de limpeza urbana';
const ASSUNTO_LONGO = 'Levantamento completo das pendências de pagamento de diárias e adicionais dos servidores lotados nas escolas municipais durante o primeiro semestre, com conferência dos empenhos e da folha';
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  if (Number((await db.query("select extract(epoch from date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day' - (now() at time zone 'America/Sao_Paulo'))::int as s")).rows[0].s) < 2400) throw new Error('Faltam menos de 40 minutos para a meia-noite em Brasília: rode o teste depois da virada do dia.');
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a), dia = (n) => somarDias(HOJE, n);
  const mk = (assunto, o = {}) => c('criar_demanda', { p: { assunto, ...o } });
  const tarefas = async (d, textos, feitas = 0) => { for (let i = 0; i < textos.length; i++) { const r = await c('adicionar_tarefa', { p_demanda: d.id, p_texto: textos[i] }); if (i < feitas) await c('marcar_tarefa', { p_id: r.tarefas[i].id, p_concluida: true }); } };
  const rica = await mk(ASSUNTO_RICO, { tipo: 'Processo', numero: '250/2026', origem: 'Prefeita', chegou_em: dia(-12), prazo_original: dia(-2), setor: 'Procuradoria', acompanhar_em: dia(3), descricao: 'Reunir a planilha de custos, conferir o índice de reajuste previsto no contrato e pedir manifestação da Procuradoria antes de responder ao gabinete.' });
  await c('mover_etapa', { p_id: rica.id, p_etapa: 'Fazendo' });
  await tarefas(rica, ['Reunir a planilha de custos', 'Conferir o índice de reajuste', 'Pedir manifestação da Procuradoria', 'Conferir a vigência do aditivo', 'Levantar os empenhos', 'Redigir a resposta'], 2);
  const longa = await mk(ASSUNTO_LONGO, { origem: 'Pedido de colega', chegou_em: dia(-3), prazo_original: dia(9) });
  await tarefas(longa, ['Pedir a relação às escolas']);
  await mk('Resposta ao pedido de informação sobre horas extras', { tipo: 'Memorando', numero: '2026/250', origem: 'Reunião', prazo_original: dia(-6) });
  await mk('Ofício sobre a reforma do telhado da escola', { tipo: 'Ofício', numero: '32/2026', origem: 'Secretaria de Educação', prazo_original: HOJE });
  await db.query('insert into public.registros_dia (user_id, dia, humor) values ($1, $2, 4) on conflict do nothing', [USUARIO, HOJE]);
  await db.close();
}

let servidor = null;
const parar = () => { try { if (servidor) spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; };
process.on('exit', parar);
for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/login', { signal: AbortSignal.timeout(1500) }); } catch { break; } await new Promise((r) => setTimeout(r, 1000)); }
servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

let falhas = 0, total = 0;
const ok = (cond, m) => { total++; console.log((cond ? 'ok     ' : 'FALHOU ') + m); if (!cond) falhas++; };
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novo = async ({ w, h = 900, tema = 'claro', texto = 100, fraunces = false, toque = false }) => {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: toque, deviceScaleFactor: 1 });
  await ctx.addInitScript(([t, a]) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:aparencia', JSON.stringify(a)); localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'cards' })); } catch { /* sem armazenamento */ } }, [tema, { textoPct: texto, ...(fraunces ? { titulo: 'fraunces', texto: 'inter', mono: 'plex' } : {}) }]);
  await ctx.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, (rota) => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(new URL(rota.request().url()).hostname.startsWith('geocoding') ? F.resultados(F.TAQUARA_RS) : F.previsao({ hora: `${HOJE}T07:45`, data: HOJE })) }));
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
const estavel = (pg) => pg.waitForFunction(() => {
  const andando = document.getAnimations().some((a) => (a.playState === 'running' || a.playState === 'pending') && a.effect?.getComputedTiming().iterations !== Infinity);
  const e = document.querySelector('.app .main');
  if (andando || !e) return false;
  const r = e.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].map((x) => x.toFixed(1)).join();
  const ant = window.__estavelVis; window.__estavelVis = k; return ant === k;
}, null, { timeout: 20000, polling: 120 });
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando/.test(document.querySelector('.main')?.innerText ?? ''), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  if (rota === '/') await pg.waitForFunction(() => document.querySelector('[data-quadro="humor"] .ini-reg-v') && document.querySelector('.wg-clima[data-clima="ok"]') && document.querySelector('.ini-principal .dcard, .ini-principal .mini-card'), null, { timeout: 60000 }).catch(() => {});
  await estavel(pg);
};
const caixa = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; }, sel);
const tam = (pg, sel) => pg.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));
const fam = (pg, sel) => pg.$eval(sel, (e) => getComputedStyle(e).fontFamily);
const rolaX = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const abrirConsulta = async (pg, assunto) => { await pg.locator('.dcard', { hasText: assunto }).first().locator('.assunto').click(); await pg.waitForSelector('.modal.ed [data-secao]', { timeout: 15000 }); await estavel(pg); };
// contraste (WCAG) do texto de um elemento contra o fundo composto dos seus ancestrais
const contraste = (pg, sel) => pg.evaluate((s) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const el = document.querySelector(s); if (!el) return null;
  const pilha = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) pilha.push(c); if (c[3] >= 0.99) break; }
  let base = document.documentElement.dataset.tema === 'escuro' ? [10, 10, 10] : [242, 242, 247];
  for (const c of pilha.reverse()) base = base.map((v, i) => c[i] * c[3] + v * (1 - c[3]));
  const t = rgba(getComputedStyle(el).color), fg = t.slice(0, 3).map((v, i) => v * t[3] + base[i] * (1 - t[3]));
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const a = lum(fg), b = lum(base); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}, sel);

// ================= 1) Início no monitor largo =================
{
  const { ctx, pg } = await novo({ w: 1600, h: 900 });
  await ir(pg, '/');
  // Composição da decisão 64: duas colunas (demandas à esquerda, apoio à direita) numa área de até 1.680 px; título, contadores e Para hoje começam e terminam nas mesmas bordas da coluna da esquerda
  const cab = await caixa(pg, '.pagehead'), cont = await caixa(pg, '.ini-contadores'), grade = await caixa(pg, '.ini'), ph = await caixa(pg, '[data-painel="para-hoje"]'), busca = await caixa(pg, '.top .buscabtn');
  ok(grade && grade.w <= 1681 && cab.w <= 1681 && cont.w <= 1681, `Início 1600 px: a composição cabe na largura de até 1.680 px (${Math.round(cab.w)}, ${Math.round(cont.w)}, ${Math.round(grade.w)})`);
  ok(Math.abs(cab.l - cont.l) <= 3 && Math.abs(cont.l - ph.l) <= 1 && Math.abs(cont.r - ph.r) <= 1, 'Início 1600 px: título, contadores e Para hoje começam na mesma borda e terminam na mesma borda');
  ok(Math.abs(busca.l - cab.l) <= 14, `Início 1600 px: a busca do cabeçalho começa na mesma borda do conteúdo (${Math.round(busca.l)} e ${Math.round(cab.l)})`);
  const mainBox = await caixa(pg, '.app .main');
  ok(Math.abs((cab.l - mainBox.l) - (mainBox.r - grade.r)) <= 24, 'Início 1600 px: a composição fica centralizada na área de conteúdo');
  const pr = await caixa(pg, '.ini-principal'), ap = await caixa(pg, '.ini-apoio');
  ok(ap.l >= pr.r - 1 && ap.w >= 260 && ap.w <= 340 && pr.w > ap.w * 2.5, `Início 1600 px: o apoio é uma coluna estreita à direita e as demandas ocupam o resto (${Math.round(pr.w)} e ${Math.round(ap.w)} px)`);
  const ordem = await pg.evaluate(() => !!(document.querySelector('.ini-principal').compareDocumentPosition(document.querySelector('.ini-apoio')) & Node.DOCUMENT_POSITION_FOLLOWING));
  ok(ordem, 'Início: Para hoje vem antes de Humor e Clima na ordem do documento');
  const hum = await caixa(pg, '[data-quadro="humor"] .painel'), wg = await caixa(pg, '.ini-apoio .wg-clima');
  ok(!!hum && !!wg && wg.h < wg.w && hum.h < 200, `Início 1600 px: Humor e Clima têm altura pelo conteúdo (Humor ${Math.round(hum?.h)} px, Clima ${Math.round(wg?.w)} por ${Math.round(wg?.h)} px, sem quadrado fixo)`);
  const st = await pg.$$eval('.ini-contadores .stat', (l) => l.map((s) => { const r = s.getBoundingClientRect(), n = s.querySelector('.n').getBoundingClientRect(), t = s.querySelector('.r').getBoundingClientRect(); return { h: r.height, mesmaLinha: Math.abs(n.top + n.height / 2 - (t.top + t.height / 2)) < 12, perto: t.left - n.right < 40 }; }));
  ok(st.length === 3 && st.every((x) => x.h <= 70 && x.mesmaLinha && x.perto), 'Início 1600 px: os três contadores são compactos, com número e rótulo na mesma linha e próximos');
  ok((await pg.$$('.ini-contadores .stat[aria-pressed]')).length === 3, 'Início: os contadores seguem sendo botões com estado (aria-pressed)');
  await pg.click('.ini-contadores .st-atrasadas'); await pg.waitForSelector('.ini-prazos .cards .dcard');
  ok((await pg.getAttribute('.ini-contadores .st-atrasadas', 'aria-pressed')) === 'true', 'Início: clicar num contador abre a lista daquele prazo, como antes');
  await pg.screenshot({ path: `${CAPTURAS}/inicio-1600.png`, fullPage: false });
  ok(await rolaX(pg) <= 1, 'Início 1600 px: sem rolagem horizontal');
  await ctx.close();
}

// ================= 2) Início em larguras menores: empilha com Para hoje antes =================
// (com o menu lateral aberto, que é o padrão, as duas colunas pedem cerca de 1.500 px de janela; abaixo disso o apoio fica sob as demandas)
for (const [nome, w, esperaEmpilhar] of [['notebook 1280', 1280, true], ['notebook estreito 1024', 1024, true], ['tablet 820', 820, true], ['celular 390', 390, true]]) {
  const { ctx, pg } = await novo({ w, h: 900, toque: w < 900 });
  await ir(pg, '/');
  const pr = await caixa(pg, '.ini-principal'), ap = await caixa(pg, '.ini-apoio');
  if (esperaEmpilhar) ok(ap.t >= pr.b - 1, `Início ${nome} px: Humor e Clima vêm abaixo de Para hoje (apoio a ${Math.round(ap.t)} px, principal termina em ${Math.round(pr.b)})`);
  else ok(ap.l >= pr.r - 1, `Início ${nome} px: ainda em duas colunas, Para hoje à esquerda`);
  ok(await rolaX(pg) <= 1, `Início ${nome} px: sem rolagem horizontal`);
  if (w === 390) { const st = await pg.$$eval('.ini-contadores .stat', (l) => l.map((s) => s.getBoundingClientRect().width)); ok(st.length === 3 && Math.max(...st) - Math.min(...st) < 2, 'Início 390 px: os três contadores cabem lado a lado'); }
  await pg.screenshot({ path: `${CAPTURAS}/inicio-${w}.png` });
  await ctx.close();
}

// ================= 3) Configurações =================
for (const [nome, w] of [['1800', 1800], ['1360', 1360], ['390', 390]]) {
  const { ctx, pg } = await novo({ w, h: 900, toque: w < 900 });
  await ir(pg, '/config');
  const cab = await caixa(pg, '.pagehead'), cfg = await caixa(pg, '.cfg'), busca = await caixa(pg, '.top .buscabtn');
  if (w >= 900) ok(cfg.w <= 1201 && Math.abs(cab.l - cfg.l) <= 1 && Math.abs(busca.l - cab.l) <= 14, `Configurações ${nome} px: conteúdo de no máximo 1.200 px, título e blocos na mesma borda e busca alinhada (${Math.round(cfg.w)} px)`);
  const lado = await caixa(pg, '.cfg-lado'), ctl = await caixa(pg, '.cfg-controles');
  if (w >= 900) ok(lado.l >= ctl.r - 1 && Math.abs(lado.t - ctl.t) < 8, `Configurações ${nome} px: a prévia fica ao lado dos controles`);
  else ok(lado.t >= ctl.b - 1, 'Configurações 390 px: a prévia fica abaixo dos controles');
  const pal = await pg.$$eval('.cfg-topo .pal .sw', (l) => [...new Set(l.map((s) => Math.round(s.getBoundingClientRect().top)))].length);
  ok(pal >= 2, `Configurações ${nome} px: a paleta é mostrada em linhas (${pal} linhas)`);
  const faixa = await pg.$$eval('.cfg .rng', (l) => Math.max(...l.map((s) => s.getBoundingClientRect().width)));
  ok(faixa <= 521, `Configurações ${nome} px: os controles deslizantes têm largura limitada (${Math.round(faixa)} px)`);
  ok(await rolaX(pg) <= 1, `Configurações ${nome} px: sem rolagem horizontal`);
  await pg.screenshot({ path: `${CAPTURAS}/config-${w}.png` });
  await ctx.close();
}

// ================= 4) tipografia: faixas de tamanho a 100% e a 125%, claro e escuro =================
const FAIXAS = [['.pagehead h1', 28, 32, 'título de página'], ['.ini-principal .sec > h3', 18, 20, 'título de seção'], ['.pagehead p', 14, 16, 'texto de leitura']];
for (const [tema, texto] of [['claro', 100], ['escuro', 100], ['claro', 125]]) {
  const { ctx, pg } = await novo({ w: 1600, h: 900, tema, texto });
  await ir(pg, '/');
  const k = texto / 100;
  for (const [sel, mi, ma, rot] of FAIXAS) { const t = await tam(pg, sel); ok(t >= mi * k - 0.3 && t <= ma * k + 0.3, `${rot} em ${tema}, texto ${texto}%: ${t.toFixed(1)} px (faixa ${mi * k} a ${ma * k})`); }
  await pg.goto(BASE + '/demandas'); await pg.waitForSelector('.dcard .assunto');
  await abrirConsulta(pg, ASSUNTO_RICO).catch(() => {});
  if (await pg.$('.modal.ed')) {
    const leit = await tam(pg, '.modal .ler dd'), meta = await tam(pg, '.modal .cons-doc');
    ok(leit >= 14 * k - 0.3 && leit <= 16 * k + 0.3, `texto de leitura da consulta em ${tema}, texto ${texto}%: ${leit.toFixed(1)} px`);
    ok(meta >= 12 * k - 0.3 && meta <= 13.5 * k + 0.3, `metadado (documento) da consulta em ${tema}, texto ${texto}%: ${meta.toFixed(1)} px`);
    for (const sel of ['.modal.ed .m-assunto', '.modal .cons-doc']) { const c = await contraste(pg, sel); ok(c !== null && c >= 4.5, `contraste de ${sel} em ${tema}: ${c?.toFixed(1)}:1`); }
  } else ok(false, `a consulta abriu em ${tema}, texto ${texto}%`);
  await ctx.close();
}
{
  const a = await novo({ w: 1600, h: 900, texto: 100 }), b = await novo({ w: 1600, h: 900, texto: 125 });
  await ir(a.pg, '/'); await ir(b.pg, '/');
  const r = (await tam(b.pg, '.pagehead h1')) / (await tam(a.pg, '.pagehead h1'));
  ok(Math.abs(r - 1.25) < 0.02, `o ajuste de tamanho do texto continua mandando: título de página ${r.toFixed(2)} vezes maior a 125%`);
  await a.ctx.close(); await b.ctx.close();
}

// ================= 5) fontes: conjunto Fraunces, Inter e IBM Plex Mono e o padrão =================
{
  const p = await novo({ w: 1600, h: 900 });
  await ir(p.pg, '/'); await p.pg.goto(BASE + '/demandas'); await p.pg.waitForSelector('.dcard .assunto');
  await abrirConsulta(p.pg, ASSUNTO_RICO);
  ok(/inter/i.test(await fam(p.pg, '.modal.ed .m-assunto')) && !/fraunces/i.test(await fam(p.pg, '.modal.ed .m-assunto')), 'padrão: o assunto da consulta segue na fonte de título padrão (Inter), sem mudar a preferência do usuário');
  await p.ctx.close();
  const f = await novo({ w: 1600, h: 900, fraunces: true });
  await ir(f.pg, '/');
  ok(/fraunces/i.test(await fam(f.pg, '.pagehead h1')) && /inter/i.test(await fam(f.pg, '.ini-contadores .stat .r')) && /inter/i.test(await fam(f.pg, '.btn.mini')) && /plex/i.test(await fam(f.pg, '.ini-principal .dcard .mono, .ini-principal .mini-card .mono, .ini-principal .num')), 'conjunto Fraunces, Inter e IBM Plex Mono: Fraunces no título da página, Inter nos controles e nos rótulos, IBM Plex Mono nos identificadores');
  await f.pg.goto(BASE + '/demandas'); await f.pg.waitForSelector('.dcard .assunto');
  await abrirConsulta(f.pg, ASSUNTO_RICO);
  ok(/fraunces/i.test(await fam(f.pg, '.modal.ed .m-assunto')) && /plex/i.test(await fam(f.pg, '.modal .cons-doc')) && /inter/i.test(await fam(f.pg, '.modal .m-f .btn')), 'conjunto Fraunces: o assunto da demanda aberta em Fraunces, o documento em IBM Plex Mono e os botões do rodapé em Inter');
  await f.pg.screenshot({ path: `${CAPTURAS}/consulta-fraunces.png` });
  await f.ctx.close();
}

// ================= 6) Nova demanda =================
{
  const { ctx, pg } = await novo({ w: 1360, h: 900 });
  await ir(pg, '/demandas');
  await pg.locator('.toolbar .btn.escuro').first().click(); await pg.waitForSelector('#n-assunto');
  const ass = await caixa(pg, '#n-assunto'), ori = await caixa(pg, '#n-origem'), doc = await caixa(pg, '.grp-doc'), tipo = await caixa(pg, '#n-tipo'), num = await caixa(pg, '#n-num');
  ok(ass.t < ori.t && ori.t < doc.t, 'cadastro: Assunto primeiro, depois Origem da solicitação e, separado, o Documento associado');
  ok(tipo.l < num.l && Math.abs(tipo.t - num.t) < 10 && tipo.t >= doc.t && num.b <= doc.b, 'cadastro: Tipo e Número do documento lado a lado dentro do bloco do documento');
  ok((await pg.getAttribute('#n-num', 'placeholder')) === 'Ex.: 250/2026' && /Número do documento/.test(await pg.textContent('label[for="n-num"]')), 'cadastro: o campo se chama Número do documento e traz o exemplo 250/2026');
  ok(!(await pg.$('#n-ano')) && !/Ano do documento/.test(await pg.textContent('.modal')), 'cadastro: não existe o campo Ano do documento');
  ok((await pg.$$('.modal .fld > label small')).length >= 2 && /obrigatório/.test(await pg.textContent('label[for="n-assunto"]')) && !/obrigatório/.test(await pg.textContent('.modal .grp-doc')), 'cadastro: só o assunto é obrigatório');
  await pg.screenshot({ path: `${CAPTURAS}/cadastro-1360.png` });
  await ctx.close();
}

// ================= 7a) Consulta da demanda (decisão 68): assunto longo com texto a 125% no celular e janela baixa =================
{
  const { ctx, pg } = await novo({ w: 390, h: 844, texto: 125, toque: true });
  await ir(pg, '/demandas'); await pg.locator('button', { hasText: /^Lista$/ }).first().evaluate((b) => b.click()); await pg.waitForSelector('.lista-dem .linha'); // no celular a visão Cards é um baralho: a Lista tem todas as demandas
  await pg.locator('.lista-dem .linha', { hasText: ASSUNTO_LONGO }).locator('.ld-abrir').tap(); await pg.waitForSelector('.modal.ed [data-secao]'); await estavel(pg);
  const t = await pg.evaluate(() => { const m = document.querySelector('.modal'), Q = (e) => e.getBoundingClientRect(), h = m.querySelector('#m-tit'), b = m.querySelector('.m-barra'), c = m.querySelector('.m-corpo'), cs = getComputedStyle(h);
    return { texto: h.textContent, inteiro: h.scrollWidth <= h.clientWidth + 1 && h.scrollHeight <= h.clientHeight + 1, elipse: cs.textOverflow, clamp: cs.webkitLineClamp, abaixo: Q(h).top >= Q(b).bottom - 1, largura: Q(h).width, util: c.clientWidth - 48, linhas: Math.round(Q(h).height / parseFloat(cs.lineHeight)),
      rolaX: Math.max(document.documentElement.scrollWidth - innerWidth, c.scrollWidth - c.clientWidth), maior: [...m.querySelectorAll('.m-corpo *')].every((e) => e === h || parseFloat(getComputedStyle(e).fontSize) < parseFloat(cs.fontSize)),
      botoes: [...b.querySelectorAll('button')].every((x) => Q(x).top >= Q(m).top + 8 && Q(x).bottom <= Q(h).top + 1) }; });
  ok(t.texto === ASSUNTO_LONGO && t.inteiro && t.elipse === 'clip' && t.clamp === 'none', `consulta 390 px a 125%: o assunto longo aparece inteiro, sem reticências nem corte (${t.linhas} linhas)`);
  ok(t.abaixo && t.botoes && Math.abs(t.largura - t.util) <= 2, `consulta 390 px a 125%: o assunto ocupa a largura útil (${Math.round(t.largura)} de ${t.util} px) e não divide a linha com os controles`);
  ok(t.rolaX <= 1 && t.maior, 'consulta 390 px a 125%: sem rolagem horizontal, e o assunto é o maior texto da janela');
  await ctx.close();
}
for (const [nome, w, h] of [['desktop baixo', 1366, 500], ['celular baixo', 390, 600]]) {
  const { ctx, pg } = await novo({ w, h, toque: w < 600 });
  await ir(pg, '/demandas'); await pg.locator('button', { hasText: /^Lista$/ }).first().evaluate((b) => b.click()); await pg.waitForSelector('.lista-dem .linha'); // no celular a visão Cards é um baralho: a Lista tem todas as demandas
  await pg.locator('.lista-dem .linha', { hasText: ASSUNTO_RICO }).locator('.ld-abrir').click(); await pg.waitForSelector('.modal.ed [data-secao]'); await estavel(pg);
  const medir = () => pg.evaluate(() => { const m = document.querySelector('.modal'), Q = (e) => e.getBoundingClientRect(), b = m.querySelector('.m-barra'), f = m.querySelector('.m-f'), c = m.querySelector('.m-corpo');
    return { barra: Q(b).top - Q(m).top, rodape: Q(m).bottom - Q(f).bottom, dentro: Q(m).top >= 0 && Q(m).bottom <= innerHeight + 1, rola: c.scrollHeight - c.clientHeight, topo: c.scrollTop, ultima: Q(m.querySelector('[data-secao="identificacao"]')).bottom <= Q(f).top + 1, assunto: Q(m.querySelector('#m-tit')).top >= Q(b).bottom - 1 }; });
  const a = await medir();
  ok(a.dentro && Math.abs(a.barra) <= 1 && Math.abs(a.rodape) <= 1 && a.topo === 0 && a.assunto && a.rola > 0, `consulta em janela baixa (${nome}, ${w} x ${h}): abre com a barra e o rodapé à vista, o assunto no início e o corpo rolável`);
  await pg.$eval('.modal .m-corpo', (c) => { c.scrollTop = c.scrollHeight; });
  const z = await medir();
  ok(Math.abs(z.barra) <= 1 && Math.abs(z.rodape) <= 1 && z.ultima, `consulta em janela baixa (${nome}): ao rolar até o fim, barra e rodapé continuam no lugar e a última seção fica acima do rodapé`);
  await ctx.close();
}

// ================= 7) Consulta da demanda: largo, estreito, sem documento, assunto longo =================
{
  const { ctx, pg } = await novo({ w: 1600, h: 900 });
  await ir(pg, '/demandas'); await abrirConsulta(pg, ASSUNTO_RICO);
  ok((await pg.textContent('.modal.ed .m-assunto')) === ASSUNTO_RICO, 'consulta: o assunto é o título da janela');
  ok((await pg.textContent('.modal .cons-doc')).trim() === 'Processo 250/2026', 'consulta: o documento (tipo e número) aparece como referência secundária no cabeçalho');
  const chips = (await pg.textContent('.modal .cons-cab .resumo-chips')) ?? '';
  ok(/Fazendo/.test(chips) && /^\s*Venceu em \d+ [a-z]{3} · há \d+ dias?/.test(chips) && !!(await pg.$('.modal .cons-cab [data-resumo-prazo].venc')) && !!(await pg.$('.modal .cons-cab [data-selo-prioridade]')), 'consulta: o vencimento efetivo (em vermelho, por estar vencida e aberta) vem primeiro no resumo, com a etapa e a prioridade da Prefeita');
  ok((chips.match(/há \d+ dias?/g) ?? []).length === 1 && !/vencida há/.test((await pg.textContent('[data-secao="chegada"] .ler')) ?? '') && !(await pg.$('.modal .cons-cab .selo')), 'consulta: a situação do prazo aparece uma vez só (no resumo) e o tipo do prazo fica em Chegada e prazo');
  const prazoLido = (await pg.textContent('[data-secao="chegada"] .ler')) ?? '';
  ok(/Vencimento\s*(seg|ter|qua|qui|sex|sáb|dom), \d{2}\/\d{2}\/\d{4}/.test(prazoLido) && /Tipo de prazo/.test(prazoLido), 'consulta: Chegada e prazo mantém a data completa do vencimento e o tipo');
  // três regiões posicionadas pelo layout (decisão 68): barra de controles, corpo que rola e rodapé
  const reg = await pg.evaluate(() => {
    const m = document.querySelector('.modal'), Q = (e) => e.getBoundingClientRect(), b = m.querySelector('.m-barra'), c = m.querySelector('.m-corpo'), f = m.querySelector('.m-f'), t = m.querySelector('#m-tit'), cs = (e) => getComputedStyle(e);
    const ids = [...m.querySelectorAll('[id]')].map((e) => e.id);
    return { fechar: Q(b.querySelector('[aria-label="Fechar"]')).top - Q(m).top, mais: Q(b.querySelector('.m-mais')).top - Q(m).top, pos: [cs(b).position, cs(f).position].join(), margens: [cs(b).marginTop, cs(f).marginTop, cs(f).marginBottom, cs(f).marginLeft].join(),
      tituloAbaixo: Q(t).top >= Q(b).bottom - 1, tituloNoCorpo: c.firstElementChild === t, rolagem: c.scrollTop, corpo: cs(c).overflowY, janela: cs(m).overflowY, rotulo: m.getAttribute('aria-labelledby'),
      foco: m.contains(document.activeElement) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName), lapis: m.querySelectorAll('[data-lapis]').length, repetidos: ids.filter((v, i) => ids.indexOf(v) !== i).length, contagem: m.querySelector('[data-secao="tarefas"] .sec-h [data-contagem]')?.textContent ?? '' };
  });
  ok(reg.fechar >= 8 && reg.mais >= 8 && reg.tituloAbaixo && reg.tituloNoCorpo && reg.rolagem === 0 && reg.rotulo === 'm-tit', `consulta: Fechar e o menu de ações inteiros dentro da janela (${Math.round(reg.fechar)} px do topo) e o assunto no início do corpo, abaixo da barra`);
  ok(reg.pos === 'static,static' && reg.margens === '0px,0px,0px,0px' && reg.corpo === 'auto' && reg.janela === 'hidden', `consulta: barra e rodapé posicionados pelo layout, sem sticky nem margem negativa, e só o corpo rola (${reg.pos}; ${reg.margens})`);
  ok(reg.foco, 'consulta: ao abrir, o foco fica dentro da janela e em nenhum campo (não abre o teclado)');
  ok(reg.lapis === 5 && reg.repetidos === 0 && /^\d+ de \d+ concluídas$/.test(reg.contagem), `consulta: cinco lápis, nenhum id repetido e a contagem ao lado do título de Tarefas (${reg.contagem})`);
  const ident = (await pg.textContent('[data-secao="identificacao"] .ler')) ?? '';
  ok(!/250\/2026|Processo/.test(ident) && /Prefeita/.test(ident), 'consulta: a leitura da Identificação não repete tipo e número');
  const ordem = await pg.$$eval('.modal [data-secao]', (l) => l.map((e) => e.dataset.secao).join());
  ok(ordem === 'tarefas,descricao,chegada,andamento,identificacao', `consulta: ordem das seções Tarefas, Descrição, Chegada e prazo, Andamento, Identificação (${ordem})`);
  const tar = await caixa(pg, '[data-secao="tarefas"]'), des = await caixa(pg, '[data-secao="descricao"]'), che = await caixa(pg, '[data-secao="chegada"]');
  ok(Math.abs(tar.l - des.l) < 2 && des.t >= tar.b - 1 && tar.r <= che.l + 2 && Math.abs(tar.t - che.t) < 8 && tar.w > che.w * 1.3, `consulta 1600 px: Tarefas e Descrição na coluna principal (mais larga) e a consulta ao lado (${Math.round(tar.w)} e ${Math.round(che.w)} px)`);
  const prox = await pg.$eval('.modal [data-proxima]', (e) => e.textContent);
  ok(/Pedir manifestação da Procuradoria/.test(prox) && /Próxima/.test(prox) && (await pg.$$('.modal [data-proxima]')).length === 1, 'consulta: a próxima tarefa pendente está marcada, e só ela');
  const rod = await caixa(pg, '.modal .m-f'), ult = await pg.evaluate(() => { const m = document.querySelector('.modal .m-corpo'); m.scrollTop = m.scrollHeight; return document.querySelector('[data-secao="identificacao"]').getBoundingClientRect().bottom; });
  ok(ult <= (await caixa(pg, '.modal .m-f')).t + 1, `consulta: ao rolar até o fim, o rodapé não cobre a última seção (${Math.round(ult)} e ${Math.round(rod.t)})`);
  ok((await pg.isVisible('.modal .m-f .btn:has-text("Fechar")')) && (await pg.isVisible('.modal .m-f .btn.pri:has-text("Concluir demanda")')) && (await pg.$$('.modal .m-f .btn')).length === 2, 'consulta: o rodapé tem só Fechar e Concluir demanda');
  await pg.click('.modal .m-barra .m-mais'); await pg.waitForSelector('.mv-menu');
  const itensMenu = await pg.$$eval('.mv-menu [role="menuitem"]', (l) => l.map((b) => b.textContent.trim() + (b.getAttribute('aria-disabled') ? '!' : '')));
  ok(itensMenu.join() === 'Arquivar,Excluir' && (await pg.getAttribute('.modal .m-mais', 'aria-expanded')) === 'true', `consulta: Arquivar e Excluir ficam no menu de mais ações da barra (${itensMenu.join()})`);
  await pg.click('.mv-menu [role="menuitem"]:has-text("Excluir")'); await pg.waitForSelector('.modal .m-f .btn.perigo');
  ok(await pg.evaluate(() => document.activeElement?.textContent === 'Cancelar' && !!document.activeElement.closest('.m-f')), 'consulta: Excluir pede confirmação no rodapé, com o foco em Cancelar');
  await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal .m-f .btn.pri:has-text("Concluir demanda")');
  ok(!(await pg.$('.modal .m-f .btn.perigo')) && !!(await pg.$('.modal.ed')) && (await pg.waitForFunction(() => document.activeElement?.classList.contains('m-mais'), null, { timeout: 3000 }).then(() => true, () => false)), 'consulta: Cancelar desfaz a confirmação, nada é excluído e o foco volta ao menu de mais ações');
  await pg.screenshot({ path: `${CAPTURAS}/consulta-1600.png` });
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'));
  await abrirConsulta(pg, ASSUNTO_LONGO);
  ok(!(await pg.$('.modal .cons-doc')), 'consulta: demanda sem documento não mostra a linha do documento');
  const resumoLongo = await pg.$eval('.modal .cons-cab [data-resumo-prazo]', (e) => ({ t: e.textContent, venc: e.classList.contains('venc') }));
  ok(/^Vence em \d+ [a-z]{3} · faltam \d+ dias?$/.test(resumoLongo.t) && !resumoLongo.venc, `consulta: prazo a vencer no resumo, sem vermelho (${resumoLongo.t})`);
  // descrição vazia: "Adicionar descrição" abre o mesmo editor do lápis (e Cancelar descarta); com a seção aberta, Arquivar fica bloqueado
  await pg.click('.modal [data-adicionar="descricao"]'); await pg.waitForSelector('[data-secao="descricao"] textarea');
  ok(await pg.evaluate(() => document.activeElement?.tagName === 'TEXTAREA' && document.querySelectorAll('[data-secao="descricao"] .sec-acoes .btn').length === 2 && document.querySelectorAll('.modal [data-lapis][aria-disabled="true"]').length === 4), 'consulta: Adicionar descrição abre o editor da seção com Cancelar e Salvar, foca o campo e trava os outros lápis');
  await pg.keyboard.type('texto ainda não salvo');
  await pg.click('.modal .m-barra .m-mais'); await pg.waitForSelector('.mv-menu');
  await pg.$eval('.mv-menu [role="menuitem"]', (b) => b.click()); await pg.waitForTimeout(300);
  ok((await pg.getAttribute('.mv-menu [role="menuitem"]', 'aria-disabled')) === 'true' && !!(await pg.$('.modal.ed')) && (await pg.isDisabled('.modal .m-f .btn.pri')), 'consulta: com edição não salva, Arquivar fica bloqueado no menu e Concluir no rodapé');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.mv-menu'));
  await pg.click('[data-secao="descricao"] .sec-acoes .btn:has-text("Cancelar")'); await pg.waitForSelector('.modal [data-adicionar="descricao"]');
  const h3 = await pg.$eval('.modal.ed .m-assunto', (e) => ({ sw: e.scrollWidth, cw: e.clientWidth, h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) }));
  ok(h3.sw <= h3.cw + 1 && h3.h >= h3.lh * 1.9, `consulta: assunto longo quebra em linhas sem estourar (${Math.round(h3.h / h3.lh)} linhas)`);
  // sem tarefas e vencendo hoje: "Adicionar tarefa" abre o editor de tarefas; o resumo não usa vermelho
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'));
  await abrirConsulta(pg, 'Ofício sobre a reforma do telhado da escola');
  const hojeResumo = await pg.$eval('.modal .cons-cab [data-resumo-prazo]', (e) => ({ t: e.textContent, venc: e.classList.contains('venc') }));
  ok(/^Vence hoje · \d+ [a-z]{3}$/.test(hojeResumo.t) && !hojeResumo.venc && (await pg.textContent('.modal .cons-doc')).trim() === 'Ofício 32/2026', `consulta: vencendo hoje, o resumo avisa sem vermelho (${hojeResumo.t})`);
  ok(!(await pg.$('.modal [data-contagem]')) && /Nenhuma tarefa cadastrada/.test(await pg.textContent('[data-secao="tarefas"]')), 'consulta: sem tarefas, não há contagem e a seção diz que não há tarefa cadastrada');
  await pg.click('.modal [data-adicionar="tarefas"]'); await pg.waitForSelector('[data-secao="tarefas"] .sec-acoes');
  ok(await pg.evaluate(() => document.activeElement?.tagName === 'INPUT' && !!document.activeElement.closest('[data-secao="tarefas"]') && document.querySelectorAll('[data-secao="tarefas"] .sec-acoes .btn').length === 2), 'consulta: Adicionar tarefa abre o editor de tarefas da seção, com o foco no campo da nova tarefa');
  await pg.click('[data-secao="tarefas"] .sec-acoes .btn:has-text("Cancelar")'); await pg.waitForSelector('.modal [data-adicionar="tarefas"]');
  await ctx.close();
}
for (const [nome, w] of [['celular 390', 390], ['tablet 820', 820]]) {
  const { ctx, pg } = await novo({ w, h: 844, toque: true });
  await ir(pg, '/demandas'); await abrirConsulta(pg, ASSUNTO_RICO);
  const tar = await caixa(pg, '[data-secao="tarefas"]'), des = await caixa(pg, '[data-secao="descricao"]');
  ok(tar.t < des.t && des.t >= tar.b - 1, `consulta ${nome} px: Tarefas primeiro e Descrição abaixo`);
  ok(await rolaX(pg) <= 1 && (await pg.evaluate(() => { const m = document.querySelector('.modal'), c = m.querySelector('.m-corpo'); return m.scrollWidth <= m.clientWidth + 1 && c.scrollWidth <= c.clientWidth + 1; })), `consulta ${nome} px: sem rolagem horizontal`);
  const cols = await pg.$eval('.modal .cons-grade', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length), largCorpo = await pg.$eval('.modal .m-corpo', (e) => e.clientWidth - 48);
  ok(cols === (largCorpo >= 720 ? 2 : 1), `consulta ${nome} px: a grade empilha pela largura interna da janela (${largCorpo} px internos, ${cols} ${cols === 1 ? 'coluna' : 'colunas'})`);
  const topo = await pg.evaluate(() => { const m = document.querySelector('.modal'), Q = (e) => e.getBoundingClientRect(); return { fechar: Q(m.querySelector('.m-barra [aria-label="Fechar"]')).top - Q(m).top, mais: Q(m.querySelector('.m-barra .m-mais')).top - Q(m).top, titulo: Q(m.querySelector('#m-tit')).top - Q(m.querySelector('.m-barra')).bottom }; });
  ok(topo.fechar >= 8 && topo.mais >= 8 && topo.titulo >= -1, `consulta ${nome} px: Fechar e o menu inteiros dentro da janela e o assunto abaixo da barra (${Math.round(topo.fechar)} px do topo)`);
  const rod = await pg.evaluate(() => { const m = document.querySelector('.modal .m-corpo'); m.scrollTop = m.scrollHeight; const f = document.querySelector('.modal .m-f').getBoundingClientRect(), u = document.querySelector('[data-secao="identificacao"]').getBoundingClientRect(); return { fT: f.top, fB: f.bottom, uB: u.bottom, vh: innerHeight }; });
  ok(rod.uB <= rod.fT + 1 && rod.fB <= rod.vh + 1, `consulta ${nome} px: o rodapé cabe na tela e não cobre a última seção`);
  // confirmação de exclusão em tela estreita: o rodapé quebra em linhas e tudo cabe na janela
  await pg.click('.modal .m-barra .m-mais'); await pg.click('.mv-menu [role="menuitem"]:has-text("Excluir")'); await pg.waitForSelector('.modal .m-f .btn.perigo');
  const conf = await pg.evaluate(() => { const m = document.querySelector('.modal'), f = m.querySelector('.m-f'), Q = (e) => e.getBoundingClientRect(); return { cabe: [...f.children].filter((e) => e.getClientRects().length).every((e) => Q(e).left >= Q(m).left - 1 && Q(e).right <= Q(m).right + 1 && Q(e).bottom <= Q(m).bottom + 1), corta: [...f.querySelectorAll('.btn')].some((b) => b.scrollWidth > b.clientWidth + 1), rodape: Q(f).bottom <= innerHeight + 1 }; });
  ok(conf.cabe && !conf.corta && conf.rodape, `consulta ${nome} px: a confirmação de exclusão cabe no rodapé, sem botão cortado`);
  await pg.click('.modal .m-f .btn:has-text("Cancelar")'); await pg.waitForSelector('.modal .m-f .btn.pri');
  const btn = await pg.$$eval('.modal .m-f .btn', (l) => l.filter((b) => b.getClientRects().length).map((b) => ({ mini: b.classList.contains('mini'), h: b.getBoundingClientRect().height })));
  ok(btn.filter((b) => !b.mini).length >= 2 && btn.filter((b) => !b.mini).every((b) => b.h >= 36) && btn.filter((b) => b.mini).every((b) => b.h >= 30), `consulta ${nome} px: Fechar e Concluir com altura de toque (${btn.map((b) => Math.round(b.h)).join(', ')})`);
  await pg.screenshot({ path: `${CAPTURAS}/consulta-${w}.png` });
  await ctx.close();
}

ok(erros.length === 0, `sem erros de página nem de console (${erros.length})${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
await nav.close(); parar();
console.log(falhas ? `${falhas} de ${total} verificações falharam.` : `Tudo certo: ${total} verificações.`);
console.log(`Capturas para olhar: ${CAPTURAS}`);
process.exit(falhas ? 1 : 0);
