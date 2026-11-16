// Decisão 77, no navegador (Edge e, quando existe, o WebKit do Playwright) com banco local de TESTE (PGlite, dados fictícios), porta 7119:
//   4) revelar o próximo card durante o arrasto (parcial nos dois sentidos, gesto completo, rolagem, foco e clique nos cards de fundo);
//   5) Demandas, visão Cards: uma pilha por tipo e área (iPhone) e as mesmas filas na web e no iPad; Quadro intacto;
//   6) fila completa: Nova urgência e "Na fila" do Para hoje sem o corte em três, cada demanda uma só vez, até o último card e de volta.
// O WebKit do Playwright é o motor do Safari no Windows, NÃO o Safari do iPhone: o toque real fica para o aparelho. Uso: node scripts/testar-fila-cards.mjs (nunca toca o Supabase real)
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';
import { elegiveisParaHoje } from '../src/lib/para-hoje.ts';

const PORTA = process.env.PORTA_TESTE_FILA || '7119', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/fila-cards', CAPTURAS = '.dados-teste/fila-cards-capturas';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- dados fictícios: 17 demandas em seis grupos ----------
let HOJE;
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const mk = (assunto, tipo, area, dias, extra = {}) => chamarComoUsuario(db, USUARIO, 'criar_demanda', { p: { assunto, tipo, area, numero: '', etapa: 'Fazendo', ...(dias === null ? {} : { prazo_original: somarDias(HOJE, dias) }), ...extra } });
  // Processo, Geral (azul)
  await mk('PG1 atrasada longa', 'Processo', 'Geral', -5); await mk('PG2 atrasada', 'Processo', 'Geral', -1); await mk('PG3 vence hoje', 'Processo', 'Geral', 0); await mk('PG4 próxima', 'Processo', 'Geral', 3);
  await mk('PG5 pedido da Prefeita sem prazo', 'Processo', 'Geral', null, { origem: 'Prefeita' });
  // Processo, Pessoal (verde)
  await mk('PV1 atrasada', 'Processo', 'Pessoal', -2); await mk('PV2 próxima', 'Processo', 'Pessoal', 2); await mk('PV3 distante', 'Processo', 'Pessoal', 20); await mk('PV4 sem prazo', 'Processo', 'Pessoal', null);
  // Protocolo, Geral (azul)
  await mk('KG1 próxima', 'Protocolo', 'Geral', 1); await mk('KG2 atrasada', 'Protocolo', 'Geral', -3);
  // Memorando e um tipo cadastrado pelo usuário e sem documento
  await mk('ME1 atrasada', 'Memorando', 'Geral', -4); await mk('ME2 próxima', 'Memorando', 'Geral', 5); await mk('ME3 sem prazo', 'Memorando', 'Geral', null); await mk('ME4 distante', 'Memorando', 'Geral', 30);
  await mk('RG1 relatório de gestão hoje', 'Relatório de gestão', 'Geral', 0);
  await mk('SD1 sem documento atrasada', '', 'Geral', -6);
  await db.close();
}

let servidor = null;
const subir = async () => {
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* subindo */ } await esperar(2000); }
};
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
await subir();

const edge = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
let wk = null; try { wk = await webkit.launch(); } catch (e) { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); }
const erros = [];
const PERFIS = { desktop: { viewport: { width: 1440, height: 900 } }, ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } };
const abrir = async (perfil, { motor = edge, wkDevice = false, esquema = 'light', rota = '/', esperar: sel = '[data-painel="para-hoje"] [data-vaga]' } = {}) => {
  const base = wkDevice ? { ...devices['iPhone 13'] } : PERFIS[perfil];
  const ctx = await motor.newContext({ ...base, colorScheme: esquema });
  await ctx.addInitScript((t) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, esquema === 'dark' ? 'escuro' : 'claro');
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForSelector(sel, { timeout: 120000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  const x = pg.locator('.modal-ov button[aria-label="Fechar"]');
  try { await x.first().waitFor({ state: 'visible', timeout: 2500 }); await x.first().click(); } catch { /* não abriu */ }
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await esperar(700);
  return { ctx, pg };
};
const api = async (pg) => (await pg.request.get(BASE + '/api/exportar')).json();

/** Arrasto com eventos de ponteiro (toque): vale no Edge e no WebKit. `soltar`: 'nao' deixa o dedo no lugar; 'curto' e 'longo' soltam. Devolve o estado visual no ponto do arrasto. */
const arrastar = (pg, sel, dx, soltar) => pg.evaluate(async ({ sel, dx, soltar }) => {
  const el = document.querySelector(`${sel} .ph-arrasto`), r = el.getBoundingClientRect(), y = r.top + r.height * 0.45, x = r.left + r.width / 2;
  el.setPointerCapture = () => {};
  const ev = (tipo, px) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: px, clientY: y }));
  ev('pointerdown', x);
  const passos = Math.abs(dx) > 100 ? 10 : 8;
  for (let i = 1; i <= passos; i++) { ev('pointermove', x + (dx * i) / passos); await new Promise((r2) => setTimeout(r2, 16)); }
  await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
  const p = el.closest('.ph-pilha');
  const faces = [...p.querySelectorAll('.ph-atras[data-face]')].map((f) => { const c = f.querySelector('.face.front'); return { lado: f.dataset.face, vis: getComputedStyle(f).visibility, op: parseFloat(getComputedStyle(f.querySelector('.vaga')).opacity), titulo: f.querySelector('.assunto')?.textContent.trim(), inert: f.inert, pe: getComputedStyle(f).pointerEvents, cor: c ? ([...c.classList].find((k) => k.startsWith('cat-')) ?? '') : null }; });
  const frente = { titulo: el.querySelector('.assunto')?.textContent.trim(), cor: [...el.querySelector('.face.front').classList].find((k) => k.startsWith('cat-')) ?? '', x: el.getBoundingClientRect().left - r.left };
  const estado = { revela: p.dataset.revela ?? null, prog: parseFloat(p.querySelector('.ph-atras')?.style.getPropertyValue('--prog') || '0'), faces, frente };
  if (soltar !== 'nao') ev('pointerup', x + dx);
  return estado;
}, { sel, dx, soltar });
const topoAtivo = (pg, sel) => pg.$eval(`${sel} .ph-arrasto .assunto`, (e) => e.textContent.trim());
const posicao = (pg, sel) => pg.$eval(`${sel} .ph-posicao`, (e) => e.textContent.trim()).catch(() => null);
const rolagem = (pg) => pg.evaluate(() => document.querySelector('.main').scrollTop);

// ---------- 4) revelar o próximo durante o arrasto ----------
const MOTORES = [['Edge', edge, false], ...(wk ? [['WebKit emulado', wk, true]] : [])];
for (const [nome, motor, wkDev] of MOTORES) for (const esquema of ['light', 'dark']) {
  const R = `${nome}, ${esquema === 'dark' ? 'escuro' : 'claro'}`;
  const { ctx, pg } = await abrir('celular', { motor, wkDevice: wkDev, esquema });
  const NU = '[data-nova-urgencia] .ph-pilha';
  await pg.$eval(NU, (e) => e.scrollIntoView({ block: 'center' })); await esperar(500);
  const total0 = Number(await pg.$eval(NU, (e) => e.dataset.total));
  ok(total0 >= 4, `${R}: a Nova urgência tem ${total0} cards para a pilha (mais de três)`);
  const t0 = await topoAtivo(pg, NU), st0 = await rolagem(pg);
  // parcial para a esquerda: revela o PRÓXIMO; o card da frente acompanha o dedo e volta ao soltar
  const e1 = await arrastar(pg, NU, -50, 'nao');
  const fe = e1.faces.find((f) => f.lado === 'esq');
  ok(e1.revela === 'esq' && fe && fe.vis === 'visible' && fe.op > 0.9 && !!fe.titulo && fe.titulo !== t0 && e1.frente.x < -40, `${R}: arrastando para a esquerda o card de baixo aparece (${fe?.titulo?.slice(0, 22)}; opacidade ${fe?.op.toFixed(2)})`);
  ok(fe?.cor === (await pg.$eval(`${NU} .ph-atras[data-face="esq"] .face.front`, (e) => [...e.classList].find((k) => k.startsWith('cat-')) ?? '')) && fe?.inert === true && fe?.pe === 'none', `${R}: o card de fundo é só visual (inert, sem clique) e traz a cor do próprio card`);
  await pg.evaluate((sel) => document.querySelector(`${sel} .ph-arrasto`).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 })), NU);
  await esperar(500);
  ok((await topoAtivo(pg, NU)) === t0 && (await posicao(pg, NU)) === `1 de ${total0}` && (await pg.$eval(NU, (e) => e.dataset.revela ?? 'nada')) === 'nada', `${R}: soltar um gesto curto devolve o card da frente e a ordem não muda (${await posicao(pg, NU)})`);
  // parcial para a direita: na navegação revela o ÚLTIMO da ordem (o "anterior")
  const e2 = await arrastar(pg, NU, 50, 'nao');
  const fd = e2.faces.find((f) => f.lado === 'dir'), fe2 = e2.faces.find((f) => f.lado === 'esq');
  ok(e2.revela === 'dir' && fd && fd.vis === 'visible' && fd.op > 0.9 && fe2?.vis === 'hidden' && !!fd.titulo && fd.titulo !== t0 && fd.titulo !== fe?.titulo, `${R}: arrastando para a direita aparece o card que voltaria (${fd?.titulo?.slice(0, 22)}), não o da esquerda`);
  await pg.evaluate((sel) => document.querySelector(`${sel} .ph-arrasto`).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 })), NU);
  await esperar(500);
  ok((await topoAtivo(pg, NU)) === t0 && (await rolagem(pg)) === st0, `${R}: o gesto curto para a direita também devolve o card, sem a página saltar (rolagem ${st0} e ${await rolagem(pg)})`);
  await pg.screenshot({ path: `${CAPTURAS}/revela-${nome.startsWith('Web') ? 'webkit' : 'edge'}-${esquema}-antes.png` });
  // gesto completo para a esquerda: assume a frente o card que foi revelado
  const e3 = await arrastar(pg, NU, -220, 'longo');
  await esperar(800);
  ok((await topoAtivo(pg, NU)) === fe.titulo && (await posicao(pg, NU)) === `1 de ${total0}`, `${R}: o gesto completo para a esquerda leva à frente exatamente o card revelado (${(await topoAtivo(pg, NU)).slice(0, 22)})`);
  // gesto completo para a direita: volta o que estava no fim, o mesmo que foi mostrado
  const antes = await topoAtivo(pg, NU);
  const e4 = await arrastar(pg, NU, 220, 'nao');
  const fdd = e4.faces.find((f) => f.lado === 'dir');
  await pg.evaluate((sel) => document.querySelector(`${sel} .ph-arrasto`).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 9999, clientY: 0 })), NU);
  await esperar(800);
  const depois = await topoAtivo(pg, NU);
  ok(depois === fdd.titulo && depois !== antes, `${R}: o gesto completo para a direita leva à frente exatamente o card que foi mostrado (${depois.slice(0, 22)})`);
  ok((await rolagem(pg)) === st0, `${R}: depois de gestos completos nos dois sentidos a página não saltou (${st0} e ${await rolagem(pg)})`);
  // rolagem vertical por cima do card continua livre e não revela nada
  await pg.evaluate(() => document.querySelector('.main').scrollTo({ top: 0 })); await esperar(200);
  ok((await pg.$eval(NU, (e) => e.dataset.revela ?? 'nada')) === 'nada', `${R}: sem arrasto, nenhuma face de fundo é revelada`);
  // clique e foco nos cards de fundo: nada acontece neles
  const info = await pg.evaluate((sel) => { const f = document.querySelector(`${sel} .ph-atras[data-face="esq"]`), tab = [...f.querySelectorAll('button, [tabindex="0"], a')].map((e) => e.tabIndex); return { inert: f.inert, ocultoAria: f.getAttribute('aria-hidden'), focaveis: tab.length }; }, NU);
  ok(info.inert && info.ocultoAria === 'true', `${R}: o card de fundo fica fora da ordem de foco e escondido dos leitores de tela (inert, aria-hidden)`);
  if (esquema === 'light' || esquema === 'dark') {
    await pg.$eval(NU, (e) => e.scrollIntoView({ block: 'center' })); await esperar(300);
    await arrastar(pg, NU, -60, 'nao'); await esperar(200);
    await pg.screenshot({ path: `${CAPTURAS}/revela-${nome.startsWith('Web') ? 'webkit' : 'edge'}-${esquema}-arrastando.png` });
  }
  await ctx.close();
}

// ---------- 6) fila completa no Início (Nova urgência e Na fila, sem o corte em três) ----------
{
  const { ctx, pg } = await abrir('desktop');
  const j = await api(pg);
  const eleg = elegiveisParaHoje(j.demandas, j.hoje ?? HOJE, j.dias ?? []);
  await ctx.close();
  const esperadoIds = new Set(eleg.map((e) => e.demanda.id));
  for (const [perfil, rot] of [['desktop', 'computador'], ['ipad', 'iPad']]) {
    const { ctx: c, pg: p } = await abrir(perfil);
    const r = await p.evaluate(() => {
      const ids = (s) => [...document.querySelectorAll(`${s} .dcard`)].map((e) => e.dataset.id);
      return { vagas: ids('[data-painel="para-hoje"] > .cards'), urg: ids('[data-nova-urgencia]'), fila: ids('[data-fila-hoje]'), modo: document.querySelector('[data-painel="para-hoje"]').dataset.modo };
    });
    const todos = [...r.vagas, ...r.urg, ...r.fila];
    ok(r.modo === 'grade' && r.vagas.length === 3 && r.urg.length >= 4, `${rot}: três vagas e a Nova urgência com ${r.urg.length} cards (antes cortava em três)`);
    ok(new Set(todos).size === todos.length && todos.length === esperadoIds.size && todos.every((id) => esperadoIds.has(id)), `${rot}: todas as ${esperadoIds.size} demandas elegíveis estão no Para hoje, cada uma uma só vez (vagas ${r.vagas.length}, urgência ${r.urg.length}, fila ${r.fila.length})`);
    const quemPrimeiro = await p.evaluate(() => document.querySelector('[data-fila-hoje] .dcard .assunto')?.textContent.trim());
    ok(/^PG5/.test(quemPrimeiro ?? ''), `${rot}: na fila, o pedido da Prefeita vem primeiro (${quemPrimeiro})`);
    const urgOrdem = await p.evaluate(() => [...document.querySelectorAll('[data-nova-urgencia] .dcard .assunto')].map((e) => e.textContent.trim().slice(0, 3)));
    ok(urgOrdem.length >= 4, `${rot}: a Nova urgência mostra a ordem da seção (${urgOrdem.join(' ')})`);
    await c.close();
  }
  // iPhone: um baralho por bloco, até o último card e de volta
  for (const [nome, motor, wkDev] of MOTORES) {
    const { ctx: c, pg: p } = await abrir('celular', { motor, wkDevice: wkDev });
    for (const [sel, rot] of [['[data-nova-urgencia] .ph-pilha', 'Nova urgência'], ['[data-fila-hoje] .ph-pilha', 'Na fila']]) {
      await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' })); await esperar(300);
      const n = Number(await p.$eval(sel, (e) => e.dataset.total));
      const vistos = new Set([await topoAtivo(p, sel)]);
      for (let i = 1; i < n; i++) { await p.click(`${sel} [data-pilha-passar]`); await esperar(400); vistos.add(await topoAtivo(p, sel)); }
      ok(n >= 4 && vistos.size === n, `${nome}, ${rot}: passando um a um o baralho mostra os ${n} cards sem perder nenhum (${vistos.size} diferentes)`);
      const pos = await posicao(p, sel);
      for (let i = 1; i < n; i++) { await p.click(`${sel} [data-pilha-avancar]`); await esperar(400); }
      ok(pos === `1 de ${n}` && (await posicao(p, sel)) === `1 de ${n}`, `${nome}, ${rot}: voltando com "Voltar ao anterior" a pilha retorna ao primeiro (${await posicao(p, sel)})`);
    }
    const vagas = await p.$eval('[data-painel="para-hoje"] > .ph-pilha', (e) => Number(e.dataset.total));
    ok(vagas === 3, `${nome}: o Para hoje do celular continua com as três vagas (${vagas})`);
    await c.close();
  }
}

// ---------- 5) Demandas, visão Cards por grupo ----------
{
  const { ctx, pg } = await abrir('desktop', { rota: '/demandas', esperar: '#vista' });
  const j = await api(pg);
  const abertas = j.demandas.length;
  await pg.click('button[data-v="cards"]'); await esperar(500);
  const grupos = await pg.$$eval('.grupo-cards', (l) => l.map((g) => ({ chave: g.dataset.grupo, cor: g.dataset.cor, n: g.querySelectorAll('.cards .dcard').length, titulo: g.querySelector('.grupo-cab').textContent.replace(/\s+/g, ' ').trim() })));
  ok(grupos.map((g) => g.chave).join() === 'protocolo|Geral,processo|Geral,processo|Pessoal,memorando,relatório de gestão,sem-documento', `computador: seis grupos na ordem fixa (${grupos.map((g) => g.chave).join()})`);
  ok(grupos.reduce((n, g) => n + g.n, 0) === abertas, `computador: as ${abertas} demandas aparecem nos grupos, cada uma uma só vez (${grupos.reduce((n, g) => n + g.n, 0)})`);
  ok(grupos.find((g) => g.chave === 'processo|Geral').n === 5 && grupos.find((g) => g.chave === 'processo|Pessoal').n === 4 && grupos.find((g) => g.chave === 'memorando').n === 4, 'computador: grupos com mais de três cards mostram todos (Processo Geral 5, Processo Pessoal 4, Memorando 4)');
  ok(grupos.find((g) => g.chave === 'processo|Geral').cor === 'azul' && grupos.find((g) => g.chave === 'processo|Pessoal').cor === 'verde' && grupos.find((g) => g.chave === 'memorando').cor === 'neutro', 'computador: a cor do grupo é a dos cards (azul, verde, neutra)');
  const ordemPG = await pg.$$eval('[data-grupo="processo|Geral"] .dcard .assunto', (l) => l.map((e) => e.textContent.trim().slice(0, 3)));
  ok(ordemPG.join() === 'PG5,PG1,PG2,PG3,PG4', `computador: dentro do grupo, o pedido da Prefeita vem primeiro e depois atrasadas, vencem hoje e próximas (${ordemPG.join(' ')})`);
  ok(grupos.find((g) => g.chave === 'sem-documento').titulo.startsWith('Sem documento') && grupos.find((g) => g.chave === 'relatório de gestão').n === 1, 'computador: o tipo cadastrado pelo usuário e "Sem documento" têm o seu grupo');
  await pg.screenshot({ path: `${CAPTURAS}/cards-desktop.png`, fullPage: true });
  await pg.click('button[data-v="quadro"]'); await esperar(500);
  ok((await pg.$$eval('.coluna', (l) => l.length)) >= 3 && !(await pg.$('.grupo-cards')), 'computador: o Quadro (Kanban) segue como era, sem os grupos');
  for (const v of ['tabela', 'lista']) { await pg.click(`button[data-v="${v}"]`); await esperar(300); ok(!(await pg.$('.grupo-cards')), `computador: a visão ${v === 'tabela' ? 'Tabela' : 'Lista'} segue sem grupos`); }
  await ctx.close();

  const ipad = await abrir('ipad', { rota: '/demandas', esperar: '#vista' });
  await ipad.pg.click('button[data-v="cards"]'); await esperar(500);
  ok((await ipad.pg.$$eval('.grupo-cards', (l) => l.length)) === 6 && (await ipad.pg.$$eval('.grupo-cards .cards .dcard', (l) => l.length)) === abertas && !(await ipad.pg.$('.grupo-cards .ph-pilha')), `iPad: as mesmas seis filas em grade, com as ${abertas} demandas e sem baralho`);
  await ipad.ctx.close();

  for (const [nome, motor, wkDev] of MOTORES) for (const esquema of ['light', 'dark']) {
    const R = `${nome}, ${esquema === 'dark' ? 'escuro' : 'claro'}`;
    const { ctx: c, pg: p } = await abrir('celular', { motor, wkDevice: wkDev, esquema, rota: '/demandas', esperar: '#vista' });
    await p.click('button[data-v="cards"]'); await p.waitForSelector('.grupo-cards .ph-pilha', { timeout: 20000 });
    await esperar(500);
    const g = await p.$$eval('.grupo-cards', (l) => l.map((x) => ({ chave: x.dataset.grupo, total: Number(x.querySelector('.ph-pilha')?.dataset.total ?? 0), pos: x.querySelector('.ph-posicao')?.textContent.trim(), cor: x.dataset.cor, frente: [...(x.querySelector('.ph-arrasto .face.front')?.classList ?? [])].find((k) => k.startsWith('cat-')) ?? '' })));
    ok(g.length === 6 && g.reduce((n, x) => n + x.total, 0) === abertas && g.every((x) => x.pos === `1 de ${x.total}`), `${R}: seis pilhas independentes, uma por grupo, com as ${abertas} demandas (${g.map((x) => x.total).join('+')})`);
    ok(g.find((x) => x.chave === 'processo|Geral').frente === 'cat-azul' && g.find((x) => x.chave === 'processo|Pessoal').frente === 'cat-verde' && g.find((x) => x.chave === 'memorando').frente === '', `${R}: o card da frente de cada pilha tem a cor do grupo (azul, verde, neutro)`);
    const etapas0 = (await api(p)).demandas.map((d) => `${d.id}:${d.etapa}`).sort().join();
    const A = '[data-grupo="processo|Geral"] .ph-pilha', B = '[data-grupo="processo|Pessoal"] .ph-pilha';
    const b0 = await topoAtivo(p, B), a0 = await topoAtivo(p, A);
    await p.$eval(A, (e) => e.scrollIntoView({ block: 'center' })); await esperar(300);
    const nA = g.find((x) => x.chave === 'processo|Geral').total, vistos = new Set([a0]);
    for (let i = 1; i < nA; i++) { await p.click(`${A} [data-pilha-passar]`); await esperar(450); vistos.add(await topoAtivo(p, A)); }
    ok(vistos.size === nA && nA === 5, `${R}: navegando até o último card de Processo, Geral passa pelos ${nA} sem perder nenhum`);
    ok((await topoAtivo(p, B)) === b0 && (await posicao(p, B)) === `1 de ${g.find((x) => x.chave === 'processo|Pessoal').total}`, `${R}: a outra pilha (Processo, Pessoal) não se mexeu`);
    for (let i = 1; i < nA; i++) { await p.click(`${A} [data-pilha-avancar]`); await esperar(450); }
    ok((await topoAtivo(p, A)) === a0, `${R}: de volta ao primeiro card (${a0.slice(0, 22)})`);
    // arrasto parcial revela o próximo do grupo
    const a1 = await arrastar(p, A, -50, 'nao');
    const f = a1.faces.find((x) => x.lado === 'esq' || x.lado === 'ambos');
    ok(f && f.op > 0.9 && f.cor === 'cat-azul' && f.titulo !== a0, `${R}: no arrasto parcial a pilha mostra o próximo card do mesmo grupo, em azul (${f?.titulo?.slice(0, 22)})`);
    await p.evaluate((sel) => document.querySelector(`${sel} .ph-arrasto`).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 })), A);
    await esperar(500);
    ok((await topoAtivo(p, A)) === a0, `${R}: o gesto curto devolve o card e o grupo não muda`);
    ok((await api(p)).demandas.map((d) => `${d.id}:${d.etapa}`).sort().join() === etapas0, `${R}: navegar nas pilhas não mudou a etapa de nenhuma demanda`);
    // filtros: texto reduz os grupos; limpar devolve tudo
    await p.fill('#fq', 'PV'); await esperar(600);
    ok((await p.$$eval('.grupo-cards', (l) => l.length)) === 1 && (await p.$eval('.grupo-cards .ph-pilha', (e) => Number(e.dataset.total))) === 4, `${R}: o filtro de texto deixa só o grupo Processo, Pessoal (4 cards)`);
    await p.fill('#fq', ''); await esperar(600);
    ok((await p.$$eval('.grupo-cards', (l) => l.length)) === 6, `${R}: limpar o filtro devolve os seis grupos`);
    if (esquema === 'light' || nome === 'Edge') await p.screenshot({ path: `${CAPTURAS}/cards-celular-${nome.startsWith('Web') ? 'webkit' : 'edge'}-${esquema}.png` });
    // Quadro no celular segue com o carrossel de etapas
    await p.click('button[data-v="quadro"]'); await esperar(500);
    ok(!(await p.$('.grupo-cards')) && (await p.$$eval('.etapas-tabs button', (l) => l.length)) >= 3, `${R}: o Quadro no celular conserva o carrossel de etapas`);
    await c.close();
  }
}

await wk?.close();
parar();
await edge.close();
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
