'use client';
// Baralho de cards de demanda, só para o celular (decisão 65): pilha com o card da frente e dois logo atrás.
//  - O card da frente acompanha o dedo em tempo real, com leve inclinação; ao soltar um gesto curto, volta suavemente para o lugar.
//  - Gesto confirmado (distância proporcional à largura ou gesto rápido e longo o bastante): o card sai, reaparece atrás da pilha e o próximo assume a frente.
//  - Toque numa área livre vira o card (verso existente); novo toque volta à frente. Tocar em tarefa, link ou botão faz só aquela ação. Há sempre uma ação clara para abrir a demanda.
//  - A rolagem vertical segue livre (touch-action: pan-y), o cancelamento do gesto pelo navegador devolve o card, o mouse nunca arrasta (valem os botões equivalentes) e movimento reduzido tira as animações.
// Aqui só mora a apresentação e o gesto: a ordem, as etapas e as gravações ficam com quem usa (Para hoje, Nova urgência e as listas de cards das outras páginas).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PonteiroReact, type ReactNode, type RefObject } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { CardDemanda } from './cartoes';
import { gestoValido, ordemDaPilha, ultimoParaAFrente, ativoParaOFim } from '@/lib/para-hoje';
import type { Demanda } from '@/lib/demandas';

export type Modo = 'quatro' | 'duas' | 'pilha';
/** Larguras do painel em px de layout (não de fonte): abaixo de 520 é celular (pilha), abaixo de 840 é iPad em pé (duas vagas por vez). */
const LARGURA_DUAS = 840, LARGURA_PILHA = 520;
export const modoDaLargura = (w: number): Modo => (w < LARGURA_PILHA ? 'pilha' : w < LARGURA_DUAS ? 'duas' : 'quatro');

/** O modo da apresentação, medido no próprio painel (e não na janela): o menu lateral aberto ou fechado muda a largura útil. Começa em "quatro" (igual no servidor). */
export function useModo(ref: RefObject<HTMLElement | null>): Modo {
  const [modo, setModo] = useState<Modo>('quatro');
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const medir = () => setModo(modoDaLargura(el.getBoundingClientRect().width));
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return modo;
}

const movimentoReduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Onde o toque é do próprio controle e nunca vira a virada do card. */
const INTERATIVO = 'button, a, input, textarea, select, label, summary, li, [role="link"], [role="button"], [role="menuitem"], [contenteditable], [tabindex]:not([tabindex="-1"]), .t-txt, .t-ed, .prox-t, .tarefas';
const TEMPO_SAIDA = 260;

type Lado = 'esq' | 'dir';
/**
 * Arrasto horizontal com o dedo (ou a caneta). O gesto só começa quando o movimento é claramente horizontal; a rolagem vertical continua do navegador. Um deslize curto ou cancelado volta ao lugar.
 * Depois de um arrasto o clique seguinte é engolido (não abre a demanda, não marca tarefa, não vira o card). `aoLado` devolve true quando assume a saída do card (ele então fica onde está).
 */
function useArrasto(aoLado: (lado: Lado) => boolean | void, desligado: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const est = useRef<{ x: number; y: number; id: number; fase: 'espera' | 'arrasta' | 'fora'; dx: number; amostras: { x: number; t: number }[] } | null>(null);
  const engolir = useRef(false);
  const largura = () => ref.current?.getBoundingClientRect().width ?? 300;
  const aplicar = (dx: number) => {
    const el = ref.current; if (!el) return;
    const w = largura(), prog = Math.min(1, Math.abs(dx) / Math.max(72, w * 0.22));
    el.style.setProperty('--dx', `${dx}px`); el.style.setProperty('--rot', `${Math.max(-14, Math.min(14, (dx / w) * 18)).toFixed(2)}deg`);
    el.parentElement?.parentElement?.style.setProperty('--prog', prog.toFixed(3));
    if (prog >= 1) el.dataset.lado = dx < 0 ? 'esq' : 'dir'; else delete el.dataset.lado;
  };
  const zerar = () => { const el = ref.current; if (el) { delete el.dataset.arrastando; delete el.dataset.lado; el.style.setProperty('--dx', '0px'); el.style.setProperty('--rot', '0deg'); el.parentElement?.parentElement?.style.setProperty('--prog', '0'); } };
  const final = () => { zerar(); est.current = null; };
  return {
    ref,
    props: {
      onPointerDown: (e: PonteiroReact<HTMLDivElement>) => {
        if (desligado || e.pointerType === 'mouse' || !e.isPrimary) return;
        if ((e.target as HTMLElement).closest('input:not([type="checkbox"]), textarea, select')) return; // editando o texto de uma tarefa: o dedo é do campo
        est.current = { x: e.clientX, y: e.clientY, id: e.pointerId, fase: 'espera', dx: 0, amostras: [{ x: e.clientX, t: e.timeStamp }] };
      },
      onPointerMove: (e: PonteiroReact<HTMLDivElement>) => {
        const s = est.current; if (!s || s.id !== e.pointerId || s.fase === 'fora') return;
        const dx = e.clientX - s.x, dy = e.clientY - s.y;
        if (s.fase === 'espera') {
          if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { s.fase = 'fora'; return; } // rolagem vertical: não é gesto
          if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
          s.fase = 'arrasta'; ref.current?.setPointerCapture(e.pointerId); if (ref.current) ref.current.dataset.arrastando = 'sim';
        }
        s.dx = dx; s.amostras.push({ x: e.clientX, t: e.timeStamp }); while (s.amostras.length > 2 && e.timeStamp - s.amostras[0].t > 120) s.amostras.shift();
        aplicar(dx);
      },
      onPointerUp: (e: PonteiroReact<HTMLDivElement>) => {
        const s = est.current; if (!s || s.id !== e.pointerId) return;
        const foi = s.fase === 'arrasta', dx = s.dx;
        if (foi) { engolir.current = true; setTimeout(() => { engolir.current = false; }, 350); }
        // velocidade só das últimas amostras (120 ms) e só se o dedo ainda se mexia ao soltar: parar antes de soltar zera o impulso
        const a = s.amostras.filter((m) => e.timeStamp - m.t <= 120), dt = a.length > 1 ? a[a.length - 1].t - a[0].t : 0, v = dt > 0 && e.timeStamp - a[a.length - 1].t <= 100 ? (a[a.length - 1].x - a[0].x) / dt : 0;
        const lado = foi ? gestoValido(dx, v, largura()) : null;
        if (lado && aoLado(lado)) { const el = ref.current; if (el) delete el.dataset.arrastando; est.current = null; } else final();
      },
      onPointerCancel: () => final(), // o navegador tomou o gesto (rolagem): o card volta e nada muda
      onClickCapture: (e: React.MouseEvent) => { if (engolir.current) { e.preventDefault(); e.stopPropagation(); } },
    },
  };
}

type Acao = { rotulo: string; executar: () => void; desabilitado?: boolean };
type AcaoDireita = { rotulo: string; executar: (ancora: HTMLElement | null) => void; desabilitado?: boolean; animar?: boolean; menu?: boolean; icone?: string };
type Props = {
  nome: string;
  ordem: string[];
  porId: Map<string, Demanda>;
  /** Número da vaga do card da frente (só o Para hoje tem vagas). */
  vagaDe?: (id: string) => number | undefined;
  /** Cards da Nova urgência que são prioridade fora das vagas (marca para o teste e para o estilo). */
  foraDaVaga?: ReadonlySet<string>;
  esquerda: Acao;
  /** `animar`: o card sai para a direita antes de `executar` (as pilhas de navegação); no Para hoje a saída só acontece depois de a gravação ser confirmada, então não anima aqui. */
  direita: AcaoDireita;
  travado?: boolean;
  /** Troca a linha de botões (por exemplo, a confirmação de finalizar). */
  rodape?: ReactNode;
  aviso?: string;
};

export function Baralho({ nome, ordem, porId, vagaDe, foraDaVaga, esquerda, direita, travado = false, rodape, aviso }: Props) {
  const { abrirJanela } = useApp();
  const [saindo, setSaindo] = useState<Lado | null>(null);
  const [volta, setVolta] = useState<string | null>(null);
  const [virado, setVirado] = useState<{ id: string; verso: boolean } | null>(null);
  const [anima, setAnima] = useState(false);
  const trava = useRef(false);
  const botaoDireita = useRef<HTMLButtonElement>(null);   // onde o menu de etapas se ancora quando a direita abre o menu
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setAnima(true); }, []); // o primeiro desenho não anima: só os cards que assumem a frente depois
  /* eslint-enable react-hooks/set-state-in-effect */
  const ativoId = ordem[0], ativa = ativoId ? porId.get(ativoId) : undefined;
  const verso = !!ativoId && virado?.id === ativoId && virado.verso;
  const total = ordem.length, desligado = travado || saindo !== null;

  const sair = useCallback((lado: Lado, depois: () => void) => {
    if (trava.current) return;
    if (movimentoReduzido()) { depois(); return; }
    trava.current = true; setSaindo(lado);
    setTimeout(() => {
      depois(); setSaindo(null); trava.current = false;
      if (lado === 'esq' && ativoId) { setVolta(ativoId); setTimeout(() => setVolta(null), 420); }
    }, TEMPO_SAIDA);
  }, [ativoId]);
  const irEsquerda = useCallback(() => { if (total < 2 || esquerda.desabilitado) return false; sair('esq', esquerda.executar); return true; }, [total, esquerda, sair]);
  const irDireita = useCallback(() => { if (direita.desabilitado) return false; if (direita.animar) { sair('dir', () => direita.executar(botaoDireita.current)); return true; } direita.executar(botaoDireita.current); return false; }, [direita, sair]);
  const { ref, props } = useArrasto((lado) => (lado === 'esq' ? irEsquerda() : irDireita()), desligado);

  const virar = (e: React.MouseEvent) => {
    if (desligado || !ativoId) return;
    if ((e.target as HTMLElement).closest(INTERATIVO)) return; // tarefa, link ou botão: só a própria ação
    setVirado({ id: ativoId, verso: !verso });
  };
  if (!ativa) return null;
  const atras = ordem.slice(1, 3), fantasma = volta && total >= 4 ? porId.get(volta) : undefined;
  return (
    <div className="ph-pilha" data-pilha data-total={total} data-saindo={saindo ?? undefined} aria-label={nome} role="group">
      <div className="ph-palco">
        {fantasma ? <div className="ph-atras" data-nivel="3" data-volta aria-hidden="true"><span>{fantasma.assunto}</span></div> : null}
        {atras.map((id, i) => <div key={id} className="ph-atras" data-nivel={i + 1} data-volta={id === volta || undefined} aria-hidden="true"><span>{porId.get(id)?.assunto}</span></div>)}
        <div key={ativoId} ref={ref} className="ph-arrasto" data-ativo-id={ativoId} data-anima={anima || undefined} onClick={virar} {...props}>
          <span className="ph-dica ph-dica-esq" aria-hidden="true">{esquerda.rotulo}</span>
          <span className="ph-dica ph-dica-dir" aria-hidden="true">{direita.rotulo}</span>
          <div className="vaga" {...(vagaDe?.(ativoId) !== undefined ? { 'data-vaga': vagaDe(ativoId) } : {})} {...(foraDaVaga?.has(ativoId) ? { 'data-fora-vaga': '' } : {})} data-ativo>
            <CardDemanda d={ativa} mostrarRapida lado={verso ? 'verso' : 'frente'} aoGirar={(para) => setVirado({ id: ativoId, verso: para === 'verso' })} />
          </div>
        </div>
      </div>
      {rodape ?? (
        <>
          <div className="ph-botoes" role="group" aria-label="Navegar pelos cards">
            <button type="button" className="btn mini" data-pilha-passar disabled={desligado || total < 2 || esquerda.desabilitado} onClick={() => irEsquerda()}><Icone nome="chevron-right" />{esquerda.rotulo}</button>
            <button ref={botaoDireita} type="button" className="btn mini pri" data-pilha-avancar aria-haspopup={direita.menu ? 'menu' : undefined} disabled={desligado || direita.desabilitado} onClick={() => irDireita()}>{direita.rotulo}<Icone nome={direita.icone ?? 'chevron-right'} /></button>
          </div>
          <div className="ph-meta">
            <span className="ph-posicao data" aria-live="polite">1 de {total}</span>
            <button type="button" className="btn mini" data-pilha-abrir onClick={() => abrirJanela({ t: 'editar', id: ativa.id })}><Icone nome="pencil" />Abrir a demanda</button>
          </div>
        </>
      )}
      <p className="sr-only" role="status" aria-live="polite">{aviso}</p>
    </div>
  );
}

/**
 * Cards de demanda das páginas (Demandas em Cards, filtros do Início): no celular viram um baralho com a ordem só em memória (volta ao normal ao recarregar); nas demais larguras ficam como eram
 * (a grade de cards). Esquerda manda o card ao fim da ordem visual; direita volta ao anterior. A etapa muda pelos controles que o card já tem.
 */
export function CardsDeDemandas({ lista, classe = 'cards' }: { lista: Demanda[]; classe?: string }) {
  const secao = useRef<HTMLDivElement>(null);
  const modo = useModo(secao);
  return <div ref={secao} className="cartas" data-modo={modo}>{modo === 'pilha' && lista.length ? <BaralhoSimples lista={lista} /> : <div className={classe}>{lista.map((d) => <CardDemanda key={d.id} d={d} />)}</div>}</div>;
}

export function BaralhoSimples({ lista, nome = 'Demandas', foraDaVaga }: { lista: Demanda[]; nome?: string; foraDaVaga?: ReadonlySet<string> }) {
  const [guardada, setGuardada] = useState<string[]>([]);
  const ids = useMemo(() => lista.map((d) => d.id), [lista]);
  const ordem = useMemo(() => ordemDaPilha(ids, guardada), [ids, guardada]);
  const porId = useMemo(() => new Map(lista.map((d) => [d.id, d] as const)), [lista]);
  const [aviso, setAviso] = useState('');
  return (
    <Baralho nome={nome} ordem={ordem} porId={porId} aviso={aviso} foraDaVaga={foraDaVaga}
      esquerda={{ rotulo: 'Passar para o fim', executar: () => { setGuardada(ativoParaOFim(ordem)); setAviso(`Passado para o fim. Agora: ${porId.get(ordem[1])?.assunto ?? ''}`); } }}
      direita={{ rotulo: 'Voltar ao anterior', icone: 'chevron-right', desabilitado: ordem.length < 2, animar: true, executar: () => { setGuardada(ultimoParaAFrente(ordem)); setAviso(`Voltou ao anterior: ${porId.get(ordem[ordem.length - 1])?.assunto ?? ''}`); } }} />
  );
}
