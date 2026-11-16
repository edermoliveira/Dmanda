'use server';
// Ações do servidor da abertura direta em aparelhos autorizados (decisão 82).
//  - autorizarComCodigo: o aparelho novo troca o código de uso único por uma sessão do Supabase Auth da conta única e é registrado no banco pelo session_id do token. Ação pública
//    (a tela /acesso), então tudo é conferido aqui: formato do código, trava de tentativas no banco, conta igual à da lista protegida. Nada de e-mail nem senha digitados.
//  - listarAparelhos, criarConvite e revogarAparelho: só de um aparelho já autorizado (o banco recusa os demais).
// A chave de serviço só existe no servidor. Falha em qualquer passo devolve uma mensagem genérica e não deixa sessão pela metade.
import { headers } from 'next/headers';
import { randomInt } from 'node:crypto';
import { modoTeste } from '@/lib/supabase/config';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { contaAutorizada } from '@/lib/sessao';
import { codigoValido, formatarCodigo, gerarCodigo, nomeDoAparelho, normalizarCodigo, sessaoDoToken } from '@/lib/aparelho';
import { chamar, clienteServico } from './banco';
import { executar } from '@/nucleo/operacoes';

export type ResultadoAutorizacao = { ok: true } | { ok: false; erro: string };
const MSG_GENERICA = 'Não foi possível autorizar este aparelho agora. Tente de novo em instantes.';
const MSG_CODIGO = 'Código inválido ou vencido. Peça um novo código.';
const MSG_LIMITE = 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';

export async function autorizarComCodigo(codigoDigitado: string): Promise<ResultadoAutorizacao> {
  if (modoTeste()) return { ok: false, erro: 'No banco de teste não há autorização de aparelho.' };
  const codigo = normalizarCodigo(String(codigoDigitado ?? ''));
  if (!codigoValido(codigo)) return { ok: false, erro: 'Confira o código: são 8 letras e números.' };
  const email = process.env.DMANDA_EMAIL_AUTORIZADO;
  if (!email) return { ok: false, erro: MSG_GENERICA };
  try {
    const svc = clienteServico();
    const { data: convite, error: erroConvite } = await svc.rpc('consumir_convite_aparelho', { p_codigo: codigo });
    if (erroConvite) return { ok: false, erro: MSG_GENERICA };
    const c = convite as { ok?: boolean; motivo?: string; user_id?: string } | null;
    if (!c?.ok || !c.user_id) return { ok: false, erro: c?.motivo === 'limite' ? MSG_LIMITE : MSG_CODIGO };
    // a sessão nasce no servidor, para a conta da lista protegida (generateLink só gera o token, nunca envia e-mail); o usuário precisa ser o dono do convite
    // generateLink cria um usuário se o e-mail não existir: confere antes que o dono do convite é a conta autorizada e que ela existe
    const { data: dono } = await svc.auth.admin.getUserById(c.user_id);
    if (dono?.user?.email?.toLowerCase() !== email.toLowerCase()) return { ok: false, erro: MSG_GENERICA };
    const { data: link, error: erroLink } = await svc.auth.admin.generateLink({ type: 'magiclink', email });
    if (erroLink || !link?.properties?.hashed_token || link.user?.id !== c.user_id) return { ok: false, erro: MSG_GENERICA };
    const sb = await criarClienteServidor();
    const { data: sessao, error: erroSessao } = await sb.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
    if (erroSessao || !sessao.session || !sessao.user) return { ok: false, erro: MSG_GENERICA };
    const sid = sessaoDoToken(sessao.session.access_token);
    if (!contaAutorizada(sessao.user) || !sid || sessao.user.id !== c.user_id) { await sb.auth.signOut({ scope: 'local' }); return { ok: false, erro: MSG_GENERICA }; }
    const { error: erroRegistro } = await svc.rpc('registrar_aparelho', { p_user: sessao.user.id, p_sessao: sid, p_nome: nomeDoAparelho((await headers()).get('user-agent')) });
    if (erroRegistro) { await sb.auth.signOut({ scope: 'local' }); return { ok: false, erro: MSG_GENERICA }; }
    return { ok: true };
  } catch {
    return { ok: false, erro: MSG_GENERICA };
  }
}

export async function listarAparelhos() {
  return executar(async () => (await chamar('listar_aparelhos', {})) as { id: string; nome: string; criado_em: string; ultimo_uso: string; expira_em: string; revogado_em: string | null; atual: boolean }[], { privado: true });
}

export async function criarConvite() {
  return executar(async () => {
    const codigo = gerarCodigo((n) => randomInt(n));
    const r = (await chamar('criar_convite_aparelho', { p_codigo: codigo })) as { expira_em: string };
    return { codigo: formatarCodigo(codigo), expira_em: r.expira_em };
  }, { privado: true });
}

/** Revoga um aparelho. Se for o aparelho em uso, a sessão deste navegador também é encerrada aqui (o cliente então vai para /acesso). */
export async function revogarAparelho(id: string) {
  return executar(async () => {
    const r = (await chamar('revogar_aparelho', { p_id: id })) as { atual: boolean };
    if (r.atual && !modoTeste()) { try { await (await criarClienteServidor()).auth.signOut({ scope: 'local' }); } catch { /* o proxy encerra na próxima abertura */ } }
    return { atual: r.atual };
  }, { privado: true });
}

