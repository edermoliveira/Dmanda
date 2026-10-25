// Gera src/lib/icones-dados.ts a partir dos dicionários de ícones do protótipo (a referência aprovada): Ionicons (navegação e grupos escolhidos),
// Iconoir (padrão) e Lucide (reserva). Os desenhos entram sem alteração. Uso: node scripts/gerar-icones-app.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['icones.js', 'icones-iconoir.js', 'icones-nav.js']) vm.runInContext(readFileSync(new URL('../prototipo/' + f, import.meta.url), 'utf8'), ctx);
const { ICONES, ICONOIR, ICONES_NAV } = ctx.window;
const saida = '// Gerado por scripts/gerar-icones-app.mjs a partir de prototipo/icones*.js. Não editar à mão.\n// ICONES_NAV: Ionicons 8.0.13 outline (MIT), viewBox 512. ICONOIR e LUCIDE: viewBox 24.\n' +
  'export const ICONES_NAV: Record<string, string> = ' + JSON.stringify(ICONES_NAV) + ';\n' +
  'export const ICONOIR: Record<string, string> = ' + JSON.stringify(ICONOIR) + ';\n' +
  'export const LUCIDE: Record<string, string> = ' + JSON.stringify(ICONES) + ';\n';
writeFileSync(new URL('../src/lib/icones-dados.ts', import.meta.url), saida);
console.log('src/lib/icones-dados.ts:', Object.keys(ICONES_NAV).length, 'Ionicons,', Object.keys(ICONOIR).length, 'Iconoir,', Object.keys(ICONES).length, 'Lucide');
