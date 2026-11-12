// Capturas e testes de navegação da prévia da Semana (dados fictícios). Sobe o próprio servidor.
// Uso, da raiz do repositório (depois de npm ci): node prototipo/agenda-semana/testes/capturar.mjs
// Grava as capturas em prototipo/agenda-semana/capturas/. Código de saída 1 se algo falhar.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { subir } from './servidor.mjs';

const SAIDA = fileURLToPath(new URL('../capturas/', import.meta.url));
const srv = await subir();
const U = `${srv.url}/index.html`;
const nav = await chromium.launch({ channel: 'msedge', headless: true });
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const tamanhos = { computador: [1335, 900], ipad: [820, 1180], celular: [390, 844] };
for (const [nome, [w, h]] of Object.entries(tamanhos)) {
  for (const tema of ['claro', 'escuro']) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: nome === 'celular' ? 2 : 1, hasTouch: nome !== 'computador' });
    const pg = await ctx.newPage();
    await pg.goto(`${U}#tema=${tema}${nome === 'computador' ? '&largo=1' : ''}`);
    await pg.waitForSelector('.dia');
    await pg.evaluate(() => document.fonts.ready);
    ok((await pg.$$('.dia[data-sel]')).length === 0 && (await pg.$$('.dia[data-hoje]')).length === 1, `${nome} ${tema}: abre recolhida, com hoje destacado`);
    await pg.screenshot({ path: `${SAIDA}${nome}-${tema}-semana.png`, fullPage: true });
    if (tema === 'claro') {
      await pg.click('.rotulo[data-d="2026-11-13"]');
      await pg.waitForTimeout(150);
      ok((await pg.$$('.dia[data-sel] .ficha')).length === 5, `${nome}: sexta aberta com 5 fichas`);
      await pg.screenshot({ path: `${SAIDA}${nome}-${tema}-sexta.png`, fullPage: true });
      await pg.click('.rotulo[data-d="2026-11-10"]');
      ok(/Nada marcado/.test(await pg.textContent('.dia[data-sel]')), `${nome}: dia livre selecionado mostra o vazio`);
      await pg.click('#prox');
      await pg.waitForTimeout(100);
      ok(/16 a 22 de novembro/.test(await pg.textContent('#periodo')) && (await pg.getAttribute('.dia[data-sel]', 'data-d')) === '2026-11-17', `${nome}: próxima semana e dia selecionado acompanha`);
      await pg.screenshot({ path: `${SAIDA}${nome}-${tema}-proxima.png`, fullPage: true });
      await pg.click('#hoje');
      ok((await pg.getAttribute('.dia[data-hoje]', 'data-d')) === '2026-11-12' && (await pg.isDisabled('#hoje')), `${nome}: Hoje volta e fica desativado`);
      ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nome}: sem rolagem horizontal`);
      const nomes = await pg.$$eval('.rotulo .nome', (n) => n.map((x) => x.firstChild.textContent.trim()));
      ok(nomes.length === 7 && nomes[0] === 'SEG' && nomes[6] === 'DOM', `${nome}: sete dias, de segunda a domingo`);
    }
    await ctx.close();
  }
}
await nav.close();
srv.fechar();
console.log(falhas ? `${falhas} falha(s)` : 'todas as verificações passaram');
process.exit(falhas ? 1 : 0);
