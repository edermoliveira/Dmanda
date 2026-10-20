"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const paginas = [
  { href: "/tokens", rotulo: "Tokens" },
  { href: "/pecas", rotulo: "Peças" },
  { href: "/marca", rotulo: "Marca" },
];

// Atalho entre as páginas do design system.
export function NavPaginas() {
  const atual = usePathname();
  return (
    <nav aria-label="Design system" className="flex flex-wrap gap-pequeno">
      {paginas.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={atual === p.href ? "page" : undefined}
          className={`inline-flex min-h-toque items-center rounded-pilula border px-normal font-bold ${
            atual === p.href
              ? "border-transparent bg-destaque text-sobre-destaque"
              : "border-borda bg-superficie text-texto hover:border-destaque"
          }`}
        >
          {p.rotulo}
        </Link>
      ))}
    </nav>
  );
}
