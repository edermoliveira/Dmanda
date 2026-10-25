import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { modoTeste } from '@/lib/supabase/config';
import { BotaoGoogle } from './BotaoGoogle';

// Os avisos dependem do endereço (searchParams): só essa parte é dinâmica, o resto da página sai pronto.
async function Aviso({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (modoTeste()) redirect('/');
  const p = await searchParams;
  const aviso = p.expirou ? 'Por segurança, o login vale por 6 horas sem uso. Entre de novo.' : p.negado ? 'Esta conta Google não tem acesso ao Dmanda.' : p.erro ? 'Não foi possível entrar. Tente de novo.' : '';
  return aviso ? <p className="login-aviso" role="alert">{aviso}</p> : null;
}

export default function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <main className="login" data-tema-login>
      <div className="login-caixa">
        <h1>Dmanda</h1>
        <p>Demandas do Secretário de Administração. Acesso restrito.</p>
        <Suspense fallback={null}><Aviso searchParams={searchParams} /></Suspense>
        <BotaoGoogle />
      </div>
    </main>
  );
}
