// Perfil (humor, energia, produtividade e lembretes) no navegador (Edge) com o banco local de TESTE (PGlite): registro e correção dos últimos 5 dias, uma linha por dia, recarga,
// falha de gravação com a escolha preservada, clique repetido, convite para completar os dias, lembretes (entrada e 3 horas de trabalho, com relógio falso), duas abas, virada do dia,
// retorno no dia seguinte, gráfico semanal e mensal (mouse, toque e teclado), histórico, zero contra "Sem registro", isolamento (busca, cópia dos dados, nenhuma requisição externa).
// Computador, iPad e iPhone EMULADOS (não são aparelhos reais), claro e escuro, zoom do navegador a 125% e texto do aplicativo a 125%. Sobe o próprio servidor na porta 7113.
// O acesso sem sessão e com conta não autorizada é testado no testar-sessao (Auth falso); aqui o banco de teste não tem login. Nunca toca o Supabase real.
// Uso: node scripts/testar-perfil.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { diasPendentes, serieDoPeriodo } from '../src/lib/registros.ts';
import { somarDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_PERFIL || '7113', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/perfil', CAPTURAS = '.dados-teste/perfil-capturas';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });

// ---- semente fictícia, relativa ao dia de hoje do banco (a janela de correção usa o relógio do banco) ----
const USUARIO = '00000000-0000-4000-8000-000000000001';
let db = await abrirBancoTeste({ pasta: PASTA });
await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
const HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
if (Number((await db.query("select extract(epoch from date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day' - (now() at time zone 'America/Sao_Paulo'))::int as s")).rows[0].s) < 1800) throw new Error('Faltam menos de 30 minutos para a meia-noite em Brasília: o banco usa o relógio real e o dia viraria no meio do teste. Rode depois da virada.');
const dia = (n) => somarDias(HOJE, n);
const CONTAGEM = { [dia(-1)]: 1, [dia(-2)]: 1, [dia(-10)]: 3, [dia(-25)]: 2, [dia(-29)]: 1, [dia(-30)]: 4 };   // finalizadas por dia (hoje fica em zero de propósito); -2 está arquivada
let n = 0;
for (const [d, qtd] of Object.entries(CONTAGEM)) {
  for (let i = 0; i < qtd; i++) {
    const dm = await c('criar_demanda', { p: { assunto: `Finalizada fictícia ${++n}`, tipo: 'Processo', numero: `${n}/2026`, prazo_original: '2026-01-02' } });
    await c('concluir_demanda', { p_id: dm.id });
    await db.query('update public.demandas set concluida_em = $1 where id = $2', [d, dm.id]);
    if (d === dia(-2)) await c('arquivar_demanda', { p_id: dm.id });
  }
}
const aberta1 = await c('criar_demanda', { p: { assunto: 'Demanda aberta para concluir', tipo: 'Ofício', numero: '10/2026', prazo_original: dia(7) } });
await c('criar_demanda', { p: { assunto: 'Outra demanda aberta', tipo: 'Memorando', numero: '11/2026', prazo_original: dia(20) } });
// registros antigos (fora da janela de correção): um com zero finalizadas (-8), os outros em dias variados; -10 fica SEM registro e com 3 finalizadas
const REG_ANTIGOS = { [dia(-8)]: [3, 3], [dia(-12)]: [5, 1], [dia(-15)]: [1, 2], [dia(-20)]: [4, 4], [dia(-27)]: [2, 5] };
for (const [d, [h, e]] of Object.entries(REG_ANTIGOS)) await db.query('insert into public.registros_dia (user_id, dia, humor, energia) values ($1, $2, $3, $4)', [USUARIO, d, h, e]);
// um feriado cadastrado no dia de trabalho mais antigo da janela: ele sai do convite
const sem = diasPendentes(HOJE, [], []);
const FERIADO = sem[0];
await c('salvar_dia_indisponivel', { p: { data: FERIADO, descricao: 'Feriado fictício de teste', categoria: 'Feriado' } });
const PENDENTES = diasPendentes(HOJE, [], [{ id: 'f', data: FERIADO, descricao: 'x', categoria: 'Feriado' }]);
if (PENDENTES.length < 2) throw new Error('A semente precisa de pelo menos 2 dias de trabalho pendentes na janela (ajuste a data de referência).');
await db.close();

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (cond, m) => { total++; console.log((cond ? 'ok     ' : 'FALHOU ') + m); if (!cond) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [], externas = [], acoes = [];
const HORA8 = new Date(`${HOJE}T08:00:00-03:00`);
const novo = async (opcoes = {}, { tema = 'claro', instante = HORA8, texto125 = false } = {}) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.addInitScript(([t, tx]) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); if (tx && !localStorage.getItem('dmanda:aparencia')) localStorage.setItem('dmanda:aparencia', JSON.stringify({ textoPct: 125 })); } catch { /* sem armazenamento */ } }, [tema, texto125]);
  await ctx.clock.install({ time: instante });
  const observar = (pg) => {
    pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
    pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
    pg.on('request', (r) => { const u = new URL(r.url()); if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && u.protocol.startsWith('http')) externas.push(u.hostname); if (r.method() === 'POST' && r.headers()['next-action']) acoes.push(r.postData() ?? ''); });
  };
  const pg = await ctx.newPage(); observar(pg);
  return { ctx, pg, observar };
};
const hidratada = (pg) => pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
const abrir = async (pg, rota = '/') => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 }); await hidratada(pg);
  if (rota === '/') await pg.waitForFunction(() => document.querySelector('[data-quadro="humor-energia"] .ini-reg-v, [data-quadro="humor-energia"] .erro-carga'), null, { timeout: 60000 });
  await pg.waitForTimeout(900);
};
const posts = () => acoes.length;
const gravacoes = () => acoes.filter((x) => /"dia":"\d{4}-\d{2}-\d{2}"/.test(x)).length;
// espera um aviso NOVO (com o texto pedido, se houver): o aviso anterior pode ainda estar na tela
const toast = async (pg, re) => { await pg.waitForFunction((r) => { const t = document.querySelector('#toast'); return !!t && t.classList.contains('on') && (!r || new RegExp(r).test(t.textContent ?? '')); }, re ? re.source : null, { timeout: 10000 }); return pg.textContent('#toast'); };
const nivel = (pg, escopo, tipo, n_) => pg.click(`${escopo} [data-escala="${tipo}"] .emo[data-nivel="${n_}"]`);
const marcado = (pg, escopo, tipo) => pg.$$eval(`${escopo} [data-escala="${tipo}"] .emo`, (l) => l.findIndex((b) => b.getAttribute('aria-pressed') === 'true') + 1);
const avancar = async (pg, minutos) => { for (let m = 0; m < minutos; m += 10) { await pg.clock.runFor(Math.min(10, minutos - m) * 60000); await pg.mouse.move(120 + (m % 7) * 13, 130 + (m % 5) * 7); } await pg.waitForTimeout(500); };
const derrubarRede = (pg) => pg.route('**/*', (rota) => (rota.request().method() === 'POST' && rota.request().headers()['next-action'] ? rota.abort() : rota.continue()));
const abrirPerfil = async (pg, toque = false) => {
  if (toque) await pg.tap('.perfil-b'); else await pg.click('.perfil-b');
  const it = pg.locator('[data-item="perfil"]'); await it.waitFor();
  if (toque) await it.tap(); else await it.click();
  await pg.waitForSelector('[data-perfil] .grafico');
  await pg.waitForTimeout(1300);   // a animação da gaveta (com o relógio falso, as capturas saíam no começo dela)
};
const fecharPerfil = async (pg) => { await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.dr-ov'), null, { timeout: 8000 }); };
const lum = (css) => { const x = css.match(/[\d.]+/g).map(Number); return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]; };
const rotuloH = { 1: 'Muito mal', 2: 'Mal', 3: 'Neutro', 4: 'Bem', 5: 'Muito bem' }, rotuloE = { 1: 'Muito baixa', 2: 'Baixa', 3: 'Média', 4: 'Alta', 5: 'Muito alta' };
const esperado = serieDoPeriodo(Object.entries(CONTAGEM).flatMap(([d, q]) => Array.from({ length: q }, (_, i) => ({ id: d + i, etapa: 'Finalizado', concluida_em: d }))), [], HOJE, 30);

// ================= 1) tamanhos, temas e aparelhos EMULADOS: convite, balão e Perfil cabem e são legíveis =================
const perfis = [
  ['computador escuro', { viewport: { width: 1360, height: 900 } }, { tema: 'escuro' }],
  ['computador com zoom de 125% (1088 px CSS, densidade 1,25)', { viewport: { width: 1088, height: 720 }, deviceScaleFactor: 1.25 }, { tema: 'claro' }],
  ['computador com texto do aplicativo a 125%', { viewport: { width: 1360, height: 900 } }, { tema: 'claro', texto125: true }],
  ['iPad emulado (820x1180, toque)', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, { tema: 'claro' }],
  ['iPhone emulado (390x844, toque)', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, { tema: 'escuro' }],
  ['iPhone emulado com texto a 125%', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, { tema: 'claro', texto125: true }],
];
let capN = 0;
for (const [nome, opcoes, extra] of perfis) {
  const { ctx, pg } = await novo(opcoes, extra);
  const toque = !!opcoes.hasTouch, v = opcoes.viewport;
  await abrir(pg, '/');
  await pg.waitForSelector('.modal-ov .modal', { timeout: 20000 });
  const jan = await pg.evaluate(() => { const m = document.querySelector('.modal'), r = m.getBoundingClientRect(); return { dentro: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, rolaX: document.documentElement.scrollWidth > innerWidth + 1, titulo: document.querySelector('#m-tit')?.textContent, dias: [...document.querySelectorAll('.dia-l')].map((d) => d.dataset.dia), minEmo: Math.min(...[...document.querySelectorAll('.modal .emo')].map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))), rolagemInterna: m.scrollHeight > m.clientHeight } });
  ok(jan.titulo === 'Completar os últimos dias' && jan.dias.join() === PENDENTES.join(), `${nome}: ao entrar, o convite lista só os dias de trabalho pendentes dos últimos 5 dias (${PENDENTES.length}), sem fim de semana nem o feriado cadastrado`);
  ok(jan.dentro && !jan.rolaX && jan.minEmo >= 44, `${nome}: a janela do convite cabe na tela, sem rolagem horizontal, e os botões de humor e energia têm 44 px ou mais (${Math.round(jan.minEmo)})`);
  await pg.screenshot({ path: `${CAPTURAS}/${++capN}-convite-${nome.replace(/[^a-z0-9]+/gi, '-')}.png` });
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 8000 });
  await pg.waitForSelector('.balao');
  const bal = await pg.evaluate(() => { const r = document.querySelector('.balao').getBoundingClientRect(); return { dentro: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, fundo: getComputedStyle(document.querySelector('.balao')).backgroundColor, texto: getComputedStyle(document.querySelector('.balao b')).color, emo: Math.min(...[...document.querySelectorAll('.balao .emo')].map((e) => e.getBoundingClientRect().width)) }; });
  ok(bal.dentro && bal.emo >= 44, `${nome}: o balão discreto cabe na tela e seus botões têm pelo menos 44 px (${Math.round(bal.emo)})`);
  ok(extra.tema === 'escuro' ? lum(bal.fundo) < 90 && lum(bal.texto) > 120 : lum(bal.fundo) > 150 && lum(bal.texto) < 120, `${nome}: tema ${extra.tema}, o balão tem fundo e letra de lados opostos`);
  await pg.screenshot({ path: `${CAPTURAS}/${++capN}-balao-${nome.replace(/[^a-z0-9]+/gi, '-')}.png` });
  await pg.click('.balao .icbtn-s');
  await abrirPerfil(pg, toque);
  const m = await pg.evaluate(() => {
    const d = document.querySelector('.dr'), r = d.getBoundingClientRect(), g = document.querySelector('.grafico').getBoundingClientRect(), hd = [...document.querySelectorAll('.hd')];
    return { dentro: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, rolaX: document.documentElement.scrollWidth > innerWidth + 1, fundo: getComputedStyle(d).backgroundColor, texto: getComputedStyle(document.querySelector('.pf-det')).color, grafW: g.width, hdAlt: Math.min(...hd.map((e) => e.getBoundingClientRect().height)), colunas: document.querySelectorAll('.grafico .gcol').length, colMin: Math.min(...[...document.querySelectorAll('.grafico .gcol')].map((e) => e.getBoundingClientRect().width)), colAlt: Math.min(...[...document.querySelectorAll('.grafico .gcol')].map((e) => e.getBoundingClientRect().height)), rolaDrawerX: d.scrollWidth > d.clientWidth + 1 };
  });
  ok(m.dentro && !m.rolaX && !m.rolaDrawerX, `${nome}: a gaveta do Perfil cabe na tela, sem rolagem horizontal`);
  ok(m.hdAlt >= 44 && m.colAlt >= 44 && m.colunas === 7, `${nome}: o histórico (${Math.round(m.hdAlt)} px) e as colunas do gráfico (${Math.round(m.colAlt)} px de altura, ${m.colunas} colunas, ${Math.round(m.colMin)} px de largura) têm alvos de toque de altura 44 px ou mais`);
  ok(extra.tema === 'escuro' ? lum(m.fundo) < 90 && lum(m.texto) > 120 : lum(m.fundo) > 150 && lum(m.texto) < 120, `${nome}: tema ${extra.tema}, a gaveta tem fundo e letra de lados opostos`);
  await pg.screenshot({ path: `${CAPTURAS}/${++capN}-perfil-${nome.replace(/[^a-z0-9]+/gi, '-')}.png` });
  // mês: o dedo (ou o mouse) arrastando escolhe o dia sob o ponto (as colunas do mês são finas)
  await pg.click('.tabs button:has-text("Mês")');
  await pg.locator('.grafico').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
  const cx = await pg.evaluate(() => { const g = document.querySelector('.grafico').getBoundingClientRect(); return { x: g.left, w: g.width, y: g.top + g.height / 2 }; });
  const alvoIdx = 4, px = cx.x + (cx.w / 30) * (alvoIdx + 0.5);
  if (toque) await pg.touchscreen.tap(px, cx.y); else { await pg.mouse.move(px, cx.y); await pg.mouse.down(); await pg.mouse.up(); }
  await pg.waitForTimeout(250);
  ok((await pg.getAttribute('.grafico .gcol[aria-pressed="true"]', 'data-dia')) === esperado[alvoIdx].dia, `${nome}: ${toque ? 'tocar' : 'clicar'} numa coluna fina do mês escolhe o dia sob o ponto (${esperado[alvoIdx].dia})`);
  await ctx.close();
}

// ================= 2) duas abas abrindo juntas: o convite aparece uma só vez =================
{
  const { ctx, pg, observar } = await novo({ viewport: { width: 1360, height: 900 } });
  const pg2 = await ctx.newPage(); observar(pg2);
  await Promise.all([pg.goto(BASE + '/'), pg2.goto(BASE + '/')]);
  await Promise.all([pg.waitForSelector('.app .main'), pg2.waitForSelector('.app .main')]);
  await Promise.all([hidratada(pg), hidratada(pg2)]);
  await pg.waitForTimeout(3500);
  const janelas = (await pg.$$('.modal-ov')).length + (await pg2.$$('.modal-ov')).length;
  ok(janelas === 1, `duas abas abrindo ao mesmo tempo: o convite para completar os dias aparece em uma só (${janelas})`);
  await ctx.close();
}

// ================= 3) computador claro: o fluxo completo do dia =================
const T = await novo({ viewport: { width: 1360, height: 900 } });
{
  const { ctx, pg, observar } = T;
  await abrir(pg, '/');
  await pg.waitForSelector('.modal-ov .modal', { timeout: 20000 });
  ok((await pg.$$('.balao')).length === 0, 'enquanto o convite está aberto, o balão espera');
  // preencher vários dias: o primeiro completo, o segundo só com humor
  const [d1, d2] = PENDENTES;
  await nivel(pg, `.dia-l[data-dia="${d1}"]`, 'humor', 4); await nivel(pg, `.dia-l[data-dia="${d1}"]`, 'energia', 5);
  await nivel(pg, `.dia-l[data-dia="${d2}"]`, 'humor', 2);
  ok(/Falta escolher a energia/.test((await pg.textContent(`.dia-l[data-dia="${d2}"]`)) ?? '') && !(await pg.isDisabled('.modal .btn.pri')), 'convite: dia com só o humor mostra o que falta e o botão salva só os dias completos');
  // falha de gravação: a escolha fica e o erro aparece
  await derrubarRede(pg);
  const antes = gravacoes();
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('.modal .reg-erro', { timeout: 15000 });
  ok(/Nada foi gravado|Sem conexão|Sem confirmação/.test((await pg.textContent('.modal .reg-erro')) ?? '') && (await marcado(pg, `.dia-l[data-dia="${d1}"]`, 'humor')) === 4 && (await marcado(pg, `.dia-l[data-dia="${d1}"]`, 'energia')) === 5 && (await marcado(pg, `.dia-l[data-dia="${d2}"]`, 'humor')) === 2, 'convite: falha ao gravar mostra o erro, não finge sucesso e mantém todas as escolhas');
  await pg.unroute('**/*');
  await pg.click('.modal .btn.pri'); await toast(pg);
  await pg.waitForFunction((d) => !document.querySelector(`.dia-l[data-dia="${d}"]`), d1, { timeout: 10000 });
  ok(gravacoes() >= antes + 1 && (await pg.$(`.dia-l[data-dia="${d2}"]`)) !== null && (await marcado(pg, `.dia-l[data-dia="${d2}"]`, 'humor')) === 2 && !!(await pg.$('.modal-ov')), 'convite: repetir depois da falha grava o dia completo (uma gravação a mais) e o dia incompleto continua na janela com a escolha');
  await pg.click('.modal .btn:has-text("Agora não")'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'));
  // balão da entrada: só grava com os dois escolhidos; grava juntos; atualiza o dia
  await pg.waitForSelector('.balao[data-lembrete="entrada"]');
  const g0 = gravacoes();
  await nivel(pg, '.balao', 'humor', 3); await pg.waitForTimeout(400);
  ok(gravacoes() === g0 && /Falta escolher a energia/.test((await pg.textContent('.balao .reg-dica')) ?? ''), 'balão: escolher só o humor não grava e diz o que falta');
  await nivel(pg, '.balao', 'energia', 4);
  ok(/Humor e energia registrados/.test(await toast(pg, /Humor e energia registrados/)), 'balão: com os dois escolhidos, grava e confirma só depois do banco');
  await pg.waitForFunction(() => !document.querySelector('.balao'));
  ok(gravacoes() === g0 + 1, 'balão: humor e energia vão juntos em uma única gravação');
  // recarregar: o registro volta do banco e o balão não repete
  await abrir(pg, '/');
  await pg.waitForTimeout(1500);
  let q = await pg.textContent('[data-quadro="humor-energia"] .ini-reg-v');
  ok(/Humor: Neutro/.test(q ?? '') && /Energia: Alta/.test(q ?? '') && (await pg.$$('.balao')).length === 0 && (await pg.$$('.modal-ov')).length === 0, 'recarregar: o registro de hoje volta do banco, o balão de entrada e o convite não se repetem');
  // atualizar o dia: um só registro, clique repetido não duplica
  await pg.click('.ini-reg .btn:has-text("Atualizar")');
  ok((await marcado(pg, '.ini-reg', 'humor')) === 3 && (await marcado(pg, '.ini-reg', 'energia')) === 4, 'Início: o formulário de atualização abre com o registro de hoje já escolhido');
  await nivel(pg, '.ini-reg', 'humor', 5);
  const g1 = gravacoes();
  await pg.dblclick('.ini-reg .reg-form .btn.pri'); await pg.waitForTimeout(1200);
  ok(gravacoes() === g1 + 1, `Início: clique duplo em "Atualizar registro" faz uma única gravação (${gravacoes() - g1})`);
  await abrir(pg, '/');
  q = await pg.textContent('[data-quadro="humor-energia"] .ini-reg-v');
  ok(/Humor: Muito bem/.test(q ?? '') && /Energia: Alta/.test(q ?? ''), 'recarregar: a nova gravação confirmada atualizou o dia (Muito bem e Alta)');

  // ---- Perfil pelo avatar: o dia, zero contra "Sem registro", gráfico e histórico ----
  await pg.focus('.perfil-b'); await pg.keyboard.press('Enter');
  ok(/Perfil/.test((await pg.evaluate(() => document.activeElement?.textContent ?? ''))), 'avatar: abrir o menu pelo teclado leva o foco ao item Perfil');
  await pg.keyboard.press('Enter'); await pg.waitForSelector('[data-perfil] .grafico'); await pg.waitForTimeout(600);
  ok(await pg.evaluate(() => document.activeElement === document.querySelector('[data-perfil]')), 'Perfil: ao abrir pelo teclado, o foco vai à gaveta');
  const ind = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-indicador]')].map((e) => [e.dataset.indicador, e.textContent.replace(/\s+/g, ' ')])));
  ok(/Muito bem/.test(ind.humor) && /Alta/.test(ind.energia) && /0 demandas finalizadas hoje/.test(ind.produtividade), 'Perfil: Humor, Energia e Produtividade de hoje juntos (humor Muito bem, energia Alta, zero finalizadas)');
  ok(/zero também acontece/.test((await pg.textContent('.frase')) ?? '') && /não substitui acompanhamento profissional/.test((await pg.textContent('[data-perfil]')) ?? ''), 'Perfil: frase neutra para o dia com zero e o aviso previsto (privado, não substitui acompanhamento profissional)');
  const semana = await pg.$$eval('.grafico .gcol', (l) => l.map((b) => [b.dataset.dia, Number(b.dataset.n)]));
  ok(semana.length === 7 && semana[6][0] === HOJE && semana.every(([d, q_]) => q_ === (CONTAGEM[d] ?? 0)), 'gráfico semanal: 7 colunas terminando em hoje, com as finalizadas de cada dia (inclui a arquivada)');
  await pg.click('.tabs button:has-text("Mês")');
  const mes = await pg.$$eval('.grafico .gcol', (l) => l.map((b) => [b.dataset.dia, Number(b.dataset.n)]));
  ok(mes.length === 30 && mes.every(([d, q_], i) => d === esperado[i].dia && q_ === esperado[i].concluidas) && mes[0][0] === dia(-29) && mes[0][1] === 1, 'gráfico mensal: 30 colunas (de 29 dias atrás até hoje) com as contagens certas; o dia 30 atrás (4 finalizadas) fica de fora');
  // zero contra ausência de registro
  const rotuloDia = async (d) => pg.getAttribute(`.grafico .gcol[data-dia="${d}"]`, 'aria-label');
  const zero = await rotuloDia(dia(-8)), semReg = await rotuloDia(dia(-10));
  ok(/nenhuma demanda finalizada, humor neutro, energia média/.test(zero ?? '') && /3 demandas finalizadas, sem registro de humor e energia/.test(semReg ?? ''), 'zero é um valor e falta de registro é outra coisa: dia com registro e 0 finalizadas, e dia com 3 finalizadas e "sem registro"');
  const celulas = await pg.evaluate(([a, b]) => ({ zero: document.querySelector(`td.hc2[data-dia="${a}"]`)?.className, falta: document.querySelector(`td.hc2[data-dia="${b}"]`)?.className, textoFalta: document.querySelector(`td.hc2[data-dia="${b}"]`)?.textContent, alt: document.querySelector(`td.hc2[data-dia="${a}"] img`)?.getAttribute('alt') }), [dia(-8), dia(-10)]);
  ok(!/vazio/.test(celulas.zero) && /vazio/.test(celulas.falta) && /—/.test(celulas.textoFalta) && /Humor: Neutro/.test(celulas.alt), 'histórico: dia registrado mostra o emoji; dia sem registro mostra o traço de "Sem registro"');
  ok((await pg.$$('.hist-t button.hd')).length === 28 && (await pg.$$eval('td.hc2 img[src*="energia-"]', (l) => l.every((i) => /\.svg$/.test(i.getAttribute('src'))))), 'histórico: 28 dias, com os SVGs de energia do usuário');
  // mouse: dica ao passar
  await pg.hover(`.grafico .gcol[data-dia="${dia(-10)}"]`);
  const dica = await pg.waitForFunction((d) => Number(getComputedStyle(document.querySelector(`.grafico .gcol[data-dia="${d}"] .tip`)).opacity) > 0.9, dia(-10), { timeout: 4000 }).then(() => true, () => false);
  ok(dica, 'gráfico: passar o mouse mostra a dica do dia');
  await pg.click('.tabs button:has-text("Semana")');
  // teclado: uma parada de Tab, setas, Home e End; o resumo por extenso acompanha
  await pg.focus('.grafico .gcol[tabindex="0"]');
  await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft');
  ok((await pg.getAttribute('.grafico .gcol[aria-pressed="true"]', 'data-dia')) === dia(-2) && /1 demanda finalizada/.test((await pg.textContent('#pf-det')) ?? ''), 'gráfico: setas movem a seleção e o resumo do dia (1 finalizada, a arquivada) aparece por extenso');
  await pg.keyboard.press('Home'); ok((await pg.getAttribute('.grafico .gcol[aria-pressed="true"]', 'data-dia')) === dia(-6), 'gráfico: Home vai ao primeiro dia');
  await pg.keyboard.press('End'); ok((await pg.getAttribute('.grafico .gcol[aria-pressed="true"]', 'data-dia')) === HOJE, 'gráfico: End vai a hoje');
  await pg.keyboard.press('Tab');
  ok(!(await pg.evaluate(() => document.activeElement?.classList.contains('gcol'))), 'gráfico: o Tab sai do gráfico (uma só parada para as colunas)');
  // correção dos últimos 5 dias
  await pg.click(`.hist-t button.hd[data-dia="${d1}"]`);
  ok(/Corrigir este dia/.test((await pg.textContent('[data-dia-sel]')) ?? '') && (await marcado(pg, '[data-dia-sel]', 'humor')) === 4 && (await marcado(pg, '[data-dia-sel]', 'energia')) === 5, 'correção: um dia dos últimos 5 abre com o registro e o título "Corrigir este dia"');
  await nivel(pg, '[data-dia-sel]', 'humor', 1); await nivel(pg, '[data-dia-sel]', 'energia', 2);
  await derrubarRede(pg);
  await pg.click('[data-dia-sel] .reg-form .btn.pri'); await pg.waitForSelector('[data-dia-sel] .reg-erro', { timeout: 15000 });
  ok((await marcado(pg, '[data-dia-sel]', 'humor')) === 1 && (await marcado(pg, '[data-dia-sel]', 'energia')) === 2 && !/Corrigido|Registrado\./.test((await pg.textContent('[data-dia-sel]')) ?? ''), 'correção: falha ao gravar mantém a seleção e não mostra sucesso');
  await pg.unroute('**/*');
  await pg.click('[data-dia-sel] .reg-form .btn.pri');
  await pg.waitForFunction((d) => /humor muito mal, energia baixa/.test(document.querySelector('#pf-det')?.textContent ?? ''), d1, { timeout: 10000 });
  ok(true, 'correção: depois da falha, repetir grava e o resumo do dia passa a dizer humor muito mal, energia baixa');
  await pg.click(`.hist-t button.hd[data-dia="${dia(-6)}"]`);
  ok((await pg.$('[data-dia-sel] .reg-form')) === null && /só é possível registrar ou corrigir hoje e os 5 dias anteriores/i.test((await pg.textContent('[data-dia-sel]')) ?? ''), 'correção: o sexto dia anterior não pode ser corrigido (sem formulário, com a explicação)');
  await pg.click(`.hist-t button.hd[data-dia="${dia(-8)}"]`);
  ok((await pg.$('[data-dia-sel] .reg-form')) === null, 'correção: dia mais antigo (com registro) só pode ser lido');
  // completar pelo Perfil: só o que falta, por cima da gaveta; preenche vários e deixa o último pendente (se houver mais de um) para a conferência do dia seguinte
  await pg.click('.btn:has-text("Completar últimos dias")'); await pg.waitForSelector('.modal-ov .modal');
  const faltam = await pg.$$eval('.modal .dia-l', (l) => l.map((e) => e.dataset.dia));
  ok(faltam.join() === PENDENTES.slice(1).join(), `completar pelo Perfil: só os dias que ainda faltam (${faltam.length}), e a janela fica por cima da gaveta`);
  const preencher = faltam.length > 1 ? faltam.slice(0, -1) : faltam;
  for (const d of preencher) { await nivel(pg, `.modal .dia-l[data-dia="${d}"]`, 'humor', 2); await nivel(pg, `.modal .dia-l[data-dia="${d}"]`, 'energia', 3); }
  await pg.click('.modal .btn.pri'); await toast(pg);
  const RESTANTES = faltam.length - preencher.length;
  if (RESTANTES === 0) await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 });
  else { await pg.waitForFunction((d) => !document.querySelector(`.modal .dia-l[data-dia="${d}"]`), preencher[0], { timeout: 10000 }); await pg.click('.modal .btn:has-text("Agora não")'); await pg.waitForFunction(() => !document.querySelector('.modal-ov')); }
  await pg.click(`.hist-t button.hd[data-dia="${d2}"]`);
  ok(/humor mal, energia média/.test((await pg.textContent('#pf-det')) ?? '') && (RESTANTES === 0 ? true : (await pg.$('.dia-l')) === null), `completar: os dias completos foram gravados (${preencher.length}) e ${RESTANTES ? 'o último segue pendente' : 'a janela fechou sozinha, sem dia pendente'}`);
  // foco, atalhos bloqueados com a gaveta aberta, Esc devolve o foco ao avatar
  await pg.keyboard.press('Control+k'); await pg.waitForTimeout(250);
  ok((await pg.$$('.busca-ov')).length === 0, 'Perfil aberto: Ctrl+K não abre a busca por baixo');
  await pg.evaluate(() => document.activeElement?.blur()); await pg.keyboard.press('n'); await pg.waitForTimeout(250);
  ok((await pg.$$('.modal-ov')).length === 0, 'Perfil aberto: o atalho N não abre Nova entrada por baixo');
  let preso = true;
  for (let i = 0; i < 60; i++) { await pg.keyboard.press('Tab'); if (!(await pg.evaluate(() => !!document.activeElement?.closest('[data-perfil]')))) { preso = false; break; } }
  ok(preso, 'Perfil aberto: o Tab percorre só a gaveta (o foco não escapa para a tela de baixo)');
  await fecharPerfil(pg);
  ok(await pg.evaluate(() => document.activeElement === document.querySelector('.perfil-b')), 'Esc fecha o Perfil e o foco volta ao avatar');
  ok(RESTANTES === 0 ? (await pg.$('.ini-reg .pend')) === null : /Há 1 dia de trabalho sem registro/.test((await pg.textContent('.ini-reg .pend')) ?? ''), RESTANTES === 0 ? 'Início: sem dia pendente, o atalho "Completar" some' : 'Início: o atalho "Completar" diz o que ainda falta (1 dia)');
  // Configurações > Perfil
  await abrir(pg, '/config');
  ok(!!(await pg.$('[data-secao="perfil"]')), 'Configurações: existe a seção Perfil');
  await pg.click('[data-secao="perfil"] .btn.pri'); await pg.waitForSelector('[data-perfil]');
  ok(true, 'Configurações > Perfil abre a mesma gaveta');
  await pg.click('[data-perfil] .btn:has-text("Abrir configurações")'); await pg.waitForFunction(() => !document.querySelector('.dr-ov'));
  ok(new URL(pg.url()).pathname === '/config', 'da gaveta, "Abrir configurações" leva a Configurações e fecha a gaveta');

  // ---- produtividade viva: concluir, reabrir e concluir de novo (a data de conclusão é a da última conclusão) ----
  await abrir(pg, '/demandas');
  const card = pg.locator('article.dcard').filter({ hasText: 'Demanda aberta para concluir' }).first();
  await card.locator('button:has-text("Concluir demanda")').click(); await toast(pg);
  await abrirPerfil(pg);
  ok(/1 demanda finalizada hoje/.test((await pg.textContent('[data-indicador="produtividade"]')) ?? '') && Number(await pg.getAttribute(`.grafico .gcol[data-dia="${HOJE}"]`, 'data-n')) === 1 && /Hoje: 1 demanda finalizada/.test((await pg.textContent('.frase')) ?? ''), 'produtividade: concluir uma demanda hoje mostra 1 finalizada hoje (independe do prazo), no indicador, no gráfico e na frase');
  await fecharPerfil(pg);
  await pg.locator('article.dcard').filter({ hasText: 'Demanda aberta para concluir' }).first().locator('button:has-text("Reabrir demanda")').click(); await toast(pg);
  await abrirPerfil(pg);
  ok(/0 demandas finalizadas hoje/.test((await pg.textContent('[data-indicador="produtividade"]')) ?? '') && Number(await pg.getAttribute(`.grafico .gcol[data-dia="${HOJE}"]`, 'data-n')) === 0, 'produtividade: reabrir tira a demanda do dia em que foi concluída (o histórico guarda só a última conclusão: lacuna registrada)');
  await fecharPerfil(pg);
  await pg.locator('article.dcard').filter({ hasText: 'Demanda aberta para concluir' }).first().locator('button:has-text("Concluir demanda")').click(); await toast(pg);
  await abrirPerfil(pg);
  ok(/1 demanda finalizada hoje/.test((await pg.textContent('[data-indicador="produtividade"]')) ?? ''), 'produtividade: concluir de novo volta a contar no dia');
  await fecharPerfil(pg);

  // ---- isolamento: busca, cópia dos dados e requisições externas ----
  await abrir(pg, '/');
  await pg.keyboard.press('Control+k'); await pg.waitForSelector('.busca-box input');
  const achados = [];
  for (const termo of ['neutro', 'humor', 'energia alta', 'muito bem', HOJE]) { await pg.fill('.busca-box input', termo); await pg.waitForTimeout(350); achados.push((await pg.$$('.busca-box .res')).length); }
  ok(achados.every((x) => x === 0), `busca global: humor e energia não são pesquisáveis (resultados: ${achados.join(', ')})`);
  await pg.keyboard.press('Escape');
  const copia = await pg.evaluate(async () => { const r = await fetch('/api/exportar', { cache: 'no-store' }); return { status: r.status, texto: await r.text() }; });
  ok(copia.status === 200 && !/"humor"|"energia"|registros_dia|"registros"/.test(copia.texto) && Object.keys(JSON.parse(copia.texto)).every((k) => !/humor|energia|registro/.test(k)), 'cópia dos dados: a exportação não inclui humor nem energia (decisão: ficam fora até haver destino privado)');
  const armazenado = await pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
  ok(!/"humor"|"energia"/.test(armazenado) && !/registros/.test(armazenado.replace(/dmanda:lembretes/g, '')), 'aparelho: o armazenamento local não guarda humor nem energia (só as contagens do relógio dos lembretes)');

  // ---- lembretes por horas de trabalho ----
  await abrir(pg, '/');
  await avancar(pg, 170);   // 2 h 50 min de uso
  ok((await pg.$$('.balao')).length === 0, 'lembretes: com 2 h 50 min de trabalho ainda não há lembrete');
  await avancar(pg, 20);    // 3 h 10 min
  await pg.waitForSelector('.balao[data-lembrete="horas"]', { timeout: 10000 });
  ok(true, 'lembretes: depois de 3 horas de trabalho o balão aparece de novo');
  // não respondido: recarregar não perde nem repete
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await hidratada(pg); await pg.waitForTimeout(1800);
  ok((await pg.$$('.balao[data-lembrete="horas"]')).length === 1, 'lembretes: o lembrete ainda sem resposta continua depois de recarregar (uma vez só, nem perdido nem repetido)');
  // duas abas: o lembrete é compartilhado e o tempo conta uma vez
  const pg2 = await ctx.newPage(); observar(pg2); await abrir(pg2, '/'); await pg2.waitForTimeout(1200);
  ok((await pg2.$$('.balao[data-lembrete="horas"]')).length === 1, 'duas abas: a segunda aba mostra o mesmo lembrete pendente (não um novo)');
  // falha de gravação no balão: a escolha fica e há "Tentar de novo"
  await derrubarRede(pg);
  await nivel(pg, '.balao', 'humor', 2); await nivel(pg, '.balao', 'energia', 2);
  await pg.waitForSelector('.balao .reg-erro', { timeout: 15000 });
  ok((await marcado(pg, '.balao', 'humor')) === 2 && (await marcado(pg, '.balao', 'energia')) === 2 && !!(await pg.$('.balao .btn:has-text("Tentar de novo")')) && (await pg.$$('.balao')).length === 1, 'balão: falha ao gravar mantém o balão, as duas escolhas e oferece "Tentar de novo"');
  await pg.unroute('**/*');
  await pg.click('.balao .btn:has-text("Tentar de novo")'); await toast(pg);
  await pg.waitForFunction(() => !document.querySelector('.balao'), null, { timeout: 10000 });
  await pg2.waitForFunction(() => !document.querySelector('.balao'), null, { timeout: 10000 });
  ok(true, 'balão: ao gravar em uma aba, o lembrete some nas duas');
  // com as duas abas em uso o tempo conta uma só vez: 2 h 50 depois não há lembrete (se contasse em dobro, haveria)
  // só a primeira aba é usada: o relógio falso avança cada aba em sequência, o que não existe no mundo real; o caso de duas abas em uso ao mesmo tempo está nas regras (testar:regras)
  for (let m = 0; m < 140; m += 10) { await ctx.clock.runFor(10 * 60000); await pg.mouse.move(150 + (m % 9) * 11, 160); }
  await pg.waitForTimeout(600);
  ok((await pg.$$('.balao')).length === 0 && (await pg2.$$('.balao')).length === 0, 'duas abas abertas, uma em uso: a aba parada não soma tempo (2 h 20 min depois do último lembrete, 5 h 30 min no total, não há lembrete novo)');
  for (let m = 0; m < 70; m += 10) { await ctx.clock.runFor(10 * 60000); await pg.mouse.move(150 + m, 160); }   // o relógio falso conta um pouco a menos que o real: folga de 30 min além das 6 horas
  await pg.waitForSelector('.balao[data-lembrete="horas"]', { timeout: 10000 });
  ok(true, 'duas abas abertas: o próximo lembrete vem no marco das 6 horas de trabalho');
  // registrar hoje por outro caminho (o Perfil) responde ao lembrete pendente: ele não pede de novo o que acabou de ser registrado
  await abrirPerfil(pg);
  await nivel(pg, '[data-dia-sel]', 'humor', 3); await nivel(pg, '[data-dia-sel]', 'energia', 3);
  await pg.click('[data-dia-sel] .reg-form .btn.pri'); await pg.waitForFunction(() => /humor neutro, energia média/.test(document.querySelector('#pf-det')?.textContent ?? ''), null, { timeout: 10000 });
  await fecharPerfil(pg); await pg.waitForTimeout(600);
  ok((await pg.$$('.balao')).length === 0 && (await pg2.$$('.balao')).length === 0, 'lembretes: registrar hoje pelo Perfil responde ao lembrete pendente nas duas abas (o balão não volta a pedir)');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await hidratada(pg); await pg.waitForTimeout(1500);
  ok((await pg.$$('.balao')).length === 0, 'lembretes: depois de recarregar, o lembrete respondido não volta');
  await pg2.close();

  // ---- retorno no dia seguinte (o estado guardado é de ontem) ----
  await ctx.clock.fastForward(22 * 3600 * 1000);   // 08h + 22h = 06h do dia seguinte
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await hidratada(pg); await pg.mouse.move(200, 200); await pg.waitForTimeout(2500);
  const amanha = await pg.evaluate(() => ({ jan: !!document.querySelector('.modal-ov'), titulo: document.querySelector('#m-tit')?.textContent, estado: JSON.parse(localStorage.getItem('dmanda:lembretes') ?? 'null') }));
  ok(amanha.estado?.dia === dia(1) && amanha.estado.lembretes === 0 && amanha.estado.trabalhado < 120, 'retorno no dia seguinte: o contador recomeça do zero com a data nova (nada de ontem é carregado)');
  ok(RESTANTES > 0 ? amanha.jan && amanha.titulo === 'Completar os últimos dias' : !amanha.jan, RESTANTES > 0 ? 'retorno no dia seguinte: o convite para completar os dias volta (ainda há dia de trabalho sem registro na nova janela de 5 dias)' : 'retorno no dia seguinte: sem dia pendente, o convite não aparece (neste dia da semana todos os dias da janela foram preenchidos)');
  if (amanha.jan) await pg.keyboard.press('Escape'); await pg.waitForSelector('.balao[data-lembrete="entrada"]', { timeout: 10000 });
  ok(true, 'retorno no dia seguinte: o balão de entrada do novo dia também aparece');
  // o banco ainda está em "hoje": gravar o "dia seguinte" é recusado, com a escolha preservada
  await nivel(pg, '.balao', 'humor', 4); await nivel(pg, '.balao', 'energia', 4);
  await pg.waitForSelector('.balao .reg-erro', { timeout: 15000 });
  ok(/ainda não chegou/.test((await pg.textContent('.balao .reg-erro')) ?? '') && (await marcado(pg, '.balao', 'humor')) === 4, 'banco: dia que ainda não chegou é recusado no banco, a mensagem não repete valores e a escolha fica');
  await ctx.close();
}

// ================= 4) virada do dia com o aplicativo aberto =================
{
  const { ctx, pg } = await novo({ viewport: { width: 1360, height: 900 } }, { instante: new Date(`${HOJE}T23:40:00-03:00`) });
  await abrir(pg, '/');
  await pg.waitForTimeout(800);
  if (await pg.$('.modal-ov')) await pg.keyboard.press('Escape');
  if (await pg.$('.balao')) await pg.click('.balao .icbtn-s');
  const ontem = await pg.evaluate(() => JSON.parse(localStorage.getItem('dmanda:lembretes')).dia);
  await avancar(pg, 30);     // 00h10 do dia seguinte
  await pg.waitForTimeout(1500);
  const novoDia = await pg.evaluate(() => ({ estado: JSON.parse(localStorage.getItem('dmanda:lembretes')), balao: !!document.querySelector('.balao') || !!document.querySelector('.modal-ov') }));
  if (await pg.$('.modal-ov')) await pg.keyboard.press('Escape');
  await pg.waitForSelector('.balao[data-lembrete="entrada"]'); await pg.click('.balao .icbtn-s'); await pg.waitForTimeout(400);
  const aposX = await pg.evaluate(() => ({ balao: !!document.querySelector('.balao'), pendente: JSON.parse(localStorage.getItem('dmanda:lembretes')).pendente }));
  ok(!aposX.balao && aposX.pendente === null, 'lembretes: fechar o balão pelo X o dispensa até o próximo marco (nada fica pendente no aparelho)');
  ok(ontem === HOJE && novoDia.estado.dia === dia(1) && novoDia.estado.trabalhado < 700 && novoDia.balao, 'virada do dia: com o aplicativo aberto na meia-noite o contador troca de dia, recomeça e o convite ou o balão do novo dia aparecem');
  await ctx.close();
}

// ================= 5) fechamento: uma linha por dia no banco =================
parar(); await new Promise((r) => setTimeout(r, 2500));
db = await abrirBancoTeste({ pasta: PASTA });
{
  const dup = (await db.query('select dia::text, count(*)::int as n from public.registros_dia group by user_id, dia having count(*) > 1')).rows;
  const hojeLinha = (await db.query('select humor, energia from public.registros_dia where dia = $1', [HOJE])).rows;
  const d1 = (await db.query('select humor, energia from public.registros_dia where dia = $1', [PENDENTES[0]])).rows;
  const d2 = (await db.query('select humor, energia from public.registros_dia where dia = $1', [PENDENTES[1]])).rows;
  ok(dup.length === 0, 'banco: nenhum dia tem mais de uma linha (clique duplo, falhas e repetições não duplicam)');
  ok(hojeLinha.length === 1 && hojeLinha[0].humor === 3 && hojeLinha[0].energia === 3, 'banco: hoje tem uma só linha, com a última gravação confirmada (3 e 3, depois de 3 e 4, 5 e 4, 2 e 2)');
  ok(d1.length === 1 && d1[0].humor === 1 && d1[0].energia === 2 && d2.length === 1 && d2[0].humor === 2 && d2[0].energia === 3, 'banco: os dias completados pelo convite e corrigidos pelo Perfil têm uma linha com os valores finais');
  const fora = (await db.query('select count(*)::int as n from public.registros_dia where dia > $1', [HOJE])).rows[0].n;
  ok(fora === 0, 'banco: nenhum registro de dia futuro');
}
await db.close();
await nav.close();

ok(externas.length === 0, `privacidade: nenhuma requisição saiu para fora do computador durante todo o teste (telemetria): ${externas.length ? [...new Set(externas)].join(', ') : 'nenhuma'}`);
ok(erros.length === 0, 'nenhum erro de console ou de página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
console.log(`\n${total - falhas}/${total} verificações passaram. Capturas para olhar: ${CAPTURAS}`);
process.exit(falhas ? 1 : 0);
