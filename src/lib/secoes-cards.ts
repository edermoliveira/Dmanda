// Demandas, visão Cards (decisão 80, etapa 3): nove seções temáticas montadas sobre a coleção ativa já filtrada. Só apresentação: nada aqui muda prazo, etapa, vaga nem dado no banco.
// Uma demanda pode aparecer em mais de uma seção (é o mesmo registro e o mesmo id; nunca duas vezes na mesma seção). Regras puras, sem relógio: a data de hoje vem de fora.
//
// "Vencimento efetivo" é a data aplicável da decisão 50 (`dataFiltro`: a mais próxima entre o vencimento ajustado, "Acompanhar em" e o retorno do setor), a mesma que alimenta os contadores do Início
// e o filtro "Só atrasadas". "Sem prazo" é a demanda sem vencimento calculado (campo prazo vazio): "Acompanhar em" e "Retorno do setor" seguem como marcos separados e não tiram a demanda dela.
import { dataFiltro, grupoFiltro, permanencia, temArea, type Area, type Demanda } from './demandas.ts';
import { demandaPrioritaria, ehOrigemPrioritaria } from './prioridade.ts';
import { ehOficio } from './para-hoje.ts';
import type { DiaIndisponivel } from './prazos.ts';

export type ChaveSecao = 'urgentes' | 'gabinete' | 'prazos' | 'oficios' | 'aguardando' | 'pessoal' | 'compras' | 'protocolo' | 'sem-prazo';
export type SecaoCards = {
  chave: ChaveSecao;
  rotulo: string;
  /** Uma frase que explica o critério da seção (vira a ajuda do título). */
  criterio: string;
  /** Tratamento visual da classificação (as cores que o card já usa: verde Pessoal, amarelo Compras, azul Geral). */
  cor: 'verde' | 'amar' | 'azul' | null;
  demandas: Demanda[];
  /** Só em "Aguardando há mais tempo": as demandas sem data de chegada (a permanência não é calculada pela criação do card). */
  semChegada: ReadonlySet<string>;
};

/** A classificação (Área) só existe nos documentos que a têm (Processo e Protocolo): é a mesma regra da cor do card. */
const areaDe = (d: Demanda): Area | null => (temArea(d.tipo) ? d.area : null);
const ativa = (d: Demanda) => d.etapa !== 'Finalizado' && !d.arquivada_em;

/** Desempate estável: chegada mais antiga, cadastro mais antigo e id. */
const estavel = (a: Demanda, b: Demanda) => (a.chegou_em ?? '9999-12-31').localeCompare(b.chegou_em ?? '9999-12-31') || a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id);

export function montarSecoes(lista: readonly Demanda[], hoje: string, dias: readonly DiaIndisponivel[] = []): SecaoCards[] {
  const ativas = lista.filter(ativa);
  const data = new Map(ativas.map((d) => [d.id, dataFiltro(d, hoje, dias)] as const));
  // vencimento do mais antigo (maior atraso) ao mais distante; sem data por último
  const porVencimento = (a: Demanda, b: Demanda) => (data.get(a.id) ?? '9999-12-31').localeCompare(data.get(b.id) ?? '9999-12-31') || estavel(a, b);
  const ordenar = (l: readonly Demanda[]) => [...l].sort(porVencimento);
  const secao = (chave: ChaveSecao, rotulo: string, criterio: string, demandas: Demanda[], cor: SecaoCards['cor'] = null, semChegada: ReadonlySet<string> = new Set()): SecaoCards => ({ chave, rotulo, criterio, cor, demandas, semChegada });

  const urgentes = ativas.filter((d) => demandaPrioritaria(d) || grupoFiltro(d, hoje, dias) === 'atrasadas');
  const urgOrdenadas = [...urgentes.filter(demandaPrioritaria).sort(porVencimento), ...urgentes.filter((d) => !demandaPrioritaria(d)).sort(porVencimento)];

  // maior permanência primeiro (chegada mais antiga); sem chegada vai para o fim e é sinalizada
  const comChegada = ativas.filter((d) => d.chegou_em).sort((a, b) => (permanencia(b, hoje) ?? 0) - (permanencia(a, hoje) ?? 0) || estavel(a, b));
  const semChegada = ativas.filter((d) => !d.chegou_em).sort(estavel);

  const daArea = (area: Area) => ordenar(ativas.filter((d) => areaDe(d) === area));
  return [
    secao('urgentes', 'Urgentes', 'Pedidos da Prefeita e do Gabinete primeiro, depois as atrasadas, da que está há mais tempo atrasada para a mais recente.', urgOrdenadas),
    secao('gabinete', 'Gabinete', 'Demandas cuja origem é a Prefeita ou o Gabinete.', ordenar(ativas.filter((d) => ehOrigemPrioritaria(d.origem)))),
    secao('prazos', 'Prazos da Secretaria', 'Todas as demandas, menos os ofícios: os atrasos mais antigos primeiro e depois os vencimentos, do mais próximo ao mais distante.', ordenar(ativas.filter((d) => !ehOficio(d)))),
    secao('oficios', 'Ofícios', 'Todos os ofícios ativos, pelo vencimento: os atrasos mais antigos primeiro e depois os mais próximos.', ordenar(ativas.filter(ehOficio))),
    secao('aguardando', 'Aguardando há mais tempo', 'Todas as demandas ativas, da que chegou há mais tempo para a mais recente, em qualquer etapa. Sem data de chegada, a permanência não é calculada.', [...comChegada, ...semChegada], null, new Set(semChegada.map((d) => d.id))),
    secao('pessoal', 'Pessoal', 'Demandas classificadas em Pessoal.', daArea('Pessoal'), 'verde'),
    secao('compras', 'Compras', 'Demandas classificadas em Compras, inclusive os processos de pagamento por indenização.', daArea('Compras'), 'amar'),
    secao('protocolo', 'Protocolo Geral', 'Demandas classificadas em Geral.', daArea('Geral'), 'azul'),
    secao('sem-prazo', 'Sem prazo', 'Demandas sem vencimento calculado. "Acompanhar em" e "Retorno do setor" são marcos à parte.', ativas.filter((d) => !d.prazo).sort(estavel)),
  ];
}
