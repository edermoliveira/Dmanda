'use client';
// Cadastro guiado de demanda (decisão 27): três passos, no mesmo desenho Catalyst das demais janelas.
//   1. Identificação: tipo, número, origem, assunto e breve descrição. Só o assunto é obrigatório. Nada é gravado ainda.
//   2. Chegada e prazo: tudo opcional. Ao continuar (ou pular), a demanda é CRIADA no Supabase, na etapa Cadastro, e o botão e o aviso dizem isso.
//   3. Tarefas: ao concluir com pelo menos uma tarefa válida, as tarefas são salvas e a demanda vai para Vistos; pular ou fechar mantém a demanda em Cadastro.
// Toda demanda nova nasce em Cadastro (nenhuma coluna do Quadro muda isso). A demanda é criada uma só vez: o aplicativo gera o identificador antes, guarda-o no rascunho
// ANTES de chamar o servidor e repete com ele (a segunda chamada devolve a mesma demanda, mesmo depois de recarregar a página ou reabrir a PWA). Voltar a um passo anterior
// edita o mesmo registro. O que foi digitado e ainda não foi salvo nunca é descartado em silêncio: o rascunho 'nova' acompanha o cadastro inteiro (inclusive o passo das
// tarefas e a demanda já criada) e só some quando o cadastro termina, é pulado ou cancelado.
import { useEffect, useRef, useState } from 'react';
import { useApp } from './contexto';
import { Janela, Grupo } from './janela-base';
import { CAMPOS_VAZIOS, CamposChegadaPrazo, CamposIdentificacao, CAMPOS_DA_SECAO, chaveTarefa, doCampos, EditorTarefas, mudou, novoUuid, paraDadosNovos, paraEnvio, type Campos, type Secao, type TarefaForm } from './campos';
import { plural, type Demanda } from '@/lib/demandas';
import * as srv from '@/servidor/demandas';

const PASSOS = ['Identificação', 'Chegada e prazo', 'Tarefas'] as const;
const TODAS = [...CAMPOS_DA_SECAO.identificacao, ...CAMPOS_DA_SECAO.descricao, ...CAMPOS_DA_SECAO.chegada];

export function JanelaNova() {
  const { rascunhos, guardarRascunho, fecharJanela, criar, salvar, avisar, dias, hoje, demandas } = useApp();
  const rasc = rascunhos['nova'];
  // cadastro interrompido depois do passo 2: a demanda já existe e é reencontrada na lista. Se ela não está lá (a carga falhou, foi excluída ou arquivada), o cadastro recomeça no passo 2 com o MESMO
  // identificador: se a demanda existe, o servidor devolve a mesma (nunca uma cópia); se foi excluída, é recriada com o texto do rascunho
  const [vinc] = useState<Demanda | null>(() => (rasc?.demandaId ? demandas.find((x) => x.id === rasc.demandaId) ?? null : null));
  const [d, setD] = useState<Demanda | null>(vinc);
  const [salvo, setSalvo] = useState<Campos | null>(() => (vinc ? doCampos(vinc) : null)); // os campos como estão gravados (só existe depois da criação)
  const [versaoBase, setVersaoBase] = useState(() => (vinc ? rasc?.versao ?? vinc.versao : 0)); // a versão sobre a qual este cadastro foi digitado: se a demanda mudou desde então, gravar é recusado
  const [c, setC] = useState<Campos>(() => ({ ...CAMPOS_VAZIOS, ...(rasc?.dados as Partial<Campos> | undefined) }));
  const [passo, setPasso] = useState<1 | 2 | 3>(() => (rasc?.passo === 3 && !vinc ? 2 : rasc?.passo ?? 1));
  const [idNovo] = useState(() => rasc?.idNovo ?? novoUuid());
  const [tarefas, setTarefas] = useState<TarefaForm[]>(() => (rasc?.tarefas ?? []).map((t) => ({ chave: chaveTarefa(), ...t })));
  const [nt, setNt] = useState(rasc?.nt ?? '');
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

  // rascunho automático do cadastro inteiro (meio segundo depois da última alteração): recarregar ou perder a sessão não perde o texto, as tarefas em edição nem o vínculo com a demanda já criada
  useEffect(() => {
    if (!d && !sujoAntes) return;
    const t = setTimeout(() => guardarRascunho('nova', { dados: c, passo, idNovo, ...(d ? { demandaId: d.id, versao: versaoBase, tarefas: paraEnvio(tarefas), nt } : {}) }), 500);
    return () => clearTimeout(t);
  }, [d, sujoAntes, c, passo, idNovo, versaoBase, tarefas, nt, guardarRascunho]);

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
    return { chave: `d:${d.id}`, r: { dados: { ...c }, tarefas: listaTarefas, nt: '', versao: versaoBase, secoes } };
  };

  const fecharAgora = (guardar: boolean) => {
    if (!d) { guardarRascunho('nova', guardar && sujoAntes ? { dados: c, passo: passo === 3 ? 2 : passo, idNovo } : null); fecharJanela(); return; }
    const rd = guardar ? rascunhoDoQueFicou() : null;
    if (rd) guardarRascunho(rd.chave, rd.r);
    guardarRascunho('nova', null); // o cadastro termina aqui; o que ficou pendente passou para o rascunho da própria demanda
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
        // o identificador vai para o rascunho antes da chamada: se a resposta se perder e a página for recarregada, a nova tentativa usa o mesmo e não duplica
        guardarRascunho('nova', { dados: c, passo: 2, idNovo });
        const r = await criar({ ...paraDadosNovos(c), id: idNovo }, '');
        if (!r) { setErro('Não foi possível salvar a demanda agora. Nada foi criado e o que você digitou continua aqui. Tente de novo.'); return; }
        setD(r); setSalvo(doCampos(r)); setVersaoBase(r.versao);
        guardarRascunho('nova', { dados: c, passo: 3, idNovo, demandaId: r.id, versao: r.versao, tarefas: paraEnvio(tarefas), nt });
        avisar(`Demanda criada e salva em ${r.etapa}.`);
        setPasso(3);
      } else if (campoPendente) {
        const r = await salvar(d.id, paraDadosNovos(c, d), null, versaoBase, '');
        if (!r.ok) { setErro(r.conflito ? 'Esta demanda foi alterada em outro aparelho. Nada foi gravado e o que você digitou continua aqui.' : 'Não foi possível salvar as alterações. Nada foi gravado e o que você digitou continua aqui.'); return; }
        setD(r.demanda); setSalvo(doCampos(r.demanda)); setC(doCampos(r.demanda)); setVersaoBase(r.demanda.versao);
        setPasso(3);
      } else setPasso(3);
    } finally { trava.current = false; setSalvando(false); }
  };

  const pularTarefas = () => {
    if (!d) return;
    const rd = rascunhoDoQueFicou();
    if (rd) guardarRascunho(rd.chave, rd.r);
    guardarRascunho('nova', null);
    avisar(listaTarefas.length ? `Demanda mantida em ${d.etapa}. ${plural(listaTarefas.length, 'tarefa')} em rascunho, para salvar depois.` : `Demanda mantida em ${d.etapa}, sem tarefas por enquanto.`);
    fecharJanela();
  };

  const concluir = async () => {
    if (!d || trava.current || !listaTarefas.length) return;
    trava.current = true; setSalvando(true); setErro('');
    try {
      const antes = d.etapa;
      const r = await salvar(d.id, {}, listaTarefas, versaoBase, '');
      let final: Demanda | null = r.ok ? r.demanda : null;
      if (!r.ok && r.conflito) {
        // a resposta de uma tentativa anterior pode ter se perdido: se o que está gravado já é exatamente esta lista, o cadastro foi concluído
        const atual = await srv.buscarDemanda(d.id).catch(() => null);
        if (atual?.ok && atual.dados.tarefas.map((t) => t.texto).join('\n') === listaTarefas.map((t) => t.texto).join('\n')) final = atual.dados;
      }
      if (!final) { setErro(!r.ok && r.conflito ? 'Esta demanda foi alterada em outro aparelho. Nada foi gravado e o que você digitou continua aqui.' : 'As tarefas não foram salvas e a demanda continua em ' + d.etapa + '. O que você digitou continua aqui; tente de novo.'); return; }
      guardarRascunho(`d:${d.id}`, null); guardarRascunho('nova', null);
      avisar(`Cadastro concluído: ${plural(listaTarefas.length, 'tarefa')} salva${listaTarefas.length === 1 ? '' : 's'}${final.etapa !== antes ? `, a demanda foi para ${final.etapa}` : ''}.`);
      fecharJanela();
    } finally { trava.current = false; setSalvando(false); }
  };

  const vazio2 = !c.chegou_em && !c.prazo_original;
  const rotuloPasso2 = !d ? (vazio2 ? 'Pular e salvar demanda' : 'Salvar demanda e continuar') : campoPendente ? 'Salvar alterações e continuar' : 'Continuar para as tarefas';

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
    <Janela titulo="Nova demanda" aoFechar={tentarFechar} sujo={sujo} rodape={rodape}>
      <ol className="passos" aria-label="Passos do cadastro">
        {PASSOS.map((nome, i) => <li key={nome} aria-current={passo === i + 1 ? 'step' : undefined}><b>{i + 1}</b><span>{nome}</span></li>)}
      </ol>
      {recuperado && !d ? <p className="data rec">Rascunho recuperado. Cancelar descarta o texto.</p> : null}
      {recuperado && d ? <p className="data rec">Cadastro retomado. A demanda já estava salva em {d.etapa}; o que você digitou depois dela foi recuperado.</p> : null}
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
