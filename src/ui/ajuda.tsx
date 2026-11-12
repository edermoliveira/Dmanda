'use client';
// Ajuda curta ao lado de um título (decisão 66): botão discreto com o ícone ⓘ e um balão que abre ao clicar, tocar ou usar Enter e espaço. Fecha com Esc (devolvendo o foco ao botão),
// com toque ou clique fora e quando o foco sai do conjunto. O balão é posicionado sobre a página (absolute), então abrir não desloca nada; a posição horizontal é corrigida para caber na tela.
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** O ⓘ (círculo com o "i"), no traço dos demais ícones: Lucide `info`, que o Dmanda já aceita como reserva dos ícones ainda não escolhidos. */
function IconeInfo() {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  );
}

export function Ajuda({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const id = useId();
  const [aberta, setAberta] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLSpanElement>(null);

  // cabe na tela: parte do alinhamento à esquerda do botão e recua o que passar da borda direita (ou da esquerda) da janela
  useLayoutEffect(() => {
    const b = balao.current, r = raiz.current; if (!aberta || !b || !r) return;
    b.style.left = '0px';
    const vw = document.documentElement.clientWidth, folga = 12, caixa = b.getBoundingClientRect(), dono = r.getBoundingClientRect();
    const limite = Math.max(folga, Math.min(caixa.left, vw - folga - caixa.width));
    b.style.left = `${Math.round(limite - dono.left)}px`;
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: Event) => { if (!raiz.current?.contains(e.target as Node)) setAberta(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberta(false); botao.current?.focus(); } };
    const larg = window.innerWidth; const sair = () => { if (window.innerWidth !== larg) setAberta(false); }; // só a largura conta: a barra do Safari do iPhone muda a altura ao rolar
    document.addEventListener('pointerdown', fora, true); document.addEventListener('keydown', esc, true); window.addEventListener('resize', sair);
    return () => { document.removeEventListener('pointerdown', fora, true); document.removeEventListener('keydown', esc, true); window.removeEventListener('resize', sair); };
  }, [aberta]);

  return (
    <span ref={raiz} className="ajuda" data-aberta={aberta || undefined} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberta(false); }}>
      <button ref={botao} type="button" className="ajuda-b" aria-label={rotulo} aria-expanded={aberta} aria-controls={aberta ? id : undefined} onClick={() => setAberta((v) => !v)}><IconeInfo /></button>
      {aberta ? <span ref={balao} id={id} role="note" tabIndex={-1} className="ajuda-balao">{children}</span> : null}
    </span>
  );
}
