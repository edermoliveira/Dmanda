'use client';
// Agenda (decisões 46 a 49): Hoje, semana (domingo a sábado) e mês, com o heatmap da carga pendente, os marcos das demandas (vencimento, acompanhamento, retorno do setor),
// os compromissos próprios e os dias indisponíveis. Toda a lógica de datas e de carga fica em src/lib/agenda.ts e eventos.ts (testada à parte); aqui só se desenha.
// Nada de relógio na renderização: a data de hoje vem do contexto, e a hora de agora só existe depois de montar no navegador.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as TeclaReact } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { ChipEspera } from './cartoes';
import { diasDesde, plural, titulo, type Demanda } from '@/lib/demandas';
import { diaDaSemana, somarDias, type DiaIndisponivel } from '@/lib/prazos';
import { horarioDe, sobrepostosA, type Evento } from '@/lib/eventos';
import {
  anoMes, cargaPorDia, dataPorExtenso, descreverDia, diaDoMes, fimDeSemana, gradeMes, itensDoDia, LIMIARES_CARGA, marcosPorDia, nivelDaCarga, nomeLongoDoDia, NOMES_MES, panorama,
  pendenciasSemPrazo, primeiroDoMes, ROTULO_MARCO, ROTULO_NIVEL, rotuloSemana, SEMANA_INICIAIS, SEMANA_NOMES, semanaDe, somarMeses, tituloMes, diasNoMes, type CargaDia, type Marco, type NivelCarga, type OpcoesAgenda,
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

function lerPrefs(): Preferencias { try { const v = localStorage.getItem(CHAVE); return v ? (JSON.parse(v) as Preferencias) : {}; } catch { return {}; } }
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

// ---------- detalhe do dia ----------
function DetalheDia({ data, o, cat, concluidas, vazioTexto }: { data: string; o: OpcoesAgenda; cat: Categoria; concluidas: boolean; vazioTexto?: string }) {
  const { abrirJanela, hoje } = useApp();
  const itens = itensDoDia(data, { ...o, demandas: cat === 'eventos' ? [] : o.demandas, eventos: cat === 'demandas' ? [] : o.eventos });
  const grupos = agruparPorDemanda(itens.marcos), eventos = comConflitos(itens.eventos);
  const vazio = !itens.eventos.length && !grupos.length && !itens.indisponiveis.length;
  return (
    <section className="agd-painel agd-detalhe" aria-labelledby="agd-det-t" data-data={data}>
      <header className="agd-cab">
        <div><h3 id="agd-det-t">{maiuscula(dataPorExtenso(data))}</h3><p className="agd-sub">{data === hoje ? 'Hoje' : data < hoje ? 'Dia que já passou' : `Daqui a ${plural(diasDesde(hoje, data), 'dia')}`}</p></div>
        <button type="button" className="btn mini" onClick={() => abrirJanela({ t: 'evento', data })}><Icone nome="plus" />Novo evento neste dia</button>
      </header>
      {itens.indisponiveis.map((x) => <ItemIndisponivel key={x.id} x={x} />)}
      {eventos.length ? <><h4 className="agd-h4">Compromissos e lembretes</h4>{eventos.map(({ e, c }) => <ItemEvento key={e.id} e={e} conflitos={c} />)}</> : null}
      {grupos.length ? <><h4 className="agd-h4">Demandas e acompanhamentos</h4>{grupos.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={concluidas} />)}</> : null}
      {vazio ? <p className="agd-vazio">{vazioTexto ?? 'Nada programado para este dia.'}</p> : null}
    </section>
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
      </ul>
      <div className="agd-escala" role="group" aria-label="Escala de pendências">
        <span>Menos pendências</span>
        <ul>{NIVEIS.map((n) => <li key={n} title={`${FAIXA_NIVEL[n]} ${n === 'zero' ? 'pendências' : 'pendências no dia'}`}><i className="agd-amostra" data-nivel={n} aria-hidden="true" /><small>{FAIXA_NIVEL[n]}</small></li>)}</ul>
        <span>Mais pendências</span>
      </div>
    </footer>
  );
}

function GradeMes({ dia, hoje, carga, eventosPorData, indispPorData, escolher }: { dia: string; hoje: string; carga: Map<string, CargaDia>; eventosPorData: Map<string, number>; indispPorData: Map<string, DiaIndisponivel[]>; escolher: (d: string, foco?: boolean) => void }) {
  const { ano, mes } = anoMes(dia);
  const semanas = useMemo(() => gradeMes(ano, mes), [ano, mes]);
  const gridRef = useRef<HTMLDivElement>(null);
  const focar = useRef(false);
  useEffect(() => { if (focar.current) { focar.current = false; gridRef.current?.querySelector<HTMLElement>(`[data-data="${dia}"]`)?.focus(); } }, [dia]);
  const tecla = (e: TeclaReact<HTMLDivElement>) => {
    const passo: Record<string, string> = { ArrowLeft: somarDias(dia, -1), ArrowRight: somarDias(dia, 1), ArrowUp: somarDias(dia, -7), ArrowDown: somarDias(dia, 7), Home: somarDias(dia, -diaDaSemana(dia)), End: somarDias(dia, 6 - diaDaSemana(dia)), PageUp: somarMeses(dia, -1), PageDown: somarMeses(dia, 1) };
    const alvo = passo[e.key];
    if (!alvo || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); focar.current = true; escolher(alvo);
  };
  return (
    <div className="agd-grade" role="grid" aria-label={`Calendário de ${tituloMes(dia)}`} ref={gridRef} onKeyDown={tecla}>
      <div className="agd-linha-sem" role="row">{SEMANA_INICIAIS.map((l, i) => <div key={i} className="agd-cabsem" role="columnheader"><abbr title={SEMANA_NOMES[i]}>{l}</abbr></div>)}</div>
      {semanas.map((sem, i) => (
        <div key={i} className="agd-linha-sem" role="row">
          {sem.map((d, j) => {
            if (!d) return <div key={j} className="agd-vaz" role="gridcell" aria-hidden="true" />;
            const c = carga.get(d), sel = d === dia, nEv = eventosPorData.get(d) ?? 0, ind = indispPorData.get(d) ?? [];
            const nivel = nivelDaCarga(c?.carga ?? 0);
            return (
              <div key={j} role="gridcell" aria-selected={sel}>
                <button type="button" className="agd-cel" data-data={d} data-nivel={nivel} data-hoje={d === hoje || undefined} data-sel={sel || undefined} data-atrasada={c?.atrasada || undefined} data-fds={fimDeSemana(d) || undefined} data-indisp={ind.length || undefined}
                  tabIndex={sel ? 0 : -1} aria-current={d === hoje ? 'date' : undefined} aria-label={descreverDia(d, { carga: c, eventos: nEv, indisponiveis: ind, hoje, selecionado: sel })} onClick={() => escolher(d)}>
                  <span className="agd-num">{diaDoMes(d)}</span>
                  {c?.carga ? <span className="agd-qtd" aria-hidden="true">{c.carga}</span> : null}
                  {nEv ? <i className="agd-ev" aria-hidden="true" /> : null}
                  {c?.atrasada ? <i className="agd-atr" aria-hidden="true" /> : null}
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
  const { demandas, dias, eventos, hoje, carregando, carregandoEventos, erroEventos, recarregarEventos, abrirJanela } = useApp();
  const [modo, setModo] = useState<Modo>('mes');
  const [cat, setCat] = useState<Categoria>('tudo');
  const [concluidas, setConcluidas] = useState(false);
  const [finalizadas, setFinalizadas] = useState(false);
  const [data, setData] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const dia = data ?? hoje;

  // Lê as preferências guardadas só neste navegador, depois da hidratação (no servidor elas não existem). Sem preferência salva, o celular começa em Hoje.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = lerPrefs();
    if (p.modo) setModo(p.modo); else if (matchMedia('(hover: none), (pointer: coarse)').matches && matchMedia('(max-width: 900px)').matches) setModo('hoje');
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
  const eventosPorData = useMemo(() => { const m = new Map<string, number>(); for (const e of eventosVisiveis) m.set(e.data, (m.get(e.data) ?? 0) + 1); return m; }, [eventosVisiveis]);
  const indispPorData = useMemo(() => { const m = new Map<string, DiaIndisponivel[]>(); for (const x of dias) m.set(x.data, [...(m.get(x.data) ?? []), x]); return m; }, [dias]);

  const { ano, mes } = anoMes(dia);
  const semana = useMemo(() => semanaDe(dia), [dia]);
  const periodo = modo === 'mes' ? { de: primeiroDoMes(dia), ate: `${ano}-${String(mes).padStart(2, '0')}-${String(diasNoMes(ano, mes)).padStart(2, '0')}` } : modo === 'semana' ? { de: semana[0], ate: semana[6] } : { de: dia, ate: dia };
  const pan = useMemo(() => panorama(carga, eventosVisiveis, dias, hoje, periodo.de, periodo.ate), [carga, eventosVisiveis, dias, hoje, periodo.de, periodo.ate]);

  const passo = (n: 1 | -1) => setData(modo === 'mes' ? somarMeses(dia, n) : somarDias(dia, modo === 'semana' ? 7 * n : n));
  const rotuloPeriodo = modo === 'mes' ? maiuscula(tituloMes(dia)) : modo === 'semana' ? rotuloSemana(semana) : maiuscula(dataPorExtenso(dia));
  const nomePeriodo = modo === 'mes' ? NOMES_MES[mes - 1] : modo === 'semana' ? 'a semana' : 'o dia';
  const aguardando = carregando || carregandoEventos;

  return (
    <div className="agd" data-modo={modo}>
      <div className="pagehead"><h1>Agenda</h1><p>Prazos, retornos e compromissos, juntos.</p></div>

      <div className="agd-barra">
        <div className="opcoes" role="group" aria-label="Visão da agenda">{MODOS.map(([k, n]) => <button key={k} type="button" aria-pressed={modo === k} onClick={() => setModo(k)}>{n}</button>)}</div>
        <div className="agd-nav" role="group" aria-label="Período">
          <button type="button" className="icbtn-s agd-ant" aria-label={modo === 'mes' ? 'Mês anterior' : modo === 'semana' ? 'Semana anterior' : 'Dia anterior'} onClick={() => passo(-1)}><Icone nome="chevron-right" /></button>
          <button type="button" className="btn mini" onClick={() => setData(null)} disabled={data === null || data === hoje} aria-label="Voltar para hoje">Ir a hoje</button>
          <button type="button" className="icbtn-s" aria-label={modo === 'mes' ? 'Próximo mês' : modo === 'semana' ? 'Próxima semana' : 'Próximo dia'} onClick={() => passo(1)}><Icone nome="chevron-right" /></button>
          <label className="agd-data"><span className="sr-only">Ir para a data</span><input type="date" value={dia} aria-label="Ir para a data" onChange={(e) => { if (e.target.value) setData(e.target.value); }} /></label>
        </div>
        <button type="button" className="btn pri agd-novo" onClick={() => abrirJanela({ t: 'evento', data: dia })}><Icone nome="plus" />Novo evento</button>
      </div>

      <div className="agd-filtros">
        <div className="opcoes" role="group" aria-label="Mostrar na agenda">{CATEGORIAS.map(([k, n]) => <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}>{n}</button>)}</div>
        <label className="agd-chk"><input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} />Tarefas concluídas</label>
        <label className="agd-chk"><input type="checkbox" checked={finalizadas} onChange={(e) => setFinalizadas(e.target.checked)} />Demandas finalizadas</label>
      </div>

      {erroEventos ? <div className="erro-carga" role="alert"><b>Não foi possível carregar os eventos.</b><span>{erroEventos}</span><button className="btn mini" onClick={() => void recarregarEventos()}>Tentar de novo</button></div> : null}

      <section className="agd-resumo" aria-label="Resumo do período">
        <div>
          <h2 className="agd-periodo" aria-live="polite">{rotuloPeriodo}</h2>
          {verDemandas ? (
            <p className="agd-grande"><b data-total-pendencias>{aguardando ? '–' : pan.pendencias}</b> {pan.pendencias === 1 ? 'pendência' : 'pendências'} {modo === 'hoje' ? 'neste dia' : modo === 'semana' ? 'nesta semana' : `em ${NOMES_MES[mes - 1]}`}</p>
          ) : <p className="agd-grande"><b>{aguardando ? '–' : pan.compromissos}</b> {pan.compromissos === 1 ? 'compromisso' : 'compromissos'}</p>}
        </div>
        <ul className="agd-chips-res">
          {verDemandas ? <li className="chip neutro">{plural(pan.demandas, 'demanda')}</li> : null}
          {verDemandas && pan.atrasadas ? <li className="chip perigo">{plural(pan.atrasadas, 'atrasada')}</li> : null}
          {verEventos ? <li className="chip neutro">{plural(pan.compromissos, 'compromisso')}</li> : null}
        </ul>
      </section>

      {aguardando ? <div className="vazio-c" role="status">Carregando a agenda...</div> : null}

      {!aguardando && modo === 'mes' ? (
        <div className="agd-corpo">
          <section className="agd-painel agd-cal" aria-label={`Calendário de ${tituloMes(dia)}`}>
            <GradeMes dia={dia} hoje={hoje} carga={carga} eventosPorData={eventosPorData} indispPorData={indispPorData} escolher={(d) => setData(d)} />
            <Legenda />
          </section>
          <DetalheDia data={dia} o={opcoes} cat={cat} concluidas={concluidas} />
        </div>
      ) : null}

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

