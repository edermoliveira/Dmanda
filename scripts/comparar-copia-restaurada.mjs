// Compara, CAMPO A CAMPO, uma cópia v4 com o que ficou gravado depois de restaurá-la: contagem sozinha prova volume, não conteúdo nem vínculo.
// Entrada 1: o arquivo da cópia v4 (JSON). Entrada 2: a saída de `supabase/propostas/copia_funcional_leitura.sql` rodada no projeto restaurado (`db query ... --output-format json`).
// Confere demandas (todos os campos que a v4 leva), tarefas (texto, estado, posição), entradas e o vínculo com a demanda criada a partir delas, eventos e dias (inclusive o período).
// Só imprime contagens, nomes de campo e resultados: nunca conteúdo. Código de saída 0 só se tudo for idêntico.
// Uso: node scripts/comparar-copia-restaurada.mjs <copia-v4.json> <copia-funcional-do-restaurado.json> [--origem]
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2), ORIGEM = args.includes('--origem');   // --origem: a segunda cópia é do projeto de ORIGEM (que tem humor e vagas), não de um restaurado
const [arqV4, arqFunc] = args.filter((a) => !a.startsWith('--'));
if (!arqV4 || !arqFunc) { console.error('Uso: node scripts/comparar-copia-restaurada.mjs <copia-v4.json> <copia-funcional-do-restaurado.json>'); process.exit(2); }
const v4 = JSON.parse(readFileSync(arqV4, 'utf8'));
const bruto = JSON.parse(readFileSync(arqFunc, 'utf8'));
const acha = (o) => (o && typeof o === 'object' ? (Array.isArray(o.demandas) ? o : Object.values(o).map(acha).find(Boolean)) : null);
const copia = acha(bruto);
if (v4.formato !== 'dmanda-exportacao' || !copia) { console.error('Arquivos inesperados: confira se o segundo é a saída da copia_funcional_leitura.sql.'); process.exit(2); }

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
// hora: a v4 traz 09:00 e a tabela devolve 09:00:00 (a mesma hora, outra forma de escrever)
const hora = (x) => (typeof x === 'string' && /^\d{2}:\d{2}:00$/.test(x) ? x.slice(0, 5) : x);
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : hora(x)));
const porId = (lista) => new Map(lista.map((x) => [x.id, x]));
// valores que voltam diferentes por contrato (derivados ou regravados): timestamps e a chave 'retorno' derivada
const IGNORA = { demandas: ['retorno', 'entrada_id', 'tarefas'], tarefas: ['criado_em'] };

function comparar(nome, esperados, obtidos, ignorar = []) {
  const mapa = porId(obtidos);
  let ausentes = 0, diferentes = 0; const campos = new Set();
  for (const e of esperados) {
    const o = mapa.get(e.id);
    if (!o) { ausentes++; continue; }
    for (const k of Object.keys(e)) {
      if (ignorar.includes(k)) continue;
      if (canon(e[k]) !== canon(o[k])) { diferentes++; campos.add(k); }
    }
  }
  ok(ausentes === 0 && diferentes === 0, `${nome}: ${esperados.length} esperados, ${ausentes} ausentes, ${diferentes} valores diferentes${campos.size ? ' (campos: ' + [...campos].join(', ') + ')' : ''}`);
}

const demandas = [...v4.demandas, ...v4.arquivadas];
comparar('demandas (ativas e arquivadas, todos os campos da v4)', demandas, copia.demandas, IGNORA.demandas);
ok(copia.demandas.length === demandas.length, `demandas: ${copia.demandas.length} no restaurado, ${demandas.length} na cópia (nenhuma a mais)`);
const tarefas = demandas.flatMap((d) => d.tarefas.map((t) => ({ ...t, demanda_id: d.id })));
comparar('tarefas (texto, estado, posição e a demanda a que pertencem)', tarefas, copia.tarefas, IGNORA.tarefas);
ok(copia.tarefas.length === tarefas.length, `tarefas: ${copia.tarefas.length} no restaurado, ${tarefas.length} na cópia`);
const entradas = [...v4.entradas, ...v4.entradas_arquivadas];
comparar('entradas (ativas e arquivadas)', entradas, copia.entradas);
ok(copia.entradas.length === entradas.length, `entradas: ${copia.entradas.length} no restaurado, ${entradas.length} na cópia`);
const vinculadas = entradas.filter((e) => e.demanda_id);
const mapaDem = porId(copia.demandas), mapaEnt = porId(copia.entradas);
ok(vinculadas.every((e) => mapaEnt.get(e.id)?.demanda_id === e.demanda_id && mapaDem.has(e.demanda_id)), `vínculo entrada para demanda: ${vinculadas.length} entradas convertidas, todas apontando para a demanda certa e existente`);
ok(demandas.filter((d) => d.entrada_id).every((d) => mapaEnt.get(d.entrada_id)?.demanda_id === d.id), 'vínculo demanda para entrada: o caminho de volta confere');
comparar('eventos da Agenda', v4.eventos, copia.eventos);
ok(copia.eventos.length === v4.eventos.length, `eventos: ${copia.eventos.length} no restaurado, ${v4.eventos.length} na cópia`);
comparar('dias indisponíveis (inclusive o período a que cada dia pertence)', v4.dias_indisponiveis, copia.dias_indisponiveis);
ok(copia.dias_indisponiveis.length === v4.dias_indisponiveis.length, `dias: ${copia.dias_indisponiveis.length} no restaurado, ${v4.dias_indisponiveis.length} na cópia`);
const periodos = new Set(v4.dias_indisponiveis.filter((d) => d.periodo_id).map((d) => d.periodo_id));
ok([...periodos].every((p) => v4.dias_indisponiveis.filter((d) => d.periodo_id === p).length === copia.dias_indisponiveis.filter((d) => d.periodo_id === p).length), `períodos: ${periodos.size} período(s), cada um com o mesmo número de dias`);
// o que a v4 NÃO leva (por contrato) não pode ter surgido do nada
if (!ORIGEM) ok(['registros_dia', 'para_hoje'].every((t) => !copia[t] || copia[t].length === 0), 'o que a v4 não leva (humor do dia, vagas do Para hoje) não existe no restaurado: ficou vazio, como previsto');
else console.log('(--origem: humor do dia e vagas existem na origem e a v4 não os leva; esta conferência não se aplica)');
console.log(falhas ? `\n${falhas} conferência(s) falharam.` : '\nIdêntico: o conteúdo restaurado confere com a cópia, campo a campo.');
process.exit(falhas ? 1 : 0);
