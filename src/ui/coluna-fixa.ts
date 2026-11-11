'use client';
// Coluna lateral que acompanha a página sem rolagem própria (Início, decisão 65). A página inteira rola, mesmo com o ponteiro sobre a coluna.
//  - Se a coluna cabe na área visível, fica fixa logo abaixo do cabeçalho.
//  - Se é mais alta, ao descer ela acompanha a página até a borda de baixo aparecer e então para; ao subir, acompanha até a borda de cima chegar logo abaixo do cabeçalho e então para.
// Técnica: a coluna é `position: sticky` e o `top` dela é recalculado a cada rolagem, somando o deslocamento e limitando entre "borda de baixo visível" (mínimo) e "logo abaixo do cabeçalho" (máximo).
// Como o `top` muda com o mesmo deslocamento da página, a troca de direção é contínua (não há salto). Mudou a altura da coluna (lista do dia) ou da janela: só reajusta os limites.
import { useEffect, type RefObject } from 'react';

const MARGEM_BAIXO = 16;

/** Limites do `top` e posição inicial, em função da altura da coluna e da área visível. Pura, para o teste e para o hook. */
export function limitesDaColuna(altura: number, visivel: number, topo: number): { min: number; max: number } {
  const max = topo;
  const min = Math.min(max, visivel - altura - MARGEM_BAIXO);
  return { min, max };
}

/** Novo `top` depois de rolar `delta` px (positivo = desceu). */
export function topoDepoisDeRolar(atual: number, delta: number, lim: { min: number; max: number }): number {
  return Math.min(lim.max, Math.max(lim.min, atual - delta));
}

/**
 * O `top` de um elemento sticky é medido a partir da borda interna do padding do contêiner de rolagem (o `.main` tem 84 px de padding em cima), então tudo aqui é calculado em coordenadas da
 * janela (y) e só na hora de escrever o `top` se desconta o padding.
 */
export function useColunaFixa(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const rolagem = el.closest<HTMLElement>('.main'); if (!rolagem) return;
    let lim = { min: 0, max: 0 }, pad = 0, y = 0, ultimo = rolagem.scrollTop, ativo = false;
    const escrever = () => { el.style.top = `${Math.round((y - pad) * 100) / 100}px`; };
    const medir = () => {
      ativo = getComputedStyle(el).position === 'sticky';
      if (!ativo) { el.style.removeProperty('top'); return; }
      const cs = getComputedStyle(rolagem);
      pad = parseFloat(cs.paddingTop) || 0;
      lim = limitesDaColuna(el.offsetHeight, rolagem.clientHeight, parseFloat(cs.scrollPaddingTop) || 84);
      y = Math.min(lim.max, Math.max(lim.min, el.style.top ? y : lim.max));
      escrever(); ultimo = rolagem.scrollTop;
    };
    const rolou = () => {
      const st = rolagem.scrollTop, delta = st - ultimo; ultimo = st;
      if (!ativo || !delta) return;
      y = topoDepoisDeRolar(y, delta, lim); escrever();
    };
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el); ro.observe(rolagem);
    rolagem.addEventListener('scroll', rolou, { passive: true });
    return () => { ro.disconnect(); rolagem.removeEventListener('scroll', rolou); el.style.removeProperty('top'); };
  }, [ref]);
}
