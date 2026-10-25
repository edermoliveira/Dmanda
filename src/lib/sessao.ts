// Regra de sessão do Dmanda (DECISOES.md): novo login depois de 6 horas sem uso. Sem dependências, para poder ser testada isoladamente.
export const LIMITE_SEM_USO_MS = 6 * 60 * 60 * 1000;
export const COOKIE_ULTIMO_USO = 'dmanda-ultimo-uso';

/** true se passou mais que o limite desde o último uso (cookie ausente ou ilegível: ainda não expirou, o próprio login vale como uso). */
export function sessaoExpirou(ultimoUso: string | undefined | null, agora: number = Date.now()): boolean {
  if (!ultimoUso) return false;
  const t = Number(ultimoUso);
  if (!Number.isFinite(t)) return false;
  return agora - t > LIMITE_SEM_USO_MS;
}

/** Conta única autorizada, por e-mail (DMANDA_EMAIL_AUTORIZADO). Sem a variável, ninguém passa: o padrão é fechado. */
export function emailAutorizado(email: string | undefined | null, configurado: string | undefined = process.env.DMANDA_EMAIL_AUTORIZADO): boolean {
  if (!email || !configurado) return false;
  return email.trim().toLowerCase() === configurado.trim().toLowerCase();
}

/**
 * Conta autorizada de verdade: e-mail igual ao configurado E identidade vinda do Google. O provedor é lido de app_metadata, que só o servidor de
 * Auth define (user_metadata e o nome de exibição podem ser editados pelo usuário e nunca entram nesta decisão).
 */
export function contaAutorizada(
  user: { email?: string | null; app_metadata?: { provider?: string } } | null | undefined,
  configurado: string | undefined = process.env.DMANDA_EMAIL_AUTORIZADO,
): boolean {
  return !!user && user.app_metadata?.provider === 'google' && emailAutorizado(user.email, configurado);
}
