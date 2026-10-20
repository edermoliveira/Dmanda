import type { HTMLAttributes } from "react";
import { CircleAlert } from "lucide-react";
import { Icone } from "./Icone";

type Props = HTMLAttributes<HTMLElement> & {
  nome: string;
  tamanho?: "normal" | "grande";
  carregando?: boolean;
  erro?: boolean;
  desativado?: boolean;
  /** Vira um botão (pode receber foco e clique). */
  interativo?: boolean;
};

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const duas = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0]?.slice(0, 2);
  return (duas ?? "").toUpperCase();
}

export function Avatar({
  nome,
  tamanho = "normal",
  carregando = false,
  erro = false,
  desativado = false,
  interativo = false,
  className = "",
  ...resto
}: Props) {
  const medida = tamanho === "grande" ? "size-gigante text-subtitulo" : "size-enorme text-detalhe";
  const cor = carregando
    ? "animate-pulse motion-reduce:animate-none bg-borda text-transparent"
    : erro
      ? "border-2 border-perigo bg-perigo-suave text-perigo"
      : "bg-destaque text-sobre-destaque";
  const classes = `inline-grid shrink-0 place-items-center rounded-pilula font-bold ${medida} ${cor} ${
    desativado ? "cursor-not-allowed opacity-50 grayscale" : interativo ? "cursor-pointer hover:brightness-95" : ""
  } ${className}`;
  const conteudo = erro && !carregando ? <Icone icone={CircleAlert} /> : iniciais(nome);

  if (interativo) {
    return (
      <button
        type="button"
        disabled={desativado}
        aria-label={`Perfil de ${nome}`}
        aria-busy={carregando || undefined}
        className={classes}
        {...resto}
      >
        {conteudo}
      </button>
    );
  }
  return (
    <span role="img" aria-label={nome} aria-busy={carregando || undefined} className={classes} {...resto}>
      {conteudo}
    </span>
  );
}
