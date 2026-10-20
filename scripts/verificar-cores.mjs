// Confere se há cor "solta" no código. Só o globals.css pode ter valores de cor.
// Uso: npm run verificar:cores
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const pasta = "src";
const permitido = join("src", "app", "globals.css");

const regras = [
  [/#[0-9a-fA-F]{3,8}\b/, "valor hexadecimal"],
  [/\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb)\(/, "função de cor"],
  [
    /\b(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|divide|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)\b/,
    "cor padrão do Tailwind",
  ],
];

const arquivos = readdirSync(pasta, { recursive: true })
  .map((f) => join(pasta, f))
  .filter((f) => /\.(tsx?|css|mdx?)$/.test(f) && f !== permitido);

let achados = 0;
for (const arquivo of arquivos) {
  readFileSync(arquivo, "utf8")
    .split("\n")
    .forEach((linha, i) => {
      for (const [regex, tipo] of regras) {
        if (regex.test(linha)) {
          achados++;
          console.log(`${arquivo.split(sep).join("/")}:${i + 1}  ${tipo}: ${linha.trim()}`);
        }
      }
    });
}

if (achados) {
  console.log(`\n${achados} cor(es) solta(s). Use os nomes do design system (veja /tokens).`);
  process.exit(1);
}
console.log("Nenhuma cor solta no código.");
