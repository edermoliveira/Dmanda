'use client';
// Para hoje e Nova urgência no Início (decisão 64). Quatro vagas reais (guardadas no banco). Três apresentações, escolhidas pela largura do próprio painel:
//  - largo: as quatro vagas lado a lado;
//  - iPad em pé: a faixa mostra duas vagas por vez e rola de lado para as outras duas (rolar é só navegar: não muda ordem nem etapa);
//  - celular: pilha com um card ativo. Deslizar à esquerda manda o card para o fim da ordem de apresentação (guardada só neste aparelho, até a virada do dia em Brasília);
//    deslizar à direita avança a etapa (Cadastro, Vistos, Fazendo, Finalizado) ou, nas etapas de espera, abre o menu para escolher. Botões equivalentes fazem o mesmo.
// A vaga, a etapa e a prioridade nunca mudam pelo gesto da esquerda. O primeiro desenho é o mesmo no servidor e no navegador: a ordem guardada só entra depois de montar.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PonteiroReact } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { CardDemanda } from './cartoes';
import { eObjeto } from '@/lib/armazenamento';
import { ativoParaOFim, elegiveisParaHoje, ETAPA_SEGUINTE, etapaDeEspera, ordemDaPilha, organizarPainel, precisaCompletar, vagasAbertas, VAGAS_PARA_HOJE } from '@/lib/para-hoje';
import { plural, type Demanda } from '@/lib/demandas';

type Modo = 'quatro' | 'duas' | 'pilha';
/** Larguras do painel em px de layout (não de fonte): abaixo de 520 é celular (pilha), abaixo de 840 é iPad em pé (duas vagas por vez). */
const LARGURA_DUAS = 840, LARGURA_PILHA = 520;
const modoDaLargura = (w: number): Modo => (w < LARGURA_PILHA ? 'pilha' : w < LARGURA_DUAS ? 'duas' : 'quatro');

const CHAVE_ORDEM = 'dmanda:para-hoje-ordem';
type OrdemGuardada = { dia: string; ids: string[] };
function lerOrdem(): OrdemGuardada | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_ORDEM) ?? 'null') as unknown;
    if (!eObjeto(v) || typeof v.dia !== 'string' || !Array.isArray(v.ids)) return null;
    return { dia: v.dia, ids: v.ids.filter((x): x is string => typeof x === 'string') };
  } catch { return null; }
}
function gravarOrdem(o: OrdemGuardada) { try { localStorage.setItem(CHAVE_ORDEM, JSON.stringify(o)); } catch { /* sem armazenamento: vale só nesta visita */ } }

/** O modo da apresentação, medido no próprio painel (e não na janela): o menu lateral aberto ou fechado muda a largura útil. Começa em "quatro" (igual no servidor). */
function useModo(ref: React.RefObject<HTMLElement | null>): Modo {
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

/**
 * Arrasto horizontal com o dedo (ou a caneta). O mouse nunca arrasta: no computador valem os botões. A rolagem vertical segue livre (touch-action: pan-y); o gesto só começa quando o
 * movimento é claramente horizontal. Um deslize curto ou cancelado volta ao lugar sem mudar nada. Depois de um arrasto o clique seguinte é engolido (não abre a demanda nem marca tarefa).
 */
function useArrasto(onEsquerda: () => void, onDireita: () => void, desligado: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const est = useRef<{ x: number; y: number; id: number; fase: 'espera' | 'arrasta' | 'fora'; dx: number } | null>(null);
  const engolir = useRef(false);
  const aplicar = (dx: number, lado?: 'esq' | 'dir') => {
    const el = ref.current; if (!el) return;
    el.style.setProperty('--dx', `${dx}px`);
    if (lado) el.dataset.lado = lado; else delete el.dataset.lado;
  };
  const limite = () => Math.max(72, (ref.current?.getBoundingClientRect().width ?? 300) * 0.22);
  const final = () => { const el = ref.current; if (el) { delete el.dataset.arrastando; aplicar(0); } est.current = null; };
  return {
    ref,
    props: {
      onPointerDown: (e: PonteiroReact<HTMLDivElement>) => {
        if (desligado || e.pointerType === 'mouse' || !e.isPrimary) return;
        if ((e.target as HTMLElement).closest('input:not([type="checkbox"]), textarea, select')) return; // editando o texto de uma tarefa: o dedo é do campo
        est.current = { x: e.clientX, y: e.clientY, id: e.pointerId, fase: 'espera', dx: 0 };
      },
      onPointerMove: (e: PonteiroReact<HTMLDivElement>) => {
        const s = est.current; if (!s || s.id !== e.pointerId || s.fase === 'fora') return;
        const dx = e.clientX - s.x, dy = e.clientY - s.y;
        if (s.fase === 'espera') {
          if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { s.fase = 'fora'; return; } // rolagem vertical: não é gesto
          if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
          s.fase = 'arrasta'; ref.current?.setPointerCapture(e.pointerId); if (ref.current) ref.current.dataset.arrastando = 'sim';
        }
        s.dx = dx; aplicar(dx, Math.abs(dx) >= limite() ? (dx < 0 ? 'esq' : 'dir') : undefined);
      },
      onPointerUp: (e: PonteiroReact<HTMLDivElement>) => {
        const s = est.current; if (!s || s.id !== e.pointerId) return;
        const foi = s.fase === 'arrasta', dx = s.dx;
        if (foi) { engolir.current = true; setTimeout(() => { engolir.current = false; }, 350); }
        final();
        if (foi && dx <= -limite()) onEsquerda(); else if (foi && dx >= limite()) onDireita();
      },
      onPointerCancel: () => final(),
      onClickCapture: (e: React.MouseEvent) => { if (engolir.current) { e.preventDefault(); e.stopPropagation(); } },
    },
  };
}

type Vaga = { posicao: number; demanda: Demanda };

/** A pilha do celular: o card ativo, os botões e os gestos. */
function Pilha({ vagas }: { vagas: Vaga[] }) {
  const { hoje, mover, concluir, abrirMenuMover, demandas } = useApp();
  const [guardada, setGuardada] = useState<OrdemGuardada | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<{ id: string; pendentes: number } | null>(null);
  const [aviso, setAviso] = useState('');
  const observando = useRef<{ id: string; etapa: string; ate: number } | null>(null);
  const botaoAvancar = useRef<HTMLButtonElement>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setGuardada(lerOrdem()); const f = (e: StorageEvent) => { if (e.key === CHAVE_ORDEM) setGuardada(lerOrdem()); }; addEventListener('storage', f); return () => removeEventListener('storage', f); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const ids = useMemo(() => vagas.map((v) => v.demanda.id), [vagas]);
  const ordem = useMemo(() => ordemDaPilha(ids, guardada && guardada.dia === hoje ? guardada.ids : []), [ids, guardada, hoje]);
  const guardarOrdem = useCallback((novos: string[]) => { const o = { dia: hoje, ids: novos }; setGuardada(o); gravarOrdem(o); }, [hoje]);
  const porId = useMemo(() => new Map(vagas.map((v) => [v.demanda.id, v] as const)), [vagas]);
  const ativa = porId.get(ordem[0]) ?? null;
  // uma confirmação aberta para um card que já não é o ativo (a lista mudou por baixo, por exemplo ao voltar à aba) não pode travar a pilha
  const confirmarAtivo = confirmar && ativa && confirmar.id === ativa.demanda.id ? confirmar : null;

  // card que foi para a escolha de etapa no menu: quando a etapa mudar de verdade, a pilha avança (depois da gravação confirmada)
  useEffect(() => {
    const o = observando.current; if (!o) return;
    const d = demandas.find((x) => x.id === o.id);
    if (Date.now() > o.ate) { observando.current = null; return; }
    if (!d || d.etapa === o.etapa) return;
    observando.current = null;
    if (ordem[0] === o.id) guardarOrdem(ativoParaOFim(ordem));
  }, [demandas, ordem, guardarOrdem]);

  const passar = useCallback(() => {
    if (ocupado || confirmarAtivo || ordem.length < 2) return;
    guardarOrdem(ativoParaOFim(ordem)); setAviso(`Passado para o fim. Agora: ${porId.get(ordem[1])?.demanda.assunto ?? ''}`);
  }, [ocupado, confirmarAtivo, ordem, guardarOrdem, porId]);

  const gravar = useCallback(async (d: Demanda, destino: 'Vistos' | 'Fazendo' | 'Finalizado') => {
    setOcupado(true);
    const r = await (destino === 'Finalizado' ? concluir(d.id) : mover(d.id, destino));
    setOcupado(false);
    if (!r) return; // falhou (o aviso de erro já apareceu): o card e a ordem ficam como estavam
    if (destino !== 'Finalizado') guardarOrdem(ativoParaOFim(ordem)); // a vaga continua dele; a pilha segue para o próximo
  }, [concluir, mover, ordem, guardarOrdem]);

  const avancar = useCallback(() => {
    if (ocupado || confirmarAtivo || !ativa) return;
    const d = ativa.demanda;
    if (etapaDeEspera(d.etapa)) { observando.current = { id: d.id, etapa: d.etapa, ate: Date.now() + 60_000 }; if (botaoAvancar.current) abrirMenuMover(d.id, botaoAvancar.current); return; }
    const destino = ETAPA_SEGUINTE[d.etapa];
    if (!destino) return;
    if (destino === 'Finalizado') {
      const pendentes = d.tarefas.filter((t) => !t.concluida).length;
      if (pendentes > 0) { setConfirmar({ id: d.id, pendentes }); return; }
    }
    void gravar(d, destino as 'Vistos' | 'Fazendo' | 'Finalizado');
  }, [ocupado, confirmarAtivo, ativa, abrirMenuMover, gravar]);

  const { ref, props } = useArrasto(passar, avancar, ocupado || !!confirmarAtivo);
  if (!ativa) return null;
  const d = ativa.demanda, destino = ETAPA_SEGUINTE[d.etapa];
  const rotuloAvancar = etapaDeEspera(d.etapa) ? 'Escolher a etapa' : destino ? (destino === 'Finalizado' ? 'Finalizar' : `Avançar para ${destino}`) : 'Sem etapa seguinte';
  return (
    <div className="ph-pilha" data-pilha data-total={ordem.length}>
      <div ref={ref} className="ph-arrasto" data-ativo-id={d.id} {...props}>
        <span className="ph-dica ph-dica-esq" aria-hidden="true">Passar para o fim</span>
        <span className="ph-dica ph-dica-dir" aria-hidden="true">{rotuloAvancar}</span>
        <div className="vaga" data-vaga={ativa.posicao} data-ativo>
          <CardDemanda d={d} mostrarRapida />
        </div>
      </div>
      {confirmarAtivo ? (
        <div className="ph-confirma" role="alertdialog" aria-label="Finalizar a demanda" data-confirma-finalizar>
          <p>Ao finalizar, {confirmarAtivo.pendentes === 1 ? '1 tarefa pendente será marcada' : `${confirmarAtivo.pendentes} tarefas pendentes serão marcadas`} como concluída{confirmarAtivo.pendentes === 1 ? '' : 's'}.</p>
          <div className="acoes">
            <button type="button" className="btn" autoFocus onClick={() => setConfirmar(null)}>Cancelar</button>
            <button type="button" className="btn pri" disabled={ocupado} onClick={async () => { await gravar(d, 'Finalizado'); setConfirmar(null); }}>Finalizar e concluir {plural(confirmarAtivo.pendentes, 'tarefa')}</button>
          </div>
        </div>
      ) : (
        <div className="ph-botoes" role="group" aria-label="Navegar pelas vagas">
          <button type="button" className="btn mini" data-pilha-passar disabled={ocupado || ordem.length < 2} onClick={passar}><Icone nome="chevron-right" />Passar para o fim</button>
          <span className="ph-posicao data" aria-live="polite">1 de {ordem.length}</span>
          <button ref={botaoAvancar} type="button" className="btn mini pri" data-pilha-avancar aria-haspopup={etapaDeEspera(d.etapa) ? 'menu' : undefined} disabled={ocupado || (!destino && !etapaDeEspera(d.etapa))} onClick={avancar}>{rotuloAvancar}<Icone nome="chevron-right" /></button>
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">{aviso}</p>
    </div>
  );
}

export function ParaHoje() {
  const { demandas, hoje, dias, paraHoje, sincronizarParaHoje, carregando } = useApp();
  const secao = useRef<HTMLElement>(null);
  const faixa = useRef<HTMLDivElement>(null);
  const modo = useModo(secao);
  const elegiveis = useMemo(() => elegiveisParaHoje(demandas, hoje, dias), [demandas, hoje, dias]);
  const abertas = vagasAbertas(paraHoje, demandas);
  const ocupadas = new Set(abertas.map((v) => v.demanda.id));
  const faltaCompletar = precisaCompletar(paraHoje, demandas, elegiveis);
  const candidatas = faltaCompletar ? elegiveis.filter((e) => !ocupadas.has(e.demanda.id)).slice(0, 10).map((e) => e.demanda.id).join(',') : '';
  // preenche (ou repõe) só as vagas livres; a lista só muda quando as candidatas mudam, então uma resposta sem efeito não repete a chamada
  useEffect(() => { if (!carregando && hoje !== '2000-01-01' && candidatas) void sincronizarParaHoje(candidatas.split(',')); }, [candidatas, carregando, hoje, sincronizarParaHoje]);
  // Exibição (decisões 61 e 64): os pedidos da Prefeita e do Gabinete que ocupam vagas vêm antes das comuns (a posição gravada não muda). Com as quatro vagas cheias, a prioridade elegível de fora
  // abre a faixa Nova urgência, antes das urgências comuns. Cada demanda aparece uma só vez, em uma das duas seções.
  const painel = useMemo(() => organizarPainel(paraHoje, demandas, elegiveis), [paraHoje, demandas, elegiveis]);
  const vagas = useMemo(() => [...painel.prioritariasNasVagas, ...painel.comunsNasVagas], [painel]);
  const urgencias = painel.novaUrgencia.slice(0, VAGAS_PARA_HOJE);
  const vazio = !vagas.length;
  const rolar = (sentido: 1 | -1) => { const f = faixa.current; if (f) f.scrollBy({ left: sentido * (f.clientWidth + 14), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  return (
    <section ref={secao} className="sec ph" data-painel="para-hoje" data-modo={modo} aria-labelledby="ph-t">
      <h3 id="ph-t">Para hoje <small>até {VAGAS_PARA_HOJE} demandas para tocar hoje: pedidos da Prefeita e do Gabinete primeiro, depois atrasadas e as que vencem hoje</small></h3>
      {vazio ? <div className="vazio-c">Nada para tocar hoje por enquanto.</div> : modo === 'pilha' ? <Pilha vagas={vagas} /> : (
        <>
          {modo === 'duas' && vagas.length > 2 ? (
            <div className="ph-nav" role="group" aria-label="Ver outras vagas">
              <span className="data">Deslize para o lado: mais {vagas.length - 2} {vagas.length - 2 === 1 ? 'vaga' : 'vagas'}</span>
              <button type="button" className="icbtn-s ph-ant" aria-label="Vagas anteriores" onClick={() => rolar(-1)}><Icone nome="chevron-right" /></button>
              <button type="button" className="icbtn-s" aria-label="Próximas vagas" onClick={() => rolar(1)}><Icone nome="chevron-right" /></button>
            </div>
          ) : null}
          <div ref={faixa} className="cards ph-cards" data-faixa>
            {vagas.map((v) => <div key={v.demanda.id} data-vaga={v.posicao} className="vaga"><CardDemanda d={v.demanda} mostrarRapida /></div>)}
          </div>
        </>
      )}
      {urgencias.length ? (
        <div className="nova-urgencia" role="status" data-nova-urgencia>
          <h4>Nova urgência <small>fora das suas vagas, sem trocar a seleção</small></h4>
          <div className="cards ph-cards-urg">{urgencias.map((e) => <div key={e.demanda.id} className="vaga" {...(e.prioritaria ? { 'data-fora-vaga': '' } : {})}><CardDemanda d={e.demanda} mostrarRapida /></div>)}</div>
        </div>
      ) : null}
    </section>
  );
}
