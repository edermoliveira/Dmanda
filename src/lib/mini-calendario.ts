// Mini calendário do Início (decisão 64): o que cada dia tem, em seis categorias. Regras puras, sem banco e sem relógio ("hoje" vem de fora). Todas as datas são datas do calendário
// (AAAA-MM-DD, America/Sao_Paulo) e a semana começa na segunda. Nada aqui reescreve vencimento: o Prazo é o vencimento efetivo que o Dmanda já gravou (ajustado por fim de semana, feriado e
// evento externo de dia inteiro cadastrados em Dias indisponíveis). Acompanhar em e Retorno do setor continuam só na Agenda principal.
import { dataPorExtenso, indiceSemana, marcosDaDemanda } from './agenda.ts';
import { compararEventos, horarioDe, type Evento } from './eventos.ts';
import type { Demanda } from './demandas.ts';
import { titulo as tituloDemanda } from './demandas.ts';
import type { Pagamento } from './pagamentos.ts';
import { somarDias, type DiaIndisponivel } from './prazos.ts';

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
 * A cor única de uma célula (decisão 65): mistura, em proporções iguais, as cores DISTINTAS das categorias presentes no dia. Duas categorias dão a média das duas, três dão a média das três, e assim
 * por diante; várias marcas da mesma categoria contam uma vez só e mantêm a cor dela. A mistura é feita no espaço oklab (as coordenadas são lineares, então a média não depende da ordem) e a
 * ordem das categorias é a fixa da legenda. `cor(c)` devolve a referência da cor da categoria (uma variável de CSS): nenhuma cor literal passa por aqui. Sem categoria, nada.
 */
export function corMisturada(cats: readonly CategoriaMini[], cor: (c: CategoriaMini) => string): string | undefined {
  const lista = CATEGORIAS_MINI.filter((c) => cats.includes(c));
  if (!lista.length) return undefined;
  const pct = (x: number) => `${Math.round(x * 10000) / 10000}%`;
  return lista.slice(1).reduce((acc, c, i) => `color-mix(in oklab, ${acc} ${pct((100 * (i + 1)) / (i + 2))}, ${cor(c)} ${pct(100 / (i + 2))})`, cor(lista[0]));
}

/** Os atalhos do rodapé: quantos dias depois de hoje cada um leva. */
export const ATALHOS_MINI = [{ rotulo: 'Hoje', dias: 0 }, { rotulo: 'Amanhã', dias: 1 }, { rotulo: 'Em 3 dias', dias: 3 }, { rotulo: 'Em 1 semana', dias: 7 }, { rotulo: 'Em 2 semanas', dias: 14 }] as const;

/** A grade do mês: sempre seis semanas de segunda a domingo (42 células), com os dias do mês anterior e do seguinte completando as pontas. `primeiro` é o dia 1 do mês mostrado. */
export function seisSemanas(primeiro: string): { data: string; doMes: boolean }[][] {
  const inicio = somarDias(primeiro, -indiceSemana(primeiro)), mes = primeiro.slice(0, 7);
  return Array.from({ length: 6 }, (_, s) => Array.from({ length: 7 }, (_, i) => { const d = somarDias(inicio, s * 7 + i); return { data: d, doMes: d.slice(0, 7) === mes }; }));
}
