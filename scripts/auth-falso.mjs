// SUPABASE FALSO para a integração da autenticação (decisão 92): só em 127.0.0.1, nunca contra o Supabase real. Põe na frente de um banco de teste (PGlite, as mesmas migrações, pendentes incluídas)
// o que o aplicativo usa do Supabase: o Auth (GoTrue: senha, renovação, usuário, logout, recuperação, verificação de link, convite, bloqueio, cadastro fechado pelo hook) e a API de funções (/rest/v1/rpc)
// com o JWT do usuário. O aplicativo roda em MODO REAL (as bibliotecas oficiais @supabase/ssr e supabase-js, cookies, proxy) contra este servidor.
// O QUE PROVA: o comportamento do NOSSO código com as respostas do protocolo (sessão persistente, renovação com rotação, queda transitória, revogação, convites de uso único e com validade, cadastro fechado).
// O QUE NÃO PROVA: o GoTrue real (emissão e assinatura de tokens com as chaves do projeto, e-mail de verdade, limites de taxa, modelos de e-mail, o hook configurado no painel). Isso depende do serviço real.
import http from 'node:http';
import { createHmac, randomUUID, randomBytes } from 'node:crypto';
import { chamarComoUsuario, chamarComoServico } from '../src/servidor/banco-teste-base.mjs';

export const CHAVE_PUBLICA = 'sb_publishable_falsa_para_teste';
export const CHAVE_SERVICO = 'sb_secret_falsa_para_teste';
const SEGREDO_JWT = 'segredo-jwt-falso-para-teste-0123456789';
const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
const assinar = (payload) => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload); return `${h}.${p}.${createHmac('sha256', SEGREDO_JWT).update(`${h}.${p}`).digest('base64url')}`; };
const lerCorpo = (req) => new Promise((r) => { let t = ''; req.on('data', (x) => { t += x; }); req.on('end', () => { try { r(JSON.parse(t || '{}')); } catch { r({}); } }); });

/** @param {{ db: import('@electric-sql/pglite').PGlite, porta: number, validadeSegundos?: number }} o */
export async function iniciarAuthFalso({ db, porta, validadeSegundos = 3600 }) {
  const estado = {
    relogio: () => Date.now(),                       // trocável: as validades (token de acesso, convite) usam este relógio
    validadeSegundos,
    validadeLinkSegundos: 24 * 3600,
    senhas: new Map(),                               // e-mail -> senha (só neste processo; nunca em banco)
    sessoes: new Map(),                              // session_id -> { usuario, revogada }
    refresh: new Map(),                              // refresh_token -> { sessao, usado }
    links: new Map(),                                // token_hash -> { tipo, email, expira, usado }
    caixaDeSaida: [],                                // e-mails "enviados": { para, tipo, token_hash } (nenhum e-mail real)
    chamadas: [],                                    // "POST /auth/v1/token?grant_type=refresh_token"
    contadores: { refresh: 0, password: 0 },
    falhas: new Map(),                               // 'refresh' | 'password' | 'user' | 'rpc' -> 'cai' | '500'  (injeção de falha)
  };
  const json = (res, status, corpo) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(corpo === undefined ? '' : JSON.stringify(corpo)); };
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const usuarioPorEmail = async (e) => (await q("select id::text, email, email_confirmed_at, banned_until, deleted_at, last_sign_in_at, invited_at from auth.users where lower(email) = lower($1)", [e]))[0];
  const usuarioPorId = async (id) => (await q("select id::text, email, email_confirmed_at, banned_until, deleted_at, last_sign_in_at, invited_at from auth.users where id = $1", [id]))[0];
  const bloqueado = (u) => !u || u.deleted_at || (u.banned_until && new Date(u.banned_until).getTime() > estado.relogio());
  const jsonUsuario = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} });
  const emitir = async (u) => {
    const sessao = randomUUID(), agora = Math.floor(estado.relogio() / 1000);
    estado.sessoes.set(sessao, { usuario: u.id, revogada: false });
    const refreshToken = randomBytes(9).toString('base64url');
    estado.refresh.set(refreshToken, { sessao, usado: false });
    const exp = agora + estado.validadeSegundos;
    const access = assinar({ aud: 'authenticated', exp, iat: agora, iss: 'falso', sub: u.id, email: u.email, role: 'authenticated', aal: 'aal1', session_id: sessao, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, is_anonymous: false });
    await q('update auth.users set last_sign_in_at = now(), email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1', [u.id]);
    return { access_token: access, token_type: 'bearer', expires_in: estado.validadeSegundos, expires_at: exp, refresh_token: refreshToken, user: jsonUsuario(await usuarioPorId(u.id)) };
  };
  const verificarJwt = (t) => {
    const partes = String(t ?? '').split('.');
    if (partes.length !== 3) return null;
    if (createHmac('sha256', SEGREDO_JWT).update(`${partes[0]}.${partes[1]}`).digest('base64url') !== partes[2]) return null;
    try { const p = JSON.parse(Buffer.from(partes[1], 'base64url').toString()); return p.exp * 1000 > estado.relogio() ? p : null; } catch { return null; }
  };
  const bearer = (req) => String(req.headers.authorization ?? '').replace(/^Bearer /, '');
  const eServico = (req) => req.headers.apikey === CHAVE_SERVICO || bearer(req) === CHAVE_SERVICO;
  const erroAuth = (res, status, code, msg) => json(res, status, { code: status, error_code: code, msg });
  const novoLink = (tipo, email) => { const t = randomBytes(24).toString('base64url'); estado.links.set(t, { tipo, email, expira: estado.relogio() + estado.validadeLinkSegundos * 1000, usado: false }); estado.caixaDeSaida.push({ para: email, tipo, token_hash: t }); return t; };
  const hook = async (email, provedor) => {
    const r = await db.transaction(async (tx) => { await tx.exec('set local role supabase_auth_admin'); return (await tx.query('select public.hook_antes_criar_usuario($1::jsonb) as r', [JSON.stringify({ user: { email, app_metadata: { provider: provedor } } })])).rows[0].r; });
    return r?.error ?? null;
  };

  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), rota = `${req.method} ${u.pathname}${u.search}`;
    estado.chamadas.push(rota);
    if (req.headers.apikey !== CHAVE_PUBLICA && !eServico(req)) return json(res, 401, { message: 'Invalid API key', hint: 'chave falsa inválida' });
    const falha = (nome) => { const f = estado.falhas.get(nome); if (f === 'cai') { req.socket.destroy(); return true; } if (f === '500') { json(res, 500, { msg: 'falha proposital' }); return true; } return false; };
    const corpo = req.method === 'GET' || req.method === 'DELETE' ? {} : await lerCorpo(req);
    try {
      // ---------- Auth ----------
      if (u.pathname === '/auth/v1/token' && req.method === 'POST') {
        const tipo = u.searchParams.get('grant_type');
        if (tipo === 'password') {
          if (falha('password')) return;
          estado.contadores.password++;
          const usr = await usuarioPorEmail(corpo.email ?? '');
          if (!usr || estado.senhas.get(String(corpo.email).toLowerCase()) !== corpo.password || !usr.email_confirmed_at) return erroAuth(res, 400, 'invalid_credentials', 'Invalid login credentials');
          if (bloqueado(usr)) return erroAuth(res, 400, 'user_banned', 'User is banned');
          return json(res, 200, await emitir(usr));
        }
        if (tipo === 'refresh_token') {
          if (falha('refresh')) return;
          estado.contadores.refresh++;
          const r = estado.refresh.get(corpo.refresh_token);
          // como o GoTrue real: um refresh token já usado ainda vale por 10 s (intervalo de reutilização), devolvendo o MESMO filho: pedidos simultâneos (proxy e ação do servidor) não derrubam a sessão
          const reuso = r?.usado && r.filho && estado.relogio() - r.usadoEm < 10_000;
          if (!r || (r.usado && !reuso) || estado.sessoes.get(r.sessao)?.revogada) { estado.chamadas.push(`  recusado: ${!r ? 'desconhecido' : r.usado ? 'usado há ' + (estado.relogio() - r.usadoEm) + ' ms' : 'sessão revogada'}`); return erroAuth(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found'); }
          const usr = await usuarioPorId(estado.sessoes.get(r.sessao).usuario);
          if (bloqueado(usr)) return erroAuth(res, 400, 'user_banned', 'User is banned');
          const sessao = r.sessao, agora = Math.floor(estado.relogio() / 1000), novo = reuso ? r.filho : randomBytes(9).toString('base64url');
          if (!reuso) { r.usado = true; r.usadoEm = estado.relogio(); r.filho = novo; estado.refresh.set(novo, { sessao, usado: false }); }   // rotação: cada renovação invalida o refresh token anterior (fora do intervalo) e mantém a MESMA sessão
          const exp = agora + estado.validadeSegundos;
          return json(res, 200, { access_token: assinar({ aud: 'authenticated', exp, iat: agora, iss: 'falso', sub: usr.id, email: usr.email, role: 'authenticated', aal: 'aal1', session_id: sessao, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, is_anonymous: false }), token_type: 'bearer', expires_in: estado.validadeSegundos, expires_at: exp, refresh_token: novo, user: jsonUsuario(usr) });
        }
        return erroAuth(res, 400, 'unsupported_grant_type', 'unsupported');
      }
      if (u.pathname === '/auth/v1/user' && req.method === 'GET') {
        if (falha('user')) return;
        const p = verificarJwt(bearer(req));
        const usr = p && (await usuarioPorId(p.sub));
        if (!p || !usr || estado.sessoes.get(p.session_id)?.revogada) return erroAuth(res, 401, 'bad_jwt', 'invalid JWT');
        if (bloqueado(usr)) return erroAuth(res, 403, 'user_banned', 'User is banned');
        return json(res, 200, jsonUsuario(usr));
      }
      if (u.pathname === '/auth/v1/user' && req.method === 'PUT') {
        const p = verificarJwt(bearer(req));
        const usr = p && (await usuarioPorId(p.sub));
        if (!p || !usr || bloqueado(usr)) return erroAuth(res, 401, 'bad_jwt', 'invalid JWT');
        if (typeof corpo.password === 'string') {
          if (corpo.password.length < 8) return erroAuth(res, 422, 'weak_password', 'Password should be at least 8 characters');
          if (estado.senhas.get(usr.email.toLowerCase()) === corpo.password) return erroAuth(res, 422, 'same_password', 'New password should be different from the old password.');
          estado.senhas.set(usr.email.toLowerCase(), corpo.password);
        }
        return json(res, 200, jsonUsuario(usr));
      }
      if (u.pathname === '/auth/v1/logout' && req.method === 'POST') {
        const p = verificarJwt(bearer(req));
        if (p) {
          const escopo = u.searchParams.get('scope') ?? 'global';
          for (const [id, s] of estado.sessoes) if (s.usuario === p.sub && (escopo !== 'local' || id === p.session_id)) s.revogada = true;
        }
        res.writeHead(204); return res.end();
      }
      if (u.pathname === '/auth/v1/recover' && req.method === 'POST') {
        const usr = await usuarioPorEmail(corpo.email ?? '');
        if (usr && !bloqueado(usr) && usr.email_confirmed_at && (await q('select 1 from dmanda_privado.acesso_autorizado where email = lower($1) and revogado_em is null', [usr.email])).length) novoLink('recovery', usr.email);
        return json(res, 200, {});   // sempre a mesma resposta
      }
      if (u.pathname === '/auth/v1/verify' && req.method === 'POST') {
        const l = estado.links.get(corpo.token_hash);
        if (!l || l.tipo !== corpo.type || l.usado || l.expira < estado.relogio()) return erroAuth(res, 403, 'otp_expired', 'Email link is invalid or has expired');
        l.usado = true;
        const usr = await usuarioPorEmail(l.email);
        if (bloqueado(usr)) return erroAuth(res, 403, 'user_banned', 'User is banned');
        return json(res, 200, await emitir(usr));
      }
      if (u.pathname === '/auth/v1/signup' && req.method === 'POST') {
        const e = await hook(String(corpo.email ?? '').toLowerCase(), 'email');
        return erroAuth(res, 422, 'signup_disabled', e ? e.message : 'Signups not allowed for this instance');   // cadastro público fechado
      }
      // ---------- Auth administrativo (só com a chave de serviço) ----------
      if (u.pathname === '/auth/v1/invite' && req.method === 'POST') {
        if (!eServico(req)) return erroAuth(res, 401, 'not_admin', 'User not allowed');
        const email = String(corpo.email ?? '').toLowerCase();
        const e = await hook(email, 'email');
        if (e) return json(res, 403, { code: 403, error_code: 'hook_failed', msg: e.message });
        let usr = await usuarioPorEmail(email);
        if (usr?.email_confirmed_at) return erroAuth(res, 422, 'email_exists', 'A user with this email address has already been registered');
        if (!usr) { await q("insert into auth.users (id, email, email_confirmed_at, invited_at) values ($1, $2, null, now())", [randomUUID(), email]); usr = await usuarioPorEmail(email); }
        novoLink('invite', email);
        return json(res, 200, jsonUsuario(usr));
      }
      const mAdm = u.pathname.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/);
      if (mAdm && req.method === 'PUT') {
        if (!eServico(req)) return erroAuth(res, 401, 'not_admin', 'User not allowed');
        const ban = corpo.ban_duration;
        await q('update auth.users set banned_until = $2 where id = $1', [mAdm[1], ban === 'none' ? null : new Date(estado.relogio() + 100 * 365 * 24 * 3600 * 1000).toISOString()]);
        return json(res, 200, jsonUsuario(await usuarioPorId(mAdm[1])));
      }
      // ---------- API de funções ----------
      const fn = u.pathname.startsWith('/rest/v1/rpc/') ? u.pathname.slice('/rest/v1/rpc/'.length) : '';
      if (fn && req.method === 'POST') {
        if (falha('rpc')) return;
        const erroSql = (e) => json(res, e.code === '42501' ? 403 : 400, { code: e.code, message: e.message, details: null, hint: null });
        try {
          if (eServico(req) && bearer(req) === CHAVE_SERVICO) return json(res, 200, (await chamarComoServico(db, fn, corpo)) ?? null);
          const p = verificarJwt(bearer(req));
          if (!p) return json(res, 401, { code: 'PGRST301', message: 'JWT expired or invalid', details: null, hint: null });
          return json(res, 200, (await chamarComoUsuario(db, p.sub, fn, corpo)) ?? null);
        } catch (e) { return erroSql(e); }
      }
      return json(res, 404, { message: 'não encontrado: ' + rota });
    } catch (e) { return json(res, 500, { msg: String(e.message).slice(0, 200) }); }
  });
  await new Promise((r) => srv.listen(porta, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${porta}`, estado, parar: () => srv.close(), definirSenha: (email, senha) => estado.senhas.set(email.toLowerCase(), senha) };
}
