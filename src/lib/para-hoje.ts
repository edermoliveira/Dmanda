// Para hoje: o painel de execução do Início, com até 4 vagas persistentes (decisão 80). Aqui ficam só as regras de quem pode ocupar uma vaga, em que ordem e o que vai para a Urgência
// (o banco guarda as vagas e impede duplicação). Humor e produtividade não entram no cálculo. Sem relógio: a data de hoje vem de fora.
import { contagemRetorno, dataFiltro, diasAte, esperaPrefeita, permanencia, type Demanda, type Etapa } from './demandas.ts';
import { chaveOpcao } from './documentos.ts';
import type { DiaIndisponivel } from './prazos.ts';
import { demandaPrioritaria } from './prioridade.ts';

export const VAGAS_PARA_HOJE = 4;
export type ClasseUrgencia = 'atrasada' | 'hoje' | 'proxima' | 'sem-prazo';
export type Elegivel = { demanda: Demanda; classe: ClasseUrgencia; data: string | null; cobranca: boolean };
const ORDEM: Record<ClasseUrgencia, number> = { atrasada: 0, hoje: 1, proxima: 2, 'sem-prazo': 3 };
/** Urgência de verdade: atrasada ou vencendo hoje. Uma urgência que aparece depois de as vagas serem escolhidas é destacada à parte. */
export const ehUrgente = (c: ClasseUrgencia) => c === 'atrasada' || c === 'hoje';

/**
 * Quem pode ocupar uma vaga: demanda aberta em que há uma ação do usuário.
 *  - Cadastro, Vistos e Fazendo dependem do usuário: entram com a data aplicável (prazo, "Acompanhar em" ou retorno), ou sem prazo (há ação possível). Só ficam de fora as com data
 *    além dos próximos 7 dias.
 *  - Aguardando retorno e Aguardando Prefeita dependem de terceiros: só entram quando a cobrança está devida (retorno de 10 dias ou "Acompanhar em" vencidos; espera da Prefeita acima do limite
 *    de 10 dias), e então contam como urgência pela data da cobrança.
 * Ordem: atrasadas, depois vencem hoje, depois até 7 dias, depois sem prazo. Dentro de cada grupo, a marca Rápida primeiro, depois a data mais antiga, a maior permanência e o cadastro mais antigo.
 * Quem escolhe as candidatas das vagas livres é `candidatasParaVagas` (as pedidas pela Prefeita ou pelo Gabinete passam à frente).
 */
export function elegiveisParaHoje(lista: readonly Demanda[], hoje: string, dias: readonly DiaIndisponivel[] = []): Elegivel[] {
  const saida: Elegivel[] = [];
  for (const d of lista) {
    const a = dataDaAcao(d, hoje, dias);
    if (!a) continue;
    const n = a.data ? diasAte(a.data, hoje) : null;
    if (n !== null && n > 7) continue;
    const classe: ClasseUrgencia = n === null ? 'sem-prazo' : n < 0 ? 'atrasada' : n === 0 ? 'hoje' : 'proxima';
    saida.push({ demanda: d, classe, data: a.data, cobranca: a.cobranca });
  }
  return saida.sort((a, b) =>
    ORDEM[a.classe] - ORDEM[b.classe]
    || Number(b.demanda.rapida) - Number(a.demanda.rapida)
    || (a.data ?? '9999-12-31').localeCompare(b.data ?? '9999-12-31')
    || (permanencia(b.demanda, hoje) ?? -1) - (permanencia(a.demanda, hoje) ?? -1)
    || a.demanda.criado_em.localeCompare(b.demanda.criado_em)
    || a.demanda.id.localeCompare(b.demanda.id));
}

/**
 * A data de ação da demanda aberta, sem o corte de 7 dias, ou nulo quando não há ação do usuário agora (finalizada, arquivada, ou em espera sem cobrança devida).
 * `data` é nulo quando há ação possível mas nenhuma data (Cadastro, Vistos ou Fazendo sem prazo). Em espera, a data é a da cobrança e `cobranca` fica verdadeiro.
 */
export function dataDaAcao(d: Demanda, hoje: string, dias: readonly DiaIndisponivel[] = []): { data: string | null; cobranca: boolean } | null {
  if (d.etapa === 'Finalizado' || d.arquivada_em) return null;
  if (d.etapa === 'Aguardando retorno' || d.etapa === 'Aguardando Prefeita') {
    const datas = [d.acompanhar_em, d.etapa === 'Aguardando retorno' ? contagemRetorno(d, dias)?.data ?? null : null].filter((x): x is string => !!x && diasAte(x, hoje) <= 0);
    if (datas.length) return { data: datas.reduce((m, x) => (x < m ? x : m)), cobranca: true };
    if (d.etapa === 'Aguardando Prefeita' && esperaPrefeita(d, hoje)?.alerta) return { data: hoje, cobranca: true };
    return null;
  }
  return { data: dataFiltro(d, hoje, dias), cobranca: false };
}

export type Vaga = { posicao: number; demanda_id: string };
/** Vagas ocupadas por demandas ainda abertas, na ordem das posições; a vaga de uma demanda finalizada, arquivada ou excluída fica livre (o banco repõe só ela). */
export function vagasAbertas(vagas: readonly Vaga[], lista: readonly Demanda[]): { posicao: number; demanda: Demanda }[] {
  const porId = new Map(lista.map((d) => [d.id, d] as const));
  return [...vagas].sort((a, b) => a.posicao - b.posicao).flatMap((v) => { const d = porId.get(v.demanda_id); return d && d.etapa !== 'Finalizado' && !d.arquivada_em ? [{ posicao: v.posicao, demanda: d }] : []; });
}
/** Há vaga livre e candidata para ocupá-la? (evita chamar o banco sem necessidade) */
export function precisaCompletar(vagas: readonly Vaga[], lista: readonly Demanda[], elegiveis: readonly Elegivel[]): boolean {
  const abertas = vagasAbertas(vagas, lista), ocupadas = new Set(abertas.map((v) => v.demanda.id));
  return abertas.length < VAGAS_PARA_HOJE && elegiveis.some((e) => !ocupadas.has(e.demanda.id));
}
/** As candidatas às vagas livres, na ordem em que o banco as recebe: as pedidas pela Prefeita ou pelo Gabinete primeiro (decisão 61), depois a ordem das elegíveis; sem as que já ocupam vaga. */
export function candidatasParaVagas(elegiveis: readonly Elegivel[], ocupadas: ReadonlySet<string>): Elegivel[] {
  const livres = elegiveis.filter((e) => !ocupadas.has(e.demanda.id));
  return [...livres.filter((e) => demandaPrioritaria(e.demanda)), ...livres.filter((e) => !demandaPrioritaria(e.demanda))];
}

/** O tipo é Ofício? (sem diferença de maiúsculas, espaços nem acento) */
export const ehOficio = (d: Pick<Demanda, 'tipo'>) => chaveOpcao(d.tipo).normalize('NFD').replace(/\p{Diacritic}/gu, '') === 'oficio';

export type Urgencia = { demandas: Demanda[]; /** verdadeiro quando não há urgência e a lista traz os vencimentos mais próximos */ proximos: boolean };
/**
 * Urgência do Início (decisão 80): fora das vagas (nunca repete uma demanda que ocupa vaga), cada demanda uma só vez, com
 *  - pedidos da Prefeita e do Gabinete (origem exata, decisão 61) em que há ação agora, mesmo com prazo distante ou sem prazo;
 *  - atrasadas e as que vencem hoje (a mesma urgência de antes, com as de acompanhamento e cobrança pelas regras das etapas de espera);
 *  - Ofícios com vencimento efetivo hoje ou nos próximos 7 dias (7 entra, 8 não).
 * Ordem: Prefeita e Gabinete primeiro; em cada grupo a data mais antiga (maior atraso) antes da mais próxima, depois a marca Rápida, a maior permanência, o cadastro mais antigo e o id.
 * Sem nenhuma urgência, mostra as demais elegíveis que têm vencimento, do mais próximo ao mais distante (nada de vencimento inventado: as sem data ficam de fora).
 */
export function urgenciasDoInicio(vagas: readonly Vaga[], lista: readonly Demanda[], hoje: string, dias: readonly DiaIndisponivel[] = []): Urgencia {
  const ocupadas = new Set(vagasAbertas(vagas, lista).map((v) => v.demanda.id));
  const ordem = (a: { d: Demanda; data: string | null; prio: boolean }, b: { d: Demanda; data: string | null; prio: boolean }) =>
    Number(b.prio) - Number(a.prio)
    || (a.data ?? '9999-12-31').localeCompare(b.data ?? '9999-12-31')
    || Number(b.d.rapida) - Number(a.d.rapida)
    || (permanencia(b.d, hoje) ?? -1) - (permanencia(a.d, hoje) ?? -1)
    || a.d.criado_em.localeCompare(b.d.criado_em)
    || a.d.id.localeCompare(b.d.id);
  const urgentes: { d: Demanda; data: string | null; prio: boolean }[] = [], vistos = new Set<string>();
  for (const d of lista) {
    if (ocupadas.has(d.id) || vistos.has(d.id)) continue;
    const a = dataDaAcao(d, hoje, dias);
    if (!a) continue;
    const prio = demandaPrioritaria(d), n = a.data ? diasAte(a.data, hoje) : null;
    if (prio || (n !== null && (n <= 0 || (ehOficio(d) && n <= 7)))) { vistos.add(d.id); urgentes.push({ d, data: a.data, prio }); }
  }
  if (urgentes.length) return { demandas: urgentes.sort(ordem).map((x) => x.d), proximos: false };
  const proximos = elegiveisParaHoje(lista, hoje, dias).filter((e) => e.data && !ocupadas.has(e.demanda.id) && !vistos.has(e.demanda.id));
  return { demandas: proximos.sort((a, b) => a.data!.localeCompare(b.data!) || ORDEM[a.classe] - ORDEM[b.classe]).map((e) => e.demanda), proximos: true };
}

// ---------- baralho do celular (decisões 64 e 65, portado da branch do Início em 14/11/2026 sem mudar as três vagas, a seleção, a prioridade nem a reposição) ----------
/** Avanço pelo gesto para a direita: Cadastro, Vistos, Fazendo, Finalizado. Nas etapas de espera não há avanço direto (abre o menu para escolher); em Finalizado não há o que avançar. */
export const ETAPA_SEGUINTE: Partial<Record<Etapa, Etapa>> = { Cadastro: 'Vistos', Vistos: 'Fazendo', Fazendo: 'Finalizado' };
export const etapaDeEspera = (e: Etapa) => e === 'Aguardando retorno' || e === 'Aguardando Prefeita';
/**
 * Ordem de apresentação da pilha neste aparelho: a ordem guardada (se for do dia) com só os cards que ainda estão nas vagas, e os que não estavam nela entram no fim, na ordem do painel.
 * Nunca perde nem repete um card, mesmo com a lista guardada velha, repetida ou com ids que saíram.
 */
export function ordemDaPilha(ids: readonly string[], guardada: readonly string[]): string[] {
  const nas = new Set(ids), vistos = new Set<string>(), saida: string[] = [];
  for (const id of guardada) if (nas.has(id) && !vistos.has(id)) { vistos.add(id); saida.push(id); }
  for (const id of ids) if (!vistos.has(id)) { vistos.add(id); saida.push(id); }
  return saida;
}
/** O card ativo vai para o fim da ordem de apresentação (a vaga, a etapa e a prioridade não mudam: só a ordem em que o aparelho mostra). */
export const ativoParaOFim = (ordem: readonly string[]): string[] => (ordem.length < 2 ? [...ordem] : [...ordem.slice(1), ordem[0]]);
/** O inverso: o último da ordem volta para a frente (o "anterior" das outras pilhas do Início). */
export const ultimoParaAFrente = (ordem: readonly string[]): string[] => (ordem.length < 2 ? [...ordem] : [ordem[ordem.length - 1], ...ordem.slice(0, -1)]);
/** O gesto de deslizar vale quando o deslocamento passa de max(72 px, 22% da largura) ou quando é rápido (velocidade em px/ms) e longo o bastante para não ser um toque acidental. */
export function gestoValido(dx: number, velocidade: number, largura: number): 'esq' | 'dir' | null {
  const limite = Math.max(72, largura * 0.22), lado = dx < 0 ? 'esq' : 'dir';
  if (Math.abs(dx) >= limite) return lado;
  if (Math.abs(dx) >= 36 && Math.abs(velocidade) >= 0.55 && Math.sign(velocidade) === Math.sign(dx)) return lado;
  return null;
}
