// Capturas do desenho Órbita (31 a 35: Início, Demandas, Entradas, Configurações) no Edge com banco de TESTE. Uso: CAPTURAS=pasta node scripts/capturar-orbita.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
const PORTA = '7107', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/visual-orbita', CAP = process.env.CAPTURAS || 'capturas-orbita';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true }); mkdirSync(CAP, { recursive: true });
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch {} await new Promise((r) => setTimeout(r, 2000)); }
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions'] });
const erros = [];
const abrir = async (opcoes, tema) => { const ctx = await nav.newContext(opcoes); if (tema) await ctx.addInitScript((t) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch {} }, tema); const pg = await ctx.newPage(); pg.setDefaultTimeout(30000); pg.on('pageerror', (e) => erros.push(e.message.slice(0, 300))); return pg; };
const ir = async (pg, rota) => { await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 }); await pg.waitForFunction(() => !/Carregando as (entradas|demandas)/.test(document.body.innerText), null, { timeout: 120000 }); await pg.waitForTimeout(1200); };
const cadastrar = async (pg, c) => {
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', c.assunto); if (c.numero) await pg.fill('#n-num', c.numero); if (c.origem) await pg.fill('#n-origem', c.origem);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  if (c.dias) await pg.click(`.modal .dias-btns button:has-text("${c.dias} dias")`);
  if (c.prazo) await pg.fill('#n-prazo', c.prazo);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal'));
};
const LONGO = 'Solicitação de reequilíbrio econômico-financeiro do contrato de coleta de resíduos sólidos urbanos, com revisão dos índices e das planilhas de custos do exercício anterior';
const sem = await abrir({ viewport: { width: 1360, height: 800 } }, 'claro');
await ir(sem, '/demandas');
for (const d of [{ assunto: 'Ofício curto', dias: 5 }, { assunto: LONGO, numero: '123/2026', origem: 'Secretaria de Planejamento', dias: 10 }, { assunto: 'Compra de papel', numero: '45/2026', origem: 'Compras', dias: 5 }, { assunto: 'Prazo longo', dias: 30 }, { assunto: 'Sem prazo' }, { assunto: 'Atrasada de ontem', prazo: '2026-10-28' }, { assunto: 'Vence hoje', prazo: '2026-10-30' }, { assunto: 'Vence quinta', prazo: '2026-11-05' }, { assunto: 'Outra de hoje', prazo: '2026-10-30' }, { assunto: 'Meio do mês', prazo: '2026-10-14' }]) await cadastrar(sem, d);
await sem.close();
const telas = [['inicio', '/'], ['demandas', '/demandas'], ['entradas', '/entradas'], ['config', '/config']];
const tamanhos = [['pc', { width: 1360, height: 860 }], ['ipad', { width: 820, height: 1100 }], ['iphone', { width: 393, height: 852 }]];
for (const tema of ['escuro', 'claro']) for (const [tn, vp] of tamanhos) {
  const pg = await abrir({ viewport: vp, deviceScaleFactor: 1, hasTouch: tn !== 'pc' }, tema);
  for (const [nome, rota] of telas) { await ir(pg, rota); await pg.screenshot({ path: `${CAP}/${nome}-${tema}-${tn}.png`, fullPage: nome === 'inicio' || nome === 'config' }); }
  await pg.context().close();
}
await nav.close();
console.log('erros de página:', erros.length ? erros.join(' | ') : 'nenhum');
process.exit(0);
