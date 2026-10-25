// Ícones de busca (search-outline), filtros (funnel-outline), ordenação (arrow-up-outline e arrow-down-outline) e expansão (chevron-down-outline), Ionicons 8.0.13:
// desenho igual ao SVG oficial com Iconoir ou Lucide, tamanho e alinhamento, sentido da ordenação, giro do chevron, foco e acionamento. Claro e escuro, computador e celular.
// Uso (dentro da pasta prototipo): node testes/icones-busca-filtros.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { servir } from './servidor.mjs';
const O = { busca: 'busca__search-outline', filtro: 'filtro__funnel-outline', sobe: 'ordem-crescente__arrow-up-outline', desce: 'ordem-decrescente__arrow-down-outline', expandir: 'expandir__chevron-down-outline' };
const corpo = (n) => readFileSync(new URL('../icones-nav/originais/' + n + '.svg', import.meta.url), 'utf8').trim().match(/^<svg[^>]*>([\s\S]*)<\/svg>$/)[1];
const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const pg = await (await nav.newContext({ viewport: { width: 1480, height: 1000 } })).newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0; const ok = (c, m) => { console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(300); };
await abrir('tela=demandas&balao=nao&aviso=nao');
const norm = await pg.evaluate((o) => Object.fromEntries(Object.entries(o).map(([k, c]) => { const d = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); d.innerHTML = c; return [k, d.innerHTML]; })), Object.fromEntries(Object.entries(O).map(([k, n]) => [k, corpo(n)])));
const info = (sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((s) => s.getBoundingClientRect().width).map((s) => { const r = s.getBoundingClientRect(); return { ion: s.classList.contains('ion'), vb: s.getAttribute('viewBox'), corpo: s.innerHTML, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, sw: getComputedStyle(s.firstElementChild).strokeWidth, tr: getComputedStyle(s).transform }; }), sel);
const ang = (t) => { const m = t.match(/matrix\(([^)]+)\)/); return m ? Math.round(Math.atan2(+m[1].split(',')[1], +m[1].split(',')[0]) * 180 / Math.PI) : 0; };
const ordem = () => pg.evaluate(() => ({ d: window.DM.estado.ordDir, sort: [...document.querySelectorAll('.tabela th[aria-sort]')].map((t) => t.getAttribute('aria-sort')).filter((x) => x !== 'none').join() }));
for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'phone']) for (const lib of ['iconoir', 'lucide']) {
  const R = modo + ', ' + dev + ', ' + lib + ': ';
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=tabela&balao=nao&aviso=nao'); await pg.evaluate((l) => window.DM.estado.lib !== l && window.DM.trocar({ lib: l }), lib); await pg.waitForTimeout(150);
  const busca = [...await info('.top .buscabtn svg'), ...await info('.toolbar .filtro svg')], filtro = await info('.toolbar > .btn[aria-label="Filtros"] svg');
  ok(busca.length === 2 && busca.every((x) => x.ion && x.vb === '0 0 512 512' && x.corpo === norm.busca && x.sw === '32px') && filtro.length === 1 && filtro[0].corpo === norm.filtro && filtro[0].ion, R + 'busca (topo e campo de filtro) e Filtros com o desenho oficial intacto');
  ok(busca.every((x) => x.w >= 16 && x.w === x.h) && filtro[0].w >= 14 && filtro[0].w === filtro[0].h, R + 'tamanhos quadrados e preservados (busca ' + busca.map((x) => x.w).join('/') + ' px, filtro ' + filtro[0].w + ' px)');
  await pg.click('.tabela th button[data-k="prazo"]'); await pg.waitForTimeout(150);
  const s1 = await ordem(); let seta = await info('.tabela th button svg'); const sentido1 = seta.length === 1 && seta[0].corpo === (s1.d > 0 ? norm.sobe : norm.desce);
  await pg.click('.tabela th button[data-k="prazo"]'); await pg.waitForTimeout(150);
  const s2 = await ordem(); seta = await info('.tabela th button svg'); const sentido2 = seta.length === 1 && seta[0].corpo === (s2.d > 0 ? norm.sobe : norm.desce);
  ok(s1.d !== s2.d && sentido1 && sentido2 && s1.sort !== s2.sort && seta[0].w === 14, R + 'ordenação nos dois sentidos: ' + s1.sort + ' com seta ' + (s1.d > 0 ? 'para cima' : 'para baixo') + ', ' + s2.sort + ' com seta ' + (s2.d > 0 ? 'para cima' : 'para baixo') + ' (14 px)');
  await pg.evaluate(() => window.DM.trocar({ vis: 'lista' })); await pg.waitForTimeout(200);
  const antes = await info('.grupo-h svg'); const exp0 = await pg.evaluate(() => [...document.querySelectorAll('.grupo-h')].map((b) => b.getAttribute('aria-expanded')));
  await pg.click('.grupo-h >> nth=0'); await pg.waitForTimeout(350);
  const dep = await info('.grupo-h svg'), exp1 = await pg.evaluate(() => [...document.querySelectorAll('.grupo-h')].map((b) => b.getAttribute('aria-expanded')));
  ok(antes.length >= 3 && antes.every((x) => x.ion && x.corpo === norm.expandir) && exp0[0] !== exp1[0] && ang(dep[0].tr) === -90, R + 'Lista: chevron oficial em cada etapa; ao recolher a primeira gira ' + ang(dep[0].tr) + ' graus e aria-expanded muda (' + exp0[0] + ' para ' + exp1[0] + ')');
  await pg.click('.grupo-h >> nth=0'); await pg.waitForTimeout(300); ok(ang((await info('.grupo-h svg'))[0].tr) === 0, R + 'Lista: ao expandir de novo o chevron volta a 0 grau');
}
for (const dev of ['desktop', 'phone']) {
  await abrir('tema=claro&dev=' + dev + '&tela=demandas&vis=cards&balao=nao&aviso=nao');
  await pg.fill('#fq', 'contrato'); await pg.waitForTimeout(200);
  ok((await pg.evaluate(() => document.querySelectorAll('.dcard').length)) === 1, dev + ': o filtro por texto continua funcionando (1 demanda para "contrato")');
  await pg.fill('#fq', 'zzzz'); await pg.waitForTimeout(200);
  const vz = await info('.vazio svg'); ok(vz.length === 1 && vz[0].corpo === norm.busca && vz[0].w >= 36, dev + ': estado vazio com a lupa oficial grande (' + (vz[0] && vz[0].w) + ' px)');
  await pg.fill('#fq', '');
  if (dev === 'desktop') { await pg.click('.buscabtn'); await pg.waitForTimeout(250); ok(await pg.evaluate(() => document.querySelector('#ov').classList.contains('aberto')), 'o botão de busca do topo abre a busca global'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); }
  await pg.click('.toolbar > .btn[aria-label="Filtros"]'); await pg.waitForTimeout(250); ok(/Filtros/.test(await pg.textContent('#toast')), dev + ': o botão Filtros mantém o comportamento atual (aviso de exemplo)');
  await pg.evaluate(() => window.DM.trocar({ vis: 'tabela' })); await pg.waitForTimeout(200);
  await pg.keyboard.press('Shift'); await pg.focus('.tabela th button[data-k="prazo"]'); const f = await pg.evaluate(() => { const c = getComputedStyle(document.activeElement); return { ow: parseFloat(c.outlineWidth), os: c.outlineStyle }; }); const o1 = await pg.evaluate(() => ({ d: window.DM.estado.ordDir }));
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); const o2 = await pg.evaluate(() => ({ ord: window.DM.estado.ord, d: window.DM.estado.ordDir }));
  ok(f.ow >= 2 && f.os !== 'none' && o2.ord === 'prazo' && o2.d !== o1.d, dev + ': cabeçalho de ordenação com foco visível (' + f.ow + ' px) e Enter inverte o sentido (' + o1.d + ' para ' + o2.d + ', ord ' + o2.ord + ', contorno ' + f.os + ')');
  await pg.evaluate(() => window.DM.trocar({ vis: 'lista' })); await pg.waitForTimeout(200); await pg.focus('.grupo-h >> nth=1'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  ok((await pg.evaluate(() => document.querySelectorAll('.grupo-h')[1].getAttribute('aria-expanded'))) === 'false', dev + ': Enter recolhe uma etapa da Lista');
}
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar(); console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
