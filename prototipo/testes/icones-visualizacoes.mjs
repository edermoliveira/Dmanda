// Ícones das visualizações de Demandas: Cards (albums-outline), Tabela (grid-outline) e Lista (list-outline) do Ionicons 8.0.13, iguais aos
// SVGs oficiais, iguais com Iconoir ou Lucide; Quadro continua com o ícone antigo. Tamanho, seleção, foco e funcionamento dos botões. Claro e escuro, computador e celular.
// Uso (dentro da pasta prototipo): node testes/icones-visualizacoes.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { servir } from './servidor.mjs';
const OFICIAL = { cards: 'vis-cards__albums-outline', tabela: 'vis-tabela__grid-outline', lista: 'vis-lista__list-outline' };
const corpo = (n) => readFileSync(new URL('../icones-nav/originais/' + n + '.svg', import.meta.url), 'utf8').trim().match(/^<svg[^>]*>([\s\S]*)<\/svg>$/)[1];
const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const pg = await (await nav.newContext({ viewport: { width: 1480, height: 1000 } })).newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0; const ok = (c, m) => { console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.toolbar .tabs')); await pg.waitForTimeout(300); };
const ler = () => pg.evaluate(() => [...document.querySelectorAll('.toolbar .tabs button')].map((b) => { const s = b.querySelector('svg'), r = s.getBoundingClientRect(); return { v: b.dataset.v, nome: b.getAttribute('aria-label'), ion: s.classList.contains('ion'), vb: s.getAttribute('viewBox'), corpo: s.innerHTML, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, sel: b.getAttribute('aria-pressed') === 'true', cor: getComputedStyle(s.firstElementChild).stroke, sw: getComputedStyle(s.firstElementChild).strokeWidth, fill: getComputedStyle(s.firstElementChild).fill, bw: Math.round(b.getBoundingClientRect().width), bh: Math.round(b.getBoundingClientRect().height) }; }));
const base = {};
for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'phone']) for (const lib of ['iconoir', 'lucide']) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=cards&lib=' + lib + '&balao=nao&aviso=nao');
  await pg.evaluate((l) => window.DM.estado.lib !== l && window.DM.trocar({ lib: l }), lib); await pg.waitForTimeout(200);
  const r = await ler(), por = Object.fromEntries(r.map((x) => [x.v, x]));
  const norm = await pg.evaluate((o) => Object.fromEntries(Object.entries(o).map(([v, c]) => { const d = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); d.innerHTML = c; return [v, d.innerHTML]; })), Object.fromEntries(Object.entries(OFICIAL).map(([v, n]) => [v, corpo(n)])));
  const certos = ['cards', 'tabela', 'lista'].every((v) => por[v].ion && por[v].vb === '0 0 512 512' && por[v].corpo === norm[v] && por[v].sw === '32px' && por[v].fill === 'none');
  ok(certos, modo + ', ' + dev + ', biblioteca ' + lib + ': Cards, Tabela e Lista com o desenho oficial intacto (viewBox 512, traço 32, sem preenchimento)');
  ok(!por.quadro.ion && por.quadro.vb === '0 0 24 24', modo + ', ' + dev + ', ' + lib + ': Quadro continua com o ícone antigo (columns)');
  const tam = new Set(r.map((x) => x.w + 'x' + x.h)); ok(tam.size === 1 && r[0].w >= 16, modo + ', ' + dev + ', ' + lib + ': os quatro ícones têm o mesmo tamanho (' + [...tam].join(', ') + ' px)');
  base[dev] = r.map((x) => x.bw + 'x' + x.bh).join();
}
// seleção, foco e funcionamento (computador e celular, claro e escuro)
for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'phone']) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=cards&balao=nao&aviso=nao');
  const caixa0 = (await ler()).map((x) => x.bh).join(); // a largura da aba selecionada muda por causa do texto em negrito (comportamento anterior); a altura e o ícone não
  const icone0 = (await ler()).map((x) => x.w + 'x' + x.h).join();
  const res = [];
  for (const v of ['tabela', 'lista', 'cards', 'quadro']) { await pg.click('.toolbar .tabs button[data-v="' + v + '"]'); await pg.waitForTimeout(250); const r = await ler(); res.push(v + ':' + (await pg.evaluate(() => window.DM.estado.vis)) + ':' + r.filter((x) => x.sel).map((x) => x.v).join('')); }
  ok(res.every((s) => { const [a, b, c] = s.split(':'); return a === b && a === c; }), modo + ', ' + dev + ': cada botão abre a visualização certa e só ele fica selecionado (' + res.join(' ') + ')');
  ok((await ler()).map((x) => x.bh).join() === caixa0 && (await ler()).map((x) => x.w + 'x' + x.h).join() === icone0, modo + ', ' + dev + ': altura dos botões e tamanho dos ícones se mantêm depois da troca de visualização');
  await pg.focus('.toolbar .tabs button[data-v="cards"]'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab');
  const f = await pg.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { v: a.dataset.v, ow: parseFloat(cs.outlineWidth), os: cs.outlineStyle, cor: getComputedStyle(a.querySelector('svg').firstElementChild).stroke }; });
  ok(f.v === 'tabela' && f.ow >= 2 && f.os !== 'none', modo + ', ' + dev + ': foco de teclado visível no botão Tabela (contorno de ' + f.ow + ' px)');
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(250); ok((await pg.evaluate(() => window.DM.estado.vis)) === 'tabela', modo + ', ' + dev + ': Enter no botão focado abre a Tabela');
}
await pg.screenshot({ path: process.env.TEMP + '/icones-vis-ultimo.png' }).catch(() => {});
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar(); console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
