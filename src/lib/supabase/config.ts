// Variáveis públicas do Supabase. A chave aqui é a pública (publishable/anon): ela só vale com a RLS e o login.
// Nunca coloque a chave de serviço (service_role) em variável NEXT_PUBLIC.
export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return null;
  return { url, chave };
}

/** Variáveis que só existem numa implantação na nuvem (Vercel e as funções AWS Lambda em que ela roda). As da Vercel dependem da opção "System Environment Variables" do projeto,
 *  então as da Lambda entram também: basta UMA delas definida para a medição local ser recusada. */
const SINAIS_DE_NUVEM = ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL_URL', 'VERCEL_REGION', 'VERCEL_DEPLOYMENT_ID', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_EXECUTION_ENV', 'LAMBDA_TASK_ROOT'];
// fs pelo process, para este arquivo (também importado pelo código do navegador) não puxar módulo de servidor para o pacote
const existeNoDisco = (caminho: string) => { try { return process.getBuiltinModule('node:fs').existsSync(caminho); } catch { return false; } };

/** Medição do build de produção NESTE computador. Só vale com as TRÊS condições juntas: DMANDA_MEDICAO_LOCAL=sim; nenhum sinal de nuvem nas variáveis;
 *  e a pasta .dados-teste existindo na pasta de trabalho (ela é ignorada pelo Git e nunca vai numa implantação). */
export function medicaoLocalPermitida(env: Record<string, string | undefined> = process.env, existe: (caminho: string) => boolean = existeNoDisco): boolean {
  return env.DMANDA_MEDICAO_LOCAL === 'sim' && !SINAIS_DE_NUVEM.some((k) => !!env[k]) && existe('.dados-teste');
}

/** Modo de teste: banco local descartável, só em desenvolvimento. Em produção a variável é recusada, com uma única exceção: a medição local (medicaoLocalPermitida). */
export function modoTeste(env: Record<string, string | undefined> = process.env, existe: (caminho: string) => boolean = existeNoDisco): boolean {
  if (env.DMANDA_BANCO !== 'teste') return false;
  if (env.NODE_ENV === 'production' && !medicaoLocalPermitida(env, existe)) throw new Error('DMANDA_BANCO=teste não é permitido em produção.');
  return true;
}

/** Cookies da sessão do Supabase: "secure" só sobre HTTPS (o padrão do SDK não marca). Os demais atributos continuam os do SDK. */
export const opcoesCookiesSessao = (https: boolean) => ({ secure: https });
