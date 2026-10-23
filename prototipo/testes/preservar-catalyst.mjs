// Garante que uma mudança de código não altera a aparência do Catalyst: grava o estilo calculado e a caixa de
// cada elemento de cada tela (claro e escuro; computador, iPad vertical e celular) e depois compara.
// Uso (dentro da pasta prototipo):
//   node testes/preservar-catalyst.mjs gravar <arquivo.json>
//   node testes/preservar-catalyst.mjs comparar <arquivo.json> [--sem-icones]
// Os ícones (svg) entram só pela caixa e pela cor; o desenho interno é ignorado (a troca de biblioteca o muda de propósito).
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { servir } from './servidor.mjs';

const [, , modo, arquivo] = process.argv;
if (!['gravar', 'comparar'].includes(modo) || !arquivo) { console.log('Uso: gravar|comparar <arquivo.json>'); process.exit(2); }
const PROPS = ['display', 'position', 'color', 'background-color', 'background-image', 'border-top-color', 'border-top-width', 'border-top-style', 'border-radius', 'box-shadow', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'opacity', 'transform', 'transition-duration', 'backdrop-filter', 'filter', 'overflow-x', 'overflow-y',
  'gap', 'text-align', 'text-transform', 'z-index', 'stroke-width', 'fill', 'stroke', 'width', 'height', '-webkit-line-clamp'];
const TELAS = [['inicio'], ['entradas'], ['demandas', 'cards'], ['demandas', 'quadro'], ['demandas', 'tabela'], ['demandas', 'lista'], ['agenda', 'semana'], ['agenda', 'mes'], ['documentos'], ['ia'], ['config'], ['arquivo'], ['mais']];
const DEVS = ['desktop', 'tablet-v', 'phone'];

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--disable-background-networking', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await nav.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = [];
pg.on('pageerror', (e) => erros.push(String(e.message || e)));

function coletar(props) {
  const app = document.querySelector('.app'); if (!app) return null;
  const out = [];
  for (const el of [app, ...app.querySelectorAll('*')]) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const o = { k: el.tagName.toLowerCase() + '.' + String(el.getAttribute('class') || '').trim().replace(/\s+/g, '.'), r: [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10], s: {} };
    for (const p of props) o.s[p] = cs.getPropertyValue(p);
    out.push(o);
  }
  return out;
}

const resultado = {};
for (const tema of ['claro', 'escuro']) for (const dev of DEVS) for (const [tela, vis] of TELAS) {
  const chave = [tema, dev, tela, vis || ''].join('/');
  await pg.goto(srv.url + '#dir=d&tema=' + tema + '&dev=' + dev + '&tela=' + tela + (vis ? (tela === 'agenda' ? '&ag=' : '&vis=') + vis : '') + '&balao=nao&aviso=nao');
  await pg.waitForFunction(() => window.DM && document.querySelector('.app'));
  await pg.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(250);
  resultado[chave] = await pg.evaluate(coletar, PROPS);
}
await nav.close(); srv.fechar();
if (erros.length) console.log('Erros de JavaScript:', erros.slice(0, 5));

if (modo === 'gravar') { writeFileSync(arquivo, JSON.stringify(resultado)); console.log('Gravado:', Object.keys(resultado).length, 'telas em', arquivo); process.exit(erros.length ? 1 : 0); }

const antes = JSON.parse(readFileSync(arquivo, 'utf8'));
let difs = 0, telasDif = 0; const exemplos = [];
for (const chave of Object.keys(antes)) {
  const a = antes[chave], d = resultado[chave]; let n = 0;
  if (!d || a.length !== d.length) { difs++; telasDif++; exemplos.push(chave + ': quantidade de elementos ' + a.length + ' → ' + (d ? d.length : 'sem tela')); continue; }
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = d[i];
    if (x.k !== y.k) { n++; if (exemplos.length < 25) exemplos.push(chave + ' #' + i + ': ' + x.k + ' → ' + y.k); continue; }
    if (x.r.some((v, j) => Math.abs(v - y.r[j]) > 0.6)) { n++; if (exemplos.length < 25) exemplos.push(chave + ' ' + x.k + ' caixa ' + x.r + ' → ' + y.r); }
    for (const p of PROPS) if (x.s[p] !== y.s[p]) { n++; if (exemplos.length < 25) exemplos.push(chave + ' ' + x.k + ' ' + p + ': ' + x.s[p] + ' → ' + y.s[p]); }
  }
  if (n) telasDif++; difs += n;
}
console.log(difs ? 'DIFERENÇAS: ' + difs + ' em ' + telasDif + ' telas de ' + Object.keys(antes).length : 'Igual: ' + Object.keys(antes).length + ' telas sem nenhuma diferença de estilo ou posição.');
exemplos.slice(0, 25).forEach((e) => console.log('  - ' + e));
process.exit(difs || erros.length ? 1 : 0);
