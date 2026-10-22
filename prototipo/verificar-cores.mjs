// Confere que o protótipo nunca usa branco ou preto absolutos (#FFFFFF e #000000).
// Branco = #FCFCFC, preto = #0A0A0A. Uso: node verificar-cores.mjs (dentro da pasta prototipo).
import { readFileSync } from 'node:fs';

const arquivos = ['estilo.css', 'tema.css', 'v3.css', 'app.js', 'extra.js'];
const regras = [
  [/#fff(?![0-9a-f])/i, '#FFF ou #FFFFFF'],
  [/#ffffff(?![0-9a-f])/i, '#FFFFFF'],
  [/#000(?![0-9a-f])/i, '#000 ou #000000'],
  [/rgba?\(\s*255\s*,\s*255\s*,\s*255/i, 'rgb(255,255,255)'],
  [/rgba?\(\s*0\s*,\s*0\s*,\s*0\b/i, 'rgb(0,0,0)'],
  [/hsla?\(\s*\d+\s+\d+%\s+100%/i, 'hsl com luminosidade 100%'],
  [/hsla?\(\s*\d+\s+\d+%\s+0%[\s)/]/i, 'hsl com luminosidade 0%'],
  [/:\s*(white|black)\b/i, 'palavra white ou black'],
];
let erros = 0;
for (const a of arquivos) {
  readFileSync(a, 'utf8').split('\n').forEach((linha, i) => {
    for (const [re, nome] of regras) {
      if (re.test(linha)) { erros++; console.log(`${a}:${i + 1}: ${nome}`); }
    }
  });
}
console.log(erros ? `${erros} ocorrência(s) proibida(s).` : 'Nenhum branco ou preto absoluto. OK.');
process.exit(erros ? 1 : 0);
