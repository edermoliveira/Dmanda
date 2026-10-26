// Auth falso mínimo para o teste do terminal (scripts/terminal-senha/testar.py): node auth-falso.mjs <porta> <modo> <arquivo-de-registro>
// modos: ok | erro401 | fraca
import http from 'node:http';
import fs from 'node:fs';
const [porta, modo, registro] = [Number(process.argv[2]), process.argv[3], process.argv[4]];
const usuario = { id: '00000000-0000-4000-8000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'conta-de-teste@exemplo.invalid', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
http.createServer((req, res) => {
  let t = ''; req.on('data', (c) => { t += c; });
  req.on('end', () => {
    const j = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'GET' && req.url.startsWith('/auth/v1/admin/users')) {
      if (modo === 'erro401') return j(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid' });
      return j(200, { users: [usuario], aud: 'authenticated' });
    }
    if (req.method === 'PUT' && req.url.startsWith('/auth/v1/admin/users/')) {
      fs.appendFileSync(registro, t + '\n');
      if (modo === 'fraca') return j(422, { code: 422, error_code: 'weak_password', msg: 'fraca' });
      return j(200, usuario);
    }
    j(404, {});
  });
}).listen(porta, '127.0.0.1');
