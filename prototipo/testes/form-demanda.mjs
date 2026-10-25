// Cadastro e edição de demandas: grupos (Identificação, Descrição, Andamento, Datas e prazo, Tarefas), duas colunas equilibradas nas telas largas,
// uma coluna nas estreitas, cabeçalho e rodapé sempre à vista, sem rolagem lateral, e os fluxos existentes (salvar, cancelar, Esc com rascunho, tarefas).
// Uso (dentro da pasta prototipo): node testes/form-demanda.mjs
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
const dem = (id) => pg.evaluate((id) => JSON.parse(JSON.stringify(window.DM.DEMANDAS.find((d) => d.id === id))), id);
const abrirEdicao = async (id) => { await pg.click('.dcard[data-id="' + id + '"] .assunto'); await pg.waitForSelector('.modal .m-cols'); await pg.waitForTimeout(500); };
const fechaTudo = async () => { for (let i = 0; i < 3; i++) { if (!(await pg.evaluate(() => !!document.querySelector('.modal')))) break; await pg.keyboard.press('Escape'); await pg.waitForTimeout(350); } };

// ---------- 1) estrutura, equilíbrio, rodapé e rolagem nos cinco tamanhos ----------
for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'tablet-h', 'media', 'tablet-v', 'phone']) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=cards&balao=nao&aviso=nao');
  await abrirEdicao(1);
  const m = await pg.evaluate(() => {
    const md = document.querySelector('.modal'), rm = md.getBoundingClientRect(), cols = [...document.querySelector('.m-cols').children], rc = cols.map((c) => c.getBoundingClientRect());
    const grupos = [...document.querySelectorAll('.m-grp > h4')].map((h) => h.childNodes[0].textContent.trim());
    const f = document.querySelector('.m-f'), rf = f.getBoundingClientRect(), h = document.querySelector('.m-h'), rh = h.getBoundingClientRect();
    const calcInputs = document.querySelectorAll('.calc input, .calc textarea, .calc select').length;
    const cheg = [...md.querySelectorAll('label, b, div, span, h4')].filter((e) => e.children.length === 0 && /^Chegou em$/.test(e.textContent.trim())).length;
    const pedacos = [...md.querySelectorAll('input:not([type=checkbox]), select, textarea')].filter((e) => e.getBoundingClientRect().width).map((e) => e.getBoundingClientRect());
    const dentro = pedacos.every((r) => r.left >= rm.left - 1 && r.right <= rm.right + 1);
    md.scrollTop = 0; const topoOk = document.querySelector('.m-grp').getBoundingClientRect().top >= rh.bottom - 1;
    md.scrollTop = md.scrollHeight; const ult = [...document.querySelectorAll('.m-grp')].pop().getBoundingClientRect(), rf2 = f.getBoundingClientRect(), fimOk = ult.bottom <= rf2.top + 1;
    md.scrollTop = 0;
    return { grupos, nCols: new Set(rc.map((r) => Math.round(r.left))).size, hA: Math.round(rc[0].height), hB: Math.round(rc[1] ? rc[1].height : 0), lateral: md.scrollWidth > md.clientWidth + 1, rodapeVisivel: rf.bottom <= rm.bottom + 1 && rf.top >= rm.top && rf.height > 0, cabVisivel: rh.top >= rm.top - 1 && rh.bottom <= rm.bottom, calcInputs, cheg, dentro, topoOk, fimOk, rolavel: md.scrollHeight > md.clientHeight + 1 };
  });
  const largo = ['desktop', 'tablet-h', 'media'].includes(dev);
  ok(m.grupos.join() === 'Identificação,Descrição,Andamento,Datas e prazo,Tarefas', modo + ', ' + dev + ': grupos ' + m.grupos.join(', '));
  ok(m.nCols === (largo ? 2 : 1) && !m.lateral && m.dentro, modo + ', ' + dev + ': ' + m.nCols + ' coluna(s) (esperado ' + (largo ? 2 : 1) + '), sem rolagem lateral, campos dentro da janela');
  if (largo) ok(Math.abs(m.hA - m.hB) <= 200, modo + ', ' + dev + ': colunas equilibradas (' + m.hA + ' e ' + m.hB + ' px)');
  ok(m.rodapeVisivel && m.cabVisivel && m.topoOk && m.fimOk, modo + ', ' + dev + ': cabeçalho e rodapé à vista, o primeiro grupo começa abaixo do cabeçalho e o último termina acima do rodapé' + (m.rolavel ? ' (rola)' : ''));
  ok(m.calcInputs === 0 && m.cheg === 1, modo + ', ' + dev + ': informações calculadas sem campos editáveis e "Chegou em" aparece uma só vez');
  await fechaTudo();
}

// ---------- 2) salvar, cancelar, Esc com rascunho, descrição longa e tarefas ----------
await abrir('tema=claro&dev=desktop&tela=demandas&vis=cards&menuAb=false&balao=nao&aviso=nao');
const orig = await dem(1);
await abrirEdicao(1);
ok((await pg.inputValue('#d-assunto')) === orig.assunto && (await pg.inputValue('#d-num')) === orig.num && (await pg.inputValue('#d-origem')) === orig.origem && (await pg.inputValue('#d-descricao')) === orig.descricao, 'a edição abre com todos os valores atuais da demanda');
// cancelar descarta
await pg.fill('#d-assunto', 'Mudança que será cancelada'); await pg.click('[data-act="cancelar-modal"]'); await pg.waitForTimeout(400);
ok((await dem(1)).assunto === orig.assunto, 'Cancelar descarta a alteração');
await abrirEdicao(1); ok(!(await pg.evaluate(() => !!document.querySelector('.rec'))) && (await pg.inputValue('#d-assunto')) === orig.assunto, 'depois de cancelar não sobra rascunho');
// Esc guarda rascunho
await pg.fill('#d-assunto', 'Rascunho guardado'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(450);
ok((await dem(1)).assunto === orig.assunto, 'Esc não grava na demanda');
await abrirEdicao(1);
ok((await pg.inputValue('#d-assunto')) === 'Rascunho guardado' && (await pg.evaluate(() => !!document.querySelector('.rec'))), 'Esc guarda o rascunho e a próxima abertura o recupera com o aviso');
await pg.click('[data-act="cancelar-modal"]'); await pg.waitForTimeout(400);
// descrição longa com rolagem própria
await abrirEdicao(1);
const longa = 'Linha de texto longa para conferir a rolagem. '.repeat(40);
await pg.fill('#d-descricao', longa);
const ta = await pg.evaluate(() => { const t = document.querySelector('#d-descricao'), r = t.getBoundingClientRect(), md = document.querySelector('.modal').getBoundingClientRect(); return { rola: t.scrollHeight > t.clientHeight, dentro: r.left >= md.left && r.right <= md.right, alt: Math.round(r.height), resize: getComputedStyle(t).resize }; });
ok(ta.rola && ta.dentro && ta.alt >= 110 && ta.resize === 'vertical', 'descrição longa: caixa de ' + ta.alt + ' px com rolagem própria, redimensionável na vertical e dentro da janela');
// salvar preserva e grava
await pg.fill('#d-assunto', 'Assunto alterado e salvo'); await pg.fill('#d-num', '9999/2026'); await pg.fill('#d-origem', 'Origem nova');
await pg.fill('#d-prazo', '2026-11-05');
await pg.click('[data-act="m-set"][data-k="prazoTipoDem"][data-val="Próprio"]');
await pg.click('[data-act="salvar-edicao"]'); await pg.waitForTimeout(500);
const dep = await dem(1);
ok(dep.assunto === 'Assunto alterado e salvo' && dep.num === '9999/2026' && dep.origem === 'Origem nova' && dep.descricao.trim() === longa.trim() && dep.prazo === '05/11' && dep.prazoTipo === 'Próprio' && JSON.stringify(dep.tarefas) === JSON.stringify(orig.tarefas) && dep.etapa === orig.etapa && dep.tipo === orig.tipo && dep.area === orig.area, 'Salvar grava assunto, número, origem, descrição, prazo e tipo de prazo e preserva tarefas, etapa, tipo e área');
// tarefas: adicionar, editar, marcar, excluir
await abrirEdicao(1);
await pg.fill('#m-nt', 'Tarefa nova do teste'); await pg.click('[data-act="add-tarefa-m"]'); await pg.waitForTimeout(250);
let n = await pg.locator('.tarefas.ed .t-item').count(); ok(n === orig.tarefas.length + 1 && (await pg.inputValue('.tarefas.ed .t-item:last-child .t-campo')) === 'Tarefa nova do teste', 'adicionar tarefa: a lista passa de ' + orig.tarefas.length + ' para ' + n + ' e o campo de nova tarefa fica pronto');
await pg.fill('.tarefas.ed .t-item:nth-child(3) .t-campo', 'Redigir a resposta (editada)'); await pg.click('.tarefas.ed .t-item:nth-child(4) input[type=checkbox]'); await pg.waitForTimeout(150);
await pg.click('.tarefas.ed .t-item:nth-child(1) [data-act="del-tarefa-m"]'); await pg.waitForTimeout(250);
const prog = await pg.textContent('.m-prog');
await pg.click('[data-act="salvar-edicao"]'); await pg.waitForTimeout(500);
const t = (await dem(1)).tarefas;
ok(t.length === orig.tarefas.length && t[1].t === 'Redigir a resposta (editada)' && t[2].f === true && !t.some((x) => x.t === 'Levantar diárias de 2025'), 'tarefas: editar, marcar e excluir gravam a tarefa certa (' + t.map((x) => (x.f ? '[x] ' : '[ ] ') + x.t).join(' | ') + ')');
ok(/de \d+ concluídas \(\d+%\)/.test(prog), 'o progresso fica junto da lista e se atualiza (' + prog.slice(0, 40) + ')');

// ---------- 3) cadastro rápido ----------
for (const dev of ['desktop', 'phone']) {
  await abrir('tema=escuro&dev=' + dev + '&tela=demandas&vis=cards&balao=nao&aviso=nao');
  const antes = await pg.evaluate(() => window.DM.DEMANDAS.length);
  await pg.click('.fab:visible, .mais-c:visible', { timeout: 5000 }); await pg.waitForTimeout(300);
  await pg.click('[data-m="Novo: Demanda"]'); await pg.waitForSelector('.modal .m-grp'); await pg.waitForTimeout(450);
  const g = await pg.evaluate(() => { const md = document.querySelector('.modal'), rm = md.getBoundingClientRect(), f = document.querySelector('.m-f').getBoundingClientRect(); return { grupos: [...document.querySelectorAll('.m-grp > h4')].map((h) => h.childNodes[0].textContent.trim()), lateral: md.scrollWidth > md.clientWidth + 1, rod: f.bottom <= rm.bottom + 1 && f.height > 0 }; });
  ok(g.grupos.join() === 'Identificação,Descrição,Datas e prazo' && !g.lateral && g.rod, dev + ': cadastro rápido em grupos (' + g.grupos.join(', ') + '), sem rolagem lateral e com rodapé à vista');
  await pg.fill('[data-v="assunto"]', 'Cadastro do teste ' + dev); await pg.fill('[data-v="num"]', '777/2026'); await pg.fill('[data-v="origem"]', 'Teste'); await pg.fill('#m-descricao', 'Descrição do cadastro');
  await pg.click('[data-act="m-set"][data-k="area"][data-val="Pessoal"]'); await pg.click('[data-act="sugerir-prazo"]'); await pg.waitForTimeout(150);
  await pg.click('[data-act="salvar-dem"]'); await pg.waitForTimeout(500);
  const nova = await pg.evaluate(() => window.DM.DEMANDAS[window.DM.DEMANDAS.length - 1]);
  ok((await pg.evaluate(() => window.DM.DEMANDAS.length)) === antes + 1 && nova.assunto === 'Cadastro do teste ' + dev && nova.num === '777/2026' && nova.area === 'Pessoal' && nova.descricao === 'Descrição do cadastro' && !!nova.prazo, dev + ': cadastrar grava assunto, número, origem, descrição, área e o prazo sugerido');
}
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
