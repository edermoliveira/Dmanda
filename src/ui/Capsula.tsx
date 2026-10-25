'use client';
// Cápsula de seleção que desliza entre abas (menu lateral, barra inferior e abas das visões).
// Fica dentro do contêiner e se posiciona sobre o item selecionado. As medidas e o movimento só acontecem em efeitos,
// depois que o próprio elemento foi hidratado: o HTML do servidor é igual ao primeiro desenho do cliente,
// sem esperas fixas nem supressão de avisos de hidratação.
import { useEffect, useLayoutEffect, useRef } from 'react';

type Ret = { l: number; t: number; w: number; h: number };

export function Capsula({ sel, chave }: { sel: string; chave: string }) {
  const ref = useRef<HTMLElement>(null);
  const anterior = useRef<Ret | null>(null);

  // acompanha a seleção: mede o item marcado e, se a cápsula já estava posicionada, anima do lugar antigo para o novo
  useLayoutEffect(() => {
    const t = ref.current, pai = t?.parentElement;
    const s = pai?.querySelector<HTMLElement>(sel);
    if (!t || !s) { anterior.current = null; return; }
    const n: Ret = { l: s.offsetLeft, t: s.offsetTop, w: s.offsetWidth, h: s.offsetHeight }, ant = anterior.current;
    const pos = { left: `${n.l}px`, top: `${n.t}px`, width: `${n.w}px`, height: `${n.h}px` };
    Object.assign(t.style, pos);
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches || t.closest<HTMLElement>('.app')?.dataset.reduzir === 'true';
    if (ant && !reduzido && (ant.l !== n.l || ant.t !== n.t || ant.w !== n.w || ant.h !== n.h) && t.animate) {
      t.animate([{ left: `${ant.l}px`, top: `${ant.t}px`, width: `${ant.w}px`, height: `${ant.h}px` }, pos], { duration: 520, easing: 'cubic-bezier(.32,1.25,.5,1)' });
    }
    anterior.current = n;
  }, [sel, chave]);

  // acompanha o tamanho: mudança de largura, de fonte, menu aberto ou fechado e tema reposicionam sem animar
  useEffect(() => {
    const t = ref.current, pai = t?.parentElement;
    if (!t || !pai) return;
    let quadro = 0;
    const medir = () => {
      const s = pai.querySelector<HTMLElement>(sel);
      if (!s) return;
      const n: Ret = { l: s.offsetLeft, t: s.offsetTop, w: s.offsetWidth, h: s.offsetHeight };
      Object.assign(t.style, { left: `${n.l}px`, top: `${n.t}px`, width: `${n.w}px`, height: `${n.h}px` });
      anterior.current = n;
    };
    const agendar = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(medir); };
    const rz = new ResizeObserver(agendar);
    rz.observe(pai);
    const s = pai.querySelector<HTMLElement>(sel);
    if (s) rz.observe(s);
    void document.fonts?.ready.then(agendar);
    return () => { rz.disconnect(); cancelAnimationFrame(quadro); };
  }, [sel, chave]);

  return <i ref={ref} className="thumb" aria-hidden="true" />;
}
