// Medição da Agenda (bloco de 12/11/2026): altura de cada visão em telas de computador, iPad em pé e celular, nos dois temas, e a conferência de que o balão de Humor cobre ou não
// os controles da barra. Usa a prévia que já está de pé (padrão http://localhost:7100, cenário fictício) e NÃO grava nada no banco: só lê e escreve um JSON em .dados-teste/medicoes/.
// Uso: node scripts/medir-agenda.mjs <rótulo> [base]      (exemplo: node scripts/medir-agenda.mjs antes)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const rotulo = process.argv[2] || 'medida', BASE = process.argv[3] || 'http://localhost:7100';
const TELAS = [
  ['computador', { viewport: { width: 1440, height: 900 } }],
  ['ipad-em-pe', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }],
  ['celular', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions'] });
const saida = { rotulo, quando: new Date().toISOString(), base: BASE, telas: {}, balao: {} };

for (const [nomeTela, opcoes] of TELAS) {
  for (const tema of ['claro', 'escuro']) {
    for (const modo of ['mes', 'semana', 'hoje']) {
      const ctx = await nav.newContext(opcoes);
      await ctx.addInitScript(([t, m]) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:agenda', JSON.stringify({ modo: m, cat: 'tudo' })); } catch { /* sem armazenamento */ } }, [tema, modo]);
      const pg = await ctx.newPage();
      await pg.goto(BASE + '/agenda', { waitUntil: 'load', timeout: 120000 });
      await pg.waitForSelector('.agd', { timeout: 120000 });
      await pg.waitForFunction(() => !/Carregando a agenda/.test(document.body.innerText), null, { timeout: 60000 });
      await pg.waitForTimeout(1800);
      // o convite "Completar os últimos dias" abre primeiro e segura o balão; depois de "Agora não" o balão de Humor aparece
      await pg.locator('.modal button:has-text("Agora não")').first().click({ timeout: 2500 }).catch(() => {});
      await pg.waitForSelector('.balao', { timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(600);
      // o balão de Humor aparece depois de um instante: antes de fechá-lo, vê o que ele cobre na barra da Agenda
      const cobertos = await pg.evaluate(() => {
        const b = document.querySelector('.balao');
        const alvos = [...document.querySelectorAll('.agd-barra button, .agd-barra input, .agd-barra label, .agd-nav button, .agd-nav input, .agd-novo, .agd-filtros button, .agd-filtros input, .agd-filtros label')];
        const r = b ? b.getBoundingClientRect() : null;
        const lista = alvos.map((e) => { const q = e.getBoundingClientRect(); if (!q.width || !q.height) return null; const x = q.x + q.width / 2, y = q.y + q.height / 2; const topo = document.elementFromPoint(x, y); return { texto: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30), x: Math.round(x), y: Math.round(y), coberto: !!b && !!topo && b.contains(topo), visivel: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight }; }).filter(Boolean);
        return { balao: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null, cobertos: lista.filter((l) => l.coberto && l.visivel).map((l) => l.texto) };
      });
      if (modo === 'mes') saida.balao[`${nomeTela}-${tema}`] = cobertos;
      await pg.locator('.balao .icbtn-s, .balao button[aria-label*="echar"]').first().click({ timeout: 2000 }).catch(() => {});
      await pg.waitForTimeout(400);
      const m = await pg.evaluate(() => {
        const a = document.querySelector('.agd').getBoundingClientRect();
        const rolante = document.querySelector('.main') || document.scrollingElement;
        return { alturaAgenda: Math.round(a.height), alturaDocumento: Math.round(document.documentElement.scrollHeight), alturaRolagemMain: Math.round(rolante.scrollHeight), janela: innerHeight, rolagemHorizontal: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      m.telas = +(m.alturaAgenda / m.janela).toFixed(2);
      saida.telas[`${nomeTela}-${tema}-${modo}`] = m;
      await ctx.close();
    }
  }
}
await nav.close();
mkdirSync('.dados-teste/medicoes', { recursive: true });
const arq = `.dados-teste/medicoes/agenda-${rotulo}.json`;
writeFileSync(arq, JSON.stringify(saida, null, 1));
for (const [k, v] of Object.entries(saida.telas)) console.log(k.padEnd(32), `agenda ${String(v.alturaAgenda).padStart(5)} px (${v.telas} telas)`, v.rolagemHorizontal ? 'ROLAGEM HORIZONTAL' : '');
console.log('balão:', JSON.stringify(saida.balao));
console.log('gravado em', arq);
