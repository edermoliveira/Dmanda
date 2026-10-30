// Regras puras de Entradas (anotações em post-its): estados, tags, busca, ordem, conversão em demanda e conflito de edição. Sem banco, sem relógio e sem imports
// (roda também direto no Node, nos testes de regras). As regras que protegem os dados ficam no banco (migração 10); aqui só o que a tela precisa derivar.

export type Entrada = {
  id: string;
  titulo: string;
  texto: string;
  /** Posição na paleta de tons pastel (0 a 4 oferecidos; 5 é a cor retirada, ainda aceita em notas antigas); a tela deriva o tom real da paleta ativa e do tema. */
  cor: number;
  fixada: boolean;
  arquivada_em: string | null;
  /** Preenchido quando a anotação virou demanda: ela sai de Entradas, fica preservada como estava e não se altera mais. */
  demanda_id: string | null;
  /** Sobe a cada alteração; a janela de edição devolve a que abriu para o banco recusar o salvamento se mudou. */
  versao: number;
  criado_em: string;
  atualizado_em: string;
};

/** Os campos que a pessoa edita em uma anotação. */
export type CamposEntrada = { titulo: string; texto: string; cor: number; fixada: boolean };

export const COR_AUTOMATICA = -1;
/** Cores oferecidas e sorteadas (0 a 4). Anotações antigas podem ter a cor 5, retirada: continuam válidas (COR_MAX_ACEITA), só não são mais oferecidas. */
export const QTD_CORES = 5;
export const COR_MAX_ACEITA = 5;
export const LIMITE_TITULO = 200;
export const LIMITE_TEXTO = 20_000;
/** O assunto de uma demanda tem no máximo 300 caracteres (validacao.ts). */
const LIMITE_ASSUNTO = 300;

export type EstadoEntrada = 'ativa' | 'arquivada' | 'convertida';
export const estadoDe = (e: Pick<Entrada, 'arquivada_em' | 'demanda_id'>): EstadoEntrada => (e.demanda_id ? 'convertida' : e.arquivada_em ? 'arquivada' : 'ativa');

// ---------- tags ----------
// "#tag" em qualquer lugar do título ou do texto: letras, números e sublinhado. Não há coluna de tags: elas derivam do conteúdo, sempre iguais em todas as telas.
const RE_TAG = /#[\p{L}\p{N}_]+/gu;
export function tagsDe(e: Pick<CamposEntrada, 'titulo' | 'texto'>): string[] {
  const achadas = `${e.titulo} ${e.texto}`.match(RE_TAG) ?? [];
  return [...new Set(achadas.map((t) => t.slice(1).toLowerCase()))];
}
/** O texto sem as tags e com os espaços compactados (é o que aparece na grade de post-its). */
export const semTags = (s: string) => s.replace(RE_TAG, '').replace(/\s+/g, ' ').trim();
/** Na grade aparece só o título; sem título, as primeiras frases do texto (a tela corta o excesso pelo espaço). */
export const resumoDe = (e: Pick<CamposEntrada, 'titulo' | 'texto'>) => semTags(e.titulo) || semTags(e.texto);
export const temTitulo = (e: Pick<CamposEntrada, 'titulo'>) => semTags(e.titulo) !== '';
/** Data e hora da criação (America/Sao_Paulo, 24 h, sem segundos), como "30/10/2026 às 14:48". Vem de criado_em e nunca muda com edições. */
export const carimbo = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
};
/** Tags com a contagem de anotações de cada uma, em ordem alfabética. */
export function contarTags(lista: Pick<CamposEntrada, 'titulo' | 'texto'>[]): [string, number][] {
  const m = new Map<string, number>();
  for (const e of lista) for (const t of tagsDe(e)) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

// ---------- busca, filtro e ordem ----------
/** Minúsculas e sem acento, para a busca achar "reuniao" em "Reunião". */
export const simplificar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export type FiltroEntradas = { texto: string; tag: string };
export function filtrarEntradas<T extends Entrada>(lista: T[], f: FiltroEntradas): T[] {
  const q = simplificar(f.texto.trim());
  return lista.filter((e) => (!f.tag || tagsDe(e).includes(f.tag)) && (!q || simplificar(`${e.titulo}\n${e.texto}`).includes(q)));
}
/** Fixadas no topo; dentro de cada grupo, a mais recente primeiro (editar não muda a posição: o post-it não pula de lugar enquanto se escreve). */
export const ordenarEntradas = <T extends Entrada>(lista: T[]): T[] =>
  [...lista].sort((a, b) => Number(b.fixada) - Number(a.fixada) || b.criado_em.localeCompare(a.criado_em) || a.id.localeCompare(b.id));

// ---------- virar demanda ----------
/** Corta em palavra inteira e termina com reticências. Só usado quando a primeira linha passa do limite do assunto; o texto completo continua na descrição. */
function cortar(s: string, max: number): string {
  if (s.length <= max) return s;
  const corte = s.slice(0, max - 1);
  const espaco = corte.lastIndexOf(' ');
  return `${(espaco > max * 0.5 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}
/**
 * O que o cadastro guiado recebe de uma anotação (tudo editável). Com título explícito: ele é o assunto e o texto inteiro vai para a descrição.
 * Sem título: a primeira linha útil (a primeira que tem algo além de tags) é o assunto e todo o resto vai para a descrição, na ordem, sem perder linha nem tag.
 * Se essa linha passa do limite do assunto, o assunto é o começo dela e a descrição guarda o texto inteiro. Não inventa origem, chegada, prazo nem tarefas.
 */
export function paraDemanda(e: Pick<CamposEntrada, 'titulo' | 'texto'>): { assunto: string; descricao: string } {
  const titulo = e.titulo.trim(), texto = e.texto.trim();
  if (titulo) return { assunto: cortar(titulo, LIMITE_ASSUNTO), descricao: texto };
  const linhas = texto.split(/\r?\n/);
  let i = linhas.findIndex((l) => semTags(l) !== '');
  if (i < 0) i = Math.max(0, linhas.findIndex((l) => l.trim() !== ''));
  const linha = (linhas[i] ?? '').trim();
  if (linha.length > LIMITE_ASSUNTO) return { assunto: cortar(linha, LIMITE_ASSUNTO), descricao: texto };
  return { assunto: linha, descricao: [...linhas.slice(0, i), ...linhas.slice(i + 1)].join('\n').trim() };
}

// ---------- edição: o que mudou e o que realmente conflita ----------
/** Os campos como o banco os guarda (título e texto aparados), para comparar sem ruído de espaços. */
export const aparar = (c: CamposEntrada): CamposEntrada => ({ ...c, titulo: c.titulo.trim(), texto: c.texto.trim() });
/** Só os campos que diferem da base (a última versão conhecida do banco): é o que o salvamento envia, para nunca regravar o que a pessoa não mexeu. */
export function diferencas(local: CamposEntrada, base: CamposEntrada): Partial<CamposEntrada> {
  const l = aparar(local), b = aparar(base), d: Partial<CamposEntrada> = {};
  if (l.titulo !== b.titulo) d.titulo = l.titulo;
  if (l.texto !== b.texto) d.texto = l.texto;
  if (l.cor !== b.cor) d.cor = l.cor;
  if (l.fixada !== b.fixada) d.fixada = l.fixada;
  return d;
}
export const vazia = (c: Pick<CamposEntrada, 'titulo' | 'texto'>) => !c.titulo.trim() && !c.texto.trim();
/**
 * O banco recusou por versão (outro aparelho salvou antes). `base` tem, para cada campo que a pessoa mexeu, o valor que o banco tinha quando ela começou a mexer.
 * Só é conflito de verdade nos campos que a pessoa mexeu E que o outro aparelho também mudou, para um valor diferente do dela: se o outro aparelho só fixou ou trocou a cor
 * e a pessoa só escreveu texto, os dois cabem juntos e o salvamento é refeito sobre a versão nova, sem perguntar nada.
 */
export function camposEmConflito(base: Partial<CamposEntrada>, atual: CamposEntrada, patch: Partial<CamposEntrada>): (keyof CamposEntrada)[] {
  const a = aparar(atual);
  return (Object.keys(patch) as (keyof CamposEntrada)[]).filter((k) => k in base && a[k] !== base[k] && a[k] !== patch[k]);
}
