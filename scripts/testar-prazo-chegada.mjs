// Etapa 4 de 6 (decisão 81): prazos por duração contados da data de CHEGADA, no navegador (Edge e, quando existe, WebKit emulado do Playwright), com banco de TESTE descartável (PGlite,
// dados fictícios) e servidor na porta 7128. Fluxo completo: cadastro com chegada de outro dia, prévia, gravação, recarga, consulta, Agenda, filas e contadores; antecipação por feriado
// (02/11/2026 vira 30/10/2026, com os dias pulados); editar a chegada e ver o novo resultado antes de salvar; cadastrar e excluir indisponibilidade pela tela; legado sem chegada,
// legado da regra anterior e finalizada preservados; sem chegada o botão diz o que falta. Claro e Escuro, iPhone, iPad e computador (emulados), texto a 125%.
// O WebKit do Playwright NÃO é o Safari do aparelho. Nunca toca o Supabase real. Uso: node scripts/testar-prazo-chegada.mjs
import { devices } from 'playwright-core';
import { abrirEdge, abrirWebkit, criarVerificador, esperar, iniciarServidor, pararServidores as parar } from './auxiliar-navegador.mjs';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { ajustarPrazo, dataComSemana, prazoPorDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_CHEGADA || '7128', BASE = `http://localhost:${PORTA}`, RAIZ = '.dados-teste/prazo-chegada', CAPTURAS = '.dados-teste/prazo-chegada-capturas';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(RAIZ, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true }); mkdirSync(RAIZ, { recursive: true });
const verificador = criarVerificador(); const { ok, resumo } = verificador;
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

await iniciarServidor({ porta: PORTA, pasta: `${RAIZ}/pg` });

const edge = await abrirEdge();
const wk = await abrirWebkit();
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
const texto = async (pg, sel) => verificador.obtido(((await pg.innerText(sel)) ?? '').replace(/\s+/g, ' ').trim());
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
// 2b) decisão 84: aviso quando o vencimento antecipado ficou ANTES da chegada. O cálculo não muda; o aviso aparece na prévia, na consulta, na Agenda e no sininho (nunca na barra global),
//     acompanha os dados vigentes e some quando a condição some. Exemplo: chegada 28/12/2026, prazo original 31/12 (3 dias), indisponível de 24/12/2026 a 03/01/2027: ajustado 23/12.
// =============================================================================================================================================
const AVISO = 'O vencimento antecipado ficou antes da chegada. Confira a chegada, o prazo e os dias indisponíveis cadastrados.';
const AVISO_FICOU = 'O vencimento ficou antes da chegada. Confira a chegada, o prazo e os dias indisponíveis cadastrados.';
const NOME_P = 'Ofício com prazo anterior à chegada';
const NOME_V = 'Ofício da virada do ano', NOME_D = 'Ofício de meados de dezembro';
const cadastrar = async (pg, assunto, chegada, prazo) => {
  await ir(pg, '/demandas', '.grupo-cards');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', assunto); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  if (chegada) await pg.fill('#n-chegou', chegada);
  await pg.fill('#n-prazo', prazo); await esperar(300);
};
const gravarCadastro = async (pg) => { await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 20000 }); await pg.click('.modal .btn:has-text("Pular tarefas")'); await fechada(pg); };
const sino = async (pg) => ({ rotulo: await pg.getAttribute('.sino', 'aria-label'), n: (await pg.getAttribute('.sino', 'data-avisos')) ?? '0' });
const itensSino = async (pg) => { await pg.click('.sino'); await pg.waitForSelector('.avisos-painel'); return pg.$$eval('.avisos-painel [data-aviso^="chegada-"]', (l) => l.map((x) => ({ id: x.dataset.aviso, escopo: x.dataset.escopo, texto: x.textContent.replace(/\s+/g, ' ').trim() }))); };
{
  const { ctx, pg } = await novoCtx('desktop');
  // o período de 24/12/2026 a 03/01/2027, pela tela de Configurações
  await ir(pg, '/config', '#cfg-data');
  await pg.fill('#cfg-data', '2026-12-24'); await pg.fill('#cfg-fim', '2027-01-03'); await pg.fill('#cfg-desc', 'Recesso da virada (teste)'); await pg.click('button:has-text("Cadastrar período")');
  await pg.waitForFunction(() => document.querySelector('.cfg-lista')?.textContent.includes('Recesso da virada (teste)'), null, { timeout: 20000 }); await esperar(500);
  // sem chegada: a prévia mostra o ajuste (original 31/12 vira 23/12) mas NÃO avisa (a chegada é desconhecida)
  await cadastrar(pg, NOME_V, '', '2026-12-31');
  let previa = await texto(pg, '.modal .prev-prazo');
  ok(previa.includes(`Vencimento antecipado para ${dataComSemana('2026-12-23')}`) && !(await pg.$('[data-antes-chegada]')), 'aviso da chegada, prévia sem chegada: vence 23/12 (antecipado) e NÃO avisa, porque a chegada é desconhecida');
  // chegada igual ao vencimento ajustado (23/12): não é estritamente anterior, sem aviso
  await pg.fill('#n-chegou', '2026-12-23'); await esperar(300);
  ok((await texto(pg, '.modal .prev-prazo')).includes(`Vencimento antecipado para ${dataComSemana('2026-12-23')}`) && !(await pg.$('[data-antes-chegada]')), 'aviso da chegada, prévia: ajustado igual à chegada (23/12) não avisa');
  // chegada 28/12/2026: o ajustado (23/12) fica antes dela
  await pg.fill('#n-chegou', '2026-12-28'); await esperar(300);
  previa = await texto(pg, '.modal .prev-prazo');
  const prevAviso = (await pg.$$eval('.modal [data-antes-chegada]', (l) => l.map((x) => x.textContent.trim())));
  ok(previa.includes(`Prazo original: ${dataComSemana('2026-12-31')}`) && previa.includes(`Vencimento antecipado para ${dataComSemana('2026-12-23')}`) && prevAviso.length === 1 && prevAviso[0] === AVISO, `aviso da chegada, prévia: chegada 28/12 e original 31/12 dão ajustado 23/12 e UM aviso com o texto aprovado (${previa.slice(0, 160)})`);
  await pg.screenshot({ path: `${CAPTURAS}/aviso-chegada-previa-claro.png` });
  // o aviso não bloqueia a gravação
  await gravarCadastro(pg);
  // consulta (o que o servidor gravou: cálculo preservado)
  await abrirDemanda(pg, NOME_V);
  let ler = await texto(pg, '.modal');
  const consAviso = await pg.$$eval('.modal [data-antes-chegada]', (l) => l.map((x) => x.textContent.trim()));
  ok(/Chegou em 28\/12\/2026/.test(ler) && ler.includes(`Vencimento ${dataComSemana('2026-12-23')}`) && ler.includes(`Prazo original ${dataComSemana('2026-12-31')}`) && ler.includes('Dias pulados: 31/12 feriado: Recesso da virada (teste)') && ler.includes('24/12 feriado: Recesso da virada (teste)') && consAviso.length === 1 && consAviso[0] === AVISO,
    `aviso da chegada, consulta: gravou com o cálculo preservado (chegada 28/12, original 31/12, vencimento 23/12, oito dias pulados) e mostra o aviso uma vez (${ler.slice(0, 200)})`);
  await pg.screenshot({ path: `${CAPTURAS}/aviso-chegada-consulta-claro.png` });
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  // o caso aprovado anterior: chegada 14/12 e original 29/12, também ajustado para 23/12: SEM aviso, na prévia, na consulta e no sininho
  await cadastrar(pg, NOME_D, '2026-12-14', '2026-12-29');
  previa = await texto(pg, '.modal .prev-prazo');
  ok(previa.includes(`Prazo original: ${dataComSemana('2026-12-29')}`) && previa.includes(`Vencimento antecipado para ${dataComSemana('2026-12-23')}`) && !(await pg.$('[data-antes-chegada]')), 'aviso da chegada, caso aprovado (chegada 14/12, original 29/12, ajustado 23/12): a prévia antecipa e NÃO avisa');
  await gravarCadastro(pg);
  await abrirDemanda(pg, NOME_D);
  ler = await texto(pg, '.modal');
  ok(ler.includes(`Vencimento ${dataComSemana('2026-12-23')}`) && ler.includes(`Prazo original ${dataComSemana('2026-12-29')}`) && !(await pg.$('[data-antes-chegada]')) && !ler.includes('antes da chegada'), 'aviso da chegada, caso aprovado: a consulta mostra o ajuste e não mostra o aviso');
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  // Agenda: o marco do vencimento (23/12) traz o aviso só para a demanda da virada
  await ir(pg, '/agenda', '.agd');
  await pg.click('.agd-barra .opcoes button:has-text("Dia")'); await esperar(400);
  await pg.fill('.agd-data input', '2026-12-23'); await pg.waitForFunction(() => document.querySelector('.agd-data input')?.value === '2026-12-23'); await esperar(700);
  const notas = await pg.$$eval('.agd-nota', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  const linhaV = notas.filter((t) => t.includes('Prazo original 31/12/2026')), linhaD = notas.filter((t) => t.includes('Prazo original 29/12/2026'));
  ok((await texto(pg, '.agd')).includes(NOME_V) && linhaV.length === 1 && linhaV[0].includes(`antecipado. Dias pulados: 31/12 feriado: Recesso da virada (teste)`) && linhaV[0].endsWith(`${AVISO.replace(/\.$/, '')}.`) && linhaD.length === 1 && !linhaD[0].includes('antes da chegada'), `aviso da chegada, Agenda: o vencimento de 23/12 da demanda da virada traz o aviso e o da demanda de meados de dezembro não (${notas.join(' || ').slice(0, 240)})`);
  // sininho: um item para a demanda da virada (e nenhum para a outra), fora da barra global, com a ação que abre a demanda certa
  await ir(pg, '/', '.stat.st-atrasadas');
  let s = await sino(pg);
  ok(/Avisos: 1 problema novo/.test(s.rotulo) && s.n === '1', `aviso da chegada, sininho: um aviso novo para a demanda da virada (${s.rotulo})`);
  ok((await pg.locator('.erro-carga').count()) === 0, 'aviso da chegada: nada ocupa a barra global nem a faixa da tela');
  let itens = await itensSino(pg);
  ok(itens.length === 1 && itens[0].escopo === 'sino' && itens[0].texto.includes(NOME_V) && itens[0].texto.includes(AVISO) && !itens[0].texto.includes(AVISO_FICOU) && !itens[0].texto.includes(NOME_D), `aviso da chegada, sininho: um item só, com o assunto e o texto "antecipado"; nenhum para a demanda de 14/12 (${itens.map((i) => i.texto).join(' | ').slice(0, 220)})`);
  await pg.screenshot({ path: `${CAPTURAS}/aviso-chegada-sininho-claro.png` });
  await pg.keyboard.press('Escape'); await esperar(300);
  // recarregar não duplica: continua um item só
  await ir(pg, '/', '.stat.st-atrasadas');
  itens = await itensSino(pg);
  ok(itens.length === 1 && (await sino(pg)).n === '1', 'aviso da chegada, sininho: depois de recarregar continua um item só (sem duplicar)');
  // a ação abre a demanda certa, com o aviso na consulta
  await pg.click(`.avisos-painel .avisos-item:has-text("${NOME_V}") [data-acao="abrir"]`);
  await pg.waitForSelector('.modal .ler', { timeout: 20000 }); await esperar(300);
  ler = await texto(pg, '.modal');
  ok(ler.includes(NOME_V) && ler.includes(AVISO) && !(await pg.$('.avisos-painel')), 'aviso da chegada, sininho: "Abrir a demanda" fecha o painel e abre a consulta da demanda certa');
  // editar a chegada para 21/12: o ajustado (23/12) deixa de ser anterior, o prazo gravado não muda e o aviso some
  await editarChegada(pg);
  await pg.fill('#d-chegou', '2026-12-21'); await esperar(300);
  ok(!(await pg.$('.modal [data-antes-chegada]')) && (await pg.inputValue('#d-prazo')) === '2026-12-31', 'aviso da chegada, edição: com a chegada em 21/12 a prévia não avisa e o prazo original continua 31/12');
  await salvarSecao(pg);
  await abrirDemanda(pg, NOME_V);
  ler = await texto(pg, '.modal');
  ok(/Chegou em 21\/12\/2026/.test(ler) && ler.includes(`Vencimento ${dataComSemana('2026-12-23')}`) && ler.includes(`Prazo original ${dataComSemana('2026-12-31')}`) && !ler.includes('antes da chegada'), 'aviso da chegada: salva a chegada 21/12, o vencimento continua 23/12 (original 31/12) e a consulta já não avisa');
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  s = await sino(pg);
  ok(/nenhum agora/.test(s.rotulo) && s.n === '0', `aviso da chegada, sininho: a condição deixou de existir e o aviso sumiu (${s.rotulo})`);
  await pg.keyboard.press('Escape'); await esperar(300);
  // a chegada volta a 28/12: o aviso volta; excluir o período devolve o vencimento ao original e o aviso some de novo
  await abrirDemanda(pg, NOME_V); await editarChegada(pg);
  await pg.fill('#d-chegou', '2026-12-28'); await salvarSecao(pg);
  await abrirDemanda(pg, NOME_V);
  ok(((await texto(pg, '.modal')).includes(AVISO)), 'aviso da chegada: chegada de volta a 28/12, a consulta mostra o aviso de novo');
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  await ir(pg, '/config', '.cfg-lista');
  await pg.click('[aria-label="Excluir Recesso da virada (teste)"]'); await pg.click('.cfg-lista .btn:has-text("Confirmar exclusão")');
  await pg.waitForFunction(() => !document.querySelector('.cfg-lista')?.textContent.includes('Recesso da virada (teste)'), null, { timeout: 20000 }); await esperar(700);
  s = await sino(pg);
  await abrirDemanda(pg, NOME_V);
  ler = await texto(pg, '.modal');
  ok(/nenhum agora/.test(s.rotulo) && ler.includes(`Vencimento ${dataComSemana('2026-12-31')}`) && !/Prazo original/.test(ler) && !ler.includes('antes da chegada'), `aviso da chegada: excluído o período, o vencimento volta ao original (31/12), a consulta e o sininho ficam sem aviso (${s.rotulo})`);
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  // critério de aderência: o vencimento efetivo antes da chegada basta, sem prazo original diferente nem antecipação. Prazo informado direto antes da chegada: prévia, gravação, consulta, Agenda e sininho com o texto "ficou" (o caso sem prazo original não existe no banco, que exige os dois campos juntos: fica nos testes de regras)
  let av;
  await cadastrar(pg, NOME_P, '2026-12-14', '2026-12-10');
  previa = await texto(pg, '.modal .prev-prazo');
  av = await pg.$$eval('.modal [data-antes-chegada]', (l) => l.map((x) => x.textContent.trim()));
  ok(previa.includes(`Vencimento: ${dataComSemana('2026-12-10')}`) && !/antecipado para/.test(previa) && av.length === 1 && av[0] === AVISO_FICOU, `aviso da chegada, prévia: prazo 10/12 informado direto antes da chegada 14/12 não é antecipação e avisa com o texto "ficou" (${previa.slice(0, 140)})`);
  await pg.fill('#n-chegou', '2026-12-10'); await esperar(300);
  ok(!(await pg.$('.modal [data-antes-chegada]')), 'aviso da chegada, prévia: prazo igual à chegada (10/12) não avisa');
  await pg.fill('#n-chegou', '2026-12-14'); await esperar(300);
  await gravarCadastro(pg);
  await abrirDemanda(pg, NOME_P);
  ler = await texto(pg, '.modal');
  av = await pg.$$eval('.modal [data-antes-chegada]', (l) => l.map((x) => x.textContent.trim()));
  ok(ler.includes(`Vencimento ${dataComSemana('2026-12-10')}`) && !/Prazo original/.test(ler) && !/Ajuste/.test(ler) && av.length === 1 && av[0] === AVISO_FICOU, 'aviso da chegada, consulta: a demanda gravada com prazo direto antes da chegada mostra o texto "ficou", sem linhas de ajuste');
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  await ir(pg, '/agenda', '.agd');
  await pg.click('.agd-barra .opcoes button:has-text("Dia")'); await esperar(400);
  await pg.fill('.agd-data input', '2026-12-10'); await pg.waitForFunction(() => document.querySelector('.agd-data input')?.value === '2026-12-10'); await esperar(700);
  const notas2 = await pg.$$eval('.agd-nota', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(notas2.length === 1 && notas2.every((t) => t.includes(`Vencimento: Prazo. ${AVISO_FICOU.replace(/\.$/, '')}.`)) && (await texto(pg, '.agd')).includes(NOME_P), `aviso da chegada, Agenda: o vencimento de 10/12 sem antecipação traz a nota com o texto "ficou" (${notas2.join(' || ').slice(0, 200)})`);
  await ir(pg, '/', '.stat.st-atrasadas');
  itens = await itensSino(pg);
  ok(itens.length === 1 && itens[0].escopo === 'sino' && itens[0].texto.includes(AVISO_FICOU) && !itens[0].texto.includes(AVISO) && itens[0].texto.includes(NOME_P) && (await sino(pg)).n === '1' && (await pg.locator('.erro-carga').count()) === 0, `aviso da chegada, sininho: o registro sem antecipação aparece com o texto "ficou" e nada ocupa a barra global (${itens.map((i) => i.texto).join(' | ').slice(0, 240)})`);
  await pg.keyboard.press('Escape'); await esperar(300);
  // corrigir a chegada para 10/12 (igual ao vencimento): o aviso desse registro some e o prazo gravado não muda
  await abrirDemanda(pg, NOME_P); await editarChegada(pg);
  await pg.fill('#d-chegou', '2026-12-10'); await esperar(300);
  ok(!(await pg.$('.modal [data-antes-chegada]')) && (await pg.inputValue('#d-prazo')) === '2026-12-10', 'aviso da chegada, edição: com a chegada igual ao prazo (10/12) a prévia não avisa e o prazo continua 10/12');
  await salvarSecao(pg);
  await abrirDemanda(pg, NOME_P);
  ler = await texto(pg, '.modal');
  ok(/Chegou em 10\/12\/2026/.test(ler) && ler.includes(`Vencimento ${dataComSemana('2026-12-10')}`) && !ler.includes('antes da chegada'), 'aviso da chegada: salva a chegada 10/12, o vencimento continua 10/12 e a consulta não avisa mais');
  await pg.keyboard.press('Escape'); await fechada(pg).catch(() => {});
  await ir(pg, '/', '.stat.st-atrasadas');
  itens = await itensSino(pg);
  ok(itens.length === 0 && /nenhum agora/.test((await sino(pg)).rotulo), 'aviso da chegada, sininho: corrigida a chegada (10/12), o aviso do registro sumiu');
  await pg.keyboard.press('Escape'); await esperar(300);
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
  // decisão 84: o aviso de vencimento antes da chegada (original 02/11 à mão, chegada 03/11, Finados: ajustado 30/10) fica visível e legível nesta tela
  await pg.fill('#n-chegou', '2026-11-03'); await pg.fill('#n-prazo', '2026-11-02'); await esperar(300);
  await pg.$eval('.modal [data-antes-chegada]', (e) => e.scrollIntoView({ block: 'center' })); await esperar(400);   // o aviso fica abaixo da dobra do formulário: rola até ele, como a pessoa faria, antes de medir e capturar
  const av = await pg.$eval('.modal [data-antes-chegada]', (e) => {
    const fundo = (el) => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; const m = c.match(/[\d.]+/g)?.map(Number); if (m && (m.length < 4 || m[3] > 0.5)) return m.slice(0, 3); } return [255, 255, 255]; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const b = e.querySelector('b') ?? e, cor = getComputedStyle(b).color.match(/[\d.]+/g).map(Number).slice(0, 3), bg = fundo(e), l1 = lum(cor), l2 = lum(bg);
    const r = e.getBoundingClientRect(), v = document.documentElement.clientWidth, ponto = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 12));
    return { visivel: !!ponto && e.contains(ponto), texto: e.textContent.trim(), contraste: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), esq: r.left >= -1, dir: r.right <= v + 1, alto: r.height > 8, fonte: parseFloat(getComputedStyle(b).fontSize), semRolagem: document.documentElement.scrollWidth <= v + 1 };
  });
  ok(av.texto === AVISO && av.visivel && av.esq && av.dir && av.alto && av.fonte >= 10 && av.contraste >= 4.5 && av.semRolagem, `${rot}: o aviso de vencimento antes da chegada está visível (nada o cobre) e inteiro na tela, com fonte de ${av.fonte.toFixed(1)} px, contraste ${av.contraste.toFixed(1)}:1 e sem rolagem lateral`);
  await pg.screenshot({ path: `${CAPTURAS}/aviso-chegada-${rot.replace(/\s+/g, '-')}.png` });
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
process.exit(resumo());
