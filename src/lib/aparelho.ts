// Regras puras da abertura direta em aparelhos autorizados (DECISOES.md, decisão 82). Sem dependências, para serem testadas isoladamente.
// Um aparelho autorizado é uma sessão do Supabase Auth da conta única, registrada no banco pelo session_id do token. A autorização inicial é um código de uso único.

/** Letras e números sem os que se confundem (nada de I, L, O, 0 nem 1): 31 símbolos, 8 posições, cerca de 40 bits, válido por 10 minutos e de uso único. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TAMANHO_CODIGO = 8;
export const VALIDADE_CONVITE_MINUTOS = 10;
export const VALIDADE_APARELHO_DIAS = 90;

/** Gera um código com um sorteio criptográfico fornecido por quem chama (`sorteio(n)` devolve um inteiro de 0 a n-1; no servidor, crypto.randomInt). */
export const gerarCodigo = (sorteio: (n: number) => number): string => Array.from({ length: TAMANHO_CODIGO }, () => ALFABETO_CODIGO[sorteio(ALFABETO_CODIGO.length)]).join('');

/** O que a pessoa digitou, pronto para conferir: sem espaços nem hífens, em maiúsculas. */
export const normalizarCodigo = (v: string): string => v.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const codigoValido = (v: string): boolean => new RegExp(`^[${ALFABETO_CODIGO}]{${TAMANHO_CODIGO}}$`).test(v);

/** "ABCD-2345": como o código aparece na tela. */
export const formatarCodigo = (c: string): string => `${c.slice(0, 4)}-${c.slice(4)}`;

/** Nome legível do aparelho, tirado do navegador (só para a pessoa reconhecer o aparelho na lista): "iPhone · Safari", "Computador · Edge". Nunca guarda o texto bruto. */
export function nomeDoAparelho(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  const aparelho = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua)) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Aparelho';
  const navegador = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return navegador ? `${aparelho} · ${navegador}` : aparelho;
}

/** O session_id que todo token de acesso do Supabase traz (conferido pelo Auth e pelo banco; aqui só se lê para registrar o aparelho). */
export function sessaoDoToken(token: string | null | undefined): string | null {
  try {
    const carga = JSON.parse(atob((String(token ?? '').split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as { session_id?: unknown };
    return typeof carga.session_id === 'string' && /^[0-9a-f-]{36}$/i.test(carga.session_id) ? carga.session_id : null;
  } catch {
    return null;
  }
}

/** Há quanto tempo, em palavras curtas, para a lista de aparelhos. `agora` vem de fora. */
export function haQuanto(iso: string, agora: Date): string {
  const min = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 2) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}
