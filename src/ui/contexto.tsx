'use client';
// Estado do aplicativo no navegador: demandas vindas do banco, preferências de tela, avisos e janelas. Cada operação passa pelo servidor
// e só atualiza a tela quando o banco confirmou; uma falha vira aviso de erro e nada muda (sem sucesso de mentira).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FILTRO_VAZIO, hojeISO, type Coluna, type DadosDemanda, type Demanda, type Etapa, type Filtro } from '@/lib/demandas';
import * as srv from '@/servidor/demandas';
import type { Resultado, TarefaEdicao } from '@/nucleo/operacoes';

export type Visao = 'cards' | 'quadro' | 'tabela' | 'lista';
export type Janela = { t: 'nova'; etapa?: Etapa } | { t: 'editar'; id: string } | { t: 'tarefa' } | null;
export type Rascunho = { dados: DadosDemanda; tarefas?: TarefaEdicao[]; nt?: string };
type Aviso = { n: number; msg: string; erro: boolean } | null;

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
  salvar: (id: string, dados: DadosDemanda, tarefas: TarefaEdicao[] | null, msg?: string) => Promise<Demanda | null>;
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
  const [tema, setTema] = useState<'claro' | 'escuro'>('claro');
  const [menuAberto, setMenuAberto] = useState(false);
  const [visao, setVisaoE] = useState<Visao>('cards');
  const [filtro, setFiltroE] = useState<Filtro>(FILTRO_VAZIO);
  const [ordem, setOrdem] = useState<{ coluna: Coluna; sentido: 1 | -1 }>({ coluna: 'prazo', sentido: 1 });
  const [gruposFechados, setGrupos] = useState<Record<string, boolean>>({});
  const [janela, setJanela] = useState<Janela>(null);
  const [menuMover, setMenuMover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const pronto = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    pronto.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (pronto.current) gravarLS('dmanda:ui', { visao, ordem, grupos: gruposFechados }); }, [visao, ordem, gruposFechados]);
  useEffect(() => { if (pronto.current) gravarLS('dmanda-tema', tema); }, [tema]);

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
    const r = await srv.listarDemandas(false);
    if (r.ok) { setDemandas(r.dados); setErroCarga(null); } else setErroCarga(r.erro);
    setCarregando(false);
  }, []);
  const carregarArquivadas = useCallback(async () => {
    const r = await srv.listarDemandas(true);
    if (r.ok) setArquivadas(r.dados); else avisar(r.erro, true);
  }, [avisar]);

  // Carga inicial das demandas do banco (e do ambiente) ao abrir a tela.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHoje(hojeISO());
    const virada = setInterval(() => setHoje(hojeISO()), 60_000);
    void recarregar();
    void srv.ambiente().then(setAmbiente);
    return () => clearInterval(virada);
  }, [recarregar]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const rodar = useCallback(async (f: () => Promise<Resultado<Demanda>>, msg?: string) => {
    const r = await f();
    if (!r.ok) { avisar(r.erro, true); return null; }
    aplicar(r.dados);
    if (msg) avisar(msg);
    return r.dados;
  }, [aplicar, avisar]);

  const valor = useMemo<Ctx>(() => ({
    demandas, arquivadas, hoje, carregando, erroCarga, recarregar, carregarArquivadas, aviso, avisar, ambiente, tema,
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
    guardarRascunho: (chave, r) => setRascunhos((m) => { const n = { ...m }; if (r) n[chave] = r; else delete n[chave]; gravarLS('dmanda:rascunhos', n); return n; }),
    criar: (dados) => rodar(() => srv.criarDemanda(dados), 'Demanda cadastrada'),
    salvar: (id, dados, tarefas, msg = 'Alterações salvas') => rodar(() => srv.salvarDemanda(id, dados, tarefas), msg),
    mover: (id, etapa) => rodar(() => srv.moverEtapa(id, etapa), `Movida para ${etapa}`),
    concluir: (id) => rodar(() => srv.concluirDemanda(id), 'Demanda finalizada. As tarefas foram marcadas como concluídas.'),
    reabrir: (id, etapa = 'Fazendo') => rodar(() => srv.reabrirDemanda(id, etapa), `Reaberta em ${etapa}. O histórico foi mantido.`),
    arquivar: (id) => rodar(() => srv.arquivarDemanda(id), 'Demanda arquivada'),
    desarquivar: (id) => rodar(() => srv.desarquivarDemanda(id), 'Demanda desarquivada'),
    excluir: async (id) => {
      const r = await srv.excluirDemanda(id, true);
      if (!r.ok) { avisar(r.erro, true); return false; }
      setDemandas((l) => l.filter((x) => x.id !== id)); setArquivadas((l) => (l ? l.filter((x) => x.id !== id) : l));
      avisar('Demanda excluída');
      return true;
    },
    adicionarTarefa: (demandaId, texto) => rodar(() => srv.adicionarTarefa(demandaId, texto), 'Tarefa adicionada'),
    editarTarefa: (tarefaId, texto) => rodar(() => srv.editarTarefa(tarefaId, texto), 'Tarefa alterada'),
    marcarTarefa: (tarefaId, concluida) => rodar(() => srv.marcarTarefa(tarefaId, concluida)),
    excluirTarefa: (tarefaId) => rodar(() => srv.excluirTarefa(tarefaId), 'Tarefa removida'),
  }), [demandas, arquivadas, hoje, carregando, erroCarga, recarregar, carregarArquivadas, aviso, avisar, ambiente, tema, menuAberto, visao, filtro, ordem, gruposFechados, janela, menuMover, rascunhos, rodar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
