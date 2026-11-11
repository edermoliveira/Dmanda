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
  const cab = await caixa(pg, '.pagehead'), cont = await caixa(pg, '.ini-contadores'), grade = await caixa(pg, '.ini-grade'), busca = await caixa(pg, '.top .buscabtn');
  ok(grade && grade.w <= 1201 && cab.w <= 1201 && cont.w <= 1201, `Início 1600 px: título, contadores e grade têm no máximo 1.200 px (${Math.round(cab.w)}, ${Math.round(cont.w)}, ${Math.round(grade.w)})`);
  ok(Math.abs(cab.l - cont.l) <= 1 && Math.abs(cont.l - grade.l) <= 1 && Math.abs(cont.r - grade.r) <= 1, 'Início 1600 px: título, contadores e painéis começam na mesma borda e terminam na mesma borda');
  ok(Math.abs(busca.l - cab.l) <= 14, `Início 1600 px: a busca do cabeçalho começa na mesma borda do conteúdo (${Math.round(busca.l)} e ${Math.round(cab.l)})`);
  const mainBox = await caixa(pg, '.app .main');
  ok(Math.abs((cab.l - mainBox.l) - (mainBox.r - cont.r)) <= 24, 'Início 1600 px: a coluna fica centralizada na área de conteúdo');
  const pr = await caixa(pg, '.ini-principal'), ap = await caixa(pg, '.ini-apoio');
  ok(ap.l >= pr.r - 1 && pr.w / ap.w > 1.7 && pr.w / ap.w < 2.4, `Início 1600 px: Para hoje ocupa cerca de dois terços e o apoio um terço (${Math.round(pr.w)} e ${Math.round(ap.w)} px)`);
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
for (const [nome, w, esperaEmpilhar] of [['notebook 1280', 1280, false], ['notebook estreito 1024', 1024, true], ['tablet 820', 820, true], ['celular 390', 390, true]]) {
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
    for (const sel of ['.modal.ed .m-h h3', '.modal .cons-doc']) { const c = await contraste(pg, sel); ok(c !== null && c >= 4.5, `contraste de ${sel} em ${tema}: ${c?.toFixed(1)}:1`); }
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
  ok(/inter/i.test(await fam(p.pg, '.modal.ed .m-h h3')) && !/fraunces/i.test(await fam(p.pg, '.modal.ed .m-h h3')), 'padrão: o assunto da consulta segue na fonte de título padrão (Inter), sem mudar a preferência do usuário');
  await p.ctx.close();
  const f = await novo({ w: 1600, h: 900, fraunces: true });
  await ir(f.pg, '/');
  ok(/fraunces/i.test(await fam(f.pg, '.pagehead h1')) && /inter/i.test(await fam(f.pg, '.ini-contadores .stat .r')) && /inter/i.test(await fam(f.pg, '.btn.mini')) && /plex/i.test(await fam(f.pg, '.ini-principal .dcard .mono, .ini-principal .mini-card .mono, .ini-principal .num')), 'conjunto Fraunces, Inter e IBM Plex Mono: Fraunces no título da página, Inter nos controles e nos rótulos, IBM Plex Mono nos identificadores');
  await f.pg.goto(BASE + '/demandas'); await f.pg.waitForSelector('.dcard .assunto');
  await abrirConsulta(f.pg, ASSUNTO_RICO);
  ok(/fraunces/i.test(await fam(f.pg, '.modal.ed .m-h h3')) && /plex/i.test(await fam(f.pg, '.modal .cons-doc')) && /inter/i.test(await fam(f.pg, '.modal .m-f .btn')), 'conjunto Fraunces: o assunto da demanda aberta em Fraunces, o documento em IBM Plex Mono e os botões do rodapé em Inter');
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

// ================= 7) Consulta da demanda: largo, estreito, sem documento, assunto longo =================
{
  const { ctx, pg } = await novo({ w: 1600, h: 900 });
  await ir(pg, '/demandas'); await abrirConsulta(pg, ASSUNTO_RICO);
  ok((await pg.textContent('.modal.ed .m-h h3')) === ASSUNTO_RICO, 'consulta: o assunto é o título da janela');
  ok((await pg.textContent('.modal .cons-doc')).trim() === 'Processo 250/2026', 'consulta: o documento (tipo e número) aparece como referência secundária no cabeçalho');
  const chips = (await pg.textContent('.modal .cons-cab .resumo-chips')) ?? '';
  ok(/Fazendo/.test(chips) && /Prazo vencido/.test(chips) && !!(await pg.$('.modal .cons-cab [data-selo-prioridade]')), 'consulta: etapa, prazo e a prioridade da Prefeita ficam agrupados no cabeçalho');
  const ident = (await pg.textContent('[data-secao="identificacao"] .ler')) ?? '';
  ok(!/250\/2026|Processo/.test(ident) && /Prefeita/.test(ident), 'consulta: a leitura da Identificação não repete tipo e número');
  const ordem = await pg.$$eval('.modal [data-secao]', (l) => l.map((e) => e.dataset.secao).join());
  ok(ordem === 'tarefas,descricao,chegada,identificacao,andamento', `consulta: ordem das seções Tarefas, Descrição, Chegada e prazo, Identificação, Andamento (${ordem})`);
  const tar = await caixa(pg, '[data-secao="tarefas"]'), des = await caixa(pg, '[data-secao="descricao"]');
  ok(tar.r <= des.l + 2 && Math.abs(tar.t - des.t) < 8, 'consulta 1600 px: Tarefas e Descrição lado a lado');
  const prox = await pg.$eval('.modal [data-proxima]', (e) => e.textContent);
  ok(/Pedir manifestação da Procuradoria/.test(prox) && /Próxima/.test(prox) && (await pg.$$('.modal [data-proxima]')).length === 1, 'consulta: a próxima tarefa pendente está marcada, e só ela');
  const rod = await caixa(pg, '.modal .m-f'), ult = await pg.evaluate(() => { const m = document.querySelector('.modal'); m.scrollTop = m.scrollHeight; return document.querySelector('[data-secao="andamento"]').getBoundingClientRect().bottom; });
  ok(ult <= (await caixa(pg, '.modal .m-f')).t + 1, `consulta: ao rolar até o fim, o rodapé não cobre a última seção (${Math.round(ult)} e ${Math.round(rod.t)})`);
  ok((await pg.isVisible('.modal .m-f .btn:has-text("Fechar")')) && (await pg.isVisible('.modal .m-f .btn.pri:has-text("Concluir demanda")')) && (await pg.$$('.modal .m-f .m-sec')).length === 2, 'consulta: Fechar e Concluir em destaque, Arquivar e Excluir como ações secundárias');
  await pg.screenshot({ path: `${CAPTURAS}/consulta-1600.png` });
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'));
  await abrirConsulta(pg, ASSUNTO_LONGO);
  ok((await pg.textContent('.modal .cons-doc')).trim() === 'Sem documento associado', 'consulta: demanda sem documento mostra "Sem documento associado"');
  const h3 = await pg.$eval('.modal.ed .m-h h3', (e) => ({ sw: e.scrollWidth, cw: e.clientWidth, h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) }));
  ok(h3.sw <= h3.cw + 1 && h3.h >= h3.lh * 1.9, `consulta: assunto longo quebra em linhas sem estourar (${Math.round(h3.h / h3.lh)} linhas)`);
  await ctx.close();
}
for (const [nome, w] of [['celular 390', 390], ['tablet 820', 820]]) {
  const { ctx, pg } = await novo({ w, h: 844, toque: true });
  await ir(pg, '/demandas'); await abrirConsulta(pg, ASSUNTO_RICO);
  const tar = await caixa(pg, '[data-secao="tarefas"]'), des = await caixa(pg, '[data-secao="descricao"]');
  ok(tar.t < des.t && des.t >= tar.b - 1, `consulta ${nome} px: Tarefas primeiro e Descrição abaixo`);
  ok(await rolaX(pg) <= 1 && (await pg.evaluate(() => { const m = document.querySelector('.modal'); return m.scrollWidth <= m.clientWidth + 1; })), `consulta ${nome} px: sem rolagem horizontal`);
  const rod = await pg.evaluate(() => { const m = document.querySelector('.modal'); m.scrollTop = m.scrollHeight; const f = document.querySelector('.modal .m-f').getBoundingClientRect(), u = document.querySelector('[data-secao="andamento"]').getBoundingClientRect(); return { fT: f.top, fB: f.bottom, uB: u.bottom, vh: innerHeight }; });
  ok(rod.uB <= rod.fT + 1 && rod.fB <= rod.vh + 1, `consulta ${nome} px: o rodapé cabe na tela e não cobre a última seção`);
  const btn = await pg.$$eval('.modal .m-f .btn', (l) => l.filter((b) => b.getClientRects().length).map((b) => ({ mini: b.classList.contains('mini'), h: b.getBoundingClientRect().height })));
  ok(btn.filter((b) => !b.mini).length >= 2 && btn.filter((b) => !b.mini).every((b) => b.h >= 36) && btn.filter((b) => b.mini).every((b) => b.h >= 30), `consulta ${nome} px: Fechar e Concluir com altura de toque e as ações secundárias na escala mini (${btn.map((b) => Math.round(b.h)).join(', ')})`);
  await pg.screenshot({ path: `${CAPTURAS}/consulta-${w}.png` });
  await ctx.close();
}

ok(erros.length === 0, `sem erros de página nem de console (${erros.length})${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
await nav.close(); parar();
console.log(falhas ? `${falhas} de ${total} verificações falharam.` : `Tudo certo: ${total} verificações.`);
console.log(`Capturas para olhar: ${CAPTURAS}`);
process.exit(falhas ? 1 : 0);
