// Tira prints das páginas (página inteira) com o Edge, no tema claro e no escuro.
// O sistema precisa estar ligado (npm run dev). Uso: npm run capturar
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = "http://localhost:7100";
const pasta = process.argv[2] ?? "imagens/aprovacao";
const porta = 9333;

// Cada item: página, tema, largura da tela e nome do arquivo.
const capturas = [
  { pagina: "/pecas", tema: "claro", largura: 1300, nome: "pecas-claro" },
  { pagina: "/pecas", tema: "escuro", largura: 1300, nome: "pecas-escuro" },
  { pagina: "/pecas", tema: "claro", largura: 390, nome: "pecas-celular" },
  { pagina: "/marca", tema: "claro", largura: 1300, nome: "marca-claro" },
  { pagina: "/marca", tema: "escuro", largura: 1300, nome: "marca-escuro" },
  { pagina: "/marca", tema: "claro", largura: 390, nome: "marca-celular" },
];

const candidatos = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const navegador = candidatos.find((c) => existsSync(c));
if (!navegador) throw new Error("Edge ou Chrome não encontrado.");

mkdirSync(pasta, { recursive: true });
const processo = spawn(
  navegador,
  ["--headless=new", "--disable-gpu", `--remote-debugging-port=${porta}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "dmanda-"))}`, "about:blank"],
  { stdio: "ignore" },
);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let alvo;
for (let i = 0; i < 50 && !alvo; i++) {
  try {
    alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((t) => t.type === "page");
  } catch {}
  if (!alvo) await esperar(300);
}
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let contador = 0;
const pendentes = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  pendentes.get(m.id)?.(m);
};
const cmd = (method, params = {}) =>
  new Promise((r) => {
    const id = ++contador;
    pendentes.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const js = (expression) => cmd("Runtime.evaluate", { expression, returnByValue: true });

for (const c of capturas) {
  await cmd("Emulation.setDeviceMetricsOverride", { width: c.largura, height: 900, deviceScaleFactor: 1, mobile: c.largura < 600 });
  await cmd("Page.navigate", { url: base + c.pagina });
  await esperar(3500);
  await js(`localStorage.setItem("dmanda-tema","${c.tema}"); document.documentElement.dataset.tema="${c.tema}"`);
  await esperar(500);
  const medida = await js("document.documentElement.scrollHeight");
  const altura = Math.min(medida.result.result.value, 12000);
  await cmd("Emulation.setDeviceMetricsOverride", { width: c.largura, height: altura, deviceScaleFactor: 1, mobile: c.largura < 600 });
  await esperar(500);
  const img = await cmd("Page.captureScreenshot", { format: "png" });
  const arquivo = join(pasta, `${c.nome}.png`);
  writeFileSync(arquivo, Buffer.from(img.result.data, "base64"));
  console.log("salvo:", arquivo, `${c.largura}x${altura}`);
}

ws.close();
processo.kill();
process.exit(0);
