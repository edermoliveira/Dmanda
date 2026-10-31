// Órbita (30/10/2026): preferências visuais, Início (anel, indicadores, calendário de carga), geometria e acessibilidade, no Edge com banco de TESTE (porta 7108).
// NÃO valida o Supabase real nem o iPhone físico (celular e iPad aqui são emulação). Uso: node scripts/testar-orbita.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';

const PORTA = '7108', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/orbita';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions'] });
const erros = [];
const abrir = async (opcoes, tema) => {
  const ctx = await nav.newContext(opcoes);
  if (tema) await ctx.addInitScript((t) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, tema);
  const pg = await ctx.newPage(); pg.setDefaultTimeout(30000); pg.on('pageerror', (e) => erros.push(e.message.slice(0, 300))); return pg;
};
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando as (entradas|demandas)/.test(document.body.innerText), null, { timeout: 120000 }); await pg.waitForTimeout(1000);
};
const cadastrar = async (pg, c) => {
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', c.assunto); if (c.numero) await pg.fill('#n-num', c.numero);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  if (c.prazo) await pg.fill('#n-prazo', c.prazo);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal'));
};
const LONGO = 'Solicitação de reequilíbrio econômico-financeiro do contrato de coleta de resíduos sólidos urbanos, com revisão dos índices e das planilhas de custos do exercício anterior';
const definirValor = (pg, sel, v) => pg.$eval(sel, (el, val) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
const tok = (pg, nome) => pg.evaluate((n) => getComputedStyle(document.querySelector('.app')).getPropertyValue(n).trim().toUpperCase(), nome);

// ---- semeia (datas fixas em torno de 30/10/2026, a data de hoje desta máquina de teste) ----
const semear = await abrir({ viewport: { width: 1360, height: 800 } }, 'claro');
await ir(semear, '/demandas');
for (const d of [{ assunto: 'Atrasada de ontem', prazo: '2026-10-28' }, { assunto: 'Vence hoje', prazo: '2026-10-30' }, { assunto: LONGO, numero: '123/2026', prazo: '2026-10-30' }, { assunto: 'Vence quinta', prazo: '2026-11-05' }, { assunto: 'Sem prazo' }]) await cadastrar(semear, d);
await semear.context().close();

// ---- preferências: claro por padrão, persistência por aparelho, tamanho do texto, cores com contraste ----
{
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 860 }, colorScheme: 'dark' }); // sistema escuro, sem escolha salva: o app começa no claro
  const pg = await ctx.newPage(); pg.setDefaultTimeout(30000); pg.on('pageerror', (e) => erros.push(e.message.slice(0, 300)));
  const msgs = []; pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) msgs.push(m.text().slice(0, 200)); });
  await ir(pg, '/config');
  ok(await pg.evaluate(() => document.documentElement.dataset.tema) === 'claro' && await pg.evaluate(() => document.querySelector('.app').dataset.tema) === 'claro', 'sem preferência salva o app começa no claro, mesmo com o sistema escuro');
  await pg.click('.ap-seg button:has-text("Escuro")');
  ok(await pg.evaluate(() => document.querySelector('.app').dataset.tema) === 'escuro', 'Configurações: Escuro troca o modo na hora');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => document.documentElement.dataset.tema) === 'escuro' && await pg.evaluate(() => document.querySelector('.app').dataset.tema) === 'escuro', 'a última escolha é respeitada depois de recarregar');
  ok(await tok(pg, '--bgbase') === '#080A0C', 'padrão escuro: fundo #080A0C');
  const h1a = await pg.$eval('.pagehead h1', (x) => parseFloat(getComputedStyle(x).fontSize));
  await definirValor(pg, '#ap-escala', '1.3'); await pg.waitForTimeout(200);
  const h1b = await pg.$eval('.pagehead h1', (x) => parseFloat(getComputedStyle(x).fontSize));
  ok(Math.abs(h1b / h1a - 1.3) < 0.02 && /130%/.test(await pg.textContent('output')), `tamanho do texto a 130% amplia os títulos na mesma proporção (${h1a} para ${h1b} px) e a prévia mostra o valor`);
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await pg.waitForTimeout(500);
  ok(Math.abs(parseFloat(await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--esc'))) - 1.3) < 0.001, 'o tamanho do texto escolhido persiste depois de recarregar');
  await definirValor(pg, 'input[type="color"][aria-label^="Cor de texto"]', '#202020');
  ok(/difícil de ler/.test(await pg.textContent('.ap-aviso')) && await pg.evaluate(() => !document.documentElement.style.getPropertyValue('--u-texto')), 'texto escuro sobre fundo escuro é recusado com explicação e nada muda');
  await definirValor(pg, 'input[type="color"][aria-label^="Cor de acento"]', '#7a8fa8');
  ok(await pg.evaluate(() => document.documentElement.style.getPropertyValue('--u-acento').toUpperCase()) === '#7A8FA8' && await tok(pg, '--acc') === '#7A8FA8', 'acento com contraste suficiente passa a valer em todo o app');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForSelector('.app .main'); await pg.waitForTimeout(500);
  ok(await tok(pg, '--acc') === '#7A8FA8', 'a cor escolhida persiste depois de recarregar');
  ok(await tok(pg, '--perigo') === '#FF7B73', 'a cor de atraso e erro não muda com a personalização');
  await pg.click('button:has-text("Restaurar padrão Órbita")');
  ok(await pg.evaluate(() => !document.documentElement.style.getPropertyValue('--u-acento')) && await tok(pg, '--acc') === '#6F8096' && Math.abs(parseFloat(await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--esc'))) - 1) < 0.001, 'Restaurar padrão Órbita devolve cores e tamanho originais');
  ok(await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('dmanda:cores') || '{}')).length === 0), 'a restauração limpa o que estava guardado');
  const ctx2 = await nav.newContext({ viewport: { width: 1360, height: 860 } }); const pg2 = await ctx2.newPage(); await ir(pg2, '/config');
  ok(await pg2.evaluate(() => document.documentElement.dataset.tema) === 'claro', 'outro aparelho (outro navegador) não herda a escolha: começa no claro');
  const baixos = await pg.$$eval('.cfg-bloco button, .cfg-bloco input[type="color"], .cfg-bloco input[type="range"]', (l) => l.map((x) => Math.round(x.getBoundingClientRect().height)).filter((h) => h < 40));
  ok(baixos.length === 0, `controles de Aparência com altura de toque adequada (menores que 40 px: ${JSON.stringify(baixos)})`);
  ok(!msgs.some((m) => /hydrat|did not match/i.test(m)), 'sem aviso de hidratação no console' + (msgs.length ? ' ' + JSON.stringify(msgs.slice(0, 2)) : ''));
  await ctx.close(); await ctx2.close();
}

// ---- Início: geometria do Órbita no celular de 393 px ----
for (const tema of ['escuro', 'claro']) {
  const pg = await abrir({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, tema);
  await ir(pg, '/');
  const g = await pg.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: Math.round(b.x * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
    const cels = [...document.querySelectorAll('.o-grade .o-cel:not(.vazia)')];
    const grade = getComputedStyle(document.querySelector('.o-grade'));
    const fs = (s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
    return { painel: r('.o-hero'), anel: r('.o-anel'), kpi: r('.stats.tres .stat'), cel: cels[0].getBoundingClientRect().width, gap: grade.columnGap, colunas: grade.gridTemplateColumns.split(' ').length, vazias: document.querySelectorAll('.o-grade .o-cel.vazia').length,
      tr: parseFloat(getComputedStyle(document.querySelector('.o-anel .trilha')).strokeWidth), pct: fs('.o-pct'), titulo: fs('.pagehead h1'), kpiTxt: fs('.stats.tres .stat .n'), kpiN: document.querySelectorAll('.stats.tres .stat').length,
      gapK: getComputedStyle(document.querySelector('.stats.tres')).columnGap, rolagemH: document.documentElement.scrollWidth - document.documentElement.clientWidth, aria: document.querySelector('.o-anel').getAttribute('aria-label') };
  });
  ok(Math.abs(g.painel.w - 353) <= 1 && g.painel.x === 20 && g.painel.h >= 305 && g.painel.h <= 320, `${tema} 393 px: painel principal ${g.painel.w} x ${g.painel.h} px, margem ${g.painel.x} px (referência 353 x 309)`);
  ok(Math.abs(g.anel.w - 248) <= 1 && g.tr === 18, `${tema}: anel de ${g.anel.w} px com traço de ${g.tr} px`);
  ok(g.pct >= 56 && g.pct <= 64 && g.titulo >= 36 && g.titulo <= 40 && g.kpiTxt >= 26 && g.kpiTxt <= 28, `${tema}: display ${g.pct} px, título ${g.titulo} px, número dos indicadores ${g.kpiTxt} px dentro das faixas`);
  ok(g.kpiN === 3 && g.kpi.h >= 74 && Math.abs(g.kpi.w - 111) <= 2 && g.gapK === '10px', `${tema}: três indicadores de ${g.kpi.w} x ${g.kpi.h} px, gap ${g.gapK}`);
  ok(g.colunas === 7 && g.gap === '6px' && g.vazias === 4 && Math.abs(g.cel - 40) <= 1.5, `${tema}: calendário em ${g.colunas} colunas, gap ${g.gap}, células de ${g.cel.toFixed(1)} px, ${g.vazias} posições vazias antes do dia 1 (outubro de 2026 começa numa quinta)`);
  ok(g.rolagemH <= 0, `${tema}: sem rolagem horizontal no Início`);
  ok(/pendente/.test(g.aria), `${tema}: o anel tem texto acessível ("${g.aria}")`);
  await pg.click('.o-cel[aria-label^="30 de outubro"]');
  const s = await pg.evaluate(() => { const b = document.querySelector('.o-cel[aria-pressed="true"]'); return { ativo: !!b, sombra: b ? getComputedStyle(b).boxShadow : '', rotulo: b?.getAttribute('aria-label') ?? '', lista: document.querySelectorAll('.o-dia-lista .cards > *').length, aria: b ? parseFloat(getComputedStyle(b, '::after').inset) : 0, w: b ? b.getBoundingClientRect().width : 0 }; });
  ok(s.ativo && /2px/.test(s.sombra) && /itens? pendentes?/.test(s.rotulo) && s.lista >= 1, `${tema}: dia selecionado com contorno de 2 px, rótulo "${s.rotulo}" e a lista de demandas do dia (${s.lista})`);
  ok(s.w + 4 >= 44, `${tema}: área de toque da célula de ${Math.round(s.w + 4)} px (40 px visíveis mais 2 px de cada lado)`);
  // os dados semeados têm datas fixas (30/10/2026); a data real da máquina anda, então o indicador de hoje é conferido no dia que for hoje, e o nível de carga no dia 30
  const hoje = await pg.$eval('.o-cel[aria-label^="30 de outubro"]', (x) => ({ n: x.dataset.n }));
  const marcaHoje = await pg.$$eval('.o-cel[data-hoje="true"]', (xs) => xs.length);
  ok(Number(hoje.n) >= 1 && marcaHoje <= 1, `${tema}: o dia 30 tem nível de carga e o indicador de hoje aparece em no máximo um dia (${marcaHoje})`);
  await pg.click('.o-cel[aria-label^="30 de outubro"]');
  ok(await pg.evaluate(() => document.querySelectorAll('.o-cel[aria-pressed="true"]').length) === 0, `${tema}: clicar de novo desfaz a seleção`);
  await pg.focus('.o-cel[aria-label^="28 de outubro"]'); await pg.keyboard.press('Tab');
  ok(await pg.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; }), `${tema}: foco por teclado visível na célula`);
  await pg.click('button[aria-label="Próximo mês"]');
  ok(/novembro de 2026/i.test(await pg.textContent('.o-cal-topo h3')) && await pg.evaluate(() => document.querySelectorAll('.o-grade .o-cel.vazia').length) === 0, `${tema}: mês seguinte (novembro de 2026 começa num domingo: nenhuma posição vazia)`);
  await pg.click('button[aria-label="Mês anterior"]');
  await pg.click('.stat.st-atrasadas');
  ok(await pg.$eval('.stat.st-atrasadas', (x) => x.getAttribute('aria-pressed')) === 'true' && (await pg.textContent('.sec .sub-f')).includes('Atrasadas'), `${tema}: o filtro Atrasadas do Início continua funcionando`);
  await pg.context().close();
}

// ---- computador: dois módulos lado a lado ----
{
  const pg = await abrir({ viewport: { width: 1360, height: 860 } }, 'claro'); await ir(pg, '/');
  const d = await pg.evaluate(() => ({ a: document.querySelector('.o-coluna-a').getBoundingClientRect(), b: document.querySelector('.o-coluna-b').getBoundingClientRect(), h: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  ok(d.b.left > d.a.right - 1 && d.h <= 0, 'computador: painel principal e Foco do dia com calendário em duas colunas, sem rolagem lateral');
  await pg.context().close();
}
// ---- outras telas afetadas pelos componentes compartilhados ----
for (const [nome, vp] of [['iPhone', { width: 393, height: 852 }], ['iPad', { width: 820, height: 1100 }]]) for (const tema of ['claro', 'escuro']) {
  const pg = await abrir({ viewport: vp, hasTouch: true }, tema);
  for (const rota of ['/', '/demandas', '/entradas', '/config', '/arquivo']) { await ir(pg, rota); const h = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(h <= 0, `${nome} ${tema} ${rota}: sem rolagem horizontal`); }
  await pg.context().close();
}
ok(erros.length === 0, 'nenhum erro de página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await nav.close();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
