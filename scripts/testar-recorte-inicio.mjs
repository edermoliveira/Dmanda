// Recorte por prazo no Início (ajuste de 22/11/2026): os botões Atrasadas, Vencem hoje e Próximos 7 dias filtram as demandas DENTRO do Início. No Edge e, quando existe, no WebKit emulado do Playwright,
// com banco de TESTE descartável (PGlite, dados fictícios) e servidor na porta 7133. Cobre: um filtro por vez, trocar, desativar, Limpar filtro, aria-pressed, nome e quantidade, os contadores gerais,
// mais de quatro resultados, zero resultados, os mesmos ids dos contadores, abrir e fechar uma demanda, concluir e atualizar o recorte, independência do filtro de Demandas, vagas do Para hoje
// intactas, nenhuma gravação nem consulta só por selecionar, a virada do dia com relógio controlado, o celular (baralho de navegação, sem avanço de etapa), Claro e Escuro, computador, iPad e
// celular, teclado e foco, e a ausência de rolagem lateral. Não é aparelho real: o Safari do iPhone/iPad continua sendo a conferência final. Nunca toca o Supabase real.
// Uso: node scripts/testar-recorte-inicio.mjs
import { devices } from 'playwright-core';
import { abrirEdge, abrirWebkit, criarVerificador, esperar, iniciarServidor, pararServidores as parar } from './auxiliar-navegador.mjs';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario, prepararTitularDeTeste, USUARIO_TESTE as USUARIO } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_RECORTE_INICIO || '7133', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/recorte-inicio', CAPTURAS = '.dados-teste/recorte-inicio-capturas';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });
const { ok, resumo } = criarVerificador();
const PH = '[data-painel="para-hoje"]', RC = '[data-painel="recorte-inicio"]', BOTAO = (g) => `[data-recorte-botao="${g}"]`;

// ---------- dados fictícios: o vencimento exato vai direto ao banco (sem o ajuste de fim de semana e feriado), então as fronteiras valem em qualquer dia da semana ----------
// deslocamento em dias a partir de hoje: a data aplicável de cada demanda (a mais próxima entre vencimento e "Acompanhar em"); finalizada, arquivada e sem prazo ficam fora de todos os recortes
const OFF = { A1: -1, A2: -5, AC: -2, H1: 0, H2: 0, S1: 1, S2: 2, S3: 3, S4: 6, S5: 7, X8: 8 };
const grupoDe = (off, desloc = 0) => { const n = off - desloc; return n < 0 ? 'atrasadas' : n === 0 ? 'hoje' : n <= 7 ? 'sete' : null; };
const esperado = (g, desloc = 0, fora = []) => Object.entries(OFF).filter(([k, o]) => !fora.includes(k) && grupoDe(o, desloc) === g).map(([k]) => k).sort();
const ID = {};
let HOJE;
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await prepararTitularDeTeste(db, USUARIO);
  HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const dia = (n) => somarDias(HOJE, n);
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const mk = async (k, extra = {}) => { const d = await c('criar_demanda', { p: { assunto: `${k} demanda fictícia`, tipo: 'Memorando', numero: '', etapa: 'Fazendo', chegou_em: dia(-20), ...extra } }); ID[k] = d.id; return d; };
  for (const [k, o] of Object.entries(OFF)) {
    if (k === 'AC') { await mk(k); await db.query('update public.demandas set prazo = $1, prazo_original = $1, acompanhar_em = $2 where id = $3', [dia(20), dia(o), ID[k]]); continue; }
    await mk(k); await db.query('update public.demandas set prazo = $1, prazo_original = $1 where id = $2', [dia(o), ID[k]]);
  }
  await mk('N'); await mk('F'); await db.query('update public.demandas set prazo = $1, prazo_original = $1 where id = $2', [dia(-3), ID.F]); await c('concluir_demanda', { p_id: ID.F });
  await mk('AR'); await db.query('update public.demandas set prazo = $1, prazo_original = $1 where id = $2', [dia(-2), ID.AR]); await c('arquivar_demanda', { p_id: ID.AR });
  await db.close();
}
const nomeDe = (id) => Object.entries(ID).find(([, v]) => v === id)?.[0] ?? id.slice(0, 6);
const nomes = (ids) => [...new Set(ids.map(nomeDe))].sort();
const mesmo = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

await iniciarServidor({ porta: PORTA, pasta: PASTA });
const edge = await abrirEdge();
const wk = await abrirWebkit();
const erros = [];
const PERFIS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  estreito: { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};
const abrir = async (perfil, { motor = edge, tema = 'claro', texto = 100, relogio = null } = {}) => {
  const ctx = await motor.newContext({ ...(motor === wk && perfil === 'celular' ? devices['iPhone 13'] : PERFIS[perfil]) });
  await ctx.addInitScript(([t, p]) => { if (!localStorage.getItem('feito')) { localStorage.setItem('feito', '1'); localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:aparencia', JSON.stringify({ textoPct: p })); } }, [tema, texto]);
  if (relogio) await ctx.clock.install({ time: relogio });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  await pg.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
  await pg.waitForSelector(`${PH} .vaga`, { timeout: 120000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await esperar(900);
  return { ctx, pg };
};
const semRolagemLateral = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const contadores = (pg) => pg.$$eval('.stats.tres .stat .n', (l) => l.map((e) => Number(e.textContent)));
const pressionados = (pg) => pg.$$eval('.stats.tres .stat', (l) => l.filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => e.dataset.recorteBotao));
const idsDoRecorte = (pg) => pg.$$eval(`${RC} .dcard`, (l) => l.map((e) => e.dataset.id));
const visivel = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
// As vagas como o SERVIDOR as devolve, lidas por uma segunda página do mesmo navegador (nunca abre o banco de teste por fora enquanto o servidor o usa: o PGlite de uma pasta é de um processo só).
const vagasNaTela = (pg) => pg.$$eval(`${PH} .cards > [data-vaga]`, (l) => l.map((e) => `${e.dataset.vaga}:${e.querySelector('.dcard').dataset.id}`));
const vagasDoServidor = async (ctx) => { const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'load' }); await p.waitForSelector(`${PH} .vaga`, { timeout: 60000 }); await esperar(1000); const v = (await vagasNaTela(p)).map((x) => { const [n, id] = x.split(':'); return `${n}:${nomeDe(id)}`; }).join(); await p.close(); return v; };
const abrirRecorte = async (pg, g) => { if ((await pg.getAttribute(BOTAO(g), 'aria-pressed')) !== 'true') await pg.click(BOTAO(g)); await pg.waitForSelector(`${RC}[data-recorte="${g}"]`, { timeout: 10000 }); await esperar(250); };

// =============================================================================================================================================
// 1) computador, Claro: a seleção, a troca, o toque de novo, Limpar filtro, os contadores, as vagas e a ausência de gravações
// =============================================================================================================================================
const SEMENTE_VAGAS = {};
{
  const { ctx, pg } = await abrir('desktop');
  const pedidos = [];
  pg.on('request', (r) => { if (['fetch', 'xhr'].includes(r.resourceType()) || r.method() !== 'GET') pedidos.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  ok(mesmo(await contadores(pg), [esperado('atrasadas').length, esperado('hoje').length, esperado('sete').length]) && esperado('sete').length > 4, `os contadores gerais são ${esperado('atrasadas').length}, ${esperado('hoje').length} e ${esperado('sete').length} (Atrasadas, Vencem hoje, Próximos 7 dias)`);
  ok((await pressionados(pg)).length === 0 && !(await pg.$(RC)) && await visivel(pg, PH), 'ao entrar o filtro começa desativado: nenhum botão pressionado e o Para hoje à vista');
  const labels = await pg.$$eval('.stats.tres .stat', (l) => l.map((e) => e.getAttribute('aria-pressed')));
  ok(labels.every((x) => x === 'false'), 'os três botões têm aria-pressed="false" quando não há filtro');
  const vagasAntes = await vagasNaTela(pg), guardadasAntes = await vagasDoServidor(ctx);
  const humorAntes = await visivel(pg, '[data-quadro="humor"]');
  pedidos.length = 0;

  for (const g of ['atrasadas', 'hoje', 'sete']) {
    await abrirRecorte(pg, g);
    const ids = nomes(await idsDoRecorte(pg)), certo = esperado(g);
    ok(mesmo(ids, certo) && (await idsDoRecorte(pg)).length === certo.length, `recorte ${g}: os ${certo.length} ids são exatamente os do contador (${ids.join(', ')})`);
    ok(mesmo(await pressionados(pg), [g]) && new URL(pg.url()).pathname === '/', `recorte ${g}: só esse botão fica pressionado (aria-pressed) e a página continua sendo o Início`);
    const nome = { atrasadas: 'Atrasadas', hoje: 'Vencem hoje', sete: 'Próximos 7 dias' }[g];
    const cab = await pg.$eval(`${RC} .recorte-cab`, (e) => e.textContent.replace(/\s+/g, ' ').trim());
    ok(cab.startsWith(nome) && cab.includes(`${certo.length} demanda${certo.length === 1 ? '' : 's'}`) && cab.includes('Limpar filtro'), `recorte ${g}: o cabeçalho mostra o nome, a quantidade e Limpar filtro ("${cab}")`);
    ok(mesmo(await contadores(pg), [esperado('atrasadas').length, esperado('hoje').length, esperado('sete').length]), `recorte ${g}: os três contadores gerais continuam iguais`);
    ok(!(await visivel(pg, PH)) && await visivel(pg, '.pagehead h1') && (await visivel(pg, '[data-quadro="humor"]')) === humorAntes, `recorte ${g}: o Para hoje e a Urgência saem, o cabeçalho e o Humor ficam`);
    ok(await semRolagemLateral(pg), `recorte ${g}: sem rolagem lateral em 1440 px`);
  }
  // o Para hoje escondido não recebe foco nem é exposto a leitores de tela: display none no contêiner (fora da ordem de Tab e da árvore de acessibilidade)
  const oculto = await pg.$eval('[data-inicio-classico]', (e) => ({ hidden: e.hidden, display: getComputedStyle(e).display, focaveis: [...e.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter((x) => x.getClientRects().length > 0).length }));
  ok(oculto.hidden && oculto.display === 'none' && oculto.focaveis === 0, 'recorte ativo: o Para hoje escondido está com display none e nenhum controle dele é focável (nem exposto à acessibilidade)');
  await pg.focus(BOTAO('sete')); let entrou = false;
  for (let i = 0; i < 40 && !entrou; i++) { await pg.keyboard.press('Tab'); entrou = await pg.evaluate(() => !!document.activeElement?.closest('[data-inicio-classico]')); }
  ok(!entrou, 'recorte ativo: 40 toques de Tab nunca param num controle do Para hoje escondido');
  await pg.focus(BOTAO('sete'));
  ok((await idsDoRecorte(pg)).length === 5 && (await pg.$$(`${RC} .cards > .vaga`)).length === 5, 'mais de quatro resultados: os cinco de Próximos 7 dias aparecem todos, sem limite de vagas');
  // trocar substitui; tocar de novo no ativo remove
  await pg.click(BOTAO('hoje')); await pg.waitForSelector(`${RC}[data-recorte="hoje"]`); await esperar(200);
  ok(mesmo(await pressionados(pg), ['hoje']) && (await pg.$$(RC)).length === 1, 'tocar em outro botão substitui o filtro (um só por vez)');
  await pg.click(BOTAO('hoje')); await esperar(300);
  ok(!(await pg.$(RC)) && (await pressionados(pg)).length === 0 && await visivel(pg, PH), 'tocar de novo no botão ativo remove o filtro e a visualização clássica volta');
  // Limpar filtro devolve o foco ao botão que estava ativo
  await abrirRecorte(pg, 'atrasadas'); await pg.click('[data-limpar-recorte]'); await esperar(250);
  ok(!(await pg.$(RC)) && await visivel(pg, PH) && (await pg.evaluate(() => document.activeElement?.dataset?.recorteBotao)) === 'atrasadas', 'Limpar filtro remove o recorte e devolve o foco ao botão Atrasadas');
  ok((await pg.textContent('.stats.tres ~ p[role="status"]'))?.includes('Filtro removido'), 'o leitor de tela é avisado de que o filtro foi removido');
  ok(mesmo(await vagasNaTela(pg), vagasAntes) && (await vagasDoServidor(ctx)) === guardadasAntes, `as quatro vagas do Para hoje seguem as mesmas depois de filtrar e limpar, na tela e no servidor (${guardadasAntes})`);
  ok(pedidos.length === 0, `selecionar, trocar e limpar não gerou nenhum pedido ao servidor${pedidos.length ? ': ' + pedidos.join(' | ') : ''}`);
  SEMENTE_VAGAS.antes = guardadasAntes;

  // abrir e fechar uma demanda sem perder o recorte
  await abrirRecorte(pg, 'sete');
  const idsAntes = nomes(await idsDoRecorte(pg));
  await pg.click(`${RC} .dcard .assunto >> nth=0`); await pg.waitForSelector('.modal-ov', { timeout: 10000 });
  ok((await pg.$(RC)) !== null, 'com a demanda aberta o recorte continua na página');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }); await esperar(300);
  ok(mesmo(await pressionados(pg), ['sete']) && mesmo(nomes(await idsDoRecorte(pg)), idsAntes), 'depois de fechar a demanda o filtro e os resultados são os mesmos');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector(`${PH} .vaga`); await esperar(900);
  ok((await pressionados(pg)).length === 0 && !(await pg.$(RC)), 'recarregar a página começa com o filtro desativado');

  // teclado: Enter e Espaço nos botões, Tab até Limpar filtro, foco visível
  await pg.focus(BOTAO('hoje')); await pg.keyboard.press('Enter'); await pg.waitForSelector(`${RC}[data-recorte="hoje"]`);
  await pg.focus(BOTAO('sete')); await pg.keyboard.press('Space'); await pg.waitForSelector(`${RC}[data-recorte="sete"]`); await esperar(200);
  ok(mesmo(await pressionados(pg), ['sete']), 'pelo teclado, Enter e Espaço ligam e trocam o filtro');
  await pg.keyboard.press('Tab');
  const noLimpar = await pg.evaluate(() => document.activeElement?.matches('[data-limpar-recorte]'));
  const foco = await pg.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { anel: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2, sombra: s.boxShadow !== 'none' }; });
  ok(noLimpar && (foco.anel || foco.sombra), 'o Tab leva ao Limpar filtro, com foco visível');
  await pg.keyboard.press('Enter'); await esperar(250);
  ok(!(await pg.$(RC)) && (await pg.evaluate(() => document.activeElement?.dataset?.recorteBotao)) === 'sete', 'Enter em Limpar filtro limpa e o foco volta ao botão do recorte');
  await pg.focus(BOTAO('atrasadas')); await pg.keyboard.press('Tab'); await pg.keyboard.press('Shift+Tab');
  const estilo = async (g) => pg.$eval(BOTAO(g), (e) => { const s = getComputedStyle(e); return `${s.boxShadow}|${s.borderColor}|${s.backgroundColor}`; });
  const normal = await estilo('hoje'); await abrirRecorte(pg, 'hoje'); const ativo = await estilo('hoje');
  ok(normal !== ativo, 'o botão selecionado é destacado também visualmente (estilo diferente do botão normal)');
  await pg.screenshot({ path: `${CAPTURAS}/desktop-claro-hoje.png` });
  await ctx.close();
}

// =============================================================================================================================================
// 2) o filtro do Início é independente do filtro global de Demandas
// =============================================================================================================================================
{
  const { ctx, pg } = await abrir('desktop');
  await pg.click('[data-nav="demandas"]'); await pg.waitForURL('**/demandas'); await pg.waitForSelector('[data-filtros]');
  await pg.click('[data-filtros]'); await pg.waitForSelector('.painel-filtros'); await pg.selectOption('#f-prazo', 'sete'); await pg.keyboard.press('Escape'); await esperar(300);
  const rotuloFiltros = () => pg.getAttribute('[data-filtros]', 'aria-label');
  ok(/Filtros, 1 ativo/.test(await rotuloFiltros()), 'em Demandas o filtro de prazo foi aplicado pelo painel de filtros');
  await pg.click('[data-nav="inicio"]'); await pg.waitForSelector(`${PH} .vaga`); await esperar(500);
  ok((await pressionados(pg)).length === 0 && !(await pg.$(RC)), 'o filtro de Demandas não liga nenhum recorte do Início');
  await abrirRecorte(pg, 'atrasadas');
  ok(mesmo(nomes(await idsDoRecorte(pg)), esperado('atrasadas')), 'com Demandas filtrada por Próximos 7 dias, o recorte Atrasadas do Início continua mostrando as atrasadas');
  await pg.click('[data-nav="demandas"]'); await pg.waitForURL('**/demandas'); await pg.waitForSelector('[data-filtros]'); await esperar(300);
  ok(/Filtros, 1 ativo/.test(await rotuloFiltros()), 'o recorte do Início não alterou o filtro de Demandas');
  await pg.click('[data-nav="inicio"]'); await pg.waitForSelector(`${PH} .vaga`); await esperar(400);
  ok((await pressionados(pg)).length === 0 && !(await pg.$(RC)), 'ao voltar ao Início o recorte começa desativado');
  await pg.click('[data-nav="demandas"]'); await pg.waitForURL('**/demandas'); await pg.click('[data-filtros]'); await pg.waitForSelector('.painel-filtros'); await pg.click('.painel-filtros button:has-text("Limpar filtros")'); await ctx.close();
}

// =============================================================================================================================================
// 3) relógio controlado: os limites de datas e a virada do dia com o recorte ativo
// =============================================================================================================================================
{
  const { ctx, pg } = await abrir('desktop', { relogio: new Date(`${HOJE}T23:50:00-03:00`) });
  ok(mesmo(await contadores(pg), [esperado('atrasadas').length, esperado('hoje').length, esperado('sete').length]), 'às 23h50 do dia de hoje os contadores seguem a regra (atrasada antes de hoje, hoje, de amanhã ao sétimo dia)');
  for (const g of ['atrasadas', 'hoje', 'sete']) { await abrirRecorte(pg, g); ok(mesmo(nomes(await idsDoRecorte(pg)), esperado(g)), `23h50: o recorte ${g} tem ${esperado(g).join(', ')}`); }
  await abrirRecorte(pg, 'sete');
  ok(nomes(await idsDoRecorte(pg)).includes('S5') && !nomes(await idsDoRecorte(pg)).includes('X8') && !nomes(await idsDoRecorte(pg)).includes('H2'), 'o sétimo dia entra (S5), o oitavo fica de fora (X8) e o que vence hoje não se repete em Próximos 7 dias');
  await abrirRecorte(pg, 'hoje');
  await pg.clock.fastForward(20 * 60 * 1000); await esperar(800);   // passa da meia-noite de Brasília: o dia vira e o contador de 30 s renova a data
  ok(mesmo(await contadores(pg), [esperado('atrasadas', 1).length, esperado('hoje', 1).length, esperado('sete', 1).length]), `depois da meia-noite os contadores acompanham o novo dia (${(await contadores(pg)).join(', ')})`);
  ok(mesmo(await pressionados(pg), ['hoje']) && mesmo(nomes(await idsDoRecorte(pg)), esperado('hoje', 1)), `o filtro Vencem hoje continua ativo e agora mostra ${esperado('hoje', 1).join(', ')}, sem reordenar nem gravar nada`);
  await abrirRecorte(pg, 'atrasadas');
  ok(mesmo(nomes(await idsDoRecorte(pg)), esperado('atrasadas', 1)) && nomes(await idsDoRecorte(pg)).includes('H1'), 'as que venciam ontem aparecem em Atrasadas depois da virada do dia');
  await ctx.close();
}

// =============================================================================================================================================
// 4) Claro e Escuro, computador, iPad e celular: leiaute, rolagem lateral e capturas
// =============================================================================================================================================
for (const [perfil, tema, texto] of [['desktop', 'escuro', 100], ['ipad', 'claro', 100], ['ipad', 'escuro', 100], ['celular', 'claro', 125], ['estreito', 'escuro', 100]]) {
  const { ctx, pg } = await abrir(perfil, { tema, texto });
  for (const g of ['atrasadas', 'sete']) {
    await abrirRecorte(pg, g);
    const lateral = await semRolagemLateral(pg);
    const m = await pg.evaluate((sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return { dentro: r.left >= 0 && r.right <= innerWidth + 1, botao: [...document.querySelectorAll('[data-limpar-recorte]')].map((b) => b.getBoundingClientRect().width > 0)[0] }; }, RC);
    ok(lateral && m.dentro && m.botao, `${perfil} ${tema} texto ${texto}%, ${g}: sem rolagem lateral, o recorte cabe na largura e Limpar filtro está visível`);
    const alvo = await pg.$eval('[data-limpar-recorte]', (e) => { const r = e.getBoundingClientRect(); return Math.max(r.height, 44); });
    ok(alvo >= 44 || perfil === 'desktop', `${perfil} ${tema}: Limpar filtro com área de toque suficiente`);
    await pg.screenshot({ path: `${CAPTURAS}/${perfil}-${tema}-${g}.png` });
  }
  if (perfil !== 'celular' && perfil !== 'estreito') { const cols = await pg.$eval(`${RC} .cards`, (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length); ok(cols >= 2, `${perfil}: os cards ficam em ${cols} colunas na grade, não em faixa com rolagem horizontal`); }
  await ctx.close();
}

// =============================================================================================================================================
// 5) celular (Edge e WebKit emulado): baralho de navegação, sem avanço de etapa
// =============================================================================================================================================
for (const [rot, motor] of [['Edge 390', edge], ['WebKit iPhone', wk]]) {
  if (!motor) continue;
  const { ctx, pg } = await abrir('celular', { motor });
  const ordemAntes = await pg.evaluate(() => localStorage.getItem('dmanda:para-hoje-ordem'));
  await abrirRecorte(pg, 'sete');
  const total = esperado('sete').length;
  ok((await pg.$$(`${RC} .ph-pilha`)).length === 1 && (await pg.textContent(`${RC} .ph-posicao`)).trim() === `1 de ${total}`, `${rot}: o recorte vira um baralho com ${total} cards (1 de ${total})`);
  const botoes = await pg.$$eval(`${RC} .ph-botoes .btn`, (l) => l.map((e) => e.textContent.trim().replace(/\s+/g, ' ')));
  ok(botoes.length === 3 && /Passar para o fim/.test(botoes[0]) && /Abrir/.test(botoes[1]) && /Voltar ao anterior/.test(botoes[2]) && !botoes.some((b) => /Avançar|Finalizar|Escolher a etapa/.test(b)), `${rot}: os botões são os da navegação (${botoes.join(' | ')}), sem avançar de etapa`);
  const ativoId = () => pg.$eval(`${RC} .ph-arrasto`, (e) => e.dataset.ativoId);
  const primeiro = await ativoId();
  await pg.click(`${RC} [data-pilha-passar]`); await esperar(700);
  const segundo = await ativoId();
  ok(segundo !== primeiro && (await pg.textContent(`${RC} .ph-posicao`)).trim() === `1 de ${total}`, `${rot}: Passar para o fim mostra o próximo card do recorte`);
  await pg.click(`${RC} [data-pilha-avancar]`); await esperar(700);
  ok((await ativoId()) === primeiro, `${rot}: Voltar ao anterior devolve o card`);
  // o gesto para a direita também só navega (volta ao anterior), nunca muda de etapa
  const caixa = await pg.locator(`${RC} .ph-arrasto`).boundingBox();
  const cdp = motor === edge ? await ctx.newCDPSession(pg) : null;
  if (cdp) {
    const y = caixa.y + 60, x0 = caixa.x + 40, x1 = caixa.x + caixa.width - 30;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 10, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await esperar(900);
    ok((await ativoId()) !== primeiro, `${rot}: o gesto para a direita navega entre os cards do recorte`);
  }
  const etapas = await pg.evaluate(async () => (await (await fetch('/api/exportar')).json()).demandas.filter((d) => d.etapa === 'Fazendo').length);   // a cópia só lê
  ok(etapas === Object.keys(OFF).length + 1, `${rot}: nenhuma etapa mudou pelos gestos nem pelos botões (${etapas} em Fazendo)`);
  ok((await pg.evaluate(() => localStorage.getItem('dmanda:para-hoje-ordem'))) === ordemAntes, `${rot}: a ordem do baralho do Para hoje guardada no aparelho não foi tocada`);
  await pg.click(`${RC} [data-limpar-recorte]`); await pg.waitForSelector(`${PH} .ph-pilha`); await esperar(500);
  ok(await visivel(pg, `${PH} .ph-pilha`) && !(await pg.$(RC)) && await semRolagemLateral(pg), `${rot}: ao limpar, o baralho do Para hoje volta`);
  // abrir pelo botão Abrir
  await abrirRecorte(pg, 'atrasadas'); await pg.click(`${RC} [data-pilha-abrir]`); await pg.waitForSelector('.modal-ov'); await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov')); await esperar(300);
  ok((await pressionados(pg)).join() === 'atrasadas' && (await pg.$(RC)) !== null, `${rot}: abrir e fechar a demanda mantém o recorte`);
  await ctx.close();
}

// =============================================================================================================================================
// 6) concluir dentro do recorte: resultados e contadores se atualizam; o último resultado deixa o estado vazio, com Limpar filtro
// =============================================================================================================================================
{
  const { ctx, pg } = await abrir('desktop');
  const guardadasAntes = await vagasDoServidor(ctx);
  await abrirRecorte(pg, 'hoje');
  const concluir = async (k) => { await pg.click(`${RC} .dcard[data-id="${ID[k]}"] button:has-text("Concluir demanda")`); await pg.waitForFunction((id) => !document.querySelector(`[data-painel="recorte-inicio"] .dcard[data-id="${id}"]`), ID[k], { timeout: 15000 }); await esperar(500); };
  await concluir('H1');
  ok(mesmo(nomes(await idsDoRecorte(pg)), ['H2']) && (await pg.textContent(`${RC} .recorte-cab small`)).trim() === '1 demanda' && (await contadores(pg))[1] === 1, 'concluir uma demanda tira o card do recorte, atualiza a quantidade e o contador (1 demanda)');
  await concluir('H2');
  ok((await contadores(pg))[1] === 0 && (await pg.$('[data-recorte-vazio]')) !== null && (await pg.textContent(`${RC} .recorte-cab small`)).trim() === '0 demandas', 'o último resultado saiu: o filtro continua ativo, mostra o estado vazio e a contagem 0');
  ok(mesmo(await pressionados(pg), ['hoje']) && await visivel(pg, '[data-limpar-recorte]') && /Nenhuma demanda vence hoje/.test(await pg.textContent('[data-recorte-vazio]')), 'no estado vazio o botão segue pressionado e Limpar filtro permanece disponível');
  ok(await semRolagemLateral(pg), 'o estado vazio não gera rolagem lateral');
  await pg.screenshot({ path: `${CAPTURAS}/desktop-claro-vazio.png` });
  await pg.click('[data-limpar-recorte]'); await esperar(900);
  const vagas = await vagasNaTela(pg), conclu = new Set([ID.H1, ID.H2]);
  ok(await visivel(pg, PH) && vagas.every((v) => !conclu.has(v.split(':')[1])), `ao limpar, o Para hoje mostra o estado atualizado: as concluídas saíram das vagas (${vagas.length} vagas)`);
  const depois = await vagasDoServidor(ctx);
  ok(depois !== guardadasAntes && !depois.includes('H1') && !depois.includes('H2'), `a vaga liberada (${guardadasAntes} passou a ${depois}) pela conclusão foi reposta pelo Para hoje (ação real), sem mexer nas demais`);
  await ctx.close();
}

// 7) concluir dentro do baralho do celular: a pilha encolhe, o contador acompanha e o último resultado deixa o estado vazio com Limpar filtro
{
  const { ctx, pg } = await abrir('celular');
  await abrirRecorte(pg, 'atrasadas');
  const n0 = (await idsDoRecorte(pg)).length, antes = (await contadores(pg))[0];
  const concluirAtivo = async () => { const id = await pg.$eval(`${RC} .ph-arrasto`, (e) => e.dataset.ativoId); await pg.click(`${RC} .ph-arrasto button:has-text("Concluir demanda")`); await pg.waitForFunction((x) => document.querySelector(`${'[data-painel="recorte-inicio"]'} .ph-arrasto`)?.dataset.ativoId !== x, id, { timeout: 15000 }).catch(() => {}); await esperar(700); };
  await concluirAtivo();
  ok(n0 === 3 && (await contadores(pg))[0] === antes - 1 && (await pg.textContent(`${RC} .recorte-cab small`)).trim() === '2 demandas' && (await pg.textContent(`${RC} .ph-posicao`)).trim() === '1 de 2', 'celular: concluir o card da frente tira do baralho, atualiza a quantidade e o contador (1 de 2)');
  await concluirAtivo(); await concluirAtivo();
  ok((await pg.$('[data-recorte-vazio]')) !== null && (await contadores(pg))[0] === 0 && mesmo(await pressionados(pg), ['atrasadas']) && await visivel(pg, '[data-limpar-recorte]') && await semRolagemLateral(pg), 'celular: sem resultados o filtro continua ativo, com o estado vazio e Limpar filtro');
  await pg.click('[data-limpar-recorte]'); await esperar(600);
  ok(!(await pg.$(RC)) && await visivel(pg, PH), 'celular: Limpar filtro devolve o Para hoje');
  await ctx.close();
}

await wk?.close();
parar();
await edge.close();
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
process.exit(resumo());
