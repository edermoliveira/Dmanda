// Prévia local da abertura direta em aparelhos autorizados (etapa 5, decisão 82), só para avaliação do Éder no navegador e no iPhone/iPad pela rede.
// Sobe um banco de TESTE descartável (PGlite, dados fictícios), um Supabase FALSO só em 127.0.0.1 e o aplicativo REAL em modo real contra ele. Nunca toca o Supabase real.
// A "TERMINAL DO TITULAR" simulada fica em http://localhost:7132/ (só neste computador, nunca na rede): mostra um código novo a cada abertura, liga ou desliga a exigência
// e revoga todos os aparelhos, como `npm run aparelhos` faria com a chave de serviço. O aplicativo fica na porta 7100 (ou PORT); para o aparelho na mesma rede, use
// DMANDA_ORIGENS_DEV com o IPv4 exato do computador. Só um `next dev` por vez neste projeto. Uso: node scripts/previa-aparelhos.mjs
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoServico, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { iniciarSupabaseFalso, CHAVE_PUBLICA, CHAVE_SERVICO } from './supabase-falso.mjs';
import { formatarCodigo, gerarCodigo } from '../src/lib/aparelho.ts';

const PASTA = '.dados-teste/previa-aparelhos', EMAIL = 'titular-ficticio@exemplo.invalid', USUARIO = 'f0f0f0f0-0000-4000-8000-0000000000b2', porta = process.env.PORT || '7100';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const db = await abrirBancoTeste({ pasta: PASTA });
await db.query('insert into auth.users (id, email) values ($1, $2)', [USUARIO, EMAIL]);
await db.query('insert into dmanda_privado.acesso_autorizado (email) values ($1)', [EMAIL]);
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a, { provedor: 'email' });
const mk = async (assunto, o = {}) => { const d = await c('criar_demanda', { p: { assunto, numero: '', etapa: 'Fazendo', ...o } }); await c('adicionar_tarefa', { p_demanda: d.id, p_texto: 'Conferir o andamento' }); return d; };
await mk('Ofício à Câmara sobre o calendário de compras', { tipo: 'Ofício', chegou_em: '2026-11-10', prazo_dias: 10 });
await mk('Processo de indenização por pagamento', { tipo: 'Processo', area: 'Compras', chegou_em: '2026-11-02', prazo_dias: 5 });
await mk('Memorando do Gabinete', { tipo: 'Memorando', origem: 'Gabinete' });
const falso = await iniciarSupabaseFalso({ db, porta: 7131, email: EMAIL, usuarioId: USUARIO });

const html = (corpo) => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terminal do titular (prévia)</title><style>body{font:16px/1.5 system-ui;max-width:34rem;margin:2rem auto;padding:0 1rem}code{font-size:2rem;letter-spacing:.12em}a,button{font:inherit;margin:.25rem .5rem .25rem 0}</style><body><h1>Terminal do titular (simulado)</h1><p>Só neste computador. Faz o que <code style="font-size:1rem;letter-spacing:0">npm run aparelhos</code> faz com a chave de serviço.</p>${corpo}<p><a href="/">Novo código</a> <a href="/exigir?v=sim">Ligar a exigência</a> <a href="/exigir?v=nao">Desligar a exigência</a> <a href="/revogar">Revogar todos os aparelhos</a></p></body></html>`;
const helper = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const enviar = (corpo, status = 200) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(html(corpo)); };
  try {
    if (u.pathname === '/exigir') { await chamarComoServico(db, 'exigir_aparelhos', { p_exigir: u.searchParams.get('v') === 'sim' }); return enviar(`<p>Exigência ${u.searchParams.get('v') === 'sim' ? 'LIGADA' : 'DESLIGADA'}.</p>`); }
    if (u.pathname === '/revogar') { const n = await chamarComoServico(db, 'revogar_todos_aparelhos', {}); return enviar(`<p>${n} aparelho(s) revogado(s). Gere um código novo para autorizar de novo.</p>`); }
    const codigo = gerarCodigo((n) => randomInt(n));
    await chamarComoServico(db, 'criar_convite_terminal', { p_codigo: codigo });
    return enviar(`<p>Código de autorização (vale 10 minutos e uma só vez):</p><p><code>${formatarCodigo(codigo)}</code></p><p>Digite-o na tela de acesso do aparelho.</p>`);
  } catch (e) { return enviar(`<p>Não foi possível: ${String(e.message).replace(/[<>&]/g, '')}</p>`, 400); }
});
await new Promise((r) => helper.listen(7132, '127.0.0.1', r));
console.log(`Prévia dos aparelhos autorizados: aplicativo em http://localhost:${porta}/ (aparelho novo vê a tela de acesso).\nTerminal do titular simulado, só neste computador: http://localhost:7132/ (código novo a cada abertura). Dados fictícios, nada real.`);
// o Next às vezes interrompe a partida para mostrar um aviso de atualização e sai; repetir logo em seguida passa (até 4 tentativas, só se sair cedo)
const iniciar = (tentativa) => {
  const t0 = Date.now();
  const filho = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', porta], { stdio: 'ignore', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: falso.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE_PUBLICA, SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO, DMANDA_EMAIL_AUTORIZADO: EMAIL, CRON_SECRET: 'segredo-de-previa', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_BANCO: '', DMANDA_PREVIA_LOCAL: 'sim' } });
  filho.on('exit', (c2) => { if (Date.now() - t0 < 120_000 && tentativa < 4) iniciar(tentativa + 1); else process.exit(c2 ?? 0); });
};
iniciar(1);
