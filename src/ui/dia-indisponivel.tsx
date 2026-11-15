'use client';
// Cadastro de dia indisponível (feriado ou evento externo de dia inteiro), com um só formulário de Data, Tipo e Descrição para Configurações e para a Agenda (14/11/2026).
// A gravação é a de sempre (salvarDia do contexto): o banco ajusta os vencimentos e recalcula as demandas abertas. Aqui não se conta prazo nenhum.
// Regras de sempre na janela da Agenda: o que é digitado vai para o rascunho do aparelho; clicar fora com texto novo não fecha; Esc e X guardam o rascunho; só Cancelar descarta;
// a falha de gravação mantém tudo nos campos; o clique repetido não envia duas vezes; ao fechar, o foco volta ao botão que abriu.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './contexto';
import { Icone } from './Icone';
import { Janela } from './janela-base';
import { dataPorExtenso } from '@/lib/agenda';
import { dataBR } from '@/lib/demandas';
import { CATEGORIAS_DIA, ROTULO_CATEGORIA, type CategoriaDia } from '@/lib/prazos';

export type CamposDia = { id?: string; data: string; descricao: string; categoria: CategoriaDia };
export const DIA_VAZIO: CamposDia = { data: '', descricao: '', categoria: 'Feriado' };
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

/** Os três campos. `prefixo` dá os ids (em Configurações: cfg-data, cfg-cat e cfg-desc). Enter na descrição envia. */
export function CamposDiaIndisponivel({ prefixo, valor, mudar, aoEnviar }: { prefixo: string; valor: CamposDia; mudar: (p: Partial<CamposDia>) => void; aoEnviar: () => void }) {
  return (
    <>
      <div className="fld"><label htmlFor={`${prefixo}-data`}>Data</label><CampoData id={`${prefixo}-data`} valor={valor.data} aoMudar={(data) => mudar({ data })} /></div>
      <div className="fld"><label htmlFor={`${prefixo}-cat`}>Tipo</label>
        <select id={`${prefixo}-cat`} value={valor.categoria} onChange={(e) => mudar({ categoria: e.target.value as CategoriaDia })}>{CATEGORIAS_DIA.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>)}</select></div>
      <div className="fld fld-inteira"><label htmlFor={`${prefixo}-desc`}>Descrição</label>
        <input id={`${prefixo}-desc`} value={valor.descricao} maxLength={160} placeholder="Ex.: Natal, Aniversário da cidade, Congresso da AMVARS" autoComplete="off" onChange={(e) => mudar({ descricao: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aoEnviar(); } }} /></div>
    </>
  );
}

/**
 * Validação com as mensagens de sempre e a gravação com trava (o segundo clique, ou o Enter repetido, não manda de novo enquanto a primeira não responde).
 * Devolve true só com a gravação confirmada pelo banco; na falha, o aviso do contexto explica e os campos continuam como estavam.
 */
export function useGravarDia(prefixo: string) {
  const { salvarDia } = useApp();
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);
  const gravar = async (f: CamposDia, rotulo?: string) => {
    if (trava.current) return false;
    if (!f.data) { setErro('Informe a data.'); document.getElementById(`${prefixo}-data`)?.focus(); return false; }
    if (!f.descricao.trim()) { setErro('Descreva o dia, por exemplo: Natal.'); document.getElementById(`${prefixo}-desc`)?.focus(); return false; }
    trava.current = true; setSalvando(true); setErro('');
    const ok = await salvarDia({ ...(f.id ? { id: f.id } : {}), data: f.data, descricao: f.descricao.trim(), categoria: f.categoria }, rotulo);
    trava.current = false; setSalvando(false);
    if (!ok) setErro('Não foi possível salvar agora. O que você digitou continua aqui: tente de novo.');
    return ok;
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
  const sujo = !!c.descricao.trim() || c.categoria !== original.categoria || c.data !== original.data;
  const outraData = !!c.data && c.data !== origem;
  const jaCadastrados = dias.filter((x) => x.data === c.data);

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
    const ok = await gravar(c, `Dia indisponível cadastrado em ${onde}${outraData ? ` (a Agenda estava em ${dataPorExtenso(origem)})` : ''}`);
    if (ok) { guardarRascunho(CHAVE, null); fecharJanela(); }
  };

  return (
    <Janela titulo="Cadastrar dia indisponível" aoFechar={fecharGuardando} sujo={sujo}
      rodape={<><span className="esp" /><button type="button" className="btn" disabled={salvando} onClick={cancelar}>Cancelar</button><button type="button" className="btn pri" data-salvar-dia disabled={salvando} onClick={() => void enviar()}>{salvando ? 'Salvando...' : 'Cadastrar dia'}</button></>}>
      {recuperado ? <p className="data rec">Rascunho recuperado. Cancelar descarta o que foi digitado.</p> : null}
      <p className="data">Feriado ou evento externo de dia inteiro. Quando o prazo de uma demanda cai num desses dias, o vencimento é antecipado para o dia disponível anterior, como em Configurações.</p>
      {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}
      <div className="di-form">
        <CamposDiaIndisponivel prefixo="di" valor={c} mudar={mudar} aoEnviar={() => void enviar()} />
      </div>
      {outraData ? <p className="data di-onde" role="status" data-outra-data>Vai ser salvo em <b>{maiuscula(dataPorExtenso(c.data))}</b>, não no dia aberto na Agenda ({dataPorExtenso(origem)}).</p> : null}
      {jaCadastrados.length ? <p className="data di-ja" data-ja-cadastrado>Já cadastrado nesta data: {jaCadastrados.map((x) => `${ROTULO_CATEGORIA[x.categoria]}, ${x.descricao}`).join('; ')}.</p> : null}
    </Janela>
  );
}
