// Comparação reproduzível dos prazos legados (decisão 81, etapa 4), só em banco de TESTE descartável (PGlite) e dados fictícios. Nunca toca o Supabase real.
// 1) monta o esquema publicado (até a migração 20261110000000) mais a das quatro vagas, sem Pagamentos, e grava registros "da regra anterior" (duração contada de outro dia, com e sem
//    chegada, data escolhida, finalizada, arquivada, legado e sem prazo);
// 2) aplica a migração da etapa 4 e prova que NENHUMA linha mudou (a migração não faz backfill);
// 3) calcula, com as regras puras em TypeScript, o que um backfill mudaria e o que seria preservado, e por quê;
// 4) valida a proposta de backfill (supabase/propostas/) contra essa conta, a idempotência, o isolamento por usuário, e o caminho de volta (inclusive uma demanda editada depois).
// Uso: node scripts/comparar-prazos-legados.mjs   (grava a tabela em .dados-teste/comparacao-prazos-legados.md)
import { readFileSync, mkdtempSync, copyFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { ajustarPrazo, prazoPorDias } from '../src/lib/prazos.ts';

let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
const m20 = todas.find((f) => f.includes('origem_documento_para_hoje')), m4 = todas.find((f) => f.includes('para_hoje_quatro_vagas')), m5 = todas.find((f) => f.includes('prazo_pela_chegada'));
const pasta = mkdtempSync(join(tmpdir(), 'dmanda-comparar-'));
try {
  for (const f of todas.filter((f) => f <= m20 || f === m4)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
  const db = await abrirBancoTeste({ raizMigracoes: pasta });
  const U = 'f1f1f1f1-5555-4555-8555-f1f1f1f1f1f1', O = 'f2f2f2f2-5555-4555-8555-f2f2f2f2f2f2';
  for (const [id, e] of [[U, 'cmp-a@teste'], [O, 'cmp-b@teste']]) { await db.exec(`insert into auth.users (id, email) values ('${id}', '${e}')`); await db.exec(`insert into dmanda_privado.acesso_autorizado (email) values ('${e}')`); }
  const c = (u, f, a) => chamarComoUsuario(db, u, f, a);
  const dias = [{ data: '2026-11-02', descricao: 'Finados', categoria: 'Feriado' }, { data: '2026-12-25', descricao: 'Natal', categoria: 'Feriado' }];
  for (const d of dias) await c(U, 'salvar_dia_indisponivel', { p: d });   // o calendário de O fica vazio, de propósito

  // ---------- registros "da regra anterior" ----------
  // Cada registro nasce pelo cadastro do esquema publicado (data original + vencimento ajustado + versão) e depois recebe a duração e o dia de partida que a regra anterior gravaria.
  const REG = [];
  const novo = async (u, rotulo, { chegou = null, original = null, dias: nDias = null, base = null, etapa = 'Fazendo', arquivar = false, legado = false, acompanhar = null, expl }) => {
    const d = await c(u, 'criar_demanda', { p: { assunto: rotulo, ...(chegou ? { chegou_em: chegou } : {}), ...(original ? { prazo_original: original } : {}), etapa: etapa === 'Finalizado' ? 'Fazendo' : etapa, ...(acompanhar ? { acompanhar_em: acompanhar } : {}) } });
    if (nDias) await db.query('update public.demandas set prazo_dias = $2, prazo_base_em = $3 where id = $1', [d.id, nDias, base]);
    if (legado) await db.query('update public.demandas set prazo_legado = true where id = $1', [d.id]);
    if (etapa === 'Finalizado') await c(u, 'concluir_demanda', { p_id: d.id });
    if (arquivar) await c(u, 'arquivar_demanda', { p_id: d.id });
    REG.push({ id: d.id, rotulo, user: u, expl });
    return d;
  };
  await novo(U, 'A1 duração contada de 12/10, chegou 01/10', { chegou: '2026-10-01', original: '2026-10-22', dias: 10, base: '2026-10-12', expl: 'duração contada de outro dia' });
  await novo(U, 'A2 duração de 30 dias contada de 05/10, chegou 03/10', { chegou: '2026-10-03', original: '2026-11-04', dias: 30, base: '2026-10-05', expl: 'duração contada de outro dia' });
  await novo(U, 'A3 duração contada antes da chegada (06/11, chegou 10/11)', { chegou: '2026-11-10', original: '2026-11-11', dias: 5, base: '2026-11-06', expl: 'duração contada de outro dia' });
  await novo(U, 'A4 aguardando retorno, duração já contada da chegada', { chegou: '2026-10-15', original: '2026-11-04', dias: 20, base: '2026-10-15', etapa: 'Aguardando retorno', acompanhar: '2026-11-20', expl: 'base igual à chegada (já contada pela chegada)' });
  await novo(U, 'A5 aguardando retorno, contada de 16/10', { chegou: '2026-10-14', original: '2026-10-26', dias: 10, base: '2026-10-16', etapa: 'Aguardando retorno', acompanhar: '2026-11-20', expl: 'duração contada de outro dia' });
  await novo(U, 'B1 duração sem chegada', { original: '2026-11-09', dias: 20, base: '2026-10-20', expl: 'sem chegada' });
  await novo(U, 'C1 data escolhida à mão, com chegada', { chegou: '2026-11-30', original: '2026-12-11', expl: 'data explícita' });
  await novo(U, 'D1 legado sem chegada', { original: '2026-12-04', legado: true, expl: 'sem chegada' });
  await novo(U, 'E1 finalizada, duração de outro dia', { chegou: '2026-09-01', original: '2026-09-21', dias: 10, base: '2026-09-11', etapa: 'Finalizado', expl: 'finalizada (histórico)' });
  await novo(U, 'F1 arquivada, duração de outro dia', { chegou: '2026-09-01', original: '2026-09-21', dias: 10, base: '2026-09-11', arquivar: true, expl: 'arquivada (histórico)' });
  await novo(U, 'G1 duração já contada da chegada', { chegou: '2026-11-03', original: '2026-11-13', dias: 10, base: '2026-11-03', expl: 'base igual à chegada (já contada pela chegada)' });
  await novo(U, 'J1 duração gravada sem a base da contagem', { chegou: '2026-10-05', original: '2026-10-19', dias: 10, base: null, expl: 'sem base' });
  await novo(U, 'H1 sem prazo', { chegou: '2026-11-03', expl: 'sem prazo' });
  await novo(O, 'O1 outro usuário, duração contada de 05/10 (sem feriado cadastrado)', { chegou: '2026-10-03', original: '2026-11-04', dias: 30, base: '2026-10-05', expl: 'duração contada de outro dia' });

  const foto = async () => (await db.query('select * from public.demandas order by id')).rows;
  const colunas = 'id, assunto, etapa, arquivada_em is not null as arquivada, chegou_em::text, prazo::text, prazo_original::text, prazo_dias, prazo_base_em::text, prazo_ajuste, prazo_legado, versao, user_id::text, acompanhar_em::text';
  const ler = async () => (await db.query(`select ${colunas} from public.demandas order by assunto`)).rows;
  const antes = await ler(), fotoAntes = JSON.stringify(await foto());

  // ---------- 2) a migração da etapa 4 não toca nenhuma linha ----------
  await db.exec(readFileSync(join('supabase/migrations', m5), 'utf8'));
  ok(JSON.stringify(await foto()) === fotoAntes, 'a migração da etapa 4 aplicada sobre os registros antigos não mudou nenhuma linha (nem o vencimento, nem a versão)');

  // ---------- 3) o que um backfill mudaria, pelas regras puras ----------
  const diasDe = (u) => (u === U ? dias.map((d, i) => ({ id: `d${i}`, ...d, criado_em: `2026-01-0${i + 1}` })) : []);
  const previsto = antes.map((r) => {
    const candidato = r.etapa !== 'Finalizado' && !r.arquivada && r.prazo_dias !== null && !!r.chegou_em && !!r.prazo_base_em && r.prazo_base_em !== r.chegou_em;
    let motivo;
    if (r.etapa === 'Finalizado') motivo = 'preservada: finalizada (histórico)';
    else if (r.arquivada) motivo = 'preservada: arquivada (histórico)';
    else if (r.prazo === null) motivo = 'preservada: sem prazo';
    else if (r.prazo_dias === null) motivo = r.chegou_em ? 'preservada: data escolhida à mão (sem duração gravada)' : 'preservada: sem chegada (falta a base de cálculo)';
    else if (!r.chegou_em) motivo = 'preservada: sem chegada (falta a base de cálculo)';
    else if (!r.prazo_base_em) motivo = 'preservada: sem base de contagem gravada (não há evidência da duração)';
    else if (r.prazo_base_em === r.chegou_em) motivo = 'preservada: a duração já foi contada da chegada';
    else motivo = 'MUDARIA: duração contada de outro dia';
    if (!candidato) return { ...r, motivo, novo: null };
    const orig = prazoPorDias(r.prazo_dias, r.chegou_em), aj = ajustarPrazo(orig, diasDe(r.user_id));
    return { ...r, motivo, novo: { prazo_original: orig, prazo: aj.prazo, prazo_ajuste: aj.ajuste, prazo_base_em: r.chegou_em } };
  });
  const mudam = previsto.filter((p) => p.novo && (p.novo.prazo !== p.prazo || p.novo.prazo_original !== p.prazo_original || p.novo.prazo_base_em !== p.prazo_base_em));
  const linhas = ['| Demanda | Chegada | Duração | Contada de | Vencimento hoje | Vencimento pelo backfill | Resultado |', '|---|---|---|---|---|---|---|'];
  const br = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : 'sem');
  for (const p of previsto) linhas.push(`| ${p.assunto} | ${br(p.chegou_em)} | ${p.prazo_dias ? `${p.prazo_dias} dias` : 'sem'} | ${br(p.prazo_base_em)} | ${br(p.prazo)} (original ${br(p.prazo_original)}) | ${p.novo ? `${br(p.novo.prazo)} (original ${br(p.novo.prazo_original)}${p.novo.prazo_ajuste ? `; ${p.novo.prazo_ajuste}` : ''})` : 'igual'} | ${p.motivo} |`);
  mkdirSync('.dados-teste', { recursive: true });
  writeFileSync('.dados-teste/comparacao-prazos-legados.md', `# Comparação dos prazos legados (dados fictícios, banco de teste)\n\n${linhas.join('\n')}\n\nMudariam: ${mudam.length} de ${previsto.length}. Preservadas: ${previsto.length - mudam.length}.\n`);
  console.log('\n' + linhas.join('\n') + `\n\nMudariam: ${mudam.length} de ${previsto.length}. Preservadas: ${previsto.length - mudam.length}.\n`);
  const nomes = (l) => l.map((x) => x.assunto.slice(0, 2)).sort().join();
  ok(nomes(mudam) === 'A1,A2,A3,A5,O1', `a conta pelas regras puras separa o que mudaria (${nomes(mudam)}) do que seria preservado, cada um com o seu motivo`);
  ok(previsto.find((p) => p.assunto.startsWith('A2')).novo.prazo === '2026-10-30' && previsto.find((p) => p.assunto.startsWith('O1')).novo.prazo === '2026-11-02', 'o calendário é de cada usuário: o mesmo 02/11 vira 30/10 para quem cadastrou Finados e continua 02/11 para o outro');
  ok(previsto.filter((p) => !p.novo).every((p) => /^preservada/.test(p.motivo)) && previsto.filter((p) => p.novo && !mudam.includes(p)).every((p) => /^preservada/.test(p.motivo)), 'todo registro preservado tem o motivo escrito');

  // ---------- 4) proposta de backfill, no banco de teste ----------
  const SQL_IDA = readFileSync('supabase/propostas/backfill_prazos_pela_chegada.sql', 'utf8'), SQL_VOLTA = readFileSync('supabase/propostas/reverter_backfill_prazos_pela_chegada.sql', 'utf8');
  await db.exec(SQL_IDA);
  const depois = await ler();
  const porId = (l) => Object.fromEntries(l.map((r) => [r.id, r]));
  const A = porId(antes), D = porId(depois);
  let certo = true; const erros = [];
  for (const p of previsto) {
    const d = D[p.id];
    if (p.novo && mudam.includes(p)) {
      if (d.prazo_original !== p.novo.prazo_original || d.prazo !== p.novo.prazo || d.prazo_ajuste !== p.novo.prazo_ajuste || d.prazo_base_em !== p.novo.prazo_base_em || d.prazo_dias !== p.prazo_dias || d.versao <= p.versao) { certo = false; erros.push(p.assunto); }
    } else if (JSON.stringify(d) !== JSON.stringify(A[p.id])) { certo = false; erros.push(p.assunto); }
  }
  ok(certo, `o backfill proposto muda exatamente o que a conta previu (mesmo vencimento, original, motivo e base) e deixa as demais linhas idênticas, versão inclusive${erros.length ? ': ' + erros.join(', ') : ''}`);
  const aguard = depois.find((r) => r.assunto.startsWith('A5'));
  ok(aguard.acompanhar_em === '2026-11-20' && aguard.etapa === 'Aguardando retorno', 'o "Acompanhar em" e a etapa de espera ficam como estavam (regras próprias, fora do backfill)');
  ok((await db.query('select count(*)::int n from dmanda_privado.backfill_prazo_chegada')).rows[0].n === mudam.length, 'a cópia de segurança guarda só as linhas que mudaram');
  const fotoDepois = JSON.stringify(await foto());
  await db.exec(SQL_IDA);
  ok(JSON.stringify(await foto()) === fotoDepois, 'aplicar o backfill duas vezes não muda mais nada (idempotente)');
  // uma demanda editada depois do backfill não é revertida
  const editada = REG.find((r) => r.rotulo.startsWith('A1'));
  await c(U, 'atualizar_demanda', { p_id: editada.id, p: { descricao: 'editada depois do backfill' } });
  const resultados = await db.exec(SQL_VOLTA);
  const naoRevertidas = resultados.flatMap((r) => r.rows ?? []).map((r) => r.id);
  const apos = await ler(), B = porId(apos);
  const cols = ['prazo', 'prazo_original', 'prazo_dias', 'prazo_base_em', 'prazo_ajuste', 'prazo_legado'];
  const voltou = mudam.filter((p) => p.id !== editada.id).every((p) => cols.every((k) => B[p.id][k] === A[p.id][k]));
  ok(voltou, 'o caminho de volta devolve exatamente o vencimento, o original, a duração, a base, o motivo e a marca de legado de quem ainda estava na versão do backfill');
  ok(cols.some((k) => B[editada.id][k] !== A[editada.id][k]) && B[editada.id].prazo_original === previsto.find((p) => p.id === editada.id).novo.prazo_original, 'quem foi editado depois do backfill não é revertido (continua com o prazo novo) e fica na lista de "não revertidas"');
  ok(previsto.filter((p) => !mudam.includes(p)).every((p) => cols.every((k) => B[p.id][k] === A[p.id][k])), 'a volta não toca nas linhas que o backfill não tinha mudado');
  ok(naoRevertidas.length === 1 && naoRevertidas[0] === editada.id, 'a volta lista, para conferência, a única demanda que não reverteu (a editada depois)');
  await db.close();
} finally { rmSync(pasta, { recursive: true, force: true }); }
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
