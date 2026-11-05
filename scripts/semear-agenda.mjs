// Semeia um banco de TESTE (PGlite) com dados relativos a hoje para a Agenda: demandas com prazos, acompanhamento, retorno do setor, espera pela Prefeita, tarefas, dias indisponíveis e eventos.
// Usado por testar-agenda.mjs. Nunca toca o Supabase real: só abre a pasta de dados de teste informada, antes de o servidor subir.
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

export const USUARIO_TESTE = '00000000-0000-4000-8000-000000000001';

/** `ref` (AAAA-MM-DD) é a data de referência: todas as datas e os instantes ("parada há N dias") nascem dela, não do relógio. Sem ela vale a data do banco (hoje, em Brasília). */
export async function semearAgenda(pasta, ref = null) {
  const db = await abrirBancoTeste({ pasta });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO_TESTE]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  const c = (f, a) => chamarComoUsuario(db, USUARIO_TESTE, f, a);
  const hoje = ref ?? (await db.query('select public.hoje()::text as h')).rows[0].h;
  const mais = async (n) => (await db.query('select ($1::date + $2::int)::text as d', [hoje, n])).rows[0].d;
  // meio-dia de Brasília da data de referência, menos n dias: o instante em que uma demanda "entrou na etapa"
  const instante = (n) => `(($1::date + time '12:00') at time zone 'America/Sao_Paulo') - interval '${n} days'`;
  const tarefas = async (id, n, feitas = 0) => { for (let i = 0; i < n; i++) { const r = await c('adicionar_tarefa', { p_demanda: id, p_texto: `Tarefa ${i + 1}` }); if (i < feitas) await c('marcar_tarefa', { p_id: r.tarefas[i].id, p_concluida: true }); } };
  const dem = async (assunto, o = {}) => (await c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: o.numero ?? '', ...o } }));
  const r = { hoje };

  // sem fins de semana nos dias de teste: escolhemos datas e deixamos o banco ajustar; os testes leem o vencimento gravado
  const a = await dem('Resposta ao Tribunal', { numero: '101/2026', prazo_original: await mais(3), prazo_tipo: 'Legal', etapa: 'Fazendo' }); await tarefas(a.id, 3, 1); r.a = await c('buscar_demanda', { p_id: a.id });
  const b = await dem('Relatório atrasado', { numero: '102/2026', prazo_original: await mais(-2), etapa: 'Fazendo' }); await tarefas(b.id, 1); r.b = await c('buscar_demanda', { p_id: b.id });
  const sem = await dem('Sem nenhuma data', { numero: '103/2026', etapa: 'Fazendo' }); r.sem = sem;
  const d = await dem('Aguarda a Contabilidade', { numero: '104/2026', etapa: 'Aguardando retorno', setor: 'Contabilidade', acompanhar_em: await mais(2) });
  await c('atualizar_demanda', { p_id: d.id, p: { encaminhada_em: await mais(-4) } }); await tarefas(d.id, 2); r.d = await c('buscar_demanda', { p_id: d.id });
  const e = await dem('Aguarda a Prefeita há muito', { numero: '105/2026', etapa: 'Aguardando Prefeita', prazo_original: await mais(20) });
  await db.query(`update public.demandas set etapa_desde = ${instante(12)} where id = '${e.id}'`, [hoje]); r.e = await c('buscar_demanda', { p_id: e.id });
  const f = await dem('Aguarda a Prefeita há pouco', { numero: '106/2026', etapa: 'Aguardando Prefeita', prazo_original: await mais(25) });
  await db.query(`update public.demandas set etapa_desde = ${instante(5)} where id = '${f.id}'`, [hoje]); r.f = await c('buscar_demanda', { p_id: f.id });
  const g = await dem('Já finalizada', { numero: '107/2026', prazo_original: await mais(1), etapa: 'Fazendo' }); await tarefas(g.id, 2); await c('concluir_demanda', { p_id: g.id }); r.g = await c('buscar_demanda', { p_id: g.id });
  const h = await dem('Pacote grande de tarefas', { numero: '108/2026', prazo_original: await mais(9), etapa: 'Fazendo' }); await tarefas(h.id, 9); r.h = await c('buscar_demanda', { p_id: h.id });
  const dia = await c('salvar_dia_indisponivel', { p: { data: await mais(7), descricao: 'Feriado de teste', categoria: 'Feriado' } }); r.dia = dia.dia;

  await db.query(`update public.demandas set etapa_desde = ${instante(0)} where id not in ('${e.id}', '${f.id}')`, [hoje]);
  for (const k of ['a', 'b', 'sem', 'd', 'e', 'f', 'g', 'h']) r[k] = await c('buscar_demanda', { p_id: r[k].id }); // relê: a etapa_desde mudou

  const ev = async (o) => c('criar_evento', { p: { tipo: 'Reunião', ...o } });
  r.ev1 = await ev({ titulo: 'Reunião de secretariado', data: hoje, inicio: '09:00', fim: '10:00', aviso_min: 15 });
  r.ev2 = await ev({ titulo: 'Visita técnica', tipo: 'Compromisso', data: hoje, inicio: '09:30', fim: '11:00', aviso_min: null });
  r.ev3 = await ev({ titulo: 'Dia do servidor', tipo: 'Lembrete', data: await mais(1), dia_inteiro: true, aviso_min: 0 });
  r.ev4 = await ev({ titulo: 'Almoço com a prefeita', tipo: 'Compromisso', data: hoje, inicio: '12:30', fim: null, aviso_min: 30 });
  await db.close();
  return r;
}
