'use client';
// Janela do evento ou lembrete da Agenda (decisão 47). Evento novo abre em edição; evento que já existe abre em leitura (consulta) e o lápis leva à edição.
// Regras de sempre: o que é digitado vai para o rascunho do aparelho; clicar fora com texto novo não fecha; Esc e X guardam o rascunho; só Cancelar descarta;
// falha ou conflito de versão nunca apagam o que foi digitado; criar repete com o mesmo identificador (clique repetido ou resposta perdida nunca duplica); excluir pede confirmação.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { Janela, Opcoes } from './janela-base';
import { novoUuid } from './campos';
import { dataPorExtenso } from '@/lib/agenda';
import { AVISO_PADRAO, AVISOS_MIN, erroDoEvento, horarioDe, rotuloAviso, sobrepostosA, TIPOS_EVENTO, type DadosEvento, type Evento, type TipoEvento } from '@/lib/eventos';

type Campos = { titulo: string; tipo: TipoEvento; data: string; dia_inteiro: boolean; inicio: string; fim: string; aviso: string; descricao: string };
const PADRAO: Omit<Campos, 'data'> = { titulo: '', tipo: 'Compromisso', dia_inteiro: false, inicio: '09:00', fim: '', aviso: String(AVISO_PADRAO), descricao: '' };
const doEvento = (e: Evento): Campos => ({ titulo: e.titulo, tipo: e.tipo, data: e.data, dia_inteiro: e.dia_inteiro, inicio: e.inicio ?? '', fim: e.fim ?? '', aviso: e.aviso_min === null ? '' : String(e.aviso_min), descricao: e.descricao });
const paraEnvio = (c: Campos): DadosEvento => ({
  titulo: c.titulo.trim(), tipo: c.tipo, data: c.data, dia_inteiro: c.dia_inteiro, inicio: c.dia_inteiro ? null : c.inicio || null, fim: c.dia_inteiro ? null : c.fim || null,
  aviso_min: c.aviso === '' ? null : c.dia_inteiro ? 0 : Number(c.aviso), descricao: c.descricao.trim(),
});
const iguais = (a: Campos, b: Campos) => JSON.stringify(paraEnvio(a)) === JSON.stringify(paraEnvio(b));

export function JanelaEventoRoteada({ id, data }: { id?: string; data?: string }) {
  const { eventos, carregandoEventos, rascunhos, fecharJanela, avisar } = useApp();
  const evento = id ? eventos.find((x) => x.id === id) ?? null : null;
  // um evento excluído em outro aparelho some da lista: a janela avisa e fecha, a não ser que haja rascunho a conservar
  const sumiu = !!id && !carregandoEventos && !evento && !rascunhos[`ev:${id}`];
  useEffect(() => { if (sumiu) { avisar('Este evento não existe mais. Ele pode ter sido excluído em outro aparelho.', true); fecharJanela(); } }, [sumiu, avisar, fecharJanela]);
  if (carregandoEventos || sumiu) return null;
  return <JanelaEvento evento={evento} idOriginal={id} dataInicial={data} />;
}

function JanelaEvento({ evento, idOriginal, dataInicial }: { evento: Evento | null; idOriginal?: string; dataInicial?: string }) {
  const { eventos, hoje, rascunhos, guardarRascunho, fecharJanela, criarEvento, salvarEvento, excluirEvento, buscarEvento, avisar } = useApp();
  // o rascunho de um evento que existia (e sumiu em outro aparelho) continua no próprio nome: salvar cria o evento de novo com o texto digitado, sem se misturar ao rascunho de um evento novo
  const chave = evento ? `ev:${evento.id}` : idOriginal ? `ev:${idOriginal}` : 'ev:nova';
  const rasc = rascunhos[chave];
  const [idNovo] = useState(() => rasc?.idNovo ?? novoUuid());
  const original = useMemo<Campos>(() => (evento ? doEvento(evento) : { ...PADRAO, data: dataInicial ?? hoje }), [evento, dataInicial, hoje]);
  const [c, setC] = useState<Campos>(() => ({ ...original, ...(((rasc?.dados as { ev?: Partial<Campos> } | undefined)?.ev) ?? {}) }));
  const [editando, setEditando] = useState<boolean>(!evento || !!rasc);
  const [versaoBase, setVersaoBase] = useState(rasc?.versao ?? evento?.versao ?? 1);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [recuperado] = useState(!!rasc);
  const emCurso = useRef(false);
  const mudar = (p: Partial<Campos>) => { setC((x) => ({ ...x, ...p })); if (erro) setErro(''); };

  // o que o banco tem agora, para saber se outro aparelho mexeu depois que esta edição começou
  const desatualizado = !!evento && editando && (conflito || versaoBase !== evento.versao);
  const sujo = editando && (evento ? !iguais(c, original) : !!c.titulo.trim() || !iguais({ ...c, titulo: '' }, { ...original, titulo: '' }));
  const conflitos = useMemo(() => (c.dia_inteiro || !c.inicio || !c.data ? [] : sobrepostosA({ id: evento?.id ?? idNovo, data: c.data, dia_inteiro: false, inicio: c.inicio, fim: c.fim || null }, eventos)), [c.dia_inteiro, c.inicio, c.fim, c.data, eventos, evento?.id, idNovo]);

  // rascunho automático, meio segundo depois da última alteração
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => guardarRascunho(chave, { dados: { ev: { ...c } }, idNovo: evento ? undefined : idNovo, versao: versaoBase }), 500);
    return () => clearTimeout(t);
  }, [sujo, c, chave, evento, idNovo, versaoBase, guardarRascunho]);
  const fecharGuardando = () => { if (sujo) guardarRascunho(chave, { dados: { ev: { ...c } }, idNovo: evento ? undefined : idNovo, versao: versaoBase }); else guardarRascunho(chave, null); fecharJanela(); };
  const cancelar = () => { guardarRascunho(chave, null); if (evento) { setC(original); setEditando(false); setErro(''); setConflito(false); } else fecharJanela(); };

  const gravar = async () => {
    if (emCurso.current) return;
    const m = erroDoEvento(paraEnvio(c));
    if (m) { setErro(m); document.getElementById(m.includes('título') ? 'ev-titulo' : m.includes('início') || m.includes('término') ? 'ev-inicio' : 'ev-data')?.focus(); return; }
    emCurso.current = true; setSalvando(true); setErro('');
    const r = evento ? await salvarEvento(evento.id, paraEnvio(c), versaoBase) : await criarEvento({ id: idNovo, ...paraEnvio(c) });
    emCurso.current = false; setSalvando(false);
    if (r.ok) {
      guardarRascunho(chave, null);
      avisar(evento ? 'Evento alterado' : 'Evento criado');
      if (evento) { setVersaoBase(r.evento.versao); setC(doEvento(r.evento)); setEditando(false); setConflito(false); } else fecharJanela();
    } else if (r.conflito) {
      setConflito(true);
      const atual = await buscarEvento(evento!.id); // traz a versão atual para a lista; o que foi digitado continua nos campos
      if (atual) setErro('Outro aparelho alterou este evento. Nada foi gravado e o que você digitou continua aqui.');
    } else setErro(r.erro);
  };
  const apagar = async () => { if (!evento || salvando) return; setSalvando(true); const ok = await excluirEvento(evento.id); setSalvando(false); if (ok) fecharJanela(); else setExcluindo(false); };

  const rodape = excluindo && evento ? (
    <>
      <span className="data">Excluir de vez? Não dá para desfazer.</span>
      <button className="btn perigo" disabled={salvando} onClick={() => void apagar()}><Icone nome="trash" />Confirmar exclusão</button>
      <span className="esp" /><button className="btn" onClick={() => setExcluindo(false)}>Cancelar</button>
    </>
  ) : editando ? (
    <>
      {evento ? <button className="btn mini m-sec" disabled={salvando} onClick={() => setExcluindo(true)}><Icone nome="trash" />Excluir</button> : null}
      <span className="esp" />
      <button className="btn" disabled={salvando} onClick={cancelar}>Cancelar</button>
      <button className="btn pri" disabled={salvando || desatualizado || (!!evento && !sujo)} data-salvar-evento onClick={() => void gravar()}>{salvando ? 'Salvando...' : evento ? 'Salvar' : 'Criar evento'}</button>
    </>
  ) : (
    <>
      <button className="btn mini m-sec" onClick={() => setExcluindo(true)}><Icone nome="trash" />Excluir</button>
      <span className="esp" /><button className="btn" onClick={fecharGuardando}>Fechar</button>
    </>
  );

  return (
    <Janela titulo={evento ? evento.titulo : 'Novo evento'} aoFechar={fecharGuardando} sujo={sujo} rodape={rodape} foco={editando ? 'campo' : 'janela'}
      extraCab={evento && !editando && !excluindo ? <button type="button" className="icbtn-s" aria-label="Editar o evento" title="Editar" data-lapis="evento" onClick={() => { setVersaoBase(evento.versao); setEditando(true); }}><Icone nome="pencil" /></button> : null}>
      {recuperado && editando ? <p className="data rec">Rascunho recuperado. Cancelar descarta o que foi digitado.</p> : null}
      {desatualizado ? <p className="data rec" role="alert" id="ev-conflito">Este evento foi alterado em outro aparelho ou janela depois que você abriu a edição. Nada foi gravado e o que você digitou continua aqui. Salvar fica bloqueado para não apagar o que foi gravado lá. Toque em Cancelar para ver o evento na versão atual.</p> : null}
      {editando ? (
        <>
          {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}
          <div className="fld"><label htmlFor="ev-titulo">Título</label><input id="ev-titulo" value={c.titulo} autoComplete="off" maxLength={200} placeholder="Ex.: Reunião com o Gabinete" onChange={(e) => mudar({ titulo: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void gravar(); } }} /></div>
          <div className="fld"><label>Tipo</label><Opcoes lista={TIPOS_EVENTO} valor={c.tipo} rotulo="Tipo do evento" aoEscolher={(v) => mudar({ tipo: v })} /></div>
          <div className="fld"><label htmlFor="ev-data">Data</label><input id="ev-data" type="date" value={c.data} onChange={(e) => mudar({ data: e.target.value })} /></div>
          <label className="agd-chk"><input type="checkbox" checked={c.dia_inteiro} onChange={(e) => mudar({ dia_inteiro: e.target.checked, aviso: e.target.checked ? '' : String(AVISO_PADRAO) })} />Dia inteiro (sem horário)</label>
          {c.dia_inteiro ? (
            <label className="agd-chk"><input type="checkbox" checked={c.aviso !== ''} onChange={(e) => mudar({ aviso: e.target.checked ? '0' : '' })} />Avisar no dia, dentro do aplicativo</label>
          ) : (
            <>
              <div className="dois">
                <div className="fld"><label htmlFor="ev-inicio">Início</label><input id="ev-inicio" type="time" value={c.inicio} onChange={(e) => mudar({ inicio: e.target.value })} /></div>
                <div className="fld"><label htmlFor="ev-fim">Término <small className="data">(opcional)</small></label><input id="ev-fim" type="time" value={c.fim} onChange={(e) => mudar({ fim: e.target.value })} /></div>
              </div>
              <div className="fld"><label htmlFor="ev-aviso">Aviso dentro do aplicativo</label>
                <select id="ev-aviso" value={c.aviso} onChange={(e) => mudar({ aviso: e.target.value })}><option value="">Sem aviso</option>{AVISOS_MIN.map((m) => <option key={m} value={m}>{rotuloAviso(m)}</option>)}</select></div>
            </>
          )}
          {conflitos.length ? <p className="agd-alerta" role="status" data-sobreposicao><Icone nome="alert" />Este horário se sobrepõe a: {conflitos.map((x) => `${x.titulo} (${horarioDe(x)})`).join(', ')}. Você ainda pode salvar.</p> : null}
          <div className="fld"><label htmlFor="ev-desc">Descrição <small className="data">(opcional)</small></label><textarea id="ev-desc" rows={3} value={c.descricao} onChange={(e) => mudar({ descricao: e.target.value })} /></div>
        </>
      ) : evento ? (
        <dl className="ler">
          <dt>Quando</dt><dd><b>{dataPorExtenso(evento.data)}</b>, {horarioDe(evento).toLowerCase()}</dd>
          <dt>Tipo</dt><dd>{evento.tipo}</dd>
          <dt>Aviso</dt><dd>{evento.aviso_min === null ? 'Sem aviso' : evento.dia_inteiro ? 'No dia, dentro do aplicativo' : rotuloAviso(evento.aviso_min)}</dd>
          <dt>Descrição</dt><dd className={evento.descricao ? undefined : 'vazio'}>{evento.descricao || 'Sem descrição'}</dd>
          {sobrepostosA(evento, eventos).length ? <><dt>Atenção</dt><dd>Sobrepõe com {sobrepostosA(evento, eventos).map((x) => `${x.titulo} (${horarioDe(x)})`).join(', ')}</dd></> : null}
        </dl>
      ) : null}
    </Janela>
  );
}
