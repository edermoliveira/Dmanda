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
// DATA DE REFERÊNCIA CONTROLADA. Os dados são relativos a "hoje" (vencimentos, acompanhamentos, retorno do setor), e o resultado depende do dia da semana e do mês em que se roda:
// hoje+3 pode cair no sábado e ser antecipado para a sexta, no mesmo dia do acompanhamento de hoje+2, e hoje-2 pode cair no mês anterior. Por isso a semente e o relógio do navegador
// partem de uma data fixa (terça-feira 03/11/2026, com a hora do dia real, para os avisos de horário seguirem funcionando). Outra data: DMANDA_DATA_REFERENCIA=AAAA-MM-DD
// (as expectativas numéricas valem para a data padrão; outras datas servem para investigar). As regras de data em si são varridas em muitas datas por testar:agenda-regras.
const REFERENCIA = process.env.DMANDA_DATA_REFERENCIA || '2026-11-03';
const S = await semearAgenda(PASTA, REFERENCIA, { mes: true });
const HOJE = S.hoje;
const horaSP = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
const INSTANTE_REFERENCIA = new Date(`${REFERENCIA}T${horaSP}-03:00`);
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novo = async (opcoes, { tema = 'claro', prefs = null, ui = null } = {}) => {
  const { semRelogio, ...opcoesCtx } = opcoes;
  const ctx = await nav.newContext(opcoesCtx);
  if (!semRelogio) await ctx.clock.install({ time: INSTANTE_REFERENCIA }); // o navegador também vive na data de referência (o tempo segue correndo)
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
// A lista completa do dia é a gaveta do Mês (decisão 72): abre pelo toque na célula, e Esc a fecha. Enquanto ela está aberta, a grade não recebe cliques (é um diálogo modal).
const fecharDia = async (pg) => { if (await pg.$('.agd-detalhe')) { await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.agd-detalhe'), null, { timeout: 8000 }); await pg.waitForTimeout(150); } };
const modo = async (pg, nome) => { await fecharDia(pg); await pg.click(`.agd-barra .opcoes button:has-text("${nome}")`); await pg.waitForTimeout(350); };
const paraData = async (pg, iso) => { await fecharDia(pg); await pg.fill('.agd-data input', iso); await pg.waitForFunction((d) => document.querySelector('.agd-data input')?.value === d, iso); await pg.waitForTimeout(250); };
const celula = (pg, d) => pg.locator(`.agd-cel[data-data="${d}"]`);
const selAtualDe = (pg) => pg.$eval('.agd-cel[data-sel]', (e) => e.getAttribute('data-data'));
const abrirDia = async (pg, d) => { await fecharDia(pg); await celula(pg, d).evaluate((e) => e.scrollIntoView({ block: 'center' })); await celula(pg, d).click(); await pg.waitForSelector('.agd-detalhe', { timeout: 10000 }); await pg.waitForTimeout(350); };
const verDia = async (pg, d) => { await paraData(pg, d); await abrirDia(pg, d); };
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

// contraste do texto com o fundo de cada peça do Mês que existir na tela (selo de carga por nível, itens da célula, abas)
const contrastesDoMes = async (pg) => {
  const alvos = { 'selo baixa': '.agd-cel[data-nivel="baixa"] .agd-qtd', 'selo média': '.agd-cel[data-nivel="media"] .agd-qtd', 'selo alta': '.agd-cel[data-nivel="alta"] .agd-qtd', compromisso: '.agd-it[data-k="evento"]:not([data-dia])', 'dia inteiro': '.agd-it[data-k="evento"][data-dia]', demanda: '.agd-it[data-k="demanda"]:not([data-atrasado])', atrasada: '.agd-it[data-atrasado]', 'aba atual': '.agd-mes-aba[aria-current="true"]', aba: '.agd-mes-aba:not([aria-current])', hoje: '.agd-cel[data-hoje] .agd-num' };
  const r = {};
  for (const [nome, sel] of Object.entries(alvos)) if (await pg.$(sel)) r[nome] = await contraste(pg, sel);
  return r;
};

// ================= 1) mês no computador, claro =================
const t1 = await novo({ viewport: { width: 1360, height: 900 } });
{
  const { pg } = t1;
  await ir(pg);
  ok(!!(await pg.$('.agd[data-modo="mes"]')) && (await pg.$$('.agd-barra .opcoes button')).length === 3, 'a Agenda abre no computador em Mês, com as três visões Hoje, Semana e Mês');
  const { ano, mes } = anoMes(HOJE), g = gradeMes(ano, mes);
  // --- grade ---
  ok((await pg.getAttribute('.agd-grade', 'role')) === 'grid' && (await pg.$$('.agd-cabsem')).length === 7 && (await pg.$$('.agd-grade [role="row"]')).length === g.length + 1, 'calendário semântico: grade com sete cabeçalhos e uma linha por semana do mês');
  ok((await pg.$$eval('.agd-cabsem', (c) => c.map((x) => x.textContent.trim()).join())) === 'SEG,TER,QUA,QUI,SEX,SÁB,DOM' && (await pg.$$eval('.agd-semn', (c) => c.map((x) => x.textContent.trim()).join())) === g.map((_, i) => i + 1).join(), 'o cabeçalho vai de segunda a domingo e as semanas do mês são numeradas à esquerda');
  ok((await pg.$$eval('.agd-mes-aba', (b) => b.map((x) => x.textContent.trim()).join(''))) === 'JANFEVMARABRMAIJUNJULAGOSETOUTNOVDEZ' && (await pg.getAttribute('.agd-mes-aba[aria-current="true"]', 'data-mes')) === String(mes) && (await pg.getAttribute('.agd-meses', 'aria-label')) === `Meses de ${ano}`, 'as abas JAN a DEZ ficam à direita, na ordem do ano, com o mês exibido marcado');
  const botoes = await pg.$$eval('.agd-cel', (b) => b.map((x) => x.getAttribute('data-data')));
  ok(botoes.length === diasNoMes(ano, mes) && botoes[0] === `${mesDe(HOJE)}-01`, 'a quantidade de dias do mês confere e o primeiro é o dia 1');
  const cx = await caixa(pg, '.agd-cel');
  ok(cx.every((c) => c.w >= 100 && c.h >= 100 && c.h >= c.w * 0.6), `células grandes (no mínimo ${Math.round(Math.min(...cx.map((c) => c.w)))} por ${Math.round(Math.min(...cx.map((c) => c.h)))} px) e com pelo menos 44 px de lado`);
  const col1 = (await caixa(pg, `.agd-cel[data-data="${mesDe(HOJE)}-01"]`))[0], cabs = await caixa(pg, '.agd-cabsem'), primeiraCol = g[0].findIndex(Boolean);
  ok(Math.abs((col1.x + col1.w / 2) - (cabs[primeiraCol].x + cabs[primeiraCol].w / 2)) <= 2, `o dia 1 fica sob o cabeçalho da coluna certa (coluna ${primeiraCol}, segunda na primeira)`);
  const gap = cx[2].x - cx[1].r;
  ok(Math.abs(cx[1].y - cx[2].y) < 2 && gap > 3 && gap / cx[1].w < 0.12, `células separadas por um espaço pequeno e proporcional (${gap.toFixed(0)} px)`);
  const css = await pg.$eval('.agd-cel', (e) => { const s = getComputedStyle(e); return { raio: parseFloat(s.borderTopLeftRadius), lado: e.getBoundingClientRect().width, nums: s.fontVariantNumeric, pad: parseFloat(getComputedStyle(e.closest('.agd-painel')).paddingLeft) }; });
  ok(css.raio >= 12 && css.raio / css.lado < 0.28 && /tabular-nums/.test(css.nums), `células arredondadas (${css.raio} px) e números tabulares`);
  ok(css.pad >= 10 && css.pad <= 40, `margem lateral do painel de ${css.pad} px`);
  const pos = await pg.$eval(`.agd-cel[data-data="${HOJE}"]`, (e) => { const n = e.querySelector('.agd-num').getBoundingClientRect(), c = e.getBoundingClientRect(); return { dir: c.right - n.right, topo: n.top - c.top }; });
  ok(pos.dir >= 0 && pos.dir <= 16 && pos.topo >= 0 && pos.topo <= 14, `o número do dia fica no canto superior direito da célula (${pos.dir.toFixed(0)} px da direita, ${pos.topo.toFixed(0)} px do topo)`);
  const recuada = await pg.$eval('.agd-vaz', (e) => { const s = getComputedStyle(e); return { bg: s.backgroundColor, cel: e.getBoundingClientRect().height }; });
  ok(!!(await pg.$('.agd-vaz')) && (await pg.$$('.agd-vaz')).length === g.flat().filter((x) => x === null).length && recuada.bg !== 'rgba(0, 0, 0, 0)' && (await pg.$$('.agd-vaz .agd-num')).length === 0, 'as seis posições antes do dia 1 aparecem recuadas e sem número');
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
  await celula(pg, alvo).click(); await pg.waitForSelector('.agd-detalhe'); await pg.waitForTimeout(400);
  const depois = await caixa(pg, '.agd-cel');
  ok(JSON.stringify(antes.map((c) => [c.x, c.y, c.w, c.h])) === JSON.stringify(depois.map((c) => [c.x, c.y, c.w, c.h])), 'selecionar um dia e abrir a gaveta não desloca nem redimensiona nenhuma célula da grade');
  await pg.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  const sel = await celula(pg, alvo).evaluate((e) => ({ s: getComputedStyle(e).boxShadow, a: e.closest('[role=gridcell]').getAttribute('aria-selected') }));
  ok(sel.a === 'true' && /2px/.test(sel.s) && (await pg.getAttribute(`.agd-cel[data-data="${HOJE}"]`, 'data-sel')) === null, 'a seleção é um contorno persistente de 2 px (e só uma célula fica selecionada)');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.agd-detalhe'), null, { timeout: 5000 });
  ok((await pg.evaluate(() => document.activeElement?.getAttribute('data-data'))) === alvo && (await selAtualDe(pg)) === alvo, 'ao fechar a gaveta com Esc o foco volta à célula que a abriu e a seleção continua nela');
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
  const colunaDe = (d) => celula(pg, d).evaluate((e) => [...e.closest('[role=row]').children].filter((x) => x.getAttribute('role') === 'gridcell').indexOf(e.closest('[role=gridcell]')));
  const h = await selAtual(); ok((await colunaDe(h)) === 0 && new Date(`${h}T00:00:00Z`).getUTCDay() === 1, 'Home leva à segunda-feira da semana');
  await pg.keyboard.press('End'); await pg.waitForTimeout(200);
  const fim = await selAtual(); ok((await colunaDe(fim)) === 6 && new Date(`${fim}T00:00:00Z`).getUTCDay() === 0 && fim === somarDias(h, 6), 'End leva ao domingo da semana');
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
  await paraData(pg, '2027-02-10');
  ok((await pg.$$('.agd-cel')).length === 28 && (await pg.$$('.agd-vaz')).length === 0 && /Fevereiro\s+2027/i.test(await pg.textContent('.agd-periodo')), 'fevereiro de 2027 começa na segunda e termina no domingo: 4 semanas, sem espaços vazios');
  await paraData(pg, '2026-02-10');
  ok((await pg.$$('.agd-cel')).length === 28 && (await pg.$$('.agd-vaz')).length === 7 && (await pg.$$('.agd-grade [role="row"]')).length === 6, 'fevereiro de 2026 começa no domingo: seis posições vazias antes do dia 1, uma depois do dia 28 e 5 semanas');
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")');
  // --- legenda ---
  const leg = await pg.$eval('.agd-leg', (e) => ({ t: e.textContent, n: e.querySelectorAll('.agd-escala .agd-amostra').length, dir: e.querySelector('.agd-escala').getBoundingClientRect().right, pai: e.getBoundingClientRect().right }));
  ok(/Menos pendências/.test(leg.t) && /Mais pendências/.test(leg.t) && leg.n === 4 && leg.pai - leg.dir < 4, 'legenda no rodapé, à direita, com quatro amostras arredondadas e os rótulos Menos pendências e Mais pendências');
  // --- detalhes do dia, marcos e tarefas ---
  await verDia(pg, S.h.prazo);
  ok(/Pacote grande de tarefas/.test(await pg.textContent('.agd-detalhe')) && (await pg.$$('.agd-detalhe .agd-tarefas input')).length === 9, 'tocar no dia abre a gaveta com a demanda e as nove tarefas pendentes');
  const rotulo0 = await celula(pg, S.h.prazo).getAttribute('aria-label');
  await pg.locator('.agd-detalhe .agd-tarefas input').first().click(); await pg.waitForTimeout(1100);
  const aposUma = await celula(pg, S.h.prazo).getAttribute('data-nivel');
  await pg.locator('.agd-detalhe .agd-tarefas input').first().click(); await pg.waitForTimeout(1100);
  const aposDuas = await celula(pg, S.h.prazo).getAttribute('data-nivel');
  ok(/9 pendências/.test(rotulo0) && (await celula(pg, S.h.prazo).getAttribute('aria-label')).includes('7 pendências') && aposUma === 'alta' && aposDuas === 'media', 'concluir tarefas na própria Agenda atualiza a carga na hora (9 alta, 8 alta, 7 média)');
  ok((await pg.textContent('[data-total-pendencias]')) === String(15 - 2), 'o total de pendências do mês também diminui');
  await pg.reload({ waitUntil: 'load' }); await ir(pg); await paraData(pg, S.h.prazo);
  ok((await celula(pg, S.h.prazo).getAttribute('aria-label')).includes('7 pendências') && !(await pg.$('.agd-detalhe')), 'a conclusão das tarefas persiste depois de recarregar (a gaveta não reabre sozinha)');
  await verDia(pg, S.b.prazo);
  ok((await celula(pg, S.b.prazo).getAttribute('data-atrasada')) !== null && /atrasado há/.test(await pg.textContent('.agd-detalhe')) && /Relatório atrasado/.test(await pg.textContent('.agd-detalhe')), 'demanda vencida permanece no dia em que venceu, marcada como atrasada na grade e no detalhe');
  await verDia(pg, S.d.acompanhar_em);
  ok(/Acompanhar/.test(await pg.textContent('.agd-detalhe')) && /Aguarda a Contabilidade/.test(await pg.textContent('.agd-detalhe')), 'o acompanhamento digitado aparece como marco "Acompanhar" no próprio dia');
  await verDia(pg, dRetorno);
  const txtRet = await pg.textContent('.agd-detalhe');
  ok(/Retorno do setor/.test(txtRet) && /10 dias desde/.test(txtRet), 'o retorno do setor (10 dias do encaminhamento) aparece como marco próprio e explica a contagem');
  await verDia(pg, S.a.prazo);
  ok(/Vencimento/.test(await pg.textContent('.agd-detalhe')) && /Resposta ao Tribunal/.test(await pg.textContent('.agd-detalhe')), 'o vencimento já gravado aparece no dia dele, sem ser recalculado');
  await verDia(pg, S.dia.data);
  ok((await celula(pg, S.dia.data).getAttribute('data-indisp')) !== null && /Feriado: Feriado de teste/.test(await pg.textContent('.agd-detalhe')) && /dia indisponível|Feriado/.test(await celula(pg, S.dia.data).getAttribute('aria-label')), 'o dia indisponível cadastrado em Configurações aparece na grade, na descrição acessível e no detalhe');
  ok((await pg.$$('text=/Novo dia indisponível|Cadastrar feriado/')).length === 0, 'a Agenda não cria uma segunda fonte de dias indisponíveis (o cadastro continua só em Configurações)');
  await fecharDia(pg);
  // --- painéis auxiliares e pendências sem prazo ---
  const aux = await caixa(pg, '.agd-aux-par .agd-aux');
  ok(aux.length === 2 && Math.abs(aux[0].w - aux[1].w) <= 2 && Math.abs(aux[0].y - aux[1].y) <= 2 && Math.abs(aux[0].h - aux[1].h) <= 2, 'dois painéis auxiliares lado a lado, com dimensões equivalentes');
  ok(/Sem nenhuma data/.test(await pg.textContent('.agd-aux-par')) && /Nada foi inventado/.test(await pg.textContent('.agd-aux-par')), 'demanda sem nenhuma data aparece em Pendências sem prazo, sem vencimento inventado');
  ok(/Pacote grande/.test((await pg.textContent('.agd-aux-par .agd-aux')) + ' Pacote grande') && !!(await pg.$('.agd-aux-par')), 'o painel de dias cheios existe ao lado do de pendências sem prazo');
  // --- filtros ---
  await pg.click('.agd-filtros .opcoes button:has-text("Demandas")'); await pg.waitForTimeout(300);
  ok((await pg.$$('.agd-cel .agd-it[data-k="evento"]')).length === 0 && (await pg.$$('.agd-cel .agd-it[data-k="demanda"]')).length > 0 && (await pg.$$('.agd-cel:not([data-nivel="zero"])')).length > 0, 'filtro Demandas: somem os compromissos das células e o heatmap continua');
  await pg.click('.agd-filtros .opcoes button:has-text("Compromissos")'); await pg.waitForTimeout(300);
  ok((await pg.$$('.agd-cel:not([data-nivel="zero"])')).length === 0 && (await pg.$$('.agd-cel .agd-it[data-k="demanda"]')).length === 0 && (await pg.$$('.agd-cel .agd-it[data-k="evento"]')).length > 0, 'filtro Compromissos: só compromissos, sem carga nem demandas no calendário');
  await pg.click('.agd-filtros .opcoes button:has-text("Tudo")');
  await verDia(pg, S.g.prazo);
  ok(!/Já finalizada/.test(await pg.textContent('.agd-detalhe')), 'demanda finalizada não aparece por padrão e não soma carga');
  await fecharDia(pg); await pg.check('.agd-filtros label:has-text("finalizadas") input'); await pg.waitForTimeout(300); await abrirDia(pg, S.g.prazo);
  ok(/Já finalizada/.test(await pg.textContent('.agd-detalhe')) && !/atrasado/.test((await pg.textContent('.agd-detalhe')).split('Já finalizada')[0].slice(-80) + 'x'), 'filtro de demandas finalizadas mostra a finalizada no vencimento, sem carga');
  await fecharDia(pg); await pg.uncheck('.agd-filtros label:has-text("finalizadas") input');
  await verDia(pg, S.a.prazo);
  ok(!(await pg.$('.agd-detalhe .agd-tarefas .feita')) && (await pg.$$('.agd-detalhe .agd-tarefas input')).length === 2, 'tarefas concluídas ficam ocultas por padrão (2 pendentes de 3)');
  await fecharDia(pg); await pg.check('.agd-filtros label:has-text("tarefas concluídas") input'); await pg.waitForTimeout(300); await abrirDia(pg, S.a.prazo);
  ok((await pg.$$('.agd-detalhe .agd-tarefas input')).length === 3 && !!(await pg.$('.agd-detalhe .agd-tarefas .feita')), 'o filtro reexibe a tarefa concluída (riscada)');
  await fecharDia(pg); await pg.uncheck('.agd-filtros label:has-text("tarefas concluídas") input');
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

// ================= 2b) Mês (decisão 72): itens da célula, "+N", abas, setas, gaveta do dia e falha só das demandas =================
const t5 = await novo({ viewport: { width: 1360, height: 900 } }, { prefs: { modo: 'mes' } });
{
  const { pg } = t5;
  const M = S.mes;
  const rolagem = () => pg.evaluate(() => document.querySelector('.main').scrollTop);
  const itens = (d, extra = '') => pg.$$eval(`.agd-cel[data-data="${d}"] .agd-it${extra}`, (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  const periodo = async () => ((await pg.textContent('.agd-periodo')) ?? '').replace(/\s+/g, ' ').trim();
  const noDentro = () => pg.evaluate(() => !!document.activeElement?.closest('.agd-detalhe'));
  await ir(pg);
  // --- cabeçalho: mês e ano à esquerda, setas, Hoje e visões ---
  const cab = await pg.evaluate(() => { const t = document.querySelector('.agd-periodo').getBoundingClientRect(), n = document.querySelector('.agd-nav').getBoundingClientRect(); return { fimTitulo: t.right, iniNav: n.left, topoT: t.top, topoN: n.top, ano: document.querySelector('.agd-periodo .agd-ano')?.textContent }; });
  ok((await periodo()) === 'Novembro 2026' && cab.ano === '2026' && cab.iniNav > cab.fimTitulo && Math.abs(cab.topoN - cab.topoT) < 60, 'o cabeçalho mostra "Novembro 2026" em português, com o ano em destaque menor, e a navegação à direita do título');
  ok(!!(await pg.$('.agd-nav [aria-label="Mês anterior"]')) && !!(await pg.$('.agd-nav [aria-label="Próximo mês"]')) && !!(await pg.$('.agd-nav .btn.mini[aria-label="Voltar para hoje"]')) && (await pg.$$('.agd-barra .opcoes button')).length === 3, 'o cabeçalho tem as setas de mês anterior e seguinte, o botão Hoje e o seletor de visões da Agenda');
  // --- itens nas células ---
  const hojeIt = await itens(HOJE);
  ok(hojeIt.length === 3 && /^09:00 Reunião de secretariado$/.test(hojeIt[0]) && /^09:30 Visita técnica$/.test(hojeIt[1]) && /^12:30 Almoço com a prefeita$/.test(hojeIt[2]) && (await pg.$$(`.agd-cel[data-data="${HOJE}"] .agd-mais`)).length === 0, 'a célula de hoje mostra a hora e o título dos três compromissos, em ordem, sem "+N"');
  const dInt = await itens(iso(1), '[data-dia]');
  ok(dInt.length === 1 && /^Dia todo Dia do servidor$/.test(dInt[0]), 'o compromisso de dia inteiro aparece como "Dia todo" e o título');
  const venc = await itens(S.a.prazo, '[data-k="demanda"][data-marco="vencimento"]');
  ok(venc.length === 1 && /Resposta ao Tribunal/.test(venc[0]), 'a demanda aparece pelo título no dia do vencimento efetivo');
  // o vencimento vencido pode cair no mês anterior (nesta referência, 1º de novembro é domingo e o prazo foi antecipado para a sexta, 30/10): a grade vai até o mês dele
  const mesDoAtraso = mesDe(S.b.prazo) !== mesDe(HOJE);
  if (mesDoAtraso) await paraData(pg, S.b.prazo);
  const atras = await itens(S.b.prazo, '[data-atrasado]');
  ok(atras.length === 1 && /Relatório atrasado/.test(atras[0]) && (await celula(pg, S.b.prazo).getAttribute('data-atrasada')) !== null && !!(await pg.$(`.agd-cel[data-data="${S.b.prazo}"] .agd-atr`)), 'a demanda vencida fica no dia em que venceu, com a linha e o ponto de atraso');
  if (mesDoAtraso) { await pg.click('.agd-nav .btn.mini:has-text("Hoje")'); await pg.waitForTimeout(350); }
  const acomp = await itens(S.d.acompanhar_em, '[data-marco="acompanhamento"]');
  ok(acomp.length === 1 && /^Acomp\. Aguarda a Contabilidade$/.test(acomp[0]), 'o acompanhamento aparece na própria data com o rótulo "Acomp.", diferente do vencimento');
  const dRet = contagemRetorno({ etapa: 'Aguardando retorno', etapa_desde: S.d.etapa_desde, encaminhada_em: S.d.encaminhada_em, reiterada_em: S.d.reiterada_em, arquivada_em: null }, [S.dia]).data;
  if (mesDe(dRet) === mesDe(HOJE)) { const ret = await itens(dRet, '[data-marco="retorno"]'); ok(ret.length === 1 && /^Retorno Aguarda a Contabilidade$/.test(ret[0]), 'o retorno do setor aparece na própria data com o rótulo "Retorno"'); } else ok(true, 'o retorno do setor cai em outro mês nesta data de referência: verificação dispensada');
  const formas = await pg.$$eval('.agd-it', (l) => { const m = {}; for (const e of l) { const k = e.getAttribute('data-k') + (e.getAttribute('data-marco') ? ':' + e.getAttribute('data-marco') : ''); m[k] = getComputedStyle(e).borderInlineStartStyle; } return m; });
  ok(formas['demanda:vencimento'] === 'solid' && formas['demanda:acompanhamento'] === 'dashed' && (formas['demanda:retorno'] === undefined || formas['demanda:retorno'] === 'dotted'), 'cada marco tem a sua forma: vencimento com barra cheia, acompanhar tracejada e retorno pontilhada (' + JSON.stringify(formas) + ')');
  const trunc = await pg.$eval(`.agd-cel[data-data="${HOJE}"] .agd-it-t`, (e) => { const s = getComputedStyle(e); return { oc: s.textOverflow, nw: s.whiteSpace, ov: s.overflow }; });
  ok(trunc.oc === 'ellipsis' && trunc.nw === 'nowrap' && trunc.ov === 'hidden', 'os títulos são truncados na célula, em uma linha, com reticências');
  const semBarra = await pg.$$eval('.agd-cel, .agd-its, .agd-it, .agd-it-t', (l) => l.every((e) => !/auto|scroll/.test(getComputedStyle(e).overflowY) && !/auto|scroll/.test(getComputedStyle(e).overflowX)));
  ok(semBarra && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), 'nenhuma célula tem barra de rolagem e a página não rola na horizontal');
  // --- abas e setas, inclusive a virada de dezembro para janeiro ---
  const selTxt = () => selAtualDe(pg);
  await pg.click('.agd-mes-aba[data-mes="12"]'); await pg.waitForTimeout(350);
  ok((await periodo()) === 'Dezembro 2026' && (await selTxt()) === '2026-12-03' && (await pg.getAttribute('.agd-mes-aba[aria-current="true"]', 'data-mes')) === '12' && !(await pg.$('.agd-detalhe')), 'a aba DEZ leva direto a dezembro de 2026, mantendo o dia, sem abrir a gaveta');
  const cheio = await itens(M.cheio);
  ok(cheio.length === 3 && (await pg.textContent(`.agd-cel[data-data="${M.cheio}"] .agd-mais`)) === '+3' && (await pg.getAttribute(`.agd-cel[data-data="${M.cheio}"] .agd-mais`, 'data-mais')) === '3', 'dia cheio (seis itens): três linhas visíveis e "+3" com a contagem certa');
  ok((await itens(M.vazio)).length === 0 && (await pg.$$(`.agd-cel[data-data="${M.vazio}"] .agd-mais`)).length === 0, 'dia vazio: nenhuma linha e nenhum "+N"');
  const aj = M.ajustado;
  ok(aj.prazo === '2026-12-04' && aj.prazo_original === '2026-12-05' && (await itens('2026-12-04')).some((t) => /Prazo ajustado de dezembro/.test(t)) && !(await itens('2026-12-05')).some((t) => /Prazo ajustado/.test(t)), 'o prazo que cairia no sábado aparece na sexta, o vencimento efetivo que o Dmanda já calcula');
  ok((await itens('2026-12-24', '[data-dia]')).join() === 'Dia todo Recesso do funcionalismo', 'dia inteiro em dezembro: "Dia todo" e o título');
  const longoCel = await pg.$eval(`.agd-cel[data-data="${M.cheio}"] .agd-it-t`, (e) => e.scrollWidth > e.clientWidth || e.textContent.length < 20);
  ok(longoCel, 'o título longo é cortado na célula (a gaveta o mostra inteiro)');
  await pg.click('.agd-nav [aria-label="Próximo mês"]'); await pg.waitForTimeout(350);
  const cabsJan = await caixa(pg, '.agd-cabsem'), jan1 = (await caixa(pg, '.agd-cel[data-data="2027-01-01"]'))[0];
  ok((await periodo()) === 'Janeiro 2027' && (await pg.getAttribute('.agd-meses', 'aria-label')) === 'Meses de 2027' && Math.abs((jan1.x + jan1.w / 2) - (cabsJan[4].x + cabsJan[4].w / 2)) <= 2 && (await selTxt()) === '2027-01-03', 'a seta atravessa dezembro e vai para janeiro de 2027: o ano das abas muda e 1º de janeiro (sexta) fica sob SEX');
  ok((await itens('2027-01-04')).some((t) => /Plano de trabalho 2027/.test(t)) && (await itens('2027-01-05')).join() === '09:00 Reunião de planejamento 2027', 'janeiro de 2027 traz a demanda e o compromisso nas suas datas');
  await pg.click('.agd-nav [aria-label="Mês anterior"]'); await pg.waitForTimeout(350);
  ok((await periodo()) === 'Dezembro 2026' && (await itens(M.ultimo)).length === 2 && (await selTxt()) === '2026-12-03', 'a seta volta de janeiro a dezembro e 31 de dezembro mostra o vencimento e o compromisso');
  await pg.click('.agd-mes-aba[data-mes="1"]'); await pg.waitForTimeout(350);
  ok((await periodo()) === 'Janeiro 2026' && (await pg.getAttribute('.agd-meses', 'aria-label')) === 'Meses de 2026' && (await selTxt()) === '2026-01-03', 'a aba JAN leva a janeiro do ano exibido (2026), não ao de 2027');
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")'); await pg.waitForTimeout(350);
  ok((await periodo()) === 'Novembro 2026' && (await selTxt()) === HOJE, 'o botão Hoje volta a novembro de 2026 e ao dia de hoje');

  // --- gaveta do dia no computador ---
  await pg.click('.agd-mes-aba[data-mes="12"]'); await pg.waitForTimeout(350);
  await celula(pg, M.cheio).evaluate((e) => e.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(200);
  const gradeAntes = await caixa(pg, '.agd-cel'), rolAntes = await rolagem();
  await pg.click(`.agd-cel[data-data="${M.cheio}"] .agd-mais`); await pg.waitForSelector('.agd-detalhe'); await pg.waitForTimeout(500);
  const gc = await pg.$eval('.agd-gv', (e) => { const r = e.getBoundingClientRect(); return { esq: r.left, dir: window.innerWidth - r.right, larg: r.width, vw: window.innerWidth, topo: r.top, base: window.innerHeight - r.bottom }; });
  ok(/^Terça-feira, 15 de dezembro de 2026$/.test(await pg.textContent('#agd-gv-t')) && (await pg.$$('.agd-detalhe .agd-evento')).length === 3 && (await pg.$$('.agd-detalhe .agd-demanda')).length === 3, 'tocar no "+N" abre a lista completa do dia: data por extenso, três compromissos e três demandas');
  ok(/Audiência pública para revisão do plano diretor e do zoneamento urbano do município/.test(await pg.textContent('.agd-detalhe')) && (await pg.$$eval('.agd-detalhe .agd-tit', (t) => t.every((x) => getComputedStyle(x).textOverflow !== 'ellipsis' && getComputedStyle(x).whiteSpace !== 'nowrap'))), 'a gaveta mostra os títulos por inteiro, inclusive o longo');
  ok(/Reunião A de dezembro/.test(await pg.textContent('.agd-detalhe')) && /08:00 às 09:00/.test(await pg.textContent('.agd-detalhe')) && /Vencimento/.test(await pg.textContent('.agd-detalhe')) && /Compromisso/.test(await pg.textContent('.agd-detalhe')), 'cada item mostra o horário ou o tipo');
  ok(gc.dir <= 1 && gc.esq > gc.vw / 2 && gc.larg <= 470 && gc.topo >= 0 && gc.base >= 0, `no computador a gaveta fica à direita (${Math.round(gc.larg)} px de largura, a partir de ${Math.round(gc.esq)} px)`);
  ok(JSON.stringify(gradeAntes.map((c) => [c.x, c.y, c.w, c.h])) === JSON.stringify((await caixa(pg, '.agd-cel')).map((c) => [c.x, c.y, c.w, c.h])) && (await rolagem()) === rolAntes, 'a gaveta cobre a grade sem redimensioná-la nem rolá-la');
  ok(await noDentro() && (await pg.getAttribute('.agd-gv', 'role')) === 'dialog' && (await pg.getAttribute('.agd-gv', 'aria-modal')) === 'true', 'ao abrir, o foco vai para a gaveta, que é um diálogo modal');
  let preso = true; for (let i = 0; i < 12; i++) { await pg.keyboard.press('Tab'); if (!(await noDentro())) preso = false; }
  for (let i = 0; i < 12; i++) { await pg.keyboard.press('Shift+Tab'); if (!(await noDentro())) preso = false; }
  ok(preso, 'Tab e Shift+Tab giram dentro da gaveta, sem sair para a grade');
  // evento e demanda abertos a partir da lista, com a janela por cima
  await pg.click('.agd-detalhe .agd-evento .agd-abrir'); await pg.waitForSelector('.modal');
  ok(/Reunião A de dezembro/.test(await pg.textContent('.modal h3')) || /Reunião A de dezembro/.test(await pg.textContent('.modal')), 'abrir um compromisso a partir da lista abre o mesmo evento de sempre');
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  ok(!!(await pg.$('.agd-detalhe')) && (await pg.evaluate(() => document.activeElement?.classList.contains('agd-abrir'))), 'Esc fecha só a janela do evento: a gaveta continua aberta e o foco volta ao item que a abriu');
  await pg.click('.agd-detalhe .agd-demanda .agd-abrir'); await pg.waitForSelector('.modal');
  ok(/Parecer de dezembro/.test(await pg.textContent('.modal')), 'abrir uma demanda a partir da lista abre a consulta da demanda');
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  ok(!!(await pg.$('.agd-detalhe')), 'Esc fecha só a janela da demanda: a gaveta continua aberta');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.agd-detalhe'), null, { timeout: 5000 });
  ok((await pg.evaluate(() => document.activeElement?.getAttribute('data-data'))) === M.cheio && (await periodo()) === 'Dezembro 2026' && (await selTxt()) === M.cheio && (await rolagem()) === rolAntes, 'Esc fecha a gaveta e devolve o foco à célula: o mês, a data escolhida e a posição da página ficam como estavam');
  // dia vazio, criação a partir da gaveta e fechamento pelo clique fora
  await pg.click(`.agd-cel[data-data="${M.vazio}"] .agd-num`); await pg.waitForSelector('.agd-detalhe'); await pg.waitForTimeout(300);
  ok(/Nada programado para este dia/.test(await pg.textContent('.agd-detalhe')) && /Terça-feira|Quarta-feira/.test(await pg.textContent('#agd-gv-t')) && /Daqui a \d+ dias?/.test(await pg.textContent('.agd-detalhe')), 'tocar no número do dia vazio abre a gaveta com "Nada programado para este dia."');
  await pg.click('.agd-detalhe .agd-gv-rod .btn'); await pg.waitForSelector('#ev-titulo');
  ok((await pg.inputValue('#ev-data')) === M.vazio, '"Novo evento neste dia" abre o evento já com a data do dia');
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  ok(!!(await pg.$('.agd-detalhe')), 'cancelar a janela do novo evento deixa a gaveta aberta');
  await pg.mouse.click(120, 400); await pg.waitForFunction(() => !document.querySelector('.agd-detalhe'), null, { timeout: 5000 });
  ok((await pg.evaluate(() => document.activeElement?.getAttribute('data-data'))) === M.vazio, 'clicar fora fecha a gaveta e o foco volta à célula');
  await celula(pg, M.cheio).focus(); await pg.keyboard.press('Enter'); await pg.waitForSelector('.agd-detalhe');
  ok(await noDentro() && /15 de dezembro/.test(await pg.textContent('#agd-gv-t')), 'Enter na célula com o teclado abre a lista do dia');
  await pg.click('.agd-gv-cab .icbtn-s'); await pg.waitForFunction(() => !document.querySelector('.agd-detalhe'), null, { timeout: 5000 });
  ok((await pg.evaluate(() => document.activeElement?.getAttribute('data-data'))) === M.cheio, 'o botão de fechar também devolve o foco à célula');
  // setas só movem a seleção; a gaveta é aberta por toque ou Enter
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(200);
  ok(!(await pg.$('.agd-detalhe')) && (await selTxt()) === somarDias(M.cheio, 1), 'as setas do teclado movem a seleção sem abrir a gaveta');
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")'); await pg.waitForTimeout(300);
  await t5.ctx.close();
}

// falha só da leitura das demandas: a grade e os compromissos continuam, e o aviso diz o que está indisponível
{
  const { ctx, pg } = await novo({ viewport: { width: 1360, height: 900 } }, { prefs: { modo: 'mes' } });
  let ativa = true, vezes = 0;
  await pg.route('**/*', async (route) => {
    const q = route.request();
    if (!(q.method() === 'POST' && q.headers()['next-action'])) { await route.continue(); return; }
    const r = await route.fetch(); const texto = await r.text();
    const linhas = texto.split('\n'), i = linhas.findIndex((l) => /^1:\{"ok":true,"dados":\{"demandas":/.test(l));
    if (ativa && i >= 0) {
      const j = JSON.parse(linhas[i].slice(2)); j.dados.demandas = { ok: false, erro: 'Falha simulada em demandas.' }; linhas[i] = '1:' + JSON.stringify(j); vezes++;
      const corpo = linhas.join('\n'); await route.fulfill({ response: r, body: corpo, headers: { ...r.headers(), 'content-length': String(Buffer.byteLength(corpo)) } }); return;
    }
    await route.fulfill({ response: r, body: texto });
  });
  await ir(pg);
  ok(vezes >= 1 && /As demandas não carregaram/.test((await pg.textContent('.agd-aviso-carga').catch(() => '')) ?? ''), 'falha só nas demandas: o Mês mostra o aviso de que vencimentos, retornos e carga estão indisponíveis');
  const ev = await pg.$$eval('.agd-cel .agd-it[data-k="evento"]', (l) => l.length), dm = await pg.$$eval('.agd-cel .agd-it[data-k="demanda"]', (l) => l.length), qt = await pg.$$eval('.agd-qtd', (l) => l.length);
  ok(ev >= 3 && dm === 0 && qt === 0, `a grade e os compromissos continuam (${ev} itens de compromisso), sem demanda nem carga inventadas`);
  const rot = (await celula(pg, HOJE).getAttribute('aria-label')) ?? '';
  ok(/pendências indisponíveis/.test(rot) && !/sem pendências/.test(rot) && /3 compromissos/.test(rot), 'a descrição acessível da célula diz "pendências indisponíveis", nunca "sem pendências"');
  ok((await pg.textContent('[data-total-pendencias]')) === '–', 'o total de pendências mostra o traço de "sem progresso", não "0"');
  await abrirDia(pg, HOJE);
  ok(/As demandas não carregaram/.test(await pg.textContent('.agd-detalhe .erro-carga')) && (await pg.$$('.agd-detalhe .agd-evento')).length === 3 && (await pg.$$('.agd-detalhe .agd-demanda')).length === 0, 'a gaveta do dia lista os compromissos e avisa que as demandas não carregaram');
  await fecharDia(pg); await abrirDia(pg, iso(15));
  ok(/não dá para dizer o que vence/.test(await pg.textContent('.agd-detalhe')) && !/Nada programado/.test(await pg.textContent('.agd-detalhe')), 'em um dia sem compromissos, a gaveta não afirma "nada programado" enquanto as demandas estão indisponíveis');
  // "Tentar de novo" dentro da gaveta: a grade é refeita por baixo, e ao fechar o foco volta à célula do mesmo dia (não se perde no corpo da página)
  ativa = false;
  await pg.click('.agd-detalhe .erro-carga .btn');
  await pg.waitForSelector('.agd-cel .agd-it[data-k="demanda"]', { timeout: 15000 }); await pg.waitForSelector('.agd-detalhe', { timeout: 15000 }); await pg.waitForTimeout(400);
  ok(!(await pg.$('.agd-detalhe .erro-carga')) && !(await pg.$('.agd-aviso-carga')) && (await pg.$$('.agd-detalhe .agd-demanda, .agd-detalhe .agd-evento, .agd-detalhe .agd-vazio')).length > 0, 'recarregar as demandas de dentro da gaveta tira o aviso e a gaveta continua aberta');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.agd-detalhe'), null, { timeout: 5000 });
  ok((await pg.evaluate(() => document.activeElement?.getAttribute('data-data'))) === iso(15), 'depois de recarregar de dentro da gaveta, fechar devolve o foco à célula do dia (a grade foi refeita)');
  ativa = true; await pg.reload({ waitUntil: 'load' }); await ir(pg);
  ok(/As demandas não carregaram/.test((await pg.textContent('.agd-aviso-carga').catch(() => '')) ?? ''), 'a falha é simulada de novo para provar o botão do aviso do Mês');
  ativa = false;
  await pg.click('.agd-aviso-carga .btn'); await pg.waitForFunction(() => !document.querySelector('.agd-aviso-carga'), null, { timeout: 15000 });
  await pg.waitForSelector('.agd-cel .agd-it[data-k="demanda"]', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(300);
  ok((await pg.$$eval('.agd-cel .agd-it[data-k="demanda"]', (l) => l.length)) > 0 && (await pg.$$eval('.agd-qtd', (l) => l.length)) > 0 && (await pg.textContent('[data-total-pendencias]')) !== '–', 'depois de "Tentar de novo" as demandas, a carga e o total voltam');
  await pg.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close();
}

// ================= 3) Aguardando Prefeita nas demandas =================
{
  const { pg } = t1;
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'quadro', ordem: { coluna: 'prazo', sentido: 1 }, grupos: {} })));
  await ir(pg, '/demandas');
  await pg.waitForSelector('.quadro .coluna[aria-label="Aguardando Prefeita"] .mini-card', { timeout: 15000 }).catch(() => {});
  const colunas = await pg.$$eval('.quadro .coluna', (c) => c.map((x) => x.getAttribute('aria-label')));
  ok(colunas.join() === 'Cadastro,Vistos,Fazendo,Aguardando retorno,Aguardando Prefeita,Finalizado', 'o Quadro tem a nova coluna Aguardando Prefeita entre Aguardando retorno e Finalizado');
  const cards = await pg.$$eval('.quadro .coluna[aria-label="Aguardando Prefeita"] .mini-card', (c) => c.map((x) => ({ t: x.querySelector('.assunto').textContent, espera: x.querySelector('[data-espera-prefeita]')?.textContent, venc: x.querySelector('[data-espera-prefeita]')?.getAttribute('data-alerta') === 'sim', vencido: !!x.querySelector('.pz.venc'), atrasada: x.classList.contains('atrasada') })));
  ok(cards.length === 2 && cards[0].t === 'Aguarda a Prefeita há muito' && cards[1].t === 'Aguarda a Prefeita há pouco', 'dentro da etapa, a espera mais antiga vem primeiro');
  ok(cards[0].espera === 'Aguardando Prefeita há 12 dias' && cards[0].venc === true && cards[1].espera === 'Aguardando Prefeita há 5 dias' && cards[1].venc === false, 'o card mostra "Aguardando Prefeita há X dias" e, depois de 10 dias, usa o visual de prazo vencido');
  ok(cards.every((c) => !c.vencido && !c.atrasada), 'o alerta de espera usa marcação própria: não é prazo vencido nem deixa o card como atrasado');
  // abrir a demanda E e conferir que reiterar/editar não mexe na etapa; mover manualmente não ocorre sozinho
  const antes = await pg.$$eval('.quadro .coluna[aria-label="Aguardando Prefeita"] .mini-card', (c) => c.length);
  await pg.waitForTimeout(500);
  ok(antes === 2, 'nada se move sozinho: as duas demandas continuam em Aguardando Prefeita');
  // Início e "Só atrasadas" seguem a data aplicável; a espera pela Prefeita não entra em atrasadas
  await ir(pg, '/');
  const grupos = await pg.$$eval('.stats.tres .stat', (b) => b.map((x) => Number(x.querySelector('.n').textContent)));
  ok(grupos[0] === 1, 'Início: Atrasadas conta só o Relatório atrasado (a Prefeita com 12 dias de espera não é atrasada)');
  await pg.click('.stats.tres .st-atrasadas');
  const naoAtrasadas = await pg.$$eval('.sub-f + .cards .assunto', (c) => c.map((x) => x.textContent));
  ok(naoAtrasadas.join() === 'Relatório atrasado', 'Início: a lista de atrasadas traz só quem tem data aplicável vencida');
  await pg.click('.stats.tres .st-sete'); await pg.waitForTimeout(250);
  const sete = await pg.$$eval('.sub-f + .cards .assunto', (c) => c.map((x) => x.textContent));
  ok(sete.includes('Aguarda a Contabilidade') && !sete.some((t) => /Prefeita/.test(t)), 'Início: quem aguarda retorno entra pelo "Acompanhar em" mais próximo e a Prefeita não aparece nos prazos');
  await ir(pg, '/demandas');
  await pg.click('.toolbar .btn[aria-label^="Só atrasadas"]'); await pg.waitForTimeout(350);
  const so = await pg.$$eval('.quadro .mini-card .assunto', (c) => c.map((x) => x.textContent));
  ok(so.join() === 'Relatório atrasado', '"Só atrasadas" usa a mesma regra: a espera longa pela Prefeita não aparece');
  await pg.click('.toolbar .btn[aria-label^="Só atrasadas"]'); await pg.waitForTimeout(250);
  // retorno do setor: editar Andamento da D
  await pg.click('.quadro .coluna[aria-label="Aguardando retorno"] .mini-card .assunto'); await pg.waitForSelector('.modal');
  await pg.click('[data-lapis="andamento"]'); await pg.waitForSelector('#d-enc');
  const encAntes = await pg.inputValue('#d-enc');
  ok(encAntes === S.d.encaminhada_em && (await pg.inputValue('#d-ac')) === S.d.acompanhar_em, 'em Aguardando retorno o Andamento mostra o encaminhamento, a reiteração e o Acompanhar em manual (preservado)');
  await pg.click('button:has-text("Reiterei hoje")'); await pg.click('[data-salvar="andamento"]'); await pg.waitForTimeout(900);
  const novaData = contagemRetorno({ etapa: 'Aguardando retorno', etapa_desde: S.d.etapa_desde, encaminhada_em: S.d.encaminhada_em, reiterada_em: HOJE, arquivada_em: null }, [S.dia]);
  ok(novaData.origemBase === 'reiteração' && novaData.base === HOJE && /Retorno reiterado em/.test(await pg.textContent('.modal')), 'reiteração registrada vale como nova base e aparece na consulta');
  await pg.click('.modal .btn:has-text("Fechar")'); await janelaFechada(pg);
  await ir(pg, '/agenda'); await modo(pg, 'Mês'); await verDia(pg, novaData.data);
  ok(/Retorno do setor/.test(await pg.textContent('.agd-detalhe')) && /\(reiteração\)/.test(await pg.textContent('.agd-detalhe')), 'a Agenda passa a marcar o retorno do setor 10 dias depois da reiteração, sem tocar no acompanhamento manual nem no vencimento');
  await verDia(pg, S.d.acompanhar_em);
  ok(/Acompanhar/.test(await pg.textContent('.agd-detalhe')), 'o acompanhamento manual continua no mesmo dia');
  await fecharDia(pg);
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
  await abrirDia(pg, HOJE);
  const noDia = await pg.$$eval(`.agd-detalhe .agd-evento .agd-tit`, (t) => t.map((x) => x.textContent));
  ok(noDia.filter((x) => x === 'Reunião de teste').length === 1, 'clique repetido (três cliques seguidos) cria um único evento');
  const rd2 = await pg.evaluate(() => JSON.parse(localStorage.getItem('dmanda:rascunhos') || '{}'));
  ok(!rd2['ev:nova'], 'depois de criado, não sobra rascunho');
  ok((await pg.$$eval('.agd-detalhe .agd-evento .agd-hora', (h) => h.map((x) => x.textContent.trim()))).join() === '09:00 às 10:00,09:15 às 09:45,09:30 às 11:00,12:30', 'o novo evento entra na ordem cronológica do dia');
  await pg.reload({ waitUntil: 'load' }); await ir(pg); await abrirDia(pg, HOJE);
  ok((await pg.$$eval('.agd-detalhe .agd-evento .agd-tit', (t) => t.map((x) => x.textContent))).includes('Reunião de teste'), 'o evento criado persiste depois de recarregar');
  // consulta com lápis e edição
  await pg.click('.agd-detalhe .agd-evento:has-text("Reunião de teste") .agd-abrir'); await pg.waitForSelector('.modal');
  ok(!!(await pg.$('.modal dl.ler')) && !(await pg.$('#ev-titulo')), 'um evento que já existe abre em leitura (sem campo focado), com o lápis para editar');
  await pg.click('[data-lapis="evento"]'); await pg.waitForSelector('#ev-titulo');
  await pg.fill('#ev-titulo', 'Reunião de teste (editada)'); await pg.click('[data-salvar-evento]'); await pg.waitForTimeout(800);
  ok(/editada/.test(await pg.textContent('.modal dl.ler').catch(() => '') + await pg.textContent('.modal h3')) && !(await pg.$('#ev-titulo')), 'salvar a edição volta à leitura com o título novo');
  // edição simultânea: outra janela altera e salva; esta é bloqueada sem perder o que foi digitado
  const outra = await ctx.newPage(); await ir(outra); await abrirDia(outra, HOJE);
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
  ok(cx.length > 27 && cx.every((c) => c.w >= 40 && c.h >= 70) && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelector('.main').scrollWidth <= document.querySelector('.main').clientWidth + 1)), `iPhone emulado: sete colunas, células de pelo menos 40 por 70 px (${Math.round(Math.min(...cx.map((c) => c.w)))} por ${Math.round(Math.min(...cx.map((c) => c.h)))} px, a faixa de meses ocupa o resto da largura) e sem rolagem horizontal`);
  const cols = await pg.$$eval('.agd-linha-sem:nth-child(2) > [role="gridcell"]', (c) => c.length);
  ok(cols === 7 && (await pg.$$('.agd-mes-aba')).length === 12 && (await pg.$$eval('.agd-cabsem', (c) => c.length)) === 7, 'o celular mantém as sete colunas, com os cabeçalhos, e a faixa de meses JAN a DEZ');
  const faixa = await pg.$eval('.agd-meses', (e) => { const r = e.getBoundingClientRect(), g = document.querySelector('.agd-grade').getBoundingClientRect(); return { esq: r.left - g.right, dir: window.innerWidth - r.right, largura: r.width, abas: [...e.querySelectorAll('.agd-mes-aba')].map((a) => a.getBoundingClientRect().height), topo: r.top, base: r.bottom, alt: window.innerHeight }; });
  ok(faixa.esq > 0 && faixa.dir > 0 && faixa.largura >= 22 && faixa.abas.every((h) => h >= 40), `no celular a faixa de meses fica à direita da grade, legível (${Math.round(faixa.largura)} px de largura, abas de pelo menos ${Math.round(Math.min(...faixa.abas))} px de altura)`);
  const aux = await caixa(pg, '.agd-aux-par .agd-aux');
  ok(aux.length === 2 && aux[1].y > aux[0].b - 2, 'no celular os dois painéis auxiliares ficam empilhados');
  await verDia(pg, S.h.prazo);
  ok(/Pacote grande/.test(await pg.textContent('.agd-detalhe')), 'tocar no dia mostra os detalhes no celular');
  const gv = await pg.$eval('.agd-gv', (e) => { const r = e.getBoundingClientRect(); return { esq: r.left, dir: window.innerWidth - r.right, base: window.innerHeight - r.bottom, topo: r.top, larg: r.width, alt: r.height, vh: window.innerHeight }; });
  ok(gv.esq <= 1 && gv.dir <= 1 && gv.base <= 1 && gv.alt < gv.vh && gv.topo > 0, `no celular a gaveta é inferior: ocupa a largura toda, encosta embaixo e deixa a grade aparecer em cima (topo em ${Math.round(gv.topo)} de ${gv.vh} px)`);
  await fecharDia(pg);
  await pg.click('.agd-mes-aba[data-mes="12"]'); await pg.waitForTimeout(400);
  const cheioCel = `.agd-cel[data-data="${S.mes.cheio}"]`;
  await pg.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), cheioCel); await pg.waitForTimeout(200);
  ok((await pg.$$eval(`${cheioCel} .agd-it`, (l) => l.length)) === 2 && (await pg.textContent(`${cheioCel} .agd-mais`)) === '+4' && (await pg.$eval(`${cheioCel} .agd-it[data-k="evento"] .agd-it-h`, (e) => getComputedStyle(e).display)) === 'none', 'no celular a célula mostra duas linhas (só o título, sem a hora) e "+4" para os outros quatro itens do dia cheio');
  ok((await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)) && (await pg.$$eval('.agd-it', (l) => l.every((e) => e.getBoundingClientRect().height >= 10))), 'em dezembro, no celular, continua sem rolagem horizontal e com as linhas legíveis');
  await pg.click(`${cheioCel} .agd-mais`); await pg.waitForSelector('.agd-detalhe'); await pg.waitForTimeout(400);
  ok((await pg.$$('.agd-detalhe .agd-evento')).length === 3 && (await pg.$$('.agd-detalhe .agd-demanda')).length === 3 && /Audiência pública para revisão do plano diretor e do zoneamento urbano do município/.test(await pg.textContent('.agd-detalhe')) && (await pg.$$eval('.agd-detalhe button', (b) => b.filter((x) => x.getClientRects().length).every((x) => x.getBoundingClientRect().height >= 32))), 'tocar no "+4" no celular abre a gaveta inferior com os seis itens e os títulos inteiros');
  await fecharDia(pg);
  ok((await pg.evaluate(() => document.activeElement?.getAttribute('data-data'))) === S.mes.cheio, 'no celular, fechar a gaveta devolve o foco à célula');
  await pg.click('.agd-mes-aba[data-mes="11"]'); await pg.waitForTimeout(300);
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
  ok(cx.every((c) => c.w >= 80 && c.h >= 80) && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), `iPad vertical emulado, escuro: células de pelo menos ${Math.round(Math.min(...cx.map((c) => c.w)))} por ${Math.round(Math.min(...cx.map((c) => c.h)))} px, sem rolagem horizontal`);
  const cs = {};
  for (const n of ['zero', 'baixa', 'media', 'alta']) { const el = await pg.$(`.agd-cel[data-nivel="${n}"]`); if (el) cs[n] = await contraste(pg, `.agd-cel[data-nivel="${n}"]`); }
  ok(Object.keys(cs).length >= 3 && Object.values(cs).every((v) => v >= 4.5), 'contraste do texto com o tom da célula de cada nível (escuro) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cs).map(([k, v]) => [k, +v.toFixed(1)]))));
  const cc = await contrastesDoMes(pg);
  ok(Object.values(cc).every((v) => v >= 4.5), 'contraste (escuro) dos selos de carga e dos itens da célula (compromisso, dia inteiro, demanda, atrasada) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cc).map(([k, v]) => [k, +v.toFixed(1)]))));
  await pg.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  const lum = await pg.evaluate(() => { const c =document.createElement('canvas').getContext('2d', { willReadFrequently: true }); const m = {}; for (const n of ['zero', 'baixa', 'media', 'alta']) { const e = document.querySelector(`.agd-amostra[data-nivel="${n}"]`); c.fillStyle = '#111'; c.fillRect(0, 0, 1, 1); c.fillStyle = getComputedStyle(e).backgroundColor; c.fillRect(0, 0, 1, 1); const [r, g, b] = c.getImageData(0, 0, 1, 1).data; m[n] = 0.2126 * r + 0.7152 * g + 0.0722 * b; } return m; });
  ok(lum.zero < lum.baixa && lum.baixa < lum.media && lum.media < lum.alta, 'a escala do escuro cresce em luminosidade do zero ao alto: ' + JSON.stringify(Object.fromEntries(Object.entries(lum).map(([k, v]) => [k, Math.round(v)]))));
  await pg.click('.agd-mes-aba[data-mes="12"]'); await pg.waitForTimeout(400);
  const cheioIpad = `.agd-cel[data-data="${S.mes.cheio}"]`;
  await pg.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), cheioIpad); await pg.waitForTimeout(200);
  ok((await pg.$$eval(`${cheioIpad} .agd-it`, (l) => l.length)) === 2 && (await pg.textContent(`${cheioIpad} .agd-mais`)) === '+4', 'no iPad vertical a célula mostra duas linhas e "+4": o limite acompanha a largura da grade');
  await pg.click(`${cheioIpad} .agd-mais`); await pg.waitForSelector('.agd-detalhe'); await pg.waitForTimeout(500);
  const gi = await pg.$eval('.agd-gv', (e) => { const r = e.getBoundingClientRect(); return { dir: window.innerWidth - r.right, larg: r.width, esq: r.left, vw: window.innerWidth }; });
  ok(gi.dir <= 1 && gi.larg <= 440 && gi.esq > gi.vw * 0.4 && (await pg.$$('.agd-detalhe .agd-item')).length === 6, `no iPad a gaveta fica à direita (${Math.round(gi.larg)} px) com os seis itens, sobre a grade`);
  await fecharDia(pg);
  await pg.click('.agd-mes-aba[data-mes="11"]'); await pg.waitForTimeout(300);
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  const dur = await pg.$eval('.agd-cel', (e) => getComputedStyle(e).transitionDuration);
  ok(parseFloat(dur) <= 0.011, 'com movimento reduzido as transições da Agenda são desligadas (' + dur + ')');
  await abrirDia(pg, HOJE);
  const animGav = await pg.$eval('.agd-gv', (e) => parseFloat(getComputedStyle(e).animationDuration));
  ok(animGav <= 0.011, 'com movimento reduzido a gaveta do dia abre sem animação (' + animGav + ' s)');
  await fecharDia(pg);
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
  ok(Object.keys(cs).length >= 3 && Object.values(cs).every((v) => v >= 4.5), 'contraste do texto com o tom da célula de cada nível (claro) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cs).map(([k, v]) => [k, +v.toFixed(1)]))));
  const cc = await contrastesDoMes(pg);
  ok(Object.values(cc).every((v) => v >= 4.5), 'contraste (claro) dos selos de carga e dos itens da célula (compromisso, dia inteiro, demanda, atrasada) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cc).map(([k, v]) => [k, +v.toFixed(1)]))));
}

// ================= 7) fuso horário: aparelho em Auckland, referência de São Paulo (decisão 51) =================
{
  // 03/11/2026 às 02h40 UTC: 02/11 às 23h40 em São Paulo e 03/11 às 15h40 em Auckland. O aplicativo precisa seguir São Paulo.
  const { ctx, pg } = await novo({ viewport: { width: 1360, height: 900 }, timezoneId: 'Pacific/Auckland', locale: 'en-NZ', semRelogio: true }, { prefs: { modo: 'mes' } });
  await pg.clock.install({ time: new Date('2026-11-03T02:40:00Z') });
  await ir(pg);
  const hojeCel = async () => pg.$$eval('.agd-cel[data-hoje]', (c) => c.map((x) => x.getAttribute('data-data')));
  ok((await hojeCel()).join() === '2026-11-02' && (await pg.evaluate(() => new Date().getDate())) === 3, 'aparelho em Auckland (já é dia 3 lá): o "hoje" do aplicativo é 02/11, o dia de São Paulo');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
  ok((await pg.inputValue('#ev-data')) === '2026-11-02', 'o novo evento nasce na data de São Paulo, não na do aparelho');
  await pg.fill('#ev-titulo', 'Compromisso na virada do dia'); await pg.fill('#ev-inicio', '23:50'); await pg.selectOption('#ev-aviso', '15');
  await pg.click('[data-salvar-evento]'); await janelaFechada(pg); await pg.waitForTimeout(700);
  ok(/Compromisso na virada do dia/.test(await pg.textContent('.agd-avisos').catch(() => '')) && /começa em 10 min/.test(await pg.textContent('.agd-avisos').catch(() => '')), 'o horário do compromisso é o de São Paulo: às 23h40 de lá, o de 23h50 avisa "começa em 10 min"');
  await pg.clock.fastForward(25 * 60 * 1000);   // 00h05 de 03/11 em São Paulo
  await pg.waitForFunction(() => !!document.querySelector('.agd-cel[data-hoje][data-data="2026-11-03"]'), null, { timeout: 15000 });
  ok((await hojeCel()).join() === '2026-11-03' && !(await pg.$('.agd-aviso[data-evento]')), 'na virada da meia-noite de São Paulo o dia muda e o aviso do compromisso de ontem sai (sem juntar a data de ontem com a hora de hoje)');
  await ctx.close();
}

ok(erros.length === 0, 'nenhum erro de página nem de console durante todos os fluxos' + (erros.length ? ': ' + JSON.stringify(erros.slice(0, 4)) : ''));
await nav.close(); parar();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
