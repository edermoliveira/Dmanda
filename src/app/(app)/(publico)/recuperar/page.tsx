import { FormRecuperar } from '@/ui/acesso';

export default function Recuperar() {
  return (
    <>
      <h1>Recuperar a senha</h1>
      <p>Informe o e-mail da sua conta. Se ele tiver acesso ao Dmanda, você recebe um link para definir uma nova senha.</p>
      <FormRecuperar />
      <div className="acesso-links"><a href="/login">Voltar para entrar</a></div>
    </>
  );
}
