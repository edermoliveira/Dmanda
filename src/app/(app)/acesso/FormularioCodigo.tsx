'use client';
import { useState, type FormEvent } from 'react';
import { autorizarComCodigo } from '@/servidor/aparelhos';
import { codigoValido, normalizarCodigo } from '@/lib/aparelho';

// Autorização inicial do aparelho: o código de uso único (8 letras e números, 10 minutos) gerado pelo titular. Nada de e-mail nem senha. O código nunca é guardado nem registrado;
// só a resposta do servidor decide. Depois de autorizado, a navegação completa reinicia o painel já com a sessão.
export function FormularioCodigo() {
  const [erro, setErro] = useState('');
  const [pendente, setPendente] = useState(false);

  const enviar = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const campo = ev.currentTarget.querySelector<HTMLInputElement>('#acesso-codigo');
    const codigo = normalizarCodigo(campo?.value ?? '');
    if (!codigoValido(codigo)) { setErro('Confira o código: são 8 letras e números.'); return; }
    setPendente(true); setErro('');
    try {
      const r = await autorizarComCodigo(codigo);
      if (!r.ok) { setErro(r.erro); setPendente(false); if (campo) campo.select(); return; }
    } catch {
      setErro('Não foi possível autorizar este aparelho agora. Tente de novo em instantes.'); setPendente(false); return;
    }
    window.location.replace('/');
  };

  return (
    <form className="login-form" onSubmit={(e) => void enviar(e)}>
      <div className="fld"><label htmlFor="acesso-codigo">Código de autorização</label>
        <input id="acesso-codigo" name="codigo" inputMode="text" autoComplete="one-time-code" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={12} placeholder="ABCD-2345" required />
      </div>
      {erro ? <p className="login-aviso" role="alert">{erro}</p> : null}
      <button className="btn pri" type="submit" disabled={pendente}>{pendente ? 'Autorizando...' : 'Autorizar este aparelho'}</button>
    </form>
  );
}
