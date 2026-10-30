'use client';
// Peças comuns das janelas (moldura, grupo e escolha de opções), com o desenho e as regras de teclado do protótipo aprovado:
// o foco não sai da janela com o Tab, Esc fecha, e ao fechar o foco volta a quem abriu.
// Ao abrir, o foco vai ao primeiro campo (janelas de preencher) ou à própria janela (foco="janela": janelas de leitura, que não devem abrir o teclado do celular).
import { useEffect, useRef, type ReactNode } from 'react';
import { Icone } from './Icone';

export function Janela({ titulo, larga, extraCab, aoFechar, sujo, rodape, foco = 'campo', children }: { titulo: string; larga?: boolean; extraCab?: ReactNode; aoFechar: () => void; sujo: boolean; rodape: ReactNode; foco?: 'campo' | 'janela'; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  useEffect(() => { fechar.current = aoFechar; });
  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null;
    if (foco === 'janela') ref.current?.focus({ preventScroll: true });
    else ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=date]), textarea')?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (document.querySelector('.mv-menu')) return; // o menu aberto sobre a janela cuida do próprio teclado
      if (e.key === 'Escape') { e.stopImmediatePropagation(); fechar.current(); return; }
      // o foco não sai da janela com o Tab: do último campo volta ao primeiro, e ao contrário
      if (e.key === 'Tab' && ref.current) {
        const itens = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((x) => x.getClientRects().length);
        if (!itens.length) return;
        const atual = itens.indexOf(document.activeElement as HTMLElement);
        const alvo = e.shiftKey ? (atual <= 0 ? itens[itens.length - 1] : null) : (atual === -1 || atual === itens.length - 1 ? itens[0] : null);
        if (alvo) { e.preventDefault(); alvo.focus(); }
      }
    };
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('keydown', tecla, true); origem?.focus?.(); }; // ao fechar, o foco volta a quem abriu a janela
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- o foco inicial vale só na abertura
  return (
    <div className="modal-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !sujo) aoFechar(); }}>
      <div ref={ref} className={`modal lg${larga ? ' larga' : ''}`} role="dialog" aria-modal="true" aria-labelledby="m-tit" tabIndex={-1}>
        <header className="m-h"><h3 id="m-tit">{titulo}</h3><button className="icbtn-s" aria-label="Fechar" onClick={aoFechar}><Icone nome="x" /></button>{extraCab}</header>
        {children}
        <footer className="m-f">{rodape}</footer>
      </div>
    </div>
  );
}

export const Grupo = ({ titulo, dica, children }: { titulo: string; dica?: string; children: ReactNode }) => (
  <section className="m-grp"><h4>{titulo}{dica ? <> <small className="data">{dica}</small></> : null}</h4>{children}</section>
);

export function Opcoes<T extends string>({ lista, valor, aoEscolher, rotulo }: { lista: readonly T[]; valor: T; aoEscolher: (v: T) => void; rotulo: string }) {
  return <div className="opcoes" role="group" aria-label={rotulo}>{lista.map((o) => <button key={o} type="button" aria-pressed={valor === o} onClick={() => aoEscolher(o)}>{o}</button>)}</div>;
}
