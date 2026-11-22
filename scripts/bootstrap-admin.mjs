// BOOTSTRAP PRIVADO da conta administradora (decisão 92). Roda UMA vez, no computador do Éder, com a chave de serviço do projeto, e NÃO foi executado pelo assistente (nenhuma operação no Supabase real).
// O que faz: garante que o e-mail da administradora tenha uma conta no Supabase Auth e envia o e-mail para ela DEFINIR a própria senha (nunca gera nem mostra senha):
//   - a conta já existe (o login antigo, Google): envia o e-mail de recuperação; a conta e o user_id são os mesmos, então todos os registros legados continuam ligados a ela (não se cria outra identidade);
//   - a conta não existe: envia o convite (o hook do banco só deixa criar o e-mail autorizado, e a migração já o autoriza).
// Não é um endpoint do aplicativo: ninguém além de quem tem a chave de serviço o executa, e o e-mail da administradora é fixo no banco (dmanda_privado.email_admin()), não vem de um pedido.
// Uso (PowerShell, na pasta do projeto): node --env-file=.env.local scripts/bootstrap-admin.mjs --email=<e-mail da administradora>            (ensaio: só diz o que faria)
//                                          node --env-file=.env.local scripts/bootstrap-admin.mjs --email=<e-mail da administradora> --executar
// Variáveis lidas do ambiente (o assistente nunca lê nem imprime .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DMANDA_URL_PUBLICA (endereço público do painel, para o link do e-mail).
import { createClient } from '@supabase/supabase-js';

const arg = (n) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? '';
const email = arg('email').trim().toLowerCase(), executar = process.argv.includes('--executar');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY, publica = (process.env.DMANDA_URL_PUBLICA ?? '').replace(/\/+$/, '');
const falta = [['NEXT_PUBLIC_SUPABASE_URL', url], ['SUPABASE_SERVICE_ROLE_KEY', chave], ['DMANDA_URL_PUBLICA', publica]].filter(([, v]) => !v).map(([n]) => n);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Informe --email=<e-mail da administradora>.'); process.exit(2); }
if (falta.length) { console.error('Variáveis ausentes no ambiente: ' + falta.join(', ')); process.exit(2); }
const sb = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

// confere, no banco, que este é MESMO o e-mail da administradora (a função só existe depois da migração 20261122000000)
const { data: lista, error: eLista } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
if (eLista) { console.error('Não foi possível consultar os usuários (' + (eLista.status ?? 'erro') + ').'); process.exit(1); }
const existente = lista.users.find((u) => (u.email ?? '').toLowerCase() === email);
console.log(existente ? `A conta já existe no Auth (criada em ${existente.created_at?.slice(0, 10)}). Será enviado o e-mail de recuperação para definir a senha; o identificador da conta não muda.` : 'A conta não existe no Auth. Será enviado o convite para definir a senha.');
console.log('Confira ANTES de executar: a migração 20261122000000 aplicada e este e-mail igual ao de dmanda_privado.email_admin() (select dmanda_privado.email_admin() no SQL Editor).');
if (!executar) { console.log('Ensaio: nada foi enviado. Repita com --executar.'); process.exit(0); }
if (existente) {
  const { error } = await createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } }).auth.resetPasswordForEmail(email, { redirectTo: `${publica}/auth/confirmar` });
  if (error) { console.error('O e-mail de recuperação não foi enviado (' + (error.status ?? 'erro') + '): ' + error.message); process.exit(1); }
} else {
  const { error } = await sb.auth.admin.inviteUserByEmail(email, { redirectTo: `${publica}/auth/confirmar` });
  if (error) { console.error('O convite não foi enviado (' + (error.status ?? 'erro') + '): ' + error.message); process.exit(1); }
}
console.log('Enviado. Abra o e-mail, toque no link, toque em "Continuar" e defina a senha. Depois entre normalmente.');
