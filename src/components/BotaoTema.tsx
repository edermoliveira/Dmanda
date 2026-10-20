"use client";

import { Moon, Sun } from "lucide-react";
import { Icone } from "./Icone";

function trocarTema() {
  const raiz = document.documentElement;
  const novo = raiz.dataset.tema === "escuro" ? "claro" : "escuro";
  raiz.dataset.tema = novo;
  try {
    localStorage.setItem("dmanda-tema", novo);
  } catch {
    // sem armazenamento: o tema vale só até recarregar
  }
}

export function BotaoTema() {
  return (
    <button
      type="button"
      onClick={trocarTema}
      className="inline-flex min-h-toque cursor-pointer items-center gap-pequeno rounded-pilula border border-borda bg-superficie px-normal py-pequeno font-bold text-texto shadow-card transition-colors hover:border-destaque"
    >
      <span className="so-no-claro inline-flex items-center gap-pequeno">
        <Icone icone={Moon} />
        Tema escuro
      </span>
      <span className="so-no-escuro inline-flex items-center gap-pequeno">
        <Icone icone={Sun} />
        Tema claro
      </span>
    </button>
  );
}
