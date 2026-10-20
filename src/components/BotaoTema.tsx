"use client";

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

const icone = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function BotaoTema() {
  return (
    <button
      type="button"
      onClick={trocarTema}
      className="inline-flex items-center gap-pequeno rounded-pilula border border-borda bg-superficie px-normal py-pequeno text-corpo font-bold text-texto shadow-card transition-colors hover:border-destaque cursor-pointer"
    >
      <span className="so-no-claro inline-flex items-center gap-pequeno">
        <svg {...icone}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
        Tema escuro
      </span>
      <span className="so-no-escuro inline-flex items-center gap-pequeno">
        <svg {...icone}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        Tema claro
      </span>
    </button>
  );
}
