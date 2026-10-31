// Modo de demonstração da prévia visual: dados fictícios guardados só na memória do navegador, sem Supabase, sem segundo projeto e sem banco no servidor.
// Liga em dois casos, ambos fora da produção: (1) implantação de PRÉVIA da Vercel de uma branch "visual/..." (VERCEL_ENV e VERCEL_GIT_COMMIT_REF são variáveis
// que a própria Vercel define); (2) desenvolvimento local com DMANDA_DEMO=sim. Em produção (VERCEL_ENV=production ou NODE_ENV=production sem ser prévia) nunca liga.
export function modoDemo(): boolean {
  const e = process.env;
  if (e.VERCEL_ENV === 'preview') return (e.VERCEL_GIT_COMMIT_REF ?? '').startsWith('visual/');
  if (e.VERCEL_ENV === 'production') return false;
  return e.DMANDA_DEMO === 'sim' && e.NODE_ENV !== 'production';
}
