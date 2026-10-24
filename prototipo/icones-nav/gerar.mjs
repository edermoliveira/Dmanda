// Gera ../icones-nav.js a partir dos SVGs oficiais do Ionicons 8.0.13 (outline) que ficam em imagens/figma-kit/icones/.
// Os desenhos entram como estão (viewBox 512, traço currentColor, largura 32); a cor vem do controle porque o SVG vai
// dentro da página (um <img> apontando para o arquivo não herdaria currentColor). Uso (nesta pasta): node gerar.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const PASTA = new URL('../../imagens/figma-kit/icones/', import.meta.url);
const MAPA = { 'nav-inicio': 'inicio__home-outline__outline.svg', 'nav-entradas': 'entradas__file-tray-full-outline__outline.svg', 'nav-demandas': 'demandas__clipboard-outline__outline.svg',
  'nav-agenda': 'agenda__today-outline__outline.svg', 'nav-documentos': 'documentos__document-text-outline__outline.svg', 'nav-ia': 'ia__bulb-outline__outline.svg', 'nav-config': 'configuracoes__settings-outline__outline.svg' };
const corpo = {};
for (const [nome, arq] of Object.entries(MAPA)) {
  const svg = readFileSync(new URL(arq, PASTA), 'utf8').trim();
  const m = svg.match(/^<svg[^>]*viewBox="0 0 512 512"[^>]*>([\s\S]*)<\/svg>$/);
  if (!m) throw new Error(arq + ': formato inesperado');
  corpo[nome] = m[1];
}
writeFileSync(new URL('../icones-nav.js', import.meta.url), '// Gerado por icones-nav/gerar.mjs. Ionicons 8.0.13, outline (MIT, ver icones-nav/LICENSE-MIT.txt). Só os 7 ícones do menu de navegação.\n// Cada corpo é o SVG original, sem alteração; o viewBox é 0 0 512 512.\nwindow.ICONES_NAV = ' + JSON.stringify(corpo) + ';\n');
console.log('icones-nav.js gerado com', Object.keys(corpo).length, 'ícones');
