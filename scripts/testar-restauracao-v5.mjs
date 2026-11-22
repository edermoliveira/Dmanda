// Cópia versão 5 e restauração com VÁRIAS identidades (decisão 92), em bancos de teste isolados e só com dados fictícios: autoria mapeada por e-mail, conta ausente no destino, cópia de conta comum
// (sem autoria), cópias antigas (v4, sem autoria), rascunhos só da conta que gerou a cópia, nenhuma autorização concedida pela restauração e ausência de segredos. Usa o MESMO montador da rota (src/nucleo/copia.ts)
// e o supabase/restaurar-copia.sql de verdade. NÃO toca o Supabase real. Uso: node scripts/testar-restauracao-v5.mjs
import { readFileSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario, prepararAdminDeTeste, criarContaDeTeste, ADMIN_TESTE } from '../src/servidor/banco-teste-base.mjs';
import { montarCopia } from '../src/nucleo/copia.ts';
import { criarVerificador } from './auxiliar-navegador.mjs';
import { randomUUID } from 'node:crypto';

const v = criarVerificador(), ok = v.ok;
const SQL = readFileSync('supabase/restaurar-copia.sql', 'utf8').replace(/\r\n/g, '\n');
const restaurar = async (db, copia) => db.exec(SQL.replace('__COLE_AQUI_O_JSON__', typeof copia === 'string' ? copia : JSON.stringify(copia)));
const erroDe = async (p) => { try { await p; return null; } catch (e) { return e.message || String(e); } };

// ---------- origem: administradora e duas contas, registros de cada uma ----------
const A = 'a1a1a1a1-0000-4000-8000-00000000000a', B = 'b2b2b2b2-0000-4000-8000-00000000000b';
const origem = await abrirBancoTeste({ pendentes: true });
await prepararAdminDeTeste(origem); await criarContaDeTeste(origem, A, 'ana@exemplo.invalid'); await criarContaDeTeste(origem, B, 'beto@exemplo.invalid');
const co = (u, f, a) => chamarComoUsuario(origem, u, f, a);
const dAdm = await co(ADMIN_TESTE, 'criar_demanda', { p: { assunto: 'Da administradora' } });
const dA = await co(A, 'criar_demanda', { p: { assunto: 'Da Ana', prazo_original: '2027-06-02' } });
await co(B, 'adicionar_tarefa', { p_demanda: dA.id, p_texto: 'Tarefa acrescentada pelo Beto' });
const enA = await co(A, 'criar_entrada', { p: { texto: 'Nota da Ana' } });
const evB = await co(B, 'criar_evento', { p: { titulo: 'Reunião do Beto', tipo: 'Reunião', data: '2027-06-03', inicio: '09:00', fim: '10:00' } });
const diaB = await co(B, 'salvar_dia_indisponivel', { p: { data: '2027-06-04', descricao: 'Feriado do Beto', categoria: 'Feriado' } });
await co(A, 'salvar_rascunho', { p_id: randomUUID(), p_chave: 'e:nova', p_dados: { dados: { texto: 'rascunho privado da Ana' } }, p_base: 0, p_op: randomUUID() });
await co(B, 'salvar_rascunho', { p_id: randomUUID(), p_chave: 'nova', p_dados: { dados: { assunto: 'rascunho privado do Beto' } }, p_base: 0, p_op: randomUUID() });
await co(ADMIN_TESTE, 'salvar_rascunho', { p_id: randomUUID(), p_chave: 'tarefa', p_dados: { nt: 'rascunho da administradora' }, p_base: 0, p_op: randomUUID() });
await origem.query("update dmanda_privado.acesso_autorizado set revogado_em = now() where email = 'beto@exemplo.invalid'");   // o Beto está revogado na origem: a cópia só informa, a restauração não decide acessos

// a cópia como a rota monta: o mesmo montador, com os mesmos dados que as funções devolvem a cada conta
const copiaDe = async (u, admin) => {
  const c = (f, a = {}) => co(u, f, a);
  const acesso = await c('estado_acesso');
  return montarCopia({ agora: new Date('2026-11-22T12:00:00Z'), ativas: await c('listar_demandas', { p_arquivadas: false }), arquivadas: await c('listar_demandas', { p_arquivadas: true }), dias: await c('listar_dias_indisponiveis'),
    entradas: await c('listar_entradas', { p_arquivadas: false }), entradasArquivadas: await c('listar_entradas', { p_arquivadas: true }), eventos: await c('listar_eventos'),
    rascunhos: (await c('listar_rascunhos')).map((r) => ({ id: r.id, chave: r.chave, dados: r.dados, versao: r.versao })), rascunhosDe: acesso.email, autoria: admin ? await c('exportar_autoria') : null });
};
const copiaAdm = await copiaDe(ADMIN_TESTE, true);
const copiaAna = await copiaDe(A, false);   // Beto revogado, mas a Ana continua autorizada: ela lê o painel
ok(copiaAdm.versao === 5 && copiaAdm.autoria.demandas[dA.id] === 'ana@exemplo.invalid' && copiaAdm.autoria.demandas[dAdm.id].includes('@') && copiaAdm.autoria.eventos[evB.id] === 'beto@exemplo.invalid' && copiaAdm.autoria.dias_indisponiveis[diaB.dia.id] === 'beto@exemplo.invalid' && Object.values(copiaAdm.autoria.tarefas).includes('beto@exemplo.invalid'), 'cópia v5 da administradora: traz a autoria de cada registro, mapeada por e-mail');
ok(copiaAdm.acessos_informativo.some((a) => a.email === 'beto@exemplo.invalid' && a.estado === 'revogado') && copiaAdm.rascunhos.length === 1 && copiaAdm.rascunhos[0].chave === 'tarefa' && copiaAdm.rascunhos_de.includes('@'), 'cópia v5: a situação dos acessos vem só como informação e os rascunhos são SÓ os da conta que gerou a cópia (nem o da Ana nem o do Beto)');
ok(!('autoria' in copiaAna) && !('acessos_informativo' in copiaAna) && copiaAna.rascunhos.length === 1 && copiaAna.rascunhos[0].chave === 'e:nova' && copiaAna.rascunhos_de === 'ana@exemplo.invalid' && !JSON.stringify(copiaAna).includes('beto@'), 'cópia v5 de conta comum: sem autoria nem lista de acessos (os e-mails das outras contas não saem), só os rascunhos dela');
const texto = JSON.stringify(copiaAdm) + JSON.stringify(copiaAna);
ok(!/encrypted_password|password|senha|token|secret|service_role|jwt/i.test(texto.replace(/Tarefa|rascunho/gi, '')), 'cópia v5: nenhuma senha, token ou chave no arquivo');
const exp = await co(ADMIN_TESTE, 'exportar_autoria', {});
ok(/Somente a conta administradora/.test((await erroDe(co(A, 'exportar_autoria', {}))) || '') && /Somente/.test((await erroDe(co(B, 'exportar_autoria', {}))) || '') && Object.keys(exp).includes('acessos'), 'exportar_autoria: só a administradora (o banco recusa as demais)');

// ---------- destino 1: todas as contas existem (com identificadores DIFERENTES dos da origem) ----------
const A2 = 'a9a9a9a9-0000-4000-8000-0000000000a1', B2 = 'b9b9b9b9-0000-4000-8000-0000000000b1', ADM2 = 'c9c9c9c9-0000-4000-8000-0000000000c1';
const d1 = await abrirBancoTeste({ pendentes: true });
await prepararAdminDeTeste(d1, ADM2); await criarContaDeTeste(d1, A2, 'ana@exemplo.invalid'); await criarContaDeTeste(d1, B2, 'beto@exemplo.invalid');
await restaurar(d1, copiaAdm);
const q = async (db, s, p = []) => (await db.query(s, p)).rows;
const dono = async (db, t, id) => (await q(db, `select user_id::text u from public.${t} where id = $1`, [id]))[0]?.u;
ok(await dono(d1, 'demandas', dA.id) === A2 && await dono(d1, 'demandas', dAdm.id) === ADM2 && await dono(d1, 'entradas', enA.id) === A2 && await dono(d1, 'eventos', evB.id) === B2 && await dono(d1, 'dias_indisponiveis', diaB.dia.id) === B2, 'destino com todas as contas: cada registro volta para a conta do mesmo e-mail, com o identificador novo do projeto de destino');
ok((await q(d1, 'select user_id::text u from public.tarefas where demanda_id = $1', [dA.id]))[0].u === B2, 'destino: a tarefa acrescentada pelo Beto continua sendo dele (autoria por tarefa)');
ok((await q(d1, 'select count(*)::int n from public.rascunhos'))[0].n === 1 && (await q(d1, "select user_id::text u from public.rascunhos where chave = 'tarefa'"))[0].u === ADM2, 'destino: o rascunho volta só para a conta que gerou a cópia (a administradora)');
ok((await q(d1, "select count(*)::int n from dmanda_privado.acesso_autorizado where revogado_em is not null"))[0].n === 0 && (await q(d1, 'select count(*)::int n from dmanda_privado.acesso_autorizado'))[0].n === 3, 'destino: a restauração NÃO altera a lista de acessos (o "revogado" da cópia é só informação; ninguém é autorizado nem revogado por ela)');
const antes = JSON.stringify([await q(d1, 'select id, user_id from public.demandas order by id'), await q(d1, 'select id from public.rascunhos')]);
await restaurar(d1, copiaAdm);
ok(JSON.stringify([await q(d1, 'select id, user_id from public.demandas order by id'), await q(d1, 'select id from public.rascunhos')]) === antes, 'destino: restaurar duas vezes não duplica nem muda nada');
// visão do painel no destino: as contas veem tudo
ok((await chamarComoUsuario(d1, A2, 'listar_demandas', { p_arquivadas: false })).length === 2 && (await chamarComoUsuario(d1, A2, 'listar_rascunhos', {})).length === 0, 'destino: o painel é compartilhado (a Ana vê as demandas) e os rascunhos da administradora não aparecem para ela');

// ---------- destino 2: falta a conta do Beto ----------
const d2 = await abrirBancoTeste({ pendentes: true });
await prepararAdminDeTeste(d2, ADM2); await criarContaDeTeste(d2, A2, 'ana@exemplo.invalid');
await restaurar(d2, copiaAdm);
ok(await dono(d2, 'eventos', evB.id) === ADM2 && await dono(d2, 'dias_indisponiveis', diaB.dia.id) === ADM2 && await dono(d2, 'demandas', dA.id) === A2 && (await q(d2, "select count(*)::int n from auth.users where email ilike 'beto@%'"))[0].n === 0 && (await q(d2, "select count(*)::int n from dmanda_privado.acesso_autorizado where email like 'beto@%'"))[0].n === 0, 'destino sem a conta do Beto: os registros dele voltam para a administradora e nenhuma conta nem acesso é criado');

// ---------- destino 3: cópia de conta comum (sem autoria) ----------
const d3 = await abrirBancoTeste({ pendentes: true });
await prepararAdminDeTeste(d3, ADM2); await criarContaDeTeste(d3, A2, 'ana@exemplo.invalid');
await restaurar(d3, copiaAna);
ok(await dono(d3, 'demandas', dA.id) === ADM2 && (await q(d3, "select user_id::text u from public.rascunhos where chave = 'e:nova'"))[0].u === A2 && (await q(d3, 'select count(*)::int n from public.rascunhos'))[0].n === 1, 'destino com cópia de conta comum: sem autoria, os registros vão para a administradora; o rascunho volta para a conta de origem (a Ana)');

// ---------- cópias antigas e rejeições ----------
const antiga = { ...copiaAdm, versao: 4 }; delete antiga.autoria; delete antiga.rascunhos; delete antiga.rascunhos_de; delete antiga.acessos_informativo;
const d4 = await abrirBancoTeste({ pendentes: true });
await prepararAdminDeTeste(d4, ADM2); await criarContaDeTeste(d4, A2, 'ana@exemplo.invalid');
await restaurar(d4, antiga);
ok((await q(d4, 'select count(*)::int n from public.demandas'))[0].n === 2 && (await q(d4, 'select count(*)::int n from public.demandas where user_id = $1', [ADM2]))[0].n === 2 && (await q(d4, 'select count(*)::int n from public.rascunhos'))[0].n === 0, 'cópia antiga (v4, sem autoria): continua restaurável e volta inteira para a conta administradora');
const d5 = await abrirBancoTeste({ pendentes: true });
await criarContaDeTeste(d5, A2, 'ana@exemplo.invalid'); await criarContaDeTeste(d5, B2, 'beto@exemplo.invalid');
ok(/administradora não existe/.test((await erroDe(restaurar(d5, copiaAdm))) || '') && (await q(d5, 'select count(*)::int n from public.demandas'))[0].n === 0, 'destino com várias contas e sem a administradora: nada é gravado e a mensagem explica (com um único usuário vale esse usuário, como sempre foi)');
ok(/não é uma cópia/.test((await erroDe(restaurar(d1, { ...copiaAdm, versao: 6 }))) || '') && /não é uma cópia/.test((await erroDe(restaurar(d1, { formato: 'outro', versao: 5 }))) || ''), 'versão desconhecida ou formato errado: recusado');

for (const d of [origem, d1, d2, d3, d4, d5]) await d.close();
process.exit(v.resumo());
