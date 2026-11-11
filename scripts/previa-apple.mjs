// Prévia do protótipo visual (branch visual/apple-design): sobe o aplicativo na porta 7120 com um banco de TESTE próprio
// (.dados-teste/visual-apple, descartável) semeado com demandas fictícias. Nunca toca o Supabase real.
import { spawn } from 'node:child_process';
import { semearAgenda } from './semear-agenda.mjs';
import { abrirBancoTeste } from '../src/servidor/banco-teste-base.mjs';
const PORTA = process.env.PORTA_PREVIA || '7120', PASTA = '.dados-teste/visual-apple';
await semearAgenda(PASTA, process.env.DMANDA_DATA_REFERENCIA || null);
// descrições fictícias para ver a leitura dos cards (a semente da Agenda não as tem)
const db = await abrirBancoTeste({ pasta: PASTA });
await db.query("update public.demandas set descricao = 'Responder ao ofício do Tribunal com os documentos da folha de abril e a certidão negativa.' where assunto = 'Resposta ao Tribunal'");
await db.query("update public.demandas set descricao = 'Consolidar os números do trimestre e enviar ao gabinete.' where assunto = 'Relatório atrasado'");
await db.query("update public.demandas set descricao = 'Aguardando a conciliação bancária de outubro pela Contabilidade.' where assunto = 'Aguarda a Contabilidade'");
await db.close();
console.log(`Prévia em http://localhost:${PORTA}/demandas (Cards)`);
const filho = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { stdio: 'inherit', env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA } });
filho.on('exit', (c) => process.exit(c ?? 0));
