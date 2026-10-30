'use client';
// Estado do aplicativo no navegador: demandas vindas do banco, preferências de tela, avisos e janelas. Cada operação passa pelo servidor
// e só atualiza a tela quando o banco confirmou; uma falha vira aviso de erro e nada muda (sem sucesso de mentira).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { FILTRO_VAZIO, hojeISO, type Coluna, type DadosDemanda, type Demanda, type Etapa, type Filtro } from '@/lib/demandas';
import * as srv from '@/servidor/demandas';
import * as srvE from '@/servidor/entradas';
import type { Entrada } from '@/lib/entradas';
import type { Resultado, TarefaEdicao } from '@/nucleo/operacoes';
import type { CategoriaDia, DiaIndisponivel } from '@/lib/prazos';

export type Visao = 'cards' | 'quadro' | 'tabela' | 'lista';
// nova: o cadastro guiado de demanda (com entradaId, ele nasce de uma anotação: Virar demanda). entrada: a janela de uma anotação (sem id, uma anotação nova).
export type Janela = { t: 'nova'; entradaId?: string } | { t: 'editar'; id: string } | { t: 'tarefa' } | { t: 'entrada'; id?: string } | null;
// versao: a versão da demanda sobre a qual o rascunho foi digitado (se a demanda mudou depois, o salvamento é recusado em vez de sobrescrever)
// passo: em que passo do cadastro guiado a pessoa estava. idNovo: o identificador que o aplicativo gerou para a demanda nova (repetir a criação com ele nunca duplica).
// demandaId: a demanda já criada pelo passo 2, quando o cadastro foi interrompido depois dela (recarga, PWA encerrada). secoes: quais seções da consulta estavam em edição (o cadastro guiado deixa isso quando fecha com algo não salvo).
// entradaId: o cadastro nasceu de uma anotação (Virar demanda); a criação da demanda liga as duas na mesma transação do banco.
// Rascunho de anotação (chaves "e:nova" e "e:<id>"): dados = campos digitados; tocados = quais campos a pessoa mexeu; base = o valor de cada um no banco quando foi mexido (para reconhecer conflito de verdade).
export type Rascunho = { dados: DadosDemanda & Record<string, unknown>; tarefas?: TarefaEdicao[]; nt?: string; versao?: number; passo?: 1 | 2 | 3; idNovo?: string; demandaId?: string; secoes?: string[]; entradaId?: string; tocados?: string[]; base?: Record<string, unknown> };
/** Resultado de gravar uma anotação sem aviso na tela (a janela da anotação mostra o próprio estado): gravou, foi recusado por conflito de versão ou falhou. */
export type ResultadoEntrada = { ok: true; entrada: Entrada } | { ok: false; conflito: boolean; erro: string };
export type AbaArquivo = 'demandas' | 'entradas';
/** Resultado de salvar a janela de edição: gravou, foi recusado por conflito de versão (nada gravado, a edição local fica) ou falhou por outro motivo. */
export type ResultadoSalvar = { ok: true; demanda: Demanda } | { ok: false; conflito: boolean };
type Aviso = { n: number; msg: string; erro: boolean } | null;

export type EstadoRotina = { ultima_ok: string | null; ultima_falha: string | null; resumo_data: string | null; resumo_calculado_em: string | null };

type Ctx = {
  demandas: Demanda[];
  arquivadas: Demanda[] | null;
  /** Feriados e eventos externos de dia inteiro cadastrados: a prévia do vencimento usa a mesma regra do banco. */
  dias: DiaIndisponivel[];
  salvarDia: (dia: { id?: string; data: string; descricao: string; categoria: CategoriaDia }) => Promise<boolean>;
  excluirDia: (id: string) => Promise<boolean>;
  hoje: string;
  carregando: boolean;
  erroCarga: string | null;
  recarregar: () => Promise<void>;
  carregarArquivadas: () => Promise<void>;
  /** Entradas ativas (as arquivadas e as que viraram demanda ficam em entradasArquivadas, carregadas ao abrir o Arquivo). */
  entradas: Entrada[];
  entradasArquivadas: Entrada[] | null;
  carregandoEntradas: boolean;
  erroEntradas: string | null;
  recarregarEntradas: () => Promise<void>;
  carregarEntradasArquivadas: () => Promise<void>;
  abaArquivo: AbaArquivo;
  setAbaArquivo: (a: AbaArquivo) => void;
  criarEntrada: (dados: { id?: string; titulo?: string; texto?: string; cor?: number | null; fixada?: boolean }) => Promise<ResultadoEntrada>;
  salvarEntrada: (id: string, dados: { titulo?: string; texto?: string; cor?: number; fixada?: boolean }, versao: number) => Promise<ResultadoEntrada>;
  /** Lê uma anotação direto do banco, sem mexer nas listas (usada para conferir um conflito). */
  buscarEntrada: (id: string) => Promise<Entrada | null>;
  fixarEntrada: (id: string, fixada: boolean) => Promise<Entrada | null>;
  arquivarEntrada: (id: string) => Promise<Entrada | null>;
  desarquivarEntrada: (id: string) => Promise<Entrada | null>;
  excluirEntrada: (id: string) => Promise<boolean>;
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
  /** Com entradaId (Virar demanda), a demanda e o vínculo com a anotação são gravados juntos; a anotação sai de Entradas. */
  criar: (dados: DadosDemanda & { id?: string }, msg?: string, entradaId?: string) => Promise<Demanda | null>;
  salvar: (id: string, dados: DadosDemanda, tarefas: TarefaEdicao[] | null, versao: number, msg?: string) => Promise<ResultadoSalvar>;
  mover: (id: string, etapa: Etapa) => Promise<Demanda | null>;
  concluir: (id: string) => Promise<Demanda | null>;
  reabrir: (id: string, etapa?: Etapa) => Promise<Demanda | null>;
  arquivar: (id: string) => Promise<Demanda | null>;
  desarquivar: (id: string) => Promise<Demanda | null>;
  excluir: (id: string) => Promise<boolean>;
  adicionarTarefa: (demandaId: string, texto: string, tarefaId?: string) => Promise<Demanda | null>;
  editarTarefa: (tarefaId: string, texto: string) => Promise<Demanda | null>;
  marcarTarefa: (tarefaId: string, concluida: boolean) => Promise<Demanda | null>;
  excluirTarefa: (tarefaId: string) => Promise<Demanda | null>;
};

const Contexto = createContext<Ctx | null>(null);

// Falha ao falar com o servidor (sem internet, servidor fora do ar, sessão encerrada pelo proxy): a chamada lança em vez de devolver { ok: false }.
// Nenhuma dessas falhas vira sucesso: a tela mostra o motivo, nada muda e o que foi digitado continua nos campos e nos rascunhos.
const MSG_SEM_REDE = 'Sem conexão com o servidor. Nada foi gravado. Confira a internet e tente de novo; o que você digitou continua na tela.';
// Só "Nada foi gravado" quando é certo: sem conexão ANTES de enviar (o pedido nem saiu) ou recusa do servidor. Se o pedido saiu e a resposta não voltou, o servidor pode ter gravado:
// o resultado é incerto, e a pessoa confere antes de repetir (as repetições que importam usam a identidade da tentativa e não duplicam).
const MSG_INCERTA = 'Sem confirmação do servidor: não dá para saber se foi gravado. Confira a lista antes de repetir; o que você digitou continua na tela.';
async function explicarFalha(offlineAntes: boolean): Promise<string> {
  if (offlineAntes) return MSG_SEM_REDE;
  try {
    // sonda leve da porta de entrada: se ela redireciona, a sessão terminou (saída, revogação ou sessão inválida) e o login assume; uma resposta 503 é só falha de conexão com o Auth
    const r = await fetch('/api/sessao', { redirect: 'manual', cache: 'no-store' });
    if (r.type === 'opaqueredirect') { window.location.replace('/login?encerrada=1'); return 'Sua sessão terminou. Entre de novo.'; }
  } catch { return MSG_SEM_REDE; }
  return MSG_INCERTA;
}
const protegido = async <T,>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> => { const offlineAntes = typeof navigator !== 'undefined' && !navigator.onLine; try { return await f(); } catch { return { ok: false, erro: await explicarFalha(offlineAntes) }; } };

const assinarConexao = (aviso: () => void) => { addEventListener('online', aviso); addEventListener('offline', aviso); return () => { removeEventListener('online', aviso); removeEventListener('offline', aviso); }; };
/** true enquanto o navegador diz que há conexão (no servidor e na hidratação vale true, para as duas telas serem iguais). */
export const useOnline = () => useSyncExternalStore(assinarConexao, () => navigator.onLine, () => true);
export const useApp = () => { const c = useContext(Contexto); if (!c) throw new Error('useApp fora do ProvedorApp'); return c; };

const lerLS = <T,>(chave: string, padrao: T): T => { try { const v = localStorage.getItem(chave); return v ? (JSON.parse(v) as T) : padrao; } catch { return padrao; } };
const gravarLS = (chave: string, v: unknown) => { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* sem armazenamento: vale só nesta visita */ } };

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [arquivadas, setArquivadas] = useState<Demanda[] | null>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [entradasArquivadas, setEntradasArquivadas] = useState<Entrada[] | null>(null);
  const [carregandoEntradas, setCarregandoEntradas] = useState(true);
  const [erroEntradas, setErroEntradas] = useState<string | null>(null);
  const [abaArquivo, setAbaArquivo] = useState<AbaArquivo>('demandas');
  const [dias, setDias] = useState<DiaIndisponivel[]>([]);
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
    // a data de hoje vai no mesmo lote das demandas: sem isso os cards aparecem um instante com a data provisória e mostram prazos errados
    if (r.ok) { setHoje(hojeISO()); setDemandas(r.dados); setErroCarga(null); } else setErroCarga(r.erro);
    setCarregando(false);
  }, []);
  const carregarArquivadas = useCallback(async () => {
    const r = await protegido(() => srv.listarDemandas(true));
    if (r.ok) setArquivadas(r.dados); else avisar(r.erro, true);
  }, [avisar]);
  // Entradas: as ativas carregam junto com as demandas; as arquivadas (e as que viraram demanda) só ao abrir o Arquivo.
  const recarregarEntradas = useCallback(async () => {
    const r = await protegido(() => srvE.listarEntradas(false));
    if (r.ok) { setEntradas(r.dados); setErroEntradas(null); } else setErroEntradas(r.erro);
    setCarregandoEntradas(false);
  }, []);
  const carregarEntradasArquivadas = useCallback(async () => {
    const r = await protegido(() => srvE.listarEntradas(true));
    if (r.ok) setEntradasArquivadas(r.dados); else avisar(r.erro, true);
  }, [avisar]);
  // Uma anotação gravada entra na lista certa: ativa em Entradas; arquivada ou convertida no Arquivo.
  const aplicarEntrada = useCallback((e: Entrada) => {
    if (!e.arquivada_em && !e.demanda_id) {
      setEntradas((l) => (l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [e, ...l]));
      setEntradasArquivadas((l) => (l ? l.filter((x) => x.id !== e.id) : l));
    } else {
      setEntradas((l) => l.filter((x) => x.id !== e.id));
      setEntradasArquivadas((l) => (l ? [e, ...l.filter((x) => x.id !== e.id)] : l));
    }
  }, []);

  // Carga inicial das demandas do banco (e do ambiente) ao abrir a tela.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHoje(hojeISO());
    const virada = setInterval(() => setHoje(hojeISO()), 60_000);
    void recarregar();
    void recarregarEntradas();
    void srv.ambiente().then(setAmbiente).catch(() => {});
    void srv.listarDias().then((x) => { if (x.ok) setDias(x.dados); }).catch(() => {});
    void srv.estadoRotina().then((x) => { if (x.ok) setRotina(x.dados); }).catch(() => {});
    return () => clearInterval(virada);
  }, [recarregar, recarregarEntradas]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => { janelaAberta.current = janela !== null; }, [janela]);
  // Outro aparelho pode ter alterado as demandas (iPhone e computador usam o mesmo banco): ao voltar para a tela ou recuperar a conexão, relê a lista.
  // Não mexe com uma janela de edição aberta, não pisca o "carregando" e descarta a leitura se uma gravação aconteceu enquanto ela vinha.
  useEffect(() => {
    const atualizar = async () => {
      if (document.visibilityState === 'visible') setHoje(hojeISO()); // o dia pode ter virado enquanto o aplicativo estava em segundo plano, com ou sem rede para reler
      if (document.visibilityState !== 'visible' || janelaAberta.current || pendentes.current > 0) return;
      const antes = gravacoes.current;
      const [r, d, en] = await Promise.all([protegido(() => srv.listarDemandas(false)), protegido(() => srv.listarDias()), protegido(() => srvE.listarEntradas(false))]);
      if (gravacoes.current === antes && pendentes.current === 0 && !janelaAberta.current) {
        if (r.ok) { setHoje(hojeISO()); setDemandas(r.dados); setErroCarga(null); if (d.ok) setDias(d.dados); }
        if (en.ok) { setEntradas(en.dados); setErroEntradas(null); }
      }
    };
    document.addEventListener('visibilitychange', atualizar); addEventListener('online', atualizar);
    return () => { document.removeEventListener('visibilitychange', atualizar); removeEventListener('online', atualizar); };
  }, []);

  // estável (identidade fixa): as janelas a usam em efeitos que gravam o rascunho sozinhos
  // parte do que está guardado no navegador, não só da memória desta aba: outra aba ou a PWA do mesmo aparelho pode ter guardado um rascunho que esta não conhece, e gravar o mapa da memória o apagaria
  const guardarRascunho = useCallback((chave: string, r: Rascunho | null) => setRascunhos((m) => { const n = { ...(lerLS<Record<string, Rascunho> | null>('dmanda:rascunhos', null) ?? m) }; if (r) n[chave] = r; else delete n[chave]; gravarLS('dmanda:rascunhos', n); return n; }), []);

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

  const rodarEntrada = useCallback(async (f: () => Promise<Resultado<Entrada>>): Promise<ResultadoEntrada> => {
    const r = await gravando(() => protegido(f));
    if (!r.ok) return { ok: false, conflito: r.conflito === true, erro: r.erro };
    aplicarEntrada(r.dados);
    return { ok: true, entrada: r.dados };
  }, [aplicarEntrada, gravando]);
  // fixar, arquivar e recuperar são ações pontuais da lista: o aviso (ou o erro) aparece na tela
  const acaoEntrada = useCallback(async (f: () => Promise<Resultado<Entrada>>, msg: string) => {
    const r = await rodarEntrada(f);
    if (!r.ok) { avisar(r.erro, true); return null; }
    if (msg) avisar(msg);
    return r.entrada;
  }, [rodarEntrada, avisar]);

  // O servidor já recalculou os vencimentos afetados (inclusive os das demandas arquivadas): relê as demandas para a tela mostrar os novos. Se a leitura falhar, a tela diz isso em vez de
  // anunciar o recálculo com os prazos antigos à vista. As arquivadas voltam a ser lidas quando o Arquivo abrir.
  const aposCalendario = useCallback(async (inicio: string, n: number) => {
    const lista = await protegido(() => srv.listarDemandas(false));
    setArquivadas(null);
    const resumo = n === 0 ? 'Nenhum vencimento precisou mudar.' : n === 1 ? '1 vencimento foi recalculado.' : `${n} vencimentos foram recalculados.`;
    if (lista.ok) { setDemandas(lista.dados); avisar(`${inicio}. ${resumo}`); } else avisar(`${inicio}. ${resumo} A tela não conseguiu ler os novos vencimentos: recarregue para vê-los.`, true);
  }, [avisar]);

  const valor = useMemo<Ctx>(() => ({
    demandas, arquivadas, dias, hoje, carregando, erroCarga, recarregar, carregarArquivadas, entradas, entradasArquivadas, carregandoEntradas, erroEntradas, recarregarEntradas, carregarEntradasArquivadas, abaArquivo, setAbaArquivo,
    criarEntrada: (dados) => rodarEntrada(() => srvE.criarEntrada(dados)),
    salvarEntrada: (id, dados, versao) => rodarEntrada(() => srvE.salvarEntrada(id, dados, versao)),
    buscarEntrada: async (id) => { const r = await protegido(() => srvE.buscarEntrada(id)); return r.ok ? r.dados : null; },
    fixarEntrada: (id, fixada) => acaoEntrada(() => srvE.fixarEntrada(id, fixada), fixada ? 'Entrada fixada' : 'Entrada desafixada'),
    arquivarEntrada: (id) => acaoEntrada(() => srvE.arquivarEntrada(id), 'Entrada arquivada. Para recuperá-la, abra o Arquivo.'),
    desarquivarEntrada: (id) => acaoEntrada(() => srvE.desarquivarEntrada(id), 'Entrada recuperada'),
    excluirEntrada: async (id) => {
      const r = await gravando(() => protegido(() => srvE.excluirEntrada(id, true)));
      if (!r.ok) { avisar(r.erro, true); return false; }
      setEntradasArquivadas((l) => (l ? l.filter((x) => x.id !== id) : l)); setEntradas((l) => l.filter((x) => x.id !== id)); guardarRascunho(`e:${id}`, null);
      avisar('Entrada excluída');
      return true;
    },
    aviso, avisar, ambiente, rotina, tema,
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
    salvarDia: async (dia) => {
      const r = await gravando(() => protegido(() => srv.salvarDia(dia)));
      if (!r.ok) { avisar(r.erro, true); return false; }
      setDias((l) => [...l.filter((x) => x.id !== r.dados.dia.id), r.dados.dia].sort((a, b) => a.data.localeCompare(b.data)));
      await aposCalendario(dia.id ? 'Dia alterado' : 'Dia cadastrado', r.dados.recalculadas);
      return true;
    },
    excluirDia: async (diaId) => {
      const r = await gravando(() => protegido(() => srv.excluirDia(diaId)));
      if (!r.ok) { avisar(r.erro, true); return false; }
      setDias((l) => l.filter((x) => x.id !== diaId));
      await aposCalendario('Dia excluído', r.dados.recalculadas);
      return true;
    },
    criar: async (dados, msg = 'Demanda cadastrada', entradaId) => {
      const d = await rodar(() => (entradaId ? srvE.criarDemandaDeEntrada(entradaId, dados as DadosDemanda & { id: string }) : srv.criarDemanda(dados)), msg);
      // a anotação já está ligada à demanda no banco: sai de Entradas, o rascunho dela some e o Arquivo recarrega ao abrir
      if (d && entradaId) { setEntradas((l) => l.filter((x) => x.id !== entradaId)); setEntradasArquivadas(null); guardarRascunho(`e:${entradaId}`, null); }
      return d;
    },
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
      setDemandas((l) => l.filter((x) => x.id !== id)); setArquivadas((l) => (l ? l.filter((x) => x.id !== id) : l)); guardarRascunho(`d:${id}`, null);
      // se uma entrada tinha virado esta demanda, o banco a devolve a Entradas: as listas de entradas (e a do Arquivo, se já foi lida) são relidas no lugar, sem voltar ao "carregando"
      void recarregarEntradas(); if (entradasArquivadas) void carregarEntradasArquivadas();
      avisar('Demanda excluída');
      return true;
    },
    adicionarTarefa: (demandaId, texto, tarefaId) => rodar(() => srv.adicionarTarefa(demandaId, texto, tarefaId), 'Tarefa adicionada'),
    editarTarefa: (tarefaId, texto) => rodar(() => srv.editarTarefa(tarefaId, texto), 'Tarefa alterada'),
    marcarTarefa: (tarefaId, concluida) => rodar(() => srv.marcarTarefa(tarefaId, concluida)),
    excluirTarefa: (tarefaId) => rodar(() => srv.excluirTarefa(tarefaId), 'Tarefa removida'),
  }), [demandas, arquivadas, dias, hoje, carregando, erroCarga, recarregar, carregarArquivadas, entradas, entradasArquivadas, carregandoEntradas, erroEntradas, recarregarEntradas, carregarEntradasArquivadas, abaArquivo, rodarEntrada, acaoEntrada, aviso, avisar, ambiente, rotina, tema, menuAberto, visao, filtro, ordem, gruposFechados, janela, menuMover, rascunhos, guardarRascunho, gravando, rodar, aplicar, aposCalendario]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
