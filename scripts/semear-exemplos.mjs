// Povoa um banco local de TESTE (PGlite) com demandas de EXEMPLO para ver o aplicativo cheio: só dados fictícios, relativos ao dia de hoje em Brasília. Nunca toca o Supabase real
// nem o banco da prévia padrão (.dados-teste/pg): escreve só na pasta informada, que precisa ficar dentro de .dados-teste/ (ignorada pelo Git).
// Repetível: a pasta de exemplos é sempre recriada do zero, então rodar de novo não duplica nada.
// Cobre: atrasada, vence hoje, prazo futuro, sem prazo, sem documento, áreas Geral, Pessoal e Compras, Ofício, conversão de Entrada, origens Prefeita e Gabinete, as seis etapas
// (Cadastro, Vistos, Fazendo, Aguardando retorno, Aguardando Prefeita com e sem alerta, Finalizado), assunto longo e uma demanda com seis tarefas. Todas têm tarefas.
// Uso: npm run semear:exemplos            (pasta padrão .dados-teste/exemplos)
//      node scripts/semear-exemplos.mjs [.dados-teste/outra-pasta]
// Ver a prévia com esses dados: npm run dev:exemplos   (http://localhost:7100, sem tocar no banco da prévia padrão)
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

export const PASTA_EXEMPLOS = '.dados-teste/exemplos';
const USUARIO = '00000000-0000-4000-8000-000000000001';

export async function semearExemplos(pasta = PASTA_EXEMPLOS) {
  const alvo = resolve(pasta), raiz = resolve('.dados-teste');
  const rel = relative(raiz, alvo);
  if (!rel || rel.startsWith('..') || rel.includes(sep + '..') || resolve(raiz, rel) !== alvo) throw new Error(`A pasta de exemplos precisa ficar dentro de .dados-teste/ (recebido: ${pasta}).`);
  if (rel === 'pg') throw new Error('A pasta .dados-teste/pg é o banco da prévia padrão e não pode ser recriada pelos exemplos.');
  rmSync(alvo, { recursive: true, force: true }); // só a própria pasta de exemplos: recriada do zero para não duplicar

  const db = await abrirBancoTeste({ pasta });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const hoje = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const dia = async (n) => (await db.query('select ($1::date + $2::int)::text as d', [hoje, n])).rows[0].d;
  const tarefas = async (id, textos, feitas = 0) => { for (let i = 0; i < textos.length; i++) { const r = await c('adicionar_tarefa', { p_demanda: id, p_texto: textos[i] }); if (i < feitas) await c('marcar_tarefa', { p_id: r.tarefas[i].id, p_concluida: true }); } };
  const mk = async (assunto, o, textos, feitas = 0) => { const d = await c('criar_demanda', { p: { assunto, ...o } }); await tarefas(d.id, textos, feitas); return d; };
  // adicionar a primeira tarefa leva uma demanda de Cadastro para Vistos (regra do aplicativo): estas voltam a Cadastro depois das tarefas, como numa demanda recém-cadastrada
  const emCadastro = async (assunto, o, textos) => { const d = await mk(assunto, o, textos); await c('mover_etapa', { p_id: d.id, p_etapa: 'Cadastro' }); return d; };
  const espera = (id, n) => db.query(`update public.demandas set etapa_desde = (($1::date + time '12:00') at time zone 'America/Sao_Paulo') - interval '${n} days' where id = $2`, [hoje, id]);

  // atrasada, da Prefeita, Processo geral, com seis tarefas, setor e acompanhamento
  await mk('Parecer sobre o reajuste do contrato de limpeza urbana', { tipo: 'Processo', numero: '250/2026', origem: 'Prefeita', area: 'Geral', etapa: 'Fazendo', chegou_em: await dia(-12), prazo_original: await dia(-2), setor: 'Procuradoria', acompanhar_em: await dia(3), descricao: 'Reunir a planilha de custos, conferir o índice de reajuste previsto no contrato e pedir manifestação da Procuradoria antes de responder ao gabinete.' },
    ['Reunir a planilha de custos do último ano', 'Conferir o índice de reajuste no contrato', 'Pedir manifestação da Procuradoria', 'Conferir a vigência do aditivo anterior', 'Levantar os empenhos do exercício', 'Redigir a resposta ao gabinete'], 2);
  // atrasada, prazo legal, Ofício
  await mk('Resposta ao Ofício do Tribunal de Contas', { tipo: 'Ofício', numero: '15/2026', origem: 'Tribunal de Contas', etapa: 'Fazendo', chegou_em: await dia(-15), prazo_original: await dia(-6), prazo_tipo: 'Legal' }, ['Levantar os documentos pedidos', 'Revisar a minuta', 'Protocolar a resposta'], 1);
  // vence hoje, Ofício
  await emCadastro('Ofício sobre a reforma do telhado da escola', { tipo: 'Ofício', numero: '32/2026', origem: 'Secretaria de Educação', etapa: 'Cadastro', chegou_em: await dia(-8), prazo_original: hoje }, ['Conferir o orçamento da obra', 'Responder à Secretaria de Educação']);
  // atrasada, número com o ano na frente (busca por 2026)
  await mk('Resposta ao pedido de informação sobre horas extras', { tipo: 'Memorando', numero: '2026/250', origem: 'Reunião', etapa: 'Vistos', chegou_em: await dia(-20), prazo_original: await dia(-4) }, ['Levantar as horas do mês', 'Responder ao solicitante']);
  // prazo futuro, Protocolo pessoal
  await mk('Licença prêmio da servidora', { tipo: 'Protocolo', numero: '4521/2026', area: 'Pessoal', origem: 'Servidor', etapa: 'Vistos', chegou_em: await dia(-2), prazo_original: await dia(7) }, ['Conferir o tempo de serviço', 'Autorizar o afastamento', 'Avisar a chefia imediata']);
  // sem prazo, Protocolo geral
  await mk('Solicitação de certidão de tempo de serviço', { tipo: 'Protocolo', numero: '4522/2026', area: 'Geral', origem: 'Servidor', etapa: 'Fazendo', chegou_em: await dia(-1) }, ['Emitir a certidão', 'Entregar ao servidor']);
  // Processo de compras
  await mk('Compra de material de expediente', { tipo: 'Processo', numero: '1842/2026', area: 'Compras', origem: 'Setor de Compras', etapa: 'Fazendo', chegou_em: await dia(-5), prazo_original: await dia(12) }, ['Comparar as três propostas', 'Preparar o empenho'], 1);
  // do Gabinete, sem documento, prazo próximo
  await mk('Pedido do Gabinete sobre o calendário de reuniões', { origem: 'Gabinete', etapa: 'Fazendo', prazo_original: await dia(4) }, ['Listar as reuniões do mês', 'Enviar a proposta de calendário']);
  // sem prazo e sem documento
  await emCadastro('Organizar o arquivo da sala de reuniões', { origem: 'Iniciativa própria', etapa: 'Cadastro' }, ['Separar o que vai para o arquivo morto', 'Etiquetar as caixas']);
  // assunto longo, sem documento
  await mk('Levantamento completo das pendências de pagamento de diárias e adicionais dos servidores lotados nas escolas municipais durante o primeiro semestre, com conferência dos empenhos e da folha', { origem: 'Pedido de colega', etapa: 'Vistos', chegou_em: await dia(-3), prazo_original: await dia(9) }, ['Pedir a relação às escolas']);
  // prazo futuro distante
  await mk('Atualizar o inventário de equipamentos', { origem: 'Iniciativa própria', etapa: 'Fazendo', prazo_original: await dia(25) }, ['Contar os computadores', 'Atualizar a planilha'], 1);
  // aguardando retorno do setor
  const ret = await mk('Aguarda o parecer da Contabilidade', { tipo: 'Memorando', numero: '14/2026', origem: 'Gabinete', etapa: 'Aguardando retorno', setor: 'Contabilidade', acompanhar_em: await dia(2) }, ['Cobrar o parecer', 'Registrar o retorno']);
  await c('atualizar_demanda', { p_id: ret.id, p: { encaminhada_em: await dia(-4) } });
  // aguardando a Prefeita: uma com alerta de espera (12 dias) e outra recente (5 dias)
  const p1 = await mk('Decreto de reorganização aguardando a Prefeita', { tipo: 'Ofício', numero: '77/2026', origem: 'Gabinete', etapa: 'Aguardando Prefeita', prazo_original: await dia(20) }, ['Acompanhar a assinatura', 'Publicar o decreto']);
  await espera(p1.id, 12);
  const p2 = await mk('Minuta de portaria aguardando a Prefeita', { tipo: 'Memorando', numero: '21/2026', origem: 'Reunião', etapa: 'Aguardando Prefeita', prazo_original: await dia(25) }, ['Acompanhar a assinatura']);
  await espera(p2.id, 5);
  // finalizada, com todas as tarefas concluídas
  const fin = await mk('Entrega do relatório mensal de atividades', { tipo: 'Memorando', numero: '9/2026', origem: 'Prefeita', etapa: 'Fazendo', chegou_em: await dia(-18), prazo_original: await dia(-9) }, ['Consolidar os dados', 'Revisar o texto'], 2);
  await c('concluir_demanda', { p_id: fin.id });
  // conversão de Entrada: a anotação fica preservada no Arquivo, ligada à demanda criada
  const ent = await c('criar_entrada', { p: { titulo: 'Ideia de capacitação', texto: 'Curso de planilhas para os servidores da Secretaria #capacitacao' } });
  await c('criar_demanda_de_entrada', { p_entrada: ent.id, p: { id: randomUUID(), assunto: 'Capacitação dos servidores em planilhas', tipo: 'Memorando', origem: 'Iniciativa própria', prazo_original: await dia(30) } });
  const conv = (await db.query("select id from public.demandas where assunto = 'Capacitação dos servidores em planilhas'")).rows[0];
  await tarefas(conv.id, ['Levantar o conteúdo do curso', 'Pedir orçamento à escola de governo']);
  // anotações comuns e o humor de hoje
  await c('criar_entrada', { p: { titulo: 'Ligar para o Jurídico', texto: 'Combinar a reunião das 14h #juridico' } });
  await c('criar_entrada', { p: { titulo: 'Lista de compras do gabinete', texto: 'Café e papel' } });
  await db.query('insert into public.registros_dia (user_id, dia, humor) values ($1, $2, 4) on conflict do nothing', [USUARIO, hoje]);

  const resumo = (await db.query('select etapa, count(*)::int as n, sum((select count(*) from public.tarefas t where t.demanda_id = d.id))::int as tarefas, count(*) filter (where not exists (select 1 from public.tarefas t where t.demanda_id = d.id))::int as sem_tarefa from public.demandas d group by etapa order by etapa')).rows;
  await db.close();
  if (resumo.some((r) => r.sem_tarefa > 0)) throw new Error('Há demanda de exemplo sem tarefa.');
  return { pasta, hoje, resumo };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await semearExemplos(process.argv[2] || PASTA_EXEMPLOS);
  console.log(`Exemplos fictícios criados em ${r.pasta} (referência: hoje, ${r.hoje}). Demandas por etapa (com a soma das tarefas):`);
  for (const l of r.resumo) console.log(`  ${l.etapa}: ${l.n} demanda(s), ${l.tarefas} tarefa(s)`);
  console.log('Para ver a prévia com esses dados: npm run dev:exemplos');
}
