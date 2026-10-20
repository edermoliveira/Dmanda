import type { LucideIcon } from "lucide-react";

// Único jeito de mostrar ícone no sistema: sempre Lucide, sempre do mesmo tamanho (size-icone).
export function Icone({ icone: Desenho, girar = false }: { icone: LucideIcon; girar?: boolean }) {
  return (
    <Desenho
      aria-hidden
      strokeWidth={2}
      className={`size-icone shrink-0 ${girar ? "animate-spin motion-reduce:animate-none" : ""}`}
    />
  );
}
