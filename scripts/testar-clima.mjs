// Clima do Início (Open-Meteo) no navegador (Edge) com o banco local de TESTE (PGlite) e as respostas do Open-Meteo trocadas por fixtures (scripts/clima-fixtures.mjs):
// nenhum pedido sai de verdade para a internet. Cobre: agora contra previsão do dia, troca de cidade (mouse, teclado e toque), busca com espera e uma só consulta, respostas fora de ordem
// (busca e previsão), cache e TTL, abas escondidas, indisponibilidade (429, 5xx, 4xx, payload inválido, sem conexão, limite de tempo) com recuperação, dado desatualizado sem trocar a cidade,
// cache de outra cidade nunca mostrado, armazenamento corrompido, privacidade dos pedidos, a cidade em Configurações (fonte única), computador, iPad e iPhone EMULADOS (não são aparelhos reais),
// claro e escuro, texto do aplicativo a 125% e movimento reduzido. O widget falhar nunca derruba o resto do Início. Sobe o próprio servidor na porta 7116. Nunca toca o Supabase real.
// Uso: node scripts/testar-clima.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';
import * as F from './clima-fixtures.mjs';

const PORTA = process.env.PORTA_TESTE_CLIMA || '7116', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/clima', CAPTURAS = '.dados-teste/clima-capturas';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });

// ---- semente fictícia: três demandas (atrasada, para hoje, daqui a 5 dias) para o Início ter os grupos de prazo e o Foco do dia ----
const USUARIO = '00000000-0000-4000-8000-000000000001';
let db = await abrirBancoTeste({ pasta: PASTA });
await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
const HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
await c('criar_demanda', { p: { assunto: 'Demanda atrasada fictícia', tipo: 'Ofício', numero: '1/2026', prazo_original: somarDias(HOJE, -3) } });
await c('criar_demanda', { p: { assunto: 'Demanda para hoje fictícia', tipo: 'Memorando', numero: '2/2026', prazo_original: HOJE } });
await c('criar_demanda', { p: { assunto: 'Demanda próxima fictícia', tipo: 'Processo', numero: '3/2026', prazo_original: somarDias(HOJE, 5) } });
await db.close();

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (cond, m) => { total++; console.log((cond ? 'ok     ' : 'FALHOU ') + m); if (!cond) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [], externasTodas = [];
const HORA8 = new Date(`${HOJE}T08:00:00-03:00`);
const CORS = { 'access-control-allow-origin': '*' };

// previsões por latitude (o aplicativo manda a latitude com 4 casas)
const POR_LAT = {
  '-29.6506': F.previsao({ temp: 16.9, codigo: 80, codigoDia: 81, max: 24.7, min: 15.3 }),
  '-9.7333': F.previsao({ temp: 31.2, codigo: 1, dia: 1, max: 33.4, min: 24.1, codigoDia: 2 }),
  '-7.4956': F.previsao({ temp: 28.0, codigo: 0, dia: 1, max: 30.0, min: 22.0, codigoDia: 0 }),
  '-30.0328': F.previsao({ temp: 22.4, codigo: 3, max: 25.0, min: 18.0, codigoDia: 3 }),
  '41.1496': F.previsao({ temp: 14.2, codigo: 61, dia: 1, max: 17.0, min: 11.0, codigoDia: 63 }),
};
const NOVA_TAQUARA = F.previsao({ temp: 19.6, codigo: 2, dia: 1, max: 26.0, min: 16.0, codigoDia: 2, hora: '2026-11-07T09:00' });
const GEO = {
  taquara: F.resultados(F.TAQUARA_RS, F.TAQUARA_AL, F.TAQUARA_PB),
  por: F.resultados(F.PORTO_ALEGRE), porto: F.resultados(F.PORTO_PT), zzzz: F.SEM_RESULTADO,
};

/** Instala as respostas do Open-Meteo num contexto. `modo` muda a previsão (ok, ok2, lento, 429, 503, 400, invalido, abort, pendurar); `geo` pode ser trocado por teste. */
function instalar(ctx) {
  const e = { reg: [], modo: 'ok', geoModo: 'ok', atrasoLento: 2500, lentaPor: new Set() };
  ctx.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, async (rota) => {
    const req = rota.request(), u = new URL(req.url());
    const item = { host: u.host, path: u.pathname, params: Object.fromEntries(u.searchParams), headers: req.headers(), url: req.url(), metodo: req.method(), t: Date.now() };
    e.reg.push(item);
    const dar = async (status, corpo) => { try { await rota.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }); } catch { /* a página já cancelou */ } };
    if (u.host.startsWith('api.')) {
      const lat = u.searchParams.get('latitude');
      if (e.modo === 'abort') return void rota.abort().catch(() => {});
      if (e.modo === 'pendurar') return;   // nunca responde: a página precisa desistir sozinha
      if (e.lentaPor.has(lat)) await new Promise((r) => setTimeout(r, e.atrasoLento));
      if (e.modo === '429') return dar(429, { error: true, reason: 'Too many requests' });
      if (e.modo === '503') return dar(503, { error: true });
      if (e.modo === '400') return dar(400, { error: true, reason: 'Parameter x' });
      if (e.modo === 'invalido') return dar(200, { latitude: 1, current: { temperature_2m: 'quente' } });
      if (e.modo === 'ok2' && lat === '-29.6506') return dar(200, NOVA_TAQUARA);
      return dar(200, POR_LAT[lat] ?? F.previsao());
    }
    const nome = (u.searchParams.get('name') ?? '').toLowerCase();
    if (e.geoModo === '429') return dar(429, { error: true });
    if (e.geoModo === '503') return dar(503, { error: true });
    if (nome === 'por') { await new Promise((r) => setTimeout(r, 2500)); return dar(200, GEO.por); }   // resposta lenta de uma consulta antiga
    if (nome.startsWith('taq')) return dar(200, GEO.taquara);
    if (nome === 'porto') return dar(200, GEO.porto);
    if (nome === 'porto alegre') return dar(200, F.resultados(F.PORTO_ALEGRE));
    return dar(200, nome.startsWith('zz') ? GEO.zzzz : F.resultados());
  });
  return e;
}
const previsoes = (e) => e.reg.filter((r) => r.host.startsWith('api.'));
const buscas = (e) => e.reg.filter((r) => r.host.startsWith('geocoding-api.'));

const novo = async (opcoes = {}, { tema = 'claro', instante = HORA8, texto125 = false, antes = null } = {}) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.addInitScript(([t, tx, pre]) => {
    try {
      if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t));
      if (tx && !localStorage.getItem('dmanda:aparencia')) localStorage.setItem('dmanda:aparencia', JSON.stringify({ textoPct: 125 }));
      if (pre && !sessionStorage.getItem('pre-feito')) { for (const [k, v] of Object.entries(pre)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); sessionStorage.setItem('pre-feito', '1'); }
    } catch { /* sem armazenamento */ }
  }, [tema, texto125, antes]);
  await ctx.clock.install({ time: instante });
  const e = instalar(ctx);
  const observar = (pg) => {
    pg.on('pageerror', (x) => erros.push('pageerror: ' + x.message.slice(0, 300)));
    pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
    pg.on('request', (r) => { const u = new URL(r.url()); if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && u.protocol.startsWith('http')) externasTodas.push({ host: u.hostname, metodo: r.method(), url: r.url(), temCorpo: !!r.postData() }); });
  };
  const pg = await ctx.newPage(); observar(pg);
  return { ctx, pg, e, observar };
};
const hidratada = (pg) => pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
const abrir = async (pg, rota = '/') => { await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 }); await hidratada(pg); await pg.waitForTimeout(500); };
const estadoW = (pg) => pg.getAttribute('section.wg-clima', 'data-clima').catch(() => null);
const esperarW = (pg, est, ms = 15000) => pg.waitForSelector(`section.wg-clima[data-clima="${est}"]`, { timeout: ms });
const texto = (pg, sel) => pg.textContent(sel).then((t) => (t ?? '').replace(/\s+/g, ' ').trim());
const cidadeNoW = (pg) => pg.evaluate(() => ({ nome: document.querySelector('.wg-cid-n')?.textContent, local: document.querySelector('.wg-cid-l')?.textContent, id: document.querySelector('section.wg-clima')?.getAttribute('data-cidade-id') }));
const abrirDialogo = async (pg) => { await pg.click('.wg-cid-b'); await pg.waitForSelector('.modal-ov #cid-busca'); };
const digitar = async (pg, t, atraso = 40) => { await pg.fill('#cid-busca', ''); await pg.type('#cid-busca', t, { delay: atraso }); };
const lum = (css) => { const x = (css.match(/[\d.]+/g) ?? []).map(Number); const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(x[0]) + 0.7152 * f(x[1]) + 0.0722 * f(x[2]); };
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const guardado = (pg, chave) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return 'corrompido'; } }, chave);

// ================= 1) computador claro: o widget, agora contra previsão do dia, atribuição e privacidade dos pedidos =================
{
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } });
  await abrir(pg); await esperarW(pg, 'ok');
  const w = await pg.evaluate(() => ({ nome: document.querySelector('.wg-cid-n')?.textContent, local: document.querySelector('.wg-cid-l')?.textContent, temp: document.querySelector('[data-clima-temp]')?.textContent, mm: document.querySelector('[data-clima-mm]')?.textContent?.replace(/\s+/g, ' '),
    ceu: document.querySelector('.wg-ceu')?.textContent, cond: document.querySelector('.wg-cl-cond')?.textContent, rotulos: [...document.querySelectorAll('.wg-cl-rot')].map((x) => x.textContent), hora: document.querySelector('.wg-cl-hora')?.textContent,
    cred: (() => { const a = document.querySelector('.wg-cl-cred'); return a ? { t: a.textContent, href: a.getAttribute('href'), rel: a.getAttribute('rel'), alvo: a.getAttribute('target') } : null; })(),
    sr: document.querySelector('section.wg-clima .sr-only')?.textContent, icone: !!document.querySelector('.wg-ceu svg.ic') }));
  ok(w.nome === 'Taquara' && w.local === 'Rio Grande do Sul, Brasil', 'clima: a cidade padrão é Taquara, com estado e país');
  ok(w.temp === '17°' && /Pancadas de chuva fracas/.test(w.ceu) && w.rotulos.join() === 'Agora,Previsão de hoje', 'clima: mostra a temperatura de agora e a condição de agora (current), em graus Celsius, em português');
  ok(w.mm === 'máx. 25° · mín. 15°' && w.cond === 'Pancadas de chuva moderadas', 'clima: a previsão do dia (daily) tem máxima, mínima e a própria condição, separada da de agora');
  ok(/Observado às 08:15 · consultado às 08:0\d/.test(w.hora), 'clima: mostra a hora da observação e a hora da consulta (timestamp da informação)');
  ok(w.cred && w.cred.t === 'Weather data by Open-Meteo.com' && w.cred.href === 'https://open-meteo.com/' && /noopener/.test(w.cred.rel) && w.cred.alvo === '_blank', 'clima: a atribuição exigida pelo Open-Meteo (CC BY 4.0) está ao lado dos dados, com link');
  ok(/Taquara: agora 17 graus, pancadas de chuva fracas\. Previsão de hoje: máxima de 25 graus e mínima de 15 graus\./.test(w.sr ?? '') && w.icone, 'clima: leitores de tela recebem agora e previsão do dia por extenso; o ícone é decorativo');
  const p1 = previsoes(e);
  ok(p1.length === 1 && buscas(e).length === 0, 'clima: abrir o Início faz uma consulta de previsão e nenhuma busca de cidade (nenhuma consulta por desenho da tela)');
  const q = p1[0].params;
  ok(p1[0].host === 'api.open-meteo.com' && p1[0].path === '/v1/forecast' && q.latitude === '-29.6506' && q.longitude === '-50.7806' && q.current === 'temperature_2m,weather_code,is_day' && q.daily === 'temperature_2m_max,temperature_2m_min,weather_code' && q.timezone === 'auto' && q.forecast_days === '1' && Object.keys(q).length === 6, 'clima: o pedido leva só a localização e as variáveis meteorológicas');
  ok(!('cookie' in p1[0].headers) && !('referer' in p1[0].headers) && !('authorization' in p1[0].headers) && p1[0].metodo === 'GET' && !/dmanda|user|email|humor|energia|token/i.test(p1[0].url), 'clima: o pedido não leva cookie, referência, autorização nem dado do Dmanda (humor, energia, conta)');
  // o resto do Início continua inteiro
  ok((await pg.$$('.stat')).length === 3 && (await pg.$$('.sec .cards .dcard, .sec .cards article')).length >= 1 && /Foco do dia/.test(await texto(pg, 'main')), 'Início: os grupos de prazo e o Foco do dia continuam ao lado do Clima');
  await pg.click('.stat >> nth=0'); await pg.waitForTimeout(300);
  ok((await pg.$$eval('.stat[aria-pressed="true"]', (l) => l.length)) === 1 && await estadoW(pg) === 'ok', 'Início: filtrar por prazo continua funcionando e não mexe no Clima');
  // cache: ir e voltar e recarregar dentro dos 15 minutos não consulta de novo
  await pg.goto(BASE + '/demandas', { waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await hidratada(pg);
  await abrir(pg); await esperarW(pg, 'ok');
  ok(previsoes(e).length === 1, 'clima: voltar ao Início ou recarregar dentro de 15 minutos usa o clima guardado, sem nova consulta');
  const cache = await guardado(pg, 'dmanda:clima');
  ok(cache && cache.cidade.id === 3446847 && cache.cidade.nome === 'Taquara' && typeof cache.buscadoEm === 'number' && cache.previsao.atual.temperatura === 16.9 && !JSON.stringify(cache).match(/humor|energia|email|token/i), 'clima: o clima guardado no aparelho leva a própria cidade e nenhum dado do Dmanda');
  // passam 16 minutos com a aba visível: uma consulta nova, sem repetir
  await pg.clock.runFor(16 * 60000); await pg.waitForTimeout(800);
  ok(previsoes(e).length === 2 && await estadoW(pg) === 'ok', 'clima: passados os 15 minutos, com a aba visível, o clima é renovado uma vez (sem repetição por polling)');
  await pg.clock.runFor(10 * 60000); await pg.waitForTimeout(500);
  ok(previsoes(e).length === 2, 'clima: 10 minutos depois da renovação não há consulta nova (o dado ainda está fresco)');
  await pg.clock.runFor(6 * 60000); await pg.waitForTimeout(800);
  ok(previsoes(e).length === 3, 'clima: a renovação segue a cada 15 minutos, não mais que isso');
  await pg.screenshot({ path: `${CAPTURAS}/01-computador-claro.png` });
  await ctx.close();
}

// ================= 2) trocar de cidade pelo mouse: busca com espera, desambiguação, persistência =================
{
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } });
  await abrir(pg); await esperarW(pg, 'ok');
  await abrirDialogo(pg);
  ok(/Cidade atual: Taquara, Rio Grande do Sul, Brasil/.test(await texto(pg, '.modal')) && await pg.evaluate(() => document.activeElement?.id) === 'cid-busca', 'cidade: a janela mostra a cidade atual e abre com o foco no campo de busca');
  await digitar(pg, 'a'); await pg.waitForTimeout(700);
  ok(buscas(e).length === 0 && /ao menos 2 letras/.test(await texto(pg, '#cid-estado')), 'cidade: com 1 letra não há consulta e o texto explica');
  await digitar(pg, 'Taquara', 50);
  await pg.waitForSelector('.cid-op', { timeout: 8000 });
  ok(buscas(e).length === 1 && buscas(e)[0].params.name === 'Taquara' && buscas(e)[0].params.count === '8' && buscas(e)[0].params.language === 'pt' && buscas(e)[0].host === 'geocoding-api.open-meteo.com', 'cidade: digitar rápido faz uma única consulta (espera da busca), com o nome, 8 resultados e português');
  const ops = await pg.$$eval('.cid-op', (l) => l.map((b) => b.textContent));
  ok(ops.length === 3 && /Taquara.*Rio Grande do Sul, Brasil/.test(ops[0]) && /Taquara.*Alagoas, Brasil/.test(ops[1]) && /Taquara.*Paraíba, Brasil/.test(ops[2]) && /3 cidades encontradas/.test(await texto(pg, '#cid-estado')), 'cidade: cidades de mesmo nome aparecem com estado e país para distinguir');
  ok((await pg.getAttribute('.cid-op >> nth=0', 'aria-current')) === 'true', 'cidade: a cidade atual vem marcada na lista');
  await pg.click('.cid-op >> nth=1');
  await esperarW(pg, 'ok'); await pg.waitForFunction(() => document.querySelector('[data-clima-temp]')?.textContent === '31°');
  const aw = await cidadeNoW(pg);
  ok(aw.nome === 'Taquara' && aw.local === 'Alagoas, Brasil' && aw.id === '3386635' && !(await pg.$('.modal-ov')), 'cidade: escolher uma cidade fecha a janela e o widget passa a mostrar a escolhida, com seu estado e país');
  const pf = await guardado(pg, 'dmanda:perfil');
  ok(pf.cidade.id === 3386635 && pf.balaoH === 3 && pf.cidade.estado === 'Alagoas', 'cidade: a escolha fica guardada na preferência do Perfil (a mesma do intervalo do balão), neste aparelho');
  const ult = previsoes(e).at(-1).params;
  ok(ult.latitude === '-9.7333' && ult.longitude === '-36.4667' && /Céu predominantemente|Predominantemente limpo/.test(await texto(pg, '.wg-ceu')) && (await texto(pg, '[data-clima-mm]')) === 'máx. 33° · mín. 24°', 'cidade: a previsão passa a ser a da cidade escolhida (coordenadas dela)');
  ok(/Clima de Taquara \(Alagoas, Brasil\)/.test(await texto(pg, '#toast')), 'cidade: a troca é confirmada num aviso');
  const antes = previsoes(e).length;
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await hidratada(pg); await esperarW(pg, 'ok');
  ok((await cidadeNoW(pg)).local === 'Alagoas, Brasil' && previsoes(e).length === antes, `cidade: depois de recarregar a cidade continua e o clima guardado dela é reaproveitado, sem consulta nova (antes ${antes}, depois ${previsoes(e).length}: ${previsoes(e).slice(antes).map((p) => p.params.latitude).join('/')})`);
  // sem resultado
  await abrirDialogo(pg); await digitar(pg, 'zzzz', 40); await pg.waitForFunction(() => /Nenhuma cidade encontrada/.test(document.querySelector('#cid-estado')?.textContent ?? ''), null, { timeout: 8000 });
  ok((await pg.$$('.cid-op')).length === 0, 'cidade: sem resultado a janela diz que nenhuma cidade foi encontrada');
  // erro de busca
  e.geoModo = '429'; await digitar(pg, 'Taquarinha', 40); await pg.waitForFunction(() => /pediu uma pausa/.test(document.querySelector('#cid-estado')?.textContent ?? ''), null, { timeout: 8000 });
  ok(!!(await pg.$('.modal-ov')) && (await cidadeNoW(pg)).local === 'Alagoas, Brasil', 'cidade: limite do serviço na busca (HTTP 429) é dito na janela, sem trocar a cidade nem fechar');
  e.geoModo = 'ok';
  await pg.click('.modal .btn:has-text("Voltar para Taquara")');
  await pg.waitForFunction(() => document.querySelector('.wg-cid-l')?.textContent === 'Rio Grande do Sul, Brasil'); await esperarW(pg, 'ok');
  ok((await pg.getAttribute('section.wg-clima', 'data-cidade-id')) === '3446847' && (await texto(pg, '[data-clima-temp]')) === '17°', 'cidade: "Voltar para Taquara" restaura a cidade padrão e o clima dela');
  await abrirDialogo(pg);
  ok(await pg.isDisabled('.modal .btn:has-text("Voltar para Taquara")'), 'cidade: o botão de voltar fica desativado quando a cidade já é a padrão');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'));
  await ctx.close();
}

// ================= 3) respostas fora de ordem: busca e previsão =================
{
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } });
  await abrir(pg); await esperarW(pg, 'ok');
  // busca: "Por" demora, "Porto" responde logo; a resposta antiga chega depois e não pode aparecer
  await abrirDialogo(pg);
  await pg.type('#cid-busca', 'Por', { delay: 30 }); await pg.waitForTimeout(600);   // a espera passa e a consulta lenta sai
  await pg.type('#cid-busca', 'to', { delay: 30 });
  await pg.waitForFunction(() => document.querySelector('.cid-op b')?.textContent === 'Porto', null, { timeout: 8000 });
  await pg.waitForTimeout(3200);   // a resposta antiga tem 2,5 s de atraso
  const lista = await pg.$$eval('.cid-op', (l) => l.map((b) => b.textContent));
  ok(buscas(e).some((b) => b.params.name === 'Por') && lista.length === 1 && /Porto.*Portugal/.test(lista[0]), 'corrida: a resposta atrasada da busca antiga ("Por") não substitui a da busca mais nova ("Porto")');
  // previsão: escolhe Paraíba (lenta) e, antes de chegar, Alagoas (rápida)
  e.lentaPor.add('-7.4956');
  await digitar(pg, 'Taquara', 30); await pg.waitForSelector('.cid-op >> nth=2');
  await pg.click('.cid-op >> nth=2');   // Paraíba, a previsão demora 2,5 s
  await pg.waitForTimeout(300);
  await abrirDialogo(pg); await digitar(pg, 'Taquara', 30); await pg.waitForSelector('.cid-op >> nth=1'); await pg.click('.cid-op >> nth=1');   // Alagoas, responde logo
  await pg.waitForFunction(() => document.querySelector('[data-clima-temp]')?.textContent === '31°', null, { timeout: 8000 });
  await pg.waitForTimeout(3200);
  const fim = await cidadeNoW(pg);
  const cc = await guardado(pg, 'dmanda:clima');
  ok(fim.local === 'Alagoas, Brasil' && (await texto(pg, '[data-clima-temp]')) === '31°' && cc.cidade.id === 3386635 && (await guardado(pg, 'dmanda:perfil')).cidade.id === 3386635, 'corrida: a previsão atrasada da cidade anterior chega depois e não sobrescreve a cidade escolhida por último (nem na tela nem no guardado)');
  ok(previsoes(e).some((p) => p.params.latitude === '-7.4956'), 'corrida: a consulta antiga realmente foi feita (o teste exercita a corrida)');
  await ctx.close();
}

// ================= 4) indisponibilidade: cada falha afeta só o widget, com recuperação =================
for (const [modo, esperado, rotulo] of [['429', /pediu uma pausa/, 'HTTP 429'], ['503', /fora do ar/, 'HTTP 5xx'], ['400', /não foi possível ler/, 'HTTP 4xx'], ['invalido', /não foi possível ler/, 'resposta inválida'], ['abort', /Sem conexão/, 'sem conexão'], ['pendurar', /demorou para responder/, 'limite de tempo']]) {
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } });
  e.modo = modo;
  await abrir(pg);
  if (modo === 'pendurar') { await esperarW(pg, 'carregando'); await pg.clock.runFor(9000); }
  await pg.waitForSelector('.wg-cl-falha', { timeout: 15000 });
  const t = await texto(pg, '.wg-cl-falha');
  ok(esperado.test(t) && await estadoW(pg) === 'sem-dados' && /Clima indisponível por enquanto/.test(await texto(pg, 'section.wg-clima')) && !/culp|erro seu/i.test(t), `falha (${rotulo}): o widget diz o que aconteceu em tom neutro e oferece "Tentar de novo"`);
  ok((await pg.$$('.stat')).length === 3 && /Foco do dia/.test(await texto(pg, 'main')) && !(await pg.$('.erro-carga')), `falha (${rotulo}): o resto do Início (grupos de prazo e Foco do dia) segue funcionando`);
  e.modo = 'ok'; await pg.click('.wg-cl-falha .btn');
  await esperarW(pg, 'ok', 15000);
  ok(!(await pg.$('.wg-cl-falha')) && (await texto(pg, '[data-clima-temp]')) === '17°', `falha (${rotulo}): "Tentar de novo" depois da recuperação mostra o clima e some a mensagem`);
  await ctx.close();
}
// sem conexão do navegador no momento da consulta e a conexão voltando: o evento "online" recarrega
{
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } });
  await abrir(pg); await esperarW(pg, 'ok');
  e.modo = '503'; await pg.clock.runFor(16 * 60000); await pg.waitForSelector('.wg-cl-falha', { timeout: 10000 });
  const tf = await texto(pg, 'section.wg-clima');
  ok(await estadoW(pg) === 'desatualizado' && /Desatualizado: última atualização às 08:0\d/.test(tf) && (await texto(pg, '[data-clima-temp]')) === '17°' && (await cidadeNoW(pg)).nome === 'Taquara', 'desatualizado: com falha depois de um clima guardado, o dado continua na tela marcado como desatualizado, com a hora da última atualização e a mesma cidade');
  const n = previsoes(e).length;
  await pg.clock.runFor(60000); await pg.waitForTimeout(300);
  ok(previsoes(e).length === n, 'desatualizado: depois de uma falha não há consulta automática repetida em sequência');
  e.modo = 'ok2'; await pg.evaluate(() => window.dispatchEvent(new Event('online'))); await esperarW(pg, 'ok');
  ok((await texto(pg, '[data-clima-temp]')) === '20°' && !(await pg.$('.wg-cl-falha')) && /Observado às 09:00/.test(await texto(pg, '.wg-cl-hora')), 'recuperação: quando a conexão volta o clima é atualizado sozinho e a marca de desatualizado some');
  // falha de novo e recuperação pelo botão
  e.modo = '429'; await pg.clock.runFor(16 * 60000); await pg.waitForSelector('.wg-cl-falha');
  ok(await estadoW(pg) === 'desatualizado' && /pediu uma pausa/.test(await texto(pg, '.wg-cl-falha')), 'desatualizado: o limite do serviço (429) também mantém o dado anterior marcado');
  e.modo = 'ok'; await pg.click('.wg-cl-falha .btn'); await esperarW(pg, 'ok');
  ok((await texto(pg, '[data-clima-temp]')) === '17°', 'recuperação: "Tentar de novo" atualiza o clima');
  await ctx.close();
}

// ================= 5) aba escondida não consulta; ao voltar, atualiza =================
{
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } });
  await abrir(pg); await esperarW(pg, 'ok');
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  const n = previsoes(e).length;
  await pg.clock.runFor(40 * 60000); await pg.waitForTimeout(400);
  ok(previsoes(e).length === n, 'aba escondida: 40 minutos com a aba escondida não geram nenhuma consulta');
  await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForTimeout(800);
  ok(previsoes(e).length === n + 1, 'aba escondida: ao voltar para a aba, com o clima velho, uma consulta só atualiza');
  await ctx.close();
}

// ================= 6) o clima guardado é sempre da cidade mostrada; armazenamento corrompido =================
{
  const velhoPA = { cidade: F.comoCidade(F.PORTO_ALEGRE), previsao: { atual: { temperatura: 22.4, codigo: 3, diurno: true, observadoEm: '2026-11-07T07:45' }, hoje: { data: '2026-11-07', max: 25, min: 18, codigo: 3 } }, buscadoEm: HORA8.getTime() - 5 * 60000 };
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } }, { antes: { 'dmanda:clima': velhoPA } });
  e.lentaPor.add('-29.6506');
  await abrir(pg);
  await esperarW(pg, 'carregando');
  const durante = await texto(pg, 'section.wg-clima');
  ok(/Consultando o clima/.test(durante) && !/22°|Porto Alegre|Nublado/.test(durante) && (await cidadeNoW(pg)).nome === 'Taquara', 'cache de outra cidade: enquanto consulta, o widget não mostra o clima guardado de outra cidade sob o nome de Taquara');
  await esperarW(pg, 'ok', 10000);
  ok((await texto(pg, '[data-clima-temp]')) === '17°' && (await guardado(pg, 'dmanda:clima')).cidade.id === 3446847, 'cache de outra cidade: depois da consulta mostra Taquara e o guardado passa a ser dela');
  await ctx.close();
}
{
  // cidade escolhida = Alagoas, guardado = Taquara RS, falha: nada de clima (nem o de Taquara RS) sob Alagoas
  const guardadoRS = { cidade: F.comoCidade(F.TAQUARA_RS), previsao: { atual: { temperatura: 16.9, codigo: 80, diurno: false, observadoEm: '2026-11-07T07:45' }, hoje: { data: '2026-11-07', max: 24.7, min: 15.3, codigo: 81 } }, buscadoEm: HORA8.getTime() - 3600000 };
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } }, { antes: { 'dmanda:clima': guardadoRS, 'dmanda:perfil': { balaoH: 3, cidade: F.comoCidade(F.TAQUARA_AL) } } });
  e.modo = '503';
  await abrir(pg); await pg.waitForSelector('.wg-cl-falha');
  ok((await cidadeNoW(pg)).local === 'Alagoas, Brasil' && await estadoW(pg) === 'sem-dados' && !/17°|Pancadas/.test(await texto(pg, 'section.wg-clima')), 'cache de outra cidade: com falha, o clima guardado de outra cidade não aparece (mostra indisponível, nunca o dado trocado)');
  await ctx.close();
}
{
  const { ctx, pg, e } = await novo({ viewport: { width: 1280, height: 800 } }, { antes: { 'dmanda:clima': '{"x":1', 'dmanda:perfil': { balaoH: 9, cidade: { id: 'x', nome: 42 } } } });
  await abrir(pg); await esperarW(pg, 'ok');
  ok((await cidadeNoW(pg)).nome === 'Taquara' && previsoes(e).length === 1, 'armazenamento corrompido (clima e preferência): volta a Taquara e consulta normalmente, sem erro na tela');
  await ctx.close();
}

// ================= 7) teclado: abrir, buscar, setas, escolher, Esc, foco =================
{
  const { ctx, pg } = await novo({ viewport: { width: 1280, height: 800 } });
  await abrir(pg); await esperarW(pg, 'ok');
  await pg.focus('.wg-cid-b'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal-ov #cid-busca');
  ok(await pg.evaluate(() => document.activeElement?.id) === 'cid-busca' && (await pg.getAttribute('.modal', 'role')) === 'dialog' && (await pg.getAttribute('.modal', 'aria-modal')) === 'true', 'teclado: Enter no nome da cidade abre a janela (diálogo) com o foco no campo');
  await pg.keyboard.type('Taquara', { delay: 40 }); await pg.waitForSelector('.cid-op');
  await pg.keyboard.press('ArrowDown');
  ok(await pg.evaluate(() => document.activeElement?.classList.contains('cid-op')) && await pg.evaluate(() => document.activeElement?.getAttribute('data-cidade-id')) === '3446847', 'teclado: seta para baixo vai do campo à primeira cidade');
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown');
  ok(await pg.evaluate(() => document.activeElement?.getAttribute('data-cidade-id')) === '3386637', 'teclado: as setas percorrem as cidades');
  await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp');
  ok(await pg.evaluate(() => document.activeElement?.id) === 'cid-busca', 'teclado: seta para cima na primeira cidade volta ao campo');
  for (let i = 0; i < 12; i++) await pg.keyboard.press('Tab');
  ok(await pg.evaluate(() => !!document.activeElement?.closest('.modal')), 'teclado: o Tab não sai da janela');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'));
  ok(await pg.evaluate(() => document.activeElement?.classList.contains('wg-cid-b')), 'teclado: Esc fecha a janela e o foco volta ao nome da cidade');
  await pg.keyboard.press('Enter'); await pg.waitForSelector('#cid-busca'); await pg.keyboard.type('Taquara', { delay: 40 }); await pg.waitForSelector('.cid-op');
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => document.querySelector('[data-clima-temp]')?.textContent === '31°', null, { timeout: 8000 });
  ok((await cidadeNoW(pg)).local === 'Alagoas, Brasil' && await pg.evaluate(() => document.activeElement?.classList.contains('wg-cid-b')), 'teclado: Enter escolhe a cidade, troca o clima e devolve o foco ao widget');
  await ctx.close();
}

// ================= 8) Configurações > Perfil: a mesma preferência (fonte única) =================
{
  const { ctx, pg } = await novo({ viewport: { width: 1280, height: 800 } });
  await abrir(pg, '/config');
  ok(/Taquara, Rio Grande do Sul, Brasil/.test(await texto(pg, '[data-cidade-cfg]')), 'configurações: o Perfil mostra a cidade do clima (a mesma do widget)');
  await pg.click('[data-trocar-cidade]'); await pg.waitForSelector('#cid-busca'); await digitar(pg, 'Porto', 40); await pg.waitForSelector('.cid-op');
  await pg.click('.cid-op >> nth=0');
  await pg.waitForFunction(() => /Porto, Portugal/.test(document.querySelector('[data-cidade-cfg]')?.textContent ?? ''));
  await abrir(pg, '/'); await esperarW(pg, 'ok');
  const w = await cidadeNoW(pg);
  ok(w.nome === 'Porto' && w.local === 'Porto, Portugal' && (await texto(pg, '[data-clima-temp]')) === '14°', 'configurações: trocar a cidade lá muda o widget do Início (uma só fonte de verdade)');
  ok((await guardado(pg, 'dmanda:perfil')).cidade.pais === 'Portugal', 'configurações: a preferência fica no mesmo registro do Perfil');
  await ctx.close();
}

// ================= 9) aparelhos EMULADOS, claro e escuro, texto a 125%, toque e movimento reduzido =================
const APARELHOS = [
  ['computador', { viewport: { width: 1280, height: 800 } }],
  ['ipad', { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
  ['iphone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }],
];
for (const [nomeA, opcoes] of APARELHOS) {
  for (const tema of ['claro', 'escuro']) {
    for (const texto125 of [false, true]) {
      const { ctx, pg } = await novo(opcoes, { tema, texto125 });
      await abrir(pg); await esperarW(pg, 'ok');
      await pg.waitForTimeout(900);
      const m = await pg.evaluate(() => {
        const w = document.querySelector('section.wg-clima'), r = w.getBoundingClientRect(), cs = getComputedStyle(w);
        const b = document.querySelector('.wg-cid-b').getBoundingClientRect(), t = document.querySelector('.wg-temp'), s = document.querySelector('.wg-cl-hora');
        const fundo = cs.backgroundColor;
        return { esq: r.left, dir: r.right, larg: innerWidth, rolagemH: document.documentElement.scrollWidth > innerWidth + 1, alturaBotao: b.height, cor: getComputedStyle(t).color, corSec: getComputedStyle(s).color, fundo, tamTemp: parseFloat(getComputedStyle(t).fontSize), tamSec: parseFloat(getComputedStyle(s).fontSize),
          corta: w.scrollHeight > w.clientHeight + 1 || w.scrollWidth > w.clientWidth + 1 };
      });
      const tag = `${nomeA} ${tema}${texto125 ? ' 125%' : ''}`;
      ok(m.esq >= 0 && m.dir <= m.larg + 1 && !m.rolagemH, `layout (${tag}): o widget cabe na tela e a página não rola na horizontal`);
      ok(m.alturaBotao >= 44 && !m.corta, `layout (${tag}): o botão da cidade tem 44 px de alvo de toque e nenhum texto do widget é cortado`);
      if (/rgb/.test(m.fundo) && !/rgba\(.*, 0\)/.test(m.fundo)) ok(contraste(m.cor, m.fundo) >= 4.5 && contraste(m.corSec, m.fundo) >= 4.5, `contraste (${tag}): temperatura e texto secundário passam de 4,5:1 (${contraste(m.cor, m.fundo).toFixed(1)} e ${contraste(m.corSec, m.fundo).toFixed(1)})`);
      else ok(true, `contraste (${tag}): fundo do widget composto (${m.fundo.slice(0, 40)}), conferido nas capturas`);
      ok(m.tamSec >= 10, `texto (${tag}): o texto secundário não fica abaixo de 10 px (${m.tamSec.toFixed(1)})`);
      if (texto125) await pg.screenshot({ path: `${CAPTURAS}/09-${nomeA}-${tema}-125.png` }); else await pg.screenshot({ path: `${CAPTURAS}/09-${nomeA}-${tema}.png` });
      if (nomeA !== 'computador' && tema === 'claro' && !texto125) {
        // toque: abrir, buscar, tocar numa cidade
        await pg.tap('.wg-cid-b'); await pg.waitForSelector('#cid-busca'); await pg.fill('#cid-busca', 'Taquara'); await pg.waitForSelector('.cid-op');
        const alvos = await pg.$$eval('.cid-op', (l) => l.map((b) => b.getBoundingClientRect().height));
        ok(alvos.length === 3 && alvos.every((h) => h >= 44), `toque (${nomeA}): as cidades da lista têm alvo de 44 px`);
        await pg.screenshot({ path: `${CAPTURAS}/09-${nomeA}-dialogo.png` });
        await pg.tap('.cid-op >> nth=1'); await pg.waitForFunction(() => document.querySelector('[data-clima-temp]')?.textContent === '31°', null, { timeout: 8000 });
        ok((await cidadeNoW(pg)).local === 'Alagoas, Brasil', `toque (${nomeA}): tocar numa cidade escolhe e troca o clima`);
      }
      await ctx.close();
    }
  }
}
{
  const { ctx, pg } = await novo({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await abrir(pg); await esperarW(pg, 'ok'); await pg.waitForTimeout(500);
  const anim = await pg.evaluate(() => { const w = document.querySelector('section.wg-clima'); return { a: getComputedStyle(w).animationName, d: getComputedStyle(w).animationDuration, t: getComputedStyle(w).transitionDuration }; });
  ok((anim.a === 'none' || parseFloat(anim.d) === 0 || parseFloat(anim.d) <= 0.011) && parseFloat(anim.t) <= 0.011, 'movimento reduzido: o widget não anima (nem entrada nem transição)');
  await ctx.close();
}

// ================= 10) privacidade e limites de todos os pedidos externos =================
await nav.close();
const hostsFora = [...new Set(externasTodas.map((x) => x.host))].sort();
ok(hostsFora.every((h) => h === 'api.open-meteo.com' || h === 'geocoding-api.open-meteo.com') && hostsFora.length === 2, `privacidade: os únicos destinos externos são os dois endereços fixos do Open-Meteo (${hostsFora.join(', ')})`);
ok(externasTodas.every((x) => x.metodo === 'GET' && !x.temCorpo) && externasTodas.every((x) => !/dmanda|@|token|humor|energia|user|conta/i.test(x.url.replace(/^https:\/\/[^/]+/, ''))), 'privacidade: todos os pedidos externos são GET sem corpo e sem dado do Dmanda na URL');
ok(erros.length === 0, 'nenhum erro de console ou de página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
parar();
console.log(`\n${total - falhas}/${total} verificações passaram. Capturas para olhar: ${CAPTURAS}`);
process.exit(falhas ? 1 : 0);
