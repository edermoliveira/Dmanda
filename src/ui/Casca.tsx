'use client';
// Moldura do aplicativo: menu lateral, barra do topo, barra inferior do celular, botão "+", avisos e janelas. Mesmo desenho e mesmas classes do protótipo aprovado.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icone, LOGO } from './Icone';
import { ProvedorApp, useApp } from './contexto';
import { Janelas } from './janelas';
import { MenuMover } from './visoes';

const NAV: [string, string, string, string][] = [
  ['/', 'Início', 'nav-inicio', 'inicio'], ['/entradas', 'Entradas', 'nav-entradas', 'entradas'], ['/demandas', 'Demandas', 'nav-demandas', 'demandas'],
  ['/agenda', 'Agenda', 'nav-agenda', 'agenda'], ['/documentos', 'Documentos', 'nav-documentos', 'documentos'], ['/ia', 'IA', 'nav-ia', 'ia'], ['/config', 'Configurações', 'nav-config', 'config'],
];
const EM_MAIS = ['/mais', '/entradas', '/documentos', '/ia', '/config', '/arquivo'];
const ativo = (caminho: string, rota: string) => (rota === '/' ? caminho === '/' : caminho === rota || caminho.startsWith(rota + '/'));

// ---------- cápsula de seleção que desliza entre abas (mesma técnica do protótipo, sem substituir o app inteiro a cada ação) ----------
type Ret = { l: number; t: number; w: number; h: number };
const GRUPOS: [string, string][] = [['.tabs', 'button[aria-pressed="true"]'], ['.side', '.navi[aria-current="page"]'], ['.bar', '.bi[aria-current="page"]']];
function Capsulas() {
  useEffect(() => {
    const app = () => document.querySelector<HTMLElement>('.app');
    const anterior: Record<string, Ret> = {};
    const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches || app()?.dataset.reduzir === 'true';
    const atualizar = (animar: boolean) => {
      const a = app(); if (!a) return;
      GRUPOS.forEach(([cont, sel]) => a.querySelectorAll<HTMLElement>(cont).forEach((c, i) => {
        const chave = cont + i, s = c.querySelector<HTMLElement>(sel);
        let t = c.querySelector<HTMLElement>(':scope > .thumb');
        if (!s) { t?.remove(); delete anterior[chave]; return; }
        if (!t) { t = document.createElement('i'); t.className = 'thumb'; c.insertBefore(t, c.firstChild); }
        const n: Ret = { l: s.offsetLeft, t: s.offsetTop, w: s.offsetWidth, h: s.offsetHeight }, ant = anterior[chave];
        const pos = { left: `${n.l}px`, top: `${n.t}px`, width: `${n.w}px`, height: `${n.h}px` };
        Object.assign(t.style, pos);
        if (animar && ant && !reduzido() && (ant.l !== n.l || ant.t !== n.t || ant.w !== n.w || ant.h !== n.h) && t.animate) {
          t.animate([{ left: `${ant.l}px`, top: `${ant.t}px`, width: `${ant.w}px`, height: `${ant.h}px` }, pos], { duration: 520, easing: 'cubic-bezier(.32,1.25,.5,1)' });
        }
        anterior[chave] = n;
      }));
    };
    let quadro = 0;
    const agendar = (animar: boolean) => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(() => { atualizar(animar); obs.takeRecords(); }); };
    const obs = new MutationObserver((muts) => { if (muts.some((m) => !(m.target as HTMLElement).classList?.contains('thumb') && ![...m.addedNodes, ...m.removedNodes].every((n) => (n as HTMLElement).classList?.contains('thumb')))) agendar(true); });
    const raiz = app();
    if (raiz) obs.observe(raiz, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-current'] });
    const rz = new ResizeObserver(() => agendar(false));
    const frame = document.getElementById('frame'); if (frame) rz.observe(frame);
    void document.fonts?.ready.then(() => agendar(false));
    atualizar(false);
    return () => { obs.disconnect(); rz.disconnect(); cancelAnimationFrame(quadro); };
  }, []);
  return null;
}

function useToque() {
  const [toque, setToque] = useState(false);
  useEffect(() => { const m = matchMedia('(hover: none), (pointer: coarse)'); const f = () => setToque(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return toque;
}

function Interior({ children }: { children: ReactNode }) {
  const { tema, menuAberto, alternarMenu, alternarTema, ambiente, aviso, avisar, janela, abrirJanela, erroCarga, recarregar } = useApp();
  const caminho = usePathname();
  const router = useRouter();
  const toque = useToque();
  const [plus, setPlus] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const nome = ambiente?.nome || 'Secretário';

  // marcas de movimento do Catalyst (as animações de entrada de tela, janela e menu)
  const marca = (n: string) => { const a = appRef.current; if (!a) return; a.setAttribute(`data-t-${n}`, ''); setTimeout(() => a.removeAttribute(`data-t-${n}`), 900); };
  const primeira = useRef(true);
  useEffect(() => { if (primeira.current) { primeira.current = false; return; } marca('tela'); }, [caminho]);
  useEffect(() => { if (janela) marca('modal'); }, [janela]);
  useEffect(() => { if (plus) marca('plus'); }, [plus]);
  useEffect(() => { if (!plus) return; const f = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.menuplus, .fab, .mais-c')) setPlus(false); }; document.addEventListener('click', f, true); return () => document.removeEventListener('click', f, true); }, [plus]);
  useLayoutEffect(() => { document.documentElement.dataset.tema = tema; }, [tema]);

  const ir = (rota: string) => () => { setPlus(false); router.push(rota); };
  const breve = (o: string) => () => avisar(`${o} ainda não está implementado: fica para um dos próximos blocos.`);
  const emMais = EM_MAIS.some((r) => ativo(caminho, r));
  const itensPlus: [string, string, boolean, () => void][] = [
    ['Anotação', 'sticky-note', false, breve('Anotação')], ['Demanda', 'square-kanban', true, () => { setPlus(false); abrirJanela({ t: 'nova' }); }], ['Evento', 'calendar', false, breve('Evento')],
    ['Tarefa', 'check', true, () => { setPlus(false); abrirJanela({ t: 'tarefa' }); }], ['Documento', 'file-text', false, breve('Documento')], ['Chat com a IA', 'message-circle', false, breve('Chat com a IA')],
  ];
  const label = menuAberto ? 'Recolher menu' : 'Mostrar menu';
  const tbtn = (n: [string, string, string, string]) => (
    <button key={n[0]} className="navi" data-nav={n[3]} aria-current={ativo(caminho, n[0]) ? 'page' : undefined} title={n[1]} aria-label={n[1]} onClick={ir(n[0])}><span className="ico"><Icone nome={n[2]} extra="duo" /></span><span className="tx">{n[1]}</span></button>
  );
  return (
    <div className="frame real" id="frame">
      <div ref={appRef} className="app" data-dir="d" data-tema={tema} data-ico="fino" data-dev={toque ? 'toque' : 'desktop'} data-col="true" data-aberto={menuAberto} data-reduzir="false"
        style={{ '--fs': '16px', '--icn': '20px', '--cardh': '340px', '--font': 'var(--f-inter), system-ui, sans-serif', '--font-h': 'var(--f-inter), system-ui, sans-serif', '--font-ui': 'var(--f-inter), system-ui, sans-serif', '--font-n': 'var(--f-mono), ui-monospace, monospace' } as CSSProperties} suppressHydrationWarning>
        <div className="bg"><i className="bg-img" /></div>
        <aside className="side" aria-label="Menu">
          <div className="logo">{LOGO}<span>Dmanda</span></div>
          {NAV.filter((n) => n[0] !== '/config').map(tbtn)}
          <div className="esp" />
          {tbtn(NAV[6])}
          <button className="navi col-b" aria-expanded={menuAberto} aria-label={label} title={label} onClick={alternarMenu}><span className="ico"><Icone nome={menuAberto ? 'recolher' : 'expandir'} /></span><span className="tx">{label}</span></button>
        </aside>
        <header className="top">
          <div className="top-logo">{LOGO}<span>Dmanda</span></div>
          <button className="icbtn buscabtn" aria-label="Buscar em tudo (ainda não implementado)" aria-disabled="true" title="A busca global fica para um dos próximos blocos" onClick={breve('A busca global')}><Icone nome="busca" /><span className="tx">Buscar demanda, entrada, evento ou documento</span><kbd>Ctrl K</kbd></button>
          <button className="icbtn sino" aria-label="Avisos (ainda não implementado)" aria-disabled="true" title="Os avisos ficam para um dos próximos blocos" onClick={breve('Os avisos')}><Icone nome="bell" /></button>
          <button className="icbtn" aria-label="Alternar tema claro e escuro" onClick={alternarTema}><Icone nome={tema === 'claro' ? 'moon' : 'sun'} /></button>
          <button className="perfil-b" aria-label="Perfil (ainda não implementado)" aria-disabled="true" title="O Perfil fica para um dos próximos blocos" onClick={breve('O Perfil')}><span className="avatar">{nome.charAt(0).toUpperCase()}</span><span className="tx">{nome}</span></button>
        </header>
        <main className="main" id="main">
          {ambiente?.teste ? <p className="faixa-teste" role="note">Banco local de teste (dados descartáveis, não é o Supabase). Só em desenvolvimento.</p> : null}
          {erroCarga ? <div className="erro-carga" role="alert"><b>Não foi possível carregar as demandas.</b><span>{erroCarga}</span><button className="btn mini" onClick={() => void recarregar()}>Tentar de novo</button></div> : null}
          {children}
        </main>
        <nav className="bar glass" aria-label="Navegação">
          {[NAV[0], NAV[2]].map((n) => <button key={n[0]} className="bi" data-nav={n[3]} aria-current={ativo(caminho, n[0]) ? 'page' : undefined} onClick={ir(n[0])}><Icone nome={n[2]} extra="duo" />{n[1]}</button>)}
          <button className="mais-c" aria-label="Criar novo" aria-expanded={plus} onClick={() => setPlus((v) => !v)}><Icone nome="plus" /></button>
          <button className="bi" data-nav="agenda" aria-current={ativo(caminho, '/agenda') ? 'page' : undefined} onClick={ir('/agenda')}><Icone nome="nav-agenda" extra="duo" />Agenda</button>
          <button className="bi" data-nav="mais" aria-current={emMais ? 'page' : undefined} onClick={ir('/mais')}><Icone nome="ellipsis" />Mais</button>
        </nav>
        <button className="fab" aria-label="Criar novo" aria-expanded={plus} onClick={() => setPlus((v) => !v)}><Icone nome="plus" /></button>
        <div className={`menuplus glass${plus ? ' aberto' : ''}`} role="menu" aria-label="Criar">
          {itensPlus.map(([nomeI, icone, pronto, acao], i) => (
            <Fragment key={nomeI}>
              {i === 3 ? <hr /> : null}
              <button className={i < 3 ? 'rapido' : ''} role="menuitem" aria-disabled={pronto ? undefined : true} title={pronto ? undefined : 'Fica para um dos próximos blocos'} style={pronto ? undefined : { opacity: 0.5 }} onClick={acao}><Icone nome={icone} />{nomeI}</button>
            </Fragment>
          ))}
        </div>
        <Janelas />
        <MenuMover />
        <div className={`toast${aviso ? ' on' : ''}${aviso?.erro ? ' erro' : ''}`} id="toast" role={aviso?.erro ? 'alert' : 'status'}>{aviso?.msg}</div>
      </div>
      <Capsulas />
    </div>
  );
}

export function Casca({ children }: { children: ReactNode }) {
  return <ProvedorApp><Interior>{children}</Interior></ProvedorApp>;
}
