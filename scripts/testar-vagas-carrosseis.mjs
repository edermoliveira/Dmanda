// Etapa 3 de 6 (decisão 80): quatro vagas persistentes, Urgência no Início e nove carrosséis em Demandas > Cards. No Edge e, quando existe, no WebKit emulado do Playwright, com banco de TESTE
// descartável (PGlite, dados fictícios) e servidor na porta 7127. Três rodadas de servidor:
//   A) sem vagas guardadas: duas sessões abrindo juntas, as quatro vagas, a Urgência (Prefeita e Gabinete, atrasadas, Ofício a sete e a oito dias), sem "Na fila", recarga, virada do dia, as nove filas
//      (ordem, filtros, rolagem própria, deck independente no iPhone, mesmo id em várias filas, falha de gravação, conclusão e reabertura);
//   B) três vagas já guardadas (o que a versão anterior deixou): a quarta é preenchida, as posições 1 a 3 ficam e uma prioridade nova vai para a Urgência sem expulsar ninguém;
//   C) tudo em dia: a Urgência mostra os vencimentos mais próximos;
//   D) os três contadores do Início contra o conjunto aberto em Demandas (hoje, amanhã, 7º e 8º dias, finalizada e arquivada).
// Claro e Escuro, computador, iPad e iPhone EMULADOS, texto a 125%. O WebKit do Playwright NÃO é o Safari do aparelho. Nunca toca o Supabase real. Uso: node scripts/testar-vagas-carrosseis.mjs
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_VAGAS || '7127', BASE = `http://localhost:${PORTA}`, RAIZ = '.dados-teste/vagas-carrosseis', CAPTURAS = '.dados-teste/vagas-carrosseis-capturas';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(RAIZ, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true }); mkdirSync(RAIZ, { recursive: true });
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const PH = '[data-painel="para-hoje"]', URG = '[data-nova-urgencia]';

// ---------- dados fictícios ----------
// Vencimento exato guardado direto no banco (sem o ajuste de fim de semana e feriado): as fronteiras de 7 e 8 dias valem em qualquer dia da semana em que o teste rode.
const SECOES = ['urgentes', 'gabinete', 'prazos', 'oficios', 'aguardando', 'pessoal', 'compras', 'protocolo', 'sem-prazo'];
const ROTULOS = ['Urgentes', 'Gabinete', 'Prazos da Secretaria', 'Ofícios', 'Aguardando há mais tempo', 'Pessoal', 'Compras', 'Protocolo Geral', 'Sem prazo'];
async function semear(nome, tipo, vagas = []) {
  const pasta = `${RAIZ}/${nome}`;
  const db = await abrirBancoTeste({ pasta });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  const HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h, dia = (n) => somarDias(HOJE, n), ID = {};
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const mk = async (chave, assunto, { prazo = null, chegou = null, ...o } = {}) => {
    const d = await c('criar_demanda', { p: { assunto, numero: '', etapa: 'Fazendo', ...(chegou === null ? {} : { chegou_em: dia(chegou) }), ...o } });
    if (prazo !== null) await db.query('update public.demandas set prazo = $1, prazo_original = $1 where id = $2', [dia(prazo), d.id]);
    ID[chave] = d.id; return d;
  };
  if (tipo === 'D') {
    await mk('DA1', 'DA1 atrasada de ontem', { tipo: 'Memorando', prazo: -1 });
    for (const [i, k] of ['DH1', 'DH2', 'DH3', 'DH4'].entries()) await mk(k, `${k} vence hoje`, { tipo: 'Memorando', prazo: 0, chegou: -i });
    await mk('DM', 'DM vence amanhã', { tipo: 'Memorando', prazo: 1 }); await mk('D7', 'D7 vence no sétimo dia', { tipo: 'Memorando', prazo: 7 }); await mk('D8', 'D8 vence no oitavo dia', { tipo: 'Memorando', prazo: 8 });
    await mk('DO7', 'DO7 Ofício no sétimo dia', { tipo: 'Ofício', prazo: 7, chegou: -3 }); await mk('DO8', 'DO8 Ofício no oitavo dia', { tipo: 'Ofício', prazo: 8, chegou: -3 });
    await mk('DF', 'DF finalizada com prazo', { tipo: 'Memorando', prazo: 3 }); await c('concluir_demanda', { p_id: ID.DF });
    await mk('DR', 'DR arquivada com prazo', { tipo: 'Memorando', prazo: 3 }); await c('arquivar_demanda', { p_id: ID.DR });
  } else if (tipo === 'C') {
    await mk('F3', 'F3 em dia 1', { tipo: 'Memorando', prazo: 1 }); await mk('F1', 'F1 em dia 2', { tipo: 'Memorando', prazo: 2 }); await mk('F6', 'F6 em dia 3', { tipo: 'Memorando', prazo: 3 }); await mk('F4', 'F4 em dia 4', { tipo: 'Memorando', prazo: 4 });
    await mk('F2', 'F2 em dia 5', { tipo: 'Memorando', prazo: 5 }); await mk('F5', 'F5 em dia 6', { tipo: 'Memorando', prazo: 6 }); await mk('F7', 'F7 longe', { tipo: 'Memorando', prazo: 20 }); await mk('F8', 'F8 sem prazo', { tipo: 'Memorando' });
    await mk('F9', 'F9 oficio em nove dias', { tipo: 'Ofício', prazo: 9 });
  } else {
    await mk('O1', 'O1 Ofício da Prefeita atrasado', { tipo: 'Ofício', origem: 'Prefeita', prazo: -4, chegou: -30 });
    await mk('O2', 'O2 Ofício em sete dias', { tipo: 'Ofício', prazo: 7, chegou: -10 });
    await mk('O3', 'O3 Ofício em oito dias', { tipo: 'Ofício', prazo: 8, chegou: -9 });
    await mk('O4', 'O4 Ofício sem chegada', { tipo: 'Ofício', prazo: 20 });
    await mk('P1', 'P1 Processo de indenização', { tipo: 'Processo', area: 'Compras', prazo: -1, chegou: -20 });
    await mk('P2', 'P2 Processo de compras sem prazo', { tipo: 'Processo', area: 'Compras', chegou: -50 });
    await mk('P3', 'P3 Protocolo pessoal', { tipo: 'Protocolo', area: 'Pessoal', prazo: 3, chegou: -5 });
    await mk('P4', 'P4 Protocolo geral hoje', { tipo: 'Protocolo', area: 'Geral', prazo: 0, chegou: -2 });
    await mk('P5', 'P5 Processo geral atrasado', { tipo: 'Processo', area: 'Geral', prazo: -8, chegou: -40 });
    await mk('P6', 'P6 Processo pessoal sem prazo', { tipo: 'Processo', area: 'Pessoal', chegou: -3 });
    await mk('M1', 'M1 Memorando do Gabinete', { tipo: 'Memorando', origem: 'Gabinete', prazo: 2, chegou: -1 });
    await mk('M2', 'M2 Memorando atrasado', { tipo: 'Memorando', prazo: -3, chegou: -15 });
    await mk('M3', 'M3 Memorando sem chegada nem prazo', { tipo: 'Memorando' });
    await mk('M4', 'M4 Memorando distante', { tipo: 'Memorando', prazo: 30, chegou: -60 });
  }
  for (const [i, k] of vagas.entries()) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, ID[k]]);
  await db.close();
  return { pasta, ID, HOJE };
}
async function comBanco(pasta, f) { const db = await abrirBancoTeste({ pasta }); try { return await f(db, (fn, a) => chamarComoUsuario(db, USUARIO, fn, a)); } finally { await db.close(); } }

let servidor = null;
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
const subir = async (pasta) => {
  // o Next às vezes interrompe a partida para mostrar um aviso de atualização (e sai); repetir logo em seguida passa. Por isso a partida é repetida se o servidor sair antes de responder.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: pasta }, stdio: 'ignore' });
    for (let i = 0; i < 60; i++) { if (servidor.exitCode !== null) break; try { const r = await fetch(BASE + '/login'); if (r.status < 500) return; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 2000)); }
    try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ }
  }
};

const edge = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const wk = await webkit.launch().catch((e) => { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); return null; });
const erros = [];
const PERFIS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};
const abrir = async (perfil, { motor = edge, tema = 'claro', texto = 100, rota = '/', reduzido = false, extra = {}, esperarSel = `${PH} .vaga`, antes = null } = {}) => {
  const ctx = await motor.newContext({ ...(motor === wk && perfil === 'celular' ? devices['iPhone 13'] : PERFIS[perfil]), reducedMotion: reduzido ? 'reduce' : 'no-preference', ...extra });
  await ctx.addInitScript(([t, p]) => { if (!localStorage.getItem('feito')) { localStorage.setItem('feito', '1'); localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:aparencia', JSON.stringify({ textoPct: p })); } }, [tema, texto]);
  if (antes) await antes(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  await ir(pg, rota, esperarSel);
  return { ctx, pg };
};
const ir = async (pg, rota, esperarSel = `${PH} .vaga`) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForSelector(esperarSel, { timeout: 120000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await esperar(700);
};
const nomeDe = (ID) => (id) => Object.entries(ID).find(([, v]) => v === id)?.[0] ?? id.slice(0, 6);
const semRolagemLateral = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const toast = async (pg, re) => { await pg.waitForFunction((r) => { const t = document.querySelector('#toast'); return !!t && t.classList.contains('on') && (!r || new RegExp(r).test(t.textContent ?? '')); }, re ? re.source : null, { timeout: 15000 }); };

// ---------- leitura da tela ----------
const vagasNaGrade = (pg) => pg.$$eval(`${PH} > .cards > [data-vaga]`, (l) => l.map((e) => `${e.dataset.vaga}:${e.querySelector('.dcard').dataset.id}`));
const urgenciaNaFaixa = (pg) => pg.$$eval(`${URG} [data-urg-faixa] .dcard`, (l) => l.map((e) => e.dataset.id));
const idsDaSecao = (pg, chave) => pg.$$eval(`[data-secao="${chave}"] [data-urg-faixa] .dcard`, (l) => l.map((e) => e.dataset.id));
const emNomes = (ID, ids) => ids.map(nomeDe(ID)).join();

// =============================================================================================================================================
// A) sem vagas guardadas
// =============================================================================================================================================
const A = await semear('a', 'A');
const nA = nomeDe(A.ID);
await subir(A.pasta);
{
  // ---- 1) duas sessões abrindo ao mesmo tempo preenchem as quatro vagas uma só vez
  const [s1, s2] = await Promise.all([abrir('desktop'), abrir('desktop')]);
  for (const s of [s1, s2]) await s.pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] > .cards > [data-vaga]').length === 4, null, { timeout: 30000 }).catch(() => {});
  const [v1, v2] = [await vagasNaGrade(s1.pg), await vagasNaGrade(s2.pg)];
  const leg = (v) => v.map((x) => { const [p, id] = x.split(':'); return `${p}:${nA(id)}`; }).join(' | ');
  ok(leg(v1) === '1:O1 | 2:M1 | 3:P5 | 4:M2', `duas sessões abrindo juntas: quatro vagas, Prefeita e Gabinete primeiro e depois os atrasos (${leg(v1)})`);
  ok(v1.join() === v2.join(), 'as duas sessões mostram as mesmas quatro vagas (nenhuma demanda nem posição repetida)');
  const u = await urgenciaNaFaixa(s1.pg);
  ok(emNomes(A.ID, u) === 'P1,P4,O2', `Urgência: o atraso, o que vence hoje e o Ofício a sete dias, na ordem (${emNomes(A.ID, u)})`);
  ok(!u.includes(A.ID.O3) && !u.includes(A.ID.O4) && !u.includes(A.ID.M4), 'Urgência: o Ofício a oito dias, o a vinte e o memorando distante ficam de fora');
  const vagasIds = v1.map((x) => x.split(':')[1]);
  ok(u.every((id) => !vagasIds.includes(id)) && new Set([...vagasIds, ...u]).size === vagasIds.length + u.length, 'nenhuma demanda repetida entre o Para hoje e a Urgência');
  const pag = await s1.pg.evaluate(() => ({ cards: document.querySelectorAll('.dcard').length, foraDoPainel: [...document.querySelectorAll('.dcard')].filter((e) => !e.closest('[data-painel="para-hoje"]')).length, fila: !!document.querySelector('[data-fila-hoje]'), listas: !!document.querySelector('.cartas'), h4: [...document.querySelectorAll('[data-painel="para-hoje"] h4')].map((e) => e.textContent.trim()).join('|'), na: /Na fila/.test(document.body.innerText) }));
  ok(pag.cards === 7 && pag.foraDoPainel === 0 && !pag.fila && !pag.listas && !pag.na && pag.h4 === 'Urgência', `o Início só tem duas seções de demandas: Para hoje (4) e Urgência (3), sem "Na fila" nem listas (${pag.cards} cards, título "${pag.h4}")`);
  await s1.pg.reload({ waitUntil: 'load' }); await s1.pg.waitForSelector(`${PH} .vaga`); await esperar(900);
  ok((await vagasNaGrade(s1.pg)).join() === v1.join() && emNomes(A.ID, await urgenciaNaFaixa(s1.pg)) === 'P1,P4,O2', 'recarregar mantém as vagas e a Urgência');
  // a ajuda da Urgência e os contadores que levam a Demandas
  await s1.pg.locator(`${URG} .ajuda-b`).click(); await esperar(300);
  ok((await s1.pg.$eval(`${URG} .ajuda-balao`, (e) => e.textContent)).startsWith('Pedidos da Prefeita e do Gabinete'), 'a ajuda da Urgência explica o critério');
  await s1.pg.keyboard.press('Escape');
  await s1.pg.click('.stat.st-atrasadas'); await s1.pg.waitForURL('**/demandas', { timeout: 20000 }); await s1.pg.waitForSelector('[data-secao="urgentes"]', { timeout: 60000 });
  ok(/Filtros 1/.test((await s1.pg.textContent('[data-filtros]')) ?? ''), 'o contador Atrasadas abre Demandas já com o filtro de prazo aplicado');
  await s1.ctx.close(); await s2.ctx.close();
  // ---- 2) virada do dia: as vagas não são reescolhidas
  const instante = new Date(`${A.HOJE}T23:50:00-03:00`);
  const { ctx, pg } = await abrir('desktop', { antes: (c) => c.clock.install({ time: instante }) });
  const antes = await vagasNaGrade(pg);
  await pg.clock.fastForward(25 * 60 * 1000); await ir(pg, '/');
  ok((await vagasNaGrade(pg)).join() === antes.join() && antes.length === 4, 'virada do dia: as mesmas demandas nas mesmas posições depois da meia-noite');
  await ctx.close();
}

// ---- 3) Início em cada largura, Claro e Escuro, texto a 125%
for (const [rot, perfil, tema, texto, motor] of [['computador Claro', 'desktop', 'claro', 100, edge], ['computador Escuro', 'desktop', 'escuro', 100, edge], ['iPad Claro', 'ipad', 'claro', 100, edge], ['iPad Escuro', 'ipad', 'escuro', 100, edge], ['iPhone Claro', 'celular', 'claro', 100, edge], ['iPhone Escuro', 'celular', 'escuro', 125, edge], ...(wk ? [['WebKit emulado iPhone', 'celular', 'claro', 100, wk]] : [])]) {
  const { ctx, pg } = await abrir(perfil, { motor, tema, texto });
  if (perfil === 'celular') {
    const r = await pg.evaluate(() => ({ posPH: document.querySelector('[data-painel="para-hoje"] > .ph-pilha .ph-posicao')?.textContent.trim(), posU: document.querySelector('[data-nova-urgencia] .ph-posicao')?.textContent.trim(), fila: !!document.querySelector('[data-fila-hoje]'), acoes: [...document.querySelectorAll('[data-painel="para-hoje"] > .ph-pilha .ph-botoes .btn')].map((b) => b.textContent.trim()).join('|') }));
    const w1 = await pg.$eval(`${PH} > .ph-pilha .ph-arrasto .dcard`, (e) => [e.offsetWidth, e.offsetHeight]), w2 = await pg.$eval(`${URG} .ph-arrasto .dcard`, (e) => [e.offsetWidth, e.offsetHeight]);
    ok(r.posPH === '1 de 4' && r.posU === '1 de 3' && !r.fila, `${rot}: o Para hoje é um baralho de quatro e a Urgência um de três (${r.posPH}, ${r.posU})`);
    ok(w1.join() === w2.join() && r.acoes === 'Passar para o fim|Abrir|Avançar etapa', `${rot}: os cards têm o mesmo tamanho nos dois baralhos (${w1.join('x')}) e as ações da etapa 2 continuam (${r.acoes})`);
  } else {
    const r = await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-nova-urgencia] [data-urg-faixa] .dcard')].map((e) => e.getBoundingClientRect()); const v = [...document.querySelectorAll('[data-painel="para-hoje"] > .cards .dcard')].map((e) => e.getBoundingClientRect()); return { u: l.length, v: v.length, mesmaLinhaV: v.every((x) => Math.abs(x.y - v[0].y) < 1), larg: l.map((x) => Math.round(x.width)), largV: v.map((x) => Math.round(x.width)) }; });
    ok(r.v === 4 && (perfil === 'ipad' || r.mesmaLinhaV) && r.u === 3 && r.larg.every((w) => Math.abs(w - r.largV[0]) <= 2), `${rot}: as quatro vagas na grade (na mesma linha no computador, em duas colunas no iPad) e a Urgência com três cards da largura do Para hoje (${r.largV[0]} e ${r.larg[0]} px)`);
  }
  ok(await semRolagemLateral(pg), `${rot}: a página não ganha rolagem horizontal`);
  await pg.screenshot({ path: `${CAPTURAS}/inicio-${rot.replace(/ /g, '-')}.png`, fullPage: true });
  await ctx.close();
}

// =============================================================================================================================================
// Demandas > Cards: as nove filas
// =============================================================================================================================================
const ESPERADO = {
  urgentes: 'O1,M1,P5,M2,P1', gabinete: 'O1,M1', prazos: 'P5,M2,P1,P4,M1,P3,M4,P2,P6,M3', oficios: 'O1,O2,O3,O4',
  aguardando: 'M4,P2,P5,O1,P1,M2,O2,O3,P3,P6,P4,M1,O4,M3', pessoal: 'P3,P6', compras: 'P1,P2', protocolo: 'P5,P4', 'sem-prazo': 'P2,P6,M3',
};
const COR = { pessoal: 'cat-verde', compras: 'cat-amar', protocolo: 'cat-azul' };
for (const [rot, perfil, tema, texto, motor] of [['computador Claro', 'desktop', 'claro', 100, edge], ['computador Escuro', 'desktop', 'escuro', 100, edge], ['iPad Claro', 'ipad', 'claro', 100, edge], ['iPad Escuro 125%', 'ipad', 'escuro', 125, edge], ...(wk ? [['WebKit emulado computador', 'desktop', 'claro', 100, wk]] : [])]) {
  const { ctx, pg } = await abrir(perfil, { motor, tema, texto, rota: '/demandas', esperarSel: '[data-secao="urgentes"]' });
  const cab = await pg.$$eval('.grupo-cards', (l) => l.map((e) => ({ chave: e.dataset.secao, rotulo: e.querySelector('h3 > span')?.textContent.trim(), n: e.querySelectorAll('.dcard').length, ajuda: !!e.querySelector('.ajuda-b') })));
  ok(cab.map((c) => c.chave).join() === SECOES.join() && cab.map((c) => c.rotulo).join() === ROTULOS.join(), `${rot}: as nove seções na ordem pedida (${cab.map((c) => c.rotulo).join(' | ')})`);
  let ordemOk = true; const dif = [];
  for (const k of SECOES) { const got = emNomes(A.ID, await idsDaSecao(pg, k)); if (got !== ESPERADO[k]) { ordemOk = false; dif.push(`${k}: ${got}`); } }
  ok(ordemOk, `${rot}: a ordem de cada fila confere${dif.length ? ' (' + dif.join(' ; ') + ')' : ''}`);
  const geo = await pg.evaluate(() => [...document.querySelectorAll('.grupo-cards')].map((s) => {
    const f = s.querySelector('[data-urg-faixa]'); if (!f) return { chave: s.dataset.secao, vazia: true };
    const cs = [...f.querySelectorAll('.dcard')].map((e) => e.getBoundingClientRect());
    return { chave: s.dataset.secao, disp: getComputedStyle(f).display, ox: getComputedStyle(f).overflowX, mesmaLinha: cs.every((r) => Math.abs(r.y - cs[0].y) < 1), mesmoTam: cs.every((r) => Math.abs(r.width - cs[0].width) < 1 && Math.abs(r.height - cs[0].height) < 1), larg: Math.round(cs[0].width), rola: f.scrollWidth > f.clientWidth + 1, setas: s.querySelectorAll('.urg-seta').length, foco: f.tabIndex };
  }));
  ok(geo.every((g) => g.vazia || (g.disp === 'flex' && g.ox === 'auto' && g.mesmaLinha && g.mesmoTam && g.foco === 0)), `${rot}: cada seção é uma faixa com rolagem horizontal própria, cards lado a lado e do mesmo tamanho (${geo.filter((g) => !g.vazia).map((g) => g.larg)[0]} px)`);
  ok(geo.every((g) => g.vazia || (g.rola ? g.setas === 2 : g.setas === 0)), `${rot}: as setas só aparecem nas seções que têm mais cards do que cabem (${geo.filter((g) => g.rola).map((g) => g.chave).join(', ')})`);
  ok(await semRolagemLateral(pg), `${rot}: a página não ganha rolagem horizontal`);
  // chegar ao último card e a rolagem de uma não mexe nas outras
  const alvo = geo.find((g) => g.rola)?.chave;
  if (alvo) {
    await pg.$eval(`[data-secao="${alvo}"]`, (e) => e.scrollIntoView({ block: 'center' })); await esperar(300);
    await pg.click(`[data-secao="${alvo}"] [data-urg-prox]`); await esperar(900);
    const sl = await pg.$$eval('[data-urg-faixa]', (l) => l.map((e) => Math.round(e.scrollLeft)));
    ok(sl.filter((x) => x > 10).length === 1, `${rot}: rolar uma seção não mexe nas outras (${sl.join(', ')}; os 2 px são o encaixe do começo da faixa)`);
    await pg.$eval(`[data-secao="${alvo}"] [data-urg-faixa]`, (e) => { e.scrollLeft = e.scrollWidth; }); await esperar(500);
    const fim = await pg.$eval(`[data-secao="${alvo}"] [data-urg-faixa]`, (e) => { const u = e.querySelector('.vaga:last-child').getBoundingClientRect(); return { dentro: u.right <= e.getBoundingClientRect().right + 1, id: e.querySelector('.vaga:last-child .dcard').dataset.id, off: e.parentElement.querySelector('[data-urg-prox]').getAttribute('aria-disabled') }; });
    ok(fim.dentro && fim.off === 'true' && nA(fim.id) === ESPERADO[alvo].split(',').at(-1), `${rot}: dá para chegar ao último card de "${alvo}" (${nA(fim.id)}) e a seta de avançar se apaga`);
    await pg.$eval(`[data-secao="${alvo}"] [data-urg-faixa]`, (e) => { e.scrollLeft = 0; });
  }
  // tratamento visual das classificações
  const cores = await pg.evaluate((cor) => Object.fromEntries(Object.entries(cor).map(([k, v]) => [k, [...document.querySelectorAll(`[data-secao="${k}"] .face.front`)].every((e) => e.classList.contains(v))])), COR);
  const quad = await pg.evaluate(() => Object.fromEntries(['pessoal', 'compras', 'protocolo', 'urgentes'].map((k) => [k, getComputedStyle(document.querySelector(`[data-secao="${k}"] .grupo-cor`)).backgroundColor])));
  ok(Object.values(cores).every(Boolean) && quad.pessoal !== quad.compras && quad.compras !== quad.protocolo && quad.pessoal !== quad.urgentes, `${rot}: Pessoal em verde, Compras em amarelo e Protocolo Geral em azul, nos cards e no marcador do título`);
  const notas = await pg.$$eval('[data-secao="aguardando"] .vaga', (l) => l.map((v) => `${v.querySelector('.dcard').dataset.id}|${v.querySelector('[data-nota]')?.textContent.trim()}`));
  const semCh = notas.filter((x) => /Sem data de chegada/.test(x)).map((x) => nA(x.split('|')[0])).join();
  ok(semCh === 'O4,M3' && notas.every((x) => /^[^|]+\|(Chegou|Sem data)/.test(x)) && /Chegou há 60 dias/.test(notas[0]) && ESPERADO.aguardando.endsWith('O4,M3'), `${rot}: em "Aguardando há mais tempo" cada card diz há quantos dias chegou e os sem chegada (${semCh}) vão por último, sinalizados`);
  if (perfil === 'desktop' && motor === edge) await pg.screenshot({ path: `${CAPTURAS}/cards-${tema}.png`, fullPage: true });
  await ctx.close();
}

// ---- iPhone: cada seção é um baralho com a posição só dela
for (const [rot, tema, texto, motor] of [['iPhone Claro', 'claro', 100, edge], ['iPhone Escuro 125%', 'escuro', 125, edge], ...(wk ? [['WebKit emulado iPhone', 'claro', 100, wk]] : [])]) {
  const { ctx, pg } = await abrir('celular', { motor, tema, texto, rota: '/demandas', esperarSel: '[data-secao="urgentes"]', reduzido: true });
  const decks = await pg.$$eval('.grupo-cards', (l) => l.map((e) => ({ chave: e.dataset.secao, deck: !!e.querySelector('.ph-pilha'), faixa: !!e.querySelector('[data-urg-faixa]'), total: Number(e.querySelector('.ph-pilha')?.dataset.total ?? 0), pos: e.querySelector('.ph-posicao')?.textContent.trim() })));
  ok(decks.every((d) => d.deck && !d.faixa) && decks.map((d) => d.total).join() === SECOES.map((k) => ESPERADO[k].split(',').length).join(), `${rot}: cada seção é um baralho (${decks.map((d) => d.pos).join(', ')})`);
  const topo = (k) => pg.$eval(`[data-secao="${k}"] .ph-arrasto`, (e) => e.dataset.ativoId);
  // passar três vezes em Prazos não mexe nos outros baralhos
  const antes = Object.fromEntries(await Promise.all(SECOES.map(async (k) => [k, await topo(k)])));
  await pg.$eval('[data-secao="prazos"]', (e) => e.scrollIntoView({ block: 'center' })); await esperar(300);
  for (let i = 0; i < 3; i++) { await pg.click('[data-secao="prazos"] [data-pilha-passar]'); await esperar(250); }
  const depois = Object.fromEntries(await Promise.all(SECOES.map(async (k) => [k, await topo(k)])));
  ok(nA(depois.prazos) === ESPERADO.prazos.split(',')[3] && SECOES.filter((k) => k !== 'prazos').every((k) => depois[k] === antes[k]), `${rot}: passar três cards em Prazos da Secretaria não mexe nas outras oito seções`);
  // percorrer cada seção inteira: cada card aparece uma vez, até o último, e o ciclo fecha
  let tudo = true; const desvio = [];
  for (const k of SECOES) {
    const esperado = ESPERADO[k].split(','); if (esperado.length < 2) continue;
    await pg.$eval(`[data-secao="${k}"]`, (e) => e.scrollIntoView({ block: 'center' })); await esperar(150);
    // leva ao primeiro e percorre
    for (let i = 0; i < esperado.length && nA(await topo(k)) !== esperado[0]; i++) { await pg.click(`[data-secao="${k}"] [data-pilha-passar]`); await esperar(200); }
    const vistos = [];
    for (let i = 0; i < esperado.length; i++) { vistos.push(nA(await topo(k))); await pg.click(`[data-secao="${k}"] [data-pilha-passar]`); await esperar(200); }
    if (vistos.join() !== esperado.join() || nA(await topo(k)) !== esperado[0]) { tudo = false; desvio.push(`${k}: ${vistos.join()}`); }
  }
  ok(tudo, `${rot}: cada baralho percorre a sua fila inteira, na ordem, até o último card, e o ciclo fecha${desvio.length ? ' (' + desvio.join(' ; ') + ')' : ''}`);
  const tam = await pg.$$eval('.grupo-cards .ph-arrasto .dcard', (l) => [...new Set(l.map((e) => `${e.offsetWidth}x${e.offsetHeight}`))]);
  const acoes = await pg.$$eval('.grupo-cards .ph-botoes', (l) => [...new Set(l.map((b) => [...b.querySelectorAll('.btn')].map((x) => x.textContent.trim()).join('|')))]);
  ok(tam.length === 1 && acoes.join() === 'Passar para o fim|Abrir|Voltar ao anterior', `${rot}: todos os baralhos têm o mesmo tamanho de card (${tam.join()}) e as ações da etapa 2 (${acoes.join(' ; ')})`);
  ok(await semRolagemLateral(pg), `${rot}: a página não ganha rolagem horizontal`);
  await pg.screenshot({ path: `${CAPTURAS}/cards-${rot.replace(/ /g, '-')}.png` });
  await ctx.close();
}

// ---- filtros vigentes: Só atrasadas, texto e um card só
{
  const { ctx, pg } = await abrir('desktop', { rota: '/demandas', esperarSel: '[data-secao="urgentes"]' });
  await pg.click('button[aria-label="Só atrasadas"]'); await esperar(600);
  const esp = { urgentes: 'O1,P5,M2,P1', gabinete: 'O1', prazos: 'P5,M2,P1', oficios: 'O1', aguardando: 'P5,O1,P1,M2', pessoal: '', compras: 'P1', protocolo: 'P5', 'sem-prazo': '' };
  let o = true; const d = [];
  for (const k of SECOES) { const got = emNomes(A.ID, await idsDaSecao(pg, k)); if (got !== esp[k]) { o = false; d.push(`${k}: ${got}`); } }
  ok(o, `o filtro "Só atrasadas" vale em todas as seções${d.length ? ' (' + d.join(' ; ') + ')' : ''}`);
  ok((await pg.textContent('[data-secao="pessoal"]'))?.includes('Nenhuma demanda nesta fila'), 'uma seção sem demandas mostra o aviso (e não some)');
  await pg.click('button[aria-label="Só atrasadas"]'); await esperar(400);
  await pg.fill('#fq', 'P4 Protocolo'); await esperar(600);
  const um = {}; for (const k of SECOES) um[k] = emNomes(A.ID, await idsDaSecao(pg, k));
  ok(um.prazos === 'P4' && um.aguardando === 'P4' && um.protocolo === 'P4' && um.urgentes === '' && um.oficios === '', `o filtro de texto vale em todas as seções (${SECOES.filter((k) => um[k]).join(', ')})`);
  await pg.fill('#fq', ''); await ctx.close();
}
{
  const { ctx, pg } = await abrir('celular', { rota: '/demandas', esperarSel: '[data-secao="urgentes"]', reduzido: true });
  await pg.fill('#fq', 'P4 Protocolo'); await esperar(700);
  const r = await pg.$eval('[data-secao="protocolo"]', (e) => ({ pos: e.querySelector('.ph-posicao')?.textContent.trim(), passar: e.querySelector('[data-pilha-passar]')?.getAttribute('aria-disabled'), tam: [e.querySelector('.dcard').offsetWidth, e.querySelector('.dcard').offsetHeight].join('x') }));
  ok(r.pos === '1 de 1' && r.passar === 'true', `iPhone: com um card só a seção mostra "1 de 1" e não oferece passar (${r.pos})`);
  await pg.fill('#fq', ''); await esperar(500);
  const t2 = await pg.$eval('[data-secao="prazos"] .dcard', (e) => `${e.offsetWidth}x${e.offsetHeight}`);
  ok(r.tam === t2, `iPhone: o card único tem o tamanho dos demais (${r.tam} e ${t2})`);
  await ctx.close();
}

// ---- mesmo id em várias filas: editar, mudar a etapa, falha de gravação, concluir e reabrir
{
  const { ctx, pg } = await abrir('desktop', { rota: '/demandas', esperarSel: '[data-secao="urgentes"]' });
  const oc = () => pg.$$eval(`.grupo-cards .dcard[data-id="${A.ID.O1}"]`, (l) => ({ n: l.length, secoes: l.map((e) => e.closest('.grupo-cards').dataset.secao).join(), titulos: [...new Set(l.map((e) => e.querySelector('.assunto').textContent.trim()))], etapas: [...new Set(l.map((e) => [...e.querySelectorAll('.tags .chip')].map((c) => c.textContent.trim()).find((t) => /^(Cadastro|Vistos|Fazendo|Aguardando|Finalizada)/.test(t))))] }));
  const r0 = await oc();
  ok(r0.n === 4 && r0.secoes === 'urgentes,gabinete,oficios,aguardando', `o Ofício da Prefeita atrasado aparece nas quatro filas certas (${r0.secoes}), cada uma uma só vez`);
  // editar o assunto em uma ocorrência: todas mudam
  await pg.locator(`[data-secao="oficios"] .dcard[data-id="${A.ID.O1}"] .assunto`).click(); await pg.waitForSelector('.modal .ler');
  await pg.click('[data-lapis="identificacao"]'); await pg.waitForSelector('#d-assunto'); await pg.fill('#d-assunto', 'O1 Ofício da Prefeita (editado)');
  await pg.click('.modal [data-salvar="identificacao"]'); await toast(pg, /alterações salvas|Identificação/).catch(() => {});
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 15000 }); await esperar(500);
  const r1 = await oc();
  ok(r1.n === 4 && r1.titulos.length === 1 && r1.titulos[0] === 'O1 Ofício da Prefeita (editado)', 'editar o assunto em uma fila muda em todas as ocorrências do mesmo id');
  // mudar a etapa pelo verso de uma ocorrência
  const alvo = pg.locator(`[data-secao="gabinete"] .dcard[data-id="${A.ID.O1}"]`);
  await alvo.locator('button.girar').first().click(); await esperar(900);
  await alvo.locator('button[aria-label="Mover de etapa"]').click();
  await pg.locator('.mv-menu button[role="menuitemradio"]:has-text("Vistos")').click(); await esperar(900);
  const r2 = await oc();
  ok(r2.n === 4 && r2.etapas.join() === 'Vistos', `mudar a etapa em uma fila muda em todas as ocorrências (${r2.etapas.join()})`);
  // falha de gravação ao concluir: nada some
  const derrubar = (rota) => (rota.request().method() === 'POST' && rota.request().headers()['next-action'] ? rota.abort() : rota.continue());
  await pg.route('**/*', derrubar);
  await pg.locator(`[data-secao="oficios"] .dcard[data-id="${A.ID.O1}"] button:has-text("Concluir demanda")`).click();
  await toast(pg, /não|falh|erro|conex/i).catch(() => {}); await esperar(900);
  const r3 = await oc();
  ok(r3.n === 4, 'concluir com a gravação falhando não tira o Ofício de nenhuma fila');
  await pg.unroute('**/*', derrubar);
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('[data-secao="urgentes"]'); await esperar(900);
  ok((await oc()).n === 4, 'recarregar depois da falha: o Ofício continua nas quatro filas (nada foi gravado)');
  // concluir de verdade: sai de todas
  await pg.locator(`[data-secao="aguardando"] .dcard[data-id="${A.ID.O1}"] button:has-text("Concluir demanda")`).click();
  await pg.waitForFunction((id) => !document.querySelector(`.grupo-cards .dcard[data-id="${id}"]`), A.ID.O1, { timeout: 20000 });
  ok((await oc()).n === 0 && (await pg.$$eval('.grupo-cards .dcard', (l) => l.length)) > 0, 'concluir em uma fila tira o Ofício de todas as filas ao mesmo tempo (as demais seguem)');
  const finalizada = (await pg.$$eval('.grupo-cards', (l) => l.map((e) => e.dataset.secao))).length === 9;
  ok(finalizada, 'as nove seções continuam na tela depois da conclusão');
  // reabrir pelo Quadro e voltar
  await pg.click('button[data-v="quadro"]'); await esperar(900);
  await pg.locator(`.mini-card[data-id="${A.ID.O1}"] button:has-text("Reabrir demanda")`).click(); await esperar(900);
  await pg.click('button[data-v="cards"]'); await pg.waitForSelector('[data-secao="urgentes"]'); await esperar(700);
  const r4 = await oc();
  ok(r4.n === 4 && r4.secoes === 'urgentes,gabinete,oficios,aguardando', `reabrir a demanda a devolve às quatro filas (${r4.secoes})`);
  await ctx.close();
}
parar(); await esperar(2500);
// o que ficou gravado: quatro vagas, nenhuma repetida, e o Ofício reaberto
await comBanco(A.pasta, async (db) => {
  const v = (await db.query('select p.posicao, d.assunto, d.etapa from public.para_hoje p join public.demandas d on d.id = p.demanda_id order by p.posicao')).rows;
  ok(v.length === 4 && v.map((x) => x.posicao).join() === '1,2,3,4' && new Set(v.map((x) => x.assunto)).size === 4 && v.every((x) => x.etapa !== 'Finalizado'), `banco: quatro vagas, uma por posição, sem repetição e nenhuma finalizada (${v.map((x) => x.assunto.slice(0, 2)).join(',')})`);
  const d = (await db.query('select assunto, etapa, concluida_em from public.demandas where id = $1', [A.ID.O1])).rows[0];
  ok(d.assunto === 'O1 Ofício da Prefeita (editado)' && d.etapa !== 'Finalizado' && d.concluida_em === null, `banco: o Ofício editado foi reaberto (${d.etapa})`);
});

// =============================================================================================================================================
// B) três vagas já guardadas: a quarta entra, as posições 1 a 3 ficam, uma prioridade nova vai para a Urgência
// =============================================================================================================================================
const B = await semear('b', 'A', ['P5', 'M2', 'P4']);
const nB = nomeDe(B.ID);
await subir(B.pasta);
{
  const { ctx, pg } = await abrir('desktop');
  await pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] > .cards > [data-vaga]').length === 4, null, { timeout: 30000 }).catch(() => {});
  const leg = (v) => v.map((x) => { const [p, id] = x.split(':'); return `${p}:${nB(id)}`; }).join(' | ');
  const v = await vagasNaGrade(pg);
  ok(leg(v) === '1:P5 | 2:M2 | 3:P4 | 4:O1', `upgrade: as vagas 1 a 3 guardadas ficam e a quarta recebe a melhor candidata, o pedido da Prefeita (${leg(v)})`);
  ok(emNomes(B.ID, await urgenciaNaFaixa(pg)) === 'M1,P1,O2', `a Urgência traz o Gabinete, o atraso e o Ofício a sete dias (${emNomes(B.ID, await urgenciaNaFaixa(pg))})`);
  await ctx.close();
}
parar(); await esperar(2500);
await comBanco(B.pasta, async (db, c) => {
  const nova = await c('criar_demanda', { p: { assunto: 'N1 Nova da Prefeita', tipo: 'Memorando', numero: '', etapa: 'Fazendo', origem: 'Prefeita' } });
  await db.query('update public.demandas set prazo = $1, prazo_original = $1 where id = $2', [somarDias(B.HOJE, 30), nova.id]); B.ID.N1 = nova.id;
});
await subir(B.pasta);
{
  const { ctx, pg } = await abrir('desktop');
  await esperar(1200);
  const leg = (v) => v.map((x) => { const [p, id] = x.split(':'); return `${p}:${nB(id)}`; }).join(' | ');
  const v = await vagasNaGrade(pg);
  ok(leg(v) === '1:P5 | 2:M2 | 3:P4 | 4:O1', 'uma prioridade nova da Prefeita não expulsa ninguém das quatro vagas');
  ok(emNomes(B.ID, await urgenciaNaFaixa(pg)) === 'M1,N1,P1,O2', `ela entra na Urgência, depois do Gabinete mais próximo (${emNomes(B.ID, await urgenciaNaFaixa(pg))})`);
  // concluir a demanda de uma vaga repõe só a vaga liberada
  await pg.click('[data-vaga="2"] button:has-text("Concluir demanda")');
  await pg.waitForFunction(() => !/M2 Memorando/.test(document.querySelector('[data-vaga="2"]')?.textContent ?? ''), null, { timeout: 20000 }); await esperar(1200);
  const v2 = await vagasNaGrade(pg);
  ok(leg(v2) === '1:P5 | 2:M1 | 3:P4 | 4:O1', `concluir a vaga 2 repõe só a vaga 2, com o Gabinete (${leg(v2)})`);
  ok(emNomes(B.ID, await urgenciaNaFaixa(pg)) === 'N1,P1,O2', 'e a Urgência perde o que subiu para a vaga');
  await ctx.close();
}
parar(); await esperar(2500);

// =============================================================================================================================================
// C) tudo em dia: a Urgência mostra os vencimentos mais próximos
// =============================================================================================================================================
const C = await semear('c', 'C');
const nC = nomeDe(C.ID);
await subir(C.pasta);
{
  const { ctx, pg } = await abrir('desktop');
  await pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] > .cards > [data-vaga]').length === 4, null, { timeout: 30000 }).catch(() => {});
  const v = await vagasNaGrade(pg);
  ok(v.map((x) => nC(x.split(':')[1])).join() === 'F3,F1,F6,F4', `sem urgências, as quatro vagas ficam com os vencimentos mais próximos (${v.map((x) => nC(x.split(':')[1])).join()})`);
  const u = await urgenciaNaFaixa(pg);
  ok(emNomes(C.ID, u) === 'F2,F5' && !!(await pg.$(`${URG}[data-proximos]`)), `a Urgência cai nos próximos vencimentos (${emNomes(C.ID, u)}), sem o sem prazo, o distante nem o Ofício a nove dias`);
  await pg.locator(`${URG} .ajuda-b`).click(); await esperar(300);
  ok((await pg.$eval(`${URG} .ajuda-balao`, (e) => e.textContent)) === 'Sem urgências agora: os próximos vencimentos', 'a ajuda diz que são os próximos vencimentos');
  const fundo = await pg.$eval(URG, (e) => getComputedStyle(e).backgroundColor);
  ok(/rgba\(0, 0, 0, 0\)|transparent/.test(fundo), `sem urgência de verdade o fundo de alerta não aparece (${fundo})`);
  await pg.screenshot({ path: `${CAPTURAS}/inicio-fallback.png`, fullPage: true });
  await ctx.close();
}
parar(); await esperar(2500);

// =============================================================================================================================================
// D) contadores do Início x conjunto aberto em Demandas
// =============================================================================================================================================
const D = await semear('d', 'D');
const nD = nomeDe(D.ID);
await subir(D.pasta);
{
  const ESPERADO = { atrasadas: 'DA1', hoje: 'DH1,DH2,DH3,DH4', sete: 'D7,DM,DO7' };
  for (const [rot, perfil, motor] of [['computador', 'desktop', edge], ['iPad', 'ipad', edge], ...(wk ? [['WebKit emulado iPad', 'ipad', wk]] : [])]) {
    const { ctx, pg } = await abrir(perfil, { motor });
    await pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] > .cards > [data-vaga]').length === 4, null, { timeout: 30000 }).catch(() => {});
    // o Para hoje e a Urgência: quem vence hoje ou está atrasado aparece uma só vez, nas vagas ou na Urgência
    const vagasIds = (await vagasNaGrade(pg)).map((x) => x.split(':')[1]), urg = await urgenciaNaFaixa(pg);
    const obrig = ['DA1', 'DH1', 'DH2', 'DH3', 'DH4'].map((k) => D.ID[k]);
    ok(obrig.every((id) => [...vagasIds, ...urg].filter((x) => x === id).length === 1) && urg.every((id) => !vagasIds.includes(id)), `${rot}: o atraso e as quatro que vencem hoje aparecem uma só vez, nas vagas ou na Urgência, sem repetir (vagas ${emNomes(D.ID, vagasIds)}; Urgência ${emNomes(D.ID, urg)})`);
    ok(urg.includes(D.ID.DO7) || vagasIds.includes(D.ID.DO7), `${rot}: o Ofício no sétimo dia está no Para hoje ou na Urgência`);
    ok(![...urg, ...vagasIds].includes(D.ID.DO8), `${rot}: o Ofício no oitavo dia fica de fora do Para hoje e da Urgência`);
    for (const g of ['atrasadas', 'hoje', 'sete']) {
      await ir(pg, '/', '.stat.st-hoje');
      const n = Number((await pg.textContent(`.stat.st-${g} .n`)).trim());
      await pg.click(`.stat.st-${g}`); await pg.waitForURL('**/demandas', { timeout: 20000 }); await pg.waitForSelector('[data-secao="urgentes"]', { timeout: 60000 }); await esperar(600);
      const nomes = (ids) => [...new Set(ids)].map(nD).sort().join(',');
      const cards = await pg.$$eval('.grupo-cards .dcard', (l) => l.map((e) => e.dataset.id));
      await pg.click('button[data-v="quadro"]'); await esperar(800);
      const quadro = await pg.$$eval('.mini-card', (l) => l.map((e) => e.dataset.id));
      await pg.click('button[data-v="cards"]'); await pg.waitForSelector('[data-secao="urgentes"]');
      const certo = ESPERADO[g].split(',').sort().join(',');
      ok(n === ESPERADO[g].split(',').length && nomes(cards) === certo && nomes(quadro) === certo && new Set(cards).size === n, `${rot}, contador ${g}: ${n} contadas, Cards abre ${new Set(cards).size} ids únicos e o Quadro ${new Set(quadro).size}, os mesmos (${nomes(cards)})`);
    }
    await ctx.close();
  }
}
parar();
await wk?.close();
await edge.close();
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
