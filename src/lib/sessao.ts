// Regra de sessão do Dmanda (DECISOES.md): novo login depois de 6 horas sem uso. Sem dependências, para poder ser testada isoladamente.
export const LIMITE_SEM_USO_MS = 6 * 60 * 60 * 1000;
export const COOKIE_ULTIMO_USO = 'dmanda-ultimo-uso';

/** Diferença de relógio tolerada entre o carimbo e o servidor (marca "no futuro" além disso é adulteração). */
const TOLERANCIA_RELOGIO_MS = 60_000;

/**
 * true se a sessão deve terminar: passou mais que o limite desde o último uso, ou a marca não existe, é ilegível ou está no futuro.
 * Sem marca vale como expirada (falha fechada): quem apaga o cookie não prolonga a sessão. O login grava a marca ao entrar.
 */
export function sessaoExpirou(ultimoUso: string | undefined | null, agora: number = Date.now()): boolean {
  if (!ultimoUso) return true;
  const t = Number(ultimoUso);
  if (!Number.isFinite(t)) return true;
  if (t > agora + TOLERANCIA_RELOGIO_MS) return true;
  return agora - t > LIMITE_SEM_USO_MS;
}

/** Atributos do cookie do último uso (só o servidor lê; não é legível por scripts da página). "secure" só quando a conexão é HTTPS (no localhost em http o cookie seria descartado por alguns navegadores). */
export const opcoesCookieUltimoUso = (https: boolean) => ({ httpOnly: true, sameSite: 'lax', secure: https, maxAge: 60 * 60 * 24 * 30, path: '/' }) as const;

/** Conta única autorizada, por e-mail (DMANDA_EMAIL_AUTORIZADO). Sem a variável, ninguém passa: o padrão é fechado. */
export function emailAutorizado(email: string | undefined | null, configurado: string | undefined = process.env.DMANDA_EMAIL_AUTORIZADO): boolean {
  if (!email || !configurado) return false;
  return email.trim().toLowerCase() === configurado.trim().toLowerCase();
}

/** Provedores de entrada aceitos para a conta única: Google e e-mail e senha (Supabase Auth). Qualquer outro é recusado. */
export const PROVEDORES_ACEITOS = ['google', 'email'];

/**
 * Conta autorizada de verdade: e-mail igual ao configurado E provedor aceito (Google ou e-mail e senha). O provedor é lido de app_metadata, que só
 * o servidor de Auth define (user_metadata e o nome de exibição podem ser editados pelo usuário e nunca entram nesta decisão). Um usuário criado
 * pelo Google continua com provider "google" depois de ganhar senha; por isso os dois valores valem.
 */
export function contaAutorizada(
  user: { email?: string | null; app_metadata?: { provider?: string } } | null | undefined,
  configurado: string | undefined = process.env.DMANDA_EMAIL_AUTORIZADO,
): boolean {
  return !!user && PROVEDORES_ACEITOS.includes(user.app_metadata?.provider ?? '') && emailAutorizado(user.email, configurado);
}
