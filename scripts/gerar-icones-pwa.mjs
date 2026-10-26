// Gera os ícones da PWA (PNG) a partir da marca aprovada public/marca/icone-app.svg, sem redesenhar nada: o mesmo quadrado e o mesmo símbolo.
//  - icone-192.png e icone-512.png: ícones comuns (cantos arredondados da marca, fundo transparente nos cantos);
//  - icone-maskable-512.png: sem cantos (o sistema aplica a própria máscara), símbolo dentro da zona segura;
//  - src/app/apple-icon.png (180): o iOS exige quadrado opaco e arredonda sozinho.
// Usa o Edge instalado (playwright-core, como os demais scripts) para rasterizar o SVG. Uso: node scripts/gerar-icones-pwa.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const svg = readFileSync(new URL('../public/marca/icone-app.svg', import.meta.url), 'utf8');
if (!/<rect [^>]*rx="14"/.test(svg)) throw new Error('icone-app.svg mudou: conferir o gerador.');
const semCantos = svg.replace(/(<rect [^>]*?) rx="14"/, '$1');
mkdirSync(new URL('../public/icones/', import.meta.url), { recursive: true });

const navegador = await chromium.launch({ channel: 'msedge', headless: true });
async function png(fonte, lado, destino) {
  const pagina = await navegador.newPage({ viewport: { width: lado, height: lado }, deviceScaleFactor: 1 });
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(fonte.replace(/width="64" height="64"/, `width="${lado}" height="${lado}"`)).toString('base64');
  await pagina.setContent(`<style>html,body{margin:0;background:transparent}img{display:block}</style><img src="${uri}" width="${lado}" height="${lado}">`);
  await pagina.waitForFunction(() => document.images[0].complete);
  writeFileSync(destino, await pagina.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: lado, height: lado } }));
  await pagina.close();
  console.log('gerado', destino.pathname.split('/Dmanda/')[1] ?? destino.pathname);
}
await png(svg, 192, new URL('../public/icones/icone-192.png', import.meta.url));
await png(svg, 512, new URL('../public/icones/icone-512.png', import.meta.url));
await png(semCantos, 512, new URL('../public/icones/icone-maskable-512.png', import.meta.url));
await png(semCantos, 180, new URL('../src/app/apple-icon.png', import.meta.url));
await navegador.close();
