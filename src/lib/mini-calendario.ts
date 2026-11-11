// Mini calendário do Início (decisão 64): o que cada dia tem, em seis categorias. Regras puras, sem banco e sem relógio ("hoje" vem de fora). Todas as datas são datas do calendário
// (AAAA-MM-DD, America/Sao_Paulo) e a semana começa na segunda. Nada aqui reescreve vencimento: o Prazo é o vencimento efetivo que o Dmanda já gravou (ajustado por fim de semana, feriado e
// evento externo de dia inteiro cadastrados em Dias indisponíveis). Acompanhar em e Retorno do setor continuam só na Agenda principal.
import { dataPorExtenso, marcosDaDemanda } from './agenda.ts';
import { compararEventos, horarioDe, type Evento } from './eventos.ts';
import type { Demanda } from './demandas.ts';
import { titulo as tituloDemanda } from './demandas.ts';
import type { Pagamento } from './pagamentos.ts';
import type { DiaIndisponivel } from './prazos.ts';

export const CATEGORIAS_MINI = ['compromisso', 'feriado', 'pagamento', 'evento', 'reuniao', 'prazo'] as const;
export type CategoriaMini = (typeof CATEGORIAS_MINI)[number];
export const ROTULO_MINI: Record<CategoriaMini, string> = { compromisso: 'Compromisso', feriado: 'Feriado', pagamento: 'Pagamento', evento: 'Evento', reuniao: 'Reunião', prazo: 'Prazo' };

/** De onde vem o item: o clique abre o registro certo (evento e dia indisponível na Agenda e em Configurações; demanda na consulta). */
export type OrigemMini = { tipo: 'evento'; id: string } | { tipo: 'dia'; id: string } | { tipo: 'pagamento'; id: string } | { tipo: 'demanda'; id: string };
export type ItemMini = { categoria: CategoriaMini; chave: string; titulo: string; detalhe: string; origem: OrigemMini };

export type FontesMini = { eventos: readonly Evento[]; dias: readonly DiaIndisponivel[]; pagamentos: readonly Pagamento[]; demandas: readonly Demanda[]; hoje: string };

/** A categoria de um evento da Agenda: Reunião é Reunião, Evento externo é Evento, e Compromisso e Lembrete (os lembretes existentes) entram em Compromisso. */
export const categoriaDoEvento = (e: Pick<Evento, 'tipo'>): CategoriaMini => (e.tipo === 'Reunião' ? 'reuniao' : e.tipo === 'Evento externo' ? 'evento' : 'compromisso');
/** Dias indisponíveis: Feriado é Feriado; o evento externo de dia inteiro cadastrado lá é Evento. */
export const categoriaDoDia = (x: Pick<DiaIndisponivel, 'categoria'>): CategoriaMini => (x.categoria === 'Feriado' ? 'feriado' : 'evento');

/** Todos os itens de um dia, em ordem: o que tem horário em ordem cronológica depois do que ocupa o dia inteiro; empates pela ordem das categorias e pelo título. */
export function itensMini(data: string, f: FontesMini): ItemMini[] {
  const itens: (ItemMini & { ordem: string })[] = [];
  const evs = f.eventos.filter((e) => e.data === data).sort(compararEventos);
  evs.forEach((e) => itens.push({ categoria: categoriaDoEvento(e), chave: `ev:${e.id}`, titulo: e.titulo, detalhe: e.tipo === 'Evento externo' ? `Evento externo, ${horarioDe(e).toLowerCase()}` : `${e.tipo}, ${horarioDe(e).toLowerCase()}`, origem: { tipo: 'evento', id: e.id }, ordem: e.dia_inteiro ? '0' : `1${e.inicio}` }));
  for (const x of f.dias) if (x.data === data) itens.push({ categoria: categoriaDoDia(x), chave: `di:${x.id}`, titulo: x.descricao, detalhe: x.categoria === 'Feriado' ? 'Dia sem trabalho' : 'Evento externo, dia inteiro', origem: { tipo: 'dia', id: x.id }, ordem: '0' });
  for (const p of f.pagamentos) if (p.data === data) itens.push({ categoria: 'pagamento', chave: `pg:${p.id}`, titulo: 'Pagamento do salário', detalhe: 'Data cadastrada em Configurações', origem: { tipo: 'pagamento', id: p.id }, ordem: '0' });
  for (const d of f.demandas) {
    for (const m of marcosDaDemanda(d, f.dias, f.hoje)) if (m.tipo === 'vencimento' && m.data === data) itens.push({ categoria: 'prazo', chave: `pz:${d.id}`, titulo: d.assunto, detalhe: `Prazo de ${tituloDemanda(d)}${m.atrasado ? ', vencido' : ''}`, origem: { tipo: 'demanda', id: d.id }, ordem: '2' });
  }
  const pos = (c: CategoriaMini) => CATEGORIAS_MINI.indexOf(c);
  return itens.sort((a, b) => a.ordem.localeCompare(b.ordem) || pos(a.categoria) - pos(b.categoria) || a.titulo.localeCompare(b.titulo, 'pt-BR') || a.chave.localeCompare(b.chave)).map(({ ordem: _o, ...i }) => { void _o; return i; });
}

/** Itens de um intervalo de datas (inclusive), por dia: o mês inteiro numa passada, para colorir as células. */
export function mapaMini(de: string, ate: string, f: FontesMini): Map<string, ItemMini[]> {
  const datas = new Set<string>();
  for (const e of f.eventos) if (e.data >= de && e.data <= ate) datas.add(e.data);
  for (const x of f.dias) if (x.data >= de && x.data <= ate) datas.add(x.data);
  for (const p of f.pagamentos) if (p.data >= de && p.data <= ate) datas.add(p.data);
  for (const d of f.demandas) for (const m of marcosDaDemanda(d, f.dias, f.hoje)) if (m.tipo === 'vencimento' && m.data >= de && m.data <= ate) datas.add(m.data);
  const mapa = new Map<string, ItemMini[]>();
  for (const dt of datas) { const l = itensMini(dt, f); if (l.length) mapa.set(dt, l); }
  return mapa;
}

/** As categorias presentes num dia, sem repetir, na ordem fixa das seis (a mesma da legenda): define as faixas de cor da célula. */
export const categoriasDoDia = (itens: readonly Pick<ItemMini, 'categoria'>[]): CategoriaMini[] => CATEGORIAS_MINI.filter((c) => itens.some((i) => i.categoria === c));

const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
/** Nome acessível de um dia: a data por extenso, o que ele é (hoje, selecionado) e as categorias com a quantidade, porque a cor sozinha não conta nada. */
export function descreverDiaMini(data: string, itens: readonly Pick<ItemMini, 'categoria'>[], o: { hoje: string; selecionado: boolean }): string {
  const p = [dataPorExtenso(data)];
  if (data === o.hoje) p.push('hoje');
  const cats = categoriasDoDia(itens);
  p.push(cats.length ? cats.map((c) => `${ROTULO_MINI[c]}: ${plural(itens.filter((i) => i.categoria === c).length, 'item', 'itens')}`).join('; ') : 'sem itens');
  if (o.selecionado) p.push('selecionado');
  return p.join('; ');
}

/**
 * Faixas de cor da célula: cada categoria ocupa uma fatia igual, da esquerda para a direita, com uma transição curta (em px, para não depender do tamanho da célula) entre as cores.
 * `cor(c)` devolve a referência da cor da categoria (uma variável de CSS). Uma só categoria é uma cor lisa; sem categoria, nada.
 */
export function faixasDaCelula(cats: readonly CategoriaMini[], cor: (c: CategoriaMini) => string, transicaoPx = 2): string | undefined {
  if (!cats.length) return undefined;
  if (cats.length === 1) return `linear-gradient(90deg, ${cor(cats[0])}, ${cor(cats[0])})`;
  const n = cats.length, paradas: string[] = [];
  cats.forEach((c, i) => {
    const ini = i === 0 ? '0%' : `calc(${(i * 100) / n}% + ${transicaoPx}px)`, fim = i === n - 1 ? '100%' : `calc(${((i + 1) * 100) / n}% - ${transicaoPx}px)`;
    paradas.push(`${cor(c)} ${ini}`, `${cor(c)} ${fim}`);
  });
  return `linear-gradient(90deg, ${paradas.join(', ')})`;
}
