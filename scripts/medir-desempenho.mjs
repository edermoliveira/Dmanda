// Linha de base de desempenho do Dmanda (bloco de resistência, confiabilidade e desempenho). Só dados FICTÍCIOS, banco local de TESTE (PGlite) e Edge; nunca toca o Supabase real.
// Mede, para volumes crescentes: tamanho e tempo das listas no banco, carga de cada tela (tempo até o conteúdo, quantidade e duração das ações do servidor, se elas se serializam),
// troca de visões de Demandas, tarefas longas do navegador e a carga com latência elevada (cache de arquivos aquecido, só a rede dos dados é lenta).
// ATENÇÃO: o modo de teste é recusado em produção, então o servidor aqui é o de DESENVOLVIMENTO (arquivos grandes e sem otimização). Tempos absolutos de renderização valem só para comparar
// antes/depois na mesma máquina; o peso dos arquivos vem do build de produção (npm run build), medido à parte.
// Uso: node scripts/medir-desempenho.mjs [saida.json] [volume1,volume2]   (volumes: pequeno, medio, grande, extremo)
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

const USUARIO = '00000000-0000-4000-8000-000000000001';
const VOLUMES = {
  pequeno: { demandas: 10, tarefas: 40, entradas: 10, eventos: 20 },       // início de uso
  medio: { demandas: 60, tarefas: 300, entradas: 80, eventos: 150 },       // alguns meses
  grande: { demandas: 300, tarefas: 1800, entradas: 400, eventos: 800 },   // cerca de um ano
  extremo: { demandas: 1000, tarefas: 6000, entradas: 1200, eventos: 2500 }, // bem além do uso previsto
};
const saida = process.argv[2] || '.dados-teste/medicao.json';
const nomes = (process.argv[3] || 'pequeno,medio,grande').split(',');
const PORTA = process.env.PORTA_MEDICAO || '7110', BASE = `http://localhost:${PORTA}`;
let semente = 12345; const alea = () => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x7fffffff; };

async function semear(pasta, v) {
  rmSync(pasta, { recursive: true, force: true }); mkdirSync(pasta, { recursive: true });
  const db = await abrirBancoTeste({ pasta });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const hoje = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const mais = async (n) => (await db.query('select (public.hoje() + $1::int)::text as d', [n])).rows[0].d;
  const etapas = ['Cadastro', 'Fazendo', 'Fazendo', 'Aguardando retorno', 'Aguardando Prefeita', 'Fazendo'];
  const ids = [];
  for (let i = 0; i < v.demandas; i++) {
    const etapa = etapas[i % etapas.length];
    const o = { assunto: `Demanda fictícia ${i + 1} sobre o processo administrativo`, tipo: 'Memorando', numero: `${i + 1}/2026`, descricao: 'Texto descritivo fictício da demanda para medir o peso das listas. '.repeat(3), etapa, prazo_original: await mais(Math.floor(alea() * 70) - 10) };
    if (etapa === 'Aguardando retorno') o.setor = 'Contabilidade';
    ids.push((await c('criar_demanda', { p: o })).id);
  }
  for (let i = 0; i < v.tarefas; i++) await c('adicionar_tarefa', { p_demanda: ids[i % ids.length], p_texto: `Tarefa fictícia ${i + 1} da demanda, com texto de tamanho comum` });
  for (let i = 0; i < v.entradas; i++) await c('criar_entrada', { p: { titulo: `Anotação ${i + 1}`, texto: 'Texto fictício de anotação, com algumas palavras para a busca. '.repeat(2) } });
  for (let i = 0; i < v.eventos; i++) await c('criar_evento', { p: { titulo: `Compromisso fictício ${i + 1}`, tipo: 'Reunião', data: await mais(Math.floor(alea() * 120) - 30), inicio: '09:00', fim: '10:00', aviso_min: 15 } });
  // tempo e tamanho das listas dentro do banco (sem rede nem interface)
  const lista = {};
  for (const [nome, fn, args] of [['demandas', 'listar_demandas', { p_arquivadas: false }], ['entradas', 'listar_entradas', { p_arquivadas: false }], ['eventos', 'listar_eventos', {}], ['dias', 'listar_dias_indisponiveis', {}]]) {
    await c(fn, args); const t0 = performance.now(); const r = await c(fn, args); lista[nome] = { ms: +(performance.now() - t0).toFixed(1), kb: +(JSON.stringify(r).length / 1024).toFixed(1) };
  }
  await db.close();
  return { hoje, lista };
}

const ocioso = (ms) => new Promise((r) => setTimeout(r, ms));
async function medirTela(nav, rota, pronto, { latencia = 0 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const pg = await ctx.newPage();
  const acoes = [];
  pg.on('request', (rq) => { if (rq.method() === 'POST' && rq.headers()['next-action']) acoes.push({ t0: performance.now(), rq }); });
  pg.on('requestfinished', async (rq) => { const a = acoes.find((x) => x.rq === rq); if (a) { a.t1 = performance.now(); try { a.bytes = (await rq.sizes()).responseBodySize; } catch { a.bytes = 0; } } });
  if (latencia) { // primeira carga aquece o cache dos arquivos; depois só a rede dos dados fica lenta
    await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 180000 }); await pg.waitForSelector(pronto, { timeout: 180000 }); await ocioso(1500);
    acoes.length = 0;
    const cdp = await ctx.newCDPSession(pg); await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: latencia, downloadThroughput: (1.5 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  }
  await pg.addInitScript(() => { window.__longas = 0; window.__nlongas = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__longas += e.duration; window.__nlongas++; } }).observe({ type: 'longtask', buffered: true }); } catch { /* sem suporte */ } });
  const t0 = performance.now();
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 180000 });
  await pg.waitForSelector(pronto, { timeout: 180000 });
  await pg.waitForFunction(() => !/Carregando/.test(document.body.innerText), null, { timeout: 180000 });
  const total = performance.now() - t0;
  await ocioso(1200);
  const ordenadas = acoes.filter((a) => a.t1).sort((a, b) => a.t0 - b.t0);
  let sobrepostas = 0; for (let i = 1; i < ordenadas.length; i++) if (ordenadas[i].t0 < ordenadas[i - 1].t1 - 5) sobrepostas++;
  const r = {
    rota, ate_conteudo_ms: Math.round(total), acoes: ordenadas.length, acoes_ms_soma: Math.round(ordenadas.reduce((s, a) => s + (a.t1 - a.t0), 0)),
    acoes_ms_max: Math.round(Math.max(0, ...ordenadas.map((a) => a.t1 - a.t0))), acoes_sobrepostas: sobrepostas, kb_dados: +(ordenadas.reduce((s, a) => s + (a.bytes || 0), 0) / 1024).toFixed(1),
    tarefas_longas_ms: Math.round(await pg.evaluate(() => window.__longas || 0)), n_tarefas_longas: await pg.evaluate(() => window.__nlongas || 0),
    nos_dom: await pg.evaluate(() => document.getElementsByTagName('*').length),
  };
  await ctx.close();
  return r;
}

async function medirVisoes(nav) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 180000 }); await pg.waitForSelector('.toolbar .tabs button[data-v]', { timeout: 180000 });
  await pg.waitForFunction(() => !/Carregando/.test(document.body.innerText), null, { timeout: 180000 }); await ocioso(1000);
  const r = {};
  for (const v of ['quadro', 'tabela', 'lista', 'cards']) {
    const t = await pg.evaluate(async (vis) => { const t0 = performance.now(); document.querySelector(`.toolbar .tabs button[data-v="${vis}"]`).click(); await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))); return performance.now() - t0; }, v);
    r[v] = Math.round(t);
  }
  // busca por texto: digita e mede até o quadro estabilizar
  const busca = await pg.$('input[type="search"], .toolbar input');
  if (busca) { const t0 = performance.now(); await busca.type('fictícia 7', { delay: 0 }); await pg.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)))); r.busca = Math.round(performance.now() - t0); }
  await ctx.close();
  return r;
}

const resultado = { quando: new Date().toISOString(), maquina: process.platform, volumes: {} };
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions'] });
for (const nome of nomes) {
  const v = VOLUMES[nome]; const pasta = `.dados-teste/medicao-${nome}`;
  console.log(`\n== ${nome}`, JSON.stringify(v));
  const t0 = performance.now(); const base = await semear(pasta, v); console.log(`semeado em ${Math.round(performance.now() - t0)} ms; banco:`, JSON.stringify(base.lista));
  const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: pasta, CRON_SECRET: 'segredo-de-teste' }, stdio: 'ignore' });
  const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
  process.on('exit', parar);
  try {
    for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* subindo */ } await ocioso(2000); }
    const rotas = [['/', '.app .main'], ['/demandas', '.toolbar .tabs'], ['/entradas', '.app .main'], ['/agenda', '.agd']];
    for (const [rota, sel] of rotas) { try { await medirTela(nav, rota, sel); } catch { /* aquecimento da compilação */ } } // aquece a compilação do modo de desenvolvimento
    const telas = [];
    for (const [rota, sel] of rotas) telas.push(await medirTela(nav, rota, sel));
    const lenta = [];
    for (const [rota, sel] of rotas.slice(0, 3)) lenta.push({ ...(await medirTela(nav, rota, sel, { latencia: 300 })), latencia_ms: 300 });
    const visoes = await medirVisoes(nav);
    resultado.volumes[nome] = { ...v, banco: base.lista, telas, lenta, visoes_ms: visoes };
    console.log(JSON.stringify(resultado.volumes[nome], null, 1));
  } finally { parar(); await ocioso(1500); }
}
await nav.close();
writeFileSync(saida, JSON.stringify(resultado, null, 2));
console.log('\nsalvo em', saida);
process.exit(0);
