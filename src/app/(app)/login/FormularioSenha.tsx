'use client';
import { useState, type FormEvent } from 'react';
import { criarClienteNavegador } from '@/lib/supabase/navegador';
import { concluirEntrada } from '@/servidor/entrar';

// Entrada por e-mail e senha. A senha vai direto ao Supabase Auth (o limite de tentativas conta por quem tenta) e nunca é guardada nem registrada: só o
// e-mail fica na tela se a entrada falhar. Depois do Auth, uma ação do servidor confere a conta autorizada e grava o carimbo de último uso.
const MSG_CREDENCIAIS = 'E-mail ou senha incorretos.';
const MSG_GENERICA = 'Não foi possível entrar agora. Tente de novo em instantes.';

function mensagemDoErro(e: { code?: string; status?: number } | null): string {
  if (e?.code === 'over_request_rate_limit' || e?.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (e?.code === 'email_provider_disabled') return 'A entrada por e-mail e senha está desligada no Supabase. Veja supabase/LEIA-ME.md.';
  if (e?.code === 'invalid_credentials' || e?.status === 400) return MSG_CREDENCIAIS;
  return MSG_GENERICA;
}

export function FormularioSenha() {
  const [erro, setErro] = useState('');
  const [pendente, setPendente] = useState(false);

  const enviar = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const dados = new FormData(form);
    const email = String(dados.get('email') ?? '').trim();
    const senha = String(dados.get('senha') ?? '');
    const falhar = (msg: string) => { setErro(msg); setPendente(false); const campo = form.querySelector<HTMLInputElement>('#login-senha'); if (campo) campo.value = ''; };
    if (!email || !senha) { setErro('Informe o e-mail e a senha.'); return; }
    setPendente(true); setErro('');
    let autenticou = false;
    try {
      const { data, error } = await criarClienteNavegador().auth.signInWithPassword({ email, password: senha });
      if (error || !data.user) { falhar(mensagemDoErro(error)); return; }
      autenticou = true;
      const r = await concluirEntrada();
      if (!r.ok) { falhar(r.erro); return; }
    } catch {
      // Se o Auth aceitou e só o passo final falhou (por exemplo, esta tela de login ficou aberta enquanto outra aba já entrou, e o servidor redirecionou a ação),
      // vai ao painel: a porta de entrada decide. Sem sessão válida ela devolve ao login; antes da senha aceita, é só falha de conexão.
      if (!autenticou) { falhar(MSG_GENERICA); return; }
    }
    // navegação completa: o proxy e a casca do painel começam do zero, já com a sessão
    window.location.replace('/');
  };

  return (
    <form className="login-form" onSubmit={(e) => void enviar(e)}>
      <div className="fld"><label htmlFor="login-email">E-mail</label><input id="login-email" name="email" type="email" inputMode="email" autoComplete="username" required maxLength={254} autoCapitalize="none" spellCheck={false} /></div>
      <div className="fld"><label htmlFor="login-senha">Senha</label><input id="login-senha" name="senha" type="password" autoComplete="current-password" required maxLength={200} /></div>
      {erro ? <p className="login-aviso" role="alert">{erro}</p> : null}
      <button className="btn pri" type="submit" disabled={pendente}>{pendente ? 'Entrando...' : 'Entrar'}</button>
    </form>
  );
}
