// Fila de apresentação dos cards de Demandas (decisão 77): a ordem inicial e os grupos por categoria funcional. Só apresentação: nada aqui muda prazo, etapa, vaga nem dado no banco.
// A mesma ordem vale no baralho do iPhone e nas filas da web e do iPad (as duas recebem a lista já ordenada). Regras puras, sem relógio: a data de hoje vem de fora.
import { AREAS, TIPOS, corCard, dataFiltro, diasAte, permanencia, temArea, type Demanda } from './demandas.ts';
import { chaveOpcao } from './documentos.ts';
import { demandaPrioritaria } from './prioridade.ts';
import type { DiaIndisponivel } from './prazos.ts';

/** 0 atrasada, 1 vence hoje, 2 próximas (até 7 dias), 3 as demais (além de 7 dias ou sem data). */
export function classeDaFila(d: Demanda, hoje: string, dias: readonly DiaIndisponivel[] = []): 0 | 1 | 2 | 3 {
  const data = dataFiltro(d, hoje, dias);
  if (!data) return 3;
  const n = diasAte(data, hoje);
  return n < 0 ? 0 : n === 0 ? 1 : n <= 7 ? 2 : 3;
}

/**
 * Ordem inicial: pedidos da Prefeita e do Gabinete primeiro; depois atrasadas, vencem hoje, próximas e demais. Em cada classe, a data aplicável mais antiga, a maior permanência, o cadastro
 * mais antigo e, por último, o id (desempate estável: a mesma lista sempre dá a mesma ordem).
 */
export function ordenarParaApresentar(lista: readonly Demanda[], hoje: string, dias: readonly DiaIndisponivel[] = []): Demanda[] {
  const chave = (d: Demanda) => ({ pri: demandaPrioritaria(d) ? 0 : 1, cl: classeDaFila(d, hoje, dias), data: dataFiltro(d, hoje, dias) ?? '9999-12-31', perm: permanencia(d, hoje) ?? -1 });
  const k = new Map(lista.map((d) => [d.id, chave(d)] as const));
  return [...lista].sort((a, b) => {
    const x = k.get(a.id)!, y = k.get(b.id)!;
    return x.pri - y.pri || x.cl - y.cl || x.data.localeCompare(y.data) || y.perm - x.perm || a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id);
  });
}

export type GrupoDeCards = { chave: string; rotulo: string; cor: 'azul' | 'verde' | 'amar' | 'neutro'; demandas: Demanda[] };

/** A chave do grupo: tipo e área para os documentos que têm área (Processo e Protocolo), só o tipo para os demais (inclusive os cadastrados pelo usuário) e uma chave própria sem documento. */
export function chaveDoGrupo(d: Pick<Demanda, 'tipo' | 'area'>): string {
  const t = chaveOpcao(d.tipo);
  return !t ? 'sem-documento' : temArea(d.tipo) ? `${t}|${d.area}` : t;
}

/**
 * Cada demanda em um único grupo, por tipo e área; a cor do grupo é a que o card já usa (azul, verde e amarelo pela área; neutra nos demais). A ordem dos grupos é fixa: os tipos de sempre na ordem do
 * cadastro e, dentro de cada um, a área; depois os tipos cadastrados pelo usuário em ordem alfabética; por fim "Sem documento". Dentro do grupo, a ordem inicial da fila.
 */
export function agruparPorCategoria(lista: readonly Demanda[], hoje: string, dias: readonly DiaIndisponivel[] = []): GrupoDeCards[] {
  const mapa = new Map<string, GrupoDeCards>();
  for (const d of ordenarParaApresentar(lista, hoje, dias)) {
    const c = chaveDoGrupo(d);
    let g = mapa.get(c);
    if (!g) {
      const cor = corCard(d).trim().replace('cat-', '') || 'neutro';
      g = { chave: c, rotulo: c === 'sem-documento' ? 'Sem documento' : temArea(d.tipo) ? `${d.tipo} · ${d.area}` : (d.tipo ?? ''), cor: cor as GrupoDeCards['cor'], demandas: [] };
      mapa.set(c, g);
    }
    g.demandas.push(d);
  }
  const tipos = TIPOS.map((t) => chaveOpcao(t));
  const posicao = (g: GrupoDeCards) => {
    if (g.chave === 'sem-documento') return [3, 0, 0, ''] as const;
    const [t, a] = g.chave.split('|'), i = tipos.indexOf(t);
    return i >= 0 ? ([0, i, Math.max(0, AREAS.indexOf(a as (typeof AREAS)[number])), ''] as const) : ([1, 0, 0, t] as const);
  };
  return [...mapa.values()].sort((a, b) => { const x = posicao(a), y = posicao(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3].localeCompare(y[3], 'pt-BR'); });
}
