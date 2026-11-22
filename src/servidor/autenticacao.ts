'use server';
// Ações de autenticação (decisão 92): entrar, sair deste aparelho, pedir recuperação, definir a senha (convite ou recuperação) e alterar a própria senha.
// A senha só existe dentro destas ações: nunca é gravada, registrada, enviada a rascunho nem devolvida. As mensagens de erro não revelam se um e-mail existe.
import { redirect } from 'next/navigation';
import { clienteDaSessao, clienteAvulso, usuarioAtual } from './sessao';
import { apagarEtapa, lerEtapa } from './etapa-senha';
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

/** Mensagem pela resposta do Auth (códigos oficiais da versão instalada), sem repetir o texto do provedor. */
function erroDeSenha(error: { code?: string; message: string; status?: number }): string {
  if (error.code === 'same_password' || /same|different/i.test(error.message)) return 'A nova senha precisa ser diferente da atual.';
  if (error.code === 'weak_password' || /weak|short|characters/i.test(error.message)) return 'A senha foi recusada por ser fraca. Use outra.';
  if (error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid') return 'Por segurança, entre de novo e repita a troca da senha.';
  return REDE;
}

/**
 * Define a senha no PRIMEIRO ACESSO (convite) ou na RECUPERAÇÃO. Só vale com a etapa emitida pelo servidor depois de o Auth validar o link (src/servidor/etapa-senha.ts), do MESMO usuário e da MESMA
 * sessão do JWT verificado agora, dentro da validade e usada uma única vez (o banco confere). Uma sessão comum, um parâmetro de URL ou um campo do formulário não abrem este caminho; quem já tem sessão
 * comum troca a senha pela Conta, provando a senha atual. A autorização precisa estar vigente (o banco recusa conta revogada).
 */
export async function definirSenha(nova: string, confirmacao: string): Promise<RespostaForm> {
  const falha = validarSenha(String(nova ?? ''), String(confirmacao ?? ''));
  if (falha) return { erro: falha };
  if (modoTeste()) return { erro: 'No modo de teste não há senha.' };
  // na recusa a etapa NÃO é apagada aqui: apagar um cookie numa ação faz a página ser redesenhada e a mensagem se perderia. Ela não tem mais serventia (o banco recusa o segundo uso, e usuário
  // e sessão continuam sendo conferidos) e vence sozinha em 15 minutos; só o sucesso a apaga.
  const etapa = await lerEtapa();
  if (!etapa) return { erro: 'Para definir a senha, use o link do convite ou o de recuperação. O link vale por pouco tempo e uma vez só.' };
  const sb = await clienteDaSessao();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims as { sub?: string; session_id?: string } | undefined;
  if (!claims?.sub || claims.sub !== etapa.sub || claims.session_id !== etapa.sid) { return { erro: 'Este pedido não corresponde ao link usado nesta sessão. Peça um novo link.' }; }
  const { data: primeira, error: eUso } = await sb.rpc('consumir_etapa_senha', { p_nonce: etapa.n });
  if (eUso) { return { erro: eUso.code === 'DM403' ? 'Este acesso foi revogado ou não está autorizado. Fale com a administradora.' : REDE }; }
  if (primeira !== true) return { erro: 'Este link já foi usado. Peça um novo.' };
  const { error } = await sb.auth.updateUser({ password: nova });
  if (error) return { erro: erroDeSenha(error) + ' Peça um novo link para tentar de novo.' };
  await apagarEtapa();
  redirect('/');
}

/**
 * Troca a própria senha. Prova adicional: a senha ATUAL, conferida num cliente separado e sem persistência (a sessão deste aparelho não muda); a troca é feita por essa sessão recém-criada, que
 * conta como "entrou há pouco" para a proteção "Secure password change" do Auth, e vai junto o current_password (campo oficial da versão instalada). A sessão auxiliar é encerrada em seguida.
 * Nada usa a API administrativa: a comprovação é sempre a do próprio usuário.
 */
export async function alterarSenha(atual: string, nova: string, confirmacao: string): Promise<RespostaForm> {
  const falha = validarSenha(String(nova ?? ''), String(confirmacao ?? ''));
  if (falha) return { erro: falha };
  if (modoTeste()) return { erro: 'No modo de teste não há senha.' };
  const u = await usuarioAtual();
  if (!u?.email) return { erro: 'Sua sessão terminou. Entre de novo.' };
  const avulso = clienteAvulso();
  const { error: errAtual } = await avulso.auth.signInWithPassword({ email: u.email, password: String(atual ?? '') });
  if (errAtual) return { erro: (errAtual.status ?? 0) >= 500 ? REDE : 'A senha atual não confere.' };
  const { error } = await avulso.auth.updateUser({ password: nova, current_password: String(atual) });
  await avulso.auth.signOut({ scope: 'local' }).catch(() => {});
  if (error) return { erro: erroDeSenha(error) };
  return { ok: true, aviso: 'Senha alterada. Os outros aparelhos continuam conectados.' };
}
