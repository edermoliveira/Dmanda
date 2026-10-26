import type { Metadata, Viewport } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import '@/estilos/estilo.css';
import '@/estilos/tema.css';
import '@/estilos/v3.css';
import '@/estilos/v4.css';
import '@/estilos/v5.css';
import '@/estilos/catalyst.css';
import '@/estilos/app.css';
import { coresDaBarra } from '@/lib/cores-barra';

const inter = Inter({ subsets: ['latin'], variable: '--f-inter', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Dmanda',
  description: 'Demandas do Secretário de Administração',
  // iPhone e iPad: abre em tela cheia ao instalar pela tela de início. O ícone de início vem de src/app/apple-icon.png e o manifesto de src/app/manifest.ts.
  appleWebApp: { capable: true, title: 'Dmanda', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  // painel pessoal e privado: nada de indexação por buscadores
  robots: { index: false, follow: false },
};
// Cor da barra do sistema: o fundo de cada tema, lido dos tokens (catalyst.css, --bgbase) por coresDaBarra(); o metadado não aceita variáveis de CSS.
export function generateViewport(): Viewport {
  const { claro, escuro } = coresDaBarra();
  return {
    width: 'device-width', initialScale: 1, viewportFit: 'cover',
    themeColor: [{ media: '(prefers-color-scheme: light)', color: claro }, { media: '(prefers-color-scheme: dark)', color: escuro }],
  };
}

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
