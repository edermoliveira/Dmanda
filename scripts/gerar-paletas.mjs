// Gera o bloco de CSS dos dez destaques de Configurações (src/estilos/app.css, entre os marcadores PALETAS) com contraste conferido:
// texto do botão principal sobre o destaque a 4,5:1, texto de destaque sobre card, fundo e véu suave a 5:1, e o destaque como contorno/foco a 3:1 sobre o card.
// Parte dos valores do protótipo (matiz, saturação, luminosidade de cada modo) e só ajusta a luminosidade o mínimo necessário.
// Uso: node scripts/gerar-paletas.mjs          (imprime o bloco)       node scripts/gerar-paletas.mjs --gravar   (troca o bloco em app.css)
import { readFileSync, writeFileSync } from 'node:fs';

const PAL = [['Água-marinha', 170, 1], ['Céu', 200, 1], ['Oceano', 220, 1], ['Índigo', 245, 1], ['Violeta', 270, 1], ['Orquídea', 300, 1], ['Rosa', 330, 1], ['Âmbar', 42, 1], ['Oliva', 90, 1], ['Grafite', 220, 0.1]];
const hsl2rgb = (h, s, l) => { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)); };
const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const taxa = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const mistura = (f, a, b) => f.map((v, i) => v * a + b[i] * (1 - a));
const BRANCO = [252, 252, 252];
const MODOS = {
  claro: { card: [252, 252, 252], campo: [252, 252, 252], base: [242, 242, 247], nom: { l: 48, s: 72, t: 24, ts: 80, ink: 9, as: 0.18 }, passoAcc: -1, passoTxt: -1 },
  escuro: { card: [28, 28, 30], campo: [44, 44, 46], base: [10, 10, 10], nom: { l: 58, s: 78, t: 68, ts: 85, ink: 8, as: 0.16 }, passoAcc: 1, passoTxt: 1 },
};
const f2 = (n) => Math.round(n);
function calcular(h, k, modo) {
  const M = MODOS[modo], n = M.nom;
  // 1) destaque: luminosidade mais próxima do protótipo (nos dois sentidos) que sirva de contorno e de fundo do botão
  let melhor = null;
  for (let d = 0; d <= 40 && !melhor; d++) for (const L of d ? [n.l + d, n.l - d] : [n.l]) {
    if (L < 20 || L > 80) continue;
    const acc = hsl2rgb(h, n.s * k, L);
    if (taxa(acc, M.card) < 3.1 || taxa(acc, M.campo) < 3.1) continue;
    const escuro = hsl2rgb(h, 90 * k, n.ink), claro = BRANCO;
    const ink = taxa(escuro, acc) >= taxa(claro, acc) ? { rgb: escuro, css: `hsl(${h} ${f2(90 * k)}% ${n.ink}%)` } : { rgb: claro, css: 'hsl(0 0% 98.8%)' };
    if (taxa(ink.rgb, acc) < 4.7) continue;
    melhor = { L, acc, ink };
  }
  if (!melhor) throw new Error(`sem solução: ${h} ${modo}`);
  // 2) texto de destaque: do valor do protótipo na direção que aumenta o contraste, até 5:1 em card, campo, fundo e véu suave
  let T = n.t;
  for (; T > 8 && T < 95; T += M.passoTxt) {
    const t = hsl2rgb(h, n.ts * k, T), suave = (b) => mistura(melhor.acc, n.as, b);
    if ([M.card, M.campo, M.base].every((b) => taxa(t, b) >= 5) && [M.card, M.campo].every((b) => taxa(t, suave(b)) >= 4.6)) break;
  }
  return { L: melhor.L, ink: melhor.ink.css, T, s: f2(n.s * k), ts: f2(n.ts * k), as: n.as };
}
let css = '/* PALETAS: gerado por scripts/gerar-paletas.mjs (não editar à mão). Contraste conferido nos dois modos. */\n';
for (const modo of ['claro', 'escuro']) {
  PAL.forEach(([nome, h, k], i) => {
    const r = calcular(h, k, modo);
    const acc = `hsl(${h} ${r.s}% ${r.L}%)`, txt = `hsl(${h} ${r.ts}% ${r.T}%)`;
    css += `.app[data-dir="d"][data-tema="${modo}"][data-paleta="${i}"] { --acc: ${acc}; --acc-ink: ${r.ink}; --acc-soft: hsl(${h} ${r.s}% ${r.L}% / ${r.as}); --acc-text: ${txt}; --foco: ${modo === 'claro' ? acc : txt}; } /* ${nome} */\n`;
    css += `.app[data-dir="d"][data-tema="${modo}"] .cfg .sw[data-paleta="${i}"] i { background: linear-gradient(90deg, ${acc} 0 55%, ${txt} 55%); }\n`;
  });
}
css += '/* FIM PALETAS */\n';
if (process.argv.includes('--gravar')) {
  const p = 'src/estilos/app.css', s = readFileSync(p, 'utf8');
  const a = s.indexOf('/* PALETAS:'), b = s.indexOf('/* FIM PALETAS */');
  if (a < 0 || b < 0) { console.error('marcadores não encontrados'); process.exit(1); }
  writeFileSync(p, s.slice(0, a) + css.trimEnd() + s.slice(b + '/* FIM PALETAS */'.length));
  console.log('app.css atualizado.');
} else console.log(css);
