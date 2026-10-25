// Testa as migrações e as funções SQL do núcleo de demandas e tarefas, com a RLS valendo, num Postgres local de teste (PGlite).
// Valida a lógica SQL e o isolamento por usuário. NÃO valida o Supabase real (plataforma, Auth, chaves, rede).
// Uso: node scripts/testar-banco.mjs
import { abrirBancoTeste, chamarComoUsuario, chamarComoServico } from '../src/servidor/banco-teste-base.mjs';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const db = await abrirBancoTeste();
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@teste'), ('${B}', 'b@teste')`);
const c = (u, f, a) => chamarComoUsuario(db, u, f, a);
const erro = async (u, f, a) => { try { await c(u, f, a); return null; } catch (e) { return e.message || String(e); } };

// criar e validar
ok(/Informe o assunto/.test(await erro(A, 'criar_demanda', { p: { assunto: '  ' } })), 'criar sem assunto é recusado com mensagem clara');
const d1 = await c(A, 'criar_demanda', { p: { assunto: ' Resposta ao TCE ', tipo: 'Processo', numero: '1842/2026', origem: 'TCE-RS', descricao: 'Texto', prazo: '2026-10-18', prazo_tipo: 'Legal' } });
ok(d1.etapa === 'Cadastro' && d1.assunto === 'Resposta ao TCE' && d1.numero === '1842/2026' && d1.prazo === '2026-10-18' && d1.prazo_tipo === 'Legal' && !('user_id' in d1) && d1.tarefas.length === 0, 'criar grava os campos informados, começa em Cadastro e não expõe user_id');
const d2 = await c(A, 'criar_demanda', { p: { assunto: 'Só o assunto' } });
ok(d2.numero === 's/n' && d2.origem === 'Não informada' && d2.prazo === null && d2.setor === null && d2.acompanhar_em === null && d2.tipo === 'Processo' && d2.area === 'Geral' && /^\d{4}-\d\d-\d\d$/.test(d2.chegou_em), 'só o assunto é obrigatório: números e origem seguem o padrão do protótipo e nada de prazo, setor ou acompanhamento é inventado');
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
t = await c(A, 'editar_tarefa', { p_id: t3.id, p_texto: '  Redigir a resposta final ' }); ok(t.tarefas[2].texto === 'Redigir a resposta final', 'editar tarefa grava o texto novo');
t = await c(A, 'marcar_tarefa', { p_id: t1.id, p_concluida: true }); t = await c(A, 'marcar_tarefa', { p_id: t2.id, p_concluida: true });
ok(t.tarefas.filter((x) => x.concluida).length === 2 && t.etapa === 'Vistos', 'marcar tarefas atualiza só as marcadas e não muda a etapa');
t = await c(A, 'marcar_tarefa', { p_id: t3.id, p_concluida: true }); ok(t.etapa === 'Vistos' && t.tarefas.every((x) => x.concluida), 'marcar todas não conclui a demanda sozinho');
t = await c(A, 'marcar_tarefa', { p_id: t2.id, p_concluida: false }); ok(!t.tarefas[1].concluida, 'desmarcar funciona');
t = await c(A, 'excluir_tarefa', { p_id: t1.id }); ok(t.tarefas.length === 2 && t.tarefas.map((x) => x.posicao).join() === '1,2' && t.tarefas[0].texto === 'Conferir com a Contabilidade', 'excluir tarefa fecha o buraco e mantém a ordem');
ok(/não encontrada/.test(await erro(B, 'marcar_tarefa', { p_id: t2.id, p_concluida: true })), 'RLS: B não marca tarefa de A');

// etapas
let m = await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Aguardando retorno' });
ok(m.etapa === 'Aguardando retorno' && m.setor === null && m.acompanhar_em === null && m.prazo === '2026-10-18', 'mover para Aguardando retorno não inventa setor, acompanhamento nem prazo');
m = await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Finalizado' });
ok(m.etapa === 'Finalizado' && /^\d{4}-/.test(m.concluida_em) && m.tarefas.every((x) => x.concluida), 'concluir marca todas as tarefas e registra a data de conclusão');
m = await c(A, 'reabrir_demanda', { p_id: d1.id });
ok(m.etapa === 'Fazendo' && m.concluida_em === null && m.tarefas.every((x) => x.concluida) && m.tarefas.length === 2, 'reabrir volta para Fazendo, mantém as tarefas cumpridas e limpa a conclusão');
await c(A, 'concluir_demanda', { p_id: d1.id });
m = await c(A, 'reabrir_demanda', { p_id: d1.id, p_etapa: 'Vistos' }); ok(m.etapa === 'Vistos', 'reabrir leva para a etapa escolhida');
ok(/Só uma demanda finalizada/.test(await erro(A, 'reabrir_demanda', { p_id: d1.id })), 'reabrir uma demanda que não está finalizada é recusado');
await c(A, 'concluir_demanda', { p_id: d1.id }); m = await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Cadastro' }); ok(m.etapa === 'Cadastro' && m.concluida_em === null, 'mover de Finalizado para outra etapa equivale a reabrir na etapa escolhida');
ok(/Etapa desconhecida/.test(await erro(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Qualquer' })), 'etapa inválida é recusada');
ok((await c(A, 'mover_etapa', { p_id: d1.id, p_etapa: 'Cadastro' })).etapa === 'Cadastro', 'mover para a mesma etapa não faz nada');
const direto = await db.transaction(async (tx) => { try { await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [A]); await tx.exec('set local role authenticated'); await tx.query("update public.demandas set etapa = 'Finalizado' where id = $1", [d1.id]); return null; } catch (e) { return e.message; } });
ok(/concluida_so_finalizada/.test(direto || ''), 'a restrição do banco impede Finalizado sem data de conclusão mesmo por escrita direta');

// atualizar
let u = await c(A, 'atualizar_demanda', { p_id: d1.id, p: { assunto: 'Novo assunto', origem: '', prazo: null, descricao: 'Nova descrição' } });
ok(u.assunto === 'Novo assunto' && u.origem === 'Não informada' && u.prazo === null && u.descricao === 'Nova descrição' && u.numero === '1842/2026' && u.prazo_tipo === 'Legal' && u.tarefas.length === 2, 'atualizar muda só os campos informados, limpa o prazo com null e preserva o resto');
u = await c(A, 'atualizar_demanda', { p_id: d1.id, p: { prazo: '2026-11-05', prazo_tipo: 'Próprio', setor: ' PGM ', acompanhar_em: '2026-10-28' } });
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
const e1 = await c(A, 'criar_demanda', { p: { assunto: 'Edição em lote', tipo: 'Memorando' } });
let sv = await c(A, 'salvar_demanda', { p_id: e1.id, p: { assunto: 'Edição salva', descricao: 'Texto novo', prazo: '2026-12-01' }, p_tarefas: [{ texto: 'Primeira', concluida: false }, { texto: 'Segunda', concluida: true }] });
ok(sv.assunto === 'Edição salva' && sv.prazo === '2026-12-01' && sv.tarefas.map((x) => x.texto).join() === 'Primeira,Segunda' && sv.tarefas[1].concluida === true && sv.etapa === 'Vistos', 'salvar grava campos e tarefas novas, na ordem, e Cadastro vai para Vistos com a primeira tarefa');
const [s1, s2] = sv.tarefas;
sv = await c(A, 'salvar_demanda', { p_id: e1.id, p: {}, p_tarefas: [{ id: s2.id, texto: 'Segunda (editada)', concluida: false }, { id: s1.id, texto: 'Primeira', concluida: true }, { texto: 'Terceira', concluida: false }] });
ok(sv.tarefas.map((x) => x.texto).join('|') === 'Segunda (editada)|Primeira|Terceira' && sv.tarefas.map((x) => x.posicao).join() === '1,2,3' && sv.tarefas[0].id === s2.id && sv.tarefas[1].concluida === true, 'salvar reordena, edita e marca mantendo os identificadores das tarefas existentes');
sv = await c(A, 'salvar_demanda', { p_id: e1.id, p: {}, p_tarefas: [{ id: s1.id, texto: 'Primeira', concluida: true }] });
ok(sv.tarefas.length === 1 && sv.tarefas[0].id === s1.id, 'tarefas fora da lista são excluídas');
const antesAtomico = JSON.stringify(await c(A, 'buscar_demanda', { p_id: e1.id }));
ok(/não pode ficar vazia/.test(await erro(A, 'salvar_demanda', { p_id: e1.id, p: { assunto: 'NÃO DEVE GRAVAR' }, p_tarefas: [{ id: s1.id, texto: 'x', concluida: false }, { texto: '   ', concluida: false }] })) && JSON.stringify(await c(A, 'buscar_demanda', { p_id: e1.id })) === antesAtomico, 'uma tarefa inválida desfaz tudo: nada do salvar é gravado (atomicidade)');
sv = await c(A, 'salvar_demanda', { p_id: e1.id, p: { etapa: 'Finalizado', assunto: 'Concluída pela janela' }, p_tarefas: [{ id: s1.id, texto: 'Primeira', concluida: false }, { texto: 'Nova', concluida: false }] });
ok(sv.etapa === 'Finalizado' && sv.tarefas.every((x) => x.concluida) && sv.assunto === 'Concluída pela janela' && sv.concluida_em !== null, 'salvar com etapa Finalizado conclui: marca todas as tarefas e registra a data');
sv = await c(A, 'salvar_demanda', { p_id: e1.id, p: { etapa: 'Fazendo' } });
ok(sv.etapa === 'Fazendo' && sv.concluida_em === null && sv.tarefas.length === 2 && sv.tarefas.every((x) => x.concluida), 'salvar com outra etapa reabre mantendo as tarefas');
ok(/não encontrada/.test(await erro(B, 'salvar_demanda', { p_id: e1.id, p: { assunto: 'x' }, p_tarefas: [] })), 'RLS: B não salva a demanda de A');
ok(/Etapa desconhecida|check/i.test(await erro(A, 'salvar_demanda', { p_id: e1.id, p: { etapa: 'Voando' } })), 'etapa inválida no salvar é recusada');
sv = await c(A, 'salvar_demanda', { p_id: e1.id, p: { tipo: 'Processo', area: 'Compras' }, p_tarefas: null });
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
const mk = (p) => c(R, 'criar_demanda', { p });
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
ok(rs.dados.atrasadas === 1 && rs.dados.hoje === 1 && rs.dados.sete_dias === 2 && rs.dados.abertas === 7 && rs.dados.finalizadas === 1, 'rotina: contagens por data (1 atrasada, 1 hoje, 2 em até 7 dias; 7 abertas, 1 finalizada; arquivada fora)');
ok(rs.dados.sem_prazo === 1 && rs.dados.aguardando_retorno === 2 && rs.dados.prazo_vencido === 1, 'rotina: sem prazo = 1; aguardando = 2; prazo vencido = 1 (aguardando longe não volta aos grupos)');
ok(rs.dados.data_ref === hojeSql && rs.dados.proxima_data === hojeSql && rs.dados.ids.atrasadas[0] === venc.id && rs.dados.ids.hoje[0] === hojeD.id, 'rotina: o resumo guarda a data de referência e os identificadores (sem texto das demandas)');
ok(!JSON.stringify(rs.dados).includes('Vencida'), 'rotina: o resumo não contém assunto nem outro texto das demandas');

// privilégios: só o papel de serviço roda a rotina
ok(/permission denied/i.test(await erro(R, 'rotina_diaria', {})) && /permission denied/i.test(await erro(R, 'registrar_falha_rotina', { p_erro: 'x' })), 'rotina: usuário logado não pode executar a rotina nem registrar falha');
ok(/permission denied/i.test(await erro(R, 'calcular_resumo', { p_user: R, p_data: hojeSql })) && /permission denied/i.test(await erro(R, 'recalcular_resumo_usuario', { p_user: S, p_data: hojeSql, p_origem: 'rotina' })), 'rotina: funções internas não são chamáveis por usuário logado');
const comoAnon = async (q) => db.transaction(async (tx) => { await tx.exec('set local role anon'); try { await tx.query(q); return null; } catch (e) { return e.message; } });
ok(/permission denied/i.test(await comoAnon('select public.rotina_diaria()')) && /permission denied/i.test(await comoAnon('select * from public.resumos_operacionais')) && /permission denied/i.test(await comoAnon('select * from public.execucoes_rotina')), 'rotina: visitante sem login não executa nem lê nada');
const comoUsuarioSql = async (q) => db.transaction(async (tx) => { await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [R]); await tx.exec('set local role authenticated'); try { await tx.query(q); return null; } catch (e) { return e.message; } });
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
await c(S, 'criar_demanda', { p: { assunto: 'Outro usuário', prazo: await mais(-1) } });
await serv('rotina_diaria', {});
const veR = await db.transaction(async (tx) => { await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [R]); await tx.exec('set local role authenticated'); return (await tx.query('select user_id from public.resumos_operacionais')).rows; });
ok(veR.length === 1 && veR[0].user_id === R, 'rotina: RLS, cada usuário vê só o próprio resumo');

// dias restantes derivados das datas: mudar o prazo muda o resumo na hora, sem esperar o dia seguinte
await c(R, 'atualizar_demanda', { p_id: em9.id, p: { prazo: await mais(-1) } });
rs = (await sql('select dados from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [R]))[0];
ok(rs.dados.atrasadas === 2 && rs.dados.sete_dias === 2, 'rotina: alterar um prazo recalcula o resumo de hoje (atrasadas 2)');
await c(R, 'mover_etapa', { p_id: venc.id, p_etapa: 'Finalizado' });
rs = (await sql('select dados from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [R]))[0];
ok(rs.dados.atrasadas === 1 && rs.dados.finalizadas === 2, 'rotina: concluir uma demanda recalcula o resumo');
await c(R, 'arquivar_demanda', { p_id: em3.id });
await c(R, 'excluir_demanda', { p_id: semPrazo.id, p_confirmado: true });
rs = (await sql('select dados from public.resumos_operacionais where user_id = $1 and data_ref = public.hoje()', [R]))[0];
ok(rs.dados.sete_dias === 1 && rs.dados.sem_prazo === 0, 'rotina: arquivar e excluir também recalculam');

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

console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
