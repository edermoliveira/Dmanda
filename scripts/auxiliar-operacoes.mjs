// A lista de operações que o servidor pode pedir ao banco existe em dois lugares que precisam mudar juntos: as chamadas no código (src/nucleo/operacoes.ts e src/servidor/*.ts) e a lista fixa de
// public.executar_como_titular no SQL (a migração mais recente que a define). Este auxiliar lê as duas, para os testes cobrarem a ligação em vez de a convenção ficar só na memória de quem mexe.
import { readdirSync, readFileSync } from 'node:fs';

const MIGRACOES = 'supabase/migrations';

/** As operações liberadas no banco: a lista `v_permitidas` da última migração que define executar_como_titular. */
export function operacoesPermitidasNoBanco() {
  const definidoras = readdirSync(MIGRACOES).filter((f) => f.endsWith('.sql')).sort().filter((f) => readFileSync(`${MIGRACOES}/${f}`, 'utf8').includes('function public.executar_como_titular'));
  const arquivo = definidoras.at(-1);
  const sql = readFileSync(`${MIGRACOES}/${arquivo}`, 'utf8');
  const bloco = sql.slice(sql.indexOf('v_permitidas constant text[] := array['));
  const lista = bloco.slice(0, bloco.indexOf('];')).match(/'([a-z_]+)'/g) ?? [];
  return { arquivo, nomes: lista.map((x) => x.slice(1, -1)) };
}

/** Os nomes que o código passa para executar_como_titular (primeiro argumento de chamar/demanda/entrada/evento). */
export function operacoesChamadasPeloCodigo() {
  const arquivos = ['src/nucleo/operacoes.ts', 'src/app/api/exportar/route.ts', ...readdirSync('src/servidor').filter((f) => f.endsWith('.ts')).map((f) => `src/servidor/${f}`)];
  const nomes = new Set();
  for (const f of arquivos) for (const m of readFileSync(f, 'utf8').matchAll(/\b(?:chamar|demanda|entrada|evento)\(\s*'([a-z_]+)'/g)) nomes.add(m[1]);
  return [...nomes].sort();
}
