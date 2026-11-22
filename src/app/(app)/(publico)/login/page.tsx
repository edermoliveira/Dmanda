import { FormEntrar } from '@/ui/acesso';
import { destinoSeguro } from '@/servidor/autenticacao';

const AVISOS: Record<string, string> = { sessao: 'Sua sessão terminou. Entre de novo: o que você digitou continua guardado neste aparelho.', link: 'Este link expirou ou já foi usado. Peça um novo na tela de recuperação.', saiu: 'Você saiu deste aparelho.' };

export default async function Login({ searchParams }: { searchParams: Promise<{ proximo?: string; motivo?: string }> }) {
  const { proximo, motivo } = await searchParams;
  return (
    <>
      <h1>Dmanda</h1>
      <p>Entre com o seu e-mail e a sua senha.</p>
      <FormEntrar proximo={await destinoSeguro(proximo)} aviso={motivo ? AVISOS[motivo] : undefined} />
      <div className="acesso-links"><a href="/recuperar">Esqueci a senha</a></div>
    </>
  );
}
