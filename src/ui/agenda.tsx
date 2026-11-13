'use client';
// Agenda (decisões 46 a 49 e 72): Hoje, semana (domingo a sábado) e mês (segunda a domingo, com a gaveta do dia), com o heatmap da carga pendente, os marcos das demandas (vencimento,
// acompanhamento, retorno do setor), os compromissos próprios e os dias indisponíveis. Toda a lógica de datas e de carga fica em src/lib/agenda.ts e eventos.ts (testada à parte); aqui só se desenha.
// Nada de relógio na renderização: a data de hoje vem do contexto, e a hora de agora só existe depois de montar no navegador.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as TeclaReact } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { ChipEspera } from './cartoes';
import { diasDesde, plural, titulo, type Demanda } from '@/lib/demandas';
import { somarDias, type DiaIndisponivel } from '@/lib/prazos';
import { horarioDe, sobrepostosA, type Evento } from '@/lib/eventos';
import { eObjeto } from '@/lib/armazenamento';
import {
  anoMes, cargaPorDia, colunaNaSemana, dataPorExtenso, descreverDia, diaDoMes, fimDeSemana, gradeMes, itensDoDia, itensParaGrade, LIMIARES_CARGA, marcosPorDia, MES_ABREV, MES_DIAS_ABREV, MES_DIAS_NOMES, nivelDaCarga, nomeLongoDoDia, NOMES_MES, panorama,
  pendenciasSemPrazo, primeiroDoMes, recortarItens, ROTULO_MARCO, ROTULO_NIVEL, rotuloSemana, semanaDe, somarMeses, tituloMes, trocarMes, diasNoMes, type CargaDia, type ItemGrade, type Marco, type NivelCarga, type OpcoesAgenda, type TipoMarco,
} from '@/lib/agenda';

type Modo = 'hoje' | 'semana' | 'mes';
type Categoria = 'tudo' | 'demandas' | 'eventos';
type Preferencias = { modo?: Modo; cat?: Categoria; concluidas?: boolean; finalizadas?: boolean };
const CHAVE = 'dmanda:agenda';
const MODOS: [Modo, string][] = [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês']];
const CATEGORIAS: [Categoria, string][] = [['tudo', 'Tudo'], ['demandas', 'Demandas'], ['eventos', 'Compromissos']];
const pl = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const NIVEIS: NivelCarga[] = ['zero', 'baixa', 'media', 'alta'];
const FAIXA_NIVEL: Record<NivelCarga, string> = { zero: '0', baixa: `${LIMIARES_CARGA.baixa} a ${LIMIARES_CARGA.media - 1}`, media: `${LIMIARES_CARGA.media} a ${LIMIARES_CARGA.alta - 1}`, alta: `${LIMIARES_CARGA.alta} ou mais` };

// o que está guardado pode estar corrompido ou ser de outra versão: só entra o que tem a forma esperada
function lerPrefs(): Preferencias {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as unknown;
    if (!eObjeto(v)) return {};
    return { modo: MODOS.some(([m]) => m === v.modo) ? (v.modo as Modo) : undefined, cat: CATEGORIAS.some(([c]) => c === v.cat) ? (v.cat as Categoria) : undefined, concluidas: v.concluidas === true, finalizadas: v.finalizadas === true };
  } catch { return {}; }
}
function gravarPrefs(p: Preferencias) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* sem armazenamento: vale só nesta visita */ } }

// ---------- peças ----------
/** Contexto de um marco: o rótulo do tipo e a situação (atrasado ou no prazo). */
function EtiquetaMarco({ m, hoje }: { m: Marco; hoje: string }) {
  return <span className="agd-tag" data-tipo={m.tipo} data-atrasado={m.atrasado || undefined}>{ROTULO_MARCO[m.tipo]}{m.atrasado ? ` · atrasado há ${plural(diasDesde(m.data, hoje), 'dia')}` : ''}</span>;
}

/** Uma demanda no dia: os marcos dela que caem no dia (um item só, mesmo com dois marcos) e as tarefas pendentes, que se marcam aqui mesmo e atualizam a carga. */
function ItemDemanda({ marcos, hoje, concluidas, compacto = false }: { marcos: Marco[]; hoje: string; concluidas: boolean; compacto?: boolean }) {
  const { abrirJanela, marcarTarefa } = useApp();
  const d: Demanda = marcos[0].demanda;
  const pendentes = d.tarefas.filter((t) => !t.concluida).length;
  const tarefas = d.tarefas.filter((t) => concluidas || !t.concluida);
  return (
    <article className="agd-item agd-demanda" data-atrasada={marcos.some((m) => m.atrasado) || undefined} data-id={d.id}>
      <button type="button" className="agd-abrir" onClick={() => abrirJanela({ t: 'editar', id: d.id })} aria-label={`Abrir a demanda: ${titulo(d)}, ${d.assunto}`}>
        <span className="agd-tags">{marcos.map((m) => <EtiquetaMarco key={m.tipo} m={m} hoje={hoje} />)}</span>
        <span className="agd-tit">{d.assunto}</span>
        <span className="agd-sub mono">{titulo(d)}{d.setor && d.etapa === 'Aguardando retorno' ? ` · ${d.setor}` : ''} · {d.etapa === 'Finalizado' ? 'Finalizada' : d.etapa}</span>
      </button>
      <div className="agd-chips"><ChipEspera d={d} />{pendentes ? <span className="chip neutro">{pl(pendentes, 'tarefa pendente', 'tarefas pendentes')}</span> : d.etapa !== 'Finalizado' ? <span className="chip neutro">{d.tarefas.length ? 'Todas as tarefas concluídas' : 'Sem tarefas'}</span> : null}</div>
      {!compacto && marcos.some((m) => m.tipo !== 'vencimento') ? <p className="agd-nota">{marcos.filter((m) => m.tipo !== 'vencimento').map((m) => `${ROTULO_MARCO[m.tipo]}: ${m.detalhe}.`).join(' ')}</p> : null}
      {!compacto && tarefas.length ? (
        <ul className="agd-tarefas">
          {tarefas.map((t) => (
            <li key={t.id}><label><input type="checkbox" checked={t.concluida} onChange={(e) => void marcarTarefa(t.id, e.target.checked)} /><span className={t.concluida ? 'feita' : undefined}>{t.texto}</span></label></li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ItemEvento({ e, conflitos, compacto = false }: { e: Evento; conflitos: Evento[]; compacto?: boolean }) {
  const { abrirJanela } = useApp();
  return (
    <article className="agd-item agd-evento" data-tipo={e.tipo} data-dia={e.dia_inteiro || undefined} data-id={e.id}>
      <button type="button" className="agd-abrir" onClick={() => abrirJanela({ t: 'evento', id: e.id })} aria-label={`Abrir o evento: ${e.titulo}, ${horarioDe(e)}`}>
        <span className="agd-hora mono">{horarioDe(e)}</span>
        <span className="agd-tit">{e.titulo}</span>
        {compacto ? null : <span className="agd-sub">{e.tipo}{e.descricao ? ` · ${e.descricao.split('\n')[0].slice(0, 80)}` : ''}</span>}
      </button>
      {conflitos.length ? <p className="agd-alerta" role="note"><Icone nome="alert" />Sobrepõe com {conflitos.map((c) => `${c.titulo} (${horarioDe(c)})`).join(', ')}</p> : null}
    </article>
  );
}

function ItemIndisponivel({ x }: { x: DiaIndisponivel }) {
  return <p className="agd-item agd-indisp"><Icone nome="calendar" /><span><b>{x.categoria === 'Feriado' ? 'Feriado' : 'Evento externo'}:</b> {x.descricao}</span></p>;
}

/** Os eventos de uma lista com os conflitos de cada um, calculados só entre os eventos do mesmo dia. */
const comConflitos = (l: Evento[]) => l.map((e) => ({ e, c: e.dia_inteiro ? [] : sobrepostosA(e, l) }));
function agruparPorDemanda(marcos: Marco[]): Marco[][] {
  const mapa = new Map<string, Marco[]>();
  for (const m of marcos) mapa.set(m.demanda.id, [...(mapa.get(m.demanda.id) ?? []), m]);
  return [...mapa.values()];
}

// ---------- gaveta do dia (Mês) ----------
/**
 * A lista completa do dia, aberta pelo toque na data ou no "+N": gaveta à direita no computador e no iPad, gaveta inferior no celular, sobre a grade (que não se mexe).
 * O foco vai para a gaveta ao abrir e não sai dela com Tab ou Shift+Tab; Esc fecha (a menos que uma janela, menu ou busca aberta por cima cuide do próprio teclado);
 * ao fechar, o foco volta ao controle que abriu e o mês, a data escolhida e a posição da página ficam como estavam.
 */
function GavetaDia({ data, o, concluidas, semDemandas, aoFechar }: { data: string; o: OpcoesAgenda; concluidas: boolean; semDemandas: string | null; aoFechar: () => void }) {
  const { abrirJanela, hoje, recarregar } = useApp();
  const ref = useRef<HTMLElement>(null);
  const fechar = useRef(aoFechar);
  useEffect(() => { fechar.current = aoFechar; });
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[aria-modal="true"], .busca-ov, .mv-menu')).some((x) => x !== ref.current)) return; // algo aberto por cima cuida do próprio teclado
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); fechar.current(); return; }
      if (e.key === 'Tab' && ref.current) {
        const itens = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((x) => x.getClientRects().length);
        if (!itens.length) return;
        const atual = itens.indexOf(document.activeElement as HTMLElement);
        const alvo = e.shiftKey ? (atual <= 0 ? itens[itens.length - 1] : null) : (atual === -1 || atual === itens.length - 1 ? itens[0] : null);
        if (alvo) { e.preventDefault(); alvo.focus(); }
      }
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, []);
  const itens = itensDoDia(data, o);
  const grupos = agruparPorDemanda(itens.marcos), eventos = comConflitos(itens.eventos);
  const vazio = !itens.eventos.length && !grupos.length && !itens.indisponiveis.length;
  // a página da Agenda é um contêiner de consulta, que prende o que é posicionado dentro dela: a gaveta vai para a casca do aplicativo, como a do Perfil
  return createPortal(
    <div className="dr-ov entra agd-gv-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); aoFechar(); } }}>
      <aside ref={ref} className="dr agd-gv agd-detalhe" role="dialog" aria-modal="true" aria-labelledby="agd-gv-t" tabIndex={-1} data-data={data}>
        <header className="agd-gv-cab">
          <div><h3 id="agd-gv-t">{maiuscula(dataPorExtenso(data))}</h3><p className="agd-sub">{data === hoje ? 'Hoje' : data < hoje ? 'Dia que já passou' : `Daqui a ${plural(diasDesde(hoje, data), 'dia')}`}</p></div>
          <button type="button" className="icbtn-s" aria-label="Fechar a lista do dia" onClick={aoFechar}><Icone nome="x" /></button>
        </header>
        {semDemandas ? <div className="erro-carga" role="alert"><b>As demandas não carregaram.</b><span>Vencimentos, retornos e a carga deste dia ficam indisponíveis; os compromissos aparecem normalmente.</span><button type="button" className="btn mini" onClick={() => void recarregar()}>Tentar de novo</button></div> : null}
        <div className="agd-gv-corpo">
          {itens.indisponiveis.map((x) => <ItemIndisponivel key={x.id} x={x} />)}
          {eventos.length ? <><h4 className="agd-h4">Compromissos e lembretes</h4>{eventos.map(({ e, c }) => <ItemEvento key={e.id} e={e} conflitos={c} />)}</> : null}
          {grupos.length ? <><h4 className="agd-h4">Demandas e acompanhamentos</h4>{grupos.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={concluidas} />)}</> : null}
          {vazio ? <p className="agd-vazio">{semDemandas ? 'Nenhum compromisso neste dia. Sem as demandas carregadas, não dá para dizer o que vence.' : 'Nada programado para este dia.'}</p> : null}
        </div>
        <footer className="agd-gv-rod"><button type="button" className="btn pri" onClick={() => abrirJanela({ t: 'evento', data })}><Icone nome="plus" />Novo evento neste dia</button></footer>
      </aside>
    </div>,
    document.querySelector('.app') ?? document.body,
  );
}

// ---------- painéis auxiliares ----------
function PainelDiasCheios({ pan, aoVer, rotulo }: { pan: ReturnType<typeof panorama>; aoVer: (d: string) => void; rotulo: string }) {
  return (
    <section className="agd-painel agd-aux" aria-labelledby="agd-cheios-t">
      <header className="agd-cab"><div><h3 id="agd-cheios-t">Onde {rotulo} aperta</h3><p className="agd-sub">Dias de carga média ou alta, para antecipar ou redistribuir.</p></div></header>
      {pan.cheios.length ? (
        <ul className="agd-lista">
          {pan.cheios.map((c) => (
            <li key={c.data}>
              <button type="button" className="agd-linha" onClick={() => aoVer(c.data)}>
                <span className="agd-amostra" data-nivel={nivelDaCarga(c.carga)} aria-hidden="true" />
                <span className="agd-linha-t"><b>{maiuscula(dataPorExtenso(c.data))}</b><small>{plural(c.carga, 'pendência')} ({ROTULO_NIVEL[nivelDaCarga(c.carga)]})</small>{c.sugestao ? <small>{c.sugestao}</small> : <small>Nenhum dia próximo está mais leve.</small>}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="agd-vazio">Nenhum dia com carga média ou alta {rotulo === 'a semana' ? 'nesta semana' : 'neste período'}.</p>}
    </section>
  );
}

function PainelSemPrazo({ lista }: { lista: Demanda[] }) {
  const { abrirJanela } = useApp();
  return (
    <section className="agd-painel agd-aux" aria-labelledby="agd-sem-t">
      <header className="agd-cab"><div><h3 id="agd-sem-t">Pendências sem prazo</h3><p className="agd-sub">{lista.length ? `${pl(lista.length, 'demanda aberta', 'demandas abertas')} sem nenhuma data. Nada foi inventado para elas.` : 'Toda demanda aberta tem alguma data.'}</p></div></header>
      {lista.length ? (
        <ul className="agd-lista">
          {lista.slice(0, 6).map((d) => (
            <li key={d.id}><button type="button" className="agd-linha" onClick={() => abrirJanela({ t: 'editar', id: d.id })}>
              <span className="agd-linha-t"><b>{d.assunto}</b><small className="mono">{titulo(d)} · {d.etapa}{d.chegou_em ? ` · chegou em ${d.chegou_em.slice(8, 10)}/${d.chegou_em.slice(5, 7)}` : ''}</small></span>
            </button></li>
          ))}
          {lista.length > 6 ? <li className="agd-sub">e mais {lista.length - 6}. Elas aparecem em Demandas, com o filtro Sem prazo.</li> : null}
        </ul>
      ) : null}
    </section>
  );
}

// ---------- mês ----------
function Legenda() {
  return (
    <footer className="agd-leg">
      <ul className="agd-marcas" aria-label="Marcas do calendário">
        <li><i className="agd-m-hoje" aria-hidden="true" />Hoje</li>
        <li><i className="agd-m-atr" aria-hidden="true" />Com atraso</li>
        <li><i className="agd-m-ev" aria-hidden="true" />Compromisso</li>
        <li><i className="agd-m-dem" data-marco="vencimento" aria-hidden="true" />Vencimento</li>
        <li><i className="agd-m-dem" data-marco="acompanhamento" aria-hidden="true" />Acompanhar</li>
        <li><i className="agd-m-dem" data-marco="retorno" aria-hidden="true" />Retorno do setor</li>
      </ul>
      <div className="agd-escala" role="group" aria-label="Escala de pendências">
        <span>Menos pendências</span>
        <ul>{NIVEIS.map((n) => <li key={n} title={`${FAIXA_NIVEL[n]} ${n === 'zero' ? 'pendências' : 'pendências no dia'}`}><i className="agd-amostra" data-nivel={n} aria-hidden="true" /><small>{FAIXA_NIVEL[n]}</small></li>)}</ul>
        <span>Mais pendências</span>
      </div>
    </footer>
  );
}

const ROTULO_CURTO: Record<TipoMarco, string> = { vencimento: 'Vence', acompanhamento: 'Acomp.', retorno: 'Retorno' };
/** Uma linha da célula: o compromisso com a hora (ou "Dia todo") ou a demanda no dia do marco. Só texto: quem abre é a célula inteira. */
function ItemCelula({ it }: { it: ItemGrade }) {
  // o espaço entre a hora (ou o rótulo) e o título não aparece (a linha é flex), mas deixa o texto lido por inteiro, como "09:00 Reunião"
  if (it.tipo === 'evento') return <span className="agd-it" data-k="evento" data-dia={it.diaInteiro || undefined}><b className="agd-it-h">{it.diaInteiro ? 'Dia todo' : it.hora}</b>{' '}<span className="agd-it-t">{it.titulo}</span></span>;
  return <span className="agd-it" data-k="demanda" data-marco={it.marco} data-atrasado={it.atrasado || undefined}>{it.marco === 'vencimento' ? null : <><b className="agd-it-m">{ROTULO_CURTO[it.marco]}</b>{' '}</>}<span className="agd-it-t">{it.titulo}</span></span>;
}

/** As abas JAN a DEZ do ano exibido, na vertical: levam direto ao mês, mantendo o dia (ou o último dia do mês, se ele não existir). */
function AbasMeses({ dia, escolherMes }: { dia: string; escolherMes: (mes: number) => void }) {
  const { ano, mes } = anoMes(dia);
  return (
    <nav className="agd-meses" aria-label={`Meses de ${ano}`}>
      {MES_ABREV.map((a, i) => <button key={a} type="button" className="agd-mes-aba" data-mes={i + 1} aria-current={i + 1 === mes ? 'true' : undefined} aria-label={`${maiuscula(NOMES_MES[i])} de ${ano}`} onClick={() => escolherMes(i + 1)}><span aria-hidden="true">{a}</span></button>)}
    </nav>
  );
}

function GradeMes({ dia, hoje, carga, o, indispPorData, semDemandas, escolher, abrir }: { dia: string; hoje: string; carga: Map<string, CargaDia>; o: OpcoesAgenda; indispPorData: Map<string, DiaIndisponivel[]>; semDemandas: boolean; escolher: (d: string) => void; abrir: (d: string, origem: HTMLElement) => void }) {
  const { ano, mes } = anoMes(dia);
  const semanas = useMemo(() => gradeMes(ano, mes), [ano, mes]);
  const itensPorDia = useMemo(() => { const m = new Map<string, ItemGrade[]>(); for (const d of semanas.flat()) if (d) m.set(d, itensParaGrade(d, o)); return m; }, [semanas, o]);
  const gridRef = useRef<HTMLDivElement>(null);
  const focar = useRef(false);
  // quantos itens cabem por célula: três quando a grade é larga, dois nas menores (o resto vira "+N"); no primeiro desenho vale o do computador, igual ao do servidor
  const [limite, setLimite] = useState(3);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setLimite(el.clientWidth >= 760 ? 3 : 2));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (focar.current) { focar.current = false; gridRef.current?.querySelector<HTMLElement>(`[data-data="${dia}"]`)?.focus(); } }, [dia]);
  const tecla = (e: TeclaReact<HTMLDivElement>) => {
    const col = colunaNaSemana(dia);
    const passo: Record<string, string> = { ArrowLeft: somarDias(dia, -1), ArrowRight: somarDias(dia, 1), ArrowUp: somarDias(dia, -7), ArrowDown: somarDias(dia, 7), Home: somarDias(dia, -col), End: somarDias(dia, 6 - col), PageUp: somarMeses(dia, -1), PageDown: somarMeses(dia, 1) };
    const alvo = passo[e.key];
    if (!alvo || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); focar.current = true; escolher(alvo);
  };
  return (
    <div className="agd-grade" role="grid" aria-label={`Calendário de ${tituloMes(dia)}`} ref={gridRef} onKeyDown={tecla} style={{ '--sem': semanas.length } as CSSProperties}>
      <div className="agd-linha-sem" role="row"><div className="agd-semn-cab" aria-hidden="true" />{MES_DIAS_ABREV.map((l, i) => <div key={l} className="agd-cabsem" role="columnheader"><abbr title={MES_DIAS_NOMES[i]}>{l}</abbr></div>)}</div>
      {semanas.map((sem, i) => (
        <div key={i} className="agd-linha-sem" role="row">
          <div className="agd-semn" role="rowheader" aria-label={`Semana ${i + 1} do mês`}>{i + 1}</div>
          {sem.map((d, j) => {
            if (!d) return <div key={j} className="agd-vaz" role="gridcell" aria-hidden="true" />;
            const c = carga.get(d), sel = d === dia, ind = indispPorData.get(d) ?? [];
            const itens = itensPorDia.get(d) ?? [], { visiveis, restantes } = recortarItens(itens, limite);
            const nEv = itens.filter((x) => x.tipo === 'evento').length;
            const nivel = nivelDaCarga(c?.carga ?? 0);
            return (
              <div key={j} role="gridcell" aria-selected={sel}>
                <button type="button" className="agd-cel" data-data={d} data-nivel={nivel} data-hoje={d === hoje || undefined} data-sel={sel || undefined} data-atrasada={c?.atrasada || undefined} data-fds={fimDeSemana(d) || undefined} data-indisp={ind.length || undefined}
                  tabIndex={sel ? 0 : -1} aria-current={d === hoje ? 'date' : undefined} aria-haspopup="dialog" aria-label={descreverDia(d, { carga: c, eventos: nEv, indisponiveis: ind, hoje, selecionado: sel, semDemandas })} onClick={(e) => abrir(d, e.currentTarget)}>
                  <span className="agd-topo">
                    {c?.carga && !semDemandas ? <span className="agd-qtd" aria-hidden="true">{c.carga}</span> : null}
                    {c?.atrasada && !semDemandas ? <i className="agd-atr" aria-hidden="true" /> : null}
                    <span className="agd-num">{diaDoMes(d)}</span>
                  </span>
                  <span className="agd-its" aria-hidden="true">
                    {visiveis.map((it) => <ItemCelula key={`${it.tipo}-${it.id}`} it={it} />)}
                    {restantes ? <span className="agd-mais" data-mais={restantes}>+{restantes}</span> : null}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------- semana ----------
function ColunaDia({ data, o, cat, hoje, sel, carga, escolher }: { data: string; o: OpcoesAgenda; cat: Categoria; hoje: string; sel: boolean; carga?: CargaDia; escolher: (d: string) => void }) {
  const { abrirJanela } = useApp();
  const itens = itensDoDia(data, { ...o, demandas: cat === 'eventos' ? [] : o.demandas, eventos: cat === 'demandas' ? [] : o.eventos });
  const grupos = agruparPorDemanda(itens.marcos), eventos = comConflitos(itens.eventos);
  const nivel = nivelDaCarga(carga?.carga ?? 0);
  return (
    <section className="agd-dia" data-data={data} data-nivel={nivel} data-hoje={data === hoje || undefined} data-sel={sel || undefined} data-fds={fimDeSemana(data) || undefined} aria-label={descreverDia(data, { carga, eventos: itens.eventos.length, indisponiveis: itens.indisponiveis, hoje })}>
      <header className="agd-dia-cab">
        <button type="button" className="agd-dia-sel" onClick={() => escolher(data)} aria-pressed={sel}>
          <span className="agd-dia-nome">{nomeLongoDoDia(data).replace('-feira', '')}</span><span className="agd-dia-num">{diaDoMes(data)}</span>
        </button>
        <button type="button" className="icbtn-s" aria-label={`Novo evento em ${dataPorExtenso(data)}`} title="Novo evento neste dia" onClick={() => abrirJanela({ t: 'evento', data })}><Icone nome="plus" /></button>
        {carga?.carga ? <span className="agd-dia-carga" data-nivel={nivel} title={ROTULO_NIVEL[nivel]}><i className="agd-amostra" data-nivel={nivel} aria-hidden="true" />{carga.carga} {carga.carga === 1 ? 'pendência' : 'pendências'}{carga.atrasada ? <i className="agd-atr" title="Com atraso" /> : null}</span> : null}
      </header>
      {itens.indisponiveis.map((x) => <ItemIndisponivel key={x.id} x={x} />)}
      {eventos.map(({ e, c }) => <ItemEvento key={e.id} e={e} conflitos={c} compacto />)}
      {grupos.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={false} compacto />)}
      {!itens.indisponiveis.length && !eventos.length && !grupos.length ? <p className="agd-vazio">Livre</p> : null}
    </section>
  );
}

// ---------- página ----------
export function PaginaAgenda() {
  const { demandas, dias, eventos, hoje, carregando, carregandoEventos, erroEventos, erroCarga, recarregar, recarregarEventos, abrirJanela } = useApp();
  const [modo, setModoBruto] = useState<Modo>('mes');
  const [cat, setCat] = useState<Categoria>('tudo');
  const [concluidas, setConcluidas] = useState(false);
  const [finalizadas, setFinalizadas] = useState(false);
  const [data, setData] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const abridor = useRef<HTMLElement | null>(null);
  const dia = data ?? hoje;
  const setModo = (m: Modo) => { setGavetaAberta(false); setModoBruto(m); };
  // a gaveta do dia pertence ao Mês: abre pelo toque na data, e ao fechar o foco volta ao controle que a abriu (a seleção e o mês ficam como estavam)
  const abrirGaveta = (d: string, origem: HTMLElement) => { abridor.current = origem; setData(d); setGavetaAberta(true); };
  // se a grade foi refeita enquanto a gaveta estava aberta (Tentar de novo), a célula guardada já saiu da página: o foco vai para a célula do mesmo dia
  const fecharGaveta = () => { setGavetaAberta(false); const o = abridor.current; abridor.current = null; const alvo = o?.isConnected ? o : document.querySelector<HTMLElement>(`.agd-cel[data-data="${dia}"]`); alvo?.focus({ preventScroll: true }); };

  // Lê as preferências guardadas só neste navegador, depois da hidratação (no servidor elas não existem). Sem preferência salva, o celular começa em Hoje.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = lerPrefs();
    if (p.modo) setModoBruto(p.modo); else if (matchMedia('(hover: none), (pointer: coarse)').matches && matchMedia('(max-width: 900px)').matches) setModoBruto('hoje');
    if (p.cat) setCat(p.cat);
    setConcluidas(!!p.concluidas); setFinalizadas(!!p.finalizadas);
    setPronto(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (pronto) gravarPrefs({ modo, cat, concluidas, finalizadas }); }, [pronto, modo, cat, concluidas, finalizadas]);

  const verDemandas = cat !== 'eventos', verEventos = cat !== 'demandas';
  const opcoes: OpcoesAgenda = useMemo(() => ({ demandas, eventos, indisponiveis: dias, hoje, comFinalizadas: finalizadas }), [demandas, eventos, dias, hoje, finalizadas]);
  const carga = useMemo(() => (verDemandas ? cargaPorDia(demandas, dias, hoje) : new Map<string, CargaDia>()), [verDemandas, demandas, dias, hoje]);
  const semPrazo = useMemo(() => pendenciasSemPrazo(demandas, dias, hoje), [demandas, dias, hoje]);
  const eventosVisiveis = useMemo(() => (verEventos ? eventos : []), [verEventos, eventos]);
  // o que o Mês e a gaveta mostram já respeita o filtro Tudo, Demandas ou Compromissos
  const opcoesCat: OpcoesAgenda = useMemo(() => ({ ...opcoes, demandas: verDemandas ? opcoes.demandas : [], eventos: verEventos ? opcoes.eventos : [] }), [opcoes, verDemandas, verEventos]);
  const indispPorData = useMemo(() => { const m = new Map<string, DiaIndisponivel[]>(); for (const x of dias) m.set(x.data, [...(m.get(x.data) ?? []), x]); return m; }, [dias]);

  const { ano, mes } = anoMes(dia);
  const semana = useMemo(() => semanaDe(dia), [dia]);
  const periodo = modo === 'mes' ? { de: primeiroDoMes(dia), ate: `${ano}-${String(mes).padStart(2, '0')}-${String(diasNoMes(ano, mes)).padStart(2, '0')}` } : modo === 'semana' ? { de: semana[0], ate: semana[6] } : { de: dia, ate: dia };
  const pan = useMemo(() => panorama(carga, eventosVisiveis, dias, hoje, periodo.de, periodo.ate), [carga, eventosVisiveis, dias, hoje, periodo.de, periodo.ate]);

  const passo = (n: 1 | -1) => setData(modo === 'mes' ? somarMeses(dia, n) : somarDias(dia, modo === 'semana' ? 7 * n : n));
  const rotuloPeriodo = modo === 'mes' ? <>{maiuscula(NOMES_MES[mes - 1])} <span className="agd-ano">{ano}</span></> : modo === 'semana' ? rotuloSemana(semana) : maiuscula(dataPorExtenso(dia));
  const nomePeriodo = modo === 'mes' ? NOMES_MES[mes - 1] : modo === 'semana' ? 'a semana' : 'o dia';
  const aguardando = carregando || carregandoEventos;
  // a leitura de uma das partes falhou: os números dela não são zero, são desconhecidos (o erro e o botão de tentar de novo estão acima)
  const semDem = !!erroCarga, semEv = !!erroEventos;

  return (
    <div className="agd" data-modo={modo}>
      <div className="pagehead"><h1>Agenda</h1><p>Prazos, retornos e compromissos, juntos.</p></div>

      <div className="agd-barra">
        <div className="opcoes" role="group" aria-label="Visão da agenda">{MODOS.map(([k, n]) => <button key={k} type="button" aria-pressed={modo === k} onClick={() => setModo(k)}>{n}</button>)}</div>
        <button type="button" className="btn pri agd-novo" onClick={() => abrirJanela({ t: 'evento', data: dia })}><Icone nome="plus" />Novo evento</button>
      </div>

      <div className="agd-filtros">
        <div className="opcoes" role="group" aria-label="Mostrar na agenda">{CATEGORIAS.map(([k, n]) => <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}>{n}</button>)}</div>
        <label className="agd-chk"><input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} />Tarefas concluídas</label>
        <label className="agd-chk"><input type="checkbox" checked={finalizadas} onChange={(e) => setFinalizadas(e.target.checked)} />Demandas finalizadas</label>
      </div>

      {erroEventos ? <div className="erro-carga" role="alert"><b>Não foi possível carregar os eventos.</b><span>{erroEventos}</span><button className="btn mini" onClick={() => void recarregarEventos()}>Tentar de novo</button></div> : null}

      <section className="agd-resumo" aria-label="Resumo do período">
        <div className="agd-resumo-t">
          <h2 className="agd-periodo" aria-live="polite">{rotuloPeriodo}</h2>
          {verDemandas ? (
            <p className="agd-grande"><b data-total-pendencias>{aguardando || semDem ? '–' : pan.pendencias}</b> {pan.pendencias === 1 ? 'pendência' : 'pendências'} {modo === 'hoje' ? 'neste dia' : modo === 'semana' ? 'nesta semana' : `em ${NOMES_MES[mes - 1]}`}</p>
          ) : <p className="agd-grande"><b>{aguardando || semEv ? '–' : pan.compromissos}</b> {pan.compromissos === 1 ? 'compromisso' : 'compromissos'}</p>}
          <ul className="agd-chips-res">
            {verDemandas && !semDem ? <li className="chip neutro">{plural(pan.demandas, 'demanda')}</li> : null}
            {verDemandas && !semDem && pan.atrasadas ? <li className="chip perigo">{plural(pan.atrasadas, 'atrasada')}</li> : null}
            {verEventos && !semEv ? <li className="chip neutro">{plural(pan.compromissos, 'compromisso')}</li> : null}
          </ul>
        </div>
        <div className="agd-nav" role="group" aria-label="Período">
          <button type="button" className="icbtn-s agd-ant" aria-label={modo === 'mes' ? 'Mês anterior' : modo === 'semana' ? 'Semana anterior' : 'Dia anterior'} onClick={() => passo(-1)}><Icone nome="chevron-right" /></button>
          <button type="button" className="btn mini" onClick={() => setData(null)} disabled={data === null || data === hoje} aria-label="Voltar para hoje">Hoje</button>
          <button type="button" className="icbtn-s" aria-label={modo === 'mes' ? 'Próximo mês' : modo === 'semana' ? 'Próxima semana' : 'Próximo dia'} onClick={() => passo(1)}><Icone nome="chevron-right" /></button>
          <label className="agd-data"><span className="sr-only">Ir para a data</span><input type="date" value={dia} aria-label="Ir para a data" onChange={(e) => { if (e.target.value) setData(e.target.value); }} /></label>
        </div>
      </section>

      {aguardando ? <div className="vazio-c" role="status">Carregando a agenda...</div> : null}

      {!aguardando && modo === 'mes' ? (
        <section className="agd-painel agd-cal" aria-label={`Calendário de ${tituloMes(dia)}`}>
          {semDem ? <div className="agd-aviso-carga" role="status"><Icone nome="alert" /><span>As demandas não carregaram: vencimentos, retornos e a carga do mês estão indisponíveis. Os compromissos aparecem normalmente.</span><button type="button" className="btn mini" onClick={() => void recarregar()}>Tentar de novo</button></div> : null}
          <div className="agd-mes">
            <GradeMes dia={dia} hoje={hoje} carga={carga} o={opcoesCat} indispPorData={indispPorData} semDemandas={semDem} escolher={(d) => setData(d)} abrir={abrirGaveta} />
            <AbasMeses dia={dia} escolherMes={(m) => setData(trocarMes(dia, m))} />
          </div>
          <Legenda />
        </section>
      ) : null}

      {!aguardando && modo === 'mes' && gavetaAberta ? <GavetaDia data={dia} o={opcoesCat} concluidas={concluidas} semDemandas={erroCarga} aoFechar={fecharGaveta} /> : null}

      {!aguardando && modo === 'semana' ? (
        <div className="agd-sem">
          {semana.map((d) => <ColunaDia key={d} data={d} o={opcoes} cat={cat} hoje={hoje} sel={d === dia} carga={carga.get(d)} escolher={(x) => setData(x)} />)}
        </div>
      ) : null}

      {!aguardando && modo === 'hoje' ? <VisaoHoje dia={dia} o={opcoes} cat={cat} concluidas={concluidas} /> : null}

      {!aguardando && modo !== 'hoje' ? (
        <div className="agd-aux-par">
          <PainelDiasCheios pan={pan} rotulo={nomePeriodo} aoVer={(d) => { setData(d); if (modo === 'semana') setModo('mes'); }} />
          <PainelSemPrazo lista={semPrazo} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- hoje ----------
function VisaoHoje({ dia, o, cat, concluidas }: { dia: string; o: OpcoesAgenda; cat: Categoria; concluidas: boolean }) {
  const { abrirJanela, hoje, dias, demandas } = useApp();
  const itens = itensDoDia(dia, { ...o, demandas: cat === 'eventos' ? [] : o.demandas, eventos: cat === 'demandas' ? [] : o.eventos });
  const eventos = comConflitos(itens.eventos), grupos = agruparPorDemanda(itens.marcos);
  const atrasados = useMemo(() => (dia === hoje && cat !== 'eventos' ? agruparPorDemanda(marcosAtrasados(demandas, dias, hoje, dia)) : []), [dia, hoje, cat, demandas, dias]);
  const semPrazo = useMemo(() => (cat === 'eventos' ? [] : pendenciasSemPrazo(demandas, dias, hoje)), [cat, demandas, dias, hoje]);
  return (
    <div className="agd-hoje">
      <section className="agd-painel" aria-labelledby="agd-h-c">
        <header className="agd-cab"><div><h3 id="agd-h-c">Compromissos e lembretes</h3><p className="agd-sub">Em ordem cronológica.</p></div><button type="button" className="btn mini" onClick={() => abrirJanela({ t: 'evento', data: dia })}><Icone nome="plus" />{dia === hoje ? 'Novo evento hoje' : 'Novo evento neste dia'}</button></header>
        {itens.indisponiveis.map((x) => <ItemIndisponivel key={x.id} x={x} />)}
        {eventos.length ? eventos.map(({ e, c }) => <ItemEvento key={e.id} e={e} conflitos={c} />) : <p className="agd-vazio">Nenhum compromisso {dia === hoje ? 'para hoje' : 'neste dia'}.</p>}
      </section>
      <section className="agd-painel" aria-labelledby="agd-h-d">
        <header className="agd-cab"><div><h3 id="agd-h-d">Demandas e acompanhamentos</h3><p className="agd-sub">Vencimentos, acompanhamentos e retornos {dia === hoje ? 'de hoje' : 'deste dia'}.</p></div></header>
        {grupos.length ? grupos.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={concluidas} />) : <p className="agd-vazio">Nada vence {dia === hoje ? 'hoje' : 'neste dia'}.</p>}
        {atrasados.length ? <><h4 className="agd-h4 agd-h4-atr">Atrasadas (continuam no dia em que venceram)</h4>{atrasados.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={concluidas} compacto />)}</> : null}
      </section>
      {cat !== 'eventos' ? <PainelSemPrazo lista={semPrazo} /> : null}
    </div>
  );
}

/** Marcos que já passaram e continuam abertos, do mais antigo para o mais recente (a Agenda os mantém na data original; esta lista só os lembra no Hoje). */
function marcosAtrasados(demandas: Demanda[], dias: DiaIndisponivel[], hoje: string, ate: string): Marco[] {
  const l = marcosPorDia({ demandas, eventos: [], indisponiveis: dias, hoje }, '0000-01-01', somarDias(ate, -1));
  return [...l.values()].flat().filter((m) => m.atrasado).sort((a, b) => a.data.localeCompare(b.data));
}

