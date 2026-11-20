// Gera uma cópia v4 com DADOS FICTÍCIOS para a demonstração da restauração em um projeto Supabase descartável (docs/demonstracao-restauracao-descartavel.md).
// O arquivo vem da ROTA REAL do aplicativo (/api/exportar) rodando contra um banco de teste local semeado com dados inventados: é o mesmo formato que a cópia verdadeira tem.
// Nunca toca o Supabase real nem as cópias privadas. Saída padrão: fora do repositório (pasta temporária do sistema); o arquivo e o caminho são impressos, nunca o conteúdo.
// Também grava restaurar-copia-FICTICIA.sql (o restaurar-copia.sql com este JSON embutido), para rodar com `db query -f` sem copiar e colar.
// Uso: node scripts/gerar-copia-ficticia.mjs [pasta-de-saída]
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { iniciarServidor, semearBanco } from './auxiliar-navegador.mjs';

const SAIDA = resolve(process.argv[2] ?? join(tmpdir(), 'dmanda-copia-ficticia'));
const PASTA_BANCO = join(tmpdir(), 'dmanda-copia-ficticia-banco');   // fora do projeto: o banco aberto por este script não pode ficar na árvore que o Next observa
rmSync(PASTA_BANCO, { recursive: true, force: true }); mkdirSync(SAIDA, { recursive: true });
const dia = (n) => new Date(Date.UTC(2026, 10, 3 + n)).toISOString().slice(0, 10);

await semearBanco(PASTA_BANCO, async (c) => {
  const mk = (assunto, o = {}) => c('criar_demanda', { p: { assunto: `FICTÍCIO ${assunto}`, tipo: 'Memorando', etapa: 'Fazendo', ...o } });
  await c('salvar_dia_indisponivel', { p: { data: dia(7), descricao: 'FICTÍCIO feriado avulso', categoria: 'Feriado' } });
  await c('salvar_periodo_indisponivel', { p: { operacao_id: '00000000-0000-4000-8000-0000000000f1', data_inicio: '2026-12-24', data_fim: '2027-01-03', descricao: 'FICTÍCIO recesso', categoria: 'Feriado' } });
  const a = await mk('com prazo e tarefas', { origem: 'Prefeita', tipo: 'Ofício', prazo_original: dia(10), chegou_em: dia(-5), descricao: 'Texto & <b>especial</b> "aspas" ç' });
  for (const t of ['tarefa um', 'tarefa dois', 'tarefa três']) await c('adicionar_tarefa', { p_demanda: a.id, p_texto: `FICTÍCIO ${t}` });
  const b = await mk('aguardando retorno', { etapa: 'Aguardando retorno', setor: 'Contabilidade fictícia', chegou_em: dia(-8) });
  await c('adicionar_tarefa', { p_demanda: b.id, p_texto: 'FICTÍCIO cobrar a resposta' });
  await mk('chegada no recesso', { chegou_em: '2026-12-28', prazo_original: '2026-12-31' });
  const f = await mk('finalizada'); await c('concluir_demanda', { p_id: f.id });
  const g = await mk('arquivada'); await c('arquivar_demanda', { p_id: g.id });
  await c('criar_entrada', { p: { titulo: 'FICTÍCIO nota fixa', texto: 'Texto fictício #tag #geral', cor: 2, fixada: true } });
  const e2 = await c('criar_entrada', { p: { texto: 'FICTÍCIO nota arquivada', cor: 1 } }); await c('arquivar_entrada', { p_id: e2.id });
  const e3 = await c('criar_entrada', { p: { titulo: 'FICTÍCIO virou demanda', texto: 'Conteúdo original preservado', cor: 3 } });
  await c('criar_demanda_de_entrada', { p_entrada: e3.id, p: { id: 'abababab-1212-4212-8212-abababababab', assunto: 'FICTÍCIO demanda nascida de entrada', descricao: e3.texto } });
  await c('criar_evento', { p: { titulo: 'FICTÍCIO reunião', tipo: 'Reunião', data: dia(1), inicio: '09:00', fim: '10:00', aviso_min: null } });
  await c('criar_evento', { p: { titulo: 'FICTÍCIO lembrete', tipo: 'Lembrete', data: dia(4), dia_inteiro: true, aviso_min: null } });
});

const { base, parar } = await iniciarServidor({ porta: Number(process.env.PORTA_COPIA_FICTICIA || 7160), pasta: PASTA_BANCO });
let texto;
try {
  const r = await fetch(base + '/api/exportar');
  if (r.status !== 200) throw new Error(`a rota respondeu ${r.status}`);
  texto = await r.text();
} finally { parar(); }
const j = JSON.parse(texto);
const todas = [...j.demandas, ...j.arquivadas];
if (j.formato !== 'dmanda-exportacao' || j.versao !== 4 || !todas.length || !todas.every((d) => /^FICTÍCIO/.test(d.assunto))) throw new Error('o arquivo gerado não é uma cópia v4 só com dados fictícios: não foi gravado');
const arquivo = join(SAIDA, `dmanda-copia-FICTICIA-v4-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(arquivo, texto);
const hash = createHash('sha256').update(texto).digest('hex');
// o SQL de restauração já com o JSON embutido (sem colar nada à mão): é o supabase/restaurar-copia.sql de verdade, só com a palavra marcadora trocada
const sql = join(SAIDA, 'restaurar-copia-FICTICIA.sql');
writeFileSync(sql, readFileSync('supabase/restaurar-copia.sql', 'utf8').replace('__COLE_AQUI_O_JSON__', () => texto));
console.log(`sql de restauração: ${sql}`);
console.log(`arquivo: ${arquivo}\nsha256: ${hash}\nformato ${j.formato} v${j.versao} | demandas ${j.demandas.length}, arquivadas ${j.arquivadas.length}, tarefas ${todas.reduce((s, d) => s + d.tarefas.length, 0)}, dias ${j.dias_indisponiveis.length}, entradas ${j.entradas.length + j.entradas_arquivadas.length}, eventos ${j.eventos.length}`);
process.exit(0);
