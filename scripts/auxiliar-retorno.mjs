// Referência de TESTE para o retorno do setor (não é código da aplicação). O navegador não calcula o retorno: lê o valor do servidor (`demanda.retorno`, de `retorno_setor_info`).
// Esta função reimplementa a regra só para duas finalidades: (1) conferir, nas suítes do banco, que o SQL e a regra escrita à parte dão a mesma data para muitos calendários;
// (2) montar demandas fictícias no contrato atual (com o campo `retorno`) para as suítes de regras de tela. Regra: 10 dias corridos do encaminhamento ou da reiteração mais recente ou,
// sem elas, do dia (de Brasília) em que entrou em Aguardando retorno; antecipado como os prazos (fim de semana, feriado, evento externo). Fora da etapa ou arquivada: nulo.
import { ajustarPrazo, somarDias } from '../src/lib/prazos.ts';
import { DIAS_RETORNO_SETOR, hojeISO } from '../src/lib/demandas.ts';

/** `d`: { etapa, etapa_desde, encaminhada_em, reiterada_em, arquivada_em }. Devolve { data, original, base, origem, ajuste } ou null (o formato de `demanda.retorno`). */
export function retornoReferencia(d, dias) {
  if (d.etapa !== 'Aguardando retorno' || d.arquivada_em) return null;
  const candidatas = [];
  if (d.encaminhada_em) candidatas.push([d.encaminhada_em, 'encaminhamento']);
  if (d.reiterada_em) candidatas.push([d.reiterada_em, 'reiteração']);
  const [base, origem] = candidatas.length ? candidatas.sort((a, b) => b[0].localeCompare(a[0]))[0] : [hojeISO(new Date(d.etapa_desde)), 'entrada na etapa'];
  const original = somarDias(base, DIAS_RETORNO_SETOR), aj = ajustarPrazo(original, dias);
  return { data: aj.prazo, original, base, origem, ajuste: aj.ajuste };
}
/** A demanda fictícia no contrato do servidor: com `retorno` calculado pela referência (nulo fora da etapa). */
export const comRetorno = (d, dias = []) => ({ ...d, retorno: retornoReferencia(d, dias) });
