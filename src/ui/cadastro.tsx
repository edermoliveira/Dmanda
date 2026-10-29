'use client';
// Cadastro guiado de demanda (decisão 27): três passos, no mesmo desenho Catalyst das demais janelas.
//   1. Identificação: tipo, número, origem, assunto e breve descrição. Só o assunto é obrigatório. Nada é gravado ainda.
//   2. Chegada e prazo: tudo opcional. Ao continuar (ou pular), a demanda é CRIADA no Supabase, na etapa Cadastro, e o botão e o aviso dizem isso.
//   3. Tarefas: ao concluir com pelo menos uma tarefa válida, as tarefas são salvas e a demanda vai para Vistos; pular ou fechar mantém a demanda em Cadastro.
// A demanda é criada uma só vez: o aplicativo gera o identificador antes e repete com ele (a segunda chamada devolve a mesma demanda). Voltar a um passo anterior
// edita o mesmo registro. O que foi digitado e ainda não foi salvo nunca é descartado em silêncio: vira rascunho ou pede uma escolha clara.
import { useEffect, useRef, useState } from 'react';
import { useApp } from './contexto';
import { Janela, Grupo } from './janela-base';
import { CAMPOS_VAZIOS, CamposChegadaPrazo, CamposIdentificacao, CAMPOS_DA_SECAO, doCampos, EditorTarefas, mudou, novoUuid, paraDadosNovos, paraEnvio, type Campos, type Secao, type TarefaForm } from './campos';
import { plural, type Demanda, type Etapa } from '@/lib/demandas';
import * as srv from '@/servidor/demandas';

const PASSOS = ['Identificação', 'Chegada e prazo', 'Tarefas'] as const;
const TODAS = [...CAMPOS_DA_SECAO.identificacao, ...CAMPOS_DA_SECAO.descricao, ...CAMPOS_DA_SECAO.chegada];

export function JanelaNova({ etapa }: { etapa?: Etapa }) {
  const { rascunhos, guardarRascunho, fecharJanela, criar, salvar, avisar, dias, hoje } = useApp();
  const rasc = rascunhos['nova'];
  const [c, setC] = useState<Campos>(() => ({ ...CAMPOS_VAZIOS, ...(rasc?.dados as Partial<Campos> | undefined) }));
  const [passo, setPasso] = useState<1 | 2 | 3>(rasc?.passo ?? 1);
  const [idNovo] = useState(novoUuid);
  const [d, setD] = useState<Demanda | null>(null);
  const [salvo, setSalvo] = useState<Campos | null>(null); // os campos como estão gravados (só existe depois da criação)
  const [tarefas, setTarefas] = useState<TarefaForm[]>([]);
  const [nt, setNt] = useState('');
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);
  const corpo = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [recuperado] = useState(!!rasc);
  const mudar = (p: Partial<Campos>) => { setC((x) => ({ ...x, ...p })); if (erro) setErro(''); };

  const listaTarefas = [...paraEnvio(tarefas), ...(nt.trim() ? [{ texto: nt.trim(), concluida: false }] : [])];
  const campoPendente = !!d && !!salvo && mudou(c, salvo, TODAS);
  const algoPendente = campoPendente || listaTarefas.length > 0;
  const sujoAntes = !d && !!(c.assunto || c.numero || c.origem || c.descricao || c.chegou_em || c.prazo_original);
  const sujo = d ? algoPendente : sujoAntes;

  // rascunho automático antes da criação (meio segundo depois da última alteração): recarregar ou perder a sessão não perde o texto
  useEffect(() => {
    if (d || !sujoAntes) return;
    const t = setTimeout(() => guardarRascunho('nova', { dados: c, passo: passo === 3 ? 2 : passo }), 500);
    return () => clearTimeout(t);
  }, [d, sujoAntes, c, passo, guardarRascunho]);

  // ao trocar de passo, o foco vai para o primeiro campo do passo novo
  useEffect(() => { corpo.current?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=date]), textarea')?.focus(); }, [passo]);

  const rascunhoDoQueFicou = (): { chave: string; r: Parameters<typeof guardarRascunho>[1] } | null => {
    if (!d) return null;
    const secoes: Secao[] = [];
    if (salvo) {
      if (mudou(c, salvo, CAMPOS_DA_SECAO.identificacao)) secoes.push('identificacao');
      if (mudou(c, salvo, CAMPOS_DA_SECAO.descricao)) secoes.push('descricao');
      if (mudou(c, salvo, CAMPOS_DA_SECAO.chegada)) secoes.push('chegada');
    }
    if (listaTarefas.length) secoes.push('tarefas');
    if (!secoes.length) return null;
    return { chave: `d:${d.id}`, r: { dados: { ...c }, tarefas: listaTarefas, nt: '', versao: d.versao, secoes } };
  };

  const fecharAgora = (guardar: boolean) => {
    if (!d) { guardarRascunho('nova', guardar && sujoAntes ? { dados: c, passo: passo === 3 ? 2 : passo } : null); fecharJanela(); return; }
    const rd = guardar ? rascunhoDoQueFicou() : null;
    if (rd) guardarRascunho(rd.chave, rd.r);
    avisar(rd ? `Demanda criada em ${d.etapa}. O que não foi salvo ficou em rascunho nela.` : `Demanda criada em ${d.etapa}.`);
    fecharJanela();
  };
  const tentarFechar = () => {
    if (!d) { fecharAgora(true); return; }
    if (algoPendente) { setConfirmar(true); return; }
    fecharAgora(false);
  };
  const cancelarAntes = () => { guardarRascunho('nova', null); fecharJanela(); };

  const proximo = () => {
    if (!c.assunto.trim()) { setErro('Informe o assunto da demanda.'); document.getElementById('n-assunto')?.focus(); return; }
    setErro(''); setPasso(2);
  };

  // passo 2 -> 3: cria a demanda (primeira vez) ou grava as alterações (volta ao passo anterior e muda algo)
  const salvarDemanda = async () => {
    if (trava.current) return;
    if (!c.assunto.trim()) { setPasso(1); setErro('Informe o assunto da demanda.'); return; }
    trava.current = true; setSalvando(true); setErro('');
    try {
      if (!d) {
        const r = await criar({ ...paraDadosNovos(c), id: idNovo, ...(etapa ? { etapa } : {}) }, '');
        if (!r) { setErro('Não foi possível salvar a demanda agora. Nada foi criado e o que você digitou continua aqui. Tente de novo.'); return; }
        setD(r); setSalvo(doCampos(r)); guardarRascunho('nova', null);
        avisar(`Demanda criada e salva em ${r.etapa}.`);
        setPasso(3);
      } else if (campoPendente) {
        const r = await salvar(d.id, paraDadosNovos(c, d), null, d.versao, '');
        if (!r.ok) { setErro(r.conflito ? 'Esta demanda foi alterada em outro aparelho. Nada foi gravado e o que você digitou continua aqui.' : 'Não foi possível salvar as alterações. Nada foi gravado e o que você digitou continua aqui.'); return; }
        setD(r.demanda); setSalvo(doCampos(r.demanda)); setC(doCampos(r.demanda));
        setPasso(3);
      } else setPasso(3);
    } finally { trava.current = false; setSalvando(false); }
  };

  const pularTarefas = () => {
    if (!d) return;
    const rd = rascunhoDoQueFicou();
    if (rd) guardarRascunho(rd.chave, rd.r);
    avisar(listaTarefas.length ? `Demanda mantida em ${d.etapa}. ${plural(listaTarefas.length, 'tarefa')} em rascunho, para salvar depois.` : `Demanda mantida em ${d.etapa}, sem tarefas por enquanto.`);
    fecharJanela();
  };

  const concluir = async () => {
    if (!d || trava.current || !listaTarefas.length) return;
    trava.current = true; setSalvando(true); setErro('');
    try {
      const antes = d.etapa;
      const r = await salvar(d.id, {}, listaTarefas, d.versao, '');
      let final: Demanda | null = r.ok ? r.demanda : null;
      if (!r.ok && r.conflito) {
        // a resposta de uma tentativa anterior pode ter se perdido: se o que está gravado já é exatamente esta lista, o cadastro foi concluído
        const atual = await srv.buscarDemanda(d.id).catch(() => null);
        if (atual?.ok && atual.dados.tarefas.map((t) => t.texto).join('\n') === listaTarefas.map((t) => t.texto).join('\n')) final = atual.dados;
      }
      if (!final) { setErro('As tarefas não foram salvas e a demanda continua em ' + d.etapa + '. O que você digitou continua aqui; tente de novo.'); return; }
      guardarRascunho(`d:${d.id}`, null);
      avisar(`Cadastro concluído: ${plural(listaTarefas.length, 'tarefa')} salva${listaTarefas.length === 1 ? '' : 's'}${final.etapa !== antes ? `, a demanda foi para ${final.etapa}` : ''}.`);
      fecharJanela();
    } finally { trava.current = false; setSalvando(false); }
  };

  const vazio2 = !c.chegou_em && !c.prazo_original;
  const rotuloPasso2 = !d ? (vazio2 ? 'Pular e salvar demanda' : 'Salvar demanda e continuar') : campoPendente ? 'Salvar alterações e continuar' : 'Continuar para as tarefas';
  const titulo = etapa && etapa !== 'Cadastro' ? `Nova demanda em ${etapa}` : 'Nova demanda';

  const rodape = confirmar ? (
    <div className="confirma-fechar" role="alertdialog" aria-label="Há conteúdo não salvo">
      <span className="data">A demanda já foi criada em {d?.etapa}. {campoPendente ? 'Há campos alterados ' : ''}{campoPendente && listaTarefas.length ? 'e ' : ''}{listaTarefas.length ? `${plural(listaTarefas.length, 'tarefa')} ` : ''}ainda sem salvar. O que fazer com isso?</span>
      <span className="esp" />
      <button className="btn" onClick={() => setConfirmar(false)}>Continuar editando</button>
      <button className="btn" onClick={() => fecharAgora(false)}>Descartar e fechar</button>
      <button className="btn pri" onClick={() => fecharAgora(true)}>Guardar rascunho e fechar</button>
    </div>
  ) : passo === 1 ? (
    <><span className="data">{d ? `Demanda já criada em ${d.etapa}` : 'Rascunho guardado automaticamente'}</span><span className="esp" />{d ? null : <button className="btn" onClick={cancelarAntes}>Cancelar</button>}<button className="btn pri" onClick={proximo}>Próximo: chegada e prazo</button></>
  ) : passo === 2 ? (
    <><button className="btn" disabled={salvando} onClick={() => setPasso(1)}>Voltar</button><span className="esp" />{d ? null : <button className="btn" disabled={salvando} onClick={cancelarAntes}>Cancelar</button>}<button className="btn pri" disabled={salvando} onClick={() => void salvarDemanda()}>{salvando ? 'Salvando...' : rotuloPasso2}</button></>
  ) : (
    <><button className="btn" disabled={salvando} onClick={() => setPasso(2)}>Voltar</button><span className="esp" /><button className="btn" disabled={salvando} onClick={pularTarefas}>Pular tarefas</button><button className="btn pri" disabled={salvando || !listaTarefas.length} onClick={() => void concluir()}>{salvando ? 'Salvando...' : 'Concluir cadastro'}</button></>
  );

  return (
    <Janela titulo={titulo} aoFechar={tentarFechar} sujo={sujo} rodape={rodape}>
      <ol className="passos" aria-label="Passos do cadastro">
        {PASSOS.map((nome, i) => <li key={nome} aria-current={passo === i + 1 ? 'step' : undefined}><b>{i + 1}</b><span>{nome}</span></li>)}
      </ol>
      {recuperado && !d ? <p className="data rec">Rascunho recuperado. Cancelar descarta o texto.</p> : null}
      {erro ? <p className="data" role="alert" id="n-erro" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}
      <div ref={corpo}>
        {passo === 1 ? (
          <>
            <p className="data">Só o assunto é obrigatório. O resto você pode preencher agora, depois ou nunca.</p>
            <Grupo titulo="Identificação"><CamposIdentificacao c={c} mudar={mudar} prefixo="n" comDescricao nota /></Grupo>
          </>
        ) : passo === 2 ? (
          <>
            <p className="aviso-passo" role="note">{d ? <><b>A demanda já está salva</b> em {d.etapa}. Alterações aqui editam essa mesma demanda.</> : <>Ao continuar, <b>a demanda é salva no Dmanda e fica na etapa Cadastro</b>. Nada deste passo é obrigatório: dá para pular.</>}</p>
            <Grupo titulo="Chegada e prazo"><CamposChegadaPrazo c={c} mudar={mudar} prefixo="n" hoje={hoje} dias={dias} /></Grupo>
          </>
        ) : (
          <>
            <p className="aviso-passo" role="status"><b>Demanda criada e salva</b> em {d?.etapa}. As tarefas só são salvas ao concluir o cadastro; ao concluir com pelo menos uma, a demanda segue para Vistos. Pular mantém tudo em Cadastro.</p>
            <Grupo titulo="Tarefas" dica="o que precisa ser feito"><EditorTarefas tarefas={tarefas} setTarefas={setTarefas} nt={nt} setNt={setNt} idNt="n-nt" aviso={listaTarefas.length ? undefined : 'Adicione ao menos uma tarefa para concluir, ou pule este passo.'} /></Grupo>
          </>
        )}
      </div>
    </Janela>
  );
}
