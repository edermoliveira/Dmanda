import { Suspense } from 'react';
import { ConfirmarLink } from '@/ui/acesso';

// searchParams é dado de requisição (Cache Components): fica atrás de <Suspense>.
async function Conteudo({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: tokenHash, type } = await searchParams;
  if (!tokenHash || (type !== 'invite' && type !== 'recovery')) {
    return (<><h1>Link inválido</h1><p>Este link não é válido. Peça um novo.</p><div className="acesso-links"><a href="/recuperar">Pedir novo link</a></div></>);
  }
  return (
    <>
      <h1>{type === 'invite' ? 'Convite para o Dmanda' : 'Nova senha'}</h1>
      <p>{type === 'invite' ? 'Você foi convidado. Toque em continuar para definir a sua senha.' : 'Toque em continuar para definir uma nova senha.'}</p>
      <ConfirmarLink tokenHash={tokenHash} tipo={type} />
    </>
  );
}

export default function Confirmar({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  return <Suspense fallback={<p>Carregando...</p>}><Conteudo searchParams={searchParams} /></Suspense>;
}
