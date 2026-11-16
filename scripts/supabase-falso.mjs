// Supabase FALSO para testes de integração (decisão 82), só em 127.0.0.1 e nunca contra o Supabase real. Põe na frente de um banco de teste (PGlite, mesmas migrações) o que o aplicativo
// usa do Supabase: o Auth (generate_link, verify, token de renovação com rotação, user, logout) e a API de funções (/rest/v1/rpc), com tokens HS256 de verdade e a claim session_id.
// Fiel ao que importa para a autorização de aparelhos: a API de funções valida só a assinatura e a validade do token (como o PostgREST), NÃO consulta se a sessão ainda existe no Auth;
// quem decide o acesso de um token ainda válido de uma sessão revogada é o banco (RLS via dmanda_privado.conta_autorizada). O Auth, ao contrário, recusa token de sessão encerrada.
import http from 'node:http';
import crypto from 'node:crypto';
import { chamarComoServico, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

const SEGREDO = 'segredo-do-supabase-falso-so-para-teste';
export const CHAVE_PUBLICA = 'sb_publishable_falsa_para_teste', CHAVE_SERVICO = 'sb_secret_falsa_para_teste';
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const assinar = (carga) => { const c = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(carga)}`; return `${c}.${crypto.createHmac('sha256', SEGREDO).update(c).digest('base64url')}`; };
function lerJwt(token) {
  const [h, c, s] = String(token ?? '').split('.');
  if (!h || !c || !s || crypto.createHmac('sha256', SEGREDO).update(`${h}.${c}`).digest('base64url') !== s) return null;
  try { const carga = JSON.parse(Buffer.from(c, 'base64url').toString()); return carga.exp > Math.floor(Date.now() / 1000) ? carga : null; } catch { return null; }
}
const lerCorpo = (req) => new Promise((r) => { let t = ''; req.on('data', (x) => { t += x; }); req.on('end', () => { try { r(JSON.parse(t || '{}')); } catch { r({}); } }); });

/** @param {{ db: import('@electric-sql/pglite').PGlite, porta: number, email: string, usuarioId: string }} o */
export async function iniciarSupabaseFalso({ db, porta, email, usuarioId }) {
  const estado = {
    chamadas: [],                 // "POST /auth/v1/verify", "POST /rest/v1/rpc/listar_demandas"...
    sessoes: new Map(),           // sid -> { n } (n = token de renovação vigente)
    links: new Map(),             // hashed_token -> usuário
    falhas: new Map(),            // função da API (ou "auth") -> 'cai' | '500'
    ttlToken: 3600,               // segundos de validade do token de acesso
    usuarioNovo: false,           // generate_link devolve um usuário novo (como o Auth real faz com e-mail desconhecido)
  };
  const usuario = (id = usuarioId, mail = email) => ({ id, aud: 'authenticated', role: 'authenticated', email: mail, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
  const sessaoJson = (sid, n, id = usuarioId, mail = email) => {
    const agora = Math.floor(Date.now() / 1000);
    return { access_token: assinar({ sub: id, role: 'authenticated', email: mail, aud: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, session_id: sid, iat: agora, exp: agora + estado.ttlToken }),
      token_type: 'bearer', expires_in: estado.ttlToken, expires_at: agora + estado.ttlToken, refresh_token: `rt:${sid}:${n}`, user: usuario(id, mail) };
  };
  const json = (res, status, corpo) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(corpo === undefined ? '' : JSON.stringify(corpo)); };
  const bearer = (req) => String(req.headers.authorization ?? '').replace(/^Bearer /, '');
  const ehServico = (req) => bearer(req) === CHAVE_SERVICO || req.headers.apikey === CHAVE_SERVICO;

  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    estado.chamadas.push(`${req.method} ${u.pathname}${u.search}`);
    const fn = u.pathname.startsWith('/rest/v1/rpc/') ? u.pathname.slice('/rest/v1/rpc/'.length) : u.pathname.startsWith('/auth/') ? 'auth' : '';
    const falha = estado.falhas.get(fn) ?? estado.falhas.get('*');
    if (falha === 'cai') { req.socket.destroy(); return; }
    if (falha === '500') return json(res, 500, { code: 500, msg: 'falha proposital' });

    // ---------- Auth ----------
    if (u.pathname === '/auth/v1/admin/generate_link' && req.method === 'POST') {
      if (!ehServico(req)) return json(res, 401, { code: 401, msg: 'chave de serviço necessária' });
      const c = await lerCorpo(req), mail = String(c.email ?? '').toLowerCase();
      const dono = mail === email.toLowerCase() && !estado.usuarioNovo ? usuario() : usuario(crypto.randomUUID(), mail);
      const hashed = crypto.randomBytes(24).toString('hex');
      estado.links.set(hashed, dono);
      return json(res, 200, { ...dono, action_link: `http://falso/verify?token=${hashed}`, email_otp: '123456', hashed_token: hashed, redirect_to: '', verification_type: c.type });
    }
    if (u.pathname === '/auth/v1/verify' && req.method === 'POST') {
      const c = await lerCorpo(req), dono = estado.links.get(c.token_hash);
      if (!dono) return json(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' });
      estado.links.delete(c.token_hash);                       // uso único
      const sid = crypto.randomUUID(); estado.sessoes.set(sid, { n: 0 });
      return json(res, 200, sessaoJson(sid, 0, dono.id, dono.email));
    }
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') {
      const c = await lerCorpo(req), [, sid, n] = /^rt:(.+):(\d+)$/.exec(String(c.refresh_token ?? '')) ?? [];
      const s = sid && estado.sessoes.get(sid);
      if (!s) return json(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
      if (Number(n) < s.n) return json(res, 400, { code: 400, error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' });
      s.n += 1;
      return json(res, 200, sessaoJson(sid, s.n));
    }
    if (u.pathname === '/auth/v1/user') {
      const carga = lerJwt(bearer(req));
      if (!carga) return json(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      if (!estado.sessoes.has(carga.session_id)) return json(res, 403, { code: 403, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' });
      return json(res, 200, usuario(carga.sub, carga.email));
    }
    if (u.pathname === '/auth/v1/logout') {
      const carga = lerJwt(bearer(req));
      if (carga && u.searchParams.get('scope') === 'local') estado.sessoes.delete(carga.session_id);
      res.writeHead(204); return res.end();
    }

    // ---------- API de funções (PostgREST): valida só assinatura e validade ----------
    if (fn && fn !== 'auth' && req.method === 'POST') {
      const args = await lerCorpo(req);
      try {
        let r;
        if (ehServico(req)) r = await chamarComoServico(db, fn, args);
        else {
          const carga = lerJwt(bearer(req));
          if (!carga) return json(res, 401, { code: 'PGRST301', message: 'JWT inválido ou vencido' });
          r = await chamarComoUsuario(db, carga.sub, fn, args, { provedor: carga.app_metadata?.provider ?? 'email', sessaoId: carga.session_id, email: carga.email });
        }
        return json(res, 200, r === undefined ? null : r);
      } catch (e) {
        if (/does not exist/i.test(e.message ?? '') && /function/i.test(e.message ?? '')) return json(res, 404, { code: 'PGRST202', message: e.message });
        return json(res, e.code === '42501' ? 403 : 400, { code: e.code, message: e.message, details: null, hint: null });
      }
    }
    return json(res, 404, {});
  });
  await new Promise((r) => srv.listen(porta, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${porta}`, estado, parar: () => srv.close(), jwtDe: (sid, extra = {}) => assinar({ sub: usuarioId, role: 'authenticated', email, aud: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, session_id: sid, exp: Math.floor(Date.now() / 1000) + 3600, ...extra }) };
}
