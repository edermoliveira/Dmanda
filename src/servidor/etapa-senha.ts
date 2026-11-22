// Etapa de definição de senha (decisão 92, fechamento): a PROVA de que esta sessão nasceu de um link de convite ou de recuperação VALIDADO pelo Auth. Ter uma sessão comum não basta.
// Por quê: a versão instalada do Auth (auth-js 2.118) não oferece no token um método que distinga recuperação ou convite (os métodos de amr tipados não incluem "recovery" nem "invite"), e parâmetros
// de URL, campos do formulário e metadados do usuário são editáveis. Então o SERVIDOR emite, só depois do verifyOtp bem-sucedido, um cookie HTTP-only assinado (HMAC-SHA256 com DMANDA_SEGREDO_FLUXO) com:
// finalidade, usuário (sub) e sessão (session_id) do JWT recém-emitido, validade de 15 minutos e um identificador único. definirSenha confere assinatura, validade, usuário e sessão, e o banco
// (consumir_etapa_senha) garante o uso único. Nada disso contém senha, token ou o link; o cookie é apagado ao concluir.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export type Finalidade = 'invite' | 'recovery';
export type Etapa = { f: Finalidade; sub: string; sid: string; exp: number; n: string };

const COOKIE = 'dmanda-etapa-senha';
export const VALIDADE_ETAPA_S = 15 * 60;

/** O segredo da assinatura (só no servidor). Sem ele (ou curto demais) a etapa não é emitida e a definição de senha recusa: falha fechada. */
function segredo(): string | null {
  const s = process.env.DMANDA_SEGREDO_FLUXO ?? '';
  return s.length >= 32 ? s : null;
}
const assinar = (corpo: string, chave: string) => createHmac('sha256', chave).update(corpo).digest('base64url');

export async function emitirEtapa(f: Finalidade, sub: string, sid: string): Promise<boolean> {
  const chave = segredo();
  if (!chave || !sub || !sid) return false;
  const etapa: Etapa = { f, sub, sid, exp: Math.floor(Date.now() / 1000) + VALIDADE_ETAPA_S, n: randomUUID() };
  const corpo = Buffer.from(JSON.stringify(etapa)).toString('base64url');
  (await cookies()).set(COOKIE, `${corpo}.${assinar(corpo, chave)}`, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: VALIDADE_ETAPA_S });
  return true;
}

/** A etapa válida (assinatura certa e dentro da validade), ou null. Não confere usuário nem sessão: quem usa compara com o JWT verificado. */
export async function lerEtapa(): Promise<Etapa | null> {
  const chave = segredo();
  const v = (await cookies()).get(COOKIE)?.value ?? '';
  const [corpo, ass] = v.split('.');
  if (!chave || !corpo || !ass) return null;
  const esperado = Buffer.from(assinar(corpo, chave)), recebido = Buffer.from(ass);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    const e = JSON.parse(Buffer.from(corpo, 'base64url').toString()) as Etapa;
    if ((e.f !== 'invite' && e.f !== 'recovery') || typeof e.sub !== 'string' || typeof e.sid !== 'string' || typeof e.n !== 'string') return null;
    return e.exp > Math.floor(Date.now() / 1000) ? e : null;
  } catch { return null; }
}

export async function apagarEtapa(): Promise<void> {
  try { (await cookies()).delete(COOKIE); } catch { /* fora de ação do servidor: o cookie vence sozinho em 15 minutos */ }
}
