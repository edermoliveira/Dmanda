// Mostra os dados de evolução (decisão 65) de um banco de TESTE local, em JSON: séries por dia, demandas únicas contra ciclos, permanência das abertas e tempo da chegada à conclusão.
// Só leitura e só em banco de teste (PGlite em .dados-teste/): nunca toca o Supabase real. O servidor que usa essa pasta precisa estar parado.
// Uso: node scripts/metricas-local.mjs [pasta do banco de teste, ex.: .dados-teste/inicio-completo] [usuário]
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { calcularMetricas } from '../src/lib/metricas.ts';
import { hojeISO } from '../src/lib/demandas.ts';

const pasta = process.argv[2] || '.dados-teste/inicio-completo';
if (!/^\.dados-teste[\\/]/.test(pasta)) { console.error('Só pastas dentro de .dados-teste/ (banco de teste).'); process.exit(2); }
const USUARIO = process.argv[3] || '00000000-0000-4000-8000-000000000001';
const db = await abrirBancoTeste({ pasta });
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
const dems = [...await c('listar_demandas', { p_arquivadas: false }), ...await c('listar_demandas', { p_arquivadas: true })];
console.log(JSON.stringify(calcularMetricas(dems, await c('listar_transicoes_demanda', {}), hojeISO()), null, 2));
await db.close();
