'use client';
// Peças comuns de humor e energia: o emoji de cada nível (os do usuário, em public/emojis: humor em PNG, energia em SVG colorido, sem recolorir), a escala de cinco níveis e o
// formulário que grava os dois juntos. Usadas no balão, no Início, no Perfil e na janela "Completar os últimos dias". Os valores nunca passam por busca, IA, telemetria nem log.
import { useRef, useState } from 'react';
import { useApp } from './contexto';
import { NIVEIS, ROTULO_ENERGIA, ROTULO_HUMOR, type Nivel, type RegistroDia } from '@/lib/registros';

export type TipoEscala = 'humor' | 'energia';
export const ROTULOS: Record<TipoEscala, Record<Nivel, string>> = { humor: ROTULO_HUMOR, energia: ROTULO_ENERGIA };

/** O emoji do nível. Se o arquivo faltar, a imagem quebrada aparece (de propósito: sem ícone de reserva, para o erro não passar despercebido). */
export function EmojiNivel({ tipo, nivel, alt = '', className = 'emo-img' }: { tipo: TipoEscala; nivel: Nivel; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- ilustrações do usuário usadas como estão (o SVG da energia tem as cores originais)
  return <img className={className} src={`/emojis/${tipo}-${nivel}.${tipo === 'energia' ? 'svg' : 'png'}`} alt={alt} width={28} height={28} decoding="async" loading="lazy" draggable={false} />;
}

/** Cinco botões, um por nível, com o nome por extenso (leitura de tela e dica). Escolher não grava nada: quem usa decide quando gravar. */
export function EscalaCinco({ tipo, valor, aoEscolher, rotulo, mini = false, desativada = false }: { tipo: TipoEscala; valor: Nivel | null; aoEscolher: (n: Nivel) => void; rotulo: string; mini?: boolean; desativada?: boolean }) {
  return (
    <div className={`emos${mini ? ' mini' : ''}`} role="group" aria-label={rotulo} data-escala={tipo}>
      {NIVEIS.map((n) => (
        <button key={n} type="button" className={`emo${tipo === 'energia' ? ' en' : ''}`} aria-pressed={valor === n} aria-label={ROTULOS[tipo][n]} title={ROTULOS[tipo][n]} data-nivel={n} disabled={desativada} onClick={() => aoEscolher(n)}>
          <EmojiNivel tipo={tipo} nivel={n} />
        </button>
      ))}
    </div>
  );
}

const falta = (h: Nivel | null, e: Nivel | null) => (h === null && e === null ? 'Escolha o humor e a energia.' : h === null ? 'Falta escolher o humor.' : e === null ? 'Falta escolher a energia.' : '');

/**
 * Humor e energia de um dia, gravados juntos. Sem aparelho para decidir por você: só grava quando os dois estão escolhidos. Se a gravação falhar, a escolha continua na tela
 * e a mensagem diz o que aconteceu; o botão trava durante a gravação (clique repetido não grava duas vezes, e o banco guarda uma só linha por dia).
 * `automatico`: grava assim que o segundo nível é escolhido (o balão); sem ele, grava no botão.
 */
export function FormularioRegistro({ dia, inicial, aoGravar, automatico = false, mini = false, rotuloBotao, idBase }: { dia: string; inicial: RegistroDia | null; aoGravar?: () => void; automatico?: boolean; mini?: boolean; rotuloBotao?: string; idBase: string }) {
  const { registrarDias } = useApp();
  const [humor, setHumor] = useState<Nivel | null>(inicial?.humor ?? null);
  const [energia, setEnergia] = useState<Nivel | null>(inicial?.energia ?? null);
  const [estado, setEstado] = useState<'parado' | 'gravando' | 'gravado'>('parado');
  const [erro, setErro] = useState('');
  const trava = useRef(false);

  const gravar = async (h: Nivel | null, e: Nivel | null) => {
    if (trava.current || h === null || e === null) return;
    trava.current = true; setEstado('gravando'); setErro('');
    const r = await registrarDias([{ dia, humor: h, energia: e }]);
    trava.current = false;
    if (r.ok) { setEstado('gravado'); aoGravar?.(); } else { setEstado('parado'); setErro(r.erro); }   // a escolha fica como está
  };
  const mudar = (qual: TipoEscala, n: Nivel) => {
    if (estado === 'gravando') return;
    const h = qual === 'humor' ? n : humor, e = qual === 'energia' ? n : energia;
    if (qual === 'humor') setHumor(n); else setEnergia(n);
    setEstado('parado'); setErro('');
    if (automatico) void gravar(h, e);
  };
  const pendente = falta(humor, energia);
  const mudou = !inicial || inicial.humor !== humor || inicial.energia !== energia;
  return (
    <div className="reg-form" data-estado={estado}>
      <div className="reg-l"><span id={`${idBase}-h`}>Humor</span><EscalaCinco tipo="humor" valor={humor} aoEscolher={(n) => mudar('humor', n)} rotulo="Humor" mini={mini} desativada={estado === 'gravando'} /></div>
      <div className="reg-l"><span id={`${idBase}-e`}>Energia</span><EscalaCinco tipo="energia" valor={energia} aoEscolher={(n) => mudar('energia', n)} rotulo="Energia" mini={mini} desativada={estado === 'gravando'} /></div>
      {erro ? <p className="reg-erro" role="alert">{erro} Sua escolha continua aqui.</p> : <p className="data reg-dica" role="status">{estado === 'gravando' ? 'Gravando...' : estado === 'gravado' ? 'Registrado.' : pendente}</p>}
      {automatico && erro ? <button type="button" className="btn mini" onClick={() => void gravar(humor, energia)}>Tentar de novo</button> : null}
      {!automatico ? (
        <div className="acoes"><button type="button" className="btn mini pri" disabled={estado === 'gravando' || humor === null || energia === null || !mudou} onClick={() => void gravar(humor, energia)}>{estado === 'gravando' ? 'Gravando...' : rotuloBotao ?? 'Registrar'}</button></div>
      ) : null}
    </div>
  );
}
