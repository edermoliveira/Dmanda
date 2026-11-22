'use server';
// Gestão dos acessos (Configurações > Usuários e acesso), só da conta administradora. Cada ação passa por DOIS controles independentes:
//  1) o banco: as funções de acesso recusam quem não é a administradora (dmanda_privado.e_admin(): auth.uid() + e-mail confirmado no Auth + e-mail fixado no banco), qualquer que seja o chamador;
//  2) só depois, se preciso, a chave de serviço chama a API ADMINISTRATIVA do Auth (convite, bloqueio). Ela nunca é usada para ler ou alterar o painel, e nunca é alcançada sem o passo 1.
// A chave de serviço não troca a sessão de ninguém (cliente sem persistência). Nenhum e-mail real é enviado nos testes (modo de teste ou Auth falso local).
import { chamar, clienteServico } from './banco';
import { executar, ErroDmanda } from '@/nucleo/operacoes';
import { modoTeste } from '@/lib/supabase/config';

export type Acesso = { email: string; admin: boolean; estado: 'autorizado' | 'convite_pendente' | 'ativo' | 'revogado'; convite_enviado_em: string | null; revogado_em: string | null; ultimo_acesso: string | null; criado_em: string };

const urlPublica = () => {
  const u = (process.env.DMANDA_URL_PUBLICA ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+$/.test(u)) throw new ErroDmanda('O endereço público do Dmanda (DMANDA_URL_PUBLICA) não está configurado: sem ele o convite não pode ser enviado.');
  return u;
};

export async function listarAcessos() {
  return executar(async () => (await chamar('listar_acessos', {})) as Acesso[]);
}

async function enviarConvite(email: string) {
  if (modoTeste()) return;   // modo de teste (PGlite): só a autorização é provada; o envio real do convite é do Auth (o teste de integração usa um Auth falso)
  const { error } = await clienteServico().auth.admin.inviteUserByEmail(email, { redirectTo: `${urlPublica()}/auth/confirmar` });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new ErroDmanda('Este e-mail já tem conta. Se a pessoa esqueceu a senha, ela usa "Esqueci a senha" na tela de entrada.');
    throw new ErroDmanda('O convite não foi enviado (' + (error.status ?? 'erro') + '). A autorização foi guardada: tente reenviar.');
  }
}

/** Autoriza o e-mail e envia o convite. Se o envio falhar a autorização fica (estado "autorizado") e o convite pode ser reenviado: nunca se finge que foi enviado. */
export async function convidar(email: string) {
  return executar(async () => {
    const r = (await chamar('autorizar_acesso', { p_email: email })) as { email: string; revogado: boolean };
    if (r.revogado) throw new ErroDmanda('Este acesso está revogado. Restabeleça o acesso antes de convidar de novo.');
    await enviarConvite(r.email);
    await chamar('registrar_convite_enviado', { p_email: r.email });
    return { email: r.email };
  });
}

/** Reenvia o convite de quem ainda não entrou (estado autorizado ou convite pendente). */
export async function reenviarConvite(email: string) {
  return executar(async () => {
    const lista = (await chamar('listar_acessos', {})) as Acesso[];
    const a = lista.find((x) => x.email === String(email).trim().toLowerCase());
    if (!a) throw new ErroDmanda('Este e-mail não está na lista de acessos.');
    if (a.estado === 'revogado') throw new ErroDmanda('Este acesso está revogado. Restabeleça o acesso antes.');
    if (a.estado === 'ativo') throw new ErroDmanda('Esta pessoa já entrou. Se esqueceu a senha, ela usa "Esqueci a senha" na tela de entrada.');
    await enviarConvite(a.email);
    await chamar('registrar_convite_enviado', { p_email: a.email });
    return { email: a.email };
  });
}

async function bloqueioNoAuth(usuarioId: string | null, bloquear: boolean) {
  if (!usuarioId || modoTeste()) return;
  const { error } = await clienteServico().auth.admin.updateUserById(usuarioId, { ban_duration: bloquear ? '876000h' : 'none' });
  if (error) throw new ErroDmanda(bloquear ? 'O acesso foi revogado no Dmanda e já não alcança nenhum dado, mas o bloqueio no serviço de acesso falhou. Repita a revogação.' : 'O acesso foi restabelecido no Dmanda, mas o desbloqueio no serviço de acesso falhou. Repita o restabelecimento.');
}

/** Revoga: o banco passa a recusar a conta na próxima consulta (mesmo com o JWT anterior) e o Auth bloqueia a renovação. Os registros da pessoa ficam. */
export async function revogarAcesso(email: string) {
  return executar(async () => {
    const r = (await chamar('revogar_acesso', { p_email: email })) as { email: string; usuario_id: string | null };
    await bloqueioNoAuth(r.usuario_id, true);
    return { email: r.email };
  });
}

export async function restabelecerAcesso(email: string) {
  return executar(async () => {
    const r = (await chamar('restabelecer_acesso', { p_email: email })) as { email: string; usuario_id: string | null };
    await bloqueioNoAuth(r.usuario_id, false);
    return { email: r.email };
  });
}
