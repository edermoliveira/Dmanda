'use client';
// Formulários das telas de acesso (decisão 92). As senhas ficam só nos campos: nunca vão para rascunho, armazenamento do navegador, URL ou log. Cada ação do servidor devolve { erro } ou redireciona.
import { useEffect, useState, type FormEvent } from 'react';
import { entrar, pedirRecuperacao, definirSenha, alterarSenha, type RespostaForm } from '@/servidor/autenticacao';
import { confirmarLink } from '@/servidor/confirmar';

function Mensagem({ r }: { r: RespostaForm | null }) {
  if (!r) return null;
  return 'erro' in r ? <p className="acesso-erro" role="alert">{r.erro}</p> : r.aviso ? <p className="acesso-aviso" role="status">{r.aviso}</p> : null;
}
function useEnvio(f: (d: FormData) => Promise<RespostaForm | void>) {
  const [r, setR] = useState<RespostaForm | null>(null), [ocupado, setOcupado] = useState(false);
  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (ocupado) return;
    const form = e.currentTarget, dados = new FormData(form);
    setOcupado(true); setR(null);
    try { const x = await f(dados); if (x) { setR(x); if ('ok' in x) form.reset(); } }
    catch (err) { if (typeof (err as { digest?: unknown })?.digest === 'string') throw err; setR({ erro: 'Não foi possível concluir agora. Nada foi perdido: tente de novo.' }); }
    finally { setOcupado(false); }
  };
  return { r, ocupado, enviar };
}
const val = (d: FormData, k: string) => String(d.get(k) ?? '');

export function FormEntrar({ proximo, aviso }: { proximo?: string; aviso?: string }) {
  const { r, ocupado, enviar } = useEnvio((d) => entrar(val(d, 'email'), val(d, 'senha'), proximo));
  return (
    <form onSubmit={enviar} aria-label="Entrar" data-form="entrar">
      {aviso ? <p className="acesso-aviso" role="status">{aviso}</p> : null}
      <label>E-mail<input name="email" type="email" autoComplete="username" required /></label>
      <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
      <Mensagem r={r} />
      <button type="submit" disabled={ocupado}>{ocupado ? 'Entrando...' : 'Entrar'}</button>
    </form>
  );
}
export function FormRecuperar() {
  const { r, ocupado, enviar } = useEnvio((d) => pedirRecuperacao(val(d, 'email')));
  return (
    <form onSubmit={enviar} aria-label="Recuperar senha" data-form="recuperar">
      <label>E-mail<input name="email" type="email" autoComplete="username" required /></label>
      <Mensagem r={r} />
      <button type="submit" disabled={ocupado}>{ocupado ? 'Enviando...' : 'Enviar o link'}</button>
    </form>
  );
}
export function FormDefinirSenha() {
  const { r, ocupado, enviar } = useEnvio((d) => definirSenha(val(d, 'nova'), val(d, 'conf')));
  return (
    <form onSubmit={enviar} aria-label="Definir senha" data-form="definir-senha">
      <label>Nova senha (pelo menos 10 caracteres)<input name="nova" type="password" autoComplete="new-password" minLength={10} required /></label>
      <label>Repita a senha<input name="conf" type="password" autoComplete="new-password" minLength={10} required /></label>
      <Mensagem r={r} />
      <button type="submit" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Definir senha e entrar'}</button>
    </form>
  );
}
export function FormAlterarSenha() {
  const { r, ocupado, enviar } = useEnvio((d) => alterarSenha(val(d, 'atual'), val(d, 'nova'), val(d, 'conf')));
  return (
    <form onSubmit={enviar} aria-label="Alterar a própria senha" data-form="alterar-senha" className="cfg-form">
      <div className="fld"><label htmlFor="sn-atual">Senha atual</label><input id="sn-atual" name="atual" type="password" autoComplete="current-password" required /></div>
      <div className="fld"><label htmlFor="sn-nova">Nova senha <small className="data">(pelo menos 10 caracteres)</small></label><input id="sn-nova" name="nova" type="password" autoComplete="new-password" minLength={10} required /></div>
      <div className="fld"><label htmlFor="sn-conf">Repita a nova senha</label><input id="sn-conf" name="conf" type="password" autoComplete="new-password" minLength={10} required /></div>
      {r ? ('erro' in r ? <p className="data" role="alert">{r.erro}</p> : <p className="data" role="status">{r.aviso}</p>) : null}
      <button className="btn pri" type="submit" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Alterar senha'}</button>
    </form>
  );
}
/** O link do e-mail só é consumido quando a pessoa toca no botão: um leitor automático de e-mails que apenas abre o endereço não gasta o link de uso único. */
export function ConfirmarLink({ tokenHash, tipo }: { tokenHash: string; tipo: string }) {
  const { r, ocupado, enviar } = useEnvio(() => confirmarLink(tokenHash, tipo));
  return (
    <form onSubmit={enviar} aria-label="Continuar" data-form="confirmar-link">
      <Mensagem r={r} />
      <button type="submit" disabled={ocupado}>{ocupado ? 'Verificando...' : 'Continuar'}</button>
    </form>
  );
}

/** As telas de entrada e de convite apagam o lembrete do último usuário: outra conta nunca herda a fila local de pendências da anterior. */
export function EsquecerUsuario() {
  useEffect(() => { try { localStorage.removeItem('dmanda:usuario'); } catch { /* sem armazenamento */ } }, []);
  return null;
}
