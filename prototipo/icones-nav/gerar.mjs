// Gera ../icones-nav.js a partir dos SVGs oficiais do Ionicons 8.0.13 (outline): os 7 de navegação ficam em imagens/figma-kit/icones/ e os das
// visualizações de Demandas (Cards, Tabela, Lista) e os de busca, filtros, ordenação e expansão em icones-nav/originais/.
// Os desenhos entram como estão (viewBox 512, traço currentColor, largura 32); a cor vem do controle porque o SVG vai
// dentro da página (um <img> apontando para o arquivo não herdaria currentColor). Uso (nesta pasta): node gerar.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const PASTA = new URL('../../imagens/figma-kit/icones/', import.meta.url);
const MAPA = { 'nav-inicio': 'inicio__home-outline__outline.svg', 'nav-entradas': 'entradas__file-tray-full-outline__outline.svg', 'nav-demandas': 'demandas__clipboard-outline__outline.svg',
  'nav-agenda': 'agenda__today-outline__outline.svg', 'nav-documentos': 'documentos__document-text-outline__outline.svg', 'nav-ia': 'ia__bulb-outline__outline.svg', 'nav-config': 'configuracoes__settings-outline__outline.svg' };
const PASTA_VIS = new URL('./originais/', import.meta.url);
const MAPA_VIS = { 'vis-cards': 'vis-cards__albums-outline.svg', 'vis-tabela': 'vis-tabela__grid-outline.svg', 'vis-lista': 'vis-lista__list-outline.svg',
  // busca, filtros, ordenação e expansão (escolhas de 25/10/2026)
  'busca': 'busca__search-outline.svg', 'filtro': 'filtro__funnel-outline.svg', 'ordem-sobe': 'ordem-crescente__arrow-up-outline.svg', 'ordem-desce': 'ordem-decrescente__arrow-down-outline.svg', 'expandir-grupo': 'expandir__chevron-down-outline.svg' };
const corpo = {};
for (const [nome, arq, pasta] of [...Object.entries(MAPA).map(([n, a]) => [n, a, PASTA]), ...Object.entries(MAPA_VIS).map(([n, a]) => [n, a, PASTA_VIS])]) {
  const svg = readFileSync(new URL(arq, pasta), 'utf8').trim();
  const m = svg.match(/^<svg[^>]*viewBox="0 0 512 512"[^>]*>([\s\S]*)<\/svg>$/);
  if (!m) throw new Error(arq + ': formato inesperado');
  corpo[nome] = m[1];
}
writeFileSync(new URL('../icones-nav.js', import.meta.url), '// Gerado por icones-nav/gerar.mjs. Ionicons 8.0.13, outline (MIT, ver icones-nav/LICENSE-MIT.txt). Os 7 ícones do menu de navegação os 3 das visualizações de Demandas (Cards, Tabela, Lista) e os 5 de busca, filtros, ordenação e expansão.\n// Cada corpo é o SVG original, sem alteração; o viewBox é 0 0 512 512.\nwindow.ICONES_NAV = ' + JSON.stringify(corpo) + ';\n');
console.log('icones-nav.js gerado com', Object.keys(corpo).length, 'ícones');
