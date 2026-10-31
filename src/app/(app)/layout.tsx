import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/estilos/estilo.css';
import '@/estilos/tema.css';
import '@/estilos/v3.css';
import '@/estilos/v4.css';
import '@/estilos/v5.css';
import '@/estilos/catalyst.css';
import '@/estilos/app.css';
import '@/estilos/orbita.css';
import { coresDaBarra } from '@/lib/cores-barra';
import { modoDemo } from '@/lib/demo';

const inter = Inter({ subsets: ['latin'], variable: '--f-inter', display: 'swap' });

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

// Define modo, tamanho do texto e cores personalizadas antes da página aparecer, para não piscar: usa a escolha guardada neste aparelho e, na primeira vez, o claro.
const scriptTema = `(function(){var d=document.documentElement;try{var t=JSON.parse(localStorage.getItem("dmanda-tema"));t=t==="escuro"?"escuro":"claro";d.dataset.tema=t;var v=JSON.parse(localStorage.getItem("dmanda:vars"));if(v){if(v.esc>=0.85&&v.esc<=1.3)d.style.setProperty("--esc",String(v.esc));var m=v[t]||{};for(var k in m)if(/^--u-/.test(k))d.style.setProperty(k,m[k])}}catch(e){d.dataset.tema="claro"}})()`;

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: modoDemo() ? `window.__DMANDA_DEMO__=true;${scriptTema}` : scriptTema }} /></head>
      <body>{children}</body>
    </html>
  );
}
