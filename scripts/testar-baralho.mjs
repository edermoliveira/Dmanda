// Baralho do Início no celular (decisão 65, aprovado na prévia 887b116 da decisão 67; portado para a main em 14/11/2026) com as TRÊS vagas da main: Para hoje, Nova urgência e as listas
// de cards dos filtros do Início. No navegador (Edge) com banco de TESTE descartável (PGlite), servidor na porta 7116. Toque emulado pelo protocolo do navegador (não é aparelho real).
// A seção 4 (decisão 75, a página não salta na troca do card) roda também no WebKit do Playwright, quando ele existe neste computador.
// Adaptado do teste da branch bloco/inicio-perfil-clima (914c435), sem Clima, pagamentos, prioridade por origem nem quatro vagas.
// Uso: node scripts/testar-baralho.mjs   (nunca toca o Supabase real)
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_BARALHO || '7116', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/baralho', CAPTURAS = '.dados-teste/baralho-capturas';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });
const PASSAR = '[data-painel="para-hoje"] > .ph-pilha [data-pilha-passar]', AVANCAR = '[data-painel="para-hoje"] > .ph-pilha [data-pilha-avancar]', ABRIR = '[data-painel="para-hoje"] > .ph-pilha [data-pilha-abrir]';
const ATIVA = '[data-painel="para-hoje"] > .ph-pilha';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- dados: três vagas ocupadas (Alfa, Charlie, Eco) e duas urgências fora delas (Delta, Foxtrot) ----------
const ID = {};
let HOJE;
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const tarefas = async (id, textos, feitas = 0) => { for (let i = 0; i < textos.length; i++) { const r = await c('adicionar_tarefa', { p_demanda: id, p_texto: textos[i] }); if (i < feitas) await c('marcar_tarefa', { p_id: r.tarefas[i].id, p_concluida: true }); } };
  const mk = async (chave, assunto, o, textos, feitas = 0) => { const d = await c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: '', ...o } }); await tarefas(d.id, textos, feitas); ID[chave] = d.id; return d; };
  const A = await mk('A', 'Alfa em Cadastro', { prazo_original: HOJE }, ['a1', 'a2']); await c('mover_etapa', { p_id: A.id, p_etapa: 'Cadastro' }); // com tarefas o cadastro vai a Vistos: volta a Cadastro
  await mk('C', 'Charlie em Fazendo com pendências', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -2) }, ['c1', 'c2', 'c3'], 1);
  const E = await mk('E', 'Eco aguardando a Prefeita', { etapa: 'Aguardando Prefeita', prazo_original: somarDias(HOJE, 20) }, ['e1']);
  await db.query(`update public.demandas set etapa_desde = (($1::date + time '12:00') at time zone 'America/Sao_Paulo') - interval '12 days' where id = $2`, [HOJE, E.id]);
  await mk('D', 'Delta em Fazendo sem pendências', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -3) }, ['d1'], 1);
  await mk('F', 'Foxtrot aguardando retorno do setor', { etapa: 'Aguardando retorno', setor: 'Obras', acompanhar_em: somarDias(HOJE, -1) }, ['f1']);
  await mk('B', 'Bravo em Vistos distante', { etapa: 'Vistos', prazo_original: somarDias(HOJE, 25) }, ['b1']);   // além de 7 dias: nunca candidata
  for (const [i, k] of ['A', 'C', 'E'].entries()) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, ID[k]]);
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

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const PERFIS = { desktop: { viewport: { width: 1440, height: 900 } }, ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } };
const abrir = async (perfil, { extra = {}, antes, motor = nav } = {}) => {
  const ctx = await motor.newContext({ ...PERFIS[perfil], ...extra });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  if (antes) await antes(pg, ctx);
  await pg.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
  await pg.waitForSelector('[data-painel="para-hoje"] [data-vaga]', { timeout: 120000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 4000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await esperar(600);
  return { ctx, pg };
};
const R = (pg, sel) => pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; });
const lsOrdem = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('dmanda:para-hoje-ordem') ?? 'null'); } catch { return 'invalido'; } });
/** Deslize de verdade: toque enviado pelo protocolo do navegador (pointerType "touch"), em vários passos. */
const deslizar = async (pg, x1, y1, x2, y2, passos = 10) => {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
  for (let i = 1; i <= passos; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + ((x2 - x1) * i) / passos, y: y1 + ((y2 - y1) * i) / passos }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await esperar(450);
};
const caixaAtiva = (pg) => R(pg, `${ATIVA} .ph-arrasto`);
const deslizarAtivo = async (pg, dx, dy = 0) => { const c = await caixaAtiva(pg); const y = c.y + c.h * 0.45, x = c.x + c.w / 2; await deslizar(pg, x - dx / 2, y, x + dx / 2, y + dy); };
const ativo = (pg) => pg.$eval(`${ATIVA} .vaga[data-ativo]`, (e) => ({ id: e.closest('[data-ativo-id]').dataset.ativoId, assunto: e.querySelector('.assunto')?.textContent.trim(), etapa: e.querySelector('.tags .chip.neutro, .tags .chip')?.textContent.trim(), vaga: e.dataset.vaga })).catch(() => null);
const aguardarAtivo = (pg, assunto) => pg.waitForFunction((a) => document.querySelector('[data-painel="para-hoje"] > .ph-pilha .vaga[data-ativo] .assunto')?.textContent.trim().startsWith(a), assunto, { timeout: 8000 }).then(() => true, () => false);
const trazer = async (pg, alvo) => { for (let i = 0; i < 6 && !(await ativo(pg))?.assunto.startsWith(alvo); i++) { await pg.click(PASSAR); await esperar(500); } return (await ativo(pg))?.assunto.startsWith(alvo); };

// ---------- 1) computador e iPad: a grade da main, sem baralho ----------
for (const perfil of ['desktop', 'ipad']) {
  const { ctx, pg } = await abrir(perfil);
  const info = await pg.evaluate(() => ({ pilhas: document.querySelectorAll('.ph-pilha, .ph-atras').length, vagas: [...document.querySelectorAll('[data-painel="para-hoje"] > .cards > [data-vaga]')].map((e) => e.dataset.vaga).join(), urg: document.querySelectorAll('[data-nova-urgencia] .cards .dcard').length, modo: document.querySelector('[data-painel="para-hoje"]').dataset.modo }));
  ok(info.pilhas === 0 && info.vagas === '1,2,3' && info.urg === 2 && info.modo === 'grade', `${perfil}: sem baralho; as três vagas na grade de sempre (${info.vagas}) e a Nova urgência com ${info.urg} cards`);
  await pg.click('.stat.st-atrasadas'); await esperar(400);
  ok((await pg.$$eval('.cartas[data-modo="grade"] .cards .dcard', (l) => l.length)) >= 3 && !(await pg.$('.cartas .ph-pilha')), `${perfil}: o filtro Atrasadas mostra a grade de cards de sempre`);
  await pg.screenshot({ path: `${CAPTURAS}/${perfil}-inicio.png`, fullPage: true });
  await ctx.close();
}

// ---------- 2) celular: pilha, gestos, verso, confirmação, falha, menu e reposição ----------
{
  let bloquear = false;
  const { ctx, pg } = await abrir('celular', { antes: async (_pg, c2) => { await c2.route('**/*', (r) => (bloquear && r.request().method() === 'POST' && r.request().headers()['next-action'] ? r.abort() : r.continue())); } });
  await pg.waitForSelector(`${ATIVA} .vaga[data-ativo]`);
  let a = await ativo(pg);
  ok(a?.assunto.startsWith('Alfa') && a.vaga === '1' && (await pg.$eval(`${ATIVA} .ph-posicao`, (e) => e.textContent.trim())) === '1 de 3', `celular: pilha com um card ativo (vaga 1, ${a?.assunto}) e "1 de 3"`);
  ok((await pg.$$eval(`${ATIVA} .ph-arrasto .vaga`, (l) => l.length)) === 1 && (await pg.$$eval(`${ATIVA} .ph-atras`, (l) => l.map((e) => e.dataset.nivel).sort().join())) === '1,2', 'dois cards traseiros visíveis atrás do da frente, como um baralho (o primeiro com a face do próximo card)');
  ok((await pg.$eval(AVANCAR, (e) => e.textContent.trim())) === 'Avançar para Vistos', 'em Cadastro o botão equivalente diz "Avançar para Vistos"');
  const alvos = await pg.$$eval(`${ATIVA} .ph-botoes .btn, ${ABRIR}`, (l) => l.map((e) => e.getBoundingClientRect().height));
  ok(alvos.every((h) => h >= 32), `os botões equivalentes ao gesto existem e têm altura de botão (${alvos.map(Math.round).join(', ')} px)`);
  // Nova urgência no celular: a mesma pilha com a ordem só em memória
  {
    const nu = await pg.$eval('[data-nova-urgencia]', (e) => ({ pilhas: e.querySelectorAll('.ph-pilha').length, cards: e.querySelectorAll('.ph-pilha .ph-arrasto .vaga').length, pos: e.querySelector('.ph-posicao')?.textContent.trim() }));
    ok(nu.pilhas === 1 && nu.cards === 1 && nu.pos === '1 de 2', `a Nova urgência no celular também é um baralho (${nu.pos})`);
    const idNU = () => pg.$eval('[data-nova-urgencia] .ph-pilha .dcard', (e) => e.dataset.id);
    const centro = async () => { await pg.$eval('[data-nova-urgencia] .ph-arrasto', (e) => e.scrollIntoView({ block: 'center' })); await esperar(400); };
    await centro();
    const primeiro = await idNU(), c = await R(pg, '[data-nova-urgencia] .ph-arrasto'), y = c.y + c.h * 0.45;
    await deslizar(pg, c.x + c.w / 2 + 110, y, c.x + c.w / 2 - 110, y); await esperar(300);
    ok((await idNU()) !== primeiro && (await lsOrdem(pg)) === null, 'deslizar à esquerda na Nova urgência só navega (nada fica guardado no aparelho)');
    await centro(); const c2 = await R(pg, '[data-nova-urgencia] .ph-arrasto'), y2 = c2.y + c2.h * 0.45;
    await deslizar(pg, c2.x + c2.w / 2 - 110, y2, c2.x + c2.w / 2 + 110, y2); await esperar(300);
    ok((await idNU()) === primeiro, 'deslizar à direita na Nova urgência volta ao anterior');
  }
  await pg.$eval('.main', (e) => { e.scrollTop = 0; }); await esperar(300);
  // --- deslizar à esquerda: só a ordem visual do aparelho muda, até a virada do dia
  await deslizarAtivo(pg, -220);
  ok(await aguardarAtivo(pg, 'Charlie'), 'deslizar à esquerda manda o card para o fim e revela o próximo');
  let o = await lsOrdem(pg);
  ok(o && o.dia === HOJE && o.ids.join() === [ID.C, ID.E, ID.A].join(), 'a ordem fica guardada só neste aparelho, com a data de hoje em Brasília');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector(`${ATIVA} .vaga[data-ativo]`); await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  ok(await aguardarAtivo(pg, 'Charlie'), 'depois de recarregar a pilha mantém a ordem guardada');
  // --- deslizes que não valem: curto, vertical (rolagem), sobre a tarefa
  await deslizarAtivo(pg, -30);
  ok((await ativo(pg)).assunto.startsWith('Charlie') && (await lsOrdem(pg)).ids[0] === ID.C, 'um deslize curto volta ao lugar sem mudar nada');
  const c1 = await caixaAtiva(pg);
  await deslizar(pg, c1.x + c1.w / 2, c1.y + c1.h * 0.8, c1.x + c1.w / 2 + 10, c1.y + c1.h * 0.8 - 200);
  ok((await ativo(pg)).assunto.startsWith('Charlie') && (await lsOrdem(pg)).ids[0] === ID.C && (await pg.$eval(`${ATIVA} .ph-arrasto`, (e) => getComputedStyle(e).touchAction)) === 'pan-y', 'um arrasto vertical não passa nem avança o card, e a rolagem vertical continua livre sobre ele (touch-action: pan-y)');
  await pg.$eval('.main', (e) => { e.scrollTop = 0; }); await esperar(300);
  const tarefaTxt = await R(pg, `${ATIVA} .vaga[data-ativo] .prox-t .t-txt`);
  await deslizar(pg, tarefaTxt.x + 10, tarefaTxt.y + tarefaTxt.h / 2, tarefaTxt.x - 10, tarefaTxt.y + tarefaTxt.h / 2, 3);
  ok(!(await pg.$('.t-ed')) && !(await pg.$('.modal-ov')) && (await ativo(pg)).assunto.startsWith('Charlie'), 'um toque curto de lado sobre a tarefa não a abre, não abre a demanda e não passa o card');
  // --- o card acompanha o dedo, com inclinação; soltar um gesto curto e lento devolve suavemente; o cancelamento devolve
  {
    const cdp = await pg.context().newCDPSession(pg);
    const c = await caixaAtiva(pg), x0 = c.x + c.w / 2, y0 = c.y + c.h * 0.45;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - i * 12, y: y0 }] }); await esperar(30); }
    await esperar(220);
    const durante = await pg.$eval(`${ATIVA} .ph-arrasto`, (e) => { const m = new DOMMatrix(getComputedStyle(e).transform); return { tx: Math.round(m.e), rot: Math.round((Math.atan2(m.b, m.a) * 1800) / Math.PI) / 10, arrastando: e.dataset.arrastando }; });
    ok(durante.arrastando === 'sim' && durante.tx <= -54 && durante.tx >= -66 && durante.rot <= -1.2 && durante.rot >= -14, `o card da frente acompanha o dedo (${durante.tx} px) com leve inclinação (${durante.rot} graus)`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); await esperar(700);
    const volta = await pg.$eval(`${ATIVA} .ph-arrasto`, (e) => ({ tx: new DOMMatrix(getComputedStyle(e).transform).e, trans: getComputedStyle(e).transitionDuration }));
    ok(Math.abs(volta.tx) < 1 && /0\.2/.test(volta.trans) && (await ativo(pg)).assunto.startsWith('Charlie'), 'soltar um gesto curto e lento devolve o card suavemente ao lugar, sem mudar a ordem');
    const cdp2 = await pg.context().newCDPSession(pg);
    await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 8; i++) await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * 20, y: y0 }] });
    await cdp2.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await cdp2.detach(); await esperar(600);
    ok((await ativo(pg)).assunto.startsWith('Charlie') && (await lsOrdem(pg)).ids[0] === ID.C, 'o cancelamento do gesto pelo navegador devolve o card e não muda nada');
  }
  // --- virar por toque em área livre; botões, links e tarefas fazem só a própria ação
  {
    const fix = () => pg.$eval(`${ATIVA} .dcard`, (e) => e.dataset.fix);
    const cab = await R(pg, `${ATIVA} .face.front .cab`);
    await pg.touchscreen.tap(cab.x + 12, cab.y + cab.h / 2); await esperar(750); // a virada do card leva 550 ms: medir o verso antes do fim dela acertava o toque fora do lugar (falha intermitente)
    ok((await fix()) === 'verso', 'tocar numa área livre do card vira para o verso');
    const num = await R(pg, `${ATIVA} .face.back .cab .num`);   // área livre do verso (o número do documento é texto, não controle)
    await pg.touchscreen.tap(num.x + 6, num.y + num.h / 2); await esperar(750);
    ok((await fix()) === 'frente', 'novo toque numa área livre volta à frente');
    const ass = await R(pg, `${ATIVA} .vaga[data-ativo] .assunto`);
    await pg.touchscreen.tap(ass.x + 20, ass.y + ass.h / 2);
    const abriu = await pg.waitForSelector('.modal-ov .modal', { timeout: 4000 }).then(() => true, () => false);
    await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 5000 }).catch(() => {}); await esperar(400);
    ok(abriu && (await fix()) !== 'verso', 'tocar no assunto (link) só abre a demanda: o card não vira');
    const tt = await R(pg, `${ATIVA} .vaga[data-ativo] .prox-t .t-txt`);
    await pg.touchscreen.tap(tt.x + 20, tt.y + tt.h / 2); await esperar(400);
    ok(!!(await pg.$('.t-ed')) && (await fix()) !== 'verso', 'tocar na tarefa só abre a edição dela: o card não vira');
    await pg.keyboard.press('Escape'); await esperar(300);
    await pg.click(ABRIR);
    ok(await pg.waitForSelector('.modal-ov .modal', { timeout: 4000 }).then(() => true, () => false), 'há sempre o botão "Abrir a demanda" ao lado do card');
    await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 5000 }).catch(() => {}); await esperar(400);
  }
  // --- gesto rápido e curto vale, com saída animada e reinserção atrás da pilha
  {
    const c = await caixaAtiva(pg), x0 = c.x + c.w / 2, y0 = c.y + c.h * 0.45;
    const viuSaida = pg.waitForSelector('[data-pilha][data-saindo="esq"]', { state: 'attached', timeout: 1500 }).then(() => true, () => false);
    const viuVolta = pg.waitForSelector('.ph-atras[data-volta]', { state: 'attached', timeout: 1500 }).then(() => true, () => false);
    await deslizar(pg, x0 + 25, y0, x0 - 25, y0, 2);
    ok(await aguardarAtivo(pg, 'Eco'), 'um gesto rápido, mesmo curto (50 px), manda o card ao fim e o próximo assume a frente');
    ok((await viuSaida) && (await viuVolta), 'o card sai pela esquerda e reaparece atrás da pilha');
  }
  // --- deslizar à direita em Cadastro grava Vistos; a pilha só avança depois da gravação confirmada
  ok(await trazer(pg, 'Alfa'), 'os botões equivalentes passam pela fila até Alfa');
  await deslizarAtivo(pg, 220);
  ok(await aguardarAtivo(pg, 'Charlie') || await aguardarAtivo(pg, 'Eco'), 'deslizar à direita em Cadastro grava Vistos e a pilha avança');
  o = await lsOrdem(pg);
  ok(o.ids[o.ids.length - 1] === ID.A, 'o card avançado vai para o fim da ordem (a vaga dele não muda)');
  // --- falha de gravação: o card fica ativo, na mesma etapa, e a ordem não muda
  await trazer(pg, 'Alfa');
  ok((await ativo(pg)).etapa === 'Vistos', 'Alfa aparece em Vistos depois da gravação');
  const antesOrdem = JSON.stringify((await lsOrdem(pg)).ids);
  bloquear = true;
  await deslizarAtivo(pg, 220); await esperar(1500);
  const aposFalha = await ativo(pg);
  ok(aposFalha.assunto.startsWith('Alfa') && aposFalha.etapa === 'Vistos' && JSON.stringify((await lsOrdem(pg)).ids) === antesOrdem, 'se a gravação falha o card continua ativo, na mesma etapa, e a ordem não muda');
  bloquear = false; await esperar(500);
  // --- clique duplo em Avançar: uma única gravação
  {
    const gravacoes = [];
    const ouvir = (r) => { if (r.method() === 'POST' && r.headers()['next-action'] && /Fazendo/.test(r.postData() ?? '')) gravacoes.push(1); };
    pg.on('request', ouvir);
    await pg.dblclick(AVANCAR); await esperar(1800);
    pg.off('request', ouvir);
    ok(gravacoes.length === 1, `clique duplo em Avançar grava uma única vez (${gravacoes.length})`);
  }
  // --- Fazendo com tarefas pendentes: confirmação; cancelar mantém; confirmar finaliza, e só a vaga liberada é reposta
  await trazer(pg, 'Charlie');
  await deslizarAtivo(pg, 220);
  const conf = await pg.waitForSelector('[data-confirma-finalizar]', { timeout: 5000 }).then((e) => e.textContent(), () => null);
  ok(!!conf && /2 tarefas pendentes serão marcadas como concluídas/.test(conf), 'finalizar com tarefas pendentes pede confirmação e diz quantas serão concluídas');
  await pg.click('[data-confirma-finalizar] button:has-text("Cancelar")'); await esperar(400);
  ok(!(await pg.$('[data-confirma-finalizar]')) && (await ativo(pg)).assunto.startsWith('Charlie') && (await ativo(pg)).etapa === 'Fazendo', 'cancelar a confirmação mantém o card ativo e a etapa');
  await pg.click(AVANCAR); await pg.waitForSelector('[data-confirma-finalizar]', { timeout: 4000 });
  await pg.click('[data-confirma-finalizar] button.pri');
  await pg.waitForFunction(() => ![...document.querySelectorAll('[data-painel="para-hoje"] > .ph-pilha .assunto')].some((e) => e.textContent.startsWith('Charlie')), null, { timeout: 10000 }).catch(() => {});
  ok(await pg.waitForFunction(() => [...document.querySelectorAll('[data-painel="para-hoje"] .ph-posicao')][0]?.textContent.trim() === '1 de 3', null, { timeout: 10000 }).then(() => true, () => false), 'confirmada a gravação, Charlie sai e a vaga liberada é reposta (a pilha volta a 3)');
  ok(await trazer(pg, 'Delta'), 'a vaga liberada foi para Delta, a urgência mais antiga');
  await pg.click(AVANCAR); await esperar(400);
  ok(!(await pg.$('[data-confirma-finalizar]')), 'sem tarefas pendentes a finalização é direta, sem confirmação');
  await pg.waitForFunction(() => ![...document.querySelectorAll('[data-painel="para-hoje"] > .ph-pilha .assunto')].some((e) => e.textContent.startsWith('Delta')), null, { timeout: 10000 }).catch(() => {});
  // --- etapas de espera: o gesto abre o menu; a pilha só avança com a etapa gravada
  ok(await trazer(pg, 'Eco'), 'Eco continua na pilha');
  ok((await pg.$eval(AVANCAR, (e) => e.textContent.trim())) === 'Escolher a etapa', 'em Aguardando Prefeita o botão diz "Escolher a etapa"');
  await deslizarAtivo(pg, 220);
  ok(await pg.waitForSelector('.mv-menu', { timeout: 5000 }).then(() => true, () => false) && (await ativo(pg)).assunto.startsWith('Eco'), 'o gesto à direita numa etapa de espera abre o menu e não passa o card');
  await pg.click('.mv-menu button:has-text("Fazendo")');
  ok(await pg.waitForFunction(() => !document.querySelector('[data-painel="para-hoje"] > .ph-pilha .vaga[data-ativo] .assunto')?.textContent.startsWith('Eco'), null, { timeout: 10000 }).then(() => true, () => false), 'escolhida a etapa e confirmada a gravação, a pilha avança');
  ok(await trazer(pg, 'Foxtrot') && (await pg.$eval(AVANCAR, (e) => e.textContent.trim())) === 'Escolher a etapa', 'Foxtrot (Aguardando retorno) entrou na vaga de Delta e também oferece a escolha de etapa');
  await pg.click(AVANCAR);
  ok(await pg.waitForSelector('.mv-menu', { timeout: 4000 }).then(() => true, () => false), 'o botão equivalente abre o mesmo menu');
  await pg.keyboard.press('Escape'); await esperar(300);
  // --- virada do dia e armazenamento corrompido
  await pg.evaluate((d) => localStorage.setItem('dmanda:para-hoje-ordem', JSON.stringify({ dia: d, ids: [] })), somarDias(HOJE, -1));
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector(`${ATIVA} .vaga[data-ativo]`); await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  ok((await ativo(pg)).vaga === '1', 'a ordem guardada de ontem é ignorada: a pilha volta à ordem das vagas');
  await pg.evaluate(() => localStorage.setItem('dmanda:para-hoje-ordem', '{quebrado'));
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector(`${ATIVA} .vaga[data-ativo]`);
  ok(!!(await ativo(pg)), 'armazenamento corrompido da ordem não quebra a pilha');
  // --- as listas dos filtros do Início: o mesmo baralho, só navegando
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  await pg.click('.stat.st-atrasadas'); await esperar(500);
  const filtro = await pg.$eval('.cartas', (e) => ({ modo: e.dataset.modo, pilha: !!e.querySelector('.ph-pilha'), pos: e.querySelector('.ph-posicao')?.textContent.trim() })).catch(() => null);
  ok(filtro?.modo === 'pilha' && filtro.pilha && /^1 de \d+$/.test(filtro.pos ?? ''), `o filtro Atrasadas no celular vira o mesmo baralho (${filtro?.pos})`);
  await pg.screenshot({ path: `${CAPTURAS}/celular-pilha.png` });
  await ctx.close();
}
// ---------- 3) um card só e movimento reduzido ----------
{
  const { ctx, pg } = await abrir('celular', { extra: { reducedMotion: 'reduce' } });
  const dur = await pg.$eval(`${ATIVA} .ph-arrasto`, (e) => parseFloat(getComputedStyle(e).transitionDuration));
  ok(dur <= 0.011, `com movimento reduzido a pilha não anima (duração ${dur}s)`);
  const antes = (await ativo(pg)).assunto, c = await caixaAtiva(pg), y = c.y + c.h * 0.45;
  const animou = pg.waitForSelector('[data-pilha][data-saindo]', { state: 'attached', timeout: 900 }).then(() => true, () => false);
  await deslizar(pg, c.x + c.w / 2 + 110, y, c.x + c.w / 2 - 110, y);
  ok((await ativo(pg)).assunto !== antes && !(await animou), 'com movimento reduzido o gesto troca o card na hora, sem saída animada');
  const um = await pg.$eval('[data-nova-urgencia]', (e) => ({ pos: e.querySelector('.ph-posicao')?.textContent.trim(), passar: e.querySelector('[data-pilha-passar]')?.getAttribute('aria-disabled') === 'true' })).catch(() => null);
  ok(um === null || (um.pos === '1 de 1' && um.passar === true), `com um card só, a pilha mostra "1 de 1" e não oferece passar (${JSON.stringify(um)})`);
  await ctx.close();
}
parar();
// ---------- leitura direta do banco: etapas e vagas ----------
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const dem = await c('listar_demandas', { p_arquivadas: false }), por = (id) => dem.find((d) => d.id === id);
  ok(por(ID.A)?.etapa === 'Fazendo', 'banco: Alfa foi a Vistos pelo gesto e a Fazendo pelo clique duplo, uma única vez');
  ok(por(ID.C)?.etapa === 'Finalizado' && por(ID.C).tarefas.every((t) => t.concluida), 'banco: Charlie finalizado com as tarefas pendentes concluídas');
  ok(por(ID.D)?.etapa === 'Finalizado' && por(ID.E)?.etapa === 'Fazendo' && por(ID.F)?.etapa === 'Aguardando retorno' && por(ID.B)?.etapa === 'Vistos', 'banco: Delta finalizado direto, Eco em Fazendo pelo menu; Foxtrot e Bravo intactos');
  const vagas = await c('listar_para_hoje', {}), nome = (id) => Object.entries(ID).find(([, v]) => v === id)?.[0];
  const mapa = Object.fromEntries(vagas.filter((v) => por(v.demanda_id)?.etapa !== 'Finalizado').map((v) => [v.posicao, nome(v.demanda_id)]));
  ok(mapa[1] === 'A' && mapa[2] === 'F' && mapa[3] === 'E' && Object.keys(mapa).length === 3, `banco: três vagas; só a vaga 2 foi reposta (Charlie, depois Delta, depois Foxtrot), a 1 e a 3 ficaram (${JSON.stringify(mapa)})`);
  // dados da regressão da rolagem (decisão 75), semeados com o servidor parado: três vagas novas (Golf, Hotel e India, as três atrasadas, para o filtro Atrasadas); Alfa e Foxtrot ficam
  // fora das vagas e viram a Nova urgência. India tem uma tarefa pendente (finalizar pede confirmação).
  await db.query('delete from public.para_hoje where user_id = $1', [USUARIO]);
  const nova = async (assunto, o, textos = []) => { const d = await c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: '', ...o } }); for (const t of textos) await c('adicionar_tarefa', { p_demanda: d.id, p_texto: t }); return d.id; };
  const vagasNovas = [await nova('Golf atrasada em Cadastro', { prazo_original: somarDias(HOJE, -4) }), await nova('Hotel atrasada em Vistos', { etapa: 'Vistos', prazo_original: somarDias(HOJE, -3) }), await nova('India em Fazendo com pendência', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -1) }, ['i1'])];
  for (const [i, id] of vagasNovas.entries()) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, id]);
  await db.close();
}

// ---------- 4) a página não salta quando o card da frente é trocado (decisão 75) ----------
// Causa comprovada em 14/11/2026: o card da frente é remontado a cada troca e era o único filho com altura do palco. No WebKit, a página ficava a altura de um card mais curta por um layout
// e a rolagem era cortada no novo limite (a tela "saltava para o topo"). Sem instrumentação, só o WebKit salta (o Chromium não refaz o layout nesse instante). Aqui o teste lê a altura do
// palco no instante exato em que o card sai, o que obriga os dois motores a calcular o layout ali: por isso a medição do palco e a da rolagem valem nos dois, e as duas falhavam antes da correção (a da rolagem, quando a página estava no fim). O WebKit do Playwright é o motor do Safari no Windows com ponteiro sintético: NÃO é o Safari do iPhone, que continua dependendo do gesto no aparelho.
await subir();
const wk = await webkit.launch().catch((e) => { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); return null; });
const instrumentar = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.main'), R = { m, log: [], pilha: null, minPalco: Infinity, trocas: 0 };
  const reg = (fase) => { if (R.pilha?.isConnected) R.log.push({ fase, st: m.scrollTop, topo: R.pilha.getBoundingClientRect().top }); };
  const remover = Node.prototype.removeChild;
  // o instante da substituição: o card da frente acabou de sair do palco e o seguinte ainda não entrou
  Node.prototype.removeChild = function (filho) {
    const palco = filho instanceof Element && filho.matches('.ph-arrasto') && this instanceof Element && this.matches('.ph-palco') ? this : null;
    const r = remover.call(this, filho);
    if (palco && R.pilha?.contains(palco)) { R.trocas++; R.minPalco = Math.min(R.minPalco, palco.getBoundingClientRect().height); reg('troca'); }
    return r;
  };
  m.addEventListener('scroll', () => reg('rolagem'), { passive: true });
  const quadro = () => { reg('quadro'); requestAnimationFrame(quadro); }; requestAnimationFrame(quadro);
  window.__rol = R;
});
/** Rola a página (a pilha a 150 px do topo, ou o fim da página), executa a ação e devolve a rolagem e a posição visual da pilha lidas a cada quadro, a cada rolagem e no instante da troca. */
const medirTroca = async (pg, sel, acao, { fim = false, espera = 900 } = {}) => {
  const ini = await pg.evaluate(({ sel, fim }) => {
    const R = window.__rol, m = R.m, p = document.querySelector(sel);
    m.scrollTo({ top: Math.max(1, fim ? m.scrollHeight : m.scrollTop + p.getBoundingClientRect().top - 150), behavior: 'instant' });
    R.pilha = p; R.log = []; R.minPalco = Infinity; R.trocas = 0;
    return { st: m.scrollTop, topo: p.getBoundingClientRect().top, card: p.querySelector('.dcard').getBoundingClientRect().height, ativo: p.querySelector('.ph-arrasto').dataset.ativoId };
  }, { sel, fim });
  await esperar(150);
  await acao();
  await esperar(espera);
  const f = await pg.evaluate((sel) => {
    const R = window.__rol, p = document.querySelector(sel), sts = R.log.map((x) => x.st), tps = R.log.map((x) => x.topo);
    return { trocas: R.trocas, minPalco: R.minPalco, stMin: Math.min(...sts), stMax: Math.max(...sts), topoMin: Math.min(...tps), topoMax: Math.max(...tps), naTroca: R.log.filter((x) => x.fase === 'troca').map((x) => Math.round(x.st)), st: R.m.scrollTop, topo: p?.getBoundingClientRect().top ?? NaN, ativo: p?.querySelector('.ph-arrasto')?.dataset.ativoId, n: R.log.length };
  }, sel);
  return { ini, fim: f };
};
const firme = (rot, { ini, fim }, { troca = true } = {}) => {
  const dSt = Math.max(Math.abs(fim.stMin - ini.st), Math.abs(fim.stMax - ini.st), Math.abs(fim.st - ini.st)), dTopo = Math.max(Math.abs(fim.topoMin - ini.topo), Math.abs(fim.topoMax - ini.topo), Math.abs(fim.topo - ini.topo));
  const trocou = troca ? fim.trocas >= 1 && fim.ativo !== ini.ativo : fim.trocas === 0 && fim.ativo === ini.ativo;
  ok(ini.st > 0 && trocou && dSt <= 1, `${rot}: a rolagem fica em ${Math.round(ini.st)} px durante a troca e depois (variação ${dSt.toFixed(1)} px em ${fim.n} leituras${troca ? `; no instante da troca: ${fim.naTroca.join(', ')}` : '; o card não troca'})`);
  ok(dTopo <= 1 && (!troca || fim.minPalco >= ini.card - 0.5), `${rot}: a pilha não sai do lugar (variação ${dTopo.toFixed(1)} px)${troca ? ` e o palco nunca fica menor que o card (${Math.round(fim.minPalco)} de ${Math.round(ini.card)} px)` : ''}`);
};
const NU = '[data-nova-urgencia] .ph-pilha', FILTRO = '.cartas .ph-pilha';
for (const [motor, navegador, extra, toqueReal] of [['Edge', nav, {}, true], ...(wk ? [['WebKit emulado', wk, { ...devices['iPhone 13'] }, false]] : [])]) {
  const { ctx, pg } = await abrir('celular', { extra, motor: navegador });
  await instrumentar(pg);
  // Edge: toque pelo protocolo do navegador; WebKit: eventos de ponteiro sintéticos (o WebKit do Playwright não tem o protocolo de toque)
  const gesto = async (sel, dx) => {
    const c = await R(pg, `${sel} .ph-arrasto`), x = c.x + c.w / 2, y = c.y + c.h * 0.45;
    if (toqueReal) { await deslizar(pg, x - dx / 2, y, x + dx / 2, y); return; }
    await pg.evaluate(async ({ sel, x, y, dx }) => {
      const el = document.querySelector(`${sel} .ph-arrasto`); el.setPointerCapture = () => {};
      const ev = (tipo, px) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: px, clientY: y }));
      ev('pointerdown', x - dx / 2);
      for (let i = 1; i <= 10; i++) { ev('pointermove', x - dx / 2 + (dx * i) / 10); await new Promise((r) => setTimeout(r, 16)); }
      ev('pointerup', x + dx / 2);
    }, { sel, x, y, dx });
    await esperar(450);
  };
  // a etapa muda com a resposta do servidor chegando depois: a pilha só troca quando a gravação é confirmada
  const atraso = async (rota) => { if (rota.request().method() === 'POST' && rota.request().headers()['next-action']) await esperar(700); await rota.continue(); };
  await pg.route('**/*', atraso);
  firme(`${motor}, Para hoje, deslizar à direita (etapa gravada com a resposta atrasada)`, await medirTroca(pg, ATIVA, () => gesto(ATIVA, 220), { espera: 3200 }));
  await pg.unroute('**/*', atraso);
  firme(`${motor}, Para hoje, deslizar à esquerda`, await medirTroca(pg, ATIVA, () => gesto(ATIVA, -220)));
  firme(`${motor}, Para hoje, gesto curto`, await medirTroca(pg, ATIVA, () => gesto(ATIVA, 40)), { troca: false });
  await trazer(pg, 'India');
  firme(`${motor}, Para hoje, finalizar com pendência e Cancelar`, await medirTroca(pg, ATIVA, async () => {
    await gesto(ATIVA, 220);
    await pg.waitForSelector('[data-confirma-finalizar]', { timeout: 5000 }).catch(() => {});
    await esperar(300);
    await pg.evaluate(() => document.querySelector('[data-confirma-finalizar] .btn:not(.pri)')?.click()); // sem a rolagem automática do clique do Playwright
  }), { troca: false });
  const nNU = await pg.$eval(NU, (e) => Number(e.dataset.total)).catch(() => 0);
  ok(nNU >= 2, `${motor}: a Nova urgência tem mais de um card para a pilha navegar (${nNU})`);
  if (nNU >= 2) {
    firme(`${motor}, Nova urgência, deslizar à esquerda com a página no fim`, await medirTroca(pg, NU, () => gesto(NU, -220), { fim: true }));
    firme(`${motor}, Nova urgência, deslizar à direita com a página no fim`, await medirTroca(pg, NU, () => gesto(NU, 220), { fim: true }));
  }
  await pg.evaluate(() => document.querySelector('.stat.st-atrasadas')?.click()); await esperar(600);
  const nF = await pg.$eval(FILTRO, (e) => Number(e.dataset.total)).catch(() => 0);
  ok(nF >= 2, `${motor}: o filtro Atrasadas tem mais de um card na pilha (${nF})`);
  if (nF >= 2) {
    firme(`${motor}, lista filtrada, deslizar à esquerda`, await medirTroca(pg, FILTRO, () => gesto(FILTRO, -220)));
    firme(`${motor}, lista filtrada, deslizar à direita`, await medirTroca(pg, FILTRO, () => gesto(FILTRO, 220)));
  }
  await ctx.close();
}
await wk?.close();
parar();
await nav.close();
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
