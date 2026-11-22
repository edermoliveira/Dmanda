// PRÉVIA DE AVALIAÇÃO da autenticação (decisão 92): o aplicativo REAL em modo real (Supabase Auth pelas bibliotecas oficiais, cookies, proxy) contra o Auth FALSO local (scripts/auth-falso.mjs) sobre
// um banco de teste PGlite com dados e contas FICTÍCIOS. Fica rodando até ser encerrada (Ctrl+C). Nenhum e-mail é enviado: os convites e as recuperações aparecem na CAIXA DE MENSAGENS FICTÍCIA.
// Nada aqui vale em produção: o Auth falso é este script, e as variáveis só existem no processo que ele sobe. O Supabase real não é tocado e o .env.local não é lido.
// Uso: node scripts/previa-auth.mjs            (rede local: o endereço do computador na rede é descoberto; DMANDA_IP_PREVIA troca)
//      node scripts/previa-auth.mjs --limpar   (recomeça do zero, com as contas fictícias de novo)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBancoTeste, chamarComoUsuario, prepararAdminDeTeste, criarContaDeTeste, ADMIN_TESTE } from '../src/servidor/banco-teste-base.mjs';
import { iniciarAuthFalso, CHAVE_PUBLICA, CHAVE_SERVICO } from './auth-falso.mjs';

const PORTA = Number(process.env.PORTA_PREVIA || 7100), PORTA_AUTH = Number(process.env.PORTA_PREVIA_AUTH || 7149);
const ip = process.env.DMANDA_IP_PREVIA || Object.values(networkInterfaces()).flat().find((x) => x && x.family === 'IPv4' && !x.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(x.address))?.address || 'localhost';
const BASE = `http://${ip}:${PORTA}`;
// fora da árvore do projeto: o banco é gravado a cada pedido, e dentro do projeto isso faria o Next recompilar em laço
const RAIZ = join(tmpdir(), 'dmanda-previa-auth');
if (process.argv.includes('--limpar')) rmSync(RAIZ, { recursive: true, force: true });
const nova = !existsSync(join(RAIZ, 'pg'));
mkdirSync(RAIZ, { recursive: true });

const CONTAS = [
  { papel: 'administradora', email: null, senha: 'Admin-ficticia-2026' },
  { papel: 'usuária comum', email: 'ana@exemplo.invalid', senha: 'Ana-ficticia-2026' },
  { papel: 'usuário comum (para testar a revogação)', email: 'beto@exemplo.invalid', senha: 'Beto-ficticio-2026' },
];
const ANA = 'a1a1a1a1-0000-4000-8000-0000000000a1', BETO = 'b2b2b2b2-0000-4000-8000-0000000000b2';

const db = await abrirBancoTeste({ pasta: join(RAIZ, 'pg'), pendentes: true });
await prepararAdminDeTeste(db);
CONTAS[0].email = (await db.query('select dmanda_privado.email_admin() as e')).rows[0].e;
if (nova) {
  await criarContaDeTeste(db, ANA, 'ana@exemplo.invalid'); await criarContaDeTeste(db, BETO, 'beto@exemplo.invalid');
  const c = (u, f, a) => chamarComoUsuario(db, u, f, a);
  await c(ADMIN_TESTE, 'criar_demanda', { p: { assunto: 'Demanda fictícia da administradora', origem: 'Prefeita' } });
  const d = await c(ANA, 'criar_demanda', { p: { assunto: 'Demanda fictícia criada pela Ana' } });
  await c(BETO, 'adicionar_tarefa', { p_demanda: d.id, p_texto: 'Tarefa fictícia acrescentada pelo Beto' });
  await c(ANA, 'criar_entrada', { p: { texto: 'Anotação fictícia da Ana' } });
}
const falso = await iniciarAuthFalso({ db, porta: PORTA_AUTH, host: '0.0.0.0', urlApp: BASE });
for (const x of CONTAS) falso.definirSenha(x.email, x.senha);

const env = {
  ...process.env, PORT: String(PORTA), NEXT_PUBLIC_SUPABASE_URL: falso.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE_PUBLICA, SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO,
  DMANDA_URL_PUBLICA: BASE, DMANDA_SEGREDO_FLUXO: 'segredo-ficticio-da-previa-de-autenticacao-0123', CRON_SECRET: 'segredo-ficticio-da-rotina-da-previa', DMANDA_SEM_LEMBRETES: 'sim',
  DMANDA_PREVIA_LOCAL: 'sim', DMANDA_ORIGENS_DEV: ip,
};
delete env.DMANDA_BANCO; delete env.DMANDA_USUARIO_TESTE; delete env.DMANDA_PASTA_TESTE;
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-H', '0.0.0.0', '-p', String(PORTA)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
next.stdout.on('data', (b) => { if (/error|⨯/i.test(String(b))) process.stdout.write('[next] ' + b); });
next.stderr.on('data', (b) => process.stdout.write('[next] ' + b));
const encerrar = () => { try { next.kill(); } catch { /* já parou */ } falso.parar(); void db.close(); process.exit(0); };
process.on('SIGINT', encerrar); process.on('SIGTERM', encerrar);
next.on('exit', (c) => { console.log(`O Next saiu (código ${c}). A prévia foi encerrada.`); falso.parar(); void db.close(); process.exit(c ?? 1); });

const guia = `PRÉVIA DE AUTENTICAÇÃO DO DMANDA (dados e contas FICTÍCIOS; Auth falso local; nada é enviado por e-mail)
Aplicativo:            ${BASE}   (no computador também: http://localhost:${PORTA})
Caixa de mensagens:    http://${ip}:${PORTA_AUTH}/caixa   (convites e recuperações fictícios, com o link para tocar)
Contas fictícias (senha fictícia, só desta prévia):
${CONTAS.map((x) => `  - ${x.papel}: ${x.email}  senha: ${x.senha}`).join('\n')}
Banco desta prévia: ${join(RAIZ, 'pg')}  (node scripts/previa-auth.mjs --limpar recomeça do zero)
`;
writeFileSync(join(RAIZ, 'LEIA.txt'), guia);
console.log(guia);
for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://localhost:${PORTA}/login`)).status < 500) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 1000)); }
console.log(`Pronto: ${BASE}/login`);
