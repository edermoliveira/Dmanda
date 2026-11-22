import { Suspense } from 'react';
import { connection } from 'next/server';
import { FormDefinirSenha } from '@/ui/acesso';
import { lerEtapa } from '@/servidor/etapa-senha';

// O formulário só aparece com a etapa emitida pelo servidor depois de um link de convite ou de recuperação válido (a ação confere de novo usuário, sessão e uso único).
async function Conteudo() {
  await connection();   // a validade da etapa depende do relógio: só na requisição, nunca na pré-geração
  const etapa = await lerEtapa();
  if (!etapa) {
    return (<><h1>Definir a senha</h1><p>Para definir a senha, use o link do convite ou o de recuperação (Esqueci a senha). O link vale por pouco tempo e uma vez só.</p><div className="acesso-links"><a href="/recuperar">Pedir um link</a><a href="/login">Entrar</a></div></>);
  }
  return (
    <>
      <h1>{etapa.f === 'invite' ? 'Defina a sua senha' : 'Defina uma nova senha'}</h1>
      <p>Escolha uma senha só sua. Ela não é mostrada nem guardada em nenhum lugar do Dmanda.</p>
      <FormDefinirSenha />
    </>
  );
}

export default function DefinirSenha() {
  return <Suspense fallback={<p>Carregando...</p>}><Conteudo /></Suspense>;
}
