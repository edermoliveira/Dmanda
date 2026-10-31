// De onde a interface lê e grava: as ações do servidor (Supabase ou banco de teste) ou, só na prévia visual com dados fictícios, o banco em memória do navegador.
// A escolha vem de window.__DMANDA_DEMO__, definido pelo script do <head> apenas quando o servidor está no modo de demonstração (src/lib/demo.ts).
// O desenho do `typeof` garante que a demonstração tenha exatamente as mesmas ações que o servidor.
import * as realD from '@/servidor/demandas';
import * as realE from '@/servidor/entradas';
import { criarOperacoes, executar } from '@/nucleo/operacoes';
import { chamarDemo } from './demo/banco-demo';

declare global { interface Window { __DMANDA_DEMO__?: boolean } }
export const emDemo = () => typeof window !== 'undefined' && window.__DMANDA_DEMO__ === true;

const op = criarOperacoes(chamarDemo);
const demoD: typeof realD = {
  ambiente: async () => ({ teste: true, nome: 'Prévia (dados fictícios)' }),
  listarDemandas: (arquivadas = false) => executar(() => op.listar(arquivadas)),
  criarDemanda: (dados) => executar(() => op.criar(dados)),
  salvarDemanda: (id, dados, tarefas, versao) => executar(() => op.salvar(id, dados, tarefas, versao)),
  buscarDemanda: (id) => executar(() => op.buscar(id)),
  moverEtapa: (id, etapa) => executar(() => op.moverEtapa(id, etapa)),
  concluirDemanda: (id) => executar(() => op.concluir(id)),
  reabrirDemanda: (id, etapa = 'Fazendo') => executar(() => op.reabrir(id, etapa)),
  arquivarDemanda: (id) => executar(() => op.arquivar(id)),
  desarquivarDemanda: (id) => executar(() => op.desarquivar(id)),
  excluirDemanda: (id, confirmado) => executar(() => op.excluir(id, confirmado)),
  listarDias: () => executar(() => op.listarDias()),
  salvarDia: (dia) => executar(() => op.salvarDia(dia)),
  excluirDia: (diaId) => executar(() => op.excluirDia(diaId)),
  adicionarTarefa: (demandaId, texto, tarefaId) => executar(() => op.adicionarTarefa(demandaId, texto, tarefaId)),
  editarTarefa: (tarefaId, texto) => executar(() => op.editarTarefa(tarefaId, texto)),
  marcarTarefa: (tarefaId, concluida) => executar(() => op.marcarTarefa(tarefaId, concluida)),
  excluirTarefa: (tarefaId) => executar(() => op.excluirTarefa(tarefaId)),
  estadoRotina: () => executar(() => chamarDemo('estado_rotina', {}) as Promise<{ ultima_ok: string | null; ultima_falha: string | null; resumo_data: string | null; resumo_calculado_em: string | null }>),
  sairDaConta: async () => ({ ok: false, erro: 'Na prévia não há conta para sair.', sessaoLocalEncerrada: false }),
};
const demoE: typeof realE = {
  listarEntradas: (arquivadas = false) => executar(() => op.listarEntradas(arquivadas)),
  buscarEntrada: (id) => executar(() => op.buscarEntrada(id)),
  criarEntrada: (dados) => executar(() => op.criarEntrada(dados)),
  salvarEntrada: (id, dados, versao) => executar(() => op.salvarEntrada(id, dados, versao)),
  fixarEntrada: (id, fixada) => executar(() => op.fixarEntrada(id, fixada)),
  arquivarEntrada: (id) => executar(() => op.arquivarEntrada(id)),
  desarquivarEntrada: (id) => executar(() => op.desarquivarEntrada(id)),
  excluirEntrada: (id, confirmado) => executar(() => op.excluirEntrada(id, confirmado)),
  criarDemandaDeEntrada: (entradaId, dados) => executar(() => op.criarDemandaDeEntrada(entradaId, dados)),
};

const escolher = <T extends object>(real: T, demo: T): T => new Proxy({} as T, { get: (_, k) => (emDemo() ? demo : real)[k as keyof T] });
export const srv = escolher(realD, demoD);
export const srvE = escolher(realE, demoE);
