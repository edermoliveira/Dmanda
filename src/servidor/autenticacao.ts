'use server';
// Ações de autenticação (decisão 92): entrar, sair deste aparelho, pedir recuperação, definir a senha (convite ou recuperação) e alterar a própria senha.
// A senha só existe dentro destas ações: nunca é gravada, registrada, enviada a rascunho nem devolvida. As mensagens de erro não revelam se um e-mail existe.
import { redirect } from 'next/navigation';
import { clienteDaSessao, clienteAvulso, usuarioAtual } from './sessao';
import { modoTeste } from '@/lib/supabase/config';

export type RespostaForm = { erro: string } | { ok: true; aviso?: string };

const MIN_SENHA = 10;
const emailValido = (e: string) => e.length <= 254 && /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/.test(e);
const REDE = 'Não foi possível falar com o serviço de acesso agora. Nada foi perdido: tente de novo.';

/** Só caminhos internos: "/x" sim; "//x", "http://x" e "/\x" não (nada de redirecionamento aberto). */
export async function destinoSeguro(p: unknown): Promise<string> {
  return typeof p === 'string' && /^\/(?![/\\])[^\s]*$/.test(p) && !p.startsWith('/login') ? p : '/';
}

export async function entrar(email: string, senha: string, proximo?: string): Promise<RespostaForm> {
  const e = String(email ?? '').trim().toLowerCase();
  if (!emailValido(e) || !senha) return { erro: 'Informe o e-mail e a senha.' };
  if (modoTeste()) return { erro: 'No modo de teste não há tela de entrada: a identidade vem do ambiente de teste.' };
  const sb = await clienteDaSessao();
  const { error } = await sb.auth.signInWithPassword({ email: e, password: String(senha) });
  if (error) {
    if (/fetch|network|timeout|retryable/i.test(`${error.name} ${error.message}`) || error.status === 0 || (error.status ?? 0) >= 500) return { erro: REDE };
    return { erro: 'E-mail ou senha incorretos.' };
  }
  // a autorização é do banco: uma conta fora da lista, ou revogada, não passa mesmo sabendo a senha
  const { data: estado } = await sb.rpc('estado_acesso');
  if (!estado?.autorizado) {
    await sb.auth.signOut({ scope: 'local' });
    return { erro: 'Este e-mail não tem acesso ao Dmanda. Peça à administradora para autorizar o endereço.' };
  }
  redirect(await destinoSeguro(proximo));
}

/** Sai SÓ deste aparelho (scope local): as sessões dos outros aparelhos continuam. */
export async function sair(): Promise<void> {
  if (!modoTeste()) { const sb = await clienteDaSessao(); await sb.auth.signOut({ scope: 'local' }); }
  redirect('/login');
}

/** Pede o e-mail de recuperação. A resposta é sempre a mesma, exista o endereço ou não (sem enumeração de contas); o banco só deixa criar o usuário de endereço autorizado, e o Auth só envia a quem existe. */
export async function pedirRecuperacao(email: string): Promise<RespostaForm> {
  const e = String(email ?? '').trim().toLowerCase();
  if (!emailValido(e)) return { erro: 'Informe um e-mail válido.' };
  if (!modoTeste()) {
    const { error } = await clienteAvulso().auth.resetPasswordForEmail(e);
    if (error && ((error.status ?? 0) >= 500 || /fetch|network/i.test(error.message))) return { erro: REDE };
  }
  return { ok: true, aviso: 'Se o endereço tiver acesso ao Dmanda, o link para definir uma nova senha foi enviado. Confira também a caixa de spam.' };
}

function validarSenha(nova: string, confirmacao: string): string | null {
  if (nova.length < MIN_SENHA) return `Use pelo menos ${MIN_SENHA} caracteres.`;
  if (nova.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
  if (nova !== confirmacao) return 'A confirmação não é igual à senha.';
  return null;
}

/** Define a senha de quem chegou pelo link do convite ou da recuperação (já tem sessão pelo link, que é de uso único). */
export async function definirSenha(nova: string, confirmacao: string): Promise<RespostaForm> {
  const falha = validarSenha(String(nova ?? ''), String(confirmacao ?? ''));
  if (falha) return { erro: falha };
  if (!(await usuarioAtual())) return { erro: 'O link expirou ou já foi usado. Peça um novo.' };
  const sb = await clienteDaSessao();
  const { error } = await sb.auth.updateUser({ password: nova });
  if (error) return { erro: /same|different/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : /weak|short|characters/i.test(error.message) ? 'A senha foi recusada por ser fraca. Use outra.' : REDE };
  redirect('/');
}

/** Altera a própria senha: confere a senha atual num cliente separado (sem trocar a sessão) e só então atualiza. */
export async function alterarSenha(atual: string, nova: string, confirmacao: string): Promise<RespostaForm> {
  const falha = validarSenha(String(nova ?? ''), String(confirmacao ?? ''));
  if (falha) return { erro: falha };
  if (modoTeste()) return { erro: 'No modo de teste não há senha.' };
  const u = await usuarioAtual();
  if (!u?.email) return { erro: 'Sua sessão terminou. Entre de novo.' };
  const { error: errAtual } = await clienteAvulso().auth.signInWithPassword({ email: u.email, password: String(atual ?? '') });
  if (errAtual) return { erro: 'A senha atual não confere.' };
  const sb = await clienteDaSessao();
  const { error } = await sb.auth.updateUser({ password: nova });
  if (error) return { erro: /same|different/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : REDE };
  return { ok: true, aviso: 'Senha alterada. Os outros aparelhos continuam conectados.' };
}
