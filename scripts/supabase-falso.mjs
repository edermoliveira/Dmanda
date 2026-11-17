// Supabase FALSO para o teste de integração da entrada direta, só em 127.0.0.1 e nunca contra o Supabase real. Põe na frente de um banco de teste (PGlite, as mesmas migrações) só o que o
// servidor do aplicativo usa do Supabase: a API de funções (/rest/v1/rpc), com a chave de serviço. Não existe Auth aqui porque o aplicativo não tem mais sessão: quem chama uma função sem a
// chave de serviço recebe 401, como o PostgREST faria com o papel anônimo sem permissão. Cada chamada fica em `estado.chamadas` (para provar quais funções o servidor chamou) e as falhas
// de rede ou do banco podem ser injetadas por função em `estado.falhas`.
import http from 'node:http';
import { chamarComoServico } from '../src/servidor/banco-teste-base.mjs';

export const CHAVE_SERVICO = 'sb_secret_falsa_para_teste';
const lerCorpo = (req) => new Promise((r) => { let t = ''; req.on('data', (x) => { t += x; }); req.on('end', () => { try { r(JSON.parse(t || '{}')); } catch { r({}); } }); });

/** @param {{ db: import('@electric-sql/pglite').PGlite, porta: number }} o */
export async function iniciarSupabaseFalso({ db, porta }) {
  const estado = {
    chamadas: [],                 // "POST /rest/v1/rpc/executar_como_titular", ...
    corpos: [],                   // { fn, args } de cada chamada (sem a chave), para conferir o que o servidor enviou
    falhas: new Map(),            // função -> 'cai' (a conexão cai antes de responder) | '500'
  };
  const json = (res, status, corpo) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(corpo === undefined ? '' : JSON.stringify(corpo)); };
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    estado.chamadas.push(`${req.method} ${u.pathname}${u.search}`);
    const fn = u.pathname.startsWith('/rest/v1/rpc/') ? u.pathname.slice('/rest/v1/rpc/'.length) : '';
    if (!fn || req.method !== 'POST') return json(res, 404, {});
    const servico = req.headers.apikey === CHAVE_SERVICO || String(req.headers.authorization ?? '') === `Bearer ${CHAVE_SERVICO}`;
    if (!servico) return json(res, 401, { code: 'PGRST301', message: 'sem permissão', details: null, hint: null });
    const args = await lerCorpo(req);
    estado.corpos.push({ fn, args });
    const falha = estado.falhas.get(fn);
    if (falha === 'cai') { req.socket.destroy(); return; }
    if (falha === '500') return json(res, 500, { code: 500, msg: 'falha proposital' });
    try {
      let r;
      if (fn === 'executar_como_titular') {
        // o PostgREST passa o objeto como jsonb; a transação roda como o papel de serviço, igual ao que a chave de serviço faz
        r = await db.transaction(async (tx) => {
          await tx.exec('set local role service_role');
          return (await tx.query('select public.executar_como_titular($1, $2::jsonb) as r', [args.p_funcao, JSON.stringify(args.p_args ?? {})])).rows[0].r;
        });
      } else r = await chamarComoServico(db, fn, args);
      return json(res, 200, r === undefined ? null : r);
    } catch (e) {
      return json(res, e.code === '42501' ? 403 : 400, { code: e.code, message: e.message, details: null, hint: null });
    }
  });
  await new Promise((r) => srv.listen(porta, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${porta}`, estado, parar: () => srv.close() };
}
