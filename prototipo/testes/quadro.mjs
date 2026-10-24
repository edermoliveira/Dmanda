// Quadro de Demandas: largura das colunas, rolagem dentro do Quadro, filtros e chips sem corte nas telas estreitas,
// movimentação entre etapas (menu "Mover para", arraste por mouse e por toque) e proteção contra arraste acidental.
// Uso (dentro da pasta prototipo): node testes/quadro.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const erros = [];
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const novaPagina = async (opc = {}) => {
  const ctx = await nav.newContext(Object.assign({ viewport: { width: 1480, height: 1000 } }, opc));
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(String(e.message || e)));
  pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
  pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
  return pg;
};
const abrir = async (pg, h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(300); };
const etapaDe = (pg, id) => pg.evaluate((id) => window.DM.DEMANDAS.find((d) => d.id === id).etapa, id);
const estadoDe = (pg, id) => pg.evaluate((id) => { const d = window.DM.DEMANDAS.find((x) => x.id === id); return JSON.stringify({ tipo: d.tipo, area: d.area, prazo: d.prazo, prazoTipo: d.prazoTipo, tarefas: d.tarefas, assunto: d.assunto, etapa: d.etapa, concluido: d.concluido }); }, id);

// ---------- 1) largura das colunas e rolagem horizontal dentro do Quadro (computador, iPad horizontal, janela média) ----------
const pg = await novaPagina();
for (const modo of ['claro', 'escuro']) for (const [dev, extra] of [['desktop', '&menuAb=false'], ['desktop', '&menuAb=true'], ['tablet-h', ''], ['media', '']]) {
  await abrir(pg, 'tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=quadro&balao=nao&aviso=nao' + extra);
  const m = await pg.evaluate(() => {
    const q = document.querySelector('.quadro'), main = document.querySelector('.main'), tb = document.querySelector('.toolbar'), cols = [...document.querySelectorAll('.coluna')];
    const larg = cols.map((c) => Math.round(c.getBoundingClientRect().width));
    const cab = cols.map((c) => { const h = c.querySelector('header'), rc = c.getBoundingClientRect(), rects = [...h.children].map((x) => x.getBoundingClientRect()).filter((r) => r.width); const t = h.querySelector('h4'); return { dentro: rects.every((r) => r.left >= rc.left - .5 && r.right <= rc.right + .5), titulo: t.scrollWidth <= t.clientWidth + 1 }; });
    return { larg, scroll: q.scrollWidth > q.clientWidth + 1, ox: getComputedStyle(q).overflowX, paginaOk: main.scrollWidth <= main.clientWidth + 1, barraOk: tb.scrollWidth <= tb.clientWidth + 2 /* 2 px é só a área de toque invisível (::after) dos botões */, quadroNaPagina: q.getBoundingClientRect().right <= main.getBoundingClientRect().right + 1, cabOk: cab.every((c) => c.dentro && c.titulo), cont: q.clientWidth };
  });
  const minimo = Math.min(...m.larg);
  ok(m.larg.length === 5 && minimo >= 300 && m.ox === 'auto' && m.paginaOk && m.barraOk && m.quadroNaPagina && m.cabOk && (m.scroll || m.larg.reduce((a, b) => a + b, 0) + 4 * 14 <= m.cont + 1),
    modo + ', ' + dev + (extra ? ' ' + extra.slice(1) : '') + ': 5 colunas de ' + minimo + ' a ' + Math.max(...m.larg) + ' px, Quadro com rolagem própria (' + (m.scroll ? 'rola' : 'cabe') + '), página e barra de ferramentas dentro da tela, cabeçalhos legíveis');
}

// ---------- 2) telas estreitas: filtros, busca e chips sem corte ----------
for (const modo of ['claro', 'escuro']) for (const dev of ['tablet-v', 'phone']) {
  await abrir(pg, 'tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=quadro&balao=nao&aviso=nao');
  const m = await pg.evaluate(() => {
    const tb = document.querySelector('.toolbar'), rt = tb.getBoundingClientRect(), tabs = document.querySelector('.etapas-tabs'), rtab = tabs.getBoundingClientRect();
    const filhos = [...tb.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width);
    const inp = document.querySelector('#fq'), cs = getComputedStyle(inp), cv = document.createElement('canvas').getContext('2d'); cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const placeholder = cv.measureText(inp.placeholder).width, util = inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const sel = tabs.querySelector('[aria-pressed="true"]'), rs = sel.getBoundingClientRect();
    const chips = [...tabs.children].map((c) => c.getBoundingClientRect());
    return { barraDentro: filhos.every((r) => r.left >= rt.left - .5 && r.right <= rt.right + .5), barraSem: tb.scrollWidth <= tb.clientWidth + 2 /* 2 px é só a área de toque invisível (::after) dos botões */, placeholderCabe: placeholder <= util + 1, ph: Math.round(placeholder) + '/' + Math.round(util), selDentro: rs.left - 3 >= rtab.left - .5 && rs.top - 3 >= rtab.top - .5 && rs.bottom + 3 <= rtab.bottom + .5,
      larguras: chips.map((r) => Math.round(r.width)), rola: tabs.scrollWidth > tabs.clientWidth + 1, alturas: chips.map((r) => Math.round(r.height)) };
  });
  ok(m.barraDentro && m.barraSem && m.placeholderCabe && m.selDentro, modo + ', ' + dev + ': filtro (texto ' + m.ph + ' px), botões e busca dentro da barra, chip selecionado com a borda inteira visível');
  // primeiro e último chip alcançáveis pela rolagem horizontal
  const alcance = await pg.evaluate(() => { const t = document.querySelector('.etapas-tabs'); t.scrollLeft = 0; const a = t.firstElementChild.getBoundingClientRect(), rt = t.getBoundingClientRect(), primeiro = a.left >= rt.left + 1; t.scrollLeft = t.scrollWidth; const z = t.lastElementChild.getBoundingClientRect(), ultimo = z.right <= rt.right - 1; t.scrollLeft = 0; return { primeiro, ultimo }; });
  ok(alcance.primeiro && alcance.ultimo, modo + ', ' + dev + ': primeiro e último chip de etapa alcançáveis com folga pela rolagem horizontal');
}

// ---------- 3) movimentação pelo menu (teclado e clique) ----------
await abrir(pg, 'tema=claro&dev=desktop&tela=demandas&vis=quadro&menuAb=false&balao=nao&aviso=nao');
const antes4 = await estadoDe(pg, 4);               // Cadastro
await pg.click('.mini-card[data-id="4"] .mais');
const menu = await pg.evaluate(() => { const m = document.querySelector('.mv-menu'); return m && { itens: [...m.querySelectorAll('button')].map((b) => b.dataset.et + (b.getAttribute('aria-checked') === 'true' ? '*' : '') + (b.getAttribute('aria-disabled') === 'true' ? '-' : '')), foco: document.activeElement.dataset.et, papel: m.getAttribute('role') }; });
ok(menu && menu.papel === 'menu' && menu.itens.join() === 'Cadastro*-,Vistos,Fazendo,Aguardando retorno,Finalizado' && menu.foco === 'Vistos', 'menu "Mover para": cinco etapas, a atual marcada e desativada, foco na primeira opção possível (' + (menu && menu.itens.join(' ')) + ')');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
const fechou = await pg.evaluate(() => ({ menu: !!document.querySelector('.mv-menu'), foco: document.activeElement.className }));
ok(!fechou.menu && /mais/.test(fechou.foco), 'Esc fecha o menu e devolve o foco ao botão do card');
await pg.click('.mini-card[data-id="4"] .mais'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
ok((await etapaDe(pg, 4)) === 'Fazendo', 'teclado: seta e Enter movem a demanda 4 de Cadastro para Fazendo');
const depois4 = JSON.parse(await estadoDe(pg, 4)), orig4 = JSON.parse(antes4);
ok(depois4.prazo === orig4.prazo && depois4.prazoTipo === orig4.prazoTipo && depois4.tipo === orig4.tipo && depois4.area === orig4.area && JSON.stringify(depois4.tarefas) === JSON.stringify(orig4.tarefas) && depois4.assunto === orig4.assunto, 'mover não altera prazo, classificação, assunto nem tarefas');
// concluir pelo menu = mesma transição do botão "Concluir demanda"
const mover3 = await pg.evaluate(() => { const d = window.DM.DEMANDAS.find((x) => x.id === 3); return d.tarefas.length; });
await pg.click('.mini-card[data-id="3"] .mais'); await pg.click('.mv-menu button[data-et="Finalizado"]'); await pg.waitForTimeout(300);
const f3 = JSON.parse(await estadoDe(pg, 3));
ok(f3.etapa === 'Finalizado' && f3.concluido === '21/10' && f3.tarefas.every((t) => t.f), 'concluir pelo menu: etapa Finalizado, concluída em 21/10 e tarefas marcadas, como no botão "Concluir demanda" (' + mover3 + ' tarefas)');
await pg.click('.mini-card[data-id="3"] .mais');
const bloq = await pg.evaluate(() => [...document.querySelectorAll('.mv-menu button')].map((b) => b.dataset.et + (b.getAttribute('aria-disabled') === 'true' ? '-' : '')).join());
ok(bloq === 'Cadastro-,Vistos-,Fazendo,Aguardando retorno-,Finalizado-', 'demanda finalizada só pode voltar para Fazendo (reabrir), como no botão "Reabrir demanda" (' + bloq + ')');
await pg.click('.mv-menu button[data-et="Fazendo"]'); await pg.waitForTimeout(300);
const r3 = JSON.parse(await estadoDe(pg, 3));
ok(r3.etapa === 'Fazendo' && r3.concluido === null, 'reabrir pelo menu: volta para Fazendo e limpa a data de conclusão');

// Aguardando retorno: o destino é respeitado e nenhum setor, prazo ou data é inventado
{
  const antes = await pg.evaluate(() => { const d = window.DM.DEMANDAS.find((x) => x.id === 7); return JSON.stringify({ setor: d.setor, diasAg: d.diasAg, acompanhar: d.acompanhar, prazo: d.prazo }); });
  await pg.click('.mini-card[data-id="7"] .mais'); await pg.click('.mv-menu button[data-et="Aguardando retorno"]'); await pg.waitForTimeout(300);
  const dep = await pg.evaluate(() => { const d = window.DM.DEMANDAS.find((x) => x.id === 7); return { etapa: d.etapa, setor: d.setor, diasAg: d.diasAg, acompanhar: d.acompanhar, prazo: d.prazo, texto: document.querySelector('.quadro').innerText, aviso: document.querySelector('#toast').textContent }; });
  ok(dep.etapa === 'Aguardando retorno' && JSON.stringify({ setor: dep.setor, diasAg: dep.diasAg, acompanhar: dep.acompanhar, prazo: dep.prazo }) === antes && !/undefined|NaN/.test(dep.texto), 'mover para Aguardando retorno respeita o destino sem inventar setor, dias nem data de acompanhamento, e a tela não mostra "undefined"');
  ok(/Informe o setor e a data de acompanhamento/.test(dep.aviso), 'o aviso diz que setor e acompanhamento ficam para o usuário informar (' + dep.aviso + ')');
}

// ---------- 4) arraste por mouse ----------
await abrir(pg, 'tema=claro&dev=desktop&tela=demandas&vis=quadro&menuAb=false&balao=nao&aviso=nao');
const centro = async (sel) => { const b = await (await pg.$(sel)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
const alvoCol = async (nome) => { const b = await (await pg.$('.coluna[aria-label="' + nome + '"] header')).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 + 30 }; };
{
  const c = await centro('.mini-card[data-id="9"] .assunto'); // Cadastro
  await pg.mouse.move(c.x, c.y); await pg.mouse.down(); await pg.mouse.move(c.x + 20, c.y + 10, { steps: 4 });
  const t = await alvoCol('Vistos'); await pg.mouse.move(t.x, t.y, { steps: 8 }); await pg.waitForTimeout(100);
  const durante = await pg.evaluate(() => ({ fantasma: !!document.querySelector('.fantasma'), original: document.querySelector('.mini-card[data-id="9"]').classList.contains('arrastando'), alvo: (document.querySelector('.coluna.alvo') || {}).ariaLabel || (document.querySelector('.coluna.alvo') && document.querySelector('.coluna.alvo').getAttribute('aria-label')) }));
  ok(durante.fantasma && durante.original && durante.alvo === 'Vistos', 'arraste por mouse: card fantasma segue o ponteiro, original esmaecido e coluna "' + durante.alvo + '" destacada');
  await pg.mouse.up(); await pg.waitForTimeout(300);
  const sem = await pg.evaluate(() => ({ modal: !!window.DM.estado.modal, fantasma: !!document.querySelector('.fantasma'), alvo: !!document.querySelector('.alvo') }));
  ok((await etapaDe(pg, 9)) === 'Vistos' && !sem.modal && !sem.fantasma && !sem.alvo, 'soltar na coluna Vistos move a demanda 9, sem abrir detalhes nem deixar marcas');
}
{ // clique simples continua abrindo a demanda
  await pg.click('.mini-card[data-id="2"] .assunto'); await pg.waitForTimeout(250);
  ok(await pg.evaluate(() => window.DM.estado.modal && window.DM.estado.modal.id === 2), 'clique simples no título (sem arrastar) continua abrindo a demanda');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
}
{ // controles do card não iniciam arraste: caixa de marcar, botão de menu e "Concluir demanda"
  await abrir(pg, 'tema=claro&dev=desktop&tela=demandas&vis=quadro&menuAb=false&balao=nao&aviso=nao');
  const caixa = await pg.$('.mini-card[data-id="1"] .prox-t input');
  const b = await caixa.boundingBox(); await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await pg.mouse.down(); await pg.mouse.move(b.x + 120, b.y + 40, { steps: 6 });
  const semDrag = await pg.evaluate(() => !document.querySelector('.fantasma'));
  await pg.mouse.up(); await pg.waitForTimeout(200);
  ok(semDrag, 'pressionar a caixa de marcar da tarefa e mover não inicia arraste');
  const m = await centro('.mini-card[data-id="1"] .mais'); await pg.mouse.move(m.x, m.y); await pg.mouse.down(); await pg.mouse.move(m.x + 100, m.y + 30, { steps: 5 });
  const semDrag2 = await pg.evaluate(() => !document.querySelector('.fantasma'));
  await pg.mouse.up(); await pg.waitForTimeout(150);
  ok(semDrag2, 'pressionar o botão de menu do card e mover não inicia arraste');
  await pg.keyboard.press('Escape');
}
// colunas fora da área visível: rolagem automática nas bordas (janela média)
{
  await abrir(pg, 'tema=claro&dev=media&tela=demandas&vis=quadro&balao=nao&aviso=nao');
  const q = await pg.evaluate(() => { const e = document.querySelector('.quadro'); return { sw: e.scrollWidth, cw: e.clientWidth }; });
  const c = await centro('.mini-card[data-id="9"] .assunto'); const qb = await (await pg.$('.quadro')).boundingBox();
  await pg.mouse.move(c.x, c.y); await pg.mouse.down(); await pg.mouse.move(c.x + 15, c.y + 5, { steps: 3 });
  await pg.mouse.move(qb.x + qb.width - 20, c.y, { steps: 10 }); await pg.waitForTimeout(900);
  const sl = await pg.evaluate(() => document.querySelector('.quadro').scrollLeft);
  ok(q.sw > q.cw && sl > 100, 'arraste junto à borda direita rola o Quadro e revela colunas fora da área visível (rolou ' + sl + ' px de ' + (q.sw - q.cw) + ')');
  await pg.mouse.move(qb.x + qb.width - 60, qb.y + 200, { steps: 4 });
  const t = await pg.evaluate(() => { const c = document.querySelector('.coluna[aria-label="Finalizado"]').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + 80 }; });
  await pg.mouse.move(t.x, t.y, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  ok((await etapaDe(pg, 9)) === 'Finalizado', 'soltar sobre a coluna Finalizado, que estava fora da tela, conclui a demanda');
  const tar = await pg.evaluate(() => window.DM.DEMANDAS.find((d) => d.id === 9).tarefas.every((t) => t.f));
  ok(tar, 'a conclusão por arraste usa a mesma regra de "Concluir demanda" (tarefas marcadas)');
}
await pg.context().close();

// ---------- 5) arraste por toque (celular e iPad vertical): abas de etapa como destino ----------
for (const dev of ['phone', 'tablet-v']) {
  const pt = await novaPagina({ hasTouch: true, viewport: { width: 1480, height: 1000 } });
  await abrir(pt, 'tema=claro&dev=' + dev + '&tela=demandas&vis=quadro&balao=nao&aviso=nao');
  const cdp = await pt.context().newCDPSession(pt);
  const toque = (tipo, x, y) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tipo === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const pos = async (sel) => { const b = await (await pt.$(sel)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  await pt.evaluate(() => window.DM.trocar({ etapaSel: 'Cadastro' })); await pt.waitForTimeout(300);
  const id = await pt.evaluate(() => +document.querySelector('.coluna.sel .mini-card').dataset.id);
  const origem = await etapaDe(pt, id);
  // deslizar rápido: é rolagem, não arraste
  let c = await pos('.coluna.sel .mini-card[data-id="' + id + '"] .assunto');
  await toque('touchStart', c.x, c.y); await toque('touchMove', c.x, c.y - 40); await toque('touchMove', c.x, c.y - 80); await pt.waitForTimeout(500); await toque('touchEnd');
  const rapido = await pt.evaluate(() => !document.querySelector('.fantasma') && !document.querySelector('.arrastando'));
  ok(rapido && (await etapaDe(pt, id)) === origem, dev + ': deslizar o dedo sobre o card rola a página e não inicia arraste');
  // segurar e arrastar até a aba Fazendo
  await pt.evaluate(() => window.scrollTo(0, 0)); c = await pos('.coluna.sel .mini-card[data-id="' + id + '"] .assunto');
  await toque('touchStart', c.x, c.y); await pt.waitForTimeout(520);
  const seg = await pt.evaluate(() => !!document.querySelector('.fantasma'));
  const aba = await pos('.etapas-tabs button[data-e="Fazendo"]');
  for (let i = 1; i <= 10; i++) await toque('touchMove', c.x + (aba.x - c.x) * i / 10, c.y + (aba.y - c.y) * i / 10);
  await pt.waitForTimeout(120);
  const alvo = await pt.evaluate(() => { const a = document.querySelector('.etapas-tabs button.alvo'); return a && a.dataset.e; });
  await toque('touchEnd'); await pt.waitForTimeout(350);
  ok(seg && alvo === 'Fazendo' && (await etapaDe(pt, id)) === 'Fazendo', dev + ': segurar 0,4 s e arrastar até a aba Fazendo move a demanda ' + id + ' (card fantasma: ' + seg + ', aba destacada: ' + alvo + ')');
  await pt.context().close();
}
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
