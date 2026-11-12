// Servidor estático mínimo para a prévia (sem dependências). Serve a pasta prototipo/agenda-semana por http.
// O Playwright bloqueia file://, então a prévia sempre é aberta por http.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };

/** Sobe o servidor na porta pedida (0 = livre) e devolve { url, fechar }. */
export async function subir(porta = 0) {
  const srv = createServer(async (req, res) => {
    try {
      const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const arq = normalize(join(RAIZ, caminho === '/' ? 'index.html' : caminho));
      if (!arq.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
      const dados = await readFile(arq);
      res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream' }).end(dados);
    } catch { res.writeHead(404).end('não encontrado'); }
  });
  await new Promise((r) => srv.listen(porta, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, fechar: () => srv.close() };
}

// Uso direto: node testes/servidor.mjs [porta]  (padrão 7201)
if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const { url } = await subir(Number(process.argv[2] || 7201));
  console.log(`Prévia em ${url}/index.html (Ctrl+C para parar)`);
}
