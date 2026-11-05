// Prova, com o SERVIDOR DE PRODUÇÃO REAL (next build + next start), que o banco de teste continua recusado em produção e que a exceção da medição local (DMANDA_MEDICAO_LOCAL)
// só abre neste computador: recusada com a variável da Vercel (produção, Preview e Development), com só os sinais da função Lambda (projeto sem "System Environment Variables") e sem
// a variável. Uma recusa é uma resposta 500 do servidor, sem nenhum dado. Exige `npm run build`. Banco de teste vazio e descartável; nunca toca o Supabase real.
// Uso: node scripts/testar-medicao-local.mjs
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { abrirBancoTeste } from '../src/servidor/banco-teste-base.mjs';

if (!existsSync('.next/BUILD_ID')) { console.error('Faça `npm run build` antes.'); process.exit(2); }
const PORTA = process.env.PORTA_TESTE_MEDICAO || '7115', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/medicao-local';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
{ const db = await abrirBancoTeste({ pasta: PASTA }); await db.close(); }
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };

const LIMPAS = { VERCEL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '', VERCEL_URL: '', VERCEL_REGION: '', VERCEL_DEPLOYMENT_ID: '', AWS_LAMBDA_FUNCTION_NAME: '', AWS_EXECUTION_ENV: '', LAMBDA_TASK_ROOT: '', DMANDA_MEDICAO_LOCAL: '' };
async function comServidor(extra, f) {
  const filho = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', PORTA], { env: { ...process.env, ...LIMPAS, NODE_ENV: 'production', DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste-1234567890', ...extra }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/login', { redirect: 'manual' }); break; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
    return await f();
  } finally { try { spawnSync('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } await new Promise((r) => setTimeout(r, 1500)); }
}
const sonda = async () => {
  const painel = await fetch(BASE + '/demandas', { redirect: 'manual' });
  const copia = await fetch(BASE + '/api/exportar', { redirect: 'manual' });
  const texto = await copia.text();
  return { painel: painel.status, copia: copia.status, vazou: /dmanda-exportacao/.test(texto) };
};
const recusado = (r) => r.painel === 500 && r.copia === 500 && !r.vazou;

const casos = [
  ['produção com DMANDA_BANCO=teste, sem a variável de medição', {}, false],
  ['variável de medição ligada, mas com VERCEL=1 e VERCEL_ENV=production', { DMANDA_MEDICAO_LOCAL: 'sim', VERCEL: '1', VERCEL_ENV: 'production' }, false],
  ['variável de medição ligada em Preview (VERCEL=1, VERCEL_ENV=preview, VERCEL_URL)', { DMANDA_MEDICAO_LOCAL: 'sim', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_URL: 'dmanda-git-x.vercel.app' }, false],
  ['variável de medição ligada em Development (VERCEL=1, VERCEL_ENV=development)', { DMANDA_MEDICAO_LOCAL: 'sim', VERCEL: '1', VERCEL_ENV: 'development' }, false],
  ['projeto com as variáveis de sistema da Vercel desligadas: só AWS_LAMBDA_FUNCTION_NAME', { DMANDA_MEDICAO_LOCAL: 'sim', AWS_LAMBDA_FUNCTION_NAME: 'dmanda' }, false],
  ['valor da medição diferente de "sim"', { DMANDA_MEDICAO_LOCAL: 'true' }, false],
  ['medição local legítima: neste computador, variável "sim", sem sinal de nuvem, pasta .dados-teste presente', { DMANDA_MEDICAO_LOCAL: 'sim' }, true],
];
for (const [nome, extra, deveAbrir] of casos) {
  const r = await comServidor(extra, sonda);
  const abriu = r.painel === 200 && r.copia === 200 && r.vazou;
  ok(deveAbrir ? abriu : recusado(r), `${nome}: ${deveAbrir ? 'abre (painel ' + r.painel + ', cópia ' + r.copia + ')' : 'recusado, 500 sem dados (painel ' + r.painel + ', cópia ' + r.copia + ', vazou dados: ' + (r.vazou ? 'SIM' : 'não') + ')'}`);
}
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
