// Autenticação, administração dos acessos e painel compartilhado no BANCO (decisão 92): banco de teste PGlite com as mesmas migrações, as pendentes incluídas (estado final), RLS e privilégios valendo,
// chamando como o PostgREST chama (papel authenticated com claims de JWT). Contas FICTÍCIAS: administradora, duas autorizadas, uma revogada, uma com convite pendente, uma de fora e o visitante.
// O QUE PROVA: as regras do banco (RLS, conta_autorizada, administrador único, hook, revogação com JWT anterior, autoria, privacidade do humor e das vagas, fechamento do acesso aberto).
// O QUE NÃO PROVA: o Supabase Auth real (emissão de JWT, convites por e-mail, expiração dos links) nem a rede. Uso: node scripts/testar-acesso.mjs
import { abrirBancoTeste, chamarComoUsuario, chamarComoServico, entrarComo, prepararAdminDeTeste, criarContaDeTeste, ADMIN_TESTE } from '../src/servidor/banco-teste-base.mjs';
import { criarVerificador } from './auxiliar-navegador.mjs';

const v = criarVerificador(), ok = v.ok;
const A = 'a1a1a1a1-0000-4000-8000-00000000000a', B = 'b2b2b2b2-0000-4000-8000-00000000000b', R = 'c3c3c3c3-0000-4000-8000-00000000000c', P = 'd4d4d4d4-0000-4000-8000-00000000000d', X = 'e5e5e5e5-0000-4000-8000-00000000000e';
const db = await abrirBancoTeste({ pendentes: true });
await prepararAdminDeTeste(db);
await criarContaDeTeste(db, A, 'a@exemplo.invalid'); await criarContaDeTeste(db, B, 'b@exemplo.invalid'); await criarContaDeTeste(db, R, 'r@exemplo.invalid');
await criarContaDeTeste(db, P, 'p@exemplo.invalid', { ativa: false }); await criarContaDeTeste(db, X, 'x@exemplo.invalid', { autorizar: false });
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const c = (u, f, a, o) => chamarComoUsuario(db, u, f, a, o);
const msg = async (u, f, a, o) => { try { await c(u, f, a, o); return null; } catch (e) { return e.message || String(e); } };
const comoAnon = async (q) => db.transaction(async (tx) => { await tx.exec('set local role anon'); try { await tx.query(q); return null; } catch (e) { return e.message; } });
const direto = async (u, q, p = [], o) => db.transaction(async (tx) => { await entrarComo(tx, u, o); try { return { rows: (await tx.query(q, p)).rows }; } catch (e) { return { erro: e.message }; } });
const erroSql = (q) => db.query(q).then(() => '', (e) => e.message);
const emailAdmin = (await sql('select dmanda_privado.email_admin() as e'))[0].e;
const hojeS = (await sql('select public.hoje()::text d'))[0].d;

// ---------- 1) o administrador único ----------
ok(emailAdmin.includes('@') && (await sql('select count(*)::int n from dmanda_privado.acesso_autorizado where email = dmanda_privado.email_admin() and revogado_em is null'))[0].n === 1, 'administrador: a conta administradora está na lista, autorizada, pelo e-mail fixado no banco');
ok((await c(ADMIN_TESTE, 'estado_acesso', {})).admin === true && (await c(A, 'estado_acesso', {})).admin === false && (await c(A, 'estado_acesso', {})).autorizado === true && (await c(X, 'estado_acesso', {})).autorizado === false, 'administrador: estado_acesso diz a cada conta só a própria situação (administradora, autorizada, de fora)');
const gestao = [['listar_acessos', {}], ['autorizar_acesso', { p_email: 'n@exemplo.invalid' }], ['registrar_convite_enviado', { p_email: 'a@exemplo.invalid' }], ['revogar_acesso', { p_email: 'b@exemplo.invalid' }], ['restabelecer_acesso', { p_email: 'a@exemplo.invalid' }]];
for (const [u, nome] of [[A, 'autorizada'], [B, 'autorizada (outra)'], [X, 'de fora'], [P, 'com convite pendente']]) {
  let negadas = 0; for (const [f, a] of gestao) if (/Somente a conta administradora/.test((await msg(u, f, a)) || '')) negadas++;
  ok(negadas === gestao.length, `gestão: a conta ${nome} não lista, autoriza, convida, revoga nem restabelece (o banco recusa as ${gestao.length} operações)`);
}
const forjadas = [['e-mail do administrador na claim', { email: emailAdmin }], ['user_metadata e app_metadata com papel de administrador', { extras: { user_metadata: { admin: true, role: 'admin' }, app_metadata: { provider: 'email', role: 'admin', admin: true } } }]];
for (const [rot, o] of forjadas) ok(/Somente a conta administradora/.test((await msg(A, 'listar_acessos', {}, o)) || '') && (await c(A, 'estado_acesso', {}, o)).admin === false, `gestão: ${rot} enviado por uma conta autorizada NÃO concede o papel (valem auth.uid() e o e-mail confirmado em auth.users)`);
ok(/Somente a conta administradora/.test((await msg(X, 'listar_acessos', {}, { email: emailAdmin })) || ''), 'gestão: uma conta de fora com a claim do e-mail do administrador também é recusada');
ok(/permission denied/i.test((await comoAnon('select public.listar_acessos()')) || '') && /permission denied/i.test((await comoAnon("select public.autorizar_acesso('v@exemplo.invalid')")) || '') && /permission denied/i.test((await comoAnon('select public.estado_acesso()')) || ''), 'gestão: o visitante (sem login) não executa nenhuma função de acesso');
ok(/permission denied/i.test((await direto(ADMIN_TESTE, 'select * from dmanda_privado.acesso_autorizado')).erro || '') && /permission denied/i.test((await direto(ADMIN_TESTE, 'update dmanda_privado.acesso_autorizado set revogado_em = null')).erro || ''), 'gestão: nem a administradora lê ou grava a tabela direto: só pelas funções');

// ---------- 2) ciclo dos acessos ----------
const lista = () => c(ADMIN_TESTE, 'listar_acessos', {});
const estadoDe = async (e) => (await lista()).find((x) => x.email === e)?.estado;
ok(await estadoDe('a@exemplo.invalid') === 'ativo' && await estadoDe('p@exemplo.invalid') === 'autorizado' && (await lista())[0].admin === true, 'estados: ativo (já entrou), autorizado (e-mail na lista, sem convite) e a administradora em primeiro');
const novo = await c(ADMIN_TESTE, 'autorizar_acesso', { p_email: '  Novo@Exemplo.INVALID ' });
ok(novo.email === 'novo@exemplo.invalid' && await estadoDe('novo@exemplo.invalid') === 'autorizado', 'autorizar: o e-mail entra normalizado (sem espaços nem maiúsculas) e fica "autorizado", sem enviar nada');
await c(ADMIN_TESTE, 'autorizar_acesso', { p_email: 'novo@exemplo.invalid' });
ok((await sql("select count(*)::int n from dmanda_privado.acesso_autorizado where email = 'novo@exemplo.invalid'"))[0].n === 1, 'autorizar: repetir o mesmo e-mail não duplica');
let invalidosRecusados = 0; const invalidos = ['', 'sem-arroba', 'a@b', 'a b@c.d', 'a@@c.d', 'x@y.z,w@y.z', 'a'.repeat(260) + '@x.yz'];
for (const ruim of invalidos) if (/e-mail válido/.test((await msg(ADMIN_TESTE, 'autorizar_acesso', { p_email: ruim })) || '')) invalidosRecusados++;
ok(invalidosRecusados === invalidos.length, 'autorizar: e-mails inválidos (vazio, sem arroba, sem domínio, espaço, dois endereços, longo demais) são recusados');
await c(ADMIN_TESTE, 'registrar_convite_enviado', { p_email: 'novo@exemplo.invalid' });
ok(await estadoDe('novo@exemplo.invalid') === 'convite_pendente' && /não está autorizado/.test((await msg(ADMIN_TESTE, 'registrar_convite_enviado', { p_email: 'nunca@exemplo.invalid' })) || ''), 'convite: depois do envio o estado é "convite pendente"; convidar quem não foi autorizado é recusado pelo banco');
await db.query("insert into auth.users (id, email, last_sign_in_at) values ('f6f6f6f6-0000-4000-8000-00000000000f', 'novo@exemplo.invalid', now())");
ok(await estadoDe('novo@exemplo.invalid') === 'ativo', 'estados: depois do primeiro acesso (conta criada e entrada feita) o estado passa a "ativo"');
ok(/não pode ser revogada/.test((await msg(ADMIN_TESTE, 'revogar_acesso', { p_email: emailAdmin })) || '') && await estadoDe(emailAdmin) === 'ativo', 'administradora: nenhuma operação do Dmanda a revoga (nem ela mesma)');
ok(/não pode ser revogada/.test(await erroSql('update dmanda_privado.acesso_autorizado set revogado_em = now() where email = dmanda_privado.email_admin()')), 'administradora: nem o papel dono do banco consegue revogá-la (gatilho)');
ok(/não pode ser removida/.test(await erroSql('delete from dmanda_privado.acesso_autorizado where email = dmanda_privado.email_admin()')) && /não pode ser trocado/.test(await erroSql("update dmanda_privado.acesso_autorizado set email = 'outro@exemplo.invalid' where email = dmanda_privado.email_admin()")), 'administradora: não pode ser apagada da lista nem mudar de endereço (gatilho)');
ok(/não pode ser trocado/.test(await erroSql("update dmanda_privado.acesso_autorizado set email = dmanda_privado.email_admin() where email = 'a@exemplo.invalid'")), 'administradora: outra pessoa não vira administradora trocando o endereço da própria linha (gatilho)');
ok((await sql("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and p.proname ~* 'admin' and p.proname not in ('e_admin', 'email_admin')"))[0].n === 0, 'administradora: não existe função que conceda a condição de administrador a outra pessoa');
await c(ADMIN_TESTE, 'revogar_acesso', { p_email: 'novo@exemplo.invalid' });
ok(await estadoDe('novo@exemplo.invalid') === 'revogado' && (await c(ADMIN_TESTE, 'revogar_acesso', { p_email: 'novo@exemplo.invalid' })).email === 'novo@exemplo.invalid', 'revogar: o estado passa a "revogado" e repetir não faz mal');

// ---------- 3) o painel é compartilhado, os registros guardam a autoria ----------
const dA = await c(A, 'criar_demanda', { p: { assunto: 'Demanda da conta A', prazo_original: '2027-06-02' } });
const evA = await c(A, 'criar_evento', { p: { titulo: 'Reunião da A', tipo: 'Reunião', data: '2027-06-03', inicio: '09:00', fim: '10:00' } });
const enA = await c(A, 'criar_entrada', { p: { texto: 'Nota da A' } });
const diaA = await c(A, 'salvar_dia_indisponivel', { p: { data: '2027-06-04', descricao: 'Feriado da A', categoria: 'Feriado' } });
ok((await c(B, 'listar_demandas', {})).some((x) => x.id === dA.id) && (await c(B, 'listar_eventos', {})).some((x) => x.id === evA.id) && (await c(B, 'listar_entradas', {})).some((x) => x.id === enA.id) && (await c(B, 'listar_dias_indisponiveis', {})).some((x) => x.id === diaA.dia.id), 'painel: a outra conta autorizada vê as mesmas demandas, eventos, entradas e dias indisponíveis');
const dB = await c(B, 'salvar_demanda', { p_id: dA.id, p: { assunto: 'Demanda da A, editada pela B' }, p_tarefas: [{ texto: 'tarefa da B', concluida: false }], p_versao: dA.versao });
ok(dB.assunto.endsWith('editada pela B') && dB.tarefas.length === 1 && (await c(A, 'buscar_demanda', { p_id: dA.id })).assunto === dB.assunto, 'painel: a outra conta edita a demanda e a primeira enxerga a mudança (mesmos registros)');
ok((await sql('select user_id::text u from public.demandas where id = $1', [dA.id]))[0].u === A && (await sql('select user_id::text u from public.tarefas where demanda_id = $1', [dA.id]))[0].u === B, 'autoria: a demanda continua sendo da autora (A) e a tarefa acrescentada pela B é da B (quem criou o registro)');
const dir = await direto(B, "insert into public.demandas (user_id, assunto) values ($1, 'autoria forjada') returning user_id::text u", [A]);
ok(dir.rows?.[0].u === B, 'autoria: um INSERT direto informando o user_id de outra pessoa grava o autor verdadeiro (gatilho), não o informado');
await direto(B, 'update public.demandas set user_id = $1 where id = $2', [B, dA.id]);
ok((await sql('select user_id::text u from public.demandas where id = $1', [dA.id]))[0].u === A, 'autoria: um UPDATE não troca o autor');
const opA = await c(A, 'criar_opcao', { p_campo: 'origem', p_nome: 'Origem Compartilhada' }), opB = await c(B, 'criar_opcao', { p_campo: 'origem', p_nome: '  origem   compartilhada ' });
ok(opB.existente === true && opB.id === opA.id && (await sql("select count(*)::int n from public.opcoes where chave = 'origem compartilhada'"))[0].n === 1, 'painel: a opção de origem é uma só do painel (a outra conta recebe a existente, sem duplicar)');
const ex = await c(A, 'excluir_dia_indisponivel', { p_id: diaA.dia.id });
ok(ex.excluido === true && (await c(B, 'listar_dias_indisponiveis', {})).length === 0, 'painel: o calendário é um só: o dia excluído por A some para B');
await c(A, 'registrar_dias', { p: [{ dia: hojeS, humor: 4 }] });
ok((await c(B, 'listar_registros_dia', { p_dias: 62 })).length === 0 && (await c(A, 'listar_registros_dia', { p_dias: 62 })).length === 1 && /row-level|violates/i.test((await direto(B, 'insert into public.registros_dia (user_id, dia, humor) values ($1, $2, 3)', [A, hojeS])).erro || ''), 'individual: o humor é privado: a outra conta não o lê nem grava no lugar da primeira');
await c(A, 'atualizar_para_hoje', { p_candidatas: [dA.id] });
ok((await c(A, 'listar_para_hoje', {})).length === 1 && (await c(B, 'listar_para_hoje', {})).length === 0, 'individual: as vagas do Para hoje são de cada conta (a outra não as vê)');
await c(A, 'criar_demanda', { p: { assunto: 'segunda do painel' } });
const rot1 = await chamarComoServico(db, 'rotina_diaria', {}), rot2 = await chamarComoServico(db, 'rotina_diaria', {});
ok(rot1.usuarios === 1 && rot2.usuarios === 1 && (await sql('select count(*)::int n from public.resumos_operacionais where data_ref = public.hoje()'))[0].n === 1 && (await sql('select count(*)::int n from public.execucoes_rotina'))[0].n === 2, 'rotina: com várias contas e várias demandas, o cálculo é feito UMA vez por execução (um resumo por data, sem repetir por usuário)');

// ---------- 4) revogação ----------
const dR = await c(R, 'criar_demanda', { p: { assunto: 'Trabalho da R antes da revogação' } });
await c(R, 'registrar_dias', { p: [{ dia: hojeS, humor: 2 }] });
const antes = (await c(R, 'listar_demandas', {})).length;
const jwtAnterior = { email: 'r@exemplo.invalid' };   // as mesmas claims, usadas de novo DEPOIS da revogação: o banco não espera o token vencer
await c(ADMIN_TESTE, 'revogar_acesso', { p_email: 'r@exemplo.invalid' });
ok(antes > 1 && (await c(R, 'listar_demandas', {}, jwtAnterior)).length === 0 && (await c(R, 'listar_entradas', {}, jwtAnterior)).length === 0 && (await c(R, 'listar_eventos', {}, jwtAnterior)).length === 0 && (await c(R, 'estado_acesso', {}, jwtAnterior)).autorizado === false, 'revogação: com o JWT de antes ainda válido, a conta revogada não lê demanda, entrada nem evento (a decisão é do banco, a cada consulta)');
ok(/row-level|violates/i.test((await msg(R, 'criar_demanda', { p: { assunto: 'depois de revogada' } }, jwtAnterior)) || '') && /não encontrada/.test((await msg(R, 'salvar_demanda', { p_id: dA.id, p: { assunto: 'x' }, p_tarefas: null, p_versao: 1 }, jwtAnterior)) || '') && (await sql("select count(*)::int n from public.demandas where assunto = 'depois de revogada'"))[0].n === 0, 'revogação: a conta revogada não cria nem altera nada, mesmo com o token anterior');
ok((await c(R, 'listar_registros_dia', { p_dias: 62 }, jwtAnterior)).length === 0 && (await c(R, 'listar_para_hoje', {}, jwtAnterior)).length === 0, 'revogação: nem o humor nem as vagas da conta revogada são acessíveis a ela');
ok((await c(A, 'listar_demandas', {})).some((x) => x.id === dR.id && x.assunto === 'Trabalho da R antes da revogação') && (await sql('select count(*)::int n from public.demandas where user_id = $1', [R]))[0].n >= 1, 'revogação: o trabalho que a conta revogada registrou é preservado e continua no painel das demais');
await c(ADMIN_TESTE, 'restabelecer_acesso', { p_email: 'r@exemplo.invalid' });
ok((await c(R, 'listar_demandas', {})).length >= antes, 'revogação: restabelecido pela administradora, o acesso volta');
await c(ADMIN_TESTE, 'revogar_acesso', { p_email: 'r@exemplo.invalid' });
for (const [rot, upd] of [['banimento no Auth', "banned_until = now() + interval '1 day'"], ['e-mail não confirmado', 'email_confirmed_at = null'], ['conta apagada (soft delete)', 'deleted_at = now()']]) {
  await db.query(`update auth.users set ${upd} where id = $1`, [B]);
  const n = (await c(B, 'listar_demandas', {})).length, a = (await c(B, 'estado_acesso', {})).autorizado;
  await db.query('update auth.users set banned_until = null, email_confirmed_at = now(), deleted_at = null where id = $1', [B]);
  ok(n === 0 && a === false && (await c(B, 'listar_demandas', {})).length > 0, `acesso: ${rot} fecha o acesso aos dados na mesma hora e desfazer devolve`);
}
await db.query('delete from auth.users where id = $1', [X]);
ok((await c(X, 'listar_demandas', {})).length === 0, 'acesso: um JWT cujo usuário já não existe no Auth não lê nada');

// ---------- 5) visitante e conta de fora ----------
const tabelas = ['demandas', 'tarefas', 'entradas', 'eventos', 'dias_indisponiveis', 'opcoes', 'registros_dia', 'para_hoje', 'resumos_operacionais', 'execucoes_rotina', 'periodos_operacoes'];
let anonNeg = 0, foraNeg = 0;
await criarContaDeTeste(db, X, 'x@exemplo.invalid', { autorizar: false });
for (const t of tabelas) {
  if (/permission denied/i.test((await comoAnon(`select * from public.${t}`)) || '')) anonNeg++;
  if ((await direto(X, `select count(*)::int n from public.${t}`)).rows?.[0].n === 0) foraNeg++;
}
ok(anonNeg === tabelas.length && foraNeg === tabelas.length, `RLS: o visitante é barrado pelo banco e a conta de fora lê zero linhas em todas as ${tabelas.length} tabelas do painel`);
ok(/row-level/i.test((await direto(X, "insert into public.demandas (assunto) values ('invasão')")).erro || '') && /row-level/i.test((await direto(X, "insert into public.entradas (texto) values ('invasão')")).erro || ''), 'RLS: a conta de fora não grava');
const funcoes = (await sql("select p.oid::regprocedure::text as f, has_function_privilege('anon', p.oid, 'execute') as anon from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute')"));
ok(funcoes.length > 40 && funcoes.every((f) => f.anon === false), `privilégios: das ${funcoes.length} funções do painel executáveis por contas autenticadas, nenhuma é executável pelo visitante`);
const definers = (await sql("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute') order by 1")).map((x) => x.proname).join();
ok(definers === 'autorizar_acesso,conta_autorizada,e_admin,estado_acesso,listar_acessos,registrar_convite_enviado,restabelecer_acesso,revogar_acesso', `privilégios: as únicas funções SECURITY DEFINER que uma conta autenticada executa são as de acesso, e cada uma verifica o banco (${definers})`);

// ---------- 6) hook de criação de usuários e fechamento do acesso aberto ----------
const hook = async (email, provedor, papel = 'supabase_auth_admin') => db.transaction(async (tx) => { await tx.exec(`set local role ${papel}`); try { return (await tx.query('select public.hook_antes_criar_usuario($1::jsonb) as r', [JSON.stringify({ user: { email, app_metadata: { provider: provedor } } })])).rows[0].r; } catch (e) { return { falha: e.message }; } });
ok(JSON.stringify(await hook('p@exemplo.invalid', 'email')) === '{}' && (await hook('desconhecido@exemplo.invalid', 'email')).error?.http_code === 403 && (await hook('r@exemplo.invalid', 'email')).error?.http_code === 403 && (await hook('a@exemplo.invalid', 'google')).error?.http_code === 403, 'hook: cadastro fechado também fora da interface: só e-mail e senha, só endereço autorizado e não revogado (Google, desconhecido e revogado são recusados)');
ok(/permission denied/i.test((await hook('p@exemplo.invalid', 'email', 'authenticated')).falha || '') && /permission denied/i.test((await hook('p@exemplo.invalid', 'email', 'anon')).falha || ''), 'hook: só o papel do Auth executa o hook');
ok((await sql("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('executar_como_titular', 'assumir_titular')"))[0].n === 0, 'acesso aberto: depois do fechamento (estado final) não existe função que consulte ou altere o painel sem a identidade autenticada');
const svcFn = (await sql("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','dmanda_privado') and has_function_privilege('service_role', p.oid, 'execute') order by 1")).map((x) => x.proname).join();
ok(svcFn === 'registrar_falha_rotina,rotina_diaria', `acesso aberto: o papel de serviço executa só a rotina diária (${svcFn})`);
ok((await db.query('select has_table_privilege($1, $2, $3) as p', ['service_role', 'public.demandas', 'select'])).rows[0].p === false, 'acesso aberto: o papel de serviço não lê as demandas (a chave de serviço sozinha não abre o painel pela API)');

await db.close();
process.exit(v.resumo());
