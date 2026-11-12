// Gera as duas comparações (computador; iPad e celular) a partir de comparacao.html, com as capturas já feitas.
// Uso, da raiz do repositório: node prototipo/agenda-semana/testes/comparar.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { subir } from './servidor.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const srv = await subir();
const nav = await chromium.launch({ channel: 'msedge', headless: true });
const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
await pg.goto(`${srv.url}/comparacao.html`);
await pg.evaluate(() => document.fonts.ready);
await pg.addStyleTag({ content: '#mv{display:none}' });
await pg.screenshot({ path: `${RAIZ}comparacao-computador.png`, fullPage: true });
await pg.addStyleTag({ content: '#pc{display:none}#mv{display:block}' });
await pg.setViewportSize({ width: 1800, height: 900 });
await pg.screenshot({ path: `${RAIZ}comparacao-ipad-celular.png`, fullPage: true });
await nav.close();
srv.fechar();
console.log('comparações gravadas em', RAIZ);
