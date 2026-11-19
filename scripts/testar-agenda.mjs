// Agenda (decisões 46 a 49) no navegador (Edge) com o banco local de TESTE (PGlite, mesmas migrações do Supabase): Hoje, semana e mês; heatmap da carga pendente; marcos (vencimento, acompanhamento,
// retorno do setor); Aguardando Prefeita; eventos (criar, editar, excluir com confirmação, rascunho, sobreposição, clique repetido, falha de rede, edição simultânea); avisos; filtros; teclado;
// computador, iPad e iPhone emulados, claro e escuro. Sobe o próprio servidor numa porta separada, com dados semeados relativos a hoje. NÃO valida o Supabase real nem aparelho físico.
// Uso: node scripts/testar-agenda.mjs
import { abrirEdge, criarVerificador, iniciarServidor } from './auxiliar-navegador.mjs';
import { rmSync, mkdirSync } from 'node:fs';
import { semearAgenda } from './semear-agenda.mjs';
import { gradeMes, anoMes, diasNoMes, colunaNaSemana } from '../src/lib/agenda.ts';
import { retornoReferencia } from './auxiliar-retorno.mjs';   // a regra do retorno é do servidor; aqui só dá o valor esperado para comparar com o que a tela mostra
import { somarDias } from '../src/lib/prazos.ts';

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
const { parar } = await iniciarServidor({ porta: PORTA, pasta: PASTA });
const { ok, resumo, aguardar } = criarVerificador();

const nav = await abrirEdge();
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
const fecharDia = async (pg) => {
  if (await pg.$('.agd-detalhe')) { await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.agd-detalhe'), null, { timeout: 8000 }); await pg.waitForTimeout(150); }
  else if (await pg.$('.agd-dia-painel')) { await pg.click('.agd-dia-painel [aria-label="Fechar a lista do dia"]'); await pg.waitForFunction(() => !document.querySelector('.agd-dia-painel'), null, { timeout: 8000 }); await pg.waitForTimeout(150); } // celular (decisão 73): o painel abaixo da grade
};
const modo = async (pg, nome) => { await fecharDia(pg); await pg.click(`.agd-barra .opcoes button:has-text("${nome}")`); await pg.waitForTimeout(350); };
const paraData = async (pg, iso) => { await fecharDia(pg); await pg.fill('.agd-data input', iso); await pg.waitForFunction((d) => document.querySelector('.agd-data input')?.value === d, iso); await pg.waitForTimeout(250); };
const celula = (pg, d) => pg.locator(`.agd-cel[data-data="${d}"]`);
const selAtualDe = (pg) => pg.$eval('.agd-cel[data-sel]', (e) => e.getAttribute('data-data'));
const abrirDia = async (pg, d) => { await fecharDia(pg); await celula(pg, d).evaluate((e) => e.scrollIntoView({ block: 'center' })); await celula(pg, d).click(); await pg.waitForSelector('.agd-detalhe, .agd-dia-painel', { timeout: 10000 }); await pg.waitForTimeout(350); };
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

// área efetiva de toque: quantos pixels, em cada eixo pelo centro, respondem ao toque como o próprio controle (inclui a extensão por pseudo-elemento); rola o miolo até o centro antes
const areaEfetiva = async (pg, sel) => {
  await pg.evaluate((s) => { const m = document.querySelector('.main'), b = document.querySelector(s).getBoundingClientRect(); m.scrollTo({ top: m.scrollTop + b.y + b.height / 2 - innerHeight / 2, behavior: 'instant' }); }, sel); await pg.waitForTimeout(400);
  return pg.evaluate((s) => {
    const el = document.querySelector(s), b = el.getBoundingClientRect(), cx = Math.round(b.x + b.width / 2), cy = Math.round(b.y + b.height / 2);
    const dono = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const t = document.elementFromPoint(x, y); return !!t && el.contains(t); };
    if (!dono(cx, cy)) return { w: 0, h: 0 };
    let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
    while (dono(x0 - 1, cy) && cx - x0 < 80) x0--; while (dono(x1 + 1, cy) && x1 - cx < 80) x1++; while (dono(cx, y0 - 1) && cy - y0 < 80) y0--; while (dono(cx, y1 + 1) && y1 - cy < 80) y1++;
    return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }, sel);
};
// contraste de cada peça do Mês: novembro (hoje), o mês da demanda atrasada e dezembro (dia de carga alta), porque o selo "alta" e a linha de atraso só existem nesses meses
const contrastesDeTudo = async (pg) => { const r = {}; for (const d of [HOJE, S.b.prazo, S.mes.alta]) { await paraData(pg, d); Object.assign(r, await contrastesDoMes(pg)); } await paraData(pg, HOJE); return r; };
// as linhas da grade têm altura fixa (o que não cabe vira "+N"): no maior tamanho de texto que o usuário pode escolher (125%), nenhuma célula pode cortar a última linha nem o "+N"
const semCorte = (pg) => pg.evaluate(() => new Promise((res) => {
  const app = document.querySelector('.app'), antes = app.style.getPropertyValue('--esc'), fonte = () => parseFloat(getComputedStyle(document.querySelector('.agd-it-t') ?? document.querySelector('.agd-num')).fontSize);
  const f0 = fonte(); app.style.setProperty('--esc', String(0.85 * 1.25));
  setTimeout(() => {
    const cortados = [];
    for (const c of document.querySelectorAll('.agd-cel')) { const its = c.querySelector('.agd-its'); if (its?.lastElementChild && its.lastElementChild.getBoundingClientRect().bottom > c.getBoundingClientRect().bottom - 1) cortados.push(c.dataset.data); }
    const f1 = fonte(); if (antes) app.style.setProperty('--esc', antes); else app.style.removeProperty('--esc');
    res({ cortados, f0, f1 });
  }, 600);
}));
// contraste do texto com o fundo de cada peça do Mês que existir na tela (selo de carga por nível, itens da célula, abas)
const contrastesDoMes = async (pg) => {
  const alvos = { 'selo baixa': '.agd-cel[data-nivel="baixa"] .agd-qtd', 'selo média': '.agd-cel[data-nivel="media"] .agd-qtd', 'selo alta': '.agd-cel[data-nivel="alta"] .agd-qtd', compromisso: '.agd-it[data-k="evento"]:not([data-dia])', 'dia inteiro': '.agd-it[data-k="evento"][data-dia]', demanda: '.agd-it[data-k="demanda"]:not([data-atrasado])', atrasada: '.agd-it[data-atrasado]', 'aba atual': '.agd-mes-aba[aria-current="true"]', aba: '.agd-mes-aba:not([aria-current])', hoje: '.agd-cel[data-hoje] .agd-num' };
  const r = {};
  await pg.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  for (const [nome, sel] of Object.entries(alvos)) if (await pg.$(sel)) r[nome] = await contraste(pg, sel);
  return r;
};

// ================= 1) mês no computador, claro =================
const t1 = await novo({ viewport: { width: 1360, height: 900 } });
{
  const { pg } = t1;
  await ir(pg);
  ok(!!(await pg.$('.agd[data-modo="mes"]')) && (await pg.$$('.agd-barra .opcoes button')).length === 3, 'a Agenda abre no computador em Mês, com as três visões Dia, Semana e Mês, e a visão diária (antes chamada Hoje) mantém o identificador guardado');
  const { ano, mes } = anoMes(HOJE), g = gradeMes(ano, mes);
  // --- grade ---
  ok((await pg.getAttribute('.agd-grade', 'role')) === 'grid' && (await pg.$$('.agd-cabsem')).length === 7 && (await pg.$$('.agd-grade [role="row"]')).length === g.length + 1, 'calendário semântico: grade com sete cabeçalhos e uma linha por semana do mês');
  ok((await pg.$$eval('.agd-cabsem', (c) => c.map((x) => x.textContent.trim()).join())) === 'DOM,SEG,TER,QUA,QUI,SEX,SÁB' && (await pg.$$eval('.agd-semn', (c) => c.map((x) => x.textContent.trim()).join())) === g.map((_, i) => i + 1).join(), 'o cabeçalho vai de domingo a sábado e as semanas do mês são numeradas à esquerda');
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
  const recuada = await pg.$eval('.agd-vaz', (e) => { const s = getComputedStyle(e); return { bg: s.backgroundColor, sombra: s.boxShadow, cel: e.getBoundingClientRect().height }; });
  ok(!!(await pg.$('.agd-vaz')) && (await pg.$$('.agd-vaz')).length === g.flat().filter((x) => x === null).length && recuada.bg === 'rgba(0, 0, 0, 0)' && recuada.sombra !== 'none' && (await pg.$$('.agd-vaz .agd-num')).length === 0, 'as seis posições antes do dia 1 aparecem recuadas (sem preenchimento, só um contorno quase invisível) e sem número');
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
  const dRetorno = retornoReferencia({ etapa: 'Aguardando retorno', etapa_desde: S.d.etapa_desde, encaminhada_em: S.d.encaminhada_em, reiterada_em: S.d.reiterada_em, arquivada_em: null }, [S.dia]).data;
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
  const h = await selAtual(); ok((await colunaDe(h)) === 0 && new Date(`${h}T00:00:00Z`).getUTCDay() === 0, 'Home leva ao domingo da semana');
  await pg.keyboard.press('End'); await pg.waitForTimeout(200);
  const fim = await selAtual(); ok((await colunaDe(fim)) === 6 && new Date(`${fim}T00:00:00Z`).getUTCDay() === 6 && fim === somarDias(h, 6), 'End leva ao sábado da semana');
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
  ok((await pg.$$('.agd-cel')).length === 28 && (await pg.$$('.agd-vaz')).length === 7 && (await pg.$$('.agd-grade [role="row"]')).length === 6 && /Fevereiro\s+2027/i.test(await pg.textContent('.agd-periodo')), 'fevereiro de 2027 começa na segunda: uma posição vazia antes do dia 1 (domingo), seis depois do dia 28 e 5 semanas');
  await paraData(pg, '2026-02-10');
  ok((await pg.$$('.agd-cel')).length === 28 && (await pg.$$('.agd-vaz')).length === 0 && (await pg.$$('.agd-grade [role="row"]')).length === 5, 'mês que começa no domingo: fevereiro de 2026 abre na primeira célula e fecha em 4 semanas, sem espaços vazios');
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")');
  // --- legenda ---
  const leg = await pg.$eval('.agd-leg', (e) => { const u = e.querySelector('.agd-escala ul').getBoundingClientRect(), p = e.getBoundingClientRect(); return { t: e.textContent, n: e.querySelectorAll('.agd-escala .agd-amostra').length, rot: [...e.querySelectorAll('.agd-escala li')].map((l) => l.textContent.trim()).join('|'), desvio: Math.abs((u.left + u.right) / 2 - (p.left + p.right) / 2), uma: new Set([...e.querySelectorAll('.agd-escala li')].map((l) => Math.round(l.getBoundingClientRect().top))).size }; });
  ok(!/Menos pendências|Mais pendências/.test(leg.t) && leg.n === 4 && leg.rot === '0|1 a 3|4 a 7|8 ou mais' && leg.desvio < 6, `legenda de carga centralizada sob a grade, só com as quatro amostras e os rótulos 0, 1 a 3, 4 a 7 e 8 ou mais (desvio do centro ${leg.desvio.toFixed(1)} px, ${leg.uma} linha(s))`);
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
  const aux = await caixa(pg, '.agd-lateral .agd-aux'), calBox = (await caixa(pg, '.agd-cal'))[0], latBox = (await caixa(pg, '.agd-lateral'))[0];
  ok(aux.length === 2 && aux[0].x >= calBox.r && Math.abs(aux[0].x - aux[1].x) <= 2 && Math.abs(aux[0].w - aux[1].w) <= 2 && aux[1].y >= aux[0].b - 2 && Math.abs(aux[0].y - calBox.y) <= 2, 'no computador os dois painéis auxiliares ficam empilhados à direita da grade, o primeiro alinhado ao topo dela (decisão 73)');
  ok(Math.abs(aux[0].h - aux[1].h) > 20 && aux.every((a) => a.h < 700), `cada painel tem a altura do próprio conteúdo (${Math.round(aux[0].h)} e ${Math.round(aux[1].h)} px), sem esticar um para igualar o outro`);
  ok((await pg.evaluate(() => { const l = document.querySelector('.agd-lateral'); return [l, ...l.querySelectorAll('*')].every((e) => !/(auto|scroll)/.test(getComputedStyle(e).overflowY) || e.scrollHeight <= e.clientHeight + 1); })) && (await pg.evaluate(() => { const m = document.querySelector('.main'); return m.scrollWidth <= m.clientWidth + 1; })), 'a lateral não tem rolagem própria (só a página rola) e não há rolagem horizontal');
  ok(/sem nenhuma data/.test(await pg.textContent('.agd-lateral')) && (await pg.getAttribute('.agd-lateral [aria-labelledby="agd-sem-t"] .agd-qtd', 'title')).includes('Nada foi inventado'), 'demanda sem nenhuma data aparece em Pendências sem prazo, sem vencimento inventado');
  { const m = await pg.$$eval('.agd-lateral .agd-linha-carga', (ls) => ls.map((b) => { const t = b.querySelector('.agd-linha-data, .agd-linha-assunto'), r = t.getBoundingClientRect(), br = b.getBoundingClientRect(); return { w: r.width / br.width, h: r.height, lh: parseFloat(getComputedStyle(t).lineHeight) || 20 }; })); ok(m.length > 0 && m.every((x) => x.w > 0.4 && x.h < x.lh * 4.2), `painéis informativos: o título de cada linha ocupa a largura da linha e quebra naturalmente (${m.map((x) => Math.round(x.w * 100) + '%').join(', ')})`); }
  ok(/Onde novembro aperta/.test(await pg.textContent('.agd-lateral')) && /Pendências sem prazo/.test(await pg.textContent('.agd-lateral')) && !!latBox, 'o painel de dias cheios existe acima do de pendências sem prazo');
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
  const diaE = S.e.prazo;
  await paraData(pg, diaE);
  await modo(pg, 'Dia');
  await modo(pg, 'Semana');

  // --- Hoje ---
  await pg.click('.agd-nav .btn.mini:has-text("Hoje")'); await modo(pg, 'Dia');
  const secoes = await pg.$$eval('.agd-hoje > .agd-painel h3', (h) => h.map((x) => x.textContent.trim()));
  ok(secoes[0] === 'Compromissos e lembretes' && secoes[1] === 'Demandas e acompanhamentos' && secoes.includes('Pendências sem prazo'), 'Hoje separa os compromissos (cronológicos) das demandas e acompanhamentos e traz as pendências sem prazo');
  const horasH = await pg.$$eval('.agd-hoje .agd-evento .agd-hora', (h) => h.map((x) => x.textContent.trim()));
  ok(horasH.join() === '09:00 às 10:00,09:30 às 11:00,12:30', 'em Hoje os compromissos seguem a ordem cronológica');
  ok(/Atrasadas \(continuam no dia em que venceram\)/i.test(await pg.textContent('.agd-hoje')) && /Relatório atrasado/.test(await pg.textContent('.agd-hoje')), 'em Hoje as atrasadas aparecem à parte, lembrando que continuam no dia em que venceram');
  ok(!!(await pg.$('.agd-dia-info .btn:has-text("Novo evento hoje")')) && !!(await pg.$('.agd-dia-info [data-acao="dia-indisponivel"]')), 'a visão Dia tem "Novo evento hoje" e "Cadastrar dia indisponível" junto da data');
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
  const dRet = retornoReferencia({ etapa: 'Aguardando retorno', etapa_desde: S.d.etapa_desde, encaminhada_em: S.d.encaminhada_em, reiterada_em: S.d.reiterada_em, arquivada_em: null }, [S.dia]).data;
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
  ok(cheio.some((t) => /^\d\d:\d\d /.test(t)) && cheio.some((t) => /^Parecer de dezembro/.test(t)), 'o dia cheio (três compromissos e três vencimentos) mostra pelo menos um compromisso e um vencimento na grade: ' + JSON.stringify(cheio.map((t) => t.slice(0, 24))));
  // "+N" com filtros: só os itens realmente ocultos depois do filtro entram na conta; com uma linha só, o vencimento tem prioridade (a célula é reduzida por estilo para provar o limite de uma linha)
  const celCheio = `.agd-cel[data-data="${M.cheio}"]`, mais = async () => ((await pg.textContent(`${celCheio} .agd-mais`, { timeout: 1500 }).catch(() => null)) ?? '').trim();
  const fil = async (n) => { await pg.click(`.agd-filtros .opcoes button:has-text("${n}")`); await pg.waitForTimeout(300); };
  await fil('Demandas');
  const soDem = await itens(M.cheio);
  ok(soDem.length === 3 && soDem.every((t) => !/^\d\d:\d\d /.test(t)) && (await mais()) === '', 'filtro Demandas: o dia cheio mostra as três demandas e nenhum "+N" (o que o filtro tirou não conta como oculto)');
  await fil('Compromissos');
  const soEv = await itens(M.cheio);
  ok(soEv.length === 3 && soEv.every((t) => /^\d\d:\d\d /.test(t)) && (await mais()) === '', 'filtro Compromissos: os três compromissos e nenhum "+N"');
  await fil('Tudo');
  const estilo = await pg.addStyleTag({ content: '.agd .agd-cal { --agd-cel-h: 50px !important; } .agd-mes-aba { min-height: 6px !important; }' });
  await pg.waitForFunction((s) => document.querySelectorAll(`${s} .agd-it`).length === 1, celCheio, { timeout: 8000 }).catch(() => {});
  const um = await itens(M.cheio);
  ok(um.length === 1 && /^Parecer de dezembro/.test(um[0]) && (await mais()) === '+5', 'quando só cabe uma linha, o vencimento tem prioridade sobre os compromissos e o resto vira "+5": ' + JSON.stringify(um.map((t) => t.slice(0, 24))));
  await fil('Demandas'); const umD = await itens(M.cheio);
  ok(umD.length === 1 && (await mais()) === '+2', 'uma linha e filtro Demandas: a primeira demanda e "+2" (as outras duas)');
  await fil('Compromissos'); const umE = await itens(M.cheio);
  ok(umE.length === 1 && /^\d\d:\d\d /.test(umE[0]) && (await mais()) === '+2', 'uma linha e filtro Compromissos: o primeiro compromisso e "+2"');
  await fil('Tudo'); await estilo.evaluate((e) => e.remove());
  await pg.waitForFunction((s) => document.querySelectorAll(`${s} .agd-it`).length === 3, celCheio, { timeout: 8000 });
  ok((await mais()) === '+3', 'ao voltar ao tamanho normal e a Tudo, a célula volta a três linhas e "+3"');
  const cD = await semCorte(pg);
  ok(cD.f1 > cD.f0 && cD.cortados.length === 0, `computador, no texto a 125%: nenhuma célula corta a última linha nem o "+N" (fonte de ${cD.f0} para ${cD.f1} px)`);
  ok((await itens(M.vazio)).length === 0 && (await pg.$$(`.agd-cel[data-data="${M.vazio}"] .agd-mais`)).length === 0, 'dia vazio: nenhuma linha e nenhum "+N"');
  const aj = M.ajustado;
  ok(aj.prazo === '2026-12-04' && aj.prazo_original === '2026-12-05' && (await itens('2026-12-04')).some((t) => /Prazo ajustado de dezembro/.test(t)) && !(await itens('2026-12-05')).some((t) => /Prazo ajustado/.test(t)), 'o prazo que cairia no sábado aparece na sexta, o vencimento efetivo que o Dmanda já calcula');
  ok((await itens('2026-12-24', '[data-dia]')).join() === 'Dia todo Recesso do funcionalismo', 'dia inteiro em dezembro: "Dia todo" e o título');
  const longoCel = await pg.$eval(`.agd-cel[data-data="${M.cheio}"] .agd-it-t`, (e) => e.scrollWidth > e.clientWidth || e.textContent.length < 20);
  ok(longoCel, 'o título longo é cortado na célula (a gaveta o mostra inteiro)');
  await pg.click('.agd-nav [aria-label="Próximo mês"]'); await pg.waitForTimeout(350);
  const cabsJan = await caixa(pg, '.agd-cabsem'), jan1 = (await caixa(pg, '.agd-cel[data-data="2027-01-01"]'))[0];
  ok((await periodo()) === 'Janeiro 2027' && (await pg.getAttribute('.agd-meses', 'aria-label')) === 'Meses de 2027' && Math.abs((jan1.x + jan1.w / 2) - (cabsJan[5].x + cabsJan[5].w / 2)) <= 2 && (await selTxt()) === '2027-01-03', 'a seta atravessa dezembro e vai para janeiro de 2027: o ano das abas muda e 1º de janeiro (sexta) fica sob SEX, a sexta coluna');
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
  ok(/^Terça, 15 de dezembro$/.test(await pg.textContent('#agd-gv-t')) && (await pg.getAttribute('#agd-gv-t', 'aria-label')) === 'Terça-feira, 15 de dezembro de 2026' && (await pg.$$('.agd-detalhe .agd-evento')).length === 3 && (await pg.$$('.agd-detalhe .agd-demanda')).length === 3, 'tocar no "+N" abre a lista completa do dia: data por extenso, três compromissos e três demandas');
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
  ok(/Nada programado para este dia/.test(await pg.textContent('.agd-detalhe')) && /^(Terça|Quarta), 1[56] de dezembro$/.test(await pg.textContent('#agd-gv-t')) && /Daqui a \d+ dias?/.test(await pg.textContent('.agd-detalhe')), 'tocar no número do dia vazio abre a gaveta com "Nada programado para este dia."');
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

// a visão diária passou a se chamar Dia, mas o identificador guardado continua 'hoje': quem já tinha a preferência salva abre na mesma visão
{
  const { ctx, pg } = await novo({ viewport: { width: 1360, height: 900 } }, { prefs: { modo: 'hoje' } });
  await ir(pg);
  ok(!!(await pg.$('.agd[data-modo="hoje"]')) && (await pg.getAttribute('.agd-barra .opcoes button:has-text("Dia")', 'aria-pressed')) === 'true' && !(await pg.$('.agd-barra .opcoes button:has-text("Hoje")')), 'a preferência antiga (hoje) abre na visão Dia, e o rótulo Hoje só existe no atalho de voltar à data atual');
  await pg.click('.agd-barra .opcoes button:has-text("Semana")'); await pg.click('.agd-barra .opcoes button:has-text("Dia")'); await pg.waitForTimeout(300);
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('dmanda:agenda'))).modo === 'hoje' && (await pg.$$eval('.agd-hoje .agd-painel', (l) => l.length)) >= 2, 'escolher Dia grava o mesmo identificador de sempre e mostra a visão diária com os compromissos e as demandas');
  await ctx.close();
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
  // o Início não tem mais as listas (decisão 80): o contador abre Demandas já filtrada, e o Quadro mostra o conjunto
  const abrirContador = async (g) => { await pg.click(`.stats.tres .st-${g}`); await pg.waitForURL('**/demandas', { timeout: 20000 }); await pg.click('.toolbar .tabs button[data-v="quadro"]'); await pg.waitForTimeout(500); return pg.$$eval('.quadro .mini-card .assunto', (c) => c.map((x) => x.textContent)); };
  const naoAtrasadas = await abrirContador('atrasadas');
  ok(naoAtrasadas.join() === 'Relatório atrasado', 'Início: a lista de atrasadas traz só quem tem data aplicável vencida');
  await ir(pg, '/');
  const sete = await abrirContador('sete');
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
  const novaData = retornoReferencia({ etapa: 'Aguardando retorno', etapa_desde: S.d.etapa_desde, encaminhada_em: S.d.encaminhada_em, reiterada_em: HOJE, arquivada_em: null }, [S.dia]);
  ok(novaData.origem === 'reiteração' && novaData.base === HOJE && /Retorno reiterado em/.test(await pg.textContent('.modal')), 'reiteração registrada vale como nova base e aparece na consulta');
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
  await modo(pg, 'Dia');
  ok((await pg.$$eval('.agd-hoje .agd-evento .agd-tit', (t) => t.map((x) => x.textContent))).filter((x) => x === 'Evento durante a queda').length === 1, 'com a conexão de volta, repetir cria o evento uma única vez');
}

// ================= 2c) domingo a sábado, cinza de dia sem trabalho, Semana e Dia na direção do Mês e cadastro de dia indisponível pela Agenda (14/11/2026) =================
{
  const { ctx, pg } = await novo({ viewport: { width: 1360, height: 900 } }, { prefs: { modo: 'mes' } });
  let bloquear = false;
  await pg.route('**/*', (r) => (bloquear && r.request().method() === 'POST' && r.request().headers()['next-action'] ? r.abort() : r.continue()));
  await ir(pg);
  const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
  const g = await pg.evaluate(() => ({ cab: [...document.querySelectorAll('.agd-cabsem')].map((e) => e.hasAttribute('data-nao-util')), cels: [...document.querySelectorAll('.agd-cel')].map((e) => ({ d: e.dataset.data, n: e.dataset.naoUtil !== undefined, f: e.dataset.feriado !== undefined, nivel: e.dataset.nivel, hoje: e.dataset.hoje !== undefined, sel: e.dataset.sel !== undefined, bg: getComputedStyle(e).backgroundColor })) }));
  ok(g.cab.join() === 'true,false,false,false,false,false,true', 'Mês: o cabeçalho de domingo (primeira coluna) e o de sábado (última) têm o tom cinza');
  ok(g.cels.every((c) => c.n === (dow(c.d) === 0 || dow(c.d) === 6 || c.d === S.dia.data)) && g.cels.find((c) => c.d === S.dia.data)?.f && dow(S.dia.data) > 0 && dow(S.dia.data) < 6, `Mês: sábados, domingos e o feriado cadastrado num dia útil (${S.dia.data}) têm o tratamento de dia sem trabalho, e só eles`);
  const livre = (c) => c.nivel === 'zero' && !c.hoje && !c.sel, fer = g.cels.find((c) => c.d === S.dia.data), sab = g.cels.find((c) => dow(c.d) === 6 && livre(c)), util = g.cels.find((c) => !c.n && livre(c));
  ok(fer.bg === sab.bg && sab.bg !== util.bg, `Mês: o feriado em dia útil é tão reconhecível quanto o sábado (mesmo cinza ${fer.bg}, diferente do dia útil ${util.bg})`);
  // Semana: domingo a sábado em sete colunas, com o dia escolhido inteiro abaixo; o teclado anda pelos dias
  await modo(pg, 'Semana'); await paraData(pg, S.dia.data);
  const sem = await pg.evaluate(() => ({ cols: [...document.querySelectorAll('.agd-sem .agd-dia')].map((e) => ({ d: e.dataset.data, n: e.dataset.naoUtil !== undefined })), faixa: !!document.querySelector('.agd-sem-faixa'), det: document.querySelector('#agd-sem-detalhe')?.dataset.data, detTxt: document.querySelector('#agd-sem-detalhe')?.textContent ?? '' }));
  ok(sem.cols.length === 7 && dow(sem.cols[0].d) === 0 && dow(sem.cols[6].d) === 6 && !sem.faixa && sem.cols.filter((c) => c.n).length === 3, 'Semana larga: sete colunas de domingo a sábado; domingo, sábado e o feriado da semana em cinza');
  ok(sem.det === S.dia.data && /Feriado: Feriado de teste/.test(sem.detTxt) && /Dia indisponível/.test(sem.detTxt) && /Novo evento neste dia/.test(sem.detTxt), 'Semana: o dia escolhido aparece inteiro abaixo, com a identificação do feriado e as duas ações da data');
  await pg.focus(`.agd-dia-sel[data-sem-dia="${S.dia.data}"]`); await pg.keyboard.press('Home'); await pg.waitForTimeout(250);
  const selS = () => pg.$eval('.agd-dia[data-sel]', (e) => e.dataset.data), focoS = () => pg.evaluate(() => document.activeElement?.dataset?.semDia ?? null);
  ok((await selS()) === sem.cols[0].d && (await focoS()) === sem.cols[0].d, 'Semana: Home leva ao domingo da semana, com o foco');
  await pg.keyboard.press('End'); await pg.waitForTimeout(250);
  ok((await selS()) === sem.cols[6].d && (await focoS()) === sem.cols[6].d, 'Semana: End leva ao sábado da semana');
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(350);
  ok((await selS()) === somarDias(sem.cols[6].d, 1) && dow(await selS()) === 0 && (await pg.$eval('#agd-sem-detalhe', (e) => e.dataset.data)) === somarDias(sem.cols[6].d, 1), 'Semana: a seta depois do sábado passa ao domingo da semana seguinte, e o detalhe acompanha');
  // o painel de carga da Semana escolhe o dia na própria Semana
  await paraData(pg, S.h.prazo);
  await pg.click('.agd-aux-par .agd-linha'); await pg.waitForTimeout(400);
  ok((await pg.$('.agd[data-modo="semana"]')) !== null && (await pg.$eval('#agd-sem-detalhe', (e) => e.dataset.data)) === S.h.prazo, 'Semana: "Onde a semana aperta" escolhe o dia cheio dentro da própria Semana');
  // Dia: a data é o título, com o cinza e a identificação textual; dois painéis lado a lado
  await modo(pg, 'Dia'); await paraData(pg, S.dia.data);
  const dia = await pg.evaluate(() => { const p = [...document.querySelectorAll('.agd-hoje > .agd-painel')].map((e) => e.getBoundingClientRect()); return { nu: document.querySelector('.agd-resumo')?.dataset.naoUtil !== undefined, titulo: document.querySelector('.agd-periodo')?.textContent, marca: document.querySelector('.agd-dia-info .agd-marca-dia')?.textContent ?? '', lado: p.length >= 2 && Math.abs(p[0].top - p[1].top) < 2 && p[1].left > p[0].right - 1 }; });
  ok(dia.nu && /^Terça-feira, 10 de novembro de 2026$/.test(dia.titulo) && /Feriado: Feriado de teste/.test(dia.marca) && dia.lado, `Dia: a data é o título (${dia.titulo}), o cabeçalho fica cinza e diz "Feriado: Feriado de teste"; Compromissos e Demandas lado a lado`);
  await paraData(pg, '2026-11-07');
  ok((await pg.$eval('.agd-resumo', (e) => e.dataset.naoUtil !== undefined)) && /Sábado, fim de semana/.test(await pg.textContent('.agd-dia-info')), 'Dia: o sábado tem o cabeçalho cinza e a identificação "Sábado, fim de semana"');
  await paraData(pg, '2026-11-05');
  ok(!(await pg.$eval('.agd-resumo', (e) => e.dataset.naoUtil !== undefined)) && !(await pg.$('.agd-dia-info .agd-marca-dia')), 'Dia: num dia útil comum não há cinza nem marca');
  // alternar a visão mantém a data; as setas andam um dia, sete dias ou um mês
  await pg.click('.agd-nav [aria-label="Próximo dia"]'); await pg.waitForTimeout(250);
  ok((await pg.inputValue('.agd-data input')) === '2026-11-06', 'Dia: a seta avança um dia');
  await modo(pg, 'Semana');
  ok((await pg.$eval('#agd-sem-detalhe', (e) => e.dataset.data)) === '2026-11-06', 'de Dia para Semana a data escolhida continua');
  await pg.click('.agd-nav [aria-label="Próxima semana"]'); await pg.waitForTimeout(250);
  ok((await pg.inputValue('.agd-data input')) === '2026-11-13', 'Semana: a seta avança sete dias');
  await modo(pg, 'Mês');
  ok((await selAtualDe(pg)) === '2026-11-13', 'de Semana para Mês a data escolhida continua selecionada');
  await pg.click('.agd-nav [aria-label="Próximo mês"]'); await pg.waitForTimeout(250);
  ok((await pg.inputValue('.agd-data input')) === '2026-12-13', 'Mês: a seta avança um mês');

  // ---- cadastro pela Agenda: Dia (com falha, validação, clique duplo, rascunho e foco), Semana (outra data) e gaveta do Mês ----
  await modo(pg, 'Dia'); await paraData(pg, '2027-03-05');
  await pg.click('.agd-dia-info [data-acao="dia-indisponivel"]'); await pg.waitForSelector('#di-data');
  ok((await pg.inputValue('#di-data')) === '2027-03-05' && (await pg.inputValue('#di-cat')) === 'Feriado' && /Cadastrar dia ou período indisponível/.test(await pg.textContent('.modal #m-tit')), 'Dia: "Cadastrar dia ou período indisponível" abre o formulário de Data inicial, Data final (opcional), Tipo e Descrição com a data do dia, editável');
  await pg.click('[data-salvar-dia]'); await pg.waitForTimeout(250);
  ok(/Descreva o dia/.test(await pg.textContent('.modal')) && (await pg.evaluate(() => document.activeElement?.id)) === 'di-desc', 'sem descrição: a mensagem de sempre e o foco no campo');
  await pg.fill('#di-desc', 'Ponto facultativo de teste');
  bloquear = true; await pg.click('[data-salvar-dia]'); await pg.waitForTimeout(1500);
  ok(!!(await pg.$('.modal')) && (await pg.inputValue('#di-desc')) === 'Ponto facultativo de teste' && /(Nada foi gravado|Não foi possível confirmar se foi gravado|Sem confirmação do servidor)[^]*O que você digitou continua aqui/.test(await pg.textContent('.modal')), 'falha de gravação: a janela continua aberta com o que foi digitado e diz o motivo (o do contexto: sem conexão ou sem confirmação)');
  bloquear = false; await pg.waitForTimeout(300);
  await pg.dblclick('[data-salvar-dia]'); await janelaFechada(pg); await pg.waitForTimeout(800);
  ok((await pg.evaluate(() => document.activeElement?.dataset?.acao)) === 'dia-indisponivel', 'ao fechar, o foco volta ao botão que abriu a janela');
  ok((await pg.$eval('.agd-resumo', (e) => e.dataset.naoUtil !== undefined)) && /Ponto facultativo de teste/.test(await pg.textContent('.agd-dia-info')) && (await pg.$('.agd[data-modo="hoje"]')) !== null, 'depois da gravação confirmada o Dia continua aberto e já mostra o feriado, com o cinza');
  ok(/Dia indisponível cadastrado em sexta-feira, 5 de março de 2027/.test(await pg.textContent('#toast')), 'o aviso diz em que data o dia foi salvo');
  // rascunho: Esc guarda, reabrir recupera, Cancelar descarta
  await pg.click('.agd-dia-info [data-acao="dia-indisponivel"]'); await pg.waitForSelector('#di-desc');
  await pg.fill('#di-desc', 'Rascunho que não se perde'); await pg.waitForTimeout(700); await pg.keyboard.press('Escape'); await janelaFechada(pg);
  await pg.click('.agd-dia-info [data-acao="dia-indisponivel"]'); await pg.waitForSelector('#di-desc');
  ok((await pg.inputValue('#di-desc')) === 'Rascunho que não se perde' && /Rascunho recuperado/.test(await pg.textContent('.modal')), 'Esc guarda o rascunho e reabrir o recupera');
  await pg.click('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  await pg.click('.agd-dia-info [data-acao="dia-indisponivel"]'); await pg.waitForSelector('#di-desc');
  ok((await pg.inputValue('#di-desc')) === '', 'Cancelar descarta o rascunho');
  await pg.click('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  // Semana: a data muda no formulário e a janela e o aviso dizem onde o registro ficou
  await modo(pg, 'Semana'); await paraData(pg, '2027-03-09');
  await pg.click('#agd-sem-detalhe [data-acao="dia-indisponivel"]'); await pg.waitForSelector('#di-data');
  ok((await pg.inputValue('#di-data')) === '2027-03-09', 'Semana: o detalhe do dia escolhido abre o mesmo formulário com a data dele');
  await pg.fill('#di-data', '2027-03-10'); await pg.selectOption('#di-cat', 'Evento externo'); await pg.fill('#di-desc', 'Congresso de teste'); await pg.waitForTimeout(200);
  ok(/Vai ser salvo em Quarta-feira, 10 de março de 2027, não no dia aberto na Agenda/.test(await pg.textContent('[data-outra-data]')), 'com a data alterada, a janela diz onde o registro vai ser salvo');
  await pg.click('[data-salvar-dia]'); await janelaFechada(pg); await pg.waitForTimeout(800);
  ok(/cadastrado em quarta-feira, 10 de março de 2027 \(a Agenda estava em terça-feira, 9 de março de 2027\)/.test(await pg.textContent('#toast')) && (await pg.$('.agd[data-modo="semana"]')) !== null && (await pg.$eval('#agd-sem-detalhe', (e) => e.dataset.data)) === '2027-03-09', 'o aviso diz a data salva e a da Agenda; a Semana continua no dia em que a ação começou');
  ok(/Congresso de teste/.test(await pg.textContent('.agd-dia[data-data="2027-03-10"]')) && (await pg.$eval('.agd-dia[data-data="2027-03-10"]', (e) => e.dataset.naoUtil === undefined)), 'o evento externo aparece na coluna do dia certo, sem o cinza (só o Feriado deixa o dia cinza)');
  // Mês: gaveta do dia
  await modo(pg, 'Mês'); await paraData(pg, '2027-03-15'); await abrirDia(pg, '2027-03-15');
  await pg.click('.agd-gv [data-acao="dia-indisponivel"]'); await pg.waitForSelector('#di-data');
  ok((await pg.inputValue('#di-data')) === '2027-03-15', 'Mês: a gaveta do dia abre o formulário com a data dela');
  await pg.fill('#di-desc', 'Recesso de teste'); await pg.click('[data-salvar-dia]'); await janelaFechada(pg); await pg.waitForTimeout(800);
  ok(!!(await pg.$('.agd-gv')) && /Recesso de teste/.test(await pg.textContent('.agd-gv')) && (await celula(pg, '2027-03-15').getAttribute('data-nao-util')) !== null, 'depois de salvar, a gaveta continua aberta com o feriado e a célula ganha o cinza');
  await fecharDia(pg);
  // Configurações: a lista cronológica traz os três, e editar e excluir funcionam
  await ir(pg, '/config'); await pg.waitForSelector('.cfg-lista');
  const lista = await pg.$$eval('.cfg-lista li', (l) => l.map((e) => e.querySelector('.cfg-desc').textContent));
  const i1 = lista.indexOf('Ponto facultativo de teste'), i2 = lista.indexOf('Congresso de teste'), i3 = lista.indexOf('Recesso de teste');
  ok(i1 >= 0 && i1 < i2 && i2 < i3 && lista.filter((x) => x === 'Ponto facultativo de teste').length === 1, 'Configurações: os dias cadastrados pela Agenda aparecem uma vez cada, em ordem de data (o clique duplo gravou uma vez só)');
  ok(/Cadastrar dia ou período indisponível/.test(await pg.textContent('#cfg-novo-t')) && (await pg.$$eval('.cfg-dias-form .cfg-form label', (l) => l.map((x) => x.textContent).join())) === 'Data inicial,Data final (opcional),Tipo,Descrição', 'Configurações: o mesmo formulário (Data inicial, Data final opcional, Tipo e Descrição), com o título "Cadastrar dia ou período indisponível"');
  await pg.click('[aria-label="Editar Ponto facultativo de teste"]'); await pg.fill('#cfg-desc', 'Ponto facultativo editado'); await pg.click('.cfg-form .btn.pri');
  await aguardar(pg.waitForFunction(() => document.querySelector('.cfg-lista')?.textContent.includes('Ponto facultativo editado'), null, { timeout: 15000 }), 'Configurações: editar o dia cadastrado pela Agenda funciona');
  for (const d of ['Ponto facultativo editado', 'Congresso de teste', 'Recesso de teste']) { await pg.click(`[aria-label="Excluir ${d}"]`); await pg.click('.cfg-lista .btn:has-text("Confirmar exclusão")'); await pg.waitForFunction((x) => !document.querySelector('.cfg-lista')?.textContent.includes(x), d, { timeout: 15000 }); }
  ok(!/Ponto facultativo|Congresso de teste|Recesso de teste/.test((await pg.textContent('.cfg-dias')) ?? ''), 'Configurações: excluir tira os três dias (o calendário volta ao que era)');
  await ctx.close();
}

// ================= 5) avisos dentro do aplicativo (relógio controlado) =================
// O relógio do navegador fica fixo na data de referência e na hora escolhida, então o resultado não depende da hora real da execução (antes, o evento fictício das 12h30,
// com aviso de 30 minutos, entrava na contagem de quem rodava o teste entre 12h00 e 12h30). 12h10 cai dentro da janela do Almoço (12h30, aviso de 30 min); 07h30 não cai
// em nenhuma janela da massa de eventos (Reunião às 09h00 com aviso de 15 min só avisa a partir das 08h45).
const comRelogio = async (hhmm) => {
  const t = await novo({ viewport: { width: 1360, height: 900 }, semRelogio: true }, { prefs: { modo: 'mes' } });
  await t.ctx.clock.install({ time: new Date(`${REFERENCIA}T${hhmm}:00-03:00`) });
  await t.ctx.clock.setFixedTime(new Date(`${REFERENCIA}T${hhmm}:00-03:00`));
  await ir(t.pg);
  return t;
};
const criarEvento = async (pg, titulo, inicio, aviso) => {
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
  await pg.fill('#ev-titulo', titulo); await pg.fill('#ev-inicio', inicio); await pg.selectOption('#ev-aviso', String(aviso));
  await pg.click('[data-salvar-evento]'); await janelaFechada(pg); await pg.waitForTimeout(600);
};
const avisosTexto = async (pg) => (await pg.$$eval('.agd-aviso', (l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | ');
{
  // 12h10: só o Almoço (12h30, aviso de 30 min) está na janela
  const { ctx, pg } = await comRelogio('12:10');
  ok((await pg.evaluate(() => new Date().toISOString())).startsWith(`${REFERENCIA}T15:10`), 'o relógio do navegador está fixo em 12h10 de São Paulo, na data de referência');
  let rot = await pg.getAttribute('.sino', 'aria-label');
  ok(/Avisos: 1 para hoje/.test(rot) && (await pg.textContent('.sino-n')) === '1' && /Almoço com a prefeita começa em 20 min \(12:30\)/.test(await avisosTexto(pg)) && !/Reunião de secretariado/.test(await avisosTexto(pg)), `12h10: o sino conta 1 aviso, o do Almoço das 12h30 ("começa em 20 min"); a reunião das 09h00 já passou (${rot})`);
  // mais um evento dentro da janela: a contagem sobe para 2 e cada aviso diz o seu horário
  await criarEvento(pg, 'Reunião que vai começar', '12:20', 15);
  rot = await pg.getAttribute('.sino', 'aria-label');
  const dois = await avisosTexto(pg);
  ok(/Avisos: 2 para hoje/.test(rot) && (await pg.textContent('.sino-n')) === '2' && /Reunião que vai começar começa em 10 min \(12:20\)/.test(dois) && /Almoço com a prefeita começa em 20 min/.test(dois), `12h10: com um evento às 12h20 (aviso de 15 min) o sino conta 2 (${dois})`);
  await pg.click('.agd-aviso:has-text("Reunião que vai começar") .btn:has-text("Dispensar")'); await pg.waitForTimeout(300);
  rot = await pg.getAttribute('.sino', 'aria-label');
  ok(/Avisos: 1 para hoje/.test(rot) && !/Reunião que vai começar/.test(await avisosTexto(pg)) && /Almoço com a prefeita/.test(await avisosTexto(pg)), 'dispensar o aviso da reunião tira só ele: o do Almoço e a contagem 1 continuam');
  await pg.reload({ waitUntil: 'load' }); await ir(pg);
  ok(!/Reunião que vai começar/.test(await avisosTexto(pg)) && /Almoço com a prefeita/.test(await avisosTexto(pg)), 'depois de recarregar, o aviso dispensado não volta e o do Almoço segue');
  await ctx.close();
}
{
  // 07h30: nenhuma janela aberta; um evento às 07h40 com aviso de 15 min vira o único aviso
  const { ctx, pg } = await comRelogio('07:30');
  let rot = await pg.getAttribute('.sino', 'aria-label');
  ok(/nenhum agora/.test(rot) && !(await pg.$('.agd-aviso')), `07h30: nenhum aviso (${rot})`);
  await criarEvento(pg, 'Reunião das 07h40', '07:40', 15);
  rot = await pg.getAttribute('.sino', 'aria-label');
  ok(!!(await pg.$('.agd-aviso[data-evento]')) && /Reunião das 07h40 começa em 10 min \(07:40\)/.test(await avisosTexto(pg)) && /Avisos: 1 para hoje/.test(rot) && (await pg.textContent('.sino-n')) === '1', `07h30: um evento a 10 minutos do início, com aviso de 15, mostra o aviso dentro do aplicativo e o sino conta 1 (${await avisosTexto(pg)})`);
  await pg.click('.agd-aviso .btn:has-text("Dispensar")'); await pg.waitForTimeout(300);
  ok(!(await pg.$('.agd-aviso')) && /nenhum agora/.test(await pg.getAttribute('.sino', 'aria-label')), 'dispensar tira o aviso e o contador');
  await pg.reload({ waitUntil: 'load' }); await ir(pg);
  ok(!(await pg.$('.agd-aviso[data-evento]')), 'o aviso dispensado não volta ao recarregar');
  await ctx.close();
}

// ================= 6) iPhone, iPad, escuro, movimento reduzido =================
const t3 = await novo({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
{
  const { pg } = t3;
  await ir(pg);
  ok(!!(await pg.$('.agd[data-modo="hoje"]')), 'no celular, sem preferência salva, a Agenda abre em Hoje');
  await modo(pg, 'Mês');
  const cx = await caixa(pg, '.agd-cel');
  ok(cx.length > 27 && cx.every((c) => c.w >= 44 && Math.abs(c.w - c.h) < 1.5) && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelector('.main').scrollWidth <= document.querySelector('.main').clientWidth + 1)), `iPhone emulado: sete colunas de quadrados (1:1) de pelo menos 44 px (${Math.round(Math.min(...cx.map((c) => c.w)))} por ${Math.round(Math.min(...cx.map((c) => c.h)))} px, a faixa de meses ocupa o resto da largura) e sem rolagem horizontal`);
  // grade quadrada (14/11/2026): só o número e o preenchimento da carga; nada de pílulas, "+N", selo, pontos ou barras dentro da célula
  const hm = await pg.evaluate(() => {
    const cels = [...document.querySelectorAll('.agd-cel')], niveis = {};
    for (const n of ['zero', 'baixa', 'media', 'alta']) { const e = cels.find((c) => c.dataset.nivel === n && c.dataset.naoUtil === undefined && c.dataset.hoje === undefined && c.dataset.sel === undefined); if (e) niveis[n] = getComputedStyle(e).backgroundColor; }
    const fds = cels.filter((c) => c.dataset.naoUtil !== undefined);
    const fdsCarga = fds.find((c) => c.dataset.nivel !== 'zero' && c.dataset.sel === undefined), utilMesmoNivel = fdsCarga ? cels.find((c) => c.dataset.naoUtil === undefined && c.dataset.nivel === fdsCarga.dataset.nivel && c.dataset.sel === undefined && c.dataset.hoje === undefined) : null;
    return { extras: cels.some((c) => c.querySelector('.agd-it, .agd-mais, .agd-qtd, .agd-evm, .agd-atr')), depois: cels.filter((c) => getComputedStyle(c, '::after').content !== 'none' && getComputedStyle(c, '::after').display !== 'none').length, niveis,
      borda: fds.every((c) => /\b2px\b/.test(getComputedStyle(c).boxShadow)), mesmoFill: fdsCarga && utilMesmoNivel ? getComputedStyle(fdsCarga).backgroundColor === getComputedStyle(utilMesmoNivel).backgroundColor : null, nFds: fds.length };
  });
  ok(!hm.extras && hm.depois === 0, 'no celular a célula tem só o número e o preenchimento: sem títulos, "+N", contagem, pontos de compromisso ou de atraso e sem barra de indisponibilidade');
  ok(hm.nFds >= 9 && hm.borda && hm.mesmoFill !== false, `sábado, domingo e feriado têm contorno cinza de 2 px, visível também sobre o preenchimento, que é o mesmo da carga num dia útil (${hm.nFds} dias)`);
  ok(new Set(Object.values(hm.niveis)).size === Object.keys(hm.niveis).length && Object.keys(hm.niveis).length >= 3, `o preenchimento distingue os níveis de carga (${Object.keys(hm.niveis).join(', ')}) em tema claro`);
  const cols = await pg.$$eval('.agd-linha-sem:nth-child(2) > [role="gridcell"]', (c) => c.length);
  ok(cols === 7 && (await pg.$$eval('.agd-cabsem', (c) => c.map((x) => x.textContent.trim()).join())) === 'DOM,SEG,TER,QUA,QUI,SEX,SÁB' && !(await pg.isVisible('.agd-meses')) && (await pg.isVisible('.agd-mes-sel select')), 'o celular mantém as sete colunas de domingo a sábado; o mês fica no seletor junto do período (os quadrados não deixam altura para as doze abas)');
  const aux = await caixa(pg, '.agd-lateral .agd-aux'), calB = (await caixa(pg, '.agd-cal'))[0];
  ok(aux.length === 2 && aux[1].y > aux[0].b - 2 && aux[0].y >= calB.b - 2, 'no celular os dois painéis auxiliares ficam empilhados abaixo do calendário');
  // cabeçalho compacto: a grade começa bem mais perto do topo (antes do ajuste ela começava a 533 px, com a faixa de teste terminando em 126 px)
  const topo = await pg.evaluate(() => ({ grade: document.querySelector('.agd-grade').getBoundingClientRect().top, cab: document.querySelector('.agd-cab-pag').getBoundingClientRect().top, faixa: document.querySelector('.faixa-teste')?.getBoundingClientRect().bottom ?? null }));
  ok(topo.faixa !== null && topo.grade - topo.cab <= 260, `iPhone 390 com a faixa de teste visível: a grade começa a ${Math.round(topo.grade - topo.cab)} px do título da página (${Math.round(topo.grade)} px do topo, com a faixa terminando em ${Math.round(topo.faixa)} px); antes do ajuste eram cerca de 395 px`);
  // filtros num controle compacto, com indicação de filtros ativos
  const vis = (sel) => pg.isVisible(sel);
  ok(!(await vis('.agd-filtros')) && (await vis('.agd-filtros-bt')) && (await pg.getAttribute('.agd-filtros-bt', 'aria-expanded')) === 'false' && !(await pg.$('.agd-novo')) && (await vis('.agd-ir-rot')) && !(await pg.$('.agd-filtros-bt[data-ativos]')), 'no celular os filtros ficam recolhidos num botão Filtros, sem indicação enquanto nada está filtrado; o Novo evento saiu da faixa das visões (decisão 76) e Ir para a data continua à vista');
  await pg.click('.agd-filtros-bt'); await pg.waitForTimeout(250);
  ok((await vis('.agd-filtros')) && (await pg.getAttribute('.agd-filtros-bt', 'aria-expanded')) === 'true' && (await pg.$$eval('.agd-filtros .opcoes button', (b) => b.map((x) => x.textContent))).join() === 'Tudo,Demandas,Compromissos' && (await pg.$$('.agd-filtros .agd-chk input')).length === 2, 'abrir Filtros mostra Tudo, Demandas, Compromissos, Tarefas concluídas e Demandas finalizadas');
  await pg.click('.agd-filtros .opcoes button:has-text("Compromissos")'); await pg.check('.agd-filtros .agd-chk:has-text("Demandas finalizadas") input'); await pg.waitForTimeout(300);
  ok((await pg.getAttribute('.agd-filtros-bt', 'data-ativos')) === '2' && /2 ativos/.test(await pg.getAttribute('.agd-filtros-bt', 'aria-label')) && (await pg.textContent('.agd-filtros-n')) === '2' && (await pg.$$('.agd-cel:not([data-nivel="zero"])')).length === 0, 'com dois filtros ativos o botão mostra o número 2 e a grade só tem compromissos');
  await pg.click('.agd-filtros .opcoes button:has-text("Tudo")'); await pg.uncheck('.agd-filtros .agd-chk:has-text("Demandas finalizadas") input'); await pg.click('.agd-filtros-bt'); await pg.waitForTimeout(250);
  ok(!(await vis('.agd-filtros')) && !(await pg.$('.agd-filtros-bt[data-ativos]')) && (await pg.$$('.agd-cel:not([data-nivel="zero"])')).length > 0, 'desfeitos os filtros, a indicação some, o painel recolhe e a carga das demandas volta à grade');
  // alvos de toque de 44 px na data e na faixa de meses, sem sobrepor os vizinhos
  const aCel = await areaEfetiva(pg, '.agd-cel[data-data="2026-11-11"]'), aSel = await caixa(pg, '.agd-mes-sel select');
  ok(aCel.w >= 44 && aCel.h >= 44 && aSel[0].h >= 40, `iPhone 390: área efetiva de toque da data ${aCel.w}x${aCel.h} px; o seletor de mês tem ${Math.round(aSel[0].h)} px de altura`);
  // tocar numa data: o painel do dia abre logo abaixo da grade, no fluxo da página, e a grade não se mexe
  const antesGrade = await pg.evaluate(() => { const g = document.querySelector('.agd-grade').getBoundingClientRect(); return { y: g.top + document.querySelector('.main').scrollTop, h: g.height, w: g.width }; });
  await paraData(pg, S.h.prazo); await abrirDia(pg, S.h.prazo); await pg.waitForTimeout(700);
  ok(!(await pg.$('.agd-detalhe')) && !!(await pg.$('.agd-dia-painel')) && /Pacote grande/.test(await pg.textContent('.agd-dia-painel')), 'tocar no dia mostra os itens num painel abaixo da grade (sem gaveta) no celular');
  const pn = await pg.evaluate(() => {
    const p = document.querySelector('.agd-dia-painel').getBoundingClientRect(), g = document.querySelector('.agd-grade').getBoundingClientRect(), leg = document.querySelector('.agd-leg').getBoundingClientRect(), main = document.querySelector('.main'), cab = document.querySelector('.agd-pd-cab').getBoundingClientRect(), bar = document.querySelector('.bar')?.getBoundingClientRect();
    const sel = document.querySelector('.agd-cel[data-sel]');
    return { painelTopo: p.top, gradeBase: g.bottom, legTopo: leg.top, gradeAltura: g.height, gradeLargura: g.width, gradeY: g.top + main.scrollTop, cabBase: cab.bottom, cabTopo: cab.top, barraTopo: bar ? bar.top : innerHeight, sel: sel?.dataset.data, expandida: sel?.getAttribute('aria-expanded'), controla: sel?.getAttribute('aria-controls'), titulo: document.querySelector('#agd-pd-t')?.textContent, ctl: document.querySelector('.agd-cel[data-data="' + sel?.dataset.data + '"]') === document.activeElement };
  });
  ok(pn.painelTopo >= pn.gradeBase - 1 && pn.painelTopo - pn.gradeBase < 40 && pn.legTopo >= pn.painelTopo, `o painel começa logo abaixo da grade (${Math.round(pn.painelTopo - pn.gradeBase)} px de distância) e a legenda vem depois dele`);
  ok(Math.abs(pn.gradeY - antesGrade.y) < 1 && Math.abs(pn.gradeAltura - antesGrade.h) < 1 && Math.abs(pn.gradeLargura - antesGrade.w) < 1, 'a grade fica na mesma posição e com o mesmo tamanho com o painel aberto');
  ok(pn.sel === S.h.prazo && pn.expandida === 'true' && pn.controla === 'agd-dia-painel' && /^Quarta-feira, 12 de novembro de 2026$|^[A-Za-zçãé-]+, \d+ de \w+ de 2026$/.test(pn.titulo), `a data tocada fica selecionada (aria-expanded) e o painel mostra a data por extenso (“${pn.titulo}”)`);
  ok(pn.cabTopo >= 0 && pn.cabBase <= pn.barraTopo, `o cabeçalho do painel ficou dentro da área visível, acima da barra de baixo (base em ${Math.round(pn.cabBase)} de ${Math.round(pn.barraTopo)} px)`);
  ok((await pg.$$('.agd-dia-painel .agd-abrir')).length >= 1 && /Novo evento neste dia/.test(await pg.textContent('.agd-dia-painel')) && !!(await pg.$('.agd-dia-painel [data-acao="dia-indisponivel"]')), 'o painel traz os cartões do dia com as mesmas ações, Novo evento neste dia e Cadastrar dia indisponível');
  const selVisivel = await pg.evaluate(() => { const c = document.querySelector('.agd-cel[data-sel]').getBoundingClientRect(); return c.top >= 0 && c.bottom <= innerHeight; });
  ok(selVisivel, 'com o painel aberto, a data escolhida continua visível (rolagem mínima)');
  await fecharDia(pg);
  ok(!(await pg.$('.agd-dia-painel')) && (await pg.evaluate(() => !!document.activeElement?.dataset?.data)), 'o botão de fechar recolhe o painel e devolve o foco à célula do dia');
  await pg.selectOption('.agd-mes-sel select', '12'); await pg.waitForTimeout(400);
  const cheioCel = `.agd-cel[data-data="${S.mes.cheio}"]`;
  await pg.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), cheioCel); await pg.waitForTimeout(200);
  ok((await pg.$$(`${cheioCel} .agd-it, ${cheioCel} .agd-mais, ${cheioCel} .agd-evm`)).length === 0 && /3 compromissos/.test(await pg.getAttribute(cheioCel, 'aria-label')), 'no celular o dia cheio de dezembro mostra só o número e a carga; os três compromissos ficam no nome acessível e no painel');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'em dezembro, no celular, continua sem rolagem horizontal');
  await pg.click(cheioCel); await pg.waitForSelector('.agd-dia-painel'); await pg.waitForTimeout(500);
  ok((await pg.$$('.agd-dia-painel .agd-evento')).length === 3 && (await pg.$$('.agd-dia-painel .agd-demanda')).length === 3 && /Audiência pública para revisão do plano diretor e do zoneamento urbano do município/.test(await pg.textContent('.agd-dia-painel')) && (await pg.$$eval('.agd-dia-painel button', (b) => b.filter((x) => x.getClientRects().length).every((x) => x.getBoundingClientRect().height >= 32))), 'tocar no dia cheio no celular abre o painel com os seis itens e os títulos inteiros');
  ok(/^Terça-feira, 15 de dezembro de 2026$/.test(await pg.textContent('#agd-pd-t')) && (await pg.getAttribute('.agd-dia-painel', 'aria-labelledby')) === 'agd-pd-t', 'o cabeçalho do painel traz a data por extenso ("Terça-feira, 15 de dezembro de 2026")');
  ok(!(await pg.evaluate(() => { const l = document.querySelector('.agd-dia-painel'); return [l, ...l.querySelectorAll('*')].some((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1); })), 'o painel não tem rolagem própria (só a página rola)');
  // outra data atualiza o mesmo painel (sem fechar e abrir); dia vazio e dia só com compromisso
  const tocar = async (d) => { await celula(pg, d).evaluate((e) => e.scrollIntoView({ block: 'center' })); await celula(pg, d).click(); await pg.waitForTimeout(500); };
  await pg.evaluate(() => { window.__painel = document.querySelector('.agd-dia-painel'); });
  await tocar(S.mes.vazio);
  ok((await pg.evaluate(() => window.__painel === document.querySelector('.agd-dia-painel'))) && (await pg.$$('.agd-dia-painel')).length === 1 && /Nada programado para este dia/.test(await pg.textContent('.agd-dia-painel')) && (await selAtualDe(pg)) === S.mes.vazio, 'tocar em outra data atualiza o mesmo painel (dia vazio: "Nada programado para este dia.")');
  await tocar('2026-12-24');
  ok(/Recesso do funcionalismo/.test(await pg.textContent('.agd-dia-painel')) && !/Demandas e acompanhamentos/.test(await pg.textContent('.agd-dia-painel')) && (await pg.$$('.agd-dia-painel .agd-demanda')).length === 0, 'dia só com compromisso: o painel mostra o compromisso e nenhuma demanda');
  await tocar(S.mes.cheio);
  await fecharDia(pg);
  ok((await pg.evaluate(() => document.activeElement?.getAttribute('data-data'))) === S.mes.cheio, 'no celular, fechar o painel devolve o foco à célula');
  await pg.selectOption('.agd-mes-sel select', '11'); await pg.waitForTimeout(300);
  await modo(pg, 'Semana');
  const sf = await caixa(pg, '.agd-sf-dia');
  ok(sf.length === 7 && sf.every((c) => c.w >= 44 && c.h >= 44) && !(await pg.$('.agd-sem')) && (await pg.isVisible('#agd-sem-detalhe')) && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), 'semana no celular: a faixa com as sete datas (alvos de 44 px) e o dia escolhido inteiro abaixo, sem rolagem horizontal');
  await modo(pg, 'Dia');
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'Hoje no celular sem rolagem horizontal');
}
// ---------- Dia e Semana no celular (decisão 75) ----------
// O seletor de visões na linha inteira, "Ir para a data" com o campo nativo por baixo (um só controle), uma ação principal por tela, nada cortado nem para fora, o último item acima da
// barra de baixo e o Mês como estava. Emulação no Edge: a largura própria do campo de data do Safari do iPhone e o seletor nativo dependem do aparelho.
for (const [w, texto, tema] of [[390, 100, 'claro'], [375, 100, 'escuro'], [320, 100, 'claro'], [390, 125, 'escuro'], [320, 125, 'claro']]) {
  const { ctx, pg } = await novo({ viewport: { width: w, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { tema, prefs: { modo: 'hoje' } });
  await ctx.addInitScript((t) => { try { if (!localStorage.getItem('dmanda:aparencia')) localStorage.setItem('dmanda:aparencia', JSON.stringify({ textoPct: t })); } catch { /* sem armazenamento */ } }, texto);
  await ir(pg);
  const rot = `${w} px, texto a ${texto}%, ${tema}`;
  const medir = () => pg.evaluate(() => {
    const a = document.querySelector('.agd').getBoundingClientRect(), m = document.querySelector('.main');
    const R = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
    const visiveis = [...document.querySelectorAll('.agd *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
    const inp = document.querySelector('.agd-data input'), sup = document.querySelector('.agd-ir-rot'), sec = visiveis.find((e) => e.matches('[data-acao="dia-indisponivel"]'));
    const cs = sup ? R(sup) : null, alvo = cs ? document.elementFromPoint(cs.x + cs.w / 2, cs.y + cs.h / 2) : null;
    return {
      esc: Number(getComputedStyle(document.querySelector('.app')).getPropertyValue('--esc')),
      fora: visiveis.filter((e) => e.getBoundingClientRect().right > a.right + 1 || e.getBoundingClientRect().left < a.left - 1).map((e) => String(e.className || e.tagName)).slice(0, 4),
      cortados: visiveis.filter((e) => e.matches('button, .btn, h2, h3, .chip, .agd-md') && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 30)),
      rolagemH: m.scrollWidth - m.clientWidth,
      seletor: [...document.querySelectorAll('.agd-barra .opcoes button')].map(R),
      larguraUtil: a.width,
      novoGeral: !!document.querySelector('.agd-novo'),
      principais: visiveis.filter((e) => e.matches('.btn.pri')).map((e) => e.textContent.trim()),
      secundaria: sec ? { texto: sec.textContent.trim(), nome: sec.getAttribute('aria-label') } : null,
      ir: sup && inp ? { sup: R(sup), inp: R(inp), opac: getComputedStyle(inp).opacity, nome: inp.getAttribute('aria-label'), supTab: sup.tabIndex, supOculto: sup.getAttribute('aria-hidden'), supVisivel: getComputedStyle(sup).display !== 'none', alvoEhCampo: alvo === inp } : null,
      tabulaveisNav: [...document.querySelectorAll('.agd-nav-linha button:not(:disabled), .agd-nav-linha input, .agd-nav-linha [tabindex]')].filter((e) => e.tabIndex >= 0).length,
    };
  });
  for (const visao of ['Dia', 'Semana']) {
    await modo(pg, visao); await paraData(pg, S.dia.data); // feriado em dia útil: título longo, marca do dia e as duas ações
    const d = await medir();
    ok(Math.abs(d.esc - 0.85 * texto / 100) < 0.002 && d.fora.length === 0 && d.cortados.length === 0 && d.rolagemH <= 1, `${visao}, ${rot}: nada passa da margem nem é cortado, sem rolagem horizontal${d.fora.length || d.cortados.length ? ` (fora: ${d.fora.join(' | ')}; cortados: ${d.cortados.join(' | ')})` : ''}`);
    const sl = d.seletor;
    ok(sl.length === 3 && sl.every((b) => Math.abs(b.y - sl[0].y) < 1 && Math.abs(b.w - sl[0].w) < 1 && b.h >= 40) && sl[2].r - sl[0].x >= d.larguraUtil - 2, `${visao}, ${rot}: Dia, Semana e Mês dividem a linha inteira em três partes iguais (${Math.round(sl[0]?.w)} px cada, ${Math.round(sl[0]?.h)} px de altura)`);
    ok(!d.novoGeral && d.principais.length === 1 && /^Novo evento (hoje|neste dia)$/.test(d.principais[0]) && d.secundaria?.texto === 'Dia indisponível' && d.secundaria.nome === 'Cadastrar dia indisponível', `${visao}, ${rot}: uma só ação principal ("${d.principais.join('", "')}") e a secundária "Dia indisponível" (nome acessível completo)`);
    const i = d.ir;
    ok(!!i && i.supVisivel && i.opac === '0' && i.nome === 'Ir para a data' && i.supOculto === 'true' && i.supTab < 0 && i.alvoEhCampo && i.inp.w >= 44 && i.inp.h >= 44 && i.inp.x <= i.sup.x + 0.5 && i.inp.r >= i.sup.r - 0.5 && i.inp.y <= i.sup.y + 0.5 && i.inp.b >= i.sup.b - 0.5 && d.tabulaveisNav === 4,
      `${visao}, ${rot}: "Ir para a data" é o próprio campo de data (um só controle tabulável, área de ${Math.round(i?.inp.w)}x${Math.round(i?.inp.h)} px cobrindo a superfície; o toque cai no campo nativo)`);
    // teclado: o foco aparece na superfície, Enter abre o seletor nativo e a data escolhida atualiza o período
    await pg.evaluate(() => { window.__seletores = 0; HTMLInputElement.prototype.showPicker = function () { window.__seletores++; }; });
    await pg.focus('.agd-nav .icbtn-s:not(.agd-ant)'); await pg.keyboard.press('Tab'); await pg.waitForTimeout(150);
    const foco = await pg.evaluate(() => ({ noCampo: document.activeElement === document.querySelector('.agd-data input'), contorno: getComputedStyle(document.querySelector('.agd-ir-rot')).outlineStyle }));
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(100);
    const abriu = await pg.evaluate(() => window.__seletores);
    await paraData(pg, '2026-12-30'); // quarta-feira da semana que atravessa o mês e o ano
    const per = ((await pg.textContent('.agd-periodo')) ?? '').replace(/\s+/g, ' ').trim(), d2 = await medir();
    const esperado = visao === 'Dia' ? /^Quarta-feira, 30 de dezembro de 2026$/ : /^27 de dez a 2 de jan de 2027$/;
    ok(foco.noCampo && foco.contorno === 'dashed' && abriu === 1 && esperado.test(per) && d2.fora.length === 0 && d2.cortados.length === 0 && d2.rolagemH <= 1, `${visao}, ${rot}: pelo teclado o foco aparece em "Ir para a data", Enter abre o seletor e a data escolhida vira o período, inteiro e sem corte ("${per}")`);
    if (visao === 'Semana') {
      await paraData(pg, S.dia.data);
      const s = await pg.evaluate(() => {
        const y = (q) => document.querySelector(q)?.getBoundingClientRect().top ?? NaN, det = document.querySelector('#agd-sem-detalhe'), cab = det.querySelector('.agd-sd-cab');
        const fundo = (e, p) => getComputedStyle(e, p).backgroundColor;
        return { faixa: document.querySelectorAll('.agd-sem-faixa .agd-sf-dia').length, cab: y('#agd-sem-detalhe .agd-sd-cab'), lista: y('#agd-sem-detalhe .agd-sd-lista'), acoes: y('#agd-sem-detalhe .agd-sd-acoes'), cinza: det.hasAttribute('data-nao-util'), fundoCartao: fundo(det, '::before'), fundoCab: fundo(cab), caixaNoCab: cab.hasAttribute('data-nao-util') };
      });
      await paraData(pg, '2026-11-18'); // dia útil da referência, sem feriado
      const util = await pg.evaluate(() => ({ cinza: document.querySelector('#agd-sem-detalhe').hasAttribute('data-nao-util'), fundo: getComputedStyle(document.querySelector('#agd-sem-detalhe'), '::before').backgroundColor }));
      ok(s.faixa === 7 && s.cab < s.lista && s.lista < s.acoes && s.cinza && !util.cinza && s.fundoCartao !== util.fundo && !s.caixaNoCab && /rgba\(0, 0, 0, 0\)|transparent/.test(s.fundoCab),
        `Semana, ${rot}: a faixa das sete datas e o dia escolhido num só cartão, na ordem data, conteúdo e ações; o feriado dá o cinza ao cartão inteiro (${s.fundoCartao}), sem caixa dentro de caixa`);
      await paraData(pg, HOJE);
      const outro = somarDias(HOJE, colunaNaSemana(HOJE) === 6 ? -1 : 1);
      await pg.click(`.agd-sf-dia[data-sem-dia="${outro}"]`); await pg.waitForTimeout(250);
      const marcas = await pg.evaluate(([h, o]) => {
        const c = (d) => document.querySelector(`.agd-sf-dia[data-sem-dia="${d}"]`), disco = (e) => getComputedStyle(e.querySelector('.agd-sf-num')).backgroundColor, anel = (e) => getComputedStyle(e).boxShadow;
        const fds = [...document.querySelectorAll('.agd-sf-dia')].filter((e) => e.hasAttribute('data-nao-util') && e !== c(h) && e !== c(o))[0];
        return { hojeDisco: disco(c(h)), outroDisco: disco(c(o)), hojeAnel: anel(c(h)), outroAnel: anel(c(o)), selDoOutro: c(o).hasAttribute('data-sel'), selDoHoje: c(h).hasAttribute('data-sel'), fdsFundo: fds ? getComputedStyle(fds).backgroundColor : null, utilFundo: getComputedStyle(c(o)).backgroundColor };
      }, [HOJE, outro]);
      ok(marcas.selDoOutro && !marcas.selDoHoje && marcas.hojeDisco !== marcas.outroDisco && marcas.hojeAnel !== marcas.outroAnel && !!marcas.fdsFundo && marcas.fdsFundo !== marcas.utilFundo, `Semana, ${rot}: hoje (disco), a data escolhida (anel) e o fim de semana (cinza) têm marcas diferentes`);
    } else {
      const dia = await pg.evaluate(() => { const p = [...document.querySelectorAll('.agd-hoje > .agd-painel')].map((e) => ({ x: e.getBoundingClientRect().left, y: e.getBoundingClientRect().top, t: e.querySelector('h3')?.textContent })); const r = document.querySelector('.agd-resumo').getBoundingClientRect(); return { p, resumo: r.bottom, acoes: document.querySelector('.agd-dia-info .agd-acoes-dia').getBoundingClientRect().bottom }; });
      ok(dia.p.length >= 2 && dia.p[0].t === 'Compromissos e lembretes' && dia.p[1].t === 'Demandas e acompanhamentos' && Math.abs(dia.p[0].x - dia.p[1].x) < 1 && dia.p[0].y < dia.p[1].y && dia.acoes <= dia.resumo && dia.resumo <= dia.p[0].y, `Dia, ${rot}: a data, a navegação e as ações ficam no cartão da data; abaixo, Compromissos e depois Demandas, em uma coluna`);
    }
    // o último item rola inteiro para cima da barra de baixo
    const fim = await pg.evaluate(() => { const m = document.querySelector('.main'); m.scrollTo({ top: m.scrollHeight, behavior: 'instant' }); const u = document.querySelector('.agd').getBoundingClientRect().bottom, b = document.querySelector('.bar')?.getBoundingClientRect(); const r = { ultimo: u, barra: b && b.height ? b.top : innerHeight }; m.scrollTo({ top: 0, behavior: 'instant' }); return r; });
    ok(fim.ultimo <= fim.barra + 0.5, `${visao}, ${rot}: no fim da rolagem o último item termina acima da barra de baixo (${Math.round(fim.ultimo)} de ${Math.round(fim.barra)} px)`);
  }
  await modo(pg, 'Mês');
  const mes = await pg.evaluate(() => { const sl = [...document.querySelectorAll('.agd-barra .opcoes button')].map((b) => b.getBoundingClientRect()); return { novo: !!document.querySelector('.agd-novo'), opac: getComputedStyle(document.querySelector('.agd-data input')).opacity, sup: getComputedStyle(document.querySelector('.agd-ir-rot')).display, grade: getComputedStyle(document.querySelector('.agd-barra .opcoes')).display, tres: sl.length === 3 && sl.every((b) => Math.abs(b.width - sl[0].width) < 1 && b.height >= 40), dataFixa: [...document.querySelectorAll('.agd-resumo')].some((e) => /\d{1,2} de \w+\.? de \d{4}/.test(e.innerText) && e.querySelector('.agd-data') && /\d{1,2} de \w+\.? de \d{4}/.test(e.querySelector('.agd-data').innerText)) }; });
  ok(!mes.novo && mes.opac === '0' && mes.sup !== 'none' && mes.grade === 'grid' && mes.tres && !mes.dataFixa, `Mês, ${rot}: o mesmo cabeçalho de Dia e Semana (Novo evento fora da faixa das visões, três partes iguais, Ir para a data compacto e sem a data fixa por extenso)`);
  await ctx.close();
}
// Dia e Semana com largura (decisão 75): sem a ação geral repetida, o campo de data visível, as ações ao lado da data e as sete colunas só quando cada uma tem largura confortável
for (const [nomeL, w, colunas] of [['computador 1360', 1360, true], ['janela 1100', 1100, false], ['iPad em pé 820', 820, false]]) {
  const { ctx, pg } = await novo({ viewport: { width: w, height: 900 } }, { prefs: { modo: 'semana' } });
  await ir(pg); await paraData(pg, S.dia.data);
  const l = await pg.evaluate(() => {
    const R = (q) => { const r = document.querySelector(q)?.getBoundingClientRect(); return r ? { x: r.left, y: r.top, w: r.width, b: r.bottom } : null; };
    return { agd: document.querySelector('.agd').clientWidth, cols: [...document.querySelectorAll('.agd-sem .agd-dia')].map((e) => e.getBoundingClientRect().width), faixa: document.querySelectorAll('.agd-sem-faixa .agd-sf-dia').length, novo: !!document.querySelector('.agd-novo'), opac: getComputedStyle(document.querySelector('.agd-data input')).opacity, sup: getComputedStyle(document.querySelector('.agd-ir-rot')).display, cab: R('.agd-sd-cab'), acoes: R('.agd-sd-acoes'), lista: R('.agd-sd-lista'), pri: [...document.querySelectorAll('.agd .btn.pri')].filter((e) => e.offsetParent).length };
  });
  ok(!l.novo && l.pri === 1 && l.opac === '0' && l.sup !== 'none', `Semana, ${nomeL}: sem a ação geral repetida (uma ação principal) e com Ir para a data compacto (o campo nativo fica transparente sobre o botão)`);
  ok(colunas ? l.cols.length === 7 && Math.min(...l.cols) >= 140 && l.faixa === 0 : l.cols.length === 0 && l.faixa === 7, `Semana, ${nomeL} (${l.agd} px úteis): ${colunas ? `sete colunas de ${Math.round(Math.min(...l.cols))} px` : 'a faixa das sete datas (as colunas ficariam estreitas)'}`);
  ok(Math.abs(l.acoes.y - l.cab.y) < 30 && l.acoes.x > l.cab.x + 200 && l.lista.y >= l.cab.b - 1, `Semana, ${nomeL}: as ações ficam ao lado da data e a lista vem abaixo`);
  await modo(pg, 'Dia');
  const dd = await pg.evaluate(() => ({ novo: !!document.querySelector('.agd-novo'), pri: [...document.querySelectorAll('.agd .btn.pri')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()), paineis: [...document.querySelectorAll('.agd-hoje > .agd-painel')].slice(0, 2).map((e) => e.getBoundingClientRect().top) }));
  ok(!dd.novo && dd.pri.length === 1 && Math.abs(dd.paineis[0] - dd.paineis[1]) < 1, `Dia, ${nomeL}: uma ação principal ("${dd.pri.join('", "')}") e os dois grupos lado a lado`);
  await ctx.close();
}
// 375 px (iPhone menor) e 320 px (limite da composição): sete colunas, sem rolagem horizontal; as medidas reais ficam no texto de cada verificação
// Abaixo de uns 363 px é a casca do aplicativo (a barra do topo, fora da Agenda) que fica mais larga que a tela e é cortada pela lateral: a Agenda é conferida dentro dessa casca.
for (const [w, alvo] of [[375, 44], [360, 44], [320, 0]]) {
  // a partir da correção da casca (grade `minmax(0, 1fr)`), a Agenda e a casca têm a largura da tela; a barra do topo é que se ajusta por dentro
  const { ctx, pg } = await novo({ viewport: { width: w, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { prefs: { modo: 'mes' } });
  await ir(pg);
  const cx = await caixa(pg, '.agd-cel'), minW = Math.min(...cx.map((c) => c.w));
  const aCel = await areaEfetiva(pg, '.agd-cel[data-data="2026-11-11"]');
  const semRol = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelector('.main').scrollWidth <= document.querySelector('.main').clientWidth + 1);
  // nada fica para fora da tela escondido pelo corte lateral: a faixa de meses e o botão Novo evento terminam dentro da largura
  const casca = await pg.evaluate(() => document.querySelector('.main').getBoundingClientRect().right);
  const dentro = await pg.evaluate((lim) => [...document.querySelectorAll('.agd-mes-sel select, .agd-novo, .agd-cel, .agd-nav .btn, .agd-data input')].every((e) => e.getBoundingClientRect().right <= lim + 0.5), alvo ? w : casca);
  ok(dentro, `${w} px: o seletor de mês, as células e os botões do topo terminam dentro da ${alvo ? 'largura da tela' : `casca do aplicativo (${Math.round(casca)} px, mais larga que a tela por causa da barra do topo, que não é da Agenda)`}, sem nada cortado pela Agenda`);
  const cols = await pg.$$eval('.agd-linha-sem:nth-child(2) > [role="gridcell"]', (c) => c.length);
  ok(semRol && cols === 7 && (await pg.$$eval('.agd-cabsem', (c) => c.map((x) => x.textContent.trim()).join())) === 'DOM,SEG,TER,QUA,QUI,SEX,SÁB' && cx.every((c) => Math.abs(c.w - c.h) < 1.5), `${w} px: sete colunas de quadrados de domingo a sábado, sem rolagem horizontal da página`);
  if (alvo) ok(minW >= alvo - 0.5 && aCel.w >= alvo, `${w} px: o quadrado mede ${minW.toFixed(1)} px (área de toque ${aCel.w}x${aCel.h})`);
  else ok(minW >= 38, `${w} px (limite da composição): o quadrado mede ${minW.toFixed(1)} px (área de toque ${aCel.w}x${aCel.h})`);
  // adaptação a 320 px (decisão 73): sem largura para 7 colunas + abas, os meses passam a um controle compacto no cabeçalho do Mês
  const tabsVisiveis = await pg.isVisible('.agd-meses'), selVisivel = await pg.isVisible('.agd-mes-sel select');
  ok(!tabsVisiveis && selVisivel, `${w} px: o mês fica no seletor compacto junto do período e as datas ganham a largura toda`);
  const antes = ((await pg.textContent('.agd-periodo')) ?? '').replace(/\s+/g, ' ').trim();
  await pg.selectOption('.agd-mes-sel select', '12'); await pg.waitForTimeout(400);
  ok(/^Dezembro 2026$/.test(((await pg.textContent('.agd-periodo')) ?? '').replace(/\s+/g, ' ').trim()) && /Novembro 2026/.test(antes) && (await pg.$eval('.agd-mes-sel select', (e) => e.value)) === '12' && (await pg.$$eval('.agd-cel', (l) => l.length)) > 27, `${w} px: o seletor leva ao mês escolhido (Dezembro 2026) e a grade acompanha`);
  await ctx.close();
}
const t4 = await novo({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }, { tema: 'escuro', prefs: { modo: 'mes' } });
{
  const { pg } = t4;
  await ir(pg);
  const cx = await caixa(pg, '.agd-cel');
  ok(cx.every((c) => c.w >= 80 && c.h >= 80) && (await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), `iPad vertical emulado, escuro: células de pelo menos ${Math.round(Math.min(...cx.map((c) => c.w)))} por ${Math.round(Math.min(...cx.map((c) => c.h)))} px, sem rolagem horizontal`);
  ok((await pg.$$eval('.agd-cel .agd-it-h', (l) => l.length > 0 && l.every((e) => getComputedStyle(e).display === 'none'))) && (await pg.$$eval('.agd-cel .agd-it-t', (l) => l.every((e) => getComputedStyle(e).whiteSpace === 'normal'))), 'no iPad em pé os títulos da célula usam a largura toda (até duas linhas) e a hora fica na gaveta');
  const vaz = await pg.$$eval('.agd-vaz', (l) => l.map((e) => getComputedStyle(e).backgroundColor)), cel0 = await pg.$eval('.agd-cel[data-nivel="zero"]', (e) => getComputedStyle(e).backgroundColor);
  ok(vaz.length > 0 && vaz.every((c) => c === 'rgba(0, 0, 0, 0)') && cel0 !== 'rgba(0, 0, 0, 0)', 'no escuro as posições fora do mês ficam sem preenchimento, menos destacadas do que os dias válidos (que têm o fundo do cartão)');
  const cs = {};
  for (const n of ['zero', 'baixa', 'media', 'alta']) { const el = await pg.$(`.agd-cel[data-nivel="${n}"]`); if (el) cs[n] = await contraste(pg, `.agd-cel[data-nivel="${n}"]`); }
  ok(Object.keys(cs).length >= 3 && Object.values(cs).every((v) => v >= 4.5), 'contraste do texto com o tom da célula de cada nível (escuro) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cs).map(([k, v]) => [k, +v.toFixed(1)]))));
  const cc = await contrastesDeTudo(pg);
  ok('selo alta' in cc && 'atrasada' in cc && Object.values(cc).every((v) => v >= 4.5), 'contraste (escuro) dos selos de carga (inclusive o alto) e dos itens da célula (compromisso, dia inteiro, demanda, linha de atraso) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cc).map(([k, v]) => [k, +v.toFixed(1)]))));
  await pg.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  const lum = await pg.evaluate(() => { const c =document.createElement('canvas').getContext('2d', { willReadFrequently: true }); const m = {}; for (const n of ['zero', 'baixa', 'media', 'alta']) { const e = document.querySelector(`.agd-amostra[data-nivel="${n}"]`); c.fillStyle = '#111'; c.fillRect(0, 0, 1, 1); c.fillStyle = getComputedStyle(e).backgroundColor; c.fillRect(0, 0, 1, 1); const [r, g, b] = c.getImageData(0, 0, 1, 1).data; m[n] = 0.2126 * r + 0.7152 * g + 0.0722 * b; } return m; });
  ok(lum.zero < lum.baixa && lum.baixa < lum.media && lum.media < lum.alta, 'a escala do escuro cresce em luminosidade do zero ao alto: ' + JSON.stringify(Object.fromEntries(Object.entries(lum).map(([k, v]) => [k, Math.round(v)]))));
  await pg.click('.agd-mes-aba[data-mes="12"]'); await pg.waitForTimeout(400);
  const cheioIpad = `.agd-cel[data-data="${S.mes.cheio}"]`;
  await pg.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), cheioIpad); await pg.waitForTimeout(200);
  ok((await pg.$$eval(`${cheioIpad} .agd-it`, (l) => l.length)) === 2 && (await pg.textContent(`${cheioIpad} .agd-mais`)) === '+4', 'no iPad vertical a célula mostra duas linhas e "+4": o limite acompanha a largura da grade');
  const cI = await semCorte(pg);
  ok(cI.f1 > cI.f0 && cI.cortados.length === 0, `iPad em pé, no texto a 125%: nenhuma célula corta a última linha nem o "+N" (fonte de ${cI.f0} para ${cI.f1} px)`);
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
  const cc = await contrastesDeTudo(pg);
  ok('selo alta' in cc && 'atrasada' in cc && Object.values(cc).every((v) => v >= 4.5), 'contraste (claro) dos selos de carga (inclusive o alto) e dos itens da célula (compromisso, dia inteiro, demanda, linha de atraso) é de pelo menos 4,5:1: ' + JSON.stringify(Object.fromEntries(Object.entries(cc).map(([k, v]) => [k, +v.toFixed(1)]))));
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

// falha só das demandas no celular (decisão 73): o heatmap não inventa carga (listrado de "carga indisponível") e o painel do dia avisa e deixa tentar de novo
{
  const { ctx, pg } = await novo({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { prefs: { modo: 'mes' } });
  let ativa = true;
  await pg.route('**/*', async (route) => {
    const q = route.request();
    if (!(q.method() === 'POST' && q.headers()['next-action'])) { await route.continue(); return; }
    const r = await route.fetch(); const texto = await r.text();
    const linhas = texto.split('\n'), i = linhas.findIndex((l) => /^1:\{"ok":true,"dados":\{"demandas":/.test(l));
    if (ativa && i >= 0) {
      const j = JSON.parse(linhas[i].slice(2)); j.dados.demandas = { ok: false, erro: 'Falha simulada em demandas.' }; linhas[i] = '1:' + JSON.stringify(j);
      const corpo = linhas.join('\n'); await route.fulfill({ response: r, body: corpo, headers: { ...r.headers(), 'content-length': String(Buffer.byteLength(corpo)) } }); return;
    }
    await route.fulfill({ response: r, body: texto });
  });
  await ir(pg);
  const cs = await pg.evaluate(() => { const l = [...document.querySelectorAll('.agd-cel')]; return { n: l.length, semCarga: l.filter((c) => c.dataset.semCarga !== undefined).length, niveis: [...new Set(l.map((c) => c.dataset.nivel))], listrado: getComputedStyle(l[10]).backgroundImage.includes('repeating-linear-gradient') }; });
  ok(cs.n > 27 && cs.semCarga === cs.n && cs.niveis.join() === 'zero' && cs.listrado && /Carga indisponível/.test(await pg.evaluate(() => [...document.querySelectorAll('.agd-leg li')].filter((e) => e.getClientRects().length).map((e) => e.textContent).join(' '))), 'celular, falha só das demandas: as células ganham o listrado de "carga indisponível" (nunca um zero) e a legenda explica');
  await celula(pg, HOJE).evaluate((e) => e.scrollIntoView({ block: 'center' })); await celula(pg, HOJE).click(); await pg.waitForSelector('.agd-dia-painel');
  ok(/As demandas não carregaram/.test(await pg.textContent('.agd-dia-painel .erro-carga')) && (await pg.$$('.agd-dia-painel .agd-evento')).length >= 3 && (await pg.$$('.agd-dia-painel .agd-demanda')).length === 0, 'celular, falha parcial: o painel do dia lista os compromissos e avisa que as demandas não carregaram');
  ativa = false;
  await pg.click('.agd-dia-painel .erro-carga .btn');
  await pg.waitForFunction(() => !!document.querySelector('.agd-dia-painel') && !document.querySelector('.agd-dia-painel .erro-carga') && !document.querySelector('.agd-aviso-carga') && document.querySelectorAll('.agd-cel[data-nivel="alta"], .agd-cel[data-nivel="media"], .agd-cel[data-nivel="baixa"]').length > 0, null, { timeout: 15000 });
  ok(!(await pg.$('.agd-aviso-carga')) && (await pg.$('.agd-dia-painel')) !== null, 'celular: "Tentar de novo" dentro do painel recarrega as demandas, tira o aviso e o painel continua aberto');
  await pg.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close();
}

// ================= ajustes de layout de 13/11/2026 (decisão 73) =================
// cabeçalho por função, painéis na lateral (e a passagem para uma coluna pela largura útil) e heatmap do celular com o painel do dia abaixo da grade (claro e escuro, movimento reduzido)
for (const [w, lateral] of [[1360, true], [1280, true], [1100, false], [1000, false]]) {
  const { ctx, pg } = await novo({ viewport: { width: w, height: 900 } }, { prefs: { modo: 'mes' } });
  await ir(pg);
  const m = await pg.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const celMin = Math.min(...[...document.querySelectorAll('.agd-cel')].map((c) => c.getBoundingClientRect().width));
    return { barra: r('.agd-barra'), visoes: r('.agd-barra .opcoes'), novo: r('.agd-novo'), filtros: r('.agd-filtros'), per: r('.agd-periodo'), nav: r('.agd-nav'), tot: r('.agd-totais'), cal: r('.agd-cal'), lat: r('.agd-lateral'), p1: r('.agd-lateral .agd-aux'), grade: r('.agd-grade'), abas: r('.agd-meses'), celMin, semRolH: document.querySelector('.main').scrollWidth <= document.querySelector('.main').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1, chips: [...document.querySelectorAll('.agd-chips-res li')].map((l) => l.textContent) };
  });
  ok(m.novo === null && m.visoes.w < 400 && m.visoes.h <= 60, `${w} px: a faixa das visões traz só Dia, Semana e Mês (o Novo evento saiu dela e continua no painel do dia, na gaveta e no + do aplicativo)`);
  ok(m.nav.x - m.per.r < 40 && Math.abs(m.nav.y - m.per.y) < 30 && m.nav.x < m.cal.x + m.cal.w / 2, `${w} px: mês e ano, setas, Hoje e a data formam um grupo só, junto da grade (a navegação começa a ${Math.round(m.nav.x - m.per.r)} px do título)`);
  ok(m.tot.y > m.per.b - 4 && m.tot.h < 40 && m.cal.y - m.tot.b < 40, `${w} px: os totais ficam numa linha compacta abaixo do período (${Math.round(m.tot.h)} px de altura), logo acima da grade`);
  ok(m.filtros.y < m.per.y && /demanda/.test(m.chips.join()) && /compromisso/.test(m.chips.join()), `${w} px: os filtros ficam juntos e identificados, e os totais distinguem demandas e compromissos (${m.chips.join(' | ')})`);
  if (lateral) ok(m.lat.x >= m.cal.r && Math.abs(m.p1.y - m.cal.y) <= 2 && m.celMin >= 70 && m.semRolH, `${w} px: os painéis ficam à direita da grade, alinhados ao topo dela, com células de pelo menos ${Math.round(m.celMin)} px de largura`);
  else ok(m.lat.y >= m.cal.b - 2 && m.lat.w > m.grade.w * 0.9 && m.celMin >= 70 && m.semRolH, `${w} px: sem largura útil para a lateral, os painéis descem para baixo do calendário (a grade mantém células de ${Math.round(m.celMin)} px)`);
  if (w === 1360) {
    // uma só rolagem, mesmo com o painel curto e o longo; a coluna acompanha a página sem rolagem própria e sem sair do quadro
    const so = await pg.evaluate(() => { const l = [...document.querySelectorAll('.main *')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 0); return l.map((e) => e.className); });
    ok(so.length === 0, `a página tem uma só rolagem (nenhum outro elemento do miolo rola: ${so.join(',') || 'nenhum'})`);
    const top0 = (await caixa(pg, '.agd-lateral'))[0].y;
    await pg.evaluate(() => { const mm = document.querySelector('.main'); mm.scrollTo({ top: Math.min(mm.scrollHeight, 400), behavior: 'instant' }); }); await pg.waitForTimeout(400);
    const l1 = (await caixa(pg, '.agd-lateral'))[0], c1 = (await caixa(pg, '.agd-cal'))[0];
    ok(l1.y >= 0 && l1.b <= c1.b + 8, `a lateral acompanha a página sem passar do calendário (topo da coluna em ${Math.round(top0)} px, depois ${Math.round(l1.y)} px)`);
    // lateral com um card curto e outro longo: a grade segue legível (sete colunas, títulos e abas visíveis)
    ok((await pg.$$eval('.agd-cabsem', (l) => l.length)) === 7 && (await pg.isVisible('.agd-meses')) && (await pg.$$eval('.agd-cel .agd-it-t', (l) => l.filter((e) => e.getClientRects().length).length)) > 5, 'com a lateral, a grade mantém as sete colunas, os títulos dos itens e as abas dos meses visíveis');
  }
  await ctx.close();
}

// celular, claro e escuro: heatmap com níveis distintos, contraste da data, hoje, seleção e painel; movimento reduzido sem rolagem animada
for (const tema of ['claro', 'escuro']) {
  const { ctx, pg } = await novo({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { tema, prefs: { modo: 'mes' } });
  await ir(pg);
  const cs = await pg.evaluate(() => {
    const rgb = (cor) => { const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); c.fillStyle = '#808080'; c.fillRect(0, 0, 1, 1); c.fillStyle = cor; c.fillRect(0, 0, 1, 1); const [r, g, b] = c.getImageData(0, 0, 1, 1).data; return [r, g, b]; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const cr = (a, b) => { const l1 = lum(a), l2 = lum(b); return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100; };
    const saida = {};
    for (const n of ['zero', 'baixa', 'media', 'alta']) {
      const c = [...document.querySelectorAll('.agd-cel')].find((x) => x.dataset.nivel === n && !x.dataset.hoje && !x.dataset.fds);
      if (!c) continue;
      const num = c.querySelector('.agd-num'), cc = getComputedStyle(c), nc = getComputedStyle(num);
      saida[n] = { fundo: cc.backgroundColor, contraste: cr(rgb(cc.backgroundColor), rgb(nc.color)) };
    }
    const h = document.querySelector('.agd-cel[data-hoje] .agd-num'), hc = getComputedStyle(h);
    saida.hoje = { contraste: cr(rgb(hc.backgroundColor), rgb(hc.color)) };
    return saida;
  });
  const fundos = Object.values(cs).filter((x) => x.fundo).map((x) => x.fundo);
  ok(new Set(fundos).size === fundos.length && fundos.length >= 3 && Object.values(cs).every((x) => x.contraste >= 4.5), `celular, tema ${tema}: os níveis de carga têm preenchimentos distintos e a data mantém contraste de pelo menos 4,5:1 (${Object.entries(cs).map(([k, v]) => `${k} ${v.contraste}`).join(', ')})`);
  const marcas = await pg.evaluate(() => {
    const h = document.querySelector('.agd-cel[data-hoje]'), sel = document.querySelector('.agd-cel[data-sel]');
    return { hojeDisco: getComputedStyle(h.querySelector('.agd-num')).backgroundColor !== 'rgba(0, 0, 0, 0)', selAnel: getComputedStyle(sel).boxShadow !== 'none', hojeEhSel: h === sel, naoUtil: !!document.querySelector('.agd-cel[data-nao-util]') && /2px/.test(getComputedStyle(document.querySelector('.agd-cel[data-nao-util]')).boxShadow) };
  });
  ok(marcas.hojeDisco && marcas.selAnel && marcas.naoUtil, `celular, tema ${tema}: hoje (disco na data), dia selecionado (anel) e dia sem trabalho (contorno cinza) continuam distintos`);
  if (tema === 'claro') {
    ok((await pg.textContent('.agd-leg')).includes('8 ou mais') && /Sábado, domingo e feriado/.test(await pg.textContent('.agd-leg')) && !/Acompanhar|Compromisso|Com atraso|Evento externo/.test(await pg.evaluate(() => [...document.querySelectorAll('.agd-leg li')].filter((e) => e.getClientRects().length).map((e) => e.textContent).join(' '))), 'celular: a legenda traz a escala de carga, Hoje e o cinza de sábado, domingo e feriado (sem as marcas que o quadrado não mostra)');
    // movimento reduzido: o painel abre e a página rola sem animação
    await pg.emulateMedia({ reducedMotion: 'reduce' });
    const alvoDia = '2026-11-26';
    await celula(pg, alvoDia).evaluate((e) => e.scrollIntoView({ block: 'center' })); await celula(pg, alvoDia).click(); await pg.waitForSelector('.agd-dia-painel'); await pg.waitForTimeout(150);
    const vis = await pg.evaluate(() => { const c = document.querySelector('.agd-pd-cab').getBoundingClientRect(), bar = document.querySelector('.bar')?.getBoundingClientRect(); return { base: c.bottom, barra: bar ? bar.top : innerHeight, topo: c.top }; });
    ok(vis.topo >= 0 && vis.base <= vis.barra, `movimento reduzido: o painel abre e o cabeçalho já está à vista logo em seguida, sem rolagem suave (base em ${Math.round(vis.base)} de ${Math.round(vis.barra)} px)`);
    await pg.emulateMedia({ reducedMotion: 'no-preference' });
  }
  await ctx.close();
}

ok(erros.length === 0, 'nenhum erro de página nem de console durante todos os fluxos' + (erros.length ? ': ' + JSON.stringify(erros.slice(0, 4)) : ''));
await nav.close(); parar();
process.exit(resumo());
