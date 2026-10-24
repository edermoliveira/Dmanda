// Caixas de marcar das tarefas: círculo regular de 22 px em caixa de toque de 44 px, contraste, foco, nome acessível e comportamento
// (tarefa certa, contadores, progresso, frente e verso iguais, sem abrir detalhes, virar o card nem arrastar). Cinco tamanhos, claro e escuro.
// Uso (dentro da pasta prototipo): node testes/checkbox.mjs
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
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(350); };
const tarefas = (id) => pg.evaluate((id) => window.DM.DEMANDAS.find((d) => d.id === id).tarefas.map((t) => t.f), id);

const geometria = () => pg.evaluate(() => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); if (c.startsWith('color(')) for (let k = 0; k < 3; k++) m[k] *= 255; const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
  const ctr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  return [...document.querySelectorAll('input[type=checkbox][data-act="tarefa"]')].filter((c) => c.getBoundingClientRect().width).map((c) => {
    const r = c.getBoundingClientRect(), cs = getComputedStyle(c), lado = c.closest('.back') ? 'verso' : c.closest('.mini-card') ? 'quadro' : 'frente', face = c.closest('.face, .mini-card'), fb = face ? getComputedStyle(face).backgroundColor : 'rgb(255, 255, 255)';
    const anel = (cs.boxShadow.match(/rgba?\([^)]*\)|color\([^)]*\)/) || [''])[0];
    return { lado, w: r.width, h: r.height, borda: cs.borderTopWidth, raio: cs.borderRadius, visual: r.width - 2 * parseFloat(cs.borderTopWidth), marcado: c.checked, rotulo: c.getAttribute('aria-label'), fundo: cs.backgroundColor, anel, ctrAnel: c.checked ? 9 : Math.round(ctr(anel, cs.backgroundColor) * 10) / 10, marca: cs.backgroundImage !== 'none', fb };
  });
});

for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'tablet-h', 'media', 'tablet-v', 'phone']) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=cards&balao=nao&aviso=nao');
  await pg.evaluate(() => { document.querySelectorAll('.dcard').forEach((c) => { c.dataset.fix = 'verso'; }); }); await pg.waitForTimeout(900);
  const verso = await geometria();
  await pg.evaluate(() => { document.querySelectorAll('.dcard').forEach((c) => { c.dataset.fix = 'frente'; }); }); await pg.waitForTimeout(900);
  const frente = await geometria();
  const todos = verso.filter((x) => x.lado === 'verso').concat(frente.filter((x) => x.lado === 'frente'));
  const ruins = todos.filter((x) => !(x.w === 44 && x.h === 44 && x.visual === 22 && x.borda === '11px' && /50%/.test(x.raio) && x.rotulo && /^Concluir a tarefa: /.test(x.rotulo) && (x.marcado ? x.marca : x.ctrAnel >= 3)));
  ok(todos.length >= 6 && ruins.length === 0, modo + ', ' + dev + ': ' + todos.length + ' caixas (frente e verso), todas com círculo de 22 px em área de 44 px, contorno com contraste >= 3, marcadas com sinal e nome acessível' + (ruins.length ? ' ' + JSON.stringify(ruins.slice(0, 2)) : ''));
}

// comportamento: frente e verso (desktop e celular), claro e escuro
for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'phone']) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=cards&balao=nao&aviso=nao');
  const antes = await tarefas(1); // demanda 1: duas feitas, três pendentes
  const etapa0 = await pg.evaluate(() => window.DM.DEMANDAS.find((d) => d.id === 1).etapa);
  await pg.evaluate(() => { window.DM.estado.fixo[1] = 'frente'; document.querySelector('.dcard[data-id="1"]').dataset.fix = 'frente'; });
  await pg.click('.dcard[data-id="1"] .face.front .prox-t input'); await pg.waitForTimeout(300);
  let t = await tarefas(1);
  const est = await pg.evaluate(() => ({ modal: !!window.DM.estado.modal, fix: document.querySelector('.dcard[data-id="1"]').dataset.fix, prog: document.querySelector('.dcard[data-id="1"] .face.front .prog b').textContent, barra: document.querySelector('.dcard[data-id="1"] .face.front .barra').getAttribute('aria-valuenow'), prox: document.querySelector('.dcard[data-id="1"] .face.front .prox-c .t-txt').textContent }));
  ok(t[2] === true && t.filter(Boolean).length === 3 && !est.modal && est.fix === 'frente' && /^3\/5/.test(est.prog) && est.barra === '60', modo + ', ' + dev + ' frente: marcar a próxima tarefa atualiza a tarefa 3, o contador (' + est.prog + ') e o progresso (' + est.barra + '%), sem abrir detalhes nem virar o card; a próxima passa a ser "' + est.prox + '"');
  await pg.evaluate(() => { window.DM.estado.fixo[1] = 'verso'; document.querySelector('.dcard[data-id="1"]').dataset.fix = 'verso'; }); await pg.waitForTimeout(800);
  const verso = await pg.evaluate(() => [...document.querySelectorAll('.dcard[data-id="1"] .face.back .tarefas input[type=checkbox]')].map((c) => c.checked));
  ok(JSON.stringify(verso) === JSON.stringify(t.slice(0, verso.length)), modo + ', ' + dev + ': o verso mostra o mesmo estado da frente (' + verso.join(',') + ')');
  await pg.click('.dcard[data-id="1"] .face.back .tarefas li:nth-child(1) input'); await pg.waitForTimeout(300);
  t = await tarefas(1);
  const est2 = await pg.evaluate(() => ({ modal: !!window.DM.estado.modal, fix: document.querySelector('.dcard[data-id="1"]').dataset.fix, prog: document.querySelector('.dcard[data-id="1"] .face.front .prog b').textContent }));
  ok(t[0] === false && t.filter(Boolean).length === 2 && !est2.modal && est2.fix === 'verso' && /^2\/5/.test(est2.prog), modo + ', ' + dev + ' verso: desmarcar a tarefa 1 atualiza só ela, o contador (' + est2.prog + ') e mantém o verso aberto, sem detalhes');
  ok(await pg.evaluate(() => window.DM.DEMANDAS.find((d) => d.id === 1).etapa) === etapa0, modo + ', ' + dev + ': marcar e desmarcar não muda a etapa nem a classificação da demanda');
  // restaura os dados para o próximo cenário
  await pg.evaluate((a) => { window.DM.DEMANDAS.find((d) => d.id === 1).tarefas.forEach((x, i) => { x.f = a[i]; }); }, antes);
}
// finalizar continua sendo uma ação explícita: marcar todas as tarefas não conclui a demanda sozinho
await abrir('tema=claro&dev=desktop&tela=demandas&vis=cards&balao=nao&aviso=nao');
for (let i = 0; i < 3; i++) { await pg.evaluate(() => { document.querySelector('.dcard[data-id="1"]').dataset.fix = 'frente'; window.DM.estado.fixo[1] = 'frente'; }); const c = await pg.$('.dcard[data-id="1"] .face.front .prox-t input'); if (c) { await c.click(); await pg.waitForTimeout(250); } }
const fim = await pg.evaluate(() => ({ etapa: window.DM.DEMANDAS.find((d) => d.id === 1).etapa, todas: window.DM.DEMANDAS.find((d) => d.id === 1).tarefas.every((t) => t.f), botao: !!document.querySelector('.dcard[data-id="1"] .face.front [data-act="concluir"]') }));
ok(fim.todas && fim.etapa === 'Fazendo' && fim.botao, 'com todas as tarefas marcadas a demanda continua em Fazendo e passa a oferecer "Concluir demanda" (regra existente preservada)');
// teclado: Tab chega, foco visível rente ao círculo, espaço marca, estado acessível muda
await abrir('tema=claro&dev=desktop&tela=demandas&vis=cards&balao=nao&aviso=nao');
await pg.evaluate(() => { document.querySelector('.dcard[data-id="1"]').dataset.fix = 'frente'; window.DM.estado.fixo[1] = 'frente'; });
await pg.focus('.dcard[data-id="1"] .face.front .assunto'); await pg.keyboard.press('Tab');
let foco = await pg.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { cb: a.type === 'checkbox', ow: parseFloat(cs.outlineWidth), os: cs.outlineStyle, off: parseFloat(cs.outlineOffset), id: a.dataset.id }; });
ok(foco.cb && foco.ow >= 3 && foco.os !== 'none' && foco.off === -9, 'teclado: Tab chega na caixa da próxima tarefa com anel de foco de ' + foco.ow + ' px rente ao círculo (deslocamento ' + foco.off + ' px)');
await pg.keyboard.press('Space'); await pg.waitForTimeout(300);
const t2 = await tarefas(1); ok(t2[2] === true, 'teclado: a barra de espaço marca a tarefa certa (' + t2.join(',') + ')');
// no Quadro, marcar a tarefa não inicia arraste nem abre detalhes
await abrir('tema=claro&dev=desktop&tela=demandas&vis=quadro&menuAb=false&balao=nao&aviso=nao');
const cx = await (await pg.$('.mini-card[data-id="1"] .prox-t input')).boundingBox();
await pg.mouse.move(cx.x + 22, cx.y + 22); await pg.mouse.down(); await pg.mouse.move(cx.x + 160, cx.y + 30, { steps: 6 });
const arr = await pg.evaluate(() => !!document.querySelector('.fantasma')); await pg.mouse.up(); await pg.waitForTimeout(250);
ok(!arr && !(await pg.evaluate(() => !!window.DM.estado.modal)), 'Quadro: pressionar a caixa da tarefa e mover não arrasta nem abre detalhes');
await pg.click('.mini-card[data-id="1"] .prox-t input'); await pg.waitForTimeout(250);
ok(!(await pg.evaluate(() => !!window.DM.estado.modal)) && (await tarefas(1)).filter(Boolean).length >= 3, 'Quadro: clicar na caixa marca a tarefa sem abrir detalhes');
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
