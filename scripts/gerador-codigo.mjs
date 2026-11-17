// Gerador do primeiro código da PRÉVIA e dos testes (decisão 82): a "terminal do titular" simulada, só em 127.0.0.1 (nunca na rede). Faz o que `npm run aparelhos` faz com a chave de serviço.
// Regra de ouro: NADA gera código por GET. Abrir a página (ou o navegador pedir /favicon.ico) nunca cria nem substitui um código: só o botão "Gerar primeiro código" (POST).
// Cada código novo apaga o anterior ainda não usado (uso único, validade de 10 minutos): por isso a página mostra o código vigente em vez de gerar outro quando é recarregada.
import http from 'node:http';
import { randomInt } from 'node:crypto';
import { chamarComoServico } from '../src/servidor/banco-teste-base.mjs';
import { formatarCodigo, gerarCodigo } from '../src/lib/aparelho.ts';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PAGINA = (corpo) => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Gerador de código (prévia)</title>
<style>body{font:16px/1.5 system-ui;max-width:36rem;margin:2rem auto;padding:0 1rem}h1{font-size:1.3rem}.cod{font:600 2.2rem/1.2 ui-monospace,Consolas,monospace;letter-spacing:.14em;user-select:all;padding:.5rem .75rem;background:#f2f2f7;border-radius:12px;display:inline-block}button{font:inherit;min-height:44px;padding:0 18px;border-radius:12px;border:0;background:#0A84FF;color:#fff;cursor:pointer;margin:.25rem .5rem .25rem 0}button.sec{background:#e5e5ea;color:#111}.nota{color:#555;font-size:.9rem}</style><body>${corpo}</body></html>`;

/** @param {{ db: import('@electric-sql/pglite').PGlite, porta: number }} o */
export async function iniciarGerador({ db, porta }) {
  let vigente = null;   // { codigo, expira }
  const estado = async () => {
    const r = (await db.query("select (select count(*)::int from dmanda_privado.aparelhos where revogado_em is null and expira_em > now()) ativos, (select exigir_aparelho from dmanda_privado.config_acesso) exigir")).rows[0];
    return r;
  };
  const vigenteAindaValido = async () => {
    if (!vigente) return null;
    const r = await db.query("select 1 from dmanda_privado.convites_aparelho where codigo_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex') and usado_em is null and expira_em > now()", [vigente.codigo.replace('-', '')]);
    return r.rows.length ? vigente : null;
  };
  const home = async (aviso = '') => {
    const e = await estado(), v = await vigenteAindaValido();
    return PAGINA(`<h1>Gerador de código (só neste computador)</h1>
<p class="nota">Aparelhos autorizados agora: <b>${e.ativos}</b>. Exigência de autorização: <b>${e.exigir ? 'ligada' : 'desligada'}</b>.</p>${aviso ? `<p><b>${esc(aviso)}</b></p>` : ''}
${v ? `<p>Código vigente (vale por 10 minutos e uma só vez):</p><p><span class="cod" id="codigo" data-codigo>${esc(v.codigo)}</span></p>
<p><button type="button" id="copiar" onclick="navigator.clipboard.writeText(document.getElementById('codigo').textContent.trim()).then(()=>{this.textContent='Copiado'}).catch(()=>{var r=document.createRange();r.selectNodeContents(document.getElementById('codigo'));var s=getSelection();s.removeAllRanges();s.addRange(r);this.textContent='Selecionado: use Ctrl+C'})">Copiar código</button></p>
<p class="nota">Digite ou cole este código em <b>Entrar</b>, na tela do aparelho. Gerar outro apaga este.</p>` : ''}
<form method="post" action="/gerar"><button type="submit" id="gerar">${v ? 'Gerar outro código' : 'Gerar primeiro código'}</button></form>
<form method="post" action="/exigir"><input type="hidden" name="v" value="${e.exigir ? 'nao' : 'sim'}"><button class="sec" type="submit">${e.exigir ? 'Desligar a exigência' : 'Ligar a exigência'}</button></form>
<form method="post" action="/revogar"><button class="sec" type="submit">Revogar todos os aparelhos</button></form>`);
  };
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const enviar = (corpo, status = 200) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(corpo); };
    const voltar = () => { res.writeHead(303, { location: '/', 'cache-control': 'no-store' }); res.end(); };
    try {
      if (req.method === 'GET' && u.pathname === '/') return enviar(await home());
      if (req.method === 'GET') { res.writeHead(u.pathname === '/favicon.ico' ? 204 : 404, { 'cache-control': 'no-store' }); return res.end(); }   // nenhum GET gera nada
      let corpo = ''; for await (const parte of req) corpo += parte;
      if (u.pathname === '/gerar') {
        const codigo = gerarCodigo((n) => randomInt(n));
        await chamarComoServico(db, 'criar_convite_terminal', { p_codigo: codigo });
        vigente = { codigo: formatarCodigo(codigo) };
        return voltar();
      }
      if (u.pathname === '/exigir') { await chamarComoServico(db, 'exigir_aparelhos', { p_exigir: new URLSearchParams(corpo).get('v') === 'sim' }); return voltar(); }
      if (u.pathname === '/revogar') { await chamarComoServico(db, 'revogar_todos_aparelhos', {}); return voltar(); }
      return enviar(PAGINA('<p>Não encontrado.</p>'), 404);
    } catch (e) { return enviar(await home(`Não foi possível: ${String(e.message).slice(0, 160)}`), 400); }
  });
  await new Promise((r) => srv.listen(porta, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${porta}`, parar: () => srv.close() };
}
