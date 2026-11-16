// Prévia local dos cards do Início (etapa 2, 16/11/2026), só para avaliação do Éder no navegador e no iPhone/iPad pela rede. Semeia um banco de TESTE descartável (PGlite em
// .dados-teste/previa-cards-inicio, dados fictícios) com três vagas do Para hoje (texto curto, longo e curto) e cinco urgências fora delas, e sobe o aplicativo. Nunca toca o Supabase real.
// Uso: node scripts/previa-cards-inicio.mjs   (porta 7100 ou PORT; para o aparelho na mesma rede, DMANDA_ORIGENS_DEV com o IPv4 exato do computador; só um `next dev` por vez neste projeto)
import { spawn } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';

const PASTA = '.dados-teste/previa-cards-inicio', USUARIO = '00000000-0000-4000-8000-000000000001', porta = process.env.PORT || '7100';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const db = await abrirBancoTeste({ pasta: PASTA });
await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
const hoje = (await db.query('select public.hoje()::text as h')).rows[0].h;
const longo = 'Contratação emergencial de empresa especializada para manutenção preventiva e corretiva dos equipamentos de climatização de todos os prédios públicos municipais';
const mk = async (assunto, o, textos = ['Conferir andamento']) => { const d = await c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: '', ...o } }); for (const t of textos) await c('adicionar_tarefa', { p_demanda: d.id, p_texto: t }); return d; };
const vagas = [];
const a = await mk('Ofício ao setor de compras', { prazo_original: hoje }, ['Enviar o ofício']); await c('mover_etapa', { p_id: a.id, p_etapa: 'Cadastro' }); vagas.push(a.id);
vagas.push((await mk(longo, { etapa: 'Fazendo', prazo_original: somarDias(hoje, -2), descricao: longo + '.' }, ['Levantar os equipamentos de cada prédio', 'Pedir três orçamentos', 'Conferir a dotação', 'Minuta do contrato'])).id);
vagas.push((await mk('Resposta ao Tribunal de Contas', { etapa: 'Fazendo', prazo_original: somarDias(hoje, 1) })).id);
await mk('Escala de férias da Secretaria', { etapa: 'Fazendo', prazo_original: somarDias(hoje, -3) });
await mk('Portaria de designação de fiscal', { etapa: 'Fazendo', prazo_original: hoje });
await mk('Reajuste do contrato de limpeza', { etapa: 'Fazendo', prazo_original: somarDias(hoje, -10) });
await mk('Prestação de contas do convênio de transporte escolar do segundo semestre', { etapa: 'Fazendo', prazo_original: somarDias(hoje, -1) });
await mk('Parecer jurídico sobre a cessão de uso do imóvel da antiga rodoviária ' + longo.slice(0, 60), { etapa: 'Fazendo', prazo_original: somarDias(hoje, -6) });
for (const [i, id] of vagas.entries()) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, id]);
await db.close();
console.log(`Prévia dos cards do Início: http://localhost:${porta}/ (banco de teste em ${PASTA}, dados fictícios).`);
const filho = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', porta], { stdio: 'inherit', env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, DMANDA_SEM_LEMBRETES: 'sim' } });
filho.on('exit', (c2) => process.exit(c2 ?? 0));
