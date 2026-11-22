'use client';
// Estado verdadeiro dos rascunhos online (decisão 92), sempre visível enquanto houver rascunho ou alteração pendente: Salvando, Salvo online (só depois da confirmação do banco), Alterações pendentes
// neste aparelho e Erro de sincronização (com Tentar de novo). Conflitos entre aparelhos aparecem aqui, com a escolha explícita: as duas versões ficam guardadas até a pessoa decidir.
// E a tela de ACESSO REVOGADO: o painel inteiro dá lugar a ela quando o banco recusa a conta.
import { useState } from 'react';
import { useApp } from './contexto';
import { sair } from '@/servidor/autenticacao';
import type { EstadoRascunho } from '@/lib/fila-rascunhos';

const TEXTO = { salvando: 'Salvando...', salvo: 'Salvo online', pendente: 'Alterações pendentes neste aparelho', falha: 'Erro de sincronização', bloqueado: 'Envio parado' } as const;

/** O texto de UM rascunho pelo estado efetivo (as janelas usam): nunca diz "online" antes da confirmação do banco. */
export const textoRascunho = (e: EstadoRascunho | null): string =>
  e === 'salvo' ? 'rascunho salvo online' : e === 'salvando' || e === null ? 'salvando o rascunho' : e === 'pendente' ? 'alterações pendentes neste aparelho' : e === 'conflito' ? 'conflito com outro aparelho' : 'erro de sincronização do rascunho';

export function EstadoRascunhos() {
  const { estadoRascunhos, pendentesRascunhos, conflitosRascunhos, tentarRascunhosDeNovo, resolverRascunho, bloqueioRascunhos, donoRascunhos } = useApp();
  if (estadoRascunhos === 'nenhum' && !conflitosRascunhos.length) return null;
  const estado = estadoRascunhos === 'nenhum' ? 'pendente' : estadoRascunhos;
  return (
    <div className="estado-rascunhos" role="status" aria-live="polite" data-estado-rascunhos={estado}>
      <span className="data" data-texto-estado>{estado === 'bloqueado' && bloqueioRascunhos === 'outraConta' ? `Envio parado: este navegador agora está com outra conta. As alterações de ${donoRascunhos?.email ?? 'quem as digitou'} continuam guardadas e não vão em nome de outra pessoa` : conflitosRascunhos.length && estado !== 'salvando' ? 'Conflito de sincronização' : TEXTO[estado]}{pendentesRascunhos && estado !== 'salvando' && estado !== 'salvo' ? ` (${pendentesRascunhos})` : ''}</span>
      {estado === 'falha' || estado === 'pendente' ? <button type="button" className="btn mini" data-tentar-de-novo onClick={tentarRascunhosDeNovo}>Tentar de novo</button> : null}
      {conflitosRascunhos.map((c) => (
        <span key={c.chave} className="estado-rascunhos-conflito" data-conflito={c.chave}>
          <span className="data">Há outra versão deste rascunho em outro aparelho. As duas estão guardadas.</span>
          <button type="button" className="btn mini" data-resolver="meu" onClick={() => resolverRascunho(c.chave, 'meu')}>Manter a minha</button>
          <button type="button" className="btn mini" data-resolver="outro" onClick={() => resolverRascunho(c.chave, 'outro')}>Usar a do outro aparelho</button>
        </span>
      ))}
    </div>
  );
}

export function AcessoRevogado() {
  const { ambiente, pendentesRascunhos, donoRascunhos } = useApp();
  const [saindo, setSaindo] = useState(false);
  const conta = donoRascunhos?.email ?? ambiente?.email ?? 'esta conta';
  return (
    <main className="revogado" role="alertdialog" aria-modal="true" aria-labelledby="rev-t" aria-describedby="rev-d" data-acesso-revogado>
      <section className="painel revogado-cartao">
        <h1 id="rev-t">Acesso revogado</h1>
        <p id="rev-d">O acesso de {conta} ao Dmanda foi revogado pela administradora. O painel não mostra mais os dados e nenhuma operação é feita a partir deste aparelho.</p>
        {pendentesRascunhos ? (
          <p data-pendentes-revogado>{pendentesRascunhos === 1 ? 'Uma alteração ainda não enviada continua guardada' : `${pendentesRascunhos} alterações ainda não enviadas continuam guardadas`} neste navegador, identificadas como de {conta}. Elas não serão enviadas por outra conta. Se o acesso for restabelecido, elas seguem para o Dmanda quando esta conta entrar de novo.</p>
        ) : null}
        <p className="data">O que já apareceu na tela antes da revogação não tem como ser apagado daqui, e um aparelho desconectado só fica sabendo da revogação quando voltar a falar com o Dmanda.</p>
        <div className="acoes"><button type="button" className="btn pri" disabled={saindo} data-sair-revogado onClick={() => { setSaindo(true); try { localStorage.removeItem('dmanda:usuario'); } catch { /* sem armazenamento */ } void sair(); }}>{saindo ? 'Saindo...' : 'Sair deste aparelho'}</button></div>
      </section>
    </main>
  );
}
