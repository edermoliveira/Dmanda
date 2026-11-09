import type { Metadata, Viewport } from 'next';
import {
  DM_Mono, DM_Sans, DM_Serif_Display, Fira_Code, Fraunces, IBM_Plex_Mono, Inter, JetBrains_Mono, Manrope, Nunito_Sans, Outfit, Plus_Jakarta_Sans, Playfair_Display,
  Sora, Source_Sans_3, Space_Grotesk, Space_Mono,
} from 'next/font/google';
import '@/estilos/estilo.css';
import '@/estilos/tema.css';
import '@/estilos/v3.css';
import '@/estilos/v4.css';
import '@/estilos/v5.css';
import '@/estilos/catalyst.css';
import '@/estilos/app.css';
import '@/estilos/agenda.css';
import '@/estilos/seletor.css';
import { coresDaBarra } from '@/lib/cores-barra';

const inter = Inter({ subsets: ['latin'], variable: '--f-inter', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-mono', display: 'swap' });

// Fontes opcionais de Configurações > Fontes (lib/aparencia.ts): só são baixadas pelo navegador quando alguma delas é escolhida (sem pré-carga).
const o1 = Sora({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-sora' });
const o2 = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-jakarta' });
const o3 = DM_Serif_Display({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--f-dmserif' });
const o4 = Fraunces({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-fraunces' });
const o5 = Manrope({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-manrope' });
const o6 = Space_Grotesk({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-grotesk' });
const o7 = Playfair_Display({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-playfair' });
const o8 = Outfit({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-outfit' });
const o9 = DM_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-dmsans' });
const o10 = Source_Sans_3({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-source' });
const o11 = Nunito_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-nunito' });
const o12 = JetBrains_Mono({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-jetbrains' });
const o13 = DM_Mono({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '500'], variable: '--f-dmmono' });
const o14 = Space_Mono({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '700'], variable: '--f-spacemono' });
const o15 = Fira_Code({ subsets: ['latin'], display: 'swap', preload: false, variable: '--f-fira' });
const opcionais = [o1.variable, o2.variable, o3.variable, o4.variable, o5.variable, o6.variable, o7.variable, o8.variable, o9.variable, o10.variable, o11.variable, o12.variable, o13.variable, o14.variable, o15.variable].join(' ');

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
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable} ${opcionais}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: scriptTema }} /></head>
      <body>{children}</body>
    </html>
  );
}
