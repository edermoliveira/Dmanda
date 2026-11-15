// Fila de apresentação dos cards (decisão 77), regras puras sem navegador nem banco: a ordem inicial (Prefeita e Gabinete, atrasadas, vencem hoje, próximas, demais), os grupos por tipo e área
// (cada demanda em um só grupo, tipos cadastrados pelo usuário e sem documento) e o desempate estável. Uso: node scripts/testar-fila.mjs
import { ordenarParaApresentar, agruparPorCategoria, classeDaFila, chaveDoGrupo } from '../src/lib/fila.ts';
import { ehOrigemPrioritaria, prioritariasPrimeiro } from '../src/lib/prioridade.ts';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const hoje = '2026-11-15';
const d = (id, o = {}) => ({ id, etapa: 'Fazendo', etapa_desde: '2026-11-10T15:00:00Z', encaminhada_em: null, reiterada_em: null, arquivada_em: null, prazo: null, acompanhar_em: null, chegou_em: '2026-11-01', criado_em: `2026-11-01T10:00:0${id.length % 10}Z`, tipo: 'Memorando', area: 'Geral', numero: '1/2026', origem: 'Secretaria', assunto: id, prazo_tipo: 'Próprio', ...o });

// classes
ok(classeDaFila(d('a', { prazo: '2026-11-10' }), hoje) === 0 && classeDaFila(d('b', { prazo: hoje }), hoje) === 1 && classeDaFila(d('c', { prazo: '2026-11-18' }), hoje) === 2 && classeDaFila(d('e', { prazo: '2026-12-30' }), hoje) === 3 && classeDaFila(d('f'), hoje) === 3, 'classes: atrasada, hoje, próxima (até 7 dias), demais (além de 7 dias e sem data)');

// ordem
const lista = [
  d('sem-prazo'), d('longe', { prazo: '2026-12-30' }), d('proxima', { prazo: '2026-11-18' }), d('hoje', { prazo: hoje }),
  d('atrasada', { prazo: '2026-11-10' }), d('atrasada-antiga', { prazo: '2026-11-02' }),
  d('pref-sem-prazo', { origem: 'Prefeita' }), d('gab-longe', { origem: 'Gabinete', prazo: '2026-12-30' }), d('pref-atrasada', { origem: 'Pedido da Prefeita', prazo: '2026-11-12' }),
  d('vice', { origem: 'Gabinete do Vice-Prefeito', prazo: '2026-11-20' }),
];
const ord = ordenarParaApresentar(lista, hoje).map((x) => x.id);
ok(ord.slice(0, 3).join() === 'pref-atrasada,gab-longe,pref-sem-prazo', `Prefeita e Gabinete primeiro, e entre eles a regra da fila (${ord.slice(0, 3).join()})`);
ok(ord.slice(3).join() === 'atrasada-antiga,atrasada,hoje,proxima,vice,longe,sem-prazo', `depois atrasadas (a mais antiga primeiro), vencem hoje, próximas e demais (${ord.slice(3).join()})`);
ok(!ehOrigemPrioritaria('Gabinete do Vice-Prefeito') && ehOrigemPrioritaria(' gabinete  da PREFEITA ') && ehOrigemPrioritaria('Solicitação da Prefeita'), 'a prioridade é pela origem inteira (sem trecho, sem diferença de caixa e de espaços)');
ok(ordenarParaApresentar([...lista].reverse(), hoje).map((x) => x.id).join() === ord.join(), 'a ordem não depende da ordem em que a lista chega (desempate estável)');
const finalizada = d('fin', { etapa: 'Finalizado', origem: 'Prefeita' });
ok(ordenarParaApresentar([d('x', { prazo: '2026-11-01' }), finalizada], hoje)[0].id === 'x', 'demanda finalizada não ganha a prioridade da Prefeita');
ok(prioritariasPrimeiro([d('a'), d('b', { origem: 'Prefeita' }), d('c')]).map((x) => x.id).join() === 'b,a,c', 'prioritariasPrimeiro é uma partição estável');
ok(lista.map((x) => x.id).join() === 'sem-prazo,longe,proxima,hoje,atrasada,atrasada-antiga,pref-sem-prazo,gab-longe,pref-atrasada,vice', 'a lista recebida não é alterada (só apresentação)');

// grupos
const dem = [
  d('p-geral', { tipo: 'Processo', area: 'Geral', prazo: '2026-11-10' }), d('p-pess', { tipo: 'Processo', area: 'Pessoal' }), d('p-comp', { tipo: 'Processo', area: 'Compras' }),
  d('prot-geral', { tipo: 'Protocolo', area: 'Geral' }), d('prot-pess', { tipo: 'Protocolo', area: 'Pessoal' }),
  d('memo1', { tipo: 'Memorando', area: 'Pessoal', prazo: hoje }), d('memo2', { tipo: 'Memorando' }),
  d('of', { tipo: 'Ofício' }), d('custom', { tipo: 'Relatório de gestão' }), d('custom-b', { tipo: 'Ata' }), d('custom-caixa', { tipo: ' relatório  DE gestão ' }),
  d('sem', { tipo: null }), d('sem2', { tipo: '' }),
];
const gr = agruparPorCategoria(dem, hoje);
ok(gr.map((g) => g.chave).join() === 'protocolo|Geral,protocolo|Pessoal,processo|Geral,processo|Pessoal,processo|Compras,memorando,ofício,ata,relatório de gestão,sem-documento', `grupos na ordem fixa: tipos de sempre, tipos do usuário em ordem alfabética, sem documento (${gr.map((g) => g.chave).join()})`);
ok(gr.reduce((n, g) => n + g.demandas.length, 0) === dem.length && new Set(gr.flatMap((g) => g.demandas.map((x) => x.id))).size === dem.length, 'cada demanda aparece em um único grupo, sem perder nenhuma');
const cores = Object.fromEntries(gr.map((g) => [g.chave, g.cor]));
ok(cores['processo|Geral'] === 'azul' && cores['processo|Pessoal'] === 'verde' && cores['processo|Compras'] === 'amar' && cores['memorando'] === 'neutro' && cores['sem-documento'] === 'neutro', 'a cor do grupo é a do card: azul, verde e amarelo pela área; neutra nos demais tipos');
ok(gr.find((g) => g.chave === 'memorando').demandas.length === 2 && gr.find((g) => g.chave === 'memorando').demandas[0].id === 'memo1', 'tipo sem área ignora a área (Memorando Pessoal e Geral no mesmo grupo) e a fila do grupo segue a ordem inicial');
ok(gr.find((g) => g.chave === 'relatório de gestão').demandas.length === 2 && gr.find((g) => g.chave === 'sem-documento').demandas.length === 2, 'tipo do usuário agrupa sem diferença de caixa e de espaços; null e vazio ficam em "Sem documento"');
ok(gr.find((g) => g.chave === 'sem-documento').rotulo === 'Sem documento' && gr[0].rotulo === 'Protocolo · Geral', 'rótulos: "Tipo · Área" e "Sem documento"');
ok(chaveDoGrupo({ tipo: 'Processo', area: 'Compras' }) === 'processo|Compras' && chaveDoGrupo({ tipo: null, area: 'Geral' }) === 'sem-documento', 'chaveDoGrupo');
// mais de três por grupo: todos presentes, na ordem (o prazo mais antigo primeiro)
const muitos = Array.from({ length: 9 }, (_, i) => d(`m${i}`, { tipo: 'Processo', area: 'Geral', prazo: `2026-11-${String(20 - i).padStart(2, '0')}` }));
const g9 = agruparPorCategoria(muitos, hoje)[0];
ok(g9.demandas.length === 9 && g9.demandas[0].id === 'm8' && g9.demandas[8].id === 'm0', `grupo com nove demandas mantém as nove, do prazo mais próximo ao mais distante (${g9.demandas.map((x) => x.id).join()})`);
console.log(`\n${total - falhas} de ${total} verificações passaram.`);
process.exit(falhas ? 1 : 0);
