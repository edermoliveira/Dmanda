// Contraste do selo "Legal" nas dez paletas, claro e escuro, na Tabela, na Lista e nos cards (mínimo 4,5:1).
// Uso (dentro da pasta prototipo): node testes/selo-legal.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';
const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const pg = await (await nav.newContext({ viewport: { width: 1480, height: 1000 } })).newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
let falhas = 0, pior = 99; const resumo = {};
for (const modo of ['claro', 'escuro']) for (const vis of ['tabela', 'lista', 'cards']) {
  await pg.goto(srv.url + '#tema=' + modo + '&dev=desktop&tela=demandas&vis=' + vis + '&menuAb=false&balao=nao&aviso=nao'); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app'));
  for (let i = 0; i < 10; i++) {
    await pg.evaluate((i) => window.DM.trocar({ pal: i }), i); await pg.waitForTimeout(120);
    const r = await pg.evaluate(() => {
      const num = (c) => { const m = c.match(/[\d.]+/g).map(Number); if (c.startsWith('color(')) for (let q = 0; q < 3; q++) m[q] *= 255; return m; }, lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      return [...document.querySelectorAll('.selo.legal')].filter((e) => e.getBoundingClientRect().width).map((e) => {
        let base = num(getComputedStyle(document.querySelector('.app')).backgroundColor), camadas = [];
        for (let n = e; n && !n.classList.contains('app'); n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; if (b !== 'rgba(0, 0, 0, 0)') { const m = num(b); camadas.push([m[0], m[1], m[2], m[3] === undefined ? 1 : m[3]]); if ((m[3] === undefined ? 1 : m[3]) >= .99) break; } }
        let f = [base[0], base[1], base[2]]; for (let k = camadas.length - 1; k >= 0; k--) { const c = camadas[k]; f = [0, 1, 2].map((q) => c[q] * c[3] + f[q] * (1 - c[3])); }
        const c = num(getComputedStyle(e).color), a = (a_) => a_, L1 = lum(c), L2 = lum(f);
        return +((Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)).toFixed(2);
      });
    });
    const min = Math.min(...r); pior = Math.min(pior, min); const k = modo + '/' + vis; resumo[k] = Math.min(resumo[k] || 99, min);
    if (!r.length || min < 4.5) { falhas++; console.log('FALHOU ' + modo + ', ' + vis + ', paleta ' + i + ': ' + (r.length ? 'pior ' + min + ':1' : 'nenhum selo')); }
  }
}
for (const [k, v] of Object.entries(resumo)) console.log((v >= 4.5 ? 'ok     ' : 'FALHOU ') + k + ': pior contraste nas 10 paletas ' + v + ':1');
console.log(erros.length ? 'erros: ' + erros[0] : 'sem erros de JavaScript'); await nav.close(); srv.fechar();
console.log(falhas || erros.length ? '\n' + falhas + ' falha(s).' : '\nTudo certo.'); process.exit(falhas || erros.length ? 1 : 0);
