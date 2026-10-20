import type { HTMLAttributes } from "react";
import { CircleAlert, LoaderCircle, type LucideIcon } from "lucide-react";
import { Icone } from "./Icone";

type Props = HTMLAttributes<HTMLElement> & {
  tom?: "neutra" | "destaque" | "perigo";
  icone?: LucideIcon;
  carregando?: boolean;
  erro?: boolean;
  desativada?: boolean;
  /** Vira um botão (pode receber foco e clique). */
  interativa?: boolean;
};

const tons = {
  neutra: "border border-borda bg-superficie text-texto",
  destaque: "border border-transparent bg-destaque text-sobre-destaque",
  perigo: "border border-transparent bg-perigo text-sobre-perigo",
};

export function Etiqueta({
  tom = "neutra",
  icone,
  carregando = false,
  erro = false,
  desativada = false,
  interativa = false,
  className = "",
  children,
  ...resto
}: Props) {
  const cor = erro ? "border border-perigo bg-perigo-suave text-perigo" : tons[tom];
  const desenho = carregando ? LoaderCircle : erro ? CircleAlert : icone;
  const classes = `inline-flex items-center gap-mini rounded-pilula px-medio py-mini font-mono text-detalhe ${cor} ${
    desativada ? "cursor-not-allowed opacity-50" : interativa ? "cursor-pointer hover:brightness-95" : ""
  } ${className}`;
  const conteudo = (
    <>
      {desenho && <Icone icone={desenho} girar={carregando} />}
      {children}
    </>
  );

  if (interativa) {
    return (
      <button
        type="button"
        disabled={desativada}
        aria-busy={carregando || undefined}
        className={classes}
        {...resto}
      >
        {conteudo}
      </button>
    );
  }
  return (
    <span aria-busy={carregando || undefined} className={classes} {...resto}>
      {conteudo}
    </span>
  );
}
