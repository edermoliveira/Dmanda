import Link from 'next/link';
import { ConfirmarLink } from '@/ui/acesso';

export default async function Confirmar({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: tokenHash, type } = await searchParams;
  if (!tokenHash || (type !== 'invite' && type !== 'recovery')) {
    return (<><h1>Link inválido</h1><p>Este link não é válido. Peça um novo.</p><div className="acesso-links"><Link href="/recuperar">Pedir novo link</Link></div></>);
  }
  return (
    <>
      <h1>{type === 'invite' ? 'Convite para o Dmanda' : 'Nova senha'}</h1>
      <p>{type === 'invite' ? 'Você foi convidado. Toque em continuar para definir a sua senha.' : 'Toque em continuar para definir uma nova senha.'}</p>
      <ConfirmarLink tokenHash={tokenHash} tipo={type} />
    </>
  );
}
