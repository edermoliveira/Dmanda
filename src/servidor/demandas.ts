'use server';
// Ações do servidor chamadas pela interface. Cada uma devolve { ok, dados | erro }: a tela só mostra sucesso quando o banco confirmou.
import { chamar } from './banco';
import { criarOperacoes, executar, type TarefaEdicao } from '@/nucleo/operacoes';
import type { DadosDemanda, Etapa } from '@/lib/demandas';
import type { CategoriaDia } from '@/lib/prazos';
import { modoTeste } from '@/lib/supabase/config';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { COOKIE_LEGADO_ULTIMO_USO } from '@/lib/sessao';
import { cookies } from 'next/headers';

const op = () => criarOperacoes(chamar);

export async function ambiente() {
  if (modoTeste()) return { teste: true, nome: 'Teste' };
  try {
    const sb = await criarClienteServidor();
    const { data: { user } } = await sb.auth.getUser();
    return { teste: false, nome: String(user?.user_metadata?.full_name ?? user?.email ?? '') };
  } catch {
    return { teste: false, nome: '' };
  }
}
export async function listarDemandas(arquivadas = false) {
  return executar(() => op().listar(arquivadas));
}
export async function criarDemanda(dados: DadosDemanda) {
  return executar(() => op().criar(dados));
}
export async function atualizarDemanda(id: string, dados: DadosDemanda) {
  return executar(() => op().atualizar(id, dados));
}
export async function salvarDemanda(id: string, dados: DadosDemanda, tarefas: TarefaEdicao[] | null, versao: number) {
  return executar(() => op().salvar(id, dados, tarefas, versao));
}
export async function buscarDemanda(id: string) {
  return executar(() => op().buscar(id));
}
export async function moverEtapa(id: string, etapa: Etapa) {
  return executar(() => op().moverEtapa(id, etapa));
}
export async function concluirDemanda(id: string) {
  return executar(() => op().concluir(id));
}
export async function reabrirDemanda(id: string, etapa: Etapa = 'Fazendo') {
  return executar(() => op().reabrir(id, etapa));
}
export async function arquivarDemanda(id: string) {
  return executar(() => op().arquivar(id));
}
export async function desarquivarDemanda(id: string) {
  return executar(() => op().desarquivar(id));
}
export async function excluirDemanda(id: string, confirmado: boolean) {
  return executar(() => op().excluir(id, confirmado));
}
export async function listarDias() {
  return executar(() => op().listarDias());
}
export async function salvarDia(dia: { id?: string; data: string; descricao: string; categoria: CategoriaDia }) {
  return executar(() => op().salvarDia(dia));
}
export async function excluirDia(diaId: string) {
  return executar(() => op().excluirDia(diaId));
}
export async function adicionarTarefa(demandaId: string, texto: string) {
  return executar(() => op().adicionarTarefa(demandaId, texto));
}
export async function editarTarefa(tarefaId: string, texto: string) {
  return executar(() => op().editarTarefa(tarefaId, texto));
}
export async function marcarTarefa(tarefaId: string, concluida: boolean) {
  return executar(() => op().marcarTarefa(tarefaId, concluida));
}
export async function excluirTarefa(tarefaId: string) {
  return executar(() => op().excluirTarefa(tarefaId));
}

/** Estado da rotina diária para a tela (última execução bem-sucedida, última falha, data do resumo). Sem dado pessoal. */
export async function estadoRotina() {
  return executar(() => chamar('estado_rotina', {}) as Promise<{ ultima_ok: string | null; ultima_falha: string | null; resumo_data: string | null; resumo_calculado_em: string | null }>);
}

/**
 * Sair da conta neste navegador. Usa o signOut oficial do Supabase com escopo "local": encerra só esta sessão, sem desconectar outros
 * aparelhos nem a conta Google. Só devolve sucesso quando o Supabase confirmou. Se o Auth não confirmar, a resposta diz se a sessão deste
 * navegador já foi apagada (o SDK apaga mesmo assim), para a tela ir ao login com aviso honesto, ou se nada mudou (só erro na tela).
 */
export async function sairDaConta(): Promise<{ ok: true } | { ok: false; erro: string; sessaoLocalEncerrada: boolean }> {
  const falha = 'Não foi possível sair agora. Tente de novo.';
  if (modoTeste()) return { ok: false, erro: 'No banco de teste não há conta para sair.', sessaoLocalEncerrada: false };
  try {
    const sb = await criarClienteServidor();
    const { error } = await sb.auth.signOut({ scope: 'local' });
    if (!error) { (await cookies()).delete(COOKIE_LEGADO_ULTIMO_USO); return { ok: true }; }
    // O SDK apaga a sessão deste navegador mesmo quando o servidor de Auth não confirma o encerramento: se for o caso, a tela precisa ir ao login
    // (com aviso honesto) em vez de continuar parecendo autenticada. Se a sessão local continua, nada mudou e é só erro.
    const { data } = await sb.auth.getSession();
    if (data.session) return { ok: false, erro: falha, sessaoLocalEncerrada: false };
    (await cookies()).delete(COOKIE_LEGADO_ULTIMO_USO);
    return { ok: false, erro: falha, sessaoLocalEncerrada: true };
  } catch {
    return { ok: false, erro: falha, sessaoLocalEncerrada: false };
  }
}
