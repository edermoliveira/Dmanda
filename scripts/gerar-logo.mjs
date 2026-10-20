// Gera o logo do Dmanda em SVG: um D com três colunas dentro, como um quadro de demandas.
// As cores vêm do globals.css (única fonte de cores), então o logo acompanha o design system.
// Uso: npm run gerar:logo
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");

// Pega o valor de uma variável da paleta, no bloco claro (:root) ou escuro (html[data-tema="escuro"]).
function cor(nome, tema) {
  const inicio = tema === "escuro" ? css.indexOf('html[data-tema="escuro"]') : css.indexOf(":root");
  const bloco = css.slice(inicio, css.indexOf("}", inicio));
  const achado = bloco.match(new RegExp(`--c-${nome}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!achado) throw new Error(`Cor --c-${nome} não encontrada no tema ${tema}`);
  return achado[1];
}

// ---------- Geometria (quadro de 64 x 64) ----------
const retanguloArredondado = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
  `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
  `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

// O D: lado esquerdo reto com cantos suaves e lado direito em meia-lua.
const letraD = "M10 4H32A28 28 0 0 1 32 60H10A6 6 0 0 1 4 54V10A6 6 0 0 1 10 4Z";

// Três colunas vazadas dentro do D (entrada, andamento, fim), cada uma mais curta que a anterior.
const colunas = [
  retanguloArredondado(13, 16, 8, 32, 3),
  retanguloArredondado(25, 16, 8, 22, 3),
  retanguloArredondado(37, 16, 8, 12, 3),
];
const simbolo = [letraD, ...colunas].join("");

const svg = (conteudo, tamanho = 64) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}" role="img" aria-label="Dmanda">\n  ${conteudo}\n</svg>\n`;

const preenchido = (caminho, fill) => `<path fill="${fill}" fill-rule="evenodd" d="${caminho}"/>`;

// ---------- Arquivos ----------
mkdirSync("public/marca", { recursive: true });

const destaque = cor("destaque", "claro");
const sobreDestaque = cor("sobre-destaque", "claro");
const textoClaro = cor("texto", "claro");
const textoEscuro = cor("texto", "escuro");

const arquivos = {
  "public/marca/simbolo-destaque.svg": svg(preenchido(simbolo, destaque)),
  "public/marca/simbolo-para-fundo-claro.svg": svg(preenchido(simbolo, textoClaro)),
  "public/marca/simbolo-para-fundo-escuro.svg": svg(preenchido(simbolo, textoEscuro)),
  // Ícone do aplicativo e favicon: quadrado de destaque com o símbolo por cima.
  "public/marca/icone-app.svg": svg(
    `<rect width="64" height="64" rx="14" fill="${destaque}"/>\n  <g transform="translate(12.16 12.16) scale(0.62)">${preenchido(simbolo, sobreDestaque)}</g>`,
  ),
  "src/app/icon.svg": svg(
    `<rect width="64" height="64" rx="14" fill="${destaque}"/>\n  <g transform="translate(12.16 12.16) scale(0.62)">${preenchido(simbolo, sobreDestaque)}</g>`,
  ),
  // Geometria para o componente <Logo /> (sem cor: a cor vem das classes do design system).
  "src/components/logo-dados.ts":
    `// Gerado por scripts/gerar-logo.mjs. Não editar à mão: rode "npm run gerar:logo".\n` +
    `export const LOGO_CAMINHO =\n  "${simbolo}";\n`,
};

for (const [caminho, conteudo] of Object.entries(arquivos)) {
  writeFileSync(caminho, conteudo);
  console.log("gerado:", caminho);
}
