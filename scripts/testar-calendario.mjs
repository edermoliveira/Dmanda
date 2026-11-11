// Regras puras do mini calendário, dos pagamentos e da pilha do Para hoje (decisão 64), sem navegador nem banco. Uso: node scripts/testar-calendario.mjs
import { CATEGORIAS_MINI, categoriaDoDia, categoriaDoEvento, categoriasDoDia, descreverDiaMini, faixasDaCelula, itensMini, mapaMini, ROTULO_MINI } from '../src/lib/mini-calendario.ts';
import { dataExiste, erroDoPagamento, ordenarPagamentos } from '../src/lib/pagamentos.ts';
import { ajustarPrazo, somarDias } from '../src/lib/prazos.ts';
import { TIPOS_EVENTO, erroDoEvento } from '../src/lib/eventos.ts';
import { ativoParaOFim, elegiveisParaHoje, ETAPA_SEGUINTE, etapaDeEspera, ordemDaPilha, organizarPainel, precisaCompletar, VAGAS_PARA_HOJE, vagasAbertas } from '../src/lib/para-hoje.ts';
import { validarPagamento } from '../src/nucleo/validacao.ts';
import { gradeMes, indiceSemana, semanaDe } from '../src/lib/agenda.ts';

let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const lanca = (f) => { try { f(); return ''; } catch (e) { return e.message; } };
const H = '2026-11-11'; // quarta-feira

const dem = (id, o = {}) => ({
  id, tipo: 'Memorando', area: 'Geral', numero: `${id.length}/2026`, assunto: `Assunto ${id}`, descricao: '', origem: '', etapa: 'Fazendo', etapa_desde: '2026-11-01T15:00:00Z', chegou_em: '2026-11-01', prazo: null, prazo_original: null, prazo_dias: null,
  prazo_base_em: null, prazo_ajuste: null, prazo_legado: false, prazo_tipo: 'Próprio', setor: null, acompanhar_em: null, encaminhada_em: null, reiterada_em: null, concluida_em: null, arquivada_em: null,
  criado_em: `2026-11-01T10:00:0${id.length % 10}Z`, atualizado_em: '2026-11-01T10:00:00Z', entrada_id: null, versao: 1, rapida: false, tarefas: [{ id: `${id}-t`, texto: 't', concluida: false, posicao: 0 }], ...o,
});
const ev = (id, o = {}) => ({ id, titulo: `Evento ${id}`, tipo: 'Compromisso', data: H, dia_inteiro: false, inicio: '09:00', fim: '10:00', descricao: '', aviso_min: 15, versao: 1, criado_em: `2026-11-01T10:00:0${id.length % 10}Z`, atualizado_em: '2026-11-01T10:00:00Z', ...o });
const dia = (id, data, categoria, descricao = 'Dia') => ({ id, data, descricao, categoria, criado_em: '2026-10-01T10:00:00Z' });
const pag = (id, data) => ({ id, data, criado_em: '2026-10-01T10:00:00Z' });
const F = (o = {}) => ({ eventos: [], dias: [], pagamentos: [], demandas: [], hoje: H, ...o });

// ---------- categorias ----------
ok(CATEGORIAS_MINI.length === 6 && CATEGORIAS_MINI.join() === 'compromisso,feriado,pagamento,evento,reuniao,prazo' && Object.values(ROTULO_MINI).join() === 'Compromisso,Feriado,Pagamento,Evento,Reunião,Prazo', 'seis categorias em ordem fixa, com os rótulos Compromisso, Feriado, Pagamento, Evento, Reunião e Prazo');
ok(categoriaDoEvento({ tipo: 'Compromisso' }) === 'compromisso' && categoriaDoEvento({ tipo: 'Lembrete' }) === 'compromisso' && categoriaDoEvento({ tipo: 'Reunião' }) === 'reuniao' && categoriaDoEvento({ tipo: 'Evento externo' }) === 'evento', 'Compromisso e Lembrete (os lembretes existentes) entram em Compromisso; Reunião é Reunião; Evento externo é Evento');
ok(categoriaDoDia({ categoria: 'Feriado' }) === 'feriado' && categoriaDoDia({ categoria: 'Evento externo' }) === 'evento', 'Dias indisponíveis: Feriado é Feriado e o evento externo de dia inteiro cadastrado lá é Evento');
ok(TIPOS_EVENTO.includes('Evento externo') && TIPOS_EVENTO.includes('Lembrete') && erroDoEvento({ titulo: 'x', tipo: 'Evento externo', data: H, dia_inteiro: false, inicio: '14:00' }) === null && erroDoEvento({ titulo: 'x', tipo: 'Evento externo', data: H, dia_inteiro: true }) === null, 'o tipo Evento externo vale com horário e de dia inteiro, e os tipos anteriores continuam');

{
  const f = F({
    eventos: [ev('c1', { tipo: 'Compromisso' }), ev('l1', { tipo: 'Lembrete', inicio: '08:00', fim: null }), ev('r1', { tipo: 'Reunião', inicio: '14:00' }), ev('x1', { tipo: 'Evento externo', dia_inteiro: true, inicio: null, fim: null, aviso_min: null }), ev('o1', { data: '2026-11-12' })],
    dias: [dia('d1', H, 'Feriado', 'Feriado de teste'), dia('d2', H, 'Evento externo', 'Congresso')],
    pagamentos: [pag('p1', H), pag('p2', '2026-12-05')],
    demandas: [dem('a', { prazo: H, prazo_original: H }), dem('b', { prazo: '2026-11-13', prazo_original: '2026-11-13' })],
  });
  const it = itensMini(H, f);
  ok(CATEGORIAS_MINI.every((c) => it.some((i) => i.categoria === c)) && it.length === 8, `o dia com tudo mostra as seis categorias e oito itens (${it.length})`);
  ok(it.filter((i) => i.categoria === 'compromisso').length === 2 && it.filter((i) => i.categoria === 'evento').length === 2 && it.filter((i) => i.categoria === 'prazo').length === 1, 'Compromisso (compromisso e lembrete), Evento (externo da Agenda e dia indisponível) e Prazo contados certo');
  ok(JSON.stringify(categoriasDoDia(it)) === JSON.stringify(CATEGORIAS_MINI), 'as categorias do dia saem na ordem fixa e sem repetir, mesmo com dois itens da mesma categoria');
  ok(it[0].titulo !== undefined && it.slice(0, 3).every((i) => ['feriado', 'pagamento', 'evento'].includes(i.categoria)), 'dia inteiro antes do que tem horário (feriado, pagamento e evento de dia inteiro primeiro)');
  const horarios = it.filter((i) => i.origem.tipo === 'evento' && i.categoria !== 'evento').map((i) => i.titulo);
  ok(horarios.join() === 'Evento l1,Evento c1,Evento r1', `itens com horário em ordem cronológica (${horarios.join()})`);
  ok(it.every((i) => i.origem.id) && it.find((i) => i.categoria === 'prazo').origem.tipo === 'demanda' && it.find((i) => i.categoria === 'prazo').origem.id === 'a', 'cada item aponta para o registro de origem; o Prazo abre a demanda');
  ok(itensMini('2026-11-12', f).length === 1 && itensMini('2026-11-20', f).length === 0, 'outro dia mostra só o que é dele e um dia sem nada fica vazio');
  const mapa = mapaMini('2026-11-01', '2026-12-31', f);
  ok(mapa.size === 4 && mapa.has(H) && mapa.has('2026-11-12') && mapa.has('2026-11-13') && mapa.has('2026-12-05'), 'o mapa do período tem só os dias que têm itens');
}

// ---------- Prazo: só o vencimento efetivo da demanda aberta ----------
{
  const dias = [dia('f', '2026-11-20', 'Feriado', 'Consciência Negra')]; // sexta
  const aj = ajustarPrazo('2026-11-20', dias).prazo;                       // antecipado para quinta, 19
  ok(aj === '2026-11-19', 'o vencimento original em feriado é antecipado para o dia disponível anterior');
  const d = dem('feriado', { prazo: aj, prazo_original: '2026-11-20' });
  const f = F({ dias, demandas: [d] });
  ok(itensMini('2026-11-19', f).some((i) => i.categoria === 'prazo' && i.origem.id === 'feriado') && !itensMini('2026-11-20', f).some((i) => i.categoria === 'prazo') && itensMini('2026-11-20', f).some((i) => i.categoria === 'feriado'), 'o Prazo aparece no dia ajustado (19/11), não no dia original; o feriado aparece no dia 20');
  const outras = [
    dem('fin', { etapa: 'Finalizado', prazo: H, prazo_original: H }), dem('arq', { arquivada_em: '2026-11-02T10:00:00Z', prazo: H, prazo_original: H }), dem('ac', { acompanhar_em: H }),
    dem('ret', { etapa: 'Aguardando retorno', setor: 'Obras', etapa_desde: '2026-10-28T15:00:00Z', encaminhada_em: '2026-10-28' }), dem('sem'), dem('ok', { prazo: H, prazo_original: H }),
  ];
  const mapa = mapaMini('2026-10-01', '2026-12-31', F({ demandas: outras }));
  const prazos = [...mapa.values()].flat().filter((i) => i.categoria === 'prazo').map((i) => i.origem.id);
  ok(prazos.join() === 'ok' && [...mapa.values()].flat().every((i) => i.categoria === 'prazo'), 'finalizada, arquivada, sem prazo, Acompanhar em e Retorno do setor ficam fora do Prazo (esses marcos são só da Agenda principal)');
  const venc = itensMini(H, F({ demandas: [dem('v', { prazo: '2026-11-05', prazo_original: '2026-11-05' })] }));
  ok(venc.length === 0 && itensMini('2026-11-05', F({ demandas: [dem('v', { prazo: '2026-11-05', prazo_original: '2026-11-05' })] })).length === 1, 'o vencimento atrasado continua no dia em que venceu (não migra para hoje) e é marcado como vencido');
}

// ---------- faixas de cor e nome acessível ----------
{
  const cor = (c) => `var(--cal-${c})`;
  ok(faixasDaCelula([], cor) === undefined, 'sem categoria não há fundo');
  ok(faixasDaCelula(['prazo'], cor) === 'linear-gradient(90deg, var(--cal-prazo), var(--cal-prazo))', 'uma categoria é uma cor lisa');
  const g = faixasDaCelula(['compromisso', 'prazo'], cor);
  ok(g.includes('var(--cal-compromisso) 0%') && g.includes('var(--cal-compromisso) calc(50% - 2px)') && g.includes('var(--cal-prazo) calc(50% + 2px)') && g.includes('var(--cal-prazo) 100%'), 'duas categorias dividem a célula ao meio, com 4 px de transição entre as cores');
  const seis = faixasDaCelula(CATEGORIAS_MINI, cor);
  ok(CATEGORIAS_MINI.every((c) => seis.includes(`var(--cal-${c})`)) && !/#[0-9a-f]{3,6}|rgb\(|hsl\(/i.test(seis), 'as seis cores entram nas faixas, só por variáveis de CSS (nenhuma cor solta)');
  const itens = itensMini(H, F({ eventos: [ev('c1'), ev('r1', { tipo: 'Reunião' })], pagamentos: [pag('p', H)] }));
  const nome = descreverDiaMini(H, itens, { hoje: H, selecionado: true });
  ok(/quarta-feira, 11 de novembro de 2026/.test(nome) && /hoje/.test(nome) && /Compromisso: 1 item/.test(nome) && /Pagamento: 1 item/.test(nome) && /Reunião: 1 item/.test(nome) && /selecionado/.test(nome), `nome acessível diz a data, hoje, as categorias com quantidade e a seleção (${nome})`);
  ok(/sem itens/.test(descreverDiaMini('2026-11-20', [], { hoje: H, selecionado: false })), 'dia vazio é descrito como sem itens');
}

// ---------- pagamentos ----------
{
  ok(dataExiste('2026-02-28') && !dataExiste('2026-02-29') && dataExiste('2028-02-29') && !dataExiste('2026-13-01') && !dataExiste('2026-11-31') && !dataExiste('11/11/2026'), 'datas que existem no calendário (bissexto, 31/11 e formato errado recusados)');
  ok(erroDoPagamento('') === 'Informe a data do pagamento.' && erroDoPagamento('2026-02-30') === 'Informe uma data que exista no calendário.' && erroDoPagamento('2026-11-05') === null, 'validação da data do pagamento');
  const l = [pag('a', '2026-11-05'), pag('b', '2026-12-05')];
  ok(erroDoPagamento('2026-11-05', l) === 'Já existe um pagamento cadastrado nesta data.' && erroDoPagamento('2026-11-05', l, 'a') === null && erroDoPagamento('2026-11-06', l, 'a') === null, 'duas vezes a mesma data é recusado, menos na edição do próprio registro');
  ok(ordenarPagamentos([pag('z', '2026-12-05'), pag('y', '2026-11-05')]).map((p) => p.id).join() === 'y,z', 'pagamentos em ordem de data');
  ok(lanca(() => validarPagamento({ data: '2026-02-30' })) !== '' && lanca(() => validarPagamento({})) === 'Informe a data do pagamento.' && validarPagamento({ data: '2026-11-05', id: '11111111-1111-4111-8111-111111111111' }).data === '2026-11-05' && lanca(() => validarPagamento({ data: '2026-11-05', id: 'x' })) !== '', 'validação do servidor: data que não existe e identificador inválido são recusados');
}

// ---------- a semana começa na segunda ----------
{
  ok(indiceSemana('2026-11-09') === 0 && indiceSemana('2026-11-15') === 6 && indiceSemana('2026-11-11') === 2, 'segunda é 0 e domingo é 6');
  ok(gradeMes(2026, 11)[0].join() === ',,,,,,2026-11-01' && gradeMes(2027, 1)[0].slice(0, 5).join() === ',,,,2027-01-01', 'novembro de 2026 começa no domingo (última coluna) e janeiro de 2027 na sexta');
  ok(semanaDe('2026-12-31')[0] === '2026-12-28' && semanaDe('2026-12-31')[6] === '2027-01-03' && semanaDe('2026-11-01')[0] === '2026-10-26', 'viradas de mês e de ano: a semana de 31/12 vai de 28/12 a 3/1; domingo 1/11 fecha a semana de 26/10');
}

// ---------- pilha do celular ----------
{
  ok(etapaDeEspera('Aguardando retorno') && etapaDeEspera('Aguardando Prefeita') && !etapaDeEspera('Fazendo') && !etapaDeEspera('Cadastro'), 'as duas etapas de espera são reconhecidas');
  ok(ETAPA_SEGUINTE.Cadastro === 'Vistos' && ETAPA_SEGUINTE.Vistos === 'Fazendo' && ETAPA_SEGUINTE.Fazendo === 'Finalizado' && ETAPA_SEGUINTE['Aguardando retorno'] === undefined && ETAPA_SEGUINTE['Aguardando Prefeita'] === undefined && ETAPA_SEGUINTE.Finalizado === undefined, 'avanço pelo gesto: Cadastro, Vistos, Fazendo, Finalizado; nas esperas e em Finalizado não há avanço direto');
  ok(ordemDaPilha(['a', 'b', 'c', 'd'], []).join() === 'a,b,c,d' && ordemDaPilha(['a', 'b', 'c', 'd'], ['c', 'a']).join() === 'c,a,b,d', 'sem ordem guardada vale a do painel; com ordem guardada ela vem primeiro e o resto segue no fim');
  ok(ordemDaPilha(['a', 'b'], ['x', 'b', 'b', 'a', 'y']).join() === 'b,a', 'ids que saíram das vagas e repetidos são descartados');
  ok(ordemDaPilha(['a', 'b', 'c', 'd'], ['b', 'a']).join() === 'b,a,c,d' && ordemDaPilha(['a', 'b', 'c', 'd', 'e'], ['b', 'a', 'c', 'd']).join() === 'b,a,c,d,e', 'vaga nova entra no fim da fila, sem perder nem duplicar ninguém');
  for (const n of [0, 1, 2, 4]) { const ids = Array.from({ length: n }, (_, i) => `d${i}`); const r = ordemDaPilha(ids, [...ids].reverse().concat(['fantasma', ids[0] ?? 'x'])); ok(r.length === n && new Set(r).size === n && ids.every((x) => r.includes(x)), `com ${n} cards a ordem nunca perde nem repete`); }
  ok(ativoParaOFim(['a', 'b', 'c', 'd']).join() === 'b,c,d,a' && ativoParaOFim(['a']).join() === 'a' && ativoParaOFim([]).length === 0, 'passar o card ativo o leva ao fim; com um só card nada muda');
  let o = ['a', 'b', 'c', 'd']; for (let i = 0; i < 4; i++) o = ativoParaOFim(o);
  ok(o.join() === 'a,b,c,d', 'quatro passagens devolvem a fila ao começo (cada card passa uma vez)');
}

// ---------- Nova urgência sem duplicar (quatro vagas cheias) ----------
{
  ok(VAGAS_PARA_HOJE === 4, 'o Para hoje tem quatro vagas');
  const comuns = ['v1', 'v2', 'v3', 'v4'].map((id, i) => dem(id, { prazo: `2026-11-0${4 + i}`, prazo_original: `2026-11-0${4 + i}` }));
  const P1 = dem('p1', { origem: 'Prefeita' }), P2 = dem('p2', { origem: 'Gabinete', prazo: '2026-12-01', prazo_original: '2026-12-01' });
  const lista = [...comuns, P1, P2, dem('u1', { prazo: '2026-11-07', prazo_original: '2026-11-07' }), dem('u2', { prazo: H, prazo_original: H })];
  const eleg = elegiveisParaHoje(lista, H, []);
  const vagas = comuns.map((d, i) => ({ posicao: i + 1, demanda_id: d.id }));
  const foto = JSON.stringify(vagas);
  const pa = organizarPainel(vagas, lista, eleg);
  ok(pa.novaUrgencia.length >= 2 && pa.novaUrgencia.slice(0, 2).every((e) => e.prioritaria) && ['p1', 'p2'].every((id) => pa.novaUrgencia.slice(0, 2).some((e) => e.demanda.id === id)), `com as quatro vagas cheias a prioridade de fora abre a Nova urgência (${pa.novaUrgencia.map((e) => e.demanda.id).join()})`);
  const ids = [...pa.prioritariasNasVagas.map((v) => v.demanda.id), ...pa.comunsNasVagas.map((v) => v.demanda.id), ...pa.novaUrgencia.map((e) => e.demanda.id)];
  ok(new Set(ids).size === ids.length, 'nenhuma demanda aparece nas vagas e na Nova urgência ao mesmo tempo');
  ok(pa.novaUrgencia.findIndex((e) => !e.prioritaria) === -1 || pa.novaUrgencia.slice(0, pa.novaUrgencia.findIndex((e) => !e.prioritaria)).every((e) => e.prioritaria) && pa.novaUrgencia.slice(pa.novaUrgencia.findIndex((e) => !e.prioritaria)).every((e) => !e.prioritaria), 'as prioritárias vêm todas antes das urgências comuns');
  ok(JSON.stringify(vagas) === foto && vagasAbertas(vagas, lista).length === 4 && !precisaCompletar(vagas, lista, eleg), 'as quatro vagas guardadas não mudam e nada é gravado quando estão cheias');
  const vagas3 = vagas.slice(0, 3); // a quarta vaga livre é preenchida (a candidata elegível existe)
  ok(precisaCompletar(vagas3, lista, eleg) && vagasAbertas(vagas3, lista).length === 3, 'com três vagas ocupadas e candidata elegível, o painel pede a quarta vaga');
  const sem = organizarPainel(vagas, [...comuns, dem('x', { prazo: '2026-12-20', prazo_original: '2026-12-20' })], elegiveisParaHoje([...comuns, dem('x', { prazo: '2026-12-20', prazo_original: '2026-12-20' })], H, []));
  ok(sem.novaUrgencia.length === 0, 'sem prioridade nem urgência fora das vagas, a Nova urgência não aparece');
  const concl = lista.map((d) => (d.id === 'v2' ? { ...d, etapa: 'Finalizado' } : d));
  ok(vagasAbertas(vagas, concl).map((v) => v.demanda.id).join() === 'v1,v3,v4' && precisaCompletar(vagas, concl, elegiveisParaHoje(concl, H, [])), 'concluir uma demanda libera só a vaga dela (as outras três ficam) e pede reposição');
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
