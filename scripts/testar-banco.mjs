// Testa as migrações e as funções SQL do núcleo de demandas e tarefas, com a RLS valendo, num Postgres local de teste (PGlite).
// Valida a lógica SQL e o isolamento por usuário. NÃO valida o Supabase real (plataforma, Auth, chaves, rede).
// Uso: node scripts/testar-banco.mjs
import { readFileSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario, chamarComoServico, entrarComo } from '../src/servidor/banco-teste-base.mjs';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const db = await abrirBancoTeste();
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@teste'), ('${B}', 'b@teste')`);
// lista protegida de contas autorizadas (no Supabase real é preenchida à parte, com o e-mail do Secretário; aqui são contas de teste)
await db.exec("insert into dmanda_privado.acesso_autorizado (email) values ('a@teste'), ('b@teste'), ('r@teste'), ('s@teste')");
const c = (u, f, a) => chamarComoUsuario(db, u, f, a);
const erro = async (u, f, a) => { try { await c(u, f, a); return null; } catch (e) { return e.message || String(e); } };

// criar e validar
ok(/Informe o assunto/.test(await erro(A, 'criar_demanda', { p: { assunto: '  ' } })), 'criar sem assunto é recusado com mensagem clara');
const d1 = await c(A, 'criar_demanda', { p: { assunto: ' Resposta ao TCE ', tipo: 'Processo', numero: '1842/2026', origem: 'TCE-RS', descricao: 'Texto', prazo_original: '2026-10-16', prazo_tipo: 'Legal' } });
ok(d1.etapa === 'Cadastro' && d1.assunto === 'Resposta ao TCE' && d1.numero === '1842/2026' && d1.prazo === '2026-10-16' && d1.prazo_original === '2026-10-16' && d1.prazo_legado === false && d1.prazo_tipo === 'Legal' && !('user_id' in d1) && d1.tarefas.length === 0, 'criar grava os campos informados, começa em Cadastro e não expõe user_id');
const d2 = await c(A, 'criar_demanda', { p: { assunto: 'Só o assunto' } });
ok(d2.numero === '' && d2.origem === '' && d2.chegou_em === null && d2.prazo === null && d2.prazo_original === null && d2.setor === null && d2.acompanhar_em === null && d2.tipo === null && d2.area === 'Geral' && d2.rapida === false && d2.documento_ano === null, 'só o assunto é obrigatório (o documento é opcional: sem tipo, sem Processo inventado, sem Rápida e sem ano): número, origem e chegada ficam vazios (nada de "s/n", "Não informada" nem data de hoje inventados) e nada de prazo, setor ou acompanhamento é inventado');
ok(/Protocolo só pode/.test(await erro(A, 'criar_demanda', { p: { assunto: 'x', tipo: 'Protocolo', area: 'Compras' } })), 'Protocolo de Compras é recusado');
ok(/não nasce finalizada/.test(await erro(A, 'criar_demanda', { p: { assunto: 'x', etapa: 'Finalizado' } })), 'demanda nova não nasce finalizada');

// isolamento (RLS) entre usuários
ok((await c(B, 'listar_demandas', {})).length === 0 && (await c(A, 'listar_demandas', {})).length === 2, 'RLS: o outro usuário não vê as demandas de A');
ok(/não encontrada/.test(await erro(B, 'buscar_demanda', { p_id: d1.id })) && /não encontrada/.test(await erro(B, 'arquivar_demanda', { p_id: d1.id })) && /não encontrada/.test(await erro(B, 'mover_etapa', { p_id: d1.id, p_etapa: 'Vistos' })), 'RLS: B não lê, arquiva nem move a demanda de A');
ok(/não encontrada/.test(await erro(B, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: 'invasão' })), 'RLS: B não adiciona tarefa na demanda de A');
const anon = await db.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query('select public.listar_demandas()'); return null; } catch (e) { return e.message; } });
ok(/permission denied/i.test(anon || ''), 'sem login (papel anon) não executa nenhuma função');

// tarefas
let t = await c(A, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Levantar diárias' });
ok(t.etapa === 'Vistos' && t.tarefas.length === 1 && t.tarefas[0].posicao === 1, 'a primeira tarefa leva a demanda de Cadastro para Vistos (regra documentada)');
t = await c(A, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Conferir com a Contabilidade' }); t = await c(A, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Redigir a resposta' });
ok(t.etapa === 'Vistos' && t.tarefas.map((x) => x.posicao).join() === '1,2,3' && t.tarefas.map((x) => x.texto).join('|') === 'Levantar diárias|Conferir com a Contabilidade|Redigir a resposta', 'tarefas seguintes mantêm a ordem de inclusão');
ok(/Escreva a tarefa/.test(await erro(A, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: ' ' })), 'tarefa vazia é recusada');
const [t1, t2, t3] = t.tarefas;
// resposta perdida (migração 13): repetir a inclusão com a MESMA identidade da tentativa devolve a tarefa que já existe; texto igual com outra identidade é outra tarefa (nada é deduplicado pelo conteúdo)
{
  const T1 = 'c1111111-1111-4111-8111-111111111111', T2 = 'c2222222-2222-4222-8222-222222222222', antes = t.tarefas.length;
  const p1 = await c(A, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Tarefa com identidade', p_id: T1 });
  const p2 = await c(A, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Tarefa com identidade', p_id: T1 });
  ok(p1.tarefas.length === antes + 1 && p2.tarefas.length === antes + 1 && p2.tarefas.filter((x) => x.id === T1).length === 1, 'tarefa: repetir a inclusão com a mesma identidade (resposta perdida) não duplica');
  const p3 = await c(A, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Tarefa com identidade', p_id: T2 });
  const p4 = await c(A, 'adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Tarefa com identidade' });
  ok(p3.tarefas.length === antes + 2 && p4.tarefas.length === antes + 3 && p4.tarefas.filter((x) => x.texto === 'Tarefa com identidade').length === 3, 'tarefa: o mesmo texto com outra identidade (ou sem identidade) é outra tarefa; o banco não deduplica pelo conteúdo');
  ok(/não encontrada|já existe|outra demanda/i.test(await erro(A, 'adicionar_tarefa', { p_demanda: d2.id, p_texto: 'x', p_id: T1 })), 'tarefa: a mesma identidade em outra demanda é recusada');
  for (const x of [T1, T2]) await c(A, 'excluir_tarefa', { p_id: x });
  await c(A, 'excluir_tarefa', { p_id: p4.tarefas.find((x) => x.texto === 'Tarefa com identidade' && x.id !== T1 && x.id !== T2).id });
  t = await c(A, 'buscar_demanda', { p_id: d1.id });
}
t = await c(A, 'editar_tarefa', { p_id: t3.id, p_texto: '  Redigir a resposta final ' }); ok(t.tarefas[2].texto === 'Redigir a resposta final', 'editar tarefa grava o texto novo');
t = await c(A, 'marcar_tarefa', { p_id: t1.id, p_concluida: true }); t = await c(A, 'marcar_tarefa', { p_id: t2.id, p_concluida: true });
ok(t.tarefas.filter((x) => x.concluida).length === 2 && t.etapa === 'Vistos', 'marcar tarefas atualiza só as marcadas e não muda a etapa');
t = await c(A, 'marcar_tarefa', { p_id: t3.id, p_concluida: true }); ok(t.etapa === 'Vistos' && t.tarefas.every((x) => x.concluida), 'marcar todas não conclui a demanda sozinho');
t = await c(A, 'marcar_tarefa', { p_id: t2.id, p_concluida: false }); ok(!t.tarefas[1].concluida, 'desmarcar funciona');
t = await c(A, 'excluir_tarefa', { p_id: t1.id }); ok(t.tarefas.length === 2 && t.tarefas.map((x) => x.posicao).join() === '1,2' && t.tarefas[0].texto === 'Conferir com a Contabilidade', 'excluir tarefa fecha o buraco e mantém a ordem');
ok(/não encontrada/.test(await erro(B, 'marcar_tarefa', { p_id: t2.id, p_concluida: true })), 'RLS: B não marca tarefa de A');

// etapas
let m = await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Aguardando retorno' });
ok(m.etapa === 'Aguardando retorno' && m.setor === null && m.acompanhar_em === null && m.prazo === '2026-10-16', 'mover para Aguardando retorno não inventa setor, acompanhamento nem prazo');
m = await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Finalizado' });
ok(m.etapa === 'Finalizado' && /^\d{4}-/.test(m.concluida_em) && m.tarefas.every((x) => x.concluida), 'concluir marca todas as tarefas e registra a data de conclusão');
// histórico de conclusões (produtividade do Perfil): a data persistida é a da última conclusão; só reabrir e concluir de novo a move
await db.exec(`update public.demandas set concluida_em = '2026-10-01' where id = '${d1.id}'`);
ok((await c(A, 'concluir_demanda', { p_id: d1.id })).concluida_em === '2026-10-01' && (await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Finalizado' })).concluida_em === '2026-10-01', 'conclusões: concluir de novo uma demanda já finalizada não move a data de conclusão');
ok((await c(A, 'salvar_demanda', { p_versao: (await c(A, 'buscar_demanda', { p_id: d1.id })).versao, p_id: d1.id, p: { etapa: 'Finalizado' }, p_tarefas: null })).concluida_em === '2026-10-01', 'conclusões: salvar uma demanda finalizada reenviando a mesma etapa não move a data de conclusão');
m = await c(A, 'reabrir_demanda', { p_id: d1.id });
ok(m.etapa === 'Fazendo' && m.concluida_em === null && m.tarefas.every((x) => x.concluida) && m.tarefas.length === 2, 'reabrir volta para Fazendo, mantém as tarefas cumpridas e limpa a conclusão');
await c(A, 'concluir_demanda', { p_id: d1.id });
m = await c(A, 'reabrir_demanda', { p_id: d1.id, p_etapa: 'Vistos' }); ok(m.etapa === 'Vistos', 'reabrir leva para a etapa escolhida');
ok(/Só uma demanda finalizada/.test(await erro(A, 'reabrir_demanda', { p_id: d1.id })), 'reabrir uma demanda que não está finalizada é recusado');
await c(A, 'concluir_demanda', { p_id: d1.id }); m = await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Cadastro' }); ok(m.etapa === 'Cadastro' && m.concluida_em === null, 'mover de Finalizado para outra etapa equivale a reabrir na etapa escolhida');
ok(/Etapa desconhecida/.test(await erro(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Qualquer' })), 'etapa inválida é recusada');
ok((await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Cadastro' })).etapa === 'Cadastro', 'mover para a mesma etapa não faz nada');
const direto = await db.transaction(async (tx) => { try { await entrarComo(tx, A); await tx.query("update public.demandas set etapa = 'Finalizado' where id = $1", [d1.id]); return null; } catch (e) { return e.message; } });
ok(/concluida_so_finalizada/.test(direto || ''), 'a restrição do banco impede Finalizado sem data de conclusão mesmo por escrita direta');

// atualizar
let u = await c(A, 'atualizar_demanda', { p_id: d1.id, p: { assunto: 'Novo assunto', origem: '', prazo_original: null, descricao: 'Nova descrição' } });
ok(u.assunto === 'Novo assunto' && u.origem === '' && u.prazo === null && u.prazo_original === null && u.descricao === 'Nova descrição' && u.numero === '1842/2026' && u.prazo_tipo === 'Legal' && u.tarefas.length === 2, 'atualizar muda só os campos informados, limpa o prazo com null e preserva o resto');
u = await c(A, 'atualizar_demanda', { p_id: d1.id, p: { prazo_original: '2026-11-05', prazo_tipo: 'Próprio', setor: ' PGM ', acompanhar_em: '2026-10-28' } });
ok(u.prazo === '2026-11-05' && u.prazo_tipo === 'Próprio' && u.setor === 'PGM' && u.acompanhar_em === '2026-10-28', 'atualizar prazo, tipo de prazo, setor e acompanhamento');
ok(/assunto não pode/.test(await erro(A, 'atualizar_demanda', { p_id: d1.id, p: { assunto: '' } })) && /Protocolo só pode/.test(await erro(A, 'atualizar_demanda', { p_id: d1.id, p: { tipo: 'Protocolo', area: 'Compras' } })), 'atualizar valida assunto vazio e Protocolo de Compras');
ok(/não encontrada/.test(await erro(B, 'atualizar_demanda', { p_id: d1.id, p: { assunto: 'sequestro' } })), 'RLS: B não altera a demanda de A');

// arquivar, desarquivar, excluir
let r = await c(A, 'arquivar_demanda', { p_id: d2.id }); ok(r.arquivada_em !== null, 'arquivar marca a data de arquivamento');
ok((await c(A, 'listar_demandas', { p_arquivadas: false })).length === 1 && (await c(A, 'listar_demandas', { p_arquivadas: true })).length === 1, 'listar separa ativas e arquivadas');
ok(/arquivada/.test(await erro(A, 'mover_etapa', { p_id: d2.id, p_etapa: 'Vistos' })), 'demanda arquivada não se move até desarquivar');
r = await c(A, 'desarquivar_demanda', { p_id: d2.id }); ok(r.arquivada_em === null, 'desarquivar limpa o arquivamento');
ok(/confirmação/.test(await erro(A, 'excluir_demanda', { p_id: d1.id })) && /confirmação/.test(await erro(A, 'excluir_demanda', { p_id: d1.id, p_confirmado: false })), 'excluir sem confirmação é recusado');
ok(/não encontrada/.test(await erro(B, 'excluir_demanda', { p_id: d1.id, p_confirmado: true })), 'RLS: B não exclui a demanda de A');
r = await c(A, 'excluir_demanda', { p_id: d1.id, p_confirmado: true });
const resto = await db.query('select count(*)::int as n from public.tarefas where demanda_id = $1', [d1.id]);
ok(r.excluida === true && resto.rows[0].n === 0 && (await c(A, 'listar_demandas', {})).length === 1, 'excluir com confirmação remove a demanda e as tarefas dela');

// salvar a janela de edição de uma vez (atômico)
const ver = async (id) => (await c(A, 'buscar_demanda', { p_id: id })).versao; // versão atual da demanda (o salvar exige a versão em que a janela foi aberta)
const e1 = await c(A, 'criar_demanda', { p: { assunto: 'Edição em lote', tipo: 'Memorando' } });
let sv = await c(A, 'salvar_demanda', { p_versao: await ver(e1.id), p_id: e1.id, p: { assunto: 'Edição salva', descricao: 'Texto novo', prazo_original: '2026-12-01' }, p_tarefas: [{ texto: 'Primeira', concluida: false }, { texto: 'Segunda', concluida: true }] });
ok(sv.assunto === 'Edição salva' && sv.prazo === '2026-12-01' && sv.tarefas.map((x) => x.texto).join() === 'Primeira,Segunda' && sv.tarefas[1].concluida === true && sv.etapa === 'Vistos', 'salvar grava campos e tarefas novas, na ordem, e Cadastro vai para Vistos com a primeira tarefa');
const [s1, s2] = sv.tarefas;
sv = await c(A, 'salvar_demanda', { p_versao: await ver(e1.id), p_id: e1.id, p: {}, p_tarefas: [{ id: s2.id, texto: 'Segunda (editada)', concluida: false }, { id: s1.id, texto: 'Primeira', concluida: true }, { texto: 'Terceira', concluida: false }] });
ok(sv.tarefas.map((x) => x.texto).join('|') === 'Segunda (editada)|Primeira|Terceira' && sv.tarefas.map((x) => x.posicao).join() === '1,2,3' && sv.tarefas[0].id === s2.id && sv.tarefas[1].concluida === true, 'salvar reordena, edita e marca mantendo os identificadores das tarefas existentes');
sv = await c(A, 'salvar_demanda', { p_versao: await ver(e1.id), p_id: e1.id, p: {}, p_tarefas: [{ id: s1.id, texto: 'Primeira', concluida: true }] });
ok(sv.tarefas.length === 1 && sv.tarefas[0].id === s1.id, 'tarefas fora da lista são excluídas');
const antesAtomico = JSON.stringify(await c(A, 'buscar_demanda', { p_id: e1.id }));
ok(/não pode ficar vazia/.test(await erro(A, 'salvar_demanda', { p_versao: await ver(e1.id), p_id: e1.id, p: { assunto: 'NÃO DEVE GRAVAR' }, p_tarefas: [{ id: s1.id, texto: 'x', concluida: false }, { texto: '   ', concluida: false }] })) && JSON.stringify(await c(A, 'buscar_demanda', { p_id: e1.id })) === antesAtomico, 'uma tarefa inválida desfaz tudo: nada do salvar é gravado (atomicidade)');
sv = await c(A, 'salvar_demanda', { p_versao: await ver(e1.id), p_id: e1.id, p: { etapa: 'Finalizado', assunto: 'Concluída pela janela' }, p_tarefas: [{ id: s1.id, texto: 'Primeira', concluida: false }, { texto: 'Nova', concluida: false }] });
ok(sv.etapa === 'Finalizado' && sv.tarefas.every((x) => x.concluida) && sv.assunto === 'Concluída pela janela' && sv.concluida_em !== null, 'salvar com etapa Finalizado conclui: marca todas as tarefas e registra a data');
sv = await c(A, 'salvar_demanda', { p_versao: await ver(e1.id), p_id: e1.id, p: { etapa: 'Fazendo' }, p_tarefas: null });
ok(sv.etapa === 'Fazendo' && sv.concluida_em === null && sv.tarefas.length === 2 && sv.tarefas.every((x) => x.concluida), 'salvar com outra etapa reabre mantendo as tarefas');
ok(/não encontrada/.test(await erro(B, 'salvar_demanda', { p_id: e1.id, p: { assunto: 'x' }, p_tarefas: [], p_versao: 1 })), 'RLS: B não salva a demanda de A');
ok(/Etapa desconhecida|check/i.test(await erro(A, 'salvar_demanda', { p_versao: await ver(e1.id), p_id: e1.id, p: { etapa: 'Voando' }, p_tarefas: null })), 'etapa inválida no salvar é recusada');
sv = await c(A, 'salvar_demanda', { p_versao: await ver(e1.id), p_id: e1.id, p: { tipo: 'Processo', area: 'Compras' }, p_tarefas: null });
ok(sv.tipo === 'Processo' && sv.area === 'Compras' && sv.tarefas.length === 2, 'salvar sem lista de tarefas não mexe nas tarefas');


// ---------- rotina diária (resumo operacional datado, execuções, privilégios) ----------
const serv = (f, a) => chamarComoServico(db, f, a);
const errServ = async (f, a) => { try { await serv(f, a); return null; } catch (e) { return e.message || String(e); } };
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const hojeSql = (await sql('select public.hoje()::text as h'))[0].h;
const mais = async (n) => (await sql('select (public.hoje() + $1::int)::text as d', [n]))[0].d;

// ambiente limpo para a rotina: usuários novos com datas relativas a hoje
const R = '33333333-3333-4333-8333-333333333333', S = '44444444-4444-4444-8444-444444444444';
await db.exec(`insert into auth.users (id, email) values ('${R}', 'r@teste'), ('${S}', 's@teste')`);
// Estas demandas testam a LEITURA do prazo pela rotina, com datas relativas a hoje: o prazo é fixado direto, sem o ajuste de fim de semana (que tem testes próprios mais abaixo),
// para o resultado não depender do dia da semana em que o teste roda.
const fixarPrazo = async (id, data) => { await sql('update public.demandas set prazo = $2::date, prazo_original = $2::date where id = $1', [id, data]); return c(R, 'buscar_demanda', { p_id: id }); };
const mk = async (p) => { const { prazo, ...resto } = p; const d = await c(R, 'criar_demanda', { p: resto }); return prazo ? fixarPrazo(d.id, prazo) : d; };
const venc = await mk({ assunto: 'Vencida', prazo: await mais(-4), prazo_tipo: 'Legal' });
const hojeD = await mk({ assunto: 'Vence hoje', prazo: await mais(0) });
const em3 = await mk({ assunto: 'Em três dias', prazo: await mais(3) });
const em9 = await mk({ assunto: 'Em nove dias', prazo: await mais(9) });
const semPrazo = await mk({ assunto: 'Sem prazo' });
const aguLonge = await mk({ assunto: 'Aguardando longe', prazo: await mais(1), acompanhar_em: await mais(20) });
await c(R, 'mover_etapa', { p_id: aguLonge.id, p_etapa: 'Aguardando retorno' });
const aguPerto = await mk({ assunto: 'Aguardando perto', acompanhar_em: await mais(2) });
await c(R, 'mover_etapa', { p_id: aguPerto.id, p_etapa: 'Aguardando retorno' });
const fim = await mk({ assunto: 'Finalizada', prazo: await mais(-9) });
await c(R, 'concluir_demanda', { p_id: fim.id });
const arq = await mk({ assunto: 'Arquivada', prazo: await mais(-2) });
await c(R, 'arquivar_demanda', { p_id: arq.id });
const instantaneo = async () => (await sql("select md5(string_agg(d::text, '|' order by d.id)) as h from public.demandas d"))[0].h;

// o gatilho já mantém o resumo de hoje a cada alteração; confere os números esperados pela regra dos grupos do Início
let rs = (await sql('select dados, origem from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [R]))[0];
ok(rs && rs.origem === 'alteracao', 'rotina: o resumo de hoje é recalculado quando uma demanda muda (gatilho)');
ok(rs.dados.atrasadas === 1 && rs.dados.hoje === 1 && rs.dados.sete_dias === 3 && rs.dados.abertas === 7 && rs.dados.finalizadas === 1, 'rotina: contagens por data (1 atrasada, 1 hoje, 3 em até 7 dias (o vencimento de quem aguarda retorno também vale); 7 abertas, 1 finalizada; arquivada fora)');
ok(rs.dados.sem_prazo === 1 && rs.dados.aguardando_retorno === 2 && rs.dados.prazo_vencido === 1, 'rotina: sem prazo = 1; aguardando = 2; prazo vencido = 1 (a data aplicável é a mais próxima, sem o corte antigo de 3 dias)');
ok(rs.dados.data_ref === hojeSql && rs.dados.proxima_data === hojeSql && rs.dados.ids.atrasadas[0] === venc.id && rs.dados.ids.hoje[0] === hojeD.id, 'rotina: o resumo guarda a data de referência e os identificadores (sem texto das demandas)');
ok(!JSON.stringify(rs.dados).includes('Vencida'), 'rotina: o resumo não contém assunto nem outro texto das demandas');

// privilégios: só o papel de serviço roda a rotina
ok(/permission denied/i.test(await erro(R, 'rotina_diaria', {})) && /permission denied/i.test(await erro(R, 'registrar_falha_rotina', { p_erro: 'x' })), 'rotina: usuário logado não pode executar a rotina nem registrar falha');
ok(/permission denied/i.test(await erro(R, 'calcular_resumo', { p_user: R, p_data: hojeSql })) && /permission denied/i.test(await erro(R, 'recalcular_resumo_usuario', { p_user: S, p_data: hojeSql, p_origem: 'rotina' })), 'rotina: funções internas não são chamáveis por usuário logado');
const comoAnon = async (q) => db.transaction(async (tx) => { await tx.exec('set local role anon'); try { await tx.query(q); return null; } catch (e) { return e.message; } });
ok(/permission denied/i.test(await comoAnon('select public.rotina_diaria()')) && /permission denied/i.test(await comoAnon('select * from public.resumos_operacionais')) && /permission denied/i.test(await comoAnon('select * from public.execucoes_rotina')), 'rotina: visitante sem login não executa nem lê nada');
const comoUsuarioSql = async (q) => db.transaction(async (tx) => { await entrarComo(tx, R); try { await tx.query(q); return null; } catch (e) { return e.message; } });
ok(/permission denied|row-level/i.test(await comoUsuarioSql("insert into public.execucoes_rotina (data_ref, ok) values (public.hoje(), true)")) && /permission denied|row-level/i.test(await comoUsuarioSql("update public.resumos_operacionais set dados = '{}'")) && /permission denied|row-level/i.test(await comoUsuarioSql('delete from public.execucoes_rotina')), 'rotina: usuário logado não escreve nos resumos nem no registro de execuções');

// execução pelo papel de serviço: não altera demandas, é repetível e registra
const antes = await instantaneo();
const r1 = await serv('rotina_diaria', {});
const nUsuarios = async () => (await sql('select count(distinct user_id)::int as n from public.demandas'))[0].n;
const n1 = await nUsuarios();
ok(r1.data_ref === hojeSql && r1.usuarios === n1 && Object.keys(r1).sort().join() === 'data_ref,usuarios', 'rotina: o papel de serviço executa e a resposta traz só a data e a contagem de usuários');
const r2 = await serv('rotina_diaria', {});
ok(await instantaneo() === antes, 'rotina: não altera demandas, prazos nem conclusões (somente leitura)');
rs = (await sql('select count(*)::int as n, max(origem) as o from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [R]))[0];
ok(rs.n === 1 && rs.o === 'rotina', 'rotina: repetir no mesmo dia mantém um único resumo (idempotente) e marca a origem');
let ex = await sql('select ok, usuarios, erro from public.execucoes_rotina order by iniciou_em');
ok(ex.length === 2 && ex.every((x) => x.ok && x.usuarios === n1 && x.erro === null) && r2.usuarios === n1, 'rotina: cada execução bem-sucedida fica registrada');

// RLS: cada usuário vê só o próprio resumo; o registro de execuções não tem dado pessoal
await c(S, 'criar_demanda', { p: { assunto: 'Outro usuário', prazo_original: await mais(-1) } });
await serv('rotina_diaria', {});
const veR = await db.transaction(async (tx) => { await entrarComo(tx, R); return (await tx.query('select user_id from public.resumos_operacionais')).rows; });
ok(veR.length === 1 && veR[0].user_id === R, 'rotina: RLS, cada usuário vê só o próprio resumo');

// dias restantes derivados das datas: mudar o prazo muda o resumo na hora, sem esperar o dia seguinte
await fixarPrazo(em9.id, await mais(-1));
rs = (await sql('select dados from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [R]))[0];
ok(rs.dados.atrasadas === 2 && rs.dados.sete_dias === 3, 'rotina: alterar um prazo recalcula o resumo de hoje (atrasadas 2)');
await c(R, 'mover_etapa', { p_id: venc.id, p_etapa: 'Finalizado' });
rs = (await sql('select dados from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [R]))[0];
ok(rs.dados.atrasadas === 1 && rs.dados.finalizadas === 2, 'rotina: concluir uma demanda recalcula o resumo');
await c(R, 'arquivar_demanda', { p_id: em3.id });
await c(R, 'excluir_demanda', { p_id: semPrazo.id, p_confirmado: true });
rs = (await sql('select dados from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [R]))[0];
ok(rs.dados.sete_dias === 2 && rs.dados.sem_prazo === 0, 'rotina: arquivar e excluir também recalculam');

// recálculo por data: o mesmo conjunto de demandas, visto de outro dia, dá outro resultado (nada depende de um contador que decai)
const amanha = (await sql("select public.calcular_resumo($1, public.hoje() + 1) as r", [R]))[0].r;
const hojeR = (await sql("select public.calcular_resumo($1, public.hoje()) as r", [R]))[0].r;
ok(amanha.atrasadas === hojeR.atrasadas + hojeR.hoje && amanha.data_ref !== hojeR.data_ref, 'rotina: o cálculo é função das datas e da data de referência (visto de amanhã, o que vencia hoje fica atrasado)');

// falhas: registrar, identificar na tela e continuar correta
await serv('registrar_falha_rotina', { p_erro: 'Falha ao executar a rotina (XX000).' });
const est = await c(R, 'estado_rotina', {});
ok(est.ultima_ok && est.ultima_falha && est.resumo_data === hojeSql, 'rotina: o estado para a tela traz a última execução, a última falha e a data do resumo');
await serv('registrar_falha_rotina', { p_erro: 'y'.repeat(500) });
ok((await sql('select max(char_length(erro))::int as m from public.execucoes_rotina'))[0].m === 200, 'rotina: o registro de falha guarda no máximo 200 caracteres');

// uma execução com erro no meio desfaz tudo (transação): simula removendo o papel de leitura
const nExAntes = (await sql('select count(*)::int as n from public.execucoes_rotina'))[0].n;
await db.exec('alter table public.demandas rename to demandas_x');
const eFalha = await errServ('rotina_diaria', {});
await db.exec('alter table public.demandas_x rename to demandas');
ok(!!eFalha && (await sql('select count(*)::int as n from public.execucoes_rotina'))[0].n === nExAntes, 'rotina: com o banco em falha a execução termina com erro e não registra sucesso falso');

// ---------- acesso exclusivo à conta autorizada (hook de cadastro, RLS por e-mail do JWT, privilégios explícitos) ----------
const X = '55555555-5555-4555-8555-555555555555', Z = '6e6e6e6e-6666-4666-8666-6e6e6e6e6e6e';
await db.exec(`insert into auth.users (id, email) values ('${X}', 'intruso@teste'), ('${Z}', null)`);   // usuários que NÃO estão na lista (e um sem e-mail)
const doUsuario = async (id, opcoes, q, p = []) => db.transaction(async (tx) => { await entrarComo(tx, id, opcoes); try { return { rows: (await tx.query(q, p)).rows }; } catch (e) { return { erro: e.message }; } });
// RLS: um usuário fora da lista não lê, não grava e não executa nada, mesmo com sessão válida e user_id dele
ok((await doUsuario(X, {}, 'select count(*)::int as n from public.demandas')).rows?.[0].n === 0, 'acesso: usuário fora da lista autorizada não enxerga nenhuma demanda (RLS)');
ok(/row-level security/i.test((await doUsuario(X, {}, "insert into public.demandas (assunto) values ('invasão')")).erro || ''), 'acesso: usuário fora da lista não consegue gravar demanda (RLS recusa)');
ok(/row-level/i.test(await erro(X, 'criar_demanda', { p: { assunto: 'invasão' } })), 'acesso: usuário fora da lista não cria demanda pelas funções');
ok((await doUsuario(X, {}, 'select count(*)::int as n from public.execucoes_rotina')).rows?.[0].n === 0, 'acesso: usuário fora da lista não lê nem o registro de execuções da rotina');
// a terceira camada (conta autorizada na RLS) vale também para Entradas e dias indisponíveis (migração 12)
ok(/row-level security/i.test((await doUsuario(X, {}, "insert into public.entradas (titulo, texto) values ('', 'invasão')")).erro || '') && /row-level/i.test(await erro(X, 'criar_entrada', { p: { texto: 'invasão' } })), 'acesso: usuário fora da lista não grava entradas (RLS, nem pelas funções)');
ok(/row-level security/i.test((await doUsuario(X, {}, "insert into public.dias_indisponiveis (data, descricao, categoria) values ('2027-01-01', 'invasão', 'Feriado')")).erro || '') && /row-level/i.test(await erro(X, 'salvar_dia_indisponivel', { p: { data: '2027-01-01', descricao: 'invasão', categoria: 'Feriado' } })), 'acesso: usuário fora da lista não grava dias indisponíveis (RLS, nem pelas funções)');
// provedor e e-mail vêm do JWT assinado: Google ou e-mail e senha, sempre com e-mail da lista
ok((await doUsuario(A, { provedor: 'email' }, 'select count(*)::int as n from public.demandas')).rows?.[0].n > 0, 'acesso: conta da lista entrando por e-mail e senha lê e grava como no Google (mesmo usuário e mesmos dados)');
ok((await doUsuario(A, { provedor: 'github' }, 'select count(*)::int as n from public.demandas')).rows?.[0].n === 0 && (await doUsuario(A, { provedor: 'anonymous' }, 'select count(*)::int as n from public.demandas')).rows?.[0].n === 0 && (await doUsuario(A, { provedor: '' }, 'select count(*)::int as n from public.demandas')).rows?.[0].n === 0, 'acesso: conta da lista por outro provedor (GitHub, anônimo, sem provedor) não lê nada');
ok((await doUsuario(X, { provedor: 'email' }, 'select count(*)::int as n from public.demandas')).rows?.[0].n === 0 && /row-level security/i.test((await doUsuario(X, { provedor: 'email' }, "insert into public.demandas (assunto) values ('invasão')")).erro || ''), 'acesso: usuário fora da lista não entra pela senha: não lê nem grava, como no Google');
ok((await doUsuario(A, { email: 'outro@teste' }, 'select count(*)::int as n from public.demandas')).rows?.[0].n === 0, 'acesso: JWT com e-mail diferente do autorizado não lê nada');
ok((await doUsuario(A, { email: '  A@Teste ' }, 'select count(*)::int as n from public.demandas')).rows?.[0].n > 0, 'acesso: o e-mail é comparado sem diferenciar maiúsculas nem espaços');
ok((await doUsuario(Z, { email: null }, 'select count(*)::int as n from public.demandas')).rows?.[0].n === 0, 'acesso: JWT sem e-mail não lê nada');
ok((await doUsuario(A, { email: '' }, 'select dmanda_privado.conta_autorizada() as r')).rows?.[0].r === false && (await doUsuario(A, {}, 'select dmanda_privado.conta_autorizada() as r')).rows?.[0].r === true, 'acesso: conta_autorizada() é falsa sem e-mail e verdadeira para a conta da lista (Google ou e-mail e senha)');
// a lista é protegida
ok(/permission denied/i.test((await doUsuario(A, {}, 'select * from dmanda_privado.acesso_autorizado')).erro || '') && /permission denied/i.test((await doUsuario(A, {}, "insert into dmanda_privado.acesso_autorizado (email) values ('x@y.z')")).erro || ''), 'acesso: usuário logado, mesmo autorizado, não lê nem grava a lista protegida');
ok(/permission denied/i.test(await comoAnon('select * from dmanda_privado.acesso_autorizado')) && /permission denied/i.test(await comoAnon('select dmanda_privado.conta_autorizada()')), 'acesso: visitante sem login não lê a lista nem consulta a função');
// hook Before User Created
const hook = async (email, provedor, papel = 'supabase_auth_admin') => db.transaction(async (tx) => {
  await tx.exec(`set local role ${papel}`);
  try { return (await tx.query('select public.hook_antes_criar_usuario($1::jsonb) as r', [JSON.stringify({ metadata: { name: 'before-user-created' }, user: { email, app_metadata: { provider: provedor, providers: [provedor] }, user_metadata: { email: 'a@teste' } } })])).rows[0].r; } catch (e) { return { falha: e.message }; }
});
ok(JSON.stringify(await hook('a@teste', 'google')) === '{}' && JSON.stringify(await hook(' A@TESTE ', 'google')) === '{}', 'hook: a conta autorizada entrando pelo Google é permitida (resposta vazia), sem diferenciar maiúsculas');
const negado = await hook('intruso@teste', 'google');
ok(negado.error?.http_code === 403 && /não tem acesso/.test(negado.error.message), 'hook: outra conta do Google é recusada com 403 e mensagem em português');
ok((await hook('a@teste', 'email')).error?.http_code === 403 && (await hook('intruso@teste', 'email')).error?.http_code === 403, 'hook: ninguém cria usuário por e-mail e senha, nem com o endereço autorizado (a senha é definida no usuário que já existe; sem isso, uma conta recriada sem confirmação de e-mail entraria só pelo e-mail)');
ok((await hook('a@teste', 'anonymous')).error?.http_code === 403 && (await hook('a@teste', 'github')).error?.http_code === 403 && (await hook('a@teste', 'phone')).error?.http_code === 403 && (await hook('', 'google')).error?.http_code === 403 && (await hook(null, 'email')).error?.http_code === 403, 'hook: mesmo e-mail por outro provedor (anônimo, GitHub, telefone) ou sem e-mail é recusado');
ok((await hook('b@teste', 'google', 'postgres')).error === undefined && /permission denied/i.test((await hook('a@teste', 'google', 'authenticated')).falha || '') && /permission denied/i.test((await hook('a@teste', 'google', 'anon')).falha || ''), 'hook: só o papel do Auth (supabase_auth_admin) executa o hook; usuário logado e visitante não');
// lista vazia fecha tudo
const guardada = (await sql('select email from dmanda_privado.acesso_autorizado')).length;
const vazia = await db.transaction(async (tx) => {
  await tx.exec('delete from dmanda_privado.acesso_autorizado');
  await tx.exec('set local role supabase_auth_admin');
  const h = (await tx.query("select public.hook_antes_criar_usuario('{\"user\":{\"email\":\"a@teste\",\"app_metadata\":{\"provider\":\"google\"}}}'::jsonb) as r")).rows[0].r;
  await tx.exec('reset role');
  await entrarComo(tx, A);
  const n = (await tx.query('select count(*)::int as n from public.demandas')).rows[0].n;
  throw Object.assign(new Error('desfazer'), { r: { h, n } });

}).catch((e) => e.r ?? null);
const nAposVazia = (await sql('select count(*)::int as n from dmanda_privado.acesso_autorizado'))[0].n;
ok(vazia && vazia.h.error?.http_code === 403 && vazia.n === 0 && guardada === 4 && nAposVazia === 4, 'acesso: com a lista vazia ninguém entra, nem no cadastro nem no banco (o padrão é fechado); a lista volta intacta');

// privilégios do Supabase com a exposição automática desligada: o que as migrações não declaram não existe
const privTab = await sql("select has_table_privilege('authenticated', 'public.demandas', 'select, insert, update, delete') as crud, has_table_privilege('authenticated', 'public.demandas', 'truncate') as trunc, has_table_privilege('anon', 'public.demandas', 'select') as anon_sel, has_table_privilege('service_role', 'public.demandas', 'select') as svc_sel");
ok(privTab[0].crud && !privTab[0].trunc && !privTab[0].anon_sel && !privTab[0].svc_sel, 'privilégios: usuário logado tem só select, insert, update e delete (sem truncate); visitante e papel de serviço não tocam as demandas');
const privFn = await sql("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute'))");
ok(privFn.length === 0, 'privilégios: nenhuma função do Dmanda é executável por visitante nem por "public" (' + privFn.map((x) => x.proname).join(',') + ')');
// atualizar_demanda (gravação parcial, sem versão) é uma operação do usuário logado: autorização e concorrência são coisas diferentes. Quem não é a conta autorizada não a executa (acima e pela RLS);
// a conta autorizada a executa de propósito (é o que salvar_demanda usa por dentro e o que simula "o outro aparelho" nos testes de versão), e ela sobe a versão, então a janela antiga que depois salvar é recusada.
const privAtualizar = (await sql("select has_function_privilege('anon', 'public.atualizar_demanda(uuid, jsonb)', 'execute') as anon, has_function_privilege('public', 'public.atualizar_demanda(uuid, jsonb)', 'execute') as pub, has_function_privilege('authenticated', 'public.atualizar_demanda(uuid, jsonb)', 'execute') as logado"))[0];
ok(privAtualizar.anon === false && privAtualizar.pub === false && privAtualizar.logado === true, 'privilégios: atualizar_demanda só é executável pelo usuário logado (nunca anônimo nem público)');
const privSvc = await sql("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and has_function_privilege('service_role', p.oid, 'execute') order by 1");
ok(privSvc.map((x) => x.proname).join() === 'registrar_falha_rotina,rotina_diaria', 'privilégios: o papel de serviço executa somente rotina_diaria e registrar_falha_rotina');

// proteção contra edição simultânea (migração 7). Antes dela, o teste que ficava aqui reproduzia o defeito: salvar uma janela antiga apagava a tarefa criada
// em outro aparelho, sem aviso. Agora a janela antiga é recusada pelo banco (código DM409), inteira, e nada do que foi gravado depois se perde.
{
  const codigo = async (u, f, a) => { try { await c(u, f, a); return null; } catch (e) { return e.code || 'sem-codigo'; } };
  const foto = async (id) => JSON.stringify(await c(A, 'buscar_demanda', { p_id: id }));
  const lista = (d) => d.tarefas.map((t) => ({ id: t.id, texto: t.texto, concluida: t.concluida }));
  const dl = await c(A, 'criar_demanda', { p: { assunto: 'Edição simultânea TESTE', descricao: 'original' } });
  const comUma = await c(A, 'adicionar_tarefa', { p_demanda: dl.id, p_texto: 'visível na janela antiga' });
  ok(Number.isInteger(comUma.versao) && comUma.versao > dl.versao, 'versão: toda demanda devolve o número de versão e ele sobe quando uma tarefa é criada');
  const janelaAntiga = { versao: comUma.versao, tarefas: lista(comUma) }; // o que a janela de edição do aparelho 1 mostrava ao ser aberta

  // aparelho 2 grava depois: cria uma tarefa e muda um campo
  await c(A, 'adicionar_tarefa', { p_demanda: dl.id, p_texto: 'criada no outro aparelho' });
  const outro = await c(A, 'atualizar_demanda', { p_id: dl.id, p: { descricao: 'alterada no outro aparelho' } });
  ok(outro.versao > janelaAntiga.versao && outro.tarefas.length === 2, 'versão: a mudança feita no outro aparelho (tarefa e campo) subiu a versão');
  const antes = await foto(dl.id);

  // aparelho 1 salva a janela antiga: o defeito antigo apagava a tarefa nova e desfazia o campo; agora é recusado por inteiro
  const cod = await codigo(A, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'ALTERADO PELA JANELA ANTIGA', descricao: 'texto antigo' }, p_tarefas: janelaAntiga.tarefas, p_versao: janelaAntiga.versao });
  ok(cod === 'DM409', 'janela desatualizada: o banco recusa o salvamento com o código de conflito (DM409)');
  const msg = await erro(A, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'x' }, p_tarefas: janelaAntiga.tarefas, p_versao: janelaAntiga.versao });
  ok(/alterada em outro aparelho ou janela/.test(msg) && /Nada foi gravado/.test(msg), 'janela desatualizada: a mensagem é compreensível e diz que nada foi gravado');
  const depois = JSON.parse(await foto(dl.id));
  ok(await foto(dl.id) === antes, 'janela desatualizada: nada mudou no banco (campos, tarefas, ordem, versão e etapa idênticos), sem perda parcial');
  ok(depois.tarefas.length === 2 && depois.tarefas.some((t) => t.texto === 'criada no outro aparelho') && depois.assunto === 'Edição simultânea TESTE' && depois.descricao === 'alterada no outro aparelho', 'janela desatualizada: a tarefa criada no outro aparelho permanece e os campos gravados lá não foram sobrescritos');

  // a recusa vale com ou sem lista de tarefas, com etapa pedida e para versão que nunca existiu
  ok(await codigo(A, 'salvar_demanda', { p_id: dl.id, p: { etapa: 'Finalizado' }, p_tarefas: null, p_versao: janelaAntiga.versao }) === 'DM409'
    && await codigo(A, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'y' }, p_tarefas: [], p_versao: depois.versao + 5 }) === 'DM409'
    && await foto(dl.id) === antes, 'janela desatualizada: também recusada só com campos, pedindo etapa, ou com versão que não existe (nada muda)');
  ok(/não informada/.test(await erro(A, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'y' }, p_tarefas: null, p_versao: null })) && await foto(dl.id) === antes, 'versão ausente é recusada (não existe caminho de salvamento sem conferência)');
  const erroAssinaturaAntiga = await erro(A, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'y' }, p_tarefas: [] });
  ok(erroAssinaturaAntiga !== null && await foto(dl.id) === antes, 'a assinatura antiga de salvar_demanda (sem versão) deixou de existir');

  // com a versão atual, salva; a versão devolvida serve para o salvamento seguinte e a anterior deixa de valer
  const s1 = await c(A, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'Edição simultânea TESTE (atual)' }, p_tarefas: lista(depois), p_versao: depois.versao });
  ok(s1.assunto.endsWith('(atual)') && s1.tarefas.length === 2 && s1.versao > depois.versao, 'com a versão atual o salvamento grava e devolve a nova versão');
  const s2 = await c(A, 'salvar_demanda', { p_id: dl.id, p: { descricao: 'segunda gravação' }, p_tarefas: lista(s1), p_versao: s1.versao });
  ok(s2.descricao === 'segunda gravação' && await codigo(A, 'salvar_demanda', { p_id: dl.id, p: { descricao: 'reaproveitou a versão velha' }, p_tarefas: lista(s2), p_versao: s1.versao }) === 'DM409', 'a versão devolvida pelo salvamento serve para o próximo e a anterior é recusada');

  // duas janelas abertas na mesma versão: a primeira que salva vence e a outra é recusada (a trava da linha serializa as duas, sem perda do que a primeira gravou)
  const base = await c(A, 'buscar_demanda', { p_id: dl.id });
  await c(A, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'janela 1 salvou primeiro' }, p_tarefas: [...lista(base), { texto: 'tarefa da janela 1', concluida: false }], p_versao: base.versao });
  ok(await codigo(A, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'janela 2' }, p_tarefas: lista(base), p_versao: base.versao }) === 'DM409'
    && (await c(A, 'buscar_demanda', { p_id: dl.id })).tarefas.some((t) => t.texto === 'tarefa da janela 1'), 'duas janelas na mesma versão: a segunda é recusada e a tarefa gravada pela primeira permanece');

  // toda operação que altera a demanda ou as tarefas sobe a versão (por gatilho), então vale para qualquer origem da mudança
  {
    const v = async () => (await c(A, 'buscar_demanda', { p_id: dl.id })).versao;
    const t0 = (await c(A, 'buscar_demanda', { p_id: dl.id })).tarefas[0];
    const operacoes = [
      ['atualizar_demanda', () => c(A, 'atualizar_demanda', { p_id: dl.id, p: { numero: '9/2026' } })],
      ['mover_etapa', () => c(A, 'mover_etapa', { p_id: dl.id, p_etapa: 'Fazendo' })],
      ['adicionar_tarefa', () => c(A, 'adicionar_tarefa', { p_demanda: dl.id, p_texto: 'nova para a versão' })],
      ['editar_tarefa', () => c(A, 'editar_tarefa', { p_id: t0.id, p_texto: 'editada para a versão' })],
      ['marcar_tarefa', () => c(A, 'marcar_tarefa', { p_id: t0.id, p_concluida: true })],
      ['excluir_tarefa', () => c(A, 'excluir_tarefa', { p_id: t0.id })],
      ['concluir_demanda', () => c(A, 'concluir_demanda', { p_id: dl.id })],
      ['reabrir_demanda', () => c(A, 'reabrir_demanda', { p_id: dl.id, p_etapa: 'Vistos' })],
      ['arquivar_demanda', () => c(A, 'arquivar_demanda', { p_id: dl.id })],
      ['desarquivar_demanda', () => c(A, 'desarquivar_demanda', { p_id: dl.id })],
    ];
    const naoSobem = [];
    for (const [nome, f] of operacoes) { const a = await v(); await f(); if (!((await v()) > a)) naoSobem.push(nome); }
    ok(naoSobem.length === 0, 'versão: sobe em toda operação que altera a demanda ou as tarefas (' + (naoSobem.join(',') || operacoes.length + ' operações conferidas') + ')');
    const lido = await v();
    await c(A, 'listar_demandas', {}); await c(A, 'buscar_demanda', { p_id: dl.id });
    ok(await v() === lido, 'versão: apenas ler não altera a versão');
  }

  // outra conta não troca a versão nem enxerga a demanda (a RLS continua valendo)
  ok(/não encontrada/.test(await erro(B, 'salvar_demanda', { p_id: dl.id, p: { assunto: 'x' }, p_tarefas: [], p_versao: 1 })), 'RLS: outra conta não salva a demanda mesmo informando uma versão');
  const dx = await c(A, 'excluir_demanda', { p_id: dl.id, p_confirmado: true });
  ok(dx.excluida === true && (await db.query('select count(*)::int as n from public.tarefas where demanda_id = $1', [dl.id])).rows[0].n === 0, 'os gatilhos de versão não atrapalham a exclusão da demanda com suas tarefas');
}

// cópia dos dados e restauração (supabase/restaurar-copia.sql): exporta como a rota /api/exportar, restaura num banco novo e compara tudo (dados fictícios, bancos em memória)
{
  const SQL_RESTAURAR = readFileSync('supabase/restaurar-copia.sql', 'utf8');
  if (SQL_RESTAURAR.split('__COLE_AQUI_O_JSON__').length !== 2) throw new Error('o marcador do JSON deve aparecer uma única vez em supabase/restaurar-copia.sql');
  const O = '33333333-3333-4333-8333-333333333333', N = '44444444-4444-4444-8444-444444444444';
  const novoBanco = async (...usuarios) => {
    const d = await abrirBancoTeste();
    for (const [id, email] of usuarios) { await d.query('insert into auth.users (id, email) values ($1, $2)', [id, email]); await d.query('insert into dmanda_privado.acesso_autorizado (email) values ($1) on conflict do nothing', [email]); }
    return d;
  };
  const rodar = (d, json) => d.exec(SQL_RESTAURAR.replace('__COLE_AQUI_O_JSON__', () => (typeof json === 'string' ? json : JSON.stringify(json))));
  const tentar = async (d, json) => { try { await rodar(d, json); return null; } catch (e) { return e.message || String(e); } };
  const todas = async (d, u) => {
    const lista = [...(await chamarComoUsuario(d, u, 'listar_demandas', { p_arquivadas: false })), ...(await chamarComoUsuario(d, u, 'listar_demandas', { p_arquivadas: true }))];
    return JSON.stringify(lista.sort((a, b) => a.id.localeCompare(b.id)));
  };
  const contar = async (d) => { const r = await d.query('select (select count(*) from public.demandas)::int as d, (select count(*) from public.tarefas)::int as t'); return `${r.rows[0].d}/${r.rows[0].t}`; };
  const achar = async (d, u, id) => JSON.parse(await todas(d, u)).find((x) => x.id === id);

  // origem: dados fictícios com acento, aspas, cifrão, barra, quebra de linha, demanda finalizada e demanda arquivada com tarefas
  const origem = await novoBanco([O, 'origem@teste']);
  const co = (f, a) => chamarComoUsuario(origem, O, f, a);
  const TEXTOS = ['Primeira á', 'Segunda "q"', "Terceira 'a'"];
  const x1 = await co('criar_demanda', { p: { assunto: 'Ofício "especial" d\'Água $$ ção', descricao: 'linha 1\nlinha 2 com $dmanda e \\ barra', numero: '77/2026', prazo_original: '2026-12-01', prazo_tipo: 'Legal', origem: 'Câmara' } });
  for (const tx of TEXTOS) await co('adicionar_tarefa', { p_demanda: x1.id, p_texto: tx });
  const x2 = await co('criar_demanda', { p: { assunto: 'Finalizada TESTE', tipo: 'Portaria' } });
  await co('adicionar_tarefa', { p_demanda: x2.id, p_texto: 'única' }); await co('concluir_demanda', { p_id: x2.id });
  const x3 = await co('criar_demanda', { p: { assunto: 'Arquivada TESTE', area: 'Compras', setor: 'PGM', acompanhar_em: '2026-11-03' } });
  await co('adicionar_tarefa', { p_demanda: x3.id, p_texto: 'tarefa arquivada' }); await co('mover_etapa', { p_id: x3.id, p_etapa: 'Aguardando retorno' }); await co('arquivar_demanda', { p_id: x3.id });
  await co('criar_demanda', { p: { assunto: 'Sem tarefas TESTE' } });
  // entradas da cópia (versão 3): uma ativa fixada com acento e aspas, uma arquivada e uma convertida em demanda (o vínculo deve voltar junto com a demanda)
  const en1 = await co('criar_entrada', { p: { titulo: 'Título "com" aspas', texto: 'Texto á $$ \\ #tag\nsegunda linha', cor: 3, fixada: true } });
  const en2 = await co('criar_entrada', { p: { texto: 'Arquivada TESTE #velha', cor: 1 } }); await co('arquivar_entrada', { p_id: en2.id });
  const en3 = await co('criar_entrada', { p: { titulo: 'Virou demanda', texto: 'Conteúdo original preservado', cor: 5 } });
  const demEn = await co('criar_demanda_de_entrada', { p_entrada: en3.id, p: { id: 'abababab-1212-4212-8212-abababababab', assunto: 'Virou demanda', descricao: 'Conteúdo original preservado' } });
  const copia = JSON.parse(JSON.stringify({ formato: 'dmanda-exportacao', versao: 3, exportado_em: new Date().toISOString(), fuso: 'America/Sao_Paulo', demandas: await co('listar_demandas', { p_arquivadas: false }), arquivadas: await co('listar_demandas', { p_arquivadas: true }), entradas: await co('listar_entradas', { p_arquivadas: false }), entradas_arquivadas: await co('listar_entradas', { p_arquivadas: true }) }));
  const original = await todas(origem, O);
  const entradasDe = async (d, u) => JSON.stringify([...(await chamarComoUsuario(d, u, 'listar_entradas', { p_arquivadas: false })), ...(await chamarComoUsuario(d, u, 'listar_entradas', { p_arquivadas: true }))].sort((a, b) => a.id.localeCompare(b.id)));
  const entradasOriginais = await entradasDe(origem, O);
  ok(copia.demandas.length === 4 && copia.arquivadas.length === 1 && copia.demandas.concat(copia.arquivadas).reduce((n, d) => n + d.tarefas.length, 0) === 5 && copia.entradas.length === 1 && copia.entradas_arquivadas.length === 2, 'restauração: a cópia fictícia tem 4 demandas ativas e 1 arquivada (5 tarefas) e 1 entrada ativa e 2 no Arquivo (arquivada e convertida)');

  // destino novo: outro projeto, com a conta de outro identificador, ainda sem dados
  const destino = await novoBanco([N, 'destino@teste']);
  ok(await tentar(destino, copia) === null && await contar(destino) === '5/5', 'restauração: a cópia entra num projeto novo (5 demandas e 5 tarefas)');
  ok(await todas(destino, N) === original, 'restauração: tudo volta igual (campos, datas, etapas, tarefas e ordem), visto pela conta nova com a RLS valendo');
  const r1 = await achar(destino, N, x1.id);
  ok(r1.tarefas.map((t) => t.texto).join('|') === TEXTOS.join('|') && r1.assunto === x1.assunto && r1.descricao === x1.descricao, 'restauração: acentos, aspas, cifrão, barra e quebra de linha chegam sem alteração');
  ok((await destino.query('select count(*)::int as n from public.demandas where user_id <> $1', [N])).rows[0].n === 0, 'restauração: tudo pertence à conta do projeto (nenhuma linha com outro dono)');
  ok(await tentar(destino, copia) === null && await contar(destino) === '5/5' && await todas(destino, N) === original && await entradasDe(destino, N) === entradasOriginais, 'restauração: rodar de novo com o mesmo arquivo não duplica nem altera nada');
  ok(await entradasDe(destino, N) === entradasOriginais && (await achar(destino, N, demEn.id)).entrada_id === en3.id, 'restauração: as entradas (ativa fixada, arquivada e convertida) voltam iguais, com acentos e aspas, e o vínculo da convertida com a sua demanda');
  ok((await destino.query('select count(*)::int as n from public.entradas where user_id <> $1', [N])).rows[0].n === 0, 'restauração: as entradas pertencem à conta do projeto');

  // o que já existe não é sobrescrito nem recebe tarefas de volta
  await chamarComoUsuario(destino, N, 'atualizar_demanda', { p_id: x1.id, p: { assunto: 'ALTERADA DEPOIS' } });
  await chamarComoUsuario(destino, N, 'excluir_tarefa', { p_id: r1.tarefas[0].id });
  await chamarComoUsuario(destino, N, 'salvar_entrada', { p_id: en1.id, p: { texto: 'ENTRADA ALTERADA DEPOIS' }, p_versao: en1.versao });
  const antes = await todas(destino, N);
  const r1b = await achar(destino, N, x1.id);
  ok(await tentar(destino, copia) === null && await todas(destino, N) === antes && r1b.assunto === 'ALTERADA DEPOIS' && r1b.tarefas.length === 2 && JSON.parse(await entradasDe(destino, N)).find((x) => x.id === en1.id).texto === 'ENTRADA ALTERADA DEPOIS', 'restauração: uma demanda ou entrada que já existe não é sobrescrita nem recebe de volta a tarefa que foi excluída');

  // perda total no mesmo projeto: apaga tudo e restaura
  await destino.exec('delete from public.entradas; delete from public.demandas');
  ok(await contar(destino) === '0/0' && await tentar(destino, copia) === null && await todas(destino, N) === original && await entradasDe(destino, N) === entradasOriginais, 'restauração: depois de perder tudo no mesmo projeto, a cópia devolve as demandas, as tarefas e as entradas idênticas');
  // cópia sem a demanda de uma entrada convertida: a anotação volta como ativa, com o conteúdo original (nada se perde, nenhum vínculo solto)
  const semDemanda = await novoBanco([N, 'destino@teste']);
  const parcial = JSON.parse(JSON.stringify(copia)); parcial.demandas = parcial.demandas.filter((x) => x.id !== demEn.id);
  ok(await tentar(semDemanda, parcial) === null && (await chamarComoUsuario(semDemanda, N, 'buscar_entrada', { p_id: en3.id })).demanda_id === null && (await chamarComoUsuario(semDemanda, N, 'buscar_entrada', { p_id: en3.id })).texto === 'Conteúdo original preservado', 'restauração: entrada convertida cuja demanda não está na cópia volta como ativa, sem vínculo solto');
  // cópia da versão 2 (antes das entradas) continua sendo aceita
  const v2 = await novoBanco([N, 'destino@teste']);
  const copiaV2 = JSON.parse(JSON.stringify(copia)); copiaV2.versao = 2; delete copiaV2.entradas; delete copiaV2.entradas_arquivadas;
  ok(await tentar(v2, copiaV2) === null && await contar(v2) === '5/5' && (await v2.query('select count(*)::int as n from public.entradas')).rows[0].n === 0, 'restauração: cópia da versão 2 (sem entradas) continua aceita');

  // cópia da versão 1 (antes dos prazos original e ajustado, dos dias e das entradas), com demanda sem prazo e com prazo: precisa restaurar, o prazo vira legado
  const v1 = await novoBanco([N, 'destino@teste']);
  const copiaV1 = JSON.parse(JSON.stringify(copia)); copiaV1.versao = 1; delete copiaV1.entradas; delete copiaV1.entradas_arquivadas; delete copiaV1.dias_indisponiveis;
  for (const x of [...copiaV1.demandas, ...copiaV1.arquivadas]) for (const k of ['prazo_original', 'prazo_ajuste', 'prazo_dias', 'prazo_base_em', 'prazo_legado', 'versao']) delete x[k];
  const comPrazoV1 = [...copiaV1.demandas, ...copiaV1.arquivadas].filter((x) => x.prazo).length, semPrazoV1 = [...copiaV1.demandas, ...copiaV1.arquivadas].filter((x) => !x.prazo).length;
  const erroV1 = await tentar(v1, copiaV1);
  ok(comPrazoV1 > 0 && semPrazoV1 > 0 && erroV1 === null && await contar(v1) === '5/5', 'restauração: cópia da versão 1 restaura com demandas com e sem prazo' + (erroV1 ? ' (' + erroV1.slice(0, 80) + ')' : ''));
  const legV1 = (await v1.query('select count(*) filter (where prazo is not null and prazo_legado and prazo_original = prazo)::int as com, count(*) filter (where prazo is null and not prazo_legado)::int as sem from public.demandas')).rows[0];
  ok(legV1.com === comPrazoV1 && legV1.sem === semPrazoV1, 'restauração: na cópia versão 1 o prazo vira a referência original marcada como legado e quem não tinha prazo continua sem prazo');

  // recusas: nada é gravado
  const vazio = await novoBanco([N, 'destino@teste']);
  ok(/não é uma cópia do Dmanda/.test(await tentar(vazio, { ...copia, formato: 'outra-coisa' })) && /não é uma cópia do Dmanda/.test(await tentar(vazio, { ...copia, versao: 6 })) && /não é uma cópia do Dmanda/.test(await tentar(vazio, '{}')) && await contar(vazio) === '0/0', 'restauração: arquivo de outro formato ou de versão desconhecida é recusado sem gravar');
  const dois = await novoBanco([N, 'destino@teste'], [O, 'origem@teste']);
  ok(/exatamente 1 usuário/.test(await tentar(dois, copia)) && await contar(dois) === '0/0', 'restauração: com mais de um usuário no projeto, nada é gravado');
  const nenhum = await novoBanco();
  ok(/exatamente 1 usuário/.test(await tentar(nenhum, copia)) && await contar(nenhum) === '0/0', 'restauração: sem nenhum usuário no projeto, nada é gravado');
  const quebrada = JSON.parse(JSON.stringify(copia)); quebrada.demandas[0].tarefas[0].texto = '   ';
  ok(await tentar(vazio, quebrada) !== null && await contar(vazio) === '0/0', 'restauração: uma tarefa inválida derruba a restauração inteira (transação única, nada fica pela metade)');
  for (const d of [origem, destino, vazio, dois, nenhum, semDemanda, v2, v1]) await d.close();
}

// cópia da versão 4 (Agenda): eventos, etapa Aguardando Prefeita e as datas de encaminhamento e reiteração voltam exatamente como estavam
{
  const SQL = readFileSync('supabase/restaurar-copia.sql', 'utf8');
  const O = '55555555-5555-4555-8555-555555555555', N = '66666666-6666-4666-8666-666666666666';
  const novo = async (id, email) => { const d = await abrirBancoTeste(); await d.query('insert into auth.users (id, email) values ($1, $2)', [id, email]); await d.query('insert into dmanda_privado.acesso_autorizado (email) values ($1) on conflict do nothing', [email]); return d; };
  const rodar = async (d, json) => { try { await d.exec(SQL.replace('__COLE_AQUI_O_JSON__', () => JSON.stringify(json))); return null; } catch (e) { return e.message || String(e); } };
  const origem = await novo(O, 'o4@teste'), co = (f, a) => chamarComoUsuario(origem, O, f, a);
  const p1 = await co('criar_demanda', { p: { assunto: 'Espera da Prefeita "á"', etapa: 'Aguardando Prefeita', prazo_original: '2026-12-03' } });
  const r1 = await co('criar_demanda', { p: { assunto: 'Retorno do setor', etapa: 'Aguardando retorno', setor: 'Obras', acompanhar_em: '2026-12-02' } });
  await co('atualizar_demanda', { p_id: r1.id, p: { encaminhada_em: '2026-11-20', reiterada_em: '2026-11-27' } });
  const e1 = await co('criar_evento', { p: { titulo: 'Reunião "á" $$ \ com acento', tipo: 'Reunião', data: '2026-12-01', inicio: '09:00', fim: '10:30', descricao: 'linha 1\nlinha 2', aviso_min: 30 } });
  const e2 = await co('criar_evento', { p: { titulo: 'Dia inteiro', tipo: 'Lembrete', data: '2026-12-02', dia_inteiro: true, aviso_min: 0 } });
  await co('salvar_evento', { p_id: e1.id, p: { fim: '11:00' }, p_versao: 1 });
  const lista = async (d, u) => JSON.stringify((await chamarComoUsuario(d, u, 'listar_eventos', {})));
  const dems = async (d, u) => JSON.stringify([...(await chamarComoUsuario(d, u, 'listar_demandas', { p_arquivadas: false }))].sort((a, b) => a.id.localeCompare(b.id)));
  const copia = JSON.parse(JSON.stringify({ formato: 'dmanda-exportacao', versao: 4, exportado_em: new Date().toISOString(), fuso: 'America/Sao_Paulo', demandas: await co('listar_demandas', { p_arquivadas: false }), arquivadas: [], dias_indisponiveis: [], entradas: [], entradas_arquivadas: [], eventos: await co('listar_eventos', {}) }));
  ok(copia.eventos.length === 2 && copia.eventos.find((x) => x.id === e1.id).versao === 2 && copia.demandas.find((x) => x.id === r1.id).reiterada_em === '2026-11-27', 'cópia v4: a exportação traz os eventos (com versão e horários HH:MM) e as datas de encaminhamento e reiteração');
  const destino = await novo(N, 'd4@teste');
  ok(await rodar(destino, copia) === null && await lista(destino, N) === await lista(origem, O) && await dems(destino, N) === await dems(origem, O), 'cópia v4: restaurar num projeto novo devolve eventos e demandas (etapa Aguardando Prefeita, encaminhamento e reiteração) exatamente iguais');
  ok(await rodar(destino, copia) === null && (await destino.query('select count(*)::int as n from public.eventos')).rows[0].n === 2, 'cópia v4: restaurar duas vezes não duplica eventos');
  await destino.exec('delete from public.eventos'); await chamarComoUsuario(destino, N, 'criar_evento', { p: { id: e1.id, titulo: 'ALTERADO DEPOIS', tipo: 'Reunião', data: '2026-12-01', inicio: '15:00' } });
  ok(await rodar(destino, copia) === null && (await chamarComoUsuario(destino, N, 'buscar_evento', { p_id: e1.id })).titulo === 'ALTERADO DEPOIS' && (await chamarComoUsuario(destino, N, 'buscar_evento', { p_id: e2.id })).titulo === 'Dia inteiro', 'cópia v4: um evento que já existe com o mesmo identificador não é sobrescrito; o que falta volta');
  const v3 = await novo(N, 'd3@teste'); const copiaV3 = JSON.parse(JSON.stringify(copia)); copiaV3.versao = 3; delete copiaV3.eventos; for (const d of copiaV3.demandas) { delete d.encaminhada_em; delete d.reiterada_em; }
  ok(await rodar(v3, copiaV3) === null && (await v3.query('select count(*)::int as n from public.eventos')).rows[0].n === 0 && (await chamarComoUsuario(v3, N, 'buscar_demanda', { p_id: r1.id })).encaminhada_em === null, 'cópia v4: cópias antigas (versão 3, sem eventos nem datas de espera) continuam sendo aceitas');
  for (const d of [origem, destino, v3]) await d.close();
  void p1;
}


// ---------- prazo original e ajustado, dias indisponíveis (migração 8) ----------
// Datas fixas de 2027 para o resultado não depender do dia em que o teste roda: 04/03 quinta, 05/03 sexta, 06/03 sábado, 07/03 domingo, 08/03 segunda.
{
  const U = 'a6666666-6666-4666-8666-666666666666', V = 'a7777777-7777-4777-8777-777777777777';
  await db.exec(`insert into auth.users (id, email) values ('${U}', 'u@teste'), ('${V}', 'v@teste')`);
  await db.exec("insert into dmanda_privado.acesso_autorizado (email) values ('u@teste'), ('v@teste')");
  const cu = (f, a) => c(U, f, a), eu = (f, a) => erro(U, f, a);
  const nova = (p) => cu('criar_demanda', { p: { assunto: 'Prazo TESTE', ...p } });
  const busca = (id) => cu('buscar_demanda', { p_id: id });
  const dia = (data, descricao, categoria = 'Feriado', id) => cu('salvar_dia_indisponivel', { p: { ...(id ? { id } : {}), data, descricao, categoria } });
  const limparDias = async () => { for (const x of await cu('listar_dias_indisponiveis', {})) await cu('excluir_dia_indisponivel', { p_id: x.id }); };
  const sqlq = async (q, p = []) => (await db.query(q, p)).rows;

  // fim de semana
  let x = await nova({ prazo_original: '2027-03-06' });
  ok(x.prazo === '2027-03-05' && x.prazo_original === '2027-03-06' && x.prazo_ajuste === '06/03 sábado' && x.prazo_dias === null && x.prazo_base_em === null && x.prazo_legado === false, 'prazo: sábado é antecipado para a sexta; o original e o motivo ficam guardados à parte');
  x = await nova({ prazo_original: '2027-03-07' });
  ok(x.prazo === '2027-03-05' && x.prazo_ajuste === '07/03 domingo; 06/03 sábado', 'prazo: domingo volta pelo sábado até a sexta, e o texto lista os dois dias');
  x = await nova({ prazo_original: '2027-03-04' });
  ok(x.prazo === '2027-03-04' && x.prazo_original === '2027-03-04' && x.prazo_ajuste === null, 'prazo: dia útil sem restrição não muda e não tem explicação');
  x = await nova({ prazo_original: '2027-03-08', prazo_tipo: 'Legal' });
  ok(x.prazo === '2027-03-08', 'prazo: segunda-feira é dia útil');

  // botões de 5, 10, 20 e 30 dias: a partir de hoje, nunca de "quando chegou"; excluem o dia inicial e incluem o último
  const hoje0 = (await sqlq('select public.hoje()::text as h'))[0].h;
  const somaHoje = async (n) => (await sqlq('select ($1::date + $2::int)::text as d', [hoje0, n]))[0].d;
  x = await nova({ prazo_dias: 10, chegou_em: '2020-01-02' });
  ok(x.prazo_original === (await somaHoje(10)) && x.prazo_dias === 10 && x.prazo_base_em === hoje0 && x.chegou_em === '2020-01-02', 'prazo: o botão de 10 dias parte de hoje (não da chegada, que era de 2020), exclui o dia inicial e guarda dias e dia de partida');
  const sem = await Promise.all([5, 10, 20, 30].map(async (n) => (await nova({ prazo_dias: n })).prazo_original));
  const esperados = await Promise.all([5, 10, 20, 30].map(somaHoje));
  ok(sem.join() === esperados.join(), 'prazo: 5, 10, 20 e 30 dias corridos somam exatamente isso a hoje');
  const cinco = await nova({ prazo_dias: 5 });
  ok(cinco.prazo !== null && cinco.prazo <= cinco.prazo_original && (await sqlq('select extract(isodow from $1::date)::int as w', [cinco.prazo]))[0].w < 6, 'prazo: o vencimento por dias também é antecipado se cair em fim de semana (nunca passa do original)');

  // repetir a chamada com o mesmo identificador não cria outra demanda
  const idFixo = '88888888-8888-4888-8888-888888888888';
  const r1 = await nova({ id: idFixo, assunto: 'Idempotente' }), r2 = await nova({ id: idFixo, assunto: 'Idempotente' });
  ok(r1.id === idFixo && r2.id === idFixo && (await cu('listar_demandas', {})).filter((y) => y.id === idFixo).length === 1, 'criar: repetir a chamada com o mesmo identificador (resposta perdida, clique duplo) devolve a mesma demanda, sem duplicar');

  // calendário: validações
  ok(/Informe a data/.test(await eu('salvar_dia_indisponivel', { p: { descricao: 'x', categoria: 'Feriado' } })) && /Descreva o dia/.test(await eu('salvar_dia_indisponivel', { p: { data: '2027-03-05', descricao: '  ', categoria: 'Feriado' } }))
    && /Escolha Feriado/.test(await eu('salvar_dia_indisponivel', { p: { data: '2027-03-05', descricao: 'x', categoria: 'Outro' } })), 'calendário: data, descrição e categoria (Feriado ou Evento externo) são exigidas');

  // incluir feriado recalcula; excluir devolve ao original
  const sab = await nova({ prazo_original: '2027-03-06' }), qui = await nova({ prazo_original: '2027-03-04' }), seg = await nova({ prazo_original: '2027-03-08' });
  const dFeriado = await dia('2027-03-05', 'Feriado de teste');
  ok(dFeriado.recalculadas >= 1 && dFeriado.dia.categoria === 'Feriado', 'calendário: cadastrar um feriado informa quantos vencimentos mudaram');
  let s = await busca(sab.id);
  ok(s.prazo === '2027-03-04' && s.prazo_original === '2027-03-06' && s.prazo_ajuste === '06/03 sábado; 05/03 feriado: Feriado de teste', 'calendário: com a sexta indisponível o vencimento recua para quinta, e o motivo lista sábado e o feriado');
  ok((await busca(qui.id)).prazo === '2027-03-04' && (await busca(seg.id)).prazo === '2027-03-08' && (await busca(qui.id)).versao === qui.versao, 'calendário: demandas que a mudança não afeta ficam intactas (nem a versão sobe)');
  await cu('excluir_dia_indisponivel', { p_id: dFeriado.dia.id });
  s = await busca(sab.id);
  ok(s.prazo === '2027-03-05' && s.prazo_ajuste === '06/03 sábado', 'calendário: excluir o feriado devolve a sexta (a data permitida mais próxima do original)');
  const fer4 = await dia('2027-03-04', 'Feriado na quinta');
  ok((await busca(qui.id)).prazo === '2027-03-03' && (await busca(qui.id)).prazo_ajuste === '04/03 feriado: Feriado na quinta', 'calendário: feriado no dia original antecipa para a quarta (dia 4 vira 3)');
  const exc = await cu('excluir_dia_indisponivel', { p_id: fer4.dia.id });
  ok(exc.recalculadas >= 1 && (await busca(qui.id)).prazo === '2027-03-04' && (await busca(qui.id)).prazo_ajuste === null, 'calendário: excluir o feriado volta o vencimento ao dia original (o dia 20 antecipado para 19 volta a 20)');

  // sequência: sábado, sexta feriado, quinta evento externo, quarta feriado
  await dia('2027-03-05', 'Feriado A'); const ev = await dia('2027-03-04', 'Congresso', 'Evento externo'); await dia('2027-03-03', 'Feriado B');
  s = await busca(sab.id);
  ok(s.prazo === '2027-03-02' && s.prazo_ajuste === '06/03 sábado; 05/03 feriado: Feriado A; 04/03 evento externo: Congresso; 03/03 feriado: Feriado B', 'prazo: antecipação em sequência (fim de semana, feriado, evento externo, feriado) até o primeiro dia disponível');
  // alterar a data de um dia recalcula nos dois sentidos
  const moveu = await dia('2027-03-10', 'Congresso', 'Evento externo', ev.dia.id);
  s = await busca(sab.id);
  ok(moveu.recalculadas >= 1 && s.prazo === '2027-03-04' && s.prazo_ajuste === '06/03 sábado; 05/03 feriado: Feriado A', 'calendário: mover o evento do dia 4 para o dia 10 libera a quinta, e o vencimento que estava no dia 2 volta para o dia 4');
  s = await busca(qui.id);
  ok(s.prazo === '2027-03-04', 'calendário: a demanda de quinta volta ao dia 4 quando o evento sai dessa data');
  await limparDias();
  ok((await busca(sab.id)).prazo === '2027-03-05' && (await busca(qui.id)).prazo === '2027-03-04', 'calendário: sem nenhum dia cadastrado, só o fim de semana ajusta (nada de feriado presumido)');

  // data manual no formulário: mesma antecipação
  s = await cu('atualizar_demanda', { p_id: seg.id, p: { prazo_original: '2027-03-07' } });
  ok(s.prazo === '2027-03-05' && s.prazo_original === '2027-03-07' && s.prazo_dias === null, 'prazo: data digitada ou escolhida no calendário também é antecipada');

  // referência da contagem: mantida enquanto a data original não muda; trocada ao escolher outra data
  const porDias = await nova({ prazo_dias: 20 });
  const mesmaData = await cu('atualizar_demanda', { p_id: porDias.id, p: { prazo_original: porDias.prazo_original, prazo_tipo: 'Legal' } });
  ok(mesmaData.prazo_dias === 20 && mesmaData.prazo_base_em === hoje0 && mesmaData.prazo_tipo === 'Legal', 'prazo: gravar de novo a mesma data original mantém os dias e o dia de partida da contagem');
  const outraData = await cu('atualizar_demanda', { p_id: porDias.id, p: { prazo_original: '2027-06-01' } });
  ok(outraData.prazo_dias === null && outraData.prazo_base_em === null && outraData.prazo_original === '2027-06-01', 'prazo: escolher outra data à mão desfaz a referência de "N dias a partir de hoje"');
  const limpo = await cu('atualizar_demanda', { p_id: porDias.id, p: { prazo_original: null } });
  ok(limpo.prazo === null && limpo.prazo_original === null && limpo.prazo_ajuste === null, 'prazo: tirar o prazo limpa vencimento, original e explicação');
  const passaDias = await cu('atualizar_demanda', { p_id: porDias.id, p: { prazo_original: null, prazo_dias: 5 } });
  ok(passaDias.prazo_dias === 5 && passaDias.prazo_base_em === hoje0 && passaDias.prazo_original === (await somaHoje(5)), 'prazo: definir 5 dias depois de não ter prazo parte de hoje');

  // compatibilidade com o aplicativo antigo: a chave "prazo" é tratada como data original; o eco do vencimento atual não muda nada
  const antiga = await nova({ prazo_original: '2027-03-06' });
  const eco = await cu('atualizar_demanda', { p_id: antiga.id, p: { assunto: 'Eco do formulário antigo', prazo: antiga.prazo } });
  ok(eco.prazo_original === '2027-03-06' && eco.prazo === '2027-03-05' && eco.assunto === 'Eco do formulário antigo', 'compatibilidade: o aplicativo antigo devolvendo o vencimento atual não destrói o prazo original');
  const nova2 = await cu('atualizar_demanda', { p_id: antiga.id, p: { prazo: '2027-04-02' } });
  ok(nova2.prazo_original === '2027-04-02' && nova2.prazo === '2027-04-02', 'compatibilidade: o aplicativo antigo mudando o prazo define a nova data original');
  const cria = await nova({ prazo: '2027-03-07' });
  ok(cria.prazo_original === '2027-03-07' && cria.prazo === '2027-03-05', 'compatibilidade: o aplicativo antigo criando com "prazo" também é ajustado');

  // finalizadas ficam como estão; reabrir usa o calendário vigente
  const fz = await nova({ prazo_original: '2027-03-04' });
  await cu('concluir_demanda', { p_id: fz.id });
  const aoFinal = await dia('2027-03-04', 'Feriado depois de finalizar');
  s = await busca(fz.id);
  ok(s.prazo === '2027-03-04' && s.prazo_ajuste === null && s.etapa === 'Finalizado', 'finalizadas: o calendário novo não mexe no vencimento de uma demanda finalizada');
  s = await cu('reabrir_demanda', { p_id: fz.id });
  ok(s.etapa === 'Fazendo' && s.prazo === '2027-03-03' && s.prazo_original === '2027-03-04' && s.prazo_ajuste === '04/03 feriado: Feriado depois de finalizar', 'reabrir: o vencimento é recalculado com o calendário de agora (original 4, ajustado 3)');
  await cu('concluir_demanda', { p_id: fz.id });
  await cu('excluir_dia_indisponivel', { p_id: aoFinal.dia.id });
  ok((await busca(fz.id)).prazo === '2027-03-03', 'finalizadas: remover a restrição também não mexe no vencimento de quem está finalizada');
  s = await cu('mover_etapa', { p_id: fz.id, p_etapa: 'Vistos' });
  ok(s.prazo === '2027-03-04' && s.prazo_ajuste === null, 'reabrir: com a restrição removida, o vencimento volta ao original');

  // sem prazo e sem chegada: nada inventado, nada recalculado
  const sp = await nova({});
  const f3 = await dia('2027-03-05', 'qualquer'); await cu('excluir_dia_indisponivel', { p_id: f3.dia.id });
  s = await busca(sp.id);
  ok(s.prazo === null && s.prazo_original === null && s.chegou_em === null && s.numero === '' && s.origem === '' && s.versao === sp.versao, 'sem prazo e sem chegada: mudar o calendário não toca a demanda (nem sobe a versão)');

  // edição simultânea: o recálculo só mexe no prazo e uma janela aberta com o prazo antigo é recusada sem sobrescrever
  const ed = await nova({ prazo_original: '2027-03-04', descricao: 'original' });
  const janela = await busca(ed.id);
  const f2 = await dia('2027-03-04', 'Feriado concorrente');
  const depoisDoRecalculo = await busca(ed.id);
  ok(depoisDoRecalculo.prazo === '2027-03-03' && depoisDoRecalculo.versao > janela.versao && depoisDoRecalculo.descricao === 'original' && depoisDoRecalculo.assunto === janela.assunto, 'concorrência: o recálculo altera só o prazo (os outros campos ficam como estavam) e sobe a versão');
  const cod = async (f, a) => { try { await cu(f, a); return null; } catch (e) { return e.code; } };
  ok(await cod('salvar_demanda', { p_id: ed.id, p: { descricao: 'da janela antiga', prazo_original: '2027-03-04' }, p_tarefas: null, p_versao: janela.versao }) === 'DM409' && (await busca(ed.id)).prazo === '2027-03-03' && (await busca(ed.id)).descricao === 'original', 'concorrência: a janela aberta antes do recálculo é recusada (DM409) e não desfaz o vencimento novo');
  await cu('excluir_dia_indisponivel', { p_id: f2.dia.id });

  // RLS: o calendário e o recálculo são de cada usuário
  const dV = await c(V, 'salvar_dia_indisponivel', { p: { data: '2027-03-05', descricao: 'do V', categoria: 'Feriado' } });
  ok((await c(U, 'listar_dias_indisponiveis', {})).length === 0 && (await c(V, 'listar_dias_indisponiveis', {})).length === 1, 'RLS: cada usuário vê só os próprios dias indisponíveis');
  ok(/não encontrado/.test(await eu('excluir_dia_indisponivel', { p_id: dV.dia.id })) && /não encontrado/.test(await eu('salvar_dia_indisponivel', { p: { id: dV.dia.id, data: '2027-03-09', descricao: 'sequestro', categoria: 'Feriado' } })) && (await c(V, 'listar_dias_indisponiveis', {}))[0].data === '2027-03-05', 'RLS: U não altera nem exclui dia de V');
  const sabU = await nova({ prazo_original: '2027-03-06' });
  ok((await busca(sabU.id)).prazo === '2027-03-05', 'RLS: o feriado de V não afeta os prazos de U');
  const anonDia = await db.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query('select public.listar_dias_indisponiveis()'); return null; } catch (e) { return e.message; } });
  ok(/permission denied/i.test(anonDia || ''), 'sem login, nenhuma função de calendário executa');

  // equivalência com src/lib/prazos.ts (a prévia do formulário usa a cópia em TypeScript): mesmas datas e mesmo texto, por 150 dias seguidos
  {
    const { ajustarPrazo, somarDias } = await import('../src/lib/prazos.ts');
    await limparDias();
    const fixos = [['2027-04-02', 'Sexta-feira Santa', 'Feriado'], ['2027-04-01', 'Reunião externa', 'Evento externo'], ['2027-04-21', 'Tiradentes', 'Feriado'], ['2027-04-20', 'Ponte', 'Feriado'], ['2027-04-20', 'Seminário', 'Evento externo'], ['2027-05-03', 'Evento', 'Evento externo'], ['2027-05-01', 'Dia do Trabalho', 'Feriado']];
    for (const [d, t, k] of fixos) await dia(d, t, k);
    const criado = new Map((await sqlq('select id::text, criado_em::text as criado_em from public.dias_indisponiveis where user_id = $1', [U])).map((y) => [y.id, y.criado_em]));
    const dias = (await cu('listar_dias_indisponiveis', {})).map((y) => ({ ...y, criado_em: criado.get(y.id) }));
    let diferentes = 0;
    for (let i = 0; i < 150; i++) {
      const orig = somarDias('2027-03-20', i);
      const a = await cu('ajustar_prazo', { p_original: orig }), b = ajustarPrazo(orig, dias);
      if (a.prazo !== b.prazo || (a.ajuste ?? null) !== b.ajuste) { diferentes++; if (diferentes < 3) console.log('  diferença em', orig, JSON.stringify(a), JSON.stringify(b)); }
    }
    ok(diferentes === 0, 'equivalência: a prévia em TypeScript e a função do banco dão o mesmo vencimento e o mesmo texto em 150 datas seguidas (com feriados e eventos, inclusive no mesmo dia)');
    await limparDias();
  }
}

// ---------- Entradas: anotações em post-its, conversão em demanda, versão e privilégios (migração 10) ----------
{
  const ec = (u, f, a) => chamarComoUsuario(db, u, f, a);
  const ee = async (u, f, a) => { try { await ec(u, f, a); return null; } catch (e) { return e; } };
  const msg = async (u, f, a) => (await ee(u, f, a))?.message ?? null;
  const U = '7e7e7e7e-7777-4777-8777-7e7e7e7e7e7e', V = '8d8d8d8d-8888-4888-8888-8d8d8d8d8d8d';
  await db.exec(`insert into auth.users (id, email) values ('${U}', 'u-ent@teste'), ('${V}', 'v-ent@teste')`);
  await db.exec("insert into dmanda_privado.acesso_autorizado (email) values ('u-ent@teste'), ('v-ent@teste')");
  const nEnt = async (u, arq) => (await ec(u, 'listar_entradas', { p_arquivadas: arq })).length;

  // criar: nenhum registro vazio, título opcional, texto opcional se houver título, espaços das pontas aparados
  ok(/Escreva um título ou o texto/.test(await msg(U, 'criar_entrada', { p: { titulo: '  ', texto: ' \n ' } })) && /Escreva um título ou o texto/.test(await msg(U, 'criar_entrada', { p: {} })) && await nEnt(U, false) === 0, 'entradas: anotação completamente vazia é recusada e nada é gravado');
  const e1 = await ec(U, 'criar_entrada', { p: { texto: '  Ligar para o RH #rh \n' } });
  const e2 = await ec(U, 'criar_entrada', { p: { titulo: ' Só título ' } });
  ok(e1.titulo === '' && e1.texto === 'Ligar para o RH #rh' && e1.fixada === false && e1.arquivada_em === null && e1.demanda_id === null && e1.versao === 1 && !('user_id' in e1) && e2.titulo === 'Só título' && e2.texto === '', 'entradas: título e texto são opcionais um sem o outro, o texto é aparado e nasce ativa, sem vínculo e na versão 1');
  ok(/passa de 20000/.test(await msg(U, 'criar_entrada', { p: { texto: 'x'.repeat(20001) } })) && /passa de 200/.test(await msg(U, 'criar_entrada', { p: { titulo: 'x'.repeat(201) } })) && /Cor inválida/.test(await msg(U, 'criar_entrada', { p: { texto: 'a', cor: 6 } })), 'entradas: limites de tamanho e cor fora de 0 a 5 são recusados');

  // cor automática (migração 11: cinco cores, 0 a 4): distribui antes de repetir e nunca sorteia a cor 5, retirada; com escolha, vale a escolha
  const n6 = [];
  for (let i = 0; i < 5; i++) n6.push(await ec(V, 'criar_entrada', { p: { texto: 'nota ' + i } }));
  ok(new Set(n6.map((x) => x.cor)).size === 5 && n6.every((x) => x.cor >= 0 && x.cor <= 4), 'entradas: sem escolha de cor, as cinco primeiras notas recebem cinco cores diferentes (0 a 4)');
  for (let i = 5; i < 40; i++) n6.push(await ec(V, 'criar_entrada', { p: { texto: 'nota ' + i } }));
  ok(n6.every((x) => x.cor >= 0 && x.cor <= 4), 'entradas: em 40 sorteios automáticos a cor 5 (retirada) nunca sai');
  const antiga = await ec(V, 'criar_entrada', { p: { texto: 'cor antiga cinco', cor: 5 } });
  const antigaFix = await ec(V, 'fixar_entrada', { p_id: antiga.id, p_fixada: true });
  const antigaSalva = await ec(V, 'salvar_entrada', { p_id: antiga.id, p: { texto: 'cor antiga cinco editada' }, p_versao: antigaFix.versao });
  const antigaArq = await ec(V, 'arquivar_entrada', { p_id: antiga.id }), antigaRec = await ec(V, 'desarquivar_entrada', { p_id: antiga.id });
  ok(antigaRec.cor === 5 && antigaSalva.cor === 5 && antigaRec.texto === 'cor antiga cinco editada' && antigaRec.criado_em === antiga.criado_em && !!antigaArq.arquivada_em, 'entradas: uma nota com a cor retirada (5) continua válida, editável, arquivável e recuperável, e o criado_em não muda');
  const n7 = await ec(V, 'criar_entrada', { p: { texto: 'sétima', cor: 4 } });
  ok(n7.cor === 4, 'entradas: a cor escolhida é respeitada');

  // idempotência pelo identificador gerado no aplicativo
  const idE = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
  const [ia, ib] = await Promise.all([ec(U, 'criar_entrada', { p: { id: idE, texto: 'Repetida', cor: 2 } }), ec(U, 'criar_entrada', { p: { id: idE, texto: 'Repetida', cor: 2 } })]);
  const ic = await ec(U, 'criar_entrada', { p: { id: idE, texto: 'Texto diferente na nova tentativa', cor: 5 } });
  ok(ia.id === idE && ib.id === idE && ic.id === idE && ic.texto === 'Repetida' && ic.cor === 2 && (await db.query('select count(*)::int as n from public.entradas where id = $1', [idE])).rows[0].n === 1, 'entradas: clique repetido, resposta perdida e nova tentativa com o mesmo identificador não duplicam');

  // isolamento por usuário e visitante sem acesso
  const eV = n6[0];
  ok(await nEnt(U, false) === 3 && await nEnt(V, false) === n6.length + 2, 'entradas: cada usuário lista só as próprias anotações');
  ok(/não encontrada/.test(await msg(U, 'buscar_entrada', { p_id: eV.id })) && /não encontrada/.test(await msg(U, 'fixar_entrada', { p_id: eV.id, p_fixada: true })) && /não encontrada/.test(await msg(U, 'arquivar_entrada', { p_id: eV.id })) && /não encontrada/.test(await msg(U, 'salvar_entrada', { p_id: eV.id, p: { texto: 'invasão' }, p_versao: 1 })), 'entradas: RLS, uma conta não lê nem altera a anotação de outra');
  const anonE = await db.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query('select public.listar_entradas()'); return null; } catch (e) { return e.message; } });
  const tabE = await db.query("select has_table_privilege('authenticated', 'public.entradas', 'select, insert, update, delete') as crud, has_table_privilege('authenticated', 'public.entradas', 'truncate') as trunc, has_table_privilege('anon', 'public.entradas', 'select') as anon_sel, has_table_privilege('service_role', 'public.entradas', 'select') as svc_sel");
  ok(/permission denied/i.test(anonE || '') && tabE.rows[0].crud && !tabE.rows[0].trunc && !tabE.rows[0].anon_sel && !tabE.rows[0].svc_sel, 'entradas: visitante e papel de serviço não tocam na tabela; o usuário logado tem só select, insert, update e delete');

  // salvar com versão, mudança parcial e sem mudança
  const s1 = await ec(U, 'salvar_entrada', { p_id: e1.id, p: { titulo: 'Escalas', texto: 'Ligar para o RH sobre as escalas #rh #fim' }, p_versao: 1 });
  ok(s1.versao === 2 && s1.titulo === 'Escalas' && s1.texto.includes('#fim') && s1.cor === e1.cor && s1.fixada === false, 'entradas: salvar com a versão certa grava e sobe a versão, sem tocar no que não foi enviado');
  const velho = await ee(U, 'salvar_entrada', { p_id: e1.id, p: { texto: 'versão velha' }, p_versao: 1 });
  const aposVelho = await ec(U, 'buscar_entrada', { p_id: e1.id });
  ok(velho?.code === 'DM409' && aposVelho.texto === s1.texto && aposVelho.versao === 2, 'entradas: salvar com versão antiga é recusado (DM409) e nada é gravado');
  const semMud = await ec(U, 'salvar_entrada', { p_id: e1.id, p: { titulo: 'Escalas', texto: s1.texto }, p_versao: 2 });
  ok(semMud.versao === 2 && semMud.atualizado_em === s1.atualizado_em, 'entradas: salvar sem mudança real não sobe a versão nem a data de atualização');
  const sCor = await ec(U, 'salvar_entrada', { p_id: e1.id, p: { cor: 5, fixada: true }, p_versao: 2 });
  ok(sCor.cor === 5 && sCor.fixada === true && sCor.versao === 3 && sCor.texto === s1.texto, 'entradas: cor e fixação entram no mesmo salvamento versionado');
  ok(/não pode ficar vazia/.test(await msg(U, 'salvar_entrada', { p_id: e1.id, p: { titulo: '', texto: '  ' }, p_versao: 3 })) && (await ec(U, 'buscar_entrada', { p_id: e1.id })).versao === 3, 'entradas: esvaziar tudo ao salvar é recusado e a anotação segue como estava');
  ok(/Versão da anotação não informada/.test(await msg(U, 'salvar_entrada', { p_id: e1.id, p: { texto: 'a' }, p_versao: null })), 'entradas: salvar exige a versão');

  // fixar, desafixar, arquivar e recuperar
  const f1 = await ec(U, 'fixar_entrada', { p_id: e2.id, p_fixada: true }), f2 = await ec(U, 'fixar_entrada', { p_id: e2.id, p_fixada: true }), f3 = await ec(U, 'fixar_entrada', { p_id: e2.id, p_fixada: false });
  ok(f1.fixada === true && f2.versao === f1.versao && f3.fixada === false, 'entradas: fixar e desafixar funcionam e repetir não faz mal');
  const ar = await ec(U, 'arquivar_entrada', { p_id: e2.id }), ar2 = await ec(U, 'arquivar_entrada', { p_id: e2.id });
  ok(ar.arquivada_em !== null && ar2.arquivada_em === ar.arquivada_em && await nEnt(U, false) === 2 && await nEnt(U, true) === 1, 'entradas: arquivar tira da lista de Entradas e põe no Arquivo (repetir mantém a data)');
  const de = await ec(U, 'desarquivar_entrada', { p_id: e2.id });
  ok(de.arquivada_em === null && de.titulo === 'Só título' && await nEnt(U, false) === 3 && await nEnt(U, true) === 0, 'entradas: recuperar devolve a anotação a Entradas com o mesmo conteúdo');
  ok(/Arquive a anotação antes/.test(await msg(U, 'excluir_entrada', { p_id: e2.id, p_confirmado: true })) && /precisa de confirmação/.test(await msg(U, 'excluir_entrada', { p_id: e2.id })), 'entradas: excluir exige arquivar antes e confirmação');
  await ec(U, 'arquivar_entrada', { p_id: e2.id });
  ok((await ec(U, 'excluir_entrada', { p_id: e2.id, p_confirmado: true })).excluida === true && /não encontrada/.test(await msg(U, 'buscar_entrada', { p_id: e2.id })), 'entradas: exclusão definitiva de anotação arquivada, com confirmação');

  // virar demanda: a demanda e o vínculo nascem juntos, a anotação sai de Entradas e fica preservada
  const orig = await ec(U, 'criar_entrada', { p: { titulo: 'Portaria', texto: 'Assinar a portaria do horário de verão #portaria\nSegunda linha', cor: 1, fixada: true } });
  const idDem = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
  const dem = await ec(U, 'criar_demanda_de_entrada', { p_entrada: orig.id, p: { id: idDem, assunto: 'Portaria', descricao: orig.texto } });
  const depois = await ec(U, 'buscar_entrada', { p_id: orig.id });
  ok(dem.id === idDem && dem.etapa === 'Cadastro' && dem.entrada_id === orig.id && dem.tarefas.length === 0 && dem.prazo === null && dem.origem === '' && dem.chegou_em === null, 'virar demanda: cria a demanda em Cadastro, ligada à anotação, sem inventar origem, chegada, prazo nem tarefas');
  ok(depois.demanda_id === idDem && depois.titulo === orig.titulo && depois.texto === orig.texto && depois.cor === orig.cor && depois.fixada === true && !(await ec(U, 'listar_entradas', { p_arquivadas: false })).some((x) => x.id === orig.id) && (await ec(U, 'listar_entradas', { p_arquivadas: true })).some((x) => x.id === orig.id), 'virar demanda: a anotação sai de Entradas, vai para o Arquivo e o conteúdo original fica intacto');
  const repetida = await ec(U, 'criar_demanda_de_entrada', { p_entrada: orig.id, p: { id: idDem, assunto: 'Portaria', descricao: orig.texto } });
  ok(repetida.id === idDem && (await db.query("select count(*)::int as n from public.demandas where assunto = 'Portaria'")).rows[0].n === 1, 'virar demanda: repetir a conversão (resposta perdida) devolve a mesma demanda, sem duplicar');
  const outra = await msg(U, 'criar_demanda_de_entrada', { p_entrada: orig.id, p: { id: 'cccccccc-3333-4333-8333-cccccccccccc', assunto: 'Outra tentativa' } });
  ok(/já virou outra demanda/.test(outra) && (await db.query("select count(*)::int as n from public.demandas where assunto = 'Outra tentativa'")).rows[0].n === 0, 'virar demanda: uma segunda conversão com outro identificador é recusada e não cria demanda');
  ok(/preservada como estava/.test(await msg(U, 'salvar_entrada', { p_id: orig.id, p: { texto: 'mudou' }, p_versao: depois.versao })) && /preservada como estava/.test(await msg(U, 'fixar_entrada', { p_id: orig.id, p_fixada: false })) && /já virou demanda/.test(await msg(U, 'arquivar_entrada', { p_id: orig.id })) && /virou demanda/.test(await msg(U, 'desarquivar_entrada', { p_id: orig.id })) && /virou demanda/.test(await msg(U, 'excluir_entrada', { p_id: orig.id, p_confirmado: true })) && (await ec(U, 'buscar_entrada', { p_id: orig.id })).texto === orig.texto, 'virar demanda: a anotação convertida não se altera, não se arquiva nem se exclui');

  // falha na criação: a anotação continua ativa e nenhuma demanda nasce
  const orig2 = await ec(U, 'criar_entrada', { p: { texto: 'Esta fica ativa se a conversão falhar' } });
  const antesDem = (await db.query('select count(*)::int as n from public.demandas')).rows[0].n;
  ok(/Informe o assunto/.test(await msg(U, 'criar_demanda_de_entrada', { p_entrada: orig2.id, p: { id: 'dddddddd-4444-4444-8444-dddddddddddd', assunto: '  ' } })) && /Identificador da demanda/.test(await msg(U, 'criar_demanda_de_entrada', { p_entrada: orig2.id, p: { assunto: 'sem id' } })), 'virar demanda: pedido inválido é recusado');
  ok((await ec(U, 'buscar_entrada', { p_id: orig2.id })).demanda_id === null && (await db.query('select count(*)::int as n from public.demandas')).rows[0].n === antesDem && (await ec(U, 'listar_entradas', { p_arquivadas: false })).some((x) => x.id === orig2.id), 'virar demanda: se a criação falha, a anotação continua ativa e nenhuma demanda sobra (mesma transação)');
  // a demanda já criada pelo passo 2 e a conversão repetida depois de recarregar continuam ligando à mesma anotação
  const dem2 = await ec(U, 'criar_demanda_de_entrada', { p_entrada: orig2.id, p: { id: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee', assunto: 'Primeira linha útil', descricao: 'resto' } });
  const dem2b = await ec(U, 'criar_demanda_de_entrada', { p_entrada: orig2.id, p: { id: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee', assunto: 'Primeira linha útil, editada', descricao: 'resto' } });
  ok(dem2b.id === dem2.id && dem2b.entrada_id === orig2.id, 'virar demanda: nova tentativa depois da criação devolve a mesma demanda, ainda ligada à anotação');

  // anotação inexistente (excluída em outro aparelho): a demanda é criada do mesmo jeito, sem vínculo
  const semNota = await ec(U, 'criar_demanda_de_entrada', { p_entrada: 'ffffffff-6666-4666-8666-ffffffffffff', p: { id: '99999999-7777-4777-8777-999999999999', assunto: 'Sem anotação' } });
  ok(semNota.etapa === 'Cadastro' && semNota.entrada_id === null, 'virar demanda: se a anotação já não existe, a demanda é criada sem vínculo (o que foi digitado não se perde)');
  // outra conta não converte anotação alheia: a RLS a esconde, então vira demanda comum de quem chamou, sem tocar na anotação de A
  const alheia = await ec(V, 'criar_demanda_de_entrada', { p_entrada: orig2.id, p: { id: '8c8c8c8c-9999-4999-8999-8c8c8c8c8c8c', assunto: 'Tentativa alheia' } });
  ok(alheia.entrada_id === null && (await ec(U, 'buscar_entrada', { p_id: orig2.id })).demanda_id === dem2.id, 'virar demanda: uma conta não liga a demanda dela à anotação de outra');

  // excluir a demanda de vez devolve a anotação a Entradas, com o conteúdo original
  await ec(U, 'excluir_demanda', { p_id: dem2.id, p_confirmado: true });
  const volta = await ec(U, 'buscar_entrada', { p_id: orig2.id });
  ok(volta.demanda_id === null && volta.texto === orig2.texto && (await ec(U, 'listar_entradas', { p_arquivadas: false })).some((x) => x.id === orig2.id), 'virar demanda: se a demanda é excluída de vez, a anotação volta para Entradas com o conteúdo original');
  const salvaDeNovo = await ec(U, 'salvar_entrada', { p_id: orig2.id, p: { texto: 'editável de novo' }, p_versao: volta.versao });
  ok(salvaDeNovo.texto === 'editável de novo', 'virar demanda: a anotação liberada volta a ser editável');
  ok((await db.query('select count(*)::int as n from public.entradas where demanda_id is not null')).rows[0].n === 1, 'entradas: uma demanda nasce de no máximo uma anotação (índice único) e só a convertida da Portaria segue ligada');
}

// ---------- Agenda: etapa Aguardando Prefeita, datas de retorno do setor e eventos (migração 14) ----------
{
  const G = '9a9a9a9a-9999-4999-8999-9a9a9a9a9a9a', H = '9b9b9b9b-9999-4999-8999-9b9b9b9b9b9b', X = '9c9c9c9c-9999-4999-8999-9c9c9c9c9c9c';
  await db.exec(`insert into auth.users (id, email) values ('${G}', 'ag@teste'), ('${H}', 'ah@teste'), ('${X}', 'ax@teste')`);
  await db.exec("insert into dmanda_privado.acesso_autorizado (email) values ('ag@teste'), ('ah@teste')");   // ax não é autorizado
  const gc = (u, f, a) => chamarComoUsuario(db, u, f, a);
  const ge = async (u, f, a) => { try { await gc(u, f, a); return null; } catch (e) { return e; } };
  const gm = async (u, f, a) => (await ge(u, f, a))?.message ?? null;

  // --- etapa Aguardando Prefeita ---
  const dp = await gc(G, 'criar_demanda', { p: { assunto: 'Aguarda a Prefeita', prazo_original: '2027-06-18', prazo_tipo: 'Legal', acompanhar_em: '2027-06-10' } });
  const desde0 = dp.etapa_desde;
  const p1 = await gc(G, 'mover_etapa', { p_id: dp.id, p_etapa: 'Aguardando Prefeita' });
  ok(p1.etapa === 'Aguardando Prefeita' && p1.etapa_desde > desde0 && p1.prazo === dp.prazo && p1.prazo_original === dp.prazo_original && p1.acompanhar_em === '2027-06-10', 'agenda: a nova etapa Aguardando Prefeita existe, registra a data de entrada (etapa_desde) e não mexe no vencimento nem em Acompanhar em');
  const p2 = await gc(G, 'atualizar_demanda', { p_id: dp.id, p: { setor: 'Gabinete', encaminhada_em: '2027-06-01', reiterada_em: '2027-06-05' } });
  ok(p2.etapa === 'Aguardando Prefeita' && p2.etapa_desde === p1.etapa_desde && p2.encaminhada_em === '2027-06-01' && p2.reiterada_em === '2027-06-05', 'agenda: reiterar (ou registrar o encaminhamento) não zera a espera nem move a demanda: etapa e data de entrada ficam iguais');
  const p3 = await gc(G, 'mover_etapa', { p_id: dp.id, p_etapa: 'Fazendo' });
  const p4 = await gc(G, 'mover_etapa', { p_id: dp.id, p_etapa: 'Aguardando Prefeita' });
  ok(p3.etapa === 'Fazendo' && p4.etapa === 'Aguardando Prefeita' && p4.etapa_desde > p3.etapa_desde && p4.etapa_desde > p1.etapa_desde, 'agenda: sair da etapa e voltar começa um novo período (nova data de entrada)');
  ok(/Etapa desconhecida/.test(await gm(G, 'mover_etapa', { p_id: dp.id, p_etapa: 'Aguardando a Prefeita' })), 'agenda: nome de etapa fora da lista é recusado');
  const fim = await gc(G, 'concluir_demanda', { p_id: dp.id });
  ok(fim.etapa === 'Finalizado' && fim.concluida_em !== null, 'agenda: demanda em Aguardando Prefeita conclui normalmente');
  const bloqueio = await db.transaction(async (tx) => { try { await entrarComo(tx, G); await tx.query("update public.demandas set etapa = 'Aguardando a Prefeita' where id = $1", [dp.id]); return null; } catch (e) { return e.message; } });
  ok(/check|constraint|violates/i.test(bloqueio || ''), 'agenda: a restrição do banco também recusa etapa fora da lista');

  // --- retorno de outro setor: datas do encaminhamento e da reiteração ---
  const dr = await gc(G, 'criar_demanda', { p: { assunto: 'Aguarda setor', etapa: 'Aguardando retorno', setor: 'Contabilidade', acompanhar_em: '2027-07-20' } });
  ok(dr.encaminhada_em === null && dr.reiterada_em === null, 'agenda: demanda nova não inventa data de encaminhamento nem de reiteração');
  const r1 = await gc(G, 'atualizar_demanda', { p_id: dr.id, p: { encaminhada_em: '2027-07-01' } });
  const r2 = await gc(G, 'atualizar_demanda', { p_id: dr.id, p: { reiterada_em: '2027-07-12' } });
  const r3 = await gc(G, 'atualizar_demanda', { p_id: dr.id, p: { assunto: 'Aguarda setor (editado)' } });
  ok(r1.encaminhada_em === '2027-07-01' && r1.reiterada_em === null && r2.encaminhada_em === '2027-07-01' && r2.reiterada_em === '2027-07-12' && r3.reiterada_em === '2027-07-12' && r3.acompanhar_em === '2027-07-20', 'agenda: cada data de espera grava sozinha; chave ausente não mexe; o campo manual Acompanhar em segue intocado');
  ok((await gm(G, 'atualizar_demanda', { p_id: dr.id, p: { encaminhada_em: '2027-02-30' } })) !== null && (await gc(G, 'buscar_demanda', { p_id: dr.id })).encaminhada_em === '2027-07-01', 'agenda: data de encaminhamento que não existe é recusada sem alterar o que estava gravado');
  const r4 = await gc(G, 'atualizar_demanda', { p_id: dr.id, p: { reiterada_em: null } });
  ok(r4.reiterada_em === null && r4.encaminhada_em === '2027-07-01', 'agenda: a reiteração pode ser limpa (null) sem tocar no encaminhamento');
  await gc(G, 'atualizar_demanda', { p_id: dr.id, p: { reiterada_em: '2027-07-12' } });
  await gc(G, 'mover_etapa', { p_id: dr.id, p_etapa: 'Fazendo' });
  const r5 = await gc(G, 'mover_etapa', { p_id: dr.id, p_etapa: 'Aguardando retorno' });
  ok(r5.encaminhada_em === null && r5.reiterada_em === null && r5.acompanhar_em === '2027-07-20' && r5.setor === 'Contabilidade', 'agenda: voltar a Aguardando retorno começa novo período sem as datas do anterior, mas preserva setor e Acompanhar em');
  const r6 = await gc(G, 'atualizar_demanda', { p_id: dr.id, p: { encaminhada_em: '2027-07-30' } });
  const r7 = await gc(G, 'mover_etapa', { p_id: dr.id, p_etapa: 'Aguardando Prefeita' });
  ok(r6.encaminhada_em === '2027-07-30' && r7.encaminhada_em === '2027-07-30', 'agenda: ir para outra etapa de espera não apaga as datas já registradas');

  // --- eventos ---
  const E1 = 'e1e1e1e1-1111-4111-8111-e1e1e1e1e1e1', E2 = 'e2e2e2e2-2222-4222-8222-e2e2e2e2e2e2';
  const base = { id: E1, titulo: ' Reunião de secretariado ', tipo: 'Reunião', data: '2027-03-09', inicio: '09:00', fim: '10:30', aviso_min: 15, descricao: ' pauta ' };
  const e1 = await gc(G, 'criar_evento', { p: base });
  ok(e1.id === E1 && e1.titulo === 'Reunião de secretariado' && e1.tipo === 'Reunião' && e1.data === '2027-03-09' && e1.dia_inteiro === false && e1.inicio === '09:00' && e1.fim === '10:30' && e1.aviso_min === 15 && e1.descricao === 'pauta' && e1.versao === 1 && !('user_id' in e1), 'eventos: criação grava os campos, apara os textos, devolve horário HH:MM, data sem deslocamento e versão 1');
  const e1b = await gc(G, 'criar_evento', { p: { ...base, titulo: 'Outro título' } });
  const todos = await gc(G, 'listar_eventos', {});
  ok(e1b.titulo === 'Reunião de secretariado' && todos.filter((x) => x.id === E1).length === 1, 'eventos: repetir a criação com o mesmo identificador (resposta perdida, clique repetido) devolve o evento existente e não duplica');
  const noite = await gc(G, 'criar_evento', { p: { titulo: 'Plantão', tipo: 'Compromisso', data: '2027-03-09', inicio: '23:30', fim: null, aviso_min: null } });
  ok(noite.data === '2027-03-09' && noite.inicio === '23:30' && noite.fim === null && noite.aviso_min === null, 'eventos: às 23h30 a data continua a do calendário (nada desloca por UTC) e término e aviso são opcionais');
  const di = await gc(G, 'criar_evento', { p: { id: E2, titulo: 'Dia do servidor', tipo: 'Lembrete', data: '2027-10-28', dia_inteiro: true, aviso_min: 0 } });
  ok(di.dia_inteiro === true && di.inicio === null && di.fim === null && di.aviso_min === 0, 'eventos: dia inteiro sem horário, com aviso no dia');
  ok(/título/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, titulo: '  ' } })) && /tipo/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, tipo: 'Festa' } })) && /dia inteiro não tem horário/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, dia_inteiro: true } })), 'eventos: título vazio, tipo desconhecido e dia inteiro com horário são recusados');
  ok(/depois do início/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, fim: '08:00' } })) && /depois do início/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, fim: '09:00' } })) && /início/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, inicio: '25:00' } })) && /início/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, inicio: null } })) && /Aviso inválido/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, aviso_min: 7 } })) && /data/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, data: null } })), 'eventos: término igual ou antes do início, hora inexistente, início ausente, aviso fora das opções e data ausente são recusados');
  ok(/200/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, titulo: 'x'.repeat(201) } })) && /5000/.test(await gm(G, 'criar_evento', { p: { ...base, id: undefined, descricao: 'x'.repeat(5001) } })), 'eventos: título e descrição têm limite');
  const bloq2 = await db.transaction(async (tx) => { try { await entrarComo(tx, G); await tx.query("insert into public.eventos (titulo, tipo, data, inicio, fim) values ('x', 'Reunião', '2027-01-01', '10:00', '09:00')"); return null; } catch (e) { return e.message; } });
  ok(/check|constraint|violates/i.test(bloq2 || ''), 'eventos: a restrição do banco também recusa término antes do início');

  const s1 = await gc(G, 'salvar_evento', { p_id: E1, p: { titulo: 'Reunião com o Gabinete', fim: '11:00' }, p_versao: 1 });
  ok(s1.titulo === 'Reunião com o Gabinete' && s1.fim === '11:00' && s1.inicio === '09:00' && s1.versao === 2 && s1.tipo === 'Reunião', 'eventos: salvar altera só os campos enviados e sobe a versão');
  const s1b = await gc(G, 'salvar_evento', { p_id: E1, p: { titulo: 'Reunião com o Gabinete', fim: '11:00' }, p_versao: 2 });
  ok(s1b.versao === 2, 'eventos: salvar sem mudança real não sobe a versão');
  const velho = await ge(G, 'salvar_evento', { p_id: E1, p: { titulo: 'Perdida' }, p_versao: 1 });
  ok(velho && velho.code === 'DM409' && /outro aparelho/.test(velho.message) && (await gc(G, 'buscar_evento', { p_id: E1 })).titulo === 'Reunião com o Gabinete', 'eventos: salvar com versão antiga é recusado (DM409) e não sobrescreve o que outro aparelho gravou');
  ok(/Versão do evento/.test(await gm(G, 'salvar_evento', { p_id: E1, p: { titulo: 'x' }, p_versao: null })) && /depois do início/.test(await gm(G, 'salvar_evento', { p_id: E1, p: { fim: '08:00' }, p_versao: 2 })) && /Evento não encontrado/.test(await gm(G, 'salvar_evento', { p_id: 'e9e9e9e9-9999-4999-8999-e9e9e9e9e9e9', p: { titulo: 'x' }, p_versao: 1 })), 'eventos: versão ausente, término antes do início (resultado final) e evento inexistente são recusados');
  const s2 = await gc(G, 'salvar_evento', { p_id: E1, p: { dia_inteiro: true, inicio: null, fim: null, aviso_min: 0 }, p_versao: 2 });
  ok(s2.dia_inteiro === true && s2.inicio === null && s2.aviso_min === 0 && s2.versao === 3 && /dia inteiro não tem horário/.test(await gm(G, 'salvar_evento', { p_id: E1, p: { dia_inteiro: true, inicio: '08:00' }, p_versao: 3 })), 'eventos: transformar em dia inteiro limpa o horário; dia inteiro com horário continua recusado');
  const s3 = await gc(G, 'salvar_evento', { p_id: E1, p: { dia_inteiro: false, inicio: '14:00', fim: null, aviso_min: 30 }, p_versao: 3 });
  ok(s3.dia_inteiro === false && s3.inicio === '14:00' && s3.fim === null && s3.aviso_min === 30, 'eventos: voltar a evento com horário');

  const lista = await gc(G, 'listar_eventos', {});
  ok(lista.map((x) => x.id).join() === [E1, noite.id, E2].join(), 'eventos: a lista traz os eventos do usuário em ordem de data e horário');
  ok((await gc(H, 'listar_eventos', {})).length === 0 && /não encontrado/.test(await gm(H, 'buscar_evento', { p_id: E1 })) && /não encontrado/.test(await gm(H, 'salvar_evento', { p_id: E1, p: { titulo: 'invasão' }, p_versao: 4 })), 'eventos: RLS isola os eventos entre usuários');
  await gc(H, 'excluir_evento', { p_id: E1, p_confirmado: true });
  ok((await gc(G, 'buscar_evento', { p_id: E1 })).id === E1, 'eventos: um usuário não exclui evento de outro (a exclusão não encontra a linha)');
  const naoAut = await db.transaction(async (tx) => { await entrarComo(tx, X); try { return (await tx.query('select count(*)::int as n from public.eventos')).rows[0].n; } catch (e) { return e.message; } });
  ok(naoAut === 0, 'eventos: conta não autorizada (fora da lista) não lê nenhum evento');
  const naoAut2 = await db.transaction(async (tx) => { await entrarComo(tx, X); try { await tx.query("insert into public.eventos (user_id, titulo, tipo, data, inicio) values ($1, 'x', 'Reunião', '2027-01-01', '10:00')", [X]); return null; } catch (e) { return e.message; } });
  ok(/row-level|policy/i.test(naoAut2 || ''), 'eventos: conta não autorizada não grava evento (RLS com conta autorizada)');
  const anon2 = await db.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query('select public.listar_eventos()'); return null; } catch (e) { return e.message; } });
  ok(/permission denied/i.test(anon2 || ''), 'eventos: sem login (papel anon) não executa as funções de eventos');

  ok(/confirmação/.test(await gm(G, 'excluir_evento', { p_id: E2 })) && /confirmação/.test(await gm(G, 'excluir_evento', { p_id: E2, p_confirmado: false })) && (await gc(G, 'buscar_evento', { p_id: E2 })).id === E2, 'eventos: excluir sem confirmação é recusado e o evento fica');
  const ex = await gc(G, 'excluir_evento', { p_id: E2, p_confirmado: true });
  const ex2 = await gc(G, 'excluir_evento', { p_id: E2, p_confirmado: true });
  ok(ex.excluido === true && ex2.excluido === true && /não encontrado/.test(await gm(G, 'buscar_evento', { p_id: E2 })) && (await gc(G, 'listar_eventos', {})).every((x) => x.id !== E2), 'eventos: excluir com confirmação remove; repetir depois de resposta perdida não é erro');
  const privs = await db.query("select has_function_privilege('authenticated', 'public.criar_evento(jsonb)', 'execute') as a, has_function_privilege('anon', 'public.criar_evento(jsonb)', 'execute') as n, has_table_privilege('anon', 'public.eventos', 'select') as t");
  ok(privs.rows[0].a === true && privs.rows[0].n === false && privs.rows[0].t === false, 'eventos: privilégios mínimos (só o usuário logado executa; anon não lê a tabela)');
}

// ---------- alinhamento da rotina diária às regras da Agenda (migração 15) ----------
{
  const T = '9d9d9d9d-9999-4999-8999-9d9d9d9d9d9d';
  await db.exec(`insert into auth.users (id, email) values ('${T}', 'at@teste')`);
  await db.exec("insert into dmanda_privado.acesso_autorizado (email) values ('at@teste')");
  const tc = (f, a) => chamarComoUsuario(db, T, f, a);
  const resumo = async (data) => (await db.query('select public.calcular_resumo($1, $2::date) as r', [T, data])).rows[0].r;
  const retorno = async (enc, rei, desde) => (await db.query('select public.retorno_setor_data($1, $2::date, $3::date, $4::timestamptz)::text as d', [T, enc, rei, desde])).rows[0].d;
  const agora = '2026-11-02T15:00:00Z';
  ok(await retorno('2026-11-02', null, agora) === '2026-11-12', 'rotina 15: o retorno do setor é 10 dias corridos depois do encaminhamento');
  ok(await retorno('2026-11-05', null, agora) === '2026-11-13', 'rotina 15: se o décimo dia é domingo, antecipa para a sexta anterior');
  ok(await retorno('2026-11-02', '2026-11-04', agora) === '2026-11-13' && await retorno('2026-11-02', '2026-11-01', agora) === '2026-11-12', 'rotina 15: vale a mais recente entre encaminhamento e reiteração');
  ok(await retorno(null, null, '2026-11-03T01:30:00Z') === '2026-11-12' && await retorno(null, null, '2026-11-03T04:00:00Z') === '2026-11-13', 'rotina 15: sem as datas, conta do dia em que entrou na etapa, pelo calendário de Brasília');

  // a data do encaminhamento é registrada no Andamento (atualizar_demanda); no cadastro a demanda nasce sem ela
  const comEnc = async (p, enc = '2026-11-02') => { const d = await tc('criar_demanda', { p }); return tc('atualizar_demanda', { p_id: d.id, p: { encaminhada_em: enc } }); };
  const ret = await comEnc({ assunto: 'Retorno do setor', etapa: 'Aguardando retorno', setor: 'Contabilidade' });
  const pref = await tc('criar_demanda', { p: { assunto: 'Na Prefeita', etapa: 'Aguardando Prefeita' } });
  await db.query("update public.demandas set etapa_desde = '2026-11-02T15:00:00Z' where id = $1", [pref.id]);
  const r11 = await resumo('2026-11-11'), r12 = await resumo('2026-11-12'), r13 = await resumo('2026-11-13');
  ok(r11.sete_dias === 1 && r11.hoje === 0 && r11.atrasadas === 0, 'rotina 15: faltando 1 dia para o retorno do setor, ele aparece em até 7 dias');
  ok(r12.hoje === 1 && r12.sete_dias === 0 && r13.atrasadas === 1 && r13.hoje === 0, 'rotina 15: no dia do retorno entra em hoje e depois dele em atrasadas');
  ok(r13.prazo_vencido === 0 && r13.aguardando_retorno === 1, 'rotina 15: o retorno do setor não é vencimento nem altera o prazo (prazo_vencido continua só o prazo)');
  const ant = await resumo('2026-11-03');
  ok(ant.sete_dias === 0 && ant.hoje === 0 && ant.atrasadas === 0, 'rotina 15: com o retorno ainda longe a demanda não entra nos grupos (sem corte antigo)');
  ok(r12.aguardando_prefeita === 1 && r12.espera_prefeita_alerta === 0 && r13.espera_prefeita_alerta === 1, 'rotina 15: Aguardando Prefeita há 10 dias não gera alerta e no 11º dia gera');
  ok(r13.atrasadas === 1 && (await resumo('2026-12-30')).prazo_vencido === 0, 'rotina 15: a espera pela Prefeita nunca vira atrasada nem prazo vencido, por mais dias que passem (só o retorno do setor conta)');
  await comEnc({ assunto: 'Acompanhar antes', etapa: 'Aguardando retorno', acompanhar_em: '2026-11-05' });
  ok((await resumo('2026-11-05')).hoje === 1 && (await resumo('2026-11-06')).atrasadas === 1, 'rotina 15: "Acompanhar em" mais próximo vale no seu dia e depois dele (o retorno do setor segue separado, em 12/11)');
  const pz = await comEnc({ assunto: 'Prazo antes', etapa: 'Aguardando retorno', prazo_original: '2026-11-09' });
  ok(pz.prazo === '2026-11-09' && (await resumo('2026-11-09')).hoje === 1 && (await tc('buscar_demanda', { p_id: pz.id })).acompanhar_em === null, 'rotina 15: o vencimento mais próximo vale e permanece separado dos demais valores');
  await tc('salvar_dia_indisponivel', { p: { data: '2026-11-12', descricao: 'Ponto facultativo de teste', categoria: 'Feriado' } });
  ok(await retorno('2026-11-02', null, agora) === '2026-11-11', 'rotina 15: o retorno do setor antecipa também sobre dia indisponível do usuário');
  // o gatilho recalcula o resumo de hoje quando as datas de retorno mudam
  const antes = (await db.query('select calculado_em::text as c from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [T])).rows[0].c;
  await db.query('select pg_sleep(0.01)');
  await tc('atualizar_demanda', { p_id: ret.id, p: { reiterada_em: '2026-11-04' } });
  const depois = (await db.query('select calculado_em::text as c from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [T])).rows[0].c;
  ok(depois > antes, 'rotina 15: reiterar o retorno recalcula o resumo de hoje (o gatilho ouve as duas datas novas)');
  // fuso horário (decisão 51): o fuso da sessão do banco não muda "hoje", o retorno do setor nem a espera pela Prefeita; a virada do dia é a de São Paulo
  const fusos = {};
  for (const tz of ['UTC', 'America/Sao_Paulo', 'Pacific/Auckland', 'Asia/Tokyo', 'America/Los_Angeles']) {
    fusos[tz] = await db.transaction(async (tx) => {
      await tx.exec(`set local time zone '${tz}'`);
      const q = async (sqlTexto, p = []) => (await tx.query(sqlTexto, p)).rows[0];
      const h = (await q('select public.hoje()::text as v')).v;
      const ret = (await q("select public.retorno_setor_data($1, null, null, '2026-11-03T02:30:00Z'::timestamptz)::text as v", [T])).v;
      const ret2 = (await q("select public.retorno_setor_data($1, null, null, '2026-11-03T03:00:00Z'::timestamptz)::text as v", [T])).v;
      const r = (await q('select public.calcular_resumo($1, $2::date) as v', [T, '2026-11-13'])).v;
      const instante = (await q("select to_char('2026-11-03T02:30:00Z'::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as v")).v;
      return JSON.stringify([h, ret, ret2, r.espera_prefeita_alerta, instante]);
    });
  }
  ok(new Set(Object.values(fusos)).size === 1 && JSON.parse(fusos['UTC'])[1] === '2026-11-11' && JSON.parse(fusos['UTC'])[2] === '2026-11-13' && JSON.parse(fusos['UTC'])[4] === '02/11/2026 23:30', 'fuso 15: com a sessão do banco em UTC, São Paulo, Auckland, Tóquio ou Los Angeles o resultado é o mesmo; 02h30 UTC de 03/11 conta como 02/11 (retorno em 12/11, antecipado para 11/11 pelo dia indisponível) e 03h00 UTC como 03/11');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(JSON.parse(fusos['Asia/Tokyo'])[0]) && JSON.parse(fusos['Asia/Tokyo'])[0] === (await sql("select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as h"))[0].h, 'fuso 15: public.hoje() é sempre o dia de São Paulo, mesmo com a sessão em Tóquio');
  ok(/permission denied/i.test(await erro(T, 'retorno_setor_data', { p_user: T, p_encaminhada: '2026-11-02', p_reiterada: null, p_etapa_desde: agora })), 'rotina 15: a função interna do retorno não é chamável por usuário logado');
}

// ---------- Perfil: registros diários de humor (migrações 16 e 19: a energia foi retirada) ----------
{
  const P = '9e9e9e9e-9999-4999-8999-9e9e9e9e9e9e', Q = '9f9f9f9f-9999-4999-8999-9f9f9f9f9f9f', R = 'a0a0a0a0-9999-4999-8999-a0a0a0a0a0a0';
  await db.exec(`insert into auth.users (id, email) values ('${P}', 'pp@teste'), ('${Q}', 'pq@teste'), ('${R}', 'pr@teste')`);
  await db.exec("insert into dmanda_privado.acesso_autorizado (email) values ('pp@teste'), ('pq@teste')");   // pr não é autorizado
  const pc = (u, f, a) => chamarComoUsuario(db, u, f, a);
  const pm = async (u, f, a) => { try { await pc(u, f, a); return null; } catch (e) { return e.message; } };
  const hoje = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const dia = (n) => { const [a, m, d] = hoje.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
  const linhas = async (u) => (await db.query('select count(*)::int as n from public.registros_dia where user_id = $1', [u])).rows[0].n;

  const r1 = await pc(P, 'registrar_dias', { p: [{ dia: hoje, humor: 4 }] });
  ok(r1.length === 1 && r1[0].dia === hoje && r1[0].humor === 4 && Object.keys(r1[0]).sort().join() === 'dia,humor', 'perfil: registrar hoje grava só o humor e devolve o dia e o humor');
  const r2 = await pc(P, 'registrar_dias', { p: [{ dia: hoje, humor: 5 }] });
  const l2 = await pc(P, 'listar_registros_dia', {});
  ok(r2[0].humor === 5 && l2.length === 1 && l2[0].humor === 5 && await linhas(P) === 1, 'perfil: gravar de novo no mesmo dia substitui o registro (só o último vale) e continua uma única linha');
  await pc(P, 'registrar_dias', { p: [{ dia: hoje, humor: 5 }] }); await pc(P, 'registrar_dias', { p: [{ dia: hoje, humor: 5 }] });
  ok(await linhas(P) === 1, 'perfil: repetir a mesma gravação (clique duplo, resposta perdida, duas abas) nunca duplica o dia');
  const par = await Promise.all([pc(P, 'registrar_dias', { p: [{ dia: hoje, humor: 1 }] }), pc(P, 'registrar_dias', { p: [{ dia: hoje, humor: 2 }] })]);
  ok(par.length === 2 && await linhas(P) === 1, 'perfil: duas gravações simultâneas do mesmo dia deixam uma só linha');

  // janela de correção: hoje e os 5 dias anteriores
  const lote = await pc(P, 'registrar_dias', { p: [{ dia: dia(-5), humor: 3 }, { dia: dia(-3), humor: 2 }, { dia: dia(-1), humor: 1 }] });
  ok(lote.map((x) => x.dia).join() === [dia(-5), dia(-3), dia(-1)].join() && await linhas(P) === 4, 'perfil: vários dias de uma vez (até 5 dias atrás) são gravados juntos, em ordem de data');
  ok(/5 dias/.test(await pm(P, 'registrar_dias', { p: [{ dia: dia(-6), humor: 3 }] })) && /ainda não chegou/.test(await pm(P, 'registrar_dias', { p: [{ dia: dia(1), humor: 3 }] })), 'perfil: o sexto dia anterior e o dia futuro são recusados no banco');
  // tudo ou nada
  const antes = JSON.stringify(await pc(P, 'listar_registros_dia', {}));
  const msgLote = await pm(P, 'registrar_dias', { p: [{ dia: dia(-2), humor: 3 }, { dia: dia(-4), humor: 9 }] });
  ok(msgLote !== null && JSON.stringify(await pc(P, 'listar_registros_dia', {})) === antes, 'perfil: se um item do lote é inválido, nenhum é gravado (tudo ou nada)');
  // validação e privacidade das mensagens
  const invalidos = [{ dia: hoje, humor: 0 }, { dia: hoje, humor: 6 }, { dia: hoje, humor: 'a' }, { dia: hoje }, { dia: hoje, humor: null }, { dia: hoje, humor: 3.5 }, { dia: 'ontem', humor: 3 }, { dia: '2026-02-30', humor: 3 }, { humor: 3 }];
  let recusados = 0; for (const x of invalidos) if (await pm(P, 'registrar_dias', { p: [x] }) !== null) recusados++;
  ok(recusados === invalidos.length && await linhas(P) === 4, 'perfil: humor fora de 1 a 5, ausente, não inteiro e dia inválido são recusados sem gravar nada');
  ok(await pm(P, 'registrar_dias', { p: [] }) !== null && await pm(P, 'registrar_dias', { p: null }) !== null && await pm(P, 'registrar_dias', { p: { dia: hoje } }) !== null && await pm(P, 'registrar_dias', { p: Array.from({ length: 7 }, (_, i) => ({ dia: dia(-i), humor: 3 })) }) !== null, 'perfil: lista vazia, nula, fora do formato ou com mais de 6 dias é recusada');
  ok(/repetid|mais de uma vez/.test(await pm(P, 'registrar_dias', { p: [{ dia: hoje, humor: 3 }, { dia: hoje, humor: 4 }] })), 'perfil: o mesmo dia duas vezes no mesmo lote é recusado');
  const msgs = [await pm(P, 'registrar_dias', { p: [{ dia: hoje, humor: 7 }] }), await pm(P, 'registrar_dias', { p: [{ dia: dia(-9), humor: 4 }] })].join(' ');
  ok(!/[78]/.test(msgs) && !msgs.includes(dia(-9)), 'perfil: as mensagens de erro nunca repetem os valores nem a data informada (nada de humor em log)');
  const restr = await db.transaction(async (tx) => { try { await entrarComo(tx, P); await tx.query('update public.registros_dia set humor = 9 where dia = $1', [hoje]); return null; } catch (e) { return e.message; } });
  ok(/check|constraint|violates/i.test(restr || ''), 'perfil: a restrição da tabela também recusa humor fora de 1 a 5');
  const semAcertoDir = await db.transaction(async (tx) => { try { await entrarComo(tx, P); await tx.query('delete from public.registros_dia'); return null; } catch (e) { return e.message; } });
  ok(/permission denied/i.test(semAcertoDir || ''), 'perfil: o usuário não apaga registros direto na tabela (só substitui pelo caminho validado)');

  // listagem e janela do histórico
  const so1 = await pc(P, 'listar_registros_dia', { p_dias: 1 });
  ok(so1.every((x) => x.dia >= dia(-1)) && so1.length === 2, 'perfil: a listagem respeita o número de dias pedido (hoje e ontem)');
  const antigo = await db.query("insert into public.registros_dia (user_id, dia, humor) values ($1, $2, 3) returning dia::text", [P, dia(-40)]);
  const l62 = await pc(P, 'listar_registros_dia', {});
  ok(antigo.rows.length === 1 && l62.some((x) => x.dia === dia(-40)) && l62.map((x) => x.dia).join() === [...l62.map((x) => x.dia)].sort().join() && (await pc(P, 'listar_registros_dia', { p_dias: 30 })).every((x) => x.dia >= dia(-30)), 'perfil: a listagem sai em ordem de data e o padrão de 62 dias alcança o histórico do mês');
  ok(Object.keys(l62[0]).sort().join() === 'dia,humor', 'perfil: a leitura devolve só dia e humor (nem identificador do usuário nem carimbos)');

  // isolamento e acesso
  ok((await pc(Q, 'listar_registros_dia', {})).length === 0, 'perfil: outro usuário autorizado não vê os registros');
  const q1 = await pc(Q, 'registrar_dias', { p: [{ dia: hoje, humor: 1 }] });
  ok(q1[0].humor === 1 && (await pc(P, 'listar_registros_dia', {})).find((x) => x.dia === hoje).humor !== 1 && await linhas(Q) === 1, 'perfil: o mesmo dia de outro usuário é outra linha e não mexe nos registros do primeiro');
  const naoAut = await db.transaction(async (tx) => { await entrarComo(tx, R); try { return (await tx.query('select count(*)::int as n from public.registros_dia')).rows[0].n; } catch (e) { return e.message; } });
  ok(naoAut === 0, 'perfil: conta não autorizada (fora da lista) não lê registro nenhum');
  ok((await pc(R, 'listar_registros_dia', {})).length === 0 && /row-level|policy/i.test(await pm(R, 'registrar_dias', { p: [{ dia: hoje, humor: 3 }] }) || ''), 'perfil: conta não autorizada não grava (RLS com conta autorizada) e a listagem vem vazia');
  const anonP = await db.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query('select public.listar_registros_dia()'); return null; } catch (e) { return e.message; } });
  const anonG = await db.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query("select public.registrar_dias('[]'::jsonb)"); return null; } catch (e) { return e.message; } });
  const anonT = await db.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query('select count(*) from public.registros_dia'); return null; } catch (e) { return e.message; } });
  ok(/permission denied/i.test(anonP || '') && /permission denied/i.test(anonG || '') && /permission denied/i.test(anonT || ''), 'perfil: sem login (papel anon) não executa as funções nem lê a tabela');
  // produtividade não tem tabela própria: vem de concluida_em
  const dq = await pc(Q, 'criar_demanda', { p: { assunto: 'Produtividade derivada' } });
  const fq = await pc(Q, 'concluir_demanda', { p_id: dq.id });
  ok(fq.concluida_em === hoje, 'perfil: a data de conclusão (fonte da produtividade) é o dia de hoje em São Paulo ao concluir');
  const rq = await pc(Q, 'reabrir_demanda', { p_id: dq.id });
  const fq2 = await pc(Q, 'concluir_demanda', { p_id: dq.id });
  ok(rq.concluida_em === null && fq2.concluida_em === hoje, 'perfil: reabrir limpa a data de conclusão e concluir de novo grava a nova (o histórico guarda só a última conclusão)');
  // a rotina diária e os resumos não carregam o humor
  const fonte = (await db.query("select string_agg(pg_get_functiondef(p.oid), ' ') as s from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and p.proname not in ('registrar_dias','listar_registros_dia')")).rows[0].s;
  ok(!/registros_dia/.test(fonte), 'perfil: nenhuma outra função do banco (rotina diária, resumos, buscas, exportação) lê os registros de humor');
}

// ---------- migração sobre dados antigos: nada se perde ----------
{
  const { mkdtempSync, copyFileSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig-'));
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const nova8 = todas.find((f) => f.includes('prazos_e_dias_indisponiveis'));
  const nova9 = todas.find((f) => f.includes('normalizar_prazos_legados'));
  const nova10 = todas.find((f) => f.endsWith('_entradas.sql')), nova11 = todas.find((f) => f.includes('entradas_cinco_cores')), nova12 = todas.find((f) => f.includes('rls_conta_autorizada_entradas_dias')), nova15 = todas.find((f) => f.includes('alinha_regras_agenda')), nova14 = todas.find((f) => f.endsWith('_agenda.sql'));
  const nova20 = todas.find((f) => f.includes('origem_documento_para_hoje'));   // depende da migração 8: entra depois dela, não no banco antigo
  const nova22 = todas.find((f) => f.includes('para_hoje_quatro_vagas'));   // depende da 20 (tabela para_hoje): entra depois dela
  const nova24 = todas.find((f) => f.includes('transicoes_demanda'));   // a prova dela tem o próprio bloco: fora do banco antigo
  const nova23 = todas.find((f) => f.includes('evento_externo_e_pagamentos'));   // depende da 14 (tabela eventos): fora do banco antigo
  const nova21 = todas.find((f) => f.includes('prazo_base_do_atalho'));   // também depende da migração 8 (ajustar_prazo): entra depois dela
  for (const f of todas.filter((f) => f !== nova20 && f !== nova21 && f !== nova22 && f !== nova23 && f !== nova24 && f !== nova8 && f !== nova9 && f !== nova10 && f !== nova11 && f !== nova12 && f !== nova14 && f !== nova15)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
  const antigo = await abrirBancoTeste({ raizMigracoes: pasta });
  const W = 'a9999999-9999-4999-8999-999999999999';
  await antigo.exec(`insert into auth.users (id, email) values ('${W}', 'w@teste')`);
  await antigo.exec("insert into dmanda_privado.acesso_autorizado (email) values ('w@teste')");
  const cw = (f, a) => chamarComoUsuario(antigo, W, f, a);
  const comPrazo = await cw('criar_demanda', { p: { assunto: 'Antiga com prazo', prazo: '2027-03-06', numero: '10/2026', origem: 'Câmara', chegou_em: '2026-09-01' } }); // sábado: no sistema antigo o prazo era gravado como veio
  const semPrazo = await cw('criar_demanda', { p: { assunto: 'Antiga sem prazo' } });
  await cw('adicionar_tarefa', { p_demanda: comPrazo.id, p_texto: 'Tarefa antiga' });
  // cenários da migração 9 (prazos legados abertos): feriado do próprio usuário, calendário de outro usuário, dia útil e demanda finalizada
  const Z = 'a8888888-8888-4888-8888-888888888888';
  await antigo.exec(`insert into auth.users (id, email) values ('${Z}', 'z@teste')`);
  await antigo.exec("insert into dmanda_privado.acesso_autorizado (email) values ('z@teste')");
  const cz = (f, a) => chamarComoUsuario(antigo, Z, f, a);
  const legFeriado = await cw('criar_demanda', { p: { assunto: 'Antiga em feriado', prazo: '2027-03-12' } });
  const legUtil = await cw('criar_demanda', { p: { assunto: 'Antiga em dia útil', prazo: '2027-03-10' } });
  const legFinal = await cw('criar_demanda', { p: { assunto: 'Antiga finalizada no sábado', prazo: '2027-03-06' } });
  await cw('mover_etapa', { p_id: legFinal.id, p_etapa: 'Finalizado' });
  const legOutro = await cz('criar_demanda', { p: { assunto: 'Antiga de outro usuário', prazo: '2027-03-12' } });
  const antes = (await antigo.query('select id, assunto, numero, origem, chegou_em::text, prazo::text, etapa, versao, atualizado_em::text, criado_em::text from public.demandas order by id')).rows;
  const tarefasAntes = (await antigo.query('select id, texto, concluida, posicao from public.tarefas order by id')).rows;
  await antigo.exec(readFileSync(join('supabase/migrations', nova8), 'utf8'));
  const depois = (await antigo.query('select id, assunto, numero, origem, chegou_em::text, prazo::text, etapa, versao, atualizado_em::text, criado_em::text, prazo_original::text, prazo_legado, prazo_dias, prazo_base_em, prazo_ajuste from public.demandas order by id')).rows;
  const semNovas = depois.map((linha) => Object.fromEntries(Object.entries(linha).filter(([k]) => !['prazo_original', 'prazo_legado', 'prazo_dias', 'prazo_base_em', 'prazo_ajuste'].includes(k))));
  ok(JSON.stringify(semNovas) === JSON.stringify(antes), 'migração 8 sobre dados existentes: identificadores, textos, "s/n" e "Não informada", datas, etapa, versão e datas de criação e de atualização ficam idênticos');
  const dp = depois.find((y) => y.id === comPrazo.id), ds = depois.find((y) => y.id === semPrazo.id);
  ok(dp.prazo_original === '2027-03-06' && dp.prazo === '2027-03-06' && dp.prazo_legado === true && dp.prazo_dias === null && dp.prazo_base_em === null && dp.prazo_ajuste === null, 'migração 8: o prazo que já existia vira a referência original, marcado como legado, sem reconstruir dias nem ajustar nada (mesmo caindo em sábado)');
  ok(ds.prazo_original === null && ds.prazo_legado === false && ds.chegou_em !== null, 'migração 8: demanda sem prazo continua sem prazo e não é marcada como legado');
  ok(JSON.stringify((await antigo.query('select id, texto, concluida, posicao from public.tarefas order by id')).rows) === JSON.stringify(tarefasAntes), 'migração 8: as tarefas ficam idênticas');
  const leg = await cw('buscar_demanda', { p_id: comPrazo.id });
  ok(leg.prazo_legado === true && leg.prazo === '2027-03-06', 'migração 8: a leitura devolve o legado identificável');

  // migração 9: os legados ABERTOS passam a valer pelo calendário (original preservado), sem tocar nas finalizadas, nos dias úteis nem no calendário alheio
  await antigo.exec(`insert into public.dias_indisponiveis (user_id, data, descricao, categoria) values ('${W}', '2027-03-12', 'Feriado de teste', 'Feriado')`);
  const v9 = async (id) => (await antigo.query('select prazo::text, prazo_original::text, prazo_legado, prazo_ajuste, versao, etapa from public.demandas where id = $1', [id])).rows[0];
  const antes9 = Object.fromEntries(await Promise.all([comPrazo, legFeriado, legUtil, legFinal, legOutro].map(async (x) => [x.id, await v9(x.id)])));
  const tarefas9 = JSON.stringify((await antigo.query('select id, texto, concluida, posicao from public.tarefas order by id')).rows);
  await antigo.exec(readFileSync(join('supabase/migrations', nova9), 'utf8'));
  const s9 = await v9(comPrazo.id), f9 = await v9(legFeriado.id), u9 = await v9(legUtil.id), z9 = await v9(legFinal.id), o9 = await v9(legOutro.id);
  ok(s9.prazo === '2027-03-05' && s9.prazo_original === '2027-03-06' && s9.prazo_ajuste === '06/03 sábado' && s9.prazo_legado === true && s9.versao === antes9[comPrazo.id].versao + 1, 'migração 9: legado aberto em sábado vai para a sexta, o original (sábado) e o marcador de legado ficam e a versão sobe');
  ok(f9.prazo === '2027-03-11' && f9.prazo_original === '2027-03-12' && /12\/03 feriado: Feriado de teste/.test(f9.prazo_ajuste ?? ''), 'migração 9: legado aberto em feriado cadastrado pelo próprio usuário é antecipado');
  ok(o9.prazo === '2027-03-12' && o9.prazo_ajuste === null && o9.versao === antes9[legOutro.id].versao, 'migração 9: o calendário de um usuário não ajusta a demanda de outro');
  ok(u9.prazo === '2027-03-10' && u9.versao === antes9[legUtil.id].versao && u9.prazo_ajuste === null, 'migração 9: legado aberto em dia útil não muda (nem a versão)');
  ok(z9.prazo === '2027-03-06' && z9.prazo_ajuste === null && z9.versao === antes9[legFinal.id].versao && z9.etapa === 'Finalizado', 'migração 9: demanda finalizada mantém o prazo de então e a versão');
  ok(JSON.stringify((await antigo.query('select id, texto, concluida, posicao from public.tarefas order by id')).rows) === tarefas9, 'migração 9: as tarefas ficam idênticas');
  await antigo.exec(readFileSync(join('supabase/migrations', nova9), 'utf8'));
  ok((await v9(comPrazo.id)).versao === s9.versao, 'migração 9: reaplicar é inofensivo (nenhuma versão sobe de novo)');
  const e = await cw('atualizar_demanda', { p_id: comPrazo.id, p: { assunto: 'Antiga com prazo (editada)' } });
  ok(e.prazo === '2027-03-05' && e.prazo_original === '2027-03-06' && e.prazo_legado === true, 'legado: editar outro campo não mexe no prazo nem no marcador');
  const m = await cw('atualizar_demanda', { p_id: comPrazo.id, p: { prazo_original: '2027-03-09' } });
  ok(m.prazo === '2027-03-09' && m.prazo_legado === false, 'legado: escolher uma data nova passa a valer pelas regras novas e tira o marcador');
  // migração 10 (entradas) sobre os mesmos dados: as demandas e as tarefas ficam idênticas e a tabela nova nasce vazia
  const demandasAntes10 = JSON.stringify((await antigo.query('select * from public.demandas order by id')).rows), tarefasAntes10 = JSON.stringify((await antigo.query('select * from public.tarefas order by id')).rows);
  await antigo.exec(readFileSync(join('supabase/migrations', nova10), 'utf8'));
  ok(JSON.stringify((await antigo.query('select * from public.demandas order by id')).rows) === demandasAntes10 && JSON.stringify((await antigo.query('select * from public.tarefas order by id')).rows) === tarefasAntes10 && (await antigo.query('select count(*)::int as n from public.entradas')).rows[0].n === 0, 'migração 10: demandas e tarefas existentes ficam idênticas e a tabela de entradas nasce vazia');
  const lido10 = await cw('buscar_demanda', { p_id: comPrazo.id });
  ok(lido10.entrada_id === null && lido10.prazo === '2027-03-09' && lido10.tarefas.length === 1, 'migração 10: a leitura da demanda ganha o campo entrada_id (nulo) sem alterar o resto');
  // migração 11 (cinco cores): uma nota com a cor 5 criada antes continua intacta; o sorteio automático passa a sair só de 0 a 4
  await antigo.exec("insert into public.entradas (id, user_id, titulo, texto, cor) values ('b0000000-0000-4000-8000-000000000005', '" + W + "', 'antes da 11', 'cor cinco', 5)");
  const antes11 = JSON.stringify((await antigo.query('select id, titulo, texto, cor, versao, criado_em, atualizado_em from public.entradas order by id')).rows);
  await antigo.exec(readFileSync(join('supabase/migrations', nova11), 'utf8'));
  ok(JSON.stringify((await antigo.query('select id, titulo, texto, cor, versao, criado_em, atualizado_em from public.entradas order by id')).rows) === antes11, 'migração 11: nenhuma anotação existente é alterada (a de cor 5 segue com a cor 5, mesma versão e mesmas datas)');
  const sorteio = new Set(); for (let i = 0; i < 60; i++) sorteio.add((await antigo.query('select public.cor_entrada_automatica() as c')).rows[0].c);
  ok(sorteio.size > 0 && [...sorteio].every((c) => c >= 0 && c <= 4), 'migração 11: o sorteio automático só devolve de 0 a 4');
  // migração 12 (RLS com conta autorizada em Entradas e dias): nenhum dado muda; só a política
  const antes12 = JSON.stringify((await antigo.query('select id, titulo, texto, cor, versao, criado_em, atualizado_em from public.entradas order by id')).rows) + JSON.stringify((await antigo.query('select * from public.dias_indisponiveis order by id')).rows);
  await antigo.exec(readFileSync(join('supabase/migrations', nova12), 'utf8'));
  ok(JSON.stringify((await antigo.query('select id, titulo, texto, cor, versao, criado_em, atualizado_em from public.entradas order by id')).rows) + JSON.stringify((await antigo.query('select * from public.dias_indisponiveis order by id')).rows) === antes12, 'migração 12: entradas e dias existentes seguem idênticos depois de trocar as políticas');
  // migração 14 (Agenda): demandas e tarefas existentes seguem idênticas; só aparecem colunas novas vazias e a etapa nova passa a ser aceita
  const col14 = 'id, assunto, numero, origem, chegou_em::text, prazo::text, prazo_original::text, prazo_ajuste, etapa, etapa_desde::text, setor, acompanhar_em::text, versao, atualizado_em::text, criado_em::text';
  const antes14 = JSON.stringify((await antigo.query(`select ${col14} from public.demandas order by id`)).rows) + JSON.stringify((await antigo.query('select id, texto, concluida, posicao from public.tarefas order by id')).rows) + JSON.stringify((await antigo.query('select * from public.entradas order by id')).rows) + JSON.stringify((await antigo.query('select * from public.dias_indisponiveis order by id')).rows);
  await antigo.exec(readFileSync(join('supabase/migrations', nova14), 'utf8'));
  const depois14 = JSON.stringify((await antigo.query(`select ${col14} from public.demandas order by id`)).rows) + JSON.stringify((await antigo.query('select id, texto, concluida, posicao from public.tarefas order by id')).rows) + JSON.stringify((await antigo.query('select * from public.entradas order by id')).rows) + JSON.stringify((await antigo.query('select * from public.dias_indisponiveis order by id')).rows);
  ok(antes14 === depois14, 'migração 14: demandas (campos, etapa, versão e datas), tarefas, entradas e dias indisponíveis existentes ficam idênticos');
  const novas14 = (await antigo.query('select count(*)::int as n, count(encaminhada_em)::int as e, count(reiterada_em)::int as r from public.demandas')).rows[0];
  ok(novas14.n > 0 && novas14.e === 0 && novas14.r === 0 && (await antigo.query('select count(*)::int as n from public.eventos')).rows[0].n === 0, 'migração 14: as colunas novas começam vazias e a tabela de eventos começa sem linhas');
  const moveu = await chamarComoUsuario(antigo, W, 'mover_etapa', { p_id: comPrazo.id, p_etapa: 'Aguardando Prefeita' });
  ok(moveu.etapa === 'Aguardando Prefeita' && moveu.prazo === (await chamarComoUsuario(antigo, W, 'buscar_demanda', { p_id: comPrazo.id })).prazo, 'migração 14: uma demanda antiga já pode ir para Aguardando Prefeita sem mudar o vencimento');
  // migração 15 (alinha a rotina às regras da Agenda): nenhuma demanda, tarefa ou data muda; só a função do resumo, o gatilho e uma função interna
  const lido15 = async () => JSON.stringify((await antigo.query(`select ${col14}, encaminhada_em::text, reiterada_em::text from public.demandas order by id`)).rows) + JSON.stringify((await antigo.query('select id, texto, concluida, posicao from public.tarefas order by id')).rows);
  const antes15 = await lido15();
  await antigo.exec(readFileSync(join('supabase/migrations', nova15), 'utf8'));
  const depois15 = await lido15();
  ok(antes15 === depois15, 'migração 15: demandas (incluindo versão e datas) e tarefas existentes ficam idênticas');
  await antigo.exec(readFileSync(join('supabase/migrations', nova15), 'utf8'));
  ok(await lido15() === depois15, 'migração 15: reaplicar é inofensivo');
  await antigo.exec(readFileSync(join('supabase/migrations', nova20), 'utf8'));
  ok(await lido15() === depois15, 'migração 20: aplicada depois das demais sobre os dados antigos, deixa as demandas e as tarefas idênticas');
  await antigo.close();
}

// ---------- Perfil: a janela de correção (hoje e 5 dias) vale também na escrita direta (migração 17) ----------
{
  const S = 'a2a2a2a2-9999-4999-8999-a2a2a2a2a2a2', W = 'a3a3a3a3-9999-4999-8999-a3a3a3a3a3a3', V = 'a4a4a4a4-9999-4999-8999-a4a4a4a4a4a4';
  await db.exec(`insert into auth.users (id, email) values ('${S}', 'js@teste'), ('${W}', 'jw@teste'), ('${V}', 'jv@teste')`);
  await db.exec("insert into dmanda_privado.acesso_autorizado (email) values ('js@teste'), ('jw@teste')");   // jv não é autorizado
  const pc = (u, f, a) => chamarComoUsuario(db, u, f, a);
  const pm = async (u, f, a) => { try { await pc(u, f, a); return null; } catch (e) { return e.message; } };
  const hoje = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const dia = (n) => { const [a, m, d] = hoje.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
  // escrita direta na tabela com a conta logada (o que a API de dados permite), devolvendo o erro e quantas linhas foram afetadas
  const direto = (u, sql, par = []) => db.transaction(async (tx) => { try { await entrarComo(tx, u); const r = await tx.query(sql, par); return { erro: null, n: r.rows.length || (r.affectedRows ?? 0) }; } catch (e) { return { erro: e.message, n: 0 }; } });
  const estado = async (u) => JSON.stringify((await db.query('select dia::text, humor from public.registros_dia where user_id = $1 order by dia', [u])).rows);
  const ins = (d, h = 3) => ['insert into public.registros_dia (dia, humor) values ($1, $2)', [d, h]];

  // limites: hoje e o quinto dia anterior entram; o dia seguinte e o sexto dia anterior não
  const iHoje = await direto(S, ...ins(hoje, 4, 2)), iQuinto = await direto(S, ...ins(dia(-5), 2, 4));
  ok(iHoje.erro === null && iHoje.n === 1 && iQuinto.erro === null && iQuinto.n === 1, 'janela 17: a escrita direta de hoje e do quinto dia anterior funciona');
  const antesRecusas = await estado(S);
  const rFut = await direto(S, ...ins(dia(1))), rSexto = await direto(S, ...ins(dia(-6))), rMuito = await direto(S, ...ins(dia(-400))), rAno = await direto(S, ...ins(dia(365)));
  ok([rFut, rSexto, rMuito, rAno].every((r) => /row-level|policy/i.test(r.erro || '') && r.n === 0) && await estado(S) === antesRecusas, 'janela 17: a escrita direta de dia futuro, do sexto dia anterior ou de dia muito antigo é recusada e nada é gravado');
  ok([rFut, rSexto, rMuito].every((r) => r.erro && !r.erro.includes(dia(1)) && !r.erro.includes(dia(-6)) && !r.erro.includes(dia(-400))), 'janela 17: a mensagem de recusa não repete a data informada');

  // atualização: dentro da janela vale; levar a linha para fora da janela (inclusive alterando a data) é recusado
  const uOk = await direto(S, 'update public.registros_dia set humor = 5 where dia = $1', [hoje]);
  ok(uOk.erro === null && uOk.n === 1 && JSON.parse(await estado(S)).find((x) => x.dia === hoje).humor === 5, 'janela 17: corrigir o humor de hoje (mesmo dia) direto na tabela segue funcionando');
  const antesUp = await estado(S);
  const uFut = await direto(S, 'update public.registros_dia set dia = $2 where dia = $1', [hoje, dia(1)]);
  const uSexto = await direto(S, 'update public.registros_dia set dia = $2 where dia = $1', [hoje, dia(-6)]);
  const uQuintoFora = await direto(S, 'update public.registros_dia set dia = $2 where dia = $1', [dia(-5), dia(-7)]);
  ok([uFut, uSexto, uQuintoFora].every((r) => /row-level|policy|permission denied/i.test(r.erro || '')) && await estado(S) === antesUp, 'janela 17: alterar a data de uma linha para o futuro ou para além do quinto dia anterior é recusado e a linha não muda (desde a migração 18 a recusa vem já do privilégio de coluna; a política da 17 continua como segunda camada)');

  // registros antigos (já existentes, fora da janela) continuam legíveis, mas não são alterados nem movidos
  await db.query("insert into public.registros_dia (user_id, dia, humor) values ($1, $2, 1), ($1, $3, 2), ($1, $4, 3)", [S, dia(-6), dia(-40), dia(3)]);   // como administrador: sexto dia, histórico e uma linha futura de antes da correção
  const antes = await estado(S);
  const aSexto = await direto(S, 'update public.registros_dia set humor = 5 where dia = $1', [dia(-6)]);
  const aHist = await direto(S, 'update public.registros_dia set humor = 4 where dia = $1', [dia(-40)]);
  const aMover = await direto(S, 'update public.registros_dia set dia = $2 where dia = $1', [dia(-40), dia(-2)]);
  const aFut = await direto(S, 'update public.registros_dia set humor = 5 where dia = $1', [dia(3)]);
  const aFutPraHoje = await direto(S, 'update public.registros_dia set dia = $2 where dia = $1', [dia(3), dia(-1)]);
  ok([aSexto, aHist, aMover, aFut, aFutPraHoje].every((r) => r.n === 0) && await estado(S) === antes, 'janela 17: linha fora da janela (sexto dia, histórico, futura) não é alterada nem movida para dentro da janela pela escrita direta');
  const lerDireto = await direto(S, 'select dia::text from public.registros_dia order by dia');
  const lista = await pc(S, 'listar_registros_dia', {});
  ok(lerDireto.n === 5 && lista.some((x) => x.dia === dia(-40)) && lista.some((x) => x.dia === dia(-6)) && lista.map((x) => x.dia).join() === [...lista.map((x) => x.dia)].sort().join(), 'janela 17: a leitura histórica (direta e pela listagem de 62 dias) continua devolvendo todos os registros, em ordem');

  // regravação do mesmo dia (função e escrita direta com conflito)
  const rg = await pc(S, 'registrar_dias', { p: [{ dia: hoje, humor: 1 }, { dia: dia(-5), humor: 5 }] });
  ok(rg.length === 2 && rg.find((x) => x.dia === hoje).humor === 1 && rg.find((x) => x.dia === dia(-5)).humor === 5, 'janela 17: registrar_dias continua regravando hoje e o quinto dia anterior no mesmo lote');
  const up1 = await direto(S, 'insert into public.registros_dia (dia, humor) values ($1, 2) on conflict (user_id, dia) do update set humor = excluded.humor', [hoje]);
  const up2 = await direto(S, 'insert into public.registros_dia (dia, humor) values ($1, 2) on conflict (user_id, dia) do update set humor = excluded.humor', [dia(-6)]);
  const up3 = await direto(S, 'insert into public.registros_dia (dia, humor) values ($1, 5) on conflict (user_id, dia) do update set humor = excluded.humor', [dia(-40)]);
  const lidos = JSON.parse(await estado(S));
  ok(up1.erro === null && lidos.find((x) => x.dia === hoje).humor === 2 && /row-level|policy/i.test(up2.erro || '') && /row-level|policy/i.test(up3.erro || '') && lidos.find((x) => x.dia === dia(-6)).humor === 1 && lidos.find((x) => x.dia === dia(-40)).humor === 2, 'janela 17: o upsert direto regrava hoje, mas não regrava o sexto dia anterior nem o histórico');

  // lote inválido não grava nada (a função continua tudo ou nada)
  const antesLote = await estado(S);
  const mLote = [
    await pm(S, 'registrar_dias', { p: [{ dia: dia(-2), humor: 3 }, { dia: dia(-6), humor: 3 }] }),
    await pm(S, 'registrar_dias', { p: [{ dia: dia(-2), humor: 3 }, { dia: dia(1), humor: 3 }] }),
    await pm(S, 'registrar_dias', { p: [{ dia: dia(-2), humor: 3 }, { dia: dia(-3), humor: 9 }] }),
  ];
  ok(mLote.every((m) => m !== null) && await estado(S) === antesLote, 'janela 17: lote com item fora da janela ou inválido não grava nenhum dos itens');

  // acesso: só a conta autorizada, só os próprios registros
  const nA = await direto(V, ...ins(hoje));
  const outro = await direto(S, 'insert into public.registros_dia (user_id, dia, humor) values ($1, $2, 3)', [W, hoje]);
  const alheio = await direto(W, 'update public.registros_dia set humor = 1 where user_id = $1', [S]);
  ok(/row-level|policy/i.test(nA.erro || '') && /row-level|policy/i.test(outro.erro || '') && alheio.n === 0, 'janela 17: conta não autorizada não grava, e ninguém grava ou altera registro de outro usuário');
  const wLeitura = await direto(W, 'select 1 from public.registros_dia');
  ok(wLeitura.n === 0 && (await direto(W, ...ins(hoje))).erro === null, 'janela 17: outro usuário autorizado grava o próprio hoje e não enxerga os registros do primeiro');

  // a regra vem do banco, pela data civil de São Paulo, e as funções seguem SECURITY INVOKER
  const pol = (await db.query("select policyname, permissive, cmd, roles::text as roles, coalesce(qual, '') as qual, coalesce(with_check, '') as wc from pg_policies where schemaname = 'public' and tablename = 'registros_dia' order by policyname")).rows;
  const dono = pol.find((p) => p.policyname === 'registros_dia_dono'), restritivas = pol.filter((p) => p.permissive === 'RESTRICTIVE');
  ok(dono && dono.permissive === 'PERMISSIVE' && dono.cmd === 'ALL' && /conta_autorizada/.test(dono.qual) && /conta_autorizada/.test(dono.wc), 'janela 17: a política da conta autorizada continua como era (permissiva, para todos os comandos)');
  ok(restritivas.length === 2 && restritivas.every((p) => /hoje\(\)/.test(p.qual + p.wc) && !/current_date|now\(\)|timezone/i.test(p.qual + p.wc) && p.roles.includes('authenticated')) && restritivas.map((p) => p.cmd).sort().join() === 'INSERT,UPDATE', 'janela 17: as políticas da janela são restritivas, para inserir e atualizar, e usam public.hoje() (dia civil de São Paulo)');
  const inv = (await db.query("select proname, prosecdef from pg_proc where proname in ('registrar_dias','listar_registros_dia') order by 1")).rows;
  ok(inv.length === 2 && inv.every((p) => p.prosecdef === false), 'janela 17: registrar_dias e listar_registros_dia seguem SECURITY INVOKER');
}

// ---------- migração 17 sobre dados da migração 16: o que existe fica idêntico e a falha de antes deixa de se repetir ----------
{
  const { mkdtempSync, copyFileSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m17 = todas.find((f) => f.includes('registros_dia_janela'));
  const m16 = todas.find((f) => f.endsWith('_registros_dia.sql'));
  ok(!!m17 && !!m16 && todas.indexOf(m17) === todas.indexOf(m16) + 1, 'migração 17: existe, vem logo depois da 16 e a 16 não foi reescrita (arquivo à parte)');
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig17-'));
  for (const f of todas.filter((f) => f < m17)) copyFileSync(join('supabase/migrations', f), join(pasta, f));   // só as migrações 1 a 16: uma futura 18 não entra no banco "antigo"
  const a16 = await abrirBancoTeste({ raizMigracoes: pasta });   // schema com as migrações 1 a 16
  const X = 'a5a5a5a5-9999-4999-8999-a5a5a5a5a5a5';
  await a16.exec(`insert into auth.users (id, email) values ('${X}', 'jx@teste')`);
  await a16.exec("insert into dmanda_privado.acesso_autorizado (email) values ('jx@teste')");
  const cx = (f, a) => chamarComoUsuario(a16, X, f, a);
  const hoje = (await a16.query('select public.hoje()::text as h')).rows[0].h;
  const dia = (n) => { const [a, m, d] = hoje.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
  const direto = (sql, par = []) => a16.transaction(async (tx) => { try { await entrarComo(tx, X); const r = await tx.query(sql, par); return { erro: null, n: r.rows.length || (r.affectedRows ?? 0) }; } catch (e) { return { erro: e.message, n: 0 }; } });
  const ins = (d) => ['insert into public.registros_dia (dia, humor, energia) values ($1, 3, 3)', [d]];

  // dados fictícios preexistentes: demandas, tarefa, anotação e registros (hoje, quinto dia, histórico e uma linha futura gravada pela falha)
  const d1 = await cx('criar_demanda', { p: { assunto: 'Fictícia A', prazo: '2027-03-09', numero: '1/2026', origem: 'Origem fictícia', chegou_em: '2026-09-01' } });
  await cx('criar_demanda', { p: { assunto: 'Fictícia B' } });
  await cx('adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Tarefa fictícia' });
  await a16.query("insert into public.entradas (user_id, titulo, texto) values ($1, 'Nota fictícia', 'texto fictício')", [X]);
  await cx('registrar_dias', { p: [{ dia: hoje, humor: 4, energia: 2 }, { dia: dia(-5), humor: 2, energia: 4 }] });
  await a16.query("insert into public.registros_dia (user_id, dia, humor, energia) values ($1, $2, 1, 1), ($1, $3, 5, 5)", [X, dia(-6), dia(-40)]);

  // a falha reproduzida na 16: a conta autorizada grava direto fora da janela
  const falhaFut = await direto(...ins(dia(2))), falhaAntigo = await direto(...ins(dia(-20)));
  ok(falhaFut.erro === null && falhaAntigo.erro === null, 'migração 17 (antes): na migração 16 a escrita direta de dia futuro e de dia antigo é aceita (falha reproduzida)');

  const tabelas = (await a16.query("select table_schema as s, table_name as t from information_schema.tables where table_schema in ('public','dmanda_privado') and table_type = 'BASE TABLE' order by 1, 2")).rows;
  const foto = async () => { const o = {}; for (const { s, t } of tabelas) o[`${s}.${t}`] = (await a16.query(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) as j from ${s}.${t} x`)).rows[0].j; return JSON.stringify(o); };
  const funcoes = async () => JSON.stringify((await a16.query("select p.oid::regprocedure::text as f, p.prosecdef, p.proacl::text as acl, md5(pg_get_functiondef(p.oid)) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') order by 1")).rows);
  const donoAntes = JSON.stringify((await a16.query("select * from pg_policies where tablename = 'registros_dia' and policyname = 'registros_dia_dono'")).rows);
  const privAntes = JSON.stringify((await a16.query("select grantee, privilege_type from information_schema.role_table_grants where table_name = 'registros_dia' order by 1, 2")).rows);
  const listaAntes = JSON.stringify(await cx('listar_registros_dia', {}));
  const fotoAntes = await foto(), funcoesAntes = await funcoes();

  await a16.exec(readFileSync(join('supabase/migrations', m17), 'utf8'));

  ok(await foto() === fotoAntes, 'migração 17: todas as linhas de todas as tabelas (demandas, tarefas, anotações, registros de humor e energia) ficam idênticas');
  ok(await funcoes() === funcoesAntes, 'migração 17: nenhuma função muda (definição, SECURITY INVOKER e privilégios), inclusive registrar_dias e listar_registros_dia');
  ok(JSON.stringify((await a16.query("select * from pg_policies where tablename = 'registros_dia' and policyname = 'registros_dia_dono'")).rows) === donoAntes && JSON.stringify((await a16.query("select grantee, privilege_type from information_schema.role_table_grants where table_name = 'registros_dia' order by 1, 2")).rows) === privAntes, 'migração 17: a política da conta autorizada e os privilégios da tabela não mudam (a janela é acrescentada por políticas restritivas)');
  const listaDepois = await cx('listar_registros_dia', {});
  ok(JSON.stringify(listaDepois) === listaAntes && listaDepois.some((x) => x.dia === dia(-40)) && listaDepois.some((x) => x.dia === dia(-6)) && listaDepois.some((x) => x.dia === dia(2)), 'migração 17: a leitura histórica devolve o mesmo, incluindo o registro antigo, o do sexto dia e a linha futura que a falha deixou');

  const depoisFut = await direto(...ins(dia(3))), depoisSexto = await direto(...ins(dia(-7))), depoisHoje = await direto('insert into public.registros_dia (dia, humor, energia) values ($1, 5, 5) on conflict (user_id, dia) do update set humor = excluded.humor', [hoje]);
  ok(/row-level|policy/i.test(depoisFut.erro || '') && /row-level|policy/i.test(depoisSexto.erro || '') && depoisHoje.erro === null, 'migração 17 (depois): futuro e além do quinto dia anterior passam a ser recusados na escrita direta; hoje continua regravável');
  const reg = await cx('registrar_dias', { p: [{ dia: hoje, humor: 2, energia: 2 }, { dia: dia(-5), humor: 3, energia: 3 }] });
  let loteRuim = null;
  try { await cx('registrar_dias', { p: [{ dia: dia(-1), humor: 3, energia: 3 }, { dia: dia(-6), humor: 3, energia: 3 }] }); } catch (e) { loteRuim = e.message; }
  ok(reg.length === 2 && loteRuim !== null && !(await cx('listar_registros_dia', {})).some((x) => x.dia === dia(-1)), 'migração 17: registrar_dias continua gravando o lote válido e recusando o inválido por inteiro');

  const fotoMeio = await foto();
  await a16.exec(readFileSync(join('supabase/migrations', m17), 'utf8'));
  ok(await foto() === fotoMeio && (await a16.query("select count(*)::int as n from pg_policies where tablename = 'registros_dia'")).rows[0].n === 3, 'migração 17: reaplicar é inofensivo (continuam as 3 políticas e nenhuma linha muda)');
  await a16.close();
}

// ---------- migração 18 sobre dados das migrações 16 e 17: o UPDATE direto passa a valer só para humor e energia ----------
{
  const { mkdtempSync, copyFileSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m18 = todas.find((f) => f.includes('registros_dia_colunas'));
  const m17 = todas.find((f) => f.includes('registros_dia_janela'));
  ok(!!m18 && !!m17 && todas.indexOf(m18) === todas.indexOf(m17) + 1, 'migração 18: existe, vem logo depois da 17 e a 16 e a 17 não foram reescritas (arquivo à parte)');
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig18-'));
  for (const f of todas.filter((f) => f < m18)) copyFileSync(join('supabase/migrations', f), join(pasta, f));   // só as migrações 1 a 17
  const a17 = await abrirBancoTeste({ raizMigracoes: pasta });
  const X = 'a6a6a6a6-9999-4999-8999-a6a6a6a6a6a6';
  await a17.exec(`insert into auth.users (id, email) values ('${X}', 'kx@teste')`);
  await a17.exec("insert into dmanda_privado.acesso_autorizado (email) values ('kx@teste')");
  const cx = (f, a) => chamarComoUsuario(a17, X, f, a);
  const hoje = (await a17.query('select public.hoje()::text as h')).rows[0].h;
  const dia = (n) => { const [a, m, d] = hoje.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
  const direto = (sql, par = []) => a17.transaction(async (tx) => { try { await entrarComo(tx, X); const r = await tx.query(sql, par); return { erro: null, n: r.affectedRows ?? r.rows.length }; } catch (e) { return { erro: e.message, n: 0 }; } });
  const lido = async () => JSON.stringify((await a17.query('select dia::text, humor, energia from public.registros_dia where user_id = $1 order by dia', [X])).rows);

  await cx('registrar_dias', { p: [{ dia: hoje, humor: 4, energia: 2 }, { dia: dia(-2), humor: 1, energia: 5 }] });
  await a17.query('insert into public.registros_dia (user_id, dia, humor, energia) values ($1, $2, 5, 5)', [X, dia(-40)]);
  const mover17 = await direto('update public.registros_dia set dia = $1 where dia = $2', [dia(-1), hoje]);
  ok(mover17.erro === null && mover17.n === 1, 'migração 18 (antes): na migração 17 mover a linha para outro dia válido da janela é aceito (falha reproduzida)');
  await a17.query('update public.registros_dia set dia = $1 where user_id = $2 and dia = $3', [hoje, X, dia(-1)]);   // desfaz a movimentação para seguir com os mesmos dados

  const tabelas = (await a17.query("select table_schema as s, table_name as t from information_schema.tables where table_schema in ('public','dmanda_privado') and table_type = 'BASE TABLE' order by 1, 2")).rows;
  const foto = async () => { const o = {}; for (const { s, t } of tabelas) o[`${s}.${t}`] = (await a17.query(`select coalesce(jsonb_agg(to_jsonb(x) - 'atualizado_em' order by to_jsonb(x)::text), '[]'::jsonb) as j from ${s}.${t} x`)).rows[0].j; return JSON.stringify(o); };
  const funcoes = async () => JSON.stringify((await a17.query("select p.oid::regprocedure::text as f, p.prosecdef, p.proacl::text as acl, md5(pg_get_functiondef(p.oid)) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') order by 1")).rows);
  const politicas = async () => JSON.stringify((await a17.query("select policyname, permissive, cmd, roles::text, qual, with_check from pg_policies where tablename = 'registros_dia' order by 1")).rows);
  const fotoAntes = await foto(), funcoesAntes = await funcoes(), politicasAntes = await politicas(), listaAntes = JSON.stringify(await cx('listar_registros_dia', {})), dadosAntes = await lido();

  await a17.exec(readFileSync(join('supabase/migrations', m18), 'utf8'));

  ok(await foto() === fotoAntes && await lido() === dadosAntes, 'migração 18: todas as linhas de todas as tabelas ficam idênticas');
  ok(await funcoes() === funcoesAntes, 'migração 18: nenhuma função muda (definição, SECURITY INVOKER e privilégios)');
  ok(await politicas() === politicasAntes && (await a17.query("select count(*)::int as n from pg_policies where tablename = 'registros_dia'")).rows[0].n === 3, 'migração 18: as 3 políticas de RLS continuam idênticas');
  ok(JSON.stringify(await cx('listar_registros_dia', {})) === listaAntes && (await cx('listar_registros_dia', { p_dias: 62 })).some((x) => x.dia === dia(-40)), 'migração 18: o histórico segue legível, inclusive o registro antigo');

  // privilégios efetivos por coluna
  const priv = async (col, tipo) => (await a17.query("select has_column_privilege('authenticated', 'public.registros_dia', $1, $2) as p", [col, tipo])).rows[0].p;
  const atualiza = {}; for (const c of ['user_id', 'dia', 'humor', 'energia', 'criado_em', 'atualizado_em']) atualiza[c] = await priv(c, 'UPDATE');
  ok(JSON.stringify(atualiza) === JSON.stringify({ user_id: false, dia: false, humor: true, energia: true, criado_em: false, atualizado_em: false }), 'migração 18: authenticated tem UPDATE somente em humor e energia (efetivo, por coluna)');
  const tp = (await a17.query("select has_table_privilege('authenticated','public.registros_dia','SELECT') as s, has_table_privilege('authenticated','public.registros_dia','INSERT') as i, has_table_privilege('authenticated','public.registros_dia','DELETE') as d, has_table_privilege('anon','public.registros_dia','SELECT') as a")).rows[0];
  ok(tp.s && tp.i && !tp.d && !tp.a, 'migração 18: SELECT e INSERT de authenticated permanecem; sem DELETE; anon sem acesso');
  const resto = (await a17.query("select count(*)::int as n from information_schema.role_table_grants where table_name = 'registros_dia' and grantee = 'authenticated' and privilege_type = 'UPDATE'")).rows[0].n;
  ok(resto === 0, 'migração 18: não resta UPDATE de tabela inteira para authenticated no catálogo');

  // mover a linha é recusado e o registro permanece no dia original
  const mover = await direto('update public.registros_dia set dia = $1 where dia = $2', [dia(-1), hoje]);
  const moverOcupado = await direto('update public.registros_dia set dia = $1 where dia = $2', [dia(-2), hoje]);
  const trocarDono = await direto('update public.registros_dia set user_id = $1 where dia = $2', ['00000000-0000-4000-8000-000000000000', hoje]);
  ok(/permission denied/i.test(mover.erro || '') && /permission denied/i.test(moverOcupado.erro || '') && /permission denied/i.test(trocarDono.erro || ''), 'migração 18: mover a linha para outro dia (livre ou ocupado) e trocar o dono são recusados por falta de privilégio');
  ok(await lido() === dadosAntes, 'migração 18: depois das tentativas de mover, o registro permanece no dia original e nenhum outro mudou');

  // UPDATE direto de humor e energia continua possível; registrar_dias insere e atualiza o mesmo dia
  const dir = await direto('update public.registros_dia set humor = 3, energia = 3 where dia = $1', [hoje]);
  ok(dir.erro === null && dir.n === 1, 'migração 18: o UPDATE direto de humor e energia (dentro da janela) continua permitido');
  const g1 = await cx('registrar_dias', { p: [{ dia: dia(-3), humor: 2, energia: 2 }] });
  const g2 = await cx('registrar_dias', { p: [{ dia: dia(-3), humor: 5, energia: 1 }] });
  const g3 = await cx('registrar_dias', { p: [{ dia: hoje, humor: 1, energia: 1 }, { dia: dia(-2), humor: 4, energia: 4 }] });
  const l = await cx('listar_registros_dia', {});
  ok(g1[0].humor === 2 && g2[0].humor === 5 && g2[0].energia === 1 && g3.length === 2 && l.filter((x) => x.dia === dia(-3)).length === 1 && l.find((x) => x.dia === dia(-3)).humor === 5 && l.find((x) => x.dia === hoje).humor === 1, 'migração 18: registrar_dias insere e atualiza o mesmo dia (inclusive na segunda gravação) e continua uma linha por dia');
  ok((await a17.query('select count(*)::int as n from public.registros_dia where user_id = $1', [X])).rows[0].n === 4 && l.some((x) => x.dia === dia(-40)), 'migração 18: o histórico continua legível e sem linhas duplicadas');
  const fora = await cx('registrar_dias', { p: [{ dia: dia(-6), humor: 3, energia: 3 }] }).then(() => null, (e) => e.message);
  ok(/5 dias/.test(fora || ''), 'migração 18: a janela de hoje e 5 dias continua valendo em registrar_dias');
  const fut = await direto('insert into public.registros_dia (dia, humor, energia) values ($1, 3, 3)', [dia(2)]);
  ok(/row-level|policy/i.test(fut.erro || ''), 'migração 18: a política de janela da migração 17 segue valendo na escrita direta');

  const fotoMeio = await foto();
  await a17.exec(readFileSync(join('supabase/migrations', m18), 'utf8'));
  ok(await foto() === fotoMeio && (await priv('dia', 'UPDATE')) === false && (await priv('humor', 'UPDATE')) === true, 'migração 18: reaplicar é inofensivo');
  await a17.close();
}

// ---------- migração 19: o indicador de energia saiu; instalação limpa e upgrade sobre dados das migrações 16 a 18 ----------
{
  const { mkdtempSync, copyFileSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m19 = todas.find((f) => f.includes('registros_dia_so_humor'));
  const m18 = todas.find((f) => f.includes('registros_dia_colunas'));
  ok(!!m19 && !!m18 && todas.indexOf(m19) === todas.indexOf(m18) + 1, 'migração 19: existe, vem logo depois da 18 e as migrações 16 a 18 não foram reescritas (arquivo à parte)');

  // ---- instalação limpa: o esquema final
  const L = 'a7a7a7a7-9999-4999-8999-a7a7a7a7a7a7', M = 'a8a8a8a8-9999-4999-8999-a8a8a8a8a8a8';
  await db.exec(`insert into auth.users (id, email) values ('${L}', 'lx@teste'), ('${M}', 'mx@teste')`);
  await db.exec("insert into dmanda_privado.acesso_autorizado (email) values ('lx@teste')");   // mx não é autorizado
  const lc = (f, a) => chamarComoUsuario(db, L, f, a);
  const hoje = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const dia = (n) => { const [a, m, d] = hoje.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
  const direto = (u, sql, par = []) => db.transaction(async (tx) => { try { await entrarComo(tx, u); const r = await tx.query(sql, par); return { erro: null, n: r.affectedRows ?? r.rows.length }; } catch (e) { return { erro: e.message, n: 0 }; } });
  const colunas = (await db.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'registros_dia' order by column_name")).rows.map((r) => r.column_name).join();
  ok(colunas === 'atualizado_em,criado_em,dia,humor,user_id', 'migração 19 (instalação limpa): a tabela tem só usuário, dia, humor e os dois carimbos (a coluna energia não existe)');
  const priv = async (col, tipo) => (await db.query("select has_column_privilege('authenticated', 'public.registros_dia', $1, $2) as p", [col, tipo])).rows[0].p;
  const upd = {}; for (const c of ['user_id', 'dia', 'humor', 'criado_em', 'atualizado_em']) upd[c] = await priv(c, 'UPDATE');
  ok(JSON.stringify(upd) === JSON.stringify({ user_id: false, dia: false, humor: true, criado_em: false, atualizado_em: false }), 'migração 19 (instalação limpa): authenticated tem UPDATE somente em humor; dia, user_id, criado_em e atualizado_em ficam protegidos');
  const tp = (await db.query("select has_table_privilege('authenticated','public.registros_dia','SELECT') as s, has_table_privilege('authenticated','public.registros_dia','INSERT') as i, has_table_privilege('authenticated','public.registros_dia','DELETE') as d, has_table_privilege('anon','public.registros_dia','SELECT') as a")).rows[0];
  const upT = (await db.query("select count(*)::int as n from information_schema.role_table_grants where table_name = 'registros_dia' and grantee = 'authenticated' and privilege_type = 'UPDATE'")).rows[0].n;
  ok(tp.s && tp.i && !tp.d && !tp.a && upT === 0, 'migração 19 (instalação limpa): SELECT e INSERT preservados, sem DELETE, sem UPDATE de tabela inteira e sem acesso de anon');
  const pol = (await db.query("select policyname, permissive, cmd from pg_policies where tablename = 'registros_dia' order by policyname")).rows.map((p) => `${p.policyname}:${p.permissive}:${p.cmd}`).join();
  const fn = (await db.query("select proname, prosecdef from pg_proc where proname in ('registrar_dias','listar_registros_dia') order by 1")).rows;
  ok(pol === 'registros_dia_dono:PERMISSIVE:ALL,registros_dia_janela_atualizar:RESTRICTIVE:UPDATE,registros_dia_janela_inserir:RESTRICTIVE:INSERT' && fn.length === 2 && fn.every((p) => p.prosecdef === false), 'migração 19 (instalação limpa): as 3 políticas de RLS e o SECURITY INVOKER das duas funções estão preservados');

  // ---- comportamento: humor sozinho, opcional, um por dia, janela, lote atômico, histórico
  const g1 = await lc('registrar_dias', { p: [{ dia: hoje, humor: 4 }] });
  ok(g1.length === 1 && g1[0].humor === 4 && Object.keys(g1[0]).sort().join() === 'dia,humor', 'migração 19: o humor é gravado sozinho, sem energia');
  const g2 = await lc('registrar_dias', { p: [{ dia: hoje, humor: 2, energia: 5 }] });
  ok(g2[0].humor === 2 && !('energia' in g2[0]) && (await lc('listar_registros_dia', {})).every((x) => !('energia' in x)), 'migração 19: um campo energia enviado por um aparelho antigo é ignorado, nunca guardado nem devolvido');
  ok((await db.query('select count(*)::int as n from public.registros_dia where user_id = $1 and dia = $2', [L, hoje])).rows[0].n === 1, 'migração 19: gravar o mesmo dia de novo substitui (uma linha por dia)');
  await lc('registrar_dias', { p: [{ dia: dia(-5), humor: 1 }, { dia: dia(-3), humor: 5 }] });
  const antes = JSON.stringify(await lc('listar_registros_dia', {}));
  const ruim = await lc('registrar_dias', { p: [{ dia: dia(-2), humor: 3 }, { dia: dia(-6), humor: 3 }] }).then(() => null, (e) => e.message);
  const ruim2 = await lc('registrar_dias', { p: [{ dia: dia(-2), humor: 3 }, { dia: dia(-1) }] }).then(() => null, (e) => e.message);
  ok(/5 dias/.test(ruim || '') && /humor/i.test(ruim2 || '') && JSON.stringify(await lc('listar_registros_dia', {})) === antes, 'migração 19: o lote continua tudo ou nada, com a janela de hoje e 5 dias; humor ausente é recusado');
  ok(/ainda não chegou/.test(await lc('registrar_dias', { p: [{ dia: dia(1), humor: 3 }] }).then(() => '', (e) => e.message)), 'migração 19: dia futuro continua recusado');
  const mover = await direto(L, 'update public.registros_dia set dia = $1 where dia = $2', [dia(-1), hoje]);
  const dono = await direto(L, 'update public.registros_dia set user_id = $1 where dia = $2', [M, hoje]);
  const hum = await direto(L, 'update public.registros_dia set humor = 3 where dia = $1', [hoje]);
  ok(/permission denied/i.test(mover.erro || '') && /permission denied/i.test(dono.erro || '') && hum.erro === null && (await lc('listar_registros_dia', {})).find((x) => x.dia === hoje).humor === 3, 'migração 19: mover a linha ou trocar o dono é recusado; corrigir o humor direto continua permitido');
  ok((await lc('listar_registros_dia', {})).length === 3 && (await direto(M, 'select 1 from public.registros_dia')).n === 0 && /row-level|policy/i.test((await direto(M, 'insert into public.registros_dia (dia, humor) values ($1, 3)', [hoje])).erro || ''), 'migração 19: o histórico continua legível e a conta não autorizada nem lê nem grava');

  // ---- upgrade: banco com as migrações 1 a 18, dados fictícios com energia, aplica a 19
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig19-'));
  for (const f of todas.filter((f) => f < m19)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
  const a18 = await abrirBancoTeste({ raizMigracoes: pasta });
  const X = 'a9a9a9a9-9999-4999-8999-a9a9a9a9a9a9';
  await a18.exec(`insert into auth.users (id, email) values ('${X}', 'ux@teste')`);
  await a18.exec("insert into dmanda_privado.acesso_autorizado (email) values ('ux@teste')");
  const ux = (f, a) => chamarComoUsuario(a18, X, f, a);
  await ux('registrar_dias', { p: [{ dia: hoje, humor: 4, energia: 2 }, { dia: dia(-2), humor: 1, energia: 5 }] });
  await a18.query('insert into public.registros_dia (user_id, dia, humor, energia) values ($1, $2, 5, 5)', [X, dia(-40)]);   // histórico fora da janela
  const dm = await ux('criar_demanda', { p: { assunto: 'Fictícia A', prazo: '2027-03-09' } });
  await ux('adicionar_tarefa', { p_demanda: dm.id, p_texto: 'Tarefa fictícia' });
  await a18.query("insert into public.entradas (user_id, titulo, texto) values ($1, 'Nota fictícia', 'texto fictício')", [X]);
  const tabelas = (await a18.query("select table_schema as s, table_name as t from information_schema.tables where table_schema in ('public','dmanda_privado') and table_type = 'BASE TABLE' and table_name <> 'registros_dia' order by 1, 2")).rows;
  const foto = async () => { const o = {}; for (const { s, t } of tabelas) o[`${s}.${t}`] = (await a18.query(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) as j from ${s}.${t} x`)).rows[0].j; return JSON.stringify(o); };
  const humores = async () => JSON.stringify((await a18.query('select dia::text, humor, criado_em::text as c from public.registros_dia where user_id = $1 order by dia', [X])).rows);
  const acl = async () => JSON.stringify((await a18.query("select p.oid::regprocedure::text as f, p.prosecdef, p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and p.proname not in ('registrar_dias','listar_registros_dia') order by 1")).rows);
  const aclPerfil = async () => JSON.stringify((await a18.query("select p.oid::regprocedure::text as f, p.prosecdef, p.proacl::text as acl from pg_proc p where p.proname in ('registrar_dias','listar_registros_dia') order by 1")).rows);
  const politicas = async () => JSON.stringify((await a18.query("select policyname, permissive, cmd, roles::text, qual, with_check from pg_policies where tablename = 'registros_dia' order by 1")).rows);
  const f0 = await foto(), h0 = await humores(), a0 = await acl(), ap0 = await aclPerfil(), p0 = await politicas();
  ok(JSON.parse(h0).length === 3 && (await a18.query("select count(*)::int as n from information_schema.columns where table_name = 'registros_dia' and column_name = 'energia'")).rows[0].n === 1, 'migração 19 (antes): o banco 1 a 18 tem a coluna energia e três registros fictícios');

  await a18.exec(readFileSync(join('supabase/migrations', m19), 'utf8'));

  ok(await foto() === f0, 'migração 19 (upgrade): demandas, tarefas, anotações e as demais tabelas ficam idênticas');
  ok(await humores() === h0, 'migração 19 (upgrade): os registros de humor ficam idênticos (dia, humor e data de criação), inclusive o histórico fora da janela');
  const col = (await a18.query("select column_name from information_schema.columns where table_name = 'registros_dia' order by column_name")).rows.map((r) => r.column_name).join();
  ok(col === 'atualizado_em,criado_em,dia,humor,user_id', 'migração 19 (upgrade): a coluna energia é removida e as demais permanecem');
  ok(await politicas() === p0 && await acl() === a0 && await aclPerfil() === ap0, 'migração 19 (upgrade): políticas de RLS, privilégios e SECURITY INVOKER das funções ficam como estavam');
  const priv18 = async (col, tipo) => (await a18.query("select has_column_privilege('authenticated', 'public.registros_dia', $1, $2) as p", [col, tipo])).rows[0].p;
  const u18 = {}; for (const c of ['user_id', 'dia', 'humor', 'criado_em', 'atualizado_em']) u18[c] = await priv18(c, 'UPDATE');
  ok(JSON.stringify(u18) === JSON.stringify(upd) && (await a18.query("select count(*)::int as n from information_schema.role_table_grants where table_name = 'registros_dia' and grantee = 'authenticated' and privilege_type = 'UPDATE'")).rows[0].n === 0, 'migração 19 (upgrade): UPDATE só em humor, igual à instalação limpa');
  const leitura = await ux('listar_registros_dia', {});
  const regrava = await ux('registrar_dias', { p: [{ dia: hoje, humor: 3 }] });
  ok(leitura.length === 3 && leitura.some((x) => x.dia === dia(-40) && x.humor === 5) && regrava[0].humor === 3 && Object.keys(leitura[0]).sort().join() === 'dia,humor', 'migração 19 (upgrade): o histórico segue legível, só com dia e humor, e registrar_dias regrava o dia');
  const fMeio = await foto(), hMeio = await humores();
  await a18.exec(readFileSync(join('supabase/migrations', m19), 'utf8'));
  ok(await foto() === fMeio && await humores() === hMeio, 'migração 19: reaplicar é inofensivo');
  await a18.close();
}

// ---------- migração 20: origem, documento associado, marca Rápida e Para hoje (decisão 60) ----------
{
  const { mkdtempSync, copyFileSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m20 = todas.find((f) => f.includes('origem_documento_para_hoje'));
  const m19 = todas.find((f) => f.includes('registros_dia_so_humor'));
  ok(!!m20 && !!m19 && todas.indexOf(m20) === todas.indexOf(m19) + 1, 'migração 20: existe, vem logo depois da 19 e as anteriores não foram reescritas (arquivo à parte)');

  // ---- upgrade: banco com as migrações 1 a 19 e demandas antigas; aplica a 20
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig20-'));
  for (const f of todas.filter((f) => f < m20)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
  const a19 = await abrirBancoTeste({ raizMigracoes: pasta });
  const U = 'b1b1b1b1-9999-4999-8999-b1b1b1b1b1b1', V = 'b2b2b2b2-9999-4999-8999-b2b2b2b2b2b2', N = 'b3b3b3b3-9999-4999-8999-b3b3b3b3b3b3';
  await a19.exec(`insert into auth.users (id, email) values ('${U}', 'ox@teste'), ('${V}', 'oy@teste'), ('${N}', 'on@teste')`);
  await a19.exec("insert into dmanda_privado.acesso_autorizado (email) values ('ox@teste'), ('oy@teste')");
  const ua = (f, a) => chamarComoUsuario(a19, U, f, a);
  const antiga1 = await ua('criar_demanda', { p: { assunto: 'Antiga A', tipo: 'Ofício', numero: '32/2026', origem: 'Prefeita' } });
  const antiga2 = await ua('criar_demanda', { p: { assunto: 'Antiga B', numero: '2024/1250', origem: 'Secretaria de Obras' } });
  const antiga3 = await ua('criar_demanda', { p: { assunto: 'Antiga C', tipo: 'Memorando', numero: 'sem formato', origem: '  prefeita ' } });
  const antes = JSON.stringify((await a19.query('select id, tipo, numero, origem, assunto, etapa, prazo, versao, atualizado_em from public.demandas order by assunto')).rows);
  const tarefasAntes = JSON.stringify((await a19.query('select id, texto, demanda_id from public.tarefas order by id')).rows);
  const aclAntes = JSON.stringify((await a19.query("select p.oid::regprocedure::text as f, p.prosecdef, p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and p.proname not in ('criar_demanda','atualizar_demanda') order by 1")).rows);
  ok(antiga1.tipo === 'Ofício' && antiga2.tipo === 'Processo', 'migração 20 (antes): no banco 1 a 19 o tipo ainda é obrigatório (sem tipo vira Processo)');
  await a19.exec(readFileSync(join('supabase/migrations', m20), 'utf8'));
  const depois = JSON.stringify((await a19.query('select id, tipo, numero, origem, assunto, etapa, prazo, versao, atualizado_em from public.demandas order by assunto')).rows);
  ok(depois === antes && JSON.stringify((await a19.query('select id, texto, demanda_id from public.tarefas order by id')).rows) === tarefasAntes, 'migração 20 (upgrade): as demandas e as tarefas antigas ficam idênticas (tipo, número, origem, prazo, versão e carimbo)');
  const novas = (await a19.query("select rapida, documento_ano from public.demandas")).rows;
  ok(novas.length === 3 && novas.every((r) => r.rapida === false && r.documento_ano === null), 'migração 20 (upgrade): as demandas antigas ganham Rápida desligada e nenhum ano confirmado');
  ok(JSON.stringify((await a19.query("select p.oid::regprocedure::text as f, p.prosecdef, p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and p.proname not in ('criar_demanda','atualizar_demanda') order by 1")).rows.filter((r) => !/listar_opcoes|criar_opcao|listar_para_hoje|atualizar_para_hoje/.test(r.f))) === aclAntes, 'migração 20 (upgrade): as demais funções seguem como estavam (definição de segurança e privilégios)');
  const priv = (await a19.query("select has_table_privilege('authenticated','public.opcoes','SELECT') s, has_table_privilege('authenticated','public.opcoes','INSERT') i, has_table_privilege('authenticated','public.opcoes','UPDATE') u, has_table_privilege('authenticated','public.opcoes','DELETE') d, has_table_privilege('anon','public.opcoes','SELECT') a, has_table_privilege('authenticated','public.para_hoje','DELETE') pd, has_table_privilege('authenticated','public.para_hoje','UPDATE') pu, has_table_privilege('anon','public.para_hoje','SELECT') pa")).rows[0];
  const inv = (await a19.query("select proname, prosecdef from pg_proc where proname in ('listar_opcoes','criar_opcao','listar_para_hoje','atualizar_para_hoje','criar_demanda','atualizar_demanda') order by 1")).rows;
  ok(priv.s && priv.i && !priv.u && !priv.d && !priv.a && priv.pd && !priv.pu && !priv.pa && inv.length === 6 && inv.every((p) => p.prosecdef === false), 'migração 20: privilégios mínimos (opções sem UPDATE nem DELETE, vagas sem UPDATE, anon sem acesso) e todas as funções SECURITY INVOKER');

  // ---- opções
  const o1 = await ua('listar_opcoes', {});
  const nomes = (l, c) => l.filter((x) => x.campo === c).map((x) => x.nome);
  ok(['Prefeita', 'Reunião', 'Pedido de colega', 'Iniciativa própria'].every((n) => nomes(o1, 'origem').includes(n)) && nomes(o1, 'origem').includes('Secretaria de Obras') && nomes(o1, 'origem').filter((n) => n.toLowerCase().trim() === 'prefeita').length === 1, 'opções: as origens padrão e as antigas (digitadas nas demandas) aparecem, sem duplicar "Prefeita" escrita de outro jeito');
  ok(['Protocolo', 'Processo', 'Memorando', 'Ofício', 'Pedido de informação', 'Projeto de lei', 'Portaria', 'Outro documento'].every((n) => nomes(o1, 'tipo').includes(n)), 'opções: os oito tipos de documento de antes continuam como opções');
  const nOpc = o1.length;
  const c1 = await ua('criar_opcao', { p_campo: 'origem', p_nome: '  Secretaria   de Educação ' });
  const c2 = await ua('criar_opcao', { p_campo: 'origem', p_nome: 'secretaria de educação' });
  ok(c1.existente === false && c1.nome === 'Secretaria de Educação' && c2.existente === true && c2.id === c1.id, 'opções: criar normaliza os espaços e repetir a criação (ou o mesmo nome em outras letras) devolve a mesma opção, sem duplicar');
  const ps = await Promise.all([ua('criar_opcao', { p_campo: 'tipo', p_nome: 'Certidão' }), ua('criar_opcao', { p_campo: 'tipo', p_nome: 'certidão' })]);
  ok(ps[0].id === ps[1].id && (await ua('listar_opcoes', {})).length === nOpc + 2, 'opções: duas criações simultâneas do mesmo nome geram uma só opção');
  const vazio = await ua('criar_opcao', { p_campo: 'origem', p_nome: '   ' }).then(() => null, (e) => e.message);
  const vazioT = await ua('criar_opcao', { p_campo: 'tipo', p_nome: '' }).then(() => null, (e) => e.message);
  const longo = await ua('criar_opcao', { p_campo: 'origem', p_nome: 'x'.repeat(81) }).then(() => null, (e) => e.message);
  const campo = await ua('criar_opcao', { p_campo: 'outro', p_nome: 'a' }).then(() => null, (e) => e.message);
  ok(/nome da origem/.test(vazio || '') && /nome do tipo/.test(vazioT || '') && /80/.test(longo || '') && /inválido/.test(campo || '') && (await ua('listar_opcoes', {})).length === nOpc + 2, 'opções: nome vazio, longo demais e campo inválido são recusados sem gravar nada');
  ok((await chamarComoUsuario(a19, V, 'listar_opcoes', {})).every((x) => x.nome !== 'Certidão' && x.nome !== 'Secretaria de Obras'), 'opções: outro usuário autorizado não vê as opções do primeiro');
  const naoAut = await chamarComoUsuario(a19, N, 'criar_opcao', { p_campo: 'origem', p_nome: 'Qualquer' }).then(() => null, (e) => e.message);
  ok(/row-level|policy/i.test(naoAut || ''), 'opções: conta não autorizada não grava');

  // ---- demanda sem documento, com origem de reunião, e o documento chegando depois
  const r1 = await ua('criar_demanda', { p: { id: '10000000-0000-4000-8000-000000000001', assunto: 'Pedido verbal', origem: 'Reunião', rapida: true } });
  ok(r1.tipo === null && r1.numero === '' && r1.origem === 'Reunião' && r1.rapida === true && r1.documento_ano === null, 'documento opcional: a demanda nasce de uma reunião, sem tipo nem número, e com a marca Rápida');
  const rep = await ua('criar_demanda', { p: { id: '10000000-0000-4000-8000-000000000001', assunto: 'Pedido verbal', origem: 'Reunião' } });
  ok(rep.id === r1.id && rep.rapida === true && (await a19.query('select count(*)::int n from public.demandas where assunto = $1', ['Pedido verbal'])).rows[0].n === 1, 'documento opcional: repetir o cadastro com o mesmo identificador devolve a mesma demanda');
  const r2 = await ua('atualizar_demanda', { p_id: r1.id, p: { tipo: 'Memorando', numero: '45/2026', documento_ano: 2026 } });
  ok(r2.tipo === 'Memorando' && r2.numero === '45/2026' && r2.origem === 'Reunião' && r2.documento_ano === 2026, 'documento opcional: o memorando chega depois e a origem (reunião) continua');
  const r3 = await ua('atualizar_demanda', { p_id: r1.id, p: { tipo: null, documento_ano: null, rapida: false } });
  ok(r3.tipo === null && r3.documento_ano === null && r3.rapida === false && r3.numero === '45/2026', 'documento opcional: tirar o tipo e o ano confirmado volta ao estado sem documento sem apagar o número informado');
  const r4 = await ua('atualizar_demanda', { p_id: r1.id, p: { tipo: '   ' } });
  ok(r4.tipo === null, 'documento opcional: tipo só com espaços vale como sem tipo');
  const proto = await ua('criar_demanda', { p: { assunto: 'Protocolo de compras', tipo: 'Protocolo', area: 'Compras' } }).then(() => null, (e) => e.message);
  const protoNulo = await ua('criar_demanda', { p: { assunto: 'Sem tipo em compras', area: 'Compras' } }).then((x) => x.area, () => null);
  ok(/Protocolo só pode/.test(proto || '') && protoNulo === 'Compras', 'documento opcional: a regra Protocolo x Compras continua, e a área vale sem tipo');
  const ano = await ua('atualizar_demanda', { p_id: antiga1.id, p: { documento_ano: 2025 } });
  const ano2 = await ua('atualizar_demanda', { p_id: antiga1.id, p: { numero: '99/2027' } });
  ok(ano.documento_ano === 2025 && ano2.documento_ano === 2025 && ano2.numero === '99/2027', 'ano confirmado à mão: sobrevive a uma troca de número (o número fica como informado)');
  const anoRuim = await ua('atualizar_demanda', { p_id: antiga1.id, p: { documento_ano: 1800 } }).then(() => null, (e) => e.message);
  ok(anoRuim !== null && (await ua('buscar_demanda', { p_id: antiga1.id })).documento_ano === 2025, 'ano confirmado à mão: ano fora de 1900 a 2100 é recusado e o anterior fica');
  const salvo = await ua('salvar_demanda', { p_id: antiga2.id, p: { tipo: 'Certidão', rapida: true, origem: 'Reunião' }, p_tarefas: null, p_versao: (await ua('buscar_demanda', { p_id: antiga2.id })).versao });
  ok(salvo.tipo === 'Certidão' && salvo.rapida === true && salvo.origem === 'Reunião', 'salvar_demanda: grava o tipo criado, a marca Rápida e a origem na mesma janela');

  // ---- Para hoje
  const mk = async (u, nome, extra = {}) => (await chamarComoUsuario(a19, u, 'criar_demanda', { p: { assunto: nome, ...extra } })).id;
  const [d1, d2, d3, d4, d5] = [await mk(U, 'PH 1'), await mk(U, 'PH 2'), await mk(U, 'PH 3'), await mk(U, 'PH 4'), await mk(U, 'PH 5')];
  const vagas = async (u = U) => (await chamarComoUsuario(a19, u, 'listar_para_hoje', {})).map((v) => `${v.posicao}:${v.demanda_id}`).join();
  ok(await vagas() === '', 'Para hoje: começa sem vagas');
  const p1 = await ua('atualizar_para_hoje', { p_candidatas: [d1, d2, d3, d4, d5] });
  ok(p1.length === 3 && p1.map((v) => v.demanda_id).join() === [d1, d2, d3].join() && p1.map((v) => v.posicao).join() === '1,2,3', 'Para hoje: com cinco candidatas, as três primeiras ocupam as vagas 1, 2 e 3, na ordem');
  const p2 = await ua('atualizar_para_hoje', { p_candidatas: [d3, d1, d2, d4, d5] });
  ok(JSON.stringify(p2) === JSON.stringify(p1), 'Para hoje: as vagas persistem (IDs e posições) mesmo que a ordem das candidatas mude');
  await ua('concluir_demanda', { p_id: d2 });
  const p3 = await ua('atualizar_para_hoje', { p_candidatas: [d1, d3, d4, d5] });
  ok(p3.map((v) => `${v.posicao}:${v.demanda_id}`).join() === `1:${d1},2:${d4},3:${d3}`, 'Para hoje: ao concluir uma demanda, só a vaga liberada (2) é reposta; as vagas 1 e 3 ficam');
  await ua('arquivar_demanda', { p_id: d1 });
  const p4 = await ua('atualizar_para_hoje', { p_candidatas: [d5] });
  ok(p4.map((v) => `${v.posicao}:${v.demanda_id}`).join() === `1:${d5},2:${d4},3:${d3}`, 'Para hoje: arquivar libera só a sua vaga (1) e as demais ficam intactas');
  await ua('excluir_demanda', { p_id: d3, p_confirmado: true });
  ok((await ua('listar_para_hoje', {})).map((v) => v.posicao).join() === '1,2', 'Para hoje: excluir a demanda remove a sua vaga (3) e não toca nas outras');
  const p5 = await ua('atualizar_para_hoje', { p_candidatas: [d1, d2, d4, d5] });
  ok(p5.length === 2 && p5.every((v) => [d4, d5].includes(v.demanda_id)), 'Para hoje: candidata arquivada ou finalizada não ocupa vaga, e uma já presente não duplica');
  const fora = await ua('atualizar_para_hoje', { p_candidatas: ['nao-e-uuid', '99999999-9999-4999-8999-999999999999'] });
  ok(fora.length === 2, 'Para hoje: identificador inválido ou de demanda inexistente é ignorado');
  const novaA = await mk(U, 'PH A'), novaB = await mk(U, 'PH B');
  const conc = await Promise.all([ua('atualizar_para_hoje', { p_candidatas: [novaA, novaB] }), ua('atualizar_para_hoje', { p_candidatas: [novaB, novaA] }), ua('atualizar_para_hoje', { p_candidatas: [novaA, novaB] })]);
  const finalV = await ua('listar_para_hoje', {});
  ok(finalV.length === 3 && new Set(finalV.map((v) => v.demanda_id)).size === 3 && new Set(finalV.map((v) => v.posicao)).size === 3 && conc.every((v) => v.length === 3), 'Para hoje: três sessões simultâneas preenchem a vaga livre uma só vez, sem demanda ou posição duplicada');
  const dMuitas = await ua('atualizar_para_hoje', { p_candidatas: Array.from({ length: 31 }, () => d4) }).then(() => null, (e) => e.message);
  ok(/inválida/.test(dMuitas || ''), 'Para hoje: lista de candidatas grande demais é recusada');
  // viradas de dia: as vagas não dependem do dia
  const antesDia = await ua('listar_para_hoje', {});
  await a19.query("update public.para_hoje set desde = desde - 3 where user_id = $1", [U]);
  ok(JSON.stringify(await ua('listar_para_hoje', {})) === JSON.stringify(antesDia) && JSON.stringify(await ua('atualizar_para_hoje', { p_candidatas: [] })) === JSON.stringify(antesDia), 'Para hoje: dias depois, as mesmas demandas continuam nas mesmas posições (nada é reescolhido na virada do dia)');
  ok(await vagas(V) === '' && (await chamarComoUsuario(a19, N, 'listar_para_hoje', {})).length === 0, 'Para hoje: outro usuário não vê as vagas do primeiro');
  const alheio = await chamarComoUsuario(a19, V, 'atualizar_para_hoje', { p_candidatas: [novaA] });
  ok(alheio.length === 0, 'Para hoje: demanda de outro usuário não entra nas vagas de quem não é dono dela');
  const fotoMeio = JSON.stringify((await a19.query('select id, tipo, numero, origem, versao from public.demandas order by assunto')).rows);
  await a19.exec(readFileSync(join('supabase/migrations', m20), 'utf8'));
  ok(JSON.stringify((await a19.query('select id, tipo, numero, origem, versao from public.demandas order by assunto')).rows) === fotoMeio && (await ua('listar_opcoes', {})).length === nOpc + 2, 'migração 20: reaplicar é inofensivo');
  await a19.close();
}

// ---------- restauração (restaurar-copia.sql) com o schema da migração 20: cópia v4 gerada ANTES dela e cópia atual ----------
{
  const { mkdtempSync, copyFileSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const SQL = readFileSync('supabase/restaurar-copia.sql', 'utf8');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m20 = todas.find((f) => f.includes('origem_documento_para_hoje'));
  const O = 'c1c1c1c1-8888-4888-8888-c1c1c1c1c1c1', N = 'c2c2c2c2-8888-4888-8888-c2c2c2c2c2c2';
  const preparar = async (d, id, email) => { await d.query('insert into auth.users (id, email) values ($1, $2)', [id, email]); await d.query('insert into dmanda_privado.acesso_autorizado (email) values ($1) on conflict do nothing', [email]); return d; };
  const rodar = async (d, json) => { try { await d.exec(SQL.replace('__COLE_AQUI_O_JSON__', () => JSON.stringify(json))); return null; } catch (e) { return e.message || String(e); } };
  const exportar = async (d, u) => JSON.parse(JSON.stringify({ formato: 'dmanda-exportacao', versao: 4, exportado_em: new Date().toISOString(), fuso: 'America/Sao_Paulo',
    demandas: await chamarComoUsuario(d, u, 'listar_demandas', { p_arquivadas: false }), arquivadas: await chamarComoUsuario(d, u, 'listar_demandas', { p_arquivadas: true }),
    dias_indisponiveis: await chamarComoUsuario(d, u, 'listar_dias_indisponiveis', {}), entradas: await chamarComoUsuario(d, u, 'listar_entradas', { p_arquivadas: false }),
    entradas_arquivadas: await chamarComoUsuario(d, u, 'listar_entradas', { p_arquivadas: true }), eventos: await chamarComoUsuario(d, u, 'listar_eventos', {}) }));
  const conteudo = async (d) => JSON.stringify({
    dem: (await d.query('select id, assunto, tipo, numero, origem, etapa, prazo, prazo_original, rapida, documento_ano, versao from public.demandas order by id')).rows,
    tar: (await d.query('select id, demanda_id, texto, concluida, posicao from public.tarefas order by id')).rows,
    ent: (await d.query('select id, titulo, texto, cor, fixada, arquivada_em, demanda_id, versao from public.entradas order by id')).rows,
    eve: (await d.query('select id, titulo, tipo, data, dia_inteiro, versao from public.eventos order by id')).rows,
    dia: (await d.query('select id, data, descricao from public.dias_indisponiveis order by id')).rows });

  // cópia v4 realmente gerada por um banco com as migrações 1 a 19 (sem a coluna rapida)
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-rest19-'));
  for (const f of todas.filter((f) => f < m20)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
  const velho = await preparar(await abrirBancoTeste({ raizMigracoes: pasta }), O, 'rv@teste');
  const cv = (f, a) => chamarComoUsuario(velho, O, f, a);
  const v1 = await cv('criar_demanda', { p: { assunto: 'Antiga com tipo "á"', tipo: 'Processo', numero: '12/2026', origem: 'TCE-RS', prazo_original: '2026-12-10' } });
  await cv('adicionar_tarefa', { p_demanda: v1.id, p_texto: 'Primeira' }); await cv('adicionar_tarefa', { p_demanda: v1.id, p_texto: 'Segunda' });
  const v2 = await cv('criar_demanda', { p: { assunto: 'Antiga arquivada', tipo: 'Ofício' } }); await cv('arquivar_demanda', { p_id: v2.id });
  await cv('criar_evento', { p: { titulo: 'Reunião antiga', tipo: 'Reunião', data: '2026-12-01', inicio: '09:00' } });
  const en = await cv('criar_entrada', { p: { titulo: 'Virou', texto: 'Conteúdo', cor: 2 } });
  const demEn = await cv('criar_demanda_de_entrada', { p_entrada: en.id, p: { id: 'c3c3c3c3-8888-4888-8888-c3c3c3c3c3c3', assunto: 'Da entrada' } });
  await cv('salvar_dia_indisponivel', { p: { data: '2026-12-25', descricao: 'Natal', categoria: 'Feriado' } });
  const antiga = await exportar(velho, O);
  ok(antiga.demandas.concat(antiga.arquivadas).length === 3 && antiga.demandas.concat(antiga.arquivadas).every((d) => !('rapida' in d)) && antiga.versao === 4, 'restauração 1 a 20: a cópia v4 de teste foi gerada antes da migração 20 e não tem o campo rapida');
  await velho.close();

  const destino = await preparar(await abrirBancoTeste(), N, 'rn@teste');   // schema completo, migrações 1 a 20
  ok(await rodar(destino, antiga) === null, 'restauração 1 a 20: a cópia v4 anterior à migração 20 restaura sem erro no schema com Rápida NOT NULL');
  const r = (await destino.query('select count(*)::int n, count(*) filter (where rapida = false)::int f, count(*) filter (where documento_ano is null)::int a from public.demandas')).rows[0];
  ok(r.n === 3 && r.f === 3 && r.a === 3, 'restauração 1 a 20: as demandas voltam com Rápida desligada e sem ano confirmado');
  const dep = (await destino.query('select (select count(*) from public.tarefas)::int t, (select count(*) from public.entradas)::int e, (select count(*) from public.eventos)::int v, (select count(*) from public.dias_indisponiveis)::int d, (select demanda_id from public.entradas where id = $1) vinc', [en.id])).rows[0];
  ok(dep.t === 2 && dep.e === 1 && dep.v === 1 && dep.d === 1 && dep.vinc === demEn.id, 'restauração 1 a 20: tarefas, entrada com vínculo, evento e dia indisponível voltam');
  ok((await destino.query('select tipo from public.demandas where id = $1', [v1.id])).rows[0].tipo === 'Processo', 'restauração 1 a 20: o tipo e a origem de cada demanda voltam no texto da própria demanda');
  const foto = await conteudo(destino);
  ok(await rodar(destino, antiga) === null && await conteudo(destino) === foto, 'restauração 1 a 20: repetir a restauração não duplica nem altera nada');

  // Rápida presente (true e false), nula e ausente; leitura dos formatos v1 a v3
  const mista = JSON.parse(JSON.stringify(antiga)); mista.demandas[0].rapida = true; mista.arquivadas[0].rapida = false; mista.demandas[1].rapida = null;
  const d2 = await preparar(await abrirBancoTeste(), N, 'rm@teste');
  ok(await rodar(d2, mista) === null, 'restauração 1 a 20: cópia com Rápida true, false, nula e ausente restaura sem erro');
  const m = Object.fromEntries((await d2.query('select id, rapida from public.demandas')).rows.map((x) => [x.id, x.rapida]));
  ok(m[mista.demandas[0].id] === true && m[mista.arquivadas[0].id] === false && m[mista.demandas[1].id] === false, 'restauração 1 a 20: Rápida true é preservada, false e nula viram false');
  const c3 = JSON.parse(JSON.stringify(antiga)); c3.versao = 3; delete c3.eventos; for (const x of c3.demandas.concat(c3.arquivadas)) { delete x.encaminhada_em; delete x.reiterada_em; }
  const c2 = JSON.parse(JSON.stringify(c3)); c2.versao = 2; delete c2.entradas; delete c2.entradas_arquivadas;
  const c1 = JSON.parse(JSON.stringify(c2)); c1.versao = 1; delete c1.dias_indisponiveis; for (const x of c1.demandas.concat(c1.arquivadas)) { delete x.prazo_original; delete x.prazo_ajuste; delete x.prazo_legado; delete x.versao; }
  for (const [vv, cop] of [[3, c3], [2, c2], [1, c1]]) { const dv = await preparar(await abrirBancoTeste(), N, 'rv' + vv + '@teste'); ok(await rodar(dv, cop) === null && (await dv.query('select count(*)::int n from public.demandas')).rows[0].n === 3, 'restauração 1 a 20: o formato v' + vv + ' continua sendo lido'); await dv.close(); }

  // cópia atual (gerada com o schema completo: Rápida, origem e documento associado)
  const atual = await preparar(await abrirBancoTeste(), O, 'ra@teste');
  const ca = (f, a) => chamarComoUsuario(atual, O, f, a);
  const a1 = await ca('criar_demanda', { p: { assunto: 'Rápida sem documento', origem: 'Reunião', rapida: true } });
  const a2 = await ca('criar_demanda', { p: { assunto: 'Tipo personalizado', tipo: 'Certidão', numero: '5/2026', documento_ano: 2026 } });
  await ca('adicionar_tarefa', { p_demanda: a2.id, p_texto: 'Tarefa atual' });
  const cop = await exportar(atual, O);
  ok(cop.demandas.find((x) => x.id === a1.id).rapida === true && cop.demandas.find((x) => x.id === a2.id).documento_ano === 2026, 'restauração 1 a 20: a cópia atual traz Rápida e o ano do documento');
  const dest2 = await preparar(await abrirBancoTeste(), N, 'rb@teste');
  ok(await rodar(dest2, cop) === null, 'restauração 1 a 20: a cópia atual restaura sem erro');
  const q = (await dest2.query('select id, rapida, documento_ano, tipo from public.demandas')).rows;
  ok(q.find((x) => x.id === a1.id).rapida === true && q.find((x) => x.id === a2.id).documento_ano === 2026 && q.find((x) => x.id === a2.id).tipo === 'Certidão', 'restauração 1 a 20: Rápida true, ano do documento e tipo personalizado são preservados');
  const f2 = await conteudo(dest2);
  ok(await rodar(dest2, cop) === null && await conteudo(dest2) === f2, 'restauração 1 a 20: repetir a cópia atual não duplica nem sobrescreve');
  await dest2.query("update public.demandas set assunto = 'ALTERADA DEPOIS', rapida = false where id = $1", [a1.id]);
  ok(await rodar(dest2, cop) === null && (await dest2.query('select assunto, rapida from public.demandas where id = $1', [a1.id])).rows[0].assunto === 'ALTERADA DEPOIS', 'restauração 1 a 20: demanda que já existe não é sobrescrita pela cópia');

  // falha no meio: nada fica gravado
  const quebrada = JSON.parse(JSON.stringify(antiga)); quebrada.eventos[0].data = 'não é data';
  const dq = await preparar(await abrirBancoTeste(), N, 'rq@teste');
  const antesQ = (await dq.query('select (select count(*) from public.demandas)::int d, (select count(*) from public.tarefas)::int t, (select count(*) from public.entradas)::int e')).rows[0];
  ok(await rodar(dq, quebrada) !== null && JSON.stringify((await dq.query('select (select count(*) from public.demandas)::int d, (select count(*) from public.tarefas)::int t, (select count(*) from public.entradas)::int e')).rows[0]) === JSON.stringify(antesQ), 'restauração 1 a 20: falha no meio desfaz tudo (transação única), inclusive demandas e tarefas');
  ok((await dq.query("select tgenabled from pg_trigger where tgname = 'tarefas_versao'")).rows[0].tgenabled === 'O', 'restauração 1 a 20: o gatilho de versão das tarefas continua ligado depois da falha');
  for (const d of [destino, d2, atual, dest2, dq]) await d.close();
}

// ---------- migração 21: prazo pelos botões de dias parte do DIA DO CLIQUE (decisão 31), e a data exibida é a gravada ----------
{
  const { mkdtempSync, copyFileSync, readdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m21 = todas.find((f) => f.includes('prazo_base_do_atalho'));
  const m20 = todas.find((f) => f.includes('origem_documento_para_hoje'));
  ok(!!m21 && !!m20 && todas.indexOf(m21) === todas.indexOf(m20) + 1, 'migração 21: existe, vem logo depois da 20 e as anteriores não foram reescritas (arquivo à parte)');

  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig21-'));
  try {
    for (const f of todas.filter((f) => f < m21)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
    const a20 = await abrirBancoTeste({ raizMigracoes: pasta });
    const U = 'c1c1c1c1-2121-4121-8121-c1c1c1c1c1c1';
    await a20.exec(`insert into auth.users (id, email) values ('${U}', 'p21@teste')`);
    await a20.exec("insert into dmanda_privado.acesso_autorizado (email) values ('p21@teste')");
    const ua = (f, a) => chamarComoUsuario(a20, U, f, a);
    const hoje = (await a20.query('select public.hoje()::text h')).rows[0].h;
    const soma = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

    // ---- antes: o banco da migração 20 ignora a data enviada e recalcula hoje + N (a falha que a migração 21 corrige)
    const antesBase = soma(hoje, -2);
    const dAntes = await ua('criar_demanda', { p: { assunto: 'ANTES da 21', prazo_original: soma(antesBase, 10), prazo_dias: 10 } });
    ok(dAntes.prazo_original === soma(hoje, 10) && dAntes.prazo_base_em === hoje, 'migração 21 (antes): no banco 1 a 20 a data enviada é ignorada e o prazo vira hoje + 10 (a divergência que a 21 corrige)');
    const legada = await ua('criar_demanda', { p: { assunto: 'Atalho feito hoje', prazo_dias: 5 } });
    await ua('criar_demanda', { p: { assunto: 'Prazo à mão', prazo_original: soma(hoje, 40) } });
    await ua('adicionar_tarefa', { p_demanda: legada.id, p_texto: 'Tarefa antiga' });
    const fotoAntes = JSON.stringify((await a20.query('select id, assunto, prazo, prazo_original, prazo_dias, prazo_base_em, prazo_ajuste, etapa, versao, atualizado_em from public.demandas order by assunto')).rows);
    const tarefasAntes = JSON.stringify((await a20.query('select id, texto, demanda_id from public.tarefas order by id')).rows);
    const aclAntes = JSON.stringify((await a20.query("select p.oid::regprocedure::text f, p.prosecdef, p.proacl::text acl from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') order by 1")).rows);

    // ---- upgrade: aplica a 21 sobre dados da 20
    await a20.exec(readFileSync(join('supabase/migrations', m21), 'utf8'));
    ok(JSON.stringify((await a20.query('select id, assunto, prazo, prazo_original, prazo_dias, prazo_base_em, prazo_ajuste, etapa, versao, atualizado_em from public.demandas order by assunto')).rows) === fotoAntes
      && JSON.stringify((await a20.query('select id, texto, demanda_id from public.tarefas order by id')).rows) === tarefasAntes, 'migração 21 (upgrade): as demandas e as tarefas existentes ficam idênticas (prazo, base, versão e carimbo)');
    ok(JSON.stringify((await a20.query("select p.oid::regprocedure::text f, p.prosecdef, p.proacl::text acl from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') order by 1")).rows) === aclAntes, 'migração 21: nenhuma função muda de privilégio nem de modo (continuam as mesmas assinaturas, todas SECURITY INVOKER onde eram)');

    // ---- criar: a base informada é respeitada
    const base = soma(hoje, -2);
    const c1 = await ua('criar_demanda', { p: { assunto: 'Clique de anteontem', prazo_original: soma(base, 10), prazo_dias: 10, prazo_base_em: base } });
    ok(c1.prazo_base_em === base && c1.prazo_dias === 10 && c1.prazo_original === soma(base, 10), 'criar: o prazo parte do dia do clique (anteontem + 10), exatamente a data que a tela mostrava');
    const c2 = await ua('criar_demanda', { p: { assunto: 'Só base e dias', prazo_dias: 20, prazo_base_em: base } });
    ok(c2.prazo_original === soma(base, 20) && c2.prazo_base_em === base, 'criar: sem a data original, base + dias dá o prazo');
    const velha = soma(hoje, -400);
    const c3 = await ua('criar_demanda', { p: { assunto: 'Rascunho de mais de um ano', prazo_original: soma(velha, 30), prazo_dias: 30, prazo_base_em: velha } });
    ok(c3.prazo_base_em === velha && c3.prazo_original === soma(velha, 30), 'criar: não há limite de antiguidade da base (rascunho de 400 dias atrás é preservado)');
    const c4 = await ua('criar_demanda', { p: { assunto: 'Clique de hoje', prazo_original: soma(hoje, 5), prazo_dias: 5, prazo_base_em: hoje } });
    ok(c4.prazo_base_em === hoje && c4.prazo_original === soma(hoje, 5), 'criar: base de hoje (o caso comum) continua igual');
    const erroDe = async (f, a) => { try { await ua(f, a); return null; } catch (e) { return e.message || String(e); } };
    ok(/não pode estar no futuro/.test(await erroDe('criar_demanda', { p: { assunto: 'x', prazo_dias: 10, prazo_base_em: soma(hoje, 1) } })), 'criar: base no futuro é recusada');
    ok(/só vale junto com a quantidade de dias/.test(await erroDe('criar_demanda', { p: { assunto: 'x', prazo_original: soma(hoje, 3), prazo_base_em: hoje } })), 'criar: base sem dias é recusada');
    ok(/não confere com a data-base/.test(await erroDe('criar_demanda', { p: { assunto: 'x', prazo_original: soma(base, 11), prazo_dias: 10, prazo_base_em: base } })), 'criar: data original que não é base + dias é recusada (a exibida e a gravada nunca divergem)');
    ok((await ua('listar_demandas', { p_arquivadas: false })).every((d) => !/^x$/.test(d.assunto)), 'criar: nenhuma demanda é gravada quando a base é recusada');
    // idempotência: repetir a criação com o mesmo identificador devolve a mesma demanda, mesmo com outra base
    const idFixo = 'c2c2c2c2-2121-4121-8121-c2c2c2c2c2c2';
    const i1 = await ua('criar_demanda', { p: { id: idFixo, assunto: 'Idempotente', prazo_original: soma(base, 10), prazo_dias: 10, prazo_base_em: base } });
    const i2 = await ua('criar_demanda', { p: { id: idFixo, assunto: 'Idempotente', prazo_original: soma(hoje, 10), prazo_dias: 10, prazo_base_em: hoje } });
    ok(i1.id === i2.id && i2.prazo_original === soma(base, 10) && (await a20.query("select count(*)::int n from public.demandas where id = $1", [idFixo])).rows[0].n === 1, 'criar: repetir com o mesmo identificador devolve a demanda que já existe, sem duplicar nem trocar a data');
    // sem base: o comportamento antigo (telas antigas): hoje + N, a data enviada é ignorada
    const velhaTela = await ua('criar_demanda', { p: { assunto: 'Tela antiga', prazo_original: soma(hoje, 99), prazo_dias: 10 } });
    ok(velhaTela.prazo_base_em === hoje && velhaTela.prazo_original === soma(hoje, 10), 'criar: sem a base (tela antiga) o comportamento é o de sempre, hoje + N');
    // o vencimento ajustado continua vindo do calendário (sábado e domingo antecipam)
    const dom = (() => { let d = soma(hoje, 5); while (new Date(d + 'T00:00:00Z').getUTCDay() !== 6) d = soma(d, -1); return d; })();   // o sábado mais recente até hoje + 5 (a base, 10 dias antes, nunca fica no futuro)
    const cs = await ua('criar_demanda', { p: { assunto: 'Cai no sábado', prazo_original: dom, prazo_dias: 10, prazo_base_em: soma(dom, -10) } });
    ok(cs.prazo_original === dom && cs.prazo === soma(dom, -1) && /sábado/.test(cs.prazo_ajuste ?? ''), 'criar: o prazo original que cai em sábado continua sendo antecipado para sexta (o vencimento ajustado segue o calendário)');

    // ---- atualizar (edição de Chegada e prazo)
    const alvo = await ua('criar_demanda', { p: { assunto: 'Edição do prazo' } });
    const b2 = soma(hoje, -3);
    const e1 = await ua('atualizar_demanda', { p_id: alvo.id, p: { prazo_original: soma(b2, 10), prazo_dias: 10, prazo_base_em: b2 } });
    ok(e1.prazo_base_em === b2 && e1.prazo_dias === 10 && e1.prazo_original === soma(b2, 10), 'atualizar: o atalho escolhido há 3 dias grava exatamente a data exibida');
    const e2 = await ua('atualizar_demanda', { p_id: alvo.id, p: { prazo_original: soma(b2, 10), chegou_em: soma(hoje, -1) } });
    ok(e2.prazo_base_em === b2 && e2.prazo_dias === 10 && e2.prazo_original === soma(b2, 10), 'atualizar: regravar a mesma data (só mudou outro campo) mantém os dias e a base');
    const e3 = await ua('atualizar_demanda', { p_id: alvo.id, p: { prazo_original: soma(hoje, 10), prazo_dias: 10, prazo_base_em: hoje } });
    ok(e3.prazo_base_em === hoje && e3.prazo_original === soma(hoje, 10), 'atualizar: um novo clique escolhe a nova base');
    const e4 = await ua('atualizar_demanda', { p_id: alvo.id, p: { prazo_original: soma(hoje, 60) } });
    ok(e4.prazo_dias === null && e4.prazo_base_em === null && e4.prazo_original === soma(hoje, 60), 'atualizar: escolher outra data à mão desfaz a referência dos dias');
    ok(/não pode estar no futuro/.test(await erroDe('atualizar_demanda', { p_id: alvo.id, p: { prazo_original: soma(hoje, 11), prazo_dias: 10, prazo_base_em: soma(hoje, 1) } })), 'atualizar: base no futuro é recusada');
    ok(/não confere com a data-base/.test(await erroDe('atualizar_demanda', { p_id: alvo.id, p: { prazo_original: soma(hoje, 12), prazo_dias: 10, prazo_base_em: hoje } })), 'atualizar: data original incoerente é recusada');
    ok(/só vale junto com a quantidade de dias/.test(await erroDe('atualizar_demanda', { p_id: alvo.id, p: { prazo_original: soma(hoje, 5), prazo_base_em: hoje } })), 'atualizar: base sem dias é recusada');
    ok((await ua('buscar_demanda', { p_id: alvo.id })).prazo_original === soma(hoje, 60), 'atualizar: depois das recusas o prazo gravado continua o da última gravação válida');
    // o mesmo caminho do salvamento da janela (salvar_demanda, com versão)
    const sv = await ua('criar_demanda', { p: { assunto: 'Salvar pela janela' } });
    const s1 = await ua('salvar_demanda', { p_id: sv.id, p: { prazo_original: soma(b2, 20), prazo_dias: 20, prazo_base_em: b2 }, p_tarefas: null, p_versao: sv.versao });
    ok(s1.prazo_base_em === b2 && s1.prazo_original === soma(b2, 20), 'salvar_demanda (janela de edição): usa a mesma regra da base do atalho');
    // dia indisponível cadastrado depois: o recálculo continua partindo do prazo original gravado
    await ua('salvar_dia_indisponivel', { p: { data: soma(b2, 20), descricao: 'Feriado fictício', categoria: 'Feriado' } });
    const rec = await ua('buscar_demanda', { p_id: sv.id });
    ok(rec.prazo_original === soma(b2, 20) && rec.prazo_base_em === b2 && rec.prazo !== rec.prazo_original, 'recálculo por dia indisponível: o prazo original e a base ficam, só o vencimento ajustado muda');
    await a20.close();
  } finally { rmSync(pasta, { recursive: true, force: true }); }
}

// ---------- primeira abertura do banco de teste em um checkout novo (pasta-mãe ausente) ----------
// O `dev:teste` abre ./.dados-teste/pg; num checkout novo a pasta .dados-teste não existe e o PGlite não cria a pasta-mãe. A abertura precisa criá-la (nunca apagar nada) e,
// se uma abertura for rejeitada, a próxima chamada precisa tentar de novo em vez de repetir a falha memorizada.
{
  const { mkdtempSync, rmSync, existsSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { abrirUmaVez } = await import('../src/servidor/banco-teste-base.mjs');
  const raiz = mkdtempSync(join(tmpdir(), 'dmanda-primeira-abertura-'));
  try {
    const pasta = join(raiz, 'nao-existe', '.dados-teste', 'pg');
    let aberto = null, falha = null;
    try { aberto = await abrirBancoTeste({ pasta }); } catch (e) { falha = e; }
    ok(falha === null && aberto !== null, `primeira abertura: pasta-mãe ausente é criada e o banco abre${falha ? ' (' + (falha.code || falha.message) + ')' : ''}`);
    if (aberto) {
      const n = (await aberto.query('select (select count(*) from public.demandas)::int d, (select count(*) from public.entradas)::int e, (select count(*) from public.registros_dia)::int r')).rows[0];
      ok(n.d === 0 && n.e === 0 && n.r === 0, 'primeira abertura: um checkout novo nasce com zero demandas, zero entradas e zero registros de humor');
      await aberto.query("insert into auth.users (id, email) values ('99999999-9999-4999-8999-999999999999', 'p@teste')");
      await aberto.close();
      // reabrir a mesma pasta (agora existente, com dados) não apaga nada
      const outra = await abrirBancoTeste({ pasta });
      ok((await outra.query("select count(*)::int n from auth.users where email = 'p@teste'")).rows[0].n === 1 && existsSync(pasta), 'primeira abertura: reabrir a pasta que já existe preserva o que estava gravado');
      await outra.close();
    }
    // pasta-mãe já existente continua funcionando
    const existente = join(raiz, 'ja-existe'); mkdirSync(existente, { recursive: true });
    const b = await abrirBancoTeste({ pasta: join(existente, 'pg') });
    ok((await b.query('select count(*)::int n from public.demandas')).rows[0].n === 0, 'primeira abertura: pasta-mãe que já existia também abre');
    await b.close();

    // abertura rejeitada: a próxima chamada tenta de novo (nada de falha memorizada) e o que deu certo é reaproveitado
    const estado = {}; let chamadas = 0;
    const abrir = async () => { chamadas++; if (chamadas === 1) throw Object.assign(new Error('falha simulada'), { code: 'SIMULADA' }); return { db: 'aberto' }; };
    const r1 = await abrirUmaVez(estado, 'banco', abrir).then(() => 'ok', (e) => e.code);
    const r2 = await abrirUmaVez(estado, 'banco', abrir).then((v) => v.db, (e) => e.code);
    const r3 = await abrirUmaVez(estado, 'banco', abrir).then((v) => v.db, (e) => e.code);
    ok(r1 === 'SIMULADA' && r2 === 'aberto' && r3 === 'aberto' && chamadas === 2, 'abertura rejeitada: a chamada seguinte tenta de novo, e depois que abre ela é reaproveitada (sem abrir duas vezes)');
    const paralelas = {}; let abertas = 0;
    await Promise.all([1, 2, 3].map(() => abrirUmaVez(paralelas, 'banco', async () => { abertas++; await new Promise((r) => setTimeout(r, 30)); return {}; })));
    ok(abertas === 1, 'abertura simultânea: três chamadas ao mesmo tempo abrem o banco uma só vez');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
}

// ================= exemplos fictícios (scripts/semear-exemplos.mjs): cobertura, repetição sem duplicar e recusa de pastas fora de .dados-teste =================
{
  const { rmSync: apagar } = await import('node:fs');
  const { semearExemplos } = await import('./semear-exemplos.mjs');
  const pasta = '.dados-teste/exemplos-teste-banco';
  try {
    const r1 = await semearExemplos(pasta), r2 = await semearExemplos(pasta);
    ok(r1.resumo.map((x) => x.etapa).sort().join() === 'Aguardando Prefeita,Aguardando retorno,Cadastro,Fazendo,Finalizado,Vistos', 'exemplos: as seis etapas permitidas têm demandas');
    ok(r1.resumo.every((x) => x.sem_tarefa === 0 && x.tarefas > 0), 'exemplos: toda demanda tem tarefas');
    ok(JSON.stringify(r1.resumo) === JSON.stringify(r2.resumo), 'exemplos: gerar de novo recria a pasta e não duplica nada');
    ok(await semearExemplos('fora-de-dados-teste').then(() => false, (e) => /dentro de \.dados-teste/.test(e.message)) && await semearExemplos('.dados-teste/pg').then(() => false, (e) => /banco da prévia padrão/.test(e.message)), 'exemplos: recusa pasta fora de .dados-teste e a pasta da prévia padrão (pg)');
    const x = await abrirBancoTeste({ pasta });
    const q = async (sql) => (await x.query(sql)).rows[0].n;
    const abertas = "etapa <> 'Finalizado' and arquivada_em is null";
    ok(await q(`select count(*)::int n from public.demandas where ${abertas} and prazo < public.hoje()`) >= 3 && await q(`select count(*)::int n from public.demandas where ${abertas} and prazo = public.hoje()`) >= 1 && await q(`select count(*)::int n from public.demandas where ${abertas} and prazo > public.hoje()`) >= 3 && await q('select count(*)::int n from public.demandas where prazo is null') >= 2, 'exemplos: atrasadas, vencendo hoje, prazo futuro e sem prazo');
    ok(await q('select count(*)::int n from public.demandas where tipo is null') >= 3 && await q("select count(*)::int n from public.demandas where tipo = 'Ofício'") >= 2 && await q("select count(distinct area)::int n from public.demandas where area in ('Pessoal', 'Geral', 'Compras') and tipo in ('Processo', 'Protocolo')") === 3, 'exemplos: sem documento, Ofício e as áreas Pessoal, Geral e Compras');
    ok(await q("select count(*)::int n from public.demandas where origem = 'Prefeita'") >= 2 && await q("select count(*)::int n from public.demandas where origem = 'Gabinete'") >= 2 && await q('select count(*)::int n from public.entradas where demanda_id is not null') === 1, 'exemplos: origens Prefeita e Gabinete e uma demanda convertida de Entrada');
    ok(await q('select max(length(assunto))::int n from public.demandas') > 150 && await q('select max(c)::int n from (select count(*) c from public.tarefas group by demanda_id) t') === 6, 'exemplos: assunto longo e uma demanda com seis tarefas');
    await x.close();
  } finally { apagar(pasta, { recursive: true, force: true }); }
}

// ---------- migração 22: Para hoje com quatro vagas (decisão 63), sobre um banco da migração 21 com as três vagas já ocupadas ----------
{
  const { mkdtempSync, copyFileSync, readdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m22 = todas.find((f) => f.includes('para_hoje_quatro_vagas')), m21 = todas.find((f) => f.includes('prazo_base_do_atalho'));
  ok(!!m22 && !!m21 && todas.indexOf(m22) === todas.indexOf(m21) + 1, 'migração 22: existe, vem logo depois da 21 e as anteriores não foram reescritas (arquivo à parte)');
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig22-'));
  try {
    for (const f of todas.filter((f) => f < m22)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
    const a = await abrirBancoTeste({ raizMigracoes: pasta });
    const U = 'd1d1d1d1-2222-4222-8222-d1d1d1d1d1d1', O = 'd2d2d2d2-2222-4222-8222-d2d2d2d2d2d2';
    for (const [id, e] of [[U, 'p22@teste'], [O, 'p22b@teste']]) { await a.exec(`insert into auth.users (id, email) values ('${id}', '${e}')`); await a.exec(`insert into dmanda_privado.acesso_autorizado (email) values ('${e}')`); }
    const ua = (f, x) => chamarComoUsuario(a, U, f, x);
    const mk = async (n) => (await ua('criar_demanda', { p: { assunto: n } })).id;
    const [d1, d2, d3, d4, d5, d6] = [await mk('Q1'), await mk('Q2'), await mk('Q3'), await mk('Q4'), await mk('Q5'), await mk('Q6')];
    const txt = (l) => l.map((v) => `${v.posicao}:${v.demanda_id}`).join();
    const lista = async () => txt(await ua('listar_para_hoje', {}));
    const privilegios = async () => JSON.stringify((await a.query("select has_function_privilege('anon', 'public.atualizar_para_hoje(jsonb)', 'execute') an, has_function_privilege('authenticated', 'public.atualizar_para_hoje(jsonb)', 'execute') au, has_table_privilege('authenticated', 'public.para_hoje', 'select') s, has_table_privilege('authenticated', 'public.para_hoje', 'insert') i, has_table_privilege('authenticated', 'public.para_hoje', 'update') u, has_table_privilege('authenticated', 'public.para_hoje', 'delete') d, has_table_privilege('anon', 'public.para_hoje', 'select') ans")).rows[0]);
    const antes = await ua('atualizar_para_hoje', { p_candidatas: [d1, d2, d3, d4, d5] });
    const fotoAntes = txt(antes);
    ok(antes.length === 3 && fotoAntes === `1:${d1},2:${d2},3:${d3}`, 'migração 22 (antes): no banco da 21 só há três vagas, mesmo com cinco candidatas');
    const privAntes = await privilegios();
    const erroPos = await a.query(`insert into public.para_hoje (user_id, posicao, demanda_id) values ('${U}', 4, '${d4}')`).then(() => null, (e) => e.message);
    ok(/check/i.test(erroPos || ''), 'migração 22 (antes): a posição 4 é recusada pela restrição do banco');

    await a.exec(readFileSync(join('supabase/migrations', m22), 'utf8'));
    ok(await lista() === fotoAntes, 'migração 22 (upgrade): as três posições existentes continuam com as mesmas demandas');
    ok(await privilegios() === privAntes, 'migração 22: os privilégios da função e da tabela não mudaram');
    const cheio = await ua('atualizar_para_hoje', { p_candidatas: [d1, d2, d3, d4, d5] });
    ok(txt(cheio) === `${fotoAntes},4:${d4}`, 'migração 22: a quarta vaga é preenchida pela primeira candidata livre, sem mexer nas posições 1 a 3');
    ok(await lista() === `${fotoAntes},4:${d4}` && (await ua('atualizar_para_hoje', { p_candidatas: [d5, d6] })).length === 4, 'migração 22: com quatro vagas cheias nada muda e a quinta candidata fica de fora (persistência após nova leitura)');
    const erro5 = await a.query(`insert into public.para_hoje (user_id, posicao, demanda_id) values ('${U}', 5, '${d5}')`).then(() => null, (e) => e.message);
    ok(/check/i.test(erro5 || ''), 'migração 22: a posição 5 continua recusada');
    const dupPos = await a.query(`insert into public.para_hoje (user_id, posicao, demanda_id) values ('${U}', 1, '${d6}')`).then(() => null, (e) => e.message);
    ok(!!dupPos && await lista() === `${fotoAntes},4:${d4}`, 'migração 22: uma posição ocupada não é sobrescrita');
    await ua('concluir_demanda', { p_id: d2 });
    const rep = await ua('atualizar_para_hoje', { p_candidatas: [d1, d3, d4, d5, d6] });
    ok(txt(rep) === `1:${d1},2:${d5},3:${d3},4:${d4}`, 'migração 22: ao concluir uma demanda só a vaga liberada (2) é reposta; as vagas 1, 3 e 4 ficam');
    await ua('arquivar_demanda', { p_id: d4 });
    const rep4 = await ua('atualizar_para_hoje', { p_candidatas: [d6] });
    ok(txt(rep4) === `1:${d1},2:${d5},3:${d3},4:${d6}`, 'migração 22: arquivar a demanda da quarta vaga libera só a posição 4');
    const antesVazia = await lista();
    ok(txt(await ua('atualizar_para_hoje', { p_candidatas: [] })) === antesVazia && (await ua('atualizar_para_hoje', { p_candidatas: null })).length === 4, 'migração 22: sem candidatas nada muda');
    // concorrência: três sessões simultâneas preenchem uma única vaga livre uma só vez
    await ua('concluir_demanda', { p_id: d3 });
    const n1 = await mk('Q7'), n2 = await mk('Q8');
    const conc = await Promise.all([ua('atualizar_para_hoje', { p_candidatas: [n1, n2] }), ua('atualizar_para_hoje', { p_candidatas: [n2, n1] }), ua('atualizar_para_hoje', { p_candidatas: [n1, n2] })]);
    const fim = await ua('listar_para_hoje', {});
    ok(fim.length === 4 && new Set(fim.map((v) => v.posicao)).size === 4 && new Set(fim.map((v) => v.demanda_id)).size === 4 && conc.every((v) => v.length === 4), 'migração 22: sessões simultâneas ocupam a vaga livre uma só vez, sem posição nem demanda repetida');
    const dono = await chamarComoUsuario(a, O, 'atualizar_para_hoje', { p_candidatas: [n1] });
    ok(dono.length === 0 && (await chamarComoUsuario(a, O, 'listar_para_hoje', {})).length === 0, 'migração 22: outro usuário não vê nem ocupa as vagas do primeiro');
    const foto = await lista();
    await a.exec(readFileSync(join('supabase/migrations', m22), 'utf8'));
    ok(await lista() === foto && await privilegios() === privAntes, 'migração 22: aplicar de novo não muda vagas nem privilégios');
    await a.close();
  } finally { rmSync(pasta, { recursive: true, force: true }); }
}


// ---------- migração 23: Evento externo na Agenda e pagamentos (decisão 64) ----------
{
  const { mkdtempSync, copyFileSync, readdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m23 = todas.find((f) => f.includes('evento_externo_e_pagamentos')), m22 = todas.find((f) => f.includes('para_hoje_quatro_vagas'));
  ok(!!m23 && !!m22 && todas.indexOf(m23) === todas.indexOf(m22) + 1, 'migração 23: existe, vem logo depois da 22 e as anteriores não foram reescritas (arquivo à parte)');
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig23-'));
  try {
    for (const f of todas.filter((f) => f < m23)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
    const a = await abrirBancoTeste({ raizMigracoes: pasta });
    const U = 'e1e1e1e1-3333-4333-8333-e1e1e1e1e1e1', O = 'e2e2e2e2-3333-4333-8333-e2e2e2e2e2e2', X = 'e3e3e3e3-3333-4333-8333-e3e3e3e3e3e3';
    for (const [id, e] of [[U, 'p23@teste'], [O, 'p23b@teste'], [X, 'p23x@teste']]) await a.exec(`insert into auth.users (id, email) values ('${id}', '${e}')`);
    await a.exec("insert into dmanda_privado.acesso_autorizado (email) values ('p23@teste'), ('p23b@teste')");   // X não é autorizado
    const ua = (f, x) => chamarComoUsuario(a, U, f, x), uo = (f, x) => chamarComoUsuario(a, O, f, x), ux = (f, x) => chamarComoUsuario(a, X, f, x);
    const er = async (fn, f, x) => { try { await fn(f, x); return null; } catch (e) { return e.message || String(e); } };
    // antes: os lançamentos anteriores (todos os tipos antigos) e um dia indisponível já existem
    const antigos = [];
    for (const [t, h] of [['Reunião', '09:00'], ['Compromisso', '10:00'], ['Lembrete', '11:00']]) antigos.push((await ua('criar_evento', { p: { titulo: `Antigo ${t}`, tipo: t, data: '2026-12-01', inicio: h } })).id);
    await ua('salvar_dia_indisponivel', { p: { data: '2026-12-25', descricao: 'Natal', categoria: 'Feriado' } });
    ok(/Escolha o tipo/.test(await er(ua, 'criar_evento', { p: { titulo: 'x', tipo: 'Evento externo', data: '2026-12-02', inicio: '09:00' } })), 'migração 23 (antes): o tipo Evento externo ainda é recusado');
    const foto = async () => JSON.stringify({
      ev: (await a.query('select id, titulo, tipo, data, dia_inteiro, inicio, fim, versao, criado_em from public.eventos order by id')).rows,
      di: (await a.query('select id, data, descricao, categoria from public.dias_indisponiveis order by id')).rows });
    const privilegios = async () => JSON.stringify((await a.query(`select has_function_privilege('anon', 'public.salvar_pagamento(jsonb)', 'execute') an, has_function_privilege('authenticated', 'public.salvar_pagamento(jsonb)', 'execute') au,
      has_function_privilege('anon', 'public.conferir_evento(text, text, boolean, text, text, text, integer)', 'execute') ean, has_function_privilege('authenticated', 'public.listar_pagamentos()', 'execute') lau,
      has_table_privilege('anon', 'public.pagamentos', 'select') ts, has_table_privilege('authenticated', 'public.pagamentos', 'select') tas`)).rows);
    const fotoAntes = await foto();
    await a.exec(readFileSync(join('supabase/migrations', m23), 'utf8'));
    ok(await foto() === fotoAntes, 'migração 23: os eventos e os dias indisponíveis anteriores ficam idênticos (nenhum dado tocado)');
    ok((await ua('listar_eventos', {})).filter((e) => antigos.includes(e.id)).length === 3, 'migração 23: Reunião, Compromisso e Lembrete anteriores continuam listados e editáveis');
    const privDepois = await privilegios();

    // evento externo: com horário e de dia inteiro
    const ex1 = await ua('criar_evento', { p: { titulo: 'Congresso AMVARS', tipo: 'Evento externo', data: '2026-12-02', inicio: '09:00', fim: '12:00' } });
    const ex2 = await ua('criar_evento', { p: { titulo: 'Feira regional', tipo: 'Evento externo', data: '2026-12-03', dia_inteiro: true } });
    ok(ex1.tipo === 'Evento externo' && ex1.inicio === '09:00' && ex2.tipo === 'Evento externo' && ex2.dia_inteiro === true, 'migração 23: Evento externo vale com horário e de dia inteiro');
    ok(/Escolha o tipo/.test(await er(ua, 'criar_evento', { p: { titulo: 'x', tipo: 'Outro', data: '2026-12-02', inicio: '09:00' } })) && /Informe o horário/.test(await er(ua, 'criar_evento', { p: { titulo: 'x', tipo: 'Evento externo', data: '2026-12-02' } })), 'migração 23: tipo desconhecido e evento externo sem horário nem dia inteiro continuam recusados');
    const alt = await ua('salvar_evento', { p_id: antigos[0], p: { tipo: 'Evento externo' }, p_versao: 1 });
    ok(alt.tipo === 'Evento externo' && alt.versao === 2, 'migração 23: um evento anterior pode mudar para Evento externo (versão sobe)');
    // o evento externo da Agenda NÃO antecipa vencimento; o dia indisponível sim (regra vigente, não mudou)
    const dv = await ua('criar_demanda', { p: { assunto: 'Prazo no dia do evento externo', prazo_original: '2026-12-03' } });
    ok(dv.prazo === '2026-12-03' && dv.prazo_ajuste === null, 'migração 23: o evento externo (com horário ou de dia inteiro) da Agenda não antecipa o vencimento');
    await ua('salvar_dia_indisponivel', { p: { data: '2026-12-10', descricao: 'Congresso fora', categoria: 'Evento externo' } });
    const dv2 = await ua('criar_demanda', { p: { assunto: 'Prazo no dia indisponível', prazo_original: '2026-12-10' } });
    ok(dv2.prazo === '2026-12-09' && /evento externo: Congresso fora/.test(dv2.prazo_ajuste || ''), 'migração 23: o evento externo cadastrado em Dias indisponíveis segue antecipando o vencimento');

    // pagamentos
    ok((await ua('listar_pagamentos', {})).length === 0, 'pagamentos: começa sem nenhuma data');
    const p1 = await ua('salvar_pagamento', { p: { data: '2026-12-05' } });
    ok(!!p1.id && p1.data === '2026-12-05' && Object.keys(p1).join() === 'id,data,criado_em', 'pagamentos: cria só com a data (sem valor, sem recorrência)');
    const p1b = await ua('salvar_pagamento', { p: { data: '2026-12-05' } });
    ok(p1b.id === p1.id && (await ua('listar_pagamentos', {})).length === 1, 'pagamentos: criar a mesma data de novo (clique repetido ou resposta perdida) devolve a que existe, sem duplicar nem dar erro');
    const p2 = await ua('salvar_pagamento', { p: { data: '2027-01-05' } });
    ok((await ua('listar_pagamentos', {})).map((x) => x.data).join() === '2026-12-05,2027-01-05', 'pagamentos: listados em ordem de data');
    const ed = await ua('salvar_pagamento', { p: { id: p2.id, data: '2027-01-08' } });
    ok(ed.id === p2.id && ed.data === '2027-01-08' && (await ua('listar_pagamentos', {})).length === 2, 'pagamentos: edita a data do próprio registro');
    ok(/Já existe um pagamento/.test(await er(ua, 'salvar_pagamento', { p: { id: p2.id, data: '2026-12-05' } })), 'pagamentos: mudar para uma data que já está cadastrada é recusado');
    ok((await ua('salvar_pagamento', { p: { id: p2.id, data: '2027-01-08' } })).data === '2027-01-08', 'pagamentos: salvar o mesmo valor de novo é inofensivo');
    ok(/Informe a data/.test(await er(ua, 'salvar_pagamento', { p: {} })) && !!(await er(ua, 'salvar_pagamento', { p: { data: '2026-02-30' } })) && !!(await er(ua, 'salvar_pagamento', { p: { data: 'amanhã' } })), 'pagamentos: sem data e data que não existe no calendário são recusadas');
    ok(/não encontrado/.test(await er(ua, 'salvar_pagamento', { p: { id: '99999999-9999-4999-8999-999999999999', data: '2027-03-05' } })), 'pagamentos: alterar um registro que não existe é recusado');
    // isolamento
    ok((await uo('listar_pagamentos', {})).length === 0, 'RLS: outro usuário não vê os pagamentos');
    ok(/não encontrado/.test(await er(uo, 'salvar_pagamento', { p: { id: p1.id, data: '2026-12-06' } })) && (await ua('listar_pagamentos', {}))[0].data === '2026-12-05', 'RLS: outro usuário não altera o pagamento alheio');
    await uo('excluir_pagamento', { p_id: p1.id });
    ok((await ua('listar_pagamentos', {})).length === 2, 'RLS: outro usuário não exclui o pagamento alheio (a chamada não faz nada)');
    ok((await uo('salvar_pagamento', { p: { data: '2026-12-05' } })).id !== p1.id, 'RLS: cada usuário pode ter a mesma data (a unicidade é por usuário)');
    ok(!!(await er(ux, 'salvar_pagamento', { p: { data: '2026-12-05' } })) && (await a.query(`select count(*)::int n from public.pagamentos where user_id = '${X}'`)).rows[0].n === 0, 'conta fora da lista autorizada: não grava pagamento (terceira camada)');
    const anon = await a.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query('select public.listar_pagamentos()'); return null; } catch (e) { return e.message; } });
    const anonT = await a.transaction(async (tx) => { try { await tx.exec('set local role anon'); await tx.query('select * from public.pagamentos'); return null; } catch (e) { return e.message; } });
    ok(/permission denied/i.test(anon || '') && /permission denied/i.test(anonT || ''), 'pagamentos: sem login (papel anon) não executa as funções nem lê a tabela');
    const pv = JSON.parse(privDepois)[0];
    ok(pv.an === false && pv.au === true && pv.ean === false && pv.lau === true && pv.ts === false && pv.tas === true, 'pagamentos: só o usuário logado executa as funções; anon não lê a tabela');
    // excluir
    const ex = await ua('excluir_pagamento', { p_id: p2.id });
    ok(ex.excluido === true && (await ua('listar_pagamentos', {})).length === 1, 'pagamentos: exclui a data');
    ok((await ua('excluir_pagamento', { p_id: p2.id })).excluido === true && (await ua('listar_pagamentos', {})).length === 1, 'pagamentos: excluir de novo (resposta perdida) não é erro nem mexe no resto');
    // reaplicar a migração não muda nada
    const fotoFim = await foto(), listaFim = JSON.stringify(await ua('listar_pagamentos', {}));
    await a.exec(readFileSync(join('supabase/migrations', m23), 'utf8'));
    ok(await foto() === fotoFim && JSON.stringify(await ua('listar_pagamentos', {})) === listaFim && await privilegios() === privDepois, 'migração 23: aplicar de novo não muda eventos, pagamentos nem privilégios');
    await a.close();
  } finally { rmSync(pasta, { recursive: true, force: true }); }
}

// ---------- cópia versão 5 (pagamentos): exporta e restaura ----------
{
  const SQL = readFileSync('supabase/restaurar-copia.sql', 'utf8');
  const O = 'f1f1f1f1-4444-4444-8444-f1f1f1f1f1f1', N = 'f2f2f2f2-4444-4444-8444-f2f2f2f2f2f2';
  const preparar = async (d, id, email) => { await d.query('insert into auth.users (id, email) values ($1, $2)', [id, email]); await d.query('insert into dmanda_privado.acesso_autorizado (email) values ($1) on conflict do nothing', [email]); return d; };
  const origem = await preparar(await abrirBancoTeste(), O, 'c5o@teste');
  const co = (f, a) => chamarComoUsuario(origem, O, f, a);
  await co('salvar_pagamento', { p: { data: '2026-12-05' } }); await co('salvar_pagamento', { p: { data: '2027-01-05' } });
  await co('criar_evento', { p: { titulo: 'Externo', tipo: 'Evento externo', data: '2026-12-02', dia_inteiro: true } });
  const copia = JSON.parse(JSON.stringify({ formato: 'dmanda-exportacao', versao: 5, exportado_em: new Date().toISOString(), fuso: 'America/Sao_Paulo', demandas: [], arquivadas: [], dias_indisponiveis: [], entradas: [], entradas_arquivadas: [],
    eventos: await co('listar_eventos', {}), pagamentos: await co('listar_pagamentos', {}) }));
  const destino = await preparar(await abrirBancoTeste(), N, 'c5n@teste');
  const rodar = async (d, j) => { try { await d.exec(SQL.replace('__COLE_AQUI_O_JSON__', () => JSON.stringify(j))); return null; } catch (e) { return e.message || String(e); } };
  ok(await rodar(destino, copia) === null, 'cópia v5: restaura sem erro (pagamentos e evento externo)');
  const dp = await chamarComoUsuario(destino, N, 'listar_pagamentos', {}), de = await chamarComoUsuario(destino, N, 'listar_eventos', {});
  ok(dp.map((x) => x.data).join() === '2026-12-05,2027-01-05' && dp.map((x) => x.id).join() === copia.pagamentos.map((x) => x.id).join() && de.length === 1 && de[0].tipo === 'Evento externo', 'cópia v5: as datas de pagamento e o evento externo voltam como estavam');
  ok(await rodar(destino, copia) === null && (await chamarComoUsuario(destino, N, 'listar_pagamentos', {})).length === 2, 'cópia v5: restaurar de novo não duplica as datas de pagamento');
  const antiga = { ...copia, versao: 4 }; delete antiga.pagamentos;
  ok(await rodar(await preparar(await abrirBancoTeste(), 'f3f3f3f3-4444-4444-8444-f3f3f3f3f3f3', 'c5v@teste'), antiga) === null, 'cópia v4 (sem a lista de pagamentos) continua restaurável no schema atual');
  ok(/versão 1, 2, 3, 4 ou 5/.test(await rodar(await preparar(await abrirBancoTeste(), 'f4f4f4f4-4444-4444-8444-f4f4f4f4f4f4', 'c5x@teste'), { ...copia, versao: 6 }) || ''), 'cópia: a versão 6 é recusada com mensagem clara');
}

// ---------- migração 24: transições de conclusão e reabertura para os dados de evolução (decisão 65) ----------
{
  const { mkdtempSync, copyFileSync, readdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { calcularMetricas } = await import('../src/lib/metricas.ts');
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const m24 = todas.find((f) => f.includes('transicoes_demanda')), m23 = todas.find((f) => f.includes('evento_externo_e_pagamentos'));
  ok(!!m24 && !!m23 && todas.indexOf(m24) === todas.indexOf(m23) + 1, 'migração 24: existe, vem logo depois da 23 e as anteriores não foram reescritas (arquivo à parte)');
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig24-'));
  try {
    for (const f of todas.filter((f) => f < m24)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
    const a = await abrirBancoTeste({ raizMigracoes: pasta });
    const U = 'd1d1d1d1-5555-4555-8555-d1d1d1d1d1d1', O = 'd2d2d2d2-5555-4555-8555-d2d2d2d2d2d2', X = 'd3d3d3d3-5555-4555-8555-d3d3d3d3d3d3';
    for (const [id, e] of [[U, 'p24@teste'], [O, 'p24b@teste'], [X, 'p24x@teste']]) await a.exec(`insert into auth.users (id, email) values ('${id}', '${e}')`);
    await a.exec("insert into dmanda_privado.acesso_autorizado (email) values ('p24@teste'), ('p24b@teste')");   // X não é autorizado
    const ua = (f, x) => chamarComoUsuario(a, U, f, x), uo = (f, x) => chamarComoUsuario(a, O, f, x), ux = (f, x) => chamarComoUsuario(a, X, f, x);
    const er = async (fn, f, x) => { try { await fn(f, x); return null; } catch (e) { return e.message || String(e); } };
    const hoje = (await a.query('select public.hoje()::text as h')).rows[0].h;
    // antes da migração: uma demanda já finalizada (legado, sem histórico), uma aberta e uma de outro usuário
    const legado = await ua('criar_demanda', { p: { assunto: 'Legado finalizada', chegou_em: '2026-10-01' } }); await ua('concluir_demanda', { p_id: legado.id });
    const viva = await ua('criar_demanda', { p: { assunto: 'Viva', chegou_em: '2026-10-20' } });
    const alheia = await uo('criar_demanda', { p: { assunto: 'Do outro usuário' } });
    ok((await er(ua, 'listar_transicoes_demanda', {}) || '').length > 0, 'migração 24 (antes): a função de leitura ainda não existe');
    const fotoAntes = JSON.stringify(await ua('listar_demandas', { p_arquivadas: false }));
    await a.exec(readFileSync(join('supabase/migrations', m24), 'utf8'));
    const t0 = await ua('listar_transicoes_demanda', {});
    ok(t0.transicoes.length === 0 && t0.desde === hoje && JSON.stringify(await ua('listar_demandas', { p_arquivadas: false })) === fotoAntes, 'migração 24: nenhum dado existente é tocado e nenhuma transição antiga é inventada; a coleta ganha a data de início (hoje)');
    // concluir grava uma conclusão (ciclo 1), no dia de Brasília, na mesma transação
    await ua('mover_etapa', { p_id: viva.id, p_etapa: 'Fazendo' });
    ok((await ua('listar_transicoes_demanda', {})).transicoes.length === 0, 'mudar de etapa sem concluir nem reabrir não grava nada');
    await ua('concluir_demanda', { p_id: viva.id });
    let t = (await ua('listar_transicoes_demanda', {})).transicoes;
    ok(t.length === 1 && t[0].tipo === 'conclusao' && t[0].ciclo === 1 && t[0].dia === hoje && t[0].etapa_anterior === 'Fazendo' && t[0].etapa_nova === 'Finalizado' && t[0].concluida_em_anterior === null, 'concluir grava uma conclusão (ciclo 1) com o dia de Brasília e as etapas');
    await ua('concluir_demanda', { p_id: viva.id }); await ua('concluir_demanda', { p_id: viva.id });
    ok((await ua('listar_transicoes_demanda', {})).transicoes.length === 1, 'concluir de novo uma demanda já finalizada (clique repetido, resposta perdida) não duplica a conclusão');
    // reabrir grava a reabertura do ciclo 1 e preserva a data da conclusão desfeita
    await ua('reabrir_demanda', { p_id: viva.id, p_etapa: 'Fazendo' });
    t = (await ua('listar_transicoes_demanda', {})).transicoes;
    ok(t.length === 2 && t[1].tipo === 'reabertura' && t[1].ciclo === 1 && t[1].concluida_em_anterior === hoje && t[1].etapa_anterior === 'Finalizado' && t[1].etapa_nova === 'Fazendo', 'reabrir grava a reabertura do ciclo 1 e guarda a data da conclusão desfeita');
    ok((await ua('listar_demandas', { p_arquivadas: false })).find((d) => d.id === viva.id).concluida_em === null, 'o estado da demanda continua como era (concluida_em volta a vazio), mas o histórico fica na tabela');
    // outro caminho (mover_etapa para Finalizado e depois para outra etapa) vale igual; segunda conclusão é o ciclo 2
    await ua('mover_etapa', { p_id: viva.id, p_etapa: 'Finalizado' }); await ua('mover_etapa', { p_id: viva.id, p_etapa: 'Vistos' });
    t = (await ua('listar_transicoes_demanda', {})).transicoes;
    ok(t.length === 4 && t[2].tipo === 'conclusao' && t[2].ciclo === 2 && t[3].tipo === 'reabertura' && t[3].ciclo === 2, 'a segunda conclusão é o ciclo 2 e a reabertura seguinte também (mover_etapa vale como concluir e reabrir)');
    // salvar a demanda sem mudar a etapa não grava
    await ua('salvar_demanda', { p_id: viva.id, p: { assunto: 'Viva editada' }, p_tarefas: null, p_versao: (await ua('listar_demandas', { p_arquivadas: false })).find((d) => d.id === viva.id).versao });
    ok((await ua('listar_transicoes_demanda', {})).transicoes.length === 4, 'editar a demanda sem mudar a etapa não grava transição');
    // demanda que já estava finalizada antes da coleta: a reabertura leva ciclo 0 e a data comprovada da conclusão antiga
    const dataLegado = (await ua('listar_demandas', { p_arquivadas: false })).find((d) => d.id === legado.id).concluida_em;
    await ua('reabrir_demanda', { p_id: legado.id, p_etapa: 'Fazendo' });
    t = (await ua('listar_transicoes_demanda', {})).transicoes.filter((x) => x.demanda_id === legado.id);
    ok(t.length === 1 && t[0].tipo === 'reabertura' && t[0].ciclo === 0 && t[0].concluida_em_anterior === dataLegado, 'demanda finalizada antes da coleta: a reabertura tem ciclo 0 e guarda a data comprovada (sem inventar uma conclusão que não foi gravada)');
    await ua('concluir_demanda', { p_id: legado.id }); await ua('reabrir_demanda', { p_id: legado.id, p_etapa: 'Vistos' });
    t = (await ua('listar_transicoes_demanda', {})).transicoes.filter((x) => x.demanda_id === legado.id);
    ok(t.map((x) => `${x.tipo}:${x.ciclo}`).join() === 'reabertura:0,conclusao:1,reabertura:1', `depois disso o legado segue a numeração normal (${t.map((x) => `${x.tipo}:${x.ciclo}`).join()})`);
    // unicidade: a mesma transição não entra duas vezes, mesmo por outro caminho
    const dup = (await a.query("select count(*)::int as n from (select demanda_id, tipo, ciclo from public.demanda_transicoes group by 1, 2, 3 having count(*) > 1) x")).rows[0].n;
    let semDup = null; try { await a.query("insert into public.demanda_transicoes (user_id, demanda_id, tipo, ciclo, dia, etapa_anterior, etapa_nova) values ($1, $2, 'conclusao', 1, public.hoje(), 'Fazendo', 'Finalizado')", [U, viva.id]); } catch (e) { semDup = e.message; }
    ok(dup === 0 && /unique|duplicate|demanda_transicoes_unica/i.test(semDup || ''), 'a unicidade (demanda, tipo, ciclo) impede a mesma transição de entrar duas vezes');
    // isolamento e permissões: só lê as próprias; ninguém grava direto; conta não autorizada não lê
    const ids = (r) => r.transicoes.map((x) => x.demanda_id);
    await uo('concluir_demanda', { p_id: alheia.id });
    ok(ids(await uo('listar_transicoes_demanda', {})).join() === alheia.id && !ids(await ua('listar_transicoes_demanda', {})).includes(alheia.id), 'cada usuário lê só as próprias transições');
    ok((await ux('listar_transicoes_demanda', {})).transicoes.length === 0, 'a conta não autorizada não lê nenhuma transição (RLS)');
    const sql = async (q) => a.transaction(async (tx) => { await entrarComo(tx, U); try { await tx.query(q); return null; } catch (e) { return e.message; } });
    ok(/permission denied|row-level/i.test(await sql(`insert into public.demanda_transicoes (user_id, demanda_id, tipo, ciclo, dia, etapa_anterior, etapa_nova) values ('${U}', '${viva.id}', 'conclusao', 9, public.hoje(), 'a', 'b')`)) && /permission denied|row-level/i.test(await sql(`update public.demanda_transicoes set ciclo = 8`)) && /permission denied|row-level/i.test(await sql('delete from public.demanda_transicoes')) && /permission denied|row-level/i.test(await sql("update public.coleta_marcos set dia = '2020-01-01'")), 'o usuário não grava, altera nem apaga transições nem o marco da coleta (só o gatilho grava)');
    const anon = await a.transaction(async (tx) => { await tx.exec('set local role anon'); try { await tx.query('select * from public.demanda_transicoes'); return null; } catch (e) { return e.message; } });
    ok(/permission denied/i.test(anon || '') && /permission denied/i.test(await er(async () => { await a.transaction(async (tx) => { await tx.exec('set local role anon'); await tx.query('select public.listar_transicoes_demanda()'); }); })), 'sem login (papel anon) não lê as transições');
    // métricas calculadas dos dados reais do teste (abertas e arquivadas)
    const dems = [...await ua('listar_demandas', { p_arquivadas: false }), ...await ua('listar_demandas', { p_arquivadas: true })];
    const m = calcularMetricas(dems, await ua('listar_transicoes_demanda', {}), hoje);
    ok(m.totais.conclusoesCiclos === 3 && m.totais.conclusoesDemandas === 2 && m.totais.reaberturasCiclos === 4 && m.totais.reaberturasDemandas === 2 && m.totais.conclusoesLegadasCiclos === 1 && m.confiavelDesde.conclusoesRegistradas === hoje, `métricas do banco: 2 demandas com 3 ciclos de conclusão registrados, 4 reaberturas, 1 conclusão legada comprovada, coleta confiável desde hoje (${JSON.stringify(m.totais)})`);
    // numeração robusta a lacunas: sem a conclusão de ciclo 1 gravada, a próxima conclusão continua numerada pelo maior ciclo e nenhuma transição se perde
    const gap = await ua('criar_demanda', { p: { assunto: 'Com lacuna' } });
    await ua('concluir_demanda', { p_id: gap.id }); await ua('reabrir_demanda', { p_id: gap.id, p_etapa: 'Fazendo' }); await ua('concluir_demanda', { p_id: gap.id });
    await a.exec(`delete from public.demanda_transicoes where demanda_id = '${gap.id}' and tipo = 'conclusao' and ciclo = 1`);
    await ua('reabrir_demanda', { p_id: gap.id, p_etapa: 'Fazendo' }); await ua('concluir_demanda', { p_id: gap.id });
    const tg = (await ua('listar_transicoes_demanda', {})).transicoes.filter((x) => x.demanda_id === gap.id).map((x) => `${x.tipo}:${x.ciclo}`);
    ok(tg.join() === 'reabertura:1,conclusao:2,reabertura:2,conclusao:3', `com uma linha faltando, as transições seguintes não colidem nem somem (${tg.join()})`);
    // excluir a demanda leva o histórico junto
    await ua('excluir_demanda', { p_id: viva.id, p_confirmado: true });
    ok(!ids(await ua('listar_transicoes_demanda', {})).includes(viva.id), 'excluir a demanda leva as transições dela junto (sem linhas soltas)');
    // reaplicar a migração não muda nada (nem a data de início da coleta)
    const antesRe = JSON.stringify(await ua('listar_transicoes_demanda', {}));
    await a.exec(readFileSync(join('supabase/migrations', m24), 'utf8'));
    ok(JSON.stringify(await ua('listar_transicoes_demanda', {})) === antesRe, 'migração 24: aplicar de novo não muda as transições nem a data de início da coleta');
    await a.close();
  } finally { rmSync(pasta, { recursive: true, force: true }); }
}

// ---------- cópia v5 e as transições da migração 24: restaurar na mesma base e numa base vazia (decisão 65) ----------
{
  const { calcularMetricas } = await import('../src/lib/metricas.ts');
  const SQL = readFileSync('supabase/restaurar-copia.sql', 'utf8');
  const S = 'c1c1c1c1-6666-4666-8666-c1c1c1c1c1c1', N = 'c2c2c2c2-6666-4666-8666-c2c2c2c2c2c2';
  const preparar = async (d, id, email) => { await d.query('insert into auth.users (id, email) values ($1, $2)', [id, email]); await d.query('insert into dmanda_privado.acesso_autorizado (email) values ($1) on conflict do nothing', [email]); return d; };
  const rodar = async (d, j) => { try { await d.exec(SQL.replace('__COLE_AQUI_O_JSON__', () => JSON.stringify(j))); return null; } catch (e) { return e.message || String(e); } };
  const origem = await preparar(await abrirBancoTeste(), S, 'ct24o@teste');
  const co = (f, a) => chamarComoUsuario(origem, S, f, a);
  const hoje = (await origem.query('select public.hoje()::text as h')).rows[0].h;
  const d1 = await co('criar_demanda', { p: { assunto: 'Com histórico', chegou_em: '2026-10-01' } });
  await co('concluir_demanda', { p_id: d1.id }); await co('reabrir_demanda', { p_id: d1.id, p_etapa: 'Fazendo' }); await co('concluir_demanda', { p_id: d1.id });
  const d2 = await co('criar_demanda', { p: { assunto: 'Aberta', chegou_em: '2026-10-05' } });
  const antes = await co('listar_transicoes_demanda', {});
  ok(antes.transicoes.map((t) => `${t.tipo}:${t.ciclo}`).join() === 'conclusao:1,reabertura:1,conclusao:2', 'cópia e transições: a origem tem 2 conclusões e 1 reabertura gravadas');
  const copia = JSON.parse(JSON.stringify({ formato: 'dmanda-exportacao', versao: 5, exportado_em: new Date().toISOString(), fuso: 'America/Sao_Paulo', demandas: await co('listar_demandas', { p_arquivadas: false }), arquivadas: [], dias_indisponiveis: [], entradas: [], entradas_arquivadas: [], eventos: [], pagamentos: [] }));
  ok(!('transicoes' in copia), 'a cópia v5 não inclui as transições (só o estado das demandas)');
  // 1) mesma base: nada muda (as demandas já existem, nada é atualizado, o gatilho não dispara)
  ok(await rodar(origem, copia) === null, 'cópia v5 restaurada na mesma base: sem erro');
  const depois = await co('listar_transicoes_demanda', {});
  ok(JSON.stringify(depois) === JSON.stringify(antes), 'mesma base: as transições continuam exatamente as mesmas (nenhuma apagada, nenhuma duplicada, data de início da coleta igual)');
  // 2) base vazia: as demandas voltam, as transições não (e nada é inventado)
  const vazia = await preparar(await abrirBancoTeste(), N, 'ct24n@teste');
  const cv = (f, a) => chamarComoUsuario(vazia, N, f, a);
  ok(await rodar(vazia, copia) === null, 'cópia v5 restaurada em base vazia: sem erro');
  const tv = await cv('listar_transicoes_demanda', {}), dv = [...await cv('listar_demandas', { p_arquivadas: false })];
  ok(dv.length === 2 && tv.transicoes.length === 0 && tv.desde === hoje, `base vazia: as 2 demandas voltam e nenhuma transição é inventada; a coleta começa hoje (${tv.transicoes.length} transições)`);
  const mv = calcularMetricas(dv, tv, hoje), mo = calcularMetricas([...await co('listar_demandas', { p_arquivadas: false })], antes, hoje);
  ok(mo.totais.conclusoesCiclos === 2 && mo.totais.reaberturasCiclos === 1 && mv.totais.conclusoesCiclos === 0 && mv.totais.reaberturasCiclos === 0 && mv.totais.conclusoesLegadasCiclos === 1 && mv.chegadaAteConclusao.casos === 1, `perda medida: a origem tinha 2 ciclos e 1 reabertura; a base restaurada só tem a conclusão atual como legado comprovada (${JSON.stringify(mv.totais)})`);
  // depois de restaurar, o histórico volta a ser gravado normalmente (a reabertura de uma demanda restaurada é ciclo 0 com a data antiga)
  const finalizada = dv.find((d) => d.etapa === 'Finalizado');
  await cv('reabrir_demanda', { p_id: finalizada.id, p_etapa: 'Fazendo' });
  const t2 = (await cv('listar_transicoes_demanda', {})).transicoes;
  ok(t2.length === 1 && t2[0].tipo === 'reabertura' && t2[0].ciclo === 0 && t2[0].concluida_em_anterior === finalizada.concluida_em, 'na base restaurada a primeira reabertura guarda a data comprovada (ciclo 0) e a coleta segue normal');
  await origem.close(); await vazia.close();
}

console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
