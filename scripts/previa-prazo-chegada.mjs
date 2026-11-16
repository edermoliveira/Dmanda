// Prévia local dos prazos pela data de chegada (etapa 4, 16/11/2026), só para avaliação do Éder no navegador e no iPhone/iPad pela rede. Semeia um banco de TESTE descartável
// (PGlite em .dados-teste/previa-prazo-chegada, dados fictícios) com o feriado de Finados (02/11/2026) e demandas para o roteiro de aceite, e sobe o aplicativo.
// Nunca toca o Supabase real. Uso: node scripts/previa-prazo-chegada.mjs   (porta 7100 ou PORT; para o aparelho na mesma rede, DMANDA_ORIGENS_DEV com o IPv4 exato do computador; só um `next dev` por vez neste projeto)
import { spawn } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

const PASTA = '.dados-teste/previa-prazo-chegada', USUARIO = '00000000-0000-4000-8000-000000000001', porta = process.env.PORT || '7100';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const db = await abrirBancoTeste({ pasta: PASTA });
await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
await c('salvar_dia_indisponivel', { p: { data: '2026-11-02', descricao: 'Finados', categoria: 'Feriado' } });
const mk = async (assunto, o) => { const d = await c('criar_demanda', { p: { assunto, numero: '', etapa: 'Fazendo', ...o } }); await c('adicionar_tarefa', { p_demanda: d.id, p_texto: 'Conferir o andamento' }); return d; };
// 1) duração de 10 dias contada da chegada (23/10/2026): cai em 02/11 (Finados) e o vencimento vai para 30/10/2026
await mk('Resposta ao TCE: 10 dias da chegada, vence em Finados', { tipo: 'Ofício', chegou_em: '2026-10-23', prazo_dias: 10 });
// 2) duração de 5 dias da chegada em dia útil, sem ajuste
await mk('Ofício à Câmara: 5 dias da chegada, sem ajuste', { tipo: 'Ofício', chegou_em: '2026-11-16', prazo_dias: 5 });
// 3) sem chegada e sem prazo: para testar o aviso do que falta ao tocar em "10 dias"
await mk('Memorando sem chegada nem prazo', { tipo: 'Memorando' });
// 4) legado sem chegada: o vencimento registrado fica e a consulta sinaliza a falta da base
const sem = await mk('Legado sem chegada (data registrada)', { tipo: 'Processo', area: 'Geral', prazo_original: '2026-12-04' });
await db.query('update public.demandas set prazo_legado = true where id = $1', [sem.id]);
// 5) legado da regra anterior: duração contada de 05/11 (não da chegada, 01/11); a contagem é mantida
const ant = await mk('Legado da regra anterior (10 dias contados de 05/11)', { tipo: 'Memorando', chegou_em: '2026-11-01', prazo_dias: 10 });
await db.query("update public.demandas set prazo_base_em = '2026-11-05', prazo_original = '2026-11-15', prazo = '2026-11-13', prazo_ajuste = '15/11 domingo; 14/11 sábado', prazo_legado = true where id = $1", [ant.id]);
// 6) finalizada com duração: o prazo do histórico não é recalculado
const fin = await mk('Finalizada com 10 dias da chegada', { tipo: 'Memorando', chegou_em: '2026-09-01', prazo_dias: 10 });
await c('concluir_demanda', { p_id: fin.id });
await db.close();
console.log(`Prévia dos prazos pela chegada: http://localhost:${porta}/ (banco de teste em ${PASTA}, dados fictícios; feriado de Finados em 02/11/2026 já cadastrado).`);
const filho = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', porta], { stdio: 'inherit', env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, DMANDA_SEM_LEMBRETES: 'sim' } });
filho.on('exit', (c2) => process.exit(c2 ?? 0));
