'use client';
// Agenda (decisões 46 a 49, refinada em 12/11/2026): Hoje, semana (segunda a domingo desde a decisão 64) e mês, com o heatmap da carga pendente, os marcos das demandas (vencimento, acompanhamento,
// retorno do setor), os compromissos próprios e os dias indisponíveis. Toda a lógica de datas e de carga fica em src/lib/agenda.ts e eventos.ts (testada à parte); aqui só se desenha.
// Nada de relógio na renderização: a data de hoje vem do contexto, e a hora de agora só existe depois de montar no navegador.
// Identidade dos itens: forma + rótulo + cor. Compromisso = quadrado azul; vencimento = losango; acompanhamento = círculo vazado; retorno do setor = triângulo (os três em amarelo, a cor das demandas);
// atraso é destaque (borda e rótulo vermelhos) sobre a identidade da demanda, nunca troca a cor dela. Dia inteiro, feriado e dia indisponível têm cada um a sua faixa.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { ChipEspera } from './cartoes';
import { diasDesde, plural, titulo, type Demanda } from '@/lib/demandas';
import { somarDias, type DiaIndisponivel } from '@/lib/prazos';
import { horarioDe, sobrepostosA, type Evento } from '@/lib/eventos';
import { eObjeto } from '@/lib/armazenamento';
import {
  anoMes, cargaPorDia, dataPorExtenso, descreverDia, diaDoMes, diasNoMes, fimDeSemana, gradeMes, indiceSemana, itensDoDia, LIMIARES_CARGA, marcosPorDia, nivelDaCarga, nomeLongoDoDia, NOMES_MES, panorama,
  pendenciasSemPrazo, primeiroDoMes, ROTULO_MARCO, ROTULO_NIVEL, rotuloSemana, SEMANA_ABREVIADAS, SEMANA_NOMES, semanaDe, somarMeses, tituloMes, type CargaDia, type ItensDoDia, type Marco, type NivelCarga,
  type OpcoesAgenda, type TipoMarco,
} from '@/lib/agenda';

type Modo = 'hoje' | 'semana' | 'mes';
type Categoria = 'tudo' | 'demandas' | 'eventos';
type Preferencias = { modo?: Modo; cat?: Categoria; concluidas?: boolean; finalizadas?: boolean };
type Densidade = 'cheio' | 'linha' | 'mini';
type FormaItem = 'quadrado' | 'losango' | 'circulo' | 'triangulo' | 'faixa';
const CHAVE = 'dmanda:agenda';
const MODOS: [Modo, string][] = [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês']];
const CATEGORIAS: [Categoria, string][] = [['tudo', 'Tudo'], ['demandas', 'Demandas'], ['eventos', 'Compromissos']];
const FORMA_MARCO: Record<TipoMarco, FormaItem> = { vencimento: 'losango', acompanhamento: 'circulo', retorno: 'triangulo' };
const pl = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const NIVEIS: NivelCarga[] = ['zero', 'baixa', 'media', 'alta'];
const FAIXA_NIVEL: Record<NivelCarga, string> = { zero: '0', baixa: `${LIMIARES_CARGA.baixa} a ${LIMIARES_CARGA.media - 1}`, media: `${LIMIARES_CARGA.media} a ${LIMIARES_CARGA.alta - 1}`, alta: `${LIMIARES_CARGA.alta} ou mais` };
/** Itens por seção de um dia na grade da semana (no computador) antes do "+N mais". */
const LIMITE_COLUNA = 3;
/** Linhas curtas por célula do mês (no computador e no iPad) antes do "+N". */
const LINHAS_CELULA = 2;
const movimentoReduzido = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

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
/** A forma que acompanha cada tipo de item, para a identidade não depender só da cor. */
function Marca({ f, atrasado = false }: { f: FormaItem; atrasado?: boolean }) {
  return <i className="agd-forma" data-forma={f} data-atrasado={atrasado || undefined} aria-hidden="true" />;
}

/** Contexto de um marco: a forma, o rótulo do tipo e a situação (atrasado ou no prazo). */
function EtiquetaMarco({ m, hoje }: { m: Marco; hoje: string }) {
  return <span className="agd-tag" data-tipo={m.tipo} data-atrasado={m.atrasado || undefined}><Marca f={FORMA_MARCO[m.tipo]} atrasado={m.atrasado} />{ROTULO_MARCO[m.tipo]}{m.atrasado ? ` · atrasado há ${plural(diasDesde(m.data, hoje), 'dia')}` : ''}</span>;
}

/** Uma demanda no dia: os marcos dela que caem no dia (um item só, mesmo com dois marcos). Cheio: com notas e as tarefas pendentes, que se marcam aqui mesmo e atualizam a carga.
 *  Linha: compacto (Hoje), com as tarefas recolhidas. Mini: só o rótulo e o assunto (semana). */
function ItemDemanda({ marcos, hoje, concluidas, densidade = 'cheio' }: { marcos: Marco[]; hoje: string; concluidas: boolean; densidade?: Densidade }) {
  const { abrirJanela, marcarTarefa } = useApp();
  const d: Demanda = marcos[0].demanda;
  const pendentes = d.tarefas.filter((t) => !t.concluida).length;
  const tarefas = d.tarefas.filter((t) => concluidas || !t.concluida);
  const lista = (
    <ul className="agd-tarefas">
      {tarefas.map((t) => (
        <li key={t.id}><label><input type="checkbox" checked={t.concluida} onChange={(e) => void marcarTarefa(t.id, e.target.checked)} /><span className={t.concluida ? 'feita' : undefined}>{t.texto}</span></label></li>
      ))}
    </ul>
  );
  const chipTarefas = pendentes ? <span className="chip neutro">{pl(pendentes, 'tarefa pendente', 'tarefas pendentes')}</span> : d.etapa !== 'Finalizado' ? <span className="chip neutro">{d.tarefas.length ? 'Todas as tarefas concluídas' : 'Sem tarefas'}</span> : null;
  return (
    <article className="agd-item agd-demanda" data-dens={densidade} data-atrasada={marcos.some((m) => m.atrasado) || undefined} data-id={d.id}>
      <button type="button" className="agd-abrir" onClick={() => abrirJanela({ t: 'editar', id: d.id })} aria-label={`Abrir a demanda: ${titulo(d)}, ${d.assunto}`}>
        <span className="agd-tags">{marcos.map((m) => <EtiquetaMarco key={m.tipo} m={m} hoje={hoje} />)}</span>
        <span className="agd-tit">{d.assunto}</span>
        <span className="agd-sub mono">{titulo(d)}{d.setor && d.etapa === 'Aguardando retorno' ? ` · ${d.setor}` : ''} · {d.etapa === 'Finalizado' ? 'Finalizada' : d.etapa}</span>
      </button>
      {densidade === 'mini' ? null : (
        <div className="agd-chips"><ChipEspera d={d} />{densidade === 'linha' && tarefas.length ? null : chipTarefas}</div>
      )}
      {densidade === 'cheio' && marcos.some((m) => m.tipo !== 'vencimento') ? <p className="agd-nota">{marcos.filter((m) => m.tipo !== 'vencimento').map((m) => `${ROTULO_MARCO[m.tipo]}: ${m.detalhe}.`).join(' ')}</p> : null}
      {densidade === 'cheio' && tarefas.length ? lista : null}
      {densidade === 'linha' && tarefas.length ? <details className="agd-tdet"><summary>{pendentes ? pl(pendentes, 'tarefa pendente', 'tarefas pendentes') : pl(tarefas.length, 'tarefa concluída', 'tarefas concluídas')}</summary>{lista}</details> : null}
    </article>
  );
}

/** Um compromisso: o quadrado azul (ou a faixa, se for de dia inteiro) e o horário, com o aviso de sobreposição quando há. */
function ItemEvento({ e, conflitos, densidade = 'cheio' }: { e: Evento; conflitos: Evento[]; densidade?: Densidade }) {
  const { abrirJanela } = useApp();
  return (
    <article className="agd-item agd-evento" data-tipo={e.tipo} data-dia={e.dia_inteiro || undefined} data-dens={densidade} data-id={e.id}>
      <button type="button" className="agd-abrir" onClick={() => abrirJanela({ t: 'evento', id: e.id })} aria-label={`Abrir o compromisso: ${e.titulo}, ${horarioDe(e)}`}>
        <span className="agd-hora mono"><Marca f={e.dia_inteiro ? 'faixa' : 'quadrado'} />{horarioDe(e)}</span>
        <span className="agd-tit">{e.titulo}</span>
        {densidade === 'mini' ? null : <span className="agd-sub">{densidade === 'cheio' ? `Compromisso · ${e.tipo}` : e.tipo}{densidade === 'cheio' && e.descricao ? ` · ${e.descricao.split('\n')[0].slice(0, 80)}` : ''}</span>}
      </button>
      {conflitos.length ? <p className="agd-alerta" role="note"><Icone nome="alert" />Sobrepõe com {conflitos.map((c) => `${c.titulo} (${horarioDe(c)})`).join(', ')}</p> : null}
    </article>
  );
}

/** Dia indisponível cadastrado em Configurações: feriado (listrado) ou indisponibilidade por evento externo (tracejado). Diferente do compromisso de dia inteiro (azul, com faixa). */
function ItemIndisponivel({ x }: { x: DiaIndisponivel }) {
  const feriado = x.categoria === 'Feriado';
  return <p className="agd-item agd-indisp" data-cat={feriado ? 'feriado' : 'indisponivel'}><Icone nome="calendar" /><span><b>{feriado ? 'Feriado' : 'Dia indisponível'}:</b> {x.descricao}</span></p>;
}

/** Os eventos de uma lista com os conflitos de cada um, calculados só entre os eventos do mesmo dia. */
const comConflitos = (l: Evento[]) => l.map((e) => ({ e, c: e.dia_inteiro ? [] : sobrepostosA(e, l) }));
function agruparPorDemanda(marcos: Marco[]): Marco[][] {
  const mapa = new Map<string, Marco[]>();
  for (const m of marcos) mapa.set(m.demanda.id, [...(mapa.get(m.demanda.id) ?? []), m]);
  return [...mapa.values()];
}

// ---------- menu Mostrar ----------
/** Um só menu para o que a Agenda mostra: escolha única entre Tudo, Demandas e Compromissos, e dois controles independentes para incluir tarefas concluídas e demandas finalizadas. */
function Mostrar({ cat, setCat, concluidas, setConcluidas, finalizadas, setFinalizadas }: { cat: Categoria; setCat: (c: Categoria) => void; concluidas: boolean; setConcluidas: (v: boolean) => void; finalizadas: boolean; setFinalizadas: (v: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null), botao = useRef<HTMLButtonElement>(null);
  const id = useId();
  const ativos = (cat !== 'tudo' ? 1 : 0) + (concluidas ? 1 : 0) + (finalizadas ? 1 : 0);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); botao.current?.focus(); } };
    document.addEventListener('pointerdown', fora, true); document.addEventListener('keydown', tecla, true);
    raiz.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
    return () => { document.removeEventListener('pointerdown', fora, true); document.removeEventListener('keydown', tecla, true); };
  }, [aberto]);
  return (
    <div className="agd-mostrar-w" ref={raiz}>
      <button ref={botao} type="button" className="btn mini agd-mostrar-b" aria-haspopup="dialog" aria-expanded={aberto} aria-controls={aberto ? `${id}-p` : undefined} aria-label={ativos ? `Mostrar, ${ativos} ajustes ativos` : 'Mostrar'} onClick={() => setAberto((a) => !a)}>
        <Icone nome="filtro" /><span>Mostrar</span>{ativos ? <i className="agd-mostrar-n" aria-hidden="true">{ativos}</i> : null}
      </button>
      {aberto ? (
        <div className="agd-mostrar" id={`${id}-p`} role="dialog" aria-label="Mostrar na agenda">
          <fieldset><legend>Mostrar</legend>{CATEGORIAS.map(([k, n]) => <label key={k} className="agd-op"><input type="radio" name={`${id}-cat`} checked={cat === k} onChange={() => setCat(k)} /><span>{n}</span></label>)}</fieldset>
          <fieldset><legend>Incluir também</legend>
            <label className="agd-op"><input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} /><span>Tarefas concluídas</span></label>
            <label className="agd-op"><input type="checkbox" checked={finalizadas} onChange={(e) => setFinalizadas(e.target.checked)} /><span>Demandas finalizadas</span></label>
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}

// ---------- detalhe do dia ----------
function DetalheDia({ data, itens, concluidas, vazioTexto }: { data: string; itens: ItensDoDia; concluidas: boolean; vazioTexto?: string }) {
  const { abrirJanela, hoje } = useApp();
  const grupos = agruparPorDemanda(itens.marcos), eventos = comConflitos(itens.eventos);
  const vazio = !itens.eventos.length && !grupos.length && !itens.indisponiveis.length;
  return (
    <section className="agd-painel agd-detalhe" aria-labelledby="agd-det-t" data-data={data}>
      <header className="agd-cab">
        <div><p className="agd-eyebrow">Dia selecionado</p><h3 id="agd-det-t" tabIndex={-1}>{maiuscula(dataPorExtenso(data))}</h3><p className="agd-sub">{data === hoje ? 'Hoje' : data < hoje ? 'Dia que já passou' : `Daqui a ${plural(diasDesde(hoje, data), 'dia')}`}</p></div>
        <button type="button" className="btn mini" onClick={() => abrirJanela({ t: 'evento', data })}><Icone nome="plus" />Novo evento neste dia</button>
      </header>
      {itens.indisponiveis.map((x) => <ItemIndisponivel key={x.id} x={x} />)}
      {eventos.length ? <><h4 className="agd-h4">Compromissos e lembretes</h4>{eventos.map(({ e, c }) => <ItemEvento key={e.id} e={e} conflitos={c} />)}</> : null}
      {grupos.length ? <><h4 className="agd-h4">Marcos das demandas</h4>{grupos.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={concluidas} />)}</> : null}
      {vazio ? <p className="agd-vazio">{vazioTexto ?? 'Nada programado para este dia.'}</p> : null}
    </section>
  );
}

// ---------- painéis auxiliares (recolhíveis) ----------
/** Painel que se recolhe pelo título; no celular começa recolhido para a agenda aparecer primeiro. O conteúdo continua na página (só fica oculto). */
function Recolhivel({ id, titulo: t, children }: { id: string; titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- o aparelho só é conhecido depois da hidratação (no servidor e no primeiro desenho o painel fica aberto)
  useEffect(() => { try { if (matchMedia('(max-width: 700px)').matches) setAberto(false); } catch { /* sem matchMedia */ } }, []);
  return (
    <section className="agd-painel agd-aux" data-aberto={aberto} aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="agd-aux-t"><button type="button" aria-expanded={aberto} aria-controls={`${id}-c`} onClick={() => setAberto((a) => !a)}><span>{t}</span><Icone nome="chevron-right" /></button></h3>
      <div id={`${id}-c`} className="agd-aux-c" hidden={!aberto}>{children}</div>
    </section>
  );
}

function PainelDiasCheios({ pan, aoVer, rotulo }: { pan: ReturnType<typeof panorama>; aoVer: (d: string) => void; rotulo: string }) {
  return (
    <Recolhivel id="agd-cheios" titulo={`Onde ${rotulo} aperta`}>
      <p className="agd-sub">Dias de carga média ou alta, para antecipar ou redistribuir.</p>
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
    </Recolhivel>
  );
}

function PainelSemPrazo({ lista }: { lista: Demanda[] }) {
  const { abrirJanela } = useApp();
  return (
    <Recolhivel id="agd-sem" titulo={`Pendências sem prazo${lista.length ? ` (${lista.length})` : ''}`}>
      <p className="agd-sub">{lista.length ? `${pl(lista.length, 'demanda aberta', 'demandas abertas')} sem nenhuma data. Nada foi inventado para elas.` : 'Toda demanda aberta tem alguma data.'}</p>
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
    </Recolhivel>
  );
}

// ---------- mês ----------
function Legenda() {
  return (
    <footer className="agd-leg">
      <ul className="agd-marcas" aria-label="Marcas e formas do calendário">
        <li><i className="agd-m-hoje" aria-hidden="true" />Hoje</li>
        <li><i className="agd-m-atr" aria-hidden="true" />Com atraso</li>
        <li><Marca f="quadrado" />Compromisso</li>
        <li><Marca f="losango" />Vencimento</li>
        <li><Marca f="circulo" />Acompanhar</li>
        <li><Marca f="triangulo" />Retorno do setor</li>
      </ul>
      <div className="agd-escala" role="group" aria-label="Escala de pendências">
        <span>Menos pendências</span>
        <ul>{NIVEIS.map((n) => <li key={n} title={`${FAIXA_NIVEL[n]} ${n === 'zero' ? 'pendências' : 'pendências no dia'}`}><i className="agd-amostra" data-nivel={n} aria-hidden="true" /><small>{FAIXA_NIVEL[n]}</small></li>)}</ul>
        <span>Mais pendências</span>
      </div>
    </footer>
  );
}

type LinhaCelula = { chave: string; forma: FormaItem; texto: string; atrasado?: boolean };
/** As linhas curtas de um dia do mês: um compromisso e um marco quando há dos dois, senão os dois primeiros do que houver. O resto vira "+N". */
function linhasDoDia(it: ItensDoDia | undefined): { linhas: LinhaCelula[]; total: number } {
  if (!it) return { linhas: [], total: 0 };
  const ev: LinhaCelula[] = it.eventos.map((e) => ({ chave: e.id, forma: e.dia_inteiro ? 'faixa' : 'quadrado', texto: e.dia_inteiro ? e.titulo : `${e.inicio} ${e.titulo}` }));
  const mc: LinhaCelula[] = agruparPorDemanda(it.marcos).map((g) => ({ chave: g[0].demanda.id, forma: FORMA_MARCO[g[0].tipo], texto: g[0].demanda.assunto, atrasado: g.some((m) => m.atrasado) }));
  const total = ev.length + mc.length;
  const linhas = ev.length && mc.length ? [ev[0], mc[0]] : [...ev, ...mc].slice(0, LINHAS_CELULA);
  return { linhas, total };
}

function GradeMes({ dia, hoje, carga, itens, eventosPorData, indispPorData, escolher, verDia }: { dia: string; hoje: string; carga: Map<string, CargaDia>; itens: Map<string, ItensDoDia>; eventosPorData: Map<string, number>; indispPorData: Map<string, DiaIndisponivel[]>; escolher: (d: string) => void; verDia: (d: string) => void }) {
  const { ano, mes } = anoMes(dia);
  const semanas = useMemo(() => gradeMes(ano, mes), [ano, mes]);
  const gridRef = useRef<HTMLDivElement>(null);
  const focar = useRef(false);
  useEffect(() => { if (focar.current) { focar.current = false; gridRef.current?.querySelector<HTMLElement>(`[data-data="${dia}"]`)?.focus(); } }, [dia]);
  const tecla = (e: TeclaReact<HTMLDivElement>) => {
    const passo: Record<string, string> = { ArrowLeft: somarDias(dia, -1), ArrowRight: somarDias(dia, 1), ArrowUp: somarDias(dia, -7), ArrowDown: somarDias(dia, 7), Home: somarDias(dia, -indiceSemana(dia)), End: somarDias(dia, 6 - indiceSemana(dia)), PageUp: somarMeses(dia, -1), PageDown: somarMeses(dia, 1) };
    const alvo = passo[e.key];
    if (!alvo || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); focar.current = true; escolher(alvo);
  };
  return (
    <div className="agd-grade" role="grid" aria-label={`Calendário de ${tituloMes(dia)}`} ref={gridRef} onKeyDown={tecla}>
      <div className="agd-linha-sem" role="row">{SEMANA_ABREVIADAS.map((l, i) => <div key={i} className="agd-cabsem" role="columnheader"><abbr title={SEMANA_NOMES[i]}>{l}</abbr></div>)}</div>
      {semanas.map((sem, i) => (
        <div key={i} className="agd-linha-sem" role="row">
          {sem.map((d, j) => {
            if (!d) return <div key={j} className="agd-vaz" role="gridcell" aria-hidden="true" />;
            const c = carga.get(d), sel = d === dia, nEv = eventosPorData.get(d) ?? 0, ind = indispPorData.get(d) ?? [];
            const nivel = nivelDaCarga(c?.carga ?? 0);
            const { linhas, total } = linhasDoDia(itens.get(d));
            const resto = total - linhas.length;
            return (
              <div key={j} role="gridcell" aria-selected={sel} className="agd-gc">
                <button type="button" className="agd-cel" data-data={d} data-nivel={nivel} data-hoje={d === hoje || undefined} data-sel={sel || undefined} data-atrasada={c?.atrasada || undefined} data-fds={fimDeSemana(d) || undefined} data-indisp={ind.length || undefined}
                  tabIndex={sel ? 0 : -1} aria-current={d === hoje ? 'date' : undefined} aria-label={descreverDia(d, { carga: c, eventos: nEv, indisponiveis: ind, hoje, selecionado: sel })} onClick={() => escolher(d)}>
                  <span className="agd-num">{diaDoMes(d)}</span>
                  {c?.carga ? <span className="agd-qtd" aria-hidden="true">{c.carga}</span> : null}
                  {nEv ? <i className="agd-ev" aria-hidden="true" /> : null}
                  {c?.atrasada ? <i className="agd-atr" aria-hidden="true" /> : null}
                  {linhas.length ? <span className="agd-linhas" aria-hidden="true">{linhas.map((l) => <span key={l.chave} className="agd-l" data-atrasado={l.atrasado || undefined}><Marca f={l.forma} /><span className="agd-l-t">{l.texto}</span></span>)}</span> : null}
                </button>
                {resto > 0 ? <button type="button" className="agd-mais" tabIndex={-1} aria-label={`Ver o dia completo: mais ${pl(resto, 'item', 'itens')} em ${dataPorExtenso(d)}`} onClick={() => verDia(d)}>+{resto}</button> : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------- semana ----------
function ColunaDia({ data, itens, hoje, sel, carga, escolher }: { data: string; itens: ItensDoDia; hoje: string; sel: boolean; carga?: CargaDia; escolher: (d: string) => void }) {
  const { abrirJanela } = useApp();
  const [aberto, setAberto] = useState(false);
  const grupos = agruparPorDemanda(itens.marcos), eventos = comConflitos(itens.eventos);
  const nivel = nivelDaCarga(carga?.carga ?? 0);
  const vazio = !itens.indisponiveis.length && !eventos.length && !grupos.length;
  const extra = Math.max(0, eventos.length - LIMITE_COLUNA) + Math.max(0, grupos.length - LIMITE_COLUNA);
  return (
    <section id={`agd-d-${data}`} className="agd-dia" data-data={data} data-nivel={nivel} data-hoje={data === hoje || undefined} data-sel={sel || undefined} data-fds={fimDeSemana(data) || undefined} data-vazio={vazio || undefined} data-aberto={aberto || undefined}
      aria-label={descreverDia(data, { carga, eventos: itens.eventos.length, indisponiveis: itens.indisponiveis, hoje })}>
      <header className="agd-dia-cab">
        <button type="button" className="agd-dia-sel" onClick={() => escolher(data)} aria-pressed={sel}>
          <span className="agd-dia-nome">{nomeLongoDoDia(data).replace('-feira', '')}</span><span className="agd-dia-num">{diaDoMes(data)}</span>
        </button>
        <button type="button" className="icbtn-s" aria-label={`Novo evento em ${dataPorExtenso(data)}`} title="Novo evento neste dia" onClick={() => abrirJanela({ t: 'evento', data })}><Icone nome="plus" /></button>
        {carga?.carga ? <span className="agd-dia-carga" data-nivel={nivel} title={ROTULO_NIVEL[nivel]}><i className="agd-amostra" data-nivel={nivel} aria-hidden="true" />{carga.carga} {carga.carga === 1 ? 'pendência' : 'pendências'}{carga.atrasada ? <i className="agd-atr" title="Com atraso" /> : null}</span> : null}
      </header>
      <div className="agd-dia-corpo">
        {itens.indisponiveis.map((x) => <ItemIndisponivel key={x.id} x={x} />)}
        {eventos.length ? <div className="agd-dia-sec" data-sec="compromissos"><h4 className="agd-h4">Compromissos</h4>{eventos.map(({ e, c }) => <ItemEvento key={e.id} e={e} conflitos={c} densidade="mini" />)}</div> : null}
        {grupos.length ? <div className="agd-dia-sec" data-sec="prazos"><h4 className="agd-h4">Prazos e marcos</h4>{grupos.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={false} densidade="mini" />)}</div> : null}
        {extra ? <button type="button" className="btn mini agd-mais-dia" aria-expanded={aberto} aria-label={aberto ? `Mostrar menos itens de ${dataPorExtenso(data)}` : `Mostrar mais ${pl(extra, 'item', 'itens')} de ${dataPorExtenso(data)}`} onClick={() => setAberto((a) => !a)}>{aberto ? 'Mostrar menos' : `+${extra} mais`}</button> : null}
        {vazio ? <p className="agd-vazio">Livre</p> : null}
      </div>
    </section>
  );
}

/** Faixa dos sete dias (iPad em pé e celular): escolhe o dia e leva à seção dele na lista agrupada. */
function FaixaSemana({ semana, hoje, dia, carga, eventosPorData, indispPorData, irPara }: { semana: string[]; hoje: string; dia: string; carga: Map<string, CargaDia>; eventosPorData: Map<string, number>; indispPorData: Map<string, DiaIndisponivel[]>; irPara: (d: string) => void }) {
  return (
    <nav className="agd-faixa" aria-label="Dias da semana">
      {semana.map((d) => {
        const c = carga.get(d), nEv = eventosPorData.get(d) ?? 0, nivel = nivelDaCarga(c?.carga ?? 0);
        return (
          <button key={d} type="button" className="agd-faixa-d" data-data={d} data-nivel={nivel} data-hoje={d === hoje || undefined} data-sel={d === dia || undefined} data-fds={fimDeSemana(d) || undefined} aria-pressed={d === dia}
            aria-label={descreverDia(d, { carga: c, eventos: nEv, indisponiveis: indispPorData.get(d) ?? [], hoje, selecionado: d === dia })} onClick={() => irPara(d)}>
            <span className="agd-faixa-l">{SEMANA_ABREVIADAS[indiceSemana(d)]}</span><span className="agd-faixa-n">{diaDoMes(d)}</span>
            <span className="agd-faixa-b" aria-hidden="true"><i className="agd-amostra" data-nivel={nivel} />{nEv ? <i className="agd-ev" /> : null}{c?.atrasada ? <i className="agd-atr" /> : null}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ---------- página ----------
const diasDoMes = (iso: string) => { const { ano, mes } = anoMes(iso), p = `${ano}-${String(mes).padStart(2, '0')}`; return Array.from({ length: diasNoMes(ano, mes) }, (_, i) => `${p}-${String(i + 1).padStart(2, '0')}`); };

export function PaginaAgenda() {
  const { demandas, dias, eventos, hoje, carregando, carregandoEventos, erroEventos, erroCarga, recarregarEventos, abrirJanela } = useApp();
  const [modo, setModo] = useState<Modo>('mes');
  const [cat, setCat] = useState<Categoria>('tudo');
  const [concluidas, setConcluidas] = useState(false);
  const [finalizadas, setFinalizadas] = useState(false);
  const [data, setData] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [irAoDia, setIrAoDia] = useState(0);
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

  // "+N" do mês: seleciona o dia, põe o foco no título do dia completo e, se o painel do dia estiver abaixo da grade, rola até ele
  useEffect(() => {
    if (!irAoDia) return;
    const t = document.getElementById('agd-det-t');
    if (!t) return;
    t.focus({ preventScroll: true });
    const painel = t.closest<HTMLElement>('.agd-detalhe'), grade = document.querySelector('.agd-cal');
    if (painel && grade && painel.getBoundingClientRect().top >= grade.getBoundingClientRect().bottom - 4) painel.scrollIntoView({ block: 'nearest', behavior: movimentoReduzido() ? 'auto' : 'smooth' });
  }, [irAoDia]);

  const verDemandas = cat !== 'eventos', verEventos = cat !== 'demandas';
  const opcoes: OpcoesAgenda = useMemo(() => ({ demandas: verDemandas ? demandas : [], eventos: verEventos ? eventos : [], indisponiveis: dias, hoje, comFinalizadas: finalizadas }), [demandas, eventos, dias, hoje, finalizadas, verDemandas, verEventos]);
  const carga = useMemo(() => (verDemandas ? cargaPorDia(demandas, dias, hoje) : new Map<string, CargaDia>()), [verDemandas, demandas, dias, hoje]);
  const semPrazo = useMemo(() => pendenciasSemPrazo(demandas, dias, hoje), [demandas, dias, hoje]);
  const eventosPorData = useMemo(() => { const m = new Map<string, number>(); for (const e of opcoes.eventos) m.set(e.data, (m.get(e.data) ?? 0) + 1); return m; }, [opcoes.eventos]);
  const indispPorData = useMemo(() => { const m = new Map<string, DiaIndisponivel[]>(); for (const x of dias) m.set(x.data, [...(m.get(x.data) ?? []), x]); return m; }, [dias]);

  const { ano, mes } = anoMes(dia);
  const semana = useMemo(() => semanaDe(dia), [dia]);
  const periodo = modo === 'mes' ? { de: primeiroDoMes(dia), ate: `${ano}-${String(mes).padStart(2, '0')}-${String(diasNoMes(ano, mes)).padStart(2, '0')}` } : modo === 'semana' ? { de: semana[0], ate: semana[6] } : { de: dia, ate: dia };
  const pan = useMemo(() => panorama(carga, opcoes.eventos, dias, hoje, periodo.de, periodo.ate), [carga, opcoes.eventos, dias, hoje, periodo.de, periodo.ate]);
  // os itens de cada dia do período, calculados uma vez por mudança (o mês desenha até 31 células)
  const itens = useMemo(() => {
    const m = new Map<string, ItensDoDia>();
    for (const d of modo === 'mes' ? diasDoMes(dia) : modo === 'semana' ? semana : [dia]) m.set(d, itensDoDia(d, opcoes));
    return m;
  }, [modo, dia, semana, opcoes]);
  const itensDoDiaAtual = itens.get(dia) ?? itensDoDia(dia, opcoes);
  const atrasados = useMemo(() => (modo === 'hoje' && dia === hoje && verDemandas ? agruparPorDemanda(marcosAtrasados(opcoes.demandas, dias, hoje, dia)) : []), [modo, dia, hoje, verDemandas, opcoes.demandas, dias]);
  const gruposHoje = useMemo(() => (modo === 'hoje' ? agruparPorDemanda(itensDoDiaAtual.marcos) : []), [modo, itensDoDiaAtual]);

  const passo = (n: 1 | -1) => setData(modo === 'mes' ? somarMeses(dia, n) : somarDias(dia, modo === 'semana' ? 7 * n : n));
  const rotuloPeriodo = modo === 'mes' ? maiuscula(tituloMes(dia)) : modo === 'semana' ? rotuloSemana(semana) : maiuscula(dataPorExtenso(dia));
  const nomePeriodo = modo === 'mes' ? NOMES_MES[mes - 1] : modo === 'semana' ? 'a semana' : 'o dia';
  const aguardando = carregando || carregandoEventos;
  // a leitura de uma das partes falhou: os números dela não são zero, são desconhecidos (o erro e o botão de tentar de novo estão acima)
  const semDem = !!erroCarga, semEv = !!erroEventos;
  const noDia = modo === 'hoje' ? (dia === hoje ? 'com data de hoje' : 'com data neste dia') : modo === 'semana' ? 'com data nesta semana' : `com data em ${NOMES_MES[mes - 1]}`;
  const verDia = (d: string) => { setData(d); setIrAoDia((n) => n + 1); };
  const irParaDiaDaSemana = (d: string) => {
    setData(d);
    requestAnimationFrame(() => document.getElementById(`agd-d-${d}`)?.scrollIntoView({ block: 'start', behavior: movimentoReduzido() ? 'auto' : 'smooth' }));
  };

  return (
    <div className="agd" data-modo={modo}>
      <div className="pagehead"><h1>Agenda</h1><p>Prazos, retornos e compromissos, juntos.</p></div>

      <div className="agd-barra">
        <div className="agd-topo">
          <div className="agd-nav" role="group" aria-label="Período">
            <button type="button" className="icbtn-s agd-ant" aria-label={modo === 'mes' ? 'Mês anterior' : modo === 'semana' ? 'Semana anterior' : 'Dia anterior'} onClick={() => passo(-1)}><Icone nome="chevron-right" /></button>
            <h2 className="agd-periodo" aria-live="polite">{rotuloPeriodo}</h2>
            <button type="button" className="icbtn-s" aria-label={modo === 'mes' ? 'Próximo mês' : modo === 'semana' ? 'Próxima semana' : 'Próximo dia'} onClick={() => passo(1)}><Icone nome="chevron-right" /></button>
          </div>
          <label className="agd-data icbtn-s" title="Ir para a data"><Icone nome="calendar" /><span className="sr-only">Ir para a data</span><input type="date" value={dia} aria-label="Ir para a data" onChange={(e) => { if (e.target.value) setData(e.target.value); }} /></label>
          <button type="button" className="btn pri agd-novo" aria-label="Novo evento" onClick={() => abrirJanela({ t: 'evento', data: dia })}><Icone nome="plus" /><span>Novo evento</span></button>
        </div>
        <div className="agd-base">
          <div className="opcoes" role="group" aria-label="Visão da agenda">{MODOS.map(([k, n]) => <button key={k} type="button" aria-pressed={modo === k} onClick={() => setModo(k)}>{n}</button>)}</div>
          <button type="button" className="btn mini agd-irhoje" onClick={() => setData(null)} disabled={data === null || data === hoje} aria-label="Ir para hoje"><Icone nome="calendar" /><span>Ir para hoje</span></button>
          <Mostrar cat={cat} setCat={setCat} concluidas={concluidas} setConcluidas={setConcluidas} finalizadas={finalizadas} setFinalizadas={setFinalizadas} />
        </div>
      </div>

      {erroEventos ? <div className="erro-carga" role="alert"><b>Não foi possível carregar os eventos.</b><span>{erroEventos}</span><button className="btn mini" onClick={() => void recarregarEventos()}>Tentar de novo</button></div> : null}

      <section className="agd-resumo" aria-label="Resumo do período">
        <div>
          {verDemandas ? (
            <p className="agd-grande" title="Tarefas em aberto das demandas (uma por demanda sem tarefas), contadas uma só vez, na data mais próxima de cada demanda."><b data-total-pendencias>{aguardando || semDem ? '–' : pan.pendencias}</b> {pan.pendencias === 1 ? 'pendência' : 'pendências'} {noDia}</p>
          ) : <p className="agd-grande"><b>{aguardando || semEv ? '–' : pan.compromissos}</b> {pan.compromissos === 1 ? 'compromisso' : 'compromissos'} {noDia}</p>}
        </div>
        <ul className="agd-chips-res">
          {modo === 'hoje' ? (
            <>
              {verDemandas && !semDem ? <li className="chip neutro" title="Demandas que têm vencimento, acompanhamento ou retorno do setor neste dia">{plural(gruposHoje.length, 'demanda')} com marco {dia === hoje ? 'hoje' : 'no dia'}</li> : null}
              {verDemandas && !semDem && dia === hoje ? <li className={`chip ${atrasados.length ? 'perigo' : 'neutro'}`} title="Demandas com algum marco de dias anteriores ainda aberto">{plural(atrasados.length, 'atrasada')} de dias anteriores</li> : null}
              {verEventos && !semEv ? <li className="chip neutro">{plural(pan.compromissos, 'compromisso')} {dia === hoje ? 'hoje' : 'no dia'}</li> : null}
            </>
          ) : (
            <>
              {verDemandas && !semDem ? <li className="chip neutro" title="Demandas contadas uma só vez, na data mais próxima delas, dentro do período">{plural(pan.demandas, 'demanda')} com data</li> : null}
              {verDemandas && !semDem && pan.atrasadas ? <li className="chip perigo" title="Demandas cuja data mais próxima, dentro do período, já passou">{plural(pan.atrasadas, 'atrasada')} no período</li> : null}
              {verEventos && !semEv ? <li className="chip neutro">{plural(pan.compromissos, 'compromisso')} no período</li> : null}
            </>
          )}
        </ul>
      </section>

      {aguardando ? <div className="vazio-c" role="status">Carregando a agenda...</div> : null}

      {!aguardando && modo === 'mes' ? (
        <div className="agd-corpo">
          <section className="agd-painel agd-cal" aria-label={`Calendário de ${tituloMes(dia)}`}>
            <GradeMes dia={dia} hoje={hoje} carga={carga} itens={itens} eventosPorData={eventosPorData} indispPorData={indispPorData} escolher={(d) => setData(d)} verDia={verDia} />
            <button type="button" className="agd-sel-info" onClick={() => verDia(dia)}><span><b>{maiuscula(dataPorExtenso(dia))}</b>: {pl(itensDoDiaAtual.eventos.length + agruparPorDemanda(itensDoDiaAtual.marcos).length, 'item', 'itens')} logo abaixo</span><Icone nome="chevron-right" /></button>
            <Legenda />
          </section>
          <div className="agd-lado">
            <DetalheDia data={dia} itens={itensDoDiaAtual} concluidas={concluidas} />
            <PainelDiasCheios pan={pan} rotulo={nomePeriodo} aoVer={(d) => verDia(d)} />
            <PainelSemPrazo lista={semPrazo} />
          </div>
        </div>
      ) : null}

      {!aguardando && modo === 'semana' ? (
        <>
          <FaixaSemana semana={semana} hoje={hoje} dia={dia} carga={carga} eventosPorData={eventosPorData} indispPorData={indispPorData} irPara={irParaDiaDaSemana} />
          <div className="agd-sem">
            {semana.map((d) => <ColunaDia key={d} data={d} itens={itens.get(d) ?? itensDoDia(d, opcoes)} hoje={hoje} sel={d === dia} carga={carga.get(d)} escolher={(x) => setData(x)} />)}
          </div>
        </>
      ) : null}

      {!aguardando && modo === 'hoje' ? <VisaoHoje dia={dia} itens={itensDoDiaAtual} grupos={gruposHoje} atrasados={atrasados} semPrazo={verDemandas ? semPrazo : null} concluidas={concluidas} /> : null}

      {!aguardando && modo === 'semana' ? (
        <div className="agd-aux-par">
          <PainelDiasCheios pan={pan} rotulo={nomePeriodo} aoVer={(d) => { setData(d); setModo('mes'); }} />
          <PainelSemPrazo lista={semPrazo} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- hoje ----------
function VisaoHoje({ dia, itens, grupos, atrasados, semPrazo, concluidas }: { dia: string; itens: ItensDoDia; grupos: Marco[][]; atrasados: Marco[][]; semPrazo: Demanda[] | null; concluidas: boolean }) {
  const { abrirJanela, hoje } = useApp();
  const eventos = comConflitos(itens.eventos);
  const quando = dia === hoje ? 'de hoje' : 'deste dia';
  return (
    <div className="agd-hoje">
      <div className="agd-col">
        <section className="agd-painel" aria-labelledby="agd-h-c">
          <header className="agd-cab"><div><h3 id="agd-h-c">Compromissos e lembretes</h3><p className="agd-sub">Em ordem cronológica.</p></div><button type="button" className="btn mini" onClick={() => abrirJanela({ t: 'evento', data: dia })}><Icone nome="plus" />{dia === hoje ? 'Novo evento hoje' : 'Novo evento neste dia'}</button></header>
          {itens.indisponiveis.map((x) => <ItemIndisponivel key={x.id} x={x} />)}
          {eventos.length ? eventos.map(({ e, c }) => <ItemEvento key={e.id} e={e} conflitos={c} densidade="linha" />) : <p className="agd-vazio">Nenhum compromisso {dia === hoje ? 'para hoje' : 'neste dia'}.</p>}
        </section>
      </div>
      <div className="agd-col">
        <section className="agd-painel" aria-labelledby="agd-h-d">
          <header className="agd-cab"><div><h3 id="agd-h-d">Marcos das demandas</h3><p className="agd-sub">Vencimentos, acompanhamentos e retornos do setor {quando}.</p></div></header>
          {grupos.length ? grupos.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={concluidas} densidade="linha" />) : <p className="agd-vazio">Nenhum marco {quando}.</p>}
        </section>
        {atrasados.length ? (
          <section className="agd-painel agd-atrasadas" aria-labelledby="agd-h-a">
            <header className="agd-cab"><div><h3 id="agd-h-a">Atrasadas</h3><p className="agd-sub">Marcos de dias anteriores que continuam abertos. Cada um fica no dia em que venceu.</p></div></header>
            {atrasados.map((g) => <ItemDemanda key={g[0].demanda.id} marcos={g} hoje={hoje} concluidas={concluidas} densidade="linha" />)}
          </section>
        ) : null}
      </div>
      {semPrazo ? <div className="agd-col agd-largo"><PainelSemPrazo lista={semPrazo} /></div> : null}
    </div>
  );
}

/** Marcos que já passaram e continuam abertos, do mais antigo para o mais recente (a Agenda os mantém na data original; esta lista só os lembra no Hoje). */
function marcosAtrasados(demandas: readonly Demanda[], dias: readonly DiaIndisponivel[], hoje: string, ate: string): Marco[] {
  const l = marcosPorDia({ demandas, eventos: [], indisponiveis: dias, hoje }, '0000-01-01', somarDias(ate, -1));
  return [...l.values()].flat().filter((m) => m.atrasado).sort((a, b) => a.data.localeCompare(b.data));
}
