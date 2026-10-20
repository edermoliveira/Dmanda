import type { ButtonHTMLAttributes } from "react";
import { CircleAlert, LoaderCircle, type LucideIcon } from "lucide-react";
import { Icone } from "./Icone";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "perigo";
  carregando?: boolean;
  erro?: boolean;
  icone?: LucideIcon;
};

const variantes = {
  primario: "bg-destaque text-sobre-destaque hover:brightness-95",
  secundario: "border border-borda bg-superficie text-texto hover:border-destaque",
  perigo: "bg-perigo text-sobre-perigo hover:brightness-95",
};

export function Botao({
  variante = "primario",
  carregando = false,
  erro = false,
  icone,
  disabled,
  type = "button",
  className = "",
  children,
  ...resto
}: Props) {
  const cor = erro ? "border border-perigo bg-perigo-suave text-perigo" : variantes[variante];
  const desenho = carregando ? LoaderCircle : erro ? CircleAlert : icone;
  const estado = disabled
    ? "cursor-not-allowed opacity-50"
    : carregando
      ? "cursor-progress"
      : "cursor-pointer";

  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`inline-flex min-h-toque items-center justify-center gap-pequeno rounded-pilula px-grande py-pequeno font-bold transition-[filter,border-color] ${cor} ${estado} ${className}`}
      {...resto}
    >
      {desenho && <Icone icone={desenho} girar={carregando} />}
      {children}
    </button>
  );
}
