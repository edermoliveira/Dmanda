// Avisos do sistema: UMA origem para a barra global, o aviso da tela e o sininho (puro, sem relógio nem React).
// Um aviso aqui é um PROBLEMA DE ESTADO que a pessoa consegue enfrentar dentro do Dmanda: uma leitura que falhou (sem conexão, ou o servidor não devolveu), vencimentos que a tela não conseguiu reler
// depois de uma mudança no calendário, ou uma gravação de período cujo resultado ficou incerto. Em todos há uma ação direta ("carregar de novo", "conferir se foi gravado").
// Barra, aviso da tela e sininho mostram o MESMO problema (mesmo id) e somem juntos quando a causa some. Marcar como lido só tira a contagem do sininho: a causa continua, e a barra também.
// Exceção de escopo (decisão 84): o aviso de vencimento antecipado antes da chegada é um alerta sobre um DADO, derivado das demandas gravadas, e vale só no sininho (escopo "sino"), com a ação "Abrir a demanda".
// O que NÃO entra aqui: erro de código ou de regra de negócio. Esses viram mensagem da própria operação (o aviso rápido) ou um estado honesto no dado afetado, e o detalhe técnico fica no registro do servidor.

import { AVISO_ANTES_DA_CHEGADA } from './prazos.ts';

export type FonteId = 'demandas' | 'dias' | 'eventos' | 'entradas';
/** Mensagens de rede. A de "sem conexão" vale para leitura e gravação (nada chegou ao servidor); a de "resultado incerto" é de gravação: o pedido saiu e a resposta não voltou. */
export const MSG_SEM_REDE = 'Sem conexão com o servidor. Nada foi gravado. Confira a internet e tente de novo; o que você digitou continua na tela.';
export const MSG_INCERTA = 'Sem confirmação do servidor: não dá para saber se foi gravado. Confira a lista antes de repetir; o que você digitou continua na tela.';

/** `global`: grave, afeta várias telas ou operações e se resolve dentro do Dmanda (barra no topo de todas as telas). `tela`: localizado, aparece na tela correspondente. Os dois aparecem no sininho.
 * `sino`: só no sininho (um alerta sobre um dado, como a demanda cujo vencimento antecipado ficou antes da chegada): não ocupa a barra global nem a faixa de nenhuma tela. */
export type EscopoAviso = 'global' | 'tela' | 'sino';
/** A ação direta de um aviso: recarregar uma leitura (ou todas), conferir no servidor se um período foi gravado (identificado pela operação) ou abrir uma demanda (`abrir` é o id dela). */
export type AcaoAviso = { rotulo: string; recarregar?: FonteId | 'todas'; conferir?: string; abrir?: string };
export type AvisoSistema = {
  id: string;
  escopo: EscopoAviso;
  tela?: 'agenda' | 'entradas';
  /** O que está errado. */
  titulo: string;
  /** O que fazer e onde. */
  orientacao: string;
  acao: AcaoAviso;
};
export type AvisoComLeitura = AvisoSistema & { lido: boolean };
/** A mensagem de erro da última leitura de cada fonte (nulo quando leu). */
export type FalhasLeitura = Partial<Record<FonteId, string | null>>;
/** Um período cuja gravação ficou com resultado incerto: a operação enviada e como a pessoa a conhece (descrição e datas). */
export type PeriodoIncerto = { operacao_id: string; resumo: string };
/** Uma demanda GRAVADA e aberta cujo vencimento antecipado ficou antes da chegada (a condição é decidida por `venceAntesDaChegada`, sobre os dados que o servidor devolveu). */
export type DemandaAntesDaChegada = { id: string; assunto: string };
export type OutrosProblemas = { incertos?: readonly PeriodoIncerto[]; vencimentosDesatualizados?: boolean; antesDaChegada?: readonly DemandaAntesDaChegada[] };

const NOME: Record<FonteId, string> = { demandas: 'as demandas', dias: 'os dias indisponíveis', eventos: 'os eventos da Agenda', entradas: 'as entradas' };
const TECNICO = 'Se continuar, o problema é técnico e não depende de você: o detalhe fica no registro do servidor e o que já foi gravado não muda.';

const semRede = (erro: string | null | undefined) => erro === MSG_SEM_REDE;

function aviso(fonte: FonteId, erro: string): AvisoSistema {
  const rede = semRede(erro);
  const como = rede ? 'Confira a conexão com a internet e carregue de novo.' : `Carregue de novo. ${TECNICO}`;
  switch (fonte) {
    case 'demandas':
      return { id: 'demandas', escopo: 'global', titulo: 'As demandas não carregaram.', orientacao: `${rede ? 'Sem conexão com o servidor. ' : ''}A lista, os prazos e os contadores ficam indisponíveis até carregarem. ${como}`, acao: { rotulo: 'Carregar as demandas de novo', recarregar: 'demandas' } };
    case 'dias':
      // Os vencimentos e os retornos do setor vêm do servidor, com o calendário completo: esta falha não os afeta. Afeta o que ainda usa a lista de dias nesta tela.
      return { id: 'dias', escopo: 'global', titulo: 'Os dias indisponíveis não carregaram.', orientacao: `Os vencimentos e os retornos do setor continuam os que o servidor calculou. Sem a lista, a Agenda pode estar sem os feriados e eventos externos marcados, a prévia do vencimento no cadastro aparece como "a confirmar" e a lista em Configurações pode estar incompleta. ${como}`, acao: { rotulo: 'Carregar os dias de novo', recarregar: 'dias' } };
    case 'eventos':
      return { id: 'eventos', escopo: 'tela', tela: 'agenda', titulo: 'Os eventos da Agenda não carregaram.', orientacao: `Os compromissos e os avisos de hoje ficam de fora da Agenda até carregarem. ${como}`, acao: { rotulo: 'Carregar os eventos de novo', recarregar: 'eventos' } };
    case 'entradas':
      return { id: 'entradas', escopo: 'tela', tela: 'entradas', titulo: 'As entradas não carregaram.', orientacao: `As anotações não aparecem em Entradas até carregarem; as que você já guardou continuam salvas. ${como}`, acao: { rotulo: 'Carregar as entradas de novo', recarregar: 'entradas' } };
  }
}

/**
 * Os problemas de agora, na ordem em que a pessoa deve olhar (os globais primeiro). Quando duas ou mais fontes falham por falta de conexão, é UM problema só (a conexão), e não um aviso por fonte:
 * assim a barra e o sininho não se repetem, e uma ação recarrega tudo.
 */
export function avisosDoSistema(falhas: FalhasLeitura, outros: OutrosProblemas = {}): AvisoSistema[] {
  const falhou = (Object.keys(NOME) as FonteId[]).filter((f) => !!falhas[f]);
  const sem = falhou.filter((f) => semRede(falhas[f]));
  const lista: AvisoSistema[] = [];
  for (const p of outros.incertos ?? []) {
    lista.push({ id: `periodo-${p.operacao_id}`, escopo: 'global', titulo: `Não foi possível confirmar se o dia ou período "${p.resumo}" foi gravado.`, orientacao: 'A resposta do servidor não chegou, então os vencimentos podem ou não ter sido recalculados. Use "Conferir se foi gravado": o Dmanda consulta o servidor e mostra o que ficou; se não foi gravado, aquela tentativa é cancelada e não será gravada depois. Até lá, não cadastre o mesmo período de novo.', acao: { rotulo: 'Conferir se foi gravado', conferir: p.operacao_id } });
  }
  if (outros.vencimentosDesatualizados) {
    lista.push({ id: 'vencimentos', escopo: 'global', titulo: 'Os vencimentos na tela podem estar desatualizados.', orientacao: 'Um dia ou período indisponível mudou no servidor, mas a tela não conseguiu ler os vencimentos recalculados. Carregue as demandas de novo para ver as datas atuais.', acao: { rotulo: 'Carregar as demandas de novo', recarregar: 'demandas' } });
  }
  for (const d of outros.antesDaChegada ?? []) {
    lista.push({ id: `chegada-${d.id}`, escopo: 'sino', titulo: `Vencimento antes da chegada: ${d.assunto}`, orientacao: AVISO_ANTES_DA_CHEGADA, acao: { rotulo: 'Abrir a demanda', abrir: d.id } });
  }
  if (sem.length > 1) lista.push({ id: 'conexao', escopo: 'global', titulo: 'Sem conexão com o servidor.', orientacao: `Não carregaram: ${sem.map((f) => NOME[f]).join(', ')}. Confira a conexão com a internet e carregue tudo de novo. O que você já gravou não muda.`, acao: { rotulo: 'Carregar tudo de novo', recarregar: 'todas' } });
  for (const f of falhou) if (!(sem.length > 1 && sem.includes(f))) lista.push(aviso(f, falhas[f]!));
  const peso = (a: AvisoSistema) => (a.escopo === 'global' ? 2 : a.escopo === 'tela' ? 1 : 0);
  return lista.sort((a, b) => peso(b) - peso(a));
}

/** Junta os problemas de agora com o que a pessoa já marcou como lido. Um id que saiu da lista (a causa foi resolvida) não fica guardado: se o problema voltar, volta como novo. */
export function comLeitura(avisos: readonly AvisoSistema[], lidos: readonly string[]): AvisoComLeitura[] {
  return avisos.map((a) => ({ ...a, lido: lidos.includes(a.id) }));
}
