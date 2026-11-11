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

const PORTA = process.env.PORTA_TESTE_INICIO || '7121', BASE = `http://localhost:${PORTA}`, RAIZ = '.dados-teste/inicio', CAPTURAS = '.dados-teste/inicio-capturas-teste';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(RAIZ, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });
// o banco usa o relógio real (hoje em Brasília): perto da meia-noite o dia viraria no meio do teste
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
{
  const agora = new Date(), partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora).split(':').map(Number);
  if (24 * 60 - (partes[0] * 60 + partes[1]) < 40) throw new Error('Faltam menos de 40 minutos para a meia-noite em Brasília: rode o teste depois da virada do dia.');
}
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
  const ordemApoio = await pg.$$eval('.ini-apoio > *', (l) => l.map((e) => (e.matches('[data-quadro="humor"]') ? 'humor' : e.matches('.widgets') ? 'clima' : e.matches('[data-mini-calendario]') ? 'calendario' : '?')));
  ok(ordemApoio.join() === 'humor,clima,calendario', `Humor, Clima e mini calendário, nessa ordem (${ordemApoio.join()})`);
  const sem = await pg.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, comBarra: [...document.querySelectorAll('.ph .dcard')].filter((c) => c.scrollHeight > c.clientHeight + 1).length }));
  ok(sem.x <= 0 && sem.comBarra === 0, 'sem rolagem horizontal da página e sem barra de rolagem em card');
  const menu = await pg.$eval('.app', (e) => e.dataset.aberto);
  ok(menu === 'true' && (await R(pg, '.side')).w > 220 && (await pg.$$eval('.side .navi .tx', (l) => l.filter((e) => e.offsetParent && e.textContent.trim()).length)) >= 7, 'menu lateral aberto, com ícones e rótulos, quando não há escolha guardada');

  // --- coluna fixa: a área principal rola e o apoio fica sob o cabeçalho, com todos os widgets e a lista do dia alcançáveis
  const antes = await R(pg, '.ini-apoio');
  await pg.$eval('.main', (e) => { e.scrollTop = 150; }); await esperar(300);
  const depois = await R(pg, '.ini-apoio');
  ok(depois.y >= 60 && depois.y <= 110 && depois.y < antes.y, `a coluna de apoio fica fixa sob o cabeçalho enquanto a área principal rola (topo ${Math.round(antes.y)} para ${Math.round(depois.y)})`);
  const rolavel = await pg.$eval('.ini-apoio', (e) => ({ ov: getComputedStyle(e).overflowY, sh: e.scrollHeight, ch: e.clientHeight }));
  ok(rolavel.ov === 'auto' && depois.b <= 980 + 1, `a coluna não passa da janela (${Math.round(depois.b)} de 980)${rolavel.sh > rolavel.ch ? ' e rola por dentro' : ''}`);
  await pg.$eval('.ini-apoio', (e) => { e.scrollTop = e.scrollHeight; }); await esperar(200);
  const ult = await pg.$eval('.mc-dia-lista', (e) => { const r = e.getBoundingClientRect(); return { b: r.bottom, t: r.top }; });
  ok(ult.b <= 980 + 2 && ult.t >= 0, 'rolando a coluna até o fim a lista do dia fica toda visível');
  await pg.$eval('.main', (e) => { e.scrollTop = 0; });

  // --- cidade do Clima: a janela não fica presa na coluna nem no widget
  await pg.click('.wg-cid-b');
  const jan = await pg.waitForSelector('.modal-ov', { timeout: 6000 }).then((e) => e, () => null);
  const dentro = jan ? await jan.evaluate((e) => !!e.closest('.ini-apoio, .wg')) : null;
  const caixa = jan ? await jan.evaluate((e) => { const r = e.querySelector('.modal')?.getBoundingClientRect(); return r ? { x: r.x, r: r.right, y: r.y, b: r.bottom } : null; }) : null;
  ok(jan && dentro === false && caixa && caixa.x >= 0 && caixa.r <= 1680 && caixa.y >= 0 && caixa.b <= 980, 'a janela de trocar a cidade abre fora do widget e da coluna, inteira na tela');
  await pg.keyboard.press('Escape'); await esperar(400);

  // --- mini calendário
  const mc = await pg.$eval('[data-mini-calendario]', (e) => ({ mes: e.querySelector('.mc-mes').textContent.trim(), cab: [...e.querySelectorAll('.mc-cabsem')].map((x) => x.textContent.trim()).join(), setas: e.querySelectorAll('.mc-seta').length, sel: e.querySelector('.mc-dia[data-sel]')?.dataset.data, hoje: e.querySelector('.mc-dia[data-hoje]')?.dataset.data, leg: [...e.querySelectorAll('.mc-leg li')].map((x) => x.textContent.trim()).join() }));
  ok(/^[A-Z]\w+ de \d{4}$/.test(mc.mes) && mc.cab === 'Seg,Ter,Qua,Qui,Sex,Sáb,Dom' && mc.setas === 2 && mc.sel === HOJE && mc.hoje === HOJE, `mês em português (${mc.mes}), semana de segunda a domingo, setas e seleção inicial em hoje`);
  ok(mc.leg === 'Compromisso,Feriado,Pagamento,Evento,Reunião,Prazo', 'legenda com as seis categorias');
  const lista = await pg.$$eval('.mc-item', (l) => l.map((e) => `${e.dataset.categoria}|${e.querySelector('.mc-rot').textContent}|${e.querySelector('b').textContent}`));
  ok(lista.some((x) => x.startsWith('compromisso|Compromisso|')) && lista.some((x) => x.startsWith('reuniao|Reunião|')), `a lista do dia logo abaixo traz os itens de hoje com rótulos (${lista.length} itens)`);
  const colunas = await pg.$$eval('.mc-linha', (l) => l[1] ? [...l[1].children].map((e) => e.querySelector('.mc-dia').dataset.data) : []);
  ok(colunas.length === 7 && (() => { const d = new Date(`${colunas[0]}T00:00:00Z`).getUTCDay(), f = new Date(`${colunas[6]}T00:00:00Z`).getUTCDay(); return d === 1 && f === 0; })(), 'cada semana da grade vai de segunda a domingo');
  const irPara = async (alvo) => { for (let i = 0; i < 3 && !(await pg.$(`.mc-dia[data-data="${alvo}"]`)); i++) await pg.click('.mc-seta >> nth=1'); };
  const cheio = (await pg.$$eval('.mc-dia[data-n]', (l) => l.filter((e) => Number(e.dataset.n) >= 5).map((e) => e.dataset.data)))[0] ?? null;
  const alvoCheio = cheio ?? await (async () => { await pg.click('.mc-seta >> nth=1'); return pg.$$eval('.mc-dia[data-n]', (l) => l.filter((e) => Number(e.dataset.n) >= 5).map((e) => e.dataset.data)[0]); })();
  void irPara;
  const cel = await pg.$eval(`.mc-dia[data-data="${alvoCheio}"]`, (e) => ({ cats: e.dataset.cats, bg: e.style.backgroundImage, nome: e.getAttribute('aria-label') }));
  ok(cel.cats === 'compromisso pagamento evento reuniao prazo' && ['compromisso', 'pagamento', 'evento', 'reuniao', 'prazo'].every((c) => cel.bg.includes(`var(--cal-${c})`)), `um dia com cinco categorias combina as cinco cores em faixas (${cel.cats})`);
  ok(/Compromisso: 1 item/.test(cel.nome) && /Pagamento: 1 item/.test(cel.nome) && /Reunião: 1 item/.test(cel.nome) && /Evento: 1 item/.test(cel.nome) && /Prazo: \d+ iten/.test(cel.nome), `o nome acessível do dia lista as categorias (${cel.nome.slice(0, 120)}...)`);
  await pg.click(`.mc-dia[data-data="${alvoCheio}"]`);
  const sel = await pg.$$eval('.mc-item', (l) => l.map((e) => e.dataset.categoria));
  ok(['compromisso', 'pagamento', 'evento', 'reuniao', 'prazo'].every((c) => sel.includes(c)) && (await pg.$eval('.mc-dia[data-sel]', (e) => e.dataset.data)) === alvoCheio, 'selecionar o dia troca a lista logo abaixo e marca a seleção');
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
  const hojeCel = await pg.$eval('.mc-dia[data-hoje]', (e) => ({ sel: e.hasAttribute('data-sel'), anel: getComputedStyle(e.querySelector('.mc-num')).backgroundColor, caixa: getComputedStyle(e).boxShadow }));
  ok(hojeCel.sel && hojeCel.anel !== 'rgba(0, 0, 0, 0)' && hojeCel.caixa !== 'none', 'o dia atual (círculo de destaque) e a seleção (contorno) têm sinais próprios');
  await pg.screenshot({ path: `${CAPTURAS}/desktop-escuro.png` });
  await ctx.close();
}
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
  const visiveis = await pg.$$eval('[data-painel="para-hoje"] .ph-pilha .vaga', (l) => l.filter((e) => e.offsetParent).length);
  ok(modo === 'pilha' && visiveis === 1, 'celular: pilha com um único card ativo');
  const botoes = await pg.$$eval('.ph-botoes .btn', (l) => l.map((e) => e.getBoundingClientRect().height));
  ok(botoes.length === 2 && botoes.every((h) => h >= 30), 'celular: botões equivalentes aos dois gestos');
  ok((await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'celular: sem rolagem horizontal da página');
  const apoio = await R(pg, '.ini-apoio'), urg = await R(pg, '[data-nova-urgencia]');
  ok(apoio.y > urg.b - 2, 'celular: Humor, Clima e calendário ficam abaixo das demandas');
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
  ok((await pg.$eval('[data-pilha-avancar]', (e) => e.textContent.trim())) === 'Escolher a etapa', 'em Aguardando Prefeita o botão de avançar diz que o usuário escolhe a etapa');
  ok((await pg.$eval('.ph-posicao', (e) => e.textContent.trim())) === '1 de 4', 'a pilha mostra "1 de 4"');
  // --- deslizar à esquerda: vai para o fim da ordem de apresentação; vaga, etapa e prioridade não mudam
  await deslizarAtivo(pg, -220);
  ok(await aguardarAtivo(pg, 'Alfa'), 'deslizar à esquerda manda o card para o fim e revela o próximo');
  let o = await lsOrdem(pg);
  ok(o && o.dia === HOJE && o.ids.length === 4 && o.ids.join() === [ID.A, ID.C, ID.D, ID.E].join(), `a ordem fica guardada só neste aparelho, com a data de hoje (${o?.ids?.length} ids)`);
  ok(await pg.$eval('.ph-posicao', (e) => e.textContent.trim()) === '1 de 4' && (await pg.$$eval('.ph-pilha .vaga', (l) => l.length)) === 1, 'continua um único card ativo na pilha');
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
  await pg.click('[data-pilha-avancar]');
  await pg.waitForSelector('[data-confirma-finalizar]', { timeout: 4000 });
  await pg.click('[data-confirma-finalizar] button.pri');
  await pg.waitForFunction(() => !document.querySelector('[data-ativo-id]') || !document.querySelector('[data-pilha] .vaga[data-ativo] .assunto')?.textContent.startsWith('Charlie'), null, { timeout: 10000 });
  await esperar(1000);
  a = await ativo(pg);
  ok(!!a && !a.assunto.startsWith('Charlie'), `confirmar finaliza a demanda e ela sai da pilha (agora: ${a?.assunto})`);
  // --- Fazendo sem tarefas pendentes: finaliza direto, sem confirmar
  while (a && !a.assunto.startsWith('Delta')) { await pg.click('[data-pilha-passar]'); await esperar(400); a = await ativo(pg); }
  await pg.click('[data-pilha-avancar]'); await esperar(300);
  ok(!(await pg.$('[data-confirma-finalizar]')), 'sem tarefas pendentes a finalização é direta, sem pedir confirmação');
  await pg.waitForFunction(() => ![...document.querySelectorAll('[data-pilha] .assunto')].some((e) => e.textContent.startsWith('Delta')), null, { timeout: 10000 });
  // --- etapas de espera: o menu existente para escolher
  a = await ativo(pg);
  while (a && !a.assunto.startsWith('Eco')) { await pg.click('[data-pilha-passar]'); await esperar(400); a = await ativo(pg); }
  await deslizarAtivo(pg, 220);
  const menu = await pg.waitForSelector('.mv-menu', { timeout: 5000 }).then(() => true, () => false);
  ok(menu && (await pg.$$eval('.mv-menu button', (l) => l.length)) === 6, 'em Aguardando Prefeita o gesto para a direita abre o menu para escolher a etapa (sem avançar sozinho)');
  ok((await ativo(pg)).assunto.startsWith('Eco'), 'abrir o menu não passa o card');
  await pg.click('.mv-menu button:has-text("Fazendo")');
  await pg.waitForFunction(() => !document.querySelector('[data-pilha] .vaga[data-ativo] .assunto')?.textContent.startsWith('Eco'), null, { timeout: 10000 });
  ok(true, 'escolhida a etapa e confirmada a gravação, a pilha avança');
  // Aguardando retorno: o botão equivalente também abre o menu
  a = await ativo(pg);
  while (a && !a.assunto.startsWith('Foxtrot')) { await pg.click('[data-pilha-passar]'); await esperar(400); a = await ativo(pg); }
  ok(!!a && (await pg.$eval('[data-pilha-avancar]', (e) => e.textContent.trim())) === 'Escolher a etapa', 'Aguardando retorno também oferece a escolha de etapa');
  await pg.click('[data-pilha-avancar]');
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
  ok(por(ID.A)?.etapa === 'Vistos', 'banco: o gesto à direita em Cadastro gravou Vistos');
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
