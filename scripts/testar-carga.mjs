// Carga pendente semanal e mensal do Início (src/lib/carga.ts), sem navegador nem banco. Uso: node scripts/testar-carga.mjs
import { semanaDe, cargaSemana, cargaPorDia, gradeDoMes, dataAplicavel } from '../src/lib/carga.ts';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const hoje = '2026-10-30'; // sexta-feira
const t = (n, feitas = 0) => Array.from({ length: n }, (_, i) => ({ id: 't' + i, texto: 'x', concluida: i < feitas, posicao: i }));
const d = (id, o) => ({ id, etapa: 'Fazendo', prazo: null, acompanhar_em: null, concluida_em: null, arquivada_em: null, tarefas: [], ...o });
ok(JSON.stringify(semanaDe('2026-10-30')) === '{"inicio":"2026-10-25","fim":"2026-10-31"}', 'semana de domingo a sábado (sexta 30/10 -> 25/10 a 31/10)');
ok(JSON.stringify(semanaDe('2026-10-25')) === '{"inicio":"2026-10-25","fim":"2026-10-31"}' && semanaDe('2026-10-31').inicio === '2026-10-25', 'domingo e sábado pertencem à mesma semana');
const lista = [
  d('atras', { prazo: '2026-10-20', tarefas: t(4, 1) }),            // atrasada: 3 pendentes
  d('hoje', { prazo: hoje }),                                          // sem tarefas: 1 unidade
  d('sab', { prazo: '2026-10-31', tarefas: t(2) }),                    // 2 pendentes
  d('prox', { prazo: '2026-11-02', tarefas: t(5) }),                   // fora da semana
  d('acomp', { etapa: 'Aguardando retorno', acompanhar_em: '2026-10-28', tarefas: t(1) }), // acompanhamento na semana
  d('semdata', { tarefas: t(3) }),                                     // contador separado
  d('feita', { etapa: 'Finalizado', prazo: '2026-10-27', concluida_em: '2026-10-28', tarefas: t(2, 2) }), // concluída na semana: 2 no total
  d('feita-domingo', { etapa: 'Finalizado', prazo: '2026-10-25', concluida_em: '2026-10-25', tarefas: t(1, 1) }), // domingo é o primeiro dia da semana: não pode recuar para sábado
  d('feita-antes', { etapa: 'Finalizado', prazo: '2026-10-10', concluida_em: '2026-10-12', tarefas: t(3, 3) }), // concluída antes: fora
];
const c = cargaSemana(lista, hoje);
ok(c.pendentes === 3 + 1 + 2 + 1 && c.concluidas === 3 && c.total === 10, `pendentes 7, concluídas na semana 3 (inclui a de domingo), total 10 (obtido ${c.pendentes}/${c.concluidas}/${c.total})`);
ok(c.pct === 70 && c.semData === 1, 'percentual de carga pendente = 7/10 e uma demanda sem data fica em contador separado');
ok(c.atrasadas === 2 && c.hoje === 1, 'atrasadas e vencendo hoje contadas à parte');
ok(cargaSemana([], hoje).pct === null, 'sem nada na semana não há percentual (nada é inventado)');
ok(cargaSemana([d('x', { prazo: '2026-11-20' })], hoje).total === 0, 'demanda de outra semana não entra');
ok(dataAplicavel(d('y', { prazo: '2026-11-05', acompanhar_em: '2026-11-01' })) === '2026-11-01' && dataAplicavel(d('z')) === null, 'a data mais próxima entre prazo e acompanhamento é a aplicável; sem datas, nenhuma');
const m = cargaPorDia(lista);
ok(m.get('2026-10-20') === 3 && m.get('2026-10-30') === 1 && !m.has('2026-10-27') && !m.has('2026-10-12'), 'carga por dia: só abertas com data; concluídas saem');
const g = gradeDoMes(2026, 10, m);
ok(g.length === 4 + 31 && g.slice(0, 4).every((x) => x === null) && g[4].iso === '2026-10-01', 'outubro/2026 começa numa quinta: 4 posições vazias antes do dia 1');
ok(g.find((x) => x?.iso === '2026-10-20').nivel === 4 && g.find((x) => x?.iso === '2026-10-30').nivel === 2 && g.find((x) => x?.iso === '2026-10-05').nivel === 0, 'escala sequencial 0 a 4 relativa ao maior valor do mês');
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
