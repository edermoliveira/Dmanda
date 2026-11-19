// Prévia local das quatro vagas, da Urgência e dos nove carrosséis (etapa 3, 16/11/2026), só para avaliação do Éder no navegador e no iPhone/iPad pela rede. Semeia um banco de TESTE descartável
// (PGlite em .dados-teste/previa-vagas-carrosseis, dados fictícios) com 14 demandas que alimentam as nove filas e deixa as vagas vazias (o aplicativo preenche as quatro na primeira abertura), e sobe o aplicativo.
// Nunca toca o Supabase real. Uso: node scripts/previa-vagas-carrosseis.mjs   (porta 7100 ou PORT; para o aparelho na mesma rede, DMANDA_ORIGENS_DEV com o IPv4 exato do computador; só um `next dev` por vez neste projeto)
import { spawn } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario, prepararTitularDeTeste, USUARIO_TESTE as USUARIO } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';

const PASTA = '.dados-teste/previa-vagas-carrosseis', porta = process.env.PORT || '7100';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const db = await abrirBancoTeste({ pasta: PASTA });
await prepararTitularDeTeste(db, USUARIO);
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
const hoje = (await db.query('select public.hoje()::text as h')).rows[0].h, dia = (n) => somarDias(hoje, n);
// o vencimento exato vai direto ao banco (sem o ajuste de fim de semana e feriado), para as fronteiras de 7 e 8 dias valerem em qualquer dia
const mk = async (assunto, { prazo = null, chegou = null, ...o } = {}) => {
  const d = await c('criar_demanda', { p: { assunto, numero: '', etapa: 'Fazendo', ...(chegou === null ? {} : { chegou_em: dia(chegou) }), ...o } });
  if (prazo !== null) await db.query('update public.demandas set prazo = $1, prazo_original = $1 where id = $2', [dia(prazo), d.id]);
  await c('adicionar_tarefa', { p_demanda: d.id, p_texto: 'Conferir o andamento' });
  return d;
};
await mk('Ofício da Prefeita sobre a creche', { tipo: 'Ofício', origem: 'Prefeita', prazo: -4, chegou: -30 });
await mk('Ofício à Câmara com vencimento em sete dias', { tipo: 'Ofício', prazo: 7, chegou: -10 });
await mk('Ofício com vencimento em oito dias', { tipo: 'Ofício', prazo: 8, chegou: -9 });
await mk('Ofício sem data de chegada', { tipo: 'Ofício', prazo: 20 });
await mk('Processo de indenização por pagamento', { tipo: 'Processo', area: 'Compras', prazo: -1, chegou: -20 });
await mk('Processo de compra de material de limpeza', { tipo: 'Processo', area: 'Compras', chegou: -50 });
await mk('Protocolo pessoal do servidor', { tipo: 'Protocolo', area: 'Pessoal', prazo: 3, chegou: -5 });
await mk('Protocolo geral que vence hoje', { tipo: 'Protocolo', area: 'Geral', prazo: 0, chegou: -2 });
await mk('Processo geral atrasado', { tipo: 'Processo', area: 'Geral', prazo: -8, chegou: -40 });
await mk('Processo pessoal sem prazo', { tipo: 'Processo', area: 'Pessoal', chegou: -3 });
await mk('Memorando do Gabinete', { tipo: 'Memorando', origem: 'Gabinete', prazo: 2, chegou: -1 });
await mk('Memorando atrasado', { tipo: 'Memorando', prazo: -3, chegou: -15 });
await mk('Memorando sem chegada nem prazo', { tipo: 'Memorando' });
await mk('Memorando de vencimento distante', { tipo: 'Memorando', prazo: 30, chegou: -60 });
await db.close();
console.log(`Prévia das quatro vagas e dos carrosséis: http://localhost:${porta}/ (banco de teste em ${PASTA}, dados fictícios).`);
const filho = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', porta], { stdio: 'inherit', env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, DMANDA_SEM_LEMBRETES: 'sim' } });
filho.on('exit', (c2) => process.exit(c2 ?? 0));
