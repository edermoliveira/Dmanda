// Dados para acompanhar a evolução (decisão 65): séries por dia em Brasília, demandas únicas contra ciclos, permanência das abertas, tempo da chegada à conclusão (casos válidos, média, mediana)
// e o "confiável desde" de cada série. Regras puras, sem banco e sem navegador. Uso: node scripts/testar-metricas.mjs
import { calcularMetricas, diaDoInstante, preencherDias, resumir, serieDiaria } from '../src/lib/metricas.ts';

let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const dem = (id, o = {}) => ({ id, criado_em: '2026-11-03T15:00:00.000Z', chegou_em: null, concluida_em: null, etapa: 'Fazendo', arquivada_em: null, ...o });
const tr = (demanda_id, tipo, ciclo, dia, extra = {}) => ({ id: `${demanda_id}-${tipo}-${ciclo}`, demanda_id, tipo, ciclo, dia, ocorreu_em: `${dia}T15:00:00.000Z`, etapa_anterior: tipo === 'conclusao' ? 'Fazendo' : 'Finalizado', etapa_nova: tipo === 'conclusao' ? 'Finalizado' : 'Fazendo', concluida_em_anterior: null, ...extra });
const HOJE = '2026-11-11';

// ---------- resumo estatístico ----------
{
  const v = resumir([]);
  ok(v.casos === 0 && v.media === null && v.mediana === null && v.minimo === null && v.maximo === null, 'sem casos: tudo indisponível (null), nunca zero inventado');
  ok(JSON.stringify(resumir([5])) === JSON.stringify({ casos: 1, media: 5, mediana: 5, minimo: 5, maximo: 5 }), 'um caso: média e mediana são o próprio valor');
  const p = resumir([10, 2, 7]); ok(p.mediana === 7 && p.media === 6.33 && p.minimo === 2 && p.maximo === 10, 'quantidade ímpar: mediana do meio e média com duas casas');
  const q = resumir([8, 1, 2, 13]); ok(q.mediana === 5 && q.media === 6, 'quantidade par: mediana é a média dos dois do meio');
  ok(resumir([3, 1, 2]).mediana === 2 && resumir([0, 0, 9]).mediana === 0, 'a ordem de entrada não importa e zero é um valor válido');
}

// ---------- série por dia, em Brasília ----------
{
  ok(diaDoInstante('2026-11-04T02:30:00.000Z') === '2026-11-03' && diaDoInstante('2026-11-04T03:00:00.000Z') === '2026-11-04' && diaDoInstante('2026-11-03T23:59:00.000Z') === '2026-11-03', 'o dia é o de Brasília (UTC-3): 02h30 UTC ainda é o dia anterior, 03h00 UTC já é o dia novo');
  const s = serieDiaria([{ dia: '2026-11-05', demanda: 'a' }, { dia: '2026-11-03', demanda: 'b' }, { dia: '2026-11-05', demanda: 'a' }, { dia: '2026-11-05', demanda: 'c' }]);
  ok(JSON.stringify(s) === JSON.stringify([{ dia: '2026-11-03', demandas: 1, ciclos: 1 }, { dia: '2026-11-05', demandas: 2, ciclos: 3 }]), 'demandas únicas e ciclos são contados à parte e a série vem em ordem de dia (só dias com dado)');
  const d = preencherDias(s, '2026-11-02', '2026-11-06');
  ok(d.length === 5 && d.map((x) => x.ciclos).join() === '0,1,0,3,0' && d[0].dia === '2026-11-02' && d[4].dia === '2026-11-06', 'preencher dias completa com zero entre as datas escolhidas (inclusive as pontas), sem mudar quem tem dado');
  ok(preencherDias([], '2026-12-30', '2027-01-02').map((x) => x.dia).join() === '2026-12-30,2026-12-31,2027-01-01,2027-01-02', 'preencher atravessa a virada de ano');
}

// ---------- cenário completo ----------
{
  const demandas = [
    dem('D1', { chegou_em: '2026-11-02', etapa: 'Fazendo' }),                                              // concluída (10/11), reaberta (12/11), concluída de novo (15/11) e reaberta de novo (hoje abre)
    dem('D2', { chegou_em: '2026-10-10', etapa: 'Finalizado', concluida_em: '2026-10-20' }),              // finalizada ANTES da coleta: só a data comprovada (legado)
    dem('D3', { chegou_em: '2026-11-01' }),                                                               // aberta, 10 dias
    dem('D4'),                                                                                            // aberta sem chegada
    dem('D5', { chegou_em: '2026-11-09', criado_em: '2026-11-04T02:30:00.000Z' }),                        // aberta, 2 dias; cadastrada às 23h30 de 03/11 em Brasília
    dem('D6', { chegou_em: '2026-11-12', etapa: 'Finalizado', concluida_em: '2026-11-10' }),              // chegada digitada depois da conclusão: inválida
    dem('D7', { etapa: 'Finalizado', concluida_em: '2026-11-09' }),                                       // finalizada sem chegada
    dem('D8', { chegou_em: '2026-11-05', etapa: 'Finalizado', concluida_em: '2026-11-08', arquivada_em: '2026-11-09T12:00:00.000Z' }),   // arquivada com conclusão gravada
    dem('D9', { chegou_em: '2026-10-01', etapa: 'Vistos' }),                                              // legado reaberto: reabertura ciclo 0 guardou a data antiga
  ];
  const coleta = {
    desde: '2026-11-08',
    transicoes: [
      tr('D1', 'conclusao', 1, '2026-11-10'), tr('D1', 'reabertura', 1, '2026-11-12', { concluida_em_anterior: '2026-11-10' }), tr('D1', 'conclusao', 2, '2026-11-15'), tr('D1', 'reabertura', 2, '2026-11-16', { concluida_em_anterior: '2026-11-15' }),
      tr('D8', 'conclusao', 1, '2026-11-08'),
      tr('D9', 'reabertura', 0, '2026-11-09', { concluida_em_anterior: '2026-10-15' }),
      tr('FANTASMA', 'conclusao', 1, '2026-11-09'),                                                         // demanda excluída/desconhecida: ignorada
    ],
  };
  const m = calcularMetricas(demandas, coleta, HOJE);
  ok(m.totais.cadastros === 9 && m.series.cadastros.map((p) => `${p.dia}:${p.demandas}`).join() === '2026-11-03:9', `cadastros: o dia vem do instante em Brasília (todos em 03/11, inclusive o de 02h30 UTC) (${m.series.cadastros.map((p) => p.dia).join()})`);
  ok(m.totais.chegadas === 7 && m.series.chegadas.find((p) => p.dia === '2026-11-09')?.demandas === 1 && !m.series.chegadas.some((p) => p.dia === 'null'), 'chegadas: só entram demandas com a data de chegada (as sem data não viram dia nenhum)');
  ok(m.totais.conclusoesCiclos === 3 && m.totais.conclusoesDemandas === 2 && m.series.conclusoes.map((p) => `${p.dia}:${p.demandas}/${p.ciclos}`).join() === '2026-11-08:1/1,2026-11-10:1/1,2026-11-15:1/1', `conclusões registradas: 2 demandas únicas, 3 ciclos (a demanda reaberta e concluída de novo conta 1 demanda e 2 ciclos) (${JSON.stringify(m.totais)})`);
  ok(m.totais.reaberturasCiclos === 3 && m.totais.reaberturasDemandas === 2, 'reaberturas: 2 demandas, 3 ciclos (as do legado e as do ciclo 1 e 2)');
  const leg = m.series.conclusoesLegadas.map((p) => p.dia).join();
  ok(m.totais.conclusoesLegadasCiclos === 4 && leg === '2026-10-15,2026-10-20,2026-11-09,2026-11-10', `conclusões legadas (datas comprovadas, à parte das registradas): D2, D6, D7 finalizadas sem conclusão gravada e a data antiga guardada pela reabertura de D9 (${leg})`);
  ok(m.permanenciaAbertas.casos === 4 && m.permanenciaAbertas.media === 15.5 && m.permanenciaAbertas.mediana === 9.5 && m.permanenciaAbertas.semChegada === 1 && m.permanenciaAbertas.maximo === 41, `permanência das abertas (D1 9, D3 10, D5 2 e D9 41 dias; D4 não tem chegada): média 15,5 e mediana 9,5 dias corridos; 1 sem chegada fica de fora e é contada (${JSON.stringify(m.permanenciaAbertas)})`);
  // chegada até a conclusão por ciclo: D1 8 e 13 dias; D8 3; legados: D2 10, D9 14, D6 inválido (-2), D7 sem chegada
  const c = m.chegadaAteConclusao;
  ok(c.casos === 5 && c.semChegada === 1 && c.invalidos === 1 && c.mediana === 10 && c.media === 9.6 && c.minimo === 3 && c.maximo === 14, `tempo da chegada à conclusão: 5 casos válidos (3, 8, 10, 13 e 14 dias), média 9,6 e mediana 10; 1 sem chegada e 1 inválido (conclusão antes da chegada) à parte (${JSON.stringify(c)})`);
  ok(m.confiavelDesde.cadastros === '2026-11-03' && m.confiavelDesde.chegadas === '2026-10-01' && m.confiavelDesde.conclusoesRegistradas === '2026-11-08' && m.confiavelDesde.reaberturas === '2026-11-08' && m.confiavelDesde.conclusoesLegadas === '2026-10-15', `cada série diz desde quando é confiável (${JSON.stringify(m.confiavelDesde)})`);
  // a reabertura não apaga o histórico: D1 continua com as duas conclusões e as datas antigas
  ok(m.series.conclusoes.filter((p) => p.dia === '2026-11-10' || p.dia === '2026-11-15').length === 2, 'depois de reabrir, as conclusões antigas continuam na série (o histórico fica)');
}

// ---------- casos de borda ----------
{
  const vazio = calcularMetricas([], { desde: null, transicoes: [] }, HOJE);
  ok(vazio.totais.cadastros === 0 && vazio.permanenciaAbertas.casos === 0 && vazio.permanenciaAbertas.media === null && vazio.chegadaAteConclusao.mediana === null && vazio.confiavelDesde.chegadas === null && vazio.confiavelDesde.conclusoesRegistradas === null, 'sem demandas: séries vazias e tudo indisponível, sem erro e sem zero inventado');
  const so = calcularMetricas([dem('X', { chegou_em: '2026-11-11' })], { desde: null, transicoes: [tr('X', 'conclusao', 1, '2026-11-11')] }, HOJE);
  ok(so.confiavelDesde.conclusoesRegistradas === '2026-11-11' && so.chegadaAteConclusao.casos === 1 && so.chegadaAteConclusao.mediana === 0, 'sem a data de início da coleta, vale a primeira transição gravada; chegada e conclusão no mesmo dia dão 0 dia (válido)');
  const futuro = calcularMetricas([dem('F', { chegou_em: '2026-11-20' })], { desde: null, transicoes: [] }, HOJE);
  ok(futuro.permanenciaAbertas.mediana === 0 && futuro.permanenciaAbertas.casos === 1, 'chegada futura (digitada adiantada) conta 0 dia de permanência, nunca negativa');
  const arq = calcularMetricas([dem('A', { chegou_em: '2026-11-01', arquivada_em: '2026-11-05T12:00:00.000Z' })], { desde: null, transicoes: [] }, HOJE);
  ok(arq.permanenciaAbertas.casos === 0 && arq.totais.chegadas === 1 && arq.totais.cadastros === 1, 'arquivada não é "aberta" para a permanência, mas continua contando como chegada e cadastro');
}

console.log(falhas ? `\n${falhas} de ${total} verificações falharam.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
