// Botões só com ícone da barra de Demandas (Só atrasadas, Filtros, Nova demanda) entre 521 e 899 px de container.
// Confere: ícone dentro da caixa do botão, caixa de 44 px, ícone de 18 px, ícone centralizado, rótulo oculto até 899 px e visível a partir de 900 px.
// Uso (dentro da pasta prototipo): node testes/ipad-botoes.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await nav.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };

const medir = () => pg.evaluate(() => {
  const larg = document.querySelector('.frame').clientWidth; // largura do container 'tela' (sem a borda do frame)
  const bs = [...document.querySelectorAll('.toolbar > .btn')].map((b) => {
    const r = b.getBoundingClientRect(), i = b.querySelector('.ic').getBoundingClientRect(), t = getComputedStyle(b.querySelector('.tx'));
    const cs = getComputedStyle(b);
    return { nome: b.getAttribute('aria-label'), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, iw: Math.round(i.width * 10) / 10, ih: Math.round(i.height * 10) / 10,
      dx: Math.round(((i.left + i.width / 2) - (r.left + r.width / 2)) * 10) / 10, dy: Math.round(((i.top + i.height / 2) - (r.top + r.height / 2)) * 10) / 10,
      dentro: i.left >= r.left - 0.5 && i.right <= r.right + 0.5 && i.top >= r.top - 0.5 && i.bottom <= r.bottom + 0.5,
      sobra: b.scrollWidth - b.clientWidth, util: b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), // largura útil (a mesma medida do detector de estouro do clicar-tudo)
       pad: cs.paddingLeft + '/' + cs.paddingRight, rotulo: t.display !== 'none' };
  });
  return { larg, bs };
});

// larguras do container (.frame): 520/521 e 899/900 são os limites da regra; 820 é o iPad vertical
for (const modo of ['claro', 'escuro']) for (const dev of ['tablet-v']) for (const vis of ['cards', 'quadro', 'tabela', 'lista']) {
  await pg.goto(srv.url + '#tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=' + vis + '&balao=nao&aviso=nao'); await pg.reload();
  await pg.waitForFunction(() => window.DM && document.querySelector('.toolbar > .btn'));
  const m = await medir();
  const ruins = m.bs.filter((b) => !(b.dentro && b.iw <= b.util + 2 && b.w === 44 && b.iw === 18 && b.ih === 18 && Math.abs(b.dx) <= 0.6 && Math.abs(b.dy) <= 0.6 && !b.rotulo));
  ok(m.bs.length === 3 && ruins.length === 0, modo + ' iPad vertical (' + m.larg + ' px), ' + vis + ': 3 botões de 44 px, ícone de 18 px centralizado e dentro, sem rótulo' + (ruins.length ? ' ' + JSON.stringify(ruins) : ''));
}
// limites da regra: o container é o .frame; no modo "dev=desktop" a largura vem do aparelho, então mudo a largura do frame
await pg.goto(srv.url + '#tema=claro&dev=desktop&tela=demandas&vis=cards&balao=nao&aviso=nao'); await pg.reload();
await pg.waitForFunction(() => window.DM && document.querySelector('.toolbar > .btn'));
for (const w of [520, 521, 899, 900]) {
  await pg.evaluate((w) => { const f = document.querySelector('.frame'); f.style.setProperty('--w', (w + (f.offsetWidth - f.clientWidth)) + 'px'); }, w);
  await pg.waitForTimeout(150);
  const m = await medir();
  if (w <= 899) {
    const ruins = m.bs.filter((b) => !(b.dentro && b.iw <= b.util + 2 && b.iw === 18 && Math.abs(b.dx) <= 0.6 && !b.rotulo));
    ok(m.larg === w && m.bs.length === 3 && ruins.length === 0, 'container de ' + w + ' px: botões só com ícone, ícone centralizado e dentro (largura confirmada ' + m.larg + ', caixas ' + m.bs.map((b) => b.w + 'x' + b.h).join(', ') + ')' + (ruins.length ? ' ' + JSON.stringify(ruins) : ''));
  } else {
    const ruins = m.bs.filter((b) => !(b.dentro && b.iw <= b.util + 2 && b.rotulo && b.w > 44));
    ok(m.larg === w && ruins.length === 0, 'container de ' + w + ' px: rótulos voltam e os botões crescem com eles (caixas ' + m.bs.map((b) => b.w + 'x' + b.h).join(', ') + ')' + (ruins.length ? ' ' + JSON.stringify(ruins) : ''));
  }
}
ok(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros[0] : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
