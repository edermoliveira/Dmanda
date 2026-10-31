// Confere se há cor "solta" no código da aplicação (TS e TSX). Os valores de cor ficam nos arquivos de estilo (src/estilos/*.css, que não são varridos), em src/lib/cores-barra.ts, em src/lib/aparencia.ts (padrões e contraste da personalização, conferidos contra o orbita.css por testar-aparencia) e nos dados de ícones.
// Ficam de fora o design antigo (src/app/(antigo)) e src/components, que só ele usa.
// Uso: npm run verificar:cores
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const pasta = "src";
const ignorados = ["(antigo)", `${sep}components${sep}`, "icones-dados", "logo-dados", "cores-barra", "aparencia.ts", `${sep}proxy.ts`]; // proxy.ts: a página de "sem conexão" é um HTML solto, sem folha de estilo, e leva a cor inline

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
  .filter((f) => /\.tsx?$/.test(f) && !ignorados.some((i) => f.includes(i)));

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
  console.log(`\n${achados} cor(es) solta(s). Use as variáveis dos arquivos de estilo (src/estilos).`);
  process.exit(1);
}
console.log("Nenhuma cor solta no código.");
