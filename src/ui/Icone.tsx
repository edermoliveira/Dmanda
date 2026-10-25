import { ICONES_NAV, ICONOIR, LUCIDE } from '@/lib/icones-dados';

/** Ícone do Dmanda: mesma lógica do protótipo (função ic). Os ícones já escolhidos (Ionicons) entram inline para herdar a cor; os demais usam Iconoir e, na falta, Lucide. */
export function Icone({ nome, extra = '' }: { nome: string; extra?: string }) {
  const ion = ICONES_NAV[nome];
  const classes = extra.replace(/\bsol\b/, '').trim();
  if (ion) return <svg className={`ic ion ${classes}`.trim()} viewBox="0 0 512 512" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ion }} />;
  const corpo = ICONOIR[nome] || LUCIDE[nome] || '';
  return <svg className={`ic ${classes}`.trim()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: corpo }} />;
}

export const LOGO = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path fill="currentColor" fillRule="evenodd" d="M10 4H32A28 28 0 0 1 32 60H10A6 6 0 0 1 4 54V10A6 6 0 0 1 10 4ZM16 16H18A3 3 0 0 1 21 19V45A3 3 0 0 1 18 48H16A3 3 0 0 1 13 45V19A3 3 0 0 1 16 16ZM28 16H30A3 3 0 0 1 33 19V35A3 3 0 0 1 30 38H28A3 3 0 0 1 25 35V19A3 3 0 0 1 28 16ZM40 16H42A3 3 0 0 1 45 19V25A3 3 0 0 1 42 28H40A3 3 0 0 1 37 25V19A3 3 0 0 1 40 16Z" />
  </svg>
);
