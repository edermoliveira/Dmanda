// Gestão dos aparelhos autorizados pelo terminal do titular (decisão 82). É também o procedimento de RECUPERAÇÃO: quem tem a chave de serviço do Supabase (painel) e o .env.local
// consegue gerar um código de autorização sem nenhum aparelho autorizado. Só usa funções do banco liberadas ao papel de serviço; não cria usuário e não mostra chaves.
//
//   node --env-file=.env.local scripts/aparelhos.mjs convite            gera um código de uso único (10 minutos) para autorizar um aparelho na tela /acesso
//   node --env-file=.env.local scripts/aparelhos.mjs exigir sim|nao     liga ou desliga a exigência de aparelho autorizado (nao = volta ao comportamento anterior)
//   node --env-file=.env.local scripts/aparelhos.mjs revogar-todos --sim  revoga todos os aparelhos (depois, gere um convite para autorizar o primeiro de novo)
//
// Lê do ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Só informa "preenchida" ou "VAZIA", nunca os valores.
import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import { formatarCodigo, gerarCodigo } from '../src/lib/aparelho.ts';

const faltam = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((n) => !process.env[n]);
if (faltam.length) {
  console.error('Faltam variáveis no ambiente (use: node --env-file=.env.local scripts/aparelhos.mjs <comando>): ' + faltam.join(', '));
  process.exit(2);
}
const [, , comando, argumento, extra] = process.argv;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const falhar = (msg) => { console.error(msg); process.exit(1); };

if (comando === 'convite') {
  const codigo = gerarCodigo((n) => randomInt(n));
  const { data, error } = await sb.rpc('criar_convite_terminal', { p_codigo: codigo });
  if (error) falhar(`Não foi possível gerar o código: ${error.message}`);
  console.log(`\nCódigo de autorização: ${formatarCodigo(codigo)}\nVale por 10 minutos e uma só vez (até ${new Date(data.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}).\nNo aparelho, abra o Dmanda: na tela de acesso, digite o código e toque em Autorizar este aparelho.\n`);
} else if (comando === 'exigir' && (argumento === 'sim' || argumento === 'nao')) {
  const { error } = await sb.rpc('exigir_aparelhos', { p_exigir: argumento === 'sim' });
  if (error) falhar(`Não foi possível mudar a exigência: ${error.message}`);
  console.log(argumento === 'sim' ? 'Exigência LIGADA: só os aparelhos autorizados abrem o Dmanda (sessões antigas sem registro perdem o acesso).' : 'Exigência DESLIGADA: volta ao comportamento anterior (qualquer sessão da conta autorizada).');
} else if (comando === 'revogar-todos') {
  if (argumento !== '--sim' && extra !== '--sim') falhar('Isto revoga TODOS os aparelhos. Confirme com: revogar-todos --sim');
  const { data, error } = await sb.rpc('revogar_todos_aparelhos');
  if (error) falhar(`Não foi possível revogar: ${error.message}`);
  console.log(`${data} aparelho(s) revogado(s). Gere um convite para autorizar o primeiro de novo.`);
} else {
  console.error('Uso: node --env-file=.env.local scripts/aparelhos.mjs convite | exigir sim|nao | revogar-todos --sim');
  process.exit(2);
}
