// Início (decisão 64) no navegador (Edge) com bancos locais de TESTE (PGlite) separados, só dados fictícios: composição em duas colunas (quatro vagas na mesma linha, Nova urgência na mesma grade,
// Humor, Clima e mini calendário na coluna fixa), prioridade fora das vagas, reposição só da vaga liberada, iPad em pé (faixa de duas vagas) e celular (pilha com gestos de verdade, enviados por
// toque emulado pelo protocolo do navegador), mini calendário com as seis categorias, cores combinadas, contraste nos dois temas, janela da cidade fora da coluna e persistência. Sobe o próprio
// servidor na porta 7121. Nunca toca o Supabase real. EMULADO: toque, iPad e iPhone (não são aparelhos reais). Uso: node scripts/testar-inicio.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { semearCenario } from './semear-inicio.mjs';
import { somarDias } from '../src/lib/prazos.ts';
import * as F from './clima-fixtures.mjs';
import { CATEGORIAS_MINI, corMisturada } from '../src/lib/mini-calendario.ts';

const PORTA = process.env.PORTA_TESTE_INICIO || '7121', BASE = `http://localhost:${PORTA}`, RAIZ = '.dados-teste/inicio', CAPTURAS = '.dados-teste/inicio-capturas-teste';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(RAIZ, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });
// o banco usa o relógio real (hoje em Brasília): perto da meia-noite o dia viraria no meio do teste
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
{
  const agora = new Date(), partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora).split(':').map(Number);
  if (24 * 60 - (partes[0] * 60 + partes[1]) < 40) throw new Error('Faltam menos de 40 minutos para a meia-noite em Brasília: rode o teste depois da virada do dia.');
}
// as 63 combinações possíveis de categorias, como a aplicação monta a cor da célula
const TODAS_AS_MISTURAS = Array.from({ length: 63 }, (_, i) => corMisturada(CATEGORIAS_MINI.filter((_c, k) => (i + 1) & (1 << k)), (c) => `var(--cal-${c})`));
/**
 * Média, no espaço oklab e sem recorte de gamut (como o navegador mistura), de cores dadas como "oklch(L C H)" ou "lab(L% a b)" (o CSS compilado converte os tokens de oklch para lab),
 * devolvida em sRGB (bytes) com o recorte só no fim. É a conta independente da aplicação: o que a mistura em partes iguais deve dar.
 */
const mediaOklab = (tokens) => {
  const linParaOklab = ([r, g, b]) => { const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b); return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
  const doToken = (t) => {
    let m = t.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/);
    if (m) { const [L, C, H] = m.slice(1).map(Number); return [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)]; }
    m = t.match(/lab\(([\d.]+)% (-?[\d.]+) (-?[\d.]+)\)/);
    if (!m) throw new Error(`formato de cor não previsto: ${t}`);
    const [L, a, b] = m.slice(1).map(Number), fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, inv = (f) => (f ** 3 > 0.008856 ? f ** 3 : (116 * f - 16) / 903.3);
    const X = inv(fx) * 0.96422, Y = L > 8 ? fy ** 3 : L / 903.3, Z = inv(fz) * 0.82521;
    const x = 0.9555766 * X - 0.0230393 * Y + 0.0631636 * Z, y = -0.0282895 * X + 1.0099416 * Y + 0.0210077 * Z, z = 0.0122982 * X - 0.020483 * Y + 1.3299098 * Z;
    return linParaOklab([3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z]);
  };
  const lab = tokens.map(doToken), [L, A, B] = [0, 1, 2].map((i) => lab.reduce((x, c) => x + c[i], 0) / lab.length);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map((v) => { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); });
};
/** Contraste do texto do tema sobre cada uma das 63 misturas. */
const contrasteDasMisturas = (pg) => pg.evaluate((exprs) => {
  const app = document.querySelector('.app'), cs = getComputedStyle(app), cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const texto = rgb(cs.getPropertyValue('--text').trim());
  return exprs.map((x) => { const d = document.createElement('div'); d.style.backgroundColor = x; app.appendChild(d); const bg = rgb(getComputedStyle(d).backgroundColor); d.remove(); const a = lum(bg) + 0.05, b = lum(texto) + 0.05; return Math.max(a, b) / Math.min(a, b); });
}, TODAS_AS_MISTURAS);
// as pilhas do Para hoje e da Nova urgência convivem no celular: os botões do Para hoje ficam na pilha filha direta do painel
const PASSAR = '[data-painel="para-hoje"] > .ph-pilha [data-pilha-passar]', AVANCAR = '[data-painel="para-hoje"] > .ph-pilha [data-pilha-avancar]', ABRIR = '[data-painel="para-hoje"] > .ph-pilha [data-pilha-abrir]';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let servidor = null;
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
const subir = async (pasta) => {
  parar();
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: pasta }, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) return; } catch { /* subindo */ } await esperar(2000); }
  throw new Error('o servidor de teste não subiu');
};
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const ctxPadrao = { desktop: { viewport: { width: 1680, height: 980 } }, notebook: { viewport: { width: 1280, height: 800 } }, ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } };
const abrir = async (perfil, { tema = 'claro', clima = true, esperadas = 4, extra = {}, antes } = {}) => {
  const ctx = await nav.newContext({ ...ctxPadrao[perfil], ...extra });
  await ctx.addInitScript((t) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, tema);
  if (clima) await ctx.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, async (rota) => { const u = new URL(rota.request().url()); await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.hostname.startsWith('geocoding') ? F.resultados(F.TAQUARA_RS, F.PORTO_ALEGRE) : F.previsao({ hora: `${HOJE}T07:45`, data: HOJE })) }); });
  else await ctx.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, (r) => r.abort());
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  if (antes) await antes(pg, ctx);
  await pg.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
  await pg.waitForFunction((n) => document.querySelectorAll('[data-painel="para-hoje"] [data-vaga]').length >= n, esperadas, { timeout: 120000, polling: 100 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 4000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await pg.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity), null, { timeout: 15000 }).catch(() => {});
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
const caixaAtiva = (pg) => R(pg, '[data-pilha] .ph-arrasto');
const deslizarAtivo = async (pg, dx, dy = 0, deYRel = 0.45) => { const c = await caixaAtiva(pg); const y = c.y + c.h * deYRel, x = c.x + c.w / 2; await deslizar(pg, x - dx / 2, y, x + dx / 2, y + dy); };
const ativo = (pg) => pg.$eval('[data-pilha] .vaga[data-ativo]', (e) => ({ id: e.closest('[data-ativo-id]').dataset.ativoId, assunto: e.querySelector('.assunto')?.textContent.trim(), etapa: e.querySelector('.tags .chip')?.textContent.trim(), vaga: e.dataset.vaga })).catch(() => null);
const aguardarAtivo = (pg, assunto) => pg.waitForFunction((a) => document.querySelector('[data-pilha] .vaga[data-ativo] .assunto')?.textContent.trim().startsWith(a), assunto, { timeout: 8000 }).then(() => true, () => false);

// =============================================================================================
// 1) cenário completo: computador largo
// =============================================================================================
const pastaCompleto = await semearCenario('completo', `${RAIZ}/completo`);
await subir(pastaCompleto);
{
  const { ctx, pg } = await abrir('desktop');
  const vagas = await pg.$$eval('[data-painel="para-hoje"] .ph-cards > .vaga', (l) => l.map((e) => { const r = e.getBoundingClientRect(); return { id: e.querySelector('.dcard').dataset.id, pos: e.dataset.vaga, x: r.x, y: Math.round(r.y), w: r.width, h: r.height, prio: !!e.querySelector('.prio-pref') }; }));
  ok(vagas.length === 4 && new Set(vagas.map((v) => v.y)).size === 1 && vagas.every((v) => v.w > 200), `quatro vagas lado a lado na mesma linha (larguras ${vagas.map((v) => Math.round(v.w)).join(', ')})`);
  ok(vagas.map((v) => v.pos).sort().join() === '1,2,3,4' && vagas[0].pos === '1' && vagas[1].pos === '2' && vagas[0].prio && vagas[1].prio && !vagas[2].prio && !vagas[3].prio, 'as prioridades que ocupam vaga vêm antes das comuns e as posições gravadas são 1 a 4');
  const contadores = await pg.$$eval('.ini-contadores .stat', (l) => l.map((e) => Math.round(e.getBoundingClientRect().y)));
  ok(contadores.length === 3 && new Set(contadores).size === 1, 'três contadores na mesma linha');
  const urg = await pg.$$eval('[data-nova-urgencia] .ph-cards-urg > .vaga', (l) => l.map((e) => ({ id: e.querySelector('.dcard').dataset.id, fora: e.hasAttribute('data-fora-vaga'), y: Math.round(e.getBoundingClientRect().y), w: e.getBoundingClientRect().width })));
  const faixa = await R(pg, '[data-nova-urgencia]'), ultimaVaga = Math.max(...await pg.$$eval('[data-painel="para-hoje"] .ph-cards > .vaga', (l) => l.map((e) => e.getBoundingClientRect().bottom)));
  ok(urg.length === 3 && faixa.y >= ultimaVaga - 1, 'a faixa Nova urgência vem imediatamente abaixo das vagas');
  ok(urg[0].fora && urg[1].fora && !urg[2].fora && new Set(urg.map((u) => u.y)).size === 1, 'as duas prioridades fora das vagas abrem a Nova urgência, antes da urgência comum, na mesma linha');
  const colsU = await pg.$eval('.ph-cards-urg', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length), colsV = await pg.$eval('.ph-cards', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  ok(colsU === 4 && colsV === 4 && Math.abs(urg[0].w - vagas[0].w) < 40, 'a Nova urgência usa a mesma grade de quatro colunas das vagas');
  const todos = await pg.$$eval('[data-painel="para-hoje"] .dcard', (l) => l.map((e) => e.dataset.id));
  ok(new Set(todos).size === todos.length && todos.length === 7, `cada demanda aparece uma vez entre as vagas e a Nova urgência (${todos.length} cards)`);
  const apoio = await R(pg, '.ini-apoio'), principal = await R(pg, '.ini-principal');
  ok(apoio.x >= principal.r - 1 && apoio.w >= 260 && apoio.w <= 340, `a coluna de apoio fica à direita (${Math.round(apoio.w)} px)`);
  ok((await pg.$$eval('.ph-pilha, .ph-atras, .cartas[data-modo="pilha"]', (l) => l.length)) === 0, 'desktop: nenhum baralho (as quatro vagas e a Nova urgência ficam como grade)');
  const ordemApoio = await pg.$$eval('.ini-apoio > *', (l) => l.map((e) => (e.matches('[data-quadro="humor"]') ? 'humor' : e.matches('.widgets') ? 'clima' : e.matches('[data-mini-calendario]') ? 'calendario' : '?')));
  ok(ordemApoio.join() === 'humor,clima,calendario', `Humor, Clima e mini calendário, nessa ordem (${ordemApoio.join()})`);
  const sem = await pg.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, comBarra: [...document.querySelectorAll('.ph .dcard')].filter((c) => c.scrollHeight > c.clientHeight + 1).length }));
  ok(sem.x <= 0 && sem.comBarra === 0, 'sem rolagem horizontal da página e sem barra de rolagem em card');
  // --- decisão 66: tamanho único dos cards, ajuda do Para hoje e fim de semana no mini calendário
  {
    const medidasCards = await pg.$$eval('[data-painel="para-hoje"] .dcard', (l) => l.map((e) => { const r = e.getBoundingClientRect(); return `${r.width.toFixed(1)}x${r.height.toFixed(1)}`; }));
    ok(medidasCards.length === 7 && new Set(medidasCards).size === 1, `Para hoje e Nova urgência: os sete cards têm a mesma largura e a mesma altura (${[...new Set(medidasCards)].join(', ')})`);
    ok((await pg.$$eval('[data-painel="para-hoje"] h3 small, [data-painel="para-hoje"] > h3 + .data', (l) => l.length)) === 0 && (await pg.$eval('[data-painel="para-hoje"] > h3', (e) => e.firstElementChild.textContent)) === 'Para hoje', 'o título do Para hoje é só "Para hoje", seguido do botão de ajuda');
    const bt = pg.getByRole('button', { name: 'Sobre o Para hoje' });
    const topo = async () => pg.$$eval('[data-painel="para-hoje"] .dcard', (l) => l.map((e) => Math.round(e.getBoundingClientRect().y * 10) / 10).join());
    const antes = await topo();
    ok((await bt.getAttribute('aria-expanded')) === 'false' && (await pg.locator('.ajuda-balao').count()) === 0, 'a ajuda começa fechada, com nome acessível "Sobre o Para hoje"');
    await bt.click(); await esperar(150);
    const balao = await pg.$eval('.ajuda-balao', (e) => { const r = e.getBoundingClientRect(); return { t: e.textContent, ok: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, role: e.getAttribute('role'), liga: document.querySelector('.ajuda-b').getAttribute('aria-controls') === e.id }; });
    ok((await bt.getAttribute('aria-expanded')) === 'true' && balao.t === 'Até quatro demandas em foco. Pedidos da Prefeita e do Gabinete têm prioridade. Ao concluir uma demanda, a vaga é liberada.' && balao.ok && balao.liga, 'o clique abre o balão curto, ligado ao botão e dentro da janela');
    ok((await topo()) === antes, 'abrir o balão não desloca os cards');
    await pg.locator('.ajuda-balao').click(); await esperar(100);
    ok((await pg.locator('.ajuda-balao').count()) === 1, 'clicar no texto do balão não o fecha');
    await pg.keyboard.press('Escape'); await esperar(100);
    ok((await pg.locator('.ajuda-balao').count()) === 0 && (await bt.evaluate((e) => e === document.activeElement)), 'Esc fecha o balão e devolve o foco ao botão');
    await bt.focus(); await pg.keyboard.press('Enter'); await esperar(100);
    const porEnter = await pg.locator('.ajuda-balao').count();
    await pg.mouse.click(900, 200); await esperar(100);
    ok(porEnter === 1 && (await pg.locator('.ajuda-balao').count()) === 0, 'Enter abre e o clique fora fecha');
    await pg.locator('.ini-contadores .stat').last().focus(); await pg.keyboard.press('Tab');
    ok(await pg.evaluate(() => document.activeElement.classList.contains('ajuda-b') && document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineStyle !== 'none'), 'o botão de ajuda recebe foco visível pelo teclado');

    const sem = await pg.$$eval('.mc-dia', (l) => l.map((b) => { const dia = new Date(`${b.dataset.data}T00:00:00Z`).getUTCDay(); return { fim: dia === 0 || dia === 6, marca: b.hasAttribute('data-fim-semana'), estilo: b.hasAttribute('style'), bg: getComputedStyle(b).backgroundColor, depois: getComputedStyle(b, '::after').content }; }));
    ok(sem.length === 42 && sem.every((c) => c.fim === c.marca) && sem.filter((c) => c.marca).length === 12, 'só sábados e domingos (12 das 42 células) levam a marca de fim de semana');
    const semMarca = sem.filter((c) => c.marca && !c.estilo), comMarca = sem.filter((c) => c.marca && c.estilo);
    ok(semMarca.length > 0 && semMarca.every((c) => /\/ 0\.06\)$/.test(c.bg)) && sem.filter((c) => !c.marca && !c.estilo).every((c) => /(transparent|\/ 0\)|rgba\(0, 0, 0, 0\))/.test(c.bg)), 'fim de semana sem marcação: cinza neutro discreto; dia útil sem marcação continua sem fundo');
    ok(comMarca.length > 0 && comMarca.every((c) => c.depois !== 'none' && !/\/ 0\.06\)$/.test(c.bg)) && sem.filter((c) => !c.marca && c.estilo).every((c) => c.depois === 'none'), 'fim de semana com marcação: mantém a cor da categoria ou a mistura e ganha só um traço cinza; dia útil marcado não tem traço');
    const dataSab = await pg.$eval('.mc-dia[data-fim-semana]:not([style]):not([data-fora])', (e) => e.dataset.data), sab = pg.locator(`.mc-dia[data-data="${dataSab}"]`);
    await sab.click(); await esperar(150);
    ok((await sab.getAttribute('data-sel')) === 'true' && (await pg.locator('.mc-dia-lista').count()) === 1, 'sábado e domingo continuam selecionáveis (a lista do dia abre)');
    await pg.locator('.mc-recolher').click(); await esperar(100);
    await pg.locator('button[aria-label="Alternar tema claro e escuro"]').click(); await esperar(500);
    const claro = await pg.$eval('.mc-dia[data-fim-semana]:not([style])', (b) => getComputedStyle(b).backgroundColor);
    await pg.locator('button[aria-label="Alternar tema claro e escuro"]').click(); await esperar(300);
    const escuro = await pg.$eval('.mc-dia[data-fim-semana]:not([style])', (b) => getComputedStyle(b).backgroundColor);
    ok(claro !== escuro && /\/ 0\.06\)$/.test(claro) && /\/ 0\.06\)$/.test(escuro), 'o cinza do fim de semana existe nos dois temas (derivado do texto de cada tema)');
    await pg.$eval('.main', (e) => { e.scrollTop = 0; }); await esperar(200);   // o foco por teclado pode ter rolado a página: o bloco da coluna lateral parte do topo
  }
  const menu = await pg.$eval('.app', (e) => e.dataset.aberto);
  ok(menu === 'true' && (await R(pg, '.side')).w > 220 && (await pg.$$eval('.side .navi .tx', (l) => l.filter((e) => e.offsetParent && e.textContent.trim()).length)) >= 7, 'menu lateral aberto, com ícones e rótulos, quando não há escolha guardada');

  // --- coluna lateral (decisão 65): sem rolagem própria; a página inteira rola, mesmo com o ponteiro sobre ela; acompanha até a borda e para, nos dois sentidos, sem salto
  await pg.setViewportSize({ width: 1680, height: 760 }); await esperar(500);
  const rolarPara = async (n) => { await pg.$eval('.main', (e, v) => { e.scrollTop = v; }, n); await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  const apoioR = () => pg.$eval('.ini-apoio', (e) => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, h: r.height, ib: document.querySelector('.ini').getBoundingClientRect().bottom }; });
  const medidas = () => pg.$eval('.main', (e) => ({ max: e.scrollHeight - e.clientHeight, ch: e.clientHeight }));
  const info = await medidas();
  const prop = await pg.$eval('.ini-apoio', (e) => ({ ov: getComputedStyle(e).overflowY, mh: getComputedStyle(e).maxHeight, sh: e.scrollHeight, ch: e.clientHeight, pos: getComputedStyle(e).position }));
  ok(prop.pos === 'sticky' && prop.ov === 'visible' && prop.mh === 'none' && prop.sh <= prop.ch + 1, 'a coluna lateral não tem rolagem própria (sticky, sem overflow nem altura máxima)');
  const a0 = await apoioR();
  ok(a0.h > info.ch - 84 - 16 && info.max > 400, `nesta janela a coluna (${Math.round(a0.h)} px) é mais alta que a área visível e a página tem o que rolar (${Math.round(info.max)} px)`);
  const centro = await pg.$eval('.ini-apoio', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + 120]; });
  await pg.mouse.move(centro[0], centro[1]); await pg.mouse.wheel(0, 240); await esperar(900);
  const st1 = await pg.$eval('.main', (e) => e.scrollTop);
  ok(st1 > 100 && (await pg.$eval('.ini-apoio', (e) => e.scrollTop)) === 0, `a roda do mouse com o ponteiro sobre a coluna rola a página inteira (${Math.round(st1)} px) e não a coluna`);
  await rolarPara(0);
  const PASSO = 40, desce = [];
  for (let sc = 0; sc <= Math.min(info.max, 700); sc += PASSO) { await rolarPara(sc); desce.push({ sc, ...(await apoioR()) }); }
  if (process.env.DEPURAR) console.log('desce', JSON.stringify(desce.map((x) => [x.sc, Math.round(x.t), Math.round(x.b)])));
  const parou = desce.findIndex((x) => x.b <= info.ch - 16 + 1);
  ok(parou > 2 && desce.slice(0, parou).every((x, i, l) => i === 0 || Math.abs(l[i - 1].t - x.t - PASSO) <= 1), `ao descer a coluna acompanha a página (${PASSO} px a cada ${PASSO} px) até a borda de baixo aparecer (parou em ${desce[parou]?.sc} px de rolagem)`);
  const presa = desce.slice(parou).filter((x) => x.ib >= info.ch - 16 + 1), fimConteudo = desce.slice(parou).filter((x) => x.ib < info.ch - 16 + 1);
  ok(parou > 0 && presa.length >= 2 && presa.every((x) => Math.abs(x.b - (info.ch - 16)) <= 1) && fimConteudo.every((x) => Math.abs(x.b - x.ib) <= 1), `depois disso a borda de baixo fica parada na janela (${presa.length} posições) enquanto a página rola, e só sai dela quando o fim do conteúdo a empurra`);
  const ultimo = desce[desce.length - 1];
  const sobe = [];
  for (let sc = ultimo.sc; sc >= 0; sc -= PASSO) { await rolarPara(sc); sobe.push({ sc, ...(await apoioR()) }); }
  ok(Math.abs(sobe[1].t - sobe[0].t - PASSO) <= 1, `ao subir a coluna acompanha a página desde o primeiro passo, sem salto na troca de direção (${Math.round(sobe[1].t - sobe[0].t)} px para ${PASSO} px)`);
  const chegou = sobe.findIndex((x) => x.t >= 84 - 1);
  ok(chegou > 0 && sobe.slice(0, chegou).every((x, i, l) => i === 0 || Math.abs(x.t - l[i - 1].t - PASSO) <= 1) && Math.abs(sobe[chegou].t - 84) <= PASSO, 'ao subir ela acompanha a página até a borda de cima chegar logo abaixo do cabeçalho');
  ok(sobe.slice(chegou + 1).filter((x) => x.sc > 90).every((x) => Math.abs(x.t - 84) <= 1) && Math.abs(sobe[sobe.length - 1].t - a0.t) <= 1, 'e então para (84 px) até o início da página, onde volta à posição de origem');
  // troca de direção no meio do caminho: desce 300, sobe 120 e desce 60: o deslocamento é sempre o da página, sem salto
  const topoM = Math.min(info.max, 420); await rolarPara(topoM); const m1 = await apoioR(); await rolarPara(topoM - 120); const m2 = await apoioR(); await rolarPara(topoM - 60); const m3 = await apoioR();
  ok(Math.abs(m2.t - m1.t - 120) <= 1 && Math.abs(m3.t - m2.t + 60) <= 1, `trocas de direção seguidas (sobe 120, desce 60) não dão salto (${Math.round(m2.t - m1.t)} e ${Math.round(m3.t - m2.t)} px)`);
  await rolarPara(info.max); const fim = await apoioR(), iniB = await pg.$eval('.ini', (e) => e.getBoundingClientRect().bottom);
  ok(fim.b <= info.ch + 1 && fim.b <= iniB + 1, `no fim da página a coluna para na borda do conteúdo e continua toda alcançável (fundo em ${Math.round(fim.b)} de ${info.ch})`);
  // janela menor: ainda dá para chegar ao fim da coluna; janela alta: ela cabe e fica fixa sob o cabeçalho
  await pg.setViewportSize({ width: 1680, height: 700 }); await esperar(400);
  const i7 = await medidas(); await rolarPara(i7.max); const f7 = await apoioR();
  ok(f7.b <= 700 + 1 && f7.t >= -2000, `redimensionar para uma janela mais baixa: no fim da página o fundo da coluna aparece (${Math.round(f7.b)} de 700)`);
  await rolarPara(0);
  await pg.setViewportSize({ width: 1680, height: 1500 }); await esperar(500);
  const i15 = await medidas(); const a15 = await apoioR();
  if (i15.max > 60 && a15.h <= 1500 - 84 - 16) { await rolarPara(Math.min(i15.max, 160)); const d15 = await apoioR(); ok(Math.abs(d15.t - 84) <= 1, `janela alta: a coluna cabe, fica fixa sob o cabeçalho (${Math.round(d15.t)} px) enquanto a página rola`); }
  else ok(a15.h <= 1500 - 84 - 16, `janela alta: a coluna cabe inteira (${Math.round(a15.h)} px) e não precisa acompanhar a rolagem (página sem o que rolar)`);
  await rolarPara(0); await pg.setViewportSize({ width: 1680, height: 980 }); await esperar(500);

  // --- cidade do Clima: a janela não fica presa na coluna nem no widget
  await pg.click('.wg-cid-b');
  const jan = await pg.waitForSelector('.modal-ov', { timeout: 6000 }).then((e) => e, () => null);
  const dentro = jan ? await jan.evaluate((e) => !!e.closest('.ini-apoio, .wg')) : null;
  const caixa = jan ? await jan.evaluate((e) => { const r = e.querySelector('.modal')?.getBoundingClientRect(); return r ? { x: r.x, r: r.right, y: r.y, b: r.bottom } : null; }) : null;
  ok(jan && dentro === false && caixa && caixa.x >= 0 && caixa.r <= 1680 && caixa.y >= 0 && caixa.b <= 980, 'a janela de trocar a cidade abre fora do widget e da coluna, inteira na tela');
  await pg.keyboard.press('Escape'); await esperar(400);

  // --- mini calendário (decisões 64 e 65): cartão compacto, seis semanas, atalhos no rodapé, lista só depois de seleção explícita, uma cor só por dia e cartão flutuante
  await pg.setViewportSize({ width: 1680, height: 1500 }); await esperar(500);
  const mc = await pg.$eval('[data-mini-calendario]', (e) => ({ mes: e.querySelector('.mc-mes').textContent.trim(), cab: [...e.querySelectorAll('.mc-cabsem')].map((x) => x.textContent.trim()).join(), setas: e.querySelectorAll('.mc-seta').length, sel: e.querySelector('.mc-dia[data-sel]')?.dataset.data ?? null, hoje: e.querySelector('.mc-dia[data-hoje]')?.dataset.data, lista: !!e.querySelector('.mc-dia-lista'), estado: e.dataset.lista, linhas: e.querySelectorAll('.mc-grade [role="row"]').length, celulas: e.querySelectorAll('.mc-dia').length, leg: [...e.querySelectorAll('.mc-leg li')].map((x) => x.textContent.trim()).join(), atalhos: [...e.querySelectorAll('.mc-rodape button')].map((x) => x.textContent.trim()).join('|') }));
  ok(/^[A-Z]\w+ de \d{4}$/.test(mc.mes) && mc.cab === 'Seg,Ter,Qua,Qui,Sex,Sáb,Dom' && mc.setas === 2 && mc.hoje === HOJE, `mês em português (${mc.mes}), semana de segunda a domingo, setas no cabeçalho e o dia atual destacado`);
  ok(!mc.lista && mc.estado === 'recolhida' && mc.sel === null && !(await pg.$('.mc-item')) && !(await pg.$('[data-mc-cartao]')), 'ao abrir, a lista do dia está recolhida, não há seleção e nenhum cartão flutuante');
  const tam = await pg.$$eval('.mc-dia', (l) => l.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; }));
  ok(mc.linhas === 7 && mc.celulas === 42 && tam.every(([w, h]) => Math.abs(w - tam[0][0]) <= 0.6 && Math.abs(h - tam[0][1]) <= 0.6), `grade de seis semanas (42 células) com células uniformes (${tam[0][0]} x ${tam[0][1]} px)`);
  ok(mc.leg === 'Compromisso,Feriado,Pagamento,Evento,Reunião,Prazo', 'legenda com as seis categorias');
  const rod = await pg.$eval('.mc-rodape', (e) => { const g = document.querySelector('.mc-grade').getBoundingClientRect(), r = e.getBoundingClientRect(); return { y: r.y, gb: g.bottom, borda: getComputedStyle(e).borderTopWidth }; });
  ok(mc.atalhos === 'Hoje|Amanhã|Em 3 dias|Em 1 semana|Em 2 semanas' && rod.y >= rod.gb && parseFloat(rod.borda) > 0, 'rodapé separado com os atalhos Hoje, Amanhã, Em 3 dias, Em 1 semana e Em 2 semanas');
  const maisUm = (n) => somarDias(HOJE, n);
  await pg.click('.mc-rodape button:has-text("Amanhã")');
  ok((await pg.$eval('.mc-dia[data-sel]', (e) => e.dataset.data)) === maisUm(1) && !!(await pg.$('.mc-dia-lista')) && (await pg.$eval('.mc-dl-cab h4', (e) => e.textContent)).length > 10, 'o atalho Amanhã seleciona o dia e só então abre a lista do dia');
  await pg.click('.mc-seta >> nth=1'); await pg.click('.mc-seta >> nth=1'); await pg.click('.mc-seta >> nth=1');
  const mesLonge = await pg.$eval('.mc-mes', (e) => e.textContent);
  await pg.click('.mc-rodape button:has-text("Em 1 semana")');
  ok((await pg.$eval('.mc-dia[data-sel]', (e) => e.dataset.data)) === maisUm(7) && (await pg.$eval('.mc-mes', (e) => e.textContent)) !== mesLonge && !!(await pg.$('.mc-dia[data-sel]:not([data-fora])')), 'os atalhos também voltam o mês mostrado quando a data escolhida está em outro mês');
  await pg.click('.mc-rodape button:has-text("Em 3 dias")');
  ok((await pg.$eval('.mc-dia[data-sel]', (e) => e.dataset.data)) === maisUm(3), 'Em 3 dias seleciona hoje mais 3');
  await pg.click('.mc-rodape button:has-text("Em 2 semanas")');
  ok((await pg.$eval('.mc-dia[data-sel]', (e) => e.dataset.data)) === maisUm(14), 'Em 2 semanas seleciona hoje mais 14');
  await pg.click('.mc-rodape button:has-text("Hoje")');
  ok((await pg.$eval('.mc-dia[data-sel]', (e) => e.dataset.data)) === HOJE && (await pg.$eval('.mc-dia[data-hoje]', (e) => e.hasAttribute('data-sel'))), 'o atalho Hoje seleciona o dia atual');
  await pg.click('.mc-recolher');
  ok(!(await pg.$('.mc-dia-lista')) && !(await pg.$('.mc-dia[data-sel]')), 'recolher a lista tira a seleção e a lista de cena');
  const cheio = (await pg.$$eval('.mc-dia[data-n]', (l) => l.filter((e) => Number(e.dataset.n) >= 5).map((e) => e.dataset.data)))[0] ?? null;
  const alvoCheio = cheio ?? await (async () => { await pg.click('.mc-seta >> nth=1'); return pg.$$eval('.mc-dia[data-n]', (l) => l.filter((e) => Number(e.dataset.n) >= 5).map((e) => e.dataset.data)[0]); })();
  const cel = await pg.$eval(`.mc-dia[data-data="${alvoCheio}"]`, (e) => ({ cats: e.dataset.cats, estilo: e.getAttribute('style') ?? '', nome: e.getAttribute('aria-label'), img: getComputedStyle(e).backgroundImage }));
  ok(cel.cats === 'compromisso pagamento evento reuniao prazo' && /color-mix\(in oklab/.test(cel.estilo) && !/linear-gradient/.test(cel.estilo) && cel.img === 'none', `um dia com cinco categorias tem uma cor só, a mistura delas (${cel.cats}), sem faixas`);
  ok(/Compromisso: 1 item/.test(cel.nome) && /Pagamento: 1 item/.test(cel.nome) && /Reunião: 1 item/.test(cel.nome) && /Evento: 1 item/.test(cel.nome) && /Prazo: \d+ iten/.test(cel.nome), `o nome acessível do dia lista as categorias (${cel.nome.slice(0, 120)}...)`);
  // mistura em partes iguais, independente da ordem: confere o fundo de cada célula com a média no espaço oklab das cores das categorias presentes
  const cores = await pg.evaluate(() => {
    const app = document.querySelector('.app'), cs = getComputedStyle(app), cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const nomes = ['compromisso', 'feriado', 'pagamento', 'evento', 'reuniao', 'prazo'], tokens = Object.fromEntries(nomes.map((c) => [c, rgb(cs.getPropertyValue(`--cal-${c}`).trim())])), brutos = Object.fromEntries(nomes.map((c) => [c, cs.getPropertyValue(`--cal-${c}`).trim()]));
    const celulas = [...document.querySelectorAll('.mc-dia[data-cats]')].map((e) => ({ data: e.dataset.data, cats: e.dataset.cats.split(' '), n: Number(e.dataset.n), cor: rgb(getComputedStyle(e).backgroundColor) }));
    const sonda = (expr) => { const d = document.createElement('div'); d.style.backgroundColor = expr; app.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
    return { tokens, brutos, celulas, ab: sonda('color-mix(in oklab, var(--cal-compromisso) 50%, var(--cal-prazo) 50%)'), ba: sonda('color-mix(in oklab, var(--cal-prazo) 50%, var(--cal-compromisso) 50%)') };
  });
  if (process.env.DEPURAR) console.log('brutos', JSON.stringify(cores.brutos));
  const dist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  const erradas = cores.celulas.filter((c) => dist(c.cor, mediaOklab(c.cats.map((k) => cores.brutos[k]))) > 3);
  ok(cores.celulas.length >= 8 && erradas.length === 0, `em ${cores.celulas.length} dias com marcações a cor da célula é a média, em partes iguais, das cores distintas das categorias do dia${erradas.length ? ` (divergem: ${erradas.map((e) => `${e.data} ${e.cats.join('+')} obtido ${e.cor} esperado ${mediaOklab(e.cats.map((k) => cores.brutos[k]))}`).join('; ')})` : ''}`);
  ok(cores.ab === cores.ba && cores.ab !== '', `a mistura não depende da ordem (${cores.ab})`);
  const dois = cores.celulas.find((c) => c.n === 2), um = cores.celulas.filter((c) => c.n === 1);
  ok(!dois || (dist(dois.cor, cores.tokens[dois.cats[0]]) > 8 && dist(dois.cor, cores.tokens[dois.cats[1]]) > 8), `duas categorias dão uma cor nova, diferente das duas (${dois?.data ?? 'nenhum dia com duas'})`);
  ok(um.length > 0 && um.every((c) => dist(c.cor, cores.tokens[c.cats[0]]) <= 1), `um dia com uma só categoria mantém a cor dela (${um.length} dias)`);
  // contraste do número do dia sobre a cor misturada: todas as 63 combinações de categorias
  const contrastes = await contrasteDasMisturas(pg);
  ok(contrastes.length === 63 && Math.min(...contrastes) >= 4.5, `modo claro: o texto tem contraste mínimo ${Math.min(...contrastes).toFixed(1)}:1 sobre as 63 misturas possíveis`);
  // abrir o dia: seleção explícita abre a lista, o item de Prazo abre a demanda e o + abre o evento com a data
  await pg.click(`.mc-dia[data-data="${alvoCheio}"]`);
  const sel = await pg.$$eval('.mc-item', (l) => l.map((e) => e.dataset.categoria));
  ok(['compromisso', 'pagamento', 'evento', 'reuniao', 'prazo'].every((c) => sel.includes(c)) && (await pg.$eval('.mc-dia[data-sel]', (e) => e.dataset.data)) === alvoCheio && !!(await pg.$('.mc-dia-lista')), 'clicar no dia seleciona, marca a seleção e abre a lista logo abaixo com os rótulos de cada categoria');
  // feriado e vencimento ajustado: o feriado tem a própria cor e o prazo da demanda cai no dia útil anterior
  const feriado = (await pg.$$eval('.mc-dia[data-cats*="feriado"]', (l) => l.map((e) => e.dataset.data)))[0];
  ok(!!feriado, 'o feriado cadastrado em Dias indisponíveis aparece com a cor de Feriado');
  if (feriado) {
    const antes = await pg.$eval(`.mc-dia[data-data="${somarDias(feriado, -1)}"], .mc-dia[data-data="${somarDias(feriado, -3)}"]`, (e) => e.dataset.cats).catch(() => '');
    const dpz = await pg.$$eval('.mc-dia[data-cats*="prazo"]', (l) => l.map((e) => e.dataset.data));
    ok(!dpz.includes(feriado) && dpz.some((d) => d < feriado && d >= somarDias(feriado, -3)) && /prazo/.test(antes), 'o vencimento que cairia no feriado aparece antecipado (Prazo no dia útil anterior, nunca no feriado)');
  }
  // abrir itens: o Prazo abre a demanda; o + abre o evento com a data selecionada
  await pg.click(`.mc-dia[data-data="${alvoCheio}"]`);
  await pg.click('.mc-item[data-categoria="prazo"] .mc-item-b');
  const abriuDemanda = await pg.waitForSelector('.modal-ov .modal', { timeout: 5000 }).then(() => true, () => false);
  ok(abriuDemanda, 'selecionar o item de Prazo abre a demanda');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 5000 }).catch(() => {}); await esperar(300);
  await pg.click('.mc-mais');
  await pg.waitForSelector('#ev-data', { timeout: 5000 });
  ok((await pg.$eval('#ev-data', (e) => e.value)) === alvoCheio, 'o botão + abre o cadastro da Agenda com a data selecionada');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 5000 }).catch(() => {}); await esperar(300);
  // setas e teclado
  const mesAntes = await pg.$eval('.mc-mes', (e) => e.textContent);
  await pg.click('.mc-seta >> nth=0');
  ok((await pg.$eval('.mc-mes', (e) => e.textContent)) !== mesAntes, 'as setas trocam o mês');
  // --- cartão flutuante (hover e foco): data, títulos, horários e tipos; não abre a lista; Esc, janela e permanência
  await pg.click('.mc-rodape button:has-text("Hoje")'); await pg.click('.mc-recolher'); await pg.mouse.move(5, 5); await esperar(300);
  const marcados = await pg.$$eval('.mc-dia[data-n]', (l) => l.map((e) => ({ data: e.dataset.data, n: Number(e.dataset.n) })));
  const diaCartao = (marcados.find((m) => m.n >= 5) ?? marcados.find((m) => m.n >= 2) ?? marcados[0]).data;
  await pg.hover(`.mc-dia[data-data="${diaCartao}"]`);
  const cartao = await pg.waitForSelector('[data-mc-cartao]', { timeout: 2500 }).then(() => pg.$eval('[data-mc-cartao]', (e) => { const r = e.getBoundingClientRect(); return { titulo: e.querySelector('h4').textContent, itens: [...e.querySelectorAll('li')].map((l) => ({ cat: l.dataset.categoria, rot: l.querySelector('.mc-rot').textContent, titulo: l.querySelector('b').textContent, detalhe: l.querySelector('small').textContent })), x: r.x, y: r.y, r: r.right, b: r.bottom, papel: e.getAttribute('role') }; }), () => null);
  ok(!!cartao && /\d{1,2} de \w+ de \d{4}/.test(cartao.titulo) && cartao.itens.length >= 2 && cartao.itens.every((i) => i.rot && i.titulo && i.detalhe) && cartao.papel === 'tooltip', `passar o mouse sobre um dia com marcações abre o cartão com a data (${cartao?.titulo}), ${cartao?.itens.length} itens com tipo, título e horário ou detalhe`);
  ok(!!cartao && cartao.x >= 0 && cartao.y >= 0 && cartao.r <= 1680 && cartao.b <= 1500, 'o cartão cabe na janela');
  ok(!(await pg.$('.mc-dia-lista')) && !(await pg.$('.mc-dia[data-sel]')), 'o hover não abre a lista inferior nem seleciona o dia');
  // o cartão continua aberto enquanto o ponteiro estiver sobre ele
  const cx2 = await pg.$eval('[data-mc-cartao]', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await pg.mouse.move(cx2[0], cx2[1], { steps: 6 }); await esperar(600);
  ok(!!(await pg.$('[data-mc-cartao]')), 'o cartão fica aberto enquanto o ponteiro está sobre ele (dá para ler e rolar)');
  await pg.keyboard.press('Escape'); await esperar(250);
  ok(!(await pg.$('[data-mc-cartao]')), 'Esc dispensa o cartão');
  await pg.mouse.move(5, 5); await esperar(300);
  await pg.hover(`.mc-dia[data-data="${diaCartao}"]`); await pg.waitForSelector('[data-mc-cartao]', { timeout: 2500 }); await pg.mouse.move(5, 5, { steps: 4 }); await esperar(600);
  ok(!(await pg.$('[data-mc-cartao]')), 'ao tirar o ponteiro do dia e do cartão, ele fecha');
  const semItens = await pg.$eval('.mc-dia:not([data-n])', (e) => e.dataset.data);
  await pg.hover(`.mc-dia[data-data="${semItens}"]`); await esperar(500);
  ok(!(await pg.$('[data-mc-cartao]')), 'um dia sem marcações não abre cartão');
  // todos os dias com marcações: o cartão cabe na janela (também numa janela baixa, onde o calendário fica perto da borda)
  const fora = [];
  for (const [alt, lista] of [[1500, marcados], [700, marcados.slice(-4)]]) {
    await pg.setViewportSize({ width: 1680, height: alt }); await esperar(400);
    for (const m of lista) {
      await pg.mouse.move(5, 5); await esperar(220); await pg.hover(`.mc-dia[data-data="${m.data}"]`);
      const r = await pg.waitForSelector('[data-mc-cartao]', { timeout: 2500 }).then(() => pg.$eval('[data-mc-cartao]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; }), () => null);
      if (!r || r.x < 0 || r.y < 0 || r.r > 1680 || r.b > alt) fora.push(`${m.data}@${alt}`);
    }
  }
  ok(fora.length === 0, `o cartão de cada um dos ${marcados.length} dias com marcações cabe na janela, inclusive numa janela de 700 px de altura${fora.length ? ` (fora: ${fora.join()})` : ''}`);
  await pg.mouse.move(5, 5); await pg.setViewportSize({ width: 1680, height: 1500 }); await esperar(400);
  // contraste do cartão (texto sobre o fundo tingido) no modo claro
  await pg.hover(`.mc-dia[data-data="${diaCartao}"]`); await pg.waitForSelector('[data-mc-cartao]');
  const contrasteCartao = () => pg.$eval('[data-mc-cartao]', (e) => {
    const app = document.querySelector('.app'), cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fundo = rgb(getComputedStyle(e).backgroundColor), res = [];
    for (const alvo of [e.querySelector('h4'), ...e.querySelectorAll('.mc-rot'), ...e.querySelectorAll('b'), ...e.querySelectorAll('small')]) { const t = rgb(getComputedStyle(alvo).color), op = parseFloat(getComputedStyle(alvo).opacity); const tt = t.map((v, i) => Math.round(v * op + fundo[i] * (1 - op))); const a = lum(fundo) + 0.05, b = lum(tt) + 0.05; res.push(Math.max(a, b) / Math.min(a, b)); }
    void app; return Math.min(...res);
  });
  const cc = await contrasteCartao();
  ok(cc >= 4.5, `modo claro: o texto do cartão flutuante tem contraste mínimo ${cc.toFixed(1)}:1`);
  await pg.mouse.move(5, 5); await esperar(400);
  // foco pelo teclado: setas movem o foco (sem selecionar), o cartão acompanha e Enter seleciona
  await pg.focus('.mc-dia[data-hoje]');
  let achou = false;
  for (let i = 0; i < 20 && !achou; i++) { await pg.keyboard.press('ArrowRight'); await esperar(120); achou = !!(await pg.$('[data-mc-cartao]')); }
  const descrito = achou ? await pg.$eval('.mc-dia:focus', (e) => e.getAttribute('aria-describedby')) : null;
  ok(achou && descrito === 'mc-cartao' && !(await pg.$('.mc-dia-lista')) && !(await pg.$('.mc-dia[data-sel]')), 'navegando pelo teclado, o dia com marcações em foco mostra o mesmo cartão (ligado ao dia por aria-describedby), sem abrir a lista nem selecionar');
  await pg.keyboard.press('Escape'); await esperar(250);
  ok(!(await pg.$('[data-mc-cartao]')) && !!(await pg.$('.mc-dia:focus')), 'Esc dispensa o cartão sem tirar o foco do dia');
  await pg.keyboard.press('Enter'); await esperar(200);
  ok(!!(await pg.$('.mc-dia-lista')) && !!(await pg.$('.mc-dia[data-sel]')), 'Enter no dia em foco seleciona e só então abre a lista');
  const foco0 = await pg.$eval('.mc-dia:focus', (e) => e.dataset.data);
  await pg.keyboard.press('PageDown'); await esperar(200);
  ok((await pg.$eval('.mc-dia:focus', (e) => e.dataset.data)) !== foco0 && !!(await pg.$eval('.mc-dia-lista', (e) => e.dataset.data)), 'PageDown leva o foco ao mês seguinte e a seleção continua a mesma');
  await pg.click('.mc-rodape button:has-text("Hoje")'); await pg.click('.mc-recolher'); await pg.mouse.move(5, 5);
  // a lista que abre e fecha muda a altura da coluna, mas não faz a coluna dar salto (janela de 980 px, página rolada)
  await pg.setViewportSize({ width: 1680, height: 980 }); await esperar(500);
  await rolarPara(260); await esperar(100);
  const dbgL = () => pg.evaluate(() => ({ st: document.querySelector('.main').scrollTop, top: document.querySelector('.ini-apoio').style.top, sh: document.querySelector('.main').scrollHeight }));
  const { st: stAntes, top: topAntes } = await dbgL();
  const antesL = await apoioR(); if (process.env.DEPURAR) console.log('antesL', JSON.stringify(antesL), JSON.stringify(await dbgL()));
  await pg.$eval(`.mc-dia[data-data="${alvoCheio}"]`, (e) => e.click()); await esperar(500);
  const depoisL = await apoioR(), mxL = await medidas(); if (process.env.DEPURAR) console.log('depoisL', JSON.stringify(depoisL), JSON.stringify(await dbgL()));
  const dA = await dbgL();
  ok(depoisL.h > antesL.h + 80 && dA.st === stAntes && dA.top === topAntes && Math.abs(depoisL.b - depoisL.ib) <= 1, `abrir a lista do dia aumenta a coluna (${Math.round(antesL.h)} para ${Math.round(depoisL.h)} px), a página não se move sozinha (rolagem em ${Math.round(dA.st)} px), o ajuste da coluna não muda (${dA.top}) e ela segue dentro do conteúdo`);
  await rolarPara(mxL.max); const fimL = await apoioR();
  ok(fimL.b <= mxL.ch + 1, `com a lista aberta o fim da coluna continua alcançável (fundo em ${Math.round(fimL.b)} de ${mxL.ch})`);
  await pg.$eval('.mc-recolher', (e) => e.click()); await esperar(500);
  const fecha = await apoioR();
  ok(fecha.b <= mxL.ch + 1 || fecha.h < depoisL.h, `fechar a lista diminui a coluna (${Math.round(depoisL.h)} para ${Math.round(fecha.h)} px) e ela continua no lugar certo`);
  await rolarPara(0);
  // tokens de cor distintos e com contraste, nos dois temas (a conversão de oklch para RGB é feita pelo navegador)
  const tokens = () => pg.evaluate(() => {
    const app = document.querySelector('.app'), cs = getComputedStyle(app), cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const texto = rgb(cs.getPropertyValue('--text').trim());
    return ['compromisso', 'feriado', 'pagamento', 'evento', 'reuniao', 'prazo'].map((c) => { const v = cs.getPropertyValue(`--cal-${c}`).trim(), x = rgb(v), a = lum(x) + 0.05, b = lum(texto) + 0.05; return { c, v, x: x.join(','), contraste: Math.max(a, b) / Math.min(a, b) }; });
  });
  const tk = await tokens();
  ok(new Set(tk.map((t) => t.x)).size === 6 && tk.every((t) => t.contraste >= 4.5), `modo claro: seis cores distintas, texto com contraste mínimo ${Math.min(...tk.map((t) => t.contraste)).toFixed(1)}:1`);
  await pg.screenshot({ path: `${CAPTURAS}/desktop-claro.png` });
  // reposição individual: concluir uma demanda de vaga libera só a vaga dela e a prioridade de fora ocupa a vaga, sem sobrar na Nova urgência
  const alvoConcluir = vagas[2].id;
  await pg.hover(`.ph .dcard[data-id="${alvoConcluir}"]`); await pg.click(`.ph .dcard[data-id="${alvoConcluir}"] .girar`);
  await pg.click(`.ph .dcard[data-id="${alvoConcluir}"] button[aria-label="Mover de etapa"]`);
  await pg.click('.mv-menu button:has-text("Finalizado")');
  await pg.waitForFunction((id) => !document.querySelector(`[data-painel="para-hoje"] .dcard[data-id="${id}"]`), alvoConcluir, { timeout: 10000 });
  await pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] .ph-cards > .vaga').length === 4, null, { timeout: 10000 }).catch(() => {});
  await esperar(800);
  const apos = await pg.$$eval('[data-painel="para-hoje"] .ph-cards > .vaga', (l) => l.map((e) => `${e.dataset.vaga}:${e.querySelector('.dcard').dataset.id}`));
  const urgApos = await pg.$$eval('[data-nova-urgencia] .dcard', (l) => l.map((e) => e.dataset.id));
  const posAntes = Object.fromEntries(vagas.map((v) => [v.pos, v.id]));
  ok(apos.length === 4 && apos.filter((x) => x.split(':')[1] !== posAntes[x.split(':')[0]]).length === 1 && apos.find((x) => x.startsWith('3:'))?.split(':')[1] !== alvoConcluir, `concluir uma demanda repõe só a vaga liberada (${apos.filter((x) => x.split(':')[1] === posAntes[x.split(':')[0]]).length} de 4 ficaram como estavam)`);
  const todos2 = await pg.$$eval('[data-painel="para-hoje"] .dcard', (l) => l.map((e) => e.dataset.id));
  ok(new Set(todos2).size === todos2.length && !urgApos.some((id) => apos.some((x) => x.endsWith(id))) && !todos2.includes(alvoConcluir), 'depois da reposição ninguém aparece duas vezes e a demanda concluída saiu');
  // persistência: recarregar mantém as vagas
  await pg.reload({ waitUntil: 'load' }); await pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] .ph-cards > .vaga').length === 4, null, { timeout: 60000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  const recarregado = await pg.$$eval('[data-painel="para-hoje"] .ph-cards > .vaga', (l) => l.map((e) => `${e.dataset.vaga}:${e.querySelector('.dcard').dataset.id}`));
  ok(recarregado.join() === apos.join(), 'depois de recarregar as quatro vagas continuam nas mesmas posições');
  await ctx.close();
}
// escuro
{
  const { ctx, pg } = await abrir('desktop', { tema: 'escuro' });
  const tk = await pg.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.app')), cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const texto = rgb(cs.getPropertyValue('--text').trim());
    return ['compromisso', 'feriado', 'pagamento', 'evento', 'reuniao', 'prazo'].map((c) => { const x = rgb(cs.getPropertyValue(`--cal-${c}`).trim()), a = lum(x) + 0.05, b = lum(texto) + 0.05; return { x: x.join(','), contraste: Math.max(a, b) / Math.min(a, b) }; });
  });
  ok(new Set(tk.map((t) => t.x)).size === 6 && tk.every((t) => t.contraste >= 4.5), `modo escuro: seis cores distintas, texto com contraste mínimo ${Math.min(...tk.map((t) => t.contraste)).toFixed(1)}:1`);
  await pg.click('.mc-dia[data-hoje]');
  const hojeCel = await pg.$eval('.mc-dia[data-hoje]', (e) => ({ sel: e.hasAttribute('data-sel'), anel: getComputedStyle(e.querySelector('.mc-num')).backgroundColor, caixa: getComputedStyle(e).boxShadow }));
  ok(hojeCel.sel && hojeCel.anel !== 'rgba(0, 0, 0, 0)' && hojeCel.caixa !== 'none', 'o dia atual (círculo de destaque) e a seleção (contorno) têm sinais próprios');
  const contrastesE = await contrasteDasMisturas(pg);
  ok(contrastesE.length === 63 && Math.min(...contrastesE) >= 4.5, `modo escuro: o texto tem contraste mínimo ${Math.min(...contrastesE).toFixed(1)}:1 sobre as 63 misturas possíveis`);
  await pg.click('.mc-recolher');
  const marcadosE = await pg.$$eval('.mc-dia[data-n]', (l) => l.map((e) => e.dataset.data));
  await pg.hover(`.mc-dia[data-data="${marcadosE[0]}"]`); await pg.waitForSelector('[data-mc-cartao]', { timeout: 3000 });
  const ccE = await pg.$eval('[data-mc-cartao]', (e) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fundo = rgb(getComputedStyle(e).backgroundColor), res = [];
    for (const alvo of [e.querySelector('h4'), ...e.querySelectorAll('.mc-rot'), ...e.querySelectorAll('b'), ...e.querySelectorAll('small')]) { const t = rgb(getComputedStyle(alvo).color), op = parseFloat(getComputedStyle(alvo).opacity); const tt = t.map((v, i) => Math.round(v * op + fundo[i] * (1 - op))); const a = lum(fundo) + 0.05, b = lum(tt) + 0.05; res.push(Math.max(a, b) / Math.min(a, b)); }
    return Math.min(...res);
  });
  ok(ccE >= 4.5, `modo escuro: o texto do cartão flutuante tem contraste mínimo ${ccE.toFixed(1)}:1`);
  await pg.mouse.move(5, 5); await esperar(300);
  await pg.screenshot({ path: `${CAPTURAS}/desktop-escuro.png` });
  await ctx.close();
}
if (process.env.INICIO_PARCIAL === 'desktop') { console.log(`parcial: ${total - falhas} de ${total}`); parar(); process.exit(falhas ? 1 : 0); }
// notebook: sem largura para duas colunas, o apoio vai para baixo das demandas
{
  const { ctx, pg } = await abrir('notebook', { clima: false });
  const principal = await R(pg, '.ini-principal'), apoio = await R(pg, '.ini-apoio');
  const cols = await pg.$eval('.ph-cards', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  const cart = await pg.$$eval('.ph-cards > .vaga', (l) => new Set(l.map((e) => Math.round(e.getBoundingClientRect().y))).size);
  ok(apoio.y >= principal.b - 2 && cols === 4 && cart === 1, `notebook: quatro vagas na mesma linha e os widgets abaixo das demandas (apoio em y=${Math.round(apoio.y)})`);
  ok((await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'notebook: sem rolagem horizontal');
  await pg.screenshot({ path: `${CAPTURAS}/notebook.png` });
  await ctx.close();
}
// iPad em pé: faixa com duas vagas visíveis por vez
{
  const { ctx, pg } = await abrir('ipad', { clima: false });
  const modo = await pg.$eval('[data-painel="para-hoje"]', (e) => e.dataset.modo);
  const faixa = await R(pg, '[data-faixa]');
  const visiveis = () => pg.$$eval('[data-faixa] > .vaga', (l, fx) => l.filter((e) => { const r = e.getBoundingClientRect(); return r.x >= fx.x - 2 && r.right <= fx.r + 2; }).map((e) => e.dataset.vaga), faixa);
  const v1 = await visiveis();
  const info = await pg.$eval('[data-faixa]', (e) => ({ sw: e.scrollWidth, cw: e.clientWidth, ov: getComputedStyle(e).overflowX, snap: getComputedStyle(e).scrollSnapType }));
  ok((await pg.$$eval('.ph-pilha, .ph-atras', (l) => l.length)) === 0, 'iPad em pé: sem baralho (a faixa horizontal com duas vagas segue como era)');
  ok(modo === 'duas' && v1.length === 2 && info.sw > info.cw + 50 && info.ov === 'auto' && /x/.test(info.snap), `iPad em pé: duas vagas visíveis por vez (${v1.join(' e ')}) e a faixa rola de lado`);
  const antesEtapas = await pg.$$eval('[data-faixa] .dcard .tags .chip.neutro', (l) => l.map((e) => e.textContent.trim()).join('|'));
  await pg.click('button[aria-label="Próximas vagas"]'); await esperar(900);
  const v2 = await visiveis();
  ok(v2.length === 2 && v2.every((v) => !v1.includes(v)) && [...v1, ...v2].sort().join() === '1,2,3,4', `rolar a faixa revela as outras duas vagas (${v2.join(' e ')}): as quatro vagas continuam existindo`);
  const depoisEtapas = await pg.$$eval('[data-faixa] .dcard .tags .chip.neutro', (l) => l.map((e) => e.textContent.trim()).join('|'));
  ok(antesEtapas === depoisEtapas && (await pg.$$eval('[data-faixa] > .vaga', (l) => l.map((e) => e.dataset.vaga).join())) === '1,2,3,4', 'rolar é só navegação: a ordem e as etapas não mudam');
  ok((await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'iPad em pé: a página não rola de lado (só a faixa)');
  await pg.screenshot({ path: `${CAPTURAS}/ipad.png` });
  await ctx.close();
}
// celular: pilha de um card, sem gestos ainda (só a medição)
{
  const { ctx, pg } = await abrir('celular', { clima: false, esperadas: 1 });
  const modo = await pg.$eval('[data-painel="para-hoje"]', (e) => e.dataset.modo);
  const visiveis = await pg.$$eval('[data-painel="para-hoje"] > .ph-pilha .vaga', (l) => l.filter((e) => e.offsetParent).length);
  ok(modo === 'pilha' && visiveis === 1, 'celular: pilha com um único card ativo');
  const botoes = await pg.$$eval('[data-painel="para-hoje"] > .ph-pilha .ph-botoes .btn', (l) => l.map((e) => e.getBoundingClientRect().height));
  ok(botoes.length === 2 && botoes.every((h) => h >= 30), 'celular: botões equivalentes aos dois gestos');
  ok((await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'celular: sem rolagem horizontal da página');
  const apoio = await R(pg, '.ini-apoio'), urg = await R(pg, '[data-nova-urgencia]');
  ok(apoio.y > urg.b - 2, 'celular: Humor, Clima e calendário ficam abaixo das demandas');
  // Nova urgência no celular: a mesma pilha, com a ordem só em memória; esquerda manda ao fim, direita volta ao anterior
  {
    const info = await pg.$eval('[data-nova-urgencia]', (e) => ({ pilhas: e.querySelectorAll('.ph-pilha').length, cards: e.querySelectorAll('.ph-pilha .dcard').length, pos: e.querySelector('.ph-posicao')?.textContent.trim(), fora: !!e.querySelector('.ph-pilha [data-fora-vaga]'), vagaAttr: e.querySelector('.ph-pilha .vaga')?.hasAttribute('data-vaga'), dir: e.querySelector('[data-pilha-avancar]')?.textContent.trim() }));
    ok(info.pilhas === 1 && info.cards === 1 && /^1 de [23]$/.test(info.pos) && info.fora && info.vagaAttr === false, `celular: a Nova urgência usa a mesma pilha (${info.pos}), com a prioridade fora das vagas à frente`);
    ok(info.dir === 'Voltar ao anterior', 'na Nova urgência o gesto da direita volta ao anterior (a etapa muda pelos controles do card)');
    const idNU = () => pg.$eval('[data-nova-urgencia] .ph-pilha .dcard', (e) => e.dataset.id);
    const primeiro = await idNU(), c = await R(pg, '[data-nova-urgencia] .ph-arrasto'), y = c.y + c.h * 0.45, x = c.x + c.w / 2;
    await pg.$eval('[data-nova-urgencia]', (e) => e.scrollIntoView({ block: 'center' })); await esperar(300);
    const c2 = await R(pg, '[data-nova-urgencia] .ph-arrasto'), y2 = c2.y + c2.h * 0.45;
    void y; void x;
    await deslizar(pg, c2.x + c2.w / 2 + 110, y2, c2.x + c2.w / 2 - 110, y2);
    const segundo = await idNU();
    ok(segundo !== primeiro && (await lsOrdem(pg)) === null, 'deslizar à esquerda na Nova urgência manda o card ao fim da ordem visual e não toca a ordem do Para hoje');
    await deslizar(pg, c2.x + c2.w / 2 - 110, y2, c2.x + c2.w / 2 + 110, y2);
    ok((await idNU()) === primeiro, 'deslizar à direita volta ao anterior (o card que foi para o fim)');
    ok((await pg.$$eval('[data-nova-urgencia] .dcard', (l) => l.length)) === 1 && (await pg.$$eval('[data-painel="para-hoje"] .dcard', (l) => new Set(l.map((e) => e.dataset.id)).size)) === (await pg.$$eval('[data-painel="para-hoje"] .dcard', (l) => l.length)), 'a demanda continua aparecendo uma única vez no Início');
  }
  // as demais listas de cards (Demandas, Cards): no celular, o mesmo baralho; a etapa muda pelos controles do card
  {
    await pg.goto(BASE + '/demandas', { waitUntil: 'load' });
    await pg.waitForSelector('.cartas', { timeout: 60000 }); await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
    await pg.waitForFunction(() => document.querySelector('.cartas[data-modo]') && document.querySelector('.cartas[data-modo="pilha"] .ph-pilha'), null, { timeout: 15000 }).catch(() => {});
    const d = await pg.$eval('.cartas', (e) => ({ modo: e.dataset.modo, cards: e.querySelectorAll('.dcard').length, pos: e.querySelector('.ph-posicao')?.textContent.trim(), grade: !!e.querySelector('.cards') }));
    ok(d.modo === 'pilha' && d.cards === 1 && /^1 de \d+$/.test(d.pos) && !d.grade, `celular: os cards de Demandas viram a mesma pilha (${d.pos})`);
    const total = Number(d.pos.split(' de ')[1]);
    const idD = () => pg.$eval('.cartas .dcard', (e) => e.dataset.id);
    const p1 = await idD(), cd = await R(pg, '.cartas .ph-arrasto'), yd = cd.y + cd.h * 0.45;
    await deslizar(pg, cd.x + cd.w / 2 + 110, yd, cd.x + cd.w / 2 - 110, yd);
    const p2 = await idD();
    await pg.$eval('.cartas .dcard', (e) => e.scrollIntoView({ block: 'center' })); await esperar(200);
    await deslizar(pg, cd.x + cd.w / 2 - 110, yd, cd.x + cd.w / 2 + 110, yd);
    ok(p2 !== p1 && (await idD()) === p1 && total >= 4, 'em Demandas (Cards) esquerda manda ao fim e direita volta ao anterior; nenhuma demanda se perde');
  }
  await pg.screenshot({ path: `${CAPTURAS}/celular.png` });
  await ctx.close();
}

// =============================================================================================
// 2) pilha do celular com gestos: banco próprio com as etapas que interessam
// =============================================================================================
parar();
const pastaPilha = `${RAIZ}/pilha`;
let ID = {};
{
  const db = await abrirBancoTeste({ pasta: pastaPilha });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const tarefas = async (id, textos, feitas = 0) => { for (let i = 0; i < textos.length; i++) { const r = await c('adicionar_tarefa', { p_demanda: id, p_texto: textos[i] }); if (i < feitas) await c('marcar_tarefa', { p_id: r.tarefas[i].id, p_concluida: true }); } };
  const mk = async (chave, assunto, o, textos, feitas = 0) => { const d = await c('criar_demanda', { p: { assunto, ...o } }); await tarefas(d.id, textos, feitas); ID[chave] = d.id; return d; };
  const A = await mk('A', 'Alfa em Cadastro', { prazo_original: HOJE }, ['a1', 'a2']); await c('mover_etapa', { p_id: A.id, p_etapa: 'Cadastro' });
  await mk('C', 'Charlie em Fazendo com pendências', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -2) }, ['c1', 'c2', 'c3'], 1);
  await mk('D', 'Delta em Fazendo sem pendências', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -3) }, ['d1'], 1);
  const E = await mk('E', 'Eco aguardando a Prefeita', { origem: 'Gabinete', etapa: 'Aguardando Prefeita', prazo_original: somarDias(HOJE, 20) }, ['e1']);
  await db.query(`update public.demandas set etapa_desde = (($1::date + time '12:00') at time zone 'America/Sao_Paulo') - interval '12 days' where id = $2`, [HOJE, E.id]);
  await mk('F', 'Foxtrot aguardando retorno do setor', { etapa: 'Aguardando retorno', setor: 'Obras', acompanhar_em: somarDias(HOJE, -1) }, ['f1']);
  await mk('B', 'Bravo em Vistos distante', { etapa: 'Vistos', prazo_original: somarDias(HOJE, 25) }, ['b1']);   // fora do alcance de 7 dias: nunca candidata
  for (const [i, k] of ['A', 'C', 'E', 'D'].entries()) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, ID[k]]);
  await db.close();
}
await subir(pastaPilha);
{
  let bloquear = false;
  const { ctx, pg } = await abrir('celular', { clima: false, esperadas: 1, antes: async (_pg, c2) => { await c2.route('**/*', (r) => (bloquear && r.request().method() === 'POST' && r.request().headers()['next-action'] ? r.abort() : r.continue())); } });
  await pg.waitForSelector('[data-pilha] .vaga[data-ativo]');
  let a = await ativo(pg);
  ok(a.assunto.startsWith('Eco') && a.vaga === '3', `a pilha começa pela prioridade que ocupa vaga (${a.assunto}, vaga ${a.vaga}): as prioritárias vêm antes das comuns`);
  ok((await pg.$eval(AVANCAR, (e) => e.textContent.trim())) === 'Escolher a etapa', 'em Aguardando Prefeita o botão de avançar diz que o usuário escolhe a etapa');
  ok((await pg.$eval('.ph-posicao', (e) => e.textContent.trim())) === '1 de 4', 'a pilha mostra "1 de 4"');
  // --- deslizar à esquerda: vai para o fim da ordem de apresentação; vaga, etapa e prioridade não mudam
  await deslizarAtivo(pg, -220);
  ok(await aguardarAtivo(pg, 'Alfa'), 'deslizar à esquerda manda o card para o fim e revela o próximo');
  let o = await lsOrdem(pg);
  ok(o && o.dia === HOJE && o.ids.length === 4 && o.ids.join() === [ID.A, ID.C, ID.D, ID.E].join(), `a ordem fica guardada só neste aparelho, com a data de hoje (${o?.ids?.length} ids)`);
  ok(await pg.$eval('.ph-posicao', (e) => e.textContent.trim()) === '1 de 4' && (await pg.$$eval('[data-painel="para-hoje"] > .ph-pilha .vaga', (l) => l.length)) === 1, 'continua um único card ativo na pilha');
  // reabrir (fechar e abrir o app): a ordem se mantém
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('[data-pilha] .vaga[data-ativo]'); await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  ok(await aguardarAtivo(pg, 'Alfa'), 'depois de recarregar a pilha mantém a ordem guardada (Alfa continua à frente)');
  // --- deslizes que não valem
  await deslizarAtivo(pg, -30);
  ok((await ativo(pg)).assunto.startsWith('Alfa') && (await lsOrdem(pg)).ids[0] === ID.A, 'um deslize curto volta ao lugar sem mudar nada');
  const c1 = await caixaAtiva(pg);
  await deslizar(pg, c1.x + c1.w / 2, c1.y + 60, c1.x + c1.w / 2 + 20, c1.y + 260);
  ok((await ativo(pg)).assunto.startsWith('Alfa') && (await lsOrdem(pg)).ids[0] === ID.A, 'um arrasto vertical é rolagem: não passa nem avança o card');
  const tarefaTxt = await R(pg, '[data-pilha] .vaga[data-ativo] .prox-t .t-txt');
  await deslizar(pg, tarefaTxt.x + 10, tarefaTxt.y + tarefaTxt.h / 2, tarefaTxt.x - 10, tarefaTxt.y + tarefaTxt.h / 2, 3);
  ok(!(await pg.$('.t-ed')) && !(await pg.$('.modal-ov')) && (await ativo(pg)).assunto.startsWith('Alfa'), 'um toque curto de lado sobre a tarefa não a abre para edição, não abre a demanda e não passa o card');
  await pg.touchscreen.tap(tarefaTxt.x + 20, tarefaTxt.y + tarefaTxt.h / 2); await esperar(300);
  ok(!!(await pg.$('.t-ed')), 'tocar na tarefa continua abrindo a edição no lugar');
  await pg.keyboard.press('Escape'); await esperar(200);
  const ass = await R(pg, '[data-pilha] .vaga[data-ativo] .assunto');
  await pg.touchscreen.tap(ass.x + 20, ass.y + ass.h / 2);
  ok(await pg.waitForSelector('.modal-ov .modal', { timeout: 4000 }).then(() => true, () => false), 'tocar no assunto continua abrindo a demanda');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 5000 }).catch(() => {}); await esperar(300);
  // --- baralho (decisão 65): o card acompanha o dedo, com inclinação; soltar um gesto curto e lento devolve o card ao lugar
  const trazer = async (alvo) => { for (let i = 0; i < 6 && !(await ativo(pg))?.assunto.startsWith(alvo); i++) { await pg.click(PASSAR); await esperar(500); } };
  const dcFix = () => pg.$eval('[data-pilha] .dcard', (e) => e.dataset.fix);
  {
    const atras = await pg.$$eval('[data-painel="para-hoje"] > .ph-pilha .ph-atras', (l) => l.map((e) => e.dataset.nivel).join());
    ok(atras === '1,2', `dois cards ficam logo atrás do da frente, como um baralho (níveis ${atras})`);
    const cdp = await pg.context().newCDPSession(pg);
    const c = await caixaAtiva(pg), x0 = c.x + c.w / 2, y0 = c.y + c.h * 0.45;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - i * 12, y: y0 }] }); await esperar(30); }
    await esperar(220);   // parou antes de soltar: sem impulso
    const durante = await pg.$eval('[data-pilha] .ph-arrasto', (e) => { const m = new DOMMatrix(getComputedStyle(e).transform); return { tx: Math.round(m.e), rot: Math.round((Math.atan2(m.b, m.a) * 1800) / Math.PI) / 10, arrastando: e.dataset.arrastando, nivel1: new DOMMatrix(getComputedStyle(document.querySelector('.ph-atras[data-nivel="1"]')).transform).a }; });
    ok(durante.arrastando === 'sim' && durante.tx <= -54 && durante.tx >= -66 && durante.rot <= -1.2 && durante.rot >= -14, `o card da frente acompanha o dedo em tempo real (${durante.tx} px) com leve inclinação (${durante.rot} graus)`);
    ok(durante.nivel1 > 0.95 && durante.nivel1 < 1, `o card de trás cresce junto com o gesto (escala ${durante.nivel1.toFixed(3)})`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    await esperar(700);
    const volta = await pg.$eval('[data-pilha] .ph-arrasto', (e) => ({ tx: new DOMMatrix(getComputedStyle(e).transform).e, saindo: !!e.closest('[data-saindo]'), trans: getComputedStyle(e).transitionDuration }));
    ok(Math.abs(volta.tx) < 1 && !volta.saindo && /0\.2/.test(volta.trans) && (await ativo(pg)).assunto.startsWith('Alfa') && (await lsOrdem(pg)).ids[0] === ID.A, 'soltar um gesto curto e lento devolve o card suavemente ao lugar (transição de 0,26 s) sem mudar a ordem');
    // cancelamento pelo navegador (pointercancel) devolve o card e não muda nada
    const cdp2 = await pg.context().newCDPSession(pg);
    await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 8; i++) await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * 20, y: y0 }] });
    await cdp2.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await cdp2.detach(); await esperar(600);
    ok((await ativo(pg)).assunto.startsWith('Alfa') && Math.abs(await pg.$eval('[data-pilha] .ph-arrasto', (e) => new DOMMatrix(getComputedStyle(e).transform).e)) < 1 && (await lsOrdem(pg)).ids[0] === ID.A, 'o cancelamento do gesto pelo navegador devolve o card e não passa nem avança nada');
  }
  // --- virar o card: toque numa área livre mostra o verso existente; novo toque volta à frente; tarefa, link e botão fazem só a própria ação
  {
    const cab = await R(pg, '[data-pilha] .face.front .cab');
    ok((await dcFix()) === undefined || (await dcFix()) === 'frente', 'o card começa de frente');
    await pg.touchscreen.tap(cab.x + 12, cab.y + cab.h / 2); await esperar(500);
    ok((await dcFix()) === 'verso' && !!(await pg.$('[data-pilha] .face.back .tarefas, [data-pilha] .face.back .proxima')), 'tocar numa área livre do card vira para o verso (tarefas e dados que já existem)');
    const meta = await R(pg, '[data-pilha] .face.back .meta');
    await pg.touchscreen.tap(meta.x + 8, meta.y + 8); await esperar(500);
    ok((await dcFix()) === 'frente', 'novo toque numa área livre volta à frente');
    // botão do card: só a ação dele
    const gir = await R(pg, '[data-pilha] .face.front .girar');
    await pg.touchscreen.tap(gir.x + gir.w / 2, gir.y + gir.h / 2); await esperar(500);
    ok((await dcFix()) === 'verso', 'o botão de girar do card vira uma vez só (o toque no botão não vira também pela área livre)');
    const gir2 = await R(pg, '[data-pilha] .face.back .girar');
    await pg.touchscreen.tap(gir2.x + gir2.w / 2, gir2.y + gir2.h / 2); await esperar(500);
    ok((await dcFix()) === 'frente', 'e o mesmo botão no verso volta à frente');
    // link (assunto): abre a demanda e não vira o card
    const ass2 = await R(pg, '[data-pilha] .vaga[data-ativo] .assunto');
    await pg.touchscreen.tap(ass2.x + 20, ass2.y + ass2.h / 2);
    const abriu = await pg.waitForSelector('.modal-ov .modal', { timeout: 4000 }).then(() => true, () => false);
    await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 5000 }).catch(() => {}); await esperar(400);
    ok(abriu && (await dcFix()) !== 'verso', 'tocar no assunto (link) só abre a demanda: o card não vira');
    // tarefa: abre a edição no lugar e não vira o card
    const tt = await R(pg, '[data-pilha] .vaga[data-ativo] .prox-t .t-txt');
    await pg.touchscreen.tap(tt.x + 20, tt.y + tt.h / 2); await esperar(400);
    ok(!!(await pg.$('.t-ed')) && (await dcFix()) !== 'verso', 'tocar na tarefa só abre a edição dela: o card não vira');
    await pg.keyboard.press('Escape'); await esperar(300);
    // depois de um arrasto o clique é engolido: não vira o card
    await deslizarAtivo(pg, -30);
    ok((await dcFix()) !== 'verso', 'um arrasto curto não conta como toque: o card não vira');
    // a ação clara para abrir a demanda
    await pg.click(ABRIR);
    ok(await pg.waitForSelector('.modal-ov .modal', { timeout: 4000 }).then(() => true, () => false), 'há um botão claro "Abrir a demanda" ao lado do card');
    await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 5000 }).catch(() => {}); await esperar(400);
  }
  // --- gesto rápido e curto vale (e mostra a saída animada e o card voltando para trás); toque acidental e arrasto lento de 50 px não
  {
    const c = await caixaAtiva(pg), x0 = c.x + c.w / 2, y0 = c.y + c.h * 0.45;
    await deslizar(pg, x0, y0, x0 + 4, y0, 2);
    ok((await ativo(pg)).assunto.startsWith('Alfa'), 'um toque acidental (4 px) não faz nada');
    const lento = await (async () => { const cdp = await pg.context().newCDPSession(pg); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - i * 10, y: y0 }] }); await esperar(110); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); await esperar(500); return (await ativo(pg)).assunto; })();
    ok(lento.startsWith('Alfa'), 'um arrasto lento de 50 px, sem chegar à distância mínima, volta ao lugar');
    const viuSaida = pg.waitForSelector('[data-pilha][data-saindo="esq"]', { state: 'attached', timeout: 1500 }).then(() => true, () => false);
    const viuVolta = pg.waitForSelector('.ph-atras[data-volta]', { state: 'attached', timeout: 1500 }).then(() => true, () => false);
    await deslizar(pg, x0 + 25, y0, x0 - 25, y0, 2);
    ok(await aguardarAtivo(pg, 'Charlie') || !(await ativo(pg)).assunto.startsWith('Alfa'), 'um gesto rápido, mesmo curto (50 px), manda o card ao fim e o próximo assume a frente');
    ok((await viuSaida) && (await viuVolta), 'o card sai pela esquerda e reaparece atrás da pilha (transição física, não uma troca seca)');
    ok((await lsOrdem(pg)).ids[3] === ID.A, 'a fila local guarda a nova ordem (Alfa foi para o fim)');
    await trazer('Alfa');
    ok((await ativo(pg)).assunto.startsWith('Alfa'), 'a fila volta a Alfa pelos botões (ordem local, nada gravado no banco)');
  }
  // --- deslizar à direita avança a etapa: Cadastro para Vistos
  await deslizarAtivo(pg, 220);
  ok(await aguardarAtivo(pg, 'Charlie'), 'deslizar à direita em Cadastro grava Vistos e avança a pilha para o próximo');
  o = await lsOrdem(pg);
  ok(o.ids[o.ids.length - 1] === ID.A, 'o card avançado vai para o fim da ordem (a vaga dele não mudou)');
  // a etapa gravada (veja o card quando voltar a ele): passar até Alfa e ler a etapa
  // --- falha de gravação: o card e a ordem ficam
  const antesOrdem = JSON.stringify((await lsOrdem(pg)).ids);
  bloquear = true;
  await deslizarAtivo(pg, 220);
  await esperar(1200);
  const aposFalha = await ativo(pg);
  ok(aposFalha.assunto.startsWith('Charlie') && aposFalha.etapa === 'Fazendo' && JSON.stringify((await lsOrdem(pg)).ids) === antesOrdem, 'se a gravação falha o card continua ativo, na mesma etapa e a ordem não muda');
  bloquear = false; await esperar(300);
  // --- Fazendo com tarefas pendentes: pede confirmação e informa quantas serão concluídas
  await deslizarAtivo(pg, 220);
  const conf = await pg.waitForSelector('[data-confirma-finalizar]', { timeout: 5000 }).then((e) => e.textContent(), () => null);
  ok(!!conf && /2 tarefas pendentes serão marcadas como concluídas/.test(conf), `com tarefas pendentes o gesto pede confirmação e diz quantas serão concluídas (${conf?.slice(0, 80)})`);
  await pg.click('[data-confirma-finalizar] button:has-text("Cancelar")'); await esperar(400);
  const cancelou = await ativo(pg);
  ok(!(await pg.$('[data-confirma-finalizar]')) && cancelou.assunto.startsWith('Charlie') && cancelou.etapa === 'Fazendo', 'cancelar a confirmação mantém o card, a etapa e a ordem');
  await pg.click(AVANCAR);
  await pg.waitForSelector('[data-confirma-finalizar]', { timeout: 4000 });
  await pg.click('[data-confirma-finalizar] button.pri');
  await pg.waitForFunction(() => !document.querySelector('[data-ativo-id]') || !document.querySelector('[data-pilha] .vaga[data-ativo] .assunto')?.textContent.startsWith('Charlie'), null, { timeout: 10000 });
  await esperar(1000);
  a = await ativo(pg);
  ok(!!a && !a.assunto.startsWith('Charlie'), `confirmar finaliza a demanda e ela sai da pilha (agora: ${a?.assunto})`);
  // --- Fazendo sem tarefas pendentes: finaliza direto, sem confirmar
  while (a && !a.assunto.startsWith('Delta')) { await pg.click(PASSAR); await esperar(400); a = await ativo(pg); }
  await pg.click(AVANCAR); await esperar(300);
  ok(!(await pg.$('[data-confirma-finalizar]')), 'sem tarefas pendentes a finalização é direta, sem pedir confirmação');
  await pg.waitForFunction(() => ![...document.querySelectorAll('[data-pilha] .assunto')].some((e) => e.textContent.startsWith('Delta')), null, { timeout: 10000 });
  // --- avançar duas vezes seguidas (clique duplo): uma única gravação, sem avançar duas etapas
  {
    a = await ativo(pg);
    while (a && !a.assunto.startsWith('Alfa')) { await pg.click(PASSAR); await esperar(500); a = await ativo(pg); }
    const antesEtapa = (await ativo(pg)).etapa;
    const gravacoes = [];
    const ouvir = (r) => { if (r.method() === 'POST' && r.headers()['next-action'] && /Fazendo|Finalizado|Vistos/.test(r.postData() ?? '')) gravacoes.push(r.postData()); };
    pg.on('request', ouvir);
    await pg.dblclick(AVANCAR); await esperar(1500);
    pg.off('request', ouvir);
    ok(antesEtapa === 'Vistos' && gravacoes.length === 1, `clique duplo em Avançar grava uma única vez (${gravacoes.length} gravação, de ${antesEtapa} para Fazendo)`);
  }
  // --- etapas de espera: o menu existente para escolher
  a = await ativo(pg);
  while (a && !a.assunto.startsWith('Eco')) { await pg.click(PASSAR); await esperar(400); a = await ativo(pg); }
  await deslizarAtivo(pg, 220);
  const menu = await pg.waitForSelector('.mv-menu', { timeout: 5000 }).then(() => true, () => false);
  ok(menu && (await pg.$$eval('.mv-menu button', (l) => l.length)) === 6, 'em Aguardando Prefeita o gesto para a direita abre o menu para escolher a etapa (sem avançar sozinho)');
  ok((await ativo(pg)).assunto.startsWith('Eco'), 'abrir o menu não passa o card');
  await pg.click('.mv-menu button:has-text("Fazendo")');
  await pg.waitForFunction(() => !document.querySelector('[data-pilha] .vaga[data-ativo] .assunto')?.textContent.startsWith('Eco'), null, { timeout: 10000 });
  ok(true, 'escolhida a etapa e confirmada a gravação, a pilha avança');
  // Aguardando retorno: o botão equivalente também abre o menu
  a = await ativo(pg);
  while (a && !a.assunto.startsWith('Foxtrot')) { await pg.click(PASSAR); await esperar(400); a = await ativo(pg); }
  ok(!!a && (await pg.$eval(AVANCAR, (e) => e.textContent.trim())) === 'Escolher a etapa', 'Aguardando retorno também oferece a escolha de etapa');
  await pg.click(AVANCAR);
  ok(await pg.waitForSelector('.mv-menu', { timeout: 4000 }).then(() => true, () => false), 'o botão equivalente abre o menu em Aguardando retorno');
  await pg.keyboard.press('Escape'); await esperar(300);
  // --- virada do dia: a ordem guardada de ontem não vale
  await pg.evaluate((d) => localStorage.setItem('dmanda:para-hoje-ordem', JSON.stringify({ dia: d, ids: [] })), somarDias(HOJE, -1));
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('[data-pilha] .vaga[data-ativo]'); await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  const ordemCanonica = await pg.$eval('.ph-posicao', (e) => e.textContent.trim());
  ok(/^1 de \d$/.test(ordemCanonica), 'uma ordem guardada de ontem é ignorada: a fila volta à ordem do painel');
  // armazenamento corrompido nunca derruba a tela
  await pg.evaluate(() => localStorage.setItem('dmanda:para-hoje-ordem', '{quebrado'));
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('[data-pilha] .vaga[data-ativo]'); await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  ok(!!(await ativo(pg)), 'armazenamento corrompido da ordem não quebra a pilha');
  await pg.screenshot({ path: `${CAPTURAS}/celular-pilha.png` });
  await ctx.close();
  // movimento reduzido
  const r = await abrir('celular', { clima: false, esperadas: 1, extra: { reducedMotion: 'reduce' } });
  const dur = await r.pg.$eval('.ph-arrasto', (e) => parseFloat(getComputedStyle(e).transitionDuration));
  ok(dur <= 0.011, `com movimento reduzido a pilha não anima (duração ${dur}s)`);
  {
    const antes = (await ativo(r.pg)).assunto, cr = await R(r.pg, '[data-pilha] .ph-arrasto'), yr = cr.y + cr.h * 0.45;
    const animou = r.pg.waitForSelector('[data-pilha][data-saindo]', { state: 'attached', timeout: 900 }).then(() => true, () => false);
    await deslizar(r.pg, cr.x + cr.w / 2 + 110, yr, cr.x + cr.w / 2 - 110, yr);
    const keyframes = await r.pg.$$eval('.ph-arrasto, .ph-atras', (l) => l.map((e) => getComputedStyle(e).animationName).filter((n) => n !== 'none').length);
    ok((await ativo(r.pg)).assunto !== antes && !(await animou) && keyframes === 0, 'com movimento reduzido o gesto troca o card na hora, sem saída animada nem animações de entrada');
  }
  await r.ctx.close();
}
parar();
// leitura direta do banco (o servidor já parou): as vagas, as etapas e a reposição individual
{
  const db = await abrirBancoTeste({ pasta: pastaPilha });
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const dem = await c('listar_demandas', { p_arquivadas: false });
  const por = (id) => dem.find((d) => d.id === id);
  const vagas = await c('listar_para_hoje', {});
  const nome = (id) => Object.entries(ID).find(([, v]) => v === id)?.[0];
  ok(por(ID.A)?.etapa === 'Fazendo', 'banco: o gesto à direita em Cadastro gravou Vistos e o clique duplo seguinte, uma única vez, Fazendo');
  ok(por(ID.C) === undefined || por(ID.C).etapa === 'Finalizado', 'banco: Charlie foi finalizado');
  const charlie = (await c('listar_demandas', { p_arquivadas: false })).find((d) => d.id === ID.C);
  ok(charlie?.etapa === 'Finalizado' && charlie.tarefas.every((t) => t.concluida), 'banco: as tarefas pendentes foram marcadas como concluídas ao finalizar com confirmação');
  ok(por(ID.D)?.etapa === 'Finalizado' && por(ID.E)?.etapa === 'Fazendo', 'banco: Delta finalizado direto e Eco movida para Fazendo pelo menu');
  const abertas = vagas.filter((v) => por(v.demanda_id) && por(v.demanda_id).etapa !== 'Finalizado');
  const mapa = Object.fromEntries(abertas.map((v) => [v.posicao, nome(v.demanda_id)]));
  ok(mapa[1] === 'A' && mapa[2] === 'F' && mapa[3] === 'E' && abertas.length === 3 && !Object.values(mapa).includes('B'), `banco: só a vaga liberada por Charlie (2) foi reposta, pela candidata elegível Foxtrot; as vagas 1 e 3 ficaram (${JSON.stringify(mapa)}) e a vaga 4, liberada por Delta, não tem outra candidata (Bravo vence só daqui a 25 dias)`);
  await db.close();
}
await nav.close();
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
