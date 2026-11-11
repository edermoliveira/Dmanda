// Medição repetível do Início (rodada de 11/11/2026): BUILD DE PRODUÇÃO LOCAL (next start), banco de TESTE (PGlite) com a semente fictícia "completo" do Início, Edge headless e Open-Meteo trocado por fixtures.
// Por perfil (desktop, notebook de rede lenta, celular com rede lenta e CPU 4x) e por rodada: tempo até a primeira resposta (TTFB), até os cards das vagas aparecerem e até ficarem utilizáveis
// (card pintado e hidratado, mini calendário presente), JavaScript transferido pela rota (cache frio e quente) e requisições. A mediana e o intervalo saem de várias rodadas.
// Nunca toca o Supabase real nem a produção. Exige `npm run build` antes (e nenhum `next dev` rodando: a pasta .next tem trava).
// Uso: node scripts/medir-inicio.mjs [rotulo] [rodadas]
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { semearCenario } from './semear-inicio.mjs';
import * as F from './clima-fixtures.mjs';

const ROTULO = process.argv[2] || 'medicao', RODADAS = Number(process.argv[3] || 7);
const PORTA = process.env.PORTA_MEDICAO || '7122', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/med-inicio';
if (!existsSync('.next/BUILD_ID')) { console.error('Faça `npm run build` antes.'); process.exit(2); }
mkdirSync('.dados-teste/medicoes', { recursive: true });
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const PERFIS = {
  desktop: { ctx: { viewport: { width: 1360, height: 800 } }, rede: null, cpu: 1 },
  notebook_lento: { ctx: { viewport: { width: 1280, height: 800 } }, rede: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 }, cpu: 4 },
  celular_lento: { ctx: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, rede: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 }, cpu: 4 },
};
const mediana = (l) => { const o = [...l].sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2); };
const resumo = (l) => ({ mediana: mediana(l), min: Math.min(...l), max: Math.max(...l), n: l.length });

// arquivos de build: soma dos chunks de JavaScript e de CSS (bruto e comprimido)
function arquivosDoBuild() {
  const lista = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? lista(join(d, e.name)) : [join(d, e.name)]));
  const r = { js: { arquivos: 0, bytes: 0, gz: 0 }, css: { arquivos: 0, bytes: 0, gz: 0 } };
  for (const f of lista('.next/static')) {
    const t = f.endsWith('.js') ? 'js' : f.endsWith('.css') ? 'css' : null; if (!t) continue;
    const b = readFileSync(f); r[t].arquivos++; r[t].bytes += b.length; r[t].gz += gzipSync(b).length;
  }
  return r;
}

rmSync(PASTA, { recursive: true, force: true });
await semearCenario('completo', PASTA);
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', PORTA], { env: { ...process.env, NODE_ENV: 'production', DMANDA_BANCO: 'teste', DMANDA_MEDICAO_LOCAL: 'sim', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 1000)); }

const MARCAS = () => {
  window.__t = { cards: null, util: null };
  const pronto = (el) => !!el && el.offsetHeight > 0 && Object.keys(el).some((k) => k.startsWith('__reactProps'));
  const passo = () => {
    const card = document.querySelector('[data-vaga]');
    if (window.__t.cards == null && card && card.offsetHeight > 0) window.__t.cards = performance.now();
    if (window.__t.util == null && pronto(card) && document.querySelector('.mini-cal') && !/Carregando/.test(document.body.innerText)) { window.__t.util = performance.now(); return; }
    requestAnimationFrame(passo);
  };
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(passo));
};
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions'] });
const saida = { rotulo: ROTULO, rodadas: RODADAS, data: new Date().toISOString(), cenario: 'semente fictícia "completo" do Início, banco de teste (PGlite), next start (produção local), Edge headless', perfis: {}, build: arquivosDoBuild() };

for (const [nome, cfg] of Object.entries(PERFIS)) {
  const frio = [], quente = [];
  for (let rod = 0; rod < RODADAS; rod++) {
    const ctx = await nav.newContext(cfg.ctx);
    await ctx.addInitScript(MARCAS);
    await ctx.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, async (rota) => { const u = new URL(rota.request().url()); await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.hostname.startsWith('geocoding') ? F.resultados(F.TAQUARA_RS, F.PORTO_ALEGRE) : F.previsao({ hora: `${HOJE}T07:45`, data: HOJE })) }); });
    const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
    if (cfg.rede) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: cfg.rede.latency, downloadThroughput: cfg.rede.down, uploadThroughput: cfg.rede.up }); }
    if (cfg.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.cpu });
    for (const [lista, recarregar] of [[frio, false], [quente, true]]) {
      if (recarregar) { await pg.goto('about:blank'); }
      await pg.goto(BASE + '/', { waitUntil: 'commit', timeout: 240000 });
      await pg.waitForFunction(() => window.__t && window.__t.util != null, null, { timeout: 240000, polling: 50 });
      await pg.waitForTimeout(400);
      lista.push(await pg.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0], rs = performance.getEntriesByType('resource');
        const js = rs.filter((e) => /\.js(\?|$)/.test(e.name));
        return { ttfb: Math.round(n.responseStart), cards: Math.round(window.__t.cards), util: Math.round(window.__t.util), jsTransferidoKB: +(js.reduce((s, e) => s + e.transferSize, 0) / 1024).toFixed(1), jsDescompactadoKB: +(js.reduce((s, e) => s + e.decodedBodySize, 0) / 1024).toFixed(1), jsArquivos: js.length, requisicoes: rs.length + 1 };
      }));
    }
    await ctx.close();
  }
  const por = (l, k) => resumo(l.map((x) => x[k]));
  saida.perfis[nome] = Object.fromEntries([['frio', frio], ['quente', quente]].map(([t, l]) => [t, Object.fromEntries(['ttfb', 'cards', 'util', 'jsTransferidoKB', 'jsDescompactadoKB', 'jsArquivos', 'requisicoes'].map((k) => [k, por(l, k)]))]));
  console.log(nome, JSON.stringify(saida.perfis[nome]));
}
await nav.close(); parar();
writeFileSync(`.dados-teste/medicoes/inicio-${ROTULO}.json`, JSON.stringify(saida, null, 2));
console.log('build', JSON.stringify(saida.build));
console.log(`gravado em .dados-teste/medicoes/inicio-${ROTULO}.json`);
process.exit(0);
