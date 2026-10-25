'use client';
import { useState } from 'react';
import { criarClienteNavegador } from '@/lib/supabase/navegador';

export function BotaoGoogle() {
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);
  const entrar = async () => {
    setEntrando(true); setErro('');
    try {
      const { error } = await criarClienteNavegador().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } });
      if (error) throw error;
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao iniciar o login.'); setEntrando(false); }
  };
  return (<><button className="btn pri" disabled={entrando} onClick={() => void entrar()}>{entrando ? 'Abrindo o Google...' : 'Entrar com Google'}</button>{erro ? <p className="login-aviso" role="alert">{erro}</p> : null}</>);
}
