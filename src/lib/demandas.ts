// Tipos e regras de apresentação de demandas e tarefas, usados pela interface e pelas operações. Sem acesso a banco.

export const ETAPAS = ['Cadastro', 'Vistos', 'Fazendo', 'Aguardando retorno', 'Finalizado'] as const;
export type Etapa = (typeof ETAPAS)[number];
export const TIPOS = ['Protocolo', 'Processo', 'Memorando', 'Ofício', 'Pedido de informação', 'Projeto de lei', 'Portaria', 'Outro documento'] as const;
export type Tipo = (typeof TIPOS)[number];
export const AREAS = ['Geral', 'Pessoal', 'Compras'] as const;
export type Area = (typeof AREAS)[number];
export const PRAZOS = ['Legal', 'Próprio'] as const;
export type PrazoTipo = (typeof PRAZOS)[number];

export type Tarefa = { id: string; texto: string; concluida: boolean; posicao: number };
export type Demanda = {
  id: string;
  tipo: Tipo;
  area: Area;
  numero: string;
  assunto: string;
  descricao: string;
  origem: string;
  etapa: Etapa;
  etapa_desde: string;
  /** Quando chegou à Secretaria (AAAA-MM-DD). Opcional: sem a data, não existe contagem de permanência. */
  chegou_em: string | null;
  /** Vencimento AJUSTADO (a data que vale em todas as telas): o prazo original antecipado para o primeiro dia disponível. */
  prazo: string | null;
  /** Prazo original: a data escolhida à mão ou calculada pelos botões de dias. */
  prazo_original: string | null;
  /** Quando o prazo veio de um botão (5, 10, 20 ou 30 dias): quantos dias e a partir de que dia a contagem partiu. */
  prazo_dias: number | null;
  prazo_base_em: string | null;
  /** Explica o ajuste ("21/11 sábado; 20/11 feriado: Nome"); nulo quando o vencimento é o próprio original. */
  prazo_ajuste: string | null;
  /** Prazo que já existia antes da regra do prazo original: o prazo de então virou a referência original. */
  prazo_legado: boolean;
  prazo_tipo: PrazoTipo;
  setor: string | null;
  acompanhar_em: string | null;
  concluida_em: string | null;
  arquivada_em: string | null;
  criado_em: string;
  atualizado_em: string;
  /** A anotação de Entradas de que a demanda nasceu (Virar demanda), ou nulo. A anotação original fica preservada no Arquivo. */
  entrada_id: string | null;
  /** Sobe a cada alteração da demanda ou de suas tarefas; a janela de edição devolve a que abriu para o banco recusar o salvamento se mudou. */
  versao: number;
  tarefas: Tarefa[];
};

/** Campos que o formulário pode gravar (a etapa, as tarefas e o arquivamento têm operações próprias). */
export type DadosDemanda = Partial<Pick<Demanda, 'tipo' | 'area' | 'numero' | 'assunto' | 'descricao' | 'origem' | 'chegou_em' | 'prazo_original' | 'prazo_dias' | 'prazo_tipo' | 'setor' | 'acompanhar_em'>> & { etapa?: Etapa };

/** Número e origem são opcionais: vazio (ou os marcadores antigos "s/n" e "Não informada", gravados antes do cadastro guiado) significa que não foram informados. */
export const numeroDe = (d: Pick<Demanda, 'numero'>) => (d.numero.trim() === '' || d.numero === 's/n' ? '' : d.numero);
export const origemDe = (d: Pick<Demanda, 'origem'>) => (d.origem.trim() === '' || d.origem === 'Não informada' ? '' : d.origem);
/** Identificação curta da demanda para títulos e listas: "Processo 1842/2026", ou só o tipo quando não há número. */
export const titulo = (d: Pick<Demanda, 'tipo' | 'numero'>) => [d.tipo, numeroDe(d)].filter(Boolean).join(' ');

export const TEM_AREA: readonly Tipo[] = ['Processo', 'Protocolo'];
export const areasDoTipo = (tipo: Tipo): readonly Area[] => (tipo === 'Protocolo' ? ['Geral', 'Pessoal'] : AREAS);

// Nenhuma função de data aqui lê o relógio sozinha: a data de hoje vem sempre de fora (contexto da tela), para a renderização do servidor não depender do horário.
const MS_DIA = 86_400_000;
/** Data de hoje em Brasília (AAAA-MM-DD), a mesma referência que o banco usa. */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
const emMs = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(a, m - 1, d); };
export const diasAte = (iso: string, hoje: string) => Math.round((emMs(iso) - emMs(hoje)) / MS_DIA);
export const diasDesde = (iso: string, hoje: string) => -diasAte(iso, hoje);
/** Dias desde um instante (timestamptz), pela data de Brasília. */
/** Dias corridos que a demanda está na Secretaria desde a chegada, ou null quando a chegada não foi informada (nada de contagem inventada). */
export const permanencia = (d: Pick<Demanda, 'chegou_em'>, hoje: string): number | null => (d.chegou_em ? Math.max(0, diasDesde(d.chegou_em, hoje)) : null);
export const diasDesdeInstante = (instante: string, hoje: string) => diasDesde(hojeISO(new Date(instante)), hoje);

export const atrasada = (d: Demanda, hoje: string) => !!d.prazo && diasAte(d.prazo, hoje) < 0 && d.etapa !== 'Finalizado' && !d.arquivada_em;
export const feitas = (d: Demanda) => d.tarefas.filter((t) => t.concluida).length;
/** Percentual das tarefas concluídas, ou null sem tarefas (a interface mostra "—"). */
export const percentual = (d: Demanda): number | null => (d.tarefas.length ? Math.round((feitas(d) / d.tarefas.length) * 100) : null);
export const proximaTarefa = (d: Demanda) => d.tarefas.find((t) => !t.concluida) ?? null;

export const dataCurta = (iso: string) => { const [, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m - 1]}`; };
export const dataBR = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
export const plural = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'}`;

/** Cor de classificação do card: Processo e Protocolo ganham tom pelo área; os demais documentos são neutros. */
const AREA_COR: Record<Area, string> = { Geral: 'azul', Pessoal: 'verde', Compras: 'amar' };
export const corCard = (d: Demanda) => (TEM_AREA.includes(d.tipo) ? ` cat-${AREA_COR[d.area]}` : '');
export const ETAPA_COR: Record<Etapa, number> = { Cadastro: 48, Vistos: 205, Fazendo: 262, 'Aguardando retorno': 330, Finalizado: 150 };
export const TIPO_COR: Record<string, number> = { Processo: 262, Protocolo: 262, Memorando: 212, 'Ofício': 28, Portaria: 150, 'Pedido de informação': 190, 'Projeto de lei': 340 };
export const SIGLA_TIPO: Record<string, string> = { Processo: 'P', Protocolo: 'PT', Memorando: 'M', 'Ofício': 'O', 'Pedido de informação': 'I', Portaria: 'PO', 'Projeto de lei': 'PL', 'Outro documento': 'D' };

export type Filtro = { texto: string; soAtrasadas: boolean; tipo: Tipo | ''; prazo: '' | 'sem' | 'atrasadas' | 'hoje' | 'sete' };
export const FILTRO_VAZIO: Filtro = { texto: '', soAtrasadas: false, tipo: '', prazo: '' };
export function filtrar(lista: Demanda[], f: Filtro, hoje: string): Demanda[] {
  const q = f.texto.trim().toLowerCase();
  return lista.filter((d) => {
    if (f.soAtrasadas && !atrasada(d, hoje)) return false;
    if (f.tipo && d.tipo !== f.tipo) return false;
    if (f.prazo === 'sem' && d.prazo) return false;
    if (f.prazo === 'atrasadas' && !atrasada(d, hoje)) return false;
    if (f.prazo === 'hoje' && !(d.prazo && d.etapa !== 'Finalizado' && diasAte(d.prazo, hoje) === 0)) return false;
    if (f.prazo === 'sete' && !(d.prazo && d.etapa !== 'Finalizado' && diasAte(d.prazo, hoje) >= 0 && diasAte(d.prazo, hoje) <= 7)) return false;
    return !q || `${d.tipo} ${d.numero} ${d.assunto} ${d.origem} ${d.descricao}`.toLowerCase().includes(q);
  });
}

export type Coluna = 'numero' | 'assunto' | 'origem' | 'prazo' | 'etapa' | 'pct';
export function ordenar(lista: Demanda[], coluna: Coluna, sentido: 1 | -1): Demanda[] {
  const chave = (d: Demanda): string | number => {
    if (coluna === 'prazo') return d.prazo ?? '9999-12-31';
    if (coluna === 'etapa') return ETAPAS.indexOf(d.etapa);
    if (coluna === 'pct') return percentual(d) ?? -1;
    if (coluna === 'numero') return numeroDe(d).toLowerCase();
    if (coluna === 'origem') return origemDe(d).toLowerCase();
    return d[coluna].toLowerCase();
  };
  return [...lista].sort((a, b) => { const x = chave(a), y = chave(b); return (x < y ? -1 : x > y ? 1 : a.criado_em.localeCompare(b.criado_em)) * (x === y ? 1 : sentido); });
}

/** Data que conta para os filtros do Início: quem aguarda retorno só volta quando faltarem 3 dias (ou menos) para o acompanhamento; finalizada nunca conta; sem data, não é inventada. */
export function dataFiltro(d: Demanda, hoje: string): string | null {
  if (d.etapa === 'Finalizado') return null;
  if (d.etapa === 'Aguardando retorno') return d.acompanhar_em && diasAte(d.acompanhar_em, hoje) <= 3 ? d.acompanhar_em : null;
  return d.prazo ?? null;
}

export type GrupoInicio = 'atrasadas' | 'hoje' | 'sete';

export function grupoFiltro(d: Demanda, hoje: string): GrupoInicio | null {
  const c = dataFiltro(d, hoje);
  if (!c) return null;
  const n = diasAte(c, hoje);
  return n < 0 ? 'atrasadas' : n === 0 ? 'hoje' : n <= 7 ? 'sete' : null;
}

/** Demandas de um grupo do Início, da data mais próxima para a mais distante; em empate, a que chegou há mais tempo primeiro. */
export const porGrupo = (lista: Demanda[], grupo: GrupoInicio, hoje: string) =>
  lista
    .filter((d) => grupoFiltro(d, hoje) === grupo)
    .sort((a, b) => diasAte(dataFiltro(a, hoje)!, hoje) - diasAte(dataFiltro(b, hoje)!, hoje) || (permanencia(b, hoje) ?? -1) - (permanencia(a, hoje) ?? -1));

/** Foco do dia: até 3 demandas, atrasadas primeiro, depois hoje, depois os próximos 7 dias. */
export const focoDoDia = (lista: Demanda[], hoje: string): Demanda[] =>
  (['atrasadas', 'hoje', 'sete'] as const).flatMap((g) => porGrupo(lista, g, hoje)).slice(0, 3);
