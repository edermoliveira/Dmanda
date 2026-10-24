// Cards de demandas em duas colunas no iPad vertical (container de 521 a 899 px), uma coluna no celular (até 520 px)
// e a grade automática a partir de 900 px. Confere a quantidade de colunas, o encaixe do conteúdo de cada card (sem sobreposição
// nem corte), a descrição resumida só no modo compacto e a descrição completa nos detalhes. Claro e escuro.
// Uso (dentro da pasta prototipo): node testes/ipad-cards.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await nav.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(250); };
const largura = (w) => pg.evaluate((w) => { const f = document.querySelector('.frame'); f.style.setProperty('--w', (w + (f.offsetWidth - f.clientWidth)) + 'px'); }, w);

const medir = () => pg.evaluate(() => {
  const larg = document.querySelector('.frame').clientWidth;
  const grades = [...document.querySelectorAll('.cards')].filter((g) => g.getBoundingClientRect().width).map((g) => {
    const cs = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
    const cards = [...g.querySelectorAll('.dcard')];
    const lefts = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left)));
    const encaixe = cards.map((c) => {
      const fr = c.querySelector('.face.front'), rf = fr.getBoundingClientRect(), filhos = [...fr.children].map((x) => x.getBoundingClientRect()).filter((r) => r.height);
      const corte = filhos.some((r) => r.bottom > rf.bottom - 1 || r.right > rf.right + 1 || r.left < rf.left - 1);
      let sobre = false; for (let i = 1; i < filhos.length; i++) if (filhos[i].top < filhos[i - 1].bottom - 1) sobre = true;
      const d = c.querySelector('.desc'), assunto = c.querySelector('.assunto');
      return { id: c.dataset.id, corte, sobre, descLinhas: d ? Math.round(d.getBoundingClientRect().height / parseFloat(getComputedStyle(d).lineHeight)) : 0, descTrunca: d ? d.scrollHeight > d.clientHeight + 1 : false, titulo: assunto && assunto.getBoundingClientRect().height > 8, w: Math.round(rf.width) };
    });
    return { cols: cs, colunasVisuais: lefts.size, n: cards.length, encaixe };
  });
  return { larg, grades };
});

for (const modo of ['claro', 'escuro']) {
  for (const [w, esperado] of [[390, 1], [520, 1], [521, 1], [639, 1], [640, 2], [700, 2], [820, 2], [899, 2]]) {
    for (const tela of ['demandas&vis=cards', 'inicio']) {
      await abrir('tema=' + modo + '&dev=desktop&tela=' + tela + '&balao=nao&aviso=nao'); await largura(w); await pg.evaluate(() => window.dispatchEvent(new Event('resize'))); await pg.waitForTimeout(400);
      const m = await medir();
      const g = m.grades[0];
      const certo = m.larg === w && g && g.colunasVisuais === Math.min(esperado, g.n) && m.grades.every((x) => x.encaixe.every((e) => !e.corte && !e.sobre && e.titulo));
      ok(certo, modo + ', container ' + m.larg + ' px, ' + tela.split('&')[0] + ': ' + (g ? g.colunasVisuais : '?') + ' coluna(s) de cards (esperado ' + esperado + '), ' + (g ? g.n : 0) + ' cards, sem sobreposição nem corte' + (g && !certo ? ' ' + JSON.stringify(g.encaixe.filter((e) => e.corte || e.sobre || !e.titulo)) : ''));
      if (w === 820 && tela.startsWith('demandas')) {
        const compactas = g.encaixe.filter((e) => e.descLinhas);
        ok(compactas.length > 0 && compactas.every((e) => e.descLinhas <= 2), modo + ', 820 px: a descrição ocupa no máximo 2 linhas no modo compacto (' + compactas.map((e) => e.descLinhas).join(',') + ')');
      }
    }
  }
  // a partir de 900 px, a grade automática anterior continua (3 colunas ou mais conforme o espaço)
  await abrir('tema=' + modo + '&dev=desktop&tela=demandas&vis=cards&balao=nao&aviso=nao');
  const d = await medir();
  ok(d.grades[0].colunasVisuais >= 3 && d.grades[0].encaixe.every((e) => e.descLinhas === 0 || e.descLinhas <= 3), modo + ', computador (' + d.larg + ' px): ' + d.grades[0].colunasVisuais + ' colunas, descrição de até 3 linhas como antes');
  // descrição completa nos detalhes (iPad vertical)
  await abrir('tema=' + modo + '&dev=tablet-v&tela=demandas&vis=cards&balao=nao&aviso=nao');
  await pg.click('.dcard .assunto >> nth=0'); await pg.waitForTimeout(500);
  const det = await pg.evaluate(() => { const x = document.querySelector('#d-descricao, #m-descricao'); return x ? x.value : ''; });
  ok(/Tribunal de Contas pediu esclarecimentos sobre as diárias pagas em 2025/.test(det) && /antes do protocolo./.test(det), modo + ', iPad vertical: os detalhes da demanda mostram a descrição completa (' + det.length + ' caracteres)');
  await pg.keyboard.press('Escape');
}
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
