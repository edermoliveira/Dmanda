// Etapa 2 (16/11/2026): correções de interface dos cards no Início. No Edge e, quando existe, no WebKit emulado do Playwright, com banco de TESTE descartável (PGlite), servidor na porta 7126.
//  1) o card ativo da pilha do celular mantém largura e altura (um ou vários cards, texto curto ou longo, navegação, arrasto, verso) e a página não salta;
//  2) as três ações do deck na mesma faixa (Passar para o fim, lápis e Abrir, Avançar etapa), em 390, 320 e com texto a 125%;
//  3) o cabeçalho do Para hoje em uma linha, o botão de informação e o texto exato da ajuda;
//  4) a Nova urgência em cards lado a lado com rolagem horizontal própria na web e no iPad, na ordem do ranking, e o baralho no iPhone.
// Claro e Escuro nas capturas e nos contrastes. Não é aparelho real: o Safari do iPhone/iPad continua sendo a conferência final. Nunca toca o Supabase real.
// Uso: node scripts/testar-cards-inicio.mjs
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_CARDS_INICIO || '7126', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/cards-inicio', CAPTURAS = '.dados-teste/cards-inicio-capturas';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const PH = '[data-painel="para-hoje"]', PILHA = `${PH} > .ph-pilha`, ARRASTO = `${PILHA} .ph-arrasto`;

// ---------- dados: quatro vagas (texto curto, longo, curto e curto) e cinco urgências fora delas, criadas fora de ordem (a etapa 3 passou o Para hoje a quatro vagas) ----------
const LONGO = 'Contratação emergencial de empresa especializada para manutenção preventiva e corretiva dos equipamentos de climatização de todos os prédios públicos municipais';
const ESPERADA = ['U10', 'U6 longa', 'U3', 'U1 longa', 'Uhoje'];   // atrasadas da mais antiga para a mais nova, depois a que vence hoje
let HOJE;
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const mk = async (assunto, o, textos = ['t1']) => { const d = await c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: '', ...o } }); for (const t of textos) await c('adicionar_tarefa', { p_demanda: d.id, p_texto: t }); return d; };
  const ids = [];
  const A = await mk('Curta', { prazo_original: HOJE }, ['a1']); await c('mover_etapa', { p_id: A.id, p_etapa: 'Cadastro' }); ids.push(A.id);
  ids.push((await mk(LONGO, { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -2), descricao: LONGO + '. ' + LONGO }, ['uma tarefa com texto bem comprido para forçar a quebra de linha dentro do card ativo', 'dois', 'três', 'quatro', 'cinco', 'seis'])).id);
  ids.push((await mk('Eco', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, 1) })).id);
  ids.push((await mk('Quarta', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, 3) })).id);
  await mk('U3', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -3) });
  await mk('Uhoje', { etapa: 'Fazendo', prazo_original: HOJE });
  await mk('U10', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -10) });
  await mk('U1 longa ' + LONGO, { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -1) });
  await mk('U6 longa ' + LONGO, { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -6) });
  for (const [i, id] of ids.entries()) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, id]);
  await db.close();
}

let servidor = null;
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/'); if (r.status < 500) break; } catch { /* subindo */ } await esperar(2000); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const wk = await webkit.launch().catch((e) => { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); return null; });
const erros = [];
const PERFIS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  estreito: { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};
const abrir = async (perfil, { motor = nav, tema = 'claro', texto = 100, extra = {} } = {}) => {
  const ctx = await motor.newContext({ ...PERFIS[perfil], ...extra });
  await ctx.addInitScript(([t, p]) => { if (!localStorage.getItem('feito')) { localStorage.setItem('feito', '1'); localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:aparencia', JSON.stringify({ textoPct: p })); } }, [tema, texto]);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  await pg.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
  await pg.waitForSelector(`${PH} .vaga`, { timeout: 120000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 4000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await esperar(700);
  return { ctx, pg };
};
const R = (pg, sel) => pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; });
/** Tamanho de layout (não afetado por transform) do card ativo da pilha. */
const tam = (pg, sel = ARRASTO) => pg.$eval(`${sel} .dcard`, (e) => ({ w: e.offsetWidth, h: e.offsetHeight, titulo: e.querySelector('.assunto')?.textContent.trim().slice(0, 12) }));
const luz = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const cor = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/** Toque pelo protocolo do navegador: começa, anda e (opcionalmente) solta. */
const toque = async (pg, x1, y1, x2, y2, { soltar = true, passos = 10 } = {}) => {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
  for (let i = 1; i <= passos; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + ((x2 - x1) * i) / passos, y: y1 + ((y2 - y1) * i) / passos }] });
  if (soltar) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); await esperar(450); }
  return cdp;
};

// =============== 1) o card ativo mantém o tamanho (celular, Edge e WebKit emulado) ===============
for (const [motor, navegador, extra] of [['Edge', nav, {}], ...(wk ? [['WebKit emulado', wk, { ...devices['iPhone 13'] }]] : [])]) {
  const { ctx, pg } = await abrir('celular', { motor: navegador, extra });
  const secao = await R(pg, PH), pil = await R(pg, PILHA), base = await tam(pg);
  ok(Math.abs(pil.w - secao.w) <= 1 && base.w >= pil.w - 1, `${motor}: a pilha ocupa a largura da seção (${Math.round(pil.w)} de ${Math.round(secao.w)} px) e o card ativo tem ${base.w}x${base.h} px`);
  const medidas = [['inicial', base]];
  const y0 = await pg.evaluate(() => scrollY);
  for (let i = 1; i <= 4; i++) { await pg.click(`${PILHA} [data-pilha-passar]`); await esperar(650); medidas.push([`depois de passar ${i}`, await tam(pg)]); }
  const caixa = await R(pg, ARRASTO), x = caixa.x + caixa.w / 2, y = caixa.y + caixa.h * 0.45;
  if (motor === 'Edge') {
    await toque(pg, x, y, x - 50, y);                                     // gesto curto: o card volta
    medidas.push(['depois de um gesto curto', await tam(pg)]);
    const cdp = await toque(pg, x + 40, y, x - 70, y, { soltar: false }); await esperar(120);   // no meio do arrasto
    medidas.push(['durante o arrasto', await tam(pg)]);
    const rev = await pg.$eval(`${PILHA} .ph-atras[data-face] .vaga`, (e) => Number(getComputedStyle(e).opacity));
    ok(rev > 0, `${motor}: durante o arrasto a camada de fundo revela o próximo card (opacidade ${rev.toFixed(2)})`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); await esperar(600);
    medidas.push(['depois do gesto longo', await tam(pg)]);
    const cab = await R(pg, `${ARRASTO} .face.front .cab`);
    await pg.touchscreen.tap(cab.x + 12, cab.y + cab.h / 2); await esperar(800);
    medidas.push(['com o card virado', await tam(pg)]);
    await pg.touchscreen.tap(cab.x + 12, cab.y + cab.h / 2); await esperar(800);
    medidas.push(['de volta à frente', await tam(pg)]);
  }
  const d0 = medidas[0][1];
  const quebrou = medidas.filter(([, m]) => m.w !== d0.w || m.h !== d0.h);
  ok(quebrou.length === 0, `${motor}: o card ativo mantém ${d0.w}x${d0.h} px em ${medidas.length} momentos (curto, longo, navegação, arrasto e verso)${quebrou.length ? ': ' + quebrou.map(([r, m]) => `${r} ${m.w}x${m.h}`).join('; ') : ''}`);
  ok((await pg.evaluate(() => scrollY)) === y0, `${motor}: a página não saltou durante as trocas`);
  const nu = await tam(pg, `[data-nova-urgencia] .ph-arrasto`).catch(() => null);
  await ctx.close();
  if (nu) ok(nu.w === d0.w && nu.h === d0.h, `${motor}: o baralho da Nova urgência no iPhone tem o mesmo tamanho (${nu.w}x${nu.h} px)`);
  else ok(true, `${motor}: sem baralho de Nova urgência para medir nesta página`);
}

// =============== 2) as três ações do deck na mesma faixa ===============
for (const [rot, perfil, texto] of [['390 px', 'celular', 100], ['320 px', 'estreito', 100], ['390 px com texto a 125%', 'celular', 125], ['320 px com texto a 125%', 'estreito', 125]]) {
  const { ctx, pg } = await abrir(perfil, { texto });
  const B = `${PILHA} .ph-botoes`;
  const caixas = await pg.$$eval(`${B} .btn`, (l) => l.map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, sw: e.scrollWidth, cw: e.clientWidth }; }));
  const faixa = await R(pg, B), pil = await R(pg, PILHA);
  ok(caixas.length === 3 && caixas[0].t === 'Passar para o fim' && caixas[1].t === 'Abrir' && caixas[2].t === 'Avançar etapa', `${rot}: as três ações na ordem Passar para o fim, Abrir e Avançar etapa (${caixas.map((c) => c.t).join(' | ')})`);
  const mesmaFaixa = caixas.every((c) => c.y < faixa.b && c.b > faixa.y) && caixas[0].r <= caixas[1].x + 0.5 && caixas[1].r <= caixas[2].x + 0.5;
  ok(mesmaFaixa, `${rot}: as três na mesma faixa, uma ao lado da outra, sem sobrepor`);
  ok(caixas[0].x >= pil.x - 0.5 && caixas[2].r <= pil.r + 0.5 && caixas.every((c) => c.sw <= c.cw + 1), `${rot}: nada passa da borda da pilha nem do próprio botão`);
  ok((await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)), `${rot}: a página não ganha rolagem horizontal`);
  ok(caixas.every((c) => c.h >= 32), `${rot}: altura mínima de botão (${caixas.map((c) => Math.round(c.h)).join(', ')} px)`);
  const centro = (c) => c.x + c.w / 2;
  ok(centro(caixas[0]) < centro(caixas[1]) && centro(caixas[1]) < centro(caixas[2]) && Math.abs(centro(caixas[1]) - (pil.x + pil.w / 2)) < pil.w * 0.12, `${rot}: "Abrir" fica no centro da faixa`);
  ok((await pg.$eval(`${B} [data-pilha-abrir] svg`, (e) => !!e)) && (await pg.$eval(`${B} [data-pilha-abrir]`, (e) => e.getAttribute('aria-label'))) === 'Abrir a demanda', `${rot}: lápis e "Abrir" com nome acessível "Abrir a demanda"`);
  if (rot === '390 px') {
    ok((await pg.$eval(`${B} [data-pilha-avancar]`, (e) => e.getAttribute('aria-label'))) === 'Avançar etapa: para Vistos', 'o botão da direita diz o destino no nome acessível (Cadastro: para Vistos)');
    // teclado: Tab chega às três ações na ordem e Enter em Abrir abre a demanda
    await pg.focus(`${B} [data-pilha-passar]`); await pg.keyboard.press('Tab');
    ok(await pg.evaluate(() => document.activeElement?.hasAttribute('data-pilha-abrir')), 'teclado: Tab vai de "Passar para o fim" para "Abrir"');
    await pg.keyboard.press('Tab');
    ok(await pg.evaluate(() => document.activeElement?.hasAttribute('data-pilha-avancar')), 'teclado: Tab vai de "Abrir" para "Avançar etapa"');
    await pg.focus(`${B} [data-pilha-abrir]`); await pg.keyboard.press('Enter');
    ok(await pg.waitForSelector('.modal-ov .modal', { timeout: 4000 }).then(() => true, () => false), 'teclado: Enter em "Abrir" abre a demanda');
    await pg.keyboard.press('Escape'); await esperar(500);
    await pg.screenshot({ path: `${CAPTURAS}/celular-acoes-claro.png` });
  }
  await ctx.close();
}
{
  const { ctx, pg } = await abrir('celular', { tema: 'escuro' });
  await pg.screenshot({ path: `${CAPTURAS}/celular-acoes-escuro.png` });
  // cor efetiva do fundo: compõe cada camada translúcida sobre a primeira opaca acima dela
  const c = await pg.$eval(`${PILHA} [data-pilha-passar]`, (e) => {
    const num = (t) => (t.match(/[\d.]+/g) ?? []).map(Number), camadas = [];
    for (let f = e; f; f = f.parentElement) { const v = num(getComputedStyle(f).backgroundColor); if (v.length >= 3 && (v[3] ?? 1) > 0) { camadas.push(v); if ((v[3] ?? 1) >= 1) break; } }
    let base = [255, 255, 255]; for (const v of camadas.reverse()) { const a = v[3] ?? 1; base = base.map((x, i) => Math.round(v[i] * a + x * (1 - a))); }
    return { c: getComputedStyle(e).color, f: `rgb(${base.join(', ')})` };
  });
  ok(contraste(cor(c.c), cor(c.f)) >= 3, `Escuro: o texto "Passar para o fim" tem contraste ${contraste(cor(c.c), cor(c.f)).toFixed(1)}:1 sobre o fundo (${c.c} em ${c.f})`);
  await ctx.close();
}

// =============== 3) cabeçalho do Para hoje e ajuda ===============
for (const [rot, perfil, tema] of [['computador Claro', 'desktop', 'claro'], ['computador Escuro', 'desktop', 'escuro'], ['iPad', 'ipad', 'claro'], ['iPhone', 'celular', 'claro'], ['iPhone Escuro', 'celular', 'escuro'], ['320 px a 125%', 'estreito', 'claro']]) {
  const { ctx, pg } = await abrir(perfil, { tema, texto: perfil === 'estreito' ? 125 : 100 });
  const h = await pg.$eval(`${PH} > h3`, (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(), lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.35; return { texto: e.textContent.trim(), alt: r.height, lh, filhos: e.children.length }; });
  ok(h.texto === 'Para hoje' && h.alt <= h.lh * 1.6 && !(await pg.$(`${PH} > h3 small`)), `${rot}: "Para hoje" em uma linha, sem o texto "até N demandas..." (${Math.round(h.alt)} px de altura)`);
  const bt = await R(pg, `${PH} > h3 .ajuda-b`), rotulo = await pg.$eval(`${PH} > h3 .ajuda-b`, (e) => e.getAttribute('aria-label'));
  const tit = await R(pg, `${PH} #ph-t`);
  ok(rotulo === 'Sobre o Para hoje' && bt.x >= tit.r - 2 && Math.abs((bt.y + bt.h / 2) - (tit.y + tit.h / 2)) < 8, `${rot}: o botão de informação (nome acessível "${rotulo}") fica ao lado do título`);
  const alvo = await pg.$eval(`${PH} > h3 .ajuda-b`, (e) => { const a = getComputedStyle(e, '::after'); const r = e.getBoundingClientRect(); return { w: r.width + 2 * Math.abs(parseFloat(a.left) || 10), h: r.height + 2 * Math.abs(parseFloat(a.top) || 10) }; });
  ok(alvo.w >= 44 && alvo.h >= 44, `${rot}: área de toque do botão de informação de 44 px (${alvo.w}x${alvo.h})`);
  if (perfil === 'desktop' || perfil === 'celular' || perfil === 'estreito') {
    if (perfil === 'desktop') { await pg.focus(`${PH} > h3 .ajuda-b`); await pg.keyboard.press('Enter'); } else await pg.locator(`${PH} > h3 .ajuda-b`).tap();
    await pg.waitForSelector(`${PH} > h3 .ajuda-balao`, { timeout: 3000 }).catch(() => {});
    const bal = await pg.$eval(`${PH} > h3 .ajuda-balao`, (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { t: e.textContent, x: r.x, r: r.right, c: s.color, f: s.backgroundColor, role: e.getAttribute('role') }; }).catch(() => null);
    ok(bal?.t === 'Demandas para focar hoje, as prioridades do dia' && bal.role === 'note', `${rot}: a ajuda mostra exatamente "Demandas para focar hoje, as prioridades do dia" (${bal ? bal.t : 'balão não abriu'})`);
    if (bal) {
      const vw = PERFIS[perfil].viewport.width;
      ok(bal.x >= 0 && bal.r <= vw, `${rot}: o balão cabe na tela (${Math.round(bal.x)} a ${Math.round(bal.r)} de ${vw} px)`);
      ok(contraste(cor(bal.c), cor(bal.f)) >= 4.5, `${rot}: texto do balão com contraste ${contraste(cor(bal.c), cor(bal.f)).toFixed(1)}:1 (mínimo 4,5)`);
    }
    await pg.screenshot({ path: `${CAPTURAS}/${perfil}-${tema}-ajuda.png` });
    if (perfil === 'desktop') {
      await pg.keyboard.press('Escape'); await esperar(200);
      ok(!(await pg.$(`${PH} > h3 .ajuda-balao`)) && (await pg.evaluate(() => document.activeElement?.classList.contains('ajuda-b'))), `${rot}: Esc fecha o balão e devolve o foco ao botão`);
      const foco = await pg.$eval(`${PH} > h3 .ajuda-b`, (e) => getComputedStyle(e).outlineStyle !== 'none' && parseFloat(getComputedStyle(e).outlineWidth) >= 2);
      ok(foco, `${rot}: o foco do teclado no botão é visível`);
    }
  } else await pg.screenshot({ path: `${CAPTURAS}/${perfil}-${tema}-cabecalho.png` });
  await ctx.close();
}

// =============== 4) Urgência: faixa lado a lado na web e no iPad, baralho no iPhone ===============
for (const [rot, perfil, tema] of [['computador Claro', 'desktop', 'claro'], ['computador Escuro', 'desktop', 'escuro'], ['iPad Claro', 'ipad', 'claro'], ['iPad Escuro', 'ipad', 'escuro']]) {
  const { ctx, pg } = await abrir(perfil, { tema });
  await pg.evaluate(() => document.querySelector('[data-nova-urgencia]')?.scrollIntoView({ block: 'center' })); await esperar(400);
  const f = await pg.$eval('[data-urg-faixa]', (e) => ({ disp: getComputedStyle(e).display, ox: getComputedStyle(e).overflowX, sw: e.scrollWidth, cw: e.clientWidth, foco: e.tabIndex, papel: e.getAttribute('role') }));
  ok(f.disp === 'flex' && f.ox === 'auto' && f.sw > f.cw + 1 && f.foco === 0 && f.papel === 'region', `${rot}: faixa com rolagem horizontal própria, focável (${f.sw} px de conteúdo em ${f.cw} px)`);
  const cards = await pg.$$eval('[data-urg-faixa] .dcard', (l) => l.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, t: e.querySelector('.assunto')?.textContent.trim() }; }));
  ok(cards.length === 5 && cards.every((c) => Math.abs(c.y - cards[0].y) < 1) && cards.every((c, i) => i === 0 || c.x > cards[i - 1].x), `${rot}: os ${cards.length} cards ficam lado a lado, na mesma linha`);
  ok(cards.every((c) => Math.abs(c.w - cards[0].w) < 1 && Math.abs(c.h - cards[0].h) < 1), `${rot}: todos com o mesmo tamanho (${Math.round(cards[0].w)}x${Math.round(cards[0].h)} px)`);
  const ordem = await pg.$$eval('[data-urg-faixa] .dcard .assunto', (l) => l.map((e) => e.textContent.trim()));
  ok(ESPERADA.every((e, i) => ordem[i]?.startsWith(e)), `${rot}: da mais para a menos urgente (${ordem.map((t) => t.slice(0, 8)).join(' > ')})`);
  const vaga = await R(pg, `${PH} > .cards .dcard`);
  ok(Math.abs(vaga.w - cards[0].w) <= 1.5, `${rot}: os cards da Urgência têm a largura do Para hoje (${Math.round(cards[0].w)} e ${Math.round(vaga.w)} px)`);
  const pagina = await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  await pg.$eval('[data-urg-faixa]', (e) => { e.scrollLeft = e.scrollWidth; }); await esperar(400);
  const apos = await pg.$eval('[data-urg-faixa]', (e) => ({ sl: e.scrollLeft, ultimo: e.querySelector('.vaga:last-child').getBoundingClientRect().right, borda: e.getBoundingClientRect().right }));
  ok(apos.sl > 0 && apos.ultimo <= apos.borda + 1 && pagina && (await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)), `${rot}: rolar a faixa revela o último card sem rolar a página para o lado`);
  await pg.$eval('[data-urg-faixa]', (e) => { e.scrollLeft = 0; }); await esperar(300);
  const setas = await pg.$eval('.urg-caixa', (e) => { const a = e.querySelector('[data-urg-ant]'), p = e.querySelector('[data-urg-prox]'), r = (x) => x.getBoundingClientRect(); return { n: e.querySelectorAll('.urg-seta').length, antOff: a?.getAttribute('aria-disabled'), proxOff: p?.getAttribute('aria-disabled'), antDentro: r(a).left >= 0, proxDentro: r(p).right <= innerWidth, alvo: Math.min(r(p).width + 8, r(p).height + 8) }; });
  ok(setas.n === 2 && setas.antOff === 'true' && setas.proxOff === null && setas.antDentro && setas.proxDentro && setas.alvo >= 44, `${rot}: duas setas, a de voltar esmaecida no começo, ambas dentro da tela e com alvo de 44 px`);
  await pg.click('[data-urg-prox]'); await esperar(900);
  const dep = await pg.$eval('[data-urg-faixa]', (e) => e.scrollLeft);
  ok(dep > 0 && (await pg.$eval('[data-urg-ant]', (e) => e.getAttribute('aria-disabled'))) === null, `${rot}: a seta "próximas" rola a faixa (${Math.round(dep)} px) e libera a de voltar`);
  await pg.$eval('[data-urg-faixa]', (e) => { e.scrollLeft = 0; });
  ok((await pg.$$('[data-nova-urgencia] .ph-pilha')).length === 0, `${rot}: sem baralho na Nova urgência`);
  const vaga1 = await pg.$eval(`${PH} > .cards`, (e) => e.children.length);
  ok(vaga1 === 4, `${rot}: o Para hoje tem as quatro vagas na grade (${vaga1})`);
  const dica = await pg.$eval('[data-nova-urgencia] .dcard', (e) => !!e.querySelector('.face'));
  ok(dica, `${rot}: os cards da faixa são cards completos`);
  await pg.focus('[data-urg-faixa]'); await pg.keyboard.press('ArrowRight'); await esperar(300);
  ok(await pg.$eval('[data-urg-faixa]', (e) => e.scrollLeft > 0), `${rot}: a seta do teclado rola a faixa`);
  ok(await pg.$eval('[data-urg-faixa]', (e) => getComputedStyle(e).outlineStyle !== 'none'), `${rot}: o foco da faixa é visível`);
  await pg.$eval('[data-urg-faixa]', (e) => { e.scrollLeft = 0; });
  await pg.screenshot({ path: `${CAPTURAS}/${perfil}-${tema}-urgencia.png`, fullPage: true });
  await ctx.close();
}
{
  const { ctx, pg } = await abrir('celular');
  ok(!(await pg.$('[data-urg-faixa]')) && (await pg.$$('[data-nova-urgencia] .ph-pilha')).length === 1, 'iPhone: a Urgência continua sendo o baralho');
  await ctx.close();
}

await wk?.close();
parar();
await nav.close();
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
