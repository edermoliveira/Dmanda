'use client';
// Baralho de cards de demanda, só para o celular (decisão 65, aprovado na prévia 887b116, decisão 67; portado da branch do Início para a main em 14/11/2026): pilha com o card da frente e dois logo atrás.
//  - O card da frente acompanha o dedo em tempo real, com leve inclinação; ao soltar um gesto curto, volta suavemente para o lugar.
//  - Gesto confirmado (distância proporcional à largura ou gesto rápido e longo o bastante): o card sai, reaparece atrás da pilha e o próximo assume a frente.
//  - Toque numa área livre vira o card (verso existente); novo toque volta à frente. Tocar em tarefa, link ou botão faz só aquela ação. Há sempre uma ação clara para abrir a demanda.
//  - A rolagem vertical segue livre (touch-action: pan-y), o cancelamento do gesto pelo navegador devolve o card, o mouse nunca arrasta (valem os botões equivalentes) e movimento reduzido tira as animações.
//  - Revelar o próximo (decisão 77): o card que vai assumir a frente já está montado atrás, com o título e a cor do próprio card; enquanto o da frente acompanha o dedo, ele aparece. Gesto curto: o da frente
//    volta e a ordem não muda. Gesto completo de navegação: assume a frente exatamente o card que foi revelado. Os de fundo são só visuais (inert, sem foco nem clique).
// Aqui só mora a apresentação e o gesto: a ordem, as etapas e as gravações ficam com quem usa (Para hoje, Nova urgência e as listas de cards do Início).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PonteiroReact, type ReactNode, type RefObject } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { CardDemanda } from './cartoes';
import { gestoValido, ordemDaPilha, ultimoParaAFrente, ativoParaOFim } from '@/lib/para-hoje';
import { permanencia, plural, type Demanda } from '@/lib/demandas';
import { montarSecoes } from '@/lib/secoes-cards';
import { Ajuda } from './ajuda';

export type Modo = 'grade' | 'pilha';
/** Largura do painel em px de layout (não de fonte): abaixo de 520 é celular (pilha); acima, a grade de cards de sempre (computador e iPad seguem como na main). */
const LARGURA_PILHA = 520;
export const modoDaLargura = (w: number): Modo => (w < LARGURA_PILHA ? 'pilha' : 'grade');

/** O modo da apresentação, medido no próprio painel (e não na janela): o menu lateral aberto ou fechado muda a largura útil. Começa em "grade" (igual no servidor). */
export function useModo(ref: RefObject<HTMLElement | null>): Modo {
  const [modo, setModo] = useState<Modo>('grade');
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
 * `--prog` (0 a 1) só é lido pelos cards de trás (a posição de cada um) e pela camada `.vaga` dos cards revelados (a opacidade). Escrito neles, e não na pilha, a cada movimento do dedo o navegador
 * não reestiliza o card da frente nem os cards de fundo inteiros (propriedade personalizada comum herda para toda a subárvore; ver o @property em inicio.css, decisão 78).
 */
const definirProg = (pilha: HTMLElement, v: string) => pilha.querySelectorAll<HTMLElement>('.ph-atras, .ph-atras[data-face] > .vaga').forEach((e) => e.style.setProperty('--prog', v));
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
    el.style.setProperty('--ph-dx', `${dx}px`); el.style.setProperty('--ph-rot', `${Math.max(-14, Math.min(14, (dx / w) * 18)).toFixed(2)}deg`);
    const pilha = el.closest<HTMLElement>('.ph-pilha');
    if (pilha) definirProg(pilha, prog.toFixed(3));
    if (pilha) { if (Math.abs(dx) >= 4) pilha.dataset.revela = dx < 0 ? 'esq' : 'dir'; else delete pilha.dataset.revela; }
    if (prog >= 1) el.dataset.lado = dx < 0 ? 'esq' : 'dir'; else delete el.dataset.lado;
  };
  const zerar = () => { const el = ref.current; if (el) { delete el.dataset.arrastando; delete el.dataset.lado; el.style.setProperty('--ph-dx', '0px'); el.style.setProperty('--ph-rot', '0deg'); const p = el.closest<HTMLElement>('.ph-pilha'); if (p) { definirProg(p, '0'); delete p.dataset.revela; } } };
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
type AcaoDireita = { rotulo: string; /** Texto visível do botão quando é mais curto que o rótulo da dica do gesto (a dica mantém o rótulo). */ curto?: string; /** Nome acessível do botão quando o texto visível não diz tudo (começa pelo texto visível). */ descricao?: string; executar: (ancora: HTMLElement | null) => void; desabilitado?: boolean; animar?: boolean; menu?: boolean; icone?: string };
type Props = {
  nome: string;
  ordem: string[];
  porId: Map<string, Demanda>;
  /** Número da vaga do card da frente (só o Para hoje tem vagas). */
  vagaDe?: (id: string) => number | undefined;
  esquerda: Acao;
  /** `animar`: o card sai para a direita antes de `executar` (as pilhas de navegação); no Para hoje a saída só acontece depois de a gravação ser confirmada, então não anima aqui. */
  direita: AcaoDireita;
  travado?: boolean;
  /** Troca a linha de botões (por exemplo, a confirmação de finalizar). */
  rodape?: ReactNode;
  aviso?: string;
  /** Observações por card (por exemplo, "Sem data de chegada" na fila "Aguardando há mais tempo"). */
  notas?: ReadonlyMap<string, string>;
};

export function Baralho({ nome, ordem, porId, vagaDe, esquerda, direita, travado = false, rodape, aviso, notas }: Props) {
  const { abrirJanela } = useApp();
  const [saindo, setSaindo] = useState<Lado | null>(null);
  const [volta, setVolta] = useState<string | null>(null);
  const [virado, setVirado] = useState<{ id: string; verso: boolean } | null>(null);
  const pilhaRef = useRef<HTMLDivElement>(null);
  const trava = useRef(false);
  const botaoDireita = useRef<HTMLButtonElement>(null);   // onde o menu de etapas se ancora quando a direita abre o menu
  const ativoId = ordem[0], ativa = ativoId ? porId.get(ativoId) : undefined;
  const verso = !!ativoId && virado?.id === ativoId && virado.verso;
  const total = ordem.length, desligado = travado || saindo !== null;
  // Os botões de navegação nunca usam `disabled` enquanto bloqueiam (animação de saída, gravação em andamento, sem outro card): `disabled` tira o botão do foco e, depois da troca do card, o foco caía no BODY.
  // `aria-disabled` mantém o foco no botão; o bloqueio de verdade (clique, Enter, Espaço e repetição) é feito no onClick abaixo.
  const bloqueadoEsq = desligado || total < 2 || !!esquerda.desabilitado, bloqueadoDir = desligado || !!direita.desabilitado;
  // a linha de botões some quando a confirmação de finalizar aparece e volta ao cancelar ou concluir: o foco volta para o botão da direita, sem roubar o foco de quem já foi para outro lugar
  const tinhaRodape = useRef(false);
  useEffect(() => {
    if (tinhaRodape.current && !rodape && (!document.activeElement || document.activeElement === document.body)) botaoDireita.current?.focus();
    tinhaRodape.current = !!rodape;
  }, [rodape]);

  const sair = useCallback((lado: Lado, depois: () => void) => {
    if (trava.current) return;
    const limpar = () => { const p = pilhaRef.current; if (p) { definirProg(p, '0'); delete p.dataset.revela; } };
    if (movimentoReduzido()) { depois(); limpar(); return; }
    trava.current = true; setSaindo(lado);
    setTimeout(() => {
      depois(); limpar(); setSaindo(null); trava.current = false;
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
  const navDir = !!direita.animar;
  // os cards que podem assumir a frente: o próximo (esquerda) e, quando a direita é "voltar ao anterior", o último da ordem (com só dois cards os dois lados revelam o mesmo)
  const proximo = total >= 2 ? porId.get(ordem[1]) : undefined, anterior = navDir && total >= 3 ? porId.get(ordem[total - 1]) : undefined;
  const atras = ordem.slice(2, 3), fantasma = volta && total >= 4 ? porId.get(volta) : undefined;
  const face = (d: Demanda, lado: 'esq' | 'dir' | 'ambos') => <div key={`face-${lado}`} className="ph-atras" data-nivel="1" data-face={lado} aria-hidden="true" inert><div className="vaga"><CardDemanda d={d} mostrarRapida lado="frente" nota={notas?.get(d.id)} /></div></div>;
  return (
    <div ref={pilhaRef} className="ph-pilha" data-pilha data-total={total} data-saindo={saindo ?? undefined} data-nav-dir={navDir || undefined} aria-label={nome} role="group">
      <div className="ph-palco">
        {fantasma ? <div className="ph-atras" data-nivel="3" data-volta aria-hidden="true"><span>{fantasma.assunto}</span></div> : null}
        {atras.map((id) => <div key={id} className="ph-atras" data-nivel="2" data-volta={id === volta || undefined} aria-hidden="true"><span>{porId.get(id)?.assunto}</span></div>)}
        <div key={ativoId} ref={ref} className="ph-arrasto" data-ativo-id={ativoId} onClick={virar} {...props}>
          <span className="ph-dica ph-dica-esq" aria-hidden="true">{esquerda.rotulo}</span>
          <span className="ph-dica ph-dica-dir" aria-hidden="true">{direita.rotulo}</span>
          <div className="vaga" {...(vagaDe?.(ativoId) !== undefined ? { 'data-vaga': vagaDe(ativoId) } : {})} data-ativo>
            <CardDemanda d={ativa} mostrarRapida lado={verso ? 'verso' : 'frente'} nota={notas?.get(ativa.id)} aoGirar={(para) => setVirado({ id: ativoId, verso: para === 'verso' })} />
          </div>
        </div>
        {/* depois do card da frente no documento: quem procura o card pelo id encontra primeiro o da frente; a sobreposição é do CSS */}
        {proximo ? face(proximo, anterior ? 'esq' : 'ambos') : null}
        {anterior ? face(anterior, 'dir') : null}
      </div>
      {rodape ?? (
        <>
          <div className="ph-botoes" role="group" aria-label="Ações do card">
            <button type="button" className="btn mini" data-pilha-passar aria-disabled={bloqueadoEsq || undefined} onClick={() => { if (!bloqueadoEsq) irEsquerda(); }}><Icone nome="chevron-right" /><span>{esquerda.rotulo}</span></button>
            <button type="button" className="btn mini" data-pilha-abrir aria-label="Abrir a demanda" onClick={() => abrirJanela({ t: 'editar', id: ativa.id })}><Icone nome="pencil" /><span>Abrir</span></button>
            <button ref={botaoDireita} type="button" className="btn mini pri" data-pilha-avancar aria-label={direita.descricao} aria-haspopup={direita.menu ? 'menu' : undefined} aria-disabled={bloqueadoDir || undefined} onClick={() => { if (!bloqueadoDir) irDireita(); }}><span>{direita.curto ?? direita.rotulo}</span><Icone nome={direita.icone ?? 'chevron-right'} /></button>
          </div>
          <div className="ph-meta"><span className="ph-posicao data" aria-live="polite">1 de {total}</span></div>
        </>
      )}
      <p className="sr-only" role="status" aria-live="polite">{aviso}</p>
    </div>
  );
}

export function BaralhoSimples({ lista, nome = 'Demandas', notas }: { lista: Demanda[]; nome?: string; notas?: ReadonlyMap<string, string> }) {
  const [guardada, setGuardada] = useState<string[]>([]);
  const ids = useMemo(() => lista.map((d) => d.id), [lista]);
  const ordem = useMemo(() => ordemDaPilha(ids, guardada), [ids, guardada]);
  const porId = useMemo(() => new Map(lista.map((d) => [d.id, d] as const)), [lista]);
  const [aviso, setAviso] = useState('');
  return (
    <Baralho nome={nome} ordem={ordem} porId={porId} aviso={aviso} notas={notas}
      esquerda={{ rotulo: 'Passar para o fim', executar: () => { setGuardada(ativoParaOFim(ordem)); setAviso(`Passado para o fim. Agora: ${porId.get(ordem[1])?.assunto ?? ''}`); } }}
      direita={{ rotulo: 'Voltar ao anterior', icone: 'chevron-right', desabilitado: ordem.length < 2, animar: true, executar: () => { setGuardada(ultimoParaAFrente(ordem)); setAviso(`Voltou ao anterior: ${porId.get(ordem[ordem.length - 1])?.assunto ?? ''}`); } }} />
  );
}

/**
 * Cards em faixa (web e iPad): cards lado a lado, na ordem recebida, numa faixa com rolagem horizontal própria (a largura de cada card é a de uma célula do Para hoje). As setas aparecem só quando há mais cards
 * do que cabem e ficam no lugar (aria-disabled) nas pontas. É a Urgência do Início e cada uma das nove seções de Demandas > Cards.
 */
export function FaixaCards({ lista, rotulo, notas }: { lista: Demanda[]; rotulo: string; notas?: ReadonlyMap<string, string> }) {
  const faixa = useRef<HTMLDivElement>(null);
  const [pode, setPode] = useState({ esq: false, dir: false, tem: false });
  useEffect(() => {
    const el = faixa.current; if (!el) return;
    const medir = () => setPode((a) => { const n = { esq: el.scrollLeft > 2, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 2, tem: el.scrollWidth > el.clientWidth + 2 }; return a.esq === n.esq && a.dir === n.dir && a.tem === n.tem ? a : n; });
    medir(); el.addEventListener('scroll', medir, { passive: true });
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => { el.removeEventListener('scroll', medir); ro.disconnect(); };
  }, [lista.length]);   // só a quantidade: a lista é um array novo a cada desenho e reinscrever os ouvintes a cada vez seria trabalho à toa
  const rolar = (sentido: 1 | -1) => { const el = faixa.current; if (el) el.scrollBy({ left: sentido * el.clientWidth, behavior: movimentoReduzido() ? 'auto' : 'smooth' }); };
  return (
    <div className="urg-caixa">
      <div ref={faixa} className="cards-urg" role="region" aria-label={`${rotulo}; role para o lado para ver as demais`} tabIndex={0} data-urg-faixa>
        {lista.map((d) => <div key={d.id} className="vaga"><CardDemanda d={d} mostrarRapida nota={notas?.get(d.id)} /></div>)}
      </div>
      {pode.tem ? (
        <>
          <button type="button" className="urg-seta urg-ant" aria-label={`Ver os anteriores: ${rotulo}`} aria-disabled={!pode.esq || undefined} data-urg-ant onClick={() => { if (pode.esq) rolar(-1); }}><Icone nome="chevron-right" /></button>
          <button type="button" className="urg-seta urg-prox" aria-label={`Ver os próximos: ${rotulo}`} aria-disabled={!pode.dir || undefined} data-urg-prox onClick={() => { if (pode.dir) rolar(1); }}><Icone nome="chevron-right" /></button>
        </>
      ) : null}
    </div>
  );
}

/** A observação de cada card da fila "Aguardando há mais tempo": há quantos dias chegou, ou a falta da data de chegada (a permanência nunca vem da criação do card). */
const notaDeChegada = (d: Demanda, hoje: string) => { const n = permanencia(d, hoje); return n === null ? 'Sem data de chegada' : n === 0 ? 'Chegou hoje' : `Chegou há ${plural(n, 'dia')}`; };

/**
 * Demandas, visão Cards (decisão 80): nove seções temáticas (lib/secoes-cards.ts), cada uma com a sua fila. Na web e no iPad cada seção é uma faixa de cards lado a lado com rolagem horizontal própria; no iPhone
 * cada seção é um baralho com a posição de navegação só dela (navegar em uma não mexe nas outras, e nada muda de etapa). O mesmo id pode estar em várias seções e todas leem o mesmo estado: editar, mudar a etapa,
 * concluir ou reabrir aparece em todas as ocorrências.
 */
export function SecoesCards({ lista }: { lista: Demanda[] }) {
  const { hoje, dias } = useApp();
  const secao = useRef<HTMLDivElement>(null);
  const modo = useModo(secao);
  const secoes = useMemo(() => montarSecoes(lista, hoje, dias), [lista, hoje, dias]);
  return (
    <div ref={secao} className="grupos-cards" data-modo={modo}>
      {secoes.map((s) => {
        const notas = s.chave === 'aguardando' ? new Map(s.demandas.map((d) => [d.id, notaDeChegada(d, hoje)] as const)) : undefined;
        const nome = `${s.rotulo}, ${plural(s.demandas.length, 'demanda')}`;
        return (
          <section key={s.chave} className="grupo-cards secao-cards" data-secao={s.chave} data-cor={s.cor ?? undefined} aria-label={nome}>
            <h3 className="sub-f grupo-cab"><i className="grupo-cor" aria-hidden="true" /><span>{s.rotulo}</span> <small>{plural(s.demandas.length, 'demanda')}</small><Ajuda rotulo={`Sobre ${s.rotulo}`}>{s.criterio}</Ajuda></h3>
            {!s.demandas.length ? <div className="vazio-c">Nenhuma demanda nesta fila.</div>
              : modo === 'pilha' ? <BaralhoSimples lista={s.demandas} nome={s.rotulo} notas={notas} />
                : <FaixaCards lista={s.demandas} rotulo={s.rotulo} notas={notas} />}
          </section>
        );
      })}
    </div>
  );
}
