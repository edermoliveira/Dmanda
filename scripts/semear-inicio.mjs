// Cenários fictícios do Início (decisão 64), cada um num banco de TESTE separado dentro de .dados-teste/ (ignorada pelo Git). Nunca toca o Supabase real nem .dados-teste/pg e .dados-teste/exemplos.
//   completo       : a prévia para avaliar. As 16 demandas de exemplo com as quatro vagas ocupadas, duas prioridades (Prefeita e Gabinete) fora das vagas (abrem a Nova urgência) e o calendário com as seis
//                    categorias, um dia com cinco delas juntas, um feriado que antecipa um vencimento e datas de pagamento
//   4-vagas        : só as demandas de exemplo (quatro vagas preenchidas pelo Início)
//   3-vagas        : só três demandas abertas elegíveis (o Início mostra três vagas)
//   fora-das-vagas : quatro vagas já ocupadas por comuns e pedidos da Prefeita elegíveis fora delas
// Atenção: cada cenário recria a própria pasta; pare antes qualquer servidor que esteja usando essa pasta.
// Uso: node scripts/semear-inicio.mjs [completo|4-vagas|3-vagas|fora-das-vagas|todos]. Ver: DMANDA_PASTA_TESTE=.dados-teste/inicio-completo npm run dev:exemplos
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { semearExemplos } from './semear-exemplos.mjs';

export const CENARIOS = { completo: '.dados-teste/inicio-completo', '4-vagas': '.dados-teste/inicio-4-vagas', '3-vagas': '.dados-teste/inicio-3-vagas', 'fora-das-vagas': '.dados-teste/inicio-fora-das-vagas' };
const USUARIO = '00000000-0000-4000-8000-000000000001';
const ABRIR = "etapa <> 'Finalizado' and arquivada_em is null";
const somar = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
const util = (iso) => { const s = new Date(`${iso}T00:00:00Z`).getUTCDay(); return s !== 0 && s !== 6; };
/** O primeiro dia útil a partir da data (sábado e domingo ficam de fora). */
const proximoUtil = (iso) => { let d = iso; while (!util(d)) d = somar(d, 1); return d; };

export async function semearCenario(nome, pasta = CENARIOS[nome]) {
  if (!CENARIOS[nome]) throw new Error(`Cenário desconhecido: ${nome}`);
  await semearExemplos(pasta);   // recria só a própria pasta, sempre dentro de .dados-teste/ e nunca a pasta pg
  if (nome === '4-vagas') return pasta;
  const db = await abrirBancoTeste({ pasta });
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const id = async (assunto) => (await db.query('select id from public.demandas where assunto = $1', [assunto])).rows[0].id;
  if (nome === '3-vagas') {
    const manter = [await id('Parecer sobre o reajuste do contrato de limpeza urbana'), await id('Resposta ao Ofício do Tribunal de Contas'), await id('Ofício sobre a reforma do telhado da escola')];
    await db.query(`update public.demandas set arquivada_em = now() where ${ABRIR} and id <> all($1::uuid[])`, [manter]);
  } else if (nome === 'fora-das-vagas') {
    const comuns = [await id('Resposta ao Ofício do Tribunal de Contas'), await id('Resposta ao pedido de informação sobre horas extras'), await id('Ofício sobre a reforma do telhado da escola'), await id('Licença prêmio da servidora')];
    for (let i = 0; i < comuns.length; i++) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, comuns[i]]);
  } else if (nome === 'completo') {
    const hoje = (await db.query('select public.hoje()::text as h')).rows[0].h;
    // as quatro vagas já ocupadas (duas prioridades e duas vencidas comuns): as outras prioridades elegíveis ficam FORA das vagas e abrem a Nova urgência, antes da urgência comum
    const vagas = [await id('Parecer sobre o reajuste do contrato de limpeza urbana'), await id('Decreto de reorganização aguardando a Prefeita'), await id('Resposta ao Ofício do Tribunal de Contas'), await id('Resposta ao pedido de informação sobre horas extras')];
    for (let i = 0; i < vagas.length; i++) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, vagas[i]]);
    // mais uma prioridade da Prefeita, além do Pedido do Gabinete que já existe
    const p = await c('criar_demanda', { p: { assunto: 'Pedido da Prefeita sobre a agenda de viagens', tipo: 'Ofício', numero: '91/2026', origem: 'Prefeita', etapa: 'Fazendo', chegou_em: somar(hoje, -1), prazo_original: somar(hoje, 6) } });
    await c('adicionar_tarefa', { p_demanda: p.id, p_texto: 'Levantar os compromissos da semana' });
    await c('adicionar_tarefa', { p_demanda: p.id, p_texto: 'Enviar a minuta de resposta' });
    // calendário: o dia cheio é o primeiro dia útil a partir de hoje + 2; o feriado vem depois dele
    const cheio = proximoUtil(somar(hoje, 2)), feriado = proximoUtil(somar(cheio, 3));
    const dem = await c('criar_demanda', { p: { assunto: 'Contrato com vencimento no dia do feriado', tipo: 'Memorando', numero: '12/2026', origem: 'Servidor', etapa: 'Fazendo', chegou_em: somar(hoje, -3), prazo_original: feriado } });
    await c('adicionar_tarefa', { p_demanda: dem.id, p_texto: 'Conferir a minuta do aditivo' });
    const noDia = await c('criar_demanda', { p: { assunto: 'Resposta com prazo no dia cheio', tipo: 'Ofício', numero: '55/2026', origem: 'Setor de Compras', etapa: 'Fazendo', chegou_em: somar(hoje, -2), prazo_original: cheio } });
    await c('adicionar_tarefa', { p_demanda: noDia.id, p_texto: 'Finalizar a resposta' });
    await c('salvar_dia_indisponivel', { p: { data: feriado, descricao: 'Feriado municipal de exemplo', categoria: 'Feriado' } });
    await c('salvar_dia_indisponivel', { p: { data: somar(feriado, 7), descricao: 'Feira regional (evento externo cadastrado)', categoria: 'Evento externo' } });
    const ev = (titulo, tipo, data, o = {}) => c('criar_evento', { p: { id: randomUUID(), titulo, tipo, data, inicio: '09:00', ...o } });
    await ev('Conferir o parecer da Procuradoria', 'Lembrete', hoje, { inicio: '08:30', fim: null });
    await ev('Reunião com o Gabinete', 'Reunião', hoje, { inicio: '14:00', fim: '15:00' });
    await ev('Despacho com a Procuradoria', 'Compromisso', cheio, { inicio: '10:00', fim: '11:00' });
    await ev('Reunião do secretariado', 'Reunião', cheio, { inicio: '15:00', fim: '16:00' });
    await ev('Congresso regional de administração', 'Evento externo', cheio, { dia_inteiro: true, inicio: null, aviso_min: null });
    await ev('Audiência pública na Câmara', 'Evento externo', somar(hoje, 1), { inicio: '19:00', fim: '21:00' });
    await ev('Visita técnica à escola', 'Compromisso', feriado, { inicio: '09:00' });
    await c('salvar_pagamento', { p: { data: cheio } });
    await c('salvar_pagamento', { p: { data: somar(hoje.slice(0, 7) + '-05', 31).slice(0, 7) + '-05' } });
  }
  await db.close();
  return pasta;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const alvo = process.argv[2] || 'todos';
  for (const n of alvo === 'todos' ? Object.keys(CENARIOS) : [alvo]) console.log(`cenário ${n}: ${await semearCenario(n)}`);
}
