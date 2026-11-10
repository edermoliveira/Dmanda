// Para hoje: o painel de execução do Início, com até 3 vagas. Aqui ficam só as regras de quem pode ocupar uma vaga e em que ordem (o banco guarda as vagas e impede duplicação).
// Humor e produtividade não entram no cálculo. Sem relógio: a data de hoje vem de fora.
import { contagemRetorno, dataFiltro, diasAte, esperaPrefeita, permanencia, type Demanda } from './demandas.ts';
import type { DiaIndisponivel } from './prazos.ts';
import { demandaPrioritaria } from './prioridade.ts';

export const VAGAS_PARA_HOJE = 3;
export type ClasseUrgencia = 'atrasada' | 'hoje' | 'proxima' | 'sem-prazo';
/** `prioritaria`: pedido da Prefeita ou do Gabinete (campo Origem, decisão 61): vai antes de todas as outras candidatas, inclusive das vencidas. */
export type Elegivel = { demanda: Demanda; classe: ClasseUrgencia; data: string | null; cobranca: boolean; prioritaria: boolean };
const ORDEM: Record<ClasseUrgencia, number> = { atrasada: 0, hoje: 1, proxima: 2, 'sem-prazo': 3 };
/** Urgência de verdade: atrasada ou vencendo hoje. Uma urgência que aparece depois de as vagas serem escolhidas é destacada à parte. */
export const ehUrgente = (c: ClasseUrgencia) => c === 'atrasada' || c === 'hoje';

/**
 * Quem pode ocupar uma vaga: demanda aberta em que há uma ação do usuário.
 *  - Cadastro, Vistos e Fazendo dependem do usuário: entram com a data aplicável (prazo, "Acompanhar em" ou retorno), ou sem prazo (há ação possível). Só ficam de fora as com data
 *    além dos próximos 7 dias.
 *  - Aguardando retorno e Aguardando Prefeita dependem de terceiros: só entram quando a cobrança está devida (retorno de 10 dias ou "Acompanhar em" vencidos; espera da Prefeita acima do limite
 *    de 10 dias), e então contam como urgência pela data da cobrança.
 * Prioridade da Prefeita e do Gabinete (campo Origem): em Cadastro, Vistos e Fazendo a demanda prioritária entra MESMO sem prazo ou com data além dos próximos 7 dias, e vai antes de todas as
 * outras candidatas, inclusive das vencidas. Nas etapas de espera os critérios acima não mudam: ela só entra quando a cobrança está devida.
 * Ordem: prioritárias, depois atrasadas, depois vencem hoje, depois até 7 dias, depois sem prazo. Dentro de cada grupo, a marca Rápida primeiro, depois a data mais antiga, a maior permanência e o cadastro mais antigo.
 */
export function elegiveisParaHoje(lista: readonly Demanda[], hoje: string, dias: readonly DiaIndisponivel[] = []): Elegivel[] {
  const saida: Elegivel[] = [];
  for (const d of lista) {
    if (d.etapa === 'Finalizado' || d.arquivada_em) continue;
    let data: string | null, cobranca = false;
    if (d.etapa === 'Aguardando retorno' || d.etapa === 'Aguardando Prefeita') {
      const datas = [d.acompanhar_em, d.etapa === 'Aguardando retorno' ? contagemRetorno(d, dias)?.data ?? null : null].filter((x): x is string => !!x && diasAte(x, hoje) <= 0);
      if (datas.length) data = datas.reduce((m, x) => (x < m ? x : m));
      else if (d.etapa === 'Aguardando Prefeita' && esperaPrefeita(d, hoje)?.alerta) data = hoje;
      else continue;
      cobranca = true;
    } else data = dataFiltro(d, hoje, dias);
    const n = data ? diasAte(data, hoje) : null;
    const prioritaria = demandaPrioritaria(d);
    if (n !== null && n > 7 && !prioritaria) continue;   // a prioritária entra mesmo com a data além de 7 dias (nas etapas de espera a data da cobrança nunca passa de hoje)
    const classe: ClasseUrgencia = n === null ? 'sem-prazo' : n < 0 ? 'atrasada' : n === 0 ? 'hoje' : 'proxima';
    saida.push({ demanda: d, classe, data, cobranca, prioritaria });
  }
  return saida.sort((a, b) =>
    Number(b.prioritaria) - Number(a.prioritaria)
    || ORDEM[a.classe] - ORDEM[b.classe]
    || Number(b.demanda.rapida) - Number(a.demanda.rapida)
    || (a.data ?? '9999-12-31').localeCompare(b.data ?? '9999-12-31')
    || (permanencia(b.demanda, hoje) ?? -1) - (permanencia(a.demanda, hoje) ?? -1)
    || a.demanda.criado_em.localeCompare(b.demanda.criado_em)
    || a.demanda.id.localeCompare(b.demanda.id));
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
/** Urgências (atrasadas e vencendo hoje) que ainda não ocupam vaga: destacadas à parte, sem trocar a seleção. */
export const novasUrgencias = (vagas: readonly Vaga[], lista: readonly Demanda[], elegiveis: readonly Elegivel[]) => {
  const ocupadas = new Set(vagasAbertas(vagas, lista).map((v) => v.demanda.id));
  return elegiveis.filter((e) => ehUrgente(e.classe) && !ocupadas.has(e.demanda.id));
};

/**
 * O que o painel Para hoje mostra, em ordem de exibição (as vagas guardadas no banco NÃO mudam: só a ordem na tela):
 *  1. as prioritárias que ocupam vagas (na ordem das posições) e, em seguida, as prioritárias que não ocupam vaga ("fora das vagas": as 3 vagas estão cheias, e nenhuma vaga ocupada é substituída);
 *  2. as demais demandas das vagas, na ordem das posições;
 *  3. a "nova urgência" comum (atrasadas e que vencem hoje sem vaga), sem as prioritárias, que já estão no primeiro grupo.
 * Cada demanda aparece uma só vez.
 */
export function organizarPainel(vagas: readonly Vaga[], lista: readonly Demanda[], elegiveis: readonly Elegivel[]) {
  const abertas = vagasAbertas(vagas, lista), ocupadas = new Set(abertas.map((v) => v.demanda.id));
  const prioritariasNasVagas = abertas.filter((v) => demandaPrioritaria(v.demanda));
  const comunsNasVagas = abertas.filter((v) => !demandaPrioritaria(v.demanda));
  const prioritariasFora = elegiveis.filter((e) => e.prioritaria && !ocupadas.has(e.demanda.id));
  const urgenciasComuns = novasUrgencias(vagas, lista, elegiveis).filter((e) => !e.prioritaria);
  return { prioritariasNasVagas, prioritariasFora, comunsNasVagas, urgenciasComuns };
}
