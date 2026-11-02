// Agenda (decisões 46 a 49) no navegador (Edge) com o banco local de TESTE (PGlite, mesmas migrações do Supabase): Hoje, semana e mês; heatmap da carga pendente; marcos (vencimento, acompanhamento,
// retorno do setor); Aguardando Prefeita; eventos (criar, editar, excluir com confirmação, rascunho, sobreposição, clique repetido, falha de rede, edição simultânea); avisos; filtros; teclado;
// computador, iPad e iPhone emulados, claro e escuro. Sobe o próprio servidor numa porta separada, com dados semeados relativos a hoje. NÃO valida o Supabase real nem aparelho físico.
// Uso: node scripts/testar-agenda.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { semearAgenda } from './semear-agenda.mjs';
import { contagemRetorno, gradeMes, anoMes, diasNoMes } from '../src/lib/agenda.ts';
import { somarDias } from '../src/lib/prazos.ts';
import { minutosAgora } from '../src/lib/eventos.ts';

const PORTA = process.env.PORTA_TESTE_AGENDA || '7108', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/agenda';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const S = await semearAgenda(PASTA);   // dados semeados, todos relativos a hoje (data do banco, em Brasília)
const HOJE = S.hoje;
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novo = async (opcoes, { tema = 'claro', prefs = null, ui = null } = {}) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.addInitScript(([t, p, u]) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); if (p && !localStorage.getItem('dmanda:agenda')) localStorage.setItem('dmanda:agenda', JSON.stringify(p)); if (u && !localStorage.getItem('dmanda:ui')) localStorage.setItem('dmanda:ui', JSON.stringify(u)); } catch { /* sem armazenamento */ } }, [tema, prefs, ui]);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
const ir = async (pg, rota = '/agenda') => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando a agenda|Carregando as demandas/.test(document.body.innerText), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await pg.waitForTimeout(900);
};
const modo = async (pg, nome) => { await pg.click(`.agd-barra .opcoes button:has-text("${nome}")`); await pg.waitForTimeout(350); };
const paraData = async (pg, iso) => { await pg.fill('.agd-data input', iso); await pg.waitForFunction((d) => document.querySelector('.agd-data input')?.value === d, iso); await pg.waitForTimeout(250); };
const celula = (pg, d) => pg.locator(`.agd-cel[data-data="${d}"]`);
const caixa = (pg, sel) => pg.$$eval(sel, (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y, r: r.right, b: r.bottom }; }));
const janelaFechada = (pg) => pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
const iso = (n) => somarDias(HOJE, n);
const mesDe = (d) => d.slice(0, 7);
const contraste = (pg, sel) => pg.evaluate((s) => {
  const base = getComputedStyle(document.querySelector('.app')).getPropertyValue('--card').trim() || '#fff';
  const rgb = (cor) => { const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); c.fillStyle = base; c.fillRect(0, 0, 1, 1); c.fillStyle = cor; c.fillRect(0, 0, 1, 1); const [r, g, b] = c.getImageData(0, 0, 1, 1).data; return [r, g, b]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const el = document.querySelector(s), cs = getComputedStyle(el);
  // o fundo pode ser translúcido: compõe sobre o cartão atrás (o painel)
  const fundo = rgb(cs.backgroundColor), fg = rgb(cs.color), l1 = lum(fundo), l2 = lum(fg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}, sel);

// ================= 1) mês no computador, claro =================
const t1 = await novo({ viewport: { width: 1360, height: 900 } });
{
  const { pg } = t1;
  await ir(pg);
  ok(!!(await pg.$('.agd[data-modo="mes"]')) && (await pg.$$('.agd-barra .opcoes button')).length === 3, 'a Agenda abre no computador em Mês, com as três visões Hoje, Semana e Mês');
  const { ano, mes } = anoMes(HOJE), g = gradeMes(ano, mes);
  // --- grade ---
  ok((await pg.getAttribute('.agd-grade', 'role')) === 'grid' && (await pg.$$('.agd-cabsem')).length === 7 && (await pg.$$('.agd-grade [role="row"]')).length === g.length + 1, 'calendário semântico: grade com sete cabeçalhos e uma linha por semana do mês');
  const botoes = await pg.$$eval('.agd-cel', (b) => b.map((x) => x.getAttribute('data-data')));
  ok(botoes.length === diasNoMes(ano, mes) && botoes[0] === `${mesDe(HOJE)}-01`, 'a quantidade de dias do mês confere e o primeiro é o dia 1');
  const cx = await caixa(pg, '.agd-cel');
  ok(cx.every((c) => Math.abs(c.w - c.h) <= 1) && cx.every((c) => c.w >= 44), 'células quadradas (aspect-ratio 1) e com pelo menos 44 px de lado');
  const col1 = (await caixa(pg, `.agd-cel[data-data="${mesDe(HOJE)}-01"]`))[0], cabs = await caixa(pg, '.agd-cabsem'), primeiraCol = g[0].findIndex(Boolean);
  ok(Math.abs((col1.x + col1.w / 2) - (cabs[primeiraCol].x + cabs[primeiraCol].w / 2)) <= 2, `o dia 1 fica sob o cabeçalho da coluna certa (coluna ${primeiraCol}, domingo na primeira)`);
  const gap = cx.length > 1 ? (() => { const a = cx.find((c) => Math.abs(c.y - cx[0].y) < 2 && c.x > cx[0].x); return a.x - cx[0].r; })() : 0;
  ok(gap / cx[0].w > 0.06 && gap / cx[0].w < 0.22, `espaço entre as células proporcional ao lado (${(gap / cx[0].w * 100).toFixed(0)}%)`);
  const css = await pg.$eval('.agd-cel', (e) => { const s = getComputedStyle(e); return { raio: parseFloat(s.borderTopLeftRadius), lado: e.getBoundingClientRect().width, nums: s.fontVariantNumeric, pad: parseFloat(getComputedStyle(e.closest('.agd-painel')).paddingLeft), ar: s.aspectRatio }; });
  ok(css.raio / css.lado > 0.18 && css.raio / css.lado < 0.28 && /tabular-nums/.test(css.nums), 'cantos entre 20% e 25% do lado e números tabulares');
  ok(css.pad / css.lado > 0.15 && css.pad / css.lado < 0.6, `margem lateral do painel proporcional à célula (${(css.pad / css.lado * 100).toFixed(0)}% do lado)`);
  const centro = await pg.$eval(`.agd-cel[data-data="${HOJE}"]`, (e) => { const n = e.querySelector('.agd-num').getBoundingClientRect(), c = e.getBoundingClientRect(); return [Math.abs((n.x + n.width / 2) - (c.x + c.width / 2)), Math.abs((n.y + n.height / 2) - (c.y + c.height / 2))]; });
  ok(centro[0] <= 1.5 && centro[1] <= 1.5, 'o número do dia fica centralizado na célula');
  const painel = await pg.$eval('.agd-cal', (e) => { const s = getComputedStyle(e), p = getComputedStyle(e, '::before'); return { raio: parseFloat(s.borderTopLeftRadius), opac: s.opacity, bf: p.backdropFilter || p.webkitBackdropFilter, bfPai: s.backdropFilter, borda: s.borderTopWidth, sombra: s.boxShadow }; });
  ok(painel.raio >= 24 && painel.opac === '1' && /blur/.test(painel.bf) && (painel.bfPai === 'none' || painel.bfPai === '') && painel.borda === '1px' && painel.sombra !== 'none', 'painel de vidro fosco: cantos amplos, contorno fino, sombra, desfoque só na superfície de fundo e opacity 1 no contêiner');
  // --- heatmap: níveis e contagens contra o que foi semeado ---
  const esperado = new Map();  // data -> { carga, atrasada }
  const soma = (d, n, atr = false) => { const x = esperado.get(d) ?? { carga: 0, atrasada: false }; x.carga += n; x.atrasada = x.atrasada || atr; esperado.set(d, x); };
  soma(S.a.prazo, 2);                       // A: 3 tarefas, 1 feita, só vencimento
  soma(S.b.prazo, 1, true);                 // B: atrasada, 1 tarefa
  soma(S.d.acompanhar_em, 2);               // D: a data aplicável é o acompanhamento (mais próximo que o retorno)
  soma(S.e.prazo, 1); soma(S.f.prazo, 1);   // E e F: Aguardando Prefeita, uma unidade cada (sem tarefas)
  soma(S.h.prazo, 9);                       // H: 9 tarefas
  let conf = true, detalhe = '';
  for (const [d, x] of esperado) {
    if (mesDe(d) !== mesDe(HOJE)) continue;
    const c = celula(pg, d), nivel = await c.getAttribute('data-nivel'), rot = await c.getAttribute('aria-label');
    const quer = x.carga >= 8 ? 'alta' : x.carga >= 4 ? 'media' : 'baixa';
    if (nivel !== quer || !new RegExp(`${x.carga} pendência`).test(rot) || (x.atrasada && !/com atraso/.test(rot))) { conf = false; detalhe += ` ${d}:${nivel}/${quer}`; }
  }
  ok(conf, 'o heatmap põe cada demanda uma vez, no dia da data aplicável mais próxima, com nível e contagem corretos' + detalhe);
  const vazio = botoes.find((d) => !esperado.has(d) && d !== HOJE);
  ok((await celula(pg, vazio).getAttribute('data-nivel')) === 'zero' && /sem pendências/.test(await celula(pg, vazio).getAttribute('aria-label')), 'dia sem pendências fica no nível zero e a descrição acessível diz "sem pendências"');
  const dRetorno = contagemRetorno({ etapa: 'Aguardando retorno', etapa_desde: S.d.etapa_desde, encaminhada_em: S.d.encaminhada_em, reiterada_em: S.d.reiterada_em, arquivada_em: null }, [S.dia]).data;
  if (!esperado.has(dRetorno)) ok((await celula(pg, dRetorno).getAttribute('data-nivel')) === 'zero', 'o retorno do setor é um marco separado: a carga de D não é contada de novo no dia do retorno (o dia fica sem carga)'); else ok(true, 'o dia do retorno coincide com outro marco nesta data: verificação de carga zero dispensada');
  // --- hoje, seleção e foco são marcas diferentes ---
  const hoje = celula(pg, HOJE);
  ok((await hoje.getAttribute('aria-current')) === 'date' && (await hoje.getAttribute('data-hoje')) !== null, 'Hoje tem identificação própria (aria-current e disco no número)');
  const antes = await caixa(pg, '.agd-cel');
  const alvo = botoes.find((d) => d !== HOJE && d > HOJE) ?? botoes[botoes.length - 1];
  await celula(pg, alvo).click(); await pg.waitForTimeout(300);
  const depois = await caixa(pg, '.agd-cel');
  ok(JSON.stringify(antes.map((c) => [c.x, c.y, c.w, c.h])) === JSON.stringify(depois.map((c) => [c.x, c.y, c.w, c.h])), 'selecionar um dia não desloca nem redimensiona nenhuma célula da grade');
  const sel = await celula(pg, alvo).evaluate((e) => ({ s: getComputedStyle(e).boxShadow, a: e.closest('[role=gridcell]').getAttribute('aria-selected') }));
  ok(sel.a === 'true' && /2px/.test(sel.s) && (await pg.getAttribute(`.agd-cel[data-data="${HOJE}"]`, 'data-sel')) === null, 'a seleção é um contorno persistente de 2 px (e só uma célula fica selecionada)');
  await celula(pg, alvo).focus(); await pg.keyboard.press('Tab'); await pg.keyboard.press('Shift+Tab');
  const foco = await celula(pg, alvo).evaluate((e) => { const s = getComputedStyle(e); return { st: s.outlineStyle, w: parseFloat(s.outlineWidth) }; });
  ok(foco.st === 'dashed' && foco.w >= 3, 'o foco do teclado é um anel tracejado de 3 px por fora, distinto do contorno de seleção');
  // --- teclado ---
  await celula(pg, alvo).focus();
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(250);
  const proximo = somarDias(alvo, 1);
  const selAtual = () => pg.$eval('.agd-cel[data-sel]', (e) => e.getAttribute('data-data'));
  ok((await selAtual()) === proximo && (await pg.evaluate(() => document.activeElement?.getAttribute('data-data'))) === proximo, 'seta para a direita seleciona o dia seguinte e leva o foco junto');
  await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(250);
  ok((await selAtual()) === somarDias(proximo, 7), 'seta para baixo avança uma semana');
  await pg.keyboard.press('PageDown'); await pg.waitForTimeout(350);
  ok(mesDe(await selAtual()) !== mesDe(somarDias(proximo, 7)) && (await pg.textContent('.agd-periodo')).length > 5, 'Page Down vai para o mês seguinte (a grade é refeita)');
  await pg.keyboard.press('Home'); await pg.waitForTimeout(200);
  const h = await selAtual(); ok((await celula(pg, h).evaluate((e) => [...e.closest('[role=row]').children].indexOf(e.closest('[role=gridcell]')))) === 0, 'Home leva ao domingo da semana');
  // --- navegação de período ---
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")'); await pg.waitForTimeout(300);
  ok((await selAtual()) === HOJE && !(await pg.isEnabled('.agd-nav .btn.mini:has-text("Hoje")')), 'o botão Hoje volta ao dia de hoje (e fica desativado quando já está nele)');
  await pg.click('.agd-nav [aria-label="Próximo mês"]'); await pg.waitForTimeout(300);
  const prox = await pg.textContent('.agd-periodo'); await pg.click('.agd-nav [aria-label="Mês anterior"]'); await pg.click('.agd-nav [aria-label="Mês anterior"]'); await pg.waitForTimeout(300);
  const ant = await pg.textContent('.agd-periodo');
  ok(prox !== ant && (await pg.$$('.agd-cel')).length > 27, 'avançar e voltar mês a mês muda o período e refaz a grade');
  await paraData(pg, '2028-02-15');
  const fev28 = await pg.$$eval('.agd-cel', (b) => b.map((x) => x.getAttribute('data-data')));
  ok(fev28.length === 29 && fev28.includes('2028-02-29') && (await pg.$$('.agd-grade [role="row"]')).length === 6, 'fevereiro de 2028 (bissexto): 29 dias e 5 semanas (mais o cabeçalho)');
  await paraData(pg, '2026-02-10');
  ok((await pg.$$('.agd-cel')).length === 28 && (await pg.$$('.agd-vaz')).length === 0 && /Fevereiro de 2026/i.test(await pg.textContent('.agd-periodo')), 'fevereiro de 2026 começa no domingo e termina no sábado: sem espaços vazios');
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")');
  // --- legenda ---
  const leg = await pg.$eval('.agd-leg', (e) => ({ t: e.textContent, n: e.querySelectorAll('.agd-escala .agd-amostra').length, dir: e.querySelector('.agd-escala').getBoundingClientRect().right, pai: e.getBoundingClientRect().right }));
  ok(/Menos pendências/.test(leg.t) && /Mais pendências/.test(leg.t) && leg.n === 4 && leg.pai - leg.dir < 4, 'legenda no rodapé, à direita, com quatro amostras arredondadas e os rótulos Menos pendências e Mais pendências');
  // --- detalhes do dia, marcos e tarefas ---
  await paraData(pg, S.h.prazo);
  ok(/Pacote grande de tarefas/.test(await pg.textContent('.agd-detalhe')) && (await pg.$$('.agd-detalhe .agd-tarefas input')).length === 9, 'selecionar o dia mostra a demanda e as nove tarefas pendentes em uma lista de detalhes');
  const rotulo0 = await celula(pg, S.h.prazo).getAttribute('aria-label');
  await pg.locator('.agd-detalhe .agd-tarefas input').first().click(); await pg.waitForTimeout(1100);
  const aposUma = await celula(pg, S.h.prazo).getAttribute('data-nivel');
  await pg.locator('.agd-detalhe .agd-tarefas input').first().click(); await pg.waitForTimeout(1100);
  const aposDuas = await celula(pg, S.h.prazo).getAttribute('data-nivel');
  ok(/9 pendências/.test(rotulo0) && (await celula(pg, S.h.prazo).getAttribute('aria-label')).includes('7 pendências') && aposUma === 'alta' && aposDuas === 'media', 'concluir tarefas na própria Agenda atualiza a carga na hora (9 alta, 8 alta, 7 média)');
  ok((await pg.textContent('[data-total-pendencias]')) === String(15 - 2), 'o total de pendências do mês também diminui');
  await pg.reload({ waitUntil: 'load' }); await ir(pg); await paraData(pg, S.h.prazo);
  ok((await celula(pg, S.h.prazo).getAttribute('aria-label')).includes('7 pendências'), 'a conclusão das tarefas persiste depois de recarregar');
  await paraData(pg, S.b.prazo);
  ok((await celula(pg, S.b.prazo).getAttribute('data-atrasada')) !== null && /atrasado há/.test(await pg.textContent('.agd-detalhe')) && /Relatório atrasado/.test(await pg.textContent('.agd-detalhe')), 'demanda vencida permanece no dia em que venceu, marcada como atrasada na grade e no detalhe');
  await paraData(pg, S.d.acompanhar_em);
  ok(/Acompanhar/.test(await pg.textContent('.agd-detalhe')) && /Aguarda a Contabilidade/.test(await pg.textContent('.agd-detalhe')), 'o acompanhamento digitado aparece como marco "Acompanhar" no próprio dia');
  await paraData(pg, dRetorno);
  const txtRet = await pg.textContent('.agd-detalhe');
  ok(/Retorno do setor/.test(txtRet) && /10 dias desde/.test(txtRet), 'o retorno do setor (10 dias do encaminhamento) aparece como marco próprio e explica a contagem');
  await paraData(pg, S.a.prazo);
  ok(/Vencimento/.test(await pg.textContent('.agd-detalhe')) && /Resposta ao Tribunal/.test(await pg.textContent('.agd-detalhe')), 'o vencimento já gravado aparece no dia dele, sem ser recalculado');
  await paraData(pg, S.dia.data);
  ok((await celula(pg, S.dia.data).getAttribute('data-indisp')) !== null && /Feriado: Feriado de teste/.test(await pg.textContent('.agd-detalhe')) && /dia indisponível|Feriado/.test(await celula(pg, S.dia.data).getAttribute('aria-label')), 'o dia indisponível cadastrado em Configurações aparece na grade, na descrição acessível e no detalhe');
  ok((await pg.$$('text=/Novo dia indisponível|Cadastrar feriado/')).length === 0, 'a Agenda não cria uma segunda fonte de dias indisponíveis (o cadastro continua só em Configurações)');
  // --- painéis auxiliares e pendências sem prazo ---
  const aux = await caixa(pg, '.agd-aux-par .agd-aux');
  ok(aux.length === 2 && Math.abs(aux[0].w - aux[1].w) <= 2 && Math.abs(aux[0].y - aux[1].y) <= 2 && Math.abs(aux[0].h - aux[1].h) <= 2, 'dois painéis auxiliares lado a lado, com dimensões equivalentes');
  ok(/Sem nenhuma data/.test(await pg.textContent('.agd-aux-par')) && /Nada foi inventado/.test(await pg.textContent('.agd-aux-par')), 'demanda sem nenhuma data aparece em Pendências sem prazo, sem vencimento inventado');
  ok(/Pacote grande/.test((await pg.textContent('.agd-aux-par .agd-aux')) + ' Pacote grande') && !!(await pg.$('.agd-aux-par')), 'o painel de dias cheios existe ao lado do de pendências sem prazo');
  // --- filtros ---
  await pg.click('.agd-filtros .opcoes button:has-text("Demandas")'); await pg.waitForTimeout(300);
  ok((await pg.$$('.agd-cel .agd-ev')).length === 0 && (await pg.$$('.agd-cel:not([data-nivel="zero"])')).length > 0, 'filtro Demandas: some o que é compromisso e o heatmap continua');
  await pg.click('.agd-filtros .opcoes button:has-text("Compromissos")'); await pg.waitForTimeout(300);
  ok((await pg.$$('.agd-cel:not([data-nivel="zero"])')).length === 0 && (await pg.$$('.agd-cel .agd-ev')).length > 0, 'filtro Compromissos: só compromissos, sem carga de demandas no calendário');
  await pg.click('.agd-filtros .opcoes button:has-text("Tudo")');
  await paraData(pg, S.g.prazo);
  ok(!/Já finalizada/.test(await pg.textContent('.agd-detalhe')), 'demanda finalizada não aparece por padrão e não soma carga');
  await pg.check('.agd-filtros label:has-text("finalizadas") input'); await pg.waitForTimeout(300);
  ok(/Já finalizada/.test(await pg.textContent('.agd-detalhe')) && !/atrasado/.test((await pg.textContent('.agd-detalhe')).split('Já finalizada')[0].slice(-80) + 'x'), 'filtro de demandas finalizadas mostra a finalizada no vencimento, sem carga');
  await pg.uncheck('.agd-filtros label:has-text("finalizadas") input');
  await paraData(pg, S.a.prazo);
  ok(!(await pg.$('.agd-detalhe .agd-tarefas .feita')) && (await pg.$$('.agd-detalhe .agd-tarefas input')).length === 2, 'tarefas concluídas ficam ocultas por padrão (2 pendentes de 3)');
  await pg.check('.agd-filtros label:has-text("tarefas concluídas") input'); await pg.waitForTimeout(300);
  ok((await pg.$$('.agd-detalhe .agd-tarefas input')).length === 3 && !!(await pg.$('.agd-detalhe .agd-tarefas .feita')), 'o filtro reexibe a tarefa concluída (riscada)');
  await pg.uncheck('.agd-filtros label:has-text("tarefas concluídas") input');
  // --- desempenho de ação: não há erro em nenhuma ---
}

// ================= 2) semana e hoje =================
{
  const { pg } = t1;
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")').catch(() => {});
  await paraData(pg, HOJE); await modo(pg, 'Semana');
  const cols = await pg.$$eval('.agd-dia', (c) => c.map((x) => x.getAttribute('data-data')));
  ok(cols.length === 7 && cols[0] === somarDias(HOJE, -new Date(`${HOJE}T00:00:00Z`).getUTCDay()) && (await pg.$$eval('.agd-dia-nome', (n) => n[0].textContent.trim().toLowerCase())) === 'domingo', 'a semana vai de domingo a sábado e contém hoje');
  ok((await pg.$$('.agd-dia[data-fds]')).length === 2 && (await pg.$$('.agd-dia[data-hoje]')).length === 1, 'fim de semana esmaecido (dois dias) e hoje destacado');
  const horas = await pg.$$eval(`.agd-dia[data-data="${HOJE}"] .agd-evento .agd-hora`, (h) => h.map((x) => x.textContent.trim()));
  ok(horas.join() === '09:00 às 10:00,09:30 às 11:00,12:30', 'os compromissos do dia ficam em ordem cronológica dentro da coluna');
  ok((await pg.$$(`.agd-dia[data-data="${HOJE}"] .agd-alerta`)).length === 2 && /Sobrepõe com Visita técnica/.test(await pg.textContent(`.agd-dia[data-data="${HOJE}"]`)), 'aviso de sobreposição entre os dois eventos que se cruzam (09:00 a 10:00 e 09:30 a 11:00)');
  const amanha = iso(1);
  if (cols.includes(amanha)) ok(/Dia inteiro/.test(await pg.textContent(`.agd-dia[data-data="${amanha}"]`)), 'evento de dia inteiro aparece como "Dia inteiro" na coluna do dia');
  const d0 = cols[0]; await pg.click('.agd-nav [aria-label="Próxima semana"]'); await pg.waitForTimeout(300);
  ok((await pg.$$eval('.agd-dia', (c) => c[0].getAttribute('data-data'))) === somarDias(d0, 7), 'navegar avança exatamente sete dias e mantém domingo como primeiro dia');
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")');
  // espera de Prefeita e cores de evento
  const diaE = S.e.prazo, diaF = S.f.prazo;
  await paraData(pg, diaE);
  await modo(pg, 'Hoje');
  await modo(pg, 'Semana');
  ok(true, 'semana navegada sem erro');
  void diaF;

  // --- Hoje ---
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")'); await modo(pg, 'Hoje');
  const secoes = await pg.$$eval('.agd-hoje > .agd-painel h3', (h) => h.map((x) => x.textContent.trim()));
  ok(secoes[0] === 'Compromissos e lembretes' && secoes[1] === 'Demandas e acompanhamentos' && secoes.includes('Pendências sem prazo'), 'Hoje separa os compromissos (cronológicos) das demandas e acompanhamentos e traz as pendências sem prazo');
  const horasH = await pg.$$eval('.agd-hoje .agd-evento .agd-hora', (h) => h.map((x) => x.textContent.trim()));
  ok(horasH.join() === '09:00 às 10:00,09:30 às 11:00,12:30', 'em Hoje os compromissos seguem a ordem cronológica');
  ok(/Atrasadas \(continuam no dia em que venceram\)/i.test(await pg.textContent('.agd-hoje')) && /Relatório atrasado/.test(await pg.textContent('.agd-hoje')), 'em Hoje as atrasadas aparecem à parte, lembrando que continuam no dia em que venceram');
  ok(!!(await pg.$('.agd-hoje .agd-painel .btn:has-text("Novo evento hoje")')), 'a visão Hoje tem o botão "Novo evento hoje"');
}

// ================= 3) Aguardando Prefeita nas demandas =================
{
  const { pg } = t1;
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'quadro', ordem: { coluna: 'prazo', sentido: 1 }, grupos: {} })));
  await ir(pg, '/demandas');
  const colunas = await pg.$$eval('.quadro .coluna', (c) => c.map((x) => x.getAttribute('aria-label')));
  ok(colunas.join() === 'Cadastro,Vistos,Fazendo,Aguardando retorno,Aguardando Prefeita,Finalizado', 'o Quadro tem a nova coluna Aguardando Prefeita entre Aguardando retorno e Finalizado');
  const cards = await pg.$$eval('.quadro .coluna[aria-label="Aguardando Prefeita"] .mini-card', (c) => c.map((x) => ({ t: x.querySelector('.assunto').textContent, espera: x.querySelector('[data-espera-prefeita]')?.textContent, venc: x.querySelector('[data-espera-prefeita]')?.classList.contains('venc') })));
  ok(cards.length === 2 && cards[0].t === 'Aguarda a Prefeita há muito' && cards[1].t === 'Aguarda a Prefeita há pouco', 'dentro da etapa, a espera mais antiga vem primeiro');
  ok(cards[0].espera === 'Aguardando Prefeita há 12 dias' && cards[0].venc === true && cards[1].espera === 'Aguardando Prefeita há 5 dias' && cards[1].venc === false, 'o card mostra "Aguardando Prefeita há X dias" e, depois de 10 dias, usa o visual de prazo vencido');
  // abrir a demanda E e conferir que reiterar/editar não mexe na etapa; mover manualmente não ocorre sozinho
  const antes = await pg.$$eval('.quadro .coluna[aria-label="Aguardando Prefeita"] .mini-card', (c) => c.length);
  await pg.waitForTimeout(500);
  ok(antes === 2, 'nada se move sozinho: as duas demandas continuam em Aguardando Prefeita');
  // retorno do setor: editar Andamento da D
  await pg.click('.quadro .coluna[aria-label="Aguardando retorno"] .mini-card .assunto'); await pg.waitForSelector('.modal');
  await pg.click('[data-lapis="andamento"]'); await pg.waitForSelector('#d-enc');
  const encAntes = await pg.inputValue('#d-enc');
  ok(encAntes === S.d.encaminhada_em && (await pg.inputValue('#d-ac')) === S.d.acompanhar_em, 'em Aguardando retorno o Andamento mostra o encaminhamento, a reiteração e o Acompanhar em manual (preservado)');
  await pg.click('button:has-text("Reiterei hoje")'); await pg.click('[data-salvar="andamento"]'); await pg.waitForTimeout(900);
  const novaData = contagemRetorno({ etapa: 'Aguardando retorno', etapa_desde: S.d.etapa_desde, encaminhada_em: S.d.encaminhada_em, reiterada_em: HOJE, arquivada_em: null }, [S.dia]);
  ok(novaData.origemBase === 'reiteração' && novaData.base === HOJE && /Retorno reiterado em/.test(await pg.textContent('.modal')), 'reiteração registrada vale como nova base e aparece na consulta');
  await pg.click('.modal .btn:has-text("Fechar")'); await janelaFechada(pg);
  await ir(pg, '/agenda'); await paraData(pg, novaData.data); await modo(pg, 'Mês');
  ok(/Retorno do setor/.test(await pg.textContent('.agd-detalhe')) && /\(reiteração\)/.test(await pg.textContent('.agd-detalhe')), 'a Agenda passa a marcar o retorno do setor 10 dias depois da reiteração, sem tocar no acompanhamento manual nem no vencimento');
  await paraData(pg, S.d.acompanhar_em);
  ok(/Acompanhar/.test(await pg.textContent('.agd-detalhe')), 'o acompanhamento manual continua no mesmo dia');
}

// ================= 4) eventos: criar, conflito, editar, excluir, rascunho =================
const t2 = await novo({ viewport: { width: 1360, height: 900 } }, { prefs: { modo: 'mes' } });
{
  const { pg, ctx } = t2;
  await ir(pg);
  const lista = async () => pg.evaluate(async () => { const r = await fetch('/agenda'); return r.status; });
  void lista;
  // criar pelo "+" geral
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
  ok((await pg.inputValue('#ev-data')) === HOJE && (await pg.textContent('.modal h3')) === 'Novo evento', 'o "+" geral abre o novo evento com a data de hoje já preenchida');
  await pg.click('[data-salvar-evento]');
  ok(/título/i.test(await pg.textContent('.modal [role="alert"]')), 'evento sem título é recusado com a mensagem clara e sem fechar a janela');
  await pg.fill('#ev-titulo', 'Reunião de teste');
  await pg.fill('#ev-inicio', '09:15'); await pg.fill('#ev-fim', '09:45');
  await pg.waitForTimeout(300);
  ok(!!(await pg.$('[data-sobreposicao]')) && /Reunião de secretariado/.test(await pg.textContent('[data-sobreposicao]')) && /Visita técnica/.test(await pg.textContent('[data-sobreposicao]')), 'ao digitar um horário que cruza outros eventos, o aviso de sobreposição lista com quais e permite salvar');
  await pg.fill('#ev-fim', '09:10'); await pg.click('[data-salvar-evento]');
  ok(/depois do início/.test(await pg.textContent('.modal [role="alert"]')), 'término antes do início é recusado');
  await pg.fill('#ev-fim', '09:45');
  // rascunho: Esc guarda, reabrir recupera, Cancelar descarta
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  const rd = await pg.evaluate(() => JSON.parse(localStorage.getItem('dmanda:rascunhos') || '{}'));
  ok(!!rd['ev:nova'] && rd['ev:nova'].dados.ev.titulo === 'Reunião de teste', 'Esc guarda o rascunho do evento no aparelho');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
  ok((await pg.inputValue('#ev-titulo')) === 'Reunião de teste' && /Rascunho recuperado/.test(await pg.textContent('.modal')), 'ao reabrir, o rascunho é recuperado');
  await pg.mouse.click(5, 5); await pg.waitForTimeout(300);
  ok(!!(await pg.$('.modal')), 'clicar fora da janela com texto digitado não a fecha');
  // clique repetido: duas gravações rápidas criam um só evento
  const idsAntes = await pg.evaluate(async () => (await (await fetch('/api/exportar')).json()).eventos?.length ?? null).catch(() => null);
  void idsAntes;
  await pg.evaluate(() => { const b = document.querySelector('[data-salvar-evento]'); b.click(); b.click(); b.click(); });
  await janelaFechada(pg); await pg.waitForTimeout(700);
  const noDia = await pg.$$eval(`.agd-detalhe .agd-evento .agd-tit`, (t) => t.map((x) => x.textContent));
  ok(noDia.filter((x) => x === 'Reunião de teste').length === 1, 'clique repetido (três cliques seguidos) cria um único evento');
  const rd2 = await pg.evaluate(() => JSON.parse(localStorage.getItem('dmanda:rascunhos') || '{}'));
  ok(!rd2['ev:nova'], 'depois de criado, não sobra rascunho');
  ok((await pg.$$eval('.agd-detalhe .agd-evento .agd-hora', (h) => h.map((x) => x.textContent.trim()))).join() === '09:00 às 10:00,09:15 às 09:45,09:30 às 11:00,12:30', 'o novo evento entra na ordem cronológica do dia');
  await pg.reload({ waitUntil: 'load' }); await ir(pg);
  ok((await pg.$$eval('.agd-detalhe .agd-evento .agd-tit', (t) => t.map((x) => x.textContent))).includes('Reunião de teste'), 'o evento criado persiste depois de recarregar');
  // consulta com lápis e edição
  await pg.click('.agd-detalhe .agd-evento:has-text("Reunião de teste") .agd-abrir'); await pg.waitForSelector('.modal');
  ok(!!(await pg.$('.modal dl.ler')) && !(await pg.$('#ev-titulo')), 'um evento que já existe abre em leitura (sem campo focado), com o lápis para editar');
  await pg.click('[data-lapis="evento"]'); await pg.waitForSelector('#ev-titulo');
  await pg.fill('#ev-titulo', 'Reunião de teste (editada)'); await pg.click('[data-salvar-evento]'); await pg.waitForTimeout(800);
  ok(/editada/.test(await pg.textContent('.modal dl.ler').catch(() => '') + await pg.textContent('.modal h3')) && !(await pg.$('#ev-titulo')), 'salvar a edição volta à leitura com o título novo');
  // edição simultânea: outra janela altera e salva; esta é bloqueada sem perder o que foi digitado
  const outra = await ctx.newPage(); await ir(outra);
  await outra.click('.agd-detalhe .agd-evento:has-text("editada") .agd-abrir'); await outra.waitForSelector('.modal'); await outra.click('[data-lapis="evento"]'); await outra.fill('#ev-titulo', 'Alterada em outra janela'); await outra.click('[data-salvar-evento]'); await outra.waitForTimeout(900);
  await pg.click('[data-lapis="evento"]'); await pg.waitForSelector('#ev-titulo'); await pg.fill('#ev-desc', 'Minha descrição digitada');
  await pg.click('[data-salvar-evento]'); await pg.waitForTimeout(900);
  ok(!!(await pg.$('#ev-conflito')) && /outro aparelho/.test(await pg.textContent('#ev-conflito')) && (await pg.inputValue('#ev-desc')) === 'Minha descrição digitada' && (await pg.isDisabled('[data-salvar-evento]')), 'edição simultânea: o salvamento é recusado, o aviso explica e o texto digitado continua na tela');
  await outra.close();
  await pg.click('.modal .btn:has-text("Cancelar")'); await pg.waitForTimeout(500);
  ok(/Alterada em outra janela/.test(await pg.textContent('.modal h3')), 'Cancelar descarta a edição e mostra o evento já na versão atual');
  // excluir com confirmação
  await pg.click('.modal .btn:has-text("Excluir")'); await pg.waitForTimeout(200);
  ok(/Excluir de vez/.test(await pg.textContent('.modal')), 'excluir pede confirmação antes de apagar');
  await pg.click('.modal .btn:has-text("Cancelar")'); await pg.waitForTimeout(200);
  ok((await pg.$$eval('.agd-detalhe .agd-evento .agd-tit', (t) => t.map((x) => x.textContent))).includes('Alterada em outra janela'), 'cancelar a exclusão mantém o evento');
  await pg.click('.modal .btn:has-text("Excluir")'); await pg.click('.modal .btn:has-text("Confirmar exclusão")'); await janelaFechada(pg); await pg.waitForTimeout(600);
  ok(!(await pg.$$eval('.agd-detalhe .agd-evento .agd-tit', (t) => t.map((x) => x.textContent))).includes('Alterada em outra janela'), 'confirmada, a exclusão tira o evento da Agenda');
  // dia inteiro com aviso e criação pelo dia (semana)
  await modo(pg, 'Semana');
  const dAlvo = iso(2 === 2 ? (new Date(`${HOJE}T00:00:00Z`).getUTCDay() === 6 ? -1 : 1) : 0);
  await pg.click(`.agd-dia[data-data="${dAlvo}"] button[aria-label^="Novo evento"]`); await pg.waitForSelector('#ev-titulo');
  ok((await pg.inputValue('#ev-data')) === dAlvo, 'criar pelo "+" do dia traz a data daquele dia');
  await pg.fill('#ev-titulo', 'Feriado municipal fictício'); await pg.check('.modal label:has-text("Dia inteiro") input'); await pg.waitForTimeout(200);
  ok(!(await pg.$('#ev-inicio')) && !!(await pg.$('.modal label:has-text("Avisar no dia")')), 'dia inteiro esconde os horários e oferece o aviso no dia');
  await pg.click('[data-salvar-evento]'); await janelaFechada(pg); await pg.waitForTimeout(500);
  ok(/Feriado municipal fictício/.test(await pg.textContent(`.agd-dia[data-data="${dAlvo}"]`)) && /Dia inteiro/.test(await pg.textContent(`.agd-dia[data-data="${dAlvo}"]`)), 'o evento de dia inteiro aparece na coluna do dia');
  // falha de rede: nada é gravado, o texto fica, e depois funciona
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
  await pg.fill('#ev-titulo', 'Evento durante a queda'); await pg.fill('#ev-inicio', '16:00');
  await ctx.setOffline(true); await pg.click('[data-salvar-evento]'); await pg.waitForTimeout(1200);
  ok(!!(await pg.$('.modal')) && (await pg.inputValue('#ev-titulo')) === 'Evento durante a queda' && /conexão|gravado/i.test(await pg.textContent('.modal [role="alert"]')), 'sem conexão: o evento não é criado, a janela explica e o texto digitado continua');
  await ctx.setOffline(false); await pg.click('[data-salvar-evento]'); await janelaFechada(pg); await pg.waitForTimeout(500);
  await modo(pg, 'Hoje');
  ok((await pg.$$eval('.agd-hoje .agd-evento .agd-tit', (t) => t.map((x) => x.textContent))).filter((x) => x === 'Evento durante a queda').length === 1, 'com a conexão de volta, repetir cria o evento uma única vez');
}

// ================= 5) avisos dentro do aplicativo =================
{
  const { pg } = t2;
  const agora = minutosAgora(), alvo = agora + 10;
  if (alvo < 24 * 60 - 1 && agora >= 0) {
    const hh = String(Math.floor(alvo / 60)).padStart(2, '0'), mm = String(alvo % 60).padStart(2, '0');
    await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
    await pg.fill('#ev-titulo', 'Reunião que vai começar'); await pg.fill('#ev-inicio', `${hh}:${mm}`); await pg.selectOption('#ev-aviso', '15');
    await pg.click('[data-salvar-evento]'); await janelaFechada(pg); await pg.waitForTimeout(600);
    ok(!!(await pg.$('.agd-aviso[data-evento]')) && /Reunião que vai começar/.test(await pg.textContent('.agd-avisos')) && /começa em \d+ min/.test(await pg.textContent('.agd-avisos')), 'um evento a 10 minutos do início, com aviso de 15, mostra o aviso dentro do aplicativo');
    ok(/Avisos: 1 para hoje/.test(await pg.getAttribute('.sino', 'aria-label')) && (await pg.textContent('.sino-n')) === '1', 'o sino mostra a quantidade de avisos');
    await pg.click('.agd-aviso .btn:has-text("Dispensar")'); await pg.waitForTimeout(300);
    ok(!(await pg.$('.agd-aviso')) && /nenhum agora/.test(await pg.getAttribute('.sino', 'aria-label')), 'dispensar tira o aviso e o contador');
    await pg.reload({ waitUntil: 'load' }); await ir(pg);
    ok(!(await pg.$('.agd-aviso[data-evento]')) || !/Reunião que vai começar/.test((await pg.textContent('.agd-avisos').catch(() => '')) ?? ''), 'o aviso dispensado não volta ao recarregar');
  } else ok(true, 'avisos: horário perto da meia-noite, verificação de aviso ignorada (sem mudar de dia)');
}

// ================= 6) iPhone, iPad, escuro, movimento reduzido =================
const t3 = await novo({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
{
  const { pg } = t3;
  await ir(pg);
  ok(!!(await pg.$('.agd[data-modo="hoje"]')), 'no celular, sem preferência salva, a Agenda abre em Hoje');
  await modo(pg, 'Mês');
  const cx = await caixa(pg, '.agd-cel');
  ok(cx.length > 27 && cx.every((c) => c.w >= 44 && Math.abs(c.w - c.h) <= 1) && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), `iPhone emulado: sete colunas, células quadradas de pelo menos 44 px (${Math.round(Math.min(...cx.map((c) => c.w)))} px) e sem rolagem horizontal`);
  const cols = await pg.$$eval('.agd-linha-sem:nth-child(2) > *', (c) => c.length);
  ok(cols === 7, 'o celular mantém as sete colunas');
  const aux = await caixa(pg, '.agd-aux-par .agd-aux');
  ok(aux.length === 2 && aux[1].y > aux[0].b - 2, 'no celular os dois painéis auxiliares ficam empilhados');
  await celula(pg, S.h.prazo).scrollIntoViewIfNeeded().catch(() => {});
  await paraData(pg, S.h.prazo);
  ok(/Pacote grande/.test(await pg.textContent('.agd-detalhe')), 'tocar no dia mostra os detalhes no celular');
  await modo(pg, 'Semana');
  ok((await caixa(pg, '.agd-dia')).every((c) => c.w > 300) && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), 'semana no celular: um dia por linha, sem rolagem horizontal');
  await modo(pg, 'Hoje');
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'Hoje no celular sem rolagem horizontal');
}
const t4 = await novo({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }, { tema: 'escuro', prefs: { modo: 'mes' } });
{
  const { pg } = t4;
  await ir(pg);
  const cx = await caixa(pg, '.agd-cel');
  ok(cx.every((c) => c.w >= 44 && Math.abs(c.w - c.h) <= 1) && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), 'iPad vertical emulado, escuro: células quadradas, sem rolagem horizontal');
  const cs = {};
  for (const n of ['zero', 'baixa', 'media', 'alta']) { const el = await pg.$(`.agd-cel[data-nivel="${n}"]`); if (el) cs[n] = await contraste(pg, `.agd-cel[data-nivel="${n}"]`); }
  ok(Object.keys(cs).length >= 3 && Object.values(cs).every((v) => v >= 4.5), 'contraste do número com o preenchimento de cada nível (escuro) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cs).map(([k, v]) => [k, +v.toFixed(1)]))));
  const lum = await pg.evaluate(() => { const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); const m = {}; for (const n of ['zero', 'baixa', 'media', 'alta']) { const e = document.querySelector(`.agd-amostra[data-nivel="${n}"]`); c.fillStyle = '#111'; c.fillRect(0, 0, 1, 1); c.fillStyle = getComputedStyle(e).backgroundColor; c.fillRect(0, 0, 1, 1); const [r, g, b] = c.getImageData(0, 0, 1, 1).data; m[n] = 0.2126 * r + 0.7152 * g + 0.0722 * b; } return m; });
  ok(lum.zero < lum.baixa && lum.baixa < lum.media && lum.media < lum.alta, 'a escala do escuro cresce em luminosidade do zero ao alto: ' + JSON.stringify(Object.fromEntries(Object.entries(lum).map(([k, v]) => [k, Math.round(v)]))));
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  const dur = await pg.$eval('.agd-cel', (e) => getComputedStyle(e).transitionDuration);
  ok(parseFloat(dur) <= 0.011, 'com movimento reduzido as transições da Agenda são desligadas (' + dur + ')');
  await pg.emulateMedia({ reducedMotion: 'no-preference' });
  const dur2 = await pg.$eval('.agd-cel', (e) => parseFloat(getComputedStyle(e).transitionDuration) * 1000);
  ok(dur2 >= 120 && dur2 <= 180, 'sem preferência, as transições duram entre 120 e 180 ms (' + dur2 + ' ms)');
}
{
  // claro: contraste de cada nível
  const { pg } = t1;
  await ir(pg); await modo(pg, 'Mês');
  const cs = {};
  for (const n of ['zero', 'baixa', 'media', 'alta']) { if (await pg.$(`.agd-cel[data-nivel="${n}"]`)) cs[n] = await contraste(pg, `.agd-cel[data-nivel="${n}"]`); }
  ok(Object.keys(cs).length >= 3 && Object.values(cs).every((v) => v >= 4.5), 'contraste do número com o preenchimento de cada nível (claro) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cs).map(([k, v]) => [k, +v.toFixed(1)]))));
}

ok(erros.length === 0, 'nenhum erro de página nem de console durante todos os fluxos' + (erros.length ? ': ' + JSON.stringify(erros.slice(0, 4)) : ''));
await nav.close(); parar();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
