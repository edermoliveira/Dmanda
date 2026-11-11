// Galeria enxuta antes/depois do Início (decisão 63): mesmo cenário fictício nos dois lados. Só dados de teste; nunca toca o Supabase real nem .dados-teste/pg e .dados-teste/exemplos.
// Uso: node scripts/capturar-inicio.mjs antes|depois   (rode "antes" num worktree do commit anterior ao refinamento, com este script e semear-inicio.mjs copiados, e traga a pasta antes/)
// Saída (ignorada pelo Git): .dados-teste/inicio-galeria/{antes,depois}/*.png, meta.json e indice.html. As capturas vão direto para o disco.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { CENARIOS, semearCenario } from './semear-inicio.mjs';
import * as F from './clima-fixtures.mjs';

const LADO = process.argv[2];
if (LADO !== 'antes' && LADO !== 'depois') { console.error('Uso: node scripts/capturar-inicio.mjs antes|depois'); process.exit(2); }
const PORTA = process.env.PORTA_CAPTURA || '7120', BASE = `http://localhost:${PORTA}`;
const RAIZ = '.dados-teste/inicio-galeria', PASTA = `${RAIZ}/${LADO}`;
rmSync(PASTA, { recursive: true, force: true }); mkdirSync(PASTA, { recursive: true });
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const VP = { desktop: { width: 1440, height: 900 }, notebook: { width: 1280, height: 800 }, tablet: { width: 820, height: 1180 }, celular: { width: 390, height: 844 } };
const PLANO = [
  { cen: '4-vagas', vp: 'desktop', tema: 'claro', texto: 100, fraunces: false }, { cen: '4-vagas', vp: 'notebook', tema: 'claro', texto: 100, fraunces: false },
  { cen: '4-vagas', vp: 'tablet', tema: 'claro', texto: 100, fraunces: false }, { cen: '4-vagas', vp: 'celular', tema: 'claro', texto: 100, fraunces: false },
  { cen: '4-vagas', vp: 'desktop', tema: 'escuro', texto: 100, fraunces: false }, { cen: '4-vagas', vp: 'desktop', tema: 'claro', texto: 125, fraunces: true },
  { cen: '4-vagas', vp: 'celular', tema: 'claro', texto: 125, fraunces: true },
  { cen: '3-vagas', vp: 'desktop', tema: 'claro', texto: 100, fraunces: false }, { cen: '3-vagas', vp: 'celular', tema: 'claro', texto: 100, fraunces: false },
  { cen: 'fora-das-vagas', vp: 'desktop', tema: 'claro', texto: 100, fraunces: false }, { cen: 'fora-das-vagas', vp: 'celular', tema: 'claro', texto: 100, fraunces: false },
];
const ESPERADAS = { '4-vagas': 4, '3-vagas': 3, 'fora-das-vagas': 4 };
const meta = [], falhas = [];
const git = (...a) => spawnSync('git', a, { encoding: 'utf8' }).stdout.trim();
let servidor = null;
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
const subir = async (pasta) => {
  parar();
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: pasta }, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) return; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 2000)); }
  throw new Error('o servidor de captura não subiu');
};
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
for (const cen of Object.keys(CENARIOS)) {
  const itens = PLANO.filter((p) => p.cen === cen);
  const pasta = await semearCenario(cen, `.dados-teste/inicio-galeria-dados/${cen}`);
  await subir(pasta);
  for (const it of itens) {
    const nome = `${cen}-${it.vp}-${it.tema}${it.texto === 125 ? '-texto125' : ''}${it.fraunces ? '-fraunces' : ''}`;
    const ctx = await nav.newContext({ viewport: VP[it.vp], hasTouch: it.vp === 'tablet' || it.vp === 'celular', deviceScaleFactor: 1 });
    try {
      const aparencia = { textoPct: it.texto, ...(it.fraunces ? { titulo: 'fraunces', texto: 'inter', mono: 'plex' } : {}) };
      await ctx.addInitScript(([t, a]) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:aparencia', JSON.stringify(a)); } catch { /* sem armazenamento */ } }, [it.tema, aparencia]);
      await ctx.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, async (rota) => {
        const u = new URL(rota.request().url());
        await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.hostname.startsWith('geocoding') ? F.resultados(F.TAQUARA_RS) : F.previsao({ hora: `${HOJE}T07:45`, data: HOJE })) });
      });
      const pg = await ctx.newPage();
      await pg.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
      await pg.waitForFunction((n) => document.querySelectorAll('[data-painel="para-hoje"] [data-vaga]').length === n, ESPERADAS[cen], { timeout: 120000 });
      const agora = pg.locator('button:has-text("Agora não")'); if (await agora.count()) await agora.first().click();
      await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
      await pg.waitForSelector('.wg-clima[data-clima="ok"], [data-quadro="humor"] .ini-reg-v', { timeout: 30000 }).catch(() => {});
      await pg.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity), null, { timeout: 15000 }).catch(() => {});
      const h = await pg.evaluate(() => (document.querySelector('.main')?.scrollHeight ?? 0) + (document.querySelector('.top')?.offsetHeight ?? 0) + 40);
      if (h > VP[it.vp].height) await pg.setViewportSize({ width: VP[it.vp].width, height: Math.min(h, 3200) });
      await new Promise((r) => setTimeout(r, 600));
      const arquivo = `${nome}.png`;
      await pg.screenshot({ path: `${PASTA}/${arquivo}` });
      meta.push({ nome, arquivo, ...it });
    } catch (e) { falhas.push(`${nome}: ${String(e.message).slice(0, 160)}`); } finally { await ctx.close(); }
  }
  parar();
}
await nav.close();
writeFileSync(`${PASTA}/meta.json`, JSON.stringify({ lado: LADO, commit: git('rev-parse', '--short', 'HEAD'), quando: new Date().toISOString(), itens: meta }, null, 1));

// índice com os pares lado a lado (o que existir de cada lado)
const ler = (l) => { const f = `${RAIZ}/${l}/meta.json`; return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
const A = ler('antes'), D = ler('depois');
const NOMES = { '4-vagas': 'Quatro vagas (cenário principal: duas prioritárias, uma vencida, uma espera da Prefeita)', '3-vagas': 'Três vagas (só três demandas elegíveis)', 'fora-das-vagas': 'Prioridade fora das vagas (quatro vagas de comuns cheias e pedidos da Prefeita elegíveis)' };
const rot = (i) => `${{ desktop: 'Desktop 1440', notebook: 'Notebook 1280', tablet: 'Tablet 820', celular: 'Celular 390' }[i.vp]} · tema ${i.tema}${i.texto === 125 ? ' · texto 125%' : ''}${i.fraunces ? ' · Fraunces, Inter e IBM Plex Mono' : ''}`;
const todos = [...new Map([...(A?.itens ?? []), ...(D?.itens ?? [])].map((i) => [i.nome, i])).values()];
const img = (lado, n) => (ler(lado)?.itens.some((i) => i.nome === n) ? `<a href="${lado}/${n}.png"><img loading="lazy" src="${lado}/${n}.png" alt="${lado}: ${n}"></a>` : '<p class="vazio">sem captura deste lado</p>');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Dmanda: Início, antes e depois</title><style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;background:#f6f6f8;color:#1c1c1e}h1{font-size:22px}h2{margin-top:36px}h3{margin:18px 0 6px;font-size:15px}.par{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}.par>div{background:#fff;border-radius:12px;padding:10px}.par b{display:block;margin-bottom:6px}img{max-width:100%;border:1px solid #ddd;border-radius:8px}.vazio{color:#777}ul{padding-left:20px}code{background:#eee;padding:1px 5px;border-radius:5px}</style></head><body>
<h1>Dmanda: Início, antes e depois (decisão 63)</h1>
<p>Antes: commit <code>${A?.commit ?? '?'}</code> (quatro vagas já gravadas, cards antigos). Depois: commit <code>${D?.commit ?? '?'}</code>. Dados fictícios, banco de teste. Clique numa imagem para ampliar.</p>
<h2>Roteiro</h2><ul><li><b>Quatro vagas:</b> <code>$env:DMANDA_PASTA_TESTE='.dados-teste/inicio-4-vagas'; npm.cmd run dev:exemplos</code> e abra http://localhost:7100: quatro cards em duas linhas de dois.</li>
<li><b>Três vagas:</b> o mesmo comando com <code>.dados-teste/inicio-3-vagas</code>: três cards na mesma linha (largura grande) ou lista compacta (largura média).</li>
<li><b>Prioridade fora das vagas:</b> o mesmo comando com <code>.dados-teste/inicio-fora-das-vagas</code>: linhas compactas dos pedidos da Prefeita acima dos quatro cards comuns, sem tirar nenhum deles.</li></ul>
${Object.keys(NOMES).map((c) => `<h2>${NOMES[c]}</h2>${todos.filter((i) => i.cen === c).map((i) => `<h3>${rot(i)}</h3><div class="par"><div><b>Antes</b>${img('antes', i.nome)}</div><div><b>Depois</b>${img('depois', i.nome)}</div></div>`).join('')}`).join('')}
</body></html>`;
writeFileSync(`${RAIZ}/indice.html`, html);
console.log(`capturas: ${meta.length}, falhas: ${falhas.length}${falhas.length ? '\n' + falhas.join('\n') : ''}\níndice: ${RAIZ}/indice.html`);
