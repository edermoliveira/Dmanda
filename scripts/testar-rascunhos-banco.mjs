// Rascunhos online no BANCO (decisão 92): protocolo de versões, repetição idempotente, conflito que preserva as duas versões, lápide contra ressurreição, isolamento entre contas e recuperação
// controlada do administrador. Banco de teste PGlite (as mesmas migrações, pendentes incluídas), RLS valendo, contas fictícias. NÃO prova a rede nem o Supabase real. Uso: node scripts/testar-rascunhos-banco.mjs
import { abrirBancoTeste, chamarComoUsuario, entrarComo, prepararAdminDeTeste, criarContaDeTeste, ADMIN_TESTE } from '../src/servidor/banco-teste-base.mjs';
import { criarVerificador } from './auxiliar-navegador.mjs';
import { randomUUID } from 'node:crypto';

const v = criarVerificador(), ok = v.ok;
const A = 'a1a1a1a1-0000-4000-8000-00000000000a', B = 'b2b2b2b2-0000-4000-8000-00000000000b', R = 'c3c3c3c3-0000-4000-8000-00000000000c', X = 'e5e5e5e5-0000-4000-8000-00000000000e';
const db = await abrirBancoTeste({ pendentes: true });
await prepararAdminDeTeste(db);
await criarContaDeTeste(db, A, 'a@exemplo.invalid'); await criarContaDeTeste(db, B, 'b@exemplo.invalid'); await criarContaDeTeste(db, R, 'r@exemplo.invalid'); await criarContaDeTeste(db, X, 'x@exemplo.invalid', { autorizar: false });
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const c = (u, f, a) => chamarComoUsuario(db, u, f, a);
const msg = async (u, f, a) => { try { await c(u, f, a); return null; } catch (e) { return e.message || String(e); } };
const direto = async (u, q, p = []) => db.transaction(async (tx) => { await entrarComo(tx, u); try { return { rows: (await tx.query(q, p)).rows }; } catch (e) { return { erro: e.message }; } });
const comoAnon = async (q) => db.transaction(async (tx) => { await tx.exec('set local role anon'); try { await tx.query(q); return null; } catch (e) { return e.message; } });
const salvar = (u, id, chave, dados, base, op = randomUUID()) => c(u, 'salvar_rascunho', { p_id: id, p_chave: chave, p_dados: dados, p_base: base, p_op: op });
const abertos = async (u) => (await c(u, 'listar_rascunhos', {}));
const D1 = randomUUID(), D2 = randomUUID();

// ---------- 1) ciclo básico e versões ----------
const r1 = await salvar(A, D1, 'e:nova', { dados: { titulo: 'primeira' } }, 0);
ok(r1.status === 'ok' && r1.versao === 1 && r1.id === D1, 'salvar: o rascunho novo nasce na versão 1');
const op2 = randomUUID(), r2 = await salvar(A, D1, 'e:nova', { dados: { titulo: 'segunda' } }, 1, op2);
ok(r2.status === 'ok' && r2.versao === 2, 'salvar: com a versão conhecida (1) a gravação sobe a versão para 2');
const r2b = await salvar(A, D1, 'e:nova', { dados: { titulo: 'segunda' } }, 1, op2);
ok(r2b.status === 'ok' && r2b.versao === 2 && r2b.repetida === true && (await abertos(A))[0].versao === 2, 'resposta perdida: repetir a MESMA operação devolve o estado atual (versão 2) sem reaplicar nem gerar conflito');
ok((await abertos(A)).length === 1 && (await abertos(A))[0].dados.dados.titulo === 'segunda' && (await abertos(A))[0].conflitos.length === 0, 'listar: devolve só os abertos da conta, com o conteúdo da última versão e sem conflitos');
// em outro aparelho (mesma conta): lê o rascunho e continua de onde parou
const r3 = await salvar(A, D1, 'e:nova', { dados: { titulo: 'terceira, no outro aparelho' } }, 2);
ok(r3.status === 'ok' && r3.versao === 3, 'outro aparelho: a mesma conta recupera o rascunho e grava a partir da versão que viu');

// ---------- 2) conflito: as duas versões são preservadas ----------
const velha = randomUUID(), cf = await salvar(A, D1, 'e:nova', { dados: { titulo: 'do aparelho que estava atrasado' } }, 2, velha);
ok(cf.status === 'conflito' && cf.versao === 3 && cf.dados.dados.titulo === 'terceira, no outro aparelho' && cf.conflitos.length === 1 && cf.conflitos[0].dados.dados.titulo === 'do aparelho que estava atrasado', 'conflito: uma gravação sobre versão antiga NÃO sobrescreve; a versão do banco permanece e a que perdeu é guardada ao lado');
const cf2 = await salvar(A, D1, 'e:nova', { dados: { titulo: 'do aparelho que estava atrasado' } }, 2, velha);
ok(cf2.status === 'conflito' && cf2.conflitos.length === 1, 'conflito: repetir a mesma operação (resposta perdida) não acumula cópias');
const futura = await salvar(A, D1, 'e:nova', { dados: { titulo: 'base inventada' } }, 99);
ok(futura.status === 'conflito' && (await abertos(A))[0].dados.dados.titulo === 'terceira, no outro aparelho', 'conflito: uma versão-base que o banco nunca teve também não sobrescreve');
const res = await c(A, 'resolver_rascunho', { p_id: D1, p_dados: { dados: { titulo: 'escolhida pela pessoa' } }, p_base: 3, p_op: randomUUID() });
ok(res.status === 'ok' && res.versao === 4 && (await abertos(A))[0].conflitos.length === 0 && (await abertos(A))[0].dados.dados.titulo === 'escolhida pela pessoa', 'resolver: a pessoa escolhe o conteúdo, a versão sobe e os conflitos saem só por essa decisão explícita');
const resVelha = await c(A, 'resolver_rascunho', { p_id: D1, p_dados: { dados: { titulo: 'x' } }, p_base: 3, p_op: randomUUID() });
ok(resVelha.status === 'conflito', 'resolver: sobre versão antiga também não sobrescreve');
// duas abas editando ao mesmo tempo: mesma base, a primeira vence e a segunda é guardada ao lado
const [ab1, ab2] = await Promise.all([salvar(A, D1, 'e:nova', { dados: { titulo: 'aba 1' } }, 4), salvar(A, D1, 'e:nova', { dados: { titulo: 'aba 2' } }, 4)]);
const fin = (await abertos(A))[0];
ok([ab1.status, ab2.status].sort().join() === 'conflito,ok' && fin.conflitos.length === 1 && [fin.dados.dados.titulo, fin.conflitos[0].dados.dados.titulo].sort().join() === 'aba 1,aba 2', 'duas abas na mesma versão: uma grava, a outra vira conflito, e as DUAS versões ficam guardadas');
// instância nova na mesma chave (outro aparelho começou o mesmo rascunho)
const outraInst = await salvar(A, D2, 'e:nova', { dados: { titulo: 'começado em outro aparelho' } }, 0);
ok(outraInst.status === 'conflito' && outraInst.id === D1 && (await abertos(A)).length === 1, 'duas instâncias na mesma chave: fica a que já existe e a nova é guardada nos conflitos dela (nenhuma se perde)');

// ---------- 3) consumir e descartar: lápide contra ressurreição ----------
const enc = await c(A, 'encerrar_rascunho', { p_id: D1, p_chave: 'e:nova', p_estado: 'consumido' });
ok(enc.status === 'ok' && enc.estado === 'consumido' && (await abertos(A)).length === 0, 'consumir: o rascunho confirmado sai da lista de abertos');
const t1 = (await sql('select estado, dados::text d, conflitos::text c from public.rascunhos where id = $1', [D1]))[0];
ok(t1.estado === 'consumido' && t1.d === '{}' && t1.c === '[]', 'consumir: a lápide guarda só a identidade e o estado, sem o conteúdo');
const ress = await salvar(A, D1, 'e:nova', { dados: { titulo: 'fila antiga tentando ressuscitar' } }, 4);
ok(ress.status === 'encerrado' && ress.estado === 'consumido' && (await abertos(A)).length === 0, 'lápide: uma gravação atrasada de uma instância já consumida NÃO recria o rascunho');
ok((await c(A, 'encerrar_rascunho', { p_id: D1, p_chave: 'e:nova', p_estado: 'consumido' })).status === 'ok' && (await c(A, 'encerrar_rascunho', { p_id: D1, p_chave: 'e:nova', p_estado: 'descartado' })).estado === 'consumido', 'consumir: repetir é seguro e um descarte posterior não troca o estado já definido');
const D3 = randomUUID();
await salvar(A, D3, 'e:nova', { dados: { titulo: 'depois' } }, 0);
ok((await abertos(A)).length === 1, 'lápide: a chave volta a aceitar um rascunho novo (outra instância) depois do anterior encerrado');
const D4 = randomUUID();
await c(A, 'encerrar_rascunho', { p_id: D4, p_chave: 'tarefa', p_estado: 'descartado' });
ok((await salvar(A, D4, 'tarefa', { dados: { nt: 'x' } }, 0)).status === 'encerrado' && (await abertos(A)).every((x) => x.chave !== 'tarefa'), 'lápide: descartar uma instância que o banco ainda não conhecia também impede a gravação atrasada dela');

// ---------- 4) isolamento entre contas ----------
const segredo = randomUUID();
await salvar(A, segredo, 'nova', { dados: { assunto: 'rascunho privado da A' } }, 0);
ok((await abertos(B)).length === 0 && (await abertos(ADMIN_TESTE)).length === 0 && (await direto(B, 'select count(*)::int n from public.rascunhos')).rows[0].n === 0 && (await direto(ADMIN_TESTE, 'select count(*)::int n from public.rascunhos')).rows[0].n === 0, 'isolamento: nem a outra conta autorizada nem a administradora leem os rascunhos da A (lista e tabela)');
const invasao = [await msg(B, 'salvar_rascunho', { p_id: segredo, p_chave: 'nova', p_dados: { dados: { assunto: 'invasão' } }, p_base: 1, p_op: randomUUID() }), await msg(B, 'resolver_rascunho', { p_id: segredo, p_dados: { x: 1 }, p_base: 1, p_op: randomUUID() }), await msg(B, 'encerrar_rascunho', { p_id: segredo, p_chave: 'nova', p_estado: 'descartado' })];
ok(invasao.every((m) => /Rascunho indisponível/.test(m || '')) && (await abertos(A)).find((x) => x.id === segredo).dados.dados.assunto === 'rascunho privado da A' && (await abertos(A)).find((x) => x.id === segredo).versao === 1, 'isolamento: trocar o identificador por o de outra conta não grava, não resolve nem descarta, e a resposta é a mesma de qualquer id indisponível');
ok(/row-level|violates/i.test((await direto(B, "insert into public.rascunhos (id, user_id, chave, dados) values ($1, $2, 'nova', '{}')", [randomUUID(), A])).erro || '') && (await direto(B, 'update public.rascunhos set dados = $1 where id = $2', ['{"x":1}', segredo])).rows?.length === 0, 'isolamento: inserir em nome de outra conta é barrado pela RLS e atualizar o rascunho alheio não encontra a linha');
const bPropria = await salvar(B, randomUUID(), 'nova', { dados: { assunto: 'da B' } }, 0);
ok(bPropria.status === 'ok' && (await abertos(B)).length === 1 && (await abertos(A)).filter((x) => x.chave === 'nova').length === 1, 'isolamento: cada conta tem o seu próprio rascunho "nova", sem se misturar');
ok((await sql('select count(*)::int n from public.rascunhos where user_id = $1', [A]))[0].n >= 3, 'isolamento: no banco cada rascunho tem o autor (user_id) e nada é compartilhado');

// ---------- 5) conta sem acesso, revogada e visitante ----------
ok(((await msg(X, 'listar_rascunhos', {})) === null ? (await abertos(X)).length === 0 : true) && /Rascunho indisponível|row-level|violates|não tem acesso/i.test((await msg(X, 'salvar_rascunho', { p_id: randomUUID(), p_chave: 'nova', p_dados: { a: 1 }, p_base: 0, p_op: randomUUID() })) || ''), 'acesso: a conta de fora não lê nem grava rascunhos');
ok(/permission denied/i.test((await comoAnon('select public.listar_rascunhos()')) || '') && /permission denied/i.test((await comoAnon('select * from public.rascunhos')) || ''), 'acesso: o visitante não executa nenhuma função de rascunho nem lê a tabela');
await salvar(R, randomUUID(), 'ev:nova', { ev: { titulo: 'da R' } }, 0);
await c(ADMIN_TESTE, 'revogar_acesso', { p_email: 'r@exemplo.invalid' });
ok(/revogado/.test(await msg(R, 'listar_rascunhos', {}) || '') && /revogado/i.test((await msg(R, 'salvar_rascunho', { p_id: randomUUID(), p_chave: 'nova', p_dados: { a: 1 }, p_base: 0, p_op: randomUUID() })) || '') && (await sql('select count(*)::int n from public.rascunhos where user_id = $1 and estado = $2', [R, 'aberto']))[0].n === 1, 'revogação: a conta revogada não acessa os rascunhos dela (o banco recusa) e o que ela guardou é preservado');
await c(ADMIN_TESTE, 'restabelecer_acesso', { p_email: 'r@exemplo.invalid' });
ok((await abertos(R)).length === 1, 'revogação: restabelecida, a conta recupera os próprios rascunhos');

// ---------- 6) validação ----------
let chavesRuins = 0;
for (const ch of ['senha', 'password:nova', 'x:y', 'e:', 'd:curto', 'nova ', "nova'; --", '', 'legado:' + 'x'.repeat(200)]) if (/violates|check|indisponível|inválido/i.test((await msg(A, 'salvar_rascunho', { p_id: randomUUID(), p_chave: ch, p_dados: { a: 1 }, p_base: 0, p_op: randomUUID() })) || '')) chavesRuins++;
ok(chavesRuins === 9 && (await sql("select count(*)::int n from public.rascunhos where chave ~* 'senha|password'"))[0].n === 0, 'validação: só as chaves de rascunho conhecidas existem; senha, credenciais, chaves livres e injeção são recusadas');
ok(/inválido/.test((await msg(A, 'salvar_rascunho', { p_id: randomUUID(), p_chave: 'nova', p_dados: [1, 2], p_base: 0, p_op: randomUUID() })) || '') && /tamanho/.test((await msg(A, 'salvar_rascunho', { p_id: randomUUID(), p_chave: 'tarefa', p_dados: { texto: 'x'.repeat(300000) }, p_base: 0, p_op: randomUUID() })) || ''), 'validação: o conteúdo tem de ser um objeto e passa de 256 KB é recusado');
const D5 = randomUUID(); await salvar(A, D5, 'ev:nova', { ev: {} }, 0);
ok(/indisponível/.test((await msg(A, 'salvar_rascunho', { p_id: D5, p_chave: 'tarefa', p_dados: { a: 1 }, p_base: 1, p_op: randomUUID() })) || ''), 'validação: o mesmo identificador não pode ser reaproveitado para outra chave');
// limite de rascunhos abertos
await db.query("insert into auth.users (id, email, last_sign_in_at) values ('f6f6f6f6-0000-4000-8000-000000000f06', 'lim@exemplo.invalid', now())");
await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('lim@exemplo.invalid')");
const L = 'f6f6f6f6-0000-4000-8000-000000000f06';
await db.query("insert into public.rascunhos (id, user_id, chave, dados) select gen_random_uuid(), $1, 'legado:l' || g, '{}' from generate_series(1, 200) g", [L]);
ok(/demais/.test((await msg(L, 'salvar_rascunho', { p_id: randomUUID(), p_chave: 'nova', p_dados: { a: 1 }, p_base: 0, p_op: randomUUID() })) || ''), 'limite: acima de 200 rascunhos abertos por conta o banco recusa um novo, com mensagem clara');

// ---------- 7) recuperação controlada dos rascunhos antigos (só a administradora) ----------
const ant = randomUUID();
ok(/Somente a conta administradora/.test((await msg(A, 'importar_rascunho_legado', { p_id: ant, p_chave: 'e:nova', p_dados: { dados: {} } })) || '') && /Somente a conta administradora/.test((await msg(B, 'importar_rascunho_legado', { p_id: ant, p_chave: 'nova', p_dados: { dados: {} } })) || ''), 'recuperação: uma conta comum NÃO recebe rascunhos antigos do aparelho (a chave antiga não identifica autor)');
const imp = await c(ADMIN_TESTE, 'importar_rascunho_legado', { p_id: ant, p_chave: 'e:nova', p_dados: { dados: { titulo: 'antigo' } } });
ok(imp.status === 'ok' && (await abertos(ADMIN_TESTE)).length === 1 && (await abertos(A)).every((x) => x.id !== ant), 'recuperação: a administradora importa e o rascunho passa a ser DELA (e só dela)');
ok((await c(ADMIN_TESTE, 'importar_rascunho_legado', { p_id: ant, p_chave: 'e:nova', p_dados: { dados: { titulo: 'antigo' } } })).status === 'repetido' && (await abertos(ADMIN_TESTE)).length === 1, 'recuperação: repetir a importação (identificador estável) não duplica e confirma, para o aparelho poder remover a cópia local');
ok((await c(ADMIN_TESTE, 'importar_rascunho_legado', { p_id: randomUUID(), p_chave: 'e:nova', p_dados: { dados: { titulo: 'outro antigo' } } })).status === 'ocupado' && (await abertos(ADMIN_TESTE)).length === 1, 'recuperação: se a chave já está ocupada por um rascunho aberto, nada é sobrescrito e o aparelho é avisado para guardar com outro nome');
ok((await c(ADMIN_TESTE, 'importar_rascunho_legado', { p_id: randomUUID(), p_chave: 'legado:e-nova-2', p_dados: { dados: { titulo: 'outro antigo' } } })).status === 'ok' && (await abertos(ADMIN_TESTE)).length === 2, 'recuperação: com outro nome ("legado:...") o rascunho antigo é guardado ao lado');

await db.close();
process.exit(v.resumo());
