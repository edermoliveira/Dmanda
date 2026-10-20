"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, EllipsisVertical, LoaderCircle, type LucideIcon } from "lucide-react";
import { Icone } from "./Icone";

export type ItemMenu = {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  desativado?: boolean;
  carregando?: boolean;
  /** Mensagem de erro mostrada no próprio item. */
  erro?: string;
  /** Ação destrutiva (ex.: excluir): texto em perigo. */
  perigo?: boolean;
  /** Só para a vitrine: mostra o item como se estivesse com o foco do teclado. */
  foco?: boolean;
};

export function MenuLista({
  itens,
  aoEscolher,
}: {
  itens: ItemMenu[];
  aoEscolher?: (id: string) => void;
}) {
  return (
    <div
      role="menu"
      className="flex w-full min-w-56 flex-col gap-mini rounded-card border border-borda bg-superficie p-pequeno shadow-card"
    >
      {itens.map((item) => {
        const comErro = Boolean(item.erro);
        const desenho = item.carregando ? LoaderCircle : comErro ? CircleAlert : item.icone;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.desativado || item.carregando}
            aria-busy={item.carregando || undefined}
            data-foco={item.foco || undefined}
            onClick={() => aoEscolher?.(item.id)}
            className={`flex min-h-toque w-full items-center gap-medio rounded-medio px-medio py-pequeno text-left font-bold enabled:hover:bg-fundo ${
              item.perigo || comErro ? "text-perigo" : "text-texto"
            } ${item.desativado ? "cursor-not-allowed opacity-50" : item.carregando ? "cursor-progress" : "cursor-pointer"}`}
          >
            <Icone icone={desenho} girar={item.carregando} />
            <span className="flex flex-col">
              {item.rotulo}
              {item.erro && <span className="text-detalhe font-normal">{item.erro}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Menu({
  rotulo,
  icone = EllipsisVertical,
  itens,
  aoEscolher,
}: {
  rotulo: string;
  icone?: LucideIcon;
  itens: ItemMenu[];
  aoEscolher?: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        gatilho.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const botoes = Array.from(
          raiz.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
        );
        if (!botoes.length) return;
        const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
        const passo = e.key === "ArrowDown" ? 1 : -1;
        botoes[(atual + passo + botoes.length) % botoes.length].focus();
      }
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative inline-block">
      <button
        ref={gatilho}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={rotulo}
        onClick={() => setAberto((v) => !v)}
        className="grid size-toque cursor-pointer place-items-center rounded-pilula border border-borda bg-superficie text-texto hover:border-destaque"
      >
        <Icone icone={icone} />
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-10 mt-pequeno">
          <MenuLista
            itens={itens}
            aoEscolher={(id) => {
              setAberto(false);
              aoEscolher?.(id);
            }}
          />
        </div>
      )}
    </div>
  );
}
