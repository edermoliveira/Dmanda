// Confere os cinco SVGs de energia: arquivos servidos como imagem, carregados em cada local, ligados ao nível certo
// (energia-N.svg = N-ésimo rótulo da escala), sem recolorir (filter, currentColor) e sem erros de recurso. Claro e escuro.
// Uso (dentro da pasta prototipo): node testes/energia.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const ROTULOS = ['Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta'];
const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await nav.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); };

// 1) os cinco arquivos: servidos como imagem SVG, com <svg> e sem script
for (let n = 1; n <= 5; n++) {
  const r = await pg.request.get(srv.url.replace('index.html', 'emojis/energia-' + n + '.svg'));
  const t = await r.text();
  ok(r.status() === 200 && /image\/svg\+xml/.test(r.headers()['content-type']) && /^<svg\b/.test(t.trim()) && !/<script/i.test(t), 'energia-' + n + '.svg: servido (200, image/svg+xml, ' + Math.round(t.length / 1024) + ' KB, sem script)');
}

const medir = () => pg.evaluate(() => [...document.querySelectorAll('img.emo-img')].filter((i) => /energia-/.test(i.src)).map((i) => {
  const b = i.closest('button'), cs = getComputedStyle(i), r = i.getBoundingClientRect();
  return { src: i.getAttribute('src'), rotulo: b ? b.getAttribute('aria-label') : null, alt: i.getAttribute('alt'), pressed: b ? b.getAttribute('aria-pressed') : null, w: Math.round(r.width), h: Math.round(r.height), nw: i.naturalWidth, nh: i.naturalHeight, ok: i.complete && i.naturalWidth > 0, filtro: cs.filter, fit: cs.objectFit, vis: r.width > 0, op: cs.opacity };
}));
const confere = (lista, onde, rotuloVisivel) => {
  const ruins = lista.filter((x) => !(x.ok && x.nw > 0 && x.w === x.h && x.filtro === 'none' && x.fit === 'contain' && x.op === '1'));
  ok(lista.length > 0 && ruins.length === 0, onde + ': ' + lista.length + ' imagens de energia carregadas, quadradas, sem filtro e com object-fit contain' + (ruins.length ? ' ' + JSON.stringify(ruins) : ''));
  if (rotuloVisivel) {
    const erradas = lista.filter((x) => { const n = +/energia-(\d)\.svg/.exec(x.src)[1]; return x.rotulo !== ROTULOS[n - 1]; });
    ok(erradas.length === 0, onde + ': cada imagem fica no botão do nível certo (' + lista.map((x) => /energia-(\d)/.exec(x.src)[1] + '=' + x.rotulo).join(', ') + ')');
    ok(lista.filter((x) => x.pressed === 'true').length === 1, onde + ': exatamente uma opção marcada (aria-pressed)');
  }
};

for (const modo of ['claro', 'escuro']) {
  // 2) widget do Início (indicador com nome acessível e seletor no balão)
  await abrir('tema=' + modo + '&tela=inicio&balao=nao&aviso=nao');
  const ind = await pg.evaluate(() => { const i = document.querySelector('.w-energia > img.emo-img, .w-energia .w-r img.emo-img'); return i && { ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute('alt') }; });
  ok(ind && ind.ok && /^Energia: /.test(ind.alt || ''), modo + ', Início: o indicador de energia tem texto alternativo com o nível (' + (ind && ind.alt) + ')');
  await pg.hover('.w-energia');
  await pg.waitForTimeout(300);
  const sel = (await medir()).filter((x) => x.rotulo);
  ok(sel.length === 5, modo + ', Início: o seletor mostra cinco níveis');
  confere(sel, modo + ', seletor do Início', true);
  // escolher um nível muda o indicador e a marcação
  await pg.click('.w-energia .emo[aria-label="Muito alta"]');
  await pg.waitForTimeout(250);
  const dep = await pg.evaluate(() => ({ e: window.DM.estado.energia, alt: document.querySelector('.w-energia img.emo-img').getAttribute('alt'), src: document.querySelector('.w-energia img.emo-img').getAttribute('src') }));
  ok(dep.e === 4 && dep.alt === 'Energia: Muito alta' && /energia-5\.svg/.test(dep.src), modo + ', Início: escolher "Muito alta" grava nível 5 e o indicador passa a energia-5.svg');
  // 3) Perfil: indicador de energia com o rótulo ao lado
  await abrir('tema=' + modo + '&tela=inicio&balao=nao&aviso=nao');
  await pg.click('.perfil-b'); await pg.waitForTimeout(400);
  const per = await medir();
  confere(per.filter((x) => x.vis), modo + ', Perfil', false);
  const rot = await pg.evaluate(() => { const i = [...document.querySelectorAll('.ind-v')].find((v) => v.querySelector('img[src*="energia-"]')); return i ? { src: i.querySelector('img').getAttribute('src'), t: i.querySelector('b').textContent.trim() } : null; });
  ok(rot && ROTULOS.indexOf(rot.t) === +/energia-(\d)/.exec(rot.src)[1] - 1, modo + ', Perfil: o rótulo "' + (rot && rot.t) + '" combina com ' + (rot && rot.src));
}
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos (nenhum filtro)' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
