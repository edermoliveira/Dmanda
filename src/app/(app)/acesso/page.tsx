import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { modoTeste } from '@/lib/supabase/config';
import { FormularioCodigo } from './FormularioCodigo';
import { PainelLogin } from './PainelLogin';

// Estado de acesso restrito (decisão 82): quem chega aqui não tem um aparelho autorizado. Não há e-mail nem senha: a autorização é um código de uso único.
// Os avisos dependem do endereço (searchParams): só essa parte é dinâmica, o resto da página sai pronto.
async function Aviso({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (modoTeste()) redirect('/');
  const p = await searchParams;
  const aviso = p.revogado ? 'Este aparelho não está mais autorizado. Peça um novo código para abrir o Dmanda de novo.'
    : p.saiu === 'parcial' ? 'Você saiu do Dmanda neste aparelho, mas o servidor não confirmou o encerramento da sessão. Se este aparelho não é seu, peça para revogá-lo em Configurações, em outro aparelho.'
    : p.saiu ? 'Você saiu do Dmanda e este aparelho deixou de estar autorizado. Para voltar, use um código novo.'
    : p.encerrada ? 'A sessão deste aparelho terminou. Use um código novo para abrir o Dmanda.'
    : p.negado ? 'Esta conta não tem acesso ao Dmanda.'
    : null;
  // avisos de saída e de sessão encerrada são informação (tom neutro); só recusa e saída não confirmada pelo servidor usam o vermelho, que a interface reserva ao que é crítico
  const erro = !!(p.negado || p.saiu === 'parcial');
  return aviso ? <p className={erro ? 'login-aviso' : 'login-info'} role={erro ? 'alert' : 'status'}>{aviso}</p> : null;
}

export default function Acesso({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <PainelLogin>
    <main className="login">
      <div className="login-caixa">
        <h1>Dmanda</h1>
        <p>Demandas do Secretário de Administração. Acesso restrito: este aparelho ainda não está autorizado.</p>
        <Suspense fallback={null}><Aviso searchParams={searchParams} /></Suspense>
        <FormularioCodigo />
        <p className="login-info" data-como-obter>Para receber um código: em um aparelho já autorizado, abra Configurações, Aparelhos, e toque em Autorizar outro aparelho. Sem nenhum aparelho autorizado, o titular gera o código no computador (npm run aparelhos -- convite).</p>
      </div>
    </main>
    </PainelLogin>
  );
}
