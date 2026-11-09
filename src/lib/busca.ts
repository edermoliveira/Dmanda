// Regras puras da busca global: o que é pesquisável em cada tipo, como a consulta casa (sem acento, por trechos, todas as palavras) e a ordem dos resultados.
// Sem banco, sem relógio e sem estado: recebe as listas que a tela já tem e devolve os resultados. Nada é indexado nem guardado (a busca nasce a cada consulta).
import { titulo, type Demanda } from './demandas.ts';
import type { Entrada } from './entradas.ts';
import type { Evento } from './eventos.ts';

export type TipoResultado = 'demanda' | 'tarefa' | 'entrada' | 'evento';
/** Para onde o resultado abre, pelas janelas que já existem: a consulta da demanda, a leitura da anotação ou a janela do evento. */
export type Destino = { t: 'editar'; id: string } | { t: 'entrada'; id: string } | { t: 'evento'; id: string };
export type ResultadoBusca = {
  /** Única entre os tipos (uma tarefa e a demanda dela têm ids diferentes). */
  chave: string;
  tipo: TipoResultado;
  titulo: string;
  /** Segunda linha: o que ajuda a reconhecer o registro (etapa, demanda de origem, data). */
  detalhe: string;
  /** Presente só quando o registro não está "normal": Arquivada, Finalizada ou Convertida em demanda. */
  estado: string | null;
  destino: Destino;
};
export type Fontes = {
  demandas: readonly Demanda[];
  arquivadas: readonly Demanda[];
  entradas: readonly Entrada[];
  entradasArquivadas: readonly Entrada[];
  eventos: readonly Evento[];
};

export const LIMITE_RESULTADOS = 60;
export const ROTULO_TIPO: Record<TipoResultado, string> = { demanda: 'Demanda', tarefa: 'Tarefa', entrada: 'Entrada', evento: 'Evento' };

/** Minúsculas e sem acento, para "reuniao" achar "Reunião". */
export const simplificar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** As palavras da consulta, já simplificadas. Vazia (só espaços) não busca nada. */
export const palavrasDa = (consulta: string): string[] => simplificar(consulta).split(/\s+/).filter(Boolean);
const casa = (palavras: string[], texto: string) => { const t = simplificar(texto); return palavras.every((p) => t.includes(p)); };
const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const IDENT = (d: Demanda) => `${titulo(d)} · ${d.assunto}`;

/** Posição em que o registro aparece na lista: título casando vem antes de só o corpo casar; registros normais antes dos arquivados e convertidos. */
type Candidato = ResultadoBusca & { peso: number };

export function buscar(consulta: string, f: Fontes): { resultados: ResultadoBusca[]; total: number } {
  const palavras = palavrasDa(consulta);
  if (!palavras.length) return { resultados: [], total: 0 };
  const achados: Candidato[] = [];
  const ordemTipo: Record<TipoResultado, number> = { demanda: 0, tarefa: 1, entrada: 2, evento: 3 };

  const demandas = (lista: readonly Demanda[], arquivada: boolean) => {
    for (const d of lista) {
      const estado = arquivada ? 'Arquivada' : d.etapa === 'Finalizado' ? 'Finalizada' : null;
      const cabeca = `${d.tipo ?? ''} ${d.numero} ${d.assunto}`;
      const corpo = `${cabeca} ${d.descricao} ${d.origem} ${d.setor ?? ''}`;
      if (casa(palavras, corpo)) {
        achados.push({ chave: `d:${d.id}`, tipo: 'demanda', titulo: d.assunto || titulo(d), detalhe: [titulo(d), d.etapa, d.origem].filter(Boolean).join(' · '), estado, destino: { t: 'editar', id: d.id }, peso: (casa(palavras, cabeca) ? 0 : 1) + (estado ? 2 : 0) });
      }
      for (const t of d.tarefas) {
        if (casa(palavras, t.texto)) achados.push({ chave: `t:${t.id}`, tipo: 'tarefa', titulo: t.texto, detalhe: `Da demanda ${IDENT(d)}${t.concluida ? ' · concluída' : ''}`, estado, destino: { t: 'editar', id: d.id }, peso: 1 + (estado ? 2 : 0) });
      }
    }
  };
  demandas(f.demandas, false);
  demandas(f.arquivadas, true);

  const entradas = (lista: readonly Entrada[]) => {
    for (const e of lista) {
      if (!casa(palavras, `${e.titulo}\n${e.texto}`)) continue;
      const estado = e.demanda_id ? 'Convertida em demanda' : e.arquivada_em ? 'Arquivada' : null;
      const rotulo = e.titulo.trim() || e.texto.trim().split(/\r?\n/).find((l) => l.trim()) || 'Entrada';
      const corpo = e.titulo.trim() ? e.texto.trim().replace(/\s+/g, ' ') : '';
      achados.push({ chave: `e:${e.id}`, tipo: 'entrada', titulo: rotulo, detalhe: corpo.length > 90 ? `${corpo.slice(0, 89)}…` : corpo, estado, destino: { t: 'entrada', id: e.id }, peso: (casa(palavras, e.titulo) ? 0 : 1) + (estado ? 2 : 0) });
    }
  };
  entradas(f.entradas);
  entradas(f.entradasArquivadas);

  for (const ev of f.eventos) {
    if (!casa(palavras, `${ev.titulo} ${ev.descricao} ${dataBr(ev.data)} ${ev.data}`)) continue;
    achados.push({ chave: `v:${ev.id}`, tipo: 'evento', titulo: ev.titulo, detalhe: `${ev.tipo} · ${dataBr(ev.data)}${ev.dia_inteiro ? ' · dia inteiro' : ev.inicio ? ` · ${ev.inicio}` : ''}`, estado: null, destino: { t: 'evento', id: ev.id }, peso: casa(palavras, ev.titulo) ? 0 : 1 });
  }

  // a mesma entrada pode estar nas duas listas durante uma atualização: fica a primeira
  const vistos = new Set<string>();
  const unicos = achados.filter((a) => (vistos.has(a.chave) ? false : (vistos.add(a.chave), true)));
  unicos.sort((a, b) => a.peso - b.peso || ordemTipo[a.tipo] - ordemTipo[b.tipo]);
  return { resultados: unicos.slice(0, LIMITE_RESULTADOS).map((a): ResultadoBusca => ({ chave: a.chave, tipo: a.tipo, titulo: a.titulo, detalhe: a.detalhe, estado: a.estado, destino: a.destino })), total: unicos.length };
}
