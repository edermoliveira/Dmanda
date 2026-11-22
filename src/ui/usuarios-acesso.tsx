'use client';
// Configurações > Conta e Usuários e acesso (decisão 92). "Conta" é de todos: e-mail, alterar a própria senha e sair DESTE aparelho. "Usuários e acesso" só aparece para a administradora; o servidor e o banco
// recusam as mesmas operações de qualquer outra conta (a tela escondida não é a proteção). Os estados são os do banco: autorizado, convite pendente, ativo e revogado.
import { useCallback, useEffect, useState } from 'react';
import { useApp } from './contexto';
import { FormAlterarSenha } from './acesso';
import { sair } from '@/servidor/autenticacao';
import { convidar, listarAcessos, reenviarConvite, restabelecerAcesso, revogarAcesso, type Acesso } from '@/servidor/acessos';

const ROTULO: Record<Acesso['estado'], string> = { autorizado: 'Autorizado', convite_pendente: 'Convite pendente', ativo: 'Ativo', revogado: 'Revogado' };
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');

export function SecaoConta() {
  const { ambiente } = useApp();
  const [saindo, setSaindo] = useState(false);
  return (
    <section className="cfg-bloco painel" aria-labelledby="cfg-conta-t" data-secao="conta">
      <h2 id="cfg-conta-t" style={{ fontSize: 'calc(17px * var(--esc))', margin: '0 0 6px' }}>Conta</h2>
      <p className="data">{ambiente?.email ? `Você entrou como ${ambiente.email}.` : 'Você está em modo de teste, sem conta.'} {ambiente?.admin ? 'Esta é a conta administradora.' : ''}</p>
      {ambiente?.teste ? null : <FormAlterarSenha />}
      <div className="acoes"><button type="button" className="btn" disabled={saindo} data-sair onClick={() => { setSaindo(true); void sair(); }}>{saindo ? 'Saindo...' : 'Sair deste aparelho'}</button></div>
      <p className="data">Sair aqui não desconecta os seus outros aparelhos.</p>
    </section>
  );
}

export function SecaoUsuarios() {
  const { ambiente, avisar } = useApp();
  const [lista, setLista] = useState<Acesso[] | null>(null), [erro, setErro] = useState(''), [email, setEmail] = useState(''), [ocupado, setOcupado] = useState(false), [confirma, setConfirma] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const carregar = useCallback(async () => { setRecarga((n) => n + 1); }, []);
  const admin = ambiente?.admin;
  useEffect(() => {
    if (!admin) return;
    let vivo = true;
    void (async () => { const r = await listarAcessos(); if (!vivo) return; if (r.ok) { setLista(r.dados); setErro(''); } else setErro(r.erro); })();
    return () => { vivo = false; };
  }, [admin, recarga]);
  if (!ambiente?.admin) return null;

  const rodar = async (f: () => Promise<{ ok: true } | { ok: false; erro: string }>, ok: string) => {
    if (ocupado) return; setOcupado(true); setErro('');
    const r = await f();
    if (r.ok) avisar(ok); else { setErro(r.erro); await carregar(); }
    if (r.ok) await carregar();
    setOcupado(false);
  };
  return (
    <section className="cfg-bloco painel" aria-labelledby="cfg-usu-t" data-secao="usuarios">
      <h2 id="cfg-usu-t" style={{ fontSize: 'calc(17px * var(--esc))', margin: '0 0 6px' }}>Usuários e acesso</h2>
      <p className="data">Só e-mails autorizados aqui entram no Dmanda. A pessoa define a própria senha pelo link do convite. Revogar impede o acesso aos dados na hora e preserva o que ela registrou.</p>
      <form className="cfg-form" aria-label="Convidar" onSubmit={(e) => { e.preventDefault(); const v = email.trim(); if (!v) return; void rodar(async () => { const r = await convidar(v); if (r.ok) setEmail(''); return r; }, `Convite enviado para ${v.toLowerCase()}.`); }}>
        <div className="fld"><label htmlFor="usu-email">E-mail a autorizar</label><input id="usu-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" /></div>
        <div className="acoes"><button type="submit" className="btn pri" disabled={ocupado || !email.trim()}>{ocupado ? 'Enviando...' : 'Autorizar e enviar convite'}</button></div>
      </form>
      {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}
      {!lista ? <p className="data">Carregando...</p> : (
        <ul className="cfg-lista" aria-label="Acessos">
          {lista.map((a) => (
            <li key={a.email} data-acesso={a.email} data-estado={a.estado}>
              <span className="cfg-desc">{a.email}{a.admin ? ' (administradora)' : ''}</span>
              <span className="chip neutro cfg-tipo" data-chip-estado>{ROTULO[a.estado]}</span>
              <span className="data">{a.estado === 'ativo' && a.ultimo_acesso ? `entrou em ${quando(a.ultimo_acesso)}` : a.estado === 'convite_pendente' ? `convite em ${quando(a.convite_enviado_em)}` : a.estado === 'revogado' ? `revogado em ${quando(a.revogado_em)}` : ''}</span>
              {a.admin ? null : (
                <span className="cfg-acoes">
                  {a.estado === 'autorizado' || a.estado === 'convite_pendente' ? <button type="button" className="btn mini" disabled={ocupado} data-reenviar onClick={() => void rodar(() => reenviarConvite(a.email), `Convite reenviado para ${a.email}.`)}>Reenviar convite</button> : null}
                  {a.estado === 'revogado'
                    ? <button type="button" className="btn mini" disabled={ocupado} data-restabelecer onClick={() => void rodar(() => restabelecerAcesso(a.email), `Acesso de ${a.email} restabelecido.`)}>Restabelecer</button>
                    : confirma === a.email
                      ? (<><span className="data">Revogar o acesso de {a.email}? Ela perde o acesso na hora.</span><button type="button" className="btn mini perigo" disabled={ocupado} data-confirmar-revogar onClick={() => { setConfirma(null); void rodar(() => revogarAcesso(a.email), `Acesso de ${a.email} revogado.`); }}>Confirmar revogação</button><button type="button" className="btn mini" onClick={() => setConfirma(null)}>Cancelar</button></>)
                      : <button type="button" className="btn mini" disabled={ocupado} data-revogar onClick={() => setConfirma(a.email)}>Revogar</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
