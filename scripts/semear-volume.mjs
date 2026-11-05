// Semeia um banco de TESTE (PGlite) com um volume escolhido de dados fictícios, relativos a hoje. Usado por medir-desempenho.mjs e testar-resistencia.mjs.
// Nunca toca o Supabase real: só abre a pasta de teste informada, antes de o servidor subir.
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

export const USUARIO_TESTE = '00000000-0000-4000-8000-000000000001';
// demandas ativas, tarefas por demanda, demandas arquivadas, entradas, entradas arquivadas, eventos, dias indisponíveis
export const VOLUMES = {
  vazio: { demandas: 0, tarefas: 0, arquivadas: 0, entradas: 0, entradasArq: 0, eventos: 0, dias: 0 },
  pequeno: { demandas: 15, tarefas: 3, arquivadas: 5, entradas: 12, entradasArq: 3, eventos: 15, dias: 8 },
  medio: { demandas: 80, tarefas: 4, arquivadas: 60, entradas: 120, entradasArq: 40, eventos: 150, dias: 30 },
  grande: { demandas: 300, tarefas: 5, arquivadas: 400, entradas: 600, entradasArq: 300, eventos: 800, dias: 60 },
};
const ETAPAS = ['Cadastro', 'Fazendo', 'Fazendo', 'Aguardando retorno', 'Aguardando Prefeita', 'Finalizado'];
const TIPOS = ['Ofício', 'Memorando', 'Processo', 'Protocolo'];

export async function semearVolume(pasta, nome) {
  const v = VOLUMES[nome];
  const db = await abrirBancoTeste({ pasta });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO_TESTE]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  const c = (f, a) => chamarComoUsuario(db, USUARIO_TESTE, f, a);
  const mais = async (n) => (await db.query('select (public.hoje() + $1::int)::text as d', [n])).rows[0].d;
  const hoje = await mais(0);
  for (let i = 0; i < v.demandas + v.arquivadas; i++) {
    const etapa = ETAPAS[i % ETAPAS.length];
    const dados = { assunto: `Demanda fictícia ${i + 1}: assunto com texto de tamanho razoável para o card`, tipo: TIPOS[i % TIPOS.length], numero: `${i + 1}/2026`, origem: 'Gabinete', descricao: 'Descrição fictícia da demanda para o teste de volume. '.repeat(3), chegou_em: await mais(-(i % 40)), prazo_original: i % 7 === 0 ? undefined : await mais((i % 50) - 10), prazo_tipo: i % 5 === 0 ? 'Legal' : 'Próprio', etapa: etapa === 'Finalizado' ? 'Fazendo' : etapa };
    if (etapa === 'Aguardando retorno') dados.setor = 'Contabilidade';
    const d = await c('criar_demanda', { p: dados });
    for (let t = 0; t < v.tarefas; t++) { const r = await c('adicionar_tarefa', { p_demanda: d.id, p_texto: `Tarefa fictícia ${t + 1} da demanda ${i + 1}` }); if (t % 2 === 0 && etapa !== 'Cadastro') await c('marcar_tarefa', { p_id: r.tarefas[t].id, p_concluida: true }); }
    if (i >= v.demandas) { await c('concluir_demanda', { p_id: d.id }); await c('arquivar_demanda', { p_id: d.id }); }
    else if (etapa === 'Finalizado') await c('concluir_demanda', { p_id: d.id });
  }
  for (let i = 0; i < v.entradas + v.entradasArq; i++) {
    const e = await c('criar_entrada', { p: { titulo: i % 3 ? `Entrada ${i + 1}` : '', texto: `Texto fictício da entrada ${i + 1} #tag${i % 9} #geral. `.repeat(1 + (i % 4)), cor: i % 5, fixada: i % 17 === 0 } });
    if (i >= v.entradas) await c('arquivar_entrada', { p_id: e.id });
  }
  for (let i = 0; i < v.eventos; i++) {
    const dia = i - Math.floor(v.eventos / 2);
    const h = 7 + (i % 10);
    await c('criar_evento', { p: { titulo: `Evento fictício ${i + 1}`, tipo: ['Reunião', 'Compromisso', 'Lembrete'][i % 3], data: await mais(Math.round(dia / 4)), inicio: `${String(h).padStart(2, '0')}:00`, fim: `${String(h + 1).padStart(2, '0')}:00`, aviso_min: i % 4 ? null : 15 } });
  }
  for (let i = 0; i < v.dias; i++) await c('salvar_dia_indisponivel', { p: { data: await mais(3 + i * 5), descricao: `Dia fictício ${i + 1}`, categoria: 'Feriado' } });
  await db.close();
  return { hoje, ...v };
}
