import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cor de fundo de cada tema para a barra do sistema e a abertura da PWA. O manifesto e o metadado "theme-color" não aceitam variáveis de CSS, então o valor é lido
 * do arquivo de tokens (--bgbase em src/estilos/orbita.css) na montagem da página, em vez de ficar repetido no código. Se o arquivo mudar de forma e a leitura
 * falhar, a montagem falha de propósito (melhor que uma cor errada em silêncio).
 */
export function coresDaBarra(): { claro: string; escuro: string } {
  const css = readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), 'src', 'estilos', 'orbita.css'), 'utf8');
  const claro = /\[data-tema="claro"\]\s*\{\s*--bgbase:\s*var\(--u-fundo,\s*(#[0-9A-Fa-f]{6})\)/.exec(css)?.[1];
  const escuro = /\[data-tema="escuro"\]\s*\{\s*--bgbase:\s*var\(--u-fundo,\s*(#[0-9A-Fa-f]{6})\)/.exec(css)?.[1];
  if (!claro || !escuro) throw new Error('--bgbase dos temas claro e escuro não encontrado em src/estilos/orbita.css');
  return { claro, escuro };
}
