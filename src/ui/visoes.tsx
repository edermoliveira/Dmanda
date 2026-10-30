'use client';
// As quatro visões de Demandas (Cards, Quadro, Tabela, Lista) sobre a mesma lista de demandas do banco, mais o menu "Mover para" e o ajuste de espaço dos cards.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { AcaoCard, BarraProg, CardDemanda, ChipPrazo, ChipSelo, ChipTipo, ItemTarefa, MiniCard, NovaTarefaInline, OrigemP } from './cartoes';
import { atrasada, ETAPA_COR, ETAPAS, numeroDe, ordenar, percentual, titulo, type Coluna, type Demanda, type Etapa } from '@/lib/demandas';

/** Ajuste ao espaço (card e nota nunca têm barra de rolagem): sem espaço, some primeiro o que é secundário e o título preenche o que sobrar. Mesma regra do protótipo. */
export function ajustar() {
  const app = document.querySelector('.app');
  if (!app) return;
  const cw = (document.querySelector('.frame') as HTMLElement | null)?.clientWidth ?? 0;
  app.querySelectorAll<HTMLElement>('.face.front').forEach((f) => {
    f.querySelectorAll('.oculto').forEach((x) => x.classList.remove('oculto'));
    const ds = f.querySelector<HTMLElement>('.desc');
    const sobra = () => f.scrollHeight > f.clientHeight + 1;
    if (ds) { let n = cw >= 640 && cw < 900 ? 2 : 3; ds.style.webkitLineClamp = String(n); while (n > 1 && sobra()) { n--; ds.style.webkitLineClamp = String(n); } if (sobra()) ds.classList.add('oculto'); }
    for (const q of ['.tempo', '.selo', '.prog', '.tags .chip']) { const x = f.querySelector(q); if (x && sobra()) x.classList.add('oculto'); }
  });
  app.querySelectorAll<HTMLElement>('.fit').forEach((el) => {
    el.style.webkitLineClamp = 'none';
    const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3;
    el.style.webkitLineClamp = String(Math.max(1, Math.floor((el.clientHeight + 1) / lh)));
  });
  app.querySelectorAll<HTMLElement>('.face.back .tarefas').forEach((ul) => {
    const mais = ul.querySelector<HTMLElement>('.mais-t');
    const lis = Array.from(ul.querySelectorAll<HTMLElement>('li:not(.mais-t)'));
    lis.forEach((l) => { l.style.display = ''; });
    if (mais) mais.style.display = 'none';
    let n = 0;
    const sobra = () => ul.scrollHeight > ul.clientHeight + 1;
    while (sobra() && n < lis.length - 1) { lis[lis.length - 1 - n].style.display = 'none'; n++; }
    if (n && mais) {
      mais.style.display = '';
      while (n < lis.length - 1 && sobra()) { lis[lis.length - 1 - n].style.display = 'none'; n++; }
      mais.textContent = `+${n} ${n === 1 ? 'tarefa' : 'tarefas'}, abra em Editar`;
    }
  });
}
export function useAjustar(dep: unknown) {
  useLayoutEffect(() => { ajustar(); });
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const f = () => { clearTimeout(t); t = setTimeout(ajustar, 120); };
    window.addEventListener('resize', f);
    void document.fonts?.ready.then(ajustar);
    return () => { window.removeEventListener('resize', f); clearTimeout(t); };
  }, [dep]);
}

export const Vazio = ({ icone = 'busca', titulo, texto }: { icone?: string; titulo: string; texto: string }) => (
  <div className="vazio"><Icone nome={icone} extra="grande" /><h3>{titulo}</h3><p>{texto}</p></div>
);

export function Cards({ lista }: { lista: Demanda[] }) {
  return <div className="cards">{lista.map((d) => <CardDemanda key={d.id} d={d} />)}</div>;
}

// ---------- Quadro ----------
const SKIP = 'button, input, textarea, select, a, [contenteditable], .t-txt, .prox-t, .t-ed';

export function Quadro({ lista }: { lista: Demanda[] }) {
  const { abrirJanela, mover, concluir, reabrir, demandas } = useApp();
  const [etapaSel, setEtapaSel] = useState<Etapa>('Cadastro');
  const ref = useRef({ demandas, mover, concluir, reabrir });
  useEffect(() => { ref.current = { demandas, mover, concluir, reabrir }; });

  // movimentação por ponteiro: mouse (depois de 6 px), toque e caneta (segurando 0,4 s). Usa a mesma operação do menu "Mover para".
  useEffect(() => {
    type Est = { id: string; card: HTMLElement; x0: number; y0: number; x: number; y: number; pid: number; tipo: string; ativo: boolean; timer?: ReturnType<typeof setTimeout>; ghost?: HTMLElement; raf?: number; dx?: number; dy?: number };
    let PD: Est | null = null, semClique = 0;
    const app = () => document.querySelector('.app') as HTMLElement;
    const alvoSob = (x: number, y: number) => {
      for (const el of document.elementsFromPoint(x, y)) { const t = (el as HTMLElement).closest?.('.etapas-tabs button[data-e], .coluna') as HTMLElement | null; if (t && t.closest('.frame')) return t; }
      return null;
    };
    const etapaDe = (t: HTMLElement | null) => (t ? (t.dataset.e ?? t.getAttribute('aria-label')) : null) as Etapa | null;
    const marca = (t: HTMLElement | null) => { document.querySelectorAll('.coluna.alvo, .etapas-tabs button.alvo').forEach((x) => { if (x !== t) x.classList.remove('alvo'); }); t?.classList.add('alvo'); };
    const limpa = () => {
      if (!PD) return;
      clearTimeout(PD.timer); if (PD.raf) cancelAnimationFrame(PD.raf);
      PD.ghost?.remove(); PD.card.classList.remove('arrastando', 'segurando');
      marca(null); app()?.classList.remove('arrastando-ativo'); PD = null;
    };
    const mexe = () => { if (!PD?.ativo || !PD.ghost) return; const fr = app().getBoundingClientRect(); PD.ghost.style.left = `${PD.x - fr.left - (PD.dx ?? 0)}px`; PD.ghost.style.top = `${PD.y - fr.top - (PD.dy ?? 0)}px`; marca(alvoSob(PD.x, PD.y)); };
    const rola = () => {
      if (!PD?.ativo) return;
      const borda = 64, q = document.querySelector<HTMLElement>('.quadro'), tabs = document.querySelector<HTMLElement>('.etapas-tabs'), main = document.querySelector<HTMLElement>('.main');
      for (const s of [q, tabs]) {
        if (!s || !s.getBoundingClientRect().width || s.scrollWidth <= s.clientWidth) continue;
        const r = s.getBoundingClientRect();
        if (PD.x < r.left + borda) s.scrollLeft -= Math.ceil((borda - (PD.x - r.left)) / 4); else if (PD.x > r.right - borda) s.scrollLeft += Math.ceil((borda - (r.right - PD.x)) / 4);
      }
      if (main) { const rm = main.getBoundingClientRect(); if (PD.y < rm.top + borda) main.scrollTop -= Math.ceil((borda - (PD.y - rm.top)) / 4); else if (PD.y > rm.bottom - borda) main.scrollTop += Math.ceil((borda - (rm.bottom - PD.y)) / 4); }
      mexe(); PD.raf = requestAnimationFrame(rola);
    };
    const comeca = () => {
      if (!PD || PD.ativo) return; PD.ativo = true; clearTimeout(PD.timer);
      const c = PD.card, r = c.getBoundingClientRect(), g = c.cloneNode(true) as HTMLElement;
      g.classList.add('fantasma'); g.classList.remove('arrastando', 'segurando'); g.removeAttribute('data-id'); g.setAttribute('aria-hidden', 'true'); g.style.width = `${r.width}px`;
      PD.dx = PD.x0 - r.left; PD.dy = PD.y0 - r.top; app().appendChild(g); PD.ghost = g;
      c.classList.add('arrastando'); app().classList.add('arrastando-ativo');
      mexe(); PD.raf = requestAnimationFrame(rola);
    };
    const baixo = (e: PointerEvent) => {
      if (PD) limpa();
      if (e.button > 0 || document.querySelector('.modal-ov, .mv-menu')) return;
      const alvo = e.target as HTMLElement, c = alvo.closest?.('.mini-card') as HTMLElement | null;
      if (!c || !c.closest('.quadro') || alvo.closest?.(SKIP)) return;
      PD = { id: c.dataset.id!, card: c, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, pid: e.pointerId, tipo: e.pointerType, ativo: false };
      if (e.pointerType !== 'mouse') { c.classList.add('segurando'); PD.timer = setTimeout(comeca, 380); }
    };
    const move = (e: PointerEvent) => {
      if (!PD || e.pointerId !== PD.pid) return; PD.x = e.clientX; PD.y = e.clientY;
      if (!PD.ativo) { const dist = Math.hypot(PD.x - PD.x0, PD.y - PD.y0); if (PD.tipo === 'mouse') { if (dist > 6) comeca(); } else if (dist > 10) limpa(); return; }
      e.preventDefault(); mexe();
    };
    const fim = (cancelado: boolean) => (e: PointerEvent) => {
      if (!PD || e.pointerId !== PD.pid) return;
      const foi = PD.ativo, id = PD.id, et = !cancelado && foi ? etapaDe(alvoSob(e.clientX, e.clientY)) : null;
      limpa();
      if (!foi) return;
      semClique = Date.now();
      if (et) { setEtapaSel(et); const { demandas: ds, mover: mv, concluir: co, reabrir: re } = ref.current; const d = ds.find((x) => x.id === id); if (d && d.etapa !== et) void (et === 'Finalizado' ? co(id) : d.etapa === 'Finalizado' ? re(id, et) : mv(id, et)); }
    };
    const toque = (e: TouchEvent) => { if (PD?.ativo) e.preventDefault(); };
    const menu = (e: Event) => { if (PD) e.preventDefault(); };
    const clique = (e: MouseEvent) => { if (Date.now() - semClique < 120) { e.stopPropagation(); e.preventDefault(); semClique = 0; } };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && PD?.ativo) { e.stopImmediatePropagation(); limpa(); } };
    const up = fim(false), cancel = fim(true);
    document.addEventListener('pointerdown', baixo); document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
    document.addEventListener('touchmove', toque, { passive: false }); document.addEventListener('contextmenu', menu); document.addEventListener('click', clique, true); document.addEventListener('keydown', tecla, true);
    return () => {
      limpa();
      document.removeEventListener('pointerdown', baixo); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('touchmove', toque); document.removeEventListener('contextmenu', menu); document.removeEventListener('click', clique, true); document.removeEventListener('keydown', tecla, true);
    };
  }, []);

  return (
    <>
      <div className="etapas-tabs" role="group" aria-label="Etapas">
        {ETAPAS.map((et) => (
          <button key={et} data-e={et} aria-pressed={etapaSel === et} style={{ '--et': ETAPA_COR[et] } as CSSProperties} onClick={() => setEtapaSel(et)}>
            <i className="dot" />{et} <span className="cnt">{lista.filter((d) => d.etapa === et).length}</span>
          </button>
        ))}
      </div>
      <div className="quadro">
        {ETAPAS.map((et) => {
          const l = lista.filter((d) => d.etapa === et);
          return (
            <section key={et} className={`coluna${etapaSel === et ? ' sel' : ''}`} aria-label={et} style={{ '--et': ETAPA_COR[et] } as CSSProperties}>
              <header>
                <i className="dot" /><h4>{et}</h4><span className="cnt">{l.length}</span><span className="esp" />
                <button className="icbtn-s" aria-label={`Nova demanda em ${et}`} onClick={() => abrirJanela({ t: 'nova', etapa: et === 'Finalizado' ? undefined : et })}><Icone nome="plus" /></button>
              </header>
              {l.length ? l.map((d) => <MiniCard key={d.id} d={d} />) : <div className="vazio-c">Nenhuma demanda</div>}
              {et !== 'Finalizado' ? <button className="nova" onClick={() => abrirJanela({ t: 'nova', etapa: et })}><Icone nome="plus" />Nova demanda</button> : null}
            </section>
          );
        })}
      </div>
    </>
  );
}

// ---------- Tabela ----------
const COLUNAS: [Coluna, string][] = [['numero', 'Número'], ['assunto', 'Assunto'], ['origem', 'Origem'], ['prazo', 'Prazo'], ['etapa', 'Etapa'], ['pct', 'Andamento']];
export function Tabela({ lista }: { lista: Demanda[] }) {
  const { ordem, ordenarPor, abrirJanela, hoje } = useApp();
  const linhas = ordenar(lista, ordem.coluna, ordem.sentido);
  return (
    <div className="tabela-w">
      <table className="tabela">
        <thead>
          <tr>
            {COLUNAS.map(([k, nome]) => {
              const at = ordem.coluna === k;
              return (
                <th key={k} scope="col" aria-sort={at ? (ordem.sentido > 0 ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => ordenarPor(k)}>{nome}{at ? <Icone nome={ordem.sentido > 0 ? 'ordem-sobe' : 'ordem-desce'} /> : null}</button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.map((d) => (
            <tr key={d.id} className={atrasada(d, hoje) ? 'atrasada' : ''}>
              <td className="mono"><ChipTipo d={d} /> {numeroDe(d)}</td>
              <td><b role="link" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => abrirJanela({ t: 'editar', id: d.id })} onKeyDown={(e) => { if (e.key === 'Enter') abrirJanela({ t: 'editar', id: d.id }); }}>{d.assunto}</b></td>
              <td><OrigemP d={d} /></td>
              <td><ChipPrazo d={d} /> <ChipSelo d={d} /></td>
              <td><span className="et-p" style={{ '--et': ETAPA_COR[d.etapa] } as CSSProperties}><i className="dot" />{d.etapa}</span></td>
              <td style={{ minWidth: 150 }}><BarraProg d={d} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Lista ----------
export function Lista({ lista }: { lista: Demanda[] }) {
  const { gruposFechados, alternarGrupo, abrirJanela, hoje } = useApp();
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  return (
    <div className="lista">
      {ETAPAS.map((et) => {
        const itens = lista.filter((d) => d.etapa === et), fechado = !!gruposFechados[et];
        return (
          <section key={et} className="grupo" style={{ '--et': ETAPA_COR[et] } as CSSProperties}>
            <button className="grupo-h" aria-expanded={!fechado} onClick={() => alternarGrupo(et)}><Icone nome="expandir-grupo" extra={fechado ? 'fechado' : ''} /><i className="dot" /><b>{et}</b><span className="cnt">{itens.length}</span></button>
            {fechado ? null : itens.length ? itens.map((d) => {
              const ab = !!aberto[d.id], p = percentual(d);
              return (
                <div key={d.id} className={`linha${atrasada(d, hoje) ? ' atrasada' : ''}${d.etapa === 'Finalizado' ? ' feita' : ''}`}>
                  <div className="linha-c">
                    <button className="linha-m" aria-expanded={ab} onClick={() => setAberto((a) => ({ ...a, [d.id]: !a[d.id] }))}><span className="mono num">{numeroDe(d) ? `#${numeroDe(d)}` : ''}</span><span className="ass">{d.assunto}</span><OrigemP d={d} /><ChipTipo d={d} /></button>
                    <span className="dir"><ChipSelo d={d} /><ChipPrazo d={d} /><b className="mono pc">{p === null ? '—' : `${p}%`}</b></span>
                  </div>
                  {ab ? (
                    <div className="linha-d">
                      {d.descricao.trim() ? <p className="desc cheia">{d.descricao.trim()}</p> : null}
                      {d.tarefas.length ? <ul className="tarefas">{d.tarefas.map((t) => <ItemTarefa key={t.id} t={t} />)}</ul> : <div className="proxima vazia"><span>Nenhuma tarefa cadastrada</span><NovaTarefaInline demandaId={d.id} /></div>}
                      <AcaoCard d={d} />
                      <button className="btn mini" onClick={() => abrirJanela({ t: 'editar', id: d.id })}><Icone nome="pencil" />Editar</button>
                    </div>
                  ) : null}
                </div>
              );
            }) : <div className="vazio-c">Nenhuma demanda</div>}
          </section>
        );
      })}
    </div>
  );
}

// ---------- menu "Mover para" (botão do card; teclado e toque) ----------
export function MenuMover() {
  const { menuMover, fecharMenuMover, demandas, mover, concluir, reabrir } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const d = menuMover ? demandas.find((x) => x.id === menuMover.id) : null;
  const gatilhoRef = useRef<Element | null>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m || !menuMover) return;
    gatilhoRef.current = document.activeElement;
    const app = document.querySelector('.app')!.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    const x = Math.min(Math.max(8, menuMover.x - w), app.width - w - 8);
    let y = menuMover.y + 6;
    if (y + h > app.height - 8) y = Math.max(8, menuMover.y - h - 44);
    m.style.left = `${x}px`; m.style.top = `${y}px`;
    const itens = Array.from(m.querySelectorAll<HTMLElement>('button:not([aria-disabled="true"])'));
    (itens.find((i) => i.getAttribute('aria-checked') !== 'true') ?? itens[0] ?? m).focus();
  }, [menuMover]);
  useEffect(() => {
    if (!menuMover) return;
    const fora = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.mv-menu') && !t.closest?.('[aria-haspopup="menu"]')) fecharMenuMover(); };
    const tecla = (e: KeyboardEvent) => {
      const m = ref.current; if (!m) return;
      if (e.key === 'Escape') { e.stopImmediatePropagation(); const g = gatilhoRef.current as HTMLElement | null; fecharMenuMover(); setTimeout(() => g?.focus?.(), 0); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const its = Array.from(m.querySelectorAll<HTMLElement>('button:not([aria-disabled="true"])')), i = its.indexOf(document.activeElement as HTMLElement); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]?.focus(); }
      if (e.key === 'Tab') fecharMenuMover();
    };
    document.addEventListener('click', fora, true); document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('click', fora, true); document.removeEventListener('keydown', tecla, true); };
  }, [menuMover, fecharMenuMover]);
  if (!menuMover || !d) return null;
  const escolher = (et: Etapa) => { fecharMenuMover(); if (et === d.etapa) return; void (et === 'Finalizado' ? concluir(d.id) : d.etapa === 'Finalizado' ? reabrir(d.id, et) : mover(d.id, et)); };
  return (
    <div ref={ref} className="mv-menu" role="menu" aria-label={`Mover ${titulo(d)} para a etapa`}>
      <div className="mv-t">Mover para</div>
      {ETAPAS.map((et) => {
        const atual = et === d.etapa;
        return (
          <button key={et} type="button" role="menuitemradio" aria-checked={atual} aria-disabled={atual || undefined} onClick={() => !atual && escolher(et)}>
            <i className="dot" style={{ '--et': ETAPA_COR[et] } as CSSProperties} /><span>{et}</span>{atual ? <small>atual</small> : null}
          </button>
        );
      })}
    </div>
  );
}
