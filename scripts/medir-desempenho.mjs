// Desempenho com o BUILD DE PRODUÇÃO LOCAL (next build + next start), banco de TESTE (PGlite) e dados fictícios em volumes crescentes.
// Mede, por tela e por perfil de rede: tempo até a tela ficar pronta, primeira pintura, requisições, bytes transferidos, chamadas ao servidor (ações) e a resposta de ações comuns.
// Nunca toca o Supabase real nem a produção. Exige `npm run build` antes.
// Uso: node scripts/medir-desempenho.mjs [rotulo] [volumes separados por vírgula] [perfis separados por vírgula]
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { semearVolume, VOLUMES } from './semear-volume.mjs';

const ROTULO = process.argv[2] || 'medicao';
const VOLS = (process.argv[3] || 'vazio,pequeno,medio,grande').split(',');
const PERFIS = {
  rede_boa: { rede: null, cpu: 1 },
  lenta: { rede: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 }, cpu: 4 }, // "4G lento" do Chrome, com CPU 4x mais lenta (celular)
  muito_lenta: { rede: { latency: 600, down: (400 * 1024) / 8, up: (400 * 1024) / 8 }, cpu: 4 }, // 3G ruim
};
const PERF = (process.argv[4] || 'rede_boa,lenta,muito_lenta').split(',');
const RODADAS = Number(process.argv[5] || 1);   // quantas vezes repetir as mesmas medições (a mediana e a variação saem daqui)
const folhas = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? folhas(v, pre + k + '.') : typeof v === 'number' ? [[pre + k, v]] : []));
const mediana = (l) => { const o = [...l].sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2); };
/** Mediana de cada número, com a mesma forma de uma rodada; e [mínimo, máximo] de cada um. */
function resumir(rodadas) {
  const r = JSON.parse(JSON.stringify(rodadas[0])), variacao = {};
  for (const [caminho] of folhas(rodadas[0])) {
    const v = rodadas.map((x) => caminho.split('.').reduce((a, k) => a?.[k], x)).filter((n) => typeof n === 'number');
    const partes = caminho.split('.'); let alvo = r; for (const k of partes.slice(0, -1)) alvo = alvo[k]; alvo[partes.at(-1)] = mediana(v);
    variacao[caminho] = [Math.min(...v), Math.max(...v)];
  }
  return { ...r, rodadas: rodadas.length, variacao };
}
const PORTA = process.env.PORTA_MEDICAO || '7110', BASE = `http://localhost:${PORTA}`;
if (!existsSync('.next/BUILD_ID')) { console.error('Faça `npm run build` antes.'); process.exit(2); }
mkdirSync('.dados-teste/medicoes', { recursive: true });

const ROTAS = [['/', 'Início'], ['/demandas', 'Demandas'], ['/entradas', 'Entradas'], ['/agenda', 'Agenda'], ['/arquivo', 'Arquivo']];
const resultado = {};

// marca, dentro da página, o instante em que a tela tem conteúdo e nenhum "Carregando"
const SCRIPT_PRONTO = () => {
  window.__pronto = null;
  const t = () => {
    if (window.__pronto == null && document.querySelector('.app .main') && !/Carregando/.test(document.body.innerText) && (document.querySelector('.main')?.innerText.trim().length ?? 0) > 5) window.__pronto = performance.now();
    else if (window.__pronto == null) requestAnimationFrame(t);
  };
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(t));
};

for (const vol of VOLS) {
  const pasta = `.dados-teste/med-${vol}`;
  rmSync(pasta, { recursive: true, force: true });
  const sem = await semearVolume(pasta, vol);
  const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', PORTA], { env: { ...process.env, NODE_ENV: 'production', DMANDA_BANCO: 'teste', DMANDA_MEDICAO_LOCAL: 'sim', DMANDA_PASTA_TESTE: pasta, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
  const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
  process.on('exit', parar);
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 1000)); }
  const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions'] });
  resultado[vol] = { semente: sem, perfis: {} };

  for (const perfil of PERF) {
    const cfg = PERFIS[perfil];
    const novo = async () => {
      const ctx = await nav.newContext({ viewport: { width: 1360, height: 800 } });
      await ctx.addInitScript(SCRIPT_PRONTO);
      const pg = await ctx.newPage();
      const cdp = await ctx.newCDPSession(pg);
      await cdp.send('Network.enable');
      const est = { reqs: 0, bytes: 0, js: 0, acoes: 0, falhas: 0, ids: new Map() };
      cdp.on('Network.requestWillBeSent', (e) => {
        const acao = !!(e.request.headers['next-action'] || e.request.headers['Next-Action']);
        est.reqs++; est.ids.set(e.requestId, { tipo: e.type }); if (acao) est.acoes++;
      });
      cdp.on('Network.loadingFinished', (e) => { est.bytes += e.encodedDataLength; if (est.ids.get(e.requestId)?.tipo === 'Script') est.js += e.encodedDataLength; });
      cdp.on('Network.loadingFailed', () => { est.falhas++; });
      if (cfg.rede) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: cfg.rede.latency, downloadThroughput: cfg.rede.down, uploadThroughput: cfg.rede.up });
      if (cfg.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.cpu });
      return { ctx, pg, est };
    };
    const zerar = (est) => { est.reqs = 0; est.bytes = 0; est.js = 0; est.acoes = 0; est.falhas = 0; };
    const esperaPronto = async (pg) => { await pg.waitForFunction(() => window.__pronto != null, null, { timeout: 240000, polling: 100 }); await pg.waitForTimeout(500); };
    const rodadas = [];
    for (let rod = 0; rod < RODADAS; rod++) {
    const r = { frio: {}, quente: {}, navegacao: {}, interacao: {} };

    // 1) carga fria (sem cache) e quente (recarregando) de cada tela
    for (const [rota, nome] of ROTAS) {
      const { ctx, pg, est } = await novo();
      await pg.goto(BASE + rota, { waitUntil: 'commit', timeout: 240000 });
      await esperaPronto(pg);
      const m = await pg.evaluate(() => ({ pronto: Math.round(window.__pronto), fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1), ttfb: Math.round(performance.getEntriesByType('navigation')[0].responseStart) }));
      r.frio[nome] = { ...m, reqs: est.reqs, kb: Math.round(est.bytes / 1024), jsKb: Math.round(est.js / 1024), acoes: est.acoes };
      zerar(est);
      await pg.reload({ waitUntil: 'commit', timeout: 240000 });
      await esperaPronto(pg);
      const q = await pg.evaluate(() => ({ pronto: Math.round(window.__pronto) }));
      r.quente[nome] = { ...q, reqs: est.reqs, kb: Math.round(est.bytes / 1024), acoes: est.acoes };
      await ctx.close();
    }

    // 2) navegação dentro do aplicativo (clicando no menu), a partir do Início já carregado
    {
      const { ctx, pg, est } = await novo();
      await pg.goto(BASE + '/', { waitUntil: 'commit', timeout: 240000 });
      await esperaPronto(pg);
      for (const [dn, nome] of [['demandas', 'Demandas'], ['entradas', 'Entradas'], ['agenda', 'Agenda'], ['inicio', 'Início']]) {
        zerar(est);
        const t = await pg.evaluate(async (d) => {
          const t0 = performance.now();
          document.querySelector(`.side .navi[data-nav="${d}"]`).click();
          await new Promise((res) => { const f = () => { if (document.querySelector(`.side .navi[data-nav="${d}"]`)?.getAttribute('aria-current') === 'page' && !/Carregando/.test(document.body.innerText)) requestAnimationFrame(() => requestAnimationFrame(res)); else setTimeout(f, 16); }; f(); });
          return Math.round(performance.now() - t0);
        }, dn);
        await pg.waitForTimeout(300);
        r.navegacao[nome] = { ms: t, reqs: est.reqs, kb: Math.round(est.bytes / 1024), acoes: est.acoes };
      }

      // 3) interações: trocar a visão de Demandas, filtrar, buscar nas Entradas (tempo até o próximo quadro pintado)
      await pg.evaluate(() => document.querySelector('.side .navi[data-nav="demandas"]').click());
      await pg.waitForSelector('.tabs button[data-v]', { timeout: 300000 });
      await pg.waitForTimeout(800);
      for (const v of ['quadro', 'tabela', 'lista', 'cards']) {
        r.interacao['Demandas: ver ' + v] = await pg.evaluate(async (x) => { const t0 = performance.now(); document.querySelector(`.tabs button[data-v="${x}"]`).click(); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); return Math.round(performance.now() - t0); }, v);
      }
      r.interacao['Demandas: filtrar digitando (pior tecla)'] = await pg.evaluate(async () => {
        const el = document.querySelector('#fq'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; let max = 0;
        for (const s of ['f', 'fi', 'fic', 'fict', 'fictí', 'fictíc', 'fictíci']) { const a = performance.now(); set.call(el, s); el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); max = Math.max(max, performance.now() - a); }
        return Math.round(max);
      });
      await pg.evaluate(() => document.querySelector('.side .navi[data-nav="entradas"]').click());
      await pg.waitForSelector('#eq', { timeout: 300000 });
      await pg.waitForTimeout(800);
      r.interacao['Entradas: buscar digitando (pior tecla)'] = await pg.evaluate(async () => {
        const el = document.querySelector('#eq'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; let max = 0;
        for (const s of ['t', 'te', 'tex', 'text', 'texto', 'texto f', '#tag3']) { const a = performance.now(); set.call(el, s); el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); max = Math.max(max, performance.now() - a); }
        return Math.round(max);
      });
      await ctx.close();
    }
    rodadas.push(r);
    }
    const r = resumir(rodadas);
    resultado[vol].perfis[perfil] = r;
    console.log(`[${vol}/${perfil}] frio: ` + ROTAS.map(([, n]) => `${n} ${r.frio[n].pronto}ms`).join(', '));
  }
  await nav.close(); parar();
  await new Promise((res) => setTimeout(res, 1500));
}
writeFileSync(`.dados-teste/medicoes/${ROTULO}.json`, JSON.stringify(resultado, null, 1));

// ---- resumo em tabela ----
for (const vol of VOLS) for (const perfil of PERF) {
  const r = resultado[vol].perfis[perfil]; if (!r) continue;
  console.log(`\n### ${vol} (${JSON.stringify(VOLUMES[vol])}) | rede: ${perfil}`);
  const vr = (r, c) => { const v = r.variacao?.[c]; return v && RODADAS > 1 ? ` (${v[0]}-${v[1]})` : ''; };
  console.log(`${RODADAS} rodada(s); valores = mediana (mínimo-máximo)`);
  console.log('| Tela | pronto frio (ms) | FCP | requisições | KB | JS KB | ações | pronto quente (ms) | KB quente | navegação (ms) | ações na navegação |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [, n] of ROTAS) { const f = r.frio[n], q = r.quente[n], nv = r.navegacao[n]; console.log(`| ${n} | ${f.pronto}${vr(r, `frio.${n}.pronto`)} | ${f.fcp} | ${f.reqs} | ${f.kb} | ${f.jsKb} | ${f.acoes} | ${q.pronto}${vr(r, `quente.${n}.pronto`)} | ${q.kb} | ${nv?.ms ?? ''}${nv ? vr(r, `navegacao.${n}.ms`) : ''} | ${nv?.acoes ?? ''} |`); }
  console.log('Interações (ms): ' + Object.entries(r.interacao).map(([k, v]) => `${k}: ${v}${vr(r, `interacao.${k}`)}`).join('; '));
}
process.exit(0);
