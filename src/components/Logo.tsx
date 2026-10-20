import { LOGO_CAMINHO } from "./logo-dados";

type Props = {
  /** "completo" = símbolo + nome. "simbolo" = só o D com as três colunas. */
  variante?: "completo" | "simbolo";
  /** Classes de tamanho e cor do símbolo (padrão: 48 px na cor de destaque). */
  className?: string;
  /** Classes do nome, na variante completa. */
  nomeClassName?: string;
};

export function Logo({
  variante = "completo",
  className = "size-gigante fill-destaque",
  nomeClassName = "text-titulo text-texto",
}: Props) {
  const simbolo = (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} role="img" aria-label="Dmanda">
      <path fillRule="evenodd" d={LOGO_CAMINHO} />
    </svg>
  );
  if (variante === "simbolo") return simbolo;
  return (
    <span className="inline-flex items-center gap-medio">
      {simbolo}
      <span className={`font-bold leading-none ${nomeClassName}`}>Dmanda</span>
    </span>
  );
}
