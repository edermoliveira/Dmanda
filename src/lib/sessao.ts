// Regras de sessão e de conta autorizada do Dmanda (DECISOES.md, decisão 27). Sem dependências, para poder ser testada isoladamente.
//
// A sessão é a do próprio Supabase Auth: o token de acesso dura pouco e é renovado sozinho pelo token de renovação (que não expira por inatividade), e os cookies são
// regravados pelo servidor a cada renovação. Não existe mais o encerramento artificial após 6 horas sem uso: a sessão só termina na saída explícita (Sair, que vale só
// neste navegador), quando o Supabase a revoga ou a invalida, ou quando a conta deixa de ser a autorizada.

/**
 * Cookie da regra antiga das 6 horas. Não é mais lido para decidir nada: a ausência ou o vencimento dele nunca encerra uma sessão válida. O nome existe só para
 * o servidor apagá-lo dos navegadores onde ele ficou gravado.
 */
export const COOKIE_LEGADO_ULTIMO_USO = 'dmanda-ultimo-uso';

/** Cookies de sessão do Supabase (um ou vários pedaços): "sb-<projeto>-auth-token" e "sb-<projeto>-auth-token.0". */
export const ehCookieDeSessao = (nome: string) => /^sb-.+-auth-token(\.\d+)?$/.test(nome);

export type SituacaoAuth = 'ok' | 'sem-sessao' | 'transitoria' | 'invalida';
type ErroAuth = { name?: string; status?: number; code?: string } | null | undefined;

/**
 * Classifica o resultado de uma conferência da sessão no Supabase Auth.
 *  - "ok": sem erro.
 *  - "sem-sessao": não há sessão (nenhum cookie, ou a sessão foi removida do aparelho).
 *  - "transitoria": falha de rede, servidor de Auth fora do ar (5xx) ou limite de requisições: a sessão pode estar perfeita, só não foi possível confirmar agora.
 *    Nunca se apaga a sessão por isso e nunca se libera o acesso sem a confirmação.
 *  - "invalida": o Auth recusou a sessão (token de renovação inexistente ou já usado, sessão revogada, token inválido): é preciso entrar de novo.
 */
export function situacaoDoErroAuth(erro: ErroAuth): SituacaoAuth {
  if (!erro) return 'ok';
  if (erro.name === 'AuthSessionMissingError') return 'sem-sessao';
  if (erro.name === 'AuthRetryableFetchError' || erro.status === 0 || erro.status === 429 || erro.status === 408 || (typeof erro.status === 'number' && erro.status >= 500) || erro.code === 'over_request_rate_limit') return 'transitoria';
  return 'invalida';
}

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
