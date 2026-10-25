// Cards atrasados sem faixa lateral: o fundo vermelho pastel, o contorno vermelho regular, os cantos e a barra de progresso continuam.
// Cobre as três cores de classificação (azul, verde, amarelo), cards de Início, Demandas (cards) e Quadro, claro e escuro.
// Uso (dentro da pasta prototipo): node testes/card-faixa.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await (await nav.newContext({ viewport: { width: 1480, height: 1000 } })).newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(300); };

for (const modo of ['claro', 'escuro']) for (const [tela, vis, sel] of [['demandas', 'cards', '.dcard.atrasada .face.front'], ['inicio', '', '.dcard.atrasada .face.front'], ['demandas', 'quadro', '.mini-card.atrasada']]) {
  await abrir('tema=' + modo + '&dev=desktop&tela=' + tela + (vis ? '&vis=' + vis : '') + '&menuAb=false&balao=nao&aviso=nao');
  // três demandas atrasadas, uma de cada cor de classificação (Processo Geral azul, Pessoal verde, Compras amarelo)
  await pg.evaluate(() => { const D = window.DM.DEMANDAS; const base = D.find((d) => d.id === 1); [['Pessoal', 91], ['Compras', 92]].forEach(([area, id]) => D.push(Object.assign({}, base, { id, area, num: area + '/2026', assunto: 'Atrasada ' + area, tarefas: base.tarefas.map((t) => Object.assign({}, t)) }))); window.DM.estado.filtroIni = 'atrasadas'; window.DM.trocar({}); });
  await pg.waitForTimeout(400);
  const r = await pg.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => {
    const cs = getComputedStyle(e), b = e.querySelector('.barra'), bi = e.querySelector('.barra i'), pr = e.querySelector('.prog b');
    const cor = ['cat-azul', 'cat-verde', 'cat-amar'].filter((c) => e.classList.contains(c))[0] || 'neutro';
    const sombras = cs.boxShadow; const comFaixa = /inset\s+6px|6px\s+0px\s+0px\s+0px\s+inset|inset\s+[1-9]\d*px\s+0px\s+0px/.test(sombras) || /(\d+)px 0px 0px 0px inset/.test(sombras);
    return { cor, bg: cs.backgroundColor, sombras, comFaixa, raio: cs.borderRadius, anel: /rgb\(\d+, \d+, \d+\) 0px 0px 0px 1px/.test(sombras), barra: !!b && b.getBoundingClientRect().width > 20, preench: bi ? bi.style.width : null, prog: pr && pr.textContent.trim() };
  }), sel);
  const cores = [...new Set(r.map((x) => x.cor))];
  ok(r.length >= 3 && cores.length >= 3 && r.every((x) => !x.comFaixa), modo + ', ' + tela + (vis ? '/' + vis : '') + ': ' + r.length + ' cards atrasados (' + cores.join(', ') + ') sem faixa lateral');
  ok(r.every((x) => x.anel && /^(\d+px)( \d+px)*$/.test(x.raio) && parseFloat(x.raio) >= 16), modo + ', ' + tela + (vis ? '/' + vis : '') + ': contorno vermelho regular e cantos arredondados preservados');
  ok(r.every((x) => x.barra && x.prog && /\d+\/\d+ · \d+%/.test(x.prog) && x.preench), modo + ', ' + tela + (vis ? '/' + vis : '') + ': barra de progresso, contagem e percentual preservados (' + r.map((x) => x.prog).join(' | ') + ')');
  const vermelho = r.every((x) => { const m = x.bg.match(/[\d.]+/g).map(Number); return m[0] > m[2] && m[0] >= m[1]; });
  ok(vermelho, modo + ', ' + tela + (vis ? '/' + vis : '') + ': fundo continua vermelho pastel nas três classificações');
}
await pg.screenshot({ path: process.env.TEMP + '/card-faixa-ultima.png' }).catch(() => {});
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
