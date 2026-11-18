'use client';
// Cadastro de dia indisponível (feriado ou evento externo de dia inteiro) ou de um PERÍODO (curso de vários dias, semana, recesso), com um só formulário de Data inicial, Data final (opcional), Tipo e Descrição
// para Configurações e para a Agenda. Sem data final, é um período de um dia só; com data final, os dois extremos são inclusivos. Um dia novo e um período novo usam o MESMO caminho (salvarPeriodo, com a identidade da operação); só a alteração de um dia avulso antigo (id) usa salvarDia, que é idempotente por natureza. O banco ajusta os vencimentos
// e recalcula as demandas abertas na mesma transação. Aqui não se conta prazo nenhum.
// Regras de sempre na janela da Agenda: o que é digitado vai para o rascunho do aparelho; clicar fora com texto novo não fecha; Esc e X guardam o rascunho; só Cancelar descarta;
// a falha de gravação mantém tudo nos campos; o clique repetido não envia duas vezes; ao fechar, o foco volta ao botão que abriu.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './contexto';
import { novoUuid } from './campos';
import { Icone } from './Icone';
import { Janela } from './janela-base';
import { dataPorExtenso } from '@/lib/agenda';
import { dataBR } from '@/lib/demandas';
import { CATEGORIAS_DIA, dataComSemana, diasNoPeriodo, erroDoPeriodo, ROTULO_CATEGORIA, type CategoriaDia } from '@/lib/prazos';

/** `id`: um dia avulso que está sendo alterado. `periodo_id`: um período que está sendo alterado (`data` é o primeiro dia e `data_fim` o último). `data_fim` vazio ou igual a `data`: um dia só. */
export type CamposDia = { id?: string; periodo_id?: string; data: string; data_fim: string; descricao: string; categoria: CategoriaDia };
export const DIA_VAZIO: CamposDia = { data: '', data_fim: '', descricao: '', categoria: 'Feriado' };
/** É um período quando tem data final diferente da inicial (um registro de um dia, novo ou já gravado, abre sem data final). */
export const ePeriodo = (c: Pick<CamposDia, 'data' | 'data_fim'>) => !!c.data_fim && c.data_fim !== c.data;
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Campo de data com a dica "Escolher a data" quando vazio (em toque, o Safari não desenha nada num campo de data vazio). O próprio campo nativo continua sendo o controle: rótulo associado pelo `id`, teclado e seletor ao toque. */
export function CampoData({ id, valor, aoMudar, aoEnter, invalido }: { id: string; valor: string; aoMudar: (data: string) => void; aoEnter?: () => void; invalido?: boolean }) {
  return (
    <div className="campo-data" data-vazio={valor ? undefined : 'sim'}>
      <input id={id} type="date" value={valor} aria-invalid={invalido || undefined} onChange={(e) => aoMudar(e.target.value)} onKeyDown={aoEnter ? (e) => { if (e.key === 'Enter') { e.preventDefault(); aoEnter(); } } : undefined} />
      <span className="campo-data-dica" data-preenchido={valor ? 'sim' : undefined} aria-hidden="true">{valor ? dataBR(valor) : <><Icone nome="calendar" />Escolher a data</>}</span>
    </div>
  );
}

/** Os campos. `prefixo` dá os ids (em Configurações: cfg-data, cfg-fim, cfg-cat e cfg-desc). Enter na descrição envia. Um dia avulso em alteração não tem data final (para virar período, cadastre o período). */
export function CamposDiaIndisponivel({ prefixo, valor, mudar, aoEnviar }: { prefixo: string; valor: CamposDia; mudar: (p: Partial<CamposDia>) => void; aoEnviar: () => void }) {
  const periodo = ePeriodo(valor), erroIntervalo = valor.data && valor.data_fim ? erroDoPeriodo(valor.data, valor.data_fim) : null;
  return (
    <>
      <div className="fld"><label htmlFor={`${prefixo}-data`}>{valor.id ? 'Data' : 'Data inicial'}</label><CampoData id={`${prefixo}-data`} valor={valor.data} aoMudar={(data) => mudar({ data })} /></div>
      {valor.id ? null : <div className="fld"><label htmlFor={`${prefixo}-fim`}>Data final <small className="data">(opcional)</small></label><CampoData id={`${prefixo}-fim`} valor={valor.data_fim} invalido={!!erroIntervalo} aoMudar={(data_fim) => mudar({ data_fim })} /></div>}
      <div className="fld"><label htmlFor={`${prefixo}-cat`}>Tipo</label>
        <select id={`${prefixo}-cat`} value={valor.categoria} onChange={(e) => mudar({ categoria: e.target.value as CategoriaDia })}>{CATEGORIAS_DIA.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>)}</select></div>
      <div className="fld fld-inteira"><label htmlFor={`${prefixo}-desc`}>Descrição</label>
        <input id={`${prefixo}-desc`} value={valor.descricao} maxLength={160} placeholder="Ex.: Natal, Congresso da AMVARS, Recesso de fim de ano" autoComplete="off" onChange={(e) => mudar({ descricao: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aoEnviar(); } }} /></div>
      {periodo && valor.data && valor.data_fim ? (
        <p className="data fld-inteira di-resumo" role="status" data-periodo-resumo data-invalido={erroIntervalo ? 'sim' : undefined}>
          {erroIntervalo ?? `Período de ${dataComSemana(valor.data)} a ${dataComSemana(valor.data_fim)}: ${diasNoPeriodo(valor.data, valor.data_fim)} dias, com os fins de semana. Todos entram como indisponíveis.`}
        </p>
      ) : null}
    </>
  );
}

/**
 * Validação com as mensagens de sempre e a gravação com trava (o segundo clique, ou o Enter repetido, não manda de novo enquanto a primeira não responde).
 * Devolve true só com a gravação confirmada pelo banco; na falha, o aviso do contexto explica e os campos continuam como estavam.
 */
export function useGravarDia(prefixo: string) {
  const { salvarDia, salvarPeriodo, conferirPendentes } = useApp();
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);
  // A identidade da TENTATIVA de gravar um período (operacao_id), separada do período (periodo_id, só ao alterar um que existe). Cada tentativa tem a sua; uma tentativa nunca herda a anterior.
  // Se o resultado ficar incerto (a resposta se perdeu), a identidade fica no contexto: antes de gravar de novo, o Dmanda pergunta ao servidor se aquela operação foi aplicada. Se foi, avisa e não grava; se não
  // foi, o servidor a CANCELA (um pedido atrasado com aquela identidade será recusado) e só então a nova tentativa, com identidade nova, grava. Nada é sobrescrito nem duplicado em silêncio.
  const operacao = useRef<string | null>(null);
  const gravar = async (f: CamposDia, rotulo?: string) => {
    if (trava.current) return false;
    const periodo = ePeriodo(f), foco = (campo: string) => document.getElementById(`${prefixo}-${campo}`)?.focus();
    if (!f.data) { setErro(periodo ? 'Informe a data inicial.' : 'Informe a data.'); foco('data'); return false; }
    if (f.data_fim) { const e = erroDoPeriodo(f.data, f.data_fim); if (e) { setErro(e); foco('fim'); return false; } }   // sem data final é um dia só (inclusive ao alterar um dia já gravado)
    if (!f.descricao.trim()) { setErro(periodo ? 'Descreva o período, por exemplo: Recesso de fim de ano.' : 'Descreva o dia, por exemplo: Natal.'); foco('desc'); return false; }
    trava.current = true; setSalvando(true); setErro('');
    const descricao = f.descricao.trim();
    let r: { ok: true } | { ok: false; erro: string; incerto?: boolean };
    if (!f.id) {
      const fim = f.data_fim || f.data, resumo = `${descricao} (${fim === f.data ? dataBR(f.data) : `${dataBR(f.data)} a ${dataBR(fim)}`})`;
      // antes de gravar: o que ficou incerto de uma tentativa anterior é conferido no servidor, pela identidade da operação
      const c = await conferirPendentes();
      if (!c.ok) { trava.current = false; setSalvando(false); setErro(`${c.erro} Antes de gravar, o Dmanda precisa conferir se o dia ou período anterior foi gravado: use "Conferir se foi gravado" no aviso do topo e tente de novo.`); return false; }
      if (c.gravados.length) {
        trava.current = false; setSalvando(false); operacao.current = null;
        setErro(`O registro anterior (${c.gravados.join('; ')}) tinha sido gravado, e a lista já mostra isso. O que você preencheu agora continua aqui e ainda NÃO foi gravado: se é outro, salve de novo; para corrigir o anterior, use o lápis na lista.`);
        return false;
      }
      // conferido: o que ficou incerto foi gravado (e já saímos acima) ou foi cancelado no servidor; esta tentativa tem identidade própria
      operacao.current ??= novoUuid();
      r = await salvarPeriodo({ operacao_id: operacao.current, ...(f.periodo_id ? { periodo_id: f.periodo_id } : {}), data_inicio: f.data, data_fim: fim, descricao, categoria: f.categoria }, { resumo }, rotulo ?? `${fim === f.data ? 'Dia' : 'Período'} ${f.periodo_id ? 'alterado' : 'cadastrado'}`);
      if (r.ok || r.incerto) operacao.current = null;   // gravado: acabou. Incerto: a identidade fica guardada no contexto, para a conferência
    } else r = await salvarDia({ id: f.id, data: f.data, descricao, categoria: f.categoria }, rotulo);
    trava.current = false; setSalvando(false);
    if (r.ok) return true;
    setErro(r.incerto
      ? 'Não foi possível confirmar se foi gravado: a resposta do servidor não chegou. O aviso no topo da tela tem o botão "Conferir se foi gravado"; ao salvar de novo, o Dmanda também confere antes de gravar. O que você digitou continua aqui.'
      : `${r.erro} O que você digitou continua aqui.`);
    return false;
  };
  return { erro, setErro, salvando, gravar };
}

const CHAVE = 'dia:nova';
type Rasc = { dia?: Partial<CamposDia>; origem?: string };

/** A janela da Agenda: abre com a data do dia em que a ação começou, preenchida e editável. Se a data mudar, a janela e o aviso final dizem onde o registro ficou. */
export function JanelaDiaIndisponivel({ data: dataOrigem }: { data?: string }) {
  const { rascunhos, guardarRascunho, fecharJanela, hoje, dias } = useApp();
  const rasc = rascunhos[CHAVE], salvo = (rasc?.dados as Rasc | undefined) ?? {};
  const origem = salvo.origem ?? dataOrigem ?? hoje;
  const original = useMemo<CamposDia>(() => ({ ...DIA_VAZIO, data: origem }), [origem]);
  const [c, setC] = useState<CamposDia>(() => ({ ...original, ...(salvo.dia ?? {}) }));
  const [recuperado] = useState(!!rasc);
  const { erro, setErro, salvando, gravar } = useGravarDia('di');
  const mudar = (p: Partial<CamposDia>) => { setC((x) => ({ ...x, ...p })); if (erro) setErro(''); };
  const sujo = !!c.descricao.trim() || c.categoria !== original.categoria || c.data !== original.data || !!c.data_fim;
  const outraData = !!c.data && c.data !== origem;
  const periodo = ePeriodo(c), ultimo = periodo && c.data_fim >= c.data ? c.data_fim : c.data;
  const jaCadastrados = dias.filter((x) => x.data >= c.data && x.data <= ultimo);

  // rascunho automático, meio segundo depois da última alteração
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => guardarRascunho(CHAVE, { dados: { dia: { ...c }, origem } }), 500);
    return () => clearTimeout(t);
  }, [sujo, c, origem, guardarRascunho]);
  const fecharGuardando = () => { guardarRascunho(CHAVE, sujo ? { dados: { dia: { ...c }, origem } } : null); fecharJanela(); };
  const cancelar = () => { guardarRascunho(CHAVE, null); fecharJanela(); };
  const enviar = async () => {
    if (salvando) return;
    const onde = dataPorExtenso(c.data || origem);
    const ok = await gravar(c, periodo ? `Período cadastrado de ${onde} a ${dataPorExtenso(c.data_fim)}` : `Dia indisponível cadastrado em ${onde}${outraData ? ` (a Agenda estava em ${dataPorExtenso(origem)})` : ''}`);
    if (ok) { guardarRascunho(CHAVE, null); fecharJanela(); }
  };

  return (
    <Janela titulo="Cadastrar dia ou período indisponível" aoFechar={fecharGuardando} sujo={sujo}
      rodape={<><span className="esp" /><button type="button" className="btn" disabled={salvando} onClick={cancelar}>Cancelar</button><button type="button" className="btn pri" data-salvar-dia disabled={salvando} onClick={() => void enviar()}>{salvando ? 'Salvando...' : periodo ? 'Cadastrar período' : 'Cadastrar dia'}</button></>}>
      {recuperado ? <p className="data rec">Rascunho recuperado. Cancelar descarta o que foi digitado.</p> : null}
      <p className="data">Feriado ou evento externo de dia inteiro, de um dia ou de um período (curso, semana, recesso). Quando o prazo de uma demanda cai num desses dias, o vencimento é antecipado para o dia disponível anterior, como em Configurações.</p>
      {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}
      <div className="di-form">
        <CamposDiaIndisponivel prefixo="di" valor={c} mudar={mudar} aoEnviar={() => void enviar()} />
      </div>
      {outraData ? <p className="data di-onde" role="status" data-outra-data>Vai ser salvo em <b>{maiuscula(dataPorExtenso(c.data))}</b>, não no dia aberto na Agenda ({dataPorExtenso(origem)}).</p> : null}
      {jaCadastrados.length ? <p className="data di-ja" data-ja-cadastrado>{periodo ? `Já há ${jaCadastrados.length === 1 ? '1 dia cadastrado' : `${jaCadastrados.length} dias cadastrados`} dentro deste intervalo. O período é gravado por inteiro e os registros convivem: o cálculo une os dias, e excluir um deles não tira o que o outro ainda sustenta.` : `Já cadastrado nesta data: ${jaCadastrados.map((x) => `${ROTULO_CATEGORIA[x.categoria]}, ${x.descricao}`).join('; ')}.`}</p> : null}
    </Janela>
  );
}
