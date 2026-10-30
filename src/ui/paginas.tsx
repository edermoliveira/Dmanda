'use client';
// Telas do aplicativo funcional: Início (resumos e Foco do dia), Demandas (quatro visões), Arquivo, Mais e as áreas ainda não construídas.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Capsula } from './Capsula';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icone } from './Icone';
import { useApp, type EstadoRotina } from './contexto';
import { CardDemanda, ChipPrazo, ChipSelo, ChipTipo, OrigemP } from './cartoes';
import { Cards, Lista, Quadro, Tabela, useAjustar, Vazio } from './visoes';
import { atrasada, filtrar, focoDoDia, FILTRO_VAZIO, plural, porGrupo, TIPOS, titulo, type Demanda, type Tipo } from '@/lib/demandas';

function CabecaPagina({ titulo, sub }: { titulo: string; sub: string }) { return <div className="pagehead"><h1>{titulo}</h1><p>{sub}</p></div>; }
function Carregando() { return <div className="vazio-c" role="status">Carregando as demandas...</div>; }

// ---------- Início ----------
const GRUPOS_INICIO = [['atrasadas', 'Atrasadas', 'clock', true], ['hoje', 'Para hoje', 'target', false], ['sete', 'Próximos 7 dias', 'calendar', false]] as const;
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
// Os prazos da tela vêm sempre das datas das demandas; esta linha só informa a rotina diária na nuvem.
function textoRotina(r: EstadoRotina | null) {
  if (!r) return '';
  const falhouDepois = r.ultima_falha && (!r.ultima_ok || r.ultima_falha > r.ultima_ok);
  if (falhouDepois) return `A última tentativa da rotina diária não terminou (${quando(r.ultima_falha!)}). Os prazos acima continuam corretos.`;
  return r.ultima_ok ? `Rotina diária na nuvem: última execução em ${quando(r.ultima_ok)}.` : 'A rotina diária na nuvem ainda não rodou. Os prazos acima já são calculados pelas datas das demandas.';
}

export function PaginaInicio() {
  const { demandas, carregando, abrirJanela, hoje, rotina } = useApp();
  const [sel, setSel] = useState<'atrasadas' | 'hoje' | 'sete' | null>(null);
  const foco = focoDoDia(demandas, hoje);
  useAjustar(`${demandas.length}${sel}`);
  return (
    <>
      <CabecaPagina titulo="Início" sub="Seu dia em um só lugar." />
      {carregando && !demandas.length ? <Carregando /> : null}
      {!carregando && !demandas.length ? (
        <div className="vazio"><Icone nome="nav-demandas" extra="grande" /><h3>Nenhuma demanda ainda</h3><p>Cadastre a primeira para ver aqui os prazos e o Foco do dia.</p><button className="btn pri" onClick={() => abrirJanela({ t: 'nova' })}>Nova demanda</button></div>
      ) : null}
      {demandas.length ? (
        <>
          <section className="sec">
            <div className="stats tres" role="group" aria-label="Filtrar demandas por prazo">
              {GRUPOS_INICIO.map(([g, nome, icone, alerta]) => {
                const n = porGrupo(demandas, g, hoje).length;
                return (
                  <button key={g} className={`stat st-${g}${alerta && n ? ' alerta' : ''}`} aria-pressed={sel === g} onClick={() => setSel(sel === g ? null : g)}>
                    <span className="st-ic"><Icone nome={icone} /></span><span className="n">{n}</span><span className="r">{nome}</span>
                  </button>
                );
              })}
            </div>
            {sel ? (() => {
              const l = porGrupo(demandas, sel, hoje), nome = GRUPOS_INICIO.find((g) => g[0] === sel)![1];
              return <><h3 className="sub-f">{nome} <small>{plural(l.length, 'demanda')}</small></h3>{l.length ? <div className="cards">{l.map((d) => <CardDemanda key={d.id} d={d} />)}</div> : <div className="vazio-c">Nenhuma demanda neste filtro.</div>}</>;
            })() : null}
          </section>
          <section className="sec">
            <h3>Foco do dia <small>até 3 demandas: atrasadas, depois hoje, depois os próximos 7 dias</small></h3>
            {foco.length ? <div className="cards">{foco.map((d) => <CardDemanda key={d.id} d={d} />)}</div> : <div className="vazio-c">Nada urgente por enquanto.</div>}
          </section>
        </>
      ) : null}
      <p className="rotina-estado">{textoRotina(rotina)}</p>
    </>
  );
}

// ---------- Demandas ----------
const VISOES = [['cards', 'Cards', 'vis-cards'], ['quadro', 'Quadro', 'columns'], ['tabela', 'Tabela', 'vis-tabela'], ['lista', 'Lista', 'vis-lista']] as const;
const PRAZOS_FILTRO = [['', 'Todos'], ['sem', 'Sem prazo'], ['atrasadas', 'Atrasadas'], ['hoje', 'Vencem hoje'], ['sete', 'Próximos 7 dias']] as const;

function PainelFiltros({ pos, fechar }: { pos: { x: number; y: number }; fechar: () => void }) {
  const { filtro, setFiltro } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const app = document.querySelector('.app')!.getBoundingClientRect(), w = m.offsetWidth;
    m.style.left = `${Math.min(Math.max(8, pos.x - w), app.width - w - 8)}px`; m.style.top = `${pos.y + 6}px`;
    m.querySelector<HTMLElement>('select')?.focus();
    const fora = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.mv-menu') && !t.closest?.('[data-filtros]')) fechar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); fechar(); (document.querySelector('[data-filtros]') as HTMLElement | null)?.focus(); } };
    document.addEventListener('click', fora, true); document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('click', fora, true); document.removeEventListener('keydown', tecla, true); };
  }, [pos, fechar]);
  const alvo = document.querySelector('.app');
  if (!alvo) return null;
  return createPortal(
    <div ref={ref} className="mv-menu painel-filtros" role="dialog" aria-label="Filtros de demandas" style={{ padding: 14, minWidth: 260 }}>
      <div className="fld"><label htmlFor="f-tipo">Tipo de documento</label><select id="f-tipo" value={filtro.tipo} onChange={(e) => setFiltro({ tipo: e.target.value as Tipo | '' })}><option value="">Todos</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
      <div className="fld"><label htmlFor="f-prazo">Prazo</label><select id="f-prazo" value={filtro.prazo} onChange={(e) => setFiltro({ prazo: e.target.value as typeof filtro.prazo })}>{PRAZOS_FILTRO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
      <div className="acoes"><button className="btn mini" onClick={() => setFiltro({ tipo: '', prazo: '' })}>Limpar filtros</button><button className="btn mini pri" onClick={fechar}>Fechar</button></div>
    </div>, alvo);
}

export function PaginaDemandas() {
  const { demandas, carregando, visao, setVisao, filtro, setFiltro, abrirJanela, hoje } = useApp();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const lista = filtrar(demandas, filtro, hoje);
  const nAt = demandas.filter((d) => atrasada(d, hoje)).length;
  const nFiltros = (filtro.tipo ? 1 : 0) + (filtro.prazo ? 1 : 0);
  const [toque, setToque] = useState(false);
  useEffect(() => { const m = matchMedia('(max-width: 899px)'); const f = () => setToque(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  useAjustar(`${demandas.length}${visao}${lista.length}`);
  // atalho "/" do protótipo aprovado: foca o filtro (não vale digitando em um campo, com janela ou menu aberto)
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-ov, .mv-menu')) return;
      e.preventDefault(); document.getElementById('fq')?.focus();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  return (
    <>
      <CabecaPagina titulo="Demandas" sub={`${plural(demandas.length, 'demanda')}, ${plural(nAt, 'atrasada')}. Do cadastro à conclusão.`} />
      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Visão">
          <Capsula sel='button[aria-pressed="true"]' chave={visao} />
          {VISOES.map(([v, nome, icone]) => <button key={v} data-v={v} aria-pressed={visao === v} aria-label={nome} onClick={() => setVisao(v)}><Icone nome={icone} /><span className="tx">{nome}</span></button>)}
        </div>
        <label className="filtro"><Icone nome="busca" /><input id="fq" placeholder={toque ? 'Filtrar demandas' : 'Filtrar demandas ( / )'} value={filtro.texto} aria-label="Filtrar demandas" autoComplete="off" onChange={(e) => setFiltro({ texto: e.target.value })} /></label>
        <button className="btn gl" aria-pressed={filtro.soAtrasadas} aria-label="Só atrasadas" onClick={() => setFiltro({ soAtrasadas: !filtro.soAtrasadas })}><Icone nome="clock" /><span className="tx">Só atrasadas{nAt ? ` ${nAt}` : ''}</span></button>
        <button className="btn gl" data-filtros aria-haspopup="dialog" aria-expanded={!!pos} aria-label={nFiltros ? `Filtros, ${nFiltros} ativos` : 'Filtros'} onClick={(e) => { const a = document.querySelector('.app')!.getBoundingClientRect(), b = e.currentTarget.getBoundingClientRect(); setPos(pos ? null : { x: b.right - a.left, y: b.bottom - a.top }); }}><Icone nome="filtro" /><span className="tx">Filtros{nFiltros ? ` ${nFiltros}` : ''}</span></button>
        <button className="btn escuro" aria-label="Nova demanda" onClick={() => abrirJanela({ t: 'nova' })}><Icone nome="plus" /><span className="tx">Nova demanda</span></button>
      </div>
      {pos ? <PainelFiltros pos={pos} fechar={() => setPos(null)} /> : null}
      <div id="vista">
        {carregando && !demandas.length ? <Carregando />
          : !demandas.length ? <div className="vazio"><Icone nome="nav-demandas" extra="grande" /><h3>Nenhuma demanda cadastrada</h3><p>Cadastre a primeira com o botão Nova demanda.</p><button className="btn pri" onClick={() => abrirJanela({ t: 'nova' })}>Nova demanda</button></div>
          : !lista.length ? <div className="vazio"><Icone nome="busca" extra="grande" /><h3>Nenhuma demanda encontrada</h3><p>Ajuste o filtro para ver mais.</p><button className="btn mini" onClick={() => setFiltro({ ...FILTRO_VAZIO })}>Limpar filtros</button></div>
          : visao === 'cards' ? <Cards lista={lista} /> : visao === 'quadro' ? <Quadro lista={lista} /> : visao === 'tabela' ? <Tabela lista={lista} /> : <Lista lista={lista} />}
      </div>
    </>
  );
}

// ---------- Arquivo ----------
export function PaginaArquivo() {
  const { arquivadas, carregarArquivadas, desarquivar, excluir, abrirJanela } = useApp();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  useEffect(() => { void carregarArquivadas(); }, [carregarArquivadas]);
  return (
    <>
      <CabecaPagina titulo="Arquivo" sub="Demandas arquivadas." />
      {arquivadas === null ? <Carregando /> : !arquivadas.length ? <Vazio icone="archive" titulo="Nada arquivado" texto="As demandas que você arquivar aparecem aqui. Arquivar é sempre manual." /> : (
        <div className="lista">
          {arquivadas.map((d: Demanda) => (
            <div key={d.id} className="linha"><div className="linha-c">
              <span className="mono num">{titulo(d)}</span><span className="ass">{d.assunto}</span><OrigemP d={d} /><ChipTipo d={d} /><span className="chip neutro">{d.etapa === 'Finalizado' ? 'Finalizada' : d.etapa}</span><ChipPrazo d={d} /><ChipSelo d={d} />
              <button className="btn mini" onClick={() => abrirJanela({ t: 'editar', id: d.id })}>Abrir</button>
              <button className="btn mini" onClick={() => void desarquivar(d.id)}>Desarquivar</button>
              {confirmando === d.id
                ? <><span className="data">Excluir de vez? Não dá para desfazer.</span><button className="btn mini perigo" onClick={async () => { if (await excluir(d.id)) setConfirmando(null); }}><Icone nome="trash" />Confirmar exclusão</button><button className="btn mini" onClick={() => setConfirmando(null)}>Cancelar</button></>
                : <button className="btn mini" onClick={() => setConfirmando(d.id)}><Icone nome="trash" />Excluir</button>}
            </div></div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Mais (celular e iPad vertical) ----------
export function PaginaMais() {
  const router = useRouter();
  const itens: [string, string, string][] = [['/entradas', 'Entradas', 'nav-entradas'], ['/documentos', 'Documentos', 'nav-documentos'], ['/ia', 'IA', 'nav-ia'], ['/config', 'Configurações', 'nav-config'], ['/arquivo', 'Arquivo', 'archive']];
  return (
    <>
      <CabecaPagina titulo="Mais" sub="Outras áreas do Dmanda." />
      <div className="lista">{itens.map(([rota, nome, icone]) => <button key={rota} className="navi grande" onClick={() => router.push(rota)}><span className="ico"><Icone nome={icone} extra="duo" /></span><span>{nome}</span></button>)}</div>
    </>
  );
}

// ---------- áreas ainda não construídas (sem dados de exemplo: só dizem o que falta) ----------
export function EmConstrucao({ titulo, sub, icone, texto }: { titulo: string; sub: string; icone: string; texto: string }) {
  return (
    <>
      <CabecaPagina titulo={titulo} sub={sub} />
      <div className="vazio"><Icone nome={icone} extra="grande" /><h3>Em construção</h3><p>{texto}</p></div>
    </>
  );
}
export type { CSSProperties };
