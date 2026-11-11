// Cenários fictícios do Início (decisão 63), cada um num banco de TESTE separado dentro de .dados-teste/ (ignorada pelo Git). Nunca toca o Supabase real nem .dados-teste/pg e .dados-teste/exemplos.
//   inicio-4-vagas       : as 16 demandas de exemplo; o Início preenche as quatro vagas (duas prioritárias, uma vencida, uma com espera da Prefeita)
//   inicio-3-vagas       : só três demandas abertas elegíveis; o Início mostra três vagas
//   inicio-fora-das-vagas: quatro vagas já ocupadas por comuns e pedidos da Prefeita elegíveis fora delas (aparecem acima das comuns, em linhas compactas)
// Atenção: cada cenário recria a própria pasta; pare antes qualquer servidor que esteja usando essa pasta.
// Uso: node scripts/semear-inicio.mjs [4-vagas|3-vagas|fora-das-vagas|todos]. Ver: DMANDA_PASTA_TESTE=.dados-teste/inicio-3-vagas npm run dev:exemplos
import { pathToFileURL } from 'node:url';
import { abrirBancoTeste } from '../src/servidor/banco-teste-base.mjs';
import { semearExemplos } from './semear-exemplos.mjs';

export const CENARIOS = { '4-vagas': '.dados-teste/inicio-4-vagas', '3-vagas': '.dados-teste/inicio-3-vagas', 'fora-das-vagas': '.dados-teste/inicio-fora-das-vagas' };
const USUARIO = '00000000-0000-4000-8000-000000000001';
const ABRIR = "etapa <> 'Finalizado' and arquivada_em is null";

export async function semearCenario(nome, pasta = CENARIOS[nome]) {
  if (!CENARIOS[nome]) throw new Error(`Cenário desconhecido: ${nome}`);
  await semearExemplos(pasta);   // recria só a própria pasta, sempre dentro de .dados-teste/ e nunca a pasta pg
  if (nome === '4-vagas') return pasta;
  const db = await abrirBancoTeste({ pasta });
  const id = async (assunto) => (await db.query('select id from public.demandas where assunto = $1', [assunto])).rows[0].id;
  if (nome === '3-vagas') {
    const manter = [await id('Parecer sobre o reajuste do contrato de limpeza urbana'), await id('Resposta ao Ofício do Tribunal de Contas'), await id('Ofício sobre a reforma do telhado da escola')];
    await db.query(`update public.demandas set arquivada_em = now() where ${ABRIR} and id <> all($1::uuid[])`, [manter]);
  } else {
    const comuns = [await id('Resposta ao Ofício do Tribunal de Contas'), await id('Resposta ao pedido de informação sobre horas extras'), await id('Ofício sobre a reforma do telhado da escola'), await id('Licença prêmio da servidora')];
    for (let i = 0; i < comuns.length; i++) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, comuns[i]]);
  }
  await db.close();
  return pasta;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const alvo = process.argv[2] || 'todos';
  for (const n of alvo === 'todos' ? Object.keys(CENARIOS) : [alvo]) console.log(`cenário ${n}: ${await semearCenario(n)}`);
}
