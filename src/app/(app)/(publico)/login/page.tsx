import { Suspense } from 'react';
import { FormEntrar } from '@/ui/acesso';
import { destinoSeguro } from '@/servidor/autenticacao';

const AVISOS: Record<string, string> = { sessao: 'Sua sessão terminou. Entre de novo: o que você digitou continua guardado neste aparelho.', link: 'Este link expirou ou já foi usado. Peça um novo na tela de recuperação.', saiu: 'Você saiu deste aparelho.', 'sem-acesso': 'Este acesso foi revogado ou não está autorizado. Fale com a administradora.' };

// Com Cache Components, ler searchParams é dado de requisição: fica atrás de <Suspense> (o resto da tela é estático).
async function Formulario({ searchParams }: { searchParams: Promise<{ proximo?: string; motivo?: string }> }) {
  const { proximo, motivo } = await searchParams;
  return <FormEntrar proximo={await destinoSeguro(proximo)} aviso={motivo ? AVISOS[motivo] : undefined} />;
}

export default function Login({ searchParams }: { searchParams: Promise<{ proximo?: string; motivo?: string }> }) {
  return (
    <>
      <h1>Dmanda</h1>
      <p>Entre com o seu e-mail e a sua senha.</p>
      <Suspense fallback={<FormEntrar />}><Formulario searchParams={searchParams} /></Suspense>
      <div className="acesso-links"><a href="/recuperar">Esqueci a senha</a></div>
    </>
  );
}
