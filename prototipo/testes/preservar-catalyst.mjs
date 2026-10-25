// Garante que uma mudança de código não altera a aparência do Catalyst: grava o estilo calculado e a caixa de
// cada elemento de cada tela (claro e escuro; computador, iPad vertical e celular) e depois compara.
// Referências versionadas ficam compactadas (nome terminado em .gz) em testes/referencias.
// Uso (dentro da pasta prototipo):
//   node testes/preservar-catalyst.mjs gravar <arquivo.json>
//   node testes/preservar-catalyst.mjs comparar <arquivo.json>
// Cada cenário confere que mediu mesmo a tela, a visualização e o aparelho pedidos (o app só lê o # ao carregar, por isso há reload).
// Mudanças autorizadas são classificadas e contadas à parte, nunca ignoradas em silêncio:
//   - ícones do menu de navegação trocados pelo Ionicons (classe "ion"): a geometria do desenho muda; caixa, posição, tamanho e COR continuam comparadas;
//   - Config: o painel de tema (cartões de direção) saiu; a referência é gravada com essa única remoção.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { servir } from './servidor.mjs';

const [, , modo, arquivo] = process.argv;
if (!['gravar', 'comparar'].includes(modo) || !arquivo) { console.log('Uso: gravar|comparar <arquivo.json>'); process.exit(2); }
const PROPS = ['display', 'position', 'color', 'background-color', 'background-image', 'border-top-color', 'border-top-width', 'border-top-style', 'border-radius', 'box-shadow', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'opacity', 'transform', 'transition-duration', 'backdrop-filter', 'filter', 'overflow-x', 'overflow-y',
  'gap', 'text-align', 'text-transform', 'z-index', 'stroke-width', 'fill', 'stroke', 'width', 'height', '-webkit-line-clamp'];
const PROPS_DESENHO = ['stroke-width', 'fill', 'stroke']; // do desenho do ícone (passam a morar nos elementos internos do SVG novo); a cor efetiva é comparada por "tinta"
const TELAS = [['inicio'], ['entradas'], ['demandas', 'cards'], ['demandas', 'quadro'], ['demandas', 'tabela'], ['demandas', 'lista'], ['agenda', 'semana'], ['agenda', 'mes'], ['documentos'], ['ia'], ['config'], ['arquivo'], ['mais']];
const DEVS = { desktop: 1360, 'tablet-v': 820, phone: 390 };

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--disable-background-networking', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await nav.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = [];
pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });

function coletar(props) {
  const app = document.querySelector('.app'); if (!app) return null;
  const out = [];
  for (const el of [app, ...app.querySelectorAll('*')]) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const o = { k: el.tagName.toLowerCase() + '.' + String(el.getAttribute('class') || '').trim().replace(/\s+/g, '.'), r: [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10], s: {} };
    for (const p of props) o.s[p] = cs.getPropertyValue(p);
    if (el.tagName.toLowerCase() === 'svg') { // "tinta": cor efetiva do traço, venha ela do próprio svg (antigo) ou do primeiro elemento interno (SVG original do Ionicons)
      const t = el.getAttribute('stroke') ? el : (el.firstElementChild || el); o.tinta = getComputedStyle(t).stroke;
    }
    out.push(o);
  }
  return out;
}

const resultado = {}, meta = {};
for (const tema of ['claro', 'escuro']) for (const dev of Object.keys(DEVS)) for (const [tela, vis] of TELAS) {
  const chave = [tema, dev, tela, vis || ''].join('/');
  await pg.goto(srv.url + '#dir=d&tema=' + tema + '&dev=' + dev + '&tela=' + tela + (vis ? (tela === 'agenda' ? '&ag=' : '&vis=') + vis : '') + '&balao=nao&aviso=nao');
  await pg.reload(); // mudar só o # não recarrega o app: sem isto todas as telas mediriam a primeira
  await pg.waitForFunction(() => window.DM && document.querySelector('.app'));
  await pg.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(250);
  const m = await pg.evaluate(() => { const E = window.DM.estado; return { tela: E.tela, vis: E.vis, ag: E.ag, dev: E.dev, tema: document.querySelector('.app').dataset.tema, larg: Math.round(document.querySelector('.frame').getBoundingClientRect().width) }; });
  const certo = m.tela === tela && m.dev === dev && m.tema === tema && Math.abs(m.larg - DEVS[dev]) <= 2 && (!vis || (tela === 'agenda' ? m.ag === vis : m.vis === vis));
  if (!certo) { console.log('CENÁRIO NÃO MEDIU O PRETENDIDO:', chave, JSON.stringify(m)); process.exit(3); }
  meta[chave] = m;
  resultado[chave] = await pg.evaluate(coletar, PROPS);
}
await nav.close(); srv.fechar();
console.log('Cenários medidos e confirmados (tela, visualização, aparelho, modo e largura): ' + Object.keys(resultado).length);
if (erros.length) console.log('Erros de JavaScript ou de recursos:', [...new Set(erros)].slice(0, 8));

if (modo === 'gravar') { writeFileSync(arquivo, arquivo.endsWith('.gz') ? gzipSync(JSON.stringify(resultado)) : JSON.stringify(resultado)); console.log('Gravado:', Object.keys(resultado).length, 'telas em', arquivo); process.exit(erros.length ? 1 : 0); }

const antes = JSON.parse(arquivo.endsWith('.gz') ? gunzipSync(readFileSync(arquivo)).toString('utf8') : readFileSync(arquivo, 'utf8'));
let difs = 0, telasDif = 0, iconesNav = 0, iconesCor = 0; const exemplos = [];
const rel = (r, o, j) => r[j] - (j < 2 ? o[j] : 0);
for (const chave of Object.keys(antes)) {
  const a = antes[chave], d = resultado[chave]; let n = 0;
  const relata = (t) => { n++; if (exemplos.length < 30) exemplos.push(chave + ' ' + t); };
  if (!d || a.length !== d.length) { relata('quantidade de elementos ' + a.length + ' → ' + (d ? d.length : 'sem tela')); if (n) { telasDif++; difs += n; } continue; }
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = d[i];
    const novoIcone = y.k.startsWith('svg.') && y.k.split('.').includes('ion') && !x.k.split('.').includes('ion'); // só vale quando a referência é anterior à migração
    const kNovo = novoIcone ? y.k.replace('.ion', '') : y.k;
    if (x.k !== kNovo) { relata('#' + i + ': ' + x.k + ' → ' + y.k); continue; }
    // posições relativas ao canto do aplicativo (a moldura do protótipo fora dele pode mudar sem afetar o Catalyst)
    const oculto = !x.r[2] && !x.r[3] && !y.r[2] && !y.r[3];
    if (!oculto && x.r.some((v, j) => Math.abs(rel(x.r, a[0].r, j) - rel(y.r, d[0].r, j)) > 0.6)) relata(x.k + ' caixa ' + x.r + ' → ' + y.r);
    for (const p of PROPS) {
      if (novoIcone && PROPS_DESENHO.includes(p)) continue;
      if (x.s[p] !== y.s[p]) relata(x.k + ' ' + p + ': ' + x.s[p] + ' → ' + y.s[p]);
    }
    if (novoIcone) { iconesNav++; if (x.tinta !== y.tinta) { iconesCor++; relata(x.k + ' cor do ícone ' + x.tinta + ' → ' + y.tinta); } }
  }
  if (n) telasDif++; difs += n;
}
console.log('Ícones de navegação com o desenho do Ionicons (autorizado): ' + iconesNav + ' ocorrências; cor diferente em ' + iconesCor + '; caixa, posição, tamanho e demais estilos conferidos.');
console.log(difs ? 'DIFERENÇAS NÃO AUTORIZADAS: ' + difs + ' em ' + telasDif + ' telas de ' + Object.keys(antes).length : 'Sem diferenças além das autorizadas: ' + Object.keys(antes).length + ' telas conferidas.');
exemplos.forEach((e) => console.log('  - ' + e));
process.exit(difs || erros.length ? 1 : 0);
