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
ok(d2.numero === '' && d2.origem === '' && d2.chegou_em === null && d2.prazo === null && d2.prazo_original === null && d2.setor === null && d2.acompanhar_em === null && d2.tipo === 'Processo' && d2.area === 'Geral', 'só o assunto é obrigatório: número, origem e chegada ficam vazios (nada de "s/n", "Não informada" nem data de hoje inventados) e nada de prazo, setor ou acompanhamento é inventado');
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
ok(m.etapa === 'Aguardando retorno' && m.setor === null && m.acompanhar_em === null && m.prazo === '2026-10-16', 'mover para Aguardando retorno não inventa setor, acompanhamento nem prazo');
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
ok(rs.dados.atrasadas === 1 && rs.dados.hoje === 1 && rs.dados.sete_dias === 2 && rs.dados.abertas === 7 && rs.dados.finalizadas === 1, 'rotina: contagens por data (1 atrasada, 1 hoje, 2 em até 7 dias; 7 abertas, 1 finalizada; arquivada fora)');
ok(rs.dados.sem_prazo === 1 && rs.dados.aguardando_retorno === 2 && rs.dados.prazo_vencido === 1, 'rotina: sem prazo = 1; aguardando = 2; prazo vencido = 1 (aguardando longe não volta aos grupos)');
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

// ---------- acesso exclusivo à conta autorizada (hook de cadastro, RLS por e-mail do JWT, privilégios explícitos) ----------
const X = '55555555-5555-4555-8555-555555555555', Z = '66666666-6666-4666-8666-666666666666';
await db.exec(`insert into auth.users (id, email) values ('${X}', 'intruso@teste'), ('${Z}', null)`);   // usuários que NÃO estão na lista (e um sem e-mail)
const doUsuario = async (id, opcoes, q, p = []) => db.transaction(async (tx) => { await entrarComo(tx, id, opcoes); try { return { rows: (await tx.query(q, p)).rows }; } catch (e) { return { erro: e.message }; } });
// RLS: um usuário fora da lista não lê, não grava e não executa nada, mesmo com sessão válida e user_id dele
ok((await doUsuario(X, {}, 'select count(*)::int as n from public.demandas')).rows?.[0].n === 0, 'acesso: usuário fora da lista autorizada não enxerga nenhuma demanda (RLS)');
ok(/row-level security/i.test((await doUsuario(X, {}, "insert into public.demandas (assunto) values ('invasão')")).erro || ''), 'acesso: usuário fora da lista não consegue gravar demanda (RLS recusa)');
ok(/row-level/i.test(await erro(X, 'criar_demanda', { p: { assunto: 'invasão' } })), 'acesso: usuário fora da lista não cria demanda pelas funções');
ok((await doUsuario(X, {}, 'select count(*)::int as n from public.execucoes_rotina')).rows?.[0].n === 0, 'acesso: usuário fora da lista não lê nem o registro de execuções da rotina');
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
  const copia = JSON.parse(JSON.stringify({ formato: 'dmanda-exportacao', versao: 1, exportado_em: new Date().toISOString(), fuso: 'America/Sao_Paulo', demandas: await co('listar_demandas', { p_arquivadas: false }), arquivadas: await co('listar_demandas', { p_arquivadas: true }) }));
  const original = await todas(origem, O);
  ok(copia.demandas.length === 3 && copia.arquivadas.length === 1 && copia.demandas.concat(copia.arquivadas).reduce((n, d) => n + d.tarefas.length, 0) === 5, 'restauração: a cópia fictícia tem 3 ativas e 1 arquivada, com 5 tarefas no total');

  // destino novo: outro projeto, com a conta de outro identificador, ainda sem dados
  const destino = await novoBanco([N, 'destino@teste']);
  ok(await tentar(destino, copia) === null && await contar(destino) === '4/5', 'restauração: a cópia entra num projeto novo (4 demandas e 5 tarefas)');
  ok(await todas(destino, N) === original, 'restauração: tudo volta igual (campos, datas, etapas, tarefas e ordem), visto pela conta nova com a RLS valendo');
  const r1 = await achar(destino, N, x1.id);
  ok(r1.tarefas.map((t) => t.texto).join('|') === TEXTOS.join('|') && r1.assunto === x1.assunto && r1.descricao === x1.descricao, 'restauração: acentos, aspas, cifrão, barra e quebra de linha chegam sem alteração');
  ok((await destino.query('select count(*)::int as n from public.demandas where user_id <> $1', [N])).rows[0].n === 0, 'restauração: tudo pertence à conta do projeto (nenhuma linha com outro dono)');
  ok(await tentar(destino, copia) === null && await contar(destino) === '4/5' && await todas(destino, N) === original, 'restauração: rodar de novo com o mesmo arquivo não duplica nem altera nada');

  // o que já existe não é sobrescrito nem recebe tarefas de volta
  await chamarComoUsuario(destino, N, 'atualizar_demanda', { p_id: x1.id, p: { assunto: 'ALTERADA DEPOIS' } });
  await chamarComoUsuario(destino, N, 'excluir_tarefa', { p_id: r1.tarefas[0].id });
  const antes = await todas(destino, N);
  const r1b = await achar(destino, N, x1.id);
  ok(await tentar(destino, copia) === null && await todas(destino, N) === antes && r1b.assunto === 'ALTERADA DEPOIS' && r1b.tarefas.length === 2, 'restauração: uma demanda que já existe não é sobrescrita nem recebe de volta a tarefa que foi excluída');

  // perda total no mesmo projeto: apaga tudo e restaura
  await destino.exec('delete from public.demandas');
  ok(await contar(destino) === '0/0' && await tentar(destino, copia) === null && await todas(destino, N) === original, 'restauração: depois de perder tudo no mesmo projeto, a cópia devolve as demandas e as tarefas idênticas');

  // recusas: nada é gravado
  const vazio = await novoBanco([N, 'destino@teste']);
  ok(/não é uma cópia do Dmanda/.test(await tentar(vazio, { ...copia, formato: 'outra-coisa' })) && /não é uma cópia do Dmanda/.test(await tentar(vazio, { ...copia, versao: 3 })) && /não é uma cópia do Dmanda/.test(await tentar(vazio, '{}')) && await contar(vazio) === '0/0', 'restauração: arquivo de outro formato ou de versão desconhecida é recusado sem gravar');
  const dois = await novoBanco([N, 'destino@teste'], [O, 'origem@teste']);
  ok(/exatamente 1 usuário/.test(await tentar(dois, copia)) && await contar(dois) === '0/0', 'restauração: com mais de um usuário no projeto, nada é gravado');
  const nenhum = await novoBanco();
  ok(/exatamente 1 usuário/.test(await tentar(nenhum, copia)) && await contar(nenhum) === '0/0', 'restauração: sem nenhum usuário no projeto, nada é gravado');
  const quebrada = JSON.parse(JSON.stringify(copia)); quebrada.demandas[0].tarefas[0].texto = '   ';
  ok(await tentar(vazio, quebrada) !== null && await contar(vazio) === '0/0', 'restauração: uma tarefa inválida derruba a restauração inteira (transação única, nada fica pela metade)');
  for (const d of [origem, destino, vazio, dois, nenhum]) await d.close();
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

// ---------- migração sobre dados antigos: nada se perde ----------
{
  const { mkdtempSync, copyFileSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const pasta = mkdtempSync(join(tmpdir(), 'dmanda-mig-'));
  const todas = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const nova8 = todas.find((f) => f.includes('prazos_e_dias_indisponiveis'));
  const nova9 = todas.find((f) => f.includes('normalizar_prazos_legados'));
  for (const f of todas.filter((f) => f !== nova8 && f !== nova9)) copyFileSync(join('supabase/migrations', f), join(pasta, f));
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
  await antigo.close();
}

console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
