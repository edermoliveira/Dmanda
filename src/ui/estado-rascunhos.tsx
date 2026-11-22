'use client';
// Estado verdadeiro dos rascunhos online (decisão 92), sempre visível enquanto houver rascunho ou alteração pendente: Salvando, Salvo online (só depois da confirmação do banco), Alterações pendentes de
// envio e Falha na sincronização (com Tentar de novo). Conflitos entre aparelhos aparecem aqui, com a escolha explícita: as duas versões ficam guardadas até a pessoa decidir.
import { useApp } from './contexto';

const TEXTO = { salvando: 'Salvando...', salvo: 'Salvo online', pendente: 'Alterações pendentes de envio', falha: 'Falha na sincronização' } as const;

export function EstadoRascunhos() {
  const { estadoRascunhos, pendentesRascunhos, conflitosRascunhos, tentarRascunhosDeNovo, resolverRascunho } = useApp();
  if (estadoRascunhos === 'nenhum' && !conflitosRascunhos.length) return null;
  const estado = estadoRascunhos === 'nenhum' ? 'pendente' : estadoRascunhos;
  return (
    <div className="estado-rascunhos" role="status" aria-live="polite" data-estado-rascunhos={estado}>
      <span className="data" data-texto-estado>{TEXTO[estado]}{pendentesRascunhos && estado !== 'salvando' && estado !== 'salvo' ? ` (${pendentesRascunhos})` : ''}</span>
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
