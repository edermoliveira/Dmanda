"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CircleAlert, X } from "lucide-react";
import { Icone } from "./Icone";

type ConteudoProps = {
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  erro?: string;
  carregando?: boolean;
  aoFechar?: () => void;
  /** Só para a vitrine: mostra o botão de fechar como se estivesse com o foco do teclado. */
  focoNoFechar?: boolean;
};

export function JanelaConteudo({ titulo, children, rodape, erro, carregando, aoFechar, focoNoFechar }: ConteudoProps) {
  return (
    <div
      aria-busy={carregando || undefined}
      className="flex w-full flex-col gap-grande rounded-card border border-borda bg-superficie p-grande text-texto shadow-card"
    >
      <div className="flex items-start justify-between gap-normal">
        <h2 className="text-subtitulo">{titulo}</h2>
        <button
          type="button"
          aria-label="Fechar"
          onClick={aoFechar}
          data-foco={focoNoFechar || undefined}
          className="-mr-pequeno -mt-pequeno grid size-toque shrink-0 cursor-pointer place-items-center rounded-pilula text-texto hover:bg-fundo"
        >
          <Icone icone={X} />
        </button>
      </div>
      {erro && (
        <div role="alert" className="flex items-start gap-medio rounded-medio bg-perigo-suave p-medio text-perigo">
          <Icone icone={CircleAlert} />
          <span>{erro}</span>
        </div>
      )}
      <div>{children}</div>
      {rodape && <div className="flex flex-wrap justify-end gap-medio">{rodape}</div>}
    </div>
  );
}

type JanelaProps = ConteudoProps & { aberta: boolean; aoFechar: () => void };

// Janela de verdade: usa o <dialog> do navegador, que já prende o foco dentro dela e fecha com Esc.
export function Janela({ aberta, aoFechar, ...conteudo }: JanelaProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberta && !dialogo.open) dialogo.showModal();
    if (!aberta && dialogo.open) dialogo.close();
  }, [aberta]);

  return (
    <dialog
      ref={ref}
      aria-label={conteudo.titulo}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
      className="m-auto w-[min(32rem,calc(100%-2rem))] bg-transparent p-0 text-texto backdrop:bg-texto/40"
    >
      <JanelaConteudo {...conteudo} aoFechar={aoFechar} />
    </dialog>
  );
}
