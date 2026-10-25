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
