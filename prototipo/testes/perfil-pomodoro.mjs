// Perfil (avatar redondo e centrado) e Pomodoro (conjunto "número + min" centrado no anel, sem pontilhado) em todos os aparelhos, claro e escuro.
// Uso (dentro da pasta prototipo): node testes/perfil-pomodoro.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const DEVS = ['desktop', 'tablet-h', 'media', 'tablet-v', 'phone'];
const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await nav.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(200); };

const medePerfil = () => pg.evaluate(() => {
  const b = document.querySelector('.perfil-b'), a = b.querySelector('.avatar'), rb = b.getBoundingClientRect(), ra = a.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(a); const rt = rg.getBoundingClientRect();
  return { bw: Math.round(rb.width * 10) / 10, bh: Math.round(rb.height * 10) / 10, aw: Math.round(ra.width * 10) / 10, ah: Math.round(ra.height * 10) / 10, brad: getComputedStyle(a).borderRadius,
    dxA: Math.round(((ra.left + ra.width / 2) - (rb.left + rb.width / 2)) * 10) / 10, dyA: Math.round(((ra.top + ra.height / 2) - (rb.top + rb.height / 2)) * 10) / 10,
    dxT: Math.round(((rt.left + rt.width / 2) - (ra.left + ra.width / 2)) * 10) / 10, letra: a.textContent, comNome: getComputedStyle(b.querySelector('.tx')).display !== 'none' };
});

for (const modo of ['claro', 'escuro']) for (const dev of DEVS) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=inicio&balao=nao&aviso=nao');
  for (const nome of ['Secretário', 'Maria', 'Wesley', 'Ágata']) {
    await pg.evaluate((n) => window.DM.trocar({ nome: n }), nome);
    await pg.waitForTimeout(80);
    const m = await medePerfil();
    const esperada = nome.charAt(0).toUpperCase();
    const certo = m.aw === 36 && m.ah === 36 && m.letra === esperada && m.bh >= 44 && Math.abs(m.dyA) <= 0.6 && Math.abs(m.dxT) <= 1.2 && (m.brad.includes('50%') || m.brad.includes('px'))
      && (m.comNome ? m.bw >= 44 : m.bw >= 44 && Math.abs(m.dxA) <= 0.6);
    ok(certo, modo + ', ' + dev + ', "' + nome + '": avatar ' + m.aw + 'x' + m.ah + ' com a inicial ' + m.letra + ' centrada (letra ' + m.dxT + ' px), botão ' + m.bw + 'x' + m.bh + (m.comNome ? ' com nome' : ', centro do avatar a ' + m.dxA + ' px do botão'));
  }
}

// Pomodoro
const medePomo = () => pg.evaluate(() => {
  const anel = document.querySelector('.pomo-anel'), ra = anel.getBoundingClientRect(), cx = ra.left + ra.width / 2, cy = ra.top + ra.height / 2, raioInt = ra.width / 2 - 7;
  const g = document.querySelector('.pomo-ed') || document.querySelector('.pomo-t'), rg = g.getBoundingClientRect();
  const dentro = [[rg.left, rg.top], [rg.right, rg.top], [rg.left, rg.bottom], [rg.right, rg.bottom]].every(([x, y]) => Math.hypot(x - cx, y - cy) <= raioInt);
  const o = { dx: Math.round(((rg.left + rg.width / 2) - cx) * 10) / 10, dy: Math.round(((rg.top + rg.height / 2) - cy) * 10) / 10, dentro, anel: Math.round(ra.width) };
  const inp = document.querySelector('.pomo-ed input'), sp = document.querySelector('.pomo-ed span');
  if (inp) {
    const ri = inp.getBoundingClientRect(), rs = sp.getBoundingClientRect(), cs = getComputedStyle(inp);
    Object.assign(o, { valor: inp.value, max: inp.max, mesmaLinha: rs.top >= rg.top - 1 && rs.bottom <= rg.bottom + 1 && rg.height <= parseFloat(cs.fontSize) * 1.8, aDireita: rs.left >= ri.right - 1 && rs.left - ri.right <= 8, minPx: parseFloat(getComputedStyle(sp).fontSize), numPx: parseFloat(cs.fontSize),
      bordaEstilo: cs.borderBottomStyle, bordaCor: cs.borderBottomColor, wInp: Math.round(ri.width * 10) / 10 });
  }
  return o;
});
for (const modo of ['claro', 'escuro']) for (const dev of DEVS) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=inicio&balao=nao&aviso=nao');
  let m = await medePomo();
  ok(m.valor === '25' && m.max === '180', modo + ', ' + dev + ': a sugestão inicial é 25 e o limite continua 180');
  for (const v of ['5', '25', '180']) {
    await pg.fill('[data-pomo-min]', v); await pg.waitForTimeout(60);
    m = await medePomo();
    const c2 = m.valor === v && Math.abs(m.dx) <= 1.5 && m.dentro && m.mesmaLinha && m.aDireita && Math.abs(m.minPx - 10.4) < 0.1;
    ok(c2, modo + ', ' + dev + ', ' + v + ' min: conjunto centrado no anel de ' + m.anel + ' px (desvio ' + m.dx + ' px), dentro do círculo, "min" à direita na mesma linha (' + m.minPx + ' px)');
  }
  // sem pontilhado fora do foco; indicação visível no foco
  await pg.fill('[data-pomo-min]', '25'); await pg.evaluate(() => document.activeElement && document.activeElement.blur()); await pg.waitForTimeout(80);
  m = await medePomo();
  ok(m.bordaEstilo !== 'dashed' && /rgba\(0, 0, 0, 0\)|transparent/.test(m.bordaCor), modo + ', ' + dev + ': sem sublinhado pontilhado fora do foco (' + m.bordaEstilo + ' ' + m.bordaCor + ')');
  await pg.focus('[data-pomo-min]'); await pg.waitForTimeout(80);
  m = await medePomo();
  ok(m.bordaEstilo === 'solid' && !/rgba\(0, 0, 0, 0\)|transparent/.test(m.bordaCor), modo + ', ' + dev + ': no foco aparece o sublinhado contínuo (' + m.bordaCor + ')');
  // tempo correndo com o maior valor permitido: "180:00" cabe no anel
  await pg.fill('[data-pomo-min]', '180'); await pg.evaluate(() => document.activeElement.blur()); await pg.waitForTimeout(100);
  await pg.click('[data-act="pomo-play"]'); await pg.waitForTimeout(200);
  m = await medePomo();
  ok(m.dentro && Math.abs(m.dx) <= 1.5, modo + ', ' + dev + ': contagem de 180 min cabe no anel e fica centrada (desvio ' + m.dx + ' px)');
  await pg.click('[data-act="pomo-play"]'); await pg.click('[data-act="pomo-zerar"]'); await pg.waitForTimeout(100);
  const volta = await pg.evaluate(() => !!document.querySelector('[data-pomo-min]'));
  ok(volta, modo + ', ' + dev + ': pausar e recomeçar volta ao campo de minutos (funcionamento mantido)');
}
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
