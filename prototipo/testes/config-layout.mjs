// Configurações: composição sem vazios sob os painéis menores, Aparência com as amostras de cor em grade larga, sem rolagem lateral,
// ordem de leitura igual à do documento, e as opções continuam aplicando (cor, modo, fonte, ícones, tamanhos, fundo, widgets). Cinco tamanhos, claro e escuro.
// Uso (dentro da pasta prototipo): node testes/config-layout.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await (await nav.newContext({ viewport: { width: 1480, height: 1000 } })).newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.cfg')); await pg.waitForTimeout(300); };

const ESPERADAS = ['Aparência', 'Fundo', 'Fontes', 'Ícones', 'Tamanhos'];
for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'tablet-h', 'media', 'tablet-v', 'phone']) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=config&balao=nao&aviso=nao');
  const m = await pg.evaluate(() => {
    const cfg = document.querySelector('.cfg'), rc = cfg.getBoundingClientRect(), secs = [...cfg.children].filter((e) => e.getBoundingClientRect().height);
    const r = secs.map((s) => { const b = s.getBoundingClientRect(); return { t: (s.querySelector('h3') || {}).textContent, l: Math.round(b.left), r: Math.round(b.right), top: Math.round(b.top), bot: Math.round(b.bottom) }; });
    const topo = r[0], resto = r.slice(1);
    const colunas = {}; resto.forEach((x) => { (colunas[x.l] ||= []).push(x); });
    const cols = Object.values(colunas).map((c) => c.sort((a, b) => a.top - b.top));
    let maiorBuraco = 0; cols.forEach((c) => { for (let i = 1; i < c.length; i++) maiorBuraco = Math.max(maiorBuraco, c[i].top - c[i - 1].bot); });
    const alturas = cols.map((c) => c[c.length - 1].bot - c[0].top), maxA = Math.max(...alturas), minA = Math.min(...alturas);
    const main = document.querySelector('.main'), pal = [...document.querySelectorAll('.cfg-topo .sw')], lin = new Set(pal.map((p) => Math.round(p.getBoundingClientRect().top)));
    const fora = secs.some((s) => { const b = s.getBoundingClientRect(); return b.left < rc.left - 1 || b.right > rc.right + 1; });
    const foco = [...cfg.querySelectorAll('button, input, select, a')].filter((e) => e.getBoundingClientRect().width).map((e) => e.closest('section').querySelector('h3').textContent);
    const ordemDom = [...new Set(foco)];
    return { titulos: r.map((x) => x.t), topoLarg: topo.r - topo.l, cfgLarg: Math.round(rc.width), nCols: cols.length, maiorBuraco, desequilibrio: maxA ? Math.round(100 * (maxA - minA) / maxA) : 0, paginaOk: main.scrollWidth <= main.clientWidth + 1, porLinha: pal.length / lin.size, linhasPal: lin.size, fora, ordemDom, contidos: secs.every((s) => s.scrollWidth <= s.clientWidth + 1) };
  });
  const colEsper = { desktop: 3, 'tablet-h': 3, media: 2, 'tablet-v': 2, phone: 1 }[dev];
  ok(m.titulos.slice(0, 5).join() === ESPERADAS.join() && m.paginaOk && !m.fora && m.contidos, modo + ', ' + dev + ': painéis na ordem ' + m.titulos.slice(0, 5).join(', ') + ', sem rolagem lateral nem conteúdo fora do painel');
  ok(m.topoLarg >= m.cfgLarg - 2, modo + ', ' + dev + ': Aparência ocupa a largura toda (' + m.topoLarg + ' de ' + m.cfgLarg + ' px)');
  ok(m.nCols === colEsper && m.maiorBuraco <= 20, modo + ', ' + dev + ': ' + m.nCols + ' coluna(s) de painéis (esperado ' + colEsper + '), maior espaço vertical entre painéis de ' + m.maiorBuraco + ' px');
  if (m.nCols > 1) ok(m.desequilibrio <= 45, modo + ', ' + dev + ': colunas equilibradas (diferença de altura de ' + m.desequilibrio + '%)');
  const esperaPal = dev === 'phone' ? 2 : ['desktop', 'tablet-h', 'media'].includes(dev) ? 5 : 0;
  if (esperaPal) ok(Math.round(m.porLinha) === esperaPal, modo + ', ' + dev + ': amostras de cor com ' + Math.round(m.porLinha) + ' por linha em ' + m.linhasPal + ' linhas');
  ok(m.ordemDom.slice(0, 3).join() === 'Aparência,Fundo,Fontes' || m.ordemDom.slice(0, 2).join() === 'Aparência,Fundo', modo + ', ' + dev + ': a ordem dos controles (Tab) segue a ordem do documento (' + m.ordemDom.slice(0, 5).join(' > ') + ')');
}

// as opções continuam aplicando e valendo ao navegar
await abrir('tema=claro&dev=desktop&tela=config&balao=nao&aviso=nao');
const lerAcc = () => pg.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--acc').trim());
const acc0 = await lerAcc();
await pg.click('.cfg-topo .sw[aria-label="Paleta Rosa"]'); await pg.waitForTimeout(200);
const acc1 = await lerAcc(); ok(acc1 !== acc0 && (await pg.evaluate(() => document.querySelector('.cfg-topo .sw[aria-label="Paleta Rosa"]').getAttribute('aria-pressed'))) === 'true', 'cor de destaque: Rosa aplicada e marcada');
await pg.click('[data-nav="demandas"]'); await pg.waitForTimeout(250); ok((await lerAcc()) === acc1, 'cor de destaque continua ao navegar');
await pg.click('[data-nav="config"]'); await pg.waitForTimeout(200);
await pg.click('.cfg-topo [data-act="tema"]'); await pg.waitForTimeout(250); ok(await pg.evaluate(() => document.querySelector('.app').dataset.tema === 'escuro'), 'modo escuro pelo botão da Aparência');
await pg.click('.cfg-topo [data-act="tema"]'); await pg.waitForTimeout(250);
const f0 = await pg.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--font-h').trim());
await pg.click('[data-act="conjunto"][data-i="1"]'); await pg.waitForTimeout(250);
ok((await pg.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--font-h').trim())) !== f0, 'fontes: conjunto escolhido muda a fonte principal');
await pg.click('[data-act="ico"][data-v="duotone"]'); await pg.waitForTimeout(200); ok(await pg.evaluate(() => document.querySelector('.app').dataset.ico === 'duotone'), 'ícones: estilo duotone aplicado');
await pg.click('[data-act="lib"][data-v="lucide"]'); await pg.waitForTimeout(200); ok(await pg.evaluate(() => window.DM.estado.lib === 'lucide'), 'ícones: biblioteca Lucide continua disponível e aplica (ambas as opções preservadas)');
await pg.evaluate(() => { const r = document.querySelector('[data-cfg="fs"]'); r.value = '18'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(200);
ok(await pg.evaluate(() => window.DM.estado.fs === 18), 'tamanhos: o texto passa para 18');
await pg.click('[data-act="fundo-modo"][data-v="cor"]'); await pg.fill('[data-fundo-cor]', '#336699'); await pg.waitForTimeout(200);
await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(300);
ok(await pg.evaluate(() => document.querySelector('.app').dataset.fundo === 'cor'), 'fundo em cor persiste ao recarregar');
await pg.evaluate(() => localStorage.removeItem('dmanda:fundo'));
const w0 = await pg.evaluate(() => window.DM.estado.widgets && JSON.stringify(window.DM.estado.widgets));
await pg.click('[data-nav="config"]'); await pg.waitForTimeout(200);
const sw = await pg.$('.cfg [role="switch"], .cfg .interruptor, .cfg [data-act="widget"]');
ok(!!sw, 'widgets do Início continuam listados em Configurações');
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
