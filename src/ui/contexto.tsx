'use client';
// Estado do aplicativo no navegador: demandas vindas do banco, preferências de tela, avisos e janelas. Cada operação passa pelo servidor
// e só atualiza a tela quando o banco confirmou; uma falha vira aviso de erro e nada muda (sem sucesso de mentira).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { FILTRO_VAZIO, hojeISO, type Coluna, type DadosDemanda, type Demanda, type Etapa, type Filtro } from '@/lib/demandas';
import * as srv from '@/servidor/demandas';
import type { Resultado, TarefaEdicao } from '@/nucleo/operacoes';

export type Visao = 'cards' | 'quadro' | 'tabela' | 'lista';
export type Janela = { t: 'nova'; etapa?: Etapa } | { t: 'editar'; id: string } | { t: 'tarefa' } | null;
// versao: a versão da demanda sobre a qual o rascunho foi digitado (se a demanda mudou depois, o salvamento é recusado em vez de sobrescrever)
export type Rascunho = { dados: DadosDemanda; tarefas?: TarefaEdicao[]; nt?: string; versao?: number };
/** Resultado de salvar a janela de edição: gravou, foi recusado por conflito de versão (nada gravado, a edição local fica) ou falhou por outro motivo. */
export type ResultadoSalvar = { ok: true; demanda: Demanda } | { ok: false; conflito: boolean };
type Aviso = { n: number; msg: string; erro: boolean } | null;

export type EstadoRotina = { ultima_ok: string | null; ultima_falha: string | null; resumo_data: string | null; resumo_calculado_em: string | null };

type Ctx = {
  demandas: Demanda[];
  arquivadas: Demanda[] | null;
  hoje: string;
  carregando: boolean;
  erroCarga: string | null;
  recarregar: () => Promise<void>;
  carregarArquivadas: () => Promise<void>;
  aviso: Aviso;
  avisar: (msg: string, erro?: boolean) => void;
  ambiente: { teste: boolean; nome: string } | null;
  rotina: EstadoRotina | null;
  tema: 'claro' | 'escuro';
  alternarTema: () => void;
  menuAberto: boolean;
  alternarMenu: () => void;
  visao: Visao;
  setVisao: (v: Visao) => void;
  filtro: Filtro;
  setFiltro: (f: Partial<Filtro>) => void;
  ordem: { coluna: Coluna; sentido: 1 | -1 };
  ordenarPor: (c: Coluna) => void;
  gruposFechados: Record<string, boolean>;
  alternarGrupo: (e: string) => void;
  janela: Janela;
  abrirJanela: (j: Janela) => void;
  fecharJanela: () => void;
  menuMover: { id: string; x: number; y: number } | null;
  abrirMenuMover: (id: string, gatilho: HTMLElement) => void;
  fecharMenuMover: () => void;
  rascunhos: Record<string, Rascunho>;
  guardarRascunho: (chave: string, r: Rascunho | null) => void;
  // operações (devolvem a demanda gravada, ou null se falhou; o erro já foi avisado)
  criar: (dados: DadosDemanda) => Promise<Demanda | null>;
  salvar: (id: string, dados: DadosDemanda, tarefas: TarefaEdicao[] | null, versao: number, msg?: string) => Promise<ResultadoSalvar>;
  mover: (id: string, etapa: Etapa) => Promise<Demanda | null>;
  concluir: (id: string) => Promise<Demanda | null>;
  reabrir: (id: string, etapa?: Etapa) => Promise<Demanda | null>;
  arquivar: (id: string) => Promise<Demanda | null>;
  desarquivar: (id: string) => Promise<Demanda | null>;
  excluir: (id: string) => Promise<boolean>;
  adicionarTarefa: (demandaId: string, texto: string) => Promise<Demanda | null>;
  editarTarefa: (tarefaId: string, texto: string) => Promise<Demanda | null>;
  marcarTarefa: (tarefaId: string, concluida: boolean) => Promise<Demanda | null>;
  excluirTarefa: (tarefaId: string) => Promise<Demanda | null>;
};

const Contexto = createContext<Ctx | null>(null);

// Falha ao falar com o servidor (sem internet, servidor fora do ar, sessão encerrada pelo proxy): a chamada lança em vez de devolver { ok: false }.
// Nenhuma dessas falhas vira sucesso: a tela mostra o motivo, nada muda e o que foi digitado continua nos campos e nos rascunhos.
const MSG_SEM_REDE = 'Sem conexão com o servidor. Nada foi gravado. Confira a internet e tente de novo; o que você digitou continua na tela.';
async function explicarFalha(): Promise<string> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return MSG_SEM_REDE;
  try {
    // sonda leve da porta de entrada: se ela redireciona, a sessão terminou (expirou por inatividade ou foi encerrada) e o login assume
    const r = await fetch('/api/sessao', { redirect: 'manual', cache: 'no-store' });
    if (r.type === 'opaqueredirect') { window.location.replace('/login?expirou=1'); return 'Sua sessão terminou. Entre de novo.'; }
  } catch { return MSG_SEM_REDE; }
  return 'Não foi possível falar com o servidor agora. Nada foi gravado. Tente de novo.';
}
const protegido = async <T,>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> => { try { return await f(); } catch { return { ok: false, erro: await explicarFalha() }; } };

const assinarConexao = (aviso: () => void) => { addEventListener('online', aviso); addEventListener('offline', aviso); return () => { removeEventListener('online', aviso); removeEventListener('offline', aviso); }; };
/** true enquanto o navegador diz que há conexão (no servidor e na hidratação vale true, para as duas telas serem iguais). */
export const useOnline = () => useSyncExternalStore(assinarConexao, () => navigator.onLine, () => true);
export const useApp = () => { const c = useContext(Contexto); if (!c) throw new Error('useApp fora do ProvedorApp'); return c; };

const lerLS = <T,>(chave: string, padrao: T): T => { try { const v = localStorage.getItem(chave); return v ? (JSON.parse(v) as T) : padrao; } catch { return padrao; } };
const gravarLS = (chave: string, v: unknown) => { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* sem armazenamento: vale só nesta visita */ } };

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [arquivadas, setArquivadas] = useState<Demanda[] | null>(null);
  // Data de hoje (Brasília). Começa num valor fixo e passa a valer depois de montar no navegador, para o servidor não depender do relógio; renova na virada do dia.
  const [hoje, setHoje] = useState('2000-01-01');
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ambiente, setAmbiente] = useState<Ctx['ambiente']>(null);
  const [rotina, setRotina] = useState<Ctx['rotina']>(null);
  const [tema, setTema] = useState<'claro' | 'escuro'>('claro');
  const [menuAberto, setMenuAberto] = useState(false);
  const [visao, setVisaoE] = useState<Visao>('cards');
  const [filtro, setFiltroE] = useState<Filtro>(FILTRO_VAZIO);
  const [ordem, setOrdem] = useState<{ coluna: Coluna; sentido: 1 | -1 }>({ coluna: 'prazo', sentido: 1 });
  const [gruposFechados, setGrupos] = useState<Record<string, boolean>>({});
  const [janela, setJanela] = useState<Janela>(null);
  const [menuMover, setMenuMover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  // só depois de ler as preferências do navegador é que elas podem ser gravadas (senão os padrões sobrescrevem o que estava salvo)
  const [pronto, setPronto] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // para a atualização ao voltar à tela: janela aberta (não mexer), gravações em andamento e um contador que muda no início e no fim de cada gravação
  // (uma leitura que começou antes de uma gravação terminar, ou durante ela, é descartada)
  const janelaAberta = useRef(false);
  const gravacoes = useRef(0);
  const pendentes = useRef(0);

  const avisar = useCallback((msg: string, erro = false) => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setAviso({ n: Date.now(), msg, erro });
    temporizador.current = setTimeout(() => setAviso(null), erro ? 7000 : 2200);
  }, []);

  // preferências guardadas só neste navegador (tema, menu, visão, ordenação, grupos fechados, rascunhos)
  // Lê as preferências do navegador depois da hidratação (no servidor elas não existem): é sincronizar com um sistema externo, o localStorage.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const t = lerLS<string | null>('dmanda-tema', null);
    setTema(t === 'escuro' || t === 'claro' ? t : matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
    setMenuAberto(lerLS<boolean>('dmanda:menu-aberto', false));
    const ui = lerLS<{ visao?: Visao; ordem?: { coluna: Coluna; sentido: 1 | -1 }; grupos?: Record<string, boolean> }>('dmanda:ui', {});
    if (ui.visao) setVisaoE(ui.visao);
    if (ui.ordem) setOrdem(ui.ordem);
    if (ui.grupos) setGrupos(ui.grupos);
    setRascunhos(lerLS<Record<string, Rascunho>>('dmanda:rascunhos', {}));
    setPronto(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (pronto) gravarLS('dmanda:ui', { visao, ordem, grupos: gruposFechados }); }, [pronto, visao, ordem, gruposFechados]);
  useEffect(() => { if (pronto) gravarLS('dmanda-tema', tema); }, [pronto, tema]);

  const aplicar = useCallback((d: Demanda) => {
    if (d.arquivada_em) {
      setDemandas((l) => l.filter((x) => x.id !== d.id));
      setArquivadas((l) => (l ? [...l.filter((x) => x.id !== d.id), d] : l));
    } else {
      setArquivadas((l) => (l ? l.filter((x) => x.id !== d.id) : l));
      setDemandas((l) => (l.some((x) => x.id === d.id) ? l.map((x) => (x.id === d.id ? d : x)) : [...l, d]));
    }
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const r = await protegido(() => srv.listarDemandas(false));
    if (r.ok) { setDemandas(r.dados); setErroCarga(null); } else setErroCarga(r.erro);
    setCarregando(false);
  }, []);
  const carregarArquivadas = useCallback(async () => {
    const r = await protegido(() => srv.listarDemandas(true));
    if (r.ok) setArquivadas(r.dados); else avisar(r.erro, true);
  }, [avisar]);

  // Carga inicial das demandas do banco (e do ambiente) ao abrir a tela.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHoje(hojeISO());
    const virada = setInterval(() => setHoje(hojeISO()), 60_000);
    void recarregar();
    void srv.ambiente().then(setAmbiente).catch(() => {});
    void srv.estadoRotina().then((x) => { if (x.ok) setRotina(x.dados); }).catch(() => {});
    return () => clearInterval(virada);
  }, [recarregar]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => { janelaAberta.current = janela !== null; }, [janela]);
  // Outro aparelho pode ter alterado as demandas (iPhone e computador usam o mesmo banco): ao voltar para a tela ou recuperar a conexão, relê a lista.
  // Não mexe com uma janela de edição aberta, não pisca o "carregando" e descarta a leitura se uma gravação aconteceu enquanto ela vinha.
  useEffect(() => {
    const atualizar = async () => {
      if (document.visibilityState !== 'visible' || janelaAberta.current || pendentes.current > 0) return;
      const antes = gravacoes.current;
      const r = await protegido(() => srv.listarDemandas(false));
      if (r.ok && gravacoes.current === antes && pendentes.current === 0 && !janelaAberta.current) { setDemandas(r.dados); setErroCarga(null); }
    };
    document.addEventListener('visibilitychange', atualizar); addEventListener('online', atualizar);
    return () => { document.removeEventListener('visibilitychange', atualizar); removeEventListener('online', atualizar); };
  }, []);

  // estável (identidade fixa): as janelas a usam em efeitos que gravam o rascunho sozinhos
  const guardarRascunho = useCallback((chave: string, r: Rascunho | null) => setRascunhos((m) => { const n = { ...m }; if (r) n[chave] = r; else delete n[chave]; gravarLS('dmanda:rascunhos', n); return n; }), []);

  const gravando = useCallback(async <T,>(f: () => Promise<T>): Promise<T> => {
    gravacoes.current++; pendentes.current++;
    try { return await f(); } finally { pendentes.current--; gravacoes.current++; }
  }, []);
  const rodar = useCallback(async (f: () => Promise<Resultado<Demanda>>, msg?: string) => {
    const r = await gravando(() => protegido(f));
    if (!r.ok) { avisar(r.erro, true); return null; }
    aplicar(r.dados);
    if (msg) avisar(msg);
    return r.dados;
  }, [aplicar, avisar, gravando]);

  const valor = useMemo<Ctx>(() => ({
    demandas, arquivadas, hoje, carregando, erroCarga, recarregar, carregarArquivadas, aviso, avisar, ambiente, rotina, tema,
    alternarTema: () => setTema((t) => (t === 'claro' ? 'escuro' : 'claro')),
    menuAberto,
    alternarMenu: () => setMenuAberto((v) => { gravarLS('dmanda:menu-aberto', !v); return !v; }),
    visao, setVisao: setVisaoE, filtro, setFiltro: (f) => setFiltroE((x) => ({ ...x, ...f })),
    ordem, ordenarPor: (coluna) => setOrdem((o) => ({ coluna, sentido: o.coluna === coluna ? (o.sentido === 1 ? -1 : 1) : 1 })),
    gruposFechados, alternarGrupo: (e) => setGrupos((g) => ({ ...g, [e]: !g[e] })),
    janela, abrirJanela: setJanela, fecharJanela: () => setJanela(null),
    menuMover,
    abrirMenuMover: (id, g) => { const a = document.querySelector('.app')!.getBoundingClientRect(), b = g.getBoundingClientRect(); setMenuMover({ id, x: b.right - a.left, y: b.bottom - a.top }); },
    fecharMenuMover: () => setMenuMover(null),
    rascunhos,
    guardarRascunho,
    criar: (dados) => rodar(() => srv.criarDemanda(dados), 'Demanda cadastrada'),
    salvar: async (id, dados, tarefas, versao, msg = 'Alterações salvas') => {
      const r = await gravando(() => protegido(() => srv.salvarDemanda(id, dados, tarefas, versao)));
      if (r.ok) { aplicar(r.dados); if (msg) avisar(msg); return { ok: true, demanda: r.dados }; }
      if (r.conflito) {
        // traz a versão atual para a lista (a janela aberta mantém o que foi digitado e passa a mostrar o aviso de conflito)
        const atual = await protegido(() => srv.buscarDemanda(id));
        if (atual.ok) aplicar(atual.dados);
      }
      avisar(r.erro, true);
      return { ok: false, conflito: r.conflito === true };
    },
    mover: (id, etapa) => rodar(() => srv.moverEtapa(id, etapa), `Movida para ${etapa}`),
    concluir: (id) => rodar(() => srv.concluirDemanda(id), 'Demanda finalizada. As tarefas foram marcadas como concluídas.'),
    reabrir: (id, etapa = 'Fazendo') => rodar(() => srv.reabrirDemanda(id, etapa), `Reaberta em ${etapa}. O histórico foi mantido.`),
    arquivar: (id) => rodar(() => srv.arquivarDemanda(id), 'Demanda arquivada'),
    desarquivar: (id) => rodar(() => srv.desarquivarDemanda(id), 'Demanda desarquivada'),
    excluir: async (id) => {
      const r = await gravando(() => protegido(() => srv.excluirDemanda(id, true)));
      if (!r.ok) { avisar(r.erro, true); return false; }
      setDemandas((l) => l.filter((x) => x.id !== id)); setArquivadas((l) => (l ? l.filter((x) => x.id !== id) : l));
      avisar('Demanda excluída');
      return true;
    },
    adicionarTarefa: (demandaId, texto) => rodar(() => srv.adicionarTarefa(demandaId, texto), 'Tarefa adicionada'),
    editarTarefa: (tarefaId, texto) => rodar(() => srv.editarTarefa(tarefaId, texto), 'Tarefa alterada'),
    marcarTarefa: (tarefaId, concluida) => rodar(() => srv.marcarTarefa(tarefaId, concluida)),
    excluirTarefa: (tarefaId) => rodar(() => srv.excluirTarefa(tarefaId), 'Tarefa removida'),
  }), [demandas, arquivadas, hoje, carregando, erroCarga, recarregar, carregarArquivadas, aviso, avisar, ambiente, rotina, tema, menuAberto, visao, filtro, ordem, gruposFechados, janela, menuMover, rascunhos, guardarRascunho, gravando, rodar, aplicar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
