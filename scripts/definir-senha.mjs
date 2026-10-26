// Define (ou redefine) a senha do usuário único do Dmanda pelo mecanismo oficial do Supabase Auth (API de administração, updateUserById).
// É também o procedimento de recuperação de acesso: quem tem a chave de serviço (painel do Supabase) e o .env.local consegue definir uma senha nova
// sem depender de e-mail nem do Google. Não cria usuário, não troca e-mail, não apaga nada: só muda a senha do usuário que já existe.
//
// A senha NUNCA vai para argumento de comando, variável de ambiente, arquivo, log nem Git:
//   - no terminal ela é digitada duas vezes com a tela oculta;
//   - sem terminal (stdin canalizado, usado só em testes) a primeira linha é a senha.
// Uso:  node --env-file=.env.local scripts/definir-senha.mjs
// Lê do ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e DMANDA_EMAIL_AUTORIZADO. Só mostra "preenchida" ou "VAZIA", nunca os valores.
import { createClient } from '@supabase/supabase-js';
import readline from 'node:readline';

const MINIMO = 12;
const faltam = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DMANDA_EMAIL_AUTORIZADO'].filter((n) => !process.env[n]);
if (faltam.length) {
  console.error('Faltam variáveis no ambiente (use: node --env-file=.env.local scripts/definir-senha.mjs): ' + faltam.join(', '));
  process.exit(2);
}

/** Lê uma linha escondendo o que é digitado (terminal) ou a primeira linha do stdin (canalizado). */
function lerSenha(pergunta) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin });
      rl.once('line', (l) => { resolve(l); rl.close(); });
      rl.once('close', () => resolve(''));
      return;
    }
    process.stdout.write(pergunta);
    let valor = '';
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    const fim = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', tecla); process.stdout.write('\n'); };
    const tecla = (c) => {
      for (const ch of c) {
        if (ch === '\r' || ch === '\n') { fim(); return resolve(valor); }
        if (ch === '\u0003') { fim(); return reject(new Error('Cancelado.')); }
        if (ch === '\u007f' || ch === '\b') valor = valor.slice(0, -1); else if (ch >= ' ') valor += ch;
      }
    };
    process.stdin.on('data', tecla);
  });
}

try {
  const senha = await lerSenha('Nova senha (mínimo ' + MINIMO + ' caracteres, não aparece na tela): ');
  if (process.stdin.isTTY) {
    const confere = await lerSenha('Repita a senha: ');
    if (confere !== senha) { console.error('As duas senhas não são iguais. Nada foi alterado.'); process.exit(1); }
  }
  if (senha.length < MINIMO) { console.error('A senha precisa ter pelo menos ' + MINIMO + ' caracteres. Nada foi alterado.'); process.exit(1); }
  if (senha.length > 72) { console.error('A senha passa de 72 caracteres, limite do Supabase. Nada foi alterado.'); process.exit(1); }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const alvo = process.env.DMANDA_EMAIL_AUTORIZADO.trim().toLowerCase();
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) { console.error('O Supabase recusou a consulta de usuários (confira a chave de serviço): ' + (error.status ?? '') + ' ' + (error.code ?? '')); process.exit(1); }
  const achados = data.users.filter((u) => (u.email ?? '').trim().toLowerCase() === alvo);
  if (data.users.length !== 1 || achados.length !== 1) {
    console.error('Esperado exatamente 1 usuário no projeto, e ele deve ser a conta autorizada. Encontrados: ' + data.users.length + ' usuário(s), ' + achados.length + ' com o e-mail autorizado. Nada foi alterado.');
    process.exit(1);
  }
  const usuario = achados[0];
  // email_confirm garante que o login por senha não fique pendente de confirmação; o e-mail e o identificador do usuário não mudam.
  const r = await sb.auth.admin.updateUserById(usuario.id, { password: senha, email_confirm: true });
  if (r.error) { console.error('O Supabase recusou a nova senha: ' + (r.error.code ?? r.error.status ?? 'erro') + (r.error.code === 'weak_password' ? ' (senha fraca pela regra do projeto; use uma mais longa)' : '')); process.exit(1); }
  console.log('Senha definida para o usuário existente (identificador iniciado por ' + usuario.id.slice(0, 8) + '). Nada mais foi alterado.');
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Falha inesperada.');
  process.exit(1);
}
