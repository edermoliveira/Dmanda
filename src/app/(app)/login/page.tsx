import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { googleLigado } from '@/lib/login';
import { modoTeste } from '@/lib/supabase/config';
import { modoDemo } from '@/lib/demo';
import { BotaoGoogle } from './BotaoGoogle';
import { FormularioSenha } from './FormularioSenha';
import { PainelLogin } from './PainelLogin';

// Os avisos dependem do endereço (searchParams): só essa parte é dinâmica, o resto da página sai pronto.
async function Aviso({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (modoTeste() || modoDemo()) redirect('/');
  const p = await searchParams;
  const aviso = p.saiu === 'parcial' ? 'Você saiu do Dmanda neste navegador, mas o servidor não confirmou o encerramento da sessão. Se este computador não é seu, entre e saia de novo.' : p.saiu ? 'Você saiu do Dmanda neste navegador.' : p.encerrada || p.expirou ? 'Sua sessão foi encerrada ou deixou de ser válida (por exemplo, depois de sair em outro aparelho). Entre de novo.' : p.negado ? 'Esta conta não tem acesso ao Dmanda.' : p.erro ? 'Não foi possível entrar. Tente de novo.' : '';
  // avisos de saída e de sessão encerrada são informação (tom neutro); só recusa, falha e saída não confirmada pelo servidor usam o vermelho, que a interface reserva ao que é crítico
  const erro = !!(p.negado || p.erro || p.saiu === 'parcial');
  return aviso ? <p className={erro ? 'login-aviso' : 'login-info'} role={erro ? 'alert' : 'status'}>{aviso}</p> : null;
}

// O botão do Google só aparece com DMANDA_LOGIN_GOOGLE=sim (ver src/lib/login.ts). A variável é lida na montagem da página: vale no próximo build ou publicação.

export default function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <PainelLogin>
    <main className="login">
      <div className="login-caixa">
        <h1>Dmanda</h1>
        <p>Demandas do Secretário de Administração. Acesso restrito.</p>
        <Suspense fallback={null}><Aviso searchParams={searchParams} /></Suspense>
        <FormularioSenha />
        {googleLigado(process.env.DMANDA_LOGIN_GOOGLE) ?<><p className="login-ou">ou</p><BotaoGoogle /></> : null}
      </div>
    </main>
    </PainelLogin>
  );
}
