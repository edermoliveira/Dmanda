'use client';
// Peças comuns do humor: o emoji de cada nível (os do usuário, em public/emojis, em PNG), a escala de cinco níveis e o formulário que grava o humor sozinho.
// Usadas no balão, no Início, no Perfil e na janela "Completar os últimos dias". O valor nunca passa por busca, IA, telemetria nem log.
import { useRef, useState } from 'react';
import { useApp } from './contexto';
import { NIVEIS, ROTULO_HUMOR, type Nivel, type RegistroDia } from '@/lib/registros';

/** O emoji do nível. Se o arquivo faltar, a imagem quebrada aparece (de propósito: sem ícone de reserva, para o erro não passar despercebido). */
export function EmojiNivel({ nivel, alt = '', className = 'emo-img' }: { nivel: Nivel; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- ilustrações do usuário usadas como estão
  return <img className={className} src={`/emojis/humor-${nivel}.png`} alt={alt} width={28} height={28} decoding="async" loading="lazy" draggable={false} />;
}

/** Cinco botões, um por nível, com o nome por extenso (leitura de tela e dica). Escolher não grava nada: quem usa decide quando gravar. */
export function EscalaCinco({ valor, aoEscolher, rotulo, mini = false, desativada = false }: { valor: Nivel | null; aoEscolher: (n: Nivel) => void; rotulo: string; mini?: boolean; desativada?: boolean }) {
  return (
    <div className={`emos${mini ? ' mini' : ''}`} role="group" aria-label={rotulo} data-escala="humor">
      {NIVEIS.map((n) => (
        <button key={n} type="button" className="emo" aria-pressed={valor === n} aria-label={ROTULO_HUMOR[n]} title={ROTULO_HUMOR[n]} data-nivel={n} disabled={desativada} onClick={() => aoEscolher(n)}>
          <EmojiNivel nivel={n} />
        </button>
      ))}
    </div>
  );
}

/**
 * Humor de um dia, gravado sozinho. Se a gravação falhar, a escolha continua na tela e a mensagem diz o que aconteceu; o botão trava durante a gravação
 * (clique repetido não grava duas vezes, e o banco guarda uma só linha por dia).
 * `automatico`: grava assim que o nível é escolhido (o balão); sem ele, grava no botão.
 */
export function FormularioRegistro({ dia, inicial, aoGravar, automatico = false, mini = false, rotuloBotao, idBase }: { dia: string; inicial: RegistroDia | null; aoGravar?: () => void; automatico?: boolean; mini?: boolean; rotuloBotao?: string; idBase: string }) {
  const { registrarDias } = useApp();
  const [humor, setHumor] = useState<Nivel | null>(inicial?.humor ?? null);
  const [estado, setEstado] = useState<'parado' | 'gravando' | 'gravado'>('parado');
  const [erro, setErro] = useState('');
  const trava = useRef(false);

  const gravar = async (h: Nivel | null) => {
    if (trava.current || h === null) return;
    trava.current = true; setEstado('gravando'); setErro('');
    const r = await registrarDias([{ dia, humor: h }]);
    trava.current = false;
    if (r.ok) { setEstado('gravado'); aoGravar?.(); } else { setEstado('parado'); setErro(r.erro); }   // a escolha fica como está
  };
  const mudar = (n: Nivel) => {
    if (estado === 'gravando') return;
    setHumor(n); setEstado('parado'); setErro('');
    if (automatico) void gravar(n);
  };
  const mudou = !inicial || inicial.humor !== humor;
  return (
    <div className="reg-form" data-estado={estado}>
      <div className="reg-l"><span id={`${idBase}-h`}>Humor</span><EscalaCinco valor={humor} aoEscolher={mudar} rotulo="Humor" mini={mini} desativada={estado === 'gravando'} /></div>
      {erro ? <p className="reg-erro" role="alert">{erro} Sua escolha continua aqui.</p> : <p className="data reg-dica" role="status">{estado === 'gravando' ? 'Gravando...' : estado === 'gravado' ? 'Registrado.' : humor === null ? 'Escolha o humor.' : ''}</p>}
      {automatico && erro ? <button type="button" className="btn mini" onClick={() => void gravar(humor)}>Tentar de novo</button> : null}
      {!automatico ? (
        <div className="acoes"><button type="button" className="btn mini pri" disabled={estado === 'gravando' || humor === null || !mudou} onClick={() => void gravar(humor)}>{estado === 'gravando' ? 'Gravando...' : rotuloBotao ?? 'Registrar'}</button></div>
      ) : null}
    </div>
  );
}
