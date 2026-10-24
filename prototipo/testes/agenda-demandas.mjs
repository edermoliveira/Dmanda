// Agenda: itens de demanda com círculo da sigla do tipo, cor pela classificação, abertura da demanda certa pelo identificador
// interno (inclusive com números repetidos), nome acessível, teclado e contraste do círculo, em claro e escuro.
// Uso (dentro da pasta prototipo): node testes/agenda-demandas.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const SIGLAS = { Processo: 'P', Protocolo: 'PT', Memorando: 'M', 'Ofício': 'O', 'Pedido de informação': 'I', Portaria: 'PO', 'Projeto de lei': 'PL' };
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

const lerItens = () => pg.evaluate(() => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); if (c.startsWith('color(')) for (let k = 0; k < 3; k++) m[k] *= 255; const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  return [...document.querySelectorAll('.ag-d')].filter((b) => b.getBoundingClientRect().width).map((b) => {
    const s = b.querySelector('.ag-sig'), n = b.querySelector('.ag-n'), rb = b.getBoundingClientRect(), rs = s.getBoundingClientRect(), rn = n.getBoundingClientRect(), csb = getComputedStyle(b), css = getComputedStyle(s);
    return { tag: b.tagName.toLowerCase(), id: +b.dataset.id, acomp: b.classList.contains('acomp'), cls: [...b.classList].filter((c) => /^(venc|neutra|cat-)/.test(c)).join(' '), sigla: s.textContent, num: n.textContent, nome: b.getAttribute('aria-label'),
      redondo: Math.abs(rs.width - rs.height) < .6 && rs.width === 22, aDireita: rs.right <= rb.right + .5 && rs.left > rn.right - 1, numInteiro: n.scrollWidth <= n.clientWidth + 1,
      alvo: Math.round(rb.height), larg: Math.round(rb.width), bgItem: csb.backgroundColor, bgSig: css.backgroundColor, txSig: css.color, ctr: Math.round(contraste(css.color, css.backgroundColor) * 10) / 10, foco: false };
  });
});

for (const modo of ['claro', 'escuro']) for (const [dev, ag] of [['desktop', 'semana'], ['desktop', 'hoje'], ['tablet-v', 'semana'], ['phone', 'hoje']]) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=agenda&ag=' + ag + '&balao=nao&aviso=nao');
  const itens = await lerItens();
  const dados = await pg.evaluate(() => window.DM.DEMANDAS.map((d) => ({ id: d.id, tipo: d.tipo, num: d.num, area: d.area, prazo: d.prazo, etapa: d.etapa, venc: !!d.prazo && d.etapa !== 'Finalizado' })));
  const porId = Object.fromEntries(dados.map((d) => [d.id, d]));
  ok(itens.length > 0 && itens.every((i) => i.tag === 'button' && porId[i.id]), modo + ', ' + dev + ' ' + ag + ': ' + itens.length + ' itens de demanda, todos botões com identificador interno');
  const ruins = itens.filter((i) => { const d = porId[i.id]; return !(i.sigla === SIGLAS[d.tipo] && i.redondo && i.aDireita && i.numInteiro && i.ctr >= 4.5 && /Processo|Protocolo|Memorando|Ofício|Portaria|Pedido|Projeto/.test(i.nome) && i.nome.includes(d.num)); });
  ok(ruins.length === 0, modo + ', ' + dev + ' ' + ag + ': sigla do tipo certa, círculo 22x22 à direita, número inteiro, contraste do círculo >= 4,5, nome acessível com tipo e número' + (ruins.length ? ' ' + JSON.stringify(ruins) : ''));
  const cores = itens.map((i) => i.id + ':' + (i.cls.trim() || '?'));
  const corErrada = itens.filter((i) => { const d = porId[i.id]; const atras = i.cls.includes('venc'); const esperaVenc = !i.acomp && d.venc && /^(\d+)\/(\d+)$/.test(d.prazo) && (+d.prazo.split('/')[0] < 21 && d.prazo.split('/')[1] === '10'); const esperada = (d.tipo === 'Processo' || d.tipo === 'Protocolo') && { Geral: 'cat-azul', Pessoal: 'cat-verde', Compras: 'cat-amar' }[d.area || 'Geral'] || 'neutra'; return atras ? !esperaVenc : !i.cls.includes(esperada); });
  ok(corErrada.length === 0, modo + ', ' + dev + ' ' + ag + ': cores pela classificação, vermelho só no atraso (' + cores.join(' ') + ')');
  if (dev !== 'desktop') ok(itens.every((i) => i.alvo >= 44), modo + ', ' + dev + ' ' + ag + ': área de toque de pelo menos 44 px (' + [...new Set(itens.map((i) => i.alvo))].join(',') + ')');
}

// clicar abre a demanda certa; Enter e espaço também; foco visível
for (const modo of ['claro', 'escuro']) {
  await abrir('tema=' + modo + '&dev=desktop&tela=agenda&ag=semana&balao=nao&aviso=nao');
  const ids = await pg.evaluate(() => [...document.querySelectorAll('.ag-d')].map((b) => +b.dataset.id));
  let tudo = true, vistos = [];
  for (const id of ids) {
    await pg.click('.ag-d[data-id="' + id + '"]'); await pg.waitForTimeout(250);
    const aberto = await pg.evaluate(() => { const m = window.DM.estado.modal; return m && m.id; });
    const nome = await pg.evaluate(() => { const i = document.querySelector('#d-num, [data-d="num"]'); return i ? i.value : null; });
    vistos.push(id + '→' + aberto);
    if (aberto !== id) tudo = false;
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    if (await pg.evaluate(() => !!window.DM.estado.modal)) { const f = await pg.$('[data-act="fechar-modal"]'); if (f) await f.click(); }
  }
  ok(tudo && ids.length > 0, modo + ', Agenda semana: clicar em cada item abre a demanda certa (' + vistos.join(', ') + ')');

  // números repetidos: duas demandas com o mesmo número abrem cada uma a sua
  await pg.evaluate(() => { const d = window.DM.DEMANDAS.find((x) => x.id === 2); window.DM.DEMANDAS.push(Object.assign({}, d, { id: 99, assunto: 'Cópia com o mesmo número', tarefas: [] })); window.DM.trocar({}); });
  await pg.waitForTimeout(300);
  const dupl = await pg.evaluate(() => [...document.querySelectorAll('.ag-d')].filter((b) => b.querySelector('.ag-n').textContent === '087/2026').map((b) => +b.dataset.id));
  ok(dupl.length === 2 && dupl.includes(2) && dupl.includes(99), modo + ', números repetidos: dois itens "087/2026" com ids ' + dupl.join(' e '));
  await pg.click('.ag-d[data-id="99"]'); await pg.waitForTimeout(250);
  const id99 = await pg.evaluate(() => window.DM.estado.modal && window.DM.estado.modal.id);
  ok(id99 === 99, modo + ', números repetidos: o clique abre a demanda 99 (abriu ' + id99 + ')');
  await pg.keyboard.press('Escape');
  if (await pg.evaluate(() => !!window.DM.estado.modal)) { const f = await pg.$('[data-act="fechar-modal"]'); if (f) await f.click(); }
  await pg.evaluate(() => { const i = window.DM.DEMANDAS.findIndex((x) => x.id === 99); window.DM.DEMANDAS.splice(i, 1); });

  // teclado: Tab chega, Enter abre, foco aparece
  await abrir('tema=' + modo + '&dev=desktop&tela=agenda&ag=semana&balao=nao&aviso=nao');
  await pg.focus('.ag-d[data-id="1"]'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Shift+Tab'); await pg.waitForTimeout(100);
  const foco = await pg.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { id: a.dataset && a.dataset.id, ow: parseFloat(cs.outlineWidth), os: cs.outlineStyle }; });
  ok(foco.id === '1' && foco.ow >= 2 && foco.os !== 'none', modo + ', teclado: foco visível no item (contorno ' + foco.ow + ' px ' + foco.os + ')');
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  const viaTeclado = await pg.evaluate(() => window.DM.estado.modal && window.DM.estado.modal.id);
  ok(viaTeclado === 1, modo + ', teclado: Enter abre a demanda 1 (abriu ' + viaTeclado + ')');
  await pg.keyboard.press('Escape');
}

// várias demandas comuns no mesmo dia + um acompanhamento verdadeiro: prazo e acompanhamento nunca se confundem
for (const modo of ['claro', 'escuro']) {
  await abrir('tema=' + modo + '&dev=desktop&tela=agenda&ag=semana&balao=nao&aviso=nao');
  await pg.evaluate(() => { const d = window.DM.DEMANDAS.find((x) => x.id === 2); [97, 98, 99].forEach((id) => window.DM.DEMANDAS.push(Object.assign({}, d, { id, assunto: 'Cópia ' + id, tarefas: [] }))); window.DM.trocar({}); });
  await pg.waitForTimeout(300);
  const dia = await pg.evaluate(() => [...document.querySelectorAll('.ag-col')].map((c) => ({ dia: c.querySelector('.ag-h b').textContent, itens: [...c.querySelectorAll('.ag-d')].map((b) => ({ id: +b.dataset.id, acomp: b.classList.contains('acomp'), nome: b.getAttribute('aria-label') })) })));
  const d21 = dia.find((x) => x.dia === '21').itens, d24 = dia.find((x) => x.dia === '24').itens;
  ok(d21.length === 4 && d21.every((i) => !i.acomp && /prazo 21\/10$/.test(i.nome) && !/acompanhamento/.test(i.nome)), modo + ', dia 21: ' + d21.length + ' demandas comuns, todas como prazo (nenhuma virou acompanhamento: ' + d21.map((i) => i.acomp).join(',') + ')');
  ok(d24.length === 1 && d24[0].acomp && d24[0].id === 3 && /data de acompanhamento$/.test(d24[0].nome), modo + ', dia 24: um acompanhamento verdadeiro (demanda 3), nomeado como data de acompanhamento');
  const abriu = [];
  for (const id of [2, 97, 98, 99]) { await pg.click('.ag-col:nth-child(4) .ag-d[data-id="' + id + '"]'); await pg.waitForTimeout(220); abriu.push(await pg.evaluate(() => window.DM.estado.modal && window.DM.estado.modal.id)); await pg.keyboard.press('Escape'); await pg.waitForTimeout(120); if (await pg.evaluate(() => !!window.DM.estado.modal)) { const f = await pg.$('[data-act="fechar-modal"]'); if (f) await f.click(); } }
  await pg.click('.ag-col:nth-child(7) .ag-d.acomp'); await pg.waitForTimeout(220); abriu.push(await pg.evaluate(() => window.DM.estado.modal && window.DM.estado.modal.id)); await pg.keyboard.press('Escape');
  ok(abriu.join() === '2,97,98,99,3', modo + ', cada item abre a sua demanda pelo identificador interno (' + abriu.join(', ') + ')');
  await pg.evaluate(() => { [97, 98, 99].forEach((id) => { const i = window.DM.DEMANDAS.findIndex((x) => x.id === id); if (i > -1) window.DM.DEMANDAS.splice(i, 1); }); });
}

// eventos continuam diferentes: horário, cor azul e sem círculo
await abrir('tema=claro&dev=desktop&tela=agenda&ag=semana&balao=nao&aviso=nao');
const ev = await pg.evaluate(() => [...document.querySelectorAll('.ag-e')].map((e) => ({ hora: !!e.querySelector('b'), sig: !!e.querySelector('.ag-sig'), act: e.dataset.act })));
ok(ev.length > 0 && ev.every((e) => !e.sig && e.act === 'ed-ev'), 'eventos: ' + ev.length + ' itens sem círculo de sigla, abrindo a edição de evento como antes');
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
