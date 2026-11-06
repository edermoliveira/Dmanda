// Configurações > Aparência (bloco de 06/11/2026), no navegador (Edge) com o banco local de TESTE (PGlite, dados fictícios):
// modo Claro, Escuro e Sistema, destaques, fontes, tamanhos, fundo animado e movimento, aplicação imediata, recarga, restauração do padrão,
// armazenamento corrompido, escolhas antigas preservadas, contraste das dez paletas nos dois modos, alvos de toque, layout em computador, iPad e celular,
// cards nos limites de altura, e o cadastro de dias indisponíveis intacto. Sobe o próprio servidor (porta 7112, pasta de dados nova).
// NÃO valida o Supabase real. Uso: node scripts/testar-config.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';

const PORTA = process.env.PORTA_TESTE_CONFIG || '7112', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/config';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const PERFIS = {
  computador: { viewport: { width: 1360, height: 800 } },
  ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
};
const novo = async (perfil = 'computador', { esquema = 'light', movimento = 'no-preference', antes, arg } = {}) => {
  const ctx = await nav.newContext({ ...PERFIS[perfil], colorScheme: esquema, reducedMotion: movimento });
  if (antes) await ctx.addInitScript(antes, arg);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
const ir = async (pg, rota = '/config') => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !document.body.innerText.includes('Carregando'), null, { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(400);
};
const app = (pg, nome) => pg.evaluate((n) => getComputedStyle(document.querySelector('.app')).getPropertyValue(n).trim(), nome);
const guardado = (pg, chave) => pg.evaluate((c) => localStorage.getItem(c), chave);
const apar = async (pg) => JSON.parse((await guardado(pg, 'dmanda:aparencia')) || 'null');
const escolher = async (pg, papel, id) => { await pg.click(`#cfg-f-${papel} [data-fonte="${id}"]`); };
const modo = (pg) => pg.$eval('.cfg [data-modo][aria-pressed="true"]', (b) => b.dataset.modo).catch(() => null);

// ---------- contraste (WCAG) ----------
const CONTRASTE = `(() => {
  const parse = (s) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = s; const v = c.fillStyle; if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(1); const m = v.match(/[\\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
  const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const mistura = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
  const taxa = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const app = document.querySelector('.app'), cs = getComputedStyle(app);
  const cor = (n) => { const p = document.createElement('i'); p.style.color = 'var(' + n + ')'; app.appendChild(p); const r = parse(getComputedStyle(p).color); p.remove(); return r; };
  const card = cor('--card'), base = cor('--bgbase'), acc = cor('--acc'), ink = cor('--acc-ink'), txt = cor('--acc-text'), soft = cor('--acc-soft');
  const sobreCard = mistura(soft, card);
  return {
    botaoPrimario: taxa(ink, acc),
    textoDestaqueNoCard: taxa(txt, card), textoDestaqueNoFundo: taxa(txt, base),
    textoDestaqueNoSuave: taxa(txt, sobreCard),
    destaqueNoCard: taxa(acc, card), // elementos gráficos (contorno, foco): 3:1
  };
})()`;

// ================= 1) padrão atual preservado =================
{
  const { ctx, pg } = await novo();
  await ir(pg);
  ok((await modo(pg)) === 'sistema', 'sem escolha guardada o modo é Sistema (comportamento anterior)');
  ok(await pg.$eval('.app', (a) => !a.hasAttribute('data-paleta') && !a.hasAttribute('data-fundo') && a.dataset.reduzir === 'false'), 'padrão: sem paleta, sem fundo animado, movimento segue o aparelho');
  ok((await app(pg, '--esc')) === '0.85' && (await app(pg, '--icn')) === '20px' && (await app(pg, '--cardh')) === '340px', 'padrão: escala 0,85, ícone 20 px e card 340 px');
  ok((await app(pg, '--acc')).toLowerCase() === '#0071e3', 'padrão: destaque azul do Catalyst no claro');
  ok(await pg.$eval('.cfg button:has-text("Restaurar padrão")', (b) => b.disabled), 'Restaurar padrão fica desligado quando já está no padrão');
  ok(!!(await pg.$('#cfg-dias-t')) && !!(await pg.$('#cfg-data')) && !!(await pg.$('#cfg-desc')), 'o cadastro de Dias indisponíveis continua na página');
  ok((await pg.$$('.cfg .sw')).length === 11, 'destaques: o padrão e as dez paletas');
  ok((await pg.$$eval('.cfg [role="radiogroup"]', (s) => s.length)) === 3 && (await pg.$$('.fonte-op')).length === 20, 'três listas de fontes (9 principais, 6 secundárias e 5 mono, com o nome de cada família)');
  await ctx.close();
}

// ================= 2) modo Claro, Escuro e Sistema =================
{
  const { ctx, pg } = await novo('computador', { esquema: 'light' });
  await ir(pg);
  await pg.click('[data-modo="escuro"]');
  ok((await pg.$eval('.app', (a) => a.dataset.tema)) === 'escuro' && (await pg.evaluate(() => document.documentElement.dataset.tema)) === 'escuro', 'Escuro aplica na hora no aplicativo e na página');
  ok((await guardado(pg, 'dmanda-tema')) === '"escuro"', 'Escuro fica guardado na mesma chave de antes (dmanda-tema)');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.cfg'); await pg.waitForTimeout(400);
  ok((await modo(pg)) === 'escuro' && (await pg.$eval('.app', (a) => a.dataset.tema)) === 'escuro', 'Escuro sobrevive à recarga');
  await pg.click('[data-modo="claro"]');
  ok((await pg.$eval('.app', (a) => a.dataset.tema)) === 'claro' && (await guardado(pg, 'dmanda-tema')) === '"claro"', 'Claro aplica e guarda');
  await pg.click('[data-modo="sistema"]');
  ok((await guardado(pg, 'dmanda-tema')) === null, 'Sistema apaga a escolha fixa guardada');
  ok((await pg.$eval('.app', (a) => a.dataset.tema)) === 'claro', 'Sistema com o aparelho claro mostra claro');
  await pg.emulateMedia({ colorScheme: 'dark' }); await pg.waitForTimeout(300);
  ok((await pg.$eval('.app', (a) => a.dataset.tema)) === 'escuro' && (await modo(pg)) === 'sistema', 'Sistema acompanha o aparelho ao vivo (claro para escuro)');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.cfg'); await pg.waitForTimeout(400);
  ok((await modo(pg)) === 'sistema' && (await pg.$eval('.app', (a) => a.dataset.tema)) === 'escuro', 'Sistema sobrevive à recarga e segue o aparelho');
  await pg.emulateMedia({ colorScheme: 'light' }); await pg.waitForTimeout(300);
  ok((await pg.$eval('.app', (a) => a.dataset.tema)) === 'claro', 'Sistema volta ao claro quando o aparelho volta');
  // o botão da barra de cima continua alternando (vira escolha fixa)
  await pg.click('button[aria-label="Alternar tema claro e escuro"]');
  ok((await modo(pg)) === 'escuro' && (await guardado(pg, 'dmanda-tema')) === '"escuro"', 'o botão da barra alterna e passa a valer como escolha fixa');
  await ctx.close();
}
{ // escolha antiga preservada
  const { ctx, pg } = await novo('computador', { esquema: 'light', antes: () => { if (!localStorage.getItem('feito')) { localStorage.setItem('feito', '1'); localStorage.setItem('dmanda-tema', JSON.stringify('escuro')); } } });
  await ir(pg);
  ok((await modo(pg)) === 'escuro' && (await pg.$eval('.app', (a) => a.dataset.tema)) === 'escuro', 'quem já tinha "escuro" guardado continua em Escuro (aparelho claro)');
  await ctx.close();
}

// ================= 3) destaques =================
{
  const { ctx, pg } = await novo();
  await ir(pg);
  const antes = await app(pg, '--acc');
  await pg.click('.cfg .sw[data-paleta="7"]');
  const depois = await app(pg, '--acc');
    ok(depois !== antes && /^(hsl|rgb|#)/.test(depois) && (await pg.$eval('.app', (a) => a.dataset.paleta)) === '7', 'destaque Âmbar aplica na hora');
  ok((await pg.$eval('.cfg .sw[data-paleta="7"]', (b) => b.getAttribute('aria-pressed'))) === 'true', 'a amostra escolhida fica marcada');
  await pg.waitForTimeout(500); // o botão faz uma transição de cor
  const corBtn = await pg.$eval('.cfg .btn.pri', (b) => getComputedStyle(b).backgroundColor);
  ok(corBtn !== 'rgb(0, 113, 227)', 'o botão principal usa o destaque novo (' + corBtn + ')');
  ok((await apar(pg)).paleta === 7, 'destaque guardado');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.cfg'); await pg.waitForTimeout(400);
  ok((await pg.$eval('.app', (a) => a.dataset.paleta)) === '7', 'destaque sobrevive à recarga');
  await pg.goto(BASE + '/demandas'); await pg.waitForSelector('.app .main'); await pg.waitForTimeout(500);
  ok((await pg.$eval('.app', (a) => a.dataset.paleta)) === '7', 'destaque vale em outra tela');
  await pg.goto(BASE + '/config'); await pg.waitForSelector('.cfg');
  await pg.click('.cfg .sw[data-paleta="padrao"]');
  ok(!(await pg.$eval('.app', (a) => a.hasAttribute('data-paleta'))) && (await app(pg, '--acc')).toLowerCase() === '#0071e3', 'Padrão do Catalyst volta ao azul original');
  await pg.click('.cfg button:has-text("Surpreenda-me")');
  const s = await apar(pg);
  ok(s.paleta !== null && (await pg.$eval('.cfg button:has-text("Restaurar padrão")', (b) => !b.disabled)), 'Surpreenda-me escolhe destaque e conjunto de fontes');
  await ctx.close();
}

// ================= 4) fontes =================
{
  const { ctx, pg } = await novo();
  await ir(pg);
  const fam = (sel) => pg.$eval(sel, (e) => getComputedStyle(e).fontFamily);
  ok(/inter/i.test(await fam('.pagehead h1')) && /plex/i.test(await pg.$eval('.rng b', (e) => getComputedStyle(e).fontFamily)), 'padrão: Inter nos títulos e IBM Plex Mono nos detalhes');
  await escolher(pg, 'titulo', 'sora');
  ok(/sora/i.test(await fam('.pagehead h1')), 'título Sora aplica na hora (o h3 e o h4 seguem a fonte secundária, como no protótipo aprovado)');
  const carregou = await pg.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /sora/i.test(f.family) && f.status === 'loaded'); });
  ok(carregou, 'a fonte Sora foi de fato carregada pelo navegador');
  await escolher(pg, 'texto', 'dmsans'); await escolher(pg, 'mono', 'jetbrains');
  ok(/dm.?sans/i.test(await pg.$eval('.app', (e) => getComputedStyle(e).fontFamily)) && /jetbrains/i.test(await pg.$eval('.rng b', (e) => getComputedStyle(e).fontFamily)), 'texto DM Sans e mono JetBrains aplicam');
  await pg.click('.cfg [data-conjunto="4"]');
  ok(/dm.?serif/i.test(await fam('.pagehead h1')), 'o conjunto DM Serif, DM Sans e DM Mono aplica os três papéis');
  const a = await apar(pg); ok(a.titulo === 'dmserif' && a.texto === 'dmsans' && a.mono === 'dmmono', 'fontes guardadas');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.cfg'); await pg.waitForTimeout(500);
  ok(/dm.?serif/i.test(await fam('.pagehead h1')), 'fontes sobrevivem à recarga');
  // todas as fontes carregam sem erro
  for (const papel of ['titulo', 'texto', 'mono']) for (const v of await pg.$$eval(`#cfg-f-${papel} [data-fonte]`, (o) => o.map((x) => x.dataset.fonte))) await escolher(pg, papel, v);
  await pg.evaluate(async () => { await document.fonts.ready; });
  const falhou = await pg.evaluate(() => [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family));
  ok(falhou.length === 0, 'as 17 fontes escolhidas, uma a uma, sem erro de carregamento' + (falhou.length ? ': ' + falhou.join(', ') : ''));
  await ctx.close();
}

// ================= 5) tamanhos =================
const faixa = (pg, id, valor) => pg.$eval('#' + id, (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, valor);
{
  const { ctx, pg } = await novo();
  await ir(pg);
  const tam = () => pg.$eval('.pagehead p', (e) => parseFloat(getComputedStyle(e).fontSize));
  const t0 = await tam();
  await faixa(pg, 'cfg-t-texto', 125);
  ok((await app(pg, '--esc')) === '1.0625' && (await tam()) > t0 * 1.2, 'texto a 125% aplica na hora e aumenta o texto (' + t0 + ' para ' + (await tam()) + ' px)');
  ok((await pg.textContent('#cfg-t-texto-v')) === '125%', 'o valor ao lado da faixa acompanha');
  await faixa(pg, 'cfg-t-icone', 28);
  ok((await app(pg, '--icn')) === '28px' && (await pg.$eval('.navi .ic', (e) => e.getBoundingClientRect().width)) === 28, 'ícones a 28 px aplicam');
  await faixa(pg, 'cfg-t-card', 420);
  ok((await app(pg, '--cardh')) === '420px', 'altura dos cards a 420 px aplica');
  const prev = await pg.$eval('.previa-aparencia .assunto', (e) => parseFloat(getComputedStyle(e).fontSize));
  ok(prev > 17 * 0.85 * 1.2 && await pg.$eval('.previa-aparencia .previa-icones .ic', (e) => e.getBoundingClientRect().width) === 28 && Math.round(await pg.$eval('.previa-aparencia .dcard', (e) => e.getBoundingClientRect().height)) === 420, 'o card de prévia reflete texto, ícone e altura novos');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.cfg'); await pg.waitForTimeout(400);
  ok((await app(pg, '--esc')) === '1.0625' && (await app(pg, '--icn')) === '28px' && (await app(pg, '--cardh')) === '420px', 'tamanhos sobrevivem à recarga');
  // limites
  await faixa(pg, 'cfg-t-texto', 50);
  ok((await pg.$eval('#cfg-t-texto', (e) => [e.min, e.max])).join() === '100,125', 'a faixa do texto vai só de 100% a 125% (nunca abaixo do padrão: o piso de 10 px)');
  // menor texto possível (100%): nada abaixo do piso de 10 px
  await faixa(pg, 'cfg-t-texto', 100);
  const menor = await pg.evaluate(() => { let m = 99, onde = ''; for (const e of document.querySelectorAll('.app *')) { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).visibility === 'hidden') continue; const f = parseFloat(getComputedStyle(e).fontSize); if (f < m) { m = f; onde = e.className || e.tagName; } } return { m, onde }; });
  ok(menor.m >= 10, 'no mínimo (100%) o menor texto visível da tela tem ' + menor.m.toFixed(1) + ' px (' + menor.onde + ')');
  await pg.click('.cfg button:has-text("Restaurar tamanhos")');
  ok((await app(pg, '--esc')) === '0.85' && (await app(pg, '--icn')) === '20px' && (await app(pg, '--cardh')) === '340px', 'Restaurar tamanhos volta aos três padrões');
  await ctx.close();
}

// ================= 5b) prévias: fontes e card fictício =================
{
  const { ctx, pg } = await novo();
  await ir(pg);
  // --- Fontes: nome e amostra de cada família, com o mesmo texto por papel
  const op = await pg.$$eval('.fonte-op', (bs) => bs.map((b) => ({ papel: b.closest('[role="radiogroup"]').id, id: b.dataset.fonte, nome: b.querySelector('.fonte-nome').textContent, amostra: b.querySelector('.fonte-amostra').textContent, fNome: getComputedStyle(b.querySelector('.fonte-nome')).fontFamily, fAmostra: getComputedStyle(b.querySelector('.fonte-amostra')).fontFamily })));
  const por = (p) => op.filter((o) => o.papel === 'cfg-f-' + p);
  ok(por('titulo').length === 9 && por('texto').length === 6 && por('mono').length === 5, 'fontes: 9 + 6 + 5 famílias listadas');
  ok(['titulo', 'texto', 'mono'].every((p) => new Set(por(p).map((o) => o.amostra)).size === 1) && new Set(['titulo', 'texto', 'mono'].map((p) => por(p)[0].amostra)).size === 3, 'fontes: o mesmo texto compara as opções do mesmo papel e cada papel tem o seu');
  ok(op.every((o) => o.fAmostra === o.fNome && o.fNome.toLowerCase().includes(o.nome.split(' ')[0].toLowerCase().replace(/[^a-z]/g, ''))), 'fontes: nome e amostra de cada opção usam a própria família');
  ok(por('titulo')[0].amostra.includes('Ofício') && por('texto')[0].amostra.includes('responsável') && por('mono')[0].amostra.includes('4521/2026'), 'fontes: as amostras estão em português, com acentos, números e datas');
  const fam = (sel) => pg.$eval(sel, (e) => getComputedStyle(e).fontFamily);
  const rot = await pg.$$eval('.fonte-previa small', (e) => e.map((x) => x.textContent));
  ok(/Título · Inter/.test(rot[0]) && /Texto · Inter/.test(rot[1]) && /Detalhes · IBM Plex Mono/.test(rot[2]), 'prévia do conjunto: rótulos de título, texto e detalhes com o nome da família escolhida');
  await pg.click('.cfg [data-conjunto="4"]');
  const [ft, fx, fm] = [await fam('.fonte-previa .p-titulo'), await fam('.fonte-previa .p-texto'), await fam('.fonte-previa .p-mono')];
  ok(/dm.?serif/i.test(ft) && /dm.?sans/i.test(fx) && /dm.?mono/i.test(fm) && new Set([ft, fx, fm]).size === 3, 'prévia do conjunto: título, texto e detalhes aparecem em três fontes diferentes');
  ok((await pg.$$eval('.fonte-previa small', (e) => e.map((x) => x.textContent))).join('|') === 'Título · DM Serif Display|Texto · DM Sans|Detalhes · DM Mono', 'prévia do conjunto: os rótulos acompanham a escolha');
  ok((await pg.$eval('#cfg-f-titulo [data-fonte="dmserif"]', (b) => b.getAttribute('aria-checked'))) === 'true' && (await pg.$$eval('#cfg-f-titulo [aria-checked="true"]', (b) => b.length)) === 1, 'fontes: a opção escolhida fica marcada, uma só por lista');
  // teclado: setas mudam a escolha e levam o foco
  await pg.focus('#cfg-f-texto [data-fonte="dmsans"]'); await pg.keyboard.press('ArrowDown');
  ok((await pg.$eval('#cfg-f-texto [aria-checked="true"]', (b) => b.dataset.fonte)) === 'jakarta' && (await pg.evaluate(() => document.activeElement.dataset.fonte)) === 'jakarta', 'fontes: seta para baixo escolhe a próxima família e move o foco');
  ok((await pg.$$eval('.fonte-op[tabindex="0"]', (b) => b.length)) === 3, 'fontes: um só ponto de Tab por lista');

  // --- Card fictício único
  ok((await pg.$$('.previa-aparencia')).length === 1 && (await pg.$$('.previa-aparencia .dcard')).length === 1, 'prévia: um único card fictício na tela');
  ok(await pg.$eval('.previa-fundo', (e) => e.hasAttribute('inert')) && await pg.$eval('.previa-aparencia', (e) => e.getAttribute('role') === 'img'), 'prévia: não recebe foco nem clique (inert) e é anunciada como imagem');
  ok(await pg.$eval('.previa-aparencia', (e) => ['.dcard', '.face.front', '.cab', '.tags .tag', '.tags .chip', '.assunto', '.chips .pz', '.prox-t', '.prog .barra'].every((s) => !!e.querySelector(s))), 'prévia: usa as classes reais do card de demanda');
  await pg.click('.previa-aparencia .prox-t input', { force: true, timeout: 3000 }).catch(() => {});
  ok(!(await pg.$eval('.previa-aparencia .prox-t input', (i) => i.checked)), 'prévia: clicar nela não marca nada');
  // reflete modo, destaque, fontes, tamanhos e fundo
  const cor = (sel, prop) => pg.$eval(sel, (e, p) => getComputedStyle(e)[p], prop);
  const faceClaro = await cor('.previa-aparencia .face', 'backgroundColor');
  await pg.click('[data-modo="escuro"]'); await pg.waitForTimeout(400);
  const faceEscuro = await cor('.previa-aparencia .face', 'backgroundColor');
  ok(faceClaro !== faceEscuro && (await cor('.previa-fundo', 'backgroundColor')) === (await cor('.app', 'backgroundColor')), 'prévia: acompanha o modo (card e fundo trocam de claro para escuro)');
  const barraAntes = await cor('.previa-aparencia .barra i', 'backgroundColor');
  await pg.click('.cfg .sw[data-paleta="7"]'); await pg.waitForTimeout(500);
  const barraDepois = await cor('.previa-aparencia .barra i', 'backgroundColor');
  ok(barraAntes !== barraDepois, 'prévia: acompanha o destaque (barra de progresso ' + barraAntes + ' para ' + barraDepois + ')');
  await escolher(pg, 'texto', 'nunito'); await escolher(pg, 'mono', 'fira'); await escolher(pg, 'titulo', 'playfair');
  ok(/playfair/i.test(await fam('.previa-aparencia .assunto')) && /nunito/i.test(await fam('.previa-aparencia .prox-c .t-txt')) && /fira/i.test(await fam('.previa-aparencia .num')), 'prévia: o título do card usa a fonte principal, o texto a secundária e os números a mono');
  await pg.click('.cfg [data-fundo="animado"]');
  const anim = () => pg.$eval('.previa-fundo', (e) => getComputedStyle(e, '::before').animationName);
  ok((await anim()) === 'fundo-deriva', 'prévia: acompanha o fundo animado');
  await pg.click('.cfg [data-movimento]'); ok((await anim()) === 'none', 'prévia: o fundo animado para com Reduzir movimento');
  await pg.click('.cfg [data-fundo="padrao"]'); ok((await anim()) === 'none' && (await pg.$eval('.previa-fundo', (e) => getComputedStyle(e, '::before').content)) === 'none', 'prévia: no fundo padrão não há gradiente');
  // altura e tamanhos
  await pg.click('.cfg-cab button:has-text("Restaurar padrão")');
  ok(Math.round(await pg.$eval('.previa-aparencia .dcard', (e) => e.getBoundingClientRect().height)) === 340 && /inter/i.test(await fam('.previa-aparencia .assunto')) && /plex/i.test(await fam('.previa-aparencia .num')), 'prévia: Restaurar padrão devolve o card ao padrão');
  ok(await pg.$eval('.previa-aparencia .face', (f) => f.scrollHeight <= f.clientHeight + 1 && f.scrollWidth <= f.clientWidth + 1), 'prévia: o conteúdo do card cabe no card padrão');
  await faixa(pg, 'cfg-t-texto', 125);
  ok(await pg.$eval('.previa-aparencia .face', (f) => f.scrollHeight <= f.clientHeight + 1 && f.scrollWidth <= f.clientWidth + 1), 'prévia: o conteúdo do card cabe com o texto a 125% (altura padrão)');
  await ctx.close();
}

// ================= 6) fundo animado e movimento =================
{
  const { ctx, pg } = await novo();
  await ir(pg);
  const anim = () => pg.evaluate(() => { const b = document.querySelector('.bg'); const c = getComputedStyle(b, '::before'); return { display: getComputedStyle(b).display, nome: c.animationName, estado: c.animationPlayState }; });
  let r = await anim();
  ok(r.display === 'none', 'padrão: sem camada de fundo (aparência atual)');
  await pg.click('.cfg [data-fundo="animado"]');
  r = await anim();
  ok(r.display === 'block' && r.nome === 'fundo-deriva' && r.estado === 'running', 'Gradiente animado liga a camada e a animação');
  const p1 = await pg.$eval('.bg', (b) => getComputedStyle(b, '::before').transform);
  await pg.waitForTimeout(1500);
  const p2 = await pg.$eval('.bg', (b) => getComputedStyle(b, '::before').transform);
  ok(p1 !== p2 && p1 !== 'none', 'o gradiente realmente se move');
  ok(await pg.$eval('.main', (m) => { const r = m.getBoundingClientRect(); const e = document.elementFromPoint(r.x + 40, r.y + r.height - 40); return !!e && !e.closest('.bg'); }), 'o fundo não captura cliques');
  await pg.click('.cfg [data-movimento]');
  r = await anim();
  ok(r.nome === 'none', 'Reduzir movimento ligado para a animação');
  ok((await apar(pg)).fundo === 'animado' && (await apar(pg)).movimento === 'reduzido', 'fundo e movimento guardados');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.cfg'); await pg.waitForTimeout(400);
  r = await anim(); ok(r.display === 'block' && r.nome === 'none', 'depois da recarga: fundo animado continua, parado');
  await pg.click('.cfg [data-movimento]'); r = await anim(); ok(r.nome === 'fundo-deriva', 'desligar Reduzir movimento retoma');
  await ctx.close();
}
{ // preferência do sistema
  const { ctx, pg } = await novo('computador', { movimento: 'reduce', antes: () => { if (!localStorage.getItem('feito')) { localStorage.setItem('feito', '1'); localStorage.setItem('dmanda:aparencia', JSON.stringify({ fundo: 'animado' })); } } });
  await ir(pg);
  const nome = await pg.evaluate(() => getComputedStyle(document.querySelector('.bg'), '::before').animationName);
  ok(nome === 'none' && (await pg.$eval('.app', (a) => a.dataset.fundo)) === 'animado', 'com "reduzir movimento" do aparelho o gradiente fica parado, sem o usuário mexer em nada');
  await ctx.close();
}

// ================= 7) restaurar padrão =================
{
  const { ctx, pg } = await novo();
  await ir(pg);
  await pg.click('[data-modo="escuro"]');
  await pg.click('.cfg .sw[data-paleta="3"]'); await escolher(pg, 'titulo', 'fraunces'); await faixa(pg, 'cfg-t-texto', 110); await faixa(pg, 'cfg-t-icone', 24); await faixa(pg, 'cfg-t-card', 380);
  await pg.click('.cfg [data-fundo="animado"]'); await pg.click('.cfg [data-movimento]');
  await pg.click('.cfg-cab button:has-text("Restaurar padrão")');
  const a = await apar(pg);
  ok(a.paleta === null && a.titulo === 'inter' && a.texto === 'inter' && a.mono === 'plex' && a.textoPct === 100 && a.icone === 20 && a.card === 340 && a.fundo === 'padrao' && a.movimento === 'sistema', 'Restaurar padrão volta todas as escolhas de aparência (guardado)');
  ok((await app(pg, '--esc')) === '0.85' && (await app(pg, '--cardh')) === '340px' && !(await pg.$eval('.app', (e) => e.hasAttribute('data-paleta') || e.hasAttribute('data-fundo'))), 'e a tela volta na hora');
  ok((await modo(pg)) === 'escuro', 'o modo escolhido não é desfeito pela restauração');
  ok(await pg.$eval('.cfg-cab button:has-text("Restaurar padrão")', (b) => b.disabled), 'o botão se desliga de novo');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.cfg'); await pg.waitForTimeout(400);
  ok((await app(pg, '--esc')) === '0.85' && !(await pg.$eval('.app', (e) => e.hasAttribute('data-paleta'))), 'o padrão sobrevive à recarga');
  await ctx.close();
}

// ================= 8) armazenamento corrompido =================
for (const [rotulo, bruto] of [['texto solto', 'lixo{{'], ['valores absurdos', JSON.stringify({ textoPct: 9999, icone: -4, card: 'x', titulo: 'inexistente', texto: 7, mono: null, paleta: 99, fundo: 'piscante', movimento: 3 })], ['lista', '[1,2,3]'], ['parcial válida', JSON.stringify({ paleta: 2, textoPct: 120, titulo: 'nao-existe' })]]) {
  const { ctx, pg } = await novo('computador', { arg: bruto, antes: (b) => { if (!localStorage.getItem('feito')) { localStorage.setItem('feito', '1'); localStorage.setItem('dmanda:aparencia', b); } } });
  await ir(pg);
  const esc = await app(pg, '--esc');
  const aberto = !!(await pg.$('.cfg')) && /^[\d.]+$/.test(esc);
  ok(aberto, 'armazenamento ' + rotulo + ': a página abre e usa valores válidos (--esc ' + esc + ')');
  if (rotulo === 'valores absurdos') ok(esc === '0.85' || esc === '1.0625', 'valores absurdos são limitados ou voltam ao padrão (--esc ' + esc + ')');
  if (rotulo === 'parcial válida') ok((await pg.$eval('.app', (a) => a.dataset.paleta)) === '2' && esc === '1.02', 'o que é válido é aproveitado e o resto volta ao padrão');
  await ctx.close();
}

// ================= 9) contraste das dez paletas, nos dois modos =================
{
  const { ctx, pg } = await novo();
  await ir(pg);
  for (const m of ['claro', 'escuro']) {
    await pg.click(`[data-modo="${m}"]`);
    const rs = [];
    for (const p of ['padrao', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      await pg.click(`.cfg .sw[data-paleta="${p}"]`);
      rs.push([p, await pg.evaluate(CONTRASTE)]);
    }
    const ruins = rs.filter(([, c]) => c.botaoPrimario < 4.5 || c.textoDestaqueNoCard < 4.5 || c.textoDestaqueNoFundo < 4.5 || c.textoDestaqueNoSuave < 4.5);
    ok(ruins.length === 0, `${m}: texto do botão principal e texto de destaque a 4,5:1 ou mais nas 11 opções` + (ruins.length ? ' | abaixo: ' + ruins.map(([p, c]) => `${p} btn ${c.botaoPrimario.toFixed(2)} card ${c.textoDestaqueNoCard.toFixed(2)} fundo ${c.textoDestaqueNoFundo.toFixed(2)} suave ${c.textoDestaqueNoSuave.toFixed(2)}`).join('; ') : ''));
    const graf = rs.filter(([, c]) => c.destaqueNoCard < 3);
    ok(graf.length === 0, `${m}: destaque como contorno/foco a 3:1 ou mais sobre o card` + (graf.length ? ' | abaixo: ' + graf.map(([p, c]) => `${p} ${c.destaqueNoCard.toFixed(2)}`).join('; ') : ''));
  }
  // texto sobre o fundo animado
  await pg.click('[data-modo="claro"]'); await pg.click('.cfg .sw[data-paleta="7"]'); await pg.click('.cfg [data-fundo="animado"]');
  const cabecalho = await pg.evaluate(() => { const p = document.querySelector('.pagehead h1'); const r = p.getBoundingClientRect(); return { cor: getComputedStyle(p).color, fundo: getComputedStyle(document.querySelector('.app')).backgroundColor, ok: r.width > 0 }; });
  ok(cabecalho.ok, 'o título continua visível sobre o fundo animado');
  await ctx.close();
}

// ================= 10) layout e alvos de toque em computador, iPad e celular =================
for (const perfil of ['computador', 'ipad', 'celular']) {
  for (const m of ['claro', 'escuro']) {
    const { ctx, pg } = await novo(perfil, { esquema: m === 'escuro' ? 'dark' : 'light' });
    await ir(pg);
    await pg.click(`[data-modo="${m}"]`);
    const g = await pg.evaluate(() => {
      const de = document.documentElement, main = document.querySelector('.main');
      const sec = [...document.querySelectorAll('.cfg > section, .cfg > p')].map((s) => { const r = s.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, c: s.className, id: s.querySelector('h3')?.id }; });
      const filhos = [...document.querySelectorAll('.cfg *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('[aria-hidden="true"]'); }).map((e) => e.className || e.tagName).slice(0, 5);
      return { rolagemH: de.scrollWidth - innerWidth, mainH: main.scrollWidth - main.clientWidth, sec, filhos, vw: innerWidth };
    });
    ok(g.rolagemH <= 0 && g.mainH <= 0, `${perfil}/${m}: sem rolagem horizontal`);
    ok(g.filhos.length === 0, `${perfil}/${m}: nenhum controle passa da largura da tela` + (g.filhos.length ? ': ' + g.filhos.join(', ') : ''));
    ok(g.sec.every((s) => s.l >= -1 && s.r <= g.vw + 1), `${perfil}/${m}: todos os painéis cabem na largura`);
    const pos = await pg.evaluate(() => { const a = document.querySelector('.previa-aparencia').getBoundingClientRect(), c = document.querySelector('.apar-controles').getBoundingClientRect(); return { pl: a.left, pt: a.top, pr: a.right, cr: c.right, ct: c.top, w: a.width }; });
    ok(perfil === 'celular' ? pos.pt < pos.ct : perfil === 'computador' ? pos.pl >= pos.cr - 1 : (pos.pl >= pos.cr - 1 || pos.pt < pos.ct), `${perfil}/${m}: a prévia do card fica ${perfil === 'celular' ? 'acima dos controles' : perfil === 'computador' ? 'ao lado dos controles' : 'ao lado ou acima dos controles, sem cobri-los'}`);
    ok(pos.pr <= g.vw + 1 && pos.w >= 240, `${perfil}/${m}: a prévia cabe na tela (${Math.round(pos.w)} px de largura)`);
    if (m === 'claro') {
      const colunas = new Set(g.sec.filter((s) => s.c.includes('painel') && !s.c.includes('cfg-topo')).map((s) => Math.round(s.l / 10))).size;
      ok(perfil === 'computador' ? colunas >= 2 : perfil === 'celular' ? colunas === 1 : colunas >= 1, `${perfil}: painéis em ${colunas} coluna(s)`);
      const toque = perfil !== 'computador';
      // botões .btn têm 32 px visíveis e área de toque de 44 px por um ::after (regra do app, v5.css); os demais controles têm 44 px reais
      const pequenos = await pg.evaluate((toque) => [...document.querySelectorAll('.cfg button, .cfg select, .cfg input:not([type=hidden])')].filter((e) => !e.closest('[aria-hidden="true"]')).map((e) => ({ r: e.getBoundingClientRect(), t: (e.getAttribute('aria-label') || e.textContent || e.id).trim().slice(0, 28), c: e.className })).filter(({ r, c }) => r.width && r.height < (toque && !/\bbtn\b/.test(c) ? 43.5 : 31.5)).map(({ t, r, c }) => `${t} ${Math.round(r.height)}px [${c}]`), toque);
      ok(pequenos.length === 0, `${perfil}: alvos de ${toque ? '44' : '32'} px ou mais em todos os controles de Configurações` + (pequenos.length ? ': ' + pequenos.slice(0, 8).join('; ') : ''));
    }
    if (m === 'claro' && perfil !== 'computador') {
      // a área de toque de um botão pequeno chega a 44 px: tocar 6 px abaixo da borda ainda acerta o botão
      const acerta = await pg.evaluate(() => { const b = document.querySelector('.cfg-cab .btn.mini'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.bottom + 5); return !!e && !!e.closest('.btn'); });
      ok(acerta, `${perfil}: o botão pequeno tem área de toque de 44 px (toque abaixo da borda acerta)`);
    }
    // com tamanhos no máximo nada quebra
    await faixa(pg, 'cfg-t-texto', 125); await faixa(pg, 'cfg-t-icone', 28); await pg.waitForTimeout(200);
    const g2 = await pg.evaluate(() => ({ h: document.documentElement.scrollWidth - innerWidth, m: document.querySelector('.main').scrollWidth - document.querySelector('.main').clientWidth }));
    ok(g2.h <= 0 && g2.m <= 0, `${perfil}/${m}: com texto a 125% e ícones a 28 px continua sem rolagem horizontal`);
    if (m === 'claro') await pg.screenshot({ path: `.dados-teste/config-${perfil}.png` });
    await ctx.close();
  }
}

// ================= 11) cards nos limites de altura e no menor/maior texto =================
{
  const { ctx, pg } = await novo();
  await ir(pg, '/demandas');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'Resposta ao ofício da Secretaria de Obras sobre a reforma do prédio da Prefeitura'); await pg.fill('#n-descricao', 'Descrição longa '.repeat(30));
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 20000 });
  await pg.waitForSelector('.cards .dcard');
  for (const [c, t] of [[300, 125], [420, 100], [340, 100]]) {
    await pg.evaluate(([c, t]) => localStorage.setItem('dmanda:aparencia', JSON.stringify({ card: c, textoPct: t })), [c, t]);
    await pg.goto(BASE + '/demandas'); await pg.waitForSelector('.cards .dcard'); await pg.waitForTimeout(500);
    const r = await pg.evaluate(() => { const d = document.querySelector('.cards .dcard'); const pesos = [...d.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)); const tit = d.querySelector('h3, .titulo, .assunto'); return { h: Math.round(d.getBoundingClientRect().height), rolagem: pesos.length, tit: !!tit && tit.getBoundingClientRect().height > 0 }; });
    ok(Math.abs(r.h - c) <= 1 && r.rolagem === 0 && r.tit, `card a ${c} px com texto a ${t}%: altura certa, sem barra de rolagem e com título visível (${r.h} px)`);
  }
  await ctx.close();
}

// ================= 12) Dias indisponíveis intactos =================
{
  const { ctx, pg } = await novo();
  await ir(pg);
  await pg.fill('#cfg-data', '2026-12-25'); await pg.fill('#cfg-desc', 'Natal (teste)');
  await pg.click('button:has-text("Cadastrar dia")'); await pg.waitForSelector('.cfg-lista li', { timeout: 20000 });
  ok((await pg.textContent('.cfg-lista li')).includes('Natal (teste)'), 'Dias indisponíveis: cadastrar continua funcionando junto da aparência');
  await pg.click('button[aria-label="Editar Natal (teste)"]'); await pg.fill('#cfg-desc', 'Natal editado'); await pg.click('button:has-text("Salvar alteração")');
  await pg.waitForFunction(() => document.querySelector('.cfg-lista li')?.textContent.includes('Natal editado'), null, { timeout: 15000 });
  ok(true, 'Dias indisponíveis: editar continua funcionando');
  await pg.click('button[aria-label="Excluir Natal editado"]'); await pg.click('button:has-text("Confirmar exclusão")');
  await pg.waitForFunction(() => !document.querySelector('.cfg-lista'), null, { timeout: 15000 });
  ok(true, 'Dias indisponíveis: excluir continua funcionando');
  await ctx.close();
}

ok(erros.length === 0, 'nenhum erro de página nem de console durante toda a execução' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 5).join(' | ') : ''));
await nav.close();
console.log(`\n${total - falhas} de ${total} verificações aprovadas.`);
parar();
process.exit(falhas ? 1 : 0);
