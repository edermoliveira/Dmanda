// Ajustes de consulta e interface de 30/10/2026 (decisão 40), no navegador com o banco local de TESTE (PGlite, mesmas migrações do Supabase):
//   1) Entradas abre em leitura (sem campo focado nem teclado), o lápis leva à edição, rascunho pendente fica em espera e nada é sobrescrito;
//   2) Arquivo: os textos Demandas e Entradas do seletor aparecem (medidos: caixa, tamanho, contraste) em todas as larguras, nos dois temas;
//   3) Configurações: o campo Data fica dentro do quadro (sem rolagem horizontal), vazio e preenchido, em celular, iPad e computador, nas duas orientações;
//   4) Lista de Demandas: assunto à esquerda, secundários só quando existem, vencimento e tarefas em posição fixa, seta e lápis separados;
//   5) cards (Cards, Quadro e Início) sem o selo Legal/Próprio, que continua na Tabela e nos detalhes.
// Roda no Edge (Chromium) e, quando o WebKit do Playwright abre, também nele (o motor do Safari; NÃO é o Safari do iPhone). Sobe o próprio servidor numa porta separada. NÃO valida o Supabase real.
// Uso: node scripts/testar-ajustes.mjs   (CAPTURAS=pasta grava imagens para conferência visual)
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';

const PORTA = process.env.PORTA_TESTE_AJUSTES || '7106', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/ajustes', CAP = process.env.CAPTURAS || '';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true }); if (CAP) mkdirSync(CAP, { recursive: true });
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const erros = [];
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
let wk = null;
try { wk = await webkit.launch(); } catch (e) { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); }

const abrir = async (browser, opcoes, { tema = 'claro', visao = 'cards' } = {}) => {
  const ctx = await browser.newContext(opcoes);
  await ctx.addInitScript(([t, v]) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); if (!localStorage.getItem('dmanda:ui')) localStorage.setItem('dmanda:ui', JSON.stringify({ visao: v })); } catch { /* sem armazenamento */ } }, [tema, visao]);
  const pg = await ctx.newPage(); pg.setDefaultTimeout(30000);
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  return { ctx, pg };
};
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando as (entradas|demandas)/.test(document.body.innerText), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  if (rota === '/demandas') { // a visão guardada só aparece depois de os dados chegarem (as ações do servidor do início rodam uma de cada vez): espera explícita
    await pg.waitForFunction(() => { let v = 'cards'; try { v = JSON.parse(localStorage.getItem('dmanda:ui') || '{}').visao || 'cards'; } catch { /* Cards */ }
      return !!document.querySelector({ cards: '.cards .dcard', quadro: '.quadro .coluna', tabela: '.tabela tbody tr', lista: '.lista-dem .linha' }[v]) || !!document.querySelector('.vazio, .erro-carga'); }, null, { timeout: 30000 });
  }
  await pg.waitForTimeout(900);
};
const foto = async (pg, nome) => { if (CAP) await pg.screenshot({ path: `${CAP}/${nome}.png` }); };
const janelaFechada = (pg) => pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
const esperaEstado = (pg, e, ms = 15000) => pg.waitForFunction((x) => document.querySelector('.modal .estado-entrada')?.getAttribute('data-estado') === x, e, { timeout: ms });

// contraste medido (WCAG) do texto de um elemento contra o fundo que realmente está atrás dele (camadas translúcidas compostas)
const contraste = (pg, sel, fundoSel) => pg.evaluate(([s, f]) => {
  const num = (c) => { let m = c.match(/rgba?\(([^)]+)\)/); let p;
    if (m) p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); else { m = c.match(/color\(srgb ([^)]+)\)/); if (!m) return [0, 0, 0, 0]; p = m[1].split(/[ /]+/).filter(Boolean).map(Number); p = [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
    return [p[0], p[1], p[2], p[3] ?? 1]; };
  const camadas = []; for (let e = document.querySelector(f); e; e = e.parentElement) camadas.unshift(num(getComputedStyle(e).backgroundColor));
  let fundo = [255, 255, 255]; for (const [r, g, b, a] of camadas) fundo = [r * a + fundo[0] * (1 - a), g * a + fundo[1] * (1 - a), b * a + fundo[2] * (1 - a)];
  const t = num(getComputedStyle(document.querySelector(s)).color); const cor = [t[0] * t[3] + fundo[0] * (1 - t[3]), t[1] * t[3] + fundo[1] * (1 - t[3]), t[2] * t[3] + fundo[2] * (1 - t[3])];
  const lum = (c) => { const k = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const a = lum(cor), b = lum(fundo); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}, [sel, fundoSel]);

// ---------- cadastro e dados fictícios ----------
const cadastrar = async (pg, c) => {
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', c.assunto); if (c.numero) await pg.fill('#n-num', c.numero); if (c.origem) await pg.fill('#n-origem', c.origem);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  if (c.dias) await pg.click(`.modal .dias-btns button:has-text("${c.dias} dias")`);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await janelaFechada(pg);
};
const LONGO = 'Solicitação de reequilíbrio econômico-financeiro do contrato de coleta de resíduos sólidos urbanos, com revisão dos índices e das planilhas de custos do exercício anterior';
const DEMANDAS = [
  { assunto: 'Ofício curto' },
  { assunto: LONGO, numero: '0123456789012345678901234567890/2026', origem: 'Secretaria Municipal de Planejamento e Gestão Estratégica', dias: 10 },
  { assunto: 'Compra de papel', numero: '45/2026', origem: 'Compras', dias: 5 },
  { assunto: 'Sem origem e com prazo longo', dias: 30 },
  { assunto: 'Só origem', origem: 'Jurídico' },
];

// ============ 2) Arquivo vazio (antes de existir qualquer dado) ============
const desk = await abrir(nav, { viewport: { width: 1360, height: 800 } });
{
  const pg = desk.pg;
  await ir(pg, '/arquivo');
  ok(/Nada arquivado/.test(await pg.textContent('.main')), 'Arquivo vazio: Demandas mostra "Nada arquivado"');
  await pg.click('.tabs [data-aba="entradas"]'); await pg.waitForSelector('.vazio');
  ok(/Nenhuma entrada arquivada/.test(await pg.textContent('.main')), 'Arquivo vazio: Entradas mostra "Nenhuma entrada arquivada"');
}

// ============ semeia ============
{
  const pg = desk.pg;
  await ir(pg, '/demandas');
  for (const d of DEMANDAS) await cadastrar(pg, d);
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'lista' }))); await ir(pg, '/demandas');
  await pg.waitForSelector('.lista-dem .linha');
  // uma tarefa em "Compra de papel", pela própria linha expandida
  const alvo = '.lista-dem .linha:has(.ld-ass:has-text("Compra de papel"))';
  await pg.click(`${alvo} .ld-m`); await pg.click(`${alvo} .linha-d .proxima.vazia button`); await pg.fill(`${alvo} .linha-d input[type="text"], ${alvo} .linha-d .proxima.vazia input`, 'Pedir três cotações');
  await pg.keyboard.press('Enter'); await pg.waitForSelector(`${alvo} .linha-d .tarefas li`);
  // uma demanda arquivada ("Só origem") para o Arquivo preenchido
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'cards' }))); await ir(pg, '/demandas');
  await pg.evaluate(() => { const c = [...document.querySelectorAll('.dcard')].find((x) => x.textContent.includes('Só origem')); (c.querySelector('[aria-label="Arquivar"]')).click(); });
  await pg.waitForFunction(() => ![...document.querySelectorAll('.dcard')].some((x) => x.textContent.includes('Só origem')), null, { timeout: 10000 });
  // entradas: duas ativas e uma arquivada
  await ir(pg, '/entradas');
  const nova = async (titulo, texto) => { await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto'); if (titulo) await pg.fill('#e-titulo', titulo); await pg.fill('#e-texto', texto); await esperaEstado(pg, 'salvo'); await pg.click('.modal .btn.pri'); await janelaFechada(pg); };
  await nova('Reunião com o jurídico', 'Levar o parecer impresso.\nConferir a minuta do contrato.\nPedir a ata anterior. #juridico #contrato');
  await nova('', 'Ligar para a gráfica e confirmar a entrega dos formulários #compras');
  await nova('Para arquivar', 'Esta ficará no Arquivo #arquivo');
  await pg.click('.postit:has(.p-txt:has-text("Para arquivar")) .p-abrir'); await pg.waitForSelector('[data-leitura]');
  await pg.click('.modal .acoes-entrada button:has-text("Arquivar")'); await janelaFechada(pg);
}

// ============ 5) cards sem o selo; Tabela e detalhes mantêm ============
{
  const pg = desk.pg;
  for (const v of ['cards', 'quadro']) {
    await pg.evaluate((x) => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: x })), v); await ir(pg, '/demandas');
    await pg.waitForSelector(v === 'cards' ? '.dcard' : '.mini-card', { timeout: 15000 }).catch(async (e) => { if (CAP) await pg.screenshot({ path: `${CAP}/falha-${v}.png` }); console.log('diagnóstico', v, JSON.stringify(await pg.evaluate(() => ({ ui: localStorage.getItem('dmanda:ui'), cols: document.querySelectorAll('.coluna').length, texto: document.querySelector('.main')?.innerText.slice(0, 200) })))); throw e; });
    const r = await pg.evaluate(() => ({ cards: document.querySelectorAll('.dcard, .mini-card').length, selos: document.querySelectorAll('.dcard .selo, .mini-card .selo').length, pz: document.querySelectorAll('.dcard .pz, .mini-card .pz').length, doc: document.documentElement.scrollWidth <= innerWidth }));
    ok(r.cards >= 4 && r.selos === 0, `${v}: nenhum card mostra o selo Legal/Próprio (${r.cards} cards)`);
    ok(r.pz >= 3, `${v}: o vencimento e a contagem regressiva continuam nos cards (${r.pz})`);
  }
  await foto(pg, 'quadro-sem-selo');
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'tabela' }))); await ir(pg, '/demandas'); await pg.waitForSelector('.tabela tbody tr');
  ok(await pg.evaluate(() => document.querySelectorAll('.tabela .selo').length >= 3), 'Tabela: o selo do tipo de prazo continua aparecendo');
  await pg.click('.tabela tbody tr:has-text("Compra de papel") td >> nth=1').catch(() => {}); 
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'lista' }))); await ir(pg, '/demandas'); await pg.waitForSelector('.lista-dem .linha');
  await pg.click('.lista-dem .linha:has(.ld-ass:has-text("Compra de papel")) .ld-abrir'); await pg.waitForSelector('.modal .resumo-chips');
  ok(await pg.evaluate(() => !!document.querySelector('.modal .resumo-chips .selo')) && /Prazo|Legal|Próprio/.test(await pg.textContent('.modal .resumo-chips')), 'consulta da demanda: o tipo do prazo continua nos detalhes');
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  await ir(pg, '/');
  ok(await pg.evaluate(() => document.querySelectorAll('.main .dcard .selo, .main .mini-card .selo').length === 0), 'Início: os cards reaproveitados também estão sem o selo');
}

// ============ por perfil: 2) abas do Arquivo, 3) campo Data, 4) Lista ============
const PERFIS = [
  ['Edge computador 1360 claro', nav, { viewport: { width: 1360, height: 800 } }, 'claro'],
  ['Edge computador 1360 escuro', nav, { viewport: { width: 1360, height: 800 } }, 'escuro'],
  ['Edge 1000 (faixa intermediária)', nav, { viewport: { width: 1000, height: 800 } }, 'claro'],
  ['Edge iPad vertical 820', nav, { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }, 'claro'],
  ['Edge iPad horizontal 1180 escuro', nav, { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true }, 'escuro'],
  ['Edge Android 360 claro', nav, { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true }, 'claro'],
  ['Edge iPhone 390 claro', nav, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }, 'claro'],
  ['Edge iPhone 390 escuro', nav, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }, 'escuro'],
];
if (wk) PERFIS.push(['WebKit iPhone 13 claro', wk, { ...devices['iPhone 13'] }, 'claro'], ['WebKit iPhone 13 escuro', wk, { ...devices['iPhone 13'] }, 'escuro'], ['WebKit iPad 820 claro', wk, { ...devices['iPad (gen 7)'] }, 'claro'], ['WebKit computador 1360', wk, { viewport: { width: 1360, height: 800 } }, 'claro']);

for (const [nome, browser, opcoes, tema] of PERFIS) {
  const { ctx, pg } = await abrir(browser, opcoes, { tema, visao: 'lista' });
  const slug = nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  // ---- 2) abas do Arquivo ----
  await ir(pg, '/arquivo');
  for (const aba of ['demandas', 'entradas', 'demandas']) {
    await pg.click(`.tabs [data-aba="${aba}"]`); await pg.waitForFunction((a) => document.querySelector(`.tabs [data-aba="${a}"]`)?.getAttribute('aria-pressed') === 'true', aba);
    await pg.waitForFunction((a) => a === 'entradas' ? !!document.querySelector('[aria-label="Entradas arquivadas"], .vazio, .vazio-c:not([role="status"])') : true, aba, { timeout: 15000 });
    await pg.waitForTimeout(650); // a cápsula termina de deslizar
    const m = await pg.evaluate(() => {
      const t = document.querySelector('.tabs'); const th = t.querySelector('.thumb'); const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      return { abas: [...t.querySelectorAll('button')].map((b) => { const x = b.querySelector('.tx'), cs = getComputedStyle(x); return { nome: x.textContent, pressed: b.getAttribute('aria-pressed') === 'true', display: cs.display, vis: cs.visibility, op: +cs.opacity, fs: parseFloat(cs.fontSize), caixa: r(x), botao: r(b), z: getComputedStyle(b).zIndex }; }), thumb: th ? { ...r(th), z: getComputedStyle(th).zIndex } : null, tabs: r(t), doc: document.documentElement.scrollWidth <= innerWidth };
    });
    const todas = m.abas.every((a) => a.display !== 'none' && a.vis === 'visible' && a.op > 0.9 && a.caixa.w >= 40 && a.caixa.h >= 10 && a.fs >= 10);
    ok(todas && m.abas.map((a) => a.nome).join() === 'Demandas,Entradas', `${nome}, aba ${aba}: "Demandas" e "Entradas" visíveis e medidas (${m.abas.map((a) => `${a.nome} ${Math.round(a.caixa.w)}x${Math.round(a.caixa.h)}`).join(', ')})`);
    const sel = m.abas.find((a) => a.pressed);
    ok(!!m.thumb && Number(m.thumb.z) < Number(sel.z) && m.thumb.l <= sel.caixa.l + 1 && m.thumb.r >= sel.caixa.r - 1, `${nome}, aba ${aba}: a cápsula fica atrás do texto e o contém`);
    const cSel = await contraste(pg, '.tabs [aria-pressed="true"] .tx', '.tabs .thumb'), cNao = await contraste(pg, '.tabs [aria-pressed="false"] .tx', '.tabs');
    ok(cSel >= 4.5 && cNao >= 4.5, `${nome}, aba ${aba}: contraste do selecionado ${cSel.toFixed(1)} e do não selecionado ${cNao.toFixed(1)} (mínimo 4,5)`);
    ok(m.doc, `${nome}, aba ${aba}: sem rolagem horizontal`);
    const conteudo = await pg.textContent('.main');
    ok(aba === 'entradas' ? /Para arquivar/.test(conteudo) : /Só origem/.test(conteudo), `${nome}, aba ${aba}: a lista preenchida aparece`);
  }
  await foto(pg, `arquivo-${slug}`);

  // ---- 3) campo Data ----
  await ir(pg, '/config'); await pg.waitForSelector('#cfg-data');
  const medirData = () => pg.evaluate(() => {
    const f = document.querySelector('.cfg-form').getBoundingClientRect(), main = document.querySelector('.main').getBoundingClientRect();
    const campo = (id) => { const e = document.getElementById(id), b = e.getBoundingClientRect(); return { id, l: b.left, r: b.right, w: b.width, h: b.height, sw: e.scrollWidth, cw: e.clientWidth }; };
    return { f: { l: f.left, r: f.right }, main: { l: main.left, r: main.right }, data: campo('cfg-data'), cat: campo('cfg-cat'), desc: campo('cfg-desc'), doc: document.documentElement.scrollWidth, vw: window.innerWidth, ov: getComputedStyle(document.documentElement).overflowX };
  });
  const verData = async (rotulo) => {
    const m = await medirData();
    const dentro = [m.data, m.cat, m.desc].every((c) => c.l >= m.f.l - 0.5 && c.r <= m.f.r + 0.5);
    ok(dentro, `${nome} ${rotulo}: Data, Categoria e Descrição ficam inteiramente dentro do quadro (quadro ${Math.round(m.f.l)}-${Math.round(m.f.r)}, data ${Math.round(m.data.l)}-${Math.round(m.data.r)})`);
    ok(m.f.r <= m.vw + 0.5 && m.doc <= m.vw, `${nome} ${rotulo}: sem rolagem horizontal da página (largura ${m.doc} de ${m.vw})`);
    ok(m.data.h >= 44 && m.data.w >= 120, `${nome} ${rotulo}: o campo Data mantém o tamanho de toque (${Math.round(m.data.w)}x${Math.round(m.data.h)})`);
    ok(Math.abs(m.data.l - m.desc.l) < 1.5, `${nome} ${rotulo}: Data alinhada pela esquerda aos demais campos`);
  };
  await verData('vazio');
  await pg.fill('#cfg-data', '2027-03-05'); await pg.waitForTimeout(150);
  ok((await pg.inputValue('#cfg-data')) === '2027-03-05', `${nome}: a data preenchida é aceita`);
  await verData('preenchido'); await foto(pg, `config-${slug}`);
  if (opcoes.isMobile) { // troca de orientação
    const vp = pg.viewportSize(); await pg.setViewportSize({ width: vp.height, height: vp.width }); await pg.waitForTimeout(500); await verData('girado'); await pg.setViewportSize(vp);
  }

  // ---- 4) Lista de Demandas ----
  await ir(pg, '/demandas'); await pg.waitForSelector('.lista-dem .linha');
  const L = await pg.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, w: b.width, h: b.height }; };
    return {
      doc: document.documentElement.scrollWidth <= innerWidth,
      linhas: [...document.querySelectorAll('.lista-dem .linha')].map((li) => {
        const a = li.querySelector('.ld-ass'), pz = li.querySelector('.ld-prazo .pz'), pr = li.querySelector('.ld-prog'), m = li.querySelector('.ld-m'), ab = li.querySelector('.ld-abrir'), sec = li.querySelector('.ld-sec');
        return { ass: a.textContent, alinh: getComputedStyle(a).textAlign, aL: a.getBoundingClientRect().left, mL: m.getBoundingClientRect().left, linha: r(li), pz: pz ? { ...r(pz), txt: pz.textContent } : null, prazoCel: r(li.querySelector('.ld-prazo')), pr: { ...r(pr), txt: pr.textContent }, m: r(m), ab: r(ab),
          num: !!sec.querySelector('.num'), origem: !!sec.querySelector('.origem-p'), tipo: !!sec.querySelector('.tag'), selo: !!li.querySelector('.selo'), txt: li.querySelector('.ld-c').textContent, aninhado: li.querySelectorAll('.ld-c button button, .ld-c a button, .ld-m a, .ld-m input').length,
          estouro: li.scrollWidth > li.clientWidth + 1, secH: r(sec).h };
      }),
      grupoH: !!document.querySelector('.lista-dem .grupo-h .cnt'),
    };
  });
  const por = (t) => L.linhas.find((x) => x.ass.startsWith(t));
  const curto = por('Ofício curto'), longo = por('Solicitação'), papel = por('Compra'), semOrig = por('Sem origem');
  ok(L.linhas.length === 4 && L.doc, `${nome} Lista: quatro demandas ativas, sem rolagem horizontal da página`);
  ok(L.linhas.every((x) => x.alinh === 'left' || x.alinh === 'start') && L.linhas.every((x) => Math.abs(x.aL - L.linhas[0].aL) < 1.5), `${nome} Lista: os assuntos ficam à esquerda e alinhados entre si`);
  ok(!curto.num && !curto.origem && curto.tipo && longo.num && longo.origem && papel.num && papel.origem && !semOrig.num && !semOrig.origem, `${nome} Lista: número e origem só aparecem quando existem; o tipo sempre`);
  ok(!curto.pz && !!longo.pz && !!papel.pz && !!semOrig.pz, `${nome} Lista: o vencimento aparece só nas demandas com prazo`);
  ok(L.linhas.every((x) => !x.selo) && L.linhas.every((x) => !/Legal|Próprio/.test(x.txt)), `${nome} Lista: o resumo compacto não tem o selo Legal/Próprio`);
  ok(!L.linhas.some((x) => /—/.test(x.pr.txt + x.txt)) && /Sem tarefas/.test(curto.pr.txt) && /0\/1 tarefa/.test(papel.pr.txt), `${nome} Lista: sem traço solto ("${curto.pr.txt}" e "${papel.pr.txt}")`);
  ok(L.linhas.every((x) => x.aninhado === 0) && L.linhas.every((x) => !x.estouro), `${nome} Lista: sem controle dentro de controle e sem estouro lateral`);
  ok(L.linhas.every((x) => x.m.h >= 44 && x.ab.h >= 28 && x.ab.w >= 28), `${nome} Lista: seta com altura de 44 px e lápis tocável (${Math.round(curto.m.h)} e ${Math.round(curto.ab.w)}x${Math.round(curto.ab.h)})`);
  ok(L.linhas.every((x) => x.m.r <= x.linha.r + 0.5 && x.ab.r <= x.linha.r + 0.5), `${nome} Lista: todos os controles dentro da linha`);
  if (opcoes.viewport.width >= 900 || (opcoes.screen && opcoes.screen.width >= 900)) {
    const comPz = L.linhas.filter((x) => x.pz);
    ok(comPz.every((x) => Math.abs(x.pz.r - comPz[0].pz.r) < 1.5) && L.linhas.every((x) => Math.abs(x.pr.r - L.linhas[0].pr.r) < 1.5), `${nome} Lista: vencimento e tarefas em posição fixa (colunas alinhadas à direita)`);
    ok(longo.m.h < 140, `${nome} Lista: no computador a linha aproveita a largura (assunto longo em ${Math.round(longo.m.h)} px de altura)`);
  } else {
    ok(longo.m.h < 260 && longo.pr.t >= longo.m.t && (!longo.pz || longo.pz.t >= longo.m.t + longo.m.h - 8), `${nome} Lista: no celular, assunto e secundários, depois vencimento e tarefas em linha própria`);
  }
  const cAss = await contraste(pg, '.lista-dem .ld-ass', '.lista-dem .linha'), cProg = await contraste(pg, '.lista-dem .ld-prog', '.lista-dem .linha'), cSec = await contraste(pg, '.lista-dem .ld-sec', '.lista-dem .linha');
  const tams = await pg.evaluate(() => ['.ld-ass', '.ld-sec', '.ld-prog'].map((q) => parseFloat(getComputedStyle(document.querySelector('.lista-dem ' + q)).fontSize)));
  ok(cAss >= 4.5 && cProg >= 4.5 && cSec >= 4.5 && tams.every((t) => t >= 10), `${nome} Lista: contraste (assunto ${cAss.toFixed(1)}, secundários ${cSec.toFixed(1)}, tarefas ${cProg.toFixed(1)}) e letras de pelo menos 10 px (${tams.map((t) => t.toFixed(1)).join(', ')})`);
  await foto(pg, `lista-${slug}`);
  // seta e lápis fazem coisas diferentes
  const linha = '.lista-dem .linha:has(.ld-ass:has-text("Compra de papel"))';
  const progDe = (re) => pg.waitForFunction((r) => { const li = [...document.querySelectorAll('.lista-dem .linha')].find((x) => x.querySelector('.ld-ass')?.textContent.startsWith('Compra')); return !!li && new RegExp(r).test(li.querySelector('.ld-prog').textContent); }, re.source, { timeout: 10000 });
  await pg.click(`${linha} .ld-m`); await pg.waitForSelector(`${linha} .linha-d .tarefas li`);
  ok(!(await pg.$('.modal')) && (await pg.getAttribute(`${linha} .ld-m`, 'aria-expanded')) === 'true', `${nome} Lista: a seta só expande a linha (nenhuma janela abre) e mostra as tarefas`);
  await pg.click(`${linha} .linha-d input[type="checkbox"]`); await progDe(/1\/1 tarefa/);
  ok(true, `${nome} Lista: marcar a tarefa na linha atualiza "${await pg.textContent(`${linha} .ld-prog`)}"`);
  await pg.click(`${linha} .linha-d input[type="checkbox"]`); await progDe(/0\/1 tarefa/);
  await pg.click(`${linha} .ld-abrir`); await pg.waitForSelector('.modal .resumo-chips');
  ok((await pg.getAttribute(`${linha} .ld-m`, 'aria-expanded')) === 'true', `${nome} Lista: o lápis abre a consulta completa sem recolher a linha`);
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  await pg.click(`${linha} .ld-m`); await pg.waitForFunction(() => { const li = [...document.querySelectorAll('.lista-dem .linha')].find((x) => x.querySelector('.ld-ass')?.textContent.startsWith('Compra')); return !!li && !li.querySelector('.linha-d'); });
  const etapa = await pg.evaluate(() => [...document.querySelectorAll('.lista-dem .grupo')].find((g) => g.textContent.includes('Compra de papel')).querySelector('.grupo-h b').textContent); const cab = `.lista-dem .grupo-h:has(b:text-is("${etapa}"))`; await pg.click(cab); await pg.waitForFunction(() => ![...document.querySelectorAll('.lista-dem .linha')].some((x) => x.textContent.includes('Compra de papel')), null, { timeout: 5000 }); await pg.click(cab); await pg.waitForSelector('.lista-dem .linha:has(.ld-ass:has-text("Compra de papel"))');
  ok(L.grupoH, `${nome} Lista: o grupo da etapa mantém nome, quantidade e controle de recolher`);
  await ctx.close();
}

// ============ 1) Entradas em leitura ============
const leitura = async (nome, browser, opcoes, tema, toque) => {
  const { ctx, pg } = await abrir(browser, opcoes, { tema });
  await ir(pg, '/entradas');
  const alvo = '.postit:has(.p-txt:has-text("Reunião com o jurídico"))';
  const clicar = (sel) => (toque ? pg.tap(sel) : pg.click(sel));
  const foco = () => pg.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, id: a?.id, papel: a?.getAttribute('role'), editavel: !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable) }; });
  await clicar(`${alvo} .p-abrir`); await pg.waitForSelector('[data-leitura]'); await pg.waitForTimeout(800); // a janela termina de abrir (animação) antes das medidas
  let f = await foco();
  ok(!f.editavel && f.papel === 'dialog', `${nome}: abrir uma entrada existente não foca campo nenhum (foco na janela: ${f.tag}, papel ${f.papel})`);
  const L = await pg.evaluate(() => {
    const m = document.querySelector('.modal'), c = m.querySelector('[data-leitura]'), corpo = c.querySelector('.ler-corpo'), t = c.querySelector('.ler-titulo'), tg = c.querySelector('.ler-tags'), lap = m.querySelector('[aria-label="Editar a entrada"]');
    const fs = (e) => parseFloat(getComputedStyle(e).fontSize), lb = lap.getBoundingClientRect();
    return { campos: m.querySelectorAll('input:not([type=checkbox]), textarea').length, titulo: t?.textContent, corpo: corpo?.innerText, ws: corpo ? getComputedStyle(corpo).whiteSpace : '', tags: [...(tg?.querySelectorAll('span') ?? [])].map((s) => s.textContent), fsT: t && fs(t), fsC: corpo && fs(corpo), fsG: tg && fs(tg), pT: t && getComputedStyle(t).fontWeight, lap: { w: lb.width, h: lb.height }, lapNome: lap.getAttribute('aria-label'), vis: c.getBoundingClientRect().height > 40, cabeLinha: corpo.scrollWidth <= corpo.clientWidth + 1 };
  });
  ok(L.campos === 0 && L.titulo === 'Reunião com o jurídico' && /Levar o parecer impresso\.\nConferir a minuta do contrato\.\nPedir a ata anterior\./.test(L.corpo) && L.ws === 'pre-wrap', `${nome}: título e texto completo aparecem, com as quebras de linha, sem nenhum campo de digitação`);
  ok(L.tags.join() === '#juridico,#contrato' && L.fsT === L.fsC && L.fsC === L.fsG && Number(L.pT) >= 600, `${nome}: tags organizadas e mesmo tamanho de letra para título (negrito), texto e tags (${L.fsT}px)`);
  const alcance = await pg.evaluate(() => { const b = document.querySelector('.modal [aria-label="Editar a entrada"]').getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, acha = (dx, dy) => document.elementFromPoint(cx + dx, cy + dy)?.closest('[aria-label="Editar a entrada"]') !== null; return acha(21, 0) && acha(-21, 0) && acha(0, 21) && acha(0, -21) && !document.elementFromPoint(cx + 30, cy)?.closest('[aria-label="Editar a entrada"]'); });
  ok(L.lap.w >= 28 && L.lap.h >= 28 && alcance && L.lapNome === 'Editar a entrada' && L.cabeLinha, `${nome}: o lápis tem nome acessível e área de toque de 44 px (visível ${Math.round(L.lap.w)}x${Math.round(L.lap.h)})`);
  await foto(pg, `entrada-leitura-${nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
  // Tab fica dentro da janela; Esc fecha e devolve o foco à nota que abriu
  for (let i = 0; i < 9; i++) await pg.keyboard.press('Tab');
  ok(await pg.evaluate(() => !!document.activeElement?.closest('.modal')), `${nome}: o Tab não sai da janela de leitura`);
  for (let i = 0; i < 9; i++) await pg.keyboard.press('Shift+Tab');
  ok(await pg.evaluate(() => !!document.activeElement?.closest('.modal')), `${nome}: o Shift+Tab também não`);
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  // o foco volta a quem abriu quando quem abriu tinha foco (pelo teclado; Safari não dá foco a botão tocado ou clicado)
  await pg.focus(`${alvo} .p-abrir`); await pg.keyboard.press('Enter'); await pg.waitForSelector('[data-leitura]');
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  ok(await pg.evaluate(() => document.activeElement?.classList.contains('p-abrir')), `${nome}: aberta pelo teclado, ao fechar o foco volta à nota que abriu a janela`);

  // o lápis inicia a edição, com o foco no texto, dentro do mesmo toque
  await clicar(`${alvo} .p-abrir`); await pg.waitForSelector('[data-leitura]');
  await clicar('.modal [aria-label="Editar a entrada"]'); await pg.waitForSelector('#e-texto');
  f = await foco();
  ok(f.id === 'e-texto' && !(await pg.$('[data-leitura]')), `${nome}: o lápis troca a leitura pelos campos e põe o foco no texto`);
  ok(await pg.evaluate(() => { const t = document.getElementById('e-texto'); return t.selectionStart === t.value.length; }), `${nome}: o cursor entra no fim do texto`);
  await pg.fill('#e-texto', 'Levar o parecer impresso.\nConferir a minuta do contrato.\nPedir a ata anterior.\nNova linha editada #juridico #contrato');
  await clicar('.modal .btn:has-text("Voltar à leitura")'); await pg.waitForSelector('[data-leitura]');
  ok(/Nova linha editada/.test(await pg.textContent('[data-leitura]')) && (await foco()).editavel === false, `${nome}: voltar à leitura mostra a alteração, sem perdê-la, e sem campo focado`);
  await esperaEstado(pg, 'salvo');
  ok(await pg.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Editar a entrada'), `${nome}: ao voltar, o foco fica no lápis`);
  await clicar('.modal .btn:has-text("Fechar")'); await janelaFechada(pg);
  await ir(pg, '/entradas'); await clicar(`${alvo} .p-abrir`); await pg.waitForSelector('[data-leitura]');
  ok(/Nova linha editada/.test(await pg.textContent('[data-leitura]')), `${nome}: depois de recarregar, a leitura mostra o texto salvo no banco`);
  await pg.keyboard.press('Escape'); await janelaFechada(pg);

  // nova entrada continua pronta para digitar
  await clicar('.toolbar .btn.escuro'); await pg.waitForSelector('#e-titulo');
  ok(!(await pg.$('[data-leitura]')) && (await foco()).id === 'e-titulo', `${nome}: Nova entrada abre em criação, com o foco no primeiro campo`);
  await clicar('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  await ctx.close();
};
await leitura('Edge computador', nav, { viewport: { width: 1360, height: 800 } }, 'claro', false);
await leitura('Edge iPhone escuro', nav, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, 'escuro', true);
if (wk) await leitura('WebKit iPhone 13', wk, { ...devices['iPhone 13'] }, 'claro', true);

// ---- rascunho pendente: fica em espera, informa e não sobrescreve ----
{
  const { ctx, pg } = await abrir(nav, { viewport: { width: 1360, height: 800 } });
  await ir(pg, '/entradas');
  const alvo = '.postit:has(.p-txt:has-text("Ligar para a gráfica"))';
  // sem rede para as ações do servidor, para o texto novo ficar só neste aparelho
  await pg.route('**/*', async (route) => { const r = route.request(); if (r.method() === 'POST' && r.headers()['next-action']) { await route.abort('failed'); return; } await route.continue(); });
  await pg.click(`${alvo} .p-abrir`); await pg.waitForSelector('[data-leitura]'); await pg.click('.modal [aria-label="Editar a entrada"]'); await pg.waitForSelector('#e-texto');
  await pg.fill('#e-texto', 'Ligar para a gráfica e confirmar a entrega dos formulários #compras\nTEXTO SÓ NO APARELHO'); await pg.waitForTimeout(800);
  await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const rascunhosAntes = await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('dmanda:rascunhos') || '{}')));
  ok(rascunhosAntes.some((k) => k.startsWith('e:') && k !== 'e:nova'), 'rascunho: o texto alterado ficou guardado neste aparelho (rede derrubada)');
  await pg.unroute('**/*'); await pg.goto(BASE + '/entradas'); await ir(pg, '/entradas');
  await pg.waitForFunction(() => /Só neste aparelho/.test(document.querySelector('.postits')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {});
  ok(await pg.evaluate(() => /Só neste aparelho/.test(document.querySelector('.postits')?.textContent ?? '')), 'rascunho: a grade marca a entrada como "Só neste aparelho"');
  await pg.click(`${alvo} .p-abrir`); await pg.waitForSelector('[data-leitura]');
  const texto = await pg.textContent('.modal');
  ok(/Há alterações só neste aparelho/.test(texto) && /Retomar edição/.test(texto), 'rascunho: a leitura informa que há alterações só neste aparelho e oferece retomar');
  ok(!(await pg.$('#e-texto')) && !/TEXTO SÓ NO APARELHO/.test(await pg.textContent('[data-leitura]')), 'rascunho: não entra em edição sozinha e a leitura mostra a versão salva');
  ok(await pg.evaluate(() => [...document.querySelectorAll('.modal .acoes-entrada button')].every((b) => b.disabled)), 'rascunho: as ações da janela ficam desativadas enquanto o rascunho espera');
  await pg.waitForTimeout(3000); // mais que o salvamento automático (1,2 s): nada pode ter sido enviado
  ok(/Só neste aparelho/.test(await pg.textContent('.modal .estado-entrada')), 'rascunho: passados 3 s, continua "só neste aparelho" (nada foi enviado em silêncio)');
  await pg.click('.modal .btn:has-text("Fechar")'); await janelaFechada(pg);
  ok(await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('dmanda:rascunhos') || '{}')).some((k) => k.startsWith('e:') && k !== 'e:nova')), 'rascunho: fechar a leitura mantém o rascunho no aparelho');
  await ir(pg, '/entradas'); await pg.click(`${alvo} .p-abrir`); await pg.waitForSelector('[data-leitura]');
  ok(!/TEXTO SÓ NO APARELHO/.test(await pg.textContent('[data-leitura]')), 'rascunho: depois de recarregar, o banco ainda tem a versão antiga');
  await pg.click('.modal .btn:has-text("Retomar edição")'); await pg.waitForSelector('#e-texto');
  ok(/TEXTO SÓ NO APARELHO/.test(await pg.inputValue('#e-texto')) && (await pg.evaluate(() => document.activeElement?.id)) === 'e-texto', 'rascunho: Retomar edição abre o rascunho no campo, com o foco no texto');
  await esperaEstado(pg, 'salvo');
  await pg.click('.modal .btn:has-text("Voltar à leitura")'); await pg.waitForSelector('[data-leitura]');
  ok(/TEXTO SÓ NO APARELHO/.test(await pg.textContent('[data-leitura]')), 'rascunho: retomado, salvo no Dmanda e visível na leitura');
  await pg.click('.modal .btn:has-text("Fechar")'); await janelaFechada(pg);
  await ctx.close();
}

// ============ Entradas: descrição abaixo do título, carimbo da criação (criado_em) ============
{ // nota de título e texto muito longos, criada uma vez; o rodapé de recém-salva mostra o carimbo
  const pg = desk.pg; await ir(pg, '/entradas');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto'); await pg.fill('#e-titulo', 'T'.repeat(160)); await pg.fill('#e-texto', 'Texto muito longo. '.repeat(120) + '#longo'); await esperaEstado(pg, 'salvo');
  const rodape = (await pg.textContent('.modal .estado-entrada')).trim();
  ok(/^Criada em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/.test(rodape), `entrada recém-salva: o rodapé mostra o carimbo da criação no lugar de "Salvo no Dmanda" ("${rodape}")`);
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
}
for (const [nome, browser, opcoes, tema] of [['iPhone escuro', nav, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, 'escuro'], ...(wk ? [['WebKit iPhone 13', wk, { ...devices['iPhone 13'] }, 'claro']] : []), ['computador claro', nav, { viewport: { width: 1360, height: 800 } }, 'claro']]) { // o computador vai por último: ele edita, arquiva e recupera a nota
  const { ctx, pg } = await abrir(browser, opcoes, { tema });
  await ir(pg, '/entradas');
  const lay = await pg.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom }; };
    const ref = document.createElement('p'); ref.className = 'desc'; document.querySelector('.app').appendChild(ref); const rc = getComputedStyle(ref);
    const out = { ref: [rc.fontFamily, rc.fontSize, rc.color], notas: [...document.querySelectorAll('.postits .postit')].map((p) => {
      const d = p.querySelector('.p-desc'), tt = p.querySelector('.p-txt'), tg = p.querySelector('.p-tags'), dt = p.querySelector('.p-data'), pr = r(p);
      const cs = d && !d.classList.contains('oculto') ? getComputedStyle(d) : null;
      const itens = [tt, cs ? d : null, getComputedStyle(tg).display === 'none' ? null : tg, dt].filter(Boolean);
      return { id: p.getAttribute('data-id'), titulo: !!p.querySelector('.p-txt.tit'), temDesc: !!cs, descTxt: d?.textContent ?? null, tit: tt.textContent, fonte: cs ? [cs.fontFamily, cs.fontSize, cs.color] : null, tamanho: cs ? parseFloat(cs.fontSize) : 99,
        dentro: itens.every((x) => r(x).b <= pr.b + 0.5 && r(x).t >= pr.t - 0.5), ordem: itens.every((x, i) => i === 0 || r(itens[i - 1]).b <= r(x).t + 1.5), semBarra: [tt, d, dt].filter(Boolean).every((x) => x.scrollWidth <= x.clientWidth + 1), data: dt.textContent }; }) };
    ref.remove(); return out;
  });
  const com = lay.notas.find((n) => /Reunião com o jurídico/.test(n.tit)), semT = lay.notas.find((n) => /Ligar para a gráfica/.test(n.tit)), longa = lay.notas.find((n) => n.tit.startsWith('TTTT'));
  ok(com.titulo && (browser !== nav ? true : com.temDesc && /^Levar o parecer impresso\./.test(com.descTxt) && !/#/.test(com.descTxt)), `${nome}: post-it com título mostra o texto como descrição abaixo dele, sem as tags`);
  ok((com.fonte === null ? browser !== nav : JSON.stringify(com.fonte) === JSON.stringify(lay.ref)) && com.tamanho >= 10, `${nome}: a descrição usa a mesma fonte, tamanho e cor secundária da descrição das demandas (.desc)`);
  ok(!semT.titulo && !semT.temDesc, `${nome}: post-it sem título mostra só o texto, sem duplicar como descrição`);
  ok(lay.notas.every((n) => n.dentro && n.ordem && n.semBarra), `${nome}: título, descrição, tags e carimbo dentro do post-it, em ordem e sem sobreposição (inclusive com conteúdo muito longo)`);
  const exp = await pg.evaluate(() => fetch('/api/exportar').then((r) => r.json()));
  const brasilia = (iso) => { const d = new Date(Date.parse(iso) - 3 * 3600e3).toISOString(); return `Criada em ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} às ${d.slice(11, 16)}`; };
  const todasArquivo = [...exp.entradas, ...exp.entradas_arquivadas];
  ok(lay.notas.length >= 3 && lay.notas.every((n) => n.data === brasilia(todasArquivo.find((e) => e.id === n.id).criado_em).replace('Criada em ', '')) && /^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/.test(longa.data), `${nome}: todo post-it mostra criado_em (Brasília, sem segundos) no pé`);
  if (nome === 'computador claro') {
    const alvo = com.id, criado0 = exp.entradas.find((e) => e.id === alvo).criado_em;
    await pg.waitForTimeout(1500);
    await pg.click(`.postit[data-id="${alvo}"] .p-abrir`); await pg.waitForSelector('[data-leitura]');
    ok((await pg.textContent('.modal .estado-entrada')).trim() === brasilia(criado0) && /Levar o parecer impresso\.\nConferir/.test(await pg.evaluate(() => document.querySelector('.ler-corpo').innerText)), 'consulta: texto completo e carimbo da criação no rodapé');
    await pg.click('.modal [aria-label="Editar a entrada"]'); await pg.waitForSelector('#e-texto'); await pg.fill('#e-texto', 'Texto editado depois. #juridico'); await esperaEstado(pg, 'salvo');
    ok((await pg.textContent('.modal .estado-entrada')).trim() === brasilia(criado0), 'depois de editar e salvar, o carimbo continua o da criação (não o da edição)');
    await pg.click('.modal .acoes-entrada button:has-text("Arquivar")'); await janelaFechada(pg);
    const ex2 = await pg.evaluate(() => fetch('/api/exportar').then((r) => r.json())), arq = ex2.entradas_arquivadas.find((e) => e.id === alvo);
    ok(arq.criado_em === criado0 && arq.atualizado_em > criado0, 'arquivada: criado_em intacto e atualizado_em diferente (nunca usado como carimbo)');
    await ir(pg, '/arquivo'); await pg.click('.tabs [data-aba="entradas"]'); await pg.waitForSelector('.linha:has-text("Reunião com o jurídico")');
    await pg.click('.linha:has-text("Reunião com o jurídico") .btn:has-text("Abrir")'); await pg.waitForSelector('[data-leitura]');
    ok((await pg.textContent('.modal .estado-entrada')).trim() === brasilia(criado0), 'no Arquivo, a consulta da entrada arquivada mostra o mesmo carimbo');
    await pg.click('.modal .acoes-entrada button:has-text("Recuperar")'); await pg.waitForFunction(() => /Arquivar/.test(document.querySelector('.modal .acoes-entrada')?.textContent ?? ''), null, { timeout: 10000 });
    ok((await pg.textContent('.modal .estado-entrada')).trim() === brasilia(criado0), 'depois de recuperar, o carimbo continua o mesmo');
    await pg.click('.modal .btn:has-text("Fechar")'); await janelaFechada(pg);
    // a janela com sala de espera: aviso de conteúdo só local não mexe no carimbo
    await foto(pg, 'entradas-descricao-carimbo');
  }
  await foto(pg, `entradas-grade-${nome.replace(/[^a-z0-9]+/gi, '-')}`);
  await ctx.close();
}

// ============ navegação: Arquivadas em Demandas e em Entradas, mesma página /arquivo ============
for (const [nome, opcoes, tema, toque] of [['computador escuro', { viewport: { width: 1360, height: 800 } }, 'escuro', false], ['iPad 820', { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }, 'claro', true], ['iPhone 390 claro', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, 'claro', true], ['iPhone 390 escuro', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, 'escuro', true]]) {
  const { ctx, pg } = await abrir(nav, opcoes, { tema });
  const clicar = (sel) => (toque ? pg.tap(sel) : pg.click(sel));
  const aba = () => pg.evaluate(() => document.querySelector('.tabs [aria-pressed="true"]')?.getAttribute('data-aba'));
  await ir(pg, '/demandas');
  const b = await pg.evaluate(() => { const x = document.querySelector('.toolbar [aria-label="Ver demandas arquivadas"]'), r = x.getBoundingClientRect(), tb = document.querySelector('.toolbar').getBoundingClientRect(); const bs = [...document.querySelectorAll('.toolbar > .btn')].map((e) => e.getBoundingClientRect()); return { w: r.width, h: r.height, tx: getComputedStyle(x.querySelector('.tx')).display, dentro: bs.every((q) => q.left >= tb.left - 1 && q.right <= tb.right + 1), semSobrepor: bs.every((q, i) => bs.every((o, j) => i === j || q.right <= o.left + 1 || o.right <= q.left + 1 || q.bottom <= o.top + 1 || o.bottom <= q.top + 1)), doc: document.documentElement.scrollWidth <= innerWidth }; });
  ok(b.w >= 32 && b.h >= 32 && b.dentro && b.semSobrepor && b.doc && (opcoes.viewport.width >= 900 ? b.tx !== 'none' : b.tx === 'none'), `${nome}: botão "Ver demandas arquivadas" na barra de Demandas, dentro dela e sem sobrepor (${Math.round(b.w)}x${Math.round(b.h)}, texto ${b.tx})`);
  await foto(pg, `demandas-barra-${nome.replace(/[^a-z0-9]+/gi, '-')}`);
  // caminho 1: Entradas > Arquivadas deixa a aba Entradas; depois Demandas > Arquivadas tem de abrir a aba Demandas
  await ir(pg, '/entradas'); await clicar('.toolbar [aria-label="Ver entradas arquivadas"]'); await pg.waitForSelector('.tabs [data-aba]'); await pg.waitForFunction(() => /Para arquivar/.test(document.querySelector('.main').textContent), null, { timeout: 15000 }).catch(() => {});
  ok(pg.url().endsWith('/arquivo') && (await aba()) === 'entradas' && /Para arquivar/.test(await pg.textContent('.main')), `${nome}: Entradas > Arquivadas abre /arquivo na aba Entradas, com a lista`);
  await pg.evaluate(() => history.back()); await pg.waitForSelector('.toolbar [aria-label="Nova entrada"]');
  await pg.evaluate(() => { const l = [...document.querySelectorAll('.side .navi, .bar button, .bar a')].find((e) => /^\s*Demandas\s*$/.test(e.textContent)); l.click(); });
  await pg.waitForSelector('.toolbar [aria-label="Ver demandas arquivadas"]');
  await clicar('.toolbar [aria-label="Ver demandas arquivadas"]'); await pg.waitForSelector('.tabs [data-aba]'); await pg.waitForTimeout(300);
  ok(pg.url().endsWith('/arquivo') && (await aba()) === 'demandas' && /Só origem/.test(await pg.textContent('.main')), `${nome}: Demandas > Arquivadas abre /arquivo na aba Demandas, mesmo com a última visita na aba Entradas`);
  // troca de abas e consulta/recuperação preservadas
  await clicar('.tabs [data-aba="entradas"]'); await pg.waitForFunction(() => document.querySelector('.tabs [data-aba="entradas"]')?.getAttribute('aria-pressed') === 'true'); await clicar('.tabs [data-aba="demandas"]');
  await pg.waitForSelector('.linha:has-text("Só origem") .btn:has-text("Desarquivar")'); await pg.waitForSelector('.linha:has-text("Só origem") .btn:has-text("Excluir")');
  ok((await aba()) === 'demandas', `${nome}: troca de abas funciona e as ações Abrir, Desarquivar e Excluir seguem na lista`);
  // caminho 2: Mais > Arquivo (acesso geral) mostra a última aba e funciona
  await ir(pg, '/mais'); await clicar('.navi.grande:has-text("Arquivo")'); await pg.waitForSelector('.tabs [data-aba]');
  ok(pg.url().endsWith('/arquivo') && ['demandas', 'entradas'].includes(await aba()), `${nome}: Mais > Arquivo continua abrindo a página geral`);
  await ctx.close();
}

await nav.close(); if (wk) await wk.close();
console.log('\nErros de página: ' + (erros.length ? '\n' + erros.slice(0, 5).join('\n') : 'nenhum'));
console.log(`\n${total - falhas} de ${total} verificações passaram${falhas ? `, ${falhas} FALHARAM` : ''}.${wk ? '' : ' (WebKit não rodou)'}`);
process.exit(falhas || erros.length ? 1 : 0);
