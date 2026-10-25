import type { Metadata, Viewport } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import '@/estilos/estilo.css';
import '@/estilos/tema.css';
import '@/estilos/v3.css';
import '@/estilos/v4.css';
import '@/estilos/v5.css';
import '@/estilos/catalyst.css';
import '@/estilos/app.css';

const inter = Inter({ subsets: ['latin'], variable: '--f-inter', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-mono', display: 'swap' });

export const metadata: Metadata = { title: 'Dmanda', description: 'Demandas do Secretário de Administração' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Define o modo (claro ou escuro) antes da página aparecer, para não piscar: usa a escolha guardada ou, na primeira vez, a do sistema.
const scriptTema = `(function(){try{var t=JSON.parse(localStorage.getItem("dmanda-tema"));if(t!=="claro"&&t!=="escuro"){t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro"}document.documentElement.dataset.tema=t}catch(e){document.documentElement.dataset.tema="claro"}})()`;

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: scriptTema }} /></head>
      <body>{children}</body>
    </html>
  );
}
