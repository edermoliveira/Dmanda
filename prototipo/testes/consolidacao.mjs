// Confere a consolidação: Catalyst como única direção e Ionicons como única família de ícones.
// Uso (dentro da pasta prototipo): node testes/consolidacao.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await nav.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error' && !/energia-\d\.png|404|Failed to load resource/.test(m.text())) erros.push(m.text()); });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const abrir = async (hash) => { await pg.goto(srv.url + '#' + hash); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); };

// 1) endereços e preferências antigas abrem o Catalyst, com o modo e a tela pedidos
const ANTIGOS = [
  ['dir=a&tema=escuro&tela=agenda&balao=nao&aviso=nao', 'escuro', 'agenda'],
  ['dir=b&tema=claro&tela=demandas&vis=quadro&balao=nao&aviso=nao', 'claro', 'demandas'],
  ['dir=c&tema=escuro&tela=documentos&dev=phone&lib=lucide&balao=nao&aviso=nao', 'escuro', 'documentos'],
  ['dir=z&tema=xyz&tela=ia&iconeEstilo=duotone&balao=nao&aviso=nao', 'claro', 'ia'],
  ['dir=d&tema=escuro&tela=config&balao=nao&aviso=nao', 'escuro', 'config'],
];
for (const [h, modo, tela] of ANTIGOS) {
  await abrir(h);
  const r = await pg.evaluate(() => { const a = document.querySelector('.app'); return { dir: a.dataset.dir, tema: a.dataset.tema, tela: window.DM.estado.tela, conteudo: !!document.querySelector('#main') && document.querySelector('#main').children.length > 0 }; });
  ok(r.dir === 'd' && r.tema === modo && r.tela === tela && r.conteudo, '#' + h.split('&').slice(0, 3).join('&') + ' abre o Catalyst (' + r.tema + ', ' + r.tela + ')');
}
// 2) o seletor de direções saiu da interface
await abrir('tema=claro&tela=config&balao=nao&aviso=nao');
const nada = await pg.evaluate(() => ({ g: !!document.querySelector('#g-dir'), c: !!document.querySelector('.tema-c, [data-act="tema-dir"]'), n: !!document.querySelector('#nota-dir'), txt: /Aurora|Papel|Grafite/.test((() => { const c = document.body.cloneNode(true); c.querySelectorAll('.pal').forEach((p) => p.remove()); return c.innerText; })()), titulo: document.title, modo: !!document.querySelector('#g-tema .seg[data-tema="escuro"]') && !!document.querySelector('.cfg [data-act="tema"]') }));
ok(!nada.g && !nada.c && !nada.n, 'sem seletor de direções, sem cartões de tema e sem nota de direção');
ok(!nada.txt, 'nenhum texto da interface cita Aurora, Papel ou Grafite (fora o nome da paleta de cor Grafite)');
ok(nada.modo, 'a escolha entre claro e escuro continua (barra do protótipo e Configurações)');
ok(!/4 temas|experimental/i.test(nada.titulo), 'o título da página não fala em quatro temas (' + nada.titulo + ')');
// 3) trocar o modo continua funcionando e preserva a tela
await pg.click('.cfg [data-act="tema"]');
const modo2 = await pg.evaluate(() => ({ t: document.querySelector('.app').dataset.tema, tela: window.DM.estado.tela }));
ok(modo2.t === 'escuro' && modo2.tela === 'config', 'alternar claro e escuro em Configurações mantém a tela');

// 4) os sete ícones de navegação (Ionicons outline), em claro e escuro, menu recolhido e aberto, computador, iPad e celular
const NOMES = { desktop: ['Início', 'Entradas', 'Demandas', 'Agenda', 'Documentos', 'IA', 'Configurações'], 'tablet-v': ['Início', 'Demandas', 'Agenda'], phone: ['Início', 'Demandas', 'Agenda'] };
const lerIcones = () => pg.evaluate(() => [...document.querySelectorAll('svg.ion')].filter((s) => s.getBoundingClientRect().width).map((s) => { const c = s.firstElementChild, cs = getComputedStyle(c), r = s.getBoundingClientRect(), b = s.closest('button'); return { nome: b && (b.getAttribute('aria-label') || b.textContent.trim()), w: Math.round(r.width), h: Math.round(r.height), sw: cs.strokeWidth, fill: cs.fill, stroke: cs.stroke, op: getComputedStyle(s).opacity, vb: s.getAttribute('viewBox'), oculto: s.getAttribute('aria-hidden'), bb: (() => { const q = s.getBBox ? s.getBBox() : { width: 1 }; return q.width > 0; })(), sel: b && b.getAttribute('aria-current') === 'page', geoOk: [...s.children].every((e) => getComputedStyle(e).fill === 'none' && getComputedStyle(e).strokeWidth === '32px') }; }));
for (const modo of ['claro', 'escuro']) for (const [dev, extra, rotulo] of [['desktop', '', 'menu recolhido'], ['desktop', '&menuAb=true', 'menu aberto'], ['tablet-v', '', 'iPad vertical'], ['phone', '', 'celular']]) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=demandas&balao=nao&aviso=nao' + extra);
  await pg.mouse.move(1470, 990); await pg.waitForTimeout(250);
  const ic = await lerIcones();
  const esperados = NOMES[dev];
  const faltam = esperados.filter((n) => !ic.some((x) => x.nome === n || (x.nome || '').startsWith(n)));
  const ruins = ic.filter((x) => !(x.w >= 18 && x.h >= 18 && x.sw === '32px' && x.fill === 'none' && x.stroke !== 'none' && !/rgba(.*, 0)$/.test(x.stroke) && x.op === '1' && x.vb === '0 0 512 512' && x.oculto === 'true' && x.bb && x.geoOk));
  ok(faltam.length === 0 && ruins.length === 0, modo + ', ' + rotulo + ': ' + ic.length + ' ícones Ionicons visíveis, traço 32, sem preenchimento, cor herdada' + (faltam.length ? ' (faltam: ' + faltam.join(', ') + ')' : '') + (ruins.length ? ' (problema em: ' + ruins.map((x) => x.nome).join(', ') + ')' : ''));
  if (dev === 'desktop' && !extra) { // o selecionado continua em outline e a seleção vem do fundo do item
    const sel = ic.filter((x) => x.sel); ok(sel.length === 1 && sel[0].nome.startsWith('Demandas'), modo + ': o item selecionado (Demandas) mantém o ícone em outline');
  }
}
// ícone de cada menu diferente dos demais (sete desenhos distintos) e nome acessível nos botões
await abrir('tema=claro&dev=desktop&tela=inicio&menuAb=true&balao=nao&aviso=nao');
const dist = await pg.evaluate(() => { const s = [...document.querySelectorAll('.side svg.ion')].map((x) => x.innerHTML); const nomes = [...document.querySelectorAll('.side .navi[data-nav]')].map((b) => b.getAttribute('aria-label')); return { n: s.length, unicos: new Set(s).size, nomes }; });
ok(dist.n === 7 && dist.unicos === 7 && dist.nomes.every(Boolean), 'sete desenhos distintos no menu e todos os botões com nome acessível');

ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : '') + (erros.length ? ': ' + erros[0] : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
