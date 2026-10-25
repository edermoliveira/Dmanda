import type { Metadata } from "next";
import { Averia_Serif_Libre, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fonteTexto = Averia_Serif_Libre({
  variable: "--fonte-texto",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const fonteDetalhe = IBM_Plex_Mono({
  variable: "--fonte-detalhe",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Dmanda",
  description: "Demandas do Secretário de Administração",
};

// Define o tema (claro ou escuro) antes da página aparecer, para não piscar.
// Usa a escolha guardada ou, na primeira vez, a do sistema do usuário.
const scriptTema = `(function(){try{var t=localStorage.getItem("dmanda-tema");if(t!=="claro"&&t!=="escuro"){t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro"}document.documentElement.dataset.tema=t}catch(e){document.documentElement.dataset.tema="claro"}})()`;

// Design antigo (20/10/2026), mantido só como referência em /pecas, /tokens e /marca. O aplicativo novo está em (app) e usa o Catalyst.
export default function LayoutAntigo({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${fonteTexto.variable} ${fonteDetalhe.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
