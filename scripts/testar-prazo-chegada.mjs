// Etapa 4 de 6 (decisão 81): prazos por duração contados da data de CHEGADA, no navegador (Edge e, quando existe, WebKit emulado do Playwright), com banco de TESTE descartável (PGlite,
// dados fictícios) e servidor na porta 7128. Fluxo completo: cadastro com chegada de outro dia, prévia, gravação, recarga, consulta, Agenda, filas e contadores; antecipação por feriado
// (02/11/2026 vira 30/10/2026, com os dias pulados); editar a chegada e ver o novo resultado antes de salvar; cadastrar e excluir indisponibilidade pela tela; legado sem chegada,
// legado da regra anterior e finalizada preservados; sem chegada o botão diz o que falta. Claro e Escuro, iPhone, iPad e computador (emulados), texto a 125%.
// O WebKit do Playwright NÃO é o Safari do aparelho. Nunca toca o Supabase real. Uso: node scripts/testar-prazo-chegada.mjs
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { ajustarPrazo, dataComSemana, prazoPorDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_CHEGADA || '7128', BASE = `http://localhost:${PORTA}`, RAIZ = '.dados-teste/prazo-chegada', CAPTURAS = '.dados-teste/prazo-chegada-capturas';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(RAIZ, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true }); mkdirSync(RAIZ, { recursive: true });
let falhas = 0, total = 0;
let ultimo = '';
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m + (c || !ultimo ? '' : `
        obtido: ${ultimo.slice(0, 700)}`)); if (!c) falhas++; ultimo = ''; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const ID = {};

// ---------- dados fictícios ----------
const db0 = await abrirBancoTeste({ pasta: `${RAIZ}/pg` });
await db0.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
await db0.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
{
  const c = (f, a) => chamarComoUsuario(db0, USUARIO, f, a);
  await c('salvar_dia_indisponivel', { p: { data: '2026-11-02', descricao: 'Finados', categoria: 'Feriado' } });
  ID.sem = (await c('criar_demanda', { p: { assunto: 'Legado sem chegada', prazo_original: '2026-12-04', etapa: 'Fazendo' } })).id;
  await db0.query('update public.demandas set prazo_legado = true where id = $1', [ID.sem]);
  // duração da regra anterior: contada de 05/11 (o dia em que foi escolhida), com chegada em 01/11; original 15/11 (domingo), vencimento 13/11
  ID.ant = (await c('criar_demanda', { p: { assunto: 'Legado da regra anterior', prazo_dias: 10, chegou_em: '2026-11-01', etapa: 'Fazendo' } })).id;
  await db0.query("update public.demandas set prazo_base_em = '2026-11-05', prazo_original = '2026-11-15', prazo = '2026-11-13', prazo_ajuste = '15/11 domingo; 14/11 sábado', prazo_legado = true where id = $1", [ID.ant]);
  ID.fin = (await c('criar_demanda', { p: { assunto: 'Finalizada com duração', prazo_dias: 10, chegou_em: '2026-09-01', etapa: 'Fazendo' } })).id;
  await c('concluir_demanda', { p_id: ID.fin });
}
await db0.close();

let servidor = null;
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: `${RAIZ}/pg` }, stdio: 'ignore' });
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* subindo */ } await esperar(2000); }

const edge = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const wk = await webkit.launch().catch((e) => { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); return null; });
const erros = [];
const PERFIS = { desktop: { viewport: { width: 1440, height: 900 } }, ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } };
const novoCtx = async (perfil, { motor = edge, tema = 'claro', texto = 100 } = {}) => {
  const ctx = await motor.newContext({ ...(motor === wk && perfil === 'celular' ? devices['iPhone 13'] : PERFIS[perfil]) });
  await ctx.addInitScript(([t, p]) => { if (!localStorage.getItem('feito')) { localStorage.setItem('feito', '1'); localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:aparencia', JSON.stringify({ textoPct: p })); } }, [tema, texto]);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
const ir = async (pg, rota, sel) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 });
  if (sel) await pg.waitForSelector(sel, { timeout: 120000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await esperar(500);
};
const toast = async (pg, re) => { await pg.waitForFunction((r) => { const t = document.querySelector('#toast'); return !!t && t.classList.contains('on') && (!r || new RegExp(r).test(t.textContent ?? '')); }, re ? re.source : null, { timeout: 15000 }); };
const fechada = (pg) => pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 20000 });
const texto = async (pg, sel) => { ultimo = ((await pg.innerText(sel)) ?? '').replace(/\s+/g, ' ').trim(); return ultimo; };
const abrirDemanda = async (pg, quem) => { await ir(pg, '/demandas', '.grupo-cards'); await pg.fill('#fq', quem); await esperar(500); await pg.locator(`.dcard:has-text("${quem}") .assunto`).first().click(); await pg.waitForSelector('.modal .ler'); };
const abrirNoQuadro = async (pg, quem) => { await ir(pg, '/demandas', '.grupo-cards'); await pg.click('.toolbar .tabs button[data-v="quadro"]'); await pg.waitForSelector('.quadro .mini-card'); await pg.locator(`.mini-card:has-text("${quem}") .assunto`).first().click(); await pg.waitForSelector('.modal .ler'); };
const editarChegada = async (pg) => { await pg.click('button[aria-label="Editar chegada e prazo"]'); await pg.waitForSelector('#d-chegou'); };
const salvarSecao = async (pg) => { await pg.click('[data-salvar="chegada"]'); await toast(pg, /alterações salvas/); await esperar(600); };

// =============================================================================================================================================
// 1) fluxo completo no computador (Claro): cadastro com chegada de outro dia até a gravação, a consulta, a Agenda e as filas
// =============================================================================================================================================
const NOME = 'Resposta ao TCE por chegada';
const somaIso = (iso, n) => prazoPorDias(n, iso);
{
  const { ctx, pg } = await novoCtx('desktop');
  await ir(pg, '/demandas', '.grupo-cards');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', NOME); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  ok(!(await pg.$('.modal .opcoes button:has-text("Legal")')) && !/Tipo de prazo/.test((await pg.textContent('.modal')) ?? ''), 'o cadastro não mostra a escolha Legal/Próprio');
  // sem chegada: o botão diz o que falta e não cria prazo
  await pg.click('.modal .dias-btns button:has-text("10 dias")');
  ok((await texto(pg, '[data-falta-chegada]')) === 'Informe a data de chegada para calcular o prazo de 10 dias.' && (await pg.inputValue('#n-prazo')) === '', 'sem chegada, o botão de 10 dias diz a informação que falta e não cria prazo');
  // chegada de outro dia (23/10/2026) + 10 dias = 02/11 (Finados), antecipado para 30/10
  await pg.fill('#n-chegou', '2026-10-23'); await pg.click('.modal .dias-btns button:has-text("10 dias")');
  const previa = await texto(pg, '.modal .prev-prazo');
  const esperado = ajustarPrazo(prazoPorDias(10, '2026-10-23'), [{ id: 'f', data: '2026-11-02', descricao: 'Finados', categoria: 'Feriado', criado_em: '2026-01-01' }]);
  ok(esperado.prazo === '2026-10-30' && previa.includes('10 dias corridos a partir da chegada (23/10/2026)') && previa.includes(dataComSemana('2026-11-02')) && previa.includes(`Vencimento antecipado para ${dataComSemana('2026-10-30')}`) && previa.includes('Dias pulados: 02/11 feriado: Finados; 01/11 domingo; 31/10 sábado'),
    `a prévia mostra a contagem pela chegada, o original (02/11) e o vencimento antecipado (30/10) com os dias pulados (${previa.slice(0, 200)})`);
  ok(!(await pg.$('[data-falta-chegada]')), 'com a chegada informada o aviso do que faltava some');
  await pg.screenshot({ path: `${CAPTURAS}/cadastro-previa-claro.png` });
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 20000 });
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await fechada(pg);
  // recarregar: a consulta mostra o que foi gravado
  await abrirDemanda(pg, NOME);
  let ler = await texto(pg, '.modal');
  ok(/Chegou em 23\/10\/2026/.test(ler) && ler.includes(`Vencimento ${dataComSemana('2026-10-30')}`) && ler.includes(`Prazo original ${dataComSemana('2026-11-02')}`) && ler.includes('Dias pulados: 02/11 feriado: Finados; 01/11 domingo; 31/10 sábado') && ler.includes('10 dias corridos a partir da chegada (23/10/2026)') && !/Tipo de prazo|Legal/.test(ler),
    `depois de recarregar, a consulta mostra o vencimento, o original, os dias pulados e a contagem pela chegada, sem Legal/Próprio`);
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  // Agenda: o vencimento aparece no dia efetivo, dizendo que foi antecipado
  await ir(pg, '/agenda', '.agd');
  await pg.click('.agd-barra .opcoes button:has-text("Dia")'); await esperar(400);
  await pg.fill('.agd-data input', '2026-10-30'); await pg.waitForFunction(() => document.querySelector('.agd-data input')?.value === '2026-10-30'); await esperar(700);
  const agd = await texto(pg, '.agd');
  ok(agd.includes(NOME) && /Prazo original 02\/11\/2026, antecipado\. Dias pulados: 02\/11 feriado: Finados; 01\/11 domingo; 31\/10 sábado/.test(agd), 'a Agenda mostra o vencimento no dia 30/10 com "Prazo original 02/11/2026, antecipado"');
  // filas: atrasada (hoje é depois de 30/10): contador Atrasadas, Urgentes e Prazos da Secretaria
  await ir(pg, '/', '.stat.st-atrasadas');
  const nAtr = Number((await pg.textContent('.stat.st-atrasadas .n')).trim());
  await pg.click('.stat.st-atrasadas'); await pg.waitForURL('**/demandas'); await pg.waitForSelector('[data-secao="urgentes"]', { timeout: 60000 }); await esperar(600);
  const nasFilas = await pg.$$eval('.grupo-cards', (l, nome) => l.filter((g) => [...g.querySelectorAll('.dcard')].some((c) => c.textContent.includes(nome))).map((g) => g.dataset.secao), NOME);
  ok(nAtr >= 1 && nasFilas.includes('urgentes') && nasFilas.includes('prazos'), `o contador Atrasadas (${nAtr}) abre a demanda, e ela está em ${nasFilas.join(', ')}`);
  await ctx.close();
}

// =============================================================================================================================================
// 2) editar a chegada: o novo resultado aparece antes de salvar e continua depois de recarregar; indisponibilidade cadastrada e excluída pela tela
// =============================================================================================================================================
{
  const { ctx, pg } = await novoCtx('desktop');
  await abrirDemanda(pg, NOME); await editarChegada(pg);
  ok(/10 dias corridos a partir da chegada \(23\/10\/2026\)/.test(await texto(pg, '.modal .prev-prazo')), 'o formulário de edição parte da contagem gravada (23/10 + 10 dias)');
  await pg.fill('#d-chegou', '2026-10-26');
  const prev2 = await texto(pg, '.modal .prev-prazo');
  ok((await pg.inputValue('#d-prazo')) === '2026-11-05' && prev2.includes('a partir da chegada (26/10/2026)') && prev2.includes(`Vencimento: ${dataComSemana('2026-11-05')}`) && !/Dias pulados/.test(prev2), `editar a chegada para 26/10 mostra, antes de salvar, 05/11 como novo prazo e sem ajuste (${prev2.slice(0, 160)})`);
  await pg.screenshot({ path: `${CAPTURAS}/edicao-chegada-claro.png` });
  await salvarSecao(pg);
  await abrirDemanda(pg, NOME);
  let ler = await texto(pg, '.modal');
  ok(/Chegou em 26\/10\/2026/.test(ler) && ler.includes(`Vencimento ${dataComSemana('2026-11-05')}`) && !/Prazo original/.test(ler) && ler.includes('10 dias corridos a partir da chegada (26/10/2026)'), 'depois de salvar e recarregar: chegada 26/10, vencimento 05/11 e a contagem pela nova chegada');
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  // cadastrar a indisponibilidade de 05/11 pela tela de Configurações: o vencimento recua, com o motivo
  await ir(pg, '/config', '#cfg-data');
  await pg.fill('#cfg-data', '2026-11-05'); await pg.fill('#cfg-desc', 'Feriado municipal (teste)'); await pg.click('button:has-text("Cadastrar dia")');
  await pg.waitForFunction(() => document.querySelector('.cfg-lista')?.textContent.includes('Feriado municipal (teste)'), null, { timeout: 20000 }); await esperar(500);
  await abrirDemanda(pg, NOME);
  ler = await texto(pg, '.modal');
  ok(ler.includes(`Vencimento ${dataComSemana('2026-11-04')}`) && ler.includes(`Prazo original ${dataComSemana('2026-11-05')}`) && ler.includes('Dias pulados: 05/11 feriado: Feriado municipal (teste)'), 'cadastrar o dia indisponível 05/11 recalcula a demanda aberta: vencimento 04/11, original 05/11 e o motivo');
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  await ir(pg, '/config', '.cfg-lista');
  await pg.click('[aria-label="Excluir Feriado municipal (teste)"]'); await pg.click('.cfg-lista .btn:has-text("Confirmar exclusão")');
  await pg.waitForFunction(() => !document.querySelector('.cfg-lista')?.textContent.includes('Feriado municipal (teste)'), null, { timeout: 20000 }); await esperar(500);
  await abrirDemanda(pg, NOME);
  ler = await texto(pg, '.modal');
  ok(ler.includes(`Vencimento ${dataComSemana('2026-11-05')}`) && !/Prazo original/.test(ler), 'excluir o dia indisponível devolve o vencimento a 05/11');
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  await ctx.close();
}

// =============================================================================================================================================
// 3) registros antigos: legado sem chegada, legado da regra anterior e finalizada
// =============================================================================================================================================
{
  const { ctx, pg } = await novoCtx('desktop');
  // legado sem chegada: o vencimento fica e a falta da base é sinalizada
  await abrirDemanda(pg, 'Legado sem chegada');
  let ler = await texto(pg, '.modal');
  ok(ler.includes(`Vencimento ${dataComSemana('2026-12-04')}`) && /Sem data de chegada: a data registrada foi mantida e não há base para recalculá-la pela chegada\. Os dias indisponíveis continuam ajustando o vencimento a partir dela/.test(ler), 'legado sem chegada: o vencimento registrado aparece e a consulta sinaliza que falta a base para recalcular pela chegada');
  await editarChegada(pg);
  ok(!!(await pg.$('[data-nota-sem-base]')), 'legado sem chegada: o formulário repete o aviso de que não há base');
  await pg.fill('#d-chegou', '2026-11-10');
  ok((await pg.inputValue('#d-prazo')) === '2026-12-04' && (await texto(pg, '.modal .prev-prazo')).includes(dataComSemana('2026-12-04')), 'legado sem chegada: informar a chegada agora não muda o vencimento registrado');
  await salvarSecao(pg);
  // legado da regra anterior: contagem mantida e identificada
  await abrirDemanda(pg, 'Legado da regra anterior');
  ler = await texto(pg, '.modal');
  ok(ler.includes(`Vencimento ${dataComSemana('2026-11-13')}`) && /10 dias corridos a partir de 05\/11\/2026 \(não é a chegada atual; contagem mantida\)/.test(ler), 'legado da regra anterior: a consulta mostra a contagem a partir de 05/11 como não sendo a chegada atual, mantida');
  await editarChegada(pg);
  ok(!!(await pg.$('[data-nota-regra-anterior]')) && (await pg.getAttribute('.modal .dias-btns button:has-text("10 dias")', 'aria-pressed')) === 'false', 'legado da regra anterior: o formulário avisa e não marca o botão de 10 dias como escolhido');
  await pg.fill('#d-chegou', '2026-11-03');
  ok((await pg.inputValue('#d-prazo')) === '2026-11-15' && (await texto(pg, '.modal .prev-prazo')).includes(`Prazo original: ${dataComSemana('2026-11-15')}`), 'legado da regra anterior: mudar a chegada não recalcula (o prazo continua 15/11)');
  await salvarSecao(pg);
  await abrirDemanda(pg, 'Legado da regra anterior'); await editarChegada(pg);
  await pg.click('.modal .dias-btns button:has-text("10 dias")');
  ok((await pg.inputValue('#d-prazo')) === '2026-11-13' && (await texto(pg, '.modal .prev-prazo')).includes('a partir da chegada (03/11/2026)'), 'legado da regra anterior: escolher a duração de novo conta pela chegada (03/11 + 10 = 13/11)');
  await pg.click('[data-cancelar="chegada"]').catch(async () => { await pg.click('.modal .btn:has-text("Cancelar")'); }); await esperar(400);
  // apagar a chegada e informá-la de novo antes de salvar refaz a contagem; um prazo escolhido à mão não é tocado
  await abrirDemanda(pg, NOME); await editarChegada(pg);
  await pg.click('.modal .add-t:has(#d-chegou) button:has-text("Sem data")');
  ok(!!(await pg.$('.modal [data-nota-sem-chegada]')) && (await pg.inputValue('#d-prazo')) === '2026-11-05', 'chegada apagada no formulário: a data do prazo continua e a nota avisa que a contagem volta se a chegada voltar');
  await pg.fill('#d-chegou', '2026-10-28');
  ok((await pg.inputValue('#d-prazo')) === somaIso('2026-10-28', 10), 'chegada apagada e informada de novo (28/10) antes de salvar: a contagem de 10 dias é refeita a partir dela');
  await pg.click('.modal .btn:has-text("Cancelar")'); await esperar(400);
  // finalizada: o prazo do histórico não é recalculado ao corrigir a chegada
  await abrirNoQuadro(pg, 'Finalizada com duração');
  await editarChegada(pg);
  await pg.fill('#d-chegou', '2026-09-03');
  ok((await pg.inputValue('#d-prazo')) === '2026-09-11' && (await texto(pg, '.modal .prev-prazo')).includes(dataComSemana('2026-09-11')), 'finalizada: corrigir a chegada não recalcula o prazo do histórico (continua 11/09)');
  await salvarSecao(pg);
  await ctx.close();
}

// =============================================================================================================================================
// 4) a tela renderizada: Claro e Escuro, iPhone, iPad e computador, texto a 125%
// =============================================================================================================================================
for (const [rot, perfil, tema, texto125, motor] of [['computador Escuro', 'desktop', 'escuro', 100, edge], ['iPad Claro', 'ipad', 'claro', 100, edge], ['iPhone Claro', 'celular', 'claro', 100, edge], ['iPhone Escuro 125%', 'celular', 'escuro', 125, edge], ...(wk ? [['WebKit emulado iPhone Claro', 'celular', 'claro', 100, wk], ['WebKit emulado iPhone Escuro', 'celular', 'escuro', 100, wk]] : [])]) {
  const { ctx, pg } = await novoCtx(perfil, { motor, tema, texto: texto125 });
  await ir(pg, '/demandas', '.grupo-cards, .vazio');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', `Visual ${rot}`); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  await pg.click('.modal .dias-btns button:has-text("10 dias")'); await pg.waitForSelector('[data-falta-chegada]');
  const dentro = async (sel) => pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(), v = document.documentElement.clientWidth; return { esq: r.left >= -1, dir: r.right <= v + 1, alto: r.height > 8, fonte: parseFloat(getComputedStyle(e).fontSize) }; });
  const f1 = await dentro('[data-falta-chegada]');
  ok(f1.esq && f1.dir && f1.alto && f1.fonte >= 10 && (await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)), `${rot}: o aviso "Informe a data de chegada" fica inteiro na tela, sem rolagem lateral e com fonte de ${f1.fonte.toFixed(1)} px`);
  const corAviso = await pg.$eval('[data-falta-chegada]', (e) => { const c = getComputedStyle(e); return { cor: c.color, fundo: c.backgroundColor }; });
  await pg.screenshot({ path: `${CAPTURAS}/falta-chegada-${rot.replace(/\s+/g, '-')}.png` });
  await pg.fill('#n-chegou', '2026-10-23'); await pg.click('.modal .dias-btns button:has-text("10 dias")'); await esperar(300);
  const f2 = await dentro('.modal .prev-prazo');
  const botoes = await pg.$$eval('.modal .dias-btns button', (l) => l.map((b) => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height }; }));
  const vw = await pg.evaluate(() => document.documentElement.clientWidth);
  ok(f2.esq && f2.dir && (await texto(pg, '.modal .prev-prazo')).includes('Dias pulados: 02/11 feriado: Finados') && botoes.length === 4 && botoes.every((b) => b.l >= -1 && b.r <= vw + 1) && (await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)), `${rot}: a prévia com os dias pulados e os quatro botões cabem na largura (${vw} px), sem rolagem lateral (aviso: ${corAviso.cor} sobre ${corAviso.fundo})`);
  await pg.screenshot({ path: `${CAPTURAS}/previa-${rot.replace(/\s+/g, '-')}.png` });
  await pg.keyboard.press('Escape'); await esperar(300);
  await ctx.close();
}

parar();
await wk?.close();
await edge.close();
await esperar(2500);

// =============================================================================================================================================
// 5) o que ficou gravado no banco
// =============================================================================================================================================
{
  const db = await abrirBancoTeste({ pasta: `${RAIZ}/pg` });
  try {
    const q = async (assunto) => (await db.query('select assunto, chegou_em::text, prazo::text, prazo_original::text, prazo_dias, prazo_base_em::text, prazo_ajuste, prazo_legado, prazo_tipo, etapa from public.demandas where assunto = $1', [assunto])).rows;
    const r = (await q(NOME));
    ok(r.length === 1 && r[0].chegou_em === '2026-10-26' && r[0].prazo_original === '2026-11-05' && r[0].prazo === '2026-11-05' && r[0].prazo_dias === 10 && r[0].prazo_base_em === '2026-10-26' && r[0].prazo_ajuste === null && r[0].prazo_tipo === 'Próprio', `banco: a demanda cadastrada tem chegada 26/10, original e vencimento 05/11, 10 dias contados da chegada, uma só linha e prazo próprio (${JSON.stringify(r[0])})`);
    const l1 = (await q('Legado sem chegada'))[0];
    ok(l1.chegou_em === '2026-11-10' && l1.prazo_original === '2026-12-04' && l1.prazo === '2026-12-04' && l1.prazo_dias === null, 'banco: o legado sem chegada ganhou a chegada e manteve o vencimento registrado');
    const l2 = (await q('Legado da regra anterior'))[0];
    ok(l2.chegou_em === '2026-11-03' && l2.prazo_original === '2026-11-15' && l2.prazo === '2026-11-13' && l2.prazo_base_em === '2026-11-05' && l2.prazo_dias === 10, 'banco: o legado da regra anterior manteve o original, o vencimento e a base de 05/11 (só a chegada mudou)');
    const l3 = (await q('Finalizada com duração'))[0];
    ok(l3.etapa === 'Finalizado' && l3.chegou_em === '2026-09-03' && l3.prazo_original === '2026-09-11' && l3.prazo === '2026-09-11', 'banco: a finalizada teve a chegada corrigida e o prazo do histórico intacto');
    const n = (await db.query("select count(*)::int as n from public.demandas where assunto like 'Visual %'")).rows[0].n;
    ok(n === 0, 'banco: os formulários abertos só para conferir a tela não criaram demanda sem o aviso de criação');
  } finally { await db.close(); }
}
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
