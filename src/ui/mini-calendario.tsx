'use client';
// Mini calendário do Início (decisões 64 e 65): cartão compacto com o mês e as setas no cabeçalho, grade fixa de seis semanas (segunda a domingo, células uniformes) e rodapé separado com os
// atalhos Hoje, Amanhã, Em 3 dias, Em 1 semana e Em 2 semanas. Cada célula tem uma cor só: a mistura em partes iguais das cores das categorias presentes no dia. Ao abrir, o dia atual vem
// destacado e a lista do dia fica recolhida; ela só aparece depois de uma seleção explícita (clique, toque, Enter ou atalho). Passar o mouse (ou focar pelo teclado) num dia com marcações mostra
// um cartão flutuante com a data, os títulos, os horários e os tipos; o cartão não abre a lista, some com Esc e fica aberto enquanto o ponteiro estiver sobre ele. No toque a consulta é pela seleção.
// Toda a lógica de categorias e de datas fica em src/lib/mini-calendario.ts (testada à parte); aqui só se desenha. Nada de relógio na renderização: "hoje" vem do contexto.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as TeclaReact } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { anoMes, dataPorExtenso, indiceSemana, NOMES_MES, primeiroDoMes, SEMANA_ABREVIADAS, SEMANA_NOMES, somarMeses } from '@/lib/agenda';
import { somarDias } from '@/lib/prazos';
import { ATALHOS_MINI, CATEGORIAS_MINI, categoriasDoDia, corMisturada, descreverDiaMini, itensMini, mapaMini, ROTULO_MINI, seisSemanas, type CategoriaMini, type ItemMini } from '@/lib/mini-calendario';

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const corDa = (c: CategoriaMini) => `var(--cal-${c})`;
const ATRASO_ABRIR = 100, ATRASO_FECHAR = 160;

function ItemDoDia({ i }: { i: ItemMini }) {
  const { abrirJanela } = useApp();
  const router = useRouter();
  const abrir = () => { if (i.origem.tipo === 'evento') abrirJanela({ t: 'evento', id: i.origem.id }); else if (i.origem.tipo === 'demanda') abrirJanela({ t: 'editar', id: i.origem.id }); else router.push('/config'); };
  const acao = i.origem.tipo === 'evento' ? `Abrir o evento: ${i.titulo}` : i.origem.tipo === 'demanda' ? `Abrir a demanda: ${i.titulo}` : `Abrir Configurações para ${i.titulo}`;
  return (
    <li className="mc-item" data-categoria={i.categoria} data-origem={i.origem.tipo}>
      <button type="button" className="mc-item-b" aria-label={`${ROTULO_MINI[i.categoria]}: ${acao}. ${i.detalhe}`} onClick={abrir}>
        <i className="mc-barra" aria-hidden="true" />
        <span className="mc-item-t"><span className="mc-rot">{ROTULO_MINI[i.categoria]}</span><b>{i.titulo}</b><small>{i.detalhe}</small></span>
      </button>
    </li>
  );
}

/**
 * O cartão flutuante de um dia com marcações. Sobe para o .app (a coluna do Início tem contenção de layout, que prenderia o `fixed`). Posição: ao lado da célula, do lado que couber na janela
 * (direita, depois esquerda); sem espaço dos dois lados, abaixo ou acima; sempre limitado às bordas da janela. Fica aberto enquanto o ponteiro estiver sobre ele.
 */
function CartaoDoDia({ id, data, itens, ancora, aoEntrar, aoSair }: { id: string; data: string; itens: ItemMini[]; ancora: DOMRect; aoEntrar: () => void; aoSair: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight, folga = 8, vao = 4;
    const limitar = (v: number, max: number) => Math.max(folga, Math.min(v, max - folga));
    let x: number, y: number;
    if (ancora.right + vao + w <= vw - folga) { x = ancora.right + vao; y = limitar(ancora.top + ancora.height / 2 - h / 2, vh - h + folga); }
    else if (ancora.left - vao - w >= folga) { x = ancora.left - vao - w; y = limitar(ancora.top + ancora.height / 2 - h / 2, vh - h + folga); }
    else { x = limitar(ancora.left + ancora.width / 2 - w / 2, vw - w + folga); y = ancora.bottom + vao + h <= vh - folga ? ancora.bottom + vao : limitar(ancora.top - vao - h, vh - h + folga); }
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; el.style.visibility = 'visible';
  }, [ancora, data, itens]);
  const mistura = corMisturada(categoriasDoDia(itens), corDa);
  return createPortal(
    <div ref={ref} id={id} role="tooltip" className="mc-cartao" data-mc-cartao data-data={data} style={{ visibility: 'hidden', ...(mistura ? { '--mc-mix': mistura } : {}) } as CSSProperties} onPointerEnter={aoEntrar} onPointerLeave={aoSair}>
      <h4>{maiuscula(dataPorExtenso(data))}</h4>
      <ul>
        {itens.map((i) => (
          <li key={i.chave} data-categoria={i.categoria}>
            <i className="mc-barra" aria-hidden="true" />
            <span className="mc-item-t"><span className="mc-rot">{ROTULO_MINI[i.categoria]}</span><b>{i.titulo}</b><small>{i.detalhe}</small></span>
          </li>
        ))}
      </ul>
    </div>,
    document.querySelector('.app') ?? document.body,
  );
}

export function MiniCalendario() {
  const { hoje, eventos, dias, pagamentos, demandas, abrirJanela } = useApp();
  const [sel, setSel] = useState<string | null>(null);     // seleção explícita: nula até o usuário escolher (a lista do dia só aparece com ela)
  const [foco, setFoco] = useState<string | null>(null);   // dia do foco de teclado; nulo = hoje
  const [vista, setVista] = useState<string | null>(null); // primeiro dia do mês mostrado; nulo = mês de hoje
  const [cartao, setCartao] = useState<{ data: string; ancora: DOMRect } | null>(null);
  const diaFoco = foco ?? sel ?? hoje;
  const primeiro = vista ?? primeiroDoMes(sel ?? hoje);
  const { ano, mes } = anoMes(primeiro);
  const semanas = useMemo(() => seisSemanas(primeiro), [primeiro]);
  const fontes = useMemo(() => ({ eventos, dias, pagamentos, demandas, hoje }), [eventos, dias, pagamentos, demandas, hoje]);
  const mapa = useMemo(() => mapaMini(semanas[0][0].data, semanas[5][6].data, fontes), [semanas, fontes]);
  const itensDia = useMemo(() => (sel ? itensMini(sel, fontes) : []), [sel, fontes]);
  const gridRef = useRef<HTMLDivElement>(null);
  const focar = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (focar.current) { focar.current = false; gridRef.current?.querySelector<HTMLElement>(`[data-data="${diaFoco}"]`)?.focus(); } }, [diaFoco, primeiro]);

  const limparTimer = useCallback(() => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } }, []);
  const agendar = useCallback((fn: () => void, ms: number) => { limparTimer(); timer.current = setTimeout(() => { timer.current = null; fn(); }, ms); }, [limparTimer]);
  useEffect(() => limparTimer, [limparTimer]);
  const abrirCartao = useCallback((data: string, el: HTMLElement) => { limparTimer(); setCartao({ data, ancora: el.getBoundingClientRect() }); }, [limparTimer]);
  const fecharCartao = useCallback(() => { limparTimer(); setCartao(null); }, [limparTimer]);
  // Esc dispensa o cartão (de qualquer origem); rolar ou redimensionar também, porque a âncora saiu do lugar
  useEffect(() => {
    if (!cartao) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCartao(null); }; // só um novo gesto (entrar no dia ou focá-lo de novo) reabre
    const sair = () => setCartao(null);
    document.addEventListener('keydown', esc); window.addEventListener('resize', sair); document.querySelector('.main')?.addEventListener('scroll', sair, { passive: true });
    return () => { document.removeEventListener('keydown', esc); window.removeEventListener('resize', sair); document.querySelector('.main')?.removeEventListener('scroll', sair); };
  }, [cartao]);
  // o cartão aberto precisa acompanhar o que mudou nos dados: sem itens no dia, ele não faz sentido
  const itensDoCartao = cartao ? mapa.get(cartao.data) ?? [] : [];

  const escolher = (d: string) => { setSel(d); setFoco(d); setVista(primeiroDoMes(d)); };
  const mudarMes = (n: 1 | -1) => setVista(primeiroDoMes(somarMeses(primeiro, n)));
  const tecla = (e: TeclaReact<HTMLDivElement>) => {
    const passo: Record<string, string> = { ArrowLeft: somarDias(diaFoco, -1), ArrowRight: somarDias(diaFoco, 1), ArrowUp: somarDias(diaFoco, -7), ArrowDown: somarDias(diaFoco, 7), Home: somarDias(diaFoco, -indiceSemana(diaFoco)), End: somarDias(diaFoco, 6 - indiceSemana(diaFoco)), PageUp: somarMeses(diaFoco, -1), PageDown: somarMeses(diaFoco, 1) };
    const alvo = passo[e.key];
    if (!alvo || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); focar.current = true; setFoco(alvo); setVista(primeiroDoMes(alvo)); // setas só movem o foco: Enter ou espaço selecionam
  };
  const diaTabulavel = semanas.flat().some((c) => c.data === diaFoco) ? diaFoco : semanas.flat().find((c) => c.doMes)!.data;

  return (
    <section className="mini-cal" aria-label="Calendário do mês" data-mini-calendario data-lista={sel ? 'aberta' : 'recolhida'}>
      <header className="mc-cab">
        <button type="button" className="icbtn-s mc-seta" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><Icone nome="chevron-right" /></button>
        <h3 className="mc-mes" aria-live="polite">{maiuscula(NOMES_MES[mes - 1])} de {ano}</h3>
        <button type="button" className="icbtn-s mc-seta" aria-label="Próximo mês" onClick={() => mudarMes(1)}><Icone nome="chevron-right" /></button>
      </header>
      <div className="mc-grade" role="grid" aria-label={`Dias de ${NOMES_MES[mes - 1]} de ${ano}`} ref={gridRef} onKeyDown={tecla}>
        <div className="mc-linha" role="row">{SEMANA_ABREVIADAS.map((l, i) => <div key={l} className="mc-cabsem" role="columnheader"><abbr title={SEMANA_NOMES[i]}>{maiuscula(l)}</abbr></div>)}</div>
        {semanas.map((sem, i) => (
          <div key={i} className="mc-linha" role="row">
            {sem.map(({ data, doMes }) => {
              const itens = mapa.get(data) ?? [], cats = categoriasDoDia(itens), selecionado = data === sel, mistura = corMisturada(cats, corDa);
              return (
                <div key={data} role="gridcell" aria-selected={selecionado}>
                  <button type="button" className="mc-dia" data-data={data} data-hoje={data === hoje || undefined} data-sel={selecionado || undefined} data-fora={!doMes || undefined} data-fim-semana={indiceSemana(data) >= 5 || undefined} data-cats={cats.join(' ') || undefined} data-n={cats.length || undefined}
                    style={mistura ? ({ backgroundColor: mistura } as CSSProperties) : undefined} tabIndex={data === diaTabulavel ? 0 : -1} aria-current={data === hoje ? 'date' : undefined}
                    aria-label={descreverDiaMini(data, itens, { hoje, selecionado })} aria-describedby={cartao?.data === data && itens.length ? 'mc-cartao' : undefined}
                    onClick={() => escolher(data)}
                    onPointerEnter={(e) => { if (e.pointerType !== 'mouse') return; const el = e.currentTarget; if (!itens.length) { agendar(fecharCartao, ATRASO_FECHAR); return; } agendar(() => abrirCartao(data, el), cartao ? 0 : ATRASO_ABRIR); }}
                    onPointerLeave={(e) => { if (e.pointerType !== 'mouse') return; agendar(fecharCartao, ATRASO_FECHAR); }}
                    onFocus={(e) => { if (itens.length && e.currentTarget.matches(':focus-visible')) abrirCartao(data, e.currentTarget); else if (!itens.length) fecharCartao(); }}
                    onBlur={() => agendar(fecharCartao, ATRASO_FECHAR)}>
                    <span className="mc-num">{Number(data.slice(8, 10))}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="mc-leg" aria-label="Categorias do calendário">
        {CATEGORIAS_MINI.map((c) => <li key={c} data-categoria={c}><i className="mc-amostra" aria-hidden="true" />{ROTULO_MINI[c]}</li>)}
      </ul>
      <footer className="mc-rodape" role="group" aria-label="Atalhos de data">
        {ATALHOS_MINI.map((a) => <button key={a.rotulo} type="button" className="btn mini" data-atalho={a.dias} onClick={() => escolher(somarDias(hoje, a.dias))}>{a.rotulo}</button>)}
      </footer>
      {sel ? (
        <div className="mc-dia-lista" data-data={sel}>
          <header className="mc-dl-cab">
            <h4 id="mc-dl-t">{maiuscula(dataPorExtenso(sel))}</h4>
            <button type="button" className="icbtn-s mc-mais" aria-label={`Novo evento em ${dataPorExtenso(sel)}`} title="Novo evento neste dia" onClick={() => abrirJanela({ t: 'evento', data: sel })}><Icone nome="plus" /></button>
            <button type="button" className="icbtn-s mc-recolher" aria-label="Recolher a lista do dia" title="Recolher a lista" onClick={() => setSel(null)}><Icone nome="x" /></button>
          </header>
          {itensDia.length ? <ul className="mc-itens" aria-labelledby="mc-dl-t">{itensDia.map((i) => <ItemDoDia key={i.chave} i={i} />)}</ul> : <p className="mc-vazio">Nada neste dia.</p>}
        </div>
      ) : null}
      {cartao && itensDoCartao.length ? <CartaoDoDia id="mc-cartao" data={cartao.data} itens={itensDoCartao} ancora={cartao.ancora} aoEntrar={limparTimer} aoSair={() => agendar(fecharCartao, ATRASO_FECHAR)} /> : null}
    </section>
  );
}
