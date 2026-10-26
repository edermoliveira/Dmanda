import type { MetadataRoute } from 'next';
import { coresDaBarra } from '@/lib/cores-barra';

// Manifesto da PWA (instalação no iPhone, iPad e computador). Só abre o painel online: não há service worker nem cópia offline de dados.
// Cores: o manifesto não aceita variáveis de CSS; o fundo do tema claro vem de src/estilos/catalyst.css (--bgbase), lido por coresDaBarra().
export default function manifest(): MetadataRoute.Manifest {
  const { claro } = coresDaBarra();
  return {
    id: '/',
    name: 'Dmanda',
    short_name: 'Dmanda',
    description: 'Demandas do Secretário de Administração',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: claro,
    theme_color: claro,
    icons: [
      { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icones/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
