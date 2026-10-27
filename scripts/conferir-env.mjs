// Confere o .env.local SEM mostrar nenhum valor: só "ok", "VAZIA" ou "ATENÇÃO" com o motivo. Também confere, pela rede, o que o painel do Supabase tem configurado
// (provedores, cadastro público, confirmação de e-mail) e quantos usuários existem. Não altera nada, no arquivo nem no Supabase.
// Uso:  npm run conferir:env            (arquivo .env.local)
//       node scripts/conferir-env.mjs [arquivo] [--sem-rede]
import fs from 'node:fs';

const REF = 'gmxoosvgfcydccyeudej'; // projeto Dmanda (único autorizado; o identificador do projeto não é segredo)
const args = process.argv.slice(2);
const semRede = args.includes('--sem-rede');
const arquivo = args.find((a) => !a.startsWith('--')) ?? '.env.local';
if (!fs.existsSync(arquivo)) { console.error(`${arquivo} não existe. Copie .env.example para .env.local e preencha (ver supabase/LEIA-ME.md).`); process.exit(2); }
process.loadEnvFile(arquivo);

const v = (n) => (process.env[n] ?? '').trim();
let problemas = 0;
let bloqueios = 0; // problemas que impedem a leitura do Supabase (DMANDA_LOGIN_GOOGLE é só aviso: o botão do Google fica oculto por padrão e só aparece com "sim")
const linha = (nome, estado, nota = '') => { console.log(nome.padEnd(40) + estado.padEnd(10) + nota); if (estado !== 'ok') { problemas++; if (nome !== 'DMANDA_LOGIN_GOOGLE') bloqueios++; } };
const checar = (nome, obrigatoria, regras) => {
  if (!v(nome)) return obrigatoria ? linha(nome, 'VAZIA') : console.log(nome.padEnd(40) + 'vazia'.padEnd(10) + '(opcional)');
  const falha = regras.map((r) => r()).find(Boolean);
  if (falha) linha(nome, 'ATENÇÃO', falha); else linha(nome, 'ok');
};
const papel = (jwt) => { try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role; } catch { return ''; } };

console.log(`Conferindo ${arquivo} (valores nunca são mostrados)\n`);
checar('NEXT_PUBLIC_SUPABASE_URL', true, [() => (new RegExp(`^https://${REF}\\.supabase\\.co/?$`).test(v('NEXT_PUBLIC_SUPABASE_URL')) ? '' : `não é o endereço do projeto Dmanda (${REF}.supabase.co)`)]);
checar('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', true, [
  () => (v('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY').startsWith('sb_secret_') || papel(v('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) === 'service_role' ? 'É A CHAVE SECRETA no campo da chave pública (vazaria para o navegador)' : ''),
  () => (/^sb_publishable_/.test(v('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) || papel(v('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) === 'anon' ? '' : 'não parece uma chave pública (esperado começar com sb_publishable_)'),
]);
checar('DMANDA_EMAIL_AUTORIZADO', true, [() => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('DMANDA_EMAIL_AUTORIZADO')) ? '' : 'não parece um e-mail')]);
checar('DMANDA_LOGIN_GOOGLE', false, [() => (v('DMANDA_LOGIN_GOOGLE').toLowerCase() === 'sim' ? 'o botão do Google aparece: só faz sentido com o provedor Google ligado no painel (padrão: vazio, botão oculto)' : '')]);
checar('SUPABASE_SERVICE_ROLE_KEY', true, [
  () => (/^sb_publishable_/.test(v('SUPABASE_SERVICE_ROLE_KEY')) || papel(v('SUPABASE_SERVICE_ROLE_KEY')) === 'anon' ? 'é a chave PÚBLICA no campo da chave secreta' : ''),
  () => (/^sb_secret_/.test(v('SUPABASE_SERVICE_ROLE_KEY')) || papel(v('SUPABASE_SERVICE_ROLE_KEY')) === 'service_role' ? '' : 'não parece uma chave secreta (esperado começar com sb_secret_)'),
]);
checar('CRON_SECRET', true, [() => (v('CRON_SECRET').length >= 16 ? '' : 'precisa ter 16 caracteres ou mais')]);
checar('DMANDA_BANCO', false, [() => (v('DMANDA_BANCO') ? 'deve ficar vazia aqui ("teste" é só para npm run dev:teste e desliga o Supabase real)' : '')]);

if (!semRede && bloqueios === 0) {
  console.log('\nO que o Supabase respondeu (só leitura):');
  const base = v('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  try {
    const s = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: v('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') } });
    if (!s.ok) console.log(`  configurações públicas do Auth: recusadas (HTTP ${s.status}); confira a chave pública`);
    else {
      const c = await s.json();
      const liga = (b) => (b ? 'LIGADO' : 'desligado');
      console.log(`  provedor Email: ${liga(c.external?.email)} | Google: ${liga(c.external?.google)} | outros ligados: ${Object.entries(c.external ?? {}).filter(([k, x]) => x && !['email', 'google'].includes(k)).map(([k]) => k).join(', ') || 'nenhum'}`);
      console.log(`  cadastro público: ${c.disable_signup ? 'desligado (correto)' : 'LIGADO (deveria estar desligado)'} | confirmação de e-mail automática: ${c.mailer_autoconfirm ? 'SIM (deveria exigir confirmação)' : 'não (exige confirmar, correto)'}`);
    }
  } catch (e) { console.log(`  sem resposta do Auth (${e instanceof Error ? e.message : 'erro de rede'})`); }
  try {
    const r = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=50`, { headers: { apikey: v('SUPABASE_SERVICE_ROLE_KEY'), authorization: `Bearer ${v('SUPABASE_SERVICE_ROLE_KEY')}` } });
    if (!r.ok) console.log(`  usuários: a chave secreta foi recusada (HTTP ${r.status})`);
    else {
      const { users = [] } = await r.json();
      const alvo = v('DMANDA_EMAIL_AUTORIZADO').toLowerCase();
      const meus = users.filter((u) => (u.email ?? '').toLowerCase() === alvo);
      console.log(`  usuários no projeto: ${users.length}; com o e-mail autorizado: ${meus.length}`);
      for (const u of meus) {
        console.log(`  usuário autorizado: id iniciado por ${u.id.slice(0, 8)} | provedores: ${(u.identities ?? []).map((i) => i.provider).join(', ') || '?'} | app_metadata.provider: ${u.app_metadata?.provider ?? '?'} | e-mail confirmado: ${u.email_confirmed_at ? 'sim' : 'NÃO'} | app_metadata.providers: ${(u.app_metadata?.providers ?? []).join(', ') || '?'}`);
      }
    }
  } catch (e) { console.log(`  usuários: sem resposta (${e instanceof Error ? e.message : 'erro de rede'})`); }
}
console.log(problemas ? `\n${problemas} ponto(s) a corrigir no ${arquivo}.` : '\nTudo preenchido no formato esperado.');
process.exit(problemas ? 1 : 0);
