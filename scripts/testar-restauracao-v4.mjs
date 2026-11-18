// Restauração da cópia v4 em ambiente ISOLADO (subbloco 1.4), de ponta a ponta e só com dados fictícios:
//   (1) um banco de teste é semeado com todos os tipos de dado da v4 (e com o que a v4 NÃO leva: humor do dia, vagas do Para hoje e opções);
//   (2) a ROTA REAL do aplicativo (/api/exportar, rodando contra esse banco) gera o arquivo; ele é conferido contra o contrato (chaves, sem identidade da conta);
//   (3) o arquivo é restaurado, com o supabase/restaurar-copia.sql de verdade, num banco NOVO, com outra conta (outro identificador e outro e-mail);
//   (4) o conteúdo restaurado é conferido campo a campo contra o arquivo, e o que a v4 deixa de fora por contrato é conferido como ausente;
//   (5) o restaurado é USADO pelas operações pelo caminho real da entrada direta (executar_como_titular, como o servidor): marcar tarefa, edição com versão, calendário, reabrir,
//       eventos, anotações, vagas do Para hoje, rotina diária e uma segunda restauração por cima.
// Nunca toca o Supabase real nem as cópias privadas: o banco de origem fica em .dados-teste/restauracao-v4 e o destino é em memória.
// Uso: node scripts/testar-restauracao-v4.mjs
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { ajustarPrazo } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_RESTAURACAO || '7142', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/restauracao-v4';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const erroDe = async (p) => { try { await p; return null; } catch (e) { return e.message || String(e); } };
const ordenar = (l) => [...l].sort((a, b) => a.id.localeCompare(b.id));
const chaves = (o) => (o && typeof o === 'object' ? Object.keys(o).flatMap((k) => [k, ...chaves(o[k])]) : []);

// ---------- (1) origem: dados fictícios de todos os tipos que a v4 leva e dos que ela deixa de fora ----------
// o aplicativo em modo de teste (DMANDA_BANCO=teste) atua sempre como este usuário fixo (o mesmo de semear-agenda.mjs)
const ORIGEM = '00000000-0000-4000-8000-000000000001', EMAIL_ORIGEM = 'teste@dmanda.local';
const origem = await abrirBancoTeste({ pasta: PASTA });
await origem.query("insert into auth.users (id, email) values ($1, $2)", [ORIGEM, EMAIL_ORIGEM]);
await origem.query("insert into dmanda_privado.acesso_autorizado (email) values ($1)", [EMAIL_ORIGEM]);
const co = (f, a) => chamarComoUsuario(origem, ORIGEM, f, a);
const hojeSql = (await origem.query('select public.hoje()::text as h')).rows[0].h;
await co('salvar_dia_indisponivel', { p: { data: '2026-11-20', descricao: 'Consciência Negra', categoria: 'Feriado' } });
await co('salvar_dia_indisponivel', { p: { data: '2026-11-26', descricao: 'Congresso fictício', categoria: 'Evento externo' } });
const periodo = await co('salvar_periodo_indisponivel', { p: { operacao_id: 'ab0d00aa-0000-4000-8000-0000000000b1', data_inicio: '2026-12-24', data_fim: '2026-12-26', descricao: 'Recesso fictício', categoria: 'Feriado' } });   // um período (três linhas ligadas por periodo_id)
const tarefas = async (id, textos, feitas = 0) => { for (let i = 0; i < textos.length; i++) { const r = await co('adicionar_tarefa', { p_demanda: id, p_texto: textos[i] }); if (i < feitas) await co('marcar_tarefa', { p_id: r.tarefas[i].id, p_concluida: true }); } };
const d1 = await co('criar_demanda', { p: { tipo: 'Processo', numero: '1842/2026', origem: 'TCE-RS', assunto: 'Resposta "ao" TCE d\'Água $$', descricao: 'linha 1\nlinha 2 com $dmanda e \\ barra', chegou_em: '2026-11-02', prazo_dias: 20, prazo_tipo: 'Legal' } });
await tarefas(d1.id, ['Levantar diárias á', 'Conferir "contas"', "Redigir d'resposta"], 1);
const d2 = await co('criar_demanda', { p: { tipo: 'Memorando', assunto: 'Memorando rápido', rapida: true, documento_ano: 2026, prazo_original: '2026-11-27', origem: 'Câmara' } });
const d3 = await co('criar_demanda', { p: { assunto: 'Aguarda a PGM', setor: 'PGM', acompanhar_em: '2026-11-12', etapa: 'Aguardando retorno' } });
await co('atualizar_demanda', { p_id: d3.id, p: { encaminhada_em: '2026-11-04', reiterada_em: '2026-11-09' } }); await tarefas(d3.id, ['Cobrar retorno']);
const d4 = await co('criar_demanda', { p: { assunto: 'Aguarda a Prefeita', etapa: 'Aguardando Prefeita', prazo_original: '2026-12-04' } });
const d5 = await co('criar_demanda', { p: { assunto: 'Já finalizada', tipo: 'Portaria', prazo_original: '2026-11-10' } }); await tarefas(d5.id, ['Única', 'Outra'], 2); await co('concluir_demanda', { p_id: d5.id });
const d6 = await co('criar_demanda', { p: { assunto: 'Arquivada', area: 'Compras', prazo_original: '2026-11-18' } }); await tarefas(d6.id, ['Tarefa arquivada']); await co('arquivar_demanda', { p_id: d6.id });
const d7 = await co('criar_demanda', { p: { assunto: 'Sem prazo e sem chegada' } });
const d8 = await co('criar_demanda', { p: { assunto: 'Prazo legado', prazo_original: '2026-11-30' } });
await origem.query("update public.demandas set prazo_legado = true, prazo_tipo = 'Legal' where id = $1", [d8.id]);
const en1 = await co('criar_entrada', { p: { titulo: 'Título "com" aspas', texto: 'Texto á $$ \\ #tag\nsegunda linha', cor: 3, fixada: true } });
const en2 = await co('criar_entrada', { p: { texto: 'Arquivada #velha', cor: 1 } }); await co('arquivar_entrada', { p_id: en2.id });
const en3 = await co('criar_entrada', { p: { titulo: 'Virou demanda', texto: 'Conteúdo original preservado', cor: 5 } });
const dEn = await co('criar_demanda_de_entrada', { p_entrada: en3.id, p: { id: 'abababab-1212-4212-8212-abababababab', assunto: 'Virou demanda', descricao: 'Conteúdo original preservado' } });
const ev1 = await co('criar_evento', { p: { titulo: 'Reunião de secretariado', tipo: 'Reunião', data: '2026-11-18', inicio: '09:00', fim: '10:00', aviso_min: 15 } });
await co('criar_evento', { p: { titulo: 'Dia do servidor', tipo: 'Lembrete', data: '2026-11-19', dia_inteiro: true, aviso_min: 0 } });
await co('criar_evento', { p: { titulo: 'Almoço sem fim', tipo: 'Compromisso', data: '2026-11-18', inicio: '12:30', fim: null, aviso_min: null } });
// o que a v4 NÃO leva (por contrato): humor do dia, vagas do Para hoje, opções cadastradas
await co('registrar_dias', { p: [{ dia: hojeSql, humor: 4 }] });
await co('atualizar_para_hoje', { p_candidatas: [d1.id, d2.id, d3.id] });
await co('criar_opcao', { p_campo: 'origem', p_nome: 'Origem só nas opções (nenhuma demanda usa)' });
const contar = async (db, t) => (await db.query(`select count(*)::int as n from public.${t}`)).rows[0].n;
const foraOrigem = { registros_dia: await contar(origem, 'registros_dia'), para_hoje: await contar(origem, 'para_hoje'), opcoes: await contar(origem, 'opcoes') };
ok(foraOrigem.registros_dia === 1 && foraOrigem.para_hoje === 3 && foraOrigem.opcoes >= 1, `origem: semeada com os dados que a v4 leva e com o que ela não leva (humor ${foraOrigem.registros_dia}, vagas ${foraOrigem.para_hoje}, opções ${foraOrigem.opcoes})`);
const listar = async (f, a) => JSON.parse(JSON.stringify(await co(f, a)));
const esperado = { demandas: await listar('listar_demandas', { p_arquivadas: false }), arquivadas: await listar('listar_demandas', { p_arquivadas: true }), dias_indisponiveis: await listar('listar_dias_indisponiveis', {}), entradas: await listar('listar_entradas', { p_arquivadas: false }), entradas_arquivadas: await listar('listar_entradas', { p_arquivadas: true }), eventos: await listar('listar_eventos', {}) };
await origem.close();

// ---------- (2) a rota real gera o arquivo ----------
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }
const resp = await fetch(BASE + '/api/exportar'); const textoCopia = await resp.text(); parar();
const copia = JSON.parse(textoCopia);
ok(resp.status === 200 && /attachment; filename="dmanda-copia-\d{4}-\d{2}-\d{2}\.json"/.test(resp.headers.get('content-disposition') ?? '') && resp.headers.get('cache-control') === 'no-store', 'exportação: a rota real responde 200 como arquivo para baixar, sem cache');
ok(copia.formato === 'dmanda-exportacao' && copia.versao === 4 && copia.fuso === 'America/Sao_Paulo' && Object.keys(copia).join() === 'formato,versao,exportado_em,fuso,demandas,arquivadas,dias_indisponiveis,entradas,entradas_arquivadas,eventos', 'contrato v4: formato, versão, fuso e exatamente estas seções: demandas (com as tarefas), arquivadas, dias_indisponiveis, entradas, entradas_arquivadas, eventos');
ok(JSON.stringify(Object.fromEntries(Object.keys(esperado).map((k) => [k, copia[k]]))) === JSON.stringify(esperado), 'exportação: cada seção do arquivo é exatamente o que as funções de leitura devolvem ao titular (mesmos campos, mesma ordem)');
ok(!chaves(copia).includes('user_id') && !textoCopia.includes(ORIGEM) && !textoCopia.includes(EMAIL_ORIGEM), 'contrato v4: o arquivo não traz a identidade da conta (nem user_id, nem o identificador, nem o e-mail)');
ok(copia.demandas.length === 8 && copia.arquivadas.length === 1 && copia.demandas.concat(copia.arquivadas).reduce((n, d) => n + d.tarefas.length, 0) === 7 && copia.entradas.length === 1 && copia.entradas_arquivadas.length === 2 && copia.eventos.length === 3 && copia.dias_indisponiveis.length === 5, 'exportação: 8 demandas ativas e 1 arquivada (7 tarefas), 1 anotação ativa e 2 no Arquivo, 3 eventos e 5 dias indisponíveis (2 avulsos e um período de 3 dias)');
ok(copia.dias_indisponiveis.filter((x) => x.periodo_id === periodo.periodo_id).length === 3 && copia.dias_indisponiveis.filter((x) => 'periodo_id' in x).length === 3 && copia.dias_indisponiveis.filter((x) => !('periodo_id' in x)).every((x) => Object.keys(x).sort().join() === 'categoria,criado_em,data,descricao,id'), 'contrato v4: os dias de um período saem com o periodo_id (chave opcional nova) e os dias avulsos mantêm exatamente as cinco chaves de sempre');

// ---------- (3) destino isolado: banco novo, outra conta ----------
const DESTINO = '00000000-0000-4000-8000-0000000000b2', EMAIL_DESTINO = 'destino.ficticio@dmanda.local';
const SQL = readFileSync('supabase/restaurar-copia.sql', 'utf8');
const restaurar = (db, json) => db.exec(SQL.replace('__COLE_AQUI_O_JSON__', () => (typeof json === 'string' ? json : JSON.stringify(json))));
const dest = await abrirBancoTeste();
await dest.query('insert into auth.users (id, email) values ($1, $2)', [DESTINO, EMAIL_DESTINO]);
await dest.query('insert into dmanda_privado.acesso_autorizado (email) values ($1)', [EMAIL_DESTINO]);
const t0 = (await dest.query('select now() as t')).rows[0].t;
ok(await erroDe(restaurar(dest, textoCopia)) === null, 'restauração: o SQL real roda sem erro com o arquivo que a rota gerou (o texto exato do download, colado como o procedimento manda)');
// o caminho real da entrada direta: o servidor chama executar_como_titular com a chave de serviço
const via = (f, a = {}) => dest.transaction(async (tx) => { await tx.exec('set local role service_role'); return (await tx.query('select public.executar_como_titular($1, $2::jsonb) as r', [f, JSON.stringify(a)])).rows[0].r; });
const lido = async () => ({ demandas: await via('listar_demandas', { p_arquivadas: false }), arquivadas: await via('listar_demandas', { p_arquivadas: true }), dias_indisponiveis: await via('listar_dias_indisponiveis'), entradas: await via('listar_entradas', { p_arquivadas: false }), entradas_arquivadas: await via('listar_entradas', { p_arquivadas: true }), eventos: await via('listar_eventos') });
let r = await lido();
const igual = (a, b) => ['demandas', 'arquivadas', 'dias_indisponiveis', 'entradas', 'entradas_arquivadas', 'eventos'].map((k) => JSON.stringify(ordenar(a[k])) === JSON.stringify(ordenar(b[k]))).every(Boolean);
ok(igual(r, copia), 'conteúdo: visto pelo titular da conta nova (pelo caminho do servidor), tudo voltou idêntico ao arquivo: campos, datas, etapas, tarefas e ordem, prazos ajustados e originais, contagem por duração, legado, Rápida, ano, setor, acompanhamento, encaminhamento e reiteração, eventos e anotações');
const porId = (l, id) => l.find((x) => x.id === id);
const c1 = porId(r.demandas, d1.id), c8 = porId(r.demandas, d8.id), c7 = porId(r.demandas, d7.id);
ok(r.demandas.length + r.arquivadas.length === 9 && c1.prazo_dias === 20 && c1.prazo_base_em === '2026-11-02' && /20\/11 feriado/.test(c1.prazo_ajuste) && c8.prazo_legado === true && c7.prazo === null && c7.chegou_em === null,'conteúdo: a contagem por duração (base e dias), o ajuste explicado, o legado e a demanda sem prazo e sem chegada (nada inventado) voltaram como estavam');
ok(porId(r.demandas, d2.id).rapida === true && porId(r.demandas, d2.id).documento_ano === 2026 && porId(r.demandas, d3.id).encaminhada_em === '2026-11-04' && porId(r.demandas, d3.id).reiterada_em === '2026-11-09' && porId(r.demandas, d3.id).setor === 'PGM' && porId(r.demandas, d5.id).etapa === 'Finalizado' && porId(r.demandas, d5.id).concluida_em !== null && porId(r.arquivadas, d6.id).arquivada_em !== null, 'conteúdo: Rápida, ano, encaminhamento, reiteração, setor, a demanda finalizada (com a data de conclusão) e a arquivada voltaram como estavam');
ok(porId(r.demandas, d1.id).tarefas.map((t) => t.texto).join('|') === "Levantar diárias á|Conferir \"contas\"|Redigir d'resposta" && porId(r.demandas, d1.id).tarefas.map((t) => t.concluida).join() === 'true,false,false' && porId(r.demandas, d1.id).assunto === d1.assunto && porId(r.demandas, d1.id).descricao === d1.descricao, 'conteúdo: tarefas na ordem, com acentos, aspas e as concluídas; assunto e descrição com aspas, cifrão, barra e quebra de linha idênticos');
ok(porId(r.demandas, dEn.id).entrada_id === en3.id && r.entradas_arquivadas.some((x) => x.id === en3.id && x.demanda_id === dEn.id), 'vínculos: a anotação que virou demanda continua ligada à sua demanda, nos dois sentidos');
// identidade e o que a v4 não leva
const donos = (await dest.query("select (select count(distinct user_id) from public.demandas)::int d, (select count(distinct user_id) from public.tarefas)::int t, (select count(distinct user_id) from public.entradas)::int e, (select count(distinct user_id) from public.eventos)::int v, (select count(distinct user_id) from public.dias_indisponiveis)::int x, (select count(*) from public.demandas where user_id <> $1)::int outros", [DESTINO])).rows[0];
ok(donos.outros === 0 && donos.d === 1 && donos.t === 1 && donos.e === 1 && donos.v === 1 && donos.x === 1, 'identidade: tudo passou a pertencer à conta do projeto novo (outro identificador, outro e-mail); nada ficou com o dono da origem');
const tar = (await dest.query('select min(criado_em) as c, count(*)::int as n from public.tarefas')).rows[0];
ok(tar.n === 7 && new Date(tar.c) >= new Date(t0), 'fora do contrato: a data de criação de cada tarefa não vem na cópia e passa a ser o momento da restauração (a ordem continua a das posições)');
const fora = { registros_dia: await contar(dest, 'registros_dia'), para_hoje: await contar(dest, 'para_hoje'), execucoes_rotina: await contar(dest, 'execucoes_rotina'), opcoesComTexto: (await dest.query("select count(*)::int n from public.opcoes where nome like 'Origem só nas opções%'")).rows[0].n };
ok(fora.registros_dia === 0 && fora.para_hoje === 0 && fora.execucoes_rotina === 0 && fora.opcoesComTexto === 0, 'fora do contrato (documentado): o humor do dia, as vagas do Para hoje, a opção cadastrada sem uso e o registro da rotina NÃO voltam (privado, recomposto ou derivado)');
ok(porId(r.demandas, d1.id).origem === 'TCE-RS' && porId(r.demandas, d1.id).tipo === 'Processo', 'fora do contrato (documentado): a origem e o tipo de cada demanda restaurada continuam no texto da própria demanda');
const resumo = (await dest.query('select origem, dados from public.resumos_operacionais where user_id = $1', [DESTINO])).rows;
ok(resumo.length === 1 && resumo[0].origem === 'alteracao' && resumo[0].dados.abertas >= 1, 'derivado: o resumo do dia é recalculado sozinho pelo banco ao restaurar as demandas (não vem na cópia)');

// ---------- (5) o restaurado é usado pelas operações, pelo caminho real ----------
const hojeDest = (await dest.query('select public.hoje()::text as h')).rows[0].h;
// marcar tarefa e a edição com versão
const pend = porId(r.demandas, d1.id).tarefas.find((t) => !t.concluida);
const marc = await via('marcar_tarefa', { p_id: pend.id, p_concluida: true });
ok(marc.tarefas.find((t) => t.id === pend.id).concluida === true && marc.versao > porId(r.demandas, d1.id).versao, 'uso: marcar uma tarefa restaurada funciona e sobe a versão da demanda');
const stale = await erroDe(via('salvar_demanda', { p_id: d1.id, p: { assunto: 'NÃO DEVE GRAVAR' }, p_tarefas: null, p_versao: porId(r.demandas, d1.id).versao }));
ok(/outro aparelho ou janela/.test(stale ?? '') && porId(await via('listar_demandas', { p_arquivadas: false }), d1.id).assunto === d1.assunto, 'uso: a versão restaurada vale para a edição simultânea: salvar com a versão da cópia (já superada) é recusado e nada é gravado');
const salvo = await via('salvar_demanda', { p_id: d1.id, p: { assunto: 'Editada depois de restaurar' }, p_tarefas: marc.tarefas.map(({ id, texto, concluida }) => ({ id, texto, concluida })), p_versao: marc.versao });
ok(salvo.assunto === 'Editada depois de restaurar' && salvo.tarefas.length === 3, 'uso: salvar com a versão atual funciona e mantém as três tarefas');
const nova = await via('adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Tarefa nova depois de restaurar' });
ok(nova.tarefas.length === 4 && nova.tarefas[3].posicao === 4 && nova.tarefas[3].texto === 'Tarefa nova depois de restaurar', 'uso: uma tarefa nova entra no fim, com a posição seguinte à última restaurada');
// calendário: o vencimento restaurado é recalculado a partir do prazo original restaurado
await via('salvar_dia_indisponivel', { p: { data: '2026-11-19', descricao: 'Ponto facultativo fictício', categoria: 'Feriado' } });
const diasAgora = await via('listar_dias_indisponiveis');
const d1Agora = porId(await via('listar_demandas', { p_arquivadas: false }), d1.id);
const esperadoPrazo = ajustarPrazo(d1Agora.prazo_original, diasAgora);
ok(d1Agora.prazo_original === '2026-11-22' && d1Agora.prazo === esperadoPrazo.prazo && d1Agora.prazo === '2026-11-18' && d1Agora.prazo_ajuste === esperadoPrazo.ajuste, 'uso: cadastrar um dia indisponível recalcula o vencimento da demanda restaurada a partir do prazo original restaurado (22/11 antecipa para 18/11)');
// reabrir a finalizada restaurada
const reab = await via('mover_etapa', { p_id: d5.id, p_etapa: 'Fazendo' });
ok(reab.etapa === 'Fazendo' && reab.concluida_em === null && reab.tarefas.every((t) => t.concluida) && reab.prazo === ajustarPrazo(reab.prazo_original, diasAgora).prazo, 'uso: reabrir a demanda finalizada restaurada limpa a conclusão, mantém as tarefas como estavam e confere o vencimento no calendário vigente');
// eventos e anotações: a versão restaurada vale
const evR = porId(await via('listar_eventos'), ev1.id);
const evStale = await erroDe(via('salvar_evento', { p_id: ev1.id, p: { titulo: 'x' }, p_versao: evR.versao + 5 }));
const evOk = await via('salvar_evento', { p_id: ev1.id, p: { titulo: 'Reunião alterada depois de restaurar', tipo: evR.tipo, data: evR.data, dia_inteiro: evR.dia_inteiro, inicio: evR.inicio, fim: evR.fim, descricao: evR.descricao, aviso_min: evR.aviso_min }, p_versao: evR.versao });
ok(!!evStale && evOk.titulo === 'Reunião alterada depois de restaurar' && evOk.versao === evR.versao + 1, 'uso: o evento restaurado só aceita edição com a versão certa e a versão sobe');
const enA = porId(await via('listar_entradas', { p_arquivadas: false }), en1.id);
const enOk = await via('salvar_entrada', { p_id: en1.id, p: { texto: 'Anotação alterada depois de restaurar' }, p_versao: enA.versao });
const enConv = await erroDe(via('salvar_entrada', { p_id: en3.id, p: { texto: 'não pode' }, p_versao: 1 }));
ok(enOk.texto === 'Anotação alterada depois de restaurar' && enOk.fixada === true && /já virou demanda/.test(enConv ?? ''), 'uso: a anotação ativa restaurada é editável (e continua fixada); a que virou demanda continua preservada e sem edição');
// criar depois de restaurar, vagas e rotina
const criada = await via('criar_demanda', { p: { assunto: 'Criada depois de restaurar' } });
ok(!!criada.id && ![d1, d2, d3, d4, d5, d6, d7, d8, dEn].some((x) => x.id === criada.id) && (await via('listar_demandas', { p_arquivadas: false })).length === 9, 'uso: criar uma demanda nova depois de restaurar funciona, sem colisão de identificador');
const vagas = await via('atualizar_para_hoje', { p_candidatas: [d1.id, d2.id, d3.id, d4.id, d7.id] });
ok(vagas.length === 4, 'uso: as vagas do Para hoje, que a cópia não leva, são recompostas a partir das demandas restauradas (as quatro vagas)');
const rot = await dest.transaction(async (tx) => { await tx.exec('set local role service_role'); return (await tx.query('select public.rotina_diaria() as r')).rows[0].r; });
const ativas = await via('listar_demandas', { p_arquivadas: false });
const sr = (await dest.query('select dados from public.resumos_operacionais where user_id = $1 and data_ref = $2', [DESTINO, hojeDest])).rows[0].dados;
const abertas = ativas.filter((d) => d.etapa !== 'Finalizado'), finais = ativas.filter((d) => d.etapa === 'Finalizado');
ok(rot.usuarios === 1 && sr.abertas === abertas.length && sr.finalizadas === finais.length && sr.aguardando_retorno === abertas.filter((d) => d.etapa === 'Aguardando retorno').length && sr.aguardando_prefeita === abertas.filter((d) => d.etapa === 'Aguardando Prefeita').length && sr.sem_prazo === abertas.filter((d) => d.etapa !== 'Aguardando retorno' && d.prazo === null).length, `uso: a rotina diária roda sobre os dados restaurados e o resumo bate com as demandas (${sr.abertas} abertas, ${sr.finalizadas} finalizada(s), ${sr.aguardando_retorno} aguardando retorno, ${sr.sem_prazo} sem prazo)`);
// segunda restauração por cima: nada do que mudou é sobrescrito, nada duplica
const antes2 = JSON.stringify(await lido());
ok(await erroDe(restaurar(dest, textoCopia)) === null && JSON.stringify(await lido()) === antes2, 'idempotência: restaurar o mesmo arquivo por cima, depois de editar, não sobrescreve nem duplica nada (as edições, a tarefa nova e a demanda criada continuam)');
// RLS: outra conta no projeto não enxerga nada
await dest.query("insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c3', 'intruso@dmanda.local')");
const intruso = await chamarComoUsuario(dest, '00000000-0000-4000-8000-0000000000c3', 'listar_demandas', { p_arquivadas: false });
ok(intruso.length === 0, 'isolamento: uma conta que não é a do titular não lê nenhuma demanda restaurada');
await dest.close();

console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
