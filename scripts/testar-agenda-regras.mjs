// Regras puras da Agenda (src/lib/agenda.ts, eventos.ts e a etapa Aguardando Prefeita de demandas.ts), sem navegador nem banco. Uso: node scripts/testar-agenda-regras.mjs
import {
  gradeMes, somarMeses, semanaDe, diasNoMes, tituloMes, rotuloSemana, dataPorExtenso, contagemRetorno, marcosDaDemanda, dataAplicavel, cargaDaDemanda, nivelDaCarga, cargaPorDia,
  pendenciasSemPrazo, itensDoDia, descreverDia, diaMaisLivre, panorama, marcosPorDia, LIMIARES_CARGA, colunaNaSemana, trocarMes, itensParaGrade, recortarItensGrade, dataCurta, MES_ABREV, MES_DIAS_ABREV, MES_DIAS_NOMES,
} from '../src/lib/agenda.ts';
import { esperaPrefeita, ordemDaEtapa, ETAPAS, ETAPA_COR } from '../src/lib/demandas.ts';
import { diaDaSemana, ajustarPrazo, somarDias } from '../src/lib/prazos.ts';
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
  const fev27 = gradeMes(2027, 2), fev26 = gradeMes(2026, 2), fev24 = gradeMes(2024, 2), ago26 = gradeMes(2026, 8), nov26 = gradeMes(2026, 11);
  ok(fev27.length === 4 && fev27[0][0] === '2027-02-01' && fev27[3][6] === '2027-02-28' && fev27.flat().every(Boolean), 'fevereiro de 2027 começa na segunda e termina no domingo: 4 semanas completas, sem espaços vazios');
  ok(fev26.length === 5 && fev26[0].slice(0, 6).every((x) => x === null) && fev26[0][6] === '2026-02-01' && fev26[1][0] === '2026-02-02' && fev26[4][5] === '2026-02-28' && fev26[4][6] === null, 'fevereiro de 2026 começa no domingo: o dia 1 fica na última coluna, em uma semana quase vazia, e o mês fecha em 5 semanas');
  ok(fev24.length === 5 && fev24[0].slice(0, 3).every((x) => x === null) && fev24[0][3] === '2024-02-01' && fev24.flat().includes('2024-02-29') && fev24[4][3] === '2024-02-29' && fev24[4].slice(4).every((x) => x === null), 'ano bissexto: fevereiro de 2024 começa na quinta, tem o dia 29 e completa a última semana com vazios');
  ok(ago26.length === 6 && ago26[0].slice(0, 5).every((x) => x === null) && ago26[0][5] === '2026-08-01' && ago26[0][6] === '2026-08-02', 'agosto de 2026 começa no sábado: cinco posições vazias e 6 semanas');
  ok(nov26.length === 6 && nov26[0].slice(0, 6).every((x) => x === null) && nov26[0][6] === '2026-11-01' && nov26[1][0] === '2026-11-02' && nov26[5][0] === '2026-11-30' && nov26[5].slice(1).every((x) => x === null), 'novembro de 2026: o dia 1 (domingo) fica sozinho na primeira semana, a segunda 2 abre a segunda e a segunda 30 abre a sexta semana, com o resto vazio');
  let tudo = true, qtd = 0;
  for (let a = 2024; a <= 2030; a++) for (let m = 1; m <= 12; m++) {
    const g = gradeMes(a, m), nn = g.flat().filter(Boolean);
    if (!g.every((s) => s.length === 7) || nn.length !== diasNoMes(a, m) || nn[0] !== `${a}-${String(m).padStart(2, '0')}-01`) tudo = false;
    g.forEach((s) => s.forEach((x, i) => { if (x && colunaNaSemana(x) !== i) tudo = false; }));
    qtd++;
  }
  ok(tudo && qtd === 84, 'em 84 meses (2024 a 2030) toda semana tem 7 posições, cada data cai na coluna do seu dia da semana (segunda na primeira, domingo na última) e a quantidade de dias confere');
  ok(colunaNaSemana('2026-11-02') === 0 && colunaNaSemana('2026-11-08') === 6 && colunaNaSemana('2026-11-01') === 6 && colunaNaSemana('2026-11-07') === 5 && MES_DIAS_ABREV.join() === 'SEG,TER,QUA,QUI,SEX,SÁB,DOM' && MES_DIAS_NOMES.length === 7 && MES_ABREV.join('') === 'JANFEVMARABRMAIJUNJULAGOSETOUTNOVDEZ', 'colunas de segunda a domingo e os rótulos do cabeçalho do Mês e das abas JAN a DEZ');
  ok(trocarMes('2026-11-18', 1) === '2026-01-18' && trocarMes('2026-11-18', 12) === '2026-12-18' && trocarMes('2026-01-31', 2) === '2026-02-28' && trocarMes('2024-01-31', 2) === '2024-02-29' && trocarMes('2026-03-31', 4) === '2026-04-30' && trocarMes('2026-12-31', 12) === '2026-12-31', 'a aba de mês leva ao mês escolhido do mesmo ano, mantendo o dia ou usando o último dia do mês (28, 29 ou 30)');
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

// ---------- o que a célula do Mês mostra e o "+N" ----------
{
  const dia = '2026-11-10';
  const eventos = [ev('almoco', { data: dia, inicio: '14:00', fim: '15:00' }), ev('todo', { data: dia, dia_inteiro: true, inicio: null, fim: null, aviso_min: 0 }), ev('cedo', { data: dia, inicio: '09:00', fim: null }), ev('outro', { data: '2026-11-11' })];
  const demandas = [
    dem('d1', { assunto: 'Prazo ajustado', prazo: dia, prazo_original: '2026-11-14' }),
    dem('d2', { assunto: 'Vence e acompanha no mesmo dia', prazo: dia, prazo_original: dia, acompanhar_em: dia }),
    dem('d3', { assunto: 'Só acompanha', acompanhar_em: dia }),
    dem('d4', { assunto: 'Outro dia', prazo: '2026-11-05', prazo_original: '2026-11-05' }),
    dem('d5', { assunto: 'Já finalizada', etapa: 'Finalizado', prazo: dia, prazo_original: dia }),
    dem('d6', { assunto: 'Arquivada', arquivada_em: '2026-11-01T10:00:00Z', prazo: dia, prazo_original: dia }),
  ];
  const o = { demandas, eventos, indisponiveis: [], hoje: '2026-11-03' };
  const it = itensParaGrade(dia, o);
  ok(it.map((x) => `${x.tipo}:${x.id}`).join() === 'evento:todo,evento:cedo,evento:almoco,demanda:d1,demanda:d2,demanda:d3', 'a célula lista primeiro os compromissos (dia inteiro, depois por horário) e então as demandas, uma linha por demanda, sem finalizada, arquivada nem itens de outro dia');
  ok(it[0].diaInteiro === true && it[0].hora === null && it[1].hora === '09:00' && it[2].hora === '14:00', 'o compromisso de dia inteiro é indicado como tal e os demais mostram a hora de início');
  ok(it[3].titulo === 'Prazo ajustado' && it[3].marco === 'vencimento' && it[3].atrasado === false, 'a demanda aparece pelo assunto, no dia do vencimento efetivo (o ajustado já gravado, não o prazo original)');
  ok(it[4].marcos.join() === 'vencimento,acompanhamento' && it[4].marco === 'vencimento' && it[5].marco === 'acompanhamento' && it[5].marcos.length === 1, 'dois marcos da mesma demanda no mesmo dia viram uma linha só, e o acompanhamento fica distinto do vencimento na sua própria data');
  const tarde = itensParaGrade(dia, { ...o, hoje: '2026-11-12' });
  ok(tarde.filter((x) => x.tipo === 'demanda').every((x) => x.atrasado) && !tarde.some((x) => x.tipo === 'evento' && x.atrasado), 'marco que já passou fica no dia em que ocorreu, marcado como atrasado; compromisso não tem atraso');
  const comFin = itensParaGrade(dia, { ...o, comFinalizadas: true });
  ok(comFin.some((x) => x.id === 'd5') && !comFin.some((x) => x.id === 'd6'), 'com o filtro de finalizadas a finalizada aparece no vencimento; a arquivada nunca aparece');
  ok(itensParaGrade('2026-11-17', o).length === 0, 'dia vazio não tem itens');
  const ret = itensParaGrade('2026-11-13', { ...o, demandas: [dem('r', { assunto: 'Aguardando', etapa: 'Aguardando retorno', etapa_desde: '2026-11-03T15:00:00Z' })] });
  ok(ret.length === 1 && ret[0].marco === 'retorno', 'o retorno do setor aparece na própria data (10 dias depois), como marco diferente do vencimento');
  const ids = (r) => r.visiveis.map((x) => x.id).join();
  const r3 = recortarItensGrade(it, 3), r2 = recortarItensGrade(it, 2), r1 = recortarItensGrade(it, 1), r6 = recortarItensGrade(it, 6), r9 = recortarItensGrade(it, 9), r0 = recortarItensGrade(it, 0);
  ok(ids(r3) === 'todo,cedo,d1' && r3.restantes === 3, 'com três compromissos e três demandas e limite de três, entram o primeiro compromisso, o primeiro vencimento e a próxima linha da ordem do dia; o "+N" conta os três ocultos');
  ok(ids(r2) === 'todo,d1' && r2.restantes === 4, 'com duas linhas, uma é do primeiro compromisso e a outra do primeiro vencimento: nenhum tipo some');
  ok(ids(r1) === 'd1' && r1.restantes === 5 && ids(r0) === 'd1' && r0.restantes === 5, 'com uma linha só, o vencimento tem prioridade; limite menor que 1 conta como 1');
  ok(r6.restantes === 0 && r6.visiveis.length === 6 && ids(r6) === it.map((x) => x.id).join() && r9.restantes === 0 && recortarItensGrade([], 3).restantes === 0, 'sem excesso não há "+N" e a ordem do dia é mantida; lista vazia não tem "+N"');
  ok(recortarItensGrade(it.slice(0, 3), 3).restantes === 0 && recortarItensGrade(it.slice(0, 4), 3).restantes === 1 && recortarItensGrade(it, 2).restantes === 4, 'o "+N" só nasce quando passa do limite da tela (duas ou três linhas)');
  const gev = (id) => ({ tipo: 'evento', id, titulo: id, diaInteiro: false, hora: '09:00' }), gdm = (id, marco, atrasado = false) => ({ tipo: 'demanda', id, titulo: id, marco, marcos: [marco], atrasado });
  const so = (l, n) => recortarItensGrade(l, n);
  ok(ids(so([gev('a'), gev('b'), gdm('r', 'retorno')], 2)) === 'a,r' && ids(so([gev('a'), gev('b'), gdm('x', 'acompanhamento'), gdm('v', 'vencimento')], 2)) === 'a,v', 'sem vencimento no dia, a linha de demanda vai para a primeira demanda; com vencimento, ele é o escolhido antes do acompanhamento');
  ok(ids(so([gdm('a1', 'acompanhamento', true), gdm('v1', 'vencimento'), gev('e')].sort((x, y) => (x.tipo === 'evento' ? -1 : 1) - (y.tipo === 'evento' ? -1 : 1)), 1)) === 'v1', 'uma linha só: o vencimento vem antes de um acompanhamento atrasado e de um compromisso');
  ok(ids(so([gev('a'), gev('b'), gev('c')], 2)) === 'a,b' && ids(so([gdm('v1', 'vencimento'), gdm('v2', 'vencimento'), gdm('v3', 'vencimento')], 2)) === 'v1,v2' && ids(so([gev('a'), gev('b'), gev('c')], 1)) === 'a', 'só de um tipo: vale a ordem do dia');
  ok(ids(so([gev('a'), gev('b'), gdm('v1', 'vencimento'), gdm('v2', 'vencimento')], 3)) === 'a,b,v1' && so([gev('a'), gev('b'), gdm('v1', 'vencimento'), gdm('v2', 'vencimento')], 3).restantes === 1, 'o "+N" é sempre o número de itens realmente ocultos');
  ok(dataCurta('2026-11-18', '2026-11-03') === 'Quarta, 18 de novembro' && dataCurta('2026-12-15', '2026-11-03') === 'Terça, 15 de dezembro' && dataCurta('2027-01-05', '2026-11-03') === 'Terça, 5 de janeiro de 2027' && dataCurta('2026-11-21', '2026-11-03') === 'Sábado, 21 de novembro', 'o cabeçalho curto da gaveta é "Quarta, 18 de novembro" e só traz o ano quando ele não é o de hoje');
  const sem = descreverDia(dia, { carga: undefined, eventos: 3, indisponiveis: [], hoje: '2026-11-03', semDemandas: true });
  ok(/pendências indisponíveis/.test(sem) && !/sem pendências/.test(sem) && /3 compromissos/.test(sem) && /sem pendências/.test(descreverDia(dia, { eventos: 0, indisponiveis: [], hoje: '2026-11-03' })), 'com a leitura das demandas falha a descrição diz "pendências indisponíveis", nunca "sem pendências"; os compromissos continuam contados');
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

// ---------- varredura por data de referência (a causa das falhas de testar:agenda em 04/11/2026) ----------
// O cenário do teste de navegador é relativo a "hoje": vencimentos em hoje-2, +3, +9, +20 e +25, acompanhamento em hoje+2 e feriado em hoje+7. Como o vencimento é antecipado para o primeiro
// dia disponível, o resultado depende do dia da semana e do mês de hoje (hoje+3 num sábado vira sexta e pode cair no mesmo dia de hoje+2; hoje-2 pode ser do mês anterior). Aqui o mesmo
// cenário passa por TODAS as datas de 2026 a 2028 (fins de semana, virada de mês e de ano, 29/02/2028) e as regras reais são conferidas contra uma conta independente e simples.
{
  const fmt = (d) => d.toISOString().slice(0, 10);
  const andar = (de, ate) => { const l = []; for (let d = new Date(`${de}T00:00:00Z`); fmt(d) <= ate; d.setUTCDate(d.getUTCDate() + 1)) l.push(fmt(d)); return l; };
  let datas = 0, colisoes = 0, mesAnterior = 0;
  const erros = [];
  for (const R of andar('2026-01-01', '2028-12-31')) {
    datas++;
    const feriado = { id: 'f', data: somarDias(R, 7), descricao: 'Feriado de teste', categoria: 'Feriado', criado_em: '2026-01-01T00:00:00Z' };
    const dias = [feriado];
    const comPrazo = (n) => { const a = ajustarPrazo(somarDias(R, n), dias); return { prazo_original: somarDias(R, n), prazo: a.prazo }; };
    const L = [
      dem('a', { ...comPrazo(3), tarefas: tf(3, 1) }), dem('b', { ...comPrazo(-2), tarefas: tf(1) }), dem('d', { acompanhar_em: somarDias(R, 2), tarefas: tf(2) }),
      dem('e', { ...comPrazo(20) }), dem('f', { ...comPrazo(25) }), dem('h', { ...comPrazo(9), tarefas: tf(9) }),
    ];
    // 1) o vencimento ajustado nunca cai em dia indisponível, nunca passa do original e só recua por dias realmente indisponíveis
    const indisp = (iso) => diaDaSemana(iso) === 0 || diaDaSemana(iso) === 6 || iso === feriado.data;
    for (const d of L.filter((x) => x.prazo)) {
      if (indisp(d.prazo) || d.prazo > d.prazo_original) erros.push(`${R} ${d.id}: prazo ${d.prazo} inválido`);
      for (let x = somarDias(d.prazo, 1); x <= d.prazo_original; x = somarDias(x, 1)) if (!indisp(x)) erros.push(`${R} ${d.id}: antecipou por um dia disponível (${x})`);
    }
    // 2) cada demanda soma uma vez, no dia da primeira data; o total do mês bate com a conta direta
    const carga = cargaPorDia(L, dias, R);
    const soma = [...carga.values()].reduce((t, c) => t + c.carga, 0), esperadoTotal = L.reduce((t, d) => t + (d.tarefas.filter((x) => !x.concluida).length || 1), 0);
    if (soma !== esperadoTotal) erros.push(`${R}: carga total ${soma} diferente de ${esperadoTotal}`);
    const h = L.find((x) => x.id === 'h'), mes = h.prazo.slice(0, 7), de = `${mes}-01`, ate = `${mes}-${String(diasNoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)))).padStart(2, '0')}`;
    const direto = L.reduce((t, d) => { const datasD = [d.prazo, d.acompanhar_em].filter(Boolean).sort(); return t + (datasD.length && datasD[0] >= de && datasD[0] <= ate ? (d.tarefas.filter((x) => !x.concluida).length || 1) : 0); }, 0);
    const pan = panorama(carga, [], dias, R, de, ate).pendencias;
    if (pan !== direto) erros.push(`${R}: pendências do mês ${pan} diferente da conta direta ${direto}`);
    // 3) o dia do vencimento de "a" lista os marcos de todas as demandas que têm marco nesse dia (colisão incluída)
    const a = L.find((x) => x.id === 'a');
    const marcosNoDia = itensDoDia(a.prazo, { demandas: L, eventos: [], indisponiveis: dias, hoje: R }).marcos.length;
    const diretoMarcos = L.reduce((t, d) => t + [d.prazo, d.acompanhar_em].filter((x) => x === a.prazo).length, 0);
    if (marcosNoDia !== diretoMarcos) erros.push(`${R}: ${marcosNoDia} marcos no dia ${a.prazo}, esperado ${diretoMarcos}`);
    if (diretoMarcos > 1) colisoes++;
    if (L.find((x) => x.id === 'b').prazo.slice(0, 7) !== h.prazo.slice(0, 7)) mesAnterior++;
  }
  ok(erros.length === 0, `varredura de ${datas} datas de referência (2026 a 2028): vencimento ajustado, carga por dia, total do mês e marcos do dia batem com a conta direta${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
  ok(colisoes > 100 && mesAnterior > 100, `a varredura exercita os dois casos que quebravam o teste de navegador: ${colisoes} datas com vencimento e acompanhamento no mesmo dia e ${mesAnterior} com a demanda atrasada no mês anterior`);
  // o dia em que o teste de navegador falhou (quarta 04/11/2026): hoje+3 é sábado e vira sexta 06/11, junto do acompanhamento de hoje+2
  const R = '2026-11-04', ap = ajustarPrazo(somarDias(R, 3), []);
  ok(diaDaSemana(somarDias(R, 3)) === 6 && ap.prazo === '2026-11-06' && somarDias(R, 2) === '2026-11-06', 'caso de 04/11/2026: o vencimento de hoje+3 (sábado) é antecipado para sexta 06/11, o mesmo dia do acompanhamento de hoje+2');
}

console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
