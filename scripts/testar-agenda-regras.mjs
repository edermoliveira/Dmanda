// Regras puras da Agenda (src/lib/agenda.ts, eventos.ts e a etapa Aguardando Prefeita de demandas.ts), sem navegador nem banco. Uso: node scripts/testar-agenda-regras.mjs
import {
  gradeMes, somarMeses, semanaDe, diasNoMes, tituloMes, rotuloSemana, dataPorExtenso, contagemRetorno, marcosDaDemanda, dataAplicavel, cargaDaDemanda, nivelDaCarga, cargaPorDia,
  pendenciasSemPrazo, itensDoDia, descreverDia, diaMaisLivre, panorama, marcosPorDia, LIMIARES_CARGA,
} from '../src/lib/agenda.ts';
import { esperaPrefeita, ordemDaEtapa, ETAPAS, ETAPA_COR } from '../src/lib/demandas.ts';
import { diaDaSemana } from '../src/lib/prazos.ts';
import { erroDoEvento, seSobrepoem, sobrepostosA, ordenarEventos, avisosDeHoje, minutosAgora, horarioDe, rotuloAviso } from '../src/lib/eventos.ts';
import { validarEvento } from '../src/nucleo/validacao.ts';

let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const lanca = (f) => { try { f(); return ''; } catch (e) { return e.message; } };

const dem = (id, o = {}) => ({
  id, tipo: 'Memorando', area: 'Geral', numero: '', assunto: id, descricao: '', origem: '', etapa: 'Fazendo', etapa_desde: '2026-10-01T15:00:00Z', chegou_em: '2026-10-01', prazo: null, prazo_original: null, prazo_dias: null,
  prazo_base_em: null, prazo_ajuste: null, prazo_legado: false, prazo_tipo: 'Próprio', setor: null, acompanhar_em: null, encaminhada_em: null, reiterada_em: null, concluida_em: null, arquivada_em: null,
  criado_em: `2026-10-01T10:00:0${id.length % 10}Z`, atualizado_em: '2026-10-01T10:00:00Z', entrada_id: null, versao: 1, tarefas: [], ...o,
});
const tf = (n, feitas = 0) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, texto: `t${i}`, concluida: i < feitas, posicao: i }));
const ev = (id, o = {}) => ({ id, titulo: id, tipo: 'Reunião', data: '2026-11-03', dia_inteiro: false, inicio: '09:00', fim: '10:00', descricao: '', aviso_min: 15, versao: 1, criado_em: `2026-11-01T10:00:0${id.length}Z`, atualizado_em: '2026-11-01T10:00:00Z', ...o });

// ---------- calendário ----------
{
  const fev26 = gradeMes(2026, 2), fev24 = gradeMes(2024, 2), ago26 = gradeMes(2026, 8);
  ok(fev26.length === 4 && fev26[0][0] === '2026-02-01' && fev26[3][6] === '2026-02-28' && fev26.flat().every(Boolean), 'fevereiro de 2026 começa no domingo e tem 4 semanas completas, sem espaços vazios');
  ok(fev24.length === 5 && fev24[0].slice(0, 4).every((x) => x === null) && fev24[0][4] === '2024-02-01' && fev24.flat().includes('2024-02-29') && fev24[4].slice(5).every((x) => x === null), 'ano bissexto: fevereiro de 2024 começa na quinta, tem o dia 29 e completa a última semana com vazios');
  ok(ago26.length === 6 && ago26[0].slice(0, 6).every((x) => x === null) && ago26[0][6] === '2026-08-01', 'agosto de 2026 começa no sábado: seis posições vazias e 6 semanas');
  let tudo = true, qtd = 0;
  for (let a = 2024; a <= 2030; a++) for (let m = 1; m <= 12; m++) {
    const g = gradeMes(a, m), nn = g.flat().filter(Boolean);
    if (!g.every((s) => s.length === 7) || nn.length !== diasNoMes(a, m) || nn[0] !== `${a}-${String(m).padStart(2, '0')}-01`) tudo = false;
    g.forEach((s) => s.forEach((x, i) => { if (x && diaDaSemana(x) !== i) tudo = false; }));
    qtd++;
  }
  ok(tudo && qtd === 84, 'em 84 meses (2024 a 2030) toda semana tem 7 posições, cada data cai na coluna do seu dia da semana (domingo na primeira) e a quantidade de dias confere');
  ok(diasNoMes(2024, 2) === 29 && diasNoMes(2026, 2) === 28 && diasNoMes(2100, 2) === 28 && diasNoMes(2000, 2) === 29 && diasNoMes(2026, 4) === 30, 'meses de tamanhos diferentes e anos bissextos (2100 não é bissexto, 2000 é)');
  ok(somarMeses('2026-01-31', 1) === '2026-02-28' && somarMeses('2024-01-31', 1) === '2024-02-29' && somarMeses('2026-12-15', 1) === '2027-01-15' && somarMeses('2026-01-15', -1) === '2025-12-15' && somarMeses('2026-03-31', -1) === '2026-02-28', 'somar meses mantém o dia ou usa o último dia do mês de destino, e cruza o ano nos dois sentidos');
  ok(semanaDe('2026-11-04')[0] === '2026-11-01' && semanaDe('2026-11-04')[6] === '2026-11-07' && semanaDe('2026-11-01')[0] === '2026-11-01' && semanaDe('2026-11-07')[0] === '2026-11-01' && semanaDe('2026-12-02')[0] === '2026-11-29' && semanaDe('2026-12-02')[6] === '2026-12-05', 'semana de domingo a sábado, inclusive quando atravessa o mês');
  ok(tituloMes('2026-11-15') === 'novembro de 2026' && dataPorExtenso('2026-11-03') === 'terça-feira, 3 de novembro de 2026' && rotuloSemana(semanaDe('2026-11-04')) === '1 a 7 de novembro de 2026' && rotuloSemana(semanaDe('2026-12-02')) === '29 de nov a 5 de dez de 2026', 'rótulos por extenso do mês, do dia e da semana');
}

// ---------- retorno de outro setor (10 dias) ----------
{
  const base = { etapa: 'Aguardando retorno', etapa_desde: '2026-11-03T15:00:00Z', encaminhada_em: null, reiterada_em: null, arquivada_em: null };
  const r1 = contagemRetorno(base, []);
  ok(r1.base === '2026-11-03' && r1.origemBase === 'entrada na etapa' && r1.data === '2026-11-13' && r1.ajuste === null, 'sem data de encaminhamento a contagem parte do dia em que entrou na etapa: 10 dias corridos, exclui o primeiro e inclui o último');
  const noite = contagemRetorno({ ...base, etapa_desde: '2026-11-04T01:30:00Z' }, []);
  ok(noite.base === '2026-11-03' && noite.data === '2026-11-13', 'entrada às 22h30 de Brasília (01h30 UTC do dia seguinte) conta como o dia local, sem deslocamento por UTC');
  const enc = contagemRetorno({ ...base, encaminhada_em: '2026-11-05' }, []);
  ok(enc.base === '2026-11-05' && enc.origemBase === 'encaminhamento' && enc.original === '2026-11-15' && enc.data === '2026-11-13' && /15\/11 domingo; 14\/11 sábado/.test(enc.ajuste), 'o efetivo encaminhamento vale mais que a entrada na etapa; limite no domingo antecipa para sexta, explicando os dias pulados');
  const feriado = contagemRetorno({ ...base, encaminhada_em: '2026-11-05' }, [{ id: 'f', data: '2026-11-13', descricao: 'Ponto facultativo', categoria: 'Feriado' }]);
  ok(feriado.data === '2026-11-12' && /13\/11 feriado: Ponto facultativo/.test(feriado.ajuste), 'dia indisponível cadastrado no limite antecipa para o anterior disponível, pela mesma regra dos prazos');
  const reit = contagemRetorno({ ...base, encaminhada_em: '2026-11-05', reiterada_em: '2026-11-10' }, []);
  ok(reit.base === '2026-11-10' && reit.origemBase === 'reiteração' && reit.data === '2026-11-20', 'reiteração registrada inicia nova contagem de 10 dias a partir dela');
  ok(contagemRetorno({ ...base, encaminhada_em: '2026-11-08', reiterada_em: '2026-11-02' }, []).origemBase === 'encaminhamento', 'reiteração mais antiga que o encaminhamento não reinicia nada');
  ok(contagemRetorno({ ...base, etapa: 'Fazendo' }, []) === null && contagemRetorno({ ...base, arquivada_em: '2026-11-04T00:00:00Z' }, []) === null && contagemRetorno({ ...base, etapa: 'Aguardando Prefeita' }, []) === null, 'fora de Aguardando retorno (ou arquivada) não há contagem; Aguardando Prefeita não usa os 10 dias do setor');
  const d = dem('x', { etapa: 'Aguardando retorno', etapa_desde: '2026-11-03T15:00:00Z', prazo: '2026-11-30', prazo_original: '2026-11-30', acompanhar_em: '2026-11-09' });
  const m = marcosDaDemanda(d, [], '2026-11-04');
  ok(m.length === 3 && m.map((x) => x.tipo).join() === 'acompanhamento,retorno,vencimento' && d.prazo === '2026-11-30' && d.acompanhar_em === '2026-11-09', 'Aguardando retorno tem três marcos distintos (acompanhar digitado, retorno calculado e vencimento) e nenhum apaga o outro nem altera o vencimento gravado');
}

// ---------- marcos, data aplicável e carga ----------
{
  const hoje = '2026-11-11';
  const a = dem('a', { prazo: '2026-11-10', prazo_original: '2026-11-10', acompanhar_em: '2026-11-12' });
  const m = marcosDaDemanda(a, [], hoje);
  ok(m.length === 2 && m[0].tipo === 'vencimento' && m[0].atrasado === true && m[1].tipo === 'acompanhamento' && m[1].atrasado === false, 'vencido permanece no dia em que venceu, marcado como atrasado; o acompanhamento futuro não é atraso');
  ok(dataAplicavel(m) === '2026-11-10' && dataAplicavel([]) === null, 'data aplicável é a primeira data programada; sem marcos, nenhuma data é inventada');
  const fin = dem('f', { etapa: 'Finalizado', prazo: '2026-11-05', prazo_original: '2026-11-05', concluida_em: '2026-11-04' });
  ok(marcosDaDemanda(fin, [], hoje).length === 0 && marcosDaDemanda(fin, [], hoje, true).length === 1 && marcosDaDemanda(fin, [], hoje, true)[0].atrasado === false, 'finalizada só aparece quando o filtro pede, no vencimento e nunca como atrasada');
  ok(marcosDaDemanda(dem('arq', { prazo: '2026-11-12', arquivada_em: '2026-11-01T00:00:00Z' }), [], hoje, true).length === 0, 'arquivada fica fora da Agenda');
  const pref = dem('p', { etapa: 'Aguardando Prefeita', prazo: '2026-11-14', prazo_original: '2026-11-14' });
  ok(marcosDaDemanda(pref, [], hoje).map((x) => x.tipo).join() === 'vencimento', 'Aguardando Prefeita mantém só o vencimento (a espera é texto, não data)');

  ok(cargaDaDemanda(dem('s')) === 1 && cargaDaDemanda(dem('t', { tarefas: tf(3, 1) })) === 2 && cargaDaDemanda(dem('u', { tarefas: tf(2, 2) })) === 1 && cargaDaDemanda(fin) === 0 && cargaDaDemanda(dem('v', { arquivada_em: 'x', tarefas: tf(4) })) === 0, 'carga: tarefas não concluídas; sem tarefas (ou todas feitas com a demanda aberta) vale uma unidade; finalizada e arquivada valem zero');
  ok([0, 1, 3, 4, 7, 8, 30].map(nivelDaCarga).join() === 'zero,baixa,baixa,media,media,alta,alta' && LIMIARES_CARGA.media === 4 && LIMIARES_CARGA.alta === 8, 'limiares: 0 zero, 1 a 3 baixa, 4 a 7 média, 8 ou mais alta');

  const l = [
    dem('A', { prazo: '2026-11-20', prazo_original: '2026-11-20', acompanhar_em: '2026-11-15', tarefas: tf(3, 1) }),
    dem('B', { prazo: '2026-11-15', prazo_original: '2026-11-15', tarefas: tf(1) }),
    dem('C', { etapa: 'Finalizado', prazo: '2026-11-15', prazo_original: '2026-11-15', concluida_em: '2026-11-10', tarefas: tf(5, 5) }),
    dem('D', { prazo: '2026-11-02', prazo_original: '2026-11-02' }),
    dem('E'),
    dem('F', { etapa: 'Aguardando retorno', etapa_desde: '2026-11-03T15:00:00Z' }),
  ];
  const c = cargaPorDia(l, [], hoje);
  ok(c.get('2026-11-15').carga === 3 && c.get('2026-11-15').demandas === 2 && !c.get('2026-11-20') && c.get('2026-11-02').atrasada === true && c.get('2026-11-13').carga === 1, 'a carga entra uma só vez, no dia da data aplicável (A no acompanhamento de 15, não duplicada no vencimento de 20); finalizada não soma; atrasada marca o dia; retorno do setor posiciona a carga');
  ok(!c.has('2026-11-14') && [...c.values()].reduce((s, x) => s + x.carga, 0) === 2 + 1 + 1 + 1, 'o total da carga é a soma das demandas abertas com data, sem a sem prazo e sem a finalizada');
  ok(pendenciasSemPrazo(l, [], hoje).map((x) => x.id).join() === 'E', 'demanda sem nenhuma data aplicável vai para Pendências sem prazo, sem vencimento inventado (Aguardando retorno sempre tem o marco do retorno)');
  const itens = itensDoDia('2026-11-15', { demandas: l, eventos: [ev('e1', { data: '2026-11-15', inicio: '14:00', fim: null }), ev('e2', { data: '2026-11-15', inicio: '08:00' }), ev('e3', { data: '2026-11-15', dia_inteiro: true, inicio: null, fim: null })], indisponiveis: [{ id: 'i', data: '2026-11-15', descricao: 'República', categoria: 'Feriado' }], hoje });
  ok(itens.eventos.map((x) => x.id).join() === 'e3,e2,e1' && itens.indisponiveis.length === 1 && itens.marcos.map((x) => x.demanda.id).sort().join() === 'A,B', 'o dia lista eventos em ordem cronológica (dia inteiro primeiro), dias indisponíveis e os marcos que caem nele');
  ok(marcosPorDia({ demandas: l, eventos: [], indisponiveis: [], hoje }, '2026-11-01', '2026-11-30').get('2026-11-20').length === 1, 'o marco de vencimento de A continua visível no dia 20 mesmo sem somar carga lá');
  const desc = descreverDia('2026-11-15', { carga: c.get('2026-11-15'), eventos: 3, indisponiveis: itens.indisponiveis, hoje, selecionado: true });
  ok(/domingo, 15 de novembro de 2026/.test(desc) && /3 pendências em 2 demandas, carga baixa/.test(desc) && /3 compromissos/.test(desc) && /feriado: República/.test(desc) && /selecionado/.test(desc) && /sem pendências/.test(descreverDia('2026-11-16', { eventos: 0, indisponiveis: [], hoje })) && /com atraso/.test(descreverDia('2026-11-02', { carga: c.get('2026-11-02'), eventos: 0, indisponiveis: [], hoje })), 'descrição acessível do dia: quantidade, nível, atraso, compromissos, feriado e seleção em palavras');
  const cc = new Map([['2026-11-18', { carga: 9, demandas: 3, atrasada: false }], ['2026-11-19', { carga: 5, demandas: 2, atrasada: false }], ['2026-11-20', { carga: 1, demandas: 1, atrasada: false }]]);
  ok(diaMaisLivre('2026-11-18', cc, [], hoje) === '2026-11-17' && diaMaisLivre('2026-11-18', cc, [{ id: 'z', data: '2026-11-17', descricao: 'x', categoria: 'Feriado' }], hoje) === '2026-11-16' && diaMaisLivre('2026-11-18', new Map(['2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23'].map((x) => [x, { carga: x === '2026-11-18' ? 1 : 2, demandas: 1, atrasada: false }])), [], hoje) === null, 'sugestão de dia mais livre: o disponível mais leve e próximo, pulando fim de semana e dia indisponível; nulo se nada for mais leve');
  const pan = panorama(cc, [ev('x', { data: '2026-11-18' }), ev('y', { data: '2026-12-01' })], [], hoje, '2026-11-01', '2026-11-30');
  ok(pan.pendencias === 15 && pan.demandas === 6 && pan.compromissos === 1 && pan.cheios.map((x) => x.data).join() === '2026-11-18,2026-11-19' && /17 de novembro/.test(pan.cheios[0].sugestao), 'panorama do mês: pendências, demandas, compromissos e os dias cheios (média ou alta) com a sugestão de redistribuir');
}

// ---------- Aguardando Prefeita ----------
{
  const p = (desde) => ({ etapa: 'Aguardando Prefeita', etapa_desde: desde, arquivada_em: null });
  const e10 = esperaPrefeita(p('2026-11-01T15:00:00Z'), '2026-11-11'), e11 = esperaPrefeita(p('2026-11-01T15:00:00Z'), '2026-11-12');
  ok(e10.dias === 10 && e10.alerta === false && e10.texto === 'Aguardando Prefeita há 10 dias', '10 dias de espera ainda não é vencido');
  ok(e11.dias === 11 && e11.alerta === true && e11.texto === 'Aguardando Prefeita há 11 dias', 'a partir do 11º dia a espera é destacada como prazo vencido');
  ok(esperaPrefeita(p('2026-11-11T15:00:00Z'), '2026-11-11').texto === 'Aguardando Prefeita desde hoje' && esperaPrefeita(p('2026-11-10T15:00:00Z'), '2026-11-11').texto === 'Aguardando Prefeita há 1 dia', 'texto no mesmo dia e no singular');
  ok(esperaPrefeita(p('2026-11-01T02:59:59Z'), '2026-11-11').dias === 11, 'a entrada às 23h59 de Brasília do dia 31/10 conta como 31/10 (data local, sem UTC)');
  ok(esperaPrefeita({ ...p('2026-11-01T15:00:00Z'), etapa: 'Fazendo' }, '2026-11-11') === null && esperaPrefeita({ ...p('2026-11-01T15:00:00Z'), arquivada_em: 'x' }, '2026-11-11') === null, 'fora da etapa (ou arquivada) não há contagem');
  const x = [{ id: 'novo', etapa_desde: '2026-11-09T12:00:00Z', criado_em: '1' }, { id: 'velho', etapa_desde: '2026-11-01T12:00:00Z', criado_em: '2' }, { id: 'meio', etapa_desde: '2026-11-05T12:00:00Z', criado_em: '3' }];
  ok(ordemDaEtapa(x, 'Aguardando Prefeita').map((y) => y.id).join() === 'velho,meio,novo' && ordemDaEtapa(x, 'Fazendo').map((y) => y.id).join() === 'novo,velho,meio' && x[0].id === 'novo', 'em Aguardando Prefeita, da espera mais antiga para a mais recente; as outras etapas mantêm a ordem e a lista original não é alterada');
  ok(ETAPAS.join() === 'Cadastro,Vistos,Fazendo,Aguardando retorno,Aguardando Prefeita,Finalizado' && typeof ETAPA_COR['Aguardando Prefeita'] === 'number', 'a nova etapa fica entre Aguardando retorno e Finalizado e tem cor própria');
}

// ---------- eventos ----------
{
  const bom = { titulo: 'Reunião com a equipe', tipo: 'Reunião', data: '2026-11-03', dia_inteiro: false, inicio: '09:00', fim: '10:30', descricao: '', aviso_min: 15 };
  ok(erroDoEvento(bom) === null && erroDoEvento({ ...bom, fim: null }) === null && erroDoEvento({ ...bom, dia_inteiro: true, inicio: null, fim: null, aviso_min: null }) === null, 'evento válido: com horário (término opcional) ou de dia inteiro');
  ok(/título/.test(erroDoEvento({ ...bom, titulo: '  ' })) && /200/.test(erroDoEvento({ ...bom, titulo: 'x'.repeat(201) })) && /tipo/.test(erroDoEvento({ ...bom, tipo: 'Festa' })) && /existam|exista/.test(erroDoEvento({ ...bom, data: '2026-02-30' })) && /início/.test(erroDoEvento({ ...bom, inicio: null })) && /início/.test(erroDoEvento({ ...bom, inicio: '25:00' })), 'recusa título vazio ou longo, tipo desconhecido, data inexistente (30 de fevereiro) e início ausente ou inválido');
  ok(/depois do início/.test(erroDoEvento({ ...bom, fim: '09:00' })) && /depois do início/.test(erroDoEvento({ ...bom, fim: '08:00' })) && /Horário de término/.test(erroDoEvento({ ...bom, fim: '9h' })) && /não tem horário/.test(erroDoEvento({ ...bom, dia_inteiro: true })) && /Aviso inválido/.test(erroDoEvento({ ...bom, aviso_min: 7 })) && /Aviso inválido/.test(erroDoEvento({ ...bom, dia_inteiro: true, inicio: null, fim: null, aviso_min: 15 })), 'recusa término igual ou antes do início, horário malformado, dia inteiro com horário e aviso fora das opções');
  ok(seSobrepoem(ev('a', { inicio: '09:00', fim: '10:00' }), ev('b', { inicio: '09:30', fim: '11:00' })) && !seSobrepoem(ev('a', { inicio: '09:00', fim: '10:00' }), ev('b', { inicio: '10:00', fim: '11:00' })) && seSobrepoem(ev('a', { inicio: '09:00', fim: null }), ev('b', { inicio: '09:00', fim: '09:30' })) && !seSobrepoem(ev('a', { inicio: '09:00', fim: '10:00' }), ev('b', { data: '2026-11-04', inicio: '09:30' })) && !seSobrepoem(ev('a', { dia_inteiro: true, inicio: null, fim: null }), ev('b')), 'sobreposição: intervalos que se cruzam ou começam juntos; encostar não conta; outro dia e dia inteiro não contam');
  const todos = [ev('a', { inicio: '09:00', fim: '10:00' }), ev('b', { inicio: '09:30', fim: '10:30' }), ev('c', { inicio: '11:00', fim: '12:00' })];
  ok(sobrepostosA(todos[0], todos).map((x) => x.id).join() === 'b' && sobrepostosA({ id: 'novo', data: '2026-11-03', dia_inteiro: false, inicio: '10:15', fim: '11:30' }, todos).map((x) => x.id).join() === 'b,c', 'aviso de sobreposição: o evento não conflita consigo mesmo e um novo mostra com quais conflita');
  ok(ordenarEventos([ev('z', { inicio: '14:00' }), ev('y', { dia_inteiro: true, inicio: null, fim: null }), ev('x', { inicio: '08:00' })]).map((e) => e.id).join() === 'y,x,z' && horarioDe(ev('q')) === '09:00 às 10:00' && horarioDe(ev('q', { fim: null })) === '09:00' && horarioDe(ev('q', { dia_inteiro: true, inicio: null })) === 'Dia inteiro', 'ordem cronológica com dia inteiro primeiro e texto do horário');
  const hoje = '2026-11-03';
  const lista = [ev('perto', { inicio: '09:10', aviso_min: 15 }), ev('longe', { inicio: '11:00', aviso_min: 15 }), ev('sem', { inicio: '09:05', aviso_min: null }), ev('dia', { dia_inteiro: true, inicio: null, fim: null, aviso_min: 0 }), ev('outro', { data: '2026-11-04', inicio: '09:05' })];
  ok(avisosDeHoje(lista, hoje, 9 * 60).map((a) => `${a.evento.id}:${a.tipo}:${a.minutos}`).join() === 'dia:no-dia:0,perto:em-breve:10' && avisosDeHoje(lista, hoje, 9 * 60 + 11).length === 1 && avisosDeHoje(lista, hoje, 8 * 60).map((a) => a.evento.id).join() === 'dia', 'avisos de hoje: com horário só dentro da antecedência escolhida e antes do início; dia inteiro no dia; sem aviso e outro dia ficam de fora');
  ok(minutosAgora(new Date('2026-11-03T15:30:00Z')) === 12 * 60 + 30 && minutosAgora(new Date('2026-11-03T03:05:00Z')) === 5 && rotuloAviso(null) === 'Sem aviso' && rotuloAviso(15) === '15 min antes' && rotuloAviso(120) === '2 h antes', 'hora de Brasília e rótulos de aviso (meia-noite é 0, nunca 24)');
  ok(validarEvento({ ...bom, id: '11111111-1111-4111-8111-111111111111' }, { criando: true }).id === '11111111-1111-4111-8111-111111111111' && /título/.test(lanca(() => validarEvento({ ...bom, titulo: '' }, { criando: true }))) && validarEvento({ titulo: 'Novo título' }, { criando: false }).titulo === 'Novo título' && Object.keys(validarEvento({ aviso_min: 30 }, { criando: false })).join() === 'aviso_min' && /Identificador/.test(lanca(() => validarEvento({ ...bom, id: 'x' }, { criando: true }))), 'validação do servidor: cria com todos os campos, altera só o que veio e recusa identificador inválido');
}

console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
