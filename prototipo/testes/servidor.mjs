// Servidor local só para os testes (o Playwright bloqueia file://). Serve a pasta prototipo numa porta livre.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

export async function servir() {
  const s = createServer(async (req, res) => {
    const caminho = normalize(decodeURIComponent(req.url.split('?')[0].split('#')[0])).replace(/^([/\\])+/, '');
    const arq = join(RAIZ, caminho || 'index.html');
    if (!arq.startsWith(RAIZ)) { res.writeHead(403); res.end(); return; }
    try { const corpo = await readFile(arq); res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream' }); res.end(corpo); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + s.address().port + '/index.html', fechar: () => s.close() };
}
