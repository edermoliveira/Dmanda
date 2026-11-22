'use server';
// Consome o link de convite ou de recuperação (token_hash de uso único e com validade, do Auth). Só os tipos invite e recovery; qualquer outro é recusado. Depois da verificação o BANCO confere se o endereço
// ainda está autorizado (uma revogação entre o convite e o clique impede a entrada).
import { redirect } from 'next/navigation';
import { clienteDaSessao } from './sessao';
import type { RespostaForm } from './autenticacao';

export async function confirmarLink(tokenHash: string, tipo: string): Promise<RespostaForm> {
  if (typeof tokenHash !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(tokenHash) || (tipo !== 'invite' && tipo !== 'recovery')) return { erro: 'Este link não é válido. Peça um novo.' };
  const sb = await clienteDaSessao();
  const { error } = await sb.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  if (error) {
    if (/fetch|network|timeout/i.test(error.message) || (error.status ?? 0) >= 500) return { erro: 'Não foi possível falar com o serviço de acesso agora. O link continua valendo: tente de novo.' };
    return { erro: 'Este link expirou ou já foi usado. Peça um novo.' };
  }
  const { data: estado } = await sb.rpc('estado_acesso');
  if (!estado?.autorizado) {
    await sb.auth.signOut({ scope: 'local' });
    return { erro: 'Este acesso foi revogado ou não está autorizado. Fale com a administradora.' };
  }
  redirect('/definir-senha');
}
